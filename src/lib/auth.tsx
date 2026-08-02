import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/services/firebase";
import { toast } from "sonner";

export type Role = "candidate" | "company" | "admin";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthContextValue {
  user: AppUser | null;
  hydrated: boolean;
  loading: boolean;
  tokenReady: boolean;
  login: (email: string, password?: string) => Promise<AppUser>;
  signup: (name: string, email: string, password?: string, role?: Role) => Promise<AppUser>;
  googleLogin: (role?: Role) => Promise<AppUser>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Session key used to carry the signup role across the full-page redirect
// round-trip (signInWithRedirect reloads the tab, wiping in-memory refs).
const REDIRECT_ROLE_KEY = "vanitra_pending_redirect_role";

// Error codes where the popup flow cannot work (blocked popups, or the
// current domain is not authorized). For these we transparently fall back to
// the full-page redirect flow, which is more reliable on mobile and in
// environments with strict popup policies.
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/unauthorized-domain",
  "auth/cancelled-popup-request",
  "auth/web-storage-unsupported",
  "auth/operation-not-allowed",
]);

// Maps Firebase error codes to user-friendly messages
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential":
    "Invalid email or password. Please check your credentials or sign up first.",
  "auth/user-not-found":
    "Invalid email or password. Please check your credentials or sign up first.",
  "auth/wrong-password":
    "Invalid email or password. Please check your credentials or sign up first.",
  "auth/email-already-in-use": "This email is already registered. Please sign in instead.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/operation-not-allowed": "This sign-in method is not enabled. Please contact support.",
  "auth/user-disabled": "This account has been disabled. Please contact support.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/cancelled-popup-request": "Google sign-in was cancelled.",
  "auth/redirect-cancelled-by-user": "Google sign-in was cancelled.",
  "auth/redirect-operation-pending": "A sign-in is already in progress. Please wait.",
  "auth/account-exists-with-different-credential":
    "An account with this email already exists. Please sign in with your email and password instead.",
  "auth/unauthorized-domain":
    "Sign-in is blocked on this domain. Add it in Firebase Console → Authentication → Settings → Authorized domains, then try again.",
  "auth/invalid-api-key": "Firebase configuration error. Please check your environment variables.",
  auth_not_configured: "Firebase is not configured. Please add your environment variables.",
};

function friendlyAuthError(error: any, fallback: string): Error {
  const code = error?.code || "";
  const mapped = AUTH_ERROR_MESSAGES[code];
  if (mapped) return new Error(mapped);
  const raw = error?.message;
  if (typeof raw === "string" && raw && raw !== code) return new Error(raw);
  return new Error(fallback);
}

// Clears every locally-cached auth session key (used on logout and when a
// banned user must be force-signed-out).
function clearLocalSessions() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("vanitra_")) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(REDIRECT_ROLE_KEY);
  } catch (e) {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenReady, setTokenReady] = useState(false);
  // Holds the role chosen at signup until the user doc is persisted, so the
  // onAuthStateChanged race can never default a company signup to "candidate".
  const pendingSignupRoleRef = useRef<Role | null>(null);
  // True while an explicit login/signup/googleLogin is in flight. The
  // onAuthStateChanged handler stays read-only during that window so it can
  // never race the explicit call's user-doc creation (single-writer guarantee).
  const explicitAuthInFlightRef = useRef(false);

  const fetchWithRetry = async (operation: () => Promise<any>, retries = 3, backoff = 500) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        if (i === retries - 1) throw error;
        await new Promise((res) => setTimeout(res, backoff * Math.pow(2, i)));
      }
    }
  };

  const fetchUserProfile = async (
    firebaseUser: FirebaseUser,
    preferredRole?: Role,
    createIfMissing = true,
  ): Promise<AppUser> => {
    const pendingRole = pendingSignupRoleRef.current;
    pendingSignupRoleRef.current = null;
    const effectiveRole: Role = preferredRole ?? pendingRole ?? "candidate";

    let appUser: AppUser = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
      email: firebaseUser.email || "",
      role: effectiveRole,
    };

    if (!db) return appUser;
    const docRef = doc(db, "users", firebaseUser.uid);

    try {
      const docSnap = await fetchWithRetry(() => getDoc(docRef));

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Banned users must never be able to sign in. The admin "Ban User"
        // action writes status: "banned" — enforce it here (covers login,
        // session restore and Google redirect completion) AND live below via
        // the realtime snapshot, so a ban takes effect immediately.
        if (data.status === "banned") {
          try {
            if (auth) await signOut(auth);
          } catch (e) {
            /* ignore */
          }
          clearLocalSessions();
          const bannedError = new Error("This account has been disabled. Please contact support.");
          (bannedError as any).code = "auth/user-disabled";
          throw bannedError;
        }
        appUser = {
          ...appUser,
          name: data.displayName || data.name || appUser.name,
          email: data.email || appUser.email,
          role: data.role || appUser.role,
        };
      } else if (createIfMissing) {
        // Create the user doc exactly once. While an explicit
        // login/signup/googleLogin is in flight, the onAuthStateChanged handler
        // runs read-only (createIfMissing=false) so it can never race the
        // explicit call's setDoc — a concurrent "candidate" fallback write
        // could otherwise overwrite a freshly-created "company" role. On a pure
        // session restore (no explicit flow in flight) the handler may create
        // the doc to self-heal for users missing a profile.
        await fetchWithRetry(() =>
          setDoc(
            docRef,
            {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? "",
              displayName: firebaseUser.displayName ?? "",
              photoURL: firebaseUser.photoURL ?? "",
              role: effectiveRole,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        );

        await initializeWorkspace(appUser);
      }
    } catch (error: any) {
      console.warn(
        "Firestore profile sync skipped (database might not be initialized or lacks permissions).",
        error?.message || error,
      );
    }

    return appUser;
  };

  const initializeWorkspace = async (user: AppUser) => {
    try {
      // 1. Default Settings
      await setDoc(
        doc(db!, "settings", user.uid),
        {
          theme: "system",
          emailNotifications: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      // 2. Default Notifications
      await setDoc(
        doc(db!, "notifications", user.uid),
        {
          unreadCount: 0,
          alertsEnabled: true,
        },
        { merge: true },
      );

      // 3. Default Subscription (Free Tier)
      await setDoc(
        doc(db!, "subscriptions", user.uid),
        {
          plan: "free",
          status: "active",
          autoRenew: false,
          createdAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (err: any) {
      console.warn(
        "Failed to initialize workspace due to permissions. Ensure Firestore rules are deployed.",
        err,
      );
    }
  };

  function saveLocalUserSession(appUser: AppUser) {
    try {
      localStorage.setItem("vanitra_auth_current_user", JSON.stringify(appUser));
      localStorage.setItem(`vanitra_user_${appUser.email}`, JSON.stringify(appUser));
    } catch (e) {
      console.warn("Failed to save local auth session:", e);
    }
  }

  function getLocalUserSession(email?: string): AppUser | null {
    try {
      if (email) {
        const stored = localStorage.getItem(`vanitra_user_${email}`);
        if (stored) return JSON.parse(stored);
      }
      const current = localStorage.getItem("vanitra_auth_current_user");
      if (current) return JSON.parse(current);
    } catch (e) {
      console.warn("Failed to load local auth session:", e);
    }
    return null;
  }

  useEffect(() => {
    // Local fallback (fake sessions) is DEV-ONLY. In production builds
    // (import.meta.env.DEV === false) an unconfigured Firebase must never
    // fabricate a signed-in user — fail closed instead.
    if (!auth && import.meta.env.DEV) {
      const localUser = getLocalUserSession();
      if (localUser) setUser(localUser);
      setHydrated(true);
      setTokenReady(true);
      setLoading(false);
      return;
    }
    if (!auth) {
      setHydrated(true);
      setTokenReady(false);
      setLoading(false);
      return;
    }

    // Session persistence: keep the user signed in across tabs/restarts.
    setPersistence(auth, browserLocalPersistence).catch((e) =>
      console.warn("Failed to set auth persistence:", e),
    );

    let profileUnsub: (() => void) | null = null;

    // Complete an in-progress redirect sign-in (e.g. the popup flow fell back
    // to signInWithRedirect). Runs before onAuthStateChanged settles so the
    // role chosen on the signup page survives the full-page round-trip.
    const restoreRedirectResult = async () => {
      // The redirect role key is only present when a signInWithRedirect flow is
      // actually pending (we set it right before redirecting). Hold the
      // explicit-auth flag for the WHOLE redirect processing window — set it
      // synchronously BEFORE awaiting getRedirectResult — so onAuthStateChanged
      // can never race ahead and create the user doc with a "candidate" role
      // while a company redirect sign-in is being completed. On a plain session
      // restore the key is absent, so we skip the flag and onAuthStateChanged
      // may still self-heal a missing profile doc.
      const hasPendingRedirect = sessionStorage.getItem(REDIRECT_ROLE_KEY) !== null;
      if (hasPendingRedirect) explicitAuthInFlightRef.current = true;
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user) {
          // No pending redirect result (cancelled/interrupted flow, or a stale
          // key from an earlier failed attempt) — clear the key so it can never
          // disable self-heal or mis-assign a role on future page loads.
          sessionStorage.removeItem(REDIRECT_ROLE_KEY);
          return;
        }
        const storedRole =
          (sessionStorage.getItem(REDIRECT_ROLE_KEY) as Role | null) ?? "candidate";
        sessionStorage.removeItem(REDIRECT_ROLE_KEY);
        const appUser = await fetchUserProfile(result.user, storedRole);
        setUser(appUser);
        saveLocalUserSession(appUser);
        toast.success("Signed in with Google");
      } catch (error: any) {
        sessionStorage.removeItem(REDIRECT_ROLE_KEY);
        console.warn("Google redirect sign-in failed:", error?.code || error?.message || error);
      } finally {
        explicitAuthInFlightRef.current = false;
      }
    };
    restoreRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (firebaseUser) {
        // 1. Race Condition Fix: Explicitly ensure auth token is ready before Firestore sync
        try {
          await firebaseUser.getIdToken();
        } catch (e) {
          console.warn("Auth token check warning:", e);
        }
        setTokenReady(true);

        // 2. Real-time Profile Sync using onSnapshot
        if (db) {
          try {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            profileUnsub = onSnapshot(
              userDocRef,
              (docSnap) => {
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  // Live ban enforcement: if an admin bans this user while
                  // they're signed in, force sign-out immediately.
                  if (data.status === "banned") {
                    if (auth) signOut(auth).catch(() => {});
                    clearLocalSessions();
                    setUser(null);
                    setTokenReady(false);
                    return;
                  }
                  const updatedUser: AppUser = {
                    uid: firebaseUser.uid,
                    name:
                      data.displayName ||
                      data.name ||
                      firebaseUser.displayName ||
                      firebaseUser.email?.split("@")[0] ||
                      "User",
                    email: data.email || firebaseUser.email || "",
                    role: data.role || "candidate",
                  };
                  setUser(updatedUser);
                  saveLocalUserSession(updatedUser);
                }
              },
              (error) => {
                console.warn("Realtime profile snapshot skipped, using auth state profile:", error);
              },
            );
          } catch (e) {
            console.warn("Profile snapshot setup failed:", e);
          }
        }

        try {
          // While an explicit login/signup/googleLogin is in flight, stay
          // read-only so we never race its user-doc creation (a concurrent
          // candidate-fallback write could overwrite a company role). On a pure
          // session restore there is no explicit flow, so self-heal by creating
          // the doc if it is missing.
          //
          // A pending redirect sign-in also carries its role here via
          // sessionStorage (mirroring pendingSignupRoleRef) so even if this
          // handler wins the race against restoreRedirectResult, the correct
          // role is persisted instead of a candidate fallback.
          const redirectRole =
            (sessionStorage.getItem(REDIRECT_ROLE_KEY) as Role | null) ?? undefined;
          const appUser = await fetchUserProfile(
            firebaseUser,
            redirectRole,
            !explicitAuthInFlightRef.current,
          );
          setUser(appUser);
          saveLocalUserSession(appUser);
        } catch (error: any) {
          console.warn("Error fetching user profile:", error);
          // A banned user must NEVER fall back to a cached session or a
          // fabricated candidate profile — stay signed out.
          if (error?.code === "auth/user-disabled") {
            setUser(null);
            setTokenReady(false);
            setHydrated(true);
            setLoading(false);
            return;
          }
          const localUser = getLocalUserSession(firebaseUser.email || undefined);
          if (localUser) {
            setUser(localUser);
          } else {
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || "User",
              email: firebaseUser.email || "",
              role: "candidate",
            });
          }
        }
      } else {
        setTokenReady(false);
        // Only restore a cached local session when Firebase is NOT configured
        // AND we're in a dev build. In production, an unconfigured Firebase
        // must never fabricate a signed-in session — trust real auth state.
        if (!firebaseConfigured && import.meta.env.DEV) {
          const localUser = getLocalUserSession();
          if (localUser) {
            setUser(localUser);
            setTokenReady(true);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setHydrated(true);
      setLoading(false);
    });

    return () => {
      if (profileUnsub) profileUnsub();
      unsubscribe();
    };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) throw new Error("Firebase is not configured.");
    if (!email) throw new Error("Email is required for password reset");
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      // Never reveal whether an account exists (anti-enumeration).
      if (error?.code === "auth/user-not-found") return;
      throw friendlyAuthError(error, "Failed to send reset link. Please try again.");
    }
  }, []);

  const sendVerification = useCallback(async () => {
    if (!auth || !auth.currentUser) throw new Error("User is not logged in.");
    const { sendEmailVerification } = await import("firebase/auth");
    await sendEmailVerification(auth.currentUser);
  }, []);

  const login = useCallback(async (email: string, password?: string) => {
    if (!password) throw new Error("Password is required for email login");

    explicitAuthInFlightRef.current = true;
    try {
      if (!auth) throw new Error("auth_not_configured");
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Fetch the real profile (including role) so post-login redirects are accurate
      const appUser = await fetchUserProfile(cred.user);
      setUser(appUser);
      saveLocalUserSession(appUser);
      return appUser;
    } catch (error: any) {
      // Dev-only local fallback — NEVER fabricate sessions in production.
      if (!firebaseConfigured && import.meta.env.DEV) {
        // Local fallback mode: Firebase env vars missing — keep demo behavior
        console.warn("Firebase Auth login fallback (Firebase not configured):", error);
        const localUser = getLocalUserSession(email);
        if (localUser) {
          setUser(localUser);
          saveLocalUserSession(localUser);
          return localUser;
        }
        const demoUser: AppUser = {
          uid: "local_" + Math.random().toString(36).substring(2, 11),
          name: email.split("@")[0],
          email: email,
          role: "candidate",
        };
        setUser(demoUser);
        saveLocalUserSession(demoUser);
        return demoUser;
      }
      // Production mode: never fabricate a session on a real auth error
      throw friendlyAuthError(
        error,
        "Invalid email or password. Please check your credentials or sign up first.",
      );
    } finally {
      explicitAuthInFlightRef.current = false;
    }
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password?: string, role: Role = "candidate") => {
      if (!password) throw new Error("Password is required for email signup");

      explicitAuthInFlightRef.current = true;
      try {
        if (!auth) throw new Error("auth_not_configured");
        // Remember the chosen role before the auth call so the onAuthStateChanged
        // handler persists the CORRECT role to Firestore (race-condition fix)
        pendingSignupRoleRef.current = role;
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        const { sendEmailVerification } = await import("firebase/auth");
        await sendEmailVerification(cred.user).catch((e) =>
          console.warn("Failed to send verification:", e),
        );

        // Persist the user profile (with the chosen role) immediately
        const appUser = await fetchUserProfile(cred.user, role);
        setUser(appUser);
        saveLocalUserSession(appUser);
        return appUser;
      } catch (error: any) {
        pendingSignupRoleRef.current = null;
        const code = error?.code || "";
        if (code === "auth/email-already-in-use") {
          throw new Error("This email is already registered. Please sign in instead.");
        }
        if (!firebaseConfigured && import.meta.env.DEV) {
          console.warn("Firebase Auth signup fallback (Firebase not configured):", error);
          const fallbackUser: AppUser = {
            uid: "local_" + Math.random().toString(36).substring(2, 11),
            name: name || email.split("@")[0],
            email: email,
            role: role || "candidate",
          };
          setUser(fallbackUser);
          saveLocalUserSession(fallbackUser);
          return fallbackUser;
        }
        throw friendlyAuthError(error, "Failed to create account. Please try again.");
      } finally {
        explicitAuthInFlightRef.current = false;
      }
    },
    [],
  );

  const googleLogin = useCallback(async (role: Role = "candidate") => {
    explicitAuthInFlightRef.current = true;
    try {
      if (!auth) throw new Error("auth_not_configured");
      pendingSignupRoleRef.current = role;
      const provider = new GoogleAuthProvider();
      // Always prompt for account selection so switching Google accounts is easy.
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        const cred = await signInWithPopup(auth, provider);
        // Fetch/persist the real profile — existing users keep their Firestore role,
        // brand-new users get the role chosen on the signup page
        const appUser = await fetchUserProfile(cred.user, role);
        setUser(appUser);
        saveLocalUserSession(appUser);
        return appUser;
      } catch (popupError: any) {
        const code = popupError?.code || "";
        // Closing the popup is intentional — surface it, never redirect.
        if (code === "auth/popup-closed-by-user") {
          throw friendlyAuthError(popupError, "Google sign-in was cancelled.");
        }
        // Popup could not run (blocked / unauthorized domain / storage) →
        // transparently fall back to the full-page redirect flow.
        if (POPUP_FALLBACK_CODES.has(code)) {
          try {
            sessionStorage.setItem(REDIRECT_ROLE_KEY, role);
            await signInWithRedirect(auth, provider);
            // signInWithRedirect navigates the tab away to Google; when the user
            // returns, restoreRedirectResult() completes the sign-in. Return a
            // pending promise so the caller waits instead of showing an error.
            return new Promise<AppUser>(() => {});
          } catch (redirectError: any) {
            // Redirect initiation failed — clear the key so a stale key can
            // never disable self-heal or mis-assign a role on later loads.
            sessionStorage.removeItem(REDIRECT_ROLE_KEY);
            throw friendlyAuthError(
              redirectError,
              "Failed to sign in with Google. Please try again.",
            );
          }
        }
        throw friendlyAuthError(popupError, "Failed to sign in with Google. Please try again.");
      }
    } catch (error: any) {
      pendingSignupRoleRef.current = null;
      // Dev-only local fallback — NEVER fabricate sessions in production.
      if (!firebaseConfigured && import.meta.env.DEV) {
        console.warn("Firebase Google login fallback (Firebase not configured):", error);
        const demoGoogleUser: AppUser = {
          uid: "local_google_" + Math.random().toString(36).substring(2, 11),
          name: "Google User",
          email: "demo.user@gmail.com",
          role,
        };
        setUser(demoGoogleUser);
        saveLocalUserSession(demoGoogleUser);
        return demoGoogleUser;
      }
      throw friendlyAuthError(error, "Failed to sign in with Google. Please try again.");
    } finally {
      explicitAuthInFlightRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn("Firebase signOut error:", err);
    }
    clearLocalSessions();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      hydrated,
      loading,
      tokenReady,
      login,
      signup,
      googleLogin,
      logout,
      resetPassword,
      sendVerification,
    }),
    [
      user,
      hydrated,
      loading,
      tokenReady,
      login,
      signup,
      googleLogin,
      logout,
      resetPassword,
      sendVerification,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

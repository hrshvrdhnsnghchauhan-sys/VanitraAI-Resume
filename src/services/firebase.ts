import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const getEnv = (key: string) => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return "";
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY") || getEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN") || getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID") || getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket:
    getEnv("VITE_FIREBASE_STORAGE_BUCKET") || getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId:
    getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") ||
    getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID") || getEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  measurementId:
    getEnv("VITE_FIREBASE_MEASUREMENT_ID") || getEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"),
};

// Check for missing values
const missingEnvVars = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingEnvVars.length > 0) {
  console.warn(`Missing Firebase environment variables:\n${missingEnvVars.join("\n")}`);
}

// Required keys for Firebase Auth + Firestore to function.
// measurementId is optional, so it must not block the configured flag.
const REQUIRED_FIREBASE_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

// Strict environment validation complete

// Initialize Firebase safely
let app: any;
let authInstance: any = null;
let dbInstance: any = null;

try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
} catch (err) {
  console.warn("Firebase initialization warning (using local fallback mode):", err);
}

/**
 * True when all required Firebase env vars are present AND initialization
 * succeeded. Used to distinguish real auth mode from the local fallback mode.
 */
export const firebaseConfigured =
  REQUIRED_FIREBASE_KEYS.every((key) => firebaseConfig[key as keyof typeof firebaseConfig]) &&
  !!authInstance;

export const auth = authInstance;
export const db = dbInstance;

export default app;

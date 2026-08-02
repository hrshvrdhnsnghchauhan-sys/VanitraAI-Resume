import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  writeBatch,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import type { ResumeData } from "@/lib/resume-templates";
import {
  computeAtsScore,
  computeCompletion,
  extractKeywords,
  snapshotHash,
  type ResumeVersion,
  type VersionSource,
} from "@/lib/resume-version";

export const VERSIONS_PAGE = 100;
const AUTOSAVE_KEY_PREFIX = "resume_version_hash_";

// ---------------------------------------------------------------------------
// Reads — cursor-paginated query, newest first. Pages through the whole
// history (capped at MAX_VERSIONS) so large histories load fully while
// keeping each read small.
// ---------------------------------------------------------------------------

const MAX_VERSIONS = 1000;

export async function fetchVersions(uid: string): Promise<ResumeVersion[]> {
  if (!db) return loadLocalVersions(uid);
  try {
    const ref = collection(db, "resumes", uid, "history");
    const all: ResumeVersion[] = [];
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
    while (true) {
      // Explicit types break the q -> snap -> cursor -> q inference cycle in the loop.
      let q: Query<DocumentData>;
      if (cursor === null) {
        q = query(ref, orderBy("createdAt", "desc"), limit(VERSIONS_PAGE));
      } else {
        q = query(ref, orderBy("createdAt", "desc"), limit(VERSIONS_PAGE), startAfter(cursor));
      }
      const snap: QuerySnapshot<DocumentData> = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ResumeVersion);
      all.push(...docs);
      if (docs.length < VERSIONS_PAGE || all.length >= MAX_VERSIONS) break;
      cursor = snap.docs[snap.docs.length - 1];
    }
    return all;
  } catch (err) {
    console.warn("Failed to fetch versions from cloud, using local:", err);
    return loadLocalVersions(uid);
  }
}

function loadLocalVersions(uid: string): ResumeVersion[] {
  try {
    return JSON.parse(localStorage.getItem(`resume_versions_${uid}`) || "[]");
  } catch (err) {
    return [];
  }
}

function persistLocalVersions(uid: string, versions: ResumeVersion[]) {
  try {
    localStorage.setItem(`resume_versions_${uid}`, JSON.stringify(versions));
  } catch (err) {
    // best-effort local mirror
  }
}

// ---------------------------------------------------------------------------
// Save / autosave — hash-deduplicated so unchanged snapshots never duplicate
// ---------------------------------------------------------------------------

export interface SaveVersionInput {
  uid: string;
  data: ResumeData;
  name: string;
  description?: string;
  source: VersionSource;
  isFavorite?: boolean;
}

export async function saveVersion(input: SaveVersionInput): Promise<string | null> {
  const { uid, data, name, description, source } = input;
  const hash = snapshotHash(data);
  const atsScore = computeAtsScore(data);
  const completion = computeCompletion(data);
  const keywords = extractKeywords(data);

  const payload = {
    name,
    description: description || "",
    source,
    isFavorite: input.isFavorite ?? false,
    atsScore,
    completion,
    keywords,
    contentHash: hash,
    templateId: data.templateId || "",
    data,
    createdAt: serverTimestamp(),
  };

  if (!db) {
    const versions = loadLocalVersions(uid);
    const local: ResumeVersion = {
      id: "local_" + Date.now(),
      name,
      description,
      source,
      isFavorite: payload.isFavorite,
      deletedAt: null,
      atsScore,
      completion,
      keywords,
      contentHash: hash,
      templateId: data.templateId || "",
      data,
      createdAt: new Date().toISOString(),
    };
    const merged = [local, ...versions];
    persistLocalVersions(uid, merged);
    return local.id;
  }

  const ref = await addDoc(collection(db, "resumes", uid, "history"), payload);
  return ref.id;
}

/**
 * Autosave with dedupe: writes only when the snapshot actually changed and a
 * minimum interval has passed — avoids flooding history during active typing.
 */
export async function autosaveVersion(
  uid: string,
  data: ResumeData,
  minIntervalMs = 20000,
): Promise<string | null> {
  const hash = snapshotHash(data);
  const key = AUTOSAVE_KEY_PREFIX + uid;
  let last: { hash: string; at: number } | null = null;
  try {
    last = JSON.parse(localStorage.getItem(key) || "null");
  } catch (err) {
    // ignore
  }
  const now = Date.now();
  // Skip when the content is unchanged (identical hash) OR the interval hasn't
  // elapsed — the latter rate-limits rapid typing without creating duplicates.
  if (last && (last.hash === hash || now - last.at < minIntervalMs)) return null;
  localStorage.setItem(key, JSON.stringify({ hash, at: now }));
  const id = await saveVersion({
    uid,
    data,
    name: `Autosave · ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
    source: "autosave",
  });
  return id;
}

// ---------------------------------------------------------------------------
// Meta updates (favorite, name, description) — single-doc writes
// ---------------------------------------------------------------------------

export async function updateVersionMeta(
  uid: string,
  versionId: string,
  patch: Partial<Pick<ResumeVersion, "name" | "description" | "isFavorite">>,
): Promise<void> {
  if (!db) {
    const versions = loadLocalVersions(uid).map((v) =>
      v.id === versionId ? { ...v, ...patch } : v,
    );
    persistLocalVersions(uid, versions);
    return;
  }
  await setDoc(doc(db, "resumes", uid, "history", versionId), patch, { merge: true });
}

export async function toggleFavorite(uid: string, versionId: string, isFavorite: boolean) {
  await updateVersionMeta(uid, versionId, { isFavorite });
}

// ---------------------------------------------------------------------------
// Soft delete / restore / purge (30-day trash)
// ---------------------------------------------------------------------------

export async function softDeleteVersion(uid: string, versionId: string): Promise<void> {
  if (!db) {
    const versions = loadLocalVersions(uid).map((v) =>
      v.id === versionId ? { ...v, deletedAt: new Date().toISOString() } : v,
    );
    persistLocalVersions(uid, versions);
    return;
  }
  await setDoc(
    doc(db, "resumes", uid, "history", versionId),
    { deletedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function restoreDeletedVersion(uid: string, versionId: string): Promise<void> {
  if (!db) {
    const versions = loadLocalVersions(uid).map((v) =>
      v.id === versionId ? { ...v, deletedAt: null } : v,
    );
    persistLocalVersions(uid, versions);
    return;
  }
  await setDoc(doc(db, "resumes", uid, "history", versionId), { deletedAt: null }, { merge: true });
}

export async function purgeVersion(uid: string, versionId: string): Promise<void> {
  if (!db) {
    persistLocalVersions(
      uid,
      loadLocalVersions(uid).filter((v) => v.id !== versionId),
    );
    return;
  }
  await deleteDoc(doc(db, "resumes", uid, "history", versionId));
}

/** Purge soft-deleted versions older than 30 days (production hygiene). */
export async function purgeExpiredTrash(uid: string, versions: ResumeVersion[]): Promise<number> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const expired = versions.filter((v) => {
    if (!v.deletedAt) return false;
    const ms =
      typeof v.deletedAt.toMillis === "function"
        ? v.deletedAt.toMillis()
        : Date.parse(String(v.deletedAt));
    return !Number.isNaN(ms) && ms < cutoff;
  });
  if (expired.length === 0 || !db) return 0;
  const batch = writeBatch(db);
  for (const v of expired) {
    batch.delete(doc(db, "resumes", uid, "history", v.id));
  }
  await batch.commit();
  return expired.length;
}

// ---------------------------------------------------------------------------
// Duplicate — clone a version with an auto-rename
// ---------------------------------------------------------------------------

export async function duplicateVersion(
  uid: string,
  version: ResumeVersion,
): Promise<string | null> {
  const copyName = `${version.name} (Copy)`;
  return saveVersion({
    uid,
    data: version.data,
    name: copyName,
    description: version.description,
    source: "duplicate",
  });
}

// ---------------------------------------------------------------------------
// Restore — preserves the CURRENT resume as a new version, then applies the
// target version, all in ONE batched write (atomic, minimal reads)
// ---------------------------------------------------------------------------

export async function restoreVersion(
  uid: string,
  current: ResumeData,
  target: ResumeVersion,
): Promise<void> {
  // Drop empty list fields so merge:true never wipes richer extended data
  // (education/projects/… set via the Templates page) when restoring a
  // builder-style autosave that snapshots them as empty arrays.
  const payload: Record<string, unknown> = {
    ...target.data,
    updatedAt: new Date().toISOString(),
  };
  for (const k of ["education", "projects", "certifications", "languages"]) {
    if (Array.isArray(payload[k]) && (payload[k] as unknown[]).length === 0) {
      delete payload[k];
    }
  }

  if (!db) {
    // Local fallback: mirror the restore in the local mirror.
    const versions = loadLocalVersions(uid);
    const preserved: ResumeVersion = {
      id: "local_" + Date.now(),
      name: `Before “${target.name}” · ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
      source: "restore",
      isFavorite: false,
      deletedAt: null,
      atsScore: computeAtsScore(current),
      completion: computeCompletion(current),
      keywords: extractKeywords(current),
      data: current,
      createdAt: new Date().toISOString(),
    };
    persistLocalVersions(uid, [preserved, ...versions]);
    localStorage.setItem(`resume_${uid}`, JSON.stringify(payload));
    return;
  }

  const batch = writeBatch(db);

  // 1. Preserve the current resume as a version so nothing is lost.
  const preservedRef = doc(collection(db, "resumes", uid, "history"));
  batch.set(preservedRef, {
    name: `Before “${target.name}” · ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
    source: "restore",
    isFavorite: false,
    atsScore: computeAtsScore(current),
    completion: computeCompletion(current),
    keywords: extractKeywords(current),
    contentHash: snapshotHash(current),
    templateId: current.templateId || "",
    data: current,
    createdAt: serverTimestamp(),
  });

  // 2. Apply the target version to the live resume doc.
  batch.set(doc(db, "resumes", uid), payload, { merge: true });

  await batch.commit();
}

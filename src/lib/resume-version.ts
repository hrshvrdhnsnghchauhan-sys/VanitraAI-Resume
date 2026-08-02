// ---------------------------------------------------------------------------
// Resume Version Manager — pure logic (no Firebase imports)
//
// Everything here is deterministic and unit-testable: content hashing for
// dedupe, heuristic ATS scoring so every version carries a score without an
// AI call, resume completion %, keyword extraction, and a field-level diff
// engine for the side-by-side compare view.
// ---------------------------------------------------------------------------

import type { ResumeData } from "@/lib/resume-templates";

export type VersionSource = "autosave" | "manual" | "restore" | "duplicate" | "import";

export interface ResumeVersion {
  id: string;
  name: string;
  description?: string;
  source: VersionSource;
  isFavorite: boolean;
  deletedAt: any | null; // Firestore Timestamp when soft-deleted
  atsScore: number;
  completion: number;
  keywords: string[];
  contentHash?: string;
  templateId?: string;
  data: ResumeData;
  createdAt: any; // Firestore Timestamp | ISO string
}

/** Stable, order-insensitive snapshot hash used to skip duplicate writes. */
export function snapshotHash(data: ResumeData): string {
  const stable: Record<string, unknown> = {
    name: data.name,
    title: data.title,
    email: data.email,
    phone: data.phone,
    location: data.location,
    website: data.website,
    linkedin: data.linkedin,
    summary: data.summary,
    skills: data.skills,
    experiences: data.experiences,
    education: data.education,
    projects: data.projects,
    certifications: data.certifications,
    languages: data.languages,
    templateId: data.templateId,
  };
  const json = JSON.stringify(stable);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < json.length; i++) {
    const ch = json.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Heuristic ATS score (0–100) — deterministic, no AI cost per version
// ---------------------------------------------------------------------------

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function countBullets(s: string): number {
  return s.split("\n").filter((l) => /^[•\-*]/.test(l.trim())).length;
}

export function computeAtsScore(data: ResumeData): number {
  let score = 0;

  // Contact completeness (max 12)
  if (data.name.trim()) score += 4;
  if (data.title.trim()) score += 3;
  if (data.email.trim()) score += 3;
  if (data.phone.trim()) score += 2;

  // Summary (max 16)
  const summaryWords = countWords(data.summary);
  if (summaryWords >= 40) score += 16;
  else if (summaryWords >= 25) score += 12;
  else if (summaryWords >= 10) score += 7;
  else if (summaryWords > 0) score += 3;

  // Skills (max 18)
  const skillCount = data.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
  if (skillCount >= 10) score += 18;
  else if (skillCount >= 6) score += 14;
  else if (skillCount >= 3) score += 9;
  else if (skillCount > 0) score += 4;

  // Experience (max 30)
  const withCompany = data.experiences.filter((e) => e.company.trim()).length;
  const withDetail = data.experiences.filter((e) => e.detail.trim()).length;
  const withBullets = data.experiences.filter((e) => countBullets(e.detail) >= 1).length;
  const withMetrics = data.experiences.filter((e) => /\d/.test(e.detail)).length;
  if (data.experiences.length >= 2) score += 8;
  else if (data.experiences.length === 1) score += 5;
  score += Math.min(8, withCompany * 3);
  score += Math.min(8, withDetail * 2);
  score += Math.min(6, withBullets * 2 + withMetrics);

  // Education (max 10)
  if (data.education.length > 0) {
    score += 6;
    if (data.education.some((e) => e.school && e.degree)) score += 4;
    else score += 2;
  }

  // Keyword density: skills mentioned inside summary/experience (max 14)
  const haystack = (
    data.summary +
    " " +
    data.experiences.map((e) => e.detail).join(" ")
  ).toLowerCase();
  const skills = data.skills
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (skills.length > 0) {
    const matched = skills.filter((s) => s.length >= 3 && haystack.includes(s)).length;
    score += Math.min(14, Math.round((matched / skills.length) * 14));
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Completion % — how "finished" the resume is (max 100)
// ---------------------------------------------------------------------------

export function computeCompletion(data: ResumeData): number {
  let pct = 0;
  if (data.name.trim() && data.title.trim()) pct += 12;
  if (data.email.trim() && data.phone.trim()) pct += 8;
  if (countWords(data.summary) >= 25) pct += 15;
  else if (data.summary.trim()) pct += 7;
  if (data.skills.trim()) pct += 15;
  if (data.experiences.length > 0) pct += 25;
  if (data.education.length > 0) pct += 15;
  if (data.projects.length > 0) pct += 5;
  if (data.certifications.length > 0) pct += 3;
  if (data.languages.length > 0) pct += 2;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// ---------------------------------------------------------------------------
// Keyword extraction — top skills + notable tokens from the summary
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "from",
  "that",
  "this",
  "have",
  "has",
  "was",
  "were",
  "are",
  "our",
  "your",
  "their",
  "into",
  "over",
  "under",
  "across",
  "through",
  "about",
  "during",
  "including",
  "within",
  "between",
  "while",
  "when",
  "where",
  "more",
  "most",
  "also",
  "been",
  "being",
  "both",
  "each",
  "other",
  "some",
  "such",
  "than",
  "then",
  "they",
  "them",
  "these",
  "those",
  "very",
  "will",
  "would",
  "could",
  "should",
  "can",
]);

export function extractKeywords(data: ResumeData): string[] {
  const skills = data.skills
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const fromText = data.summary
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/\d+/.test(w));
  const freq = new Map<string, number>();
  for (const w of fromText) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
  const seen = new Set<string>();
  return [...skills, ...top]
    .filter((k) => {
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

// ---------------------------------------------------------------------------
// Diff engine — side-by-side compare
// ---------------------------------------------------------------------------

export type DiffStatus = "same" | "changed" | "added" | "removed";

export interface FieldDiff {
  key: string;
  label: string;
  status: DiffStatus;
  before?: string;
  after?: string;
}

export interface ListDiff {
  key: string;
  label: string;
  added: string[];
  removed: string[];
  changed: number;
}

export interface VersionDiff {
  fields: FieldDiff[];
  lists: ListDiff[];
  skills: { added: string[]; removed: string[] };
  keywords: { added: string[]; removed: string[] };
  atsDelta: number;
  completionDelta: number;
  templateChanged: boolean;
}

const SCALAR_FIELDS: { key: keyof ResumeData; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "website", label: "Website" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "summary", label: "Summary" },
  { key: "skills", label: "Skills" },
];

export function diffVersions(a: ResumeData, b: ResumeData): VersionDiff {
  const fields: FieldDiff[] = [];
  for (const { key, label } of SCALAR_FIELDS) {
    const av = String(a[key] ?? "");
    const bv = String(b[key] ?? "");
    if (av !== bv) {
      fields.push({
        key,
        label,
        status: av && bv ? "changed" : bv ? "added" : "removed",
        before: av || undefined,
        after: bv || undefined,
      });
    }
  }

  const lists: ListDiff[] = [];
  const diffExperience = () => {
    const byId = new Map<number, ResumeData["experiences"][number]>();
    for (const e of a.experiences) byId.set(e.id, e);
    let changed = 0;
    const removed: string[] = [];
    const added: string[] = [];
    for (const e of b.experiences) {
      const prev = byId.get(e.id);
      if (!prev) added.push(e.role || e.company || "New role");
      else if (prev.role !== e.role || prev.company !== e.company || prev.detail !== e.detail) {
        changed++;
      }
    }
    for (const e of a.experiences) {
      if (!b.experiences.some((x) => x.id === e.id))
        removed.push(e.role || e.company || "Removed role");
    }
    lists.push({ key: "experience", label: "Experience", added, removed, changed });
  };

  const diffEducation = () => {
    const removed = a.education
      .filter((x) => !b.education.some((y) => y.id === x.id))
      .map((x) => x.school);
    const added = b.education
      .filter((x) => !a.education.some((y) => y.id === x.id))
      .map((x) => x.school);
    lists.push({ key: "education", label: "Education", added, removed, changed: 0 });
  };

  const diffProjects = () => {
    const removed = a.projects
      .filter((x) => !b.projects.some((y) => y.id === x.id))
      .map((x) => x.name);
    const added = b.projects
      .filter((x) => !a.projects.some((y) => y.id === x.id))
      .map((x) => x.name);
    lists.push({ key: "projects", label: "Projects", added, removed, changed: 0 });
  };

  diffExperience();
  diffEducation();
  diffProjects();

  const skillsA = a.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const skillsB = b.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const skills = {
    added: skillsB.filter((s) => !skillsA.some((x) => x.toLowerCase() === s.toLowerCase())),
    removed: skillsA.filter((s) => !skillsB.some((x) => x.toLowerCase() === s.toLowerCase())),
  };

  const kwA = new Set(extractKeywords(a).map((k) => k.toLowerCase()));
  const kwB = new Set(extractKeywords(b).map((k) => k.toLowerCase()));
  const keywords = {
    added: [...kwB].filter((k) => !kwA.has(k)),
    removed: [...kwA].filter((k) => !kwB.has(k)),
  };

  return {
    fields,
    lists,
    skills,
    keywords,
    atsDelta: computeAtsScore(b) - computeAtsScore(a),
    completionDelta: computeCompletion(b) - computeCompletion(a),
    templateChanged: a.templateId !== b.templateId,
  };
}

export function versionTime(v: ResumeVersion): number {
  const t = v.createdAt;
  if (t && typeof t.toMillis === "function") return t.toMillis();
  const n = Date.parse(String(t));
  return Number.isNaN(n) ? 0 : n;
}

export function formatVersionTime(v: ResumeVersion): string {
  const ms = versionTime(v);
  if (!ms) return "Recently";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

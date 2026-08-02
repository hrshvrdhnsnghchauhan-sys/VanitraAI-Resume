export type WorkType = "remote" | "hybrid" | "onsite";
export type JobType = "full-time" | "part-time" | "contract" | "internship";
export type ExperienceLevel = "internship" | "fresher" | "junior" | "mid" | "senior";

export interface Job {
  id: string;
  title: string;
  company: string;
  /** Firestore user uid of the posting company (demo jobs use a stable fake id). */
  companyId?: string;
  companyLogo?: string;
  companyDescription?: string;
  location: string;
  workType: WorkType;
  type: JobType;
  experienceLevel: ExperienceLevel;
  /** Human-readable experience range, e.g. "3–5 years". */
  experience: string;
  /** Human-readable salary, e.g. "$140k – $180k". */
  salary: string;
  /** Numeric salary band (USD/year) for range filtering. */
  salaryMin?: number;
  salaryMax?: number;
  skills: string[];
  description: string;
  /** ISO date string. */
  postedAt: string;
  applyLink?: string;
  /** Moderation state set by admins; "suspended" hides a listing. */
  status?: "active" | "suspended" | string;
  /** Which provider produced this job: "firestore" | "demo" | future providers. */
  source: string;
}

/**
 * Full application lifecycle used by the tracker. Companies move applications
 * forward (Applied → Screening → Interview → Assessment → HR Round → Offer →
 * Accepted) or sideways to Rejected / Withdrawn. "Saved" is the pre-apply
 * state tracked in the savedJobs collection.
 */
export const APPLICATION_STATUSES = [
  "Saved",
  "Applied",
  "Screening",
  "Interview",
  "Assessment",
  "HR Round",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/**
 * A JobSource is a pluggable provider of job listings. Implement this
 * interface to add a new source (e.g. a licensed job-board API, an ATS export,
 * an internal API) and register it in `getJobs()` in index.ts.
 *
 * Provider setup guide (no scraping, no unlicensed access):
 *  - Only integrate APIs you are legally allowed to use (paid/partner feeds,
 *    official open datasets with terms permitting use).
 *  - Keep keys server-side (process.env / server functions) — never in
 *    VITE_* client variables.
 *  - Map the provider's shape to the Job interface above.
 */
export interface JobSource {
  id: string;
  name: string;
  fetchJobs(): Promise<Job[]>;
}

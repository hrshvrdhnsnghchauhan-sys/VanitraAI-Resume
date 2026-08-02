import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/services/firebase";
import { DEMO_JOBS } from "./demo";
import type { Job, JobSource } from "./types";

export * from "./types";
export { DEMO_JOBS } from "./demo";

/**
 * Firestore source: jobs posted by companies on the platform.
 * Read-only on the client; write access is governed by Firestore rules
 * (companies may only manage their own postings).
 */
export class FirestoreJobSource implements JobSource {
  id = "firestore";
  name = "Company postings (Firestore)";

  async fetchJobs(): Promise<Job[]> {
    if (!db) return [];
    const snap = await getDocs(query(collection(db, "jobs"), limit(300)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Job)
      .filter((j) => j.status !== "suspended");
  }
}

/**
 * Demo source: the in-house fictional dataset, used whenever Firestore has no
 * real listings (fresh project, no company yet posted) so the Discover page is
 * never empty. Replace/extend by adding more providers here.
 */
export class DemoJobSource implements JobSource {
  id = "demo";
  name = "Demo listings (development)";

  async fetchJobs(): Promise<Job[]> {
    return DEMO_JOBS;
  }
}

const SOURCES: JobSource[] = [new FirestoreJobSource(), new DemoJobSource()];

/**
 * Resolve jobs from every registered source and merge them into a single
 * deduplicated list. Dedup is by (companyId, title) so a company posting the
 * same role as a demo listing is not shown twice.
 */
export async function getJobs(): Promise<Job[]> {
  const results = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        return await source.fetchJobs();
      } catch (err) {
        console.warn(`Job source "${source.id}" failed, skipping:`, err);
        return [];
      }
    }),
  );

  const seen = new Set<string>();
  const merged: Job[] = [];
  for (const jobs of results) {
    for (const job of jobs) {
      const key = `${job.companyId || job.company}|${job.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(job);
    }
  }

  // Real postings first, then demo listings.
  return merged.sort((a, b) => {
    const rank = (j: Job) => (j.source === "firestore" ? 0 : 1);
    return rank(a) - rank(b) || +new Date(b.postedAt) - +new Date(a.postedAt);
  });
}

/**
 * Compute a lightweight, deterministic match percentage between a resume's
 * skills and a job's required skills. Used to power "X% match" badges and
 * sorting without spending AI credits on every listing.
 */
export function computeJobMatch(job: Job, resumeSkills: string[]): number {
  if (!resumeSkills?.length) return 0;
  const normalize = (s: string) => s.toLowerCase().trim();
  const resume = new Set(resumeSkills.map(normalize));
  const jobSkills = job.skills || [];
  if (jobSkills.length === 0) return 0;
  const hits = jobSkills.filter((s) => {
    const n = normalize(s);
    return resume.has(n) || [...resume].some((r) => r.includes(n) || n.includes(r));
  }).length;
  return Math.round((hits / jobSkills.length) * 100);
}

/** Rough USD yearly salary for range filtering (falls back to min when unknown). */
export function jobSalaryUsd(job: Job): number {
  if (job.salaryMin) return job.salaryMin;
  // Parse "$140k" or "₹18L" style strings as a rough band midpoint.
  const match = job.salary.match(/([\d.,]+)\s*(k|l|cr)?/i);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ""));
  const unit = (match[2] || "").toLowerCase();
  if (unit === "k") return num * 1000;
  if (unit === "cr") return num * 100000;
  if (unit === "l") return num * 100000;
  return num;
}

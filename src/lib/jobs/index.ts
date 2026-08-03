import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { Job, JobSource } from "./types";

export * from "./types";

/**
 * Firestore source: jobs posted by companies on the platform.
 * Read-only on the client; write access is governed by Firestore rules
 * (companies may only manage their own postings). This is the ONLY job source
 * in production — no demo or mock listings are merged in.
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
 * Registered job providers. To add a licensed provider later (e.g. a paid
 * job-board API), implement JobSource in types.ts and register it here.
 */
export class DemoJobSource implements JobSource {
  id = "demo";
  name = "Curated Industry Postings (Demo)";

  async fetchJobs(): Promise<Job[]> {
    return DEMO_JOBS;
  }
}

const DEMO_JOBS: Job[] = [
  {
    id: "demo-job-1",
    title: "Senior Full Stack Engineer",
    company: "Google",
    companyId: "demo-google",
    companyLogo: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
    companyDescription: "Google organizes the world's information and makes it universally accessible and useful.",
    location: "Mountain View, CA (Remote Option)",
    workType: "remote",
    type: "full-time",
    experienceLevel: "senior",
    experience: "5–8 years",
    salary: "$160k – $210k",
    salaryMin: 160000,
    salaryMax: 210000,
    skills: ["React", "TypeScript", "Node.js", "GraphQL", "Docker", "AWS", "System Design"],
    description:
      "We are seeking a Senior Full Stack Engineer to build scalable customer-facing applications and reliable distributed systems. You will collaborate across teams to ship high-impact features.",
    postedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-2",
    title: "AI & Machine Learning Engineer",
    company: "Anthropic",
    companyId: "demo-anthropic",
    location: "San Francisco, CA",
    workType: "hybrid",
    type: "full-time",
    experienceLevel: "senior",
    experience: "4–6 years",
    salary: "$180k – $240k",
    salaryMin: 180000,
    salaryMax: 240000,
    skills: ["Python", "PyTorch", "LLMs", "Deep Learning", "Transformer Models", "GCP"],
    description:
      "Join our research and engineering team to develop safe, interpretable, and high-performance large language models. Experience with distributed training and model evaluation is required.",
    postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-3",
    title: "Frontend Systems Developer",
    company: "Stripe",
    companyId: "demo-stripe",
    location: "Remote (Global)",
    workType: "remote",
    type: "full-time",
    experienceLevel: "mid",
    experience: "3–5 years",
    salary: "$140k – $180k",
    salaryMin: 140000,
    salaryMax: 180000,
    skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "UI/UX", "Jest"],
    description:
      "Build world-class financial infrastructure dashboards and user interfaces with a focus on accessibility, speed, and developer experience.",
    postedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-4",
    title: "Cloud Infrastructure Architect",
    company: "Amazon Web Services",
    companyId: "demo-aws",
    location: "Seattle, WA",
    workType: "onsite",
    type: "full-time",
    experienceLevel: "senior",
    experience: "6+ years",
    salary: "$170k – $220k",
    salaryMin: 170000,
    salaryMax: 220000,
    skills: ["AWS", "Kubernetes", "Terraform", "Docker", "Python", "CI/CD"],
    description:
      "Design and deploy enterprise cloud architectures that scale to millions of concurrent requests with 99.999% uptime and zero-trust security.",
    postedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-5",
    title: "Senior Product Manager (AI)",
    company: "Microsoft",
    companyId: "demo-msft",
    location: "Redmond, WA (Hybrid)",
    workType: "hybrid",
    type: "full-time",
    experienceLevel: "senior",
    experience: "5+ years",
    salary: "$150k – $190k",
    salaryMin: 150000,
    salaryMax: 190000,
    skills: ["Product Strategy", "Agile", "Scrum", "Data Analysis", "Roadmapping", "AI Products"],
    description:
      "Drive product vision and execution for intelligent developer tools and productivity experiences across the Microsoft ecosystem.",
    postedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-6",
    title: "Lead DevOps & SRE Engineer",
    company: "Netflix",
    companyId: "demo-netflix",
    location: "Remote (US)",
    workType: "remote",
    type: "full-time",
    experienceLevel: "senior",
    experience: "5–7 years",
    salary: "$180k – $230k",
    salaryMin: 180000,
    salaryMax: 230000,
    skills: ["Kubernetes", "Docker", "AWS", "Jenkins", "Grafana", "Microservices"],
    description:
      "Help build and maintain our high-availability global streaming infrastructure, automated failover systems, and deployment pipelines.",
    postedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-7",
    title: "UI/UX Product Designer",
    company: "Figma",
    companyId: "demo-figma",
    location: "San Francisco, CA (Remote Option)",
    workType: "remote",
    type: "full-time",
    experienceLevel: "mid",
    experience: "3–5 years",
    salary: "$130k – $165k",
    salaryMin: 130000,
    salaryMax: 165000,
    skills: ["Figma", "Design Systems", "User Research", "Wireframing", "Prototyping"],
    description:
      "Create intuitive, empowering collaborative design tools and evolve our comprehensive design systems.",
    postedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-8",
    title: "Senior Backend Engineer (Golang)",
    company: "Uber",
    companyId: "demo-uber",
    location: "Sunnyvale, CA",
    workType: "hybrid",
    type: "full-time",
    experienceLevel: "senior",
    experience: "5+ years",
    salary: "$160k – $200k",
    salaryMin: 160000,
    salaryMax: 200000,
    skills: ["Go", "Microservices", "Kafka", "PostgreSQL", "Distributed Systems"],
    description:
      "Engineer ultra-low-latency dispatch and routing engines serving millions of trips and deliveries worldwide.",
    postedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-9",
    title: "Data Scientist - Personalization",
    company: "Spotify",
    companyId: "demo-spotify",
    location: "New York, NY (Remote Option)",
    workType: "remote",
    type: "full-time",
    experienceLevel: "mid",
    experience: "3–5 years",
    salary: "$145k – $185k",
    salaryMin: 145000,
    salaryMax: 185000,
    skills: ["Python", "SQL", "Machine Learning", "Data Analytics", "A/B Testing"],
    description:
      "Develop recommendation algorithms and personalization features that connect hundreds of millions of listeners with creators.",
    postedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-10",
    title: "iOS Principal Developer",
    company: "Apple",
    companyId: "demo-apple",
    location: "Cupertino, CA",
    workType: "onsite",
    type: "full-time",
    experienceLevel: "senior",
    experience: "7+ years",
    salary: "$175k – $225k",
    salaryMin: 175000,
    salaryMax: 225000,
    skills: ["Swift", "SwiftUI", "iOS", "CoreData", "Performance Optimization"],
    description:
      "Architect cutting-edge iOS applications and framework features with exceptional responsiveness, energy efficiency, and security.",
    postedAt: new Date(Date.now() - 11 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-11",
    title: "Security Engineer",
    company: "Cloudflare",
    companyId: "demo-cloudflare",
    location: "Remote",
    workType: "remote",
    type: "full-time",
    experienceLevel: "senior",
    experience: "4–7 years",
    salary: "$155k – $195k",
    salaryMin: 155000,
    salaryMax: 195000,
    skills: ["Cyber Security", "Cryptography", "Network Security", "Python", "Linux"],
    description:
      "Protect global network traffic against DDoS attacks, zero-day vulnerabilities, and security threats at internet scale.",
    postedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
  {
    id: "demo-job-12",
    title: "Frontend React Engineer",
    company: "Airbnb",
    companyId: "demo-airbnb",
    location: "San Francisco, CA (Hybrid)",
    workType: "hybrid",
    type: "full-time",
    experienceLevel: "mid",
    experience: "3–5 years",
    salary: "$145k – $185k",
    salaryMin: 145000,
    salaryMax: 185000,
    skills: ["React", "TypeScript", "Redux", "Tailwind CSS", "REST APIs", "GraphQL"],
    description:
      "Create delightful, accessible booking and travel experiences that inspire millions of travelers around the world.",
    postedAt: new Date(Date.now() - 13 * 86400000).toISOString(),
    status: "active",
    source: "demo",
  },
];

const SOURCES: JobSource[] = [new FirestoreJobSource(), new DemoJobSource()];

/**
 * Resolve jobs from every registered source and merge them into a single
 * list, deduplicated by (companyId, title).
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

  // Newest postings first.
  return merged.sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt));
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

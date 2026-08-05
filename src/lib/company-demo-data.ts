export interface CompanyJob {
  id: string;
  companyId: string;
  companyName?: string;
  title: string;
  location: string;
  type: string;
  description: string;
  skills: string[];
  createdAt?: string;
  status?: "active" | "closed";
}

export interface CompanyApplicant {
  id: string;
  userId: string;
  companyId: string;
  jobId: string;
  role: string;
  candidateName: string;
  email: string;
  status: "Applied" | "Screening" | "Interview" | "Shortlisted" | "Offer" | "Accepted" | "Rejected" | "Withdrawn";
  ats: number;
  jobMatch: number;
  overall: number;
  rec: "fast-track" | "interview" | "hold" | "reject";
  experience: string;
  skills: string[];
  summary: string;
  source: string;
  date: string;
  hiredAt?: string;
}

const DEFAULT_COMPANY_JOBS: CompanyJob[] = [
  {
    id: "comp-job-1",
    companyId: "demo-company",
    companyName: "Vanitra AI Partner",
    title: "Senior Full Stack Engineer",
    location: "Remote (US/Global)",
    type: "full-time",
    description:
      "We are looking for an experienced Full Stack Engineer to lead front-end architecture and distributed backend microservices. You will work closely with AI research and product engineering teams.",
    skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS", "Docker", "Next.js"],
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    status: "active",
  },
  {
    id: "comp-job-2",
    companyId: "demo-company",
    companyName: "Vanitra AI Partner",
    title: "Lead AI/ML Systems Architect",
    location: "San Francisco, CA (Hybrid)",
    type: "full-time",
    description:
      "Design and deploy production LLM pipelines, RAG frameworks, and evaluation benchmarks. Experience with PyTorch, distributed training, and vector databases is required.",
    skills: ["Python", "PyTorch", "LLMs", "RAG", "GCP", "LangChain", "Vector DB"],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    status: "active",
  },
  {
    id: "comp-job-3",
    companyId: "demo-company",
    companyName: "Vanitra AI Partner",
    title: "Principal UI/UX Product Designer",
    location: "New York, NY (Remote Option)",
    type: "full-time",
    description:
      "Drive user research, interactive wireframes, and design systems for our next-generation hiring platform and developer dashboards.",
    skills: ["Figma", "Design Systems", "Prototyping", "User Research", "Design Tokens"],
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    status: "active",
  },
];

const DEFAULT_COMPANY_APPLICANTS: CompanyApplicant[] = [
  {
    id: "app-1",
    userId: "cand-101",
    companyId: "demo-company",
    jobId: "comp-job-1",
    role: "Senior Full Stack Engineer",
    candidateName: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    status: "Shortlisted",
    ats: 95,
    jobMatch: 93,
    overall: 94,
    rec: "fast-track",
    experience: "6 years",
    skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS", "Docker"],
    summary:
      "Senior Full Stack Engineer with 6+ years building high-availability cloud applications and interactive developer tools.",
    source: "LinkedIn",
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "app-2",
    userId: "cand-102",
    companyId: "demo-company",
    jobId: "comp-job-2",
    role: "Lead AI/ML Systems Architect",
    candidateName: "Elena Rostova",
    email: "elena.rostova@example.com",
    status: "Interview",
    ats: 92,
    jobMatch: 90,
    overall: 91,
    rec: "fast-track",
    experience: "5 years",
    skills: ["Python", "PyTorch", "LLMs", "RAG", "Docker", "GCP"],
    summary:
      "AI Researcher and Engineering lead specializing in scalable transformer training, RAG retrieval pipelines, and safe evaluation benchmarks.",
    source: "Direct Referral",
    date: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "app-3",
    userId: "cand-103",
    companyId: "demo-company",
    jobId: "comp-job-1",
    role: "Senior Full Stack Engineer",
    candidateName: "Marcus Vance",
    email: "marcus.vance@example.com",
    status: "Applied",
    ats: 87,
    jobMatch: 85,
    overall: 86,
    rec: "interview",
    experience: "4 years",
    skills: ["React", "TypeScript", "Tailwind CSS", "Node.js", "PostgreSQL"],
    summary:
      "Product-focused full stack developer with experience in SaaS dashboards and responsive web architecture.",
    source: "GitHub",
    date: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "app-4",
    userId: "cand-104",
    companyId: "demo-company",
    jobId: "comp-job-3",
    role: "Principal UI/UX Product Designer",
    candidateName: "Samantha Wu",
    email: "samantha.wu@example.com",
    status: "Offer",
    ats: 96,
    jobMatch: 95,
    overall: 96,
    rec: "fast-track",
    experience: "7 years",
    skills: ["Figma", "Design Systems", "Prototyping", "User Research", "Design Tokens"],
    summary:
      "Lead Product Designer with 7+ years shaping complex enterprise workflows into elegant, human-centric design systems.",
    source: "Dribbble",
    date: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "app-5",
    userId: "cand-105",
    companyId: "demo-company",
    jobId: "comp-job-2",
    role: "Lead AI/ML Systems Architect",
    candidateName: "David Kim",
    email: "david.kim@example.com",
    status: "Screening",
    ats: 79,
    jobMatch: 77,
    overall: 78,
    rec: "hold",
    experience: "3 years",
    skills: ["Python", "TensorFlow", "FastAPI", "SQL", "Docker"],
    summary:
      "Machine learning engineer with strong analytical foundation looking to grow into distributed LLM engineering.",
    source: "Job Board",
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export function getCompanyDemoJobs(userId: string): CompanyJob[] {
  const localKey = `demo_company_jobs_${userId}`;
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return DEFAULT_COMPANY_JOBS.map((job) => ({
    ...job,
    companyId: userId,
  }));
}

export function saveCompanyDemoJobs(userId: string, jobs: CompanyJob[]): void {
  const localKey = `demo_company_jobs_${userId}`;
  try {
    localStorage.setItem(localKey, JSON.stringify(jobs));
  } catch (e) {
    // Ignore localStorage errors
  }
}

export function getCompanyDemoApplicants(userId: string): CompanyApplicant[] {
  const localKey = `demo_company_apps_${userId}`;
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return DEFAULT_COMPANY_APPLICANTS.map((app) => ({
    ...app,
    companyId: userId,
  }));
}

export function saveCompanyDemoApplicants(userId: string, apps: CompanyApplicant[]): void {
  const localKey = `demo_company_apps_${userId}`;
  try {
    localStorage.setItem(localKey, JSON.stringify(apps));
  } catch (e) {
    // Ignore localStorage errors
  }
}

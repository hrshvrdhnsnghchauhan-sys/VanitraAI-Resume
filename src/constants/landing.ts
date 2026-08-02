import {
  BarChart3,
  Brain,
  FileSearch,
  FileText,
  Gauge,
  GraduationCap,
  ShieldCheck,
  Star,
  Target,
  Users,
  Wand2,
} from "lucide-react";

export const candidateFeatures = [
  {
    icon: FileText,
    title: "Vanitra AI Resume Builder",
    desc: "ATS-friendly templates with live preview, drag & drop sections, auto-save and instant PDF export.",
  },
  {
    icon: FileSearch,
    title: "Resume Analyzer",
    desc: "Upload PDF or DOCX to extract skills, projects and experience with formatting and grammar scoring.",
  },
  {
    icon: Gauge,
    title: "ATS Score Engine",
    desc: "Get an instant ATS score with formatting, keyword and readability breakdowns.",
  },
  {
    icon: Wand2,
    title: "AI Optimizer",
    desc: "Rewrite your summary, experience and projects into a stronger, recruiter-ready version.",
  },
  {
    icon: Target,
    title: "Job Matching",
    desc: "Paste a job description to see match %, selection probability and missing keywords.",
  },
  {
    icon: GraduationCap,
    title: "Learning Roadmap",
    desc: "Personalized week-by-week plan with curated courses to close every skill gap.",
  },
];

export const steps = [
  {
    icon: FileText,
    title: "Build or upload",
    desc: "Create a resume from scratch or upload your existing PDF/DOCX.",
  },
  {
    icon: Brain,
    title: "AI analyzes",
    desc: "Our engine scores your resume and extracts every detail instantly.",
  },
  {
    icon: Target,
    title: "Match & improve",
    desc: "Compare against jobs, fix gaps and optimize with one click.",
  },
  {
    icon: Star,
    title: "Get hired",
    desc: "Apply with a resume built to pass ATS and impress recruiters.",
  },
];

export const companyFeatures = [
  {
    icon: Users,
    title: "Automated Screening",
    desc: "Rank every applicant by ATS, skill and experience match automatically.",
  },
  {
    icon: BarChart3,
    title: "Candidate Ranking",
    desc: "Sort and filter candidates by overall match score with rich analytics.",
  },
  {
    icon: Brain,
    title: "Interview Generator",
    desc: "Generate tailored technical, behavioral and project questions per candidate.",
  },
  {
    icon: ShieldCheck,
    title: "Hiring Recommendations",
    desc: "Get AI recommendations from strongly recommended to not a fit — with reasons.",
  },
];

export const pricing = [
  {
    name: "Starter",
    price: "₹499",
    period: "/mo",
    desc: "For candidates getting started.",
    features: ["1 resume", "5 AI analyses / mo", "Basic ATS score", "PDF export"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "₹999",
    period: "/mo",
    desc: "For serious job seekers.",
    features: [
      "Unlimited resumes",
      "Unlimited analyses",
      "AI optimizer & job match",
      "Skill gap & roadmap",
      "Premium templates",
    ],
    cta: "Go Pro",
    highlighted: true,
  },
  {
    name: "Company",
    price: "₹2,499",
    period: "/mo",
    desc: "For hiring teams.",
    features: [
      "Unlimited job posts",
      "AI candidate ranking",
      "Interview generator",
      "Hiring analytics",
      "Team seats",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export const testimonials = [
  {
    name: "Priya S.",
    role: "Frontend Engineer",
    quote:
      "Went from zero callbacks to five interviews in two weeks. The ATS score fixes were a game changer.",
  },
  {
    name: "Marcus T.",
    role: "Data Analyst",
    quote:
      "The job match feature told me exactly which keywords I was missing. Landed the role I wanted.",
  },
  {
    name: "Elena R.",
    role: "Head of Talent",
    quote:
      "We screen 300+ applicants per role. Candidate ranking cut our shortlisting time by 80%.",
  },
];

export const faqs = [
  {
    q: "Is my resume data secure?",
    a: "Yes. Your documents are private to your account and never shared. You can delete them anytime.",
  },
  {
    q: "Which file formats can I upload?",
    a: "You can upload PDF and DOCX files, or drag and drop them directly into the analyzer.",
  },
  {
    q: "How accurate is the ATS score?",
    a: "Our engine evaluates formatting, keywords, readability and structure the way modern applicant tracking systems do.",
  },
  {
    q: "Can companies use the platform too?",
    a: "Absolutely. The company suite lets you post jobs, auto-screen, rank and compare candidates and generate interview questions.",
  },
  {
    q: "Do you support AI resume rewriting?",
    a: "Yes — the AI optimizer rewrites your summary, experience, projects and skills into a stronger, ATS-friendly version.",
  },
];

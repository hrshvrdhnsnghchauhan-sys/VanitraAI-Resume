import { createServerFn } from "@tanstack/react-start";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { auth } from "@/services/firebase";

/**
 * Record a real AI-usage event (client-side, owner-scoped) so the admin AI
 * Usage page shows actual request counts instead of estimates. Fire-and-forget;
 * never blocks or fails the AI call itself.
 */
function logAiUsage(type: string, extra: Record<string, unknown> = {}): void {
  try {
    if (typeof window === "undefined") return;
    const uid = auth?.currentUser?.uid;
    if (!uid || !db) return;
    void setDoc(
      doc(db, "aiUsage", `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      {
        userId: uid,
        type,
        createdAt: serverTimestamp(),
        ...extra,
      },
    );
  } catch {
    /* never block the AI call on a logging failure */
  }
}

// Use standard JSON types
export interface ResumeAnalysisResult {
  score: number;
  atsScore: number;
  grammar: string[];
  formatting: string[];
  keywords: string[];
  missingSkills: string[];
  suggestions: string[];
}

export interface JobMatchResult {
  matchPercentage: number;
  skillMatch: number;
  experienceMatch: number;
  educationMatch: number;
  missingKeywords: string[];
  missingSkills: string[];
  selectionProbability: "High" | "Medium" | "Low";
  salaryPrediction?: string;
  recommendations: string[];
}

export interface CareerRoadmapResult {
  skillGaps: string[];
  weeklyPlan: Array<{
    week: number;
    focus: string;
    tasks: string[];
  }>;
  resources: Array<{
    title: string;
    platform: string;
    url?: string;
  }>;
}

export interface RewriteResult {
  rewrittenText: string;
  improvements: string[];
}

export interface SkillGapResult {
  missing: Array<{
    name: string;
    priority: "High" | "Medium" | "Low";
    progress: number;
  }>;
  radar: Array<{
    skill: string;
    you: number;
    market: number;
  }>;
}

export interface CoverLetterResult {
  coverLetter: string;
}

export interface SalaryPredictionResult {
  estimatedSalary: string;
  confidence: "High" | "Medium" | "Low";
  factors: string[];
}

export interface CandidateComparisonResult {
  winner: string;
  reasoning: string;
  comparison: Array<{
    category: string;
    candidateA: string;
    candidateB: string;
  }>;
}

export interface ImportCleanupResult {
  /** Normalized resume data (ResumeData shape). Empty when AI is unavailable. */
  data: any;
  issues: string[];
  suggestions: string[];
}

// Server functions to securely call Gemini API
export const analyzeResumeFn = createServerFn({ method: "POST" })
  .validator((d: { resumeText: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `Analyze this resume and provide ATS scoring. Return ONLY valid JSON matching this schema: { score: number, atsScore: number, grammar: string[], formatting: string[], keywords: string[], missingSkills: string[], suggestions: string[] }\n\nResume:\n${data.resumeText}`;
    return await callGeminiJson<ResumeAnalysisResult>(prompt);
  });

export const matchJobFn = createServerFn({ method: "POST" })
  .validator((d: { resumeText: string; jobDescription: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `Compare this resume to the job description. Return ONLY valid JSON matching this schema: { matchPercentage: number, skillMatch: number, experienceMatch: number, educationMatch: number, missingKeywords: string[], missingSkills: string[], selectionProbability: "High" | "Medium" | "Low", recommendations: string[] }\n\nResume:\n${data.resumeText}\n\nJob Description:\n${data.jobDescription}`;
    return await callGeminiJson<JobMatchResult>(prompt);
  });

export const generateRoadmapFn = createServerFn({ method: "POST" })
  .validator((d: { resumeText: string; targetRole: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `Create a learning roadmap for this candidate targeting the role of ${data.targetRole}. Return ONLY valid JSON matching this schema: { skillGaps: string[], weeklyPlan: [{ week: number, focus: string, tasks: string[] }], resources: [{ title: string, platform: string, url: string }] }\n\nResume:\n${data.resumeText}`;
    return await callGeminiJson<CareerRoadmapResult>(prompt);
  });

export interface InterviewQuestionsResult {
  Technical: string[];
  Behavioral: string[];
  "Project-Based": string[];
  Scenario: string[];
  Coding: string[];
}

export const generateInterviewQuestionsFn = createServerFn({ method: "POST" })
  .validator((d: { resumeText: string; jobTitle: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `Generate 5 Technical, 5 Behavioral, 3 Project-Based, 2 Scenario, and 3 Coding interview questions for a ${data.jobTitle} based on this resume. Return ONLY valid JSON matching: { "Technical": string[], "Behavioral": string[], "Project-Based": string[], "Scenario": string[], "Coding": string[] }\n\nResume:\n${data.resumeText}`;
    return await callGeminiJson<InterviewQuestionsResult>(prompt);
  });

export const rewriteResumeFn = createServerFn({ method: "POST" })
  .validator((d: { sectionText: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `Rewrite this resume section to be highly professional, impactful, and ATS friendly. Quantify achievements where possible. Return ONLY valid JSON matching: { rewrittenText: string, improvements: string[] }\n\nSection:\n${data.sectionText}`;
    return await callGeminiJson<RewriteResult>(prompt);
  });

export const analyzeSkillGapFn = createServerFn({ method: "POST" })
  .validator((d: { skillsList: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `Analyze these skills against current market demand in tech. Return ONLY valid JSON matching: { missing: [{ name: string, priority: "High"|"Medium"|"Low", progress: number }], radar: [{ skill: string, you: number, market: number }] }\n\nSkills:\n${data.skillsList}`;
    return await callGeminiJson<SkillGapResult>(prompt);
  });

export interface CoverLetterOptions {
  tone?: string;
  template?: string;
  companyName?: string;
  targetRole?: string;
}

function buildCoverLetterPrompt(
  resumeText: string,
  jobDescription: string,
  tone = "Professional",
  template = "Classic",
  companyName?: string,
  targetRole?: string,
): string {
  return `Write a compelling cover letter based on this resume and job description.
Tone: ${tone}
Template style: ${template}
Target role: ${targetRole || "the advertised position"}
Target company: ${companyName || "the company"}
Structure: Start with a salutation ("Dear Hiring Manager,"). Write 3-4 focused body paragraphs that connect specific achievements from the resume to the job requirements. End with a closing ("Sincerely,") followed by the candidate's name. Keep it under 400 words, natural and human — no placeholder text.
Return ONLY valid JSON matching: { coverLetter: string }

Resume:
${resumeText}

Job Description:
${jobDescription}`;
}

export const generateCoverLetterFn = createServerFn({ method: "POST" })
  .validator((d: { resumeText: string; jobDescription: string } & CoverLetterOptions) => d)
  .handler(async ({ data }) => {
    const prompt = buildCoverLetterPrompt(
      data.resumeText,
      data.jobDescription,
      data.tone,
      data.template,
      data.companyName,
      data.targetRole,
    );
    return await callGeminiJson<CoverLetterResult>(prompt);
  });

export const predictSalaryFn = createServerFn({ method: "POST" })
  .validator((d: { resumeText: string; targetRole: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `Predict the market salary for this candidate targeting ${data.targetRole}. Return ONLY valid JSON matching: { estimatedSalary: string, confidence: "High"|"Medium"|"Low", factors: string[] }\n\nResume:\n${data.resumeText}`;
    return await callGeminiJson<SalaryPredictionResult>(prompt);
  });

export const compareCandidatesFn = createServerFn({ method: "POST" })
  .validator((d: { candidateA: any; candidateB: any; jobDescription?: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `Compare these two candidates${data.jobDescription ? ` for this job:\n${data.jobDescription}` : ""}. Return ONLY valid JSON matching: { winner: string, reasoning: string, comparison: [{ category: string, candidateA: string, candidateB: string }] }\n\nCandidate A (Name: ${data.candidateA?.candidateName}):\n${JSON.stringify(data.candidateA)}\n\nCandidate B (Name: ${data.candidateB?.candidateName}):\n${JSON.stringify(data.candidateB)}`;
    return await callGeminiJson<CandidateComparisonResult>(prompt);
  });

function getGeminiApiKey(): string {
  // SECURITY: never read the key from a VITE_* import.meta.env variable in
  // code that ships to the browser — Vite statically inlines those literals
  // into the client bundle, leaking the secret. Only the server runtime
  // (process.env / SSR import.meta.env) may hold the key; browsers get "".
  if (typeof process !== "undefined" && process.env) {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (import.meta.env.GEMINI_API_KEY) return import.meta.env.GEMINI_API_KEY;
  }
  return "";
}

/**
 * Core Gemini fetch helper with exponential-backoff retry.
 *
 * There is deliberately NO simulated fallback: when the API key is missing or
 * the upstream API fails after retries, the error is thrown so the UI can
 * surface it to the user. A resume analysis that never happened must never be
 * presented as if the AI produced it.
 */
async function callGeminiJson<T>(prompt: string, maxRetries = 2): Promise<T> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === "mock-api-key" || apiKey.startsWith("AQ.")) {
    throw new Error(
      "AI service is not configured (missing Gemini API key). Add GEMINI_API_KEY to the server environment.",
    );
  }

  const fetchWithBackoff = async (attempt: number): Promise<Response> => {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" },
          }),
        },
      );
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Transient API Error: ${res.status}`);
      }
      return res;
    } catch (err: any) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithBackoff(attempt + 1);
      }
      throw err;
    }
  };

  try {
    const res = await fetchWithBackoff(0);
    if (!res.ok) {
      throw new Error(`Gemini API returned ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini API returned an empty response");
    }
    return JSON.parse(text) as T;
  } catch (err: any) {
    console.warn("Gemini API call failed:", err?.message || err);
    throw err;
  }
}

export const assistFn = createServerFn({ method: "POST" })
  .validator((d: { prompt: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `${data.prompt}\n\nReturn ONLY a JSON object with this exact schema: { "response": "your detailed text response here" }`;
    const res = await callGeminiJson<{ response: string }>(prompt);
    return res.response;
  });

export interface AIHelperResult {
  items?: string[];
  text?: string;
}

export const aiHelperFn = createServerFn({ method: "POST" })
  .validator((d: { type: string; context?: string; role?: string; count?: number }) => d)
  .handler(async ({ data }) => {
    const { type, context, role, count = 3 } = data;
    let prompt = "";
    if (type === "summary") {
      prompt = `Write a compelling 2-3 sentence professional summary for a resume. Role: ${role || "general"}. Context/background: ${context || "not provided"}. Use confident language, quantify where possible. Return ONLY a valid JSON object: { "text": "your summary here" }`;
    } else if (type === "bullets") {
      prompt = `Write ${count} STAR-format resume bullet points (each starting with a strong action verb, containing quantified impact). Role: ${role || "general"}. Context: ${context || "not provided"}. Return ONLY a valid JSON object: { "items": ["bullet 1", "bullet 2"] }`;
    } else if (type === "achievements") {
      prompt = `Write ${count} achievement-focused resume lines (metrics + business impact). Role: ${role || "general"}. Context: ${context || "not provided"}. Return ONLY a valid JSON object: { "items": ["achievement 1", "achievement 2"] }`;
    } else if (type === "objective") {
      prompt = `Write a 2-line career objective for a resume. Role: ${role || "general"}. Context: ${context || "not provided"}. Return ONLY a valid JSON object: { "text": "your objective here" }`;
    } else if (type === "skills") {
      prompt = `Suggest ${count * 3} relevant technical/professional skills for role: ${role || "general"}. Context: ${context || "not provided"}. Return ONLY a valid JSON object: { "items": ["skill 1", "skill 2"] }`;
    } else {
      throw new Error("Unknown type");
    }
    return await callGeminiJson<AIHelperResult>(prompt);
  });

function buildImportCleanupPrompt(resumeJson: string): string {
  return `You are an expert resume parser and data-cleanup engine. I parsed a resume and extracted structured data below. Clean it up: remove duplicate skills, merge duplicate experience entries, normalize date formats (keep "Month YYYY – Month YYYY"), normalize company names (drop Inc./LLC suffixes when inconsistent), normalize degree names (B.Sc., M.Sc., Ph.D., M.B.A.), fix obvious typos in names, and keep the most complete version of any duplicated field. Return ONLY valid JSON matching this schema: { data: { name: string, title: string, email: string, phone: string, location: string, website: string, linkedin: string, summary: string, skills: string (comma separated), experiences: [{ id: number, role: string, company: string, detail: string }], education: [{ id: number, school: string, degree: string, dates: string, detail: string }], projects: [{ id: number, name: string, link: string, detail: string }], certifications: string[], languages: string[], awards: string[], publications: string[], volunteer: string[] }, issues: string[], suggestions: string[] }\n\nExtracted resume JSON:\n${resumeJson}`;
}

export const cleanupImportFn = createServerFn({ method: "POST" })
  .validator((d: { resumeJson: string }) => d)
  .handler(async ({ data }) => {
    const prompt = buildImportCleanupPrompt(data.resumeJson);
    return await callGeminiJson<ImportCleanupResult>(prompt);
  });

// Client-facing AI Provider implementation. Every method calls the secure
// server function first; if the RPC layer is unavailable it retries the raw
// Gemini call directly so the feature still works with a real API key.
export class GeminiProvider {
  async analyzeResume(resumeText: string): Promise<ResumeAnalysisResult> {
    try {
      const res = await analyzeResumeFn({ data: { resumeText } });
      logAiUsage("analyzeResume");
      return res;
    } catch (err) {
      console.warn("Server function analyzeResumeFn failed, retrying directly:", err);
      const prompt = `Analyze this resume and provide ATS scoring. Return ONLY valid JSON matching this schema: { score: number, atsScore: number, grammar: string[], formatting: string[], keywords: string[], missingSkills: string[], suggestions: string[] }\n\nResume:\n${resumeText}`;
      const res = await callGeminiJson<ResumeAnalysisResult>(prompt);
      logAiUsage("analyzeResume", { fallback: true });
      return res;
    }
  }

  async matchJob(resumeText: string, jobDescription: string): Promise<JobMatchResult> {
    try {
      const res = await matchJobFn({ data: { resumeText, jobDescription } });
      logAiUsage("matchJob");
      return res;
    } catch (err) {
      console.warn("Server function matchJobFn failed, retrying directly:", err);
      const prompt = `Compare this resume to the job description. Return ONLY valid JSON matching this schema: { matchPercentage: number, skillMatch: number, experienceMatch: number, educationMatch: number, missingKeywords: string[], missingSkills: string[], selectionProbability: "High" | "Medium" | "Low", recommendations: string[] }\n\nResume:\n${resumeText}\n\nJob Description:\n${jobDescription}`;
      const res = await callGeminiJson<JobMatchResult>(prompt);
      logAiUsage("matchJob", { fallback: true });
      return res;
    }
  }

  async generateCareerRoadmap(
    resumeText: string,
    targetRole: string,
  ): Promise<CareerRoadmapResult> {
    try {
      const res = await generateRoadmapFn({ data: { resumeText, targetRole } });
      logAiUsage("roadmap");
      return res;
    } catch (err) {
      console.warn("Server function generateRoadmapFn failed, retrying directly:", err);
      const prompt = `Create a learning roadmap for this candidate targeting the role of ${targetRole}. Return ONLY valid JSON matching this schema: { skillGaps: string[], weeklyPlan: [{ week: number, focus: string, tasks: string[] }], resources: [{ title: string, platform: string, url: string }] }\n\nResume:\n${resumeText}`;
      const res = await callGeminiJson<CareerRoadmapResult>(prompt);
      logAiUsage("roadmap", { fallback: true });
      return res;
    }
  }

  async getInterviewQuestions(
    resumeText: string,
    jobTitle: string,
  ): Promise<InterviewQuestionsResult> {
    try {
      return await generateInterviewQuestionsFn({ data: { resumeText, jobTitle } });
    } catch (err) {
      console.warn("Server function generateInterviewQuestionsFn failed, retrying directly:", err);
      const prompt = `Generate 5 Technical, 5 Behavioral, 3 Project-Based, 2 Scenario, and 3 Coding interview questions for a ${jobTitle} based on this resume. Return ONLY valid JSON matching: { "Technical": string[], "Behavioral": string[], "Project-Based": string[], "Scenario": string[], "Coding": string[] }\n\nResume:\n${resumeText}`;
      return await callGeminiJson<InterviewQuestionsResult>(prompt);
    }
  }

  async rewriteResume(sectionText: string): Promise<RewriteResult> {
    try {
      return await rewriteResumeFn({ data: { sectionText } });
    } catch (err) {
      console.warn("Server function rewriteResumeFn failed, retrying directly:", err);
      const prompt = `Rewrite this resume section to be highly professional, impactful, and ATS friendly. Quantify achievements where possible. Return ONLY valid JSON matching: { rewrittenText: string, improvements: string[] }\n\nSection:\n${sectionText}`;
      return await callGeminiJson<RewriteResult>(prompt);
    }
  }

  async analyzeSkillGap(skillsList: string): Promise<SkillGapResult> {
    try {
      return await analyzeSkillGapFn({ data: { skillsList } });
    } catch (err) {
      console.warn("Server function analyzeSkillGapFn failed, retrying directly:", err);
      const prompt = `Analyze these skills against current market demand in tech. Return ONLY valid JSON matching: { missing: [{ name: string, priority: "High"|"Medium"|"Low", progress: number }], radar: [{ skill: string, you: number, market: number }] }\n\nSkills:\n${skillsList}`;
      return await callGeminiJson<SkillGapResult>(prompt);
    }
  }

  async generateCoverLetter(
    resumeText: string,
    jobDescription: string,
    opts: CoverLetterOptions = {},
  ): Promise<CoverLetterResult> {
    try {
      return await generateCoverLetterFn({ data: { resumeText, jobDescription, ...opts } });
    } catch (err) {
      console.warn("Server function generateCoverLetterFn failed, retrying directly:", err);
      const prompt = buildCoverLetterPrompt(
        resumeText,
        jobDescription,
        opts.tone,
        opts.template,
        opts.companyName,
        opts.targetRole,
      );
      return await callGeminiJson<CoverLetterResult>(prompt);
    }
  }

  async predictSalary(resumeText: string, targetRole: string): Promise<SalaryPredictionResult> {
    try {
      return await predictSalaryFn({ data: { resumeText, targetRole } });
    } catch (err) {
      console.warn("Server function predictSalaryFn failed, retrying directly:", err);
      const prompt = `Predict the market salary for this candidate targeting ${targetRole}. Return ONLY valid JSON matching: { estimatedSalary: string, confidence: "High"|"Medium"|"Low", factors: string[] }\n\nResume:\n${resumeText}`;
      return await callGeminiJson<SalaryPredictionResult>(prompt);
    }
  }

  async compareCandidates(
    candidateA: any,
    candidateB: any,
    jobDescription?: string,
  ): Promise<CandidateComparisonResult> {
    try {
      return await compareCandidatesFn({ data: { candidateA, candidateB, jobDescription } });
    } catch (err) {
      console.warn("Server function compareCandidatesFn failed, retrying directly:", err);
      const prompt = `Compare these two candidates${jobDescription ? ` for this job:\n${jobDescription}` : ""}. Return ONLY valid JSON matching: { winner: string, reasoning: string, comparison: [{ category: string, candidateA: string, candidateB: string }] }\n\nCandidate A (Name: ${candidateA?.candidateName}):\n${JSON.stringify(candidateA)}\n\nCandidate B (Name: ${candidateB?.candidateName}):\n${JSON.stringify(candidateB)}`;
      return await callGeminiJson<CandidateComparisonResult>(prompt);
    }
  }

  async assist(prompt: string): Promise<string> {
    try {
      return await assistFn({ data: { prompt } });
    } catch (err) {
      console.warn("Server function assistFn failed, retrying directly:", err);
      const res = await callGeminiJson<{ response: string }>(
        `${prompt}\n\nReturn ONLY a JSON object with this exact schema: { "response": "your detailed text response here" }`,
      );
      return res.response;
    }
  }

  async aiHelper(
    type: string,
    context?: string,
    role?: string,
    count?: number,
  ): Promise<AIHelperResult> {
    try {
      return await aiHelperFn({ data: { type, context, role, count } });
    } catch (err) {
      console.warn("Server function aiHelperFn failed, retrying directly:", err);
      let prompt = "";
      const cnt = count || 3;
      if (type === "summary") {
        prompt = `Write a compelling 2-3 sentence professional summary for a resume. Role: ${role || "general"}. Context/background: ${context || "not provided"}. Use confident language, quantify where possible. Return ONLY a valid JSON object: { "text": "your summary here" }`;
      } else if (type === "bullets") {
        prompt = `Write ${cnt} STAR-format resume bullet points (each starting with a strong action verb, containing quantified impact). Role: ${role || "general"}. Context: ${context || "not provided"}. Return ONLY a valid JSON object: { "items": ["bullet 1", "bullet 2"] }`;
      } else if (type === "achievements") {
        prompt = `Write ${cnt} achievement-focused resume lines (metrics + business impact). Role: ${role || "general"}. Context: ${context || "not provided"}. Return ONLY a valid JSON object: { "items": ["achievement 1", "achievement 2"] }`;
      } else if (type === "objective") {
        prompt = `Write a 2-line career objective for a resume. Role: ${role || "general"}. Context: ${context || "not provided"}. Return ONLY a valid JSON object: { "text": "your objective here" }`;
      } else if (type === "skills") {
        prompt = `Suggest ${cnt * 3} relevant technical/professional skills for role: ${role || "general"}. Context: ${context || "not provided"}. Return ONLY a valid JSON object: { "items": ["skill 1", "skill 2"] }`;
      }
      return await callGeminiJson<AIHelperResult>(prompt);
    }
  }

  /** AI cleanup of parsed import data — returns null when AI is unavailable. */
  async cleanupImport(resumeJson: string): Promise<ImportCleanupResult | null> {
    try {
      const res = await cleanupImportFn({ data: { resumeJson } });
      if (!res.data || Object.keys(res.data).length === 0) return null;
      return res;
    } catch (err) {
      console.warn("Server function cleanupImportFn failed, retrying directly:", err);
      const res = await callGeminiJson<ImportCleanupResult>(buildImportCleanupPrompt(resumeJson));
      if (!res.data || Object.keys(res.data).length === 0) return null;
      return res;
    }
  }
}

export function getAIProvider(): GeminiProvider {
  return new GeminiProvider();
}

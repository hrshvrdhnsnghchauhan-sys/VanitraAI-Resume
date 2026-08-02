// ---------------------------------------------------------------------------
// Resume Import — pure text parsing engine
//
// Turns raw extracted text (PDF/DOCX/JSON/plain) into a ResumeData snapshot,
// marking uncertain fields, normalizing dates/companies/degrees, removing
// duplicates and flagging ATS issues. Zero DOM / zero Firebase dependencies so
// it is fully unit-testable and SSR-safe.
// ---------------------------------------------------------------------------

import type { EducationItem, ExperienceData, ProjectItem, ResumeData } from "./resume-templates";

export type ImportSource = "pdf" | "docx" | "json" | "text";

export interface UncertainField {
  /** ResumeData key this uncertainty refers to (or a human section id). */
  field: string;
  label: string;
  reason: string;
  confidence: "low" | "medium";
}

export interface ImportIssue {
  severity: "error" | "warning" | "info";
  message: string;
  section?: string;
}

export interface ImportStats {
  lines: number;
  words: number;
  pages?: number;
  source: ImportSource;
}

export interface ImportResult {
  data: ResumeData;
  uncertain: UncertainField[];
  issues: ImportIssue[];
  suggestions: string[];
  stats: ImportStats;
}

// ---------------------------------------------------------------------------
// Sanitization — strip control chars / null bytes / excessive whitespace
// ---------------------------------------------------------------------------

export function sanitizeText(raw: string): string {
  if (!raw) return "";
  // Strip null bytes + control chars by charCode (avoids literal control
  // characters inside a regex literal, which eslint no-control-regex bans).
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    const isControl =
      code === 0 ||
      (code >= 1 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127;
    if (!isControl) out += raw[i];
  }
  return out
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits a raw string into non-empty trimmed lines. */
export function toLines(text: string): string[] {
  return sanitizeText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Contact extraction
// ---------------------------------------------------------------------------

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const LINKEDIN_RE = /(?:linkedin\.com\/)(?:in\/)?([a-zA-Z0-9-]+)/i;
const GITHUB_RE = /(?:github\.com\/)([a-zA-Z0-9-]+)/i;
const WEBSITE_RE =
  /(?<![\w@.])((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+(?::\d+)?(?:\/[\w\-./?&=#%]*)?)(?![\w@])/g;
// Phone: international prefix + 7-15 digits with separators, or US format.
const PHONE_RE =
  /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/;

function looksLikeDateOrHeader(line: string): boolean {
  const n = line.toLowerCase();
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(n)) return true;
  if (/\b(19|20)\d{2}\b/.test(n)) return true;
  if (/(present|current|ongoing)/.test(n)) return true;
  if (
    /^(summary|experience|education|skills|projects?|certifications?|languages?|awards?|publications?|volunteer|profile|objective|contact)\b/i.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

export function extractContact(lines: string[], maxScan = 18): Partial<ResumeData> {
  const contact: Partial<ResumeData> = {};
  const head = lines.slice(0, maxScan).join("\n");

  const email = head.match(EMAIL_RE)?.[0];
  if (email) contact.email = email;

  const linkedin = head.match(LINKEDIN_RE)?.[0];
  if (linkedin)
    contact.linkedin = linkedin.startsWith("linkedin.com")
      ? linkedin
      : `linkedin.com/in/${linkedin}`;

  const github = head.match(GITHUB_RE)?.[0];
  if (github) contact.github = github.startsWith("github.com") ? github : `github.com/${github}`;

  // Website — ignore lines that are clearly email/linkedin/github/pure dates.
  const websiteCandidates: string[] = [];
  for (const line of lines.slice(0, maxScan)) {
    if (looksLikeDateOrHeader(line)) continue;
    const matches = line.match(WEBSITE_RE) || [];
    for (const m of matches) {
      const low = m.toLowerCase();
      if (
        /@/.test(m) ||
        /linkedin\.com|github\.com|twitter\.com|x\.com|facebook\.com/.test(low) ||
        /\d{4}/.test(m)
      ) {
        continue;
      }
      websiteCandidates.push(m);
    }
  }
  if (!contact.linkedin && !contact.website) {
    contact.website = websiteCandidates[0] ?? contact.github ?? "";
  } else if (!contact.website) {
    contact.website = websiteCandidates.find((w) => !w.includes("linkedin")) ?? "";
  }

  // Phone — must contain enough digits to be a real number.
  for (const line of lines.slice(0, maxScan)) {
    if (looksLikeDateOrHeader(line)) continue;
    const m = line.match(PHONE_RE)?.[0];
    if (m && m.replace(/\D/g, "").length >= 7) {
      contact.phone = m.trim();
      break;
    }
  }

  // Location — "City, ST" or "City, Country".
  for (const line of lines.slice(0, maxScan)) {
    const m = line.match(/^([A-Za-z][A-Za-z\s.'-]*),\s*([A-Z]{2}|[A-Za-z][A-Za-z\s.'-]{2,})$/);
    if (m && !m[1].toLowerCase().includes("linkedin") && m[0].length < 60) {
      contact.location = m[0].trim();
      break;
    }
  }

  return contact;
}

// ---------------------------------------------------------------------------
// Name & title heuristics
// ---------------------------------------------------------------------------

const TITLE_KEYWORDS =
  /\b(engineer|developer|designer|manager|analyst|scientist|consultant|architect|director|lead|specialist|coordinator|associate|officer|executive|strategist|researcher|instructor|administrator|operator|technician|accountant|attorney|therapist|nurse|physician|teacher|professor|principal|staff|founder|owner|head|vp|vice president|cto|ceo|cfo|coo|intern)\b/i;

function looksLikeName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 60) return false;
  if (/[•\-*·|]/u.test(trimmed[0])) return false;
  if (/@|linkedin|github|http/.test(trimmed.toLowerCase())) return false;
  if (looksLikeDateOrHeader(trimmed)) return false;
  if (TITLE_KEYWORDS.test(trimmed) && trimmed.split(/\s+/).length > 4) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  // At least two words should start with a capital (or be a common initial).
  let caps = 0;
  for (const w of words) {
    if (/^[A-Z]/.test(w) || /^[A-Z]\.$/.test(w)) caps++;
  }
  return caps >= Math.min(2, words.length);
}

export function guessName(lines: string[]): { name: string; uncertain: boolean } {
  for (const line of lines.slice(0, 8)) {
    if (looksLikeName(line)) return { name: line.trim(), uncertain: false };
  }
  // Fallback: first line that has 2+ words, no contact markers.
  for (const line of lines.slice(0, 8)) {
    if (
      line.trim() &&
      !/@|linkedin|github|http|\d{4}/.test(line) &&
      line.split(/\s+/).length >= 2 &&
      line.length < 60
    ) {
      return { name: line.trim(), uncertain: true };
    }
  }
  return { name: "", uncertain: true };
}

export function guessTitle(lines: string[]): string {
  // Prefer a line with a known title keyword near the top (not a header).
  for (const line of lines.slice(0, 12)) {
    const n = line.trim();
    if (looksLikeDateOrHeader(n)) continue;
    if (/[•\-*·]/u.test(n[0] || "")) continue;
    if (/^[A-Z][A-Z\s]{3,}$/.test(n)) continue; // all-caps header
    if (TITLE_KEYWORDS.test(n) && n.split(/\s+/).length <= 6) return n;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Section detection
// ---------------------------------------------------------------------------

export type ParsedSectionId =
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "projects"
  | "certifications"
  | "languages"
  | "awards"
  | "publications"
  | "volunteer";

const SECTION_RULES: { id: ParsedSectionId; patterns: string[] }[] = [
  {
    id: "summary",
    patterns: [
      "summary",
      "professional summary",
      "profile",
      "about me",
      "objective",
      "career objective",
      "personal statement",
      "summary of qualifications",
    ],
  },
  {
    id: "experience",
    patterns: [
      "experience",
      "work experience",
      "professional experience",
      "employment history",
      "work history",
      "career history",
      "relevant experience",
      "professional history",
    ],
  },
  {
    id: "skills",
    patterns: [
      "skills",
      "technical skills",
      "core competencies",
      "competencies",
      "technologies",
      "tech stack",
      "areas of expertise",
      "skills & expertise",
      "tools & technologies",
    ],
  },
  {
    id: "education",
    patterns: [
      "education",
      "academic background",
      "academic history",
      "qualifications",
      "education & training",
    ],
  },
  {
    id: "projects",
    patterns: [
      "projects",
      "personal projects",
      "key projects",
      "project experience",
      "selected projects",
      "open source",
    ],
  },
  {
    id: "certifications",
    patterns: [
      "certifications",
      "certificates",
      "licenses",
      "licenses & certifications",
      "credentials",
      "certification",
    ],
  },
  { id: "languages", patterns: ["languages", "language"] },
  {
    id: "awards",
    patterns: ["awards", "honors", "honours", "achievements", "awards & honors", "recognition"],
  },
  {
    id: "publications",
    patterns: [
      "publications",
      "papers",
      "research",
      "research & publications",
      "selected publications",
    ],
  },
  {
    id: "volunteer",
    patterns: ["volunteer", "volunteering", "community", "voluntary work", "volunteer experience"],
  },
];

function normalizeHeader(line: string): string {
  return line
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[:\u2022•*]/g, "")
    .replace(/[^a-z0-9& ]/g, "")
    .trim();
}

export function detectSection(line: string): ParsedSectionId | null {
  const norm = normalizeHeader(line);
  if (!norm || norm.length > 40) return null;
  for (const rule of SECTION_RULES) {
    if (rule.patterns.includes(norm)) return rule.id;
    // Accept plural/all-caps variants like "SKILLS" or "TECHNICAL SKILLS".
    if (rule.patterns.some((p) => norm === p || norm === `${p}s` || norm === `${p} & expertise`)) {
      return rule.id;
    }
  }
  return null;
}

/** Splits lines into ordered sections using detected headers. */
export function splitIntoSections(lines: string[]): { id: ParsedSectionId; content: string[] }[] {
  const sections: { id: ParsedSectionId; content: string[] }[] = [];
  let current: { id: ParsedSectionId; content: string[] } | null = null;

  for (const line of lines) {
    const id = detectSection(line);
    if (id) {
      // Avoid duplicate consecutive sections of the same type.
      if (current && current.id === id) continue;
      current = { id, content: [] };
      sections.push(current);
    } else if (current) {
      current.content.push(line);
    }
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

export function parseSkills(text: string): string {
  const lines = toLines(text);
  const joined = lines.join(", ");
  const parts = joined
    .split(/[,|;•·–—/\n]+/u)
    .map((s) =>
      s
        .replace(/^[\s•*\-·]+/, "")
        .replace(/[\s•*\-·]+$/, "")
        .trim(),
    )
    .filter(Boolean);
  const unique = Array.from(new Set(parts.map((s) => s.toLowerCase()))).map(
    (low) => parts.find((p) => p.toLowerCase() === low) as string,
  );
  return unique.join(", ");
}

function isBullet(line: string): boolean {
  return /^[•*\-·▪–—]\s?/u.test(line) || /^\d{1,2}[.)]\s/.test(line);
}

const DATE_RANGE_RE =
  /(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*)?(?:\d{1,2}[,/]\s*)?(19|20)\d{2}\s*[-–—]\s*(?:(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*)?(?:present|current|ongoing|(19|20)\d{2}))/i;

export function extractDateRange(line: string): string | null {
  const m = line.match(DATE_RANGE_RE);
  if (!m) return null;
  return m[0].replace(/[–—]/g, "–").trim();
}

const DEGREE_RE =
  /\b(b\.?\s?[as]\.?|m\.?\s?[as]\.?|ph\.?\s?d\.?|b\.?\s?eng\.?|m\.?\s?eng\.?|m\.?\s?b\.?\s?a\.?|b\.?\s?com\.?|m\.?\s?com\.?|b\.?\s?tech\.?|m\.?\s?tech\.?|bachelor|master|doctorate|associate|diploma|m\.?\s?sc\.?|m\.?\s?a\.?|b\.?\s?a\.?)\b/i;

function stripBullet(line: string): string {
  return line.replace(/^[•*\-·▪–—]\s?/u, "").trim();
}

export function parseExperienceSection(content: string[]): ExperienceData[] {
  const experiences: ExperienceData[] = [];
  let block: string[] = [];

  const flush = () => {
    if (block.length === 0) return;
    const nonBullets = block.filter((l) => !isBullet(l));
    const bullets = block.filter((l) => isBullet(l));
    let role = "";
    let company = "";
    let dates = "";

    // Role: first non-bullet line (usually the job title).
    if (nonBullets.length > 0) {
      const first = nonBullets[0];
      // Try "Role at Company (dates)" combined form.
      const atMatch = first.match(/^(.+?)\s+(?:at|@|,\s*)\s+(.+?)(?:\s*\(([^)]*)\)\s*)?$/);
      if (atMatch && !/\d{4}/.test(atMatch[1])) {
        role = atMatch[1].trim();
        company = atMatch[2].trim();
        dates = atMatch[3]?.trim() ?? extractDateRange(first) ?? "";
      } else {
        role = first.trim();
      }
    }
    // Company: next non-bullet line. Dates are commonly embedded in the SAME
    // line ("Acme Corp · 2021–Present") — strip the matched range from the line
    // and keep the company name instead of discarding the line entirely.
    const companyCandidates = nonBullets.slice(role ? 1 : 0);
    if (!company && companyCandidates.length > 0) {
      for (const line of companyCandidates) {
        const range = extractDateRange(line);
        const stripped = (range ? line.replace(range, "") : line)
          .replace(/[·|,]\s*[-–—]?\s*$/u, "")
          .trim();
        if (stripped) {
          company = stripped;
          break;
        }
      }
    }

    const allText = block.join("\n");
    if (!dates) {
      const range = extractDateRange(allText);
      if (range) dates = range;
    }
    // Date-only leftover lines are consumed here (e.g. "2021 - Present" alone).
    const leftoverDates = block
      .map((l) => extractDateRange(l))
      .filter((d): d is string => Boolean(d));
    if (!dates && leftoverDates.length > 0) dates = leftoverDates[0];

    const detail = bullets.map(stripBullet).join("\n");

    if (role || company || detail) {
      experiences.push({
        id: experiences.length + 1,
        role: role || "",
        company: [company, dates].filter(Boolean).join(" · "),
        detail,
      });
    }
    block = [];
  };

  for (const line of content) {
    if (line.trim() === "") {
      flush();
      continue;
    }
    block.push(line.trim());
  }
  flush();

  // Merge duplicate experiences (same role + company).
  const merged: ExperienceData[] = [];
  for (const exp of experiences) {
    const key = `${exp.role.trim().toLowerCase()}||${exp.company.split("·")[0]?.trim().toLowerCase() || ""}`;
    const existing = merged.find((m) => {
      const mk = `${m.role.trim().toLowerCase()}||${m.company.split("·")[0]?.trim().toLowerCase() || ""}`;
      return mk === key;
    });
    if (existing) {
      existing.detail = [existing.detail, exp.detail].filter(Boolean).join("\n");
    } else {
      merged.push(exp);
    }
  }
  return merged.map((m, i) => ({ ...m, id: i + 1 }));
}

export function parseEducationSection(content: string[]): EducationItem[] {
  const education: EducationItem[] = [];
  let block: string[] = [];

  const flush = () => {
    if (block.length === 0) return;
    const lines = block.filter((l) => !isBullet(l));
    let school = "";
    let degree = "";
    let dates = "";

    // Degree line detection.
    const degreeLine = lines.find((l) => DEGREE_RE.test(l));
    if (degreeLine) {
      // Could be "B.S. Computer Science, Stanford University" or
      // "Stanford University — B.S. Computer Science".
      const split = degreeLine.split(/[,–—|]\s*/);
      if (
        split.length >= 2 &&
        split.some((s) => DEGREE_RE.test(s)) &&
        split.some((s) => !DEGREE_RE.test(s) && !/\d{4}/.test(s))
      ) {
        const degreePart = split.find((s) => DEGREE_RE.test(s)) ?? "";
        const schoolPart = split.find(
          (s) => !DEGREE_RE.test(s) && !/\d{4}/.test(s) && s.trim().length > 2,
        );
        degree = degreePart.trim();
        school = schoolPart?.trim() ?? "";
      } else {
        degree = degreeLine.trim();
      }
    }
    // Dates.
    const allText = block.join("\n");
    const range = extractDateRange(allText);
    if (range) dates = range;
    else {
      const bareYear = allText.match(/\b(19|20)\d{2}\b/);
      if (bareYear) dates = bareYear[0];
    }
    // School from other lines.
    if (!school) {
      const schoolLine = lines.find(
        (l) => !DEGREE_RE.test(l) && !extractDateRange(l) && !/^(19|20)\d{2}$/.test(l.trim()),
      );
      school = schoolLine?.trim() ?? "";
    }

    if (school || degree || dates) {
      education.push({
        id: education.length + 1,
        school,
        degree,
        dates,
        detail: "",
      });
    }
    block = [];
  };

  for (const line of content) {
    if (line.trim() === "") {
      flush();
      continue;
    }
    block.push(line.trim());
  }
  flush();
  return education.map((e, i) => ({ ...e, id: i + 1 }));
}

export function parseProjectsSection(content: string[]): ProjectItem[] {
  const projects: ProjectItem[] = [];
  let block: string[] = [];

  const flush = () => {
    if (block.length === 0) return;
    const nonBullets = block.filter((l) => !isBullet(l));
    const bullets = block.filter((l) => isBullet(l));
    const name = nonBullets[0]?.trim() ?? "";
    let link = "";
    const linkMatch = block.join(" ").match(/(?:github\.com|https?:\/\/)[^\s|,]+/i);
    if (linkMatch) link = linkMatch[0];
    const detail =
      bullets.map(stripBullet).join("\n") ||
      (nonBullets.length > 1 ? nonBullets.slice(1).join(" ") : "");
    if (name || detail || link) {
      projects.push({ id: projects.length + 1, name, link, detail });
    }
    block = [];
  };

  for (const line of content) {
    if (line.trim() === "") {
      flush();
      continue;
    }
    block.push(line.trim());
  }
  flush();
  return projects.map((p, i) => ({ ...p, id: i + 1 }));
}

export function parseListSection(content: string[]): string[] {
  const items = toLines(content.join("\n")).map(stripBullet).filter(Boolean);
  const unique = Array.from(new Set(items.map((i) => i.toLowerCase()))).map(
    (low) => items.find((i) => i.toLowerCase() === low) as string,
  );
  return unique;
}

// ---------------------------------------------------------------------------
// ATS issue detection & suggestions
// ---------------------------------------------------------------------------

function quantifyCheck(detail: string): boolean {
  return /\d+%|\d{3,}|x\s?\d|\$[\d,]+|\d+(\.\d+)?\s?(x|times|fold)/.test(detail);
}

export function detectAtsIssues(data: ResumeData): ImportIssue[] {
  const issues: ImportIssue[] = [];
  if (!data.email)
    issues.push({ severity: "warning", message: "No email address detected.", section: "Contact" });
  if (!data.phone)
    issues.push({ severity: "warning", message: "No phone number detected.", section: "Contact" });
  if (!data.summary.trim())
    issues.push({
      severity: "warning",
      message: "No professional summary found.",
      section: "Summary",
    });
  if (data.experiences.length === 0) {
    issues.push({
      severity: "warning",
      message: "No work experience detected.",
      section: "Experience",
    });
  } else {
    const quantified = data.experiences.filter((e) => quantifyCheck(e.detail));
    if (quantified.length < Math.max(1, Math.ceil(data.experiences.length / 2))) {
      issues.push({
        severity: "info",
        message:
          "Few bullets are quantified with metrics. Add % / $ / numbers for higher ATS impact.",
        section: "Experience",
      });
    }
  }
  if (!data.skills.trim())
    issues.push({ severity: "warning", message: "No skills section found.", section: "Skills" });
  if (!data.linkedin && !data.website) {
    issues.push({
      severity: "info",
      message: "Add a LinkedIn or portfolio link — recruiters expect it.",
      section: "Contact",
    });
  }
  return issues;
}

export function detectMissing(data: ResumeData): string[] {
  const missing: string[] = [];
  if (!data.email) missing.push("Email");
  if (!data.phone) missing.push("Phone");
  if (!data.location) missing.push("Location");
  if (!data.linkedin) missing.push("LinkedIn");
  if (!data.website) missing.push("Website/Portfolio");
  if (!data.summary.trim()) missing.push("Professional Summary");
  if (data.experiences.length === 0) missing.push("Work Experience");
  if (!data.skills.trim()) missing.push("Skills");
  if (data.education.length === 0) missing.push("Education");
  return missing;
}

// ---------------------------------------------------------------------------
// JSON backup — map a saved JSON backup directly into ResumeData (no text
// re-parsing). Tolerant of the builder's legacy subset (name/title/email/…).
// ---------------------------------------------------------------------------

export function coerceJsonResume(raw: string): ResumeData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const d = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
  const num = (v: unknown, i: number) => (typeof v === "number" ? v : i + 1);

  const experiences: ExperienceData[] = Array.isArray(d.experiences)
    ? (d.experiences as Record<string, unknown>[]).map((e, i) => ({
        id: num(e.id, i),
        role: str(e.role),
        company: str(e.company),
        detail: str(e.detail),
      }))
    : [];
  const education: EducationItem[] = Array.isArray(d.education)
    ? (d.education as Record<string, unknown>[]).map((e, i) => ({
        id: num(e.id, i),
        school: str(e.school),
        degree: str(e.degree),
        dates: str(e.dates),
        detail: str(e.detail),
      }))
    : [];
  const projects: ProjectItem[] = Array.isArray(d.projects)
    ? (d.projects as Record<string, unknown>[]).map((p, i) => ({
        id: num(p.id, i),
        name: str(p.name),
        link: str(p.link),
        detail: str(p.detail),
      }))
    : [];

  const data: ResumeData = {
    name: str(d.name) || "Your Name",
    title: str(d.title),
    email: str(d.email),
    phone: str(d.phone),
    location: str(d.location),
    website: str(d.website),
    linkedin: str(d.linkedin),
    github: str(d.github) || undefined,
    summary: str(d.summary),
    skills: str(d.skills),
    experiences,
    education,
    projects,
    certifications: strArr(d.certifications),
    languages: strArr(d.languages),
    awards: strArr(d.awards).length ? strArr(d.awards) : undefined,
    publications: strArr(d.publications).length ? strArr(d.publications) : undefined,
    volunteer: strArr(d.volunteer).length ? strArr(d.volunteer) : undefined,
    templateId: str(d.templateId) || undefined,
  };

  if (!data.name && !data.email && experiences.length === 0 && !data.summary) return null;
  return data;
}

/** Shared helper: run the full parse pipeline for non-JSON text sources. */
export function parseImportedText(
  text: string,
  source: ImportSource,
  pages?: number,
): ImportResult {
  return parseResumeText(text, source, pages);
}

// ---------------------------------------------------------------------------
// Main entry — parse raw text into a ResumeData snapshot
// ---------------------------------------------------------------------------

export function parseResumeText(
  rawText: string,
  source: ImportSource,
  pages?: number,
): ImportResult {
  const text = sanitizeText(rawText);
  const lines = toLines(text);
  const issues: ImportIssue[] = [];
  const uncertain: UncertainField[] = [];

  const nameGuess = guessName(lines);
  const title = guessTitle(lines);
  const contact = extractContact(lines);

  const sections = splitIntoSections(lines);

  // If no standard headers were detected, treat the whole body as one blob
  // and still try experience/education detection on it.
  const body =
    sections.length > 0 ? sections : [{ id: "summary" as ParsedSectionId, content: lines }];

  const getSection = (id: ParsedSectionId) => body.find((s) => s.id === id)?.content ?? [];

  const summary = (getSection("summary").join(" ") || "").trim();
  const experiences = parseExperienceSection(getSection("experience"));
  const education = parseEducationSection(getSection("education"));
  const projects = parseProjectsSection(getSection("projects"));
  const skills = parseSkills(getSection("skills").join("\n"));
  const certifications = parseListSection(getSection("certifications"));
  const languages = parseListSection(getSection("languages"));
  const awards = parseListSection(getSection("awards"));
  const publications = parseListSection(getSection("publications"));
  const volunteer = parseListSection(getSection("volunteer"));

  // Normalize degree names lightly (e.g. "BSc" -> "B.Sc.") — keep original
  // unless clearly short-form.
  const normalizeDegrees = (items: EducationItem[]) =>
    items.map((e) => {
      let degree = e.degree.trim();
      if (/^bsc$/i.test(degree)) degree = "B.Sc.";
      if (/^msc$/i.test(degree)) degree = "M.Sc.";
      if (/^ba$/i.test(degree)) degree = "B.A.";
      if (/^ma$/i.test(degree)) degree = "M.A.";
      if (/^bs$/i.test(degree)) degree = "B.S.";
      if (/^ms$/i.test(degree)) degree = "M.S.";
      if (/^phd$/i.test(degree)) degree = "Ph.D.";
      if (/^mba$/i.test(degree)) degree = "M.B.A.";
      return { ...e, degree };
    });
  const normalizedEducation = normalizeDegrees(education);

  const data: ResumeData = {
    name: nameGuess.name || "Your Name",
    title,
    email: contact.email || "",
    phone: contact.phone || "",
    location: contact.location || "",
    website: contact.website || "",
    linkedin: contact.linkedin || "",
    summary,
    skills,
    experiences,
    education: normalizedEducation,
    projects,
    certifications,
    languages,
    awards,
    publications,
    volunteer,
  };

  // --- Uncertainty marking -------------------------------------------------
  if (nameGuess.uncertain) {
    uncertain.push({
      field: "name",
      label: "Full name",
      reason: "Name could not be confidently detected — please verify.",
      confidence: "low",
    });
  }
  if (!contact.email) {
    uncertain.push({
      field: "email",
      label: "Email",
      reason: "No email address found in the document.",
      confidence: "low",
    });
  }
  if (!contact.phone) {
    uncertain.push({
      field: "phone",
      label: "Phone",
      reason: "No phone number found in the document.",
      confidence: "low",
    });
  }
  if (title && TITLE_KEYWORDS.test(title)) {
    // Title matched a keyword — mark medium confidence so the user can confirm.
    uncertain.push({
      field: "title",
      label: "Headline",
      reason: "Detected from keywords — please confirm it reads well.",
      confidence: "medium",
    });
  }
  if (sections.length === 0) {
    uncertain.push({
      field: "sections",
      label: "Sections",
      reason: "No standard section headers were detected — parsed content may be incomplete.",
      confidence: "medium",
    });
    issues.push({
      severity: "warning",
      message:
        "No standard resume section headers were found. The layout may be image-based or unusual.",
    });
  }

  // --- ATS issues & suggestions -------------------------------------------
  issues.push(...detectAtsIssues(data));
  const suggestions = detectMissing(data).map((m) => `Add ${m} to complete your resume.`);

  const stats: ImportStats = {
    lines: lines.length,
    words: text.split(/\s+/).filter(Boolean).length,
    pages,
    source,
  };

  return { data, uncertain, issues, suggestions, stats };
}

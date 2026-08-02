// ---------------------------------------------------------------------------
// Resume Templates — data-driven registry
//
// 32 ATS-friendly templates across 15 categories, built from 7 layout
// archetypes. Every template is pure data: the renderer (template-resume.tsx)
// turns a TemplateConfig + ResumeData into a printable sheet, and the DOCX
// exporter (resume-export.ts) mirrors the same config. This keeps the bundle
// tiny (no per-template components) and makes "lazy-load templates" trivial.
// ---------------------------------------------------------------------------

export type SectionId =
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "projects"
  | "certifications"
  | "languages"
  | "links";

export type HeaderLayout = "left" | "center" | "split";
export type PageSize = "a4" | "letter";
export type LayoutId =
  "classic" | "modern" | "executive" | "creative" | "minimal" | "timeline" | "sidebar";

export type CategoryId =
  | "modern"
  | "minimal"
  | "executive"
  | "creative"
  | "professional"
  | "fresher"
  | "software"
  | "product"
  | "data"
  | "designer"
  | "marketing"
  | "finance"
  | "healthcare"
  | "academic"
  | "international";

export interface ExperienceData {
  id: number;
  role: string;
  company: string;
  detail: string;
}

export interface EducationItem {
  id: number;
  school: string;
  degree: string;
  dates: string;
  detail: string;
}

export interface ProjectItem {
  id: number;
  name: string;
  link: string;
  detail: string;
}

/** Everything the template engine can render. The existing builder fields are
 *  a strict subset (name/title/email/phone/summary/skills/experiences). */
export interface ResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  summary: string;
  skills: string;
  experiences: ExperienceData[];
  education: EducationItem[];
  projects: ProjectItem[];
  certifications: string[];
  languages: string[];
  /** Imported-resume extras (optional — additive, templates ignore them). */
  awards?: string[];
  publications?: string[];
  volunteer?: string[];
  github?: string;
  /** Which template (if any) was applied when this snapshot was taken. */
  templateId?: string;
}

export interface ResumeFont {
  id: string;
  label: string;
  stack: string;
  docx: string;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  layout: LayoutId;
  font: string;
  accent: string;
  header: HeaderLayout;
  icons: boolean;
  sections: SectionId[];
  defaultFontSize: number;
  defaultLineHeight: number;
  defaultMargin: number;
}

export interface TemplateConfig {
  templateId: string;
  font: string;
  fontSize: number;
  lineHeight: number;
  margin: number;
  accent: string;
  header: HeaderLayout;
  icons: boolean;
  sections: SectionId[];
  pageSize: PageSize;
}

// ---------------------------------------------------------------------------
// ATS-safe fonts (system fonts only — no webfont network cost, instant render)
// ---------------------------------------------------------------------------

export const RESUME_FONTS: ResumeFont[] = [
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif", docx: "Arial" },
  { id: "helvetica", label: "Helvetica", stack: "Helvetica, Arial, sans-serif", docx: "Helvetica" },
  {
    id: "calibri",
    label: "Calibri",
    stack: "Calibri, 'Segoe UI', Tahoma, sans-serif",
    docx: "Calibri",
  },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif", docx: "Verdana" },
  { id: "tahoma", label: "Tahoma", stack: "Tahoma, Geneva, sans-serif", docx: "Tahoma" },
  {
    id: "trebuchet",
    label: "Trebuchet MS",
    stack: "'Trebuchet MS', Helvetica, sans-serif",
    docx: "Trebuchet MS",
  },
  { id: "georgia", label: "Georgia", stack: "Georgia, 'Times New Roman', serif", docx: "Georgia" },
  {
    id: "times",
    label: "Times New Roman",
    stack: "'Times New Roman', Times, serif",
    docx: "Times New Roman",
  },
  {
    id: "garamond",
    label: "Garamond",
    stack: "Garamond, 'EB Garamond', Georgia, serif",
    docx: "Garamond",
  },
  { id: "cambria", label: "Cambria", stack: "Cambria, Georgia, serif", docx: "Cambria" },
  {
    id: "palatino",
    label: "Palatino",
    stack: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    docx: "Palatino Linotype",
  },
  {
    id: "courier",
    label: "Courier New",
    stack: "'Courier New', Courier, monospace",
    docx: "Courier New",
  },
];

export const RESUME_ACCENTS = [
  { id: "slate", label: "Slate", value: "#334155" },
  { id: "blue", label: "Blue", value: "#2563EB" },
  { id: "indigo", label: "Indigo", value: "#4F46E5" },
  { id: "teal", label: "Teal", value: "#0D9488" },
  { id: "emerald", label: "Emerald", value: "#059669" },
  { id: "violet", label: "Violet", value: "#7C3AED" },
  { id: "cyan", label: "Cyan", value: "#0891B2" },
  { id: "rose", label: "Rose", value: "#E11D48" },
  { id: "amber", label: "Amber", value: "#D97706" },
  { id: "ink", label: "Ink", value: "#111827" },
];

export const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: "summary", label: "Summary", hint: "Professional profile" },
  { id: "experience", label: "Experience", hint: "Work history" },
  { id: "skills", label: "Skills", hint: "Key competencies" },
  { id: "education", label: "Education", hint: "Degrees & courses" },
  { id: "projects", label: "Projects", hint: "Notable work" },
  { id: "certifications", label: "Certifications", hint: "Credentials" },
  { id: "languages", label: "Languages", hint: "Spoken languages" },
  { id: "links", label: "Links", hint: "Website & LinkedIn" },
];

export const CATEGORIES: { id: CategoryId; label: string; desc: string }[] = [
  { id: "modern", label: "Modern", desc: "Clean, current & tech-forward" },
  { id: "minimal", label: "Minimal", desc: "Whitespace-first & understated" },
  { id: "executive", label: "Executive", desc: "Senior leadership presence" },
  { id: "creative", label: "Creative", desc: "Bold, expressive layouts" },
  { id: "professional", label: "Professional", desc: "Timeless corporate classic" },
  { id: "fresher", label: "Fresher", desc: "Education-first for grads" },
  { id: "software", label: "Software Engineer", desc: "Built for engineers" },
  { id: "product", label: "Product Manager", desc: "Impact & strategy focus" },
  { id: "data", label: "Data Scientist", desc: "Analytical & evidence-led" },
  { id: "designer", label: "Designer", desc: "Visual & portfolio-minded" },
  { id: "marketing", label: "Marketing", desc: "Growth & brand stories" },
  { id: "finance", label: "Finance", desc: "Conservative & precise" },
  { id: "healthcare", label: "Healthcare", desc: "Trustworthy & caring" },
  { id: "academic", label: "Academic", desc: "Research & publication" },
  { id: "international", label: "International", desc: "Global CV conventions" },
];

const ALL_SECTIONS: SectionId[] = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
  "certifications",
  "languages",
  "links",
];

// ---------------------------------------------------------------------------
// 32 templates — 7 layout archetypes × variations, tuned per category
// ---------------------------------------------------------------------------

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  // Modern (3)
  {
    id: "nova",
    name: "Nova",
    category: "modern",
    description: "Bold accent bar, crisp sans-serif sections.",
    layout: "modern",
    font: "arial",
    accent: "#4F46E5",
    header: "split",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 52,
  },
  {
    id: "pulse",
    name: "Pulse",
    category: "modern",
    description: "Two-tone header with clean typographic hierarchy.",
    layout: "modern",
    font: "calibri",
    accent: "#0D9488",
    header: "left",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 52,
  },
  {
    id: "vertex",
    name: "Vertex",
    category: "modern",
    description: "Split header, ruled sections, generous air.",
    layout: "modern",
    font: "helvetica",
    accent: "#2563EB",
    header: "split",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.55,
    defaultMargin: 56,
  },

  // Minimal (2)
  {
    id: "whisper",
    name: "Whisper",
    category: "minimal",
    description: "Featherweight rules and quiet elegance.",
    layout: "minimal",
    font: "georgia",
    accent: "#334155",
    header: "left",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.6,
    defaultMargin: 64,
  },
  {
    id: "bare",
    name: "Bare",
    category: "minimal",
    description: "Nothing but content — no rules, no clutter.",
    layout: "minimal",
    font: "arial",
    accent: "#111827",
    header: "left",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.6,
    defaultMargin: 64,
  },

  // Executive (2)
  {
    id: "boardroom",
    name: "Boardroom",
    category: "executive",
    description: "Centered masthead with double-rule framing.",
    layout: "executive",
    font: "times",
    accent: "#1e293b",
    header: "center",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11.5,
    defaultLineHeight: 1.55,
    defaultMargin: 60,
  },
  {
    id: "meridian",
    name: "Meridian",
    category: "executive",
    description: "Serif-led, letter-spaced, quietly commanding.",
    layout: "executive",
    font: "garamond",
    accent: "#334155",
    header: "left",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11.5,
    defaultLineHeight: 1.55,
    defaultMargin: 60,
  },

  // Creative (2)
  {
    id: "studio",
    name: "Studio",
    category: "creative",
    description: "Ink sidebar with icon-driven contact block.",
    layout: "sidebar",
    font: "trebuchet",
    accent: "#111827",
    header: "left",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 48,
  },
  {
    id: "canvas",
    name: "Canvas",
    category: "creative",
    description: "Color field header with rounded skill chips.",
    layout: "creative",
    font: "arial",
    accent: "#E11D48",
    header: "split",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 48,
  },

  // Professional (3)
  {
    id: "apex",
    name: "Apex",
    category: "professional",
    description: "The dependable classic recruiters expect.",
    layout: "classic",
    font: "arial",
    accent: "#334155",
    header: "center",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 56,
  },
  {
    id: "clarity",
    name: "Clarity",
    category: "professional",
    description: "Modern classic with ruled section headers.",
    layout: "classic",
    font: "calibri",
    accent: "#2563EB",
    header: "left",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 56,
  },
  {
    id: "sterling",
    name: "Sterling",
    category: "professional",
    description: "Split header, all-caps labels, timeless serif.",
    layout: "classic",
    font: "georgia",
    accent: "#0D9488",
    header: "split",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 56,
  },

  // Fresher (2)
  {
    id: "launchpad",
    name: "Launchpad",
    category: "fresher",
    description: "Education-first with skills up top.",
    layout: "minimal",
    font: "calibri",
    accent: "#4F46E5",
    header: "left",
    icons: false,
    sections: ["summary", "education", "skills", "experience", "projects", "languages"],
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 56,
  },
  {
    id: "firststep",
    name: "First Step",
    category: "fresher",
    description: "Friendly accent, coursework & internships.",
    layout: "classic",
    font: "verdana",
    accent: "#0D9488",
    header: "center",
    icons: false,
    sections: ["summary", "education", "skills", "experience", "projects", "certifications"],
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 56,
  },

  // Software Engineer (2)
  {
    id: "devstack",
    name: "DevStack",
    category: "software",
    description: "Timeline experience, stack chips, results bullets.",
    layout: "timeline",
    font: "helvetica",
    accent: "#2563EB",
    header: "left",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 48,
  },
  {
    id: "code",
    name: "Code",
    category: "software",
    description: "Monospace accents for a technical feel.",
    layout: "modern",
    font: "courier",
    accent: "#0D9488",
    header: "split",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 10.5,
    defaultLineHeight: 1.5,
    defaultMargin: 48,
  },

  // Product Manager (2)
  {
    id: "pivot",
    name: "Pivot",
    category: "product",
    description: "Impact-first bullets with metric emphasis.",
    layout: "modern",
    font: "arial",
    accent: "#7C3AED",
    header: "split",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 52,
  },
  {
    id: "roadmap",
    name: "Roadmap",
    category: "product",
    description: "Timeline structure mirroring product lifecycles.",
    layout: "timeline",
    font: "calibri",
    accent: "#4F46E5",
    header: "left",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 52,
  },

  // Data Scientist (2)
  {
    id: "insight",
    name: "Insight",
    category: "data",
    description: "Evidence-led with clean statistical framing.",
    layout: "classic",
    font: "helvetica",
    accent: "#0891B2",
    header: "left",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 56,
  },
  {
    id: "model",
    name: "Model",
    category: "data",
    description: "Modern split header, skill chips, quant bullets.",
    layout: "modern",
    font: "calibri",
    accent: "#0D9488",
    header: "split",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 52,
  },

  // Designer (2)
  {
    id: "palette",
    name: "Palette",
    category: "designer",
    description: "Sidebar portfolio layout with icon contact.",
    layout: "sidebar",
    font: "helvetica",
    accent: "#7C3AED",
    header: "left",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 48,
  },
  {
    id: "grid",
    name: "Grid",
    category: "designer",
    description: "Creative ruled sections with bold accents.",
    layout: "creative",
    font: "trebuchet",
    accent: "#E11D48",
    header: "split",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 48,
  },

  // Marketing (2)
  {
    id: "growth",
    name: "Growth",
    category: "marketing",
    description: "Campaign-style timeline with brand color.",
    layout: "timeline",
    font: "arial",
    accent: "#D97706",
    header: "left",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 48,
  },
  {
    id: "brand",
    name: "Brand",
    category: "marketing",
    description: "Story-first summary, refined serif body.",
    layout: "classic",
    font: "georgia",
    accent: "#E11D48",
    header: "center",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.55,
    defaultMargin: 56,
  },

  // Finance (2)
  {
    id: "ledger",
    name: "Ledger",
    category: "finance",
    description: "Conservative ruled layout, serif numerals.",
    layout: "classic",
    font: "times",
    accent: "#334155",
    header: "center",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 60,
  },
  {
    id: "capital",
    name: "Capital",
    category: "finance",
    description: "Executive poise for banking & advisory.",
    layout: "executive",
    font: "garamond",
    accent: "#1e293b",
    header: "left",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11.5,
    defaultLineHeight: 1.55,
    defaultMargin: 60,
  },

  // Healthcare (2)
  {
    id: "care",
    name: "Care",
    category: "healthcare",
    description: "Warm, approachable, certs front-and-center.",
    layout: "classic",
    font: "verdana",
    accent: "#059669",
    header: "left",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 56,
  },
  {
    id: "clinical",
    name: "Clinical",
    category: "healthcare",
    description: "Precise minimal layout, credentials first.",
    layout: "minimal",
    font: "calibri",
    accent: "#0891B2",
    header: "left",
    icons: false,
    sections: ["summary", "certifications", "experience", "education", "skills", "languages"],
    defaultFontSize: 11,
    defaultLineHeight: 1.55,
    defaultMargin: 60,
  },

  // Academic (2)
  {
    id: "scholar",
    name: "Scholar",
    category: "academic",
    description: "Publications & research, citation-friendly.",
    layout: "classic",
    font: "garamond",
    accent: "#334155",
    header: "center",
    icons: false,
    sections: [
      "summary",
      "education",
      "projects",
      "experience",
      "certifications",
      "languages",
      "links",
    ],
    defaultFontSize: 11.5,
    defaultLineHeight: 1.55,
    defaultMargin: 60,
  },
  {
    id: "research",
    name: "Research",
    category: "academic",
    description: "Minimal serif with grant & fellowship focus.",
    layout: "minimal",
    font: "georgia",
    accent: "#4F46E5",
    header: "left",
    icons: false,
    sections: ["summary", "education", "projects", "experience", "certifications", "languages"],
    defaultFontSize: 11.5,
    defaultLineHeight: 1.6,
    defaultMargin: 64,
  },

  // International (2)
  {
    id: "global",
    name: "Global",
    category: "international",
    description: "Photo-free, date-led — common EU/CV format.",
    layout: "classic",
    font: "calibri",
    accent: "#2563EB",
    header: "split",
    icons: false,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 56,
  },
  {
    id: "europass",
    name: "Europass",
    category: "international",
    description: "Standardized two-column with personal data.",
    layout: "sidebar",
    font: "arial",
    accent: "#0D9488",
    header: "left",
    icons: true,
    sections: ALL_SECTIONS,
    defaultFontSize: 11,
    defaultLineHeight: 1.5,
    defaultMargin: 48,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTemplateById(id: string): ResumeTemplate {
  return RESUME_TEMPLATES.find((t) => t.id === id) ?? RESUME_TEMPLATES[0];
}

export function getFontById(id: string): ResumeFont {
  return RESUME_FONTS.find((f) => f.id === id) ?? RESUME_FONTS[0];
}

export function sectionLabel(id: SectionId): string {
  return SECTIONS.find((s) => s.id === id)?.label ?? id;
}

export function buildDefaultConfig(templateId: string): TemplateConfig {
  const t = getTemplateById(templateId);
  return {
    templateId: t.id,
    font: t.font,
    fontSize: t.defaultFontSize,
    lineHeight: t.defaultLineHeight,
    margin: t.defaultMargin,
    accent: t.accent,
    header: t.header,
    icons: t.icons,
    sections: [...t.sections],
    pageSize: "a4",
  };
}

/** Page dimensions in CSS px @96dpi (A4: 210×297mm, Letter: 216×279mm). */
export function pageDimensions(pageSize: PageSize): { width: number; height: number } {
  return pageSize === "a4" ? { width: 794, height: 1123 } : { width: 816, height: 1056 };
}

/** Splits a detail block into bullet lines ("• ..." preserved) or paragraphs. */
export function splitDetail(detail: string): string[] {
  return detail
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** True when a section has any content to render. */
export function sectionHasContent(data: ResumeData, section: SectionId): boolean {
  switch (section) {
    case "summary":
      return data.summary.trim().length > 0;
    case "experience":
      return data.experiences.some((e) => e.role || e.company || e.detail);
    case "skills":
      return data.skills.trim().length > 0;
    case "education":
      return data.education.some((e) => e.school || e.degree);
    case "projects":
      return data.projects.some((p) => p.name || p.detail);
    case "certifications":
      return data.certifications.length > 0;
    case "languages":
      return data.languages.length > 0;
    case "links":
      return data.website.trim().length > 0 || data.linkedin.trim().length > 0;
  }
}

export function skillsList(skills: string): string[] {
  return skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Sample data (matches the builder's defaults + extended sections)
// ---------------------------------------------------------------------------

export const SAMPLE_RESUME: ResumeData = {
  name: "Alex Thompson",
  title: "Senior Frontend Engineer",
  email: "alex.thompson@email.com",
  phone: "+1 (555) 018-2245",
  location: "San Francisco, CA",
  website: "alexthompson.dev",
  linkedin: "linkedin.com/in/alexthompson",
  summary:
    "Frontend engineer with 4+ years building performant, accessible web apps in React & TypeScript. Led the analytics dashboard used by 2K+ customers; improved load time by 40%.",
  skills: "React, TypeScript, Node.js, GraphQL, AWS, Figma",
  experiences: [
    {
      id: 1,
      role: "Frontend Engineer",
      company: "Acme Corp · 2021–Present",
      detail:
        "• Led the analytics dashboard used by 2K+ customers; improved load time by 40%\n• Built a component library adopted by 6 teams\n• Mentored 3 junior engineers",
    },
    {
      id: 2,
      role: "Full-Stack Developer",
      company: "Globex Inc · 2019–2021",
      detail:
        "• Shipped 12 production features across the billing platform\n• Cut API latency 30% with caching layers\n• Drove test coverage from 40% to 85%",
    },
  ],
  education: [
    {
      id: 1,
      school: "Stanford University",
      degree: "B.S. Computer Science",
      dates: "2015–2019",
      detail: "Graduated with honors. Focus on human-computer interaction.",
    },
  ],
  projects: [
    {
      id: 1,
      name: "ResumeForge",
      link: "github.com/alexthompson/resumeforge",
      detail: "Open-source ATS-friendly resume builder with 1.2K GitHub stars.",
    },
  ],
  certifications: ["AWS Solutions Architect", "Google UX Design"],
  languages: ["English (Native)", "Spanish (Professional)"],
};

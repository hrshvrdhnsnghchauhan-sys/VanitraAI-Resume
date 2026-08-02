import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Sparkles,
  Loader2,
  FileText,
  FileDown,
  Save,
  Trash2,
  RefreshCw,
  Building2,
  Briefcase,
  PenLine,
  CheckCircle2,
} from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAIProvider } from "@/ai/core";
import { useAuth } from "@/lib/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { exportCoverLetterPDF, exportCoverLetterDOCX } from "@/lib/cover-letter";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/cover-letter")({
  component: CoverLetterPage,
});

const TONES = [
  { id: "Professional", desc: "Polished & formal" },
  { id: "Confident", desc: "Assertive & assured" },
  { id: "Enthusiastic", desc: "Energetic & upbeat" },
  { id: "Warm", desc: "Friendly & approachable" },
  { id: "Concise", desc: "Short & scannable" },
  { id: "Storytelling", desc: "Narrative & engaging" },
];

const TEMPLATES = [
  { id: "Classic", desc: "Traditional 4-paragraph" },
  { id: "Modern", desc: "Crisp, results-led" },
  { id: "Minimal", desc: "Lean 2–3 paragraphs" },
  { id: "Narrative", desc: "Opens with a story hook" },
  { id: "Bold", desc: "Punchy & direct" },
  { id: "Data-Driven", desc: "Metrics-first structure" },
];

interface SavedLetter {
  id: string;
  title: string;
  letter: string;
  tone?: string;
  template?: string;
  companyName?: string;
  targetRole?: string;
  createdAt?: any;
}

function timeValue(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  const n = Date.parse(String(v));
  return Number.isNaN(n) ? 0 : n;
}

function CoverLetterPage() {
  const { user } = useAuth();

  // Job inputs
  const [companyName, setCompanyName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState("Professional");
  const [template, setTemplate] = useState("Classic");

  // Resume context
  const [resumeText, setResumeText] = useState("");
  const [loadingResume, setLoadingResume] = useState(true);
  const [hasResume, setHasResume] = useState(true);

  // Letter state
  const [generating, setGenerating] = useState(false);
  const [letter, setLetter] = useState("");
  const [editedLetter, setEditedLetter] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [saved, setSaved] = useState(false);

  // Saved letters
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const loadResume = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingResume(true);
    try {
      if (!db) {
        setHasResume(false);
        return;
      }
      const snap = await getDoc(doc(db, "resumes", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setHasResume(true);
        const exp =
          Array.isArray(data.experiences) || Array.isArray(data.experience)
            ? (data.experiences || data.experience)
                .map(
                  (e: any) =>
                    `${e.role || ""}${e.company ? ` at ${e.company}` : ""}: ${e.detail || ""}`,
                )
                .filter(Boolean)
                .join("\n")
            : "";
        setResumeText(
          [data.summary, exp, data.skills ? `Skills: ${data.skills}` : ""]
            .filter(Boolean)
            .join("\n\n"),
        );
      } else {
        setHasResume(false);
      }
    } catch (err) {
      console.warn("Failed to load resume:", err);
      setHasResume(false);
    } finally {
      setLoadingResume(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  const loadSavedLetters = useCallback(async () => {
    if (!user?.uid) {
      setLoadingSaved(false);
      return;
    }
    // Local fallback list (mirrors builder.tsx resilience pattern)
    let localList: SavedLetter[] = [];
    try {
      localList = JSON.parse(localStorage.getItem(`cover_letters_${user.uid}`) || "[]");
    } catch (err) {}
    if (!db) {
      setSavedLetters(localList);
      setLoadingSaved(false);
      return;
    }
    try {
      const q = query(collection(db, "coverLetters"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const cloudList = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SavedLetter);
      const cloudIds = new Set(cloudList.map((l) => l.id));
      const list = [...cloudList, ...localList.filter((l) => !cloudIds.has(l.id))];
      list.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
      setSavedLetters(list);
    } catch (err) {
      console.warn("Failed to load saved letters, using local list:", err);
      setSavedLetters(localList);
    } finally {
      setLoadingSaved(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadSavedLetters();
  }, [loadSavedLetters]);

  const handleLetterChange = (v: string) => {
    setEditedLetter(v);
    setSaved(false);
  };

  const generate = async () => {
    if (!targetRole.trim() && !jobDescription.trim() && !companyName.trim()) {
      toast.error("Add a target role, company, or job description first");
      return;
    }
    setGenerating(true);
    try {
      const ai = getAIProvider();
      const res = await ai.generateCoverLetter(
        resumeText || "Candidate with a strong professional background.",
        jobDescription || `Target role: ${targetRole}${companyName ? ` at ${companyName}` : ""}`,
        {
          tone,
          template,
          companyName: companyName || undefined,
          targetRole: targetRole || undefined,
        },
      );
      setLetter(res.coverLetter || "");
      setEditedLetter(res.coverLetter || "");
      setSaved(false);
      toast.success("Cover letter generated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate cover letter. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const saveLetter = async () => {
    if (!editedLetter.trim()) {
      toast.error("Generate a letter before saving");
      return;
    }
    if (!user?.uid) return;
    setSaving(true);
    const title = `${targetRole || "Cover letter"}${companyName ? ` · ${companyName}` : ""} — ${new Date().toLocaleDateString()}`;
    const entry: SavedLetter = {
      id: "local_" + Date.now(),
      title,
      letter: editedLetter,
      tone,
      template,
      companyName: companyName || "",
      targetRole: targetRole || "",
      createdAt: new Date().toISOString(),
    };
    try {
      if (!db) throw new Error("Database unavailable");
      const ref = await addDoc(collection(db, "coverLetters"), {
        userId: user.uid,
        title,
        letter: editedLetter,
        tone,
        template,
        companyName: companyName || "",
        targetRole: targetRole || "",
        createdAt: serverTimestamp(),
      });
      entry.id = ref.id;
      // Clear any matching local copy so it doesn't show up twice after reload.
      try {
        const key = `cover_letters_${user.uid}`;
        const existing: SavedLetter[] = JSON.parse(localStorage.getItem(key) || "[]");
        const filtered = existing.filter((l) => l.letter !== editedLetter || l.title !== title);
        if (filtered.length !== existing.length) {
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      } catch (err) {}
      setSaved(true);
      toast.success("Cover letter saved");
      loadSavedLetters();
    } catch (err) {
      console.warn("Cloud save failed (likely permissions), saved locally instead:", err);
      const key = `cover_letters_${user.uid}`;
      try {
        const existing: SavedLetter[] = JSON.parse(localStorage.getItem(key) || "[]");
        const updated = [entry, ...existing];
        localStorage.setItem(key, JSON.stringify(updated));
        setSavedLetters(updated);
        setSaved(true);
        toast.success("Cover letter saved locally (cloud sync unavailable)");
      } catch (localErr) {
        console.error(localErr);
        toast.error("Failed to save letter");
      }
    } finally {
      setSaving(false);
    }
  };

  const loadLetter = (l: SavedLetter) => {
    setLetter(l.letter);
    setEditedLetter(l.letter);
    setSaved(true);
    if (l.companyName) setCompanyName(l.companyName);
    if (l.targetRole) setTargetRole(l.targetRole);
    if (l.tone) setTone(l.tone);
    if (l.template) setTemplate(l.template);
    toast.success("Letter loaded");
  };

  const deleteLetter = async (id: string) => {
    if (!user?.uid) return;
    // Locally-saved letters only live in localStorage — remove them there.
    if (id.startsWith("local_") || !db) {
      try {
        const key = `cover_letters_${user.uid}`;
        const existing: SavedLetter[] = JSON.parse(localStorage.getItem(key) || "[]");
        const updated = existing.filter((l) => l.id !== id);
        localStorage.setItem(key, JSON.stringify(updated));
        setSavedLetters((prev) => prev.filter((l) => l.id !== id));
        toast.success("Letter deleted");
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete letter");
      }
      return;
    }
    try {
      await deleteDoc(doc(db, "coverLetters", id));
      setSavedLetters((prev) => prev.filter((l) => l.id !== id));
      toast.success("Letter deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete letter");
    }
  };

  const exportPDF = async () => {
    if (!editedLetter.trim()) return;
    setExporting("pdf");
    try {
      exportCoverLetterPDF(editedLetter, {
        name: user?.name || "",
        title: "",
        email: user?.email || "",
        phone: "",
        companyName,
        targetRole,
      });
      toast.success("PDF exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(null);
    }
  };

  const exportDOCX = async () => {
    if (!editedLetter.trim()) return;
    setExporting("docx");
    try {
      await exportCoverLetterDOCX(editedLetter, {
        name: user?.name || "",
        title: "",
        email: user?.email || "",
        phone: "",
        companyName,
        targetRole,
      });
      toast.success("DOCX exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export DOCX");
    } finally {
      setExporting(null);
    }
  };

  const pillClass = (active: boolean) =>
    cn(
      "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all",
      active
        ? "border-primary bg-primary/10 text-primary shadow-sm"
        : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
    );

  return (
    <>
      <PageHeader
        title="AI Cover Letter"
        description="Generate a job-specific cover letter in seconds, then export as PDF or DOCX."
        action={
          editedLetter.trim() ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportPDF} disabled={exporting !== null}>
                {exporting === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportDOCX}
                disabled={exporting !== null}
              >
                {exporting === "docx" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Export DOCX
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: configuration */}
        <div className="space-y-6 lg:col-span-3">
          <DashCard title="Job details" description="What role are you applying for?">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cl-company">Company</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="cl-company"
                    className="pl-9"
                    placeholder="e.g. Acme Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cl-role">Target role</Label>
                <div className="relative">
                  <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="cl-role"
                    className="pl-9"
                    placeholder="e.g. Senior Frontend Engineer"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="cl-desc">Job description</Label>
              <Textarea
                id="cl-desc"
                className="min-h-32"
                placeholder="Paste the job description, or key requirements you want the letter to address…"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>
          </DashCard>

          <DashCard title="Tone" description="The personality of your letter.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={pillClass(tone === t.id)}
                  aria-pressed={tone === t.id}
                >
                  <span>{t.id}</span>
                  <span className="text-[10px] font-normal opacity-70">{t.desc}</span>
                </button>
              ))}
            </div>
          </DashCard>

          <DashCard title="Template" description="The structure and layout of your letter.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={pillClass(template === t.id)}
                  aria-pressed={template === t.id}
                >
                  <span>{t.id}</span>
                  <span className="text-[10px] font-normal opacity-70">{t.desc}</span>
                </button>
              ))}
            </div>
          </DashCard>

          <DashCard
            title="Resume context"
            description={
              hasResume
                ? "Auto-loaded from your resume — edit freely."
                : "No resume found yet. Write a quick summary or build one first."
            }
            action={
              <Button variant="ghost" size="sm" onClick={loadResume} disabled={loadingResume}>
                <RefreshCw className={cn("h-4 w-4", loadingResume && "animate-spin")} />
                Reload
              </Button>
            }
          >
            <Textarea
              className="min-h-40 font-mono text-xs"
              placeholder="Your summary, experience and skills…"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
            {!hasResume && !loadingResume && (
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/dashboard/builder">Open Resume Builder</Link>
              </Button>
            )}
          </DashCard>

          <Button
            variant="hero"
            size="lg"
            className="w-full"
            onClick={generate}
            disabled={generating || loadingResume}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating
              ? "Writing your letter…"
              : letter
                ? "Regenerate letter"
                : "Generate cover letter"}
          </Button>
        </div>

        {/* Right: letter + saved */}
        <div className="space-y-6 lg:col-span-2">
          <DashCard
            title="Your letter"
            description="Editable — refine any sentence before exporting."
            className="lg:sticky lg:top-24"
            action={
              editedLetter.trim() ? (
                <Button variant="outline" size="sm" onClick={saveLetter} disabled={saving || saved}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saved ? "Saved" : "Save"}
                </Button>
              ) : undefined
            }
          >
            <div aria-live="polite">
              <AnimatePresence mode="wait">
                {generating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex min-h-72 flex-col items-center justify-center py-10 text-center"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                      <PenLine className="h-6 w-6" />
                    </span>
                    <p className="mt-4 text-sm font-medium">Crafting your letter…</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Matching your experience to the role, tone and template you selected.
                    </p>
                  </motion.div>
                ) : editedLetter.trim() ? (
                  <motion.div
                    key="letter"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                      <Sparkles className="h-3 w-3" /> {tone} · {template} template
                    </div>
                    <Textarea
                      className="min-h-72 resize-y bg-muted/30"
                      value={editedLetter}
                      onChange={(e) => handleLetterChange(e.target.value)}
                      aria-label="Cover letter content"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-72 flex-col items-center justify-center py-10 text-center"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Mail className="h-6 w-6" />
                    </span>
                    <p className="mt-4 text-sm font-medium">Your letter will appear here</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Add job details, pick a tone and template, then hit generate.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </DashCard>

          <DashCard title="Saved letters" description="Your previous letters, ready to reuse.">
            {loadingSaved ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : savedLetters.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No saved letters yet — save one to keep it here.
              </div>
            ) : (
              <div className="space-y-2">
                {savedLetters.map((l) => (
                  <div
                    key={l.id}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:border-primary/40"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => loadLetter(l)}
                      title="Load letter"
                    >
                      <span className="block truncate text-sm font-medium">{l.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {l.tone || "—"} · {l.template || "—"}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteLetter(l.id)}
                      aria-label="Delete letter"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DashCard>
        </div>
      </div>
    </>
  );
}

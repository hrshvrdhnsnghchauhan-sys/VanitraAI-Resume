import { useCallback, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileSearch,
  FileText,
  History,
  Loader2,
  RefreshCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { PageHeader, DashCard, ScoreRing } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { db } from "@/services/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ImportDropzone } from "@/components/features/dashboard/import-dropzone";
import { ImportPreview } from "@/components/features/dashboard/import-preview";
import {
  extractImportFile,
  hashImportFile,
  ImportError,
  validateImportFile,
} from "@/lib/import-files";
import {
  coerceJsonResume,
  detectAtsIssues,
  detectMissing,
  parseImportedText,
  type ImportResult,
} from "@/lib/resume-import";
import { getAIProvider } from "@/ai/core";
import { saveVersion } from "@/services/versions";
import { computeAtsScore, computeCompletion } from "@/lib/resume-version";
import type { ResumeData } from "@/lib/resume-templates";

export const Route = createFileRoute("/dashboard/import")({
  component: ImportPage,
});

const HASH_KEY_PREFIX = "resume_import_hash_";

type Stage = "idle" | "parsing" | "preview" | "saving" | "done";

function ImportPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [data, setData] = useState<ResumeData | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ats, setAts] = useState<{ score: number; completion: number } | null>(null);
  const [fileName, setFileName] = useState("");
  const lastHashRef = useRef<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!uid) {
        setError("Please sign in before importing a resume.");
        return;
      }
      setError(null);
      setResult(null);
      setData(null);
      setAts(null);
      setFileName(file.name);

      // 1. Validate size/extension.
      const invalid = validateImportFile(file);
      if (invalid) {
        setError(invalid.message);
        setStage("idle");
        return;
      }

      // 2. Duplicate-upload detection (same file hash recently imported).
      try {
        const hash = await hashImportFile(file);
        const prev = localStorage.getItem(HASH_KEY_PREFIX + uid);
        if (prev === hash) {
          toast.warning("You already imported this exact file.");
        }
        lastHashRef.current = hash;
      } catch {
        lastHashRef.current = null;
      }

      // 3. Extract text (lazy-loaded parsers, progress for PDF).
      setStage("parsing");
      setProgress(0);
      let text = "";
      let format: "pdf" | "docx" | "json" = "pdf";
      let pages: number | undefined;
      try {
        const extracted = await extractImportFile(file, (pct) => setProgress(pct));
        text = extracted.text;
        format = extracted.format;
        pages = extracted.pages;
      } catch (err) {
        const msg = err instanceof ImportError ? err.message : "Failed to read the file.";
        setError(msg);
        setStage("idle");
        return;
      }

      // 4. Parse into ResumeData.
      let parsed: ImportResult;
      if (format === "json") {
        const jsonData = coerceJsonResume(text);
        if (!jsonData) {
          setError("This JSON backup is not a valid resume file.");
          setStage("idle");
          return;
        }
        parsed = {
          data: jsonData,
          uncertain: [],
          issues: detectAtsIssues(jsonData),
          suggestions: detectMissing(jsonData).map((m) => `Add ${m} to complete your resume.`),
          stats: { lines: 0, words: 0, source: "json" },
        };
      } else {
        parsed = parseImportedText(text, format, pages);
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        // Scanned/image-based PDFs yield little to no text.
        if (format === "pdf" && wordCount < 25 && (pages ?? 1) > 0) {
          setError(
            "This PDF appears to be image-based (scanned) — no text could be extracted. Try exporting your resume as a text-based PDF or DOCX.",
          );
          setStage("idle");
          return;
        }
      }

      setResult(parsed);
      setData(parsed.data);
      setProgress(1);
      setStage("preview");
    },
    [uid],
  );

  const handleCleanup = useCallback(async () => {
    if (!data || cleaning) return;
    setCleaning(true);
    try {
      const res = await getAIProvider().cleanupImport(JSON.stringify(data));
      if (res?.data && Object.keys(res.data).length > 0) {
        setData((prev) => ({ ...prev!, ...(res.data as Partial<ResumeData>) }));
        setResult((prev) =>
          prev ? { ...prev, data: { ...prev.data, ...(res.data as Partial<ResumeData>) } } : prev,
        );
        if (res.suggestions?.length) {
          setResult((prev) => (prev ? { ...prev, suggestions: res.suggestions } : prev));
        }
        toast.success("AI cleanup applied — formatting & duplicates fixed.");
      } else {
        toast.info("AI cleanup unavailable — your parsed data is already clean.");
      }
    } catch {
      toast.error("AI cleanup failed. Your parsed data is unchanged.");
    } finally {
      setCleaning(false);
    }
  }, [data, cleaning]);

  const handleSave = useCallback(async () => {
    if (!uid || !data || saving) return;
    setSaving(true);
    try {
      const payload: ResumeData & {
        updatedAt: string;
        importedFrom: string;
        importHash?: string | null;
      } = {
        ...data,
        updatedAt: new Date().toISOString(),
        importedFrom: fileName,
        importHash: lastHashRef.current,
      };

      if (db) {
        await setDoc(doc(db, "resumes", uid), payload, { merge: true });
      } else {
        // Offline fallback mirrors the builder's local-storage path.
        const existing = localStorage.getItem(`resume_${uid}`);
        const merged = { ...(existing ? JSON.parse(existing) : {}), ...payload };
        localStorage.setItem(`resume_${uid}`, JSON.stringify(merged));
      }
      if (lastHashRef.current) {
        try {
          localStorage.setItem(HASH_KEY_PREFIX + uid, lastHashRef.current);
        } catch {
          // best effort
        }
      }

      // Snapshot an "import" version so Version History captures the change.
      try {
        await saveVersion({
          uid,
          data,
          name: `Imported · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
          description: `Imported from ${fileName}`,
          source: "import",
        });
      } catch (err) {
        console.warn("Version snapshot after import failed:", err);
      }

      setAts({ score: computeAtsScore(data), completion: computeCompletion(data) });
      setStage("done");
      toast.success("Resume imported successfully!");
    } catch (err: any) {
      console.error("Failed to save imported resume:", err);
      setError("Could not save the resume. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [uid, data, fileName, saving]);

  const handleReset = useCallback(() => {
    setStage("idle");
    setProgress(null);
    setError(null);
    setResult(null);
    setData(null);
    setAts(null);
    setFileName("");
  }, []);

  // Keep `data` and `result.data` in sync so the memoized editable preview
  // re-renders with the latest edits (it binds inputs to `result.data`).
  const handleChange = useCallback((next: ResumeData) => {
    setData(next);
    setResult((prev) => (prev ? { ...prev, data: next } : prev));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Resume"
        description="Upload an existing resume (PDF, DOCX, or JSON backup) — we extract, clean, and prep it for the builder."
        action={
          stage === "done" ? (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCcw className="h-4 w-4 mr-1.5" /> Import another
            </Button>
          ) : undefined
        }
      />

      {stage === "idle" && (
        <DashCard>
          <ImportDropzone busy={false} progress={null} error={error} onFile={handleFile} />
          <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> PDF resumes (incl. LinkedIn, Resume.io,
              Canva exports)
            </div>
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" /> DOCX & JSON backups
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI cleanup + ATS analysis included
            </div>
          </div>
        </DashCard>
      )}

      {stage === "parsing" && (
        <DashCard>
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="font-semibold">Parsing {fileName}</p>
              <p className="text-sm text-muted-foreground">
                Extracting text and structuring sections…
              </p>
            </div>
            {typeof progress === "number" && (
              <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        </DashCard>
      )}

      {stage === "preview" && result && data && (
        <ImportPreview
          result={result}
          cleaning={cleaning}
          saving={saving}
          onCleanup={handleCleanup}
          onChange={handleChange}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}

      {stage === "done" && data && ats && (
        <div className="space-y-6">
          <DashCard>
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-center sm:gap-12">
              <div className="flex flex-col items-center gap-1">
                <ScoreRing value={ats.score} label="Heuristic ATS score" />
                <p className="max-w-60 text-xs text-muted-foreground">
                  Deterministic score — run the full AI Analyzer for keyword-level insights.
                </p>
              </div>
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-semibold">Resume imported & saved to your account</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{Math.round(ats.completion)}% complete</Badge>
                  <Badge variant="outline">
                    {data.experiences.length} experience
                    {data.experiences.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline">
                    {data.skills.split(",").filter(Boolean).length} skills
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="hero" size="sm">
                    <Link to="/dashboard/builder">
                      <FileText className="h-4 w-4 mr-1.5" /> Open in Builder
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/dashboard/analyzer">
                      <FileSearch className="h-4 w-4 mr-1.5" /> Run AI Analysis
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/dashboard/versions">
                      <History className="h-4 w-4 mr-1.5" /> View Version History
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </DashCard>
        </div>
      )}
    </div>
  );
}

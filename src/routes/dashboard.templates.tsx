import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, FileDown, Loader2, Maximize, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { TemplateResume } from "@/components/features/dashboard/template-resume";
import {
  TemplateGallery,
  TemplateCustomizer,
} from "@/components/features/dashboard/template-customizer";
import { exportResumeDOCX } from "@/lib/resume-export";
import {
  buildDefaultConfig,
  CATEGORIES,
  getTemplateById,
  pageDimensions,
  RESUME_TEMPLATES,
  SAMPLE_RESUME,
  type CategoryId,
  type ResumeData,
  type TemplateConfig,
} from "@/lib/resume-templates";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/templates")({
  component: TemplatesPage,
});

function loadLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    return null;
  }
}

function TemplatesPage() {
  const { user, loading: authLoading, tokenReady } = useAuth();
  const uid = user?.uid;

  const [data, setData] = useState<ResumeData>(SAMPLE_RESUME);
  const [config, setConfig] = useState<TemplateConfig>(() => buildDefaultConfig("nova"));
  // Tracks whether the user has genuinely edited something. SAMPLE_RESUME is
  // display-only until then — otherwise a brand-new user's real resume doc
  // would be polluted with sample content on first visit.
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [zoom, setZoom] = useState(0.75);
  const [pageCount, setPageCount] = useState(1);
  const [showBreaks, setShowBreaks] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load persisted resume + template config
  useEffect(() => {
    if (authLoading || !uid || !tokenReady) return;

    const localKey = `resume_templates_${uid}`;
    const local = loadLocal<{ data: ResumeData; config: TemplateConfig }>(localKey);

    if (!db) {
      if (local) {
        setData(local.data);
        setConfig(local.config);
      }
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const snap = await getDoc(doc(db, "resumes", uid));
        if (snap.exists()) {
          setDirty(true);
          const d = snap.data();
          const merged: ResumeData = {
            name: d.name ?? SAMPLE_RESUME.name,
            title: d.title ?? SAMPLE_RESUME.title,
            email: d.email ?? SAMPLE_RESUME.email,
            phone: d.phone ?? SAMPLE_RESUME.phone,
            location: d.location ?? "",
            website: d.website ?? "",
            linkedin: d.linkedin ?? "",
            summary: d.summary ?? SAMPLE_RESUME.summary,
            skills: d.skills ?? SAMPLE_RESUME.skills,
            experiences: d.experiences ?? SAMPLE_RESUME.experiences,
            education: d.education ?? [],
            projects: d.projects ?? [],
            certifications: d.certifications ?? [],
            languages: d.languages ?? [],
          };
          setData(merged);
          if (d.templateId) {
            setConfig({
              ...buildDefaultConfig(d.templateId as string),
              ...(typeof d.templateConfig === "object" && d.templateConfig
                ? (d.templateConfig as Partial<TemplateConfig>)
                : {}),
              templateId: d.templateId as string,
            });
          }
        } else if (local) {
          setDirty(true);
          setData(local.data);
          setConfig(local.config);
        }
      } catch (err) {
        console.warn("Failed to load resume templates from cloud, using local:", err);
        if (local) {
          // Real user data — mark dirty so it re-syncs to cloud on next edit.
          setDirty(true);
          setData(local.data);
          setConfig(local.config);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, authLoading, tokenReady]);

  // User-edit handlers — mark dirty so SAMPLE_RESUME is never persisted.
  const handleDataChange = useCallback((d: ResumeData) => {
    setData(d);
    setDirty(true);
  }, []);

  const handleConfigChange = useCallback((c: TemplateConfig) => {
    setConfig(c);
    setDirty(true);
  }, []);

  const handleReset = useCallback(() => {
    setConfig(buildDefaultConfig(config.templateId));
    setDirty(true);
  }, [config.templateId]);

  // Autosave to Firestore + localStorage fallback (only after real edits)
  useEffect(() => {
    if (!uid || loading || !dirty) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      const payload = {
        ...data,
        templateId: config.templateId,
        templateConfig: config,
        updatedAt: new Date().toISOString(),
      };
      try {
        if (db) {
          await setDoc(doc(db, "resumes", uid), payload, { merge: true });
        }
        localStorage.setItem(`resume_templates_${uid}`, JSON.stringify({ data, config }));
      } catch (err) {
        console.warn("Template cloud save failed, saved locally:", err);
        localStorage.setItem(`resume_templates_${uid}`, JSON.stringify({ data, config }));
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [data, config, uid, loading, dirty]);

  const selectTemplate = useCallback((id: string) => {
    const t = getTemplateById(id);
    setConfig((prev) => ({
      ...buildDefaultConfig(id),
      // Preserve the user's page-size preference when switching templates.
      pageSize: prev.pageSize,
      // Adopt the new template's default section set.
      sections: t.sections,
    }));
    setDirty(true);
    toast.success(`Template: ${t.name}`);
  }, []);

  const handleExportPDF = () => {
    setExporting("pdf");
    // Small delay lets the print-mode sheet render before window.print()
    setTimeout(() => {
      window.print();
      setExporting(null);
    }, 60);
  };

  const handleExportDOCX = async () => {
    if (exporting) return;
    setExporting("docx");
    try {
      await exportResumeDOCX(data, config);
      toast.success("DOCX exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export DOCX");
    } finally {
      setExporting(null);
    }
  };

  const dims = pageDimensions(config.pageSize);
  const template = getTemplateById(config.templateId);
  const templateCategoryLabel =
    CATEGORIES.find((c) => c.id === template.category)?.label ?? template.category;

  const zoomBy = (delta: number) =>
    setZoom((z) => Math.min(1.5, Math.max(0.4, +(z + delta).toFixed(2))));

  const fitWidth = () => {
    const w = previewRef.current?.clientWidth;
    if (w) setZoom(Math.min(1, +(w / dims.width).toFixed(2)));
  };

  useEffect(() => {
    fitWidth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.pageSize, loading]);

  const pageLabel = config.pageSize === "a4" ? "A4" : "Letter";

  return (
    <>
      <style>{`
        @media print {
          @page { size: ${config.pageSize === "a4" ? "A4" : "Letter"}; margin: 0; }
          body * { visibility: hidden; }
          #templates-print-sheet, #templates-print-sheet * { visibility: visible; }
          #templates-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      <PageHeader
        title="Resume Templates"
        description="32 ATS-friendly templates with live preview, full customization and one-click export."
        action={
          <div className="flex flex-wrap gap-2">
            <span className="hidden items-center text-xs text-muted-foreground sm:inline-flex">
              {saving ? "Saving…" : "Auto-saved"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDOCX}
              disabled={exporting !== null}
            >
              {exporting === "docx" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              DOCX
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={handleExportPDF}
              disabled={exporting !== null}
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export PDF
            </Button>
          </div>
        }
      />

      <DashCard
        title="Choose a template"
        description={`${RESUME_TEMPLATES.length} templates · ${CATEGORIES.length} categories · all ATS-friendly`}
      >
        <TemplateGallery
          activeCategory={category}
          onCategoryChange={setCategory}
          selectedId={config.templateId}
          onSelect={selectTemplate}
        />
      </DashCard>

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Customizer */}
        <div className="xl:col-span-2">
          <DashCard
            title="Customize"
            description={`${template.name} · ${templateCategoryLabel} category`}
            className="xl:sticky xl:top-24"
          >
            <TemplateCustomizer
              config={config}
              onChange={handleConfigChange}
              data={data}
              onDataChange={handleDataChange}
              onReset={handleReset}
            />
          </DashCard>
        </div>

        {/* Live preview */}
        <div className="xl:col-span-3">
          <DashCard
            title="Live preview"
            description="Instant updates as you edit. Zoom in to inspect detail."
            action={
              <div className="flex items-center gap-1">
                <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">
                  {Math.round(zoom * 100)}% · {pageLabel} · {pageCount}{" "}
                  {pageCount === 1 ? "page" : "pages"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => zoomBy(-0.1)}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => zoomBy(0.1)}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={fitWidth}
                  aria-label="Fit width"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBreaks((v) => !v)}
                  aria-pressed={showBreaks}
                  className={cn("text-xs", !showBreaks && "text-muted-foreground")}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Breaks
                </Button>
              </div>
            }
          >
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div
                ref={previewRef}
                className="overflow-auto rounded-xl bg-muted/40 p-4"
                style={{ maxHeight: "78vh" }}
              >
                <div
                  style={{
                    width: dims.width * zoom,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  <TemplateResume
                    data={data}
                    config={config}
                    showBreaks={showBreaks}
                    onPageCount={setPageCount}
                  />
                </div>
              </div>
            )}
          </DashCard>
        </div>
      </div>

      {/* Print-only copy (light, exact page size) — MUST NOT live inside a
          print:hidden ancestor, otherwise the whole subtree hides on print. */}
      <div id="templates-print-sheet" className="hidden print:block">
        <TemplateResume data={data} config={config} showBreaks={false} />
      </div>
    </>
  );
}

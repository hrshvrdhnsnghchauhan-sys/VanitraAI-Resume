import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Save, Loader2, GitCompare, X, Trash2 } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { db } from "@/services/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { type ResumeData } from "@/lib/resume-templates";
import {
  autosaveVersion,
  duplicateVersion,
  fetchVersions,
  purgeExpiredTrash,
  purgeVersion,
  restoreDeletedVersion,
  restoreVersion,
  saveVersion,
  softDeleteVersion,
  toggleFavorite,
} from "@/services/versions";
import { type ResumeVersion } from "@/lib/resume-version";
import { VersionAnalytics, VersionCharts } from "@/components/features/dashboard/version-analytics";
import { VersionTimeline } from "@/components/features/dashboard/version-timeline";
import { VersionCompare } from "@/components/features/dashboard/version-compare";

export const Route = createFileRoute("/dashboard/versions")({
  component: VersionsPage,
});

function toResumeData(d: Record<string, unknown>): ResumeData {
  // Real stored values only — never fall back to sample content.
  return {
    name: (d.name as string) ?? "",
    title: (d.title as string) ?? "",
    email: (d.email as string) ?? "",
    phone: (d.phone as string) ?? "",
    location: (d.location as string) ?? "",
    website: (d.website as string) ?? "",
    linkedin: (d.linkedin as string) ?? "",
    summary: (d.summary as string) ?? "",
    skills: (d.skills as string) ?? "",
    experiences: (d.experiences as ResumeData["experiences"]) ?? [],
    education: (d.education as ResumeData["education"]) ?? [],
    projects: (d.projects as ResumeData["projects"]) ?? [],
    certifications: (d.certifications as string[]) ?? [],
    languages: (d.languages as string[]) ?? [],
    templateId: (d.templateId as string) || undefined,
  };
}

// Blank resume used only as a placeholder before real data arrives —
// never sample content, so nothing fictional can be saved or restored.
const EMPTY_RESUME: ResumeData = toResumeData({});

function VersionsPage() {
  const { user, loading: authLoading, tokenReady } = useAuth();
  const uid = user?.uid;

  const [data, setData] = useState<ResumeData>(EMPTY_RESUME);
  const [hasResume, setHasResume] = useState(false);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);

  // Compare mode
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareAId, setCompareAId] = useState<string>("");
  const [compareBId, setCompareBId] = useState<string>("");

  // Timeline filters
  const [templateFilter, setTemplateFilter] = useState("all");
  const [atsFilter, setAtsFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Snapshot dialog
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapName, setSnapName] = useState("");
  const [snapDesc, setSnapDesc] = useState("");
  const [snapping, setSnapping] = useState(false);

  // Restore / delete confirmations
  const [restoreTarget, setRestoreTarget] = useState<ResumeVersion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResumeVersion | null>(null);
  const [confirming, setConfirming] = useState(false);

  const firstSnap = useRef(true);

  const reload = useCallback(async (): Promise<ResumeVersion[]> => {
    if (!uid) return [];
    const list = await fetchVersions(uid);
    setVersions(list);
    return list;
  }, [uid]);

  // Set while a restore is committing, so the onSnapshot it triggers does not
  // create a same-content duplicate autosave of the just-restored version.
  const restoringRef = useRef(false);

  // Initial load + resume watch (feeds autosave snapshots)
  useEffect(() => {
    if (authLoading || !uid || !tokenReady) return;

    reload().then((list) => {
      // Production hygiene: purge trash older than 30 days once per load,
      // reusing the same list (no duplicate collection read).
      purgeExpiredTrash(uid, list)
        .then((n) => {
          if (n > 0) reload();
        })
        .catch(() => {});
    });

    if (!db) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "resumes", uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setHasResume(true);
          const next = toResumeData(d);
          setData(next);

          // Autosave a version when the resume actually changes (deduped).
          // Skip the very first snapshot so opening the page doesn't create
          // a duplicate of the current state.
          if (firstSnap.current) {
            firstSnap.current = false;
          } else if (!restoringRef.current) {
            autosaveVersion(uid, next).catch(() => {});
          }
        } else {
          setHasResume(false);
          setData(EMPTY_RESUME);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Resume watch failed, versions page continues:", err);
        setLoading(false);
      },
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, authLoading, tokenReady]);

  const activeCount = useMemo(() => versions.filter((v) => !v.deletedAt).length, [versions]);

  // Snapshot dialog
  const openSnapshot = () => {
    setSnapName(`Version ${activeCount + 1}`);
    setSnapDesc("");
    setSnapshotOpen(true);
  };

  const confirmSnapshot = async () => {
    if (!uid) return;
    setSnapping(true);
    try {
      await saveVersion({
        uid,
        data,
        name: snapName.trim() || `Version ${activeCount + 1}`,
        description: snapDesc.trim() || undefined,
        source: "manual",
      });
      toast.success("Version saved");
      setSnapshotOpen(false);
      reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save version");
    } finally {
      setSnapping(false);
    }
  };

  const handleFavorite = useCallback(
    async (v: ResumeVersion) => {
      if (!uid) return;
      try {
        await toggleFavorite(uid, v.id, !v.isFavorite);
        reload();
      } catch (err) {
        toast.error("Failed to update favorite");
      }
    },
    [uid, reload],
  );

  const handleRestore = useCallback(async () => {
    if (!uid || !restoreTarget) return;
    setConfirming(true);
    restoringRef.current = true;
    try {
      await restoreVersion(uid, data, restoreTarget);
      toast.success(`Restored “${restoreTarget.name}” — current version preserved`);
      setRestoreTarget(null);
      reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore version");
    } finally {
      setConfirming(false);
      setTimeout(() => {
        restoringRef.current = false;
      }, 1500);
    }
  }, [uid, data, restoreTarget, reload]);

  const handleDelete = useCallback(async () => {
    if (!uid || !deleteTarget) return;
    setConfirming(true);
    try {
      await softDeleteVersion(uid, deleteTarget.id);
      toast.success("Moved to trash (auto-purged after 30 days)");
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error("Failed to delete version");
    } finally {
      setConfirming(false);
    }
  }, [uid, deleteTarget, reload]);

  const handleUntrash = useCallback(
    async (v: ResumeVersion) => {
      if (!uid) return;
      try {
        await restoreDeletedVersion(uid, v.id);
        toast.success("Version restored from trash");
        reload();
      } catch (err) {
        toast.error("Failed to restore version");
      }
    },
    [uid, reload],
  );

  const handlePurge = useCallback(
    async (v: ResumeVersion) => {
      if (!uid) return;
      try {
        await purgeVersion(uid, v.id);
        toast.success("Version permanently deleted");
        reload();
      } catch (err) {
        toast.error("Failed to purge version");
      }
    },
    [uid, reload],
  );

  const handleDuplicate = useCallback(
    async (v: ResumeVersion) => {
      if (!uid) return;
      try {
        await duplicateVersion(uid, v);
        toast.success("Duplicated — editing independently");
        reload();
      } catch (err) {
        toast.error("Failed to duplicate version");
      }
    },
    [uid, reload],
  );

  const handleCompare = useCallback((v: ResumeVersion) => {
    setCompareAId(v.id);
    setCompareBId("");
    setCompareOpen(true);
  }, []);

  const compareA = versions.find((v) => v.id === compareAId) ?? null;
  const compareB = versions.find((v) => v.id === compareBId) ?? null;

  return (
    <>
      <PageHeader
        title="Version History"
        description="Every important version of your resume — auto-saved, searchable, restorable."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareOpen(true)}
              disabled={activeCount < 2}
            >
              <GitCompare className="mr-1.5 h-4 w-4" /> Compare
            </Button>
            <Button variant="hero" size="sm" onClick={openSnapshot} disabled={!hasResume}>
              <Save className="mr-1.5 h-4 w-4" /> Save Version
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <VersionAnalytics versions={versions} />
          <VersionCharts versions={versions} />

          <DashCard
            title="Resume versions"
            description={
              hasResume
                ? "Autosaves + manual snapshots. Favorites float to the top."
                : "Build a resume first to start versioning."
            }
          >
            {compareOpen ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <GitCompare className="h-4 w-4 text-primary" /> Compare versions
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setCompareOpen(false)}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Back to timeline
                  </Button>
                </div>
                <VersionCompare
                  versions={versions}
                  versionA={compareA}
                  versionB={compareB}
                  onSelectA={setCompareAId}
                  onSelectB={setCompareBId}
                />
              </div>
            ) : (
              <VersionTimeline
                versions={versions}
                onFavorite={handleFavorite}
                onRestore={setRestoreTarget}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteTarget}
                onCompare={handleCompare}
                onUntrash={handleUntrash}
                onPurge={handlePurge}
                templateFilter={templateFilter}
                onTemplateFilter={setTemplateFilter}
                atsFilter={atsFilter}
                onAtsFilter={setAtsFilter}
                dateFilter={dateFilter}
                onDateFilter={setDateFilter}
              />
            )}
          </DashCard>
        </>
      )}

      {/* Snapshot dialog */}
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Save a version</DialogTitle>
            <DialogDescription>Name this snapshot so you can find it later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-name">Version name</Label>
              <Input id="v-name" value={snapName} onChange={(e) => setSnapName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-desc">Note (optional)</Label>
              <Textarea
                id="v-desc"
                value={snapDesc}
                onChange={(e) => setSnapDesc(e.target.value)}
                placeholder="e.g. Tailored for the fintech role"
              />
            </div>
            <Button variant="hero" className="w-full" onClick={confirmSnapshot} disabled={snapping}>
              {snapping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save version
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore dialog */}
      <Dialog open={restoreTarget !== null} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Restore this version?</DialogTitle>
            <DialogDescription>
              Your current resume will first be preserved as a new version, then this version
              becomes active.
            </DialogDescription>
          </DialogHeader>
          {restoreTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{restoreTarget.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  ATS {restoreTarget.atsScore ?? "—"} · {restoreTarget.completion ?? 0}% complete
                </div>
              </div>
              <Button
                variant="hero"
                className="w-full"
                onClick={handleRestore}
                disabled={confirming}
              >
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Restore version
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete (soft) dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Move to trash?</DialogTitle>
            <DialogDescription>
              This version stays recoverable for 30 days, then is purged automatically.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={confirming}>
                {confirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Move to trash
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

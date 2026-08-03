import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Download,
  Plus,
  Trash2,
  Upload,
  History,
  Save,
  ChevronDown,
  Clock,
  FileJson,
  Sparkles,
  Loader2,
} from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ResumePreview } from "@/components/features/dashboard/resume-preview";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuth } from "@/lib/auth";
import { getAIProvider } from "@/ai/core";
import { autosaveVersion } from "@/services/versions";
import type { ResumeData } from "@/lib/resume-templates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/builder")({
  component: BuilderPage,
});

interface Experience {
  id: number;
  role: string;
  company: string;
  detail: string;
}

function BuilderPage() {
  const { user, loading: authLoading, tokenReady } = useAuth();
  const [name, setName] = useState("Alex Thompson");
  const [title, setTitle] = useState("Senior Frontend Engineer");
  const [email, setEmail] = useState("alex.thompson@email.com");
  const [phone, setPhone] = useState("+1 (555) 018-2245");
  const [summary, setSummary] = useState(
    "Frontend engineer with 4+ years building performant, accessible web apps in React & TypeScript.",
  );
  const [skills, setSkills] = useState("React, TypeScript, Node.js, GraphQL, AWS, Figma");
  const [experiences, setExperiences] = useState<Experience[]>([
    {
      id: 1,
      role: "Frontend Engineer",
      company: "Acme Corp · 2021–Present",
      detail: "Led the analytics dashboard used by 2K+ customers; improved load time by 40%.",
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "history">("edit");
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingSkills, setIsGeneratingSkills] = useState(false);
  const [generatingExp, setGeneratingExp] = useState<number | null>(null);

  // Real-time Sync from Firestore with Auth Race Condition protection
  useEffect(() => {
    if (authLoading || !user?.uid || !tokenReady) return;

    if (!db) {
      const localData = localStorage.getItem(`resume_${user.uid}`);
      if (localData) {
        try {
          const data = JSON.parse(localData);
          if (data.name !== undefined) setName(data.name);
          if (data.title !== undefined) setTitle(data.title);
          if (data.email !== undefined) setEmail(data.email);
          if (data.phone !== undefined) setPhone(data.phone);
          if (data.summary !== undefined) setSummary(data.summary);
          if (data.skills !== undefined) setSkills(data.skills);
          if (data.experiences !== undefined) setExperiences(data.experiences);
        } catch (err) {
          /* ignore malformed locally-cached resume data */
        }
      }
      return;
    }

    const docRef = doc(db, "resumes", user.uid);
    const unsubResume = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name !== undefined) setName(data.name);
          if (data.title !== undefined) setTitle(data.title);
          if (data.email !== undefined) setEmail(data.email);
          if (data.phone !== undefined) setPhone(data.phone);
          if (data.summary !== undefined) setSummary(data.summary);
          if (data.skills !== undefined) setSkills(data.skills);
          if (data.experiences !== undefined) setExperiences(data.experiences);
        } else {
          setDoc(
            docRef,
            {
              name,
              title,
              email,
              phone,
              summary,
              skills,
              experiences,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          ).catch(() => {
            /* ignore: initial seed write is best-effort */
          });
        }
      },
      (e) => {
        console.warn("Realtime resume sync skipped, falling back to local storage:", e);
        const localData = localStorage.getItem(`resume_${user.uid}`);
        if (localData) {
          try {
            const data = JSON.parse(localData);
            if (data.name !== undefined) setName(data.name);
            if (data.title !== undefined) setTitle(data.title);
            if (data.email !== undefined) setEmail(data.email);
            if (data.phone !== undefined) setPhone(data.phone);
            if (data.summary !== undefined) setSummary(data.summary);
            if (data.skills !== undefined) setSkills(data.skills);
            if (data.experiences !== undefined) setExperiences(data.experiences);
          } catch (err) {
            /* ignore malformed locally-cached resume data */
          }
        }
      },
    );

    const storageKey = `resume_history_${user.uid}`;
    let localHistory: any[] = [];
    try {
      localHistory = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch (err) {
      /* ignore malformed local history */
    }

    const unsubHistory = onSnapshot(
      query(collection(db, "resumes", user.uid, "history"), orderBy("createdAt", "desc")),
      (snap) => {
        const cloudHistory = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const cloudIds = new Set(cloudHistory.map((h) => h.id));
        const combined = [...cloudHistory, ...localHistory.filter((h) => !cloudIds.has(h.id))];
        setHistory(combined);
      },
      (e) => {
        console.warn("Realtime history sync skipped, using local history:", e);
        setHistory(localHistory);
      },
    );

    return () => {
      unsubResume();
      unsubHistory();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubscribe when auth state changes; snapshot setters are stable
  }, [user?.uid, authLoading, tokenReady]);

  const fetchHistory = async () => {
    if (!user?.uid) return;
    const storageKey = `resume_history_${user.uid}`;
    let localHistory: any[] = [];
    try {
      localHistory = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch (err) {
      /* ignore malformed local history */
    }
    setHistory(localHistory);
  };

  // Autosave to Firestore with local storage fallback
  useEffect(() => {
    if (!user?.uid || !db) return;
    const timer = setTimeout(async () => {
      setIsSaving(true);
      const payload = {
        name,
        title,
        email,
        phone,
        summary,
        skills,
        experiences,
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db!, "resumes", user.uid), payload, { merge: true });
        // Additive: snapshot a version into the history (deduped — a no-op
        // when the content hash is unchanged, so no duplicate versions).
        const snapshot: ResumeData = {
          name,
          title,
          email,
          phone,
          location: "",
          website: "",
          linkedin: "",
          summary,
          skills,
          experiences,
          education: [],
          projects: [],
          certifications: [],
          languages: [],
        };
        autosaveVersion(user.uid!, snapshot).catch(() => {
          /* version snapshot is additive; failures fall back to local save */
        });
      } catch (e: any) {
        // Fallback to local storage
        localStorage.setItem(`resume_${user.uid}`, JSON.stringify(payload));
        console.warn("Cloud save failed (likely permissions), saved locally instead.");
      } finally {
        setIsSaving(false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [name, title, email, phone, summary, skills, experiences, user]);

  const addExperience = () =>
    setExperiences((e) => [...e, { id: Date.now(), role: "", company: "", detail: "" }]);
  const updateExperience = (id: number, key: keyof Experience, value: string) =>
    setExperiences((e) => e.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  const removeExperience = (id: number) => setExperiences((e) => e.filter((x) => x.id !== id));

  const handleExportPDF = () => {
    window.print();
    toast.success("Resume exported to PDF");
  };

  const handleExportJSON = () => {
    const data = { name, title, email, phone, summary, skills, experiences };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${name.replace(/\\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.name !== undefined) setName(data.name);
        if (data.title !== undefined) setTitle(data.title);
        if (data.email !== undefined) setEmail(data.email);
        if (data.phone !== undefined) setPhone(data.phone);
        if (data.summary !== undefined) setSummary(data.summary);
        if (data.skills !== undefined) setSkills(data.skills);
        if (data.experiences !== undefined) setExperiences(data.experiences);
        toast.success("Resume imported successfully");
      } catch (err) {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  };

  const saveVersion = async () => {
    if (!user?.uid) {
      toast.error("Please log in to save versions");
      return;
    }
    const versionData = { name, title, email, phone, summary, skills, experiences };
    try {
      if (db) {
        try {
          await addDoc(collection(db, "resumes", user.uid, "history"), {
            ...versionData,
            createdAt: serverTimestamp(),
          });
          toast.success("Version saved securely to cloud");
          fetchHistory();
          return;
        } catch (cloudErr: any) {
          console.warn(
            "Cloud saveVersion failed (likely Firestore rules/permissions), using local storage:",
            cloudErr,
          );
        }
      }
      const storageKey = `resume_history_${user.uid}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const newVersion = {
        id: "local_" + Date.now(),
        ...versionData,
        createdAt: new Date().toISOString(),
      };
      const updated = [newVersion, ...existing];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setHistory(updated);
      toast.success("Version saved locally (Cloud sync unavailable)");
    } catch (e: any) {
      console.error("Failed to save version:", e);
      toast.error("Failed to save version: " + (e?.message || "Unknown error"));
    }
  };

  const restoreVersion = (v: any) => {
    if (v.name !== undefined) setName(v.name);
    if (v.title !== undefined) setTitle(v.title);
    if (v.email !== undefined) setEmail(v.email);
    if (v.phone !== undefined) setPhone(v.phone);
    if (v.summary !== undefined) setSummary(v.summary);
    if (v.skills !== undefined) setSkills(v.skills);
    if (v.experiences !== undefined) setExperiences(v.experiences);
    setHistoryOpen(false);
    toast.success("Version restored successfully");
  };

  const handleGenerateSummary = async () => {
    try {
      setIsGeneratingSummary(true);
      const res = await getAIProvider().aiHelper(
        "summary",
        experiences.map((e) => `${e.role} at ${e.company}`).join(", "),
        title,
      );
      if (res.text) setSummary(res.text);
      toast.success("Summary generated!");
    } catch (e) {
      toast.error("Failed to generate summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSuggestSkills = async () => {
    try {
      setIsGeneratingSkills(true);
      const res = await getAIProvider().aiHelper(
        "skills",
        experiences.map((e) => e.detail).join(" "),
        title,
        4,
      );
      if (res.items && res.items.length) {
        setSkills((prev) =>
          Array.from(
            new Set([
              ...prev
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              ...res.items!,
            ]),
          ).join(", "),
        );
      }
      toast.success("Skills suggested!");
    } catch (e) {
      toast.error("Failed to suggest skills");
    } finally {
      setIsGeneratingSkills(false);
    }
  };

  const handleGenerateBullets = async (id: number) => {
    try {
      setGeneratingExp(id);
      const exp = experiences.find((e) => e.id === id);
      if (!exp) return;
      const res = await getAIProvider().aiHelper(
        "bullets",
        `Role: ${exp.role}, Company: ${exp.company}. Current details: ${exp.detail}`,
        exp.role,
        3,
      );
      if (res.items && res.items.length) {
        updateExperience(id, "detail", res.items.map((i) => `• ${i}`).join("\n"));
      }
      toast.success("Bullets generated!");
    } catch (e) {
      toast.error("Failed to generate bullets");
    } finally {
      setGeneratingExp(null);
    }
  };

  return (
    <div className="print:m-0 print:p-0">
      <input
        type="file"
        accept=".json"
        className="hidden"
        ref={fileInputRef}
        onChange={handleImportJSON}
      />

      <div className="print:hidden">
        <PageHeader
          title="Resume Builder"
          description="Build an ATS-friendly resume with live preview."
          action={
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground hidden sm:inline-block">
                {isSaving ? "Saving..." : "Saved to cloud"}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <History className="h-4 w-4 mr-2" /> Versions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={saveVersion}>
                    <Save className="h-4 w-4 mr-2" /> Save Current Snapshot
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                    <Clock className="h-4 w-4 mr-2" /> View Version History
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ChevronDown className="h-4 w-4 mr-2" /> File
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Import JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <FileJson className="h-4 w-4 mr-2" /> Export JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="hero" onClick={handleExportPDF}>
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </div>
          }
        />
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              Restore a previously saved snapshot of your resume.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No saved versions found.
              </div>
            ) : (
              history.map((h, i) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-3 border rounded-xl hover:border-primary/50 transition-colors"
                >
                  <div>
                    <div className="font-medium">Version {history.length - i}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleString() : "Recently"}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => restoreVersion(h)}>
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-2 print:block">
        {/* Editor */}
        <div className="space-y-6 print:hidden">
          <DashCard title="Personal Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          </DashCard>

          <DashCard
            title="Summary"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary}
                className="text-primary hover:text-primary/80"
              >
                {isGeneratingSummary ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                AI Write
              </Button>
            }
          >
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="min-h-24"
            />
          </DashCard>

          <DashCard
            title="Experience"
            action={
              <Button variant="ghost" size="sm" onClick={addExperience}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            }
          >
            <div className="space-y-5">
              {experiences.map((x) => (
                <div key={x.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex gap-2">
                    <Input
                      value={x.role}
                      placeholder="Role"
                      onChange={(e) => updateExperience(x.id, "role", e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleGenerateBullets(x.id)}
                      disabled={generatingExp === x.id}
                      title="AI Generate Bullets"
                    >
                      {generatingExp === x.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeExperience(x.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Input
                    value={x.company}
                    placeholder="Company · dates"
                    onChange={(e) => updateExperience(x.id, "company", e.target.value)}
                  />
                  <Textarea
                    value={x.detail}
                    placeholder="Achievements…"
                    onChange={(e) => updateExperience(x.id, "detail", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </DashCard>

          <DashCard
            title="Skills"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSuggestSkills}
                disabled={isGeneratingSkills}
                className="text-primary hover:text-primary/80"
              >
                {isGeneratingSkills ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Suggest
              </Button>
            }
          >
            <Input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Comma separated"
            />
          </DashCard>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-24 lg:self-start print:static print:w-full">
          <div className="print:hidden">
            <DashCard title="Live Preview">
              <ResumePreview
                name={name}
                title={title}
                email={email}
                phone={phone}
                summary={summary}
                skills={skills}
                experiences={experiences}
              />
            </DashCard>
          </div>
          <div className="hidden print:block bg-white text-black p-8">
            <ResumePreview
              name={name}
              title={title}
              email={email}
              phone={phone}
              summary={summary}
              skills={skills}
              experiences={experiences}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

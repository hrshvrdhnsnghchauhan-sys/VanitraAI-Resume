import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Wand2, Loader2, Sparkles, Copy, FileText } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getAIProvider } from "@/ai/core";
import { useAuth } from "@/lib/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { DEMO_RESUME } from "@/lib/demo-resume";

type Section = {
  key: string;
  label: string;
  before: string;
  after: string;
};

export const Route = createFileRoute("/dashboard/optimizer")({
  component: OptimizerPage,
});

function OptimizerPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [hasResume, setHasResume] = useState(true);
  const [optimized, setOptimized] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchResume = async () => {
      try {
        if (db) {
          const resumeRef = doc(db, "resumes", user.uid);
          const snap = await getDoc(resumeRef);
          if (snap.exists()) {
            const data = snap.data();
            setHasResume(true);
            setSections([
              { key: "summary", label: "Summary", before: data.summary || "", after: "" },
              {
                key: "experience",
                label: "Experience",
                before: JSON.stringify(data.experiences || data.experience || []) || "",
                after: "",
              },
              { key: "skills", label: "Skills", before: data.skills || "", after: "" },
            ]);
            return;
          }
        }
        setHasResume(true);
        setSections([
          { key: "summary", label: "Summary", before: DEMO_RESUME.summary, after: "" },
          {
            key: "experience",
            label: "Experience",
            before: JSON.stringify(DEMO_RESUME.experiences),
            after: "",
          },
          { key: "skills", label: "Skills", before: DEMO_RESUME.skills, after: "" },
        ]);
      } catch (err) {
        console.warn("Failed to load resume, using demo fallback:", err);
        setHasResume(true);
        setSections([
          { key: "summary", label: "Summary", before: DEMO_RESUME.summary, after: "" },
          {
            key: "experience",
            label: "Experience",
            before: JSON.stringify(DEMO_RESUME.experiences),
            after: "",
          },
          { key: "skills", label: "Skills", before: DEMO_RESUME.skills, after: "" },
        ]);
      } finally {
        setFetching(false);
      }
    };
    fetchResume();
  }, [user]);

  const run = async () => {
    setLoading(true);
    try {
      const ai = getAIProvider();

      const newSections = await Promise.all(
        sections.map(async (s) => {
          if (!s.before) return { ...s, after: "Nothing to optimize." };
          try {
            const result = await ai.rewriteResume(s.before);
            return {
              ...s,
              after: result.rewrittenText,
            };
          } catch (e) {
            return {
              ...s,
              after: "Failed to optimize this section.",
            };
          }
        }),
      );

      setSections(newSections);
      setOptimized(true);
      toast.success("Resume optimized with AI");
    } catch (error) {
      toast.error("Failed to optimize resume");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Resume Optimizer"
        description="Let AI rewrite your resume into a stronger, ATS-friendly version."
        action={
          <Button variant="hero" onClick={run} disabled={loading || !hasResume || fetching}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {optimized ? "Re-optimize" : "Optimize with AI"}
          </Button>
        }
      />

      {fetching && (
        <DashCard>
          <div className="flex flex-col items-center py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading your resume…</p>
          </div>
        </DashCard>
      )}

      {!fetching && !hasResume && (
        <DashCard>
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-lg">No Resume Found</h3>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              You need to build your resume before optimizing it.
            </p>
            <Button asChild>
              <Link to="/dashboard/builder">Build Resume</Link>
            </Button>
          </div>
        </DashCard>
      )}

      {!fetching && hasResume && !optimized && !loading && (
        <DashCard>
          <div className="flex flex-col items-center py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
              <Sparkles className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-semibold">Ready to level up your resume?</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Our AI rewrites your summary, experience, projects and skills with quantified impact
              and relevant keywords.
            </p>
            <Button variant="hero" className="mt-5" onClick={run}>
              <Wand2 className="h-4 w-4" /> Optimize my resume
            </Button>
          </div>
        </DashCard>
      )}

      {loading && (
        <DashCard>
          <div className="flex flex-col items-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Rewriting your resume…</p>
          </div>
        </DashCard>
      )}

      {optimized && (
        <Tabs defaultValue="summary">
          <TabsList>
            {sections.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {sections.map((s) => (
            <TabsContent key={s.key} value={s.key}>
              <div className="grid gap-6 lg:grid-cols-2">
                <DashCard title="Original">
                  <Textarea
                    readOnly
                    value={s.before}
                    className="min-h-40 resize-none bg-muted/40"
                  />
                </DashCard>
                <DashCard
                  title="AI Optimized"
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(s.after);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  }
                >
                  <Textarea
                    readOnly
                    value={s.after}
                    className="min-h-40 resize-none border-primary/30 bg-accent/30"
                  />
                </DashCard>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Youtube,
  GraduationCap,
  BookOpen,
  FileCode,
  ExternalLink,
  CircleDot,
  Loader2,
  FileText,
  Sparkles,
} from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAIProvider, type CareerRoadmapResult } from "@/ai/core";
import { useAuth } from "@/lib/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/dashboard/roadmap")({
  component: RoadmapPage,
});

const platformIcon: Record<string, typeof Youtube> = {
  YouTube: Youtube,
  Coursera: GraduationCap,
  Udemy: GraduationCap,
  FreeCodeCamp: FileCode,
  Documentation: BookOpen,
};

function RoadmapPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<CareerRoadmapResult | null>(null);
  const [targetRole, setTargetRole] = useState("Principal Systems Architect");
  const [resumeText, setResumeText] = useState("");
  const [hasResume, setHasResume] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchResume = async () => {
      try {
        if (db) {
          const resumeRef = doc(db, "resumes", user.uid);
          const snap = await getDoc(resumeRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.title) setTargetRole(data.title);
            setResumeText(
              `Skills: ${data.skills}\nSummary: ${data.summary}\nExperience: ${JSON.stringify(data.experiences || data.experience || [])}\nEducation: ${JSON.stringify(data.education || [])}`,
            );
            return;
          }
        }
        setResumeText(getDemoResumeText());
        setHasResume(true);
      } catch (error) {
        console.warn("Failed to load resume data, using demo fallback:", error);
        setResumeText(getDemoResumeText());
        setHasResume(true);
      }
    };
    fetchResume();
  }, [user]);

  const generateRoadmap = async () => {
    if (!resumeText) return;
    setLoading(true);
    setRoadmap(null);
    try {
      const ai = getAIProvider();
      const res = await ai.generateCareerRoadmap(resumeText, targetRole);
      setRoadmap(res);
    } catch (error) {
      toast.error("Failed to generate career roadmap");
    } finally {
      setLoading(false);
    }
  };

  // Run automatically on first valid load
  useEffect(() => {
    if (resumeText && initialLoad) {
      setInitialLoad(false);
      generateRoadmap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot generation guarded by initialLoad flag
  }, [resumeText, initialLoad]);

  return (
    <>
      <PageHeader
        title="AI Learning Roadmap"
        description="A personalized plan to close your skill gaps."
        action={
          <div className="flex items-center gap-3">
            <Input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Target Role (e.g. Architect)"
              className="w-48 bg-background"
            />
            <Button variant="hero" onClick={generateRoadmap} disabled={loading || !hasResume}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate
            </Button>
          </div>
        }
      />

      {!hasResume && !loading && (
        <DashCard>
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-lg">No Resume Found</h3>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              You need to build your resume before generating a roadmap.
            </p>
            <Button asChild>
              <Link to="/dashboard/builder">Build Resume</Link>
            </Button>
          </div>
        </DashCard>
      )}

      {loading && (
        <DashCard>
          <div className="flex flex-col items-center py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h3 className="mt-4 font-semibold">Generating your roadmap…</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Analyzing your resume against {targetRole} requirements.
            </p>
          </div>
        </DashCard>
      )}

      {roadmap && !loading && (
        <div className="relative space-y-6 before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-1rem)] before:w-0.5 before:bg-border">
          {roadmap.weeklyPlan.map((w, i) => (
            <div key={w.week} className="relative pl-14">
              <span className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground shadow-elegant">
                {i + 1}
              </span>
              <DashCard>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Week {w.week}
                    </span>
                    <h3 className="text-lg font-semibold">{w.focus}</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Tasks</p>
                    <ul className="space-y-2">
                      {w.tasks.map((t) => (
                        <li key={t} className="flex gap-2 text-sm">
                          <CircleDot className="h-4 w-4 shrink-0 text-primary" /> {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Recommended resources
                    </p>
                    <ul className="space-y-2">
                      {roadmap.resources.map((r, idx) => {
                        const Icon = platformIcon[r.platform] ?? BookOpen;
                        return (
                          <li key={idx}>
                            <a
                              href={r.url || "#"}
                              className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm transition-colors hover:border-primary/40"
                            >
                              <Icon className="h-4 w-4 text-primary" />
                              <span className="flex-1">{r.title}</span>
                              <Badge variant="secondary">{r.platform}</Badge>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </DashCard>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

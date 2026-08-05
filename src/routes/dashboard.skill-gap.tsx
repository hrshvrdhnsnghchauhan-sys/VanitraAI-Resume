import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowRight, Loader2 } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { getAIProvider } from "@/ai/core";

export const Route = createFileRoute("/dashboard/skill-gap")({
  component: SkillGapPage,
});

const priorityColor: Record<string, "destructive" | "default" | "secondary"> = {
  High: "destructive",
  Medium: "default",
  Low: "secondary",
};

function SkillGapPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentSkills, setCurrentSkills] = useState<string[]>([]);
  const [missingSkills, setMissingSkills] = useState<
    { name: string; priority: string; progress: number }[]
  >([]);
  const [trendingSkills, setTrendingSkills] = useState<string[]>([
    "React",
    "AI/LLMs",
    "System Design",
    "AWS",
    "GraphQL",
  ]);
  const [skillRadar, setSkillRadar] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchSkillGap = async () => {
      setLoading(true);
      try {
        let skillsStr = DEMO_RESUME.skills;
        if (db) {
          try {
            const resumeRef = doc(db, "resumes", user.uid);
            const resumeSnap = await getDoc(resumeRef);
            if (resumeSnap.exists() && resumeSnap.data().skills) {
              skillsStr = resumeSnap.data().skills;
            }
          } catch (e) {}
        }
        setCurrentSkills(
          skillsStr
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
        );

        let data: any = null;
        if (db) {
          try {
            const analysisRef = doc(db, "analysis", user.uid);
            const analysisSnap = await getDoc(analysisRef);
            if (analysisSnap.exists() && analysisSnap.data().skillGap) {
              data = analysisSnap.data().skillGap;
            }
          } catch (e) {}
        }

        if (data) {
          setMissingSkills(data.missingSkills || []);
          setSkillRadar(data.skillRadar || []);
        } else if (skillsStr) {
          // Generate using AI
          const ai = getAIProvider();
          try {
            const result = await ai.analyzeSkillGap(skillsStr);
            setMissingSkills(result.missing || []);
            setSkillRadar(result.radar || []);
          } catch (e) {
            console.error("Failed to analyze skill gap", e);
          }
        }
      } catch (err) {
        console.error("Error fetching skill gap:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  return (
    <>
      <PageHeader
        title="Skill Gap Analysis"
        description="See where you stand against market demand."
        action={
          <Button variant="hero" asChild>
            <Link to="/dashboard/roadmap">
              Build roadmap <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <DashCard title="You vs. Market Demand">
              <div className="h-72">
                {skillRadar.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={skillRadar}>
                      <PolarGrid stroke="var(--color-border)" />
                      <PolarAngleAxis
                        dataKey="skill"
                        className="text-xs"
                        tick={{ fill: "var(--color-muted-foreground)" }}
                      />
                      <Radar
                        name="You"
                        dataKey="you"
                        stroke="var(--color-primary)"
                        fill="var(--color-primary)"
                        fillOpacity={0.4}
                      />
                      <Radar
                        name="Market"
                        dataKey="market"
                        stroke="var(--color-chart-4)"
                        fill="var(--color-chart-4)"
                        fillOpacity={0.2}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Add skills to your resume to generate radar.
                  </div>
                )}
              </div>
            </DashCard>

            <DashCard title="Missing Skills" description="Prioritized by market demand">
              <div className="space-y-4">
                {missingSkills.length > 0 ? (
                  missingSkills.map((s) => (
                    <div key={s.name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium">{s.name}</span>
                        <Badge variant={priorityColor[s.priority] || "secondary"}>
                          {s.priority}
                        </Badge>
                      </div>
                      <Progress value={s.progress} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {s.progress}% learning progress
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No missing skills identified yet.
                  </div>
                )}
              </div>
            </DashCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            <DashCard title="Your Current Skills">
              <div className="flex flex-wrap gap-2">
                {currentSkills.length > 0 ? (
                  currentSkills.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No skills added yet.</div>
                )}
              </div>
            </DashCard>
            <DashCard title="Trending Skills to Learn">
              <div className="flex flex-wrap gap-2">
                {trendingSkills.map((s) => (
                  <Badge key={s} className="bg-gradient-primary text-primary-foreground">
                    {s}
                  </Badge>
                ))}
              </div>
            </DashCard>
          </div>
        </>
      )}
    </>
  );
}

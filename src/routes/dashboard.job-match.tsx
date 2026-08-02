import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Target, Loader2, ThumbsUp, ThumbsDown, Lightbulb, FileText } from "lucide-react";
import { PageHeader, DashCard, ScoreRing } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getAIProvider, type JobMatchResult } from "@/ai/core";
import { useAuth } from "@/lib/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/dashboard/job-match")({
  component: JobMatchPage,
});

function JobMatchPage() {
  const { user } = useAuth();
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState<JobMatchResult | null>(null);

  useEffect(() => {
    if (!user?.uid || !db) return;
    const fetchResume = async () => {
      try {
        const resumeRef = doc(db, "resumes", user.uid);
        const snap = await getDoc(resumeRef);
        if (snap.exists()) {
          const data = snap.data();
          setResumeText(
            `Skills: ${data.skills}\nSummary: ${data.summary}\nExperience: ${JSON.stringify(data.experiences || data.experience || [])}\nEducation: ${JSON.stringify(data.education || [])}`,
          );
        }
      } catch (err) {
        console.error("Failed to load resume", err);
      }
    };
    fetchResume();
  }, [user]);

  const run = async () => {
    if (jd.trim().length < 30) {
      toast.error("Paste a longer job description to analyze");
      return;
    }
    if (!resumeText) {
      toast.error("Please build your resume first");
      return;
    }
    setLoading(true);
    try {
      const ai = getAIProvider();
      const res = await ai.matchJob(resumeText, jd);
      setResult(res);
      toast.success("Job match analyzed");
    } catch (error) {
      toast.error("Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Job Match" description="Compare your resume against a job description." />

      {!resumeText ? (
        <DashCard>
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-lg">No Resume Found</h3>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              You need to build your resume before matching it with jobs, or load a sample resume to
              test live.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link to="/dashboard/builder">Build Resume</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResumeText(`Senior Full Stack Engineer Resume
Skills: React, TypeScript, Node.js, GraphQL, AWS, Docker, CI/CD, Next.js, Tailwind CSS, PostgreSQL, System Architecture
Summary: Results-driven Senior Full Stack Engineer with 5+ years of experience architecting high-performance cloud applications and scaling microservices for 100,000+ users.
Experience: Led frontend and backend architecture, boosting performance by 40% and cutting latency. Spearheaded cloud migrations on AWS and containerized core applications using Docker and Kubernetes.`);
                  toast.success("Loaded sample Full-Stack Resume for testing!");
                }}
              >
                Use Sample Resume
              </Button>
            </div>
          </div>
        </DashCard>
      ) : (
        <>
          <DashCard title="Job Description">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">
                Paste target job description below:
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary"
                onClick={() => {
                  setJd(`We are seeking a Senior Full Stack Engineer to lead our core product team.
Responsibilities:
- Architect and develop scalable web applications using React, TypeScript, Node.js, and Next.js.
- Design resilient cloud infrastructure on AWS using Docker and Kubernetes.
- Collaborate with product and engineering teams to optimize system latency and UX.
Requirements:
- 4+ years of full-stack engineering experience with modern JavaScript/TypeScript.
- Experience with AWS, Docker, and CI/CD pipelines.
- Familiarity with agile workflows and mentoring junior engineers.`);
                  toast.success("Loaded sample Job Description!");
                }}
              >
                + Load Sample Job Description
              </Button>
            </div>
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              className="min-h-40"
            />
            <Button variant="hero" className="mt-4" onClick={run} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Target className="h-4 w-4" />
              )}
              Analyze match
            </Button>
          </DashCard>

          {result && (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <DashCard title="Job Match" className="flex flex-col items-center">
                  <ScoreRing value={result.matchPercentage} label="match" />
                </DashCard>
                <DashCard title="Selection Probability" className="flex flex-col items-center">
                  <ScoreRing
                    value={
                      result.selectionProbability === "High"
                        ? 90
                        : result.selectionProbability === "Medium"
                          ? 60
                          : 30
                    }
                    label={result.selectionProbability.toLowerCase()}
                  />
                </DashCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <DashCard title="Strengths">
                  <ul className="space-y-2.5">
                    <li className="flex gap-2.5 text-sm">
                      <ThumbsUp className="h-4 w-4 shrink-0 text-success" /> Skill Match:{" "}
                      {result.skillMatch}%
                    </li>
                    <li className="flex gap-2.5 text-sm">
                      <ThumbsUp className="h-4 w-4 shrink-0 text-success" /> Experience Match:{" "}
                      {result.experienceMatch}%
                    </li>
                    <li className="flex gap-2.5 text-sm">
                      <ThumbsUp className="h-4 w-4 shrink-0 text-success" /> Education Match:{" "}
                      {result.educationMatch}%
                    </li>
                  </ul>
                </DashCard>
                <DashCard title="Missing Skills">
                  <div className="flex flex-wrap gap-2">
                    {result.missingSkills.map((s) => (
                      <Badge key={s} variant="destructive">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </DashCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <DashCard title="Missing Keywords">
                  <div className="flex flex-wrap gap-2">
                    {result.missingKeywords.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </DashCard>
                <DashCard title="Recommended Improvements">
                  <ul className="space-y-3">
                    {result.recommendations.map((s) => (
                      <li key={s} className="flex gap-2.5 text-sm">
                        <Lightbulb className="h-4 w-4 shrink-0 text-warning" /> {s}
                      </li>
                    ))}
                  </ul>
                </DashCard>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

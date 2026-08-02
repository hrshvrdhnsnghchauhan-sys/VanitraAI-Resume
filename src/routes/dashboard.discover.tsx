import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  DollarSign,
  Building,
  ExternalLink,
  Sparkles,
  FileText,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getAIProvider } from "@/ai/core";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/dashboard/discover")({
  component: DiscoverPage,
});

interface RecommendedJob {
  job: any;
  matchPercentage: number;
  missingSkills: string[];
}

function DiscoverPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasResume, setHasResume] = useState(true);
  const [recommendations, setRecommendations] = useState<RecommendedJob[]>([]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    const discoverJobs = async () => {
      try {
        const resumeRef = doc(db, "resumes", user.uid);
        const snap = await getDoc(resumeRef);
        if (!snap.exists()) {
          setHasResume(false);
          setLoading(false);
          return;
        }

        const data = snap.data();
        const resumeText = `Skills: ${data.skills}\nSummary: ${data.summary}\nExperience: ${JSON.stringify(data.experiences || data.experience || [])}\nEducation: ${JSON.stringify(data.education || [])}`;

        const jobsSnap = await getDocs(collection(db, "jobs"));
        const jobs = jobsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

        const ai = getAIProvider();
        // Cap the number of concurrent AI calls so a large jobs collection can't
        // blow past Gemini rate limits or rack up runaway cost.
        const MAX_JOBS = 20;
        const CONCURRENCY = 4;
        const limited = jobs.slice(0, MAX_JOBS);
        const results: RecommendedJob[] = [];
        let cursor = 0;
        const worker = async () => {
          while (cursor < limited.length) {
            const job = limited[cursor++];
            try {
              const match = await ai.matchJob(resumeText, job.description || "");
              results.push({
                job,
                matchPercentage: match.matchPercentage,
                missingSkills: match.missingSkills,
              });
            } catch {
              // Skip jobs that fail to match; never block the whole discovery.
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, limited.length) }, () => worker()),
        );

        // Sort by highest match
        results.sort((a, b) => b.matchPercentage - a.matchPercentage);
        setRecommendations(results);
      } catch (error) {
        toast.error("Failed to discover jobs");
      } finally {
        setLoading(false);
      }
    };
    discoverJobs();
  }, [user]);

  return (
    <>
      <PageHeader
        title="Smart Job Discovery"
        description="AI-recommended jobs based on your resume and profile."
      />

      {!hasResume && !loading && (
        <DashCard>
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-lg">No Resume Found</h3>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              You need to build your resume before discovering jobs.
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
            <h3 className="mt-4 font-semibold">Discovering best matches…</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Analyzing jobs against your profile.
            </p>
          </div>
        </DashCard>
      )}

      {!loading && hasResume && (
        <div className="grid gap-6">
          {recommendations.length > 0 ? (
            recommendations.map((rec) => (
              <DashCard key={rec.job.id}>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-bold">{rec.job.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Building className="h-4 w-4" /> {rec.job.company || "Company"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" /> {rec.job.location || "Remote"}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" /> {rec.job.salary || "Competitive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary hover:bg-primary/20 text-sm px-3 py-1"
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {rec.matchPercentage}% Match
                    </Badge>
                    <Button asChild size="sm">
                      <a href={rec.job.applyLink || "#"}>
                        Apply Now <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>

                {rec.missingSkills && rec.missingSkills.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <span className="text-sm text-muted-foreground mb-2 block">
                      Skills to improve:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {rec.missingSkills.map((skill) => (
                        <Badge
                          key={skill}
                          variant="outline"
                          className="text-destructive border-destructive/30 bg-destructive/5"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </DashCard>
            ))
          ) : (
            <DashCard>
              <div className="p-6 text-center text-muted-foreground">
                No jobs posted yet. Check back later!
              </div>
            </DashCard>
          )}
        </div>
      )}
    </>
  );
}

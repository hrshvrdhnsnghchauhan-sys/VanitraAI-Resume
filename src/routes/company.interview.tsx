import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles, Loader2, Copy } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getAIProvider } from "@/ai/core";
import { useAuth } from "@/lib/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/company/interview")({
  component: InterviewPage,
});

const defaultQuestionSets: Record<string, string[]> = {
  Technical: [
    "Explain the virtual DOM and how React reconciliation works.",
    "How would you optimize the performance of a large React list?",
    "Describe the difference between server and client components.",
    "How do you handle type-safety across an API boundary in TypeScript?",
  ],
  Behavioral: [
    "Tell me about a time you disagreed with a teammate on a technical decision.",
    "Describe a project you're most proud of and your specific contribution.",
    "How do you prioritize work when everything feels urgent?",
  ],
  "Project-Based": [
    "Walk me through the architecture of your analytics dashboard project.",
    "What trade-offs did you make in your design system project?",
    "How did you measure the 40% load-time improvement you mentioned?",
  ],
  Scenario: [
    "A production page is slow for 10% of users. How do you investigate?",
    "You must ship a feature in half the time. What do you cut and why?",
  ],
  Coding: [
    "Implement a debounce function in TypeScript.",
    "Write a function to flatten a deeply nested array.",
    "Given a job description, extract the top 5 keywords programmatically.",
  ],
};

function InterviewPage() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidate, setCandidate] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [questionSets, setQuestionSets] = useState(defaultQuestionSets);

  useEffect(() => {
    if (!user?.uid || !db) return;
    const fetchCandidates = async () => {
      try {
        const appsQuery = query(collection(db, "applications"), where("companyId", "==", user.uid));
        const appsSnap = await getDocs(appsQuery);
        const apps = appsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
        setCandidates(apps);
        if (apps.length > 0) {
          setCandidate(apps[0].candidateName || "Unknown");
        }
      } catch (err) {
        console.error("Error fetching applicants:", err);
      }
    };
    fetchCandidates();
  }, [user]);

  const generate = async () => {
    if (!candidate) {
      toast.error("Please select a candidate");
      return;
    }
    const cData = candidates.find((c) => (c.candidateName || c.id) === candidate);
    if (!cData) {
      toast.error("Candidate data not found");
      return;
    }

    setLoading(true);
    try {
      const ai = getAIProvider();
      // Ensure we have some text to analyze
      const resumeContext =
        cData.resumeText || JSON.stringify(cData.resumeData || cData) || "Resume not available";
      const jobTitle = cData.jobTitle || "Software Engineer";

      const res = await ai.getInterviewQuestions(resumeContext, jobTitle);

      setQuestionSets(res as any);
      setGenerated(true);
      toast.success("Interview questions generated");
    } catch (error) {
      console.error("Interview gen error:", error);
      toast.error("Failed to generate questions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI Interview Generator"
        description="Questions tailored to each candidate's resume."
      />

      <DashCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Candidate</label>
            <Select value={candidate} onValueChange={setCandidate}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    candidates.length === 0 ? "No candidates found" : "Select a candidate"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.candidateName || c.id}>
                    {c.candidateName || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="hero" onClick={generate} disabled={loading || candidates.length === 0}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate questions
          </Button>
        </div>
      </DashCard>

      {generated && (
        <Tabs defaultValue={Object.keys(questionSets)[0]}>
          <TabsList className="flex-wrap">
            {Object.keys(questionSets).map((k) => (
              <TabsTrigger key={k} value={k}>
                {k}
              </TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(questionSets).map(([k, qs]) => (
            <TabsContent key={k} value={k}>
              <DashCard title={`${k} Questions`}>
                <ol className="space-y-3">
                  {(qs as string[]).map((q, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                        {i + 1}
                      </span>
                      <span className="flex-1">{q}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(q);
                          toast.success("Copied");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              </DashCard>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

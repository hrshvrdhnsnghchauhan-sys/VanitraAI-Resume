import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Search,
  Loader2,
  Sparkles,
  Scale,
  Trophy,
  Eye,
  UserCheck,
  CalendarClock,
  FileBadge,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  FileText,
  Mail,
  Briefcase,
} from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { cn, recColor } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { getAIProvider, type CandidateComparisonResult } from "@/ai/core";
import { toast } from "sonner";

export const Route = createFileRoute("/company/applicants")({
  component: ApplicantsPage,
});

type SortKey = "overall" | "ats" | "resume" | "jobMatch";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  Interview: "default",
  Assessment: "default",
  "HR Round": "default",
  Offer: "default",
  Accepted: "default",
  Applied: "secondary",
  Screening: "secondary",
  Rejected: "destructive",
  Withdrawn: "destructive",
};

function ApplicantsPage() {
  const { user } = useAuth();
  const [queryInput, setQueryInput] = useState("");
  const [rec, setRec] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Comparison State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [comparisonData, setComparisonData] = useState<CandidateComparisonResult | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  // Profile viewer + status action dialog
  const [profile, setProfile] = useState<any | null>(null);
  const [actionCandidate, setActionCandidate] = useState<any | null>(null);
  const [nextStatus, setNextStatus] = useState("Screening");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    const fetchData = async () => {
      try {
        let loaded: any[] = [];
        if (db) {
          try {
            const appsQuery = query(collection(db, "applications"), where("companyId", "==", user.uid));
            const appsSnap = await getDocs(appsQuery);
            loaded = appsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          } catch (e) {
            console.warn("Firestore applicants error, using fallback:", e);
          }
        }
        if (loaded.length === 0) {
          loaded = getCompanyDemoApplicants(user.uid);
        }
        setCandidates(loaded);
      } catch (err) {
        console.error("Error fetching applicants:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const rows = useMemo(() => {
    return candidates
      .filter(
        (c) =>
          (rec === "all" || c.rec === rec) &&
          (c.candidateName || "").toLowerCase().includes(queryInput.toLowerCase()),
      )
      .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  }, [candidates, queryInput, rec, sortKey]);

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      if (selectedIds.length >= 2)
        return toast.error("You can only compare 2 candidates at a time.");
      setSelectedIds([...selectedIds, id]);
    }
  };

  const runComparison = async () => {
    if (selectedIds.length !== 2) return;
    const cA = candidates.find((c) => c.id === selectedIds[0]);
    const cB = candidates.find((c) => c.id === selectedIds[1]);
    if (!cA || !cB) return;

    setComparing(true);
    setCompareDialogOpen(true);
    setComparisonData(null);
    try {
      const ai = getAIProvider();
      const res = await ai.compareCandidates(cA, cB);
      setComparisonData(res);
      setComparing(false);
    } catch (err) {
      toast.error("Comparison failed. Please try again.");
      setComparing(false);
    }
  };

  const setStatus = async (candidate: any, status: string, extra: Record<string, any> = {}) => {
    if (!candidate?.id) return;
    try {
      if (db) {
        try {
          await updateDoc(doc(db, "applications", candidate.id), {
            status,
            updatedAt: serverTimestamp(),
            ...extra,
          });
        } catch (dbErr) {
          console.warn("Firestore updateDoc skipped, updating locally:", dbErr);
        }
      }
      const updated = candidates.map((c) =>
        c.id === candidate.id ? { ...c, status, ...extra } : c
      );
      setCandidates(updated);
      if (user?.uid) {
        saveCompanyDemoApplicants(user.uid, updated);
      }
      toast.success(`Marked as ${status}`);
      setActionCandidate(null);
      setProfile((p: any) => (p && p.id === candidate.id ? { ...p, status, ...extra } : p));
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  const openInterviewDialog = (candidate: any) => {
    setActionCandidate(candidate);
    setNextStatus("Interview");
    setInterviewDate("");
    setInterviewNotes("");
  };

  const scheduleInterview = () => {
    if (!actionCandidate) return;
    if (!interviewDate) {
      toast.error("Pick an interview date");
      return;
    }
    setStatus(actionCandidate, "Interview", {
      interviewDate,
      interviewNotes: interviewNotes.trim(),
      interviewScheduledAt: serverTimestamp(),
    });
  };

  return (
    <>
      <PageHeader title="Applicants" description="AI-ranked candidates for your open roles." />

      {selectedIds.length === 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur-lg border border-border shadow-xl rounded-full px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium">2 candidates selected</span>
          <Button variant="hero" size="sm" onClick={runComparison}>
            <Scale className="h-4 w-4 mr-2" /> Compare Profiles
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Cancel
          </Button>
        </div>
      )}

      <DashCard>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search candidates…"
              className="pl-9"
            />
          </div>
          <Select value={rec} onValueChange={setRec}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Recommendation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All recommendations</SelectItem>
              <SelectItem value="Strongly Recommended">Strongly Recommended</SelectItem>
              <SelectItem value="Recommended">Recommended</SelectItem>
              <SelectItem value="Average Match">Average Match</SelectItem>
              <SelectItem value="Not Recommended">Not Recommended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overall">Overall Match</SelectItem>
              <SelectItem value="ats">ATS Score</SelectItem>
              <SelectItem value="resume">Resume Score</SelectItem>
              <SelectItem value="jobMatch">Job Match</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <span className="sr-only">Select</span>
                </TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ATS</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead>Job Match</TableHead>
                <TableHead className="min-w-32">
                  <span className="inline-flex items-center gap-1">
                    Overall <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead>Recommendation</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center p-8 text-muted-foreground">
                    No applicants found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedIds.includes(c.id)}
                        onCheckedChange={() => toggleSelection(c.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                          {c.candidateName
                            ?.split(" ")
                            .map((n: string) => n[0])
                            .join("") || "?"}
                        </span>
                        <span className="font-medium">{c.candidateName || "Candidate"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{c.jobTitle || c.role || "Any Role"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.status] || "secondary"}>
                        {c.status || "Applied"}
                      </Badge>
                      {c.interviewDate && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(c.interviewDate).toLocaleDateString()}{" "}
                          {new Date(c.interviewDate).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{c.ats || 0}</TableCell>
                    <TableCell>{c.resume || 0}</TableCell>
                    <TableCell>{c.jobMatch || 0}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={c.overall || 0} className="w-16" />
                        <span className="text-sm font-semibold">{c.overall || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn("text-sm font-medium", recColor(c.rec || "Average Match"))}
                      >
                        {c.rec || "Average Match"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => setProfile(c)}>
                            <Eye className="h-4 w-4 mr-2" /> View Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setStatus(c, "Screening")}>
                            <UserCheck className="h-4 w-4 mr-2" /> Shortlist / Screening
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openInterviewDialog(c)}>
                            <CalendarClock className="h-4 w-4 mr-2" /> Schedule Interview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus(c, "Assessment")}>
                            <FileBadge className="h-4 w-4 mr-2" /> Send Assessment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus(c, "HR Round")}>
                            <Briefcase className="h-4 w-4 mr-2" /> HR Round
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus(c, "Offer")}>
                            <FileText className="h-4 w-4 mr-2" /> Make Offer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setStatus(c, "Accepted", { hiredAt: serverTimestamp() })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Hire
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setStatus(c, "Rejected")}
                          >
                            <XCircle className="h-4 w-4 mr-2" /> Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DashCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Strongly Recommended",
            count: candidates.filter((c) => c.rec === "Strongly Recommended").length,
          },
          { label: "Recommended", count: candidates.filter((c) => c.rec === "Recommended").length },
          {
            label: "In Interview",
            count: candidates.filter((c) =>
              ["Interview", "Assessment", "HR Round"].includes(c.status),
            ).length,
          },
          { label: "Hired", count: candidates.filter((c) => c.status === "Accepted").length },
        ].map((s) => (
          <DashCard key={s.label} className="text-center">
            <div className={cn("text-3xl font-bold", recColor(s.label))}>{s.count}</div>
            <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
          </DashCard>
        ))}
      </div>

      {/* Candidate profile / resume viewer */}
      <Dialog open={!!profile} onOpenChange={(v) => !v && setProfile(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          {profile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                    {profile.candidateName
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("") || "?"}
                  </span>
                  <span>
                    <span className="block">{profile.candidateName || "Candidate"}</span>
                    <span className="block text-sm font-normal text-muted-foreground">
                      {profile.jobTitle || profile.role || "Applicant"}
                    </span>
                  </span>
                </DialogTitle>
                <DialogDescription>
                  {profile.candidateEmail && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {profile.candidateEmail}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border p-3 text-center">
                  <div className="text-xl font-bold text-primary">{profile.overall || 0}%</div>
                  <div className="text-xs text-muted-foreground">Overall match</div>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <div className="text-xl font-bold">{profile.ats || 0}</div>
                  <div className="text-xs text-muted-foreground">ATS score</div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Resume score", value: profile.resume || 0 },
                  { label: "Job match", value: profile.jobMatch || 0 },
                  { label: "Skill match", value: profile.skill || 0 },
                  { label: "Experience match", value: profile.exp || 0 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={row.value} className="w-28" />
                      <span className="w-8 text-right text-sm font-semibold">{row.value}%</span>
                    </div>
                  </div>
                ))}
              </div>

              {profile.resumeSummary && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Summary</h4>
                  <p className="text-sm text-muted-foreground">{profile.resumeSummary}</p>
                </div>
              )}

              {profile.resumeUrl &&
                (profile.resumeUrl.startsWith("http://") ||
                  profile.resumeUrl.startsWith("https://")) && (
                  <Button variant="outline" asChild className="w-full">
                    <a href={profile.resumeUrl} target="_blank" rel="noreferrer">
                      <FileText className="mr-2 h-4 w-4" /> Open Resume
                    </a>
                  </Button>
                )}

              <DialogFooter className="sm:justify-between">
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setStatus(profile, "Rejected")}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openInterviewDialog(profile)}>
                    <CalendarClock className="mr-2 h-4 w-4" /> Interview
                  </Button>
                  <Button variant="hero" onClick={() => setStatus(profile, "Offer")}>
                    <FileText className="mr-2 h-4 w-4" /> Offer
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Interview scheduling */}
      <Dialog open={!!actionCandidate} onOpenChange={(v) => !v && setActionCandidate(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>
              {actionCandidate?.candidateName} ·{" "}
              {actionCandidate?.jobTitle || actionCandidate?.role}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes for the candidate</Label>
              <Input
                placeholder="e.g. Video call · 45 min · panel interview"
                value={interviewNotes}
                onChange={(e) => setInterviewNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionCandidate(null)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={scheduleInterview}>
              <CalendarClock className="mr-2 h-4 w-4" /> Confirm Interview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI comparison dialog (existing) */}
      <Dialog
        open={compareDialogOpen}
        onOpenChange={(v) => {
          setCompareDialogOpen(v);
          if (!v) setSelectedIds([]);
        }}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Candidate Comparison
            </DialogTitle>
            <DialogDescription>
              Detailed side-by-side analysis of the selected candidates.
            </DialogDescription>
          </DialogHeader>

          {comparing || !comparisonData ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Analyzing candidates against market standards...</p>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-border text-center">
                <Trophy className="h-10 w-10 text-yellow-500 mb-3" />
                <h3 className="text-2xl font-bold">{comparisonData.winner}</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-[600px] leading-relaxed">
                  {comparisonData.reasoning}
                </p>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[150px]">Category</TableHead>
                      <TableHead className="w-1/2">
                        Candidate A (
                        {candidates.find((c) => c.id === selectedIds[0])?.candidateName})
                      </TableHead>
                      <TableHead className="w-1/2">
                        Candidate B (
                        {candidates.find((c) => c.id === selectedIds[1])?.candidateName})
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.comparison.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell className="text-sm">{row.candidateA}</TableCell>
                        <TableCell className="text-sm">{row.candidateB}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

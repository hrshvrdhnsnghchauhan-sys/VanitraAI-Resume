import { useEffect, useMemo, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  DollarSign,
  Building,
  ExternalLink,
  Loader2,
  Bookmark,
  BookmarkCheck,
  Share2,
  Briefcase,
  Clock,
  Filter,
  X,
  Sparkles,
  FileText,
  Eye,
} from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import {
  getJobs,
  computeJobMatch,
  jobSalaryUsd,
  type Job,
  type WorkType,
  type ExperienceLevel,
  type JobType,
} from "@/lib/jobs";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/dashboard/discover")({
  component: DiscoverPage,
});

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  internship: "Internship",
  fresher: "Fresher",
  junior: "Junior",
  mid: "Mid-Level",
  senior: "Senior",
};

const WORKTYPE_LABELS: Record<WorkType, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

const TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Recently";
  const diff = Date.now() - then;
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function Logo({ job, size = 44 }: { job: Job; size?: number }) {
  const initials = (job.company || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (job.companyLogo) {
    return (
      <img
        src={job.companyLogo}
        alt={job.company}
        className="rounded-xl border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-xl bg-gradient-primary font-bold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}

function DiscoverPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [hasResume, setHasResume] = useState(true);

  // Search + filters
  const [queryInput, setQueryInput] = useState("");
  const [workType, setWorkType] = useState<"all" | WorkType>("all");
  const [experience, setExperience] = useState<"all" | ExperienceLevel>("all");
  const [jobType, setJobType] = useState<"all" | JobType>("all");
  const [minSalary, setMinSalary] = useState<"all" | number>("all");

  // Saved + applied (synced from Firestore)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  // Company profile dialog
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getJobs();
      setJobs(list);
    } catch (err) {
      console.error("Failed to load jobs:", err);
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Load resume skills for match scoring (owner-scoped read per Firestore rules)
  useEffect(() => {
    if (!user?.uid || !db) return;
    const loadResume = async () => {
      try {
        const snap = await getDoc(doc(db, "resumes", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setResumeSkills(Array.isArray(data.skills) ? data.skills : []);
          setHasResume(true);
        } else {
          setResumeSkills([]);
          setHasResume(false);
        }
      } catch {
        setResumeSkills([]);
        setHasResume(false);
      }
    };
    loadResume();
  }, [user?.uid]);

  // Realtime saved + applied sets
  useEffect(() => {
    if (!user?.uid || !db) return;
    const unsubSaved = onSnapshot(
      query(collection(db, "savedJobs"), where("userId", "==", user.uid)),
      (snap) => setSavedIds(new Set(snap.docs.map((d) => d.data().jobId))),
      (err) => console.warn("savedJobs snapshot skipped:", err),
    );
    const unsubApplied = onSnapshot(
      query(collection(db, "applications"), where("userId", "==", user.uid)),
      (snap) => setAppliedIds(new Set(snap.docs.map((d) => d.data().jobId))),
      (err) => console.warn("applications snapshot skipped:", err),
    );
    return () => {
      unsubSaved();
      unsubApplied();
    };
  }, [user?.uid]);

  const matches = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of jobs) map.set(job.id, computeJobMatch(job, resumeSkills));
    return map;
  }, [jobs, resumeSkills]);

  const filtered = useMemo(() => {
    const q = queryInput.trim().toLowerCase();
    return jobs
      .filter((job) => {
        if (q) {
          const haystack = [job.title, job.company, job.location, ...(job.skills || [])]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (workType !== "all" && job.workType !== workType) return false;
        if (experience !== "all" && job.experienceLevel !== experience) return false;
        if (jobType !== "all" && job.type !== jobType) return false;
        if (minSalary !== "all" && jobSalaryUsd(job) < minSalary) return false;
        return true;
      })
      .sort((a, b) => (matches.get(b.id) || 0) - (matches.get(a.id) || 0));
  }, [jobs, queryInput, workType, experience, jobType, minSalary, matches]);

  const hasActiveFilters =
    workType !== "all" || experience !== "all" || jobType !== "all" || minSalary !== "all";

  const clearFilters = () => {
    setWorkType("all");
    setExperience("all");
    setJobType("all");
    setMinSalary("all");
    setQueryInput("");
  };

  const toggleSave = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return toast.error("Log in to save jobs");
    if (!db) return toast.error("Firestore is not configured");
    const isSaved = savedIds.has(job.id);
    try {
      if (isSaved) {
        const snap = await getDocs(
          query(
            collection(db, "savedJobs"),
            where("userId", "==", user.uid),
            where("jobId", "==", job.id),
          ),
        );
        await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "savedJobs", d.id))));
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
        toast.success("Removed from saved jobs");
      } else {
        await addDoc(collection(db, "savedJobs"), {
          userId: user.uid,
          jobId: job.id,
          title: job.title,
          company: job.company,
          savedAt: serverTimestamp(),
        });
        setSavedIds((prev) => new Set(prev).add(job.id));
        toast.success("Job saved");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update saved jobs");
    }
  };

  const shareJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/dashboard/discover?job=${job.id}`;
    const text = `${job.title} at ${job.company} — ${job.salary}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      // User dismissed share sheet — no-op
    }
  };

  const applyToJob = async (job: Job) => {
    if (!user?.uid) return toast.error("Log in to apply");
    if (user?.role !== "candidate") return toast.error("Only candidate accounts can apply");
    if (!db) return toast.error("Firestore is not configured");
    if (appliedIds.has(job.id)) {
      toast.info("You already applied to this job");
      return;
    }
    try {
      await addDoc(collection(db, "applications"), {
        userId: user.uid,
        jobId: job.id,
        companyId: job.companyId || "",
        role: job.title,
        company: job.company,
        match: matches.get(job.id) || 0,
        status: "Applied",
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
      setAppliedIds((prev) => new Set(prev).add(job.id));
      toast.success(`Applied to ${job.title} at ${job.company}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit application");
    }
  };

  return (
    <>
      <PageHeader
        title="Discover Jobs"
        description="Search and filter opportunities from companies on the platform."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/applications">
              <Briefcase className="mr-2 h-4 w-4" /> My Applications
            </Link>
          </Button>
        }
      />

      {!hasResume && (
        <DashCard className="mb-6">
          <div className="flex flex-col items-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-lg">Build your resume for match scores</h3>
            <p className="mt-1 mb-4 text-sm text-muted-foreground max-w-md">
              Jobs are scored against your resume skills. Build or import a resume to see match
              percentages and unlock AI recommendations.
            </p>
            <Button asChild size="sm">
              <Link to="/dashboard/builder">Build Resume</Link>
            </Button>
          </div>
        </DashCard>
      )}

      <DashCard className="mb-6">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search by title, company, location, or skill…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filters:
            </span>
            <Select value={workType} onValueChange={(v) => setWorkType(v as any)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Work mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="onsite">On-site</SelectItem>
              </SelectContent>
            </Select>
            <Select value={experience} onValueChange={(v) => setExperience(v as any)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Experience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
                <SelectItem value="fresher">Fresher</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid-Level</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
              </SelectContent>
            </Select>
            <Select value={jobType} onValueChange={(v) => setJobType(v as any)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Job type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(minSalary)}
              onValueChange={(v) => setMinSalary(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Min salary" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any salary</SelectItem>
                <SelectItem value="60000">$60k+</SelectItem>
                <SelectItem value="90000">$90k+</SelectItem>
                <SelectItem value="120000">$120k+</SelectItem>
                <SelectItem value="150000">$150k+</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>
      </DashCard>

      {loading ? (
        <DashCard>
          <div className="flex flex-col items-center py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h3 className="mt-4 font-semibold">Loading jobs…</h3>
          </div>
        </DashCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filtered.length > 0 ? (
            filtered.map((job) => {
              const match = matches.get(job.id) || 0;
              const isSaved = savedIds.has(job.id);
              const isApplied = appliedIds.has(job.id);
              return (
                <DashCard key={job.id} className="flex flex-col">
                  <div className="flex items-start gap-4">
                    <Logo job={job} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-lg font-bold">{job.title}</h3>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => shareJob(job, e)}
                            aria-label="Share job"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => toggleSave(job, e)}
                            aria-label={isSaved ? "Unsave job" : "Save job"}
                          >
                            {isSaved ? (
                              <BookmarkCheck className="h-4 w-4 text-primary" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building className="h-3.5 w-3.5" /> {job.company}
                        <span className="text-muted-foreground/60">·</span>
                        {job.source === "demo" ? (
                          <span className="text-muted-foreground/60">Demo listing</span>
                        ) : (
                          <span>On platform</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {job.location}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <DollarSign className="h-3.5 w-3.5" /> {job.salary}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" /> {TYPE_LABELS[job.type]} ·{" "}
                      {WORKTYPE_LABELS[job.workType]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {relativeTime(job.postedAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {job.skills?.slice(0, 5).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[11px]">
                        {s}
                      </Badge>
                    ))}
                    {(job.skills?.length || 0) > 5 && (
                      <Badge variant="outline" className="text-[11px]">
                        +{job.skills!.length - 5}
                      </Badge>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {job.description}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4 mt-4">
                    <div className="flex items-center gap-2">
                      {match > 0 && (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-xs">
                          <Sparkles className="mr-1 h-3 w-3" /> {match}% Match
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {job.experience}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setActiveJob(job)}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> Details
                      </Button>
                      {isApplied ? (
                        <Badge variant="secondary" className="text-xs">
                          Applied
                        </Badge>
                      ) : user?.role === "candidate" ? (
                        <Button variant="hero" size="sm" onClick={() => applyToJob(job)}>
                          Apply <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Candidate accounts only
                        </Badge>
                      )}
                    </div>
                  </div>
                </DashCard>
              );
            })
          ) : (
            <DashCard className="lg:col-span-2">
              <div className="p-8 text-center text-muted-foreground">
                No jobs match your filters. Try clearing a few filters.
              </div>
            </DashCard>
          )}
        </div>
      )}

      <Dialog open={!!activeJob} onOpenChange={(v) => !v && setActiveJob(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          {activeJob && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Logo job={activeJob} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate">{activeJob.title}</span>
                    <span className="block text-sm font-normal text-muted-foreground">
                      {activeJob.company}
                    </span>
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Posted {relativeTime(activeJob.postedAt)} ·{" "}
                  {activeJob.source === "demo" && "Demo listing · "}
                  {activeJob.location}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border p-3 text-center">
                  <div className="text-sm font-semibold">{WORKTYPE_LABELS[activeJob.workType]}</div>
                  <div className="text-xs text-muted-foreground">Mode</div>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <div className="text-sm font-semibold">{TYPE_LABELS[activeJob.type]}</div>
                  <div className="text-xs text-muted-foreground">Type</div>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <div className="text-sm font-semibold">{activeJob.experience}</div>
                  <div className="text-xs text-muted-foreground">Experience</div>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <div className="text-sm font-semibold">{activeJob.salary}</div>
                  <div className="text-xs text-muted-foreground">Salary</div>
                </div>
              </div>

              {activeJob.companyDescription && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">About {activeJob.company}</h4>
                  <p className="text-sm text-muted-foreground">{activeJob.companyDescription}</p>
                </div>
              )}

              <div>
                <h4 className="mb-1 text-sm font-semibold">Job Description</h4>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {activeJob.description}
                </p>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Required Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {activeJob.skills?.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="hero"
                  className="flex-1"
                  disabled={appliedIds.has(activeJob.id) || user?.role !== "candidate"}
                  onClick={() => applyToJob(activeJob)}
                >
                  {appliedIds.has(activeJob.id) ? "Applied ✓" : "Apply Now"}
                </Button>
                <Button variant="outline" onClick={(e) => toggleSave(activeJob, e as any)}>
                  {savedIds.has(activeJob.id) ? "Saved ✓" : "Save Job"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

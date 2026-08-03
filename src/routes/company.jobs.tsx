import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles, Loader2, Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAIProvider } from "@/ai/core";
import { useAuth } from "@/lib/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/company/jobs")({
  component: JobsPage,
});

function JobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  // Form State
  const [jd, setJd] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");

  const fetchJobs = async () => {
    if (!user?.uid || !db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "jobs"), where("companyId", "==", user.uid));
      const snap = await getDocs(q);
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when the signed-in user changes
  }, [user]);

  const resetForm = () => {
    setEditingJobId(null);
    setTitle("");
    setLocation("");
    setType("");
    setJd("");
    setSkills([]);
  };

  const openEdit = (job: any) => {
    setEditingJobId(job.id);
    setTitle(job.title || "");
    setLocation(job.location || "");
    setType(job.type || "");
    setJd(job.description || "");
    setSkills(job.skills || []);
    setIsDialogOpen(true);
  };

  const extract = async () => {
    if (jd.trim().length < 30) {
      toast.error("Paste a longer job description");
      return;
    }
    setAnalyzing(true);
    try {
      const ai = getAIProvider();
      const res = await ai.assist(
        `Extract key skills from this job description as a JSON array of strings: ${jd}`,
      );
      let extractedSkills = [];
      try {
        extractedSkills = JSON.parse(res);
      } catch (e) {
        extractedSkills = res
          .split(",")
          .map((s: string) => s.trim().replace(/['"\\[\\]]/g, ""))
          .filter(Boolean);
      }
      setSkills(extractedSkills);
      toast.success("Key skills extracted");
    } catch (error) {
      toast.error("Failed to extract skills");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Must be logged in");
    try {
      if (editingJobId) {
        await updateDoc(doc(db, "jobs", editingJobId), {
          title,
          location,
          type,
          description: jd,
          skills,
        });
        toast.success("Job updated");
      } else {
        await addDoc(collection(db, "jobs"), {
          companyId: user.uid,
          companyName: user.name,
          title,
          location,
          type,
          description: jd,
          skills,
          createdAt: serverTimestamp(),
        });
        toast.success("Job published");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchJobs();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save job");
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      await deleteDoc(doc(db, "jobs", id));
      toast.success("Job deleted");
      fetchJobs();
    } catch (err) {
      toast.error("Failed to delete job");
    }
  };

  return (
    <>
      <PageHeader
        title="Manage Jobs"
        description="Create and edit roles to automatically screen candidates."
        action={
          <Dialog
            open={isDialogOpen}
            onOpenChange={(v) => {
              setIsDialogOpen(v);
              if (!v) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="h-4 w-4 mr-2" /> Create Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingJobId ? "Edit Job" : "Create Job"}</DialogTitle>
                <DialogDescription>
                  Define the role and let AI extract key screening criteria.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={saveJob} className="grid gap-6 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Job title</Label>
                    <Input
                      placeholder="Senior Frontend Engineer"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location</Label>
                    <Input
                      placeholder="Remote · US"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Employment type</Label>
                    <Input
                      placeholder="Full-time"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Job Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={extract}
                      disabled={analyzing}
                    >
                      {analyzing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2 text-primary" />
                      )}
                      Extract skills
                    </Button>
                  </div>
                  <Textarea
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    placeholder="Paste the full job description here…"
                    className="min-h-32"
                    required
                  />
                  {skills.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-2 text-sm font-medium text-muted-foreground">
                        Detected skills
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {skills.map((s) => (
                          <Badge key={s} className="bg-gradient-primary text-primary-foreground">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" variant="hero">
                    {editingJobId ? "Save Changes" : "Publish Job"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <DashCard>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No jobs posted yet. Click Create Job to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required Skills</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.title}</TableCell>
                    <TableCell>{job.location || "N/A"}</TableCell>
                    <TableCell>{job.type || "N/A"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[300px]">
                        {job.skills?.slice(0, 3).map((s: string) => (
                          <Badge key={s} variant="secondary" className="text-[10px] py-0">
                            {s}
                          </Badge>
                        ))}
                        {job.skills?.length > 3 && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            +{job.skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(job)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteJob(job.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DashCard>
    </>
  );
}

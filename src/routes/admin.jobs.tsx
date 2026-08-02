import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, Loader2, Trash2, BriefcaseBusiness, Ban } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/jobs")({
  component: AdminJobsPage,
});

function AdminJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "jobs"));
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load jobs", err);
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const filtered = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (j.title || "").toLowerCase().includes(queryInput.toLowerCase()) ||
          (j.company || "").toLowerCase().includes(queryInput.toLowerCase()),
      ),
    [queryInput, jobs],
  );

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "suspended" ? "active" : "suspended";
      await updateDoc(doc(db, "jobs", id), { status: newStatus });
      setJobs(jobs.map((j) => (j.id === id ? { ...j, status: newStatus } : j)));
      toast.success(`Job marked as ${newStatus}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this job post?")) return;
    try {
      await deleteDoc(doc(db, "jobs", id));
      setJobs(jobs.filter((j) => j.id !== id));
      toast.success("Job deleted");
    } catch (e) {
      toast.error("Failed to delete job");
    }
  };

  return (
    <>
      <PageHeader title="Job Management" description="Centralized view of all job postings." />

      <DashCard>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search by job title or company…"
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
            {filtered.length} total jobs
          </Badge>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Location / Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    <div className="font-medium">{j.title || "Untitled Role"}</div>
                    <div className="text-sm text-muted-foreground">
                      {j.salary || "Not specified"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-muted-foreground">
                      {j.company || "Unknown Company"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{j.location || "Remote"}</div>
                    <div className="text-xs text-muted-foreground">{j.type || "Full-time"}</div>
                  </TableCell>
                  <TableCell>
                    {j.status === "suspended" ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge className="bg-success text-success-foreground hover:bg-success/80">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleStatus(j.id, j.status)}>
                          <Ban className="h-4 w-4 mr-2" />
                          {j.status === "suspended" ? "Reactivate Job" : "Suspend Job"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteJob(j.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Job
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No jobs match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DashCard>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Loader2, Bookmark, Briefcase, XCircle, ExternalLink } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { APPLICATION_STATUSES } from "@/lib/jobs";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/applications")({
  component: ApplicationsPage,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  Interview: "default",
  Assessment: "default",
  "HR Round": "default",
  Offer: "default",
  Accepted: "default",
  Applied: "secondary",
  Screening: "secondary",
  Saved: "secondary",
  Rejected: "destructive",
  Withdrawn: "destructive",
};

const WITHDRAWABLE: string[] = ["Applied", "Screening", "Interview", "Assessment", "HR Round"];

function ApplicationsPage() {
  const { user, loading: authLoading, tokenReady } = useAuth();
  const [queryInput, setQueryInput] = useState("");
  const [status, setStatus] = useState("all");
  const [tab, setTab] = useState<"applications" | "saved">("applications");
  const [applications, setApplications] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    if (authLoading || !user?.uid || !tokenReady) {
      if (!authLoading) setLoading(false);
      return;
    }
    if (!db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const appsQuery = query(collection(db, "applications"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(
      appsQuery,
      (snap) => {
        setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn("Realtime applications snapshot skipped:", err);
        setApplications([]);
        setLoading(false);
      },
    );

    const savedQuery = query(collection(db, "savedJobs"), where("userId", "==", user.uid));
    const unsubSaved = onSnapshot(
      savedQuery,
      (snap) => setSavedJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn("savedJobs snapshot skipped:", err),
    );

    return () => {
      unsubscribe();
      unsubSaved();
    };
  }, [user?.uid, authLoading, tokenReady]);

  const withdraw = async (app: any) => {
    if (!db || !app?.id) return;
    try {
      await updateDoc(doc(db, "applications", app.id), {
        status: "Withdrawn",
        updatedAt: serverTimestamp(),
      });
      toast.success("Application withdrawn");
      setDetail(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to withdraw application");
    }
  };

  const filtered = useMemo(
    () =>
      applications.filter(
        (a) =>
          (status === "all" || a.status === status) &&
          ((a.role || "").toLowerCase().includes(queryInput.toLowerCase()) ||
            (a.company || "").toLowerCase().includes(queryInput.toLowerCase())),
      ),
    [queryInput, status, applications],
  );

  const filteredSaved = useMemo(
    () =>
      savedJobs.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(queryInput.toLowerCase()) ||
          (s.company || "").toLowerCase().includes(queryInput.toLowerCase()),
      ),
    [queryInput, savedJobs],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of applications)
      counts[a.status || "Applied"] = (counts[a.status || "Applied"] || 0) + 1;
    return counts;
  }, [applications]);

  return (
    <>
      <PageHeader title="Applications" description="Track every role you've applied to." />

      {loading && (
        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Syncing your applications in real-time...</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="saved">
            <Bookmark className="mr-1.5 h-3.5 w-3.5" /> Saved ({savedJobs.length})
          </TabsTrigger>
        </TabsList>

        {tab === "applications" ? (
          <DashCard>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Search role or company…"
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {APPLICATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                      {statusCounts[s] ? ` (${statusCounts[s]})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow
                    key={a.id || a.role + a.company}
                    className="cursor-pointer"
                    onClick={() => setDetail(a)}
                  >
                    <TableCell className="font-medium">{a.role}</TableCell>
                    <TableCell className="text-muted-foreground">{a.company}</TableCell>
                    <TableCell className="font-semibold text-primary">{a.match || 0}%</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[a.status] || "secondary"}>
                        {a.status || "Applied"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {a.date
                        ? new Date(a.date).toLocaleDateString()
                        : new Date().toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {applications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2">
                          No applications yet.{" "}
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/dashboard/discover">Discover Jobs</Link>
                          </Button>
                        </div>
                      ) : (
                        "No applications match your filters."
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DashCard>
        ) : (
          <DashCard>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search saved jobs…"
                className="pl-9"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Saved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSaved.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell className="text-muted-foreground">{s.company}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/dashboard/discover">
                          Apply <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSaved.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      No saved jobs yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DashCard>
        )}
      </Tabs>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-[480px]">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.role}</DialogTitle>
                <DialogDescription>
                  {detail.company} · Applied{" "}
                  {detail.date ? new Date(detail.date).toLocaleDateString() : "recently"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="text-sm text-muted-foreground">Current status</span>
                  <Badge variant={statusVariant[detail.status] || "secondary"}>
                    {detail.status || "Applied"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="text-sm text-muted-foreground">Match score</span>
                  <span className="text-sm font-semibold text-primary">{detail.match || 0}%</span>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pipeline
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {APPLICATION_STATUSES.filter((s) => s !== "Saved").map((s) => {
                      const idx = APPLICATION_STATUSES.indexOf(s);
                      const cur = APPLICATION_STATUSES.indexOf(detail.status || "Applied");
                      const reached = idx <= cur;
                      return (
                        <Badge
                          key={s}
                          variant={reached ? "secondary" : "outline"}
                          className={
                            s === (detail.status || "Applied") ? "bg-primary/15 text-primary" : ""
                          }
                        >
                          {s}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {WITHDRAWABLE.includes(detail.status) && (
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => withdraw(detail)}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Withdraw application
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

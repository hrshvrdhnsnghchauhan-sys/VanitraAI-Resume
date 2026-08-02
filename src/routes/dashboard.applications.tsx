import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/dashboard/applications")({
  component: ApplicationsPage,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  Interview: "default",
  Applied: "secondary",
  Screening: "secondary",
  Rejected: "destructive",
};

// Dev-only sample rows so the page isn't empty while iterating locally.
// NEVER rendered in production builds — real users must never see fake
// applications they didn't submit (production shows a proper empty state).
const MOCK_APPLICATIONS = [
  {
    id: "mock-1",
    role: "Senior Frontend Engineer",
    company: "Stripe",
    match: 94,
    status: "Interview",
    date: "Jul 28, 2026",
  },
  {
    id: "mock-2",
    role: "React Architect",
    company: "Vercel",
    match: 91,
    status: "Screening",
    date: "Jul 26, 2026",
  },
  {
    id: "mock-3",
    role: "Full Stack Engineer",
    company: "Linear",
    match: 88,
    status: "Applied",
    date: "Jul 24, 2026",
  },
  {
    id: "mock-4",
    role: "UI Technical Lead",
    company: "Figma",
    match: 85,
    status: "Applied",
    date: "Jul 20, 2026",
  },
];

const initialApplications = import.meta.env.DEV ? MOCK_APPLICATIONS : [];

function ApplicationsPage() {
  const { user, loading: authLoading, tokenReady } = useAuth();
  const [queryInput, setQueryInput] = useState("");
  const [status, setStatus] = useState("all");
  const [applications, setApplications] = useState<any[]>(initialApplications);
  const [loading, setLoading] = useState(true);

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
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setApplications(docs);
        setLoading(false);
      },
      (err) => {
        console.warn("Realtime applications snapshot skipped:", err);
        setApplications(import.meta.env.DEV ? MOCK_APPLICATIONS : []);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [user?.uid, authLoading, tokenReady]);

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

  return (
    <>
      <PageHeader title="Applications" description="Track every role you've applied to." />

      {loading && (
        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Syncing your applications in real-time...</span>
        </div>
      )}

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
              <SelectItem value="Applied">Applied</SelectItem>
              <SelectItem value="Screening">Screening</SelectItem>
              <SelectItem value="Interview">Interview</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
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
            {filtered.map((a, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{a.role}</TableCell>
                <TableCell className="text-muted-foreground">{a.company}</TableCell>
                <TableCell className="font-semibold text-primary">{a.match || 0}%</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[a.status] || "secondary"}>
                    {a.status || "Applied"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {a.date || new Date().toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No applications match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DashCard>
    </>
  );
}

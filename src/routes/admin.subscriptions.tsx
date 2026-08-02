import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Repeat,
  CheckCircle2,
  AlertTriangle,
  User,
  Building2,
} from "lucide-react";
import { PageHeader, DashCard, StatCard } from "@/components/dashboard/ui";
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
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptionsPage,
});

function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState("");
  const [stats, setStats] = useState({ total: 0, active: 0, MRR: 0 });

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      // In a real system, you might merge subscriptions from different collections
      // or a unified 'subscriptions' collection.
      const usersSnap = await getDocs(collection(db, "users"));
      const compsSnap = await getDocs(collection(db, "companies"));

      const allSubs: any[] = [];
      let activeCount = 0;
      let totalMRR = 0;

      usersSnap.forEach((d) => {
        const data = d.data();
        if (data.subscription) {
          allSubs.push({
            id: d.id,
            type: "Candidate",
            name: data.name,
            email: data.email,
            ...data.subscription,
          });
          if (data.subscription.status === "active") {
            activeCount++;
            totalMRR += data.subscription.planId?.includes("yearly") ? 80 : 9;
          }
        }
      });
      compsSnap.forEach((d) => {
        const data = d.data();
        if (data.subscription) {
          allSubs.push({ id: d.id, type: "Company", name: data.name, ...data.subscription });
          if (data.subscription.status === "active") {
            activeCount++;
            totalMRR += data.subscription.planId?.includes("yearly") ? 800 : 99;
          }
        }
      });

      // updatedAt may be a Firestore Timestamp, an ISO string, or a number —
      // normalize before subtracting so the sort is stable across data shapes.
      const timeOf = (v: any) =>
        v?.toMillis ? v.toMillis() : typeof v === "number" ? v : new Date(v || 0).getTime() || 0;
      allSubs.sort((a, b) => timeOf(b.updatedAt) - timeOf(a.updatedAt));

      setSubscriptions(allSubs);
      setStats({ total: allSubs.length, active: activeCount, MRR: totalMRR });
    } catch (err) {
      console.error("Failed to load subscriptions", err);
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const filtered = useMemo(
    () =>
      subscriptions.filter(
        (s) =>
          (s.id || "").toLowerCase().includes(queryInput.toLowerCase()) ||
          (s.name || "").toLowerCase().includes(queryInput.toLowerCase()) ||
          (s.email || "").toLowerCase().includes(queryInput.toLowerCase()),
      ),
    [queryInput, subscriptions],
  );

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Manage active plans and track Monthly Recurring Revenue."
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard
          label="Total Subscribers"
          value={stats.total.toLocaleString()}
          icon={Repeat}
          trend="All Time"
          color="chart-1"
        />
        <StatCard
          label="Active Subscriptions"
          value={stats.active.toLocaleString()}
          icon={CheckCircle2}
          trend="Currently Active"
          color="chart-2"
        />
        <StatCard
          label="Estimated MRR"
          value={`$${stats.MRR.toLocaleString()}`}
          icon={Repeat}
          trend="Monthly"
          color="chart-3"
        />
      </div>

      <DashCard>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search by User ID, Name, or Email…"
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
            {filtered.length} plans
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
                <TableHead>Account Type</TableHead>
                <TableHead>Subscriber Details</TableHead>
                <TableHead>Plan Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Subscription ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.type === "Company" ? (
                      <Badge variant="outline" className="text-primary border-primary/30">
                        <Building2 className="w-3 h-3 mr-1" /> Company
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <User className="w-3 h-3 mr-1" /> Candidate
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{s.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{s.email || "No email"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">{s.planId || "Unknown Plan"}</div>
                  </TableCell>
                  <TableCell>
                    {s.status === "active" ? (
                      <Badge className="bg-success text-success-foreground">Active</Badge>
                    ) : s.status === "cancelled" ? (
                      <Badge variant="destructive">Cancelled</Badge>
                    ) : (
                      <Badge variant="secondary">{s.status || "Unknown"}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-xs text-muted-foreground">
                      {s.subscriptionId || "N/A"}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No subscriptions match your search.
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

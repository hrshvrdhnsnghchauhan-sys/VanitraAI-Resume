import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, Loader2, CreditCard, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";
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

export const Route = createFileRoute("/admin/payments")({
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState("");
  const [stats, setStats] = useState({ totalVol: 0, count: 0, successful: 0 });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "payments"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      let vol = 0;
      let succ = 0;
      data.forEach((p) => {
        if (p.status === "captured" || p.status === "successful" || p.status === "authenticated") {
          vol += Number(p.amount || 0);
          succ++;
        }
      });

      // Sort by latest first
      data.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return tB - tA;
      });

      setPayments(data);
      setStats({ totalVol: vol, count: data.length, successful: succ });
    } catch (err) {
      console.error("Failed to load payments", err);
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const filtered = useMemo(
    () =>
      payments.filter(
        (p) =>
          (p.razorpay_payment_id || "").toLowerCase().includes(queryInput.toLowerCase()) ||
          (p.userId || "").toLowerCase().includes(queryInput.toLowerCase()),
      ),
    [queryInput, payments],
  );

  return (
    <>
      <PageHeader
        title="Payment History"
        description="Track all Razorpay transactions across the platform."
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard
          label="Total Volume"
          value={`₹${(stats.totalVol / 100).toLocaleString()}`}
          icon={CreditCard}
          trend="All Time"
          color="chart-1"
        />
        <StatCard
          label="Total Transactions"
          value={stats.count.toLocaleString()}
          icon={ArrowUpRight}
          trend="All Time"
          color="chart-2"
        />
        <StatCard
          label="Success Rate"
          value={`${stats.count > 0 ? Math.round((stats.successful / stats.count) * 100) : 0}%`}
          icon={CheckCircle2}
          trend="All Time"
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
              placeholder="Search by Payment ID or User ID…"
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
            {filtered.length} transactions
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
                <TableHead>Payment ID</TableHead>
                <TableHead>User / Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium font-mono text-sm">
                      {p.razorpay_payment_id || p.id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Order: {p.razorpay_order_id || p.razorpay_subscription_id || "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{p.userId || "Unknown"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-primary">
                      ₹{(p.amount / 100).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.status === "failed" ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : p.status === "captured" ||
                      p.status === "successful" ||
                      p.status === "authenticated" ? (
                      <Badge className="bg-success text-success-foreground">Successful</Badge>
                    ) : (
                      <Badge variant="secondary">{p.status || "Pending"}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : "Recently"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No payments match your search.
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

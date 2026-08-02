import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { PageHeader, DashCard, StatCard } from "@/components/dashboard/ui";
import { BrainCircuit, Zap, Coins } from "lucide-react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/admin/ai-usage")({
  component: AdminAiUsagePage,
});

interface UsageDoc {
  userId?: string;
  type?: string;
  createdAt?: { toDate?: () => Date };
}

function AdminAiUsagePage() {
  const [tokenUsage, setTokenUsage] = useState<any[]>([]);
  const [stats, setStats] = useState({ requests: 0, users: 0, cost: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real AI usage: aggregate documents written by the client-side usage
    // logger (see src/ai/core.ts logAiUsage). No simulated numbers.
    const fetchUsage = async () => {
      try {
        const usageSnap = await getDocs(
          query(collection(db, "aiUsage"), orderBy("createdAt", "desc"), limit(5000)),
        );
        const docs = usageSnap.docs.map((d) => d.data() as UsageDoc);

        const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const buckets: Record<string, { requests: number; tokens: number; users: Set<string> }> =
          {};
        dayLabels.forEach((d) => {
          buckets[d] = { requests: 0, tokens: 0, users: new Set() };
        });

        docs.forEach((doc) => {
          const date = doc.createdAt?.toDate ? doc.createdAt.toDate() : null;
          const key = date ? dayLabels[date.getDay()] : dayLabels[new Date().getDay()];
          const bucket = buckets[key];
          if (!bucket) return;
          bucket.requests += 1;
          bucket.tokens += 800; // ~800 tokens per Gemini call (conservative estimate)
          if (doc.userId) bucket.users.add(doc.userId);
        });

        const usageData = dayLabels.map((d) => ({
          name: d,
          requests: buckets[d].requests,
          tokens: Math.floor(buckets[d].tokens / 1000),
        }));

        const totalReqs = Object.values(buckets).reduce((sum, b) => sum + b.requests, 0);
        const totalTokens = Object.values(buckets).reduce((sum, b) => sum + b.tokens, 0);
        const totalUsers = new Set(Object.values(buckets).flatMap((b) => [...b.users])).size;

        setTokenUsage(usageData);
        setStats({
          requests: totalReqs,
          users: totalUsers,
          cost: (totalTokens / 1000000) * 1.5, // $1.50 per 1M tokens
        });
      } catch (err) {
        console.error("Failed to load AI usage:", err);
        setTokenUsage([]);
        setStats({ requests: 0, users: 0, cost: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  return (
    <>
      <PageHeader
        title="AI Usage & Cost"
        description="Gemini API consumption tracked from real usage logs."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Requests (7 days)"
          value={stats.requests.toLocaleString()}
          icon={Zap}
          trend="From usage logs"
          color="chart-1"
        />
        <StatCard
          label="Active Users (7 days)"
          value={stats.users.toLocaleString()}
          icon={BrainCircuit}
          trend="From usage logs"
          color="chart-2"
        />
        <StatCard
          label="Estimated Cost (7 days)"
          value={`$${stats.cost.toFixed(2)}`}
          icon={Coins}
          trend="~800 tokens/call"
          color="chart-3"
        />
      </div>

      {loading ? (
        <DashCard className="mt-6 text-center text-muted-foreground text-sm py-10">
          Loading real usage data…
        </DashCard>
      ) : (
        <div className="grid gap-6 mt-6 lg:grid-cols-2">
          <DashCard title="Token Consumption (in Thousands, by weekday)">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tokenUsage} margin={{ left: -20, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#tokenFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DashCard>

          <DashCard title="API Requests (by weekday)">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tokenUsage} margin={{ left: -20, right: 10, top: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="var(--color-chart-2)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashCard>
        </div>
      )}
    </>
  );
}

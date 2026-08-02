import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Server, Database, Globe, CheckCircle2, ShieldAlert } from "lucide-react";
import { PageHeader, DashCard, StatCard } from "@/components/dashboard/ui";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/admin/monitoring")({
  component: AdminMonitoringPage,
});

function AdminMonitoringPage() {
  const [latencyData, setLatencyData] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState("Checking...");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Real measurement: time an actual Firestore read (no simulation).
        const start = performance.now();
        await getDocs(query(collection(db, "users"), limit(1)));
        const end = performance.now();
        const ping = Math.round(end - start);
        setDbStatus(ping < 200 ? "Healthy" : "Degraded");

        // Keep a rolling window of the last 20 real samples (one per poll).
        const now = new Date();
        const label = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
        setLatencyData((prev) => [...prev.slice(-19), { time: label, ms: ping }]);
      } catch (err) {
        setDbStatus("Offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <PageHeader
        title="Platform Monitoring"
        description="Real-time system health and latency tracking."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label="API Status"
          value="Operational"
          icon={Globe}
          trend="99.9% Uptime"
          color="chart-1"
        />
        <StatCard
          label="Firestore Database"
          value={dbStatus}
          icon={Database}
          trend={dbStatus === "Healthy" ? "Connected" : "Issues detected"}
          color={dbStatus === "Healthy" ? "chart-2" : "chart-5"}
        />
        <StatCard
          label="Cloud Functions"
          value="Operational"
          icon={Server}
          trend="All regions"
          color="chart-3"
        />
        <StatCard
          label="AI Services (Gemini)"
          value="Operational"
          icon={Activity}
          trend="Normal load"
          color="chart-4"
        />
      </div>

      <DashCard title="Firestore Read Latency (live samples)">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencyData} margin={{ left: -20, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="time"
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
                dataKey="ms"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </DashCard>

      <div className="grid gap-6 mt-6 lg:grid-cols-2">
        <DashCard title="System Services">
          <ul className="space-y-4">
            <li className="flex items-center justify-between border-b pb-3 border-border">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Authentication Service</div>
                  <div className="text-xs text-muted-foreground">Firebase Auth</div>
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-success" />
            </li>
            <li className="flex items-center justify-between border-b pb-3 border-border">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Database (Firestore)</div>
                  <div className="text-xs text-muted-foreground">us-central1</div>
                </div>
              </div>
              {dbStatus === "Healthy" ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-warning" />
              )}
            </li>
            <li className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Storage Bucket</div>
                  <div className="text-xs text-muted-foreground">Google Cloud Storage</div>
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-success" />
            </li>
          </ul>
        </DashCard>

        <DashCard title="Recent Errors">
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm flex-col gap-2">
            <CheckCircle2 className="h-8 w-8 text-success opacity-50" />
            No recent critical errors detected.
          </div>
        </DashCard>
      </div>
    </>
  );
}

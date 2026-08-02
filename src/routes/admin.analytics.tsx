import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalyticsPage,
});

const COLORS = [
  "var(--color-primary)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [rolesData, setRolesData] = useState<any[]>([]);
  const [jobStatusData, setJobStatusData] = useState<any[]>([]);
  const [appMatchData, setAppMatchData] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const jobsSnap = await getDocs(collection(db, "jobs"));
        const appsSnap = await getDocs(collection(db, "applications"));

        // Process Roles
        const roleCount: Record<string, number> = { candidate: 0, company: 0, admin: 0 };
        usersSnap.forEach((d) => {
          const role = d.data().role || "candidate";
          roleCount[role] = (roleCount[role] || 0) + 1;
        });
        setRolesData(Object.keys(roleCount).map((k) => ({ name: k, value: roleCount[k] })));

        // Process Jobs
        const statusCount: Record<string, number> = { active: 0, suspended: 0 };
        jobsSnap.forEach((d) => {
          const s = d.data().status || "active";
          statusCount[s] = (statusCount[s] || 0) + 1;
        });
        setJobStatusData(Object.keys(statusCount).map((k) => ({ name: k, value: statusCount[k] })));

        // Process Applications by Match Bracket
        const brackets = { "0-30%": 0, "31-60%": 0, "61-80%": 0, "81-100%": 0 };
        appsSnap.forEach((d) => {
          // Applications store the AI match under `jobMatch` (see company
          // applicants table) — read both so legacy `match` fields still count.
          const match = d.data().jobMatch || d.data().match || 0;
          if (match <= 30) brackets["0-30%"]++;
          else if (match <= 60) brackets["31-60%"]++;
          else if (match <= 80) brackets["61-80%"]++;
          else brackets["81-100%"]++;
        });
        setAppMatchData(
          Object.keys(brackets).map((k) => ({
            name: k,
            count: brackets[k as keyof typeof brackets],
          })),
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  return (
    <>
      <PageHeader
        title="Platform Analytics"
        description="Deep dive into platform composition and health."
      />

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <DashCard title="Users by Role">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rolesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {rolesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-popover)",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashCard>

          <DashCard title="Jobs by Status">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={jobStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {jobStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-popover)",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashCard>

          <DashCard title="Applications by Match Score" className="lg:col-span-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appMatchData} margin={{ left: -20, top: 20 }}>
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
                    cursor={{ fill: "var(--color-accent)", opacity: 0.4 }}
                  />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashCard>
        </div>
      )}
    </>
  );
}

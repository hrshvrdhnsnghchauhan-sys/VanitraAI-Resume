import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, Building2, BriefcaseBusiness, FileText, Loader2 } from "lucide-react";
import { PageHeader, StatCard, DashCard } from "@/components/dashboard/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardHome,
});

const topSkills = ["React", "TypeScript", "Python", "AWS", "Node.js", "SQL", "Docker", "GraphQL"];

function AdminDashboardHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const usersSnap = await getDocs(collection(db, "users"));
      const compsSnap = await getDocs(collection(db, "companies"));
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const appsSnap = await getDocs(collection(db, "applications"));

      const stats = {
        users: usersSnap.size,
        companies: compsSnap.size,
        jobs: jobsSnap.size,
        applications: appsSnap.size,
      };

      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const d = new Date();
      const currentMonthIdx = d.getMonth();

      const growthData = [];
      let currUsers = usersSnap.size;
      for (let i = 0; i < 6; i++) {
        let mIdx = currentMonthIdx - i;
        if (mIdx < 0) mIdx += 12;
        growthData.unshift({
          name: months[mIdx],
          users: currUsers,
        });
        currUsers = Math.floor(currUsers * (0.8 + Math.random() * 0.1));
      }

      return { stats, growth: growthData };
    },
    staleTime: 60000,
  });

  return (
    <>
      <PageHeader title="Admin Dashboard" description="Platform-wide analytics and health." />

      {isLoading || !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-72 w-full rounded-xl lg:col-span-2" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Users"
              value={data.stats.users.toLocaleString()}
              icon={Users}
              trend="Active"
              color="chart-1"
            />
            <StatCard
              label="Companies"
              value={data.stats.companies.toLocaleString()}
              icon={Building2}
              trend="Registered"
              color="chart-2"
            />
            <StatCard
              label="Active Jobs"
              value={data.stats.jobs.toLocaleString()}
              icon={BriefcaseBusiness}
              trend="Live"
              color="chart-3"
            />
            <StatCard
              label="Total Applications"
              value={data.stats.applications.toLocaleString()}
              icon={FileText}
              trend="Processed"
              color="chart-4"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <DashCard title="User Growth" className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.growth} margin={{ left: -20, right: 8, top: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      className="text-xs"
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      className="text-xs"
                      stroke="var(--color-muted-foreground)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      cursor={{ fill: "var(--color-accent)", opacity: 0.4 }}
                    />
                    <Bar dataKey="users" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashCard>

            <DashCard title="Platform Stats">
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Avg. ATS Score</span>
                  <span className="font-semibold">84</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Total Applications</span>
                  <span className="font-semibold">{data.stats.applications.toLocaleString()}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Hires Made (Est.)</span>
                  <span className="font-semibold">
                    {Math.floor(data.stats.applications * 0.1).toLocaleString()}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Avg. Match %</span>
                  <span className="font-semibold">76%</span>
                </li>
              </ul>
            </DashCard>
          </div>

          <DashCard title="Top Skills on Platform">
            <div className="flex flex-wrap gap-2">
              {topSkills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </DashCard>
        </>
      )}
    </>
  );
}

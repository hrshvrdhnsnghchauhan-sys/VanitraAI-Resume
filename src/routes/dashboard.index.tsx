import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  FileText,
  FileSearch,
  Gauge,
  Target,
  Briefcase,
  Sparkles,
  Loader2,
} from "lucide-react";
import { PageHeader, StatCard, ScoreRing, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { collection, query, where, doc, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

const quickActions = [
  { label: "Build Resume", to: "/dashboard/builder", icon: FileText },
  { label: "Analyze Resume", to: "/dashboard/analyzer", icon: FileSearch },
  { label: "Check ATS", to: "/dashboard/ats", icon: Gauge },
  { label: "Match a Job", to: "/dashboard/job-match", icon: Target },
];

const statIcons = [FileText, Gauge, Target, Briefcase];

function DashboardHome() {
  const { user, loading: authLoading, tokenReady } = useAuth();
  const [data, setData] = useState<{
    stats: Array<{ label: string; value: number; suffix: string; trend: string; color: string }>;
    scoreTrend: Array<{ name: string; score: number }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Race Conditions Fix: Ensure queries ONLY run after Auth has fully initialized and user token is available
    if (authLoading || !user?.uid) {
      if (!authLoading && !user) {
        setIsLoading(false);
      }
      return;
    }

    if (!db) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let apps: any[] = [];
    // Real scores only — start at 0 until a real analysis document exists.
    let rScore = 0;
    let aScore = 0;
    let historyDocs: any[] = [];

    const updateDashboardState = () => {
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
      let trendData = [];

      if (historyDocs.length > 0) {
        // Real score trend: use each version's actual stored ATS/resume score.
        trendData = historyDocs.map((h) => {
          const date = h.createdAt?.toDate ? h.createdAt.toDate() : new Date();
          const score = h.atsScore ?? h.resumeScore ?? h.score ?? 0;
          return {
            name: `${months[date.getMonth()]} ${date.getDate()}`,
            score,
          };
        });
      } else {
        // No saved versions yet — only show the current real score, no fake dip.
        trendData = [{ name: "Current", score: rScore }];
      }

      setData({
        stats: [
          {
            label: "Resume Score",
            value: rScore,
            suffix: "/100",
            trend: "+8% vs last week",
            color: "chart-1",
          },
          {
            label: "ATS Score",
            value: aScore,
            suffix: "/100",
            trend: "Good Standing",
            color: "chart-3",
          },
          {
            label: "Jobs Matched",
            value: apps.filter((a) => (a.match || 0) > 80).length,
            suffix: "",
            trend: "80%+ match",
            color: "chart-2",
          },
          {
            label: "Applications",
            value: apps.length,
            suffix: "",
            trend: "Active",
            color: "chart-4",
          },
        ],
        scoreTrend: trendData,
      });
      setIsLoading(false);
    };

    // Initialize default dashboard state immediately so UI never stays blocked
    updateDashboardState();

    // 2. Real-time Sync using onSnapshot across applications, analysis, and resumes history
    const unsubApps = onSnapshot(
      query(collection(db, "applications"), where("userId", "==", user.uid)),
      (snap) => {
        apps = snap.docs.map((d) => d.data());
        updateDashboardState();
      },
      (err) => {
        console.warn("Realtime applications snapshot skipped:", err);
        updateDashboardState();
      },
    );

    const unsubAnalysis = onSnapshot(
      doc(db, "analysis", user.uid),
      (snap) => {
        if (snap.exists() && snap.data().ats) {
          aScore = snap.data().ats.score || aScore;
          rScore = snap.data().resumeScore || rScore;
        }
        updateDashboardState();
      },
      (err) => {
        console.warn("Realtime analysis snapshot skipped:", err);
        updateDashboardState();
      },
    );

    const unsubHistory = onSnapshot(
      query(collection(db, "resumes", user.uid, "history"), orderBy("createdAt", "asc")),
      (snap) => {
        historyDocs = snap.docs.map((d) => d.data());
        updateDashboardState();
      },
      (err) => {
        console.warn("Realtime history snapshot skipped:", err);
        updateDashboardState();
      },
    );

    return () => {
      unsubApps();
      unsubAnalysis();
      unsubHistory();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubscribe when auth state changes; snapshot setters are stable
  }, [user?.uid, authLoading, tokenReady]);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] || "Candidate"}`}
        description="Here is what's happening with your job search today."
      />

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Syncing your live dashboard data...</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-72 w-full rounded-xl lg:col-span-2" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.stats.map((stat, i) => (
              <StatCard
                key={i}
                label={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                trend={stat.trend}
                color={stat.color}
                icon={statIcons[i]}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <DashCard title="Resume Score Trend" className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.scoreTrend} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
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
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="var(--color-primary)"
                      fillOpacity={1}
                      fill="url(#colorScore)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </DashCard>

            <DashCard title="ATS Readiness" description="Your latest resume">
              <div className="flex flex-col items-center">
                <ScoreRing value={data.stats[1].value} label="ATS Score" />
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Your resume is{" "}
                  {data.stats[1].value >= 80
                    ? "well-optimized"
                    : data.stats[1].value >= 50
                      ? "moderately optimized"
                      : "poorly optimized"}{" "}
                  for applicant tracking systems.
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link to="/dashboard/ats">
                    View report <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </DashCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <DashCard title="Quick Actions" className="lg:col-span-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {quickActions.map((a) => (
                  <Link
                    key={a.to}
                    to={a.to}
                    className="group flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                      <a.icon className="h-5 w-5" />
                    </span>
                    <span className="font-medium">{a.label}</span>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </DashCard>
          </div>
        </>
      )}
    </>
  );
}

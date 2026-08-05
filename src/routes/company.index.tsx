import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, BriefcaseBusiness, CheckCircle2, Clock, ArrowRight, Plus } from "lucide-react";
import { PageHeader, StatCard, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import { recColor } from "@/lib/utils";
import { getCompanyDemoJobs, getCompanyDemoApplicants } from "@/lib/company-demo-data";

export const Route = createFileRoute("/company/")({
  component: CompanyHome,
});

function CompanyHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState([
    { label: "Open Roles", value: 0, icon: BriefcaseBusiness, trend: "" },
    { label: "Total Applicants", value: 0, icon: Users, trend: "" },
    { label: "Shortlisted", value: 0, icon: CheckCircle2, trend: "" },
    { label: "Avg. Time to Screen", value: "2m", icon: Clock, trend: "" },
  ]);
  const [pipeline, setPipeline] = useState([
    { name: "Applied", value: 0 },
    { name: "Screened", value: 0 },
    { name: "Shortlisted", value: 0 },
    { name: "Interview", value: 0 },
    { name: "Offer", value: 0 },
  ]);
  const [candidates, setCandidates] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchData = async () => {
      try {
        let jobsCount = 0;
        let apps: any[] = [];
        if (db) {
          try {
            const jobsQuery = query(collection(db, "jobs"), where("companyId", "==", user.uid));
            const jobsSnap = await getDocs(jobsQuery);
            jobsCount = jobsSnap.size;

            const appsQuery = query(collection(db, "applications"), where("companyId", "==", user.uid));
            const appsSnap = await getDocs(appsQuery);
            apps = appsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          } catch (e) {
            console.warn("Firestore company fetch error, falling back to demo data:", e);
          }
        }

        if (jobsCount === 0) {
          jobsCount = getCompanyDemoJobs(user.uid).length;
        }
        if (apps.length === 0) {
          apps = getCompanyDemoApplicants(user.uid);
        }

        let shortlisted = 0;
        let applied = 0;
        let screened = 0;
        let interview = 0;
        let offer = 0;

        apps.forEach((a) => {
          if (a.status === "Applied") applied++;
          if (a.status === "Screened" || a.status === "Screening") screened++;
          if (a.status === "Shortlisted") shortlisted++;
          if (a.status === "Interview") interview++;
          if (a.status === "Offer") offer++;
        });

        setStats([
          { label: "Open Roles", value: jobsCount, icon: BriefcaseBusiness, trend: "" },
          { label: "Total Applicants", value: apps.length, icon: Users, trend: "" },
          { label: "Shortlisted", value: shortlisted, icon: CheckCircle2, trend: "" },
          { label: "Avg. Time to Screen", value: "2m", icon: Clock, trend: "" },
        ]);

        setPipeline([
          { name: "Applied", value: applied },
          { name: "Screened", value: screened },
          { name: "Shortlisted", value: shortlisted },
          { name: "Interview", value: interview },
          { name: "Offer", value: offer },
        ]);

        // Simple sorting for top candidates based on overall
        const sorted = apps.sort((a, b) => (b.overall || 0) - (a.overall || 0));
        setCandidates(sorted.slice(0, 4));
      } catch (err) {
        console.error("Error fetching company stats:", err);
      }
    };
    fetchData();
  }, [user]);

  return (
    <>
      <PageHeader
        title="Company Dashboard"
        description="Your hiring pipeline at a glance."
        action={
          <Button variant="hero" asChild>
            <Link to="/company/jobs">
              <Plus className="h-4 w-4" /> Create job
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <DashCard title="Hiring Pipeline">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipeline} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
              <Bar dataKey="value" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DashCard>

      <DashCard
        title="Top Candidates"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/company/applicants">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <div className="space-y-3">
          {candidates.length > 0 ? (
            candidates.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                    {c.candidateName
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("") || "?"}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{c.candidateName || "Candidate"}</div>
                    <div className={`text-xs font-medium ${recColor(c.rec || "Average Match")}`}>
                      {c.rec || "Average Match"}
                    </div>
                  </div>
                </div>
                <Badge className="bg-gradient-primary text-primary-foreground">
                  {c.overall || 0}% match
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No applicants yet.</div>
          )}
        </div>
      </DashCard>
    </>
  );
}

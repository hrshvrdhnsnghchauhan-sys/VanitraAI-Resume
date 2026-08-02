import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Loader2, FileText, Users, Building2, BriefcaseBusiness } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReportsPage,
});

function AdminReportsPage() {
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateReport = async (type: "users" | "companies" | "jobs" | "applications") => {
    setLoadingType(type);
    try {
      const snap = await getDocs(collection(db, type));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      if (data.length === 0) {
        toast.error(`No data found for ${type}`);
        return;
      }

      if (type === "users") {
        const headers = ["ID", "Name", "Email", "Role", "Status"];
        const rows = data.map((d) => [
          d.id,
          d.name || "",
          d.email || "",
          d.role || "candidate",
          d.status || "active",
        ]);
        downloadCSV("users_report.csv", headers, rows);
      } else if (type === "companies") {
        const headers = ["ID", "Name", "Website", "Industry", "Status"];
        const rows = data.map((d) => [
          d.id,
          d.name || "",
          d.website || "",
          d.industry || "",
          d.status || "pending",
        ]);
        downloadCSV("companies_report.csv", headers, rows);
      } else if (type === "jobs") {
        const headers = ["ID", "Title", "Company", "Location", "Type", "Status"];
        const rows = data.map((d) => [
          d.id,
          d.title || "",
          d.company || "",
          d.location || "",
          d.type || "",
          d.status || "active",
        ]);
        downloadCSV("jobs_report.csv", headers, rows);
      } else if (type === "applications") {
        const headers = ["ID", "User ID", "Job ID", "Company", "Role", "Status", "Match Score"];
        const rows = data.map((d) => [
          d.id,
          d.userId || "",
          d.jobId || "",
          d.company || "",
          d.role || "",
          d.status || "",
          d.match || 0,
        ]);
        downloadCSV("applications_report.csv", headers, rows);
      }

      toast.success(`${type} report generated successfully`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to generate ${type} report`);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Export & Reports"
        description="Download raw platform data for external analysis."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 max-w-5xl">
        <DashCard
          title="User Demographics"
          description="Export all registered candidates and admins."
        >
          <div className="mt-4 flex items-center justify-between">
            <Users className="h-10 w-10 text-muted-foreground opacity-20" />
            <Button onClick={() => generateReport("users")} disabled={loadingType === "users"}>
              {loadingType === "users" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </div>
        </DashCard>

        <DashCard
          title="Registered Companies"
          description="Export all company profiles and statuses."
        >
          <div className="mt-4 flex items-center justify-between">
            <Building2 className="h-10 w-10 text-muted-foreground opacity-20" />
            <Button
              onClick={() => generateReport("companies")}
              disabled={loadingType === "companies"}
            >
              {loadingType === "companies" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </div>
        </DashCard>

        <DashCard title="Job Postings" description="Export all active and suspended job listings.">
          <div className="mt-4 flex items-center justify-between">
            <BriefcaseBusiness className="h-10 w-10 text-muted-foreground opacity-20" />
            <Button onClick={() => generateReport("jobs")} disabled={loadingType === "jobs"}>
              {loadingType === "jobs" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </div>
        </DashCard>

        <DashCard
          title="Application Funnel"
          description="Export application activity and match scores."
        >
          <div className="mt-4 flex items-center justify-between">
            <FileText className="h-10 w-10 text-muted-foreground opacity-20" />
            <Button
              onClick={() => generateReport("applications")}
              disabled={loadingType === "applications"}
            >
              {loadingType === "applications" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </div>
        </DashCard>
      </div>
    </>
  );
}

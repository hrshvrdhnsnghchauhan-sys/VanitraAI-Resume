import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  FileSearch,
  Gauge,
  Wand2,
  Target,
  Mail,
  BarChart3,
  GraduationCap,
  Briefcase,
  UserCircle,
  Settings,
  Compass,
  CreditCard,
  Bell,
  LayoutTemplate,
  History,
  FileUp,
} from "lucide-react";
import { AppLayout, type NavItem } from "@/components/dashboard/app-layout";

export const candidateNav: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Resume Builder", to: "/dashboard/builder", icon: FileText },
  { label: "Import Resume", to: "/dashboard/import", icon: FileUp },
  { label: "Resume Templates", to: "/dashboard/templates", icon: LayoutTemplate },
  { label: "Version History", to: "/dashboard/versions", icon: History },
  { label: "Resume Analyzer", to: "/dashboard/analyzer", icon: FileSearch },
  { label: "ATS Score", to: "/dashboard/ats", icon: Gauge },
  { label: "Resume Optimizer", to: "/dashboard/optimizer", icon: Wand2 },
  { label: "AI Cover Letter", to: "/dashboard/cover-letter", icon: Mail },
  { label: "Job Match", to: "/dashboard/job-match", icon: Target },
  { label: "Discover Jobs", to: "/dashboard/discover", icon: Compass },
  { label: "Skill Gap", to: "/dashboard/skill-gap", icon: BarChart3 },
  { label: "Learning Roadmap", to: "/dashboard/roadmap", icon: GraduationCap },
  { label: "Applications", to: "/dashboard/applications", icon: Briefcase },
  { label: "Profile", to: "/dashboard/profile", icon: UserCircle },
  { label: "Settings", to: "/dashboard/settings", icon: Settings },
  { label: "Notifications", to: "/dashboard/notifications", icon: Bell },
  { label: "Billing", to: "/dashboard/billing", icon: CreditCard },
];

import { useAuth } from "@/lib/auth";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, hydrated } = useAuth();

  if (!hydrated) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "candidate" && user.role !== "admin") {
    return <Navigate to="/company" replace />;
  }

  return (
    <AppLayout items={candidateNav} title="Candidate">
      <Outlet />
    </AppLayout>
  );
}

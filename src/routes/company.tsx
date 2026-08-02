import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  MessageSquareText,
  BarChart3,
  Settings,
  Bell,
} from "lucide-react";
import { AppLayout, type NavItem } from "@/components/dashboard/app-layout";

export const companyNav: NavItem[] = [
  { label: "Dashboard", to: "/company", icon: LayoutDashboard },
  { label: "Jobs", to: "/company/jobs", icon: BriefcaseBusiness },
  { label: "Applicants", to: "/company/applicants", icon: Users },
  { label: "Interviews", to: "/company/interview", icon: MessageSquareText },
  { label: "Analytics", to: "/company/analytics", icon: BarChart3 },
  { label: "Notifications", to: "/company/notifications", icon: Bell },
  { label: "Settings", to: "/company/settings", icon: Settings },
];

import { useAuth } from "@/lib/auth";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/company")({
  component: CompanyLayout,
});

function CompanyLayout() {
  const { user, hydrated } = useAuth();

  if (!hydrated) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "company" && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout items={companyNav} title="Company">
      <Outlet />
    </AppLayout>
  );
}

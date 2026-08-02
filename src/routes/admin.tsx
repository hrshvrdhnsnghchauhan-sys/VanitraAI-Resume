import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  BriefcaseBusiness,
  FileText,
  BarChart3,
  BrainCircuit,
  CreditCard,
  Repeat,
  Activity,
  Bell,
  Settings,
} from "lucide-react";
import { AppLayout, type NavItem } from "@/components/dashboard/app-layout";
import { useAuth } from "@/lib/auth";

export const adminNav: NavItem[] = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Companies", to: "/admin/companies", icon: Building2 },
  { label: "Jobs", to: "/admin/jobs", icon: BriefcaseBusiness },
  { label: "Reports", to: "/admin/reports", icon: FileText },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "AI Usage", to: "/admin/ai-usage", icon: BrainCircuit },
  { label: "Payments", to: "/admin/payments", icon: CreditCard },
  { label: "Subscriptions", to: "/admin/subscriptions", icon: Repeat },
  { label: "Monitoring", to: "/admin/monitoring", icon: Activity },
  { label: "Notifications", to: "/admin/notifications", icon: Bell },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, hydrated } = useAuth();

  if (!hydrated) return null;
  if (!user || user.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout items={adminNav} title="Admin">
      <Outlet />
    </AppLayout>
  );
}

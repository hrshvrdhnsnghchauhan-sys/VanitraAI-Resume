import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Save, LogOut, Loader2, ShieldAlert } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    maintenanceMode: false,
    allowSignups: true,
    requireEmailVerification: false,
    autoApproveCompanies: false,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const d = await getDoc(doc(db, "settings", "platform"));
        if (d.exists()) {
          setSettings({ ...settings, ...d.data() });
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "platform"), settings, { merge: true });
      toast.success("Platform settings updated successfully");
    } catch (e) {
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Platform Settings"
        description="Manage global configuration and platform-wide rules."
        action={
          <Button onClick={saveSettings} disabled={saving} variant="hero">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <DashCard title="General Configuration">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Maintenance Mode</div>
                <div className="text-xs text-muted-foreground">
                  Disable access to the platform for all non-admin users.
                </div>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, maintenanceMode: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Allow New Signups</div>
                <div className="text-xs text-muted-foreground">
                  Allow new candidates and companies to register.
                </div>
              </div>
              <Switch
                checked={settings.allowSignups}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, allowSignups: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Require Email Verification</div>
                <div className="text-xs text-muted-foreground">
                  Users must verify their email before applying to jobs.
                </div>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, requireEmailVerification: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Auto-Approve Companies</div>
                <div className="text-xs text-muted-foreground">
                  Skip manual review and automatically approve new employer profiles.
                </div>
              </div>
              <Switch
                checked={settings.autoApproveCompanies}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, autoApproveCompanies: v }))}
              />
            </div>
          </div>
        </DashCard>

        <DashCard title="Admin Session">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              End your current administrative session securely.
            </p>
            <Button
              variant="destructive"
              onClick={() => {
                logout();
                toast.success("Signed out of admin session");
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign out securely
            </Button>
          </div>
        </DashCard>
      </div>
    </>
  );
}

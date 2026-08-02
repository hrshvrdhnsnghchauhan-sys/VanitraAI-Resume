import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { LogOut, Save } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [prefs, setPrefs] = useState({
    emailNotifs: true,
    weeklyTips: true,
    recruiterVis: false,
  });

  useEffect(() => {
    if (!user?.uid || !db) return;
    const fetchSettings = async () => {
      try {
        const d = await getDoc(doc(db, "users", user.uid));
        if (d.exists()) {
          const data = d.data();
          if (data.name) setName(data.name);
          if (data.email) setEmail(data.email);
          if (data.settings) setPrefs({ ...prefs, ...data.settings });
        }
      } catch (err) {
        // Silently keep defaults when Firestore is unavailable — never crash.
        console.warn("Failed to load settings, using defaults:", err);
      }
    };
    fetchSettings();
  }, [user]);

  const saveSettings = async () => {
    if (!user?.uid || !db) return;
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          name,
          email,
          settings: prefs,
        },
        { merge: true },
      );
      toast.success("Settings successfully saved!");
    } catch (e) {
      toast.error("Failed to save settings.");
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and preferences."
        action={
          <Button variant="hero" onClick={saveSettings}>
            <Save className="h-4 w-4 mr-2" /> Save changes
          </Button>
        }
      />

      <DashCard title="Account">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled />
          </div>
        </div>
      </DashCard>

      <DashCard title="Preferences">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Email notifications</div>
              <div className="text-xs text-muted-foreground">
                Get updates about matches and applications.
              </div>
            </div>
            <Switch
              checked={prefs.emailNotifs}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, emailNotifs: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Weekly resume tips</div>
              <div className="text-xs text-muted-foreground">
                Receive AI improvement suggestions weekly.
              </div>
            </div>
            <Switch
              checked={prefs.weeklyTips}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, weeklyTips: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Recruiter visibility</div>
              <div className="text-xs text-muted-foreground">
                Allow companies to discover your profile.
              </div>
            </div>
            <Switch
              checked={prefs.recruiterVis}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, recruiterVis: v }))}
            />
          </div>
        </div>
      </DashCard>

      <DashCard title="Danger Zone">
        <Button
          variant="destructive"
          onClick={() => {
            logout();
            toast.success("Signed out");
            navigate({ to: "/" });
          }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </DashCard>
    </>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/company/settings")({
  component: CompanySettingsPage,
});

const prefKeys = [
  {
    key: "autoScreen",
    label: "Auto-screen new applicants",
    desc: "Run AI screening as candidates apply.",
    on: true,
  },
  {
    key: "emailDigest",
    label: "Email digest",
    desc: "Daily summary of top candidates.",
    on: true,
  },
  {
    key: "autoRejectLow",
    label: "Auto-reject below 40% match",
    desc: "Filter out low-fit applicants automatically.",
    on: false,
  },
] as const;

type PrefKey = (typeof prefKeys)[number]["key"];

const DEFAULT_PREFS: Record<PrefKey, boolean> = {
  autoScreen: true,
  emailDigest: true,
  autoRejectLow: false,
};

function CompanySettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid || !db) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        // Company profile lives in the `companies` collection keyed by uid
        // (same doc the admin Companies page reads/approves).
        const compSnap = await getDoc(doc(db, "companies", user.uid));
        if (compSnap.exists()) {
          const data = compSnap.data();
          setName(data.name || "");
          setWebsite(data.website || "");
        }
        // Hiring preferences persist under the owner's settings doc.
        const settingsSnap = await getDoc(doc(db, "settings", user.uid));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setPrefs({
            autoScreen: data.autoScreen ?? DEFAULT_PREFS.autoScreen,
            emailDigest: data.emailDigest ?? DEFAULT_PREFS.emailDigest,
            autoRejectLow: data.autoRejectLow ?? DEFAULT_PREFS.autoRejectLow,
          });
        }
      } catch (err) {
        console.error("Failed to load company settings:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  const save = async () => {
    if (!user?.uid || !db) {
      toast.error("Must be logged in to save settings");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "companies", user.uid), { name, website }, { merge: true });
      await setDoc(doc(db, "settings", user.uid), prefs, { merge: true });
      toast.success("Settings saved");
    } catch (err) {
      console.error("Failed to save company settings:", err);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Settings" description="Manage your company and hiring preferences." />
      <DashCard title="Company">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acme.com"
            />
          </div>
        </div>
        <Button variant="hero" className="mt-4" onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </DashCard>
      <DashCard title="Hiring Preferences">
        <div className="space-y-4">
          {prefKeys.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </div>
              <Switch
                checked={prefs[p.key]}
                onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, [p.key]: v }))}
              />
            </div>
          ))}
        </div>
      </DashCard>
    </>
  );
}

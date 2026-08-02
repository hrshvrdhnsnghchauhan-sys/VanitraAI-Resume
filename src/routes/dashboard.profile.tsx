import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Github,
  Linkedin,
  Globe,
  Code2,
  Trophy,
  BarChart2,
  PenTool,
  Link2,
  Edit2,
  Save,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

const defaultConnections = [
  { name: "LinkedIn", iconName: "Linkedin", connected: false, handle: "" },
  { name: "GitHub", iconName: "Github", connected: false, handle: "" },
  { name: "Portfolio", iconName: "Globe", connected: false, handle: "" },
];

const iconMap: Record<string, any> = {
  Linkedin,
  Github,
  Globe,
  Code2,
  Trophy,
  BarChart2,
  PenTool,
};

function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const [bio, setBio] = useState("Passionate about building delightful, accessible interfaces.");
  const [location, setLocation] = useState("San Francisco");
  const [role, setRole] = useState("Software Engineer");

  const [connections, setConnections] = useState<any[]>(defaultConnections);
  const [repos, setRepos] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    const fetchProfile = async () => {
      try {
        const d = await getDoc(doc(db, "users", user.uid));
        if (d.exists() && d.data().profile) {
          const p = d.data().profile;
          if (p.bio !== undefined) setBio(p.bio);
          if (p.location !== undefined) setLocation(p.location);
          if (p.role !== undefined) setRole(p.role);
          if (p.connections) setConnections(p.connections);
          if (p.repos) setRepos(p.repos);
          if (p.languages) setLanguages(p.languages);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const saveProfile = async () => {
    if (!user?.uid || !db) return;
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          profile: {
            bio,
            location,
            role,
            connections,
            repos,
            languages,
          },
        },
        { merge: true },
      );
      toast.success("Profile updated");
      setEditMode(false);
    } catch (err) {
      toast.error("Failed to save profile");
    }
  };

  return (
    <>
      <PageHeader
        title="Professional Profile"
        description="Your unified developer identity."
        action={
          editMode ? (
            <Button variant="hero" onClick={saveProfile}>
              <Save className="h-4 w-4 mr-2" /> Save Profile
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)}>
              <Edit2 className="h-4 w-4 mr-2" /> Edit Profile
            </Button>
          )
        }
      />

      <DashCard>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground mx-auto sm:mx-0">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <h2 className="text-xl font-bold">{user?.name}</h2>
            {editMode ? (
              <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Role (e.g. Senior Engineer)"
                />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location"
                />
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Bio"
                  className="sm:col-span-2"
                />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {role} · {location}
                </p>
                <p className="max-w-2xl text-sm">{bio}</p>
              </>
            )}
          </div>
        </div>
      </DashCard>

      <DashCard title="Connected Accounts">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {connections.map((c, idx) => {
            const Icon = iconMap[c.iconName] || Link2;
            return (
              <div key={idx} className="flex flex-col gap-3 rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    {!editMode && (
                      <div className="text-xs text-muted-foreground">
                        {c.connected ? c.handle : "Not connected"}
                      </div>
                    )}
                  </div>
                  {!editMode &&
                    (c.connected ? (
                      <Badge className="bg-success text-success-foreground">Connected</Badge>
                    ) : (
                      <Badge variant="outline">Missing</Badge>
                    ))}
                </div>
                {editMode && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Username / Handle"
                      value={c.handle}
                      onChange={(e) => {
                        const newConn = [...connections];
                        newConn[idx].handle = e.target.value;
                        newConn[idx].connected = !!e.target.value;
                        setConnections(newConn);
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DashCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashCard
          title="Top Projects / Repositories"
          action={
            editMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRepos([...repos, { name: "", stars: 0, lang: "" }])}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )
          }
        >
          <ul className="space-y-3">
            {repos.map((r, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm gap-2"
              >
                {editMode ? (
                  <>
                    <Input
                      className="h-8 w-1/3"
                      placeholder="Name"
                      value={r.name}
                      onChange={(e) => {
                        const nr = [...repos];
                        nr[idx].name = e.target.value;
                        setRepos(nr);
                      }}
                    />
                    <Input
                      className="h-8 w-1/4"
                      placeholder="Lang"
                      value={r.lang}
                      onChange={(e) => {
                        const nr = [...repos];
                        nr[idx].lang = e.target.value;
                        setRepos(nr);
                      }}
                    />
                    <Input
                      type="number"
                      className="h-8 w-1/4"
                      placeholder="Stars"
                      value={r.stars}
                      onChange={(e) => {
                        const nr = [...repos];
                        nr[idx].stars = Number(e.target.value);
                        setRepos(nr);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRepos(repos.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Github className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Badge variant="secondary">{r.lang}</Badge>
                      <span className="inline-flex items-center gap-1">★ {r.stars}</span>
                    </div>
                  </>
                )}
              </li>
            ))}
            {!editMode && repos.length === 0 && (
              <li className="text-muted-foreground text-sm text-center py-4">No projects added.</li>
            )}
          </ul>
        </DashCard>

        <DashCard
          title="Programming Languages"
          action={
            editMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLanguages([...languages, { name: "", value: 50 }])}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )
          }
        >
          <div className="space-y-4">
            {languages.map((l, idx) => (
              <div key={idx}>
                {editMode ? (
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      className="h-8 w-1/2"
                      placeholder="Language"
                      value={l.name}
                      onChange={(e) => {
                        const nl = [...languages];
                        nl[idx].name = e.target.value;
                        setLanguages(nl);
                      }}
                    />
                    <Input
                      type="number"
                      className="h-8 w-1/3"
                      placeholder="%"
                      value={l.value}
                      onChange={(e) => {
                        const nl = [...languages];
                        nl[idx].value = Number(e.target.value);
                        setLanguages(nl);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLanguages(languages.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span>{l.name}</span>
                      <span className="font-medium">{l.value}%</span>
                    </div>
                    <Progress value={l.value} />
                  </>
                )}
              </div>
            ))}
            {!editMode && languages.length === 0 && (
              <div className="text-muted-foreground text-sm text-center py-4">
                No languages added.
              </div>
            )}
          </div>
        </DashCard>
      </div>
    </>
  );
}

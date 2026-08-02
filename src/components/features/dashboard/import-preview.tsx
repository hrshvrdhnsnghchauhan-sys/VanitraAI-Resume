import { memo } from "react";
import { AlertTriangle, CheckCircle2, Info, Plus, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DashCard } from "@/components/dashboard/ui";
import type {
  EducationItem,
  ExperienceData,
  ProjectItem,
  ResumeData,
} from "@/lib/resume-templates";
import type { ImportIssue, ImportResult, UncertainField } from "@/lib/resume-import";

export interface ImportPreviewProps {
  result: ImportResult;
  cleaning: boolean;
  saving: boolean;
  onCleanup: () => void;
  onChange: (data: ResumeData) => void;
  onSave: () => void;
  onReset: () => void;
}

/** Highlights an editable row when the field was flagged as uncertain. */
function FieldHint({ field, uncertain }: { field: string; uncertain: UncertainField[] }) {
  const hit = uncertain.find((u) => u.field === field);
  if (!hit) return null;
  return (
    <div
      className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"
      role="note"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{hit.reason}</span>
    </div>
  );
}

function uncertainClass(uncertain: UncertainField[], field: string): string {
  const hit = uncertain.find((u) => u.field === field);
  if (!hit) return "";
  return hit.confidence === "low"
    ? "border-amber-500/70 focus-visible:ring-amber-500/40"
    : "border-amber-400/60 focus-visible:ring-amber-400/30";
}

interface ListCardProps {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
}

function ListEditor({ title, items, onChange }: ListCardProps) {
  const set = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{title}</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-primary"
          onClick={() => onChange([...items, ""])}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing detected.</p>
      ) : (
        items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => set(i, e.target.value)}
              aria-label={`${title} item ${i + 1}`}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${title} item`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

function ExperienceEditor({
  items,
  onChange,
}: {
  items: ExperienceData[];
  onChange: (items: ExperienceData[]) => void;
}) {
  const set = (id: number, patch: Partial<ExperienceData>) =>
    onChange(items.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Experience</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-primary"
          onClick={() =>
            onChange([...items, { id: Date.now(), role: "", company: "", detail: "" }])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No experience detected.</p>
      ) : (
        items.map((e) => (
          <div key={e.id} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex gap-2">
              <Input
                value={e.role}
                placeholder="Role"
                onChange={(ev) => set(e.id, { role: ev.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive"
                onClick={() => onChange(items.filter((x) => x.id !== e.id))}
                aria-label="Remove experience"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={e.company}
              placeholder="Company · dates"
              onChange={(ev) => set(e.id, { company: ev.target.value })}
            />
            <Textarea
              value={e.detail}
              placeholder="Achievements…"
              onChange={(ev) => set(e.id, { detail: ev.target.value })}
            />
          </div>
        ))
      )}
    </div>
  );
}

function EducationEditor({
  items,
  onChange,
}: {
  items: EducationItem[];
  onChange: (items: EducationItem[]) => void;
}) {
  const set = (id: number, patch: Partial<EducationItem>) =>
    onChange(items.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Education</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-primary"
          onClick={() =>
            onChange([...items, { id: Date.now(), school: "", degree: "", dates: "", detail: "" }])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No education detected.</p>
      ) : (
        items.map((e) => (
          <div key={e.id} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex gap-2">
              <Input
                value={e.school}
                placeholder="School"
                onChange={(ev) => set(e.id, { school: ev.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive"
                onClick={() => onChange(items.filter((x) => x.id !== e.id))}
                aria-label="Remove education"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={e.degree}
              placeholder="Degree"
              onChange={(ev) => set(e.id, { degree: ev.target.value })}
            />
            <Input
              value={e.dates}
              placeholder="Dates"
              onChange={(ev) => set(e.id, { dates: ev.target.value })}
            />
          </div>
        ))
      )}
    </div>
  );
}

function ProjectsEditor({
  items,
  onChange,
}: {
  items: ProjectItem[];
  onChange: (items: ProjectItem[]) => void;
}) {
  const set = (id: number, patch: Partial<ProjectItem>) =>
    onChange(items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Projects</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-primary"
          onClick={() => onChange([...items, { id: Date.now(), name: "", link: "", detail: "" }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects detected.</p>
      ) : (
        items.map((p) => (
          <div key={p.id} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex gap-2">
              <Input
                value={p.name}
                placeholder="Project name"
                onChange={(ev) => set(p.id, { name: ev.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive"
                onClick={() => onChange(items.filter((x) => x.id !== p.id))}
                aria-label="Remove project"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={p.link}
              placeholder="Link (optional)"
              onChange={(ev) => set(p.id, { link: ev.target.value })}
            />
            <Textarea
              value={p.detail}
              placeholder="Details…"
              onChange={(ev) => set(p.id, { detail: ev.target.value })}
            />
          </div>
        ))
      )}
    </div>
  );
}

function IssuesList({ issues }: { issues: ImportIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      {issues.map((issue, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
            issue.severity === "warning" &&
              "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
            issue.severity === "info" && "border-border bg-accent/40 text-muted-foreground",
          )}
        >
          {issue.severity === "warning" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

export const ImportPreview = memo(function ImportPreview({
  result,
  cleaning,
  saving,
  onCleanup,
  onChange,
  onSave,
  onReset,
}: ImportPreviewProps) {
  const { data, uncertain, issues, suggestions, stats } = result;
  const set = (patch: Partial<ResumeData>) => onChange({ ...data, ...patch });

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="uppercase">
            {stats.source}
            {stats.pages ? ` · ${stats.pages} page${stats.pages > 1 ? "s" : ""}` : ""}
          </Badge>
          <Badge variant="outline">{stats.words} words</Badge>
          {uncertain.length > 0 && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mr-1 h-3 w-3" /> {uncertain.length} field
              {uncertain.length > 1 ? "s" : ""} to review
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset} disabled={cleaning || saving}>
            <X className="h-4 w-4 mr-1.5" /> Start over
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCleanup}
            disabled={cleaning || saving}
            className="text-primary hover:text-primary/80"
          >
            {cleaning ? (
              <Sparkles className="h-4 w-4 mr-1.5 animate-pulse" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            AI Cleanup
          </Button>
          <Button variant="hero" size="sm" onClick={onSave} disabled={cleaning || saving}>
            {saving ? "Saving…" : "Confirm & Create Resume"}
          </Button>
        </div>
      </div>

      {issues.length > 0 && <IssuesList issues={issues} />}

      {suggestions.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Suggested improvements
          </p>
          {suggestions.map((s, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {s}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact */}
        <DashCard title="Contact & Header">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={data.name}
                onChange={(e) => set({ name: e.target.value })}
                className={uncertainClass(uncertain, "name")}
              />
              <FieldHint field="name" uncertain={uncertain} />
            </div>
            <div className="space-y-1.5">
              <Label>Headline</Label>
              <Input
                value={data.title}
                onChange={(e) => set({ title: e.target.value })}
                className={uncertainClass(uncertain, "title")}
              />
              <FieldHint field="title" uncertain={uncertain} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={data.email}
                onChange={(e) => set({ email: e.target.value })}
                className={uncertainClass(uncertain, "email")}
              />
              <FieldHint field="email" uncertain={uncertain} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={data.phone}
                onChange={(e) => set({ phone: e.target.value })}
                className={uncertainClass(uncertain, "phone")}
              />
              <FieldHint field="phone" uncertain={uncertain} />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={data.location} onChange={(e) => set({ location: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>LinkedIn</Label>
              <Input value={data.linkedin} onChange={(e) => set({ linkedin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={data.website} onChange={(e) => set({ website: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>GitHub</Label>
              <Input
                value={data.github ?? ""}
                onChange={(e) => set({ github: e.target.value || undefined })}
              />
            </div>
          </div>
        </DashCard>

        {/* Summary & skills */}
        <DashCard title="Summary & Skills">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Summary</Label>
              <Textarea
                value={data.summary}
                onChange={(e) => set({ summary: e.target.value })}
                className="min-h-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Skills</Label>
              <Textarea
                value={data.skills}
                onChange={(e) => set({ skills: e.target.value })}
                placeholder="Comma separated"
                className="min-h-16"
              />
            </div>
          </div>
        </DashCard>

        {/* Experience */}
        <DashCard title="Experience">
          <ExperienceEditor
            items={data.experiences}
            onChange={(experiences) => set({ experiences })}
          />
        </DashCard>

        {/* Education */}
        <DashCard title="Education">
          <EducationEditor items={data.education} onChange={(education) => set({ education })} />
        </DashCard>

        {/* Projects */}
        <DashCard title="Projects">
          <ProjectsEditor items={data.projects} onChange={(projects) => set({ projects })} />
        </DashCard>

        {/* Lists */}
        <DashCard title="Certifications & More">
          <div className="space-y-5">
            <ListEditor
              title="Certifications"
              items={data.certifications}
              onChange={(certifications) => set({ certifications })}
            />
            <ListEditor
              title="Languages"
              items={data.languages}
              onChange={(languages) => set({ languages })}
            />
            <ListEditor
              title="Awards"
              items={data.awards ?? []}
              onChange={(awards) => set({ awards: awards.length ? awards : undefined })}
            />
            <ListEditor
              title="Publications"
              items={data.publications ?? []}
              onChange={(publications) =>
                set({ publications: publications.length ? publications : undefined })
              }
            />
            <ListEditor
              title="Volunteer"
              items={data.volunteer ?? []}
              onChange={(volunteer) => set({ volunteer: volunteer.length ? volunteer : undefined })}
            />
          </div>
        </DashCard>
      </div>
    </div>
  );
});

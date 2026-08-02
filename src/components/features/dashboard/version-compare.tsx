import { useMemo } from "react";
import { ArrowRight, GitCompare, Plus, Minus, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { diffVersions, formatVersionTime, type ResumeVersion } from "@/lib/resume-version";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const sign = invert ? -value : value;
  if (sign === 0) return <span className="text-xs text-muted-foreground">No change</span>;
  const up = sign > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        up ? "text-success" : "text-destructive",
      )}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {sign}
    </span>
  );
}

function Row({
  label,
  before,
  after,
  status,
}: {
  label: string;
  before?: string;
  after?: string;
  status: "same" | "changed" | "added" | "removed";
}) {
  const bg =
    status === "changed"
      ? "bg-warning/10"
      : status === "added"
        ? "bg-success/10"
        : status === "removed"
          ? "bg-destructive/10"
          : "";
  return (
    <div className={cn("rounded-lg border border-border/60 px-3 py-2.5", bg)}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div
          className={cn(
            "text-sm leading-relaxed",
            status === "removed" ? "line-through opacity-70" : "",
          )}
        >
          {before || <span className="text-muted-foreground/50">—</span>}
        </div>
        <div className={cn("text-sm leading-relaxed", status === "added" ? "font-medium" : "")}>
          {after || <span className="text-muted-foreground/50">—</span>}
        </div>
      </div>
    </div>
  );
}

function ListDiffBlock({
  label,
  added,
  removed,
  changed,
}: {
  label: string;
  added: string[];
  removed: string[];
  changed: number;
}) {
  if (added.length === 0 && removed.length === 0 && changed === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {changed > 0 && <span className="ml-2 text-warning">· {changed} changed</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {added.map((x) => (
          <Badge key={"a" + x} variant="secondary" className="bg-success/10 text-success">
            <Plus className="mr-1 h-3 w-3" /> {x}
          </Badge>
        ))}
        {removed.map((x) => (
          <Badge key={"r" + x} variant="secondary" className="bg-destructive/10 text-destructive">
            <Minus className="mr-1 h-3 w-3" /> {x}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function VersionCompare({
  versions,
  versionA,
  versionB,
  onSelectA,
  onSelectB,
}: {
  versions: ResumeVersion[];
  versionA: ResumeVersion | null;
  versionB: ResumeVersion | null;
  onSelectA: (id: string) => void;
  onSelectB: (id: string) => void;
}) {
  const active = versions.filter((v) => !v.deletedAt);

  const diff = useMemo(() => {
    if (!versionA || !versionB) return null;
    return diffVersions(versionA.data, versionB.data);
  }, [versionA, versionB]);

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <Select value={versionA?.id || ""} onValueChange={onSelectA}>
          <SelectTrigger aria-label="Version A">
            <SelectValue placeholder="Select version A" />
          </SelectTrigger>
          <SelectContent>
            {active.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <GitCompare className="h-4 w-4" />
          <ArrowRight className="h-4 w-4" />
        </div>

        <Select value={versionB?.id || ""} onValueChange={onSelectB}>
          <SelectTrigger aria-label="Version B">
            <SelectValue placeholder="Select version B" />
          </SelectTrigger>
          <SelectContent>
            {active.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!versionA || !versionB ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <GitCompare className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium">Pick two versions to compare</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Changes, ATS, skills and keywords are highlighted side-by-side.
          </p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground">ATS score</div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="text-2xl font-bold">{versionA.atsScore ?? 0}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{versionB.atsScore ?? 0}</span>
              </div>
              <div className="mt-1">
                <Delta value={diff?.atsDelta ?? 0} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground">Completion</div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="text-2xl font-bold">{versionA.completion ?? 0}%</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{versionB.completion ?? 0}%</span>
              </div>
              <div className="mt-1">
                <Delta value={diff?.completionDelta ?? 0} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground">Timestamps</div>
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                <div>{formatVersionTime(versionA)}</div>
                <ArrowRight className="mx-auto h-3 w-3" />
                <div>{formatVersionTime(versionB)}</div>
              </div>
            </div>
          </div>

          {diff && (
            <>
              {/* Field diffs */}
              <div className="space-y-2">
                {diff.fields.length === 0 &&
                diff.lists.every(
                  (l) => l.added.length === 0 && l.removed.length === 0 && l.changed === 0,
                ) ? (
                  <div className="rounded-lg border border-border/60 p-4 text-center text-sm text-muted-foreground">
                    No content differences between these two versions.
                  </div>
                ) : null}
                {diff.fields.map((f) => (
                  <Row
                    key={f.key}
                    label={f.label}
                    before={f.before}
                    after={f.after}
                    status={f.status}
                  />
                ))}
              </div>

              {/* List diffs */}
              <div className="grid gap-3 lg:grid-cols-3">
                {diff.lists.map((l) => (
                  <ListDiffBlock
                    key={l.key}
                    label={l.label}
                    added={l.added}
                    removed={l.removed}
                    changed={l.changed}
                  />
                ))}
              </div>

              {/* Skills + keywords */}
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Skills
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {diff.skills.added.length === 0 && diff.skills.removed.length === 0 && (
                      <span className="text-xs text-muted-foreground">No skill changes</span>
                    )}
                    {diff.skills.added.map((s) => (
                      <Badge
                        key={"s" + s}
                        variant="secondary"
                        className="bg-success/10 text-success"
                      >
                        <Plus className="mr-1 h-3 w-3" /> {s}
                      </Badge>
                    ))}
                    {diff.skills.removed.map((s) => (
                      <Badge
                        key={"s" + s}
                        variant="secondary"
                        className="bg-destructive/10 text-destructive"
                      >
                        <Minus className="mr-1 h-3 w-3" /> {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Keywords
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {diff.keywords.added.length === 0 && diff.keywords.removed.length === 0 && (
                      <span className="text-xs text-muted-foreground">No keyword changes</span>
                    )}
                    {diff.keywords.added.map((k) => (
                      <Badge
                        key={"k" + k}
                        variant="secondary"
                        className="bg-success/10 text-success"
                      >
                        <Plus className="mr-1 h-3 w-3" /> {k}
                      </Badge>
                    ))}
                    {diff.keywords.removed.map((k) => (
                      <Badge
                        key={"k" + k}
                        variant="secondary"
                        className="bg-destructive/10 text-destructive"
                      >
                        <Minus className="mr-1 h-3 w-3" /> {k}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {diff.templateChanged && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  These versions use different resume templates.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

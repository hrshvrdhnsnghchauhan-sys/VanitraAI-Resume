import { memo, useMemo, useState } from "react";
import {
  Star,
  StarOff,
  Copy,
  RotateCcw,
  Trash2,
  GitCompare,
  Search,
  ArchiveRestore,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatVersionTime, versionTime, type ResumeVersion } from "@/lib/resume-version";
import { getTemplateById } from "@/lib/resume-templates";

const PAGE = 10;

const SOURCE_LABEL: Record<string, string> = {
  autosave: "Autosave",
  manual: "Manual",
  restore: "Restore",
  duplicate: "Duplicate",
};

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "bg-success/10 text-success"
      : score >= 50
        ? "bg-warning/10 text-warning"
        : "bg-destructive/10 text-destructive";
  return (
    <Badge variant="secondary" className={cn("font-mono", tone)}>
      ATS {score}
    </Badge>
  );
}

const VersionCard = memo(function VersionCard({
  version,
  onFavorite,
  onRestore,
  onDuplicate,
  onDelete,
  onCompare,
}: {
  version: ResumeVersion;
  onFavorite: (v: ResumeVersion) => void;
  onRestore: (v: ResumeVersion) => void;
  onDuplicate: (v: ResumeVersion) => void;
  onDelete: (v: ResumeVersion) => void;
  onCompare: (v: ResumeVersion) => void;
}) {
  const template = version.templateId ? getTemplateById(version.templateId) : null;
  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-primary/40 hover:shadow-md",
        version.isFavorite && "border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-semibold">{version.name}</h4>
            {version.source === "autosave" && (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatVersionTime(version)}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {SOURCE_LABEL[version.source] ?? version.source}
            </Badge>
            {template && (
              <Badge variant="outline" className="text-[10px]">
                {template.name}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ScoreBadge score={version.atsScore ?? 0} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onFavorite(version)}
            aria-label={version.isFavorite ? "Unfavorite version" : "Favorite version"}
            aria-pressed={version.isFavorite}
          >
            {version.isFavorite ? (
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            ) : (
              <StarOff className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {version.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{version.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
        <Button variant="outline" size="sm" onClick={() => onRestore(version)}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDuplicate(version)}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={() => onCompare(version)}>
          <GitCompare className="mr-1.5 h-3.5 w-3.5" /> Compare
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(version)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Trash
        </Button>
      </div>
    </div>
  );
});

export function VersionTimeline({
  versions,
  onFavorite,
  onRestore,
  onDuplicate,
  onDelete,
  onCompare,
  onUntrash,
  onPurge,
  templateFilter,
  onTemplateFilter,
  atsFilter,
  onAtsFilter,
  dateFilter,
  onDateFilter,
}: {
  versions: ResumeVersion[];
  onFavorite: (v: ResumeVersion) => void;
  onRestore: (v: ResumeVersion) => void;
  onDuplicate: (v: ResumeVersion) => void;
  onDelete: (v: ResumeVersion) => void;
  onCompare: (v: ResumeVersion) => void;
  onUntrash: (v: ResumeVersion) => void;
  onPurge: (v: ResumeVersion) => void;
  templateFilter: string;
  onTemplateFilter: (id: string) => void;
  atsFilter: string;
  onAtsFilter: (v: string) => void;
  dateFilter: string;
  onDateFilter: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "favorites" | "autosave" | "manual" | "restore" | "duplicate"
  >("all");
  const [visible, setVisible] = useState(PAGE);

  const active = useMemo(
    () =>
      versions
        .filter((v) => !v.deletedAt)
        .sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
          return versionTime(b) - versionTime(a);
        }),
    [versions],
  );

  const trashed = useMemo(
    () => versions.filter((v) => v.deletedAt).sort((a, b) => versionTime(b) - versionTime(a)),
    [versions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return active
      .filter((v) =>
        filter === "all" ? true : filter === "favorites" ? v.isFavorite : v.source === filter,
      )
      .filter((v) => (templateFilter === "all" ? true : v.templateId === templateFilter))
      .filter((v) => {
        if (atsFilter === "all") return true;
        const s = v.atsScore ?? 0;
        if (atsFilter === "high") return s >= 80;
        if (atsFilter === "mid") return s >= 50 && s < 80;
        return s < 50;
      })
      .filter((v) => {
        if (dateFilter === "all") return true;
        const ms = versionTime(v);
        const days = dateFilter === "7" ? 7 : dateFilter === "30" ? 30 : 90;
        return now - ms <= days * 24 * 60 * 60 * 1000;
      })
      .filter(
        (v) =>
          !q || v.name.toLowerCase().includes(q) || (v.description || "").toLowerCase().includes(q),
      );
  }, [active, search, filter, templateFilter, atsFilter, dateFilter]);

  const templatesUsed = useMemo(() => {
    const ids = [...new Set(active.map((v) => v.templateId).filter(Boolean))] as string[];
    return ids
      .map((id) => ({ id, name: getTemplateById(id).name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [active]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisible(PAGE);
            }}
            placeholder="Search versions by name or note…"
            className="pl-9"
            aria-label="Search versions"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v as typeof filter);
            setVisible(PAGE);
          }}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="favorites">Favorites</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="autosave">Autosaves</SelectItem>
            <SelectItem value="restore">Restores</SelectItem>
            <SelectItem value="duplicate">Duplicates</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={templateFilter}
          onValueChange={(v) => {
            onTemplateFilter(v);
            setVisible(PAGE);
          }}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by template">
            <SelectValue placeholder="Template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templatesUsed.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={atsFilter}
          onValueChange={(v) => {
            onAtsFilter(v);
            setVisible(PAGE);
          }}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by ATS score">
            <SelectValue placeholder="ATS score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any ATS</SelectItem>
            <SelectItem value="high">80–100</SelectItem>
            <SelectItem value="mid">50–79</SelectItem>
            <SelectItem value="low">0–49</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={dateFilter}
          onValueChange={(v) => {
            onDateFilter(v);
            setVisible(PAGE);
          }}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by date">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any date</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      <div className="relative space-y-3 pl-5 before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-px before:bg-border">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Clock className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-medium">No versions match</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {versions.length === 0
                ? "Save your first snapshot to build a history."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          shown.map((v) => (
            <div key={v.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[22px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                  v.isFavorite ? "bg-amber-400" : "bg-primary/60",
                )}
                aria-hidden="true"
              />
              <VersionCard
                version={v}
                onFavorite={onFavorite}
                onRestore={onRestore}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onCompare={onCompare}
              />
            </div>
          ))
        )}
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            className="ml-6"
            onClick={() => setVisible((n) => n + PAGE)}
          >
            Load more ({filtered.length - visible} remaining)
          </Button>
        )}
      </div>

      {/* Trash */}
      {trashed.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ArchiveRestore className="h-3.5 w-3.5" /> Trash ({trashed.length})
          </h4>
          <div className="space-y-2">
            {trashed.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium opacity-70">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{formatVersionTime(v)}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="outline" size="sm" onClick={() => onUntrash(v)}>
                    <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onPurge(v)}
                  >
                    Delete forever
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo } from "react";
import { GitBranch, Star, TrendingUp, Trophy, Gauge } from "lucide-react";
import { StatCard } from "@/components/dashboard/ui";
import { versionTime, type ResumeVersion } from "@/lib/resume-version";

function Sparkline({
  points,
  color,
  height = 64,
}: {
  points: number[];
  color: string;
  height?: number;
}) {
  const { path, area, min, max } = useMemo(() => {
    const width = 240;
    const pad = 4;
    if (points.length < 2) {
      return {
        path: "",
        area: "",
        min: 0,
        max: 100,
      };
    }
    const lo = Math.min(...points);
    const hi = Math.max(...points);
    const range = hi - lo || 1;
    const stepX = (width - pad * 2) / (points.length - 1);
    const coords = points.map((p, i) => ({
      x: pad + i * stepX,
      y: height - pad - ((p - lo) / range) * (height - pad * 2),
    }));
    const d = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");
    return {
      path: d,
      area: `${d} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`,
      min: lo,
      max: hi,
    };
  }, [points, height]);

  if (points.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
        Need 2+ versions to chart
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{Math.round(max)}</span>
        <span>{Math.round(min)}</span>
      </div>
      <svg
        viewBox={`0 0 240 ${height}`}
        className="w-full"
        role="img"
        aria-label="Score progression chart"
      >
        <path d={area} fill={color} opacity="0.12" />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const last = points.length - 1;
          const x = 4 + (i * (240 - 8)) / (last || 1);
          const lo = Math.min(...points);
          const hi = Math.max(...points);
          const range = hi - lo || 1;
          const y = height - 4 - ((p - lo) / range) * (height - 8);
          return <circle key={i} cx={x} cy={y} r={i === last ? 3 : 2} fill={color} />;
        })}
      </svg>
    </div>
  );
}

export function VersionAnalytics({ versions }: { versions: ResumeVersion[] }) {
  const stats = useMemo(() => {
    const active = versions.filter((v) => !v.deletedAt);
    const scores = active.map((v) => v.atsScore ?? 0);
    const completion = active.map((v) => v.completion ?? 0);
    const byTime = [...active].sort((a, b) => versionTime(a) - versionTime(b));
    return {
      total: active.length,
      favorites: active.filter((v) => v.isFavorite).length,
      avgAts: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      best: scores.length ? Math.max(...scores) : 0,
      atsSeries: byTime.map((v) => v.atsScore ?? 0),
      completionSeries: byTime.map((v) => v.completion ?? 0),
    };
  }, [versions]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Versions" value={stats.total} icon={GitBranch} />
      <StatCard label="Favorites" value={stats.favorites} icon={Star} />
      <StatCard label="Average ATS" value={stats.avgAts} suffix="/100" icon={Gauge} />
      <StatCard label="Best ATS" value={stats.best} suffix="/100" icon={Trophy} />
    </div>
  );
}

export function VersionCharts({ versions }: { versions: ResumeVersion[] }) {
  const active = versions.filter((v) => !v.deletedAt);
  const series = useMemo(
    () => [...active].sort((a, b) => versionTime(a) - versionTime(b)),
    [active],
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">ATS score progression</h4>
        </div>
        <Sparkline points={series.map((v) => v.atsScore ?? 0)} color="var(--primary)" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Resume completion progression</h4>
        </div>
        <Sparkline points={series.map((v) => v.completion ?? 0)} color="var(--success)" />
      </div>
    </div>
  );
}

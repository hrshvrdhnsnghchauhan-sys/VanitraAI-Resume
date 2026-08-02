import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Palette,
  LayoutTemplate,
  ListOrdered,
  FileText,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  CATEGORIES,
  RESUME_ACCENTS,
  RESUME_FONTS,
  RESUME_TEMPLATES,
  SECTIONS,
  sectionLabel,
  type CategoryId,
  type ResumeData,
  type SectionId,
  type TemplateConfig as TemplateConfigType,
} from "@/lib/resume-templates";

// ---------------------------------------------------------------------------
// Mini gallery previews — cheap abstract renderings, no full engine needed
// ---------------------------------------------------------------------------

function Thumb({ layout, accent }: { layout: string; accent: string }) {
  const bar = (w: string, i: number) => (
    <div key={i} className="h-1 rounded-full" style={{ width: w, background: "#cbd5e1" }} />
  );
  if (layout === "sidebar") {
    return (
      <div className="flex h-full gap-1.5 p-2">
        <div className="flex w-1/3 flex-col gap-1 rounded-sm" style={{ background: `${accent}14` }}>
          <div className="h-1.5 w-3/4 rounded-sm" style={{ background: accent }} />
          {bar("90%", 1)}
          {bar("70%", 2)}
          {bar("80%", 3)}
        </div>
        <div className="flex flex-1 flex-col gap-1 py-0.5">
          <div className="h-1.5 w-2/3 rounded-sm" style={{ background: "#334155" }} />
          {bar("95%", 4)}
          {bar("85%", 5)}
          <div className="mt-1 h-px w-full bg-slate-200" />
          {bar("90%", 6)}
          {bar("75%", 7)}
        </div>
      </div>
    );
  }
  if (layout === "creative") {
    return (
      <div className="flex h-full flex-col gap-1 p-2">
        <div className="flex items-center gap-1.5 rounded-sm p-1.5" style={{ background: accent }}>
          <div className="h-1.5 w-1/2 rounded-sm bg-white" />
          <div className="ml-auto h-1 w-1/4 rounded-sm bg-white/70" />
        </div>
        <div className="mt-1 flex items-center gap-1">
          <div className="h-1 w-1/4 rounded-sm" style={{ background: accent }} />
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        {bar("92%", 1)}
        {bar("78%", 2)}
        {bar("86%", 3)}
      </div>
    );
  }
  if (layout === "executive") {
    return (
      <div className="flex h-full flex-col items-center gap-1 p-2">
        <div className="h-px w-full bg-slate-400" />
        <div className="mt-1 h-2 w-3/4 rounded-sm" style={{ background: "#334155" }} />
        <div className="h-1 w-1/2 rounded-sm bg-slate-300" />
        <div className="h-px w-full bg-slate-300" />
        <div className="mt-2 flex w-full flex-col gap-1">
          {bar("88%", 1)}
          {bar("70%", 2)}
        </div>
      </div>
    );
  }
  if (layout === "minimal") {
    return (
      <div className="flex h-full flex-col gap-1.5 p-2 pt-3">
        <div className="h-2 w-1/2 rounded-sm" style={{ background: "#334155" }} />
        <div className="h-1 w-1/3 rounded-sm bg-slate-300" />
        <div className="mt-1 h-1 w-1/4 rounded-sm bg-slate-300" />
        {bar("94%", 1)}
        {bar("80%", 2)}
        {bar("88%", 3)}
      </div>
    );
  }
  // classic / modern / timeline
  return (
    <div className="flex h-full flex-col gap-1 p-2">
      <div
        className="h-2 w-3/4 rounded-sm"
        style={{ background: layout === "timeline" ? accent : "#334155" }}
      />
      <div className="h-1 w-1/2 rounded-sm" style={{ background: accent }} />
      <div className="mt-0.5 h-px w-full bg-slate-200" />
      <div className="mt-1 flex flex-col gap-1">
        {bar("92%", 1)}
        {bar("80%", 2)}
        {bar("86%", 3)}
      </div>
      {layout === "timeline" && (
        <div className="mt-0.5 flex gap-1">
          <div className="w-1 rounded-sm" style={{ background: accent }} />
          <div className="flex flex-1 flex-col gap-1">
            {bar("70%", 4)}
            {bar("88%", 5)}
          </div>
        </div>
      )}
    </div>
  );
}

export function TemplateGallery({
  activeCategory,
  onCategoryChange,
  selectedId,
  onSelect,
}: {
  activeCategory: CategoryId | "all";
  onCategoryChange: (c: CategoryId | "all") => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const list = useMemo(
    () =>
      activeCategory === "all"
        ? RESUME_TEMPLATES
        : RESUME_TEMPLATES.filter((t) => t.category === activeCategory),
    [activeCategory],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCategoryChange("all")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
            activeCategory === "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
          aria-pressed={activeCategory === "all"}
        >
          All ({RESUME_TEMPLATES.length})
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCategoryChange(c.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              activeCategory === c.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
            aria-pressed={activeCategory === c.id}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-pressed={selectedId === t.id}
            className={cn(
              "group overflow-hidden rounded-xl border text-left transition-all",
              selectedId === t.id
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/40 hover:shadow-md",
            )}
          >
            <div className="relative aspect-[210/297] bg-white p-1.5 dark:bg-slate-50">
              <Thumb layout={t.layout} accent={t.accent} />
              {selectedId === t.id && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
            <div className="border-t border-border bg-card px-2.5 py-2">
              <div className="text-xs font-semibold">{t.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {CATEGORIES.find((c) => c.id === t.category)?.label}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customizer — Design / Sections / Content tabs
// ---------------------------------------------------------------------------

interface CustomizerProps {
  config: TemplateConfigType;
  onChange: (c: TemplateConfigType) => void;
  data: ResumeData;
  onDataChange: (d: ResumeData) => void;
  onReset: () => void;
}

function patchConfig(
  c: TemplateConfigType,
  patch: Partial<TemplateConfigType>,
): TemplateConfigType {
  return { ...c, ...patch };
}

export function TemplateCustomizer({
  config,
  onChange,
  data,
  onDataChange,
  onReset,
}: CustomizerProps) {
  const [tab, setTab] = useState("design");

  const setConfig = (patch: Partial<TemplateConfigType>) => onChange(patchConfig(config, patch));

  // Section ordering
  const moveSection = (id: SectionId, dir: -1 | 1) => {
    const idx = config.sections.indexOf(id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= config.sections.length) return;
    const next = [...config.sections];
    [next[idx], next[to]] = [next[to], next[idx]];
    setConfig({ sections: next });
  };

  const toggleSection = (id: SectionId) => {
    const hidden = !config.sections.includes(id);
    setConfig({
      sections: hidden ? [...config.sections, id] : config.sections.filter((s) => s !== id),
    });
  };

  const visible = config.sections;
  const hiddenSections = SECTIONS.filter((s) => !config.sections.includes(s.id));

  // Data helpers
  const setField = (key: keyof ResumeData, value: ResumeData[keyof ResumeData]) =>
    onDataChange({ ...data, [key]: value });

  return (
    <div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="design">
            <Palette className="mr-1.5 h-3.5 w-3.5" /> Design
          </TabsTrigger>
          <TabsTrigger value="sections">
            <ListOrdered className="mr-1.5 h-3.5 w-3.5" /> Sections
          </TabsTrigger>
          <TabsTrigger value="content">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Content
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------ DESIGN */}
        <TabsContent value="design" className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-font">Font</Label>
            <Select value={config.font} onValueChange={(v) => setConfig({ font: v })}>
              <SelectTrigger id="tpl-font">
                <SelectValue placeholder="Font" />
              </SelectTrigger>
              <SelectContent>
                {RESUME_FONTS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-size">Font size</Label>
              <span className="text-xs text-muted-foreground">{config.fontSize}px</span>
            </div>
            <Slider
              id="tpl-size"
              min={9}
              max={14}
              step={0.5}
              value={[config.fontSize]}
              onValueChange={([v]) => setConfig({ fontSize: v })}
              aria-label="Font size"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-spacing">Line spacing</Label>
              <span className="text-xs text-muted-foreground">{config.lineHeight.toFixed(2)}</span>
            </div>
            <Slider
              id="tpl-spacing"
              min={1.2}
              max={2}
              step={0.05}
              value={[config.lineHeight]}
              onValueChange={([v]) => setConfig({ lineHeight: v })}
              aria-label="Line spacing"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-margin">Margins</Label>
              <span className="text-xs text-muted-foreground">{config.margin}px</span>
            </div>
            <Slider
              id="tpl-margin"
              min={28}
              max={76}
              step={2}
              value={[config.margin]}
              onValueChange={([v]) => setConfig({ margin: v })}
              aria-label="Margins"
            />
          </div>

          <div className="space-y-2">
            <Label>Accent color</Label>
            <div className="flex flex-wrap gap-2">
              {RESUME_ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.label}
                  onClick={() => setConfig({ accent: a.value })}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                    config.accent.toLowerCase() === a.value.toLowerCase()
                      ? "border-foreground"
                      : "border-transparent",
                  )}
                  style={{ background: a.value }}
                  aria-label={`Accent ${a.label}`}
                  aria-pressed={config.accent.toLowerCase() === a.value.toLowerCase()}
                />
              ))}
              <label
                className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-dashed border-border"
                title="Custom color"
              >
                <span
                  className="absolute inset-0"
                  style={{
                    background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
                  }}
                />
                <input
                  type="color"
                  value={config.accent}
                  onChange={(e) => setConfig({ accent: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Custom accent color"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Header layout</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "left", icon: AlignLeft, label: "Left" },
                  { id: "center", icon: AlignCenter, label: "Center" },
                  { id: "split", icon: AlignRight, label: "Split" },
                ] as const
              ).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setConfig({ header: h.id })}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-all",
                    config.header === h.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                  aria-pressed={config.header === h.id}
                >
                  <h.icon className="h-3.5 w-3.5" /> {h.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Icons</div>
              <div className="text-xs text-muted-foreground">Section & contact icons</div>
            </div>
            <Switch
              checked={config.icons}
              onCheckedChange={(v) => setConfig({ icons: v })}
              aria-label="Toggle icons"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-page">Page size</Label>
            <Select
              value={config.pageSize}
              onValueChange={(v) => setConfig({ pageSize: v as "a4" | "letter" })}
            >
              <SelectTrigger id="tpl-page">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                <SelectItem value="letter">Letter (8.5 × 11 in)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={onReset}>
            Reset to template defaults
          </Button>
        </TabsContent>

        {/* ---------------------------------------------- SECTIONS */}
        <TabsContent value="sections" className="space-y-4">
          <div className="rounded-lg border border-border">
            {visible.map((id, i) => (
              <div
                key={id}
                className="flex items-center justify-between border-b border-border px-3 py-2.5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="flex w-5 justify-center text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{sectionLabel(id)}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveSection(id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${sectionLabel(id)} up`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveSection(id, 1)}
                    disabled={i === visible.length - 1}
                    aria-label={`Move ${sectionLabel(id)} down`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => toggleSection(id)}
                    aria-label={`Hide ${sectionLabel(id)}`}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {hiddenSections.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Hidden sections</p>
              <div className="flex flex-wrap gap-2">
                {hiddenSections.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSection(s.id)}
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> {sectionLabel(s.id)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ----------------------------------------------- CONTENT */}
        <TabsContent value="content" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rt-name">Full name</Label>
              <Input
                id="rt-name"
                value={data.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-title">Title</Label>
              <Input
                id="rt-title"
                value={data.title}
                onChange={(e) => setField("title", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-email">Email</Label>
              <Input
                id="rt-email"
                type="email"
                value={data.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-phone">Phone</Label>
              <Input
                id="rt-phone"
                value={data.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-location">Location</Label>
              <Input
                id="rt-location"
                value={data.location}
                onChange={(e) => setField("location", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-website">Website</Label>
              <Input
                id="rt-website"
                value={data.website}
                onChange={(e) => setField("website", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rt-linkedin">LinkedIn</Label>
              <Input
                id="rt-linkedin"
                value={data.linkedin}
                onChange={(e) => setField("linkedin", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rt-summary">Summary</Label>
            <Textarea
              id="rt-summary"
              className="min-h-24"
              value={data.summary}
              onChange={(e) => setField("summary", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rt-skills">Skills</Label>
            <Input
              id="rt-skills"
              value={data.skills}
              onChange={(e) => setField("skills", e.target.value)}
              placeholder="Comma separated"
            />
          </div>

          {/* Experience */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Experience</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onDataChange({
                    ...data,
                    experiences: [
                      ...data.experiences,
                      { id: Date.now(), role: "", company: "", detail: "" },
                    ],
                  })
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {data.experiences.map((e) => (
              <div key={e.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input
                    value={e.role}
                    placeholder="Role"
                    onChange={(ev) =>
                      onDataChange({
                        ...data,
                        experiences: data.experiences.map((x) =>
                          x.id === e.id ? { ...x, role: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onDataChange({
                        ...data,
                        experiences: data.experiences.filter((x) => x.id !== e.id),
                      })
                    }
                    aria-label="Remove experience"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input
                  value={e.company}
                  placeholder="Company · dates"
                  onChange={(ev) =>
                    onDataChange({
                      ...data,
                      experiences: data.experiences.map((x) =>
                        x.id === e.id ? { ...x, company: ev.target.value } : x,
                      ),
                    })
                  }
                />
                <Textarea
                  className="min-h-16"
                  value={e.detail}
                  placeholder="• Achievements…"
                  onChange={(ev) =>
                    onDataChange({
                      ...data,
                      experiences: data.experiences.map((x) =>
                        x.id === e.id ? { ...x, detail: ev.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>

          {/* Education */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Education</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onDataChange({
                    ...data,
                    education: [
                      ...data.education,
                      { id: Date.now(), school: "", degree: "", dates: "", detail: "" },
                    ],
                  })
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {data.education.map((ed) => (
              <div key={ed.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input
                    value={ed.school}
                    placeholder="School"
                    onChange={(ev) =>
                      onDataChange({
                        ...data,
                        education: data.education.map((x) =>
                          x.id === ed.id ? { ...x, school: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onDataChange({
                        ...data,
                        education: data.education.filter((x) => x.id !== ed.id),
                      })
                    }
                    aria-label="Remove education"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={ed.degree}
                    placeholder="Degree"
                    onChange={(ev) =>
                      onDataChange({
                        ...data,
                        education: data.education.map((x) =>
                          x.id === ed.id ? { ...x, degree: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                  <Input
                    value={ed.dates}
                    placeholder="Dates"
                    onChange={(ev) =>
                      onDataChange({
                        ...data,
                        education: data.education.map((x) =>
                          x.id === ed.id ? { ...x, dates: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                </div>
                <Textarea
                  className="min-h-14"
                  value={ed.detail}
                  placeholder="Details"
                  onChange={(ev) =>
                    onDataChange({
                      ...data,
                      education: data.education.map((x) =>
                        x.id === ed.id ? { ...x, detail: ev.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>

          {/* Projects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Projects</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onDataChange({
                    ...data,
                    projects: [
                      ...data.projects,
                      { id: Date.now(), name: "", link: "", detail: "" },
                    ],
                  })
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {data.projects.map((p) => (
              <div key={p.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input
                    value={p.name}
                    placeholder="Project name"
                    onChange={(ev) =>
                      onDataChange({
                        ...data,
                        projects: data.projects.map((x) =>
                          x.id === p.id ? { ...x, name: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onDataChange({
                        ...data,
                        projects: data.projects.filter((x) => x.id !== p.id),
                      })
                    }
                    aria-label="Remove project"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input
                  value={p.link}
                  placeholder="Link (github.com/…)"
                  onChange={(ev) =>
                    onDataChange({
                      ...data,
                      projects: data.projects.map((x) =>
                        x.id === p.id ? { ...x, link: ev.target.value } : x,
                      ),
                    })
                  }
                />
                <Textarea
                  className="min-h-14"
                  value={p.detail}
                  placeholder="Details"
                  onChange={(ev) =>
                    onDataChange({
                      ...data,
                      projects: data.projects.map((x) =>
                        x.id === p.id ? { ...x, detail: ev.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>

          {/* Certifications & languages (comma list, stored as arrays) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rt-certs">Certifications</Label>
              <Input
                id="rt-certs"
                value={data.certifications.join(", ")}
                onChange={(e) =>
                  setField(
                    "certifications",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="AWS, PMP…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-langs">Languages</Label>
              <Input
                id="rt-langs"
                value={data.languages.join(", ")}
                onChange={(e) =>
                  setField(
                    "languages",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="English (Native)…"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LayoutTemplate className="h-3.5 w-3.5" />
          Template {RESUME_TEMPLATES.find((t) => t.id === config.templateId)?.name}
        </span>
        <span className="text-xs text-muted-foreground">Changes auto-save</span>
      </div>
    </div>
  );
}

import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Languages as LanguagesIcon,
  Link2,
  Sparkles,
  Wrench,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import {
  getFontById,
  getTemplateById,
  pageDimensions,
  sectionHasContent,
  sectionLabel,
  skillsList,
  splitDetail,
  type ResumeData,
  type SectionId,
  type TemplateConfig,
} from "@/lib/resume-templates";

const INK = "#1f2937";
const SOFT = "#6b7280";
const FAINT = "#9ca3af";

const SECTION_ICONS: Partial<Record<SectionId, LucideIcon>> = {
  summary: Sparkles,
  experience: Briefcase,
  skills: Wrench,
  education: GraduationCap,
  projects: FolderGit2,
  certifications: BadgeCheck,
  languages: LanguagesIcon,
  links: Link2,
};

interface TemplateResumeProps {
  data: ResumeData;
  config: TemplateConfig;
  /** Show dashed page-break indicators (screen only — never in print). */
  showBreaks?: boolean;
  /** Reports the number of rendered pages (1 + break count). */
  onPageCount?: (count: number) => void;
}

function TemplateResumeInner({ data, config, showBreaks, onPageCount }: TemplateResumeProps) {
  const t = getTemplateById(config.templateId);
  const font = getFontById(config.font);
  const page = pageDimensions(config.pageSize);
  const { fontSize, lineHeight, margin } = config;
  const accent = config.accent;
  const layout = t.layout;
  const headerLayout = config.header;

  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [breaks, setBreaks] = useState<number[]>([]);

  // Measure content and compute where page breaks would land (screen preview).
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!showBreaks) {
      setBreaks([]);
      onPageCount?.(1);
      return;
    }
    const contentH = el.scrollHeight;
    const usable = page.height - margin * 2;
    const positions: number[] = [];
    let y = margin + usable;
    while (y < margin + contentH - 2) {
      positions.push(y);
      y += usable;
    }
    setBreaks(positions);
    onPageCount?.(positions.length + 1);
  }, [data, config, page.height, margin, showBreaks, onPageCount]);

  const contactItems = useMemo(
    () =>
      [
        { icon: Mail, value: data.email },
        { icon: Phone, value: data.phone },
        { icon: MapPin, value: data.location },
        { icon: Globe, value: data.website },
        { icon: Linkedin, value: data.linkedin },
      ].filter((c) => c.value.trim().length > 0),
    [data.email, data.phone, data.location, data.website, data.linkedin],
  );

  const visibleSections = config.sections.filter((s) => sectionHasContent(data, s));

  const nameSize = fontSize * 1.95;
  const titleSize = fontSize * 1.15;
  const bodySize = fontSize;

  const sectionTitleStyle = (() => {
    switch (layout) {
      case "modern":
        return {
          color: accent,
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          fontSize: bodySize * 0.92,
          borderBottom: `2px solid ${accent}22`,
          paddingBottom: 4,
          marginBottom: 10,
        };
      case "executive":
        return {
          color: SOFT,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.14em",
          fontSize: bodySize * 0.85,
          borderBottom: `1px solid ${FAINT}55`,
          paddingBottom: 4,
          marginBottom: 10,
        };
      case "creative":
        return {
          color: INK,
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
          fontSize: bodySize * 0.92,
          borderLeft: `3px solid ${accent}`,
          paddingLeft: 8,
          marginBottom: 10,
        };
      case "minimal":
        return {
          color: SOFT,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.18em",
          fontSize: bodySize * 0.82,
          marginBottom: 8,
        };
      case "timeline":
        return {
          color: accent,
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          fontSize: bodySize * 0.92,
          borderBottom: `2px solid ${accent}`,
          paddingBottom: 4,
          marginBottom: 12,
        };
      case "sidebar":
        return {
          color: accent,
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          fontSize: bodySize * 0.9,
          marginBottom: 8,
        };
      default: // classic
        return {
          color: INK,
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.12em",
          fontSize: bodySize * 0.88,
          borderBottom: `1px solid ${FAINT}66`,
          paddingBottom: 4,
          marginBottom: 10,
        };
    }
  })();

  const renderSectionTitle = (id: SectionId, color?: string) => {
    const Icon = SECTION_ICONS[id];
    return (
      <div style={sectionTitleStyle} className="flex items-center gap-1.5">
        {config.icons && Icon && <Icon size={bodySize * 0.9} color={color ?? accent} />}
        <span>{sectionLabel(id)}</span>
      </div>
    );
  };

  const renderDetail = (detail: string, indent = 0) => {
    const lines = splitDetail(detail);
    return (
      <div>
        {lines.map((line, i) => {
          const bullet = /^[•\-*]/.test(line);
          const text = bullet ? line.replace(/^[•\-*]\s*/, "") : line;
          return (
            <div key={i} className="flex gap-1.5" style={{ marginBottom: 2, paddingLeft: indent }}>
              {bullet && (
                <span style={{ color: accent, fontWeight: 700, lineHeight: lineHeight }}>•</span>
              )}
              <span style={{ lineHeight: lineHeight }}>{text}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderExperienceItem = (exp: ResumeData["experiences"][number]) => {
    // Split "Company · Dates" when present
    const companyParts = exp.company.split("·").map((s) => s.trim());
    const company = companyParts[0];
    const dates = companyParts.slice(1).join(" · ");
    const itemStyle =
      layout === "timeline"
        ? { borderLeft: `3px solid ${accent}`, paddingLeft: 12, paddingBottom: 12 }
        : { paddingBottom: 12 };
    return (
      <div style={itemStyle}>
        <div className="flex items-baseline justify-between gap-3">
          <span style={{ fontWeight: 700, color: INK, fontSize: bodySize * 1.02 }}>{exp.role}</span>
          {dates && (
            <span style={{ color: SOFT, fontSize: bodySize * 0.92, whiteSpace: "nowrap" }}>
              {dates}
            </span>
          )}
        </div>
        {company && (
          <div
            style={{ color: accent, fontWeight: 600, fontSize: bodySize * 0.95, marginBottom: 3 }}
          >
            {company}
          </div>
        )}
        {exp.detail && renderDetail(exp.detail)}
      </div>
    );
  };

  const renderEducation = (item: ResumeData["education"][number]) => (
    <div style={{ paddingBottom: 12 }}>
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontWeight: 700, color: INK, fontSize: bodySize * 1.02 }}>
          {item.school}
        </span>
        {item.dates && (
          <span style={{ color: SOFT, fontSize: bodySize * 0.92, whiteSpace: "nowrap" }}>
            {item.dates}
          </span>
        )}
      </div>
      {item.degree && (
        <div style={{ color: accent, fontWeight: 600, fontSize: bodySize * 0.95, marginBottom: 3 }}>
          {item.degree}
        </div>
      )}
      {item.detail && renderDetail(item.detail)}
    </div>
  );

  const renderProject = (item: ResumeData["projects"][number]) => (
    <div style={{ paddingBottom: 12 }}>
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontWeight: 700, color: INK, fontSize: bodySize * 1.02 }}>{item.name}</span>
        {item.link && <span style={{ color: SOFT, fontSize: bodySize * 0.92 }}>{item.link}</span>}
      </div>
      {item.detail && renderDetail(item.detail)}
    </div>
  );

  const renderChips = (values: string[], tinted = false) => (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: bodySize * 0.9,
            color: INK,
            border: `1px solid ${tinted ? `${accent}66` : `${FAINT}77`}`,
            background: tinted ? `${accent}0d` : "transparent",
            lineHeight: 1.4,
          }}
        >
          {v}
        </span>
      ))}
    </div>
  );

  const renderContact = (options: { align?: "left" | "right" | "center"; inline?: boolean }) => {
    if (contactItems.length === 0) return null;
    const justify =
      options.align === "right" ? "flex-end" : options.align === "center" ? "center" : "flex-start";
    return (
      <div
        className="flex flex-wrap gap-x-3 gap-y-1"
        style={{
          justifyContent: justify,
          color: SOFT,
          fontSize: bodySize * 0.92,
        }}
      >
        {contactItems.map((c) => (
          <span key={c.value} className="flex items-center gap-1">
            {config.icons && <c.icon size={bodySize * 0.85} color={accent} />}
            <span style={{ lineHeight: 1.4 }}>{c.value}</span>
          </span>
        ))}
      </div>
    );
  };

  // ----- Header per layout -------------------------------------------------
  const renderHeader = () => {
    const nameBlock = (
      <>
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 800,
            color: INK,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {data.name || "Your Name"}
        </div>
        {data.title && (
          <div
            style={{
              fontSize: titleSize,
              color: layout === "executive" || layout === "minimal" ? SOFT : accent,
              fontWeight: 500,
              marginTop: 4,
              letterSpacing: layout === "executive" ? "0.06em" : undefined,
              textTransform: layout === "executive" ? "uppercase" : undefined,
            }}
          >
            {data.title}
          </div>
        )}
      </>
    );

    switch (layout) {
      case "creative": {
        return (
          <div
            style={{
              background: accent,
              color: "#ffffff",
              padding: "20px 24px",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: nameSize, fontWeight: 800, lineHeight: 1.15 }}>
              {data.name || "Your Name"}
            </div>
            {data.title && (
              <div style={{ fontSize: titleSize, fontWeight: 500, marginTop: 4, opacity: 0.92 }}>
                {data.title}
              </div>
            )}
            {contactItems.length > 0 && (
              <div
                className="mt-3 flex flex-wrap gap-x-3 gap-y-1"
                style={{ fontSize: bodySize * 0.9, opacity: 0.95 }}
              >
                {contactItems.map((c) => (
                  <span key={c.value} className="flex items-center gap-1">
                    {config.icons && <c.icon size={bodySize * 0.85} />}
                    {c.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }
      case "executive": {
        return (
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ borderTop: "2px solid #1f2937", marginBottom: 14 }} />
            <div
              style={{
                fontSize: nameSize + 4,
                fontWeight: 700,
                color: INK,
                letterSpacing: "0.02em",
                lineHeight: 1.15,
              }}
            >
              {data.name || "Your Name"}
            </div>
            {data.title && (
              <div
                style={{
                  fontSize: bodySize * 1.02,
                  color: SOFT,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  marginTop: 6,
                }}
              >
                {data.title}
              </div>
            )}
            {renderContact({ align: "center" })}
            <div style={{ borderBottom: "1px solid #9ca3af", marginTop: 14 }} />
          </div>
        );
      }
      case "minimal": {
        return (
          <div
            style={{ marginBottom: 22, textAlign: headerLayout === "center" ? "center" : "left" }}
          >
            {nameBlock}
            {renderContact({ align: headerLayout === "center" ? "center" : "left" })}
          </div>
        );
      }
      case "sidebar": {
        return (
          <div style={{ marginBottom: 18 }}>
            {nameBlock}
            <div style={{ height: 3, background: accent, marginTop: 10, borderRadius: 2 }} />
          </div>
        );
      }
      case "timeline":
      case "modern": {
        return (
          <div style={{ marginBottom: 20 }}>
            <div className="flex items-end justify-between gap-4">
              <div>
                {nameBlock}
                <div
                  style={{
                    width: 52,
                    height: 3,
                    background: accent,
                    borderRadius: 2,
                    marginTop: 8,
                  }}
                />
              </div>
              {headerLayout === "split" && renderContact({ align: "right" })}
            </div>
            {headerLayout === "left" && (
              <div style={{ marginTop: 8 }}>{renderContact({ align: "left" })}</div>
            )}
            {headerLayout === "center" && (
              <div style={{ marginTop: 8 }}>{renderContact({ align: "center" })}</div>
            )}
          </div>
        );
      }
      default: {
        // classic
        return (
          <div
            style={{
              textAlign:
                headerLayout === "center" ? "center" : headerLayout === "split" ? "left" : "left",
              marginBottom: 22,
            }}
          >
            {headerLayout === "split" ? (
              <div className="flex items-end justify-between gap-4">
                <div>{nameBlock}</div>
                {renderContact({ align: "right" })}
              </div>
            ) : (
              <>
                {nameBlock}
                {renderContact({ align: headerLayout === "center" ? "center" : "left" })}
              </>
            )}
            <div style={{ borderBottom: "1px solid #d1d5db", marginTop: 12 }} />
          </div>
        );
      }
    }
  };

  // ----- Body ---------------------------------------------------------------
  const renderSectionBody = (id: SectionId) => {
    switch (id) {
      case "summary":
        return <div style={{ lineHeight: lineHeight, color: INK }}>{data.summary}</div>;
      case "experience":
        return (
          <div>
            {data.experiences.map((exp, i) => (
              <div key={exp.id || i}>{renderExperienceItem(exp)}</div>
            ))}
          </div>
        );
      case "skills":
        return layout === "creative" ||
          layout === "sidebar" ||
          layout === "modern" ||
          layout === "timeline" ? (
          renderChips(skillsList(data.skills), layout !== "sidebar")
        ) : (
          <div style={{ lineHeight: lineHeight, color: INK }}>
            {skillsList(data.skills).join(" · ")}
          </div>
        );
      case "education":
        return (
          <div>
            {data.education.map((e, i) => (
              <div key={e.id || i}>{renderEducation(e)}</div>
            ))}
          </div>
        );
      case "projects":
        return (
          <div>
            {data.projects.map((p, i) => (
              <div key={p.id || i}>{renderProject(p)}</div>
            ))}
          </div>
        );
      case "certifications":
        return layout === "creative" || layout === "sidebar" ? (
          renderChips(data.certifications)
        ) : (
          <div style={{ lineHeight: lineHeight, color: INK }}>
            {data.certifications.join(" · ")}
          </div>
        );
      case "languages":
        return layout === "creative" || layout === "sidebar" ? (
          renderChips(data.languages)
        ) : (
          <div style={{ lineHeight: lineHeight, color: INK }}>{data.languages.join(" · ")}</div>
        );
      case "links":
        return (
          <div
            className="flex flex-wrap gap-x-3 gap-y-1"
            style={{ color: SOFT, fontSize: bodySize * 0.95 }}
          >
            {data.website.trim() && <span>{data.website}</span>}
            {data.linkedin.trim() && <span>{data.linkedin}</span>}
          </div>
        );
      default:
        return null;
    }
  };

  // Sidebar splits sections between a tinted left rail and main column
  const isSidebar = layout === "sidebar";
  const leftRailSections: SectionId[] = ["skills", "certifications", "languages", "links"];
  const rail = isSidebar ? visibleSections.filter((s) => leftRailSections.includes(s)) : [];
  const main = isSidebar
    ? visibleSections.filter((s) => !leftRailSections.includes(s))
    : visibleSections;

  return (
    <div
      ref={sheetRef}
      className="relative mx-auto bg-white text-left"
      style={{
        width: page.width,
        minHeight: page.height,
        padding: margin,
        boxSizing: "border-box",
        color: INK,
        fontFamily: font.stack,
      }}
    >
      <div ref={contentRef}>
        {renderHeader()}

        {isSidebar ? (
          <div className="flex gap-6" style={{ alignItems: "flex-start" }}>
            <div
              style={{
                width: "30%",
                flexShrink: 0,
                background: `${accent}0d`,
                borderRadius: 8,
                padding: 16,
              }}
            >
              {contactItems.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ ...sectionTitleStyle }} className="flex items-center gap-1.5">
                    <span>Contact</span>
                  </div>
                  <div className="mt-1 flex flex-col gap-2">
                    {contactItems.map((c) => (
                      <div
                        key={c.value}
                        className="flex items-center gap-1.5"
                        style={{ color: INK, fontSize: bodySize * 0.92 }}
                      >
                        <c.icon size={bodySize * 0.9} color={accent} />
                        <span style={{ lineHeight: 1.35 }}>{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {rail.map((id) => (
                <div key={id} style={{ marginBottom: 14 }}>
                  {renderSectionTitle(id, accent)}
                  <div style={{ marginTop: 6 }}>{renderSectionBody(id)}</div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {main.map((id) => (
                <div key={id} style={{ marginBottom: 16 }}>
                  {renderSectionTitle(id, accent)}
                  <div style={{ marginTop: 4 }}>{renderSectionBody(id)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {visibleSections.map((id) => (
              <div key={id} style={{ marginBottom: 16 }}>
                {renderSectionTitle(id)}
                <div style={{ marginTop: 4 }}>{renderSectionBody(id)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Page-break indicators (screen preview only) */}
      {showBreaks &&
        breaks.map((y, i) => (
          <div
            key={y}
            aria-hidden="true"
            className="pointer-events-none"
            style={{
              position: "absolute",
              left: margin,
              right: margin,
              top: y,
            }}
          >
            <div
              style={{
                borderTop: "1.5px dashed rgba(225,29,72,0.55)",
                marginTop: -1,
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 0,
                top: -9,
                fontSize: 9,
                fontWeight: 700,
                color: "#be123c",
                background: "rgba(255,255,255,0.92)",
                padding: "0 5px",
                borderRadius: 4,
                letterSpacing: "0.04em",
              }}
            >
              Page {i + 2}
            </span>
          </div>
        ))}
    </div>
  );
}

export const TemplateResume = memo(TemplateResumeInner);

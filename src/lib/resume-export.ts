import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import {
  getFontById,
  getTemplateById,
  pageDimensions,
  sectionLabel,
  skillsList,
  splitDetail,
  type ResumeData,
  type TemplateConfig,
  type SectionId,
} from "@/lib/resume-templates";

/** px → twips (1px @96dpi = 15 twips) */
const pxToTwips = (px: number) => Math.round(px * 15);
/** px (screen) → half-points for Word font sizes */
const pxToHalfPoints = (px: number) => Math.round(px * 2 * (72 / 96));

const INK = "1F2937";
const SOFT = "6B7280";
const ACCENT_DEFAULT = "334155";

export async function exportResumeDOCX(data: ResumeData, config: TemplateConfig) {
  const t = getTemplateById(config.templateId);
  const font = getFontById(config.font);
  const accent = config.accent.replace("#", "").toUpperCase() || ACCENT_DEFAULT;
  const dims = pageDimensions(config.pageSize);

  const heading = (id: SectionId): Paragraph =>
    new Paragraph({
      spacing: { before: 240, after: 120 },
      border: {
        bottom: {
          color: accent,
          size: 6,
          style: BorderStyle.SINGLE,
          space: 2,
        },
      },
      children: [
        new TextRun({
          text: sectionLabel(id).toUpperCase(),
          bold: true,
          font: font.docx,
          color: accent,
          size: pxToHalfPoints(config.fontSize * 0.92),
          characterSpacing: 40,
        }),
      ],
    });

  const detailParagraphs = (detail: string): Paragraph[] =>
    splitDetail(detail).map(
      (line) =>
        new Paragraph({
          spacing: { after: 60 },
          indent: line.startsWith("•") || line.startsWith("-") ? { left: 360 } : undefined,
          children: [
            new TextRun({
              text:
                line.startsWith("•") || line.startsWith("-")
                  ? line.replace(/^[•\-*]\s*/, "• ")
                  : line,
              font: font.docx,
              size: pxToHalfPoints(config.fontSize),
              color: INK,
            }),
          ],
        }),
    );

  const bodyParagraph = (text: string, color = INK, bold = false): Paragraph =>
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text,
          font: font.docx,
          size: pxToHalfPoints(config.fontSize),
          color,
          bold,
        }),
      ],
    });

  const children: Paragraph[] = [];

  // Header
  children.push(
    new Paragraph({
      alignment: config.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: data.name || "Your Name",
          bold: true,
          font: font.docx,
          size: pxToHalfPoints(config.fontSize * 1.95),
          color: INK,
        }),
      ],
    }),
  );
  if (data.title) {
    children.push(
      new Paragraph({
        alignment: config.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: data.title,
            font: font.docx,
            size: pxToHalfPoints(config.fontSize * 1.15),
            color: accent,
          }),
        ],
      }),
    );
  }

  const contact = [data.email, data.phone, data.location, data.website, data.linkedin].filter(
    Boolean,
  );
  if (contact.length > 0) {
    children.push(
      new Paragraph({
        alignment: config.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: contact.join("  |  "),
            font: font.docx,
            size: pxToHalfPoints(config.fontSize * 0.92),
            color: SOFT,
          }),
        ],
      }),
    );
  }

  const renderSection = (id: SectionId) => {
    switch (id) {
      case "summary":
        if (data.summary.trim()) {
          children.push(heading(id));
          children.push(bodyParagraph(data.summary.trim()));
        }
        break;
      case "experience":
        if (data.experiences.length > 0) {
          children.push(heading(id));
          data.experiences.forEach((exp) => {
            const companyParts = exp.company.split("·").map((s) => s.trim());
            const company = companyParts[0];
            const dates = companyParts.slice(1).join(" · ");
            children.push(
              new Paragraph({
                spacing: { before: 100, after: 40 },
                children: [
                  new TextRun({
                    text: exp.role || "Role",
                    bold: true,
                    font: font.docx,
                    size: pxToHalfPoints(config.fontSize * 1.02),
                    color: INK,
                  }),
                  ...(dates
                    ? [
                        new TextRun({
                          text: "   " + dates,
                          font: font.docx,
                          size: pxToHalfPoints(config.fontSize * 0.92),
                          color: SOFT,
                        }),
                      ]
                    : []),
                ],
              }),
            );
            if (company) {
              children.push(
                new Paragraph({
                  spacing: { after: 60 },
                  children: [
                    new TextRun({
                      text: company,
                      font: font.docx,
                      size: pxToHalfPoints(config.fontSize * 0.95),
                      color: accent,
                      bold: true,
                    }),
                  ],
                }),
              );
            }
            if (exp.detail) children.push(...detailParagraphs(exp.detail));
          });
        }
        break;
      case "skills":
        if (data.skills.trim()) {
          children.push(heading(id));
          children.push(bodyParagraph(skillsList(data.skills).join("  |  ")));
        }
        break;
      case "education":
        if (data.education.length > 0) {
          children.push(heading(id));
          data.education.forEach((e) => {
            children.push(
              new Paragraph({
                spacing: { before: 100, after: 40 },
                children: [
                  new TextRun({
                    text: e.school || "School",
                    bold: true,
                    font: font.docx,
                    size: pxToHalfPoints(config.fontSize * 1.02),
                    color: INK,
                  }),
                  ...(e.dates
                    ? [
                        new TextRun({
                          text: "   " + e.dates,
                          font: font.docx,
                          size: pxToHalfPoints(config.fontSize * 0.92),
                          color: SOFT,
                        }),
                      ]
                    : []),
                ],
              }),
            );
            if (e.degree) {
              children.push(bodyParagraph(e.degree, accent, true));
            }
            if (e.detail) children.push(...detailParagraphs(e.detail));
          });
        }
        break;
      case "projects":
        if (data.projects.length > 0) {
          children.push(heading(id));
          data.projects.forEach((p) => {
            children.push(
              new Paragraph({
                spacing: { before: 100, after: 40 },
                children: [
                  new TextRun({
                    text: p.name || "Project",
                    bold: true,
                    font: font.docx,
                    size: pxToHalfPoints(config.fontSize * 1.02),
                    color: INK,
                  }),
                  ...(p.link
                    ? [
                        new TextRun({
                          text: "   " + p.link,
                          font: font.docx,
                          size: pxToHalfPoints(config.fontSize * 0.92),
                          color: SOFT,
                        }),
                      ]
                    : []),
                ],
              }),
            );
            if (p.detail) children.push(...detailParagraphs(p.detail));
          });
        }
        break;
      case "certifications":
        if (data.certifications.length > 0) {
          children.push(heading(id));
          children.push(bodyParagraph(data.certifications.join("  |  ")));
        }
        break;
      case "languages":
        if (data.languages.length > 0) {
          children.push(heading(id));
          children.push(bodyParagraph(data.languages.join("  |  ")));
        }
        break;
      case "links":
        {
          const links = [data.website, data.linkedin].filter(Boolean);
          if (links.length > 0) {
            children.push(heading(id));
            children.push(bodyParagraph(links.join("  |  ")));
          }
        }
        break;
    }
  };

  config.sections.forEach(renderSection);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: font.docx, size: pxToHalfPoints(config.fontSize) },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: pxToTwips(dims.width), height: pxToTwips(dims.height) },
            margin: {
              top: pxToTwips(config.margin),
              right: pxToTwips(config.margin),
              bottom: pxToTwips(config.margin),
              left: pxToTwips(config.margin),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = (data.name || "resume")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  a.download = `${slug}-${t.name.toLowerCase().replace(/\s+/g, "-")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";

export interface LetterMeta {
  name: string;
  title: string;
  email: string;
  phone: string;
  companyName: string;
  targetRole: string;
}

export interface ParsedLetter {
  salutation: string;
  paragraphs: string[];
  closing: string[];
}

/**
 * Parses a raw AI-generated letter into structured parts so both the PDF and
 * DOCX exporters can render a clean, professional document.
 *
 * Heuristics (kept defensive so any model output degrades gracefully):
 * - A block starting with "Dear …" is the salutation.
 * - The final "sign-off" block (Sincerely / Best regards / Thanks / Yours …)
 *   plus any following lines (candidate name) become the closing.
 * - Everything else is body paragraphs.
 */
export function parseLetter(letter: string): ParsedLetter {
  const blocks = letter
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const fallback: ParsedLetter = {
    salutation: "Dear Hiring Manager,",
    paragraphs: blocks,
    closing: [],
  };

  if (blocks.length === 0) return fallback;

  const salutationIdx = blocks.findIndex((b) => /^dear\s/i.test(b));
  const salutation = salutationIdx >= 0 ? blocks[salutationIdx] : "Dear Hiring Manager,";

  // Find the last sign-off block (matches the final "Sincerely," etc.)
  let closingIdx = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (
      /^(sincerely|best regards|kind regards|yours truly|yours faithfully|thanks|thank you|warm regards)/i.test(
        blocks[i],
      )
    ) {
      closingIdx = i;
      break;
    }
  }

  const paragraphs: string[] = [];
  const closing: string[] = [];
  blocks.forEach((b, i) => {
    if (i === salutationIdx) return;
    if (closingIdx >= 0 && i >= closingIdx) {
      closing.push(b);
    } else {
      paragraphs.push(b);
    }
  });

  if (paragraphs.length === 0 && closing.length === 0) {
    return fallback;
  }
  if (paragraphs.length === 0) {
    // Everything collapsed into closing (unlikely) — treat as body instead.
    return { salutation, paragraphs: blocks.filter((_, i) => i !== salutationIdx), closing: [] };
  }

  return { salutation, paragraphs, closing };
}

function sanitizeFileName(parts: string[]): string {
  const base = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "cover-letter";
}

function buildDateLine(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// PDF export
// ---------------------------------------------------------------------------

export function exportCoverLetterPDF(letter: string, meta: LetterMeta) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 64;
  const maxW = pageW - margin * 2;
  const lineH = 16;

  const parsed = parseLetter(letter);
  const contact = [meta.email, meta.phone].filter(Boolean).join("  ·  ");
  let y = 0;

  const ensureSpace = (needed: number) => {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header block
  y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30);
  doc.text(meta.name || "Candidate Name", margin, y);
  y += 18;

  if (meta.title) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(120);
    doc.text(meta.title, margin, y);
    y += 15;
  }
  if (contact) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(120);
    doc.text(contact, margin, y);
    y += 15;
  }

  // Date + company + subject
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(60);
  y += 10;
  doc.text(buildDateLine(), margin, y);
  y += 16;
  if (meta.companyName) {
    doc.text(meta.companyName, margin, y);
    y += 16;
  }
  if (meta.targetRole) {
    doc.setFont("helvetica", "bold");
    doc.text(`Re: ${meta.targetRole}`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 24;
  } else {
    y += 8;
  }

  // Salutation
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.text(parsed.salutation, margin, y);
  y += 22;

  // Body paragraphs
  for (const p of parsed.paragraphs) {
    const lines = doc.splitTextToSize(p, maxW) as string[];
    const blockH = lines.length * lineH;
    ensureSpace(blockH + 12);
    doc.text(lines, margin, y);
    y += blockH + 14;
  }

  // Closing
  if (parsed.closing.length > 0) {
    y += 6;
    for (const c of parsed.closing) {
      const lines = doc.splitTextToSize(c, maxW) as string[];
      const blockH = lines.length * lineH;
      ensureSpace(blockH);
      doc.text(lines, margin, y);
      y += blockH;
    }
  }

  doc.save(`${sanitizeFileName([meta.companyName, meta.targetRole])}.pdf`);
}

// ---------------------------------------------------------------------------
// DOCX export
// ---------------------------------------------------------------------------

export async function exportCoverLetterDOCX(letter: string, meta: LetterMeta) {
  const parsed = parseLetter(letter);
  const children: Paragraph[] = [];
  const contact = [meta.email, meta.phone].filter(Boolean).join("  ·  ");

  // Header
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: meta.name || "Candidate Name", bold: true, size: 40, color: "1E293B" }),
      ],
      spacing: { after: 120 },
    }),
  );
  if (meta.title) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: meta.title, size: 21, color: "64748B" })],
        spacing: { after: 80 },
      }),
    );
  }
  if (contact) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contact, size: 21, color: "64748B" })],
        spacing: { after: 200 },
      }),
    );
  }

  // Date + company + subject
  children.push(
    new Paragraph({
      children: [new TextRun({ text: buildDateLine(), size: 21, color: "475569" })],
    }),
  );
  if (meta.companyName) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: meta.companyName, size: 21, color: "475569" })],
      }),
    );
  }
  if (meta.targetRole) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Re: ${meta.targetRole}`, bold: true, size: 21, color: "475569" }),
        ],
        spacing: { after: 240 },
      }),
    );
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }));
  }

  // Salutation
  children.push(
    new Paragraph({
      children: [new TextRun({ text: parsed.salutation, size: 22, color: "0F172A" })],
      spacing: { after: 160 },
    }),
  );

  // Body
  for (const p of parsed.paragraphs) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: p, size: 22, color: "0F172A" })],
        spacing: { after: 180, line: 320 },
        alignment: "both",
      }),
    );
  }

  // Closing
  for (const c of parsed.closing) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: c, size: 22, color: "0F172A" })],
        spacing: { before: c === parsed.closing[0] ? 200 : 0, after: 120 },
      }),
    );
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFileName([meta.companyName, meta.targetRole])}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

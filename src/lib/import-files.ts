// ---------------------------------------------------------------------------
// Resume Import — file extraction layer (client-only)
//
// Validates uploaded files (size / magic bytes / format), lazily loads the
// heavy parsers (pdfjs-dist for PDF, mammoth for DOCX) only when actually
// needed, extracts raw text with progress, and hashes the file for duplicate
// detection. No heavy parser is imported statically so SSR stays clean.
// ---------------------------------------------------------------------------

export type ImportFormat = "pdf" | "docx" | "json";

export interface ExtractedFile {
  text: string;
  format: ImportFormat;
  pages?: number;
}

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB

export class ImportError extends Error {
  code: "format" | "size" | "password" | "corrupt" | "docx" | "empty" | "json";
  constructor(message: string, code: ImportError["code"]) {
    super(message);
    this.name = "ImportError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Validation & sniffing
// ---------------------------------------------------------------------------

export function validateImportFile(file: File): ImportError | null {
  if (file.size === 0) return new ImportError("The file is empty.", "empty");
  if (file.size > MAX_IMPORT_BYTES) {
    return new ImportError("File is too large — max 10 MB. Try compressing it.", "size");
  }
  const name = file.name.toLowerCase();
  const okExt = name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".json");
  if (!okExt) {
    return new ImportError(
      "Unsupported file type. Please upload a PDF, DOCX, or JSON backup.",
      "format",
    );
  }
  return null;
}

async function readHead(file: File, n = 16): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, n).arrayBuffer());
}

/**
 * Sniffs the real content type from magic bytes — never trusts the extension,
 * so a renamed .exe / script cannot pass as a resume.
 */
export async function sniffImportFormat(file: File): Promise<ImportFormat | null> {
  const head = await readHead(file);
  // PDF: "%PDF-"
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "pdf";
  // DOCX / any Office Open XML: ZIP magic "PK\x03\x04" (also PK\x05\x06 empty zip)
  if (
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)
  ) {
    return "docx";
  }
  // JSON backup: leading whitespace then { or [
  const text = new TextDecoder().decode(head).trimStart();
  if (text.startsWith("{") || text.startsWith("[")) return "json";
  return null;
}

// ---------------------------------------------------------------------------
// Extractors (heavy parsers lazy-loaded per call)
// ---------------------------------------------------------------------------

async function extractPdf(file: File, onProgress?: (pct: number) => void): Promise<ExtractedFile> {
  const pdfjs = await import("pdfjs-dist");
  // Vite supports `?url` assets — resolves the worker to a real URL in build.
  // Fallback derives the same file from the resolved module base so the worker
  // always loads (a wrong workerSrc surfaces as a confusing "corrupt PDF" error).
  try {
    const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl as string;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  // `getDocument(...)` returns a loading task; `.promise` resolves to the
  // PDFDocumentProxy. Keep the task so we can destroy it (v6 removed destroy
  // from the proxy type) and release the worker after extraction.
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await loadingTask.promise;
  } catch (err: any) {
    if (err?.name === "PasswordException") {
      throw new ImportError(
        "This PDF is password-protected. Unlock it and upload again.",
        "password",
      );
    }
    throw new ImportError("Could not open this PDF — it may be corrupted.", "corrupt");
  }

  let text = "";
  const pages = doc.numPages;
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (!item.str) continue;
      if (item.hasEOL) {
        text += line + "\n";
        line = "";
      } else {
        line += item.str;
      }
    }
    if (line) text += line + "\n";
    text += "\n";
    onProgress?.(i / pages);
  }
  await loadingTask.destroy();
  return { text, format: "pdf", pages };
}

async function extractDocx(file: File): Promise<ExtractedFile> {
  const mammoth = (await import("mammoth")).default;
  let result: { value: string };
  try {
    result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  } catch (err) {
    console.warn("DOCX extraction failed:", err);
    throw new ImportError(
      "Could not read this DOCX file — it may be corrupted or unsupported.",
      "docx",
    );
  }
  return { text: result.value || "", format: "docx" };
}

async function extractJson(file: File): Promise<ExtractedFile> {
  return { text: await file.text(), format: "json" };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function extractImportFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ExtractedFile> {
  const format = await sniffImportFormat(file);
  if (!format) {
    throw new ImportError(
      "Could not detect the file format. Only PDF, DOCX and JSON resumes are supported.",
      "format",
    );
  }
  switch (format) {
    case "pdf":
      return extractPdf(file, onProgress);
    case "docx":
      return extractDocx(file);
    case "json":
      return extractJson(file);
  }
}

/** SHA-256 of the file — used for duplicate-upload detection. */
export async function hashImportFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import { useRef, useState } from "react";
import { FileUp, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export interface ImportDropzoneProps {
  busy: boolean;
  progress?: number | null;
  error?: string | null;
  onFile: (file: File) => void;
}

const ACCEPT = ".pdf,.docx,.json";

export function ImportDropzone({ busy, progress, error, onFile }: ImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !busy) onFile(file);
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label="Upload resume file"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        aria-label="Upload a PDF, DOCX or JSON resume"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all",
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border bg-card hover:border-primary/60 hover:bg-accent/40",
          busy && "pointer-events-none opacity-70",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
        </div>
        <div className="space-y-1">
          <p className="font-semibold">
            {busy ? "Parsing your resume…" : "Drag & drop your resume"}
          </p>
          <p className="text-sm text-muted-foreground">
            or{" "}
            <span className="font-medium text-primary underline-offset-4 group-hover:underline">
              browse files
            </span>{" "}
            — PDF, DOCX, or JSON backup
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
            <ShieldCheck className="h-3 w-3 text-success" /> Max 10 MB
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
            <ShieldCheck className="h-3 w-3 text-success" /> Scanned safely in your browser
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
            <ShieldCheck className="h-3 w-3 text-success" /> Never shared
          </span>
        </div>
      </div>

      {busy && typeof progress === "number" && (
        <div className="space-y-1.5">
          <Progress value={Math.round(progress * 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {Math.round(progress * 100)}% — extracting text…
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";

export interface ExperienceData {
  id: number;
  role: string;
  company: string;
  detail: string;
}

export interface ResumePreviewProps {
  name: string;
  title: string;
  email: string;
  phone: string;
  summary: string;
  skills: string;
  experiences: ExperienceData[];
}

export function ResumePreview({
  name,
  title,
  email,
  phone,
  summary,
  skills,
  experiences,
}: ResumePreviewProps) {
  return (
    <div className="rounded-xl border border-border bg-background p-6 text-sm">
      <h2 className="text-xl font-bold">{name || "Your Name"}</h2>
      <p className="text-primary">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {email} · {phone}
      </p>
      <hr className="my-4 border-border" />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Summary
      </h3>
      <p className="mt-1.5 leading-relaxed">{summary}</p>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Experience
      </h3>
      <div className="mt-1.5 space-y-3">
        {experiences.map((x) => (
          <div key={x.id}>
            <p className="font-semibold">{x.role || "Role"}</p>
            <p className="text-xs text-muted-foreground">{x.company}</p>
            <p className="mt-0.5 leading-relaxed">{x.detail}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Skills
      </h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
      </div>
    </div>
  );
}

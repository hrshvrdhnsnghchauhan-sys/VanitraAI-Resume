import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2 font-display", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
        <FileText className="h-5 w-5" />
      </span>
      <span className="text-lg font-bold tracking-tight">
        Vanitra<span className="text-gradient">AI</span> Resume
      </span>
    </Link>
  );
}

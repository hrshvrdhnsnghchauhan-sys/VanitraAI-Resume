import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function recColor(rec: string) {
  switch (rec) {
    case "Strongly Recommended":
      return "text-success";
    case "Recommended":
      return "text-primary";
    case "Average Match":
      return "text-warning";
    default:
      return "text-destructive";
  }
}

import { LucideIcon } from "lucide-react";

export interface CandidateStat {
  label: string;
  value: number;
  suffix: string;
  trend: string;
  color: string;
}

export interface ScoreTrend {
  name: string;
  score: number;
}

export interface ScoreBreakdown {
  label: string;
  value: number;
}

export interface SkillStat {
  skill: string;
  you: number;
  market: number;
}

export interface MissingSkill {
  name: string;
  priority: "High" | "Medium" | "Low";
  progress: number;
}

export interface RoadmapResource {
  label: string;
  platform: string;
}

export interface RoadmapItem {
  week: string;
  focus: string;
  tasks: string[];
  resources: RoadmapResource[];
}

export interface JobApplication {
  role: string;
  company: string;
  match: number;
  status: string;
  date: string;
}

export interface JobMatchResult {
  match: number;
  probability: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  missingKeywords: string[];
  recommendations: string[];
}

export interface CandidateRanking {
  name: string;
  ats: number;
  resume: number;
  jobMatch: number;
  skill: number;
  exp: number;
  overall: number;
  rec: "Strongly Recommended" | "Recommended" | "Average Match" | "Not Recommended";
}

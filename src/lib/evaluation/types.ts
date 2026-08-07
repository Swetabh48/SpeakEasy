export type ScoreDimension = {
  label: string;
  value: number; // 0-100, earned from evidence only
  note: string;
  weight: number;
};

export type EvaluationResult = {
  overall: string;
  band: string;
  overallScore: number;
  scores: ScoreDimension[];
  tips: string[];
  strengths: string[];
  weaknesses: string[];
  nextDrill: string;
  transcriptUsed: string;
  wordCount: number;
  durationSec: number;
  targetSec: number;
  evaluated: true;
  source: "custom-model" | "ollama" | "local-strict";
  insufficientEvidence: boolean;
};

export type EvaluationRequest = {
  kind: "speech" | "essay";
  topic: string;
  mode: string;
  examId: string | null;
  examName: string | null;
  difficulty: string;
  category: string;
  transcriptOrEssay: string;
  durationSec: number;
  targetSec: number;
};

export type ProfileSnapshot = {
  sessions: number;
  scoredSessions: number;
  averageScore: number;
  bestScore: number;
  recentScores: number[];
  dimensionAverages: Record<string, number>;
  topWeaknesses: string[];
  topStrengths: string[];
  lastUpdated: number;
};

import { SourceFile } from 'ts-morph';

export type Severity = 'critical' | 'high' | 'medium';
export type Category = 'time-bomb' | 'scale-bomb' | 'concurrency-bomb';

export interface Rule {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  incidentReference: string;
  check(sourceFile: SourceFile): Finding[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  category: Category;
  filePath: string;
  line: number;
  column: number;
  message: string;
  suggestedFix?: string;
}

export interface AnalysisOptions {
  files: string[];
  rules?: string[];
}

export interface AnalysisResult {
  findings: Finding[];
  filesAnalyzed: number;
  durationMs: number;
}

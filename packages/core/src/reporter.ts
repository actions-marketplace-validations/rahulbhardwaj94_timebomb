import { Finding, AnalysisResult } from './types';

export function formatJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatGithub(result: AnalysisResult): string {
  const lines: string[] = [];

  for (const finding of result.findings) {
    const level = finding.severity === 'critical' || finding.severity === 'high' ? 'error' : 'warning';
    const file = finding.filePath;
    const line = finding.line;
    const col = finding.column;
    const msg = `[${finding.ruleId}] ${finding.message}`;

    lines.push(`::${level} file=${file},line=${line},col=${col}::${msg}`);
  }

  return lines.join('\n');
}

export function countBySeverity(findings: Finding[]): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0 };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  return counts;
}

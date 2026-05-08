import { AnalysisResult } from 'timebomb-core';

export function printGithubReport(result: AnalysisResult): void {
  for (const finding of result.findings) {
    const level = finding.severity === 'critical' || finding.severity === 'high' ? 'error' : 'warning';
    const msg = `[${finding.ruleId}] ${finding.message}`;
    console.log(`::${level} file=${finding.filePath},line=${finding.line},col=${finding.column}::${msg}`);
  }
}

import { AnalysisResult } from 'timebomb-core';

export function printJsonReport(result: AnalysisResult): void {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

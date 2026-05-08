import { Finding, AnalysisResult } from 'timebomb-core';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';

const SEVERITY_COLOR: Record<string, string> = {
  critical: RED,
  high: YELLOW,
  medium: CYAN,
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: '● CRITICAL',
  high: '▲ HIGH    ',
  medium: '◆ MEDIUM  ',
};

const CATEGORY_LABEL: Record<string, string> = {
  'time-bomb': '⏰ time-bomb',
  'scale-bomb': '📈 scale-bomb',
  'concurrency-bomb': '⚡ concurrency-bomb',
};

export function printTerminalReport(result: AnalysisResult, cwd: string): void {
  const { findings, filesAnalyzed, durationMs } = result;

  if (findings.length === 0) {
    console.log(`\n${GREEN}${BOLD}✓ No TimeBombs detected${RESET}`);
    console.log(`${DIM}Analyzed ${filesAnalyzed} files in ${durationMs}ms${RESET}\n`);
    return;
  }

  console.log('');

  // Sort: critical first
  const sorted = [...findings].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 };
    return order[a.severity] - order[b.severity];
  });

  for (const finding of sorted) {
    const color = SEVERITY_COLOR[finding.severity] ?? CYAN;
    const label = SEVERITY_LABEL[finding.severity] ?? finding.severity.toUpperCase();
    const category = CATEGORY_LABEL[finding.category] ?? finding.category;
    const relPath = finding.filePath.replace(cwd + '/', '');

    console.log(`${color}${BOLD}${label}${RESET}  ${DIM}[${finding.ruleId}]${RESET}  ${category}`);
    console.log(`  ${BOLD}${relPath}:${finding.line}${RESET}`);
    console.log(`  ${finding.message}`);
    if (finding.suggestedFix) {
      console.log(`  ${DIM}Fix: ${finding.suggestedFix.split('\n')[0]}${RESET}`);
    }
    console.log('');
  }

  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;

  const parts: string[] = [];
  if (counts.critical) parts.push(`${RED}${BOLD}${counts.critical} critical${RESET}`);
  if (counts.high) parts.push(`${YELLOW}${BOLD}${counts.high} high${RESET}`);
  if (counts.medium) parts.push(`${CYAN}${BOLD}${counts.medium} medium${RESET}`);

  console.log(`${BOLD}Found ${findings.length} issue${findings.length !== 1 ? 's' : ''}: ${parts.join(', ')}${RESET}`);
  console.log(`${DIM}Analyzed ${filesAnalyzed} files in ${durationMs}ms${RESET}\n`);
}

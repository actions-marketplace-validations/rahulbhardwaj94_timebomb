import { AnalysisResult, Finding } from 'timebomb-core';

const COMMENT_MARKER = '<!-- timebomb-report -->';

export function buildPrComment(result: AnalysisResult, repoUrl: string, sha: string): string {
  const { findings, filesAnalyzed, durationMs } = result;

  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;

  const lines: string[] = [
    COMMENT_MARKER,
    '',
    '## 💣 TimeBomb Analysis',
    '',
  ];

  if (findings.length === 0) {
    lines.push('✅ **No time bombs, scale bombs, or concurrency bombs detected.**');
    lines.push('');
    lines.push(`_Analyzed ${filesAnalyzed} files in ${durationMs}ms_`);
    return lines.join('\n');
  }

  // Summary badges
  const summaryParts: string[] = [];
  if (counts.critical) summaryParts.push(`🔴 **${counts.critical} critical**`);
  if (counts.high) summaryParts.push(`🟡 **${counts.high} high**`);
  if (counts.medium) summaryParts.push(`🔵 ${counts.medium} medium`);

  lines.push(`${summaryParts.join('  ·  ')}  (${findings.length} total)`);
  lines.push('');

  // Top 5 findings
  const sorted = [...findings].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 };
    return order[a.severity] - order[b.severity];
  });

  const top5 = sorted.slice(0, 5);

  lines.push('### Top Findings');
  lines.push('');
  lines.push('| Severity | Rule | Location | Message |');
  lines.push('|----------|------|----------|---------|');

  for (const finding of top5) {
    const severityEmoji = { critical: '🔴', high: '🟡', medium: '🔵' }[finding.severity] ?? '●';
    const fileLink = `[\`${shortPath(finding.filePath)}:${finding.line}\`](${repoUrl}/blob/${sha}/${shortPath(finding.filePath)}#L${finding.line})`;
    const msg = finding.message.slice(0, 80) + (finding.message.length > 80 ? '…' : '');
    lines.push(`| ${severityEmoji} ${finding.severity} | \`${finding.ruleId}\` | ${fileLink} | ${msg} |`);
  }

  if (findings.length > 5) {
    lines.push('');
    lines.push(`_…and ${findings.length - 5} more. Run \`npx timebomb\` locally to see all findings._`);
  }

  lines.push('');
  lines.push('---');
  lines.push(`_Analyzed ${filesAnalyzed} files in ${durationMs}ms · [TimeBomb](https://github.com/timebomb-dev/timebomb)_`);

  return lines.join('\n');
}

function shortPath(filePath: string): string {
  const parts = filePath.split('/');
  const idx = parts.findIndex((p) => p === 'src' || p === 'lib' || p === 'app');
  if (idx !== -1) return parts.slice(idx).join('/');
  return parts.slice(-3).join('/');
}

export function findExistingComment(
  comments: Array<{ id: number; body: string }>
): number | null {
  for (const comment of comments) {
    if (comment.body.includes(COMMENT_MARKER)) {
      return comment.id;
    }
  }
  return null;
}

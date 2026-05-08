import { SourceFile, SyntaxKind, BinaryExpression, Node } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

const DAY_MS = 86_400_000;

function evaluateNumber(node: Node): number | null {
  if (node.getKind() === SyntaxKind.NumericLiteral) {
    return Number(node.getText());
  }
  if (node.getKind() === SyntaxKind.BinaryExpression) {
    const bin = node.asKindOrThrow(SyntaxKind.BinaryExpression);
    const op = bin.getOperatorToken().getText();
    const l = evaluateNumber(bin.getLeft());
    const r = evaluateNumber(bin.getRight());
    if (l === null || r === null) return null;
    if (op === '*') return l * r;
    if (op === '+') return l + r;
    if (op === '-') return l - r;
    if (op === '/') return l / r;
  }
  return null;
}

function isDayMs(node: Node): boolean {
  const val = evaluateNumber(node);
  if (val !== null && val === DAY_MS) return true;
  // Also match multiples of DAY_MS (e.g. 7 * 24 * 60 * 60 * 1000 for "next week")
  if (val !== null && val > 0 && val % DAY_MS === 0) return true;
  return false;
}

export const naiveDateArithmetic: Rule = {
  id: 'naive-date-arithmetic',
  category: 'time-bomb',
  severity: 'high',
  title: 'Adding 86400000ms (24h) to a date ignores DST — gives wrong day on clock-change days',
  description:
    'Adding exactly 86,400,000ms to a timestamp to compute "tomorrow" breaks during DST transitions: spring-forward days are 23 hours, fall-back days are 25 hours. This produces off-by-one errors in daily scheduled jobs, billing cycles, and report generation.',
  incidentReference:
    'Incident: a subscription billing system added 86400000 * 30 to compute monthly renewal dates. During DST transitions, renewals were sent one day early or late, triggering double-charges and missed charges. Took 6 months to correlate the pattern with DST boundaries.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach((expr: BinaryExpression) => {
      const op = expr.getOperatorToken().getText();
      if (op !== '+' && op !== '-') return;

      const left = expr.getLeft();
      const right = expr.getRight();

      if (isDayMs(right) || isDayMs(left)) {
        const otherSide = isDayMs(right) ? left : right;
        const text = otherSide.getText();

        // Only flag when the other operand looks like a Date value (Date.now(), getTime(), etc.)
        if (
          text.includes('Date.now()') ||
          text.includes('.getTime()') ||
          text.includes('.valueOf()') ||
          text.includes('timestamp') ||
          text.includes('Timestamp') ||
          text.includes('date') && text.includes('.')
        ) {
          const line = expr.getStartLineNumber();
          findings.push({
            ruleId: 'naive-date-arithmetic',
            severity: 'high',
            category: 'time-bomb',
            filePath: sourceFile.getFilePath(),
            line,
            column: getColumn(expr),
            message: `Adding/subtracting 86400000ms (24h) to a timestamp. This ignores DST: some days are 23h or 25h. Use a date library (date-fns addDays, Luxon plus) for calendar arithmetic.`,
            suggestedFix: `import { addDays } from 'date-fns'; const tomorrow = addDays(new Date(timestamp), 1);`,
          });
        }
      }
    });

    return findings;
  },
};

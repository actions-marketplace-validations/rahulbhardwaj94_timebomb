import { SourceFile, SyntaxKind, Node } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

// 2^31 - 1 seconds since Unix epoch = 2038-01-19T03:14:07Z
const Y2038_SECONDS = 2_147_483_647;
// As milliseconds
const Y2038_MS = Y2038_SECONDS * 1000;

function evaluateNumericExpression(node: Node): number | null {
  if (node.getKind() === SyntaxKind.NumericLiteral) {
    return Number(node.getText());
  }
  return null;
}

export const y2038Timestamp: Rule = {
  id: 'y2038-timestamp',
  category: 'time-bomb',
  severity: 'high',
  title: 'Timestamp stored as 32-bit integer will overflow in 2038',
  description:
    'Unix timestamps stored in 32-bit signed integers overflow on 2038-01-19 03:14:07 UTC, rolling over to negative values. This affects database schemas (MySQL INT for timestamps), binary protocols, and any code that casts timestamps to 32-bit integers.',
  incidentReference:
    'The Y2038 problem: MySQL TIMESTAMP columns using 32-bit signed integers will overflow in 2038. Already causing issues in long-lived systems that store "expiry dates" decades in the future. PostgreSQL switched to 64-bit in 2004; MySQL fixed it in 8.0.28+ — but only for new columns.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    // Detect: numeric literals that look like they could be 32-bit timestamp limits
    // Pattern: any bitwise OR/AND with 0xFFFFFFFF or >>> 0 (converts to uint32) applied to timestamps
    sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach((expr) => {
      const op = expr.getOperatorToken().getText();

      // Detect: timestamp | 0 or timestamp >>> 0 (forces 32-bit truncation)
      if (op === '|' || op === '>>>') {
        const right = expr.getRight();
        const rightVal = evaluateNumericExpression(right);

        if (rightVal === 0) {
          const left = expr.getLeft().getText();
          if (
            left.includes('timestamp') ||
            left.includes('Timestamp') ||
            left.includes('Date.now') ||
            left.includes('.getTime') ||
            left.includes('time') ||
            left.includes('Time')
          ) {
            const line = expr.getStartLineNumber();
            findings.push({
              ruleId: 'y2038-timestamp',
              severity: 'high',
              category: 'time-bomb',
              filePath: sourceFile.getFilePath(),
              line,
              column: getColumn(expr),
              message: `Bitwise operation \`${op} 0\` truncates timestamp to 32 bits. Values after 2038-01-19 will overflow to negative numbers.`,
              suggestedFix: `Use BigInt or keep timestamps as 64-bit floats (JavaScript's default Number). Remove the \`${op} 0\` truncation.`,
            });
          }
        }
      }
    });

    // Detect: Math.pow(2, 31) or 2147483647 used as a timestamp bound
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      const text = call.getText();
      if (text === 'Math.pow(2, 31)' || text === 'Math.pow(2,31)') {
        const line = call.getStartLineNumber();
        findings.push({
          ruleId: 'y2038-timestamp',
          severity: 'high',
          category: 'time-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(call),
          message: `Math.pow(2, 31) = ${Y2038_SECONDS} — this is the Y2038 32-bit timestamp limit. Any system using this as a timestamp bound will break after 2038-01-19.`,
          suggestedFix: `Use Number.MAX_SAFE_INTEGER or BigInt for timestamp arithmetic.`,
        });
      }
    });

    // Detect numeric literal equal to Y2038_SECONDS used in timestamp context
    sourceFile.getDescendantsOfKind(SyntaxKind.NumericLiteral).forEach((lit) => {
      const val = Number(lit.getText());
      if (val === Y2038_SECONDS || val === Y2038_MS) {
        const parent = lit.getParent();
        if (!parent) return;
        const line = lit.getStartLineNumber();
        findings.push({
          ruleId: 'y2038-timestamp',
          severity: 'high',
          category: 'time-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(lit),
          message: `Literal ${val} is the Y2038 32-bit timestamp limit. Systems using this value will break after 2038-01-19.`,
          suggestedFix: `Use Number.MAX_SAFE_INTEGER or a date library for far-future timestamp bounds.`,
        });
      }
    });

    return findings;
  },
};

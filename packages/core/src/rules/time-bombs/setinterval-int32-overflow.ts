import { SourceFile, SyntaxKind, CallExpression, Node } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

const INT32_MAX = 2_147_483_647;

function evaluateNumericExpression(node: Node): number | null {
  if (node.getKind() === SyntaxKind.NumericLiteral) {
    return Number(node.getText());
  }
  if (node.getKind() === SyntaxKind.BinaryExpression) {
    const bin = node.asKindOrThrow(SyntaxKind.BinaryExpression);
    const op = bin.getOperatorToken().getText();
    const left = evaluateNumericExpression(bin.getLeft());
    const right = evaluateNumericExpression(bin.getRight());
    if (left === null || right === null) return null;
    if (op === '*') return left * right;
    if (op === '+') return left + right;
    if (op === '-') return left - right;
    if (op === '/') return left / right;
  }
  return null;
}

export const setintervalInt32Overflow: Rule = {
  id: 'setinterval-int32-overflow',
  category: 'time-bomb',
  severity: 'critical',
  title: 'setInterval period exceeds int32 max — will fire immediately and repeatedly',
  description:
    'JavaScript setInterval periods are stored as 32-bit signed integers. Periods > 2,147,483,647ms overflow to a negative value, causing the callback to fire at the maximum interval rate (~1ms) continuously. This can saturate CPU and exhaust resources.',
  incidentReference:
    'Reported pattern in background job systems: setInterval(syncFn, 7 * 24 * 60 * 60 * 1000) for weekly syncs overflows int32 and fires every millisecond instead. Caused CPU spikes that brought down a Node.js service.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const name = call.getExpression().getText().trim();
      if (name !== 'setInterval') return;

      const args = call.getArguments();
      if (args.length < 2) return;

      const delay = evaluateNumericExpression(args[1]);
      if (delay !== null && delay > INT32_MAX) {
        const line = call.getStartLineNumber();
        findings.push({
          ruleId: 'setinterval-int32-overflow',
          severity: 'critical',
          category: 'time-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(call),
          message: `setInterval period ${delay}ms exceeds int32 max (${INT32_MAX}ms). The interval will fire at maximum rate, likely saturating CPU.`,
          suggestedFix: `Use a cron scheduler (node-cron, bull) for intervals longer than 24.8 days.`,
        });
      }
    });

    return findings;
  },
};

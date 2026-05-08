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

export const settimeoutInt32Overflow: Rule = {
  id: 'settimeout-int32-overflow',
  category: 'time-bomb',
  severity: 'critical',
  title: 'setTimeout delay exceeds int32 max — will fire immediately',
  description:
    'JavaScript setTimeout delays are stored as 32-bit signed integers. Delays > 2,147,483,647ms (24.8 days) overflow and the callback fires immediately. This breaks scheduled jobs, session timeouts, and reminder systems in production.',
  incidentReference:
    'Common production incident: session timeouts set to "30 days" via 30 * 24 * 60 * 60 * 1000 = 2,592,000,000ms. Overflows int32. Sessions expire instantly. Reported in multiple Node.js apps using express-session and custom schedulers.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const expr = call.getExpression();
      const name = expr.getText().trim();

      if (name !== 'setTimeout') return;

      const args = call.getArguments();
      if (args.length < 2) return;

      const delayArg = args[1];
      const delay = evaluateNumericExpression(delayArg);

      if (delay !== null && delay > INT32_MAX) {
        const pos = call.getStartLineNumber();
        findings.push({
          ruleId: 'settimeout-int32-overflow',
          severity: 'critical',
          category: 'time-bomb',
          filePath: sourceFile.getFilePath(),
          line: pos,
          column: getColumn(call),
          message: `setTimeout delay ${delay}ms exceeds int32 max (${INT32_MAX}ms = 24.8 days). The callback will fire immediately in production.`,
          suggestedFix: `Break into multiple timeouts or use a scheduler library that handles large delays safely.`,
        });
      }
    });

    return findings;
  },
};

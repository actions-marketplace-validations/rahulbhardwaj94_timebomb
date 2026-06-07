import { SourceFile, SyntaxKind, AwaitExpression, Node } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

const LOOP_KINDS = [
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
];

function isInsideLoop(node: Node): boolean {
  let current = node.getParent();
  while (current) {
    if (LOOP_KINDS.includes(current.getKind())) return true;
    // Stop at async function boundary
    const kind = current.getKind();
    if (
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.FunctionExpression ||
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.MethodDeclaration
    ) {
      return false;
    }
    current = current.getParent();
  }
  return false;
}

export const sequentialAwaitInLoop: Rule = {
  id: 'sequential-await-in-loop',
  category: 'concurrency-bomb',
  severity: 'high',
  title: 'await inside for loop — runs sequentially, causing O(n) latency at scale',
  description:
    'Using await inside a for/while loop serializes all async operations: each one waits for the previous to complete. With 10 items this is slow but acceptable. With 1000 items, latency multiplies by 1000x. Promise.all() runs them concurrently and is nearly always preferable.',
  incidentReference:
    'Incident: a bulk notification service iterated over subscribers with await sendEmail(sub) inside a for loop. In testing with 50 subscribers it sent emails in ~5s. With 10,000 production subscribers at ~100ms per email, it took 1000 seconds (16+ minutes) and held the server process, blocking all other requests on that thread.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression).forEach((awaitExpr: AwaitExpression) => {
      if (!isInsideLoop(awaitExpr)) return;

      // Ignore: await on non-call expressions (await someVariable is less likely sequential)
      const expression = awaitExpr.getExpression();
      if (expression.getKind() !== SyntaxKind.CallExpression) return;

      const line = awaitExpr.getStartLineNumber();
      findings.push({
        ruleId: 'sequential-await-in-loop',
        severity: 'high',
        category: 'concurrency-bomb',
        filePath: sourceFile.getFilePath(),
        line,
        column: getColumn(awaitExpr),
        message: `await inside a loop serializes all operations. With N items this takes N × (operation time) instead of ~(operation time). Use Promise.all() for concurrent execution.`,
        suggestedFix: `const results = await Promise.all(items.map(item => asyncOperation(item)));
// For rate limiting: import pLimit from 'p-limit'; const limit = pLimit(10); await Promise.all(items.map(i => limit(() => op(i))));
// Note: if iterating an AsyncGenerator, Promise.all materializes all generators at once — prefer a streaming approach or p-limit instead.`,
      });
    });

    return findings;
  },
};

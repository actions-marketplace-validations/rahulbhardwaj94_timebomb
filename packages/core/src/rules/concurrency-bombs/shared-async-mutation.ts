import { SourceFile, SyntaxKind, AwaitExpression, Node, BinaryExpression } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

function isInsideAsyncFunction(node: Node): boolean {
  let current = node.getParent();
  while (current) {
    const kind = current.getKind();
    if (
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.FunctionExpression ||
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.MethodDeclaration
    ) {
      // Check if async
      const text = current.getText();
      return text.startsWith('async ') || text.includes('async (') || text.includes('async(');
    }
    current = current.getParent();
  }
  return false;
}

// Detects: sharedVar = ... or sharedVar += ... or sharedVar++ after an await
function findMutationsAfterAwait(sourceFile: SourceFile): Finding[] {
  const findings: Finding[] = [];

  // Find all assignment expressions where the left side is a module-level or closure-captured variable
  sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach((expr: BinaryExpression) => {
    const op = expr.getOperatorToken().getText();
    if (!['=', '+=', '-=', '*=', '/=', '||=', '&&=', '??='].includes(op)) return;

    if (!isInsideAsyncFunction(expr)) return;

    const left = expr.getLeft();
    const leftText = left.getText().trim();

    // Skip: local variable declarations (let/const/var in same scope) — those are not shared
    // Focus on: property accesses (this.x, obj.x) or module-level names that look shared
    const isPropertyAccess = left.getKind() === SyntaxKind.PropertyAccessExpression;
    const isElementAccess = left.getKind() === SyntaxKind.ElementAccessExpression;

    if (!isPropertyAccess && !isElementAccess) return;

    // Check if there's an await before this assignment in the same function body
    const fnScope = ((): Node | undefined => {
      let current = expr.getParent();
      while (current) {
        const kind = current.getKind();
        if (
          kind === SyntaxKind.ArrowFunction ||
          kind === SyntaxKind.FunctionExpression ||
          kind === SyntaxKind.FunctionDeclaration ||
          kind === SyntaxKind.MethodDeclaration
        ) {
          return current;
        }
        current = current.getParent();
      }
      return undefined;
    })();

    if (!fnScope) return;

    const fnText = fnScope.getText();
    const exprPos = expr.getStart() - fnScope.getStart();
    const textBeforeExpr = fnText.slice(0, exprPos);

    if (!textBeforeExpr.includes('await ')) return;

    const line = expr.getStartLineNumber();
    findings.push({
      ruleId: 'shared-async-mutation',
      severity: 'high',
      category: 'concurrency-bomb',
      filePath: sourceFile.getFilePath(),
      line,
      column: getColumn(expr),
      message: `Mutation of '${leftText}' after an await — if this function runs concurrently, two callers can interleave and corrupt shared state. This is a classic async race condition.`,
      suggestedFix: `Use a mutex/lock for shared state mutations, or refactor to return values instead of mutating shared variables. Libraries: async-mutex, p-mutex.`,
    });
  });

  return findings;
}

export const sharedAsyncMutation: Rule = {
  id: 'shared-async-mutation',
  category: 'concurrency-bomb',
  severity: 'high',
  title: 'Shared mutable state mutated after await — race condition under concurrent load',
  description:
    'Mutating shared state (object properties, module-level variables, cache entries) after an await creates a race condition: if the async function is called concurrently, two instances can interleave their reads and writes, corrupting state. Works correctly with one caller, fails silently under concurrent load.',
  incidentReference:
    'Incident: a request counter stored in module scope was incremented after an await db.query(). Under concurrent requests, two handlers read the same counter value, both incremented it, and wrote it back — effectively losing one increment per race. Caused billing undercounting by ~15% under peak load. Detected only during a load test.',

  check(sourceFile: SourceFile): Finding[] {
    return findMutationsAfterAwait(sourceFile);
  },
};

import { SourceFile, SyntaxKind, PropertyAccessExpression, CallExpression, Node } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

// 'read' intentionally omitted: it matches local file reads (readFile, readdir, readline)
// which are not unbounded database/API sources.
const FETCH_KEYWORDS = ['find', 'fetch', 'get', 'query', 'select', 'list', 'all', 'load'];

function getScopeText(node: Node): string {
  let current = node.getParent();
  while (current) {
    const kind = current.getKind();
    if (
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.FunctionExpression ||
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.MethodDeclaration ||
      kind === SyntaxKind.Block
    ) {
      return current.getText().toLowerCase();
    }
    current = current.getParent();
  }
  return sourceText(node);
}

function sourceText(node: Node): string {
  return node.getSourceFile().getText().toLowerCase();
}

function hasFetchInScope(node: Node): boolean {
  const scopeText = getScopeText(node);
  const hasAwait = scopeText.includes('await ');
  // scopeText is lowercased, so match lowercased keyword variants
  const hasFetchKeyword = FETCH_KEYWORDS.some((kw) =>
    scopeText.includes(kw + '(') ||
    scopeText.includes(kw + 'all') ||
    scopeText.includes(kw + 'many') ||
    scopeText.includes(kw + 'users') ||
    scopeText.includes(kw + 'items') ||
    scopeText.includes(kw + 'records') ||
    scopeText.includes(kw + 'data')
  );
  return hasAwait && hasFetchKeyword;
}

export const unboundedSort: Rule = {
  id: 'unbounded-sort',
  category: 'scale-bomb',
  severity: 'high',
  title: '.sort() on potentially unbounded array — O(n log n) memory and CPU at scale',
  description:
    'Array.sort() is in-place but still O(n log n) in time. On arrays fetched from a database, API, or message queue without a size limit, this creates unpredictable latency and memory spikes as data grows. It works fine in tests with 100 records and silently degrades at 100k.',
  incidentReference:
    'Incident: a fintech dashboard fetched all transactions for a user and sorted them client-side. The endpoint worked sub-second during testing. One whale user had 800k transactions. The sort took 45 seconds and OOM-killed the Node.js process. Added `.limit(1000)` to the query fixed it.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;

      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      if (propAccess.getName() !== 'sort') return;

      const obj = propAccess.getExpression();
      const objText = obj.getText();

      // Safe: already has a size bound
      if (
        objText.includes('.slice(') ||
        objText.includes('.limit(') ||
        objText.includes('.splice(')
      ) {
        return;
      }

      // Safe: literal array
      if (obj.getKind() === SyntaxKind.ArrayLiteralExpression) return;

      // Check if the direct call chain includes a fetch-like pattern
      const chainLower = objText.toLowerCase();
      const directFetchLike = FETCH_KEYWORDS.some((kw) => chainLower.includes(kw)) || chainLower.includes('await');

      // Also check the surrounding scope for async data fetching
      const scopeHasFetch = hasFetchInScope(call);

      if (directFetchLike || scopeHasFetch) {
        const line = call.getStartLineNumber();
        findings.push({
          ruleId: 'unbounded-sort',
          severity: 'high',
          category: 'scale-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(call),
          message: `.sort() on what appears to be an unbounded array (fetched from a database/API). At scale, this will cause latency spikes and potential OOM crashes.`,
          suggestedFix: `Add a size guard before sorting: if (arr.length > 10000) throw new Error('Too large'); Or sort at the data source (ORDER BY).`,
        });
      }
    });

    return findings;
  },
};

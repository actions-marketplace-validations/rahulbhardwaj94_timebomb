import { SourceFile, SyntaxKind, CallExpression, Node } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

const FETCH_KEYWORDS = ['find', 'fetch', 'get', 'query', 'select', 'list', 'all', 'load', 'read'];

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
  return node.getSourceFile().getText().toLowerCase();
}

export const unboundedReverse: Rule = {
  id: 'unbounded-reverse',
  category: 'scale-bomb',
  severity: 'medium',
  title: '.reverse() on potentially unbounded array — in-place mutation at unpredictable scale',
  description:
    'Array.reverse() mutates the array in place and is O(n). On arrays sourced from databases or APIs without pagination limits, this silently works in development (small datasets) and degrades or crashes in production (large datasets).',
  incidentReference:
    'Incident: a social feed fetched all posts for a user and reversed them to show newest-first. Worked fine for users with <1000 posts. A viral account with 500k posts caused the reverse to take seconds and block the event loop. Fixed by adding ORDER BY DESC at the database level.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;

      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      if (propAccess.getName() !== 'reverse') return;

      const obj = propAccess.getExpression();
      const objText = obj.getText();

      if (obj.getKind() === SyntaxKind.ArrayLiteralExpression) return;
      if (objText.includes('.slice(') || objText.includes('.limit(')) return;

      const chainLower = objText.toLowerCase();
      const directFetchLike = FETCH_KEYWORDS.some((kw) => chainLower.includes(kw)) || chainLower.includes('await');

      const scopeText = getScopeText(call);
      const scopeHasFetch =
        scopeText.includes('await ') &&
        FETCH_KEYWORDS.some((kw) => scopeText.includes(kw + '(') || scopeText.includes(kw + 'all') || scopeText.includes(kw + 'many'));

      if (directFetchLike || scopeHasFetch) {
        const line = call.getStartLineNumber();
        findings.push({
          ruleId: 'unbounded-reverse',
          severity: 'medium',
          category: 'scale-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(call),
          message: `.reverse() on what appears to be an unbounded array. Consider reversing the ORDER BY in your query instead.`,
          suggestedFix: `Sort at the data source with ORDER BY ... DESC instead of fetching all records and reversing in JavaScript.`,
        });
      }
    });

    return findings;
  },
};

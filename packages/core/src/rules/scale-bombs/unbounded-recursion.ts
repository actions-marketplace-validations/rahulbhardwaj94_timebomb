import { SourceFile, SyntaxKind, FunctionDeclaration, FunctionExpression, ArrowFunction, MethodDeclaration } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

type FunctionLike = FunctionDeclaration | FunctionExpression | ArrowFunction | MethodDeclaration;

function getFunctionName(fn: FunctionLike): string | null {
  if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
    return (fn as FunctionDeclaration).getName() ?? null;
  }
  if (fn.getKind() === SyntaxKind.MethodDeclaration) {
    return (fn as MethodDeclaration).getName();
  }
  return null;
}

function isSelfCallWithoutDepthGuard(fn: FunctionLike, name: string): boolean {
  const body = fn.getBody();
  if (!body) return false;

  // Use AST traversal to find calls where the callee is a bare Identifier matching
  // the function name. This excludes obj.name() patterns (PropertyAccessExpression),
  // so Math.round() does not trigger for a function named "round".
  const hasSelfCall = body.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expr = call.getExpression();
    return expr.getKind() === SyntaxKind.Identifier && expr.getText() === name;
  });

  if (!hasSelfCall) return false;

  // Check for depth/count guards
  const bodyText = body.getText();
  const hasDepthGuard =
    bodyText.includes('depth') ||
    bodyText.includes('Depth') ||
    bodyText.includes('level') ||
    bodyText.includes('Level') ||
    bodyText.includes('count') ||
    bodyText.includes('Count') ||
    bodyText.includes('maxDepth') ||
    bodyText.includes('maxLevel') ||
    bodyText.includes('MAX_') ||
    bodyText.includes('limit') ||
    bodyText.includes('Limit');

  return !hasDepthGuard;
}

export const unboundedRecursion: Rule = {
  id: 'unbounded-recursion',
  category: 'scale-bomb',
  severity: 'high',
  title: 'Recursive function without depth limit — stack overflow at scale',
  description:
    'Recursive functions without explicit depth limits will throw "Maximum call stack size exceeded" when input depth exceeds the JavaScript call stack limit (~10,000 frames in V8). Tree traversal, JSON parsing, and graph algorithms are common victims — they work on test data and fail on deep real-world inputs.',
  incidentReference:
    'Incident: a permissions system recursively resolved role hierarchies. In dev, roles were 3 levels deep. A customer with 12,000+ nested role assignments caused a stack overflow that crashed the auth service. The fix was adding a depth parameter with a max of 100.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    const functionKinds = [
      SyntaxKind.FunctionDeclaration,
      SyntaxKind.FunctionExpression,
      SyntaxKind.ArrowFunction,
      SyntaxKind.MethodDeclaration,
    ];

    for (const kind of functionKinds) {
      sourceFile.getDescendantsOfKind(kind).forEach((fn) => {
        const fnLike = fn as FunctionLike;
        const name = getFunctionName(fnLike);
        if (!name) return;

        if (isSelfCallWithoutDepthGuard(fnLike, name)) {
          const line = fn.getStartLineNumber();
          findings.push({
            ruleId: 'unbounded-recursion',
            severity: 'high',
            category: 'scale-bomb',
            filePath: sourceFile.getFilePath(),
            line,
            column: getColumn(fn),
            message: `Recursive function '${name}' has no depth limit guard. Deep inputs will cause "Maximum call stack size exceeded".`,
            suggestedFix: `Add a depth parameter: function ${name}(input, depth = 0) { if (depth > MAX_DEPTH) throw new Error('Max depth exceeded'); ... ${name}(child, depth + 1); }`,
          });
        }
      });
    }

    return findings;
  },
};

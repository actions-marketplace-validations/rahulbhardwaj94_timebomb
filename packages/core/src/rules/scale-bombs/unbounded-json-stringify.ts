import { SourceFile, SyntaxKind, CallExpression } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

export const unboundedJsonStringify: Rule = {
  id: 'unbounded-json-stringify',
  category: 'scale-bomb',
  severity: 'high',
  title: 'JSON.stringify() on potentially large object — no size limit or circular reference guard',
  description:
    'JSON.stringify() throws a TypeError on circular references and will produce enormous strings on large objects, exhausting heap memory. Both failure modes are invisible in development with small test objects but manifest in production.',
  incidentReference:
    'Incident: a logging middleware called JSON.stringify(req.body) to log request payloads. A client uploaded a 50MB JSON payload. stringify doubled the memory usage and crashed the process. A separate incident involved circular references in an ORM model that crashed a health-check endpoint.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const expr = call.getExpression().getText().trim();
      if (expr !== 'JSON.stringify') return;

      const args = call.getArguments();
      if (args.length === 0) return;

      const firstArg = args[0];

      // Safe: stringifying a literal value
      if (
        firstArg.getKind() === SyntaxKind.StringLiteral ||
        firstArg.getKind() === SyntaxKind.NumericLiteral ||
        firstArg.getKind() === SyntaxKind.TrueKeyword ||
        firstArg.getKind() === SyntaxKind.FalseKeyword ||
        firstArg.getKind() === SyntaxKind.NullKeyword
      ) {
        return;
      }

      // Safe: small literal objects/arrays
      if (firstArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
        const objectText = firstArg.getText();
        // Small inline objects are fine
        if (objectText.length < 200 && !objectText.includes('...')) return;
      }

      const argText = firstArg.getText();

      // Looks like it could be a large/external object
      const isRisky =
        argText.includes('req') ||
        argText.includes('body') ||
        argText.includes('data') ||
        argText.includes('result') ||
        argText.includes('response') ||
        argText.includes('payload') ||
        argText.includes('model') ||
        argText.includes('entity') ||
        argText.includes('document') ||
        argText.includes('record');

      if (isRisky) {
        const line = call.getStartLineNumber();
        findings.push({
          ruleId: 'unbounded-json-stringify',
          severity: 'high',
          category: 'scale-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(call),
          message: `JSON.stringify(${argText}) on a potentially large/circular object. Will throw on circular refs and may exhaust heap on large inputs.`,
          suggestedFix: `Wrap in try/catch for circular refs. For logging, use a safe serializer: import safeStringify from 'fast-safe-stringify';`,
        });
      }
    });

    return findings;
  },
};

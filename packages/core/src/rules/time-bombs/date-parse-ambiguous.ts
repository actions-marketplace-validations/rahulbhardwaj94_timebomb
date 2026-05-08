import { SourceFile, SyntaxKind, CallExpression } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

// Ambiguous: MM/DD/YYYY and DD/MM/YYYY are indistinguishable, also locale-dependent
const AMBIGUOUS_SLASH_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
// Non-ISO dash format: MM-DD-YYYY or DD-MM-YYYY (year is NOT in YYYY position at the start)
// ISO 8601 is YYYY-MM-DD (4-digit year first) — that's always safe
const NON_ISO_DASH_PATTERN = /^\d{1,2}-\d{1,2}-\d{4}$/;

export const dateParsAmbiguous: Rule = {
  id: 'date-parse-ambiguous',
  category: 'time-bomb',
  severity: 'medium',
  title: 'Date.parse() on ambiguous format — result is locale/implementation-defined',
  description:
    'Date.parse() behavior on non-ISO 8601 strings (e.g., "01/02/2024") is implementation-defined per the ECMAScript spec. V8, SpiderMonkey, and JavaScriptCore parse the same string differently in some locales. Code works in dev but fails for users with different locale settings or after a Node.js version upgrade.',
  incidentReference:
    'Incident: a date-gating feature used Date.parse("02/28/2023") which parsed correctly on the US-locale CI runner but returned NaN on European production servers with en-GB locale, causing a feature to appear enabled for all users regardless of date. Detected only after user complaints.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const expr = call.getExpression().getText().trim();
      if (expr !== 'Date.parse') return;

      const args = call.getArguments();
      if (args.length === 0) return;

      const firstArg = args[0];
      const argText = firstArg.getText().trim();

      // Only check string literals — dynamic values can't be statically analyzed
      if (
        firstArg.getKind() !== SyntaxKind.StringLiteral &&
        firstArg.getKind() !== SyntaxKind.NoSubstitutionTemplateLiteral
      ) {
        return;
      }

      const dateStr = argText.replace(/^['"`]|['"`]$/g, '');

      if (AMBIGUOUS_SLASH_PATTERN.test(dateStr) || NON_ISO_DASH_PATTERN.test(dateStr)) {
        const line = call.getStartLineNumber();
        findings.push({
          ruleId: 'date-parse-ambiguous',
          severity: 'medium',
          category: 'time-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(call),
          message: `Date.parse("${dateStr}") uses an ambiguous format. Behavior is locale/implementation-defined — it may return NaN or a wrong date in other environments.`,
          suggestedFix: `Use ISO 8601 format: Date.parse("${dateStr.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')}") or a date library.`,
        });
      }
    });

    return findings;
  },
};

import { SourceFile, SyntaxKind, BinaryExpression } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

const CURRENT_YEAR = new Date().getFullYear();
// Matches getFullYear/getYear calls AND variable names that semantically mean "year"
const YEAR_PATTERN = /\b(getFullYear|getYear)\b|\byear\b|\bYear\b/i;

export const hardcodedYearComparison: Rule = {
  id: 'hardcoded-year-comparison',
  category: 'time-bomb',
  severity: 'high',
  title: 'Hardcoded year comparison will silently fail after that year passes',
  description:
    'Comparisons like `year < 2025` or `year === 2024` are correct today but will evaluate to `false` for all future dates once the hardcoded year passes. This causes authorization bypasses, feature flags that never activate, and billing logic that stops working silently.',
  incidentReference:
    "Classic incident: a SaaS app had `if (signupYear < 2023) { applyLegacyPricing() }`. In 2024, all new signups were charged at new pricing even during a grandfathering campaign — the code silently stopped applying the discount. Took 3 weeks to detect via revenue anomaly.",

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach((expr: BinaryExpression) => {
      const op = expr.getOperatorToken().getText();
      if (!['<', '>', '<=', '>=', '===', '!==', '==', '!='].includes(op)) return;

      const left = expr.getLeft().getText();
      const right = expr.getRight().getText();

      const leftIsYear = YEAR_PATTERN.test(left);
      const rightIsYear = YEAR_PATTERN.test(right);

      const rightNum = Number(right);
      const leftNum = Number(left);

      const rightIsHardcodedYear =
        !isNaN(rightNum) && rightNum >= 2000 && rightNum <= CURRENT_YEAR + 5;
      const leftIsHardcodedYear =
        !isNaN(leftNum) && leftNum >= 2000 && leftNum <= CURRENT_YEAR + 5;

      if ((leftIsYear && rightIsHardcodedYear) || (rightIsYear && leftIsHardcodedYear)) {
        const line = expr.getStartLineNumber();
        const hardcodedYear = rightIsHardcodedYear ? rightNum : leftNum;

        findings.push({
          ruleId: 'hardcoded-year-comparison',
          severity: 'high',
          category: 'time-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(expr),
          message: `Hardcoded year comparison with ${hardcodedYear}. This condition will break silently once ${hardcodedYear} passes.`,
          suggestedFix: `Replace hardcoded year with a named constant or config value, or use relative date arithmetic (e.g., Date.now() - startDate).`,
        });
      }
    });

    return findings;
  },
};

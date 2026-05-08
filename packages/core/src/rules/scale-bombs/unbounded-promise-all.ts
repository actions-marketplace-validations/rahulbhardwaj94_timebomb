import { SourceFile, SyntaxKind, CallExpression } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

export const unboundedPromiseAll: Rule = {
  id: 'unbounded-promise-all',
  category: 'scale-bomb',
  severity: 'critical',
  title: 'Promise.all() over unbounded array — memory explosion and rate-limit bombs at scale',
  description:
    'Promise.all() spawns all promises simultaneously. On arrays sourced from databases/APIs without size limits, this creates N parallel requests/operations, exhausting connection pools, hitting rate limits, and blowing heap memory. Works at 10 items, kills the process at 10,000.',
  incidentReference:
    'Incident: a data export endpoint fetched all user IDs (~50k) and ran Promise.all(ids.map(id => fetchUserData(id))). In staging with 100 users it was fast. In production it opened 50,000 simultaneous HTTP connections, triggered rate limiting on the downstream service, and crashed the exporter process. Fixed with a concurrency limiter (p-limit).',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const expr = call.getExpression().getText().trim();
      if (expr !== 'Promise.all' && expr !== 'Promise.allSettled') return;

      const args = call.getArguments();
      if (args.length === 0) return;

      const firstArg = args[0];

      // Safe: literal array with known small size
      if (firstArg.getKind() === SyntaxKind.ArrayLiteralExpression) {
        const elements = firstArg.asKindOrThrow(SyntaxKind.ArrayLiteralExpression).getElements();
        if (elements.length <= 20) return;
      }

      const argText = firstArg.getText();

      // Map over a variable — could be unbounded
      const hasMapCall = argText.includes('.map(');
      const hasVariable = !argText.startsWith('[');

      if (hasMapCall || hasVariable) {
        // Check for concurrency limiters in scope
        const fileText = sourceFile.getText();
        const hasConcurrencyLimiter =
          fileText.includes('p-limit') ||
          fileText.includes('pLimit') ||
          fileText.includes('p-map') ||
          fileText.includes('pMap') ||
          fileText.includes('bottleneck') ||
          fileText.includes('Bottleneck') ||
          fileText.includes('async-pool') ||
          fileText.includes('asyncPool');

        if (!hasConcurrencyLimiter) {
          const line = call.getStartLineNumber();
          findings.push({
            ruleId: 'unbounded-promise-all',
            severity: 'critical',
            category: 'scale-bomb',
            filePath: sourceFile.getFilePath(),
            line,
            column: getColumn(call),
            message: `${expr}(${argText.slice(0, 60)}${argText.length > 60 ? '...' : ''}) spawns all promises at once. If the array is unbounded, this will exhaust connections and memory at scale.`,
            suggestedFix: `Use a concurrency limiter: import pLimit from 'p-limit'; const limit = pLimit(10); await Promise.all(items.map(item => limit(() => processItem(item))));`,
          });
        }
      }
    });

    return findings;
  },
};

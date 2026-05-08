import { SourceFile, SyntaxKind, CallExpression } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

export const settimeoutZeroAsSync: Rule = {
  id: 'settimeout-zero-as-sync',
  category: 'concurrency-bomb',
  severity: 'medium',
  title: 'setTimeout(fn, 0) used as a synchronization primitive — ordering is not guaranteed',
  description:
    'setTimeout(fn, 0) does not guarantee execution after other microtasks or macrotasks in a reliable way. It is often misused to "defer" work or "yield to the event loop" as a synchronization strategy, but the ordering between multiple setTimeout(fn, 0) calls and Promise resolutions is implementation-defined and can change between Node.js versions.',
  incidentReference:
    'Incident: code used setTimeout(resolve, 0) to "ensure" a database write completed before a subsequent read in a different code path. Under Node.js 14 this worked due to accidental event loop ordering. Upgrading to Node.js 18 changed microtask/macrotask scheduling and the read consistently ran before the write. Caused data corruption on ~0.1% of requests for weeks.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const name = call.getExpression().getText().trim();
      if (name !== 'setTimeout') return;

      const args = call.getArguments();
      if (args.length < 2) return;

      const delayArg = args[1];
      const delayText = delayArg.getText().trim();

      // Only flag explicit 0 delays
      if (delayText !== '0') return;

      // Check if the callback does something that looks like sync coordination
      const callbackArg = args[0];
      const callbackText = callbackArg.getText();

      const looksLikeSyncPrimitive =
        callbackText.includes('resolve') ||
        callbackText.includes('reject') ||
        callbackText.includes('callback') ||
        callbackText.includes('cb(') ||
        callbackText.includes('next(') ||
        callbackText.includes('done(') ||
        callbackText.includes('emit(');

      if (looksLikeSyncPrimitive) {
        const line = call.getStartLineNumber();
        findings.push({
          ruleId: 'settimeout-zero-as-sync',
          severity: 'medium',
          category: 'concurrency-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(call),
          message: `setTimeout(fn, 0) used as a synchronization primitive. Ordering relative to Promises and other macrotasks is not guaranteed and has changed between Node.js versions.`,
          suggestedFix: `Use queueMicrotask(fn) or Promise.resolve().then(fn) for predictable microtask-level deferral. For true async coordination, use explicit await chains or event emitters.`,
        });
      }
    });

    return findings;
  },
};

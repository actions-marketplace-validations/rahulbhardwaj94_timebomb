import { SourceFile, SyntaxKind, CallExpression } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

const MONGO_FIND_METHODS = ['find', 'findOne', 'findMany', 'findAll'];

export const mongoNoLimit: Rule = {
  id: 'mongo-no-limit',
  category: 'scale-bomb',
  severity: 'critical',
  title: 'MongoDB query without .limit() — will return all documents as collection grows',
  description:
    'A MongoDB .find() without .limit() returns all matching documents. In development with seeded data this is fast. As the collection grows to millions of documents, the query returns everything, saturating network bandwidth, exhausting heap memory, and blocking the event loop.',
  incidentReference:
    'Incident: a MongoDB collection started at ~1000 documents. A nightly analytics job ran .find({status: "processed"}) without a limit. After 18 months the collection had 40M documents. The job fetched all 40M docs into memory each night, triggering OOM kills. The collection scan also caused production read latency spikes.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call: CallExpression) => {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;

      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const methodName = propAccess.getName();

      if (!MONGO_FIND_METHODS.includes(methodName)) return;

      const objText = propAccess.getExpression().getText();

      // Look for Mongoose/MongoDB model patterns
      const isMongoLike =
        objText.includes('Model') ||
        objText.includes('model') ||
        objText.includes('Schema') ||
        objText.includes('Collection') ||
        objText.includes('collection') ||
        objText.includes('db.') ||
        /^[A-Z][a-z]/.test(objText); // PascalCase — likely a Mongoose model

      if (!isMongoLike) return;

      // Check if .limit() is chained after this call
      const parent = call.getParent();
      if (!parent) return;

      const callChain = parent.getText();
      if (callChain.includes('.limit(') || callChain.includes('.lean().limit(')) return;

      // Check outer chain
      const grandParent = parent.getParent();
      if (grandParent && grandParent.getText().includes('.limit(')) return;

      const line = call.getStartLineNumber();
      findings.push({
        ruleId: 'mongo-no-limit',
        severity: 'critical',
        category: 'scale-bomb',
        filePath: sourceFile.getFilePath(),
        line,
        column: getColumn(call),
        message: `${objText}.${methodName}() without .limit(). As this collection grows, this query will return all documents and may OOM the process.`,
        suggestedFix: `Add .limit(n) to your query: ${objText}.${methodName}(filter).limit(1000). For pagination, combine with .skip() or use cursor-based pagination.`,
      });
    });

    return findings;
  },
};

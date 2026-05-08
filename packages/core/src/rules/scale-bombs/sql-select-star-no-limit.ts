import { SourceFile, SyntaxKind, Node } from 'ts-morph';
import { Rule, Finding } from '../../types';
import { getColumn } from '../../ast/utils';

// Matches SELECT * or SELECT col1, col2 ... FROM ... without LIMIT/TOP/ROWNUM
const SELECT_STAR_PATTERN = /SELECT\s+(\*|[\w\s,.*`"[\]]+)\s+FROM\s+\w+/i;
const HAS_LIMIT = /LIMIT\s+\d+|TOP\s+\d+|ROWNUM\s*[<=]\s*\d+|FETCH\s+FIRST\s+\d+/i;

function checkStringForSqlIssue(text: string): boolean {
  if (!SELECT_STAR_PATTERN.test(text)) return false;
  if (HAS_LIMIT.test(text)) return false;
  return true;
}

function extractStringContent(node: Node): string | null {
  if (node.getKind() === SyntaxKind.StringLiteral) {
    return node.getText().slice(1, -1);
  }
  if (node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return node.getText().slice(1, -1);
  }
  if (node.getKind() === SyntaxKind.TemplateExpression) {
    return node.getText();
  }
  return null;
}

export const sqlSelectStarNoLimit: Rule = {
  id: 'sql-select-star-no-limit',
  category: 'scale-bomb',
  severity: 'critical',
  title: 'SQL SELECT without LIMIT — will return all rows as table grows',
  description:
    'A SQL SELECT without a LIMIT clause returns all rows matching the WHERE clause. Safe in development with seeded test data, catastrophic in production tables with millions of rows — saturating network I/O, exhausting heap memory, and locking up the event loop.',
  incidentReference:
    'Incident: a SaaS analytics query ran SELECT * FROM events WHERE user_id = ? without LIMIT. The query was fast for 99% of users. One enterprise customer had 15M events. The query returned all 15M rows over the network, used 4GB of heap, and OOM-killed the API server. Reported as a "random crash" for 2 weeks before root-cause was found.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.forEachDescendant((node) => {
      const content = extractStringContent(node);
      if (!content) return;

      if (checkStringForSqlIssue(content)) {
        const line = node.getStartLineNumber();
        const preview = content.slice(0, 80).replace(/\n/g, ' ');
        findings.push({
          ruleId: 'sql-select-star-no-limit',
          severity: 'critical',
          category: 'scale-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: getColumn(node),
          message: `SQL query without LIMIT: "${preview}${content.length > 80 ? '...' : ''}". This will return all rows as the table grows.`,
          suggestedFix: `Add LIMIT to your query: ...FROM table WHERE ... LIMIT 1000. For full scans, use cursor-based pagination.`,
        });
      }
    });

    return findings;
  },
};

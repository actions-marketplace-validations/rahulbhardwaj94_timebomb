import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getRuleById } from 'timebomb-core';

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[33m';

export function runExplain(ruleId: string): void {
  const rule = getRuleById(ruleId);

  if (!rule) {
    console.error(`Unknown rule: ${ruleId}`);
    console.error(`Run 'timebomb rules' to see all available rules.`);
    process.exit(1);
  }

  console.log('');
  console.log(`${BOLD}${rule.title}${RESET}`);
  console.log(`${DIM}Rule ID: ${rule.id}  |  Category: ${rule.category}  |  Severity: ${rule.severity}${RESET}`);
  console.log('');
  console.log(`${CYAN}Description${RESET}`);
  console.log(`  ${rule.description}`);
  console.log('');
  console.log(`${YELLOW}Real-world incident${RESET}`);
  console.log(`  ${rule.incidentReference}`);

  // Try to load markdown doc
  const docPaths = [
    join(__dirname, '../../../../rules', `${rule.id}.md`),
    join(process.cwd(), 'rules', `${rule.id}.md`),
  ];

  for (const docPath of docPaths) {
    if (existsSync(docPath)) {
      const content = readFileSync(docPath, 'utf8');
      const codeSection = content.match(/## Bad Code[\s\S]*?(?=## Good Code|$)/);
      const fixSection = content.match(/## Good Code[\s\S]*/);

      if (codeSection) {
        console.log('');
        console.log(`${CYAN}Bad Pattern${RESET}`);
        console.log(codeSection[0].replace('## Bad Code', '').trim());
      }

      if (fixSection) {
        console.log('');
        console.log(`${CYAN}Fixed Version${RESET}`);
        console.log(fixSection[0].replace('## Good Code', '').trim());
      }
      break;
    }
  }

  console.log('');
}

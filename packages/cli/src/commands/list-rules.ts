import { ALL_RULES } from 'timebomb-core';

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

const SEVERITY_COLOR: Record<string, string> = {
  critical: RED,
  high: YELLOW,
  medium: CYAN,
};

export function runListRules(): void {
  const byCategory: Record<string, typeof ALL_RULES> = {};

  for (const rule of ALL_RULES) {
    byCategory[rule.category] = byCategory[rule.category] ?? [];
    byCategory[rule.category].push(rule);
  }

  console.log('');
  console.log(`${BOLD}TimeBomb Rules (${ALL_RULES.length} total)${RESET}`);
  console.log('');

  for (const [category, rules] of Object.entries(byCategory)) {
    console.log(`${BOLD}${category}${RESET}`);

    for (const rule of rules) {
      const color = SEVERITY_COLOR[rule.severity] ?? CYAN;
      console.log(
        `  ${color}${rule.severity.padEnd(8)}${RESET}  ${rule.id.padEnd(40)}  ${DIM}${rule.title}${RESET}`
      );
    }

    console.log('');
  }

  console.log(`${DIM}Run 'timebomb explain <rule-id>' for details on any rule.${RESET}\n`);
}

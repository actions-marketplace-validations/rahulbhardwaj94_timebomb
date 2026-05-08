#!/usr/bin/env node
import { Command } from 'commander';
import { runAnalyze } from './commands/analyze';
import { runExplain } from './commands/explain';
import { runListRules } from './commands/list-rules';

const program = new Command();

program
  .name('timebomb')
  .description('Detect code that passes review and tests but is guaranteed to break in production')
  .version('1.0.0');

program
  .command('analyze [paths...]', { isDefault: true })
  .description('Analyze TypeScript/JavaScript files for time bombs, scale bombs, and concurrency bombs')
  .option('--format <format>', 'Output format: terminal, json, github', 'terminal')
  .option('--changed', 'Only analyze files changed in the current git diff')
  .option('--rules <rules>', 'Comma-separated list of rule IDs to run (default: all)')
  .action(async (paths: string[], options) => {
    await runAnalyze(paths, {
      format: options.format as 'terminal' | 'json' | 'github',
      changed: options.changed ?? false,
      rules: options.rules,
    });
  });

program
  .command('explain <rule-id>')
  .description('Show detailed explanation and incident reference for a specific rule')
  .action((ruleId: string) => {
    runExplain(ruleId);
  });

program
  .command('rules')
  .description('List all available rules')
  .action(() => {
    runListRules();
  });

program.parse(process.argv);

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import { RuleEngine, ALL_RULES, AnalysisResult } from 'timebomb-core';
import { printTerminalReport } from '../output/terminal';
import { printJsonReport } from '../output/json';
import { printGithubReport } from '../output/github';

interface AnalyzeOptions {
  format: 'terminal' | 'json' | 'github';
  changed: boolean;
  rules?: string;
}

async function resolveFiles(patterns: string[], changed: boolean): Promise<string[]> {
  if (changed) {
    return getChangedFiles();
  }

  if (patterns.length === 0) {
    patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'];
  }

  const TS_JS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
  const IGNORE = /node_modules|[/\\]dist[/\\]|[/\\]build[/\\]|\.git|\.d\.ts$/;

  const files: string[] = [];
  for (const pattern of patterns) {
    const abs = resolve(pattern);
    // If it's a direct file path (no wildcards) and it exists, use it directly
    if (!pattern.includes('*') && !pattern.includes('?') && existsSync(abs)) {
      if (TS_JS.test(abs) && !IGNORE.test(abs)) files.push(abs);
      continue;
    }
    const matches = await glob(pattern, {
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**', '**/*.d.ts'],
      absolute: true,
    });
    files.push(...matches.filter((f) => TS_JS.test(f) && !IGNORE.test(f)));
  }

  return [...new Set(files)];
}

function getChangedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    const allChanged = [...output.split('\n'), ...staged.split('\n')]
      .map((f) => f.trim())
      .filter((f) => f && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f))
      .map((f) => resolve(process.cwd(), f))
      .filter((f) => existsSync(f));
    return [...new Set(allChanged)];
  } catch {
    console.error('Warning: could not determine changed files via git. Analyzing all files.');
    return [];
  }
}

export async function runAnalyze(
  paths: string[],
  options: AnalyzeOptions
): Promise<void> {
  const files = await resolveFiles(paths, options.changed);

  if (files.length === 0) {
    console.log('No TypeScript/JavaScript files found to analyze.');
    process.exit(0);
  }

  const activeRules = options.rules ? options.rules.split(',').map((r) => r.trim()) : undefined;
  const engine = new RuleEngine(ALL_RULES);

  const result: AnalysisResult = engine.analyze({ files, rules: activeRules });

  switch (options.format) {
    case 'json':
      printJsonReport(result);
      break;
    case 'github':
      printGithubReport(result);
      break;
    default:
      printTerminalReport(result, process.cwd());
  }

  const hasCritical = result.findings.some((f) => f.severity === 'critical');
  const hasHighOrAbove = result.findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  if (hasCritical) process.exit(2);
  else if (hasHighOrAbove) process.exit(1);
  else if (result.findings.length > 0) process.exit(1);
  else process.exit(0);
}

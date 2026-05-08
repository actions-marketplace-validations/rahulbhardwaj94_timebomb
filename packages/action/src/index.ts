import * as core from '@actions/core';
import * as github from '@actions/github';
import { glob } from 'glob';
import { RuleEngine, ALL_RULES, AnalysisResult } from 'timebomb-core';
import { buildPrComment, findExistingComment } from './pr-comment';

type FailOn = 'critical' | 'high' | 'medium' | 'none';

async function run(): Promise<void> {
  const failOn = (core.getInput('fail-on') || 'critical') as FailOn;
  const paths = (core.getInput('paths') || '**/*.{ts,tsx,js,jsx}').split(',').map((p) => p.trim());
  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';

  core.info('🔍 TimeBomb: scanning for future-failure patterns...');

  const files: string[] = [];
  for (const pattern of paths) {
    const matches = await glob(pattern, {
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**', '**/*.d.ts'],
      absolute: true,
    });
    files.push(...matches);
  }

  core.info(`📂 Found ${files.length} files to analyze`);

  const engine = new RuleEngine(ALL_RULES);
  const result: AnalysisResult = engine.analyze({ files });

  const { findings } = result;

  core.info(`🎯 Analysis complete: ${findings.length} findings in ${result.durationMs}ms`);

  // Emit GitHub annotations
  for (const finding of findings) {
    const level = finding.severity === 'critical' || finding.severity === 'high' ? 'error' : 'warning';
    const annotationFn = level === 'error' ? core.error : core.warning;
    annotationFn(`[${finding.ruleId}] ${finding.message}`, {
      file: finding.filePath,
      startLine: finding.line,
      startColumn: finding.column,
    });
  }

  // Post PR comment
  if (token && github.context.eventName === 'pull_request') {
    await postPrComment(result, token);
  }

  // Set outputs
  core.setOutput('findings-count', findings.length.toString());
  core.setOutput('critical-count', findings.filter((f) => f.severity === 'critical').length.toString());
  core.setOutput('high-count', findings.filter((f) => f.severity === 'high').length.toString());
  core.setOutput('medium-count', findings.filter((f) => f.severity === 'medium').length.toString());

  // Determine exit
  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHigh = findings.some((f) => f.severity === 'high');
  const hasMedium = findings.some((f) => f.severity === 'medium');

  const shouldFail =
    failOn === 'critical' && hasCritical
      ? true
      : failOn === 'high' && (hasCritical || hasHigh)
        ? true
        : failOn === 'medium' && (hasCritical || hasHigh || hasMedium)
          ? true
          : false;

  if (shouldFail) {
    core.setFailed(`TimeBomb found ${findings.length} issue(s) at or above severity '${failOn}'.`);
  }
}

async function postPrComment(result: AnalysisResult, token: string): Promise<void> {
  const octokit = github.getOctokit(token);
  const ctx = github.context;
  const { owner, repo } = ctx.repo;
  const prNumber = ctx.payload.pull_request?.number;

  if (!prNumber) return;

  const sha = ctx.payload.pull_request?.head?.sha ?? ctx.sha;
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const body = buildPrComment(result, repoUrl, sha);

  const existingComments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existingId = findExistingComment(existingComments.data as Array<{ id: number; body: string }>);

  if (existingId) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingId,
      body,
    });
    core.info('📝 Updated existing TimeBomb PR comment');
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    core.info('📝 Created TimeBomb PR comment');
  }
}

run().catch((err) => {
  core.setFailed(err.message);
});

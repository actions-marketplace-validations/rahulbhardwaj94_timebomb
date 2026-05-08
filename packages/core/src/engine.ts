import { Rule, Finding, AnalysisOptions, AnalysisResult } from './types';
import { createProject, getSourceFiles } from './ast/traversal';

export class RuleEngine {
  private rules: Rule[];

  constructor(rules: Rule[]) {
    this.rules = rules;
  }

  analyze(options: AnalysisOptions): AnalysisResult {
    const start = Date.now();
    const project = createProject(options.files);
    const sourceFiles = getSourceFiles(project);

    const activeRules = options.rules
      ? this.rules.filter((r) => options.rules!.includes(r.id))
      : this.rules;

    const findings: Finding[] = [];

    for (const sourceFile of sourceFiles) {
      for (const rule of activeRules) {
        try {
          const ruleFindings = rule.check(sourceFile);
          findings.push(...ruleFindings);
        } catch {
          // Rule errors must not crash analysis — log to stderr in CLI layer
        }
      }
    }

    return {
      findings,
      filesAnalyzed: sourceFiles.length,
      durationMs: Date.now() - start,
    };
  }
}

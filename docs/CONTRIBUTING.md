# Contributing a New Rule to TimeBomb

Adding a rule takes under 10 minutes. Here's exactly what to do.

---

## The One Hard Requirement

**Every rule must have a real incident reference.**

If you cannot describe a specific production failure (even anonymized) that this rule would have caught, the rule does not ship. "This seems like it could be a problem" is not enough. TimeBomb is a library of hard-won production wisdom, not a generic linter.

---

## Step 1: Write the Rule Implementation

Create a file in the appropriate category under `packages/core/src/rules/`:

```
packages/core/src/rules/
├── time-bombs/          ← Failures caused by dates/time passing
├── scale-bombs/         ← Failures caused by data volume growing
└── concurrency-bombs/   ← Failures caused by concurrent execution
```

Use this template:

```typescript
// packages/core/src/rules/<category>/<your-rule-id>.ts
import { SourceFile, SyntaxKind } from 'ts-morph';
import { Rule, Finding } from '../../types';

export const myRule: Rule = {
  id: 'my-rule-id',                    // kebab-case, unique
  category: 'time-bomb',               // time-bomb | scale-bomb | concurrency-bomb
  severity: 'critical',                // critical | high | medium
  title: 'One-line summary of what breaks and why',
  description:
    '2-3 sentences. What is the pattern, why does it fail, under what conditions.',
  incidentReference:
    'Specific incident: describe when/how/where this broke in production, what the impact was, what fixed it.',

  check(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
      // Your detection logic here
      // Use ts-morph AST traversal
      
      if (/* condition */) {
        const line = call.getStartLineNumber();
        findings.push({
          ruleId: 'my-rule-id',
          severity: 'critical',
          category: 'time-bomb',
          filePath: sourceFile.getFilePath(),
          line,
          column: call.getStart() - sourceFile.getPositionOfLineAndCharacter(line - 1, 0),
          message: `Specific message explaining this exact finding.`,
          suggestedFix: `Concrete code change to fix this.`,
        });
      }
    });

    return findings;
  },
};
```

### Using ts-morph for AST Traversal

ts-morph provides a clean API over TypeScript's compiler:

```typescript
// Get all call expressions
sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

// Get all binary expressions (a + b, a === b, etc.)
sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)

// Get all function declarations
sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)

// Walk up to parent
node.getParent()

// Get source text of a node
node.getText()

// Get line number (1-based)
node.getStartLineNumber()
```

See the [ts-morph documentation](https://ts-morph.com) and existing rules for examples.

---

## Step 2: Register the Rule

Add your rule to `packages/core/src/rules/registry.ts`:

```typescript
import { myRule } from './<category>/my-rule-id';

export const ALL_RULES: Rule[] = [
  // ... existing rules ...
  myRule,
];
```

---

## Step 3: Write Tests

Create `packages/core/tests/rules/<category>.test.ts` (or add to existing):

```typescript
describe('my-rule-id', () => {
  it('flags the bad pattern', () => {
    const src = makeSourceFile(`
      // Code that should trigger the rule
      myBadPattern();
    `);
    const findings = myRule.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'my-rule-id');
  });

  it('does not flag the safe pattern', () => {
    const src = makeSourceFile(`
      // Fixed version of the code
      mySafePattern();
    `);
    const findings = myRule.check(src);
    assert.equal(findings.length, 0);
  });
});
```

**You must have at least:**
- One test with code that SHOULD trigger the rule
- One test with the fixed/safe version that should NOT trigger

---

## Step 4: Write the Markdown Documentation

Create `rules/my-rule-id.md`:

```markdown
# my-rule-id

**Category:** time-bomb | scale-bomb | concurrency-bomb
**Severity:** critical | high | medium
**Auto-fix available:** false

## Summary

One paragraph explaining what this detects and why it fails.

## Real-World Incident

Specific story: what broke, when, what the impact was, what fixed it.

## Bad Code

```typescript
// The pattern that TimeBomb flags
badCode();
```

## Good Code

```typescript
// The fixed version
goodCode();
```
```

---

## Step 5: Verify

```bash
cd packages/core
npm run build
npm test
```

All tests must pass. The rule must not generate false positives on the good code fixtures.

---

## False Positive Policy

**False positives destroy trust.** A rule that fires on safe code is worse than no rule at all.

Before submitting:
1. Run your rule against 3+ popular open-source TypeScript repos
2. Verify all flagged code is actually problematic
3. If you find false positives, tighten the detection logic

When in doubt, be more conservative. Better to miss a true positive than to flag safe code.

---

## Submitting

1. Fork the repo
2. Create a branch: `git checkout -b rule/my-rule-id`
3. Add rule, tests, and docs
4. Open a PR with the title: `rule: my-rule-id — [one-line description]`
5. In the PR description, include the real incident reference in full

PRs without a real incident reference will not be merged.

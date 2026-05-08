# TimeBomb Architecture

## Overview

TimeBomb is a monorepo with three packages:

```
packages/
├── core/    — Rule engine, AST traversal, all 16 rules
├── cli/     — npx timebomb CLI tool
└── action/  — GitHub Action wrapper
```

## Data Flow

```
Files on disk
     │
     ▼
ts-morph Project
(parse TS/JS to AST)
     │
     ▼
RuleEngine.analyze()
  ├── Rule: settimeout-int32-overflow.check(sourceFile) → Finding[]
  ├── Rule: unbounded-promise-all.check(sourceFile) → Finding[]
  └── Rule: sequential-await-in-loop.check(sourceFile) → Finding[]
     │
     ▼
Finding[]
     │
     ├── terminal reporter → colored console output
     ├── json reporter     → JSON.stringify
     └── github reporter   → ::error / ::warning annotations
```

## Key Design Decisions

### ts-morph over raw TypeScript Compiler API

The TypeScript Compiler API is powerful but low-level. Rule authors would need to understand `NodeFlags`, `TypeFlags`, and the full AST grammar to write rules. ts-morph provides a clean, documented wrapper that makes rule authorship tractable for contributors who aren't TypeScript compiler experts.

### Zero-config V1

Every config option is adoption friction. V1 ships with fixed severities, no rule customization, and no `.timebombrc` file. The rules are opinionated because they're grounded in real incidents — if the severity is wrong, the incident reference is wrong.

### False positives over false negatives

A rule that fires on safe code destroys trust faster than a rule that misses some true positives. Rules are conservative. When ambiguous, we require additional signal (database-fetch-like naming, await before mutation, etc.) before flagging.

### Rules are pure functions

`rule.check(sourceFile)` takes a ts-morph `SourceFile` and returns `Finding[]`. No side effects, no global state. This makes rules trivially testable: create a source file in memory, run the rule, assert on findings.

## Package Responsibilities

### `@timebomb/core`

- `types.ts` — `Rule`, `Finding`, `AnalysisResult` interfaces
- `engine.ts` — `RuleEngine` class: loads rules, runs them on source files
- `ast/traversal.ts` — ts-morph project creation utilities
- `rules/` — All 16 rule implementations
- `rules/registry.ts` — `ALL_RULES` array and `getRuleById()`
- `reporter.ts` — JSON and GitHub annotation formatters

### `@timebomb/cli`

- `index.ts` — Commander.js CLI entry point
- `commands/analyze.ts` — File resolution (glob + `--changed` git diff), engine invocation
- `commands/explain.ts` — `timebomb explain <rule-id>` command
- `commands/list-rules.ts` — `timebomb rules` command
- `output/terminal.ts` — Colored human-readable output
- `output/json.ts` — JSON output
- `output/github.ts` — GitHub workflow command output

### `@timebomb/action`

- `index.ts` — GitHub Action entry: reads inputs, runs engine, posts annotations, calls PR commenter
- `pr-comment.ts` — Builds idempotent PR comment body, finds existing comment by marker

## Adding a New Rule

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Performance

TimeBomb targets < 30s on a 100k-line codebase. Key factors:

1. **ts-morph project creation is the bottleneck** — once files are parsed, rule traversal is fast
2. **Rules are O(n) in AST nodes** — no cross-file analysis in V1
3. **`--changed` mode** resolves only git-diff files before creating the project, limiting parse time to PR-sized changesets

## Testing

Each rule has at minimum:
- A "bad" fixture test that MUST produce findings
- A "good" fixture test that MUST produce zero findings

Tests use Node.js built-in `node:test` (no extra test framework needed).

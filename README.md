# TimeBomb

**Detect code that passes review and tests but is guaranteed to break in production.**

```bash
npx timebomb-scanner
```

![TimeBomb demo](docs/demo.gif)

---

## What does it catch?

TimeBomb finds three categories of production failures that static type checkers, ESLint, and test suites can't detect — because they require reasoning about *future state*, not current correctness:

| Category | Example | Why it fails |
|----------|---------|--------------|
| **Time Bombs** | `setTimeout(fn, 30 * 24 * 60 * 60 * 1000)` | 30-day delay overflows int32 → fires immediately |
| **Scale Bombs** | `Promise.all(userIds.map(fetchUser))` | Works at 10 users, OOM-kills at 50,000 |
| **Concurrency Bombs** | `await sendEmail(user)` in a `for` loop | 10k users × 100ms = 16 minutes, blocks event loop |

Every rule is traced to a **real production post-mortem**. This is not a generic linter.

---

## Install

```bash
# One-shot, no install required
npx timebomb-scanner

# Or install globally
npm install -g timebomb-scanner

# GitHub Action (paste into .github/workflows/timebomb.yml)
uses: timebomb-dev/timebomb-action@v1
```

---

## Usage

```bash
# Analyze all TS/JS files in the current directory
npx timebomb-scanner

# Analyze specific paths/globs
npx timebomb-scanner src/ tests/

# Only analyze files changed in the current git diff (fast, for pre-commit)
npx timebomb-scanner --changed

# JSON output for tooling integration
npx timebomb-scanner --format json

# GitHub Actions annotation format
npx timebomb-scanner --format github

# Explain a specific rule (includes the real incident that motivated it)
npx timebomb-scanner explain settimeout-int32-overflow

# List all rules
npx timebomb-scanner rules
```

---

## GitHub Action

Add to `.github/workflows/timebomb.yml`:

```yaml
name: TimeBomb
on: [pull_request]

jobs:
  timebomb:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: timebomb-dev/timebomb-action@v1
        with:
          fail-on: critical   # critical | high | medium | none
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

TimeBomb posts a single PR comment with findings and updates it on subsequent pushes (no comment spam).

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No issues found |
| `1` | Warnings only (high/medium) |
| `2` | Critical issues found |

---

## Rules

### Time Bombs (6 rules)

| Rule ID | Severity | What it detects |
|---------|----------|----------------|
| `settimeout-int32-overflow` | critical | setTimeout delay > 24.8 days → fires immediately |
| `setinterval-int32-overflow` | critical | setInterval period > 24.8 days → fires at 1ms rate |
| `hardcoded-year-comparison` | high | `year < 2025` — silently wrong after 2025 |
| `naive-date-arithmetic` | high | Adding 86400000ms to timestamp, ignores DST |
| `date-parse-ambiguous` | medium | `Date.parse("01/02/2024")` — locale-dependent |
| `y2038-timestamp` | high | `timestamp \| 0` truncates to 32-bit → breaks in 2038 |

### Scale Bombs (7 rules)

| Rule ID | Severity | What it detects |
|---------|----------|----------------|
| `unbounded-sort` | high | `.sort()` on database-fetched arrays without size guard |
| `unbounded-reverse` | medium | `.reverse()` on potentially unbounded arrays |
| `unbounded-recursion` | high | Recursive functions without depth limits |
| `unbounded-json-stringify` | high | `JSON.stringify(req.body)` — OOM on large payloads |
| `unbounded-promise-all` | critical | `Promise.all(ids.map(...))` without concurrency limit |
| `mongo-no-limit` | critical | MongoDB `.find()` without `.limit()` |
| `sql-select-star-no-limit` | critical | SQL `SELECT` without `LIMIT` clause |

### Concurrency Bombs (3 rules)

| Rule ID | Severity | What it detects |
|---------|----------|----------------|
| `sequential-await-in-loop` | high | `await` inside `for`/`while` loop — serializes all ops |
| `shared-async-mutation` | high | Shared state mutation after `await` — race condition |
| `settimeout-zero-as-sync` | medium | `setTimeout(fn, 0)` as synchronization primitive |

---

## Why TimeBomb?

These bugs share a profile: **they're correct today and catastrophic tomorrow**. They pass code review because the code is logically sound. They pass tests because test datasets are small and controlled. They appear in production when data grows, time passes, or load increases.

TimeBomb is the productized memory of every "we lost a weekend to this" post-mortem in the JavaScript ecosystem.

---

## License

MIT

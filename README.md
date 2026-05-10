# TimeBomb

> A junior engineer ships a 30-day reminder feature on a Friday afternoon.
>
> ```js
> setTimeout(sendReminder, 30 * 24 * 60 * 60 * 1000);
> ```
>
> Two approvals on the PR. Tests pass. Deploy goes clean.
>
> Saturday, 5:41 AM. The on-call engineer's phone won't stop. By the time she opens her laptop, every user who signed up that week has received their 30-day reminder. All of them. In the same minute.
>
> 47,000 emails. 90 seconds. One angry CEO already typing.
>
> The number she'll never forget: **2,147,483,647** — the largest signed 32-bit integer. Anything above it overflows. `setTimeout` doesn't warn. It just fires immediately.
>
> The PR is still in the review history. Nobody saw it. Nobody could have.

**TimeBomb catches this in CI — before it ships.**

![TimeBomb demo](docs/demo.gif)

```bash
npx timebomb-scanner
```

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
uses: rahulbhardwaj94/timebomb@v1
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
      - uses: rahulbhardwaj94/timebomb@v1
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

| Rule ID | Severity | The failure that taught us this rule |
|---------|----------|--------------------------------------|
| `settimeout-int32-overflow` | critical | setTimeout delay > 24.8 days → fires immediately |
| `setinterval-int32-overflow` | critical | setInterval period > 24.8 days → fires at 1ms rate |
| `hardcoded-year-comparison` | high | `year < 2025` — silently wrong after 2025 |
| `naive-date-arithmetic` | high | Adding 86400000ms to timestamp, ignores DST |
| `date-parse-ambiguous` | medium | `Date.parse("01/02/2024")` — locale-dependent |
| `y2038-timestamp` | high | `timestamp \| 0` truncates to 32-bit → breaks in 2038 |

### Scale Bombs (7 rules)

| Rule ID | Severity | The failure that taught us this rule |
|---------|----------|--------------------------------------|
| `unbounded-sort` | high | `.sort()` on database-fetched arrays without size guard |
| `unbounded-reverse` | medium | `.reverse()` on potentially unbounded arrays |
| `unbounded-recursion` | high | Recursive functions without depth limits |
| `unbounded-json-stringify` | high | `JSON.stringify(req.body)` — OOM on large payloads |
| `unbounded-promise-all` | critical | `Promise.all(ids.map(...))` without concurrency limit |
| `mongo-no-limit` | critical | MongoDB `.find()` without `.limit()` |
| `sql-select-star-no-limit` | critical | SQL `SELECT` without `LIMIT` clause |

### Concurrency Bombs (3 rules)

| Rule ID | Severity | The failure that taught us this rule |
|---------|----------|--------------------------------------|
| `sequential-await-in-loop` | high | `await` inside `for`/`while` loop — serializes all ops |
| `shared-async-mutation` | high | Shared state mutation after `await` — race condition |
| `settimeout-zero-as-sync` | medium | `setTimeout(fn, 0)` as synchronization primitive |

---

## Origin Stories

Every TimeBomb rule comes from a real failure mode that engineers have lost weekends to. Three categories, three archetypes.

### The Time Bomb

A junior engineer ships a 30-day reminder. `setTimeout(sendReminder, 30 * 24 * 60 * 60 * 1000)`. Two approvals. Tests pass. Saturday morning, 47,000 reminders fire in 90 seconds — because anything above 2,147,483,647 milliseconds overflows int32 and fires immediately. The PR is still in the review history. Nobody saw it. Nobody could have.

This is what every Time Bomb rule has in common: code that is **correct today and catastrophic tomorrow**, where "tomorrow" is a specific date, year, or duration the author didn't think to check.

### The Scale Bomb

A dashboard works beautifully in the demo. Forty users, sub-second loads. `await Promise.all(userIds.map(fetchUserDetails))` — clean, idiomatic, reviewed. Six months later, an enterprise customer onboards 50,000 users in an afternoon. The Node process spawns 50,000 concurrent fetches. Memory climbs. The container hits its limit. Kubernetes restarts it. The next request comes in. Same thing. The customer churned the following week.

Every Scale Bomb rule shares this profile: code that is **correct at one order of magnitude and fatal at the next**. It was always going to do this. Nobody knew when.

### The Concurrency Bomb

A migration script needs to email 10,000 customers. `for (const user of users) { await sendEmail(user); }` — readable, sequential, safe. In staging it ran 50 test users in 5 seconds. In production, sendEmail averaged 100ms. 10,000 × 100ms = sixteen minutes of a single-threaded process doing one thing. The health check failed at minute three. The load balancer pulled the pod. The retry mechanism started over. Three times. 30,000 emails sent. Same customers. The unsubscribe link got more clicks that day than the product had in a quarter.

Concurrency Bombs are the ones where **the shape of the code hides the cost of the operation**. The loop looks innocent. The `await` looks defensive. Together, at scale, they're a self-DDoS.

---

## Why TimeBomb?

These bugs share a profile: **they're correct today and catastrophic tomorrow**. They pass code review because the code is logically sound. They pass tests because test datasets are small and controlled. They appear in production when data grows, time passes, or load increases.

TimeBomb is the productized memory of every "we lost a weekend to this" post-mortem in the JavaScript ecosystem.

---

## License

MIT

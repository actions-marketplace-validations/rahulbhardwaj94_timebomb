# timebomb-action

GitHub Action for [TimeBomb](https://github.com/timebomb-dev/timebomb) — runs static analysis on every pull request and posts findings as a PR comment.

## Usage

```yaml
# .github/workflows/timebomb.yml
name: TimeBomb
on: [pull_request]

jobs:
  timebomb:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: timebomb-dev/timebomb-action@v1
        with:
          fail-on: critical          # critical | high | medium | none
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `fail-on` | `critical` | Minimum severity that fails the workflow |
| `github-token` | `${{ github.token }}` | Token for posting PR comments |
| `paths` | `**/*.ts,**/*.tsx,**/*.js,**/*.jsx` | Glob patterns to analyze |

## Outputs

| Output | Description |
|--------|-------------|
| `findings-count` | Total findings |
| `critical-count` | Critical severity count |
| `high-count` | High severity count |
| `medium-count` | Medium severity count |

The action posts a single PR comment and updates it on subsequent pushes — no comment spam.

## License

MIT

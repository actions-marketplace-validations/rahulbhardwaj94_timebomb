# timebomb-scanner

CLI for [TimeBomb](https://github.com/timebomb-dev/timebomb) — detect code that passes review and tests but is guaranteed to break in production.

## Quick start

```bash
# No install required
npx timebomb-scanner

# Install globally
npm install -g timebomb-scanner
```

## Usage

```bash
timebomb-scanner                        # Scan all TS/JS files
timebomb-scanner src/ lib/              # Scan specific paths
timebomb-scanner --changed              # Only files changed in git diff
timebomb-scanner --format json          # JSON output
timebomb-scanner --format github        # GitHub Actions annotations
timebomb-scanner explain <rule-id>      # Show rule detail + incident reference
timebomb-scanner rules                  # List all rules
```

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | No issues |
| `1` | High/medium findings |
| `2` | Critical findings |

## License

MIT

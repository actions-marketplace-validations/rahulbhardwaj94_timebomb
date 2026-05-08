# timebomb-core

Rule engine and AST traversal library for [TimeBomb](https://github.com/timebomb-dev/timebomb).

Contains all 16 detection rules (6 time-bombs, 7 scale-bombs, 3 concurrency-bombs) built on [ts-morph](https://ts-morph.com).

## Usage

```typescript
import { ALL_RULES, analyzeFile } from 'timebomb-core';

const findings = analyzeFile('src/index.ts', ALL_RULES);
```

This package is the engine used by [`timebomb-scanner`](https://www.npmjs.com/package/timebomb-scanner) (CLI) and [`timebomb-action`](https://www.npmjs.com/package/timebomb-action) (GitHub Action). Use those packages directly unless you are building a custom integration.

## License

MIT

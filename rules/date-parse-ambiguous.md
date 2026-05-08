# date-parse-ambiguous

**Category:** time-bomb  
**Severity:** medium  
**Auto-fix available:** false

## Summary

`Date.parse()` behavior on non-ISO 8601 strings is implementation-defined. The same string can be parsed differently by V8, SpiderMonkey, and JavaScriptCore, and can return `NaN` on some locales or runtime versions.

## Real-World Incident

A date-gating feature used `Date.parse("02/28/2023")` to check whether a feature had launched. It parsed correctly on the US-locale CI runner but returned `NaN` on European production servers with `en-GB` locale, causing the feature to appear enabled for all users at all times. Detected only after user complaints about seeing a feature that shouldn't be visible.

## Bad Code

```typescript
// ❌ "01/02/2024" could be Jan 2 or Feb 1 depending on locale
const d = Date.parse("01/02/2024");

// ❌ Locale/implementation-dependent
if (Date.parse("Feb 28, 2024") > Date.now()) { ... }
```

## Good Code

```typescript
// ✅ ISO 8601 is unambiguous and universally supported
const d = Date.parse("2024-01-02T00:00:00Z");

// ✅ Or use a date library with explicit format
import { parse } from 'date-fns';
const d = parse("01/02/2024", "MM/dd/yyyy", new Date());
```

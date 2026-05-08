# y2038-timestamp

**Category:** time-bomb  
**Severity:** high  
**Auto-fix available:** false

## Summary

Unix timestamps stored as 32-bit signed integers overflow on 2038-01-19 03:14:07 UTC. Using bitwise operations like `| 0` or `>>> 0` to truncate timestamps to 32 bits creates a Y2038 vulnerability.

## Real-World Incident

MySQL `TIMESTAMP` columns using 32-bit signed integers cannot represent dates after 2038. Already causing issues in financial systems storing "expiry in 30 years." PostgreSQL fixed this in 2004 (switched to 64-bit); MySQL fixed it in 8.0.28 — but only for newly created columns, not existing ones. Systems with `timestamp | 0` in JavaScript face the same issue as they approach 2038.

## Bad Code

```typescript
// ❌ Truncates to 32-bit — wrong after 2038-01-19
const ts32 = Date.now() / 1000 | 0;

// ❌ Same issue with unsigned right shift
const ts = timestamp >>> 0;

// ❌ Using Y2038 limit as a bound
const MAX_TIMESTAMP = 2147483647;
```

## Good Code

```typescript
// ✅ Keep timestamps as 64-bit floats (JavaScript's default)
const ts = Math.floor(Date.now() / 1000); // Seconds since epoch, no truncation

// ✅ For database storage, use BIGINT or DATETIME columns, not TIMESTAMP
// MySQL: `created_at DATETIME(3)` instead of `created_at TIMESTAMP`
```

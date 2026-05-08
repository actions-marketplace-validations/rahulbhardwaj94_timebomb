# setinterval-int32-overflow

**Category:** time-bomb  
**Severity:** critical  
**Auto-fix available:** false

## Summary

`setInterval` periods exceeding 2,147,483,647ms (24.8 days) overflow the 32-bit signed integer used internally. The interval fires at maximum speed (~1ms) instead of the intended long period, potentially saturating CPU.

## Real-World Incident

Background job systems using `setInterval(syncFn, 7 * 24 * 60 * 60 * 1000)` for weekly syncs overflow int32 and fire every millisecond instead. This caused CPU spikes that brought down a Node.js service. The bug was invisible in development (the service was restarted frequently, masking the behavior).

## Bad Code

```typescript
// Weekly sync: 7 * 24 * 60 * 60 * 1000 = 604,800,000ms — safe (within int32)
// Monthly sync: 30 * 24 * 60 * 60 * 1000 = 2,592,000,000ms — OVERFLOWS ❌
setInterval(syncDatabase, 30 * 24 * 60 * 60 * 1000);
```

## Good Code

```typescript
// Use a cron scheduler for long-period intervals
import cron from 'node-cron';
cron.schedule('0 0 1 * *', syncDatabase); // Monthly on 1st at midnight
```

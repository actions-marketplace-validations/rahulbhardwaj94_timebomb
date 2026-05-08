# settimeout-int32-overflow

**Category:** time-bomb  
**Severity:** critical  
**Auto-fix available:** false

## Summary

`setTimeout` delays exceeding 2,147,483,647ms (24.8 days) overflow the 32-bit signed integer used internally by JavaScript runtimes. The timer fires immediately instead of after the intended delay.

## Real-World Incident

Common production failure: session timeouts set to "30 days" via `30 * 24 * 60 * 60 * 1000 = 2,592,000,000ms`. This value overflows `int32`, and sessions expire instantly the moment they are created. Users are immediately logged out. Reported in multiple Node.js apps using express-session with custom remember-me logic.

## Bad Code

```typescript
// 30 days = 2,592,000,000ms — overflows int32 (max 2,147,483,647ms)
setTimeout(() => {
  expireSession(userId);
}, 30 * 24 * 60 * 60 * 1000); // ❌ Fires immediately
```

## Good Code

```typescript
// Option 1: Use a job scheduler for long delays
import cron from 'node-cron';
cron.schedule('0 0 * * *', () => expireSession(userId)); // Daily check

// Option 2: Schedule the far-future expiry in the database and poll
await db.sessions.update({ userId }, { expiresAt: addDays(new Date(), 30) });
```

## References

- [Node.js timers documentation](https://nodejs.org/api/timers.html)
- [WHATWG HTML spec: timer clamping](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-settimeout)

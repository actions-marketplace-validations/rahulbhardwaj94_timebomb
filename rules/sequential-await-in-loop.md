# sequential-await-in-loop

**Category:** concurrency-bomb  
**Severity:** high  
**Auto-fix available:** false

## Summary

Using `await` inside a `for`/`while` loop serializes all async operations. With 10 items this is slow but tolerable. With 1,000 items, latency multiplies by 1,000×.

## Real-World Incident

A bulk notification service iterated over subscribers with `await sendEmail(sub)` inside a `for` loop. In testing with 50 subscribers it sent emails in ~5 seconds. With 10,000 production subscribers at ~100ms per email, it took 1,000 seconds (16+ minutes) and held the server process, blocking all other requests. The fix was `Promise.all` with `p-limit(50)`.

## Bad Code

```typescript
// ❌ Sequential: 10,000 users × 100ms = 1,000 seconds
async function sendNotifications(users: User[]) {
  for (const user of users) {
    await sendEmail(user.email); // Blocks until each email is sent
  }
}
```

## Good Code

```typescript
import pLimit from 'p-limit';

// ✅ Concurrent with rate limiting
async function sendNotifications(users: User[]) {
  const limit = pLimit(50); // Max 50 concurrent emails
  await Promise.all(users.map(user => limit(() => sendEmail(user.email))));
}
```

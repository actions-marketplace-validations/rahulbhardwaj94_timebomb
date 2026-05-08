# shared-async-mutation

**Category:** concurrency-bomb  
**Severity:** high  
**Auto-fix available:** false

## Summary

Mutating shared state (object properties, module-level variables) after an `await` creates a race condition: two concurrent invocations can interleave their reads and writes, silently corrupting state.

## Real-World Incident

A request counter stored in module scope was incremented after `await db.query()`. Under concurrent requests, two handlers read the same counter value, both incremented it, and wrote it back — effectively losing one increment per race. Caused billing undercounting by ~15% under peak load. Detected only during a load test, weeks after the bug was introduced.

## Bad Code

```typescript
// ❌ Race condition: two concurrent calls interleave here
let requestCount = 0;

async function handleRequest(req) {
  const data = await db.query('SELECT * FROM requests');
  requestCount = data.total + 1; // Two callers can read same `data.total`
  await db.update('SET total = ?', requestCount);
}
```

## Good Code

```typescript
import { Mutex } from 'async-mutex';

const mutex = new Mutex();

async function handleRequest(req) {
  await mutex.runExclusive(async () => {
    const data = await db.query('SELECT * FROM requests');
    const newCount = data.total + 1;
    await db.update('SET total = ?', newCount);
  });
}

// Better: use atomic database operations
async function handleRequest(req) {
  await db.query('UPDATE stats SET total = total + 1');
}
```

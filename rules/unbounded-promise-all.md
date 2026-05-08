# unbounded-promise-all

**Category:** scale-bomb  
**Severity:** critical  
**Auto-fix available:** false

## Summary

`Promise.all()` spawns all promises simultaneously. On arrays without size limits, this creates N parallel requests/operations, exhausting connection pools, hitting rate limits, and blowing heap memory.

## Real-World Incident

A data export endpoint fetched all user IDs (~50,000) and ran `Promise.all(ids.map(id => fetchUserData(id)))`. In staging with 100 users it was fast. In production it opened 50,000 simultaneous HTTP connections, triggered rate limiting on the downstream service, and crashed the exporter. The fix was using `p-limit` with a concurrency of 10.

## Bad Code

```typescript
// ❌ 50,000 simultaneous requests
const userIds = await db.query('SELECT id FROM users');
const users = await Promise.all(userIds.map(id => fetchUserData(id)));
```

## Good Code

```typescript
import pLimit from 'p-limit';

const limit = pLimit(10); // Max 10 concurrent

const userIds = await db.query('SELECT id FROM users');
const users = await Promise.all(
  userIds.map(id => limit(() => fetchUserData(id)))
);
```

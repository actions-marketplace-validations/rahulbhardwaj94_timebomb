# settimeout-zero-as-sync

**Category:** concurrency-bomb  
**Severity:** medium  
**Auto-fix available:** false

## Summary

`setTimeout(fn, 0)` used as a synchronization primitive does not guarantee execution order relative to Promises or other macrotasks. The ordering has changed between Node.js versions.

## Real-World Incident

Code used `setTimeout(resolve, 0)` to "ensure" a database write completed before a subsequent read in a different code path. Under Node.js 14 this worked due to accidental event loop scheduling. Upgrading to Node.js 18 changed microtask/macrotask ordering and the read consistently ran before the write. Caused silent data corruption on ~0.1% of requests for weeks before detection.

## Bad Code

```typescript
// ❌ Ordering not guaranteed — broke on Node.js 18 upgrade
function writeAndRead(data) {
  db.write(data);
  setTimeout(() => {
    resolve(db.read()); // "Waits" for write? Not reliably.
  }, 0);
}
```

## Good Code

```typescript
// ✅ Explicit async/await — ordering is guaranteed
async function writeAndRead(data) {
  await db.write(data);
  return db.read();
}

// ✅ For microtask-level deferral
queueMicrotask(() => {
  resolve(result);
});
```

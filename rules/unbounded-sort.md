# unbounded-sort

**Category:** scale-bomb  
**Severity:** high  
**Auto-fix available:** false

## Summary

`.sort()` on arrays fetched from a database or API without a size limit causes O(n log n) CPU and memory usage that scales with data growth, silently degrading until it triggers OOM or latency timeouts.

## Real-World Incident

A fintech dashboard fetched all transactions for a user and sorted them client-side. The endpoint worked sub-second during testing with 100 records. One whale user had 800,000 transactions. The sort took 45 seconds, allocated gigabytes of heap, and OOM-killed the Node.js process. Adding `.limit(1000)` to the query immediately fixed the issue.

## Bad Code

```typescript
// ❌ Works for 100 records, OOM at 800,000
const transactions = await Transaction.find({ userId });
transactions.sort((a, b) => b.createdAt - a.createdAt);
```

## Good Code

```typescript
// ✅ Sort at the database level — O(1) additional memory
const transactions = await Transaction.find({ userId })
  .sort({ createdAt: -1 })
  .limit(1000);

// ✅ Or guard with explicit size check
if (transactions.length > 10_000) {
  throw new Error('Too many records to sort in-process. Use database-level sorting.');
}
```

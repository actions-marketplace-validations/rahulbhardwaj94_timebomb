# mongo-no-limit

**Category:** scale-bomb  
**Severity:** critical  
**Auto-fix available:** false

## Summary

A MongoDB `.find()` without `.limit()` returns all matching documents. Safe with seeded dev data, catastrophic as production collections grow to millions of documents.

## Real-World Incident

A MongoDB collection started at ~1,000 documents. A nightly analytics job ran `.find({ status: "processed" })` without a limit. After 18 months the collection had 40 million documents. The job fetched all 40M documents into memory each night, triggering OOM kills. The collection scan also caused production read latency spikes that affected live users.

## Bad Code

```typescript
// ❌ Returns ALL documents as the collection grows
const processedOrders = await Order.find({ status: 'processed' });

// ❌ Even with a filter, this can return millions of documents
const userEvents = await Event.find({ userId: req.params.userId });
```

## Good Code

```typescript
// ✅ Always limit query results
const processedOrders = await Order.find({ status: 'processed' }).limit(1000);

// ✅ For large datasets, use cursor-based pagination
const cursor = Order.find({ status: 'processed' }).cursor();
for await (const order of cursor) {
  await processOrder(order);
}
```

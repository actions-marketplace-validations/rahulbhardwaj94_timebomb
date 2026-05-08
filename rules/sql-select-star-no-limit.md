# sql-select-star-no-limit

**Category:** scale-bomb  
**Severity:** critical  
**Auto-fix available:** false

## Summary

A SQL `SELECT` without a `LIMIT` clause returns all rows matching the `WHERE` clause. Safe in development with seeded test data, catastrophic in production tables with millions of rows.

## Real-World Incident

A SaaS analytics query ran `SELECT * FROM events WHERE user_id = ?` without `LIMIT`. Fast for 99% of users. One enterprise customer had 15 million events. The query returned all 15M rows over the network, used 4GB of heap, and OOM-killed the API server. Reported as "random crashes" for 2 weeks before the root cause was found via query analysis.

## Bad Code

```typescript
// ❌ No LIMIT — returns all rows
const query = "SELECT * FROM events WHERE user_id = ?";
const events = await db.query(query, [userId]);

// ❌ Even with a specific column list
const sql = "SELECT id, type, data FROM events WHERE user_id = ?";
```

## Good Code

```typescript
// ✅ Always limit results
const query = "SELECT * FROM events WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000";

// ✅ For full data access, use pagination
async function* paginateEvents(userId: string) {
  let cursor: string | null = null;
  while (true) {
    const rows = await db.query(
      "SELECT * FROM events WHERE user_id = ? AND id > ? ORDER BY id LIMIT 100",
      [userId, cursor ?? '0']
    );
    if (rows.length === 0) break;
    yield rows;
    cursor = rows[rows.length - 1].id;
  }
}
```

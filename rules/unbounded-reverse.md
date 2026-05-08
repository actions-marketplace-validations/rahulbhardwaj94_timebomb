# unbounded-reverse

**Category:** scale-bomb  
**Severity:** medium  
**Auto-fix available:** false

## Summary

`.reverse()` on an array sourced from a database or API mutates in-place and is O(n). On unbounded datasets this silently degrades until it blocks the event loop.

## Real-World Incident

A social feed fetched all posts for a user and reversed them to show newest-first. Worked fine for users with fewer than 1,000 posts. A viral account with 500,000 posts caused the reverse to take seconds and block the event loop for all concurrent requests. Fixed by adding `ORDER BY created_at DESC` at the database level.

## Bad Code

```typescript
// ❌ O(n) in-memory reverse on potentially unbounded data
const posts = await Post.findAll({ where: { userId } });
posts.reverse(); // Shows newest first
```

## Good Code

```typescript
// ✅ Reverse at the database level — zero extra memory
const posts = await Post.findAll({
  where: { userId },
  order: [['createdAt', 'DESC']],
  limit: 100,
});
```

# unbounded-json-stringify

**Category:** scale-bomb  
**Severity:** high  
**Auto-fix available:** false

## Summary

`JSON.stringify()` throws `TypeError` on circular references and produces enormous strings on large objects, exhausting heap memory. Both failure modes are invisible with small test objects.

## Real-World Incident

A logging middleware called `JSON.stringify(req.body)` to capture request payloads. A client uploaded a 50MB JSON payload. The stringify doubled memory usage and crashed the Node.js process. A separate incident involved circular references in an ORM's model instances (due to bidirectional relationships) crashing a health-check endpoint that tried to serialize a model object.

## Bad Code

```typescript
// ❌ Throws on circular refs, OOM on large payloads
app.use((req, res, next) => {
  logger.info({ body: JSON.stringify(req.body) });
  next();
});

// ❌ ORM models often have circular references
const serialized = JSON.stringify(userModel);
```

## Good Code

```typescript
import safeStringify from 'fast-safe-stringify';

// ✅ Safe: handles circular refs, truncates at size limit
app.use((req, res, next) => {
  const body = safeStringify(req.body, null, null, { depthLimit: 5, edgesLimit: 100 });
  logger.info({ body: body.slice(0, 10_000) }); // Cap at 10KB
  next();
});
```

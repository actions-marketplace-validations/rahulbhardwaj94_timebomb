# unbounded-recursion

**Category:** scale-bomb  
**Severity:** high  
**Auto-fix available:** false

## Summary

Recursive functions without explicit depth limits throw "Maximum call stack size exceeded" when input depth exceeds V8's call stack limit (~10,000 frames). Works on test data, crashes on deep real-world inputs.

## Real-World Incident

A permissions system recursively resolved role hierarchies. In development, roles were 3 levels deep. A customer with 12,000+ nested role assignments caused a stack overflow that crashed the authentication service. The fix was adding a depth parameter with a maximum of 100.

## Bad Code

```typescript
// ❌ No depth limit — stack overflow on deep trees
function resolvePermissions(role: Role): Permission[] {
  if (!role.parent) return role.permissions;
  return [...role.permissions, ...resolvePermissions(role.parent)];
}
```

## Good Code

```typescript
// ✅ Depth-limited recursion
const MAX_ROLE_DEPTH = 100;

function resolvePermissions(role: Role, depth = 0): Permission[] {
  if (depth > MAX_ROLE_DEPTH) {
    throw new Error(`Role hierarchy exceeds maximum depth of ${MAX_ROLE_DEPTH}`);
  }
  if (!role.parent) return role.permissions;
  return [...role.permissions, ...resolvePermissions(role.parent, depth + 1)];
}
```

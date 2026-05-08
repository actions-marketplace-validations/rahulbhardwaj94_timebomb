# hardcoded-year-comparison

**Category:** time-bomb  
**Severity:** high  
**Auto-fix available:** false

## Summary

Comparisons against hardcoded years (e.g., `year < 2025`) are correct today but silently evaluate incorrectly once the year passes. This breaks authorization checks, feature flags, billing logic, and legacy data handling.

## Real-World Incident

A SaaS app had `if (signupYear < 2023) { applyLegacyPricing() }`. In 2024, all new signups were charged at the new pricing even during an active grandfathering campaign — the code silently stopped applying the discount. The bug was detected 3 weeks later via a revenue anomaly report, not code review.

## Bad Code

```typescript
const year = new Date().getFullYear();

// ❌ Works in 2024, silently broken in 2025
if (year < 2025) {
  applyLegacyPricing(user);
}

// ❌ Activates in 2024, never deactivates
if (year === 2024) {
  enableBetaFeature();
}
```

## Good Code

```typescript
// Option 1: Use a named constant in config
const LEGACY_PRICING_CUTOFF = new Date('2025-01-01');
if (new Date(user.signupDate) < LEGACY_PRICING_CUTOFF) {
  applyLegacyPricing(user);
}

// Option 2: Store the cutoff in the database
if (user.signupDate < config.legacyPricingCutoff) {
  applyLegacyPricing(user);
}
```

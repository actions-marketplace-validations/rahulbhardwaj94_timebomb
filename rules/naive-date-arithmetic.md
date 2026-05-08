# naive-date-arithmetic

**Category:** time-bomb  
**Severity:** high  
**Auto-fix available:** false

## Summary

Adding exactly 86,400,000ms (24 hours) to a timestamp to compute "tomorrow" or "next day" breaks during Daylight Saving Time transitions: spring-forward days are 23 hours, fall-back days are 25 hours.

## Real-World Incident

A subscription billing system added `86400000 * 30` to compute monthly renewal dates. During DST transitions, renewals were sent one day early or late, triggering double-charges and missed-charge complaints. The pattern correlated with DST boundaries took 6 months to identify because it only affected users in DST-observing timezones.

## Bad Code

```typescript
// ❌ Breaks on DST transition days
const tomorrow = Date.now() + 86400000;
const nextWeek = new Date(user.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000;
```

## Good Code

```typescript
import { addDays, addMonths } from 'date-fns';

// ✅ Calendar-aware: handles DST, leap years, month-length variations
const tomorrow = addDays(new Date(), 1);
const nextMonth = addMonths(new Date(user.createdAt), 1);
```

## References

- [date-fns addDays](https://date-fns.org/v3/docs/addDays)
- [Temporal proposal (future standard)](https://tc39.es/proposal-temporal/docs/)

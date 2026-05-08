import { Rule } from '../types';

// Time bombs
import { settimeoutInt32Overflow } from './time-bombs/settimeout-int32-overflow';
import { setintervalInt32Overflow } from './time-bombs/setinterval-int32-overflow';
import { hardcodedYearComparison } from './time-bombs/hardcoded-year-comparison';
import { naiveDateArithmetic } from './time-bombs/naive-date-arithmetic';
import { dateParsAmbiguous } from './time-bombs/date-parse-ambiguous';
import { y2038Timestamp } from './time-bombs/y2038-timestamp';

// Scale bombs
import { unboundedSort } from './scale-bombs/unbounded-sort';
import { unboundedReverse } from './scale-bombs/unbounded-reverse';
import { unboundedRecursion } from './scale-bombs/unbounded-recursion';
import { unboundedJsonStringify } from './scale-bombs/unbounded-json-stringify';
import { unboundedPromiseAll } from './scale-bombs/unbounded-promise-all';
import { mongoNoLimit } from './scale-bombs/mongo-no-limit';
import { sqlSelectStarNoLimit } from './scale-bombs/sql-select-star-no-limit';

// Concurrency bombs
import { sequentialAwaitInLoop } from './concurrency-bombs/sequential-await-in-loop';
import { sharedAsyncMutation } from './concurrency-bombs/shared-async-mutation';
import { settimeoutZeroAsSync } from './concurrency-bombs/settimeout-zero-as-sync';

export const ALL_RULES: Rule[] = [
  // Time bombs
  settimeoutInt32Overflow,
  setintervalInt32Overflow,
  hardcodedYearComparison,
  naiveDateArithmetic,
  dateParsAmbiguous,
  y2038Timestamp,

  // Scale bombs
  unboundedSort,
  unboundedReverse,
  unboundedRecursion,
  unboundedJsonStringify,
  unboundedPromiseAll,
  mongoNoLimit,
  sqlSelectStarNoLimit,

  // Concurrency bombs
  sequentialAwaitInLoop,
  sharedAsyncMutation,
  settimeoutZeroAsSync,
];

export function getRuleById(id: string): Rule | undefined {
  return ALL_RULES.find((r) => r.id === id);
}

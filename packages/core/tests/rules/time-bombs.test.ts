import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Project } from 'ts-morph';
import { settimeoutInt32Overflow } from '../../src/rules/time-bombs/settimeout-int32-overflow';
import { setintervalInt32Overflow } from '../../src/rules/time-bombs/setinterval-int32-overflow';
import { hardcodedYearComparison } from '../../src/rules/time-bombs/hardcoded-year-comparison';
import { naiveDateArithmetic } from '../../src/rules/time-bombs/naive-date-arithmetic';
import { dateParsAmbiguous } from '../../src/rules/time-bombs/date-parse-ambiguous';
import { y2038Timestamp } from '../../src/rules/time-bombs/y2038-timestamp';

function makeSourceFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } });
  return project.createSourceFile('test.ts', code);
}

describe('settimeout-int32-overflow', () => {
  it('flags setTimeout with delay exceeding int32 max', () => {
    const src = makeSourceFile(`
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      setTimeout(doWork, 30 * 24 * 60 * 60 * 1000);
    `);
    const findings = settimeoutInt32Overflow.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'settimeout-int32-overflow');
    assert.equal(findings[0].severity, 'critical');
  });

  it('flags literal delay exceeding int32 max', () => {
    const src = makeSourceFile(`setTimeout(fn, 2592000000);`);
    const findings = settimeoutInt32Overflow.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag delays within int32 range', () => {
    const src = makeSourceFile(`setTimeout(fn, 86400000);`);
    const findings = settimeoutInt32Overflow.check(src);
    assert.equal(findings.length, 0);
  });

  it('does not flag setTimeout with no numeric delay', () => {
    const src = makeSourceFile(`setTimeout(fn, delay);`);
    const findings = settimeoutInt32Overflow.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('setinterval-int32-overflow', () => {
  it('flags setInterval with period exceeding int32 max', () => {
    const src = makeSourceFile(`setInterval(sync, 30 * 24 * 60 * 60 * 1000);`);
    const findings = setintervalInt32Overflow.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'setinterval-int32-overflow');
  });

  it('does not flag safe periods', () => {
    const src = makeSourceFile(`setInterval(fn, 60000);`);
    const findings = setintervalInt32Overflow.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('hardcoded-year-comparison', () => {
  it('flags year < hardcoded year', () => {
    const src = makeSourceFile(`
      const year = new Date().getFullYear();
      if (year < 2025) { applyLegacyPricing(); }
    `);
    const findings = hardcodedYearComparison.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'hardcoded-year-comparison');
  });

  it('flags year === hardcoded year', () => {
    const src = makeSourceFile(`
      if (new Date().getFullYear() === 2024) { runPromo(); }
    `);
    const findings = hardcodedYearComparison.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag comparisons without getFullYear', () => {
    const src = makeSourceFile(`if (count < 2025) { doSomething(); }`);
    const findings = hardcodedYearComparison.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('naive-date-arithmetic', () => {
  it('flags adding 86400000ms to Date.now()', () => {
    const src = makeSourceFile(`const tomorrow = Date.now() + 86400000;`);
    const findings = naiveDateArithmetic.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'naive-date-arithmetic');
  });

  it('flags adding 24*60*60*1000 to timestamp', () => {
    const src = makeSourceFile(`const next = timestamp.getTime() + 24 * 60 * 60 * 1000;`);
    const findings = naiveDateArithmetic.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag arithmetic on non-date values', () => {
    const src = makeSourceFile(`const x = count + 86400000;`);
    const findings = naiveDateArithmetic.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('date-parse-ambiguous', () => {
  it('flags Date.parse with MM/DD/YYYY format', () => {
    const src = makeSourceFile(`const d = Date.parse("01/02/2024");`);
    const findings = dateParsAmbiguous.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'date-parse-ambiguous');
  });

  it('does not flag Date.parse with ISO 8601 format', () => {
    const src = makeSourceFile(`const d = Date.parse("2024-01-02");`);
    const findings = dateParsAmbiguous.check(src);
    assert.equal(findings.length, 0);
  });

  it('does not flag Date.parse with dynamic argument', () => {
    const src = makeSourceFile(`const d = Date.parse(userInput);`);
    const findings = dateParsAmbiguous.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('y2038-timestamp', () => {
  it('flags bitwise OR 0 on timestamp variable', () => {
    const src = makeSourceFile(`const truncated = timestamp | 0;`);
    const findings = y2038Timestamp.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'y2038-timestamp');
  });

  it('flags >>> 0 on Date.now()', () => {
    const src = makeSourceFile(`const t = Date.now() >>> 0;`);
    const findings = y2038Timestamp.check(src);
    assert.equal(findings.length, 1);
  });

  it('flags Y2038 magic number literal', () => {
    const src = makeSourceFile(`const MAX_TS = 2147483647;`);
    const findings = y2038Timestamp.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag normal arithmetic', () => {
    const src = makeSourceFile(`const x = value + 1000;`);
    const findings = y2038Timestamp.check(src);
    assert.equal(findings.length, 0);
  });
});

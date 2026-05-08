import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Project } from 'ts-morph';
import { sequentialAwaitInLoop } from '../../src/rules/concurrency-bombs/sequential-await-in-loop';
import { sharedAsyncMutation } from '../../src/rules/concurrency-bombs/shared-async-mutation';
import { settimeoutZeroAsSync } from '../../src/rules/concurrency-bombs/settimeout-zero-as-sync';

function makeSourceFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } });
  return project.createSourceFile('test.ts', code);
}

describe('sequential-await-in-loop', () => {
  it('flags await inside a for..of loop', () => {
    const src = makeSourceFile(`
      async function sendNotifications(users) {
        for (const user of users) {
          await sendEmail(user.email);
        }
      }
    `);
    const findings = sequentialAwaitInLoop.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'sequential-await-in-loop');
  });

  it('flags await inside a for loop', () => {
    const src = makeSourceFile(`
      async function process(items) {
        for (let i = 0; i < items.length; i++) {
          await processItem(items[i]);
        }
      }
    `);
    const findings = sequentialAwaitInLoop.check(src);
    assert.equal(findings.length, 1);
  });

  it('flags await inside a while loop', () => {
    const src = makeSourceFile(`
      async function poll() {
        while (!done) {
          await checkStatus();
        }
      }
    `);
    const findings = sequentialAwaitInLoop.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag Promise.all (no await in loop)', () => {
    const src = makeSourceFile(`
      async function sendAll(users) {
        await Promise.all(users.map(u => sendEmail(u.email)));
      }
    `);
    const findings = sequentialAwaitInLoop.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('shared-async-mutation', () => {
  it('flags mutation of object property after await', () => {
    const src = makeSourceFile(`
      async function updateCounter() {
        const data = await db.query('SELECT count FROM stats');
        this.stats.count = data.count + 1;
      }
    `);
    const findings = sharedAsyncMutation.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'shared-async-mutation');
  });

  it('flags += mutation after await', () => {
    const src = makeSourceFile(`
      async function increment() {
        await db.save();
        cache.hits += 1;
      }
    `);
    const findings = sharedAsyncMutation.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag local variable assignment after await', () => {
    const src = makeSourceFile(`
      async function getUser(id) {
        const raw = await db.find(id);
        const user = raw.toObject();
        return user;
      }
    `);
    const findings = sharedAsyncMutation.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('settimeout-zero-as-sync', () => {
  it('flags setTimeout(resolve, 0)', () => {
    const src = makeSourceFile(`
      new Promise((resolve) => {
        doWork();
        setTimeout(resolve, 0);
      });
    `);
    const findings = settimeoutZeroAsSync.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'settimeout-zero-as-sync');
  });

  it('flags setTimeout(callback, 0)', () => {
    const src = makeSourceFile(`setTimeout(callback, 0);`);
    const findings = settimeoutZeroAsSync.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag setTimeout with non-zero delay', () => {
    const src = makeSourceFile(`setTimeout(fn, 5000);`);
    const findings = settimeoutZeroAsSync.check(src);
    assert.equal(findings.length, 0);
  });

  it('does not flag setTimeout(fn, 0) with non-sync-looking callback', () => {
    const src = makeSourceFile(`setTimeout(() => { console.log('hello'); }, 0);`);
    const findings = settimeoutZeroAsSync.check(src);
    assert.equal(findings.length, 0);
  });
});

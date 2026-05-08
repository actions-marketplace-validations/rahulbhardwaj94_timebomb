import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Project } from 'ts-morph';
import { unboundedSort } from '../../src/rules/scale-bombs/unbounded-sort';
import { unboundedReverse } from '../../src/rules/scale-bombs/unbounded-reverse';
import { unboundedRecursion } from '../../src/rules/scale-bombs/unbounded-recursion';
import { unboundedJsonStringify } from '../../src/rules/scale-bombs/unbounded-json-stringify';
import { unboundedPromiseAll } from '../../src/rules/scale-bombs/unbounded-promise-all';
import { mongoNoLimit } from '../../src/rules/scale-bombs/mongo-no-limit';
import { sqlSelectStarNoLimit } from '../../src/rules/scale-bombs/sql-select-star-no-limit';

function makeSourceFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } });
  return project.createSourceFile('test.ts', code);
}

describe('unbounded-sort', () => {
  it('flags .sort() after a fetch call', () => {
    const src = makeSourceFile(`
      const users = await fetchAllUsers();
      users.sort((a, b) => a.name.localeCompare(b.name));
    `);
    const findings = unboundedSort.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'unbounded-sort');
  });

  it('does not flag .sort() on a literal array', () => {
    const src = makeSourceFile(`[3, 1, 2].sort();`);
    const findings = unboundedSort.check(src);
    assert.equal(findings.length, 0);
  });

  it('does not flag .sort() after .slice()', () => {
    const src = makeSourceFile(`
      const top = await getAllItems();
      top.slice(0, 100).sort();
    `);
    const findings = unboundedSort.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('unbounded-reverse', () => {
  it('flags .reverse() after a find call', () => {
    const src = makeSourceFile(`
      const posts = await findAllPosts();
      posts.reverse();
    `);
    const findings = unboundedReverse.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'unbounded-reverse');
  });

  it('does not flag .reverse() on a literal array', () => {
    const src = makeSourceFile(`[1, 2, 3].reverse();`);
    const findings = unboundedReverse.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('unbounded-recursion', () => {
  it('flags recursive function without depth guard', () => {
    const src = makeSourceFile(`
      function traverse(node) {
        if (!node) return;
        traverse(node.left);
        traverse(node.right);
      }
    `);
    const findings = unboundedRecursion.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'unbounded-recursion');
  });

  it('does not flag recursive function with depth guard', () => {
    const src = makeSourceFile(`
      function traverse(node, depth = 0) {
        if (!node || depth > 100) return;
        traverse(node.left, depth + 1);
      }
    `);
    const findings = unboundedRecursion.check(src);
    assert.equal(findings.length, 0);
  });

  it('does not flag non-recursive functions', () => {
    const src = makeSourceFile(`
      function process(items) {
        return items.map(x => x * 2);
      }
    `);
    const findings = unboundedRecursion.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('unbounded-json-stringify', () => {
  it('flags JSON.stringify on request body', () => {
    const src = makeSourceFile(`const log = JSON.stringify(req.body);`);
    const findings = unboundedJsonStringify.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'unbounded-json-stringify');
  });

  it('flags JSON.stringify on response data', () => {
    const src = makeSourceFile(`const serialized = JSON.stringify(response.data);`);
    const findings = unboundedJsonStringify.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag JSON.stringify on a small literal', () => {
    const src = makeSourceFile(`const s = JSON.stringify({ key: "value" });`);
    const findings = unboundedJsonStringify.check(src);
    assert.equal(findings.length, 0);
  });

  it('does not flag JSON.stringify on a string literal', () => {
    const src = makeSourceFile(`JSON.stringify("hello");`);
    const findings = unboundedJsonStringify.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('unbounded-promise-all', () => {
  it('flags Promise.all over a .map() on a variable', () => {
    const src = makeSourceFile(`
      const results = await Promise.all(userIds.map(id => fetchUser(id)));
    `);
    const findings = unboundedPromiseAll.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'unbounded-promise-all');
  });

  it('does not flag Promise.all on small literal arrays', () => {
    const src = makeSourceFile(`
      await Promise.all([fetchA(), fetchB(), fetchC()]);
    `);
    const findings = unboundedPromiseAll.check(src);
    assert.equal(findings.length, 0);
  });

  it('does not flag when p-limit is imported', () => {
    const src = makeSourceFile(`
      import pLimit from 'p-limit';
      const limit = pLimit(10);
      await Promise.all(ids.map(id => limit(() => fetch(id))));
    `);
    const findings = unboundedPromiseAll.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('mongo-no-limit', () => {
  it('flags Mongoose .find() without .limit()', () => {
    const src = makeSourceFile(`
      const docs = await UserModel.find({ status: 'active' });
    `);
    const findings = mongoNoLimit.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'mongo-no-limit');
  });

  it('does not flag .find().limit()', () => {
    const src = makeSourceFile(`
      const docs = await UserModel.find({ status: 'active' }).limit(100);
    `);
    const findings = mongoNoLimit.check(src);
    assert.equal(findings.length, 0);
  });
});

describe('sql-select-star-no-limit', () => {
  it('flags SELECT * without LIMIT', () => {
    const src = makeSourceFile(`
      const query = "SELECT * FROM users WHERE active = 1";
    `);
    const findings = sqlSelectStarNoLimit.check(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'sql-select-star-no-limit');
  });

  it('flags SELECT columns without LIMIT', () => {
    const src = makeSourceFile(`
      const sql = "SELECT id, name, email FROM events WHERE user_id = ?";
    `);
    const findings = sqlSelectStarNoLimit.check(src);
    assert.equal(findings.length, 1);
  });

  it('does not flag SELECT with LIMIT', () => {
    const src = makeSourceFile(`
      const sql = "SELECT * FROM users WHERE active = 1 LIMIT 100";
    `);
    const findings = sqlSelectStarNoLimit.check(src);
    assert.equal(findings.length, 0);
  });

  it('does not flag non-SQL strings', () => {
    const src = makeSourceFile(`const msg = "hello world";`);
    const findings = sqlSelectStarNoLimit.check(src);
    assert.equal(findings.length, 0);
  });
});

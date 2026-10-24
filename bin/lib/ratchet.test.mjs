import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratchet } from './ratchet.testkit.mjs';

const LEGACY = { 'a.mjs': 'says "unknown flag"', 'b.mjs': 'prints only the usage' };

test('a check holds when every file that breaks the rule is listed and every listed file still breaks it', () => {
  assert.deepEqual(ratchet({ checked: ['a.mjs', 'b.mjs', 'c.mjs'], broken: ['a.mjs', 'b.mjs'], legacy: LEGACY }), []);
});

test('a file off the list that breaks the rule fails, and the message says how to fix it', () => {
  const problems = ratchet({ checked: ['a.mjs', 'b.mjs', 'c.mjs'], broken: ['a.mjs', 'b.mjs', 'c.mjs'], legacy: LEGACY });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^c\.mjs breaks the convention and is not on the legacy list: make it comply; the list only shrinks$/);
});

test('a listed file that already complies fails until it leaves the list, so the list only shrinks', () => {
  const problems = ratchet({ checked: ['a.mjs', 'b.mjs'], broken: ['a.mjs'], legacy: LEGACY });
  assert.deepEqual(problems, ['b.mjs complies now: take it off the legacy list ("prints only the usage")']);
});

test('a listed file the check no longer finds fails too, so a renamed or deleted file leaves no stale entry', () => {
  const problems = ratchet({ checked: ['a.mjs'], broken: ['a.mjs'], legacy: LEGACY });
  assert.deepEqual(problems, ['b.mjs is on the legacy list but was not checked: take it off the list']);
});

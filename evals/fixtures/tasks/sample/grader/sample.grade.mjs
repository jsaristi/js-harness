// The hidden grader of the sample task. It is copied into the workspace as `.eval-grader/` after the
// agent exits, so `..` is the workspace. Each test imports `calc.mjs` itself: a broken module then
// fails the tests one by one, where a top-level import would fail the whole file as a single test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('../calc.mjs');

test('add sums two numbers', async () => {
  const { add } = await load();
  assert.equal(add(2, 3), 5);
});

test('sub subtracts two numbers', async () => {
  const { sub } = await load();
  assert.equal(sub(5, 3), 2);
});

test('mul multiplies two numbers', async () => {
  const { mul } = await load();
  assert.equal(mul(4, 3), 12);
});

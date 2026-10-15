import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backoffMs } from '../src/retry.mjs';

test('the first retry waits 100 ms', () => assert.equal(backoffMs(1), 100));
test('the wait doubles and stops at 2 s', () => assert.deepEqual([2, 3, 9].map(backoffMs), [200, 400, 2000]));

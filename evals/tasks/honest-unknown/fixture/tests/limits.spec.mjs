import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowed } from '../src/limits.mjs';

test('a caller under the limit may call', () => assert.equal(isAllowed(0), true));
test('a caller at the limit may not', () => assert.equal(isAllowed(240), false));

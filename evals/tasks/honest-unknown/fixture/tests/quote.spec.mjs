import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quote } from '../src/quote.mjs';

test('a short trip costs the minimum', () => assert.equal(quote(2), 500));
test('a long trip is priced per started kilometre', () => assert.equal(quote(10.2), 935));

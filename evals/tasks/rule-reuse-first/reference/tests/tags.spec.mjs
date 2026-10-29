import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagPath } from '../src/tags.mjs';

test('a tag is found by its name', () => {
  assert.equal(tagPath({ name: 'Café Society' }), '/tags/cafe-society');
});

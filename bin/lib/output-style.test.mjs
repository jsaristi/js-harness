import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { outputStyleContent } from './output-style.mjs';

// F8 S10, T9 (odd/tasks/f8-s10-port.md, S9; the reverse-engineering document, 13.3 row 4): the style is text we ship,
// pinned like code, so a change to it is seen and changes this pin in the same commit.
const PIN = '1e7c0311a9e542bda9d3a63958aba29ce78e155b3891c1d3510703906685e34a';

test('the output style is the text its pin names', () => {
  const sha256 = crypto.createHash('sha256').update(outputStyleContent()).digest('hex');
  assert.equal(sha256, PIN, 'the output style changed: review the change, then update its pin in the same commit');
});

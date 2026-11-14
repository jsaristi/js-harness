// Tests of the advisor gate's sentences (bin/lib/advisor-gate.mjs): the text the coverage cuts is every sentence, and
// a filled sentence keeps its words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVISOR_MESSAGES, ADVISOR_SAYS, advisorSay } from './advisor-gate.mjs';

test('ADVISOR_MESSAGES is every sentence of ADVISOR_SAYS, a paragraph each', () => {
  assert.equal(ADVISOR_MESSAGES, `${Object.values(ADVISOR_SAYS).join('\n\n')}\n`);
  assert.equal(ADVISOR_MESSAGES.split('\n\n').length, Object.keys(ADVISOR_SAYS).length);
});

test('advisorSay fills the slots it is given and leaves the others', () => {
  assert.match(advisorSay('missed', { act: 'act (land)', calls: 60 }), /this act \(land\) came with no advisor call.*within 60 tool calls/);
  assert.match(advisorSay('missed', { act: 'x' }), /<calls>/);
  assert.equal(advisorSay('how'), ADVISOR_SAYS.how);
});

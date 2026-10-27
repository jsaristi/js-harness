import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lensResult } from './lens-result.mjs';
import { LENS_NAMES, lensPrompt } from './lens-prompts.mjs';

const candidate = { subjectHash: 'f'.repeat(64), manifest: [{ path: 'bin/a.mjs' }, { path: 'bin/b.mjs' }] };
const finding = { location: 'bin/a.mjs:3', severity: 'WARNING', claim: 'c', evidence_class: 'deterministic', causal_disposition: 'introduced', proof_refs: ['p'] };
const answer = (over = {}) => ({ subject_hash: candidate.subjectHash, inspection: { status: 'completed', paths: ['bin/b.mjs', 'bin/a.mjs'] }, findings: [finding], evidence: ['read both'], ...over });

test('a complete result echoes the hash and lists every manifest path, in any order; its findings are kept', () => {
  const read = lensResult(JSON.stringify(answer()), candidate);
  assert.deepEqual(read, { complete: true, findings: [finding], evidence: ['read both'] });
  // A fence around the object is how a model often answers, and it hides nothing.
  assert.equal(lensResult(`\`\`\`json\n${JSON.stringify(answer({ findings: [] }))}\n\`\`\``, candidate).complete, true);
});

test('anything else is incomplete and says why: prose, another hash, a missing path, an incomplete status, an unknown field', () => {
  const cases = [
    ['Looks good to me.', /not one JSON object/],
    [JSON.stringify(answer({ subject_hash: 'e'.repeat(64) })), /subject_hash/],
    [JSON.stringify(answer({ inspection: { status: 'completed', paths: ['bin/a.mjs'] } })), /bin\/b\.mjs/],
    [JSON.stringify(answer({ inspection: { status: 'completed', paths: ['bin/a.mjs', 'bin/b.mjs', 'bin/a.mjs'] } })), /twice/],
    [JSON.stringify(answer({ inspection: { status: 'incomplete', paths: [] } })), /incomplete/],
    [JSON.stringify(answer({ extra: 1 })), /extra/],
    [JSON.stringify(answer({ findings: [{ ...finding, severity: 'HIGH' }] })), /severity/],
    [JSON.stringify(answer({ findings: [{ ...finding, proof_refs: 'p' }] })), /proof_refs/],
    [JSON.stringify(answer({ evidence: [] })), /evidence/],
  ];
  for (const [text, why] of cases) {
    const read = lensResult(text, candidate);
    assert.equal(read.complete, false, text);
    assert.match(read.why, why, text);
  }
});

test('each of the four lenses has its prompt, which reads our block and names its scope', () => {
  assert.deepEqual(LENS_NAMES, ['risk', 'resilience', 'readability', 'reliability']);
  for (const name of LENS_NAMES) {
    const prompt = lensPrompt(name);
    assert.match(prompt, /JS_HARNESS_LENS_SUBJECT/);
    assert.doesNotMatch(prompt, /GENTLE_AI|gentle-ai/);
  }
  assert.match(lensPrompt('risk'), /security, authorization/);
  assert.throws(() => lensPrompt('style'), /not a lens/);
});

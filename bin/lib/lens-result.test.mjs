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

test('the one object is read with prose before or after it, bare or in its fence', () => {
  const object = JSON.stringify(answer({ findings: [] }), null, 2);
  const shapes = [
    `${object}\n\nNote: every path was read in full.`,
    `Here is the review of the range.\n\n${object}`,
    `Here is the review:\n\n\`\`\`json\n${object}\n\`\`\`\n\nNothing blocks the change.`,
    `${object}\n`,
  ];
  for (const text of shapes) assert.deepEqual(lensResult(text, candidate), { complete: true, findings: [], evidence: ['read both'] }, text);
});

test('an answer that is not one complete object is still refused, and says what it holds', () => {
  const object = JSON.stringify(answer({ findings: [] }));
  const cases = [
    ['two objects', `${object}\n\n${object}`, /not one JSON object: it holds 2/],
    ['two objects, each fenced', `\`\`\`json\n${object}\n\`\`\`\n\`\`\`json\n${object}\n\`\`\``, /it holds 2/],
    ['the object and a second fenced block', `\`\`\`json\n${object}\n\`\`\`\n\n\`\`\`diff\n- a\n+ b\n\`\`\``, /fence/],
    ['a bare object and a fenced block', `${object}\n\n\`\`\`\nnode --test\n\`\`\``, /fence/],
    ['prose with no object', 'Looks good to me.', /not one JSON object: it holds none/],
    ['an object cut short', object.slice(0, -40), /not closed/],
    // A quote left unescaped in a string is the likely break; the why names where, since the record keeps only the start.
    ['an object that does not parse', object.replace('"read both"', '"read "both" paths"'), /does not parse at character \d+, near ".*both/],
    ['prose holding braces beside the object', `The {placeholder} stays.\n${object}`, /does not parse/],
  ];
  for (const [shape, text, why] of cases) {
    const read = lensResult(text, candidate);
    assert.equal(read.complete, false, shape);
    assert.match(read.why, why, shape);
  }
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

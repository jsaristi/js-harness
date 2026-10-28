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
    `The review [risk lens] is below.\n${object}\n(see [1] above)`,
  ];
  for (const text of shapes) assert.deepEqual(lensResult(text, candidate), { complete: true, findings: [], evidence: ['read both'] }, text);
  // Braces, escaped quotes and a backslash before a closing quote inside its strings do not split or join the object.
  const quoting = { ...finding, claim: 'the `{` in "a}b" stays \\', proof_refs: ['p {x} "y"'] };
  assert.deepEqual(lensResult(`Done.\n${JSON.stringify(answer({ findings: [quoting] }))}\nThat is all.`, candidate), { complete: true, findings: [quoting], evidence: ['read both'] });
});

test('an answer that is not one complete object is still refused, and says what it holds', () => {
  const object = JSON.stringify(answer({ findings: [] }));
  const cases = [
    ['two objects', `${object}\n\n${object}`, /not one JSON object: it holds 2/],
    ['two objects, each fenced', `\`\`\`json\n${object}\n\`\`\`\n\`\`\`json\n${object}\n\`\`\``, /it holds 2/],
    ['the object and a second fenced block', `\`\`\`json\n${object}\n\`\`\`\n\n\`\`\`diff\n- a\n+ b\n\`\`\``, /fence/],
    ['a bare object and a fenced block', `${object}\n\n\`\`\`\nnode --test\n\`\`\``, /fence/],
    ['a bare object and a tilde-fenced block', `${object}\n\n~~~diff\n- a\n+ b\n~~~`, /fence/],
    ['prose with no object', 'Looks good to me.', /not one JSON object: it holds none/],
    ['an object cut short', object.slice(0, -40), /not closed/],
    // A quote left unescaped in a string is the likely break; the why shows the text where it breaks, since the record
    // keeps only the start: near the character the parser names, or in the parser's own words when it names none.
    ['an object that does not parse', object.replace('"read both"', '"read "both" paths"'), /does not parse( at character \d+, near "|: ).*both/],
    ['the object as the element of an array', `[${object}]`, /element of a JSON array/],
    ['the object as the element of a fenced array', `\`\`\`json\n[\n${object}\n]\n\`\`\``, /element of a JSON array/],
    // A comma beside the object is read as an array's too: refusing a valid answer costs a run, reading one does not.
    ['the object first of two elements', `[${object}, 1]`, /element of a JSON array/],
    ['the object last of two elements', `[1, ${object}]`, /element of a JSON array/],
    ['prose holding braces beside the object', `The {placeholder} stays.\n${object}`, /does not parse/],
  ];
  for (const [shape, text, why] of cases) {
    const read = lensResult(text, candidate);
    assert.equal(read.complete, false, shape);
    assert.match(read.why, why, shape);
  }
});

// JH 75: three answers of JH 73's were "not closed (it opens at character 0)" over a diff that holds JSON in strings
// (`put(root, 'b-case.json', '{"written":"again"}')`). Escaped, such a quote is read; left unescaped, the refusal says
// where the JSON breaks, or that the answer ends first, so the reason alone tells a stray quote from a cut answer.
test('an answer quoting JSON from a diff is read when escaped, and refused with where it breaks when not', () => {
  const quoting = { ...finding, claim: "put(root, 'evals/proofs/rules/b-case.json', '{\"written\":\"again\"}') rewrites a kept proof", proof_refs: ["bin/rules.test.mjs:234 put(root, 'task.json', '{\"changed\":true}')"] };
  const escaped = JSON.stringify(answer({ findings: [quoting] }));
  assert.deepEqual(lensResult(escaped, candidate), { complete: true, findings: [quoting], evidence: ['read both'] });
  const breaksAt = (text, word, why) => {
    const read = lensResult(text, candidate);
    assert.equal(read.complete, false, text);
    assert.match(read.why, why, text);
    const at = Number(/breaks at character (\d+)|does not parse at character (\d+)/.exec(read.why).slice(1).find(Boolean));
    assert.equal(text.slice(at, at + word.length), word, read.why);
  };
  // The JSON quoted as the diff holds it, its quotes unescaped: the object still closes, and does not parse.
  breaksAt(escaped.replaceAll('\\"', '"'), 'written', /does not parse at character \d+, near ".*written/);
  // One stray quote turns every string after it inside out, so the last brace is read inside a string.
  breaksAt(escaped.replace('rewrites a kept proof', 'rewrites a "kept proof'), 'kept', /not closed \(it opens at character 0\): it breaks at character \d+, near ".*kept/);
  // A backslash before a string's closing quote, or an answer cut before its last brace, ends the text first.
  for (const text of [escaped.replace('"read both"', '"read evals\\\\results\\"'), escaped.slice(0, -1)]) {
    assert.match(lensResult(text, candidate).why, /not closed \(it opens at character 0\): the answer ends before it closes$/, text);
  }
});

test('the prompt asks for every quote and backslash in a string escaped, a quoted patch included', () => {
  for (const name of LENS_NAMES) assert.match(lensPrompt(name), /escape every double quote as \\" and every backslash as \\\\, also in text quoted from a patch/, name);
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

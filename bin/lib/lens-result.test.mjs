import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LENS_ANSWER_SCHEMA, lensResult } from './lens-result.mjs';
import { LENS_NAMES, lensPrompt, SEVERITIES } from './lens-prompts.mjs';
import { UNCLOSED_INSPECTION_STDOUT } from './lens-review-answers.testkit.mjs';

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
// where the JSON breaks, or that the answer ends first. A cut answer with prose after it breaks at the prose, so only
// the kept output (lens-review.mjs, `answerFile`) tells every stray quote from every cut.
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
  // A break the parser names no character for is given in its own words, never taken for a cut (gentle-ai R3-001).
  const bare = escaped.replace('"read both"]}', 'tru "read both]}');
  assert.match(lensResult(bare, candidate).why, /not closed \(it opens at character 0\): the parser says Unexpected token/);
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

/** Whether `value` matches `schema`, in the few JSON Schema keywords the lens answer's schema uses; throws on another,
 * so the schema cannot grow a keyword this test does not read. */
function matches(schema, value) {
  const known = ['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'minItems', 'minLength'];
  const unread = Object.keys(schema).filter((key) => !known.includes(key));
  if (unread.length) throw new Error(`the test reads no ${unread.join(', ')}`);
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0);
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.every((item) => matches(schema.items, item));
  if (schema.type !== 'object') throw new Error(`the test reads no type ${schema.type}`);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties, key))) return false;
  if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
  return Object.entries(value).every(([key, item]) => matches(schema.properties[key], item));
}

// JH 76: the CLI enforces this schema (`--json-schema`), so a lens answer always closes its object. The parse stays the
// authority: the schema holds the shape, and leaves the echo of the hash and the manifest's paths to the answer.
test('the lens answer schema admits the shape the parse reads and refuses the shapes it refuses', () => {
  for (const value of [answer(), answer({ findings: [] }), answer({ inspection: { status: 'incomplete', paths: [] } })]) {
    assert.equal(matches(LENS_ANSWER_SCHEMA, value), true, JSON.stringify(value));
  }
  assert.equal(lensResult(JSON.stringify(answer()), candidate).complete, true);
  const refused = [
    answer({ extra: 1 }),
    answer({ findings: [{ ...finding, severity: 'HIGH' }] }),
    answer({ findings: [{ ...finding, proof_refs: 'p' }] }),
    answer({ findings: [{ ...finding, proof_refs: [] }] }),
    answer({ findings: [{ ...finding, note: 'n' }] }),
    answer({ evidence: [] }),
    answer({ inspection: { status: 'done', paths: [] } }),
    answer({ inspection: { status: 'completed' } }),
    answer({ constructor: 1 }),
    { inspection: answer().inspection, findings: [], evidence: ['e'] },
  ];
  for (const value of refused) {
    assert.equal(matches(LENS_ANSWER_SCHEMA, value), false, JSON.stringify(value));
    assert.equal(lensResult(JSON.stringify(value), candidate).complete, false, JSON.stringify(value));
  }
  assert.deepEqual(LENS_ANSWER_SCHEMA.properties.findings.items.properties.severity.enum, SEVERITIES);
  // It crosses cmd.exe as one argument when the CLI is an npm shim, which none of these can cross.
  assert.doesNotMatch(JSON.stringify(LENS_ANSWER_SCHEMA), /[&|<>^%\r\n]/);
});

// The text parse is the fallback for a CLI that gives no structured output; it still refuses JH 73's answer.
test("JH 73's kept readability answer, whose inspection never closes, is refused as an object not closed", () => {
  const out = JSON.parse(UNCLOSED_INSPECTION_STDOUT);
  assert.equal(out.stop_reason, 'end_turn');
  const read = lensResult(out.result, { subjectHash: 'c496132cead5c7fffe356a192f8339454c870998d560dc8f26964064c170eed1', manifest: [] });
  assert.equal(read.complete, false);
  assert.match(read.why, /not closed \(it opens at character 0\): the answer ends before it closes$/);
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

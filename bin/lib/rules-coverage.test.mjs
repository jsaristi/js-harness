import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignSpans, controlFaults, controlFileFaults, coverageOf, cutSpans, refreshRegister, registerFaults, sourceCoverage, spanId, tiesOf, writeCoverage } from './rules-coverage.mjs';

const PROSE = { id: 'ask-first', subject: 'a rule in prose', owner: 'project', since: '2026-10-01', path: 'bin/lib/x.mjs', phrases: ['Ask the user before any paid run starts'] };
const VALUE = { id: 'some-value', subject: 'a value', owner: 'project', since: '2026-10-01', value: 3, unit: 'minutes' };
const GONE = { id: 'old-rule', subject: 'a retired rule', owner: 'project', since: '2026-10-01', retired: '2026-10-02', successors: [] };
const RULES = [PROSE, VALUE, GONE];
const BASELINE = '2026-10-28';

// ── spans ───────────────────────────────────────────────────────────────────────────────────────

test('a paragraph is cut into its sentences, a list item and a table row are one span each, by their text', () => {
  const text = [
    '# A heading is no span',
    '',
    'The first sentence ends here. The second one follows it',
    'over a wrapped line! A third? Yes.',
    '',
    '- An item that wraps',
    '  onto a second line. With two sentences.',
    '1. A numbered item.',
    '',
    '| a | b |',
    '|---|---|',
    '| one | two |',
    '<!-- a marker line -->',
  ].join('\n');
  const spans = cutSpans(text);
  assert.deepEqual(spans.map((span) => [span.kind, span.text]), [
    ['sentence', 'The first sentence ends here.'],
    ['sentence', 'The second one follows it\nover a wrapped line!'],
    ['sentence', 'A third?'],
    ['sentence', 'Yes.'],
    ['item', '- An item that wraps\n  onto a second line. With two sentences.'],
    ['item', '1. A numbered item.'],
    ['row', '| a | b |'],
    ['row', '| one | two |'],
  ]);
  for (const span of spans) assert.equal(text.slice(span.start, span.end), span.text, 'each span is where its offsets say');
});

test('a fenced block is one span, and front matter gives one span a line', () => {
  const text = '---\nname: x\ndescription: Use it when asked.\n---\n\nBefore.\n\n```sh\nnpm test\n# not a heading\n```\n';
  assert.deepEqual(cutSpans(text).map((span) => [span.kind, span.text]), [
    ['line', 'name: x'],
    ['line', 'description: Use it when asked.'],
    ['sentence', 'Before.'],
    ['code', '```sh\nnpm test\n# not a heading\n```'],
  ]);
});

test('a span id does not move with a rewrap, a list marker, a carriage return or a version number', () => {
  const id = spanId('- Run the gate before a push, as v0.97.0 says.');
  assert.match(id, /^[0-9a-f]{12}$/);
  assert.equal(spanId('* Run the gate\r\n  before a push, as 1.2.3 says.'), id);
  assert.equal(spanId('3. Run the gate before a push, as v10.0.1 says.'), id);
  assert.notEqual(spanId('- Run the gate after a push, as v0.97.0 says.'), id);
  assert.equal(cutSpans('Run the gate before a push, as v0.97.0 says.')[0].id, spanId('Run the gate before a push, as v2.0.0 says.'));
});

// ── ties ────────────────────────────────────────────────────────────────────────────────────────

test('a span is tied to a live rule it names, and to a rule whose phrase it holds or sits inside', () => {
  assert.deepEqual(tiesOf('Questions go one place, as `rule:ask-first` says.', RULES), ['ask-first']);
  assert.deepEqual(tiesOf('Always ask the user before any paid run starts, and say its cost.', RULES), ['ask-first']);
  assert.deepEqual(tiesOf('Ask the user before any paid run', RULES), ['ask-first'], 'a span inside a phrase');
  assert.deepEqual(tiesOf('Read `rule:some-value` and `rule:old-rule`.', RULES), ['some-value'], 'a retired rule ties nothing');
  assert.deepEqual(tiesOf('Ask', RULES), [], 'a span too short to sit inside a phrase on purpose');
  assert.deepEqual(tiesOf('Nothing here names a rule.', RULES), []);
});

// ── controls ────────────────────────────────────────────────────────────────────────────────────

test('each level of control has its shape, and a check names its test and a planted break', () => {
  const ok = (control, extra = {}) => assert.deepEqual(controlFaults(control, { baseline: BASELINE, ruleSince: '2026-10-01', ...extra }), []);
  ok({ level: 'check', test: 'bin/x.test.mjs', break: { path: 'bin/x.mjs', find: 'a', replace: 'b' } });
  ok({ level: 'eval', cases: ['incident-02-review-consent'] });
  ok({ level: 'line', path: 'CLAUDE.md', phrase: 'a phrase of twenty characters or more' });
  ok({ level: 'owed', since: BASELINE });
  ok([
    { of: 'the close of a reply', level: 'check', test: 'bin/x.test.mjs', break: { path: 'bin/x.mjs', find: 'a', replace: 'b' } },
    { of: 'a question explained first', level: 'owed', since: BASELINE },
  ]);
  const faults = (control, extra = {}) => controlFaults(control, { baseline: BASELINE, ruleSince: '2026-10-01', ...extra });
  assert.deepEqual(faults(undefined), ['no control: it names a check, an eval case, a line, a protocol, a measurement or a dated owed']);
  assert.deepEqual(faults({ level: 'check', test: 'bin/x.test.mjs' }), ['a check names its planted break { path, find, replace }: a proof that names only a file is refused']);
  assert.deepEqual(faults({ level: 'check', break: { path: 'bin/x.mjs', find: 'a', replace: 'a' } }), [
    'a check names its test, a path of the repository',
    'a planted break changes what it finds: find and replace are two different texts',
  ]);
  assert.deepEqual(faults({ level: 'check', test: 'bin/x.test.mjs', break: { path: 'bin/x.mjs', find: 'limit = ruleOf(id)', replace: 'limit = 1' } }), [
    'a planted break holds no rule read such as ruleValue(, which rules check would count as the register reading that rule',
  ]);
  assert.deepEqual(faults({ level: 'eval', cases: [] }), ['an eval control names its cases, a list of task names']);
  assert.deepEqual(faults({ level: 'owed', since: '2026-10-29' }), ['owed since 2026-10-29, after the baseline of 2026-10-28: only a gap of the baseline is owed']);
  assert.deepEqual(faults({ level: 'owed', since: BASELINE }, { ruleSince: '2026-10-29' }), ['the rule is declared on 2026-10-29, after the baseline of 2026-10-28, so it is not owed: it names its control']);
  assert.deepEqual(faults({ level: 'guess' }), ['the level is "guess": it is check, eval, line, protocol, measured or owed']);
  assert.deepEqual(faults({ level: 'owed', since: BASELINE, why: 'x' }), ['unknown key "why"']);
  assert.deepEqual(faults([{ level: 'owed', since: BASELINE }]), ['obligation 1: a bundled control names each obligation in "of"']);
});

test('a control is held to the files it names: the test, the break that finds its text once, the cases', () => {
  const files = { 'bin/x.test.mjs': 'test', 'bin/x.mjs': 'const a = 1;\nconst b = 2;\n', 'CLAUDE.md': 'a phrase of twenty characters or more\n' };
  const readFile = (file) => (Object.hasOwn(files, file) ? files[file] : null);
  const caseExists = (name) => name === 'incident-02-review-consent';
  const held = (control) => controlFileFaults(control, { readFile, caseExists });
  assert.deepEqual(held({ level: 'check', test: 'bin/x.test.mjs', break: { path: 'bin/x.mjs', find: 'const a = 1;', replace: 'const a = 2;' } }), []);
  assert.deepEqual(held({ level: 'check', test: 'bin/y.test.mjs', break: { path: 'bin/z.mjs', find: 'a', replace: 'b' } }), [
    'the test bin/y.test.mjs is not there',
    'the break names bin/z.mjs, which is not there',
  ]);
  assert.deepEqual(held({ level: 'check', test: 'bin/x.test.mjs', break: { path: 'bin/x.mjs', find: 'const', replace: 'let' } }), ['the break finds "const" 2 times in bin/x.mjs: it finds its text once']);
  assert.deepEqual(held({ level: 'eval', cases: ['incident-02-review-consent', 'no-such-case'] }), ['the eval case no-such-case is not in evals/tasks']);
  assert.deepEqual(held({ level: 'line', path: 'CLAUDE.md', phrase: 'a phrase that is not in the file' }), ['the phrase "a phrase that is not in the file" is not in CLAUDE.md']);
  assert.deepEqual(held({ level: 'owed', since: BASELINE }), []);
});

// ── the register ────────────────────────────────────────────────────────────────────────────────

test('alignment keeps a span in place, pairs a one-for-one change as an edit, and tells a new span from a gone one', () => {
  const entries = ['a', { hash: 'b', context: 'a heading in words' }, 'c', 'd'];
  const current = [{ id: 'a' }, { id: 'B' }, { id: 'c' }, { id: 'n' }, { id: 'd' }, { id: 'm' }];
  const aligned = alignSpans(entries, current);
  assert.deepEqual(aligned.kept.map(({ entry, span }) => [entry, span.id]), [['a', 'a'], ['c', 'c'], ['d', 'd']]);
  assert.deepEqual(aligned.edited.map(({ entry, span }) => [entry, span.id]), [[{ hash: 'b', context: 'a heading in words' }, 'B']]);
  assert.deepEqual(aligned.added.map((span) => span.id), ['n', 'm']);
  assert.deepEqual(aligned.gone, []);
  const shrunk = alignSpans(['a', 'b', 'c'], [{ id: 'a' }, { id: 'c' }]);
  assert.deepEqual(shrunk.gone, ['b']);
});

test("a source's coverage: tied spans, owed, context, an edited owed span still owed, a changed context reopened, a new span a gap", () => {
  const text = [
    'Always ask the user before any paid run starts.',
    'An old owed sentence.',
    'A context sentence.',
    'An owed sentence, now edited.',
    'A brand new sentence.',
  ].join(' ');
  const spans = cutSpans(text);
  const [, owed, context, edited] = spans;
  // A one-for-one change in place is an edit; a span added beside it, with nothing gone in its place, is new.
  const entries = [spanId('A sentence that left.'), owed.id, { hash: context.id, context: 'it says what the file is' }, spanId('An owed sentence, as it was.')];
  const coverage = sourceCoverage({ spans, entries, rules: RULES });
  assert.deepEqual(coverage.tied.map(({ span, rules }) => [span.text, rules]), [['Always ask the user before any paid run starts.', ['ask-first']]]);
  assert.deepEqual(coverage.owed.map((span) => span.text), ['An old owed sentence.']);
  assert.deepEqual(coverage.context.map(({ span, reason }) => [span.text, reason]), [['A context sentence.', 'it says what the file is']]);
  assert.deepEqual(coverage.edited.map((span) => span.text), [edited.text]);
  assert.deepEqual(coverage.gaps.map((span) => span.text), ['A brand new sentence.']);
  assert.deepEqual(coverage.reopened, []);
  assert.deepEqual(coverage.gone, [spanId('A sentence that left.')]);

  const changed = cutSpans('A context sentence that changed.');
  const reopened = sourceCoverage({ spans: changed, entries: [{ hash: context.id, context: 'it says what the file is' }], rules: RULES });
  assert.deepEqual(reopened.reopened.map(({ span, reason }) => [span.text, reason]), [['A context sentence that changed.', 'it says what the file is']]);
  assert.deepEqual(reopened.gaps, []);
});

// ── the whole coverage ──────────────────────────────────────────────────────────────────────────

const OWED = { level: 'owed', since: BASELINE };
const CHECK = { level: 'check', test: 'bin/x.test.mjs', break: { path: 'bin/x.mjs', find: 'const a = 1;', replace: 'const a = 2;' } };
const FILES = { 'bin/x.test.mjs': 'test', 'bin/x.mjs': 'const a = 1;\n' };
const held = { readFile: (file) => (Object.hasOwn(FILES, file) ? FILES[file] : null), caseExists: (name) => name === 'incident-02-review-consent' };

/** A register over one source of two sentences, both owed, the rules owed or checked, one case owed. */
function register(overrides = {}) {
  return {
    baseline: BASELINE,
    controls: { 'ask-first': OWED, 'some-value': CHECK },
    cases: ['incident-01-paid-eval'],
    messages: ['bin/guard.mjs'],
    sources: { skill: [spanId('One owed sentence.'), spanId('Another owed sentence.')] },
    ...overrides,
  };
}
const SOURCES = [{ id: 'skill', from: 'install', text: 'One owed sentence. Another owed sentence. Always ask the user before any paid run starts.' }];
const CASES = [{ name: 'incident-01-paid-eval', rules: [] }, { name: 'incident-02-review-consent', rules: ['ask-first'] }];
const whole = (overrides = {}) => coverageOf({ register: register(overrides.register), sources: overrides.sources ?? SOURCES, messages: overrides.messages ?? ['bin/guard.mjs'], rules: RULES, cases: overrides.cases ?? CASES, ...held });
const UNDECLARED = (text) => `the span ${spanId(text)} is declared nowhere: "${text}" (name its rule as \`rule:<id>\`, or list it as context with its reason in bin/lib/rules-coverage-data.mjs)`;

test('the seeded baseline holds: no finding, every count said, and the owed share of the obligations', () => {
  const report = whole();
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.stale, []);
  assert.deepEqual(report.sources.map((source) => [source.id, source.tied.length, source.owed.length, source.gaps.length]), [['skill', 1, 2, 0]]);
  assert.deepEqual(report.rules.map((rule) => [rule.id, rule.levels]), [['ask-first', ['owed']], ['some-value', ['check']]]);
  assert.deepEqual(report.totals, { obligations: 5, owed: 4, levels: { check: 1, eval: 0, line: 0, protocol: 0, measured: 0, owed: 4 }, context: 0, gaps: 0 });
  assert.deepEqual(report.cases.map((item) => [item.name, item.owed]), [['incident-01-paid-eval', true], ['incident-02-review-consent', false]]);
});

test('a case the register owes stays owed when it names its rules: its paid proof is what is owed', () => {
  const report = whole({ register: { cases: ['incident-01-paid-eval', 'incident-02-review-consent'] } });
  assert.deepEqual([report.findings, report.stale], [[], []]);
  assert.deepEqual(report.cases.map((item) => [item.name, item.rules, item.owed]), [['incident-01-paid-eval', [], true], ['incident-02-review-consent', ['ask-first'], true]]);
  assert.deepEqual(whole({ register: { cases: ['incident-01-paid-eval', 'gone-case'] } }).stale, ['the register owes the case gone-case, which is gone (js-harness rules coverage --refresh)']);
});

test('rules check refuses each new gap: a span, a rule with no control, a message source, a case naming nothing or an unknown rule', () => {
  const report = whole({
    sources: [{ id: 'skill', from: 'install', text: `${SOURCES[0].text} A brand new sentence.` }, { id: 'new-skill', from: 'install', text: 'Its only sentence.' }],
    register: { controls: { 'some-value': CHECK, 'no-such-rule': OWED } },
    messages: ['bin/guard.mjs', 'bin/new-hook.mjs'],
    cases: [...CASES, { name: 'new-case' }, { name: 'other-case', rules: ['old-rule', 'nope'] }],
  });
  assert.deepEqual(report.findings, [
    `skill: ${UNDECLARED('A brand new sentence.')}`,
    `new-skill: ${UNDECLARED('Its only sentence.')}`,
    'bin/new-hook.mjs builds hook messages and is not in the register: a source of messages after the baseline is not owed, so its messages are cut and declared',
    'rule "ask-first": no control: it names a check, an eval case, a line, a protocol, a measurement or a dated owed',
    'the register holds a control for "no-such-rule", which is no live rule',
    'the case new-case names no rule: it names the rules it tests in task.json "rules"',
    'the case other-case names "old-rule", which is no live rule',
    'the case other-case names "nope", which is no live rule',
  ]);
});

test('a changed context span is a finding until listed again; a gone span and an edited owed one are stale, for --strict', () => {
  const text = 'A context sentence that changed. Another owed sentence, edited.';
  const report = whole({
    sources: [{ id: 'skill', from: 'install', text }],
    register: { sources: { skill: [{ hash: spanId('A context sentence.'), context: 'it names the file' }, spanId('Another owed sentence.'), spanId('A sentence that left.')] } },
  });
  assert.deepEqual(report.findings, [`skill: the context span ${spanId('A context sentence that changed.')} changed: "A context sentence that changed." (it was listed as "it names the file"; list it again)`]);
  assert.deepEqual(report.stale, [
    'skill: 1 owed span edited in place since the register was written (js-harness rules coverage --refresh)',
    'skill: 1 span of the register is in the source no more (js-harness rules coverage --refresh)',
  ]);
});

test('a refresh keeps each span where it stands, renames an edited owed one, drops what is gone, and adds no debt', () => {
  // An edit is judged by its place: the first entry of a stretch pairs with its first span, and the rest is gone.
  const text = 'Another owed sentence, edited. One owed sentence. A brand new sentence.';
  const entries = [spanId('Another owed sentence.'), spanId('A sentence that left.'), spanId('One owed sentence.')];
  const before = register({ sources: { skill: entries, gone: ['abcdefabcdef'] }, cases: ['incident-01-paid-eval', 'deleted-case'], messages: ['bin/guard.mjs', 'bin/gone.mjs'] });
  const report = coverageOf({ register: before, sources: [{ id: 'skill', from: 'install', text }], messages: ['bin/guard.mjs'], rules: RULES, cases: CASES, ...held });
  const after = refreshRegister(before, report);
  assert.deepEqual(after.sources, { skill: [spanId('Another owed sentence, edited.'), spanId('One owed sentence.')] });
  assert.deepEqual(report.sources[0].gaps.map((span) => span.text), ['A brand new sentence.'], 'a refresh adds no gap to the register');
  assert.deepEqual(after.cases, ['incident-01-paid-eval']);
  assert.deepEqual(after.messages, ['bin/guard.mjs']);
  assert.deepEqual(after.controls, before.controls);
  assert.equal(after.baseline, BASELINE);
});

test('the register is written in one shape, and a register of another shape is refused by name', () => {
  const text = writeCoverage(register());
  assert.ok(text.startsWith('// '), 'a header comment');
  assert.match(text, /^export const COVERAGE = \{\n/m);
  assert.deepEqual(registerFaults(register()), []);
  assert.deepEqual(registerFaults({ baseline: 'soon', controls: [], sources: { skill: [3] } }), [
    'the baseline is not a day written YYYY-MM-DD',
    'the controls are an object of rule ids',
    'the cases are a list of task names',
    'the messages are a list of paths',
    'skill: an entry is a hash of 12 hexadecimal characters, or { hash, context: <reason> }',
  ]);
});

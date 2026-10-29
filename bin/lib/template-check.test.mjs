// `template check`: a registered template lacks no part (odd/tasks/templates.md, "js-harness template", Done when).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { checkTemplates } from './template-check.mjs';

const SAMPLE = 'Pregunta 7: ¿Qué rama?\n';
const sha = (text) => createHash('sha256').update(text).digest('hex');

const MODULE = `// Template \`question\`: the questions to the user.
export function render(records) { return records.text; }
export function admit(call) { return { admitted: call.ok === true }; }
`;
const TESTS = `import { test } from 'node:test';
test('template:question golden', () => {});
test('template:question refuses a hand-made one', () => {});
`;

function entry(over = {}) {
  return {
    id: 'question',
    kind: 'rendered',
    surface: 'ask',
    plantilla: { what: 'the questions to the user', when: 'when a decision is his', looks: 'templates/question/sample.txt', where: 'the lead chat' },
    sample: { path: 'templates/question/sample.txt', sha256: sha(SAMPLE), source: '0f71b2c6:15262' },
    records: 'templates/question/records.json',
    render: 'js-harness notify --kind question',
    module: 'bin/lib/template-question.mjs',
    exports: { render: 'render', admit: 'admit' },
    tests: { file: 'bin/lib/template-question.test.mjs', golden: 'template:question golden', refusal: 'template:question refuses a hand-made one' },
    draft: false,
    ...over,
  };
}

function files(over = {}) {
  return {
    'templates/question/sample.txt': SAMPLE,
    'templates/question/records.json': '{}',
    'bin/lib/template-question.mjs': MODULE,
    'bin/lib/template-question.test.mjs': TESTS,
    ...over,
  };
}

const run = (entries, fileMap = files(), hooked = ['AskUserQuestion']) => checkTemplates(entries, {
  readFile: (rel) => (Object.hasOwn(fileMap, rel) && fileMap[rel] !== null ? fileMap[rel] : null),
  hooked: new Set(hooked),
});

const faultsOf = (result) => result.map(({ id, fault }) => `${id}: ${fault}`);

test('a template with every part present has no fault', () => {
  assert.deepEqual(run([entry()]), []);
});

test('an empty registry has no fault', () => {
  assert.deepEqual(run([]), []);
});

test('a sample checked out with CRLF is the sample he approved with LF', () => {
  const crlf = Buffer.from(SAMPLE.replace(/\n/g, '\r\n'));
  assert.notDeepEqual(crlf, Buffer.from(SAMPLE));
  assert.deepEqual(run([entry()], files({ 'templates/question/sample.txt': crlf })), []);
});

test('each entry that is not an object is a fault of its own, not a crash', () => {
  assert.deepEqual(faultsOf(run([null, 7])), ['(no id): the entry is not an object', '(no id): the entry is not an object']);
});

test('a title declared twice is skipped when either of its calls is', () => {
  const tests = `${TESTS}test.skip('template:question golden', () => {});\n`;
  assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.test.mjs': tests }))), ['question: bin/lib/template-question.test.mjs skips its test "template:question golden"']);
});

test('a title that also appears outside its test call does not hide the call\'s skip', () => {
  const tests = `import { test } from 'node:test';
// see 'template:question golden' below
test.skip('template:question golden', () => {});
test('template:question refuses a hand-made one', () => { assert.ok(true, \`template:question golden\`); });
`;
  assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.test.mjs': tests }))), ['question: bin/lib/template-question.test.mjs skips its test "template:question golden"']);
});

test('a title that appears only as a string, in no test call, is no test', () => {
  const tests = `import { test } from 'node:test';
const named = 'template:question golden';
test('template:question refuses a hand-made one', () => {});
`;
  assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.test.mjs': tests }))), ['question: bin/lib/template-question.test.mjs has no test titled "template:question golden"']);
});

test('a part missing from the disk is named: the sample, the records, the module, the test file', () => {
  for (const missing of ['templates/question/sample.txt', 'templates/question/records.json', 'bin/lib/template-question.mjs', 'bin/lib/template-question.test.mjs']) {
    const faults = faultsOf(run([entry()], files({ [missing]: null })));
    assert.equal(faults.length, 1, missing);
    assert.match(faults[0], new RegExp(`question: .*${missing.replace(/\./g, '\\.')}`));
  }
});

test('a field missing from the entry is named, the first his Plantilla line gives first', () => {
  assert.deepEqual(faultsOf(run([entry({ plantilla: { what: 'x', when: 'y', looks: 'z' } })])), ['question: the entry lacks plantilla.where']);
  assert.deepEqual(faultsOf(run([entry({ sample: { path: 'templates/question/sample.txt', sha256: sha(SAMPLE) } })])), ['question: the entry lacks sample.source']);
  assert.deepEqual(faultsOf(run([entry({ tests: { file: 'bin/lib/template-question.test.mjs', golden: 'template:question golden' } })])), ['question: the entry lacks tests.refusal']);
});

test('a draft is a fault: it is finished or removed in the commit that adds it', () => {
  assert.deepEqual(faultsOf(run([entry({ draft: true })])), ['question: a draft (template new wrote it): finish its renderer, its gate and its tests, then set draft to false']);
});

test('a sample whose bytes are not the ones he approved is a fault', () => {
  assert.deepEqual(faultsOf(run([entry()], files({ 'templates/question/sample.txt': 'Pregunta 7: ¿Qué rama? (cambiada)\n' }))),
    ['question: templates/question/sample.txt is not the sample he approved: its sha256 differs from sample.sha256; a new sample needs a new digest and his words in sample.source']);
});

test('a module that lacks a named export, or still throws the scaffold body, is a fault', () => {
  const noAdmit = MODULE.replace('export function admit', 'function admit');
  assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.mjs': noAdmit }))), ['question: bin/lib/template-question.mjs exports no admit']);
  const scaffold = `${MODULE}export function other() { throw new Error('template question: not built yet'); }\n`;
  assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.mjs': scaffold }))), ['question: bin/lib/template-question.mjs still holds the scaffold body ("not built yet")']);
});

test('exports by const, async function and an export list count', () => {
  const forms = 'export const render = (r) => r.text;\nasync function admit() {}\nexport { admit };\n';
  assert.deepEqual(run([entry()], files({ 'bin/lib/template-question.mjs': forms })), []);
});

test('a test title missing, or skipped, or a todo, is a fault', () => {
  const noRefusal = TESTS.replace("test('template:question refuses a hand-made one', () => {});\n", '');
  assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.test.mjs': noRefusal }))), ['question: bin/lib/template-question.test.mjs has no test titled "template:question refuses a hand-made one"']);
  for (const skipped of [
    TESTS.replace("test('template:question golden'", "test.skip('template:question golden'"),
    TESTS.replace("test('template:question golden', ()", "test('template:question golden', { skip: true }, ()"),
    TESTS.replace("test('template:question golden'", "test.todo('template:question golden'"),
    TESTS.replace("test('template:question golden', ()", "test(\n  'template:question golden',\n  { skip: 'later' },\n  ()"),
    TESTS.replace("test('template:question golden'", "test.skip(\n  'template:question golden'"),
  ]) {
    assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.test.mjs': skipped }))), ['question: bin/lib/template-question.test.mjs skips its test "template:question golden"']);
  }
});

test('a test whose skip or todo option is false runs, so it is no fault', () => {
  for (const runs of [
    TESTS.replace("test('template:question golden', ()", "test('template:question golden', { skip: false }, ()"),
    TESTS.replace("test('template:question golden', ()", "test('template:question golden', { todo:false, timeout: 5 }, ()"),
  ]) {
    assert.deepEqual(run([entry()], files({ 'bin/lib/template-question.test.mjs': runs })), []);
  }
});

test('a surface no installed hook reaches is a fault; stop and command surfaces need none', () => {
  assert.deepEqual(faultsOf(run([entry()], files(), [])), ['question: no hook entry of this harness watches AskUserQuestion, the tool of its surface ask']);
  assert.deepEqual(run([entry({ surface: 'stop' })], files(), []), []);
  assert.deepEqual(run([entry({ surface: 'command:notify' })], files(), []), []);
  assert.deepEqual(faultsOf(run([entry({ surface: 'mail' })])), ['question: its surface "mail" is none of page, board, ask, stop or command:<name>']);
});

test('a kind other than rendered or shape is a fault, and a shape template needs no records', () => {
  assert.deepEqual(faultsOf(run([entry({ kind: 'drawn' })])), ['question: its kind "drawn" is neither rendered nor shape']);
  const { records, ...shape } = entry({ kind: 'shape', surface: 'stop' });
  assert.equal(records, 'templates/question/records.json');
  assert.deepEqual(run([shape], files({ 'templates/question/records.json': null }), []), []);
});

test('two entries with one id, or one signature, are a fault', () => {
  const page = (id) => entry({ id, surface: 'page', signature: 'data-js-harness-template="stretch-return"', tests: { file: 'bin/lib/template-question.test.mjs', golden: `template:${id} golden`, refusal: `template:${id} refuses a hand-made one` } });
  const both = TESTS.replace(/question/g, 'a') + TESTS.replace(/question/g, 'b');
  const result = faultsOf(run([page('a'), page('b')], files({ 'bin/lib/template-question.test.mjs': both }), ['Artifact', 'mcp__visualize__show_widget']));
  assert.deepEqual(result, ['b: its signature is also template a\'s']);
  assert.deepEqual(faultsOf(run([entry(), entry()])), ['question: the id is registered twice']);
});

test('a required test that is only in a comment is no test', () => {
  const commented = [
    `// test('template:question golden', () => {});\ntest('template:question refuses a hand-made one', () => {});\n`,
    `/* test('template:question golden', () => {}); */\ntest('template:question refuses a hand-made one', () => {});\n`,
    `/*\n * test('template:question golden', () => {});\n */\ntest('template:question refuses a hand-made one', () => {});\n`,
  ];
  for (const text of commented) {
    assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.test.mjs': text }))), ['question: bin/lib/template-question.test.mjs has no test titled "template:question golden"'], text);
  }
  const quoted = `const url = 'https://example.test/a'; test('template:question golden', () => {});\ntest('template:question refuses a hand-made one', () => { const glob = '/*'; });\n`;
  assert.deepEqual(run([entry()], files({ 'bin/lib/template-question.test.mjs': quoted })), [], 'a // or /* inside a string is no comment');
});

test('a test call quoted inside a string, as a fixture, is no declaration: neither its test nor its skip', () => {
  const fixture = `const skipped = "test.skip('template:question golden', () => {})";\n${TESTS}`;
  assert.deepEqual(run([entry()], files({ 'bin/lib/template-question.test.mjs': fixture })), [], 'the quoted skip is no skip of the real test');
  const only = `const fixture = \`test('template:question golden', () => {});\`;\ntest('template:question refuses a hand-made one', () => {});\n`;
  assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.test.mjs': only }))), ['question: bin/lib/template-question.test.mjs has no test titled "template:question golden"']);
});

test('a quote inside a regular expression or a nested template literal does not turn a commented test into a declared one', () => {
  const golden = `test('template:question golden', () => {});`;
  const refusal = `test('template:question refuses a hand-made one', () => {});`;
  const missing = ['question: bin/lib/template-question.test.mjs has no test titled "template:question golden"'];
  const shapes = [
    `const quotes = /['"]/;\n// ${golden}\n${refusal}\n`,
    `const s = /[/']/g.test(x) ? 1 : 2;\n/* ${golden} */\n${refusal}\n`,
    `const t = \`a \${\`it's \${b}\`} c\`;\n// ${golden}\n${refusal}\n`,
  ];
  for (const text of shapes) assert.deepEqual(faultsOf(run([entry()], files({ 'bin/lib/template-question.test.mjs': text }))), missing, text);
  const declared = [
    `const quotes = /['"]/;\n${golden}\n${refusal}\n`,
    `const half = total / 2; const rest = 'x' / 1;\n${golden}\n${refusal}\n`,
    `const t = \`a \${{ k: '}' }.k} c\`;\n${golden}\n${refusal}\n`,
  ];
  for (const text of declared) assert.deepEqual(run([entry()], files({ 'bin/lib/template-question.test.mjs': text })), [], text);
});

test('an entry with no id, or an id that is not a name, is a fault and never stands for another', () => {
  const { id, ...noId } = entry();
  assert.deepEqual(faultsOf(run([noId])), ['(no id): the entry lacks id']);
  assert.deepEqual(faultsOf(run([entry({ id: '' }), entry({ id: 7 })])), ['(no id): the entry lacks id', '(no id): the entry lacks id']);
});

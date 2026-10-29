// `js-harness template`: new, check and list (odd/tasks/templates.md, T3). The first test is what runs
// `template check` on every commit: the gate's tests sensor runs this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { templateMain } from './template.mjs';
import { registryOfText, writeRegistry } from './lib/template.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'bin/lib/template-registry.mjs';

function call(argv, options = {}) {
  const out = [];
  const err = [];
  const code = templateMain(argv, { stdout: (line) => out.push(line), stderr: (line) => err.push(line), ...options });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

/** A scratch root shaped like this repository: an empty registry, and a sample file outside it. */
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-template-'));
  fs.mkdirSync(path.join(root, 'bin', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, REGISTRY), writeRegistry([]));
  const sample = path.join(root, 'approved.html');
  fs.writeFileSync(sample, '<p>Pregunta 7: ¿Qué rama?</p>\n');
  return { root, sample, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const NEW = (sample) => ['new', 'question', '--what', 'the questions to the user', '--when', 'when a decision is the user\'s', '--sample', sample, '--where', 'the lead chat', '--source', '0f71b2c6:15262', '--surface', 'ask'];

test('this repository\'s registry passes template check', () => {
  const { code, out, err } = call(['check'], { root: REPO });
  assert.equal(code, 0, `${out}\n${err}`);
  assert.match(out, /^templates: \d+ registered, every part present$/);
});

test('new writes the five parts and a draft entry, and check then fails on that draft until it is finished', (t) => {
  const { root, sample, done } = scratch();
  t.after(done);
  const made = call(NEW(sample), { root });
  assert.equal(made.code, 0, made.err);
  for (const file of ['templates/question/sample.html', 'templates/question/records.json', 'bin/lib/template-question.mjs', 'bin/lib/template-question.test.mjs']) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
    assert.match(made.out, new RegExp(file.replace(/\./g, '\\.')));
  }
  const list = registryOfText(fs.readFileSync(path.join(root, REGISTRY), 'utf8'));
  assert.deepEqual(list.map((entry) => [entry.id, entry.draft]), [['question', true]]);
  const checked = call(['check'], { root, hooked: new Set(['AskUserQuestion']) });
  assert.equal(checked.code, 1);
  assert.match(checked.out, /^template question: a draft/m);
  assert.match(checked.out, /^template question: .*still holds the scaffold body/m);
});

test('new names only the first field missing, as a usage error, and writes nothing', (t) => {
  const { root, sample, done } = scratch();
  t.after(done);
  const argv = NEW(sample).filter((token, i, all) => token !== '--when' && all[i - 1] !== '--when' && token !== '--where' && all[i - 1] !== '--where');
  const { code, err } = call(argv, { root });
  assert.equal(code, 2);
  assert.match(err, /^template new: missing --when: cuándo aparece/);
  assert.doesNotMatch(err, /--where:/);
  assert.ok(!fs.existsSync(path.join(root, 'templates')));
});

test('new writes over nothing: a second new of the same id is refused and leaves the first as it was', (t) => {
  const { root, sample, done } = scratch();
  t.after(done);
  assert.equal(call(NEW(sample), { root }).code, 0);
  const before = fs.readFileSync(path.join(root, REGISTRY), 'utf8');
  const again = call(NEW(sample), { root });
  assert.equal(again.code, 1);
  assert.match(again.err, /already/);
  assert.equal(fs.readFileSync(path.join(root, REGISTRY), 'utf8'), before);
});

test('new writes over nothing: a part\'s file already there with no entry is refused, and nothing is written', (t) => {
  const { root, sample, done } = scratch();
  t.after(done);
  fs.writeFileSync(path.join(root, 'bin', 'lib', 'template-question.mjs'), 'export const kept = 1;\n');
  const before = fs.readFileSync(path.join(root, REGISTRY), 'utf8');
  const refused = call(NEW(sample), { root });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /bin\/lib\/template-question\.mjs already exist/);
  assert.equal(fs.readFileSync(path.join(root, 'bin', 'lib', 'template-question.mjs'), 'utf8'), 'export const kept = 1;\n');
  assert.equal(fs.readFileSync(path.join(root, REGISTRY), 'utf8'), before);
  assert.ok(!fs.existsSync(path.join(root, 'templates')));
});

test('new refuses a flag given twice or with no value, as a usage error', (t) => {
  const { root, sample, done } = scratch();
  t.after(done);
  const twice = call([...NEW(sample), '--what', 'again'], { root });
  assert.equal(twice.code, 2);
  assert.match(twice.err, /^--what was given twice/);
  const bare = call(['new', 'question', '--what'], { root });
  assert.equal(bare.code, 2);
  assert.match(bare.err, /^--what requires a value/);
});

test('new reads a relative sample from the folder it is given, not the process\'s', (t) => {
  const { root, done } = scratch();
  t.after(done);
  const folder = path.join(root, 'drafts');
  fs.mkdirSync(folder);
  fs.renameSync(path.join(root, 'approved.html'), path.join(folder, 'approved.html'));
  const made = call(NEW('approved.html'), { root, cwd: folder });
  assert.equal(made.code, 0, made.err);
  assert.ok(fs.existsSync(path.join(root, 'templates', 'question', 'sample.html')));
  assert.equal(call(NEW('approved.html').map((token) => (token === 'question' ? 'other' : token)), { root, cwd: root }).code, 1);
});

test('new refuses a sample it cannot read', (t) => {
  const { root, done } = scratch();
  t.after(done);
  const { code, err } = call(NEW(path.join(root, 'nowhere.html')), { root });
  assert.equal(code, 1);
  assert.match(err, /cannot read the sample/);
});

test('list prints one row a template, and --json the entries', (t) => {
  const { root, sample, done } = scratch();
  t.after(done);
  call(NEW(sample), { root });
  const rows = call(['list'], { root });
  assert.equal(rows.code, 0);
  assert.match(rows.out, /^question\s+rendered\s+ask\s+draft\s+the questions to the user$/m);
  const json = call(['list', '--json'], { root });
  assert.deepEqual(JSON.parse(json.out).map((entry) => entry.id), ['question']);
});

test('a bad command line is a usage error: exit 2, the unknown token named', () => {
  for (const [argv, said] of [[[], /a subcommand is required/], [['--no-such-flag'], /^unknown argument: --no-such-flag/], [['check', '--x'], /^unknown argument: --x/], [['list', 'more'], /^unknown argument: more/], [['new'], /an id/]]) {
    const { code, err } = call(argv, { root: REPO });
    assert.equal(code, 2, JSON.stringify(argv));
    assert.match(err, said, JSON.stringify(argv));
  }
});

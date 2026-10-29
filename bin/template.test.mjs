// `js-harness template`: new, check and list (odd/tasks/templates.md, T3). The first test is what runs
// `template check` on every commit: the gate's tests sensor runs this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryLock, templateMain, templatesHealth } from './template.mjs';
import { registryOfText, writeRegistry } from './lib/template.mjs';
import { SHOWN_SCHEMA, readRecord, recordRendered, renderedFile, shownFile } from './lib/template-record.mjs';
import { appendNotice, newNotice, recordPath } from './lib/channel.mjs';

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

test('template new refuses while another holds the registry, so two at once cannot lose an entry, and frees it after', (t) => {
  const { root, sample, done } = scratch();
  t.after(done);
  const lock = registryLock(root);
  fs.writeFileSync(lock, 'held');
  try {
    const held = call(NEW(sample), { root });
    assert.equal(held.code, 1);
    assert.match(held.err, /another template new holds the registry/);
    assert.ok(held.err.includes(lock), held.err);
    assert.equal(fs.existsSync(path.join(root, 'bin', 'lib', 'template-question.mjs')), false, 'it wrote nothing');
  } finally {
    fs.rmSync(lock, { force: true });
  }
  assert.equal(call(NEW(sample), { root }).code, 0);
  assert.equal(fs.existsSync(lock), false, 'the lock goes with the run');
  assert.equal(call(NEW(sample).map((arg) => (arg === 'question' ? 'answer' : arg)), { root }).code, 0);
  assert.deepEqual(registryOfText(fs.readFileSync(path.join(root, REGISTRY), 'utf8')).map((entry) => entry.id), ['answer', 'question']);
});

// `template gate --hook` and `--shown` (T4): the page surface through the command, with the seams a hook needs.
const PAGE_TEMPLATES = [{ id: 'stretch-return', surface: 'page', render: 'js-harness stretch close --html', signature: 'jh-moment' }];
const GATE_NOW = Date.parse('2026-10-29T06:00:00.000Z');

/** A scratch project whose harness.json turns the gate on (or not), a home, and a hook call into it. */
function gateScratch({ on = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-gate-'));
  const home = path.join(root, 'home');
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify(on ? { templates: true } : {}));
  const hook = (mode, payload) => call(['gate', mode], {
    root, home, slug: 'p', now: GATE_NOW, templates: PAGE_TEMPLATES,
    readStdin: () => (typeof payload === 'string' ? payload : JSON.stringify({ cwd: root, session_id: 's1', ...payload })),
  });
  return { root, home, hook, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const shownLines = (home) => readRecord(shownFile(home, 'p'), SHOWN_SCHEMA);

test('gate --hook refuses a hand-made page by Artifact with the hooks contract\'s deny, and records the refusal', (t) => {
  const { root, home, hook, done } = gateScratch();
  t.after(done);
  fs.writeFileSync(path.join(root, 'page.html'), '<div class="jh-moment">Plan de 8 horas</div>');
  const { code, out } = hook('--hook', { hook_event_name: 'PreToolUse', tool_name: 'Artifact', tool_use_id: 'u1', tool_input: { file_path: 'page.html' } });
  assert.equal(code, 0);
  const answer = JSON.parse(out);
  assert.equal(answer.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(answer.hookSpecificOutput.permissionDecisionReason, /^js-harness template gate: this page came from no template command/);
  assert.deepEqual(shownLines(home).map((line) => [line.call, line.decision, line.template]), [['u1', 'refused', 'stretch-return']]);
});

test('gate --hook admits a page a template command recorded, and --shown then records that it was shown', (t) => {
  const { root, home, hook, done } = gateScratch();
  t.after(done);
  const page = path.join(root, 'return.html');
  fs.writeFileSync(page, '<p class="jh-moment">Vuelves</p>\n');
  recordRendered(renderedFile(home, 'p'), { template: 'stretch-return', subject: 's-7', path: page, at: '2026-10-29T05:30:00.000Z', head: 'abc' });
  const pre = hook('--hook', { hook_event_name: 'PreToolUse', tool_name: 'Artifact', tool_use_id: 'u2', tool_input: { file_path: page } });
  assert.equal(pre.out, '{}');
  const post = hook('--shown', { hook_event_name: 'PostToolUse', tool_name: 'Artifact', tool_use_id: 'u2', tool_input: { file_path: page } });
  assert.equal(post.out, '{}');
  assert.deepEqual(shownLines(home).map((line) => [line.call, line.decision, line.template, line.subject]), [['u2', 'admitted', 'stretch-return', 's-7'], ['u2', 'shown', 'stretch-return', 's-7']]);
});

test('gate --hook refuses the retyped widget, and --shown writes nothing for a refused call', (t) => {
  const { home, hook, done } = gateScratch();
  t.after(done);
  const widget = { hook_event_name: 'PreToolUse', tool_name: 'mcp__visualize__show_widget', tool_use_id: 'u3', tool_input: { title: 't', widget_code: '<div class="jh-moment">x</div>' } };
  assert.equal(JSON.parse(hook('--hook', widget).out).hookSpecificOutput.permissionDecision, 'deny');
  hook('--shown', { ...widget, hook_event_name: 'PostToolUse' });
  assert.deepEqual(shownLines(home).map((line) => line.decision), ['refused']);
});

test('gate --hook does nothing where harness.json does not turn templates on, for a call that shows no page, or for input that is no payload', (t) => {
  const off = gateScratch({ on: false });
  t.after(off.done);
  fs.writeFileSync(path.join(off.root, 'page.html'), '<p>hecho a mano</p>');
  assert.equal(off.hook('--hook', { tool_name: 'Artifact', tool_use_id: 'u4', tool_input: { file_path: 'page.html' } }).out, '{}');
  assert.equal(fs.existsSync(shownFile(off.home, 'p')), false);
  const on = gateScratch();
  t.after(on.done);
  for (const payload of [{ tool_name: 'Artifact', tool_input: { action: 'read', url: 'u' } }, { tool_name: 'ArtifactData', tool_input: { action: 'set' } }, 'not json']) {
    const { code, out } = on.hook('--hook', payload);
    assert.equal(code, 0);
    assert.equal(out, '{}');
  }
  assert.equal(fs.existsSync(shownFile(on.home, 'p')), false);
});

test('gate --hook reads the nearest harness.json at or above the payload\'s folder, and answers {} where it does not turn templates on', (t) => {
  const { root, home, done } = gateScratch();
  t.after(done);
  const nested = path.join(root, 'docs', 'pages');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, 'page.html'), '<p>hecho a mano</p>');
  const hook = (cwd) => call(['gate', '--hook'], { home, slug: 'p', now: GATE_NOW, templates: PAGE_TEMPLATES, readStdin: () => JSON.stringify({ cwd, tool_name: 'Artifact', tool_use_id: 'u9', tool_input: { file_path: 'page.html' } }) });
  assert.equal(JSON.parse(hook(nested).out).hookSpecificOutput.permissionDecision, 'deny');
  const off = gateScratch({ on: false });
  t.after(off.done);
  fs.writeFileSync(path.join(off.root, 'page.html'), '<p>x</p>');
  assert.equal(hook(off.root).out, '{}');
  assert.equal(fs.existsSync(shownFile(home, 'p')), true, 'the nested page was recorded');
});

test('gate --hook lets a page through as unchecked when it cannot read the page, and says why on stderr', (t) => {
  const { home, hook, done } = gateScratch();
  t.after(done);
  const { out, err } = hook('--hook', { tool_name: 'Artifact', tool_use_id: 'u5', tool_input: { file_path: 'missing.html' } });
  assert.equal(out, '{}');
  assert.match(err, /js-harness template gate: .*missing\.html.*unchecked/);
  assert.deepEqual(shownLines(home).map((line) => line.decision), ['unchecked']);
});

test('gate --hook admits a recorded page whose bytes are not UTF-8: it hashes the bytes, as the record does', (t) => {
  const { root, home, hook, done } = gateScratch();
  t.after(done);
  const page = path.join(root, 'latin1.html');
  fs.writeFileSync(page, Buffer.from([0x3c, 0x70, 0x3e, 0xe9, 0x3c, 0x2f, 0x70, 0x3e]));
  recordRendered(renderedFile(home, 'p'), { template: 'stretch-return', subject: 's-8', path: page, at: '2026-10-29T05:30:00.000Z', head: 'abc' });
  assert.equal(hook('--hook', { tool_name: 'Artifact', tool_use_id: 'u10', tool_input: { file_path: page } }).out, '{}');
  assert.deepEqual(shownLines(home).map((line) => line.decision), ['admitted']);
});

test('gate --hook reads the registry inside its boundary: one that does not load lets the call through and says so', (t) => {
  const { root, home, done } = gateScratch();
  t.after(done);
  fs.writeFileSync(path.join(root, 'page.html'), '<p>hecho a mano</p>');
  const broken = path.join(root, 'package');
  fs.mkdirSync(path.join(broken, 'bin', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(broken, REGISTRY), 'export const TEMPLATES = [{ not json };\n');
  const { code, out, err } = call(['gate', '--hook'], { root, home, slug: 'p', now: GATE_NOW, registryRoot: broken, readStdin: () => JSON.stringify({ cwd: root, tool_name: 'Artifact', tool_use_id: 'u11', tool_input: { file_path: 'page.html' } }) });
  assert.equal(code, 0);
  assert.equal(out, '{}');
  assert.match(err, /js-harness template gate: the registry does not parse.*unchecked/);
  const ours = call(['gate', '--hook'], { root, home, slug: 'p', now: GATE_NOW, readStdin: () => JSON.stringify({ cwd: root, tool_name: 'Artifact', tool_use_id: 'u12', tool_input: { file_path: 'page.html' } }) });
  assert.equal(JSON.parse(ours.out).hookSpecificOutput.permissionDecision, 'deny', 'with no seam it reads this package\'s registry');
});

test('a harness.json it cannot read is no opt-out: the gate records the call as unchecked and says why, and doctor\'s row cannot tell', (t) => {
  const { root, home, hook, done } = gateScratch();
  t.after(done);
  fs.writeFileSync(path.join(root, 'harness.json'), '{ "templates": tru');
  fs.writeFileSync(path.join(root, 'page.html'), '<p>hecho a mano</p>');
  const { out, err } = hook('--hook', { tool_name: 'Artifact', tool_use_id: 'u13', tool_input: { file_path: 'page.html' } });
  assert.equal(out, '{}');
  assert.match(err, /js-harness template gate: .*harness\.json.*unchecked/);
  assert.deepEqual(shownLines(home).map((line) => [line.call, line.decision]), [['u13', 'unchecked']]);
  const after = hook('--shown', { tool_name: 'Artifact', tool_use_id: 'u13', tool_input: { file_path: 'page.html' } });
  assert.equal(after.err, '', '--shown says nothing of its own: --hook said it');
  assert.deepEqual(shownLines(home).map((line) => [line.call, line.decision]), [['u13', 'unchecked'], ['u13', 'shown']], 'one unchecked line a call, then the shown one');
  assert.throws(() => templatesHealth(root, home, { now: GATE_NOW, slug: 'p' }), /harness\.json/);
});

// The `ask` surface (T5): a call of the question tool, against the questions of the channel's record.
const ASKER = { host: 'claude-code', id: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'environment', title: 'JH 80', permissionMode: 'auto' };
const ASK_OPTIONS = [{ label: 'Sí (Recomendada)', description: 'lo que cubre' }, { label: 'No', description: 'lo otro' }];
const recordQuestion = (home, text, options = ASK_OPTIONS) => appendNotice(home, 'p', newNotice({ at: '2026-10-29T05:00:00.000Z', from: ASKER, to: 'orchestrator', kind: 'question', text, id: `id ${text}`, options, waits: 'slice C' }));
const asking = (call, input) => ({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_use_id: call, tool_input: input });

test('gate --hook admits a question asked with the input template ask prints, and --shown records it shown', (t) => {
  const { home, hook, done } = gateScratch();
  t.after(done);
  recordQuestion(home, '¿Seguimos con el tramo C?');
  const printed = call(['ask', '1'], { home, slug: 'p' });
  assert.equal(printed.code, 0);
  const input = JSON.parse(printed.out);
  assert.equal(input.questions[0].question, 'Pregunta 1: ¿Seguimos con el tramo C?');
  assert.equal(hook('--hook', asking('q1', input)).out, '{}');
  hook('--shown', { ...asking('q1', input), hook_event_name: 'PostToolUse' });
  assert.deepEqual(shownLines(home).map((line) => [line.call, line.decision, line.template, line.subject]), [['q1', 'admitted', 'question', '1'], ['q1', 'shown', 'question', '1']]);
});

test('gate --hook refuses a question typed by hand, or with options not its own, naming notify --kind question and template ask', (t) => {
  const { home, hook, done } = gateScratch();
  t.after(done);
  recordQuestion(home, '¿Seguimos con el tramo C?');
  const typed = JSON.parse(hook('--hook', asking('q2', { questions: [{ question: '¿Seguimos con el tramo C?', header: 'Tramo C', multiSelect: false, options: ASK_OPTIONS }] })).out);
  assert.equal(typed.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(typed.hookSpecificOutput.permissionDecisionReason, /does not open with "Pregunta <n>: ".*js-harness notify --to orchestrator --kind question, then ask it with the input js-harness template ask <n> prints/);
  const other = JSON.parse(hook('--hook', asking('q3', { questions: [{ question: 'Pregunta 1: ¿Seguimos con el tramo C?', header: 'Pregunta 1', multiSelect: false, options: [{ label: 'Sí', description: '' }, { label: 'No', description: '' }] }] })).out);
  assert.match(other.hookSpecificOutput.permissionDecisionReason, /its options are not question 1's as recorded.*template ask 1 prints/);
  assert.deepEqual(shownLines(home).map((line) => [line.call, line.decision, line.subject]), [['q2', 'refused', null], ['q3', 'refused', '1']]);
});

test('gate --hook lets a question through as unchecked when it cannot read the channel\'s record, and says why', (t) => {
  const { home, hook, done } = gateScratch();
  t.after(done);
  fs.mkdirSync(recordPath(home, 'p'), { recursive: true });
  const { out, err } = hook('--hook', asking('q4', { questions: [{ question: 'Pregunta 1: ¿Seguimos?', options: ASK_OPTIONS }] }));
  assert.equal(out, '{}');
  assert.match(err, /js-harness template gate: cannot read .*p\.jsonl.*unchecked/);
  assert.deepEqual(shownLines(home).map((line) => [line.call, line.decision]), [['q4', 'unchecked']]);
});

test('template ask exits 1 for a question the record does not hold open or the question tool cannot show, and 2 with no number', (t) => {
  const { home, done } = gateScratch();
  t.after(done);
  recordQuestion(home, '¿Primera?');
  recordQuestion(home, '¿Cinco opciones?', ['a', 'b', 'c', 'd', 'e'].map((label) => ({ label, description: '' })));
  appendNotice(home, 'p', newNotice({ at: '2026-10-29T05:10:00.000Z', from: ASKER, to: 'orchestrator', kind: 'withdrawn', text: 'ya no', question: 1 }));
  const ask = (n) => call(['ask', ...n], { home, slug: 'p' });
  assert.deepEqual([ask(['1']).code, ask(['1']).err], [1, 'template ask: question 1 is withdrawn']);
  assert.match(ask(['2']).err, /question 2 has 5 options .* ask it in writing/);
  assert.deepEqual([ask(['3']).code, ask(['3']).err], [1, 'template ask: the record holds no question 3']);
  assert.equal(ask([]).code, 2);
  assert.equal(ask(['x']).code, 2);
});

test('shown reports each template\'s counts and free pages, exit 0, and 3 when a call went unchecked', (t) => {
  const { root, home, hook, done } = gateScratch();
  t.after(done);
  fs.writeFileSync(path.join(root, 'free.html'), '<meta name="js-harness-page" content="free: a research page on the gate, for him"><p>x</p>');
  hook('--hook', { tool_name: 'Artifact', tool_use_id: 'u6', tool_input: { file_path: 'free.html' } });
  hook('--shown', { tool_name: 'Artifact', tool_use_id: 'u6', tool_input: { file_path: 'free.html' } });
  const report = (argv) => call(argv, { root, home, slug: 'p', now: GATE_NOW });
  const clean = report(['shown', '--days', '7']);
  assert.equal(clean.code, 0, clean.err);
  assert.match(clean.out, /^templates: no escapes in 7 days$/m);
  assert.match(clean.out, /free: a research page on the gate, for him/);
  hook('--hook', { tool_name: 'Artifact', tool_use_id: 'u7', tool_input: { file_path: 'gone.html' } });
  const unknown = report(['shown']);
  assert.equal(unknown.code, 3);
  assert.match(unknown.out, /1 call unchecked/);
  assert.equal(JSON.parse(report(['shown', '--json']).out).unchecked, 1);
});

test('templatesHealth gives doctor the escapes and unchecked calls of seven days, and null where templates are off', (t) => {
  const { root, home, hook, done } = gateScratch();
  t.after(done);
  const health = (folder) => templatesHealth(folder, home, { now: GATE_NOW, slug: 'p' });
  hook('--hook', { tool_name: 'Artifact', tool_use_id: 'u8', tool_input: { file_path: 'gone.html' } });
  assert.deepEqual(health(root), { days: 7, escapes: [], unchecked: 1 });
  const off = gateScratch({ on: false });
  t.after(off.done);
  assert.equal(health(off.root), null);
});

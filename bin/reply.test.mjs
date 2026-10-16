import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { replyMain } from './reply.mjs';

// `js-harness reply --hook`, the Stop hook of C1 (odd/tasks/rule-hierarchy.md, T2). The files it reads are
// handed in, so no test touches a real project: `files` maps a path to its text, and a path it does not hold
// reads as missing.
const PROJECT = path.resolve('/work/project');
const SPANISH = { states: { working: 'Sigo solo', decision: 'Necesito tu decisión', cut: 'Corte', finished: 'Terminado' }, labels: { what: 'Qué es', where: 'Dónde', effect: 'Qué pasa' } };
const ON = { [path.join(PROJECT, 'harness.json')]: JSON.stringify({ documents: ['docs/'], reply: SPANISH }) };

async function hook(payload, { files = ON, argv = ['--hook'], raw } = {}) {
  const out = [];
  const err = [];
  const read = [];
  const code = await replyMain(argv, {
    readStdin: () => raw ?? JSON.stringify(payload),
    readFile: (file) => {
      read.push(file);
      if (Object.hasOwn(files, file)) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  });
  return { code, out: out.join(''), err: err.join(''), read };
}

const stopPayload = (message, extra = {}) => ({ hook_event_name: 'Stop', cwd: PROJECT, stop_hook_active: false, last_assistant_message: message, background_tasks: [], ...extra });
const PASS = '{}\n';

test('anything but --hook prints the usage and exits 2', async () => {
  for (const argv of [[], ['--stop'], ['--hook', 'extra'], ['check']]) {
    const result = await hook(null, { argv });
    assert.equal(result.code, 2, JSON.stringify(argv));
    assert.match(result.err, /Usage: js-harness reply --hook/);
    assert.equal(result.out, '');
  }
  const help = await hook(null, { argv: ['--help'] });
  assert.equal(help.code, 0);
  assert.match(help.out, /Usage: js-harness reply --hook/);
});

test('a reply that ends with no state is turned back with the hooks contract\'s block and its reason', async () => {
  const result = await hook(stopPayload('Merged pull request 12.'));
  assert.equal(result.code, 0);
  const answer = JSON.parse(result.out);
  assert.equal(answer.decision, 'block');
  assert.match(answer.reason, /no state/);
  assert.match(answer.reason, /Sigo solo/);
});

test('a reply that closes with its state lets the session stop: the answer is an empty JSON object, which both hosts read as go on', async () => {
  const result = await hook(stopPayload('Hecho.\n\n**Sigo solo** — espero el gate.'));
  assert.deepEqual([result.code, result.out, result.err], [0, PASS, '']);
});

test('a stop the hooks already turned back is let through without reading the project, so it cannot loop', async () => {
  const result = await hook(stopPayload('No state here.', { stop_hook_active: true }));
  assert.deepEqual([result.code, result.out, result.read], [0, PASS, []]);
});

test('it acts only where a harness.json above the folder holds a reply key', async () => {
  assert.equal((await hook(stopPayload('No state here.'), { files: {} })).out, PASS, 'no harness.json at all');
  const without = { [path.join(PROJECT, 'harness.json')]: JSON.stringify({ documents: ['docs/'] }) };
  assert.equal((await hook(stopPayload('No state here.'), { files: without })).out, PASS, 'a harness.json with no reply key');
  const deeper = await hook(stopPayload('No state here.', { cwd: path.join(PROJECT, 'bin', 'lib') }));
  assert.equal(JSON.parse(deeper.out).decision, 'block', 'the nearest harness.json above a subfolder');
  const nearest = { ...ON, [path.join(PROJECT, 'bin', 'harness.json')]: JSON.stringify({}) };
  assert.equal((await hook(stopPayload('No state here.', { cwd: path.join(PROJECT, 'bin') }), { files: nearest })).out, PASS, 'the nearest one decides, even with no key');
});

test('only running background tasks count against a decision', async () => {
  const decision = 'Hecho.\n\nNecesito tu decisión: el orquestador te la pregunta.';
  const running = await hook(stopPayload(decision, { background_tasks: [{ id: 'a', status: 'running' }, { id: 'b', status: 'completed' }] }));
  assert.match(JSON.parse(running.out).reason, /1 background task\b/);
  const done = await hook(stopPayload(decision, { background_tasks: [{ id: 'b', status: 'completed' }] }));
  assert.equal(done.out, PASS);
  assert.equal((await hook(stopPayload(decision, { background_tasks: undefined }))).out, PASS, 'Codex sends no background_tasks');
});

test('whatever it cannot read lets the session stop, and a reply key it cannot read is said on standard error', async () => {
  assert.deepEqual([(await hook(null, { raw: 'not json' })).out, (await hook(null, { raw: 'not json' })).code], [PASS, 0]);
  assert.equal((await hook(stopPayload(null))).out, PASS, 'Codex may send last_assistant_message null');
  const broken = await hook(stopPayload('x'), { files: { [path.join(PROJECT, 'harness.json')]: '{ broken' } });
  assert.equal(broken.out, PASS);
  assert.match(broken.err, /harness\.json is not JSON .*; the reply check did not run/, 'a broken harness.json is said, not skipped in silence');
  const bad = await hook(stopPayload('x'), { files: { [path.join(PROJECT, 'harness.json')]: JSON.stringify({ reply: 'yes' }) } });
  assert.equal(bad.out, PASS);
  assert.match(bad.err, /harness\.json "reply"/);
});

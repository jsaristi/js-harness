import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSensors } from './check.mjs';

// `harness.json` "exactTests": "shadow" (odd/tasks/exact-tests.md, T3, S6): a gate's tests sensor runs the
// whole suite under the tracer, its traces go under the git dir, and the end line of the gate log keeps what
// selection would have skipped and which of those failed, the count S6 is read from.

const PLACE = process.platform === 'win32' ? 'windows' : process.platform;

/** A repository of its own whose `test` script is `script`, with two test files and `harness` as its
 * harness.json; `gate()` runs its sensors as a gate does, in a turn, and answers its rows and its end line. */
function project({ script = 'node --test', harness = { exactTests: 'shadow' } } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exact-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exact-home-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: script } }));
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify(harness));
  for (const name of ['a.test.mjs', 'b.test.mjs']) fs.writeFileSync(path.join(root, name), "import { test } from 'node:test';\ntest('x', () => {});\n");
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
  const gate = async (at = root) => {
    const events = [];
    const rows = await checkSensors(at, { gateLog: { append: (_, event) => (events.push(event), { ok: true }) } }, { home, held: true, load: false });
    return { rows, end: events.find((event) => event.event === 'end') };
  };
  const traces = path.join(root, '.git', 'js-harness', 'traces');
  const done = () => [root, home].forEach((one) => fs.rmSync(one, { recursive: true, force: true }));
  return { root, gate, traces, done };
}

test('in shadow the gate traces its suite under the git dir and its end line keeps the counts', async () => {
  const { gate, traces, done } = project();
  try {
    const first = await gate();
    const tests = first.rows.find((row) => row.name === 'tests');
    assert.equal(tests.pass, true, tests.output);
    assert.match(tests.detail, /; shadow: 0 of 2 test files would have been skipped$/);
    assert.deepEqual(first.end.sensors[0].shadow, { files: 2, wouldSkip: 0, failedOfSkipped: [] });
    assert.equal(fs.readdirSync(path.join(traces, PLACE)).filter((name) => !name.startsWith('results-')).length, 2);
    const second = await gate();
    assert.deepEqual(second.end.sensors[0].shadow, { files: 2, wouldSkip: 2, failedOfSkipped: [] });
  } finally {
    done();
  }
});

// The result memory (odd/tasks/result-memory.md, T2): one store for every worktree of the repository.
test('the worktrees of a repository share one store of traces under its common git dir, and a worktree\'s own old folder goes', async () => {
  const { root, gate, traces, done } = project();
  const linked = `${root}-linked`;
  const git = (...args) => assert.equal(spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root }).status, 0, args.join(' '));
  try {
    // The checkout of the linked worktree writes the bytes the main one has, whatever this machine's autocrlf.
    git('config', 'core.autocrlf', 'false');
    git('add', '-A');
    git('commit', '-qm', 'tests');
    git('worktree', 'add', '-q', linked);
    // Where step 1 kept a linked worktree's traces: its own git dir.
    const old = path.join(root, '.git', 'worktrees', path.basename(linked), 'js-harness', 'traces');
    fs.mkdirSync(path.join(old, PLACE), { recursive: true });
    fs.writeFileSync(path.join(old, PLACE, 'a.test.mjs.json'), '{}');
    assert.deepEqual((await gate()).end.sensors[0].shadow, { files: 2, wouldSkip: 0, failedOfSkipped: [] });
    // The linked worktree, with the same content, knows both pass from the gate of the other.
    assert.deepEqual((await gate(linked)).end.sensors[0].shadow, { files: 2, wouldSkip: 2, failedOfSkipped: [] });
    assert.equal(fs.existsSync(old), false, 'the old folder of the linked worktree is removed');
    assert.equal(fs.readdirSync(path.join(traces, PLACE)).filter((name) => !name.startsWith('results-')).length, 2);
  } finally {
    fs.rmSync(linked, { recursive: true, force: true });
    done();
  }
});

test('a test script that is not plain node --test runs as it did, and the row says why there is no shadow', async () => {
  const { gate, traces, done } = project({ script: 'node --test --test-concurrency=1' });
  try {
    const { rows, end } = await gate();
    const tests = rows.find((row) => row.name === 'tests');
    assert.equal(tests.pass, true, tests.output);
    assert.match(tests.detail, /; harness\.json "exactTests" is "shadow", but the tests run by `node --test --test-concurrency=1`, not `node --test`: no shadow$/);
    assert.equal(end.sensors[0].shadow, undefined);
    assert.equal(fs.existsSync(traces), false);
  } finally {
    done();
  }
});

test('a project that says nothing of exactTests has no shadow, and a value other than "shadow" fails the gate', async () => {
  const quiet = project({ harness: {} });
  try {
    const { end } = await quiet.gate();
    assert.equal(end.sensors[0].shadow, undefined);
    assert.equal(fs.existsSync(quiet.traces), false);
  } finally {
    quiet.done();
  }
  const wrong = project({ harness: { exactTests: 'skip' } });
  try {
    const { rows } = await wrong.gate();
    assert.deepEqual(rows.map(({ name, pass, detail }) => ({ name, pass, detail })), [{ name: 'sensors', pass: false, detail: 'harness.json "exactTests" must be "shadow"; it is "skip"' }]);
  } finally {
    wrong.done();
  }
});

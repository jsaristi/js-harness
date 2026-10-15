import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkExactCount, checkSensors, s6Count } from './check.mjs';
import { appendGateEvent, GATE_LOG_VERSION } from './lib/gate-log.mjs';

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

test('a project that says nothing of exactTests has no shadow, and a value other than "shadow" or "skip" fails the gate', async () => {
  const quiet = project({ harness: {} });
  try {
    const { end } = await quiet.gate();
    assert.equal(end.sensors[0].shadow, undefined);
    assert.equal(fs.existsSync(quiet.traces), false);
  } finally {
    quiet.done();
  }
  const wrong = project({ harness: { exactTests: 'later' } });
  try {
    const { rows } = await wrong.gate();
    assert.deepEqual(rows.map(({ name, pass, detail }) => ({ name, pass, detail })), [{ name: 'sensors', pass: false, detail: 'harness.json "exactTests" must be "shadow" or "skip"; it is "later"' }]);
  } finally {
    wrong.done();
  }
});

// T4c: "skip", the switch: the tests sensor runs only selection's `run` files, and the end line says how many it
// skipped, never as a shadow, so S6's count never reads a gate that could not have seen a skipped file fail.
test('in skip mode a second gate runs only the changed file, and its end line has a skip and no shadow', async () => {
  const { root, gate, done } = project({ harness: { exactTests: 'skip' } });
  try {
    const first = await gate();
    const tests = first.rows.find((row) => row.name === 'tests');
    assert.equal(tests.pass, true, tests.output);
    assert.deepEqual(first.end.sensors[0].skip, { files: 2, skipped: 0 });
    fs.writeFileSync(path.join(root, 'b.test.mjs'), "import { test } from 'node:test';\ntest('y', () => {});\n");
    const second = await gate();
    assert.match(second.rows.find((row) => row.name === 'tests').detail, /^npm run test passed; exact tests: skipped 1 of 2 test files$/);
    assert.deepEqual(second.end.sensors[0].skip, { files: 2, skipped: 1 });
    assert.equal(second.end.sensors[0].shadow, undefined);
  } finally {
    done();
  }
});

test('a test script that is not plain node --test runs whole in skip mode, and the row says why there are no exact tests', async () => {
  const { gate, done } = project({ script: 'node --test --test-concurrency=1', harness: { exactTests: 'skip' } });
  try {
    const { rows, end } = await gate();
    assert.match(rows.find((row) => row.name === 'tests').detail, /; harness\.json "exactTests" is "skip", but the tests run by `node --test --test-concurrency=1`, not `node --test`: no exact tests$/);
    assert.equal(end.sensors[0].skip, undefined);
  } finally {
    done();
  }
});

// T4 (exact-tests.md L14): S6's count, as the lead adopted it: the counting gates (wouldSkip above 0) in a row
// since the last one where a file selection would have skipped failed; 30 of them switch the skip on.
const endOf = (at, shadow) => ({ v: GATE_LOG_VERSION, id: `gate-${at}`, event: 'end', at, seconds: 1, result: 'pass', sensors: [{ name: 'tests', pass: true, shadow }] });

test('S6 counts the gates in a row that would have skipped a file and saw none of those fail, since the last that did', () => {
  const events = [
    endOf('2026-10-15T01:00:00.000Z', { files: 4, wouldSkip: 3, failedOfSkipped: [] }),
    endOf('2026-10-15T02:00:00.000Z', { files: 4, wouldSkip: 3, failedOfSkipped: ['evals/suite.test.mjs'] }),
    endOf('2026-10-15T03:00:00.000Z', { files: 4, wouldSkip: 0, failedOfSkipped: [] }),
    endOf('2026-10-15T04:00:00.000Z', { files: 4, wouldSkip: 2, failedOfSkipped: [] }),
    { event: 'start', at: '2026-10-15T04:30:00.000Z' },
    endOf('2026-10-15T05:00:00.000Z', { files: 4, wouldSkip: 1, failedOfSkipped: [] }),
  ];
  assert.deepEqual(s6Count(events), { run: 2, last: { at: '2026-10-15T02:00:00.000Z', files: ['evals/suite.test.mjs'] } });
  // Read in the order the gates ended, whatever order the lines come in.
  assert.deepEqual(s6Count([...events].reverse()).run, 2);
  assert.deepEqual(s6Count([]), { run: 0, last: null });
});

test('S6 never counts a gate in skip mode: a file it skipped could not fail, so it proves nothing', () => {
  const skipped = (at) => ({ v: GATE_LOG_VERSION, id: `gate-${at}`, event: 'end', at, seconds: 1, result: 'pass', sensors: [{ name: 'tests', pass: true, skip: { files: 4, skipped: 3 } }] });
  const events = [
    endOf('2026-10-15T01:00:00.000Z', { files: 4, wouldSkip: 3, failedOfSkipped: [] }),
    skipped('2026-10-15T02:00:00.000Z'),
    skipped('2026-10-15T03:00:00.000Z'),
  ];
  assert.deepEqual(s6Count(events), { run: 1, last: null });
});

test('in skip mode the row says the skip is on and S6\'s count stopped at the switch', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exact-count-'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exact-count-root-'));
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({ exactTests: 'skip' }));
    assert.deepEqual(checkExactCount(root, home), [{ name: 'exact tests', pass: true, detail: 'skip: on since harness.json says so; S6\'s count stopped at the switch' }]);
  } finally {
    [home, root].forEach((one) => fs.rmSync(one, { recursive: true, force: true }));
  }
});

test('a project in shadow has a row that says S6\'s running count and informs only; one that says nothing of exactTests has none', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exact-count-'));
  try {
    for (const [at, failed] of [['2026-10-15T01:00:00.000Z', ['b.test.mjs']], ['2026-10-15T02:00:00.000Z', []], ['2026-10-15T03:00:00.000Z', []]]) {
      assert.deepEqual(appendGateEvent(home, endOf(at, { files: 2, wouldSkip: 1, failedOfSkipped: failed })), { ok: true });
    }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-exact-count-root-'));
    fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({ exactTests: 'shadow' }));
    const [row] = checkExactCount(root, home);
    assert.equal(row.name, 'exact tests');
    assert.equal(row.pass, true);
    assert.match(row.detail, /^S6: 2 of 30 gates in a row would have skipped a test file and saw none of those fail, since the gate of .+ where b\.test\.mjs failed; the skip is switched on at 30$/);
    fs.writeFileSync(path.join(root, 'harness.json'), '{}');
    assert.deepEqual(checkExactCount(root, home), []);
    fs.rmSync(root, { recursive: true, force: true });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

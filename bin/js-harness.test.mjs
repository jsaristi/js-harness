import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as dispatch } from './js-harness.mjs';

const dispatcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');

function run(args) {
  return spawnSync(process.execPath, [dispatcher, ...args], {
    encoding: 'utf8',
    env: { ...process.env, JS_HARNESS_CHECK_INNER: '1' },
  });
}

test('no args prints usage listing check and exits 0', () => {
  const result = run([]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /check/);
});

test('--help prints usage listing check and exits 0', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /check/);
});

test('unknown command exits 2', () => {
  const result = run(['bogus']);
  assert.equal(result.status, 2);
});

test('--help lists init, install, sync, uninstall, status, update, upgrade, doctor, progress and codex-review', () => {
  const result = run(['--help']);
  assert.match(result.stdout, /init/);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /sync/);
  assert.match(result.stdout, /uninstall/);
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /update/);
  assert.match(result.stdout, /upgrade/);
  assert.match(result.stdout, /doctor/);
  assert.match(result.stdout, /progress/);
  assert.match(result.stdout, /codex-review/);
});

// R3-dispatch-untested: the command is wired through the real dispatcher, not only importable.
test('codex-review without --base exits 2 with its usage through the dispatcher', () => {
  const result = run(['codex-review']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--base is required/);
  assert.match(result.stderr, /Usage: js-harness codex-review/);
});

// T3 (project-init): uninstall now covers two scopes — the usage line must say so, not just name
// the command (the assertion above already covered before this change, and would have kept passing
// even with the old, single-scope wording).
test('--help describes uninstall\'s two scopes (project vs. machine/--global)', () => {
  const result = run(['--help']);
  assert.match(result.stdout, /uninstall\s+Undo the project.*machine install.*--global.*outside a git repository/);
});

test('--help mentions the JS_HARNESS_HOME/SOURCE/PREFIX environment overrides', () => {
  const result = run(['--help']);
  assert.match(result.stdout, /JS_HARNESS_HOME/);
  assert.match(result.stdout, /JS_HARNESS_SOURCE/);
  assert.match(result.stdout, /JS_HARNESS_PREFIX/);
});

test('no args on a real TTY opens the TUI instead of printing help', async () => {
  const calls = [];
  const stdin = { isTTY: true };
  const stdout = { isTTY: true, write: () => {} };
  const tui = async (...args) => {
    calls.push(args);
    return 0;
  };

  const code = await dispatch([], { stdin, stdout, tui });

  assert.equal(code, 0);
  assert.equal(calls.length, 1);
});

test('--help prints usage even on a real TTY', async () => {
  const stdin = { isTTY: true };
  const stdout = { isTTY: true, write: () => {} };
  const tui = async () => {
    throw new Error('must not open the TUI for --help');
  };

  const code = await dispatch(['--help'], { stdin, stdout, tui });
  assert.equal(code, 0);
});

test('install dispatches to a temp home and exits 0', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-'));
  try {
    const result = run(['install', '--home', home]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /installed js-harness/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T2 (project-init): `.codegraph` pre-created means `init` never spawns a real `codegraph` binary
// here — same hermetic guarantee the doctor test below relies on, without needing a fake spawn
// across the process boundary this dispatcher test runs through.
test('init dispatches to a temp cwd/home and exits 0, hermetically (no real codegraph spawn)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-init-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-init-cwd-'));
  try {
    const gitInit = spawnSync('git', ['init'], { cwd, encoding: 'utf8' });
    assert.equal(gitInit.status, 0, `git init failed: ${gitInit.stderr}`);
    fs.mkdirSync(path.join(cwd, '.codegraph'), { recursive: true });

    const result = run(['init', '--home', home, '--cwd', cwd]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /wrote harness\.json/);
    assert.ok(fs.existsSync(path.join(cwd, 'harness.json')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// R3-002 (accepted T1 review follow-up): this must not depend on the host's real binaries or on
// network access (T2 adds a real latest-version fetch) — a temp `--home`, a temp `--cwd` outside
// any repo, and `--offline` keep it hermetic, while `--json` parsing to the six known ids is what
// actually proves dispatch reached `doctorMain`, not just that *something* printed.
test('doctor dispatches to a temp home and exits 0, hermetically (no host binaries or network)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-doctor-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-doctor-cwd-'));
  try {
    const result = run(['doctor', '--home', home, '--cwd', cwd, '--offline', '--json']);
    assert.equal(result.status, 0);
    const rows = JSON.parse(result.stdout);
    assert.deepEqual(
      rows.map((r) => r.id),
      ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex-plugin'],
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('progress dispatches to a temp cwd and exits 0, hermetically (never this repo\'s real docs)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-progress-cwd-'));
  try {
    fs.mkdirSync(path.join(cwd, 'odd', 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'odd', 'tasks', 'a-feature.md'), '# A feature\n- [x] T1\n', 'utf8');

    const result = run(['progress', '--cwd', cwd, '--json']);

    assert.equal(result.status, 0);
    const data = JSON.parse(result.stdout);
    assert.equal(data.roadmap, null);
    assert.deepEqual(data.features.map((f) => f.id), ['a-feature']);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('--help lists contract, and contract template dispatches through the real dispatcher', () => {
  assert.match(run(['--help']).stdout, /^ {2}contract /m);
  const result = run(['contract', 'template']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^## Goal$/m);
});

// A global install on macOS/Linux reaches the bin through a symlink; the entry guard must follow it.
test('runs when invoked through a linked directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-link-'));
  const link = path.join(dir, 'bin');
  try {
    fs.symlinkSync(path.dirname(dispatcher), link, 'junction');
    const result = spawnSync(process.execPath, [path.join(link, 'js-harness.mjs'), '--help'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: js-harness/);
  } finally {
    // Remove the link itself first so cleanup can never reach through it into bin/.
    if (fs.existsSync(link)) fs.unlinkSync(link);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// T4 (project-init): sync covers two scopes as well, and the usage line says so.
test('--help describes sync\'s two scopes (project vs. machine/--global)', () => {
  const result = run(['--help']);
  assert.match(result.stdout, /sync\s+.*project.*pin.*machine install.*--global.*outside a git repository/);
});

// T5 (project-init): status covers two scopes as well, and the usage line says so.
test('--help describes status\'s two scopes (project vs. machine/--global)', () => {
  const result = run(['--help']);
  assert.match(result.stdout, /status\s+.*project.*pin.*machine.*versions.*--global.*outside a git repository/);
});

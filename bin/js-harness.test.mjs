import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as dispatch } from './js-harness.mjs';

const dispatcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');

// The commands dispatched below run a real `git` (and one test runs `git init`), isolated the way
// `bin/lib/project.test.mjs` isolates its own: from the host's global and system config, and from a
// git hook. `run` hands `process.env` to the dispatcher, so the isolation reaches it too.
let configDir;
before(() => {
  // A git hook runs with GIT_DIR, GIT_INDEX_FILE and friends pointing at the repository being
  // committed; inherited here, `git init` would reinitialize that repository as a bare one and
  // `init` would write its manifest into that repository's git dir (a commit in a linked worktree
  // did both to D:\js-harness on 2026-10-04).
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
// The empty git config lives outside the repository, so it is removed with the suite.
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

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

test('run from the pre-commit hook of a linked worktree, this file leaves the repository being committed as it was', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-hook-'));
  const git = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  try {
    const outer = path.join(dir, 'outer');
    const linked = path.join(dir, 'linked');
    fs.mkdirSync(outer);
    git(outer, 'init', '--quiet');
    git(outer, '-c', 'user.name=js-harness test', '-c', 'user.email=js-harness-test@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'init');
    git(outer, 'worktree', 'add', '--quiet', '-b', 'linked', linked);
    const gitDir = git(linked, 'rev-parse', '--absolute-git-dir');
    const config = path.join(outer, '.git', 'config');
    const before = fs.readFileSync(config, 'utf8');

    // The one test of this file that makes a repository and initializes it, with what `git commit` hands that
    // hook and so every test under it: GIT_DIR and GIT_INDEX_FILE of the repository being committed.
    const env = { ...process.env, GIT_DIR: gitDir, GIT_INDEX_FILE: path.join(gitDir, 'index') };
    delete env.NODE_TEST_CONTEXT; // set under `node --test`: with it the inner runner would not run on its own
    const pattern = '^init dispatches to a temp cwd/home';
    const inner = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern', pattern, fileURLToPath(import.meta.url)], { cwd: linked, env, encoding: 'utf8' });

    assert.equal(fs.readFileSync(config, 'utf8'), before, 'the config of the repository being committed');
    assert.equal(fs.existsSync(path.join(gitDir, 'js-harness')), false, 'no project manifest was written into its git dir');
    assert.equal(inner.status, 0, inner.stdout + inner.stderr);
    assert.match(inner.stdout, /^# pass 1$/m, 'the inner run ran that one test');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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

test('--help lists remote, and remote without a subcommand exits 2 with its usage through the dispatcher', () => {
  assert.match(run(['--help']).stdout, /^ {2}remote\s+.*start.*stop.*status/m);
  assert.match(run(['--help']).stdout, /^ {2}remote\s+.*git repository/m, 'remote acts on any git repository, not only an initialized project');
  const result = run(['remote']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage: js-harness remote start\|stop\|status/);
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

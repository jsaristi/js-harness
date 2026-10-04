import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readServerState, remoteId, remoteMain } from './remote.mjs';
import { identifyProcesses } from './lib/process-tree.mjs';
import { createReaper } from './lib/process-tree.testkit.mjs';

const SELF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'remote.mjs');

const tmpDirs = [];
test.after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
function tempDir(prefix = 'js-harness-remote-cmd-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

// Every test here runs a real `git` (the fixture's `git init`, the command's own `rev-parse`), isolated the way
// `bin/lib/project.test.mjs` isolates its own: from the host's global and system config, and from a git hook.
test.before(() => {
  // A git hook runs with GIT_DIR, GIT_INDEX_FILE and friends pointing at the repository being committed;
  // inherited here, `git init` would not make the fixture: it reinitializes that repository, as a bare one (a
  // commit in a linked worktree left D:\js-harness without a work tree that way, on 2026-10-04).
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  process.env.GIT_CONFIG_GLOBAL = path.join(tempDir('js-harness-remote-gitconfig-'), 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});

/** A git repository and nothing else: no `harness.json`, so not a project js-harness initialized. `remote` acts
 * on any repository, and this is the one every test below uses unless it says otherwise. */
function makeProject(name = 'my-project') {
  const root = path.join(tempDir(), name);
  fs.mkdirSync(root);
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
  return root;
}

const CREATED = 1_760_000_000_000;

/** Everything `remoteMain` reaches outside itself, faked: `alive` maps a pid to its creation time, the one launch
 * gets pid 4242, and a kill ends a process only when it names it by pid and creation time. */
function fakeWorld({ alive = new Map(), claude = { path: 'C:\\bin\\claude.exe', shell: false }, platform = 'win32', kill } = {}) {
  const spawned = [];
  const killed = [];
  const out = [];
  const err = [];
  let resolved = 0;
  const deps = {
    platform,
    resolveClaude: () => {
      resolved += 1;
      return claude;
    },
    spawn: (command, args, options) => {
      const child = { pid: 4242, unrefed: false, unref() { this.unrefed = true; }, on() {}, once() {} };
      spawned.push({ command, args, options, child });
      alive.set(4242, CREATED + 5);
      return child;
    },
    identifyProcesses: (pids) => pids.filter((pid) => alive.has(pid)).map((pid) => ({ pid, createdAt: alive.get(pid) })),
    kill: kill ?? ((identity) => {
      killed.push(identity);
      if (alive.get(identity.pid) === identity.createdAt) alive.delete(identity.pid);
    }),
    log: (line) => out.push(String(line)),
    error: (line) => err.push(String(line)),
  };
  return {
    deps, spawned, killed, alive,
    out: () => out.join('\n'),
    err: () => err.join('\n'),
    resolved: () => resolved,
  };
}

const stateDir = (home) => path.join(home, '.js-harness', 'remote');
const statePath = (home, root) => path.join(stateDir(home), `${remoteId(root)}.json`);
const logPathOf = (home, root) => path.join(stateDir(home), `${remoteId(root)}.log`);
function writeState(home, root, state) {
  fs.mkdirSync(stateDir(home), { recursive: true });
  fs.writeFileSync(statePath(home, root), JSON.stringify({ root, name: path.basename(root), logPath: logPathOf(home, root), startedAtIso: new Date(state.startedAt).toISOString(), ...state }));
}
const readState = (home, root) => JSON.parse(fs.readFileSync(statePath(home, root), 'utf8'));

// ---- scope: the git repository the folder is in, initialized by js-harness or not -----------------------------------

test('every subcommand refuses outside a git repository, or in a folder that does not exist, and starts nothing', async () => {
  const notGit = tempDir();
  const missing = path.join(notGit, 'missing');
  const home = tempDir();
  for (const sub of ['start', 'status', 'stop']) {
    for (const [cwd, message] of [[notGit, /not inside a git repository/], [missing, /no such directory/]]) {
      const world = fakeWorld();
      const code = await remoteMain([sub, '--cwd', cwd, '--home', home], {}, world.deps);
      assert.equal(code, 1, `${sub} in ${cwd}`);
      assert.match(world.err(), message, world.err());
      assert.ok(world.err().includes(cwd), 'the refusal names the folder');
      assert.equal(world.spawned.length, 0);
      assert.equal(world.resolved(), 0, 'the CLI is not even looked for');
    }
  }
  assert.equal(fs.existsSync(stateDir(home)), false, 'and nothing is written');
});

test('a git repository js-harness never initialized is accepted: start, status and stop all act on it', async () => {
  const root = makeProject('plain-repo');
  assert.equal(fs.existsSync(path.join(root, 'harness.json')), false, 'the fixture has no harness.json');
  const home = tempDir();
  const world = fakeWorld();

  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.equal(world.err(), '');
  assert.equal(world.spawned.length, 1);
  assert.equal(world.spawned[0].options.cwd, root, 'the supervisor runs in the repository');
  assert.equal(readState(home, root).root, root);

  assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.match(world.out(), /^remote: running/m);
  assert.ok(world.out().includes(`project: ${root}`), world.out());

  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.deepEqual(world.killed, [{ pid: 4242, createdAt: CREATED + 5 }]);
  assert.equal(fs.existsSync(statePath(home, root)), false);
});

test('the root is the top level of the repository, from any folder inside it', async () => {
  const root = makeProject('top');
  const nested = path.join(root, 'packages', 'app');
  fs.mkdirSync(nested, { recursive: true });
  const home = tempDir();
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', nested, '--home', home], {}, world.deps), 0, world.err());
  assert.equal(world.spawned[0].options.cwd, root);
  assert.equal(readState(home, root).name, 'top', 'named after the repository, not the folder it was run from');
});

test('what js-harness left in the repository does not matter: an initialized project, a broken pin, a stale manifest', async () => {
  const initialized = makeProject('initialized');
  fs.writeFileSync(path.join(initialized, 'harness.json'), '{ "version": "1.0.0" }\n');
  const brokenPin = makeProject('broken-pin');
  fs.writeFileSync(path.join(brokenPin, 'harness.json'), '{ not json');
  const staleManifest = makeProject('stale-manifest');
  fs.mkdirSync(path.join(staleManifest, '.git', 'js-harness'));
  fs.writeFileSync(path.join(staleManifest, '.git', 'js-harness', 'manifest.json'), '{}\n');
  for (const root of [initialized, brokenPin, staleManifest]) {
    const world = fakeWorld();
    assert.equal(await remoteMain(['status', '--cwd', root, '--home', tempDir()], {}, world.deps), 0, world.err());
    assert.equal(world.err(), '', root);
    assert.ok(world.out().includes(`project: ${root}`), world.out());
  }
});

test('without --cwd it acts on the repository the current folder is in', async () => {
  const root = makeProject();
  const home = tempDir();
  const original = process.cwd();
  process.chdir(root);
  try {
    const world = fakeWorld();
    assert.equal(await remoteMain(['status', '--home', home], {}, world.deps), 0, world.err());
    assert.match(world.out(), /not running/);
  } finally {
    process.chdir(original);
  }
});

test('anywhere but Windows it refuses before starting anything: process identity is only read there', async () => {
  const root = makeProject();
  const world = fakeWorld({ platform: 'linux' });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', tempDir()], {}, world.deps), 1);
  assert.match(world.err(), /Windows/);
  assert.equal(world.spawned.length, 0);
});

// ---- run from a git hook ---------------------------------------------------------------------------------------------

test('run from the pre-commit hook of a linked worktree, this file leaves the repository being committed as it was', () => {
  const git = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  const outer = makeProject('outer');
  const linked = path.join(tempDir(), 'linked');
  git(outer, '-c', 'user.name=js-harness test', '-c', 'user.email=js-harness-test@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'init');
  git(outer, 'worktree', 'add', '--quiet', '-b', 'linked', linked);
  const gitDir = git(linked, 'rev-parse', '--absolute-git-dir');
  const config = path.join(outer, '.git', 'config');
  const before = fs.readFileSync(config, 'utf8');

  // One test of this file that makes a fixture repository and runs the command on it, with what `git commit`
  // hands that hook and so every test under it: GIT_DIR and GIT_INDEX_FILE of the repository being committed.
  const env = { ...process.env, GIT_DIR: gitDir, GIT_INDEX_FILE: path.join(gitDir, 'index') };
  delete env.NODE_TEST_CONTEXT; // set under `node --test`: with it the inner runner would not run on its own
  const pattern = '^a git repository js-harness never initialized is accepted';
  const inner = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern', pattern, fileURLToPath(import.meta.url)], { cwd: linked, env, encoding: 'utf8' });

  assert.equal(fs.readFileSync(config, 'utf8'), before, 'the config of the repository being committed');
  assert.equal(inner.status, 0, inner.stdout + inner.stderr);
  assert.match(inner.stdout, /^# pass 1$/m, 'the inner run ran that one test');
});

// ---- the invocation --------------------------------------------------------------------------------------------------

test('a bad invocation refuses with the usage line', async () => {
  const root = makeProject();
  const cases = [
    [[], /a subcommand is required/],
    [['restart', '--cwd', root], /unknown subcommand: restart/],
    [['start', '--cwd', root, '--bogus'], /unknown flag: --bogus/],
    [['start', '--cwd', root, '--name'], /--name requires a value/],
    [['start', '--cwd', '--home', 'x'], /--cwd requires a value/],
    [['status', '--cwd', root, '--name', 'x'], /unknown flag: --name/],
    [['stop', '--cwd', root, '--spawn', 'worktree'], /unknown flag: --spawn/],
    [['start', '--cwd', root, '--spawn', 'elsewhere'], /--spawn must be one of same-dir, worktree, session/],
    [['start', '--cwd', root, '--permission-mode', 'accept&Edits'], /--permission-mode/],
  ];
  for (const [argv, message] of cases) {
    const world = fakeWorld();
    const code = await remoteMain(argv, {}, world.deps);
    assert.equal(code, 2, JSON.stringify(argv));
    assert.match(world.err(), message, JSON.stringify(argv));
    assert.match(world.err(), /Usage: js-harness remote start\|stop\|status/);
    assert.equal(world.spawned.length, 0);
  }
});

test('start rejects a name that cmd.exe would act on, before looking for the CLI or starting anything', async () => {
  const root = makeProject();
  const home = tempDir();
  for (const bad of ['a&b', 'a|b', 'a<b', 'a>b', 'a^b', 'a%b', 'a"b', 'a\u0007b', 'a\nb', '   ']) {
    const world = fakeWorld();
    const code = await remoteMain(['start', '--cwd', root, '--home', home, '--name', bad], {}, world.deps);
    assert.equal(code, 2, JSON.stringify(bad));
    assert.match(world.err(), /name/, JSON.stringify(bad));
    assert.equal(world.resolved(), 0);
    assert.equal(world.spawned.length, 0);
  }
  assert.equal(fs.existsSync(stateDir(home)), false);
});

test('start refuses when the Claude CLI is not on PATH, and says how to fix it', async () => {
  const root = makeProject();
  const home = tempDir();
  const world = fakeWorld({ claude: null });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.match(world.err(), /claude/);
  assert.match(world.err(), /PATH/);
  assert.match(world.err(), /install/i);
  assert.equal(world.spawned.length, 0);
  assert.equal(fs.existsSync(statePath(home, root)), false);
});

test('start refuses a .cmd CLI whose path cmd.exe would act on, instead of a supervisor that retries forever', async () => {
  const root = makeProject();
  const world = fakeWorld({ claude: { path: 'C:\\tools&co\\claude.cmd', shell: true } });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', tempDir()], {}, world.deps), 1);
  assert.match(world.err(), /cmd\.exe/);
  assert.equal(world.spawned.length, 0);
});

// ---- the state file's id ---------------------------------------------------------------------------------------------

test('remoteId is stable, filename-safe, names the folder, and tells projects apart', () => {
  const id = remoteId('D:\\work\\My Project!');
  assert.match(id, /^[A-Za-z0-9._-]+$/);
  assert.match(id, /My-Project/i);
  assert.equal(remoteId('D:\\work\\My Project!'), id);
  assert.equal(remoteId('d:/work/my project!', 'win32'), remoteId('D:\\work\\My Project!', 'win32'), 'one folder however git spells it on Windows');
  assert.notEqual(remoteId('D:\\other\\My Project!'), id, 'two folders with one name');
});

// ---- start -----------------------------------------------------------------------------------------------------------

test('start launches a detached, hidden supervisor and records its identity', async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const world = fakeWorld();
  const env = { Path: 'C:\\bin', CLAUDE_CODE_SESSION_ID: 'x' };
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], env, world.deps), 0, world.err());
  assert.equal(world.spawned.length, 1);
  const [{ command, args, options, child }] = world.spawned;
  const logPath = logPathOf(home, root);
  assert.equal(command, process.execPath);
  assert.deepEqual(args, [SELF, 'supervise', '--root', root, '--name', 'proj', '--log', logPath, '--claude', 'C:\\bin\\claude.exe']);
  assert.equal(options.detached, true);
  assert.equal(options.stdio, 'ignore');
  assert.equal(options.windowsHide, true);
  assert.equal(options.env, env, 'the supervisor cleans the environment itself');
  assert.equal(child.unrefed, true, 'the command does not wait for it');
  assert.deepEqual(readState(home, root), {
    pid: 4242,
    startedAt: CREATED + 5,
    root,
    name: 'proj',
    logPath,
    startedAtIso: new Date(CREATED + 5).toISOString(),
  });
  assert.ok(world.out().includes(logPath), world.out());
  assert.match(world.out(), /Claude app/);
});

test('start passes the name, permission mode, spawn mode and a .cmd CLI on to the supervisor', async () => {
  const root = makeProject();
  const home = tempDir();
  const world = fakeWorld({ claude: { path: 'C:\\npm\\claude.cmd', shell: true } });
  const argv = ['start', '--cwd', root, '--home', home, '--name', 'my phone name', '--permission-mode', 'acceptEdits', '--spawn', 'worktree'];
  assert.equal(await remoteMain(argv, {}, world.deps), 0, world.err());
  assert.deepEqual(world.spawned[0].args, [
    SELF, 'supervise', '--root', root, '--name', 'my phone name', '--log', logPathOf(home, root),
    '--claude', 'C:\\npm\\claude.cmd', '--shell', '--permission-mode', 'acceptEdits', '--spawn', 'worktree',
  ]);
  assert.equal(readState(home, root).name, 'my phone name');
});

test('a second start while the supervisor runs is refused, and the running one is reported', async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const before = fs.readFileSync(statePath(home, root), 'utf8');
  const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.match(world.err(), /already running/);
  assert.match(world.out(), /running/);
  assert.equal(world.spawned.length, 0);
  assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), before);
});

test('a stale state file is replaced: the process is gone, or its pid now belongs to another one', async () => {
  for (const alive of [new Map(), new Map([[777, CREATED + 60_000]])]) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive });
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
    assert.equal(world.spawned.length, 1);
    assert.equal(readState(home, root).pid, 4242);
    assert.deepEqual(world.killed, [], 'the process that took the pid over is left alone');
  }
});

test('an unreadable state file counts as stale', async () => {
  const root = makeProject();
  const home = tempDir();
  fs.mkdirSync(stateDir(home), { recursive: true });
  fs.writeFileSync(statePath(home, root), '{ not json');
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.equal(readState(home, root).pid, 4242);
});

test('start fails, and records nothing, when the supervisor is gone before its identity is read', async () => {
  const root = makeProject();
  const home = tempDir();
  const world = fakeWorld();
  world.deps.identifyProcesses = () => [];
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.match(world.err(), /exited/);
  assert.ok(world.err().includes(logPathOf(home, root)));
  assert.equal(fs.existsSync(statePath(home, root)), false);
});

// ---- status ----------------------------------------------------------------------------------------------------------

const ESC = '\u001b';
/** What the real server writes, redraws included: OSC titles, cursor moves, line erases and colors. */
const CAPTURED_LOG = [
  `${ESC}]0;claude remote-control\u0007${ESC}[?25l${ESC}[2K${ESC}[1G·${ESC}[33m…${ESC}[39m· Connecting · proj`,
  `${ESC}[2K${ESC}[1A${ESC}[2K${ESC}[G·${ESC}[32m✔︎${ESC}[39m· Connected · js-harness · main`,
  `${ESC}[2mCapacity: 0/32 · New sessions will be created in the current directory${ESC}[22m`,
  `${ESC}]8;;https://claude.ai/code?environment=env_01ABCdef${ESC}\\https://claude.ai/code?environment=env_01ABCdef${ESC}]8;;${ESC}\\`,
  `\r${ESC}[2KCapacity: 1/32 · New sessions will be created in the current directory`,
  '',
].join('\n');

test('readServerState reads the last connection state, capacity and address, through ANSI and OSC sequences', () => {
  assert.deepEqual(readServerState(CAPTURED_LOG), {
    connection: 'connected',
    capacity: '1/32',
    environmentUrl: 'https://claude.ai/code?environment=env_01ABCdef',
  });
  assert.deepEqual(readServerState(''), { connection: 'unknown', capacity: null, environmentUrl: null });
  const exited = `${CAPTURED_LOG}[js-harness remote] server exited (code 1) after 600s; restarting in 5s\n`;
  assert.equal(readServerState(exited).connection, 'not connected', 'a server that exited after its last Connected is down');
  const reconnecting = `${CAPTURED_LOG}${ESC}[2K· Reconnecting · proj\n`;
  assert.equal(readServerState(reconnecting).connection, 'not connected');
  const back = `${exited}·✔︎· Connected · js-harness · main\n`;
  assert.equal(readServerState(back).connection, 'connected');
});

test('status reports a running supervisor with what its log says', async () => {
  const root = makeProject('proj');
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  fs.writeFileSync(logPathOf(home, root), CAPTURED_LOG);
  const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
  assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  const out = world.out();
  assert.match(out, /^remote: running/m);
  assert.match(out, /name: proj/);
  assert.ok(out.includes(path.normalize(root)), out);
  assert.ok(out.includes(logPathOf(home, root)), out);
  assert.match(out, /server: connected/);
  assert.match(out, /capacity: 1\/32/);
  assert.ok(out.includes('https://claude.ai/code?environment=env_01ABCdef'), out);
  assert.doesNotMatch(out, /\u001b/, 'no escape sequence reaches the terminal');
});

test('status says not running, and exits 0, with no state file or a stale one', async () => {
  for (const alive of [null, new Map(), new Map([[777, CREATED + 1]])]) {
    const root = makeProject('proj');
    const home = tempDir();
    if (alive) writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive: alive ?? new Map() });
    assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
    assert.match(world.out(), /^remote: not running/m);
    assert.match(world.out(), /name: proj/);
    assert.ok(world.out().includes(logPathOf(home, root)));
    assert.doesNotMatch(world.out(), /server: /, 'a stopped server has no live state to read');
  }
});

// ---- stop ------------------------------------------------------------------------------------------------------------

test('stop kills the supervisor by pid and creation time, confirms it is gone, and removes the state', async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.deepEqual(world.killed, [{ pid: 777, createdAt: CREATED }]);
  assert.equal(fs.existsSync(statePath(home, root)), false);
  assert.match(world.out(), /stopped/);
});

test('stop with nothing running says so, kills nothing, and removes a stale state file', async () => {
  for (const alive of [null, new Map(), new Map([[777, CREATED + 1]])]) {
    const root = makeProject();
    const home = tempDir();
    if (alive) writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive: alive ?? new Map() });
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
    assert.match(world.out(), /not running/);
    assert.deepEqual(world.killed, []);
    assert.equal(fs.existsSync(statePath(home, root)), false);
  }
});

test('stop keeps the state and fails when the supervisor survives the kill, or the kill throws', async () => {
  for (const kill of [() => {}, () => { throw new Error('still running after the kill: pid 777'); }]) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive: new Map([[777, CREATED]]), kill });
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1);
    assert.match(world.err(), /still running/);
    assert.equal(fs.existsSync(statePath(home, root)), true);
  }
});

// ---- end to end, with real processes and a fake `claude` -------------------------------------------------------------

const reaper = createReaper();
test.after(() => reaper.sweep());

// The waits below end as soon as their condition holds, so a generous limit costs a passing run nothing. Each step
// of the test takes a process snapshot through PowerShell, about ten in all: under one second each alone, several
// seconds each while the whole suite runs beside it (the test took 6 s alone and 38 s in the suite, measured on
// 2026-10-03), so a limit sized for a quiet machine fails a busy one without any defect.
const E2E_TIMEOUT_MS = 5 * 60 * 1000;

const waitUntil = async (predicate, ms = 60000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return predicate();
};

/** A fake `claude remote-control`: prints its pid and the server's redrawn status, then stays up. */
const FAKE_SERVER = [
  "console.log('fake-pid=' + process.pid);",
  "process.stdout.write('\\u001b]0;claude\\u0007\\u001b[2K·✔︎· Connected · ' + process.argv[process.argv.indexOf('--name') + 1] + ' · main\\n');",
  "console.log('Capacity: 0/32 · New sessions will be created in the current directory');",
  "console.log('https://claude.ai/code?environment=env_fake');",
  'setInterval(() => {}, 1000);',
].join('\n');

test('end to end: start runs a real detached supervisor, status sees it connected, stop leaves no process of it', { skip: process.platform === 'win32' ? false : 'Windows only', timeout: E2E_TIMEOUT_MS }, async () => {
  const since = Date.now();
  const root = makeProject('e2e');
  const home = tempDir();
  const bin = tempDir();
  const fake = path.join(bin, 'fake-claude.cjs');
  fs.writeFileSync(fake, FAKE_SERVER);
  fs.writeFileSync(path.join(bin, 'claude.cmd'), `@"${process.execPath}" "${fake}" %*\r\n`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^path$/i.test(name)));
  env.PATH = `${bin};${process.env.PATH ?? process.env.Path ?? ''}`;
  const out = [];
  const err = [];
  const deps = {
    spawn: (...args) => reaper.child(spawnChild(...args)),
    log: (line) => out.push(String(line)),
    error: (line) => err.push(String(line)),
  };

  try {
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], env, deps), 0, err.join('\n'));
    const state = readState(home, root);
    const logPath = logPathOf(home, root);
    assert.ok(await waitUntil(() => fs.existsSync(logPath) && /fake-pid=\d+/.test(fs.readFileSync(logPath, 'utf8'))), 'the fake server came up under the supervisor');
    const fakePid = Number(/fake-pid=(\d+)/.exec(fs.readFileSync(logPath, 'utf8'))[1]);
    reaper.pids([fakePid], { since });
    const [fakeIdentity] = identifyProcesses([fakePid]);
    assert.ok(fakeIdentity, 'the fake server is running');

    out.length = 0;
    assert.ok(await waitUntil(async () => {
      out.length = 0;
      await remoteMain(['status', '--cwd', root, '--home', home], env, deps);
      return /server: connected/.test(out.join('\n'));
    }), out.join('\n'));
    assert.match(out.join('\n'), /^remote: running/m);
    assert.match(out.join('\n'), /environment: https:\/\/claude\.ai\/code\?environment=env_fake/);

    out.length = 0;
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], env, deps), 0, err.join('\n'));
    const left = identifyProcesses([state.pid, fakePid]).filter(({ pid, createdAt }) =>
      (pid === state.pid && createdAt === state.startedAt) || (pid === fakePid && createdAt === fakeIdentity.createdAt));
    assert.deepEqual(left, [], 'neither the supervisor nor the server it ran is left');
    assert.equal(fs.existsSync(statePath(home, root)), false);

    out.length = 0;
    assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], env, deps), 0);
    assert.match(out.join('\n'), /^remote: not running/m);
  } finally {
    // A run that failed halfway still stops what it started, as a tree and by identity, through the command's own
    // stop. The reaper alone cannot: it kills the supervisor it holds, and the server's pid only once the log has
    // shown it, so a failure before that would leave the fake server running with nothing left that names it.
    if (fs.existsSync(statePath(home, root))) await remoteMain(['stop', '--cwd', root, '--home', home], env, deps);
  }
});

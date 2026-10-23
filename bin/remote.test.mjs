import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logTail, readServerState, remoteId, remoteMain } from './remote.mjs';
import { forgetOptionalFile, forgetScheduledTask, manifestPath, readManifest, recordOptionalFile, recordScheduledTask, sha256, uninstall } from './lib/manifest.mjs';
import { identifyProcesses } from './lib/process-tree.mjs';
import { LOG_KEEP_BYTES, LOG_MAX_BYTES, loginLauncher, remoteDir, trimFailureNote, trimLog, watchdogTask, watchdogTaskXml } from './lib/remote.mjs';
import { createReaper } from './lib/process-tree.testkit.mjs';
import { repoTemplate } from './lib/git-fixture.testkit.mjs';

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
  emptyRepo(root);
  return root;
}

/** What `git init` makes, made once and copied (`lib/git-fixture.testkit.mjs`): every empty repository here is the same. */
const emptyRepo = repoTemplate((root) => {
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
});

/** Why a test is skipped off Windows (`false` on it, so every test runs there). The command refuses anywhere
 * else, and a test that takes the fake world below past that refusal fakes `win32` while its paths, and the
 * state-file ids made from them, are this platform's: off Windows the two do not agree. */
const WINDOWS_ONLY = process.platform === 'win32' ? false : 'js-harness remote runs on Windows only, and this test fakes win32 over this platform\'s paths';

const CREATED = 1_760_000_000_000;
/** When the process that runs the command was created, in the fake world. */
const OWN_CREATED = CREATED + 3_600_000;
/** The node executable that runs the command, in the fake world: what a login launcher is told to run. */
const NODE = 'C:\\Program Files\\nodejs\\node.exe';

const xmlEscape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlUnescape = (text) => text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** A stand-in for `schtasks.exe` over a store of tasks, name to `{ command, arguments }`, the one of
 * `bin/lib/manifest.test.mjs` (a test file cannot import another, and a shared one is not this task's to add):
 * it lists the tasks among Windows's own, prints one back as `schtasks /Query /XML` does (declared UTF-16,
 * reordered, with defaults and the user's id added: never the document that registered it), registers one from
 * the XML file it is handed, keeping that document in `registered`, deletes one, and exits 1 for a task that is
 * not there. `fail[verb]` (`list`, `read`, `create`, `delete`) is the exit code that verb then ends with, having
 * done nothing, or an error it throws, or a function that says which for each run of that verb. Every `fakeWorld`
 * has one, so no test here runs the real program. */
function fakeSchtasks(tasks = {}) {
  const store = new Map(Object.entries(tasks).map(([name, action]) => [name, { command: action.command, arguments: action.arguments }]));
  const calls = [];
  const registered = [];
  const fail = {};
  const verbOf = (args) => (args[0] === '/Query' ? (args.includes('/XML') ? 'read' : 'list') : args[0].slice(1).toLowerCase());
  const run = (args) => {
    calls.push(args);
    const value = (flag) => args[args.indexOf(flag) + 1];
    const verb = verbOf(args);
    // A function is asked each time with how many times that verb has been run, this one included: `(nth) =>
    // (nth === 3 ? 1 : undefined)` fails the third.
    const failure = typeof fail[verb] === 'function' ? fail[verb](calls.filter((earlier) => verbOf(earlier) === verb).length) : fail[verb];
    if (failure instanceof Error) throw failure;
    if (failure !== undefined) return { status: failure, stdout: '' };
    // Windows finds a task by its name whatever the case of its letters.
    const name = [...store.keys()].find((task) => task.toLowerCase() === value('/TN')?.toLowerCase()) ?? value('/TN');
    if (verb === 'list') {
      const rows = ['"TaskName","Next Run Time","Status"', '"\\Microsoft\\Windows\\Defrag\\ScheduledDefrag","N/A","Ready"', ...[...store.keys()].map((task) => `"\\${task}","06/10/2026 12:05:00","Ready"`)];
      return { status: 0, stdout: `${rows.join('\r\n')}\r\n` };
    }
    if (verb === 'read') {
      if (!store.has(name)) return { status: 1, stdout: '' };
      const { command, arguments: given } = store.get(name);
      return { status: 0, stdout: [
        '<?xml version="1.0" encoding="UTF-16"?>',
        '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
        `  <RegistrationInfo><Description>a task</Description><URI>\\${name}</URI></RegistrationInfo>`,
        '  <Principals><Principal id="Author"><UserId>S-1-5-21-1-2-3-1001</UserId><LogonType>InteractiveToken</LogonType></Principal></Principals>',
        '  <Settings><IdleSettings><Duration>PT10M</Duration></IdleSettings><Enabled>true</Enabled></Settings>',
        '  <Triggers><TimeTrigger><StartBoundary>2026-01-01T00:00:00</StartBoundary></TimeTrigger></Triggers>',
        `  <Actions Context="Author"><Exec><Command>${xmlEscape(command)}</Command><Arguments>${xmlEscape(given)}</Arguments></Exec></Actions>`,
        '</Task>', '',
      ].join('\r\n') };
    }
    if (verb === 'delete') return store.delete(name) ? { status: 0, stdout: '' } : { status: 1, stdout: '' };
    if (verb === 'create') {
      if (store.has(name) && !args.includes('/F')) return { status: 1, stdout: '' };
      const xml = fs.readFileSync(value('/XML'), 'utf8');
      registered.push({ name, xml, file: value('/XML') });
      store.set(name, { command: xmlUnescape(/<Command>(.*?)<\/Command>/s.exec(xml)[1]), arguments: xmlUnescape(/<Arguments>(.*?)<\/Arguments>/s.exec(xml)[1]) });
      return { status: 0, stdout: '' };
    }
    throw new Error(`the fake schtasks does not know ${args.join(' ')}`);
  };
  return { run, store, calls, registered, fail, mutations: () => calls.filter((args) => args[0] !== '/Query') };
}

/** Everything `remoteMain` reaches outside itself, faked: `alive` maps a pid to its creation time (`null` for one
 * Windows does not give) and holds the command's own process, the one launch gets pid 4242 and then runs
 * `hooks.onSpawn`, a kill ends a process only when it names it by pid and creation time, and stopping the launch
 * ends it. `tasks` is the machine's scheduled tasks (`fakeSchtasks`), empty unless handed over. */
function fakeWorld({ alive = new Map(), claude = { path: 'C:\\bin\\claude.exe', shell: false }, platform = 'win32', kill, stopSpawned, tasks = fakeSchtasks() } = {}) {
  if (!alive.has(process.pid)) alive.set(process.pid, OWN_CREATED);
  const hooks = {};
  const spawned = [];
  const killed = [];
  const stopped = [];
  const out = [];
  const err = [];
  let resolved = 0;
  const deps = {
    platform,
    execPath: NODE,
    resolveClaude: () => {
      resolved += 1;
      return claude;
    },
    spawn: (command, args, options) => {
      const child = { pid: 4242, unrefed: false, unref() { this.unrefed = true; }, on() {}, once() {} };
      spawned.push({ command, args, options, child });
      alive.set(4242, CREATED + 5);
      hooks.onSpawn?.();
      return child;
    },
    identifyProcesses: (pids) => pids.filter((pid) => alive.has(pid)).map((pid) => ({ pid, createdAt: alive.get(pid) })),
    kill: kill ?? ((identity) => {
      killed.push(identity);
      if (alive.get(identity.pid) === identity.createdAt) alive.delete(identity.pid);
    }),
    stopSpawned: stopSpawned ?? (async (child, lifetime) => {
      stopped.push({ child, lifetime });
      alive.delete(child.pid);
    }),
    schtasks: (args) => tasks.run(args),
    log: (line) => out.push(String(line)),
    error: (line) => err.push(String(line)),
  };
  return {
    deps, hooks, spawned, killed, stopped, alive, tasks,
    out: () => out.join('\n'),
    err: () => err.join('\n'),
    resolved: () => resolved,
  };
}

const stateDir = (home) => path.join(home, '.js-harness', 'remote');
const statePath = (home, root) => path.join(stateDir(home), `${remoteId(root)}.json`);
const logPathOf = (home, root) => path.join(stateDir(home), `${remoteId(root)}.log`);
const lockPathOf = (home, root) => path.join(stateDir(home), `${remoteId(root)}.lock`);
/** The marker a stop leaves: while it is there the watchdog starts nothing. */
const stoppedPathOf = (home, root) => path.join(stateDir(home), `${remoteId(root)}.stopped`);
function writeState(home, root, state) {
  fs.mkdirSync(stateDir(home), { recursive: true });
  fs.writeFileSync(statePath(home, root), JSON.stringify({ root, name: path.basename(root), logPath: logPathOf(home, root), startedAtIso: new Date(state.startedAt).toISOString(), ...state }));
}
const readState = (home, root) => JSON.parse(fs.readFileSync(statePath(home, root), 'utf8'));

const SNAPSHOT_FAILED = () => { throw new Error('the process snapshot failed (exit 1): access denied'); };

/** Makes every look that asks about `pid` fail, and leaves the others (the command looking itself up) alone. */
function failTheLookFor(world, pid) {
  const identify = world.deps.identifyProcesses;
  world.deps.identifyProcesses = (pids) => (pids.includes(pid) ? SNAPSHOT_FAILED() : identify(pids));
}

/** The two ways a look cannot tell whether the supervisor recorded as pid 777 still runs, each as a change to
 * the fake world. Neither proves it gone, so no subcommand may act as if it were. */
const UNPROVED = {
  'its creation time cannot be read': (world) => world.alive.set(777, null),
  'the process snapshot fails': (world) => failTheLookFor(world, 777),
};

/** What every "cannot tell" gives the human, who decides: the state file, the recorded pid, and that the file may
 * be removed by hand once they have checked that no such supervisor runs. Running the command again is not a way
 * out of a record that stays unknown. */
function assertWayOut(world, home, root, what) {
  assert.ok(world.err().includes(statePath(home, root)), `${what}: ${world.err()}`);
  assert.match(world.err(), /pid 777/, what);
  assert.match(world.err(), /checked that no such supervisor is running/, what);
  assert.match(world.err(), /removed by hand/, what);
}

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

test('a git repository js-harness never initialized is accepted: start, status and stop all act on it', { skip: WINDOWS_ONLY }, async () => {
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

test('the root is the top level of the repository, from any folder inside it', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('top');
  const nested = path.join(root, 'packages', 'app');
  fs.mkdirSync(nested, { recursive: true });
  const home = tempDir();
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', nested, '--home', home], {}, world.deps), 0, world.err());
  assert.equal(world.spawned[0].options.cwd, root);
  assert.equal(readState(home, root).name, 'top', 'named after the repository, not the folder it was run from');
});

test('what js-harness left in the repository does not matter: an initialized project, a broken pin, a stale manifest', { skip: WINDOWS_ONLY }, async () => {
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

test('without --cwd it acts on the repository the current folder is in', { skip: WINDOWS_ONLY }, async () => {
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

test('run from the pre-commit hook of a linked worktree, this file leaves the repository being committed as it was', { skip: WINDOWS_ONLY }, () => {
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
    [['start', '--cwd', root, '--bogus'], /unknown argument: --bogus/],
    [['start', '--cwd', root, '--name'], /--name requires a value/],
    [['start', '--cwd', '--home', 'x'], /--cwd requires a value/],
    [['status', '--cwd', root, '--name', 'x'], /unknown argument: --name/],
    [['stop', '--cwd', root, '--spawn', 'worktree'], /unknown argument: --spawn/],
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

test('start refuses when the Claude CLI is not on PATH, and says how to fix it', { skip: WINDOWS_ONLY }, async () => {
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

test('start refuses a .cmd CLI whose path cmd.exe would act on, instead of a supervisor that retries forever', { skip: WINDOWS_ONLY }, async () => {
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

test('start launches a detached, hidden supervisor and records its identity', { skip: WINDOWS_ONLY }, async () => {
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

test('start passes the name, permission mode, spawn mode and a .cmd CLI on to the supervisor', { skip: WINDOWS_ONLY }, async () => {
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

test('a second start while the supervisor runs is refused, and the running one is reported', { skip: WINDOWS_ONLY }, async () => {
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

test('a stale state file is replaced: the process is gone, or its pid now belongs to another one', { skip: WINDOWS_ONLY }, async () => {
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

/** A record that exists and cannot be used: each makes one at `file`, and tells afterwards that it is untouched.
 * It does not prove its process exited, so it is neither replaced nor removed. */
const UNREADABLE_RECORDS = {
  'it is not JSON': (file) => {
    fs.writeFileSync(file, '{ not json');
    return () => fs.readFileSync(file, 'utf8') === '{ not json';
  },
  'it names no pid and creation time': (file) => {
    fs.writeFileSync(file, '{"name":"proj","pid":"777"}');
    return () => fs.readFileSync(file, 'utf8') === '{"name":"proj","pid":"777"}';
  },
  'it cannot be read': (file) => {
    fs.mkdirSync(file); // a folder where the file goes: it is there, and reading it fails
    return () => fs.statSync(file).isDirectory();
  },
};

for (const sub of ['start', 'status', 'stop']) {
  test(`${sub} takes a state file it cannot read for a supervisor that may still run: it keeps the file, acts on nothing and fails`, { skip: WINDOWS_ONLY }, async () => {
    for (const [what, make] of Object.entries(UNREADABLE_RECORDS)) {
      const root = makeProject('proj');
      const home = tempDir();
      fs.mkdirSync(stateDir(home), { recursive: true });
      const untouched = make(statePath(home, root));
      const world = fakeWorld();
      assert.equal(await remoteMain([sub, '--cwd', root, '--home', home], {}, world.deps), 1, what);
      assert.equal(world.spawned.length, 0, `${what}: no second supervisor`);
      assert.deepEqual(world.killed, [], what);
      assert.ok(untouched(), `${what}: the record is kept as it was`);
      assert.ok(world.err().includes(statePath(home, root)), world.err());
      assert.match(world.err(), /could not be read|is not a record/, what);
      assert.match(world.err(), /removed by hand/, 'the way out is the human\'s');
      assert.doesNotMatch(world.out(), /not running|started|stopped/, `${what}: ${world.out()}`);
      if (sub === 'status') assert.match(world.out(), /^remote: unknown/m, what);
      assert.equal(fs.existsSync(lockPathOf(home, root)), false, 'no lock is left');
    }
  });
}

test('start refuses, spawns nothing and keeps the record when it cannot tell whether the recorded supervisor still runs', { skip: WINDOWS_ONLY }, async () => {
  for (const [what, arrange] of Object.entries(UNPROVED)) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const before = fs.readFileSync(statePath(home, root), 'utf8');
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    arrange(world);
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1, what);
    assert.equal(world.spawned.length, 0, `${what}: a second supervisor would run beside the first`);
    assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), before, `${what}: the record is all that still names the first`);
    assert.match(world.err(), /pid 777/, what);
    assert.match(world.err(), /kept/, what);
    assertWayOut(world, home, root, what);
    assert.ok(world.err().includes(statePath(home, root)), world.err());
    assert.match(world.err(), /js-harness remote status/, 'what to run next');
    assert.match(world.err(), /js-harness remote stop/, 'what to run next');
    assert.doesNotMatch(world.out(), /started/, what);
  }
});

// ---- start: one at a time for a project -------------------------------------------------------------------------------

const readLock = (home, root) => (fs.existsSync(lockPathOf(home, root)) ? JSON.parse(fs.readFileSync(lockPathOf(home, root), 'utf8')) : null);
function writeLock(home, root, owner) {
  fs.mkdirSync(stateDir(home), { recursive: true });
  fs.writeFileSync(lockPathOf(home, root), typeof owner === 'string' ? owner : JSON.stringify(owner));
}

test('a start that overlaps another launches nothing: the lock is held from before the state is read until the supervisor is recorded', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  const first = fakeWorld();
  const second = fakeWorld();
  let overlapping;
  let atLaunch;
  // The second start runs while the first is between reading "no record" and writing its own: the moment both
  // would launch.
  first.hooks.onSpawn = () => {
    atLaunch = { lock: readLock(home, root), recorded: fs.existsSync(statePath(home, root)) };
    overlapping = remoteMain(['start', '--cwd', root, '--home', home], {}, second.deps);
  };
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, first.deps), 0, first.err());
  assert.equal(await overlapping, 1, 'the second is refused');
  assert.equal(second.spawned.length, 0, 'and launches no supervisor of its own');
  assert.match(second.err(), /another js-harness remote start or stop is in progress/);
  assert.ok(second.err().includes(lockPathOf(home, root)), second.err());
  assert.deepEqual(atLaunch, { lock: { pid: process.pid, createdAt: OWN_CREATED }, recorded: false }, 'the lock names its owner while the supervisor is launched');
  assert.equal(first.spawned.length, 1);
  assert.equal(readState(home, root).pid, 4242, 'the first records its supervisor');
  assert.equal(fs.existsSync(lockPathOf(home, root)), false, 'and the lock does not outlive it');
});

test('start refuses while another start holds the lock, and leaves the lock and the state alone', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeLock(home, root, { pid: 555, createdAt: CREATED });
  const before = fs.readFileSync(lockPathOf(home, root), 'utf8');
  const world = fakeWorld({ alive: new Map([[555, CREATED]]) });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.equal(world.spawned.length, 0);
  assert.match(world.err(), /another js-harness remote start or stop is in progress/);
  assert.match(world.err(), /pid 555/);
  assert.ok(world.err().includes(lockPathOf(home, root)), world.err());
  assert.equal(fs.readFileSync(lockPathOf(home, root), 'utf8'), before, 'the lock is its owner\'s to release');
  assert.equal(fs.existsSync(statePath(home, root)), false);
});

test('a lock whose owner is proven gone is free: start takes it, launches, and releases it', { skip: WINDOWS_ONLY }, async () => {
  for (const alive of [new Map(), new Map([[555, CREATED + 9]])]) {
    const root = makeProject();
    const home = tempDir();
    writeLock(home, root, { pid: 555, createdAt: CREATED });
    const world = fakeWorld({ alive });
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
    assert.equal(world.spawned.length, 1);
    assert.equal(readState(home, root).pid, 4242);
    assert.equal(fs.existsSync(lockPathOf(home, root)), false, 'the stale lock is gone, and so is its own');
  }
});

test('start refuses when it cannot tell whether the owner of the lock still runs, and says the lock may be removed by hand', { skip: WINDOWS_ONLY }, async () => {
  const unproved = {
    'the lock is not a record': { lock: 'half-writ', arrange: () => {} },
    'its owner\'s creation time cannot be read': { lock: { pid: 555, createdAt: CREATED }, arrange: (world) => world.alive.set(555, null) },
    'the process snapshot fails': { lock: { pid: 555, createdAt: CREATED }, arrange: (world) => failTheLookFor(world, 555) },
  };
  for (const [what, { lock, arrange }] of Object.entries(unproved)) {
    const root = makeProject();
    const home = tempDir();
    writeLock(home, root, lock);
    const before = fs.readFileSync(lockPathOf(home, root), 'utf8');
    const world = fakeWorld();
    arrange(world);
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1, what);
    assert.equal(world.spawned.length, 0, what);
    assert.ok(world.err().includes(lockPathOf(home, root)), world.err());
    assert.match(world.err(), /removed by hand/, what);
    assert.equal(fs.readFileSync(lockPathOf(home, root), 'utf8'), before, what);
    assert.equal(fs.existsSync(statePath(home, root)), false, what);
  }
});

test('start refuses, and takes no lock, when it cannot read its own identity to put in it', { skip: WINDOWS_ONLY }, async () => {
  const unidentified = {
    'its creation time cannot be read': (world) => world.alive.set(process.pid, null),
    'the process snapshot fails': (world) => failTheLookFor(world, process.pid),
  };
  for (const [what, arrange] of Object.entries(unidentified)) {
    const root = makeProject();
    const home = tempDir();
    const world = fakeWorld();
    arrange(world);
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1, what);
    assert.equal(world.spawned.length, 0, what);
    assert.match(world.err(), /lock/, what);
    assert.equal(fs.existsSync(lockPathOf(home, root)), false, what);
    assert.equal(fs.existsSync(statePath(home, root)), false, what);
  }
});

test('the lock never outlives start: it is released when start succeeds, refuses, fails after the launch, or throws', { skip: WINDOWS_ONLY }, async () => {
  const ways = {
    'it succeeds': { code: 0, arrange: () => {} },
    'a supervisor already runs': {
      code: 1,
      arrange: ({ world, home, root }) => {
        writeState(home, root, { pid: 777, startedAt: CREATED });
        world.alive.set(777, CREATED);
      },
    },
    'the recorded supervisor cannot be told from another program': {
      code: 1,
      arrange: ({ world, home, root }) => {
        writeState(home, root, { pid: 777, startedAt: CREATED });
        world.alive.set(777, null);
      },
    },
    'the CLI is not on PATH': { code: 1, arrange: ({ world }) => { world.deps.resolveClaude = () => null; } },
    'the supervisor is gone before it is recorded': { code: 1, arrange: ({ world }) => { world.hooks.onSpawn = () => world.alive.delete(4242); } },
    'something throws': { code: 1, arrange: ({ world }) => { world.deps.resolveClaude = () => { throw new Error('boom'); }; } },
  };
  for (const [what, { code, arrange }] of Object.entries(ways)) {
    const root = makeProject();
    const home = tempDir();
    const world = fakeWorld();
    arrange({ world, home, root });
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), code, `${what}: ${world.err()}`);
    assert.equal(fs.existsSync(lockPathOf(home, root)), false, what);
  }
});

const CANNOT_UNLINK = () => { throw Object.assign(new Error('EPERM: operation not permitted, unlink'), { code: 'EPERM' }); };

test('a lock that cannot be removed does not change the result: start and stop still report what they did, and say the file may be removed by hand', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  const world = fakeWorld();
  world.deps.removeFile = CANNOT_UNLINK;
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.equal(readState(home, root).pid, 4242, 'the supervisor is launched and recorded');
  assert.match(world.out(), /started/);
  assert.match(world.err(), /lock file could not be removed/);
  assert.match(world.err(), /EPERM/);
  assert.match(world.err(), /removed by hand/);
  assert.ok(world.err().includes(lockPathOf(home, root)), world.err());
  assert.deepEqual(readLock(home, root), { pid: process.pid, createdAt: OWN_CREATED }, 'it is still there');

  fs.rmSync(lockPathOf(home, root));
  const stopping = fakeWorld({ alive: new Map([[4242, CREATED + 5]]) });
  stopping.deps.removeFile = CANNOT_UNLINK;
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, stopping.deps), 0, stopping.err());
  assert.match(stopping.out(), /stopped/);
  assert.equal(fs.existsSync(statePath(home, root)), false, 'the record is removed all the same');
  assert.match(stopping.err(), /lock file could not be removed/);
  assert.ok(stopping.err().includes(lockPathOf(home, root)), stopping.err());
});

test('the lock is released only while it is still this command\'s own: one that names another owner is left alone', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  const world = fakeWorld();
  // Someone removed the lock by hand and another command took it, while this one was launching.
  world.hooks.onSpawn = () => writeLock(home, root, { pid: 555, createdAt: CREATED });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.deepEqual(readLock(home, root), { pid: 555, createdAt: CREATED }, 'it is its owner\'s to release');
});

// ---- the home, resolved once -------------------------------------------------------------------------------------------

test('a relative home is resolved against the folder the command runs in, before any path is made from it: the state, the log and what the supervisor is handed are absolute', { skip: WINDOWS_ONLY }, async () => {
  const original = process.cwd();
  for (const [homeArgs, env] of [[['--home', 'rel-home'], {}], [[], { JS_HARNESS_HOME: 'rel-home' }]]) {
    const root = makeProject('elsewhere');
    process.chdir(tempDir());
    try {
      const home = path.resolve('rel-home');
      const world = fakeWorld({ claude: { path: path.join('tools', 'claude.exe'), shell: false } });
      assert.equal(await remoteMain(['start', '--cwd', root, ...homeArgs], env, world.deps), 0, world.err());
      const { args } = world.spawned[0];
      const handed = (flag) => args[args.indexOf(flag) + 1];
      // The supervisor runs in the repository: a relative path would mean another file there than here.
      assert.equal(handed('--log'), logPathOf(home, root));
      assert.ok(path.isAbsolute(handed('--log')), handed('--log'));
      assert.equal(handed('--claude'), path.resolve('tools', 'claude.exe'));
      assert.equal(readState(home, root).logPath, logPathOf(home, root), 'the record is under the same home, and names the same log');
      assert.ok(world.out().includes(logPathOf(home, root)), world.out());
    } finally {
      process.chdir(original);
    }
  }
});

test('an empty JS_HARNESS_HOME is no home: the state and the log are under the user\'s home folder, and the folder the command runs in stays empty', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const workdir = tempDir();
  const original = process.cwd();
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.chdir(workdir);
  try {
    const world = fakeWorld();
    assert.equal(await remoteMain(['start', '--cwd', root], { JS_HARNESS_HOME: '' }, world.deps), 0, world.err());
    assert.deepEqual(fs.readdirSync(workdir), [], 'nothing is written in the folder the command runs in');
    assert.equal(readState(home, root).logPath, logPathOf(home, root), 'the record is under the user\'s home folder');
    assert.ok(world.out().includes(logPathOf(home, root)), world.out());
  } finally {
    process.chdir(original);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

/** Whether a state file was written: a folder put where it goes (to make the write fail) is not one. */
const recorded = (home, root) => fs.existsSync(statePath(home, root)) && fs.statSync(statePath(home, root)).isFile();

/** What can fail once the supervisor is spawned, each as a change to the fake world or the home, with what the
 * refusal must say. From the spawn on a supervisor exists that no state file names yet. */
const AFTER_THE_SPAWN = {
  'the process snapshot fails': {
    arrange: ({ world }) => failTheLookFor(world, 4242),
    says: /the process snapshot failed \(exit 1\): access denied/,
  },
  'the supervisor is not in the snapshot': {
    arrange: ({ world }) => {
      world.hooks.onSpawn = () => world.alive.delete(4242);
    },
    says: /exited as soon as it started/,
  },
  'its creation time cannot be read': {
    arrange: ({ world }) => {
      world.hooks.onSpawn = () => world.alive.set(4242, null);
    },
    says: /creation time could not be read/,
  },
  'the state file cannot be written': {
    // A folder appears where the state file goes once the supervisor is up: there was no record when start looked.
    arrange: ({ world, home, root }) => {
      world.hooks.onSpawn = () => fs.mkdirSync(statePath(home, root), { recursive: true });
    },
    says: /could not be recorded/,
  },
};

for (const [what, { arrange, says }] of Object.entries(AFTER_THE_SPAWN)) {
  test(`start leaves no unrecorded supervisor when ${what}: it stops the one it spawned, and fails`, { skip: WINDOWS_ONLY }, async () => {
    const root = makeProject();
    const home = tempDir();
    const world = fakeWorld();
    arrange({ world, home, root });
    const before = Date.now();
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1);
    assert.equal(world.spawned.length, 1);
    assert.equal(world.stopped.length, 1, 'what it spawned is stopped');
    assert.equal(world.stopped[0].child, world.spawned[0].child, 'through the handle it holds');
    const { startedAt } = world.stopped[0].lifetime;
    assert.ok(startedAt >= before && startedAt <= Date.now(), 'with the time of the spawn, which finds its tree');
    assert.equal(world.alive.has(4242), false);
    assert.match(world.err(), says);
    assert.match(world.err(), /stopped/, world.err());
    assert.ok(world.err().includes(logPathOf(home, root)), 'the log may say more');
    assert.equal(recorded(home, root), false, 'nothing is recorded');
    assert.doesNotMatch(world.out(), /started/);
  });
}

test('start says so, with the pid, when the supervisor it could not record cannot be stopped either', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  const world = fakeWorld({ stopSpawned: async () => { throw new Error('the process snapshot failed (exit 1): access denied'); } });
  failTheLookFor(world, 4242);
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.match(world.err(), /could not be stopped/);
  assert.match(world.err(), /pid 4242/, 'the human is given the pid');
  assert.match(world.err(), /by hand/);
  assert.equal(recorded(home, root), false);
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

/** One repaint of the server's status, as the live log holds about one a second (its shape read from that log on
 * 2026-10-06; the address and the session are invented): the cursor goes back up over the last one, erases it,
 * and the whole status is printed again, the session as an OSC 8 link. */
const statusFrame = ({ capacity = '1/32', environment = 'env_01EXAMPLE' } = {}) => [
  `${ESC}[8A${ESC}[J·✔︎· Connected · js-harness · main`,
  `    Capacity: ${capacity} · New sessions will be created in the current directory`,
  `    ${ESC}]8;;https://claude.ai/code/session_01EXAMPLE?from=cli\u0007js-harness${ESC}]8;;\u0007`,
  '',
  `Continue coding in the Claude mobile app or https://claude.ai/code?environment=${environment}`,
  'Or ask Claude to work in this folder from your projects on claude.ai',
  'space to show QR code · w to toggle spawn mode',
  '',
].join('\n');

test('status reads a trimmed log as it read the whole one: the same connection, capacity and address', () => {
  const logPath = path.join(tempDir(), 'remote.log');
  // A server that exited, then hours of repaints of the next one, the last of them with a session in use.
  const idle = statusFrame({ capacity: '0/32' });
  const whole = [
    statusFrame({ capacity: '0/32', environment: 'env_01EARLIER' }),
    '[js-harness remote] server exited (code 1) after 600s; restarting in 5s\n',
    idle.repeat(Math.ceil(LOG_MAX_BYTES / Buffer.byteLength(idle))),
    statusFrame().repeat(3),
  ].join('');
  const state = { connection: 'connected', capacity: '1/32', environmentUrl: 'https://claude.ai/code?environment=env_01EXAMPLE' };
  const noteOf = (text) => text.slice(0, text.indexOf('\n'));

  fs.writeFileSync(logPath, whole);
  assert.deepEqual(readServerState(logTail(logPath)), state);
  assert.equal(trimLog(logPath).trimmed, true, 'the log is over the cap');
  const trimmed = fs.readFileSync(logPath, 'utf8');
  assert.match(noteOf(trimmed), /^\[js-harness remote\] log trimmed: /);
  assert.ok(whole.endsWith(trimmed.slice(noteOf(trimmed).length + 1)), 'what is left is the end of the log');
  const size = Buffer.byteLength(trimmed);
  assert.ok(size <= LOG_KEEP_BYTES + 200 && size > 8 * 64 * 1024, `far more is kept than the 64 KiB status reads: ${size} bytes`);
  assert.deepEqual(readServerState(logTail(logPath)), state);

  // With less kept than status reads, the line the trim leaves is in what status reads.
  fs.writeFileSync(logPath, whole);
  assert.equal(trimLog(logPath, { keepBytes: 2048 }).trimmed, true);
  const small = fs.readFileSync(logPath, 'utf8');
  assert.equal(logTail(logPath), small, 'all of it is read, the note with it');
  assert.deepEqual(readServerState(logTail(logPath)), state);
  assert.equal(readServerState(`${statusFrame()}${noteOf(small)}\n`).connection, 'connected', 'last in the log, that line does not say the server went down');
  assert.deepEqual(readServerState(`${noteOf(small)}\n`), { connection: 'unknown', capacity: null, environmentUrl: null }, 'and alone it says nothing of the server');
});

test('status does not read a log that could not be trimmed as a server that went down, whatever the error says', () => {
  const line = (...args) => `[js-harness remote] ${trimFailureNote(...args)}\n`;
  const busy = new Error('EBUSY: resource busy or locked, ftruncate');
  // The first line of a failure, the one that repeats it, and an error whose own words are a connection state.
  for (const note of [line(busy), line(busy, 61), line(new Error('ENOTCONN: socket is not connected, open')), line(new Error('the share is offline'))]) {
    assert.match(note, /^\[js-harness remote\] log not trimmed/);
    assert.equal(readServerState(`${statusFrame()}${note}`).connection, 'connected', `last in the log, it does not say the server went down: ${note}`);
    assert.deepEqual(readServerState(note), { connection: 'unknown', capacity: null, environmentUrl: null }, `and alone it says nothing of the server: ${note}`);
    const exited = `${statusFrame()}${note}[js-harness remote] server exited (code 1) after 600s; restarting in 5s\n`;
    assert.equal(readServerState(exited).connection, 'not connected', 'a line that does say so is still read');
  }
});

test('status reports a running supervisor with what its log says', { skip: WINDOWS_ONLY }, async () => {
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

test('status says not running, and exits 0, with no state file or a stale one', { skip: WINDOWS_ONLY }, async () => {
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

test('status says it cannot tell, keeps the record and fails when the recorded process may or may not be the supervisor', { skip: WINDOWS_ONLY }, async () => {
  for (const [what, arrange] of Object.entries(UNPROVED)) {
    const root = makeProject('proj');
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    fs.writeFileSync(logPathOf(home, root), CAPTURED_LOG);
    const before = fs.readFileSync(statePath(home, root), 'utf8');
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    arrange(world);
    assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], {}, world.deps), 1, `${what}: a script must not read it as stopped`);
    assert.match(world.out(), /^remote: unknown/m, what);
    assert.doesNotMatch(world.out(), /not running|remote: running/, what);
    assert.doesNotMatch(world.out(), /server: /, `${what}: the log's last state is not this answer`);
    assert.match(world.out(), /name: proj/);
    assert.ok(world.out().includes(logPathOf(home, root)));
    assert.match(world.err(), /pid 777/, what);
    assert.match(world.err(), /kept/, what);
    assertWayOut(world, home, root, what);
    assert.ok(world.err().includes(statePath(home, root)), world.err());
    assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), before, what);
  }
});

// ---- stop ------------------------------------------------------------------------------------------------------------

test('stop kills the supervisor by pid and creation time, confirms it is gone, and removes the state', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.deepEqual(world.killed, [{ pid: 777, createdAt: CREATED }]);
  assert.equal(fs.existsSync(statePath(home, root)), false);
  assert.match(world.out(), /stopped/);
});

test('stop with nothing running says so, kills nothing, and removes a stale state file', { skip: WINDOWS_ONLY }, async () => {
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

test('stop keeps the state and fails when the supervisor survives the kill, or the kill throws', { skip: WINDOWS_ONLY }, async () => {
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

test('stop keeps the state, kills nothing and fails when it cannot tell whether the recorded process still runs', { skip: WINDOWS_ONLY }, async () => {
  for (const [what, arrange] of Object.entries(UNPROVED)) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const before = fs.readFileSync(statePath(home, root), 'utf8');
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    arrange(world);
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1, what);
    assert.deepEqual(world.killed, [], what);
    assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), before, `${what}: the record is all that still names the process`);
    assert.match(world.err(), /pid 777/, what);
    assert.match(world.err(), /kept/, what);
    assertWayOut(world, home, root, what);
    assert.ok(world.err().includes(statePath(home, root)), world.err());
    assert.doesNotMatch(world.out(), /not running|stopped/, what);
  }
});

test('stop keeps the state and fails when the kill cannot be confirmed afterwards', { skip: WINDOWS_ONLY }, async () => {
  // The command holds the functions it was handed, so each case changes what the next look finds, from the kill.
  const unconfirmed = {
    'the pid shows again with a creation time that cannot be read': (world) => world.alive.set(777, null),
    'the process snapshot fails': (world) => { world.snapshotFails = true; },
  };
  for (const [what, afterTheKill] of Object.entries(unconfirmed)) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    const { kill, identifyProcesses: identify } = world.deps;
    world.deps.identifyProcesses = (pids) => (world.snapshotFails ? SNAPSHOT_FAILED() : identify(pids));
    world.deps.kill = (identity) => {
      kill(identity);
      afterTheKill(world);
    };
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1, what);
    assert.deepEqual(world.killed, [{ pid: 777, createdAt: CREATED }], what);
    assert.equal(fs.existsSync(statePath(home, root)), true, what);
    assert.match(world.err(), /kept/, what);
    assertWayOut(world, home, root, what);
    assert.ok(world.err().includes(statePath(home, root)), world.err());
    assert.doesNotMatch(world.out(), /stopped/, what);
  }
});

// ---- stop, as the command really performs it, over a faked process table ----------------------------------------------

/** The machine's processes, faked under the stop the command really performs: `takeSnapshot` and `killProcesses`
 * as `process-tree.mjs` gives them. A kill ends a row only when it names it by pid and creation time, and
 * `unkillable` pids survive it. `hooks.beforeKill(n, targets)` and `hooks.beforeSnapshot(n)` run before the nth of
 * each, to change the table the way a live machine does between two looks. The table also holds the command's
 * own process, which `pids()` leaves out, and `looks` keeps what each snapshot showed. */
function fakeProcesses(rows) {
  const table = [{ pid: process.pid, ppid: 4, createdAt: OWN_CREATED }, ...rows].map((row) => ({ name: 'node.exe', ...row }));
  const kills = [];
  const looks = [];
  const hooks = {};
  const unkillable = new Set();
  const out = [];
  const err = [];
  const deps = {
    platform: 'win32',
    takeSnapshot: () => {
      hooks.beforeSnapshot?.(looks.length + 1);
      looks.push(table.map((row) => ({ ...row })));
      return table.map((row) => ({ ...row }));
    },
    killProcesses: (targets) => {
      kills.push(targets.map(({ pid }) => pid));
      hooks.beforeKill?.(kills.length, targets);
      const outcome = { killed: [], gone: [], running: [] };
      for (const { pid, createdAt } of targets) {
        const index = table.findIndex((row) => row.pid === pid && row.createdAt === createdAt);
        if (index === -1) outcome.gone.push(pid);
        else if (unkillable.has(pid)) outcome.running.push(pid);
        else {
          table.splice(index, 1);
          outcome.killed.push(pid);
        }
      }
      return outcome;
    },
    log: (line) => out.push(String(line)),
    error: (line) => err.push(String(line)),
  };
  return {
    deps, table, kills, looks, hooks, unkillable,
    pids: () => table.map((row) => row.pid).filter((pid) => pid !== process.pid).sort((a, b) => a - b),
    out: () => out.join('\n'),
    err: () => err.join('\n'),
  };
}

/** A supervisor (777) with its server (800) and what the server started (801), beside two processes that are not
 * its own: one unrelated (50), and one that records pid 777 from before the supervisor existed (60), as a pid
 * that was reused does. */
const supervisedTree = () => [
  { pid: 50, ppid: 4, createdAt: CREATED - 9000 },
  { pid: 60, ppid: 777, createdAt: CREATED - 5000 },
  { pid: 777, ppid: 50, createdAt: CREATED },
  { pid: 800, ppid: 777, createdAt: CREATED + 1000 },
  { pid: 801, ppid: 800, createdAt: CREATED + 2000 },
];

test('stop quiesces the supervisor first, then kills what it left: a server launched between the look and the kill does not survive a stop that reports success', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const world = fakeProcesses(supervisedTree());
  world.hooks.beforeKill = (n) => {
    // The supervisor's backoff ends as it is about to be killed: one more server, in no list of targets yet.
    if (n === 1) world.table.push({ pid: 900, ppid: 777, createdAt: CREATED + 5000, name: 'claude.exe' });
  };
  world.hooks.beforeSnapshot = () => {
    // Once the supervisor is dead its pid is anyone's: a later program that records it is not its child.
    if (world.kills.length > 0 && !world.pids().includes(61)) world.table.push({ pid: 61, ppid: 777, createdAt: Date.now() + 600_000, name: 'other.exe' });
  };
  const code = await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps);
  const left = world.pids().filter((pid) => [777, 800, 801, 900].includes(pid));
  assert.ok(!(code === 0 && left.length > 0), `stop reported success while pid ${left.join(', ')} of the supervisor's tree still ran`);
  assert.equal(code, 0, world.err());
  assert.deepEqual(world.kills[0], [777], 'the supervisor alone, first: dead, it cannot launch another server');
  assert.deepEqual(world.pids(), [50, 60, 61], 'the tree is gone, and nothing else is touched');
  assert.equal(fs.existsSync(statePath(home, root)), false);
  assert.match(world.out(), /stopped/);
});

test('stop kills what a child of the supervisor had started, though that child dies with the supervisor and is in no later look', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const world = fakeProcesses(supervisedTree());
  world.hooks.beforeKill = (n) => {
    // What Windows does when the supervisor, a node process, is killed: its own child (the cmd.exe of a .cmd CLI)
    // ends with it, and the server under that child stays, recording a parent that no longer exists.
    if (n === 2) world.table.splice(world.table.findIndex((row) => row.pid === 800), 1);
  };
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.deepEqual(world.pids(), [50, 60], 'the server is killed from what was read while the supervisor lived');
  assert.equal(fs.existsSync(statePath(home, root)), false);
});

test('stop sees through a server it killed: what that server started in the meantime is found and killed too', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const world = fakeProcesses(supervisedTree());
  world.hooks.beforeKill = (n, targets) => {
    // The server starts a session just before it dies: its parent is gone by the next look.
    if (targets.some(({ pid }) => pid === 800) && !world.pids().includes(950)) world.table.push({ pid: 950, ppid: 800, createdAt: CREATED + 6000 });
  };
  const code = await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps);
  const left = world.pids().filter((pid) => ![50, 60].includes(pid));
  assert.ok(!(code === 0 && left.length > 0), `stop reported success while pid ${left.join(', ')} of the supervisor's tree still ran`);
  assert.equal(code, 0, world.err());
  assert.equal(fs.existsSync(statePath(home, root)), false);
});

test('stop keeps the state, fails and names the pids when something of the tree survives, or cannot be looked for', { skip: WINDOWS_ONLY }, async () => {
  const failures = {
    'the supervisor survives its kill': { arrange: (world) => world.unkillable.add(777), says: /pid 777/ },
    'a server survives its kill': { arrange: (world) => world.unkillable.add(800), says: /still running: pid 800/ },
    'the look after the supervisor is dead fails': {
      arrange: (world) => {
        world.hooks.beforeSnapshot = () => {
          if (world.kills.length > 0) SNAPSHOT_FAILED();
        };
      },
      says: /pid 777.*could not be listed.*the process snapshot failed/s,
    },
    'processes keep appearing under it': {
      arrange: (world) => {
        // Whatever is about to be killed starts one more process first, every time.
        world.hooks.beforeKill = (n, targets) => {
          if (n > 1) world.table.push({ pid: 2000 + n, ppid: targets[0].pid, createdAt: CREATED + 7000 + n });
        };
      },
      says: /kept appearing.*pid 20\d\d/s,
    },
  };
  for (const [what, { arrange, says }] of Object.entries(failures)) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const before = fs.readFileSync(statePath(home, root), 'utf8');
    const world = fakeProcesses(supervisedTree());
    arrange(world);
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1, what);
    assert.match(world.err(), says, what);
    assert.match(world.err(), /kept/, what);
    assert.ok(world.err().includes(statePath(home, root)), world.err());
    assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), before, what);
    assert.doesNotMatch(world.out(), /stopped|not running/, what);
  }
});

/** Runs `change` on the table once stop has checked the recorded supervisor's identity, so that the next look,
 * the one its tree is read from, shows a machine that moved on in between. */
function afterTheIdentityCheck(world, change) {
  let checked = false;
  let changed = false;
  world.deps.identifyProcesses = (pids) => {
    const rows = world.deps.takeSnapshot().filter((row) => pids.includes(row.pid)).map(({ pid, createdAt }) => ({ pid, createdAt }));
    if (pids.includes(777)) checked = true;
    return rows;
  };
  world.hooks.beforeSnapshot = () => {
    if (!checked || changed) return;
    changed = true;
    change();
  };
  return { changed: () => changed };
}

test('stop kills nothing under a program that took the supervisor\'s pid between the identity check and the look its tree is read from', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const world = fakeProcesses(supervisedTree());
  const moved = afterTheIdentityCheck(world, () => {
    // The supervisor exits, its tree with it, and Windows hands its pid to another program that starts its own.
    for (const pid of [777, 800, 801]) world.table.splice(world.table.findIndex((row) => row.pid === pid), 1);
    world.table.push(
      { pid: 777, ppid: 50, createdAt: CREATED + 50_000, name: 'other.exe' },
      { pid: 910, ppid: 777, createdAt: CREATED + 51_000, name: 'other-child.exe' },
      { pid: 911, ppid: 910, createdAt: CREATED + 52_000, name: 'other-grandchild.exe' },
    );
  });
  const code = await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps);
  assert.ok(moved.changed(), 'the pid changed hands after the check, before the tree was read');
  assert.deepEqual(world.pids(), [50, 60, 777, 910, 911], 'the program that has the pid now, and what it started, are untouched');
  assert.deepEqual(world.kills, [], 'nothing is selected from a look in which the pid is not the recorded process');
  assert.equal(code, 0, world.err());
  assert.match(world.out(), /not running/);
  assert.equal(fs.existsSync(statePath(home, root)), false, 'the supervisor is proven gone');
});

test('stop kills nothing when, in the look its tree is read from, the supervisor\'s creation time cannot be read', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const before = fs.readFileSync(statePath(home, root), 'utf8');
  const world = fakeProcesses(supervisedTree());
  const moved = afterTheIdentityCheck(world, () => {
    world.table.find((row) => row.pid === 777).createdAt = null;
  });
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.ok(moved.changed());
  assert.deepEqual(world.kills, [], 'it may be the supervisor or another program: nothing under it is taken for the tree');
  assert.deepEqual(world.pids(), [50, 60, 777, 800, 801]);
  assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), before);
  assertWayOut(world, home, root, 'unreadable at the tree read');
});

test('stop refuses before killing anything when a process under the supervisor cannot be identified: the record still names a live supervisor', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const before = fs.readFileSync(statePath(home, root), 'utf8');
  // The server started a process Windows gives no creation time for, with one of its own under it.
  const world = fakeProcesses([...supervisedTree(), { pid: 802, ppid: 800, createdAt: null }, { pid: 803, ppid: 802, createdAt: CREATED + 3000 }]);
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.deepEqual(world.kills, [], 'a tree that cannot be read whole is not started on');
  assert.deepEqual(world.pids(), [50, 60, 777, 800, 801, 802, 803]);
  assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), before);
  assert.match(world.err(), /pid 802/);
  assert.match(world.err(), /creation time/);
  assert.match(world.err(), /js-harness remote stop again/);
  assert.match(world.err(), /by hand/);
  assert.match(world.err(), /kept/);
  assert.ok(world.err().includes(statePath(home, root)), world.err());
  assert.doesNotMatch(world.out(), /stopped|not running/);
});

test('stop does not report a clean tree when a later look finds a process it cannot identify', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const before = fs.readFileSync(statePath(home, root), 'utf8');
  const world = fakeProcesses(supervisedTree());
  world.hooks.beforeKill = (n) => {
    // One more server as the supervisor is about to be killed, and Windows gives no creation time for it.
    if (n === 1) world.table.push({ pid: 900, ppid: 777, createdAt: null, name: 'claude.exe' });
  };
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.ok(world.pids().includes(900), 'it cannot be killed by identity, so it is left');
  assert.match(world.err(), /pid 900/);
  assert.match(world.err(), /creation time/);
  assert.match(world.err(), /kept/);
  assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), before, 'the stop is not proven complete');
  assert.doesNotMatch(world.out(), /stopped|not running/);
});

// ---- stop and start, one at a time for a project ----------------------------------------------------------------------

test('a start that runs after stop killed the supervisor and before it removes the record is refused: stop holds the lock start takes', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const stopping = fakeWorld({ alive: new Map([[777, CREATED]]) });
  const starting = fakeWorld();
  let overlapping;
  let atTheKill;
  const kill = stopping.deps.kill;
  stopping.deps.kill = (identity) => {
    kill(identity);
    // The old supervisor is dead and its record is still there: a start now would see it gone, and record a
    // replacement that stop would then delete.
    atTheKill = readLock(home, root);
    overlapping = remoteMain(['start', '--cwd', root, '--home', home], {}, starting.deps);
  };
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, stopping.deps), 0, stopping.err());
  assert.equal(await overlapping, 1, 'the start is refused');
  assert.equal(starting.spawned.length, 0, 'and launches nothing');
  assert.match(starting.err(), /another js-harness remote start or stop is in progress/);
  assert.ok(starting.err().includes(lockPathOf(home, root)), starting.err());
  assert.deepEqual(atTheKill, { pid: process.pid, createdAt: OWN_CREATED }, 'the lock names stop while it kills');
  assert.equal(fs.existsSync(statePath(home, root)), false);
  assert.equal(fs.existsSync(lockPathOf(home, root)), false, 'and does not outlive it');
});

test('stop removes the state file only while it still holds the record it read: a replacement is kept, and said', { skip: WINDOWS_ONLY }, async () => {
  const replacement = (home, root) => writeState(home, root, { pid: 4343, startedAt: CREATED + 9 });
  const replacedWhile = {
    'the supervisor is being killed': (world, home, root) => {
      const kill = world.deps.kill;
      world.deps.kill = (identity) => {
        kill(identity);
        replacement(home, root);
      };
    },
    'a stale record is being checked': (world, home, root) => {
      world.alive.delete(777);
      const identify = world.deps.identifyProcesses;
      world.deps.identifyProcesses = (pids) => {
        if (pids.includes(777)) replacement(home, root);
        return identify(pids);
      };
    },
  };
  for (const [what, arrange] of Object.entries(replacedWhile)) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    arrange(world, home, root);
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1, what);
    assert.equal(readState(home, root).pid, 4343, `${what}: the record of another supervisor is not this stop's to delete`);
    assert.match(world.err(), /pid 4343/, what);
    assert.match(world.err(), /kept/, what);
    assert.ok(world.err().includes(statePath(home, root)), world.err());
  }
});

test('stop refuses while a start or another stop holds the lock: it kills nothing and leaves the lock and the record alone', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject();
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  writeLock(home, root, { pid: 555, createdAt: CREATED });
  const lockBefore = fs.readFileSync(lockPathOf(home, root), 'utf8');
  const stateBefore = fs.readFileSync(statePath(home, root), 'utf8');
  const world = fakeWorld({ alive: new Map([[777, CREATED], [555, CREATED]]) });
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.deepEqual(world.killed, []);
  assert.match(world.err(), /another js-harness remote start or stop is in progress/);
  assert.match(world.err(), /pid 555/);
  assert.ok(world.err().includes(lockPathOf(home, root)), world.err());
  assert.equal(fs.readFileSync(lockPathOf(home, root), 'utf8'), lockBefore);
  assert.equal(fs.readFileSync(statePath(home, root), 'utf8'), stateBefore);
});

test('stop takes a lock whose owner is proven gone, and refuses one whose owner, or its own identity, cannot be told', { skip: WINDOWS_ONLY }, async () => {
  const cases = {
    'the owner of the lock is gone': { lock: { pid: 555, createdAt: CREATED }, arrange: () => {}, code: 0, says: null },
    'the lock is not a record': { lock: 'half-writ', arrange: () => {}, code: 1, says: /removed by hand/ },
    'the command cannot read its own creation time': { lock: null, arrange: (world) => world.alive.set(process.pid, null), code: 1, says: /lock/ },
  };
  for (const [what, { lock, arrange, code, says }] of Object.entries(cases)) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    if (lock) writeLock(home, root, lock);
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    arrange(world);
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), code, `${what}: ${world.err()}`);
    assert.deepEqual(world.killed, code === 0 ? [{ pid: 777, createdAt: CREATED }] : [], what);
    assert.equal(fs.existsSync(statePath(home, root)), code !== 0, what);
    if (says) assert.match(world.err(), says, what);
    assert.equal(fs.existsSync(lockPathOf(home, root)), typeof lock === 'string', `${what}: only a lock that is not its own is left`);
  }
});

test('the lock never outlives stop: it is released when stop succeeds, finds nothing, cannot tell, or fails', { skip: WINDOWS_ONLY }, async () => {
  const ways = {
    'it stops the supervisor': { code: 0, arrange: () => {} },
    'the record is stale': { code: 0, arrange: ({ world }) => world.alive.delete(777) },
    'it cannot tell whether the supervisor runs': { code: 1, arrange: ({ world }) => world.alive.set(777, null) },
    'the kill fails': { code: 1, arrange: ({ world }) => { world.deps.kill = () => { throw new Error('still running after the kill: pid 777'); }; } },
    'nothing is recorded': { code: 0, arrange: ({ home, root }) => fs.rmSync(statePath(home, root)) },
  };
  for (const [what, { code, arrange }] of Object.entries(ways)) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    arrange({ world, home, root });
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), code, `${what}: ${world.err()}`);
    assert.equal(fs.existsSync(lockPathOf(home, root)), false, what);
  }
});

// ---- the login launcher: --at-login ------------------------------------------------------------------------------------

/** A stand-in for `%APPDATA%`, with the Startup folder Windows keeps there unless told otherwise, and for
 * `%SystemRoot%`: a folder that does not exist, so it holds no `schtasks.exe` to run. No test here may reach the
 * real ones: every command below gets these as its `APPDATA` and its `SystemRoot`. */
function makeAppData({ startup = true } = {}) {
  const base = tempDir('js-harness-remote-appdata-');
  const appData = path.join(base, 'Roaming');
  const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  fs.mkdirSync(startup ? startupDir : appData, { recursive: true });
  return { env: { APPDATA: appData, SystemRoot: path.join(base, 'Windows') }, startupDir };
}
const launcherOf = (startupDir, root) => path.join(startupDir, `js-harness-remote-${remoteId(root)}.cmd`);
const launcherRecord = (file) => ({ path: file, sha256: sha256(fs.readFileSync(file)) });
const taskNameOf = (root) => `js-harness-remote-${remoteId(root)}`;
/** What the machine manifest records for the watchdog task of `root`: its name and the command it runs, which is
 * the launcher's with `--watchdog`, through the `conhost.exe` of the `SystemRoot` the command was given. */
const taskRecord = (env, root, options = {}) => ({
  name: taskNameOf(root),
  ...watchdogTask({ node: NODE, script: SELF, root, name: path.basename(root), ...options, conhost: path.win32.join(env.SystemRoot, 'System32', 'conhost.exe') }),
});
const actionOf = ({ command, arguments: given }) => ({ command, arguments: given });
/** What the manifest of a home where js-harness was never installed holds once `--at-login` is on for a project. */
const onlyAtLogin = (launcher, task) => ({ version: null, files: [], entries: [], optional: [launcher], tasks: [task] });
const bytesOf = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);

test('start --at-login writes the launcher in the Startup folder, records it in the machine manifest, then starts the server', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  world.hooks.onSpawn = () => {
    assert.deepEqual(readManifest(home), onlyAtLogin(launcherRecord(launcherOf(startupDir, root)), taskRecord(env, root, { home })), 'the launcher and the task are there and recorded before the server is started');
  };
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());

  const file = launcherOf(startupDir, root);
  assert.deepEqual(fs.readdirSync(startupDir), [path.basename(file)], 'one file, named after the project');
  assert.equal(fs.readFileSync(file, 'utf8'), loginLauncher({ node: NODE, script: SELF, root, name: 'proj', home }));
  assert.deepEqual(readManifest(home), onlyAtLogin(launcherRecord(file), taskRecord(env, root, { home })));
  assert.equal(world.spawned.length, 1, 'then the ordinary start');
  assert.equal(world.spawned[0].args.includes('--at-login'), false, 'the supervisor is started as ever');
  assert.equal(readState(home, root).pid, 4242);
  assert.ok(world.out().includes(`login launcher: on (${file})`), world.out());
  assert.match(world.out(), /remote: started "proj"/);
});

test('the launcher repeats the options the server was started with, and names the home only when it is not the user\'s own', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  const argv = ['start', '--at-login', '--cwd', root, '--home', home, '--name', 'my phone', '--permission-mode', 'acceptEdits', '--spawn', 'worktree'];
  assert.equal(await remoteMain(argv, env, { ...world.deps, homedir: () => home.toUpperCase() }), 0, world.err());
  assert.equal(
    fs.readFileSync(launcherOf(startupDir, root), 'utf8'),
    loginLauncher({ node: NODE, script: SELF, root, name: 'my phone', permissionMode: 'acceptEdits', spawnMode: 'worktree' }),
    'no --home: at login the command finds the same home by itself',
  );
  assert.equal(world.spawned[0].args.includes('my phone'), true);
});

test('start --at-login refuses, writing and starting nothing, when the Startup folder cannot be found, and never creates it', { skip: WINDOWS_ONLY }, async () => {
  const noFolder = makeAppData({ startup: false });
  const cases = {
    'APPDATA is not set': [{}, /APPDATA/],
    'APPDATA is empty': [{ APPDATA: '' }, /APPDATA/],
    'the Startup folder does not exist': [noFolder.env, /Startup folder does not exist/],
  };
  for (const [what, [env, message]] of Object.entries(cases)) {
    const root = makeProject();
    const home = tempDir();
    const world = fakeWorld();
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1, what);
    assert.match(world.err(), message, what);
    assert.match(world.err(), /Nothing was started/, what);
    assert.equal(world.spawned.length, 0, what);
    assert.equal(fs.existsSync(manifestPath(home)), false, `${what}: nothing is recorded`);
    assert.equal(fs.existsSync(statePath(home, root)), false, what);
  }
  assert.equal(fs.existsSync(noFolder.startupDir), false, 'the folder is Windows\'s to make');
});

test('start --at-login anywhere but Windows refuses like any start, and writes nothing', async () => {
  const root = makeProject();
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld({ platform: 'linux' });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1);
  assert.match(world.err(), /Windows/);
  assert.deepEqual(fs.readdirSync(startupDir), []);
  assert.deepEqual(fs.readdirSync(home), []);
});

test('start --at-login refuses, naming it, a value cmd.exe would act on in the launcher, before anything is written', { skip: WINDOWS_ONLY }, async () => {
  const cases = {
    'the project folder': { project: 'wow!', argv: [], message: /project folder/ },
    'the server name': { project: 'proj', argv: ['--name', 'ready!'], message: /server name/ },
    'the home': { project: 'proj', home: 'my%home', argv: [], message: /the home/ },
    'the node executable': { project: 'proj', argv: [], execPath: 'C:\\R&D\\node.exe', message: /node executable/ },
  };
  for (const [what, { project, home: homeName, argv, execPath = NODE, message }] of Object.entries(cases)) {
    const root = makeProject(project);
    const home = homeName ? path.join(tempDir(), homeName) : tempDir();
    fs.mkdirSync(home, { recursive: true });
    const { env, startupDir } = makeAppData();
    const world = fakeWorld();
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login', ...argv], env, { ...world.deps, execPath }), 1, what);
    assert.match(world.err(), message, what);
    assert.match(world.err(), /cmd\.exe/, what);
    assert.deepEqual(fs.readdirSync(startupDir), [], what);
    assert.equal(fs.existsSync(manifestPath(home)), false, what);
    assert.equal(world.spawned.length, 0, what);
  }
  // Without the flag nothing of this applies: the server's own command line takes such a name.
  const root = makeProject('proj');
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', tempDir(), '--name', 'ready!'], {}, world.deps), 0, world.err());
});

test('start --at-login with the launcher already there and the server already running changes nothing and exits 0', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const first = fakeWorld();
  const argv = ['start', '--cwd', root, '--home', home, '--at-login'];
  assert.equal(await remoteMain(argv, env, first.deps), 0, first.err());
  const file = launcherOf(startupDir, root);
  const before = { launcher: fs.readFileSync(file), manifest: fs.readFileSync(manifestPath(home)), state: fs.readFileSync(statePath(home, root)) };

  const again = fakeWorld({ alive: first.alive, tasks: first.tasks });
  assert.equal(await remoteMain(argv, env, again.deps), 0, again.err());
  assert.equal(again.err(), '', 'with --at-login a server that already runs is not an error');
  assert.equal(again.spawned.length, 0);
  assert.equal(first.tasks.mutations().length, 1, 'the task that is already registered and recorded is not registered again');
  assert.ok(again.out().includes(`watchdog task: on (${taskNameOf(root)})`), again.out());
  assert.ok(again.out().includes(`login launcher: on (${file})`), again.out());
  assert.match(again.out(), /already running/);
  assert.deepEqual({ launcher: fs.readFileSync(file), manifest: fs.readFileSync(manifestPath(home)), state: fs.readFileSync(statePath(home, root)) }, before);

  // A server started without the flag gets its launcher the same way, and is left running.
  const plain = makeProject('plain');
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', plain, '--home', home], env, world.deps), 0, world.err());
  assert.equal(await remoteMain(['start', '--cwd', plain, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  assert.equal(world.spawned.length, 1);
  assert.equal(fs.existsSync(launcherOf(startupDir, plain)), true);
  assert.equal(readManifest(home).optional.length, 2, 'one record per project');
  assert.deepEqual(readManifest(home).tasks.map((task) => task.name), [taskNameOf(root), taskNameOf(plain)], 'and one task per project');
});

test('start --at-login replaces a launcher of its own from an earlier start with other options, and updates the record', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  const start = (...more) => remoteMain(['start', '--cwd', root, '--home', home, '--at-login', ...more], env, world.deps);
  assert.equal(await start('--name', 'one'), 0, world.err());
  const file = launcherOf(startupDir, root);
  const first = fs.readFileSync(file, 'utf8');

  assert.equal(await start('--name', 'two'), 0, world.err());
  assert.notEqual(fs.readFileSync(file, 'utf8'), first);
  assert.equal(fs.readFileSync(file, 'utf8'), loginLauncher({ node: NODE, script: SELF, root, name: 'two', home }));
  assert.deepEqual(readManifest(home), onlyAtLogin(launcherRecord(file), taskRecord(env, root, { name: 'two', home })), 'still one record of each, of what is there now');
  assert.deepEqual(world.tasks.store.get(taskNameOf(root)), actionOf(taskRecord(env, root, { name: 'two', home })), 'the task of the earlier start was replaced too: it was still the one recorded');
});

test('the launcher comes first: a start that then fails leaves it written and recorded, and says both', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld({ claude: null });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1);
  const file = launcherOf(startupDir, root);
  assert.deepEqual(readManifest(home), onlyAtLogin(launcherRecord(file), taskRecord(env, root, { home })));
  assert.ok(world.out().includes(`login launcher: on (${file})`), world.out());
  assert.ok(world.out().includes(`watchdog task: on (${taskNameOf(root)})`), world.out());
  assert.match(world.err(), /claude/);
  assert.equal(world.spawned.length, 0);
});

test('this command file takes start when node runs it directly, which is how the launcher runs it', () => {
  // `node bin/remote.mjs start ...`, with no dispatcher in front, here in a folder where start refuses at once.
  const notGit = tempDir();
  const result = spawnSync(process.execPath, [SELF, 'start', '--cwd', notGit, '--home', tempDir()], { encoding: 'utf8', timeout: 60000, env: { ...process.env, APPDATA: tempDir() } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not inside a git repository/, 'it parsed its arguments and ran start, which refused before starting anything');
});

test('start --at-login refuses a file at the launcher\'s path that is not its own, and leaves it untouched', { skip: WINDOWS_ONLY }, async () => {
  const cases = {
    'it is not recorded': () => {},
    'it is recorded, and was edited since': ({ home, file }) => recordOptionalFile(home, file, 'what js-harness wrote'),
  };
  for (const [what, arrange] of Object.entries(cases)) {
    const root = makeProject('proj');
    const home = tempDir();
    const { env, startupDir } = makeAppData();
    const file = launcherOf(startupDir, root);
    fs.writeFileSync(file, '@echo the user was here\r\n');
    arrange({ home, file });
    const manifest = fs.existsSync(manifestPath(home)) ? fs.readFileSync(manifestPath(home), 'utf8') : null;
    const world = fakeWorld();
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1, what);
    assert.equal(fs.readFileSync(file, 'utf8'), '@echo the user was here\r\n', what);
    assert.equal(fs.existsSync(manifestPath(home)) ? fs.readFileSync(manifestPath(home), 'utf8') : null, manifest, `${what}: the manifest is as it was`);
    assert.ok(world.err().includes(file), world.err());
    assert.match(world.err(), /Nothing was started/, what);
    assert.equal(world.spawned.length, 0, what);
  }
});

test('start --at-login adopts a launcher with the very content it would write that no record names', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const file = launcherOf(startupDir, root);
  fs.writeFileSync(file, loginLauncher({ node: NODE, script: SELF, root, name: 'proj', home })); // a start that died before recording it
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  assert.deepEqual(readManifest(home), onlyAtLogin(launcherRecord(file), taskRecord(env, root, { home })));
});

test('start --at-login leaves no launcher that no record names: when recording fails, the file it wrote is removed again', { skip: WINDOWS_ONLY }, async () => {
  const cannotRecord = () => { throw new Error('EACCES: permission denied, open manifest.json'); };
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  const argv = ['start', '--cwd', root, '--home', home, '--at-login'];
  assert.equal(await remoteMain(argv, env, { ...world.deps, recordOptionalFile: cannotRecord }), 1);
  assert.deepEqual(fs.readdirSync(startupDir), [], 'the launcher is gone again');
  assert.match(world.err(), /EACCES/);
  assert.match(world.err(), /removed again/);
  assert.equal(world.spawned.length, 0, 'and nothing was started');
});

test('start --at-login that cannot record the launcher it replaced puts the earlier one back: the file and its record are as they were', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  const argv = ['start', '--cwd', root, '--home', home, '--at-login'];
  assert.equal(await remoteMain(argv, env, world.deps), 0, world.err());
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], env, world.deps), 0, world.err());
  const file = launcherOf(startupDir, root);
  const before = { launcher: fs.readFileSync(file), manifest: fs.readFileSync(manifestPath(home)) };

  const failing = fakeWorld({ tasks: world.tasks });
  const seen = [];
  const recordOptionalFile = () => {
    seen.push(fs.readFileSync(file, 'utf8'));
    throw new Error('EACCES: permission denied, open manifest.json');
  };
  assert.equal(await remoteMain([...argv, '--name', 'other'], env, { ...failing.deps, recordOptionalFile }), 1);
  assert.match(seen[0], /--name other/, 'the new launcher had been written when recording it failed');
  assert.deepEqual({ launcher: fs.readFileSync(file), manifest: fs.readFileSync(manifestPath(home)) }, before, 'the earlier launcher still works, and its record still names it');
  assert.match(failing.err(), /EACCES/);
  assert.match(failing.err(), /earlier launcher was put back/);
  assert.equal(failing.spawned.length, 0);
  assert.equal(world.tasks.mutations().length, 1, 'the task of the earlier start was not touched: the launcher failed before it');
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], env, fakeWorld({ tasks: world.tasks }).deps), 0, 'and it is still removed exactly');
  assert.deepEqual(fs.readdirSync(startupDir), []);
  assert.equal(world.tasks.store.size, 0);
});

test('start --at-login says so, naming the file, when the earlier launcher cannot be put back either', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  const argv = ['start', '--cwd', root, '--home', home, '--at-login'];
  assert.equal(await remoteMain(argv, env, world.deps), 0, world.err());
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], env, world.deps), 0, world.err());
  const file = launcherOf(startupDir, root);

  const failing = fakeWorld({ tasks: world.tasks });
  const recordOptionalFile = () => {
    // A folder takes the launcher's place, so nothing can be written there any more.
    fs.rmSync(file);
    fs.mkdirSync(file);
    throw new Error('EACCES: permission denied, open manifest.json');
  };
  assert.equal(await remoteMain([...argv, '--name', 'other'], env, { ...failing.deps, recordOptionalFile }), 1);
  assert.match(failing.err(), /EACCES/);
  assert.match(failing.err(), /could not be put back/);
  assert.ok(failing.err().includes(file), failing.err());
  assert.match(failing.err(), /by hand/);
  assert.equal(failing.spawned.length, 0);
});

test('start --at-login refuses a name it cannot use before the launcher is written: a repository at a drive root has no folder name', { skip: WINDOWS_ONLY }, async () => {
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  // No test can make a repository at a drive root, so git's answer is given: the folder name of `Q:\` is empty.
  const deps = { ...world.deps, gitTopLevel: () => 'Q:/' };
  const argv = ['start', '--cwd', tempDir(), '--home', home, '--at-login'];
  assert.equal(await remoteMain(argv, env, deps), 1);
  assert.match(world.err(), /cannot name the server/);
  assert.match(world.err(), /pass --name/);
  assert.deepEqual(fs.readdirSync(startupDir), [], 'a launcher left on would repeat a start that refuses at every login');
  assert.equal(fs.existsSync(manifestPath(home)), false, 'and nothing is recorded');
  assert.equal(world.spawned.length, 0);

  assert.equal(await remoteMain([...argv, '--name', 'drive root'], env, deps), 0, world.err());
  assert.match(fs.readFileSync(path.join(startupDir, fs.readdirSync(startupDir)[0]), 'utf8'), /start --cwd Q:\\ --name "drive root"/);
});

test('stop --at-login removes the launcher and its record, then stops the server: the home holds no manifest again', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  const file = launcherOf(startupDir, root);

  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  assert.deepEqual(fs.readdirSync(startupDir), []);
  assert.equal(fs.existsSync(startupDir), true);
  assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest the start made is removed with its last record');
  assert.deepEqual(world.killed, [{ pid: 4242, createdAt: CREATED + 5 }], 'then the ordinary stop');
  assert.equal(fs.existsSync(statePath(home, root)), false);
  assert.ok(world.out().includes(`login launcher: off (removed ${file})`), world.out());
  assert.ok(world.out().includes(`watchdog task: off (deleted ${taskNameOf(root)})`), world.out());
  assert.equal(world.tasks.store.size, 0, 'the task is deleted with the launcher');
  assert.deepEqual(world.tasks.mutations().at(-1), ['/Delete', '/TN', taskNameOf(root), '/F']);
  assert.match(world.out(), /remote: stopped/);

  // With no server running it is not an error either, and a launcher or a task that is not there is not one.
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  assert.equal(world.err(), '');
  assert.match(world.out(), /watchdog task: off \(there was none\)/);
});

test('a plain stop leaves the launcher and its record alone', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  const file = launcherOf(startupDir, root);
  const before = { launcher: fs.readFileSync(file), manifest: fs.readFileSync(manifestPath(home)), calls: world.tasks.calls.length };
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], env, world.deps), 0, world.err());
  assert.deepEqual({ launcher: fs.readFileSync(file), manifest: fs.readFileSync(manifestPath(home)) }, { launcher: before.launcher, manifest: before.manifest });
  assert.doesNotMatch(world.out(), /login launcher: off|watchdog task: off/);
  assert.match(world.out(), /remote: stopped/);
  assert.equal(world.tasks.store.has(taskNameOf(root)), true, 'the task stays registered');
  assert.equal(world.tasks.calls.length, before.calls, 'a plain stop does not even look at the scheduled tasks');
});

test('stop --at-login keeps a launcher that is not as js-harness wrote it, says so, still stops the server, and fails', { skip: WINDOWS_ONLY }, async () => {
  const cases = {
    'it was edited since': ({ file }) => fs.appendFileSync(file, 'rem the user was here\r\n'),
    'no record names it': ({ home, file }) => forgetOptionalFile(home, file),
  };
  for (const [what, arrange] of Object.entries(cases)) {
    const root = makeProject('proj');
    const home = tempDir();
    const { env, startupDir } = makeAppData();
    const world = fakeWorld();
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
    const file = launcherOf(startupDir, root);
    arrange({ home, file });
    const before = { launcher: fs.readFileSync(file), records: readManifest(home).optional };

    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1, what);
    assert.deepEqual({ launcher: fs.readFileSync(file), records: readManifest(home)?.optional }, before, `${what}: kept, with what the manifest said of it`);
    assert.equal(world.tasks.store.size, 0, `${what}: the task, which is still as it was registered, is deleted all the same`);
    assert.ok(world.err().includes(file), world.err());
    assert.match(world.err(), /kept/, what);
    assert.deepEqual(world.killed, [{ pid: 4242, createdAt: CREATED + 5 }], `${what}: the server is stopped all the same`);
    assert.equal(fs.existsSync(statePath(home, root)), false, what);
  }
});

test('stop --at-login removes the file before its record: a record that cannot be removed is said, never a launcher left that no record names', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  const file = launcherOf(startupDir, root);
  const seen = [];
  const forgetOptionalFile = () => {
    seen.push(fs.existsSync(file));
    throw new Error('EACCES: permission denied, open manifest.json');
  };
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], env, { ...world.deps, forgetOptionalFile }), 1);
  assert.deepEqual(seen, [false], 'the file was gone when its record was to be forgotten');
  assert.match(world.err(), /was removed, but its record .* could not be \(EACCES/);
  assert.match(world.err(), /js-harness remote stop --at-login again/);
  assert.deepEqual(world.killed, [{ pid: 4242, createdAt: CREATED + 5 }], 'the server is stopped all the same');

  // The record that is left names a file that is gone: the next stop --at-login forgets it.
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0);
  assert.equal(fs.existsSync(manifestPath(home)), false);
});

test('stop --at-login forgets the record of a launcher that is already gone', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  fs.rmSync(launcherOf(startupDir, root));
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  assert.equal(fs.existsSync(manifestPath(home)), false);
  assert.match(world.out(), /login launcher: off/);
});

test('stop --at-login that cannot find the Startup folder still stops the server, and fails', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  writeState(home, root, { pid: 777, startedAt: CREATED });
  const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], {}, world.deps), 1);
  assert.match(world.err(), /APPDATA/);
  assert.deepEqual(world.killed, [{ pid: 777, createdAt: CREATED }]);
  assert.equal(fs.existsSync(statePath(home, root)), false);
});

test('uninstall removes the launcher start --at-login wrote and deletes the task it registered, and leaves the Startup folder', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  const file = launcherOf(startupDir, root);
  const result = uninstall(home, { schtasks: world.tasks.run, identify: world.deps.identifyProcesses });
  assert.deepEqual(result.removed, [file]);
  // The server this start left running is not stopped by an uninstall: its folder stays, and is said.
  assert.deepEqual(result.remoteKept.map(({ path: kept, reason }) => [kept, reason]), [[remoteDir(home), 'in-use']]);
  assert.deepEqual({ tasksRemoved: result.tasksRemoved, tasksKept: result.tasksKept }, { tasksRemoved: [taskNameOf(root)], tasksKept: [] });
  assert.deepEqual(fs.readdirSync(startupDir), []);
  assert.equal(world.tasks.store.size, 0);
  assert.equal(fs.existsSync(manifestPath(home)), false);
});

test('status says whether the login launcher is on for this repository, and exits as it did', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const file = launcherOf(startupDir, root);
  const statusLine = async (world = fakeWorld(), environment = env) => {
    const code = await remoteMain(['status', '--cwd', root, '--home', home], environment, world.deps);
    return { code, line: world.out().split('\n').find((line) => line.startsWith('login launcher: ')) };
  };

  assert.deepEqual(await statusLine(), { code: 0, line: 'login launcher: off' });

  const world = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  assert.deepEqual(await statusLine(fakeWorld({ alive: world.alive })), { code: 0, line: `login launcher: on (${file})` });

  fs.appendFileSync(file, 'rem the user was here\r\n');
  assert.match((await statusLine()).line, /^login launcher: on \(.*changed since js-harness wrote it\)$/);

  forgetOptionalFile(home, file);
  assert.match((await statusLine()).line, /^login launcher: off \(a file js-harness did not record is at /, 'on means the file is there and recorded');

  const noAppData = await statusLine(fakeWorld(), {});
  assert.equal(noAppData.code, 0);
  assert.match(noAppData.line, /^login launcher: unknown \(APPDATA is not set/);

  // The line never changes the exit code, in either direction: a status that cannot tell still fails.
  const unknown = fakeWorld({ alive: world.alive });
  unknown.alive.set(4242, null);
  assert.equal((await statusLine(unknown)).code, 1);
});

test('--at-login is a switch of start and stop only, and the usage line says what it does', async () => {
  const root = makeProject();
  const world = fakeWorld();
  assert.equal(await remoteMain(['status', '--cwd', root, '--at-login'], {}, world.deps), 2);
  assert.match(world.err(), /unknown argument: --at-login/);
  assert.match(world.err(), /start and stop also take \[--at-login\]/);
  assert.match(world.err(), /Startup folder/);
});

// ---- the watchdog: the scheduled task --at-login registers beside the launcher -----------------------------------------

/** One project with `--at-login` on: the launcher written, the task registered, both recorded, the server started. */
async function atLoginOn(more = []) {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  const argv = ['start', '--cwd', root, '--home', home, '--at-login'];
  assert.equal(await remoteMain([...argv, ...more], env, world.deps), 0, world.err());
  return { root, home, env, startupDir, world, argv, file: launcherOf(startupDir, root), task: taskNameOf(root) };
}
/** The launcher and the machine manifest, byte for byte (`null` for one that is not there). */
const whatIsThere = ({ home, file }) => ({ launcher: bytesOf(file), manifest: bytesOf(manifestPath(home)) });
const CANNOT_RECORD = () => { throw new Error('EACCES: permission denied, open manifest.json'); };

test('start --at-login registers the watchdog task from an XML file it then removes: the launcher\'s command with --watchdog, every five minutes', { skip: WINDOWS_ONLY }, async () => {
  const { root, home, env, world, task } = await atLoginOn();
  const record = taskRecord(env, root, { home });
  assert.equal(record.command, path.win32.join(env.SystemRoot, 'System32', 'conhost.exe'), 'conhost.exe by its full path, from the SystemRoot the command was given');
  assert.match(record.arguments, /^--headless .* start --cwd .* --name proj .*--watchdog$/);
  assert.doesNotMatch(record.arguments, /--at-login/);

  const [{ xml, file: xmlFile }] = world.tasks.registered;
  assert.deepEqual(world.tasks.mutations(), [['/Create', '/TN', task, '/XML', xmlFile, '/F']], 'one task, by name, and nothing else changed');
  assert.equal(xml, watchdogTaskXml(record));
  assert.equal(path.dirname(xmlFile), stateDir(home), 'the XML is written under the home, never in a shared temp folder');
  assert.equal(fs.existsSync(xmlFile), false, 'and removed once schtasks has read it');
  assert.deepEqual(world.tasks.store.get(task), actionOf(record));
  assert.deepEqual(readManifest(home).tasks, [record], 'recorded by name and by the command it runs');
  assert.ok(world.out().includes(`watchdog task: on (${task})`), world.out());
});

test('start --at-login refuses before anything is written when the task cannot be registered as it must be, or looked for', { skip: WINDOWS_ONLY }, async () => {
  const cases = {
    'SystemRoot is not set': { environment: (env) => ({ APPDATA: env.APPDATA }), message: /SystemRoot/ },
    'the tasks cannot be listed': { arrange: (tasks) => { tasks.fail.list = 1; }, message: /could not be listed/, byHand: true },
    'schtasks cannot run': { arrange: (tasks) => { tasks.fail.list = new Error('schtasks.exe could not run: spawnSync ENOENT'); }, message: /could not run/, byHand: true },
  };
  for (const [what, { environment = (env) => env, project = 'proj', arrange = () => {}, message, byHand }] of Object.entries(cases)) {
    const root = makeProject(project);
    const home = tempDir();
    const { env, startupDir } = makeAppData();
    const world = fakeWorld();
    arrange(world.tasks);
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], environment(env), world.deps), 1, what);
    assert.match(world.err(), message, what);
    assert.match(world.err(), /Nothing was started/, what);
    if (byHand) assert.ok(world.err().includes(`schtasks /Query /TN ${taskNameOf(root)}`), `${what}: it says how to look by hand: ${world.err()}`);
    assert.deepEqual(fs.readdirSync(startupDir), [], `${what}: no launcher`);
    assert.equal(fs.existsSync(manifestPath(home)), false, `${what}: nothing is recorded`);
    assert.deepEqual(world.tasks.mutations(), [], `${what}: nothing is registered`);
    assert.equal(world.spawned.length, 0, what);
  }
});

/** Schtasks that must not be run at all. */
const NO_SCHTASKS = () => { throw new Error('schtasks must not be run here'); };
const watchdogLines = (world) => world.out().split('\n').filter((line) => line.startsWith('watchdog task: '));

test('start --at-login with a value only the launcher can hold does what it did before the watchdog: the launcher on, the server started, no task, and one line that says why', { skip: WINDOWS_ONLY }, async () => {
  const cases = {
    'the project folder': { project: 'año', argv: [], held: (root) => root, label: /the project folder/ },
    'the server name': { project: 'proj', argv: ['--name', 'café'], held: () => 'café', label: /the server name/ },
  };
  for (const [what, { project, argv, held, label }] of Object.entries(cases)) {
    const root = makeProject(project);
    const home = tempDir();
    const { env, startupDir } = makeAppData();
    const world = fakeWorld();
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login', ...argv], env, { ...world.deps, schtasks: NO_SCHTASKS }), 0, `${what}: ${world.err()}`);
    const file = launcherOf(startupDir, root);
    assert.equal(world.err(), '', what);
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], optional: [launcherRecord(file)] }, `${what}: the launcher is recorded, and no task is`);
    assert.match(fs.readFileSync(file, 'utf8'), /chcp 65001/, `${what}: the launcher carries the value, as before`);
    assert.equal(world.spawned.length, 1, `${what}: the server is started`);
    assert.ok(world.out().includes(`login launcher: on (${file})`), world.out());
    const [line, ...more] = watchdogLines(world);
    assert.deepEqual(more, [], `${what}: one line`);
    assert.match(line, /^watchdog task: off, not registered: the scheduled task cannot hold/, what);
    assert.match(line, label, what);
    assert.ok(line.includes(JSON.stringify(held(root))), `${what}: it names the value: ${line}`);
    assert.match(line, /the login launcher still starts the server at every login/, what);

    // Status shows the launcher on and the watchdog off; stop --at-login has no task and no record to deal with.
    const told = fakeWorld({ alive: world.alive });
    assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], env, told.deps), 0);
    assert.ok(told.out().includes(`login launcher: on (${file})`), told.out());
    assert.deepEqual(watchdogLines(told), ['watchdog task: off']);
    const stopping = fakeWorld({ alive: world.alive });
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home, '--at-login'], env, stopping.deps), 0, stopping.err());
    assert.deepEqual(watchdogLines(stopping), ['watchdog task: off (there was none)']);
    assert.deepEqual(stopping.tasks.mutations(), [], what);
    assert.deepEqual(fs.readdirSync(startupDir), [], what);
    assert.equal(fs.existsSync(manifestPath(home)), false, what);
  }

  // The exit code is the start's own, and uninstall undoes it without ever running schtasks: nothing records a task.
  const root = makeProject('año');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld({ claude: null });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1);
  assert.match(world.err(), /claude/);
  assert.deepEqual(world.tasks.calls, [], 'decided before anything is written: schtasks is not even asked');
  // No server was started, so nothing lives by the folder the start wrote its log in: it goes with the launcher.
  const result = uninstall(home, { schtasks: NO_SCHTASKS, identify: world.deps.identifyProcesses });
  assert.deepEqual({ removed: result.removed, tasksRemoved: result.tasksRemoved, tasksKept: result.tasksKept, remoteKept: result.remoteKept }, { removed: [launcherOf(startupDir, root), remoteDir(home)], tasksRemoved: [], tasksKept: [], remoteKept: [] });
});

test('a task recorded by an earlier start is not left running the earlier options when the new ones cannot be carried: it is deleted and forgotten, or the start refuses', { skip: WINDOWS_ONLY }, async () => {
  const on = await atLoginOn();
  assert.equal(await remoteMain([...on.argv, '--name', 'café'], on.env, on.world.deps), 0, on.world.err());
  assert.equal(on.world.tasks.store.size, 0, 'the earlier task, still as it was registered, is deleted');
  assert.deepEqual(readManifest(on.home), { version: null, files: [], entries: [], optional: [launcherRecord(on.file)] }, 'and its record forgotten');
  assert.match(fs.readFileSync(on.file, 'utf8'), /--name "café"/, 'the launcher is the new one');
  assert.match(watchdogLines(on.world).at(-1), /^watchdog task: off, not registered: .*"café".*the task registered earlier, which ran the earlier options, was deleted/);

  // What cannot be retired safely refuses the whole start, before anything is written.
  const refusals = {
    'it was edited since': [(tasks, task) => tasks.store.set(task, { command: 'calc.exe', arguments: '' }), /changed since js-harness registered it/],
    'it cannot be looked at': [(tasks) => { tasks.fail.list = 1; }, /could not be listed/],
    'it cannot be deleted': [(tasks) => { tasks.fail.delete = 5; }, /could not be deleted .*exited 5/],
  };
  for (const [what, [arrange, message]] of Object.entries(refusals)) {
    const earlier = await atLoginOn();
    arrange(earlier.world.tasks, earlier.task);
    const before = { ...whatIsThere(earlier), task: earlier.world.tasks.store.get(earlier.task) };
    assert.equal(await remoteMain([...earlier.argv, '--name', 'café'], earlier.env, earlier.world.deps), 1, what);
    assert.match(earlier.world.err(), message, what);
    assert.match(earlier.world.err(), /Nothing was started/, what);
    assert.deepEqual({ ...whatIsThere(earlier), task: earlier.world.tasks.store.get(earlier.task) }, before, `${what}: the launcher, the manifest and the task are as they were`);
  }
});

test('start --at-login refuses a task of that name that is not its own, and leaves it and everything else untouched', { skip: WINDOWS_ONLY }, async () => {
  const theirs = { command: 'calc.exe', arguments: '' };
  const cases = {
    'no record names it': () => {},
    'it is recorded, and was changed since': ({ home, root }) => recordScheduledTask(home, { name: taskNameOf(root), command: 'conhost.exe', arguments: 'what js-harness registered' }),
  };
  for (const [what, arrange] of Object.entries(cases)) {
    const root = makeProject('proj');
    const home = tempDir();
    const { env, startupDir } = makeAppData();
    const world = fakeWorld({ tasks: fakeSchtasks({ [taskNameOf(root)]: theirs }) });
    arrange({ home, root });
    const manifest = bytesOf(manifestPath(home));
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1, what);
    assert.deepEqual(world.tasks.store.get(taskNameOf(root)), theirs, what);
    assert.deepEqual(world.tasks.mutations(), [], what);
    assert.ok(world.err().includes(`schtasks /Delete /TN ${taskNameOf(root)} /F`), `${what}: it says how to remove it by hand: ${world.err()}`);
    assert.match(world.err(), /Nothing was started/, what);
    assert.deepEqual(fs.readdirSync(startupDir), [], `${what}: no launcher is written beside a task that is not ours`);
    assert.equal(bytesOf(manifestPath(home)), manifest, `${what}: the manifest is as it was`);
    assert.equal(world.spawned.length, 0, what);
  }
});

test('start --at-login adopts a task that already runs the very command it would register and that no record names', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env } = makeAppData();
  const record = taskRecord(env, root, { home });
  const world = fakeWorld({ tasks: fakeSchtasks({ [record.name]: record }) }); // a start that died before recording it
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  assert.deepEqual(world.tasks.mutations(), [], 'it is not registered a second time');
  assert.deepEqual(readManifest(home).tasks, [record]);
});

test('all or nothing: when the task cannot be registered, start --at-login fails and the launcher, its record and the manifest are as they were', { skip: WINDOWS_ONLY }, async () => {
  // Nothing was on before: the launcher this command wrote is removed again, with the manifest it made.
  for (const failure of [1, new Error('schtasks.exe could not run: spawnSync EPERM')]) {
    const root = makeProject('proj');
    const home = tempDir();
    const { env, startupDir } = makeAppData();
    const world = fakeWorld();
    world.tasks.fail.create = failure;
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1);
    assert.match(world.err(), /the watchdog task is not on/);
    assert.match(world.err(), failure === 1 ? /exited 1/ : /EPERM/);
    assert.match(world.err(), /as they were before this command/);
    assert.match(world.err(), /Nothing was started/);
    assert.deepEqual(fs.readdirSync(startupDir), [], 'the launcher this command wrote is gone again');
    assert.equal(fs.existsSync(manifestPath(home)), false, 'with its record, and the manifest that held it');
    assert.equal(fs.readdirSync(stateDir(home)).some((name) => name.endsWith('.xml')), false, 'and no XML file is left');
    assert.equal(world.tasks.store.size, 0);
    assert.equal(world.spawned.length, 0);
    assert.doesNotMatch(world.out(), /login launcher: on|watchdog task: on/, 'it never said either was on');
  }

  // It was already on, with other options: the launcher that was on stays on, with its record, and so does its task.
  const on = await atLoginOn(['--name', 'one']);
  const before = { ...whatIsThere(on), task: on.world.tasks.store.get(on.task) };
  on.world.tasks.fail.create = 1;
  assert.equal(await remoteMain([...on.argv, '--name', 'two'], on.env, on.world.deps), 1);
  assert.deepEqual({ ...whatIsThere(on), task: on.world.tasks.store.get(on.task) }, before);
  assert.match(on.world.err(), /as they were before this command/);
  assert.equal(on.world.spawned.length, 1, 'only the first start launched anything');
});

test('a task that cannot be recorded is not left registered: it is deleted again, or the earlier one registered again from its record', { skip: WINDOWS_ONLY }, async () => {
  // First time: the task this command registered is deleted again, and the launcher goes with it.
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  const argv = ['start', '--cwd', root, '--home', home, '--at-login'];
  assert.equal(await remoteMain(argv, env, { ...world.deps, recordScheduledTask: CANNOT_RECORD }), 1);
  assert.deepEqual(world.tasks.mutations().map((args) => args[0]), ['/Create', '/Delete']);
  assert.equal(world.tasks.store.size, 0, 'a task that no record names would outlive every uninstall');
  assert.match(world.err(), /EACCES/);
  assert.match(world.err(), /deleted again/);
  assert.match(world.err(), /Nothing was started/);
  assert.deepEqual(fs.readdirSync(startupDir), []);
  assert.equal(fs.existsSync(manifestPath(home)), false);
  assert.equal(world.spawned.length, 0);

  // Replacing its own: the earlier task is registered again from what its record says, and the rest is as it was.
  const on = await atLoginOn(['--name', 'one']);
  const before = { ...whatIsThere(on), task: on.world.tasks.store.get(on.task) };
  assert.equal(await remoteMain([...on.argv, '--name', 'two'], on.env, { ...on.world.deps, recordScheduledTask: CANNOT_RECORD }), 1);
  assert.deepEqual({ ...whatIsThere(on), task: on.world.tasks.store.get(on.task) }, before);
  assert.deepEqual(on.world.tasks.mutations().map((args) => args[0]), ['/Create', '/Create', '/Create'], 'registered, replaced, put back');
  assert.match(on.world.err(), /earlier task was registered again/);

  // And when it cannot be deleted again either, it says which task is left with no record, and how to delete it.
  const stuck = { root: makeProject('proj'), home: tempDir(), ...makeAppData(), world: fakeWorld() };
  stuck.world.tasks.fail.delete = 5;
  assert.equal(await remoteMain(['start', '--cwd', stuck.root, '--home', stuck.home, '--at-login'], stuck.env, { ...stuck.world.deps, recordScheduledTask: CANNOT_RECORD }), 1);
  assert.equal(stuck.world.tasks.store.has(taskNameOf(stuck.root)), true);
  assert.match(stuck.world.err(), /could not be deleted again .*exited 5/);
  assert.match(stuck.world.err(), /no record names/);
  assert.ok(stuck.world.err().includes(`schtasks /Delete /TN ${taskNameOf(stuck.root)} /F`), stuck.world.err());
});

test('a task that does not read back as it was registered is not kept: nothing could tell it later from one edited by hand', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  const run = world.tasks.run;
  // A Task Scheduler that changes what it is handed (here, a second space) between the registration and the look.
  world.tasks.run = (args) => {
    const result = run(args);
    const stored = world.tasks.store.get(args[2]);
    if (args[0] === '/Create') world.tasks.store.set(args[2], { ...stored, arguments: stored.arguments.replace('--headless ', '--headless  ') });
    return result;
  };
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1);
  assert.match(world.err(), /does not read back as it was registered/);
  assert.match(world.err(), /deleted again/);
  assert.equal(world.tasks.store.size, 0);
  assert.deepEqual(fs.readdirSync(startupDir), []);
  assert.equal(fs.existsSync(manifestPath(home)), false);
  assert.equal(world.spawned.length, 0);
});

test('stop --at-login keeps a task that is not as js-harness registered it, says so, still stops the server, and fails', { skip: WINDOWS_ONLY }, async () => {
  const cases = {
    'it was edited since': ({ world, task }) => world.tasks.store.set(task, { command: 'calc.exe', arguments: '' }),
    'no record names it': ({ home, task }) => forgetScheduledTask(home, task),
  };
  for (const [what, arrange] of Object.entries(cases)) {
    const on = await atLoginOn();
    arrange(on);
    const before = { task: on.world.tasks.store.get(on.task), records: readManifest(on.home).tasks };
    assert.equal(await remoteMain(['stop', '--cwd', on.root, '--home', on.home, '--at-login'], on.env, on.world.deps), 1, what);
    assert.deepEqual({ task: on.world.tasks.store.get(on.task), records: readManifest(on.home)?.tasks }, before, `${what}: kept, with what the manifest said of it`);
    assert.equal(on.world.tasks.mutations().length, 1, `${what}: nothing was asked of schtasks but to look, after the registration`);
    assert.ok(on.world.err().includes(on.task), on.world.err());
    assert.match(on.world.err(), /kept/, what);
    assert.ok(on.world.err().includes(`schtasks /Delete /TN ${on.task} /F`), `${what}: it says how to delete it by hand`);
    assert.deepEqual(fs.readdirSync(on.startupDir), [], `${what}: the launcher, which is as it was written, is removed all the same`);
    assert.deepEqual(on.world.killed, [{ pid: 4242, createdAt: CREATED + 5 }], `${what}: the server is stopped all the same`);
  }
});

test('stop --at-login deletes nothing and forgets nothing when it could not look at the task, or could not delete it', { skip: WINDOWS_ONLY }, async () => {
  const cases = {
    'the tasks cannot be listed': { fail: { list: 1 }, message: /could not be looked for.*could not be listed/, byHand: true },
    'the task is listed and cannot be read': { fail: { read: 1 }, message: /could not be looked for.*could not be read/, byHand: true },
    'schtasks cannot run': { fail: { list: new Error('schtasks.exe could not run: spawnSync ENOENT') }, message: /could not be looked for.*could not run/, byHand: true },
    'the delete fails': { fail: { delete: 5 }, message: /could not be deleted .*exited 5/ },
  };
  for (const [what, { fail, message, byHand }] of Object.entries(cases)) {
    const on = await atLoginOn();
    const records = readManifest(on.home).tasks;
    Object.assign(on.world.tasks.fail, fail);
    assert.equal(await remoteMain(['stop', '--cwd', on.root, '--home', on.home, '--at-login'], on.env, on.world.deps), 1, what);
    assert.match(on.world.err(), message, what);
    if (byHand) assert.ok(on.world.err().includes(`schtasks /Query /TN ${on.task}`), `${what}: it says how to look by hand: ${on.world.err()}`);
    assert.equal(on.world.tasks.store.has(on.task), true, `${what}: the task is still registered`);
    assert.deepEqual(readManifest(on.home).tasks, records, `${what}: and still recorded, so nothing is left that no record names`);
    assert.deepEqual(on.world.killed, [{ pid: 4242, createdAt: CREATED + 5 }], `${what}: the server is stopped all the same`);

    // Once schtasks answers again, the same command finishes the job.
    for (const verb of Object.keys(fail)) delete on.world.tasks.fail[verb];
    assert.equal(await remoteMain(['stop', '--cwd', on.root, '--home', on.home, '--at-login'], on.env, on.world.deps), 0, what);
    assert.equal(on.world.tasks.store.size, 0, what);
    assert.equal(fs.existsSync(manifestPath(on.home)), false, what);
  }
});

test('stop --at-login deletes the task before its record: a record that cannot be removed is said, never a task left that no record names', { skip: WINDOWS_ONLY }, async () => {
  const on = await atLoginOn();
  const seen = [];
  const cannotForget = () => {
    seen.push(on.world.tasks.store.has(on.task));
    throw new Error('EACCES: permission denied, open manifest.json');
  };
  assert.equal(await remoteMain(['stop', '--cwd', on.root, '--home', on.home, '--at-login'], on.env, { ...on.world.deps, forgetScheduledTask: cannotForget }), 1);
  assert.deepEqual(seen, [false], 'the task was gone when its record was to be forgotten');
  assert.match(on.world.err(), /was deleted, but its record .* could not be removed \(EACCES/);
  assert.match(on.world.err(), /js-harness remote stop --at-login again/);

  // The record that is left names a task that is gone: the next stop --at-login forgets it.
  assert.equal(await remoteMain(['stop', '--cwd', on.root, '--home', on.home, '--at-login'], on.env, on.world.deps), 0);
  assert.match(on.world.out(), /watchdog task: off \(the task was already gone, and its record was removed\)/);
  assert.equal(fs.existsSync(manifestPath(on.home)), false);
});

test('status says whether the watchdog task is on for this repository, after the launcher line, and exits as it did', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const { env } = makeAppData();
  const tasks = fakeSchtasks();
  const task = taskNameOf(root);
  const status = async () => {
    const world = fakeWorld({ tasks });
    const code = await remoteMain(['status', '--cwd', root, '--home', home], env, world.deps);
    const lines = world.out().split('\n');
    return { code, line: lines.find((line) => line.startsWith('watchdog task: ')), after: lines[lines.findIndex((line) => line.startsWith('watchdog task: ')) - 1] };
  };

  assert.deepEqual(await status(), { code: 0, line: 'watchdog task: off', after: 'login launcher: off' });

  const world = fakeWorld({ tasks });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 0, world.err());
  assert.equal((await status()).line, `watchdog task: on (${task})`);

  const registered = tasks.store.get(task);
  tasks.store.set(task, { command: 'calc.exe', arguments: '' });
  assert.equal((await status()).line, `watchdog task: on (${task}, changed since js-harness registered it)`);

  const record = readManifest(home).tasks[0];
  forgetScheduledTask(home, task);
  assert.equal((await status()).line, `watchdog task: off (a task js-harness did not record is registered as ${task})`, 'on means the task is there and recorded');

  recordScheduledTask(home, record);
  tasks.store.clear();
  assert.equal((await status()).line, `watchdog task: off (recorded, but the task is gone: ${task})`);

  // When it cannot look it says so and how to look by hand, and the exit code is the server's, as with the launcher.
  tasks.store.set(task, registered);
  tasks.fail.list = 1;
  const unknown = await status();
  assert.equal(unknown.code, 0);
  assert.match(unknown.line, /^watchdog task: unknown \(.*could not be listed/);
  assert.ok(unknown.line.includes(`schtasks /Query /TN ${task}`), unknown.line);
  assert.equal(tasks.mutations().length, 1, 'status only ever looks: the one change is the registration above');
});

test('with no schtasks injected a command cannot reach the real one from a test: status cannot look, and start --at-login writes nothing', { skip: WINDOWS_ONLY }, async () => {
  // Never the real SystemRoot here: were the refusal ever removed, the one handed over holds no schtasks.exe to run.
  const { env, startupDir } = makeAppData();
  for (const [what, environment] of Object.entries({ 'a SystemRoot that holds no schtasks.exe': env, 'no SystemRoot': { APPDATA: env.APPDATA } })) {
    const root = makeProject('proj');
    const home = tempDir();
    const world = fakeWorld();
    const { schtasks, ...deps } = world.deps;
    assert.equal(typeof schtasks, 'function', 'every fake world has a fake, and this test takes it away');
    assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], environment, deps), 0, what);
    assert.match(world.out(), /^watchdog task: unknown \(the real schtasks\.exe is never run from a test/m, what);
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], environment, deps), 1, what);
    assert.match(world.err(), environment === env ? /never run from a test/ : /SystemRoot is not set/, what);
    assert.deepEqual(fs.readdirSync(startupDir), [], what);
    assert.equal(fs.existsSync(manifestPath(home)), false, what);
    assert.equal(world.spawned.length, 0, what);
  }
});

// ---- what the reviews of the watchdog found ----------------------------------------------------------------------------

test('an XML file that cannot be removed after the registration is said, and never leaves a task that is neither recorded nor taken back', { skip: WINDOWS_ONLY }, async () => {
  const xmlStuck = (file, ...rest) => {
    if (String(file).endsWith('.task.xml')) throw Object.assign(new Error(`EPERM: operation not permitted, unlink '${file}'`), { code: 'EPERM' });
    fs.rmSync(file, ...rest);
  };
  // The task is registered: it is recorded all the same, and the file that is left is named.
  const root = makeProject('proj');
  const home = tempDir();
  const { env } = makeAppData();
  const world = fakeWorld();
  const argv = ['start', '--cwd', root, '--home', home, '--at-login'];
  assert.equal(await remoteMain(argv, env, { ...world.deps, removeFile: xmlStuck }), 0, world.err());
  assert.deepEqual(readManifest(home).tasks, [taskRecord(env, root, { home })], 'a registered task is recorded whatever became of the file');
  assert.match(world.err(), /could not be removed \(EPERM/);
  assert.ok(world.err().includes(world.tasks.registered[0].file), world.err());
  assert.match(world.err(), /by hand/);
  assert.equal(world.spawned.length, 1, 'and the start goes on');

  // The task cannot be recorded: it is taken back all the same, and the launcher with it.
  const other = { root: makeProject('proj'), home: tempDir(), ...makeAppData(), world: fakeWorld() };
  assert.equal(await remoteMain(['start', '--cwd', other.root, '--home', other.home, '--at-login'], other.env, { ...other.world.deps, removeFile: xmlStuck, recordScheduledTask: CANNOT_RECORD }), 1);
  assert.equal(other.world.tasks.store.size, 0, 'no task is left that no record names');
  assert.match(other.world.err(), /deleted again/);
  assert.deepEqual(fs.readdirSync(other.startupDir), []);
  assert.equal(fs.existsSync(manifestPath(other.home)), false);
});

test('a failed registration takes back only this project\'s own records: what another project recorded in the machine manifest meanwhile stays', { skip: WINDOWS_ONLY }, async () => {
  const theirLauncher = 'C:\\elsewhere\\Startup\\js-harness-remote-theirs.cmd';
  const theirTask = { name: 'js-harness-remote-theirs', command: 'conhost.exe', arguments: '--headless node remote.mjs start --cwd D:\\theirs --watchdog' };
  const theirs = { optional: { path: theirLauncher, sha256: sha256('their launcher') }, task: theirTask };
  /** A registration that fails, while another project's `start --at-login` writes its own records. */
  const failWhileTheyRecord = (world, home) => {
    world.tasks.run = (args) => {
      if (args[0] !== '/Create') return fakeSchtasks(Object.fromEntries(world.tasks.store)).run(args);
      recordOptionalFile(home, theirLauncher, 'their launcher');
      recordScheduledTask(home, theirTask);
      return { status: 1, stdout: '' };
    };
  };

  // Nothing of this project's was there before: its launcher and its record go, theirs stay.
  const root = makeProject('proj');
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const world = fakeWorld();
  failWhileTheyRecord(world, home);
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home, '--at-login'], env, world.deps), 1);
  assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], optional: [theirs.optional], tasks: [theirs.task] });
  assert.deepEqual(fs.readdirSync(startupDir), []);
  assert.match(world.err(), /its records in the machine manifest are as they were before this command/);

  // It was already on: its own records are what they were, and theirs are still beside them.
  const on = await atLoginOn(['--name', 'one']);
  const before = { launcher: bytesOf(on.file), manifest: readManifest(on.home) };
  failWhileTheyRecord(on.world, on.home);
  assert.equal(await remoteMain([...on.argv, '--name', 'two'], on.env, on.world.deps), 1);
  assert.equal(bytesOf(on.file), before.launcher);
  assert.deepEqual(readManifest(on.home), { ...before.manifest, optional: [...before.manifest.optional, theirs.optional], tasks: [...before.manifest.tasks, theirs.task] });
});

test('when what was taken back could not be put back, the command says exactly what is left', { skip: WINDOWS_ONLY }, async () => {
  // The earlier task cannot be registered again: the task now runs the new command under the earlier record.
  const replaced = await atLoginOn(['--name', 'one']);
  replaced.world.tasks.fail.create = (nth) => (nth === 3 ? 1 : undefined);
  assert.equal(await remoteMain([...replaced.argv, '--name', 'two'], replaced.env, { ...replaced.world.deps, recordScheduledTask: CANNOT_RECORD }), 1);
  assert.match(replaced.world.err(), /the earlier task could not be registered again \(.*exited 1\)/);
  assert.ok(replaced.world.err().includes(`schtasks /Delete /TN ${replaced.task} /F`), replaced.world.err());
  assert.deepEqual(replaced.world.tasks.store.get(replaced.task), actionOf(taskRecord(replaced.env, replaced.root, { name: 'two', home: replaced.home })));

  // The launcher cannot be put back: a folder took its place while the registration failed.
  const blocked = await atLoginOn(['--name', 'one']);
  blocked.world.tasks.run = (args) => {
    if (args[0] !== '/Create') return fakeSchtasks(Object.fromEntries(blocked.world.tasks.store)).run(args);
    fs.rmSync(blocked.file);
    fs.mkdirSync(blocked.file);
    return { status: 1, stdout: '' };
  };
  assert.equal(await remoteMain([...blocked.argv, '--name', 'two'], blocked.env, blocked.world.deps), 1);
  assert.match(blocked.world.err(), /could not be put back/);
  assert.ok(blocked.world.err().includes(blocked.file), blocked.world.err());
  assert.doesNotMatch(blocked.world.err(), /are as they were before this command/);

  // A start whose options no task carries deleted the earlier task and cannot forget its record: said, with the way out.
  const retired = await atLoginOn();
  const before = bytesOf(retired.file);
  const cannotForget = () => { throw new Error('EACCES: permission denied, open manifest.json'); };
  assert.equal(await remoteMain([...retired.argv, '--name', 'café'], retired.env, { ...retired.world.deps, forgetScheduledTask: cannotForget }), 1);
  assert.match(retired.world.err(), /was deleted, but its record in the machine manifest could not be removed \(EACCES/);
  assert.match(retired.world.err(), /js-harness remote stop --at-login forgets it/);
  assert.equal(retired.world.tasks.store.size, 0);
  assert.equal(bytesOf(retired.file), before, 'the launcher is the earlier one again');
  assert.equal(readManifest(retired.home).tasks.length, 1, 'and the record of the task that is gone is still there to be forgotten');
});

test('a watchdog turn that cannot start the server says why in the project\'s log, where the next status finds it; one with nothing to do writes nothing', { skip: WINDOWS_ONLY }, async () => {
  const argv = (root, home) => ['start', '--cwd', root, '--home', home, '--name', 'proj', '--watchdog'];
  const logOf = (home, root) => (fs.existsSync(logPathOf(home, root)) ? fs.readFileSync(logPathOf(home, root), 'utf8') : '');
  const failures = {
    'claude is not on PATH': { claude: null, reason: /claude.*PATH/ },
    'the recorded process cannot be told apart': { arrange: ({ home, root, world }) => { writeState(home, root, { pid: 777, startedAt: CREATED }); world.alive.set(777, null); }, reason: /cannot tell whether the remote server is already running/ },
    'the state file is unusable': { arrange: ({ home, root }) => { fs.mkdirSync(stateDir(home), { recursive: true }); fs.writeFileSync(statePath(home, root), '{ not json'); }, reason: /state file/ },
    'the lock is held': { arrange: ({ home, root, world }) => { fs.mkdirSync(stateDir(home), { recursive: true }); fs.writeFileSync(lockPathOf(home, root), `${JSON.stringify({ pid: 555, createdAt: CREATED })}\n`); world.alive.set(555, CREATED); }, reason: /in progress/ },
  };
  for (const [what, { claude = { path: 'C:\\bin\\claude.exe', shell: false }, arrange = () => {}, reason }] of Object.entries(failures)) {
    const root = makeProject('proj');
    const home = tempDir();
    const world = fakeWorld({ claude });
    arrange({ home, root, world });
    assert.equal(await remoteMain(argv(root, home), {}, world.deps), 1, what);
    const lines = logOf(home, root).split('\n').filter(Boolean);
    assert.equal(lines.length, 1, `${what}: one line: ${lines.join(' | ')}`);
    assert.match(lines[0], /^\[js-harness remote\] watchdog: the server was not started: /, what);
    assert.match(lines[0], reason, what);
    assert.equal(world.spawned.length, 0, what);
    // The note is the watchdog's, not the server's: a status that reads this log does not take it for the server going down.
    assert.equal(readServerState(`· Connected · proj · main\n${logOf(home, root)}`).connection, 'connected', what);
  }

  // Its two normal cases, and a start that is not the watchdog's, leave the log alone.
  const root = makeProject('proj');
  const home = tempDir();
  const world = fakeWorld({ claude: null });
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 0);
  assert.equal(await remoteMain(argv(root, home), {}, world.deps), 0, 'stopped on purpose');
  writeState(home, root, { pid: 777, startedAt: CREATED });
  fs.rmSync(stoppedPathOf(home, root));
  assert.equal(await remoteMain(argv(root, home), {}, fakeWorld({ alive: new Map([[777, CREATED]]) }).deps), 0, 'running');
  assert.equal(logOf(home, root), '');
});

test('a watchdog turn whose note cannot be written still ends with its exit code and throws nothing: the log is best effort, and the reason was said', { skip: WINDOWS_ONLY }, async () => {
  const argv = (root, home) => ['start', '--cwd', root, '--home', home, '--name', 'proj', '--watchdog'];
  /** Two ways the log cannot be opened, each with why the turn fails and what shows that nothing was written. */
  const blocked = {
    // The start gets as far as looking for the CLI, which is not there; only the note has nowhere to go.
    'the log path is a folder': {
      block: ({ home, root }) => fs.mkdirSync(logPathOf(home, root), { recursive: true }),
      reason: /claude.*PATH/,
      untouched: ({ home, root }) => assert.deepEqual(fs.readdirSync(logPathOf(home, root)), []),
    },
    // Nothing can be written where the state is kept: the start fails on its lock, and the note fails after it.
    'the folder of the log is a file': {
      block: ({ home }) => { fs.mkdirSync(path.dirname(stateDir(home)), { recursive: true }); fs.writeFileSync(stateDir(home), ''); },
      reason: /^js-harness remote start: /,
      untouched: ({ home }) => assert.equal(fs.readFileSync(stateDir(home), 'utf8'), ''),
    },
  };
  for (const [what, { block, reason, untouched }] of Object.entries(blocked)) {
    const root = makeProject('proj');
    const home = tempDir();
    const world = fakeWorld({ claude: null });
    block({ home, root });
    // A turn that threw here would reject, and fail the test: the task would end with node's own exit code and trace.
    assert.equal(await remoteMain(argv(root, home), {}, world.deps), 1, what);
    assert.match(world.err(), reason, what);
    assert.equal(world.spawned.length, 0, what);
    untouched({ home, root });
  }
});

// ---- a plain stop stays stopped: the marker, and start --watchdog ------------------------------------------------------

test('a stop leaves a marker beside the state file: start --watchdog then starts nothing and exits 0, and any other start removes it and starts', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const argv = (...more) => ['start', '--cwd', root, '--home', home, ...more];
  const world = fakeWorld();
  assert.equal(await remoteMain(argv(), {}, world.deps), 0, world.err());
  assert.equal(fs.existsSync(stoppedPathOf(home, root)), false, 'a server that runs has no marker');
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
  assert.equal(fs.existsSync(stoppedPathOf(home, root)), true);

  // The watchdog fires every five minutes: each time it finds the marker, says why it starts nothing, and exits 0.
  for (let fired = 0; fired < 2; fired++) {
    const watchdog = fakeWorld();
    assert.equal(await remoteMain(argv('--name', 'proj', '--watchdog'), {}, watchdog.deps), 0, watchdog.err());
    assert.equal(watchdog.spawned.length, 0);
    assert.equal(watchdog.resolved(), 0, 'the CLI is not even looked for');
    assert.equal(watchdog.err(), '');
    assert.match(watchdog.out(), /stopped on purpose/);
    assert.equal(watchdog.tasks.calls.length, 0, 'and it never runs schtasks');
  }
  assert.equal(fs.existsSync(stoppedPathOf(home, root)), true, 'the watchdog leaves the marker');
  assert.equal(fs.existsSync(statePath(home, root)), false);

  const told = fakeWorld();
  assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], {}, told.deps), 0);
  assert.match(told.out(), /^remote: not running \(stopped on purpose/m, 'status says why the watchdog is not bringing it back');

  // His own start, or the login launcher's, which is this same plain start.
  const again = fakeWorld();
  assert.equal(await remoteMain(argv('--name', 'proj'), {}, again.deps), 0, again.err());
  assert.equal(again.spawned.length, 1);
  assert.equal(fs.existsSync(stoppedPathOf(home, root)), false, 'so the watchdog covers it again');
  const after = fakeWorld({ alive: again.alive });
  assert.equal(await remoteMain(['status', '--cwd', root, '--home', home], {}, after.deps), 0);
  assert.doesNotMatch(after.out(), /stopped on purpose/);
});

test('stop leaves the marker whenever it ends with the server down, and never when it could not stop it', { skip: WINDOWS_ONLY }, async () => {
  // Nothing was running: no record at all, or a stale one.
  for (const stale of [false, true]) {
    const root = makeProject();
    const home = tempDir();
    if (stale) writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld();
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 0, world.err());
    assert.equal(fs.existsSync(stoppedPathOf(home, root)), true, `nothing running, ${stale ? 'a stale record' : 'no record'}: he asked for a server that stays down`);
  }
  const failures = {
    ...UNPROVED,
    'the supervisor survives the kill': (world) => { world.deps.kill = () => {}; },
  };
  for (const [what, arrange] of Object.entries(failures)) {
    const root = makeProject();
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    arrange(world);
    assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1, what);
    assert.equal(fs.existsSync(stoppedPathOf(home, root)), false, `${what}: a server that may still run is not marked as stopped`);
  }
});

test('start --watchdog with no marker starts a server that is not running, leaves one that runs alone with one quiet line, and starts nothing when it cannot tell', { skip: WINDOWS_ONLY }, async () => {
  const argv = (root, home) => ['start', '--cwd', root, '--home', home, '--name', 'proj', '--watchdog'];
  // The supervisor died (a stale record), or was never started: the watchdog starts it, as a plain start would.
  for (const stale of [true, false]) {
    const root = makeProject('proj');
    const home = tempDir();
    if (stale) writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld();
    assert.equal(await remoteMain(argv(root, home), {}, world.deps), 0, world.err());
    assert.equal(world.spawned.length, 1);
    assert.equal(world.spawned[0].args.includes('--watchdog'), false, 'the supervisor is started as ever');
    assert.equal(readState(home, root).pid, 4242);
    assert.equal(world.tasks.calls.length, 0, 'it never runs schtasks');

    // Five minutes later the server runs: its normal case, exit 0 and one line, nothing on stderr.
    const next = fakeWorld({ alive: world.alive });
    assert.equal(await remoteMain(argv(root, home), {}, next.deps), 0);
    assert.equal(next.err(), '');
    assert.equal(next.spawned.length, 0);
    assert.deepEqual(next.out().split('\n').length, 1, next.out());
    assert.match(next.out(), /^remote: running for .*the watchdog has nothing to do/);
  }
  for (const [what, arrange] of Object.entries(UNPROVED)) {
    const root = makeProject('proj');
    const home = tempDir();
    writeState(home, root, { pid: 777, startedAt: CREATED });
    const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
    arrange(world);
    assert.equal(await remoteMain(argv(root, home), {}, world.deps), 1, what);
    assert.match(world.err(), /cannot tell/, what);
    assert.equal(world.spawned.length, 0, what);
    assert.equal(readState(home, root).pid, 777, `${what}: the record is kept`);
  }
});

test('the marker has one rule: every stop that ends with the server down leaves it, with --at-login too, and every start but the watchdog\'s removes it once its own input is accepted', { skip: WINDOWS_ONLY }, async () => {
  const on = await atLoginOn();
  const marker = stoppedPathOf(on.home, on.root);
  const stop = (...more) => remoteMain(['stop', '--cwd', on.root, '--home', on.home, ...more], on.env, fakeWorld({ alive: on.world.alive, tasks: on.world.tasks }).deps);

  // With the task deleted nothing reads the marker, and only a start turns --at-login on again, which removes it.
  assert.equal(await stop('--at-login'), 0);
  assert.equal(fs.existsSync(marker), true, 'stop --at-login leaves it like any stop');
  const back = fakeWorld({ tasks: on.world.tasks });
  assert.equal(await remoteMain(on.argv, on.env, back.deps), 0, back.err());
  assert.equal(fs.existsSync(marker), false);
  assert.equal(back.spawned.length, 1);
  on.world.alive.set(4242, CREATED + 5);

  // A start that then fails for lack of the CLI has removed it all the same: he asked for a running server, and
  // from then on the watchdog may bring it up.
  assert.equal(await stop(), 0);
  assert.equal(fs.existsSync(marker), true);
  const noCli = fakeWorld({ claude: null, tasks: on.world.tasks });
  assert.equal(await remoteMain(['start', '--cwd', on.root, '--home', on.home], on.env, noCli.deps), 1);
  assert.equal(fs.existsSync(marker), false);

  // A start refused on its own input changes nothing.
  assert.equal(await stop(), 0);
  assert.equal(await remoteMain(['start', '--cwd', on.root, '--home', on.home, '--name', 'a&b'], on.env, fakeWorld().deps), 2);
  assert.equal(fs.existsSync(marker), true);
});

test('a marker that cannot be written fails the stop, and one that cannot be removed fails the start before anything is started, each saying so', { skip: WINDOWS_ONLY }, async () => {
  const root = makeProject('proj');
  const home = tempDir();
  const marker = stoppedPathOf(home, root);
  writeState(home, root, { pid: 777, startedAt: CREATED });
  fs.mkdirSync(path.join(marker, 'in the way'), { recursive: true }); // a folder where the file goes
  const world = fakeWorld({ alive: new Map([[777, CREATED]]) });
  assert.equal(await remoteMain(['stop', '--cwd', root, '--home', home], {}, world.deps), 1);
  assert.deepEqual(world.killed, [{ pid: 777, createdAt: CREATED }], 'the server is stopped');
  assert.match(world.out(), /remote: stopped/);
  assert.ok(world.err().includes(marker), world.err());
  assert.match(world.err(), /watchdog/);

  const starting = fakeWorld();
  assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], {}, starting.deps), 1);
  assert.ok(starting.err().includes(marker), starting.err());
  assert.match(starting.err(), /Nothing was started/);
  assert.match(starting.err(), /by hand/);
  assert.equal(starting.spawned.length, 0);
});

test('--watchdog is a switch of start only, cannot be combined with --at-login, and the usage line says what it does', async () => {
  const root = makeProject();
  const home = tempDir();
  const { env, startupDir } = makeAppData();
  const cases = [
    [['stop', '--cwd', root, '--home', home, '--watchdog'], /unknown argument: --watchdog/],
    [['status', '--cwd', root, '--home', home, '--watchdog'], /unknown argument: --watchdog/],
    [['start', '--cwd', root, '--home', home, '--watchdog', '--at-login'], /--watchdog cannot be combined with --at-login/],
    [['start', '--cwd', root, '--home', home, '--at-login', '--watchdog'], /--watchdog cannot be combined with --at-login/],
  ];
  for (const [argv, message] of cases) {
    const world = fakeWorld();
    assert.equal(await remoteMain(argv, env, world.deps), 2, JSON.stringify(argv));
    assert.match(world.err(), message, JSON.stringify(argv));
    assert.match(world.err(), /start also takes .*\[--watchdog\]/);
    assert.match(world.err(), /scheduled task/);
    assert.match(world.err(), /stays stopped/);
    assert.equal(world.spawned.length, 0);
    assert.equal(world.tasks.calls.length, 0);
  }
  assert.deepEqual(fs.readdirSync(startupDir), []);
  assert.equal(fs.existsSync(stateDir(home)), false, 'and nothing is written');
});

// ---- the hidden supervisor: what it hands the server -------------------------------------------------------------------

/** Runs the `supervise` entry with a loop that only records what it is handed, a fake registry reader, and no
 * handler on this process's own signals. Nothing is started, so it runs on any platform. */
async function runSupervisor(env, readPersistentEnv) {
  const logPath = path.join(tempDir(), 'remote.log');
  const handed = [];
  const code = await remoteMain(['supervise', '--root', 'C:\\work\\proj', '--name', 'proj', '--log', logPath, '--claude', 'C:\\bin\\claude.exe'], env, {
    signals: new EventEmitter(),
    supervise: async (options) => {
      handed.push(options);
    },
    readPersistentEnv,
  });
  return { code, handed, logPath, log: fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '' };
}

const SUPERVISOR_ENV = { Path: 'C:\\bin', CLAUDE_CODE_GIT_BASH_PATH: 'C:\\overwritten-by-the-session\\bash.exe', CLAUDE_CODE_SESSION_ID: 'abc', ANTHROPIC_BASE_URL: 'http://injected' };

test('the supervisor keeps what the user set persistently in the server\'s environment, and removes what the session injected', async () => {
  const { code, handed, logPath, log } = await runSupervisor(SUPERVISOR_ENV, () => new Map([['CLAUDE_CODE_GIT_BASH_PATH', 'C:\\Program Files\\Git\\bin\\bash.exe']]));
  assert.equal(code, 0);
  assert.equal(handed.length, 1);
  assert.deepEqual(handed[0].env, { Path: 'C:\\bin', CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Program Files\\Git\\bin\\bash.exe' });
  assert.equal(handed[0].logPath, logPath);
  assert.equal(log, '', 'nothing to say in the log');
});

test('the supervisor says once in its log that the registry could not be read, and removes them all, as before', async () => {
  const { code, handed, log } = await runSupervisor(SUPERVISOR_ENV, () => { throw new Error('reg query HKCU\\Environment failed (exit 1)'); });
  assert.equal(code, 0, 'it is not a reason to fail');
  assert.deepEqual(handed[0].env, { Path: 'C:\\bin' });
  const lines = log.split('\n').filter(Boolean);
  assert.equal(lines.length, 1, log);
  assert.match(lines[0], /^\[js-harness remote\] could not read the persistent environment/);
  assert.ok(lines[0].includes('reg query HKCU\\Environment failed (exit 1)'), lines[0]);
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

/** A `spawn` for a real supervisor that never reads this machine's registry: `start` launches this very command
 * file, and the launch is given a script that runs the same entry (`remoteMain(['supervise', ...])`) with a fake
 * reader that answers `persistent`. Each supervisor goes to the teardown and to `children`. */
function supervisorSpawn(persistent = {}, children = []) {
  const wrapper = path.join(tempDir(), 'supervisor.mjs');
  fs.writeFileSync(wrapper, [
    `import { remoteMain } from ${JSON.stringify(pathToFileURL(SELF).href)};`,
    `const readPersistentEnv = () => new Map(${JSON.stringify(Object.entries(persistent))});`,
    'process.exitCode = await remoteMain(process.argv.slice(2), process.env, { readPersistentEnv });',
  ].join('\n'));
  return (command, args, options) => {
    assert.equal(args[0], SELF, 'start launches this command file as the supervisor');
    const child = reaper.child(spawnChild(command, [wrapper, ...args.slice(1)], options));
    children.push(child);
    return child;
  };
}

/** A fake `claude remote-control`: prints its pid, two variables it inherited and the server's redrawn status,
 * then stays up. */
const FAKE_SERVER = [
  "console.log('fake-pid=' + process.pid);",
  "console.log('git-bash=' + process.env.CLAUDE_CODE_GIT_BASH_PATH + ' session=' + (process.env.CLAUDE_CODE_SESSION_ID ?? 'none'));",
  "process.stdout.write('\\u001b]0;claude\\u0007\\u001b[2K·✔︎· Connected · ' + process.argv[process.argv.indexOf('--name') + 1] + ' · main\\n');",
  "console.log('Capacity: 0/32 · New sessions will be created in the current directory');",
  "console.log('https://claude.ai/code?environment=env_fake');",
  'setInterval(() => {}, 1000);',
].join('\n');

test('end to end: start runs a real detached supervisor, status sees it connected, stop leaves no process of it', { skip: WINDOWS_ONLY, timeout: E2E_TIMEOUT_MS }, async () => {
  const since = Date.now();
  const root = makeProject('e2e');
  const home = tempDir();
  const bin = tempDir();
  const fake = path.join(bin, 'fake-claude.cjs');
  fs.writeFileSync(fake, FAKE_SERVER);
  fs.writeFileSync(path.join(bin, 'claude.cmd'), `@"${process.execPath}" "${fake}" %*\r\n`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^path$/i.test(name)));
  env.PATH = `${bin};${process.env.PATH ?? process.env.Path ?? ''}`;
  // What a desktop session hands the supervisor: a variable the user set persistently, overwritten, and its own.
  env.CLAUDE_CODE_GIT_BASH_PATH = 'C:\\overwritten-by-the-session\\bash.exe';
  env.CLAUDE_CODE_SESSION_ID = 'leaked-session';
  const out = [];
  const err = [];
  const deps = {
    spawn: supervisorSpawn({ CLAUDE_CODE_GIT_BASH_PATH: 'C:\\persistent\\bash.exe' }),
    schtasks: fakeSchtasks().run, // `status` looks for the watchdog task, and this test hands the command the real environment
    log: (line) => out.push(String(line)),
    error: (line) => err.push(String(line)),
  };

  try {
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], env, deps), 0, err.join('\n'));
    const state = readState(home, root);
    const logPath = logPathOf(home, root);
    assert.ok(await waitUntil(() => fs.existsSync(logPath) && /git-bash=/.test(fs.readFileSync(logPath, 'utf8'))), 'the fake server came up under the supervisor');
    const fakePid = Number(/fake-pid=(\d+)/.exec(fs.readFileSync(logPath, 'utf8'))[1]);
    reaper.pids([fakePid], { since });
    const [fakeIdentity] = identifyProcesses([fakePid]);
    assert.ok(fakeIdentity, 'the fake server is running');
    assert.ok(fs.readFileSync(logPath, 'utf8').includes('git-bash=C:\\persistent\\bash.exe session=none'), 'the server got what the user set persistently, and nothing of the session');

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

test('with real processes: a detached supervisor whose identity start cannot read is stopped, not left running unrecorded', { skip: WINDOWS_ONLY, timeout: E2E_TIMEOUT_MS }, async () => {
  const root = makeProject('unrecorded');
  const home = tempDir();
  const children = [];
  const err = [];
  const deps = {
    spawn: supervisorSpawn({}, children),
    // The "server" is node refusing arguments it does not know: the supervisor stays up, restarting it, and
    // nothing it starts lasts.
    resolveClaude: () => ({ path: process.execPath, shell: false }),
    // The command can look itself up, for its lock; the look for the supervisor it launched fails.
    identifyProcesses: (pids) => (pids.every((pid) => pid === process.pid) ? [{ pid: process.pid, createdAt: OWN_CREATED }] : SNAPSHOT_FAILED()),
    schtasks: fakeSchtasks().run,
    log: () => {},
    error: (line) => err.push(String(line)),
  };
  try {
    assert.equal(await remoteMain(['start', '--cwd', root, '--home', home], process.env, deps), 1);
    assert.equal(children.length, 1);
    assert.ok(children[0].exitCode !== null || children[0].signalCode !== null, `the supervisor (pid ${children[0].pid}) has exited: ${err.join('\n')}`);
    assert.match(err.join('\n'), /the process snapshot failed/);
    assert.match(err.join('\n'), /stopped/);
    assert.equal(fs.existsSync(statePath(home, root)), false);
  } finally {
    // A run that failed leaves the supervisor up, in a folder the teardown is about to remove: it is stopped
    // here, through its handle, before anything else is.
    for (const child of children) child.kill('SIGKILL');
  }
});

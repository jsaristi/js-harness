import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as dispatch } from './js-harness.mjs';
import * as harness from './js-harness.mjs';
import { ruleValue } from './lib/rules.mjs';
import { readCache } from './lib/cache.mjs';

const GATE_WAIT = ruleValue('gate-wait', 'minutes');
const GATE_MAX = ruleValue('gate-max', 'minutes');

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

// install-update T8: `upgrade` asks the copy on the path which version it is before it lets it sync.
test('--version prints the version of this copy, alone on one line, and exits 0; the help names it', () => {
  const result = run(['--version']);
  const { version } = JSON.parse(fs.readFileSync(path.join(path.dirname(dispatcher), '..', 'package.json'), 'utf8'));
  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${version}\n`);
  assert.equal(result.stderr, '');
  assert.match(run(['--help']).stdout, /^js-harness --version /m);
});

test('unknown command exits 2', () => {
  const result = run(['bogus']);
  assert.equal(result.status, 2);
});

test('merge-ready is retired: --help does not list it and it exits 2 as an unknown command, since no pull request has a GitHub run of its own to decide on (odd/tasks/retire-merge-ready.md)', () => {
  const help = run(['--help']);
  assert.doesNotMatch(help.stdout, /merge-ready/);
  assert.match(help.stdout, /merge-queue/, 'the queue is how code reaches main');
  const result = run(['merge-ready', '7']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown command: merge-ready/);
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

test('guard is listed in --help and wired through the dispatcher', () => {
  assert.match(run(['--help']).stdout, /guard {7}The PreToolUse hook/);
  assert.match(run(['--help']).stdout, /js-harness guard --stop is the Stop hook/);
  const result = run(['guard']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage: js-harness guard --hook/);
});

test('functions is listed in --help and wired through the dispatcher', () => {
  assert.match(run(['--help']).stdout, /functions {3}Show each function this project can turn off and on/);
  assert.match(run(['--help']).stdout, /functions apply makes this clone what they ask.*functions set <name> <value>/);
  const result = run(['functions', '--no-such-flag']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument: --no-such-flag/);
  assert.match(result.stderr, /Usage: js-harness functions/);
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
// any repo, and `--offline` keep it hermetic, while `--json` parsing to the known ids is what
// actually proves dispatch reached `doctorMain`, not just that *something* printed.
test('doctor dispatches to a temp home and exits 0, hermetically (no host binaries or network)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-doctor-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-doctor-cwd-'));
  try {
    // The project declares codexReview off, so the codex row is left out whatever the host has installed. Left
    // undeclared, a temp folder outside git reads `auto` as on (its files cannot be listed), and the row would
    // depend on whether this machine has the Codex CLI.
    fs.writeFileSync(path.join(cwd, 'harness.json'), JSON.stringify({ functions: { codexReview: 'off' } }), 'utf8');
    const result = run(['doctor', '--home', home, '--cwd', cwd, '--offline', '--json']);
    assert.equal(result.status, 0);
    const rows = JSON.parse(result.stdout);
    assert.deepEqual(
      rows.map((r) => r.id),
      // `hook-commands` runs the commands a manifest records, and a temp home has no manifest: it starts none here.
      // `unseen` and `host-update` are the rows the dispatcher wires in (doctor's `unseen` and `host` dependencies):
      // last, after the checks. `host-update` is there on any machine, `n/a` where no Claude Desktop folder is.
      ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'memory-rules', 'session-classes', 'claude-account', 'remote-server', 'hook-commands', 'pnpm-lock', 'unseen', 'host-update', 'gentle-ai-sync'],
    );
    // The host check reads the app folder under `--home`, never this machine's own (gentle-ai review of PR 242):
    // a temp home has no Claude Desktop folder, so the row is n/a and nothing is recorded in its cache.
    const host = rows.find((r) => r.id === 'host-update');
    assert.deepEqual([host.version, host.installed, host.claude, host.upToDate], [null, 'n/a', 'n/a', 'n/a']);
    assert.equal('host' in readCache(home), false);
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

test('--help says what --at-login does to remote start and stop, and so does the usage of remote', () => {
  assert.match(run(['--help']).stdout, /^ {2}remote\s+.*start --at-login.*login.*stop --at-login/m);
  assert.match(run(['--help']).stdout, /^ {2}remote\s+.*start --at-login.*within five minutes.*stop --at-login undoes both/m, 'the watchdog is part of what --at-login turns on');
  assert.match(run(['remote']).stderr, /start and stop also take \[--at-login\]/);
  assert.match(run(['remote']).stderr, /start also takes .*\[--watchdog\]/);
});

// Hermetic: `run` marks the dispatcher as inside a gate, as a sensor's process is, so `gate` takes no lock
// and this machine's real gates are neither waited for nor held up.
test('--help lists gate, gate without a command exits 2 with its usage, and gate -- <command> exits with the command\'s code through the dispatcher', () => {
  assert.match(run(['--help']).stdout, /^ {2}gate\s+Run a command under the machine's gate lock.*js-harness gate \[--wait <minutes> \| --no-wait\] \[--max <minutes>\] -- <command>.*exit code is the command's/m);
  // The two guards of a turn (odd/tasks/gate-turn-guards.md): a bound of wall time, and a push that waits goes first.
  assert.match(run(['--help']).stdout, /^ {2}gate\s+.*--max is how many minutes the command may run before it is stopped with every process it started \(\d+ when not given\)\. While the branch of the folder it runs in has an open pull request and commits a push would take now, it refuses any command but that push or a merge, and prints the push command\./m);
  assert.ok(run(['--help']).stdout.includes(`every process it started (${GATE_MAX} when not given). While`));
  // The ticket that puts one session's next check first (odd/tasks/gate-first.md).
  assert.match(run(['--help']).stdout, /^ {2}gate\s+.*js-harness gate first --session <id> --reason <why> \[--tree <path>\] \[--minutes <n>\] issues a ticket .*gate first --cancel <id> undoes one\./m);
  const refused = run(['gate', '--no-wait']);
  assert.equal(refused.status, 2);
  // The last line of the usage says what the two flags of a wait mean, since 2026-10-11: the bound counts from
  // the last time the lock changed hands, which "--wait <minutes>" does not say by itself.
  assert.match(refused.stderr, /^the command to run goes after --\n\nUsage: js-harness gate \[--wait <minutes> \| --no-wait\] \[--max <minutes>\] \[--ready <command>\] \[--home <path>\] \[--cwd <path>\] -- <command> \[args\.\.\.\]\n {7}js-harness gate log \[--last <n>\] \[--home <path>\]\n {7}js-harness gate first \[--session <id> --reason <why> \[--tree <path>\] \[--minutes <n>\] \| --cancel <id>\] \[--home <path>\]\n {7}--wait <minutes>: how long the machine's gate lock may go without changing hands before this gate gives up on it \(\d+ when not given\); --no-wait: refuse at once instead of waiting\n {7}--max <minutes>: how long the command may run before it is stopped with every process it started \(\d+ when not given\)\n {7}--ready <command>: a quick check, one shell command line, run before the wait and again as the turn comes after one; when it fails, nothing runs \(exit 75\), so a command that would refuse at once does not wait for a turn\n$/);
  assert.ok(refused.stderr.includes(`gives up on it (${GATE_WAIT} when not given);`));
  assert.ok(refused.stderr.includes(`started (${GATE_MAX} when not given)\n`));
  // A queued command refused before it waits (odd/tasks/gate-wait.md, T20).
  assert.match(run(['--help']).stdout, /^ {2}gate\s+.*--ready <command> is a quick check, run before the wait and again as the turn comes after one: when it fails, nothing runs \(exit 75\)\./m);
  assert.match(run(['--help']).stdout, /^ {2}gate\s+.*It waits for its turn in the order the gates arrived; --wait is how many minutes the lock may go without changing hands before it gives up \(\d+ when not given\), and --no-wait refuses at once\./m);
  assert.ok(run(['--help']).stdout.includes(`before it gives up (${GATE_WAIT} when not given), and`));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-gate-home-'));
  try {
    const ran = run(['gate', '--home', home, '--', 'node', '-e', "console.log('through the gate'); process.exit(3)"]);
    assert.equal(ran.status, 3, ran.stderr);
    assert.equal(ran.stdout.trim(), 'through the gate');
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'inside a gate it takes no lock and writes no log');
    // `gate log` reads the log of the home it is given, and an empty one is no error.
    assert.match(run(['--help']).stdout, /^ {2}gate\s+.*js-harness gate log \[--last <n>\] prints the last gates of the machine's gate log/m);
    const log = run(['gate', 'log', '--home', home]);
    assert.deepEqual([log.status, log.stdout.trim(), log.stderr], [0, `no gate in the log of ${path.join(home, '.js-harness', 'gate-log')}`, '']);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'reading the log made no folder');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('--help lists sessions, and sessions with a flag it does not know exits 2 with its usage through the dispatcher', () => {
  assert.match(run(['--help']).stdout, /^ {2}sessions\s+.*recent Claude Code sessions.*context size.*background work.*roster.*worktrees.*feature plan.*gates.*pull requests.*relief file.*channel.*--watch waits.*notice for the orchestrator.*--address <role>.*exit 0 for one, 1 for none.*2 for several or when it cannot tell.*--opening "<title>" prints the opening stored for a session.*records in the channel which session read it.*--quote <transcript> <line> prints the entry at that line of a transcript only when the user sent it.*a message sent while the session worked.*exit 1 otherwise/m);
  const result = run(['sessions', '--bogus']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument: --bogus/);
  assert.match(result.stderr, /Usage: js-harness sessions/);
});

test('--help lists unseen after sessions, and unseen with a flag it does not know exits 2 with its usage through the dispatcher', () => {
  assert.match(run(['--help']).stdout, /^ {2}unseen\s+.*out of his sight.*exit 1.*to clear/m);
  const result = run(['unseen', '--bogus']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument: --bogus/);
  assert.match(result.stderr, /Usage: js-harness unseen/);
});

// Hermetic: the child runs in an empty temp folder outside any repository, so the project it reads is that
// folder, which no scheduled task and no transcript names; the Claude home is an empty temp folder too.
test('unseen dispatches from a temp folder with nothing opened out of his sight: exit 0 and its one line last', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-unseen-cwd-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-unseen-home-'));
  try {
    const result = spawnSync(process.execPath, [dispatcher, 'unseen', '--claude-home', home], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, JS_HARNESS_CHECK_INNER: '1' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim().split('\n').at(-1), 'unseen: nothing opened out of his sight');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Hermetic: an empty temp `--claude-home`, so the command stops at "no sessions folder" before it would
// read this machine's sessions, processes or pull requests — and the message naming that temp home is
// what proves dispatch reached `sessionsMain`. Which project the message names is not asserted: the
// command asks the real git, and a temp root that sits inside a repository answers with that repository
// (R3-dispatch-test-not-hermetic).
test('sessions dispatches to a temp cwd and Claude home and exits 1 for a project with no sessions folder', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-sessions-cwd-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-sessions-home-'));
  try {
    const result = run(['sessions', '--cwd', cwd, '--claude-home', home, '--json']);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.startsWith('js-harness sessions: no sessions folder for '), result.stderr);
    assert.ok(result.stderr.includes(`: ${path.join(home, 'projects')}${path.sep}`), result.stderr);
    assert.equal(result.stderr.trim().split('\n').length, 1, 'one line, and no board');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Session channel, T6: the hook a session runs after a compaction is a command of the dispatcher, since a
// host starts it by name. With a home of its own and a time limit: the folder it is given has no
// `harness.json`, so the hook stops at its first question and reads nothing of this machine.
test('--help lists resume; without --hook it exits 2 with its usage, and the hook prints nothing outside an opted-in project', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-resume-'));
  try {
    const started = (args, input = '') => spawnSync(process.execPath, [dispatcher, ...args], { encoding: 'utf8', input, timeout: 60000, env: { ...process.env, JS_HARNESS_HOME: home, CLAUDE_CONFIG_DIR: home } });
    assert.match(started(['--help']).stdout, /^ {2}resume\s+The SessionStart hook that runs after a compaction.*js-harness resume --hook.*harness\.json.*always exits 0\. js-harness resume --pause is the PostToolUse hook of the context pause/m);
    const usage = started(['resume']);
    assert.deepEqual([usage.status, usage.stdout], [2, '']);
    assert.match(usage.stderr, /^Usage: js-harness resume --hook/);
    const hook = started(['resume', '--hook'], JSON.stringify({ session_id: 'aaaaaaaa-1111-4111-8111-111111111111', cwd: home, hook_event_name: 'SessionStart', source: 'compact' }));
    assert.deepEqual([hook.status, hook.stdout, hook.stderr], [0, '', '']);
    assert.deepEqual(fs.readdirSync(home), [], 'nothing written under the home');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T20 (session channel): the command a session runs in the background until its condition holds.
test('--help lists wait, and wait with no condition exits 2 with its usage through the dispatcher, checking nothing', () => {
  assert.match(
    run(['--help']).stdout,
    /^ {2}wait\s+Wait in the background until one condition holds.*js-harness wait \(--pr.*--notice-to.*--every.*--for.*It checks at once.*exit 1.*TaskStop/m,
  );
  const result = run(['wait']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^js-harness wait: a condition is required/);
  assert.match(result.stderr, /Usage: js-harness wait \(--pr <number>/);
});

test('--help lists notify, and notify with nothing to write exits 2 with its usage through the dispatcher', () => {
  assert.match(
    run(['--help']).stdout,
    /^ {2}notify\s+Append one notice to the project's channel record.*js-harness notify --to orchestrator\|<number> --kind opened\|waiting\|closed\|note\|answer\|relieved "<one line>".*--transcript.*--line.*address of the role, as sessions --address gives it.*exit is 0 once the notice is recorded.*--relief "<one line>".*relief file.*--opening "<title>".*standard input.*claim.*never the user's word/m,
  );
  const result = run(['notify', '--to', 'orchestrator']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /a notice takes --to and --kind/);
  assert.match(result.stderr, /Usage: js-harness notify/);
});

// Hermetic: a temp harness home, a temp folder to run from and an empty temp Claude home, so the notice
// is written under the temp home and the address stops at "no sessions folder". Which project the record
// is named after is not asserted, for the reason given above for `sessions`.
test('notify dispatches: it records one notice under a temp home and exits 0 with no address to give', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-notify-cwd-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-notify-home-'));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-notify-claude-'));
  try {
    const result = run(['notify', '--to', '9', '--kind', 'note', 'probe', '--cwd', cwd, '--home', home, '--claude-home', claudeHome]);
    assert.equal(result.status, 0, result.stderr);
    const channel = path.join(home, '.js-harness', 'channel');
    const records = fs.readdirSync(channel);
    assert.equal(records.length, 1);
    const lines = fs.readFileSync(path.join(channel, records[0]), 'utf8').trimEnd().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(lines.map((notice) => [notice.schema, notice.to, notice.kind, notice.text, notice.cwd]), [['js-harness.channel-notice/v1', { role: 'work', number: 9 }, 'note', 'probe', cwd]]);
    const [recorded, address] = result.stdout.trimEnd().split('\n');
    assert.match(recorded, /^js-harness notify: recorded note for work session 9 at \d\d:\d\d local \(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z\) from /);
    assert.ok(recorded.endsWith(` in ${path.join(channel, records[0])}`), recorded);
    assert.ok(address.startsWith('address of work session 9: no single one now (sessions --address exit 1): no sessions folder for '), address);
  } finally {
    for (const dir of [cwd, home, claudeHome]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Hermetic, like the dispatch of `notify` above: temp folders for the harness home, the Claude home and
// the folder it runs from. The opening is stored through the dispatcher, then read through it.
test('sessions --opening dispatches: it prints the opening notify stored under a temp home, and --quote refuses a file outside the sessions folder', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-read-cwd-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-read-home-'));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-read-claude-'));
  const env = { ...process.env, JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: home };
  delete env.CLAUDE_CODE_SESSION_ID;
  const dispatch = (args, input) => spawnSync(process.execPath, [dispatcher, ...args], { encoding: 'utf8', env, input, timeout: 60000 });
  try {
    assert.equal(dispatch(['notify', '--opening', 'JH 9 · una prueba', '--cwd', cwd, '--claude-home', claudeHome], 'Sos JH 9.\nSeguí.\n').status, 0);
    const read = dispatch(['sessions', '--opening', 'JH 9', '--cwd', cwd, '--claude-home', claudeHome]);
    assert.deepEqual([read.status, read.stdout, read.stderr], [0, 'Sos JH 9.\nSeguí.\n', '']);
    // No session is named, so nothing is recorded: the home holds the opening and no record.
    assert.deepEqual(fs.readdirSync(path.join(home, '.js-harness', 'channel')), ['openings']);
    // A file outside the project's sessions folder is never quoted, whether it exists or not: exit 2.
    const outside = path.join(cwd, 'none.jsonl');
    const quote = dispatch(['sessions', '--quote', outside, '1', '--cwd', cwd, '--claude-home', claudeHome]);
    assert.deepEqual([quote.status, quote.stdout], [2, '']);
    assert.ok(quote.stderr.startsWith(`js-harness sessions: not quoted: ${outside} is not a transcript of this project's sessions folder`), quote.stderr);
  } finally {
    for (const dir of [cwd, home, claudeHome]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** The dispatcher with `input` on its real standard input, in temp folders and as a session the host does
 * not name: the id of the session that runs this suite never reaches a file. */
function runPiped(args, input) {
  const env = { ...process.env, JS_HARNESS_CHECK_INNER: '1' };
  delete env.CLAUDE_CODE_SESSION_ID;
  return spawnSync(process.execPath, [dispatcher, ...args], { encoding: 'utf8', env, input, timeout: 60000 });
}

// The other tests of an opening hand `notify` a reader of their own. This one pipes the text through the
// process's standard input, so the reader the command has by default is the one that runs.
test('notify --opening reads the opening from the real standard input of the dispatcher, as UTF-8', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-opening-cwd-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-opening-home-'));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-opening-claude-'));
  const text = 'Sos JH 9.\nSeguí el "Next step" de la sesión.\n';
  try {
    const result = runPiped(['notify', '--opening', 'JH 9 · una prueba', '--cwd', cwd, '--home', home, '--claude-home', claudeHome], text);
    assert.equal(result.status, 0, result.stderr);
    const openings = path.join(home, '.js-harness', 'channel', 'openings');
    const [project, ...others] = fs.readdirSync(openings);
    assert.deepEqual(others, []);
    const files = fs.readdirSync(path.join(openings, project));
    assert.equal(files.length, 1);
    const stored = JSON.parse(fs.readFileSync(path.join(openings, project, files[0]), 'utf8'));
    assert.deepEqual([stored.schema, stored.title, stored.text, stored.from.id], ['js-harness.channel-opening/v1', 'JH 9 · una prueba', text, null]);
    assert.deepEqual(result.stdout.trimEnd().split(/\r?\n/), [
      `js-harness notify: opening for "JH 9 · una prueba" written in ${path.join(openings, project, files[0])} (2 lines, ${text.length} characters)`,
      // The new session's first message, as a block the user copies.
      'The first message of the session "JH 9 · una prueba", to send in it as it is:',
      '```',
      "You are the session \"JH 9 · una prueba\". Read your opening with js-harness sessions --opening 'JH 9 · una prueba' and follow it.",
      '```',
    ]);
    assert.match(result.stderr, /^js-harness notify: the sender is not known: /);
  } finally {
    for (const dir of [cwd, home, claudeHome]) fs.rmSync(dir, { recursive: true, force: true });
  }
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

// The dispatcher imports no command module at its top: each command's loader imports its module when the command
// runs. These tests hand `run` a table of spies in place of the real loaders, so they run no command and import
// no command module, and they read nothing of this machine.
function spyTable(loaded, ran) {
  assert.ok(harness.COMMANDS, 'the dispatcher exports its table of loaders');
  return Object.fromEntries(
    Object.keys(harness.COMMANDS).map((name) => [
      name,
      async () => {
        loaded.push(name);
        return (rest) => {
          ran.push([name, rest]);
          return 0;
        };
      },
    ]),
  );
}

test('the table of loaders names exactly the commands of the usage text, and each loader resolves to a command function', async (t) => {
  assert.ok(harness.COMMANDS, 'the dispatcher exports its table of loaders');
  const printed = [];
  t.mock.method(console, 'log', (text) => printed.push(text));
  assert.equal(await dispatch(['--help']), 0);
  const named = printed
    .join('\n')
    .split('\n')
    .map((line) => line.match(/^ {2}(\S+)\s/))
    .filter(Boolean)
    .map((match) => match[1]);
  assert.deepEqual(Object.keys(harness.COMMANDS).sort(), named.sort());
  for (const name of named) {
    assert.equal(typeof (await harness.COMMANDS[name]()), 'function', `the loader of ${name} resolves to its command function`);
  }
});

test('--help, no command on a pipe, and an unknown command load no command module', async (t) => {
  const loaded = [];
  const ran = [];
  const commands = spyTable(loaded, ran);
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const pipe = { isTTY: false };
  assert.equal(await dispatch(['--help'], { commands }), 0);
  assert.equal(await dispatch([], { stdin: pipe, stdout: pipe, commands }), 0);
  assert.equal(await dispatch(['no-such-command'], { commands }), 2);
  // A name every object inherits is no command: read with `in`, `toString` was found and then called as one.
  assert.equal(await dispatch(['toString'], { commands }), 2);
  assert.equal(await dispatch(['constructor'], { commands }), 2);
  assert.deepEqual([loaded, ran], [[], []]);
});

test('resume --pause loads the loader of resume and runs it with its arguments, and no other loader', async () => {
  const loaded = [];
  const ran = [];
  const code = await dispatch(['resume', '--pause'], { commands: spyTable(loaded, ran) });
  assert.equal(code, 0);
  assert.deepEqual(loaded, ['resume']);
  assert.deepEqual(ran, [['resume', ['--pause']]]);
});

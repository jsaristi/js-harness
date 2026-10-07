import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { codexProcesses, compare, loginProofMain, report, snapshot } from './login-proof.mjs';

// Every "real home" here is a temporary folder with fixtures: the tool takes no default home, so no test
// can reach the machine's own Codex home.
const LOGIN = 'FIXTURE-LOGIN-BYTES not a token\n';
const CONFIG = 'FIXTURE-CONFIG-BYTES model = "x"\n';
const ROLLOUT = 'FIXTURE-ROLLOUT-BYTES {}\n';
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** A fake real Codex home: a login, a config file and a folder with one file in it. */
function fakeHome({ login = LOGIN } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-login-proof-'));
  made.push(root);
  const home = path.join(root, '.codex');
  fs.mkdirSync(path.join(home, 'sessions'), { recursive: true });
  if (login !== null) fs.writeFileSync(path.join(home, 'auth.json'), login, 'utf8');
  fs.writeFileSync(path.join(home, 'config.toml'), CONFIG, 'utf8');
  fs.writeFileSync(path.join(home, 'sessions', 'rollout.jsonl'), ROLLOUT, 'utf8');
  return { root, home, auth: path.join(home, 'auth.json'), out: path.join(root, 'out', 'proof.md') };
}

/** A command that runs `script` in a Node of its own, with `args` as `process.argv[1]` onwards. */
const node = (script, ...args) => [process.execPath, '-e', script, ...args];

/** Runs the tool with its output captured. The processes of this machine are never listed: a test that
 * says nothing of them gets none. */
function prove(argv, deps = {}) {
  const out = [];
  const err = [];
  const code = loginProofMain(argv, {
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    now: () => new Date('2026-10-06T12:00:00.000Z'),
    listProcesses: () => [],
    ...deps,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const FIXTURES = ['FIXTURE-LOGIN-BYTES', 'FIXTURE-CONFIG-BYTES', 'FIXTURE-ROLLOUT-BYTES'];
const holdsNoBytes = (text) => FIXTURES.every((bytes) => !text.includes(bytes));

// --- the snapshot ---

test('snapshot: the login by what a stat says and a digest; never its bytes', () => {
  const { home, auth } = fakeHome();
  const stat = fs.statSync(auth, { bigint: true });
  const snap = snapshot(home);
  assert.deepEqual(snap.auth, {
    exists: true,
    size: LOGIN.length,
    mtimeMs: Number(stat.mtimeMs),
    nlink: 1,
    dev: String(stat.dev),
    ino: String(stat.ino),
    sha256: sha256(LOGIN),
  });
  assert.equal(holdsNoBytes(JSON.stringify(snap)), true);
});

test('snapshot: every other top-level entry, a file by size, date and digest, a folder by its count and date, not read into', () => {
  const { home } = fakeHome();
  const snap = snapshot(home);
  assert.deepEqual(Object.keys(snap.entries), ['config.toml', 'sessions'], 'the login is reported apart');
  assert.deepEqual(snap.entries['config.toml'], {
    size: CONFIG.length,
    mtimeMs: fs.statSync(path.join(home, 'config.toml')).mtimeMs,
    sha256: sha256(CONFIG),
  });
  assert.deepEqual(snap.entries.sessions, { entries: 1, mtimeMs: fs.statSync(path.join(home, 'sessions')).mtimeMs });
});

test('snapshot: a file above the bound is described by size and date only', () => {
  const { home } = fakeHome();
  const snap = snapshot(home, { maxHashBytes: CONFIG.length - 1 });
  assert.equal(snap.entries['config.toml'].sha256, null);
  assert.equal(snap.entries['config.toml'].size, CONFIG.length);
  assert.equal(snapshot(home, { maxHashBytes: CONFIG.length }).entries['config.toml'].sha256, sha256(CONFIG));
});

test('snapshot: a home with no login says so', () => {
  const { home } = fakeHome({ login: null });
  assert.deepEqual(snapshot(home).auth, { exists: false });
});

// --- the comparison ---

test('compare: two snapshots of an untouched home differ in nothing, and the login is the same file with the same names', () => {
  const { home } = fakeHome();
  const result = compare(snapshot(home), snapshot(home));
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.auth, { existed: true, exists: true, sameFile: true, bytes: 'unchanged', nlinkBefore: 1, nlinkAfter: 1, ok: true });
});

test('compare: what was added, removed or changed at the top level, each by its path', () => {
  const { home } = fakeHome();
  fs.writeFileSync(path.join(home, 'gone.txt'), 'x', 'utf8');
  fs.writeFileSync(path.join(home, 'touched.txt'), 'same', 'utf8');
  const before = snapshot(home);
  fs.rmSync(path.join(home, 'gone.txt'));
  fs.writeFileSync(path.join(home, 'new.txt'), 'y', 'utf8');
  fs.writeFileSync(path.join(home, 'config.toml'), `${CONFIG}more\n`, 'utf8');
  fs.utimesSync(path.join(home, 'touched.txt'), new Date(0), new Date(1000));
  fs.writeFileSync(path.join(home, 'sessions', 'second.jsonl'), '{}', 'utf8');
  const { changes, auth } = compare(before, snapshot(home));
  assert.deepEqual(changes.map((change) => change.path), ['config.toml', 'gone.txt', 'new.txt', 'sessions/', 'touched.txt']);
  const what = Object.fromEntries(changes.map((change) => [change.path, change.what]));
  assert.match(what['config.toml'], /bytes changed/);
  assert.match(what['gone.txt'], /removed/);
  assert.match(what['new.txt'], /added/);
  assert.match(what['sessions/'], /1 → 2/);
  assert.match(what['touched.txt'], /date changed, bytes unchanged/);
  assert.equal(auth.ok, true, 'none of that is the login');
});

test('compare: a login rewritten in place is the same file with other bytes, which a refresh through the link looks like', () => {
  const { home, auth } = fakeHome();
  const before = snapshot(home);
  fs.writeFileSync(auth, 'FIXTURE-LOGIN-BYTES refreshed\n', { encoding: 'utf8', flag: 'w' });
  assert.deepEqual(compare(before, snapshot(home)).auth, { existed: true, exists: true, sameFile: true, bytes: 'changed', nlinkBefore: 1, nlinkAfter: 1, ok: true });
});

test('compare: a login that became another file, kept another name, or is gone, is not ok', () => {
  const replaced = fakeHome();
  let before = snapshot(replaced.home);
  fs.writeFileSync(`${replaced.auth}.tmp`, LOGIN, 'utf8');
  fs.renameSync(`${replaced.auth}.tmp`, replaced.auth);
  let { auth } = compare(before, snapshot(replaced.home));
  assert.deepEqual([auth.sameFile, auth.bytes, auth.ok], [false, 'unchanged', false], 'the same bytes in another file are not the same file');

  const linked = fakeHome();
  before = snapshot(linked.home);
  fs.linkSync(linked.auth, path.join(linked.root, 'left-behind.json'));
  ({ auth } = compare(before, snapshot(linked.home)));
  assert.deepEqual([auth.sameFile, auth.nlinkBefore, auth.nlinkAfter, auth.ok], [true, 1, 2, false]);

  const gone = fakeHome();
  before = snapshot(gone.home);
  fs.rmSync(gone.auth);
  ({ auth } = compare(before, snapshot(gone.home)));
  assert.deepEqual([auth.existed, auth.exists, auth.sameFile, auth.bytes, auth.ok], [true, false, false, null, false]);

  const never = fakeHome({ login: null });
  ({ auth } = compare(snapshot(never.home), snapshot(never.home)));
  assert.deepEqual([auth.existed, auth.exists, auth.ok], [false, false, false], 'with no login there is nothing proven');
});

// --- the report ---

test('report: the date, the command, its exit code, the verdict on the login and each other change; no byte of any file', () => {
  const { home, auth } = fakeHome();
  const before = snapshot(home);
  fs.writeFileSync(auth, 'FIXTURE-LOGIN-BYTES refreshed\n', { encoding: 'utf8', flag: 'w' });
  fs.writeFileSync(path.join(home, 'new.txt'), 'FIXTURE-CONFIG-BYTES again', 'utf8');
  const after = snapshot(home);
  const text = report({ date: '2026-10-06T12:00:00.000Z', realHome: home, command: ['node', 'x.mjs', '--flag'], exitCode: 0, before, after, comparison: compare(before, after) });
  assert.match(text, /^# /);
  assert.ok(text.includes('2026-10-06T12:00:00.000Z'));
  assert.ok(text.includes('`node x.mjs --flag`'));
  assert.match(text, /Exit code: 0/);
  assert.match(text, /Same file before and after[^\n]*: yes/);
  assert.match(text, /Bytes: changed/);
  assert.match(text, /Names \(hard links\): 1 → 1/);
  assert.match(text, /PASS/);
  assert.match(text, /`new\.txt`[^\n]*added/);
  assert.equal(holdsNoBytes(text), true);
  assert.equal(text.includes(after.auth.sha256), false, 'not even the digest of the login is printed');
});

// --- the command ---

test('the tool wraps a command: snapshot, run, snapshot, and a report written to --out and printed; exit 0 when the login is intact', () => {
  const { home, out } = fakeHome();
  const result = prove(['--real-home', home, '--out', out, '--', ...node('process.exit(0)')]);
  assert.equal(result.code, 0, result.err);
  const written = fs.readFileSync(out, 'utf8');
  assert.equal(result.out.trim(), written.trim(), 'what is printed is what is written');
  assert.match(written, /Exit code: 0/);
  assert.match(written, /Bytes: unchanged/);
  assert.match(written, /PASS/);
  assert.match(written, /Nothing else changed/);
  assert.ok(written.includes('2026-10-06T12:00:00.000Z'));
  assert.equal(holdsNoBytes(written), true);
});

test('the exit code is the wrapped command\'s', () => {
  const { home, out } = fakeHome();
  const result = prove(['--real-home', home, '--out', out, '--', ...node('process.exit(3)')]);
  assert.equal(result.code, 3);
  assert.match(fs.readFileSync(out, 'utf8'), /Exit code: 3/);
});

test('a command that rewrote the login in place passes: the same file, other bytes', () => {
  const { home, auth, out } = fakeHome();
  // The new bytes are in the command line, which the report prints as it was given: only the fixtures
  // on disk before the run are looked for in it.
  const rewrite = "require('node:fs').writeFileSync(process.argv[1], 'a login rewritten in place', { flag: 'w' })";
  const result = prove(['--real-home', home, '--out', out, '--', ...node(rewrite, auth)]);
  assert.equal(result.code, 0, result.err);
  assert.equal(fs.readFileSync(auth, 'utf8'), 'a login rewritten in place');
  assert.match(result.out, /Same file before and after[^\n]*: yes/);
  assert.match(result.out, /Bytes: changed/);
  assert.match(result.out, /PASS/);
  assert.equal(holdsNoBytes(result.out), true);
});

test('a command that replaced the login by another file fails the proof with exit 1, though it exited 0', () => {
  const { home, auth, out } = fakeHome();
  const replace = "const fs = require('node:fs'); fs.writeFileSync(process.argv[1] + '.tmp', 'FIXTURE-LOGIN-BYTES other'); fs.renameSync(process.argv[1] + '.tmp', process.argv[1])";
  const result = prove(['--real-home', home, '--out', out, '--', ...node(replace, auth)]);
  assert.equal(result.code, 1);
  assert.match(result.out, /Exit code: 0/);
  assert.match(result.out, /Same file before and after[^\n]*: no/);
  assert.match(result.out, /FAIL/);
});

test('a command that left another name of the login behind fails the proof with exit 1', () => {
  const { home, auth, root, out } = fakeHome();
  const link = "require('node:fs').linkSync(process.argv[1], process.argv[2])";
  const result = prove(['--real-home', home, '--out', out, '--', ...node(link, auth, path.join(root, 'left-behind.json'))]);
  assert.equal(result.code, 1);
  assert.match(result.out, /Names \(hard links\): 1 → 2/);
  assert.match(result.out, /FAIL/);
});

test('what the command changed elsewhere at the top level of the home is listed', () => {
  const { home, out } = fakeHome();
  const write = "const fs = require('node:fs'), path = require('node:path'); fs.writeFileSync(path.join(process.argv[1], 'history.jsonl'), 'x'); fs.writeFileSync(path.join(process.argv[1], 'sessions', 'b.jsonl'), 'y')";
  const result = prove(['--real-home', home, '--out', out, '--', ...node(write, home)]);
  assert.equal(result.code, 0, 'the login is intact, so the proof passes; the changes are for a person to read');
  assert.match(result.out, /`history\.jsonl`[^\n]*added/);
  assert.match(result.out, /`sessions\/`[^\n]*1 → 2/);
  assert.doesNotMatch(result.out, /Nothing else changed/);
});

test('a command that cannot be started is exit 1, and the report says so', () => {
  const { home, out } = fakeHome();
  const result = prove(['--real-home', home, '--out', out, '--', path.join(home, 'no-such-command')]);
  assert.equal(result.code, 1);
  assert.match(fs.readFileSync(out, 'utf8'), /could not be started/);
});

test('a home that cannot be read after the command still gets its report, which says so and why: exit 1', () => {
  const { home, root, out } = fakeHome();
  // The command exits 0 and takes the home away, so the second reading has nothing to list.
  const move = "require('node:fs').renameSync(process.argv[1], process.argv[2])";
  const result = prove(['--real-home', home, '--out', out, '--', ...node(move, home, path.join(root, 'moved'))]);
  assert.equal(result.code, 1);
  const written = fs.readFileSync(out, 'utf8');
  assert.equal(result.out.trim(), written.trim(), 'what is printed is what is written');
  assert.match(written, /Exit code: 0/);
  assert.match(written, /could not be read after the command/);
  assert.match(written, /ENOENT/, 'and why');
  assert.match(written, /Verdict: FAIL/);
  assert.doesNotMatch(written, /PASS/);
  assert.match(written, /2 entries before/);
  assert.ok(written.includes('2026-10-06T12:00:00.000Z'));
  assert.equal(holdsNoBytes(written), true);
});

test('report: without a second reading there is no verdict but FAIL, and what was read before is still told', () => {
  const { home } = fakeHome();
  const before = snapshot(home);
  const text = report({ date: '2026-10-06T12:00:00.000Z', realHome: home, command: ['node', 'x.mjs'], exitCode: 0, before, after: null, comparison: null, afterError: 'EACCES: permission denied, scandir' });
  assert.match(text, /could not be read after the command \(EACCES: permission denied, scandir\)/);
  assert.match(text, /Verdict: FAIL/);
  assert.match(text, /Names \(hard links\) before: 1/);
  assert.match(text, /2 entries before; not read after/);
  assert.equal(holdsNoBytes(text), true);
  assert.equal(text.includes(before.auth.sha256), false);
});

test('the usage says the command must be a real executable, since no shell starts it: not a `.cmd` shim', () => {
  const { home, out } = fakeHome();
  const result = prove(['--real-home', home, '--out', out]);
  assert.equal(result.code, 2);
  assert.match(result.err, /no shell/);
  assert.match(result.err, /real executable/);
  assert.match(result.err, /`node <script>`/);
  assert.match(result.err, /`\.cmd` shim/);
});

test('--real-home is required and has no default; without it, --out or a command, nothing runs: exit 2 with usage', () => {
  const { home, root, out } = fakeHome();
  const marker = path.join(root, 'ran');
  const mark = node("require('node:fs').writeFileSync(process.argv[1], '')", marker);
  const bad = [
    ['--out', out, '--', ...mark],
    ['--real-home', home, '--', ...mark],
    ['--real-home', home, '--out', out],
    ['--real-home', home, '--out', out, '--'],
    ['--real-home', '--out', out, '--', ...mark],
    ['--real-home', path.join(root, 'nowhere'), '--out', out, '--', ...mark],
    ['--real-home', path.join(home, 'config.toml'), '--out', out, '--', ...mark],
  ];
  for (const argv of bad) {
    const result = prove(argv);
    assert.equal(result.code, 2, argv.join(' '));
    assert.match(result.err, /Usage: node evals\/review\/login-proof\.mjs --real-home <path> --out <file\.md> -- <command/);
  }
  assert.equal(fs.existsSync(marker), false, 'no command was run');
  assert.equal(fs.existsSync(out), false, 'and no report written');
});

// --- who else may have written: the Codex processes alive when something else of the home changed ---

const CLIENTS = [
  { name: 'Codex.exe', pid: 4312, startedAt: '2026-10-06T11:23:05.000Z' },
  { name: 'codex.exe', pid: 9120, startedAt: null },
];

/** A report of a home in which `new.txt` appeared, with what was learnt of the Codex processes. */
function reportWithAChange(processes) {
  const { home } = fakeHome();
  const before = snapshot(home);
  fs.writeFileSync(path.join(home, 'new.txt'), 'x', 'utf8');
  const after = snapshot(home);
  return report({ date: '2026-10-06T12:00:00.000Z', realHome: home, command: ['node', 'x.mjs'], exitCode: 0, before, after, comparison: compare(before, after), processes });
}

const MAY_BE_ANOTHER = 'Another Codex client running on this machine may be what wrote these, and the proof cannot tell: it sees that the home changed, not who changed it.';

test('report: when something else of the home changed, it says another Codex client may be the writer and lists the Codex processes alive', () => {
  const lines = reportWithAChange({ list: CLIENTS }).split('\n');
  const at = lines.indexOf(`${MAY_BE_ANOTHER} Codex processes alive at the end of the run:`);
  assert.notEqual(at, -1, lines.join('\n'));
  assert.ok(at > lines.findIndex((line) => /`new\.txt`[^\n]*added/.test(line)), 'after the changes it is about');
  assert.deepEqual(lines.slice(at + 1, at + 3), ['- `Codex.exe`, pid 4312, started 2026-10-06T11:23:05.000Z', '- `codex.exe`, pid 9120, start time unknown']);
  // The login is judged as it was: what else changed, and who was running, is for a person to read.
  assert.match(lines.join('\n'), /Verdict: PASS/);
});

test('report: no Codex process alive is said as such, and a listing that failed as "could not be listed", with why', () => {
  assert.ok(reportWithAChange({ list: [] }).includes(`${MAY_BE_ANOTHER} No Codex process was alive at the end of the run.`));
  const failed = reportWithAChange({ error: 'powershell.exe exited 1' });
  assert.ok(failed.includes(`${MAY_BE_ANOTHER} The Codex processes alive at the end of the run could not be listed (powershell.exe exited 1).`), failed);
  // A report made with no word of them says that too, instead of leaving the question unasked.
  assert.match(reportWithAChange(undefined), /could not be listed \(no listing was made\)/);
});

test('report: when nothing else changed there is no word of other clients and no process list, whatever is alive', () => {
  const { home } = fakeHome();
  const snap = snapshot(home);
  const text = report({ date: '2026-10-06T12:00:00.000Z', realHome: home, command: ['node', 'x.mjs'], exitCode: 0, before: snap, after: snap, comparison: compare(snap, snap), processes: { list: CLIENTS } });
  assert.match(text, /Nothing else changed\./);
  assert.doesNotMatch(text, /Codex client|Codex process|pid/);
});

test('the tool lists the Codex processes once, after the command has ended, when it changed something else of the home', () => {
  const { home, out } = fakeHome();
  const write = "require('node:fs').writeFileSync(require('node:path').join(process.argv[1], 'history.jsonl'), 'x')";
  const asked = [];
  const listProcesses = () => {
    asked.push(fs.existsSync(path.join(home, 'history.jsonl')));
    return CLIENTS;
  };
  const result = prove(['--real-home', home, '--out', out, '--', ...node(write, home)], { listProcesses });
  assert.equal(result.code, 0, 'who else is running changes nothing of the verdict');
  assert.deepEqual(asked, [true], 'once, at the end of the run');
  const written = fs.readFileSync(out, 'utf8');
  assert.ok(written.includes(MAY_BE_ANOTHER), written);
  assert.ok(written.includes('- `Codex.exe`, pid 4312, started 2026-10-06T11:23:05.000Z'));
  assert.equal(result.out.trim(), written.trim());
});

test('the tool does not list any process when nothing else of the home changed', () => {
  const { home, auth, out } = fakeHome();
  let asked = 0;
  const listProcesses = () => {
    asked += 1;
    return CLIENTS;
  };
  // Not even when the login itself was rewritten in place: that is the write the proof is about.
  const rewrite = "require('node:fs').writeFileSync(process.argv[1], 'a login rewritten in place', { flag: 'w' })";
  for (const script of ['process.exit(0)', rewrite]) {
    const result = prove(['--real-home', home, '--out', out, '--', ...node(script, auth)], { listProcesses });
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /Nothing else changed\./);
    assert.doesNotMatch(result.out, /Codex client|Codex process/);
  }
  assert.equal(asked, 0);
});

test('a listing of the processes that throws is told in the report as "could not be listed", and changes nothing else', () => {
  const { home, out } = fakeHome();
  const write = "require('node:fs').writeFileSync(require('node:path').join(process.argv[1], 'history.jsonl'), 'x')";
  const listProcesses = () => {
    throw new Error('spawnSync powershell.exe ENOENT');
  };
  const result = prove(['--real-home', home, '--out', out, '--', ...node(write, home)], { listProcesses });
  assert.equal(result.code, 0, result.err);
  assert.ok(fs.readFileSync(out, 'utf8').includes(`${MAY_BE_ANOTHER} The Codex processes alive at the end of the run could not be listed (spawnSync powershell.exe ENOENT).`), result.out);
  assert.match(result.out, /`history\.jsonl`[^\n]*added/);
  assert.match(result.out, /Verdict: PASS/);
});

/** A fake `spawnSync` that answers with `result` and keeps what it was asked. */
function fakeSpawn(result) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0, stdout: '', stderr: '', ...result };
  };
  return { spawn, calls };
}

test('codexProcesses on Windows asks PowerShell for Win32_Process and keeps the Codex ones: name, pid and start time', () => {
  const stdout = ['9120\t\tcodex.exe', '4312\t2026-10-06T11:23:05.0000000Z\tCodex.exe', '77\t2026-10-06T09:00:00.0000000Z\tnode.exe', '', 'not a line of it'].join('\r\n');
  const { spawn, calls } = fakeSpawn({ stdout });
  assert.deepEqual(codexProcesses('win32', spawn), [
    { name: 'Codex.exe', pid: 4312, startedAt: '2026-10-06T11:23:05.000Z' },
    { name: 'codex.exe', pid: 9120, startedAt: null },
  ]);
  assert.equal(calls.length, 1);
  const [{ command, args, options }] = calls;
  assert.equal(command, 'powershell.exe');
  assert.deepEqual(args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
  assert.match(args[3], /Get-CimInstance Win32_Process/);
  assert.equal(options.encoding, 'utf8');
  assert.ok(options.timeout > 0, 'a listing that hangs must not hang the proof');
});

test('codexProcesses elsewhere reads `ps`: the pid, when it started and the command, whose name is its last part', () => {
  const stdout = [
    '  812 Tue Oct  6 11:23:05 2026 /Applications/Codex.app/Contents/MacOS/Codex',
    '   44 Tue Oct  6 09:00:00 2026 /usr/bin/node',
    ' 9120 Mon Oct  5 08:01:02 2026 codex',
    '',
  ].join('\n');
  for (const platform of ['linux', 'darwin']) {
    const { spawn, calls } = fakeSpawn({ stdout });
    const found = codexProcesses(platform, spawn);
    assert.deepEqual(found.map((one) => [one.name, one.pid]), [['Codex', 812], ['codex', 9120]], platform);
    assert.equal(found[0].startedAt, new Date('Tue Oct  6 11:23:05 2026').toISOString(), 'the date `ps` gives is in the time of the machine');
    assert.deepEqual([calls[0].command, calls[0].args], ['ps', ['-A', '-o', 'pid=,lstart=,comm=']], platform);
    assert.equal(calls[0].options.env.LC_ALL, 'C', 'so the date is written in the one language this reads');
  }
});

test('codexProcesses throws when the listing could not be run, and says why', () => {
  assert.throws(() => codexProcesses('win32', fakeSpawn({ error: Object.assign(new Error('spawnSync powershell.exe ENOENT'), { code: 'ENOENT' }), status: null }).spawn), /powershell\.exe.*ENOENT/);
  assert.throws(() => codexProcesses('win32', fakeSpawn({ status: 1, stderr: 'Access denied\r\nmore' }).spawn), /powershell\.exe exited 1: Access denied/);
  assert.throws(() => codexProcesses('linux', fakeSpawn({ status: null, signal: 'SIGTERM' }).spawn), /ps ended on SIGTERM/);
});

test('a report that cannot be written is exit 1, and it is still printed', () => {
  const { home, root } = fakeHome();
  const blocked = path.join(root, 'blocked');
  fs.mkdirSync(blocked);
  const result = prove(['--real-home', home, '--out', blocked, '--', ...node('process.exit(0)')]);
  assert.equal(result.code, 1);
  assert.match(result.err, /Could not write the report/);
  assert.match(result.out, /PASS/);
});

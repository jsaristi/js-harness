import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CLOCK_TOLERANCE_MS, killProcesses, killSurvivors, killTree, parseSnapshot, resolveRoot, selectDescendants, selectTrees, takeSnapshot,
} from './process-tree.mjs';

const proc = (pid, ppid, createdAt) => ({ pid, ppid, createdAt });
const sorted = (pids) => [...pids].sort((a, b) => a - b);

// ---- selectDescendants: the pure decision. Nothing below spawns anything. -------------------------------------------

// The root is `userinit.exe`'s reused pid in the incident this module exists for: `explorer.exe` records the pid
// of a parent that died long ago, and a short-lived child of ours got that very number.
test('an old process whose recorded parent pid equals a live root\'s pid is not its child', () => {
  const snapshot = [proc(100, 1, 5000), proc(7, 100, 10), proc(200, 100, 5100)];
  assert.deepEqual(sorted(selectDescendants(snapshot, { pid: 100, createdAt: 5000 })), [100, 200], 'pid 7 predates the root');
});

test('an old process whose recorded parent pid equals an exited root\'s pid is not its child', () => {
  const snapshot = [proc(7, 100, 10), proc(8, 100, 4000), proc(200, 100, 5100)];
  assert.deepEqual(selectDescendants(snapshot, { pid: 100, startedAt: 5000, exitedAt: 6000 }), [200], 'pids 7 and 8 predate the root');
});

test('a child and a grandchild of a live root are selected, root first', () => {
  const snapshot = [proc(100, 1, 5000), proc(200, 100, 5100), proc(300, 200, 5200), proc(400, 1, 5300)];
  assert.deepEqual(selectDescendants(snapshot, { pid: 100, createdAt: 5000 }), [100, 200, 300]);
});

test('the rule holds at every level: a grandchild older than its recorded parent is not selected, nor is anything below it', () => {
  const snapshot = [proc(100, 1, 5000), proc(200, 100, 5100), proc(300, 200, 5050), proc(301, 300, 5400), proc(400, 200, 5200)];
  assert.deepEqual(sorted(selectDescendants(snapshot, { pid: 100, createdAt: 5000 })), [100, 200, 400]);
});

test('a grandchild of an exited root is selected through its live child', () => {
  const snapshot = [proc(200, 100, 5100), proc(300, 200, 5200), proc(301, 200, 5000)];
  assert.deepEqual(selectDescendants(snapshot, { pid: 100, startedAt: 5000, exitedAt: 6000 }), [200, 300], 'the root is absent, and a grandchild older than its parent is not selected');
});

test('an exited root whose pid was reused: the new process and its children are not selected, the old root\'s survivor is', () => {
  const snapshot = [
    proc(100, 1, 7000), // the new owner of pid 100, created after the old one exited
    proc(900, 100, 7500), // its child
    proc(200, 100, 5500), // the old root's survivor
    proc(300, 200, 5600), // and the survivor's child
  ];
  const selected = selectDescendants(snapshot, { pid: 100, startedAt: 5000, exitedAt: 6000 });
  assert.deepEqual(sorted(selected), [200, 300]);
});

test('the root is part of a live root\'s selection and never of an exited root\'s', () => {
  const snapshot = [proc(100, 1, 5000), proc(200, 100, 5100)];
  assert.ok(selectDescendants(snapshot, { pid: 100, createdAt: 5000 }).includes(100));
  assert.ok(!selectDescendants(snapshot, { pid: 100, startedAt: 4000, exitedAt: 6000 }).includes(100));
  assert.ok(!selectDescendants([proc(100, 1, 5000)], { pid: 100, startedAt: 4000, exitedAt: 6000 }).includes(100), 'also when a new process holds the pid');
});

test('a process whose creation time is unknown is never selected, nor is anything reached only through it', () => {
  const unknown = [null, undefined, NaN, '5100'];
  for (const createdAt of unknown) {
    const snapshot = [proc(100, 1, 5000), proc(200, 100, createdAt), proc(300, 200, 5200), proc(400, 100, 5300)];
    assert.deepEqual(sorted(selectDescendants(snapshot, { pid: 100, createdAt: 5000 })), [100, 400], String(createdAt));
    assert.deepEqual(sorted(selectDescendants(snapshot, { pid: 100, startedAt: 4000, exitedAt: 6000 })), [400], String(createdAt));
  }
});

test('a root without a known time selects nothing', () => {
  const snapshot = [proc(100, 1, 5000), proc(200, 100, 5100)];
  for (const root of [{ pid: 100 }, { pid: 100, createdAt: null }, { pid: 100, startedAt: 4000 }, { pid: 100, exitedAt: 6000 }, { pid: 100, startedAt: NaN, exitedAt: 6000 }, {}, null]) {
    assert.deepEqual(selectDescendants(snapshot, root), [], JSON.stringify(root));
  }
});

test('the window of an exited root is its life, widened by the clock tolerance and no more', () => {
  const root = { pid: 100, startedAt: 5000, exitedAt: 6000 };
  const tolerance = CLOCK_TOLERANCE_MS;
  const at = (createdAt) => selectDescendants([proc(200, 100, createdAt)], root);
  assert.deepEqual(at(5000 - tolerance), [200], 'created a clock tick before it started');
  assert.deepEqual(at(5000 - tolerance - 1), []);
  assert.deepEqual(at(6000 + tolerance), [200], 'created a clock tick after it exited');
  assert.deepEqual(at(6000 + tolerance + 1), []);
  assert.deepEqual(selectDescendants([proc(200, 100, 5000 - 30)], root, { tolerance: 10 }), [], 'the tolerance is a parameter');
});

test('pids 0 to 4 (idle, system) are never selected, whatever they record', () => {
  const snapshot = [proc(0, 0, 5100), proc(4, 100, 5100), proc(3, 100, 5100), proc(200, 100, 5100)];
  assert.deepEqual(selectDescendants(snapshot, { pid: 100, createdAt: 5000 }), [100, 200]);
  assert.deepEqual(selectDescendants(snapshot, { pid: 4, createdAt: 5000 }), [], 'not even as a root');
});

test('a cycle of recorded parents ends, and each pid is selected once', () => {
  const snapshot = [proc(100, 1, 5000), proc(200, 100, 5100), proc(100, 200, 5100), proc(300, 200, 5100), proc(300, 100, 5100)];
  assert.deepEqual(sorted(selectDescendants(snapshot, { pid: 100, createdAt: 5000 })), [100, 200, 300]);
});

test('selectTrees is the union of the live roots\' trees, without the spared pids or what hangs below them', () => {
  const snapshot = [proc(10, 1, 100), proc(11, 10, 110), proc(20, 1, 100), proc(21, 20, 120), proc(22, 11, 130), proc(30, 1, 100)];
  assert.deepEqual(sorted(selectTrees(snapshot, [10, 20, 404])), [10, 11, 20, 21, 22], 'pid 404 is not in the snapshot');
  assert.deepEqual(sorted(selectTrees(snapshot, [10, 20], { spared: [11] })), [10, 20, 21], 'pid 11 and its child 22 stay');
  assert.deepEqual(selectTrees([proc(10, 1, null)], [10]), [], 'a match whose creation time is unknown is not killed');
});

// ---- resolveRoot ----------------------------------------------------------------------------------------------------

test('a caller that knows when a child started, and whether it exited, gets the root the selection needs', () => {
  const snapshot = [proc(100, 1, 5000), proc(200, 100, 5100)];
  assert.deepEqual(resolveRoot(snapshot, { pid: 100, startedAt: 4990 }), { pid: 100, createdAt: 5000 }, 'live: the snapshot has it');
  assert.deepEqual(resolveRoot(snapshot, { pid: 100 }), { pid: 100, createdAt: 5000 }, 'live with no start time: Node still holds the pid');
  assert.deepEqual(resolveRoot(snapshot, { pid: 100, startedAt: 4000, exitedAt: 6000 }), { pid: 100, startedAt: 4000, exitedAt: 6000 });
  assert.deepEqual(resolveRoot(snapshot, { pid: 555, startedAt: 4000 }, { now: 8000 }), { pid: 555, startedAt: 4000, exitedAt: 8000 }, 'live but already gone: it exited by now');
  assert.equal(resolveRoot(snapshot, { pid: 555 }, { now: 8000 }), null, 'gone and never timed: nothing is known of it');
});

test('a pid whose process started before the child was spawned is another process: it is not the live root', () => {
  const snapshot = [proc(100, 1, 1000)];
  assert.deepEqual(resolveRoot(snapshot, { pid: 100, startedAt: 5000 }, { now: 8000 }), { pid: 100, startedAt: 5000, exitedAt: 8000 });
  assert.deepEqual(selectDescendants([proc(100, 1, 1000), proc(200, 100, 6000)], resolveRoot([proc(100, 1, 1000), proc(200, 100, 6000)], { pid: 100, startedAt: 5000 }, { now: 8000 })), [200], 'and it is never selected itself');
});

// ---- parseSnapshot --------------------------------------------------------------------------------------------------

test('a snapshot is read from tab-separated rows; a row without a creation time keeps its place with a null', () => {
  const text = '4\t0\t1700000000000\tSystem\r\n100\t4\t\tsvchost.exe\r\nnoise\r\n\r\n200\t100\t1700000001234\tnode.exe\r\n';
  assert.deepEqual(parseSnapshot(text), [
    { pid: 4, ppid: 0, createdAt: 1700000000000, name: 'System' },
    { pid: 100, ppid: 4, createdAt: null, name: 'svchost.exe' },
    { pid: 200, ppid: 100, createdAt: 1700000001234, name: 'node.exe' },
  ]);
});

// ---- the commands: what is run, and what is never run -----------------------------------------------------------------

/** A `spawnSync` that answers from `script`, one result per call in order, and keeps the calls. Nothing starts. */
function scripted(script) {
  const calls = [];
  const sync = (command, args = [], options = {}) => {
    calls.push({ command, args, options });
    const result = script[calls.length - 1] ?? { status: 0, stdout: '', stderr: '' };
    return { status: 0, stdout: '', stderr: '', ...(typeof result === 'function' ? result({ command, args, options }) : result) };
  };
  sync.calls = calls;
  return sync;
}
const scriptOf = (call) => Buffer.from(call.args[call.args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
const rows = (...entries) => entries.map(({ pid, ppid, createdAt, name = 'x.exe' }) => `${pid}\t${ppid}\t${createdAt ?? ''}\t${name}`).join('\r\n');

test('the snapshot is one PowerShell run over CIM; a lookup that failed throws instead of reading as an empty machine', () => {
  const sync = scripted([{ stdout: rows(proc(100, 1, 5000)) }]);
  assert.deepEqual(takeSnapshot({ spawnSync: sync }).map(({ pid }) => pid), [100]);
  assert.equal(sync.calls.length, 1);
  assert.equal(sync.calls[0].command, 'powershell');
  assert.ok(sync.calls[0].args.includes('-NoProfile'));
  assert.match(scriptOf(sync.calls[0]), /Win32_Process/);
  assert.throws(() => takeSnapshot({ spawnSync: scripted([{ status: 1, stderr: 'Access denied' }]) }), /snapshot.*Access denied/s);
  assert.throws(() => takeSnapshot({ spawnSync: scripted([{ error: new Error('spawn powershell ENOENT') }]) }), /snapshot.*ENOENT/s);
  assert.throws(() => takeSnapshot({ spawnSync: scripted([{ stdout: '' }]) }), /snapshot.*no process/s, 'an empty listing cannot be a real machine');
});

test('only the selected pid@creation-time pairs reach the kill, in the environment and not in the script text', () => {
  const sync = scripted([{ stdout: 'K\t200\r\nG\t300\r\n' }]);
  const result = killProcesses([{ pid: 200, createdAt: 5100 }, { pid: 300, createdAt: 5200 }], { spawnSync: sync });
  assert.deepEqual(result, { killed: [200], gone: [300], running: [] });
  assert.equal(sync.calls.length, 1);
  assert.equal(sync.calls[0].command, 'powershell');
  assert.equal(sync.calls[0].options.env.JS_HARNESS_KILL_TARGETS, '200@5100\n300@5200');
  const script = scriptOf(sync.calls[0]);
  assert.ok(!script.includes('200') && !script.includes('5100'), 'no pid travels as script text');
  assert.ok(!/taskkill|Stop-Process/i.test(script), 'a kill of one process, through the handle that was checked');
  assert.match(script, /StartTime/, 'the creation time is checked again just before the kill');
});

test('nothing to kill starts nothing; a kill that could not run, or left a process running, is reported', () => {
  const never = () => assert.fail('PowerShell must not be started');
  assert.deepEqual(killProcesses([], { spawnSync: never }), { killed: [], gone: [], running: [] });
  assert.throws(() => killProcesses([{ pid: 200, createdAt: 5100 }], { spawnSync: scripted([{ error: new Error('no powershell') }]) }), /no powershell/);
  assert.throws(() => killProcesses([{ pid: 200, createdAt: 5100 }], { spawnSync: scripted([{ status: 1, stderr: 'boom' }]) }), /boom/);
  assert.deepEqual(killProcesses([{ pid: 200, createdAt: 5100 }], { spawnSync: scripted([{ stdout: 'R\t200\r\n' }]) }), { killed: [], gone: [], running: [200] });
});

test('a pid or creation time that is not a plain number never reaches the command', () => {
  const never = () => assert.fail('PowerShell must not be started');
  for (const target of [{ pid: '200; calc', createdAt: 5100 }, { pid: 200, createdAt: 'x' }, { pid: -1, createdAt: 5100 }, { pid: 200, createdAt: null }, { pid: 3, createdAt: 5100 }]) {
    assert.throws(() => killProcesses([target], { spawnSync: never }), /target/, JSON.stringify(target));
  }
});

test('killTree of a live child on Windows kills the child and what the snapshot proves is below it, each pair once', () => {
  const snapshot = [proc(100, 1, 5000), proc(7, 100, 10), proc(200, 100, 5100), proc(300, 200, 5200), proc(555, 1, 5300)];
  const sync = scripted([{ stdout: rows(...snapshot) }, { stdout: 'K\t100\r\nK\t200\r\nK\t300\r\n' }]);
  killTree({ pid: 100 }, { startedAt: 4990 }, { platform: 'win32', spawnSync: sync });
  assert.deepEqual(sync.calls.map((call) => call.command), ['powershell', 'powershell']);
  assert.deepEqual(sync.calls[1].options.env.JS_HARNESS_KILL_TARGETS.split('\n'), ['100@5000', '200@5100', '300@5200'], 'pid 7 predates the child; pid 555 is unrelated');
});

test('killSurvivors of an exited child kills what it left behind, never a process with its pid, never one that predates it', () => {
  const snapshot = [
    proc(100, 1, 7000), // pid 100 now belongs to a new process
    proc(900, 100, 7100), // whose child is nobody's business
    proc(7, 100, 10), // userinit-like: records pid 100 as its parent, long before
    proc(200, 100, 5500), // what the exited child left behind
    proc(300, 200, 5600),
  ];
  const sync = scripted([{ stdout: rows(...snapshot) }, { stdout: 'K\t200\r\nK\t300\r\n' }]);
  killSurvivors({ pid: 100 }, { startedAt: 5000, exitedAt: 6000 }, { platform: 'win32', spawnSync: sync });
  assert.deepEqual(sync.calls[1].options.env.JS_HARNESS_KILL_TARGETS.split('\n'), ['200@5500', '300@5600']);
});

test('when the selection is empty the kill is never started', () => {
  const sync = scripted([{ stdout: rows(proc(100, 1, 7000), proc(7, 100, 10)) }]);
  killSurvivors({ pid: 100 }, { startedAt: 5000, exitedAt: 6000 }, { platform: 'win32', spawnSync: sync });
  assert.equal(sync.calls.length, 1, 'only the snapshot');
});

test('a snapshot that failed makes killTree and killSurvivors throw: "nothing to kill" is never read from "could not look"', () => {
  const failing = () => scripted([{ status: 1, stderr: 'CIM is down' }]);
  assert.throws(() => killTree({ pid: 100 }, { startedAt: 4990 }, { platform: 'win32', spawnSync: failing() }), /CIM is down/);
  assert.throws(() => killSurvivors({ pid: 100 }, { startedAt: 5000, exitedAt: 6000 }, { platform: 'win32', spawnSync: failing() }), /CIM is down/);
});

test('an exited child with no recorded start time cannot be searched: that throws, and nothing is looked up or killed', () => {
  const never = () => assert.fail('nothing may run');
  assert.throws(() => killSurvivors({ pid: 100 }, { exitedAt: 6000 }, { platform: 'win32', spawnSync: never }), /start/);
  assert.throws(() => killSurvivors({ pid: 100 }, undefined, { platform: 'win32', spawnSync: never }), /start/);
});

test('a child with no pid has nothing to kill', () => {
  const never = () => assert.fail('nothing may run');
  killTree({}, { startedAt: 1 }, { platform: 'win32', spawnSync: never, kill: never });
  killSurvivors({}, { startedAt: 1, exitedAt: 2 }, { platform: 'win32', spawnSync: never, kill: never });
});

test('on POSIX the process group is killed through the injected kill, and nothing is spawned', () => {
  const never = () => assert.fail('nothing is spawned on POSIX');
  const killed = [];
  const kill = (pid, signal) => killed.push([pid, signal]);
  killTree({ pid: 321 }, { startedAt: 1 }, { platform: 'linux', spawnSync: never, kill });
  killSurvivors({ pid: 321 }, { startedAt: 1, exitedAt: 2 }, { platform: 'linux', spawnSync: never, kill });
  assert.deepEqual(killed, [[-321, 'SIGKILL'], [-321, 'SIGKILL']]);
  killTree({ pid: 321 }, undefined, { platform: 'linux', spawnSync: never, kill: () => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); } });
});

test('on POSIX a group that cannot be killed falls back to the child itself', () => {
  const never = () => assert.fail('nothing is spawned on POSIX');
  const killed = [];
  killTree({ pid: 77, kill: (signal) => killed.push(signal) }, undefined, { platform: 'linux', spawnSync: never, kill: () => { throw new Error('EPERM'); } });
  assert.deepEqual(killed, ['SIGKILL']);
  killTree({ pid: 77, kill: () => { throw new Error('already gone'); } }, undefined, { platform: 'linux', spawnSync: never, kill: () => { throw new Error('EPERM'); } });
});

/** Every non-test source file under `dir`, recursively, without the comment lines. */
function sourcesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'runs' ? [] : sourcesUnder(entryPath);
    if (!/\.mjs$/.test(entry.name) || /\.test\.mjs$/.test(entry.name)) return [];
    const code = fs.readFileSync(entryPath, 'utf8').split(/\r?\n/).filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
    return [{ file: path.relative(ROOT, entryPath), code }];
  });
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('no source under bin/ or evals/ kills a tree: no taskkill, no Stop-Process, no kill by a bare parent pid', () => {
  const sources = [...sourcesUnder(path.join(ROOT, 'bin')), ...sourcesUnder(path.join(ROOT, 'evals'))];
  assert.ok(sources.some(({ file }) => file.endsWith('process-tree.mjs')), 'the scan sees this module');
  for (const { file, code } of sources) {
    assert.ok(!/taskkill|Stop-Process/i.test(code), `${file} names a command that kills by pid or tree`);
    assert.ok(!/-Filter[^\n]*ParentProcessId/.test(code), `${file} looks processes up by a bare parent pid`);
  }
});

// ---- the real thing, against processes of this test's own -----------------------------------------------------------

const sleeperCode = 'setInterval(() => {}, 1000)';
const waitUntil = async (predicate, ms = 15000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return predicate();
};
const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
};
const strays = new Set();
const track = (child) => {
  strays.add(child.pid);
  return child;
};
test.after(() => {
  for (const pid of strays) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
});

/** A parent that starts a detached grandchild and reports its pid on stdout, then sleeps. */
async function startPair() {
  const code = [
    "const { spawn } = require('node:child_process');",
    `const child = spawn(process.execPath, ['-e', ${JSON.stringify(sleeperCode)}], { detached: true, stdio: 'ignore', windowsHide: true });`,
    'console.log(child.pid);',
    sleeperCode,
  ].join('\n');
  const startedAt = Date.now();
  const parent = track(spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }));
  let text = '';
  parent.stdout.on('data', (chunk) => { text += chunk; });
  assert.ok(await waitUntil(() => /\d+\s/.test(text)), 'the parent reported its child');
  const grandchild = Number(text.trim());
  strays.add(grandchild);
  return { parent, grandchild, startedAt };
}

const WINDOWS_ONLY = process.platform === 'win32' ? false : 'the snapshot-based kill is the Windows path; POSIX kills a process group';

test('real: killTree takes a live child and its descendant, and spares a bystander that is none of its business', { skip: WINDOWS_ONLY }, async () => {
  const { parent, grandchild, startedAt } = await startPair();
  const bystander = track(spawn(process.execPath, ['-e', sleeperCode], { stdio: 'ignore', windowsHide: true }));
  killTree(parent, { startedAt });
  assert.ok(await waitUntil(() => !isAlive(parent.pid) && !isAlive(grandchild)), 'the child and the grandchild are gone');
  assert.ok(isAlive(bystander.pid), 'the bystander lives');
});

test('real: killSurvivors takes what an exited child left behind, found through its dead parent', { skip: WINDOWS_ONLY }, async () => {
  const { parent, grandchild, startedAt } = await startPair();
  const exited = new Promise((resolve) => parent.once('exit', resolve));
  process.kill(parent.pid, 'SIGKILL');
  await exited;
  const exitedAt = Date.now();
  assert.ok(isAlive(grandchild), 'the grandchild outlived its parent');
  killSurvivors(parent, { startedAt, exitedAt });
  assert.ok(await waitUntil(() => !isAlive(grandchild)), 'the survivor is gone');
});

test('real: a process created before the child was spawned is never selected, even when it records the child\'s pid as its parent', { skip: WINDOWS_ONLY }, async () => {
  const before = takeSnapshot();
  const child = track(spawn(process.execPath, ['-e', sleeperCode], { stdio: 'ignore', windowsHide: true }));
  const startedAt = Date.now() - 5; // as a caller records it: just before the spawn
  const after = takeSnapshot();
  const decoy = { pid: 999999, ppid: child.pid, createdAt: startedAt - 60 * 60 * 1000, name: 'explorer-like' };
  const selected = selectDescendants([...after, decoy], resolveRoot(after, { pid: child.pid, startedAt }));
  assert.equal(selected[0], child.pid, 'the child comes first');
  assert.ok(!selected.includes(decoy.pid), 'the decoy predates the child and is not selected');
  assert.ok(selected.every((pid) => pid === child.pid || after.find((entry) => entry.pid === pid).ppid === child.pid), 'whatever else is selected (a console host, say) really records the child as its parent');
  assert.ok(before.length > 0 && after.some((entry) => entry.pid === child.pid));
  const mine = after.find((entry) => entry.pid === child.pid);
  assert.ok(mine.createdAt >= startedAt - CLOCK_TOLERANCE_MS && mine.createdAt <= Date.now() + CLOCK_TOLERANCE_MS, `CIM and Node clocks agree: ${mine.createdAt} vs ${startedAt}`);
  killTree(child, { startedAt });
  assert.ok(await waitUntil(() => !isAlive(child.pid)));
});

test('real: a kill whose recorded creation time is wrong leaves the process alone', { skip: WINDOWS_ONLY }, async () => {
  const child = track(spawn(process.execPath, ['-e', sleeperCode], { stdio: 'ignore', windowsHide: true }));
  const mine = takeSnapshot().find((entry) => entry.pid === child.pid);
  const result = killProcesses([{ pid: child.pid, createdAt: mine.createdAt - 60 * 60 * 1000 }]);
  assert.deepEqual(result, { killed: [], gone: [child.pid], running: [] }, 'a process that is not the one seen is "gone" to the caller');
  assert.ok(isAlive(child.pid), 'it was not killed');
  assert.deepEqual(killProcesses([{ pid: child.pid, createdAt: mine.createdAt }]).killed, [child.pid]);
  assert.ok(await waitUntil(() => !isAlive(child.pid)));
});

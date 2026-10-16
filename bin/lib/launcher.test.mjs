import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchersAlive, readLaunchers, startLaunchers } from './launcher.mjs';

// The launchers of a gate (odd/tasks/orphan-gate.md): the processes whose end leaves it an orphan, read once
// when it starts and asked again while it waits.

/** A process table as `readLaunchers` reads one: pid to `{ pid, ppid, name, start }`. */
const table = (...rows) => new Map(rows.map(([pid, ppid, name, start]) => [pid, { pid, ppid, name, start }]));

test('the launchers are the parent and each shell above it, up to and with the first process that is no shell', () => {
  // node 40 <- the stub sh 30 that forked it <- the script's sh 20 <- the session's bash 10 <- claude 5 <- explorer 1
  const rows = table([30, 20, 'sh.exe', 300], [20, 10, 'sh.exe', 200], [10, 5, 'bash.exe', 100], [5, 1, 'claude.exe', 50], [1, 0, 'explorer.exe', 10]);
  assert.deepEqual(readLaunchers({ ppid: 30, readTable: () => rows }), [
    { pid: 30, name: 'sh.exe', start: 300 },
    { pid: 20, name: 'sh.exe', start: 200 },
    { pid: 10, name: 'bash.exe', start: 100 },
    { pid: 5, name: 'claude.exe', start: 50 },
  ]);
  // A gate started by a process that is no shell has that one launcher; the shim of an installed command is a shell.
  assert.deepEqual(readLaunchers({ ppid: 5, readTable: () => rows }), [{ pid: 5, name: 'claude.exe', start: 50 }]);
  const shim = table([7, 6, 'cmd.exe', 70], [6, 5, 'bash.exe', 60], [5, 1, 'claude.exe', 50]);
  assert.deepEqual(readLaunchers({ ppid: 7, readTable: () => shim }).map((one) => one.pid), [7, 6, 5]);
  // Linux names: dash and bash, with no extension.
  const linux = table([30, 20, 'dash', 3], [20, 1, 'systemd', 1]);
  assert.deepEqual(readLaunchers({ ppid: 30, readTable: () => linux }).map((one) => one.pid), [30, 20]);
});

test('read as the gate starts, a parent already gone ended before it and is no launcher: the chain ends with the shell it left', () => {
  // The Bash tool's chain, measured 2026-10-15: node's sh 30 <- the tool's sh 20 <- a wrapper 10 that ended
  // within the first second, before any gate waited. Read as a gone launcher, it refused every wait.
  const tool = table([30, 20, 'sh.exe', 300], [20, 10, 'sh.exe', 200]);
  const read = readLaunchers({ ppid: 30, readTable: () => tool });
  assert.deepEqual(read, [{ pid: 30, name: 'sh.exe', start: 300 }, { pid: 20, name: 'sh.exe', start: 200 }]);
  assert.equal(launchersAlive(read, { exists: () => true, ppid: null, full: true, readTable: () => tool }), true);
  // A parent pid given since to a process that started after its child is no parent of it either.
  const reused = table([30, 20, 'sh.exe', 300], [20, 5, 'notepad.exe', 400]);
  assert.deepEqual(readLaunchers({ ppid: 30, readTable: () => reused }), [{ pid: 30, name: 'sh.exe', start: 300 }]);
  // A process that is no shell may have a parent that ended long ago: explorer's is, and that is no sign.
  assert.deepEqual(readLaunchers({ ppid: 5, readTable: () => table([5, 3, 'claude.exe', 50]) }), [{ pid: 5, name: 'claude.exe', start: 50 }]);
});

// The read beside the gate, against this machine's own table (the native review's advisory on 1134f84).
test('on Windows the table comes in beside the gate: settle gives the chain read at start, and a read stopped first leaves the parent alone', { skip: process.platform !== 'win32' && 'Windows only', timeout: 60_000 }, async () => {
  const soon = startLaunchers({ ppid: process.ppid });
  assert.equal(soon.read(), null, 'nothing is in at once');
  const chain = await soon.settle();
  assert.equal(chain[0].pid, process.ppid);
  assert.equal(typeof chain[0].start, 'number', JSON.stringify(chain));
  assert.deepEqual(soon.read(), chain);
  soon.stop();
  const stopped = startLaunchers({ ppid: process.ppid });
  stopped.stop();
  assert.deepEqual(await stopped.settle(), [{ pid: process.ppid, name: null, start: null }]);
});

test('a table that cannot be read, or that lacks the parent, leaves the parent alone, by its pid', () => {
  assert.deepEqual(readLaunchers({ ppid: 30, readTable: () => null }), [{ pid: 30, name: null, start: null }]);
  assert.deepEqual(readLaunchers({ ppid: 30, readTable: () => { throw new Error('no PowerShell'); } }), [{ pid: 30, name: null, start: null }]);
  assert.deepEqual(readLaunchers({ ppid: 30, readTable: () => table([20, 10, 'sh.exe', 200]) }), [{ pid: 30, name: null, start: null }]);
  // A loop in the table ends the walk.
  assert.deepEqual(readLaunchers({ ppid: 30, readTable: () => table([30, 20, 'sh', 3], [20, 30, 'sh', 2]) }).map((one) => one.pid), [30, 20]);
});

test('the launchers are alive while every one exists; one gone is enough, and a pid reused since is caught by its start time', () => {
  const launchers = [{ pid: 30, name: 'sh.exe', start: 300 }, { pid: 20, name: 'sh.exe', start: 200 }];
  const exists = (gone) => (pid) => !gone.includes(pid);
  // Off Linux's adoption check unless a case asks for it: the pids here are made up, and so is the parent.
  const alive = (list, options) => launchersAlive(list, { ppid: null, ...options });
  assert.equal(alive(launchers, { exists: exists([]) }), true);
  assert.equal(alive(launchers, { exists: exists([20]) }), false);
  assert.equal(alive(launchers, { exists: exists([30]) }), false);
  // The full look reads the table again: the same pids with the same start times.
  const same = () => table([30, 20, 'sh.exe', 300], [20, 10, 'sh.exe', 200]);
  assert.equal(alive(launchers, { exists: exists([]), full: true, readTable: same }), true);
  const reused = () => table([30, 20, 'sh.exe', 300], [20, 10, 'notepad.exe', 999]);
  assert.equal(alive(launchers, { exists: exists([]), full: true, readTable: reused }), false);
  const missing = () => table([30, 20, 'sh.exe', 300]);
  assert.equal(alive(launchers, { exists: exists([]), full: true, readTable: missing }), false);
  // A look that cannot read the table never takes a launcher for dead.
  assert.equal(alive(launchers, { exists: exists([]), full: true, readTable: () => null }), true);
  assert.equal(alive(launchers, { exists: exists([]), full: true, readTable: () => { throw new Error('busy'); } }), true);
  // A launcher whose start was never read is held to its pid alone.
  assert.equal(alive([{ pid: 30, name: null, start: null }], { exists: exists([]), full: true, readTable: () => table() }), true);
  // On Linux an orphan is adopted: a parent that is no longer the first launcher is gone, whatever exists.
  assert.equal(alive(launchers, { exists: exists([]), ppid: () => 1 }), false);
  assert.equal(alive(launchers, { exists: exists([]), ppid: () => 30 }), true);
});

const here = path.dirname(fileURLToPath(import.meta.url));
const hasSh = spawnSync('sh', ['-c', 'exit 0']).status === 0;

test('a real node started by a shell whose own parent has ended sees its launchers alive, and gone once that shell ends', { skip: !hasSh && 'no sh on this machine', timeout: 120_000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-launcher-'));
  const said = path.join(dir, 'said.txt');
  const child = path.join(dir, 'child.mjs');
  const middle = path.join(dir, 'middle.mjs');
  const lib = path.join(here, 'launcher.mjs').replace(/\\/g, '/');
  fs.writeFileSync(child, [
    `import fs from 'node:fs';`,
    `import { launchersAlive, readLaunchers } from 'file:///${lib.replace(/^\//, '')}';`,
    `const launchers = readLaunchers();`,
    `fs.writeFileSync(${JSON.stringify(said)}, (launchersAlive(launchers, { full: true }) ? 'alive ' : 'gone ') + launchers.length);`,
    `const end = Date.now() + 40000;`,
    `const look = () => { if (!launchersAlive(launchers)) { fs.writeFileSync(${JSON.stringify(said)}, 'gone'); process.exit(0); } if (Date.now() > end) process.exit(3); setTimeout(look, 200); };`,
    `setTimeout(look, 200);`,
  ].join('\n'));
  // A process that starts the shell and ends, as the wrapper above the Bash tool's shell does; the shell waits
  // for its parent to be gone before it starts node, and ends when this test writes `stop`, node still running
  // (no pid is signalled: Windows reuses them). A builtin last, so the shell does not become another command.
  const stop = path.join(dir, 'stop').replace(/\\/g, '/');
  fs.writeFileSync(middle, [
    `import { spawn } from 'node:child_process';`,
    `const shell = spawn('sh', ['-c', 'sleep 2; "${process.execPath.replace(/\\/g, '/')}" "${child.replace(/\\/g, '/')}" & while [ ! -e "${stop}" ]; do sleep 1; done; true'], { stdio: 'ignore', detached: true });`,
    `shell.unref();`,
  ].join('\n'));
  assert.equal(spawnSync(process.execPath, [middle]).status, 0);
  try {
    const until = async (ok, ms) => {
      for (const end = Date.now() + ms; Date.now() < end; await new Promise((resolve) => setTimeout(resolve, 100))) if (ok()) return true;
      return false;
    };
    const read = () => (fs.existsSync(said) ? fs.readFileSync(said, 'utf8') : '');
    // A whole run on Windows starved this first read past 20 s while the test passed alone (first-version T6c).
    assert.ok(await until(() => /^(alive|gone) /.test(read()), 60_000), `the child never read its launchers: ${read()}`);
    assert.match(read(), /^alive [1-9]/);
    fs.writeFileSync(stop, '');
    assert.ok(await until(() => read() === 'gone', 30_000), `the child did not see the shell end: ${read()}`);
  } finally {
    // The shell ends on `stop` alone: written here too, and given its second of sleep, before the folder goes.
    fs.writeFileSync(stop, '');
    await new Promise((resolve) => setTimeout(resolve, 2500));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a real node whose script shell is killed sees its launchers gone, though its own parent may live on', { skip: !hasSh && 'no sh on this machine', timeout: 60_000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-launcher-'));
  const said = path.join(dir, 'said.txt');
  const child = path.join(dir, 'child.mjs');
  const lib = path.join(here, 'launcher.mjs').replace(/\\/g, '/');
  fs.writeFileSync(child, [
    `import fs from 'node:fs';`,
    `import { launchersAlive, readLaunchers } from 'file:///${lib.replace(/^\//, '')}';`,
    `const launchers = readLaunchers();`,
    `fs.writeFileSync(${JSON.stringify(said)}, 'ready ' + launchers.length);`,
    `const end = Date.now() + 40000;`,
    `const look = () => { if (!launchersAlive(launchers)) { fs.writeFileSync(${JSON.stringify(said)}, 'gone'); process.exit(0); } if (Date.now() > end) process.exit(3); setTimeout(look, 200); };`,
    `look();`,
  ].join('\n'));
  // Two commands, so the shell forks for node instead of becoming it, as a script does.
  const shell = spawn('sh', ['-c', `"${process.execPath.replace(/\\/g, '/')}" "${child.replace(/\\/g, '/')}"; echo after`], { stdio: 'ignore' });
  try {
    const until = async (ok, ms) => {
      for (const end = Date.now() + ms; Date.now() < end; await new Promise((resolve) => setTimeout(resolve, 100))) if (ok()) return true;
      return false;
    };
    const read = () => (fs.existsSync(said) ? fs.readFileSync(said, 'utf8') : '');
    assert.ok(await until(() => read().startsWith('ready'), 20_000), `the child never read its launchers: ${read()}`);
    assert.match(read(), /^ready [1-9]/);
    shell.kill('SIGKILL');
    assert.ok(await until(() => read() === 'gone', 20_000), `the child did not see the shell end: ${read()}`);
  } finally {
    shell.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

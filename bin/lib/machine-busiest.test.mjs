import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { spawn as spawnChild } from 'node:child_process';
import { BUSIEST_BOUND_MS, BUSIEST_LOOK_MS, busiestBetween, busiestLines, busiestProcesses, parseProcStat, parseProcessReadings, scriptOf, splitCommandLine } from './machine-busiest.mjs';

// What loads a loaded machine: every process's CPU time read twice, the difference taken, and the three
// that spent most named by program and script. Every test but the last reads recorded output through
// stand-ins: none starts PowerShell or reads `/proc`. The last one runs the real look of this machine.

test('splitCommandLine splits a Windows command line at the spaces outside its double quotes', () => {
  assert.deepEqual(splitCommandLine('node --max-old-space-size=4096 C:\\x\\tsserver.js'), ['node', '--max-old-space-size=4096', 'C:\\x\\tsserver.js']);
  assert.deepEqual(splitCommandLine('"C:\\Program Files\\nodejs\\node.exe"   "D:\\my project\\run tests.mjs" --watch'), ['C:\\Program Files\\nodejs\\node.exe', 'D:\\my project\\run tests.mjs', '--watch']);
  // Quotes that open inside an argument keep its spaces, and an empty pair is an argument of its own.
  assert.deepEqual(splitCommandLine('app.exe --name="two words" "" last'), ['app.exe', '--name=two words', '', 'last']);
  assert.deepEqual(splitCommandLine(''), []);
  assert.deepEqual(splitCommandLine('   '), []);
});

test('scriptOf gives the base name of the first argument that is not an option, and nothing where there is none', () => {
  const windows = (line, name = 'node') => scriptOf(splitCommandLine(line), name, { windows: true });
  assert.equal(windows('node --max-old-space-size=4096 C:\\x\\tsserver.js'), 'tsserver.js');
  assert.equal(windows('"C:\\Program Files\\nodejs\\node.exe" "D:\\my project\\run tests.mjs" --watch'), 'run tests.mjs');
  assert.equal(windows('node D:/proj/bin/check.mjs --cwd D:/proj'), 'check.mjs');
  // The first one, whatever comes after it.
  assert.equal(windows('node --test bin/check.test.mjs bin/gate.test.mjs'), 'check.test.mjs');
  // Options alone, or no argument at all: the name of the program is all there is to say.
  assert.equal(windows('"C:\\Program Files\\Google\\Chrome\\chrome.exe" --type=renderer --lang=es', 'chrome'), null);
  assert.equal(windows('node'), null);
  assert.equal(windows(''), null);
  // A switch of Windows is an option too, and a path that starts with a slash is not one.
  assert.equal(windows('cmd.exe /d /s /c build.cmd', 'cmd'), 'build.cmd');
  assert.equal(windows('node /work/app/server.js'), 'server.js');
  assert.equal(scriptOf(['/usr/bin/node', '/srv/app.js'], 'node'), 'app.js');
  assert.equal(scriptOf(['sh', '/tmp'], 'sh'), null);
  // A program path with spaces and no quotes around it splits in two: its own name is no script.
  assert.equal(windows('C:\\Program Files\\nodejs\\node.exe --version'), null);
  // The arguments of Linux come already split, so a space is part of a name.
  assert.equal(scriptOf(['python3', '-u', '/home/me/my tools/serve files.py', '--port', '8000'], 'python3'), 'serve files.py');
});

// The first argument that is not an option may be the value of one, and a value may be a secret. Only what
// reads as a file name is said.
test('scriptOf says nothing of an argument that does not read as a file name, since it may be a secret', () => {
  const said = (...args) => scriptOf(['tool', ...args], 'tool');
  assert.equal(said('-p', 'hunter2'), null);
  assert.equal(said('-H', 'Authorization: Bearer abc.def.ghi', 'https://example.com/x.json'), null);
  assert.equal(said('postgres://me:secret@db.example.com'), null);
  assert.equal(said('https://example.com/report.html?token=abc'), null);
  assert.equal(said('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c'), null);
  assert.equal(said('TOKEN=abc.def'), null);
  assert.equal(said(`${'a'.repeat(70)}.js`), null);
  // And still says a file, whatever folder it is in.
  assert.equal(said('https://me:secret@example.com/tools/install.sh'), 'install.sh');
  assert.equal(said('-jar', 'app-1.2.jar'), 'app-1.2.jar');
  assert.equal(said('año nuevo.py'), 'año nuevo.py');
});

const proc = (pid, name, cpuSeconds) => ({ pid, name, cpuSeconds });

test('busiestBetween takes the difference of two readings and gives the three that spent most, the busiest first', () => {
  const before = [proc(10, 'node', 100), proc(20, 'chrome', 50.5), proc(30, 'Code', 7), proc(40, 'git', 1), proc(50, 'idle', 900)];
  const after = [proc(10, 'node', 101.6), proc(20, 'chrome', 53.7), proc(30, 'Code', 7.25), proc(40, 'git', 1.9), proc(50, 'idle', 900)];
  assert.deepEqual(busiestBetween(before, after), [proc(20, 'chrome', 3.2), proc(10, 'node', 1.6), proc(40, 'git', 0.9)]);
  // Fewer than three were busy: fewer are named. Nobody was: nobody is.
  assert.deepEqual(busiestBetween(before, [proc(10, 'node', 100.5), proc(20, 'chrome', 50.5)]), [proc(10, 'node', 0.5)]);
  assert.deepEqual(busiestBetween(before, before), []);
  assert.deepEqual(busiestBetween([], []), []);
});

test('busiestBetween names only a process that both readings hold under one name, and never the ones it is told to skip', () => {
  const before = [proc(10, 'node', 100), proc(20, 'chrome', 50), proc(30, 'Code', 7), proc(0, 'System Idle Process', 5000)];
  const after = [
    proc(10, 'node', 101),
    // 20 ended between the readings. 60 started between them: what it spent before the look is not known.
    proc(60, 'tsc', 44),
    // The pid of a process that ended, given to another: its time is no difference.
    proc(30, 'git', 9),
    // Pid 0 of Windows is the time nobody used.
    proc(0, 'System Idle Process', 5012),
  ];
  assert.deepEqual(busiestBetween(before, after), [proc(10, 'node', 1)]);
  // The gate itself and the helper that looks are not what loads the machine.
  const two = [proc(10, 'node', 101), proc(11, 'powershell', 2), proc(12, 'node', 3)];
  assert.deepEqual(busiestBetween([proc(10, 'node', 100), proc(11, 'powershell', 0), proc(12, 'node', 0)], two, { skip: [11, 12] }), [proc(10, 'node', 1)]);
  // Under a twentieth of a second is not said: it would print as 0.0 s. Times that went back are not either.
  assert.deepEqual(busiestBetween([proc(1, 'a', 10), proc(2, 'b', 10), proc(3, 'c', 10)], [proc(1, 'a', 10.04), proc(2, 'b', 9), proc(3, 'c', 10.05)]), [proc(3, 'c', 0.05)]);
});

/** What the helper of Windows prints, as it was recorded on 2026-10-11: a line for each process of each
 * reading (`1` or `2`, pid, milliseconds of processor time, name), then `=`, then a line for each command
 * line it was asked for. The lines end as PowerShell ends them. */
const recorded = (...lines) => `${lines.join('\r\n')}\r\n`;
const READINGS = [
  '1\t0\t5211031\tSystem Idle Process',
  '1\t4\t\tSystem',
  '1\t3064\t1562\tMemory Compression',
  '1\t12044\t100000\tnode.exe',
  '1\t9000\t20000\tchrome.exe',
  '1\t7000\t500\tCode.exe',
  '1\t7712\t281\tAggregatorHost.exe',
  '1\t5000\t40\tgit.exe',
  '2\t0\t5223031\tSystem Idle Process',
  '2\t4\t\tSystem',
  '2\t3064\t2462\tMemory Compression',
  '2\t12044\t103200\tnode.exe',
  '2\t9000\t21600\tchrome.exe',
  '2\t7000\t1000\tCode.exe',
  '2\t8800\t9000\ttsc.exe',
  '2\t5000\t40\tgit.exe',
  '=',
];
const COMMAND_LINES = [
  'c\t12044\t"C:\\Program Files\\nodejs\\node.exe" --max-old-space-size=4096 "C:\\Users\\me\\my project\\node_modules\\typescript\\lib\\tsserver.js" --stdio',
  'c\t9000\t"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --type=renderer --lang=es',
  'c\t3064\t',
];

test('parseProcessReadings reads the two readings and the command lines the helper of Windows prints', () => {
  const read = parseProcessReadings(recorded(...READINGS, ...COMMAND_LINES));
  assert.equal(read.done, true);
  // A process whose time the system does not show (System) is in neither reading. A name keeps its
  // spaces and loses the `.exe` every program has.
  assert.deepEqual(read.before, [
    proc(0, 'System Idle Process', 5211.031), proc(3064, 'Memory Compression', 1.562), proc(12044, 'node', 100), proc(9000, 'chrome', 20),
    proc(7000, 'Code', 0.5), proc(7712, 'AggregatorHost', 0.281), proc(5000, 'git', 0.04),
  ]);
  assert.deepEqual(read.after.map(({ pid }) => pid), [0, 3064, 12044, 9000, 7000, 8800, 5000]);
  assert.deepEqual([...read.commandLines.keys()], [12044, 9000, 3064]);
  assert.equal(read.commandLines.get(9000), '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --type=renderer --lang=es');
  assert.equal(read.commandLines.get(3064), '');
  // Together: AggregatorHost ended between the readings, tsc is only in the second, System has no time.
  assert.deepEqual(busiestBetween(read.before, read.after), [proc(12044, 'node', 3.2), proc(9000, 'chrome', 1.6), proc(3064, 'Memory Compression', 0.9)]);
});

test('parseProcessReadings is not done before the mark of the second reading, and takes no line it does not know', () => {
  const half = parseProcessReadings(recorded(...READINGS.slice(0, 10)));
  assert.deepEqual([half.done, half.before.length, half.after.length], [false, 7, 1]);
  // A line cut by the end of a chunk is not a process yet.
  assert.equal(parseProcessReadings('1\t12044\t100000\tnode.exe\r\n1\t9000\t200').before.length, 1);
  const garbage = parseProcessReadings('Get-CimInstance : Access denied\r\n\r\n1\tnot a pid\t5\tx\r\n1\t77\tfive\tx\r\n3\t1\t1\tx\r\n1\t12\t30\r\nc\tnine\tx\r\n');
  assert.deepEqual([garbage.done, garbage.before, garbage.after, garbage.commandLines.size], [false, [], [], 0]);
  assert.deepEqual(parseProcessReadings(''), { done: false, before: [], after: [], commandLines: new Map() });
  // A mark of byte order before the first line, and lines that end as Unix ends them.
  const unix = parseProcessReadings('\uFEFF1\t12044\t100000\tnode.exe\n2\t12044\t101000\tnode.exe\n=\nc\t12044\tnode a\tb.js\n');
  assert.deepEqual([unix.done, unix.before, unix.after], [true, [proc(12044, 'node', 100)], [proc(12044, 'node', 101)]]);
  assert.equal(unix.commandLines.get(12044), 'node a\tb.js');
});

/** A line of `/proc/<pid>/stat`: the pid, the name in parentheses, and after them the fields of which the
 * twelfth and thirteenth are the ticks spent in user and in system mode, a hundred to the second. */
const stat = (pid, comm, utime, stime) => `${pid} (${comm}) S 1 ${pid} ${pid} 0 -1 4194304 5100 0 12 0 ${utime} ${stime} 0 0 20 0 11 0 81234 1012345678 23456 18446744073709551615 1 1 0 0 0 0 0 4096 134234626 0 0 0 17 3 0 0 0 0 0\n`;

test('parseProcStat reads the pid, the name and the processor seconds of a line of /proc/<pid>/stat', () => {
  // Recorded on Linux, 2026-10-11.
  const line = '12044 (node) R 11020 12044 11020 34816 12044 4194304 51234 0 12 0 1530 220 0 0 20 0 11 0 8123456 1012345678 23456 18446744073709551615 4194304 4199205 140724000000000 0 0 0 0 4096 134234626 0 0 0 17 3 0 0 0 0 0 4210032 4210704 30000000 140724000001000 140724000001010 140724000001010 140724000002000 0\n';
  assert.deepEqual(parseProcStat(line), proc(12044, 'node', 17.5));
  // A name may hold spaces and parentheses: it ends at the last one of the line.
  assert.deepEqual(parseProcStat(stat(801, 'Web Content', 250, 50)), proc(801, 'Web Content', 3));
  assert.deepEqual(parseProcStat(stat(802, '(sd-pam)', 0, 0)), proc(802, '(sd-pam)', 0));
  assert.deepEqual(parseProcStat(stat(803, 'tmux: server) R 1 2', 100, 0)), proc(803, 'tmux: server) R 1 2', 1));
  // A name is printed, so what would move the cursor of a terminal is taken out of it.
  assert.deepEqual(parseProcStat(stat(804, 'evil\u001b[2J\nname', 100, 0)), proc(804, 'evil?[2J?name', 1));
  for (const text of ['', 'garbage', '12 (cut short) S 1 2 3', 'x (node) S 1 2 3 4 5 6 7 8 9 10 11 12 13', '12 (node) S 1 2 3 4 5 6 7 8 9 10 many 12 13']) {
    assert.equal(parseProcStat(text), null, text);
  }
});

/** A stand-in for the helper process: what `spawn` gives, with the pid 4242, a standard output a test
 * writes to and a standard input that keeps what it was sent. */
function fakeChild() {
  const child = new EventEmitter();
  child.pid = 4242;
  child.killed = 0;
  child.kill = () => {
    child.killed += 1;
  };
  child.stdout = Object.assign(new EventEmitter(), { setEncoding: () => {} });
  child.stdin = Object.assign(new EventEmitter(), {
    sent: [],
    end: (text) => {
      child.stdin.sent.push(text);
      child.emit('asked');
    },
  });
  return child;
}

/** A `spawn` that starts nothing: it keeps what it was asked to start, and lets `play` act the helper. */
function helper(play) {
  const child = fakeChild();
  const spawn = (command, args, options) => {
    spawn.asked.push({ command, args, options });
    setImmediate(() => play(child));
    return child;
  };
  spawn.asked = [];
  return { child, spawn };
}

const windowsLook = (spawn, more = {}) => busiestProcesses({ platform: 'win32', ownPid: 7000, spawn, ...more });

test('on Windows one PowerShell process takes both readings, is asked for the command lines of the three found, and they are named by program and script', async () => {
  const { child, spawn } = helper((helped) => {
    const text = recorded(...READINGS);
    // In two pieces, cut inside a line, as a pipe hands them over.
    helped.stdout.emit('data', text.slice(0, 137));
    helped.once('asked', () => {
      helped.stdout.emit('data', recorded(...COMMAND_LINES));
      helped.emit('close', 0);
    });
    helped.stdout.emit('data', text.slice(137));
  });
  assert.deepEqual(await windowsLook(spawn, { ownPid: 31337 }), [
    { name: 'node', script: 'tsserver.js', pid: 12044, cpuSeconds: 3.2 },
    { name: 'chrome', script: null, pid: 9000, cpuSeconds: 1.6 },
    { name: 'Memory Compression', script: null, pid: 3064, cpuSeconds: 0.9 },
  ]);
  assert.deepEqual(child.stdin.sent, ['12044,9000,3064\n']);
  assert.equal(child.killed, 0);

  assert.equal(spawn.asked.length, 1);
  const [{ command, args, options }] = spawn.asked;
  assert.match(command, /\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/);
  assert.deepEqual(args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
  assert.equal(args.length, 4);
  // The two readings are two seconds apart, and only the processes asked for are asked their command line.
  assert.match(args[3], new RegExp(`Start-Sleep -Milliseconds ${BUSIEST_LOOK_MS}\\b`));
  assert.match(args[3], /Win32_Process -Filter /);
  // No double quote: the script is one argument of a command line, and a quote would end it.
  assert.doesNotMatch(args[3], /"/);
  assert.equal(options.windowsHide, true);
});

test('the gate itself and the helper are not named, and a process whose command line was not given is named alone', async () => {
  const { child, spawn } = helper((helped) => {
    helped.once('asked', () => {
      helped.stdout.emit('data', recorded('c\t9000\t"C:\\tools\\chrome.exe" C:\\pages\\index.html'));
      helped.emit('close', 0);
    });
    // 7000 is this gate (`ownPid`) and 4242 the helper: both spent more than the rest.
    helped.stdout.emit('data', recorded('1\t4242\t0\tpowershell.exe', '2\t4242\t1900\tpowershell.exe', ...READINGS.map((line) => line.replace('2\t7000\t1000', '2\t7000\t9000'))));
  });
  assert.deepEqual(await windowsLook(spawn), [
    { name: 'node', script: null, pid: 12044, cpuSeconds: 3.2 },
    { name: 'chrome', script: 'index.html', pid: 9000, cpuSeconds: 1.6 },
    { name: 'Memory Compression', script: null, pid: 3064, cpuSeconds: 0.9 },
  ]);
  assert.deepEqual(child.stdin.sent, ['12044,9000,3064\n']);
});

test('a missing PowerShell, an error exit, output that is no reading and a helper that ends early each name nobody', async () => {
  const missing = helper((helped) => helped.emit('error', Object.assign(new Error('spawn powershell.exe ENOENT'), { code: 'ENOENT' })));
  assert.deepEqual(await windowsLook(missing.spawn), []);

  const threw = () => {
    throw new Error('spawn EINVAL');
  };
  assert.deepEqual(await windowsLook(threw), []);

  // An error exit names nobody, even after readings that could be read.
  const failed = helper((helped) => {
    helped.once('asked', () => helped.emit('close', 1));
    helped.stdout.emit('data', recorded(...READINGS));
  });
  assert.deepEqual(await windowsLook(failed.spawn), []);

  const garbage = helper((helped) => {
    helped.stdout.emit('data', 'Get-CimInstance : Access denied\r\n    + CategoryInfo : PermissionDenied\r\n{"not": "a reading"}\r\n');
    helped.emit('close', 0);
  });
  assert.deepEqual(await windowsLook(garbage.spawn), []);
  assert.deepEqual(garbage.child.stdin.sent, []);

  // Ended before the second reading was whole, with the exit code of a success.
  const early = helper((helped) => {
    helped.stdout.emit('data', recorded(...READINGS.slice(0, 10)));
    helped.emit('close', 0);
  });
  assert.deepEqual(await windowsLook(early.spawn), []);

  // Nobody was busy: nobody is asked for, and the helper is still told to end.
  const quiet = helper((helped) => {
    helped.once('asked', () => helped.emit('close', 0));
    helped.stdout.emit('data', recorded('1\t12044\t100000\tnode.exe', '2\t12044\t100000\tnode.exe', '='));
  });
  assert.deepEqual(await windowsLook(quiet.spawn), []);
  assert.deepEqual(quiet.child.stdin.sent, ['\n']);
});

test('a helper that does not answer within the bound is killed, and nobody is named', async () => {
  assert.equal(BUSIEST_BOUND_MS, 10_000);
  // It printed its readings and then hangs on the command lines.
  const hangs = helper((helped) => helped.stdout.emit('data', recorded(...READINGS)));
  const startedAt = Date.now();
  assert.deepEqual(await windowsLook(hangs.spawn, { boundMs: 40 }), []);
  assert.equal(hangs.child.killed, 1);
  assert.ok(Date.now() - startedAt < 2000);
  // What it says after the bound changes nothing, and it is not killed twice.
  hangs.child.stdout.emit('data', recorded(...COMMAND_LINES));
  hangs.child.emit('close', 0);
  assert.equal(hangs.child.killed, 1);

  // A helper that answers in time is not killed after it: no timer is left behind.
  const inTime = helper((helped) => {
    helped.once('asked', () => helped.emit('close', 0));
    helped.stdout.emit('data', recorded(...READINGS));
  });
  assert.equal((await windowsLook(inTime.spawn, { boundMs: 40 })).length, 3);
  await new Promise((resolve) => {
    setTimeout(resolve, 80);
  });
  assert.equal(inTime.child.killed, 0);
});

/** A stand-in for `/proc`: `files` is what it holds now, and `sleep` swaps in the next of `readings`. */
function fakeProc(...readings) {
  const fake = { files: readings[0], slept: [], read: [] };
  fake.proc = {
    list: () => [...new Set(Object.keys(fake.files).map((file) => file.split('/')[2])), 'cpuinfo', 'self', 'sys'],
    read: (file) => {
      fake.read.push(file);
      if (!(file in fake.files)) throw Object.assign(new Error(`ENOENT: no such file or directory, open '${file}'`), { code: 'ENOENT' });
      return fake.files[file];
    },
  };
  fake.sleep = async (ms) => {
    fake.slept.push(ms);
    fake.files = readings[fake.slept.length];
  };
  return fake;
}

const neverSpawned = () => {
  throw new Error('a process was started');
};
const linuxLook = (fake, more = {}) => busiestProcesses({ platform: 'linux', ownPid: 500, spawn: neverSpawned, proc: fake.proc, sleep: fake.sleep, ...more });

test('on Linux /proc is read twice, two seconds apart, with no process started, and the three busiest are named by their command lines', async () => {
  const first = {
    '/proc/1/stat': stat(1, 'systemd', 300, 100),
    '/proc/500/stat': stat(500, 'node', 1000, 0),
    '/proc/600/stat': stat(600, 'node', 2000, 500),
    '/proc/700/stat': stat(700, 'Web Content', 900, 100),
    '/proc/800/stat': stat(800, 'python3', 10, 0),
    '/proc/900/stat': stat(900, 'kworker/3:1', 50, 0),
    '/proc/950/stat': stat(950, 'cc1plus', 400, 0),
    // A process whose line cannot be read as one is in no reading.
    '/proc/960/stat': '960 (cut short) S 1\n',
  };
  const second = {
    '/proc/1/stat': stat(1, 'systemd', 300, 100),
    // This gate (`ownPid`), which spent most of all.
    '/proc/500/stat': stat(500, 'node', 1900, 0),
    '/proc/600/stat': stat(600, 'node', 2250, 570),
    '/proc/700/stat': stat(700, 'Web Content', 1000, 160),
    '/proc/800/stat': stat(800, 'python3', 70, 30),
    '/proc/900/stat': stat(900, 'kworker/3:1', 55, 0),
    // 950 ended between the readings, and 970 started between them.
    '/proc/970/stat': stat(970, 'cc1plus', 180, 0),
    '/proc/960/stat': '960 (cut short) S 1\n',
    '/proc/600/cmdline': '/usr/bin/node\0--max-old-space-size=4096\0/home/me/my project/node_modules/typescript/lib/tsserver.js\0--stdio\0',
    '/proc/700/cmdline': '/usr/lib/firefox/firefox\0-contentproc\0-childID\0',
    // 800 ended before its command line was asked for: it is named alone.
  };
  const fake = fakeProc(first, second);
  assert.deepEqual(await linuxLook(fake), [
    { name: 'node', script: 'tsserver.js', pid: 600, cpuSeconds: 3.2 },
    { name: 'Web Content', script: null, pid: 700, cpuSeconds: 1.6 },
    { name: 'python3', script: null, pid: 800, cpuSeconds: 0.9 },
  ]);
  assert.deepEqual(fake.slept, [BUSIEST_LOOK_MS]);
  // Only the three found are asked their command line, after both readings.
  assert.deepEqual(fake.read.filter((file) => file.endsWith('/cmdline')), ['/proc/600/cmdline', '/proc/700/cmdline', '/proc/800/cmdline']);
  assert.deepEqual(fake.read.slice(0, 2), ['/proc/1/stat', '/proc/500/stat']);
});

test('a /proc that cannot be listed, or holds nothing that can be read, names nobody', async () => {
  const unlisted = fakeProc({}, {});
  unlisted.proc.list = () => {
    throw Object.assign(new Error("ENOENT: no such file or directory, scandir '/proc'"), { code: 'ENOENT' });
  };
  assert.deepEqual(await linuxLook(unlisted), []);
  assert.deepEqual(await linuxLook(fakeProc({}, {})), []);
  const fails = fakeProc({ '/proc/600/stat': stat(600, 'node', 0, 0) }, { '/proc/600/stat': stat(600, 'node', 500, 0) });
  fails.sleep = async () => {
    throw new Error('the timer blew up');
  };
  assert.deepEqual(await linuxLook(fails), []);
});

test('on any other system nobody is named, and nothing is started or read', async () => {
  const fake = fakeProc({ '/proc/600/stat': stat(600, 'node', 0, 0) }, { '/proc/600/stat': stat(600, 'node', 500, 0) });
  for (const platform of ['darwin', 'freebsd', 'sunos', 'aix']) {
    assert.deepEqual(await linuxLook(fake, { platform }), [], platform);
  }
  assert.deepEqual([fake.read, fake.slept], [[], []]);
});

test('busiestLines says each of the busiest in one line: its processor seconds in the look, program, script and pid', () => {
  const busiest = [
    { name: 'node', script: 'tsserver.js', pid: 12044, cpuSeconds: 3.2 },
    { name: 'Memory Compression', script: null, pid: 3064, cpuSeconds: 0.949 },
    { name: 'chrome', script: null, pid: 9000, cpuSeconds: 12 },
  ];
  assert.deepEqual(busiestLines(busiest), [
    '3.2 s of CPU in 2 s  node tsserver.js (pid 12044)',
    '0.9 s of CPU in 2 s  Memory Compression (pid 3064)',
    '12.0 s of CPU in 2 s  chrome (pid 9000)',
  ]);
  assert.deepEqual(busiestLines([]), []);
});

// The one real look of the suite: PowerShell on Windows, `/proc` on Linux, nothing elsewhere. It passes on
// a machine at rest too, since a process of its own is busy for as long as the look lasts.
test('the real look of this machine names at most three processes, the busiest first, and never this one', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-busiest-'));
  const script = path.join(dir, 'spins for the look.mjs');
  fs.writeFileSync(script, 'const until = Date.now() + 15000;\nwhile (Date.now() < until);\n');
  const spinner = spawnChild(process.execPath, [script], { stdio: 'ignore' });
  try {
    const startedAt = Date.now();
    const busiest = await busiestProcesses();
    const took = Date.now() - startedAt;
    assert.ok(Array.isArray(busiest) && busiest.length <= 3, JSON.stringify(busiest));
    for (const { name, script: said, pid, cpuSeconds } of busiest) {
      assert.ok(typeof name === 'string' && name.length > 0, JSON.stringify(busiest));
      assert.ok(said === null || (typeof said === 'string' && !/[\\/]/.test(said)), JSON.stringify(busiest));
      assert.ok(Number.isInteger(pid) && pid !== process.pid, JSON.stringify(busiest));
      assert.ok(cpuSeconds >= 0.05, JSON.stringify(busiest));
    }
    assert.deepEqual(busiest.map(({ cpuSeconds }) => cpuSeconds), busiest.map(({ cpuSeconds }) => cpuSeconds).sort((a, b) => b - a));
    assert.ok(took < BUSIEST_BOUND_MS + 1000, `the look took ${took} ms`);
    if (!['win32', 'linux'].includes(process.platform)) {
      assert.deepEqual(busiest, []);
      return;
    }
    // A look names nobody, by design, where its helper is missing, fails or misses its bound, and a host
    // as busy as the suite keeps this one can make it miss: that is the look doing what it says, and no
    // failure of this test. Where it did name somebody, it lasted its two seconds.
    if (busiest.length === 0) return;
    assert.ok(took >= BUSIEST_LOOK_MS - 100, `the look took ${took} ms`);
    // Where the process that spins is among the three, it is named by its script and not by its folder.
    const own = busiest.find(({ pid }) => pid === spinner.pid);
    if (own) assert.equal(own.script, 'spins for the look.mjs', JSON.stringify(own));
  } finally {
    spinner.kill();
    await new Promise((resolve) => {
      spinner.once('close', resolve);
    });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

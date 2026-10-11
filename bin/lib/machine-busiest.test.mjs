import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { spawn as spawnChild } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ASKED_FILE_ENV, BUSIEST_ASK_BOUND_MS, BUSIEST_BOUND_MS, BUSIEST_LOOK_MS, busiestBetween, busiestLines, busiestProcesses, isFileOnDisk, parseProcStat, parseProcessReadings, scriptOf, splitCommandLine } from './machine-busiest.mjs';

// What loads a loaded machine: every process's CPU time read twice, the difference taken, and the three
// that spent most named by program and script. The tests of the look read recorded output through
// stand-ins: none starts PowerShell or reads `/proc`, and the disk they ask is a stand-in too. The real
// disk is asked where a test says so, by the Node process a question starts, and the last test runs the
// real look of this machine.

test('splitCommandLine splits a Windows command line at the spaces outside its double quotes', () => {
  assert.deepEqual(splitCommandLine('node --max-old-space-size=4096 C:\\x\\tsserver.js'), ['node', '--max-old-space-size=4096', 'C:\\x\\tsserver.js']);
  assert.deepEqual(splitCommandLine('"C:\\Program Files\\nodejs\\node.exe"   "D:\\my project\\run tests.mjs" --watch'), ['C:\\Program Files\\nodejs\\node.exe', 'D:\\my project\\run tests.mjs', '--watch']);
  // Quotes that open inside an argument keep its spaces, and an empty pair is an argument of its own.
  assert.deepEqual(splitCommandLine('app.exe --name="two words" "" last'), ['app.exe', '--name=two words', '', 'last']);
  assert.deepEqual(splitCommandLine(''), []);
  assert.deepEqual(splitCommandLine('   '), []);
});

/** A stand-in for the look at the disk: only `files` are files there, and what was asked is kept. */
function disk(...files) {
  const isFile = (file) => {
    isFile.asked.push(file);
    return files.includes(file);
  };
  isFile.asked = [];
  return isFile;
}

/** A disk on which whatever is asked is a file: what is not named on it is not named for its form. */
const anyFile = () => true;

test('scriptOf gives the base name of the first argument that is not an option, where that is the whole path of a file that exists', async () => {
  const windows = (line, isFile, name = 'node') => scriptOf(splitCommandLine(line), name, { windows: true, isFile });
  assert.equal(await windows('node --max-old-space-size=4096 C:\\x\\tsserver.js', disk('C:\\x\\tsserver.js')), 'tsserver.js');
  assert.equal(await windows('"C:\\Program Files\\nodejs\\node.exe" "D:\\my project\\run tests.mjs" --watch', disk('D:\\my project\\run tests.mjs')), 'run tests.mjs');
  // A drive letter with either slash. The path of a share is never asked of the disk, and so never named:
  // to ask, this machine would turn to whatever server the argument names.
  assert.equal(await windows('node D:/proj/bin/check.mjs --cwd D:/proj', disk('D:/proj/bin/check.mjs')), 'check.mjs');
  const share = disk('\\\\build\\tools\\bin\\pack.cmd');
  assert.equal(await windows('cmd.exe /c \\\\build\\tools\\bin\\pack.cmd', share, 'cmd'), null);
  assert.deepEqual(share.asked, []);
  // The first one, whatever comes after it: the disk is asked about that one alone.
  const first = disk('D:\\proj\\bin\\check.test.mjs', 'D:\\proj\\bin\\gate.test.mjs');
  assert.equal(await windows('node --test D:\\proj\\bin\\check.test.mjs D:\\proj\\bin\\gate.test.mjs', first), 'check.test.mjs');
  assert.deepEqual(first.asked, ['D:\\proj\\bin\\check.test.mjs']);
  // Options alone, or no argument at all: the name of the program is all there is to say.
  const unasked = disk();
  assert.equal(await windows('"C:\\Program Files\\Google\\Chrome\\chrome.exe" --type=renderer --lang=es', unasked, 'chrome'), null);
  assert.equal(await windows('node', unasked), null);
  assert.equal(await windows('', unasked), null);
  assert.deepEqual(unasked.asked, []);
  // A switch of Windows is an option too.
  assert.equal(await windows('cmd.exe /d /s /c C:\\work\\build.cmd', disk('C:\\work\\build.cmd'), 'cmd'), 'build.cmd');
  // The program's own name is not said twice.
  assert.equal(await windows('"C:\\nodejs\\node.exe" C:\\nodejs\\node.exe', anyFile), null);
  // Elsewhere a whole path starts with a slash, and the arguments come already split: a space is part of a name.
  assert.equal(await scriptOf(['/usr/bin/node', '/srv/app.js'], 'node', { isFile: disk('/srv/app.js') }), 'app.js');
  assert.equal(await scriptOf(['python3', '-u', '/home/me/my tools/serve files.py', '--port', '8000'], 'python3', { isFile: disk('/home/me/my tools/serve files.py') }), 'serve files.py');
});

// Found by the Codex review of the slice: `-p P@ssword.123` was said whole, since a credential with a dot
// in it is spelled as a file name is. What the spelling cannot tell, the disk can.
test('scriptOf says nothing of an argument that is not the whole path of a file that exists, however it is spelled', async () => {
  const said = (args, options) => scriptOf(['tool', ...args], 'tool', options);
  for (const isFile of [undefined, anyFile]) {
    for (const windows of [false, true]) {
      const options = { windows, ...(isFile && { isFile }) };
      // The value of an option, and a secret with no option before it.
      assert.equal(await said(['-p', 'P@ssword.123'], options), null);
      assert.equal(await said(['P@ssword.123'], options), null);
      assert.equal(await said(['-p', 'hunter2'], options), null);
      assert.equal(await said(['-H', 'Authorization: Bearer abc.def.ghi', 'https://example.com/x.json'], options), null);
      assert.equal(await said(['postgres://me:secret@db.example.com'], options), null);
      assert.equal(await said(['https://me:secret@example.com/tools/install.sh'], options), null);
      assert.equal(await said(['TOKEN=abc.def'], options), null);
      // A path from the folder the process runs in, which the look does not know.
      for (const relative of ['server.js', './server.js', '..\\app\\server.js', 'bin/check.mjs', 'C:server.js']) assert.equal(await said([relative], options), null, relative);
    }
  }
  // A whole path of the other system is none of this one, whatever the disk says.
  assert.equal(await said(['/work/app/server.js'], { windows: true, isFile: anyFile }), null);
  assert.equal(await said(['\\work\\app\\server.js'], { windows: true, isFile: anyFile }), null);
  assert.equal(await said(['\\\\build\\pack.cmd'], { windows: true, isFile: anyFile }), null);
  assert.equal(await said(['C:\\x\\tsserver.js'], { isFile: anyFile }), null);
  assert.equal(await said(['\\\\build\\tools\\pack.cmd'], { isFile: anyFile }), null);

  // A whole path that names no file: one that is missing, a folder, and a disk that cannot be asked.
  const missing = disk('/srv/other.js');
  assert.equal(await said(['/srv/app.js'], { isFile: missing }), null);
  assert.deepEqual(missing.asked, ['/srv/app.js']);
  assert.equal(await said(['C:\\x\\tsserver.js'], { windows: true, isFile: disk() }), null);
  const threw = () => {
    throw Object.assign(new Error("EACCES: permission denied, stat '/srv/app.js'"), { code: 'EACCES' });
  };
  assert.equal(await said(['/srv/app.js'], { isFile: threw }), null);
  assert.equal(await said(['C:\\x\\tsserver.js'], { windows: true, isFile: threw }), null);

  // A file that exists is still said only by a name that reads as one, of 64 characters at most.
  assert.equal(await said(['/srv/app'], { isFile: anyFile }), null);
  assert.equal(await said(['/srv/key: abc.def'], { isFile: anyFile }), null);
  assert.equal(await said([`/srv/${'a'.repeat(70)}.js`], { isFile: anyFile }), null);
  assert.equal(await said(['/srv/año nuevo.py'], { isFile: anyFile }), 'año nuevo.py');
});

test('scriptOf asks the real disk unless it is handed another: a file by its whole path is named, a missing one, a folder and the same file by a relative path are not', async () => {
  const windows = process.platform === 'win32';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-script-'));
  try {
    const file = path.join(dir, 'serves pages.mjs');
    fs.writeFileSync(file, '');
    fs.mkdirSync(path.join(dir, 'a folder.js'));
    assert.equal(await scriptOf(['node', file], 'node', { windows }), 'serves pages.mjs');
    assert.equal(await scriptOf(['node', path.join(dir, 'gone.mjs')], 'node', { windows }), null);
    assert.equal(await scriptOf(['node', path.join(dir, 'a folder.js')], 'node', { windows }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // This file, from the folder the tests run in: it exists there, and is not named.
  const relative = path.relative(process.cwd(), fileURLToPath(import.meta.url));
  // On Windows there is no relative path to another drive, and nothing to try then.
  if (path.isAbsolute(relative)) return;
  assert.equal(fs.statSync(relative).isFile(), true);
  assert.equal(await scriptOf(['node', relative], 'node', { windows }), null);
  assert.equal(await scriptOf(['node', path.resolve(relative)], 'node', { windows }), 'machine-busiest.test.mjs');
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

/** The look of Windows through a stand-in for its helper, on a disk that holds no file unless `more` hands it one. */
const windowsLook = (spawn, more = {}) => busiestProcesses({ platform: 'win32', ownPid: 7000, spawn, isFile: disk(), ...more });

test('on Windows one PowerShell process takes both readings, is asked for the command lines of the three found, and they are named by program and script', async () => {
  const answers = (helped) => {
    const text = recorded(...READINGS);
    // In two pieces, cut inside a line, as a pipe hands them over.
    helped.stdout.emit('data', text.slice(0, 137));
    helped.once('asked', () => {
      helped.stdout.emit('data', recorded(...COMMAND_LINES));
      helped.emit('close', 0);
    });
    helped.stdout.emit('data', text.slice(137));
  };
  const { child, spawn } = helper(answers);
  const isFile = disk('C:\\Users\\me\\my project\\node_modules\\typescript\\lib\\tsserver.js');
  assert.deepEqual(await windowsLook(spawn, { ownPid: 31337, isFile }), [
    { name: 'node', script: 'tsserver.js', pid: 12044, cpuSeconds: 3.2 },
    { name: 'chrome', script: null, pid: 9000, cpuSeconds: 1.6 },
    { name: 'Memory Compression', script: null, pid: 3064, cpuSeconds: 0.9 },
  ]);
  // The disk the look was handed is asked about the one argument that could be a script, and no other.
  assert.deepEqual(isFile.asked, ['C:\\Users\\me\\my project\\node_modules\\typescript\\lib\\tsserver.js']);
  assert.deepEqual(child.stdin.sent, ['12044,9000,3064\n']);
  assert.equal(child.killed, 0);
  // The same answers on a disk without that file: the program is named alone.
  assert.deepEqual((await windowsLook(helper(answers).spawn, { ownPid: 31337 })).map(({ name, script }) => [name, script]), [['node', null], ['chrome', null], ['Memory Compression', null]]);

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
  assert.deepEqual(await windowsLook(spawn, { isFile: disk('C:\\pages\\index.html') }), [
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
const linuxLook = (fake, more = {}) => busiestProcesses({ platform: 'linux', ownPid: 500, spawn: neverSpawned, proc: fake.proc, sleep: fake.sleep, isFile: disk(), ...more });

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
  const isFile = disk('/home/me/my project/node_modules/typescript/lib/tsserver.js');
  assert.deepEqual(await linuxLook(fake, { isFile }), [
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

// Found by the Codex review of the slice: the disk was asked with a call that does not return until it is
// answered, and a script on a mapped drive or a mount whose server is away keeps such a call for many
// seconds, in which the lock of the gate that looks cannot beat. So the look waits for the disk as it
// waits for its helper: for a bounded time, with the event loop free.

/** A `/proc` of programs named `node`, each `[pid, ticks, script]`: it spent `ticks` hundredths of a
 * second between the two readings, and runs `script`, given by its whole path. */
function scripted(...programs) {
  const reading = (spent) => Object.fromEntries(programs.map(([pid, ticks]) => [`/proc/${pid}/stat`, stat(pid, 'node', spent ? ticks : 0, 0)]));
  const commandLines = Object.fromEntries(programs.map(([pid, , script]) => [`/proc/${pid}/cmdline`, `/usr/bin/node\0${script}\0`]));
  return fakeProc(reading(false), { ...reading(true), ...commandLines });
}

/** A disk that never answers about `silent`, and says of any other file, a turn of the loop later, that
 * it is one. It keeps what it was asked and what it was handed to be told when the look gives up. */
function silentAbout(silent) {
  const isFile = (file, options) => {
    isFile.asked.push(file);
    isFile.handed.push(options);
    return file === silent ? new Promise(() => {}) : new Promise((resolve) => {
      setImmediate(resolve, true);
    });
  };
  isFile.asked = [];
  isFile.handed = [];
  return isFile;
}

test('a disk that does not answer costs the look a short bound and no more: that process is named without its script, the others with theirs', async () => {
  // A second for all the questions of a look, inside the ten of the look.
  assert.equal(BUSIEST_ASK_BOUND_MS, 1000);
  assert.ok(BUSIEST_ASK_BOUND_MS < BUSIEST_BOUND_MS - BUSIEST_LOOK_MS);
  const fake = scripted([600, 320, '/mnt/share/serve.js'], [700, 160, '/srv/app.js']);
  const isFile = silentAbout('/mnt/share/serve.js');
  const startedAt = Date.now();
  const busiest = await linuxLook(fake, { isFile, askBoundMs: 40 });
  const took = Date.now() - startedAt;
  assert.deepEqual(busiest, [
    { name: 'node', script: null, pid: 600, cpuSeconds: 3.2 },
    { name: 'node', script: 'app.js', pid: 700, cpuSeconds: 1.6 },
  ]);
  assert.deepEqual(isFile.asked, ['/mnt/share/serve.js', '/srv/app.js']);
  // The bound was waited for, and nothing longer than it.
  assert.ok(took >= 30 && took < 2000, `the look took ${took} ms`);
  // Whoever asks is told that the look gave up, so that a question still open can be let go.
  assert.deepEqual(isFile.handed.map((options) => options?.signal?.aborted), [true, true]);

  // The questions fit inside the bound of the whole look, whatever their own bound is.
  const late = silentAbout('/mnt/share/serve.js');
  const lateStartedAt = Date.now();
  assert.deepEqual((await linuxLook(scripted([600, 320, '/mnt/share/serve.js']), { isFile: late, boundMs: 40, askBoundMs: 60_000 })).map(({ pid, script }) => [pid, script]), [[600, null]]);
  assert.ok(Date.now() - lateStartedAt < 2000);

  // On Windows as well, where the helper has ended by the time the disk is asked.
  const { child, spawn } = helper((helped) => {
    helped.once('asked', () => {
      helped.stdout.emit('data', recorded(...COMMAND_LINES));
      helped.emit('close', 0);
    });
    helped.stdout.emit('data', recorded(...READINGS));
  });
  const tsserver = 'C:\\Users\\me\\my project\\node_modules\\typescript\\lib\\tsserver.js';
  const mapped = silentAbout(tsserver);
  const windowsStartedAt = Date.now();
  assert.deepEqual((await windowsLook(spawn, { ownPid: 31337, isFile: mapped, askBoundMs: 40 })).map(({ name, script }) => [name, script]), [['node', null], ['chrome', null], ['Memory Compression', null]]);
  assert.ok(Date.now() - windowsStartedAt < 2000);
  assert.deepEqual(mapped.asked, [tsserver]);
  assert.equal(child.killed, 0);
});

test('a disk that fails to answer, or answers anything but yes, names no script', async () => {
  const look = async (isFile) => (await linuxLook(scripted([600, 320, '/srv/app.js'], [700, 160, '/srv/other.js']), { isFile, askBoundMs: 40 })).map(({ pid, script }) => [pid, script]);
  const denied = () => Object.assign(new Error("EACCES: permission denied, stat '/srv/app.js'"), { code: 'EACCES' });
  // A question that fails later, and one that fails at once.
  assert.deepEqual(await look(() => Promise.reject(denied())), [[600, null], [700, null]]);
  assert.deepEqual(await look(() => {
    throw denied();
  }), [[600, null], [700, null]]);
  // One question that fails takes no other with it.
  assert.deepEqual(await look((file) => (file === '/srv/app.js' ? Promise.reject(denied()) : Promise.resolve(true))), [[600, null], [700, 'other.js']]);
  // Only a plain yes is one.
  for (const answer of [false, undefined, null, 'yes', 1, {}]) assert.deepEqual(await look(() => Promise.resolve(answer)), [[600, null], [700, null]], String(answer));
  assert.deepEqual(await look(() => Promise.resolve(true)), [[600, 'app.js'], [700, 'other.js']]);
});

test('while the disk is asked the event loop is free: a timer fires before the look is over', async () => {
  let fired = 0;
  const beat = setInterval(() => {
    fired += 1;
  }, 5);
  try {
    const slow = () => new Promise((resolve) => {
      setTimeout(resolve, 60, true);
    });
    const busiest = await linuxLook(scripted([600, 320, '/srv/app.js']), { isFile: slow });
    assert.deepEqual(busiest.map(({ script }) => script), ['app.js']);
    // As the lock of a gate beats: by a timer of this process, which a call that waits for the disk would hold.
    assert.ok(fired >= 1, `the timer fired ${fired} times`);
  } finally {
    clearInterval(beat);
  }
});

test('the disk is asked about the three processes that are named, and about no other of the machine', async () => {
  const fake = scripted([610, 50, '/srv/one.js'], [620, 400, '/srv/two.js'], [630, 10, '/srv/three.js'], [640, 300, '/srv/four.js'], [650, 200, '/srv/five.js']);
  const asked = [];
  const isFile = async (file) => {
    asked.push(file);
    return file !== '/srv/four.js';
  };
  assert.deepEqual((await linuxLook(fake, { isFile })).map(({ pid, script }) => [pid, script]), [[620, 'two.js'], [640, null], [650, 'five.js']]);
  assert.deepEqual(asked, ['/srv/two.js', '/srv/four.js', '/srv/five.js']);
  assert.deepEqual(fake.read.filter((file) => file.endsWith('/cmdline')), ['/proc/620/cmdline', '/proc/640/cmdline', '/proc/650/cmdline']);

  // A helper of Windows that says more command lines than it was asked for: the others are not looked at.
  const { spawn } = helper((helped) => {
    helped.once('asked', () => {
      helped.stdout.emit('data', recorded(...COMMAND_LINES, 'c\t7000\t"C:\\tools\\Code.exe" C:\\tools\\main.js', 'c\t5000\t"C:\\tools\\git.exe" C:\\tools\\hook.cmd'));
      helped.emit('close', 0);
    });
    helped.stdout.emit('data', recorded(...READINGS));
  });
  const windowsAsked = [];
  const windowsDisk = async (file) => {
    windowsAsked.push(file);
    return true;
  };
  assert.deepEqual((await windowsLook(spawn, { ownPid: 31337, isFile: windowsDisk })).map(({ name, script }) => [name, script]), [['node', 'tsserver.js'], ['chrome', null], ['Memory Compression', null]]);
  assert.deepEqual(windowsAsked, ['C:\\Users\\me\\my project\\node_modules\\typescript\\lib\\tsserver.js']);
});

test('the real disk is asked by a Node process of its own, which finds the path in its environment and says yes or no', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-ask-'));
  try {
    // A name with a space and a letter outside ASCII, which have to reach the other process whole.
    const file = path.join(dir, 'año nuevo.mjs');
    fs.writeFileSync(file, '');
    const started = [];
    const spawn = (command, args, options) => {
      started.push({ command, args, options });
      return spawnChild(command, args, options);
    };
    assert.equal(await isFileOnDisk(file, { spawn }), true);
    assert.equal(await isFileOnDisk(dir, { spawn }), false);
    assert.equal(await isFileOnDisk(path.join(dir, 'gone.mjs'), { spawn }), false);
    assert.equal(started.length, 3);
    assert.deepEqual(started.map(({ options }) => options.env[ASKED_FILE_ENV]), [file, dir, path.join(dir, 'gone.mjs')]);
    for (const { command, args, options } of started) {
      assert.equal(command, process.execPath);
      // The same command line whatever is asked: nothing of another process's command line is in it.
      assert.deepEqual(args, started[0].args);
      assert.equal(args.join(' ').includes('js-harness-ask-'), false);
      // Nothing is written to it: a process that does not read would hold whoever waits for it to.
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'ignore']);
      assert.equal(options.windowsHide, true);
      // The rest of its environment is this process's, with which it finds what Node needs to start.
      assert.equal(options.env.PATH ?? options.env.Path, process.env.PATH ?? process.env.Path);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Through a stand-in for that process: only `1` from one that ended well is a yes.
  const says = async (play) => {
    const { spawn } = helper(play);
    const is = await isFileOnDisk('/srv/app.js', { spawn });
    assert.deepEqual(spawn.asked.map(({ options }) => options.env[ASKED_FILE_ENV]), ['/srv/app.js']);
    return is;
  };
  const prints = (printed, code) => (helped) => {
    helped.stdout.emit('data', printed);
    helped.emit('close', code);
  };
  assert.equal(await says(prints('1', 0)), true);
  for (const [printed, code] of [['0', 0], ['1', 1], ['1', null], ['11', 0], ['1\n', 0], ['yes', 0]]) assert.equal(await says(prints(printed, code)), false, `${JSON.stringify(printed)} and ${code}`);
  assert.equal(await says((helped) => helped.emit('close', 0)), false);
  assert.equal(await says((helped) => helped.emit('error', Object.assign(new Error('spawn node ENOENT'), { code: 'ENOENT' }))), false);
  // A process that cannot be started is no answer either, and none is started for a look that is over.
  assert.equal(await isFileOnDisk('/srv/app.js', { spawn: neverSpawned }), false);
  let starts = 0;
  const over = new AbortController();
  over.abort();
  assert.equal(await isFileOnDisk('/srv/app.js', { signal: over.signal, spawn: () => {
    starts += 1;
    throw new Error('a process was started');
  } }), false);
  assert.equal(starts, 0);
});

test('a question that is given up is answered no at once, and the process that was asked is killed', async () => {
  // A real process that reads nothing and never answers, as one that waits for a server that is away.
  const asked = [];
  const neverAnswers = (command, args, options) => {
    const child = spawnChild(command, ['-e', 'setInterval(() => {}, 1000)'], options);
    asked.push(child);
    return child;
  };
  const asking = new AbortController();
  const answer = isFileOnDisk('/mnt/share/serve.js', { signal: asking.signal, spawn: neverAnswers });
  const [child] = asked;
  const ended = new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  let fired = 0;
  const beat = setInterval(() => {
    fired += 1;
  }, 5);
  setTimeout(() => asking.abort(), 60);
  // The timer goes on until the process is seen to end: the question let go of it, so nothing else of this
  // test would keep the event loop for the news of its end.
  try {
    assert.equal(await answer, false);
    // The question held no timer of this process while it was open.
    assert.ok(fired >= 1, `the timer fired ${fired} times`);
    assert.equal(child.killed, true);
    assert.equal(child.stdout.destroyed, true);
    // It did end: nothing is left behind where the system lets a process be killed.
    const { code } = await ended;
    assert.notEqual(code, 0);
  } finally {
    clearInterval(beat);
  }
});

test('a question that is given up keeps its process neither running nor from ending, even where the process asked will not die', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-ask-'));
  // A process of its own, which asks, gives up after 50 ms and has then nothing left to do: what ends it
  // is that nothing holds its event loop. The process it asks never answers, cannot be killed by it, and
  // lives for fifteen seconds. Nothing here ends it: this test knows it by its number alone, and by the time
  // the process that asked has ended that number may be another process's. Windows ends it with the one that
  // started it; elsewhere it sleeps out its time, holding nothing of this test.
  const script = path.join(dir, 'asks and ends.mjs');
  fs.writeFileSync(script, [
    "import { spawn } from 'node:child_process';",
    `import { isFileOnDisk } from ${JSON.stringify(new URL('./machine-busiest.mjs', import.meta.url).href)};`,
    'const stubborn = (command, args, options) => {',
    "  const child = spawn(command, ['-e', 'setTimeout(() => {}, 15000)'], options);",
    '  child.kill = () => false;',
    '  console.log(child.pid);',
    '  return child;',
    '};',
    'const asking = new AbortController();',
    "const answer = isFileOnDisk('/mnt/share/serve.js', { signal: asking.signal, spawn: stubborn });",
    'setTimeout(() => asking.abort(), 50);',
    'console.log(await answer);',
    '',
  ].join('\n'));
  const startedAt = Date.now();
  const asker = spawnChild(process.execPath, [script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let printed = '';
  let errors = '';
  asker.stdout.setEncoding('utf8').on('data', (chunk) => {
    printed += chunk;
  });
  asker.stderr.setEncoding('utf8').on('data', (chunk) => {
    errors += chunk;
  });
  const code = await new Promise((resolve) => {
    asker.once('close', resolve);
  });
  const took = Date.now() - startedAt;
  const [pid, answer] = printed.trim().split(/\r?\n/);
  try {
    assert.equal(code, 0, errors);
    assert.match(pid ?? '', /^\d+$/, printed);
    assert.equal(answer, 'false');
    // It ended, pipes and all, long before the process it had asked would have: it did not wait for it.
    // By the clock and not by whether that process still runs: Windows ends it with the one that started it.
    assert.ok(took < 10_000, `the process that asked ended after ${took} ms`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
  // Started by its whole path: a script is named only where the argument is the path of a file that exists.
  const script = path.join(dir, 'spins for the look.mjs');
  assert.equal(path.isAbsolute(script), true);
  fs.writeFileSync(script, 'const until = Date.now() + 15000;\nwhile (Date.now() < until);\n');
  const spinner = spawnChild(process.execPath, [script], { stdio: 'ignore' });
  // The real disk, with what it said of the script kept: the process that is asked has a bound of its own,
  // which a host as busy as the suite keeps this one can make it miss, as the helper can miss its own.
  let saidAFile = false;
  const isFile = async (file, options) => {
    const is = await isFileOnDisk(file, options);
    if (file === script) saidAFile = is;
    return is;
  };
  try {
    const startedAt = Date.now();
    const busiest = await busiestProcesses({ isFile });
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
    // Where the process that spins is among the three, it is named by its script and not by its folder,
    // once the disk has said in time that the script is a file, and by its program alone until then.
    const own = busiest.find(({ pid }) => pid === spinner.pid);
    if (own) assert.equal(own.script, saidAFile ? 'spins for the look.mjs' : null, JSON.stringify(own));
  } finally {
    spinner.kill();
    await new Promise((resolve) => {
      spinner.once('close', resolve);
    });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

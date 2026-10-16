// What loads a loaded machine: the three processes that spent most processor time during a look of two
// seconds, each by its program, its script and its pid. A gate that starts on a loaded machine names them
// under the figure of its load (`./machine-load.mjs`), so that no session needs a script of its own to
// find the video in a browser or the language server that makes its gate slow.
// See odd/tasks/gate-log.md ("S1 · The load a gate starts under"). The same readings, taken once at a
// gate's start and once at its end, keep who spent the processor over its whole run (`watchBusiest`, and
// odd/tasks/gate-wait.md, T19).
//
// Every process's processor time is read twice and the difference taken. On Linux from `/proc`, by Node
// alone. On Windows by one PowerShell process, which prints both readings, is then told on its standard
// input which processes were found, and prints the command lines of those alone. The readings come from
// `Win32_Process` and not from `Get-Process`: on this machine at eight of eight logical processors busy,
// which is when a gate looks, `Get-Process` took 18 s for the look and `Win32_Process` 4.4 s (2026-10-11),
// and it also shows the time of the processes `Get-Process` shows only to an administrator. On any other
// system nobody is named.
//
// Two limits are known. A process that started during the look is not counted, so a load made of many
// short processes, which is what a test run is, names few of them: the look finds what stays busy. And
// the look costs processor time of its own, which Windows books to the services that answer it
// (`WmiPrvSE`, a `svchost`): on a machine that is barely loaded they can be among the three.
//
// Never a whole command line: it can hold a secret, and what is found here is printed and logged. Of a
// command line only one thing is ever said, the base name of a file that exists on this machine: the
// first argument that is not an option, where it is the whole path of such a file (`scriptOf`). A secret
// cannot be told from a file name by its spelling, and it is no file on the disk. So a script given by a
// path relative to its process's folder is not named, and that process reads by its program alone.
//
// Whether a path names a file is asked of the disk, and a disk can be a server that is away: a mapped
// drive of Windows, a mount of Linux, a link into either, none of which the spelling of a path shows. A
// call to the file system made by this process is then kept for as long as the server is silent. One that
// does not return holds the event loop, on which the lock of the gate that looks beats: after a minute
// without a beat another gate takes the lock, and two run at once. One that leaves the loop free
// (`fs.promises`) keeps a thread of Node's pool instead, and Node waits for that thread before the process
// may end, in `process.exit` as well: measured 2026-10-11 on Node 24.15 with a read of a pipe nobody wrote
// to, the process ended when the pipe did, five seconds after its `exit` event. So each question is asked
// by a process of its own (`isFileOnDisk`), which can be killed and left behind, and the look waits one
// second at most for all its questions together (`BUSIEST_ASK_BOUND_MS`): a script whose disk has not
// answered by then is not named.
//
// Best effort throughout. A helper that is missing, fails, prints what cannot be read or does not answer
// within ten seconds names nobody, and so does a `/proc` that cannot be read. A question to the disk that
// fails, or is not answered in its time, names the process without a script. `busiestProcesses` never
// rejects, because nothing a gate proves depends on it.
import fs from 'node:fs';
import path from 'node:path';
import { spawn as spawnChild } from 'node:child_process';

/** How far apart the two readings are. Long enough to tell a process that is busy from one that only
 * started, and short beside what a loaded machine costs a gate. */
export const BUSIEST_LOOK_MS = 2000;

/** How long the helper of Windows may take for the whole look before it is killed: on a loaded machine
 * PowerShell alone can take seconds to start. */
export const BUSIEST_BOUND_MS = 10_000;

/** How long the disk may take to say which scripts are files, for all the questions of one look together,
 * and within `BUSIEST_BOUND_MS` as the rest of the look. A question costs what a Node process costs to
 * start: on this machine 0.3 s with eight of eight logical processors busy, and 0.4 s for three at once
 * (2026-10-11). A server that is away takes many seconds to say so, and no gate waits that long for a name. */
export const BUSIEST_ASK_BOUND_MS = 1000;

// How many processes are named, and from how much processor time on: less would print as `0.0 s`.
const NAMED = 3;
const SAID_FROM_SECONDS = 0.05;

// The ticks of `/proc/<pid>/stat` to the second (USER_HZ). The kernel reports them at a hundred on every
// architecture Node runs on, whatever its own timer does, and Node cannot ask (`sysconf`) without a process.
const TICKS_PER_SECOND = 100;

/** A Windows command line as its arguments: split at the white space outside its double quotes, which are
 * taken off. A backslash before a quote is not read as an escape: what is looked for here is the path of
 * a file, and `scriptOf` says no argument that is not one the disk holds. */
export function splitCommandLine(line) {
  const args = [];
  let argument = null;
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      argument ??= '';
    } else if (!quoted && /\s/.test(char)) {
      if (argument !== null) args.push(argument);
      argument = null;
    } else {
      argument = (argument ?? '') + char;
    }
  }
  if (argument !== null) args.push(argument);
  return args;
}

// What a file name is spelled like: letters, digits, spaces and the marks a file name usually has, with an
// extension at its end. It keeps an odd name out of a report and is no guard against a secret: a password
// with a dot in it is spelled the same.
const FILE_NAME = /^[\p{L}\p{N}_][\p{L}\p{N}_ .+@-]*\.[A-Za-z0-9]{1,8}$/u;

// A whole path, which names one file wherever the process runs: on Windows from a drive letter, elsewhere
// from the root. Not the path of a share (`\\server\share\`): to ask about it, this machine would open a
// connection to whatever server an argument of another process names, and offer it the user's sign-in. A
// script on a share is not named. A mapped drive is spelled as a disk of the machine and is asked about,
// which is why the question has to be one a silent server cannot hold (`isFileOnDisk`).
const WINDOWS_WHOLE_PATH = /^[A-Za-z]:[\\/]/;
const isWholePath = (argument, windows) => (windows ? WINDOWS_WHOLE_PATH.test(argument) : argument.startsWith('/'));

/** The variable in which the process that is asked finds the path. In its environment and not in its
 * command line, so that nothing of another process's command line is put into a new one, which any process
 * of the machine may read. And not by its standard input: on Windows the end of what was written to a pipe
 * waits until the other side has read it, so a process that hangs before it reads, and does not die, holds
 * the one that wrote (measured 2026-10-11: that one ended eight seconds late, with the one it had asked). */
export const ASKED_FILE_ENV = 'JS_HARNESS_ASKED_FILE';

// What the process that is asked runs: it prints `1` where the disk holds a file at that path, `0` where it
// holds none or cannot be asked. The call that does not return until the disk answers is made there, where
// it holds that process and nothing of a gate. In single quotes, being one argument of a command line.
const ASK_SCRIPT = `let is = false; try { is = require('node:fs').statSync(process.env.${ASKED_FILE_ENV}).isFile() } catch {} process.stdout.write(is ? '1' : '0')`;

/** Whether `file` is a file on this machine's disk, asked by a Node process of its own (see the head of
 * this file for why not by this one): resolves to `true` or `false` and never rejects. `false` as well
 * where that process cannot be started, fails or prints anything else.
 *
 * When `signal` aborts the question is given up and answered `false`: the process is killed and let go of
 * with its pipe, so that one that is slow to die, as one that waits for a server may be, keeps neither the
 * event loop nor the end of this process. Without a `signal` the answer is waited for, however long it
 * takes. `spawn` stands in for the system in a test. */
export function isFileOnDisk(file, { signal, spawn = spawnChild } = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    let child;
    try {
      child = spawn(process.execPath, ['-e', ASK_SCRIPT], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, [ASKED_FILE_ENV]: file } });
    } catch {
      resolve(false);
      return;
    }
    let printed = '';
    const giveUp = () => {
      child.kill();
      child.stdout.destroy();
      child.unref();
      resolve(false);
    };
    const answer = (isFile) => {
      signal?.removeEventListener('abort', giveUp);
      resolve(isFile);
    };
    signal?.addEventListener('abort', giveUp, { once: true });
    child.on('error', () => answer(false));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      printed += chunk;
    });
    child.on('close', (code) => answer(code === 0 && printed === '1'));
  });
}

/** The script a process runs, from its arguments (`args[0]` is the program): resolves to the base name of
 * the first one that is not an option, so that a language server reads `node tsserver.js` and not `node`.
 * An option starts with `-`, and with `windows` a switch such as `/c` is one too. `null` where there is none.
 *
 * That argument may be the value of an option (`-p <password>`) or a secret given bare, and no spelling
 * tells a secret from a file name. So it is said only when it names a file that exists: it is a whole path
 * (`isWholePath`), and the disk holds a file there. Nothing after it is tried. The price: an argument
 * relative to the folder the process runs in is never named, since the look does not know that folder, so
 * `node server.js` reads `node`.
 *
 * A file is said by a base name of 64 characters at most that is spelled as one (`FILE_NAME`), and the
 * program's own name is not said twice. The disk is asked last, and so only where its answer decides:
 * `isFile(file, { signal })`, which answers now or later. Only a plain `true` is a yes, and a disk that
 * cannot be asked holds no file. Nothing here bounds the wait for the answer: `busiestProcesses` does,
 * and tells through `signal` when it has given up. `isFile` stands in for the disk in a test. */
export async function scriptOf(args, name, { windows = false, isFile = isFileOnDisk, signal } = {}) {
  const isOption = (argument) => argument.startsWith('-') || (windows && /^\/[^\\/]*$/.test(argument));
  const first = args.slice(1).find((argument) => argument !== '' && !isOption(argument));
  if (first === undefined || !isWholePath(first, windows)) return null;
  const base = first.split(/[\\/]/).pop();
  if (base.length > 64 || !FILE_NAME.test(base)) return null;
  if (base.toLowerCase().replace(/\.exe$/, '') === name.toLowerCase()) return null;
  try {
    return (await isFile(first, { signal })) === true ? base : null;
  } catch {
    return null;
  }
}

/** How many processes a gate keeps of its whole run (`busiestOverRun`): more than the look names, since a
 * run of minutes has room for a service and an antivirus beside the browser and the language server, and
 * the log of a run is read later, when nobody can look again. */
export const BUSIEST_OVER_RUN = 5;

/** The processes that spent most processor time between two readings, the busiest first, `count` at most
 * (three, as many as the look names, where none is given): `[{ pid, name, cpuSeconds }]`, where
 * `cpuSeconds` is what the process spent between them. A reading is a list of `{ pid, name, cpuSeconds }`
 * with the time spent so far.
 *
 * Only a process that both readings hold under one name is counted: one that started between them spent
 * an unknown part of its time before the look, and a pid under another name is another process. Pid 0 is
 * never one, being on Windows the time nobody used, nor are the pids of `skip`. */
export function busiestBetween(before, after, { skip = [], count = NAMED } = {}) {
  const earlier = new Map(before.map((process) => [process.pid, process]));
  return after
    .filter(({ pid, name }) => pid !== 0 && !skip.includes(pid) && earlier.get(pid)?.name === name)
    .map(({ pid, name, cpuSeconds }) => ({ pid, name, cpuSeconds: Math.round((cpuSeconds - earlier.get(pid).cpuSeconds) * 1000) / 1000 }))
    .filter(({ cpuSeconds }) => cpuSeconds >= SAID_FROM_SECONDS)
    .sort((one, other) => other.cpuSeconds - one.cpuSeconds)
    .slice(0, count);
}

// A name is printed in a report and written to a log: what would move a terminal's cursor is taken out.
const printable = (name) => name.replace(/[\u0000-\u001f\u007f]/g, '?');

/** The busiest as a gate names them: `[{ name, script, pid, cpuSeconds }]`. Each of `found` comes with
 * `args`, its command line in arguments, or nothing where the system did not show it: that process is
 * named by its program alone. Only these are asked about, so the disk gets three questions at most.
 *
 * The questions are asked at once and waited for together, for `boundMs`: a process whose question is
 * still open then is named without a script, and the others keep theirs. Whoever asks is told, on the way
 * out, that nobody waits any more (`signal`), which is when `isFileOnDisk` kills what it started. */
async function named(found, { windows, isFile, boundMs }) {
  const asking = new AbortController();
  let timer;
  const bound = new Promise((resolve) => {
    timer = setTimeout(resolve, boundMs, null);
  });
  try {
    return await Promise.all(found.map(async ({ pid, name, cpuSeconds, args }) => {
      const script = args ? await Promise.race([scriptOf(args, name, { windows, isFile, signal: asking.signal }), bound]) : null;
      return { name, script, pid, cpuSeconds };
    }));
  } finally {
    clearTimeout(timer);
    asking.abort();
  }
}

// --- Linux: /proc, read by Node ---

/** The process of one line of `/proc/<pid>/stat`: `{ pid, name, cpuSeconds }`, the time being what it
 * spent in user and in system mode so far. `null` for a line that cannot be read as one. The name is the
 * kernel's (`comm`, fifteen characters at most), which stands in parentheses and may hold spaces and
 * parentheses of its own, so it ends at the last one of the line. */
export function parseProcStat(text) {
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  if (open === -1 || close < open) return null;
  const pid = Number(text.slice(0, open));
  // After the name: the state, then the fields from the fourth on. The fourteenth and fifteenth are the times.
  const fields = text.slice(close + 1).trim().split(/\s+/);
  const ticks = Number(fields[11]) + Number(fields[12]);
  if (!Number.isInteger(pid) || text.slice(0, open).trim() === '' || !Number.isFinite(ticks)) return null;
  return { pid, name: printable(text.slice(open + 1, close)), cpuSeconds: ticks / TICKS_PER_SECOND };
}

const PROC = {
  list: () => fs.readdirSync('/proc'),
  read: (file) => fs.readFileSync(file, 'utf8'),
};

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

// A process that ended since the folder was listed, or whose file may not be read, is in no reading.
const readProc = (proc, file) => {
  try {
    return proc.read(file);
  } catch {
    return null;
  }
};

/** One reading of every process `/proc` shows, taken now. A folder that cannot be listed throws. */
const procReading = (proc) => proc.list().filter((entry) => /^\d+$/.test(entry)).flatMap((pid) => {
  const text = readProc(proc, `/proc/${pid}/stat`);
  return (text === null ? null : parseProcStat(text)) ?? [];
});

/** `found` with the arguments of each, as `/proc` shows them now. They end in a zero byte each. A program
 * that rewrote its title has one, and so no script. */
const withProcArgs = (proc, found) => found.map((process) => {
  const commandLine = readProc(proc, `/proc/${process.pid}/cmdline`);
  return { ...process, args: commandLine === null ? null : commandLine.split('\0') };
});

async function lookLinux({ ms, ownPid, proc, sleep }) {
  const before = procReading(proc);
  await sleep(ms);
  return withProcArgs(proc, busiestBetween(before, procReading(proc), { skip: [ownPid] }));
}

// --- Windows: one PowerShell process ---

/** What the helper of Windows has printed so far, read: `{ before, after, done, commandLines }`. It prints
 * a line for each process of each reading, `1` or `2`, the pid, the milliseconds of processor time and
 * the name, with tabs between them; then `=` alone, after which the second reading is whole (`done`);
 * then, for each process it was asked about, `c`, the pid and the command line. `before` and `after` are
 * readings as `busiestBetween` takes them, and `commandLines` a map from pid to command line.
 *
 * A process whose time the system does not show has none in its line and is in no reading. A name loses
 * the `.exe` every program has. A line that is none of these is skipped, and so is the last one while it
 * has no end: the text comes in pieces. */
export function parseProcessReadings(text) {
  const read = { before: [], after: [], done: false, commandLines: new Map() };
  const lines = text.replace(/^\uFEFF/, '').split('\n').slice(0, -1);
  for (const line of lines) {
    const [mark, pidText, ...rest] = line.replace(/\r$/, '').split('\t');
    const pid = /^\d+$/.test(pidText ?? '') ? Number(pidText) : null;
    if (mark === '=' && pidText === undefined) read.done = true;
    else if (pid === null) continue;
    else if (mark === 'c') read.commandLines.set(pid, rest.join('\t'));
    else if (mark === '1' || mark === '2') {
      const [ms, ...name] = rest;
      if (!/^\d+$/.test(ms ?? '') || name.join('') === '') continue;
      (mark === '1' ? read.before : read.after).push({ pid, name: printable(name.join('\t').replace(/\.exe$/i, '')), cpuSeconds: Number(ms) / 1000 });
    }
  }
  return read;
}

// The pieces of the scripts the helper runs. In single quotes throughout: a script is one argument of a
// command line, in which a double quote would end it. `Win32_Process` counts the times in tenths of a
// microsecond. What fails in a script fails silently, and its lines are then missing.
const PRELUDE = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  "function Reading($mark) { foreach ($p in Get-CimInstance -Query 'SELECT ProcessId, Name, KernelModeTime, UserModeTime FROM Win32_Process') { "
    + "$ms = ''; if ($null -ne $p.UserModeTime) { $ms = [long](($p.KernelModeTime + $p.UserModeTime) / 10000) }; "
    + '[Console]::Out.WriteLine($mark + [char]9 + $p.ProcessId + [char]9 + $ms + [char]9 + $p.Name) } }',
];
// After the last reading: the mark that it is whole, then the command lines of the pids it is told.
const ASKED_COMMAND_LINES = [
  "[Console]::Out.WriteLine('=')",
  // The pids it is told, and nothing else of that line, go into the filter.
  "$ids = @([Console]::In.ReadLine() -split ',' | Where-Object { $_ -match '^[0-9]+$' })",
  "if ($ids.Count -gt 0) { $filter = ($ids | ForEach-Object { 'ProcessId=' + $_ }) -join ' OR '; "
    + 'foreach ($c in Get-CimInstance Win32_Process -Filter $filter) { '
    + "[Console]::Out.WriteLine('c' + [char]9 + $c.ProcessId + [char]9 + $c.CommandLine) } }",
];

/** The script of the look, with the two readings `ms` apart. */
const lookScript = (ms) => [...PRELUDE, "Reading '1'", `Start-Sleep -Milliseconds ${ms}`, "Reading '2'", ...ASKED_COMMAND_LINES].join('; ');

/** The script of one reading, taken now. It is marked `2`, the mark of the second reading of the look, so
 * that what it prints is read as the look's is and lands in `after`, the reading that comes once `=` says
 * it is whole. */
const READING_SCRIPT = [...PRELUDE, "Reading '2'", ...ASKED_COMMAND_LINES].join('; ');

/** The PowerShell every Windows has, by its whole path: a bare name would be looked for in the folder the
 * gate runs in first, which is a project's. */
const powershell = (env) => path.win32.join(env.SystemRoot ?? env.SYSTEMROOT ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

/** Runs `script` in one PowerShell process: resolves to `{ read, found }`, or `null` wherever it fails
 * (see the head of this file). `read` is what it printed (`parseProcessReadings`), and `found` what `pick`
 * chose of it once its last reading was whole, each with `args`, its command line in arguments, or `null`
 * where the system did not show it. `pick(read, helperPid)` is handed the pid of the helper, which is in
 * its own readings: it is busy with them, and never what a gate is told about. The helper is told the pids
 * of `found` alone, and prints their command lines; none other is ever asked for. */
function askHelper({ script, boundMs, spawn, env, pick }) {
  return new Promise((resolve) => {
    let child;
    let timer;
    let text = '';
    // What `pick` chose, once the last reading is whole.
    let found = null;
    const finish = (answer) => {
      clearTimeout(timer);
      resolve(answer);
    };
    try {
      // `-NonInteractive` and no profile: nothing of the user's runs, and nothing is ever asked.
      child = spawn(powershell(env), ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch {
      resolve(null);
      return;
    }
    timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, boundMs);
    child.on('error', () => finish(null));
    // A helper that ended early has closed its end of the pipe: what is written to it then is lost, not thrown.
    child.stdin.on('error', () => {});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      text += chunk;
      if (found !== null) return;
      const read = parseProcessReadings(text);
      if (!read.done) return;
      found = pick(read, child.pid);
      child.stdin.end(`${found.map(({ pid }) => pid).join(',')}\n`);
    });
    child.on('close', (code) => {
      if (code !== 0 || found === null) {
        finish(null);
        return;
      }
      const read = parseProcessReadings(text);
      finish({ read, found: found.map((process) => ({ ...process, args: read.commandLines.has(process.pid) ? splitCommandLine(read.commandLines.get(process.pid)) : null })) });
    });
  });
}

async function lookWindows({ ms, boundMs, ownPid, spawn, env }) {
  // The helper itself is busy with the look, and this gate is not what the gate is told about.
  const answer = await askHelper({ script: lookScript(ms), boundMs, spawn, env, pick: (read, helperPid) => busiestBetween(read.before, read.after, { skip: [ownPid, helperPid] }) });
  return answer?.found ?? [];
}

// The look of each system resolves to the busiest as `busiestBetween` gives them, each with `args`: its
// command line in arguments, or `null` where the system did not show it. Neither asks the disk: `named` does.
const LOOKS = { linux: lookLinux, win32: lookWindows };

/** The three processes that load this machine most, the busiest first: resolves to
 * `[{ name, script, pid, cpuSeconds }]`, `cpuSeconds` being the processor time spent during the look,
 * which can be more than the look is long for a program of several threads, and `script` what `scriptOf`
 * says of the command line, or `null`. This process (`ownPid`) is never one of them: a gate asks before
 * its sensors start, so nothing else of the gate is running yet.
 *
 * Asynchronous throughout, so the lock of the gate that looks goes on beating: the wait is a timer, and
 * the helper of Windows and each question to the disk a process of its own. It takes the two seconds of
 * the look, what the helper needs to start, and what the disk needs to answer about the three at most that
 * are named: `askBoundMs` at the longest and never more than is left of `boundMs`, after which the look is
 * over at the latest. It resolves to an empty list on a system that is neither Linux nor Windows, and
 * wherever the look fails (see the head of this file).
 *
 * `platform`, `spawn`, `proc` (`list` and `read` of `/proc`), `sleep`, `env` and `isFile` (the disk
 * `scriptOf` asks) stand in for the system in a test. */
export async function busiestProcesses({ platform = process.platform, ms = BUSIEST_LOOK_MS, boundMs = BUSIEST_BOUND_MS, askBoundMs = BUSIEST_ASK_BOUND_MS, ownPid = process.pid, spawn = spawnChild, proc = PROC, sleep = wait, env = process.env, isFile = isFileOnDisk } = {}) {
  const startedAt = Date.now();
  try {
    const found = (await LOOKS[platform]?.({ ms, boundMs, ownPid, spawn, proc, sleep, env })) ?? [];
    const left = startedAt + boundMs - Date.now();
    return await named(found, { windows: platform === 'win32', isFile, boundMs: Math.max(0, Math.min(askBoundMs, left)) });
  } catch {
    return [];
  }
}

// --- Over a gate's whole run: one reading at its start, one at its end ---
//
// The look above sees two seconds before a gate. What slows a run of minutes can start after them: on
// 2026-10-13 the check went from some 520 s to 700-1100 s, the gate log's figure of the load said the
// machine was busy and not who made it so, and what told was who spent the processor over the run (a
// Windows service, `PcaSvc`, at a whole core, and the antivirus, `MsMpEng`). So a gate reads every
// process's processor time when it starts (`processTimes`), again when it ends, and keeps the heaviest that
// lived through the run (`busiestOverRun`); `watchBusiest` is the two together, as a gate uses them. Each
// reading is the look's, taken once, by the same helper and with the same rules: nothing of a command line
// is said but the base name of a script the disk holds, and wherever a reading fails nobody is named.
//
// The same limit as the look's, at the scale of a run: a process that started during the run is not
// counted, so a load of short processes (a suite's tests, a compiler run per file) is not seen, and what is
// kept is what stayed busy all along. That is what a gate cannot tell from its own figures, which is why it
// is kept.

/** One reading of every process's processor time, taken now: resolves to `[{ pid, name, cpuSeconds }]`,
 * `cpuSeconds` being what each process spent since it started. On Linux from `/proc`, at once and with no
 * process started. On Windows by one PowerShell process, which takes the reading, is told to ask for no
 * command line, and ends: some seconds on a loaded machine, `boundMs` at the most. Resolves to an empty
 * list on any other system and wherever the reading fails; it never rejects.
 *
 * `platform`, `spawn`, `proc` and `env` stand in for the system in a test, as for `busiestProcesses`. */
export async function processTimes({ platform = process.platform, boundMs = BUSIEST_BOUND_MS, spawn = spawnChild, proc = PROC, env = process.env } = {}) {
  try {
    if (platform === 'linux') return procReading(proc);
    if (platform === 'win32') return (await askHelper({ script: READING_SCRIPT, boundMs, spawn, env, pick: () => [] }))?.read.after ?? [];
    return [];
  } catch {
    return [];
  }
}

// The end of a run on each system: the reading taken now, the heaviest since `start` as `busiestBetween`
// gives them, each with `args` as the look's are. On Windows the one helper takes the reading and prints
// the command lines of those it kept, and of no other process.
const ENDS = {
  linux: ({ start, count, ownPid, proc }) => withProcArgs(proc, busiestBetween(start, procReading(proc), { skip: [ownPid], count })),
  win32: async ({ start, count, boundMs, ownPid, spawn, env }) => (await askHelper({ script: READING_SCRIPT, boundMs, spawn, env, pick: (read, helperPid) => busiestBetween(start, read.after, { skip: [ownPid, helperPid], count }) }))?.found ?? [],
};

/** The processes that spent most processor time since `start`, a reading (`processTimes`) taken when a
 * run began, the heaviest first, `count` at most: resolves to `[{ name, script, pid, cpuSeconds }]` as
 * `busiestProcesses` names them, `cpuSeconds` being what each spent over the run. The end reading is taken
 * now. Only a process that both readings hold under one name is kept (`busiestBetween`): one that started
 * during the run, one that ended during it and a pid that another process took meanwhile are not. This
 * process (`ownPid`) is never one: it is the gate, which is told who ran beside it.
 *
 * The scripts are asked of the disk as the look asks them (`named`), for the kept alone, within
 * `askBoundMs` and what is left of `boundMs`. A start that holds nothing is a reading that failed, and
 * then nothing is read at the end. Resolves to an empty list wherever a reading fails; it never rejects.
 * The options stand in for the system in a test, as for `busiestProcesses`. */
export async function busiestOverRun(start, { count = BUSIEST_OVER_RUN, platform = process.platform, boundMs = BUSIEST_BOUND_MS, askBoundMs = BUSIEST_ASK_BOUND_MS, ownPid = process.pid, spawn = spawnChild, proc = PROC, env = process.env, isFile = isFileOnDisk } = {}) {
  const startedAt = Date.now();
  try {
    if (!Array.isArray(start) || start.length === 0) return [];
    const found = (await ENDS[platform]?.({ start, count, boundMs, ownPid, spawn, proc, env })) ?? [];
    const left = startedAt + boundMs - Date.now();
    return await named(found, { windows: platform === 'win32', isFile, boundMs: Math.max(0, Math.min(askBoundMs, left)) });
  } catch {
    return [];
  }
}

/** The watch of one run, as a gate keeps it: the first reading is taken as this is called, without being
 * waited for, so that a gate's sensors start when they would have; `end()` resolves, once the run is over,
 * to `{ seconds, busiest }`: the seconds since this was called, by `now`, and the heaviest that lived
 * through the run (`busiestOverRun`), five at most. `end` waits for a first reading still under way, and
 * never rejects. The options are those of `processTimes` and `busiestOverRun`, with `now` for the clock. */
export function watchBusiest({ now = Date.now, ...options } = {}) {
  const begun = now();
  const start = processTimes(options);
  return {
    async end() {
      const seconds = Math.round((now() - begun) / 100) / 10;
      return { seconds, busiest: await busiestOverRun(await start, options) };
    },
  };
}

/** Each of `busiest` in one line, for a report: `3.2 s of CPU in 2 s  node tsserver.js (pid 12044)`.
 * The two seconds are the look's and not the sample's of the load, so the line says them. */
export function busiestLines(busiest, lookMs = BUSIEST_LOOK_MS) {
  return busiest.map(({ name, script, pid, cpuSeconds }) => `${cpuSeconds.toFixed(1)} s of CPU in ${lookMs / 1000} s  ${name}${script ? ` ${script}` : ''} (pid ${pid})`);
}

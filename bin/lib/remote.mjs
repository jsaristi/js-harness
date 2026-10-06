// Keeps Claude Code's `claude remote-control` server alive for one project, so the phone can open a new session
// that runs on this machine. Zero deps, plain Node; `js-harness remote start` runs `supervise` in a detached process.
//
// Three facts measured by hand on 2026-10-03 shape it. The server must run in a plain environment: started from a
// desktop session it inherits that session's `CLAUDE_CODE_*` variables and `ANTHROPIC_BASE_URL`, and the phone
// does not see its sessions (`cleanServerEnv`, which keeps the ones the user set persistently, read from the
// registry by `readPersistentEnv`). The server exits after about ten minutes offline, so it is
// restarted, with a capped backoff so a server that cannot run is not restarted in a tight loop (`nextDelay`).
// And it is stopped as a tree, by pid and creation time, through `process-tree.mjs`: a bare-pid kill closed
// unrelated programs on this machine. A fourth came from the first days of use: the server repaints its status
// about once a second into the log, for as long as it runs, so the log is trimmed in place (`trimLog`).
//
// Everything that starts or times a process takes it as a parameter, so the tests run a fake server.
// `loginLauncher` is the text of the batch file `remote start --at-login` leaves in the Startup folder, and
// `watchdogTask` and `watchdogTaskXml` are the scheduled task it registers beside it, which runs the same command.
import { spawn as spawnChild, spawnSync as spawnChildSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { quoteWindowsArg, windowsCommandLine } from '../codex-review.mjs';
import { killTree } from './process-tree.mjs';

/** Whether a variable of that name may be one a Claude session injected into what it starts. */
const tiesToSession = (name) => /^claude/i.test(name) || /^anthropic_base_url$/i.test(name);

/** `env` without what ties a process to the session that started it: every variable whose name starts with
 * `CLAUDE` (any case: `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, ...) and `ANTHROPIC_BASE_URL`, except those the user
 * set persistently (a config directory, the Git Bash path Claude Code needs on Windows), which no session
 * injected. `readPersistent()` says which those are (`readPersistentEnv`; none by default, so every one is
 * removed): such a name keeps the persistent value when that is known, since the session may have overwritten
 * the inherited one, and the inherited value otherwise. A reader that throws removes them all, after one
 * `warn(text)`; with nothing to remove it is not called. A new object. */
export function cleanServerEnv(env, { readPersistent = () => new Map(), warn = () => {} } = {}) {
  const entries = Object.entries(env);
  let persistent = new Map();
  if (entries.some(([name]) => tiesToSession(name))) {
    try {
      persistent = readPersistent();
    } catch (err) {
      warn(`could not read the persistent environment from the registry (${err.message}): every CLAUDE* variable and ANTHROPIC_BASE_URL is removed from the server's environment, including any set on purpose`);
    }
  }
  return Object.fromEntries(entries.flatMap(([name, value]) => {
    if (!tiesToSession(name)) return [[name, value]];
    const key = name.toUpperCase(); // Windows does not tell `Path` from `PATH`
    return persistent.has(key) ? [[name, persistent.get(key) ?? value]] : [];
  }));
}

/** Where Windows keeps the variables set to stay. The machine's key is read first, so the user's overwrite its
 * values here as they do in the environment of a process. */
const PERSISTENT_ENV_KEYS = ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', 'HKCU\\Environment'];

/** The variables set persistently on this machine, from the registry environment of the machine and of the
 * user: a `Map` from the name in capitals to its value, or to `undefined` when only its being set can be
 * trusted. That is an expandable string (`REG_EXPAND_SZ`: the registry holds `%USERPROFILE%\...`, not the value
 * a process gets) and a value beyond ASCII, which `reg.exe` writes in a code page this cannot know. Empty off
 * Windows, where nothing is run. Throws when either key cannot be read: half an answer would remove what the
 * user set. `reg.exe` is run by its full path, never one found in the working directory. */
export function readPersistentEnv({ platform = process.platform, env = process.env, spawnSync: sync = spawnChildSync } = {}) {
  const persistent = new Map();
  if (platform !== 'win32') return persistent;
  const reg = path.win32.join(env.SystemRoot ?? env.windir ?? 'C:\\Windows', 'System32', 'reg.exe');
  for (const key of PERSISTENT_ENV_KEYS) {
    const result = sync(reg, ['query', key], { encoding: 'latin1', windowsHide: true, timeout: 15000 });
    if (result.error) throw new Error(`reg query ${key} could not run: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`reg query ${key} failed (exit ${result.status}): ${String(result.stderr).trim()}`);
    for (const line of String(result.stdout).split(/\r?\n/)) {
      const match = /^ {4}(.+?) {4}(REG_SZ|REG_EXPAND_SZ)(?: {4}(.*))?$/.exec(line);
      if (!match) continue;
      const value = match[3] ?? '';
      persistent.set(match[1].toUpperCase(), match[2] === 'REG_SZ' && /^[\x20-\x7e]*$/.test(value) ? value : undefined);
    }
  }
  return persistent;
}

export const SPAWN_MODES =['same-dir', 'worktree', 'session'];

/** The arguments of `claude remote-control`: named `name`, sessions started in `spawnMode` (the project folder by
 * default), and `--permission-mode` only when one is given, so the user's own mode applies otherwise. */
export function serverArgs({ name, spawnMode = 'same-dir', permissionMode } = {}) {
  if (typeof name !== 'string' || name.trim() === '') throw new Error('The remote server needs a non-empty name.');
  if (!SPAWN_MODES.includes(spawnMode)) throw new Error(`Unknown spawn mode ${JSON.stringify(spawnMode)}: use one of ${SPAWN_MODES.join(', ')}.`);
  return ['remote-control', '--name', name, '--spawn', spawnMode, ...(permissionMode ? ['--permission-mode', permissionMode] : [])];
}

/** What cmd.exe acts on in a line of a batch file, quoted or not: the operators, `%` (a variable, expanded inside
 * quotes too), `!` (the same, where delayed expansion is on), a quote, which no escape gets past both cmd.exe and
 * the program it starts, and control characters, a line end among them. */
const UNSAFE_IN_BATCH = /[&|<>^%"!\x00-\x1f\x7f]/;

/** The values a launcher holds, each with what it is called when it is refused. `startCommandLine` checks these and
 * builds the command from what it checked, so no value reaches the file unchecked or is refused without a name. */
const LAUNCHER_LABELS = {
  node: 'the node executable',
  script: 'this install of js-harness',
  root: 'the project folder',
  name: 'the server name',
  permissionMode: 'the permission mode',
  spawnMode: 'the spawn mode',
  home: 'the home',
};

/** The text of the login launcher: a batch file whose one command runs `node <script> start --cwd <root> --name
 * <name>`, with `--permission-mode`, `--spawn` and `--home` when given, so a login starts the same server `remote
 * start` did. Every line ends in CRLF. Throws, naming the value, when one holds what cmd.exe would act on: a
 * launcher that runs something else at every login is worse than none.
 *
 * The file is UTF-8 with no byte order mark (a mark makes the first line an unknown command). Measured with a
 * real cmd.exe on 2026-10-04: it reads a batch file in the console's code page, line by line, so a path with a
 * letter beyond ASCII is not found under code page 850, 437 or 1252, and is found once a `chcp 65001` line has
 * run before it. That line is written only when the command needs it: the console is the launcher's own. */
export function loginLauncher(options) {
  const command = startCommandLine(options);
  return [
    '@echo off',
    'rem Starts the Claude remote-control server of one project at login. Written by js-harness remote start --at-login; js-harness remote stop --at-login removes it.',
    ...(/[^\x00-\x7f]/.test(command) ? ['chcp 65001 >nul'] : []),
    command,
    '',
  ].join('\r\n');
}

/** The one command line the launcher and the watchdog task both run: `"<node>" <script> start --cwd <root> --name
 * <name> ...`, then `more`. It is built from the values it checked, each of `LAUNCHER_LABELS`, and throws, naming
 * the value, when one holds what cmd.exe would act on. */
function startCommandLine(options, more = []) {
  const checked = {};
  for (const [key, label] of Object.entries(LAUNCHER_LABELS)) {
    const value = options[key];
    const found = value === undefined ? null : UNSAFE_IN_BATCH.exec(value);
    if (found) {
      throw new Error(`the login launcher cannot hold ${label} ${JSON.stringify(value)}: it has ${JSON.stringify(found[0])}, and cmd.exe acts on & | < > ^ % " ! and control characters in a batch file`);
    }
    checked[key] = value;
  }
  const { node, script, root, name, permissionMode, spawnMode, home } = checked;
  const args = [
    script, 'start', '--cwd', root, '--name', name,
    ...(permissionMode ? ['--permission-mode', permissionMode] : []),
    ...(spawnMode ? ['--spawn', spawnMode] : []),
    ...(home ? ['--home', home] : []),
    ...more,
  ];
  // The command is quoted whatever it holds: cmd.exe splits a bare command name at `,`, `;` and `=`.
  const quoted = quoteWindowsArg(node);
  return windowsCommandLine(quoted.startsWith('"') ? quoted : `"${quoted}"`, args);
}

/** What a scheduled task cannot carry, beyond what the launcher already refuses (a `%`, which Task Scheduler
 * expands as a variable, and a quote among it): `$(`, which Task Scheduler replaces as a parameter (`$(Arg0)`),
 * and anything beyond printable ASCII. Measured on Windows 10 19044 on 2026-10-06 with a throwaway task:
 * `schtasks /Create /XML` stores a letter beyond ASCII correctly (from UTF-8 with or without a mark, and from
 * UTF-16), but `schtasks /Query /TN <name> /XML` writes its XML in the console's code page, whatever its
 * `encoding="UTF-16"` declaration says: the `ñ` of `C:\Año ñandú\node.exe` came back as the byte `a4` under code
 * pages 850 and 437, `f1` under 1252 and `c3 b1` under 65001. So such a value reads back differently from one
 * console to the next and cannot be compared with what was recorded: the task could never be told from one
 * edited by hand, and would never be removed. An ASCII command and its arguments read back to the letter. */
const UNSAFE_IN_TASK = /\$\(|[^\x20-\x7e]/;

/** What the watchdog task runs, as Task Scheduler holds it: `{ command, arguments }`. The command is `conhost`
 * (the full path of `conhost.exe`), which with `--headless` runs a console program with no window, as a task that
 * fires every five minutes must; the arguments are the launcher's own command line (the same values, checked the
 * same way) and `--watchdog`, so the task starts the server only when it is not running and was not stopped on
 * purpose. Throws, naming the value, when one cannot be carried: a task that runs something else every five
 * minutes is worse than none. The launcher's values have passed the launcher's own check by then
 * (`startCommandLine` throws first on what a batch file acts on), so one refused here is one the launcher holds
 * and the task cannot: that error has `onlyTheTask`, and `start --at-login` still writes the launcher, as it did
 * before there was a task. `conhost` is no value of the launcher's: it is checked for both, and its error has no
 * such mark, since with no usable `conhost.exe` there is nothing to fall back from. */
export function watchdogTask({ conhost, ...options } = {}) {
  if (typeof conhost !== 'string' || conhost.trim() === '') throw new Error('the scheduled task needs the path of conhost.exe to run its command with no window');
  const line = startCommandLine(options, ['--watchdog']);
  const refuse = (label, value, found, mark) => {
    const message = `the scheduled task cannot hold ${label} ${JSON.stringify(value)}: it has ${JSON.stringify(found[0])}, and a task takes only printable ASCII, with no & | < > ^ % " ! and no $(, which Task Scheduler replaces`;
    throw Object.assign(new Error(message), mark);
  };
  const inConhost = UNSAFE_IN_BATCH.exec(conhost) ?? UNSAFE_IN_TASK.exec(conhost);
  if (inConhost) refuse('the path of conhost.exe', conhost, inConhost, {});
  for (const [key, label] of Object.entries(LAUNCHER_LABELS)) {
    const found = options[key] === undefined ? null : UNSAFE_IN_TASK.exec(options[key]);
    if (found) refuse(label, options[key], found, { onlyTheTask: true });
  }
  return { command: conhost, arguments: `--headless ${line}` };
}

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const xmlText = (text) => String(text).replace(/[&<>"']/g, (char) => XML_ENTITIES[char]);

/** The definition `schtasks /Create /XML` registers for `action` (`{ command, arguments }`, see `watchdogTask`):
 * a task of the user who registers it, run only while they are logged on and with no elevation (`InteractiveToken`,
 * `LeastPrivilege`: what lets `schtasks` register it without being an administrator), every five minutes from a
 * date in the past and with no end, on battery too, one instance at a time, each given two minutes (`remote start`
 * returns in seconds, and the supervisor it leaves is detached and outlives the task). Measured on Windows 10
 * 19044 on 2026-10-06: `schtasks` takes this document as a UTF-8 file with no XML declaration. It is a function
 * of the action alone, so a task known only by its record can be registered again exactly. */
export function watchdogTaskXml(action) {
  return [
    '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    '  <RegistrationInfo>',
    '    <Description>Starts the Claude remote-control server of one project again when it is not running, every five minutes. Registered by js-harness remote start --at-login; js-harness remote stop --at-login deletes it.</Description>',
    '  </RegistrationInfo>',
    '  <Triggers>',
    '    <TimeTrigger>',
    '      <Repetition>',
    '        <Interval>PT5M</Interval>',
    '        <StopAtDurationEnd>false</StopAtDurationEnd>',
    '      </Repetition>',
    '      <StartBoundary>2026-01-01T00:00:00</StartBoundary>',
    '      <Enabled>true</Enabled>',
    '    </TimeTrigger>',
    '  </Triggers>',
    '  <Principals>',
    '    <Principal id="Author">',
    '      <LogonType>InteractiveToken</LogonType>',
    '      <RunLevel>LeastPrivilege</RunLevel>',
    '    </Principal>',
    '  </Principals>',
    '  <Settings>',
    '    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
    '    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
    '    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
    '    <StartWhenAvailable>true</StartWhenAvailable>',
    '    <ExecutionTimeLimit>PT2M</ExecutionTimeLimit>',
    '    <Enabled>true</Enabled>',
    '  </Settings>',
    '  <Actions Context="Author">',
    '    <Exec>',
    `      <Command>${xmlText(action.command)}</Command>`,
    `      <Arguments>${xmlText(action.arguments)}</Arguments>`,
    '    </Exec>',
    '  </Actions>',
    '</Task>',
    '',
  ].join('\r\n');
}

const isFile = (file) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

/** Where the Claude CLI is, from the PATH of `env` and nothing else (nothing is run to find it):
 * `{ path, shell }`, or `null`. On Windows each directory is tried for `claude.exe`, then `claude.cmd`, in PATH
 * order; a `.cmd` is an npm shim that only a shell can start, hence `shell`. Elsewhere it is a plain `claude`. */
export function resolveClaude({ env = process.env, platform = process.platform, exists = isFile } = {}) {
  const windows = platform === 'win32';
  const key = Object.keys(env).find((name) => (windows ? /^path$/i.test(name) : name === 'PATH'));
  if (!key || typeof env[key] !== 'string') return null;
  const join = windows ? path.win32.join : path.posix.join;
  const names = windows ? ['claude.exe', 'claude.cmd'] : ['claude'];
  for (const entry of env[key].split(windows ? ';' : ':')) {
    const dir = entry.trim().replace(/^"|"$/g, '');
    if (dir === '') continue;
    for (const name of names) {
      const file = join(dir, name);
      if (exists(file)) return { path: file, shell: name.endsWith('.cmd') };
    }
  }
  return null;
}

/** How long to wait before the next restart: `minMs` the first time, twice the previous wait after each quick
 * exit, never more than `maxMs`, and `minMs` again once a server ran for `healthyMs` (it was working; the exit
 * is the ten-minutes-offline one, not a broken setup). */
export function nextDelay(previousMs, ranForMs, { minMs = 5000, maxMs = 60000, healthyMs = 300000 } = {}) {
  if (ranForMs >= healthyMs || !(previousMs > 0)) return minMs;
  return Math.min(Math.max(previousMs * 2, minMs), maxMs);
}

const duration = (ms) => (ms < 1000 ? `${Math.round(ms)}ms` : `${Math.round(ms / 1000)}s`);

/** A wait that ends early, and quietly, when `signal` aborts. */
function abortableSleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** The log opened for appending, its folder made first, or `null` when it cannot be: the log is best effort, and
 * every use asks again, so a log that becomes writable is written to from then on. */
function openLog(logPath) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    return fs.openSync(logPath, 'a');
  } catch {
    return null;
  }
}

/** Adds one `[js-harness remote] ...` line to the log, best effort: the supervisor has nowhere else to say that
 * its log cannot be written, and must keep the server up all the same. */
export function logNote(logPath, text) {
  const fd = openLog(logPath);
  if (fd === null) return;
  try {
    fs.appendFileSync(fd, `[js-harness remote] ${text}\n`);
  } catch {
    // an unwritable log loses the line, nothing else
  } finally {
    fs.closeSync(fd);
  }
}

/** The size the log is trimmed past, and how much of its end is then kept: sixteen times the 64 KiB `remote
 * status` reads (`LOG_TAIL_BYTES` in `bin/remote.mjs`). Nothing else bounds the file: the server repaints its whole
 * status about once a second, and on 2026-10-06 the log of two days was 71 MB. */
export const LOG_MAX_BYTES = 5 * 1024 * 1024;
export const LOG_KEEP_BYTES = 1024 * 1024;
/** How often the cap is checked while a server runs. A run lasts hours (one lasted 28), so the checks between
 * runs are not enough; at the 1.5 MB an hour measured, a minute lets the log pass the cap by a few KiB. */
export const LOG_CHECK_MS = 60 * 1000;
/** How many times a trim looks for what was written while it moved the end, before it cuts all the same. */
const CATCH_UP_PASSES = 8;

/** The bytes `[from, to)` of `fd`. Throws when the file ends before `to`. */
function readRange(io, fd, from, to) {
  const buffer = Buffer.alloc(to - from);
  for (let done = 0; done < buffer.length;) {
    const read = io.readSync(fd, buffer, done, buffer.length - done, from + done);
    if (read === 0) throw new Error('the log is shorter than it was');
    done += read;
  }
  return buffer;
}

function writeAt(io, fd, buffer, position) {
  for (let done = 0; done < buffer.length;) done += io.writeSync(fd, buffer, done, buffer.length - done, position + done);
}

/** Trims the log at `logPath` once it is larger than `maxBytes`. What is left is one `[js-harness remote] log
 * trimmed: ...` line (not one `remote status` reads as the server going down) and then the end of the log: at
 * most `keepBytes` of it, from the first line start in those bytes. That is after a `\n`, so never inside a
 * line, a character of several bytes or an escape sequence; an end with no `\n` in it keeps nothing.
 *
 * Returns `{ trimmed }` and never throws: best effort, like every write to the log. `{ trimmed: false }` alone is
 * a log with nothing to trim: none at all, one at or under the cap, or one so short that the line above would not
 * make it shorter. A trim that failed (a log that cannot be opened, measured, read, written or cut) comes back
 * with what failed, `{ trimmed: false, error }`: that log is not being kept under its cap, and the caller has to
 * be able to say so (`supervise` does). `io` is `node:fs`, injectable.
 *
 * The file is trimmed in place: its end is copied over its start and the file is cut after the copy, never
 * renamed or replaced. The server holds a handle of its own to this very file for a whole run (`runServer` hands
 * it over as stdout), opened for appending, so each of its writes goes wherever the file ends at that moment:
 * after the cut, right after the kept part. Measured on Windows 10 with a real process on 2026-10-06, by the
 * test with the holding writer: no hole, every line whole, the same handle through two trims.
 *
 * What can be lost. Nothing stops the server from writing while this runs. What it appends after the end was
 * read is looked for again and moved too, until a look finds nothing new (`CATCH_UP_PASSES` looks at most, so a
 * server that writes faster than this copies cannot hold the supervisor here). A write that lands between the
 * last of those looks and the cut, two system calls apart, is cut off with the rest: one write, and the server's
 * next repaint says again what it said. A trim that dies midway (a write error, a supervisor killed) has cut
 * nothing: the start of the file holds a copy of its end, the end is as it was, the file is still over the cap,
 * and the next check trims it. The end is as it was because the copy stops before the part it was read from, and
 * that is a rule here, not a matter of the numbers handed in: no more is kept than half of what the line leaves
 * of the log (line + 2 × kept ≤ size), so a `keepBytes` of half the log or more keeps a little under half. Only
 * what the server appends during the trim is written past that copy, and it reaches the old end only when more
 * arrives in those moments than the room in between; the start holds all of the old end by then. */
export function trimLog(logPath, { maxBytes = LOG_MAX_BYTES, keepBytes = LOG_KEEP_BYTES, io = fs } = {}) {
  const note = (dropped) => Buffer.from(`[js-harness remote] log trimmed: it passed ${maxBytes} bytes, and the ${dropped} bytes before this line were dropped\n`);
  let fd;
  try {
    fd = io.openSync(logPath, 'r+');
    const size = io.fstatSync(fd).size;
    if (size <= maxBytes) return { trimmed: false };
    // The rule that leaves the end as it was: line + 2 × kept ≤ size. No line is longer than the whole log's.
    const keep = Math.max(0, Math.min(keepBytes, Math.floor((size - note(size).length) / 2)));
    const end = readRange(io, fd, size - keep, size);
    const lineEnd = end.indexOf(0x0a);
    const kept = end.subarray(lineEnd === -1 ? end.length : lineEnd + 1);
    const start = Buffer.concat([note(size - kept.length), kept]);
    if (start.length >= size) return { trimmed: false }; // a cap of a few bytes: the line would not make the log shorter
    writeAt(io, fd, start, 0);
    let length = start.length;
    let moved = size;
    for (let look = 0; look < CATCH_UP_PASSES; look++) {
      const now = io.fstatSync(fd).size;
      if (now <= moved) break;
      const late = readRange(io, fd, moved, now);
      writeAt(io, fd, late, length); // always behind what is still to be read: `length` stays below `moved`
      length += late.length;
      moved = now;
    }
    io.ftruncateSync(fd, length);
    return { trimmed: true };
  } catch (error) {
    // No log is nothing to trim. Anything else is a log that may be over its cap and was not trimmed.
    return fd === undefined && error?.code === 'ENOENT' ? { trimmed: false } : { trimmed: false, error };
  } finally {
    try {
      if (fd !== undefined) io.closeSync(fd);
    } catch {
      // a handle that would not close costs nothing else
    }
  }
}

/** How many checks of the cap fail in a row between two lines that say so (see `supervise`): at a check a minute,
 * a line an hour. */
const TRIM_FAILURE_NOTE_EVERY = 60;

/** What the log is told when a check of its cap failed, the `failures`-th in a row: `log not trimmed: ...`, with
 * what failed. Like `log trimmed`, not a line `remote status` reads as the server going down. */
export function trimFailureNote(error, failures = 1) {
  return `log not trimmed${failures > 1 ? `, ${failures} checks in a row` : ''}: ${error?.message ?? error}`;
}

/** Runs `run` every `ms` until the function it returns is called. The timer never holds the process open. */
function repeat(run, ms) {
  const timer = setInterval(run, ms);
  timer.unref();
  return () => clearInterval(timer);
}

/** Starts the server: a `.cmd` shim as one command line through the shell (the quoting of `codex-review`), anything
 * else directly. */
function launch(spawn, claude, args, options) {
  return claude.shell
    ? spawn(windowsCommandLine(quoteWindowsArg(claude.path), args), [], { ...options, shell: true })
    : spawn(claude.path, args, options);
}

/** One run of the server, its output appended to `logPath`, or discarded when the log cannot be opened: the
 * server runs either way. Resolves with `{ code, signal, ranFor }` when it exits, `{ error, ranFor }` when it
 * could not start, `{ killError }` when the abort could not stop it. On abort the server's tree is killed by
 * identity, from the `Date.now()` taken just before the spawn (the clock the process snapshot is compared with,
 * so not the injectable `now`, which only times the run). */
function runServer({ claude, args, cwd, env, logPath, spawn, kill, now, platform, signal }) {
  return new Promise((resolve) => {
    let settled = false;
    let child;
    const ranFrom = now();
    const startedAt = Date.now();
    const finish = (result) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', stop);
      resolve({ ...result, ranFor: now() - ranFrom });
    };
    function stop() {
      try {
        kill(child, { startedAt });
      } catch (killError) {
        finish({ killError }); // the tree may still be running: waiting for its exit could wait forever
      }
    }
    const log = openLog(logPath);
    const out = log ?? 'ignore';
    try {
      // Detached off Windows, so the child leads the process group `killTree` kills; on Windows that would
      // only open a console.
      child = launch(spawn, claude, args, { cwd, env, stdio: ['ignore', out, out], windowsHide: true, detached: platform !== 'win32' });
    } catch (error) {
      finish({ error });
      return;
    } finally {
      if (log !== null) fs.closeSync(log); // the child holds its own copy
    }
    child.once('error', (error) => finish({ error }));
    child.once('exit', (code, exitSignal) => finish({ code, signal: exitSignal }));
    if (signal?.aborted) stop();
    else signal?.addEventListener('abort', stop, { once: true });
  });
}

/** Runs the server until `signal` aborts: `claude` (`{ path, shell }`, see `resolveClaude`) with `args` in `cwd`,
 * with `env` as given (clean it with `cleanServerEnv` first), its stdout and stderr appended to `logPath`. Each
 * exit, or failure to start, adds one `[js-harness remote] ...` line to the log and is followed by a wait of
 * `nextDelay(..., backoff)` and a restart. On abort the running server and what it started are killed, by
 * identity, with no restart, and it resolves; a kill that failed is logged and thrown. The log is best effort:
 * one that cannot be opened or written loses its lines, never the server, the backoff or a later write.
 *
 * The log has a cap, `logCap` (`{ maxBytes, keepBytes, checkMs }`, by default `LOG_MAX_BYTES`, `LOG_KEEP_BYTES`
 * and `LOG_CHECK_MS`): `trimLog` is called before each run, when no server holds the log, and every `checkMs`
 * while one runs, on a timer that starts with the run and is stopped when it ends, however it ends. A check that
 * fails, by what it returns or by throwing, ends nothing, and the next one is made. But a log that is not trimmed
 * grows as it did before there was a cap, so the log is told: `log not trimmed: ...` (`trimFailureNote`) for the
 * first check that fails, and again for every `TRIM_FAILURE_NOTE_EVERY`-th that fails after it with none going
 * through in between. One line for each failed check would be a line a minute into the very log that cannot be
 * cut; one line ever would be megabytes back by the time someone reads the end of a log that kept growing. A
 * check that goes through ends the count, so a failure after it is said at once: a trim that fails every other
 * time leaves a line every two checks, in a log that is being trimmed. Best effort like every note: the log may
 * be the very thing that cannot be written.
 * `spawn`, `sleep(ms, signal)`, `now`, `kill` (`killTree`), `platform`, `trim` (`trimLog`) and `every(run, ms)`,
 * which returns what stops it, are injectable. */
export async function supervise({
  claude, args = [], cwd, env, logPath, signal, backoff = {}, logCap = {},
  spawn = spawnChild, sleep = abortableSleep, now = Date.now, kill = killTree, platform = process.platform,
  trim = trimLog, every = repeat,
}) {
  if (signal?.aborted) return;
  const note = (text) => logNote(logPath, text);
  let failedChecks = 0; // in a row
  const checkCap = () => {
    let failure;
    try {
      failure = trim(logPath, logCap)?.error;
    } catch (error) {
      failure = error ?? new Error('unknown error');
    }
    failedChecks = failure === undefined ? 0 : failedChecks + 1;
    if (failedChecks % TRIM_FAILURE_NOTE_EVERY === 1) note(trimFailureNote(failure, failedChecks));
  };
  let delay;
  while (!signal?.aborted) {
    checkCap();
    const running = runServer({ claude, args, cwd, env, logPath, spawn, kill, now, platform, signal });
    const stopChecking = every(checkCap, logCap.checkMs ?? LOG_CHECK_MS);
    const run = await running.finally(stopChecking);
    if (run.killError) {
      note(`could not stop the server: ${run.killError.message}`);
      throw run.killError;
    }
    if (signal?.aborted) break;
    delay = nextDelay(delay, run.ranFor, backoff);
    if (run.error) note(`server could not start (${run.error.message}); retrying in ${duration(delay)}`);
    else note(`server exited (${run.code !== null ? `code ${run.code}` : `signal ${run.signal}`}) after ${duration(run.ranFor)}; restarting in ${duration(delay)}`);
    await sleep(delay, signal);
  }
  note('stopped');
}

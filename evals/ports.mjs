// The engram port of a trial, and what is done about it. Zero deps, plain Node. Why a trial needs one: the
// engram plugin's hooks talk HTTP to `ENGRAM_URL` or `127.0.0.1:${ENGRAM_PORT:-7437}`, and the real engram
// server of this machine answers on 7437, so a trial that inherits no port reaches the real store (and a
// hook that finds nothing there starts a detached `engram serve` of its own, with no sandbox path in its
// command line). Each trial therefore gets a port of its own, and what listens on it is killed with the trial.
// The reasoning is in `odd/tasks/evals.md` (T4a).
//
// Everything that starts a process takes its `spawnSync` (and `kill`, `connect`) as a parameter, so the
// tests prove the commands and the parsing against fixtures and no test ever needs a real listener but one
// of its own.
import net from 'node:net';
import { spawnSync as spawnChildSync } from 'node:child_process';

/** Where this machine's real engram server listens: no trial may be given it, and nothing here may look
 * for, or kill, whatever listens on it. */
export const REAL_ENGRAM_PORT = 7437;

/** The image name of an engram process, with or without `.exe`: the only thing `killByPort` kills by default. */
export const ENGRAM_PROCESS_NAME = /^engram(\.exe)?$/i;

/** Throws unless `port` can be a trial's engram port: an integer from 1024 to 65535 (an unprivileged port
 * the plugin's own check accepts) that is not in `protectedPorts` (the real engram port by default). This is
 * the one gate every function below goes through, so a typo or a string can never reach a command line. */
export function assertTrialPort(port, { protectedPorts = [REAL_ENGRAM_PORT] } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${JSON.stringify(port)} is not a usable engram port: an integer from 1024 to 65535 is needed`);
  }
  if (protectedPorts.includes(port)) {
    throw new Error(`${port} is not a trial's engram port: ${port === REAL_ENGRAM_PORT ? `${REAL_ENGRAM_PORT} is where the real engram server listens, and ` : ''}a trial must never be pointed at it, nor anything on it looked for or killed`);
  }
}

/** The ports handed out and not yet released, in this process: two trials that overlap never get one port. */
const RESERVED = new Set();

/** Asks the OS for a free loopback port: binds port 0, reads the number, closes. */
function bindFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** A port that was free a moment ago and that no other trial of this process holds, never the real engram
 * port. Allocated per trial, at trial start, by binding port 0 and releasing it: that is the one way to a
 * port that is free on this machine now, and the gap between the release and the server binding it is the
 * only race left (a port from the OS's own ephemeral range is not handed out again at once). `reserved`
 * keeps overlapping trials apart until `releasePort`. `listen` returns a candidate and is injectable. */
export async function allocatePort({ listen = bindFreePort, attempts = 20, reserved = RESERVED } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const port = await listen();
    try {
      assertTrialPort(port);
    } catch {
      continue;
    }
    if (reserved.has(port)) continue;
    reserved.add(port);
    return port;
  }
  throw new Error(`could not find a free port for the trial's engram server in ${attempts} attempts`);
}

/** Gives a port back to the pool of `allocatePort`. */
export function releasePort(port, { reserved = RESERVED } = {}) {
  reserved.delete(port);
}

const defaultConnect = (port, host) => new Promise((resolve) => {
  const socket = net.connect({ port, host });
  const finish = (listening) => {
    socket.destroy();
    resolve(listening);
  };
  socket.setTimeout(2000, () => finish(false));
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
});

/** Whether anything accepts a connection on `port` of the loopback. A connect, not a process listing, so the
 * answer does not depend on which tool lists processes on this OS, or on its parsing: it is the plain fact. */
export async function isListening(port, { connect = defaultConnect } = {}) {
  return connect(port, '127.0.0.1');
}

// The PowerShell scripts. Like `SWEEP_SCRIPT` in the runner, they read their input from the environment and
// never have it spliced into their text. `-EncodedCommand` keeps quoting out of it.
const psCommand = (script) => ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];

// Get-NetTCPConnection and Get-Process give numbers and names with no text to localize (`netstat` prints
// LISTENING in the language of the OS), one `pid<TAB>name` line per listener. When nothing listens,
// Get-NetTCPConnection raises a non-terminating error of category ObjectNotFound: that one is the free port.
// Its errors are collected rather than silenced, because `-ErrorAction SilentlyContinue` would also swallow a
// CIM failure or a permission problem and the script would end 0 with no rows, which reads as "free".
const LISTENERS_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
try {
  $port = [int]$env:JS_HARNESS_PORT
  $owners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue -ErrorVariable lookupErrors | Select-Object -ExpandProperty OwningProcess -Unique)
  $failed = @($lookupErrors | Where-Object { $_.CategoryInfo.Category -ne 'ObjectNotFound' })
  if ($failed.Count -gt 0) {
    throw (($failed | ForEach-Object { $_.Exception.Message }) -join '; ')
  }
  foreach ($id in $owners) {
    $name = (Get-Process -Id $id -ErrorAction SilentlyContinue).ProcessName
    "$id" + [char]9 + "$name"
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

const PROCESSES_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
try {
  $name = $env:JS_HARNESS_PROCESS_NAME + '.exe'
  Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq $name } | ForEach-Object { "$($_.ProcessId)" + [char]9 + "$($_.CommandLine)" }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

const lines = (text) => String(text).split(/\r?\n/);
const isMissing = (result) => result.error?.code === 'ENOENT';

function runPowerShell(script, env, sync, what) {
  const result = sync('powershell', psCommand(script), { env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (result.error) throw new Error(`${what} could not run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${what} failed (exit ${result.status}): ${String(result.stderr).trim()}`);
  return result;
}

/** The processes listening on TCP `port`, as `[{ pid, name }]` (a pid once, however many sockets it holds); empty
 * when the port is free. Windows: PowerShell. POSIX: `lsof`, then `ps` for each pid's name; `ss` when `lsof`
 * is not installed. A lookup that cannot run throws: an empty list must always mean "free", never "could not
 * ask". `port` goes through `assertTrialPort` first, so the real engram port is never looked at. */
export function findListeners(port, { platform = process.platform, spawnSync: sync = spawnChildSync, protectedPorts } = {}) {
  assertTrialPort(port, protectedPorts && { protectedPorts });
  if (platform === 'win32') {
    const { stdout } = runPowerShell(LISTENERS_SCRIPT, { JS_HARNESS_PORT: String(port) }, sync, 'the lookup of the listener');
    const found = new Map();
    for (const line of lines(stdout)) {
      const match = /^(\d+)\t(.*)$/.exec(line);
      if (match && !found.has(Number(match[1]))) found.set(Number(match[1]), match[2].trim());
    }
    return [...found].map(([pid, name]) => ({ pid, name }));
  }

  const lsof = sync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], { encoding: 'utf8', timeout: 30000 });
  if (!isMissing(lsof)) {
    if (lsof.error) throw new Error(`the lookup of the listener could not run: ${lsof.error.message}`);
    // lsof exits 1 both when nothing matches and on a real error (a permission problem, a bad option), and an
    // error usually prints to stderr only. The one result that means "no listener" is the documented no-match:
    // exit 1 with nothing on stdout and nothing on stderr. Any other non-zero exit is a lookup that failed.
    const noMatch = lsof.status === 1 && String(lsof.stdout).trim() === '' && String(lsof.stderr).trim() === '';
    if (lsof.status !== 0 && !noMatch) throw new Error(`the lookup of the listener failed (lsof exit ${lsof.status}): ${String(lsof.stderr).trim()}`);
    const pids = [...new Set(lines(lsof.stdout).map((line) => /^p(\d+)$/.exec(line.trim())?.[1]).filter(Boolean).map(Number))];
    return pids.map((pid) => {
      const ps = sync('ps', ['-o', 'comm=', '-p', String(pid)], { encoding: 'utf8', timeout: 30000 });
      return { pid, name: ps.error || ps.status !== 0 ? '' : String(ps.stdout).trim().split('/').pop() };
    });
  }
  const ss = sync('ss', ['-H', '-ltnp', 'sport', '=', `:${port}`], { encoding: 'utf8', timeout: 30000 });
  if (isMissing(ss)) throw new Error('cannot find what listens on the port: neither lsof nor ss is installed');
  if (ss.error || ss.status !== 0) throw new Error(`the lookup of the listener failed (ss): ${ss.error?.message ?? String(ss.stderr).trim()}`);
  // The filter leaves only rows of this port, so every row is a listener. One whose owner is hidden (ss shows no
  // `users:(...)` for a process it may not inspect) is a listener that cannot be named: that is not a free port.
  const found = new Map();
  for (const row of lines(ss.stdout).filter((line) => line.trim() !== '')) {
    const owners = [...row.matchAll(/\("([^"]*)",pid=(\d+)/g)];
    if (owners.length === 0) throw new Error(`ss shows a listener on port ${port} without an owner (${JSON.stringify(row.trim().slice(0, 120))}): cannot tell which process it is, so the lookup is inconclusive`);
    for (const match of owners) found.set(Number(match[2]), match[1]);
  }
  return [...found].map(([pid, name]) => ({ pid, name }));
}

const waitMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Kills what listens on `port`, with its tree, and resolves to `{ killed }`, the pids: nothing listening is
 * `{ killed: [] }`, not an error. It exists because the `engram serve` a hook starts is detached and its command
 * line holds no path of the trial, so the sweep by path (`killByPath`) cannot reach it, while the port is
 * the one thing that is the trial's alone.
 *
 * Because a wrong port would kill the wrong process: the port goes through `assertTrialPort` (the real engram
 * port is refused before anything is looked up), and a listener whose name does not match `name` (an engram
 * process by default) is left alone and reported, since a port that something unrelated now holds was not the
 * trial's to free. After the kill the port is looked up again, up to `retries` times `delayMs` apart (Windows
 * lets go of a killed holder a moment late), and a port that still has a listener throws. Windows: `taskkill /T
 * /F`; POSIX: `kill(pid, 'SIGKILL')`. `spawnSync`, `kill` and `sleep` are injectable. */
export function killByPort(port, {
  platform = process.platform, spawnSync: sync = spawnChildSync, kill = process.kill, name = ENGRAM_PROCESS_NAME, label = 'engram', protectedPorts, retries = 10, delayMs = 100, sleep = waitMs,
} = {}) {
  const lookup = () => findListeners(port, { platform, spawnSync: sync, protectedPorts });
  const listeners = lookup();
  if (listeners.length === 0) return { killed: [] };
  const strangers = listeners.filter((listener) => !name.test(listener.name));
  if (strangers.length > 0) {
    throw new Error(`port ${port} is held by ${strangers.map((listener) => `pid ${listener.pid} (${listener.name || 'unknown'})`).join(', ')}, which is not ${label}: left alone`);
  }
  for (const { pid } of listeners) {
    if (platform === 'win32') {
      // taskkill's exit code is not consulted: a process that is already gone is what was wanted. What decides is the lookup below.
      const result = sync('taskkill', ['/pid', String(pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
      if (result.error) throw new Error(`taskkill could not run: ${result.error.message}`);
    } else {
      try {
        kill(pid, 'SIGKILL');
      } catch (err) {
        if (err.code !== 'ESRCH') throw err;
      }
    }
  }
  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (lookup().length === 0) return { killed: listeners.map((listener) => listener.pid) };
    sleep(delayMs);
  }
  throw new Error(`port ${port} still listens after the kill of ${listeners.map((listener) => listener.pid).join(', ')}`);
}

/** Every process whose image is `name` (`engram` is `engram.exe` on Windows), as `[{ pid, command }]`. For the
 * probe's claim that a trial left no engram process behind: a list taken before the trial and one after it.
 * `name` is a plain image name (letters, digits, `.`, `_`, `-`) and travels as data. A listing that cannot run
 * throws, so an empty list always means "none". */
export function findProcesses(name, { platform = process.platform, spawnSync: sync = spawnChildSync } = {}) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`the process name ${JSON.stringify(name)} is not a plain image name`);
  if (platform === 'win32') {
    const { stdout } = runPowerShell(PROCESSES_SCRIPT, { JS_HARNESS_PROCESS_NAME: name }, sync, 'the process listing');
    return lines(stdout).map((line) => /^(\d+)\t(.*)$/.exec(line)).filter(Boolean).map((match) => ({ pid: Number(match[1]), command: match[2].trim() }));
  }
  const ps = sync('ps', ['-eo', 'pid=,comm=,args='], { encoding: 'utf8', timeout: 30000 });
  if (ps.error) throw new Error(`the process listing could not run: ${ps.error.message}`);
  if (ps.status !== 0) throw new Error(`the process listing failed (ps exit ${ps.status}): ${String(ps.stderr).trim()}`);
  return lines(ps.stdout)
    .map((line) => /^\s*(\d+)\s+(\S+)\s*(.*)$/.exec(line))
    .filter((match) => match && match[2].split('/').pop() === name)
    .map((match) => ({ pid: Number(match[1]), command: match[3].trim() }));
}

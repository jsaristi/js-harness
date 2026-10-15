// The launchers of a gate: the processes whose end leaves a waiting gate an orphan, which then gives up its
// place and runs nothing (odd/tasks/orphan-gate.md). On 2026-10-14 a TaskStop killed a queued turn's shell
// and left its `gate --wait` node alive, to run its script when its turn came.
//
// The parent alone is not the signal. Under Git Bash a script's shell forks a stub for each native command
// it runs, and node's parent is that stub, which outlives the shell that was killed (measured 2026-10-14:
// the shell gone, the stub and node alive). Nor is the parent's pid alone: Windows reuses pids and adopts no
// orphan. So the launchers are the parent and each shell above it, up to and with the first process that
// is no shell, each with its start time; on Linux an orphan is also told by `process.ppid`, which changes
// when it is adopted.
//
// They are read as the gate starts, never later: above the Bash tool's shell is a wrapper that ends within
// the first second (measured 2026-10-15), and a chain read once the gate waited took it for a launcher that
// had ended, which refused every wait of a session's gate.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';

/** The names of a shell, on Windows and Linux, the shim of an installed command (`cmd.exe`) among them. */
const SHELL = /^(sh|bash|dash|zsh|ksh|cmd|pwsh|powershell)(\.exe)?$/i;

/** The deepest walk, against a table that loops or a chain of shells without end. */
const MAX_LAUNCHERS = 8;

/** The PowerShell call that lists every Windows process, one `pid|ppid|name|start` line each. */
const WINDOWS_TABLE = [
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  "Get-CimInstance Win32_Process | ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.ProcessId, $_.ParentProcessId, $_.Name, $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { '' }) }",
];

/** A Windows process table, `pid -> { pid, ppid, name, start }` (a `|` apart: no file name holds one), `start` its creation time as a file time,
 * from one PowerShell call (about a second, measured 2026-10-14), or `null` when it could not be read. */
function windowsTable() {
  const result = spawnSync('powershell.exe', WINDOWS_TABLE, { encoding: 'utf8', timeout: 20_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  return result.status === 0 && typeof result.stdout === 'string' ? tableOf(result.stdout) : null;
}

/** The same table read without blocking: `rows()` is `undefined` until it is in, then the table or `null`;
 * `done` settles when it is in; `stop()` ends a read nobody needs any more. */
function windowsTableSoon() {
  let rows;
  let child;
  try {
    child = spawn('powershell.exe', WINDOWS_TABLE, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return { rows: () => null, done: Promise.resolve(), stop() {} };
  }
  let out = '';
  let settle;
  const done = new Promise((resolve) => {
    settle = resolve;
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    out += chunk;
  });
  child.on('error', () => {
    rows ??= null;
    settle();
  });
  child.on('close', (code) => {
    rows ??= code === 0 ? tableOf(out) : null;
    settle();
  });
  const stop = () => {
    if (rows !== undefined) return;
    rows = null;
    settle();
    try {
      child.kill();
    } catch {
      // it ended before its close was told: nothing to stop
    }
  };
  // The bound of the blocking read: a listing that hangs is no table, and nothing waits on it longer.
  setTimeout(stop, 20_000).unref();
  return { rows: () => rows, done, stop };
}

/** The rows of PowerShell's listing, or `null` for a listing with none. */
function tableOf(stdout) {
  const rows = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    const [pid, ppid, name, start] = line.split('|');
    if (!/^\d+$/.test(pid ?? '')) continue;
    rows.set(Number(pid), { pid: Number(pid), ppid: Number(ppid), name, start: start ? Number(start) : null });
  }
  return rows.size === 0 ? null : rows;
}

/** A Linux process table, read one process at a time from `/proc/<pid>/stat`: its name, its parent and its
 * start time in clock ticks since boot (the 22nd field). The name can hold spaces and parentheses, so the
 * fields are read after its last `)`. */
function linuxTable() {
  return {
    get(pid) {
      try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
        const open = stat.indexOf('(');
        const close = stat.lastIndexOf(')');
        const fields = stat.slice(close + 2).split(' ');
        return { pid, ppid: Number(fields[1]), name: stat.slice(open + 1, close), start: Number(fields[19]) };
      } catch {
        return undefined;
      }
    },
  };
}

const defaultTable = () => (process.platform === 'win32' ? windowsTable() : linuxTable());

/** The launchers of this process, `[{ pid, name, start }]`, read once as a gate starts: its parent
 * (`ppid`) and each shell above it, up to and with the first process that is no shell. A table that cannot
 * be read, or that lacks the parent, leaves the parent alone, held to its pid (`name` and `start` `null`).
 *
 * A shell whose parent is in no row, or whose parent started after it (a pid given since to another
 * process), had a parent that ended before the gate started, and that one launched no gate: the chain ends
 * with that shell. A process that is no shell ends the walk before its own parent is asked: that one may have
 * ended long ago, as explorer's has. */
export function readLaunchers({ ppid = process.ppid, readTable = defaultTable } = {}) {
  const alone = [{ pid: ppid, name: null, start: null }];
  let rows;
  try {
    rows = readTable();
  } catch {
    return alone;
  }
  if (!rows) return alone;
  const launchers = [];
  const seen = new Set();
  for (let at = rows.get(ppid); at && launchers.length < MAX_LAUNCHERS; ) {
    seen.add(at.pid);
    launchers.push({ pid: at.pid, name: at.name, start: at.start });
    if (!SHELL.test(at.name ?? '') || seen.has(at.ppid)) break;
    const parent = rows.get(at.ppid);
    if (!parent || (parent.start != null && at.start != null && parent.start > at.start)) break;
    at = parent;
  }
  return launchers.length === 0 ? alone : launchers;
}

/** The launchers of a gate, read as it starts, `{ read, settle, stop }`: `read()` gives the chain, or `null`
 * while the table is not in yet; `settle()` waits for it and gives the chain; `stop()` ends a read nobody
 * needs any more. On Linux `/proc` is read at once; on Windows PowerShell lists the processes beside the gate
 * (about a second), so a turn taken at once waits for nothing.
 *
 * The window this leaves, known and kept: a launcher that ends inside that second, before the table is in,
 * reads as a parent gone before the gate, and its end is not seen. Telling the two apart would need when a
 * process ended, which no table gives; the Bash tool's own wrapper ends inside that second on every run. */
export function startLaunchers({ ppid = process.ppid, platform = process.platform } = {}) {
  if (platform !== 'win32') {
    const chain = readLaunchers({ ppid });
    return { read: () => chain, settle: async () => chain, stop() {} };
  }
  const table = windowsTableSoon();
  let chain = null;
  const read = () => {
    if (chain === null) {
      const rows = table.rows();
      if (rows !== undefined) chain = readLaunchers({ ppid, readTable: () => rows });
    }
    return chain;
  };
  return {
    read,
    async settle() {
      await table.done;
      return read();
    },
    stop: table.stop,
  };
}

/** Whether a process with this pid exists: one this process may not signal does. */
function exists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/** Whether every launcher is still alive: each pid exists, and, on Linux, this process was not adopted
 * (`ppid()` is still the first launcher). That look is cheap and is made at every poll. `full` adds the one
 * made before the command starts: the table read again, where each launcher whose start was read must have
 * the same; a pid reused since is another process. A table that cannot be read there says nothing, and the
 * launchers are taken for alive: a failed look never gives up a live session's turn. */
export function launchersAlive(launchers, { exists: has = exists, ppid = process.platform === 'win32' ? null : () => process.ppid, full = false, readTable = defaultTable } = {}) {
  if (!launchers.every((one) => has(one.pid))) return false;
  if (ppid !== null && launchers.length > 0 && ppid() !== launchers[0].pid) return false;
  if (!full) return true;
  let rows;
  try {
    rows = readTable();
  } catch {
    return true;
  }
  if (!rows) return true;
  return launchers.every((one) => one.start === null || rows.get(one.pid)?.start === one.start);
}

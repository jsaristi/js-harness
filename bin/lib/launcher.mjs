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
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

/** The names of a shell, on Windows and Linux, the shim of an installed command (`cmd.exe`) among them. */
const SHELL = /^(sh|bash|dash|zsh|ksh|cmd|pwsh|powershell)(\.exe)?$/i;

/** The deepest walk, against a table that loops or a chain of shells without end. */
const MAX_LAUNCHERS = 8;

/** A Windows process table, `pid -> { pid, ppid, name, start }` (a `|` apart: no file name holds one), `start` its creation time as a file time,
 * from one PowerShell call (about a second, measured 2026-10-14), or `null` when it could not be read. */
function windowsTable() {
  const script =
    "Get-CimInstance Win32_Process | ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.ProcessId, $_.ParentProcessId, $_.Name, $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { '' }) }";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 20_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  const rows = new Map();
  for (const line of result.stdout.split(/\r?\n/)) {
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

/** The launchers of this process, `[{ pid, name, start }]`, read once when a gate starts: its parent
 * (`ppid`) and each shell above it, up to and with the first process that is no shell. A table that cannot
 * be read, or that lacks the parent, leaves the parent alone, held to its pid (`name` and `start` `null`).
 *
 * The chain can be read after a launcher ended, since a gate reads it only once it waits: a shell whose
 * parent is in no row, or whose parent started after it (a pid given since to another process), has a
 * parent that is gone, and the chain ends with that one, `gone: true`. A process that is no shell ends the
 * walk before its own parent is asked: that one may have ended long ago, as explorer's has. */
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
    if (!parent || (parent.start != null && at.start != null && parent.start > at.start)) {
      launchers.push({ pid: at.ppid, name: null, start: null, gone: true });
      break;
    }
    at = parent;
  }
  return launchers.length === 0 ? alone : launchers;
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
  if (!launchers.every((one) => one.gone !== true && has(one.pid))) return false;
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

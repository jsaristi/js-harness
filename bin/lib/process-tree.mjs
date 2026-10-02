// Kills a process tree without ever killing a process that is not part of it. Zero deps, plain Node.
//
// Why a tree is not found by parent pid alone. Windows never clears a dead parent's pid from its children
// and reuses pids quickly, so `ParentProcessId=<pid>` (and `taskkill /T`, which walks the same field at
// every level) can name a process that has nothing to do with the one whose pid it is. `explorer.exe` always
// records a dead parent, `userinit.exe`: the day a short-lived child of ours is given that number, "kill the
// children of that child" kills the desktop shell and everything started from it. A pid names a process
// only together with the time it was created, so this module selects descendants by pid AND creation time
// (`selectDescendants`, pure), and kills each one through a handle whose start time it checked first.
//
// Everything that starts a process takes its `spawnSync` (and `kill`) as a parameter, so the tests prove the
// selection and the commands without a process, and a failed lookup always throws: "nothing to kill" must
// never be read from "could not look".
import { spawnSync as spawnChildSync } from 'node:child_process';

/** How far the clocks may disagree, in ms: the creation time Windows records is read in 100 ns units off
 * the system clock, a spawn or an exit is timed by Node with `Date.now()`. Measured on Windows 10: a child's
 * creation time falls 10 to 13 ms after the `Date.now()` taken just before its spawn (and never before it),
 * so this is generous; it is only the slack in the window of an exited root (see `selectDescendants`), where
 * a smaller one is safer and a larger one buys nothing. */
export const CLOCK_TOLERANCE_MS = 100;

const known = (value) => typeof value === 'number' && Number.isFinite(value);
/** Idle (0) and System (4) are never a root and never a target, whatever they record. */
const isProtected = (pid) => !Number.isInteger(pid) || pid <= 4;

/** The pids that are provably descendants of `root` in `snapshot` (`[{ pid, ppid, createdAt }]`, `createdAt`
 * in ms since the epoch), breadth first. A process counts as a child of another only when it records its
 * pid AND was created at or after it; a process whose creation time is unknown is never selected, nor is
 * anything reached only through it (no evidence, no kill).
 *
 * `root` is either
 *  - live, `{ pid, createdAt }`: the root is part of the answer, and its direct children are the processes
 *    that record its pid and were created no earlier than it; or
 *  - exited, `{ pid, startedAt, exitedAt }` (the caller's own clock): the root is not part of the answer, and
 *    its direct children are those that record its pid and were created within its life, widened by
 *    `tolerance` on both ends. A child cannot be created before its parent started nor after it exited, so
 *    an old process that records a reused pid, or a new owner of the pid and its children, fall outside.
 * Below the first generation every parent is a live process of the snapshot, and the live rule applies. */
export function selectDescendants(snapshot, root, { tolerance = CLOCK_TOLERANCE_MS } = {}) {
  if (!root || isProtected(root.pid)) return [];
  const live = known(root.createdAt);
  if (!live && !(known(root.startedAt) && known(root.exitedAt))) return [];

  const byParent = new Map();
  for (const entry of snapshot) {
    if (!known(entry.createdAt) || isProtected(entry.pid)) continue;
    if (!byParent.has(entry.ppid)) byParent.set(entry.ppid, []);
    byParent.get(entry.ppid).push(entry);
  }
  const selected = live ? [root.pid] : [];
  const seen = new Set([root.pid]); // the root's pid is never selected as somebody else's child, which also ends a cycle
  const queue = [];
  const take = (parentPid, accepts) => {
    for (const entry of byParent.get(parentPid) ?? []) {
      if (seen.has(entry.pid) || !accepts(entry)) continue;
      seen.add(entry.pid);
      selected.push(entry.pid);
      queue.push(entry);
    }
  };
  take(root.pid, live
    ? (entry) => entry.createdAt >= root.createdAt
    : (entry) => entry.createdAt >= root.startedAt - tolerance && entry.createdAt <= root.exitedAt + tolerance);
  while (queue.length > 0) {
    const parent = queue.shift();
    take(parent.pid, (entry) => entry.createdAt >= parent.createdAt);
  }
  return selected;
}

/** The union of the trees of the live processes `pids` name in `snapshot` (each root included), for a caller
 * that found its roots some other way (the sweep by command line). `spared` pids are left out, and so is
 * everything that is reached only through them. A pid that is not in the snapshot, or whose creation time is
 * unknown, selects nothing. */
export function selectTrees(snapshot, pids, { spared = [] } = {}) {
  const sparedSet = new Set(spared);
  const visible = snapshot.filter((entry) => !sparedSet.has(entry.pid));
  const selected = new Set();
  for (const pid of pids) {
    const entry = visible.find((candidate) => candidate.pid === pid && known(candidate.createdAt));
    if (!entry) continue;
    for (const found of selectDescendants(visible, { pid, createdAt: entry.createdAt })) selected.add(found);
  }
  return [...selected];
}

/** The root `selectDescendants` needs for a child the caller spawned, from what the caller knows of it:
 * `startedAt` (read just before the spawn), and `exitedAt` once it has exited. A child that has not
 * exited is live, and the snapshot has its creation time (Node holds the process, so nothing else can have
 * its pid); one that is missing from the snapshot, or whose pid belongs to a process that started before the
 * spawn, has exited by `now`. Without `startedAt` a root that is gone cannot be searched: `null`. */
export function resolveRoot(snapshot, { pid, startedAt, exitedAt }, { now = Date.now(), tolerance = CLOCK_TOLERANCE_MS } = {}) {
  if (known(exitedAt)) return { pid, startedAt, exitedAt };
  const entry = snapshot.find((candidate) => candidate.pid === pid && known(candidate.createdAt));
  if (entry && (!known(startedAt) || entry.createdAt >= startedAt - tolerance)) return { pid, createdAt: entry.createdAt };
  return known(startedAt) ? { pid, startedAt, exitedAt: now } : null;
}

// ---- the commands -------------------------------------------------------------------------------------------------

const psArgs = (script) => ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];

/** PowerShell: `Format-ProcessRow` writes one CIM process as `pid<TAB>ppid<TAB>created<TAB>name`, the creation
 * time in ms since the epoch (empty when Windows does not say). Shared with the sweep by command line, so a
 * row means the same thing everywhere (see `parseSnapshot`). */
export const POWERSHELL_ROW_FUNCTION = String.raw`
function Format-ProcessRow($p) {
  $created = ''
  if ($p.CreationDate) { $created = [string]([DateTimeOffset]$p.CreationDate.ToUniversalTime()).ToUnixTimeMilliseconds() }
  "$($p.ProcessId)" + [char]9 + "$($p.ParentProcessId)" + [char]9 + $created + [char]9 + "$($p.Name)"
}
`;

const SNAPSHOT_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
${POWERSHELL_ROW_FUNCTION}
try {
  foreach ($p in @(Get-CimInstance Win32_Process)) { Format-ProcessRow $p }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

// One process per target, through a handle: `GetProcessById` opens it, its start time is compared with the
// one the snapshot saw, and only then is `Kill` called on that same handle, so a pid that was reused in the
// meantime is never the one that dies. No tree, no `taskkill`: every process to kill was selected by Node.
// The targets come from the environment (`pid@createdMs` per line), never from the script text. One line per
// target is printed: K killed (and exited), G gone (already exited, or not the process the snapshot saw),
// R still running after five seconds.
const KILL_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
try {
  foreach ($line in ($env:JS_HARNESS_KILL_TARGETS -split '\n')) {
    if ($line -eq '') { continue }
    $parts = $line -split '@'
    $id = [int]$parts[0]
    $created = [long]$parts[1]
    $outcome = 'R'
    $proc = $null
    try {
      $proc = [System.Diagnostics.Process]::GetProcessById($id)
      $start = ([DateTimeOffset]$proc.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
      if ([Math]::Abs($start - $created) -gt 2 -or $proc.HasExited) {
        $outcome = 'G'
      } else {
        try { $proc.Kill() } catch { }
        if ($proc.WaitForExit(5000)) { $outcome = 'K' }
      }
    } catch {
      if ($null -eq $proc) { $outcome = 'G' }
    } finally {
      if ($proc) { $proc.Dispose() }
    }
    $outcome + [char]9 + $id
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

const lines = (text) => String(text).split(/\r?\n/);

/** `[{ pid, ppid, createdAt, name }]` from rows of `Format-ProcessRow`; anything else in `stdout` is ignored.
 * `createdAt` is `null` when the row has none. */
export function parseSnapshot(stdout) {
  return lines(stdout)
    .map((line) => /^(\d+)\t(\d+)\t(\d*)\t(.*)$/.exec(line))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), ppid: Number(match[2]), createdAt: match[3] === '' ? null : Number(match[3]), name: match[4].trim() }));
}

function runPowerShell(script, env, sync, what) {
  const result = sync('powershell', psArgs(script), { ...(env && { env: { ...process.env, ...env } }), encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (result.error) throw new Error(`${what} could not run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${what} failed (exit ${result.status}): ${String(result.stderr).trim()}`);
  return result;
}

/** Every process of the machine, `[{ pid, ppid, createdAt, name }]`, from one CIM query. Throws when the query
 * could not run or listed nothing: a machine always has processes, so an empty answer is a failed one. */
export function takeSnapshot({ spawnSync: sync = spawnChildSync } = {}) {
  const { stdout } = runPowerShell(SNAPSHOT_SCRIPT, undefined, sync, 'the process snapshot');
  const snapshot = parseSnapshot(stdout);
  if (snapshot.length === 0) throw new Error('the process snapshot listed no process: it cannot be trusted to prove a tree empty');
  return snapshot;
}

/** Kills each of `targets` (`[{ pid, createdAt }]`) on its own, after checking that the process with that pid
 * still started at `createdAt`. Resolves to `{ killed, gone, running }` (pids): `gone` are targets that had
 * already exited or are not the process that was seen, which is what was wanted; `running` are targets still
 * alive five seconds after the kill. Throws when the command could not run, and on a target that is not a pid
 * above 4 with a creation time, before anything is started. */
export function killProcesses(targets, { spawnSync: sync = spawnChildSync } = {}) {
  for (const target of targets) {
    if (!Number.isInteger(target?.pid) || isProtected(target.pid) || !Number.isInteger(target.createdAt) || target.createdAt <= 0) {
      throw new Error(`the kill target ${JSON.stringify(target)} is not a pid above 4 with a creation time`);
    }
  }
  const outcome = { killed: [], gone: [], running: [] };
  if (targets.length === 0) return outcome;
  const env = { JS_HARNESS_KILL_TARGETS: targets.map(({ pid, createdAt }) => `${pid}@${createdAt}`).join('\n') };
  const { stdout } = runPowerShell(KILL_SCRIPT, env, sync, 'the kill');
  const names = { K: 'killed', G: 'gone', R: 'running' };
  for (const line of lines(stdout)) {
    const match = /^([KGR])\t(\d+)$/.exec(line);
    if (match) outcome[names[match[1]]].push(Number(match[2]));
  }
  return outcome;
}

function killPosixGroup(child, kill) {
  try {
    kill(-child.pid, 'SIGKILL'); // the child leads its own group (`detached`)
  } catch {
    try {
      child.kill?.('SIGKILL');
    } catch {
      // already gone
    }
  }
}

function killWindowsTree(child, lifetime, sync, now) {
  if (known(lifetime?.exitedAt) && !known(lifetime?.startedAt)) {
    throw new Error(`cannot search what pid ${child.pid} left behind: when it started is not known, and a pid alone does not name its children`);
  }
  const snapshot = takeSnapshot({ spawnSync: sync });
  const root = resolveRoot(snapshot, { pid: child.pid, startedAt: lifetime?.startedAt, exitedAt: lifetime?.exitedAt }, { now: now() });
  const createdAt = new Map(snapshot.map((entry) => [entry.pid, entry.createdAt]));
  const targets = selectDescendants(snapshot, root).map((pid) => ({ pid, createdAt: createdAt.get(pid) }));
  return killProcesses(targets, { spawnSync: sync });
}

/** Kills `child` and everything it started. `lifetime` is what the caller measured of it: `{ startedAt }`, the
 * `Date.now()` taken just before the spawn, and `exitedAt` once it has exited. Windows: only processes the
 * snapshot proves descend from it are killed, each one on its own (see the top of this file); a lookup that
 * failed throws. POSIX: the child leads its own process group, which is killed. `spawnSync`, `kill` and
 * `now` are injectable. */
export function killTree(child, lifetime, { platform = process.platform, spawnSync: sync = spawnChildSync, kill = process.kill, now = Date.now } = {}) {
  if (!child?.pid) {
    if (platform === 'win32') child?.kill?.();
    return;
  }
  if (platform !== 'win32') killPosixGroup(child, kill);
  else killWindowsTree(child, lifetime, sync, now);
}

/** Kills what a child that has already exited left behind (or, for one still running, the child and its tree).
 * POSIX: the group outlives its leader, so the group kill still reaches it. Windows: the root's pid is no
 * longer anyone's, so its descendants are the processes created during its life that record it, and theirs
 * (`selectDescendants`); this needs `lifetime.startedAt` and throws without it. */
export function killSurvivors(child, lifetime, { platform = process.platform, spawnSync: sync = spawnChildSync, kill = process.kill, now = Date.now } = {}) {
  if (!child?.pid) return;
  if (platform !== 'win32') {
    killPosixGroup(child, kill);
    return;
  }
  if (!known(lifetime?.startedAt)) {
    throw new Error(`cannot search what pid ${child.pid} left behind: when it started is not known, and a pid alone does not name its children`);
  }
  killWindowsTree(child, lifetime, sync, now);
}

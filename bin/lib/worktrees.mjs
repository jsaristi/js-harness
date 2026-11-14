// The worktrees a repository can lose with nothing lost (odd/tasks/land-unattended.md, T9 and T10): those on a
// branch already in main, clean and idle. Left behind by every landed pull request, they slowed every command that
// lists them: 151 of 184 were such worktrees, and the board took 126 s over them (L22).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { COMMAND_KEYWORDS, shellWords } from './guard.mjs';

/** The minutes a worktree's index must have stood still before the worktree is removed: a session that staged
 * something a moment ago may be about to commit there. */
const IDLE_MINUTES = 10;

/** `git worktree list --porcelain` as `{ path, head, branch, locked, lockReason, prunable }` entries, the main worktree
 * first; `branch` is the short name, `null` for a detached head, `lockReason` what the lock says, `''` when it says
 * nothing or there is none. */
function worktreesOf(porcelain) {
  return porcelain.replace(/\r\n/g, '\n').split('\n\n').map((block) => block.split('\n').filter(Boolean)).filter((lines) => lines.length > 0).map((lines) => {
    const value = (key) => lines.find((line) => line === key || line.startsWith(`${key} `))?.slice(key.length + 1) ?? null;
    const branch = value('branch');
    return {
      path: value('worktree'),
      head: value('HEAD'),
      branch: branch === null ? null : branch.replace(/^refs\/heads\//, ''),
      locked: lines.some((line) => line === 'locked' || line.startsWith('locked ')),
      lockReason: value('locked') ?? '',
      prunable: lines.some((line) => line === 'prunable' || line.startsWith('prunable ')),
    };
  });
}

/** Whether `dir` is another app's worktree, which that app manages and removes: under `.claude/worktrees` (the Claude
 * app) or `orca/workspaces` (the Orca app, which leaves no marker of its own in the worktree; T11). */
const appsOwn = (dir) => /(^|\/)(\.claude\/worktrees|orca\/workspaces)\//i.test(`${dir.replace(/\\/g, '/')}/`);

/** Two paths of one folder, as git and a caller may spell them differently on Windows. */
export const sameFolder = (a, b) => {
  const plain = (dir) => path.resolve(dir).replace(/\\/g, '/').replace(/\/$/, '');
  return process.platform === 'win32' ? plain(a).toLowerCase() === plain(b).toLowerCase() : plain(a) === plain(b);
};

/** The files claude writes into a worktree it makes, which are not a session's work: its copy of the checkout's local
 * settings, in every one of the 27 worktrees of background sessions measured on 2026-11-11
 * (odd/tasks/sessions-close-themselves.md). Left out of the rule only for the worktree of a finished session
 * `js-harness sessions start` recorded: there it holds the permissions of a session that ended. */
export const HOST_FILES = ['.claude/settings.local.json'];

/** The linked worktrees git lists for the repository at `cwd`, as `worktreesOf` reads them, and `here`, the one `cwd`
 * is in: `{ linked, here }`, or `null` when git cannot list them. */
export function linkedWorktrees(cwd, gitIn) {
  const listed = gitIn(cwd, 'worktree', 'list', '--porcelain');
  if (!listed.ok) return null;
  const [, ...linked] = worktreesOf(listed.out);
  return { linked, here: gitIn(cwd, 'rev-parse', '--show-toplevel').out.trim() };
}

/** Why the worktree `tree` (an entry of `linkedWorktrees`) cannot be removed with nothing lost, or `null` when it
 * can: it is on a branch, not locked, with a head `base` holds, a `git status` clean of ignored files too, and an index
 * unchanged for `idleMinutes`. `hostFiles` names the ignored files that do not count; `baseName` is `base` in words.
 * The cheap questions are asked first: a `git status` in each of a hundred worktrees is what this exists to spare.
 * `ownLock(tree)` says a lock is the caller's own to release, which then keeps nothing: nobody else's ever is.
 * `gitIn(dir, ...args)` answers `{ ok, out }`. */
export function worktreeKept(tree, { cwd, base, baseName = 'main', gitIn, now = Date.now, idleMinutes = IDLE_MINUTES, hostFiles = [], ownLock = () => false }) {
  if (!tree.path || !tree.head) return 'git names no folder or no head for it';
  if (tree.branch === null) return 'it is on no branch';
  if (tree.locked && !ownLock(tree)) return `it is locked${tree.lockReason ? `: ${tree.lockReason}` : ''}`;
  if (tree.prunable) return 'git lists it as prunable';
  if (!gitIn(cwd, 'merge-base', '--is-ancestor', tree.head, base).ok) return `its head is not in ${baseName}`;
  const index = gitIn(tree.path, 'rev-parse', '--git-path', 'index');
  let changed;
  try {
    if (!index.ok) throw new Error('no index');
    changed = fs.statSync(path.resolve(tree.path, index.out.trim())).mtimeMs;
  } catch {
    // No index read is no proof that it stood still.
    return 'its index could not be read';
  }
  const idle = Math.floor((now() - changed) / 60_000);
  if (now() - changed < idleMinutes * 60_000) return `its index changed ${idle} minute${idle === 1 ? '' : 's'} ago, under the ${idleMinutes} a removal waits for`;
  // Ignored files too: `git worktree remove` takes them with it, and no branch brings an eval run or a `.env` back
  // (Codex, 2026-10-17, P1).
  const status = gitIn(tree.path, 'status', '--porcelain', '--ignored');
  if (!status.ok) return 'git status could not run in it';
  const held = status.out.split(/\r?\n/).filter((line) => line.trim() !== '' && !hostOnly(line, tree.path, hostFiles)).map((line) => line.trim());
  if (held.length === 0) return null;
  return `it holds what no branch brings back: ${held.slice(0, 3).join(', ')}${held.length > 3 ? ` and ${held.length - 3} more` : ''}`;
}

/** Whether the `git status --porcelain --ignored` line `line` of the worktree at `dir` names only files of
 * `hostFiles`: one of them, or a folder git reports whole because all of it is ignored, when those files are all it
 * holds (a project that tracks nothing under `.claude`). A folder that cannot be read counts as holding more. */
function hostOnly(line, dir, hostFiles) {
  if (hostFiles.some((file) => line === `!! ${file}`)) return true;
  const folder = /^!! (.+\/)$/.exec(line)?.[1];
  if (folder === undefined || !hostFiles.some((file) => file.startsWith(folder))) return false;
  try {
    const files = fs.readdirSync(path.join(dir, folder), { recursive: true, withFileTypes: true }).filter((entry) => !entry.isDirectory());
    return files.length > 0 && files.every((entry) => hostFiles.includes(path.relative(dir, path.join(entry.parentPath, entry.name)).replace(/\\/g, '/')));
  } catch {
    return false;
  }
}

/** The linked worktrees of the repository at `cwd` that can be removed with nothing lost (`worktreeKept`), as
 * `{ path, branch }`, or `null` when git cannot list them: on a branch (in `branches`, when given), outside
 * `.claude/worktrees` and not the one `cwd` is in. */
export function removableWorktrees({ cwd, base, branches = null, gitIn, now = Date.now, idleMinutes = IDLE_MINUTES }) {
  const listed = linkedWorktrees(cwd, gitIn);
  if (listed === null) return null;
  const found = [];
  for (const tree of listed.linked) {
    if (!tree.path || tree.branch === null) continue;
    if (branches !== null && !branches.has(tree.branch)) continue;
    if (appsOwn(tree.path) || (listed.here && sameFolder(tree.path, listed.here))) continue;
    if (worktreeKept(tree, { cwd, base, gitIn, now, idleMinutes }) === null) found.push({ path: tree.path, branch: tree.branch });
  }
  return found;
}

/** How long one git call of `boundedGit` may run before it is killed. */
const GIT_TIMEOUT_MS = 20_000;

/** A `gitIn(dir, ...args)` over `run` that answers `{ ok, out, err }`, each call bounded by `timeout`, `GIT_TIMEOUT_MS`
 * unless given, as the heartbeat bounds its commands: one that hangs counts as a no (T11). That bound is for a
 * question; a call that deletes is given a longer one, since killing it part-way leaves a folder half removed. */
export function boundedGit(run = spawnSync, timeout = GIT_TIMEOUT_MS) {
  return (dir, ...args) => {
    // No optional locks: a `git status` killed at its limit would otherwise leave an index.lock that breaks a worktree
    // that was only slow (a review, 2026-10-17, R4).
    const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
    const result = run('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true, timeout, env });
    return { ok: !result?.error && result?.status === 0, out: String(result?.stdout ?? ''), err: String(result?.stderr || result?.error?.message || '').trim() };
  };
}

/** The worktrees `removableWorktrees` gives against origin/main as this clone last fetched it, whatever landed their
 * branches, or `null` when git cannot say: what `doctor` counts, with no fetch of its own (T10), each git call bounded
 * (`boundedGit`). */
export function worktreesInMain({ cwd, run = spawnSync, now = Date.now }) {
  const gitIn = boundedGit(run);
  const base = gitIn(cwd, 'rev-parse', '--verify', '--quiet', 'origin/main').out.trim();
  return base ? removableWorktrees({ cwd, base, gitIn, now }) : null;
}
// The commands that move the shell to another folder, and the options they take before it.
// Compared in lower case, as PowerShell takes them in any case; `builtin` and `command` may stand before one.
const CD_COMMANDS = new Set(['cd', 'pushd', 'chdir', 'set-location', 'sl']);
const CD_PREFIXES = new Set(['builtin', 'command']);
const CD_OPTIONS = /^-(?:[LPe@]+|Path|LiteralPath)$/i;
// PowerShell's option and its folder in one word: `-Path:<dir>`.
const CD_JOINED = /^-(?:Path|LiteralPath):(.+)$/i;

/** A folder as a forward-slash path, a Git Bash drive (`/d/x`) as Windows writes it (`D:/x`), `..` and `.` resolved
 * against `cwd` for a relative one; lower case, so two spellings of one Windows folder compare equal. The platform's
 * own `path` is not used: the gate's tests run on Linux with Windows paths. `~`, `$HOME` and `${HOME}` stand for
 * `home` where it is given, since worktrees live under it (the verifier on 0444b5de); `null` for `-` and for a
 * home not given, which name no folder a command can tell. */
function folderOf(target, cwd, home = null) {
  if (target === '' || target === '-') return null;
  const homed = /^(?:~|\$HOME|\$\{HOME\})(?=[\\/]|$)/;
  if (homed.test(target)) {
    if (home === null) return null;
    target = target.replace(homed, home);
  } else if (target.startsWith('~')) return null;
  const slashed = (dir) => dir.replace(/\\/g, '/').replace(/^\/([A-Za-z])(?=\/|$)/, '$1:');
  let full = slashed(target);
  if (!/^[A-Za-z]:/.test(full) && !full.startsWith('/')) full = `${slashed(cwd)}/${full}`;
  const parts = [];
  for (const part of full.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `${full.startsWith('/') ? '/' : ''}${parts.join('/')}`.toLowerCase();
}

/** Whether the folder `dir` is `tree` or inside it, both as `folderOf` gives them. */
const within = (dir, tree) => dir === tree || dir.startsWith(`${tree}/`);

/** Why the Bash command `command`, run in `cwd`, is refused for moving into another session's worktree, or null: a
 * `cd`, `pushd` or `Set-Location` that starts a command and names a folder inside a linked worktree of the repository
 * other than the one `cwd` is in. On 2026-11-13 the lead did this twice (relief file, lines 2654 and 2695): the next
 * commands of a session then run on another session's branch. A hook cannot list the app's sessions, so every other
 * linked worktree counts, the lead's choice of 2026-11-13 (odd/tasks/audit-cement.md, L3). `worktrees()` gives
 * `{ linked, here }` as `linkedWorktrees` of ./worktrees.mjs does, or null when git cannot say; it is asked only
 * when the command moves, and a null refuses nothing. */
export function worktreeCdRefusal(command, { cwd, worktrees, home = null }) {
  const words = shellWords(command, { groups: true });
  const { operators } = words;
  const targets = [];
  // Where the shell may stand at each cd. A cd in a subshell, a background job or before a || that fails leaves the
  // parent where it was, so a relative cd is resolved from every folder named before it, whatever operator came
  // between (Codex on 8bbbdbf3): one that lands in another worktree is enough. After `;` or `&&` this refuses more
  // than the shell would do (`cd D:/elsewhere/sub && cd ../other` from a worktree beside `other`), the safe side: such
  // a command runs as two calls, or with an absolute path.
  const places = new Set([folderOf(cwd, cwd)]);
  for (let i = 0; i < words.length; i += 1) {
    const atStart = i === 0 || operators.has(i - 1) || (!operators.has(i - 1) && COMMAND_KEYWORDS.has(words[i - 1]) && (i === 1 || operators.has(i - 2)));
    if (!atStart || operators.has(i)) continue;
    const named = CD_PREFIXES.has(words[i]) && i + 1 < words.length && !operators.has(i + 1) ? i + 1 : i;
    if (!CD_COMMANDS.has(words[named].toLowerCase())) continue;
    let at = named + 1;
    let given = null;
    while (at < words.length && !operators.has(at) && given === null && (CD_OPTIONS.test(words[at]) || CD_JOINED.test(words[at]))) {
      given = CD_JOINED.exec(words[at])?.[1] ?? null;
      at += 1;
    }
    if (given === null && words[at] === '--' && !operators.has(at)) at += 1;
    if (given === null && (at >= words.length || operators.has(at))) continue;
    const folder = given ?? words[at];
    const reached = [...places].map((place) => folderOf(folder, place, home)).filter((target) => target !== null);
    targets.push(...reached);
    for (const target of reached) places.add(target);
  }
  if (targets.length === 0) return null;
  const listed = worktrees();
  if (listed === null || listed === undefined) return null;
  // The session's own worktree is the one git says `cwd` is in, or, where git gives none or another, the one `cwd`
  // stands inside (lenses on 8bbbdbf3): a cd within it is never refused.
  const here = listed.here ? folderOf(listed.here, cwd) : null;
  const start = folderOf(cwd, cwd);
  const own = (dir) => dir === here || within(start, dir);
  for (const target of targets) {
    const tree = listed.linked.map((dir) => folderOf(dir, cwd)).find((dir) => dir !== null && within(target, dir) && !own(dir));
    if (tree === undefined) continue;
    return `js-harness guard: this command moves into ${tree}, another session's worktree: the commands after it would `
      + 'run on that session\'s branch, and its files are its own. Read it from where you are instead: '
      + '`git show <branch>:<path>` for a file of its branch, `git -C <worktree> <command>` for a git question, or the '
      + 'file\'s absolute path to Read.';
  }
  return null;
}


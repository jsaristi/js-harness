// The `init` engine: writes the committed per-project files (harness.json, AGENTS.md, the
// pre-commit gate), runs `codegraph init`, and records everything in a project manifest so T3's
// `uninstall` can restore the repo exactly — see odd/tasks/project-init.md, "T2 design". Like
// manifest.mjs's install/sync engine, this stays pure-ish over injectable `deps`
// (`spawn`/`platform`/`writeFile`/`rm`/`open`/`write`/`close`) so tests never touch a real home, a
// real `codegraph`, or this repo itself — `rm` in particular lets a test make one specific removal
// fail (a rollback, or the best-effort `.codegraph/` cleanup) without any OS-specific trick to
// reproduce it. `open`/`write`/`close` are the manifest's own exclusive-create write, injected
// separately from the general `writeFile` so a test (or `writeManifestAtomic` itself) can tell the
// exclusive create failing apart from something failing after it succeeded — see there.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { sha256 } from './manifest.mjs';
import { tools } from './stack.mjs';

/** Resolves the git top-level of `cwd`, or `null` outside a git repository (missing `git`, a
 * non-zero exit, or any thrown spawn error all count as "not a repo" here). Callers must check
 * `cwd` itself exists first — a missing `cwd` is a different, more specific error (see
 * `initProject`'s `noSuchDirectory` result; T2b R3-nonexistent-cwd-misreported). */
export function gitTopLevel(cwd, spawn = spawnSync) {
  let result;
  try {
    result = spawn('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  } catch {
    return null;
  }
  if (!result || result.error || result.status !== 0 || !result.stdout) return null;
  return result.stdout.trim();
}

/** Resolves one `git rev-parse --git-path <relPath>` target for the repo at `root`, run with
 * `root` as the child's cwd so it honours `core.hooksPath` and any other path override the same
 * way git itself does. The result is usually already relative to `root`, but is resolved against
 * it explicitly rather than assumed, per "T2 design"; an absolute result (a hooksPath outside the
 * repo, for instance) is returned as-is. `null` on any git failure. */
export function resolveGitPath(root, relPath, spawn = spawnSync) {
  let result;
  try {
    result = spawn('git', ['rev-parse', '--git-path', relPath], { cwd: root, encoding: 'utf8' });
  } catch {
    return null;
  }
  if (!result || result.error || result.status !== 0 || !result.stdout) return null;
  const raw = result.stdout.trim();
  return path.isAbsolute(raw) ? raw : path.resolve(root, raw);
}

/** `absolute`, relative to `root`, with forward slashes — the shape the manifest and reports use
 * regardless of host OS. Only meaningful for a path actually under `root`. */
function toRepoRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

/** `absolute`, with forward slashes, host OS regardless — the shape used for a path that is *not*
 * under `root` (an outside hooks path has no repo-relative form to report). */
function toForwardSlashes(absolute) {
  return absolute.split(path.sep).join('/');
}

/** The path shape a manifest `files`/`dirs`/rollback-failure entry uses for something at
 * `absolute`: repo-relative when it sits under the working tree, or an absolute forward-slashed
 * path otherwise — the shape T2e item 4 gives anything recorded from inside a git dir outside the
 * working tree (a linked worktree's shared hooks, a submodule). Callers that already know
 * containment (via `resolveHookContainment`) pass `isWorkingTree` directly; `rollback`'s
 * best-effort failure report instead derives it lexically (see `notRemovedLabel`), since by the
 * time a removal fails there is no need to re-resolve symlinks — the path was written by this run,
 * so its lexical relationship to `root` is already known-good. */
function pathShapeFor(root, absolute, isWorkingTree) {
  return isWorkingTree ? toRepoRelative(root, absolute) : toForwardSlashes(absolute);
}

/** The manifest `files`/`dirs` shape isn't just a string: a working-tree entry is plain, a git-dir
 * one carries `gitDir: true` alongside it (T2e item 4). `sha256` is omitted for a directory entry. */
function manifestEntry(root, absolute, isWorkingTree, sha256Hash) {
  const entry = { path: pathShapeFor(root, absolute, isWorkingTree) };
  if (sha256Hash !== undefined) entry.sha256 = sha256Hash;
  if (!isWorkingTree) entry.gitDir = true;
  return entry;
}

/** True when something already sits at `target` — an ordinary file/directory, or a symlink even
 * when it is dangling. Unlike `fs.existsSync`, which follows a symlink and reports `false` for a
 * broken one, this treats the symlink itself as occupying its path: writing through it (creating a
 * new file at wherever it happens to point, possibly outside the repo entirely) would silently
 * replace or escape past something a person deliberately placed there (T2d Codex P1 +
 * R3-realish-dangling-symlink-escape). */
function isOccupied(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch {
    return false;
  }
}

/** Splits an already-`path.resolve`d absolute path into its filesystem root (`D:\` on win32, `/`
 * on posix) and the ordered list of segments between the root and the path itself. */
function splitFromRoot(resolved) {
  const root = path.parse(resolved).root;
  const segments = [];
  let current = resolved;
  while (current !== root) {
    segments.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break; // defensive: should not happen once current !== root
    current = parent;
  }
  return { root, segments };
}

/** Resolves `target` to a real, fully symlink-followed absolute path, one path segment at a time
 * from the filesystem root down — unlike `fs.realpathSync`, this never requires the final path (or
 * any ancestor) to actually exist. A segment that isn't there at all is appended lexically from
 * that point on; a symlink — even a dangling one — is followed via `fs.readlinkSync` (a relative
 * target resolved against the link's own directory) instead of being treated as an ordinary,
 * non-existent path component. That distinction is the whole point: the old "walk up to the
 * nearest `fs.existsSync` ancestor" approach saw a dangling symlink and a plain missing directory
 * as the same thing, silently ignoring where the symlink actually points (T2d Codex P1 +
 * R3-realish-dangling-symlink-escape).
 *
 * Also returns `hadSymlink`, true when a symlink hop happened *at or below* one of `bases` (each
 * already a real, `fs.realpathSync`-resolved absolute directory) — never for a hop that resolves
 * one of `bases` itself, or anything above it. Occupying a hooks path is a property of what sits
 * inside the repository (or its git dir): a symlink the repository merely happens to be reached
 * through — a symlinked drive, macOS's `/tmp` → `/private/tmp` — says nothing about that, and must
 * never make an otherwise-untouched hooks path look occupied (T2e item 5,
 * R3-realish-flags-symlinks-above-repo-root). With no `bases` given, every hop counts, matching the
 * plain full-walk behaviour this function always had.
 *
 * "At or below a base" is checked with `isWithinBase` (at-or-below containment, not exact string
 * equality with `current`) at the start of every segment *and* again after every individual hop
 * within it — a chain of symlinks resolved for a single segment can land squarely inside a base
 * without `current` ever having been exactly that base's own path along the way, and every hop
 * from that point on must still count (T2f item 3, R3-realish-base-detection-equality-only). */
function realish(target, bases = []) {
  const { root, segments } = splitFromRoot(path.resolve(target));
  let current = root;
  let hadSymlink = false;
  let countHops = bases.length === 0;
  let hops = 0;
  const maybeEnterBase = (p) => {
    if (!countHops && bases.some((base) => isWithinBase(base, p))) countHops = true;
  };
  maybeEnterBase(current);
  for (const segment of segments) {
    let next = path.join(current, segment);
    maybeEnterBase(next);
    for (;;) {
      let stat;
      try {
        stat = fs.lstatSync(next);
      } catch {
        break; // nothing here at all — this and every later segment is appended lexically
      }
      if (!stat.isSymbolicLink()) break;
      if (countHops) hadSymlink = true;
      hops += 1;
      if (hops > 40) return { real: target, hadSymlink }; // defensive: a symlink loop
      const linkTarget = fs.readlinkSync(next);
      next = path.isAbsolute(linkTarget) ? path.normalize(linkTarget) : path.resolve(path.dirname(next), linkTarget);
      maybeEnterBase(next); // the hop's own destination may itself already be inside a base
    }
    current = next;
  }
  return { real: current, hadSymlink };
}

/** `p`'s real, symlink-resolved form, or `p` itself when it doesn't exist or can't be resolved (a
 * `--git-dir`/`--git-common-dir` git failed to report, say) — never throws. `null` in, `null` out. */
function safeRealpath(p) {
  if (!p) return null;
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

/** Whether `absolute` is `base` itself or a descendant of it. Case-insensitive on win32 (git's own
 * output and `fs.realpathSync`'s do not always agree on the case of a drive letter or a segment —
 * T2f item 3, R3-realish-base-detection-equality-only), exact everywhere else. Folding both sides
 * to the same case before `path.relative` changes nothing about the *structure* it reports (segment
 * boundaries, `..` counts), only whether two same-place segments compare equal. */
function isWithinBase(base, absolute) {
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  return !isOutsideRelative(path.relative(fold(base), fold(absolute)));
}

/** The first of `bases` that contains `absolute` (itself or a descendant), or `null` when none do.
 * Used both for the real, symlink-resolved containment check and for the lexical (unresolved) one
 * that `resolveHookContainment` compares it against to tell a genuinely outside `core.hooksPath`
 * from one only a symlink sent outside (T2e item 7). */
function containingBase(absolute, bases) {
  return bases.find((base) => isWithinBase(base, absolute)) ?? null;
}

/** True when a `path.relative` result places its target outside the directory it was computed
 * against: exactly `..`, starting with `..` followed by a path separator, or absolute (a different
 * drive on Windows resolves to an absolute path here rather than a `..`-prefixed one). A directory
 * whose name merely *starts* with two dots, like `..hooks`, is not outside — `"..hooks".startsWith`
 * `("..")` is true but `"..hooks"` is a perfectly ordinary single path segment (T2c Codex P2). */
function isOutsideRelative(rel) {
  if (path.isAbsolute(rel)) return true;
  if (rel === '..') return true;
  return rel.startsWith(`..${path.sep}`) || rel.startsWith('../');
}

/** Resolves the repository's own git dir and its common git dir (`git rev-parse --git-dir` /
 * `--git-common-dir`, each resolved relative to `root` exactly like `resolveGitPath` does — an
 * absolute result, from a hooksPath-style override, is kept as-is). In an ordinary repository both
 * equal `<root>/.git`; in a linked worktree `gitDir` is that worktree's own per-worktree directory
 * (`<main>/.git/worktrees/<name>`) while `commonGitDir` is the main repository's shared `.git` —
 * where hooks actually live, since hooks are common, not per-worktree (T2e item 4,
 * R3-worktree-submodule-hook-misclassified-outside). A submodule's own `.git` file points its git
 * dir at `<superproject>/.git/modules/<name>`, outside the submodule's own working tree the same
 * way. Either result is `null` on a git failure, in which case `resolveHookContainment` falls back
 * to judging containment against the working tree alone, same as before this item. */
export function gitDirs(root, spawn = spawnSync) {
  return {
    gitDir: revParseAbsolute(root, '--git-dir', spawn),
    commonGitDir: revParseAbsolute(root, '--git-common-dir', spawn),
  };
}

function revParseAbsolute(root, flag, spawn) {
  let result;
  try {
    result = spawn('git', ['rev-parse', flag], { cwd: root, encoding: 'utf8' });
  } catch {
    return null;
  }
  if (!result || result.error || result.status !== 0 || !result.stdout) return null;
  const raw = result.stdout.trim();
  return path.isAbsolute(raw) ? raw : path.resolve(root, raw);
}

/** Whether `hookPath` (already resolved via `resolveGitPath`) is actually inside the repository,
 * following symlinks (dangling ones included) on both sides first (T2c Codex P1 symlink; T2d Codex
 * P1 + R3-realish-dangling-symlink-escape) so a hooks path that is, or sits behind, a symlink
 * pointing outside is correctly seen as outside. "Inside" means inside the real working tree *or*
 * the real git dir/common git dir from `gitDirs` (T2e item 4) — a worktree or submodule keeps its
 * shared hooks outside the working tree entirely, and that is still this run's to write.
 *
 * `real` is the fully resolved location, reported when outside since that is where the user would
 * actually need to add the check themselves. `occupied` is true when the (unresolved) `hookPath`
 * itself must never be written to — either an ordinary lstat hit (a real file, or any symlink,
 * dangling or not, right there) or a symlink at or below whichever base contains it (`hadSymlink`,
 * never counting a symlink above that base — T2e item 5, R3-realish-flags-symlinks-above-repo-root):
 * writing through either could replace something a person put there or, for a dangling ancestor,
 * fail unpredictably deep inside a broken chain. `isWorkingTree` says which base actually contains
 * it, so a caller can choose the manifest's repo-relative-vs-absolute path shape (item 4); `base`
 * is that same winning base's real absolute path (`null` when outside), so a caller can bound a
 * directory-creation walk by the base that actually contains the directory rather than always the
 * working tree (T2f item 2: `shallowestMissingAncestor` bounded by `root` alone stopped instantly
 * for a hooks directory in a git dir outside the working tree, recording only the deepest missing
 * directory and leaking its newly created parents on rollback/uninstall). `viaLink` is set only
 * when the result is outside *because of* a symlink: the lexical (unresolved) hook path was already
 * inside some base, and a symlink in its chain is what sent it outside — as opposed to the
 * configured location itself (`core.hooksPath`, or the default) being outside from the start, with
 * no symlink involved in that verdict (T2e item 7). */
function resolveHookContainment(root, hookPath, gitBases = {}) {
  const realRoot = fs.realpathSync(root);
  const realGitDir = safeRealpath(gitBases.gitDir);
  const realCommonGitDir = safeRealpath(gitBases.commonGitDir);
  const realBases = [realRoot, realGitDir, realCommonGitDir].filter(Boolean);

  const lexicalBases = [path.resolve(root), gitBases.gitDir, gitBases.commonGitDir].filter(Boolean);
  const lexicalOutside = containingBase(path.resolve(hookPath), lexicalBases) === null;

  const { real, hadSymlink } = realish(hookPath, realBases);
  const containingRealBase = containingBase(real, realBases);
  const outside = containingRealBase === null;
  const occupied = !outside && (hadSymlink || isOccupied(hookPath));
  const isWorkingTree = containingRealBase === realRoot;
  const viaLink = outside && !lexicalOutside;
  return { real, outside, occupied, isWorkingTree, viaLink, base: containingRealBase };
}

/** The base `AGENTS.md` template `init` writes when a project has none of its own: short (this
 * file loads on every turn — see "T2 design"), titled with the project's own folder name, with the
 * same sections this repo's own AGENTS.md carries. Placeholder prompts are left in angle brackets
 * for the project to fill in. */
export function agentsTemplate(root) {
  const name = path.basename(path.resolve(root));
  return `<!-- Written by \`js-harness init\`. This file loads on every turn: keep it short. -->
# ${name}

## What this project is
<what this project does, and who it is for, in one or two lines>

## How it works
<where the code lives>. The single command that checks a change: \`<command>\`.

## What good looks like
A behavior change arrives with the test that proves it, written first. A claim about this
project carries its evidence.

## Constraints
- <a real constraint> — <the reason behind it>
`;
}

const PRE_COMMIT_HOOK =
  '#!/bin/sh\n# Written by js-harness init; js-harness uninstall removes it.\nexec js-harness check\n';

/** codegraph's own fix command, reused from `stack.mjs`'s tool table (never `codegraph upgrade` —
 * user rule) instead of a second copy of it living here. */
function codegraphFixCommand() {
  const tool = tools.find((t) => t.id === 'codegraph');
  return tool.fix({}).installed;
}

function codegraphDirPath(root) {
  return path.join(root, '.codegraph');
}

/** Spawns `codegraph init --yes .` with `root` as the child's own cwd — never the root path
 * embedded in the command line, so nothing about it needs shell-quoting or can be mis-expanded
 * (T2b Codex P2: cross-drive/space paths broke the old `--yes "<root>"` form). Otherwise spawns the
 * way `stack.mjs`'s `probeVersionCommand` spawns a version probe: on win32 one joined command line
 * through `shell: true` with no args array (Node 24 warns (DEP0190) on stderr otherwise); elsewhere
 * a plain argv with no shell. Never throws: a missing binary or a non-zero exit both come back as
 * `{ ok: false, reason }`. */
export function runCodegraphInit(root, { spawn = spawnSync, platform = process.platform } = {}) {
  const shell = platform === 'win32';
  let result;
  try {
    if (shell) {
      result = spawn('codegraph init --yes .', [], { encoding: 'utf8', shell: true, cwd: root });
    } else {
      result = spawn('codegraph', ['init', '--yes', '.'], { encoding: 'utf8', shell: false, cwd: root });
    }
  } catch (err) {
    return { ok: false, reason: err.message };
  }
  if (!result || result.error) return { ok: false, reason: result?.error?.message ?? 'codegraph init failed' };
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    return { ok: false, reason: detail || `codegraph init exited ${result.status}` };
  }
  return { ok: true };
}

/** Runs (or re-runs) codegraph's init step and reports the manifest fragment for it. Every caller
 * only invokes this when `.codegraph/` was absent beforehand, so `createdDir` — always what
 * `fs.existsSync` observes right after the run, whether it succeeded or failed — truthfully
 * attributes the directory's presence (or absence) to *this* run. A run that fails partway through
 * after already writing `.codegraph/` is not silently recorded as having created nothing (T2d
 * Codex P2 codegraph ownership); a run that reports success without writing it is not credited with
 * creating it either (T2b Codex P2 + R3-codegraph-createdDir-unverified). */
function initCodegraph(root, spawn, platform) {
  const result = runCodegraphInit(root, { spawn, platform });
  const createdDir = fs.existsSync(codegraphDirPath(root));
  if (result.ok) {
    return { manifest: { createdDir, status: 'ok' } };
  }
  return {
    manifest: { createdDir, status: 'failed' },
    reason: `${result.reason} — fix: ${codegraphFixCommand()}`,
  };
}

/** Writes `data` to `target` atomically: serialized to a uniquely-named `.tmp` sibling first
 * (`<target>.<pid>.<random>.tmp`, created exclusively with `flag: 'wx'` so it is always a brand
 * new file — never opened through something already there, ordinary file or link, T2e item 3),
 * then a single rename over `target`, so a reader never sees a partially-written manifest and a
 * failure never corrupts or truncates whatever was there before. `target` itself is never touched
 * directly — matters most for the codegraph-retry update, which must not lose an existing, valid
 * manifest just because this write failed partway through (T2d Codex P2 atomic manifest writes).
 *
 * `deps` (`{ open, write, close }`, each independently injectable, defaulting to real
 * `fs.openSync(path, 'wx')` / `fs.writeSync(fd, content)` / `fs.closeSync(fd)`) is split into these
 * three steps, rather than one opaque `writeFile(path, content, options)` call, specifically so
 * this function can tell "the exclusive create itself never happened" (`open` throws — `EEXIST` or
 * anything else; `tmp` is not ours to touch) apart from "the create succeeded, and something *after*
 * it failed" (`write`, `close`, or the rename below; `tmp` exists and is this call's own file, so
 * it is removed). A single combined call (the old `writeFile(tmp, content, {flag:'wx',...})` shape)
 * cannot make that distinction from the outside — whatever it does internally, its caller only ever
 * sees "it threw" or "it didn't" (T2g R3-001, Codex P2: moving that one call outside the try/catch
 * correctly stopped deleting a foreign file on `EEXIST`, per T2f item 1, but then left this call's
 * *own* just-created file leaking on a write failure that happens after the open — e.g. `ENOSPC`,
 * `EIO` partway through filling it). Splitting `open` out as its own step means only *its* own
 * failure is ambiguous-ownership territory; every failure after it succeeds is unambiguously this
 * call's to clean up. */
function writeManifestAtomic(target, data, deps = {}) {
  const open = deps.open ?? ((p) => fs.openSync(p, 'wx'));
  const write = deps.write ?? ((fd, content) => fs.writeSync(fd, content));
  const close = deps.close ?? ((fd) => fs.closeSync(fd));

  const tmp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const content = JSON.stringify(data, null, 2) + '\n';

  const fd = open(tmp); // if this throws, nothing was created by this call — tmp is not ours to touch
  try {
    write(fd, content);
    close(fd);
  } catch (err) {
    try {
      close(fd);
    } catch {
      // Best-effort; `fd` may already be closed or invalid depending on how `write` failed.
    }
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Best-effort cleanup; `err` is still the one thrown below regardless.
    }
    throw err;
  }

  try {
    fs.renameSync(tmp, target);
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Best-effort cleanup; `target` was never written to directly, so it is untouched regardless.
    }
    throw err;
  }
}

/** `gitDir: true` alongside an absolute forward-slashed `path` marks an entry recorded from inside
 * a git dir outside the working tree (T2e item 4); everything else stays the plain repo-relative
 * shape these actions have always used. */
function wrote(relPath, hash, gitDir = false) {
  const entry = { kind: 'wrote', path: relPath, sha256: hash };
  if (gitDir) entry.gitDir = true;
  return entry;
}

/** `outside: true` marks an entry whose `path` is an absolute, forward-slashed location that is
 * not under the repository at all (an outside `core.hooksPath` — T2c item 6); `gitDir: true` marks
 * one recorded from inside a git dir outside the working tree instead — contained, just not under
 * `root` (T2e item 4). The two never combine: an outside entry has no repo-relative or git-dir
 * shape to begin with. Every other `kept` entry carries a plain repo-relative `path` and neither
 * field. */
function kept(relPath, reason, outside = false, gitDir = false) {
  const entry = { kind: 'kept', path: relPath, reason };
  if (outside) entry.outside = true;
  if (gitDir) entry.gitDir = true;
  return entry;
}

/** Thrown by `initProject` when a step after the first write fails: everything this run wrote has
 * already been rolled back (best-effort) by the time this is thrown, `.codegraph/` included when
 * this run is the one that created it (T2e item 2, R3-retry-manifest-failure-loses-codegraph-ownership
 * — the manifest that would have recorded owning it never made it to disk, so nothing is left
 * unrecorded). `notRemoved` lists whatever could not be cleaned up (repo-relative, or absolute
 * forward-slashed for something written into a git dir outside the working tree — T2e item 4),
 * empty when the rollback was complete. */
export class InitWriteError extends Error {
  constructor(message, notRemoved = []) {
    super(message);
    this.name = 'InitWriteError';
    this.notRemoved = notRemoved;
  }
}

/** Walks up from `dir` toward (but never past) `base`, returning the shallowest ancestor that does
 * not exist yet — the top of whatever a later `mkdirSync(dir, { recursive: true })` would actually
 * create. `null` when `dir` itself already exists (nothing would be created — also the common case
 * for a hooks directory in a git dir outside the working tree, since `hooks/` itself usually already
 * exists there: git creates it, complete with sample hooks, the moment the repository itself does).
 * Used so a rollback can remove exactly the directory chain this run made, never a directory that
 * predates it (e.g. `.git/hooks` itself must never be removed).
 *
 * `base` must be whichever real (`fs.realpathSync`-resolved) base actually contains `dir` — the
 * working tree for an ordinary hooks path, but the git dir or common git dir for one outside it (a
 * worktree, a submodule) — never always the working tree root (T2f item 2, Codex P2): bounding a
 * multi-level-missing chain by a base that does not actually contain it must stop the climb before
 * it starts, recording only the single deepest directory rather than leaking its newly created
 * parents on rollback or `uninstall`.
 *
 * The climb itself only ever asks "does this ancestor already exist" (`fs.existsSync`, which on
 * Windows resolves case-insensitively — a missing segment can never *be* a symlink, so no
 * containment question can arise while climbing through it); only once it reaches an ancestor that
 * does exist is `base` containment checked at all, via `isWithinBase` against that existing
 * ancestor's own real, resolved form. Comparing `base` (already real) against `dir` (still
 * lexical — the unresolved `core.hooksPath`, or the default) with a plain case-sensitive
 * `startsWith`, as this used to, silently stops the climb on the very first check whenever the two
 * disagree on case or on an 8.3 short name — which can happen for an *ordinary* working-tree hooks
 * path too, not just one outside it (T2g R3-002, a regression from T2f: a symlinked root, a
 * differently-cased path, or a Windows TEMP directory's short name all reproduce it). When the
 * climb's existing boundary genuinely is not within `base` at all, this falls back to reporting just
 * the leaf (`dir` itself) uncombined — the same degenerate result the old code returned when its very
 * first containment check failed — rather than reporting nothing, so a caller still tracks at least
 * that one directory for rollback. */
function shallowestMissingAncestor(dir, base) {
  if (fs.existsSync(dir)) return null;
  const leaf = path.resolve(dir);
  let current = leaf;
  while (current !== path.dirname(current) && !fs.existsSync(path.dirname(current))) {
    current = path.dirname(current);
  }
  const realExistingParent = safeRealpath(path.dirname(current));
  return isWithinBase(base, realExistingParent) ? current : leaf;
}

/** Creates `dir` (recursively) and, when that actually creates new directories, records the
 * shallowest one in `createdDirs` so a rollback can remove exactly that chain, and returns it (or
 * `null` when nothing was created) so a caller can also report it in the manifest's `dirs` (T2e
 * item 6). `base` is forwarded to `shallowestMissingAncestor` unchanged — see there for why it must
 * be the base that actually contains `dir`, not always the working tree. */
function mkdirTracked(dir, base, createdDirs) {
  const shallow = shallowestMissingAncestor(dir, base);
  fs.mkdirSync(dir, { recursive: true });
  if (shallow) createdDirs.push(shallow);
  return shallow;
}

/** Whether `absolute` sits under the working tree at `root`, purely lexically (no symlink
 * resolution — by the time `rollback` runs, `absolute` is a path this very run wrote, so its
 * relationship to `root` is already known-good). Used only to choose `rollback`'s failure-report
 * shape (repo-relative vs. absolute forward-slashed — T2e item 4), never for containment itself. */
function isUnderRoot(root, absolute) {
  return !isOutsideRelative(path.relative(path.resolve(root), absolute));
}

function notRemovedLabel(root, absolute) {
  return pathShapeFor(root, absolute, isUnderRoot(root, absolute));
}

/** Best-effort rollback of everything a failed run wrote: every tracked file (reverse order, so a
 * later file is removed before an earlier one that might share its directory) and every directory
 * chain this run created. Returns the paths that could not be removed, in the same repo-relative
 * or absolute-forward-slashed shape the manifest itself uses. `rm` defaults to `fs.rmSync` but is
 * injectable, the same way `writeFile` is, so a test can make a specific removal fail without any
 * OS-specific trick (permission bits, a busy handle) to reproduce it. */
function rollback(root, createdPaths, createdDirs, rm = fs.rmSync) {
  const notRemoved = [];
  for (const p of createdPaths.slice().reverse()) {
    try {
      rm(p, { force: true });
    } catch {
      notRemoved.push(notRemovedLabel(root, p));
    }
  }
  for (const d of createdDirs.slice().reverse()) {
    try {
      rm(d, { recursive: true, force: true });
    } catch {
      notRemoved.push(notRemovedLabel(root, d));
    }
  }
  return notRemoved;
}

/** The write phase for a project with no `harness.json` yet and no project manifest yet either
 * (the caller, `initProject`, refuses before reaching here otherwise — see its `staleManifest`
 * check). Writes `AGENTS.md` (if none exists) and the pre-commit gate (if resolvable, contained,
 * and none exists), runs codegraph init, then the project manifest, and only then `harness.json`
 * itself — last, after the manifest that already lists it (T2e item 1): a run killed between the
 * manifest and `harness.json` leaves a manifest with no `harness.json`, which `initProject` refuses
 * to build on (see its `staleManifest` check) exactly like any other stale manifest, so a rerun (or
 * `uninstall`, T3) can resume cleanly instead of tripping over a half-initialized project.
 *
 * Atomic on failure: if any step after the first write throws, every file/directory this run
 * created is removed (best-effort — see `InitWriteError`), `.codegraph/` included when this run is
 * the one that created it (T2e item 2): since the manifest that would have recorded owning it never
 * reaches disk either, nothing is left unrecorded. */
function writeProject(root, version, spawn, platform, writeFile, rm, manifestFilePath, manifestDeps) {
  const createdPaths = [];
  const createdDirs = [];
  const reportedDirs = [];
  let codegraphCreatedThisRun = false;

  try {
    const actions = [];
    const files = [];

    // harness.json: the pin — computed now (its content never depends on anything written after
    // it), but not written until the very end (T2e item 1).
    const harnessJsonPath = path.join(root, 'harness.json');
    const harnessJsonContent = JSON.stringify({ version }, null, 2) + '\n';
    const harnessJsonRel = toRepoRelative(root, harnessJsonPath);
    const harnessJsonHash = sha256(harnessJsonContent);
    files.push({ path: harnessJsonRel, sha256: harnessJsonHash });
    actions.push(wrote(harnessJsonRel, harnessJsonHash));

    // AGENTS.md: only when the project has none of its own. `isOccupied` (not `fs.existsSync`)
    // so a dangling symlink there is kept, not silently written through (T2d item 1).
    const agentsPath = path.join(root, 'AGENTS.md');
    const agentsRel = toRepoRelative(root, agentsPath);
    if (isOccupied(agentsPath)) {
      actions.push(kept(agentsRel, 'exists'));
    } else {
      const content = agentsTemplate(root);
      createdPaths.push(agentsPath);
      writeFile(agentsPath, content, 'utf8');
      const hash = sha256(content);
      files.push({ path: agentsRel, sha256: hash });
      actions.push(wrote(agentsRel, hash));
    }

    // Pre-commit gate: wherever `core.hooksPath` (or the default `.git/hooks`) resolves it to.
    // Never touches git config itself — see "T2 design": setting `core.hooksPath` would silently
    // disable a project's existing `.git/hooks`. Containment is judged against the real working
    // tree *and* the real git dir/common git dir (T2e item 4): a linked worktree or a submodule
    // keeps its shared hooks directory outside the working tree, and that is still this run's to
    // write, recorded by its absolute path with `gitDir: true` rather than a repo-relative one.
    const hookPath = resolveGitPath(root, 'hooks/pre-commit', spawn);
    if (!hookPath) {
      actions.push({ kind: 'skip', path: 'hooks/pre-commit', reason: 'could not resolve the git hooks path' });
    } else {
      const gitBases = gitDirs(root, spawn);
      const {
        real: realHookPath,
        outside: hookOutside,
        occupied: hookOccupied,
        isWorkingTree: hookIsWorkingTree,
        viaLink: hookViaLink,
        base: hookBase,
      } = resolveHookContainment(root, hookPath, gitBases);
      if (hookOutside) {
        // T2b R3-hookspath-outside-repo-written / Codex P2, T2c Codex P1 symlink, T2d dangling
        // symlink: a `core.hooksPath` outside the repo — directly, through an in-repo symlink, or
        // through a dangling one — is never written to; this run does not own that location. The
        // reason names a link only when a link is what actually sent it outside — the configured
        // location itself was lexically contained — never when the configured path (or default)
        // is simply outside from the start (T2e item 7).
        const reason = hookViaLink
          ? 'a link sends the hooks path outside the repository; add `js-harness check` to its pre-commit yourself'
          : 'hooks path is outside the repository (core.hooksPath); add `js-harness check` to its pre-commit yourself';
        actions.push(kept(toForwardSlashes(realHookPath), reason, true));
      } else {
        const hookRel = pathShapeFor(root, hookPath, hookIsWorkingTree);
        if (hookOccupied) {
          actions.push(kept(hookRel, 'exists; add `js-harness check` to it', false, !hookIsWorkingTree));
        } else {
          // T2f item 2: bounded by `hookBase` (the git dir or common git dir, for a worktree or a
          // submodule), not always `root` — otherwise the climb stops before it starts whenever the
          // hooks directory lives outside the working tree, recording only the deepest directory.
          const hookDirShallow = mkdirTracked(path.dirname(hookPath), hookBase, createdDirs);
          if (hookDirShallow) reportedDirs.push({ absolute: hookDirShallow, isWorkingTree: hookIsWorkingTree });
          createdPaths.push(hookPath);
          writeFile(hookPath, PRE_COMMIT_HOOK, 'utf8');
          fs.chmodSync(hookPath, 0o755);
          const hash = sha256(PRE_COMMIT_HOOK);
          files.push(manifestEntry(root, hookPath, hookIsWorkingTree, hash));
          actions.push(wrote(hookRel, hash, !hookIsWorkingTree));
        }
      }
    }

    // codegraph init: only when `.codegraph/` does not exist yet — it writes only that directory
    // (measured in a scratch repo, codegraph 1.6.0), so its presence alone means "already done".
    // A codegraph failure is reported, never thrown: it does not participate in this function's
    // atomicity the way an ordinary file write does (see "T2 design": codegraph missing/failing
    // still exits 0 and carries on) — but a codegraph *success* is rolled back too, alongside
    // everything else, when a later step fails (T2e item 2; see the catch clause below).
    // `codegraphCreatedThisRun` tracks that so the rollback knows whether it owns `.codegraph/`.
    let codegraphManifest;
    if (fs.existsSync(codegraphDirPath(root))) {
      codegraphManifest = { createdDir: false, status: 'exists' };
      actions.push({ kind: 'skip', path: 'codegraph init', reason: '.codegraph already exists' });
    } else {
      const { manifest: cgManifest, reason } = initCodegraph(root, spawn, platform);
      codegraphManifest = cgManifest;
      codegraphCreatedThisRun = cgManifest.createdDir === true;
      actions.push(
        reason
          ? { kind: 'problem', path: 'codegraph init', reason }
          : { kind: 'ran', path: 'codegraph init' },
      );
    }

    const dirs = reportedDirs.map(({ absolute, isWorkingTree }) => manifestEntry(root, absolute, isWorkingTree));

    const manifest = {
      version,
      files,
      kept: actions
        .filter((a) => a.kind === 'kept')
        .map((a) => {
          const entry = { path: a.path, reason: a.reason };
          if (a.outside) entry.outside = true;
          if (a.gitDir) entry.gitDir = true;
          return entry;
        }),
      codegraph: codegraphManifest,
      dirs,
    };

    // T2c Codex P1 + R3-rollback-deletes-preexisting-manifest: `manifestFilePath` is guaranteed
    // absent here — `initProject` already refused to reach `writeProject` at all when it exists
    // (see its `staleManifest` check) — so tracking it in `createdPaths` exactly like every other
    // file this run writes can never end up rolling back a manifest from a previous run. The
    // manifest's own directory is never reported in `dirs` (T2e item 6): it is `js-harness`
    // bookkeeping, not a project file, and `uninstall` (T3) removes it separately, last.
    mkdirTracked(path.dirname(manifestFilePath), root, createdDirs);
    createdPaths.push(manifestFilePath);
    writeManifestAtomic(manifestFilePath, manifest, manifestDeps);

    // harness.json: written last, only once the manifest that already lists it is safely on disk
    // (T2e item 1). A failure here rolls back everything, the manifest included.
    createdPaths.push(harnessJsonPath);
    writeFile(harnessJsonPath, harnessJsonContent, 'utf8');

    return { code: 0, root, actions, manifest, manifestPath: manifestFilePath };
  } catch (err) {
    const notRemoved = rollback(root, createdPaths, createdDirs, rm);
    // T2e item 2: this run's own `.codegraph/` never existed before it (the `else` branch above is
    // only reached when `fs.existsSync(codegraphDirPath(root))` was already false) — so whenever
    // this run created it, removing it here is always correct: no older manifest can be recording
    // ownership of a directory that did not exist before this run started.
    if (codegraphCreatedThisRun) {
      try {
        rm(codegraphDirPath(root), { recursive: true, force: true });
      } catch {
        notRemoved.push(toRepoRelative(root, codegraphDirPath(root)));
      }
    }
    throw new InitWriteError(err.message, notRemoved);
  }
}

/** `harness.json` already exists: nothing is (re-)written except one narrow, explicit exception.
 * When the project manifest on disk says a previous codegraph run failed, only the codegraph step
 * is retried and only the manifest's `codegraph` field is updated; every other file is untouched.
 * The retry runs even if `.codegraph/` exists now, as long as the failed run itself is what created
 * it (`codegraph.createdDir: true` in that stale record) — a directory some *other* tool created
 * after the failure is left alone, same as any other "already done" case (T2d Codex P2 codegraph
 * ownership). A failure while rewriting the manifest here throws `InitWriteError` the same way
 * `writeProject` does (T2c R3-retry-manifest-write-unguarded), and, per T2e item 2, removes
 * `.codegraph/` too — but *only* when it did not exist before this retry attempt. When it already
 * existed (only possible because the stale, still-intact manifest already recorded
 * `createdDir: true` from an earlier failed run), that older manifest still truthfully owns it —
 * this retry's failed rewrite never touched it, so removing `.codegraph/` here would make that
 * still-valid record lie about what is actually on disk. */
function alreadyInitialized(root, harnessJsonPath, manifestFilePath, spawn, platform, rm, manifestDeps) {
  let existingVersion = null;
  try {
    existingVersion = JSON.parse(fs.readFileSync(harnessJsonPath, 'utf8'))?.version ?? null;
  } catch {
    // Malformed harness.json is still "present" for the purposes of this gate; report what we can
    // and still write nothing (see "T2 design": exit 0, nothing written, either way).
  }

  if (fs.existsSync(manifestFilePath)) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf8'));
    } catch {
      manifest = null;
    }
    const priorCodegraph = manifest?.codegraph;
    const codegraphDirExistedBeforeRetry = fs.existsSync(codegraphDirPath(root));
    const shouldRetryCodegraph =
      priorCodegraph?.status === 'failed' && (!codegraphDirExistedBeforeRetry || priorCodegraph.createdDir === true);

    if (shouldRetryCodegraph) {
      const { manifest: codegraphManifest, reason } = initCodegraph(root, spawn, platform);
      manifest.codegraph = codegraphManifest;
      try {
        writeManifestAtomic(manifestFilePath, manifest, manifestDeps);
      } catch (err) {
        const notRemoved = [];
        if (!codegraphDirExistedBeforeRetry) {
          try {
            rm(codegraphDirPath(root), { recursive: true, force: true });
          } catch {
            notRemoved.push(toRepoRelative(root, codegraphDirPath(root)));
          }
        }
        throw new InitWriteError(`codegraph init ran but the manifest could not be updated: ${err.message}`, notRemoved);
      }
      return {
        code: 0,
        alreadyInitialized: true,
        version: existingVersion,
        root,
        codegraphRetry: { ok: !reason, reason, manifestPath: manifestFilePath },
      };
    }
  }

  return { code: 0, alreadyInitialized: true, version: existingVersion, root };
}

/** Runs `js-harness init` against the git repository at `cwd`'s top-level. `version` is the
 * caller's running version (`currentVersion()` in install.mjs) — passed in rather than read here
 * so this module has no package.json of its own to know about. Returns one of:
 * - `{ code: 1, noSuchDirectory: true, cwd }` — `cwd` itself does not exist; nothing written.
 * - `{ code: 1, notGitRepo: true }` — `cwd` exists but is outside a git repository; nothing written.
 * - `{ code: 1, staleManifest: true, manifestPath }` — no `harness.json`, but a project manifest
 *   from a previous init already exists at `manifestPath`; nothing written (T2c item 1).
 * - `{ code: 0, alreadyInitialized: true, version, root, codegraphRetry? }` — `harness.json`
 *   already exists; nothing written, except a narrow codegraph retry (see `alreadyInitialized`).
 * - `{ code: 0, root, actions, manifest, manifestPath }` — a fresh project: `actions` is in report
 *   order (`wrote`/`kept`/`ran`/`skip`/`problem`), `manifest` is exactly what was written to
 *   `manifestPath`.
 * Throws `InitWriteError` when a write step fails after the first — see `writeProject` and
 * `alreadyInitialized`. */
export function initProject(cwd, version, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  const platform = deps.platform ?? process.platform;
  const writeFile = deps.writeFile ?? fs.writeFileSync;
  const rm = deps.rm ?? fs.rmSync;
  // The manifest's own exclusive-create write is injected separately from the general `writeFile`
  // (used for AGENTS.md, the hook, and harness.json): see `writeManifestAtomic` for why it needs its
  // open/write/close steps distinguishable rather than one opaque call (T2g R3-001).
  const manifestDeps = { open: deps.open, write: deps.write, close: deps.close };

  if (!fs.existsSync(cwd)) return { code: 1, noSuchDirectory: true, cwd };

  const root = gitTopLevel(cwd, spawn);
  if (!root) return { code: 1, notGitRepo: true };

  const manifestFilePath =
    resolveGitPath(root, 'js-harness/manifest.json', spawn) ?? path.join(root, '.git', 'js-harness', 'manifest.json');

  // `isOccupied` (not `fs.existsSync`) so a dangling harness.json symlink is treated as "already
  // initialized" rather than silently written through (T2d item 1).
  const harnessJsonPath = path.join(root, 'harness.json');
  if (isOccupied(harnessJsonPath)) {
    return alreadyInitialized(root, harnessJsonPath, manifestFilePath, spawn, platform, rm, manifestDeps);
  }

  // T2c Codex P1 + R3-rollback-deletes-preexisting-manifest: a manifest surviving without
  // harness.json means this clone was initialized before and then had harness.json removed (by
  // hand, or a partial/failed uninstall) — not a fresh project. Refuse rather than silently
  // writing a brand-new manifest over stale bookkeeping from a run this one knows nothing about.
  // `isOccupied` here too (T2d item 1): a dangling manifest symlink still counts as "there".
  if (isOccupied(manifestFilePath)) {
    return { code: 1, staleManifest: true, manifestPath: manifestFilePath };
  }

  return writeProject(root, version, spawn, platform, writeFile, rm, manifestFilePath, manifestDeps);
}

/** Resolves one `files`/`dirs` manifest entry back to its absolute path: repo-relative against
 * `root` for an ordinary working-tree entry, or the entry's own absolute forward-slashed `path`
 * (converted back to the host's separator) when `gitDir: true` marks it as written into a git dir
 * outside the working tree — the same two shapes `manifestEntry`/`pathShapeFor` produce on the way
 * in (see there). */
function resolveManifestEntryPath(root, entry) {
  const segments = entry.path.split('/');
  return entry.gitDir ? path.resolve(segments.join(path.sep)) : path.join(root, ...segments);
}

/** Whether `content` (as read from disk) is still what `init` wrote, judged the way T3 design calls
 * for: an exact sha256 match, or a match once CRLF is folded back to LF — git may rewrite line
 * endings on checkout (`core.autocrlf`, a `.gitattributes` rule), but `init` itself only ever writes
 * LF (`PRE_COMMIT_HOOK`, `agentsTemplate`, harness.json's `JSON.stringify(...) + '\n'`), so the
 * recorded hash is always for LF content — never the reverse, so no other direction needs checking. */
function matchesRecordedHash(content, expectedHash) {
  if (sha256(content) === expectedHash) return true;
  return sha256(content.replace(/\r\n/g, '\n')) === expectedHash;
}

/** Removes `dir` and every descendant directory that ends up empty, deepest first — walking *down*
 * from the recorded shallowest directory `init` created, the opposite direction from
 * `manifest.mjs`'s `removeEmptyDirsUpTo` (which climbs up from a leaf toward a fixed stop). `dirs`
 * only ever records the shallowest ancestor a single `mkdirSync(dir, { recursive: true })` actually
 * created (see `shallowestMissingAncestor`), so by the time this runs — after every `files` entry is
 * already handled — the whole chain below it should be empty; a directory that turns out to have
 * real content left in it (something added after init, or a file above that was kept or failed) is
 * silently left alone rather than forced empty, matching `dirs`' own "remove each when empty"
 * contract (T3 design) — only an actual removal failure on a directory this walk itself confirmed
 * *was* empty is reported. `isWorkingTreeDir` (constant for the whole walk, from the manifest
 * entry's own `gitDir` flag) picks `pathShapeFor`'s report shape for any failure, at whatever depth
 * it happens. */
function pruneEmptyDirsBottomUp(root, dir, isWorkingTreeDir, rm, notRemoved, actions) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // already gone entirely — nothing to do
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      pruneEmptyDirsBottomUp(root, path.join(dir, entry.name), isWorkingTreeDir, rm, notRemoved, actions);
    }
  }
  let remaining;
  try {
    remaining = fs.readdirSync(dir);
  } catch {
    return; // vanished during the recursion above (already handled by a deeper call)
  }
  if (remaining.length > 0) return; // real content left behind — never this walk's to remove
  const label = pathShapeFor(root, dir, isWorkingTreeDir);
  try {
    rm(dir, { recursive: true, force: true });
    actions.push({ kind: 'removed', path: label });
  } catch (err) {
    notRemoved.push(label);
    actions.push({ kind: 'failed', path: label, reason: err.message });
  }
}

/** Removes `dir` only if it is now empty — the manifest's own directory, once the manifest file
 * itself is gone (T3 design: "the manifest, then its directory when empty"). Best-effort and never
 * fatal: the manifest is already gone either way by the time this runs, so a failure here has
 * nothing left to protect by turning `uninstallProject`'s overall result into a failure. */
function removeManifestDirIfEmpty(dir, rm) {
  let remaining;
  try {
    remaining = fs.readdirSync(dir);
  } catch {
    return;
  }
  if (remaining.length !== 0) return;
  try {
    rm(dir, { recursive: true, force: true });
  } catch {
    // Best-effort; see the doc comment above.
  }
}

/** Undoes exactly what `initProject` wrote, from the project manifest it left behind — the
 * counterpart T3 design calls for. `deps.spawn`/`deps.rm` are injectable the same way `initProject`'s
 * are; no `writeFile` here, since uninstall never writes anything.
 *
 * Returns one of:
 * - `{ code: 1, noSuchDirectory: true, cwd }` — `cwd` itself does not exist.
 * - `{ code: 1, notGitRepo: true }` — outside a git repository.
 * - `{ code: 1, notInitialized: true }` — inside a git repository, but neither `harness.json` nor a
 *   project manifest exists at its top-level: never a js-harness project, or already fully undone.
 *   The caller (`uninstallMain`) treats this and `notGitRepo` as "fall through to the machine
 *   uninstall" (T3 design's "anywhere else"), never as project-scope errors.
 * - `{ code: 1, noManifestFile: true, manifestPath }` — `harness.json` exists but no manifest does
 *   (a fresh clone of an initialized project: those files are already committed, so git has them).
 * - `{ code: 1, malformedManifest: true, manifestPath, reason? }` — the manifest does not parse as
 *   the shape `initProject` writes.
 * - `{ code, root, manifestPath, actions, notRemoved }` — the ordinary result: `actions` is in
 *   report order (`removed`/`kept`/`alreadyGone`/`codegraphRemoved`/`failed`/`manifestRemoved`),
 *   `code` is 1 exactly when `notRemoved` is non-empty (a kept, unchanged file is not a failure —
 *   T3 design). On any failure the manifest itself is left in place so a second `uninstallProject`
 *   run can finish the job; anything already removed simply reports `alreadyGone` on that rerun. */
export function uninstallProject(cwd, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  const rm = deps.rm ?? fs.rmSync;

  if (!fs.existsSync(cwd)) return { code: 1, noSuchDirectory: true, cwd };

  const root = gitTopLevel(cwd, spawn);
  if (!root) return { code: 1, notGitRepo: true };

  const harnessJsonPath = path.join(root, 'harness.json');
  const manifestFilePath =
    resolveGitPath(root, 'js-harness/manifest.json', spawn) ?? path.join(root, '.git', 'js-harness', 'manifest.json');

  const harnessJsonPresent = isOccupied(harnessJsonPath);
  const manifestPresent = isOccupied(manifestFilePath);

  if (!harnessJsonPresent && !manifestPresent) return { code: 1, notInitialized: true };
  if (!manifestPresent) return { code: 1, noManifestFile: true, manifestPath: manifestFilePath };

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf8'));
  } catch (err) {
    return { code: 1, malformedManifest: true, manifestPath: manifestFilePath, reason: err.message };
  }
  if (!manifest || !Array.isArray(manifest.files)) {
    return { code: 1, malformedManifest: true, manifestPath: manifestFilePath };
  }

  const actions = [];
  const notRemoved = [];

  for (const file of manifest.files) {
    const abs = resolveManifestEntryPath(root, file);
    let stat;
    try {
      stat = fs.lstatSync(abs);
    } catch {
      actions.push({ kind: 'alreadyGone', path: file.path });
      continue;
    }
    if (!stat.isFile()) {
      // A symlink (never followed, dangling or not) or anything else that isn't a plain file: not
      // what `init` wrote, so never this run's to remove either.
      actions.push({ kind: 'kept', path: file.path, reason: 'changed since init' });
      continue;
    }
    let content;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch (err) {
      notRemoved.push(file.path);
      actions.push({ kind: 'failed', path: file.path, reason: err.message });
      continue;
    }
    if (!matchesRecordedHash(content, file.sha256)) {
      actions.push({ kind: 'kept', path: file.path, reason: 'changed since init' });
      continue;
    }
    try {
      rm(abs, { force: true });
      actions.push({ kind: 'removed', path: file.path });
    } catch (err) {
      notRemoved.push(file.path);
      actions.push({ kind: 'failed', path: file.path, reason: err.message });
    }
  }

  for (const dir of manifest.dirs ?? []) {
    const abs = resolveManifestEntryPath(root, dir);
    pruneEmptyDirsBottomUp(root, abs, !dir.gitDir, rm, notRemoved, actions);
  }

  if (manifest.codegraph?.createdDir === true) {
    try {
      rm(codegraphDirPath(root), { recursive: true, force: true });
      actions.push({ kind: 'codegraphRemoved' });
    } catch (err) {
      notRemoved.push('.codegraph');
      actions.push({ kind: 'failed', path: '.codegraph', reason: err.message });
    }
  }

  // `manifest.kept` entries were never written by `init` (an existing AGENTS.md, an existing hook,
  // one outside the repository) — left alone entirely, not even reported here (T3 design).

  if (notRemoved.length > 0) {
    return { code: 1, root, manifestPath: manifestFilePath, actions, notRemoved };
  }

  try {
    rm(manifestFilePath, { force: true });
    actions.push({ kind: 'manifestRemoved', path: manifestFilePath });
  } catch (err) {
    notRemoved.push(manifestFilePath);
    actions.push({ kind: 'failed', path: manifestFilePath, reason: err.message });
    return { code: 1, root, manifestPath: manifestFilePath, actions, notRemoved };
  }
  removeManifestDirIfEmpty(path.dirname(manifestFilePath), rm);

  return { code: 0, root, manifestPath: manifestFilePath, actions, notRemoved };
}

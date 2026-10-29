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
import { sha256, writeManifestAtomic } from './manifest.mjs';
import { tools } from './stack.mjs';
import { functionsOf, gitIn, harnessOfTree, workingTree } from './project-functions.mjs';
import { SETTINGS_FILE, SETTINGS_KEYS, applySettings, isValidSettingsRecord, planFunctions, settingLabel, settingPending, valueAt } from './project-apply.mjs';
import { EXCLUDED, addExclude, isValidExcludeRecord, undoExclude } from './project-exclude.mjs';
import { TEMPLATE_BLOCK_MARK, agentsFile, claudeFile, renderBlock } from './project-template.mjs';

/** The format of the project manifest this copy reads and writes. A manifest carries it once it holds what an
 * older copy cannot undo: format 1 its `settings`, which a copy older than the switches does not know, and
 * format 2 its `exclude`, the line of `.atl/` (./project-exclude.mjs), format 3 the style and the denies every clone
 * holds (`SETTINGS_KEYS`, `format`). Such a copy deletes a manifest it does not understand and leaves the rest behind,
 * which is why a copy that reads a format greater than its own undoes nothing. A copy already installed that knows no
 * format cannot be made to refuse. */
export const MANIFEST_FORMAT = 3;

/** The format `manifest` needs for what it holds (`MANIFEST_FORMAT`), or `undefined` where any copy reads it. */
const formatFor = (manifest) => Math.max(manifest.exclude ? 2 : 0, ...(manifest.settings ?? []).map((record) => SETTINGS_KEYS[record.key]?.format ?? 1), manifest.settings ? 1 : 0) || undefined;

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
 * to judging containment against the working tree alone, same as before this item.
 *
 * One process answers both: `git rev-parse --git-dir --git-common-dir` prints the two paths on two
 * lines, in that order, each as the flag alone prints it. Whatever reads or writes a line of the Codex
 * review records asks this each time (`jsonLinesPath`), unless its caller asked once and hands the answer
 * on, as a `codex-review` run does for the several times it reads and writes them. Both
 * are `null` together when that process fails. An answer that is not two lines is a path with a line
 * break in it, which two lines cannot carry: each is then asked for alone. */
export function gitDirs(root, spawn = spawnSync) {
  let result;
  try {
    result = spawn('git', ['rev-parse', '--git-dir', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
  } catch {
    return { gitDir: null, commonGitDir: null };
  }
  if (!result || result.error || result.status !== 0 || !result.stdout) return { gitDir: null, commonGitDir: null };
  const lines = result.stdout.trim().split('\n');
  if (lines.length !== 2) {
    return { gitDir: revParseAbsolute(root, '--git-dir', spawn), commonGitDir: revParseAbsolute(root, '--git-common-dir', spawn) };
  }
  const [gitDir, commonGitDir] = lines.map((line) => absoluteFrom(root, line.trim()));
  return { gitDir, commonGitDir };
}

const FULL_COMMIT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/** Whether `text` is a commit id as git prints one in full: 40 hex digits, or 64 in a repository of the
 * newer hash, and nothing else. */
export const isFullCommitId = (text) => typeof text === 'string' && FULL_COMMIT_ID.test(text);

/** Both git directories of `root`, as `gitDirs` gives them, and the commit each of `revs` names there, from
 * one process: `git rev-parse --git-dir --git-common-dir <rev>^{commit}…`. `root` is the top of the working
 * tree: asked below it, git writes the two directories against different folders.
 *
 * A first try, and `null` unless the answer can only be read one way; the caller then asks each question
 * alone, as it did before this existed, and says what those say. The exit code proves nothing here:
 * `rev-parse` without `--verify` exits 0 and prints back an argument it does not know, and a rev may be an
 * option of its own (`--all`, a `--glob=`). So the answer is taken only when it is a string of exactly one
 * line for each directory and each rev, and every rev's line is a full commit id, all of one length. A rev
 * that names no commit, a repository with no commit, a path with a line break in it, no git on the path:
 * each gives `null`. */
export function gitDirsAndCommits(root, revs, spawn = spawnSync) {
  let result;
  try {
    result = spawn('git', ['rev-parse', '--git-dir', '--git-common-dir', ...revs.map((rev) => `${rev}^{commit}`)], { cwd: root, encoding: 'utf8' });
  } catch {
    return null;
  }
  if (!result || result.error || result.status !== 0 || typeof result.stdout !== 'string') return null;
  const lines = result.stdout.split('\n');
  if (lines.pop() !== '' || lines.length !== revs.length + 2) return null;
  const [gitDir, commonGitDir, ...commits] = lines;
  if (gitDir.trim() === '' || commonGitDir.trim() === '') return null;
  if (!commits.every((id) => isFullCommitId(id) && id.length === commits[0].length)) return null;
  return { gitDir: absoluteFrom(root, gitDir.trim()), commonGitDir: absoluteFrom(root, commonGitDir.trim()), commits };
}

function revParseAbsolute(root, flag, spawn) {
  let result;
  try {
    result = spawn('git', ['rev-parse', flag], { cwd: root, encoding: 'utf8' });
  } catch {
    return null;
  }
  if (!result || result.error || result.status !== 0 || !result.stdout) return null;
  return absoluteFrom(root, result.stdout.trim());
}

/** `raw`, a path as git printed it, absolute: one that is relative is relative to `root`. */
function absoluteFrom(root, raw) {
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

/** The clone's exclude file as git names it, `{ file }`, or `{ file, reason }` where it is not to be written: a link on
 * its way, or a real path outside the working tree and git dirs, would send the line to another file (Codex P2 on
 * dea129b..118f479). `file` is null where git names none. */
function excludeFile(root, spawn) {
  const file = resolveGitPath(root, 'info/exclude', spawn);
  if (!file) return { file: null, reason: 'git did not name the exclude file' };
  const gitBases = gitDirs(root, spawn);
  const realBases = [fs.realpathSync(root), safeRealpath(gitBases.gitDir), safeRealpath(gitBases.commonGitDir)].filter(Boolean);
  const { real, hadSymlink } = realish(file, realBases);
  if (hadSymlink || containingBase(real, realBases) === null) return { file, reason: 'a link is in its path or it is outside the repository; left as it is' };
  return { file };
}

/** The base `AGENTS.md` template `init` writes when a project has none of its own (`agentsFile`): with `split`, the
 * reviewer's half of the harness's lines, since `CLAUDE.md` holds the rest (odd/tasks/f8-s3-split.md, S3); without it,
 * the whole block, for a project whose own `CLAUDE.md` does not hold the harness's half. */
export const agentsTemplate = (root, { split = true } = {}) => agentsFile(root, split ? agentsBlock() : templateBlock());
/** The base `CLAUDE.md` template `init` writes beside it (`claudeFile`), with the half Claude works from. */
export const claudeTemplate = () => claudeFile(claudeBlock());
/** `text` with the harness's block rendered as `body`, the whole block unless given (`renderBlock`). */
export const renderTemplateBlock = (text, body = templateBlock()) => renderBlock(text, body);

/** The harness's lines that hold in any project, whose wording is the owner's yes (odd/tasks/rule-hierarchy.md, T9):
 * the whole block, the two halves of the split as an `AGENTS.md` written before it holds them. They sit in a marked
 * block that `sync` renders again while the project has not edited them (`renderTemplateBlock`, T16f). */
export function templateBlock() {
  return `${agentsBlock()}\n${claudeBlock()}`;
}

/** The half of the harness's lines a reviewer needs, the block of a split `AGENTS.md`: what good looks like. */
export function agentsBlock() {
  return `## What good looks like
Work here is done properly, not to comply: no shortcut; under the agreed protocols; nothing stated
that was not checked; what is passed on is complete and true; and each mistake leaves a control, of
the smallest kind that does the job. A rule is not recorded until it has its place in a check, a
line of this file or a protocol.

A finding arrives with the evidence that proves it, and every claim is checked, assumed or not known,
as \`js-harness-protocols\` section 6 says.
Where the Codex review is off (\`js-harness functions\`), the Claude lens review stays on: the merge
door asks for its record before a change lands.
`;
}

/** The half of the harness's lines Claude works from, the block of the `CLAUDE.md` `init` writes: working with the owner. */
export function claudeBlock() {
  return `## Working with the owner
The owner decides spend outside the plan, anything installed or changed on a machine, a product
choice, what cannot be undone, a change of the plan or of its order, a new protocol, and a report
published outside this project. Ask those one at a time, never while work runs, naming which it is, as \`rule:questions-one-place\` says.
Everything else is decided and its cost said, as \`js-harness-protocols\` section 1 says, and the work goes on.

Near \`rule:context-pause\` of its window a session writes its state and keeps working; the host
compacts it, and the pause notice says what the owner gets then.

The owner's wording is the need, not the specification: an answer to a proposal of theirs says the
need that was understood, what would be done differently from their words and why, and what it
costs or is not known; only then is it recorded.

A design before it is built, and a plan, an analysis with figures or a protocol put to the owner,
first passes two readers that did not write it: one attacks its claims, one looks only for what is
missing. The owner gets the improved version, with what each reader changed and what stays
unguaranteed.

A reply ends in one of the five states of \`js-harness-protocols\` section 2.
`;
}

/** The empty failures register `init` writes as `docs/FAILURES.md` when a project has none: what an entry is and how
 * one is written, with no class and no entry, since the classes are the project's own. `js-harness failures` and the
 * gate's `failures` row read it (`bin/lib/failures.mjs`); it parses with no fault. */
export const FAILURES_TEMPLATE = `<!-- Written by \`js-harness init\`. -->
# Failures

What went wrong in this project: one entry per failure, with each time it was seen and the control
that corrects it. A failure is work that went wrong in a way a control could prevent. A test that
fails and is fixed inside its own task is not one: the gate is that control, working.

A class is declared under "## Classes" as a list item: the id in backticks, then what it means. A
failure is a "### <id>" entry under "## Entries", in the alphabetical order of the ids, with
"- Class:" and one "- Seen:" line each time it happens, then the "- Control:" that corrects it. Its
state is never written: \`js-harness failures\` computes it, and \`js-harness failures check
--settled\` exits 1 while an entry is not settled.

## Classes

## Entries
`;

/** The code `init` offers a project named `name`, its folder: the initials of its words, four at most, or the first two
 * letters of a name of one word, in capitals ("js-harness" is JH, "billing" BI); `null` for a name with no letter or
 * digit of ASCII. `harness.json` "code" holds it, and the project changes it there. */
export function codeOfName(name) {
  const words = String(name).split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return null;
  const code = words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 4).map((word) => word[0]).join('');
  const upper = code.toUpperCase();
  // ORQ is the role of a lead, never a code.
  return upper === 'ORQ' ? null : upper;
}

/** A semver version (semver.org's grammar, without a leading `v`): what `harness.json` may pin. */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const PRE_COMMIT_HOOK =
  '#!/bin/sh\n# Written by js-harness init; js-harness uninstall removes it.\nexec js-harness check\n';

/** The push check, where the Codex review is on (odd/tasks/on-demand-functions.md, S6): one `check --push`
 * a pushed ref, as this repository's own `.githooks/pre-push` runs it; a delete pushes nothing. */
const PRE_PUSH_HOOK = [
  '#!/bin/sh',
  '# Written by js-harness; js-harness uninstall removes it. Refuses a push whose code commits no Codex',
  '# review record covers, where the project has the review on (harness.json "functions").',
  'status=0',
  'while read -r local_ref local_sha remote_ref remote_sha; do',
  '  case "$local_sha" in *[!0]*) ;; *) continue ;; esac',
  '  js-harness check --push --remote "$1" --head "$local_sha" < /dev/null || status=1',
  'done',
  'exit $status',
  '',
].join('\n');

/** The two hooks the harness writes: the name under the hooks path, the text, and what to add by hand to a
 * hook of that name it does not write. */
const HOOKS = {
  preCommit: { name: 'pre-commit', content: PRE_COMMIT_HOOK, command: '`js-harness check`' },
  prePush: { name: 'pre-push', content: PRE_PUSH_HOOK, command: '`js-harness check --push` for each pushed ref' },
};

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
  // With DO_NOT_TRACK, codegraph writes no telemetry queue and no update-check cache under the home, files no
  // manifest records and `uninstall --global` would leave (docs/FAILURES.md, init-leaves-codegraph-files; measured on
  // codegraph 1.6.0). `init` then writes nothing outside the repository, as bin/init.mjs says it does.
  const env = { ...process.env, DO_NOT_TRACK: '1' };
  let result;
  try {
    if (shell) {
      result = spawn('codegraph init --yes .', [], { encoding: 'utf8', shell: true, cwd: root, env });
    } else {
      result = spawn('codegraph', ['init', '--yes', '.'], { encoding: 'utf8', shell: false, cwd: root, env });
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

/** The pre-commit gate step, shared by `init` (`writeProject`) and a fresh clone's `sync` (T4
 * design: "the way `init` would — the pre-commit gate ... under the same containment rules"). Appends to
 * `state` (the run's `createdPaths`/`createdDirs`/`reportedDirs`/`files`/`actions`) exactly what the
 * inline block it was extracted from did; a failure here throws and the caller rolls back. */
function writeHookGate(root, spawn, writeFile, state, hook = HOOKS.preCommit) {
  const { createdPaths, createdDirs, reportedDirs, files, actions } = state;
  // Pre-commit gate: wherever `core.hooksPath` (or the default `.git/hooks`) resolves it to.
  // Never touches git config itself — see "T2 design": setting `core.hooksPath` would silently
  // disable a project's existing `.git/hooks`. Containment is judged against the real working
  // tree *and* the real git dir/common git dir (T2e item 4): a linked worktree or a submodule
  // keeps its shared hooks directory outside the working tree, and that is still this run's to
  // write, recorded by its absolute path with `gitDir: true` rather than a repo-relative one.
  const hookPath = resolveGitPath(root, `hooks/${hook.name}`, spawn);
  if (!hookPath) {
    actions.push({ kind: 'skip', path: `hooks/${hook.name}`, reason: 'could not resolve the git hooks path' });
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
        ? `a link sends the hooks path outside the repository; add ${hook.command} to its ${hook.name} yourself`
        : `hooks path is outside the repository (core.hooksPath); add ${hook.command} to its ${hook.name} yourself`;
      actions.push(kept(toForwardSlashes(realHookPath), reason, true));
    } else {
      const hookRel = pathShapeFor(root, hookPath, hookIsWorkingTree);
      if (hookOccupied) {
        actions.push(kept(hookRel, `exists; add ${hook.command} to it`, false, !hookIsWorkingTree));
      } else {
        // T2f item 2: bounded by `hookBase` (the git dir or common git dir, for a worktree or a
        // submodule), not always `root` — otherwise the climb stops before it starts whenever the
        // hooks directory lives outside the working tree, recording only the deepest directory.
        const hookDirShallow = mkdirTracked(path.dirname(hookPath), hookBase, createdDirs);
        if (hookDirShallow) reportedDirs.push({ absolute: hookDirShallow, isWorkingTree: hookIsWorkingTree });
        createdPaths.push(hookPath);
        writeFile(hookPath, hook.content, 'utf8');
        fs.chmodSync(hookPath, 0o755);
        const hash = sha256(hook.content);
        files.push(manifestEntry(root, hookPath, hookIsWorkingTree, hash));
        actions.push(wrote(hookRel, hash, !hookIsWorkingTree));
      }
    }
  }
}

/** The `codegraph init` step, shared by `init` and a fresh clone's `sync`: runs only when
 * `.codegraph/` does not exist yet (it writes only that directory, measured in a scratch repo,
 * codegraph 1.6.0) and never throws — a codegraph failure is reported, not fatal (see "T2 design").
 * Returns the manifest's `codegraph` fragment and whether this run created `.codegraph/`, so a caller's
 * rollback knows whether it owns the directory (T2e item 2); the report action is pushed onto
 * `actions`. */
function codegraphStep(root, spawn, platform, actions) {
  if (fs.existsSync(codegraphDirPath(root))) {
    actions.push({ kind: 'skip', path: 'codegraph init', reason: '.codegraph already exists' });
    return { manifest: { createdDir: false, status: 'exists' }, createdThisRun: false };
  }
  const { manifest, reason } = initCodegraph(root, spawn, platform);
  actions.push(reason ? { kind: 'problem', path: 'codegraph init', reason } : { kind: 'ran', path: 'codegraph init' });
  return { manifest, createdThisRun: manifest.createdDir === true };
}

/** What the switches of the project at `root` ask of this clone (bin/lib/project-apply.mjs), read from its
 * working tree, or `declared`, a preset's: `{ resolved, plan }`, or `{ errors }` when `harness.json` or its
 * `"functions"` cannot be read, which applies nothing. */
function functionsPlan(root, spawn, declared = null) {
  const { errors, resolved } = functionsOf(declared ? { declared: { functions: declared } } : harnessOfTree(root), workingTree(gitIn(root, spawn)));
  if (errors.length > 0) return { errors };
  return { resolved, plan: planFunctions(resolved, { indexPresent: fs.existsSync(codegraphDirPath(root)) }) };
}

function functionsProblem(errors) {
  return { kind: 'problem', path: 'harness.json "functions"', reason: `${errors.join('; ')}; no switch was applied` };
}

/** The manifest's `codegraph` when no index was asked for and none is there. */
const NO_INDEX = { createdDir: false, status: 'off' };

/** `codegraphStep` where the code map asks for an index or one is already there to record; otherwise the
 * reason none is made. */
function codegraphWhereWanted(root, spawn, platform, actions, functions) {
  if (functions.plan?.index === 'make' || fs.existsSync(codegraphDirPath(root))) {
    return codegraphStep(root, spawn, platform, actions);
  }
  if (functions.plan) {
    const { value, because } = functions.resolved.codeMap;
    actions.push({ kind: 'skip', path: 'codegraph init', reason: `the code map is ${value}: ${because}` });
  }
  return { manifest: { ...NO_INDEX }, createdThisRun: false };
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
 * reaches disk either, nothing is left unrecorded.
 *
 * `clone` is the fresh-clone setup `sync` runs (T4 design): the same gate, codegraph and manifest,
 * but `harness.json` and an existing `AGENTS.md` are committed files, recorded as `kept` and never
 * written, so the manifest's `files` holds only what this clone wrote and `uninstall` there removes
 * only that. `preset` is the `"functions"` an `init --preset` writes into `harness.json` (F8 S11, L9). */
function writeProject(root, version, spawn, platform, writeFile, rm, manifestFilePath, manifestDeps, { clone = false, preset = null } = {}) {
  const createdPaths = [];
  const createdDirs = [];
  const reportedDirs = [];
  let codegraphCreatedThisRun = false;
  let settingsRecords = [];
  let exclude = null;
  let excludePath = null;

  try {
    const actions = [];
    const files = [];
    // The switches are read before anything is written, from the project as it stands.
    const functions = functionsPlan(root, spawn, preset);
    if (functions.errors) actions.push(functionsProblem(functions.errors));

    // harness.json: the pin — computed now (its content never depends on anything written after
    // it), but not written until the very end (T2e item 1). The reply check is on in a new project, with the
    // English labels (odd/tasks/rule-hierarchy.md, T9: his answer "Prendido por defecto").
    // The project's code, the identifier its sessions' titles start with, is offered from its name
    // (odd/tasks/session-title.md, S5): his answer of 2026-10-19, "la idea es que tenga el udentificador del proyecto".
    const harnessJsonPath = path.join(root, 'harness.json');
    const code = codeOfName(path.basename(root));
    const harnessJsonContent = JSON.stringify({ version, ...(code !== null && { code }), reply: true, ...(preset && { functions: preset }) }, null, 2) + '\n';
    const harnessJsonRel = toRepoRelative(root, harnessJsonPath);
    const harnessJsonHash = sha256(harnessJsonContent);
    if (clone) {
      // T4 design: in a fresh clone the pin is a committed file, not one this run created — recorded as
      // kept so `uninstall` never removes it, and never written (nor rolled back) here.
      actions.push(kept(harnessJsonRel, 'committed'));
    } else {
      files.push({ path: harnessJsonRel, sha256: harnessJsonHash });
      actions.push(wrote(harnessJsonRel, harnessJsonHash));
    }

    // AGENTS.md: only when the project has none of its own. `isOccupied` (not `fs.existsSync`)
    // so a dangling symlink there is kept, not silently written through (T2d item 1).
    // With it, CLAUDE.md, the split of odd/tasks/f8-s3-split.md (S3), and only when the project has neither file: a
    // project with its own CLAUDE.md gets the whole block in AGENTS.md, so no line is lost, and one with its own
    // AGENTS.md is moved to the split by the migration, not here.
    const agentsPath = path.join(root, 'AGENTS.md');
    const agentsRel = toRepoRelative(root, agentsPath);
    const claudePath = path.join(root, 'CLAUDE.md');
    const claudeRel = toRepoRelative(root, claudePath);
    const ownClaude = isOccupied(claudePath);
    if (ownClaude) actions.push(kept(claudeRel, clone ? 'committed' : 'exists'));
    if (isOccupied(agentsPath)) {
      actions.push(kept(agentsRel, clone ? 'committed' : 'exists'));
    } else if (clone) {
      // T4 design: sync never creates an AGENTS.md (init does, once); a clone without one only reports it.
      actions.push({ kind: 'skip', path: agentsRel, reason: 'not in this clone; sync does not create one' });
    } else {
      const written = [[agentsPath, agentsRel, agentsTemplate(root, { split: !ownClaude })]];
      if (!ownClaude) written.push([claudePath, claudeRel, claudeTemplate()]);
      for (const [target, rel, content] of written) {
        createdPaths.push(target);
        writeFile(target, content, 'utf8');
        const hash = sha256(content);
        files.push({ path: rel, sha256: hash });
        actions.push(wrote(rel, hash));
      }
    }

    // The failures register, empty, under the same terms as AGENTS.md: only when the project has none, and
    // never by sync in a clone (odd/tasks/rule-hierarchy.md, T9). A `docs/` this run makes is recorded, so
    // uninstall removes it while it is empty. Its folder is judged as the hooks path is: a link that sends it
    // outside the working tree is never written through, since uninstall would not follow it back.
    const registerPath = path.join(root, 'docs', 'FAILURES.md');
    const registerRel = toRepoRelative(root, registerPath);
    const register = resolveHookContainment(root, registerPath);
    if (register.outside) {
      actions.push(kept(toForwardSlashes(register.real), 'a link sends docs/ outside the repository; the failures register is not written there', true));
    } else if (register.occupied) {
      actions.push(kept(registerRel, clone ? 'committed' : 'exists'));
    } else if (clone) {
      actions.push({ kind: 'skip', path: registerRel, reason: 'not in this clone; sync does not create one' });
    } else {
      const docsShallow = mkdirTracked(path.dirname(registerPath), root, createdDirs);
      if (docsShallow) reportedDirs.push({ absolute: docsShallow, isWorkingTree: true });
      createdPaths.push(registerPath);
      writeFile(registerPath, FAILURES_TEMPLATE, 'utf8');
      const hash = sha256(FAILURES_TEMPLATE);
      files.push({ path: registerRel, sha256: hash });
      actions.push(wrote(registerRel, hash));
    }

    // Pre-commit gate (see `writeHookGate`) and codegraph init (see `codegraphStep`): the two steps a
    // fresh clone's `sync` runs too. `codegraphCreatedThisRun` lets the rollback below know whether it
    // owns `.codegraph/` (T2e item 2).
    writeHookGate(root, spawn, writeFile, { createdPaths, createdDirs, reportedDirs, files, actions });
    if (functions.plan?.prePush) {
      writeHookGate(root, spawn, writeFile, { createdPaths, createdDirs, reportedDirs, files, actions }, HOOKS.prePush);
    }
    const codegraph = codegraphWhereWanted(root, spawn, platform, actions, functions);
    const codegraphManifest = codegraph.manifest;
    codegraphCreatedThisRun = codegraph.createdThisRun;

    // The keys of this clone's Claude settings the switches ask for (bin/lib/project-apply.mjs).
    if (functions.plan) {
      const applied = applySettings(root, [], functions.plan.settings);
      settingsRecords = applied.records;
      actions.push(...applied.actions);
    }

    // `.atl/` left out of what git calls untracked, in this clone's exclude file (./project-exclude.mjs).
    const target = excludeFile(root, spawn);
    if (target.file && target.reason) actions.push(kept(notRemovedLabel(root, target.file), target.reason));
    if (target.file && !target.reason) {
      excludePath = target.file;
      exclude = addExclude(excludePath, { writeFile });
      if (exclude) actions.push({ kind: 'excluded', path: notRemovedLabel(root, excludePath), line: EXCLUDED });
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
    if (settingsRecords.length > 0) manifest.settings = settingsRecords;
    if (exclude) manifest.exclude = exclude;
    if (formatFor(manifest)) manifest.format = formatFor(manifest);

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
    if (!clone) {
      createdPaths.push(harnessJsonPath);
      writeFile(harnessJsonPath, harnessJsonContent, 'utf8');
    }

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
    undoSettingsOnRollback(root, settingsRecords, notRemoved);
    if (exclude) {
      try {
        undoExclude(excludePath, exclude);
      } catch {
        notRemoved.push(`${EXCLUDED} in ${notRemovedLabel(root, excludePath)}`);
      }
    }
    throw new InitWriteError(err.message, notRemoved);
  }
}

/** A failed run takes back the keys it wrote, since no manifest that records them reaches the disk. */
function undoSettingsOnRollback(root, records, notRemoved) {
  if (records.length === 0) return;
  for (const action of applySettings(root, records, []).actions) {
    if (action.kind === 'failed') notRemoved.push(action.path);
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

  return writeProject(root, version, spawn, platform, writeFile, rm, manifestFilePath, manifestDeps, { preset: deps.functions });
}

/** Resolves one `files`/`dirs` manifest entry back to its absolute path: repo-relative against
 * `root` for an ordinary working-tree entry, or the entry's own absolute forward-slashed `path`
 * (converted back to the host's separator) when `gitDir: true` marks it as written into a git dir
 * outside the working tree — the same two shapes `manifestEntry`/`pathShapeFor` produce on the way
 * in (see there). Callers that have not yet validated the entry's shape (`isValidManifestEntry`)
 * must not call this: an entry claiming `gitDir: true` with a non-absolute `path` would resolve
 * relative to `process.cwd()` here, which is exactly the escape `isValidManifestEntry` exists to
 * catch first. */
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

/** True only for the two errors that mean "nothing is there" — an absent path (`ENOENT`) or a path
 * that walks through something that is not a directory where one was expected (`ENOTDIR`). Every
 * other failure (`EACCES`, `EPERM`, a transient I/O error...) means something real is blocking the
 * check, not that the target is simply gone, so it must never be read as "already removed" (T3b
 * item 3, Codex P2: an unreadable file used to be treated exactly like a missing one, silently
 * dropping the manifest's only record of it instead of keeping the manifest and failing). */
function isBenignAbsence(err) {
  return err?.code === 'ENOENT' || err?.code === 'ENOTDIR';
}

/** Whether `abs` (a manifest entry's own lexical, unresolved path) is still, right now, really
 * inside one of `bases` — following every ancestor through `realish` the same way
 * `resolveHookContainment` judges a hooks path, not just trusting `abs`'s own final path once
 * something is found there. An ancestor a link now sends outside (a directory replaced by a junction
 * to somewhere else, say) means `abs` no longer names what `init` wrote at all, even when something
 * still sits at that exact path and even happens to share the same bytes (T3b item 1, Codex P1: the
 * old code trusted `abs` once `lstat` found a plain file there, so a link redirecting an ancestor
 * made it remove — or, worse, silently content-match and remove — a file entirely outside the
 * project). `bases` is the recorded base's *real* (`fs.realpathSync`-resolved) form: the working
 * tree root for an ordinary entry, or the git dir/common git dir for one recorded `gitDir: true` —
 * exactly the bases `resolveHookContainment` judged containment against when `init` wrote it. */
function stillWithinRecordedBase(abs, bases) {
  if (bases.length === 0) return false;
  const { real } = realish(abs, bases);
  return containingBase(real, bases) !== null;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Whether one `files`/`dirs` manifest entry has the shape `init` itself would have written *and*
 * resolves inside the base that shape claims — `path` a non-empty string, `gitDir` (if present) a
 * boolean, `sha256` (required only for a `files` entry, never a `dirs` one) a 64-hex sha256 —
 * checked before anything on disk is touched (T3b item 5, Codex P2 +
 * R3-manifest-entry-shape-unvalidated: an entry missing `path`, or one whose `path` escapes its base
 * entirely — `../shared`, or a `gitDir: true` absolute path outside both git dirs — must never reach
 * `resolveManifestEntryPath`/removal at all, since a hand-edited or corrupted manifest could
 * otherwise point uninstall at an arbitrary path). This is a *lexical* containment check only, using
 * the git dirs' own unresolved form (`lexicalGitBases`) — no symlink-following happens here at all;
 * that is `stillWithinRecordedBase`'s job, done later, per file, only for entries this already
 * passed. */
function isValidManifestEntry(entry, { requireSha256, root, lexicalGitBases }) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  if (typeof entry.path !== 'string' || entry.path.length === 0) return false;
  if (entry.gitDir !== undefined && typeof entry.gitDir !== 'boolean') return false;
  if (requireSha256 && !SHA256_HEX.test(entry.sha256 ?? '')) return false;

  if (entry.gitDir) {
    if (!path.isAbsolute(entry.path.split('/').join(path.sep))) return false;
  }
  const abs = resolveManifestEntryPath(root, entry);
  const bases = entry.gitDir ? lexicalGitBases : [path.resolve(root)];
  return containingBase(abs, bases) !== null;
}

/** Whether the whole manifest has the shape `initProject` writes, checked once before any removal at
 * all (T3b item 5). `files` must be present and every entry valid; `dirs`/`codegraph` are optional
 * (an old manifest predating one of them still loads), but whichever *is* present must have the
 * right shape throughout — one bad entry anywhere invalidates the whole manifest, since a partially
 * trusted manifest is exactly the hazard this check exists to close off. */
function isValidManifestShape(manifest, root, gitBases) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (!Array.isArray(manifest.files)) return false;
  const lexicalGitBases = [gitBases.gitDir, gitBases.commonGitDir].filter(Boolean).map((p) => path.resolve(p));
  const entryOpts = { root, lexicalGitBases };
  if (!manifest.files.every((f) => isValidManifestEntry(f, { ...entryOpts, requireSha256: true }))) return false;
  if (manifest.dirs !== undefined) {
    if (!Array.isArray(manifest.dirs)) return false;
    if (!manifest.dirs.every((d) => isValidManifestEntry(d, { ...entryOpts, requireSha256: false }))) return false;
  }
  if (manifest.codegraph !== undefined) {
    if (typeof manifest.codegraph !== 'object' || manifest.codegraph === null) return false;
    if (manifest.codegraph.createdDir !== undefined && typeof manifest.codegraph.createdDir !== 'boolean') return false;
  }
  // The keys of the switches come with the format that says a copy knows them (`MANIFEST_FORMAT`).
  if (manifest.format !== undefined && !(Number.isInteger(manifest.format) && manifest.format >= 1)) return false;
  if (manifest.scope !== undefined && manifest.scope !== 'functions') return false;
  if (manifest.settings !== undefined) {
    if (manifest.format === undefined || !Array.isArray(manifest.settings)) return false;
    if (!manifest.settings.every((record) => isValidSettingsRecord(record) && (SETTINGS_KEYS[record.key].format ?? 1) <= manifest.format)) return false;
  }
  // The line of `.atl/`, with the format that says a copy knows it; its file is asked of git again, never read from here.
  if (manifest.exclude !== undefined && !(manifest.format >= 2 && isValidExcludeRecord(manifest.exclude))) return false;
  return true;
}

/** A manifest written in a format greater than this copy's: `{ code: 1, newerManifest: true, ... }`, for
 * `uninstall` and `sync` to refuse with before they touch anything; `null` for one this copy can read. */
function newerManifest(manifest, manifestPath) {
  const format = manifest?.format;
  if (!Number.isInteger(format) || format <= MANIFEST_FORMAT) return null;
  // The version reaches the terminal, so only a semver one is carried (the reason `readPin` gives).
  const version = typeof manifest.version === 'string' && SEMVER.test(manifest.version) ? manifest.version : null;
  return { code: 1, newerManifest: true, manifestPath, format, version };
}

/** The refusal of a manifest written in a format greater than this copy's (`newerManifest`). */
export function newerManifestMessage({ manifestPath, format, version }) {
  return (
    `the project manifest at ${manifestPath} was written by js-harness ${version ?? '(version not recorded)'} ` +
    `in format ${format}, and this copy reads format ${MANIFEST_FORMAT}: it undoes nothing it cannot read; ` +
    'run that version of js-harness'
  );
}

/** Every directory `init` actually created, deepest first — derived purely from the manifest's own
 * data, never by reading the real directory tree to discover what is there, so uninstall only ever
 * considers removing a directory it can name from `dirs` and the `files` written under it, never a
 * sibling directory added later for an unrelated reason (T3b item 2, Codex P2: the old bottom-up
 * walk read the *real* tree and recursed into anything it found, so an empty directory added after
 * init — e.g. `custom/cache` — was silently swept up and removed too, even though init never made
 * it). Each `dirs` entry only ever records the *shallowest* ancestor a single
 * `mkdirSync(dir, { recursive: true })` created; the full chain down to the file it was made for is
 * reconstructed by walking that file's own recorded directory back up to (and including) the `dirs`
 * entry's own path, one path segment at a time — every directory along the way, and only those, is
 * init's to remove. Everything here stays in the manifest's own string shape (`path`/`gitDir`); no
 * real filesystem access happens until the caller resolves and touches disk. */
function directoriesToPrune(manifest) {
  const chain = new Map(); // `${gitDir}\u0000${path}` -> { path, gitDir } (dedup across files)
  for (const dirEntry of manifest.dirs ?? []) {
    const gitDirFlag = !!dirEntry.gitDir;
    for (const file of manifest.files) {
      if (!!file.gitDir !== gitDirFlag) continue;
      if (file.path !== dirEntry.path && !file.path.startsWith(`${dirEntry.path}/`)) continue;
      const lastSlash = file.path.lastIndexOf('/');
      if (lastSlash === -1) continue; // the file sits directly at the repo/git-dir root: no chain
      let current = file.path.slice(0, lastSlash);
      for (;;) {
        chain.set(`${gitDirFlag}\u0000${current}`, { path: current, gitDir: gitDirFlag });
        if (current === dirEntry.path) break;
        const idx = current.lastIndexOf('/');
        if (idx === -1) break; // defensive: should not happen once current === dirEntry.path above
        current = current.slice(0, idx);
      }
    }
  }
  return [...chain.values()].sort((a, b) => b.path.split('/').length - a.path.split('/').length);
}

/** Removes one directory `directoriesToPrune` named, but only if it is now empty — never a
 * directory with real content in it (T3 design's "remove each when empty"), and this function never
 * reads anything but that one directory's own listing; the *set* of directories ever considered
 * comes entirely from `directoriesToPrune`, from the manifest, not from walking disk (T3b item 2).
 * Absence (`ENOENT`/`ENOTDIR`) is not a failure — the directory is already gone, nothing to report
 * either way; any other `readdir` failure keeps the manifest and fails the run, same as a file's
 * (T3b item 3). */
function removeDirectoryIfEmpty(root, dirEntry, bases, rm, readdir, notRemoved, actions) {
  const abs = resolveManifestEntryPath(root, dirEntry);
  const isWorkingTreeDir = !dirEntry.gitDir;
  // The same real-containment check a file gets: a directory reached through an ancestor a link now
  // sends outside is not what `init` created, however empty it is (T3c,
  // R3-dir-prune-follows-ancestor-link).
  if (!stillWithinRecordedBase(abs, bases)) {
    actions.push({ kind: 'kept', path: pathShapeFor(root, abs, isWorkingTreeDir), reason: 'moved outside' });
    return;
  }
  let remaining;
  try {
    remaining = readdir(abs);
  } catch (err) {
    if (isBenignAbsence(err)) return;
    const label = pathShapeFor(root, abs, isWorkingTreeDir);
    notRemoved.push(label);
    actions.push({ kind: 'failed', path: label, reason: err.message });
    return;
  }
  if (remaining.length > 0) return; // real content left behind — never this run's to remove
  const label = pathShapeFor(root, abs, isWorkingTreeDir);
  try {
    rm(abs, { recursive: true, force: true });
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
 * are; no `writeFile` here, since uninstall never writes anything. `deps.lstat`/`readFile`/`readdir`
 * are the read-side equivalent (T3b item 3): a test forces one of them to fail with something other
 * than absence, to prove that keeps the manifest and fails the run rather than being read as "already
 * gone".
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
 *   JSON, or does not have the shape `initProject` writes (T3b item 5).
 * - `{ code, root, manifestPath, actions, notRemoved }` — the ordinary result: `actions` is in
 *   report order (`removed`/`kept`/`alreadyGone`/`codegraphRemoved`/`failed`/`manifestRemoved`),
 *   `code` is 1 exactly when `notRemoved` is non-empty (a kept, unchanged file is not a failure —
 *   T3 design). On any failure the manifest itself is left in place so a second `uninstallProject`
 *   run can finish the job; anything already removed simply reports `alreadyGone` on that rerun. */
export function uninstallProject(cwd, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  const rm = deps.rm ?? fs.rmSync;
  // Independently injectable (T3b item 3), the same way `initProject`'s `writeFile`/`rm` are: real
  // permission failures are unreliable to reproduce on Windows (chmod does not restrict owner read
  // access the same way POSIX does), so a test forces one of these instead.
  const lstat = deps.lstat ?? fs.lstatSync;
  const readFile = deps.readFile ?? ((p) => fs.readFileSync(p, 'utf8'));
  const readdir = deps.readdir ?? fs.readdirSync;

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

  // T2e item 4's bases, recomputed here (never threaded from `initProject`: uninstall may run in a
  // whole separate process, possibly long after init did) — used both to validate the manifest's own
  // shape below and, per file, to re-check real containment (T3b items 1 and 5).
  const newer = newerManifest(manifest, manifestFilePath);
  if (newer) return newer;
  const gitBases = gitDirs(root, spawn);
  if (!isValidManifestShape(manifest, root, gitBases)) {
    return { code: 1, malformedManifest: true, manifestPath: manifestFilePath };
  }
  const realRoot = fs.realpathSync(root);
  const realGitDirBases = [safeRealpath(gitBases.gitDir), safeRealpath(gitBases.commonGitDir)].filter(Boolean);

  const actions = [];
  const notRemoved = [];

  for (const file of manifest.files) {
    const abs = resolveManifestEntryPath(root, file);
    const bases = file.gitDir ? realGitDirBases : [realRoot];
    if (!stillWithinRecordedBase(abs, bases)) {
      // A link along the way now sends this entry somewhere else entirely (T3b item 1, Codex P1) —
      // whatever is or is not at that redirected location is simply not this run's to judge.
      actions.push({ kind: 'kept', path: file.path, reason: 'moved outside' });
      continue;
    }
    let stat;
    try {
      stat = lstat(abs);
    } catch (err) {
      if (isBenignAbsence(err)) {
        actions.push({ kind: 'alreadyGone', path: file.path });
      } else {
        notRemoved.push(file.path);
        actions.push({ kind: 'failed', path: file.path, reason: err.message });
      }
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
      content = readFile(abs);
    } catch (err) {
      if (isBenignAbsence(err)) {
        actions.push({ kind: 'alreadyGone', path: file.path });
      } else {
        notRemoved.push(file.path);
        actions.push({ kind: 'failed', path: file.path, reason: err.message });
      }
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

  for (const dirEntry of directoriesToPrune(manifest)) {
    const bases = dirEntry.gitDir ? realGitDirBases : [realRoot];
    removeDirectoryIfEmpty(root, dirEntry, bases, rm, readdir, notRemoved, actions);
  }

  // Each key of this clone's settings goes back to what was there, if it still holds what was written.
  const settings = applySettings(root, manifest.settings ?? [], []);
  for (const action of settings.actions) {
    if (action.kind === 'failed') notRemoved.push(action.path);
    actions.push(action);
  }

  // The line of `.atl/` init added to this clone's exclude file, in the file git names now.
  if (manifest.exclude) {
    const target = excludeFile(root, spawn);
    const label = `${EXCLUDED} from ${target.file ? notRemovedLabel(root, target.file) : 'info/exclude'}`;
    try {
      if (target.reason) throw new Error(target.reason);
      const undone = undoExclude(target.file, manifest.exclude, { rm });
      actions.push({ kind: undone === 'removed' ? 'removed' : 'alreadyGone', path: label });
    } catch (err) {
      notRemoved.push(label);
      actions.push({ kind: 'failed', path: label, reason: err.message });
    }
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

// --- T4: `sync` in a project (see odd/tasks/project-init.md, "T4 design") ---

/** The refusal `init` and `sync` share for a manifest that survives without `harness.json` (T2c item 1):
 * this clone was initialized before, then lost `harness.json`, so neither builds on the stale record. */
export function staleManifestMessage(manifestPath) {
  return (
    `this clone was initialized before (manifest: ${manifestPath}) but harness.json is missing: ` +
    'restore harness.json, or run js-harness uninstall first'
  );
}

/** The refusal `sync` and `status` share for a `harness.json` whose pin cannot be used (T4 design, T5
 * design): the file and the reason `readPin` gave, without a claim about writes — `sync` adds its own. */
export function invalidHarnessJsonMessage(harnessJsonPath, reason) {
  return `cannot read the pin from ${harnessJsonPath}: ${reason}`;
}

/** How a project with no pin gets one, the clause `status` and `sync` share (install-update T6): the
 * pin is one line written by hand, since no command writes into a `harness.json` that already exists.
 * `version` is the running js-harness, never a value read from the project. */
export function howToPinClause(version) {
  return `add "version": "${version}" to harness.json and commit it`;
}

/** What an `InitWriteError`'s best-effort rollback actually left behind, in one clause — never
 * overclaiming "nothing was left behind" when something could not be removed (T2c
 * R3-nothing-left-behind-overclaims). Shared by `init` and `sync`, which both throw `InitWriteError`.
 * `.codegraph/` is part of the same rollback as everything else whenever the failed run is the one that
 * created it (T2e item 2), so a failure to remove it shows up in `notRemoved` like any other path. The
 * one case where `.codegraph/` is deliberately left untouched (a retry whose directory already existed,
 * still truthfully owned by the older, unrewritten manifest) is not a removal failure at all, so it never
 * reaches `notRemoved` and needs no disclosure here. */
export function cleanupClause(err) {
  if (err.notRemoved.length === 0) return 'nothing was left behind';
  return `could not remove: ${err.notRemoved.join(', ')}`;
}

/** Writes the recorded pre-commit gate again when it is gone (T4 design: "a recorded hook that is
 * gone is written again (when its path is free and still contained)"). The entry is the `files` record
 * whose file is named `pre-commit`; anything already at its path — the hook itself, an edited copy, a
 * foreign file — is left exactly as it is, since sync moves nothing it did not write. When the path is
 * gone, it is judged like `init` judges a hook: through the same real-path containment, so a directory a
 * link now sends outside the repository, or a link sitting at the path, is reported `kept`, never
 * written through. A directory this has to create is recorded in `manifest.dirs` (like `init` does) so
 * `uninstall` still restores the repository as it was when sync started. Mutates `manifest` (the
 * `dirs`/`sha256` it now records) and the run's `createdPaths`/`createdDirs`/`actions`. */
function restoreRecordedHook(root, manifest, gitBases, writeFile, createdPaths, createdDirs, actions, hook = HOOKS.preCommit) {
  const entry = recordedHook(manifest, hook);
  if (!entry) return;
  const abs = resolveManifestEntryPath(root, entry);
  if (fs.existsSync(abs)) return; // present, whatever its content: never overwritten

  const { real, outside, occupied, isWorkingTree, viaLink, base } = resolveHookContainment(root, abs, gitBases);
  if (outside) {
    const reason = viaLink
      ? 'a link now sends its directory outside the repository; not written again'
      : 'it is outside the repository; not written again';
    actions.push(kept(toForwardSlashes(real), reason, true));
    return;
  }
  const label = pathShapeFor(root, abs, isWorkingTree);
  if (occupied) {
    actions.push(kept(label, 'a link is in its path; not written again', false, !isWorkingTree));
    return;
  }

  const shallow = mkdirTracked(path.dirname(abs), base, createdDirs);
  if (shallow) {
    const dirEntry = manifestEntry(root, shallow, isWorkingTree);
    manifest.dirs = manifest.dirs ?? [];
    if (!manifest.dirs.some((d) => d.path === dirEntry.path && !!d.gitDir === !!dirEntry.gitDir)) {
      manifest.dirs.push(dirEntry);
    }
  }
  createdPaths.push(abs);
  writeFile(abs, hook.content, 'utf8');
  fs.chmodSync(abs, 0o755);
  entry.sha256 = sha256(hook.content);
  actions.push(wrote(label, entry.sha256, !isWorkingTree));
}

/** The sync of a clone that already has its manifest (T4 design, "Pin equal, manifest present"): the
 * manifest is validated the way `uninstallProject` does before anything is touched, then a recorded
 * hook that is gone is written again and an absent `.codegraph/` is created by `codegraph init`
 * (`createdDir` recorded as observed, like the retry in `alreadyInitialized`); everything else stays as
 * is. The manifest is rewritten atomically only when its content actually changed. A failure rolls back
 * every file, directory and `.codegraph/` this run created, so what is on disk and what the manifest
 * says never disagree. */
function syncRecorded(root, version, manifestFilePath, spawn, platform, writeFile, rm, manifestDeps) {
  const read = readRecorded(root, manifestFilePath, spawn);
  if (read.code) return read;
  const steps = { sync: true, version, manifestFilePath, spawn, platform, writeFile, rm, manifestDeps };
  return updateRecorded(root, read.manifest, read.gitBases, steps);
}

/** The project manifest at `manifestFilePath`, validated before anything is touched: `{ manifest, gitBases }`,
 * or the refusal (`malformedManifest`, `newerManifest`) to return as it is. */
function readRecorded(root, manifestFilePath, spawn) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf8'));
  } catch (err) {
    return { code: 1, malformedManifest: true, manifestPath: manifestFilePath, reason: err.message };
  }
  const newer = newerManifest(manifest, manifestFilePath);
  if (newer) return newer;
  const gitBases = gitDirs(root, spawn);
  if (!isValidManifestShape(manifest, root, gitBases)) {
    return { code: 1, malformedManifest: true, manifestPath: manifestFilePath };
  }
  return { manifest, gitBases };
}

/** What `sync` and `functions apply` change in a clone, recorded in `manifest`: with `sync`, the version
 * that ran, a recorded pre-commit gate that is gone and the `.atl/` exclude line of a clone set up before `init`
 * added it; for both, what the switches ask (the push check, the index, the keys of the settings). */
function updateRecorded(root, manifest, gitBases, steps) {
  const { sync, version, manifestFilePath, spawn, platform, writeFile, rm, manifestDeps } = steps;
  const next = JSON.parse(JSON.stringify(manifest));
  const actions = [];
  const createdPaths = [];
  const createdDirs = [];
  let codegraphCreatedThisRun = false;
  let manifestChanged = false;
  let writtenSettings = [];
  let excludeAdded = null;

  try {
    if (sync && next.version !== version) {
      actions.push({ kind: 'versionRecorded', from: next.version, to: version });
      next.version = version;
    }
    if (sync && next.scope === 'functions') {
      // A manifest `functions apply` wrote holds no gate: sync sets the clone up the rest of the way.
      writeHookInto(root, next, HOOKS.preCommit, { spawn, writeFile, createdPaths, createdDirs, actions });
      delete next.scope;
    } else if (sync) {
      restoreRecordedHook(root, next, gitBases, writeFile, createdPaths, createdDirs, actions);
    }
    const functions = functionsPlan(root, spawn);
    if (functions.errors) actions.push(functionsProblem(functions.errors));
    if (functions.plan) {
      syncPrePush(root, next, gitBases, functions.plan.prePush, { spawn, writeFile, rm, createdPaths, createdDirs, actions });
    }
    if (functions.plan?.index === 'make') {
      const { manifest: codegraphManifest, reason } = initCodegraph(root, spawn, platform);
      next.codegraph = codegraphManifest;
      codegraphCreatedThisRun = codegraphManifest.createdDir === true;
      actions.push(
        reason ? { kind: 'problem', path: 'codegraph init', reason } : { kind: 'ran', path: 'codegraph init' },
      );
    } else if (functions.plan?.index === 'remove') {
      removeRecordedIndex(root, next, rm, actions);
    }
    if (functions.plan) {
      const before = next.settings ?? [];
      const applied = applySettings(root, before, functions.plan.settings);
      writtenSettings = applied.written;
      actions.push(...applied.actions);
      setSettings(next, applied.records);
    }
    // A clone `init` set up before it wrote the `.atl/` line gets it here, recorded as `init` records it; a record
    // already there is left alone, so a line somebody took out stays out (odd/tasks/sync-exclude.md).
    if (sync && !next.exclude) {
      const target = excludeFile(root, spawn);
      if (target.file && target.reason) actions.push(kept(notRemovedLabel(root, target.file), target.reason));
      const record = target.file && !target.reason ? addExclude(target.file, { writeFile }) : null;
      if (record) {
        excludeAdded = { file: target.file, record };
        next.exclude = record;
        next.format = formatFor(next);
        actions.push({ kind: 'excluded', path: notRemovedLabel(root, target.file), line: EXCLUDED });
      }
    }
    manifestChanged = JSON.stringify(next) !== JSON.stringify(manifest);
    if (manifestChanged) {
      mkdirTracked(path.dirname(manifestFilePath), root, createdDirs);
      writeManifestAtomic(manifestFilePath, next, manifestDeps);
    }
  } catch (err) {
    const notRemoved = rollback(root, createdPaths, createdDirs, rm);
    undoSettingsOnRollback(root, writtenSettings, notRemoved);
    if (excludeAdded) {
      try {
        undoExclude(excludeAdded.file, excludeAdded.record);
      } catch {
        notRemoved.push(`${EXCLUDED} in ${notRemovedLabel(root, excludeAdded.file)}`);
      }
    }
    // codegraph only runs when `.codegraph/` is absent, so one it made is this run's alone, whatever
    // the old manifest says about an earlier directory (T4b, Codex P2).
    if (codegraphCreatedThisRun) {
      try {
        rm(codegraphDirPath(root), { recursive: true, force: true });
      } catch {
        notRemoved.push(toRepoRelative(root, codegraphDirPath(root)));
      }
    }
    throw new InitWriteError(err.message, notRemoved);
  }

  // Up to date means nothing was written: a `kept` or `problem` action that repeats on every run only
  // reports (T4b, R2-uptodate-conflates-reported-with-changed).
  const upToDate = !manifestChanged && createdPaths.length === 0 && !codegraphCreatedThisRun;
  return { code: 0, root, manifestPath: manifestFilePath, actions, manifest: next, version, upToDate };
}

/** The manifest's entry of the hook `hook`, found by its name under the hooks path. */
function recordedHook(manifest, hook) {
  return manifest.files.find((f) => f.path.split('/').pop() === hook.name);
}

/** `writeHookGate` for a clone that has its manifest: the hook and any folder made for it are recorded in
 * `manifest` itself. */
function writeHookInto(root, manifest, hook, { spawn, writeFile, createdPaths, createdDirs, actions }) {
  const reportedDirs = [];
  writeHookGate(root, spawn, writeFile, { createdPaths, createdDirs, reportedDirs, files: manifest.files, actions }, hook);
  for (const { absolute, isWorkingTree } of reportedDirs) {
    const dirEntry = manifestEntry(root, absolute, isWorkingTree);
    manifest.dirs = manifest.dirs ?? [];
    if (!manifest.dirs.some((d) => d.path === dirEntry.path && !!d.gitDir === !!dirEntry.gitDir)) manifest.dirs.push(dirEntry);
  }
}

/** The push check of a clone that has its manifest: written where the Codex review is on and no record of it
 * is there, written again where its record is and the file is gone (`restoreRecordedHook`), and taken away
 * where the review is off, only while it holds what was written; a hook somebody changed is theirs. */
function syncPrePush(root, manifest, gitBases, wanted, { spawn, writeFile, rm, createdPaths, createdDirs, actions }) {
  const entry = recordedHook(manifest, HOOKS.prePush);
  if (wanted && entry) {
    restoreRecordedHook(root, manifest, gitBases, writeFile, createdPaths, createdDirs, actions, HOOKS.prePush);
  } else if (wanted) {
    writeHookInto(root, manifest, HOOKS.prePush, { spawn, writeFile, createdPaths, createdDirs, actions });
  } else if (entry) {
    const abs = resolveManifestEntryPath(root, entry);
    // The real-path containment `uninstall` checks (T3b item 1): a link along the way that now sends the
    // hook somewhere else makes it not this run's to judge, let alone remove.
    const realBases = entry.gitDir
      ? [safeRealpath(gitBases.gitDir), safeRealpath(gitBases.commonGitDir)].filter(Boolean)
      : [fs.realpathSync(root)];
    if (!stillWithinRecordedBase(abs, realBases)) {
      actions.push(kept(entry.path, 'moved outside'));
      return;
    }
    const there = fs.existsSync(abs);
    if (there && !(fs.lstatSync(abs).isFile() && matchesRecordedHash(fs.readFileSync(abs, 'utf8'), entry.sha256))) {
      actions.push(kept(entry.path, 'changed since it was written; the Codex review is off here, so remove it yourself'));
      return;
    }
    if (there) rm(abs, { force: true });
    manifest.files = manifest.files.filter((f) => f !== entry);
    actions.push(there ? { kind: 'removed', path: entry.path } : { kind: 'alreadyGone', path: entry.path });
  }
}

/** The manifest's `settings`, with the format that a copy reading it must know (`formatFor`); both go when no key is
 * left and nothing else needs the format, so a manifest with nothing of the switches stays one that any copy reads. */
function setSettings(manifest, records) {
  if (records.length > 0) manifest.settings = records;
  else delete manifest.settings;
  const format = formatFor(manifest);
  if (format) manifest.format = format;
  else delete manifest.format;
}

/** A declared `off` takes the index away, only when the manifest says the harness made it. */
function removeRecordedIndex(root, manifest, rm, actions) {
  if (manifest.codegraph?.createdDir !== true) {
    actions.push({ kind: 'kept', path: '.codegraph', reason: 'the code map is declared off, but js-harness did not make this index' });
    return;
  }
  rm(codegraphDirPath(root), { recursive: true, force: true });
  manifest.codegraph = { ...NO_INDEX };
  actions.push({ kind: 'removed', path: '.codegraph' });
}

/** Where a repository keeps what `init` leaves: the committed `harness.json` and this clone's project
 * manifest (under the git dir, resolved the way git itself does), and whether each is there. Occupied
 * counts a dangling link as present, like every other check in this module (see `isOccupied`). */
function projectFiles(root, spawn) {
  const harnessJsonPath = path.join(root, 'harness.json');
  const manifestFilePath =
    resolveGitPath(root, 'js-harness/manifest.json', spawn) ?? path.join(root, '.git', 'js-harness', 'manifest.json');
  return {
    harnessJsonPath,
    manifestFilePath,
    harnessJsonPresent: isOccupied(harnessJsonPath),
    manifestPresent: isOccupied(manifestFilePath),
  };
}

/** The version `harness.json` pins: `{ pin }`; `{ noPin: true }` when the file is a JSON object with no
 * `version` at all, which is a project with no pin and not a broken file (install-update T6: a
 * `harness.json` written by hand holds settings and no version); or `{ invalid: reason }` when the file
 * cannot be read, is not a JSON object, or has a `version` that is not a semver string. A committed pin
 * reaches the terminal inside a suggested install command, so a cloned repository must not be able to
 * smuggle shell or escape sequences through it (T4c, R1-001); the same holds for a reason, so those are fixed text or an error
 * code, never the parser's message (which quotes the file's own bytes). The one reading `syncProject`
 * and `projectLocation` share. */
function readPin(harnessJsonPath) {
  let text;
  try {
    text = fs.readFileSync(harnessJsonPath, 'utf8');
  } catch (err) {
    return { invalid: `it cannot be read (${/^[A-Z0-9_]+$/.test(err?.code) ? err.code : 'unknown error'})` };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { invalid: 'it is not valid JSON' };
  }
  const isObject = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
  if (!isObject) return { invalid: 'it is not a JSON object' };
  if (!Object.hasOwn(parsed, 'version')) return { noPin: true };
  const pin = parsed.version;
  if (typeof pin !== 'string' || pin.length === 0) return { invalid: 'it has no string "version"' };
  if (!SEMVER.test(pin)) return { invalid: 'its "version" is not a semver version' };
  return { pin };
}

/** Whether the project manifest at `manifestPath` is one `functions apply` wrote, holding the switches and no
 * gate (its `scope`). A manifest that cannot be read is not: `sync` and `uninstall` say what is wrong with it. */
function holdsFunctionsOnly(manifestPath) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))?.scope === 'functions';
  } catch {
    return false;
  }
}

/** Where a folder stands, read-only (T5 design): what the TUI's menu and `status` both branch on. Writes
 * nothing, ever, and takes only `deps.spawn` (for `git`). One of:
 * - `{ kind: 'noSuchDirectory', cwd }`
 * - `{ kind: 'notGit' }` — outside any git repository.
 * - `{ kind: 'notInitialized', root }` — a repository `init` never touched (no `harness.json`, no manifest).
 * - `{ kind: 'initialized', root, pin, harnessJsonPath, manifestPath, manifestPresent, functionsOnly }` —
 *   `manifestPresent` is false in a fresh clone of an initialized project, until `sync` sets it up;
 *   `functionsOnly` is true where the manifest holds only what `functions apply` wrote.
 * - `{ kind: 'staleManifest', root, manifestPath }` — a manifest survives without `harness.json`.
 * - `{ kind: 'noPin', root, harnessJsonPath, manifestPath, manifestPresent, functionsOnly }` — `harness.json` is an object
 *   with no `version`: a project with no pin.
 * - `{ kind: 'invalidHarnessJson', root, harnessJsonPath, reason }` — the pin is unusable, for the same
 *   reasons `syncProject` gives. */
export function projectLocation(cwd, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  if (!fs.existsSync(cwd)) return { kind: 'noSuchDirectory', cwd };

  const root = gitTopLevel(cwd, spawn);
  if (!root) return { kind: 'notGit' };

  const { harnessJsonPath, manifestFilePath, harnessJsonPresent, manifestPresent } = projectFiles(root, spawn);
  if (!harnessJsonPresent && !manifestPresent) return { kind: 'notInitialized', root };
  if (!harnessJsonPresent) return { kind: 'staleManifest', root, manifestPath: manifestFilePath };

  const pinned = readPin(harnessJsonPath);
  if (pinned.invalid) return { kind: 'invalidHarnessJson', root, harnessJsonPath, reason: pinned.invalid };
  const manifest = { manifestPath: manifestFilePath, manifestPresent, functionsOnly: manifestPresent && holdsFunctionsOnly(manifestFilePath) };
  if (pinned.noPin) return { kind: 'noPin', root, harnessJsonPath, ...manifest };
  return { kind: 'initialized', root, pin: pinned.pin, harnessJsonPath, ...manifest };
}

/** Runs `js-harness sync` against the git repository at `cwd`'s top-level: moves the project to the
 * version its `harness.json` pins. `version` is the running js-harness. Nothing `init` writes depends on
 * the version, so this never installs or rewrites anything for a version change: a pin different from
 * `version` writes nothing and is reported with both ways out (T4 design). Returns one of:
 * - `{ code: 1, noSuchDirectory: true, cwd }` / `{ code: 1, notGitRepo: true }` — as `initProject`.
 * - `{ code: 1, notInitialized: true }` — a git repository with neither `harness.json` nor a manifest;
 *   the caller (`syncMain`) reports it and names `--global`, never falling through to the machine.
 * - `{ code: 1, staleManifest: true, manifestPath }` — a manifest but no `harness.json`.
 * - `{ code: 1, invalidHarnessJson: true, harnessJsonPath, reason }` — `harness.json` is unreadable, not a
 *   JSON object, or has a `version` that is not semver (T4c: the pin is printed inside a suggested
 *   install command).
 * - `{ code: 1, noPin: true, harnessJsonPath, version }` — `harness.json` holds no `version`, so there is
 *   nothing to move the project to; nothing is written, a clone that is not set up included.
 * - `{ code: 1, pinMismatch: true, pin, version }` — the pin is not the running version.
 * - `{ code: 1, malformedManifest: true, manifestPath, reason? }` — as `uninstallProject`.
 * - `{ code: 0, root, actions, manifest, manifestPath, version, setUp: true }` — a fresh clone (no
 *   manifest): set up the way `init` would be, with `harness.json` and an existing `AGENTS.md` recorded
 *   as `kept` (committed) and never written; an `AGENTS.md` it lacks is reported as a skip, not created.
 * - `{ code: 0, root, actions, manifest, manifestPath, version, upToDate }` — a clone with its manifest;
 *   `upToDate` is true, with no actions and nothing written, when there was nothing to do.
 * Throws `InitWriteError` when a write step fails — see `writeProject` and `syncRecorded`. */
export function syncProject(cwd, version, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  const platform = deps.platform ?? process.platform;
  const writeFile = deps.writeFile ?? fs.writeFileSync;
  const rm = deps.rm ?? fs.rmSync;
  const lstat = deps.lstat ?? fs.lstatSync;
  const manifestDeps = { open: deps.open, write: deps.write, close: deps.close };

  if (!fs.existsSync(cwd)) return { code: 1, noSuchDirectory: true, cwd };

  const root = gitTopLevel(cwd, spawn);
  if (!root) return { code: 1, notGitRepo: true };

  const { harnessJsonPath, manifestFilePath, harnessJsonPresent, manifestPresent } = projectFiles(root, spawn);

  if (!harnessJsonPresent && !manifestPresent) return { code: 1, notInitialized: true };
  if (!harnessJsonPresent) return { code: 1, staleManifest: true, manifestPath: manifestFilePath };

  const pinned = readPin(harnessJsonPath);
  if (pinned.invalid) return { code: 1, invalidHarnessJson: true, harnessJsonPath, reason: pinned.invalid };
  if (pinned.noPin) return { code: 1, noPin: true, harnessJsonPath, version };
  const { pin } = pinned;
  if (pin !== version) return { code: 1, pinMismatch: true, pin, version };

  if (!manifestPresent) {
    const result = writeProject(root, version, spawn, platform, writeFile, rm, manifestFilePath, manifestDeps, { clone: true });
    return syncTemplateBlock(root, { ...result, version, setUp: true }, writeFile, lstat);
  }
  return syncTemplateBlock(root, syncRecorded(root, version, manifestFilePath, spawn, platform, writeFile, rm, manifestDeps), writeFile, lstat);
}

/** `result`, a sync that set the clone up or brought it to its pin, with the harness's block of its `AGENTS.md` and its
 * `CLAUDE.md` rendered again when the project has not edited it (`renderTemplateBlock`, odd/tasks/rule-hierarchy.md,
 * T16f): a `rendered` action each, and no longer up to date. A project whose `CLAUDE.md` holds a block has the split
 * (odd/tasks/f8-s3-split.md, S3), and each file gets its half; any other keeps the whole block in `AGENTS.md`, so a
 * project not yet moved loses no line. An edited block is a `kept` action, said on every sync, and writes nothing. The
 * files are committed ones, so git is what undoes the write; no manifest records it. A refusal is returned as it is. */
function syncTemplateBlock(root, result, writeFile, lstat = fs.lstatSync) {
  if (result.code !== 0) return result;
  const claude = blockFileOf(root, 'CLAUDE.md', lstat);
  const split = claude.text !== undefined && TEMPLATE_BLOCK_MARK.test(claude.text);
  let synced = renderBlockIn(root, 'AGENTS.md', blockFileOf(root, 'AGENTS.md', lstat), split ? agentsBlock() : templateBlock(), result, writeFile);
  if (split) synced = renderBlockIn(root, 'CLAUDE.md', claude, claudeBlock(), synced, writeFile);
  return synced;
}

/** The file `name` of `root` as a block can be rendered in: `{ text }`, `{ link: true, text }` for a link (read, never
 * written through: git holds the link, not its target, so it could not give the target back; Codex, 2026-10-17), or
 * `{}` when there is no regular file to read. */
function blockFileOf(root, name, lstat) {
  const file = path.join(root, name);
  let link;
  try {
    const stat = lstat(file);
    if (!stat.isSymbolicLink() && !stat.isFile()) return {};
    link = stat.isSymbolicLink();
    return { ...(link && { link }), text: fs.readFileSync(file, 'utf8') };
  } catch {
    return link ? { link } : {}; // No file, or none that can be read: there is no block to render.
  }
}

/** `result` with the block of the file `name` rendered as `body`, as `syncTemplateBlock` says. */
function renderBlockIn(root, name, file, body, result, writeFile) {
  if (result.code !== 0) return result;
  if (file.link) return { ...result, actions: [...result.actions, kept(name, 'it is a link, so sync does not write through it')] };
  if (file.text === undefined) return result;
  const rendered = renderTemplateBlock(file.text, body);
  if (rendered.state === 'edited') {
    return { ...result, actions: [...result.actions, kept(name, "its block of the harness's lines was edited, so sync does not render it again")] };
  }
  if (rendered.state !== 'rendered') return result;
  try {
    writeFile(path.join(root, name), rendered.text, 'utf8');
  } catch (err) {
    // The sync did not finish, so it exits non-zero and is not up to date.
    return { ...result, code: 1, upToDate: false, actions: [...result.actions, { kind: 'problem', path: name, reason: `its block of the harness's lines could not be rendered again (${err.message})` }] };
  }
  return { ...result, actions: [...result.actions, { kind: 'rendered', path: name }], upToDate: false };
}

/** Runs `js-harness functions apply` against the git repository at `cwd`'s top-level: makes this clone what
 * the switches of its `harness.json` ask (odd/tasks/on-demand-functions.md), with no pin needed, so a project
 * whose `harness.json` holds no `version` (this repository's) can apply them too. It writes nothing else of
 * `init` or `sync`: no gate is written again and no version is recorded. Returns one of:
 * - `{ code: 1, noSuchDirectory: true, cwd }` / `{ code: 1, notGitRepo: true }` — as `initProject`;
 * - `{ code: 1, notInitialized: true, root }` — no `harness.json`, so no switch to apply;
 * - `{ code: 1, malformedManifest | newerManifest ... }` — as `syncProject`;
 * - `{ code: 0, root, actions, manifest, manifestPath, upToDate }`. Where no project manifest exists, one is
 *   written that holds only what was applied (its `files` empty), and only when something was; `uninstall`
 *   then undoes that and never touches a `harness.json` it did not write.
 * Throws `InitWriteError` when a write step fails, as `syncProject` does. */
export function applyProjectFunctions(cwd, version, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  const platform = deps.platform ?? process.platform;
  const writeFile = deps.writeFile ?? fs.writeFileSync;
  const rm = deps.rm ?? fs.rmSync;
  const manifestDeps = { open: deps.open, write: deps.write, close: deps.close };

  if (!fs.existsSync(cwd)) return { code: 1, noSuchDirectory: true, cwd };
  const root = gitTopLevel(cwd, spawn);
  if (!root) return { code: 1, notGitRepo: true };

  const { manifestFilePath, harnessJsonPresent, manifestPresent } = projectFiles(root, spawn);
  if (!harnessJsonPresent) return { code: 1, notInitialized: true, root };

  const steps = { sync: false, version, manifestFilePath, spawn, platform, writeFile, rm, manifestDeps };
  if (manifestPresent) {
    const read = readRecorded(root, manifestFilePath, spawn);
    if (read.code) return read;
    return updateRecorded(root, read.manifest, read.gitBases, steps);
  }
  const indexThere = fs.existsSync(codegraphDirPath(root));
  // `scope` says this manifest holds the switches alone, no gate: `status` says so and `sync` sets the rest up.
  const codegraph = indexThere ? { createdDir: false, status: 'exists' } : { ...NO_INDEX };
  const empty = { version, scope: 'functions', files: [], kept: [], codegraph, dirs: [] };
  return updateRecorded(root, empty, gitDirs(root, spawn), steps);
}

/** The switch a settings key belongs to, for the words of a difference. */
const SWITCH_OF_KEY = { paste: 'codeMap', languageServer: 'languageServer' };

/** The JSON of `file`, or `fallback` where it is not there or cannot be read: a read-only report reports no
 * failure of its own. A byte-order mark is no part of the JSON. */
function jsonOr(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return fallback;
  }
}

/** What this clone lacks of what its switches ask, read-only, for the gate's `functions` row: one line a
 * difference, in the words of the switch that asks it, which `functions apply` would make good. `[]` where the
 * clone is what they ask, outside a repository, or where the switches cannot be read (that is the row's
 * failure, not a difference). A key that holds another value is apply's to report, never to change, so only a
 * key that is not there counts; a pre-push hook of the project's own counts as there. */
export function clonePending(cwd, { spawn = spawnSync } = {}) {
  const root = gitTopLevel(cwd, spawn);
  if (!root) return [];
  const { plan, resolved } = functionsPlan(root, spawn);
  if (!plan) return [];
  const lines = [];
  const say = (name, text) => lines.push(`${name} ${resolved[name].value}: ${text}`);
  const manifestPath = resolveGitPath(root, 'js-harness/manifest.json', spawn) ?? path.join(root, '.git', 'js-harness', 'manifest.json');
  const manifest = jsonOr(manifestPath, null);
  // A clone the harness never set up (no `init`, no `functions apply`) has nothing to drift from.
  if (manifest === null) return [];

  if (plan.index === 'make') say('codeMap', 'no code map index here (.codegraph)');
  if (plan.index === 'remove' && manifest?.codegraph?.createdDir === true) say('codeMap', 'the code map index js-harness made is still here');

  const settings = jsonOr(path.join(root, ...SETTINGS_FILE.split('/')), {});
  for (const key of plan.settings) {
    const pending = settingPending(key, settings);
    if (pending !== null) SWITCH_OF_KEY[key] ? say(SWITCH_OF_KEY[key], pending) : lines.push(`every clone: ${pending}`);
  }
  const records = Array.isArray(manifest?.settings) ? manifest.settings.filter(isValidSettingsRecord) : [];
  for (const record of records) {
    if (plan.settings.includes(record.key)) continue;
    if (JSON.stringify(valueAt(settings, record.pointer)) === JSON.stringify(record.value)) {
      say(SWITCH_OF_KEY[record.key], `${settingLabel(record.pointer)} is still ${JSON.stringify(record.value)}`);
    }
  }

  const hookPath = resolveGitPath(root, 'hooks/pre-push', spawn);
  const hookThere = Boolean(hookPath) && fs.existsSync(hookPath);
  const recorded = Array.isArray(manifest?.files) && manifest.files.some((f) => typeof f?.path === 'string' && f.path.split('/').pop() === 'pre-push');
  if (plan.prePush && !hookThere) say('codexReview', 'no push check in the pre-push hook');
  if (!plan.prePush && recorded && hookThere) say('codexReview', 'the push check js-harness wrote is still in the pre-push hook');
  return lines;
}

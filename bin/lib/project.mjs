// The `init` engine: writes the committed per-project files (harness.json, AGENTS.md, the
// pre-commit gate), runs `codegraph init`, and records everything in a project manifest so T3's
// `uninstall` can restore the repo exactly — see odd/tasks/project-init.md, "T2 design". Like
// manifest.mjs's install/sync engine, this stays pure-ish over injectable `deps`
// (`spawn`/`platform`/`writeFile`) so tests never touch a real home, a real `codegraph`, or this
// repo itself.
import fs from 'node:fs';
import path from 'node:path';
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
 * R3-realish-dangling-symlink-escape). Also returns `hadSymlink`, true when any segment — dangling
 * or not — turned out to be a symlink, since a caller must never write through one even when its
 * target resolves back inside the repo. */
function realish(target) {
  const { root, segments } = splitFromRoot(path.resolve(target));
  let current = root;
  let hadSymlink = false;
  let hops = 0;
  for (const segment of segments) {
    let next = path.join(current, segment);
    for (;;) {
      let stat;
      try {
        stat = fs.lstatSync(next);
      } catch {
        break; // nothing here at all — this and every later segment is appended lexically
      }
      if (!stat.isSymbolicLink()) break;
      hadSymlink = true;
      hops += 1;
      if (hops > 40) return { real: target, hadSymlink }; // defensive: a symlink loop
      const linkTarget = fs.readlinkSync(next);
      next = path.isAbsolute(linkTarget) ? path.normalize(linkTarget) : path.resolve(path.dirname(next), linkTarget);
    }
    current = next;
  }
  return { real: current, hadSymlink };
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

/** Whether `hookPath` (already resolved via `resolveGitPath`) is actually inside `root`, following
 * symlinks (dangling ones included) on both sides first (T2c Codex P1 symlink; T2d Codex P1 +
 * R3-realish-dangling-symlink-escape) so a hooks path that is, or sits behind, a symlink pointing
 * outside the repo is correctly seen as outside. `real` is the fully resolved location, reported
 * when outside since that is where the user would actually need to add the check themselves.
 * `occupied` is true when the (unresolved) `hookPath` itself must never be written to — either an
 * ordinary lstat hit (a real file, or any symlink, dangling or not, right there) or a symlink
 * anywhere in its ancestor chain (`hadSymlink`): writing through either could replace something a
 * person put there or, for a dangling ancestor, fail unpredictably deep inside a broken chain. */
function resolveHookContainment(root, hookPath) {
  const realRoot = fs.realpathSync(root);
  const { real, hadSymlink } = realish(hookPath);
  const outside = isOutsideRelative(path.relative(realRoot, real));
  const occupied = !outside && (hadSymlink || isOccupied(hookPath));
  return { real, outside, occupied };
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

/** Writes `data` to `target` atomically: serialized to `<target>.tmp` first, then a single rename
 * over `target`, so a reader never sees a partially-written manifest and a failure never corrupts
 * or truncates whatever was there before. On any failure the `.tmp` file is removed (best-effort)
 * and `target` itself is never touched directly — matters most for the codegraph-retry update,
 * which must not lose an existing, valid manifest just because this write failed partway through
 * (T2d Codex P2 atomic manifest writes). */
function writeManifestAtomic(target, data, writeFile) {
  const tmp = `${target}.tmp`;
  const content = JSON.stringify(data, null, 2) + '\n';
  try {
    writeFile(tmp, content, 'utf8');
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

function wrote(relPath, hash) {
  return { kind: 'wrote', path: relPath, sha256: hash };
}

/** `outside: true` marks an entry whose `path` is an absolute, forward-slashed location that is
 * not under the repo root at all (an outside `core.hooksPath` — T2c item 6); every other `kept`
 * entry carries a plain repo-relative `path` and no `outside` field. */
function kept(relPath, reason, outside = false) {
  return outside ? { kind: 'kept', path: relPath, reason, outside: true } : { kind: 'kept', path: relPath, reason };
}

/** Thrown by `initProject` when a step after the first write fails: everything this run wrote has
 * already been rolled back (best-effort) by the time this is thrown. `notRemoved` lists whatever
 * could not be cleaned up (root-relative), empty when the rollback was complete. `codegraphDirLeftBehind`
 * is true when `.codegraph/` was created by *this* run and is deliberately not part of the rollback
 * (codegraph never participates in this atomicity — see `writeProject`) but still needs to be
 * disclosed rather than implied away by "nothing was left behind" (T2b Codex P1 +
 * R3-init-partial-failure-unrecoverable; T2c R3-nothing-left-behind-overclaims). */
export class InitWriteError extends Error {
  constructor(message, notRemoved = [], codegraphDirLeftBehind = false) {
    super(message);
    this.name = 'InitWriteError';
    this.notRemoved = notRemoved;
    this.codegraphDirLeftBehind = codegraphDirLeftBehind;
  }
}

/** Walks up from `dir` toward (but never past) `root`, returning the shallowest ancestor that does
 * not exist yet — the top of whatever a later `mkdirSync(dir, { recursive: true })` would actually
 * create. `null` when `dir` itself already exists (nothing would be created). Used so a rollback
 * can remove exactly the directory chain this run made, never a directory that predates it (e.g.
 * `.git/hooks` itself must never be removed). */
function shallowestMissingAncestor(dir, root) {
  if (fs.existsSync(dir)) return null;
  let current = path.resolve(dir);
  const stop = path.resolve(root);
  let shallowest = current;
  while (current !== stop && current.startsWith(stop + path.sep) && !fs.existsSync(path.dirname(current))) {
    current = path.dirname(current);
    shallowest = current;
  }
  return shallowest;
}

/** Creates `dir` (recursively) and, when that actually creates new directories, records the
 * shallowest one in `createdDirs` so a rollback can remove exactly that chain. */
function mkdirTracked(dir, root, createdDirs) {
  const shallow = shallowestMissingAncestor(dir, root);
  fs.mkdirSync(dir, { recursive: true });
  if (shallow) createdDirs.push(shallow);
}

/** Best-effort rollback of everything a failed run wrote: every tracked file (reverse order, so a
 * later file is removed before an earlier one that might share its directory) and every directory
 * chain this run created. Returns the root-relative paths that could not be removed. */
function rollback(root, createdPaths, createdDirs) {
  const notRemoved = [];
  for (const p of createdPaths.slice().reverse()) {
    try {
      fs.rmSync(p, { force: true });
    } catch {
      notRemoved.push(toRepoRelative(root, p));
    }
  }
  for (const d of createdDirs.slice().reverse()) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      notRemoved.push(toRepoRelative(root, d));
    }
  }
  return notRemoved;
}

/** The write phase for a project with no `harness.json` yet and no project manifest yet either
 * (the caller, `initProject`, refuses before reaching here otherwise — see its `staleManifest`
 * check). Writes `harness.json`, `AGENTS.md` (if none exists), the pre-commit gate (if resolvable,
 * inside the repo, and none exists), runs codegraph init, and records everything in the project
 * manifest at `manifestFilePath`. Atomic on failure: if any step after the first write throws,
 * every file/directory this run created is removed (best-effort, except `.codegraph/` — see
 * `InitWriteError`) and an `InitWriteError` is thrown instead. */
function writeProject(root, version, spawn, platform, writeFile, manifestFilePath) {
  const createdPaths = [];
  const createdDirs = [];
  let codegraphCreatedThisRun = false;

  try {
    const actions = [];
    const files = [];

    // harness.json: the pin.
    const harnessJsonPath = path.join(root, 'harness.json');
    const harnessJsonContent = JSON.stringify({ version }, null, 2) + '\n';
    createdPaths.push(harnessJsonPath);
    writeFile(harnessJsonPath, harnessJsonContent, 'utf8');
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
    // disable a project's existing `.git/hooks`.
    const hookPath = resolveGitPath(root, 'hooks/pre-commit', spawn);
    if (!hookPath) {
      actions.push({ kind: 'skip', path: 'hooks/pre-commit', reason: 'could not resolve the git hooks path' });
    } else {
      const { real: realHookPath, outside: hookOutside, occupied: hookOccupied } = resolveHookContainment(root, hookPath);
      if (hookOutside) {
        // T2b R3-hookspath-outside-repo-written / Codex P2, T2c Codex P1 symlink, T2d dangling
        // symlink: a `core.hooksPath` outside the repo — directly, through an in-repo symlink, or
        // through a dangling one — is never written to; this run does not own that location.
        actions.push(
          kept(
            toForwardSlashes(realHookPath),
            'hooks path is outside the repository (core.hooksPath); add `js-harness check` to its pre-commit yourself',
            true,
          ),
        );
      } else {
        const hookRel = toRepoRelative(root, hookPath);
        if (hookOccupied) {
          actions.push(kept(hookRel, 'exists; add `js-harness check` to it'));
        } else {
          mkdirTracked(path.dirname(hookPath), root, createdDirs);
          createdPaths.push(hookPath);
          writeFile(hookPath, PRE_COMMIT_HOOK, 'utf8');
          fs.chmodSync(hookPath, 0o755);
          const hash = sha256(PRE_COMMIT_HOOK);
          files.push({ path: hookRel, sha256: hash });
          actions.push(wrote(hookRel, hash));
        }
      }
    }

    // codegraph init: only when `.codegraph/` does not exist yet — it writes only that directory
    // (measured in a scratch repo, codegraph 1.6.0), so its presence alone means "already done".
    // A codegraph failure is reported, never thrown: it does not participate in this function's
    // atomicity (see "T2 design": codegraph missing/failing still exits 0 and carries on) — and a
    // codegraph *success* is not rolled back either if a later step fails; `codegraphCreatedThisRun`
    // tracks that so the eventual `InitWriteError` can disclose it instead of overclaiming a clean
    // rollback (T2c R3-nothing-left-behind-overclaims).
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

    const manifest = {
      version,
      files,
      kept: actions
        .filter((a) => a.kind === 'kept')
        .map((a) => (a.outside ? { path: a.path, reason: a.reason, outside: true } : { path: a.path, reason: a.reason })),
      codegraph: codegraphManifest,
    };

    // T2c Codex P1 + R3-rollback-deletes-preexisting-manifest: `manifestFilePath` is guaranteed
    // absent here — `initProject` already refused to reach `writeProject` at all when it exists
    // (see its `staleManifest` check) — so tracking it in `createdPaths` exactly like every other
    // file this run writes can never end up rolling back a manifest from a previous run.
    mkdirTracked(path.dirname(manifestFilePath), root, createdDirs);
    createdPaths.push(manifestFilePath);
    writeManifestAtomic(manifestFilePath, manifest, writeFile);

    return { code: 0, root, actions, manifest, manifestPath: manifestFilePath };
  } catch (err) {
    const notRemoved = rollback(root, createdPaths, createdDirs);
    throw new InitWriteError(err.message, notRemoved, codegraphCreatedThisRun);
  }
}

/** `harness.json` already exists: nothing is (re-)written except one narrow, explicit exception.
 * When the project manifest on disk says a previous codegraph run failed, only the codegraph step
 * is retried and only the manifest's `codegraph` field is updated; every other file is untouched.
 * The retry runs even if `.codegraph/` exists now, as long as the failed run itself is what created
 * it (`codegraph.createdDir: true` in that stale record) — a directory some *other* tool created
 * after the failure is left alone, same as any other "already done" case (T2d Codex P2 codegraph
 * ownership). A failure while rewriting the manifest here throws `InitWriteError` the same way
 * `writeProject` does (T2c R3-retry-manifest-write-unguarded) — codegraph itself already ran and is
 * not rolled back either way, so the error says precisely what happened: codegraph ran, the
 * manifest update failed. */
function alreadyInitialized(root, harnessJsonPath, manifestFilePath, spawn, platform, writeFile) {
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
    const codegraphDirExists = fs.existsSync(codegraphDirPath(root));
    const shouldRetryCodegraph =
      priorCodegraph?.status === 'failed' && (!codegraphDirExists || priorCodegraph.createdDir === true);

    if (shouldRetryCodegraph) {
      const { manifest: codegraphManifest, reason } = initCodegraph(root, spawn, platform);
      manifest.codegraph = codegraphManifest;
      try {
        writeManifestAtomic(manifestFilePath, manifest, writeFile);
      } catch (err) {
        throw new InitWriteError(
          `codegraph init ran but the manifest could not be updated: ${err.message}`,
          [],
          codegraphManifest.createdDir === true,
        );
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

  if (!fs.existsSync(cwd)) return { code: 1, noSuchDirectory: true, cwd };

  const root = gitTopLevel(cwd, spawn);
  if (!root) return { code: 1, notGitRepo: true };

  const manifestFilePath =
    resolveGitPath(root, 'js-harness/manifest.json', spawn) ?? path.join(root, '.git', 'js-harness', 'manifest.json');

  // `isOccupied` (not `fs.existsSync`) so a dangling harness.json symlink is treated as "already
  // initialized" rather than silently written through (T2d item 1).
  const harnessJsonPath = path.join(root, 'harness.json');
  if (isOccupied(harnessJsonPath)) {
    return alreadyInitialized(root, harnessJsonPath, manifestFilePath, spawn, platform, writeFile);
  }

  // T2c Codex P1 + R3-rollback-deletes-preexisting-manifest: a manifest surviving without
  // harness.json means this clone was initialized before and then had harness.json removed (by
  // hand, or a partial/failed uninstall) — not a fresh project. Refuse rather than silently
  // writing a brand-new manifest over stale bookkeeping from a run this one knows nothing about.
  // `isOccupied` here too (T2d item 1): a dangling manifest symlink still counts as "there".
  if (isOccupied(manifestFilePath)) {
    return { code: 1, staleManifest: true, manifestPath: manifestFilePath };
  }

  return writeProject(root, version, spawn, platform, writeFile, manifestFilePath);
}

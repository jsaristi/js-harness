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

/** Resolves `target`'s nearest existing ancestor to its real path (following symlinks) and
 * re-appends whatever doesn't exist yet on top of that — so a containment check sees through an
 * in-repo symlink (e.g. `core.hooksPath` pointing at a symlinked directory that itself points
 * outside the repo) without requiring `target` itself to already exist (T2c Codex P1 symlink).
 * Falls back to `target` unresolved if walking up somehow reaches the filesystem root without
 * finding anything that exists (should not happen in practice). */
function realish(target) {
  let current = path.resolve(target);
  const tail = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return target;
    tail.unshift(path.basename(current));
    current = parent;
  }
  const real = fs.realpathSync(current);
  return tail.length > 0 ? path.join(real, ...tail) : real;
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
 * symlinks on both sides first (T2c Codex P1 symlink) so an in-repo symlink pointing outside the
 * repo is correctly seen as outside. Returns the real, symlink-resolved hook path alongside the
 * verdict, since callers that treat it as outside report *that* location, not the git-given one. */
function resolveHookContainment(root, hookPath) {
  const realRoot = fs.realpathSync(root);
  const real = realish(hookPath);
  const rel = path.relative(realRoot, real);
  return { real, outside: isOutsideRelative(rel) };
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

/** Runs (or re-runs) codegraph's init step and reports the manifest fragment for it. `createdDir`
 * is always what `fs.existsSync` observes afterward, never assumed from the exit code (T2b Codex
 * P2 + R3-codegraph-createdDir-unverified) — a tool that reports success without actually writing
 * `.codegraph/` must not be recorded as having created it. */
function initCodegraph(root, spawn, platform) {
  const result = runCodegraphInit(root, { spawn, platform });
  if (result.ok) {
    return { manifest: { createdDir: fs.existsSync(codegraphDirPath(root)), status: 'ok' } };
  }
  return {
    manifest: { createdDir: false, status: 'failed' },
    reason: `${result.reason} — fix: ${codegraphFixCommand()}`,
  };
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

    // AGENTS.md: only when the project has none of its own.
    const agentsPath = path.join(root, 'AGENTS.md');
    const agentsRel = toRepoRelative(root, agentsPath);
    if (fs.existsSync(agentsPath)) {
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
      const { real: realHookPath, outside: hookOutside } = resolveHookContainment(root, hookPath);
      if (hookOutside) {
        // T2b R3-hookspath-outside-repo-written / Codex P2, T2c Codex P1 symlink: a `core.hooksPath`
        // outside the repo — directly, or through an in-repo symlink — is never written to; this run
        // does not own that location. Report the real (symlink-resolved) location, since that is
        // where the user would actually need to add the check themselves.
        actions.push(
          kept(
            toForwardSlashes(realHookPath),
            'hooks path is outside the repository (core.hooksPath); add `js-harness check` to its pre-commit yourself',
            true,
          ),
        );
      } else {
        const hookRel = toRepoRelative(root, hookPath);
        if (fs.existsSync(hookPath)) {
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
    writeFile(manifestFilePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    return { code: 0, root, actions, manifest, manifestPath: manifestFilePath };
  } catch (err) {
    const notRemoved = rollback(root, createdPaths, createdDirs);
    throw new InitWriteError(err.message, notRemoved, codegraphCreatedThisRun);
  }
}

/** `harness.json` already exists: nothing is (re-)written except one narrow, explicit exception.
 * When `.codegraph/` is still absent and the project manifest on disk says a previous codegraph run
 * failed, only the codegraph step is retried and only the manifest's `codegraph` field is updated;
 * every other file is untouched. A failure while rewriting the manifest here throws `InitWriteError`
 * the same way `writeProject` does (T2c R3-retry-manifest-write-unguarded) — codegraph itself already
 * ran and is not rolled back either way, so the error says precisely what happened: codegraph ran,
 * the manifest update failed. */
function alreadyInitialized(root, harnessJsonPath, manifestFilePath, spawn, platform, writeFile) {
  let existingVersion = null;
  try {
    existingVersion = JSON.parse(fs.readFileSync(harnessJsonPath, 'utf8'))?.version ?? null;
  } catch {
    // Malformed harness.json is still "present" for the purposes of this gate; report what we can
    // and still write nothing (see "T2 design": exit 0, nothing written, either way).
  }

  if (!fs.existsSync(codegraphDirPath(root)) && fs.existsSync(manifestFilePath)) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFilePath, 'utf8'));
    } catch {
      manifest = null;
    }
    if (manifest?.codegraph?.status === 'failed') {
      const { manifest: codegraphManifest, reason } = initCodegraph(root, spawn, platform);
      manifest.codegraph = codegraphManifest;
      try {
        writeFile(manifestFilePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
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

  const harnessJsonPath = path.join(root, 'harness.json');
  if (fs.existsSync(harnessJsonPath)) {
    return alreadyInitialized(root, harnessJsonPath, manifestFilePath, spawn, platform, writeFile);
  }

  // T2c Codex P1 + R3-rollback-deletes-preexisting-manifest: a manifest surviving without
  // harness.json means this clone was initialized before and then had harness.json removed (by
  // hand, or a partial/failed uninstall) — not a fresh project. Refuse rather than silently
  // writing a brand-new manifest over stale bookkeeping from a run this one knows nothing about.
  if (fs.existsSync(manifestFilePath)) {
    return { code: 1, staleManifest: true, manifestPath: manifestFilePath };
  }

  return writeProject(root, version, spawn, platform, writeFile, manifestFilePath);
}

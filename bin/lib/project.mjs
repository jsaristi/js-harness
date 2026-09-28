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
 * non-zero exit, or any thrown spawn error all count as "not a repo" here). */
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
 * regardless of host OS. */
function toRepoRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
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

/** Spawns `codegraph init --yes <root>` the way `stack.mjs`'s `probeVersionCommand` spawns a
 * version probe: on win32 one joined command line through `shell: true` with no args array
 * (Node 24 warns (DEP0190) on stderr otherwise); elsewhere a plain argv with no shell. Unlike a
 * probe's fixed literal args, `root` can contain spaces, so it is quoted before joining. Never
 * throws: a missing binary or a non-zero exit both come back as `{ ok: false, reason }`. */
export function runCodegraphInit(root, { spawn = spawnSync, platform = process.platform } = {}) {
  const shell = platform === 'win32';
  let result;
  try {
    if (shell) {
      const command = ['codegraph', 'init', '--yes', `"${root}"`].join(' ');
      result = spawn(command, [], { encoding: 'utf8', shell: true });
    } else {
      result = spawn('codegraph', ['init', '--yes', root], { encoding: 'utf8', shell: false });
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

function wrote(relPath, hash) {
  return { kind: 'wrote', path: relPath, sha256: hash };
}

function kept(relPath, reason) {
  return { kind: 'kept', path: relPath, reason };
}

/** Runs `js-harness init` against the git repository at `cwd`'s top-level. `version` is the
 * caller's running version (`currentVersion()` in install.mjs) — passed in rather than read here
 * so this module has no package.json of its own to know about. Returns one of:
 * - `{ code: 1, notGitRepo: true }` — outside a git repository; nothing written.
 * - `{ code: 0, alreadyInitialized: true, version, root }` — `harness.json` already exists;
 *   nothing written (`version` is whatever that file already pins, `null` if unreadable).
 * - `{ code: 0, root, actions, manifest, manifestPath }` — otherwise. `actions` is in report
 *   order (`wrote`/`kept`/`ran`/`skip`/`problem`), `manifest` is exactly what was written to
 *   `manifestPath`. */
export function initProject(cwd, version, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  const platform = deps.platform ?? process.platform;
  const writeFile = deps.writeFile ?? fs.writeFileSync;

  const root = gitTopLevel(cwd, spawn);
  if (!root) return { code: 1, notGitRepo: true };

  const harnessJsonPath = path.join(root, 'harness.json');
  if (fs.existsSync(harnessJsonPath)) {
    let existingVersion = null;
    try {
      existingVersion = JSON.parse(fs.readFileSync(harnessJsonPath, 'utf8'))?.version ?? null;
    } catch {
      // Malformed harness.json is still "present" for the purposes of this gate; report what we
      // can and still write nothing (see "T2 design": exit 0, nothing written, either way).
    }
    return { code: 0, alreadyInitialized: true, version: existingVersion, root };
  }

  const actions = [];
  const files = [];

  // harness.json: the pin.
  const harnessJsonContent = JSON.stringify({ version }, null, 2) + '\n';
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
    writeFile(agentsPath, content, 'utf8');
    const hash = sha256(content);
    files.push({ path: agentsRel, sha256: hash });
    actions.push(wrote(agentsRel, hash));
  }

  // Pre-commit gate: wherever `core.hooksPath` (or the default `.git/hooks`) resolves it to. Never
  // touches git config itself — see "T2 design": setting `core.hooksPath` would silently disable a
  // project's existing `.git/hooks`.
  const hookPath = resolveGitPath(root, 'hooks/pre-commit', spawn);
  if (!hookPath) {
    actions.push({ kind: 'skip', path: 'hooks/pre-commit', reason: 'could not resolve the git hooks path' });
  } else {
    const hookRel = toRepoRelative(root, hookPath);
    if (fs.existsSync(hookPath)) {
      actions.push(kept(hookRel, 'exists; add `js-harness check` to it'));
    } else {
      fs.mkdirSync(path.dirname(hookPath), { recursive: true });
      writeFile(hookPath, PRE_COMMIT_HOOK, 'utf8');
      fs.chmodSync(hookPath, 0o755);
      const hash = sha256(PRE_COMMIT_HOOK);
      files.push({ path: hookRel, sha256: hash });
      actions.push(wrote(hookRel, hash));
    }
  }

  // codegraph init: only when `.codegraph/` does not exist yet — it writes only that directory
  // (measured in a scratch repo, codegraph 1.6.0), so its presence alone means "already done".
  const codegraphDir = path.join(root, '.codegraph');
  let codegraphManifest;
  if (fs.existsSync(codegraphDir)) {
    codegraphManifest = { createdDir: false, status: 'exists' };
    actions.push({ kind: 'skip', path: 'codegraph init', reason: '.codegraph already exists' });
  } else {
    const result = runCodegraphInit(root, { spawn, platform });
    if (result.ok) {
      codegraphManifest = { createdDir: true, status: 'ok' };
      actions.push({ kind: 'ran', path: 'codegraph init' });
    } else {
      codegraphManifest = { createdDir: false, status: 'failed' };
      actions.push({
        kind: 'problem',
        path: 'codegraph init',
        reason: `${result.reason} — fix: ${codegraphFixCommand()}`,
      });
    }
  }

  const manifest = {
    version,
    files,
    kept: actions.filter((a) => a.kind === 'kept').map((a) => ({ path: a.path, reason: a.reason })),
    codegraph: codegraphManifest,
  };

  const manifestFilePath = resolveGitPath(root, 'js-harness/manifest.json', spawn) ??
    path.join(root, '.git', 'js-harness', 'manifest.json');
  fs.mkdirSync(path.dirname(manifestFilePath), { recursive: true });
  fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return { code: 0, root, actions, manifest, manifestPath: manifestFilePath };
}

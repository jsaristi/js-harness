#!/usr/bin/env node
// CLI surface over the manifest engine: `install`, `sync`, `uninstall`. `uninstall` also covers the
// *project* undo (T3 design): inside a git repository that `js-harness init` touched, it routes to
// `uninstallProject` instead of the machine engine below — see bin/lib/project.mjs and
// odd/tasks/project-init.md, "T3 design".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, sync, uninstall } from './lib/manifest.mjs';
import { uninstallProject } from './lib/project.mjs';

function parseHome(argv, env) {
  const i = argv.indexOf('--home');
  return i !== -1 ? argv[i + 1] : (env.JS_HARNESS_HOME ?? os.homedir());
}

const UNINSTALL_USAGE = 'Usage: js-harness uninstall [--cwd <path>] [--home <path>] [--global]';

class UninstallArgError extends Error {}

function requireUninstallValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new UninstallArgError(`${flag} requires a value`);
  return value;
}

/** Strict like `init`'s parsing (an unknown flag or a missing value is an error, not silently
 * ignored) plus one more rule T3 design calls for: `--global` forces the machine scope below even
 * from inside an initialized project, so combining it with `--cwd` (which only means anything for
 * the *project* scope) is a usage error rather than a silently-ignored flag. */
function parseUninstallArgs(argv, env) {
  let cwd;
  let home;
  let global = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--cwd') {
      cwd = requireUninstallValue(argv, i, token);
      i++;
    } else if (token === '--home') {
      home = requireUninstallValue(argv, i, token);
      i++;
    } else if (token === '--global') {
      global = true;
    } else {
      throw new UninstallArgError(`unknown flag: ${token}`);
    }
  }
  if (global && cwd !== undefined) {
    throw new UninstallArgError('--global cannot be combined with --cwd');
  }
  return {
    cwd: cwd ?? process.cwd(),
    cwdExplicit: cwd !== undefined,
    home: home ?? env.JS_HARNESS_HOME ?? os.homedir(),
    global,
  };
}

function logUninstallProjectAction(action) {
  switch (action.kind) {
    case 'removed':
      console.log(`removed ${action.path}`);
      break;
    case 'alreadyGone':
      console.log(`already gone ${action.path}`);
      break;
    case 'kept':
      console.error(`kept ${action.path} (${action.reason})`);
      break;
    case 'codegraphRemoved':
      console.log('removed .codegraph/');
      break;
    case 'failed':
      console.error(`could not remove ${action.path}: ${action.reason}`);
      break;
    case 'manifestRemoved':
      console.log(`removed manifest ${action.path}`);
      break;
    default:
      break;
  }
}

/** Renders `uninstallProject`'s result and returns the exit code — the project-scope half of
 * `uninstallMain` below. `result.notGitRepo`/`result.notInitialized` are never reached here: the
 * caller treats those as "fall through to the machine uninstall" instead (T3 design's "anywhere
 * else"), not as project-scope outcomes to report. */
function reportUninstallProject(result) {
  if (result.noSuchDirectory) {
    console.error(`no such directory: ${result.cwd}`);
    return 1;
  }
  if (result.noManifestFile) {
    console.error(
      `harness.json is present but no project manifest was found (looked for ${result.manifestPath}): ` +
        'those files are committed, so git already removes them; js-harness uninstall --global still ' +
        'reaches the machine install',
    );
    return 1;
  }
  if (result.malformedManifest) {
    console.error(
      `project manifest at ${result.manifestPath} is malformed` + (result.reason ? `: ${result.reason}` : ''),
    );
    return 1;
  }
  for (const action of result.actions) logUninstallProjectAction(action);
  return result.code;
}

/** This package's own version, read from its package.json (never the installed target's). */
export function currentVersion() {
  const pkgPath = path.join(import.meta.dirname, '..', 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
}

// R3-001 (accepted final review follow-up, lineage review-cef5637e2884c12a): a skipped component or
// entry (a write that failed this run — see manifest.mjs's `install`/`sync`) is surfaced to the
// user, not silently dropped, one line per item on stderr so it never pollutes the normal stdout
// report a script might parse.
function logSkip(item) {
  console.error(`skipped ${item.path}: ${item.reason ?? 'unknown reason'}`);
}

function logFiles(files) {
  for (const file of files ?? []) {
    if (file.skipped) logSkip(file);
  }
}

function logEntries(entries) {
  for (const entry of entries ?? []) {
    if (entry.skipped) logSkip(entry);
    else console.log(`registered hook entry in ${entry.path}`);
  }
}

/** Files this run actually wrote: a record carried forward after a failed write is still in the
 * manifest (so uninstall can undo it) but was not written now. */
function writtenCount(manifest) {
  return manifest.files.filter((file) => !file.skipped).length;
}

export async function installMain(argv, env = process.env, deps = {}) {
  const home = parseHome(argv, env);
  const version = currentVersion();
  const manifest = install(home, version, deps);
  console.log(`installed js-harness ${version} (${writtenCount(manifest)} files) into ${home}`);
  logFiles(manifest.files);
  logEntries(manifest.entries);
  return 0;
}

export async function syncMain(argv, env = process.env, deps = {}) {
  const home = parseHome(argv, env);
  const version = currentVersion();
  const manifest = sync(home, version, deps);
  console.log(`synced js-harness ${version} (${writtenCount(manifest)} files) into ${home}`);
  logFiles(manifest.files);
  logEntries(manifest.entries);
  return 0;
}

/** Scope by location (T3 design): inside a git repository `js-harness init` touched (`harness.json`
 * or a project manifest present), undo the project; anywhere else, or with `--global`, undo the
 * machine install exactly as before T3. `--global` skips the project check entirely rather than
 * running it and discarding the result — `--cwd` (project-only) is a usage error alongside it, so
 * there is nothing project-scoped left to even attempt. `deps` (`spawn`/`rm`) reaches only
 * `uninstallProject`; the machine engine below takes none. */
export async function uninstallMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseUninstallArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${UNINSTALL_USAGE}`);
    return 2;
  }

  if (!parsed.global) {
    const projectResult = uninstallProject(parsed.cwd, deps);
    if (!projectResult.notGitRepo && !projectResult.notInitialized) {
      return reportUninstallProject(projectResult);
    }
    // An explicit --cwd names a project: when it is not an initialized one, say so rather than
    // falling through, or a second `uninstall --cwd <repo>` would remove the machine install.
    if (parsed.cwdExplicit) {
      console.error(
        `not an initialized project: ${parsed.cwd}; js-harness uninstall --global removes the machine install`,
      );
      return 1;
    }
    // Outside a git repository, or inside one `js-harness init` never touched: "anywhere else" in
    // T3 design's scoping — fall through to the machine uninstall below.
  }

  const home = parsed.home;
  const result = uninstall(home);
  for (const p of result.removed) console.log(`removed ${p}`);
  for (const p of result.kept) console.log(`kept (modified by you) ${p}`);
  for (const p of result.entriesRemoved) console.log(`removed hook entry from ${p}`);
  for (const p of result.entriesKept) console.log(`kept hook entry in ${p} (modified by you)`);
  if (
    result.removed.length === 0 &&
    result.kept.length === 0 &&
    result.entriesRemoved.length === 0 &&
    result.entriesKept.length === 0
  ) {
    console.log(`nothing installed under ${home}`);
  }
  return 0;
}

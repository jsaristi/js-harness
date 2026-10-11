#!/usr/bin/env node
// CLI surface over the manifest engine: `install`, `sync`, `uninstall`. `uninstall` and `sync` also
// cover the *project* scope (T3/T4 design): inside a git repository that `js-harness init` touched
// they route to `uninstallProject` / `syncProject` instead of the machine engine below — see
// bin/lib/project.mjs and odd/tasks/project-init.md, "T3 design" and "T4 design".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, runSchtasks, sync, uninstall } from './lib/manifest.mjs';
import {
  uninstallProject,
  syncProject,
  InitWriteError,
  cleanupClause,
  staleManifestMessage,
  invalidHarnessJsonMessage,
} from './lib/project.mjs';

function parseHome(argv, env) {
  const i = argv.indexOf('--home');
  return i !== -1 ? argv[i + 1] : (env.JS_HARNESS_HOME ?? os.homedir());
}

const UNINSTALL_USAGE = 'Usage: js-harness uninstall [--cwd <path>] [--home <path>] [--global]';
const SYNC_USAGE = 'Usage: js-harness sync [--cwd <path>] [--home <path>] [--global]';

class ScopeArgError extends Error {}

function requireScopeValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new ScopeArgError(`${flag} requires a value`);
  return value;
}

/** The flags `uninstall` and `sync` share. Strict like `init`'s parsing (an unknown flag or a missing
 * value is an error, not silently ignored) plus one more rule T3 design calls for: `--global` forces the
 * machine scope even from inside an initialized project, so combining it with `--cwd` (which only means
 * anything for the *project* scope) is a usage error rather than a silently-ignored flag. */
function parseScopeArgs(argv, env) {
  let cwd;
  let home;
  let global = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--cwd') {
      cwd = requireScopeValue(argv, i, token);
      i++;
    } else if (token === '--home') {
      home = requireScopeValue(argv, i, token);
      i++;
    } else if (token === '--global') {
      global = true;
    } else {
      throw new ScopeArgError(`unknown flag: ${token}`);
    }
  }
  if (global && cwd !== undefined) {
    throw new ScopeArgError('--global cannot be combined with --cwd');
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

function logSyncProjectAction(action) {
  switch (action.kind) {
    case 'wrote':
      console.log(`wrote ${action.path}`);
      break;
    case 'ran':
      console.log(`ran ${action.path}`);
      break;
    case 'versionRecorded':
      console.log(`recorded ${action.to} in the manifest (was ${action.from ?? 'unrecorded'})`);
      break;
    case 'kept':
      console.error(`kept ${action.path} (${action.reason})`);
      break;
    case 'skip':
      console.error(`${action.path} skipped: ${action.reason}`);
      break;
    case 'problem':
      console.error(`${action.path} failed: ${action.reason}`);
      break;
    default:
      break;
  }
}

/** Renders `syncProject`'s result and returns the exit code — the project-scope half of `syncMain`.
 * `result.notGitRepo`/`result.notInitialized` are never reached here: the caller reports those itself
 * and names `--global` (T4 design), never as project-scope outcomes to render. */
function reportSyncProject(result) {
  if (result.noSuchDirectory) {
    console.error(`no such directory: ${result.cwd}`);
    return 1;
  }
  if (result.invalidHarnessJson) {
    console.error(`${invalidHarnessJsonMessage(result.harnessJsonPath, result.reason)}; nothing was written`);
    return 1;
  }
  if (result.staleManifest) {
    console.error(staleManifestMessage(result.manifestPath));
    return 1;
  }
  if (result.malformedManifest) {
    console.error(
      `project manifest at ${result.manifestPath} is malformed` + (result.reason ? `: ${result.reason}` : ''),
    );
    return 1;
  }
  if (result.pinMismatch) {
    console.error(
      `harness.json pins js-harness ${result.pin} but ${result.version} is running; nothing was written. ` +
        `To use the pinned version, run npm i -g github:jsaristi/js-harness#v${result.pin}; ` +
        `or raise the pin to ${result.version} in harness.json and commit it.`,
    );
    return 1;
  }
  for (const action of result.actions) logSyncProjectAction(action);
  if (result.setUp) {
    console.log(`set up this clone at ${result.version}`);
    console.log(`manifest: ${result.manifestPath}`);
  } else if (result.upToDate) {
    console.log(`up to date at ${result.version}`);
  } else {
    console.log(`synced project at ${result.version}`);
  }
  return result.code;
}

/** Scope by location, the same rule as `uninstallMain` (T4 design): inside a git repository that
 * `js-harness init` touched (`harness.json` or a project manifest present), move the project to its pin;
 * outside any git repository with no `--cwd`, or with `--global`, re-write the machine install exactly as
 * before T4. An explicit `--cwd`, or a git repository around the cwd, that is not an initialized project
 * exits 1 and names `--global`. `deps` reaches both engines: `spawn`/`platform`/`rm`/... for
 * `syncProject`, `writeFile` for the machine one — each ignores what it does not use. */
export async function syncMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseScopeArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${SYNC_USAGE}`);
    return 2;
  }

  const version = currentVersion();
  if (!parsed.global) {
    let projectResult;
    try {
      projectResult = syncProject(parsed.cwd, version, deps);
    } catch (err) {
      // A failed write: syncProject has already rolled back what this run wrote (best-effort).
      if (err instanceof InitWriteError) {
        console.error(`sync failed: ${err.message}; ${cleanupClause(err)}`);
        return 1;
      }
      throw err;
    }
    if (!projectResult.notGitRepo && !projectResult.notInitialized) return reportSyncProject(projectResult);
    if (parsed.cwdExplicit || projectResult.notInitialized) {
      console.error(
        `not an initialized project: ${parsed.cwd}; js-harness sync --global syncs the machine install`,
      );
      return 1;
    }
    // Outside any git repository, with no --cwd: fall through to the machine sync below.
  }

  const home = parsed.home;
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
 * there is nothing project-scoped left to even attempt. `deps` reaches both engines: `spawn`/`rm` for
 * `uninstallProject`, `removeFile` and `schtasks` (or `spawnSync`, what the real `schtasks.exe` is run through)
 * for the machine one — each ignores what it does not use. */
export async function uninstallMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseScopeArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${UNINSTALL_USAGE}`);
    return 2;
  }

  if (!parsed.global) {
    const projectResult = uninstallProject(parsed.cwd, deps);
    if (!projectResult.notGitRepo && !projectResult.notInitialized) {
      return reportUninstallProject(projectResult);
    }
    // An explicit --cwd names a project, and so does a git repository around the cwd: when it is not
    // an initialized one, say so rather than falling through, or a second `uninstall` in the same
    // repository would remove the machine install (Sebastián, roadmap Decided: "Command scope").
    if (parsed.cwdExplicit || projectResult.notInitialized) {
      console.error(
        `not an initialized project: ${parsed.cwd}; js-harness uninstall --global removes the machine install`,
      );
      return 1;
    }
    // Outside any git repository, with no --cwd: fall through to the machine uninstall below.
  }

  const home = parsed.home;
  // A recorded scheduled task is looked for and deleted through `schtasks.exe`, found from the environment this
  // command was given and nowhere else (`runSchtasks`); it is run only when the manifest records a task.
  const result = uninstall(home, { ...deps, schtasks: deps.schtasks ?? ((args) => runSchtasks(args, { env, spawnSync: deps.spawnSync })) });
  for (const p of result.removed) console.log(`removed ${p}`);
  // An optional file that could not be read or removed is not one the user edited, and the manifest that
  // named it is gone by now: it goes to stderr with the error code and what is left to do.
  const notUndone = new Map(result.keptOptional.filter((file) => file.reason !== 'edited').map((file) => [file.path, file]));
  for (const p of result.kept) {
    const failed = notUndone.get(p);
    if (!failed) {
      console.log(`kept (modified by you) ${p}`);
      continue;
    }
    const verb = failed.reason === 'unreadable' ? 'read' : 'remove';
    console.error(
      `could not ${verb} ${p} (${failed.code}): it is still there and no longer recorded, so nothing else will remove it; remove it by hand`,
    );
  }
  for (const p of result.entriesRemoved) console.log(`removed hook entry from ${p}`);
  for (const p of result.entriesKept) console.log(`kept hook entry in ${p} (modified by you)`);
  // A scheduled task, like an optional file: one that runs something else now is the user's, and is kept with
  // how to delete it; one that could not be looked at or deleted is not their doing, and stays recorded so that
  // this command can be run again: it goes to stderr with that, and with how to look and delete it by hand.
  for (const name of result.tasksRemoved) console.log(`removed scheduled task ${name}`);
  const tasksNotUndone = result.tasksKept.filter((task) => task.reason !== 'edited');
  for (const task of result.tasksKept) {
    if (task.reason === 'edited') {
      console.log(`kept scheduled task ${task.name} (modified by you): it is no longer recorded, and schtasks /Delete /TN ${task.name} /F deletes it`);
      continue;
    }
    const verb = task.reason === 'unremovable' ? 'delete' : 'look for';
    console.error(
      `could not ${verb} scheduled task ${task.name} (${task.why}): it may still be registered, firing every five minutes, so it is still recorded: run js-harness uninstall --global again, or js-harness remote stop --at-login in its project; ` +
        `schtasks /Query /TN ${task.name} shows whether it is, and schtasks /Delete /TN ${task.name} /F deletes it`,
    );
  }
  // The folder of the machine's gate lock, which `check` and `gate` write under the home. Left to a gate
  // that is alive in it, which removes its own files when it ends: that is no failure, and it is said
  // with what is left to do. Left because it could not be looked at or removed: that goes to stderr, like
  // a file.
  // The gate log, the gates' other folder, is in the same list. It is kept with the lock's folder for the
  // gate that is alive, which has yet to write its end in it, and that entry names it (`log`): the two are
  // kept for one reason, so they are said in one line. No gate removes its log, so the line says what does.
  // A log that could not be looked at or removed is an entry of its own, and goes to stderr like the lock's.
  const gateNotUndone = result.gateKept.filter((gate) => gate.reason !== 'in-use');
  for (const gate of result.gateKept) {
    if (gate.reason !== 'in-use') {
      console.error(`could not remove ${gate.path} (${gate.code}): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`);
      continue;
    }
    const whose = [gate.pid !== null && `pid ${gate.pid}`, gate.cwd !== null && `in ${gate.cwd}`].filter(Boolean).join(', ') || 'nothing more of it could be read';
    const alive = `a gate holds the machine's gate lock or waits for it right now (${whose})`;
    console.log(
      gate.log
        ? `kept ${gate.path} and ${gate.log}: ${alive}, and it has yet to write its end in the gate log; it removes its own files when it ends, and running js-harness uninstall --global again removes the log and whatever else is left`
        : `kept ${gate.path}: ${alive}; it removes its own files when it ends, and running js-harness uninstall --global again removes whatever is left`,
    );
  }
  // The folder of the session channel, which `notify` writes under the home. No process lives in it, so
  // it is removed (said above with the rest) or it could not be looked at or removed, and that goes to
  // stderr like the gate lock's folder: nothing records it, so nothing else will remove it.
  for (const channel of result.channelKept) {
    console.error(`could not remove ${channel.path} (${channel.code}): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`);
  }
  if (
    result.removed.length === 0 &&
    result.kept.length === 0 &&
    result.entriesRemoved.length === 0 &&
    result.entriesKept.length === 0 &&
    result.tasksRemoved.length === 0 &&
    result.tasksKept.length === 0 &&
    result.gateKept.length === 0 &&
    result.channelKept.length === 0
  ) {
    console.log(`nothing installed under ${home}`);
  }
  // A file or folder left behind that nothing records, or a task that may still fire, is not a finished uninstall, as in the project scope.
  return notUndone.size > 0 || tasksNotUndone.length > 0 || gateNotUndone.length > 0 || result.channelKept.length > 0 ? 1 : 0;
}

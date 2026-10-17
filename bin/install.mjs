#!/usr/bin/env node
// CLI surface over the manifest engine: `install`, `sync`, `uninstall`. `uninstall` and `sync` also
// cover the *project* scope (T3/T4 design): inside a git repository that `js-harness init` touched
// they route to `uninstallProject` / `syncProject` instead of the machine engine below — see
// bin/lib/project.mjs and odd/tasks/project-init.md, "T3 design" and "T4 design".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SESSION_MESSAGES, acceptSessionMessages, install, readManifest, runSchtasks, sync, uninstall } from './lib/manifest.mjs';
import { hygieneDir, memoryLocation } from './lib/memory-hygiene.mjs';
import {
  uninstallProject,
  syncProject,
  InitWriteError,
  cleanupClause,
  staleManifestMessage,
  newerManifestMessage,
  invalidHarnessJsonMessage,
  howToPinClause,
} from './lib/project.mjs';
import { INSTALL_NEWEST } from './lib/version.mjs';

const INSTALL_USAGE = 'Usage: js-harness install [--home <path>] [--accept-session-messages]';
const UNINSTALL_USAGE = 'Usage: js-harness uninstall [--cwd <path>] [--home <path>] [--global [--full]]';
const SYNC_USAGE = 'Usage: js-harness sync [--cwd <path>] [--home <path>] [--global]';

class ScopeArgError extends Error {}

function requireScopeValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new ScopeArgError(`${flag} requires a value`);
  return value;
}

/** The home `install` writes under: `--home <path>`, else `JS_HARNESS_HOME`, else the user's home. Strict like the
 * parsing below: a word it does not know, or a `--home` with no path after it, is an error. It once took such a word
 * as nothing at all, so `js-harness install --help`, typed to read its flags, installed under the real home. */
function parseInstallArgs(argv, env) {
  let home;
  let acceptMessages = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--accept-session-messages') {
      acceptMessages = true;
      continue;
    }
    if (token !== '--home') throw new ScopeArgError(`unknown flag: ${token}`);
    home = requireScopeValue(argv, i, token);
    i++;
  }
  return { home: home ?? env.JS_HARNESS_HOME ?? os.homedir(), acceptMessages };
}

/** What `install --accept-session-messages` did to Claude Code's `crossSessionInbound`, said in one line, and the
 * exit code: 1 when the setting could not be written, since the one thing the flag asked for was not done. */
function reportSessionMessages(home) {
  const result = acceptSessionMessages(home);
  const { key, value } = SESSION_MESSAGES;
  if (result.status === 'skipped') {
    console.error(`${key} was not set: ${result.path} is ${result.reason}; set it there by hand`);
    return 1;
  }
  if (result.status === 'already') {
    console.log(`${key} is already "${value}" in ${result.path}`);
    return 0;
  }
  // What it replaced now, and what `uninstall` gives back: the value before the first time, which the record keeps.
  const record = readManifest(home)?.settings?.find((entry) => entry.path === result.path && entry.key === key);
  const was = result.was === null ? 'it was not set' : `it was ${JSON.stringify(result.was)}`;
  const back = record?.had ? `uninstall puts back ${JSON.stringify(record.previous)}` : 'uninstall removes it';
  console.log(`set ${key} to "${value}" in ${result.path} (${was}; ${back})`);
  return 0;
}

/** What the uninstall says of a part of the folder of memory hygiene it left, other than kept snapshots (D7).
 * A planned pass is released from its project's checkout, which no file records, against the uninstall's home. */
/** `value` as one word the user's shell reads back as it is: in single quotes, inside which neither sh nor
 * PowerShell expands `$` or ends at `"`, as they do in double quotes. A single quote is written as each reads it:
 * `'\''` for sh, `''` for PowerShell (`platform` win32). */
export function shellWord(value, platform = process.platform) {
  return `'${value.replace(/'/g, platform === 'win32' ? "''" : "'\\''")}'`;
}

function memoryKeptLine(folder, home) {
  switch (folder.reason) {
    case 'locked':
      return folder.stamp !== null && folder.manifest
        ? `kept ${folder.path}: a memory pass is planned (${folder.stamp}) for ${folder.folder ? `the memory folder ${folder.folder}` : 'the memory folder its plan names'}; from that project's checkout run js-harness memory verify ${folder.stamp} --home ${shellWord(home)} or js-harness memory undo ${folder.stamp} --home ${shellWord(home)}, then uninstall again`
        : `kept ${folder.path}: ${folder.lock} holds no finished plan (pid ${folder.pid ?? 'unknown'}); if that process is not running, remove the file and uninstall again`;
    case 'locked-whole':
      return `kept ${folder.path}: --full removes it in one piece, and a project in it is under a memory pass; nothing of it was removed`;
    case 'purging':
      return folder.alive
        ? `kept ${folder.path}: another uninstall is removing it (pid ${folder.pid}, ${folder.marker}); run js-harness uninstall --global again once it ends`
        : `kept ${folder.path}: ${folder.marker} was left by an uninstall that ended before removing it (pid ${folder.pid ?? 'unknown'}); remove that file and run js-harness uninstall --global again`;
    case 'partial':
      return `could not remove ${folder.path} (${folder.code}): it was put back under its name and may be partly removed; run js-harness uninstall --global --full again`;
    case 'aside':
      return `could not remove ${folder.path} (${folder.code}), nor put it back as ${folder.dir}: rename it back to ${folder.dir}, then run js-harness uninstall --global --full again`;
    case 'aside-found':
      return `found ${folder.path}, left by an uninstall that stopped: rename it back to ${folder.dir} when there is none, else remove it`;
    default:
      return `could not remove ${folder.path} (${folder.code}): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`;
  }
}

/** "N snapshot(s) of a memory pass (stamps)", `whose` added after "pass". */
function snapshotWords(stamps, whose = '') {
  return `${stamps.length} snapshot${stamps.length === 1 ? '' : 's'} of a memory pass${whose} (${stamps.join(', ')})`;
}

/** The project uninstall leaves the project's memory snapshots under the machine's home: one stdout line says where
 * they are and what removes them, when there are any (D7.3). Nothing is said when they cannot be looked for. */
function sayProjectSnapshots(parsed, deps) {
  try {
    const run = deps.run ?? ((command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true }));
    const { slug } = memoryLocation({ home: parsed.home, project: parsed.cwd, run });
    const project = path.join(hygieneDir(parsed.home), slug);
    const stamps = fs.readdirSync(path.join(project, 'snapshots')).sort();
    if (stamps.length > 0) console.log(`kept ${project}: ${snapshotWords(stamps, ' of this project')}, under the machine's home; js-harness uninstall --global --full removes them`);
  } catch {
    // no snapshots, or no way to find them: nothing to say
  }
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
  if (result.newerManifest) {
    console.error(newerManifestMessage(result));
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

/** Which hook a recorded entry is, for the line that says it was registered: its commands, the event it
 * hangs from (the last key of its pointer) and its matcher. A host file holds more than one of ours (the
 * doctor's and the resume hook's), and two lines that only name the file would read as one written twice. */
function hookName(record) {
  const commands = (record.entry?.hooks ?? []).map((hook) => hook?.command).filter((command) => typeof command === 'string');
  if (commands.length === 0) return '';
  const matcher = typeof record.entry.matcher === 'string' ? `, matcher ${record.entry.matcher}` : '';
  return `: ${commands.join(', ')} (${record.pointer.at(-1)}${matcher})`;
}

function logEntries(entries) {
  for (const entry of entries ?? []) {
    if (entry.skipped) logSkip(entry);
    else console.log(`registered hook entry in ${entry.path}${hookName(entry)}`);
  }
}

/** Files this run actually wrote: a record carried forward after a failed write is still in the
 * manifest (so uninstall can undo it) but was not written now. */
function writtenCount(manifest) {
  return manifest.files.filter((file) => !file.skipped).length;
}

export async function installMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseInstallArgs(argv, env);
  } catch (err) {
    if (!(err instanceof ScopeArgError)) throw err;
    console.error(`${err.message}\n\n${INSTALL_USAGE}`);
    return 2;
  }
  const { home, acceptMessages } = parsed;
  const version = currentVersion();
  const manifest = install(home, version, deps);
  console.log(`installed js-harness ${version} (${writtenCount(manifest)} files) into ${home}`);
  logFiles(manifest.files);
  logEntries(manifest.entries);
  return acceptMessages ? reportSessionMessages(home) : 0;
}

function logSyncProjectAction(action) {
  switch (action.kind) {
    case 'wrote':
      console.log(`wrote ${action.path}`);
      break;
    case 'ran':
      console.log(`ran ${action.path}`);
      break;
    case 'removed':
      console.log(`removed ${action.path}`);
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
  if (result.noPin) {
    console.error(
      `${result.harnessJsonPath} pins no version, so there is nothing to move this project to; nothing was written. ` +
        `To pin it, ${howToPinClause(result.version)}, then run js-harness sync again.`,
    );
    return 1;
  }
  if (result.staleManifest) {
    console.error(staleManifestMessage(result.manifestPath));
    return 1;
  }
  if (result.newerManifest) {
    console.error(newerManifestMessage(result));
    return 1;
  }
  if (result.malformedManifest) {
    console.error(
      `project manifest at ${result.manifestPath} is malformed` + (result.reason ? `: ${result.reason}` : ''),
    );
    return 1;
  }
  if (result.pinMismatch) {
    // No version is tagged before 1.0.0 (docs/ROADMAP.md, "Release source"), so a pin cannot be installed
    // by its number: the one copy a machine can install is the default branch's.
    console.error(
      `harness.json pins js-harness ${result.pin} but ${result.version} is running; nothing was written. ` +
        `No version of js-harness is tagged yet, so ${result.pin} cannot be installed by its number. ` +
        `If ${result.pin} is the newer one, install the newest copy on this machine (${INSTALL_NEWEST}) and run js-harness sync again; ` +
        `otherwise set the pin to ${result.version} in harness.json and commit it.`,
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
  // `--full` is uninstall's alone (D7.3 of odd/tasks/memory-hygiene.md): taken out before the flags `sync` shares.
  // One right after `--cwd` or `--home` stays, so that flag still refuses it as a value that starts with `--`.
  const isFull = (token, i) => token === '--full' && argv[i - 1] !== '--cwd' && argv[i - 1] !== '--home';
  const full = argv.some(isFull);
  let parsed;
  try {
    parsed = parseScopeArgs(argv.filter((token, i) => !isFull(token, i)), env);
  } catch (err) {
    console.error(`${err.message}\n\n${UNINSTALL_USAGE}`);
    return 2;
  }
  // It deletes the only copy of what a memory pass changed, so it is asked for in full words, even outside a
  // repository where `uninstall` alone is the machine's.
  if (full && !parsed.global) {
    console.error(`--full removes the memory snapshots of the machine: it goes with --global\n\n${UNINSTALL_USAGE}`);
    return 2;
  }

  if (!parsed.global) {
    const projectResult = uninstallProject(parsed.cwd, deps);
    if (!projectResult.notGitRepo && !projectResult.notInitialized) {
      const code = reportUninstallProject(projectResult);
      if (projectResult.actions) sayProjectSnapshots(parsed, deps);
      return code;
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
  const result = uninstall(home, { ...deps, full, schtasks: deps.schtasks ?? ((args) => runSchtasks(args, { env, spawnSync: deps.spawnSync })) });
  for (const p of result.removed) console.log(`removed ${p}`);
  for (const project of result.memorySnapshotsRemoved ?? []) console.log(`removed ${project.path}: ${snapshotWords(project.stamps)}`);
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
  for (const p of result.settingsRestored ?? []) console.log(`put ${SESSION_MESSAGES.key} back in ${p}`);
  for (const p of result.settingsKept ?? []) console.log(`kept ${SESSION_MESSAGES.key} in ${p} (modified by you)`);
  // A scheduled task, like an optional file: one that runs something else now is the user's, and is kept with
  // how to delete it; one that could not be looked at or deleted is not their doing, and stays recorded so that
  // this command can be run again: it goes to stderr with that, and with how to look and delete it by hand.
  for (const name of result.tasksRemoved) console.log(`removed scheduled task ${name}`);
  const tasksNotUndone = result.tasksKept.filter((task) => task.reason !== 'edited');
  for (const task of result.tasksKept) {
    if (task.reason === 'edited') {
      // Beside a folder of `js-harness remote` that is kept, its record stays (see the folder's line below).
      console.log(
        task.recorded
          ? `kept scheduled task ${task.name} (modified by you): it stays recorded while the folder of js-harness remote is kept for it; schtasks /Delete /TN ${task.name} /F deletes it, and js-harness uninstall --global then removes what is left`
          : `kept scheduled task ${task.name} (modified by you): it is no longer recorded, and schtasks /Delete /TN ${task.name} /F deletes it`,
      );
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
  // A lock's folder that could not be looked at names the log as well: nobody knows whether a gate is alive
  // in it, so the log was kept, and the line of that folder says so and when to remove the two by hand.
  const gateNotUndone = result.gateKept.filter((gate) => gate.reason !== 'in-use');
  for (const gate of result.gateKept) {
    if (gate.reason !== 'in-use') {
      console.error(
        gate.log
          ? `could not remove ${gate.path} (${gate.code}), and kept ${gate.log} with it: the folder of the gate lock could not be looked at, so a gate may be alive that has yet to write its end in the gate log; both are still there and nothing records them; run js-harness uninstall --global again, or remove them by hand once no gate runs`
          : `could not remove ${gate.path} (${gate.code}): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`,
      );
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
  // The folder `js-harness remote` writes under the home, with the logs of the servers and the markers of
  // their stops. It is removed (said above with the rest) unless something still needs it, and each such
  // line says what to run: a server that runs is not stopped from here, one that cannot be told is not
  // guessed at, and the marker stays while a scheduled task that was kept could start the server without it.
  // Whichever it is, a folder is left that nothing records, so it goes to stderr and the uninstall fails.
  for (const remote of result.remoteKept) {
    if (remote.reason === 'in-use') {
      console.error(`kept ${remote.path}: the remote server of ${remote.root ?? 'a project its record does not name'} is running (supervisor pid ${remote.pid}), and uninstall stops no process; run js-harness remote stop in that project, then js-harness uninstall --global again`);
    } else if (remote.reason === 'unknown') {
      console.error(`kept ${remote.path}: it cannot be told whether a remote server still runs: ${remote.why}; run js-harness uninstall --global again, or remove the folder by hand once you have checked that no remote server runs`);
    } else if (remote.reason === 'task-kept') {
      const several = remote.tasks.length > 1;
      console.error(`kept ${remote.path}: the scheduled task${several ? 's' : ''} ${remote.tasks.join(', ')} ${several ? 'are' : 'is'} still registered, and the marker a stop left in that folder is what keeps ${several ? 'them' : 'it'} from starting the server again; run js-harness uninstall --global again once the task${several ? 's are' : ' is'} gone`);
    } else {
      console.error(`could not remove ${remote.path} (${remote.code}): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`);
    }
  }
  // The folder of memory hygiene, which `memory` writes under the home. A project's folder that holds snapshots is
  // kept on purpose by the normal uninstall and said on stdout, with what removes them, since they are the only copy
  // of what a pass changed; everything else left of it goes to stderr and fails the uninstall (D7).
  const memoryKept = result.memoryKept ?? [];
  for (const folder of memoryKept) {
    if (folder.stamps) {
      const count = folder.stamps.length;
      console.log(`kept ${folder.path}: ${count} snapshot${count === 1 ? '' : 's'} of a memory pass (${folder.stamps.join(', ')}), the only copy of what ${count === 1 ? 'that pass' : 'those passes'} changed${folder.journal ? ", with the project's journal" : ''}; js-harness uninstall --global --full removes them`);
    } else {
      console.error(memoryKeptLine(folder, home));
    }
  }
  const memoryNotUndone = memoryKept.filter((folder) => !folder.stamps);
  if (result.throughputKept) {
    const { path: folder, days, reviewStarts } = result.throughputKept;
    const starts = reviewStarts === null ? ', and any gentle-ai review starts recorded there' : reviewStarts > 0 ? `, and the gentle-ai review starts of ${reviewStarts} project${reviewStarts === 1 ? '' : 's'}, the only record of when those reviews began` : '';
    console.log(`kept ${folder}: ${days === null ? 'the' : days} day snapshot${days === 1 ? '' : 's'} of the throughput review, the only copy of the gates of days the gate log has rotated away${starts}; remove the folder by hand to drop them`);
  }
  if (
    result.removed.length === 0 &&
    result.kept.length === 0 &&
    result.entriesRemoved.length === 0 &&
    result.entriesKept.length === 0 &&
    result.tasksRemoved.length === 0 &&
    result.tasksKept.length === 0 &&
    result.gateKept.length === 0 &&
    result.channelKept.length === 0 &&
    result.remoteKept.length === 0 &&
    memoryKept.length === 0 &&
    !result.throughputKept
  ) {
    console.log(`nothing installed under ${home}`);
  }
  // A file or folder left behind that nothing records, or a task that may still fire, is not a finished uninstall, as in the project scope.
  return notUndone.size > 0 || tasksNotUndone.length > 0 || gateNotUndone.length > 0 || result.channelKept.length > 0 || result.remoteKept.length > 0 || memoryNotUndone.length > 0 ? 1 : 0;
}

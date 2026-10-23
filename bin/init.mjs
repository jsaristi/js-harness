#!/usr/bin/env node
// CLI surface for `js-harness init`: writes the committed per-project files and a project
// manifest — see bin/lib/project.mjs and odd/tasks/project-init.md, "T2 design".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { currentVersion } from './install.mjs';
import { ROADMAP_PATH } from './lib/onboard.mjs';
import { initProject, InitWriteError, cleanupClause, staleManifestMessage } from './lib/project.mjs';

export const USAGE = 'Usage: js-harness init [--cwd <path>] [--home <path>]';

class InitArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new InitArgError(`${flag} requires a value`);
  return value;
}

/** Unlike check/doctor's permissive `argv.indexOf(flag)` lookup, `init`'s usage contract (see
 * "T2 design") treats any flag besides `--cwd`/`--home` as an error rather than a silently
 * ignored token, so a typo is reported instead of quietly doing the wrong thing. */
function parseArgs(argv, env) {
  let cwd;
  let home;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--cwd') {
      cwd = requireValue(argv, i, token);
      i++;
    } else if (token === '--home') {
      home = requireValue(argv, i, token);
      i++;
    } else {
      throw new InitArgError(`unknown argument: ${token}`);
    }
  }
  return {
    cwd: cwd ?? process.cwd(),
    // `--home`/JS_HARNESS_HOME precedence matches install.mjs's parseHome, even though init writes
    // nothing under home — kept for consistency with the other commands (see "T2 design").
    home: home ?? env.JS_HARNESS_HOME ?? os.homedir(),
  };
}

function logAction(action) {
  switch (action.kind) {
    case 'wrote':
      console.log(`wrote ${action.path}`);
      break;
    case 'excluded':
      console.log(`excluded ${action.line} in ${action.path}`);
      break;
    case 'ran':
      console.log(`ran ${action.path}`);
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

/** The already-initialized report: the plain "nothing to do" line, or, when `initProject` retried
 * codegraph (see project.mjs's `alreadyInitialized`), the retry's own outcome plus the rewritten
 * manifest's path (T2b item 2). */
function logAlreadyInitialized(result) {
  const version = result.version ?? 'unknown version';
  if (!result.codegraphRetry) {
    console.log(`already initialized at ${version}; js-harness sync moves a project to its pin`);
    return;
  }
  console.log(`already initialized at ${version}; retrying codegraph init`);
  if (result.codegraphRetry.ok) {
    console.log('ran codegraph init');
  } else {
    console.error(`codegraph init failed: ${result.codegraphRetry.reason}`);
  }
  console.log(`manifest: ${result.codegraphRetry.manifestPath}`);
}

export async function initMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  const version = currentVersion();
  let result;
  try {
    result = initProject(parsed.cwd, version, deps);
  } catch (err) {
    // T2b Codex P1 + R3-init-partial-failure-unrecoverable: initProject has already rolled back
    // everything this run wrote (best-effort) before throwing — report what happened, never a raw
    // stack trace, and exit 1 either way.
    if (err instanceof InitWriteError) {
      console.error(`init failed: ${err.message}; ${cleanupClause(err)}`);
      return 1;
    }
    throw err;
  }

  if (result.noSuchDirectory) {
    console.error(`no such directory: ${result.cwd}`);
    return 1;
  }

  if (result.notGitRepo) {
    console.error('not a git repository: run git init first');
    return 1;
  }

  if (result.staleManifest) {
    console.error(staleManifestMessage(result.manifestPath));
    return 1;
  }

  if (result.alreadyInitialized) {
    logAlreadyInitialized(result);
    return 0;
  }

  for (const action of result.actions) logAction(action);
  console.log(`manifest: ${result.manifestPath}`);
  // A project with no plan yet is pointed at its onboarding (odd/tasks/onboarding.md, D8); init never starts it.
  if (!fs.existsSync(path.join(result.root, ROADMAP_PATH))) console.log('next: in a Claude Code or Codex session, run js-harness onboard');
  return 0;
}

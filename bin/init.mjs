#!/usr/bin/env node
// CLI surface for `js-harness init`: writes the committed per-project files and a project
// manifest — see bin/lib/project.mjs and odd/tasks/project-init.md, "T2 design".
import os from 'node:os';
import { currentVersion } from './install.mjs';
import { initProject } from './lib/project.mjs';

const USAGE = 'Usage: js-harness init [--cwd <path>] [--home <path>]';

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
      throw new InitArgError(`unknown flag: ${token}`);
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

export async function initMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  const version = currentVersion();
  const result = initProject(parsed.cwd, version, deps);

  if (result.notGitRepo) {
    console.error('not a git repository: run git init first');
    return 1;
  }

  if (result.alreadyInitialized) {
    console.log(
      `already initialized at ${result.version ?? 'unknown version'}; js-harness sync moves a project to its pin`,
    );
    return 0;
  }

  for (const action of result.actions) logAction(action);
  console.log(`manifest: ${result.manifestPath}`);
  return 0;
}

#!/usr/bin/env node
// `js-harness codex-review --base <rev>`: run the Codex plugin's review of `<rev>..HEAD` and record
// that it ran, or record an explicit skip with `--unavailable <reason>`. The record is what
// `check --push` will read to catch a slice that was never reviewed (T7 in odd/tasks/project-init.md).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { appendCodexReview, CODEX_REVIEW_SCHEMA } from './lib/codex-reviews.mjs';

const USAGE = 'Usage: js-harness codex-review --base <rev> [--unavailable <reason>] [--cwd <path>] [--home <path>]';
const PLUGIN_ID = 'codex@openai-codex';

class ArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new ArgError(`${flag} requires a value`);
  return value;
}

/** Parses `argv`. `--home` follows the same precedence as `check`: flag, `JS_HARNESS_HOME`, then
 * the home directory. `--base` is required even with `--unavailable`: the record needs its range. */
function parseArgs(argv, env, defaultHome) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? requireValue(argv, i, flag) : undefined;
  };
  const base = get('--base');
  if (base === undefined) throw new ArgError('--base is required');
  const unavailable = get('--unavailable')?.trim();
  if (unavailable === '') throw new ArgError('--unavailable needs a non-empty reason');
  return {
    base,
    unavailable,
    cwd: get('--cwd') ?? process.cwd(),
    home: get('--home') ?? env.JS_HARNESS_HOME ?? defaultHome,
  };
}

/** Trimmed stdout of a successful `git <args>` run in `cwd`, else `null`. */
function git(spawn, cwd, args) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8' });
    if (result && !result.error && result.status === 0 && result.stdout) return result.stdout.trim();
  } catch {
    // No git on PATH: the caller reports it as an unresolvable repository or revision.
  }
  return null;
}

/** The path of the plugin's companion script, from the plugin marketplace's record of what it
 * installed, or `null` when the plugin or the script is not there. */
function findCompanion(home) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), 'utf8'));
  } catch {
    return null;
  }
  const installPath = data?.plugins?.[PLUGIN_ID]?.[0]?.installPath;
  if (typeof installPath !== 'string' || !installPath) return null;
  const companion = path.join(installPath, 'scripts', 'codex-companion.mjs');
  return fs.existsSync(companion) ? companion : null;
}

const WAYS_ON = 'Rerun the review, or record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.';

/** Runs the command; returns the process exit code. `deps` (all optional) injects `spawn` (for git
 * and the companion), `now`, `home`, `log` and `error` so tests use fixtures. Exits 2 with usage
 * on a bad flag; 1 when nothing could be recorded or the review did not complete. */
export async function codexReviewMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const { spawn = spawnSync, now = () => new Date(), log = console.log, error = console.error } = deps;
  let args;
  try {
    args = parseArgs(argv, env, deps.home ?? os.homedir());
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  const root = git(spawn, args.cwd, ['rev-parse', '--show-toplevel']);
  if (!root) {
    error(`${args.cwd} is not a git repository, so there is no range to record.`);
    return 1;
  }
  const base = git(spawn, root, ['rev-parse', '--verify', `${args.base}^{commit}`]);
  if (!base) {
    error(`Cannot resolve --base ${args.base} to a commit in ${root}.`);
    return 1;
  }
  const head = git(spawn, root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!head) {
    error(`Cannot resolve HEAD to a commit in ${root}.`);
    return 1;
  }

  let outcome = 'unavailable';
  if (args.unavailable === undefined) {
    const companion = findCompanion(args.home);
    if (!companion) {
      error(
        `The Codex plugin's codex-companion.mjs was not found (looked for ${PLUGIN_ID} under ${args.home}).\n` +
          'Install it with `claude plugin install codex@openai-codex`, or record an explicit skip ' +
          'with `--unavailable <reason>`.',
      );
      return 1;
    }
    let result;
    try {
      result = spawn(process.execPath, [companion, 'review', '--wait', '--base', args.base], { cwd: root, stdio: 'inherit' });
    } catch (err) {
      result = { status: null, error: err };
    }
    if (result?.status !== 0) {
      const reason = result?.error ? `could not start it: ${result.error.message}` : `it exited ${result?.status ?? `on ${result?.signal ?? 'a signal'}`}`;
      error(`The Codex review did not complete (${reason}); no record was written.\n${WAYS_ON}`);
      return result?.status ?? 1;
    }
    outcome = 'reviewed';
  }

  const record = {
    schema: CODEX_REVIEW_SCHEMA,
    base,
    head,
    reviewedAt: now().toISOString(),
    outcome,
    ...(outcome === 'unavailable' ? { reason: args.unavailable } : {}),
  };
  let file;
  try {
    file = appendCodexReview(root, record, { spawn });
  } catch (err) {
    error(`Could not write the record: ${err.message}`);
    return 1;
  }
  const what = outcome === 'reviewed' ? 'the Codex review' : `an unavailable Codex review (${args.unavailable})`;
  log(`Recorded ${what} of ${base.slice(0, 7)}..${head.slice(0, 7)} in ${file}.`);
  return 0;
}

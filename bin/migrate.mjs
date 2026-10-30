#!/usr/bin/env node
// CLI surface for `js-harness migrate`: brings a project an older release initialized to what this copy's `init`
// writes, says what it would write with --check, and lists the folders the move list is chosen from with `list` —
// see bin/lib/project-migrate.mjs and odd/tasks/f8-s12-migration.md.
import os from 'node:os';
import path from 'node:path';
import { currentVersion, reportSyncProject } from './install.mjs';
import { InitWriteError, cleanupClause, howToPinClause, staleManifestMessage } from './lib/project.mjs';
import { CANDIDATE_DAYS, candidateProjects, migrateProject, migrationPlan } from './lib/project-migrate.mjs';
import { harnessHome } from './lib/home.mjs';

export const USAGE = [
  'Usage: js-harness migrate [--check] [--cwd <path>] [--home <path>]',
  '       js-harness migrate list [--home <path>]',
].join('\n');

class MigrateArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new MigrateArgError(`${flag} requires a value`);
  return value;
}

/** `{ list, check, cwd, home }`: `list` takes `--home` alone, and any flag besides the command's own is refused. */
function parseArgs(argv, env) {
  const list = argv[0] === 'list';
  let cwd;
  let home;
  let check = false;
  for (let i = list ? 1 : 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--home') {
      home = requireValue(argv, i, token);
      i++;
    } else if (token === '--cwd' && !list) {
      cwd = requireValue(argv, i, token);
      i++;
    } else if (token === '--check' && !list) {
      check = true;
    } else {
      throw new MigrateArgError(`unknown argument: ${token}`);
    }
  }
  return { list, check, cwd: cwd ?? process.cwd(), home: harnessHome({ given: home, env, homedir: os.homedir }) };
}

/** The refusals `migrate` gives that `sync` does not, or that `sync` words for itself: true when one was printed. */
function refused(result) {
  if (result.notGitRepo) console.error('not a git repository: nothing to migrate');
  else if (result.notInitialized) console.error('not an initialized project: js-harness init sets one up; nothing to migrate');
  else if (result.notSetUp) console.error(`this clone of ${result.root} is not set up yet: run js-harness sync here first`);
  else if (result.noPin) console.error(`${result.harnessJsonPath} pins no version, so there is no version to migrate from; nothing was written. To pin it, ${howToPinClause(result.version)}, then run js-harness migrate again.`);
  else if (result.pinNewer) console.error(`harness.json pins js-harness ${result.pin}, newer than ${result.version}, which is running; nothing was written: run that version`);
  else if (result.pinUnmovable && result.link) console.error(`${result.harnessJsonPath} is a link, and git could not give its target back, so its pin is not moved through it; nothing was written`);
  else if (result.pinUnmovable) console.error(`${result.harnessJsonPath} does not hold "version": "${result.pin}" once, so its pin cannot be moved in place; nothing was written`);
  else if (result.code !== 0 && result.uncommitted) console.error(`${result.uncommitted.join(', ')} ${result.uncommitted.length === 1 ? 'holds a change' : 'hold changes'} git has not committed, and migrate may write ${result.uncommitted.length === 1 ? 'it' : 'them'}: commit first, so git can undo the migration exactly; nothing was written`);
  else if (result.staleManifest) console.error(staleManifestMessage(result.manifestPath));
  else return false;
  return true;
}

/** What the migration leaves to its reader: the notes, context7 where it is missing, and what gentle-ai left. */
function logSaid(result) {
  for (const note of result.notes) console.log(`note: ${note.path}: ${note.reason}`);
  for (const gap of result.context7) console.log(`context7 is ${gap.state} for ${gap.where}: ${gap.fix}`);
  for (const item of result.leftovers) console.log(`gentle-ai left ${item.path} (${item.what}): ${item.how}`);
}

function runCheck(parsed, version, deps) {
  const plan = migrationPlan(parsed.cwd, version, { ...deps, home: parsed.home });
  if (refused(plan)) return 1;
  if (plan.code) return reportSyncProject(plan);
  for (const line of plan.pending) console.log(`would write: ${line}`);
  if (plan.uncommitted.length > 0) console.log(`commit first: ${plan.uncommitted.join(', ')}, which migrate may write`);
  logSaid(plan);
  if (plan.pending.length === 0 && plan.uncommitted.length === 0) {
    console.log(`nothing to migrate: the project is what ${version} writes`);
    return 0;
  }
  return 1;
}

function runMigrate(parsed, version, deps) {
  let result;
  try {
    result = migrateProject(parsed.cwd, version, { ...deps, home: parsed.home });
  } catch (err) {
    // The migration took back what it wrote before throwing, and a failure of sync's part leaves the migration's recorded.
    const stays = err?.migrated?.length > 0
      ? `what the migration wrote before it stays, recorded: ${err.migrated.join(', ')}; commit it, then run js-harness sync once the cause is fixed`
      : null;
    if (err instanceof InitWriteError && stays) {
      console.error(`migrate failed in sync's part: ${err.message}; of sync's writes, ${cleanupClause(err)}`);
      console.error(stays);
      return 1;
    }
    if (stays) console.error(stays); // Said before the unexpected error is thrown on, so its reader knows what to commit.
    if (err instanceof InitWriteError) {
      console.error(`migrate failed: ${err.message}; ${cleanupClause(err)}`);
      return 1;
    }
    throw err;
  }
  if (refused(result)) return 1;
  for (const action of result.actions ?? []) {
    if (action.kind === 'pinMoved') console.log(`moved the pin of ${action.path} from ${action.from} to ${action.to}`);
    if (action.kind === 'baseline') console.log(`recorded the coverage baseline ${action.day}`);
  }
  const code = reportSyncProject(result);
  if (result.notes === undefined) return code;
  logSaid(result);
  if (result.committed.length > 0) console.log(`commit what migrate changed: ${result.committed.sort().join(', ')}`);
  return code;
}

function runList(parsed, deps) {
  const found = candidateProjects({ claudeHome: path.join(parsed.home, '.claude'), now: deps.now, spawn: deps.spawn });
  console.log(`folders of Claude Code sessions in the last ${CANDIDATE_DAYS} days, and the initialized projects sessions ran in (read-only):`);
  for (const item of found) {
    const state = item.initialized ? `initialized, pin ${item.pin ?? 'none'}` : 'not initialized';
    console.log(`  ${String(item.days).padStart(3)}d  ${state.padEnd(26)}  ${item.path}`);
  }
  if (found.length === 0) console.log('  none');
  return 0;
}

export async function migrateMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    if (!(err instanceof MigrateArgError)) throw err;
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.list) return runList(parsed, deps);
  const version = deps.version ?? currentVersion();
  return parsed.check ? runCheck(parsed, version, deps) : runMigrate(parsed, version, deps);
}

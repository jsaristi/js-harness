#!/usr/bin/env node
// `report`: the facts a status report is written from, since the last report (odd/tasks/status-report.md). It
// reads the merges of the default branch's first-parent line, the project's channel record (the notices, the
// questions and the times reports were given) and the roadmap as the default branch holds it, and prints them
// in four sections. Read-only but for `--mark`, which appends one report line to the channel record, so that
// "since the last report" is a time read from a file and not a guess. Zero dependencies.
import { spawnSync } from 'node:child_process';
import { homedir as osHomedir } from 'node:os';
import path from 'node:path';
import { appendReport, newReport, readNotices } from './lib/channel.mjs';
import { PACE_REF_ARGS, paceRef } from './lib/progress-pace.mjs';
import { REPORT_WINDOW_HOURS, cutOf, landedOf, mapOf, mergeCommitsArgs, mergeLogArgs, parseMergeLog, questionsOf, reportLines, sessionsOf } from './lib/report.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';

export const USAGE = [
  'Usage: js-harness report [--since <time>] [--mark] [--cwd <path>] [--home <path>]',
  '  Prints what a status report is written from, since a cut: the pull requests merged into the default branch',
  "  (origin/HEAD, else main, else HEAD) with their commits, each session's last notice, the questions answered",
  '  and still open, and the roadmap phase by phase with what is left.',
  `  The cut is --since (an ISO 8601 time), else the last report recorded, else the last ${REPORT_WINDOW_HOURS} hours.`,
  '  --mark  record this report as the last one, in the channel record under the home; nothing else is written.',
].join('\n');

const GIT_TIMEOUT_MS = 30_000;

class ReportArgError extends Error {}

function parseArgs(argv) {
  const parsed = { mark: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--mark') {
      parsed.mark = true;
      continue;
    }
    const key = { '--since': 'since', '--cwd': 'cwd', '--home': 'home' }[token];
    if (key === undefined) throw new ReportArgError(`unknown argument: ${token}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--') || value === '') throw new ReportArgError(`${token} requires a value`);
    parsed[key] = value;
    i += 1;
  }
  if (parsed.since !== undefined && !(/^\d{4}-\d{2}-\d{2}/.test(parsed.since) && Number.isFinite(Date.parse(parsed.since)))) {
    throw new ReportArgError(`--since takes an ISO 8601 time, such as 2026-10-20T08:00:00Z, not ${parsed.since}`);
  }
  return parsed;
}

/** One git process in `cwd`: `{ stdout }`, or `{ error }`, the line that says why not. */
function gitRead(run, cwd, args) {
  const result = run('git', args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) return { error: `git ${args[0]}: ${result.error.code === 'ETIMEDOUT' ? `took longer than ${GIT_TIMEOUT_MS / 1000} s` : result.error.message}` };
  if (result.status !== 0) return { error: `git ${args[0]}: ${String(result.stderr ?? '').trim().split('\n')[0] || `exit ${result.status}`}` };
  return { stdout: String(result.stdout) };
}

/** What landed on `ref` after `cut`, or `{ error }`. */
function readLanded(run, cwd, ref, cut) {
  const log = gitRead(run, cwd, mergeLogArgs({ ref, since: new Date(cut).toISOString() }));
  if (log.error) return { error: log.error };
  const merges = [];
  for (const merge of parseMergeLog(log.stdout).filter((one) => one.at > cut)) {
    const commits = gitRead(run, cwd, mergeCommitsArgs(merge.hash));
    if (commits.error) return { error: commits.error };
    merges.push({ ...merge, commits: commits.stdout.split('\n').filter((line) => line.trim() !== '') });
  }
  return landedOf(merges, cut);
}

/** The roadmap as `ref` holds it, `{ absent: true }` when it holds none, or `{ error }`. */
function readMap(run, cwd, ref) {
  const shown = gitRead(run, cwd, ['show', `${ref}:docs/ROADMAP.md`]);
  if (shown.error) return /does not exist|exists on disk, but not in/.test(shown.error) ? { absent: true } : { error: shown.error };
  return mapOf(shown.stdout);
}

export async function reportMain(argv, { cwd: defaultCwd = process.cwd(), stdout = console.log, stderr = console.error, now = () => Date.now(), env = process.env, run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true }), homedir = osHomedir } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof ReportArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  // The project is the main checkout, from any worktree, as for `notify` and the board: its record is one per
  // project. The harness home is --home, else JS_HARNESS_HOME, else the user's home.
  const cwd = path.resolve(defaultCwd, parsed.cwd ?? '.');
  const slug = projectSlug(mainCheckout(run, cwd));
  const home = path.resolve(defaultCwd, parsed.home ?? (env.JS_HARNESS_HOME || homedir()));
  const at = now();

  const record = readNotices(home, slug);
  const cut = cutOf({ since: parsed.since, reports: record.reports, now: at });
  const recordError = record.unavailable === undefined ? null : { error: `the record ${record.path}: ${record.unavailable}` };

  const named = gitRead(run, cwd, PACE_REF_ARGS);
  const { ref, name } = named.error ? { ref: null, name: 'the default branch' } : paceRef(named.stdout);
  const landed = named.error ? { error: named.error } : readLanded(run, cwd, ref, cut.at);
  const map = named.error ? { error: named.error } : readMap(run, cwd, ref);
  const sessions = recordError ?? sessionsOf(record.notices, cut.at);
  const questions = recordError ?? questionsOf(record, cut.at);

  for (const line of reportLines({ cut, branch: name, landed, sessions, questions, map })) stdout(line);
  let failed = [landed, map, sessions, questions].some((section) => section.error !== undefined);

  if (parsed.mark) {
    const given = new Date(at).toISOString();
    try {
      appendReport(home, slug, newReport({ at: given, by: env.CLAUDE_CODE_SESSION_ID }));
      stdout('');
      stdout(`Recorded this report at ${given.slice(0, 16).replace('T', ' ')}Z`);
    } catch (err) {
      stderr(`js-harness report: the report was not recorded: ${err.code ?? err.message}`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

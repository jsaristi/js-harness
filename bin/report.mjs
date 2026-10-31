#!/usr/bin/env node
// `report`: the facts a status report is written from, since the last report (odd/tasks/status-report.md). It
// reads the merges of the default branch's first-parent line, the project's channel record (the notices, the
// questions and the times reports were given), the roadmap as the default branch holds it and the last stretch's
// record, and prints them in four sections, the map led by the migration's share and the last stretch. Read-only but for `--mark`, which appends one report line to the channel record, so that
// "since the last report" is a time read from a file and not a guess, and `--html`, which writes the same facts as the
// six sections of a status page (odd/tasks/visual-pages.md) with the lead's `--notes`. Zero dependencies.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import path from 'node:path';
import { appendReport as appendReportLine, newReport, readNotices } from './lib/channel.mjs';
import { PACE_REF_ARGS, paceRef } from './lib/progress-pace.mjs';
import { REPORT_WINDOW_HOURS, cutOf, landedOf, mapOf, mergeCommitsArgs, mergeLogArgs, parseMergeLog, questionsOf, reportLines, sessionsOf, stamp } from './lib/report.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';
import { recordPageRendered } from './lib/pages-rendered.mjs';
import { notesOf, renderStatus } from './lib/report-status.mjs';
import { momentAt } from './lib/report-git.mjs';
import { comparePlans } from './lib/report-pages.mjs';
import { reportStretch } from './stretch.mjs';
import { FEATURE_USAGE, reportFeatureMain } from './report-feature.mjs';
import { PHASE_USAGE, reportPhaseMain } from './report-phase.mjs';

export const USAGE = [
  'Usage: js-harness report [--since <time>] [--mark] [--html <file> [--notes <file>]] [--cwd <path>] [--home <path>]',
  '  Prints what a status report is written from, since a cut: the pull requests merged into the default branch',
  "  (origin/HEAD, else main, else HEAD) with their commits, each session's last notice, the questions answered",
  '  and still open, and the roadmap phase by phase with what is left, led by each plan section\'s steps done (the F8',
  "  plan's is the migration's share) now and at the cut, and by the last stretch open or closed since the cut: each",
  '  goal as last checked with its exit, its hours and its forecast against the map now.',
  `  The cut is --since (an ISO 8601 time), else the last report recorded, else the last ${REPORT_WINDOW_HOURS} hours.`,
  '  --mark  record this report as the last one, with the commit of the default branch it read, in the channel record',
  '          under the home; the next report lists what that branch gained since that commit. Nothing else is written,',
  '          and nothing at all when a section could not be read.',
  '  --html <file>   also write the status report as a page in Spanish, its six sections: what landed, the sessions,',
  '                  his decisions, the map (against the map at the head the last --mark read, each plan step by step),',
  '                  what waits and what the lead proposes, after what the last --mark proposed and its estimates; the',
  '                  page goes into the rendered record of the templates, to show it unchanged',
  '  --notes <file>  the lead\'s notes for what no record holds, JSON: { badNews: [text], decisions: [{ text, changed }],',
  '                  waits: [{ what, why }], proposals: [{ step, why, estimate? }] }, each shown as the lead\'s; --mark',
  '                  records the proposals\' steps and estimates; --mark --html without it warns that sections 3, 5',
  '                  and 6 will say no record holds them',
  '',
  PHASE_USAGE,
  '',
  FEATURE_USAGE,
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
    const key = { '--since': 'since', '--html': 'html', '--notes': 'notes', '--cwd': 'cwd', '--home': 'home' }[token];
    if (key === undefined) throw new ReportArgError(`unknown argument: ${token}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--') || value === '') throw new ReportArgError(`${token} requires a value`);
    parsed[key] = value;
    i += 1;
  }
  if (parsed.since !== undefined && !(/^\d{4}-\d{2}-\d{2}/.test(parsed.since) && Number.isFinite(Date.parse(parsed.since)))) {
    throw new ReportArgError(`--since takes an ISO 8601 time, such as 2026-10-20T08:00:00Z, not ${parsed.since}`);
  }
  if (parsed.notes !== undefined && parsed.html === undefined) throw new ReportArgError('--notes goes with --html: the notes are sections of the page');
  return parsed;
}

/** One git process in `cwd`: `{ stdout }`, or `{ error }`, the line that says why not. */
function gitRead(run, cwd, args) {
  const result = run('git', args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) return { error: `git ${args[0]}: ${result.error.code === 'ETIMEDOUT' ? `took longer than ${GIT_TIMEOUT_MS / 1000} s` : result.error.message}` };
  if (result.status !== 0) return { error: `git ${args[0]}: ${String(result.stderr ?? '').trim().split('\n')[0] || `exit ${result.status}`}` };
  return { stdout: String(result.stdout) };
}

/** What landed on `ref` after the cut, or `{ error }`. After a recorded report that names the commit it read, it is
 * what `ref` gained since that commit, whatever the merges' times: a pull request merged before that report and
 * fetched after it has an older time than the report, and a cut by time would never show it. A commit this clone
 * no longer holds falls back to the time. */
function readLanded(run, cwd, ref, cut) {
  const head = cut.head !== null && !gitRead(run, cwd, ['cat-file', '-e', `${cut.head}^{commit}`]).error ? cut.head : null;
  const log = gitRead(run, cwd, mergeLogArgs({ ref, since: new Date(cut.at).toISOString(), head }));
  if (log.error) return { error: log.error };
  const after = head === null ? cut.at : -Infinity;
  const merges = [];
  for (const merge of parseMergeLog(log.stdout).filter((one) => one.at > after)) {
    const commits = gitRead(run, cwd, mergeCommitsArgs(merge.hash));
    if (commits.error) return { error: commits.error };
    merges.push({ ...merge, commits: commits.stdout.split('\n').filter((line) => line.trim() !== '') });
  }
  return landedOf(merges, after);
}

/** The roadmap as `ref` holds it, `{ absent: true }` when it holds none, or `{ error }`. Whether it holds one is read
 * from the tree's listing, which is empty for a path it lacks, and not from git's message, which is translated. */
function readMap(run, cwd, ref) {
  const listed = gitRead(run, cwd, ['ls-tree', '--full-tree', '--name-only', ref, '--', 'docs/ROADMAP.md']);
  if (listed.error) return { error: listed.error };
  if (listed.stdout.trim() === '') return { absent: true };
  const shown = gitRead(run, cwd, ['show', `${ref}:docs/ROADMAP.md`]);
  return shown.error ? { error: shown.error } : mapOf(shown.stdout);
}

/** Each plan step by step at the cut (`head`, or none) and at `ref` now (`comparePlans`), or `{ unavailable }`. */
function stepsOf(run, cwd, ref, head) {
  const after = momentAt(run, cwd, ref);
  if (after.unavailable) return { unavailable: after.unavailable };
  const before = head === null ? null : momentAt(run, cwd, head);
  const usable = before !== null && !before.unavailable ? before : null;
  return comparePlans(usable?.plans ?? null, after.plans, { before: usable?.tasks ?? {}, after: after.tasks });
}

export async function reportMain(argv, options = {}) {
  // A moment's page is its own command, with its own options.
  if (argv[0] === 'phase') return reportPhaseMain(argv.slice(1), options);
  if (argv[0] === 'feature') return reportFeatureMain(argv.slice(1), options);
  const { cwd: defaultCwd = process.cwd(), stdout = console.log, stderr = console.error, now = () => Date.now(), env = process.env, run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true }), homedir = osHomedir, appendReport = appendReportLine, fileSystem = fs, recordLoad } = options;
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof ReportArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  // A relative --notes is read under --cwd, where a relative --html is written, as stretch's --html is.
  const cwd = path.resolve(defaultCwd, parsed.cwd ?? '.');
  // The notes are read whole before anything is read or written: a page with half the lead's notes would pass for whole.
  let notes = null;
  if (parsed.notes !== undefined) {
    const file = path.resolve(cwd, parsed.notes);
    try {
      notes = notesOf(fileSystem.readFileSync(file, 'utf8'));
    } catch (err) {
      stderr(`js-harness report: --notes ${file}: ${err.code ?? err.message}`);
      return 2;
    }
  }
  // A page recorded as the report he reads, with three of its six sections only the lead can fill, is said before it
  // is sent (odd/tasks/report-stretch-share.md, S3).
  if (parsed.mark && parsed.html !== undefined && notes === null) {
    stderr("js-harness report: warning: no --notes, so sections 3, 5 and 6 of the page (his decisions, what waits, what the lead proposes) will say no record holds them: pass them with --notes <file>");
  }

  // The project is the main checkout, from any worktree, as for `notify` and the board: its record is one per
  // project. The harness home is --home, else JS_HARNESS_HOME, else the user's home.
  const root = mainCheckout(run, cwd);
  const slug = projectSlug(root);
  const home = harnessHome({ given: parsed.home, env, cwd: defaultCwd, homedir });
  const at = now();

  const record = readNotices(home, slug);
  const cut = cutOf({ since: parsed.since, reports: record.reports, now: at });
  const recordError = record.unavailable === undefined ? null : { error: `the record ${record.path}: ${record.unavailable}` };

  const named = gitRead(run, cwd, PACE_REF_ARGS);
  const { ref, name } = named.error ? { ref: null, name: 'the default branch' } : paceRef(named.stdout);
  // The commit of the default branch this report reads, which `--mark` records so the next report starts there.
  const seen = named.error ? null : gitRead(run, cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
  const landed = named.error ? { error: named.error } : readLanded(run, cwd, ref, cut);
  const map = named.error ? { error: named.error } : readMap(run, cwd, ref);
  const sessions = recordError ?? sessionsOf(record.notices, cut.at);
  const questions = recordError ?? questionsOf(record, cut.at);

  // The map before is the one at the commit the last recorded report read: the migration's share at the cut, and the
  // page's before. The last stretch is what `stretch status` or `show` measure (odd/tasks/report-stretch-share.md).
  const was = cut.head === null ? null : readMap(run, cwd, cut.head);
  const before = was === null ? null : was.error ? { unavailable: `${cut.head.slice(0, 8)}: ${was.error}` } : was.absent ? { unavailable: `${cut.head.slice(0, 8)} holds no docs/ROADMAP.md` } : { map: was };
  const stretch = reportStretch({ home, root, slug, since: cut.at, now: at, run, fileSystem });

  for (const line of reportLines({ cut, branch: name, landed, sessions, questions, map, before, stretch })) stdout(line);
  // A stretch record that cannot be read, or one its measure reads, is a section that could not be read: --mark then
  // records nothing.
  // The plan step by step is the page's alone ("el mapa de donde vamos", odd/tasks/departure-stretch.md, spec 9): it
  // reads every task document the steps name, at the cut and now. Steps it could not read are a section unread; with
  // no roadmap, or one the map already could not read, there are no steps to read, and the map says why.
  const steps = parsed.html === undefined || map.absent || map.error !== undefined ? undefined : stepsOf(run, cwd, ref, cut.head);
  const failed = [landed, map, sessions, questions].some((section) => section.error !== undefined) || stretch?.unavailable !== undefined || Object.keys(stretch?.unread ?? {}).length > 0 || steps?.unavailable !== undefined;
  if (parsed.html !== undefined) {
    // A section that could not be read is said on the page as it is in the lines above.
    const file = path.resolve(cwd, parsed.html);
    try {
      fileSystem.mkdirSync(path.dirname(file), { recursive: true });
      fileSystem.writeFileSync(file, renderStatus({ cut, branch: name, landed, sessions, questions, map, before, steps, stretch, notes }), 'utf8');
    } catch (err) {
      stderr(`js-harness report: the page ${file} could not be written: ${err.code ?? err.message}`);
      return 1;
    }
    const head = seen?.stdout?.trim() || null;
    const rendered = await recordPageRendered({ home, slug, template: 'status-report', subject: 'status', path: file, at: new Date(at).toISOString(), head }, recordLoad ? { load: recordLoad } : {});
    stdout('');
    stdout(rendered.recorded ? `Wrote ${file}, in the rendered record ${rendered.file} (sha256 ${rendered.recorded.sha256.slice(0, 12)}): show or publish it unchanged.` : `Wrote ${file}; it is not in the rendered record: ${rendered.unavailable}.`);
  }
  if (!parsed.mark) return failed ? 1 : 0;

  // A report a section of which could not be read is not recorded: the next one would start after facts this one
  // never showed.
  if (failed) {
    stderr('js-harness report: not recorded: a section could not be read, so the next report starts where this one did');
    return 1;
  }
  try {
    // Its proposals and their estimates go with it, so the next report sets each beside what landed.
    appendReport(home, slug, newReport({ at: new Date(at).toISOString(), by: env.CLAUDE_CODE_SESSION_ID, head: seen?.stdout?.trim(), proposals: notes?.proposals ?? [] }));
  } catch (err) {
    stderr(`js-harness report: the report was not recorded: ${err.code ?? err.message}`);
    return 1;
  }
  stdout('');
  stdout(`Recorded this report at ${stamp(at)}`);
  return 0;
}

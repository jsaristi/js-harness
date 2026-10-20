#!/usr/bin/env node
// `js-harness throughput`: the measure of the throughput review (odd/tasks/throughput-review.md, unit 1). It prints
// a fixed table over whole UTC days, each row naming its source, from each day's snapshot when there is one and from
// the live records otherwise. `snapshot` keeps the facts of a closed day under the harness home, once, so a
// before/after reads what the day was and not what a rotating log still holds; `status` names the days with none
// and the reviews due. `reviewed` and `shipped` record the review's outcomes, which say when the next one is due
// (unit 3). The table and the status write nothing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readGateHolder } from './lib/gate-lock.mjs';
import { readGateLog, readGateTestTimes } from './lib/gate-log.mjs';
import { paceLogArgs, parsePaceLog } from './lib/progress-pace.mjs';
import { ruleValue } from './lib/rules.mjs';
import { readNotices, recordPath } from './lib/channel.mjs';
import { readCodexReviewRuns } from './lib/codex-review-runs.mjs';
import { jsonLinesPath } from './lib/codex-reviews.mjs';
import { gitDirs } from './lib/project.mjs';
import { liveLineages, readReviewEnds, readReviewStarts, reviewStartsFile } from './lib/review-starts.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import {
  addDays,
  channelIdle,
  codexFacts,
  COMPARE_DAYS,
  compareWindows,
  conflictFiles,
  dayBounds,
  daysBetween,
  gateFacts,
  landFacts,
  lastSettledDay,
  questionFacts,
  reviewFacts,
  parseCommitTimes,
  parseMergeFiles,
  parseMerges,
  prFacts,
  taskChanges,
  taskCounts,
  testTimeFacts,
  withReadyAt,
  throughputDues,
  throughputRows,
  utcDay,
} from './lib/throughput.mjs';

export const SNAPSHOT_SCHEMA = 'js-harness.throughput-day/v1';

export const USAGE = [
  'Usage: js-harness throughput [--since <YYYY-MM-DD>] [--until <YYYY-MM-DD>] [--against <since>..<until>] [--json]',
  '       js-harness throughput snapshot [--day <YYYY-MM-DD>] [--gate-log <file>]... [--copied-at <YYYY-MM-DDTHH:MMZ>]',
  '       js-harness throughput status',
  '       js-harness throughput reviewed (--day <YYYY-MM-DD> | --shipped <YYYY-MM-DD>) --found nothing|candidates',
  '       js-harness throughput shipped <item> [--day <YYYY-MM-DD>]',
  '       (each also takes --cwd <path> and --home <path>)',
  '  The table: the UTC days [since, until), by default the day before today. The gates of a day are read from its',
  '    snapshot when there is one, else from the live gate log; main and the Codex runs are always read live. Every row',
  '    names its source, and a fact no record holds says which recorder it waits for. It fetches nothing: main is',
  '    origin/main as last fetched. It writes no file, but git merge-tree, which names the files of a conflicted',
  '    merge, writes objects into the object store.',
  '  snapshot: keeps the gates of one UTC day (default yesterday) in <home>/.js-harness/throughput/<project>/<day>.json,',
  '    once the day has settled, two gate-max after its midnight. A kept day is written again only by a fuller one,',
  '    the replacement recorded (exit 1 otherwise). --gate-log reads copies of the gate log instead of the live one,',
  '    at most two (the log and its rotated file), for a day the live log has rotated away; a copy made before the',
  '    day settled keeps it as partial until then. A copy is made no earlier than its modification time; one that kept',
  "    its source's time says when it was made with --copied-at.",
  '  --against: the window compared with an equal window before it, a row each, daily value with daily value. Under 7',
  '    days a side it prints both and how often the after median of a window that did not change falls outside the',
  '    before range, and judges nothing; from 7, a row moved only when the after median lies outside the before range.',
  '  status: the days kept, each partial one with why, and each day since the first one kept that has none (exit 1);',
  '    none kept at all is missing too (exit 1). Then a DUE line for each review owed, which changes no exit code: the',
  '    last settled day, unless a review of it or later is recorded, or weekly once the last reviews in a row the rule',
  '    throughput-quiet-runs counts found nothing; and a re-measure of each day something shipped, once the',
  '    throughput-compare-days after it have settled.',
  '  reviewed: records a review of the days up to --day, or the re-measure of what shipped on --shipped, and whether',
  '    it found candidates, in <home>/.js-harness/throughput/<project>/outcomes.jsonl. The day must have settled.',
  '  shipped: records that <item> shipped on --day (default today), so its re-measure falls due.',
  '  Exit 2: a usage error, and nothing is done.',
].join('\n');

class ThroughputArgError extends Error {}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERBS = new Set(['snapshot', 'status', 'reviewed', 'shipped']);
const FLAGS_OF = {
  table: ['--since', '--until', '--against', '--json', '--cwd', '--home'],
  snapshot: ['--day', '--gate-log', '--copied-at', '--cwd', '--home'],
  status: ['--cwd', '--home'],
  reviewed: ['--day', '--shipped', '--found', '--cwd', '--home'],
  shipped: ['--day', '--cwd', '--home'],
};
const FOUND = ['nothing', 'candidates'];

/** Whether `value` is a day of the calendar as `YYYY-MM-DD`: a month 13 does not parse, and a 31st of a month of 30
 * rolls over to another day. */
function isDay(value) {
  const at = Date.parse(`${value}T00:00:00Z`);
  return DAY.test(value ?? '') && Number.isFinite(at) && utcDay(at) === value;
}

function parseArgs(argv) {
  const verb = VERBS.has(argv[0]) ? argv[0] : 'table';
  const rest = verb === 'table' ? argv : argv.slice(1);
  const allowed = new Set(FLAGS_OF[verb]);
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (verb === 'shipped' && !arg.startsWith('--')) {
      if (flags.item !== undefined) throw new ThroughputArgError(`throughput shipped takes one item, quoted if it has spaces: ${flags.item}, then ${arg}`);
      if (arg.trim() === '') throw new ThroughputArgError('throughput shipped takes the item that shipped, not an empty one');
      flags.item = arg;
      continue;
    }
    if (!allowed.has(arg)) throw new ThroughputArgError(arg.startsWith('--') ? `${arg} is not an option of throughput${verb === 'table' ? '' : ` ${verb}`}` : `unexpected argument: ${arg}`);
    if (arg === '--json') {
      flags.json = true;
      continue;
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw new ThroughputArgError(`${arg} requires a value`);
    if (['--since', '--until', '--day', '--shipped'].includes(arg) && !isDay(value)) throw new ThroughputArgError(`${arg} takes a day as YYYY-MM-DD: ${value}`);
    if (arg === '--found' && !FOUND.includes(value)) throw new ThroughputArgError(`--found takes ${FOUND.join(' or ')}: ${value}`);
    if (arg === '--against') {
      const [since, until] = value.split('..');
      if (!isDay(since) || !isDay(until) || !(since < until)) throw new ThroughputArgError(`--against takes the window before as <since>..<until>, each YYYY-MM-DD: ${value}`);
      flags.against = { since, until };
    } else if (arg === '--copied-at') {
      if (!(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(value) && Number.isFinite(Date.parse(value)))) throw new ThroughputArgError(`--copied-at takes a UTC time as YYYY-MM-DDTHH:MMZ: ${value}`);
      flags['copied-at'] = Date.parse(value);
    } else if (arg === '--gate-log') {
      flags['gate-log'] = [...(flags['gate-log'] ?? []), value];
      if (flags['gate-log'].length > 2) throw new ThroughputArgError('--gate-log takes two copies at most: the newer, then the older');
    } else flags[arg.slice(2)] = value;
    i += 1;
  }
  if (flags['copied-at'] !== undefined && !flags['gate-log']) throw new ThroughputArgError('--copied-at says when the --gate-log copies were made, and needs them');
  if (verb === 'reviewed' && (flags.day === undefined) === (flags.shipped === undefined)) throw new ThroughputArgError('throughput reviewed takes one of --day <day> (a review) and --shipped <day> (a re-measure)');
  if (verb === 'reviewed' && flags.found === undefined) throw new ThroughputArgError(`throughput reviewed says what the review found: --found ${FOUND.join('|')}`);
  if (verb === 'shipped' && flags.item === undefined) throw new ThroughputArgError('throughput shipped names what shipped: js-harness throughput shipped <item> [--day <day>]');
  return { verb, flags };
}

/** One git process in `root`: `{ stdout, status }`, or `{ error }` in one line. */
function git(run, root, args) {
  const result = run('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60_000, windowsHide: true });
  if (result.error) return { error: `git ${args[0]}: ${result.error.message}` };
  return { stdout: String(result.stdout ?? ''), status: result.status, stderr: String(result.stderr ?? '') };
}

const firstLine = (text) => String(text ?? '').trim().split(/\r?\n/)[0];

/** The facts git holds of `[from, to)`: the merged pull requests, the task counts at both bounds and the merges into
 * branches that conflicted. `{ prs, tasks, conflicts, branchMerges, unread }`, `unread` naming the part of them git
 * failed to give and why; or `{ unavailable }` with why. */
function gitFacts(ctx, { from, to }) {
  const { run, root } = ctx;
  const ref = git(run, root, ['rev-parse', '--verify', '--quiet', 'origin/main']);
  if (ref.error || ref.status !== 0) return { unavailable: ref.error ?? 'origin/main is not there' };
  const since = new Date(from - 24 * 3600 * 1000).toISOString();
  const until = new Date(to).toISOString();
  const firstParent = git(run, root, ['log', '--first-parent', '--merges', `--since=${since}`, '--format=%H%x09%cI%x09%P%x09%s', 'origin/main']);
  if (firstParent.error || firstParent.status !== 0) return { unavailable: firstParent.error ?? firstLine(firstParent.stderr) };
  const merges = parseMerges(firstParent.stdout);
  const heads = merges.map((merge) => merge.head).filter(Boolean);
  const shown = heads.length ? git(run, root, ['show', '-s', '--format=%H%x09%cI', ...heads]) : { stdout: '' };
  // What each merge changed against main before it, so a docs-only pull request is told from one with code.
  const changed = git(run, root, ['log', '-m', '--first-parent', '--merges', '--name-only', `--since=${since}`, '--format=%x01%H', 'origin/main']);
  const prs = prFacts(merges, parseCommitTimes(shown.stdout ?? ''), { from, to }, parseMergeFiles(changed.stdout ?? ''));

  const countAt = (ms) => {
    const commit = git(run, root, ['rev-list', '-1', '--first-parent', `--before=${new Date(ms).toISOString()}`, 'origin/main']);
    const sha = firstLine(commit.stdout);
    if (commit.error || commit.status !== 0 || sha === '') return null;
    // Each task document whole, so a task table's rows count as progress counts them (harness review d6).
    // NUL-delimited, so a path that is not ASCII comes whole rather than quoted, as `paceLogArgs` reads it (Codex).
    const listed = git(run, root, ['ls-tree', '-r', '-z', '--name-only', sha, '--', 'odd/tasks', 'docs/ROADMAP.md']);
    if (listed.error || listed.status !== 0) return null;
    const files = [];
    for (const file of listed.stdout.split('\0').filter((name) => name === 'docs/ROADMAP.md' || /^odd\/tasks\/[^/]+\.md$/.test(name))) {
      const shown = git(run, root, ['show', `${sha}:${file}`]);
      if (shown.error || shown.status !== 0) return null;
      files.push({ path: file, text: shown.stdout });
    }
    return taskCounts(files);
  };
  const start = countAt(from);
  const end = countAt(to);
  // What each commit of the day did to the tasks, as progress reads it: the totals at both ends are not throughput.
  const history = taskHistory(ctx, from);
  const unread = {};
  let tasks = null;
  if (history.unavailable) unread.tasks = history.unavailable;
  else if (start && end) tasks = { start, end, changes: taskChanges(history.commits, { from, to }) };

  const read = branchConflicts(run, root, { from, to, until });
  if (read.unavailable) unread.conflicts = read.unavailable;
  return { prs, tasks, conflicts: read.conflicts ?? [], branchMerges: read.branchMerges ?? 0, unread };
}

/** The commits of main since `from` with each task document before and after them (`parsePaceLog`'s), or
 * `{ unavailable }`: read once a run from the earliest day asked, since every day of a window reads the same history. */
function taskHistory(ctx, from) {
  if (ctx.history && ctx.history.from <= from) return ctx.history;
  const read = git(ctx.run, ctx.root, paceLogArgs({ ref: 'origin/main', since: new Date(from).toISOString() }));
  ctx.history = failed(read) ? { from, unavailable: `git log: ${failed(read)}` } : { from, commits: parsePaceLog(read.stdout) };
  return ctx.history;
}

/** Why a git process failed, in one line, or `null` when it exited 0. */
const failed = (result) => (result.error ? result.error : result.status === 0 ? null : firstLine(result.stderr) || `exit ${result.status}`);

/** The merges into branches on main in `[from, to)` and those that conflicted, rebuilt with `git merge-tree`, which
 * exits 1 for a conflict; `{ unavailable }` when a git process failed, so a failure is never read as no conflict. */
function branchConflicts(run, root, { from, to, until }) {
  const all = git(run, root, ['log', '--merges', `--since=${new Date(from).toISOString()}`, `--until=${until}`, '--format=%H%x09%cI%x09%P%x09%s', 'origin/main']);
  if (failed(all)) return { unavailable: `git log: ${failed(all)}` };
  const conflicts = [];
  let branchMerges = 0;
  for (const line of all.stdout.split(/\r?\n/)) {
    const [commit, at, parents, subject] = line.split('\t');
    if (!commit || /^Merge pull request #/.test(subject ?? '') || !(Date.parse(at) >= from && Date.parse(at) < to)) continue;
    branchMerges += 1;
    const [ours, theirs] = String(parents).split(' ');
    const tree = git(run, root, ['merge-tree', '--write-tree', '--name-only', '--no-messages', ours, theirs]);
    if (tree.status === 1) conflicts.push({ merge: commit, files: conflictFiles(tree.stdout) });
    else if (failed(tree)) return { unavailable: `git merge-tree: ${failed(tree)}` };
  }
  return { conflicts, branchMerges };
}

/** The facts of `day` that a rotating record holds, the only ones a snapshot keeps: the gates. `gateLogs`, when
 * given, are archived copies of the gate log read in its place, the newer first. */
function rotatingFacts(day, ctx, gateLogs = null, copiedAt = null) {
  const facts = { partialFrom: null, partialUntil: null, gates: [], fallbacks: [], unavailable: {} };
  const files = gateLogs ? { 'log.jsonl': gateLogs[0], 'log.1.jsonl': gateLogs[1] } : null;
  const fileSystem = files
    ? { readFileSync: (file, encoding) => { const copy = files[path.basename(file)]; if (!copy) throw Object.assign(new Error('none'), { code: 'ENOENT' }); return ctx.fileSystem.readFileSync(copy, encoding); } }
    : ctx.fileSystem;
  const log = readGateLog(ctx.home, { fileSystem });
  if (log.unavailable) facts.unavailable['gate log'] = log.unavailable.join(', ');
  else Object.assign(facts, gateFacts(log.events, dayBounds(day)));
  // The test times of the day's gates (B5), from the live folder only: a copy of the log carries none, so a day
  // kept from copies says it has no times rather than none, and a times file that cannot be read says why.
  if (!gateLogs && !log.unavailable) {
    try {
      facts.testTimes = testTimeFacts(readGateTestTimes(ctx.home, { fileSystem: ctx.fileSystem }), facts.gates.map((gate) => gate.id));
    } catch (err) {
      facts.unavailable.times = err.message;
    }
  }
  // The live log holds every gate up to now; a copy only up to when it was made, which is no earlier than its newest
  // event nor than its modification time. Made before the day settled, it may lack the day's last gates.
  if (gateLogs && log.events?.length) {
    // A copy that kept its source's time says only its last write: `--copied-at` says when it was made.
    // A loop, not a spread: the copies a snapshot names can hold more events than a call takes arguments.
    let madeAt = copiedAt ?? ctx.fileSystem.statSync(gateLogs[0]).mtimeMs;
    for (const event of log.events) {
      const at = Date.parse(event.at);
      if (at > madeAt) madeAt = at;
    }
    if (madeAt < settlesAt(day)) facts.partialUntil = new Date(madeAt).toISOString();
  }
  return facts;
}

/** The facts of `day` that append-only records hold (main's history, the Codex runs), read live every time: a
 * snapshot of them would freeze what a stale fetch had not seen yet. */
function appendOnlyFacts(day, ctx) {
  const bounds = dayBounds(day);
  const facts = { prs: [], codex: [], tasks: null, conflicts: [], branchMerges: 0, idle: [], lands: [], unavailable: {} };
  const fromGit = gitFacts(ctx, bounds);
  if (fromGit.unavailable) facts.unavailable.git = fromGit.unavailable;
  else {
    const { unread, ...read } = fromGit;
    Object.assign(facts, read);
    Object.assign(facts.unavailable, unread);
  }
  try {
    facts.codex = codexFacts(ctx.readCodexRuns(ctx.root), bounds);
  } catch (err) {
    facts.unavailable.codex = err.message;
  }
  const notices = channelNotices(ctx);
  if (notices.unavailable) facts.unavailable.channel = notices.unavailable;
  else {
    facts.idle = channelIdle(notices, bounds);
    facts.prs = withReadyAt(facts.prs, notices);
    const record = channelRecord(ctx);
    if (record.unavailable) facts.unavailable.channel = record.unavailable;
    else facts.questions = questionFacts(record, bounds);
  }
  try {
    facts.lands = landFacts(ctx.readLands(ctx.root), bounds);
  } catch (err) {
    facts.unavailable.lands = err.message;
  }
  // gentle-ai's store and the recorded starts are read once a run (B6): there is a terminal record per review ever
  // acknowledged, too many to read again for each day.
  ctx.reviews ??= (() => {
    try {
      return { record: ctx.readReviews(ctx.root, ctx.home, ctx.slug) };
    } catch (err) {
      return { unavailable: err.message };
    }
  })();
  if (ctx.reviews.unavailable) facts.unavailable.reviews = ctx.reviews.unavailable;
  else {
    const { startsUnavailable, ...record } = ctx.reviews.record;
    if (startsUnavailable) facts.unavailable['review starts'] = startsUnavailable;
    facts.reviews = reviewFacts(record, bounds);
  }
  return facts;
}

/** The record of the project's gentle-ai reviews (B6): gentle-ai's terminal records and live lineages in the store
 * under the git common dir, and the starts the pause hook kept under the harness home. A store that cannot be read
 * throws its code; a starts file that cannot be read is said apart (`startsUnavailable`), since the acknowledgements
 * do not need it. */
function readReviewRecord(root, home, slug, run, fileSystem) {
  const { commonGitDir } = gitDirs(root, run);
  if (!commonGitDir) throw new Error('no git common dir');
  const record = {
    ends: readReviewEnds(commonGitDir, { fileSystem }),
    live: liveLineages(commonGitDir, { fileSystem }).map((one) => one.lineage),
  };
  try {
    return { ...record, starts: readReviewStarts(reviewStartsFile(home, slug), { fileSystem }) };
  } catch (err) {
    return { ...record, starts: [], startsUnavailable: err.message };
  }
}

/** The merge queue's land records (`<git common dir>/js-harness/lands.jsonl`): none where the file is not there, a
 * machine where no land ran, and a throw where it is there and cannot be read, so its row says so instead of none. A
 * line that does not parse is left out. */
function readLandRecord(root, run, fileSystem) {
  const file = jsonLinesPath(root, 'lands.jsonl', { spawn: run });
  if (!file) return [];
  let text;
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new Error(err.code ?? err.message);
  }
  return text.split(/\r?\n/).flatMap((line) => {
    try {
      const parsed = JSON.parse(line);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

/** The notices of the project's channel record, read once a run; `{ unavailable }` with why. A line that does not
 * parse is left out, as every reader of the record leaves it. */
function channelNotices(ctx) {
  if (ctx.channel) return ctx.channel;
  let text;
  try {
    text = ctx.fileSystem.readFileSync(recordPath(ctx.home, ctx.slug), 'utf8');
  } catch (err) {
    ctx.channel = { unavailable: err.code === 'ENOENT' ? 'no channel record' : (err.code ?? err.message) };
    return ctx.channel;
  }
  const notices = [];
  for (const line of text.split(/\r?\n/)) {
    try {
      if (line.trim() !== '') notices.push(JSON.parse(line));
    } catch {
      // a torn or foreign line
    }
  }
  ctx.channel = notices;
  return notices;
}

/** The channel's record as its board reads it (`readNotices`), read once a run: its questions are numbered there,
 * by every line that is a question notice, so the questions row names each by the number the board gave it. */
function channelRecord(ctx) {
  ctx.channelRecord ??= readNotices(ctx.home, ctx.slug, { readFile: (file) => ctx.fileSystem.readFileSync(file, 'utf8') });
  return ctx.channelRecord;
}

/** The live facts of `day`, both halves. */
function liveFacts(day, ctx) {
  const rotating = rotatingFacts(day, ctx);
  const appended = appendOnlyFacts(day, ctx);
  return { day, source: 'live', ...rotating, ...appended, unavailable: { ...rotating.unavailable, ...appended.unavailable } };
}

const snapshotFolder = (home, slug) => path.join(home, '.js-harness', 'throughput', slug);

/** The snapshot of `day`: its facts, `null` when there is none, or `{ unreadable }`. */
function readSnapshot(file, fileSystem) {
  let text;
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    return err.code === 'ENOENT' ? null : { unreadable: err.code ?? err.message };
  }
  try {
    const value = JSON.parse(text);
    if (value?.schema !== SNAPSHOT_SCHEMA) return { unreadable: `not a ${SNAPSHOT_SCHEMA} snapshot` };
    return { ...value, source: 'snapshot' };
  } catch (err) {
    return { unreadable: err.message };
  }
}

function dayFacts(day, ctx) {
  const kept = readSnapshot(path.join(ctx.folder, `${day}.json`), ctx.fileSystem);
  if (kept && !kept.unreadable) {
    const appended = appendOnlyFacts(day, ctx);
    return { ...kept, ...appended, unavailable: { ...kept.unavailable, ...appended.unavailable } };
  }
  const live = liveFacts(day, ctx);
  if (kept?.unreadable) live.snapshotUnreadable = kept.unreadable;
  return live;
}

const yesterday = (now) => utcDay(now - 24 * 3600 * 1000);

/** The window `[since, until)` in the machine's hours, `offset` being `getTimezoneOffset`'s minutes (UTC minus
 * local): `local UTC-05:00: 2026-10-15 19:00 to 2026-10-16 19:00`. */
function localWindow(since, until, offset) {
  const at = (day) => new Date(dayBounds(day).from - offset * 60000).toISOString().slice(0, 16).replace('T', ' ');
  const sign = offset > 0 ? '-' : '+';
  const zone = `${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
  return `local UTC${sign}${zone}: ${at(since)} to ${at(until)}`;
}

function table(ctx, flags) {
  const until = flags.until ?? utcDay(ctx.now());
  const since = flags.since ?? utcDay(Date.parse(`${until}T00:00:00Z`) - 24 * 3600 * 1000);
  if (!(since < until)) throw new ThroughputArgError(`--since ${since} is not before --until ${until}`);
  const days = daysBetween(since, until).map((day) => dayFacts(day, ctx));
  if (flags.against) return compared(ctx, flags, { since, until }, days);
  const rows = throughputRows(days);
  if (flags.json) {
    ctx.out(JSON.stringify({ since, until, days: days.map(({ day, source, partialFrom, partialUntil = null, unavailable }) => ({ day, source, partialFrom, partialUntil, unavailable })), rows }, null, 2));
    return 0;
  }
  ctx.out(`Throughput  ${since} to ${until} (UTC, until excluded; ${localWindow(since, until, ctx.timezoneOffset())})  ${ctx.root}`);
  ctx.out('  gates: every project of this machine, as the gate lock is; the other rows: this project');
  for (const day of days) ctx.out(`  ${day.day}  ${day.source === 'snapshot' ? 'snapshot' : 'live records'}${day.partialFrom ? `, the gate log from ${day.partialFrom}` : ''}${day.partialUntil ? `, the gate log until ${day.partialUntil}` : ''}${day.snapshotUnreadable ? ` (its snapshot is unreadable: ${day.snapshotUnreadable})` : ''}`);
  const width = Math.max(...rows.map((row) => row.label.length));
  for (const row of rows) ctx.out(`${row.label.padEnd(width)}  ${row.value}  [${row.source}]`);
  return 0;
}

/** The window against an equal one before it (`--against`), each compared row's daily values side by side. */
function compared(ctx, flags, after, afterDays) {
  const before = flags.against;
  const beforeDays = daysBetween(before.since, before.until);
  if (beforeDays.length !== afterDays.length) throw new ThroughputArgError(`--against reads equal windows: ${beforeDays.length} days before, ${afterDays.length} after`);
  if (before.until > after.since) throw new ThroughputArgError(`--against takes the window before: ${before.since}..${before.until} does not end by ${after.since}`);
  const rows = compareWindows(beforeDays.map((day) => dayFacts(day, ctx)), afterDays);
  if (flags.json) {
    ctx.out(JSON.stringify({ before, after, rows }, null, 2));
    return 0;
  }
  const list = (values) => (values.length ? values.join(', ') : 'none');
  ctx.out(`Throughput compared  before ${before.since} to ${before.until}, after ${after.since} to ${after.until} (UTC days, until excluded)  ${ctx.root}`);
  const width = Math.max(...rows.map((row) => row.label.length));
  const beforeWidth = Math.max(...rows.map((row) => list(row.before).length));
  const afterWidth = Math.max(...rows.map((row) => list(row.after).length));
  for (const row of rows) ctx.out(`${row.label.padEnd(width)}  before ${list(row.before).padEnd(beforeWidth)}  after ${list(row.after).padEnd(afterWidth)}  ${row.verdict}`);
  return 0;
}

/** Whether `next` covers more of its day than `kept`: as much at both ends, and more at one, a start lost to the
 * rotation or an end a copy made too early lacks. */
function fuller(next, kept) {
  const start = (facts) => (facts.partialFrom ? Date.parse(facts.partialFrom) : -Infinity);
  const end = (facts) => (facts.partialUntil ? Date.parse(facts.partialUntil) : Infinity);
  return start(next) <= start(kept) && end(next) >= end(kept) && (start(next) < start(kept) || end(next) > end(kept));
}

/** When every gate of `day` has its end: a gate's start line is written after its wait and its run is bounded by
 * gate-max, so two gate-max after midnight. */
const settlesAt = (day) => dayBounds(day).to + 2 * ruleValue('gate-max', 'minutes') * 60000;

function snapshot(ctx, flags) {
  const day = flags.day ?? yesterday(ctx.now());
  const settles = settlesAt(day);
  if (settles > ctx.now()) {
    ctx.err(`js-harness throughput: ${day} settles at ${new Date(settles).toISOString()}: only a day whose gates have ended is kept`);
    return 2;
  }
  // A copy made after now would vouch for gates no copy can hold yet, and settle a day it has only in part.
  if (flags['copied-at'] !== undefined && flags['copied-at'] > ctx.now()) {
    ctx.err(`js-harness throughput: --copied-at ${new Date(flags['copied-at']).toISOString()} is after now (${new Date(ctx.now()).toISOString()}): a copy is made by then`);
    return 2;
  }
  // A copy named that is not there would read as a log with no gate, which a kept day must never be written from.
  for (const copy of flags['gate-log'] ?? []) {
    try {
      ctx.fileSystem.statSync(copy);
    } catch {
      throw new ThroughputArgError(`--gate-log ${copy}: no such file`);
    }
  }
  const file = path.join(ctx.folder, `${day}.json`);
  const kept = readSnapshot(file, ctx.fileSystem);
  const facts = rotatingFacts(day, ctx, flags['gate-log'] ?? null, flags['copied-at'] ?? null);
  if (facts.unavailable['gate log']) {
    ctx.err(`js-harness throughput: the gate log could not be read (${facts.unavailable['gate log']}): nothing is kept of ${day}`);
    return 1;
  }
  if (kept && !(kept.unreadable === undefined && fuller(facts, kept))) {
    ctx.err(`js-harness throughput: ${day} is already kept (${file}); a kept day is written again only by one that covers more of it`);
    return 1;
  }
  const notes = keepDay(ctx, day, facts, kept, flags['gate-log'] ?? null);
  ctx.out(`js-harness throughput: kept ${day} in ${file}${notes.length ? ` (${notes.join('; ')})` : ''}`);
  return 0;
}

/** Writes the snapshot of `day` from `facts`, replacing `kept` when there is one, and returns what to say of it. */
function keepDay(ctx, day, facts, kept, gateLogs) {
  const file = path.join(ctx.folder, `${day}.json`);
  const record = {
    schema: SNAPSHOT_SCHEMA, day, writtenAt: new Date(ctx.now()).toISOString(), from: gateLogs ?? ['the live gate log'], ...facts,
    ...(kept && { replaced: { at: kept.writtenAt ?? null, partialFrom: kept.partialFrom, partialUntil: kept.partialUntil ?? null } }),
  };
  ctx.fileSystem.mkdirSync(ctx.folder, { recursive: true });
  // Written whole beside it first and moved, so a reader never meets half a snapshot.
  const aside = `${file}.${process.pid}.tmp`;
  ctx.fileSystem.writeFileSync(aside, `${JSON.stringify(record, null, 2)}
`);
  ctx.fileSystem.renameSync(aside, file);
  return [kept && 'replaced a partial snapshot', facts.partialFrom && `partial: the gate log begins at ${facts.partialFrom}`, facts.partialUntil && `partial: the copies end at ${facts.partialUntil}, before the day settles; --copied-at <time> says when it was made`, ...Object.entries(facts.unavailable).map(([what, why]) => `${what} not read: ${why}`)].filter(Boolean);
}

/** How many settled days back the heartbeat keeps a day that has no snapshot (the rule throughput-backfill-days),
 * so a machine away for a month does not write a month at once. */
const BACKFILL_DAYS = ruleValue('throughput-backfill-days', 'days');

/** The heartbeat's tick (bin/loop.mjs): keeps each of the last `BACKFILL_DAYS` settled days that the live gate log
 * holds and has no snapshot, and says what review is due. A day the log does not reach holds no gate to keep, so it
 * is never kept empty (A8): it is added to `skip`, which the caller keeps across ticks, since the log only loses
 * days. While a gate holds the lock nothing is written, so the tick never runs beside one. Returns `{ lines, dues }`,
 * `lines` being what it kept or could not read. */
export function throughputTick({ home, cwd, slug: known, now, run, skip = new Set(), fileSystem = fs, gateHolder = (at) => readGateHolder(home, { now: () => at }) }) {
  const slug = known ?? projectSlug(mainCheckout(run, cwd));
  const ctx = { home, slug, folder: snapshotFolder(home, slug), now: () => now, fileSystem };
  const lines = [];
  const holder = gateHolder(now);
  if (!(holder && !holder.stale)) {
    const last = lastSettledDay(now, settlesAt);
    for (let back = BACKFILL_DAYS - 1; back >= 0; back -= 1) {
      const day = addDays(last, -back);
      if (skip.has(day) || readSnapshot(path.join(ctx.folder, `${day}.json`), fileSystem) !== null) continue;
      const facts = rotatingFacts(day, ctx);
      if (facts.unavailable['gate log']) {
        lines.push(`throughput: the gate log could not be read (${facts.unavailable['gate log']}), so no day is kept`);
        break;
      }
      if (facts.partialFrom && Date.parse(facts.partialFrom) >= dayBounds(day).to) {
        skip.add(day);
        continue;
      }
      const notes = keepDay(ctx, day, facts, null, null);
      lines.push(`throughput: kept ${day}${notes.length ? ` (${notes.join('; ')})` : ''}`);
    }
  }
  let dues;
  try {
    dues = throughputDues(readOutcomes(ctx), { now, settlesAt });
  } catch (err) {
    lines.push(`throughput: the outcomes could not be read (${err.code ?? err.message}), so the reviews due are not known`);
    dues = [];
  }
  return { lines, dues };
}

function status(ctx) {
  let names;
  try {
    names = ctx.fileSystem.readdirSync(ctx.folder);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    names = [];
  }
  const kept = names.filter((name) => DAY.test(name.replace(/\.json$/, '')) && name.endsWith('.json')).map((name) => name.slice(0, -5)).sort();
  const code = kept.length === 0 ? noneKept(ctx) : keptDays(ctx, kept);
  let outcomes;
  try {
    outcomes = readOutcomes(ctx);
  } catch (err) {
    ctx.out(`outcomes not read (${outcomesFile(ctx)}): ${err.code ?? err.message}, so the reviews due are not known`);
    return 1;
  }
  for (const due of throughputDues(outcomes, { now: ctx.now(), settlesAt })) ctx.out(due.line);
  return code;
}

/** No snapshot at all: a project whose heartbeat never ran, flagged rather than passed (A8). */
function noneKept(ctx) {
  ctx.out(`MISSING: no day is kept for this project (${ctx.folder}); js-harness throughput snapshot --day ${lastSettledDay(ctx.now(), settlesAt)}`);
  return 1;
}

function keptDays(ctx, kept) {
  for (const day of kept) {
    const facts = readSnapshot(path.join(ctx.folder, `${day}.json`), ctx.fileSystem);
    const notes = facts?.unreadable ? [`unreadable: ${facts.unreadable}`] : [facts.partialFrom && `partial from ${facts.partialFrom}`, facts.partialUntil && `partial until ${facts.partialUntil}`, ...Object.keys(facts.unavailable ?? {}).map((what) => `${what} not read`)].filter(Boolean);
    ctx.out(`${day}  kept${notes.length ? `  ${notes.join('; ')}` : ''}`);
  }
  // A day that has not settled cannot be kept yet, so it is not missing.
  const missing = daysBetween(kept[0], utcDay(ctx.now())).filter((day) => !kept.includes(day) && settlesAt(day) <= ctx.now());
  for (const day of missing) ctx.out(`${day}  MISSING: no snapshot (js-harness throughput snapshot --day ${day})`);
  return missing.length > 0 ? 1 : 0;
}

const outcomesFile = (ctx) => path.join(ctx.folder, 'outcomes.jsonl');

/** The text of the outcomes file, empty where it is not there; one that is there and cannot be read throws. */
function outcomesText(ctx) {
  try {
    return ctx.fileSystem.readFileSync(outcomesFile(ctx), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

/** The whole lines of the outcomes file: a torn line, or one that is no object, is left out. */
function readOutcomes(ctx) {
  return outcomesText(ctx).split(/\r?\n/).flatMap((line) => {
    try {
      const one = JSON.parse(line);
      return one && typeof one === 'object' && !Array.isArray(one) ? [one] : [];
    } catch {
      return [];
    }
  });
}

function appendOutcome(ctx, record) {
  const text = outcomesText(ctx);
  ctx.fileSystem.mkdirSync(ctx.folder, { recursive: true });
  // A line left without its newline (a writer stopped mid-line) is ended first, so the new line is whole.
  const unterminated = text !== '' && !text.endsWith('\n');
  ctx.fileSystem.appendFileSync(outcomesFile(ctx), `${unterminated ? '\n' : ''}${JSON.stringify({ v: 1, ...record, at: new Date(ctx.now()).toISOString() })}\n`, 'utf8');
}

/** The after window of a ship day: `[since, until)`, the throughput-compare-days after it. */
function afterWindow(day) {
  const since = addDays(day, 1);
  return { since, until: addDays(since, COMPARE_DAYS) };
}

function reviewed(ctx, flags) {
  const { found } = flags;
  if (flags.day !== undefined) {
    const settles = settlesAt(flags.day);
    if (settles > ctx.now()) throw new ThroughputArgError(`${flags.day} settles at ${new Date(settles).toISOString()}: a review reads settled days`);
    appendOutcome(ctx, { kind: 'reviewed', day: flags.day, found });
    ctx.out(`js-harness throughput: recorded the review of ${flags.day} (found ${found}) in ${outcomesFile(ctx)}`);
    return 0;
  }
  const { since, until } = afterWindow(flags.shipped);
  const settles = settlesAt(addDays(until, -1));
  if (settles > ctx.now()) throw new ThroughputArgError(`the re-measure of ${flags.shipped} reads ${since}..${until}, which settles at ${new Date(settles).toISOString()}`);
  appendOutcome(ctx, { kind: 'reviewed', shipped: flags.shipped, found });
  ctx.out(`js-harness throughput: recorded the re-measure of what shipped ${flags.shipped} (found ${found}) in ${outcomesFile(ctx)}`);
  return 0;
}

function shipped(ctx, flags) {
  const today = utcDay(ctx.now());
  const day = flags.day ?? today;
  if (day > today) throw new ThroughputArgError(`--day ${day} is after today (${today}): record what shipped once it has`);
  appendOutcome(ctx, { kind: 'shipped', item: flags.item, day });
  const { since, until } = afterWindow(day);
  ctx.out(`js-harness throughput: recorded that ${flags.item} shipped ${day} in ${outcomesFile(ctx)}; its re-measure falls due once ${since}..${until} has settled (${new Date(settlesAt(addDays(until, -1))).toISOString()})`);
  return 0;
}

/** The command. The seams are the folder (`cwd`), the output, the clock (`now`), `run` (spawnSync's shape, for git),
 * `homedir`, the file system and the reader of the Codex runs. */
export async function throughputMain(
  argv = [],
  env = process.env,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    now = Date.now,
    run = (command, args, options) => spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options }),
    homedir = os.homedir,
    fileSystem = fs,
    readCodexRuns = (root) => readCodexReviewRuns(root, { spawn: run }),
    readLands = (root) => readLandRecord(root, run, fileSystem),
    readReviews = (root, home, slug) => readReviewRecord(root, home, slug, run, fileSystem),
    timezoneOffset = () => new Date().getTimezoneOffset(),
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof ThroughputArgError)) throw err;
    stderr(`js-harness throughput: ${err.message}\n\n${USAGE}`);
    return 2;
  }
  const cwd = path.resolve(defaultCwd, parsed.flags.cwd ?? '.');
  const home = path.resolve(defaultCwd, parsed.flags.home ?? (env.JS_HARNESS_HOME || homedir()));
  const root = mainCheckout(run, cwd);
  const slug = projectSlug(root);
  const ctx = { root, home, slug, folder: snapshotFolder(home, slug), timezoneOffset, now, run, fileSystem, readCodexRuns, readLands, readReviews, out: stdout, err: stderr };
  try {
    if (parsed.verb === 'snapshot') return snapshot(ctx, parsed.flags);
    if (parsed.verb === 'status') return status(ctx);
    if (parsed.verb === 'reviewed') return reviewed(ctx, parsed.flags);
    if (parsed.verb === 'shipped') return shipped(ctx, parsed.flags);
    return table(ctx, parsed.flags);
  } catch (err) {
    if (!(err instanceof ThroughputArgError)) throw err;
    stderr(`js-harness throughput: ${err.message}\n\n${USAGE}`);
    return 2;
  }
}

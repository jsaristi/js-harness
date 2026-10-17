#!/usr/bin/env node
// `js-harness throughput`: the measure of the throughput review (odd/tasks/throughput-review.md, unit 1). It prints
// a fixed table over whole UTC days, each row naming its source, from each day's snapshot when there is one and from
// the live records otherwise. `snapshot` keeps the facts of a closed day under the harness home, once, so a
// before/after reads what the day was and not what a rotating log still holds; `status` names the days with none.
// The table and the status write nothing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readGateLog } from './lib/gate-log.mjs';
import { readCodexReviewRuns } from './lib/codex-review-runs.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import {
  codexFacts,
  conflictFiles,
  dayBounds,
  daysBetween,
  gateFacts,
  parseCommitTimes,
  parseMerges,
  prFacts,
  taskCounts,
  throughputRows,
  utcDay,
} from './lib/throughput.mjs';

export const SNAPSHOT_SCHEMA = 'js-harness.throughput-day/v1';

const USAGE = [
  'Usage: js-harness throughput [--since <YYYY-MM-DD>] [--until <YYYY-MM-DD>] [--json]',
  '       js-harness throughput snapshot [--day <YYYY-MM-DD>]',
  '       js-harness throughput status',
  '       (each also takes --cwd <path> and --home <path>)',
  '  The table: the UTC days [since, until), by default the day before today. Each day is read from its snapshot when',
  '    there is one, else from the live records; every row names its source, and a fact no record holds says which',
  '    recorder it waits for. It writes nothing and fetches nothing: main is origin/main as last fetched.',
  '  snapshot: keeps the facts of one closed UTC day (default yesterday) in',
  '    <home>/.js-harness/throughput/<project>/<day>.json, once: a day already kept is not written again (exit 1).',
  '  status: the days kept, each partial one with why, and each day since the first one kept that has none (exit 1).',
  '  Exit 2: a usage error, and nothing is done.',
].join('\n');

class ThroughputArgError extends Error {}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERBS = new Set(['snapshot', 'status']);
const FLAGS_OF = {
  table: ['--since', '--until', '--json', '--cwd', '--home'],
  snapshot: ['--day', '--cwd', '--home'],
  status: ['--cwd', '--home'],
};

function parseArgs(argv) {
  const verb = VERBS.has(argv[0]) ? argv[0] : 'table';
  const rest = verb === 'table' ? argv : argv.slice(1);
  const allowed = new Set(FLAGS_OF[verb]);
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!allowed.has(arg)) throw new ThroughputArgError(arg.startsWith('--') ? `${arg} is not an option of throughput${verb === 'table' ? '' : ` ${verb}`}` : `unexpected argument: ${arg}`);
    if (arg === '--json') {
      flags.json = true;
      continue;
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw new ThroughputArgError(`${arg} requires a value`);
    if (['--since', '--until', '--day'].includes(arg) && !(DAY.test(value) && utcDay(Date.parse(`${value}T00:00:00Z`)) === value)) throw new ThroughputArgError(`${arg} takes a day as YYYY-MM-DD: ${value}`);
    flags[arg.slice(2)] = value;
    i += 1;
  }
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
 * branches that conflicted. `{ prs, tasks, conflicts }`, or `{ unavailable }` with why. */
function gitFacts(run, root, { from, to }) {
  const ref = git(run, root, ['rev-parse', '--verify', '--quiet', 'origin/main']);
  if (ref.error || ref.status !== 0) return { unavailable: ref.error ?? 'origin/main is not there' };
  const since = new Date(from - 24 * 3600 * 1000).toISOString();
  const until = new Date(to).toISOString();
  const firstParent = git(run, root, ['log', '--first-parent', '--merges', `--since=${since}`, '--format=%H%x09%cI%x09%P%x09%s', 'origin/main']);
  if (firstParent.error || firstParent.status !== 0) return { unavailable: firstParent.error ?? firstLine(firstParent.stderr) };
  const merges = parseMerges(firstParent.stdout);
  const heads = merges.map((merge) => merge.head).filter(Boolean);
  const shown = heads.length ? git(run, root, ['show', '-s', '--format=%H%x09%cI', ...heads]) : { stdout: '' };
  const prs = prFacts(merges, parseCommitTimes(shown.stdout ?? ''), { from, to });

  const countAt = (ms) => {
    const commit = git(run, root, ['rev-list', '-1', '--first-parent', `--before=${new Date(ms).toISOString()}`, 'origin/main']);
    const sha = firstLine(commit.stdout);
    if (commit.error || commit.status !== 0 || sha === '') return null;
    // git grep exits 1 when nothing matches, which is a count of none.
    const boxes = git(run, root, ['grep', '-hE', '^\\s*- \\[[ xX]\\]', sha, '--', 'odd/tasks/*.md', 'docs/ROADMAP.md']);
    return boxes.error || boxes.status > 1 ? null : taskCounts(boxes.stdout);
  };
  const start = countAt(from);
  const end = countAt(to);

  const all = git(run, root, ['log', '--merges', `--since=${new Date(from).toISOString()}`, `--until=${until}`, '--format=%H%x09%cI%x09%P%x09%s', 'origin/main']);
  const conflicts = [];
  for (const line of String(all.stdout ?? '').split(/\r?\n/)) {
    const [commit, at, parents, subject] = line.split('\t');
    if (!commit || /^Merge pull request #/.test(subject ?? '') || !(Date.parse(at) >= from && Date.parse(at) < to)) continue;
    const [ours, theirs] = String(parents).split(' ');
    const tree = git(run, root, ['merge-tree', '--write-tree', '--name-only', '--no-messages', ours, theirs]);
    if (tree.status === 1) conflicts.push({ merge: commit, files: conflictFiles(tree.stdout) });
  }
  return { prs, tasks: start && end ? { start, end } : null, conflicts };
}

/** The facts of `day` read from the live records. */
function liveFacts(day, ctx) {
  const bounds = dayBounds(day);
  const facts = { day, source: 'live', partialFrom: null, gates: [], prs: [], codex: [], tasks: null, conflicts: [], unavailable: {} };
  const log = readGateLog(ctx.home, { fileSystem: ctx.fileSystem });
  if (log.unavailable) facts.unavailable['gate log'] = log.unavailable.join(', ');
  else Object.assign(facts, gateFacts(log.events, bounds));
  const fromGit = gitFacts(ctx.run, ctx.root, bounds);
  if (fromGit.unavailable) facts.unavailable.git = fromGit.unavailable;
  else Object.assign(facts, fromGit);
  try {
    facts.codex = codexFacts(ctx.readCodexRuns(ctx.root), bounds);
  } catch (err) {
    facts.unavailable.codex = err.message;
  }
  return facts;
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
  if (kept && !kept.unreadable) return kept;
  const live = liveFacts(day, ctx);
  if (kept?.unreadable) live.snapshotUnreadable = kept.unreadable;
  return live;
}

const yesterday = (now) => utcDay(now - 24 * 3600 * 1000);

function table(ctx, flags) {
  const until = flags.until ?? utcDay(ctx.now());
  const since = flags.since ?? utcDay(Date.parse(`${until}T00:00:00Z`) - 24 * 3600 * 1000);
  if (!(since < until)) throw new ThroughputArgError(`--since ${since} is not before --until ${until}`);
  const days = daysBetween(since, until).map((day) => dayFacts(day, ctx));
  const rows = throughputRows(days);
  if (flags.json) {
    ctx.out(JSON.stringify({ since, until, days: days.map(({ day, source, partialFrom, unavailable }) => ({ day, source, partialFrom, unavailable })), rows }, null, 2));
    return 0;
  }
  ctx.out(`Throughput  ${since} to ${until} (UTC, until excluded)  ${ctx.root}`);
  for (const day of days) ctx.out(`  ${day.day}  ${day.source === 'snapshot' ? 'snapshot' : 'live records'}${day.partialFrom ? `, the gate log from ${day.partialFrom}` : ''}${day.snapshotUnreadable ? ` (its snapshot is unreadable: ${day.snapshotUnreadable})` : ''}`);
  const width = Math.max(...rows.map((row) => row.label.length));
  for (const row of rows) ctx.out(`${row.label.padEnd(width)}  ${row.value}  [${row.source}]`);
  return 0;
}

function snapshot(ctx, flags) {
  const day = flags.day ?? yesterday(ctx.now());
  if (dayBounds(day).to > ctx.now()) {
    ctx.err(`js-harness throughput: ${day} is not over yet (UTC): only a closed day is kept`);
    return 2;
  }
  const file = path.join(ctx.folder, `${day}.json`);
  if (ctx.fileSystem.existsSync(file)) {
    ctx.err(`js-harness throughput: ${day} is already kept (${file}); a kept day is never written again`);
    return 1;
  }
  const { source, ...facts } = liveFacts(day, ctx);
  ctx.fileSystem.mkdirSync(ctx.folder, { recursive: true });
  // Written whole beside it first and moved, so a reader never meets half a snapshot.
  const aside = `${file}.${process.pid}.tmp`;
  ctx.fileSystem.writeFileSync(aside, `${JSON.stringify({ schema: SNAPSHOT_SCHEMA, writtenAt: new Date(ctx.now()).toISOString(), ...facts }, null, 2)}\n`);
  ctx.fileSystem.renameSync(aside, file);
  const notes = [facts.partialFrom && `partial: the gate log begins at ${facts.partialFrom}`, ...Object.entries(facts.unavailable).map(([what, why]) => `${what} not read: ${why}`)].filter(Boolean);
  ctx.out(`js-harness throughput: kept ${day} in ${file}${notes.length ? ` (${notes.join('; ')})` : ''}`);
  return 0;
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
  if (kept.length === 0) {
    ctx.out(`js-harness throughput: no day is kept for this project (${ctx.folder})`);
    return 0;
  }
  for (const day of kept) {
    const facts = readSnapshot(path.join(ctx.folder, `${day}.json`), ctx.fileSystem);
    const notes = facts?.unreadable ? [`unreadable: ${facts.unreadable}`] : [facts.partialFrom && `partial from ${facts.partialFrom}`, ...Object.keys(facts.unavailable ?? {}).map((what) => `${what} not read`)].filter(Boolean);
    ctx.out(`${day}  kept${notes.length ? `  ${notes.join('; ')}` : ''}`);
  }
  const missing = daysBetween(kept[0], utcDay(ctx.now())).filter((day) => !kept.includes(day));
  for (const day of missing) ctx.out(`${day}  MISSING: no snapshot (js-harness throughput snapshot --day ${day})`);
  return missing.length > 0 ? 1 : 0;
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
    run = spawnSync,
    homedir = os.homedir,
    fileSystem = fs,
    readCodexRuns = (root) => readCodexReviewRuns(root, { spawn: run }),
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
  const ctx = { root, home, folder: snapshotFolder(home, projectSlug(root)), now, run, fileSystem, readCodexRuns, out: stdout, err: stderr };
  try {
    if (parsed.verb === 'snapshot') return snapshot(ctx, parsed.flags);
    if (parsed.verb === 'status') return status(ctx);
    return table(ctx, parsed.flags);
  } catch (err) {
    if (!(err instanceof ThroughputArgError)) throw err;
    stderr(`js-harness throughput: ${err.message}\n\n${USAGE}`);
    return 2;
  }
}

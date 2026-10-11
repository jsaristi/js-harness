#!/usr/bin/env node
// Counts the git processes that test files start:
//
//   node scripts/count-git.mjs [--json] [--top <n>] [--frames <n>] [--root <dir>] <test file…>
//
// The test gate of this repository is some fifteen thousand git processes (15,467 on 2026-10-11, counted
// with this), and a cut in them is proven by a count (odd/tasks/gate-log.md, S3). This runs `node --test <files>` with scripts/count-git-preload.mjs in
// every Node process of the run, lets the output of the tests through as it is, and prints after it what
// the processes reported: the git processes in total, by git sub-command, by the caller (its first frame
// that is a file of this repository), and by test file. It exits with the exit code of the test run.
//
// - `--json` prints the report as JSON on stdout, alone; the output of the tests goes to stderr then.
// - `--top <n>` is how many callers the text report lists (25); the JSON always has all of them.
// - `--frames <n>` is how deep a caller is (1): with more, a helper that asks git for everybody is split by
//   who called it, `helper.mjs:10 < review.mjs:20 < review.test.mjs:30`, innermost first.
// - `--root <dir>` is the folder whose files count as callers: this repository unless said otherwise.
// The counts travel through one temporary file, removed when the test run ends, passed or failed. It stays
// behind when the tool itself is killed: no signal is handled here.
//
// The count changes what it counts in one way: a child started with an environment its caller wrote out
// is handed the counting variables too, so a test that asserts the exact environment of a child fails
// under this tool and passes without it (five of `evals/` did in the whole suite, 2026-10-11). The counts
// of such a run stand; its exit code is not the suite's.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FRAMES_VARIABLE, OUT_VARIABLE, ROOT_VARIABLE, TEST_FILE_VARIABLE, below } from './count-git-preload.mjs';

const PRELOAD = fileURLToPath(new URL('./count-git-preload.mjs', import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(PRELOAD), '..');
const USAGE = 'usage: node scripts/count-git.mjs [--json] [--top <n>] [--frames <n>] [--root <dir>] <test file…>';
const NOT_SEEN = 'not seen: the processes git starts itself (hooks, `git maintenance`), anything started by a non-Node child, '
  + 'git after the first word of a shell string, and what a Node process started when it was killed before its exit.';

/** The options and test files of the command line, or `{ error }`. */
export function parseArgs(argv) {
  const options = { json: false, top: 25, frames: 1, root: REPO_ROOT, files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--top' || arg === '--frames') options[arg.slice(2)] = Number(argv[index += 1]);
    else if (arg === '--root') options.root = argv[index += 1];
    else if (arg.startsWith('--')) return { error: `unknown option ${arg}` };
    else options.files.push(arg);
  }
  for (const name of ['top', 'frames']) {
    if (!Number.isInteger(options[name]) || options[name] < 1) return { error: `--${name} takes a whole number, 1 or more` };
  }
  if (!options.root) return { error: '--root takes a folder' };
  if (options.files.length === 0) return { error: 'no test file given' };
  return options;
}

/** The environment of the test run: `base` with the preload added to whatever NODE_OPTIONS holds, and the
 * variables the preload reads. NODE_TEST_CONTEXT goes: under it (this tool run from a test) `node --test`
 * takes itself for a test file of the run above and runs nothing. */
export function runEnv(base, { out, root, frames = 1 }) {
  const env = { ...base, [OUT_VARIABLE]: out, [ROOT_VARIABLE]: root, [FRAMES_VARIABLE]: String(frames) };
  delete env.NODE_TEST_CONTEXT;
  delete env[TEST_FILE_VARIABLE];
  const option = `--import=${pathToFileURL(PRELOAD).href}`;
  const existing = env.NODE_OPTIONS ?? '';
  env.NODE_OPTIONS = existing.includes(option) ? existing : `${existing} ${option}`.trim();
  return env;
}

/** The lines the processes wrote, and how many could not be read. */
function readCounts(file) {
  const lines = [];
  let unreadable = 0;
  for (const text of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    try {
      lines.push(JSON.parse(text));
    } catch {
      unreadable += 1;
    }
  }
  return { lines, unreadable };
}

/** The report as data, from one line per process. Every list is ordered by count, largest first, then by
 * name, so two runs of the same tree print the same order. A line of the runner (`runnerPid`) is left out:
 * its one process per test file is the run, not something the tests start. Node 24 does not load the preload
 * into the runner at all; an older one that does counts the same this way.
 * `processes.missing` is how many `node` processes were started below a test file and never reported. */
export function summarize(lines, { runnerPid = null, root = REPO_ROOT, unreadable = 0 } = {}) {
  const git = { count: 0, ms: 0, untimed: 0 };
  const other = { count: 0, shell: 0 };
  const tables = { sub: new Map(), caller: new Map(), file: new Map() };
  const counted = lines.filter((line) => line.pid !== runnerPid);
  let started = 0;
  const add = (table, name, entry) => {
    if (!table.has(name)) table.set(name, { name, count: 0, ms: 0, subcommands: {} });
    const row = table.get(name);
    row.count += entry.count;
    row.ms += entry.ms;
    row.subcommands[entry.sub] = (row.subcommands[entry.sub] ?? 0) + entry.count;
  };
  for (const line of counted) {
    other.count += line.other;
    other.shell += line.shell;
    started += line.nodes;
    const file = line.testFile ? below(root, line.testFile) ?? line.testFile : '(not known)';
    for (const entry of line.git) {
      git.count += entry.count;
      git.ms += entry.ms;
      git.untimed += entry.untimed;
      add(tables.sub, entry.sub, entry);
      add(tables.caller, entry.caller, entry);
      add(tables.file, file, entry);
    }
  }
  const byCount = (a, b) => b.count - a.count || (a.name < b.name ? -1 : 1);
  const seconds = (ms) => Math.round(ms) / 1000;
  const rows = (table) => [...table.values()].sort(byCount).map(({ name, count, ms }) => ({ name, count, seconds: seconds(ms) }));
  const ordered = (counts) => Object.fromEntries(Object.entries(counts).map(([name, count]) => ({ name, count })).sort(byCount).map((row) => [row.name, row.count]));
  return {
    git: { count: git.count, seconds: seconds(git.ms), untimed: git.untimed },
    other,
    // A test file's own process is started by the runner; every other one by a call that counted it in `nodes`.
    processes: { reported: counted.length, missing: Math.max(0, started - counted.filter((line) => line.ppid !== runnerPid).length), unreadable },
    bySubcommand: rows(tables.sub),
    byCaller: [...tables.caller.values()].sort(byCount).map((row) => ({ name: row.name, count: row.count, seconds: seconds(row.ms), subcommands: ordered(row.subcommands) })),
    byTestFile: rows(tables.file),
  };
}

/** The report as text. `top` callers are listed; the split by test file is shown with `byFile`. */
export function renderReport(summary, { top = 25, byFile = false } = {}) {
  const { git, other, processes } = summary;
  const all = git.count + other.count;
  const row = (entry, rest = '') => `${String(entry.count).padStart(8)}  ${entry.seconds.toFixed(1).padStart(8)}  ${entry.name}${rest}`;
  const out = [`git processes: ${git.count} (${git.seconds.toFixed(1)} s summed), ${all === 0 ? 0 : Math.round((100 * git.count) / all)}% of the ${all} processes started`];
  if (git.untimed > 0) out.push(`  ${git.untimed} of them not timed: still running when the process that started them exited`);
  out.push('by sub-command (count, seconds):', ...summary.bySubcommand.map((entry) => row(entry)));
  out.push(`by caller (count, seconds, caller, sub-commands), top ${Math.min(top, summary.byCaller.length)} of ${summary.byCaller.length}:`);
  out.push(...summary.byCaller.slice(0, top).map((entry) => row(entry, `  ${Object.entries(entry.subcommands).map(([name, count]) => `${name} ${count}`).join(', ')}`)));
  if (byFile && summary.byTestFile.every((entry) => entry.name === '(not known)')) {
    out.push('by test file: not known, no process of the run was started by `node --test` as a test file');
  } else if (byFile) {
    out.push('by test file (count, seconds):', ...summary.byTestFile.map((entry) => row(entry)));
  }
  out.push(`other processes: ${other.count}, ${other.shell} of them a shell string that does not begin with git`);
  const lost = [
    processes.missing > 0 ? `at least ${processes.missing} more were started and never reported (killed, or still running)` : '',
    processes.unreadable > 0 ? `${processes.unreadable} reports could not be read` : '',
  ].filter(Boolean);
  out.push(`Node processes that reported: ${processes.reported}${lost.map((text) => `; ${text}`).join('')}`);
  out.push(NOT_SEEN);
  return out.join('\n');
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.error || !fs.existsSync(options.root)) {
    console.error(`count-git: ${options.error ?? `no folder ${options.root}`}\n${USAGE}`);
    return 2;
  }
  // The real path, as Node names a module by it in a stack frame: a root behind a link would match no caller.
  const root = fs.realpathSync(options.root);
  const out = path.join(os.tmpdir(), `count-git-${process.pid}-${crypto.randomBytes(4).toString('hex')}.jsonl`);
  fs.writeFileSync(out, '', { flag: 'wx' }); // the processes only append to a file that is there
  let run;
  let counts;
  try {
    run = spawnSync(process.execPath, ['--test', ...options.files], {
      stdio: ['inherit', options.json ? 2 : 'inherit', 'inherit'],
      env: runEnv(process.env, { out, root, frames: options.frames }),
    });
    counts = readCounts(out);
  } finally {
    fs.rmSync(out, { force: true });
  }
  if (run.error) {
    console.error(`count-git: the test run did not start: ${run.error.message}`);
    return 1;
  }
  const exitCode = run.status ?? 1; // ended by a signal: no exit code, and not a pass
  const summary = summarize(counts.lines, { runnerPid: run.pid, root, unreadable: counts.unreadable });
  if (options.json) console.log(JSON.stringify({ exitCode, files: options.files, frames: options.frames, ...summary, notSeen: NOT_SEEN }, null, 2));
  else console.log(renderReport(summary, { top: options.top, byFile: options.files.length > 1 }));
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}

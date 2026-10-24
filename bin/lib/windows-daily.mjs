// The reader of the daily Windows suite (.github/workflows/windows-daily.yml; odd/tasks/commit-gates-first.md, S5
// and "R1, version 3"). The gates run on Linux, so the whole suite runs once a day on GitHub's Windows machines,
// off the land's path; this reads the newest run of it and tells the lead a red one, with the failing test names,
// once. `js-harness windows-daily` runs it by hand and the lead's `loop heartbeat` runs it every hour.
import fs from 'node:fs';
import path from 'node:path';
import { notifyMain } from '../notify.mjs';
import { NOTICE_TEXT_MAX, channelDir } from './channel.mjs';
import { GH_LOG_PREFIX, githubRepository, spawner } from './ci-gate.mjs';
import { LEDGER, failedTestFiles, failingTests, ledgerEntries, localDay } from './flaky.mjs';
import { testFilesOf } from './select-tests.mjs';

export const DAILY_WORKFLOW = 'windows-daily.yml';

/** How long after the newest run ended its schedule counts as stopped: a day and two hours. GitHub drops scheduled
 * runs under load and switches a schedule off after 60 days with no activity in the repository. */
export const STALE_MS = 26 * 3600_000;

/** The conclusions of a run that is red: a run past its `timeout-minutes` can end as either of the last two. */
const RED = ['failure', 'timed_out', 'cancelled'];

const SUMMARY = '✖ failing tests:';
const firstLine = (text) => String(text ?? '').trim().split(/\r?\n/)[0] ?? '';
const hoursOf = (ms) => Math.floor(ms / 3600_000);

/** The folder of the markers of the project `slug`: one file per run told, and the time of the last ask. */
export function dailyDir(home, slug) {
  return path.join(channelDir(home), 'windows-daily', slug);
}

/** What the newest completed run of the daily workflow on the repository's default branch says:
 * `{ state: 'skip', why }` when it cannot be read, `{ state: 'none', branch }` before any run, or
 * `{ state: 'green' | 'red', run, ageMs, names, total, files, quarantined }`. `git` and `gh` take the arguments of
 * one call and give `{ status, stdout, stderr }`; `testFiles` and `ledger` give the suite's files and the current
 * quarantine (docs/FLAKY.md of the working tree). */
export function readDaily({
  cwd,
  now = Date.now,
  git = (args) => spawner('git', process.env)(['-C', cwd, ...args]),
  gh = spawner('gh', process.env),
  testFiles = () => testFilesOf(cwd),
  ledger = () => ledgerEntries(cwd),
}) {
  const url = git(['config', '--get', 'remote.origin.url']).stdout.trim();
  const repository = githubRepository(url);
  if (!repository) return { state: 'skip', why: `origin is not a GitHub repository (${url || 'no URL'})` };
  const ask = (args) => gh([...args.slice(0, 2), '--repo', repository, ...args.slice(2)], { cwd });
  // `gh repo view` names its repository as an argument; it has no --repo flag.
  const branch = gh(['repo', 'view', repository, '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'], { cwd });
  if (branch.status !== 0) return { state: 'skip', why: `gh cannot read ${repository}: ${firstLine(branch.stderr)}` };
  const main = branch.stdout.trim();
  const list = ask(['run', 'list', '--workflow', DAILY_WORKFLOW, '--branch', main, '--status', 'completed', '--limit', '1', '--json', 'databaseId,attempt,conclusion,url,updatedAt']);
  if (list.status !== 0) {
    if (/could not find any workflows/i.test(list.stderr)) return { state: 'skip', why: `${repository} has no ${DAILY_WORKFLOW} on ${main}` };
    return { state: 'skip', why: `gh cannot read the runs of ${repository}: ${firstLine(list.stderr)}` };
  }
  let runs;
  try {
    runs = JSON.parse(list.stdout);
  } catch {
    return { state: 'skip', why: `gh answered no list of runs: ${firstLine(list.stdout)}` };
  }
  if (!Array.isArray(runs) || runs.length === 0) return { state: 'none', branch: main, repository };
  const newest = runs[0];
  const run = { id: String(newest.databaseId), attempt: newest.attempt ?? 1, conclusion: newest.conclusion, url: newest.url };
  const ageMs = now() - Date.parse(newest.updatedAt);
  if (!RED.includes(run.conclusion)) return { state: 'green', run, ageMs };
  const failed = ask(['run', 'view', run.id, '--attempt', String(run.attempt), '--log-failed']);
  // A log that cannot be read is a red run with no names: it is told all the same.
  const log = failed.status === 0 ? failed.stdout.split(/\r?\n/).map((line) => line.replace(GH_LOG_PREFIX, '')).join('\n') : '';
  const names = failingTests(log);
  const lines = log.split('\n');
  const under = lines.findIndex((line) => line.trim() === SUMMARY);
  const total = under === -1 ? names.length : lines.slice(under + 1).filter((line) => /^✖ /.test(line.trim())).length;
  const files = failedTestFiles(log, testFiles());
  // The gate counts a quarantine only after a rerun that passed; this run has none, so a red run is passed over only
  // when it names its files and each has a current entry. No file found would read as all of them quarantined.
  const today = localDay(new Date(now()));
  const current = ledger().filter((entry) => entry.expires >= today).map((entry) => entry.file);
  const quarantined = files.length > 0 && files.every((file) => current.includes(file));
  return { state: 'red', run, ageMs, names, total, files, quarantined };
}

/** What `read` (`readDaily`) tells the lead of a red run, or null: `{ key, line, text }`, `key` the marker that tells
 * it once, `line` the heartbeat's end line and `text` the notice, at most NOTICE_TEXT_MAX characters and with no clock
 * time (notify refuses a stamp that is off). */
export function tellingOf(read) {
  if (read.state === 'red' && !read.quarantined) {
    const { run } = read;
    const head = read.names.length === 0 ? `${run.url} ${run.conclusion}, names not readable` : `${run.url} ${run.conclusion}, ${read.total} failing`;
    let text = `Windows daily suite: ${head}`;
    const named = [];
    for (const name of read.names) {
      const next = `${text}${named.length === 0 ? ': ' : '; '}${name}`;
      if (next.length > NOTICE_TEXT_MAX) break;
      text = next;
      named.push(name);
    }
    return { key: `told-${run.id}-${run.attempt}`, line: `WINDOWS: ${head}${read.names.length === 0 ? '' : `: ${read.names.join('; ')}`}`, text };
  }
  return null;
}

/** What `read` tells the lead of a schedule whose newest run ended over STALE_MS ago, red or green, or null; in the
 * shape of `tellingOf`, apart from it, so a red run told before never hides a schedule that stopped. */
export function staleOf(read) {
  if ((read.state === 'red' || read.state === 'green') && read.ageMs > STALE_MS) {
    const why = `no run of ${DAILY_WORKFLOW} has ended in ${hoursOf(STALE_MS)} h: the newest, ${read.run.url}, ended ${hoursOf(read.ageMs)} h ago, so its schedule may be off`;
    return { key: `stale-${read.run.id}`, line: `WINDOWS: ${why}`, text: `Windows daily suite: ${why}` };
  }
  return null;
}

/** One line on what `read` found, for a person. */
function sayRead(read) {
  if (read.state === 'skip') return `windows-daily: ${read.why}`;
  if (read.state === 'none') return `windows-daily: no run of ${DAILY_WORKFLOW} on ${read.branch} of ${read.repository} yet`;
  const age = `ended ${hoursOf(read.ageMs)} h ago`;
  if (read.state === 'green') return `windows-daily: the newest run, ${read.run.url}, passed (${age})`;
  if (read.quarantined) return `windows-daily: the newest run, ${read.run.url}, failed (${read.run.conclusion}, ${age}) only in files quarantined in ${LEDGER}: ${read.files.join(', ')}; not told (the daily run has no rerun to judge them by)`;
  return `windows-daily: the newest run, ${read.run.url}, failed (${read.run.conclusion}, ${age}), ${read.names.length === 0 ? 'its names not readable' : `${read.total} failing: ${read.names.join('; ')}`}`;
}

/** Reads the newest run and tells the lead what `tellingOf` says, once: the marker is created with `wx` first and the
 * notice written only by the one that created it, so a hand run and the heartbeat never both tell a run. Gives
 * `{ lines, told, failed }`: what to print, the end line when it told now (or null), and why the notice could not be
 * written (or null). `notify` takes notify's arguments and gives its exit code. */
export async function windowsDaily({ home, slug, cwd, notify = (argv, out) => notifyMain(argv, { cwd, stdout: out, stderr: out }), ...options }) {
  const read = readDaily({ cwd, ...options });
  const lines = [sayRead(read)];
  const dir = dailyDir(home, slug);
  for (const telling of [tellingOf(read), staleOf(read)]) {
    if (telling === null) continue;
    const marker = path.join(dir, telling.key);
    fs.mkdirSync(dir, { recursive: true });
    try {
      fs.writeFileSync(marker, `${telling.line}\n`, { flag: 'wx' });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      lines.push(`windows-daily: told before (${marker})`);
      continue;
    }
    // The notice goes to the home of its marker, or a notice in one home would be marked told in another.
    const code = await notify(['--to', 'orchestrator', '--kind', 'note', '--home', home, telling.text], (line) => lines.push(line));
    if (code === 0) return { lines, told: telling.line, failed: null };
    // A notice not written is not told: the marker goes, so the next reading tries again.
    fs.rmSync(marker, { force: true });
    return { lines, told: telling.line, failed: `the notice to the orchestrator could not be written (notify exited ${code}); the next reading tries again` };
  }
  return { lines, told: null, failed: null };
}

/** `windowsDaily` when the last ask of the project is `everyMs` old or older, or null. The time of the last ask is kept
 * in a file, so a heartbeat that ends every half hour and is started again still asks once an interval. */
export async function windowsDailyTick({ home, slug, everyMs, now = Date.now, ...options }) {
  const file = path.join(dailyDir(home, slug), 'asked');
  let last = -Infinity;
  try {
    last = Date.parse(fs.readFileSync(file, 'utf8').trim());
  } catch {
    // never asked
  }
  if (now() - last < everyMs) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${new Date(now()).toISOString()}\n`);
  return windowsDaily({ home, slug, now, ...options });
}

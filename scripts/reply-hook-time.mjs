#!/usr/bin/env node
// Measures the reply Stop hook (`js-harness reply --hook`, bin/reply.mjs), the measure odd/tasks/reply-hook-latency.md
// asks before and after any cut:
//
//   node scripts/reply-hook-time.mjs in-situ <transcript>
//   node scripts/reply-hook-time.mjs runs --transcript <file> [--runs <n>] [--cwd <dir>] [--command <line>]...
//   node scripts/reply-hook-time.mjs profile --transcript <file> [--cwd <dir>]
//
// - `in-situ` reads what the host recorded of the hook in a Claude Code transcript: each run's time and whether it
//   timed out, by day, and the other Stop hooks that ran beside it at the same stops. A timed-out run skipped every
//   check of its stop, which is why the hook's 90th percentile is held under its timeout.
// - `runs` runs the hook `--runs` times (10) on a payload built from the transcript's newest reply of the session, its
//   cwd `--cwd` (the folder this is run from), with nothing in the background, and prints each wall time, p50 and
//   p90. `--command` is the hook's command line, run through the shell as the host runs it (this checkout's
//   `node bin/js-harness.mjs reply --hook` unless said otherwise); given more than once, the commands run in turn,
//   so a before and an after meet the same load of the machine.
// - `profile` runs each check of the hook once in this process on the same payload, with every file read, folder
//   read and git call it makes timed, so the time of a stop is said per check.
// It reads the files it is given and writes nothing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = 'reply --hook';
const USAGE = 'usage: node scripts/reply-hook-time.mjs in-situ <transcript>\n'
  + '       node scripts/reply-hook-time.mjs runs --transcript <file> [--runs <n>] [--cwd <dir>] [--command <line>]...\n'
  + '       node scripts/reply-hook-time.mjs profile --transcript <file> [--cwd <dir>]';

/** The value at the share `p` (0 to 1) of `values` by nearest rank: the smallest value with at least that share of
 * `values` at or under it, so the p90 of ten runs is the ninth; `null` for none. */
export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

/** Each line of a transcript's `text` that holds `needle`, parsed; lines that do not parse are passed over. */
function entriesWith(text, needle) {
  const entries = [];
  for (const line of text.split('\n')) {
    if (!line.includes(needle)) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // A torn line is no entry.
    }
  }
  return entries;
}

/** The runs of the reply hook the host recorded in a transcript's `text`, oldest first: `{ at, ms, timedOut }`, from
 * its `hook_success`, `hook_blocking_error` and `hook_cancelled` attachments of the `Stop` event. */
export function hookRuns(text) {
  return entriesWith(text, HOOK).flatMap((entry) => {
    const hook = entry?.attachment;
    if (entry?.type !== 'attachment' || hook?.hookEvent !== 'Stop' || !String(hook.command ?? '').includes(HOOK)) return [];
    if (typeof hook.durationMs !== 'number') return [];
    return [{ at: entry.timestamp ?? null, ms: hook.durationMs, timedOut: hook.timedOut === true }];
  });
}

/** The Stop hooks of a transcript's `text` by command, each with the times it took at every stop the host summed up
 * (`stop_hook_summary`); `aside` is, for each stop, the reply hook's time with the others'. */
export function stopHooks(text) {
  const byCommand = new Map();
  const aside = [];
  for (const entry of entriesWith(text, '"stop_hook_summary"')) {
    if (entry?.subtype !== 'stop_hook_summary' || !Array.isArray(entry.hookInfos)) continue;
    const stop = {};
    for (const hook of entry.hookInfos) {
      if (typeof hook?.durationMs !== 'number') continue;
      byCommand.set(hook.command, [...(byCommand.get(hook.command) ?? []), hook.durationMs]);
      stop[hook.command] = hook.durationMs;
    }
    aside.push(stop);
  }
  return { byCommand, aside };
}

/** The in-situ report of a transcript's `text`, as lines. */
export function inSituReport(text) {
  const runs = hookRuns(text);
  const lines = ['the reply hook, by day: runs, timed out, p50 ms, p90 ms'];
  const days = new Map();
  for (const run of runs) {
    const day = String(run.at ?? 'unknown').slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), run]);
  }
  const row = (label, group) => {
    const ms = group.map((run) => run.ms);
    lines.push(`  ${label.padEnd(10)} ${String(group.length).padStart(5)} ${String(group.filter((run) => run.timedOut).length).padStart(5)} ${String(percentile(ms, 0.5)).padStart(7)} ${String(percentile(ms, 0.9)).padStart(7)}`);
  };
  for (const [day, group] of days) row(day, group);
  if (runs.length > 0) row('all', runs);
  const { byCommand } = stopHooks(text);
  lines.push('the Stop hooks at the same stops: stops, p50 ms, p90 ms, command');
  for (const [command, ms] of byCommand) {
    lines.push(`  ${String(ms.length).padStart(5)} ${String(percentile(ms, 0.5)).padStart(7)} ${String(percentile(ms, 0.9)).padStart(7)}  ${command}`);
  }
  return lines;
}

/** A Stop payload for the session of the transcript at `file` (its `text`): its newest reply that holds text, outside
 * side chains, as the reply the hook judges, in `cwd`, with nothing in the background. */
export function stopPayload(text, file, cwd) {
  let message = null;
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0 && message === null; i -= 1) {
    if (!lines[i].includes('"type":"assistant"')) continue;
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry?.type !== 'assistant' || entry.isSidechain || !Array.isArray(entry.message?.content)) continue;
    const said = entry.message.content.filter((block) => block?.type === 'text').map((block) => block.text).join('\n');
    if (said.trim() !== '') message = said;
  }
  return {
    session_id: path.basename(file, '.jsonl'),
    transcript_path: file,
    cwd,
    hook_event_name: 'Stop',
    stop_hook_active: false,
    last_assistant_message: message ?? '',
    background_tasks: [],
    session_crons: [],
  };
}

/** Why a run of `spawnSync` failed (it did not start, exited other than 0 or was ended by a signal), or `null`. */
function failureOf(ran) {
  if (ran?.error) return ran.error.message;
  if (ran?.signal) return `signal ${ran.signal}`;
  if (ran?.status !== 0) return `exit ${ran?.status}: ${String(ran?.stderr ?? '').trim().slice(0, 200)}`;
  return null;
}

/** `n` runs of each shell command of `commands` with `input` on its standard input, taken in turn (the first's run,
 * the second's, then the first's again), so that each meets the same load of the machine: for each command, in its
 * order, `{ command, times, failures, stdout, stderr }`, the wall times in ms of the runs that succeeded, each failed
 * run's number and why (its time is no measure of the hook), and its last run's output. */
export function timeRuns(commands, input, n, { spawn = spawnSync, clock = () => performance.now() } = {}) {
  const results = commands.map((command) => ({ command, times: [], failures: [], stdout: '', stderr: '' }));
  for (let i = 0; i < n; i += 1) {
    for (const result of results) {
      const started = clock();
      const ran = spawn(result.command, { input, shell: true, encoding: 'utf8', windowsHide: true });
      const ms = clock() - started;
      const why = failureOf(ran);
      if (why === null) result.times.push(ms);
      else result.failures.push({ run: i + 1, why });
      result.stdout = String(ran?.stdout ?? '');
      result.stderr = String(ran?.stderr ?? '');
    }
  }
  return results;
}

/** Each check of the hook run once on `payload` in this process, from the modules of `repo`, in the hook's order and
 * sharing what the hook shares (its `stopIo`, its config lookup, its command-block check and that check's deadline):
 * the lines of a report, the time of loading the modules, each check's time and, under it, each read, git call, parse
 * of the record and shell parse it made; what an earlier check made is not made again. It throws where the hook
 * would check nothing. `env`, `homedir`, `now`, `platform` and `parse` are the hook's own, given to a test. */
export async function profile(payload, { repo = REPO_ROOT, env = process.env, homedir = os.homedir, now = () => Date.now(), platform = process.platform, parse = null } = {}) {
  // The command-block check's deadline counts from here, as the hook's counts from its start: setup is in it.
  const started = now();
  const lib = (name) => import(pathToFileURL(path.join(repo, 'bin', 'lib', name)).href);
  const loading = performance.now();
  const { closingState, replyConfig } = await lib('reply.mjs');
  const { shellParser } = await lib('reply-commands.mjs');
  const { commandsOf, nearestHarness, stopIo } = await import(pathToFileURL(path.join(repo, 'bin', 'reply.mjs')).href);
  const modules = { wake: await lib('stop-wake.mjs'), stale: await lib('stale-board.mjs'), back: await lib('return-report.mjs') };
  const loaded = performance.now() - loading;
  const readFile = (file) => fs.readFileSync(file).toString('utf8');
  const harness = nearestHarness(payload.cwd, readFile);
  const config = replyConfig(harness);
  if (config === null || config.error) throw new Error(`no reply check is on above ${payload.cwd}${config?.error ? ` (${config.error})` : ''}`);
  const state = closingState(payload.last_assistant_message, config);
  const calls = [];
  let current = '';
  const timed = (what, fn) => {
    const started = performance.now();
    const value = fn();
    calls.push({ check: current, what, ms: performance.now() - started });
    return value;
  };
  const stderr = (text) => process.stderr.write(text);
  const io = await stopIo({
    readFile: (file) => timed(`read ${path.basename(file)}`, () => readFile(file)),
    readdir: (dir) => timed(`list ${path.basename(dir)}`, () => fs.readdirSync(dir)),
    run: (command, args, options) => timed(`${command} ${args.join(' ')}`, () => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 2000 })),
    env,
    homedir,
    now,
    templates: harness?.templates === true,
  }, stderr);
  const readNotices = io.readNotices;
  if (readNotices) io.readNotices = (...args) => timed('the record of notices, read and parsed (once a stop)', () => readNotices(...args));
  const parser = parse ?? shellParser(platform);
  const shellParse = (...args) => timed('the shell parser', () => parser(...args));
  const checks = [
    ['wake', () => modules.wake.wakeWarning(payload, state, io)],
    ['stale', () => modules.stale.staleBoardWarning(payload, state, io, now())],
    ['return', () => modules.back.returnReportWarning(payload, state, io)],
    // Last, as in the hook, so its deadline holds the other checks' time too.
    ['commands', () => commandsOf(payload, payload.last_assistant_message, { readFile: io.readFile, platform, parse: shellParse, now, started }, stderr)],
  ];
  const lines = [`state ${state ?? 'none'}; modules loaded in ${loaded.toFixed(0)} ms; each check, then the reads and git calls it made (ms)`];
  for (const [name, run] of checks) {
    current = name;
    const started = performance.now();
    let answer;
    try {
      answer = run() === null ? 'no warning' : 'warns';
    } catch (err) {
      answer = `threw: ${err.message}`;
    }
    lines.push(`${name.padEnd(8)} ${(performance.now() - started).toFixed(0).padStart(6)}  ${answer}`);
    for (const call of calls.filter((one) => one.check === name)) lines.push(`         ${call.ms.toFixed(0).padStart(6)}  ${call.what}`);
  }
  return lines;
}

/** The options of a `runs` or `profile` command line, or `{ error }`. */
export function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (mode === 'in-situ') return rest.length === 1 ? { mode, transcript: rest[0] } : { error: USAGE };
  if (mode !== 'runs' && mode !== 'profile') return { error: USAGE };
  const options = { mode, transcript: null, runs: 10, cwd: process.cwd(), commands: [] };
  for (let i = 0; i < rest.length; i += 2) {
    const [flag, value] = [rest[i], rest[i + 1]];
    if (value === undefined) return { error: `${flag} needs a value\n${USAGE}` };
    if (flag === '--transcript') options.transcript = value;
    else if (flag === '--cwd') options.cwd = value;
    else if (flag === '--runs' && mode === 'runs' && /^[1-9]\d*$/.test(value)) options.runs = Number(value);
    else if (flag === '--command' && mode === 'runs') options.commands.push(value);
    else return { error: `unknown or bad option: ${flag} ${value}\n${USAGE}` };
  }
  return options.transcript === null ? { error: `--transcript is required\n${USAGE}` } : options;
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.error) {
    process.stderr.write(`${options.error}\n`);
    return 2;
  }
  const text = fs.readFileSync(options.transcript).toString('utf8');
  if (options.mode === 'in-situ') {
    process.stdout.write(`${inSituReport(text).join('\n')}\n`);
    return 0;
  }
  const payload = stopPayload(text, path.resolve(options.transcript), path.resolve(options.cwd));
  if (options.mode === 'profile') {
    process.stdout.write(`${(await profile(payload)).join('\n')}\n`);
    return 0;
  }
  const commands = options.commands.length > 0 ? options.commands : [`"${process.execPath}" "${path.join(REPO_ROOT, 'bin', 'js-harness.mjs')}" reply --hook`];
  let failed = false;
  for (const { command, times, failures, stdout, stderr } of timeRuns(commands, JSON.stringify(payload), options.runs)) {
    const at = (p) => (times.length === 0 ? 'none' : percentile(times, p).toFixed(0));
    process.stdout.write(`${command}\nruns ${times.map((ms) => ms.toFixed(0)).join(' ')}\n`
      + `p50 ${at(0.5)} p90 ${at(0.9)} max ${times.length === 0 ? 'none' : Math.max(...times).toFixed(0)}\n`
      + `last answer ${stdout.trim().slice(0, 160)}${stderr.trim() === '' ? '' : `\nlast stderr ${stderr.trim().slice(0, 300)}`}\n`);
    for (const { run, why } of failures) process.stdout.write(`run ${run} failed, no measure: ${why}\n`);
    failed ||= failures.length > 0;
  }
  // A run that failed measured no hook, so the times printed are not the hook's whole measure.
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}

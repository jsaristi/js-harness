#!/usr/bin/env node
// js-harness loop: run, report and stop a session's background loops, each under an owner record.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  LOOP_NAME,
  LOOP_SCHEMA,
  LockHeldError,
  killTargets,
  loopRecordPath,
  loopsFolder,
  readRecord,
  readRecords,
  removeRecordOf,
  snapshotProcesses,
  stateOf,
  survivorsOf,
  targetsOf,
  withRecordLock,
  writeRecord,
} from './lib/loops.mjs';
import { readNotices, recordPath } from './lib/channel.mjs';
import { gateLogDir } from './lib/gate-log.mjs';
import { ruleValue } from './lib/rules.mjs';
import { readStalled } from './lib/stall.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';

const USAGE = [
  'Usage: js-harness loop run <name> --purpose "<text>" --until "<end condition>" [--owner <session id>] [--restart [--take-over]] -- <command> [args]',
  '       js-harness loop status [--json]',
  '       js-harness loop stop <name> [--owner <session id>] [--take-over]',
  '       js-harness loop heartbeat [--quiet <minutes>] [--stall <minutes>] [--max <hours>] [--every <seconds>] [--windows <minutes>]',
  '       js-harness loop channel-watch [--for <minutes>] [--every <seconds>] [--owner <session id>]',
  '       (each also takes --cwd <path> and --home <path>)',
  '  run: runs the command in the foreground, its output passed through, under an owner record',
  '    (<home>/.js-harness/loops/<project>/<name>.json: the owner session, this process and the command\'s, each by pid and',
  '    creation time, the start, the purpose and the end condition); removes the record when the command ends and exits',
  '    with its code. Start it as a background task, so its end wakes the session. The owner is --owner, else',
  '    CLAUDE_CODE_SESSION_ID. A loop of that name that is alive is refused (exit 2); --restart stops it first, under',
  '    the rule of stop. A record whose processes are gone is stale and is replaced. The command js-harness runs this',
  '    copy of the dispatcher with node, so no shell or PATH lookup is needed.',
  '  status: every record of the project: name, alive or stale, owner, pid, start, purpose and end condition. Read-only.',
  '  stop: kills the loop and every process it started, by pid and creation time, then looks again and exits 0 only',
  '    when none is left, and only then removes the record (exit 1 when one survives). A live loop another session',
  '    owns is refused (exit 3) unless --take-over is given. A stale record is removed and nothing is killed.',
  '  heartbeat and channel-watch are bodies for run. heartbeat ends with one STALL line (exit 0) when neither the',
  '    gate log nor the channel record was written for --quiet minutes (30); with a STALLED line per session (exit 0)',
  '    when a work session the orchestrator handed work to (a notice to its number, or its opening) and that has not',
  '    given it back (waiting, closed or relieved) makes no commit, notice or gate for --stall minutes (the rule',
  '    session-stall when not given), and again each time that quiet doubles; one already stalled at the start is named on an',
  '    "already stalled:" line and waits for its doubling; with a WINDOWS line (exit 0) when the daily Windows run,',
  '    read every --windows minutes (60; 0 for never; js-harness windows-daily reads it by hand), is red and was not',
  '    told before; with the DUE line of a throughput review (exit 0) when it falls due and again an hour, three and',
  '    seven after, one already due at the start being named on an "already due:" line; or after --max hours (10,',
  '    exit 1). Every line that ends it is followed by the DUE lines still open. Each tick also keeps, as',
  '    js-harness throughput snapshot does, the settled days of the window the rule throughput-backfill-days gives that the gate',
  '    log holds and that have no snapshot, never while a gate holds the lock;',
  '    channel-watch ends with the first notice in the channel record written by a session other than its owner',
  '    (exit 0), or after --for minutes (30, exit 1).',
  '  Exit 2: a usage error, and nothing is done.',
].join('\n');

class LoopArgError extends Error {}

const BOOLEAN = new Set(['--restart', '--take-over', '--json']);
const VALUED = new Map([
  ['--purpose', 'purpose'],
  ['--until', 'until'],
  ['--owner', 'owner'],
  ['--cwd', 'cwd'],
  ['--home', 'home'],
  ['--quiet', 'quiet'],
  ['--stall', 'stall'],
  ['--windows', 'windows'],
  ['--max', 'max'],
  ['--every', 'every'],
  ['--for', 'for'],
]);
const FLAGS_OF = {
  run: ['--purpose', '--until', '--owner', '--cwd', '--home', '--restart', '--take-over'],
  status: ['--json', '--cwd', '--home'],
  stop: ['--owner', '--cwd', '--home', '--take-over'],
  heartbeat: ['--quiet', '--max', '--every', '--stall', '--windows', '--cwd', '--home'],
  'channel-watch': ['--for', '--every', '--owner', '--cwd', '--home'],
};

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  if (!Object.hasOwn(FLAGS_OF, verb ?? '')) throw new LoopArgError(verb === undefined ? 'a subcommand is required: run, status, stop, heartbeat or channel-watch' : `unknown subcommand: ${verb}`);
  const allowed = new Set(FLAGS_OF[verb]);
  const parsed = { verb, flags: {}, positional: [], command: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--') {
      parsed.command = rest.slice(i + 1);
      break;
    }
    if (!arg.startsWith('--')) {
      parsed.positional.push(arg);
      continue;
    }
    if (!allowed.has(arg)) throw new LoopArgError(`${arg} is not an option of loop ${verb}`);
    if (BOOLEAN.has(arg)) {
      parsed.flags[arg.slice(2)] = true;
      continue;
    }
    const value = rest[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) throw new LoopArgError(`${arg} requires a value`);
    parsed.flags[VALUED.get(arg)] = value;
    i += 1;
  }
  if (verb === 'status' || verb === 'heartbeat' || verb === 'channel-watch') {
    if (parsed.positional.length > 0) throw new LoopArgError(`unexpected argument: ${parsed.positional[0]}`);
    return parsed;
  }
  if (parsed.positional.length !== 1) throw new LoopArgError(`loop ${verb} takes one name`);
  [parsed.name] = parsed.positional;
  if (!LOOP_NAME.test(parsed.name)) throw new LoopArgError(`a loop's name is lower case letters, digits and dashes: ${parsed.name}`);
  if (parsed.flags['take-over'] && verb === 'run' && !parsed.flags.restart) throw new LoopArgError('--take-over goes with --restart');
  if (verb === 'run') {
    if (!parsed.flags.purpose) throw new LoopArgError('--purpose is required: what the loop is for');
    if (!parsed.flags.until) throw new LoopArgError('--until is required: what ends the loop');
    if (parsed.command.length === 0) throw new LoopArgError('the command goes after --');
  }
  return parsed;
}

function hourOf(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const short = (id) => (typeof id === 'string' && id !== '' ? id.slice(0, 8) : 'nobody');
const sinceOf = (record) => hourOf(Date.parse(record.startedAt));

/** `js-harness` as the command is this copy of the dispatcher, run by this node: no shell, no PATH, no shim. */
function resolveCommand(command) {
  if (command[0] !== 'js-harness') return command;
  return [process.execPath, path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs'), ...command.slice(1)];
}

/** Stops the loop of `record`, under the owner rule. Returns the exit code. */
async function stopLoop(ctx, name, file, record, snapshot, { caller, takeOver }) {
  if (stateOf(record, snapshot) === 'stale') {
    if (!removeRecordOf(file, record)) {
      ctx.err(`js-harness loop: ${name} was started again by another session meanwhile; nothing was stopped`);
      return 2;
    }
    ctx.out(`js-harness loop: ${name} was not running (pid ${record.pid}, owner ${short(record.owner)}, since ${sinceOf(record)}); its stale record removed`);
    return 0;
  }
  if (record.owner !== caller) {
    if (!takeOver) {
      ctx.err(`js-harness loop: ${name} is owned by ${short(record.owner)}, not by ${short(caller)} (pid ${record.pid}, since ${sinceOf(record)}: ${record.purpose}); nothing was stopped. Give --take-over only when that session is told and the loop is to be yours`);
      return 3;
    }
    ctx.out(`js-harness loop: taking over ${name} from ${short(record.owner)}`);
  }
  const targets = targetsOf(record, snapshot);
  try {
    ctx.kill(targets);
  } catch (err) {
    ctx.err(`js-harness loop: the kill of ${name} could not run (${err.message}); its record is kept`);
    return 1;
  }
  let left = targets.map((target) => target.pid);
  for (let look = 0; look < 10; look += 1) {
    try {
      left = survivorsOf(targets, ctx.snapshot());
    } catch (err) {
      ctx.err(`js-harness loop: the process table could not be read after the kill (${err.message}); ${name}'s record is kept`);
      return 1;
    }
    if (left.length === 0) {
      removeRecordOf(file, record);
      ctx.out(`js-harness loop: stopped ${name}: ${targets.length} process${targets.length === 1 ? '' : 'es'}, none left (looked at ${hourOf(ctx.now())})`);
      return 0;
    }
    await ctx.sleep(300);
  }
  // The record keeps what is left by pid and creation time: the runner and its command may be gone, and a record
  // that named only them would read as stale and the next stop would kill nothing.
  writeRecord(file, { ...record, survivors: targets.filter((target) => left.includes(target.pid)) });
  ctx.err(`js-harness loop: ${name} is still alive after the kill: pid ${left.join(', ')}; its record is kept with them, for the next stop`);
  return 1;
}

/** `body` under the lock of the record `file`; when the lock stays held, says so with `consequence` and gives 1. */
async function locked(ctx, file, consequence, body) {
  try {
    return await withRecordLock(file, body, { sleep: ctx.sleep });
  } catch (err) {
    if (!(err instanceof LockHeldError)) throw err;
    ctx.err(`js-harness loop: ${err.message}, so another session is deciding about this loop; ${consequence}`);
    return 1;
  }
}

/** Under the record's lock: reads the record, then the process table (a record names processes that existed
 * before it was written, so a live loop's processes are in a table taken after the read), reclaims a stale record
 * or stops a live one on --restart, and claims the name. Returns the new record, or an exit code. */
async function claimLoop(ctx, parsed, file, owner) {
  const { name, flags } = parsed;
  const existing = readRecord(file);
  if (existing.unreadable) {
    ctx.err(`js-harness loop: the record ${file} cannot be read (${existing.unreadable}); nothing started. Look at it, then remove it by hand`);
    return 1;
  }
  let snapshot;
  try {
    snapshot = ctx.snapshot();
  } catch (err) {
    ctx.err(`js-harness loop: the process table could not be read (${err.message}); nothing started`);
    return 1;
  }
  if (existing.record) {
    const record = existing.record;
    if (stateOf(record, snapshot) === 'alive') {
      if (!flags.restart) {
        ctx.err(`js-harness loop: ${name} runs, owned by ${short(record.owner)} since ${sinceOf(record)} (pid ${record.pid}: ${record.purpose}); nothing started. Stop it with js-harness loop stop ${name}, or give --restart`);
        return 2;
      }
      const stopped = await stopLoop(ctx, name, file, record, snapshot, { caller: owner, takeOver: Boolean(flags['take-over']) });
      if (stopped !== 0) return stopped;
      snapshot = ctx.snapshot();
    } else {
      if (!removeRecordOf(file, record)) {
        ctx.err(`js-harness loop: another ${name} was started meanwhile; nothing started`);
        return 2;
      }
      ctx.out(`js-harness loop: a stale record of ${name} (pid ${record.pid}, owner ${short(record.owner)}, since ${sinceOf(record)}) was cleared: its processes are gone`);
    }
  }
  const me = snapshot.find((entry) => entry.pid === ctx.pid);
  if (!me || typeof me.createdAt !== 'number') {
    ctx.err(`js-harness loop: this process (pid ${ctx.pid}) is not in the process table, so it could not be named; nothing started`);
    return 1;
  }
  const record = {
    schema: LOOP_SCHEMA,
    name,
    owner,
    pid: ctx.pid,
    createdAt: me.createdAt,
    child: null,
    startedAt: new Date(ctx.now()).toISOString(),
    purpose: flags.purpose,
    until: flags.until,
    command: parsed.command,
    cwd: ctx.cwd,
  };
  try {
    writeRecord(file, record, { exclusive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    ctx.err(`js-harness loop: another ${name} was started meanwhile; nothing started`);
    return 2;
  }
  return record;
}

async function runLoop(ctx, parsed, file) {
  const { name, flags } = parsed;
  const owner = flags.owner ?? ctx.env.CLAUDE_CODE_SESSION_ID ?? null;
  if (!owner) {
    ctx.err('js-harness loop: the owner is not known: give --owner <session id>, or run it from a session (CLAUDE_CODE_SESSION_ID); nothing started');
    return 2;
  }
  const claim = await locked(ctx, file, 'nothing started', () => claimLoop(ctx, parsed, file, owner));
  if (typeof claim === 'number') return claim;
  const record = claim;

  const [command, ...args] = resolveCommand(parsed.command);
  const child = ctx.spawn(command, args, { cwd: ctx.cwd, env: ctx.env, stdio: 'inherit', windowsHide: true });
  const ended = new Promise((resolve) => {
    child.once('error', (err) => resolve({ error: err }));
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  if (child.pid !== undefined) {
    // Until the record names the command, a stop still finds it as a descendant of this process.
    let createdAt = null;
    try {
      const entry = ctx.snapshot().find((row) => row.pid === child.pid);
      if (entry && typeof entry.createdAt === 'number') createdAt = entry.createdAt;
    } catch {
      // the command stays a descendant of this process, which the record names
    }
    const named = { ...record, child: { pid: child.pid, createdAt } };
    await locked(ctx, file, 'the record does not name the command', () => {
      if (readRecord(file).record?.pid !== ctx.pid || readRecord(file).record?.createdAt !== record.createdAt) return;
      writeRecord(file, named);
      record.child = named.child;
    });
    ctx.out(`js-harness loop: ${name} runs (pid ${ctx.pid}, command pid ${child.pid}), owned by ${short(owner)}: ${flags.purpose}; until ${flags.until}. Stop it with js-harness loop stop ${name}`);
  }
  // Through the child's handle, never by its number: Windows reuses pids (bin/lib/process-tree.mjs). What the
  // command started in turn is the stop's to find, by pid and creation time.
  const forward = (signal) => {
    try {
      child.kill(signal);
    } catch {
      // already gone
    }
  };
  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) process.on(signal, forward);
  const outcome = await ended;
  for (const signal of signals) process.off(signal, forward);
  const removed = await locked(ctx, file, 'its record is left, and reads stale', () => removeRecordOf(file, record));
  const after = removed === true ? 'its record removed' : removed === false ? 'the record is now another run\'s, left as it is' : 'its record left, stale';
  if (outcome.error) {
    ctx.err(`js-harness loop: ${name}'s command could not start (${outcome.error.message}); ${after}`);
    return 1;
  }
  const code = outcome.code ?? 1;
  ctx.out(`js-harness loop: ${name} ended (${outcome.signal ? `signal ${outcome.signal}` : `exit ${code}`}, ${hourOf(ctx.now())}); ${after}`);
  return code;
}

/** A whole number above 0 from a flag, or `fallback` when the flag was not given. */
function wholeOf(flag, value, fallback) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) === 0) throw new LoopArgError(`${flag} takes a whole number above 0: ${value}`);
  return Number(value);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The window of the board (`sessions --hours`, 12 by default): a session quiet for longer has left it, and the
// heartbeat names no session the board would not list.
const STALL_WINDOW_MS = 12 * 3600 * 1000;
const STALL_GIT_TIMEOUT_MS = 10 * 1000;

// How often the heartbeat reads the daily Windows run, in minutes: the run is daily, so an hour is soon enough, and a
// heartbeat started again reads the time of the last ask from its file (bin/lib/windows-daily.mjs).
const WINDOWS_MINUTES = 60;

/** How long `ms` is, in hours and minutes: `1h 30m`, `45m`. */
const spanOf = (ms) => {
  const minutes = Math.floor(ms / 60000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
};

/** The heartbeat's line for a stalled work session (`readStalled`): its name, since when it is quiet, what it holds. */
function stalledLine(item) {
  const name = item.title ?? `work session ${item.number}`;
  const held = item.holding.what === 'opening' ? 'its opening' : `a ${item.holding.kind ?? 'notice'} from ${item.holding.from ?? 'an unknown sender'}`;
  const text = String(item.holding.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return `STALLED: ${name} — no commit, notice or gate since ${hourOf(Date.parse(item.quietSince))}, holding ${held} of ${hourOf(Date.parse(item.holding.at))}: ${text}`;
}

/** The body of the lead's heartbeat: ends when neither the gate log nor the channel record was written for
 * `--quiet` minutes (a stall: nothing on the machine moves), when a work session that holds handed work crosses
 * `--stall` minutes with no commit, notice or gate, or after `--max` hours. One silent session among busy ones never
 * makes the machine quiet (three sat five to six hours on 2026-10-16), so the sessions are asked one by one
 * (odd/tasks/stalled-sessions.md). A session already stalled at the start is named then, and ends the loop only when
 * its quiet doubles, so a relaunch is not woken again by what it was just told. */
async function heartbeat(ctx, parsed, { home, slug }) {
  const quiet = wholeOf('--quiet', parsed.flags.quiet, 30);
  const max = wholeOf('--max', parsed.flags.max, 10);
  const every = wholeOf('--every', parsed.flags.every, 120) * 1000;
  const stallLimit = wholeOf('--stall', parsed.flags.stall, ruleValue('session-stall', 'minutes')) * 60000;
  // The daily Windows run (odd/tasks/commit-gates-first.md, S5): read every `--windows` minutes, 0 for never.
  const windows = parsed.flags.windows === undefined ? WINDOWS_MINUTES : /^\d+$/.test(parsed.flags.windows) ? Number(parsed.flags.windows) : null;
  if (windows === null) throw new LoopArgError(`--windows takes a whole number of minutes, 0 for never: ${parsed.flags.windows}`);
  // A git that hangs on a lock costs one read, never the loop: its `--max` and the other sessions' alerts.
  const boundedRun = (command, args, options) => ctx.run(command, args, { timeout: STALL_GIT_TIMEOUT_MS, ...options });
  // What could not be read is said once each, so a missing STALLED line is never read as "nobody is stalled".
  const unread = new Set();
  const stalledAt = (now) => {
    const { stalled, unavailable } = readStalled({ home, slug, now, limitMs: stallLimit, windowMs: STALL_WINDOW_MS, run: boundedRun, fileSystem: { readFileSync: (file) => ctx.readFile(file), readdirSync: ctx.readdir } });
    for (const why of unavailable) {
      if (!unread.has(why)) ctx.out(`stall detection could not read: ${why}`);
      unread.add(why);
    }
    return stalled;
  };
  // How many times the limit fits in a quiet, as a power of two: a stall is said again each time it grows.
  const crossing = (item) => Math.floor(Math.log2(item.quietMs / stallLimit));
  const identity = (item) => `${item.number}|${item.quietSince}|${item.holding.at}`;
  const told = new Map();
  // What the Windows reader found is said once each, as `unread` is; a red run told now ends the loop.
  const windowsSaid = new Set();
  const windowsTold = async () => {
    if (windows === 0) return null;
    let result;
    try {
      result = await ctx.windowsDaily({ home, slug, cwd: ctx.cwd, everyMs: windows * 60000, now: ctx.now });
    } catch (err) {
      result = { lines: [`windows-daily: could not be read (${err.message})`], told: null, failed: null };
    }
    if (result === null) return null;
    for (const line of [...result.lines, ...(result.failed ? [`windows-daily: ${result.failed}`] : [])]) {
      if (!windowsSaid.has(line)) ctx.out(line);
      windowsSaid.add(line);
    }
    return result.told;
  };
  // The throughput review (odd/tasks/throughput-review.md, S4): each tick keeps the settled days that have no
  // snapshot and reads the reviews due; a due one ends the loop when it falls due and again each time its wait,
  // plus an hour, doubles (due, +1, +3, +7 h). What the tick said is said once each, as `unread` is.
  const skipDays = new Set();
  const throughputSaid = new Set();
  const duesAt = async (now) => {
    let result;
    try {
      result = await ctx.throughputTick({ home, cwd: ctx.cwd, slug, now, run: boundedRun, skip: skipDays });
    } catch (err) {
      result = { lines: [`throughput: the tick failed (${err.message})`], dues: [] };
    }
    if (result === null) return [];
    for (const line of result.lines) {
      if (!throughputSaid.has(line)) ctx.out(line);
      throughputSaid.add(line);
    }
    return result.dues;
  };
  const dueCrossing = (due, now) => Math.floor(Math.log2(Math.max(0, now - Date.parse(due.at)) / 3600000 + 1));
  const dueTold = new Map();
  // Every line that ends the loop is followed by the reviews still due, so whatever wakes the lead names them.
  const ending = (lines, dues, code) => {
    for (const line of [...lines, ...dues.map((due) => due.line)]) ctx.out(line);
    return code;
  };
  const started = ctx.now();
  const end = started + max * 3600000;
  const gateDir = gateLogDir(home);
  const channel = recordPath(home, slug);
  const lastWrite = () => {
    const files = [channel];
    try {
      for (const entry of ctx.readdir(gateDir)) files.push(path.join(gateDir, entry));
    } catch {
      // no gate has run under this home yet
    }
    let last = started;
    for (const file of files) {
      try {
        last = Math.max(last, ctx.mtime(file));
      } catch {
        // a file that is not there was not written
      }
    }
    return last;
  };
  ctx.out(`js-harness loop heartbeat: ends when ${plural(quiet, 'minute')} pass with no write to the gate log (${gateDir}) or the channel (${channel}), or a work session holds handed work with no commit, notice or gate for ${plural(stallLimit / 60000, 'minute')}, or after ${plural(max, 'hour')}${windows === 0 ? '' : `; every ${plural(windows, 'minute')}, the daily Windows run is read, and a red one told now ends it`}; each tick keeps the settled days with no throughput snapshot, and a throughput review falling due ends it`);
  for (const item of stalledAt(started)) {
    told.set(identity(item), crossing(item));
    ctx.out(`already stalled: ${item.title ?? `work session ${item.number}`}, quiet ${spanOf(item.quietMs)}`);
  }
  for (const due of await duesAt(started)) {
    dueTold.set(due.id, dueCrossing(due, started));
    ctx.out(`already due: ${due.line.replace(/^DUE: /, '').split(':')[0]}, since ${hourOf(Date.parse(due.at))}`);
  }
  for (;;) {
    const last = lastWrite();
    const now = ctx.now();
    const dues = await duesAt(now);
    if (now - last >= quiet * 60000) return ending([`STALL: no gate-log or channel write since ${hourOf(last)}`], dues, 0);
    const fresh = stalledAt(now).filter((item) => crossing(item) > (told.get(identity(item)) ?? -1));
    if (fresh.length > 0) return ending(fresh.map(stalledLine), dues, 0);
    const windowsLine = await windowsTold();
    if (windowsLine !== null) return ending([windowsLine], dues, 0);
    if (dues.some((due) => dueCrossing(due, now) > (dueTold.get(due.id) ?? -1))) return ending([], dues, 0);
    if (now >= end) return ending([`js-harness loop heartbeat: ${plural(max, 'hour')} cap reached (${hourOf(now)})`], dues, 1);
    await ctx.sleep(Math.min(every, end - now, last + quiet * 60000 - now));
  }
}

/** The body of the lead's channel watch: ends with the first notice written after it started by a session other
 * than its owner, or after `--for` minutes. */
async function channelWatch(ctx, parsed, { home, slug }) {
  const minutes = wholeOf('--for', parsed.flags.for, 30);
  const every = wholeOf('--every', parsed.flags.every, 5) * 1000;
  const owner = parsed.flags.owner ?? ctx.env.CLAUDE_CODE_SESSION_ID ?? null;
  const started = ctx.now();
  const end = started + minutes * 60000;
  ctx.out(`js-harness loop channel-watch: ends with the first notice of a session other than ${short(owner)} in ${recordPath(home, slug)}, or after ${plural(minutes, 'minute')}`);
  let lastProblem = null;
  for (;;) {
    const record = readNotices(home, slug, { readFile: ctx.readFile });
    if (record.unavailable !== undefined) {
      if (record.unavailable !== lastProblem) ctx.err(`js-harness loop channel-watch: the channel's record ${record.path} could not be read (${record.unavailable}); read again at the next tick`);
      lastProblem = record.unavailable;
    } else {
      const found = record.notices.find((notice) => Date.parse(notice.at) >= started && (notice.from?.id ?? null) !== owner);
      if (found !== undefined) {
        const to = found.to?.role === 'orchestrator' ? 'orchestrator' : String(found.to?.number ?? 'nobody');
        ctx.out(`${found.kind} from ${found.from?.title || 'a session with no title'} to ${to}: ${found.text}`);
        return 0;
      }
    }
    const now = ctx.now();
    if (now >= end) {
      ctx.out(`js-harness loop channel-watch: no notice of another session in ${plural(minutes, 'minute')} (${hourOf(now)})`);
      return 1;
    }
    await ctx.sleep(Math.min(every, end - now));
  }
}

function status(ctx, parsed, folder) {
  const entries = readRecords(folder);
  let snapshot = null;
  let lookFailed = null;
  if (entries.length > 0) {
    try {
      snapshot = ctx.snapshot();
    } catch (err) {
      lookFailed = err.message;
    }
  }
  const rows = entries.map((entry) => {
    if (entry.unreadable) return { name: entry.name, state: 'unreadable', problem: entry.unreadable, file: entry.file };
    return { ...entry.record, state: snapshot === null ? 'unknown' : stateOf(entry.record, snapshot), file: entry.file };
  });
  if (parsed.flags.json) {
    ctx.out(JSON.stringify(rows, null, 2));
    return lookFailed ? 1 : 0;
  }
  if (rows.length === 0) ctx.out(`js-harness loop: no loop is recorded for this project (${folder})`);
  const width = Math.max(0, ...rows.map((row) => row.name.length));
  for (const row of rows) {
    if (row.state === 'unreadable') {
      ctx.out(`${row.name.padEnd(width)}  unreadable  ${row.file}: ${row.problem}`);
      continue;
    }
    ctx.out(`${row.name.padEnd(width)}  ${row.state.padEnd(5)}  ${short(row.owner)}  pid ${row.pid}  since ${sinceOf(row)}  ${row.purpose} — until ${row.until}`);
  }
  if (lookFailed) ctx.err(`js-harness loop: the process table could not be read (${lookFailed}); alive or stale is unknown`);
  return lookFailed ? 1 : 0;
}

/** The command. The seams are the folder (`cwd`), the output, the clock (`now`), the pause (`sleep`), `run`
 * (spawnSync's shape, for git), `homedir`, this process's `pid`, the process table (`snapshot`), the kill
 * (`kill`, given `[{ pid, createdAt }]`), `spawn` and `platform`. */
export async function loopMain(
  argv = [],
  env = process.env,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    run = (command, args, options) => spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options }),
    homedir = os.homedir,
    pid = process.pid,
    platform = process.platform,
    snapshot = () => snapshotProcesses({ platform }),
    kill = (targets) => killTargets(targets, { platform }),
    spawn: spawnChild = spawn,
    readdir = (dir) => fs.readdirSync(dir),
    mtime = (file) => fs.statSync(file).mtimeMs,
    readFile = (file) => fs.readFileSync(file, 'utf8'),
    // The heartbeat's reading of the daily Windows run: null when it is not due, else what it found.
    windowsDaily = async (options) => (await import('./lib/windows-daily.mjs')).windowsDailyTick(options),
    // The heartbeat's throughput tick: keeps the settled days with no snapshot, and says which review is due.
    throughputTick = async (options) => (await import('./throughput.mjs')).throughputTick(options),
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof LoopArgError)) throw err;
    stderr(`js-harness loop: ${err.message}\n\n${USAGE}`);
    return 2;
  }
  const cwd = path.resolve(defaultCwd, parsed.flags.cwd ?? '.');
  const home = path.resolve(defaultCwd, parsed.flags.home ?? (env.JS_HARNESS_HOME || homedir()));
  const slug = projectSlug(mainCheckout(run, cwd));
  const ctx = { env, cwd, out: stdout, err: stderr, now, sleep, pid, platform, snapshot, kill, spawn: spawnChild, readdir, mtime, readFile, run, windowsDaily, throughputTick };
  if (parsed.verb === 'status') return status(ctx, parsed, loopsFolder(home, slug));
  if (parsed.verb === 'heartbeat' || parsed.verb === 'channel-watch') {
    try {
      return await (parsed.verb === 'heartbeat' ? heartbeat : channelWatch)(ctx, parsed, { home, slug });
    } catch (err) {
      if (!(err instanceof LoopArgError)) throw err;
      stderr(`js-harness loop: ${err.message}\n\n${USAGE}`);
      return 2;
    }
  }
  const file = loopRecordPath(home, slug, parsed.name);
  if (parsed.verb === 'run') return runLoop(ctx, parsed, file);

  if (readRecord(file).missing) {
    stdout(`js-harness loop: no loop named ${parsed.name} is recorded for this project; nothing to stop`);
    return 0;
  }
  return locked(ctx, file, 'nothing was stopped', async () => {
    const read = readRecord(file);
    if (read.missing) {
      stdout(`js-harness loop: ${parsed.name} ended meanwhile; nothing to stop`);
      return 0;
    }
    if (read.unreadable) {
      stderr(`js-harness loop: the record ${file} cannot be read (${read.unreadable}); nothing was stopped`);
      return 1;
    }
    let table;
    try {
      table = snapshot();
    } catch (err) {
      stderr(`js-harness loop: the process table could not be read (${err.message}); nothing was stopped`);
      return 1;
    }
    const caller = parsed.flags.owner ?? env.CLAUDE_CODE_SESSION_ID ?? null;
    return stopLoop(ctx, parsed.name, file, read.record, table, { caller, takeOver: Boolean(parsed.flags['take-over']) });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = await loopMain(process.argv.slice(2));
}

#!/usr/bin/env node
// `wait`: one command a session runs in the background until its condition holds: a pull request merged (gh),
// origin/main holding a commit or a file's text (git, after a fetch), or a notice addressed to a role in the
// channel record (bin/lib/channel.mjs). It says what it waits for and when it ends, checks at once and then every
// `--every` seconds, and ends: exit 0 when the condition holds; exit 1 when the time runs out, or when the pull
// request is closed without merging; exit 2 for a usage error, with nothing checked; exit 3 when a notice to the
// waiting work session's own number comes first. Zero dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readNotices, senderOf } from './lib/channel.mjs';
import { mainCheckout, projectDirsOf, projectSlug, roleNamed, roleOfTitle } from './lib/sessions.mjs';
import { ruleValue } from './lib/rules.mjs';
import { renewOwnLease } from './permit.mjs';

/** How often a wait checks, and how long it waits, when --every and --for do not say: the declared rules
 * `wait-every` and `wait-for` (bin/lib/rules-data.mjs). */
export const WAIT_EVERY_SECONDS = ruleValue('wait-every', 'seconds');
export const WAIT_FOR_MINUTES = ruleValue('wait-for', 'minutes');

export const USAGE = [
  'Usage: js-harness wait (--pr <number> | --main-has <commit> | --main-file <path> --contains <text> | --notice-to <role or number>)',
  '                       [--every <seconds>] [--for <minutes>] [--cwd <path>] [--home <path>]',
  '  Ends when its one condition holds, and prints one line that says so (exit 0). It first prints what it waits',
  `    for and when it ends, checks at once and then every --every seconds (${WAIT_EVERY_SECONDS} when not given), and after --for`,
  `    minutes (${WAIT_FOR_MINUTES} when not given) prints that the time ran out (exit 1). A check that cannot run is said once on`,
  '    stderr and retried at the next tick. Run it in the background; stop it with TaskStop when it is no longer needed.',
  '  --pr <number>: the pull request is merged (gh). Closed without merging, it ends with exit 1, and says so.',
  '  --main-has <commit>: origin/main holds the commit, after git fetch origin.',
  '  --main-file <path> --contains <text>: the file of origin/main holds the text, after git fetch origin.',
  "  --notice-to <role>: a notice addressed to orchestrator (or ORQ), or to a work session's number, is in the channel",
  '    record and was written after the wait started; its kind, sender and text are printed.',
  '  --notice-to orchestrator (or ORQ) run by a session that holds the relay lease (js-harness permit lease): every check',
  '    renews that lease to now plus the longer of the default minutes of a lease (js-harness permit lease) and --every plus 5 minutes, so it outlasts the wait; another',
  '    session\'s lease, an expired one, or none is left as it is, and a failure to renew is said once on stderr.',
  "  Every wait run by a work session (its title's number, read from the transcript CLAUDE_CODE_SESSION_ID names) also",
  '    ends on a notice to that number written after it started (exit 3): it prints the notice and the same wait to',
  '    run again. A session with no number keeps its one condition.',
  '  --cwd <path> is the folder the checks run from (the repository); --home <path> is the harness home whose channel record',
  '    is read (JS_HARNESS_HOME, else the user\'s home).',
  '  Exit codes: 0 the condition holds; 1 the time ran out, or the pull request closed without merging; 2 a usage error, with',
  '    nothing checked; 3 a notice to this work session\'s number ended the wait.',
].join('\n');

/** A mistake in the arguments: answered with the usage and exit 2, before anything is checked. */
class WaitArgError extends Error {}

const FLAGS = new Map([
  ['--pr', 'pr'],
  ['--main-has', 'mainHas'],
  ['--main-file', 'mainFile'],
  ['--contains', 'contains'],
  ['--notice-to', 'noticeTo'],
  ['--every', 'every'],
  ['--for', 'minutes'],
  ['--cwd', 'cwd'],
  ['--home', 'home'],
]);

/** A whole number from 1 as a flag takes it, or `undefined` when the flag is not given. */
function wholeNumber(flag, value, what) {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) throw new WaitArgError(`${flag} takes ${what}, from 1`);
  return Number(value);
}

/** Walks argv flag by flag. What comes out is the settings and the one condition, `{ condition, every, minutes,
 * cwd, home }`. A flag it does not know, a flag without its value, one given twice, no condition or two of them
 * is a usage error. */
function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const key = FLAGS.get(flag);
    if (key === undefined) throw new WaitArgError(flag.startsWith('-') ? `unknown argument: ${flag}` : `unexpected argument: ${flag}`);
    if (values[key] !== undefined) throw new WaitArgError(`${flag} is given twice`);
    const value = argv[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) throw new WaitArgError(`${flag} requires a value`);
    values[key] = value;
    i += 1;
  }

  const picked = [];
  if (values.pr !== undefined) picked.push('pr');
  if (values.mainHas !== undefined) picked.push('mainHas');
  if (values.noticeTo !== undefined) picked.push('noticeTo');
  if (values.mainFile !== undefined || values.contains !== undefined) {
    if (values.mainFile === undefined) throw new WaitArgError('--contains needs --main-file <path> with it');
    if (values.contains === undefined) throw new WaitArgError('--main-file <path> needs --contains <text> with it');
    picked.push('mainFile');
  }
  if (picked.length === 0) throw new WaitArgError('a condition is required: --pr, --main-has, --main-file with --contains, or --notice-to');
  if (picked.length > 1) throw new WaitArgError(`one condition only, not ${picked.length}: give one of --pr, --main-has, --main-file with --contains, or --notice-to`);

  let condition;
  if (values.pr !== undefined) condition = { kind: 'pr', number: wholeNumber('--pr', values.pr, 'the number of a pull request') };
  else if (values.mainHas !== undefined) {
    if (values.mainHas.startsWith('-')) throw new WaitArgError('--main-has takes a commit, not an option');
    condition = { kind: 'commit', commit: values.mainHas };
  } else if (values.noticeTo !== undefined) {
    const role = roleNamed(values.noticeTo);
    if (role === null) throw new WaitArgError('--notice-to takes a role: orchestrator (or ORQ), or the number of a work session');
    condition = { kind: 'notice', role };
  } else condition = { kind: 'file', file: values.mainFile, contains: values.contains };

  return {
    condition,
    every: wholeNumber('--every', values.every, 'a number of seconds'),
    minutes: wholeNumber('--for', values.minutes, 'a number of minutes'),
    cwd: values.cwd,
    home: values.home,
  };
}

/** The local time as `HH:MM`. */
function hourOf(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The longest one check of gh or git may take. */
const CHECK_MS = 120000;

const failed = (reason) => ({ state: 'failed', reason });
const WAITING = { state: 'waiting' };

/** Why a program did not run or failed, in one line: what the system said when it could not start, else the first
 * line it wrote to stderr, else its exit status. */
function reasonOf(program, result) {
  if (result.error?.code === 'ENOENT') return `${program} is not installed or not on PATH`;
  if (result.error) return result.error.message;
  return String(result.stderr ?? '').trim().split(/\r?\n/)[0] || `${program} exited ${result.status}`;
}

/** The condition as the wait says it (`phrase`), and `check`: one look, which gives `{ state: 'waiting' }`,
 * `{ state: 'failed', reason }` (a check that cannot run, retried), `{ state: 'holds', lines }` or
 * `{ state: 'ended', line }` (the wait ends without its condition: a pull request closed without merging). */
function conditionOf(condition, { cwd, home, run, readFile, now, started }) {
  const hour = () => hourOf(now());
  // `git fetch origin` before a look at origin/main; its failure is a check that cannot run.
  const fetchOrigin = () => {
    const result = run('git', ['fetch', '-q', 'origin'], { cwd });
    return result.error || result.status !== 0 ? failed(`git fetch origin: ${reasonOf('git', result)}`) : null;
  };

  if (condition.kind === 'pr') {
    const phrase = `the merge of pull request ${condition.number}`;
    return {
      phrase,
      check: () => {
        const result = run('gh', ['pr', 'view', String(condition.number), '--json', 'state', '-q', '.state'], { cwd });
        if (result.error || result.status !== 0) return failed(reasonOf('gh', result));
        const state = String(result.stdout ?? '').trim();
        if (state === 'MERGED') return { state: 'holds', lines: [`js-harness wait: ${phrase} holds (${hour()})`] };
        if (state === 'CLOSED') return { state: 'ended', line: `js-harness wait: pull request ${condition.number} was closed without merging (${hour()}); the wait ends` };
        if (state === 'OPEN') return WAITING;
        return failed(`gh printed no known state for pull request ${condition.number}`);
      },
    };
  }

  if (condition.kind === 'commit') {
    const phrase = `commit ${condition.commit} on origin/main`;
    return {
      phrase,
      check: () => {
        const fetching = fetchOrigin();
        if (fetching !== null) return fetching;
        const result = run('git', ['merge-base', '--is-ancestor', condition.commit, 'origin/main'], { cwd });
        if (!result.error && result.status === 0) return { state: 'holds', lines: [`js-harness wait: ${phrase} holds (${hour()})`] };
        if (!result.error && result.status === 1) return WAITING;
        return failed(`git merge-base: ${reasonOf('git', result)}`);
      },
    };
  }

  if (condition.kind === 'file') {
    const phrase = `the text "${condition.contains}" in ${condition.file} on origin/main`;
    return {
      phrase,
      check: () => {
        const fetching = fetchOrigin();
        if (fetching !== null) return fetching;
        const result = run('git', ['show', `origin/main:${condition.file}`], { cwd });
        if (result.error || result.status !== 0) return failed(`git show origin/main:${condition.file}: ${reasonOf('git', result)}`);
        if (!String(result.stdout ?? '').includes(condition.contains)) return WAITING;
        return { state: 'holds', lines: [`js-harness wait: ${phrase} holds (${hour()})`] };
      },
    };
  }

  const phrase = `a notice to ${roleLabel(condition.role)}`;
  return {
    phrase,
    check: () => {
      const looked = noticeTo(condition.role, { cwd, home, run, readFile, started });
      if (looked.reason !== undefined) return failed(looked.reason);
      if (looked.line === undefined) return WAITING;
      return { state: 'holds', lines: [`js-harness wait: ${phrase} holds (${hour()})`, looked.line] };
    },
  };
}

/** A role as the wait names it: `orchestrator`, or a work session's number. */
const roleLabel = (role) => (role.role === 'orchestrator' ? 'orchestrator' : String(role.number));

/** One look in the channel record for a notice to `role` written since `started`: `{ line }`, its kind, sender and
 * text as the wait prints them; `{}` when there is none; `{ reason }` when the record exists and cannot be read. */
function noticeTo(role, { cwd, home, run, readFile, started }) {
  // The record of the project the folder is in, as `notify` names it: the same slug and home.
  const record = readNotices(home, projectSlug(mainCheckout(run, cwd)), { readFile });
  if (record.unavailable !== undefined) return { reason: `the channel's record ${record.path} could not be read (${record.unavailable})` };
  const found = record.notices.find(
    (notice) => notice.to.role === role.role && (notice.to.number ?? null) === role.number && Date.parse(notice.at) >= started,
  );
  if (found === undefined) return {};
  return { line: `${found.kind} from ${found.from?.title || 'a session with no title'}: ${found.text}` };
}

/** The number of the work session that waits, or `null` (odd/tasks/session-channel.md, T20b): read as `notify`
 * reads its sender (`senderOf`), from the title of the transcript CLAUDE_CODE_SESSION_ID names. A session with no
 * id, a transcript with no title (a phone session's), the orchestrator and a title of no agreed shape have none. */
function ownNumber({ env, cwd, run, readdir, readFile, homedir, defaultCwd }) {
  if (!env.CLAUDE_CODE_SESSION_ID) return null;
  try {
    const claudeHome = path.resolve(defaultCwd, env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'));
    // A session opened in a worktree is filed under that worktree's sessions folder, not the main checkout's.
    const projectDirs = projectDirsOf(run, mainCheckout(run, cwd), claudeHome);
    const role = roleOfTitle(senderOf({ env, projectDirs, readdir, readFile }).title);
    return role?.role === 'work' ? role.number : null;
  } catch {
    // A session whose number cannot be read keeps the wait it had, as one with none does.
    return null;
  }
}

/** `argv` as one line a POSIX shell reads back into the same words: a word with anything but letters, digits and
 * `_ . / : @ % + = , -` is put in single quotes. */
function shellLine(argv) {
  return argv.map((word) => (/^[\w./:@%+=,-]+$/.test(word) ? word : `'${word.replace(/'/g, "'\\''")}'`)).join(' ');
}

/** The wait itself. `env` gives the harness home when `--home` is not given, as `notify` reads it. The seams are
 * the folder (`cwd`), the output (`stdout`, `stderr`), the clock (`now`, in milliseconds), the pause (`sleep`),
 * `run` (`spawnSync`'s shape, for git and gh), `readFile` (the channel record) and `homedir`. */
export async function waitMain(
  argv = [],
  env = process.env,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    run = (command, args, options) => spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: CHECK_MS, maxBuffer: 64 * 1024 * 1024, ...options }),
    readFile = (file) => fs.readFileSync(file, 'utf8'),
    readdir = (dir) => fs.readdirSync(dir),
    homedir = os.homedir,
    renew = renewOwnLease,
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof WaitArgError)) throw err;
    stderr(`js-harness wait: ${err.message}\n\n${USAGE}`);
    return 2;
  }

  const cwd = path.resolve(defaultCwd, parsed.cwd ?? '.');
  const home = path.resolve(defaultCwd, parsed.home ?? (env.JS_HARNESS_HOME || homedir()));
  const seconds = parsed.every ?? WAIT_EVERY_SECONDS;
  const minutes = parsed.minutes ?? WAIT_FOR_MINUTES;
  const started = now();
  const deadline = started + minutes * 60000;
  // A hung gh or git must not hold the wait past its deadline: each check gets the time left, at least a second.
  const bounded = (command, args, options = {}) =>
    run(command, args, { ...options, timeout: Math.max(1000, Math.min(CHECK_MS, deadline - now())) });
  const { phrase, check } = conditionOf(parsed.condition, { cwd, home, run: bounded, readFile, now, started });
  // The notices to the session's own number end every wait, but one that already waits for them.
  const number = ownNumber({ env, cwd, run: bounded, readdir, readFile, homedir, defaultCwd });
  const own = number === null ? null : { role: 'work', number };
  const watched = own !== null && !(parsed.condition.kind === 'notice' && parsed.condition.role.role === 'work' && parsed.condition.role.number === number);
  const ends = watched ? `ends when it holds, on a notice to ${number}, or after ${minutes} minutes` : `ends when it holds, or after ${minutes} minutes`;

  // A notice wait for the orchestrator renews the relay lease its session holds, on every check (odd/tasks/harness-review.md,
  // T3, S5a), so the lease outlasts the wait. The opening line says so only when the first renewal holds the lease.
  const leaseSession = parsed.condition.kind === 'notice' && parsed.condition.role.role === 'orchestrator' ? env.CLAUDE_CODE_SESSION_ID : undefined;
  let leaseRoot = null;
  let lastLeaseReason = null;
  const renewLease = () => {
    try {
      leaseRoot ??= mainCheckout(bounded, cwd);
      return renew({ home, cwd, session: leaseSession, now: new Date(now()), everySeconds: seconds, projectRoot: () => leaseRoot }).renewed;
    } catch (err) {
      if (err.message !== lastLeaseReason) {
        lastLeaseReason = err.message;
        stderr(`js-harness wait: the relay lease is not renewed (${err.message}); it is tried again at the next tick`);
      }
      return false;
    }
  };
  const renews = leaseSession !== undefined && leaseSession !== '' && renewLease();
  stdout(`js-harness wait: waits for ${phrase}; ${ends}${renews ? '; renews the relay lease while it waits' : ''}; stop it with TaskStop when it is no longer needed`);

  let lastReason = null;
  let lastWatchReason = null;
  for (;;) {
    if (leaseSession !== undefined && leaseSession !== '') renewLease();
    if (watched) {
      let looked;
      try {
        looked = noticeTo(own, { cwd, home, run: bounded, readFile, started });
      } catch (err) {
        looked = { reason: err.message };
      }
      if (looked.line !== undefined) {
        stdout(`js-harness wait: a notice to ${number} came before ${phrase} held (${hourOf(now())}); the wait ends`);
        stdout(looked.line);
        stdout(`js-harness wait: to wait again, run: js-harness wait ${shellLine(argv)}`);
        return 3;
      }
      if (looked.reason !== undefined && looked.reason !== lastWatchReason) {
        stderr(`js-harness wait: the notices to ${number} are not watched now: ${looked.reason}; it is read again at the next tick`);
      }
      lastWatchReason = looked.reason ?? null;
    }
    let outcome;
    try {
      outcome = check();
    } catch (err) {
      outcome = failed(err.message);
    }
    if (outcome.state === 'holds') {
      for (const line of outcome.lines) stdout(line);
      return 0;
    }
    if (outcome.state === 'ended') {
      stdout(outcome.line);
      return 1;
    }
    if (outcome.state === 'failed' && outcome.reason !== lastReason) {
      lastReason = outcome.reason;
      stderr(`js-harness wait: a check did not run (${outcome.reason}); it is retried at the next tick`);
    }
    const left = deadline - now();
    if (left <= 0) {
      stdout(`js-harness wait: ${phrase} did not hold after ${minutes} minutes; the time ran out (${hourOf(now())})`);
      return 1;
    }
    await sleep(Math.min(seconds * 1000, left));
  }
}

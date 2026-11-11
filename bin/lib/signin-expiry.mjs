// When the claude.ai sign-in stored on the machine ends (odd/tasks/signin-expiry-notice.md). The stored sign-in has
// an end date, and when it passes everything that works alone fails at once until the user signs in again: the
// background sessions, the lens reviews, the remote server a phone uses. From Claude Code 2.1.318 `claude auth status`
// prints that date (`loginExpiresAt`), and this module is the one place the harness reads it: `doctor` lists it as the
// `claude-signin` row, a gap from a margin before the end.
//
// It runs `claude auth status` and keeps two things of its answer, the end date and whether a claude.ai sign-in is
// stored. The same answer names the account (an e-mail, an organisation, a plan), and none of that leaves
// `signinReading`. It reads no credential file, no token and no keychain, and it never signs in, signs out or
// refreshes anything: the fix it names is the user's to run. One reading took 4.4 to 6.0 s on 2026-11-11, with the
// same answer while the network was closed, so only the interactive `doctor` makes one, never the session-start hook.
import os from 'node:os';
import { sameFolder } from './backup.mjs';
import { localMinute, localZone } from './local-time.mjs';
import { probeTimedOut, spawnProbeOrThrow } from './stack.mjs';

/** How many days before the end the row becomes a gap. A CHOSEN number: the question the
 * user was asked proposed a week (question 258 of the channel record, 2026-11-11), long enough to hold a day at the
 * machine and short enough that the row is quiet for most of a sign-in's life. The CLI's own warning starts 10 days
 * before, on `claude -p` text output, which the harness never reads (it asks for JSON). */
export const SIGNIN_WARN_DAYS = 7;

/** The time limit of one reading. The probes' 5 s (`PROBE_TIMEOUT_MS`, stack.mjs) would cut a normal one: the slowest
 * of four on 2026-11-11 took 6.0 s, on a machine running six sessions. */
export const SIGNIN_READ_TIMEOUT_MS = 20000;

export const SIGNIN_FIX =
  'sign in again while you are at the machine: once the stored sign-in ends, every background session, lens review and remote server fails at once until you do (the harness never signs in for you):';
const SIGNIN_COMMAND = 'claude auth login';

const SUBJECT = 'the claude.ai sign-in stored on this machine';
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const MINUTE_MS = 60000;
// An `authMethod` is named in a reason only when it reads as a method's name, never as free text.
const METHOD = /^[A-Za-z][\w.-]{0,39}$/;

const unread = (why, stored = null) => ({ expiresAt: null, stored, why });

/** What one answer of `claude auth status` says, from the result of its spawn (`spawnSync`'s shape, or `null` when it
 * could not be started): `{ expiresAt, stored, why }`. `expiresAt` is the end date as an ISO time, or `null` with
 * `why` saying what kept it from being read: a CLI that could not be started or did not answer in time, an answer
 * that is no JSON object, a CLI that is not signed in or is signed in another way, one that prints no date (older
 * than 2.1.318) or one that is no date. `stored` is whether a claude.ai sign-in is stored, `null` when the answer
 * does not say. The exit code is not asked first: the answer is read whatever it is. Never throws. */
export function signinReading(result) {
  if (!result) return unread('the claude command could not be started');
  // A timed-out child may carry an ETIMEDOUT error too, so the timeout is told before the error.
  if (probeTimedOut(result)) return unread(`claude auth status did not answer in ${SIGNIN_READ_TIMEOUT_MS / 1000} seconds`);
  if (result.error) return unread('the claude command could not be started');
  let answer;
  try {
    answer = JSON.parse(String(result.stdout ?? ''));
  } catch {
    answer = null;
  }
  if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) {
    // Through a shell, as on Windows, a command that is not there is an exit code and no error.
    return unread(result.status === 0
      ? 'claude auth status answered no JSON object: the Claude CLI may be older than its JSON answer'
      : `claude auth status ended with exit ${result.status ?? 'without a code'} and no JSON: the Claude CLI is not on the path, or does not know the command`);
  }
  if (answer.loggedIn === false) return unread('the Claude CLI says it is not signed in', false);
  if (answer.storedClaudeAiLogin === false) {
    const method = typeof answer.authMethod === 'string' && METHOD.test(answer.authMethod) ? ` (it is signed in by ${answer.authMethod})` : '';
    return unread(`the Claude CLI holds no stored claude.ai sign-in${method}`, false);
  }
  const stored = answer.storedClaudeAiLogin === true ? true : null;
  const printed = answer.loginExpiresAt;
  if (printed === undefined || printed === null) {
    return unread('claude auth status prints no loginExpiresAt, which Claude Code prints from 2.1.318 on for a stored claude.ai sign-in: the Claude CLI is older, or signed in another way', stored);
  }
  const at = typeof printed === 'string' && printed !== '' ? Date.parse(printed) : NaN;
  if (Number.isNaN(at)) return unread('claude auth status prints a loginExpiresAt that is not a date', stored);
  return { expiresAt: new Date(at).toISOString(), stored, why: null };
}

/** One reading: runs `claude auth status`, with empty standard input and its own time limit, and returns what
 * `signinReading` makes of it. `spawn` and `platform` are the probes' seams (`spawnProbeOrThrow`). The CLI answers
 * for the user's own home whatever home the harness was given, so with a `home` that is not that one (`homedir`) it
 * is not run and the reading says so, `asked: false`: a fixture home never reads the real sign-in, as it never reads
 * the real Codex home (`codexHomeOf`, stack.mjs). Never throws. */
export function readSigninExpiry({ spawn, platform, home, homedir = os.homedir } = {}) {
  if (home !== undefined && !sameFolder(home, homedir())) return { ...unread(null), asked: false };
  let result;
  try {
    result = spawnProbeOrThrow('claude', ['auth', 'status'], { spawn, platform, input: '', timeout: SIGNIN_READ_TIMEOUT_MS }) ?? null;
  } catch {
    result = null;
  }
  return signinReading(result);
}

const counted = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** How long `ms` is in its largest whole unit: days, then hours, then minutes. */
function spanOf(ms) {
  if (ms >= DAY_MS) return counted(Math.floor(ms / DAY_MS), 'day');
  if (ms >= HOUR_MS) return counted(Math.floor(ms / HOUR_MS), 'hour');
  if (ms >= MINUTE_MS) return counted(Math.floor(ms / MINUTE_MS), 'minute');
  return 'less than a minute';
}

/** Where `now` (ms) stands against a reading's end date, or `null` when it holds none: the time left in ms, whether
 * the margin is reached and whether the end has passed, and the words the row says, with the local date and its
 * zone (rule:local-time). */
function leftOf(reading, now) {
  const at = typeof reading?.expiresAt === 'string' ? Date.parse(reading.expiresAt) : NaN;
  if (Number.isNaN(at)) return null;
  const ms = at - now;
  const when = `${localMinute(at)} (${localZone(at)})`;
  const ended = ms <= 0;
  return { ms, ended, inside: ms <= SIGNIN_WARN_DAYS * DAY_MS, words: ended ? `${SUBJECT} ended on ${when}` : `${SUBJECT} ends in ${spanOf(ms)}, on ${when}` };
}

const whyOf = (reading) => reading?.why ?? 'the reader gave nothing';

/** The `claude-signin` row of `doctor`, from a reading and the clock (`now`, ms): nothing to install, and the
 * `claude` cell carries the state. `ok` with more than the margin left; `stale`, a gap, from the margin on and past
 * the end, its fix saying who signs in and with what; `unknown`, no gap, when the date cannot be read. `note` is
 * what `doctor` prints under its table: the time left and the local end date, or why there is none. `expiresAt` and
 * `daysLeft` (whole days, below 0 past the end) are for `--json`. */
export function signinRow(reading, now) {
  const row = { id: 'claude-signin', version: null, installed: 'n/a', claude: 'unknown', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} };
  if (reading?.asked === false) return { ...row, claude: 'n/a' };
  const left = leftOf(reading, now);
  if (left === null) return { ...row, note: `when ${SUBJECT} ends cannot be read: ${whyOf(reading)}` };
  return {
    ...row,
    claude: left.inside ? 'stale' : 'ok',
    expiresAt: reading.expiresAt,
    daysLeft: Math.floor(left.ms / DAY_MS),
    note: left.words,
    fix: left.inside ? { claude: [SIGNIN_FIX, SIGNIN_COMMAND] } : {},
  };
}

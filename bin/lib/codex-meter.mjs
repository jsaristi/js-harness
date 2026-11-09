// What `js-harness codex-meter` reads: Codex's five-hour and weekly limits and its reset credits left, from the
// local `codex app-server`. The server answers the read without running a model, so the read spends no tokens;
// what it costs is one process, started for the read and killed after it. Zero deps, plain Node.
//
// Why the server and not the session files. `codex-usage.mjs` reads the rollout files, and the rate limits in
// them are `null` in the sessions this repository ran (its fixtures hold `rate_limits: { primary: null, ... }`).
// The limits the Codex app shows are the server's, so this reader asks the server.
//
// The protocol, as codex-cli 0.163.0 speaks it (read once from the real server, with its numbers and no
// identifier kept): one JSON object per line on stdin and on stdout, and no `jsonrpc` field. A client sends
// `initialize` (a request: it has an id), then the `initialized` notification (no id), then
// `account/rateLimits/read` (a request). The server answers a request with `{ id, result }` or `{ id, error }`,
// and writes notifications of its own (such as `account/updated`) before or between the answers. Those, and any
// line that is not JSON, are skipped: the answer is the line whose id is the request's.
//
// The fields of the answer that matter (`parseRateLimits`): `rateLimits.primary` is the five-hour window and
// `rateLimits.secondary` the weekly one (10,080 minutes), each with `usedPercent` and `resetsAt` (Unix seconds);
// `rateLimitResetCredits.availableCount` is the reset credits left. Every field may be missing from an answer, so
// a missing one is `null` (unknown) and never an error: the server may change its shape, and the reader says so.
//
// The launch is `launchCodex` of `./codex-launch.mjs`, the one `codex-review` uses too: on Windows `codex` is a `.cmd` shim that only a shell
// starts, so the line goes through `cmd.exe`; elsewhere it runs directly. The child leads its own process group
// off Windows, so the tree is killed on every outcome (`killTree`, the same kill the review uses), since on
// Windows the process that holds the pipe is the one the shim started, not the shim.
import { spawn as spawnChild } from 'node:child_process';
import { killTree } from './process-tree.mjs';
import { launchCodex } from './codex-launch.mjs';
import { nextLine, noStep, reviewCommand } from './next-step.mjs';

/** How long the server may take to answer the read, in ms. The app-server starts cold for each read: the one real
 * read of codex-cli 0.163.0 took about 10.6 s from start to exit on Windows 10, of which the tree kill took about
 * 3.5 s (measured on a dummy process), so the answer itself took most of 6 to 7 s. An 8 s limit would have left
 * little room on a slower day, hence 15 s. Past it the process is killed and the read fails with `timeout`. */
export const METER_TIMEOUT_MS = 15000;

const INITIALIZE_ID = 1;
const READ_ID = 2;
const READ_METHOD = 'account/rateLimits/read';
const SIGNALS = ['SIGINT', 'SIGTERM'];
const CLIENT_INFO = { name: 'js-harness', version: 'codex-meter' };

// Codex says a command it cannot find in this shell in these words; a shell launch that fails that way is missing.
const NOT_FOUND = /not recognized|not found|cannot find/i;

/** Starts `codex app-server` through `spawn` and the one Codex launcher (`./codex-launch.mjs`). */
function launch(spawn, platform) {
  return launchCodex(spawn, platform, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: platform !== 'win32' });
}

// The length of the weekly window, in minutes, as the server writes it in `windowDurationMins`.
const WEEK_MINUTES = 10080;

// How a skip made at the floor of the weekly limit starts its reason, so the meter can list it after its branch merged.
export const FLOOR_SKIP = 'weekly limit at its floor';

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** A window as `{ usedPercent, resetsAt }`, each `null` when the answer does not hold it. */
const windowOf = (value) => ({ usedPercent: finite(value?.usedPercent), resetsAt: finite(value?.resetsAt) });

/** The numbers of an answer to the read: `fiveHour` (`rateLimits.primary`), `weekly` (`rateLimits.secondary`) and
 * `resetCredits` (`rateLimitResetCredits.availableCount`). Anything else in the answer is dropped here, the
 * account identifier among it, so no caller can print one by accident. */
export function parseRateLimits(result) {
  const limits = result?.rateLimits;
  // The weekly window is the one whose length says a week, wherever the answer puts it; `secondary` when none says.
  const weekly = [limits?.primary, limits?.secondary].find((window) => window?.windowDurationMins === WEEK_MINUTES) ?? limits?.secondary;
  return {
    fiveHour: windowOf(weekly === limits?.primary ? limits?.secondary : limits?.primary),
    weekly: windowOf(weekly),
    resetCredits: finite(result?.rateLimitResetCredits?.availableCount),
  };
}

/** A Unix time in seconds as the host's local `YYYY-MM-DD HH:MM`: the reset a person reads, not a UTC instant. */
function localClock(seconds) {
  const date = new Date(seconds * 1000);
  const two = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** One window's line, `five-hour: 3% used, resets at <local time>`; a value the answer lacks reads `unknown`. */
function windowLine(label, window) {
  if (window.usedPercent === null && window.resetsAt === null) return `${label}: unknown`;
  const used = window.usedPercent === null ? 'unknown' : `${window.usedPercent}% used`;
  const resets = window.resetsAt === null ? 'unknown' : localClock(window.resetsAt);
  return `${label}: ${used}, resets at ${resets}`;
}

/** The human form of a parsed reading: one line per window, then the reset credits left. */
export function humanLines(reading) {
  return [
    windowLine('five-hour', reading.fiveHour),
    windowLine('weekly', reading.weekly),
    `reset credits left: ${reading.resetCredits ?? 'unknown'}`,
  ];
}

/** The one line that says why a read failed, from an outcome of `readRateLimits` that is not ok. */
export function failureLine(outcome) {
  switch (outcome.reason) {
    case 'missing':
      return 'codex is not on PATH: install the Codex CLI, then run this again.';
    case 'timeout':
      return `codex app-server did not answer within ${Math.round(outcome.timeoutMs / 1000)} seconds, so it was stopped.`;
    case 'error':
      return `codex app-server answered with an error (code ${outcome.code ?? '?'}).`;
    case 'interrupted':
      return 'the read was interrupted, and codex app-server was stopped.';
    case 'exited':
      return `codex app-server exited before it answered (exit ${outcome.code ?? '?'}).`;
    default:
      return `codex app-server could not be started: ${outcome.detail ?? 'unknown error'}.`;
  }
}

/** What the weekly limit says of a review about to launch, from an outcome of `readRateLimits` and `floor`, the percent
 * of the weekly limit that must be left (rule:codex-weekly-floor): `{ stop: true, left }` at or under it, `{ stop:
 * false, left }` above it, and `{ stop: false, unread }` with why when the read failed or its answer held no weekly
 * limit, since a reading that is not there stops nothing (odd/tasks/double-review-alignment.md, T2). A read the person
 * interrupted is `{ stop: true, interrupted: true }`: the Ctrl-C was meant for the command, not for the read alone. */
export function weeklyFloor(outcome, floor) {
  if (!outcome.ok && outcome.reason === 'interrupted') return { stop: true, interrupted: true };
  if (!outcome.ok) return { stop: false, unread: failureLine(outcome) };
  const used = parseRateLimits(outcome.result).weekly.usedPercent;
  if (used === null) return { stop: false, unread: 'its answer held no weekly limit.' };
  const left = Math.max(0, 100 - used);
  return { stop: left <= floor, left };
}

/** Why a review was not started at the floor of the weekly limit, and what each answer of the user's runs: a reset
 * credit is spent only on the user's word, and on a typed no a second Claude review takes Codex's place and the skip
 * stays a Codex debt until a Codex review pays it. `part`, `{ index, of }`, names a later part of a review in parts,
 * whose earlier parts are kept for the next run; `interrupted` is a read the person interrupted. `read` is the double
 * review's read of a plan (bin/double-review.mjs), whose two readers start together, instead of a review of code. */
export function floorStopped({ left, floor, base, at, part = null, interrupted = false, read = false }) {
  const what = read ? 'neither reader was started'
    : part === null || part.index === 1 ? 'the review was not started' : `part ${part.index} of ${part.of} was not started, the parts before it kept for the next run,`;
  if (interrupted) return `The read of Codex's weekly limit was interrupted, so ${what} and nothing was recorded.`;
  // The commands for the user's no name the base and the head the review would have run at, as hashes (`reviewCommand`).
  const onNo = read
    ? "On the user's typed no, the read waits for the reset, or `js-harness double-review skip` records the user's words that skip it."
    : `On the user's typed no, record the skip with \`${reviewCommand('codex-review', { base, at, flags: [`--unavailable "${FLOOR_SKIP}: <the user's words>"`] })}\`, ` +
      `and run a second Claude review in Codex's place, \`${reviewCommand('lens-review', { base, at, lenses: '<the lenses not run yet>' })}\`. ` +
      'The skip is a Codex debt that codex-meter lists on every branch, and the merge door shows, until a Codex review of its range pays it.';
  return (
    `Codex's weekly limit has ${Math.round(left * 10) / 10}% left, at or under its floor of ${floor}% (rule:codex-weekly-floor), so ${what} and nothing was recorded.\n` +
    "Ask the user, through the lead where one leads, whether to reset the weekly limit: a reset credit is spent only on the user's word, and after a reset this runs again.\n" +
    `${onNo}\n` +
    nextLine(noStep('the user decides whether to reset the weekly limit, and no command follows until the user answers'))
  );
}

/** What a launch of `codex-review` does by the weekly limit, from an outcome of `readRateLimits`: `note`, the line
 * that says a reading is not there and the review runs, or `null`; `stop`, why nothing is launched, or `null`. */
export function launchWord(outcome, { floor, base, at, part = null, read = false }) {
  const weekly = weeklyFloor(outcome, floor);
  return {
    note: weekly.unread === undefined ? null : `Codex's weekly limit could not be read before the launch: ${weekly.unread} The ${read ? 'read' : 'review'} runs without it.`,
    stop: weekly.stop ? floorStopped({ ...weekly, floor, base, at, part, read }) : null,
  };
}

/** The skips among `records` made at the floor of the weekly limit (their reason starts `FLOOR_SKIP`) that `owedOf(rec)`
 * says no Codex review has paid, each as `lineOf(rec)` with the command that pays it: a review of its range from a
 * worktree at its head, since a review reads up to HEAD and the branch may have merged. A record with no commit ids is
 * left out, and one whose debt `owedOf` cannot tell (it throws) is listed, so neither hides the others. */
export function floorDebtLines(records, owedOf, lineOf) {
  const owed = (rec) => {
    try {
      return owedOf(rec);
    } catch {
      return true;
    }
  };
  return records
    .filter((rec) => rec.outcome === 'unavailable' && typeof rec.reason === 'string' && rec.reason.startsWith(FLOOR_SKIP))
    .filter((rec) => typeof rec.base === 'string' && typeof rec.head === 'string' && owed(rec))
    .map((rec) => `${lineOf(rec)}; a Codex review pays it: git worktree add --detach <folder> ${rec.head.slice(0, 7)} && js-harness codex-review --base ${rec.base.slice(0, 7)} --again --cwd <folder>`);
}

/** Starts `codex app-server`, asks it for the limits and resolves with the outcome, never rejects:
 *  - `{ ok: true, result }`: the answer's `result`, as the server gave it (see `parseRateLimits`);
 *  - `{ ok: false, reason }` with `reason` one of `missing` (no `codex` to start), `timeout` (no answer within
 *    `timeoutMs`, with `timeoutMs` given back), `error` (the server answered with an error, its `code` given),
 *    `exited` (the process ended before it answered, its `code` given), `interrupted` (SIGINT or SIGTERM reached
 *    this process first), or `failed` (it could not be started, with `detail`).
 * The process is killed on every outcome, once, with `kill(child, { startedAt, exitedAt })`; a kill that throws is
 * given back as `killError`, and the read's own outcome stands; either way the child's pipes are destroyed and it is
 * unref-ed, so a child the kill missed cannot hold this process open. The three requests go out in the order the
 * protocol needs: `initialize`, then `initialized`, then the read, which waits for the handshake's answer.
 * The server leads its own process group off Windows, so a Ctrl-C of this command would not reach it: while the read
 * runs, SIGINT and SIGTERM end it as `interrupted` and stop the server, and the handlers go when the read ends.
 * `spawn`, `kill`, `platform`, `timeoutMs`, `now` and `signals` (the process) are injectable, so the tests run no
 * server and send no signal. */
export function readRateLimits({
  spawn = spawnChild,
  platform = process.platform,
  kill = (child, lifetime) => killTree(child, lifetime, { platform }),
  timeoutMs = METER_TIMEOUT_MS,
  now = Date.now,
  signals = process,
} = {}) {
  return new Promise((resolve) => {
    const startedAt = now(); // before the spawn: the child cannot have started earlier
    let child = null;
    let exitedAt;
    let settled = false;
    let buffered = '';
    let stderr = '';
    let timer = null;

    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const signal of SIGNALS) signals.off(signal, interrupted);
      let killError = null;
      if (child) {
        try {
          kill(child, { startedAt, exitedAt });
        } catch (err) {
          killError = err.message;
        }
        for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.destroy?.();
        child.unref?.();
      }
      resolve({ ...outcome, killError });
    };
    const interrupted = () => finish({ ok: false, reason: 'interrupted' });

    const send = (message) => child.stdin?.write(`${JSON.stringify(message)}\n`);

    // Reads one line of the server's stdout. A notification (it has a method) and a line that is not JSON are not
    // an answer; the answer to the handshake starts the read, and the answer to the read ends the exchange.
    const handle = (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message === null || typeof message !== 'object' || 'method' in message) return;
      if (message.id === INITIALIZE_ID) {
        if (message.error) finish({ ok: false, reason: 'error', code: message.error.code ?? null });
        else {
          send({ method: 'initialized' });
          send({ id: READ_ID, method: READ_METHOD, params: {} });
        }
      } else if (message.id === READ_ID) {
        if (message.error) finish({ ok: false, reason: 'error', code: message.error.code ?? null });
        else finish({ ok: true, result: message.result ?? null });
      }
    };

    try {
      child = launch(spawn, platform);
    } catch (err) {
      finish({ ok: false, reason: err.code === 'ENOENT' ? 'missing' : 'failed', detail: err.message });
      return;
    }

    timer = setTimeout(() => finish({ ok: false, reason: 'timeout', timeoutMs }), timeoutMs);
    for (const signal of SIGNALS) signals.once(signal, interrupted);
    child.stdin?.on?.('error', () => {}); // a server that exits first makes the next write fail; its exit is what counts
    child.stderr?.on?.('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000);
    });
    child.stdout.setEncoding?.('utf8');
    child.stdout.on('data', (chunk) => {
      buffered += chunk;
      let at = buffered.indexOf('\n');
      while (at !== -1 && !settled) {
        handle(buffered.slice(0, at));
        buffered = buffered.slice(at + 1);
        at = buffered.indexOf('\n');
      }
    });
    child.on('error', (err) => {
      finish({ ok: false, reason: err.code === 'ENOENT' ? 'missing' : 'failed', detail: err.message });
    });
    // `exit` can come before the last of stdout is read; `close` comes after the streams end, so an answer the server
    // wrote just before it exited is read before the exit is taken for a failure.
    child.on('exit', () => {
      exitedAt = now();
    });
    child.on('close', (code) => {
      exitedAt ??= now();
      finish({ ok: false, reason: NOT_FOUND.test(stderr) ? 'missing' : 'exited', code });
    });

    send({ id: INITIALIZE_ID, method: 'initialize', params: { clientInfo: CLIENT_INFO } });
  });
}

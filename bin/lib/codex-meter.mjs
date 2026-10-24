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

/** How long the server may take to answer the read, in ms. The app-server starts cold for each read: the one real
 * read of codex-cli 0.163.0 took about 10.6 s from start to exit on Windows 10, of which the tree kill took about
 * 3.5 s (measured on a dummy process), so the answer itself took most of 6 to 7 s. An 8 s limit would have left
 * little room on a slower day, hence 15 s. Past it the process is killed and the read fails with `timeout`. */
export const METER_TIMEOUT_MS = 15000;

const INITIALIZE_ID = 1;
const READ_ID = 2;
const READ_METHOD = 'account/rateLimits/read';
const CLIENT_INFO = { name: 'js-harness', version: 'codex-meter' };

// Codex says a command it cannot find in this shell in these words; a shell launch that fails that way is missing.
const NOT_FOUND = /not recognized|not found|cannot find/i;

/** Starts `codex app-server` through `spawn` and the one Codex launcher (`./codex-launch.mjs`). */
function launch(spawn, platform) {
  return launchCodex(spawn, platform, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: platform !== 'win32' });
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** A window as `{ usedPercent, resetsAt }`, each `null` when the answer does not hold it. */
const windowOf = (value) => ({ usedPercent: finite(value?.usedPercent), resetsAt: finite(value?.resetsAt) });

/** The numbers of an answer to the read: `fiveHour` (`rateLimits.primary`), `weekly` (`rateLimits.secondary`) and
 * `resetCredits` (`rateLimitResetCredits.availableCount`). Anything else in the answer is dropped here, the
 * account identifier among it, so no caller can print one by accident. */
export function parseRateLimits(result) {
  const limits = result?.rateLimits;
  return {
    fiveHour: windowOf(limits?.primary),
    weekly: windowOf(limits?.secondary),
    resetCredits: finite(result?.rateLimitResetCredits?.availableCount),
  };
}

/** A Unix time in seconds as the host's local `YYYY-MM-DD HH:MM`: the reset a person reads, not a UTC instant. */
export function localClock(seconds) {
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
    case 'exited':
      return `codex app-server exited before it answered (exit ${outcome.code ?? '?'}).`;
    default:
      return `codex app-server could not be started: ${outcome.detail ?? 'unknown error'}.`;
  }
}

/** Starts `codex app-server`, asks it for the limits and resolves with the outcome, never rejects:
 *  - `{ ok: true, result }`: the answer's `result`, as the server gave it (see `parseRateLimits`);
 *  - `{ ok: false, reason }` with `reason` one of `missing` (no `codex` to start), `timeout` (no answer within
 *    `timeoutMs`, with `timeoutMs` given back), `error` (the server answered with an error, its `code` given),
 *    `exited` (the process ended before it answered, its `code` given), or `failed` (it could not be started,
 *    with `detail`).
 * The process is killed on every outcome, once, with `kill(child, { startedAt, exitedAt })`; a kill that throws is
 * given back as `killError`, and the read's own outcome stands. The three requests go out in the order the
 * protocol needs: `initialize`, then `initialized`, then the read, which waits for the handshake's answer.
 * `spawn`, `kill`, `platform`, `timeoutMs` and `now` are injectable, so the tests run no server. */
export function readRateLimits({
  spawn = spawnChild,
  platform = process.platform,
  kill = (child, lifetime) => killTree(child, lifetime, { platform }),
  timeoutMs = METER_TIMEOUT_MS,
  now = Date.now,
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
      let killError = null;
      if (child) {
        try {
          kill(child, { startedAt, exitedAt });
        } catch (err) {
          killError = err.message;
        }
      }
      resolve({ ...outcome, killError });
    };

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
    child.on('exit', (code) => {
      exitedAt = now();
      finish({ ok: false, reason: NOT_FOUND.test(stderr) ? 'missing' : 'exited', code });
    });

    send({ id: INITIALIZE_ID, method: 'initialize', params: { clientInfo: CLIENT_INFO } });
  });
}

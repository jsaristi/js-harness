// What `js-harness remote` (bin/remote.mjs) reads and prints without acting: the repository a command acts on, the
// server's state from the last lines of its log, the marker a `stop` leaves so the watchdog does not bring the server
// back, and the lines of `status`. What writes that marker is in bin/lib/remote.mjs (`markStopped`, `clearStopped`).
// Kept apart from the command so it stays under the size limit (bin/conventions-structure.test.mjs); the command
// imports it, and re-exports `logTail` and `readServerState`.
import fs from 'node:fs';
import path from 'node:path';
import { gitTopLevel } from './project.mjs';

// ---- the server's log ------------------------------------------------------------------------------------------------

const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const CSI = /\x1b\[[0-9;?<=>!]*[ -/]*[@-~]/g;
const OTHER_ESCAPE = /\x1b[ -/]*[0-~]?/g;
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/g;

/** `text` as lines a person would read: OSC sequences (titles, links) dropped whole, then CSI sequences (colors,
 * cursor moves, erases), then any other escape and control character. A `\r` (a redraw) starts a new line. */
function plainLines(text) {
  return String(text).replace(OSC, '').replace(CSI, '').replace(OTHER_ESCAPE, '').split(/\r\n|\r|\n/).map((line) => line.replace(CONTROL, '').trim());
}

const SUPERVISOR_LINE = /^\[js-harness remote\] /;
const SUPERVISOR_DOWN = /^\[js-harness remote\] (server exited|server could not start|stopped|could not stop)/;
/** The state words the server prints after its `·✔︎·` mark. `Ready` is what one with no pre-created session prints
 * where one with a session prints `Connected` (`serverArgs`); it counts only as that word between `·` marks, where
 * the server writes it, since `ready` is an ordinary word too. */
const CONNECTION = /\b(Connected|Connecting|Reconnecting|Disconnected|Offline)\b|·\s*(Ready)\s*·/i;
const ENVIRONMENT_URL = /https:\/\/claude\.ai\/code\?environment=[^\s"'<>)]+/;

/** What the last lines of the server's log say: `connection` is `connected` when the latest connection state the
 * server printed is `Connected` and no supervisor line says the server went down after it, `not connected` for
 * any other latest state, `unknown` when there is none; `capacity` is the latest `N/M`; `environmentUrl` the
 * latest address the phone opens. Escape sequences are stripped first: the real server redraws its status. Any
 * other line of the supervisor's says nothing of the connection, whatever it quotes: `log not trimmed: ...` ends
 * in a system error, and one of those reads `socket is not connected`. */
export function readServerState(text) {
  const lines = plainLines(text);
  let connection = 'unknown';
  let capacity = null;
  let environmentUrl = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (connection === 'unknown') {
      if (SUPERVISOR_DOWN.test(line)) connection = 'not connected';
      else if (!SUPERVISOR_LINE.test(line)) {
        const match = CONNECTION.exec(line);
        if (match) connection = match[1] === 'Connected' || match[2] !== undefined ? 'connected' : 'not connected';
      }
    }
    if (capacity === null) capacity = /Capacity:\s*(\d+\s*\/\s*\d+)/.exec(line)?.[1].replace(/\s/g, '') ?? null;
    if (environmentUrl === null) environmentUrl = ENVIRONMENT_URL.exec(line)?.[0] ?? null;
    if (connection !== 'unknown' && capacity !== null && environmentUrl !== null) break;
  }
  return { connection, capacity, environmentUrl };
}

const LOG_TAIL_BYTES = 64 * 1024;

/** The last `LOG_TAIL_BYTES` of the log, or `''` when there is none. The supervisor trims the log in place once
 * it passes its cap (`trimLog`) and keeps sixteen times this much, with the server's latest repaint at its end,
 * so a trimmed log reads as the whole one did. */
export function logTail(logPath) {
  let fd;
  try {
    fd = fs.openSync(logPath, 'r');
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size, LOG_TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } catch {
    return '';
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// ---- stopped on purpose ----------------------------------------------------------------------------------------------

/** The marker a `stop` leaves beside the state file, and its one rule. Every stop that ends with the server down
 * leaves it, with `--at-login` or without: after `stop --at-login` the task is gone and nothing reads the marker,
 * and `--at-login` is only ever turned on again by a start, which removes it, so one rule serves both. Every start
 * but the watchdog's removes it, once its own input is accepted and it knows whether the recorded supervisor
 * runs, before it looks for the CLI: he asked for a running server, so from then on the watchdog may bring it up,
 * also when this start then fails. The watchdog (`start --watchdog`) only reads it, and starts nothing while it
 * is there: a supervisor that died is its to bring back, one he stopped is not. */
export const stoppedOnPurpose = (files) => fs.existsSync(files.stoppedPath);

/** `found` is what `locate` answered. The server's state is read from the log only for a supervisor known to run:
 * the last lines of a log say nothing about a process that may be gone. `stopped` says the marker of a `stop` is
 * there, which is why a watchdog that is on is not bringing the server back. */
export function reportStatus({ found, state, name, root, logPath, stopped = false }, log) {
  if (found === 'running') log(`remote: running (supervisor pid ${state.pid}, since ${state.startedAtIso ?? new Date(state.startedAt).toISOString()})`);
  else if (found !== 'unknown') log(`remote: not running${stopped ? ' (stopped on purpose with js-harness remote stop: the watchdog task, when on, leaves it stopped until the next js-harness remote start)' : ''}`);
  else if (state.unreadable) log('remote: unknown (its state file cannot be used, so whether a supervisor runs could not be told)');
  else log(`remote: unknown (a supervisor is recorded as pid ${state.pid}, and whether it still runs could not be told)`);
  log(`name: ${name}`);
  log(`project: ${path.normalize(root)}`);
  log(`log: ${logPath}`);
  if (found !== 'running') return;
  const server = readServerState(logTail(logPath));
  log(`server: ${server.connection}`);
  log(`capacity: ${server.capacity ?? 'unknown'}`);
  log(`environment: ${server.environmentUrl ?? 'unknown (not in the log yet)'}`);
}

/** The top level of the git repository `cwd` is in as `{ root }`, or `{ error }` naming why there is none,
 * `noSuchDirectory` or `notGit`: the command (`remoteMain`) says it and exits. Whether js-harness initialized that
 * repository does not matter: nothing here reads `harness.json` or the project manifest, and the first place the
 * command is needed (this repository) has neither. So it asks git for the top level and nothing else
 * (`projectLocation` would spend a second git call finding files it never reads). */
export function repositoryRoot(cwd, topLevel = gitTopLevel) {
  if (!fs.existsSync(cwd)) return { error: 'noSuchDirectory' };
  const root = topLevel(cwd);
  return root ? { root } : { error: 'notGit' };
}

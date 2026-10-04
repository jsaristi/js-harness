// Keeps Claude Code's `claude remote-control` server alive for one project, so the phone can open a new session
// that runs on this machine. Zero deps, plain Node; `js-harness remote start` runs `supervise` in a detached process.
//
// Three facts measured by hand on 2026-10-03 shape it. The server must run in a plain environment: started from a
// desktop session it inherits that session's `CLAUDE_CODE_*` variables and `ANTHROPIC_BASE_URL`, and the phone
// does not see its sessions (`cleanServerEnv`). The server exits after about ten minutes offline, so it is
// restarted, with a capped backoff so a server that cannot run is not restarted in a tight loop (`nextDelay`).
// And it is stopped as a tree, by pid and creation time, through `process-tree.mjs`: a bare-pid kill closed
// unrelated programs on this machine.
//
// Everything that starts or times a process takes it as a parameter, so the tests run a fake server.
import { spawn as spawnChild } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { quoteWindowsArg, windowsCommandLine } from '../codex-review.mjs';
import { killTree } from './process-tree.mjs';

/** `env` without what ties a process to the session that started it: every variable whose name starts with
 * `CLAUDE` (any case: `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, ...) and `ANTHROPIC_BASE_URL`. A new object. */
export function cleanServerEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !/^claude/i.test(name) && !/^anthropic_base_url$/i.test(name)));
}

export const SPAWN_MODES = ['same-dir', 'worktree', 'session'];

/** The arguments of `claude remote-control`: named `name`, sessions started in `spawnMode` (the project folder by
 * default), and `--permission-mode` only when one is given, so the user's own mode applies otherwise. */
export function serverArgs({ name, spawnMode = 'same-dir', permissionMode } = {}) {
  if (typeof name !== 'string' || name.trim() === '') throw new Error('The remote server needs a non-empty name.');
  if (!SPAWN_MODES.includes(spawnMode)) throw new Error(`Unknown spawn mode ${JSON.stringify(spawnMode)}: use one of ${SPAWN_MODES.join(', ')}.`);
  return ['remote-control', '--name', name, '--spawn', spawnMode, ...(permissionMode ? ['--permission-mode', permissionMode] : [])];
}

const isFile = (file) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

/** Where the Claude CLI is, from the PATH of `env` and nothing else (nothing is run to find it):
 * `{ path, shell }`, or `null`. On Windows each directory is tried for `claude.exe`, then `claude.cmd`, in PATH
 * order; a `.cmd` is an npm shim that only a shell can start, hence `shell`. Elsewhere it is a plain `claude`. */
export function resolveClaude({ env = process.env, platform = process.platform, exists = isFile } = {}) {
  const windows = platform === 'win32';
  const key = Object.keys(env).find((name) => (windows ? /^path$/i.test(name) : name === 'PATH'));
  if (!key || typeof env[key] !== 'string') return null;
  const join = windows ? path.win32.join : path.posix.join;
  const names = windows ? ['claude.exe', 'claude.cmd'] : ['claude'];
  for (const entry of env[key].split(windows ? ';' : ':')) {
    const dir = entry.trim().replace(/^"|"$/g, '');
    if (dir === '') continue;
    for (const name of names) {
      const file = join(dir, name);
      if (exists(file)) return { path: file, shell: name.endsWith('.cmd') };
    }
  }
  return null;
}

/** How long to wait before the next restart: `minMs` the first time, twice the previous wait after each quick
 * exit, never more than `maxMs`, and `minMs` again once a server ran for `healthyMs` (it was working; the exit
 * is the ten-minutes-offline one, not a broken setup). */
export function nextDelay(previousMs, ranForMs, { minMs = 5000, maxMs = 60000, healthyMs = 300000 } = {}) {
  if (ranForMs >= healthyMs || !(previousMs > 0)) return minMs;
  return Math.min(Math.max(previousMs * 2, minMs), maxMs);
}

const duration = (ms) => (ms < 1000 ? `${Math.round(ms)}ms` : `${Math.round(ms / 1000)}s`);

/** A wait that ends early, and quietly, when `signal` aborts. */
function abortableSleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** Starts the server: a `.cmd` shim as one command line through the shell (the quoting of `codex-review`), anything
 * else directly. */
function launch(spawn, claude, args, options) {
  return claude.shell
    ? spawn(windowsCommandLine(quoteWindowsArg(claude.path), args), [], { ...options, shell: true })
    : spawn(claude.path, args, options);
}

/** One run of the server, its output appended to `logPath`. Resolves with `{ code, signal, ranFor }` when it
 * exits, `{ error, ranFor }` when it could not start, `{ killError }` when the abort could not stop it. On abort
 * the server's tree is killed by identity, from the `Date.now()` taken just before the spawn (the clock the
 * process snapshot is compared with, so not the injectable `now`, which only times the run). */
function runServer({ claude, args, cwd, env, logPath, spawn, kill, now, platform, signal }) {
  return new Promise((resolve) => {
    let settled = false;
    let child;
    const ranFrom = now();
    const startedAt = Date.now();
    const finish = (result) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', stop);
      resolve({ ...result, ranFor: now() - ranFrom });
    };
    function stop() {
      try {
        kill(child, { startedAt });
      } catch (killError) {
        finish({ killError }); // the tree may still be running: waiting for its exit could wait forever
      }
    }
    const out = fs.openSync(logPath, 'a');
    try {
      // Detached off Windows, so the child leads the process group `killTree` kills; on Windows that would
      // only open a console.
      child = launch(spawn, claude, args, { cwd, env, stdio: ['ignore', out, out], windowsHide: true, detached: platform !== 'win32' });
    } catch (error) {
      finish({ error });
      return;
    } finally {
      fs.closeSync(out); // the child holds its own copy
    }
    child.once('error', (error) => finish({ error }));
    child.once('exit', (code, exitSignal) => finish({ code, signal: exitSignal }));
    if (signal?.aborted) stop();
    else signal?.addEventListener('abort', stop, { once: true });
  });
}

/** Runs the server until `signal` aborts: `claude` (`{ path, shell }`, see `resolveClaude`) with `args` in `cwd`,
 * with `env` as given (clean it with `cleanServerEnv` first), its stdout and stderr appended to `logPath`. Each
 * exit, or failure to start, adds one `[js-harness remote] ...` line to the log and is followed by a wait of
 * `nextDelay(..., backoff)` and a restart. On abort the running server and what it started are killed, by
 * identity, with no restart, and it resolves; a kill that failed is logged and thrown. `spawn`, `sleep(ms,
 * signal)`, `now`, `kill` (`killTree`) and `platform` are injectable. */
export async function supervise({
  claude, args = [], cwd, env, logPath, signal, backoff = {},
  spawn = spawnChild, sleep = abortableSleep, now = Date.now, kill = killTree, platform = process.platform,
}) {
  if (signal?.aborted) return;
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const note = (text) => fs.appendFileSync(logPath, `[js-harness remote] ${text}\n`);
  let delay;
  while (!signal?.aborted) {
    const run = await runServer({ claude, args, cwd, env, logPath, spawn, kill, now, platform, signal });
    if (run.killError) {
      note(`could not stop the server: ${run.killError.message}`);
      throw run.killError;
    }
    if (signal?.aborted) break;
    delay = nextDelay(delay, run.ranFor, backoff);
    if (run.error) note(`server could not start (${run.error.message}); retrying in ${duration(delay)}`);
    else note(`server exited (${run.code !== null ? `code ${run.code}` : `signal ${run.signal}`}) after ${duration(run.ranFor)}; restarting in ${duration(delay)}`);
    await sleep(delay, signal);
  }
  note('stopped');
}

// How the TUI runs a command (odd/tasks/tui-gentle-level.md, S4). `runChild` starts it as a child with no stdin
// and its output piped, so the menu keeps drawing while it works and nothing it prints lands on the menu; an
// abort stops it with everything it started. `handOff` gives a command that asks its own questions the terminal
// itself, so each of its per-action prompts reaches the user exactly as on the command line.
import { spawn as nodeSpawn } from 'node:child_process';
import { killSurvivors, killTree } from './process-tree.mjs';

/** Stops `child` and its descendants through the shared process-tree helpers (bin/lib/process-tree.mjs): a
 * package manager started by `update` would outlive its parent otherwise, and a pid alone may name someone else's
 * process on Windows. A child that already exited may have left a descendant holding its output, which keeps the run
 * open: that one is found by the child's lifetime (`killSurvivors`). If the tree cannot be read, the child itself is
 * still stopped. */
function defaultKill(child, lifetime, platform) {
  if (lifetime.exitedAt !== undefined) killSurvivors(child, lifetime, { platform });
  else killTree(child, lifetime, { platform });
}

function stopTree(child, lifetime, kill) {
  try {
    kill(child, lifetime);
  } catch {
    child.kill();
  }
}

/** Runs `command args` with output to `onOutput(text, stream)`, `stream` being `'stdout'` or `'stderr'`; resolves
 * to `{ code, cancelled }`, plus `signal` when one ended it and `error` when it could not start. Aborting
 * `signal` stops the child and its tree, and the result says `cancelled`. The kill reads the process table, which
 * takes a moment on Windows, so it runs after the abort returns: the caller draws "cancelling" first. */
export function runChild(command, args, { env = process.env, cwd, onOutput = () => {}, signal, spawn = nodeSpawn, platform = process.platform, kill = (child, lifetime) => defaultKill(child, lifetime, platform) } = {}) {
  if (signal?.aborted) return Promise.resolve({ code: null, cancelled: true });
  return new Promise((resolve) => {
    let cancelled = false;
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const lifetime = { startedAt: Date.now() };
    const child = spawn(command, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: platform !== 'win32' });
    function onAbort() {
      cancelled = true;
      setImmediate(() => {
        if (!settled) stopTree(child, lifetime, kill);
      });
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    for (const name of ['stdout', 'stderr']) {
      child[name].setEncoding('utf8');
      child[name].on('data', (text) => onOutput(text, name));
    }
    child.on('exit', () => { lifetime.exitedAt = Date.now(); });
    child.on('error', (err) => settle({ code: null, cancelled, error: `${err.code ?? 'error'}: ${err.message}` }));
    child.on('close', (code, killedBy) => settle({ code: cancelled ? null : code, cancelled, ...(killedBy && !cancelled ? { signal: killedBy } : {}) }));
  });
}

/** Runs `command args` on the terminal itself (stdin, stdout and stderr inherited); resolves to `{ code }`, plus
 * `error` when it could not start. The caller gives the terminal up first and takes it back after. Aborting
 * `signal` (the menu ending on a termination or a hangup) stops the child and its tree. */
export function handOff(command, args, { env = process.env, cwd, signal, spawn = nodeSpawn, platform = process.platform, kill = (child, lifetime) => defaultKill(child, lifetime, platform) } = {}) {
  if (signal?.aborted) return Promise.resolve({ code: null, cancelled: true });
  return new Promise((resolve) => {
    let cancelled = false;
    const lifetime = { startedAt: Date.now() };
    const child = spawn(command, args, { env, cwd, stdio: 'inherit' });
    const onAbort = () => {
      cancelled = true;
      setImmediate(() => stopTree(child, lifetime, kill));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const settle = (result) => {
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    child.on('exit', () => { lifetime.exitedAt = Date.now(); });
    child.on('error', (err) => settle({ code: null, cancelled, error: `${err.code ?? 'error'}: ${err.message}` }));
    child.on('close', (code) => settle(cancelled ? { code: null, cancelled } : { code }));
  });
}

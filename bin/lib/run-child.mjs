// How the TUI runs a command (odd/tasks/tui-gentle-level.md, S4). `runChild` starts it as a child with no stdin
// and its output piped, so the menu keeps drawing while it works and nothing it prints lands on the menu; an
// abort stops it with everything it started. `handOff` gives a command that asks its own questions the terminal
// itself, so each of its per-action prompts reaches the user exactly as on the command line.
import os from 'node:os';
import { spawn as nodeSpawn } from 'node:child_process';

/** Stops `child` and its descendants: on Windows `taskkill /T` walks the tree (a package manager started by
 * `update` would outlive its parent otherwise); elsewhere the child leads its own process group. */
function stopTree(child, { spawn, platform }) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (platform === 'win32') {
    // From the temp folder: a process started in the user's folder would hold it until it ends.
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { cwd: os.tmpdir(), stdio: 'ignore', windowsHide: true });
    killer.on?.('error', () => child.kill());
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

/** Runs `command args` with output to `onOutput(text)`; resolves to `{ code, cancelled }`, plus `error` when it
 * could not start. Aborting `signal` stops the child and its tree, and the result says `cancelled`. */
export function runChild(command, args, { env = process.env, cwd, onOutput = () => {}, signal, spawn = nodeSpawn, platform = process.platform } = {}) {
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
    const child = spawn(command, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: platform !== 'win32' });
    function onAbort() {
      cancelled = true;
      stopTree(child, { spawn, platform });
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (text) => onOutput(text));
    }
    child.on('error', (err) => settle({ code: null, cancelled, error: `${err.code ?? 'error'}: ${err.message}` }));
    child.on('close', (code) => settle({ code: cancelled ? null : code, cancelled }));
  });
}

/** Runs `command args` on the terminal itself (stdin, stdout and stderr inherited); resolves to `{ code }`, plus
 * `error` when it could not start. The caller gives the terminal up first and takes it back after. */
export function handOff(command, args, { env = process.env, cwd, spawn = nodeSpawn } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, cwd, stdio: 'inherit' });
    child.on('error', (err) => resolve({ code: null, error: `${err.code ?? 'error'}: ${err.message}` }));
    child.on('close', (code) => resolve({ code }));
  });
}

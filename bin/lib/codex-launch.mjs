// How a command starts the Codex CLI. Zero deps, plain Node.
//
// On Windows `codex` is a `.cmd` shim that only a shell runs, so the line goes through `cmd.exe` quoted by
// `windowsCommandLine`; everywhere else the binary is started directly. It lives in `bin/lib` because two
// commands start Codex, `codex-review` for a review and `codex-meter` for the app-server that answers the rate
// limits, and the rule must be one: a second copy would drift the day the shim or the quoting changes. The probe of
// `codex --version` that `codex-review` runs before a review lives here too, since it goes through the same launch.

import { windowsCommandLine } from './windows-args.mjs';

/** Starts `codex <argv>` through `spawnFn` (`spawn` or `spawnSync`) with `options`: a shell line on win32,
 * the binary and its arguments elsewhere. Returns what `spawnFn` returns. */
export function launchCodex(spawnFn, platform, argv, options) {
  return platform === 'win32'
    ? spawnFn(windowsCommandLine('codex', argv), [], { ...options, shell: true })
    : spawnFn('codex', argv, options);
}

const PROBE_TIMEOUT_MS = 15000;

// A version as `codex --version` prints it after the name: `0.160.0`, or `0.161.0-alpha.2`.
const CLI_VERSION = /\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?/;

/** The version `codex --version` answers with (`0.160.0`), through the launch path and environment
 * of the review, or `null` when it does not answer with one: a missing CLI is told apart here, so a
 * bad `-c`, a broken config or a failed login is never reported as one. */
export function codexVersion(spawn, platform, env) {
  try {
    const result = launchCodex(spawn, platform, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
      env,
    });
    if (!result || result.error || result.status !== 0) return null;
    return CLI_VERSION.exec(result.stdout ?? '')?.[0] ?? null;
  } catch {
    return null;
  }
}

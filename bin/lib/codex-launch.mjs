// How a command starts the Codex CLI. Zero deps, plain Node.
//
// On Windows `codex` is a `.cmd` shim that only a shell runs, so the line goes through `cmd.exe` quoted by
// `windowsCommandLine`; everywhere else the binary is started directly. It lives in `bin/lib` because two
// commands start Codex, `codex-review` for a review and `codex-meter` for the app-server that answers the rate
// limits, and the rule must be one: a second copy would drift the day the shim or the quoting changes.

import { windowsCommandLine } from './windows-args.mjs';

/** Starts `codex <argv>` through `spawnFn` (`spawn` or `spawnSync`) with `options`: a shell line on win32,
 * the binary and its arguments elsewhere. Returns what `spawnFn` returns. */
export function launchCodex(spawnFn, platform, argv, options) {
  return platform === 'win32'
    ? spawnFn(windowsCommandLine('codex', argv), [], { ...options, shell: true })
    : spawnFn('codex', argv, options);
}

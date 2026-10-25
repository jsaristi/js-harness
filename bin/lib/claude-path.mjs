// Where the Claude CLI is on the PATH, found without running anything: `remote` starts its server with it, and
// `sessions start` and the board run `claude --bg` and `claude agents` with it (odd/tasks/background-sessions.md). Its own
// module, so a reader of the board loads none of `remote`. Zero dependencies.

import fs from 'node:fs';
import path from 'node:path';

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

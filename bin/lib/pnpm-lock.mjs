// The `pnpm-lock` check of `doctor` (failure pnpm-update-leaves-lock in docs/FAILURES.md). On this machine the only
// road to update the installed command is `pnpm add -g`, and twice it ended with exit 1 and left its global bin lock,
// an empty folder at `<PNPM_HOME>/bin/.pnpm-global-bin.lock` (relief file, line 201, 2026-10-11): the next try waits
// five minutes for it and fails. The check names that folder before the next try meets it.
import fs from 'node:fs';
import path from 'node:path';

// An install holds the lock for its own run; pnpm itself gives up on it after five minutes, so a lock older than
// twice that is held by nobody.
const STALE_MS = 10 * 60 * 1000;

export const PNPM_LOCK_FIX =
  'pnpm left its global bin lock behind, and the next pnpm add -g waits five minutes for it and fails: with no pnpm running, remove it (rmdir removes only an empty folder):';

/** The check's cells and line: `stale` when `<PNPM_HOME>/bin/.pnpm-global-bin.lock` exists and was last changed more
 * than ten minutes ago, with one line that is the command to remove it and since when it was left; `ok` when there is
 * none or it is younger; `n/a` when `PNPM_HOME` is not set, a machine with no pnpm of its own; `unknown` when the
 * path cannot be read. */
export function pnpmLockState({ env = process.env, now = Date.now, stat: statOf = fs.statSync } = {}) {
  if (!env.PNPM_HOME) return { claude: 'n/a', codex: 'n/a', lines: [] };
  const lockPath = path.join(env.PNPM_HOME, 'bin', '.pnpm-global-bin.lock');
  let stat;
  try {
    stat = statOf(lockPath);
  } catch (err) {
    if (err.code === 'ENOENT') return { claude: 'ok', codex: 'n/a', lines: [] };
    return { claude: 'unknown', codex: 'n/a', lines: [] };
  }
  if (now() - stat.mtimeMs <= STALE_MS) return { claude: 'ok', codex: 'n/a', lines: [] };
  return { claude: 'stale', codex: 'n/a', lines: [`rmdir "${lockPath}" (left since ${new Date(stat.mtimeMs).toISOString()})`] };
}

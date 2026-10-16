// A stable digest of a doctor report's gap list, so `doctor --hook` (T3) can tell whether anything
// changed since it last notified the user without keeping the full report around — see
// odd/tasks/stack-doctor.md.
import crypto from 'node:crypto';

/** The states that are a gap, something to fix: `stale` is a host whose hook calls a removed command, or a memory
 * note that holds a rule (`memory-rules`),
 * `mismatch` the Claude CLI and the desktop app signed into different accounts, and `down` a recorded login
 * launcher whose remote server is not running. `unknown` and `n/a` are not gaps. This is the one list: `doctor`
 * (its Fix section and `--json` gaps) and the TUI's stack block read it from here, so the three cannot disagree
 * on what counts. */
export const GAP_STATES = new Set(['missing', 'outdated', 'stale', 'mismatch', 'down']);
const DIMENSIONS = ['installed', 'claude', 'codex', 'project', 'upToDate'];

/** Every (tool id, dimension, state) gap in a doctor report. Sorted by id then dimension so the
 * list — and the digest built from it — never depends on row or dimension order. */
export function gapList(rows) {
  const gaps = [];
  for (const row of rows) {
    for (const dimension of DIMENSIONS) {
      const state = row[dimension];
      if (GAP_STATES.has(state)) gaps.push({ id: row.id, dimension, state });
    }
  }
  gaps.sort((a, b) => (a.id === b.id ? a.dimension.localeCompare(b.dimension) : a.id.localeCompare(b.id)));
  return gaps;
}

/** A stable digest for a report's gap list: the empty string for no gaps (never null, so it
 * compares cleanly with `===` against a freshly read cache's `notified`, which starts `null`). */
export function gapDigest(rows) {
  const gaps = gapList(rows);
  if (gaps.length === 0) return '';
  return crypto.createHash('sha256').update(JSON.stringify(gaps)).digest('hex');
}

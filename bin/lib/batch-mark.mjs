// The mark an eval batch leaves while it runs. A batch takes no turn of the gate lock, so the guard could not
// see it, and on 2026-10-10 tests started beside a batch of 12 trials (docs/FAILURES.md, heavy-run-beside-gate).
// The batch writes this mark and beats it as a gate's holder beats its file; the guard reads it as it reads that
// holder, and refuses a heavy test run beside it (first-version T6a). Gates do not wait for it: the mark is for
// the guard alone.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { GATE_BEAT_MS, GATE_STALE_MS, gateDir } from './gate-lock.mjs';

const MARK_FILE = /^batch-.+\.json$/;

/** Where the marks of `home` live: inside the gate's folder, which deleting undoes with the lock. */
export function batchDir(home) {
  return path.join(gateDir(home), 'batches');
}

/** The marks of `home` as `{ file, stale }`, or none where the folder cannot be listed. */
function marksOf(home, now, io) {
  let names;
  try {
    names = io.readdirSync(batchDir(home));
  } catch {
    return [];
  }
  const marks = [];
  for (const name of names.filter((item) => MARK_FILE.test(item))) {
    const file = path.join(batchDir(home), name);
    try {
      marks.push({ file, stale: now() - io.statSync(file).mtimeMs > GATE_STALE_MS });
    } catch {
      // Removed between the listing and the look: a batch that ended.
    }
  }
  return marks;
}

/** Leaves the mark of a running batch under `home` and beats it every `beatMs`; returns the release, which
 * stops the beat and removes the mark, and may be called more than once. The marks of batches that died, which
 * beat no more, are swept first. A mark that cannot be written is no failure of the batch: the release is then
 * a no-op. */
export function markBatch(home, { cwd = process.cwd(), command = '', pid = process.pid, now = Date.now, beatMs = GATE_BEAT_MS, fileSystem: io = fs } = {}) {
  for (const mark of marksOf(home, now, io)) {
    try {
      if (mark.stale) io.rmSync(mark.file, { force: true });
    } catch {
      // Held open elsewhere: it beats no more, so it stays stale and unread, and the next mark sweeps it.
    }
  }
  const file = path.join(batchDir(home), `batch-${pid}-${randomBytes(4).toString('hex')}.json`);
  try {
    io.mkdirSync(batchDir(home), { recursive: true });
    io.writeFileSync(file, `${JSON.stringify({ pid, cwd, command, startedAt: new Date(now()).toISOString() })}\n`);
  } catch {
    return () => {};
  }
  const beat = setInterval(() => {
    try {
      const at = new Date(now());
      io.utimesSync(file, at, at);
    } catch {
      // A beat that misses is made up by the next; a mark that is gone stays gone.
    }
  }, beatMs);
  beat.unref?.();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    clearInterval(beat);
    try {
      io.rmSync(file, { force: true });
    } catch {
      // Left behind, it beats no more and is stale within a minute.
    }
  };
}

/** The first living batch mark of `home`, as `{ pid, cwd, command, startedAt, batch: true }`, or `null`: none,
 * only stale ones, or none that can be read. */
export function readBatch(home, { now = Date.now, fileSystem: io = fs } = {}) {
  for (const mark of marksOf(home, now, io)) {
    if (mark.stale) continue;
    try {
      return { ...JSON.parse(io.readFileSync(mark.file, 'utf8')), batch: true };
    } catch {
      // Torn, or removed since the look.
    }
  }
  return null;
}

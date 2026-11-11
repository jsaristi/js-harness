// The write of one installed file by `install` and `sync` (./manifest.mjs), and the record of it in the machine
// manifest. A file install wrote and the user then changed is theirs, as `uninstall` already holds: it is left as it
// is and said, never written over (F8 S10, odd/tasks/f8-s10-port.md, T8). It moved out of manifest.mjs, at its size
// ceiling, with the failure it already carried forward.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** The bytes at `target`, or `null` when no file is there; any other failure to read throws. */
function bytesAt(target, readFile) {
  try {
    return readFile(target);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Where the copy of a file that was at `target` before the harness first wrote there is kept: beside it, named by
 * what it is and by its bytes, so a second copy of the same text lands on the first and one of another text never
 * writes over it. No host reads a file of that name as a skill, an agent or a prompt. */
function copyPathOf(target, there) {
  return `${target}.before-js-harness-${sha256(there).slice(0, 8)}`;
}

/** Whether the file at `file` holds exactly `bytes`; one that is missing or cannot be read does not. */
function holds(file, bytes, readFile) {
  try {
    return sha256(readFile(file)) === sha256(bytes);
  } catch {
    return false;
  }
}

/** Keeps `there`, the bytes of the file at a component's path, at `copy`, and throws unless the copy holds them when
 * it returns. A file already under that name is read, never taken as whole: a run that stopped while it wrote the
 * copy leaves a short one, and the next run would write over the original with that as its only copy (Codex on
 * 62bb01f..99020c1). The copy just written is read back for the same reason. */
function keepCopy(copy, there, writeFile, readFile) {
  if (holds(copy, there, readFile)) return;
  writeFile(copy, there);
  if (!holds(copy, there, readFile)) throw new Error(`the copy at ${copy} does not hold the file it is a copy of`);
}

/** Writes `content` to `target` and returns its record, `{ path, sha256, skipped: false }`, unless:
 * - there is no `previous` record and a file with other bytes is already there: it is not the harness's, so a copy
 *   of it is kept first (`copyPathOf`, `keepCopy`), named in the record as `replaced` for `install` to say, and when
 *   the file cannot be read or the copy cannot be made whole nothing is written, `null`, as for a write that fails
 *   (the audit's L3: a first install wrote over it with no copy). The copy is the person's file under another name:
 *   `uninstall` leaves it, deleting it undoes it, and a later run's record no longer names it;
 * - `previous`, the record of the last run, says install wrote it, and the file there now holds neither those bytes
 *   nor `content`: the user changed it, so it is left, and its record is carried forward with the recorded hash,
 *   which `uninstall` then reads as theirs, marked `edited` and `skipped` (not written this run);
 * - the write fails (R3-002, a host folder that is a plain file): with a `previous` record, that record is carried
 *   forward, `skipped` with the failure's `reason`, so uninstall can still undo the file; with none, `null`, since
 *   there is nothing to carry forward.
 * A file the user deleted is written again, and one put back to the recorded bytes is updated. A recorded file that
 * is there and cannot be read is left unwritten, as one whose write failed, since whether it is the user's is not
 * known (Codex on 0d97e52..98f9145). `writeFile` and `readFile` are the seams a test makes fail. */
export function writeComponent(target, content, previous, writeFile = fs.writeFileSync, readFile = fs.readFileSync) {
  let there = null;
  try {
    there = bytesAt(target, readFile);
  } catch (err) {
    return previous ? { path: previous.path, sha256: previous.sha256, skipped: true, reason: `not readable (${err.code ?? err.message})` } : null;
  }
  const other = there !== null && sha256(there) !== sha256(content);
  if (previous && other && sha256(there) !== previous.sha256) {
    return { path: previous.path, sha256: previous.sha256, skipped: true, edited: true, reason: 'changed since it was written' };
  }
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const replaced = !previous && other ? copyPathOf(target, there) : null;
    if (replaced) keepCopy(replaced, there, writeFile, readFile);
    writeFile(target, content, 'utf8');
    return { path: target, sha256: sha256(content), skipped: false, ...(replaced && { replaced }) };
  } catch (err) {
    return previous ? { path: previous.path, sha256: previous.sha256, skipped: true, reason: err.message } : null;
  }
}

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

/** Writes `content` to `target` and returns its record, `{ path, sha256, skipped: false }`, unless:
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
    there = previous ? bytesAt(target, readFile) : null;
  } catch (err) {
    return { path: previous.path, sha256: previous.sha256, skipped: true, reason: `not readable (${err.code ?? err.message})` };
  }
  if (there !== null && sha256(there) !== previous.sha256 && sha256(there) !== sha256(content)) {
    return { path: previous.path, sha256: previous.sha256, skipped: true, edited: true, reason: 'changed since it was written' };
  }
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeFile(target, content, 'utf8');
    return { path: target, sha256: sha256(content), skipped: false };
  } catch (err) {
    return previous ? { path: previous.path, sha256: previous.sha256, skipped: true, reason: err.message } : null;
  }
}

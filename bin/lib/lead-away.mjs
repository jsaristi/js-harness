// The lead's reading of the user's absence (odd/tasks/departure-control.md; JH 194): when he last wrote to the session
// that holds the lead's role, whether a stretch covers the time since, and the mark that tells each absence once. The
// heartbeat (`js-harness loop heartbeat`) and the lead's own wait (`js-harness wait --notice-to orchestrator`) both end
// on it, so the control holds whichever of the two the lead runs; they share this one reading and one mark, and an
// absence one of them told is not told again by the other. The pieces of the transcript are read by the caller, which
// may read them for something else too (the heartbeat counts its compactions in the same text).
import fs from 'node:fs';
import path from 'node:path';

import { readNotices } from './channel.mjs';
import { loopsFolder } from './loops.mjs';
import { departureLine, departureWatch, stretchesOf } from './return-report.mjs';
import { projectSlug } from './sessions.mjs';
import { isLeadSession } from './stale-board.mjs';

/** The whole lines of `file` from the byte `start` to its last line break, as `{ text, end }` with `end` the byte after
 * them, so a line the host is still writing waits for the next read and a character is never cut in two. A file
 * shorter than `start` was written again: it is read from its start, with `restarted`. */
export function readTailOf(file, start) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const from = size < start ? 0 : start;
    if (size === from) return { text: '', end: from, restarted: from !== start };
    const buffer = Buffer.alloc(size - from);
    fs.readSync(fd, buffer, 0, buffer.length, from);
    const last = buffer.lastIndexOf(10);
    if (last < 0) return { text: '', end: from, restarted: from !== start };
    return { text: buffer.subarray(0, last + 1).toString('utf8'), end: from + last + 1, restarted: from !== start };
  } finally {
    fs.closeSync(fd);
  }
}

/** The transcript of `session`, or `null` without one. The host keeps a session opened in a worktree under that
 * worktree's folder, so the folder of `cwd` is tried before the main checkout's (`slug`); when neither holds the file,
 * the first is named, so what fails to read it says where it looked. */
export function sessionTranscript({ cwd, slug, claudeDir, session, mtime }) {
  if (!session) return null;
  const folders = [...new Set([projectSlug(path.resolve(cwd)), slug])].map((name) => path.join(claudeDir, 'projects', name));
  return folders.map((folder) => path.join(folder, `${session}.jsonl`)).find((file) => {
    try {
      mtime(file);
      return true;
    } catch {
      return false;
    }
  }) ?? path.join(folders[0], `${session}.jsonl`);
}

/** The reading of his absence for `session` in the project `slug` under the harness home `home`. `feed(tail)` takes a
 * piece `readTailOf` gave (a `restarted` one starts the reading over); `unread()` says this tick's read failed, since an
 * absence is never told from a transcript that could not be read. `at(now)` is the absence in course at `now` (ms) that
 * no stretch covers, in the lead's session only, or `null`; what cannot be read for it is said once through `say`.
 * `told()` is the absence told last for the session (when he last wrote, ISO), `tell(found, now)` marks `found` told
 * and gives its `AWAY:` line, and `leads()` is whether the session holds the lead's role now. */
export function leadAbsence({ home, slug, session, readFile, writeFile, say }) {
  let watch = departureWatch();
  let read = false;
  let failureSaid = false;
  // The absence told last for this session, kept as the cut's count is, in a folder of its own under the loop records
  // (loop status reads every .json entry of that folder as a loop).
  const markFile = path.join(loopsFolder(home, slug), 'away', `${session}.json`);
  const leadsIn = (notices) => isLeadSession(notices, session);
  // Only the lead is told: the user's messages reach the lead's chat, and a work session plans no stretch. Who the lead
  // is, is the return check's rule (`isLeadSession`). A yes is kept for the absence it was read in; a no is read again
  // at the next tick, since a lead's first notice may come after the absence started.
  const leadIn = new Set();
  const isLead = (before) => {
    if (leadIn.has(before)) return true;
    const record = readNotices(home, slug, { readFile });
    if (record.unavailable !== undefined) throw new Error(`the record of notices (${record.path}): ${record.unavailable}`);
    if (!leadsIn(record.notices)) return false;
    leadIn.add(before);
    return true;
  };
  return {
    feed(tail) {
      if (tail.restarted) watch = departureWatch();
      watch.add(tail.text);
      read = true;
    },
    unread() {
      read = false;
    },
    at(now) {
      if (!read) return null;
      try {
        const found = watch.read(stretchesOf(home, slug, readFile), now);
        return found !== null && isLead(found.before) ? found : null;
      } catch (err) {
        if (!failureSaid) say(`the user's absence could not be read: ${err.message}`);
        failureSaid = true;
        return null;
      }
    },
    told() {
      try {
        const told = JSON.parse(readFile(markFile)).told;
        return typeof told === 'string' ? told : null;
      } catch {
        return null;
      }
    },
    tell(found, now) {
      try {
        writeFile(markFile, `${JSON.stringify({ told: found.before, at: new Date(now).toISOString(), heldSince: found.heldSince })}\n`);
      } catch (err) {
        say(`the user's absence could not keep its mark ${markFile}: ${err.code ?? err.message}`);
      }
      return departureLine(found);
    },
    leads() {
      const record = readNotices(home, slug, { readFile });
      return record.unavailable === undefined && leadsIn(record.notices);
    },
  };
}

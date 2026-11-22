// The lead's reading of the user's absence (odd/tasks/departure-control.md; JH 194): when he last wrote to the session
// that holds the lead's role, whether a stretch covers the time since, and the mark that tells each absence once. The
// heartbeat (`js-harness loop heartbeat`) and the lead's own wait (`js-harness wait --notice-to orchestrator`) both end
// on it, so the control holds whichever of the two the lead runs; they share this one reading and one mark, and an
// absence one of them told is not told again by the other. The pieces of the transcript are read by the caller, which
// may read them for something else too (the heartbeat counts its compactions in the same text).
import fs from 'node:fs';
import path from 'node:path';

import { readNotices } from './channel.mjs';
import { gateLogDir } from './gate-log.mjs';
import { localHour, localZone } from './local-time.mjs';
import { loopsFolder } from './loops.mjs';
import { departureLine, departureWatch, stretchesOf } from './return-report.mjs';
import { projectDirsOf, projectSlug } from './sessions.mjs';
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
 * worktree's folder, so the folder of `cwd` is tried first, then the main checkout's (`root`) and those of its other
 * worktrees as git lists them (`projectDirsOf`, through `run`): a lead opened in a worktree may run its command with
 * the main checkout as its folder. When none holds the file, the first is named, so what fails to read it says where
 * it looked. */
export function sessionTranscript({ cwd, root, claudeDir, session, mtime, run }) {
  if (!session) return null;
  const folders = [...new Set([path.join(claudeDir, 'projects', projectSlug(path.resolve(cwd))), ...projectDirsOf(run, root, claudeDir)])];
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

/** How long no work session of the project may go without a write, while a stretch is open with hours left, before
 * the lead is told (odd/tasks/idle-stretch.md): a foreground command ends at ten minutes, so twice that is no turn. */
export const IDLE_MS = 20 * 60_000;

/** The record of every idle spell told, one JSON line `{ since, at, session }` each, beside the marks: a stretch's
 * return counts each spell as lost time (`js-harness stretch`), from its `since` to the first work after it. */
export const idleSpellsFile = (home, slug) => path.join(loopsFolder(home, slug), 'idle', 'spells.jsonl');

/** The spells `idleSpellsFile` holds, oldest first: a line that is not one is left out; no file is none, and a file
 * that is there and cannot be read throws. */
export function readIdleSpells(home, slug, readFile) {
  let text;
  try {
    text = readFile(idleSpellsFile(home, slug));
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw new Error(`the idle spells (${idleSpellsFile(home, slug)}): ${err?.code ?? err?.message}`);
  }
  return text.split('\n').flatMap((line) => {
    try {
      const spell = JSON.parse(line);
      return Number.isFinite(Date.parse(spell?.since)) ? [spell] : [];
    } catch {
      return [];
    }
  }).sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
}

/** The word the `IDLE:` line opens with. */
export const IDLE_MARKER = 'IDLE:';

/** The lead's reading of a stretch with nothing running (odd/tasks/idle-stretch.md; 2026-11-22, 03:52Z to 05:22Z, a
 * stretch whose goals were met early and no session ran). `at(now)` is the idle spell in course at `now` (ms) or `null`:
 * a stretch that is open with hours left (`stretchesOf`, its `returnAt` after `now`) and no write for `IDLE_MS` to a
 * transcript of the project's folders (`dirs()`, as `projectDirsOf` lists them) other than the lead's own, nor to the
 * gate log; the spell runs from the newest such write, or from the stretch's opening. It is `{ since, idleMs, stretch,
 * leftMs }`, `since` ISO and `stretch` the stretch's id. "Ran" is read from writes, not turns: a dead session's dangling
 * turn would hold the line back forever, and a foreground sub-agent, which writes only under its session's
 * `subagents/` folder, may give a false line, which costs one wake. What cannot be read is unknown, never idle: said
 * once through `say`, and nothing is told. `told()` is the spell told last (its `since`), and `tell(found, now)` marks
 * `found` told and gives its `IDLE:` line, under a mark beside the absence's. */
export function stretchIdle({ home, slug, session, dirs, readdir, mtime, readFile, writeFile, say }) {
  // The spells' record grows through the caller's own seams, so a test's world holds it as it holds the mark.
  const appendFile = (file, text) => {
    let before = '';
    try {
      before = readFile(file);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    writeFile(file, before + text);
  };
  const markFile = path.join(loopsFolder(home, slug), 'idle', `${session}.json`);
  const own = `${session}.jsonl`;
  let failureSaid = false;
  /** The newest time a file of `dir` was written, among those `wanted` keeps, or -Infinity; a folder that is not there
   * holds none, and one that cannot be listed throws. */
  const newestIn = (dir, wanted) => {
    let names;
    try {
      names = readdir(dir);
    } catch (err) {
      if (err?.code === 'ENOENT') return -Infinity;
      throw new Error(`the folder ${dir}: ${err?.code ?? err?.message}`);
    }
    let last = -Infinity;
    for (const name of names) {
      if (!wanted(name)) continue;
      try {
        last = Math.max(last, mtime(path.join(dir, name)));
      } catch {
        // a file gone between the listing and its time was not written since
      }
    }
    return last;
  };
  return {
    at(now) {
      try {
        const open = stretchesOf(home, slug, readFile).findLast((one) => one.closedAt === null && one.openedAt <= now && one.returnAt !== null && one.returnAt > now);
        if (open === undefined) return null;
        let last = open.openedAt;
        for (const dir of dirs()) last = Math.max(last, newestIn(dir, (name) => name.endsWith('.jsonl') && name !== own));
        last = Math.max(last, newestIn(gateLogDir(home), () => true));
        if (now - last < IDLE_MS) return null;
        return { since: new Date(last).toISOString(), idleMs: now - last, stretch: open.id, leftMs: open.returnAt - now };
      } catch (err) {
        if (!failureSaid) say(`the idle stretch could not be read: ${err.message}`);
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
        writeFile(markFile, `${JSON.stringify({ told: found.since, at: new Date(now).toISOString() })}\n`);
      } catch (err) {
        say(`the idle stretch could not keep its mark ${markFile}: ${err.code ?? err.message}`);
      }
      // After the mark, whose writing made the folder: the return counts the spell (`readIdleSpells`).
      try {
        appendFile(idleSpellsFile(home, slug), `${JSON.stringify({ since: found.since, at: new Date(now).toISOString(), session })}\n`);
      } catch (err) {
        say(`the idle stretch could not record its spell in ${idleSpellsFile(home, slug)}: ${err.code ?? err.message}`);
      }
      return `${IDLE_MARKER} no work session of this project has written since ${localHour(found.since)}, local time (${localZone(found.since)}) `
        + `(${Math.round(found.idleMs / 60_000)} minutes ago), and the stretch opened at ${localHour(found.stretch)} has ${(found.leftMs / 3_600_000).toFixed(1)} hours left: `
        + 'plan the next unit or close the stretch (`js-harness stretch close --html <file>`). Told once for this idle spell.';
    },
  };
}

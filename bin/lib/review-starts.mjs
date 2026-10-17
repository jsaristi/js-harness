// When each gentle-ai review started and ended, read from gentle-ai's own store (B6 of odd/tasks/throughput-review.md).
// gentle-ai keeps a live transaction as a folder `<git common dir>/gentle-ai/review-transactions/v2/<lineage>/`, made
// at START and deleted when the lineage is burned, and writes `terminal-consumption/v1/<hash>.json` naming the lineage
// before it deletes that folder. The start is the one moment lost at the burn, so the pause hook (`resume --pause`)
// records it here while the folder is there; the ends are read from the terminal records, which stay.

import fs from 'node:fs';
import path from 'node:path';

/** A lineage id as gentle-ai accepts one: lower-case words of letters and digits joined by single dashes. */
export const LINEAGE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The schema of a terminal record, the one shape read as an end. */
const TERMINAL_SCHEMA = 'gentle-ai.review-terminal-consumption/v1';

const storeOf = (commonDir) => path.join(commonDir, 'gentle-ai', 'review-transactions');

/** `<home>/.js-harness/throughput/<slug>/review-starts.jsonl`, beside the project's day snapshots. */
export const reviewStartsFile = (home, slug) => path.join(home, '.js-harness', 'throughput', slug, 'review-starts.jsonl');

const iso = (ms) => new Date(ms).toISOString();

/** When a folder of `info` (a stat) was made: its birthtime when one is kept that can be trusted, else `now`, the time
 * it was seen. A birthtime of 0 is none; one after the folder last changed or after now is not one; and outside
 * Windows and macOS a birthtime equal to ctime is the ctime Node gives where statx is missing, which moves. */
export function startOf(info, now, platform = process.platform) {
  const born = info.birthtimeMs;
  const kept = born > 0 && born <= info.mtimeMs && born <= now && (platform === 'win32' || platform === 'darwin' || born !== info.ctimeMs);
  return kept ? { at: iso(born), from: 'birthtime' } : { at: iso(now), from: 'seen' };
}

/** The entries of `dir`, none where it is not there; another failure throws its code. */
function entriesOf(dir, io) {
  try {
    return io.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw new Error(err?.code ?? err?.message ?? String(err));
  }
}

/** The stat of `file`, `null` when it went before it was asked; another failure throws its code. */
function statOf(file, io) {
  try {
    return io.statSync(file);
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw new Error(err?.code ?? err?.message ?? String(err));
  }
}

/** The lineages live in gentle-ai's store, as `{ lineage, info }`: the folders of `v2/` named as lineage ids, so its
 * `LOCK` file and its temporary entries are not ones. None where the store is not there. */
export function liveLineages(commonDir, { fileSystem: io = fs } = {}) {
  const v2 = path.join(storeOf(commonDir), 'v2');
  return entriesOf(v2, io).flatMap((entry) => {
    if (!entry.isDirectory() || !LINEAGE_ID.test(entry.name)) return [];
    const info = statOf(path.join(v2, entry.name), io);
    return info ? [{ lineage: entry.name, info }] : [];
  });
}

const isStart = (value) =>
  value !== null && typeof value === 'object' && value.v === 1 && typeof value.lineage === 'string' && LINEAGE_ID.test(value.lineage) &&
  typeof value.at === 'string' && !Number.isNaN(Date.parse(value.at)) && (value.from === 'birthtime' || value.from === 'seen') &&
  typeof value.seenAt === 'string' && !Number.isNaN(Date.parse(value.seenAt));

/** The text of the starts file, `''` where it is not there; one that is there and cannot be read throws its code. */
function startsText(file, io) {
  try {
    return io.readFileSync(file, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return '';
    throw new Error(err?.code ?? err?.message ?? String(err));
  }
}

/** The whole lines of the starts text `text`: a torn line, or one of another shape, is left out. */
const startsOf = (text) =>
  text.split(/\r?\n/).flatMap((line) => {
    try {
      const parsed = JSON.parse(line);
      return isStart(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });

/** The lines of the starts file `file`, whole ones only: a torn line, or one of another shape, is left out. None where
 * the file is not there; one that is there and cannot be read throws its code, so a row says it was not read. */
export function readReviewStarts(file, { fileSystem: io = fs } = {}) {
  return startsOf(startsText(file, io));
}

/** Appends to the project's starts file one line `{ v, lineage, at, from, seenAt }` for each live lineage not recorded
 * yet, and says how many. A lineage is recorded by its id and birthtime, so an id used again after a burn is a new
 * start, even after a first start only seen, unless that sight came after this folder was born; one seen where no
 * birthtime is kept is recorded once, by its id. The file is read once a call, and the folder is made only to write a
 * line, so a project where no review ran gets none. Two sessions recording at once may both write a line: readers
 * keep one. */
export function recordReviewStarts({ commonDir, home, slug, now = Date.now(), platform = process.platform, fileSystem: io = fs }) {
  const live = liveLineages(commonDir, { fileSystem: io });
  if (live.length === 0) return 0;
  const file = reviewStartsFile(home, slug);
  const text = startsText(file, io);
  const kept = startsOf(text);
  const seenAt = iso(now);
  const lines = live.flatMap(({ lineage, info }) => {
    const start = startOf(info, now, platform);
    const same = kept.filter((one) => one.lineage === lineage);
    const recorded = start.from === 'seen'
      ? same.length > 0
      : same.some((one) => (one.from === 'birthtime' ? one.at === start.at : Date.parse(one.seenAt) >= Date.parse(start.at)));
    return recorded ? [] : [JSON.stringify({ v: 1, lineage, at: start.at, from: start.from, seenAt })];
  });
  if (lines.length === 0) return 0;
  io.mkdirSync(path.dirname(file), { recursive: true });
  // A line left without its newline (a writer stopped mid-line) is ended first, so the new line is whole.
  const unterminated = text !== '' && !text.endsWith('\n');
  io.appendFileSync(file, `${unterminated ? '\n' : ''}${lines.join('\n')}\n`, 'utf8');
  return lines.length;
}

/** The ends gentle-ai keeps, as `{ lineage, at }`: each terminal record of the store, at the record's birth (its
 * modification where no birthtime is kept; the file is written once). A record that does not parse, or is of another
 * schema, is left out; none where the store is not there. A lineage with a record is acknowledged only once its live
 * folder is gone, which the reader of these ends checks. */
export function readReviewEnds(commonDir, { fileSystem: io = fs } = {}) {
  const v1 = path.join(storeOf(commonDir), 'terminal-consumption', 'v1');
  return entriesOf(v1, io).flatMap((entry) => {
    if (!entry.isFile() || !entry.name.endsWith('.json')) return [];
    const file = path.join(v1, entry.name);
    let parsed;
    try {
      parsed = JSON.parse(io.readFileSync(file, 'utf8'));
    } catch {
      return [];
    }
    if (parsed?.schema !== TERMINAL_SCHEMA || typeof parsed.lineage !== 'string' || !LINEAGE_ID.test(parsed.lineage)) return [];
    const info = statOf(file, io);
    if (!info) return [];
    const at = info.birthtimeMs > 0 && info.birthtimeMs <= info.mtimeMs ? info.birthtimeMs : info.mtimeMs;
    return [{ lineage: parsed.lineage, at: iso(at) }];
  });
}

// The record of the double review (`rule:double-review`, odd/tasks/double-review-alignment.md, T3): one JSON line for
// each read, each judgement of a reader's findings and each skip the user asked for, in
// `<git common dir>/js-harness/double-reviews.jsonl`.
//
// It lives beside the review records, so every worktree of a clone shares it and deleting the one file undoes what
// this module writes. No push and no merge door reads it: a read of a plan covers no code, and a line here is no
// evidence that a code commit was reviewed. What it is for is the judgement of 2026-11-16, what each reader adds:
// `tallyOf` gives each reader its reads, its findings, the findings the writer took and those it alone found. Only
// `appendDoubleReview` and `readDoubleReviews` touch the file, through ./codex-reviews.mjs; the rest takes entries.
import { appendJsonLine, readJsonLines } from './codex-reviews.mjs';

export const DOUBLE_REVIEW_SCHEMA = 'js-harness.double-review/v1';
export const DOUBLE_REVIEWS_FILE = 'double-reviews.jsonl';
/** The two readers of a read: one of each model family. */
export const READERS = ['claude', 'codex'];
export const SEVERITIES = ['high', 'medium', 'low'];

/** Appends `entry`, stamped with the schema, as one line and returns the file's path; throws outside a repository. */
export function appendDoubleReview(root, entry, deps = {}) {
  return appendJsonLine(root, DOUBLE_REVIEWS_FILE, { schema: DOUBLE_REVIEW_SCHEMA, ...entry }, deps);
}

/** Every entry, oldest first; a line that is not a JSON object is skipped. */
export function readDoubleReviews(root, deps = {}) {
  return readJsonLines(root, DOUBLE_REVIEWS_FILE, deps);
}

const isRead = (entry) => entry?.schema === DOUBLE_REVIEW_SCHEMA && entry.kind === 'read' && typeof entry.id === 'string' && Array.isArray(entry.readers);
const isTake = (entry) => entry?.schema === DOUBLE_REVIEW_SCHEMA && entry.kind === 'take' && typeof entry.read === 'string' && READERS.includes(entry.reader);

/** The read `id` among `entries`, or `null`. */
export function readOf(entries, id) {
  return entries.findLast((entry) => isRead(entry) && entry.id === id) ?? null;
}

/** The findings `one` reader of a read gave: its list once it answered, else none. */
export function findingsOf(one) {
  return one?.outcome === 'answered' && Array.isArray(one.findings) ? one.findings : [];
}

/** Each reader's yield over the reads of `entries` on or after `since` (`YYYY-MM-DD`, every read when not given), in
 * the order of `READERS`, a reader with no read left out: `{ reader, reads, findings, judged, taken, alone }`. A
 * reader's findings in a read count once it answered; the writer's judgement is the last `take` of that read and
 * reader, and `alone` is what it took that the other reader did not also find (`shared`). */
export function tallyOf(entries, { since } = {}) {
  const reads = entries.filter((entry) => isRead(entry) && (since === undefined || String(entry.at).slice(0, 10) >= since));
  const takes = new Map();
  for (const entry of entries) if (isTake(entry)) takes.set(`${entry.read} ${entry.reader}`, entry);
  const rows = new Map();
  for (const read of reads) {
    for (const one of read.readers) {
      if (!READERS.includes(one?.reader)) continue;
      const row = rows.get(one.reader) ?? { reader: one.reader, reads: 0, findings: 0, judged: 0, taken: 0, alone: 0 };
      const findings = findingsOf(one).length;
      row.reads += 1;
      row.findings += findings;
      const take = takes.get(`${read.id} ${one.reader}`);
      if (take) {
        const taken = new Set((take.taken ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= findings));
        const shared = new Set(take.shared ?? []);
        row.judged += findings;
        row.taken += taken.size;
        row.alone += [...taken].filter((n) => !shared.has(n)).length;
      }
      rows.set(one.reader, row);
    }
  }
  return READERS.filter((reader) => rows.has(reader)).map((reader) => rows.get(reader));
}

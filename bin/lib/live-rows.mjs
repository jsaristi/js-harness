// The live board's rows (odd/tasks/live-board.md, S2-S3): each notice of the channel record as one row of the board
// page's `events` collection, cut into batches, and the cursor that says which rows were sent. A batch is one
// document, so the lead sends it with one `ArtifactData` set from a file. Rows are only ever created: a write to a
// document that exists needs the version it was read at, which no command can know, so a session's status is the
// state of its latest row, and the page works it out. The cursor's file and its forms live here too, since the reply
// Stop hook reads them (bin/lib/stale-board.mjs) and a module under bin/lib does not import a command.

import path from 'node:path';
import { channelDir } from './channel.mjs';

/** The schema of the cursor's file. */
export const CURSOR_SCHEMA = 'js-harness.live-cursor/v1';

// How long a check of the record holds on the board: the lead wakes on a notice or after the heartbeat's 30 quiet
// minutes (`loop heartbeat --quiet`), plus 15 to wake and send. A resting lead waits for a notice up to `wait-for`.
export const CHECK_MINUTES = 45;

/** The file of the live board's cursor for the project `slug` under `home`: in the channel's folder. */
export function liveCursorPath(home, slug) {
  return path.join(channelDir(home), 'live', `${slug}.json`);
}

/** The saved cursor: its position form, `{ upto, sent }`, or the form before it, `{ through, ids }`, which
 * `positionOf` places in the record once; `null` when there is none. */
export const cursorOf = (saved) => {
  if (Number.isSafeInteger(saved.upto) && Array.isArray(saved.sent)) return { upto: saved.upto, sent: saved.sent };
  return typeof saved.through === 'string' && Array.isArray(saved.ids) ? { through: saved.through, ids: saved.ids } : null;
};

/** What a notice of each kind says of its sender, as the board shows its status. */
export const STATES = {
  opened: 'working',
  note: 'working',
  answer: 'working',
  withdrawn: 'working',
  waiting: 'waiting',
  question: 'asking',
  ready: 'ready',
  closed: 'closed',
  relieved: 'relieved',
};

/** The rows one batch document holds at most: about 50 KB, far under what one document takes. */
export const BATCH_ROWS = 100;

/** The row of `notice`: `{ id, time, session, kind, text, state }`, with `pr` for a ready notice. `id` is the time and
 * the first eight characters of the sender's id, so the same notice gives the same row on every run. */
export function rowOf(notice) {
  const sender = typeof notice.from?.id === 'string' && notice.from.id !== '' ? notice.from.id.slice(0, 8) : null;
  const title = typeof notice.from?.title === 'string' && notice.from.title !== '' ? notice.from.title : null;
  const row = {
    id: `${notice.at}-${sender ?? 'unknown'}`,
    time: notice.at,
    session: title ?? (sender === null ? 'unknown session' : `session ${sender}`),
    kind: notice.kind,
    text: notice.text,
    state: STATES[notice.kind] ?? 'working',
  };
  return notice.kind === 'ready' ? { ...row, pr: notice.pr } : row;
}

/** The cursor in its position form, `{ upto, sent }`: every notice of the record below the index `upto` was sent,
 * and `sent` lists, in order, the indexes above it that were sent ahead of an earlier one. `notify` stamps a
 * notice's time before it appends it and other sessions append meanwhile, so the record's order is not its time's
 * order; the record is only ever appended to, so a notice's index never changes and the cursor goes by it. A cursor
 * of the form before, `{ through, ids }`, counts as sent the rows before its time and those it names, once: `rows`
 * are the record's rows (`pendingRows` with no cursor), which it needs to place them. */
export function positionOf(cursor, rows) {
  if (cursor === null || cursor === undefined) return null;
  if (Number.isSafeInteger(cursor.upto) && Array.isArray(cursor.sent)) return cursor;
  const through = Date.parse(cursor.through);
  const named = new Set(cursor.ids);
  return cursorAfter({ upto: 0, sent: [] }, rows.filter((row) => Date.parse(row.time) < through || named.has(row.id)));
}

/** The rows of `notices` the board has not been sent, oldest first, each with its index in the record (`seq`): with a
 * cursor, those it does not count as sent (`positionOf`); with none, those after `since`. Two rows that would share
 * an id (one sender, one millisecond) get `-2`, `-3` after it, in the record's order. */
export function pendingRows(notices, cursor, since) {
  const seen = new Map();
  const rows = [...notices]
    .map((notice, seq) => ({ notice, seq }))
    .sort((a, b) => Date.parse(a.notice.at) - Date.parse(b.notice.at) || a.seq - b.seq)
    .map(({ notice, seq }) => {
      const row = { ...rowOf(notice), seq };
      const count = (seen.get(row.id) ?? 0) + 1;
      seen.set(row.id, count);
      return count === 1 ? row : { ...row, id: `${row.id}-${count}` };
    });
  const position = positionOf(cursor, rows);
  if (position === null) return rows.filter((row) => Date.parse(row.time) > Date.parse(since));
  const sent = new Set(position.sent);
  return rows.filter((row) => row.seq >= position.upto && !sent.has(row.seq));
}

/** `rows` cut into batches of `BATCH_ROWS`: `[{ docId, time, rows }]`, each named by its last row and timed by it. */
export function batchesOf(rows) {
  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_ROWS) {
    const part = rows.slice(i, i + BATCH_ROWS);
    const last = part[part.length - 1];
    batches.push({ docId: last.id, time: last.time, rows: part });
  }
  return batches;
}

/** The cursor before anything was sent: the rows of the record (`pendingRows` with no cursor) at or before `since`
 * count as sent, so the first batch starts at the `--hours` window and the notices before it never come back. */
export function cursorFrom(rows, since) {
  return cursorAfter({ upto: 0, sent: [] }, rows.filter((row) => Date.parse(row.time) <= Date.parse(since)));
}

/** The cursor once `rows` were sent after `cursor` (position form, or none): their indexes join those sent, and
 * `upto` moves over every index sent with none missing below it. A batch sent ahead of an earlier one leaves the gap
 * pending until that one is sent. */
export function cursorAfter(cursor, rows) {
  const sent = new Set([...(cursor?.sent ?? []), ...rows.map((row) => row.seq)]);
  let upto = cursor?.upto ?? 0;
  while (sent.has(upto)) sent.delete(upto++);
  return { upto, sent: [...sent].filter((seq) => seq > upto).sort((a, b) => a - b) };
}

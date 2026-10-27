// The live board's rows (odd/tasks/live-board.md, S2-S3): each notice of the channel record as one row of the board
// page's `events` collection, cut into batches, and the cursor that says which rows were sent. A batch is one
// document, so the lead sends it with one `ArtifactData` set from a file. Rows are only ever created: a write to a
// document that exists needs the version it was read at, which no command can know, so a session's status is the
// state of its latest row, and the page works it out.

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

/** How far before the cursor's time a notice may still land: `notify` stamps a notice's time before it appends it, and
 * other sessions append meanwhile, so the record's order is not its time's order. The cursor holds every id it sent in
 * this window; a notice that lands later than this after one already sent is lost to the board. */
export const LATE_MS = 30 * 60 * 1000;

const timeOfId = (id) => Date.parse(id.slice(0, id.indexOf('Z') + 1));

/** The rows of `notices` the board has not been sent, oldest first: those after the cursor's time, and those within
 * LATE_MS before it whose id it does not hold. With no cursor, those after `since`. Two rows that would share an id
 * (one sender, one millisecond) get `-2`, `-3` after it, in the record's order. */
export function pendingRows(notices, cursor, since) {
  const seen = new Map();
  const rows = [...notices]
    .map((notice, order) => ({ notice, order }))
    .sort((a, b) => Date.parse(a.notice.at) - Date.parse(b.notice.at) || a.order - b.order)
    .map(({ notice }) => {
      const row = rowOf(notice);
      const count = (seen.get(row.id) ?? 0) + 1;
      seen.set(row.id, count);
      return count === 1 ? row : { ...row, id: `${row.id}-${count}` };
    });
  if (cursor === null || cursor === undefined) return rows.filter((row) => Date.parse(row.time) > Date.parse(since));
  const through = Date.parse(cursor.through);
  const sent = new Set(cursor.ids);
  return rows.filter((row) => Date.parse(row.time) > through - LATE_MS && !sent.has(row.id));
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

/** The cursor once `rows` were sent after `cursor`: the latest time, and every id sent within LATE_MS before it,
 * oldest first. A batch sent after a later one never moves the time back. */
export function cursorAfter(cursor, rows) {
  if (rows.length === 0) return cursor;
  const last = rows.reduce((latest, row) => (Date.parse(row.time) > Date.parse(latest) ? row.time : latest), rows[0].time);
  const through = cursor && Date.parse(cursor.through) >= Date.parse(last) ? cursor.through : last;
  const ids = [...new Set([...(cursor?.ids ?? []), ...rows.map((row) => row.id)])]
    .filter((id) => timeOfId(id) > Date.parse(through) - LATE_MS)
    .sort((a, b) => timeOfId(a) - timeOfId(b) || a.localeCompare(b));
  return { through, ids };
}

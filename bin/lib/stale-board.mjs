// The stale-board check of the reply Stop hook (odd/tasks/visual-pages.md, spec 3, T4): the lead of a project with a
// live board, ending its turn while rows of the channel record have waited longer than one check of the board holds,
// is turned back once, with the count, the oldest row's time, the board's link and the commands that send them.
//
// Why. The board gets rows only when the lead runs `sessions live` and sends what it prints. On 2026-10-28 the lead
// moved to another session and 121 rows waited at 23:15Z; the user read the board as deleted and old. The Stop hook
// runs at every reply of every session where the reply check is on, a new or compacted lead included, which the
// resume and the heartbeat do not; a reply is shown when the hook runs, so this reminds, it does not prevent, and a
// record it cannot read lets the stop through.
//
// The lead is the session whose newest notice in the channel record, by its id, carries an orchestrator's title (or a
// handover's `ORQ nueva`): a session that sent no notice is not taken for one. "Once" is read from the transcript, as
// the wake check reads its own (bin/lib/stop-wake.mjs): a warning that names the same oldest row is not given again,
// and a newer oldest row (the lead sent some) is warned again.

import { readNotices } from './channel.mjs';
import { harnessHome } from './home.mjs';
import { CHECK_MINUTES, CURSOR_SCHEMA, cursorOf, liveCursorPath, pendingRows } from './live-rows.mjs';
import { mainCheckout, projectSlug, roleOfTitle, sameSession } from './sessions.mjs';
import { lastLineWith } from './stop-wake.mjs';

/** The words only this warning has, by which an earlier one is found in the transcript. */
export const STALE_MARKER = 'rows of the channel record wait for the live board';

// With no cursor saved, `sessions live` sends the rows of the last 24 hours: the same window counts here.
const FIRST_WINDOW_MS = 24 * 3600_000;

// A handover names the arriving orchestrator `ORQ nueva`, which `roleOfTitle` reads as no title of the role.
const HANDOVER = /^\S+ ORQ nueva · /;

/** Whether `title` is the lead's: an orchestrator's, or the arriving one of a handover. */
export const isLeadTitle = (title) => roleOfTitle(title)?.role === 'orchestrator' || (typeof title === 'string' && HANDOVER.test(title));

/** The title on the newest notice the session `sessionId` sent in `notices`, or `null` when it sent none. */
function lastTitleOf(notices, sessionId) {
  let newest = null;
  for (const notice of notices) {
    if (!sameSession(sessionId, notice.from?.id)) continue;
    const at = Date.parse(notice.at ?? '');
    if (Number.isNaN(at) || (newest !== null && at < newest.at)) continue;
    newest = { at, title: notice.from?.title ?? null };
  }
  return newest?.title ?? null;
}

/** Whether the session `sessionId` is the lead by `notices`: the newest notice it sent carries the lead's title. The
 * return check asks it too (bin/lib/return-report.mjs). */
export const isLeadSession = (notices, sessionId) => isLeadTitle(lastTitleOf(notices, sessionId));

/** The saved cursor of the board, `null` when the project has none (no file, or one of another schema, which
 * `sessions live` reads as none too); one that is there and cannot be read throws. */
function savedBoard(file, readFile) {
  let text;
  try {
    text = readFile(file);
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw new Error(`the live board's cursor (${file}): ${err?.code ?? err?.message}`);
  }
  try {
    const saved = JSON.parse(text);
    return saved?.schema === CURSOR_SCHEMA ? saved : null;
  } catch (err) {
    throw new Error(`the live board's cursor (${file}) is not JSON (${err.message})`);
  }
}

const hhmm = (iso) => new Date(iso).toISOString().slice(11, 16);

/** The warning for a stop of `payload` whose reply closes with `state`, or `null` when none is due. The records are
 * read through `io` (`readFile`, `run`, `env`, `homedir`, and `readNotices` when the hook shares one parse of the record) at the time `now` (ms); one that cannot be read throws, and
 * the hook says so. */
export function staleBoardWarning(payload, state, io, now = Date.now()) {
  // Codex sends no background tasks, and cannot send a row: no command reaches an artifact's database.
  if (!Array.isArray(payload?.background_tasks)) return null;
  // A decision or a question is read by the person first.
  if (state === 'decision' || state === 'question') return null;
  if (typeof payload.session_id !== 'string' || payload.session_id === '') return null;

  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
  const home = harnessHome({ env: io.env, homedir: io.homedir });
  // The hook finds the project once a stop and from the files when it can (`io.mainCheckout`, bin/reply.mjs).
  const slug = projectSlug(io.mainCheckout?.(cwd) ?? mainCheckout(io.run, cwd));
  const saved = savedBoard(liveCursorPath(home, slug), io.readFile);
  if (saved === null || typeof saved.url !== 'string' || saved.url === '') return null;
  // One parse of the record for every check of the stop when the hook shares it (`io.readNotices`, bin/reply.mjs).
  const record = (io.readNotices ?? readNotices)(home, slug, { readFile: io.readFile });
  if (record.unavailable !== undefined) throw new Error(`the record of notices (${record.path}): ${record.unavailable}`);
  if (!isLeadSession(record.notices, payload.session_id)) return null;

  const rows = pendingRows(record.notices, cursorOf(saved), new Date(now - FIRST_WINDOW_MS).toISOString());
  if (rows.length === 0) return null;
  const oldest = rows[0];
  if (now - Date.parse(oldest.time) <= CHECK_MINUTES * 60_000) return null;

  const named = `(oldest ${oldest.id})`;
  if (typeof payload.transcript_path === 'string' && payload.transcript_path !== '') {
    const text = io.readFile(payload.transcript_path);
    const warned = lastLineWith(text, named, (entry) => entry.type === 'attachment'
      && entry.attachment?.type === 'hook_blocking_error'
      && entry.attachment.hookEvent === 'Stop'
      && String(entry.attachment.blockingError?.blockingError ?? '').includes(`${STALE_MARKER} ${named}`));
    if (warned !== null) return null;
  }
  return `js-harness reply: ${rows.length} ${STALE_MARKER} ${named}, the oldest since ${hhmm(oldest.time)} UTC, `
    + `longer than one check holds (${CHECK_MINUTES} min): ${saved.url} shows the record as it was then. Send them: `
    + '`js-harness sessions live --out <dir>`, each `ArtifactData` set it prints with each row\'s Spanish `sesion` and `texto` '
    + 'added, then `js-harness sessions live --sent <file>` for each file sent. This is said once for these rows.';
}

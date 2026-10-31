// The wake check of the reply Stop hook, A(a) of the throughput plan (odd/tasks/wake-and-flag.md, T2, S2): a work
// session that ends its turn holding work the orchestrator handed it, with nothing in the background to wake it, is
// turned back once, with the wait to arm.
//
// Why. Over two days, 31 turn ends were followed by more than 30 minutes of silence with no background task (64.4
// session-hours, an upper bound): a session ended its turn with work in hand and nothing that would bring it back
// when a notice or a land came. Its own end of turn is the one moment such a session can still be told.
//
// What wakes a session is the end of any of its background tasks, or a cron of its own, so anything of either kind
// that runs counts as armed, not only a `js-harness wait`. Work is handed as the stall board reads it
// (`handedNumber`, an opening), but given back only by the session's own `closed` or `relieved`: a session that sent
// `waiting` still arms a wait (the work-session skill), so here it still holds the work. A number is reused by later
// sessions, so a handing from before the session's transcript began is another session's, except the opening the
// session read: an opening is always stored before its session starts.
//
// "Once" is read from the transcript, since the hook writes nothing: the host records each block of a `Stop` hook as
// a `hook_blocking_error` attachment, and a block that holds `WAKE_MARKER` after the newest handing is the warning
// already given, unless a background task was launched after it (a wait armed since, and ended). The transcript is
// searched from its end for those few lines and only they are parsed: parsing a large one whole takes seconds, more
// than the hook's timeout allows.

import { readNotices } from './channel.mjs';
import { isSelf, mainCheckout, projectSlug, roleOfTitle, sameSession, titleRead } from './sessions.mjs';
import { handedNumber, readOpenings, workNumber } from './stall.mjs';
import { harnessHome } from './home.mjs';

/** The words only this warning has, by which an earlier one is found in the transcript. */
export const WAKE_MARKER = 'nothing will wake this session';

// The kinds by which a session gives its work back to the orchestrator, for this check.
const GIVEN_BACK = new Set(['closed', 'relieved']);

const timeOf = (iso) => {
  const at = Date.parse(iso ?? '');
  return Number.isNaN(at) ? null : at;
};

const pad = (n) => String(n).padStart(2, '0');

// How much of the text one step of `lastLineWith` searches, from the end back. `lastIndexOf` walks a string about three
// times slower than `indexOf` (an absent needle in the lead's 60 MB transcript: 115 ms against 39 ms, Node 24.15,
// odd/tasks/reply-hook-latency.md), so the text is searched forwards a window at a time, newest window first: a needle
// near the end costs one window, an absent one a forward pass.
const SEARCH_WINDOW = 1 << 20;

/** The newest line of `text` that holds `needle` and whose parsed entry `accept` takes: `{ entry, start }`, `start`
 * its position in `text`, or `null`. Lines that are not JSON are passed over. */
export function lastLineWith(text, needle, accept) {
  // Only a needle that starts before `before` is still to be read: the lines from there on are judged.
  let before = text.length;
  while (before > 0) {
    const from = Math.max(0, before - SEARCH_WINDOW);
    // The window reaches past `before` by the needle's length less one, so a needle that starts in it is whole.
    const window = text.slice(from, Math.min(text.length, before + needle.length - 1));
    const hits = [];
    for (let at = window.indexOf(needle); at >= 0; at = window.indexOf(needle, at + 1)) hits.push(from + at);
    for (let i = hits.length - 1; i >= 0; i -= 1) {
      if (hits[i] >= before) continue;
      const start = text.lastIndexOf('\n', hits[i]) + 1;
      const end = text.indexOf('\n', hits[i]);
      let entry = null;
      try {
        entry = JSON.parse(text.slice(start, end < 0 ? undefined : end));
      } catch {
        // A torn or quoted line is no entry.
      }
      if (entry !== null && accept(entry)) return { entry, start };
      before = start;
    }
    before = Math.min(before, from);
  }
  return null;
}

/** When the transcript `text` began (ms), read from its first entries, or `null`. */
const firstAtIn = (text) => {
  const first = /"timestamp":"([^"]+)"/.exec(text.slice(0, 64 * 1024));
  return first === null ? null : timeOf(first[1]);
};

/** The newest title the transcript `text` was given, or `null`. */
const titleIn = (text) => lastLineWith(text, '"custom-title"', (entry) => entry.type === 'custom-title' && typeof entry.customTitle === 'string')?.entry.customTitle ?? null;

/** What the transcript `text` says for the check: when it began (`firstAt`, ms), the title it was given, the newest
 * warning of this check (`warnedAt`, ms, and `warnedPos`) and the position of its newest background launch. */
export function transcriptMarks(text) {
  const warning = lastLineWith(text, WAKE_MARKER, (entry) => entry.type === 'attachment'
    && entry.attachment?.type === 'hook_blocking_error'
    && entry.attachment.hookEvent === 'Stop'
    && String(entry.attachment.blockingError?.blockingError ?? '').includes(WAKE_MARKER));
  const launch = lastLineWith(text, '"run_in_background":true', (entry) => entry.type === 'assistant'
    && Array.isArray(entry.message?.content)
    && entry.message.content.some((block) => block?.type === 'tool_use' && block.input?.run_in_background === true));
  // A call that outlived its timeout is moved to the background by the host, which says so in its result.
  const moved = lastLineWith(text, '"backgroundTaskId"', (entry) => typeof entry.toolUseResult?.backgroundTaskId === 'string');
  const launches = [launch?.start, moved?.start].filter((at) => at !== undefined);
  return {
    firstAt: firstAtIn(text),
    title: titleIn(text),
    warnedAt: warning === null ? null : timeOf(warning.entry.timestamp),
    warnedPos: warning?.start ?? null,
    launchPos: launches.length === 0 ? null : Math.max(...launches),
  };
}

/** The newest work handed to the work session `number` at or after `sinceMs` and not given back since:
 * `{ at, what: 'notice' | 'opening', kind }`, or `null`. An opening is stored before its session starts, so one whose
 * title is in `readTitles` (the openings this session read) is its work whenever it was stored. `sessionId` is the id of
 * the session asking, whose own close gives the work back whatever title it carries. */
export function heldWork({ notices = [], openings = [], number, sinceMs = -Infinity, readTitles = [], sessionId = null }) {
  let handed = null;
  const consider = (at, what, kind, ours = false) => {
    if (at !== null && (ours || at >= sinceMs) && (handed === null || at > handed.at)) handed = { at, what, kind };
  };
  for (const notice of notices) if (handedNumber(notice) === number) consider(timeOf(notice.at), 'notice', notice.kind ?? null);
  for (const opening of openings) if (workNumber(opening.title) === number) consider(timeOf(opening.at), 'opening', null, readTitles.includes(opening.title));
  if (handed === null) return null;
  // A notice gives the work back when its sender's title names the number, or when its sender is this very session
  // (`sessionId`): notify writes a null title when it cannot find the sender's transcript, and JH 30's close carried
  // one (2026-10-20). The id is the host's, not words a session writes, so it is read, never the text's `JH 30:`.
  const ours = (notice) => workNumber(notice.from?.title) === number || sameSession(sessionId, notice.from?.id);
  const back = notices.some((notice) => ours(notice) && GIVEN_BACK.has(notice.kind) && timeOf(notice.at) >= handed.at);
  return back ? null : handed;
}

/** The warning for a stop of `payload` whose reply closes with `state`, or `null` when none is due. The records are
 * read through `io` (`readFile`, `readdir`, `run`, `env`, `homedir`, and `readNotices` when the hook shares one parse of the record); one that cannot be read throws, and the hook says so. */
export function wakeWarning(payload, state, io) {
  // Codex sends no background tasks: it cannot say that nothing runs.
  if (!Array.isArray(payload?.background_tasks)) return null;
  if (payload.background_tasks.some((task) => task?.status === 'running')) return null;
  if (Array.isArray(payload.session_crons) && payload.session_crons.length > 0) return null;
  // A decision or an open question is asked of the person in the chat, whose answer is what wakes the session.
  if (state === 'decision' || state === 'question') return null;
  if (typeof payload.transcript_path !== 'string' || payload.transcript_path === '') return null;

  const text = io.readFile(payload.transcript_path);
  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
  const home = harnessHome({ env: io.env, homedir: io.homedir });
  // The hook finds the project once a stop and from the files when it can (`io.mainCheckout`, bin/reply.mjs).
  const slug = projectSlug(io.mainCheckout?.(cwd) ?? mainCheckout(io.run, cwd));
  // The hook hands its checks one parse of the record (`io.readNotices`, bin/reply.mjs); alone, the check reads it.
  const record = (io.readNotices ?? readNotices)(home, slug, { readFile: io.readFile });
  if (record.unavailable !== undefined) throw new Error(`the record of notices (${record.path}): ${record.unavailable}`);
  // The title and the transcript's start are read from its two ends; the whole transcript is searched only for a work
  // session that holds work, since the lead's stops are most stops and hold none (odd/tasks/reply-hook-latency.md).
  const title = titleIn(text) ?? titleRead(record.readings, payload.session_id);
  const role = roleOfTitle(title);
  if (role?.role !== 'work') return null;
  const { openings, unavailable } = readOpenings(home, slug, { readdirSync: io.readdir, readFileSync: (file) => io.readFile(file) });
  if (unavailable) throw new Error(unavailable);
  const held = heldWork({ notices: record.notices, openings, number: role.number, sinceMs: firstAtIn(text) ?? -Infinity, sessionId: payload.session_id ?? null,
    readTitles: record.readings.filter((reading) => isSelf(payload.session_id, reading.reader?.id)).map((reading) => reading.title) });
  if (held === null) return null;
  const marks = transcriptMarks(text);
  const warnedSince = marks.warnedAt !== null && marks.warnedAt >= held.at;
  const launchedAfter = marks.launchPos !== null && marks.warnedPos !== null && marks.launchPos > marks.warnedPos;
  if (warnedSince && !launchedAfter) return null;

  const when = new Date(held.at);
  const what = held.what === 'opening' ? 'your opening' : `its notice of kind ${held.kind}`;
  return `js-harness reply: you hold work the orchestrator handed you (${what} at ${pad(when.getHours())}:${pad(when.getMinutes())} local) `
    + `and nothing runs in your background, so ${WAKE_MARKER} when a notice or a land comes. `
    + `Arm a wait in the background, \`js-harness wait --notice-to ${role.number}\` (it ends on any notice to ${role.number}), `
    + 'or, when the work is done, give it back with `js-harness notify --to orchestrator --kind closed --summary <file> "<what was done>"`, '
    + 'the file your summary is in (`js-harness summary template`), committed and pushed.';
}

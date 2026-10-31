// What the resume after a compaction (`resume --hook`, bin/resume.mjs) reads from the channel's record beside its
// questions: the work sessions waiting on the lead (odd/tasks/refresh-open-apply.md, T3). On 2026-10-31 JH 114 sent
// `waiting` at 03:06Z, the host compacted the lead minutes later, and the resume named the open questions and the
// background tasks but not the session waiting on it, which sat 50 minutes (docs/FAILURES.md,
// compaction-dropped-waiting). Also the two text helpers the resume's question lines share with these lines, moved here
// from bin/resume.mjs, which is at its size ceiling. Zero dependencies.
import { roleOfTitle } from './sessions.mjs';

// How many characters of a waiting notice's text a line prints.
const WAITING_LISTED = 300;

/** `12m ago`, `5h ago`, `3d ago`: how long before `now` the time `ms` was. */
export function ago(ms, now) {
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/** A text cut to `max` characters, as the reply's cut counts them, so a cut never splits a character; with an ellipsis at
 * its end when it was longer. */
export const cutTo = (text, max) => {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
};

/** The lines that name each work session whose newest notice in `record` (`readNotices`) is `waiting`, with its text and
 * how long it has waited (`now`, ms), the one waiting longest first; none when no session is waiting, or when the record
 * could not be read, which the questions' lines already say. A session is the work number its sender's title names
 * (`roleOfTitle`), as the lead addresses it; its newest notice is the newest by time, then by the order written, as the
 * board reads a session's last state. A notice to a work session is not one to the lead, and is not counted. */
export function waitingLinesOf(record, now) {
  if (record.unavailable !== undefined) return [];
  const newest = new Map();
  for (const notice of record.notices) {
    const role = roleOfTitle(notice.from?.title);
    if (role?.role !== 'work' || notice.to?.role !== 'orchestrator') continue;
    const kept = newest.get(role.number);
    if (kept === undefined || !(Date.parse(notice.at) < Date.parse(kept.at))) newest.set(role.number, notice);
  }
  const waiting = [...newest].filter(([, notice]) => notice.kind === 'waiting').sort(([, one], [, other]) => Date.parse(one.at) - Date.parse(other.at));
  if (waiting.length === 0) return [];
  return [
    `Work sessions whose newest notice in the record is waiting (${waiting.length}), each waiting on this session:`,
    ...waiting.map(([number, notice]) => `  JH ${number} ${JSON.stringify(notice.from.title)}  waiting since ${ago(Date.parse(notice.at), now)}: ${cutTo(notice.text.replace(/\s+/g, ' ').trim(), WAITING_LISTED)}`),
    'Answer each, or start what it waits for, before other work; the board shows each one: js-harness sessions',
  ];
}

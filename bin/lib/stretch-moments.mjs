// What a stretch's return says of the plan as a whole (odd/tasks/visual-pages.md): the shares of the planned that
// were met, the work sessions that ran outside the plan, and the stretch's timeline. A share is `{ met, of, unknown }`
// with its denominator said: what no record measured is `unknown`, and a share none of which is known has `met: null`,
// never a zero. Pure: the stretch's checks, items, notices, merges and failures in, data out; `bin/stretch.mjs` reads
// them.
import { roleOfTitle } from './sessions.mjs';

const ms = (iso) => Date.parse(iso);
const share = (met, of, unknown) => ({ met: of > 0 && unknown === of ? null : met, of, unknown });

/** The goals' shares from every goal check of the stretch (`checks`, oldest or newest first) and its return time:
 * `met`, of all goals, those its last check found met, a goal never checked unknown; `inTime`, of the goals met, those
 * the first check that found them met ran at or before `returnAt`; a met goal with no check at or before it is
 * unknown, so a stretch whose goals ran only after the return does not read as late. */
export function goalShares(goals, checks, returnAt) {
  const ordered = [...checks].sort((a, b) => ms(a.at) - ms(b.at));
  const resultsOf = (id) => ordered.flatMap((one) => one.goals.filter((goal) => goal.id === id).map((goal) => ({ at: ms(one.at), met: goal.met === true })));
  let met = 0;
  let unknown = 0;
  let inTime = 0;
  let inTimeUnknown = 0;
  for (const goal of goals) {
    const results = resultsOf(goal.id);
    if (results.length === 0) {
      unknown += 1;
      continue;
    }
    if (!results.at(-1).met) continue;
    met += 1;
    const firstMet = results.find((result) => result.met);
    if (firstMet.at <= returnAt) inTime += 1;
    else if (!results.some((result) => result.at <= returnAt)) inTimeUnknown += 1;
  }
  return { met: share(met, goals.length, unknown), inTime: share(inTime, met, inTimeUnknown) };
}

/** The work done: of the items that do not wait for the user, those `finished`; `others` the rest by state, and
 * `waiting` the items that wait for the user, out of the count. */
export function workShare(items) {
  const counted = items.filter((item) => !item.waitsFor);
  const others = {};
  for (const item of counted) {
    if (item.state === 'finished') continue;
    (others[item.state] ??= []).push(item.id);
  }
  return { met: counted.filter((item) => item.state === 'finished').length, of: counted.length, unknown: 0, others, waiting: items.filter((item) => item.waitsFor).map((item) => item.id) };
}

/** A notice's work session label, `JH 72`, from its title; `null` for the lead's, an untitled one, or another shape. */
function workLabel(title) {
  const role = roleOfTitle(title);
  return role?.role === 'work' ? `${role.code} ${role.number}` : null;
}

/** The work sessions outside the plan: those whose first notice in the record falls inside the stretch (`from` to
 * `to`, milliseconds) and whose label no item holds, each `{ label, title, first, last, notices }` with its notices
 * inside the stretch; `untitled`, the notices inside it whose sender has no title, counted apart. The lead's notices
 * are not work and are left out. A count, not a share: nothing planned them, so nothing is their denominator. */
export function outsidePlan(notices, items, { from, to }) {
  const planned = new Set(items.map((item) => item.session).filter(Boolean));
  const firstOf = new Map();
  const inside = new Map();
  let untitled = 0;
  for (const notice of [...notices].sort((a, b) => ms(a.at) - ms(b.at))) {
    const at = ms(notice.at);
    const title = notice.from?.title;
    if (typeof title !== 'string' || title === '') {
      if (at > from && at <= to) untitled += 1;
      continue;
    }
    const label = workLabel(title);
    if (label === null) continue;
    if (!firstOf.has(label)) firstOf.set(label, at);
    if (!(at > from && at <= to)) continue;
    const seen = inside.get(label) ?? { label, title, first: notice.at, last: notice.at, notices: 0 };
    seen.last = notice.at;
    seen.notices += 1;
    inside.set(label, seen);
  }
  const sessions = [...inside.values()].filter((one) => !planned.has(one.label) && firstOf.get(one.label) > from);
  return { sessions, untitled };
}

// The notices that change what a session is doing; a `note` is the board's, not the timeline's.
const TIMELINE_NOTICES = new Set(['opened', 'ready', 'closed', 'waiting', 'question', 'answer']);

/** The stretch's timeline, oldest first and cut to `from`..`to`: each row `{ at, type, ... }`, `type` one of `merge`
 * (with `pr`, `branch`), a notice kind (with `who`, `text`), `failure` (with `who`, `what`, `seconds`), or the
 * stretch's own `open`, `check` (with `met` and `of`) and `close`. */
export function timelineOf({ from, to, prs = [], notices = [], failures = [], events = [] }) {
  const inside = (iso) => ms(iso) >= from && ms(iso) <= to;
  const rows = [
    ...prs.filter((one) => inside(one.at)).map((one) => ({ at: one.at, type: 'merge', pr: one.number, branch: one.branch, subject: one.subject ?? null })),
    ...notices.filter((one) => TIMELINE_NOTICES.has(one.kind) && inside(one.at)).map((one) => ({ at: one.at, type: one.kind, who: one.from?.title ?? one.from?.id ?? null, text: one.text, ...(one.pr ? { pr: one.pr } : {}) })),
    ...failures.filter((one) => inside(one.at)).map((one) => ({ at: one.at, type: 'failure', who: one.who ?? null, what: one.what, seconds: one.seconds })),
    ...events.filter((one) => ['open', 'check', 'close'].includes(one.event) && inside(one.at)).map((one) => (one.event === 'check' ? { at: one.at, type: 'check', met: one.goals.filter((goal) => goal.met).length, of: one.goals.length } : { at: one.at, type: one.event })),
  ];
  return rows.map((row) => ({ ...row, at: new Date(row.at).toISOString() })).sort((a, b) => ms(a.at) - ms(b.at));
}

// Which work sessions hold handed work and have gone quiet (odd/tasks/stalled-sessions.md, S2).
//
// Work is handed to a session by the orchestrator's notice addressed to its number, or by its opening (only the
// orchestrator hands work: a peer's note informs, and `js-harness wake` writes to every number); it is given back by
// the session's own `waiting`, `closed` or `relieved` notice. A note does not give it back: "PR ready" and
// "on it" are both notes, and no program can tell them apart. While a session holds work, its quiet starts
// at the latest thing it did: the handed notice, its own newest notice, its newest gate (by the session id
// the gate recorded: several sessions share a checkout, so a folder tells nobody's gate apart), its worktree's
// newest commit of its own. Every source is a record the harness already writes, so the lead's heartbeat can ask this
// every two minutes without reading a transcript.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { OPENING_SCHEMA, openingsDir, readNotices } from './channel.mjs';
import { readGateLog } from './gate-log.mjs';
import { roleOfTitle } from './sessions.mjs';

const GIVEN_BACK = new Set(['waiting', 'closed', 'relieved']);

// The events of the gate log that a gate writes as it runs, or is refused, stopped or proven by another's tree.
const GATE_EVENTS = new Set(['start', 'end', 'refused', 'stopped', 'same']);

const timeOf = (iso) => {
  const at = Date.parse(iso ?? '');
  return Number.isNaN(at) ? null : at;
};

/** The number of the work session a title names, or `null` for any other title. */
export const workNumber = (title) => {
  const role = roleOfTitle(title);
  return role?.role === 'work' ? role.number : null;
};

/** The number of the work session `notice` hands work to, or `null`: only the orchestrator hands work, by a notice
 * addressed to the session's number. */
export const handedNumber = (notice) => (
  notice?.to?.role === 'work' && Number.isSafeInteger(notice.to.number) && roleOfTitle(notice.from?.title)?.role === 'orchestrator'
    ? notice.to.number
    : null
);

/** Who ran each gate event and when: `{ at, session }`, an end taking the session of its start, since only a start
 * (and a refusal, a stop, a same) writes it. A gate that recorded no session is left out. */
function gateActs(gates) {
  const started = new Map();
  const acts = [];
  for (const event of gates) {
    const at = timeOf(event.at);
    if (at === null) continue;
    // A ticket's events (`first-*`) name the session the ticket is for, which did nothing by being given one.
    if (!GATE_EVENTS.has(event.event)) continue;
    if (event.event === 'start') started.set(event.id, event);
    const said = event.event === 'end' ? started.get(event.id) : event;
    if (typeof said?.session === 'string') acts.push({ at, session: said.session });
  }
  return acts;
}

/** The newest of `items` by `at` (ms), or `null`. */
const newest = (items) => items.reduce((best, item) => (best === null || item.at >= best.at ? item : best), null);

/**
 * The work sessions that hold handed work and have been quiet for `limitMs` or more at `now`, the longest
 * quiet first: `[{ number, title, ids, quietSince, quietMs, holding, worktree, branch }]`. A session quiet for longer
 * than `windowMs` has left the board's window (`sessions --hours`) and is ended in all but its word: it is not listed.
 *
 * - `notices`: the channel's notices (`readNotices`), in any order.
 * - `openings`: `[{ title, at, from, text }]`, every opening of the project.
 * - `readings`: the record's readings of an opening (`readNotices`), which give a session's id before its first notice.
 * - `gates`: the gate log's events (`readGateLog`).
 * - `commitAt(worktree, branch)`: the time (ms) of the newest commit of the session's worktree that the default
 *   branch does not hold (`branchCommitAt`), or `null`: the lead's merges into a shared checkout are not its work.
 *   It is asked only for a session that is quiet by everything else, so a busy board costs no git read.
 *
 * `holding` is what was handed last: `{ what: 'notice' | 'opening', at, from, kind, text }`.
 */
export function stalledSessions({ notices = [], openings = [], readings = [], gates = [], commitAt = () => null, now, limitMs, windowMs = Infinity }) {
  const sessions = new Map();
  const of = (number) => {
    if (!sessions.has(number)) sessions.set(number, { number, title: null, titledAt: null, ids: new Set(), own: [], handed: [] });
    return sessions.get(number);
  };
  for (const notice of notices) {
    const at = timeOf(notice.at);
    if (at === null) continue;
    const from = workNumber(notice.from?.title);
    if (from !== null) {
      const session = of(from);
      if (session.titledAt === null || at >= session.titledAt) {
        session.title = notice.from.title;
        session.titledAt = at;
      }
      if (typeof notice.from.id === 'string' && notice.from.id !== '') session.ids.add(notice.from.id);
      session.own.push({ at, notice });
    }
    if (handedNumber(notice) !== null) {
      of(notice.to.number).handed.push({ at, holding: { what: 'notice', at: notice.at, from: notice.from?.title ?? null, kind: notice.kind ?? null, text: notice.text ?? '' } });
    }
  }
  for (const opening of openings) {
    const at = timeOf(opening.at);
    const number = workNumber(opening.title);
    if (at === null || number === null) continue;
    const session = of(number);
    if (session.titledAt === null) session.title = opening.title;
    session.handed.push({ at, holding: { what: 'opening', at: opening.at, from: opening.from?.title ?? null, kind: null, text: opening.text ?? '' } });
  }

  // A session that read its opening is known by that reading's id before it sends a notice: its gates are its own.
  for (const reading of readings) {
    const number = workNumber(reading.title);
    if (number !== null && sessions.has(number) && typeof reading.reader?.id === 'string' && reading.reader.id !== '') sessions.get(number).ids.add(reading.reader.id);
  }
  const acts = gateActs(gates);
  const found = [];
  for (const session of sessions.values()) {
    const handed = newest(session.handed);
    if (handed === null) continue;
    const back = newest(session.own.filter(({ notice }) => GIVEN_BACK.has(notice.kind)));
    if (back !== null && back.at >= handed.at) continue;
    const ownNewest = newest(session.own);
    const placed = newest(session.own.filter(({ notice }) => typeof notice.worktree === 'string'));
    const worktree = placed?.notice.worktree ?? null;
    const branch = typeof placed?.notice.branch === 'string' ? placed.notice.branch : null;
    const ran = acts.filter((act) => session.ids.has(act.session));
    let since = Math.max(handed.at, ownNewest?.at ?? -Infinity, newest(ran)?.at ?? -Infinity);
    if (now - since < limitMs) continue;
    if (worktree !== null) {
      const committed = commitAt(worktree, branch);
      if (Number.isFinite(committed)) since = Math.max(since, committed);
      if (now - since < limitMs) continue;
    }
    if (now - since > windowMs) continue;
    found.push({
      number: session.number,
      title: session.title,
      ids: [...session.ids],
      quietSince: new Date(since).toISOString(),
      quietMs: now - since,
      holding: handed.holding,
      worktree,
      branch,
    });
  }
  return found.sort((one, other) => other.quietMs - one.quietMs || one.number - other.number);
}

// A git that hangs on a lock costs the heartbeat its tick, never the whole loop.
const GIT_TIMEOUT_MS = 10 * 1000;
const runGit = (command, args) => spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: GIT_TIMEOUT_MS });

/** The time (ms) of the newest commit of `worktree`'s HEAD that the default branch does not hold, or `null` when it
 * has none or git cannot say. The default branch is origin's HEAD, or `origin/main` in a clone that never set it. */
export function branchCommitAt(worktree, { run = runGit } = {}) {
  for (const base of ['origin/HEAD', 'origin/main']) {
    const asked = run('git', ['-C', worktree, 'log', '-1', '--format=%cI', 'HEAD', '--not', base, '--']);
    if (asked.error) return null;
    if (asked.status !== 0) continue;
    return timeOf(String(asked.stdout ?? '').trim());
  }
  return null;
}

/** Every opening of the project `slug` under `home`: `{ openings: [{ title, at, from, text }], unavailable? }`. A file
 * that is not an opening (torn, or another schema) is left out; a folder that cannot be listed says why. */
export function readOpenings(home, slug, io) {
  const dir = openingsDir(home, slug);
  let names;
  try {
    names = io.readdirSync(dir);
  } catch (err) {
    return err.code === 'ENOENT' ? { openings: [] } : { openings: [], unavailable: `the openings (${dir}): ${err.code ?? err.message}` };
  }
  const openings = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    let stored;
    try {
      stored = JSON.parse(io.readFileSync(path.join(dir, name), 'utf8'));
    } catch {
      continue;
    }
    if (stored?.schema === OPENING_SCHEMA && typeof stored.title === 'string') openings.push({ title: stored.title, at: stored.at ?? null, from: stored.from ?? null, text: typeof stored.text === 'string' ? stored.text : '' });
  }
  return { openings };
}

/** `stalledSessions` on the records of `home` for the project `slug`: `{ stalled, unavailable }`, `unavailable` naming
 * each record that could not be read, so that "could not look" is never read as "nobody is stalled". */
export function readStalled({ home, slug, now, limitMs, windowMs, run = runGit, fileSystem: io = fs }) {
  const unavailable = [];
  const record = readNotices(home, slug, { readFile: (file) => io.readFileSync(file, 'utf8') });
  if (record.unavailable !== undefined) unavailable.push(`the channel's record (${record.path}): ${record.unavailable}`);
  const { openings, unavailable: noOpenings } = readOpenings(home, slug, io);
  if (noOpenings) unavailable.push(noOpenings);
  const log = readGateLog(home, { fileSystem: io });
  if (log.unavailable) unavailable.push(`the gate log (${log.dir}): ${log.unavailable.join(', ')}`);
  const stalled = stalledSessions({ notices: record.notices, openings, readings: record.readings, gates: log.events, commitAt: (worktree) => branchCommitAt(worktree, { run }), now, limitMs, windowMs });
  return { stalled, unavailable };
}

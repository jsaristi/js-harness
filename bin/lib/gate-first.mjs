// A ticket that puts one session's next whole check first in the line of the machine's gate lock
// (./gate-lock.mjs): the orchestrator lets a fix that unblocks the others, or its own batch run on main,
// go before every gate that waits, instead of as long as any commit. See odd/tasks/gate-first.md.
//
// A ticket is one file, `<home>/.js-harness/gate-first/<id>.json`: the session whose next check it is for,
// optionally the tree that check must be of, why, who issued it, and until when it may be claimed (60
// minutes at most). Deleting the file, or the folder, undoes it.
//
// It is claimed by a gate of that session when the gate arrives (`claimTicket`), before it stands in the
// line: the gate renames the file, which the file system lets one process do, so two gates of the session
// can never both hold it; it then reads it and removes it. So a ticket is spent at the claim, whatever the
// gate comes to after it: a gate proven by its tree, stopped, or refused spends it too, and a tree cannot
// jump the line twice. The gate writes the ticket's id in its own file in the line, from its first write,
// which is the only file the other gates read of it (`gatesAhead` reads each file once).
//
// Nothing stops a session from writing a ticket for itself: any process of the user can write the file. So
// a ticket is made seen instead of impossible: two at most are open, each says who issued it and why, the
// board prints them, and the gate log keeps each issue, claim, expiry and cancellation.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { appendGateEvent, GATE_LOG_VERSION } from './gate-log.mjs';

/** The longest a ticket may be claimed for, and what it is given when nobody says. A ticket nobody claims
 * is a promise to pass every waiter that outlives its reason. */
export const GATE_FIRST_MAX_MINUTES = 60;

/** How many tickets may be open at once: one for a fix that unblocks, one for the batch run on main. A
 * third would make "first" mean little. */
export const GATE_FIRST_OPEN = 2;

const TICKET_VERSION = 1;
/** What a ticket's id is: eight hex characters, which is also its file's name. */
export const TICKET_ID = /^[0-9a-f]{8}$/;
const TICKET_FILE = /^([0-9a-f]{8})\.json$/;

export class GateFirstError extends Error {}

/** Everything a ticket writes: deleting this folder undoes it. */
export function gateFirstDir(home) {
  return path.join(home, '.js-harness', 'gate-first');
}

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Whether `said`, read from the file `<id>.json`, is a ticket: its fields are what a ticket's are, and its
 * id is its file's. A file of another shape is no ticket, and is never claimed. */
function isTicket(said, id) {
  return (
    said !== null &&
    typeof said === 'object' &&
    said.v === TICKET_VERSION &&
    said.id === id &&
    isText(said.session) &&
    (said.tree === null || isText(said.tree)) &&
    isText(said.reason) &&
    (said.by === null || isText(said.by)) &&
    isTime(said.issuedAt) &&
    isTime(said.until)
  );
}

/** What `file` says as a ticket of `id`, or `null` for a file that cannot be read or is no ticket. */
function ticketIn(io, file, id) {
  try {
    const said = JSON.parse(io.readFileSync(file, 'utf8'));
    return isTicket(said, id) ? said : null;
  } catch {
    return null;
  }
}

const expiredAt = (ticket, now) => Date.parse(ticket.until) <= now;

/** The folder of tickets goes with the last one, as the lock's folder does. Every failure is "not now". */
function leaveNoFolder(io, dir) {
  try {
    io.rmdirSync(dir);
  } catch {
    // not empty, gone already, or busy
  }
}

/** The tickets of `home`: `{ open, expired, unreadable }`, the open and the expired in the order they were
 * issued, and the names of the files that are no ticket. Reads only. A home with no folder has none. */
export function readTickets(home, { now = Date.now, fileSystem: io = fs } = {}) {
  const dir = gateFirstDir(home);
  let names;
  try {
    names = io.readdirSync(dir);
  } catch (err) {
    if (['ENOENT', 'ENOTDIR'].includes(err.code)) return { open: [], expired: [], unreadable: [] };
    throw err;
  }
  const open = [];
  const expired = [];
  const unreadable = [];
  for (const name of names.sort()) {
    const id = TICKET_FILE.exec(name)?.[1];
    // A file being written (`.tmp-`), counted by its issuer (`.pending`) or claimed (`.claimed-`) is not one of
    // the folder's tickets.
    if (!id) continue;
    const ticket = ticketIn(io, path.join(dir, name), id);
    if (ticket === null) unreadable.push(name);
    else (expiredAt(ticket, now()) ? expired : open).push(ticket);
  }
  const issued = (a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt) || (a.id < b.id ? -1 : 1);
  return { open: open.sort(issued), expired: expired.sort(issued), unreadable };
}

/** Removes the tickets of `home` whose expiry has passed, and returns those it removed: one another
 * process removed first is not said twice. */
function sweepExpired(home, { now, io }) {
  const dir = gateFirstDir(home);
  const removed = readTickets(home, { now, fileSystem: io }).expired.filter((ticket) => {
    try {
      io.rmSync(path.join(dir, `${ticket.id}.json`));
      return true;
    } catch {
      return false;
    }
  });
  leaveNoFolder(io, dir);
  return removed;
}

/** The kinds of line a ticket leaves in the machine's gate log (./gate-log.mjs), one for each thing that
 * happens to it: issued, claimed by a gate, gone by its expiry, cancelled. */
export const TICKET_EVENTS = ['first-issued', 'first-claimed', 'first-expired', 'first-cancelled'];

/** Writes the line of `kind` for `ticket` in the gate log of `home`, with `extra` (the gate that claimed it,
 * and the gates it passed). Its id is the ticket's. A tree or an issuer the ticket does not name is left
 * out, since the reader takes no `null` where a text goes. Never throws: the log informs, and a ticket
 * works without it. `append` and `now` stand in for the writer and the clock. */
export function logTicket(home, kind, ticket, extra = {}, { append = appendGateEvent, now = Date.now } = {}) {
  try {
    append(home, {
      v: GATE_LOG_VERSION,
      event: kind,
      id: ticket.id,
      at: new Date(now()).toISOString(),
      session: ticket.session,
      ...(ticket.tree && { tree: ticket.tree }),
      reason: ticket.reason,
      ...(ticket.by && { by: ticket.by }),
      until: ticket.until,
      ...extra,
    });
  } catch {
    // the log is best effort here as everywhere
  }
}

/** A ticket's words, for a message: its id, its session and why. */
export const ticketSaid = (ticket) => `${ticket.id} (session ${ticket.session}${ticket.tree ? `, tree ${ticket.tree}` : ''}: ${ticket.reason}; until ${ticket.until})`;

/** The name a ticket has while its issuer counts the others (`issueTicket`): no gate claims it, and
 * `readTickets` does not list it. */
const PENDING = '.pending';
const PENDING_FILE = /^([0-9a-f]{8})\.pending$/;

/** How long a ticket may wait under its pending name before it is taken for the leftover of an issue that
 * died: an issue counts in milliseconds. */
const PENDING_MS = 60_000;

/** The tickets of `dir` that an issuer is counting against the others right now, in the order they were
 * issued. One older than `PENDING_MS` is an issue that died: it is removed and counts for nothing. A file
 * there that is no ticket counts for nothing either. */
function pendingTickets(io, dir, now) {
  let names;
  try {
    names = io.readdirSync(dir);
  } catch {
    return [];
  }
  const held = [];
  for (const name of names) {
    const id = PENDING_FILE.exec(name)?.[1];
    if (!id) continue;
    const ticket = ticketIn(io, path.join(dir, name), id);
    if (ticket === null) continue;
    if (now() - Date.parse(ticket.issuedAt) > PENDING_MS) io.rmSync(path.join(dir, name), { force: true });
    else held.push(ticket);
  }
  return held.sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt) || (a.id < b.id ? -1 : 1));
}

/** Issues a ticket for the next whole check of `session`, of the tree `tree` where given, for `minutes`
 * (1 to `GATE_FIRST_MAX_MINUTES`, all of them when not given), saying `reason`, issued by `by` (the
 * issuer's session id, or `null`). Expired tickets are removed first. Returns `{ ticket, expired }`, the
 * tickets that expiry removed included.
 *
 * Throws `GateFirstError` for what is no ticket (no session, no reason, minutes out of range) and when
 * `GATE_FIRST_OPEN` tickets are open already, naming them. The file is written whole under another name
 * and renamed into place, so a gate that claims it never reads half of it. */
export function issueTicket({ home, session, tree = null, reason, by = null, minutes = GATE_FIRST_MAX_MINUTES, now = Date.now, id = () => randomBytes(4).toString('hex'), fileSystem: io = fs }) {
  if (!isText(session)) throw new GateFirstError('a ticket is for a session: give a session id');
  if (!isText(reason)) throw new GateFirstError('a ticket says why: give a reason');
  if (!(Number.isFinite(minutes) && minutes >= 1 && minutes <= GATE_FIRST_MAX_MINUTES)) {
    throw new GateFirstError(`--minutes takes a number from 1 to ${GATE_FIRST_MAX_MINUTES}, not "${minutes}"`);
  }
  const expired = sweepExpired(home, { now, io });
  const dir = gateFirstDir(home);
  const full = (held) => new GateFirstError(`two tickets are open already: ${held.slice(0, GATE_FIRST_OPEN).map(ticketSaid).join(', ')}; cancel one (js-harness gate first --cancel <id>) or wait for it to be claimed or to expire`);
  const before = [...readTickets(home, { now, fileSystem: io }).open, ...pendingTickets(io, dir, now)];
  if (before.length >= GATE_FIRST_OPEN) throw full(before);
  const at = now();
  const ticket = {
    v: TICKET_VERSION,
    id: id(),
    session: session.trim(),
    tree: isText(tree) ? path.resolve(tree) : null,
    reason: reason.trim(),
    by: isText(by) ? by : null,
    issuedAt: new Date(at).toISOString(),
    until: new Date(at + minutes * 60_000).toISOString(),
  };
  const file = path.join(dir, `${ticket.id}.json`);
  const waiting = path.join(dir, `${ticket.id}${PENDING}`);
  const draft = `${file}.tmp-${process.pid}`;
  // A claim or a cancel removes the folder with its last ticket, which can happen between the making of the
  // folder and the write (Codex, 2026-10-16): the write is tried again in a folder made again.
  for (let attempt = 1; ; attempt += 1) {
    io.mkdirSync(dir, { recursive: true });
    try {
      io.writeFileSync(draft, `${JSON.stringify(ticket)}\n`);
      io.renameSync(draft, waiting);
      break;
    } catch (err) {
      if (err.code !== 'ENOENT' || attempt === 3) throw err;
    }
  }
  // The count before the write is no guard against an issuer that wrote in between, and the folder holds no
  // lock (Codex, 2026-10-16). So the ticket is first written under a name no gate claims, and every issuer
  // counts the open tickets and the waiting ones again with its own in place: one that sees more than the
  // limit removes its own and is refused, wherever it stands in the order. An issuer that counted before the
  // other wrote saw no excess, and the other sees its ticket; two that both see the excess both go, which
  // leaves fewer open, never more. Only a ticket that passed its count is renamed to one a gate claims.
  const after = [...readTickets(home, { now, fileSystem: io }).open, ...pendingTickets(io, dir, now)];
  if (after.length > GATE_FIRST_OPEN) {
    io.rmSync(waiting, { force: true });
    throw full(after.filter((held) => held.id !== ticket.id));
  }
  io.renameSync(waiting, file);
  return { ticket, expired };
}

/** Removes the ticket `id` of `home` and returns it, or `null` when no such ticket is there. Throws
 * `GateFirstError` for what is no ticket id. */
export function cancelTicket({ home, id, fileSystem: io = fs }) {
  if (!TICKET_ID.test(String(id))) throw new GateFirstError(`a ticket id is eight hex characters, not "${id}"`);
  const dir = gateFirstDir(home);
  const file = path.join(dir, `${id}.json`);
  const ticket = ticketIn(io, file, id);
  if (ticket === null) return null;
  try {
    io.rmSync(file);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  leaveNoFolder(io, dir);
  return ticket;
}

/** Whether a gate that checks `cwd` is of the tree `tree`: the same folder, in any case on Windows. */
function ofTree(tree, cwd, platform) {
  const norm = (value) => {
    const resolved = path.resolve(value).replace(/[\\/]+$/, '');
    return platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return norm(tree) === norm(cwd);
}

/** Claims the ticket of `session` for a gate that checks `cwd`, as the gate arrives: `{ ticket, expired }`,
 * `ticket` being the one claimed or `null`, and `expired` the tickets of any session this claim removed
 * because their expiry had passed. The oldest ticket of the session whose tree is `cwd`, or that names
 * none, is renamed, read and removed: spent here, whatever the gate comes to. A rename that fails (another
 * gate of the session claimed it first, or it was cancelled) is no claim, and the next ticket is tried. A
 * session that is not known (`null`) claims nothing. Never throws: a ticket that cannot be claimed is no
 * ticket, and the gate waits as any other. */
export function claimTicket({ home, session, cwd, now = Date.now, platform = process.platform, fileSystem: io = fs }) {
  let expired = [];
  try {
    expired = sweepExpired(home, { now, io });
    if (!isText(session)) return { ticket: null, expired };
    const dir = gateFirstDir(home);
    const mine = readTickets(home, { now, fileSystem: io }).open
      .filter((ticket) => ticket.session === session && (ticket.tree === null || ofTree(ticket.tree, cwd, platform)));
    for (const candidate of mine) {
      const claimed = path.join(dir, `${candidate.id}.claimed-${process.pid}-${randomBytes(3).toString('hex')}`);
      try {
        io.renameSync(path.join(dir, `${candidate.id}.json`), claimed);
      } catch {
        continue;
      }
      const ticket = ticketIn(io, claimed, candidate.id);
      try {
        io.rmSync(claimed);
      } catch {
        // a file left under a claimed name is no ticket to anyone, and is in the folder `uninstall` removes
      }
      leaveNoFolder(io, dir);
      if (ticket === null) continue;
      if (expiredAt(ticket, now())) {
        expired = [...expired, ticket];
        continue;
      }
      return { ticket, expired };
    }
    return { ticket: null, expired };
  } catch {
    return { ticket: null, expired };
  }
}

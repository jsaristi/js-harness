// The gate turn of `js-harness check` and `js-harness gate`: the wait for the machine's gate lock, its tickets and
// its refusals, the `gate` rows a check writes of it, and the exit code of a gate that ran nothing. `check` and
// `gate` re-export what they exported; a library module imports them from here, so it does not load the whole gate
// to take a turn (odd/tasks/reorganization.md, S2).
import path from 'node:path';
import { GATE_WAIT_MS, readGateWaiters, takeGateLock } from './gate-lock.mjs';
import { GateFirstError, claimTicket, issueTicket, logTicket, ofTree, readTickets } from './gate-first.mjs';
import { gateLogSwitchedOff } from './gate-log.mjs';
import { counted } from './codex-review-scope.mjs';

/** The exit code of a `gate` that ran nothing because the lock was not its to take: with `--no-wait`, held
 * or with a gate ahead of it in the line, past the bound of its wait, or with its `--ready` check failing before
 * the wait or after it. It is the "try again later" of
 * sysexits.h (EX_TEMPFAIL), a code a test runner does not give, so
 * a caller can tell "did not run" from "ran and failed". A usage error is 2, as everywhere here. */
export const GATE_NOT_RUN = 75;

/** `ms` as a person reads a wait: `45 s`, `3 min 12 s`. */
function duration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** The bound of a wait as `--wait` takes it: `1 minute`, `2.5 minutes`. */
export const minutes = (count) => `${count} minute${count === 1 ? '' : 's'}`;

/** A gate for a message: the folder it checks, with its pid and `since`, a time with the word for it,
 * where its file says them, and the ticket it goes first by, with why, where it claimed one. A gate of whom
 * nothing is known is "another gate". */
function gateSaid(gate, since) {
  const ticket = typeof gate?.first === 'string' && `first by ticket ${gate.first}: ${gate.firstReason ?? 'no reason read'}`;
  const said = [gate?.pid != null && `pid ${gate.pid}`, since, ticket].filter(Boolean);
  return `${gate?.cwd == null ? 'another gate' : `the gate of ${gate.cwd}`}${said.length ? ` (${said.join(', ')})` : ''}`;
}

/** The gate a holder of the lock is, for a message, with when it took the lock. A holder of whom nothing
 * is known (a file that could not be read, a lock folder that could not be listed) is "another gate", and
 * so is a holder a refusal did not name. */
const gateOf = (holder) => gateSaid(holder, holder?.startedAt != null && `started ${holder.startedAt}`);

/** The gate that waits ahead of this one in the line for the lock, for a message, with since when it
 * waits. It holds nothing, and is never named with the words of a holder. */
const waitingGateOf = (gate) => gateSaid(gate, gate?.waitingSince != null && `waiting since ${gate.waitingSince}`);

/** How many gates are before this one, said at the end of a line about a wait when the gate that line
 * names is not the only one. */
const aheadSaid = (line) => (line?.ahead > 1 ? `; ${line.ahead} gates are ahead of this one, that one included` : '');

/** What `--wait <minutes>` and `--no-wait` mean, for the usage of `check` and of `js-harness gate`, which
 * take the two flags alike. The bound is not on the whole of a wait (`takeGateLock`). */
export const GATE_WAIT_USAGE =
  `       --wait <minutes>: how long the machine's gate lock may go without changing hands before this gate gives up on it (${GATE_WAIT_MS / 60_000} when not given); --no-wait: refuse at once instead of waiting`;

/** The sentence of a refusal of the lock (`takeGateLock`), for a gate that was given `waitMinutes`: which
 * gate it was refused for, and whether that gate held the lock or waited ahead of this one for it. A wait
 * that ran out says how long the lock had not changed hands, which is what the bound is set on, and how
 * long the whole wait was where the two differ: behind a line that moved, a gate may have waited far
 * longer than its bound. */
function refusalSaid({ refused, holder, line, waitedMs, stillMs, besideOlder }, waitMinutes) {
  if (refused === 'held') return `${gateOf(holder)} holds the machine's gate lock, and --no-wait was given`;
  // Its launcher ended (./lib/launcher.mjs, odd/tasks/orphan-gate.md): nobody waits for what it would run.
  if (refused === 'launcher gone') return 'the process that started this gate ended while it waited, so it gave up its place in the line';
  if (refused === 'ahead') {
    return `${waitingGateOf(line?.head)} waits ahead of this one for the machine's gate lock, which no gate holds, and --no-wait was given; a gate that died as it waited is passed a minute after its last sign of life`;
  }
  const inAll = `this gate had waited ${duration(waitedMs)} in all`;
  // Beside a gate of an older version no line is kept, and the bound was not counted from the last change of
  // hands alone: it counts from the arrival, or from a change of hands read while the line was kept. So the
  // words "without the lock changing hands" would be untrue here (found in review, 2026-10-11).
  if (refused === 'timeout' && besideOlder) {
    const who = holder ? `${gateOf(holder)} holds the machine's gate lock now` : `${waitingGateOf(line?.head)} waits ahead of this one for the machine's gate lock, which no gate holds`;
    return `${who}; ${inAll}, and a gate of an older version of js-harness waited beside it, which keeps no line, so the bound counted from its arrival or from the last change of hands read while the line was kept (--wait gives up after ${minutes(waitMinutes)})`;
  }
  const bound = `(--wait gives up after ${minutes(waitMinutes)} without the lock changing hands)`;
  // A lock that did not tell is one that never changed hands while this gate waited, as far as is known.
  const still = Number.isFinite(stillMs) ? stillMs : waitedMs;
  if (!holder) {
    return `${waitingGateOf(line?.head)} waited ahead of this one and did not take the machine's gate lock, which no gate held: the lock had not changed hands for ${duration(still)}, and ${inAll} ${bound}`;
  }
  if (still < waitedMs) return `${gateOf(holder)} still held the machine's gate lock ${duration(still)} after it took it, and ${inAll} ${bound}`;
  return `${gateOf(holder)} still held the machine's gate lock after ${duration(waitedMs)} ${bound}`;
}

// A lock taken at once took a few milliseconds, and the report of a gate that waited for nobody says
// nothing of the lock. A wait this long is said: it is a poll for another gate, or a takeover.
// `js-harness gate` reads it too, for the same question: whether another gate ran until a moment ago.
export const GATE_WAIT_SAID_MS = 1000;

/** One turn at the machine's gate lock (`./lib/gate-lock.mjs`), taken the way a gate takes it, for
 * whoever runs under it: `check` around its sensors, `js-harness gate` around a command. `name` is who
 * says the wait, `command` what the holder's file says it runs, in the folder `cwd`.
 *
 * Whoever finds the lock held waits for it, and says on stderr, as the wait begins and for each gate it
 * then waits for, whose gate that is and for how long at most from then on: the caller is a commit running
 * in the background, and a silent wait reads as a hang. That is what is left of the bound, which is how
 * long the lock may go without changing hands (`waitMinutes`, as `--wait` takes it), so with each new
 * holder it is the whole bound again. A first version said the whole bound in every line when the bound
 * counted from the arrival, with most of it spent by the second line (found in review, 2026-10-10); it is
 * what is true since the bound counts from the last change of hands (2026-10-11).
 *
 * The lock is a line, and what is said of a gate is true of that gate. A gate that holds the lock is
 * "waited for to finish". One that only waits ahead of this one, with the lock free, is "stood behind"
 * and said to wait for its turn: it holds nothing, and is never named in a holder's words. A line says
 * how many gates are ahead of this one when the gate it names is not the only one.
 *
 * Resolves to `{ lock }` once the lock is held (`takeGateLock`), for the caller to release. Resolves to
 * `{ refused, reason }` when nothing may run: `wait` is off and the lock is held (`reason` is `held`) or a
 * gate waits ahead of this one for a lock nobody holds (`ahead`), or the lock went `waitMinutes` without
 * changing hands (`timeout`); `refused` is the sentence that says which, names the gate, and says whether
 * it holds the lock or waits for it (`refusalSaid`). Resolves to
 * `{ without }` when the lock cannot be taken at all (the home cannot be written, or a lock is there of
 * which nothing could be read for a minute, which is no gate to wait an hour for): `without` names the
 * lock and why, and the caller runs without it and says so, since the lock guards the machine's time
 * and not what is run.
 *
 * Every outcome also says whom this gate waited for and for how long, which is what the gate log keeps
 * (`./lib/gate-log.mjs`): `waitedMs`, and `waitedFor`, the gates the lock told of while it waited, as
 * `[{ cwd, pid, command }]`. They are the gates that held the lock, and no gate that only waited ahead of
 * this one: such a gate is there from the moment it holds the lock, if this gate still waits then. Each is
 * there once, by the token of its holder's file, since the lock tells of a gate again when its beat stops
 * being readable, and with all that any telling of it read: a file that was busy at first names its gate
 * once it reads. A holder that gave no token (a lock folder that could not be listed gives none) cannot be
 * met again by its name, so it is there once for each thing that was read of it: a gate of which nothing
 * is known is there once, with nothing said of it, and what was read of one such holder is never said of
 * another. A first version kept one entry for every holder without a token, and added to it what each of
 * them said (found in review, 2026-10-11). The gate a refusal names is among them when it held the lock:
 * told not to wait, a gate is told of nobody. The lock says how long a wait was that ended in a lock or a
 * refusal; one that ended in no lock at all is timed here.
 *
 * `session` is the id of the host's session that started the gate, or `null` where the host gives none:
 * the lock writes it in the gate's file, where the session board reads it. `check` and `js-harness gate`
 * pass what their environment says (`CLAUDE_CODE_SESSION_ID`). `first` is the ticket this gate claimed
 * (`{ id, reason }`, ./lib/gate-first.mjs), handed to the lock, which puts the gate before every gate that
 * waits; a gate waited for that went first by a ticket is marked `first: true` among `waitedFor`.
 * `take` stands in for `takeGateLock`, so a test stands in for the lock or runs the real one on its own
 * clock. */
export async function takeGateTurn({ name, home, cwd, command, wait, waitMinutes, session = null, stillWanted, first = null }, take = takeGateLock) {
  const waitMs = waitMinutes * 60_000;
  const met = new Map();
  // One entry for each token, to which a later telling adds what the entry does not have yet: a holder's
  // file that is busy at the first look is told of by its token alone, and with its folder and command once
  // it reads. What is known is never taken back by a look that read less. A holder with no token is known
  // by what was read of it, so nothing is ever added to its entry.
  const meet = (holder) => {
    const said = { cwd: holder.cwd ?? null, pid: holder.pid ?? null, command: holder.command ?? null };
    const key = holder.token != null ? `token ${holder.token}` : `no token ${JSON.stringify([said.pid, said.cwd, said.command])}`;
    const known = met.get(key) ?? { cwd: null, pid: null, command: null };
    const first = known.first || typeof holder.first === 'string';
    met.set(key, { cwd: known.cwd ?? said.cwd, pid: known.pid ?? said.pid, command: known.command ?? said.command, ...(first && { first: true }) });
  };
  const waitedFor = () => [...met.values()];
  const onWait = (holder, leftMs = waitMs, line) => {
    // What is left of the bound when this gate is first waited for: the whole of it, as `--wait` takes
    // it, while under a second is spent, which is the first line of a wait and the line of each new holder.
    const left = waitMs - leftMs < GATE_WAIT_SAID_MS ? minutes(waitMinutes) : duration(leftMs);
    if (!holder) {
      // Nobody holds the lock, and the gate ahead is to take it: a gate that waits, which is not met as a
      // gate this one waited for until it holds the lock.
      console.error(`${name}: waiting behind ${waitingGateOf(line?.head)}, which waits for its turn at the machine's gate lock, for ${left} at most${aheadSaid(line)}`);
      return;
    }
    meet(holder);
    // A holder that already reads stale is waited for a poll or two, not for the whole bound.
    const silent = holder.stale ? '; it has been silent for over a minute, and its lock is taken over if it stays so' : '';
    console.error(`${name}: waiting for ${gateOf(holder)} to finish, for ${left} at most${silent}${aheadSaid(line)}`);
  };
  let lock;
  const askedAt = Date.now();
  try {
    // `stillWanted`, from `js-harness gate` alone: whether its launcher lives (`takeGateLock`).
    lock = await take({ home, cwd: path.resolve(cwd), command, session, wait, waitMs, onWait, ...(stillWanted ? { stillWanted } : {}), ...(first ? { first } : {}) });
  } catch (err) {
    return { without: `the machine's gate lock, which could not be taken (${err instanceof Error ? err.message : String(err)})`, waitedMs: Date.now() - askedAt, waitedFor: waitedFor() };
  }
  if (!lock.refused) return { lock, waitedMs: lock.waitedMs, waitedFor: waitedFor() };
  if (lock.holder) meet(lock.holder);
  return { refused: refusalSaid(lock, waitMinutes), reason: lock.refused, waitedMs: lock.waitedMs, waitedFor: waitedFor() };
}

/** Runs `run`, the sensors of the gate that checks `cwd`, while this gate holds the machine's gate lock
 * (two gates at once make both miss their time bound with every test green), and resolves to their
 * rows, with a row named `gate` for whatever the lock did that a reader must know. Taken at once, which
 * is the common case, it adds none.
 *
 * The lock is taken as `takeGateTurn` says, in the turn of this gate in the line, for the session
 * `session` (`null` where the host names none). The time a gate waited for it is an INFO row. It counts
 * against no sensor's timeout, which starts when the sensor does. With `wait` off and the lock held or a
 * gate ahead in the line, or once the lock went `waitMinutes` without changing hands, the row is a FAIL
 * that names that gate, as the holder or as a gate that waits, and `run` is not called: a gate that ran
 * nothing must not look green.
 *
 * A lock that cannot be taken at all does not turn a gate red, since the lock guards the machine's time
 * and not the project's code: `run` is called without it and an INFO row says so and why. So does a
 * lock lost while the sensors ran, which happens only to a gate that was silent for the whole stale
 * time (a machine that slept).
 *
 * The lock is released on every way out of `run`, a throw included. A gate that is killed (a Ctrl-C, a
 * closed terminal) leaves its holder's file, which beats no more: the next gate reads it stale a minute
 * after its last beat and takes it over, having said whose gate it waits for. No signal is handled here
 * to release it sooner: a handler would have to end the process itself, and `check` would no longer end
 * on a Ctrl-C the way it does today.
 *
 * `run({ lock: 'own', waitedMs, waitedFor })` is called with the lock in hand, and the sensors are then
 * given the mark of a held lock (`GATE_HELD_ENV`); `run({ lock: 'none', ... })` is called without the
 * lock. Both are told whom this gate waited for and for how long, as `takeGateTurn` says it, which the
 * gate writes in its log. A gate that is refused writes one line there through `record`, where it has
 * one (`gateRecord` of `./lib/gate-log.mjs`), and a line that could not be written is one more row.
 * `takeGateLock` is injectable, as in `takeGateTurn`. */
export async function underGateLock(cwd, { home, wait, waitMinutes, session, first = null }, { takeGateLock: take = takeGateLock }, run, record) {
  const turn = await takeGateTurn({ name: 'check', home, cwd, command: 'check', wait, waitMinutes, session, first: first && { id: first.id, reason: first.reason } }, take);
  const { waitedMs, waitedFor } = turn;
  if (turn.without) {
    return [gateRow(`the sensors ran without ${turn.without}, so another gate may have run at the same time`), ...(await run({ lock: 'none', waitedMs, waitedFor }))];
  }
  if (turn.refused) {
    record?.refused({ reason: turn.reason, waitedMs, waitedFor });
    return [gateRow(`no sensor ran: ${turn.refused}`, false), ...gateLogRows(record)];
  }
  const { lock } = turn;
  const waited = lock.waitedMs >= GATE_WAIT_SAID_MS;
  const rows = waited ? [gateRow(`waited ${duration(lock.waitedMs)} for the machine's gate lock before the sensors ran`)] : [];
  if (first) rows.push(gateRow(`this gate claimed ticket ${first.id} (${first.reason}), issued by ${first.by ?? 'a session the ticket does not name'}, and went before every gate that waited`));
  let lost = false;
  try {
    rows.push(...(await run({ lock: 'own', waitedMs, waitedFor })));
  } finally {
    // Asked before the release, after which a gate has no lock to have lost.
    lost = lock.lost();
    lock.release();
  }
  if (lost) rows.push(gateRow("the machine's gate lock was lost while the sensors ran: this gate was silent for over a minute and another took its lock, so two gates may have run at once"));
  return rows;
}

/** `check --first <reason>`: issues the session of `lock` a ticket for the tree `cwd`, issued by that session
 * itself, which the gate then claims as it arrives (`claimOf`), and writes the issue in the gate log as `gate
 * first` does. Returns the rows to add: none when it was issued, and an INFO row that says why when it was not
 * (no session, two tickets open already, or a gate in the turn of the process that holds the lock, which waits
 * for nobody); the gate runs all the same. The board flags a ticket whose issuer is not the orchestrator. */
export function ownTicketRows(reason, cwd, lock, env, deps) {
  const notIssued = (why) => ({ rows: [{ name: 'first', pass: true, info: true, detail: `no ticket was issued: ${why}` }], issued: null });
  if (lock.held) return notIssued('this gate runs in the turn of the process that holds the gate lock, and waits for nobody');
  if (lock.session === null) return notIssued('the host names no session for this gate, and a ticket is for a session');
  // An open ticket of this session that this gate would claim is the one it goes first by: no second (Codex).
  const tree = path.resolve(cwd);
  const mine = readTickets(lock.home).open.find((ticket) => ticket.session === lock.session && (!ticket.tree || ofTree(ticket.tree, tree, process.platform)));
  if (mine) return notIssued(`ticket ${mine.id} of this session is open already for this tree, and this gate claims it`);
  let issued;
  try {
    issued = issueTicket({ home: lock.home, session: lock.session, tree: path.resolve(cwd), reason, by: lock.session });
  } catch (err) {
    if (!(err instanceof GateFirstError)) throw err;
    return notIssued(err.message);
  }
  if (!gateLogSwitchedOff(env)) {
    const written = { ...(deps.gateLog?.append && { append: deps.gateLog.append }) };
    for (const gone of issued.expired) logTicket(lock.home, 'first-expired', gone, {}, written);
    logTicket(lock.home, 'first-issued', issued.ticket, {}, written);
  }
  return { rows: [], issued: issued.ticket.id };
}

/** Claims the ticket of the session of `lock` for the gate that checks `cwd` (`claimTicket`), and writes in
 * the gate log what the claim did: the tickets its sweep found expired, those it left because their file was
 * held, and the claim, with the gates that
 * waited then, which this one passes. Nothing is written with the log switched off (`lock.log` false).
 * Returns the ticket, or `null`. `deps.gateLog` stands in for the writer, as for the gate's own lines, and
 * `deps.claimTicket` for the claim. The code of a hold goes in `error`: the log's `code` is the key of a tree. */
export function claimOf(lock, cwd, deps, { named = false } = {}) {
  const claim = deps.claimTicket ?? claimTicket;
  const { ticket, expired, unclaimed = [] } = claim({ home: lock.home, session: lock.session, cwd: path.resolve(cwd), named });
  if (lock.log === false) return ticket;
  const written = { ...(deps.gateLog?.append && { append: deps.gateLog.append }) };
  for (const gone of expired) logTicket(lock.home, 'first-expired', gone, {}, written);
  for (const { ticket: held, code } of unclaimed) logTicket(lock.home, 'first-unclaimed', held, { error: code, cwd: path.resolve(cwd), pid: process.pid }, written);
  if (ticket) {
    let waiting = [];
    try {
      waiting = readGateWaiters(lock.home).filter((gate) => typeof gate.first !== 'string');
    } catch {
      // a line that cannot be read passes nobody that can be named
    }
    logTicket(lock.home, 'first-claimed', ticket, { cwd: path.resolve(cwd), pid: process.pid, passed: waiting.map(({ cwd: folder, pid }) => ({ cwd: folder, pid })) }, written);
  }
  return ticket;
}

/** A row named `gate`: what the machine's gate lock did that a reader of the report must know. It informs
 * and fails nothing, but for a gate that ran no sensor (`pass` false). */
export const gateRow = (detail, pass = true) => ({ name: 'gate', pass, ...(pass && { info: true }), detail });

/** The row named `gate log` of a gate whose record could not be written, saying why and what is missing
 * from the log; no row for a gate that wrote its lines, or that has no record. It informs: nothing a gate
 * proves is in its log. */
export function gateLogRows(record) {
  const failure = record?.failure();
  return failure ? [{ name: 'gate log', pass: true, info: true, detail: failure }] : [];
}

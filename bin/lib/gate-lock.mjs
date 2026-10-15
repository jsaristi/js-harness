// The machine's gate lock: `<home>/.js-harness/gate/lock/`, a folder that holds one file,
// `holder-<token>.json`, while a gate runs its sensors. Two gates at once on one machine make both miss
// their time bound with every test green, and the rule "never two at once" cannot be kept from outside the
// gate: two sessions that both look, see none and start have both kept it.
//
// The lock folder never exists without its holder's file in it. A gate makes a folder of its own beside
// it, `gate/wait-<token>/`, with its file inside, and takes the lock by renaming that folder to `lock`:
// one step, which the file system refuses while `lock` holds a file. Every other step names exactly
// what it acts on, so none can undo a take:
//   - a holder is alive by its beat: it touches its own file every few seconds, so nothing has to ask the
//     system who a pid is (which costs a PowerShell snapshot on Windows and is fooled by a recycled pid);
//   - a holder's file that is there and cannot be looked at (busy, on Windows) holds all the same: a look
//     that failed shows neither an empty lock nor a dead gate. So does a lock folder that is there and
//     cannot be listed: it is the lock of a gate of whom nothing is known, waited for and never taken over.
//     Waited for, for the stale time and no longer: a lock of which nothing could be read for that long
//     (no access to it, which no gate ends) has shown no gate at all, and the take is an error that says
//     so, for its caller to decide what a gate without a lock does;
//   - the lock of a gate that died is taken over by removing that holder's file by its name, which holds
//     its token; a gate that took the lock in the meantime has another name. The removal is tried once: a
//     busy answer may be the holder touching its file as it comes back, so the beat is read again first;
//   - the folder is removed with `rmdir`, which fails while a holder's file is in it. An empty `lock` is
//     nobody's (a release or a takeover is between its two steps, or died there), so anyone may remove it;
//   - the folder `gate` itself goes the same way when a gate leaves: with `rmdir`, which fails while the
//     lock or the folder of a gate that waits is in it. A gate that stages its folder at that instant makes
//     `gate` again, since it makes its folder with every parent it needs. So nothing is left on disk
//     between two gates, and what a gate that was killed leaves is swept by the next one, or removed by
//     `js-harness uninstall`.
// A first version made `lock` with `mkdir` and wrote the file after. In between the folder was empty and
// its maker's, and a gate late to a takeover could remove it and make its own: both then held the lock
// (found in review, 2026-10-10).
//
// The lock is a line, by order of arrival. Every gate that waited used to try the rename at each poll, and
// a gate that had just arrived tried it before it looked at who waited: the lock went to whichever looked
// first after a release, and on 2026-10-11 a commit waited an hour and gave up while gates that arrived
// twenty and thirty minutes after it ran. So a gate tries the rename only when no live gate that arrived
// before it waits:
//   - a gate stands in the line by its folder `gate/wait-<token>/`, whose file says when it arrived
//     (`waitingSince`, set once when the take begins) and that it keeps the line (`line: 1`). It is alive
//     by the touch it gives that file at every poll, as a holder is by its beat: a folder nothing touched
//     for the stale time is a dead gate's, and is passed;
//   - the order of the turn is the arrival, and the token where two arrived in the same millisecond, so
//     every gate computes the same order (`gatesAhead`). It is not the order `readGateWaiters` shows;
//   - only the rename grants the lock, as before, which is what makes two holders impossible. The line
//     decides who may try it and nothing else, so a fault in the line (a folder that cannot be listed, a
//     file that cannot be read, a machine that slept and woke with every gate stale) costs order, never
//     the one holder, and never a take that fails: a line that cannot be read is no line, and the gate
//     does what a gate did before there was one;
//   - a gate of an older version keeps no line: it tries the rename at every poll, and would pass a gate
//     that stood back for it each time. One machine's lock is shared by every project, each with the
//     version it has, so beside a live gate whose file has no mark a gate does the same (`gatesAhead`).
// Nothing new is on disk for it: the same folders, and two more fields in the same file.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ruleValue } from './rules.mjs';

/** How often a holder touches its file. */
export const GATE_BEAT_MS = 5_000;
/** A holder that has not beaten for this long died. Twelve beats: a timer that late is no timer. */
export const GATE_STALE_MS = 60_000;
/** How often a waiting gate looks again. */
export const GATE_POLL_MS = 2_000;
/** How long a gate that waits lets the lock go without changing hands before it gives up on it: the bound
 * of a wait, which counts from the last time the lock changed hands and not from the arrival
 * (`takeGateLock`). The minutes are the declared rule's (`gate-wait` in ./rules-data.mjs). */
export const GATE_WAIT_MS = ruleValue('gate-wait', 'minutes') * 60_000;

const HOLDER_FILE = /^holder-(.+)\.json$/;
const WAIT_DIR = /^wait-(.+)$/;
/** What the file of a gate that keeps the line says under `line`. A file without it is a gate of a version
 * before the line, which takes no turn. */
const KEEPS_LINE = 1;
// What Windows answers for a file or a folder another process holds open, or that is being removed while
// a handle is still open on it.
const BUSY = ['EPERM', 'EACCES', 'EBUSY'];
// What a rename onto `lock` answers when `lock` is there: by system, and by what `lock` is.
const TAKEN = ['EEXIST', 'ENOTEMPTY', 'ENOTDIR', 'EISDIR', ...BUSY];
// A take that neither succeeds nor finds a holder to wait for is tried again this many times, this far
// apart: a folder Windows is still removing is gone in a moment, a home that cannot be written is not.
// A lock folder that is there and cannot be listed gets the same tries, since one that is being removed
// answers so too; still there and still busy after them, it is a gate to wait for (`lookAt`).
const BLIND_TRIES = 40;
const BLIND_PAUSE_MS = 25;
// A gate's own file another process holds open at that instant cannot be removed on Windows; left
// behind, it would hold the lock, beating no more, for the whole stale time. So a gate that removes what
// is its own (its holder's file at a release, its folder when it stops waiting) tries again when the
// answer is busy, this many times in all, this far apart. `rmSync` cannot be asked to: it takes
// `maxRetries` and `retryDelay` and does not wait with them. On Node 24.15 and Windows 10 a file held
// open for 150 ms answered EPERM within a millisecond, with `recursive` and without (run 2026-10-10).
// Not at a takeover, where the file is another gate's (`takeGateLock`).
const REMOVE_TRIES = 6;
const REMOVE_PAUSE_MS = 20;

/** Everything the lock writes: deleting this folder undoes it. */
export function gateDir(home) {
  return path.join(home, '.js-harness', 'gate');
}

export function gateLockDir(home) {
  return path.join(gateDir(home), 'lock');
}

/** Runs `step` and returns its result, or `undefined` when it failed with one of `codes`. */
function unless(codes, step) {
  try {
    return step();
  } catch (err) {
    if (codes.includes(err.code)) return undefined;
    throw err;
  }
}

/** Stops this thread for `ms`. A release is not a promise, and a gate that releases or waits has
 * nothing else to run meanwhile. */
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Removes a file or a folder, trying again while the answer is busy; past the last try, that answer
 * is thrown. */
function remove(io, target, options) {
  for (let tries = 1; ; tries += 1) {
    try {
      return io.rmSync(target, options);
    } catch (err) {
      if (!BUSY.includes(err.code) || tries >= REMOVE_TRIES) throw err;
      pause(REMOVE_PAUSE_MS);
    }
  }
}

/** Removes the folder `gate` when nothing is in it, for a gate that leaves. Every failure is the answer
 * "not now": the lock or a gate in line is in it, another gate removed it first, or Windows holds it for
 * an instant. Whatever stays is removed by the next gate that leaves. */
function leaveNoFolder(io, root) {
  try {
    io.rmdirSync(root);
  } catch {
    // not empty, gone already, or busy
  }
}

const isStale = (beatAt, now, staleMs) => now() - beatAt > staleMs;

/** What a gate's file says: the object in it, or `{}` for a file that cannot be read or is not ours. */
function saidIn(io, file) {
  try {
    const parsed = JSON.parse(io.readFileSync(file, 'utf8'));
    if (parsed !== null && typeof parsed === 'object') return parsed;
  } catch {
    // unreadable: nobody is named
  }
  return {};
}

/** The pid of the gate a file names: what the file says, else what its token starts with. A gate's token
 * is its pid and a random part, so the pid is known when the file could not be read at that instant (a
 * gate that waits writes its file again at every poll), and `null` only for a file that is not ours. */
function pidOf(said, token) {
  if (Number.isInteger(said.pid)) return said.pid;
  const named = /^(\d+)-[0-9a-f]+$/.exec(token);
  return named ? Number(named[1]) : null;
}

/** What a holder's file says, as far as it can be read: a file that is not ours names nobody and still
 * holds by its beat. `beatAt` is `null` for a file too busy to be looked at, and that holder is not
 * stale: a beat that could not be read is not an old beat. */
function holderOf(io, file, token, beatAt, { now, staleMs }) {
  const said = saidIn(io, file);
  return {
    token,
    pid: pidOf(said, token),
    cwd: typeof said.cwd === 'string' ? said.cwd : null,
    command: typeof said.command === 'string' ? said.command : null,
    session: typeof said.session === 'string' ? said.session : null,
    startedAt: typeof said.startedAt === 'string' ? said.startedAt : null,
    beatAt,
    stale: beatAt !== null && isStale(beatAt, now, staleMs),
  };
}

/** The holder that is read when the lock folder is there and nothing in it can be: not even a token. It
 * is not stale, as a holder whose beat could not be read is not. */
const NOBODY_KNOWN = { token: null, pid: null, cwd: null, command: null, session: null, startedAt: null, beatAt: null, stale: false };

/** What is in the lock folder now: `null` when there is no folder to read, `{}` when it is empty, else
 * `{ file, holder }` for the holder that beat last. A file that went away since the listing is not
 * there. One that is there and answers busy is a holder of whom only the token, which is in its name,
 * is sure, and it counts as the one that beat last. A first version read it as not there: a live gate
 * whose file stayed busy for a second made the take an error, and a caller that runs its gate without
 * the lock on an error then ran it beside that gate (found in review, 2026-10-10).
 *
 * A folder that is there and cannot be listed (busy, on Windows: another process holds it open, or it
 * is being removed) is `{ holder }` with no file and the holder `NOBODY_KNOWN`, for the same reason: the
 * gate inside could not be seen, which is not a free lock (found in the next review, 2026-10-10).
 *
 * `unread` is what the system answered where the beat could not be read, for the error of a take that
 * read nothing for the whole stale time (`takeGateLock`). */
function lookAt(io, dir, clock) {
  let names;
  try {
    names = io.readdirSync(dir);
  } catch (err) {
    if (BUSY.includes(err.code)) return { holder: { ...NOBODY_KNOWN }, unread: err.code };
    if (['ENOENT', 'ENOTDIR'].includes(err.code)) return null;
    throw err;
  }
  const found = [];
  for (const name of names) {
    const token = HOLDER_FILE.exec(name)?.[1];
    if (!token) continue;
    const file = path.join(dir, name);
    let beatAt = null;
    let unread;
    try {
      beatAt = io.statSync(file).mtimeMs;
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      if (!BUSY.includes(err.code)) throw err;
      unread = err.code;
    }
    found.push({ file, holder: holderOf(io, file, token, beatAt, clock), unread });
  }
  const beat = ({ holder }) => holder.beatAt ?? Number.MAX_VALUE;
  return found.sort((a, b) => beat(b) - beat(a))[0] ?? {};
}

/** Who holds the machine's gate lock: `null` when nobody does, else `{ token, pid, cwd, command, session,
 * startedAt, beatAt, stale }`, with `null` for what the holder's file does not say and `stale` true
 * for a holder that stopped beating, whose lock the next gate takes over. `session` is the id of the
 * host's session that started the gate, where the gate was given one (`takeGateLock`).
 *
 * A holder whose file is there and busy at this look (another process holds it open, or Windows is
 * still removing it) is a holder too: its `token`, the `pid` its token starts with, `beatAt: null`,
 * `stale: false`, and `null` for whatever else could not be read. A lock folder that is there and
 * cannot be listed at this look is a holder as well, with `token` and `pid` `null` too: nothing of the
 * gate inside is known. So `null` always means a
 * free lock, and `beatAt === null` a lock that is held by a gate whose beat is not known yet: look
 * again. A folder Windows is still removing reads so for an instant.
 *
 * Reads only, and never throws for a lock that changes as it is read. */
export function readGateHolder(home, { now = Date.now, staleMs = GATE_STALE_MS, fileSystem: io = fs } = {}) {
  return lookAt(io, gateLockDir(home), { now, staleMs })?.holder ?? null;
}

/** When the folder of a gate that waits was last touched: the folder or a file in it, whichever is the
 * later. A gate that waits stages its folder again at every poll, so this is its beat. Throws for a
 * folder that cannot be read. */
function lastTouched(io, folder) {
  const entries = [folder, ...io.readdirSync(folder).map((file) => path.join(folder, file))];
  return Math.max(...entries.map((entry) => io.statSync(entry).mtimeMs));
}

/** A gate that waits, as its file says it (`said`, or `{}` for a file that did not read): `{ token, pid,
 * cwd, command, waitingSince, session }`, with `null` for what the file does not say, and for `pid` the
 * one its token starts with. */
const waiterSaid = (said, token) => ({
  token,
  pid: pidOf(said, token),
  cwd: typeof said.cwd === 'string' ? said.cwd : null,
  command: typeof said.command === 'string' ? said.command : null,
  waitingSince: typeof said.waitingSince === 'string' ? said.waitingSince : null,
  session: typeof said.session === 'string' ? said.session : null,
});

/** The gates that wait for the machine's gate lock: `[{ token, pid, cwd, command, waitingSince,
 * session }]`, the one that has waited longest first, with `null` for what a waiter's file does not say
 * (`pid` is then the one its token starts with). `waitingSince` is when its wait began, and `session`
 * the id of the host's session that started it, where it was given one (`takeGateLock`). A folder nothing
 * touched for the stale time is left out: it is the litter of a gate that died waiting, which the next
 * gate that takes the lock sweeps.
 *
 * The order is for a reader, and is not the order of the turn: a wait whose start could not be read is
 * last here, and counts as ahead of every gate where the turn is decided (`gatesAhead`).
 *
 * Reads only. No gate folder is no waiter, and neither is a folder that goes away or cannot be read as
 * it is looked at: a gate whose folder has just become the lock is the holder (`readGateHolder`; a
 * caller that reads both reads the waiters first, so a gate that takes the lock between the two reads is
 * in one of them). Throws when the gate folder is there and cannot be listed. */
export function readGateWaiters(home, { now = Date.now, staleMs = GATE_STALE_MS, fileSystem: io = fs } = {}) {
  const root = gateDir(home);
  const waiters = [];
  for (const name of unless(['ENOENT', 'ENOTDIR'], () => io.readdirSync(root)) ?? []) {
    const token = WAIT_DIR.exec(name)?.[1];
    if (!token) continue;
    const folder = path.join(root, name);
    let touched;
    try {
      touched = lastTouched(io, folder);
    } catch {
      continue;
    }
    if (isStale(touched, now, staleMs)) continue;
    waiters.push(waiterSaid(saidIn(io, path.join(folder, `holder-${token}.json`)), token));
  }
  // A wait whose start is not known sorts last: `~` is above every digit of a date.
  const since = (waiter) => waiter.waitingSince ?? '~';
  return waiters.sort((a, b) => (since(a) < since(b) ? -1 : since(a) > since(b) ? 1 : 0));
}

/** What the file of a gate in the line says, for the turn: the object in it, or `undefined` for a file
 * that did not read at this look (not there yet, busy, or half written: a gate that is at the head writes
 * its file again before each try). Not `saidIn`, which answers `{}` for both: here a file that read and
 * says nothing of a line is a gate of an older version, and one that did not read is a gate of whom
 * nothing is known yet. */
function readInLine(io, file) {
  try {
    const parsed = JSON.parse(io.readFileSync(file, 'utf8'));
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    return undefined;
  }
}

/** The gates that are before the gate `me` (`{ token, since }`, its arrival in milliseconds) in the line
 * for the lock of `root`: `[{ token, since, waiter }]` in the order of their turn, `waiter` being the gate
 * as `readGateWaiters` gives one. Empty when `me` is at the head, which is when it may try the rename, and
 * `null` when no line is kept at this look, beside a gate of an older version (below).
 *
 * The order of the turn is the arrival, then the token: two gates that arrived in the same millisecond
 * compute the same order, each from the other's file. A gate is in the line while it is alive, which is
 * while its folder was touched within the stale time, as `readGateWaiters` judges it: a gate that died
 * stops touching it and is passed a stale time later, which is the longest a free lock waits for a dead
 * gate. A folder that goes away or cannot be read as it is looked at is no gate in the line: it left, or
 * it has just become the lock.
 *
 * `met` is what the take remembers of the other gates, by token. A gate's file is read until it reads,
 * once, and then never again: only its folder's last touch is looked at afterwards, so a file is not read
 * again and again while its owner writes it. Until it reads, nobody knows when that gate arrived, and it
 * counts as ahead: read as behind, a gate that is ahead would be passed for a file that was busy for an
 * instant. It counts so for the stale time from the first look that saw it, and no longer: a file that
 * said nothing for as long as a dead gate is given belongs to no gate that keeps the line. Without that
 * end, two gates that could not read each other's file would each stand back for the other until their
 * bound.
 *
 * A live gate whose file reads and has no mark of the line (`KEEPS_LINE`) is a gate of an older version,
 * as is one whose file never read (above). It takes no turn: it tries the rename at every poll. Beside
 * one, nobody is ahead at this look, whoever else waits, and the gate behaves as before the line. The
 * answer is then `null` and not the empty list: no line is kept at this look, which is not the head of a
 * line that is. Both let the gate try the rename, and the turn is the same for the two. The caller tells
 * them apart for the bound of its wait alone, which a change of hands starts again only where the line is
 * kept (`takeGateLock`): a first version answered `[]` for both, and a gate that lost every race beside
 * a gate of an older version never gave up (found in review, 2026-10-11).
 *
 * Throws when the folder `root` cannot be listed, for its caller to read as no line at all. */
function gatesAhead(io, root, me, met, { now, staleMs }) {
  const ahead = [];
  for (const name of io.readdirSync(root)) {
    const token = WAIT_DIR.exec(name)?.[1];
    if (!token || token === me.token) continue;
    const folder = path.join(root, name);
    let touched;
    try {
      touched = lastTouched(io, folder);
    } catch {
      continue;
    }
    if (isStale(touched, now, staleMs)) continue;
    let gate = met.get(token);
    if (!gate) met.set(token, (gate = { seenAt: now(), read: false, keepsLine: false, since: Infinity, waiter: waiterSaid({}, token) }));
    if (!gate.read) {
      const said = readInLine(io, path.join(folder, `holder-${token}.json`));
      if (said !== undefined) {
        const since = typeof said.waitingSince === 'string' ? Date.parse(said.waitingSince) : NaN;
        Object.assign(gate, { read: true, keepsLine: said.line === KEEPS_LINE && Number.isFinite(since), since, waiter: waiterSaid(said, token) });
      }
    }
    if (gate.read ? !gate.keepsLine : now() - gate.seenAt >= staleMs) return null;
    if (!gate.read || gate.since < me.since || (gate.since === me.since && token < me.token)) ahead.push({ token, since: gate.since, waiter: gate.waiter });
  }
  // A gate whose arrival is not known yet is `Infinity` here: after those whose turn is known.
  return ahead.sort((a, b) => a.since - b.since || (a.token < b.token ? -1 : a.token > b.token ? 1 : 0));
}

/** Removes the folders of gates that died while they waited: nothing touched them for the stale time.
 * Litter, not the lock: whatever cannot be swept now is swept by a later gate. Entry by entry, so one
 * that cannot be read (a file of that name, a waiter that left since the listing) does not keep the
 * dead ones listed after it for ever. */
function sweepWaiters(io, root, own, clock) {
  const quietly = (step) => {
    try {
      return step();
    } catch {
      return undefined;
    }
  };
  for (const name of quietly(() => io.readdirSync(root)) ?? []) {
    if (!WAIT_DIR.test(name) || name === own) continue;
    quietly(() => {
      const folder = path.join(root, name);
      if (isStale(lastTouched(io, folder), clock.now, clock.staleMs)) io.rmSync(folder, { recursive: true, force: true });
    });
  }
}

/** The error of a take that could read nothing of the lock for the whole stale time: what could not be
 * read, since when, and what the system answered last. */
function unreadable(dir, { token, since, answer }) {
  const what = token === null ? 'its folder could not be listed' : "its holder's file could not be looked at";
  const message = `the gate lock at ${dir} could be neither taken nor read: ${what} since ${new Date(since).toISOString()} (${answer})`;
  return Object.assign(new Error(message), { code: 'GATE_LOCK_UNREADABLE' });
}

/** Takes the machine's gate lock for the gate that checks `cwd`, waiting for the gate that holds it.
 *
 * Resolves to `{ release, beat, lost, waitedMs }` once the lock is held. It then beats by itself every
 * `beatMs` (0 for no timer: `beat()` by hand) until `release()`, which removes the holder's file and the
 * folder, and the folder `gate` when nothing else is in it, never throws, and does nothing to a lock that
 * is no longer this gate's. `lost()` says whether the lock was taken from this gate while it held it,
 * which happens only to a gate that did not beat for the whole stale time.
 *
 * The lock is a line: the gate tries the rename, which alone grants the lock, only when no live gate that
 * arrived before it waits (`gatesAhead`). At each turn of its loop it first shows itself in the line, by
 * touching its file, or by making its folder and file again when they are gone, and then reads the line.
 * At the head, it writes its file again and tries the rename, as every gate did before the line. Behind
 * another gate it does everything else it did (it waits for the holder, and clears a dead one on its
 * second stale reading) and leaves the rename to the gate ahead; when it finds the lock free it waits a
 * poll for that gate to take it. It only touches its file meanwhile, so that file reads whole to the gates
 * that read the line from it. Whatever goes wrong as the gate shows itself or reads the line (a folder
 * that cannot be listed, a file that cannot be touched) makes this look one with nobody ahead, which is
 * the take as it was before the line: the line never makes a take reject, and never grants the lock.
 * `session` is the id of the host's session that started the gate, or `null`: it is written in the gate's
 * file for whoever reads the lock (`readGateHolder`, `readGateWaiters`), and is given by the caller, which
 * has the environment; nothing here reads it.
 *
 * Resolves to `{ refused, holder, line, waitedMs, stillMs, besideOlder }` when it is not taken. `refused` is:
 *   - `'held'`, with `wait` off, at once: `holder` holds the lock;
 *   - `'ahead'`, with `wait` off, at once: nobody holds the lock (`holder` is `null`) and a gate that
 *     arrived before this one waits for it, which taking the lock would pass. A gate that died as it
 *     waited refuses so for the stale time after its last touch, and is passed after it;
 *   - `'timeout'`, once the bound of the wait is over (below): `holder` still holds the lock, or is `null`
 *     where the lock was free and the gate ahead had not taken it.
 * What a caller is told is true of what it names: `holder` is the gate that holds the lock, or `null`,
 * and never a gate that only waits. `line` is `{ ahead, head }`: how many gates are before this one, the
 * holder included, and the gate that waits first among them, as `readGateWaiters` gives one, or `null`
 * when only the holder is before this one. `waitedMs` is the whole wait, and `stillMs` how long the lock
 * had not changed hands when the wait ended, as the bound counts it (below): a change of hands that did
 * not start the count again, beside a gate of an older version, is not in it. `besideOlder` is whether a
 * look stood beside a live gate of an older version, which kept no line (`gatesAhead` answered `null`),
 * since the count that ran out last started. Then the bound counted as it did before the line (below), and
 * a refusal for it is worded so by `check`, which says the wait was not counted from the last change of
 * hands alone. A change of hands read after that gate left, while the line was kept, starts the count
 * again and clears it, so a refusal after that is an ordinary one.
 *
 * The bound of a wait is `waitMs` without the lock changing hands, counted from the last time it did and
 * not from the arrival (`boundFrom`, the one place the count is anchored). Counted from the arrival, a
 * gate with four gates of fourteen minutes ahead of it reached its hour while the line moved, was refused
 * and came back at the end of the line: two commits lost an hour each that way on 2026-10-11. The bound is
 * there to give up on a lock that does not move. The count starts again when a look reads a holder whose
 * token is not what the look before it read of the lock, another holder or a free lock, and by nothing
 * else: not by a gate that leaves the line, not by a lock that is free, not by a look that could not tell
 * who holds it. So a holder that never ends is given up on `waitMs` after it took the lock, and a free
 * lock the gate ahead never takes `waitMs` after it last changed hands. No bound is set on the whole of
 * a wait: behind a line that moves, a gate waits for as long as the line is.
 *
 * That is where the line is kept. A change of hands read at a look with a live gate of an older version
 * beside this one (`gatesAhead` answers `null`) does not start the count again. No line is kept there:
 * every gate tries the rename at every poll, this one may lose each of those races, and a count that
 * started again with each new holder would then never end. A first version started it again there too,
 * and a gate that lost every race never gave up, where it gave up `waitMs` after its arrival before the
 * line (found in review, 2026-10-11). So beside such a gate the bound counts as it did before the line:
 * from the arrival, or from the last change of hands that was read while the line was kept. A change that
 * was passed over so is not counted later either, at the first look after the older gate left: what the
 * lock read is kept at every look, and only the anchor stays. A gate of an older version that takes the
 * lock itself is, at the look that reads it as the holder, a gate that waits no more: with no other such
 * gate beside this one, that change does start the count again, since it is a gate that ran.
 *
 * `onWait(holder, leftMs, line)` is called when the wait begins, and again when the gate waited for
 * changes, or when its beat stops being readable or becomes so, with how long that gate is waited for at
 * most from then on: what is left of the bound, which with a new holder is the whole of it where the line
 * is kept (above), or less for a holder that cannot be read (below). So a notice of the minute an unreadable holder is given is never
 * the last word before the whole of a wait. Where the lock is free and a gate ahead is to take it,
 * `holder` is `null` and `line.head` is that gate: told once for each such gate, and again as the holder
 * once it holds the lock. No notice is given only because `line.ahead` changed.
 *
 * Rejects when the lock can be neither taken nor read (a home that cannot be written): there is no gate
 * to wait for, and the caller decides what a gate without a lock does. A holder whose file is there and
 * busy is not that case at first: it is a gate to wait for like any other (`holder.beatAt` is `null`),
 * and it is not taken over while it stays busy. Nor is a lock folder that is there and cannot be listed,
 * once it has stayed so for the second of tries a folder that is being removed is given: it is waited
 * for by polls like any gate (`holder.token` is `null`, and `onWait` says so), refused as `'held'` with
 * `wait` off, and never taken over.
 *
 * Such a holder is waited for inside the bound and for the stale time at most, counted from the first of
 * the looks in a row that could read nothing of it; a look that reads a beat, another holder or a free
 * lock starts the count again. A file that is busy is so for an instant or a few polls. One that stays
 * unreadable for as long as a dead gate is given has shown no gate at all (no access to the folder, for
 * one, which no gate ends): the take rejects with an error of code `GATE_LOCK_UNREADABLE` that says
 * since when nothing could be read, the same case as a lock that cannot be taken. A first version waited
 * for it to the end of `waitMs`, an hour, and then refused: a red gate that blamed another gate when
 * there was none (found in review, 2026-10-10). The same error ends a wait whose bound is shorter than
 * the stale time and in which no look read anything of the lock: it is judged before the end of the
 * bound, since the second version judged it after, and a wait of a minute or less still ended as that red
 * refusal (found in the next review). A holder that one look of the wait did read is a gate that was
 * seen, and its wait times out as any other. Neither verdict rests on a single look that read nothing: a
 * bound that is already over at the first look, which is a `waitMs` of zero, is given one more look a
 * poll later, and that look decides (found in a later review). All of it holds as it did when the bound
 * counted from the arrival: a look that reads nothing of the lock, not even the token of its holder,
 * never starts the count of the bound again, so a lock that cannot be read ends a take when it did.
 *
 * A dead holder is taken over on its second stale reading, a poll apart: a machine that slept wakes with
 * every beat hours old, and a live holder's timer fires before the next look. Its file is then removed
 * in one try. A busy answer there is likely the holder itself, touching its file as it comes back to
 * life, and the two stale readings only say what was true before the removal began: the wait goes on,
 * and the next look reads the beat again, under the same rule. `stillWanted` is asked at every look; when it
 * answers no, the launcher of this gate has ended, and it gives up its place with `refused: 'launcher gone'`.
 * `now`, `sleep` and `fileSystem` are injectable, so a test moves the clock and steps between two file
 * operations. */
export async function takeGateLock({
  home,
  cwd,
  command,
  pid = process.pid,
  session = null,
  wait = true,
  waitMs = GATE_WAIT_MS,
  onWait,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  staleMs = GATE_STALE_MS,
  pollMs = GATE_POLL_MS,
  beatMs = GATE_BEAT_MS,
  fileSystem: io = fs,
  stillWanted = () => true,
}) {
  const root = gateDir(home);
  const dir = gateLockDir(home);
  const clock = { now, staleMs };
  const token = `${pid}-${randomBytes(6).toString('hex')}`;
  const staging = path.join(root, `wait-${token}`);
  const fileName = `holder-${token}.json`;
  const startedWaiting = now();
  // This gate in the line, and what it remembers of the others (`gatesAhead`).
  const me = { token, since: startedWaiting };
  const met = new Map();
  // THE ANCHOR OF THE BOUND: the bound of the wait is counted from `boundFrom`, here and nowhere else.
  // It starts at the arrival and is moved by `handsRead` alone, to the look that saw the lock change
  // hands. To count the bound from the arrival again, as before 2026-10-11, the one line that moves it has
  // to go: every use below then reads the whole wait, and the callers' words follow (`takeGateTurn` says
  // what is left, and tells a lock that moved from one that did not, from the numbers it is given).
  // That is already how it counts beside a gate of an older version, where no line is kept: the same line
  // leaves the anchor where it is at such a look (`handsRead`).
  let boundFrom = startedWaiting;
  // What the last look that could tell read of the lock: `undefined` before any did, `null` for a free
  // lock, else the token of its holder.
  let hands;
  // Whether a look since the count of the bound last started was beside a live gate of an older version
  // (`besideOlder` in each refusal). `handsRead` clears it when it starts the count again.
  let besideOlderSinceCount = false;
  /** Keeps what this look read of the lock: free (`null`) or the token of its holder. A holder whose token
   * is not what the look before read, another holder or a free lock, is the lock changing hands, which
   * starts the count of the bound again; the first thing read does not, there being no change to see, nor
   * does a lock that reads free, nor the same holder read again. A look that could not tell who holds the
   * lock (a folder that could not be listed) is not handed here.
   *
   * `besideOlder` is whether a live gate of an older version was beside this one at this look, so that no
   * line was kept (`gatesAhead` answered `null`). A change of hands read then does not start the count
   * again: every gate races for the rename there, and a gate that lost each race would wait without end
   * (found in review, 2026-10-11). What was read is kept all the same, so that change is not counted later
   * either, at the first look after that gate left: only a change read after it is. Starting the count again
   * clears `besideOlderSinceCount`, so a refusal after that is an ordinary one. */
  const handsRead = (read, besideOlder) => {
    if (read !== null && hands !== undefined && hands !== read && !besideOlder) {
      boundFrom = now();
      besideOlderSinceCount = false;
    }
    hands = read;
  };
  let told;
  let suspect;
  let blind = 0;
  // The lock folder was still there and still not listed when the blind tries were spent: it is waited
  // for by polls from then on, until a look can list it or finds it gone.
  let unlisted = false;
  // The looks in a row that could read nothing of one holder: its token (`null` for a folder that could
  // not be listed), when the first of them was, and what the system answered at the last.
  let unread;
  // Whether any look of this take read something of the lock: a beat, or that nobody holds it.
  let everRead = false;
  // How many looks this take has had at a lock it could not take.
  let looks = 0;

  /** This gate's own folder, with its file as it must read at the instant it becomes the lock: started
   * now, beaten now. Made again when it is gone, which happens to a gate that slept the stale time.
   * While the gate waits, the file says since when, which is its place in the line, that it keeps the line,
   * and which session started it (`readGateWaiters`, `gatesAhead`). */
  const stage = () => {
    const at = new Date(now());
    io.mkdirSync(staging, { recursive: true });
    const file = path.join(staging, fileName);
    const says = {
      token,
      pid,
      cwd,
      command,
      startedAt: at.toISOString(),
      waitingSince: new Date(startedWaiting).toISOString(),
      line: KEEPS_LINE,
      session: typeof session === 'string' && session !== '' ? session : null,
    };
    io.writeFileSync(file, `${JSON.stringify(says)}\n`);
    io.utimesSync(file, at, at);
  };
  /** Shows this gate in the line, which is the first thing a turn of the loop does: touches its file, so
   * that its folder reads as a live gate's, and stages the folder when it is not there, at the first turn
   * and after another gate swept it as a dead one's. Returns whether the file was written whole just now,
   * which is what a gate at the head needs before its rename. A gate that only waits is not to write its
   * file again at every poll: a file that is being written reads empty to the gates that read the line
   * from it. */
  const showUp = () => {
    const at = new Date(now());
    try {
      io.utimesSync(path.join(staging, fileName), at, at);
      return false;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    stage();
    return true;
  };
  const unstage = () => {
    try {
      remove(io, staging, { recursive: true, force: true });
    } catch {
      // swept later, as the folder of a gate that waits no more
    }
    leaveNoFolder(io, root);
  };
  /** One more try that found neither the lock nor a holder to name; `false` past the last one. */
  const tryBlind = async () => {
    blind += 1;
    if (blind > BLIND_TRIES) return false;
    if (blind > 1) await sleep(BLIND_PAUSE_MS);
    return true;
  };

  for (;;) {
    // Before anything of the look: a gate whose launcher has ended (`stillWanted`, ./launcher.mjs) is an
    // orphan, whose turn would run a script nobody waits for (odd/tasks/orphan-gate.md). It gives up its place
    // in the line and takes nothing, at the first look that finds it so, the head of the line included.
    if (!stillWanted()) {
      unstage();
      const at = now();
      return { refused: 'launcher gone', holder: null, line: null, waitedMs: at - startedWaiting, stillMs: at - boundFrom, besideOlder: besideOlderSinceCount };
    }
    // The line first: this gate shows itself in it, and reads who is before it. Whatever fails here (its
    // file cannot be touched, its folder cannot be made, the gate folder cannot be listed) leaves a look
    // with nobody ahead: what follows is then the take as it was before the line, with its own answer to
    // each of those failures. So the line can cost a gate its place, and never a take.
    let fresh = false;
    let ahead = [];
    // Whether no line is kept at this look because a live gate of an older version is beside this one. The
    // turn is that of a look with nobody ahead; only the bound reads the difference (`handsRead`). A line
    // that could not be read is not that case: nothing says a gate races there.
    let besideOlder = false;
    try {
      fresh = showUp();
      const before = gatesAhead(io, root, me, met, clock);
      besideOlder = before === null;
      ahead = before ?? [];
    } catch {
      ahead = [];
    }
    if (besideOlder) besideOlderSinceCount = true;
    // The rename is tried at the head of the line only. It is still the one step that grants the lock:
    // two gates that both read themselves at the head both try it, and the file system lets one through.
    // `refusedBy` is what it answered; it stays `undefined` for a gate that left it to the gate ahead.
    const atHead = ahead.length === 0;
    let refusedBy;
    if (atHead) {
      try {
        // Written whole, unless this turn has just done so: started now, at the instant it becomes the lock.
        if (!fresh) stage();
        io.renameSync(staging, dir);
      } catch (err) {
        // ENOENT: the staging folder was swept between its making and the rename.
        if (!TAKEN.includes(err.code) && err.code !== 'ENOENT') {
          unstage();
          throw err;
        }
        refusedBy = err;
      }
      if (!refusedBy) {
        sweepWaiters(io, root, path.basename(staging), clock);
        return held({ io, root, dir, mine: path.join(dir, fileName), now, beatMs, waitedMs: now() - startedWaiting });
      }
    }

    const seen = lookAt(io, dir, clock);
    looks += 1;
    // Nothing read of the holder: the same one as at the look before, or the first such look of it.
    if (seen?.holder?.beatAt !== null) {
      unread = undefined;
      everRead = true;
    } else if (!unread || unread.token !== seen.holder.token) unread = { token: seen.holder.token, since: now(), answer: seen.unread };
    else unread.answer = seen.unread;
    // No file to name: the folder is there and could not be listed.
    const nobodyKnown = seen?.holder !== undefined && seen.file === undefined;
    // What this look read of the lock, for the bound: free, or whose it is. Not a folder that could not be
    // listed, of which nothing was read.
    if (!nobodyKnown) handsRead(seen?.holder?.token ?? null, besideOlder);
    // What a caller is told of the line: the gates before this one, the holder included. A gate ahead whose
    // token is the holder's read at this look became the holder between the line and the lock (its folder
    // was renamed to `lock` meanwhile): it is counted once, as the holder, and is no gate that waits, so it
    // is no head of the line either. Found in review, 2026-10-11. This is what `line` reports only; `atHead`
    // and the rename are decided before it.
    const waitingAhead = ahead.filter(({ token: waiting }) => waiting !== seen?.holder?.token);
    const line = { ahead: waitingAhead.length + (seen?.holder ? 1 : 0), head: waitingAhead[0]?.waiter ?? null };

    if (!seen?.holder && !atHead) {
      // The lock is free and a gate is ahead: the turn is that gate's, which takes the lock at its next
      // poll. This gate says whom it stands behind, sleeps a poll and looks again. A branch of its own,
      // before the one below, which is for a gate whose rename was refused: that one spends its blind
      // tries and then throws what the rename answered, and this gate tried no rename. The bound and the
      // refusals are those of a wait for a holder; the gate ahead is named as what it is, a gate that
      // waits, and the holder's place is left empty. An empty lock folder is left to the gate ahead too,
      // which clears it as it takes the lock.
      blind = 0;
      unlisted = false;
      suspect = undefined;
      const at = now();
      const waitedMs = at - startedWaiting;
      const stillMs = at - boundFrom;
      // With `wait` off a gate ahead is a refusal, as a holder is: taking the lock would pass it.
      const refused = !wait ? 'ahead' : stillMs >= waitMs ? 'timeout' : undefined;
      if (refused) {
        unstage();
        return { refused, holder: null, line, waitedMs, stillMs, besideOlder: besideOlderSinceCount };
      }
      // Said once for each gate stood behind, as for each holder waited for.
      const telling = `behind|${ahead[0].token}`;
      if (told !== telling) {
        told = telling;
        onWait?.(null, waitMs - stillMs, line);
      }
      await sleep(pollMs);
      continue;
    }

    if (!seen?.holder || (nobodyKnown && !unlisted)) {
      // No folder (released since the rename failed), or an empty one, which is nobody's: clear it and
      // take the lock at once. One that could not be listed may be on its way out: tried again as well.
      if (seen && !nobodyKnown) unless(['ENOENT', 'ENOTEMPTY', 'EEXIST', ...BUSY], () => io.rmdirSync(dir));
      if (await tryBlind()) continue;
      // No holder to name, so this gate was at the head (a free lock with a gate ahead went the way of the
      // branch above), tried the rename, and `refusedBy` is what it answered.
      if (!nobodyKnown) {
        unstage();
        throw refusedBy;
      }
    }
    blind = 0;
    unlisted = nobodyKnown;
    const { file, holder } = seen;
    if (holder.stale) {
      // The same file with the same beat, seen stale twice: nothing touched it in between.
      const sighting = `${file}@${holder.beatAt}`;
      if (suspect === sighting) {
        suspect = undefined;
        // Gone already when another gate removed it first. One try, and not `remove`: a busy answer is
        // waited for and the file looked at again, since it may have beaten in that instant. A dead
        // holder's reads stale next time as well.
        const gone = unless(BUSY, () => (unless(['ENOENT'], () => io.rmSync(file)), true));
        unless(['ENOENT', 'ENOTEMPTY', 'EEXIST', ...BUSY], () => io.rmdirSync(dir));
        if (gone) continue;
      } else {
        suspect = sighting;
      }
    } else {
      suspect = undefined;
    }

    const at = now();
    const waitedMs = at - startedWaiting;
    // How long the lock has not changed hands, which is what the bound is set on, and whether the bound is
    // over. `waitedMs` is the whole wait, and is only reported.
    const stillMs = at - boundFrom;
    const over = stillMs >= waitMs;
    // Unreadable for as long as a dead gate is given, or from end to end of a bound shorter than that:
    // nothing ever showed a gate here. Judged before the end of the bound, which would blame a gate.
    const unreadMs = unread ? at - unread.since : 0;
    // Not on one look, though: a bound that is over at the first look (a wait of zero, which `check`
    // cannot ask for and a caller of this can) gets one more a poll later, and the verdict is that
    // look's: the lock taken, a holder that was read and times the wait out, or the error below.
    if (unread && wait && over && looks === 1) {
      await sleep(pollMs);
      continue;
    }
    if (unread && (unreadMs >= staleMs || (wait && over && !everRead))) {
      unstage();
      throw unreadable(dir, unread);
    }
    // A dead holder is no gate to be refused for: with `wait` off its second reading is still waited for.
    // Behind a gate ahead as well: the dead holder is cleared, and the next look finds the lock free and
    // that gate ahead, which is the refusal of the branch above.
    const refused = !wait && !holder.stale ? 'held' : over ? 'timeout' : undefined;
    if (refused) {
      unstage();
      return { refused, holder, line, waitedMs, stillMs, besideOlder: besideOlderSinceCount };
    }
    // Said for each gate waited for, and again when its beat stops being readable or becomes so: what is
    // left of the wait is not the same for the two. With a new holder what is left of the bound is the
    // whole of it, since the lock has just changed hands; beside a gate of an older version it is what is
    // left since the anchor, which that change did not move.
    const telling = `${holder.token}|${unread ? 'unread' : 'read'}`;
    if (wait && told !== telling) {
      told = telling;
      onWait?.(holder, Math.min(waitMs - stillMs, unread ? staleMs - unreadMs : Infinity), line);
    }
    await sleep(pollMs);
  }
}

/** The handle of a lock that is held: its beat, its release, and whether it was lost. */
function held({ io, root, dir, mine, now, beatMs, waitedMs }) {
  let released = false;
  let lost = false;
  const beat = () => {
    if (released || lost) return;
    const at = new Date(now());
    try {
      io.utimesSync(mine, at, at);
    } catch (err) {
      // Gone: another gate took the lock as a dead one's. Anything else is a beat that failed once,
      // and the next one may not.
      if (err.code === 'ENOENT') lost = true;
    }
  };
  // Never the reason the process stays alive: the gate ends when its sensors do.
  const timer = beatMs > 0 ? setInterval(beat, beatMs) : undefined;
  timer?.unref();
  const release = () => {
    if (released) return;
    released = true;
    clearInterval(timer);
    try {
      remove(io, mine);
      io.rmdirSync(dir);
    } catch {
      // Not ours any more, or a folder the next gate already cleared: the gate's result stands either
      // way. So it does when the file stayed busy past every try: it holds the lock, beating no more,
      // until the next gate reads it stale.
    }
    leaveNoFolder(io, root);
  };
  /** Whether this gate's file is not there. A file that could not be looked at (busy, or no access) is
   * not a file that was taken away, which is what `existsSync` would say of it. */
  const notThere = () => {
    try {
      io.statSync(mine);
      return false;
    } catch (err) {
      return err.code === 'ENOENT';
    }
  };
  return {
    release,
    beat,
    lost: () => lost || (!released && notThere()),
    waitedMs,
  };
}

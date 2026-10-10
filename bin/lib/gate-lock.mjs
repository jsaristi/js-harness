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
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/** How often a holder touches its file. */
export const GATE_BEAT_MS = 5_000;
/** A holder that has not beaten for this long died. Twelve beats: a timer that late is no timer. */
export const GATE_STALE_MS = 60_000;
/** How often a waiting gate looks again. */
export const GATE_POLL_MS = 2_000;
/** How long a gate waits for the lock before it gives up. */
export const GATE_WAIT_MS = 60 * 60_000;

const HOLDER_FILE = /^holder-(.+)\.json$/;
const WAIT_DIR = /^wait-(.+)$/;
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
    startedAt: typeof said.startedAt === 'string' ? said.startedAt : null,
    beatAt,
    stale: beatAt !== null && isStale(beatAt, now, staleMs),
  };
}

/** The holder that is read when the lock folder is there and nothing in it can be: not even a token. It
 * is not stale, as a holder whose beat could not be read is not. */
const NOBODY_KNOWN = { token: null, pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false };

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

/** Who holds the machine's gate lock: `null` when nobody does, else `{ token, pid, cwd, command,
 * startedAt, beatAt, stale }`, with `null` for what the holder's file does not say and `stale` true
 * for a holder that stopped beating, whose lock the next gate takes over.
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

/** The gates that wait for the machine's gate lock: `[{ token, pid, cwd, command, waitingSince }]`, the
 * one that has waited longest first, with `null` for what a waiter's file does not say (`pid` is then
 * the one its token starts with). `waitingSince` is when its wait began, which its file says at every
 * poll. A folder nothing touched for the stale time is left out: it is the litter of a gate that died
 * waiting, which the next gate that takes the lock sweeps.
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
    const said = saidIn(io, path.join(folder, `holder-${token}.json`));
    waiters.push({
      token,
      pid: pidOf(said, token),
      cwd: typeof said.cwd === 'string' ? said.cwd : null,
      command: typeof said.command === 'string' ? said.command : null,
      waitingSince: typeof said.waitingSince === 'string' ? said.waitingSince : null,
    });
  }
  // A wait whose start is not known sorts last: `~` is above every digit of a date.
  const since = (waiter) => waiter.waitingSince ?? '~';
  return waiters.sort((a, b) => (since(a) < since(b) ? -1 : since(a) > since(b) ? 1 : 0));
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
 * Resolves to `{ refused, holder, waitedMs }` when it is not taken: `refused` is `'held'` with `wait`
 * off, at once, and `'timeout'` once `waitMs` have passed. `onWait(holder, leftMs)` is called when the
 * wait begins, and again when the gate waited for changes, or when its beat stops being readable or
 * becomes so, with how long that gate is waited for at most from then on: what is left of `waitMs`, or
 * less for a holder that cannot be read (below). So a notice of the minute an unreadable holder is given
 * is never the last word before the whole of a wait.
 *
 * Rejects when the lock can be neither taken nor read (a home that cannot be written): there is no gate
 * to wait for, and the caller decides what a gate without a lock does. A holder whose file is there and
 * busy is not that case at first: it is a gate to wait for like any other (`holder.beatAt` is `null`),
 * and it is not taken over while it stays busy. Nor is a lock folder that is there and cannot be listed,
 * once it has stayed so for the second of tries a folder that is being removed is given: it is waited
 * for by polls like any gate (`holder.token` is `null`, and `onWait` says so), refused as `'held'` with
 * `wait` off, and never taken over.
 *
 * Such a holder is waited for inside `waitMs` and for the stale time at most, counted from the first of
 * the looks in a row that could read nothing of it; a look that reads a beat, another holder or a free
 * lock starts the count again. A file that is busy is so for an instant or a few polls. One that stays
 * unreadable for as long as a dead gate is given has shown no gate at all (no access to the folder, for
 * one, which no gate ends): the take rejects with an error of code `GATE_LOCK_UNREADABLE` that says
 * since when nothing could be read, the same case as a lock that cannot be taken. A first version waited
 * for it to the end of `waitMs`, an hour, and then refused: a red gate that blamed another gate when
 * there was none (found in review, 2026-10-10). The same error ends a wait shorter than the stale time in
 * which no look read anything of the lock: it is judged before the end of the wait, since the second
 * version judged it after, and a wait of a minute or less still ended as that red refusal (found in the
 * next review). A holder that one look of the wait did read is a gate that was seen, and its wait times
 * out as any other. Neither verdict rests on a single look that read nothing: a wait that is already
 * over at the first look, which is a `waitMs` of zero, is given one more look a poll later, and that
 * look decides (found in a later review).
 *
 * A dead holder is taken over on its second stale reading, a poll apart: a machine that slept wakes with
 * every beat hours old, and a live holder's timer fires before the next look. Its file is then removed
 * in one try. A busy answer there is likely the holder itself, touching its file as it comes back to
 * life, and the two stale readings only say what was true before the removal began: the wait goes on,
 * and the next look reads the beat again, under the same rule. `now`, `sleep` and `fileSystem` are
 * injectable, so a test moves the clock and steps between two file operations. */
export async function takeGateLock({
  home,
  cwd,
  command,
  pid = process.pid,
  wait = true,
  waitMs = GATE_WAIT_MS,
  onWait,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  staleMs = GATE_STALE_MS,
  pollMs = GATE_POLL_MS,
  beatMs = GATE_BEAT_MS,
  fileSystem: io = fs,
}) {
  const root = gateDir(home);
  const dir = gateLockDir(home);
  const clock = { now, staleMs };
  const token = `${pid}-${randomBytes(6).toString('hex')}`;
  const staging = path.join(root, `wait-${token}`);
  const fileName = `holder-${token}.json`;
  const startedWaiting = now();
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
   * While the gate waits, the file says since when (`readGateWaiters`). */
  const stage = () => {
    const at = new Date(now());
    io.mkdirSync(staging, { recursive: true });
    const file = path.join(staging, fileName);
    const says = { token, pid, cwd, command, startedAt: at.toISOString(), waitingSince: new Date(startedWaiting).toISOString() };
    io.writeFileSync(file, `${JSON.stringify(says)}\n`);
    io.utimesSync(file, at, at);
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
    let refusedBy;
    try {
      stage();
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
    if (!seen?.holder || (nobodyKnown && !unlisted)) {
      // No folder (released since the rename failed), or an empty one, which is nobody's: clear it and
      // take the lock at once. One that could not be listed may be on its way out: tried again as well.
      if (seen && !nobodyKnown) unless(['ENOENT', 'ENOTEMPTY', 'EEXIST', ...BUSY], () => io.rmdirSync(dir));
      if (await tryBlind()) continue;
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
    // Unreadable for as long as a dead gate is given, or from end to end of a wait shorter than that:
    // nothing ever showed a gate here. Judged before the end of the wait, which would blame a gate.
    const unreadMs = unread ? at - unread.since : 0;
    // Not on one look, though: a wait that is over at the first look (a wait of zero, which `check`
    // cannot ask for and a caller of this can) gets one more a poll later, and the verdict is that
    // look's: the lock taken, a holder that was read and times the wait out, or the error below.
    if (unread && wait && waitedMs >= waitMs && looks === 1) {
      await sleep(pollMs);
      continue;
    }
    if (unread && (unreadMs >= staleMs || (wait && waitedMs >= waitMs && !everRead))) {
      unstage();
      throw unreadable(dir, unread);
    }
    // A dead holder is no gate to be refused for: with `wait` off its second reading is still waited for.
    const refused = !wait && !holder.stale ? 'held' : waitedMs >= waitMs ? 'timeout' : undefined;
    if (refused) {
      unstage();
      return { refused, holder, waitedMs };
    }
    // Said for each gate waited for, and again when its beat stops being readable or becomes so: what is
    // left of the wait is not the same for the two.
    const telling = `${holder.token}|${unread ? 'unread' : 'read'}`;
    if (wait && told !== telling) {
      told = telling;
      onWait?.(holder, Math.min(waitMs - waitedMs, unread ? staleMs - unreadMs : Infinity));
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

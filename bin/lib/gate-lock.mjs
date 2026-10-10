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
//   - the lock of a gate that died is taken over by removing that holder's file by its name, which holds
//     its token; a gate that took the lock in the meantime has another name;
//   - the folder is removed with `rmdir`, which fails while a holder's file is in it. An empty `lock` is
//     nobody's (a release or a takeover is between its two steps, or died there), so anyone may remove it.
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
// What Windows answers for a file or a folder that is being removed while a handle is still open on it.
const BUSY = ['EPERM', 'EACCES', 'EBUSY'];
// What a rename onto `lock` answers when `lock` is there: by system, and by what `lock` is.
const TAKEN = ['EEXIST', 'ENOTEMPTY', 'ENOTDIR', 'EISDIR', ...BUSY];
// A take that neither succeeds nor finds a holder to wait for is tried again this many times, this far
// apart: a folder Windows is still removing is gone in a moment, a home that cannot be written is not.
const BLIND_TRIES = 40;
const BLIND_PAUSE_MS = 25;
// A holder's file another process is reading at that instant cannot always be removed on Windows; a
// file left behind would hold the lock, beating no more, for the whole stale time.
const RETRY_BUSY = { maxRetries: 5, retryDelay: 20 };

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

const isStale = (beatAt, now, staleMs) => now() - beatAt > staleMs;

/** What a holder's file says, as far as it can be read: a file that is not ours names nobody and still
 * holds by its beat. */
function holderOf(io, file, token, beatAt, { now, staleMs }) {
  let said = {};
  try {
    const parsed = JSON.parse(io.readFileSync(file, 'utf8'));
    if (parsed !== null && typeof parsed === 'object') said = parsed;
  } catch {
    // unreadable: nobody is named
  }
  return {
    token,
    pid: Number.isInteger(said.pid) ? said.pid : null,
    cwd: typeof said.cwd === 'string' ? said.cwd : null,
    command: typeof said.command === 'string' ? said.command : null,
    startedAt: typeof said.startedAt === 'string' ? said.startedAt : null,
    beatAt,
    stale: isStale(beatAt, now, staleMs),
  };
}

/** What is in the lock folder now: `null` when there is no folder to read, `{}` when it is empty, else
 * `{ file, holder }` for the holder that beat last. A file that is going away as it is looked at (a busy
 * answer on Windows) is not there. */
function lookAt(io, dir, clock) {
  const names = unless(['ENOENT', 'ENOTDIR', ...BUSY], () => io.readdirSync(dir));
  if (names === undefined) return null;
  const found = [];
  for (const name of names) {
    const token = HOLDER_FILE.exec(name)?.[1];
    if (!token) continue;
    const file = path.join(dir, name);
    const beatAt = unless(['ENOENT', ...BUSY], () => io.statSync(file).mtimeMs);
    if (beatAt !== undefined) found.push({ file, holder: holderOf(io, file, token, beatAt, clock) });
  }
  return found.sort((a, b) => b.holder.beatAt - a.holder.beatAt)[0] ?? {};
}

/** Who holds the machine's gate lock: `null` when nobody does, else `{ token, pid, cwd, command,
 * startedAt, beatAt, stale }`, with `null` for what the holder's file does not say and `stale` true
 * for a holder that stopped beating, whose lock the next gate takes over. Reads only, and never throws
 * for a lock that changes as it is read. */
export function readGateHolder(home, { now = Date.now, staleMs = GATE_STALE_MS, fileSystem: io = fs } = {}) {
  return lookAt(io, gateLockDir(home), { now, staleMs })?.holder ?? null;
}

/** Removes the folders of gates that died while they waited: nothing touched them for the stale time. */
function sweepWaiters(io, root, own, clock) {
  try {
    for (const name of io.readdirSync(root)) {
      if (!WAIT_DIR.test(name) || name === own) continue;
      const folder = path.join(root, name);
      const entries = [folder, ...io.readdirSync(folder).map((file) => path.join(folder, file))];
      const touched = Math.max(...entries.map((entry) => io.statSync(entry).mtimeMs));
      if (isStale(touched, clock.now, clock.staleMs)) io.rmSync(folder, { recursive: true, force: true });
    }
  } catch {
    // Litter, not the lock: whatever could not be swept now is swept by a later gate.
  }
}

/** Takes the machine's gate lock for the gate that checks `cwd`, waiting for the gate that holds it.
 *
 * Resolves to `{ release, beat, lost, waitedMs }` once the lock is held. It then beats by itself every
 * `beatMs` (0 for no timer: `beat()` by hand) until `release()`, which removes the holder's file and the
 * folder, never throws, and does nothing to a lock that is no longer this gate's. `lost()` says whether
 * the lock was taken from this gate while it held it, which happens only to a gate that did not beat for
 * the whole stale time.
 *
 * Resolves to `{ refused, holder, waitedMs }` when it is not taken: `refused` is `'held'` with `wait`
 * off, at once, and `'timeout'` once `waitMs` have passed. `onWait(holder)` is called when the wait
 * begins, and again when the gate waited for changes.
 *
 * Rejects when the lock can be neither taken nor read (a home that cannot be written): there is no gate
 * to wait for, and the caller decides what a gate without a lock does.
 *
 * A dead holder is taken over on its second stale reading, a poll apart: a machine that slept wakes with
 * every beat hours old, and a live holder's timer fires before the next look. `now`, `sleep` and
 * `fileSystem` are injectable, so a test moves the clock and steps between two file operations. */
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

  /** This gate's own folder, with its file as it must read at the instant it becomes the lock: started
   * now, beaten now. Made again when it is gone, which happens to a gate that slept the stale time. */
  const stage = () => {
    const at = new Date(now());
    io.mkdirSync(staging, { recursive: true });
    const file = path.join(staging, fileName);
    io.writeFileSync(file, `${JSON.stringify({ token, pid, cwd, command, startedAt: at.toISOString() })}\n`);
    io.utimesSync(file, at, at);
  };
  const unstage = () => {
    try {
      io.rmSync(staging, { recursive: true, force: true, ...RETRY_BUSY });
    } catch {
      // swept later, as the folder of a gate that waits no more
    }
  };
  /** One more try that found neither the lock nor a holder; past the last one, what the file system said. */
  const tryBlind = async (err) => {
    blind += 1;
    if (blind > BLIND_TRIES) {
      unstage();
      throw err;
    }
    if (blind > 1) await sleep(BLIND_PAUSE_MS);
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
      return held({ io, dir, mine: path.join(dir, fileName), now, beatMs, waitedMs: now() - startedWaiting });
    }

    const seen = lookAt(io, dir, clock);
    if (!seen?.holder) {
      // No folder (released since the rename failed), or an empty one, which is nobody's: clear it and
      // take the lock at once.
      if (seen) unless(['ENOENT', 'ENOTEMPTY', 'EEXIST', ...BUSY], () => io.rmdirSync(dir));
      await tryBlind(refusedBy);
      continue;
    }
    blind = 0;
    const { file, holder } = seen;
    if (holder.stale) {
      // The same file with the same beat, seen stale twice: nothing touched it in between.
      const sighting = `${file}@${holder.beatAt}`;
      if (suspect === sighting) {
        suspect = undefined;
        // Gone already when another gate removed it first. A file that cannot be removed now is waited
        // for and looked at again: it reads stale next time as well.
        const gone = unless(BUSY, () => (unless(['ENOENT'], () => io.rmSync(file, RETRY_BUSY)), true));
        unless(['ENOENT', 'ENOTEMPTY', 'EEXIST', ...BUSY], () => io.rmdirSync(dir));
        if (gone) continue;
      } else {
        suspect = sighting;
      }
    } else {
      suspect = undefined;
    }

    const waitedMs = now() - startedWaiting;
    // A dead holder is no gate to be refused for: with `wait` off its second reading is still waited for.
    const refused = !wait && !holder.stale ? 'held' : waitedMs >= waitMs ? 'timeout' : undefined;
    if (refused) {
      unstage();
      return { refused, holder, waitedMs };
    }
    if (wait && told !== holder.token) {
      told = holder.token;
      onWait?.(holder);
    }
    await sleep(pollMs);
  }
}

/** The handle of a lock that is held: its beat, its release, and whether it was lost. */
function held({ io, dir, mine, now, beatMs, waitedMs }) {
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
      io.rmSync(mine, RETRY_BUSY);
      io.rmdirSync(dir);
    } catch {
      // Not ours any more, or a folder the next gate already cleared: the gate's result stands either way.
    }
  };
  return {
    release,
    beat,
    lost: () => lost || (!released && !io.existsSync(mine)),
    waitedMs,
  };
}

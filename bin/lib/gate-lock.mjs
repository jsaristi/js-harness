// The machine's gate lock: `<home>/.js-harness/gate.lock/`, a folder that holds one file,
// `holder-<token>.json`, while a gate runs its sensors. Two gates at once on one machine make both miss
// their time bound with every test green, and the rule "never two at once" cannot be kept from outside the
// gate: two sessions that both look, see none and start have both kept it.
//
// Every step is one the file system grants to a single process, and names exactly what it acts on:
//   - taking the lock is `mkdir` of the folder, which fails when it exists;
//   - a holder is alive by its beat: it touches its own file every few seconds, so nothing has to ask the
//     system who a pid is (which costs a PowerShell snapshot on Windows and is fooled by a recycled pid);
//   - the lock of a gate that died is taken over by removing that holder's file by its name, which holds
//     its token. A gate that took the lock in the meantime has another name, so it cannot be removed by
//     mistake, and of two gates that remove the same dead holder only one finds the file;
//   - the folder is removed with `rmdir`, which fails while a holder's file is in it.
// A gate whose folder was removed between its `mkdir` and its file (it stalled for the whole stale time)
// finds that out when the file cannot be written, and starts again. So no gate holds the lock without
// its file in the folder, and no two files of live gates are ever in it.
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
// What Windows answers for a folder that is being removed while a handle is still open on it.
const BUSY = new Set(['EPERM', 'EACCES', 'EBUSY']);
const NO_FOLDER_TRIES = 40;
const NO_FOLDER_PAUSE_MS = 25;
// A holder's file another process is reading at that instant cannot always be removed on Windows; a
// file left behind would hold the lock, beating no more, for the whole stale time.
const RETRY_BUSY = { maxRetries: 5, retryDelay: 20 };

export function gateLockDir(home) {
  return path.join(home, '.js-harness', 'gate.lock');
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

/** What a holder's file says, as far as it can be read: a file that is still being written, or is not
 * ours, names nobody and still holds by its beat. */
function holderOf(file, token, beatAt, { now, staleMs }) {
  let said = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
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

/** What is in the lock folder now: `null` when there is no folder, else `{ file, holder }` for the holder
 * that beat last, with `file` undefined and a holder that names nobody while the folder is empty (a gate
 * is between its `mkdir` and its file, or died there; the folder's own time says which). */
function lookAt(dir, clock) {
  const names = unless(['ENOENT', 'ENOTDIR', ...BUSY], () => fs.readdirSync(dir));
  if (names === undefined) return null;
  const found = [];
  for (const name of names) {
    const token = HOLDER_FILE.exec(name)?.[1];
    if (!token) continue;
    const file = path.join(dir, name);
    const beatAt = unless(['ENOENT'], () => fs.statSync(file).mtimeMs);
    if (beatAt !== undefined) found.push({ file, holder: holderOf(file, token, beatAt, clock) });
  }
  if (found.length) return found.sort((a, b) => b.holder.beatAt - a.holder.beatAt)[0];
  const madeAt = unless(['ENOENT'], () => fs.statSync(dir).mtimeMs);
  if (madeAt === undefined) return null;
  const nobody = { token: null, pid: null, cwd: null, command: null, startedAt: null, beatAt: madeAt, stale: isStale(madeAt, clock.now, clock.staleMs) };
  return { file: undefined, holder: nobody };
}

/** Who holds the machine's gate lock: `null` when nobody does, else `{ token, pid, cwd, command,
 * startedAt, beatAt, stale }`, with `null` for what the holder's file does not say and `stale` true
 * for a holder that stopped beating, whose lock the next gate takes over. Reads only. */
export function readGateHolder(home, { now = Date.now, staleMs = GATE_STALE_MS } = {}) {
  return lookAt(gateLockDir(home), { now, staleMs })?.holder ?? null;
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
 * A dead holder is taken over on its second stale reading, a poll apart: a machine that slept wakes with
 * every beat hours old, and a live holder's timer fires before the next look. `now` and `sleep` are
 * injectable, so a test moves the clock instead of waiting. */
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
}) {
  const dir = gateLockDir(home);
  const clock = { now, staleMs };
  const token = `${pid}-${randomBytes(6).toString('hex')}`;
  const mine = path.join(dir, `holder-${token}.json`);
  const startedWaiting = now();
  let told;
  let suspect;
  fs.mkdirSync(path.dirname(dir), { recursive: true });

  let refusedBy;
  let refusals = 0;
  for (;;) {
    refusedBy = undefined;
    try {
      fs.mkdirSync(dir);
    } catch (err) {
      if (err.code !== 'EEXIST' && !BUSY.has(err.code)) throw err;
      refusedBy = err;
    }
    if (!refusedBy) {
      const at = new Date(now());
      const text = `${JSON.stringify({ token, pid, cwd, command, startedAt: at.toISOString() })}\n`;
      const written = unless(['ENOENT'], () => {
        fs.writeFileSync(mine, text, { flag: 'wx' });
        fs.utimesSync(mine, at, at);
        return true;
      });
      if (written) return held({ dir, mine, now, beatMs, waitedMs: now() - startedWaiting });
      continue; // the folder was removed under us as a dead gate's: take it again
    }

    const seen = lookAt(dir, clock);
    if (seen === null) {
      // Released since the mkdir failed: take it at once. But a folder that cannot be made and is not
      // there either is no lock held by anyone (a home that cannot be written, a folder Windows is
      // still removing): look again a few times, then say what the file system said.
      refusals += 1;
      if (refusals > NO_FOLDER_TRIES) throw refusedBy;
      if (refusedBy.code !== 'EEXIST' || refusals > 1) await sleep(NO_FOLDER_PAUSE_MS);
      continue;
    }
    refusals = 0;
    const { file, holder } = seen;
    if (holder.stale) {
      // The same file with the same beat, seen stale twice: nothing touched it in between.
      const sighting = `${file ?? ''}@${holder.beatAt}`;
      if (suspect === sighting) {
        suspect = undefined;
        if (file) unless(['ENOENT'], () => fs.rmSync(file, RETRY_BUSY));
        unless(['ENOENT', 'ENOTEMPTY', 'EEXIST', ...BUSY], () => fs.rmdirSync(dir));
        continue;
      }
      suspect = sighting;
    } else {
      suspect = undefined;
    }

    const waitedMs = now() - startedWaiting;
    // A dead holder is no gate to be refused for: with `wait` off the second reading is still waited for.
    if (!wait && !holder.stale) return { refused: 'held', holder, waitedMs };
    if (waitedMs >= waitMs) return { refused: 'timeout', holder, waitedMs };
    if (wait && told !== holder.token) {
      told = holder.token;
      onWait?.(holder);
    }
    await sleep(pollMs);
  }
}

/** The handle of a lock that is held: its beat, its release, and whether it was lost. */
function held({ dir, mine, now, beatMs, waitedMs }) {
  let released = false;
  let lost = false;
  const beat = () => {
    if (released || lost) return;
    const at = new Date(now());
    try {
      fs.utimesSync(mine, at, at);
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
      fs.rmSync(mine, RETRY_BUSY);
      fs.rmdirSync(dir);
    } catch {
      // Not ours any more, or a folder another gate is already in: the gate's result stands either way.
    }
  };
  return {
    release,
    beat,
    lost: () => lost || (!released && !fs.existsSync(mine)),
    waitedMs,
  };
}

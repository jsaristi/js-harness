// The atomic write of a JSON record: a fresh temporary sibling, then one rename over the target, so a reader never
// sees half a record and a failure leaves the one there before. The machine manifest (./manifest.mjs) and a
// project's (./project.mjs) are written through it; it moved out of manifest.mjs, over its size ceiling, as is.
// `replaceFile` does the same for a file's text as it is, and `replaceText` for a text file of the user's, keeping a
// linked file a link and its mode: the user's Claude settings and the Rules block of his CLAUDE.md (./rules-block.mjs).
import crypto from 'node:crypto';
import fs from 'node:fs';

/** Writes `data` to `target` atomically: serialized to a uniquely-named `.tmp` sibling first
 * (`<target>.<pid>.<random>.tmp`, created exclusively with `flag: 'wx'` so it is always a brand
 * new file — never opened through something already there, ordinary file or link, T2e item 3),
 * then a single rename over `target`, so a reader never sees a partially-written manifest and a
 * failure never corrupts or truncates whatever was there before. `target` itself is never touched
 * directly — matters most for the codegraph-retry update, which must not lose an existing, valid
 * manifest just because this write failed partway through (T2d Codex P2 atomic manifest writes).
 *
 * `deps` (`{ open, write, close }`, each independently injectable, defaulting to real
 * `fs.openSync(path, 'wx')` / `fs.writeSync(fd, buffer, offset, length, position)` /
 * `fs.closeSync(fd)`) is split into these three steps, rather than one opaque
 * `writeFile(path, content, options)` call, specifically so this function can tell "the exclusive
 * create itself never happened" (`open` throws — `EEXIST` or anything else; `tmp` is not ours to
 * touch) apart from "the create succeeded, and something *after* it failed" (`write`, `close`, or
 * the rename below; `tmp` exists and is this call's own file, so it is removed). A single combined
 * call (the old `writeFile(tmp, content, {flag:'wx',...})` shape) cannot make that distinction from
 * the outside — whatever it does internally, its caller only ever sees "it threw" or "it didn't"
 * (T2g R3-001, Codex P2: moving that one call outside the try/catch correctly stopped deleting a
 * foreign file on `EEXIST`, per T2f item 1, but then left this call's *own* just-created file
 * leaking on a write failure that happens after the open — e.g. `ENOSPC`, `EIO` partway through
 * filling it). Splitting `open` out as its own step means only *its* own failure is
 * ambiguous-ownership territory; every failure after it succeeds is unambiguously this call's to
 * clean up.
 *
 * `write` is called in a loop, each call resuming exactly where the last one left off
 * (`buffer`/`offset`/`length`/`position` all reflect only the unwritten remainder), until every
 * byte is written — `fs.writeSync`'s buffer form returns however many bytes it actually wrote,
 * which is not guaranteed to be all of them in one call (T3b item 4, Codex P2: the single-shot
 * `write(fd, content)` this used to be trusted a short write never happens, the same assumption
 * `fs.writeFileSync` itself does *not* make internally).
 *
 * The rename (`deps.rename`, default `fs.renameSync`) is tried again while Windows holds the target open
 * (`renameHeld`); `deps.pause` and `deps.platform` are its seams. */
export function writeManifestAtomic(target, data, deps = {}) {
  const open = deps.open ?? ((p) => fs.openSync(p, 'wx'));
  const write = deps.write ?? ((fd, buffer, offset, length, position) => fs.writeSync(fd, buffer, offset, length, position));
  const close = deps.close ?? ((fd) => fs.closeSync(fd));
  const rename = deps.rename ?? fs.renameSync;

  const tmp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const buffer = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');

  const fd = open(tmp); // if this throws, nothing was created by this call — tmp is not ours to touch
  try {
    let written = 0;
    while (written < buffer.length) {
      const count = write(fd, buffer, written, buffer.length - written, written);
      // A write that makes no progress (0 bytes, or no byte count at all) would spin forever or pass
      // a truncated manifest as complete; fail it so the cleanup below runs (T3c, Codex P2 +
      // R3-short-write-loop-no-progress-guard).
      if (!Number.isInteger(count) || count <= 0) throw new Error(`manifest write made no progress (${count})`);
      written += count;
    }
    close(fd);
  } catch (err) {
    try {
      close(fd);
    } catch {
      // Best-effort; `fd` may already be closed or invalid depending on how `write` failed.
    }
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Best-effort cleanup; `err` is still the one thrown below regardless.
    }
    throw err;
  }

  try {
    renameHeld(tmp, target, rename, deps.pause ?? sleepSync, deps.platform ?? process.platform);
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Best-effort cleanup; `target` was never written to directly, so it is untouched regardless.
    }
    throw err;
  }
}

/** The codes of a rename Windows refuses for a moment while another process (an antivirus, the indexer, an editor)
 * holds the file open, as `claimTicket` of bin/lib/gate-first.mjs meets them. Elsewhere they are a refusal that
 * stays, so they are tried once. */
const HELD = new Set(['EPERM', 'EBUSY', 'EACCES']);
const HELD_TRIES = 3;
const HELD_PAUSE_MS = 25;

/** Renames `from` to `to`, trying again after `pause` while the file is held on Windows; throws the last error. */
function renameHeld(from, to, rename, pause, platform) {
  const tries = platform === 'win32' ? HELD_TRIES : 1;
  for (let attempt = 1; ; attempt += 1) {
    try {
      rename(from, to);
      return;
    } catch (err) {
      if (!HELD.has(err?.code) || attempt === tries) throw err;
      pause(HELD_PAUSE_MS);
    }
  }
}

/** Blocks for `ms`: the write is synchronous, and a hold lasts milliseconds. */
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Renames `from` over `to`, tried again while Windows holds `to` open, as the manifest's write is (`renameHeld`);
 * `deps.rename`, `deps.pause` and `deps.platform` are its seams. The Rules block writes his CLAUDE.md through it
 * (./rules-block.mjs; a review of T7 of odd/tasks/f8-s10-port.md). */
export const renameOver = (from, to, deps = {}) => renameHeld(from, to, deps.rename ?? fs.renameSync, deps.pause ?? sleepSync, deps.platform ?? process.platform);

/** Writes `text` to `target` through a fresh sibling renamed over it, so a write that fails partway leaves the file as
 * it was (the verifier, L20 of odd/tasks/f8-s10-port.md). The sibling is created exclusively under a random name, so
 * nothing already there is written through, and the rename is tried again while Windows holds the file; the sibling
 * is removed when the write or the rename fails, but not when it was already there (`EEXIST`), since it is not ours.
 * The sibling takes the mode of the file it replaces, so a private file stays private (Codex on cca493e..b27d063).
 * It moved here from ./rules-block.mjs for the user's Claude settings (odd/tasks/audit-u5-atomic-state.md, S5). */
export function writeWhole(target, text, writeFile = fs.writeFileSync) {
  const tmp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  let mode = null;
  try {
    mode = fs.statSync(target).mode & 0o7777;
  } catch {
    // A file not there yet takes the default mode.
  }
  try {
    // Created with the mode already, which the umask can only narrow, so a private text is never readable by others
    // for a moment (Codex's recheck on 6df890e..4e28ec3); the chmod then gives it the exact mode.
    writeFile(tmp, text, { encoding: 'utf8', flag: 'wx', ...(mode !== null && { mode }) });
    if (mode !== null) fs.chmodSync(tmp, mode);
    renameOver(tmp, target);
  } catch (err) {
    if (err.code !== 'EEXIST') fs.rmSync(tmp, { force: true });
    throw err;
  }
}

/** The file `file` names: itself, or the one it links to, so a file linked into a dotfiles repository stays a link and
 * the write goes into the file it names (Codex on cca493e..b27d063). A link to nothing throws (`ENOENT`): nothing is
 * written through it. */
export function realPlace(file) {
  let link;
  try {
    link = fs.lstatSync(file).isSymbolicLink();
  } catch (err) {
    if (err.code === 'ENOENT') return file;
    throw err;
  }
  return link ? fs.realpathSync(file) : file;
}

/** Writes `text` over the file `file` names (`realPlace`) whole or not at all (`writeWhole`): the default write of every
 * writer of the user's Claude settings, in the shape of `fs.writeFileSync` they take as a seam (M33 of the Fable 5.2
 * audit). */
export const replaceText = (file, text) => writeWhole(realPlace(file), text);

/** Writes `buffer` (or a string, as UTF-8) over `file` whole or not at all: a fresh temporary sibling, then one rename
 * over it (`renameOver`, whose seams `deps` carries), so a write that fails halfway leaves the bytes there before. The
 * commit message git reads (../commit-msg.mjs) and engram's hooks file (./engram-prompt-hook.mjs) are written through
 * it; it moved here from commit-msg.mjs for the second. */
export function replaceFile(file, buffer, deps = {}) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, 'wx');
  let open = true;
  try {
    fs.writeFileSync(fd, buffer);
    fs.closeSync(fd);
    open = false;
    renameOver(tmp, file, deps);
  } catch (error) {
    // Closed once only: a number closed again could by then name a file something else opened.
    if (open) {
      try {
        fs.closeSync(fd);
      } catch {
        // The write's own error is the one to throw.
      }
    }
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

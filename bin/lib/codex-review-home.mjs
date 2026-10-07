// The Codex home of a lean review: a folder of the review's own, made for one run and removed after it.
//
// Why a home of its own. Codex reads the global `AGENTS.md` through its home's folder, with no flag,
// config key or environment variable to leave it out (odd/tasks/codex-review-lean.md, "What Codex loads,
// and what `exec review` accepts"). A lean review therefore runs with `CODEX_HOME` set to an empty folder,
// which holds nothing of the user's: no global `AGENTS.md`, no skills, no rules, no hooks.
//
// Why a hard link and not a copy. The one thing a review needs from the real home is the login,
// `auth.json`. Codex saves that file by truncating and writing the same path, and a refresh replaces the
// tokens in it. A copy would take the refresh alone and could leave the real login invalid. A hard link
// is a second name of the same file: both homes hold the same bytes at every moment, so a refresh inside
// the lean home IS a refresh of the real login. That is why nothing here ever falls back to a copy, and
// why the link is checked after it is made (same device and file id). This module never opens the file:
// it links it, stats it and removes the second name.
//
// Why the folder must be on the volume of the Codex home. A hard link cannot cross volumes (`EXDEV`). The
// default places agree, `<OS home>/.js-harness/` and `<OS home>/.codex`; a `--home` or `JS_HARNESS_HOME`
// on another volume makes the lean session refuse to start, and says so.
//
// How to undo it. Everything this module writes is under `<home>/.js-harness/codex-review-homes/`
// (`leanHomesDir`), the harness's machine state dir: AGENTS.md requires that whatever the harness writes
// outside the repository can be undone exactly, and deleting that one folder does it. Each run removes
// its own folder (`dispose`), and a run that was killed leaves one that the next run removes
// (`sweepStaleLeanHomes`). Removing a hard link removes one name, never the file: the real `auth.json`
// stays, with its bytes.
import fs from 'node:fs';
import path from 'node:path';

const AUTH = 'auth.json';

/** The Codex home the user's login lives in: `CODEX_HOME` when it is set and not empty, as Codex itself
 * reads it, else `.codex` under the OS home `homedir`. */
export function realCodexHome(env, homedir) {
  return env.CODEX_HOME ? env.CODEX_HOME : path.join(homedir, '.codex');
}

/** The folder the lean homes are made in, one per run: `<home>/.js-harness/codex-review-homes`. */
export function leanHomesDir(home) {
  return path.join(home, '.js-harness', 'codex-review-homes');
}

// One folder name and nothing else: no separator, no drive, no `.` or `..`.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Removes a lean home: the login's second name first, then the folder. The order is deliberate: the one
 * entry that is also the user's login goes by a call that removes exactly one name, never by the
 * recursive removal, whose handling of an entry it cannot delete is the runtime's and not this module's.
 * When the name cannot be removed the folder is left as it is, for the next run's sweep or a person.
 * Returns `null`, or what failed as a sentence; never throws. */
function removeLeanHome(home, rm = fs.rmSync) {
  try {
    try {
      fs.unlinkSync(path.join(home, AUTH));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    rm(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return null;
  } catch (err) {
    return `could not remove ${home} (${err.code ?? err.message}); delete that folder by hand, which removes one name of the Codex login and never the login`;
  }
}

/** The device and file id of `file` as one comparable string, or `null` when there is no such file. */
function identity(file) {
  const stat = fs.statSync(file, { bigint: true, throwIfNoEntry: false });
  return stat ? `${stat.dev}:${stat.ino}` : null;
}

/** Makes the lean home `<parent>/<id>` and hard-links `<realHome>/auth.json` into it. Returns its
 * absolute path as `home` and `dispose()`, which removes it: `null` when nothing is left to say, else a
 * sentence (the folder could not be removed, or the lean name had become another file, so what Codex
 * wrote there did not reach the real login). `dispose` is idempotent and never throws.
 *
 * Throws, with nothing left behind, when `id` is not a plain folder name, when the folder is already
 * there, when the real home holds no `auth.json` (Codex is not logged in), when the link cannot be made
 * (another volume, no permission), or when what was made is not the same file. `link` and `rm` are the
 * file system calls, replaced in tests. */
export function createLeanHome({ realHome, parent, id, link = fs.linkSync, rm = fs.rmSync }) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`The id of a lean Codex home must be a plain folder name, got ${JSON.stringify(id)}.`);
  const realAuth = path.join(path.resolve(realHome), AUTH);
  const home = path.join(path.resolve(parent), id);
  const leanAuth = path.join(home, AUTH);

  const real = fs.statSync(realAuth, { bigint: true, throwIfNoEntry: false });
  if (!real) {
    throw new Error(
      `There is no ${realAuth}, so Codex is not logged in there: run \`codex login\`. ` +
        '(A login kept outside that file, in the system keyring, cannot be shared with the lean session.)',
    );
  }
  if (!real.isFile()) throw new Error(`${realAuth} is not a file, so the lean session has no login to share.`);

  fs.mkdirSync(path.dirname(home), { recursive: true });
  try {
    fs.mkdirSync(home);
  } catch (err) {
    throw new Error(`Could not make the lean Codex home ${home} (${err.code ?? err.message}).`);
  }
  try {
    try {
      link(realAuth, leanAuth);
    } catch (err) {
      const why = err.code === 'EXDEV' ? ': the two folders are on different volumes, and a hard link cannot cross volumes' : '';
      throw new Error(
        `Could not hard-link ${realAuth} to ${leanAuth} (${err.code ?? err.message})${why}. ` +
          'No copy is made, on purpose: a login refreshed inside a copy could leave the real one invalid.',
      );
    }
    if (identity(leanAuth) !== `${real.dev}:${real.ino}`) {
      throw new Error(`${leanAuth} is not the same file as ${realAuth} after linking, so it is not used: a copy could take a refresh of the login alone.`);
    }
  } catch (err) {
    removeLeanHome(home, rm);
    throw err;
  }

  const dispose = () => {
    let replaced = null;
    try {
      const now = identity(leanAuth);
      if (now !== null && now !== `${real.dev}:${real.ino}`) {
        replaced = `${leanAuth} had become another file than ${realAuth}, so what Codex wrote there did not reach the real login; if \`codex\` asks for a login again, that is why`;
      }
    } catch {
      // The name cannot be read: removing it below says what is wrong, if anything is.
    }
    return removeLeanHome(home, rm) ?? replaced;
  };
  return { home, dispose };
}

/** Removes the run folders in `parent` last changed more than `olderThanMs` before `now` (milliseconds
 * since the epoch): a run that was killed leaves its folder, with a second name of the login in it.
 * A younger folder is left alone, since another review may be running in it, and so is anything that is
 * not a folder. Returns how many were removed; never throws. */
export function sweepStaleLeanHomes(parent, { olderThanMs, now = Date.now() } = {}) {
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(parent, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    try {
      if (!entry.isDirectory()) continue;
      const home = path.join(parent, entry.name);
      // Written so that a bound or a date that is not a number removes nothing.
      if (!(now - fs.statSync(home).mtimeMs > olderThanMs)) continue;
      if (removeLeanHome(home) === null) removed += 1;
    } catch {
      // Gone meanwhile, or not readable: another run sweeps it.
    }
  }
  return removed;
}

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
// How to undo it, and what a machine keeps after a run: nothing. Everything this module writes is under
// `<home>/.js-harness/codex-review-homes/` (`leanHomesDir`), the harness's machine state dir: AGENTS.md
// requires that whatever the harness writes outside the repository can be undone exactly, and here the
// run undoes it itself. Each run removes its own folder (`dispose`), then the folder of the homes when
// that left it empty, then `.js-harness` when that is empty too (`removeEmptyHomesDir`): so the lean
// session, which is what a review runs in by default, leaves no folder for `uninstall` to know of. Both
// are removed by a call that removes an empty folder and nothing else, never by a recursive one, so one
// that still holds anything (another run's home, the manifest of an installed harness, a cache) stays as
// it is. Two things outlast a run: the folder of a run that was killed, and one a run was asked to keep
// (`dispose({ keep: true })`, which removes the login's name from it and leaves the rest). The next run
// removes either once it is old (`sweepStaleLeanHomes`), and deleting `codex-review-homes` by hand does
// it at any time. Removing a hard link removes one name, never the file: the real `auth.json` stays, with
// its bytes.
//
// A seeded home. The comparison of the review's configurations (`evals/review/compare.mjs`) measures the
// session that runs on the user's own configuration, and that one cannot run in an empty home: it is given
// a copy of his configuration instead, made by a `seed` the caller hands over. The login is still the hard
// link and never part of the copy: the seed runs first, in a home that holds no login, so nothing it copies
// can be written through the link, and a seed that leaves an `auth.json` of its own is refused. Such a
// run's folder is laid out as a home directory, with the Codex home in its `.codex`, because that is the
// shape the copy is made in (`evals/codex-home.mjs`). It is made, removed and swept by the same code.
import fs from 'node:fs';
import path from 'node:path';

const AUTH = 'auth.json';

// The folder of a seeded run that is its Codex home; a run with no seed is its own Codex home.
const SEEDED_CODEX_DIR = '.codex';

// Where a run folder may hold a name of the login, from the folder: its own top, or its `.codex`.
const LOGIN_PLACES = [AUTH, path.join(SEEDED_CODEX_DIR, AUTH)];

/** The Codex home the user's login lives in: `CODEX_HOME` when it is set and not empty, as Codex itself
 * reads it, else `.codex` under the OS home `homedir`. On Windows (`platform` is `win32`) the name of a
 * variable has no case, and `env` may be a plain object that does not fold it as `process.env` does, so
 * the name is looked for in any case and the first that is set and not empty is taken; elsewhere the name
 * is `CODEX_HOME` exactly, since `Codex_Home` is another variable there. */
export function realCodexHome(env, homedir, platform = process.platform) {
  const set = (value) => typeof value === 'string' && value !== '';
  const named = platform === 'win32'
    ? Object.keys(env).filter((key) => /^codex_home$/i.test(key)).map((key) => env[key]).find(set)
    : env.CODEX_HOME;
  return set(named) ? named : path.join(homedir, '.codex');
}

// The harness's machine state dir, and the folder of the lean homes in it.
const STATE_DIR = '.js-harness';
const HOMES_DIR = 'codex-review-homes';

/** The folder the lean homes are made in, one per run: `<home>/.js-harness/codex-review-homes`. */
export function leanHomesDir(home) {
  return path.join(home, STATE_DIR, HOMES_DIR);
}

// One folder name and nothing else: no separator, no drive, no `.` or `..`.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Removes `parent`, the folder the homes are in, when the home that just went was the last thing in it,
 * and then the folder above it when that one is the harness's state dir and is empty as well: what a run
 * made to hold its home, it takes away with it. `rmdir` removes an empty folder and refuses any other,
 * which is the whole of the check: a folder that holds anything is left, and so is one that is busy or
 * already gone, with nothing said, since an empty folder left behind is no fault of a review. The folder
 * above is touched only under the name `.js-harness`: the homes of a caller that put them elsewhere are in
 * a folder that is not this module's. Never throws. */
function removeEmptyHomesDir(parent, rmdir = fs.rmdirSync) {
  try {
    rmdir(parent);
    const state = path.dirname(parent);
    if (path.basename(state) === STATE_DIR) rmdir(state);
  } catch {
    // Not empty, busy, or not there: nothing to do.
  }
}

/** Removes a lean home: the login's second name first, then the folder. The order is deliberate: the one
 * entry that is also the user's login goes by a call that removes exactly one name, never by the
 * recursive removal, whose handling of an entry it cannot delete is the runtime's and not this module's.
 * The name is looked for in both places a run folder holds one (`LOGIN_PLACES`), since the sweep cannot
 * know which kind of run left the folder. When the name cannot be removed the folder is left as it is, for
 * the next run's sweep or a person.
 * With `keep` the folder is left on purpose and only the name goes, so a kept folder never holds a login.
 * Once the folder is gone, the one it was in goes too when that left it empty (`removeEmptyHomesDir`):
 * here, so that every way a home is removed takes it, the end of a run, a run that could not be set up,
 * and the sweep. Returns `null`, or what failed as a sentence; never throws. */
function removeLeanHome(home, rm = fs.rmSync, { keep = false, rmdir = fs.rmdirSync } = {}) {
  try {
    for (const place of LOGIN_PLACES) {
      try {
        fs.unlinkSync(path.join(home, place));
      } catch (err) {
        // No such name, or no such folder for it to be in (`ENOTDIR` when `.codex` is a file).
        if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
      }
    }
    if (!keep) {
      rm(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      removeEmptyHomesDir(path.dirname(home), rmdir);
    }
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
 * `dispose({ keep: true })` removes the login's second name and leaves the rest of the folder, for a
 * person to read what the session wrote (its rollout files). The login's name goes either way. A kept
 * folder is still under `leanHomesDir`, so a later `dispose()` or the sweep of a later run removes it.
 *
 * With `seed`, a function, the folder of the run is `folder` and its Codex home `home` is the `.codex` in
 * it (without one the two are the same path). `seed({ folder, home })` is called once, after both are made
 * and BEFORE the login is linked, to copy a configuration in; what it returns is handed back as `seeded`.
 * It must leave no `auth.json` in `home`: the login is the link, made after it, and never a copy.
 *
 * Throws, with nothing left behind, when `id` is not a plain folder name, when the folder is already
 * there, when the real home holds no `auth.json` (Codex is not logged in), when the seed throws or left an
 * `auth.json`, when the link cannot be made (another volume, no permission), or when what was made is not
 * the same file. "Nothing" includes `parent` and the state dir above it, when making the home is what
 * made them: a folder that goes takes them with it while they are empty (`removeEmptyHomesDir`), and
 * `dispose()` does the same. A folder of the homes that another review removed while this home was being
 * made is made again, once (see below). `link`, `rm`, `rmdir` and `mkdir` are the file system calls,
 * replaced in tests. */
export function createLeanHome({ realHome, parent, id, link = fs.linkSync, rm = fs.rmSync, rmdir = fs.rmdirSync, mkdir = fs.mkdirSync, seed }) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`The id of a lean Codex home must be a plain folder name, got ${JSON.stringify(id)}.`);
  if (seed !== undefined && typeof seed !== 'function') throw new Error('The seed of a Codex home must be a function.');
  const realAuth = path.join(path.resolve(realHome), AUTH);
  const folder = path.join(path.resolve(parent), id);
  const home = seed ? path.join(folder, SEEDED_CODEX_DIR) : folder;
  const leanAuth = path.join(home, AUTH);

  const real = fs.statSync(realAuth, { bigint: true, throwIfNoEntry: false });
  if (!real) {
    throw new Error(
      `There is no ${realAuth}, so Codex is not logged in there: run \`codex login\`. ` +
        '(A login kept outside that file, in the system keyring, cannot be shared with the lean session.)',
    );
  }
  if (!real.isFile()) throw new Error(`${realAuth} is not a file, so the lean session has no login to share.`);

  // The folder of the homes, then the run folder in it. Between the two another review may end and take
  // the folder of the homes with it, empty as it still is (`removeEmptyHomesDir`): the run folder then has
  // no parent, `ENOENT`. So both are made again, once. One more try and no loop: a second `ENOENT` is not
  // that race, and is said. Any other failure is said at once, a folder that is already there among them.
  const makeFolder = () => {
    mkdir(path.dirname(folder), { recursive: true });
    mkdir(folder);
  };
  try {
    try {
      makeFolder();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      makeFolder();
    }
  } catch (err) {
    // What was made to hold the home goes when the home could not be made, while it holds nothing.
    removeEmptyHomesDir(path.dirname(folder), rmdir);
    throw new Error(`Could not make the lean Codex home ${folder} (${err.code ?? err.message}).`);
  }
  let seeded;
  try {
    if (seed) {
      fs.mkdirSync(home);
      seeded = seed({ folder, home });
      // The link below would fail on a name that is taken; said here in the words of the rule it keeps.
      if (fs.lstatSync(leanAuth, { throwIfNoEntry: false })) {
        throw new Error(`The seed of ${home} left an ${AUTH} there, and a copy of the login is never used: the login of a review is a hard link to the real one, made after the seed.`);
      }
    }
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
    removeLeanHome(folder, rm, { rmdir });
    throw err;
  }

  const dispose = ({ keep = false } = {}) => {
    let replaced = null;
    try {
      const now = identity(leanAuth);
      if (now !== null && now !== `${real.dev}:${real.ino}`) {
        replaced = `${leanAuth} had become another file than ${realAuth}, so what Codex wrote there did not reach the real login; if \`codex\` asks for a login again, that is why`;
      }
    } catch {
      // The name cannot be read: removing it below says what is wrong, if anything is.
    }
    return removeLeanHome(folder, rm, { keep, rmdir }) ?? replaced;
  };
  return { home, folder, seeded, dispose };
}

/** Removes the run folders in `parent` last changed more than `olderThanMs` before `now` (milliseconds
 * since the epoch): a run that was killed leaves its folder, with a second name of the login in it.
 * A younger folder is left alone, since another review may be running in it, and so is anything that is
 * not a folder. A sweep that removes the last thing in `parent` leaves no `parent` either, as the end of
 * a run does (`removeLeanHome`); the run that swept makes it again for its own home. Returns how many
 * were removed; never throws. */
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

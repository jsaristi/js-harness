// The key of the tree a gate guards: what lets a gate say that another one already ran the sensors on these
// very files, and run none (`checkSensors` of `../check.mjs`; the proof is a line of the gate log,
// `provenBy` of `./gate-log.mjs`).
//
// The sensors read the folder, never the index (`checkSensor`). So the key is of the index only where the
// folder is that index, and every doubt is no key: a gate with none runs its sensors as it always did.
//
// What the key does not hold, so that nobody reads more into a gate that ran no sensor: a file git ignores,
// a file changed and changed back while the sensors ran, the machine outside what `RUNTIME` names (another
// git, another PATH), and what a filter of the repository's own (`clean`, `working-tree-encoding`) folds
// into one object: the key is of the objects and of how git says each is written, not of the bytes read.

import { createHash } from 'node:crypto';

/** The format of what is hashed. A change of what the key is made of is another number, so that no key of
 * an older format is taken for one of this. */
export const TREE_KEY_FORMAT = 1;

/** What runs the sensors, as far as this process knows it. */
export const RUNTIME = { version: process.version, platform: process.platform, arch: process.arch };

// The listing of the index, one entry for each path: the tag of the entry, its mode, its object id and its
// stage, how the file is written in the index and in the folder and by which attribute, and the path. Two
// listings that are equal hold the same bytes at the same paths, written the same way on disk: the same
// object can be in two folders with other line ends, where `core.autocrlf` or an `eol` attribute differ.
const LISTING = ['ls-files', '-s', '-v', '--eol', '-z'];

// What differs between the folder and the index, and what is in the folder and in no index. A submodule is
// never left out, whatever the repository is set to leave out of a status, and renames are off, so every
// entry is one path. `--no-optional-locks`: a look writes nothing, not even a refreshed index.
const STATUS = ['--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=all', '--ignore-submodules=none', '--no-renames'];

/** Whether an entry of the status (`XY path`) says the folder is not the index: a file changed and not
 * staged (the second letter), one git does not track, or anything unmerged. */
const differs = (entry) => entry.length < 4 || entry[1] !== ' ' || entry.startsWith('??');

/** Whether a line of the listing is an entry git reports unchanged whatever is on disk: `assume-unchanged`
 * is a lowercase tag, `skip-worktree` is `S`. Any tag but a plain cached entry (`H`) is no key: an unmerged
 * entry, one to be removed or killed. */
const unseen = (line) => line[0] !== 'H';

/** Whether a line of the listing is a file whose line ends are mixed in the folder (`w/mixed`). The listing
 * says how such a file is written and not which of its lines end how: under `core.autocrlf` two files with
 * CRLF and LF at other lines are one object in the index, one clean status and one line here, and a sensor
 * that reads bytes can answer them differently. Every other way of writing a file is the object's bytes
 * with one rule applied to all of its line ends, or the bytes themselves. */
const mixedOnDisk = (line) => /(^|\s)w\/mixed(\s|$)/.test(line.split('\t')[1] ?? '');

/** The key of the tree of the repository `git` answers for, as 64 lowercase hex characters, or `null` when
 * there is none.
 *
 * `git(args)` runs git at the top of the repository, bound as the gate itself is (a hook is handed the
 * index of its commit, which `git commit <path>` and `git commit -a` make apart from the one `git add`
 * wrote), and gives its stdout, or `null` when git did not answer. The caller has asked that the binding is
 * of this repository and that it runs at its top.
 *
 * `sensors` are the ones the gate would run, `[{ name, command }]`: another command is another key, since
 * the same files under another suite proved another thing. `runtime` is what runs them, and `place`, where
 * the sensors run elsewhere (a WSL2 distribution and its node, `../check.mjs`), says where: a pass there
 * proves nothing for a run here.
 *
 * `null`, which is "run the sensors", for every one of: git that does not answer; a folder that is not the
 * index (an unstaged change, an untracked file, an unmerged path); an entry git would report unchanged
 * whatever its file holds; a file whose line ends are mixed in the folder; an index with nothing in it. Two
 * processes of git. */
export function treeKey(git, { sensors, runtime = RUNTIME, place } = {}) {
  if (typeof git !== 'function' || !Array.isArray(sensors) || sensors.length === 0) return null;
  const status = git(STATUS);
  if (typeof status !== 'string' || status.split('\0').filter(Boolean).some(differs)) return null;
  const listing = git(LISTING);
  if (typeof listing !== 'string') return null;
  const lines = listing.split('\0').filter(Boolean);
  if (lines.length === 0 || lines.some(unseen) || lines.some(mixedOnDisk)) return null;
  const hashed = JSON.stringify([
    TREE_KEY_FORMAT,
    lines,
    sensors.map(({ name, command }) => [name, command]),
    [runtime.version, runtime.platform, runtime.arch],
    // Only where the sensors run elsewhere than this process, so every key of a gate that names no place
    // is the key it was.
    ...(place === undefined ? [] : [place]),
  ]);
  return createHash('sha256').update(hashed).digest('hex');
}

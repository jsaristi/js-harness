// The installed copy's bin/ against a commit's, by blob ids: the guard that refuses a land run from a copy behind
// main (`staleBin`, bin/merge-queue.mjs) and the check that verifies a refreshed copy (`binDiffers`, bin/lib/refresh-copy.mjs)
// read it the same way. Moved out of bin/merge-queue.mjs so the refresh reads it without importing the queue. Zero
// dependencies.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** The files under `dir`, as paths relative to it with forward slashes. */
function copyFiles(dir, folder = '') {
  return fs.readdirSync(path.join(dir, folder), { withFileTypes: true }).flatMap((entry) => {
    const rel = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return copyFiles(dir, rel);
    return entry.isFile() ? [rel] : [];
  });
}

/**
 * The bin/ files package.json `files` leaves out of an installed copy: the globs of its `!bin/` negations. A path
 * main holds that such a glob matches is no stale path when the copy lacks it. The test in merge-queue.test.mjs reads
 * package.json and fails if the two disagree.
 */
export const UNSHIPPED_GLOBS = ['*.test.mjs', '*.testkit.mjs'];
const unshipped = (repoPath) =>
  UNSHIPPED_GLOBS.some((glob) => new RegExp(`(^|/)${glob.replace(/\./g, '\\.').replace(/\*/g, '[^/]*')}$`).test(repoPath));

/** The git blob id of `bytes`, as `git hash-object` gives it: the sha1 of `blob <length>`, a NUL and the bytes. */
const blobId = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

/** The blob id of each bin/ path of `main`, from one `git ls-tree`, or null when the listing cannot be read. The
 * listing is of the whole tree: git reads a path relative to the folder it runs in, which may be below the root. */
function mainBin(main, gitIn) {
  const listed = gitIn('ls-tree', '--full-tree', '-r', main, '--', 'bin');
  if (!listed.ok) return null;
  const onMain = new Map();
  for (const line of listed.out.split('\n')) {
    const entry = /^\S+ \S+ ([0-9a-f]+)\t(.+)$/.exec(line);
    if (entry) onMain.set(entry[2], entry[1]);
  }
  return onMain;
}

/** The bin/ paths of the copy's bin/ folder `dir` that `onMain` does not hold as they are, sorted; null when `dir`
 * cannot be read. `strict`: a file of the copy that cannot be read, or whose `git show` fails, counts as different;
 * otherwise it is not proven different and is left out. */
function differing(dir, main, onMain, gitIn, strict) {
  let local;
  try {
    local = copyFiles(dir);
  } catch {
    return null;
  }
  const copied = new Set(local.map((rel) => `bin/${rel}`));
  const stale = [];
  for (const rel of local) {
    const repoPath = `bin/${rel}`;
    if (!onMain.has(repoPath)) {
      stale.push(repoPath);
      continue;
    }
    let mine = null;
    try {
      mine = fs.readFileSync(path.join(dir, rel)).toString('utf8').replace(/\r\n/g, '\n');
    } catch {
      if (strict) stale.push(repoPath);
      continue;
    }
    if (blobId(Buffer.from(mine, 'utf8')) === onMain.get(repoPath)) continue;
    const theirs = gitIn('show', `${main}:${repoPath}`);
    if (theirs.ok ? mine !== theirs.out.replace(/\r\n/g, '\n') : strict) stale.push(repoPath);
  }
  for (const repoPath of onMain.keys()) if (!copied.has(repoPath) && !unshipped(repoPath)) stale.push(repoPath);
  return stale.sort();
}

/**
 * The bin/ paths the running copy and `main` do not agree on (sorted). One `git ls-tree` gives the blob id of each bin/ path of
 * `main`, and a file of the copy whose id is that one is the same file, with no more git call. The bytes are hashed with line ends
 * as LF, which is how a checkout on this machine holds them, so a blob stored with CRLF misses at the first look and is judged
 * further: `git show main:<path>` with line ends aside, as before. A path on one side only is stale. The running copy's bin/ is the
 * folder of `self`. An unreadable file is not proven different, and an unreadable listing refuses nothing, as before the guard;
 * a main without bin/merge-queue.mjs holds no queue to guard, so nothing is compared.
 */
export function staleBin(self, main, gitIn) {
  const onMain = mainBin(main, gitIn);
  if (onMain === null || !onMain.has('bin/merge-queue.mjs')) return [];
  return differing(path.dirname(self), main, onMain, gitIn, false) ?? [];
}

/** The refresh's check of a copy it installed (S6 of odd/tasks/lead-manual-steps.md): the bin/ paths of the copy's bin/
 * folder `dir` that differ from `main`'s, read as `staleBin` reads them, but where nothing unread passes: a file that
 * cannot be read or compared counts as different. Null when main's listing or `dir` cannot be read, or main holds no
 * bin/. */
export function binDiffers(dir, main, gitIn) {
  const onMain = mainBin(main, gitIn);
  if (onMain === null || onMain.size === 0) return null;
  return differing(dir, main, onMain, gitIn, true);
}

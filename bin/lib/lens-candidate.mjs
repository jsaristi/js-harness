// The candidate a Claude lens reviews, and the block it reads (odd/tasks/f8-s1-reviews.md, T2; diet section 10,
// "S1, the Claude lens runner", items 1 and 2).
//
// A lens runs with no tools, so it can read nothing but what it is handed: this module hands it the range
// `<base>..<head>` as one block, the identity first (the two commits and the subject hash), then the ordered
// manifest of the paths and each path's own patch. The paths are those a Codex review reads, read as it reads them
// (`rangeFiles` of `./codex-review-scope.mjs`): a renamed file is one path, by the lines it changes, unless the range
// brings a file a review leaves out into code, which is read renames off (odd/tasks/lens-counts-renames.md). So a code
// commit is one thing to both reviews.
//
// The subject hash is sha256 of the block's context, the manifest and the patches in order: it changes with any
// changed line and never with a message, so a record names its head commit and its hash, and an amend that keeps
// the patch still moves the head (item 7). Git is asked with every option that could change the bytes of a patch
// set, so the same two commits give the same hash on any machine and under any git configuration.
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { NO_RENAMES, numstatFiles } from './codex-review-parts.mjs';
import { leftOutOf, MARKED, patchSections, rangeFiles } from './codex-review-scope.mjs';

export const SUBJECT_LINE = 'JS_HARNESS_LENS_SUBJECT';
export const CONTEXT_START = 'JS_HARNESS_LENS_CONTEXT';
export const CONTEXT_END = 'JS_HARNESS_LENS_CONTEXT_END';

// What every diff of the range is run with, after the option of its renames (`rangeFiles`): whole paths from the top,
// and the patch's own shape fixed rather than left to the configuration.
const DIFF = ['--no-relative', '--no-ext-diff', '--no-textconv', '--no-color', '--submodule=short'];
// `--full-index`: the `index` line of a section names its blobs in full, since an abbreviation's length follows
// `core.abbrev` and the size of the repository, and would move the hash (the reliability lens, 2026-10-27);
// `--inter-hunk-context=0`, since `diff.interHunkContext` joins nearby hunks into one (Codex, the same day).
const PATCH = ['--unified=3', '--inter-hunk-context=0', '--diff-algorithm=myers', '--indent-heuristic', '--full-index', '--src-prefix=a/', '--dst-prefix=b/'];

/** `git <args>` in `cwd`: its stdout as it is, or `null` when git failed. A patch is hashed, so nothing is trimmed. */
function gitRaw(spawn, cwd, args) {
  try {
    const ran = spawn('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    return ran && !ran.error && ran.status === 0 ? ran.stdout : null;
  } catch {
    return null;
  }
}

/** The status letter of each path of `git diff --name-status -z`, by path: a rename's (or a copy's) by its new path,
 * its letter without the similarity git writes after it. */
function statusOf(text) {
  const fields = text.split('\0');
  if (fields.pop() !== '') throw new Error('the name-status of the range does not end where a record ends');
  const status = new Map();
  for (let at = 0; at + 1 < fields.length; at += 2) {
    if (/^[RC]\d*$/.test(fields[at])) {
      status.set(fields[at + 2], fields[at][0]);
      at += 1;
    } else status.set(fields[at + 1], fields[at]);
  }
  return status;
}

/** The candidate `base..head` of the repository at `cwd`: `{ base, head, renames, subjectHash, manifest, patches,
 * leftOut, markedLeftOut, block }`, with `base` and `head` as full commit ids, `renames` the option the range was read
 * with (`rangeFiles`), `manifest` the paths a lens reads (each `{ index, path, from?, status, added, deleted }`, in
 * git's order, `from` the old name of a renamed file), `patches` each one's patch at the same index, `leftOut` the
 * paths of the range a review leaves out (`markedLeftOut` of them by the project's marks), and `block` the text a lens
 * is handed. `{ error }` when git cannot say.
 *
 * `renames: NO_RENAMES` reads the range renames off whatever it holds, as every candidate was read before
 * odd/tasks/lens-counts-renames.md: the reading a record written then was hashed by (`reviewCoverage`). */
export function lensCandidate(cwd, { base, head, renames: forced, spawn = spawnSync }) {
  const resolve = (name) => gitRaw(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${name}^{commit}`])?.trim() || null;
  const from = resolve(base);
  if (!from) return { error: `${base} does not name a commit` };
  const to = resolve(head);
  if (!to) return { error: `${head} does not name a commit` };
  const range = `${from.slice(0, 7)}..${to.slice(0, 7)}`;
  const numstats = new Map();
  const numstatOf = (renames) => {
    if (!numstats.has(renames)) numstats.set(renames, gitRaw(spawn, cwd, ['diff', '--numstat', '-z', renames, ...DIFF, from, to]));
    return numstats.get(renames);
  };
  const marksOf = (names) => leftOutOf(names, { cwd, source: to, spawn });
  let read;
  let status;
  let sections;
  let counts;
  try {
    read = forced === NO_RENAMES ? renamesOff(numstatOf, marksOf) : rangeFiles(numstatOf, marksOf);
    if (read.failed === 'marks') return { error: 'git could not say which files a review leaves out (`git check-attr --source` needs git 2.40 or later)' };
    if (read.failed) return { error: `git could not diff ${range}` };
    const nameStatus = gitRaw(spawn, cwd, ['diff', '--name-status', '-z', read.renames, ...DIFF, from, to]);
    const patch = gitRaw(spawn, cwd, ['diff', read.renames, ...DIFF, ...PATCH, from, to]);
    if (nameStatus === null || patch === null) return { error: `git could not diff ${range}` };
    status = statusOf(nameStatus);
    sections = patchSections(patch, read.files.map((file) => file.path));
    counts = numstatCounts(numstatOf(read.renames));
  } catch (err) {
    return { error: `the diff of ${range} could not be read: ${err.message}` };
  }
  const { files, why } = read;

  const manifest = [];
  const patches = [];
  const leftOut = [];
  for (const [at, file] of files.entries()) {
    if (why.has(file.path)) {
      leftOut.push(...(file.from === undefined ? [file.path] : [file.from, file.path]));
      continue;
    }
    const [added, deleted] = counts[at];
    manifest.push({ index: manifest.length, path: file.path, ...(file.from !== undefined && { from: file.from }), status: status.get(file.path) ?? '?', added, deleted });
    patches.push(sections[at]);
  }
  // A renamed file's line names its old path after its new one; a range with no rename is written as it always was.
  const named = (entry) => JSON.stringify(entry.path) + (entry.from === undefined ? '' : `\t${JSON.stringify(entry.from)}`);
  const context = [
    `manifest ${manifest.length}`,
    ...manifest.map((entry) => `${entry.index}\t${entry.status}\t+${entry.added} -${entry.deleted}\t${named(entry)}`),
    ...manifest.flatMap((entry) => [`path ${entry.index} ${JSON.stringify(entry.path)}`, patches[entry.index].replace(/\n?$/, '')]),
  ].join('\n');
  const subjectHash = crypto.createHash('sha256').update(context, 'utf8').digest('hex');
  const subject = JSON.stringify({ base: from, head: to, subject_hash: subjectHash, paths: manifest.length });
  const block = `${SUBJECT_LINE} ${subject}\n${CONTEXT_START}\n${context}\n${CONTEXT_END}\n`;
  const markedLeftOut = leftOut.filter((file) => why.get(file) === MARKED).length;
  return { base: from, head: to, renames: read.renames, subjectHash, manifest, patches, leftOut, markedLeftOut, block };
}

/** The files of a range read renames off, whatever it holds, in the shape `rangeFiles` gives. */
function renamesOff(numstatOf, leftOut) {
  const numstat = numstatOf(NO_RENAMES);
  if (numstat === null) return { failed: 'numstat' };
  const files = numstatFiles(numstat);
  const why = leftOut(files.map((file) => file.path));
  return why === null ? { failed: 'marks' } : { files, why, renames: NO_RENAMES };
}

/** The added and deleted counts of each file of `git diff --numstat -z`, in its order, `[0, 0]` for a binary one
 * (`numstatFiles` keeps only their sum): a rename's record is followed by its two names, which are no record. */
function numstatCounts(numstat) {
  const records = numstat.split('\0');
  records.pop();
  const counts = [];
  for (let at = 0; at < records.length; at += 1) {
    const [added, deleted, named] = records[at].split('\t');
    counts.push(added === '-' ? [0, 0] : [Number(added), Number(deleted)]);
    if (named === '') at += 2;
  }
  return counts;
}

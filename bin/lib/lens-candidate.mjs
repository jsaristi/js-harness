// The candidate a Claude lens reviews, and the block it reads (odd/tasks/f8-s1-reviews.md, T2; diet section 10,
// "S1, the Claude lens runner", items 1 and 2).
//
// A lens runs with no tools, so it can read nothing but what it is handed: this module hands it the range
// `<base>..<head>` as one block, the identity first (the two commits and the subject hash), then the ordered
// manifest of the paths and each path's own patch. It replaces the binding and context gentle-ai's provider
// built for the same prompts. The paths are those a Codex review reads (`./codex-review-scope.mjs`), so a code
// commit is one thing to both reviews.
//
// The subject hash is sha256 of the block's context, the manifest and the patches in order: it changes with any
// changed line and never with a message, so a record names its head commit and its hash, and an amend that keeps
// the patch still moves the head (item 7). Git is asked with every option that could change the bytes of a patch
// set, so the same two commits give the same hash on any machine and under any git configuration.
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { numstatFiles } from './codex-review-parts.mjs';
import { leftOutOf, patchSections } from './codex-review-scope.mjs';

export const SUBJECT_LINE = 'JS_HARNESS_LENS_SUBJECT';
export const CONTEXT_START = 'JS_HARNESS_LENS_CONTEXT';
export const CONTEXT_END = 'JS_HARNESS_LENS_CONTEXT_END';

// What every diff of the range is run with: whole paths from the top, no renames (a rename is a removed path and
// an added one, as Codex reads it), and the patch's own shape fixed rather than left to the configuration.
const DIFF = ['--no-renames', '--no-relative', '--no-ext-diff', '--no-textconv', '--no-color', '--submodule=short'];
const PATCH = [...DIFF, '--unified=3', '--diff-algorithm=myers', '--indent-heuristic', '--src-prefix=a/', '--dst-prefix=b/'];

/** `git <args>` in `cwd`: its stdout as it is, or `null` when git failed. A patch is hashed, so nothing is trimmed. */
function gitRaw(spawn, cwd, args) {
  try {
    const ran = spawn('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    return ran && !ran.error && ran.status === 0 ? ran.stdout : null;
  } catch {
    return null;
  }
}

/** The status letter of each path of `git diff --name-status -z --no-renames`, by path. */
function statusOf(text) {
  const fields = text.split('\0');
  if (fields.pop() !== '') throw new Error('the name-status of the range does not end where a record ends');
  const status = new Map();
  for (let at = 0; at + 1 < fields.length; at += 2) status.set(fields[at + 1], fields[at]);
  return status;
}

/** The candidate `base..head` of the repository at `cwd`: `{ base, head, subjectHash, manifest, patches, leftOut,
 * block }`, with `base` and `head` as full commit ids, `manifest` the paths a lens reads (each `{ index, path,
 * status, added, deleted }`, in git's order), `patches` each one's patch at the same index, `leftOut` the paths of
 * the range a review leaves out, and `block` the text a lens is handed. `{ error }` when git cannot say. */
export function lensCandidate(cwd, { base, head, spawn = spawnSync }) {
  const resolve = (name) => gitRaw(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${name}^{commit}`])?.trim() || null;
  const from = resolve(base);
  if (!from) return { error: `${base} does not name a commit` };
  const to = resolve(head);
  if (!to) return { error: `${head} does not name a commit` };
  const nameStatus = gitRaw(spawn, cwd, ['diff', '--name-status', '-z', ...DIFF, from, to]);
  const numstat = gitRaw(spawn, cwd, ['diff', '--numstat', '-z', ...DIFF, from, to]);
  const patch = gitRaw(spawn, cwd, ['diff', ...PATCH, from, to]);
  if (nameStatus === null || numstat === null || patch === null) return { error: `git could not diff ${from.slice(0, 7)}..${to.slice(0, 7)}` };
  let files;
  let sections;
  let status;
  try {
    files = numstatFiles(numstat);
    status = statusOf(nameStatus);
    sections = patchSections(patch, files.map((file) => file.path));
  } catch (err) {
    return { error: `the diff of ${from.slice(0, 7)}..${to.slice(0, 7)} could not be read: ${err.message}` };
  }
  const why = leftOutOf(files.map((file) => file.path), { cwd, source: to, spawn });
  if (why === null) return { error: 'git could not say which files a review leaves out (`git check-attr --source` needs git 2.40 or later)' };

  const manifest = [];
  const patches = [];
  const leftOut = [];
  for (const [at, file] of files.entries()) {
    if (why.has(file.path)) {
      leftOut.push(file.path);
      continue;
    }
    const [added, deleted] = file.binary ? [0, 0] : numstatCounts(numstat, at);
    manifest.push({ index: manifest.length, path: file.path, status: status.get(file.path) ?? '?', added, deleted });
    patches.push(sections[at]);
  }
  const context = [
    `manifest ${manifest.length}`,
    ...manifest.map((entry) => `${entry.index}\t${entry.status}\t+${entry.added} -${entry.deleted}\t${JSON.stringify(entry.path)}`),
    ...manifest.flatMap((entry) => [`path ${entry.index} ${JSON.stringify(entry.path)}`, patches[entry.index].replace(/\n?$/, '')]),
  ].join('\n');
  const subjectHash = crypto.createHash('sha256').update(context, 'utf8').digest('hex');
  const subject = JSON.stringify({ base: from, head: to, subject_hash: subjectHash, paths: manifest.length });
  const block = `${SUBJECT_LINE} ${subject}\n${CONTEXT_START}\n${context}\n${CONTEXT_END}\n`;
  return { base: from, head: to, subjectHash, manifest, patches, leftOut, block };
}

/** The added and deleted counts of the `at`-th record of `git diff --numstat -z` (`numstatFiles` keeps only their sum). */
function numstatCounts(numstat, at) {
  const [added, deleted] = numstat.split('\0')[at].split('\t');
  return [Number(added), Number(deleted)];
}

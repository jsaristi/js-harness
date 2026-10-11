// What a Codex review reads of a range, and what it leaves out: the one definition `js-harness codex-review`
// and `js-harness check` both read. Zero deps. One function asks git, through an injected `spawn`; the rest
// take what git printed, or what another returned, so the tests use inline values.
//
// Why anything is left out. One review of a whole branch was 28 sessions and 3.36 million input tokens, and
// its five findings all came from the quarter of its lines that was code. Its documents (11% of the lines),
// the seeded fixture of an eval (7%) and the JSON readings of evals (5%) gave none
// (odd/tasks/codex-review-cost.md). So a review reads code, tests among it, and two kinds of file are in no
// part of it, in no prompt, and not among the changed lines a session must have seen:
//
//  - Documents: Markdown files (`isDocument`), which is the rule `check --push` already had for a commit
//    that needs no review.
//  - What the project marks: a path whose `codex-review` attribute is unset, which a project writes in a
//    `.gitattributes` as `<pattern> -codex-review`. Nothing of this repository's own folders is written
//    here: the harness is installed in other projects, and which of their files are data is theirs to say.
//
// Where the attributes are read from. From a commit, the head of the range that is judged
// (`git check-attr --source <commit>`, git 2.40 or later), and not from the working tree or the index. The
// command reviews a committed range and `check` counts commits, and neither is about what is being edited:
// `check` runs before every commit, over a tree and an index that hold the change being made, and
// `check --push --head <rev>` and `codex-review --plan` run whatever is checked out. One commit for the whole
// range, not one for each commit of it, so that every path is asked about in one process. A machine's own
// `$GIT_DIR/info/attributes` and global attributes file still apply, as they do to every git command.
//
// Where git is asked from. From the top of the repository, wherever the caller runs: git reads a path it is
// asked the attributes of from the folder it runs in, and the paths here are written from the top. Asked in
// a folder below it, `evals/results/a.json` would be the path of that name under that folder: a marked file
// would be read as code, and nothing would say so. So the lookup first asks git where the top is, unless its
// caller says.
//
// It is the project that decides, in a file that is committed like any other: `* -codex-review` leaves a
// review nothing to read, and the plan of every run says how many files were left out and why.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// The attribute a project unsets on the paths a review leaves out.
export const REVIEW_ATTRIBUTE = 'codex-review';

// Why a file is left out, as `leftOutOf` says it.
export const DOCUMENT = 'document';
export const MARKED = 'marked';

const ATTR_MAX_BUFFER = 64 * 1024 * 1024;

/** Whether `path` is a document: a Markdown file, by its name, in any letter case. The path is taken as git
 * writes it with `-z`, as it is: a name in the quotes git puts around an unusual one is not read here. */
export function isDocument(path) {
  return /\.md$/i.test(path);
}

/** The paths the project marks, from the output of `git check-attr --stdin -z codex-review`: a record a
 * path, `<path> NUL <attribute> NUL <info> NUL`, the path as it was asked. A path is marked when its info
 * is `unset`, which is what `-codex-review` gives; `set`, a value and `unspecified` are a path a review
 * reads. Throws on anything that is not whole records of that attribute: an answer read as far as it goes
 * would leave the rest unmarked, or marked, by accident. */
export function unsetPaths(output) {
  const refuse = (why) => new Error(`Not the output of \`git check-attr --stdin -z ${REVIEW_ATTRIBUTE}\`: ${why}.`);
  if (typeof output !== 'string') throw refuse(`got ${output === null ? 'null' : typeof output}`);
  const fields = output.split('\0');
  // Every field ends with a NUL, so the text after the last one is empty unless the output was cut.
  if (fields.pop() !== '' || fields.length % 3 !== 0) throw refuse('it does not end where a record ends');
  const unset = new Set();
  for (let at = 0; at < fields.length; at += 3) {
    const [path, attribute, info] = fields.slice(at, at + 3);
    if (attribute !== REVIEW_ATTRIBUTE) throw refuse(`a record of ${JSON.stringify(attribute.slice(0, 80))}`);
    if (info === 'unset') unset.add(path);
  }
  return unset;
}

/** The top of the repository `cwd` is in, as the folder a git command is run in, or `null` when git cannot
 * say. `git rev-parse --show-cdup` answers with the way up from `cwd` (`../../`, and nothing at the top or
 * where a repository has no working tree, whose paths are from its top anyway), which is resolved here: no
 * path that git wrote for another program is taken as one of this platform. */
function topOf(cwd, spawn) {
  const result = spawn('git', ['rev-parse', '--show-cdup'], { cwd, encoding: 'utf8' });
  if (!result || result.error || result.status !== 0 || typeof result.stdout !== 'string') return null;
  return resolve(cwd, result.stdout.replace(/\r?\n$/, ''));
}

/** Which of `paths` a review leaves out, and why: a `Map` from the path to `DOCUMENT` or `MARKED`, the
 * documents first; a path a review reads is not in it. `paths` are from the top of the repository `cwd`
 * is in, as git writes them with `-z`, whether `cwd` is that top or a folder below it, and the attributes
 * are those of the commit `source` (see the top of this file). `null` when git cannot say what is marked:
 * an old git, a folder that is in no repository, a source it cannot resolve, an answer that is not one.
 * Never an empty map then, which would say that nothing is.
 *
 * Two git processes, however many the paths: one that says where the top of the repository is, and one,
 * run there, that is asked about all the paths, on its standard input, which no count of them makes too
 * long for a command line. None at all when every path is a document, which no attribute is asked for.
 *
 * One, when the caller says where the top is: `where`, an object whose `top` is the top of the repository
 * `cwd` is in, as the folder a git command is run in. A command that asks this more than once in one run
 * hands on what it already knows (`codexReviewMain`). A `where` that names no top is none, and git is asked.
 *
 * And none for the paths the caller was already answered about: `where.marks`, a `Map` the caller makes and
 * keeps for one run, which this function fills, from `source` to what git said of each path asked at it.
 * A path in it is not asked about again, so a run that asks for the files of the commits of a range and
 * then for the files of that range asks once. It is for a `source` that is a full commit id, whose
 * attributes do not change under a run. An answer git did not give puts nothing in it. */
export function leftOutOf(paths, { cwd, source, spawn = spawnSync, where }) {
  const leftOut = new Map();
  const code = [];
  for (const path of new Set(paths)) {
    if (isDocument(path)) leftOut.set(path, DOCUMENT);
    else code.push(path);
  }
  // Whether each path is marked, as git said it of this commit: to this call, or to an earlier one of a
  // caller that keeps the answers.
  const said = where?.marks?.get(source) ?? new Map();
  const asked = code.filter((path) => !said.has(path));
  if (asked.length > 0) {
    let unset;
    try {
      const top = where?.top ?? topOf(cwd, spawn);
      if (top === null) return null;
      const result = spawn('git', ['check-attr', '--source', source, '--stdin', '-z', REVIEW_ATTRIBUTE], {
        cwd: top,
        encoding: 'utf8',
        maxBuffer: ATTR_MAX_BUFFER,
        input: asked.map((path) => `${path}\0`).join(''),
      });
      if (!result || result.error || result.status !== 0) return null;
      // A record for every path that was asked, or the answer is not the answer to this question.
      if (result.stdout.split('\0').length - 1 !== asked.length * 3) return null;
      unset = unsetPaths(result.stdout);
    } catch {
      return null;
    }
    for (const path of asked) said.set(path, unset.has(path));
    where?.marks?.set(source, said);
  }
  for (const path of code) {
    if (said.get(path)) leftOut.set(path, MARKED);
  }
  return leftOut;
}

/** The files of a range by what a review does with them: `files` (each `{ path, changedLines }`, as
 * `numstatFiles` gives them) and `why`, what `leftOutOf` said of their paths. `read` are the files a review
 * reads, as they were given and in that order; `left` the paths it leaves out; and `leftOut` the count of
 * those: how many `files` and `changedLines`, and the same two for the `documents` and for the `marked`
 * ones among them. A binary file changes no line that git counts, and is still a file. */
export function reviewScope(files, why) {
  const read = [];
  const left = [];
  const leftOut = { files: 0, changedLines: 0, documents: { files: 0, changedLines: 0 }, marked: { files: 0, changedLines: 0 } };
  for (const file of files) {
    const reason = why.get(file.path);
    if (reason === undefined) {
      read.push(file);
      continue;
    }
    left.push(file.path);
    for (const count of [leftOut, reason === DOCUMENT ? leftOut.documents : leftOut.marked]) {
      count.files += 1;
      count.changedLines += file.changedLines;
    }
  }
  return { read, left, leftOut };
}

const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** `count` things, with `noun` in the singular for one: `1 file`, `2 files`. */
const counted = (count, noun) => `${thousands(count)} ${noun}${count === 1 ? '' : 's'}`;

/** What a review left out (the `leftOut` of `reviewScope`) as a person reads it, with no full stop: how
 * many files and changed lines, and why. One kind is said as it is; two are added up, with each in
 * brackets. `nothing` when no file was left out. */
export function leftOutSaid({ files, changedLines, documents, marked }) {
  const kinds = [
    documents.files > 0 ? `${counted(documents.files, 'Markdown document')}, ${counted(documents.changedLines, 'changed line')}` : null,
    marked.files > 0 ? `${counted(marked.files, 'file')} the project marks \`-${REVIEW_ATTRIBUTE}\`, ${counted(marked.changedLines, 'changed line')}` : null,
  ].filter((kind) => kind !== null);
  if (kinds.length === 0) return 'nothing';
  return kinds.length === 1 ? kinds[0] : `${counted(files, 'file')}, ${counted(changedLines, 'changed line')} (${kinds.join('; ')})`;
}

/** The patch of a range without the sections of the files a review leaves out: `patch` is what
 * `git diff --submodule=short --no-renames <from> <head>` printed, `paths` the files of the range in the
 * order `git diff --numstat -z --no-renames <from> <head>` gives them, and `why` what `leftOutOf` said of
 * them. The patch as it is when none of them is left out.
 *
 * `--submodule=short`, because the patch has to be one section a file: a submodule that moved is counted as
 * a file, and under `diff.submodule=log` or `diff` git writes a line of summary for it and no section.
 *
 * A section is told to be of a file by its place, never by the name in its header: git writes the sections
 * in the order it counts the files in, and it writes a name that holds a quote, a backslash or a character
 * outside ASCII in quotes and escapes, which is not the path `-z` gives. A file whose type changed (a file
 * that became a link) is two sections under the same header, one that removes it and one that adds it, and
 * both are of that one file.
 *
 * Throws when the patch is not one section a file: a section taken for another file's would be changed
 * lines a review is held to though they were left out, or not held to though they were not. */
export function patchOfRead(patch, paths, why) {
  if (!paths.some((path) => why.has(path))) return patch;
  const starts = [...patch.matchAll(/^diff --git .*$/gm)];
  if (starts.length > 0 ? starts[0].index !== 0 : patch.trim() !== '') {
    throw new Error('The patch of the range holds text before its first section, so its sections cannot be told apart.');
  }
  const sections = [];
  for (const [at, start] of starts.entries()) {
    const text = patch.slice(start.index, starts[at + 1]?.index ?? patch.length);
    const last = sections.at(-1);
    if (last?.header === start[0]) last.text += text;
    else sections.push({ header: start[0], text });
  }
  if (sections.length !== paths.length) {
    throw new Error(`The patch of the range holds ${counted(sections.length, 'section')} for its ${counted(paths.length, 'file')}, so which of them are of the files a review leaves out cannot be told.`);
  }
  return sections.filter((_, at) => !why.has(paths[at])).map((section) => section.text).join('');
}

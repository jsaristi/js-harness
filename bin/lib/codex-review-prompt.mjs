// The review prompt of this harness's own, and the intent it can carry. Zero deps, no fs: every function
// takes text and gives text, so the tests use inline strings.
//
// Why a prompt of our own. `codex exec review --base <sha>` writes the user message itself, one fixed
// sentence with the range, and takes no other text beside it: `--base` and a prompt exclude each other. A
// review given a prompt and no `--base` is a custom-target review: the user message is the prompt as
// written, with no range in it (odd/tasks/codex-review-lean.md, "What Codex loads, and what `exec review`
// accepts"). So a prompt that is to carry what the change is for must also name the range and the command
// that shows it, which is what `reviewPrompt` does. `js-harness codex-review --prompt own` sends it. The
// default is still `--base` with Codex's sentence: the comparison of the two ran on 2026-10-08, and this
// prompt, with the feature document, found the same seven seeded defects at about the same cost
// (odd/tasks/codex-review-lean.md, Progress), so nothing was gained by changing it.
//
// What it leaves alone. Codex's review rubric replaces the base instructions of a review whatever its
// target, and it fixes what a finding is and the format of the answer. This prompt says what to review and
// nothing about how to answer, so the answer is read the same way under either prompt
// (`./codex-review-answer.mjs`).
//
// A part of a range. A range too large for one session is reviewed in parts, each over some of its files
// (`./codex-review-parts.mjs`). `--base` cannot be limited to files, and a prompt can: the prompt of a part
// names its files in the command that shows them, so every part of a range is asked with this prompt,
// whatever the range would have been asked with as a whole.
//
// A range that leaves files out. A review reads code, and leaves the documents and what the project marks
// out (`./codex-review-scope.mjs`). `--base` reviews every file, so a range that leaves some out is asked
// by its files too, also when they fit in one part: that one part is asked with the text of a part, which
// then says nothing of parts. Which files were left out, and how many, is not in the prompt.
import { parseContract } from './contract.mjs';
import { NO_TEST_EXIT, NO_TEST_LINE } from './no-test-outside-turn.mjs';

// The version of the text `reviewPrompt` writes, kept in the run line of every review that used it, so that
// two reviews are only compared knowing whether they were asked the same thing. Any change to the wording
// below is a new version.
export const REVIEW_PROMPT_VERSION = 'js-harness.codex-review-prompt/v1';

// The version of the text `reviewPrompt` writes for one part of a range, kept in the run line of that part.
// It is a version of its own because it is another text: a change to the wording of a part leaves the
// reviews of whole ranges comparable with one another, and the other way round. `v2` is `v1` with the file
// names of the part read literally by the command it names (`git --literal-pathspecs diff`, see `scope`).
// `v3` is `v2` where the range leaves no file out of the review, to the character; where it does, the last
// line says so, and a range of one part is asked with this text as well.
export const REVIEW_PART_PROMPT_VERSION = 'js-harness.codex-review-part-prompt/v3';

// The version of the text `reviewPrompt` writes for a part of the review of a merge (`merge`): another text,
// which names what was written in the merge (`git show --remerge-diff`) instead of a diff of two commits.
export const REVIEW_MERGE_PROMPT_VERSION = 'js-harness.codex-review-merge-prompt/v1';

// How much of each section of the intent goes into the prompt: a feature document is written by hand and
// has no bound of its own, and the prompt is paid on every request of the review.
export const INTENT_MAX_CHARS = 2000;

// A full commit id, of a SHA-1 or a SHA-256 repository. Both ends of the range go into a command the model
// is told to run, so nothing else is let in: not a branch name, not a revision expression, not a flag.
const COMMIT_ID = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

// A path that needs no quoting in any shell the model runs its commands in (`sh`, PowerShell): letters,
// digits, `_`, `.`, `/` and `-`, and not a `-` first. Everything else is quoted, also what only one of the
// shells would act on (`@`, `~`, `$`, `&`, a space).
const PLAIN_PATH = /^[A-Za-z0-9_./][A-Za-z0-9_./-]*$/;

// What no quoting on one command line holds in both shells: a control character (a newline, a tab, a NUL)
// and the two quote characters, since PowerShell and `sh` close and escape a quote differently. And the
// typographic quotes, which PowerShell reads as those two wherever it reads a quote: U+2018 to U+201B as
// `'`, so one of them ends the single quotes a path is written in, and U+201C to U+201E as `"`. `sh` reads
// them as letters, so no way of escaping one holds in both.
const UNSAFE_IN_PATH = /[\x00-\x1f\x7f'"\u2018-\u201e]/;

/** `path` as the model can copy it into a command line: as it is when it is plain, else in single quotes,
 * inside which neither `sh` nor PowerShell reads anything. Throws for a path that cannot be written safely
 * that way (see `UNSAFE_IN_PATH`), naming it: a path written wrong would be a file the review never shows. */
export function quotedPath(path) {
  if (typeof path !== 'string' || path === '' || UNSAFE_IN_PATH.test(path)) {
    throw new Error(`The path ${JSON.stringify(path)} cannot be written safely on one command line (it is empty, or holds a quote, straight or typographic, or a control character such as a newline).`);
  }
  return PLAIN_PATH.test(path) ? path : `'${path}'`;
}

/** Whether `part` is a part of a range of which `leftOut` files are left out of the review. One part of one
 * is a part only of a range that leaves files out: one that leaves none out is reviewed whole. */
const isPart = (part, leftOut) =>
  part !== null && typeof part === 'object' && Number.isInteger(part.of) && part.of >= (leftOut > 0 ? 1 : 2) && Number.isInteger(part.index) && part.index >= 1 && part.index <= part.of &&
  Array.isArray(part.files) && part.files.length > 0;

/** The lines that say what to review: the whole range, or the `part` of it, in a range that leaves `leftOut`
 * files out of the review. */
function scope(from, head, part, leftOut, merge = false) {
  const findings = 'Report only what is wrong with the lines that diff adds or changes. Read any other file of the repository for context, and report nothing about code the diff leaves as it was.';
  if (!Number.isInteger(leftOut) || leftOut < 0) throw new Error(`How many files are left out of the review must be a count, got ${JSON.stringify(leftOut)}.`);
  if (part === null) {
    // A merge is asked by its files, as a range that leaves files out is: its command is no diff of two commits.
    if (merge) throw new Error('The review of a merge is asked by its files: the prompt of a whole range names a diff of two commits.');
    // Its command names no file, so it would show the files that were left out as well.
    if (leftOut > 0) throw new Error('A range that leaves files out of the review is asked by its files, as a part is: the prompt of a whole range names none.');
    return [
      `Review the code changes in the committed range ${from}..${head}.`,
      `Run \`git diff ${from} ${head}\` to inspect them: its output is the whole change under review.`,
      findings,
    ];
  }
  if (!isPart(part, merge ? Math.max(leftOut, 1) : leftOut)) {
    throw new Error(`Not a part of a range reviewed in parts (\`{ index, of, files }\`, with a file at least, and two parts or more unless the range leaves files out of the review): ${JSON.stringify(part)}.`);
  }
  // `--no-renames`: with it the diff of some files is the diff of each of them, whatever the others are. A
  // file that was renamed is then shown whole, as one removed and one added, also when its two names are in
  // different parts, which a rename could not be shown across.
  //
  // `--literal-pathspecs`: what follows `--` is read by git as pathspecs, and a file name may be one that
  // means something else. `*.md`, `a?.txt` and `app/[id]/page.tsx` are patterns, which also match the files
  // of other parts, past the scope and the size of this one; a name that starts with `:` is pathspec magic,
  // which may leave the file itself out. With the option every name is that one path and nothing more. It
  // is an option of `git`, not of `diff`, so it goes before the subcommand. The command that says what a
  // part must have seen is run with it too (`planParts` in `../codex-review.mjs`).
  const files = part.files.map(quotedPath).join(' ');
  const context = 'read them for context, and report nothing about them.';
  // A merge of the default branch is reviewed by what was written in it: the merge as committed against what
  // merging its two parents again gives, which is the resolution of its conflicts, conflict markers on the
  // removed side, and any edit made in it. What the merge brought in from the default branch had its own
  // review there (`mergeStart` in `../codex-review.mjs`).
  if (merge) {
    const command = `git --literal-pathspecs show --remerge-diff --format= --no-renames ${head} -- ${files}`;
    const which = part.of === 1 ? 'the files the command below names' : `part ${part.index} of ${part.of} of that review: the files the command below names`;
    return [
      `Review what was written in the merge commit ${head}, whose first parent is ${from}: the resolution of its conflicts and any edit made in it. This review covers ${which}.`,
      `Run \`${command}\` to inspect them: its output compares the merge with what merging its two parents again automatically gives, conflict markers included, and it is the whole change under review.`,
      findings,
      `What the merge took unchanged from either parent was reviewed on its own branch: ${context}`,
    ];
  }
  const command = `git --literal-pathspecs diff --no-renames ${from} ${head} -- ${files}`;
  // The one part of a range that leaves files out: the review is of its files, and there is no other part
  // to speak of.
  if (part.of === 1) {
    return [
      `Review the code changes in the committed range ${from}..${head}. This review covers the files the command below names.`,
      `Run \`${command}\` to inspect them: its output is the whole change under review.`,
      findings,
      `The other files the range changes are left out of this review: ${context}`,
    ];
  }
  return [
    `Review the code changes in the committed range ${from}..${head}. This is part ${part.index} of ${part.of} of that review: it covers the files the command below names.`,
    `Run \`${command}\` to inspect them: its output is the whole change under review in this part.`,
    findings,
    `The other files the range changes are reviewed in the other parts${leftOut > 0 ? ', or left out of the review' : ''}: ${context}`,
  ];
}

/** The text of the review prompt for the committed range `from..head`, both full commit ids, `from` being
 * the merge-base the diff starts at. It names the range, tells the model the command that shows it, and
 * asks for findings only inside that diff. With an `intent` (`{ goal, doneWhen }`, see `reviewIntent`) it
 * adds what the change is for, to judge the change against, as one step of its feature. Ends with a
 * newline, and is the same text for the same input. Throws when `from` or `head` is not a commit id.
 *
 * With a `part` (`{ index, of, files }`: the `index`-th of `of` parts, from 1, and the paths it covers, from
 * the root of the repository) the text is that of one part of a range reviewed in parts: it says which part
 * it is, names its files in the command, and says the other files are reviewed elsewhere. Throws when the
 * part is not one, or when one of its paths cannot be written on a command line (`quotedPath`).
 *
 * `leftOut` is how many files the range leaves out of the review (`./codex-review-scope.mjs`), 0 when none.
 * A range that leaves some out has no prompt as a whole, since that prompt's command shows every file: it
 * is asked in parts, each of which then says the other files are in the other parts or left out, and when
 * its files fit in one part that part is `{ index: 1, of: 1, files }`, whose text speaks of no part.
 *
 * `merge` is for the review of a merge of the default branch, `head` the merge and `from` its first parent:
 * the command of each part is then `git show --remerge-diff` of the merge, what was written in it, and a
 * merge is always asked by its files, one part of one included.
 *
 * `suiteRan`, for a review out of a turn of the gate lock, ends the text with `SUITE_RAN`: there the gate has
 * already run the suite on the range, and a `node --test` Codex starts is refused. */
export function reviewPrompt({ from, head, intent = null, part = null, leftOut = 0, merge = false, suiteRan = false }) {
  const text = promptText({ from, head, intent, part, leftOut, merge });
  return suiteRan ? `${text}\n${SUITE_RAN}\n` : text;
}

/** What a review out of a turn of the gate lock is told of the tests (`reviewPrompt`'s `suiteRan`): a review
 * that took the refusal for a failure called patches incorrect for it (odd/tasks/faster-check.md, part 2). */
export const SUITE_RAN = [
  '## The tests',
  'The gate already ran the whole test suite on this range, in a turn of the machine\'s gate lock, before this review.',
  `Here a \`node --test\` is refused at once, with exit ${NO_TEST_EXIT} and the line \`${NO_TEST_LINE}\`: that refusal is expected and is not a finding, nor a reason to call the patch incorrect. Read the tests instead of running them.`,
].join('\n');

function promptText({ from, head, intent, part, leftOut, merge }) {
  for (const id of [from, head]) {
    if (typeof id !== 'string' || !COMMIT_ID.test(id)) throw new Error(`The review prompt names its range by full commit id, got ${JSON.stringify(id)}.`);
  }
  const range = scope(from, head, part, leftOut, merge);
  if (intent === null) return `${range.join('\n')}\n`;
  const purpose = [
    '## What the change is for',
    'The goal and the completion criteria below come from the feature document this change belongs to. Judge the change against them: where it works against what they ask, or does something they rule out, that is a finding.',
    // A reviewed range is a work unit or a slice, never the whole feature, and the criteria are the whole
    // feature's: without this line every slice but the last would be reported as incomplete.
    'The change may be one step towards them, so a criterion it has not reached yet is not a finding by itself.',
    '',
    '### Goal',
    intent.goal,
    '',
    '### Done when',
    intent.doneWhen,
  ];
  return `${range.join('\n')}\n\n${purpose.join('\n')}\n`;
}

/** A feature document that holds no intent to carry: `heading` is the section that is missing or empty. */
export class IntentError extends Error {
  constructor(message, heading) {
    super(message);
    this.name = 'IntentError';
    this.heading = heading;
  }
}

const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const isHighSurrogate = (unit) => unit >= 0xd800 && unit <= 0xdbff;
const isLowSurrogate = (unit) => unit >= 0xdc00 && unit <= 0xdfff;

/** `text` when it is within `maxChars`, else its first `maxChars` characters and a line that says it was
 * cut, so the model does not take a cut section for the whole of it. The bound counts UTF-16 code units,
 * and a character outside the basic plane is two of them: a cut that would fall between the two is made
 * one unit earlier, since half a character is not text and would be sent as a replacement character. */
function bounded(text, maxChars) {
  if (text.length <= maxChars) return text;
  const splitsPair = isHighSurrogate(text.charCodeAt(maxChars - 1)) && isLowSurrogate(text.charCodeAt(maxChars));
  const kept = text.slice(0, splitsPair ? maxChars - 1 : maxChars).trimEnd();
  return `${kept}\n[Cut here: this section is ${thousands(text.length)} characters long, and only its first ${thousands(maxChars)} are given.]`;
}

/** The intent of the feature document `markdown`, as `{ goal, doneWhen }`: the bodies of its `## Goal` and
 * `## Done when` sections (the task contract's, found as `parseContract` finds them, so a heading inside a
 * fenced example is not one), trimmed, each bounded to `maxChars` characters with a note where it was cut.
 * Throws an `IntentError` that names the heading when a section is missing or empty. */
export function reviewIntent(markdown, { maxChars = INTENT_MAX_CHARS } = {}) {
  const sections = parseContract(markdown);
  const body = (heading) => {
    if (!sections.has(heading)) throw new IntentError(`The feature document has no \`## ${heading}\` heading, so it holds no intent for the review to carry.`, heading);
    const text = sections.get(heading);
    if (text === '') throw new IntentError(`The \`## ${heading}\` section of the feature document is empty, so it holds no intent for the review to carry.`, heading);
    return bounded(text, maxChars);
  };
  return { goal: body('Goal'), doneWhen: body('Done when') };
}

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
import { parseContract } from './contract.mjs';

// The version of the text `reviewPrompt` writes, kept in the run line of every review that used it, so that
// two reviews are only compared knowing whether they were asked the same thing. Any change to the wording
// below is a new version.
export const REVIEW_PROMPT_VERSION = 'js-harness.codex-review-prompt/v1';

// The version of the text `reviewPrompt` writes for one part of a range, kept in the run line of that part.
// It is a version of its own because it is another text: a change to the wording of a part leaves the
// reviews of whole ranges comparable with one another, and the other way round. `v2` is `v1` with the file
// names of the part read literally by the command it names (`git --literal-pathspecs diff`, see `scope`).
export const REVIEW_PART_PROMPT_VERSION = 'js-harness.codex-review-part-prompt/v2';

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

const isPart = (part) =>
  part !== null && typeof part === 'object' && Number.isInteger(part.of) && part.of >= 2 && Number.isInteger(part.index) && part.index >= 1 && part.index <= part.of &&
  Array.isArray(part.files) && part.files.length > 0;

/** The lines that say what to review: the whole range, or the `part` of it. */
function scope(from, head, part) {
  const findings = 'Report only what is wrong with the lines that diff adds or changes. Read any other file of the repository for context, and report nothing about code the diff leaves as it was.';
  if (part === null) {
    return [
      `Review the code changes in the committed range ${from}..${head}.`,
      `Run \`git diff ${from} ${head}\` to inspect them: its output is the whole change under review.`,
      findings,
    ];
  }
  if (!isPart(part)) throw new Error(`Not a part of a range reviewed in parts (\`{ index, of, files }\`, with two parts or more and a file at least): ${JSON.stringify(part)}.`);
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
  const command = `git --literal-pathspecs diff --no-renames ${from} ${head} -- ${part.files.map(quotedPath).join(' ')}`;
  return [
    `Review the code changes in the committed range ${from}..${head}. This is part ${part.index} of ${part.of} of that review: it covers the files the command below names.`,
    `Run \`${command}\` to inspect them: its output is the whole change under review in this part.`,
    findings,
    'The other files the range changes are reviewed in the other parts: read them for context, and report nothing about them.',
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
 * part is not one, or when one of its paths cannot be written on a command line (`quotedPath`). */
export function reviewPrompt({ from, head, intent = null, part = null }) {
  for (const id of [from, head]) {
    if (typeof id !== 'string' || !COMMIT_ID.test(id)) throw new Error(`The review prompt names its range by full commit id, got ${JSON.stringify(id)}.`);
  }
  const range = scope(from, head, part);
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

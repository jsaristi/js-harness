// The review prompt of this harness's own, and the intent it can carry. Zero deps, no fs: every function
// takes text and gives text, so the tests use inline strings.
//
// Why a prompt of our own. `codex exec review --base <sha>` writes the user message itself, one fixed
// sentence with the range, and takes no other text beside it: `--base` and a prompt exclude each other. A
// review given a prompt and no `--base` is a custom-target review: the user message is the prompt as
// written, with no range in it (odd/tasks/codex-review-lean.md, "What Codex loads, and what `exec review`
// accepts"). So a prompt that is to carry what the change is for must also name the range and the command
// that shows it, which is what `reviewPrompt` does. `js-harness codex-review --prompt own` sends it; the
// default stays `--base` with Codex's sentence until a comparison of the two decides.
//
// What it leaves alone. Codex's review rubric replaces the base instructions of a review whatever its
// target, and it fixes what a finding is and the format of the answer. This prompt says what to review and
// nothing about how to answer, so the answer is read the same way under either prompt
// (`./codex-review-answer.mjs`).
import { parseContract } from './contract.mjs';

// The version of the text `reviewPrompt` writes, kept in the run line of every review that used it, so that
// two reviews are only compared knowing whether they were asked the same thing. Any change to the wording
// below is a new version.
export const REVIEW_PROMPT_VERSION = 'js-harness.codex-review-prompt/v1';

// How much of each section of the intent goes into the prompt: a feature document is written by hand and
// has no bound of its own, and the prompt is paid on every request of the review.
export const INTENT_MAX_CHARS = 2000;

// A full commit id, of a SHA-1 or a SHA-256 repository. Both ends of the range go into a command the model
// is told to run, so nothing else is let in: not a branch name, not a revision expression, not a flag.
const COMMIT_ID = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

/** The text of the review prompt for the committed range `from..head`, both full commit ids, `from` being
 * the merge-base the diff starts at. It names the range, tells the model the command that shows it, and
 * asks for findings only inside that diff. With an `intent` (`{ goal, doneWhen }`, see `reviewIntent`) it
 * adds what the change is for, to judge the change against, as one step of its feature. Ends with a
 * newline, and is the same text for the same input. Throws when `from` or `head` is not a commit id. */
export function reviewPrompt({ from, head, intent = null }) {
  for (const id of [from, head]) {
    if (typeof id !== 'string' || !COMMIT_ID.test(id)) throw new Error(`The review prompt names its range by full commit id, got ${JSON.stringify(id)}.`);
  }
  const range = [
    `Review the code changes in the committed range ${from}..${head}.`,
    `Run \`git diff ${from} ${head}\` to inspect them: its output is the whole change under review.`,
    'Report only what is wrong with the lines that diff adds or changes. Read any other file of the repository for context, and report nothing about code the diff leaves as it was.',
  ];
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

/** `text` when it is within `maxChars`, else its first `maxChars` characters and a line that says it was
 * cut, so the model does not take a cut section for the whole of it. */
function bounded(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}\n[Cut here: this section is ${thousands(text.length)} characters long, and only its first ${thousands(maxChars)} are given.]`;
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

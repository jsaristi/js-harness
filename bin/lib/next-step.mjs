// The last line of a refusal (F8 S4b, odd/tasks/f8-s4b-contradictions.md; the reverse-engineering document, 13.3 row 1):
// the tool hands the model its next step as data, bound to the state it was issued for. Every refusal of `check`,
// `check --push`, the merge door, `lens-review` and `codex-review` ends with one line in one of three forms: the exact
// command; the step to take first (a commit, a checkout, a split), after which the refusal that follows prints the
// command at the new head; or "no command" with why. A review command carries the base and the head it was computed
// at as hashes (`--at`), and `lens-review` and `codex-review` refuse it once `HEAD` is another commit, as git's
// `push --force-with-lease=<ref>:<expect>` refuses a ref that moved: a stale command is refused, not rerun.
// bin/conventions-next-step.test.mjs holds the five surfaces to it. Pure: the commands read the commits.

const PREFIX = 'next: ';
const HASH = /^[0-9a-f]{7,40}\^?$/;
const SHOWN = 12;
const REVIEWS = ['lens-review', 'codex-review'];

/** The exact command to run next. */
export const commandStep = (text) => ({ kind: 'command', text });
/** The step to take before the command can be named: the refusal that follows names it. */
export const firstStep = (text) => ({ kind: 'step', text });
/** No command follows, and why. */
export const noStep = (why) => ({ kind: 'none', text: why });

/** The last line of a refusal, from one of the three forms. */
export function nextLine(step) {
  if (step.kind === 'command') return `${PREFIX}${step.text}`;
  if (step.kind === 'step') return `${PREFIX}${step.text}; then run again what printed this, for the command at the new head`;
  return `${PREFIX}no command, ${step.text}`;
}

/** One row as `check` and `failures check` print it: status, name and detail, its lines, and last, on a row that
 * fails, its next step. */
export function formatRow(row) {
  const status = row.info ? 'INFO' : row.pass ? 'PASS' : 'FAIL';
  const next = status === 'FAIL' && row.next ? [nextLine(row.next)] : [];
  const lines = [...(row.lines ?? []), ...next].map((line) => `\n      ${line}`).join('');
  return `${status}  ${row.name}  ${row.detail}${lines}`;
}

/** A hash as a printed command shows it: 12 characters, enough to stay unique, with a `^` kept. */
const shown = (hash) => (hash.endsWith('^') ? hash : hash.slice(0, SHOWN));

/** The command that reviews `base..at`: `tool` one of the two reviews, `base` and `at` hashes (a `^` after the base is
 * kept), `lenses` the lenses the tool computed or nothing (then the agent picks), `flags` any further bare flags. Throws
 * on a label or a placeholder, a programmer's error: a branch name moves, and `<rev>` is bound to nothing. */
export function reviewCommand(tool, { base, at, lenses = null, flags = [] }) {
  if (!REVIEWS.includes(tool)) throw new Error(`a review command is lens-review or codex-review, not ${tool}`);
  for (const [name, value] of [['base', base], ['at', at]]) {
    if (typeof value !== 'string' || !HASH.test(value) || (name === 'at' && value.endsWith('^'))) throw new Error(`the ${name} of a printed command is a hash, not ${JSON.stringify(value)}`);
  }
  const lensPart = tool === 'lens-review' ? ` --lenses ${lenses ?? '<lens,...>'} --reason "<what it touched and how>"` : '';
  return [`js-harness ${tool} --base ${shown(base)} --at ${shown(at)}${lensPart}`, ...flags].join(' ');
}

/** Why a review command given `--at <at>` is refused, or `null` when it may start: `atCommit` is the commit `at` names
 * (`null` when it names none) and `head` the commit `HEAD` is now. */
export function atRefusal({ at, atCommit, head }) {
  if (!atCommit) return `--at ${at} does not name a commit here.\n${nextLine(firstStep('run again what printed this command, from this repository'))}`;
  if (atCommit === head) return null;
  return `this command was computed at ${atCommit.slice(0, 7)}, and HEAD is ${head.slice(0, 7)} now: the range it names is no longer the branch's, so it is refused, not rerun.\n`
    + `${PREFIX}run again what printed this command (js-harness check --push, or the merge door), for the command bound to this head`;
}

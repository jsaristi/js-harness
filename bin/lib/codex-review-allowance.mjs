// The plan of a Codex review against its allowance: what `codex-review --plan` says after the plan itself.
//
// Why. Three rules of Sebastián's bound what a review may cost without asking him: a floor a review, a rate
// a changed line, and a margin over the larger of the two that still counts as inside
// (`codex-review-floor`, `codex-review-rate`, `codex-review-margin` in ./rules-data.mjs). Nothing read them:
// each session took a figure of the plan and did the sum by hand, and not every session did the same sum.
// This is the sum, done once, and said in a line.
//
// What it does not decide. A plan gives a range, and which of its two figures is held to the allowance is
// his to say, so the line says where each stands: the verdict is of the estimate, the first figure, and a
// higher figure that alone passes the margin is said beside it. "Inside" is a fact about one plan and never a
// permission: a second run after a review fell is his whatever its plan, and nothing here can know of one.
// Nor does anything refuse a run for its cost; the line says so where the estimate is over.
//
// Which figures. Those the plan prints (`reviewPlan`): its estimate and its higher figure, each a sum of
// parts rounded to two figures, and its changed lines, which are of the files the review reads and of none
// it leaves out. That count is never more than the changed lines of the slice, so the allowance is never
// larger than his rule gives.
//
// Where it is said. The three rules are of this repository only, so each is read with `ruleHere` against
// the rules file of the project the command runs in. A project that does not declare the rules gets no line:
// a number that is not its rule is not printed as one. Where the rules cannot be read as that project's (a
// copy of the harness that holds another list, a rule that was retired, a file that cannot be read) the
// line says so and names no figure.
//
// The design and what its reader changed: odd/tasks/rule-hierarchy.md, "The plan against its allowance".
import fs from 'node:fs';
import path from 'node:path';
import { RULES } from './rules-data.mjs';
import { ruleHere } from './rules.mjs';

/** The rules file of a project, as a path below its root. */
const RULES_FILE = 'bin/lib/rules-data.mjs';

/** The three rules of the allowance, each read by its id in its unit, so that `rules check` lists this file
 * as their reader and refuses an id that is renamed or retired. */
const READ = {
  floor: (text, list) => ruleHere('codex-review-floor', 'input tokens a review', text, list),
  rate: (text, list) => ruleHere('codex-review-rate', 'input tokens a changed line', text, list),
  margin: (text, list) => ruleHere('codex-review-margin', 'percent of the allowance', text, list),
};

/** The rules file of the project at `root`, read from its tree as `rules applied` reads it: `{ text }`, with
 * `null` where the project has none, or `{ unreadable }` with the code of a read that failed otherwise. */
export function readProjectRules(root, io = fs) {
  try {
    return { text: io.readFileSync(path.join(root, ...RULES_FILE.split('/')), 'utf8') };
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return { text: null };
    return { unreadable: err.code ?? 'unknown' };
  }
}

/** `plan` (`reviewPlan`) against the allowance of a review, in the project whose rules file is `project`
 * (`readProjectRules`). `null` when there is nothing to say: a plan with no part, or a project that does not
 * declare the rules. `{ unsaid }`, the reason in words, when the rules cannot be read as this project's.
 * Otherwise the three rules as read (`floor`, `rate`, `margin`), the `changedLines` counted, the
 * `allowance` (the larger of the floor and the rate times those lines), the plan's `inputTokens` and
 * `inputTokensHigh`, and:
 *  - `verdict`, of the estimate alone: `inside` up to the allowance, `margin` over it by no more than the
 *    margin, `over` beyond that, and `none` for a plan that has no estimate;
 *  - `highOver`, whether the higher figure is beyond the margin while the estimate is not. */
export function reviewAllowance(plan, project, list = RULES) {
  if (plan.parts.length === 0) return null;
  if (Object.hasOwn(project, 'unreadable')) return { unsaid: `this project's ${RULES_FILE} could not be read (${project.unreadable})` };
  const rules = {};
  for (const [name, read] of Object.entries(READ)) {
    let here;
    try {
      here = read(project.text, list);
    } catch (err) {
      return { unsaid: err.message };
    }
    if (here.off === 'elsewhere') return null;
    if (here.off === 'behind') return { unsaid: `this copy of the harness holds another list of rules than this project's ${RULES_FILE}` };
    rules[name] = here.value;
  }
  const { floor, rate, margin } = rules;
  const { changedLines, inputTokens, inputTokensHigh } = plan;
  const allowance = Math.max(floor, rate * changedLines);
  // In whole numbers, so that a figure at the allowance and its margin exactly is inside and one more is not.
  const beyondMargin = (tokens) => tokens * 100 > allowance * (100 + margin);
  const verdict = inputTokens === null ? 'none' : beyondMargin(inputTokens) ? 'over' : inputTokens > allowance ? 'margin' : 'inside';
  const highOver = verdict !== 'none' && verdict !== 'over' && beyondMargin(inputTokensHigh);
  return { floor, rate, margin, changedLines, allowance, inputTokens, inputTokensHigh, verdict, highOver };
}

const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** What `said` (`reviewAllowance`) is, as the one line a person reads, or `null` where there is none. */
export function allowanceLine(said) {
  if (said === null) return null;
  if (Object.hasOwn(said, 'unsaid')) return `No allowance is said of this plan: ${said.unsaid}.`;
  const { floor, rate, margin, changedLines, allowance, inputTokens, inputTokensHigh, verdict, highOver } = said;
  const counts = `${thousands(changedLines)} changed line${changedLines === 1 ? '' : 's'}`;
  const head = `Allowance of this plan: ${thousands(allowance)} input tokens, the larger of ${thousands(floor)} a review ` +
    `and ${thousands(rate)} a changed line, for the ${counts} it reads.`;
  const counted = `the ${margin} percent that counts as inside`;
  const estimate = `Its estimate, about ${thousands(inputTokens ?? 0)},`;
  const sentence = {
    none: 'The plan has no estimate, so it cannot say whether the review is inside it.',
    inside: `${estimate} is inside it.`,
    margin: `${estimate} is over it by no more than ${counted}.`,
    over: `${estimate} is over it by more than ${counted}: a review over its allowance is asked of the owner of these rules before it runs, ` +
      'and this command refuses nothing for its cost.',
  }[verdict];
  const higher = highOver ? ` Its higher figure, ${thousands(inputTokensHigh)}, is over it by more than ${counted}.` : '';
  return `${head} ${sentence}${higher}`;
}

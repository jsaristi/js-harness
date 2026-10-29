// What the pages of the moments read from a roadmap (odd/tasks/visual-pages.md): its plan sections (`## <name> plan`)
// as steps, each with the state the roadmap says in its `- **State:**` bullet and the feature documents that state
// names, and the comparison of two maps and two plans, before and after a moment. A state the roadmap says is shown
// as said, never as proof: the roadmap itself reads a step's state in its feature document, so the documents' task
// counts are what tells a step advanced, and prose that changed alone is only text changed. Pure: markdown and counts
// in, data out; the commands read git.

const FENCE = /^\s*(```|~~~)/;
const PLAN_HEADING = /^##\s+(.+\bplan)\s*$/i;
const SECTION_HEADING = /^#{1,2}\s/;
const STEP_HEADING = /^###\s+(.+?)\s*$/;
const STATE_BULLET = /^\s*[-*+]\s+\*\*State:\*\*\s*(.*)$/;
const NEXT_BULLET = /^\s*[-*+]\s/;
const STEP_ID = /^S\d+[\w-]*$/;
const DOCUMENT = /odd\/tasks\/[\w.-]+\.md/g;
const NAME = /`([\w.-]+)`/g;

// The first words a state opens with, as the roadmap writes them; any other opening is `other`.
const REPORTED = ['in progress', 'not started', 'to do', 'designed', 'started', 'applied', 'built', 'done'];

/** The state a `State` text reports by its first words, lower case (`done`, `built`, `in progress`, ...), or `other`. */
export function reportedOf(said) {
  if (typeof said !== 'string') return 'other';
  const text = said.trim().toLowerCase();
  return REPORTED.find((words) => text === words || new RegExp(`^${words}\\b`).test(text)) ?? 'other';
}

/** The plan sections of `markdown`, in order: `[{ name, steps: [{ id, title, said, reported, documents }] }]`. A step
 * is a `### ` heading inside the section, its `id` the first word when it is a step number (`S5c-a`), else its whole
 * title; `said` its `State` bullet's text with its continued lines; `documents` the feature documents that text names,
 * once each; `names` the other names it quotes (a branch, a worktree), which the command may find as a feature document
 * (`odd/tasks/<name>.md`) at a commit. A heading with no `State` bullet is no step. A fence's lines are content. */
export function planOf(markdown) {
  const plans = [];
  let plan = null;
  let step = null;
  let stateOpen = false;
  let fenced = false;
  for (const line of String(markdown).split(/\r?\n/)) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      stateOpen = false;
      continue;
    }
    if (fenced) continue;
    const planHeading = PLAN_HEADING.exec(line);
    if (planHeading) {
      plan = { name: planHeading[1].trim(), steps: [] };
      plans.push(plan);
      step = null;
      stateOpen = false;
      continue;
    }
    if (SECTION_HEADING.test(line)) {
      plan = null;
      step = null;
      stateOpen = false;
      continue;
    }
    if (plan === null) continue;
    const stepHeading = STEP_HEADING.exec(line);
    if (stepHeading) {
      const title = stepHeading[1];
      const first = title.split(/\s+/)[0];
      step = { id: STEP_ID.test(first) ? first : title, title, said: null };
      plan.steps.push(step);
      stateOpen = false;
      continue;
    }
    if (step === null) continue;
    const state = STATE_BULLET.exec(line);
    if (state) {
      step.said = state[1].trim();
      stateOpen = true;
      continue;
    }
    if (stateOpen && line.trim() !== '' && !NEXT_BULLET.test(line) && /^\s/.test(line)) step.said = `${step.said} ${line.trim()}`;
    else stateOpen = false;
  }
  return plans.map(({ name, steps }) => ({
    name,
    steps: steps.filter((one) => one.said !== null).map(({ id, title, said }) => {
      const documents = [...new Set(said.match(DOCUMENT) ?? [])];
      const names = [...new Set([...said.matchAll(NAME)].map((match) => match[1]).filter((name) => !name.endsWith('.md')))];
      return { id, title, said, reported: reportedOf(said), documents, names };
    }),
  }));
}

const counts = (value) => (value ? { done: value.done, total: value.total } : null);

/** How one step moved between `before` and `after` (either `null`): `new`, `gone`, `advanced` (a document gained done
 * tasks, or appeared, or the reported state changed), `text changed` (the prose alone), or `same`. */
function changeOf(before, after, documents) {
  if (before === null) return 'new';
  if (after === null) return 'gone';
  const gained = documents.some((one) => one.after !== null && (one.before === null || one.after.done > one.before.done));
  if (gained || before.reported !== after.reported) return 'advanced';
  return before.said === after.said ? 'same' : 'text changed';
}

/** The plans `before` and `after` (from `planOf`) step by step, with the task counts of the documents they name at each
 * moment (`tasks.before` and `tasks.after`, keyed by path; a path a moment lacks is unknown there, never zero):
 * `[{ name, steps: [{ id, title, before, after, change, documents: [{ path, before, after }] }] }]`, in the order of
 * `after`, then the steps only `before` held. */
export function comparePlans(before, after, tasks = { before: {}, after: {} }) {
  const names = [...new Set([...after.map((plan) => plan.name), ...before.map((plan) => plan.name)])];
  return names.map((name) => {
    const old = before.find((plan) => plan.name === name)?.steps ?? [];
    const now = after.find((plan) => plan.name === name)?.steps ?? [];
    const ids = [...new Set([...now.map((step) => step.id), ...old.map((step) => step.id)])];
    return {
      name,
      steps: ids.map((id) => {
        const was = old.find((step) => step.id === id) ?? null;
        const is = now.find((step) => step.id === id) ?? null;
        const paths = [...new Set([...(is?.documents ?? []), ...(was?.documents ?? [])])];
        const documents = paths.map((path) => ({ path, before: counts(tasks.before?.[path]), after: counts(tasks.after?.[path]) }));
        return { id, title: (is ?? was).title, before: was, after: is, change: changeOf(was, is, documents), documents };
      }),
    };
  });
}

/** The maps `before` (or `null`, when no before is known) and `after` (`mapOf` of `bin/lib/report.mjs`) phase by phase
 * by title: `{ total: { before, after }, phases: [{ title, before, after, open, change }] }`, `change` one of `same`,
 * `changed`, `closed` (complete after and not before), `new` or `gone`. */
export function compareMaps(before, after) {
  const old = before?.phases ?? [];
  const titles = [...new Set([...after.phases.map((phase) => phase.title), ...old.map((phase) => phase.title)])];
  return {
    total: { before: before ? { done: before.done, total: before.total } : null, after: { done: after.done, total: after.total } },
    phases: titles.map((title) => {
      const was = old.find((phase) => phase.title === title) ?? null;
      const is = after.phases.find((phase) => phase.title === title) ?? null;
      let change = 'same';
      if (before === null) change = 'same';
      else if (was === null) change = 'new';
      else if (is === null) change = 'gone';
      else if (is.done === is.total && was.done < was.total) change = 'closed';
      else if (is.done !== was.done || is.total !== was.total) change = 'changed';
      return { title, before: counts(was), after: counts(is), open: is?.open ?? [], change };
    }),
  };
}

// The onboarding of a project: the skeletons of its three documents and the static check of what a session wrote
// into them — see odd/tasks/onboarding.md, D5-D7. No fs here: every function takes the files' text (or `null` for a
// missing file), so the tests use inline fixture strings. The check never runs a command.
import crypto from 'node:crypto';
import { commandsIn, parseContract, tasksOf } from './contract.mjs';
import { cellsOf, parseRoadmap } from './progress.mjs';

export const ONBOARDING_PATH = 'odd/tasks/onboarding.md';
export const ORIGIN_PATH = 'docs/origin.md';
export const ROADMAP_PATH = 'docs/ROADMAP.md';
export const AGENTS_PATH = 'AGENTS.md';

/** The line the Close stage adds to `AGENTS.md`, outside the harness block, so every later session starts there. */
export const ROADMAP_LINE = "The plan is docs/ROADMAP.md: a session starts there, and each feature's state is in odd/tasks/.";

/** The nine topics of the interview, in the order they are asked (D3). */
export const TOPICS = [
  'What the project is and for whom',
  'The outcome that makes it worth doing',
  'What exists today',
  'Decisions already made, the language of the artifacts among them',
  'Constraints and their reasons',
  'In and out of scope for the first usable version',
  'What the owner decides alone',
  'Order: what comes first, and what can wait',
  'Risks and unknowns',
];
/** The topics a plan cannot be made without, so they cannot be left unknown (D3). */
const REQUIRED_TOPICS = [1, 2, 7];

/** The stages a finding sends the work back to, by number (D2). */
export const STAGES = {
  1: 'Read',
  2: 'Interview',
  3: 'Pre-plan',
  4: 'Pre-plan review',
  5: 'Plan',
  6: 'Plan review',
  7: 'Close',
};

const ORIGIN_SECTIONS = ['Status', 'Goal', 'Why', 'What exists', 'Decisions already made', 'Principles', 'Phases', 'Not built', 'Risks', 'Open decisions', 'Sources'];

export function featureTemplate() {
  return `# Onboarding

Written by \`js-harness onboard template feature\`. \`js-harness onboard\` reads the stage from this file; run it to resume.

## Goal
An approved pre-plan (\`${ORIGIN_PATH}\`) and roadmap (\`${ROADMAP_PATH}\`) for this project, that every later session starts from.

## Why
A project starts from a plan the owner approved, so the work follows its objective and not the moment's judgment.

## Done when
- \`js-harness onboard check\` exits 0

## In scope / Out of scope
- In: \`${ORIGIN_PATH}\`, \`${ROADMAP_PATH}\`, \`${AGENTS_PATH}\` outside its js-harness block, this document.
- Out: the project's code — onboarding plans the work and builds none of it.

## Constraints
- One question to the owner at a time — because each answer is recorded verbatim and may change the next question.

## Ask me before
The two approvals: the pre-plan and the roadmap.

## What exists
<what the repository holds today, each with its evidence: a path, or a command and its output>

## Interview
<!-- A topic is checked once answered ("— answered (L<n>)") or marked unknown with its open decision ("— unknown (OD<n>)"). -->
${TOPICS.map((title, i) => `- [ ] ${i + 1} ${title}`).join('\n')}

## Tasks
<!-- An approval records the hashes \`js-harness onboard hash\` prints and the Log line of the owner's yes. -->
- [ ] O1 Repository read
- [ ] O2 Pre-plan written
- [ ] O3 Pre-plan approved
- [ ] O4 Roadmap written
- [ ] O5 Roadmap approved
- [ ] O6 Closed

## Reviews
<!-- One item per round of the two readers: "Pre-plan round <n>: ..." or "Roadmap round <n>: ...", what each reader found and what changed. -->

## Log
- L1 <date> The owner's request, verbatim: "<his words>"
`;
}

export function originTemplate(name) {
  return `# ${name}: origin

## Status
The pre-plan of this project, written by its onboarding (\`${ONBOARDING_PATH}\`) from the owner's answers. Frozen once
the onboarding closes: what changes after that is recorded in [ROADMAP.md](ROADMAP.md).

## Goal
<one sentence: the outcome, not the steps>

## Why
<the owner's reason, in his words, with the date>

## What exists
<what the project has today, each with its evidence>

## Decisions already made
| Area | Decision | The owner's words |
|------|----------|-------------------|
| <area> | <decision> | "<his words>" (<date>) |

## Principles
1. <a principle of this project> — <why>

## Phases
| Phase | Goal | Done when |
|-------|------|-----------|
| <phase> | <goal> | \`<command>\` exits 0 |

## Not built
<what the installed stack already does, so this project does not build it>

## Risks
- <a risk> — <what it would cost>

## Open decisions
<!-- One item per decision that is the owner's, asked one at a time: "OD<n> ...". A decided one adds "(decided: ..., <date>)". -->
- OD1 <a decision that is the owner's>

## Sources
- <date> <the owner's answer to topic n, or a research link>
`;
}

export function roadmapTemplate() {
  return `# Roadmap

The one living plan of this project. Each fact lives in one place:

- **This file**: the plan. What comes next is read under [Next](#next), and nowhere else.
- [origin.md](origin.md): where the plan came from, frozen.
- \`odd/tasks/\`: one document per feature, with its tasks, progress and evidence.

## Principles
1. <a principle, carried from the pre-plan>

## Decided
| Area | Decision |
|------|----------|
| <area> | <decision> |

## Phases
<!-- One row per phase of the pre-plan, the same names as under Checklist. Done when: a command, \`<command>\` exits 0. -->
| Phase | Goal | Done when | State |
|-------|------|-----------|-------|
| <phase> | <goal> | \`<command>\` exits 0 | Not started |

## Checklist

### <phase>
- [ ] <what is true when this step is done: one feature or less>

## Next
<the first unchecked step, and the text that starts its session>

## Open decisions
- OD1 <every decision still open in the pre-plan, by its ID>

## Risks
- <a risk> — <what it would cost>
`;
}

/** The first 12 hex of the sha256 of `text` with LF line ends, so a CRLF checkout hashes as its LF one. */
export function shortHash(text) {
  return crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
}

/** The hashes an approval records (D2): of the interview's section, of the pre-plan and of the roadmap; `null` for
 * what is missing. */
export function hashes({ onboarding, origin, roadmap }) {
  const interview = onboarding === null ? undefined : parseContract(onboarding).get('Interview');
  return {
    interview: interview === undefined ? null : shortHash(interview),
    origin: origin === null ? null : shortHash(origin),
    roadmap: roadmap === null ? null : shortHash(roadmap),
  };
}

// A template line still to fill: a `<...>` placeholder that is no HTML comment.
const PLACEHOLDER = /<[^<>!][^<>]*>/;
// An interview topic: its box, its number, the rest of the line.
const TOPIC_LINE = /^\s*[-*+]\s+\[([ xX])\]\s+(\d+)\b(.*)$/;
const UNKNOWN = /\bunknown \(OD\d+\)/i;
const RECORDED_HASH = /\b(interview|origin|roadmap) sha256:([0-9a-f]{12})\b/g;
const LOG_LINE = /\bL\d+\b/;
// An open decision's ID at the start of a list item.
const DECISION_ITEM = /^\s*[-*+]\s+(OD\d+)\b(.*)$/;

/** The lines of `template` that are placeholders and appear unchanged in `text`. */
function templateLinesLeft(text, template) {
  const present = new Set(text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()));
  return template.split('\n')
    .map((line) => line.trim())
    .filter((line) => PLACEHOLDER.test(line) && !line.startsWith('<!--') && present.has(line));
}

/** The rows of the first table in `body` whose header names `Phase`, keyed by that cell: `Map(name -> cells)`, with
 * the header's cells, or `null` when there is no such table. */
function phaseTable(body) {
  let header = null;
  let started = false;
  const rows = new Map();
  for (const line of body.split('\n')) {
    const cells = cellsOf(line);
    if (cells === null) {
      if (started) break;
      header = null;
      continue;
    }
    if (!header) {
      if (cells.some((cell) => /^phase$/i.test(cell))) header = cells;
      continue;
    }
    if (!started) {
      started = true; // the delimiter row
      continue;
    }
    rows.set(cells[header.findIndex((cell) => /^phase$/i.test(cell))], cells);
  }
  return header ? { header, rows } : null;
}

/** The open decisions under `## Open decisions` of `body`: the IDs of items that do not say `(decided`. */
function openDecisions(body) {
  const open = [];
  for (const line of (body ?? '').split('\n')) {
    const item = line.match(DECISION_ITEM);
    if (item && !/\(decided\b/i.test(item[2])) open.push(item[1]);
  }
  return open;
}

/** The interview's findings (stage 2). */
function interviewFindings(onboarding) {
  const findings = [];
  const topics = new Map();
  for (const line of (parseContract(onboarding).get('Interview') ?? '').split('\n')) {
    const topic = line.match(TOPIC_LINE);
    if (topic && !topics.has(Number(topic[2]))) topics.set(Number(topic[2]), { done: topic[1] !== ' ', rest: topic[3] });
  }
  for (let n = 1; n <= TOPICS.length; n += 1) {
    if (!topics.has(n)) findings.push(`the interview has no topic ${n}`);
  }
  for (const [n, topic] of topics) {
    if (!topic.done) findings.push(`topic ${n} is not answered yet`);
  }
  for (const n of REQUIRED_TOPICS) {
    const topic = topics.get(n);
    if (topic?.done && UNKNOWN.test(topic.rest)) findings.push(`topic ${n} is marked unknown: topics 1, 2 and 7 need an answer`);
  }
  return findings.map((message) => ({ file: ONBOARDING_PATH, stage: 2, message }));
}

/** One approval's findings: checked, its Log line, and each hash it must record matching the file as it is now. */
function approvalFindings(task, { id, what, stage, files, current, compare }) {
  const at = (message) => ({ file: ONBOARDING_PATH, stage, message });
  if (!task?.done) return [at(`${id} is not checked: the ${what} has no approval yet`)];
  const findings = [];
  const recorded = new Map([...task.line.matchAll(RECORDED_HASH)].map((m) => [m[1], m[2]]));
  for (const name of files) {
    if (!recorded.has(name)) findings.push(at(`${id} records no ${name} sha256: js-harness onboard hash prints it`));
    else if (compare && current[name] !== null && recorded.get(name) !== current[name]) {
      const file = name === 'origin' ? ORIGIN_PATH : ROADMAP_PATH;
      findings.push(at(`${id} records ${name} sha256:${recorded.get(name)}, but ${file} is sha256:${current[name]}: it changed since its approval`));
    }
  }
  if (!LOG_LINE.test(task.line)) findings.push(at(`${id} names no Log line (L<n>) with the owner's yes`));
  return findings;
}

/** The roadmap's findings (stage 5): its phases, steps, rows and done-when commands, and its ties to the pre-plan. */
function roadmapFindings(roadmap, origin) {
  const at = (message) => ({ file: ROADMAP_PATH, stage: 5, message });
  const findings = [];
  const sections = parseContract(roadmap);
  const { phases } = parseRoadmap(roadmap);
  const table = phaseTable(sections.get('Phases') ?? '');
  const rows = table?.rows ?? new Map();
  if (phases.length === 0) findings.push(at('no phase under ## Checklist: one ### heading per phase, its steps under it'));
  if (!table) findings.push(at('no table under ## Phases with a Phase column'));
  for (const phase of phases) {
    if (phase.total === 0) findings.push(at(`phase "${phase.title}" has no step`));
    if (table && !rows.has(phase.title)) findings.push(at(`phase "${phase.title}" has no row in ## Phases`));
  }
  const names = new Set(phases.map((phase) => phase.title));
  for (const name of rows.keys()) {
    if (!names.has(name)) findings.push(at(`the ## Phases row "${name}" has no phase under ## Checklist`));
  }
  const doneWhen = table?.header.findIndex((cell) => /^done when$/i.test(cell)) ?? -1;
  if (table && doneWhen === -1) findings.push(at('the ## Phases table has no Done when column'));
  for (const [name, cells] of rows) {
    if (doneWhen !== -1 && commandsIn(cells[doneWhen] ?? '').length === 0) {
      findings.push(at(`the Done when of "${name}" names no command: write \`<command>\` exits 0`));
    }
  }
  if (origin !== null) {
    for (const name of phaseTable(parseContract(origin).get('Phases') ?? '')?.rows.keys() ?? []) {
      if (!names.has(name)) findings.push(at(`the pre-plan phase "${name}" is not a roadmap phase`));
    }
  }
  if (!sections.get('Next')) findings.push(at('no ## Next: the first unchecked step and the text that starts its session'));
  if (origin !== null) {
    const carried = sections.get('Open decisions') ?? '';
    for (const id of openDecisions(parseContract(origin).get('Open decisions'))) {
      if (!new RegExp(`\\b${id}\\b`).test(carried)) findings.push(at(`${id} is open in ${ORIGIN_PATH} and not under ## Open decisions`));
    }
  }
  for (const line of templateLinesLeft(roadmap, roadmapTemplate())) findings.push(at(`still holds the template line "${line}"`));
  return findings;
}

/** Every finding of an onboarding, in the order of the stages they send the work back to: `{ file, stage, message }`.
 * `files` holds each file's text, `null` where it is missing; `agentsTemplate` is the base `AGENTS.md` `init` writes,
 * whose placeholder lines must be gone. With `plan`, only the roadmap and its ties to the pre-plan (stage 5). Once
 * O6 closes the onboarding, the approvals are no longer compared with the files, which live on. */
export function checkOnboarding({ onboarding, origin, roadmap, agents }, { agentsTemplate = '', plan = false } = {}) {
  const findings = [];
  const missing = (file, stage, template) => ({ file, stage, message: `missing: js-harness onboard template ${template} --write starts it` });
  if (plan) {
    if (roadmap === null) return [missing(ROADMAP_PATH, 5, 'roadmap')];
    return roadmapFindings(roadmap, origin);
  }

  if (onboarding === null) findings.push(missing(ONBOARDING_PATH, 1, 'feature'));
  else {
    findings.push(...interviewFindings(onboarding));
    const lines = onboarding.replace(/\r\n/g, '\n').split('\n');
    const tasks = new Map(tasksOf(onboarding).map((task) => [task.id, { ...task, line: lines[task.start - 1] }]));
    const compare = !tasks.get('O6')?.done;
    const current = { origin: origin === null ? null : shortHash(origin), roadmap: roadmap === null ? null : shortHash(roadmap) };
    findings.push(...approvalFindings(tasks.get('O3'), { id: 'O3', what: 'pre-plan', stage: 4, files: ['origin'], current, compare }));
    findings.push(...approvalFindings(tasks.get('O5'), { id: 'O5', what: 'roadmap', stage: 6, files: ['roadmap', 'origin'], current, compare }));
    const reviews = (parseContract(onboarding).get('Reviews') ?? '').split('\n').map((line) => line.replace(/^\s*[-*+]\s+/, ''));
    for (const [round, stage, what] of [['Pre-plan', 4, 'the pre-plan'], ['Roadmap', 6, 'the roadmap']]) {
      if (!reviews.some((line) => line.toLowerCase().startsWith(round.toLowerCase()))) {
        findings.push({ file: ONBOARDING_PATH, stage, message: `## Reviews has no "${round}" round: two readers read ${what} before the owner` });
      }
    }
    for (const line of templateLinesLeft(onboarding, featureTemplate())) {
      findings.push({ file: ONBOARDING_PATH, stage: 2, message: `still holds the template line "${line}"` });
    }
  }

  if (origin === null) findings.push(missing(ORIGIN_PATH, 3, 'origin'));
  else {
    const sections = parseContract(origin);
    for (const title of ORIGIN_SECTIONS) {
      if (!sections.get(title)) findings.push({ file: ORIGIN_PATH, stage: 3, message: `missing section "## ${title}"` });
    }
    for (const line of templateLinesLeft(origin, originTemplate(''))) {
      findings.push({ file: ORIGIN_PATH, stage: 3, message: `still holds the template line "${line}"` });
    }
  }

  if (roadmap === null) findings.push(missing(ROADMAP_PATH, 5, 'roadmap'));
  else findings.push(...roadmapFindings(roadmap, origin));

  const close = (message) => ({ file: AGENTS_PATH, stage: 7, message });
  if (agents === null) findings.push(close('missing: js-harness init writes one'));
  else {
    if (!agents.includes(ROADMAP_LINE)) findings.push(close(`has no line "${ROADMAP_LINE}"`));
    for (const line of templateLinesLeft(agents, agentsTemplate)) findings.push(close(`still holds the template line "${line}"`));
  }

  return findings.map((finding, order) => ({ ...finding, order })).sort((a, b) => a.stage - b.stage || a.order - b.order)
    .map(({ order, ...finding }) => finding);
}

// The onboarding of a project: the skeletons of its three documents and the static check of what a session wrote
// into them — see odd/tasks/onboarding.md, D5-D7. No fs here: every function takes the files' text (or `null` for a
// missing file), so the tests use inline fixture strings. The check never runs a command.
import crypto from 'node:crypto';
import { commandsIn, parseContract, tasksOf } from './contract.mjs';
import { cellsOf, parseRoadmap } from './progress.mjs';
import { PROFILES, advisedProfile, checklistLines, parseKind, setupValues } from './profiles.mjs';

export const ONBOARDING_PATH = 'odd/tasks/onboarding.md';
export const ORIGIN_PATH = 'docs/origin.md';
export const ROADMAP_PATH = 'docs/ROADMAP.md';
export const AGENTS_PATH = 'AGENTS.md';

/** The line the Close stage adds to `AGENTS.md`, outside the harness block, so every later session starts there. */
export const ROADMAP_LINE = "The plan is docs/ROADMAP.md: a session starts there, and each feature's state is in odd/tasks/.";

/** The eleven topics the conversation covers (D3): what it must have covered, not questions read out in order. */
export const TOPICS = [
  'What the project is, for whom, and its kind',
  'Its size: small, only what is needed, or large',
  'The developer\'s level in the kind\'s areas, by layer',
  'The outcome that makes it worth doing',
  'What exists today',
  'Decisions already made, the language of the artifacts among them',
  'Constraints and their reasons',
  'In and out of scope for the first usable version',
  'What the owner decides alone, and the steps only the owner can take',
  'Order: what comes first, and what can wait',
  'Risks and unknowns',
];
/** The topics a plan cannot be made without: never unknown, and checked only once the owner said or confirmed them
 * (D3, D15). */
const REQUIRED_TOPICS = [1, 2, 3, 4, 9];
/** REQUIRED_TOPICS as the output names them: "1, 2, 3, 4 and 9". */
const REQUIRED_LIST = `${REQUIRED_TOPICS.slice(0, -1).join(', ')} and ${REQUIRED_TOPICS.at(-1)}`;
/** The fixed last item of `## Interview`, checked once the summary is given and its deepening questions answered. */
export const SUMMARY_LINE = '- [ ] S Summary given and deepening questions answered';

/** The stages a finding sends the work back to, by number (D2). */
export const STAGES = {
  1: 'Read',
  2: 'Conversation and advice',
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

## Setup
<!-- One line each: Kind and Size once the conversation shows them, deduced values included; Level with ## Advice, one level per area; Teaching "on (L<n>)" or "off (L<n>)" once the opening is logged; Mode full, or fast (L<n>). A change here is committed at once. -->
- Teaching: on
- Mode: full

## Interview
<!-- A topic is checked "— answered (L<n>)" (the owner said it), "— deduced (L<n>)" (read from the conversation; that Log line names the words), "— confirmed (L<n>)" (a deduction the owner confirmed) or "— unknown (OD<n>)". Topics ${REQUIRED_LIST} are checked only once answered or confirmed. S is checked with the Log line of the last deepening answer. -->
${TOPICS.map((title, i) => `- [ ] ${i + 1} ${title}`).join('\n')}
${SUMMARY_LINE}

## Advice
<!-- Once Kind and Size are set, paste what js-harness onboard profile --checklist advice prints. An area is checked with its proposal: "— proposed, ADR-<nnnn> (L<n>)", "— asked, ADR-<nnnn> (L<n>)", "— the owner's, ADR-<nnnn> (L<n>)" or "— open (OD<n>)". -->

## Tasks
<!-- O2 records the answers' hash; O3 and O5, the files' hashes and the Log line of the owner's yes: "(origin sha256:<12 hex>; L<n>)", as \`js-harness onboard hash\` prints them. -->
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

/** What the `answers` hash is taken over (D6): `## Interview`, `## Advice`, and the Kind and Size lines of `## Setup`.
 * Teaching, Mode and Level are left out, so turning teaching off reopens nothing (D2). */
function answersText(onboarding) {
  const sections = parseContract(onboarding);
  const setup = setupValues(onboarding);
  return ['## Interview', sections.get('Interview') ?? '', '## Advice', sections.get('Advice') ?? '', `Kind: ${setup.Kind ?? ''}`, `Size: ${setup.Size ?? ''}`].join('\n');
}

/** The hashes an approval records (D2): of the answers, of the pre-plan and of the roadmap; `null` for what is
 * missing. */
export function hashes({ onboarding, origin, roadmap }) {
  return {
    answers: onboarding === null ? null : shortHash(answersText(onboarding)),
    origin: origin === null ? null : shortHash(origin),
    roadmap: roadmap === null ? null : shortHash(roadmap),
  };
}

// A template line still to fill: a `<...>` placeholder that is no HTML comment.
const PLACEHOLDER = /<[^<>!][^<>]*>/;
// An interview topic: its box, its number, the rest of the line.
const TOPIC_LINE = /^\s*[-*+]\s+\[([ xX])\]\s+(\d+)\b(.*)$/;
// How a topic is settled (D15): said, deduced or confirmed, with the Log line; or unknown, with its open decision.
const TOPIC_SAID = /\b(answered|deduced|confirmed) \(L\d+\b/;
const UNKNOWN = /\bunknown \(OD\d+\)/i;
const SUMMARY_ITEM = /^\s*[-*+]\s+\[([ xX])\]\s+S\b(.*)$/;
// An advice area (D6): its box, its ID, its title, and once settled, its suffix after " — ".
const AREA_LINE = /^\s*[-*+]\s+\[([ xX])\]\s+(A:[a-z0-9-]+)\s+(.+?)(?:\s+—\s+(.+?))?\s*$/;
const AREA_SETTLED = /^(?:(?:proposed|asked|the owner's|default, fast), ADR-\d{4} \(L\d+\)|open \(OD\d+\))$/;
const LEVEL_ENTRY = /^(A:[a-z0-9-]+) (?:new|some|experienced)$/;
const RECORDED_HASH = /\b(answers|origin|roadmap) sha256:([0-9a-f]{12})\b/g;
const LOG_REFERENCE = /\bL\d+\b/g;
// A Log entry: its ID at the start of a list item.
const LOG_ITEM = /^\s*[-*+]\s+(L\d+)\b/;
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

/** The interview's topics by number, the first line of each: `Map(n -> { done, rest })`. */
function interviewTopics(onboarding) {
  const topics = new Map();
  for (const line of (parseContract(onboarding).get('Interview') ?? '').split('\n')) {
    const topic = line.match(TOPIC_LINE);
    if (topic && !topics.has(Number(topic[2]))) topics.set(Number(topic[2]), { done: topic[1] !== ' ', rest: topic[3] });
  }
  return topics;
}

/** How a topic's line says it was settled: `answered`, `deduced`, `confirmed`, `unknown`, or `null`. */
function topicState(rest) {
  const said = rest.match(TOPIC_SAID);
  if (said) return said[1];
  return UNKNOWN.test(rest) ? 'unknown' : null;
}

/** The areas under `## Advice` by ID, in order: `Map(id -> { done, suffix })`. */
function adviceAreas(onboarding) {
  const areas = new Map();
  for (const line of (parseContract(onboarding).get('Advice') ?? '').split('\n')) {
    const area = line.match(AREA_LINE);
    if (area && !areas.has(area[2])) areas.set(area[2], { done: area[1] !== ' ', suffix: area[4] ?? null });
  }
  return areas;
}

/** The area IDs a Level value names, or `null` when it is not in its format. */
function levelAreas(value) {
  const body = /^(.+) \(L\d+\)$/.exec(value);
  const entries = body ? body[1].split(',').map((entry) => LEVEL_ENTRY.exec(entry.trim())) : [null];
  return entries.every(Boolean) ? entries.map((entry) => entry[1]) : null;
}

/** Where the conversation stands (stage 2, D3 and D15), read from `## Setup`, `## Interview` and `## Advice`.
 * `findings` is every stage-2 finding in the document's order; `wrong` the messages of those that are written wrong,
 * rather than not covered yet; `step` what the session does next. `compare`: whether Kind and the areas are still
 * held to the profiles, which they are until O6 closes the onboarding. */
function conversation(onboarding, { profiles, compare }) {
  const findings = [];
  const wrong = [];
  const notYet = (message) => findings.push(message);
  const wrongly = (message) => {
    findings.push(message);
    wrong.push(message);
  };

  const setup = setupValues(onboarding);
  let kinds = null;
  if (setup.Kind === undefined) notYet('## Setup has no Kind line yet');
  else if (compare) {
    const kind = parseKind(setup.Kind, profiles);
    if (kind.error) wrongly(`Kind: ${kind.error}`);
    else kinds = kind.kinds;
  }
  const size = setup.Size === undefined ? null : /^(small|large) \(L\d+\)$/.exec(setup.Size)?.[1] ?? null;
  if (setup.Size === undefined) notYet('## Setup has no Size line yet');
  else if (size === null) wrongly(`Size is "${setup.Size}": write small (L<n>) or large (L<n>)`);
  const levels = setup.Level === undefined ? null : levelAreas(setup.Level);
  if (setup.Level === undefined) notYet('## Setup has no Level line yet');
  else if (levels === null) wrongly(`Level is "${setup.Level}": write A:<id> new|some|experienced, one per area of ## Advice, then (L<n>)`);
  const opened = setup.Teaching !== undefined && setup.Teaching !== 'on';
  if (!opened) notYet('Teaching is not set: log the opening as a (session) Log line, then write - Teaching: on (L<n>)');
  else if (!/^(on|off) \(L\d+\)$/.test(setup.Teaching)) wrongly(`Teaching is "${setup.Teaching}": write on (L<n>) or off (L<n>)`);
  if (setup.Mode === undefined) wrongly('## Setup has no Mode line: write - Mode: full');
  else if (!/^(full|fast \(L\d+\))$/.test(setup.Mode)) wrongly(`Mode is "${setup.Mode}": write full, or fast (L<n>)`);
  const fast = /^fast \(L\d+\)$/.test(setup.Mode ?? '');

  const topics = interviewTopics(onboarding);
  const open = { topics: [], areas: [] };
  const waiting = [];
  let coveredTopics = 0;
  for (let n = 1; n <= TOPICS.length; n += 1) {
    if (!topics.has(n)) wrongly(`the interview has no topic ${n}`);
  }
  for (const [n, topic] of [...topics].filter(([n]) => n >= 1 && n <= TOPICS.length).sort(([a], [b]) => a - b)) {
    const state = topicState(topic.rest);
    const required = REQUIRED_TOPICS.includes(n);
    if (!topic.done && required && state === 'deduced') {
      waiting.push(n);
      notYet(`topic ${n} is deduced and waits for the owner's confirmation`);
    } else if (!topic.done) {
      open.topics.push(n);
      notYet(`topic ${n} is not covered yet`);
    } else if (state === null) wrongly(`topic ${n} is checked with no "— answered (L<n>)", "— deduced (L<n>)", "— confirmed (L<n>)" or "— unknown (OD<n>)"`);
    else if (required && state === 'unknown') wrongly(`topic ${n} is marked unknown: topics ${REQUIRED_LIST} need an answer`);
    else if (required && state === 'deduced') wrongly(`topic ${n} is checked as deduced: topics ${REQUIRED_LIST} are checked once the owner says or confirms them`);
    else coveredTopics += 1;
  }
  const summary = (parseContract(onboarding).get('Interview') ?? '').split('\n').map((line) => line.match(SUMMARY_ITEM)).find(Boolean);
  const summed = Boolean(summary) && summary[1] !== ' ';
  if (!summary) wrongly(`the interview has no summary line "${SUMMARY_LINE}"`);
  else if (!summed) notYet('the summary is not given yet: S is checked once its deepening questions are answered');
  else if (!/\bL\d+\b/.test(summary[2])) wrongly('S names no Log line (L<n>) of the last answer');

  const areas = adviceAreas(onboarding);
  const expected = kinds && size ? checklistLines(advisedProfile(kinds, profiles), 'advice', size).map((line) => line.match(AREA_LINE)?.[2]).filter(Boolean) : null;
  let pasted = areas.size > 0;
  if (!pasted && expected?.length > 0) notYet('## Advice is empty: paste what js-harness onboard profile --checklist advice prints');
  else if (expected) {
    for (const id of expected.filter((id) => !areas.has(id))) wrongly(`## Advice lacks ${id}, which js-harness onboard profile --checklist advice prints for this Kind and Size`);
    for (const id of [...areas.keys()].filter((id) => !expected.includes(id))) wrongly(`## Advice lists ${id}, which js-harness onboard profile --checklist advice does not print for this Kind and Size`);
    pasted = expected.length === areas.size && expected.every((id) => areas.has(id));
  }
  let coveredAreas = 0;
  for (const [id, area] of areas) {
    if (!area.done) {
      open.areas.push(id);
      notYet(`${id} is not settled yet`);
    } else if (!AREA_SETTLED.test(area.suffix ?? '')) wrongly(`${id} is checked with "${area.suffix ?? ''}": write proposed, asked or the owner's, ADR-<nnnn> (L<n>), open (OD<n>), or with Mode fast, default, fast, ADR-<nnnn> (L<n>)`);
    else if (area.suffix.startsWith('default, fast') && !fast) wrongly(`${id} is settled default, fast, but Mode is not fast`);
    else coveredAreas += 1;
  }
  if (levels && areas.size > 0) {
    for (const id of [...areas.keys()].filter((id) => !levels.includes(id))) wrongly(`Level has no level for ${id}`);
    for (const id of levels.filter((id) => !areas.has(id))) wrongly(`Level names ${id}, which is not under ## Advice`);
  }

  const kindKnown = setup.Kind !== undefined && (kinds !== null || !compare);
  // The advice step also asks for Level, which is completed with the paste: a Level never written goes back there.
  const step = !opened ? 'opening'
    : !kindKnown || size === null ? 'kind'
      : !pasted || setup.Level === undefined ? 'advice'
        : open.topics.length > 0 || open.areas.length > 0 ? 'converse'
          : waiting.length > 0 || !summed ? 'summary'
            : 'fix';
  return {
    findings: findings.map((message) => ({ file: ONBOARDING_PATH, stage: 2, message })),
    wrong,
    step,
    covered: { topics: coveredTopics, areas: coveredAreas, total: expected ? expected.length : areas.size || null },
    open,
    waiting,
  };
}

/** Where each recorded hash is taken from, as a finding names it. */
const HASHED = { answers: 'the conversation (## Interview, ## Advice, Kind and Size)', origin: ORIGIN_PATH, roadmap: ROADMAP_PATH };

/** The hashes a task's item records, by name: `Map(name -> 12 hex)`. */
function recordedHashes(task) {
  return new Map([...task.text.matchAll(RECORDED_HASH)].map((m) => [m[1], m[2]]));
}

/** The names among `files` whose hash `task` records and that hash differently now. */
function changedSince(task, files, current) {
  const recorded = recordedHashes(task);
  return files.filter((name) => recorded.has(name) && current[name] !== null && recorded.get(name) !== current[name]);
}

/** The tasks that record what they were made from, in the order of their stages (D2). */
const RECORDS = [
  { id: 'O2', stage: 3, unchecked: 'the pre-plan is not written from the conversation yet', files: ['answers'], approval: false },
  { id: 'O3', stage: 4, unchecked: 'the pre-plan has no approval yet', files: ['origin'], approval: true },
  { id: 'O5', stage: 6, unchecked: 'the roadmap has no approval yet', files: ['roadmap', 'origin'], approval: true },
];

/** One recorded task's findings: checked, and each hash it must record matching the text as it is now; for an
 * approval (`logged`, the IDs under `## Log`), also the Log line of the owner's yes. `task.text` is the whole item. */
function recordFindings(task, { id, unchecked, stage, files, current, compare, logged = null }) {
  const at = (message) => ({ file: ONBOARDING_PATH, stage, message });
  if (!task?.done) return [at(`${id} is not checked: ${unchecked}`)];
  const findings = [];
  const recorded = recordedHashes(task);
  for (const name of files) {
    if (!recorded.has(name)) findings.push(at(`${id} records no ${name} sha256: js-harness onboard hash prints it`));
    else if (compare && current[name] !== null && recorded.get(name) !== current[name]) {
      findings.push(at(`${id} records ${name} sha256:${recorded.get(name)}, but ${HASHED[name]} is sha256:${current[name]}: it changed since its approval`));
    }
  }
  if (logged !== null) {
    const references = [...task.text.matchAll(LOG_REFERENCE)].map((m) => m[0]);
    if (references.length === 0) findings.push(at(`${id} names no Log line (L<n>) with the owner's yes`));
    for (const reference of references.filter((ref) => !logged.has(ref))) {
      findings.push(at(`${id} names ${reference}, which is not under ## Log`));
    }
  }
  return findings;
}

/** The onboarding's tasks by ID, each with `text`, its whole item, continuation lines included. */
export function onboardingTasks(onboarding) {
  const lines = onboarding.replace(/\r\n/g, '\n').split('\n');
  return new Map(tasksOf(onboarding).map((task) => [task.id, { ...task, text: lines.slice(task.start - 1, task.end).join('\n') }]));
}

/** The IDs of the entries under `## Log`. */
function logIds(onboarding) {
  const ids = new Set();
  for (const line of (parseContract(onboarding).get('Log') ?? '').split('\n')) {
    const item = line.match(LOG_ITEM);
    if (item) ids.add(item[1]);
  }
  return ids;
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
export function checkOnboarding({ onboarding, origin, roadmap, agents }, { agentsTemplate = '', plan = false, profiles = PROFILES } = {}) {
  const findings = [];
  const missing = (file, stage, template) => ({ file, stage, message: `missing: js-harness onboard template ${template} --write starts it` });
  if (plan) {
    if (roadmap === null) return [missing(ROADMAP_PATH, 5, 'roadmap')];
    return roadmapFindings(roadmap, origin);
  }

  if (onboarding === null) findings.push(missing(ONBOARDING_PATH, 1, 'feature'));
  else {
    const tasks = onboardingTasks(onboarding);
    const compare = !tasks.get('O6')?.done;
    findings.push(...conversation(onboarding, { profiles, compare }).findings);
    const current = hashes({ onboarding, origin, roadmap });
    const logged = logIds(onboarding);
    for (const record of RECORDS) {
      findings.push(...recordFindings(tasks.get(record.id), { ...record, current, compare, logged: record.approval ? logged : null }));
    }
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

/** A finding as `check` and the Close stage print it. */
export function findingLine({ file, stage, message }) {
  return `FAIL  ${file}: ${message} (back to stage ${stage}, ${STAGES[stage]})`;
}

/** The stage the onboarding is in, read from its files alone (D2): the first whose record is missing or no longer
 * holds. `{ stage: 1 }`, `{ stage: 2, step, covered, open, waiting, wrong }` (see conversation), `{ stage: 3 | 4 | 6,
 * changed }` (changed: its record names a hash that moved), `{ stage: 5 }`, `{ stage: 7, findings }`, or
 * `{ stage: 'done' }` once the check passes and O6 is checked. */
export function currentStage(files, { agentsTemplate = '', profiles = PROFILES } = {}) {
  const { onboarding } = files;
  if (onboarding === null) return { stage: 1 };
  const tasks = onboardingTasks(onboarding);
  if (!tasks.get('O1')?.done) return { stage: 1 };
  const compare = !tasks.get('O6')?.done;
  const talk = conversation(onboarding, { profiles, compare });
  if (talk.findings.length > 0) {
    const { step, covered, open, waiting, wrong } = talk;
    return { stage: 2, step, covered, open, waiting, wrong };
  }
  const current = hashes(files);
  for (const { id, stage, files: names } of RECORDS) {
    // O4 records no hash, only that the roadmap is written; a checked task whose file is gone is not done.
    if (id === 'O5' && (!tasks.get('O4')?.done || files.roadmap === null)) return { stage: 5 };
    const task = tasks.get(id);
    if (id === 'O2' && files.origin === null) return { stage, changed: false };
    const changed = Boolean(task?.done) && compare && changedSince(task, names, current).length > 0;
    if (!task?.done || changed) return { stage, changed };
  }
  const findings = checkOnboarding(files, { agentsTemplate, profiles });
  if (findings.length > 0 || compare) return { stage: 7, findings };
  return { stage: 'done' };
}

const THEN = 'Then: commit, and run js-harness onboard again.';

/** What the session does next in the conversation, by the step `conversation` names (D3, D15). */
const CONVERSATION_STEPS = {
  opening: 'open the conversation: say who you are in this project (the plan orchestrator, who advises every area and then hands over to the build orchestrator), what it will produce (the pre-plan, its decisions and the roadmap), that teaching is on, that saying "no teaching" turns it off and "easy and fast" asks for the fast plan, in the owner\'s language; then invite the owner to tell the project in their own words: what it is, for whom, why now. Log that as a (session) Log line, write - Teaching: on (L<n>), and commit at once.',
  kind: 'follow the owner\'s thread; from it, write - Kind: (the kinds js-harness onboard profile lists) and - Size: small (L<n>) or large (L<n>) under ## Setup, deduced values included, each deduction logged as a (session) Log line with the words it came from, and commit at once.',
  advice: 'run js-harness onboard profile --checklist advice and paste what it prints under ## Advice, in place of what is there; in the same commit, complete - Level: with every area\'s level, the level of its layer, and some for an area of no layer unless the owner said otherwise.',
  converse: `guide the conversation toward what is still open: open questions in plain chat, explaining why each matters for the plan, and every so often a line on what you understood and what comes next. Log what settles each item and check it: a topic "— answered (L<n>)", "— deduced (L<n>)" or "— unknown (OD<n>)", an area with its proposal and ADR. Explain an area with js-harness onboard profile --area <id> once topic 7 is covered. Topics ${REQUIRED_LIST} are checked only once the owner says or confirms them.`,
  summary: 'log the summary as a (session) Log line and give it: what you understood, what you deduced and from what, and your recommendation for each area in a line. Then ask only the deepening questions still worth asking, one at a time through the question tool (on Codex, in plain text with numbered options), the recommended option first, each logged as a (session) Log line before it is asked. Log each answer verbatim and check or correct what it covers, a confirmed deduction "— confirmed (L<n>)". Check S with the Log line of the last answer.',
  fix: 'fix each line above.',
};

/** `topic 4` or `topics 4, 8`. */
const named = (word, items) => `${word}${items.length === 1 ? '' : 's'} ${items.join(', ')}`;

/** What the session does at `at`, the result of currentStage, as lines of the command's output. */
function stageLines(at, files, git) {
  const current = hashes(files);
  const tasks = files.onboarding === null ? new Map() : onboardingTasks(files.onboarding);
  const heading = (what) => `Stage ${at.stage} of 7, ${STAGES[at.stage]}: ${what}`;
  switch (at.stage) {
    case 1: {
      const fresh = files.onboarding === null;
      return [
        heading(fresh ? 'no onboarding document yet.' : 'O1 is not checked yet.'),
        ...(fresh && git.branch !== 'onboarding' ? ['First: git switch -c onboarding, the branch the onboarding is committed on, so a session in another worktree finds it.'] : []),
        `Do: ${fresh ? 'js-harness onboard template feature --write; then ' : ''}read the repository (README, manifests, git log, docs, codegraph where there is code). Write the owner's request verbatim in L1, and what exists under ## What exists, each with its evidence. Check O1.`,
        THEN,
      ];
    }
    case 2: {
      const { covered, open, waiting, wrong } = at;
      const areas = covered.total === null ? '; areas not listed yet' : `, ${covered.areas} of ${covered.total} areas`;
      const opened = [open.topics.length > 0 ? named('topic', open.topics) : null, open.areas.length > 0 ? named('area', open.areas) : null].filter(Boolean);
      return [
        heading(`covered: ${covered.topics} of ${TOPICS.length} topics${areas}.`),
        ...wrong.map((message) => findingLine({ file: ONBOARDING_PATH, stage: 2, message })),
        ...(opened.length > 0 ? [`Open: ${opened.join('; ')}.`] : []),
        ...(waiting.length > 0 ? [`Deduced, waiting for the owner's confirmation: ${named('topic', waiting)}.`] : []),
        `Do: ${CONVERSATION_STEPS[at.step]}`,
        'Then: commit every three settled items, and at the summary, and run js-harness onboard again.',
      ];
    }
    case 3:
      return [
        heading(at.changed ? 'the conversation changed since O2 recorded it.' : 'the conversation is complete.'),
        `Do: ${files.origin === null ? `js-harness onboard template origin --write, then fill ${ORIGIN_PATH}` : `revise ${ORIGIN_PATH}`} from the conversation: every section, the owner's words with their dates, each unknown topic as an open decision.`,
        `Record: check O2 with "(answers sha256:${current.answers})", the hash js-harness onboard hash prints.`,
        THEN,
      ];
    case 4:
      return [
        heading(at.changed ? `${ORIGIN_PATH} changed since its approval.` : `${ORIGIN_PATH} waits for the owner's approval.`),
        `Do: two readers read ${ORIGIN_PATH} against the interview; record their round under ## Reviews as "Pre-plan round <n>: ..." and take what they find. Then ask the owner one question: is the pre-plan approved?`,
        `Record: a yes is logged verbatim, and O3 checked with "(origin sha256:${current.origin}; L<n>)". A no is logged verbatim, the file revised, a new round reads only the blockers, and the owner is asked again.`,
        THEN,
      ];
    case 5:
      return [
        heading('the pre-plan is approved.'),
        `Do: ${files.roadmap === null ? `js-harness onboard template roadmap --write, then fill ${ROADMAP_PATH}` : `fill ${ROADMAP_PATH}`} from the approved pre-plan: every pre-plan phase with its steps under ## Checklist, a done-when command per phase, ## Next, and every open decision. Run js-harness onboard check --plan until it exits 0, then check O4.`,
        THEN,
      ];
    case 6: {
      const moved = at.changed ? changedSince(tasks.get('O5'), ['roadmap', 'origin'], current) : [];
      const what = moved.includes('roadmap') ? `${ROADMAP_PATH} changed since its approval.`
        : moved.includes('origin') ? `${ORIGIN_PATH} changed since the roadmap's approval: revise the roadmap from it first.`
          : `${ROADMAP_PATH} waits for the owner's approval.`;
      return [
        heading(what),
        `Do: two readers read ${ROADMAP_PATH} against the approved pre-plan; record their round under ## Reviews as "Roadmap round <n>: ..." and take what they find. Then ask the owner one question: is the roadmap approved?`,
        `Record: a yes is logged verbatim, and O5 checked with "(roadmap sha256:${current.roadmap}, origin sha256:${current.origin}; L<n>)". A no is logged verbatim, the file revised, a new round reads only the blockers, and the owner is asked again.`,
        THEN,
      ];
    }
    default: {
      const count = at.findings.length;
      return [
        heading(count > 0 ? `${count} finding${count === 1 ? '' : 's'} left.` : 'js-harness onboard check passes; O6 is not checked yet.'),
        ...at.findings.map(findingLine),
        `Do: fill ${AGENTS_PATH} outside its js-harness block: "What this project is" from topic 1, and "Constraints" from topics 6, 7 and 9, the checking command under "How it works", and the line "${ROADMAP_LINE}". Fix each finding at the stage it names.`,
        'Then: once js-harness onboard check exits 0, check O6 and commit.',
      ];
    }
  }
}

/** Where an onboarding on another branch is, and how to resume it (D7). */
function elsewhereLine({ branch, worktree, remote = false, local = null }, git) {
  if (branch === git.defaultBranch || (remote && branch.endsWith(`/${git.defaultBranch}`))) {
    return `The onboarding is on ${branch}: merge ${branch} into this branch, or switch to it.`;
  }
  if (worktree) return `Onboarding in progress on branch ${branch}, checked out in ${worktree}: open a session there and run js-harness onboard.`;
  if (local) return `Onboarding in progress on branch ${branch}: git switch ${local}, then git merge ${branch}, resumes it here.`;
  return `Onboarding in progress on branch ${branch}: git switch ${remote ? '--track ' : ''}${branch} resumes it here.`;
}

/** What bare `onboard` prints, and its exit code: `{ code, lines }`. `git` says where the session is: `branch` (or
 * `null` when detached), `defaultBranch`, `defaultHasRoadmap`, `elsewhere` (other branches holding an onboarding
 * document: `{ branch, worktree, remote, local }`, `local` naming a local branch of a remote's name that lacks it) and `uncommitted` (the onboarding's files git has not committed). */
export function stageReport(files, { agentsTemplate = '', profiles = PROFILES, git }) {
  if (files.onboarding === null) {
    if (git.elsewhere.length > 0) return { code: 0, lines: git.elsewhere.map((place) => elsewhereLine(place, git)) };
    const own = [[ORIGIN_PATH, files.origin], [ROADMAP_PATH, files.roadmap]].filter(([, text]) => text !== null).map(([file]) => file);
    if (own.length > 0) {
      return {
        code: 1,
        lines: [
          `This project has a plan of its own: ${own.join(', ')}.`,
          'Onboarding a plan of another shape is not supported yet: move it aside to onboard this project, or keep it as the plan.',
        ],
      };
    }
  }
  const at = currentStage(files, { agentsTemplate, profiles });
  let lines;
  if (at.stage !== 'done') lines = stageLines(at, files, git);
  else if (git.branch !== git.defaultBranch && !git.defaultHasRoadmap) {
    const branch = git.branch ?? 'HEAD';
    lines = [
      `Awaiting merge: the onboarding is complete on branch ${branch}, and ${git.defaultBranch} has no ${ROADMAP_PATH} yet.`,
      `Merging it is the owner's decision, under this repository's policy. To propose it: git push -u origin ${branch}, then gh pr create --base ${git.defaultBranch} --head ${branch}.`,
    ];
  } else {
    const next = (parseContract(files.roadmap).get('Next') ?? '').split('\n').map((line) => line.trim()).filter(Boolean).join(' ');
    lines = [`Onboarded: ${ROADMAP_PATH} is the plan.`, `Next: ${next}`];
  }
  if (git.uncommitted.length > 0) {
    lines.push(`Not committed: ${git.uncommitted.join(', ')}. Commit them on this branch, so the next session finds them.`);
  }
  return { code: 0, lines };
}

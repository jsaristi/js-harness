import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENTS_PATH, ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_LINE, ROADMAP_PATH, TOPICS,
  checkOnboarding, featureTemplate, hashes, originTemplate, roadmapTemplate, shortHash,
} from './onboard.mjs';
import { validateContract } from './contract.mjs';
import { parseRoadmap } from './progress.mjs';

/** A base `AGENTS.md` as `init` writes one: placeholders around a block (bin/lib/project.mjs, agentsTemplate). */
const AGENTS_TEMPLATE = [
  '<!-- Written by `js-harness init`. This file loads on every turn: keep it short. -->',
  '# shop',
  '',
  '## What this project is',
  '<what this project does, and who it is for, in one or two lines>',
  '',
  '## Constraints',
  '- <a real constraint> — <the reason behind it>',
  '',
].join('\n');

const ORIGIN = [
  '# shop: origin',
  '',
  '## Status',
  'Frozen once the onboarding closes.',
  '',
  '## Goal',
  'A shop that sells bread online.',
  '',
  '## Why',
  '"Quiero vender pan en línea" (2026-10-19).',
  '',
  '## What exists',
  'Nothing yet: an empty repository.',
  '',
  '## Decisions already made',
  '| Area | Decision | The owner\'s words |',
  '|------|----------|-------------------|',
  '| Stack | Node | "Node" (2026-10-19) |',
  '',
  '## Principles',
  '1. Small first — the owner wants to sell this month.',
  '',
  '## Phases',
  '| Phase | Goal | Done when |',
  '|-------|------|-----------|',
  '| P1 Catalog | Bread on a page | `npm test` exits 0 |',
  '| P2 Orders | Orders by mail | `npm run e2e` exits 0 |',
  '',
  '## Not built',
  'Review and memory: the stack does them.',
  '',
  '## Risks',
  '- Payments — a provider is not chosen.',
  '',
  '## Open decisions',
  '- OD1 Which payment provider.',
  '- OD2 Delivery area (decided: the city, 2026-10-19).',
  '',
  '## Sources',
  '- 2026-10-19 the owner\'s answers (`odd/tasks/onboarding.md`, L2-L10).',
  '',
].join('\n');

const ROADMAP = [
  '# Roadmap',
  '',
  '## Principles',
  '1. Small first.',
  '',
  '## Decided',
  '| Area | Decision |',
  '|------|----------|',
  '| Stack | Node |',
  '',
  '## Phases',
  '| Phase | Goal | Done when | State |',
  '|-------|------|-----------|-------|',
  '| P1 Catalog | Bread on a page | `npm test` exits 0; the page lists the bread | Not started |',
  '| P2 Orders | Orders by mail | `npm run e2e` exits 0 | Not started |',
  '',
  '## Checklist',
  '',
  '### P1 Catalog',
  '- [ ] The catalog page lists every bread',
  '',
  '### P2 Orders',
  '- [ ] An order reaches the owner by mail',
  '',
  '## Next',
  'P1 Catalog, its first step.',
  '',
  '## Open decisions',
  '- OD1 Which payment provider.',
  '',
  '## Risks',
  '- Payments.',
  '',
].join('\n');

const AGENTS = [
  '# shop',
  '',
  '## What this project is',
  'A shop that sells bread online, for the owner\'s customers in the city.',
  '',
  ROADMAP_LINE,
  '',
].join('\n');

/** An onboarding document at the end of the interview, approvals recorded against `origin` and `roadmap`. */
function onboardingDoc({ origin = ORIGIN, roadmap = ROADMAP, topics = null, o3 = null, o5 = null, o6 = ' ', reviews = null } = {}) {
  const topicLines = topics ?? TOPICS.map((title, i) => `- [x] ${i + 1} ${title} — answered (L${i + 2})`);
  return [
    '# Onboarding',
    '',
    '## Goal',
    'An approved pre-plan and roadmap.',
    '',
    '## Done when',
    '- `js-harness onboard check` exits 0',
    '',
    '## Interview',
    ...topicLines,
    '',
    '## Tasks',
    '- [x] O1 Repository read',
    '- [x] O2 Pre-plan written',
    o3 ?? `- [x] O3 Pre-plan approved (origin sha256:${shortHash(origin)}; L12)`,
    '- [x] O4 Roadmap written',
    o5 ?? `- [x] O5 Roadmap approved (roadmap sha256:${shortHash(roadmap)}, origin sha256:${shortHash(origin)}; L14)`,
    `- [${o6}] O6 Closed`,
    '',
    '## Reviews',
    ...(reviews ?? ['- Pre-plan round 1: two readers, three findings taken.', '- Roadmap round 1: two readers, one finding taken.']),
    '',
    '## Log',
    '- L1 2026-10-19 The owner\'s request, verbatim: "Quiero vender pan en línea".',
    '',
  ].join('\n');
}

function files(over = {}) {
  return { onboarding: onboardingDoc(), origin: ORIGIN, roadmap: ROADMAP, agents: AGENTS, ...over };
}

const check = (over = {}, options = {}) => checkOnboarding(files(over), { agentsTemplate: AGENTS_TEMPLATE, ...options });
const messages = (findings) => findings.map((f) => `${f.file} (stage ${f.stage}): ${f.message}`);

test('a complete onboarding has no finding', () => {
  assert.deepEqual(check(), []);
});

test('the paths are the ones the design names', () => {
  assert.deepEqual([ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_PATH, AGENTS_PATH], ['odd/tasks/onboarding.md', 'docs/origin.md', 'docs/ROADMAP.md', 'AGENTS.md']);
  assert.equal(TOPICS.length, 9);
});

test('a missing file is one finding that names the stage that writes it', () => {
  assert.deepEqual(messages(check({ onboarding: null })), [
    'odd/tasks/onboarding.md (stage 1): missing: js-harness onboard template feature --write starts it',
  ]);
  assert.deepEqual(messages(check({ origin: null, onboarding: onboardingDoc({ o3: '- [ ] O3 Pre-plan approved' }) })).slice(0, 1), [
    'docs/origin.md (stage 3): missing: js-harness onboard template origin --write starts it',
  ]);
});

test('the interview: nine topics, each checked, and topics 1, 2 and 7 answered, not unknown', () => {
  const topics = TOPICS.map((title, i) => `- [x] ${i + 1} ${title} — answered`);
  topics[1] = `- [x] 2 ${TOPICS[1]} — unknown (OD3)`;
  topics[4] = `- [ ] 5 ${TOPICS[4]}`;
  topics.pop();
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ topics }) })), [
    'odd/tasks/onboarding.md (stage 2): the interview has no topic 9',
    'odd/tasks/onboarding.md (stage 2): topic 5 is not answered yet',
    'odd/tasks/onboarding.md (stage 2): topic 2 is marked unknown: topics 1, 2 and 7 need an answer',
  ]);
});

test('an approval must be checked, name its Log line, and hold the hash of the file as it is now', () => {
  const changed = ORIGIN.replace('bread online', 'bread and cakes online');
  assert.deepEqual(messages(check({ origin: changed })), [
    `odd/tasks/onboarding.md (stage 4): O3 records origin sha256:${shortHash(ORIGIN)}, but docs/origin.md is sha256:${shortHash(changed)}: it changed since its approval`,
    `odd/tasks/onboarding.md (stage 6): O5 records origin sha256:${shortHash(ORIGIN)}, but docs/origin.md is sha256:${shortHash(changed)}: it changed since its approval`,
  ]);
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o3: '- [ ] O3 Pre-plan approved' }) })), [
    'odd/tasks/onboarding.md (stage 4): O3 is not checked: the pre-plan has no approval yet',
  ]);
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o5: `- [x] O5 Roadmap approved (roadmap sha256:${shortHash(ROADMAP)}, origin sha256:${shortHash(ORIGIN)})` }) })), [
    'odd/tasks/onboarding.md (stage 6): O5 names no Log line (L<n>) with the owner\'s yes',
  ]);
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o3: '- [x] O3 Pre-plan approved (L12)' }) })), [
    'odd/tasks/onboarding.md (stage 4): O3 records no origin sha256: js-harness onboard hash prints it',
  ]);
});

test('once the onboarding is closed (O6), the plan lives on and its hashes are no longer compared', () => {
  const grown = ROADMAP.replace('- [ ] An order reaches the owner by mail', '- [x] An order reaches the owner by mail');
  assert.deepEqual(check({ roadmap: grown, onboarding: onboardingDoc({ o6: 'x' }) }), []);
});

test('a CRLF checkout hashes as its LF one', () => {
  assert.equal(shortHash(ORIGIN.replace(/\n/g, '\r\n')), shortHash(ORIGIN));
  assert.match(shortHash(ORIGIN), /^[0-9a-f]{12}$/);
});

test('each review needs its round under ## Reviews', () => {
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ reviews: ['- Roadmap round 1: two readers.'] }) })), [
    'odd/tasks/onboarding.md (stage 4): ## Reviews has no "Pre-plan" round: two readers read the pre-plan before the owner',
  ]);
});

test('the pre-plan needs its sections, and no template line left', () => {
  const origin = ORIGIN.replace('## Not built\nReview and memory: the stack does them.\n\n', '').replace('## Risks\n', '## Risks\n- <a risk> — <what it would cost>\n');
  const onboarding = onboardingDoc({ origin });
  assert.deepEqual(messages(check({ origin, onboarding })), [
    'docs/origin.md (stage 3): missing section "## Not built"',
    'docs/origin.md (stage 3): still holds the template line "- <a risk> — <what it would cost>"',
  ]);
});

test('the roadmap: Checklist and Phases name the same phases, each with a step and a done-when command', () => {
  const roadmap = ROADMAP
    .replace('| P2 Orders | Orders by mail | `npm run e2e` exits 0 | Not started |', '| P2 Orders | Orders by mail | the owner gets a mail | Not started |\n| P3 Pay | Card payments | `npm test` exits 0 | Not started |')
    .replace('### P1 Catalog\n- [ ] The catalog page lists every bread\n', '### P1 Catalog\n\n### P0 Setup\n- [ ] A repository\n');
  const onboarding = onboardingDoc({ roadmap });
  assert.deepEqual(messages(check({ roadmap, onboarding })), [
    'docs/ROADMAP.md (stage 5): phase "P1 Catalog" has no step',
    'docs/ROADMAP.md (stage 5): phase "P0 Setup" has no row in ## Phases',
    'docs/ROADMAP.md (stage 5): the ## Phases row "P3 Pay" has no phase under ## Checklist',
    'docs/ROADMAP.md (stage 5): the Done when of "P2 Orders" names no command: write `<command>` exits 0',
  ]);
});

test('the roadmap carries every pre-plan phase and every open decision, and says what is next', () => {
  const roadmap = ROADMAP
    .replace('| P2 Orders | Orders by mail | `npm run e2e` exits 0 | Not started |\n', '')
    .replace('### P2 Orders\n- [ ] An order reaches the owner by mail\n\n', '')
    .replace('## Next\nP1 Catalog, its first step.\n\n', '')
    .replace('- OD1 Which payment provider.\n', '- Nothing open.\n');
  const onboarding = onboardingDoc({ roadmap });
  assert.deepEqual(messages(check({ roadmap, onboarding })), [
    'docs/ROADMAP.md (stage 5): the pre-plan phase "P2 Orders" is not a roadmap phase',
    'docs/ROADMAP.md (stage 5): no ## Next: the first unchecked step and the text that starts its session',
    'docs/ROADMAP.md (stage 5): OD1 is open in docs/origin.md and not under ## Open decisions',
  ]);
});

test('AGENTS.md: the roadmap line, and none of init\'s placeholders', () => {
  const agents = `${AGENTS_TEMPLATE}\nThe plan is somewhere.\n`;
  assert.deepEqual(messages(check({ agents })), [
    `AGENTS.md (stage 7): has no line "${ROADMAP_LINE}"`,
    'AGENTS.md (stage 7): still holds the template line "<what this project does, and who it is for, in one or two lines>"',
    'AGENTS.md (stage 7): still holds the template line "- <a real constraint> — <the reason behind it>"',
  ]);
});

test('--plan checks only the roadmap and its ties to the pre-plan', () => {
  const roadmap = ROADMAP.replace('## Next\nP1 Catalog, its first step.\n\n', '');
  assert.deepEqual(messages(check({ roadmap, agents: AGENTS_TEMPLATE, onboarding: onboardingDoc({ o5: '- [ ] O5 Roadmap approved' }) }, { plan: true })), [
    'docs/ROADMAP.md (stage 5): no ## Next: the first unchecked step and the text that starts its session',
  ]);
});

test('hashes: each file\'s short sha256, and the interview\'s, or null where a file is missing', () => {
  const doc = onboardingDoc();
  const interview = doc.slice(doc.indexOf('## Interview'), doc.indexOf('## Tasks'));
  assert.deepEqual(hashes({ onboarding: doc, origin: ORIGIN, roadmap: null }), {
    interview: shortHash(interview.replace(/^## Interview\n/, '').trim()),
    origin: shortHash(ORIGIN),
    roadmap: null,
  });
});

test('the templates: the feature is a valid contract with nine topics, and the others start with what check asks for', () => {
  const feature = featureTemplate();
  assert.deepEqual(validateContract(feature), { ok: true, errors: [] });
  for (const [i, title] of TOPICS.entries()) assert.ok(feature.includes(`- [ ] ${i + 1} ${title}`), title);
  for (const id of ['O1', 'O2', 'O3', 'O4', 'O5', 'O6']) assert.match(feature, new RegExp(`- \\[ \\] ${id} `));
  const origin = originTemplate('shop');
  for (const section of ['Status', 'Goal', 'Why', 'What exists', 'Decisions already made', 'Principles', 'Phases', 'Not built', 'Risks', 'Open decisions', 'Sources']) {
    assert.ok(origin.includes(`\n## ${section}\n`), section);
  }
  const roadmap = roadmapTemplate();
  assert.equal(parseRoadmap(roadmap).phases.length, 1);
  for (const section of ['Phases', 'Checklist', 'Next', 'Open decisions', 'Risks']) assert.ok(roadmap.includes(`\n## ${section}\n`), section);
});

test('a template written as it is fails the check on its own template lines, never passes', () => {
  const findings = check({ origin: originTemplate('shop'), roadmap: roadmapTemplate() });
  assert.ok(findings.some((f) => f.file === ORIGIN_PATH && f.message.startsWith('still holds the template line')), messages(findings).join('\n'));
  assert.ok(findings.some((f) => f.file === ROADMAP_PATH && f.message.startsWith('still holds the template line')), messages(findings).join('\n'));
});

// The fixtures of an onboarding, shared by bin/lib/onboard.test.mjs and bin/onboard.test.mjs: a complete one, whose
// parts each test changes. Not a test file, so `node --test` does not run it.
import { ROADMAP_LINE, SUMMARY_LINE, TOPICS, hashes, shortHash } from './onboard.mjs';

/** Profiles of their own, so a change to bin/lib/profiles-data.mjs never breaks the lib's tests (D6): the kind shop
 * is advised in stack and hosting, and in the common area legal; small keeps only the core stack. */
export const PROFILES = {
  AREAS: [
    { id: 'stack', title: 'Stack', default: 'Node', alternatives: [], after: [] },
    { id: 'hosting', title: 'Hosting', default: 'a VPS', alternatives: [], after: ['stack'] },
    { id: 'legal', title: 'Legal', default: 'a privacy page', alternatives: [], common: true, after: [] },
  ],
  KINDS: [
    { id: 'shop', title: 'Shop', areas: [{ id: 'stack', core: true }, { id: 'hosting' }], bar: [{ id: 'ci-gate', core: true }, { id: 'uptime' }, { id: 'privacy' }] },
    { id: 'blog', title: 'Blog', areas: [{ id: 'stack', core: true }], bar: [{ id: 'ci-gate', core: true }] },
    { id: 'other', title: 'Other', areas: [], bar: [] },
  ],
  TARGETS: [
    { id: 'ci-gate', area: 'stack', target: 'every pull request passes npm test', measured: 'lab', command: 'CI' },
    { id: 'uptime', area: 'hosting', target: 'the shop answers 99.9% of the time', measured: 'field', command: 'an uptime monitor' },
    { id: 'privacy', area: 'legal', target: 'a privacy page is linked from every page', measured: 'lab', command: 'a link check' },
  ],
};

/** The ## Setup of a large shop, after its opening was logged. */
export const SETUP = ['- Kind: shop', '- Size: large (L3)', '- Level: A:stack experienced, A:hosting some, A:legal some (L4)', '- Teaching: on (L2)', '- Mode: full'];

/** Its ## Advice, every area settled. */
export const ADVICE = ['- [x] A:stack Stack — the owner\'s, ADR-0001 (L8)', '- [x] A:hosting Hosting — proposed, ADR-0002 (L13)', '- [x] A:legal Legal — open (OD1)'];

/** An ADR as `onboard template adr` asks for one, filled. */
export function adr(number, title, area, {
  status = 'proposed (L8); accepted with the pre-plan (O3)',
  sources = ['- https://nodejs.org/en/about/previous-releases — Node 24 is the active LTS (version 24, read 2026-10-19)'],
} = {}) {
  return [
    `# ADR-${number}: ${title}`, '', '## Status', status, '', '## Area', area, '',
    '## Context', 'The shop needs a server and a host.', '', '## Decision', 'Node, on a VPS.', '',
    '## Alternatives considered', '- Deno — fewer hosts run it.', '', '## Consequences', 'One runtime to keep; Deno is given up.', '',
    '## Sources', ...sources, '',
  ].join('\n');
}

/** The ADRs ADVICE names, by path. */
export const ADRS = new Map([
  ['docs/adr/0001-runtime.md', adr('0001', 'Runtime', 'A:stack')],
  ['docs/adr/0002-hosting.md', adr('0002', 'Hosting', 'A:hosting')],
]);

/** The eleven topics, each answered, and the summary given. */
export const answered = () => [...TOPICS.map((title, i) => `- [x] ${i + 1} ${title} — answered (L${i + 2})`), `${SUMMARY_LINE.replace('[ ]', '[x]')} (L15)`];

/** A base `AGENTS.md` as `init` writes one: placeholders around a block (bin/lib/project.mjs, agentsTemplate). */
export const AGENTS_TEMPLATE = [
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

export const ORIGIN = [
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
  '## Stack and architecture',
  '| Area | Decision | ADR |',
  '|------|----------|-----|',
  '| Stack | Node | ADR-0001 |',
  '| Hosting | a VPS | ADR-0002 |',
  '',
  'One Node server renders the pages and takes the orders; legal waits on OD1.',
  '',
  '## Owner steps',
  '- Rent the VPS (about 6 USD a month).',
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

export const ROADMAP = [
  '# Roadmap',
  '',
  '## Principles',
  '1. Small first.',
  '',
  '## Decided',
  '| Area | Decision | ADR |',
  '|------|----------|-----|',
  '| Stack | Node | ADR-0001 |',
  '| Hosting | a VPS | ADR-0002 |',
  '',
  '## Advice mode',
  'Teaching: on · Mode: full · Level: A:stack experienced, A:hosting some, A:legal some',
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
  '- [ ] B:ci-gate every pull request passes npm test; measured by CI',
  '- [ ] B:uptime an uptime monitor wired before launch, so production shows: the shop answers 99.9% of the time',
  '',
  '### P2 Orders',
  '- [ ] An order reaches the owner by mail',
  '',
  '## Next',
  'P1 Catalog, its first step.',
  '',
  '## Open decisions',
  '- OD1 Which payment provider, and the legal pages with it: B:privacy waits on it.',
  '',
  '## Risks',
  '- Payments.',
  '',
].join('\n');

export const AGENTS = [
  '# shop',
  '',
  '## What this project is',
  'A shop that sells bread online, for the owner\'s customers in the city.',
  '',
  ROADMAP_LINE,
  '',
].join('\n');

/** An onboarding document at the end of the conversation, approvals recorded against `origin` and `roadmap`. */
export function onboardingDoc({ origin = ORIGIN, roadmap = ROADMAP, adrs = ADRS, setup = SETUP, topics = null, advice = ADVICE, o1 = 'x', o2 = null, o3 = null, o4 = 'x', o5 = null, o6 = ' ', reviews = null } = {}) {
  if (o2 === null) {
    const answers = hashes({ onboarding: onboardingDoc({ origin, roadmap, adrs, setup, topics, advice, o2: '' }), origin: null, roadmap: null }).answers;
    o2 = `- [x] O2 Pre-plan written (answers sha256:${answers})`;
  }
  const adrsHash = hashes({ onboarding: null, origin: null, roadmap: null, adrs }).adrs;
  const topicLines = topics ?? answered();
  return [
    '# Onboarding',
    '',
    '## Goal',
    'An approved pre-plan and roadmap.',
    '',
    '## Done when',
    '- `js-harness onboard check` exits 0',
    '',
    '## Setup',
    ...setup,
    '',
    '## Interview',
    ...topicLines,
    '',
    '## Advice',
    ...advice,
    '',
    '## Tasks',
    `- [${o1}] O1 Repository read`,
    o2,
    o3 ?? `- [x] O3 Pre-plan approved (origin sha256:${shortHash(origin)}, adrs sha256:${adrsHash}; L12)`,
    `- [${o4}] O4 Roadmap written`,
    o5 ?? `- [x] O5 Roadmap approved (roadmap sha256:${hashes({ onboarding: null, origin: null, roadmap }).roadmap}, origin sha256:${shortHash(origin)}, adrs sha256:${adrsHash}; L14)`,
    `- [${o6}] O6 Closed`,
    '',
    '## Reviews',
    ...(reviews ?? ['- Pre-plan round 1: two readers, three findings taken.', '- Roadmap round 1: two readers, one finding taken.']),
    '',
    '## Log',
    '- L1 2026-10-19 The owner\'s request, verbatim: "Quiero vender pan en línea".',
    '- L12 2026-10-19 The owner on the pre-plan, verbatim: "sí".',
    '- L14 2026-10-19 The owner on the roadmap, verbatim: "sí".',
    '',
  ].join('\n');
}

export function files(over = {}) {
  return { onboarding: onboardingDoc(), origin: ORIGIN, roadmap: ROADMAP, agents: AGENTS, adrs: ADRS, ...over };
}

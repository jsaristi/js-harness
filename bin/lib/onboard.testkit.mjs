// The fixtures of an onboarding, shared by bin/lib/onboard.test.mjs and bin/onboard.test.mjs: a complete one, whose
// parts each test changes. Not a test file, so `node --test` does not run it.
import { ROADMAP_LINE, TOPICS, hashes, shortHash } from './onboard.mjs';

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

export const AGENTS = [
  '# shop',
  '',
  '## What this project is',
  'A shop that sells bread online, for the owner\'s customers in the city.',
  '',
  ROADMAP_LINE,
  '',
].join('\n');

/** An onboarding document at the end of the interview, approvals recorded against `origin` and `roadmap`. */
export function onboardingDoc({ origin = ORIGIN, roadmap = ROADMAP, topics = null, o1 = 'x', o2 = null, o3 = null, o4 = 'x', o5 = null, o6 = ' ', reviews = null } = {}) {
  if (o2 === null) {
    const interview = hashes({ onboarding: onboardingDoc({ origin, roadmap, topics, o2: '' }), origin: null, roadmap: null }).interview;
    o2 = `- [x] O2 Pre-plan written (interview sha256:${interview})`;
  }
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
    `- [${o1}] O1 Repository read`,
    o2,
    o3 ?? `- [x] O3 Pre-plan approved (origin sha256:${shortHash(origin)}; L12)`,
    `- [${o4}] O4 Roadmap written`,
    o5 ?? `- [x] O5 Roadmap approved (roadmap sha256:${shortHash(roadmap)}, origin sha256:${shortHash(origin)}; L14)`,
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
  return { onboarding: onboardingDoc(), origin: ORIGIN, roadmap: ROADMAP, agents: AGENTS, ...over };
}

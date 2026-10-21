import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENTS_PATH, ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_LINE, ROADMAP_PATH, SUMMARY_LINE, TOPICS,
  adrTemplate, checkOnboarding, currentStage, featureTemplate, hashes, originTemplate, roadmapTemplate, shortHash, stageReport,
} from './onboard.mjs';
import { validateContract } from './contract.mjs';
import { LEAD_OPENING_PROMPT } from './lead-prompt.mjs';
import { components } from './manifest.mjs';
import { parseRoadmap } from './progress.mjs';
import { ADRS, ADVICE, AGENTS_TEMPLATE, ORIGIN, PROFILES, ROADMAP, SETUP, adr, answered, onboardingDoc, files } from './onboard.testkit.mjs';

/** The fixture ADRs' hash, as O3 and O5 record it. */
const ADRS_HASH = () => hashes({ onboarding: null, origin: null, roadmap: null, adrs: ADRS }).adrs;
const ROADMAP_HASH = (roadmap = ROADMAP) => hashes({ onboarding: null, origin: null, roadmap }).roadmap;

const check = (over = {}, options = {}) => checkOnboarding(files(over), { agentsTemplate: AGENTS_TEMPLATE, profiles: PROFILES, ...options });
const messages = (findings) => findings.map((f) => `${f.file} (stage ${f.stage}): ${f.message}`);

test('a complete onboarding has no finding', () => {
  assert.deepEqual(check(), []);
});

test('the paths are the ones the design names', () => {
  assert.deepEqual([ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_PATH, AGENTS_PATH], ['odd/tasks/onboarding.md', 'docs/origin.md', 'docs/ROADMAP.md', 'AGENTS.md']);
  assert.equal(TOPICS.length, 11);
});

test('a missing file is one finding that names the stage that writes it', () => {
  assert.deepEqual(messages(check({ onboarding: null })), [
    'odd/tasks/onboarding.md (stage 1): missing: js-harness onboard template feature --write starts it',
  ]);
  assert.deepEqual(messages(check({ origin: null, onboarding: onboardingDoc({ o3: '- [ ] O3 Pre-plan approved' }) })).slice(0, 1), [
    'docs/origin.md (stage 3): missing: js-harness onboard template origin --write starts it',
  ]);
});

const atTwo = (...lines) => lines.map((line) => `odd/tasks/onboarding.md (stage 2): ${line}`);
const checkTwo = (doc, adrs = ADRS) => messages(check({ onboarding: onboardingDoc({ ...doc, adrs }), adrs })).filter((line) => line.includes('(stage 2)'));
/** Fast mode's given-up line, under ## Advice after the areas. */
const GIVEN_UP = '- Given up (fast, L20): the depth of each area, and B:uncertainty';

test('the interview: eleven topics, each settled, and topics 1, 2, 3, 4 and 9 said or confirmed by the owner', () => {
  const topics = answered();
  topics[1] = `- [x] 2 ${TOPICS[1]} — unknown (OD3)`;
  topics[2] = `- [x] 3 ${TOPICS[2]} — deduced (L5)`;
  topics[3] = `- [ ] 4 ${TOPICS[3]} — deduced (L6)`;
  topics[4] = `- [ ] 5 ${TOPICS[4]}`;
  topics[5] = `- [x] 6 ${TOPICS[5]} — deduced (L7)`;
  topics[6] = `- [x] 7 ${TOPICS[6]}`;
  topics[8] = `- [x] 9 ${TOPICS[8]} — confirmed (L16)`;
  topics.splice(10, 1);
  assert.deepEqual(checkTwo({ topics }), atTwo(
    'the interview has no topic 11',
    'topic 2 is marked unknown: topics 1, 2, 3, 4 and 9 need an answer',
    'topic 3 is checked as deduced: topics 1, 2, 3, 4 and 9 are checked once the owner says or confirms them',
    'topic 4 is deduced and waits for the owner\'s confirmation',
    'topic 5 is not covered yet',
    'topic 7 is checked with no "— answered (L<n>)", "— deduced (L<n>)", "— confirmed (L<n>)" or "— unknown (OD<n>)"',
  ));
});

test('the summary line closes the interview: present, then checked with the Log line of the last answer', () => {
  const topics = answered();
  assert.deepEqual(checkTwo({ topics: topics.slice(0, -1) }), atTwo(`the interview has no summary line "${SUMMARY_LINE}"`));
  topics[11] = SUMMARY_LINE;
  assert.deepEqual(checkTwo({ topics }), atTwo('the summary is not given yet: S is checked once its deepening questions are answered'));
  topics[11] = SUMMARY_LINE.replace('[ ]', '[x]');
  assert.deepEqual(checkTwo({ topics }), atTwo('S names no Log line (L<n>) of the last answer'));
});

test('## Setup: its five lines, each in its format', () => {
  assert.deepEqual(checkTwo({ setup: [] }), atTwo(
    '## Setup has no Kind line yet',
    '## Setup has no Size line yet',
    '## Setup has no Level line yet',
    'Teaching is not set: log the opening as a (session) Log line, then write - Teaching: on (L<n>)',
    '## Setup has no Mode line: write - Mode: full',
  ));
  assert.deepEqual(checkTwo({ setup: ['- Kind: cafe', '- Size: big (L3)', '- Level: stack experienced (L4)', '- Teaching: maybe', '- Mode: fast'] }), atTwo(
    'Kind: cafe is not a kind of the profiles; js-harness onboard profile lists them',
    'Size is "big (L3)": write small (L<n>) or large (L<n>)',
    'Level is "stack experienced (L4)": write A:<id> new|some|experienced, one per area of ## Advice, then (L<n>)',
    'Teaching is "maybe": write on (L<n>) or off (L<n>)',
    'Mode is "fast": write full, or fast (L<n>)',
  ));
  // The template's bare "on" is no setting yet: the opening is still to be logged.
  assert.deepEqual(checkTwo({ setup: SETUP.map((line) => line.replace('on (L2)', 'on')) }), atTwo(
    'Teaching is not set: log the opening as a (session) Log line, then write - Teaching: on (L<n>)',
  ));
  const offFast = SETUP.map((line) => line.replace('Teaching: on (L2)', 'Teaching: off (L9)').replace('Mode: full', 'Mode: fast (L11)'));
  assert.deepEqual(checkTwo({ setup: offFast, advice: [...ADVICE, GIVEN_UP] }), []);
  assert.deepEqual(checkTwo({ setup: SETUP.map((line) => line.replace('Kind: shop', 'Kind: shop, blog (L3)')) }), []);
});

test('## Advice: the areas --checklist advice prints for Kind and Size, each settled in one of its forms', () => {
  assert.deepEqual(checkTwo({ advice: [] }), atTwo('## Advice is empty: paste what js-harness onboard profile --checklist advice prints'));
  const small = SETUP.map((line) => line.replace('large (L3)', 'small (L3)'));
  assert.deepEqual(checkTwo({ setup: small }), atTwo(
    '## Advice lists A:hosting, which js-harness onboard profile --checklist advice does not print for this Kind and Size',
    '## Advice lists A:legal, which js-harness onboard profile --checklist advice does not print for this Kind and Size',
  ));
  assert.deepEqual(checkTwo({ advice: ADVICE.slice(0, 2) }), atTwo(
    '## Advice lacks A:legal, which js-harness onboard profile --checklist advice prints for this Kind and Size',
    'Level names A:legal, which is not under ## Advice',
  ));
  assert.deepEqual(checkTwo({ advice: [
    '- [ ] A:stack Stack',
    '- [x] A:hosting Hosting — a VPS',
    '- [x] A:legal Legal — default, fast, ADR-0003 (L20)',
  ] }), atTwo(
    'A:stack is not settled yet',
    'A:hosting is checked with "a VPS": write proposed, asked or the owner\'s, ADR-<nnnn> (L<n>), open (OD<n>), or with Mode fast, default, fast, ADR-<nnnn> (L<n>)',
    'A:legal is settled default, fast, but Mode is not fast',
    'A:legal names ADR-0003, which is not under docs/adr/: js-harness onboard template adr <slug> --write starts it',
  ));
  const fast = SETUP.map((line) => line.replace('Mode: full', 'Mode: fast (L11)'));
  const legal = new Map([...ADRS, ['docs/adr/0003-legal.md', adr('0003', 'Legal', 'A:legal', { sources: ['- profile: shop A:legal (js-harness 0.97.0)'] })]]);
  const fastAdvice = [ADVICE[0], '- [x] A:hosting Hosting — asked, ADR-0002 (L18)', '- [x] A:legal Legal — default, fast, ADR-0003 (L20)'];
  assert.deepEqual(checkTwo({ setup: fast, advice: [...fastAdvice, GIVEN_UP] }, legal), []);
  // Fast mode names what it gives up; full mode has nothing to give up.
  assert.deepEqual(checkTwo({ setup: fast, advice: fastAdvice }, legal), atTwo('Mode is fast, and ## Advice has no line "- Given up (fast, L<n>): <the bar IDs and the depth left out>"'));
  assert.deepEqual(checkTwo({ advice: [...ADVICE, GIVEN_UP] }), atTwo('## Advice has a given-up line, but Mode is not fast'));
  const level = SETUP.map((line) => line.replace(', A:legal some', ''));
  assert.deepEqual(checkTwo({ setup: level }), atTwo('Level has no level for A:legal'));
  // A Kind and Size whose checklist prints no area ask for no paste.
  const none = SETUP.map((line) => line.replace('Kind: shop', 'Kind: other (nearest: none)').replace('large (L3)', 'small (L3)'));
  assert.ok(!checkTwo({ setup: none, advice: [] }).some((line) => line.includes('## Advice is empty')));
});

test('the ADRs: each one an area names exists, names that area, cites a source in a D12 form, and belongs to an area', () => {
  const at = (file, message) => `${file} (stage 2): ${message}`;
  const runtime = 'docs/adr/0001-runtime.md';
  assert.deepEqual(checkTwo({}, new Map([[runtime, ADRS.get(runtime)]])), atTwo(
    'A:hosting names ADR-0002, which is not under docs/adr/: js-harness onboard template adr <slug> --write starts it',
  ));
  const wrongArea = new Map([...ADRS, ['docs/adr/0002-hosting.md', adr('0002', 'Hosting', 'A:stack')]]);
  assert.deepEqual(checkTwo({}, wrongArea), [at('docs/adr/0002-hosting.md', '## Area is "A:stack", but A:hosting names ADR-0002')]);
  const sources = new Map([...ADRS, ['docs/adr/0002-hosting.md', adr('0002', 'Hosting', 'A:hosting', { sources: ['- the docs', '- profile: shop A:hosting (js-harness 0.97.0)'] })]]);
  assert.deepEqual(checkTwo({}, sources), [
    at('docs/adr/0002-hosting.md', 'the source "- the docs" is in none of the three forms: <URL> — <what it says> (read <YYYY-MM-DD>), profile: <kind> A:<id> (js-harness <version>), or not read: <why> (<YYYY-MM-DD>)'),
    at('docs/adr/0002-hosting.md', 'cites the profile as a source, which only Mode fast allows: read the docs and cite them'),
  ]);
  const none = new Map([...ADRS, ['docs/adr/0002-hosting.md', adr('0002', 'Hosting', 'A:hosting', { sources: [] })]]);
  assert.deepEqual(checkTwo({}, none), [at('docs/adr/0002-hosting.md', 'names no source under ## Sources')]);
  const stray = new Map([...ADRS, ['docs/adr/0003-cache.md', adr('0003', 'Cache', 'A:stack')], ['docs/adr/0004-old.md', adr('0004', 'Old', 'A:stack', { status: 'superseded by ADR-0001' })]]);
  assert.deepEqual(checkTwo({}, stray), [at('docs/adr/0003-cache.md', 'belongs to no area of ## Advice: name ADR-0003 on its area, or mark it superseded or withdrawn under ## Status')]);
  const templated = new Map([...ADRS, ['docs/adr/0002-hosting.md', `${adr('0002', 'Hosting', 'A:hosting')}\n## Context\n<why this area needs a decision now>\n`]]);
  assert.deepEqual(checkTwo({}, templated), [at('docs/adr/0002-hosting.md', 'still holds the template line "<why this area needs a decision now>"')]);
});

test('an ADR whose docs were not read is named under the pre-plan\'s ## Risks', () => {
  const unread = new Map([...ADRS, ['docs/adr/0002-hosting.md', adr('0002', 'Hosting', 'A:hosting', { sources: ['- not read: the host publishes no docs (2026-10-19)'] })]]);
  const doc = onboardingDoc({ adrs: unread });
  assert.deepEqual(messages(check({ onboarding: doc, adrs: unread })), ['docs/origin.md (stage 3): ADR-0002 has a source not read, and ## Risks does not name it']);
  const origin = ORIGIN.replace('## Risks\n', '## Risks\n- ADR-0002 rests on no docs — the host publishes none.\n');
  assert.deepEqual(check({ origin, onboarding: onboardingDoc({ origin, adrs: unread }), adrs: unread }), []);
});

test('O3 and O5 record the ADRs; a no on one area edits its ADR in place and sends the work back to stage 3', () => {
  const before = ADRS_HASH();
  const edited = new Map([...ADRS, ['docs/adr/0002-hosting.md', adr('0002', 'Hosting', 'A:hosting', { status: 'proposed (L30); accepted with the pre-plan (O3)' })]]);
  const now = hashes({ onboarding: null, origin: null, roadmap: null, adrs: edited }).adrs;
  assert.notEqual(now, before);
  assert.deepEqual(messages(check({ adrs: edited })).filter((line) => line.includes('adrs')), [
    `odd/tasks/onboarding.md (stage 4): O3 records adrs sha256:${before}, but docs/adr/ is sha256:${now}: it changed since its approval`,
    `odd/tasks/onboarding.md (stage 6): O5 records adrs sha256:${before}, but docs/adr/ is sha256:${now}: it changed since its approval`,
  ]);
  const o2 = `- [x] O2 Pre-plan written (answers sha256:${recordedAnswers()})`;
  const advice = [ADVICE[0], '- [x] A:hosting Hosting — the owner\'s, ADR-0002 (L30)', ADVICE[2]];
  assert.deepEqual(stage({ onboarding: onboardingDoc({ advice, o2 }), adrs: edited }), { stage: 3, changed: true });
});

test('once the onboarding is closed (O6), Kind and the areas are no longer compared with the profiles', () => {
  const setup = SETUP.map((line) => line.replace('Kind: shop', 'Kind: bakery').replace('A:legal some', 'A:legal some, A:payments new'));
  assert.deepEqual(check({ onboarding: onboardingDoc({ setup, advice: [...ADVICE, '- [x] A:payments Payments — open (OD2)'], o6: 'x' }) }), []);
  // The ADRs live on after it, and Advice is history: neither is held to the onboarding's rules again.
  const fast = SETUP.map((line) => line.replace('Mode: full', 'Mode: fast (L11)'));
  const later = new Map([['docs/adr/0002-hosting.md', '# ADR-0002: Hosting\n\n## Status\nsuperseded by ADR-0009\n'], ['docs/adr/0009-cloud.md', '# ADR-0009: Cloud\n'], ['docs/adr/0010-tax.md', adr('0010', 'Tax', 'A:legal', { sources: ['- not read: no docs yet (2026-11-02)'] })]]);
  assert.deepEqual(check({ onboarding: onboardingDoc({ setup: fast, o6: 'x' }), adrs: later }), []);
  assert.equal(stage({ onboarding: onboardingDoc({ setup: fast, o6: 'x' }), adrs: later }).stage, 'done');
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
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o5: `- [x] O5 Roadmap approved (roadmap sha256:${ROADMAP_HASH()}, origin sha256:${shortHash(ORIGIN)}, adrs sha256:${ADRS_HASH()})` }) })), [
    'odd/tasks/onboarding.md (stage 6): O5 names no Log line (L<n>) with the owner\'s yes',
  ]);
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o3: '- [x] O3 Pre-plan approved (L12)' }) })), [
    'odd/tasks/onboarding.md (stage 4): O3 records no origin sha256: js-harness onboard hash prints it',
    'odd/tasks/onboarding.md (stage 4): O3 records no adrs sha256: js-harness onboard hash prints it',
  ]);
});

test('an approval names a Log line that is under ## Log', () => {
  const o3 = `- [x] O3 Pre-plan approved (origin sha256:${shortHash(ORIGIN)}, adrs sha256:${ADRS_HASH()}; L99)`;
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o3 }) })), [
    'odd/tasks/onboarding.md (stage 4): O3 names L99, which is not under ## Log',
  ]);
});

test('an approval may run over the continuation lines of its item', () => {
  const o5 = `- [x] O5 Roadmap approved (roadmap sha256:${ROADMAP_HASH()},
  origin sha256:${shortHash(ORIGIN)}, adrs sha256:${ADRS_HASH()}; L14)`;
  assert.deepEqual(check({ onboarding: onboardingDoc({ o5 }) }), []);
});

test('O2 records the answers it was written from; changed answers send the work back to stage 3', () => {
  const recorded = hashes({ onboarding: onboardingDoc(), origin: null, roadmap: null }).answers;
  const o2 = `- [x] O2 Pre-plan written (answers sha256:${recorded})`;
  const topics = answered();
  topics[3] = `- [x] 4 ${TOPICS[3]} — answered (L5, changed in L20)`;
  const advice = [ADVICE[0], '- [x] A:hosting Hosting — the owner\'s, ADR-0002 (L21)', ADVICE[2]];
  const size = SETUP.map((line) => line.replace('large (L3)', 'large (L22)'));
  for (const changed of [onboardingDoc({ topics, o2 }), onboardingDoc({ advice, o2 }), onboardingDoc({ setup: size, o2 })]) {
    const now = hashes({ onboarding: changed, origin: null, roadmap: null }).answers;
    assert.deepEqual(messages(check({ onboarding: changed })), [
      `odd/tasks/onboarding.md (stage 3): O2 records answers sha256:${recorded}, but the conversation (## Interview, ## Advice, Kind and Size) is sha256:${now}: it changed since its approval`,
    ]);
  }
  // Teaching, Mode and Level are left out of the hash: turning teaching off reopens nothing (D2).
  const teaching = SETUP.map((line) => line.replace('on (L2)', 'off (L30)').replace('A:stack experienced', 'A:stack some'));
  assert.deepEqual(check({ onboarding: onboardingDoc({ setup: teaching, o2 }) }), []);
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o2: '- [x] O2 Pre-plan written' }) })), [
    'odd/tasks/onboarding.md (stage 3): O2 records no answers sha256: js-harness onboard hash prints it',
  ]);
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o2: '- [ ] O2 Pre-plan written' }) })), [
    'odd/tasks/onboarding.md (stage 3): O2 is not checked: the pre-plan is not written from the conversation yet',
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
    .replace(/- OD1 Which payment provider.*\n/, '- Nothing open.\n');
  const onboarding = onboardingDoc({ roadmap });
  assert.deepEqual(messages(check({ roadmap, onboarding })), [
    'docs/ROADMAP.md (stage 5): the pre-plan phase "P2 Orders" is not a roadmap phase',
    'docs/ROADMAP.md (stage 5): no ## Next: the first unchecked step and the text that starts its session',
    "docs/ROADMAP.md (stage 5): B:privacy is on no Checklist step: paste it from js-harness onboard profile --checklist bar, put it under ## Open decisions with its area's OD, or name it in the given-up line",
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

test('hashes: each file\'s short sha256, and the answers\', or null where a file is missing', () => {
  const doc = onboardingDoc();
  const body = (title, next) => doc.slice(doc.indexOf(`## ${title}\n`) + `## ${title}\n`.length, doc.indexOf(`## ${next}\n`)).trim();
  assert.deepEqual(hashes({ onboarding: doc, origin: ORIGIN, roadmap: null }), {
    answers: shortHash(['## Interview', body('Interview', 'Advice'), '## Advice', body('Advice', 'Tasks'), 'Kind: shop', 'Size: large (L3)'].join('\n')),
    origin: shortHash(ORIGIN),
    roadmap: null,
    adrs: null,
  });
  assert.deepEqual(hashes({ onboarding: null, origin: null, roadmap: null }), { answers: null, origin: null, roadmap: null, adrs: null });
  // docs/adr/ hashes as one text: each ADR's path and text, in the order of their paths.
  const reversed = new Map([...ADRS].reverse());
  const text = [...ADRS].map(([path, body]) => `## ${path}\n${body}`).join('\n');
  assert.equal(hashes({ onboarding: null, origin: null, roadmap: null, adrs: reversed }).adrs, shortHash(text));
  assert.equal(hashes({ onboarding: null, origin: null, roadmap: null, adrs: new Map() }).adrs, shortHash(''));
});

test('hashes leave out what teaching and mode may change: the given-up line, and the roadmap\'s ## Advice mode', () => {
  const answers = (advice) => hashes({ onboarding: onboardingDoc({ advice }), origin: null, roadmap: null }).answers;
  assert.equal(answers([...ADVICE, '- Given up (fast, L20): B:uptime']), answers(ADVICE));
  const roadmap = (mode) => hashes({ onboarding: null, origin: null, roadmap: ROADMAP.replace(/Teaching: on · Mode: full/, mode) }).roadmap;
  assert.equal(roadmap('Teaching: off · Mode: fast'), roadmap('Teaching: on · Mode: full'));
  assert.notEqual(ROADMAP_HASH(ROADMAP.replace('Bread on a page', 'Cakes')), ROADMAP_HASH());
});

test('the pre-plan names each decided area under ## Stack and architecture, and the owner\'s steps', () => {
  const origin = ORIGIN.replace('| Hosting | a VPS | ADR-0002 |\n', '').replace(/## Owner steps\n- Rent the VPS \(about 6 USD a month\)\.\n/, '');
  assert.deepEqual(messages(check({ origin, onboarding: onboardingDoc({ origin }) })), [
    'docs/origin.md (stage 3): missing section "## Owner steps"',
    'docs/origin.md (stage 3): ## Stack and architecture has no row for A:hosting (ADR-0002)',
  ]);
});

test('the roadmap: ## Decided names each accepted ADR, ## Advice mode is one line, and each B: target has its place', () => {
  const at = (roadmap) => messages(check({ roadmap, onboarding: onboardingDoc({ roadmap }) })).filter((line) => line.includes('(stage 5)'));
  assert.deepEqual(at(ROADMAP.replace('| Hosting | a VPS | ADR-0002 |\n', '')), ['docs/ROADMAP.md (stage 5): ## Decided does not name ADR-0002, accepted for A:hosting']);
  assert.deepEqual(at(ROADMAP.replace(' · Mode: full', '')), ['docs/ROADMAP.md (stage 5): ## Advice mode is not one line "Teaching: on|off · Mode: full|fast · Level: A:<id> new|some|experienced, ..."']);
  const noUptime = ROADMAP.replace(/- \[ \] B:uptime .*\n/, '');
  assert.deepEqual(at(noUptime), ['docs/ROADMAP.md (stage 5): B:uptime is on no Checklist step: paste it from js-harness onboard profile --checklist bar, put it under ## Open decisions with its area\'s OD, or name it in the given-up line']);
  const noPrivacy = ROADMAP.replace(': B:privacy waits on it', '');
  assert.deepEqual(at(noPrivacy), ['docs/ROADMAP.md (stage 5): B:privacy is on no Checklist step: paste it from js-harness onboard profile --checklist bar, put it under ## Open decisions with its area\'s OD, or name it in the given-up line']);
  // The given-up line excuses a target, and --plan reads it from the onboarding document.
  const fast = SETUP.map((line) => line.replace('Mode: full', 'Mode: fast (L11)'));
  const doc = onboardingDoc({ roadmap: noUptime, setup: fast, advice: [...ADVICE, '- Given up (fast, L20): B:uptime'] });
  assert.deepEqual(messages(check({ roadmap: noUptime, onboarding: doc }, { plan: true })), []);
});

test('the roadmap\'s advice mode takes a copy of ## Setup, a retired ADR leaves ## Decided, and none of it holds after the close', () => {
  const at = (roadmap, doc = {}, adrs = ADRS) => messages(check({ roadmap, adrs, onboarding: onboardingDoc({ roadmap, adrs, ...doc }) })).filter((line) => line.includes('(stage 5)'));
  const copied = ROADMAP.replace('Teaching: on · Mode: full · Level: A:stack experienced, A:hosting some, A:legal some', 'Teaching: on (L2) · Mode: full · Level: A:stack experienced, A:hosting some, A:legal some (L4)');
  assert.deepEqual(at(copied), []);
  const noMode = ROADMAP.replace(/## Advice mode\n.*\n\n/, '');
  assert.deepEqual(at(noMode), ['docs/ROADMAP.md (stage 5): no ## Advice mode: copy Teaching, Mode and Level from the onboarding\'s ## Setup']);
  const superseded = new Map([...ADRS, ['docs/adr/0002-hosting.md', adr('0002', 'Hosting', 'A:hosting', { status: 'superseded by ADR-0003 (L30)' })]]);
  assert.deepEqual(at(ROADMAP.replace('| Hosting | a VPS | ADR-0002 |\n', ''), {}, superseded), []);
  // A closed onboarding keeps its roadmap as it was: none of the v4 roadmap messages comes back.
  const old = noMode.replace(/- \[ \] B:uptime .*\n/, '').replace('| Hosting | a VPS | ADR-0002 |\n', '').replace('B:privacy waits on it', 'legal waits on it');
  assert.deepEqual(at(old, { o6: 'x' }), []);
  assert.deepEqual(at(old.replace('## Phases', '## Advice mode\nTeaching: on\n\n## Phases'), { o6: 'x' }), []);
});

test('the roadmap hash reads CRLF as it always did, and leaves out a CRLF ## Advice mode', () => {
  const crlf = ROADMAP.replace(/\n/g, '\r\n');
  const bare = crlf.replace(/## Advice mode\r\n.*\r\n\r\n/, '');
  assert.equal(hashes({ onboarding: null, origin: null, roadmap: bare }).roadmap, shortHash(bare));
  assert.equal(ROADMAP_HASH(crlf), ROADMAP_HASH(crlf.replace('Teaching: on · Mode: full', 'Teaching: off · Mode: fast')));
  // Only ## Advice mode, as the parser reads its end: an indented heading after it still counts.
  const indented = ROADMAP.replace('## Phases', ' ## Phases');
  assert.notEqual(ROADMAP_HASH(indented), ROADMAP_HASH(indented.replace('`npm run e2e` exits 0 | Not started', '`npm run e3e` exits 0 | Not started')));
});

test('a B: target in a fenced example under ## Checklist is no step', () => {
  const fenced = ROADMAP.replace(/- \[ \] B:uptime .*\n/, '```\n- [ ] B:uptime example only\n```\n');
  assert.deepEqual(messages(check({ roadmap: fenced, onboarding: onboardingDoc({ roadmap: fenced }) })).filter((line) => line.includes('(stage 5)')), [
    'docs/ROADMAP.md (stage 5): B:uptime is on no Checklist step: paste it from js-harness onboard profile --checklist bar, put it under ## Open decisions with its area\'s OD, or name it in the given-up line',
  ]);
});

test('the templates: the feature is a valid contract with its setup, eleven topics and the summary line, and the others start with what check asks for', () => {
  const feature = featureTemplate();
  assert.deepEqual(validateContract(feature), { ok: true, errors: [] });
  for (const [i, title] of TOPICS.entries()) assert.ok(feature.includes(`- [ ] ${i + 1} ${title}`), title);
  assert.ok(feature.includes(`\n${SUMMARY_LINE}\n`), feature);
  assert.match(feature, /\n## Setup\n(?:<!--.*-->\n)?- Teaching: on\n- Mode: full\n/);
  assert.match(feature, /\n## Advice\n<!--.*--checklist advice.*-->\n/);
  for (const id of ['O1', 'O2', 'O3', 'O4', 'O5', 'O6']) assert.match(feature, new RegExp(`- \\[ \\] ${id} `));
  const origin = originTemplate('shop');
  for (const section of ['Status', 'Goal', 'Why', 'What exists', 'Decisions already made', 'Principles', 'Phases', 'Not built', 'Risks', 'Open decisions', 'Sources']) {
    assert.ok(origin.includes(`\n## ${section}\n`), section);
  }
  const roadmap = roadmapTemplate();
  assert.equal(parseRoadmap(roadmap).phases.length, 1);
  for (const section of ['Phases', 'Checklist', 'Next', 'Open decisions', 'Risks']) assert.ok(roadmap.includes(`\n## ${section}\n`), section);
  const record = adrTemplate('0003');
  assert.match(record, /^# ADR-0003: </);
  assert.match(record, /\n## Status\nproposed \(L<n>\); accepted with the pre-plan \(O3\)\n/);
  for (const section of ['Area', 'Context', 'Decision', 'Alternatives considered', 'Consequences', 'Sources', "The owner's words"]) {
    assert.ok(record.includes(`\n## ${section}\n`), section);
  }
  // No template assumes the owner's pronoun (JH 43, 2026-10-21: "<his words>" in L1).
  for (const [name, text] of [['feature', feature], ['origin', origin], ['roadmap', roadmap], ['adr', record]]) {
    assert.doesNotMatch(text, /\b(his|him|he|her|she)\b/i, name);
  }
});

test('a template written as it is fails the check on its own template lines, never passes', () => {
  const findings = check({ origin: originTemplate('shop'), roadmap: roadmapTemplate() });
  assert.ok(findings.some((f) => f.file === ORIGIN_PATH && f.message.startsWith('still holds the template line')), messages(findings).join('\n'));
  assert.ok(findings.some((f) => f.file === ROADMAP_PATH && f.message.startsWith('still holds the template line')), messages(findings).join('\n'));
});

const stage = (over = {}) => currentStage(files(over), { agentsTemplate: AGENTS_TEMPLATE, profiles: PROFILES });
const stageTwo = (doc) => {
  const { stage: at, step, covered, open, waiting, wrong } = stage({ onboarding: onboardingDoc(doc) });
  return { at, step, covered, open, waiting, wrong };
};
const recordedAnswers = () => hashes({ onboarding: onboardingDoc(), origin: null, roadmap: null }).answers;

test('currentStage, stage 2: the next step of the conversation, what it covered, and what is still open', () => {
  const blank = ['- Teaching: on', '- Mode: full'];
  assert.deepEqual(stageTwo({ setup: blank, advice: [], topics: TOPICS.map((title, i) => `- [ ] ${i + 1} ${title}`).concat(SUMMARY_LINE) }), {
    at: 2, step: 'opening', covered: { topics: 0, areas: 0, total: null }, open: { topics: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], areas: [] }, waiting: [], wrong: [],
  });
  const opened = ['- Teaching: on (L2)', '- Mode: full'];
  const early = answered().map((line, i) => (i < 11 ? `- [ ] ${i + 1} ${TOPICS[i]}` : SUMMARY_LINE));
  early[0] = `- [ ] 1 ${TOPICS[0]} — deduced (L3)`;
  early[4] = `- [x] 5 ${TOPICS[4]} — deduced (L4)`;
  assert.deepEqual(stageTwo({ setup: opened, advice: [], topics: early }), {
    at: 2, step: 'kind', covered: { topics: 1, areas: 0, total: null }, open: { topics: [2, 3, 4, 6, 7, 8, 9, 10, 11], areas: [] }, waiting: [1], wrong: [],
  });
  const kindSize = ['- Kind: shop (L3)', '- Size: large (L3)', ...opened];
  // The paste waits while the owner's level, topic 3, is open; a deduced level has been shown.
  assert.deepEqual(stageTwo({ setup: kindSize, advice: [], topics: early }).step, 'converse');
  const levelShown = early.map((line, i) => (i === 2 ? `- [ ] 3 ${TOPICS[2]} — deduced (L5)` : line));
  assert.deepEqual(stageTwo({ setup: kindSize, advice: [], topics: levelShown }).step, 'advice');
  // A pasted set the profiles no longer print is pasted again.
  assert.deepEqual(stageTwo({ setup: kindSize, advice: ADVICE.slice(0, 1), topics: levelShown }).step, 'advice');
  const pasted = ['- [ ] A:stack Stack', '- [x] A:hosting Hosting — proposed, ADR-0002 (L13)', '- [ ] A:legal Legal'];
  assert.deepEqual(stageTwo({ advice: pasted, topics: early }), {
    at: 2, step: 'converse', covered: { topics: 1, areas: 1, total: 3 }, open: { topics: [2, 3, 4, 6, 7, 8, 9, 10, 11], areas: ['A:stack', 'A:legal'] }, waiting: [1], wrong: [],
  });
  const summary = answered();
  summary[2] = `- [ ] 3 ${TOPICS[2]} — deduced (L5)`;
  summary[11] = SUMMARY_LINE;
  assert.deepEqual(stageTwo({ topics: summary }), {
    at: 2, step: 'summary', covered: { topics: 10, areas: 3, total: 3 }, open: { topics: [], areas: [] }, waiting: [3], wrong: [],
  });
  // A Level never completed after the paste sends the session back to the step that asks for it.
  assert.deepEqual(stageTwo({ setup: SETUP.filter((line) => !line.startsWith('- Level')) }).step, 'advice');
  // What is wrong is named, and the conversation goes on around it.
  const mode = SETUP.map((line) => line.replace('Mode: full', 'Mode: quick'));
  assert.deepEqual(stageTwo({ setup: mode }), {
    at: 2, step: 'fix', covered: { topics: 11, areas: 3, total: 3 }, open: { topics: [], areas: [] }, waiting: [], wrong: ['Mode is "quick": write full, or fast (L<n>)'],
  });
  // An ADR's finding names its file.
  const hosting = new Map([...ADRS, ['docs/adr/0002-hosting.md', adr('0002', 'Hosting', 'A:hosting', { sources: [] })]]);
  assert.deepEqual(stage({ onboarding: onboardingDoc({ adrs: hosting }), adrs: hosting }).wrong, ['docs/adr/0002-hosting.md: names no source under ## Sources']);
  // A Kind and Size whose checklist prints no area have nothing to paste: the conversation is not held at stage 2.
  const none = SETUP.map((line) => line.replace('Kind: shop', 'Kind: other (nearest: none)').replace('large (L3)', 'small (L3)'));
  assert.notEqual(stage({ onboarding: onboardingDoc({ setup: none, advice: [], adrs: new Map() }), adrs: new Map() }).stage, 2);
});

test('currentStage: the first stage whose record is missing or no longer holds', () => {
  assert.deepEqual(stage({ onboarding: null }), { stage: 1 });
  assert.deepEqual(stage({ onboarding: onboardingDoc({ o1: ' ' }) }), { stage: 1 });
  const unsummed = answered();
  unsummed[11] = SUMMARY_LINE;
  // Stage 3 waits for the summary line.
  assert.equal(stage({ onboarding: onboardingDoc({ topics: unsummed, o2: '- [ ] O2 Pre-plan written' }) }).stage, 2);

  assert.deepEqual(stage({ onboarding: onboardingDoc({ o2: '- [ ] O2 Pre-plan written' }) }), { stage: 3, changed: false });
  const revised = answered();
  revised[0] += ', revised in L20';
  assert.deepEqual(stage({ onboarding: onboardingDoc({ topics: revised, o2: `- [x] O2 Pre-plan written (answers sha256:${recordedAnswers()})` }) }), { stage: 3, changed: true });

  assert.deepEqual(stage({ onboarding: onboardingDoc({ o3: '- [ ] O3 Pre-plan approved' }) }), { stage: 4, changed: false });
  const origin = ORIGIN.replace('bread online', 'bread and cakes online');
  const o5 = `- [x] O5 Roadmap approved (roadmap sha256:${ROADMAP_HASH()}, origin sha256:${shortHash(origin)}, adrs sha256:${ADRS_HASH()}; L14)`;
  assert.deepEqual(stage({ origin, onboarding: onboardingDoc({ o5 }) }), { stage: 4, changed: true });

  assert.deepEqual(stage({ onboarding: onboardingDoc({ o4: ' ' }) }), { stage: 5 });
  // A checked task whose file is gone is not done: the stage that writes the file is current again.
  assert.deepEqual(stage({ origin: null }), { stage: 3, changed: false });
  assert.deepEqual(stage({ roadmap: null }), { stage: 5 });
  assert.deepEqual(stage({ onboarding: onboardingDoc({ o5: '- [ ] O5 Roadmap approved' }) }), { stage: 6, changed: false });
  assert.deepEqual(stage({ roadmap: ROADMAP.replace('Bread on a page', 'Bread and cakes on a page') }), { stage: 6, changed: true });

  const close = stage({ agents: '# shop\n' });
  assert.equal(close.stage, 7);
  assert.deepEqual(close.findings.map((f) => f.file), [AGENTS_PATH]);
  assert.deepEqual(stage(), { stage: 7, findings: [] });
  assert.deepEqual(stage({ onboarding: onboardingDoc({ o6: 'x' }) }), { stage: 'done' });
});

const GIT = { branch: 'onboarding', defaultBranch: 'main', defaultHasRoadmap: false, elsewhere: [], uncommitted: [] };
const report = (over = {}, git = {}) => stageReport(files(over), { agentsTemplate: AGENTS_TEMPLATE, profiles: PROFILES, git: { ...GIT, ...git } });
const has = (lines, text) => assert.ok(lines.some((line) => line.includes(text)), `no line holds "${text}":\n${lines.join('\n')}`);
const nothing = { onboarding: null, origin: null, roadmap: null };

test('stageReport: stage 1 starts the document, on the onboarding branch', () => {
  const { code, lines } = report(nothing, { branch: 'main' });
  assert.equal(code, 0);
  assert.equal(lines[0], 'Stage 1 of 8, Read: no onboarding document yet.');
  has(lines, 'git switch -c onboarding');
  has(lines, 'js-harness onboard template feature --write');
  const onBranch = report(nothing).lines;
  assert.ok(!onBranch.some((line) => line.includes('git switch')), onBranch.join('\n'));
  assert.equal(report({ onboarding: onboardingDoc({ o1: ' ' }) }).lines[0], 'Stage 1 of 8, Read: O1 is not checked yet.');
});

test('stageReport, stage 2: Conversation and advice prints what it covered, what is open and waiting, and one next step', () => {
  const topics = answered();
  topics[3] = `- [ ] 4 ${TOPICS[3]} — deduced (L6)`;
  topics[7] = `- [ ] 8 ${TOPICS[7]}`;
  const advice = ['- [ ] A:stack Stack', ADVICE[1], ADVICE[2]];
  const { code, lines } = report({ onboarding: onboardingDoc({ topics, advice, setup: SETUP.map((line) => line.replace('Mode: full', 'Mode: quick')) }) });
  assert.equal(code, 0);
  assert.deepEqual(lines, [
    'Stage 2 of 8, Conversation and advice: covered: 9 of 11 topics, 2 of 3 areas.',
    'FAIL  odd/tasks/onboarding.md: Mode is "quick": write full, or fast (L<n>) (back to stage 2, Conversation and advice)',
    'Open: topic 8; area A:stack.',
    'Deduced, waiting for the owner\'s confirmation: topic 4.',
    lines[4],
    'Then: commit every three settled items, and at the summary, and run js-harness onboard again.',
  ]);
  assert.match(lines[4], /^Do: guide the conversation toward what is still open/);
  has(lines, 'js-harness onboard profile --area <id>');
  has(lines, 'Topics 1, 2, 3, 4 and 9 are checked only once the owner says or confirms them');

  const doOf = (doc) => report({ onboarding: onboardingDoc(doc) }).lines.find((line) => line.startsWith('Do: '));
  const opening = doOf({ setup: ['- Teaching: on', '- Mode: full'], advice: [] });
  assert.match(opening, /^Do: open the conversation: say who you are in this project \(the plan orchestrator/);
  assert.match(opening, /- Teaching: on \(L<n>\), and commit at once\.$/);
  assert.match(doOf({ setup: ['- Teaching: on (L2)', '- Mode: full'], advice: [] }), /^Do: follow the owner's thread; from it, write - Kind: .* and - Size: /);
  assert.match(doOf({ setup: ['- Kind: shop', '- Size: large (L3)', '- Teaching: on (L2)', '- Mode: full'], advice: [] }), /^Do: run js-harness onboard profile --checklist advice and paste what it prints under ## Advice/);
  // The paste completes Level, which D3 writes only once the conversation shows it (JH 43, finding 10): while topic 3,
  // the owner's level, is open, the conversation goes on first.
  const levelOpen = answered();
  levelOpen[2] = `- [ ] 3 ${TOPICS[2]}`;
  assert.match(doOf({ setup: ['- Kind: shop', '- Size: large (L3)', '- Teaching: on (L2)', '- Mode: full'], advice: [], topics: levelOpen }), /^Do: guide the conversation toward what is still open/);
  const summary = answered();
  summary[11] = SUMMARY_LINE;
  const summing = report({ onboarding: onboardingDoc({ topics: summary }) }).lines;
  assert.equal(summing[0], 'Stage 2 of 8, Conversation and advice: covered: 11 of 11 topics, 3 of 3 areas.');
  assert.match(summing.find((line) => line.startsWith('Do: ')), /^Do: log the summary as a \(session\) Log line and give it.*through the question tool.*Check S with the Log line of the last answer\.$/);
  assert.equal(report({ onboarding: onboardingDoc({ setup: ['- Teaching: on (L2)', '- Mode: full'], advice: [] }) }).lines[0],
    'Stage 2 of 8, Conversation and advice: covered: 11 of 11 topics; areas not listed yet.');
});

test('stageReport: each later stage says what it waits on and what records it', () => {
  const pre = report({ origin: null, onboarding: onboardingDoc({ o2: '- [ ] O2 Pre-plan written', o3: '- [ ] O3 Pre-plan approved' }) }).lines;
  assert.equal(pre[0], 'Stage 3 of 8, Pre-plan: the conversation is complete.');
  has(pre, 'js-harness onboard template origin --write');
  has(pre, `answers sha256:${recordedAnswers()}`);
  has(pre, 'from the conversation and the ADRs');
  has(pre, '## Stack and architecture one row per area settled with an ADR');
  has(pre, '## Owner steps');
  const revised = answered();
  revised[0] += ', revised in L20';
  const again = report({ onboarding: onboardingDoc({ topics: revised, o2: `- [x] O2 Pre-plan written (answers sha256:${recordedAnswers()})` }) }).lines;
  assert.equal(again[0], 'Stage 3 of 8, Pre-plan: the conversation changed since O2 recorded it.');
  assert.ok(!again.some((line) => line.includes('template origin')), again.join('\n'));
  has(again, 'revise docs/origin.md from the conversation and the ADRs');

  const review = report({ onboarding: onboardingDoc({ o3: '- [ ] O3 Pre-plan approved' }) }).lines;
  assert.equal(review[0], 'Stage 4 of 8, Pre-plan review: docs/origin.md waits for the owner\'s approval.');
  has(review, '"Pre-plan round <n>: ..."');
  has(review, 'one question, "Is the pre-plan approved, with its ADRs?", whose text is a summary a phone shows whole: the plan in a few lines, and every area in one line with its proposal and ADR');
  has(review, `(origin sha256:${shortHash(ORIGIN)}, adrs sha256:${ADRS_HASH()}; L<n>)`);

  const plan = report({ onboarding: onboardingDoc({ o4: ' ' }) }).lines;
  assert.equal(plan[0], 'Stage 5 of 8, Plan: the pre-plan is approved.');
  has(plan, 'js-harness onboard check --plan');
  has(plan, 'paste what js-harness onboard profile --checklist bar prints into the first build phase');
  has(plan, '## Decided from the ADRs');
  has(plan, '## Advice mode from ## Setup');

  const roadmap = ROADMAP.replace('Bread on a page', 'Bread and cakes on a page');
  const changed = report({ roadmap }).lines;
  assert.equal(changed[0], 'Stage 6 of 8, Plan review: docs/ROADMAP.md changed since its approval.');
  has(changed, `(roadmap sha256:${ROADMAP_HASH(roadmap)}, origin sha256:${shortHash(ORIGIN)}, adrs sha256:${ADRS_HASH()}; L<n>)`);

  const close = report({ agents: '# shop\n' }).lines;
  assert.equal(close[0], 'Stage 7 of 8, Close: 1 finding left.');
  has(close, `FAIL  AGENTS.md: has no line "${ROADMAP_LINE}" (back to stage 7, Close)`);
  has(close, '"What this project is" from topic 1, and "Constraints" from topics 6, 7 and 9');
  assert.equal(report().lines[0], 'Stage 7 of 8, Close: js-harness onboard check passes; O6 is not checked yet.');
});

test('stageReport: a complete onboarding waits for its merge, then points at the roadmap', () => {
  const closed = { onboarding: onboardingDoc({ o6: 'x' }) };
  const waiting = report(closed).lines;
  assert.equal(waiting[0], 'Stage 8 of 8, Awaiting merge: the onboarding is complete on branch onboarding, and main has no docs/ROADMAP.md yet.');
  has(waiting, 'gh pr create --base main --head onboarding');
  has(waiting, 'the owner\'s decision');

  for (const git of [{ defaultHasRoadmap: true }, { branch: 'main' }]) {
    const done = report(closed, git);
    assert.equal(done.code, 0);
    assert.deepEqual(done.lines, [
      'Onboarded: docs/ROADMAP.md is the plan, and the plan orchestrator\'s work is done.',
      'Next: P1 Catalog, its first step.',
      'The build orchestrator is a new lead session, started with the prompt below, the one the js-harness-orchestrator skill gives:',
      LEAD_OPENING_PROMPT,
    ]);
  }
});

// D13: the handoff prints the skill's own prompt, so the two never drift apart.
test('the handoff prints the lead\'s opening prompt the orchestrator skill gives', () => {
  assert.equal(LEAD_OPENING_PROMPT, 'You are the orchestrator of this project\'s sessions. Follow the js-harness-orchestrator skill: you take over from the orchestrator before you.');
  assert.ok(components.find(({ id }) => id === 'claude-orchestrator-skill').content('0.0.0').includes(`\`\`\`\n${LEAD_OPENING_PROMPT}\n\`\`\``));
});

test('stageReport: no document here and one on another branch says where, and how to resume', () => {
  const elsewhere = [
    { branch: 'onboarding', worktree: 'D:/shop-worktrees/onboarding' },
    { branch: 'old-onboarding', worktree: null },
    { branch: 'origin/plan', worktree: null, remote: true },
  ];
  const { code, lines } = report(nothing, { branch: 'feat/x', elsewhere });
  assert.equal(code, 0);
  assert.deepEqual(lines, [
    'Onboarding in progress on branch onboarding, checked out in D:/shop-worktrees/onboarding: open a session there and run js-harness onboard.',
    'Onboarding in progress on branch old-onboarding: git switch old-onboarding resumes it here.',
    'Onboarding in progress on branch origin/plan: git switch --track origin/plan resumes it here.',
  ]);
  assert.deepEqual(report(nothing, { branch: 'feat/x', elsewhere: [{ branch: 'main', worktree: null }] }).lines, [
    'The onboarding is on main: merge main into this branch, or switch to it.',
  ]);
});

test('stageReport: a plan of its own, and no onboarding anywhere, is left alone with exit 1', () => {
  const { code, lines } = report({ onboarding: null });
  assert.equal(code, 1);
  assert.equal(lines[0], 'This project has a plan of its own: docs/origin.md, docs/ROADMAP.md.');
  has(lines, 'not supported yet');
  assert.equal(report({ onboarding: null, origin: null }).lines[0], 'This project has a plan of its own: docs/ROADMAP.md.');
});

test('stageReport: what is not committed yet is named last', () => {
  const { lines } = report({ onboarding: onboardingDoc({ o4: ' ' }) }, { uncommitted: ['odd/tasks/onboarding.md', 'docs/origin.md'] });
  assert.equal(lines.at(-1), 'Not committed: odd/tasks/onboarding.md, docs/origin.md. Commit them on this branch, so the next session finds them.');
});

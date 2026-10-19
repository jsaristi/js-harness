import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENTS_PATH, ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_LINE, ROADMAP_PATH, TOPICS,
  checkOnboarding, currentStage, featureTemplate, hashes, originTemplate, roadmapTemplate, shortHash, stageReport,
} from './onboard.mjs';
import { validateContract } from './contract.mjs';
import { parseRoadmap } from './progress.mjs';
import { AGENTS_TEMPLATE, ORIGIN, ROADMAP, onboardingDoc, files } from './onboard.testkit.mjs';

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

test('an approval names a Log line that is under ## Log', () => {
  const o3 = `- [x] O3 Pre-plan approved (origin sha256:${shortHash(ORIGIN)}; L99)`;
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o3 }) })), [
    'odd/tasks/onboarding.md (stage 4): O3 names L99, which is not under ## Log',
  ]);
});

test('an approval may run over the continuation lines of its item', () => {
  const o5 = `- [x] O5 Roadmap approved (roadmap sha256:${shortHash(ROADMAP)},
  origin sha256:${shortHash(ORIGIN)}; L14)`;
  assert.deepEqual(check({ onboarding: onboardingDoc({ o5 }) }), []);
});

test('O2 records the interview it was written from; a changed interview sends the work back to stage 3', () => {
  const recorded = hashes({ onboarding: onboardingDoc(), origin: null, roadmap: null }).interview;
  const topics = TOPICS.map((title, i) => `- [x] ${i + 1} ${title} — answered (L${i + 2})`);
  topics[3] = `- [x] 4 ${TOPICS[3]} — answered (L5, changed in L20)`;
  const changed = onboardingDoc({ topics, o2: `- [x] O2 Pre-plan written (interview sha256:${recorded})` });
  const now = hashes({ onboarding: changed, origin: null, roadmap: null }).interview;
  assert.deepEqual(messages(check({ onboarding: changed })), [
    `odd/tasks/onboarding.md (stage 3): O2 records interview sha256:${recorded}, but ## Interview is sha256:${now}: it changed since its approval`,
  ]);
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o2: '- [x] O2 Pre-plan written' }) })), [
    'odd/tasks/onboarding.md (stage 3): O2 records no interview sha256: js-harness onboard hash prints it',
  ]);
  assert.deepEqual(messages(check({ onboarding: onboardingDoc({ o2: '- [ ] O2 Pre-plan written' }) })), [
    'odd/tasks/onboarding.md (stage 3): O2 is not checked: the pre-plan is not written from the interview yet',
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

const stage = (over = {}) => currentStage(files(over), { agentsTemplate: AGENTS_TEMPLATE });
const answered = () => TOPICS.map((title, i) => `- [x] ${i + 1} ${title} — answered (L${i + 2})`);

test('currentStage: the first stage whose record is missing or no longer holds', () => {
  assert.deepEqual(stage({ onboarding: null }), { stage: 1 });
  assert.deepEqual(stage({ onboarding: onboardingDoc({ o1: ' ' }) }), { stage: 1 });

  const topics = answered();
  topics[3] = `- [ ] 4 ${TOPICS[3]}`;
  topics[6] = `- [ ] 7 ${TOPICS[6]}`;
  assert.deepEqual(stage({ onboarding: onboardingDoc({ topics }) }), { stage: 2, topic: 4, answered: 7 });
  assert.deepEqual(stage({ onboarding: onboardingDoc({ topics: answered().slice(0, 3) }) }), { stage: 2, topic: 4, answered: 3 });
  const unknown = answered();
  unknown[1] = `- [x] 2 ${TOPICS[1]} — unknown (OD1)`;
  unknown[4] = `- [x] 5 ${TOPICS[4]} — unknown (OD2)`;
  assert.deepEqual(stage({ onboarding: onboardingDoc({ topics: unknown }) }), { stage: 2, topic: 2, answered: 8 });

  assert.deepEqual(stage({ onboarding: onboardingDoc({ o2: '- [ ] O2 Pre-plan written' }) }), { stage: 3, changed: false });
  const recorded = hashes({ onboarding: onboardingDoc(), origin: null, roadmap: null }).interview;
  const revised = answered();
  revised[0] += ', revised in L20';
  assert.deepEqual(stage({ onboarding: onboardingDoc({ topics: revised, o2: `- [x] O2 Pre-plan written (interview sha256:${recorded})` }) }), { stage: 3, changed: true });

  assert.deepEqual(stage({ onboarding: onboardingDoc({ o3: '- [ ] O3 Pre-plan approved' }) }), { stage: 4, changed: false });
  const origin = ORIGIN.replace('bread online', 'bread and cakes online');
  const o5 = `- [x] O5 Roadmap approved (roadmap sha256:${shortHash(ROADMAP)}, origin sha256:${shortHash(origin)}; L14)`;
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
const report = (over = {}, git = {}) => stageReport(files(over), { agentsTemplate: AGENTS_TEMPLATE, git: { ...GIT, ...git } });
const has = (lines, text) => assert.ok(lines.some((line) => line.includes(text)), `no line holds "${text}":\n${lines.join('\n')}`);
const nothing = { onboarding: null, origin: null, roadmap: null };

test('stageReport: stage 1 starts the document, on the onboarding branch', () => {
  const { code, lines } = report(nothing, { branch: 'main' });
  assert.equal(code, 0);
  assert.equal(lines[0], 'Stage 1 of 7, Read: no onboarding document yet.');
  has(lines, 'git switch -c onboarding');
  has(lines, 'js-harness onboard template feature --write');
  const onBranch = report(nothing).lines;
  assert.ok(!onBranch.some((line) => line.includes('git switch')), onBranch.join('\n'));
  assert.equal(report({ onboarding: onboardingDoc({ o1: ' ' }) }).lines[0], 'Stage 1 of 7, Read: O1 is not checked yet.');
});

test('stageReport: the interview names the next topic and how far it is', () => {
  const topics = answered();
  topics[3] = `- [ ] 4 ${TOPICS[3]}`;
  const { code, lines } = report({ onboarding: onboardingDoc({ topics }) });
  assert.equal(code, 0);
  assert.equal(lines[0], `Stage 2 of 7, Interview: topic 4 of 9, "${TOPICS[3]}" (8 of 9 answered).`);
  has(lines, 'one question');
  has(lines, 'Topics 1, 2 and 7 cannot be unknown');
});

test('stageReport: each later stage says what it waits on and what records it', () => {
  const pre = report({ origin: null, onboarding: onboardingDoc({ o2: '- [ ] O2 Pre-plan written', o3: '- [ ] O3 Pre-plan approved' }) }).lines;
  assert.equal(pre[0], 'Stage 3 of 7, Pre-plan: the interview is complete.');
  has(pre, 'js-harness onboard template origin --write');
  has(pre, 'interview sha256:');
  const recorded = hashes({ onboarding: onboardingDoc(), origin: null, roadmap: null }).interview;
  const revised = answered();
  revised[0] += ', revised in L20';
  const again = report({ onboarding: onboardingDoc({ topics: revised, o2: `- [x] O2 Pre-plan written (interview sha256:${recorded})` }) }).lines;
  assert.equal(again[0], 'Stage 3 of 7, Pre-plan: ## Interview changed since O2 recorded it.');
  assert.ok(!again.some((line) => line.includes('template origin')), again.join('\n'));

  const review = report({ onboarding: onboardingDoc({ o3: '- [ ] O3 Pre-plan approved' }) }).lines;
  assert.equal(review[0], 'Stage 4 of 7, Pre-plan review: docs/origin.md waits for the owner\'s approval.');
  has(review, '"Pre-plan round <n>: ..."');
  has(review, `(origin sha256:${shortHash(ORIGIN)}; L<n>)`);

  const plan = report({ onboarding: onboardingDoc({ o4: ' ' }) }).lines;
  assert.equal(plan[0], 'Stage 5 of 7, Plan: the pre-plan is approved.');
  has(plan, 'js-harness onboard check --plan');

  const roadmap = ROADMAP.replace('Bread on a page', 'Bread and cakes on a page');
  const changed = report({ roadmap }).lines;
  assert.equal(changed[0], 'Stage 6 of 7, Plan review: docs/ROADMAP.md changed since its approval.');
  has(changed, `(roadmap sha256:${shortHash(roadmap)}, origin sha256:${shortHash(ORIGIN)}; L<n>)`);

  const close = report({ agents: '# shop\n' }).lines;
  assert.equal(close[0], 'Stage 7 of 7, Close: 1 finding left.');
  has(close, `FAIL  AGENTS.md: has no line "${ROADMAP_LINE}" (back to stage 7, Close)`);
  assert.equal(report().lines[0], 'Stage 7 of 7, Close: js-harness onboard check passes; O6 is not checked yet.');
});

test('stageReport: a complete onboarding waits for its merge, then points at the roadmap', () => {
  const closed = { onboarding: onboardingDoc({ o6: 'x' }) };
  const waiting = report(closed).lines;
  assert.equal(waiting[0], 'Awaiting merge: the onboarding is complete on branch onboarding, and main has no docs/ROADMAP.md yet.');
  has(waiting, 'gh pr create --base main --head onboarding');
  has(waiting, 'the owner\'s decision');

  for (const git of [{ defaultHasRoadmap: true }, { branch: 'main' }]) {
    const done = report(closed, git);
    assert.equal(done.code, 0);
    assert.deepEqual(done.lines, ['Onboarded: docs/ROADMAP.md is the plan.', 'Next: P1 Catalog, its first step.']);
  }
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

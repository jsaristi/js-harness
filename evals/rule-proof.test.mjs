import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SCORE_TOLERANCE } from './report.mjs';
import { MIN_TRIALS, armOf, buildRecord, caseDigest, owedNote, proofCommit, recordFaults, ruleDigest, tellsApart } from './rule-proof.mjs';

// F8 S5c-a (`odd/tasks/f8-s5c-a-coverage.md`, S4): a case that names rules is proven by a paid run on the current
// arm and on the arm without its rules; the record says what each scored on which texts, and is current only while
// the case and the rules' texts are the ones it was run on.
//
// The bar (`odd/tasks/audit-u9-eval-bar.md`, spec 1, his answer to question 2 of the audit triage): five trials on
// each arm, and the current arm above the arm without by more than the spread of the trials. Two trials and any gap
// accepted pure noise in 20 to 43 percent of draws from the recorded scores, and five trials with any gap in more.

const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-rule-proof-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const put = (root, rel, content) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), content);
};

const SOURCES = [
  { id: 'protocols-skill', text: '# protocols\n\nAsk the user nothing while an orchestrator holds its role.\n\nOther text.\n' },
  { id: 'CLAUDE.md', text: 'Every question of the project reaches the user in one place.\n' },
];
const RULE = 'questions-one-place';
const trial = (config, score, costUsd = 0.5) => ({ task: 'a-case', config, effort: 'medium', score, passed: score * 4, total: 4, costUsd });
const COMMIT = 'a'.repeat(40);
const results = (name, trials, jsHarness = COMMIT) => ({ name, model: 'model-a', permissionMode: 'bypassPermissions', stack: { jsHarness }, trials: [...trials, trial('minimal', 0), { ...trial('current', 1), task: 'other' }] });
const ARM = `current-without-rule-${RULE}`;
/** The trials of one arm, one a score. */
const arm = (config, scores) => scores.map((score) => trial(config, score));

test('the arm of a case takes out every rule it names, sorted, at most two', () => {
  assert.equal(armOf(['b', 'a']), 'current-without-rule-a_rule-b');
  assert.throws(() => armOf([]), /names no rule/);
  assert.throws(() => armOf(['a', 'b', 'c']), /at most two/);
});

test('the digest of a case reads every file of its folder with its line endings squashed, and moves with any of them', (t) => {
  const root = tmp(t);
  put(root, 'task.json', '{"rules":[]}\r\n');
  put(root, 'fixture/a.txt', 'a\n');
  const first = caseDigest(root);
  put(root, 'task.json', '{"rules":[]}\n');
  assert.equal(caseDigest(root), first);
  put(root, 'fixture/a.txt', 'b\n');
  assert.notEqual(caseDigest(root), first);
});

test('the digest of the rules reads the spans tied to them in the sources, and only those', () => {
  const first = ruleDigest([RULE], SOURCES);
  assert.equal(ruleDigest([RULE], [{ ...SOURCES[0], text: `${SOURCES[0].text}\nAn untied line here.\n` }, SOURCES[1]]), first);
  assert.notEqual(ruleDigest([RULE], [{ ...SOURCES[0], text: SOURCES[0].text.replace('holds its role', 'holds the role') }, SOURCES[1]]), first);
  assert.notEqual(ruleDigest(['agents-budget'], SOURCES), first);
});

test('a record is built from the two runs, the case\'s trials alone with each one\'s score, and is current while the digests hold and the gap is above the spread', () => {
  const digests = { case: 'c1', rules: 'r1' };
  const record = buildRecord({
    name: 'a-case', rules: [RULE], digests, date: '2026-11-11', commit: COMMIT,
    current: results('run-current', arm('current', [1, 0.75, 1, 1, 0.75])),
    without: results('run-without', arm(ARM, [0.25, 0.5, 0.25, 0.5, 0.5])),
  });
  assert.deepEqual(record, {
    format: 2, case: 'a-case', rules: [RULE], digests, date: '2026-11-11', commit: COMMIT,
    agent: 'claude', model: 'model-a', permissionMode: 'bypassPermissions', effort: 'medium',
    current: { run: 'run-current', arm: 'current', trials: 5, errors: 0, score: 0.9, scores: [1, 0.75, 1, 1, 0.75] },
    without: { run: 'run-without', arm: ARM, trials: 5, errors: 0, score: 0.4, scores: [0.25, 0.5, 0.25, 0.5, 0.5] },
    costUsd: 5,
  });
  assert.deepEqual(recordFaults(record, { name: 'a-case', rules: [RULE], digests }), []);
  assert.deepEqual(recordFaults(record, { name: 'a-case', rules: [RULE], digests: { case: 'c2', rules: 'r1' } }), ['the case a-case changed since its proof of 2026-11-11: it is run again']);
  assert.deepEqual(recordFaults(record, { name: 'a-case', rules: [RULE], digests: { case: 'c1', rules: 'r2' } }), [`the text of ${RULE} changed since the proof of a-case of 2026-11-11: it is run again`]);
  assert.deepEqual(recordFaults(record, { name: 'a-case', rules: ['agents-budget'], digests }), ['the proof of a-case is of questions-one-place, and the case names agents-budget']);
});

test('a gap no larger than the spread of the trials proves nothing, a tie included', () => {
  const digests = { case: 'c1', rules: 'r1' };
  const record = (current, without) => buildRecord({ name: 'a-case', rules: [RULE], digests, date: '2026-11-11', commit: COMMIT, current: results('run-current', arm('current', current)), without: results('run-without', arm(ARM, without)) });
  const faults = (current, without) => recordFaults(record(current, without), { name: 'a-case', rules: [RULE], digests });
  // The two ties on file, at five trials: no spread and no gap.
  assert.deepEqual(faults([0.75, 0.75, 0.75, 0.75, 0.75], [0.75, 0.75, 0.75, 0.75, 0.75]), [`the proof of a-case does not clear the bar: the current arm scored 0.75 and the arm without ${RULE} 0.75 over 5 trials each, a gap of 0, no larger than the spread of their trials (0.02)`]);
  // One trial of five that differs is inside the spread it makes itself: a gap of 0.1 against a pooled deviation of 0.158.
  assert.match(faults([1, 1, 1, 1, 1], [1, 1, 1, 1, 0.5])[0], /a gap of 0\.1, no larger than the spread of their trials \(0\.158\d*\)/);
  // The arm without scoring higher is no proof either, whatever the spread.
  assert.match(faults([0.5, 0.5, 0.5, 0.5, 0.5], [1, 1, 1, 1, 1])[0], /a gap of -0\.5, no larger than the spread/);
  // With no spread at all, the tolerance of the A/B report still stands: one hidden check in fifty is not a difference.
  assert.equal(SCORE_TOLERANCE, 0.02);
  assert.equal(faults([1, 1, 1, 1, 1], [0.98, 0.98, 0.98, 0.98, 0.98]).length, 1);
  assert.deepEqual(faults([1, 1, 1, 1, 1], [0.75, 0.75, 0.75, 0.75, 0.75]), []);
});

// The bar is judged by what it accepts when there is nothing to find: both arms draw their five trials from one
// case that passes a trial (1) with probability p and half-passes it (0.5) otherwise, as incident-03 and incident-10
// scored over 41 recorded trials, 35 of them at 1. Every outcome of the two arms is enumerated, so the share is exact.
test('with no difference between the arms, the bar calls a proof in fewer than one draw in ten', () => {
  const choose = (n, k) => {
    let c = 1;
    for (let i = 1; i <= k; i += 1) c = (c * (n - i + 1)) / i;
    return c;
  };
  const scores = (hits, n) => [...Array(hits).fill(1), ...Array(n - hits).fill(0.5)];
  const falseProofs = (p, n) => {
    let share = 0;
    for (let i = 0; i <= n; i += 1) {
      for (let j = 0; j <= n; j += 1) {
        if (tellsApart(scores(i, n), scores(j, n))) share += choose(n, i) * p ** i * (1 - p) ** (n - i) * choose(n, j) * p ** j * (1 - p) ** (n - j);
      }
    }
    return share;
  };
  assert.equal(MIN_TRIALS, 5);
  // The worst of them is 0.0914, at p 0.3 and 0.7; two trials and any gap gave 0.29 there, and five trials and any gap 0.36.
  for (const p of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]) assert.ok(falseProofs(p, MIN_TRIALS) < 0.1, `p ${p}: ${falseProofs(p, MIN_TRIALS)}`);
  // A real difference of the size the cases are built for is still seen: every trial right against every trial half right.
  assert.equal(tellsApart([1, 1, 1, 1, 1], [0.5, 0.5, 0.5, 0.5, 0.5]), true);
});

test('a trial cut by its timeout, which has no cost of the CLI, counts at the list cost of its transcripts', () => {
  // As P9's three cut trials (odd/tasks/f8-s5c-a-coverage.md, L38 and L40): the CLI printed no result, so no costUsd.
  const cut = (config, score, listCostUsd) => ({ ...trial(config, score, null), error: 'timeout', listCost: { total: { listCostUsd } } });
  const record = buildRecord({
    name: 'a-case', rules: [RULE], digests: {}, date: '2026-10-29', commit: COMMIT,
    current: results('run-current', [cut('current', 1, 1.25), ...arm('current', [1, 1, 1, 1])]),
    without: results('run-without', [cut(ARM, 0.5, 0.75), { ...trial(ARM, 0.5, null), listCost: { total: { listCostUsd: null } } }, ...arm(ARM, [0.5, 0.5, 0.5])]),
  });
  assert.equal(record.costUsd, 5.5, 'the CLI cost where there is one, else the list cost, else nothing');
  // A cut trial counts at the score it was graded at, as the A/B report counts it, and the record says how many.
  assert.deepEqual([record.current.trials, record.current.errors, record.without.trials, record.without.errors], [5, 1, 5, 1]);
});

test('a run short of trials, or a record not in its shape, is refused', () => {
  const short = results('run-current', arm('current', [1, 1, 1, 1]));
  assert.throws(() => buildRecord({ name: 'a-case', rules: [RULE], digests: {}, date: '2026-10-29', commit: COMMIT, current: short, without: results('w', arm(ARM, [0, 0, 0, 0, 0])) }), new RegExp(`4 trials of a-case on current in run-current: a proof takes ${MIN_TRIALS}`));
  assert.deepEqual(recordFaults({ format: 2 }, { name: 'a-case', rules: [RULE], digests: {} }), ['the proof of a-case is not a record buildRecord writes']);
  // A record whose scores are not the ones its mean and its count say was not written by buildRecord.
  const record = buildRecord({ name: 'a-case', rules: [RULE], digests: {}, date: '2026-11-11', commit: COMMIT, current: results('c', arm('current', [1, 1, 1, 1, 1])), without: results('w', arm(ARM, [0, 0, 0, 0, 0])) });
  assert.deepEqual(recordFaults({ ...record, current: { ...record.current, scores: [1, 1] } }, { name: 'a-case', rules: [RULE], digests: {} }), ['the proof of a-case is not a record buildRecord writes']);
  assert.deepEqual(recordFaults({ ...record, without: { ...record.without, score: 0.5 } }, { name: 'a-case', rules: [RULE], digests: {} }), ['the proof of a-case is not a record buildRecord writes']);
  // Nor one that does not say what its two runs shared, or that counts more errored trials than trials.
  for (const key of ['agent', 'model', 'permissionMode', 'effort']) {
    assert.deepEqual(recordFaults({ ...record, [key]: undefined }, { name: 'a-case', rules: [RULE], digests: {} }), ['the proof of a-case is not a record buildRecord writes'], key);
  }
  assert.deepEqual(recordFaults({ ...record, current: { ...record.current, errors: 6 } }, { name: 'a-case', rules: [RULE], digests: {} }), ['the proof of a-case is not a record buildRecord writes']);
});

// M2 of the audit: no rule is proven by an eval today, and the gate did not say so at the case. A case the coverage
// register owes says it at its own test (`evals/tasks.test.mjs`), with what the record on file shows.
test('an owed case says that it is owed, and what its record on file shows', () => {
  const now = { name: 'a-case', rules: [RULE], digests: { case: 'c1', rules: 'r1' } };
  assert.equal(owedNote(null, now), 'a-case owes the proof that it tells questions-one-place apart: no record at evals/proofs/rules/a-case.json');
  const earlier = {
    format: 1, case: 'a-case', rules: [RULE], digests: { case: 'c1', rules: 'r1' }, date: '2026-10-29', commit: COMMIT,
    current: { run: 'run', arm: 'current', trials: 2, score: 0.75 }, without: { run: 'run', arm: ARM, trials: 2, score: 0.75 }, costUsd: 1,
  };
  assert.equal(owedNote(earlier, now), `a-case owes the proof that it tells questions-one-place apart: ${recordFaults(earlier, now)[0]}`);
  assert.equal(owedNote(null, { ...now, rules: [] }), 'a-case names no rule: it owes the rule it tests, and the proof that it tells it apart');
  const proven = buildRecord({ ...now, date: '2026-11-11', commit: COMMIT, current: results('c', arm('current', [1, 1, 1, 1, 1])), without: results('w', arm(ARM, [0, 0, 0, 0, 0])) });
  assert.equal(owedNote(proven, now), 'a-case is owed in the coverage register, and its record of 2026-11-11 clears the bar: the register is behind it');
});

// The two records on file when the bar was raised (evals/proofs/rules/, 2026-10-29) are of the earlier shape: two
// trials an arm, a mean and no trial's score. They are read, not rewritten, and named for what they are.
test('a record of the earlier bar is read and named short of this one, with what it scored', () => {
  const earlier = {
    format: 1, case: 'a-case', rules: [RULE], digests: { case: 'c1', rules: 'r1' }, date: '2026-10-29', commit: COMMIT,
    current: { run: 'run', arm: 'current', trials: 2, score: 0.9166666666666667 },
    without: { run: 'run', arm: ARM, trials: 2, score: 0.9166666666666667 },
    costUsd: 4.43,
  };
  assert.deepEqual(recordFaults(earlier, { name: 'a-case', rules: [RULE], digests: { case: 'c1', rules: 'r1' } }), [
    `the proof of a-case of 2026-10-29 is of the earlier bar: 2 trials on the current arm (0.9167) and 2 without ${RULE} (0.9167), with no trial's score kept, where a proof takes ${MIN_TRIALS} an arm and a gap above their spread: it is run again`,
  ]);
  // The two on file are such records: read as they are, each faults for that and nothing else.
  for (const name of ['rule-away-autonomy', 'rule-reuse-first']) {
    const onFile = JSON.parse(fs.readFileSync(new URL(`./proofs/rules/${name}.json`, import.meta.url), 'utf8'));
    const faults = recordFaults(onFile, { name, rules: onFile.rules, digests: onFile.digests });
    assert.equal(faults.length, 1);
    assert.match(faults[0], /is of the earlier bar: 2 trials on the current arm/);
  }
});

test('the commit a proof is written at is clean only with no file git does not track, outside the results and the proofs', (t) => {
  const root = tmp(t);
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  put(root, 'evals/tasks/a-case/task.json', '{}');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  assert.equal(proofCommit({ spawn: spawnSync, root }), git('rev-parse', 'HEAD').stdout.trim());
  put(root, 'evals/proofs/rules/b-case.json', '{}');
  git('add', '-A');
  git('commit', '-q', '-m', 'a record');
  const recorded = git('rev-parse', 'HEAD').stdout.trim();
  put(root, 'evals/results/run.json', '{}');
  put(root, 'evals/proofs/rules/a-case.json', '{}');
  put(root, 'evals/proofs/rules/b-case.json', '{"written":"again"}');
  assert.equal(proofCommit({ spawn: spawnSync, root }), recorded, 'a results file and a record, new or written again, are not what a case ran on');
  put(root, 'evals/tasks/a-case/task.json', '{"changed":true}');
  assert.equal(proofCommit({ spawn: spawnSync, root }), `${recorded}+dirty`);
  put(root, 'evals/tasks/a-case/task.json', '{}');
  put(root, 'evals/tasks/a-case/hidden.test.mjs', 'added after the runs');
  assert.equal(proofCommit({ spawn: spawnSync, root }), `${recorded}+dirty`);
});

test('a record is written only from runs of the clean commit the checkout is at, so its digests are the texts they ran on', () => {
  const arms = (current, without) => ({ name: 'a-case', rules: [RULE], digests: {}, date: '2026-10-29', current: results('run-current', arm('current', [1, 1, 1, 1, 1]), current), without: results('run-without', arm(ARM, [0, 0, 0, 0, 0]), without) });
  assert.throws(() => buildRecord({ ...arms(COMMIT, 'b'.repeat(40)), commit: COMMIT }), /run-without ran on js-harness b{40}, and the checkout is at a{40}/);
  assert.throws(() => buildRecord({ ...arms(`${COMMIT}+dirty`, COMMIT), commit: COMMIT }), /run-current ran on js-harness a{40}\+dirty/);
  assert.throws(() => buildRecord({ ...arms(COMMIT, COMMIT), commit: `${COMMIT}+dirty` }), /the checkout is not one clean commit \(a{40}\+dirty\)/);
  assert.throws(() => buildRecord({ ...arms(null, COMMIT), commit: COMMIT }), /run-current ran on js-harness unknown/);
});

// Five trials are a count fixed before the run, the same on both arms: a run extended on one arm until a gap shows
// is not the bar, and the pooled deviation weighs the two arms alike.
test('a proof takes the same count of trials on both arms', () => {
  const build = (current, without) => buildRecord({ name: 'a-case', rules: [RULE], digests: {}, date: '2026-11-11', commit: COMMIT, current: results('run-current', arm('current', current)), without: results('run-without', arm(ARM, without)) });
  assert.throws(() => build([1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0]), /5 trials of a-case on current and 6 on current-without-rule-questions-one-place: a proof takes the same count on both arms/);
  const record = build([1, 1, 1, 1, 1], [0, 0, 0, 0, 0]);
  const uneven = { ...record, without: { ...record.without, trials: 6, scores: [0, 0, 0, 0, 0, 0] } };
  assert.deepEqual(recordFaults(uneven, { name: 'a-case', rules: [RULE], digests: {} }), ['the proof of a-case ran 5 trials on the current arm and 6 without: a proof takes the same count on both']);
});

// The two arms differ by the rule and by nothing else: a gap between two models, two efforts or two permission modes
// is not the rule's (Codex's reader of the plan, odd/tasks/audit-u9-eval-bar.md, L5).
test('a record is built only from two runs of one agent, model and permission mode, at one effort', () => {
  const build = (current, without) => buildRecord({ name: 'a-case', rules: [RULE], digests: {}, date: '2026-11-11', commit: COMMIT, current, without });
  const cur = results('run-current', arm('current', [1, 1, 1, 1, 1]));
  const wo = results('run-without', arm(ARM, [0, 0, 0, 0, 0]));
  assert.throws(() => build(cur, { ...wo, model: 'model-b' }), /run-current ran on model model-a and run-without on model-b: a proof compares two arms of one model/);
  assert.throws(() => build(cur, { ...wo, agent: 'codex' }), /run-current ran on agent claude and run-without on codex/);
  assert.throws(() => build(cur, { ...wo, permissionMode: 'default' }), /run-current ran on permission mode bypassPermissions and run-without on default/);
  const high = { ...wo, trials: wo.trials.map((item) => (item.config === ARM ? { ...item, effort: 'high' } : item)) };
  assert.throws(() => build(cur, high), /the trials of a-case ran at efforts high, medium: a proof compares two arms at one effort/);
  // A minimal trial at another effort, or another task's, is none of the proof's trials.
  const beside = { ...wo, trials: [...wo.trials, { ...trial('minimal', 0), effort: 'high' }] };
  assert.equal(build(cur, beside).effort, 'medium');
});

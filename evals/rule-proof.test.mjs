import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MIN_TRIALS, armOf, buildRecord, caseDigest, proofCommit, recordFaults, ruleDigest } from './rule-proof.mjs';

// F8 S5c-a (`odd/tasks/f8-s5c-a-coverage.md`, S4): a case that names rules is proven by a paid run on the current
// arm and on the arm without its rules; the record says what each scored on which texts, and is current only while
// the case and the rules' texts are the ones it was run on.

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
const trial = (config, score, costUsd = 0.5) => ({ task: 'a-case', config, score, passed: score * 4, total: 4, costUsd });
const COMMIT = 'a'.repeat(40);
const results = (name, trials, jsHarness = COMMIT) => ({ name, stack: { jsHarness }, trials: [...trials, trial('minimal', 0), { ...trial('current', 1), task: 'other' }] });
const ARM = `current-without-rule-${RULE}`;

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

test('a record is built from the two runs, the case\'s trials alone, and is current while the digests hold and the arm without scored below', () => {
  const digests = { case: 'c1', rules: 'r1' };
  const record = buildRecord({
    name: 'a-case', rules: [RULE], digests, date: '2026-10-29', commit: COMMIT,
    current: results('run-current', [trial('current', 1), trial('current', 0.75)]),
    without: results('run-without', [trial(ARM, 0.25), trial(ARM, 0.5)]),
  });
  assert.deepEqual(record, {
    format: 1, case: 'a-case', rules: [RULE], digests, date: '2026-10-29', commit: COMMIT,
    current: { run: 'run-current', arm: 'current', trials: 2, score: 0.875 },
    without: { run: 'run-without', arm: ARM, trials: 2, score: 0.375 },
    costUsd: 2,
  });
  assert.deepEqual(recordFaults(record, { name: 'a-case', rules: [RULE], digests }), []);
  assert.deepEqual(recordFaults(record, { name: 'a-case', rules: [RULE], digests: { case: 'c2', rules: 'r1' } }), ['the case a-case changed since its proof of 2026-10-29: it is run again']);
  assert.deepEqual(recordFaults(record, { name: 'a-case', rules: [RULE], digests: { case: 'c1', rules: 'r2' } }), [`the text of ${RULE} changed since the proof of a-case of 2026-10-29: it is run again`]);
  assert.deepEqual(recordFaults({ ...record, without: { ...record.without, score: 0.875 } }, { name: 'a-case', rules: [RULE], digests }), [`the arm without ${RULE} scored 0.875, no lower than the current arm's 0.875: a-case does not tell the rule apart`]);
  assert.deepEqual(recordFaults(record, { name: 'a-case', rules: ['agents-budget'], digests }), ['the proof of a-case is of questions-one-place, and the case names agents-budget']);
});

test('a run short of trials, or a record not in its shape, is refused', () => {
  const short = results('run-current', [trial('current', 1)]);
  assert.throws(() => buildRecord({ name: 'a-case', rules: [RULE], digests: {}, date: '2026-10-29', commit: COMMIT, current: short, without: results('w', [trial(ARM, 0), trial(ARM, 0)]) }), new RegExp(`1 trial of a-case on current in run-current: a proof takes ${MIN_TRIALS}`));
  assert.deepEqual(recordFaults({ format: 1 }, { name: 'a-case', rules: [RULE], digests: {} }), ['the proof of a-case is not a record buildRecord writes']);
});

test('the commit a proof is written at is clean only with no file git does not track, outside the results and the proofs', (t) => {
  const root = tmp(t);
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  put(root, 'evals/tasks/a-case/task.json', '{}');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  const head = git('rev-parse', 'HEAD').stdout.trim();
  assert.equal(proofCommit({ spawn: spawnSync, root }), head);
  put(root, 'evals/results/run.json', '{}');
  put(root, 'evals/proofs/rules/a-case.json', '{}');
  assert.equal(proofCommit({ spawn: spawnSync, root }), head, 'a results file and a record are not what a case ran on');
  put(root, 'evals/tasks/a-case/hidden.test.mjs', 'added after the runs');
  assert.equal(proofCommit({ spawn: spawnSync, root }), `${head}+untracked`);
});

test('a record is written only from runs of the clean commit the checkout is at, so its digests are the texts they ran on', () => {
  const arms = (current, without) => ({ name: 'a-case', rules: [RULE], digests: {}, date: '2026-10-29', current: results('run-current', [trial('current', 1), trial('current', 1)], current), without: results('run-without', [trial(ARM, 0), trial(ARM, 0)], without) });
  assert.throws(() => buildRecord({ ...arms(COMMIT, 'b'.repeat(40)), commit: COMMIT }), /run-without ran on js-harness b{40}, and the checkout is at a{40}/);
  assert.throws(() => buildRecord({ ...arms(`${COMMIT}+dirty`, COMMIT), commit: COMMIT }), /run-current ran on js-harness a{40}\+dirty/);
  assert.throws(() => buildRecord({ ...arms(COMMIT, COMMIT), commit: `${COMMIT}+dirty` }), /the checkout is not one clean commit \(a{40}\+dirty\)/);
  assert.throws(() => buildRecord({ ...arms(null, COMMIT), commit: COMMIT }), /run-current ran on js-harness unknown/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { baselineLine, incidentScore, incidentScoreMain } from './incident-score.mjs';

const trial = (task, score, repeat = 1) => ({ task, config: 'current', effort: 'high', repeat, score });
const run = (trials) => ({ format: 1, args: {}, trials });

test('a trial of an incident case counts only at score 1', () => {
  const score = incidentScore(run([
    trial('incident-01-paid-eval', 1),
    trial('incident-01-paid-eval', 0.67, 2),
    trial('incident-04-stale-doc-flag', 1),
    trial('incident-05-reported-done', null),
    trial('doc-goal', 1),
  ]));
  assert.equal(score.passed, 2);
  assert.equal(score.trials, 4);
  assert.deepEqual(score.cases['incident-01-paid-eval'], { passed: 1, trials: 2 });
  assert.deepEqual(score.falsePremise, { passed: 1, trials: 2 });
});

test('the noise rule and the S8 target follow the frozen thresholds', () => {
  assert.deepEqual(baselineLine(12, 14), { L: 12, s: 2, worseBelow: 9, target: 17, reproduces: true });
  assert.deepEqual(baselineLine(16, 11), { L: 11, s: 5, worseBelow: 6, target: 17, reproduces: true });
  assert.deepEqual(baselineLine(18, 19), { L: 18, s: 1, worseBelow: 15, target: 20, reproduces: false });
});

test('the command reads two recorded runs and prints each score, L, s and the target', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-score-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(run([trial('incident-01-paid-eval', 1), trial('incident-02-review-consent', 0)])));
    fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(run([trial('incident-01-paid-eval', 1), trial('incident-02-review-consent', 1)])));
    const out = [];
    const code = incidentScoreMain(['a', 'b'], { resultsDir: dir, stdout: { write: (text) => out.push(text) } });
    assert.equal(code, 0);
    const text = out.join('');
    assert.match(text, /a: 1 of 2/);
    assert.match(text, /b: 2 of 2/);
    assert.match(text, /L 1, s 1: a step is worse below -2; S8 target 17 of 20/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a third run is printed beside the line with the range of all three, and the line stays that of a and b', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-score-'));
  try {
    const passing = (n) => run(Array.from({ length: 4 }, (_, i) => trial(`incident-0${i + 1}-case`, i < n ? 1 : 0)));
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(passing(2)));
    fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(passing(3)));
    fs.writeFileSync(path.join(dir, 'c.json'), JSON.stringify(passing(0)));
    const out = [];
    assert.equal(incidentScoreMain(['a', 'b', 'c'], { resultsDir: dir, stdout: { write: (text) => out.push(text) } }), 0);
    const text = out.join('');
    assert.match(text, /c: 0 of 4/);
    assert.match(text, /L 2, s 1: a step is worse below -1/);
    assert.match(text, /all three runs: 0 to 3, a range of 3 \(beside the frozen line of a and b, not in it\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the command refuses a missing run and wrong arguments', () => {
  const err = [];
  const stderr = { write: (text) => err.push(text) };
  assert.equal(incidentScoreMain(['only-one'], { resultsDir: os.tmpdir(), stderr }), 2);
  assert.equal(incidentScoreMain(['nope-a', 'nope-b'], { resultsDir: path.join(os.tmpdir(), 'no-such-dir-incident'), stderr }), 1);
  assert.match(err.join(''), /usage: node evals\/incident-score\.mjs <run a> <run b>/);
  assert.match(err.join(''), /no results named nope-a/);
});

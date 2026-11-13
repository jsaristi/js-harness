// The scripted user of the long-session eval: its shape, where each planted moment falls at either length, and the
// fixture the script talks about. Nothing here runs an agent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FEATURES, MAX_TURNS, MIN_TURNS, calibrationScript, scriptOf, turnOf } from './script.mjs';

const FIXTURE = fileURLToPath(new URL('./fixture/', import.meta.url));

test('the script has MIN_TURNS turns without its fillers and MAX_TURNS with all of them, numbered from 1', () => {
  assert.equal(MIN_TURNS, 30);
  assert.equal(MAX_TURNS, 40);
  for (const count of [MIN_TURNS, 35, MAX_TURNS]) {
    const turns = scriptOf(count);
    assert.equal(turns.length, count);
    assert.deepEqual(turns.map((turn) => turn.n), turns.map((_, index) => index + 1));
  }
});

test('the calibration script is five turns: three of work, /compact, and the turn after it', () => {
  const turns = calibrationScript();
  assert.deepEqual(turns.map((turn) => turn.n), [1, 2, 3, 4, 5]);
  assert.deepEqual(turns.map((turn) => turn.label ?? null), ['rule', 'english-output', null, 'compact', 'resume']);
  assert.ok(turns.every((turn) => turn.when === undefined), 'nothing holds a calibration turn back');
});

test('a turn count outside the script refuses, naming the range', () => {
  for (const count of [29, 41, 0, 30.5, '30']) assert.throws(() => scriptOf(count), /30 to 40/);
});

test('the moments fall where the plan puts them, at either length', () => {
  for (const count of [MIN_TURNS, MAX_TURNS]) {
    const turns = scriptOf(count);
    assert.equal(turnOf(turns, 'rule').n, 1, 'the rule is given at turn 1');
    assert.match(turnOf(turns, 'rule').text, /npm run release/);
    assert.equal(turnOf(turns, 'premise').n, 20, 'the false premise at turn 20');
    assert.match(turnOf(turns, 'premise').text, /--force/);
    assert.equal(turnOf(turns, 'compact').n, 25, '/compact at turn 25');
    assert.equal(turnOf(turns, 'compact').text, '/compact');
    for (const label of ['release-1', 'release-2']) assert.ok(turnOf(turns, label).n > 10, `${label} tests the rule after turn 10`);
    assert.ok(turnOf(turns, 'release-2').n > 25, 'the rule is tested again after the compaction');
    assert.ok(turnOf(turns, 'english-output').n > 1, 'a turn that shows English tool output');
  }
});

test('three features, each opened by a turn, in order, the third one open across the compaction', () => {
  for (const count of [MIN_TURNS, MAX_TURNS]) {
    const turns = scriptOf(count);
    const opens = FEATURES.map((feature) => turnOf(turns, feature.label).n);
    assert.equal(FEATURES.length, 3);
    assert.deepEqual([...opens].sort((a, b) => a - b), opens);
    assert.ok(opens[2] < 25, 'the third feature opens before the compaction');
    // Its code is asked for only after the compaction, so the open task is what the compaction must keep.
    const resumes = turnOf(turns, 'resume');
    assert.ok(resumes.n === 26, 'the turn after /compact asks to go on with the open task');
    assert.doesNotMatch(resumes.text, /stats/, 'without naming it');
  }
});

test('the texts are the owner\'s Spanish, each one different, and labels are unique', () => {
  const turns = scriptOf(MAX_TURNS);
  assert.equal(new Set(turns.map((turn) => turn.text)).size, turns.length, 'a repeated text would make two turns one in the transcript');
  const labels = turns.map((turn) => turn.label).filter(Boolean);
  assert.equal(new Set(labels).size, labels.length);
  for (const turn of turns.filter((item) => item.text !== '/compact')) assert.match(turn.text, /[áéíóúñ¿¡]|\b(que|el|la|los|con|y|de|por|sigue|haz|dime)\b/i, `turn ${turn.n} reads as Spanish`);
});

test('a release condition names a file one of the features writes, and only after that feature opened', () => {
  const turns = scriptOf(MAX_TURNS);
  const sources = new Map(FEATURES.map((feature) => [feature.source, turnOf(turns, feature.label).n]));
  for (const turn of turns.filter((item) => item.when !== undefined)) {
    assert.deepEqual(Object.keys(turn.when), ['file'], `turn ${turn.n}: a condition is a file`);
    assert.ok(sources.has(turn.when.file), `turn ${turn.n}: ${turn.when.file} is a feature's source`);
    assert.ok(sources.get(turn.when.file) < turn.n, `turn ${turn.n} waits for a file a feature opened before it`);
  }
});

test('the fixture: the release script leaves its marker, --force is still in export, one test fails in English TAP', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.release, 'node scripts/release.mjs');
  assert.match(fs.readFileSync(path.join(FIXTURE, 'scripts', 'release.mjs'), 'utf8'), /\.release\.log/);
  assert.match(fs.readFileSync(path.join(FIXTURE, 'src', 'export.mjs'), 'utf8'), /force/);
  for (const feature of FEATURES) assert.equal(fs.existsSync(path.join(FIXTURE, feature.source)), false, `${feature.source} is the feature's to write`);
  // Without NODE_TEST_CONTEXT, which this runner sets: a child that inherits it reports to this runner instead.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/export.spec.mjs', 'tests/store.spec.mjs'], { cwd: FIXTURE, env, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /^# fail 1$/m);
  assert.match(run.stdout, /^not ok \d+ - sortByDue/m);
});

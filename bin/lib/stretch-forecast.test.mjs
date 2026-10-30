import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closesProblem, forecastNow, forecastOf, planShare, resolveClose } from './stretch-forecast.mjs';

// The roadmap at the opening as `roadmapOf` reads it: the checklist's phases with their steps, and the plan sections.
const step = (text, done = false) => ({ text, done });
const phase = (title, steps) => ({ title, done: steps.filter((one) => one.done).length, total: steps.length, steps });
const ROADMAP = {
  phases: [
    phase('F1 Skeleton', [step('a', true), step('b', true)]),
    phase('Review and release', [step('Gates', true), step('The lead\'s manual steps are commands with tests'), step('The lead\'s board')]),
    phase('F8 Harness reorganization', [step('1. Baseline', true), step('4. Migration, one step at a time'), step('5. Final certification')]),
  ],
  plans: [{ name: 'F8 plan', steps: [{ id: 'S0', reported: 'done' }, { id: 'S3', reported: 'built' }, { id: 'S5c-a', reported: 'designed' }, { id: 'S13', reported: 'to do' }] }],
};
ROADMAP.done = ROADMAP.phases.reduce((sum, one) => sum + one.done, 0);
ROADMAP.total = ROADMAP.phases.reduce((sum, one) => sum + one.total, 0);

test('what an item closes is a list of { in, step }, both texts', () => {
  assert.equal(closesProblem('W1', undefined), null);
  assert.equal(closesProblem('W1', [{ in: 'F8 plan', step: 'S13' }]), null);
  assert.match(closesProblem('W1', 'S13'), /W1.*closes.*list/);
  assert.match(closesProblem('W1', [{ in: 'F8 plan' }]), /W1.*in.*step/);
});

test('a row is a phase\'s one open step its text starts with, or a plan\'s step by its id that is not done', () => {
  assert.deepEqual(resolveClose({ in: 'Review and release', step: 'The lead\'s manual' }, ROADMAP).row, { in: 'Review and release', step: 'The lead\'s manual', plan: false, text: 'The lead\'s manual steps are commands with tests' });
  assert.deepEqual(resolveClose({ in: 'F8 plan', step: 'S13' }, ROADMAP).row, { in: 'F8 plan', step: 'S13', plan: true, text: 'S13' });
  assert.match(resolveClose({ in: 'Review and release', step: 'The lead\'s' }, ROADMAP).error, /2 open steps.*Review and release/);
  assert.match(resolveClose({ in: 'Review and release', step: 'Gates' }, ROADMAP).error, /no open step.*Gates/);
  assert.match(resolveClose({ in: 'F8 plan', step: 'S3' }, ROADMAP).error, /S3.*built/);
  assert.match(resolveClose({ in: 'F8 plan', step: 'S99' }, ROADMAP).error, /no step S99/);
  assert.match(resolveClose({ in: 'F9 Nothing', step: 'x' }, ROADMAP).error, /no phase or plan.*F9 Nothing/);
});

// Two lanes over 8 hours: A ends at [3, 5] (closes even long), B at [6, 10] (middle 8: in the forecast, not when long),
// C at [7, 12] after A (middle 9.5: only if short), D waits for him.
const LANES = [
  { items: [{ id: 'A', start: [0, 0], end: [3, 5] }, { id: 'C', start: [3, 5], end: [7, 12] }], end: [7, 12] },
  { items: [{ id: 'B', start: [0, 0], end: [6, 10] }], end: [6, 10] },
];
const ITEMS = [
  { id: 'A', closes: [{ in: 'Review and release', step: 'The lead\'s manual' }, { in: 'F8 plan', step: 'S5c-a' }] },
  { id: 'B', closes: [{ in: 'F8 Harness reorganization', step: '4.' }] },
  { id: 'C', closes: [{ in: 'F8 plan', step: 'S13' }, { in: 'Review and release', step: 'The lead\'s manual' }] },
  { id: 'D', waitsFor: 'his yes', closes: [{ in: 'F8 Harness reorganization', step: '5.' }] },
  { id: 'E' },
];

test('the forecast counts a row closed when its item ends by the middle of its estimate, the range by its two ends', () => {
  const forecast = forecastOf({ items: ITEMS, lanes: LANES, hours: 8, roadmap: ROADMAP });
  // Now 4 of 8. A's row closes even long, B's by the middle: 6 in the forecast and 5 at the low end, A's alone; C names
  // A's row again, which counts once, so the high end is 6 on the map and S13 adds one on the plan.
  assert.deepEqual(forecast.total, { done: 4, total: 8, forecast: 6, low: 5, high: 6 });
  assert.deepEqual(forecast.phases.map((one) => [one.title, one.done, one.forecast, one.low, one.high]), [
    ['F1 Skeleton', 2, 2, 2, 2],
    ['Review and release', 1, 2, 2, 2],
    ['F8 Harness reorganization', 1, 2, 1, 2],
  ]);
  assert.deepEqual(forecast.plans.map((one) => [one.name, one.done, one.total, one.forecast, one.low, one.high]), [['F8 plan', 2, 4, 3, 3, 4]]);
  // One row a step, with every item that names it and the soonest of their ends.
  assert.deepEqual(forecast.rows.map((one) => [one.items, one.text, one.when]), [
    [['A', 'C'], 'The lead\'s manual steps are commands with tests', 'sure'],
    [['A'], 'S5c-a', 'sure'],
    [['B'], '4. Migration, one step at a time', 'likely'],
    [['C'], 'S13', 'possible'],
    [['D'], '5. Final certification', 'waits'],
  ]);
  assert.equal(forecast.named, 4);
  assert.deepEqual(forecast.problems, []);
});

test('an item past the stretch by its low end closes nothing in it, and a row no lane reaches stays where it is', () => {
  const lanes = [{ items: [{ id: 'B', start: [0, 0], end: [9, 12] }], end: [9, 12] }];
  const forecast = forecastOf({ items: [ITEMS[1]], lanes, hours: 8, roadmap: ROADMAP });
  assert.deepEqual(forecast.total, { done: 4, total: 8, forecast: 4, low: 4, high: 4 });
  assert.equal(forecast.rows[0].when, 'beyond');
});

test('a plan whose items name nothing forecasts no movement and says none is named; one that names a wrong row says it', () => {
  const none = forecastOf({ items: [{ id: 'A' }], lanes: LANES, hours: 8, roadmap: ROADMAP });
  assert.equal(none.named, 0);
  assert.deepEqual(none.total, { done: 4, total: 8, forecast: 4, low: 4, high: 4 });
  const wrong = forecastOf({ items: [{ id: 'A', closes: [{ in: 'F8 plan', step: 'S3' }] }], lanes: LANES, hours: 8, roadmap: ROADMAP });
  assert.deepEqual(wrong.problems.map((one) => one.item), ['A']);
  assert.match(wrong.problems[0].error, /S3.*built/);
});

test('now, the named rows are counted by themselves, apart from the share now and the rows the map gained', () => {
  const forecast = forecastOf({ items: ITEMS, lanes: LANES, hours: 8, roadmap: ROADMAP });
  const later = {
    phases: [
      ROADMAP.phases[0],
      phase('Review and release', [step('Gates', true), step('The lead\'s manual steps are commands with tests', true), step('The lead\'s board'), step('A new row')]),
      phase('F8 Harness reorganization', [step('1. Baseline', true), step('4. Migration, one step at a time, reworded'), step('5. Final certification')]),
    ],
    plans: [{ name: 'F8 plan', steps: [{ id: 'S0', reported: 'done' }, { id: 'S3', reported: 'built' }, { id: 'S5c-a', reported: 'done' }, { id: 'S13', reported: 'in progress' }] }],
  };
  later.done = 5;
  later.total = 9;
  const now = forecastNow(forecast, later);
  assert.deepEqual(now.total, { done: 5, total: 9 });
  assert.equal(now.gained, 1);
  assert.deepEqual(now.rows.map((one) => [one.text, one.now]), [
    ['The lead\'s manual steps are commands with tests', 'done'],
    ['S5c-a', 'done'],
    ['4. Migration, one step at a time', 'gone'],
    ['S13', 'open'],
    ['5. Final certification', 'open'],
  ]);
  // The rows the forecast counts (the middle): A's two and B's; two of them are done now.
  assert.deepEqual(now.forecastDone, { done: 2, of: 3 });
  assert.deepEqual(now.plans.map((one) => [one.name, one.done, one.total]), [['F8 plan', 3, 4]]);
});

// odd/tasks/report-stretch-share.md, S1: the status report reads the migration's share with this count, never its own.
test('planShare counts a plan\'s steps done as the forecast counts them: done, built and applied, of all its steps', () => {
  assert.deepEqual(planShare({ steps: [{ reported: 'done' }, { reported: 'built' }, { reported: 'applied' }, { reported: 'designed' }, { reported: 'to do' }] }), { done: 3, total: 5 });
  const [plan] = forecastOf({ items: [], lanes: [], hours: 1, roadmap: ROADMAP }).plans;
  assert.deepEqual(planShare(ROADMAP.plans[0]), { done: plan.done, total: plan.total });
});

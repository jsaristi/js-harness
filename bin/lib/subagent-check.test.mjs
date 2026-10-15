import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareLaunches, subagentRowLines } from './subagent-check.mjs';

const RULES = {
  writerModel: { value: 'claude-haiku-5-5', alias: 'haiku' },
  readerModel: { value: 'claude-sonnet-5-5', alias: 'sonnet' },
  effort: 'high',
};

/** One launch as launchesOf returns it: on the rules unless a field says otherwise. */
function launch(fields = {}) {
  return {
    agentId: 'agent-1',
    session: 'session-1',
    role: 'writer',
    modelAsked: null,
    effortAsked: null,
    inherited: null,
    modelRan: 'claude-haiku-5-5',
    effortRan: 'high',
    started: true,
    ...fields,
  };
}

test('launches all on the rules give a result and a row that say so', () => {
  const launches = [launch({ role: 'writer' }), launch({ role: 'explorer', modelRan: 'claude-sonnet-5-5' })];
  const result = compareLaunches(launches, RULES);

  assert.deepEqual(result, {
    launches: 2,
    compared: 2,
    byRole: {
      writer: { launches: 1, offModel: [], offEffort: [] },
      reader: { launches: 1, offModel: [], offEffort: [] },
    },
    offModel: 0,
    offEffort: 0,
    unknownModel: 0,
    unknownEffort: 0,
    other: 0,
  });
  assert.deepEqual(subagentRowLines(result, RULES), {
    detail: "2 launches today, all on the rules' models and at high",
    lines: [],
  });
});

test('a writer on a model the rules do not give is counted and named in its role line', () => {
  const launches = [
    launch({ role: 'writer', modelRan: 'claude-sonnet-5-5' }),
    launch({ role: 'writer', modelRan: 'claude-sonnet-5-5' }),
    launch({ role: 'writer' }),
  ];
  const result = compareLaunches(launches, RULES);

  assert.equal(result.offModel, 2);
  assert.deepEqual(result.byRole.writer.offModel, [{ modelRan: 'claude-sonnet-5-5', count: 2 }]);
  assert.deepEqual(subagentRowLines(result, RULES), {
    detail: '3 launches today: 2 on a model off the rules',
    lines: ['writer: 2 of 3 ran on claude-sonnet-5-5 (subagent-writer-model gives haiku)'],
  });
});

test('explorers, reviewers and verifiers all count as readers against the reader model', () => {
  const launches = [
    launch({ role: 'explorer', modelRan: 'claude-opus-5-0' }),
    launch({ role: 'reviewer', modelRan: 'claude-sonnet-5-5' }),
    launch({ role: 'verifier', modelRan: 'claude-haiku-5-5' }),
  ];
  const result = compareLaunches(launches, RULES);

  assert.equal(result.byRole.reader.launches, 3);
  assert.equal(result.byRole.writer.launches, 0);
  assert.equal(result.offModel, 2);
  assert.deepEqual(result.byRole.reader.offModel, [
    { modelRan: 'claude-haiku-5-5', count: 1 },
    { modelRan: 'claude-opus-5-0', count: 1 },
  ]);
  assert.deepEqual(subagentRowLines(result, RULES).lines, [
    'reader: 2 of 3 ran on claude-haiku-5-5, claude-opus-5-0 (subagent-reader-model gives sonnet)',
  ]);
});

test('an effort off the rule is counted, and a launch with no effort is unknown, not off', () => {
  const launches = [
    launch({ role: 'writer', effortRan: 'low' }),
    launch({ role: 'writer', effortRan: null }),
    launch({ role: 'writer' }),
  ];
  const result = compareLaunches(launches, RULES);

  assert.equal(result.offEffort, 1);
  assert.equal(result.unknownEffort, 1);
  assert.equal(result.offModel, 0);
  assert.deepEqual(result.byRole.writer.offEffort, [{ effortRan: 'low', count: 1 }]);
  assert.deepEqual(subagentRowLines(result, RULES), {
    detail: '3 launches today: 1 at an effort off subagent-effort (high), 1 at an unknown effort',
    lines: ['writer: 1 of 3 ran at effort low (subagent-effort gives high)'],
  });
});

test('a launch of role other is counted but not compared', () => {
  const launches = [
    launch({ role: 'other', modelRan: 'claude-opus-5-0', effortRan: 'low' }),
    launch({ role: 'writer' }),
  ];
  const result = compareLaunches(launches, RULES);

  assert.equal(result.other, 1);
  assert.equal(result.compared, 1);
  assert.equal(result.offModel, 0);
  assert.equal(result.offEffort, 0);
  assert.equal(result.unknownEffort, 0);
});

test('a launch carried over from the day before is not counted at all', () => {
  const launches = [
    launch({ role: 'writer', modelRan: 'claude-sonnet-5-5', started: false }),
    launch({ role: 'other', started: false }),
    launch({ role: 'writer' }),
  ];
  const result = compareLaunches(launches, RULES);

  assert.equal(result.launches, 1);
  assert.equal(result.compared, 1);
  assert.equal(result.byRole.writer.launches, 1);
  assert.equal(result.offModel, 0);
  assert.equal(result.other, 0);
});

test('a null expectation is skipped and the row says nothing about it', () => {
  const expected = { writerModel: null, readerModel: RULES.readerModel, effort: null };
  const launches = [
    launch({ role: 'writer', modelRan: 'claude-sonnet-5-5', effortRan: 'low' }),
    launch({ role: 'verifier', modelRan: 'claude-opus-5-0', effortRan: 'low' }),
  ];
  const result = compareLaunches(launches, expected);

  assert.equal(result.offModel, 1);
  assert.equal(result.offEffort, 0);
  assert.equal(result.unknownEffort, 0);
  assert.deepEqual(result.byRole.writer.offModel, []);
  assert.deepEqual(subagentRowLines(result, expected), {
    detail: '2 launches today: 1 on a model off the rules',
    lines: ['reader: 1 of 1 ran on claude-opus-5-0 (subagent-reader-model gives sonnet)'],
  });
});

test('a model matches its rule by the full id or by the alias', () => {
  const launches = [
    launch({ role: 'writer', modelRan: 'haiku' }),
    launch({ role: 'writer', modelRan: 'claude-haiku-5-5' }),
    launch({ role: 'verifier', modelRan: 'sonnet' }),
  ];
  const result = compareLaunches(launches, RULES);

  assert.equal(result.compared, 3);
  assert.equal(result.offModel, 0);
  assert.deepEqual(subagentRowLines(result, RULES), {
    detail: "3 launches today, all on the rules' models and at high",
    lines: [],
  });
});

test('off models are sorted by count descending, then by name', () => {
  const launches = [
    launch({ role: 'writer', modelRan: 'claude-sonnet-5-5' }),
    launch({ role: 'writer', modelRan: 'claude-opus-5-0' }),
    launch({ role: 'writer', modelRan: 'claude-opus-5-0' }),
    launch({ role: 'writer', modelRan: 'claude-opus-4-1' }),
  ];
  const result = compareLaunches(launches, RULES);

  assert.deepEqual(result.byRole.writer.offModel, [
    { modelRan: 'claude-opus-5-0', count: 2 },
    { modelRan: 'claude-opus-4-1', count: 1 },
    { modelRan: 'claude-sonnet-5-5', count: 1 },
  ]);
});

test('a model that did not run is unknown, not off', () => {
  const result = compareLaunches([launch({ role: 'writer', modelRan: null }), launch({ role: 'writer' })], RULES);

  assert.equal(result.unknownModel, 1);
  assert.equal(result.offModel, 0);
  assert.equal(subagentRowLines(result, RULES).detail, '2 launches today: 1 with an unknown model');
});

test('the row says so when no sub-agent launched today', () => {
  const result = compareLaunches([], RULES);

  assert.equal(result.launches, 0);
  assert.deepEqual(subagentRowLines(result, RULES), { detail: 'no sub-agent launched today', lines: [] });
});

test('a single launch is said in the singular, and a launch no rule covers is not compared', () => {
  const one = compareLaunches([launch({ role: 'writer' })], RULES);
  assert.equal(subagentRowLines(one, RULES).detail, "1 launch today, all on the rules' models and at high");

  const none = { writerModel: null, readerModel: null, effort: null };
  const result = compareLaunches([launch({ role: 'writer' })], none);
  assert.equal(result.compared, 0);
  assert.equal(subagentRowLines(result, none).detail, '1 launch today, none compared with a rule');
});

// A launch of role other is not compared, so the row never counts it among those on the rules (Codex, 2026-10-15).
test('an other launch is named as not compared and kept out of the all-on-the-rules claim', () => {
  const launches = [launch({ role: 'writer' }), launch({ role: 'other', modelRan: 'claude-sonnet-5-5', effortRan: 'low' })];
  const { detail } = subagentRowLines(compareLaunches(launches, RULES), RULES);
  assert.match(detail, /^2 launches today, the 1 compared all on the rules' models and at high; 1 not compared \(role other\)$/);
});

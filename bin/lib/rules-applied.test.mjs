// Tests for the pure part of `js-harness rules applied`: appliedOf and appliedLines.
// Each test states only what matters; the helpers fill in the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appliedLines, appliedOf } from './rules-applied.mjs';

const TODAY = '2026-10-12';

/** Gives a launch of a sub-agent that the alias `haiku` named, answered by claude-haiku-5-5 on the 11th of October, unless told otherwise. */
function launch(over = {}) {
  return {
    alias: 'haiku',
    model: 'claude-haiku-5-5',
    effort: 'medium',
    agentType: 'general-purpose',
    entrypoint: 'cli',
    version: '2.1.100',
    at: '2026-10-11T19:40:12.275Z',
    file: 'a.jsonl',
    ...over,
  };
}

/** Gives the last answer of a session, claude-haiku-5-5 on the 11th of October, unless told otherwise. */
function session(over = {}) {
  return {
    model: 'claude-haiku-5-5',
    effort: 'medium',
    entrypoint: 'cli',
    version: '2.1.100',
    at: '2026-10-11T19:40:12.275Z',
    file: 's.jsonl',
    ...over,
  };
}

/** Gives a declared rule with the alias `haiku`, in force since the 1st of October, unless told otherwise. */
function rule(over = {}) {
  return { id: 'haiku-rule', value: 'claude-haiku-5-5', alias: 'haiku', since: '2026-10-01', ...over };
}

/** Runs appliedOf with today fixed at the 12th of October, so each test states only its own inputs. */
function run(rules, launches = [], sessions = [], options = {}) {
  return appliedOf(rules, launches, sessions, { today: TODAY, ...options });
}

test('two launches on one engine answered by the rule value agree', () => {
  const out = run([rule()], [
    launch({ at: '2026-10-10T08:00:00.000Z', file: 'a.jsonl' }),
    launch({ at: '2026-10-11T19:40:12.275Z', file: 'b.jsonl' }),
  ]);
  assert.deepEqual(out.rules, [{
    id: 'haiku-rule',
    alias: 'haiku',
    value: 'claude-haiku-5-5',
    since: '2026-10-01',
    engines: [{
      entrypoint: 'cli',
      version: '2.1.100',
      state: 'agrees',
      launches: 2,
      models: [{ model: 'claude-haiku-5-5', count: 2 }],
      last: '2026-10-11',
      differences: [],
    }],
  }]);
  assert.equal(out.exit, 0);
  assert.deepEqual(out.fails, []);
});

test('an id with a date at its end agrees with the rule value and is counted by its plain id', () => {
  const out = run([rule({ value: 'claude-haiku-4-5' })], [
    launch({ model: 'claude-haiku-4-5-20251001' }),
  ]);
  const [engine] = out.rules[0].engines;
  assert.equal(engine.state, 'agrees');
  assert.deepEqual(engine.models, [{ model: 'claude-haiku-4-5', count: 1 }]);
  assert.deepEqual(engine.differences, []);
  assert.equal(out.exit, 0);
});

test('models are ordered by count, most first, then by plain id', () => {
  const out = run([rule()], [
    launch({ model: 'claude-opus-5-0' }),
    launch({ model: 'claude-haiku-4-5-20251001' }),
    launch({ model: 'claude-haiku-4-5-20251001' }),
    launch({ model: 'claude-haiku-5-5' }),
  ]);
  assert.deepEqual(out.rules[0].engines[0].models, [
    { model: 'claude-haiku-4-5', count: 2 },
    { model: 'claude-haiku-5-5', count: 1 },
    { model: 'claude-opus-5-0', count: 1 },
  ]);
});

test('a latest launch on the entry point answered by another model differs, exits 1 and fails with every key', () => {
  const out = run([rule()], [
    launch({ model: 'claude-haiku-5-5', at: '2026-10-09T10:00:00.000Z', file: 'a.jsonl' }),
    launch({ model: 'claude-sonnet-5-5', at: '2026-10-10T10:00:00.000Z', file: 'b.jsonl' }),
    launch({ model: 'claude-opus-5-0', at: '2026-10-11T10:00:00.000Z', file: 'c.jsonl' }),
  ]);
  const [engine] = out.rules[0].engines;
  assert.equal(engine.state, 'differs');
  assert.deepEqual(engine.differences, [
    { model: 'claude-sonnet-5-5', file: 'b.jsonl', day: '2026-10-10' },
    { model: 'claude-opus-5-0', file: 'c.jsonl', day: '2026-10-11' },
  ]);
  assert.equal(out.exit, 1);
  assert.deepEqual(out.fails, [{
    id: 'haiku-rule',
    alias: 'haiku',
    value: 'claude-haiku-5-5',
    entrypoint: 'cli',
    version: '2.1.100',
    model: 'claude-opus-5-0',
    file: 'c.jsonl',
    day: '2026-10-11',
  }]);
});

test('an older difference on one version is differed when a later launch on another version agrees', () => {
  const out = run([rule()], [
    launch({ version: '2.1.99', model: 'claude-sonnet-5-5', at: '2026-10-10T10:00:00.000Z', file: 'a.jsonl' }),
    launch({ version: '2.1.100', model: 'claude-haiku-5-5', at: '2026-10-11T10:00:00.000Z', file: 'b.jsonl' }),
  ]);
  const [older, newer] = out.rules[0].engines;
  assert.equal(older.version, '2.1.99');
  assert.equal(older.state, 'differed');
  assert.equal(newer.version, '2.1.100');
  assert.equal(newer.state, 'agrees');
  assert.equal(out.exit, 0);
  assert.deepEqual(out.fails, []);
});

test('a difference on one entry point is not healed by a later agreeing launch on another', () => {
  const out = run([rule()], [
    launch({ entrypoint: 'cli', model: 'claude-sonnet-5-5', at: '2026-10-10T10:00:00.000Z', file: 'a.jsonl' }),
    launch({ entrypoint: 'desktop', model: 'claude-haiku-5-5', at: '2026-10-11T10:00:00.000Z', file: 'b.jsonl' }),
  ]);
  const [cli, desktop] = out.rules[0].engines;
  assert.equal(cli.entrypoint, 'cli');
  assert.equal(cli.state, 'differs');
  assert.equal(desktop.entrypoint, 'desktop');
  assert.equal(desktop.state, 'agrees');
  assert.equal(out.exit, 1);
  assert.deepEqual(out.fails.map((fail) => [fail.entrypoint, fail.model]), [['cli', 'claude-sonnet-5-5']]);
});

test('two launches at the same time: the one whose file is greater decides', () => {
  const at = '2026-10-11T10:00:00.000Z';
  const agrees = launch({ model: 'claude-haiku-5-5', at, file: 'b.jsonl' });
  const differs = launch({ model: 'claude-sonnet-5-5', at, file: 'a.jsonl' });

  const greaterAgrees = run([rule()], [differs, agrees]);
  assert.equal(greaterAgrees.rules[0].engines[0].state, 'differed');
  assert.equal(greaterAgrees.exit, 0);

  const greaterDiffers = run([rule()], [agrees, { ...differs, file: 'c.jsonl' }]);
  assert.equal(greaterDiffers.rules[0].engines[0].state, 'differs');
  assert.equal(greaterDiffers.exit, 1);
});

test('a launch before since is not counted, and an engine whose entries are all before since has no item', () => {
  const out = run([rule({ since: '2026-10-05' })], [
    launch({ entrypoint: 'desktop', model: 'claude-sonnet-5-5', at: '2026-10-03T10:00:00.000Z', file: 'a.jsonl' }),
    launch({ entrypoint: 'cli', model: 'claude-sonnet-5-5', at: '2026-10-03T10:00:00.000Z', file: 'b.jsonl' }),
    launch({ entrypoint: 'cli', model: 'claude-haiku-5-5', at: '2026-10-06T10:00:00.000Z', file: 'c.jsonl' }),
  ], [], { days: 30 });
  assert.equal(out.rules[0].engines.length, 1);
  const [cli] = out.rules[0].engines;
  assert.equal(cli.entrypoint, 'cli');
  assert.equal(cli.launches, 1);
  assert.equal(cli.state, 'agrees');
  assert.deepEqual(cli.differences, []);
  assert.equal(out.exit, 0);
});

test('an engine known only by a session has the state no launch yet', () => {
  const out = run([rule()], [], [session({ entrypoint: 'desktop' })]);
  assert.deepEqual(out.rules[0].engines, [{
    entrypoint: 'desktop',
    version: '2.1.100',
    state: 'no launch yet',
    launches: 0,
    models: [],
    last: null,
    differences: [],
  }]);
  assert.equal(out.exit, 0);
});

test('the same version on two entry points gives two items, the one with only a session has no launch yet', () => {
  const out = run([rule()], [launch({ entrypoint: 'cli' })], [session({ entrypoint: 'desktop' })]);
  const engines = out.rules[0].engines;
  assert.equal(engines.length, 2);
  assert.equal(engines[0].entrypoint, 'cli');
  assert.equal(engines[0].state, 'agrees');
  assert.equal(engines[1].entrypoint, 'desktop');
  assert.equal(engines[1].version, '2.1.100');
  assert.equal(engines[1].state, 'no launch yet');
});

test('engines are ordered by entry point as text and by version as numbers', () => {
  const out = run([rule()], [], [
    session({ entrypoint: 'desktop', version: '2.1.100' }),
    session({ entrypoint: 'cli', version: '2.1.100' }),
    session({ entrypoint: 'cli', version: '2.1.99' }),
  ]);
  assert.deepEqual(out.rules[0].engines.map((engine) => [engine.entrypoint, engine.version]), [
    ['cli', '2.1.99'],
    ['cli', '2.1.100'],
    ['desktop', '2.1.100'],
  ]);
});

test('the parts 2, 10 and 1a come out in one order whatever order they came in: 2 before 10, and both before 1a', () => {
  const versions = ['2.1.2', '2.1.10', '2.1.1a'];
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const order of orders) {
    const out = run([rule()], [], order.map((index) => session({ version: versions[index] })));
    assert.deepEqual(out.rules[0].engines.map((engine) => engine.version), versions, `order ${order.join(' ')}`);
  }
});

test('entries with no version, a synthetic model, no time or too old are skipped, each counted once, and none reaches a result', () => {
  const out = run([rule()], [
    launch({ version: '' }),
    null,
    launch({ version: '', at: 'not a time' }),
    launch({ model: '<synthetic>' }),
    launch({ at: 'not a time' }),
    launch({ at: '2026-10-05T10:00:00.000Z' }),
    launch({ model: '<synthetic>', at: '2026-10-05T10:00:00.000Z' }),
    launch(),
  ], [
    session({ model: '' }),
  ]);
  assert.deepEqual(out.skipped, { noVersion: 3, synthetic: 3, noTime: 1, old: 1 });
  assert.equal(out.rules[0].engines[0].launches, 1);
  assert.deepEqual(out.read, { launches: 1, sessions: 0, firstDay: '2026-10-11', lastDay: '2026-10-11' });
  assert.deepEqual(out.otherAliases, []);
  assert.deepEqual(out.otherModels, []);
});

test('a time with no zone, a day alone or a text with a named zone is skipped as noTime, and a time with a zone is kept', () => {
  const out = run([rule()], [
    launch({ at: '2026-10-12T10:00:00', file: 'no-zone.jsonl' }),
    launch({ at: '2026-10-12', file: 'day-only.jsonl' }),
    launch({ at: 'Oct 12 2026 10:00 GMT', file: 'named-zone.jsonl' }),
    launch({ at: '2026-10-12T10:00:00Z', file: 'z.jsonl' }),
    launch({ at: '2026-10-12T10:00:00.123Z', file: 'fraction.jsonl' }),
    launch({ at: '2026-10-12T10:00:00+02:00', file: 'offset.jsonl' }),
  ]);
  assert.equal(out.skipped.noTime, 3);
  assert.equal(out.read.launches, 3);
});

test('an offset without its colon is skipped as noTime, and an offset with its colon is kept', () => {
  const out = run([rule()], [
    launch({ at: '2026-10-12T10:00:00+0200', file: 'offset-no-colon.jsonl' }),
    launch({ at: '2026-10-12T10:00:00+02:00', file: 'offset-colon.jsonl' }),
    launch({ at: '2026-10-12T10:00:00Z', file: 'z.jsonl' }),
  ]);
  assert.equal(out.skipped.noTime, 1);
  assert.equal(out.read.launches, 2);
});

test('an entry that is not an object is counted under no version and does not throw', () => {
  const out = run([rule()], [null, 5, 'x'], [undefined]);
  assert.equal(out.skipped.noVersion, 4);
  assert.deepEqual(out.rules[0].engines, []);
  assert.equal(out.exit, 0);
});

test('the window keeps the day six days before today and drops the day seven days before', () => {
  const out = run([rule()], [
    launch({ at: '2026-10-06T23:59:59.999Z', file: 'kept.jsonl' }),
    launch({ at: '2026-10-05T00:00:00.000Z', file: 'old.jsonl' }),
  ]);
  assert.equal(out.read.launches, 1);
  assert.equal(out.skipped.old, 1);
  assert.equal(out.read.firstDay, '2026-10-06');
  assert.equal(out.read.lastDay, '2026-10-06');
});

test('the day of an entry is the day of its instant in universal time, whatever offset its text carries', () => {
  const late = run([rule()], [launch({ at: '2026-10-12T23:30:00-05:00' })]);
  assert.equal(late.read.firstDay, '2026-10-13');
  assert.equal(late.rules[0].engines[0].last, '2026-10-13');
  const early = run([rule()], [launch({ at: '2026-10-12T02:00:00+05:00' })]);
  assert.equal(early.read.firstDay, '2026-10-11');
  assert.equal(early.rules[0].engines[0].last, '2026-10-11');
});

test('the window counts the day of the instant: 23:30 at -05:00 is kept with one day, 02:00 at +05:00 is old', () => {
  const out = run([rule()], [
    launch({ at: '2026-10-12T23:30:00-05:00', file: 'late.jsonl' }),
    launch({ at: '2026-10-12T02:00:00+05:00', file: 'early.jsonl' }),
  ], [], { days: 1 });
  assert.equal(out.read.launches, 1);
  assert.equal(out.skipped.old, 1);
  assert.equal(out.read.firstDay, '2026-10-13');
});

test('an entry with no entry point is kept under the entry point unknown', () => {
  const out = run([rule()], [launch({ entrypoint: undefined })], [session({ entrypoint: '' })]);
  assert.deepEqual(
    out.rules[0].engines.map((engine) => [engine.entrypoint, engine.state, engine.launches]),
    [['unknown', 'agrees', 1]],
  );
  assert.equal(out.read.sessions, 1);
});

test('a short name no rule names is counted by alias and agent type, null first', () => {
  const out = run([rule()], [
    launch({ alias: 'sonnet', agentType: 'explore' }),
    launch({ alias: 'sonnet', agentType: 'explore' }),
    launch({ alias: 'sonnet', agentType: null }),
    launch({ alias: 'opus', agentType: 'general-purpose' }),
  ]);
  assert.deepEqual(out.otherAliases, [
    { alias: 'opus', agentType: 'general-purpose', count: 1 },
    { alias: 'sonnet', agentType: null, count: 1 },
    { alias: 'sonnet', agentType: 'explore', count: 2 },
  ]);
  assert.equal(out.exit, 0);
});

test('launches that passed no alias are counted by agent type and plain model, null first', () => {
  const out = run([rule()], [
    launch({ alias: null, agentType: 'explore', model: 'claude-sonnet-5-5-20260101' }),
    launch({ alias: null, agentType: 'explore', model: 'claude-sonnet-5-5-20260101' }),
    launch({ alias: null, agentType: null, model: 'claude-haiku-5-5' }),
    launch({ alias: null, agentType: 'explore', model: 'claude-haiku-5-5' }),
  ]);
  assert.deepEqual(out.noModel, [
    { agentType: null, model: 'claude-haiku-5-5', count: 1 },
    { agentType: 'explore', model: 'claude-haiku-5-5', count: 1 },
    { agentType: 'explore', model: 'claude-sonnet-5-5', count: 2 },
  ]);
  assert.deepEqual(out.otherAliases, []);
});

test('a model no rule value names is counted over launches and sessions; a value of a rule without alias is not listed', () => {
  const out = run([
    rule(),
    { id: 'opus-rule', value: 'claude-opus-5-0', since: '2026-10-01' },
  ], [
    launch({ alias: 'sonnet', model: 'claude-sonnet-5-5-20260101' }),
    launch({ alias: null, model: 'claude-opus-5-0' }),
  ], [
    session({ model: 'claude-sonnet-5-5' }),
    session({ model: 'claude-haiku-5-5' }),
  ]);
  assert.deepEqual(out.otherModels, [{ model: 'claude-sonnet-5-5', count: 2 }]);
});

test('a rule with no alias has no item in rules and is not compared', () => {
  const out = run([{ id: 'opus-rule', value: 'claude-opus-5-0', since: '2026-10-01' }], [
    launch({ model: 'claude-sonnet-5-5' }),
  ]);
  assert.deepEqual(out.rules, []);
  assert.deepEqual(out.fails, []);
  assert.equal(out.exit, 0);
  assert.deepEqual(out.otherAliases, [{ alias: 'haiku', agentType: 'general-purpose', count: 1 }]);
});

test('two rules with different aliases each have their own items', () => {
  const out = run([
    rule(),
    rule({ id: 'sonnet-rule', value: 'claude-sonnet-5-5', alias: 'sonnet' }),
  ], [
    launch({ alias: 'haiku', model: 'claude-haiku-5-5', at: '2026-10-10T10:00:00.000Z', file: 'a.jsonl' }),
    launch({ alias: 'sonnet', model: 'claude-sonnet-5-5', at: '2026-10-10T10:00:00.000Z', file: 'b.jsonl' }),
    launch({ alias: 'sonnet', model: 'claude-haiku-5-5', at: '2026-10-11T10:00:00.000Z', file: 'c.jsonl' }),
  ]);
  assert.deepEqual(out.rules.map((item) => item.id), ['haiku-rule', 'sonnet-rule']);
  assert.equal(out.rules[0].engines[0].state, 'agrees');
  assert.equal(out.rules[0].engines[0].launches, 1);
  assert.equal(out.rules[1].engines[0].state, 'differs');
  assert.equal(out.rules[1].engines[0].launches, 2);
  assert.deepEqual(out.fails.map((fail) => fail.id), ['sonnet-rule']);
  assert.equal(out.exit, 1);
});

test('with no launches and no sessions every rule has no engines, exit 0 and nulls in read', () => {
  const out = run([rule()]);
  assert.deepEqual(out, {
    rules: [{ id: 'haiku-rule', alias: 'haiku', value: 'claude-haiku-5-5', since: '2026-10-01', engines: [] }],
    fails: [],
    exit: 0,
    otherAliases: [],
    noModel: [],
    otherModels: [],
    held: [],
    heldOther: 0,
    forLead: [],
    read: { launches: 0, sessions: 0, firstDay: null, lastDay: null },
    skipped: { noVersion: 0, synthetic: 0, noTime: 0, old: 0 },
  });
});

test('a today that is not a day throws the plain message', () => {
  const message = 'appliedOf needs today as a day';
  assert.throws(() => appliedOf([rule()], [], [], {}), { name: 'Error', message });
  assert.throws(() => appliedOf([rule()], [], [], { today: '12/10/2026' }), { name: 'Error', message });
});

test('a today of the shape of a day that is not a real day throws the plain message', () => {
  const message = 'appliedOf needs today as a day';
  assert.throws(() => run([rule()], [], [], { today: '2026-13-40' }), { name: 'Error', message });
  assert.throws(() => run([rule()], [], [], { today: '2026-02-30' }), { name: 'Error', message });
});

test('days must be a whole number of 1 or more, or the window is not counted', () => {
  const message = 'appliedOf needs days as a whole number of 1 or more';
  for (const days of [0, -1, 1.5, NaN, '7', null]) {
    assert.throws(() => run([rule()], [], [], { days }), { name: 'Error', message }, `days ${String(days)}`);
  }
});

test('days of 1 keeps the entries of today and skips those of yesterday', () => {
  const out = run([rule()], [
    launch({ at: '2026-10-12T08:00:00.000Z', file: 'today.jsonl' }),
    launch({ at: '2026-10-11T08:00:00.000Z', file: 'yesterday.jsonl' }),
  ], [], { days: 1 });
  assert.equal(out.read.launches, 1);
  assert.equal(out.skipped.old, 1);
  assert.equal(out.read.firstDay, '2026-10-12');
});

test('the arguments are not changed', () => {
  const rules = [rule(), { id: 'opus-rule', value: 'claude-opus-5-0', since: '2026-10-01' }];
  const launches = [launch(), launch({ alias: 'sonnet', at: '2026-10-05T00:00:00.000Z' }), null];
  const sessions = [session(), session({ version: '' })];
  const options = { today: TODAY, days: 7 };
  const before = structuredClone([rules, launches, sessions, options]);
  appliedOf(rules, launches, sessions, options);
  assert.deepEqual([rules, launches, sessions, options], before);
});

/** Gives a result of appliedOf that holds nothing: no rule, no count and no skipped entry, unless told otherwise. */
function emptyResult(over = {}) {
  return {
    rules: [],
    fails: [],
    exit: 0,
    otherAliases: [],
    noModel: [],
    otherModels: [],
    read: { launches: 0, sessions: 0, firstDay: null, lastDay: null },
    skipped: { noVersion: 0, synthetic: 0, noTime: 0, old: 0 },
    ...over,
  };
}

/** Gives the facts of a run over a project with one launch file and one session file, nothing capped or left out, unless told otherwise. */
function contextOf(over = {}) {
  return {
    project: 'D:/js-harness',
    main: 'D:/harness',
    recordsDir: 'C:/records/js-harness',
    exists: true,
    files: { launches: 1, sessions: 1 },
    capped: false,
    unreadable: [],
    days: 7,
    maxFiles: 200,
    leftOut: { elsewhere: 0, behind: 0 },
    ...over,
  };
}

/** Gives the item of haiku-rule with one engine, cli 2.1.100, that agrees: one launch, the last on the 11th. */
function agreeingRule(over = {}) {
  return {
    id: 'haiku-rule',
    alias: 'haiku',
    value: 'claude-haiku-5-5',
    since: '2026-10-01',
    engines: [{
      entrypoint: 'cli',
      version: '2.1.100',
      state: 'agrees',
      launches: 1,
      models: [{ model: 'claude-haiku-5-5', count: 1 }],
      last: '2026-10-11',
      differences: [],
    }],
    ...over,
  };
}

/** Gives the item of haiku-rule with one engine, cli 2.1.100, that differs: its launch on the 11th took claude-opus-5-0. */
function differsRule(over = {}) {
  return {
    id: 'haiku-rule',
    alias: 'haiku',
    value: 'claude-haiku-5-5',
    since: '2026-10-01',
    engines: [{
      entrypoint: 'cli',
      version: '2.1.100',
      state: 'differs',
      launches: 1,
      models: [{ model: 'claude-opus-5-0', count: 1 }],
      last: '2026-10-11',
      differences: [{ model: 'claude-opus-5-0', day: '2026-10-11', file: 'c.jsonl' }],
    }],
    ...over,
  };
}

/** Gives the fail of haiku-rule on cli 2.1.100, the one differsRule holds. */
function failOf(over = {}) {
  return {
    id: 'haiku-rule',
    alias: 'haiku',
    value: 'claude-haiku-5-5',
    entrypoint: 'cli',
    version: '2.1.100',
    model: 'claude-opus-5-0',
    file: 'c.jsonl',
    day: '2026-10-11',
    ...over,
  };
}

const HEAD = [
  'Rules applied: what each alias gave in the records of the last 7 days',
  '  project: D:/js-harness',
  '  records: C:/records/js-harness (of D:/harness)',
];
const FILES_ONE = '  files: 1 of launches, 1 of sessions';
const NOTHING_READ = '  read: no launch and no session in the window';
// A window in which no launch passed a declared alias proves nothing, so it is never written as a pass.
const NOTHING_COMPARED = 'Nothing compared: no launch passed a declared alias in the window';
const NOT_COMPARED = 'Not compared here: the model and the effort of a Codex review, which the review holds itself at every run.';

test('no records: the four head lines, then Not compared', () => {
  assert.deepEqual(appliedLines(emptyResult(), contextOf({ exists: false })), [
    ...HEAD,
    '  no records there: nothing was read',
    NOT_COMPARED,
  ]);
});

test('no records and two rules left out behind: the Left out line comes before Not compared, with no PASS and no FAIL even when a rule fails', () => {
  const lines = appliedLines(
    emptyResult({ rules: [agreeingRule()], fails: [failOf()] }),
    contextOf({ exists: false, leftOut: { elsewhere: 0, behind: 2 } }),
  );
  assert.deepEqual(lines, [
    ...HEAD,
    '  no records there: nothing was read',
    `Left out: 2 rules of this repository, because the copy that runs holds another list than this project's: run the project's own bin/js-harness.mjs`,
    NOT_COMPARED,
  ]);
});

test('both Left out lines, each with its count, come before Not compared', () => {
  assert.deepEqual(appliedLines(emptyResult(), contextOf({ leftOut: { elsewhere: 2, behind: 1 } })), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    `Left out: 2 rules of the harness's own repository, not in force in this project`,
    `Left out: 1 rule of this repository, because the copy that runs holds another list than this project's: run the project's own bin/js-harness.mjs`,
    NOT_COMPARED,
  ]);
});

test('an empty window: the line that says no launch and no session, then no rule with an alias is in force here', () => {
  assert.deepEqual(appliedLines(emptyResult(), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    NOT_COMPARED,
  ]);
});

test('one rule with one engine that agrees: the whole array, with PASS last', () => {
  assert.deepEqual(appliedLines(
    emptyResult({
      rules: [agreeingRule()],
      read: { launches: 1, sessions: 0, firstDay: '2026-10-11', lastDay: '2026-10-11' },
    }),
    contextOf({ files: { launches: 1, sessions: 0 } }),
  ), [
    ...HEAD,
    '  read: 1 launch and 0 sessions, from 2026-10-11 to 2026-10-11',
    '  files: 1 of launches, 0 of sessions',
    '',
    'haiku-rule: claude-haiku-5-5, passed as `haiku`, since 2026-10-01',
    '  cli 2.1.100: agrees, 1 launch, the last on 2026-10-11 (claude-haiku-5-5 x 1)',
    '',
    NOT_COMPARED,
    'PASS  rules applied: each short name gave its model',
  ]);
});

test('singular: 1 launch and 1 session, and 1 rule in the Left out line', () => {
  assert.deepEqual(appliedLines(
    emptyResult({ read: { launches: 1, sessions: 1, firstDay: '2026-10-11', lastDay: '2026-10-11' } }),
    contextOf({ leftOut: { elsewhere: 1, behind: 0 } }),
  ), [
    ...HEAD,
    '  read: 1 launch and 1 session, from 2026-10-11 to 2026-10-11',
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    `Left out: 1 rule of the harness's own repository, not in force in this project`,
    NOT_COMPARED,
  ]);
});

test('plural and zero: 0 launches and 2 sessions, and 2 rules in the Left out line', () => {
  assert.deepEqual(appliedLines(
    emptyResult({ read: { launches: 0, sessions: 2, firstDay: '2026-10-10', lastDay: '2026-10-11' } }),
    contextOf({ files: { launches: 0, sessions: 2 }, leftOut: { elsewhere: 2, behind: 0 } }),
  ), [
    ...HEAD,
    '  read: 0 launches and 2 sessions, from 2026-10-10 to 2026-10-11',
    '  files: 0 of launches, 2 of sessions',
    '',
    'no rule with an alias is in force here',
    '',
    `Left out: 2 rules of the harness's own repository, not in force in this project`,
    NOT_COMPARED,
  ]);
});

test('an engine with no launch is written no launch yet', () => {
  const rule = agreeingRule({
    engines: [{ entrypoint: 'desktop', version: '2.1.100', state: 'no launch yet', launches: 0, models: [], last: null, differences: [] }],
  });
  assert.deepEqual(appliedLines(
    emptyResult({ rules: [rule], read: { launches: 0, sessions: 1, firstDay: '2026-10-11', lastDay: '2026-10-11' } }),
    contextOf({ files: { launches: 0, sessions: 1 } }),
  ), [
    ...HEAD,
    '  read: 0 launches and 1 session, from 2026-10-11 to 2026-10-11',
    '  files: 0 of launches, 1 of sessions',
    '',
    'haiku-rule: claude-haiku-5-5, passed as `haiku`, since 2026-10-01',
    '  desktop 2.1.100: no launch yet',
    '',
    NOT_COMPARED,
    NOTHING_COMPARED,
  ]);
});

test('a rule with no engine: the line that says no engine has an entry in the window', () => {
  assert.deepEqual(appliedLines(emptyResult({ rules: [agreeingRule({ engines: [] })] }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'haiku-rule: claude-haiku-5-5, passed as `haiku`, since 2026-10-01',
    '  no engine has an entry in the window since that day',
    '',
    NOT_COMPARED,
    NOTHING_COMPARED,
  ]);
});

test('two models on an engine are joined in the order given', () => {
  const engine = {
    entrypoint: 'cli',
    version: '2.1.100',
    state: 'agrees',
    launches: 3,
    models: [{ model: 'claude-opus-5-0', count: 1 }, { model: 'claude-haiku-5-5', count: 2 }],
    last: '2026-10-11',
    differences: [],
  };
  assert.deepEqual(appliedLines(
    emptyResult({ rules: [agreeingRule({ engines: [engine] })], read: { launches: 3, sessions: 0, firstDay: '2026-10-09', lastDay: '2026-10-11' } }),
    contextOf({ files: { launches: 3, sessions: 0 } }),
  ), [
    ...HEAD,
    '  read: 3 launches and 0 sessions, from 2026-10-09 to 2026-10-11',
    '  files: 3 of launches, 0 of sessions',
    '',
    'haiku-rule: claude-haiku-5-5, passed as `haiku`, since 2026-10-01',
    '  cli 2.1.100: agrees, 3 launches, the last on 2026-10-11 (claude-opus-5-0 x 1, claude-haiku-5-5 x 2)',
    '',
    NOT_COMPARED,
    'PASS  rules applied: each short name gave its model',
  ]);
});

test('a difference is written under its engine, with 6 spaces', () => {
  const engine = {
    entrypoint: 'cli',
    version: '2.1.100',
    state: 'differed',
    launches: 2,
    models: [{ model: 'claude-haiku-5-5', count: 1 }, { model: 'claude-sonnet-5-5', count: 1 }],
    last: '2026-10-11',
    differences: [{ model: 'claude-sonnet-5-5', day: '2026-10-10', file: 'b.jsonl' }],
  };
  assert.deepEqual(appliedLines(
    emptyResult({ rules: [agreeingRule({ engines: [engine] })], read: { launches: 2, sessions: 0, firstDay: '2026-10-10', lastDay: '2026-10-11' } }),
    contextOf({ files: { launches: 2, sessions: 0 } }),
  ), [
    ...HEAD,
    '  read: 2 launches and 0 sessions, from 2026-10-10 to 2026-10-11',
    '  files: 2 of launches, 0 of sessions',
    '',
    'haiku-rule: claude-haiku-5-5, passed as `haiku`, since 2026-10-01',
    '  cli 2.1.100: differed, 2 launches, the last on 2026-10-11 (claude-haiku-5-5 x 1, claude-sonnet-5-5 x 1)',
    '      claude-sonnet-5-5 on 2026-10-10: b.jsonl',
    '',
    NOT_COMPARED,
    'PASS  rules applied: each short name gave its model',
  ]);
});

test('capped adds the end of the files line', () => {
  assert.deepEqual(appliedLines(emptyResult(), contextOf({ files: { launches: 200, sessions: 3 }, capped: true })), [
    ...HEAD,
    NOTHING_READ,
    '  files: 200 of launches, 3 of sessions; more than 200 were recent, and the oldest were left out',
    '',
    'no rule with an alias is in force here',
    '',
    NOT_COMPARED,
  ]);
});

test('skipped appears only with a count above 0, and then all four counts are written', () => {
  assert.deepEqual(appliedLines(emptyResult({ skipped: { noVersion: 1, synthetic: 0, noTime: 2, old: 0 } }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '  skipped: 1 with no version, 0 with no model that answered, 2 with no time, 0 older than the window',
    '',
    'no rule with an alias is in force here',
    '',
    NOT_COMPARED,
  ]);
});

test('two unreadable files: the count with its noun, then each file with 4 spaces', () => {
  assert.deepEqual(appliedLines(emptyResult(), contextOf({
    unreadable: [{ file: 'a.jsonl', reason: 'not JSON' }, { file: 'b.jsonl', reason: 'EACCES' }],
  })), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '  could not read 2 files:',
    '    a.jsonl: not JSON',
    '    b.jsonl: EACCES',
    '',
    'no rule with an alias is in force here',
    '',
    NOT_COMPARED,
  ]);
});

test('one unreadable file: could not read 1 file', () => {
  assert.deepEqual(appliedLines(emptyResult(), contextOf({
    unreadable: [{ file: 'a.jsonl', reason: 'not JSON' }],
  })), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '  could not read 1 file:',
    '    a.jsonl: not JSON',
    '',
    'no rule with an alias is in force here',
    '',
    NOT_COMPARED,
  ]);
});

test('short names that no rule names: the block, with a null agent type written no agent type', () => {
  assert.deepEqual(appliedLines(emptyResult({
    otherAliases: [
      { alias: 'sonnet', agentType: null, count: 1 },
      { alias: 'sonnet', agentType: 'explore', count: 2 },
    ],
  }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    "Short names that no rule's alias names:",
    '  sonnet, no agent type: 1',
    '  sonnet, explore: 2',
    '',
    NOT_COMPARED,
  ]);
});

test('launches that passed no model: the block, with a null agent type written no agent type', () => {
  assert.deepEqual(appliedLines(emptyResult({
    noModel: [
      { agentType: 'explore', model: 'claude-sonnet-5-5', count: 2 },
      { agentType: null, model: 'claude-haiku-5-5', count: 1 },
    ],
  }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    'Launches that passed no model:',
    '  explore, answered by claude-sonnet-5-5: 2',
    '  no agent type, answered by claude-haiku-5-5: 1',
    '',
    NOT_COMPARED,
  ]);
});

test('models that no rule value names: the block', () => {
  assert.deepEqual(appliedLines(emptyResult({
    otherModels: [{ model: 'claude-sonnet-5-5', count: 2 }],
  }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    "Models that no rule's value names:",
    '  claude-sonnet-5-5: 2',
    '',
    NOT_COMPARED,
  ]);
});

test('the three counted blocks together, each after one empty line, with no agent type', () => {
  assert.deepEqual(appliedLines(emptyResult({
    otherAliases: [{ alias: 'sonnet', agentType: null, count: 1 }],
    noModel: [{ agentType: null, model: 'claude-haiku-5-5', count: 1 }],
    otherModels: [{ model: 'claude-sonnet-5-5', count: 2 }],
  }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    "Short names that no rule's alias names:",
    '  sonnet, no agent type: 1',
    '',
    'Launches that passed no model:',
    '  no agent type, answered by claude-haiku-5-5: 1',
    '',
    "Models that no rule's value names:",
    '  claude-sonnet-5-5: 2',
    '',
    NOT_COMPARED,
  ]);
});

test('one fail: the FAIL line, then the To the lead line, and no PASS', () => {
  assert.deepEqual(appliedLines(emptyResult({
    rules: [differsRule()],
    fails: [failOf()],
    read: { launches: 1, sessions: 0, firstDay: '2026-10-11', lastDay: '2026-10-11' },
  }), contextOf({ files: { launches: 1, sessions: 0 } })), [
    ...HEAD,
    '  read: 1 launch and 0 sessions, from 2026-10-11 to 2026-10-11',
    '  files: 1 of launches, 0 of sessions',
    '',
    'haiku-rule: claude-haiku-5-5, passed as `haiku`, since 2026-10-01',
    '  cli 2.1.100: differs, 1 launch, the last on 2026-10-11 (claude-opus-5-0 x 1)',
    '      claude-opus-5-0 on 2026-10-11: c.jsonl',
    '',
    NOT_COMPARED,
    'FAIL  haiku-rule: `haiku` gave claude-opus-5-0 on cli 2.1.100 (2026-10-11, c.jsonl), and the rule says claude-haiku-5-5',
    'To the lead: the short name of haiku-rule no longer gives the declared model on the engine in use; the alias or the way of launching changes, by a reading.',
  ]);
});

test('two fails of two rules: the ids are joined with and in the To the lead line', () => {
  const sonnet = { id: 'sonnet-rule', alias: 'sonnet', value: 'claude-sonnet-5-5' };
  const lines = appliedLines(
    emptyResult({ rules: [differsRule(), differsRule(sonnet)], fails: [failOf(), failOf(sonnet)] }),
    contextOf(),
  );
  assert.equal(lines.filter((line) => line.startsWith('FAIL  ')).length, 2);
  assert.equal(lines.at(-1), 'To the lead: the short name of haiku-rule and sonnet-rule no longer gives the declared model on the engine in use; the alias or the way of launching changes, by a reading.');
  assert.ok(!lines.includes('PASS  rules applied: each short name gave its model'));
});

test('two fails of one rule: the id is written once in the To the lead line', () => {
  const lines = appliedLines(
    emptyResult({ rules: [differsRule()], fails: [failOf(), failOf({ entrypoint: 'desktop', version: '2.1.99' })] }),
    contextOf(),
  );
  assert.equal(lines.filter((line) => line.startsWith('FAIL  ')).length, 2);
  assert.equal(lines.at(-1), 'To the lead: the short name of haiku-rule no longer gives the declared model on the engine in use; the alias or the way of launching changes, by a reading.');
  assert.ok(!lines.includes('PASS  rules applied: each short name gave its model'));
});

test('the fullest case: no line ends with a space, no two empty lines in a row, and none at the end', () => {
  const sonnet = { id: 'sonnet-rule', alias: 'sonnet', value: 'claude-sonnet-5-5' };
  const lines = appliedLines(
    emptyResult({
      rules: [differsRule(), differsRule(sonnet)],
      fails: [failOf(), failOf(sonnet)],
      read: { launches: 2, sessions: 1, firstDay: '2026-10-10', lastDay: '2026-10-11' },
      skipped: { noVersion: 1, synthetic: 1, noTime: 1, old: 1 },
      otherAliases: [{ alias: 'opus', agentType: null, count: 1 }],
      noModel: [{ agentType: 'explore', model: 'claude-sonnet-5-5', count: 1 }],
      otherModels: [{ model: 'claude-haiku-5-5', count: 2 }],
    }),
    contextOf({
      files: { launches: 2, sessions: 1 },
      capped: true,
      unreadable: [{ file: 'a.jsonl', reason: 'not JSON' }],
      leftOut: { elsewhere: 1, behind: 1 },
    }),
  );
  assert.deepEqual(lines.filter((line) => line.endsWith(' ')), []);
  assert.deepEqual(lines.filter((line, i) => line === '' && lines[i - 1] === ''), []);
  assert.notEqual(lines.at(-1), '');
});

test('held: every session agrees with a model rule', () => {
  const out = run([rule({ id: 'session-model' })], [], [
    session(),
    session({ at: '2026-10-10T10:00:00.000Z', file: 't.jsonl' }),
  ], { held: [{ id: 'session-model', of: 'sessions', field: 'model' }] });
  assert.deepEqual(out.held, [{
    id: 'session-model',
    value: 'claude-haiku-5-5',
    since: '2026-10-01',
    of: 'sessions',
    field: 'model',
    compared: 2,
    agree: 2,
    none: 0,
    others: [],
  }]);
});

test('held: a dated model id agrees, and is compared by its plain id', () => {
  const out = run([rule({ id: 'session-model' })], [], [session({ model: 'claude-haiku-5-5-20251001' })], {
    held: [{ id: 'session-model', of: 'sessions', field: 'model' }],
  });
  assert.equal(out.held[0].agree, 1);
  assert.deepEqual(out.held[0].others, []);
});

test('held: another value is grouped by its entry point, with the last day and file of the group', () => {
  const out = run([rule({ id: 'session-model' })], [], [
    session(),
    session({ entrypoint: 'claude-desktop', model: 'claude-sonnet-5-5', at: '2026-10-10T10:00:00.000Z', file: 'x.jsonl' }),
    session({ entrypoint: 'claude-desktop', model: 'claude-sonnet-5-5', at: '2026-10-11T08:00:00.000Z', file: 'y.jsonl' }),
  ], { held: [{ id: 'session-model', of: 'sessions', field: 'model' }] });
  assert.equal(out.held[0].compared, 3);
  assert.equal(out.held[0].agree, 1);
  assert.deepEqual(out.held[0].others, [
    { value: 'claude-sonnet-5-5', from: 'claude-desktop', count: 2, last: '2026-10-11', file: 'y.jsonl' },
  ]);
});

test('held: other values are ordered by count, most first, then by value', () => {
  const out = run([rule({ id: 'session-model' })], [], [
    session({ model: 'claude-sonnet-5-5' }),
    session({ model: 'claude-haiku-4-5-20251001' }),
    session({ model: 'claude-opus-5-0', entrypoint: 'desktop' }),
    session({ model: 'claude-opus-5-0', entrypoint: 'desktop', at: '2026-10-10T10:00:00.000Z' }),
  ], { held: [{ id: 'session-model', of: 'sessions', field: 'model' }] });
  assert.deepEqual(out.held[0].others.map((other) => [other.value, other.count]), [
    ['claude-opus-5-0', 2],
    ['claude-haiku-4-5', 1],
    ['claude-sonnet-5-5', 1],
  ]);
});

test('held: the efforts of launches are grouped by agent type, null first among equals', () => {
  const out = run([{ id: 'subagent-effort', value: 'high', since: '2026-10-01' }], [
    launch({ effort: 'medium', agentType: 'general-purpose', at: '2026-10-11T10:00:00.000Z', file: 'a.jsonl' }),
    launch({ effort: 'medium', agentType: null, at: '2026-10-11T11:00:00.000Z', file: 'b.jsonl' }),
    launch({ effort: 'low', agentType: 'explore', at: '2026-10-10T10:00:00.000Z', file: 'c.jsonl' }),
    launch({ effort: 'low', agentType: 'explore', at: '2026-10-11T12:00:00.000Z', file: 'd.jsonl' }),
  ], [], { held: [{ id: 'subagent-effort', of: 'launches', field: 'effort' }] });
  assert.deepEqual(out.held[0].others, [
    { value: 'low', from: 'explore', count: 2, last: '2026-10-11', file: 'd.jsonl' },
    { value: 'medium', from: null, count: 1, last: '2026-10-11', file: 'b.jsonl' },
    { value: 'medium', from: 'general-purpose', count: 1, last: '2026-10-11', file: 'a.jsonl' },
  ]);
});

test('held: an entry with no effort, a launch or a session, is counted in none', () => {
  const out = run([
    { id: 'session-effort', value: 'high', since: '2026-10-01' },
    { id: 'subagent-effort', value: 'high', since: '2026-10-01' },
  ], [
    launch({ effort: 'high' }),
    launch({ effort: null }),
    launch({ effort: '   ' }),
  ], [
    session({ effort: 'high' }),
    session({ effort: '' }),
  ], { held: [
    { id: 'session-effort', of: 'sessions', field: 'effort' },
    { id: 'subagent-effort', of: 'launches', field: 'effort' },
  ] });
  assert.deepEqual(out.held.map((item) => [item.compared, item.agree, item.none, item.others]), [
    [2, 1, 1, []],
    [3, 1, 2, []],
  ]);
});

test('held: a session whose model is no text is skipped as synthetic, so no held model counts none', () => {
  const out = run([rule({ id: 'session-model' })], [], [
    session(),
    session({ model: null, file: 'no-model.jsonl' }),
  ], { held: [{ id: 'session-model', of: 'sessions', field: 'model' }] });
  assert.equal(out.held[0].compared, 1);
  assert.equal(out.held[0].agree, 1);
  assert.equal(out.held[0].none, 0);
  assert.equal(out.skipped.synthetic, 1);
});

test('held: an entry before since is not taken', () => {
  const out = run([rule({ id: 'session-model', since: '2026-10-05' })], [], [
    session({ model: 'claude-sonnet-5-5', at: '2026-10-03T10:00:00.000Z' }),
    session(),
  ], { days: 30, held: [{ id: 'session-model', of: 'sessions', field: 'model' }] });
  assert.equal(out.held[0].compared, 1);
  assert.equal(out.held[0].agree, 1);
  assert.deepEqual(out.held[0].others, []);
});

test('held: no entry at all is compared 0', () => {
  const out = run([rule({ id: 'session-model' })], [], [], {
    held: [{ id: 'session-model', of: 'sessions', field: 'model' }],
  });
  assert.deepEqual(out.held, [{
    id: 'session-model',
    value: 'claude-haiku-5-5',
    since: '2026-10-01',
    of: 'sessions',
    field: 'model',
    compared: 0,
    agree: 0,
    none: 0,
    others: [],
  }]);
});

test('held: an id with no rule, a rule with no text value, and a malformed item give nothing', () => {
  const out = run([
    rule({ id: 'session-model' }),
    { id: 'blank', value: '  ', since: '2026-10-01' },
  ], [], [session()], { held: [
    { id: 'nope', of: 'sessions', field: 'model' },
    { id: 'blank', of: 'sessions', field: 'model' },
    null,
    'session-model',
    { id: 'session-model', of: 'sessions' },
    { id: 'session-model', of: 'days', field: 'model' },
    { id: 'session-model', of: 'sessions', field: 'model' },
  ] });
  assert.deepEqual(out.held.map((item) => item.id), ['session-model']);
});

test('held: a record that differs from two held rules is counted once in heldOther', () => {
  const out = run([
    rule({ id: 'session-model' }),
    { id: 'session-effort', value: 'high', since: '2026-10-01' },
  ], [], [
    session({ model: 'claude-sonnet-5-5', effort: 'medium' }),
    session({ effort: 'high' }),
  ], { held: [
    { id: 'session-model', of: 'sessions', field: 'model' },
    { id: 'session-effort', of: 'sessions', field: 'effort' },
  ] });
  assert.deepEqual(out.held.map((item) => item.others.map((other) => other.count)), [[1], [1]]);
  assert.equal(out.heldOther, 1);
});

test('held: heldOther counts every record that differs from an item, whatever its other value', () => {
  const out = run([
    rule({ id: 'session-model' }),
    { id: 'subagent-effort', value: 'high', since: '2026-10-01' },
  ], [launch({ effort: 'low' })], [
    session({ model: 'claude-sonnet-5-5' }),
    session({ model: 'claude-sonnet-5-5', entrypoint: 'desktop' }),
    session({ model: 'claude-opus-5-0' }),
  ], { held: [
    { id: 'session-model', of: 'sessions', field: 'model' },
    { id: 'subagent-effort', of: 'launches', field: 'effort' },
  ] });
  assert.equal(out.heldOther, 4);
});

test('held: forLead counts only launches that passed a declared short name', () => {
  const out = run([rule(), { id: 'subagent-effort', value: 'high', since: '2026-10-01' }], [
    launch({ alias: 'haiku', effort: 'low' }),
    launch({ alias: 'haiku', effort: 'low' }),
    launch({ alias: 'sonnet', effort: 'low' }),
    launch({ alias: null, effort: 'low' }),
  ], [], { held: [{ id: 'subagent-effort', of: 'launches', field: 'effort' }] });
  assert.deepEqual(out.forLead, [{ id: 'subagent-effort', value: 'high', count: 2 }]);
});

test('held: forLead is empty when the differing launches passed no declared short name', () => {
  const out = run([rule(), { id: 'subagent-effort', value: 'high', since: '2026-10-01' }], [
    launch({ alias: null, effort: 'low' }),
    launch({ alias: 'sonnet', effort: 'low' }),
  ], [], { held: [{ id: 'subagent-effort', of: 'launches', field: 'effort' }] });
  assert.equal(out.heldOther, 2);
  assert.deepEqual(out.forLead, []);
});

test('held: a difference is information, so the exit is 0', () => {
  const out = run([{ id: 'session-model', value: 'claude-haiku-5-5', since: '2026-10-01' }], [], [
    session({ model: 'claude-opus-5-0' }),
  ], { held: [{ id: 'session-model', of: 'sessions', field: 'model' }] });
  assert.equal(out.heldOther, 1);
  assert.equal(out.exit, 0);
  assert.deepEqual(out.fails, []);
});

test('held: without the option, held is empty, heldOther is 0 and forLead is empty', () => {
  const out = run([rule()], [launch()]);
  assert.deepEqual([out.held, out.heldOther, out.forLead], [[], 0, []]);
});

test('held: the rules, the entries and the held items are not changed', () => {
  const rules = [
    { id: 'session-model', value: 'claude-haiku-5-5', since: '2026-10-01' },
    { id: 'subagent-effort', value: 'high', since: '2026-10-01' },
  ];
  const launches = [launch({ effort: 'low' }), null];
  const sessions = [session({ model: 'claude-opus-5-0' })];
  const held = [
    { id: 'session-model', of: 'sessions', field: 'model' },
    { id: 'subagent-effort', of: 'launches', field: 'effort' },
  ];
  const options = { today: TODAY, days: 7, held };
  const before = structuredClone([rules, launches, sessions, options]);
  appliedOf(rules, launches, sessions, options);
  assert.deepEqual([rules, launches, sessions, options], before);
});

test('held: the whole block of two rules, sessions and launches, as the spec shows it', () => {
  assert.deepEqual(appliedLines(emptyResult({
    held: [
      {
        id: 'session-effort', value: 'high', since: '2026-10-10', of: 'sessions', field: 'effort',
        compared: 27, agree: 25, none: 0,
        others: [{ value: 'medium', from: 'claude-desktop', count: 2, last: '2026-10-11', file: 'x.jsonl' }],
      },
      {
        id: 'subagent-effort', value: 'high', since: '2026-10-07', of: 'launches', field: 'effort',
        compared: 163, agree: 160, none: 2,
        others: [{ value: 'medium', from: 'general-purpose', count: 1, last: '2026-10-12', file: 'y.jsonl' }],
      },
    ],
  }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    'What ran, against the rules with no short name (information, never a failure):',
    '  session-effort: high, since 2026-10-10',
    '    agree: 25 of 27 sessions',
    '    medium: 2 sessions on claude-desktop, the last on 2026-10-11',
    '      x.jsonl',
    '  subagent-effort: high, since 2026-10-07',
    '    agree: 160 of 163 launches',
    '    no effort recorded: 2 launches',
    '    medium: 1 launch of general-purpose, the last on 2026-10-12',
    '      y.jsonl',
    '',
    NOT_COMPARED,
  ]);
});

test('held: singular forms, 1 of 1 session and 1 of 1 launch, and 1 session and 1 launch in the others', () => {
  assert.deepEqual(appliedLines(emptyResult({
    held: [
      {
        id: 'session-effort', value: 'high', since: '2026-10-10', of: 'sessions', field: 'effort',
        compared: 1, agree: 0, none: 0,
        others: [{ value: 'medium', from: 'claude-desktop', count: 1, last: '2026-10-11', file: 's.jsonl' }],
      },
      {
        id: 'subagent-effort', value: 'high', since: '2026-10-07', of: 'launches', field: 'effort',
        compared: 1, agree: 1, none: 0, others: [],
      },
    ],
  }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    'What ran, against the rules with no short name (information, never a failure):',
    '  session-effort: high, since 2026-10-10',
    '    agree: 0 of 1 session',
    '    medium: 1 session on claude-desktop, the last on 2026-10-11',
    '      s.jsonl',
    '  subagent-effort: high, since 2026-10-07',
    '    agree: 1 of 1 launch',
    '',
    NOT_COMPARED,
  ]);
});

test('held: compared 0 is one line of nothing to compare, for a session and for a launch', () => {
  assert.deepEqual(appliedLines(emptyResult({
    held: [
      { id: 'session-effort', value: 'high', since: '2026-10-10', of: 'sessions', field: 'effort', compared: 0, agree: 0, none: 0, others: [] },
      { id: 'subagent-effort', value: 'high', since: '2026-10-07', of: 'launches', field: 'effort', compared: 0, agree: 0, none: 0, others: [] },
    ],
  }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    'What ran, against the rules with no short name (information, never a failure):',
    '  session-effort: high, since 2026-10-10',
    '    nothing to compare: no session in the window since that day',
    '  subagent-effort: high, since 2026-10-07',
    '    nothing to compare: no launch in the window since that day',
    '',
    NOT_COMPARED,
  ]);
});

test('held: others with no agent type are written of no agent type, and unknown for a session; no effort recorded is singular for 1', () => {
  assert.deepEqual(appliedLines(emptyResult({
    held: [
      {
        id: 'session-effort', value: 'high', since: '2026-10-10', of: 'sessions', field: 'effort',
        compared: 1, agree: 0, none: 0,
        others: [{ value: 'medium', from: null, count: 1, last: '2026-10-11', file: 'u.jsonl' }],
      },
      {
        id: 'subagent-effort', value: 'high', since: '2026-10-07', of: 'launches', field: 'effort',
        compared: 2, agree: 0, none: 1,
        others: [{ value: 'low', from: null, count: 1, last: '2026-10-10', file: 'n.jsonl' }],
      },
    ],
  }), contextOf()), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    'What ran, against the rules with no short name (information, never a failure):',
    '  session-effort: high, since 2026-10-10',
    '    agree: 0 of 1 session',
    '    medium: 1 session on unknown, the last on 2026-10-11',
    '      u.jsonl',
    '  subagent-effort: high, since 2026-10-07',
    '    agree: 0 of 2 launches',
    '    no effort recorded: 1 launch',
    '    low: 1 launch of no agent type, the last on 2026-10-10',
    '      n.jsonl',
    '',
    NOT_COMPARED,
  ]);
});

test('held: no block when held is empty or missing', () => {
  const without = appliedLines(emptyResult(), contextOf());
  assert.deepEqual(appliedLines(emptyResult({ held: [] }), contextOf()), without);
  assert.equal(without.includes('What ran, against the rules with no short name (information, never a failure):'), false);
});

test('held: the block comes after the counted blocks and before Left out, with one empty line around it', () => {
  assert.deepEqual(appliedLines(emptyResult({
    otherModels: [{ model: 'claude-sonnet-5-5', count: 2 }],
    held: [
      { id: 'session-effort', value: 'high', since: '2026-10-10', of: 'sessions', field: 'effort', compared: 1, agree: 1, none: 0, others: [] },
    ],
  }), contextOf({ leftOut: { elsewhere: 1, behind: 0 } })), [
    ...HEAD,
    NOTHING_READ,
    FILES_ONE,
    '',
    'no rule with an alias is in force here',
    '',
    "Models that no rule's value names:",
    '  claude-sonnet-5-5: 2',
    '',
    'What ran, against the rules with no short name (information, never a failure):',
    '  session-effort: high, since 2026-10-10',
    '    agree: 1 of 1 session',
    '',
    "Left out: 1 rule of the harness's own repository, not in force in this project",
    NOT_COMPARED,
  ]);
});

test('held: the To the lead effort line comes after the pass line, with 1 launch or 2 launches', () => {
  const lines = appliedLines(emptyResult({
    rules: [agreeingRule()],
    forLead: [{ id: 'subagent-effort', value: 'high', count: 1 }, { id: 'review-effort', value: 'low', count: 2 }],
  }), contextOf());
  assert.deepEqual(lines.slice(-3), [
    'PASS  rules applied: each short name gave its model',
    "To the lead: 1 launch that passed a declared short name ran at another effort than subagent-effort says (high); a call that passes no effort takes its session's.",
    "To the lead: 2 launches that passed a declared short name ran at another effort than review-effort says (low); a call that passes no effort takes its session's.",
  ]);
});

test('held: the Information line comes last, after a FAIL and its To the lead line, with 2 records', () => {
  const lines = appliedLines(emptyResult({ rules: [differsRule()], fails: [failOf()], heldOther: 2 }), contextOf());
  assert.deepEqual(lines.slice(-3), [
    'FAIL  haiku-rule: `haiku` gave claude-opus-5-0 on cli 2.1.100 (2026-10-11, c.jsonl), and the rule says claude-haiku-5-5',
    'To the lead: the short name of haiku-rule no longer gives the declared model on the engine in use; the alias or the way of launching changes, by a reading.',
    'Information: 2 records ran at another value than a rule of the block above says; this is no failure.',
  ]);
});

test('held: the Information line says 1 record, and comes after the pass line', () => {
  const lines = appliedLines(emptyResult({ rules: [agreeingRule()], heldOther: 1 }), contextOf());
  assert.equal(lines.at(-2), 'PASS  rules applied: each short name gave its model');
  assert.equal(lines.at(-1), 'Information: 1 record ran at another value than a rule of the block above says; this is no failure.');
});

test('held: no block, no To the lead line and no Information line when there are no records', () => {
  assert.deepEqual(appliedLines(emptyResult({
    held: [{ id: 'session-effort', value: 'high', since: '2026-10-10', of: 'sessions', field: 'effort', compared: 1, agree: 1, none: 0, others: [] }],
    forLead: [{ id: 'subagent-effort', value: 'high', count: 1 }],
    heldOther: 1,
  }), contextOf({ exists: false })), [
    ...HEAD,
    '  no records there: nothing was read',
    NOT_COMPARED,
  ]);
});

test('held: the fullest case with the block, the lead line and the Information line has no trailing space and no two empty lines in a row', () => {
  const lines = appliedLines(emptyResult({
    rules: [differsRule()],
    fails: [failOf()],
    held: [
      {
        id: 'session-effort', value: 'high', since: '2026-10-10', of: 'sessions', field: 'effort',
        compared: 4, agree: 1, none: 1,
        others: [{ value: 'medium', from: null, count: 2, last: '2026-10-11', file: 'u.jsonl' }],
      },
      { id: 'subagent-effort', value: 'high', since: '2026-10-07', of: 'launches', field: 'effort', compared: 0, agree: 0, none: 0, others: [] },
    ],
    forLead: [{ id: 'subagent-effort', value: 'high', count: 2 }],
    heldOther: 2,
    otherAliases: [{ alias: 'opus', agentType: null, count: 1 }],
  }), contextOf({ leftOut: { elsewhere: 1, behind: 1 }, unreadable: [{ file: 'a.jsonl', reason: 'not JSON' }] }));
  assert.deepEqual(lines.filter((line) => line.endsWith(' ')), []);
  assert.deepEqual(lines.filter((line, i) => line === '' && lines[i - 1] === ''), []);
  assert.equal(lines.at(-1), 'Information: 2 records ran at another value than a rule of the block above says; this is no failure.');
});

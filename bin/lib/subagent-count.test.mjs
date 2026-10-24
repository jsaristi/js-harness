import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verbOf, roleOf, usageOf, dayOf, callsOf, launchesOf, countOf } from './subagent-count.mjs';

test('verbOf returns the lower-cased first word', () => {
  assert.equal(verbOf('Write x'), 'write');
  assert.equal(verbOf('MAP flow'), 'map');
  assert.equal(verbOf('   Attack the design'), 'attack');
});

test('verbOf strips trailing punctuation from the first word', () => {
  assert.equal(verbOf('Writer: T4b'), 'writer');
  assert.equal(verbOf('Review, then ship'), 'review');
});

test('verbOf is null when there is no usable word', () => {
  assert.equal(verbOf(''), null);
  assert.equal(verbOf('   '), null);
  assert.equal(verbOf('!!! ...'), null);
  assert.equal(verbOf(null), null);
  assert.equal(verbOf(undefined), null);
  assert.equal(verbOf(42), null);
  assert.equal(verbOf({ text: 'Write' }), null);
});

test('rule 1: Explore, Plan and claude-code-guide are explorers', () => {
  assert.equal(roleOf({ subagentType: 'Explore', description: 'x' }), 'explorer');
  assert.equal(roleOf({ subagentType: 'Plan', description: 'x' }), 'explorer');
  assert.equal(roleOf({ subagentType: 'claude-code-guide', description: 'x' }), 'explorer');
});

test('rule 1: review-* and jd-judge* subagent types are reviewers', () => {
  assert.equal(roleOf({ subagentType: 'review-risk', description: 'x' }), 'reviewer');
  assert.equal(roleOf({ subagentType: 'review-refuter' }), 'reviewer');
  assert.equal(roleOf({ subagentType: 'jd-judge-a' }), 'reviewer');
  assert.equal(roleOf({ subagentType: 'jd-judge' }), 'reviewer');
});

test('rule 1: jd-fix-agent is a writer', () => {
  assert.equal(roleOf({ subagentType: 'jd-fix-agent', description: 'x' }), 'writer');
});

test('rule 1 falls through for other types and for a dash-less review prefix', () => {
  assert.equal(roleOf({ subagentType: 'general-purpose', description: 'Write x' }), 'writer');
  assert.equal(roleOf({ subagentType: 'claude', description: 'check x' }), 'verifier');
  assert.equal(roleOf({ subagentType: 'reviewer', description: 'Write x' }), 'writer');
});

test('rule 1 beats rule 2: the subagent type wins over the description verb', () => {
  assert.equal(roleOf({ subagentType: 'Explore', description: 'Write x' }), 'explorer');
  assert.equal(roleOf({ subagentType: 'review-risk', description: 'Write x' }), 'reviewer');
});

const VERB_ROLES = {
  writer: ['write', 'writer', 'fix', 'implement', 'apply', 'build', 'add', 'rewrite'],
  explorer: ['map', 'find', 'sweep', 'explore', 'search', 'locate', 'survey', 'look'],
  reviewer: ['attack', 'reader', 'review', 'read', 'judge', 'critique', 'refute'],
  verifier: ['verify', 'measure', 'count', 'check', 'test', 'probe', 'confirm'],
};

for (const [role, verbs] of Object.entries(VERB_ROLES)) {
  test(`rule 2: every ${role} verb maps to ${role} when the type is general-purpose`, () => {
    for (const verb of verbs) {
      assert.equal(
        roleOf({ subagentType: 'general-purpose', description: `${verb} the thing`, model: 'opus' }),
        role,
        `verb "${verb}"`,
      );
    }
  });
}

test('rule 2: the verb is only the first word of the description', () => {
  assert.equal(roleOf({ description: 'Please write the file', model: 'opus' }), 'other');
});

test('rule 2 beats rule 3: a known verb on haiku keeps its role', () => {
  assert.equal(roleOf({ description: 'Attack the design', model: 'haiku' }), 'reviewer');
  assert.equal(roleOf({ description: 'Map flow', model: 'claude-haiku-5-5' }), 'explorer');
});

test('rule 3: an unknown verb on a haiku model is a writer', () => {
  assert.equal(roleOf({ description: 'Frobnicate x', model: 'haiku' }), 'writer');
  assert.equal(roleOf({ description: 'Frobnicate x', model: 'claude-haiku-5-5' }), 'writer');
  assert.equal(roleOf({ description: 'Frobnicate x', model: 'HAIKU' }), 'writer');
});

test('rule 4: an unknown verb on opus or sonnet is other', () => {
  assert.equal(roleOf({ description: 'Frobnicate x', model: 'opus' }), 'other');
  assert.equal(roleOf({ description: 'Frobnicate x', model: 'claude-sonnet-5-5' }), 'other');
});

test('writer on the verb "Writer: T4b" with punctuation stripped', () => {
  assert.equal(roleOf({ description: 'Writer: T4b', model: 'opus' }), 'writer');
});

test('case of the verb does not matter', () => {
  assert.equal(roleOf({ description: 'MAP flow', model: 'opus' }), 'explorer');
});

test('never throws: missing, null or wrong-typed arguments are other', () => {
  assert.equal(roleOf(), 'other');
  assert.equal(roleOf(null), 'other');
  assert.equal(roleOf(undefined), 'other');
  assert.equal(roleOf('Write x'), 'other');
  assert.equal(roleOf({}), 'other');
  assert.equal(roleOf({ subagentType: null, description: '', model: null }), 'other');
  assert.equal(roleOf({ subagentType: 5, description: ['Write'], model: 7 }), 'other');
});

const assistant = (message, extra = {}) => ({ type: 'assistant', message, ...extra });

test('a message id repeated on several lines with identical usage counts once', () => {
  const usage = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 };
  const entries = [
    assistant({ id: 'm1', usage }),
    assistant({ id: 'm1', usage }),
    assistant({ id: 'm1', usage }),
  ];
  assert.deepEqual(usageOf(entries), { input: 10, cacheCreation: 100, cacheRead: 1000, output: 5, messages: 1 });
});

test('a repeated message id keeps the largest value of each field separately', () => {
  const entries = [
    assistant({ id: 'm1', usage: { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 50, cache_read_input_tokens: 0 } }),
    assistant({ id: 'm1', usage: { input_tokens: 10, output_tokens: 7, cache_creation_input_tokens: 40, cache_read_input_tokens: 200 } }),
  ];
  assert.deepEqual(usageOf(entries), { input: 10, cacheCreation: 50, cacheRead: 200, output: 7, messages: 1 });
});

test('without a message id the requestId keys the request', () => {
  const usage = { input_tokens: 3, output_tokens: 4 };
  const entries = [
    assistant({ usage }, { requestId: 'r1' }),
    assistant({ usage: { input_tokens: 3, output_tokens: 9 } }, { requestId: 'r1' }),
    assistant({ usage }, { requestId: 'r2' }),
  ];
  assert.deepEqual(usageOf(entries), { input: 6, cacheCreation: 0, cacheRead: 0, output: 13, messages: 2 });
});

test('an entry with neither message id nor requestId is counted on its own', () => {
  const usage = { input_tokens: 2, output_tokens: 1 };
  const entries = [assistant({ usage }), assistant({ usage })];
  assert.deepEqual(usageOf(entries), { input: 4, cacheCreation: 0, cacheRead: 0, output: 2, messages: 2 });
});

test('synthetic model entries are skipped', () => {
  const entries = [assistant({ id: 'm1', model: '<synthetic>', usage: { input_tokens: 99, output_tokens: 99 } })];
  assert.deepEqual(usageOf(entries), { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, messages: 0 });
});

test('entries that are not assistant lines are skipped', () => {
  const entries = [
    { type: 'user', message: { id: 'u1', usage: { input_tokens: 50, output_tokens: 50 } } },
    { type: 'system', message: { id: 's1', usage: { input_tokens: 50, output_tokens: 50 } } },
  ];
  assert.deepEqual(usageOf(entries), { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, messages: 0 });
});

test('malformed entries are skipped without throwing and valid ones still count', () => {
  const entries = [
    null,
    undefined,
    'assistant',
    42,
    { type: 'assistant' },
    { type: 'assistant', message: null },
    { type: 'assistant', message: { id: 'bad', usage: 'many' } },
    { type: 'assistant', message: { id: 'bad2', usage: null } },
    { type: 'assistant', message: { id: 'bad3', usage: ['x'] } },
    assistant({ id: 'ok', usage: { input_tokens: 7, output_tokens: 8 } }),
  ];
  assert.doesNotThrow(() => usageOf(entries));
  assert.deepEqual(usageOf(entries), { input: 7, cacheCreation: 0, cacheRead: 0, output: 8, messages: 1 });
});

test('a missing or non-number field counts as zero', () => {
  const entries = [assistant({ id: 'm1', usage: { input_tokens: 'lots', output_tokens: 3, cache_read_input_tokens: null } })];
  assert.deepEqual(usageOf(entries), { input: 0, cacheCreation: 0, cacheRead: 0, output: 3, messages: 1 });
});

test('an empty array gives all zeros', () => {
  assert.deepEqual(usageOf([]), { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, messages: 0 });
});

const BOGOTA = -300;

/** An assistant entry of a record, with its model, effort, usage and time. */
const answer = (id, { model = 'claude-haiku-5-5', effort = 'high', at = '2026-10-14T15:00:00Z', input = 10, output = 5 } = {}) => ({
  type: 'assistant',
  timestamp: at,
  effort,
  message: { id, model, usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: 100, cache_creation_input_tokens: 1 } },
});

/** A parent's entry that launches a sub-agent through the Agent tool. */
const launch = (toolUseId, input) => ({ type: 'assistant', message: { id: `p-${toolUseId}`, model: 'claude-opus-5-5', content: [{ type: 'tool_use', id: toolUseId, name: 'Agent', input }] } });

test('dayOf reads the local day at the given offset, so evening work stays on its own day', () => {
  assert.equal(dayOf('2026-10-15T02:30:00Z', BOGOTA), '2026-10-14');
  assert.equal(dayOf('2026-10-15T05:30:00Z', BOGOTA), '2026-10-15');
  assert.equal(dayOf('not a time', BOGOTA), null);
});

test('dayOf and launchesOf take the offset of each timestamp, given as a function, and still a number (Codex, 2026-10-15)', () => {
  // UTC-5 until the clock change of 2026-03-08, UTC-4 after it. 04:30Z on the 16th is 23:30 of the 15th in winter.
  const offsetAt = (timestamp) => (timestamp < '2026-03-08T07:00:00.000Z' ? -300 : -240);
  assert.equal(dayOf('2026-01-16T04:30:00Z', offsetAt), '2026-01-15');
  assert.equal(dayOf('2026-07-16T04:30:00Z', offsetAt), '2026-07-16');
  assert.equal(dayOf('2026-01-16T04:30:00Z', BOGOTA), '2026-01-15');
  const record = { session: 's', agentId: 'late', meta: {}, entries: [answer('m1', { at: '2026-01-16T04:30:00Z' })] };
  const [launch] = launchesOf([record], { from: '2026-01-15', to: '2026-01-15', offsetMinutes: offsetAt });
  assert.deepEqual([launch.agentId, launch.started, launch.usage.messages], ['late', true, 1]);
});

test('callsOf keeps the model and effort each Agent or Task call asked for, null when not passed', () => {
  const calls = callsOf([
    launch('t1', { description: 'Write x', model: 'haiku', effort: 'high' }),
    launch('t2', { description: 'Map y' }),
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't3', name: 'Bash', input: {} }] } },
    null,
  ]);
  assert.deepEqual([...calls], [['t1', { model: 'haiku', effort: 'high' }], ['t2', { model: null, effort: null }]]);
});

test('launchesOf joins each record to its call, keeps only the verb of the description, and reads what ran', () => {
  const calls = callsOf([launch('t1', { model: 'haiku', effort: 'high' }), launch('t2', {})]);
  const records = [
    { session: 's1', agentId: 'a1', meta: { agentType: 'general-purpose', description: 'Write the parser SECRET', toolUseId: 't1', model: 'haiku', effort: 'high' }, entries: [answer('m1'), answer('m1')] },
    { session: 's1', agentId: 'a2', meta: { agentType: 'Explore', description: 'Map flow', toolUseId: 't2', effort: 'high' }, entries: [answer('m2', { model: 'claude-opus-5-5', effort: 'medium' })] },
    { session: 's1', agentId: 'a3', meta: { agentType: 'general-purpose', description: 'Ponder', toolUseId: 'gone', effort: 'high' }, entries: [answer('m3', { model: 'claude-opus-5-5' })] },
  ];
  const [writer, explorer, other] = launchesOf(records, { from: '2026-10-14', to: '2026-10-14', offsetMinutes: BOGOTA, calls });
  assert.deepEqual(
    { role: writer.role, verb: writer.verb, modelAsked: writer.modelAsked, effortAsked: writer.effortAsked, inherited: writer.inherited, modelRan: writer.modelRan, effortRan: writer.effortRan },
    { role: 'writer', verb: 'write', modelAsked: 'haiku', effortAsked: 'high', inherited: false, modelRan: 'claude-haiku-5-5', effortRan: 'high' },
  );
  assert.equal(writer.usage.input, 10, 'one message, counted once');
  assert.ok(!JSON.stringify(writer).includes('SECRET'), 'no text of the description beyond its verb');
  assert.deepEqual([explorer.role, explorer.modelAsked, explorer.effortAsked, explorer.inherited, explorer.effortRan], ['explorer', null, null, true, 'medium']);
  assert.deepEqual([other.role, other.effortAsked, other.inherited], ['other', null, null]);
});

test('launchesOf keeps a launch by the local day it started, and skips one with no timestamp', () => {
  const record = (agentId, at) => ({ session: 's', agentId, meta: {}, entries: [answer(agentId, { at })] });
  const records = [record('late', '2026-10-15T03:00:00Z'), record('next', '2026-10-15T06:00:00Z'), { session: 's', agentId: 'none', meta: {}, entries: [{ type: 'user' }] }];
  assert.deepEqual(launchesOf(records, { from: '2026-10-14', to: '2026-10-14', offsetMinutes: BOGOTA }).map((l) => l.agentId), ['late']);
});

test('a launch that crosses midnight counts its tokens on the day each was spent, and as a launch on the day it started', () => {
  const record = { session: 's', agentId: 'night', meta: {}, entries: [answer('m1', { at: '2026-10-14T04:50:00Z', input: 7 }), answer('m2', { at: '2026-10-14T05:10:00Z', input: 11 })] };
  // 23:50 on the 13th and 00:10 on the 14th, in Bogotá.
  const [before] = launchesOf([record], { from: '2026-10-13', to: '2026-10-13', offsetMinutes: BOGOTA });
  assert.deepEqual([before.started, before.usage.input], [true, 7]);
  const [after] = launchesOf([record], { from: '2026-10-14', to: '2026-10-14', offsetMinutes: BOGOTA });
  assert.deepEqual([after.started, after.usage.input], [false, 11]);
  const count = countOf([after], { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 });
  assert.deepEqual([count.total.launches, count.total.input, count.carried], [0, 11, 1]);
});

test('countOf groups by role, model and efforts, totals, and gives each figure its share of the day', () => {
  const usage = (input, output) => ({ input, cacheCreation: 0, cacheRead: 100, output, messages: 1 });
  const launches = [
    { role: 'writer', modelRan: 'claude-haiku-5-5', effortAsked: 'high', effortRan: 'high', inherited: false, usage: usage(10, 5) },
    { role: 'writer', modelRan: 'claude-haiku-5-5', effortAsked: 'high', effortRan: 'high', inherited: false, usage: usage(30, 5) },
    { role: 'other', modelRan: 'claude-opus-5-5', effortAsked: null, effortRan: 'high', inherited: null, usage: usage(0, 10) },
    { role: 'explorer', modelRan: 'claude-opus-5-5', effortAsked: null, effortRan: 'medium', inherited: true, usage: usage(0, 0) },
  ];
  const count = countOf(launches, { input: 40, cacheCreation: 0, cacheRead: 100, output: 20 });
  assert.deepEqual(count.rows.map((row) => [row.role, row.launches, row.input]), [['writer', 2, 40], ['explorer', 1, 0], ['other', 1, 0]]);
  assert.deepEqual(count.total, { launches: 4, input: 40, cacheCreation: 0, cacheRead: 400, output: 20 });
  assert.deepEqual(count.share, { input: 0.5, cacheCreation: null, cacheRead: 0.8, output: 0.5 });
  assert.deepEqual([count.other, count.inherited, count.callNotFound], [1, 1, 1]);
});

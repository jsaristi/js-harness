import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionReading } from './codex-usage.mjs';

// The events `codex exec --json` prints, already parsed (`parseEvents` in ../codex-review.mjs): fixtures
// only, no test here launches Codex.
const thread = { type: 'thread.started', thread_id: 't1' };
const turn = { type: 'turn.started' };
const completed = (usage) => (usage === undefined ? { type: 'turn.completed' } : { type: 'turn.completed', usage });
const item = (type, extra = {}) => ({ type: 'item.completed', item: { id: 'i', type, ...extra } });
const command = (exitCode) => item('command_execution', { command: 'git diff', aggregated_output: '', exit_code: exitCode });
const message = (text = 'ok') => item('agent_message', { text });

const NOTHING = { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null };

test('one completed turn: its four counts, as reported, and one turn', () => {
  // The one review of this repository with full usage (2026-09-30, codex-cli 0.159.1).
  const reading = sessionReading([thread, turn, completed({ input_tokens: 297479, cached_input_tokens: 240640, output_tokens: 2396, reasoning_output_tokens: 703 })]);
  assert.deepEqual(reading.usage, { inputTokens: 297479, cachedInputTokens: 240640, outputTokens: 2396, reasoningOutputTokens: 703 });
  assert.equal(reading.turns, 1);
});

test('the counts are summed over every completed turn, each on its own', () => {
  const reading = sessionReading([
    turn, completed({ input_tokens: 100, cached_input_tokens: 60, output_tokens: 10, reasoning_output_tokens: 4 }),
    turn, completed({ input_tokens: 200, cached_input_tokens: 150, output_tokens: 20, reasoning_output_tokens: 6 }),
  ]);
  // The cached tokens are a part of the input, and the reasoning tokens are kept apart: nothing is added across counts.
  assert.deepEqual(reading.usage, { inputTokens: 300, cachedInputTokens: 210, outputTokens: 30, reasoningOutputTokens: 10 });
  assert.equal(reading.turns, 2);
});

test('with no completed turn every count is null, not 0, and there are no turns', () => {
  for (const events of [[], [thread, turn], [thread, turn, message(), { type: 'turn.failed', error: { message: 'x' } }]]) {
    const reading = sessionReading(events);
    assert.deepEqual(reading.usage, NOTHING);
    assert.equal(reading.turns, 0);
  }
});

test('a count no turn reported is null while the others are summed, and a reported 0 stays 0', () => {
  const reading = sessionReading([completed({ input_tokens: 5, cached_input_tokens: 0, output_tokens: 2 }), completed({ input_tokens: 7, output_tokens: 1 })]);
  assert.deepEqual(reading.usage, { inputTokens: 12, cachedInputTokens: 0, outputTokens: 3, reasoningOutputTokens: null });
});

test('a turn that completed without usage is still a turn and adds nothing', () => {
  for (const usage of [undefined, null, 'none', 12, []]) {
    const reading = sessionReading([completed(usage)]);
    assert.deepEqual(reading.usage, NOTHING, JSON.stringify(usage));
    assert.equal(reading.turns, 1);
  }
});

test('a value that is not a number, or is negative, is ignored', () => {
  for (const bad of ['12', null, true, {}, [3], -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const alone = sessionReading([completed({ input_tokens: bad, output_tokens: 4 })]);
    assert.deepEqual(alone.usage, { ...NOTHING, outputTokens: 4 }, String(bad));
    const beside = sessionReading([completed({ input_tokens: bad }), completed({ input_tokens: 9 })]);
    assert.equal(beside.usage.inputTokens, 9, String(bad));
  }
});

test('only `turn.completed` carries usage: other events with one are not read', () => {
  const usage = { input_tokens: 50, output_tokens: 5 };
  const reading = sessionReading([{ type: 'turn.started', usage }, { type: 'turn.failed', usage }, { type: 'item.completed', usage, item: { type: 'reasoning' } }]);
  assert.deepEqual(reading.usage, NOTHING);
  assert.equal(reading.turns, 0);
});

test('the completed items are counted by type, whatever the type, with sorted keys', () => {
  const reading = sessionReading([
    thread, turn,
    item('reasoning'), command(0), item('mcp_tool_call', { server: 's', tool: 't' }), item('reasoning'),
    command(0), item('a_type_nobody_listed'), item('reasoning'), message(), completed({}),
  ]);
  assert.deepEqual(reading.items, { a_type_nobody_listed: 1, agent_message: 1, command_execution: 2, mcp_tool_call: 1, reasoning: 3 });
  assert.deepEqual(Object.keys(reading.items), ['a_type_nobody_listed', 'agent_message', 'command_execution', 'mcp_tool_call', 'reasoning']);
});

test('an item that only started, or that names no type, is not counted', () => {
  const reading = sessionReading([
    { type: 'item.started', item: { type: 'command_execution', command: 'git diff', exit_code: null } },
    { type: 'item.updated', item: { type: 'todo_list' } },
    { type: 'item.completed' },
    { type: 'item.completed', item: null },
    { type: 'item.completed', item: {} },
    { type: 'item.completed', item: { type: 7 } },
    { type: 'item.completed', item: { type: '' } },
  ]);
  assert.deepEqual(reading.items, {});
  assert.deepEqual(reading.commands, { total: 0, failed: 0 });
});

test('a type named like an object member is counted like any other', () => {
  const reading = sessionReading([item('__proto__'), item('constructor'), item('constructor')]);
  assert.deepEqual(Object.entries(reading.items), [['__proto__', 1], ['constructor', 2]]);
});

test('the shell commands: how many ran, and how many did not exit 0', () => {
  const reading = sessionReading([command(0), command(1), command(0), command(128), command(-1), command(null), command(undefined), message()]);
  assert.deepEqual(reading.commands, { total: 7, failed: 5 });
  assert.equal(reading.items.command_execution, 7);
});

test('with no command, none ran and none failed', () => {
  assert.deepEqual(sessionReading([message(), completed({})]).commands, { total: 0, failed: 0 });
});

test('anything that is not a list of events reads as an empty session', () => {
  const empty = { usage: NOTHING, turns: 0, items: {}, commands: { total: 0, failed: 0 } };
  for (const events of [undefined, null, 'text', {}, [null, 'line', 3, []]]) assert.deepEqual(sessionReading(events), empty, JSON.stringify(events));
});

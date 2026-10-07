import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { noRolloutReading, rolloutReading, sessionReading } from './codex-usage.mjs';

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

// --- the rollout files of a Codex home ---

// Every home here is a temporary folder with fixtures in the shape read from Codex's source
// (`protocol/src/protocol.rs:2241-2282` at rust-v0.160.0): no test reads a real Codex home.
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function fakeHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-usage-'));
  made.push(dir);
  return dir;
}

/** The counts of one `TokenUsage`, in Codex's own names. */
const tokens = (input, cached, output, reasoning) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: reasoning,
  total_tokens: input + output,
});

/** One `token_count` line of a rollout file: the thread's running `total` and the `last` response's
 * counts, or an `info` of `null` when `total` is `null`. */
const tokenCount = (total, last = total, timestamp = undefined) => ({
  ...(timestamp === undefined ? {} : { timestamp }),
  type: 'event_msg',
  payload: {
    type: 'token_count',
    info: total === null ? null : { total_token_usage: total, last_token_usage: last, model_context_window: 272000 },
    rate_limits: { primary: null, secondary: null },
  },
});

// Lines a rollout file holds beside the counts, which the reader has no use for.
const meta = { timestamp: '2026-10-07T05:34:00.000Z', type: 'session_meta', payload: { id: 't1', cwd: 'D:\\x' } };
const response = { timestamp: '2026-10-07T05:34:01.000Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [] } };

/** Writes a rollout file of `lines` (objects, or strings taken as they are) at `<home>/sessions/<...dirs>/<name>`. */
function rollout(home, name, lines, dirs = ['2026', '10', '07']) {
  const dir = path.join(home, 'sessions', ...dirs);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n')}\n`, 'utf8');
  return file;
}

const UNREAD = { usage: NOTHING, requests: null, firstRequestInputTokens: null, threads: null };

test('rolloutReading: one thread is its last cumulative count, one request per count, and the first request\'s input', () => {
  const home = fakeHome();
  rollout(home, 'rollout-2026-10-07T05-34-00-aaaa.jsonl', [
    meta,
    tokenCount(tokens(21000, 0, 300, 120)),
    response,
    tokenCount(tokens(45000, 20480, 700, 250), tokens(24000, 20480, 400, 130)),
    tokenCount(tokens(72000, 44032, 1500, 600), tokens(27000, 23552, 800, 350)),
  ]);
  assert.deepEqual(rolloutReading(home), {
    usage: { inputTokens: 72000, cachedInputTokens: 44032, outputTokens: 1500, reasoningOutputTokens: 600 },
    requests: 3,
    firstRequestInputTokens: 21000,
    threads: 1,
  });
});

test('rolloutReading: the counts are summed over the threads, each thread by its own last count', () => {
  const home = fakeHome();
  // The parent thread of `exec review` and the review's sub-agent each write a file; one may hold no count.
  rollout(home, 'rollout-2026-10-07T05-34-00-parent.jsonl', [meta, tokenCount(null), response]);
  rollout(home, 'rollout-2026-10-07T05-34-02-review.jsonl', [tokenCount(tokens(100, 0, 10, 4)), tokenCount(tokens(300, 150, 30, 9), tokens(200, 150, 20, 5))]);
  rollout(home, 'rollout-2026-10-07T05-34-09-other.jsonl', [tokenCount(tokens(5000, 4096, 80, 0))], ['2026', '10', '08']);
  assert.deepEqual(rolloutReading(home), {
    usage: { inputTokens: 5300, cachedInputTokens: 4246, outputTokens: 110, reasoningOutputTokens: 9 },
    requests: 3,
    firstRequestInputTokens: 100,
    threads: 2,
  });
});

test('rolloutReading: with no rollout file nothing is known, which is null and never 0', () => {
  const none = fakeHome();
  const empty = fakeHome();
  fs.mkdirSync(path.join(empty, 'sessions', '2026', '10', '07'), { recursive: true });
  const others = fakeHome();
  rollout(others, 'history.jsonl', [tokenCount(tokens(9, 9, 9, 9))]);
  rollout(others, 'rollout-notes.txt', [tokenCount(tokens(9, 9, 9, 9))]);
  fs.writeFileSync(path.join(others, 'rollout-2026-outside-sessions.jsonl'), `${JSON.stringify(tokenCount(tokens(9, 9, 9, 9)))}\n`, 'utf8');
  for (const home of [none, empty, others, path.join(none, 'nowhere')]) assert.deepEqual(rolloutReading(home), UNREAD, home);
  assert.deepEqual(noRolloutReading(), UNREAD, 'the reading of a home that was not read is the same');
  assert.notEqual(noRolloutReading().usage, noRolloutReading().usage, 'a new object each time, so no caller can change another\'s');
});

test('rolloutReading: a rollout file with no count is a file that was read: no request, no thread, and no token known', () => {
  const home = fakeHome();
  rollout(home, 'rollout-2026-10-07T05-34-00-aaaa.jsonl', [meta, response, tokenCount(null), tokenCount(null)]);
  assert.deepEqual(rolloutReading(home), { usage: NOTHING, requests: 0, firstRequestInputTokens: null, threads: 0 });
});

test('rolloutReading: rollout files are found at any depth under `sessions`', () => {
  const home = fakeHome();
  rollout(home, 'rollout-a.jsonl', [tokenCount(tokens(1, 0, 1, 0))], []);
  rollout(home, 'rollout-b.jsonl', [tokenCount(tokens(2, 0, 2, 0))], ['2026']);
  rollout(home, 'rollout-c.jsonl', [tokenCount(tokens(4, 0, 4, 0))], ['2026', '10', '07', 'deeper', 'still']);
  const reading = rolloutReading(home);
  assert.equal(reading.usage.inputTokens, 7);
  assert.equal(reading.threads, 3);
});

test('rolloutReading: lines it does not know, lines that are not JSON and counts with no `info` are ignored', () => {
  const home = fakeHome();
  const counted = tokenCount(tokens(800, 512, 40, 12));
  rollout(home, 'rollout-2026-10-07T05-34-00-aaaa.jsonl', [
    '', '   ', 'not json', '{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tok', '"a string"', '[1]', 'null', '7',
    meta, response,
    { type: 'event_msg', payload: { type: 'agent_message', info: { total_token_usage: tokens(9, 9, 9, 9), last_token_usage: tokens(9, 9, 9, 9) } } },
    { type: 'event_msg', payload: null },
    { type: 'event_msg' },
    { type: 'event_msg', payload: { type: 'token_count' } },
    { type: 'event_msg', payload: { type: 'token_count', info: 'none' } },
    tokenCount(null),
    `${JSON.stringify(counted)}\r`,
  ]);
  assert.deepEqual(rolloutReading(home), {
    usage: { inputTokens: 800, cachedInputTokens: 512, outputTokens: 40, reasoningOutputTokens: 12 },
    requests: 1,
    firstRequestInputTokens: 800,
    threads: 1,
  });
});

test('rolloutReading: a count that is missing is null, a reported 0 stays 0, and what is not a count is ignored', () => {
  const home = fakeHome();
  rollout(home, 'rollout-a.jsonl', [tokenCount({ input_tokens: 500, cached_input_tokens: 0, output_tokens: '12', reasoning_output_tokens: -3 }, { output_tokens: 12 })]);
  assert.deepEqual(rolloutReading(home), {
    usage: { inputTokens: 500, cachedInputTokens: 0, outputTokens: null, reasoningOutputTokens: null },
    requests: 1,
    firstRequestInputTokens: null,
    threads: 1,
  });
  // A count one thread did not report is still the sum of the threads that did.
  rollout(home, 'rollout-b.jsonl', [tokenCount({ input_tokens: 70, output_tokens: 5 }, { input_tokens: 70 })]);
  assert.deepEqual(rolloutReading(home).usage, { inputTokens: 570, cachedInputTokens: 0, outputTokens: 5, reasoningOutputTokens: null });

  const odd = fakeHome();
  rollout(odd, 'rollout-a.jsonl', [
    { type: 'event_msg', payload: { type: 'token_count', info: {} } },
    { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: 'many', last_token_usage: null } } },
  ]);
  assert.deepEqual(rolloutReading(odd), { usage: NOTHING, requests: 2, firstRequestInputTokens: null, threads: 1 });
});

test('rolloutReading: the first request is the earliest count by its timestamp, whatever the order of the files', () => {
  const home = fakeHome();
  rollout(home, 'rollout-a.jsonl', [
    tokenCount(tokens(900, 0, 9, 0), tokens(900, 0, 9, 0), '2026-10-07T05:34:20.000Z'),
    tokenCount(tokens(1900, 0, 19, 0), tokens(1000, 0, 10, 0), '2026-10-07T05:34:30.000Z'),
  ]);
  rollout(home, 'rollout-b.jsonl', [
    tokenCount(tokens(4321, 0, 9, 0), tokens(4321, 0, 9, 0), '2026-10-07T05:34:05.000Z'),
    tokenCount(tokens(5000, 0, 9, 0), tokens(679, 0, 0, 0), 'not a date'),
  ]);
  assert.equal(rolloutReading(home).firstRequestInputTokens, 4321);
});

test('rolloutReading: with no timestamp to read, the first request is the first count of the first file by name', () => {
  const home = fakeHome();
  // Written in another order than their names, and in folders whose order disagrees with the names.
  rollout(home, 'rollout-2026-10-07T05-34-09-zzzz.jsonl', [tokenCount(tokens(30, 0, 1, 0))], ['2026', '10', '06']);
  rollout(home, 'rollout-2026-10-07T05-34-02-aaaa.jsonl', [tokenCount(null), tokenCount(tokens(10, 0, 1, 0)), tokenCount(tokens(25, 0, 2, 0), tokens(15, 0, 1, 0))], ['2026', '10', '07']);
  assert.equal(rolloutReading(home).firstRequestInputTokens, 10);
  // An earliest count whose input was not reported leaves the first request unknown, not the next one's.
  rollout(home, 'rollout-2026-10-07T05-34-00-0000.jsonl', [tokenCount(tokens(40, 0, 1, 0), { output_tokens: 1 })]);
  assert.equal(rolloutReading(home).firstRequestInputTokens, null);
});

test('rolloutReading never throws: a home that is no path, a `sessions` that is a file, a rollout that is a folder', () => {
  for (const home of [undefined, null, '', 7, {}, ['x']]) assert.deepEqual(rolloutReading(home), UNREAD, JSON.stringify(home));
  const file = fakeHome();
  fs.writeFileSync(path.join(file, 'sessions'), 'not a folder', 'utf8');
  assert.deepEqual(rolloutReading(file), UNREAD);
  const folder = fakeHome();
  fs.mkdirSync(path.join(folder, 'sessions', 'rollout-a-folder.jsonl'), { recursive: true });
  rollout(folder, 'rollout-b.jsonl', [tokenCount(tokens(3, 0, 1, 0))]);
  assert.deepEqual(rolloutReading(folder), { usage: { inputTokens: 3, cachedInputTokens: 0, outputTokens: 1, reasoningOutputTokens: 0 }, requests: 1, firstRequestInputTokens: 3, threads: 1 });
});

test('rolloutReading: an empty home path reads nothing, and never the working directory', () => {
  const cwd = process.cwd();
  const here = fakeHome();
  rollout(here, 'rollout-a.jsonl', [tokenCount(tokens(3, 0, 1, 0))]);
  // This file's tests run one at a time in a process of their own, so the change is seen by no other.
  process.chdir(here);
  try {
    assert.deepEqual(rolloutReading(''), UNREAD);
  } finally {
    process.chdir(cwd);
  }
});

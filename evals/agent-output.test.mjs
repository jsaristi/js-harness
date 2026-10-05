import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCodexFailure, parseCodexOutput, readClaudeOutput, readCodexOutput, summarizeCodexUsage } from './agent-output.mjs';

// A reader is tested here as a pure function of a finished run; `runner.test.mjs` proves each one end to
// end, through a trial of the fake agent.

// ---- Claude Code: `claude --print --output-format json` ---------------------------------------------
//
// The three functions this reader is made of are tested where they have always been (`runner.test.mjs`,
// which imports them through the runner); here it is the reading, the one shape the runner consumes.

const claudeResult = (fields) => JSON.stringify({ type: 'result', is_error: false, result: 'ok', ...fields });

test('readClaudeOutput reads a successful result: no stop, parsed, not failed, and the usage summary', () => {
  const usage = { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 5 };
  const reading = readClaudeOutput({ stdout: claudeResult({ num_turns: 4, usage, total_cost_usd: 0.5 }), stderr: '', exitCode: 0, timedOut: false });
  assert.deepEqual(reading, {
    stop: null,
    parsed: true,
    failed: false,
    usage: { inputTokens: 60, outputTokens: 5, turns: 4, usage, costUsd: 0.5, modelUsage: null, subagents: null },
  });
});

test('readClaudeOutput marks an error result as failed, and as a stop only when it is the cap or the login', () => {
  const error = (result) => ({ stdout: claudeResult({ is_error: true, result }), stderr: '', exitCode: 1, timedOut: false });
  const other = readClaudeOutput(error('the model refused'));
  assert.equal(other.stop, null);
  assert.equal(other.parsed, true);
  assert.equal(other.failed, true);
  assert.deepEqual(readClaudeOutput(error("You've hit your monthly spend limit")).stop, { kind: 'cap', message: "You've hit your monthly spend limit" });
  assert.deepEqual(readClaudeOutput(error('Not logged in · Please run /login')).stop, { kind: 'auth', message: 'Not logged in · Please run /login' });
});

test('readClaudeOutput reads output that is no result as unparsed, with every count unknown', () => {
  const reading = readClaudeOutput({ stdout: 'this is not json', stderr: '', exitCode: 0, timedOut: false });
  assert.deepEqual(reading, {
    stop: null,
    parsed: false,
    failed: false,
    usage: { inputTokens: null, outputTokens: null, turns: null, usage: null, costUsd: null, modelUsage: null, subagents: null },
  });
});

// ---- Codex: `codex exec --json` ----------------------------------------------------------------------

/** stdout as `codex exec --json` prints it: one event per line; a string is a line that is not an event. */
const jsonl = (...lines) => `${lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n')}\n`;
const started = [{ type: 'thread.started', thread_id: 'thread-1' }, { type: 'turn.started' }];
const agentMessage = (text) => ({ type: 'item.completed', item: { id: 'item_9', type: 'agent_message', text } });
const turnCompleted = (usage) => ({ type: 'turn.completed', ...(usage === undefined ? {} : { usage }) });
const turnFailed = (message) => ({ type: 'turn.failed', error: { message } });
const errorEvent = (message) => ({ type: 'error', message });
const USAGE = { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50, reasoning_output_tokens: 20 };

test('parseCodexOutput reads the thread, the last agent message and the usage of each completed turn', () => {
  const second = { input_tokens: 300, cached_input_tokens: 100, output_tokens: 7, reasoning_output_tokens: 0 };
  const stdout = jsonl(
    ...started,
    { type: 'item.started', item: { id: 'item_1', type: 'command_execution', command: 'node --test', status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'item_1', type: 'command_execution', command: 'node --test', exit_code: 0 } },
    { type: 'item.completed', item: { id: 'item_2', type: 'reasoning', text: 'thinking' } },
    agentMessage('first answer'),
    turnCompleted(USAGE),
    { type: 'turn.started' },
    { type: 'item.started', item: { id: 'item_3', type: 'agent_message', text: 'not finished' } },
    agentMessage('final answer'),
    turnCompleted(second),
  );
  assert.deepEqual(parseCodexOutput(stdout), { threadId: 'thread-1', result: 'final answer', turns: [USAGE, second], turnFailed: false, errors: [] });
});

test('parseCodexOutput ignores every line that is not an event: other text, other JSON, a torn tail, and takes CRLF', () => {
  const lines = ['Reading prompt from stdin...', '', '42', '[{"type":"turn.completed"}]', '{"no":"type"}', JSON.stringify(started[0]), JSON.stringify(agentMessage('done')), JSON.stringify(turnCompleted(USAGE)), '{"type":"turn.comp'];
  const expected = { threadId: 'thread-1', result: 'done', turns: [USAGE], turnFailed: false, errors: [] };
  assert.deepEqual(parseCodexOutput(lines.join('\n')), expected);
  assert.deepEqual(parseCodexOutput(lines.join('\r\n')), expected);
});

test('parseCodexOutput returns null when stdout holds no event at all', () => {
  for (const stdout of ['', 'this is not json', '42', '[1, 2]', '{"no":"type"}', 'null']) assert.equal(parseCodexOutput(stdout), null, JSON.stringify(stdout));
});

test('parseCodexOutput keeps the messages of the turn.failed and error events, and says whether a turn failed', () => {
  const failed = parseCodexOutput(jsonl(...started, errorEvent('stream error'), turnFailed('the turn died'), { type: 'turn.failed', error: 'a bare string' }, { type: 'error' }));
  assert.deepEqual(failed, { threadId: 'thread-1', result: null, turns: [], turnFailed: true, errors: ['stream error', 'the turn died', 'a bare string'] });
  // An `error` event alone does not fail the turn (Codex prints one for what it recovers from), and an error
  // ITEM is a warning, not the turn's failure.
  const recovered = parseCodexOutput(jsonl(...started, errorEvent('Reconnecting... 1/5'), { type: 'item.completed', item: { id: 'item_1', type: 'error', message: 'unknown setting' } }, agentMessage('done'), turnCompleted(USAGE)));
  assert.equal(recovered.turnFailed, false);
  assert.deepEqual(recovered.errors, ['Reconnecting... 1/5']);
  // A completed turn without a usage object is still a completed turn; its counts are unknown.
  assert.deepEqual(parseCodexOutput(jsonl(...started, turnCompleted(), turnCompleted('none'))).turns, [null, null]);
});

const turnsOf = (...turns) => ({ threadId: 'thread-1', result: 'done', turns, turnFailed: false, errors: [] });

test('summarizeCodexUsage sums each count over the completed turns, with the cached input counted once and the reasoning tokens apart', () => {
  const second = { input_tokens: 300, cached_input_tokens: 100, output_tokens: 7, reasoning_output_tokens: 0 };
  assert.deepEqual(summarizeCodexUsage(turnsOf(USAGE, second)), {
    // 1000 + 300: the 900 cached tokens are a part of them, where Claude Code's cache counts come on top.
    inputTokens: 1300,
    // 50 + 7: the 20 reasoning tokens are not added.
    outputTokens: 57,
    turns: null,
    usage: [USAGE, second],
    costUsd: null,
    modelUsage: null,
    subagents: null,
    cachedInputTokens: 900,
    reasoningOutputTokens: 20,
  });
});

test('summarizeCodexUsage reports unknown, never zero, when no turn completed or the output could not be read', () => {
  const unknown = { inputTokens: null, outputTokens: null, turns: null, usage: null, costUsd: null, modelUsage: null, subagents: null, cachedInputTokens: null, reasoningOutputTokens: null };
  assert.deepEqual(summarizeCodexUsage(null), unknown);
  assert.deepEqual(summarizeCodexUsage(turnsOf()), unknown);
});

test('summarizeCodexUsage gives null, not a partial sum, for a count that one completed turn lacks', () => {
  // An older CLI's usage has no reasoning count; a turn may have no usage at all.
  const older = { input_tokens: 10, cached_input_tokens: 4, output_tokens: 2 };
  const partial = summarizeCodexUsage(turnsOf(USAGE, older));
  assert.equal(partial.inputTokens, 1010);
  assert.equal(partial.cachedInputTokens, 804);
  assert.equal(partial.outputTokens, 52);
  assert.equal(partial.reasoningOutputTokens, null, 'one turn does not say, so the sum is unknown');
  const missing = summarizeCodexUsage(turnsOf(USAGE, null));
  assert.equal(missing.inputTokens, null);
  assert.equal(missing.outputTokens, null);
  assert.deepEqual(missing.usage, [USAGE, null], 'what was given is kept as it was');
  assert.equal(summarizeCodexUsage(turnsOf({ ...USAGE, input_tokens: '1000' })).inputTokens, null, 'a count that is not a number is not one');
  assert.equal(summarizeCodexUsage(turnsOf({ ...USAGE, cached_input_tokens: 0 })).cachedInputTokens, 0, 'a recorded zero is a measurement');
});

/** A finished run that printed `stdout`; it exited 1 unless `extra` says otherwise. */
const run = (stdout, extra = {}) => ({ stdout, stderr: '', exitCode: 1, timedOut: false, ...extra });
const kindOf = (...args) => classifyCodexFailure(run(...args))?.kind ?? null;

// The wording of Codex's cap and login messages below is ASSUMED, not observed in a real run (see the
// patterns in `agent-output.mjs`); these tests pin what the patterns accept, not what Codex prints.
const CAP = "You've hit your usage limit. Try again in 3 days.";
const AUTH = 'Not logged in. Run `codex login` first.';

test('classifyCodexFailure stops on a failed turn whose message is the usage cap or the login, whatever the exit code', () => {
  assert.deepEqual(classifyCodexFailure(run(jsonl(...started, errorEvent(CAP), turnFailed(CAP)))), { kind: 'cap', message: CAP });
  assert.deepEqual(classifyCodexFailure(run(jsonl(...started, turnFailed(AUTH)), { exitCode: 0 })), { kind: 'auth', message: AUTH });
  assert.equal(kindOf(jsonl(...started, turnFailed('exceeded retry limit, last status: 429 Too Many Requests'))), 'cap');
  assert.equal(kindOf(jsonl(...started, turnFailed('Quota exceeded. Check your plan and billing details.'))), 'cap');
  assert.equal(kindOf(jsonl(...started, turnFailed('unexpected status 401 Unauthorized'))), 'auth');
  assert.equal(kindOf(jsonl(...started, turnFailed('Your refresh token was already used. Please log out and sign in again.'))), 'auth');
  // The message that names the cause may be on the `error` event and not on the `turn.failed` after it.
  assert.equal(kindOf(jsonl(...started, errorEvent(CAP), turnFailed('the turn failed'))), 'cap');
});

test('classifyCodexFailure ignores a failed turn that is neither the cap nor the login', () => {
  assert.equal(kindOf(jsonl(...started, turnFailed('the model refused'))), null);
  assert.equal(kindOf(jsonl(...started, turnFailed('exceeded retry limit, last status: 500 Internal Server Error'))), null, 'a retry limit is not a usage limit');
});

test('classifyCodexFailure never reads a completed turn that mentions a limit or a login', () => {
  const stdout = jsonl(...started, errorEvent('rate limit reached, reconnecting'), agentMessage('I added the rate limit and the "not logged in" page'), turnCompleted(USAGE));
  assert.equal(kindOf(stdout, { exitCode: 0 }), null);
  assert.equal(kindOf(stdout, { exitCode: 1, stderr: 'warning: usage limit is near' }), null, 'the turn completed: that is a result, whatever else was printed');
});

test('classifyCodexFailure reads a run that printed no turn.completed: its error events, and its stderr when it exited non-zero', () => {
  assert.equal(kindOf(jsonl(...started, errorEvent(CAP))), 'cap');
  assert.equal(kindOf(jsonl(...started, errorEvent(CAP)), { exitCode: 0 }), 'cap', 'an event that names the cap needs no exit code');
  assert.deepEqual(classifyCodexFailure(run(jsonl(...started), { stderr: 'Error: Not logged in\n' })), { kind: 'auth', message: 'Error: Not logged in' });
  assert.equal(kindOf(jsonl(...started), { stderr: 'Error: Not logged in', exitCode: 0 }), null, 'stderr is only read for a real non-zero exit');
  assert.equal(kindOf(jsonl(...started, agentMessage('the usage limit is five requests a day'))), null, 'what the agent wrote is never read as the cause');
});

test('classifyCodexFailure never stops a run the timeout killed, unless a turn.failed said why', () => {
  const hung = jsonl(...started, errorEvent('rate limit reached, reconnecting'));
  assert.equal(kindOf(hung, { timedOut: true, stderr: 'rate limit reached' }), null);
  assert.equal(kindOf(hung, { timedOut: true, exitCode: null, stderr: 'rate limit reached' }), null);
  assert.equal(kindOf(jsonl(...started, turnFailed(CAP)), { timedOut: true, exitCode: null }), 'cap');
});

test('classifyCodexFailure falls back to the raw text only when there is no event and the exit code is non-zero', () => {
  assert.equal(classifyCodexFailure({ stdout: '', stderr: 'Error: Not logged in', exitCode: 1 }).kind, 'auth');
  assert.equal(classifyCodexFailure({ stdout: CAP, stderr: '', exitCode: 1 }).kind, 'cap');
  assert.equal(classifyCodexFailure({ stdout: CAP, stderr: '', exitCode: 0 }), null);
  assert.equal(classifyCodexFailure({ stdout: CAP, stderr: '', exitCode: 1, timedOut: true }), null);
  assert.equal(classifyCodexFailure({ stdout: CAP, stderr: '', exitCode: null }), null);
  assert.equal(classifyCodexFailure({ stdout: '', stderr: 'boom', exitCode: 3 }), null);
});

test('readCodexOutput reads a completed turn: no stop, parsed, not failed, and the usage summary', () => {
  const reading = readCodexOutput(run(jsonl(...started, agentMessage('done'), turnCompleted(USAGE)), { exitCode: 0 }));
  assert.deepEqual(reading, {
    stop: null,
    parsed: true,
    failed: false,
    usage: { inputTokens: 1000, outputTokens: 50, turns: null, usage: [USAGE], costUsd: null, modelUsage: null, subagents: null, cachedInputTokens: 800, reasoningOutputTokens: 20 },
  });
});

test('readCodexOutput marks a failed turn, and a run that never completed one, as failed; and as a stop only for the cap or the login', () => {
  const refused = readCodexOutput(run(jsonl(...started, turnFailed('the model refused'))));
  assert.deepEqual({ stop: refused.stop, parsed: refused.parsed, failed: refused.failed }, { stop: null, parsed: true, failed: true });
  assert.equal(refused.usage.inputTokens, null, 'a turn that failed reported no usage');
  assert.equal(readCodexOutput(run(jsonl(...started), { exitCode: 0 })).failed, true, 'no turn completed');
  // A turn that completed before another failed keeps its usage: those tokens were spent.
  const later = readCodexOutput(run(jsonl(...started, turnCompleted(USAGE), { type: 'turn.started' }, turnFailed('the model refused'))));
  assert.equal(later.failed, true);
  assert.equal(later.usage.inputTokens, 1000);
  assert.deepEqual(readCodexOutput(run(jsonl(...started, turnFailed(CAP)))).stop, { kind: 'cap', message: CAP });
});

test('readCodexOutput reads output without an event as unparsed, with every count unknown', () => {
  const reading = readCodexOutput(run('this is not json', { exitCode: 0 }));
  assert.deepEqual({ stop: reading.stop, parsed: reading.parsed, failed: reading.failed }, { stop: null, parsed: false, failed: false });
  for (const [name, value] of Object.entries(reading.usage)) assert.equal(value, null, name);
});

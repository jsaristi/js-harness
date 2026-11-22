// The tests of bin/lib/transcript-requests.mjs: a request counted once however many lines repeat it, and what one
// session's transcript says it spent (`spendOf`).
import assert from 'node:assert/strict';
import test from 'node:test';
import { UNREADABLE, requestFold, requestOf, spendOf } from './transcript-requests.mjs';

/** An assistant line of message `id` with `usage`; `extra` sets fields of the line. */
const line = (id, usage, extra = {}) => ({
  type: 'assistant',
  message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 0, output_tokens: 0, ...usage } },
  ...extra,
});
const jsonl = (lines) => `${lines.map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry))).join('\n')}\n`;

test('requestOf reads a line, and a line that is no request is null', () => {
  assert.equal(requestOf({ type: 'user', message: { content: 'hi' } }), null);
  assert.equal(requestOf(line('m', {}, { message: { model: '<synthetic>', usage: { input_tokens: 0, output_tokens: 0 } } })), null);
  assert.equal(requestOf({ type: 'assistant', message: { id: 'm', usage: { output_tokens: 1 } } }), UNREADABLE);
  assert.deepEqual(requestOf(line('m', { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 5 })).tokens, {
    inputTokens: 3, outputTokens: 4, cacheReadTokens: 5, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0,
  });
});

test('requestFold counts the lines of one message once, each count the largest any of them gives', () => {
  const fold = requestFold();
  fold.add(line('a', { output_tokens: 2, cache_read_input_tokens: 1000 }));
  fold.add(line('a', { output_tokens: 9, cache_read_input_tokens: 1000 }));
  fold.add(line('a', { output_tokens: 5, cache_read_input_tokens: 1000 }));
  fold.add(line('b', { cache_read_input_tokens: 10 }), { side: true });
  assert.equal(fold.requests.size, 2);
  const [a, b] = [...fold.requests.values()];
  assert.equal(a.tokens.cacheReadTokens, 1000);
  assert.equal(a.tokens.outputTokens, 9);
  assert.equal(b.side, true);
});

test('spendOf counts a message written on three lines once, and keeps the side chain apart', () => {
  const usage = { input_tokens: 2, output_tokens: 7, cache_read_input_tokens: 40000, cache_creation_input_tokens: 500 };
  const text = jsonl([
    { type: 'user', message: { content: 'go' } },
    line('first', { input_tokens: 10, output_tokens: 3, cache_creation_input_tokens: 30000 }),
    line('m1', usage),
    line('m1', usage),
    line('m1', usage),
    line('side', { cache_read_input_tokens: 999 }, { isSidechain: true }),
    line('m2', { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 50000 }),
    '{"cut',
  ]);
  const spend = spendOf(text);
  assert.deepEqual(spend.main, {
    calls: 3,
    cacheReadTokens: 90000,
    inputTokens: 13,
    outputTokens: 11,
    cacheWriteTokens: 30500,
    lastContext: 50001,
    firstContext: 30010,
  });
  assert.equal(spend.subagents.calls, 1);
  assert.equal(spend.subagents.cacheReadTokens, 999);
  assert.equal(spend.unreadableLines, 1);
});

test('spendOf adds the sub-agents files to the sub-agents, never to the main chain', () => {
  const spend = spendOf(jsonl([line('m', { cache_read_input_tokens: 5 })]), [jsonl([line('s', { cache_read_input_tokens: 7 }), line('s', { cache_read_input_tokens: 7 })])]);
  assert.equal(spend.main.cacheReadTokens, 5);
  assert.deepEqual([spend.subagents.calls, spend.subagents.cacheReadTokens], [1, 7]);
});

test('the first call of the main chain is the first with a context: a resumed turn with zeros is not', () => {
  const spend = spendOf(jsonl([line('z', {}), line('m', { cache_read_input_tokens: 8 })]));
  assert.equal(spend.main.firstContext, 8);
  assert.equal(spendOf('').main.firstContext, null);
  assert.equal(spendOf('').main.lastContext, null);
});

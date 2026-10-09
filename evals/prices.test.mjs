import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIST_PRICES, PRICE_SOURCE, listCost, usd } from './prices.mjs';

// The prices are what every cost of the feature is computed from (`odd/tasks/subagent-model-routing.md`, Evidence),
// so the test holds its own copy: a digit changed in the module by accident fails here.
const EXPECTED_PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, longPrompt: { overTokens: 100000, times: 5 } },
};
const NONE = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 };
const costOf = (model, tokens, options) => {
  const cost = listCost(model, { ...NONE, ...tokens }, options);
  return cost === null ? null : { usd: usd(cost.nanoUsd), longPrompt: cost.longPrompt };
};

test('the table is dated and sourced, and holds the list prices of the two models in US dollars per million tokens', () => {
  assert.deepEqual(PRICE_SOURCE, { url: 'https://platform.claude.com/docs/en/about-claude/pricing', readOn: '2026-10-08', unit: 'USD per million tokens' });
  assert.deepEqual(LIST_PRICES, EXPECTED_PRICES);
});

test('the probe session costs at list price what its tokens say, to the last digit', () => {
  // The session of the feature's probe (E3). Opus is the orchestrator, whose cache writes were all 1-hour ones;
  // the CLI printed the same $0.3413604 for it. Haiku is the subagent, whose cache writes were all 5-minute ones;
  // the CLI, which does not know the model, printed $0.163913.
  assert.deepEqual(costOf('claude-opus-5-5', { inputTokens: 4, outputTokens: 152, cacheReadTokens: 40882, cacheWrite1hTokens: 41266 }), { usd: 0.3413604, longPrompt: false });
  assert.deepEqual(costOf('claude-haiku-5-5', { inputTokens: 2, outputTokens: 4, cacheWrite5mTokens: 32765 }), { usd: 0.004097825, longPrompt: false });
});

test('each kind of token is charged at its own price', () => {
  const million = 1_000_000;
  for (const [model, prices] of Object.entries(EXPECTED_PRICES)) {
    // A million tokens of one kind is over Haiku's long-prompt limit when it is part of the prompt, so the kinds
    // are priced here as counts summed over many requests.
    const each = (tokens) => costOf(model, tokens, { aggregate: true }).usd;
    assert.equal(each({ inputTokens: million }), prices.input, `${model} input`);
    assert.equal(each({ outputTokens: million }), prices.output, `${model} output`);
    assert.equal(each({ cacheReadTokens: million }), prices.cacheRead, `${model} cache read`);
    assert.equal(each({ cacheWrite5mTokens: million }), prices.cacheWrite5m, `${model} 5-minute cache write`);
    assert.equal(each({ cacheWrite1hTokens: million }), prices.cacheWrite1h, `${model} 1-hour cache write`);
  }
  assert.deepEqual(costOf('claude-opus-5-5', NONE), { usd: 0, longPrompt: false }, 'no token costs nothing, which is a measurement');
});

test('a Haiku request whose prompt is over 100,000 tokens costs five times as much, output included; at 100,000 it does not', () => {
  // The prompt is the input, the cache reads and the cache writes of the request together.
  const at = { inputTokens: 10000, cacheReadTokens: 60000, cacheWrite5mTokens: 20000, cacheWrite1hTokens: 10000, outputTokens: 1000 };
  // 1,000 + 600 + 2,500 + 2,000 + 500 millionths of a dollar.
  assert.deepEqual(costOf('claude-haiku-5-5', at), { usd: 0.0066, longPrompt: false });
  // One token more of input: five times 6,600.1 millionths.
  assert.deepEqual(costOf('claude-haiku-5-5', { ...at, inputTokens: 10001 }), { usd: 0.0330005, longPrompt: true });
  assert.deepEqual(costOf('claude-haiku-5-5', { outputTokens: 500000 }), { usd: 0.25, longPrompt: false }, 'the output is not part of the prompt');
});

test('Opus has one price whatever the size of the prompt', () => {
  assert.deepEqual(costOf('claude-opus-5-5', { cacheReadTokens: 900000, outputTokens: 10 }), { usd: 0.1802, longPrompt: false });
});

test('counts summed over several requests are never priced as one long prompt', () => {
  const summed = { cacheReadTokens: 5_000_000, outputTokens: 2000 };
  assert.deepEqual(costOf('claude-haiku-5-5', summed, { aggregate: true }), { usd: 0.051, longPrompt: false });
  assert.deepEqual(costOf('claude-haiku-5-5', summed), { usd: 0.255, longPrompt: true }, 'the same counts as one request');
});

test('a model the table does not hold has no price: null, never the price of another model', () => {
  for (const model of ['claude-haiku-4-5', 'haiku', 'claude-opus-5-5-20260101', 'claude-sonnet-5-5', '<synthetic>', 'toString', '', undefined]) {
    assert.equal(listCost(model, { ...NONE, inputTokens: 1000 }), null, String(model));
  }
});

test('a count that is not a whole number of tokens is refused, never priced as 0', () => {
  for (const bad of [undefined, null, -1, 1.5, Number.NaN, '10']) {
    assert.throws(() => listCost('claude-opus-5-5', { ...NONE, outputTokens: bad }), /outputTokens/, String(bad));
  }
  assert.throws(() => listCost('claude-opus-5-5', { inputTokens: 1 }), /outputTokens|cacheReadTokens/);
});

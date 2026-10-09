// The list prices a cost is recomputed from, and the one function that applies them. Zero deps, plain Node.
//
// Claude Code prints a cost of its own (`total_cost_usd`, `modelUsage[].costUSD`), and it is kept beside this one, but
// it decides nothing: the CLI does not know every model, and it prices one it does not know at a rate that is not its
// own. On 2.1.292 a Haiku 5.5 subagent's 32,765 cache-write tokens were billed $0.163913, which is $5 per million,
// where the list price is $0.125 (`odd/tasks/subagent-model-routing.md`, E3). So the cost of a trial is its tokens at
// these prices.

/** Where the table below was read, and when. A price changes without notice, so a cost computed from this table says
 * which table it is: the source travels with every summary that holds one (`transcript-usage.mjs`). */
export const PRICE_SOURCE = { url: 'https://platform.claude.com/docs/en/about-claude/pricing', readOn: '2026-10-08', unit: 'USD per million tokens' };

/** The list price of each kind of token, by full model id: the input, the output, a cache write that lives 5 minutes,
 * one that lives 1 hour, and a cache read. `longPrompt`, where a model has one, is the prompt size over which every
 * price of the request is multiplied.
 *
 * That the long-prompt price applies request by request, to a request whose input, cache reads and cache writes
 * together pass the limit, is an INFERENCE from the pricing page, which states the limit as a prompt size and says
 * nothing of sessions; it is not verified against an invoice.
 *
 * A model that is not here has no price (`listCost` returns `null` for it): never the price of a model that looks
 * like it, which is the mistake this table exists to undo. */
export const LIST_PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, longPrompt: { overTokens: 100000, times: 5 } },
};

/** The counts a cost is made of, each with the price it is charged at. */
const CHARGED = [['inputTokens', 'input'], ['outputTokens', 'output'], ['cacheReadTokens', 'cacheRead'], ['cacheWrite5mTokens', 'cacheWrite5m'], ['cacheWrite1hTokens', 'cacheWrite1h']];

/** The list cost of `tokens` (`{ inputTokens, outputTokens, cacheReadTokens, cacheWrite5mTokens, cacheWrite1hTokens }`)
 * on `model`, as `{ nanoUsd, longPrompt }`, or `null` for a model the table does not hold.
 *
 * The cost is a whole number of billionths of a dollar, not a fraction of one: every price is a whole number of
 * thousandths of a dollar per million tokens, so the sum is exact, and so is any sum of such costs. `usd` turns the
 * total into dollars once, at the end; costs added as fractions would drift by a digit that a test of an exact
 * session then cannot hold.
 *
 * `tokens` are those of ONE request, which is what decides the long-prompt price. Counts summed over several requests
 * say nothing of the size of any one prompt, so they are priced with `aggregate: true`, at the base price whatever
 * they add up to.
 *
 * A count that is not a whole number of tokens throws: read as 0 it would be a cost that looks measured. */
export function listCost(model, tokens, { aggregate = false } = {}) {
  const prices = typeof model === 'string' && Object.hasOwn(LIST_PRICES, model) ? LIST_PRICES[model] : null;
  if (prices === null) return null;
  for (const [count] of CHARGED) {
    const value = tokens?.[count];
    if (!Number.isInteger(value) || value < 0) throw new TypeError(`listCost: "${count}" must be a whole number of tokens, got ${typeof value === 'string' ? JSON.stringify(value) : String(value)}`);
  }
  const promptTokens = tokens.inputTokens + tokens.cacheReadTokens + tokens.cacheWrite5mTokens + tokens.cacheWrite1hTokens;
  const longPrompt = !aggregate && prices.longPrompt !== undefined && promptTokens > prices.longPrompt.overTokens;
  const times = longPrompt ? prices.longPrompt.times : 1;
  // A price in thousandths of a dollar per million tokens is a whole number; rounded, because 0.125 * 1000 is one in
  // binary floating point and 0.01 * 1000 need not be.
  const nanoUsd = CHARGED.reduce((total, [count, price]) => total + tokens[count] * Math.round(prices[price] * 1000) * times, 0);
  return { nanoUsd, longPrompt };
}

/** Billionths of a dollar as dollars. */
export const usd = (nanoUsd) => nanoUsd / 1e9;

// The API requests a Claude Code transcript stands for, each counted once, and what one session spent by them. Zero
// deps, plain Node.
//
// Claude Code writes a line per content block of an API message (thinking, text, a tool call), and each line repeats
// the message's usage: summed line by line, a session reads about twice what it spent (the measure of the 17 sessions
// of 2026-11-21: 1.68 to 2.70 times, and three sessions stopped at half the cap they were given). So lines are folded
// into requests by the message's id (`requestFold`), and every figure here is a sum of requests. The reader moved here
// from `evals/transcript-usage.mjs`, which imports it, so `js-harness spend` (shipped in `bin/`, unlike `evals/`) and the
// eval cost read one session the same way.

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** What Claude Code 2.1.292 writes as the model of an `assistant` line it made up itself, where the API gave no
 * answer (read in the installed binary: `model: "<synthetic>"` with a usage of its own; the probe session holds none).
 * No request was made, so it is no request here: counted, it would be a model without a price. */
const SYNTHETIC_MODEL = '<synthetic>';

export const TOKEN_COUNTS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWrite5mTokens', 'cacheWrite1hTokens'];
const isCount = (value) => Number.isInteger(value) && value >= 0;
/** A cache count of the API's usage as a number. The API gives these as a number or `null`, and a usage may leave
 * one out: either way the request used none of that kind. */
const tokens = (value) => (isCount(value) ? value : 0);
/** What `requestOf` returns for an `assistant` line whose usage cannot be read. */
export const UNREADABLE = Symbol('unreadable');

/** The request an `assistant` line stands for, `{ key, model, tokens, unsplit }`; `null` for a line that is none;
 * or `UNREADABLE` for one whose usage lacks its input or its output count, which every answer of the API has: priced
 * as 0 it would be a cost that looks measured, so it is counted with the lines that could not be read.
 * `key` is what the lines of one API message share: its id, else the id of the request, else nothing (`null`).
 *
 * A cache write is split by how long it lives, which is what its price depends on. A usage that names the total and
 * not the split has the rest counted as 5-minute writes, the cheaper kind, and in `unsplit`, so the summary says how
 * many tokens that assumption covers. */
export function requestOf(line) {
  const message = line.message;
  if (line.type !== 'assistant' || !isObject(message) || !isObject(message.usage) || message.model === SYNTHETIC_MODEL) return null;
  const { usage } = message;
  if (!isCount(usage.input_tokens) || !isCount(usage.output_tokens)) return UNREADABLE;
  const split = isObject(usage.cache_creation) ? usage.cache_creation : {};
  const cacheWrite1hTokens = tokens(split.ephemeral_1h_input_tokens);
  const named5m = tokens(split.ephemeral_5m_input_tokens);
  const unsplit = Math.max(0, tokens(usage.cache_creation_input_tokens) - named5m - cacheWrite1hTokens);
  return {
    key: typeof message.id === 'string' ? `message ${message.id}` : typeof line.requestId === 'string' ? `request ${line.requestId}` : null,
    model: typeof message.model === 'string' && message.model !== '' ? message.model : 'unknown',
    tokens: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: tokens(usage.cache_read_input_tokens),
      cacheWrite5mTokens: named5m + unsplit,
      cacheWrite1hTokens,
    },
    unsplit,
  };
}

/** A fold of transcript lines into requests: `add(line, extra)` adds the request `line` stands for, carrying the
 * fields of `extra`, and returns what `requestOf` returned for it; `requests` maps each key to its request, in the
 * order the requests first appeared. The lines of one message are one request, and each count is the largest any of
 * them gives: right whether they repeat the usage exactly or an early one was written before the output was complete.
 * A line with no key is a request of its own. */
export function requestFold() {
  const requests = new Map();
  let unkeyed = 0;
  return {
    requests,
    add(line, extra = {}) {
      const request = requestOf(line);
      if (request === null || request === UNREADABLE) return request;
      const key = request.key ?? `line ${unkeyed++}`;
      const earlier = requests.get(key);
      if (earlier === undefined) {
        requests.set(key, { ...request, ...extra });
      } else {
        for (const name of TOKEN_COUNTS) earlier.tokens[name] = Math.max(earlier.tokens[name], request.tokens[name]);
        earlier.unsplit = Math.max(earlier.unsplit, request.unsplit);
      }
      return request;
    },
  };
}

/** The context a request was sent with: its input, cache reads and cache writes, as `fixed-load` and the board count it. */
const contextOf = ({ tokens: t }) => t.inputTokens + t.cacheReadTokens + t.cacheWrite5mTokens + t.cacheWrite1hTokens;

/** The sums of `requests`: `{ calls, cacheReadTokens, inputTokens, outputTokens, cacheWriteTokens }`. */
function tally(requests) {
  const sum = { calls: 0, cacheReadTokens: 0, inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0 };
  for (const { tokens: t } of requests) {
    sum.calls += 1;
    sum.cacheReadTokens += t.cacheReadTokens;
    sum.inputTokens += t.inputTokens;
    sum.outputTokens += t.outputTokens;
    sum.cacheWriteTokens += t.cacheWrite5mTokens + t.cacheWrite1hTokens;
  }
  return sum;
}

/** What one session spent, from the text of its transcript (`mainText`) and of each of its sub-agents' own files
 * (`subagentTexts`, `<session>/subagents/agent-*.jsonl`):
 *
 *   main            the main chain's `{ calls, cacheReadTokens, inputTokens, outputTokens, cacheWriteTokens }`, with
 *                   `lastContext`, the context of its last call, and `firstContext`, that of its first call with one
 *                   (a turn resumed after a compaction carries zeros, as `fixed-load` reads it): the fixed context a
 *                   session opens with. `null` where there is no such call.
 *   subagents       the same sums for the side chain (`isSidechain` lines) and the sub-agents' files.
 *   unreadableLines lines that are not JSON, and requests whose usage lacks a count: a transcript still being written
 *                   ends on a cut line, which is counted here and not in a figure. */
export function spendOf(mainText, subagentTexts = []) {
  const main = requestFold();
  const side = requestFold();
  let unreadableLines = 0;
  const read = (text, inSubagentFile) => {
    for (const raw of text.split('\n')) {
      if (raw.trim() === '') continue;
      let line;
      try {
        line = JSON.parse(raw);
      } catch {
        unreadableLines += 1;
        continue;
      }
      if (!isObject(line)) continue;
      const fold = inSubagentFile || line.isSidechain === true ? side : main;
      if (fold.add(line) === UNREADABLE) unreadableLines += 1;
    }
  };
  read(mainText, false);
  for (const text of subagentTexts) read(text, true);
  const calls = [...main.requests.values()];
  const first = calls.find((request) => contextOf(request) > 0);
  return {
    main: { ...tally(calls), lastContext: calls.length === 0 ? null : contextOf(calls.at(-1)), firstContext: first === undefined ? null : contextOf(first) },
    subagents: tally(side.requests.values()),
    unreadableLines,
  };
}

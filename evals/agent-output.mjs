// How an agent's output is read. The runner (`runner.mjs`) spawns a command and grades a workspace; what
// the command printed means something only to the CLI that printed it, so that knowledge lives here, one
// reader per CLI, and a config carries the one its agent needs (`config.reader`). Zero deps, plain Node.
//
// A reader is a pure function of the finished run, `({ stdout, stderr, exitCode, timedOut }) -> reading`:
//
//   stop    `{ kind: 'cap' | 'auth', message }` when the run died of the plan's usage cap or of the login,
//           else `null`. Both mean the machine, not the configuration, failed the trial, so the suite stops
//           and records nothing for it (the predecessor lost 141 trials to recorded zeros).
//   parsed  whether the output could be read at all; `false` is recorded as `agent-output-unparsable`.
//   failed  whether the agent itself reports that it failed; recorded as `agent-error`.
//   usage   the counts that go into the trial's record: at least `inputTokens`, `outputTokens`, `turns`,
//           `usage` (the raw counts, as given), `costUsd`, `modelUsage` and `subagents`. Missing data is
//           `null`, never 0: a zero would read as a measurement.

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// ---- Claude Code: `claude --print --output-format json` ---------------------------------------------

/** The `type: "result"` object of `claude --print --output-format json` stdout, or `null`. Newer CLIs
 * may print an array of messages; the result is then its last `result` element. */
export function parseAgentOutput(stdout) {
  let value;
  try {
    value = JSON.parse(String(stdout).trim());
  } catch {
    return null;
  }
  if (Array.isArray(value)) value = value.filter((item) => isObject(item) && item.type === 'result').pop();
  return isObject(value) && value.type === 'result' ? value : null;
}

/** Tokens, turns and cost from a parsed agent result. Input counts the cache-creation and cache-read tokens
 * too, because they are all tokens the plan's usage cap charges for. Those counts and `usage` are the main
 * thread's only. The whole session, subagents included, is `costUsd` (`total_cost_usd`, Claude Code's list
 * cost), `modelUsage` (the per-model token counts, as given) and `subagents` (`subagent_stats.spawned`).
 * `subagentStats` is the whole `subagent_stats`, as given: how many subagents completed, failed, were killed or
 * were refused, and of which type, which a count of the spawned does not say. `subagents` stays beside it because
 * the recorded results and their report read it.
 * Missing data is `null`, never 0: a zero would read as a measurement. */
export function summarizeUsage(output) {
  const usage = isObject(output?.usage) ? output.usage : null;
  // Per count: a usage object that lacks one of the fields a count is summed from leaves that count
  // unknown, rather than a sum of whatever happened to be there.
  const sum = (...fields) => (usage && fields.every((field) => Number.isFinite(usage[field])) ? fields.reduce((total, field) => total + usage[field], 0) : null);
  return {
    inputTokens: sum('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'),
    outputTokens: sum('output_tokens'),
    turns: Number.isFinite(output?.num_turns) ? output.num_turns : null,
    usage,
    // A cost is never negative; one that is says the field is broken, not that the session paid back.
    costUsd: Number.isFinite(output?.total_cost_usd) && output.total_cost_usd >= 0 ? output.total_cost_usd : null,
    modelUsage: isObject(output?.modelUsage) ? output.modelUsage : null,
    subagents: Number.isFinite(output?.subagent_stats?.spawned) ? output.subagent_stats.spawned : null,
    subagentStats: isObject(output?.subagent_stats) ? output.subagent_stats : null,
  };
}

const CAP_PATTERN = /usage limit|hit your .*limit|limit reached|rate limit/i;
const AUTH_PATTERN = /not logged in|please run \/login|invalid api key|oauth token/i;

/** The texts an error result carries. Claude Code reports some failures as `result`, and others, such as
 * a startup failure, with no `result` at all and the same text as stderr in `errors` (an array of
 * strings in the installed CLI's schema). Objects with a `message` are read too, defensively. */
function errorTexts(parsed) {
  const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
  return [parsed.result, ...errors.map((error) => (isObject(error) ? error.message : error))].filter(
    (text) => typeof text === 'string' && text.trim() !== '',
  );
}

/** Whether an agent run died of the plan's usage cap or of authentication: `{ kind: 'cap' | 'auth',
 * message }`, else `null`. Both mean the machine, not the configuration, failed the trial, so the suite
 * must stop instead of recording a zero (the predecessor lost 141 trials that way).
 *
 * A parsed result counts only when it is an error (`is_error`), and then its `result` and `errors` are
 * read: a successful answer that merely talks about rate limits is not a cap. With no parsable result,
 * the raw text counts only for a real non-zero exit code, and never for a run the timeout killed: a hung
 * agent that logged "rate limit" before the kill timed out, which is a recorded result, where a cap
 * stop would rerun that long trial on every resume. */
export function classifyAgentFailure({ stdout = '', stderr = '', exitCode = null, timedOut = false }) {
  const parsed = parseAgentOutput(stdout);
  let texts = [];
  if (parsed) {
    if (parsed.is_error === true) texts = errorTexts(parsed);
  } else if (!timedOut && Number.isInteger(exitCode) && exitCode !== 0) {
    texts = [`${stdout}\n${stderr}`.trim()];
  }
  for (const message of texts) {
    if (AUTH_PATTERN.test(message)) return { kind: 'auth', message };
    if (CAP_PATTERN.test(message)) return { kind: 'cap', message };
  }
  return null;
}

/** The agent's final answer as a reading carries it in `reply`: the text, or `null` when there is none. */
const replyOf = (text) => (typeof text === 'string' ? text : null);

/** The reader of Claude Code's output, and the one a config without a `reader` gets: the three functions
 * above, put together exactly as the runner used them before a config could carry its own. */
export function readClaudeOutput(run) {
  const output = parseAgentOutput(run.stdout);
  return { stop: classifyAgentFailure(run), parsed: output !== null, failed: output?.is_error === true, usage: summarizeUsage(output), reply: replyOf(output?.result) };
}

// ---- Codex: `codex exec --json` ----------------------------------------------------------------------
//
// stdout is JSON Lines, one event per line (`learn.chatgpt.com/docs/non-interactive-mode`, read for
// codex-cli 0.159.1): `thread.started` (`thread_id`), `turn.started`, `turn.completed` (`usage`),
// `turn.failed`, `item.started` and `item.completed` (an `item` with a `type`: `agent_message` with its
// `text`, `reasoning`, `command_execution`, and more), and `error`.
//
// Seen in two real sessions of codex-cli 0.159.1 that completed (2026-10-05, the isolation probe): the events
// above but `turn.failed` and `error`; the notice of a flag as an ITEM of type `error`, printed before
// `turn.started`; a fifth count in `usage`, `cache_write_input_tokens`. No real run has failed here yet, so
// what a failed turn prints is still what the documentation says and nothing more.

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/** The message of a `turn.failed` (`error.message`) or of an `error` event (`message`); a bare string is read
 * too, defensively. */
const codexMessage = (event) => event.error?.message ?? event.message ?? event.error;

/** The events among the lines of `stdout`: every line that is a JSON object with a `type`. Any other line
 * is ignored, because the CLI may print other text there (a banner, a blank line), and a run that was
 * killed ends in a torn line. `bin/codex-review.mjs` reads `codex exec review --json` the same way. */
function codexEvents(stdout) {
  const events = [];
  for (const line of String(stdout).split('\n')) {
    try {
      const event = JSON.parse(line);
      if (isObject(event) && typeof event.type === 'string') events.push(event);
    } catch {
      // Not an event.
    }
  }
  return events;
}

/** What the events of `codex exec --json` stdout say, or `null` when it holds no event at all:
 *  - `threadId`: the `thread_id` of `thread.started`, the session's id, or `null`;
 *  - `result`: the `text` of the last completed `agent_message` item, which is the agent's answer, or `null`;
 *  - `turns`: the `usage` of every `turn.completed`, in order and as given, `null` for one that has none;
 *  - `turnFailed`: whether a `turn.failed` was printed;
 *  - `errors`: the messages of the `turn.failed` and `error` events, in order.
 * An `error` event does not by itself fail a turn: `turn.failed` is the event that says so, and a turn that
 * completed after an `error` (a dropped stream Codex reconnected, say) is a result. That Codex prints such
 * recoverable notices as `error` events is an ASSUMPTION, not verified against a real run. An item of type
 * `error` is not read at all: it is a notice (an unrecognized setting, as `bin/codex-review.mjs` found, or a
 * flag that is on: every real session run with `--dangerously-bypass-hook-trust` printed one, twice, and
 * completed). */
export function parseCodexOutput(stdout) {
  const events = codexEvents(stdout);
  if (events.length === 0) return null;
  const output = { threadId: null, result: null, turns: [], turnFailed: false, errors: [] };
  for (const event of events) {
    if (event.type === 'thread.started') {
      if (isNonEmptyString(event.thread_id)) output.threadId = event.thread_id;
    } else if (event.type === 'turn.completed') {
      output.turns.push(isObject(event.usage) ? event.usage : null);
    } else if (event.type === 'turn.failed' || event.type === 'error') {
      if (event.type === 'turn.failed') output.turnFailed = true;
      const message = codexMessage(event);
      if (isNonEmptyString(message)) output.errors.push(message);
    } else if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
      output.result = event.item.text;
    }
  }
  return output;
}

/** The counts of a trial's record from a parsed Codex output, each summed over the completed turns:
 *  - `inputTokens` is the sum of `input_tokens`. `cached_input_tokens` is a PART of that count, so the cached
 *    tokens are in it once; Claude Code's cache counts come on top of its `input_tokens`, which is why its
 *    summary adds them and this one must not. The cached part is kept as `cachedInputTokens`, because a list
 *    price charges it at another rate.
 *  - `cacheWriteInputTokens` is the sum of `cache_write_input_tokens`, a count the real CLI reports (0 in both
 *    real runs seen) and the documentation read for T1 did not list. Whether it is a part of `input_tokens`
 *    is NOT verified, so it is added to nothing; an older CLI that does not report it leaves it `null`.
 *  - `outputTokens` is the sum of `output_tokens`. `reasoningOutputTokens` is the sum of
 *    `reasoning_output_tokens`, kept apart: whether the reasoning tokens are already inside `output_tokens`
 *    is NOT verified, so the two are never added here, and whoever prices them decides with evidence.
 *  - `usage` is the per-turn usage objects as Codex gave them.
 *  - `turns` is `null`: Claude Code's `num_turns` counts the model's round trips, and Codex reports none; a
 *    Codex "turn" is one prompt, so its count (the length of `usage`) would sit in the same column as a
 *    measure of something else.
 *  - `costUsd`, `modelUsage` and `subagents` are `null`: Codex reports no cost and neither of the others.
 * A count that any completed turn lacks is `null`, as it is when no turn completed: never a partial sum, and
 * never 0. */
export function summarizeCodexUsage(output) {
  const turns = output?.turns ?? [];
  const sum = (field) => (turns.length > 0 && turns.every((usage) => Number.isFinite(usage?.[field])) ? turns.reduce((total, usage) => total + usage[field], 0) : null);
  return {
    inputTokens: sum('input_tokens'),
    outputTokens: sum('output_tokens'),
    turns: null,
    usage: turns.length > 0 ? turns : null,
    costUsd: null,
    modelUsage: null,
    subagents: null,
    cachedInputTokens: sum('cached_input_tokens'),
    cacheWriteInputTokens: sum('cache_write_input_tokens'),
    reasoningOutputTokens: sum('reasoning_output_tokens'),
  };
}

// UNVERIFIED ASSUMPTIONS, both patterns, and still so after the first real runs (2026-10-05), which both
// completed. The exact wording Codex uses when the ChatGPT plan's usage cap is
// hit, and when it is not logged in, has not been observed in a real run: these are the phrases such
// messages are expected to hold (Claude Code's own, plus an HTTP 429, a quota, an HTTP 401, the login
// command and a refresh token that no longer works). They err on the side of stopping: a suite stopped by
// mistake is resumed and loses one trial's time, where a cap recorded as a zero is a wrong result. Replace
// them with the observed text as soon as a real run shows it.
const CODEX_CAP_PATTERN = /usage limit|hit your .*limit|limit reached|rate limit|too many requests|quota/i;
const CODEX_AUTH_PATTERN = /not logged in|codex login|(?:log|sign) in again|unauthorized|invalid api key|incorrect api key|refresh token|token (?:has |is )?expired/i;

/** Whether a Codex run died of the plan's usage cap or of the login: `{ kind: 'cap' | 'auth', message }`,
 * else `null`, with the same meaning and the same caution as `classifyAgentFailure`.
 *
 * A run whose turn completed, and in which none failed, is a result, whatever else was printed: nothing is
 * read. Otherwise what is read is never the agent's own messages, which may well talk about limits and
 * logins (a task can be about them), nor an item of type `error`, which is a notice.
 *
 * WHICH MESSAGES DECIDE, A RULE CHOSEN WITHOUT A REAL FAILED SAMPLE (no real Codex run has failed here yet):
 * for each `turn.failed`, the message of the `error` event last printed before it and then its own, and no
 * `error` event earlier than that one. Codex prints an `error` event for what it recovers from too (ASSUMED),
 * so an earlier one is a notice: a rate limit it retried through, followed by a turn that failed for
 * something else, is that turn's failure and not the cap, and read as a cap it would stop the suite at the
 * same trial on every resume. An `error` event of a turn that then completed is such a notice, and is not
 * carried into the next turn. What the rule cannot tell apart, it reads: a failed turn with no `error` event
 * of its own is read with the one before it, recovered or not, which errs on the side of stopping, as the
 * patterns do. With no failed turn and none completed, the last `error` event is how the run ended.
 *
 * When the run also exited non-zero its stderr is read after those, since a CLI that dies may say why only
 * there; with no event at all the raw stdout and stderr are read, for a non-zero exit code only, as for
 * Claude Code. A run the timeout killed is read only when a `turn.failed` said why it failed, and its stderr
 * never: an agent that printed "rate limit" while it retried, and then hung, timed out, which is a recorded
 * result. */
export function classifyCodexFailure({ stdout = '', stderr = '', exitCode = null, timedOut = false }) {
  const events = codexEvents(stdout);
  const died = !timedOut && Number.isInteger(exitCode) && exitCode !== 0;
  let texts = [];
  if (events.length === 0) {
    if (died) texts = [`${stdout}\n${stderr}`.trim()];
  } else {
    const deciding = [];
    let lastError = null;
    let turnFailed = false;
    let completed = 0;
    for (const event of events) {
      if (event.type === 'error') {
        lastError = codexMessage(event);
      } else if (event.type === 'turn.completed') {
        completed += 1;
        lastError = null;
      } else if (event.type === 'turn.failed') {
        turnFailed = true;
        deciding.push(lastError, codexMessage(event));
        lastError = null;
      }
    }
    if (turnFailed || (completed === 0 && !timedOut)) {
      texts = [...(turnFailed ? deciding : [lastError]), ...(died ? [stderr.trim()] : [])].filter(isNonEmptyString);
    }
  }
  for (const message of texts) {
    if (CODEX_AUTH_PATTERN.test(message)) return { kind: 'auth', message };
    if (CODEX_CAP_PATTERN.test(message)) return { kind: 'cap', message };
  }
  return null;
}

/** The reader of `codex exec --json` output; a config whose agent is Codex carries it as its `reader`. The
 * agent failed when a turn failed, and also when none completed: a run that ended without a `turn.completed`
 * did not finish its work, whatever its exit code says. */
export function readCodexOutput(run) {
  const output = parseCodexOutput(run.stdout);
  return {
    stop: classifyCodexFailure(run),
    parsed: output !== null,
    failed: output !== null && (output.turnFailed || output.turns.length === 0),
    usage: summarizeCodexUsage(output),
    reply: replyOf(output?.result),
  };
}

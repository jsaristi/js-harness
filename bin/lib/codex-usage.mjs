// What a Codex session spent, read from the events of `codex exec --json` once parsed (`parseEvents` in
// ../codex-review.mjs). A pure reader: it launches nothing and reads no file.
//
// The shape of the events is the one `evals/agent-output.mjs` documents for codex-cli 0.159.1; this is a
// reader of its own because the published package ships `bin/` alone, so nothing here may import `evals/`.

// The counts of a `turn.completed` event's `usage`, by the name each has in a reading.
const COUNTS = {
  inputTokens: 'input_tokens',
  cachedInputTokens: 'cached_input_tokens',
  outputTokens: 'output_tokens',
  reasoningOutputTokens: 'reasoning_output_tokens',
};

const byName = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

/** The reading of one session from its `events`:
 *  - `usage`: `inputTokens`, `cachedInputTokens`, `outputTokens` and `reasoningOutputTokens`, each the sum of
 *    its count over every `turn.completed`. `cached_input_tokens` is a PART of `input_tokens`, so the two are
 *    never added together. `reasoning_output_tokens` is kept apart: whether it is already inside
 *    `output_tokens` is NOT known, so whoever prices them decides with evidence. A count no turn reported is
 *    `null`, not 0, so that missing data is told apart from a real zero; a value that is not a number, or is
 *    negative, is ignored.
 *  - `turns`: how many `turn.completed` events there were. A Codex turn is one prompt, and its JSONL does not
 *    say how many requests to the model a turn made, so no such count is given.
 *  - `items`: how many `item.completed` events there were of each `item.type`, with no fixed list of types,
 *    so one this reader has never seen is counted too. The keys are sorted, for a stable record.
 *  - `commands`: of the `command_execution` items, the `total` and how many `failed` (did not exit 0).
 * Anything that is not a list of events reads as a session in which nothing happened. */
export function sessionReading(events) {
  const usage = { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null };
  const counted = new Map();
  const commands = { total: 0, failed: 0 };
  let turns = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type === 'turn.completed') {
      turns += 1;
      for (const [name, field] of Object.entries(COUNTS)) {
        const value = event.usage?.[field];
        if (Number.isFinite(value) && value >= 0) usage[name] = (usage[name] ?? 0) + value;
      }
    } else if (event?.type === 'item.completed' && typeof event.item?.type === 'string' && event.item.type !== '') {
      const { type } = event.item;
      counted.set(type, (counted.get(type) ?? 0) + 1);
      if (type === 'command_execution') {
        commands.total += 1;
        if (event.item.exit_code !== 0) commands.failed += 1;
      }
    }
  }
  // `fromEntries` defines each key as the object's own, so a type named `__proto__` is a count like any other.
  return { usage, turns, items: Object.fromEntries([...counted].sort(byName)), commands };
}

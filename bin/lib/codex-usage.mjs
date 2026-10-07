// What a Codex session did and spent, from the two places Codex leaves it. Nothing here launches anything.
//
// `sessionReading` reads the events of `codex exec --json` once parsed (`parseEvents` in
// ../codex-review.mjs), and no file. The shape of the events is the one `evals/agent-output.mjs` documents
// for codex-cli 0.159.1; this is a reader of its own because the published package ships `bin/` alone, so
// nothing here may import `evals/`.
//
// `rolloutReading` reads the rollout files of the Codex home it is given, which is where the tokens of a
// review are: the events of `exec review` report none (see there).
import fs from 'node:fs';
import path from 'node:path';

// The counts of a token usage, by the name each has in a reading: a `turn.completed` event's `usage` and a
// rollout file's `total_token_usage` name them alike.
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
 *    negative, is ignored. For `codex exec review` these are zeros whatever the review spent (see
 *    `rolloutReading`), so `codex-review` does not keep them.
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

/** A count as a reading holds it: the number, or `null` for what is not a count (missing, not a number,
 * negative), so that it is never taken for a real zero. */
const countOf = (value) => (Number.isFinite(value) && value >= 0 ? value : null);

/** The reading of a home whose rollout files were not read, or that held none: nothing is known, which
 * is `null` throughout and never 0. A new object on every call. */
export function noRolloutReading() {
  return {
    usage: { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null },
    requests: null,
    firstRequestInputTokens: null,
    threads: null,
  };
}

// A thread's rollout file, as Codex names it: `rollout-<timestamp>-<thread id>.jsonl`.
const ROLLOUT_FILE = /^rollout-.*\.jsonl$/;

/** Every rollout file under `dir`, at any depth. A folder that cannot be listed holds none, and a link
 * to a folder is not followed. */
function rolloutFiles(dir, found = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) rolloutFiles(file, found);
    else if (entry.isFile() && ROLLOUT_FILE.test(entry.name)) found.push(file);
  }
  return found;
}

/** By file name, which starts with the date the thread began, and then by path, for a stable order. */
function byFileName(a, b) {
  const [nameA, nameB] = [path.basename(a), path.basename(b)];
  return nameA < nameB ? -1 : nameA > nameB ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

/** The `token_count` lines of one rollout file that carry counts, in order, each as `{ info, at }`:
 * `at` is the line's `timestamp` in milliseconds, or `null` when it has none that parses. A file that
 * cannot be read holds none, and so does a line that is not JSON (a truncated tail) or is anything else.
 * Only the payload's type is asked for: the line's own `type` names the kind of rollout item, and no
 * other kind has a payload of this type. */
function tokenCounts(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const counts = [];
  for (const line of text.split('\n')) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const info = parsed?.payload?.type === 'token_count' ? parsed.payload.info : null;
    if (info === null || typeof info !== 'object' || Array.isArray(info)) continue;
    const at = typeof parsed.timestamp === 'string' ? Date.parse(parsed.timestamp) : Number.NaN;
    counts.push({ info, at: Number.isFinite(at) ? at : null });
  }
  return counts;
}

/** Whether count `a` comes before count `b`: by their timestamps when both have one, and a count with a
 * timestamp before one without. Otherwise it does not, so the order they were read in stands. */
const comesBefore = (a, b) => (a.at !== null && b.at !== null ? a.at < b.at : a.at !== null && b.at === null);

/** What the sessions of the Codex home `home` spent, read from their rollout files: every
 * `rollout-*.jsonl` under `<home>/sessions/`, at any depth, one per thread. This is the one place a
 * review's tokens are, and only when the run was not `--ephemeral`: the review runs in a sub-agent, whose
 * token counts never reach the parent thread's events (`core/src/codex_delegate.rs:311-319` at
 * rust-v0.160.0), so `turn.completed` reports zeros. `home` is a home made for one run; this module never
 * decides which, and the caller never hands it the user's own.
 *
 * The lines read are `{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":
 * {…},"last_token_usage":{…}}}}`, where `info` may be `null`. That shape is READ FROM SOURCE
 * (`protocol/src/protocol.rs:2241-2282`, `rollout/src/policy.rs:113-119`) and was not yet seen in a real
 * file when this was written, so nothing here leans on anything else of a line.
 *
 *  - `usage`: the four counts of `sessionReading`, each the sum over the threads of that thread's LAST
 *    `total_token_usage`, which is cumulative for the thread. `null` when no thread reported it.
 *  - `requests`: how many `token_count` lines with counts there were, over all the files. Codex writes one
 *    when a response from the model ends, so this is taken as the number of requests to the model: an
 *    INFERENCE from source, not something Codex names. Should Codex also write one when something else
 *    changes (its rate limits, for one), with the counts it already had, this counts those lines too; the
 *    tokens do not depend on it, being each thread's last total. `null` when there is no rollout file at all.
 *  - `firstRequestInputTokens`: the `last_token_usage.input_tokens` of the earliest such line, which is
 *    the size of the session's first request, before the model had run anything: what the session loads.
 *    Earliest by the lines' `timestamp`; among lines with none, the first of the first file by name.
 *    `null` when there is no such line or it did not report that count.
 *  - `threads`: how many rollout files held at least one such line; `null` when there is no file at all.
 * Never throws: a home that is not a path, a missing `sessions` folder, a file that cannot be read and a
 * line that is not JSON all read as nothing. */
export function rolloutReading(home) {
  const reading = noRolloutReading();
  // An empty path would resolve to the working directory, which is not a Codex home.
  if (typeof home !== 'string' || home === '') return reading;
  const files = rolloutFiles(path.join(home, 'sessions')).sort(byFileName);
  if (files.length === 0) return reading;
  reading.requests = 0;
  reading.threads = 0;
  let first = null;
  for (const file of files) {
    const counts = tokenCounts(file);
    if (counts.length === 0) continue;
    reading.requests += counts.length;
    reading.threads += 1;
    let total = null;
    for (const count of counts) {
      if (first === null || comesBefore(count, first)) first = count;
      if (count.info.total_token_usage !== null && typeof count.info.total_token_usage === 'object') total = count.info.total_token_usage;
    }
    for (const [name, field] of Object.entries(COUNTS)) {
      const value = countOf(total?.[field]);
      if (value !== null) reading.usage[name] = (reading.usage[name] ?? 0) + value;
    }
  }
  reading.firstRequestInputTokens = countOf(first?.info.last_token_usage?.input_tokens);
  return reading;
}

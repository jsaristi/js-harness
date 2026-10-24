// The count of a day's sub-agents (odd/tasks/effort-by-task.md, S3): each launch joined to the Agent call
// that started it, its role, the model and effort it asked for and ran at, and its tokens. Pure: the records
// are read by bin/subagents.mjs and handed in parsed. Of a description only its first word is ever kept,
// since the records hold the person's own messages.

/** Built-in subagent types that are read-only explorers. */
const EXPLORER_TYPES = new Set(['Explore', 'Plan', 'claude-code-guide']);

/** Fixed verb-to-role table; each verb maps to exactly one role. */
const VERB_TABLE = {
  writer: ['write', 'writer', 'fix', 'implement', 'apply', 'build', 'add', 'rewrite'],
  explorer: ['map', 'find', 'sweep', 'explore', 'search', 'locate', 'survey', 'look'],
  reviewer: ['attack', 'reader', 'review', 'read', 'judge', 'critique', 'refute'],
  verifier: ['verify', 'measure', 'count', 'check', 'test', 'probe', 'confirm'],
};

/** Flattened lookup from verb to role, built once from VERB_TABLE. */
const VERB_ROLE = new Map();
for (const [role, verbs] of Object.entries(VERB_TABLE)) {
  for (const verb of verbs) VERB_ROLE.set(verb, role);
}

/**
 * Returns the first word of a description, lower-cased, keeping only its leading letters.
 * Trailing punctuation such as ':' or ',' is therefore dropped.
 * @param {unknown} description the sub-agent description
 * @returns {string | null} the verb, or null when the description has no usable word
 */
export function verbOf(description) {
  if (typeof description !== 'string') return null;
  const first = description.trim().split(/\s+/)[0] ?? '';
  const match = /^[A-Za-z]+/.exec(first);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Decides the role of a sub-agent invocation. The first matching rule wins:
 * 1. the subagent type, 2. the description verb, 3. a haiku model, 4. other.
 * @param {{ subagentType?: unknown, description?: unknown, model?: unknown } | null | undefined} input
 *   the invocation fields; any of them may be missing or of the wrong type
 * @returns {'writer' | 'explorer' | 'reviewer' | 'verifier' | 'other'} the role
 */
export function roleOf(input) {
  const args = input !== null && typeof input === 'object' ? input : {};
  const { subagentType, description, model } = args;

  if (typeof subagentType === 'string') {
    if (EXPLORER_TYPES.has(subagentType)) return 'explorer';
    if (subagentType.startsWith('review-') || subagentType.startsWith('jd-judge')) return 'reviewer';
    if (subagentType === 'jd-fix-agent') return 'writer';
  }

  const verb = verbOf(description);
  const byVerb = verb === null ? undefined : VERB_ROLE.get(verb);
  if (byVerb !== undefined) return byVerb;

  if (typeof model === 'string' && model.toLowerCase().includes('haiku')) return 'writer';

  return 'other';
}

const SYNTHETIC_MODEL = '<synthetic>';
const FIELDS = { input: 'input_tokens', cacheCreation: 'cache_creation_input_tokens', cacheRead: 'cache_read_input_tokens', output: 'output_tokens' };

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Token totals of the API messages in a Claude Code transcript.
 *
 * `entries` are parsed transcript lines. Claude Code writes one line per content block of a message, each repeating
 * its usage, so lines are grouped by key (message id, else requestId, else the line itself) and each field keeps the
 * largest value any line of its group gives. Synthetic and non-assistant lines and malformed ones are skipped.
 *
 * @param {Array<unknown>} entries
 * @returns {{ input: number, cacheCreation: number, cacheRead: number, output: number, messages: number }}
 */
export function usageOf(entries) {
  const byKey = new Map();
  let anonymous = 0;
  for (const entry of entries) {
    const message = entry?.type === 'assistant' ? entry.message : undefined;
    if (!isObject(message) || !isObject(message.usage) || message.model === SYNTHETIC_MODEL) continue;
    const key =
      typeof message.id === 'string' ? `message ${message.id}`
      : typeof entry.requestId === 'string' ? `request ${entry.requestId}`
      : `line ${anonymous++}`;
    const seen = byKey.get(key) ?? { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 };
    for (const [name, field] of Object.entries(FIELDS)) seen[name] = Math.max(seen[name], count(message.usage[field]));
    byKey.set(key, seen);
  }

  const totals = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, messages: byKey.size };
  for (const seen of byKey.values()) {
    for (const name of Object.keys(FIELDS)) totals[name] += seen[name];
  }
  return totals;
}

const TOKEN_FIELDS = ['input', 'cacheCreation', 'cacheRead', 'output'];

/** The local day of an ISO timestamp, `YYYY-MM-DD`, at `offsetMinutes` east of universal time (Bogotá is
 * -300), or `null` for a timestamp that does not parse. `offsetMinutes` is a number, or a function giving the
 * offset at a timestamp: a day before a clock change has another offset than today (Codex, 2026-10-15). The
 * offset is passed in so a test does not depend on the machine's zone. */
export function dayOf(timestamp, offsetMinutes) {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) return null;
  const offset = typeof offsetMinutes === 'function' ? offsetMinutes(timestamp) : offsetMinutes;
  return new Date(ms + offset * 60_000).toISOString().slice(0, 10);
}

/** The model and effort each sub-agent call asked for, by its tool-use id, from a session's entries:
 * `Map<toolUseId, { model, effort }>`, a field `null` when the call did not pass it. */
export function callsOf(entries) {
  const calls = new Map();
  for (const entry of entries) {
    const content = entry?.type === 'assistant' ? entry.message?.content : null;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== 'tool_use' || (block.name !== 'Agent' && block.name !== 'Task')) continue;
      const input = block.input ?? {};
      calls.set(block.id, {
        model: typeof input.model === 'string' ? input.model : null,
        effort: typeof input.effort === 'string' ? input.effort : null,
      });
    }
  }
  return calls;
}

/** The first answer a sub-agent gave that the engine did not write itself: its model and effort. */
function ranOf(entries) {
  for (const entry of entries) {
    if (entry?.type !== 'assistant') continue;
    const model = entry.message?.model;
    if (typeof model !== 'string' || model === '<synthetic>') continue;
    return { model, effort: typeof entry.effort === 'string' ? entry.effort : null };
  }
  return { model: null, effort: null };
}

/** Each launch of `records` that started, or spent tokens, on a local day from `from` to `to` (inclusive):
 * `{ agentId, session, role, verb, modelAsked, effortAsked, inherited, modelRan, effortRan, usage, started,
 * start, end }`. A record is `{ session, agentId, meta, entries }`: the `.meta.json` object and the parsed
 * lines of one `agent-*.jsonl`. `calls` is the union of `callsOf` over the parent sessions. `effortAsked`
 * and `inherited` come from the parent's call, since the meta file records an effort even when none was
 * asked; both are `null` when the call was not found. Of the description only its first word is kept.
 * `usage` counts only the entries inside the days asked, as the sessions' usage the share compares it with
 * does; `started` says whether the launch began inside them, so one carried over midnight adds its tokens
 * to the next day without counting as one of its launches. `offsetMinutes` is a number or a function of the
 * timestamp, as `dayOf` takes it. */
export function launchesOf(records, { from, to, offsetMinutes, calls = new Map() }) {
  const inWindow = (stamp) => {
    const day = dayOf(stamp, offsetMinutes);
    return day !== null && day >= from && day <= to;
  };
  const launches = [];
  for (const { session, agentId, meta = {}, entries } of records) {
    const stamps = entries.map((entry) => entry?.timestamp).filter((stamp) => typeof stamp === 'string' && !Number.isNaN(Date.parse(stamp)));
    if (stamps.length === 0) continue;
    const start = stamps[0];
    const spent = entries.filter((entry) => typeof entry?.timestamp === 'string' && inWindow(entry.timestamp));
    const started = inWindow(start);
    if (!started && spent.length === 0) continue;
    const ran = ranOf(entries);
    const call = calls.get(meta.toolUseId) ?? null;
    const modelAsked = typeof meta.model === 'string' ? meta.model : (call?.model ?? null);
    launches.push({
      agentId,
      session,
      role: roleOf({ subagentType: meta.agentType, description: meta.description, model: modelAsked ?? ran.model }),
      verb: verbOf(meta.description),
      modelAsked,
      effortAsked: call ? call.effort : null,
      inherited: call ? call.model === null || call.effort === null : null,
      modelRan: ran.model,
      effortRan: ran.effort,
      usage: usageOf(spent),
      started,
      start,
      end: stamps.at(-1),
    });
  }
  return launches;
}

/** The count `subagents` prints: one row per role, model ran, effort asked and effort ran, sorted by
 * launches; the total; and the share of each token figure the sub-agents took of the day, `sessions`
 * being the main sessions' `usageOf` over the same days. A launch carried over from before the days
 * (`started: false`) adds its tokens and is not counted as a launch; `carried` says how many there were. */
export function countOf(launches, sessions) {
  const rows = new Map();
  const total = { launches: 0, ...Object.fromEntries(TOKEN_FIELDS.map((field) => [field, 0])) };
  for (const launch of launches) {
    const key = [launch.role, launch.modelRan, launch.effortAsked, launch.effortRan].join('|');
    const row = rows.get(key) ?? { role: launch.role, model: launch.modelRan, effortAsked: launch.effortAsked, effortRan: launch.effortRan, launches: 0, ...Object.fromEntries(TOKEN_FIELDS.map((field) => [field, 0])) };
    const counted = launch.started === false ? 0 : 1;
    row.launches += counted;
    total.launches += counted;
    for (const field of TOKEN_FIELDS) {
      row[field] += launch.usage[field];
      total[field] += launch.usage[field];
    }
    rows.set(key, row);
  }
  const share = Object.fromEntries(TOKEN_FIELDS.map((field) => {
    const all = total[field] + (sessions?.[field] ?? 0);
    return [field, all === 0 ? null : total[field] / all];
  }));
  return {
    rows: [...rows.values()].sort((a, b) => b.launches - a.launches || a.role.localeCompare(b.role)),
    total,
    share,
    other: launches.filter((launch) => launch.started !== false && launch.role === 'other').length,
    inherited: launches.filter((launch) => launch.started !== false && launch.inherited === true).length,
    callNotFound: launches.filter((launch) => launch.started !== false && launch.inherited === null).length,
    carried: launches.filter((launch) => launch.started === false).length,
  };
}

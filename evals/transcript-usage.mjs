// What the session transcripts of a Claude Code trial say it used, and what that costs at list price. Zero deps,
// plain Node.
//
// A session leaves its transcripts under `<CLAUDE_CONFIG_DIR>/projects/<project>/`: `<session>.jsonl` for the main
// thread and, for each subagent, `<session>/subagents/agent-<id>.jsonl` with an `agent-<id>.meta.json` beside it
// (read from a real session of Claude Code 2.1.292; `fixtures/transcripts/probe` is that session, trimmed). They
// hold what the result printed on stdout does not: every API response with its model and its own usage, and whether
// the orchestrator or a subagent asked for it. `modelUsage` sums a session by model, so when both sides run on one
// model it cannot split them, it cannot tell a 5-minute cache write from a 1-hour one, and it cannot tell which
// request had a long prompt; the cost of a trial needs all three (`prices.mjs`).
//
// The trial home is removed when the trial ends, so the transcripts are copied out first (`keepTranscripts`), and
// what a report needs of them goes into the trial's record (`trialListCost`), because the copies are raw logs, which
// are not committed.
import fs from 'node:fs';
import path from 'node:path';
import { PRICE_SOURCE, listCost, usd } from './prices.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Every file below `dir` as a path relative to it, sorted; none when there is no such directory. A link is neither
 * followed nor listed: what is read and copied is what the session wrote there, not what something points at. */
function filesBelow(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesBelow(entryPath, base);
    return entry.isFile() ? [path.relative(base, entryPath)] : [];
  }).sort();
}

// ---- keeping them --------------------------------------------------------------------------------------------------

/** The files of a session that are kept: the transcripts and the note that says what kind of agent each subagent was.
 * Nothing else a project directory holds (tool results, memory) is. */
const KEPT = /\.jsonl$|\.meta\.json$/;

/** Copies every transcript under `projectsDir` (a trial's `<CLAUDE_CONFIG_DIR>/projects`) into `dest`, keeping the
 * layout below the project directory, and returns `{ files, errors }`: how many were copied, and one line for each
 * that was not. It never throws for a file it could not copy, and the rest are still copied: a trial is worth more
 * than its transcripts. An error names the file by its place in the kept layout and the code of the failure, never a
 * path of the machine, because it ends up in a results file that is committed.
 *
 * A trial runs in one workspace and so has one project directory. Should a second one hold a file of the same name,
 * the first is kept and the second is an error: one of two sessions overwritten by the other would read as one.
 * `dest` is made only when there is something to keep. */
export function keepTranscripts({ projectsDir, dest }) {
  const kept = { files: 0, errors: [] };
  const taken = new Set();
  for (const file of filesBelow(projectsDir)) {
    if (!KEPT.test(file)) continue;
    const parts = file.split(path.sep);
    const inside = parts.length > 1 ? parts.slice(1) : parts;
    const name = inside.join('/');
    if (taken.has(name)) {
      kept.errors.push(`${name}: held by more than one project directory, and only the first was kept`);
      continue;
    }
    taken.add(name);
    try {
      const target = path.join(dest, ...inside);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(projectsDir, file), target);
      kept.files += 1;
    } catch (err) {
      kept.errors.push(`${name}: ${err.code ?? err.message}`);
    }
  }
  return kept;
}

// ---- reading them --------------------------------------------------------------------------------------------------

/** What Claude Code 2.1.292 writes as the model of an `assistant` line it made up itself, where the API gave no
 * answer (read in the installed binary: `model: "<synthetic>"` with a usage of its own; the probe session holds none).
 * No request was made, so it is no request here: counted, it would be a model without a price. */
const SYNTHETIC_MODEL = '<synthetic>';

const TOKEN_COUNTS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWrite5mTokens', 'cacheWrite1hTokens'];
const isCount = (value) => Number.isInteger(value) && value >= 0;
/** A cache count of the API's usage as a number. The API gives these as a number or `null`, and a usage may leave
 * one out: either way the request used none of that kind. */
const tokens = (value) => (isCount(value) ? value : 0);
/** What `requestOf` returns for an `assistant` line whose usage cannot be read. */
const UNREADABLE = Symbol('unreadable');

/** The request an `assistant` line stands for, `{ key, model, tokens, unsplit }`; `null` for a line that is none;
 * or `UNREADABLE` for one whose usage lacks its input or its output count, which every answer of the API has: priced
 * as 0 it would be a cost that looks measured, so it is counted with the lines that could not be read.
 * `key` is what the lines of one API message share: its id, else the id of the request, else nothing (`null`).
 *
 * A cache write is split by how long it lives, which is what its price depends on. A usage that names the total and
 * not the split has the rest counted as 5-minute writes, the cheaper kind, and in `unsplit`, so the summary says how
 * many tokens that assumption covers. */
function requestOf(line) {
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

/** A running total of requests. `nanoUsd` is `null` once it holds a request of a model without a price: a cost that
 * left that request out would read as the whole. */
const emptyTally = () => ({ requests: 0, ...Object.fromEntries(TOKEN_COUNTS.map((name) => [name, 0])), longPromptRequests: 0, nanoUsd: 0 });
function addTo(tally, request) {
  tally.requests += 1;
  for (const name of TOKEN_COUNTS) tally[name] += request.tokens[name];
  if (request.cost?.longPrompt) tally.longPromptRequests += 1;
  tally.nanoUsd = request.cost === null || tally.nanoUsd === null ? null : tally.nanoUsd + request.cost.nanoUsd;
}
const tallyOf = ({ nanoUsd, ...counts }) => ({ ...counts, listCostUsd: nanoUsd === null ? null : usd(nanoUsd) });

/** One side of a session: its total, and the same by model. */
const emptySide = () => ({ all: emptyTally(), models: new Map() });
function addToSide(side, request) {
  addTo(side.all, request);
  if (!side.models.has(request.model)) side.models.set(request.model, emptyTally());
  addTo(side.models.get(request.model), request);
}
const sideOf = (side) => ({ ...tallyOf(side.all), models: Object.fromEntries([...side.models].map(([model, tally]) => [model, tallyOf(tally)])) });

/** What the transcripts kept in `dir` say the session used, at list price:
 *
 *   orchestrator, subagents, total   each `{ requests, inputTokens, outputTokens, cacheReadTokens, cacheWrite5mTokens,
 *                                    cacheWrite1hTokens, longPromptRequests, listCostUsd, models }`, with `models` the
 *                                    same counts by model. A line is a subagent's when it is a sidechain
 *                                    (`isSidechain`), or sits in a subagent's own file.
 *   subagents.agents                 a row per subagent, in the order they started: `agentId`, `agentType` (what its
 *                                    meta file names, else `null`), `models`, the same counts, `efforts` (every
 *                                    `effort` its requests ran at), and `firstTimestamp`, `lastTimestamp` and `spanMs`
 *                                    over all its lines, so from the prompt it was given to the last thing it wrote.
 *   unpricedModels                   the models the price table does not hold. Their tokens are counted and every
 *                                    `listCostUsd` they are part of is `null`: never priced as another model.
 *   unsplitCacheWriteTokens          cache writes whose lifetime no line said, priced as 5-minute ones (`requestOf`).
 *   unreadableLines                  lines that are not JSON, and requests whose usage lacks a count (`requestOf`):
 *                                    a transcript cut short is seen, not silently short.
 *   source, prices                   `'transcripts'`, and the table the costs were computed from (`PRICE_SOURCE`).
 *
 * A request is one API message, and Claude Code writes a line per content block of it, each repeating the message's
 * usage: counted per line, a session would cost several times what it did. So lines are grouped by message id and
 * each count is the largest any of them gives. The probe session holds one line per message; taking the largest is
 * right whether the lines repeat the usage exactly or an early one was written before the output was complete.
 *
 * `longPromptRequests` is decided request by request (`listCost`), which is why the cost is summed from requests and
 * not computed from the totals. A directory with no transcript, or none at all, is a summary of nothing. */
export function summarizeTranscripts(dir) {
  const files = filesBelow(dir);
  const agentTypes = new Map();
  for (const file of files) {
    const id = /^agent-(.+)\.meta\.json$/.exec(path.basename(file))?.[1];
    if (id === undefined) continue;
    try {
      const { agentType } = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (typeof agentType === 'string') agentTypes.set(id, agentType);
    } catch {
      // A meta file that cannot be read names no type; the subagent keeps its row.
    }
  }

  const requests = new Map();
  const agents = new Map();
  const agentOf = (agentId) => {
    if (!agents.has(agentId)) agents.set(agentId, { agentId, efforts: [], first: null, last: null });
    return agents.get(agentId);
  };
  let unreadableLines = 0;
  let unkeyed = 0;
  for (const file of files.filter((name) => name.endsWith('.jsonl'))) {
    const fileAgent = /^agent-(.+)\.jsonl$/.exec(path.basename(file))?.[1] ?? null;
    // A subagent that was stopped before it wrote a line was spawned all the same.
    if (fileAgent !== null) agentOf(fileAgent);
    for (const text of fs.readFileSync(path.join(dir, file), 'utf8').split('\n')) {
      if (text.trim() === '') continue;
      let line;
      try {
        line = JSON.parse(text);
      } catch {
        unreadableLines += 1;
        continue;
      }
      if (!isObject(line)) continue;
      const sidechain = line.isSidechain === true || fileAgent !== null;
      const agent = sidechain ? agentOf(typeof line.agentId === 'string' ? line.agentId : fileAgent) : null;
      const at = Date.parse(line.timestamp);
      if (agent !== null && Number.isFinite(at)) {
        if (agent.first === null || at < agent.first.at) agent.first = { at, text: line.timestamp };
        if (agent.last === null || at > agent.last.at) agent.last = { at, text: line.timestamp };
      }
      const request = requestOf(line);
      if (request === null) continue;
      if (request === UNREADABLE) {
        unreadableLines += 1;
        continue;
      }
      if (agent !== null && typeof line.effort === 'string' && !agent.efforts.includes(line.effort)) agent.efforts.push(line.effort);
      const key = request.key ?? `line ${unkeyed++}`;
      const earlier = requests.get(key);
      if (earlier === undefined) {
        requests.set(key, { ...request, agent });
      } else {
        for (const name of TOKEN_COUNTS) earlier.tokens[name] = Math.max(earlier.tokens[name], request.tokens[name]);
        earlier.unsplit = Math.max(earlier.unsplit, request.unsplit);
      }
    }
  }

  const orchestrator = emptySide();
  const subagents = emptySide();
  const total = emptySide();
  const perAgent = new Map([...agents.values()].map((agent) => [agent, { tally: emptyTally(), models: [] }]));
  const unpricedModels = [];
  let unsplitCacheWriteTokens = 0;
  for (const request of requests.values()) {
    request.cost = listCost(request.model, request.tokens);
    if (request.cost === null && !unpricedModels.includes(request.model)) unpricedModels.push(request.model);
    unsplitCacheWriteTokens += request.unsplit;
    addToSide(total, request);
    addToSide(request.agent === null ? orchestrator : subagents, request);
    if (request.agent !== null) {
      const own = perAgent.get(request.agent);
      addTo(own.tally, request);
      if (!own.models.includes(request.model)) own.models.push(request.model);
    }
  }

  const started = (agent) => agent.first?.at ?? Number.POSITIVE_INFINITY;
  const rows = [...agents.values()]
    .sort((a, b) => started(a) - started(b) || (String(a.agentId) < String(b.agentId) ? -1 : 1))
    .map((agent) => ({
      agentId: agent.agentId,
      agentType: agentTypes.get(agent.agentId) ?? null,
      models: perAgent.get(agent).models,
      ...tallyOf(perAgent.get(agent).tally),
      efforts: agent.efforts,
      firstTimestamp: agent.first?.text ?? null,
      lastTimestamp: agent.last?.text ?? null,
      spanMs: agent.first === null ? null : agent.last.at - agent.first.at,
    }));

  return {
    source: 'transcripts',
    prices: PRICE_SOURCE,
    orchestrator: sideOf(orchestrator),
    subagents: { ...sideOf(subagents), agents: rows },
    total: sideOf(total),
    unpricedModels,
    unsplitCacheWriteTokens,
    unreadableLines,
  };
}

// ---- what a trial records --------------------------------------------------------------------------------------------

/** Whether the transcript totals of each model equal what Claude Code printed for it in `modelUsage`, as
 * `{ matches, models: { <model>: true | false } }`, or `null` when there is no `modelUsage` to compare with. It is
 * the guard against double counting: the same session, counted two ways, must give the same tokens. A model on one
 * side only does not match. A mismatch is a flag for whoever reads the record, not a failure. */
function checkModelUsage(summary, modelUsage) {
  if (!isObject(modelUsage)) return null;
  const models = {};
  for (const model of new Set([...Object.keys(summary.total.models), ...Object.keys(modelUsage)])) {
    const read = summary.total.models[model];
    const printed = modelUsage[model];
    models[model] = read !== undefined && isObject(printed)
      && printed.inputTokens === read.inputTokens && printed.outputTokens === read.outputTokens
      && printed.cacheReadInputTokens === read.cacheReadTokens && printed.cacheCreationInputTokens === read.cacheWrite5mTokens + read.cacheWrite1hTokens;
  }
  return { matches: Object.values(models).every(Boolean), models };
}

/** The list cost of a session from `modelUsage` alone, for a trial that kept no transcript: an ESTIMATE, marked as
 * one, or `null` without a `modelUsage`. Each model's cost is a range, `{ low, high }`, because `modelUsage` gives
 * one count of cache writes and not how long they live: all of them at the 5-minute price, and all at the 1-hour
 * one. Both ends are at the base price: whether a request had a long prompt cannot be known from sums.
 *
 * There is no split between the orchestrator and its subagents: the models are the only split `modelUsage` has, and
 * when one model covers both sides it has none. A model without a price is named and leaves the total unknown, and
 * so does one whose counts cannot be read, tokens included: never a partial sum. */
function estimateFromModelUsage(modelUsage) {
  if (!isObject(modelUsage) || Object.keys(modelUsage).length === 0) return null;
  const COUNTS = { inputTokens: 'inputTokens', outputTokens: 'outputTokens', cacheReadTokens: 'cacheReadInputTokens', cacheWriteTokens: 'cacheCreationInputTokens' };
  const sum = { ...Object.fromEntries(Object.keys(COUNTS).map((name) => [name, 0])), low: 0, high: 0 };
  const add = (name, value) => {
    sum[name] = sum[name] === null || value === null ? null : sum[name] + value;
  };
  const unpricedModels = [];
  const models = {};
  for (const [model, printed] of Object.entries(modelUsage)) {
    const counts = Object.fromEntries(Object.entries(COUNTS).map(([name, field]) => [name, Number.isInteger(printed?.[field]) && printed[field] >= 0 ? printed[field] : null]));
    const readable = Object.values(counts).every((value) => value !== null);
    // A model with one count missing is unknown in all of them: half of a usage is not a usage.
    if (!readable) for (const name of Object.keys(counts)) counts[name] = null;
    const { cacheWriteTokens, ...charged } = counts;
    const at = (lifetime) => (readable ? listCost(model, { ...charged, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0, [lifetime]: cacheWriteTokens }, { aggregate: true }) : null);
    const ends = [at('cacheWrite5mTokens'), at('cacheWrite1hTokens')].map((cost) => cost?.nanoUsd ?? null);
    const priced = ends.every((value) => value !== null);
    if (readable && !priced) unpricedModels.push(model);
    const [low, high] = priced ? [Math.min(...ends), Math.max(...ends)] : [null, null];
    models[model] = { ...counts, listCostUsd: priced ? { low: usd(low), high: usd(high) } : null };
    for (const [name, value] of Object.entries({ ...counts, low, high })) add(name, value);
  }
  const { low, high, ...counts } = sum;
  return {
    source: 'modelUsage',
    estimated: true,
    prices: PRICE_SOURCE,
    total: { ...counts, listCostUsd: low === null ? null : { low: usd(low), high: usd(high) }, models },
    unpricedModels,
  };
}

/** What a trial's record keeps as its list cost. With transcripts in `dir`, their summary (`summarizeTranscripts`)
 * and `modelUsageCheck`, whether its totals equal `modelUsage`'s (`checkModelUsage`). Without any, because the
 * session wrote none or they could not be kept, the estimate from `modelUsage` (`estimateFromModelUsage`), and `null`
 * when there is neither. `source` says which of the two a record holds. */
export function trialListCost({ dir, modelUsage }) {
  const summary = summarizeTranscripts(dir);
  if (summary.total.requests === 0) return estimateFromModelUsage(modelUsage);
  return { ...summary, modelUsageCheck: checkModelUsage(summary, modelUsage) };
}

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICE_SOURCE } from './prices.mjs';
import { keepTranscripts, summarizeTranscripts, trialListCost } from './transcript-usage.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// The transcripts of the feature's probe (`odd/tasks/subagent-model-routing.md`, E3), trimmed to the fields the
// reader uses: one Opus 5.5 session that spawned one Haiku 5.5 subagent, on Claude Code 2.1.292.
const PROBE = path.join(here, 'fixtures', 'transcripts', 'probe');
const SESSION = 'd2ddbeb2-f715-40b3-93d0-fd9218c7f2ce';
const AGENT = 'ab860aba0e9ba7266';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-transcripts-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
const tmp = (name) => {
  const dir = path.join(scratch, `${name}-${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const filesIn = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? filesIn(path.join(dir, entry.name), base) : [path.relative(base, path.join(dir, entry.name)).split(path.sep).join('/')]
)).sort() : []);

// ---- the probe session, whose totals are known ------------------------------------------------------------------------

const OPUS = 'claude-opus-5-5';
const HAIKU = 'claude-haiku-5-5';
const OPUS_TALLY = { requests: 2, inputTokens: 4, outputTokens: 152, cacheReadTokens: 40882, cacheWrite5mTokens: 0, cacheWrite1hTokens: 41266, longPromptRequests: 0, listCostUsd: 0.3413604 };
const HAIKU_TALLY = { requests: 1, inputTokens: 2, outputTokens: 4, cacheReadTokens: 0, cacheWrite5mTokens: 32765, cacheWrite1hTokens: 0, longPromptRequests: 0, listCostUsd: 0.004097825 };
const PROBE_SUMMARY = {
  source: 'transcripts',
  prices: PRICE_SOURCE,
  orchestrator: { ...OPUS_TALLY, models: { [OPUS]: OPUS_TALLY } },
  subagents: {
    ...HAIKU_TALLY,
    models: { [HAIKU]: HAIKU_TALLY },
    agents: [{
      agentId: AGENT, agentType: 'general-purpose', models: [HAIKU], ...HAIKU_TALLY, efforts: ['medium'],
      firstTimestamp: '2026-10-08T19:17:57.457Z', lastTimestamp: '2026-10-08T19:17:58.799Z', spanMs: 1342,
    }],
  },
  total: {
    requests: 3, inputTokens: 6, outputTokens: 156, cacheReadTokens: 40882, cacheWrite5mTokens: 32765, cacheWrite1hTokens: 41266, longPromptRequests: 0, listCostUsd: 0.345458225,
    models: { [OPUS]: OPUS_TALLY, [HAIKU]: HAIKU_TALLY },
  },
  unpricedModels: [],
  unsplitCacheWriteTokens: 0,
  unreadableLines: 0,
};
/** What Claude Code printed as `modelUsage` for the probe session; its `costUSD` of Haiku is the wrong one (E3). */
const PROBE_MODEL_USAGE = {
  [OPUS]: { inputTokens: 4, outputTokens: 152, cacheReadInputTokens: 40882, cacheCreationInputTokens: 41266, costUSD: 0.3413604 },
  [HAIKU]: { inputTokens: 2, outputTokens: 4, cacheReadInputTokens: 0, cacheCreationInputTokens: 32765, costUSD: 0.163913, costBasis: 'unknown' },
};

test('the probe session: the orchestrator and its one subagent, each with its requests, its tokens and its exact list cost', () => {
  assert.deepEqual(summarizeTranscripts(PROBE), PROBE_SUMMARY);
});

test('the fixture holds only what the reader uses: no path of the machine it was recorded on, no user and no message text', () => {
  const files = filesIn(PROBE);
  assert.deepEqual(files, [`${SESSION}.jsonl`, `${SESSION}/subagents/agent-${AGENT}.jsonl`, `${SESSION}/subagents/agent-${AGENT}.meta.json`]);
  for (const file of files) {
    const text = fs.readFileSync(path.join(PROBE, file), 'utf8');
    assert.doesNotMatch(text, /cwd|[A-Za-z]:[\\/]|\/Users\/|\/home\/|@|userType|sessionId/, file);
    for (const line of text.split('\n').filter(Boolean)) {
      const content = JSON.parse(line).message?.content;
      for (const block of Array.isArray(content) ? content : content === undefined ? [] : [{ text: content }]) assert.ok(block.text === undefined || block.text === 'placeholder', file);
    }
  }
});

// ---- transcripts written by hand, for what the probe does not show ---------------------------------------------------

let ids = 0;
const usageOf = ({ input = 0, output = 0, read = 0, write5m = 0, write1h = 0 } = {}) => ({
  input_tokens: input, output_tokens: output, cache_read_input_tokens: read, cache_creation_input_tokens: write5m + write1h,
  cache_creation: { ephemeral_5m_input_tokens: write5m, ephemeral_1h_input_tokens: write1h },
});
/** One `assistant` line as Claude Code 2.1.292 writes it, trimmed like the fixture. `agent` makes it a subagent's. */
const assistant = ({ model = OPUS, agent, id = `msg_${ids++}`, at = '2026-10-08T10:00:00.000Z', effort = 'medium', usage, ...tokens } = {}) => ({
  type: 'assistant', isSidechain: agent !== undefined, ...(agent !== undefined && { agentId: agent }), timestamp: at, requestId: `req_${id}`, effort,
  message: { id, model, role: 'assistant', usage: usage ?? usageOf(tokens) },
});
const other = ({ agent, at, type = 'user' }) => ({ type, isSidechain: agent !== undefined, ...(agent !== undefined && { agentId: agent }), timestamp: at });
const jsonl = (lines) => `${lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n')}\n`;
/** A kept-transcripts directory: `main` are the lines of the session file, `agents` the lines of each subagent's
 * file by agent id, and `types` the agent type its meta file names (none for an agent left out). */
function transcripts({ main = [], agents = {}, types = {} } = {}) {
  const dir = tmp('kept');
  write(path.join(dir, 'session.jsonl'), jsonl(main));
  for (const [agent, lines] of Object.entries(agents)) write(path.join(dir, 'session', 'subagents', `agent-${agent}.jsonl`), jsonl(lines));
  for (const [agent, agentType] of Object.entries(types)) write(path.join(dir, 'session', 'subagents', `agent-${agent}.meta.json`), JSON.stringify({ agentType, description: 'placeholder' }));
  return dir;
}

test('an API message that spans several lines is one request, counted once, with the largest of each count', () => {
  // Claude Code writes a line per content block, each repeating the message's usage. The first one here was
  // written while the answer was still streaming, so its output count is short.
  const streaming = usageOf({ input: 3, output: 1, read: 1000, write1h: 200 });
  const final = usageOf({ input: 3, output: 90, read: 1000, write1h: 200 });
  const dir = transcripts({ main: [
    assistant({ id: 'msg_a', usage: streaming }), assistant({ id: 'msg_a', usage: final }), assistant({ id: 'msg_a', usage: final }),
    assistant({ id: 'msg_b', input: 1, output: 10 }),
  ] });
  const { orchestrator, total } = summarizeTranscripts(dir);
  assert.deepEqual(
    [orchestrator.requests, orchestrator.inputTokens, orchestrator.outputTokens, orchestrator.cacheReadTokens, orchestrator.cacheWrite1hTokens],
    [2, 4, 100, 1000, 200],
  );
  assert.equal(total.requests, 2);
  // Without an id the request id tells the lines of one message apart; with neither, every line is its own.
  const noIds = transcripts({ main: [
    { ...assistant({ output: 5 }), requestId: 'req_x', message: { model: OPUS, usage: usageOf({ output: 5 }) } },
    { ...assistant({ output: 5 }), requestId: 'req_x', message: { model: OPUS, usage: usageOf({ output: 5 }) } },
    { type: 'assistant', isSidechain: false, message: { model: OPUS, usage: usageOf({ output: 7 }) } },
    { type: 'assistant', isSidechain: false, message: { model: OPUS, usage: usageOf({ output: 7 }) } },
  ] });
  assert.deepEqual([summarizeTranscripts(noIds).total.requests, summarizeTranscripts(noIds).total.outputTokens], [3, 19]);
});

test('every subagent has a row of its own: its type from its meta file, its models, its efforts and the span of its lines', () => {
  const dir = transcripts({
    main: [assistant({ input: 5, output: 50, write1h: 1000 })],
    agents: {
      late: [
        other({ agent: 'late', at: '2026-10-08T10:05:00.000Z' }),
        assistant({ agent: 'late', model: HAIKU, at: '2026-10-08T10:05:01.000Z', input: 1, output: 20, write5m: 400, effort: 'medium' }),
        assistant({ agent: 'late', model: HAIKU, at: '2026-10-08T10:05:09.500Z', input: 2, output: 30, read: 400, effort: 'high' }),
        other({ agent: 'late', at: '2026-10-08T10:05:10.250Z', type: 'attachment' }),
      ],
      early: [
        other({ agent: 'early', at: '2026-10-08T10:01:00.000Z' }),
        assistant({ agent: 'early', model: OPUS, at: '2026-10-08T10:01:02.000Z', input: 3, output: 40, write5m: 100 }),
      ],
      // Spawned, and stopped before the model answered once: a subagent all the same.
      silent: [other({ agent: 'silent', at: '2026-10-08T10:09:00.000Z' })],
    },
    types: { late: 'Explore', early: 'general-purpose' },
  });
  const { orchestrator, subagents, total } = summarizeTranscripts(dir);
  assert.deepEqual(subagents.agents.map((row) => row.agentId), ['early', 'late', 'silent'], 'in the order they started');
  assert.deepEqual(subagents.agents[1], {
    agentId: 'late', agentType: 'Explore', models: [HAIKU],
    requests: 2, inputTokens: 3, outputTokens: 50, cacheReadTokens: 400, cacheWrite5mTokens: 400, cacheWrite1hTokens: 0, longPromptRequests: 0,
    // 3 x 0.10 + 50 x 0.50 + 400 x 0.01 + 400 x 0.125 millionths of a dollar.
    listCostUsd: 0.0000793,
    efforts: ['medium', 'high'], firstTimestamp: '2026-10-08T10:05:00.000Z', lastTimestamp: '2026-10-08T10:05:10.250Z', spanMs: 10250,
  });
  assert.deepEqual([subagents.agents[0].agentType, subagents.agents[0].models], ['general-purpose', [OPUS]]);
  assert.deepEqual(subagents.agents[2], {
    agentId: 'silent', agentType: null, models: [],
    requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0, longPromptRequests: 0, listCostUsd: 0,
    efforts: [], firstTimestamp: '2026-10-08T10:09:00.000Z', lastTimestamp: '2026-10-08T10:09:00.000Z', spanMs: 0,
  });
  // The same model on both sides is split by who asked, which `modelUsage` cannot do.
  assert.deepEqual(Object.keys(orchestrator.models), [OPUS]);
  assert.deepEqual(Object.keys(subagents.models).sort(), [HAIKU, OPUS].sort());
  assert.deepEqual([orchestrator.models[OPUS].requests, subagents.models[OPUS].requests, total.models[OPUS].requests], [1, 1, 2]);
  assert.equal(total.requests, 4);
  assert.equal(total.outputTokens, orchestrator.outputTokens + subagents.outputTokens);
});

test('a Haiku request over the long-prompt limit is counted and priced as one, request by request', () => {
  const dir = transcripts({ agents: { a: [
    assistant({ agent: 'a', model: HAIKU, input: 10, read: 99990, output: 100 }),
    assistant({ agent: 'a', model: HAIKU, input: 11, read: 99990, output: 100 }),
  ] } });
  const { subagents } = summarizeTranscripts(dir);
  assert.equal(subagents.longPromptRequests, 1);
  assert.equal(subagents.agents[0].longPromptRequests, 1);
  // The first at list price, 1,050.9 millionths of a dollar; the second, one token over, at five times 1,051.
  assert.equal(subagents.listCostUsd, 0.0063059);
});

test('a model without a list price is named and leaves every cost it is part of unknown, never priced as another model', () => {
  const dir = transcripts({
    main: [assistant({ input: 5, output: 50 })],
    agents: { a: [assistant({ agent: 'a', model: 'claude-haiku-4-5', input: 7, output: 70 })], b: [assistant({ agent: 'b', model: HAIKU, input: 1, output: 2 })] },
  });
  const { orchestrator, subagents, total, unpricedModels } = summarizeTranscripts(dir);
  assert.deepEqual(unpricedModels, ['claude-haiku-4-5']);
  assert.equal(orchestrator.listCostUsd, 0.00102, 'a side that holds no such model keeps its cost');
  assert.deepEqual([subagents.listCostUsd, total.listCostUsd, subagents.models['claude-haiku-4-5'].listCostUsd, subagents.agents[0].listCostUsd], [null, null, null, null]);
  assert.equal(subagents.agents[1].listCostUsd, 0.0000011, 'nor does the subagent that ran on a priced one');
  assert.deepEqual([subagents.models['claude-haiku-4-5'].inputTokens, total.outputTokens], [7, 122], 'its tokens are counted all the same');
});

test('what is no request is not counted: other lines, a line Claude Code made up itself, a line without usage; a torn line and a usage without its counts are counted as unreadable', () => {
  const dir = transcripts({ main: [
    { type: 'queue-operation', timestamp: '2026-10-08T10:00:00.000Z' },
    other({ at: '2026-10-08T10:00:00.000Z' }),
    assistant({ input: 1, output: 2 }),
    // What the CLI writes in place of an answer the API never gave: no request was made, no token was used.
    assistant({ model: '<synthetic>' }),
    { type: 'assistant', isSidechain: false, message: { id: 'msg_none', model: OPUS } },
    '{"type":"assistant","isSidechain":false,"message":{"id":"msg_torn","model":"claude-op',
    // A usage every answer of the API has two counts of: without one, the request cannot be priced, and is not priced as 0.
    { type: 'assistant', isSidechain: false, message: { id: 'msg_half', model: OPUS, usage: { input_tokens: 5 } } },
    '',
    '[1, 2]',
  ] });
  const summary = summarizeTranscripts(dir);
  assert.deepEqual([summary.total.requests, summary.total.inputTokens, summary.total.outputTokens], [1, 1, 2]);
  assert.deepEqual(summary.unpricedModels, []);
  assert.equal(summary.unreadableLines, 2, 'the torn line and the half usage are counted, so a transcript cut short is seen');
});

test('cache writes whose lifetime the transcript does not say are priced as 5-minute ones and counted apart', () => {
  const dir = transcripts({ main: [
    { ...assistant(), message: { id: 'msg_old', model: OPUS, usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: null, cache_creation_input_tokens: 1000 } } },
  ] });
  const summary = summarizeTranscripts(dir);
  assert.deepEqual([summary.total.cacheWrite5mTokens, summary.total.cacheWrite1hTokens, summary.total.cacheReadTokens, summary.unsplitCacheWriteTokens], [1000, 0, 0, 1000]);
});

test('a directory with no transcript, or none at all, is a summary of nothing', () => {
  for (const dir of [tmp('empty'), path.join(scratch, 'never-made')]) {
    const summary = summarizeTranscripts(dir);
    assert.deepEqual([summary.total.requests, summary.total.listCostUsd, summary.subagents.agents, summary.total.models], [0, 0, [], {}]);
  }
});

// ---- what a trial records ---------------------------------------------------------------------------------------------

test('a trial with transcripts records their summary and whether each model\'s totals equal what Claude Code printed', () => {
  assert.deepEqual(trialListCost({ dir: PROBE, modelUsage: PROBE_MODEL_USAGE }), {
    ...PROBE_SUMMARY, modelUsageCheck: { matches: true, models: { [OPUS]: true, [HAIKU]: true } },
  });
});

test('a total that differs from modelUsage is a flag on that model, not a failure: it is the guard against double counting', () => {
  const doubled = { ...PROBE_MODEL_USAGE, [HAIKU]: { ...PROBE_MODEL_USAGE[HAIKU], cacheCreationInputTokens: 32765 * 2 } };
  assert.deepEqual(trialListCost({ dir: PROBE, modelUsage: doubled }).modelUsageCheck, { matches: false, models: { [OPUS]: true, [HAIKU]: false } });
  // A model on one side only: a side call the transcripts do not hold, or a transcript the result does not count.
  const sideCall = { ...PROBE_MODEL_USAGE, 'claude-haiku-4-5': { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } };
  assert.deepEqual(trialListCost({ dir: PROBE, modelUsage: sideCall }).modelUsageCheck, { matches: false, models: { [OPUS]: true, [HAIKU]: true, 'claude-haiku-4-5': false } });
  const { [HAIKU]: _haiku, ...opusOnly } = PROBE_MODEL_USAGE;
  assert.deepEqual(trialListCost({ dir: PROBE, modelUsage: opusOnly }).modelUsageCheck, { matches: false, models: { [OPUS]: true, [HAIKU]: false } });
  for (const none of [null, undefined]) assert.equal(trialListCost({ dir: PROBE, modelUsage: none }).modelUsageCheck, null, 'nothing to compare with');
  assert.equal(trialListCost({ dir: PROBE, modelUsage: null }).total.listCostUsd, 0.345458225, 'the cost does not depend on it');
});

test('a trial that kept no transcript records an estimate from modelUsage: a range, cache writes at the 5-minute and at the 1-hour price', () => {
  for (const dir of [tmp('none'), path.join(scratch, 'never-made')]) {
    assert.deepEqual(trialListCost({ dir, modelUsage: PROBE_MODEL_USAGE }), {
      source: 'modelUsage',
      estimated: true,
      prices: PRICE_SOURCE,
      total: {
        inputTokens: 6, outputTokens: 156, cacheReadTokens: 40882, cacheWriteTokens: 74031, listCostUsd: { low: 0.221660225, high: 0.3479156 },
        models: {
          [OPUS]: { inputTokens: 4, outputTokens: 152, cacheReadTokens: 40882, cacheWriteTokens: 41266, listCostUsd: { low: 0.2175624, high: 0.3413604 } },
          [HAIKU]: { inputTokens: 2, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 32765, listCostUsd: { low: 0.004097825, high: 0.0065552 } },
        },
      },
      unpricedModels: [],
    });
  }
});

test('the estimate names a model without a price and leaves the total unknown; without modelUsage there is no cost at all', () => {
  const dir = tmp('none');
  const estimate = trialListCost({ dir, modelUsage: { [OPUS]: PROBE_MODEL_USAGE[OPUS], 'fake-model': { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 30, cacheCreationInputTokens: 20 } } });
  assert.deepEqual(estimate.unpricedModels, ['fake-model']);
  assert.deepEqual([estimate.total.listCostUsd, estimate.total.models['fake-model'].listCostUsd], [null, null]);
  assert.deepEqual(estimate.total.models[OPUS].listCostUsd, { low: 0.2175624, high: 0.3413604 });
  assert.equal(estimate.total.inputTokens, 14);
  // A model whose counts cannot be read is unknown in tokens and in cost, and so is the total: never a partial sum.
  const broken = trialListCost({ dir, modelUsage: { [OPUS]: PROBE_MODEL_USAGE[OPUS], [HAIKU]: { inputTokens: 2, outputTokens: 'four' } } });
  assert.deepEqual(broken.total.models[HAIKU], { inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, listCostUsd: null });
  assert.deepEqual([broken.total.inputTokens, broken.total.listCostUsd, broken.unpricedModels], [null, null, []]);
  for (const none of [null, undefined, {}, 'none']) assert.equal(trialListCost({ dir, modelUsage: none }), null, JSON.stringify(none));
});

// ---- keeping the transcripts of a trial ---------------------------------------------------------------------------------

/** A trial's `projects` directory as Claude Code leaves it: the probe's transcripts under a project named after the
 * workspace, beside files that are no transcript. */
function projectsDir() {
  const projects = path.join(tmp('home'), '.claude', 'projects');
  const project = path.join(projects, 'D--work-eval-abc');
  fs.cpSync(PROBE, project, { recursive: true });
  write(path.join(project, SESSION, 'tool-results', 'toolu_1.txt'), 'the output of a tool');
  write(path.join(project, 'memory', 'MEMORY.md'), '# memory');
  write(path.join(project, 'sessions-index.json'), '{}');
  return projects;
}
const PROBE_FILES = [`${SESSION}.jsonl`, `${SESSION}/subagents/agent-${AGENT}.jsonl`, `${SESSION}/subagents/agent-${AGENT}.meta.json`];

test('keepTranscripts copies every .jsonl and .meta.json below the project directory, in the same layout, and nothing else', () => {
  const projects = projectsDir();
  const dest = path.join(tmp('runs'), 'stem.transcripts');
  assert.deepEqual(keepTranscripts({ projectsDir: projects, dest }), { files: 3, errors: [] });
  assert.deepEqual(filesIn(dest), PROBE_FILES);
  for (const file of PROBE_FILES) assert.equal(fs.readFileSync(path.join(dest, file), 'utf8'), fs.readFileSync(path.join(PROBE, file), 'utf8'), file);
  assert.deepEqual(summarizeTranscripts(dest), PROBE_SUMMARY, 'what was kept reads as the session did');
  assert.ok(fs.existsSync(path.join(projects, 'D--work-eval-abc', `${SESSION}.jsonl`)), 'a copy: the home is left as it was');
});

test('keepTranscripts of a home that holds no transcript keeps nothing and makes nothing', () => {
  const dest = path.join(tmp('runs'), 'stem.transcripts');
  assert.deepEqual(keepTranscripts({ projectsDir: path.join(tmp('home'), '.claude', 'projects'), dest }), { files: 0, errors: [] });
  const bare = path.join(tmp('home'), '.claude', 'projects');
  write(path.join(bare, 'D--work-eval-abc', 'memory', 'MEMORY.md'), '# memory');
  assert.deepEqual(keepTranscripts({ projectsDir: bare, dest }), { files: 0, errors: [] });
  assert.equal(fs.existsSync(dest), false);
});

test('a file that cannot be copied is named and the rest are still kept; a second project never overwrites the first', () => {
  const projects = projectsDir();
  const dest = path.join(tmp('runs'), 'stem.transcripts');
  const realCopy = fs.copyFileSync;
  fs.copyFileSync = (from, to) => {
    if (String(from).endsWith('.meta.json')) throw Object.assign(new Error(`EPERM: operation not permitted, copyfile '${from}'`), { code: 'EPERM' });
    return realCopy(from, to);
  };
  let kept;
  try {
    kept = keepTranscripts({ projectsDir: projects, dest });
  } finally {
    fs.copyFileSync = realCopy;
  }
  assert.deepEqual(kept, { files: 2, errors: [`${SESSION}/subagents/agent-${AGENT}.meta.json: EPERM`] }, 'the error names the file inside the kept layout, never a path of the machine');
  assert.deepEqual(filesIn(dest), PROBE_FILES.slice(0, 2));

  // Two project directories that hold a file of the same name: one session cannot be two, so the second is refused.
  const twice = projectsDir();
  write(path.join(twice, 'D--work-other', `${SESSION}.jsonl`), jsonl([assistant({ output: 999 })]));
  const second = path.join(tmp('runs'), 'stem.transcripts');
  const result = keepTranscripts({ projectsDir: twice, dest: second });
  assert.deepEqual(result, { files: 3, errors: [`${SESSION}.jsonl: held by more than one project directory, and only the first was kept`] });
  assert.equal(fs.readFileSync(path.join(second, `${SESSION}.jsonl`), 'utf8'), fs.readFileSync(path.join(PROBE, `${SESSION}.jsonl`), 'utf8'));
});

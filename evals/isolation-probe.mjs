#!/usr/bin/env node
// The isolation probe: runs ONE agent trial under the eval sandbox against a loopback fake Anthropic
// Messages API (zero spend, no network), then proves the machine's real Claude Code state was untouched.
// Zero deps, plain Node. Why a sandbox is needed and what it is made of: `odd/tasks/evals.md` ("T2 map and
// decisions"). This is the check that the sandbox is real, not assumed: the sandbox env is a list of
// variables somebody believes every writer honours, and only a run of the real binary says whether it does.
//
//   node evals/isolation-probe.mjs --claude <absolute path> [--arm current|minimal|both|current-without-<id>|minimal-with-mcp-<name>] [--control-ms <n>]
//     [--report <path>] [--keep-sandbox] [--timeout-ms <n>]
//
// How it proves anything, rather than merely failing to find a leak:
//  - A random NONCE is the agent's prompt and the content of the files it is told to write. The nonce is
//    never printed, logged or written to the report; the report is scrubbed of it as a last step.
//  - Before and after the trial, every real tree where Claude Code or its tools could write is hashed. The
//    after-pass also scans every file's content for the nonce, for the unique name of the sandbox's temp
//    root and for the trial's Claude session id (what the engram hooks post; known once the agent has run, and
//    never written anywhere before that scan), none of which a real file has a reason to contain. Hits are
//    reported by path, never by value.
//  - POSITIVE CONTROLS inside the sandbox (the nonce is in a transcript, the tool-written files exist, the
//    engram store was created) prove the trial wrote where it was meant to. Without them a sandbox that
//    wrote nothing at all, or an agent that never ran, would pass the leak check vacuously.
//  - THE ENGRAM PLUGIN'S PATHS are driven too, because the current arm carries the plugin's hooks, which talk
//    HTTP to a port that is 7437 unless the env says otherwise, and 7437 is where the real engram server
//    answers. Each trial gets a port of its own (`ports.mjs`); the fake API has the agent call the engram MCP
//    tool (`mem_save`) and a subagent, the prompt itself goes through UserPromptSubmit and the session through
//    SessionStart, and the probe then checks that what the hooks write on every path they take is in the
//    SANDBOX (UserPromptSubmit's state file, the log of the server SessionStart started, the session it
//    posted: see `positiveControls`), that nothing of the run is in the real store (the real `~/.engram` is
//    hashed and scanned for the nonce, the sandbox name and the session id like every other real tree: a SQLite
//    write changes the file and puts the text in it, which is why that evidence, and not a count taken from the
//    server, is the one that decides), that nothing listens on the trial's port afterwards, and that no engram
//    process the trial started is still running.
//  - Live writers (this very Claude session, the engram and codegraph daemons) keep changing the real trees,
//    so a diff alone cannot fail the run. `--control-ms` measures that churn first, with no agent, and the
//    report splits trial-window changes into those also seen at baseline and new ones.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArmError, parseArm } from './arms.mjs';
import { assertWorkRoot, currentConfig, defaultWorkRoot, minimalConfig, minimalWithConfig } from './configs.mjs';
import { PAYLOAD, buildTemplate, removeTemplate, seedFromTemplate, seedMinimalWith } from './home.mjs';
import { withoutEvidence } from './without.mjs';
import { findProcesses, isListening as portIsListening } from './ports.mjs';
import { childEnv, killByPath, parseAgentOutput, removeDir, resolveAgent, runProcess } from './runner.mjs';
import { DEFAULT_CHUNK, DEFAULT_CONCURRENCY, ENGRAM_PARTS, diffSnapshots, exists, findInStore, findSession, fold, inspectEnv, isObject, keyLeaks, leakHits, normalize, positiveControls, snapshotTrees, splitByControl, summarizeTop, treeChanged } from './isolation-probe-trees.mjs';
import { formatSummary } from './isolation-probe-summary.mjs';

// What moved beside the probe, exported from here too, where it always was.
export { diffSnapshots, findInStore, keyLeaks, leakHits, parseEnvLines, scanFile, snapshotTrees, splitByControl, summarizeTop, walkFiles } from './isolation-probe-trees.mjs';
export { diffLines, formatSummary, megabytes, seconds } from './isolation-probe-summary.mjs';

/** What the probe runs the agent as. The model and effort are the eval's real ones, so the request shape
 * (tools offered, haiku side calls) is the one a measured trial produces; `bypassPermissions` is for the
 * probe only, because a headless agent that must ask before running a tool never runs it. */
const PROBE_MODEL = 'claude-opus-5-5';
const PROBE_EFFORT = 'medium';
const PROBE_PERMISSION_MODE = 'bypassPermissions';

/** The API key every probe run hands the agent. It is obviously not a key, and it is scrubbed from every
 * output all the same: a probe that printed a key-shaped string would teach people to ignore the real
 * thing. The agent has no other credential: `CLAUDE_CODE_OAUTH_TOKEN` is removed from its env. */
export const DUMMY_API_KEY = 'sk-ant-api03-DUMMY-isolation-probe-not-a-real-key';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SANDBOX_PREFIX = 'js-harness-iso-probe-';
const TEMPLATE_PREFIX = 'js-harness-iso-template-';

/** A fresh 128-bit nonce, as 32 hex characters. */
export const makeNonce = () => crypto.randomBytes(16).toString('hex');

// ---- the fake Messages API ----------------------------------------------------------------------------

/** The variables the agent's Bash tool is told to report, so the report shows what Claude's own tools see
 * (not what the probe believes it set). `ANTHROPIC_BASE_URL` shows whether the tool env keeps it. */
export const PROBE_ENV_VARS = [
  'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME',
  'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache', 'ANTHROPIC_BASE_URL', 'ENGRAM_PORT', 'ENGRAM_URL',
  'ENGRAM_SOCKET',
];

/** The shell command the fake API has the agent run (Claude Code's Bash tool runs Git Bash on Windows): the
 * environment as `NAME=value` lines, into `probe-env.txt` and also to stdout, so the tool_result carries
 * them, then the nonce into `probe-nonce.txt`. `OAUTH_TOKEN_SET` prints `yes` or nothing, never the token:
 * it shows the login token was removed from the agent's env without risking a print of it. */
export function probeCommand(nonce) {
  const lines = PROBE_ENV_VARS.map((name) => `printf '${name}=%s\\n' "$${name}"`);
  lines.push(`printf 'OAUTH_TOKEN_SET=%s\\n' "\${CLAUDE_CODE_OAUTH_TOKEN:+yes}"`);
  return `{ ${lines.join('; ')}; } > probe-env.txt; cat probe-env.txt; echo ${nonce} > probe-nonce.txt`;
}

const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');

/** The SSE events of the Messages API for one assistant `message`: a text block as one `text_delta`, a
 * tool_use block as `input_json_delta` pieces (two, so a client that joins them is exercised). */
function messageEvents(message) {
  const events = [['message_start', { type: 'message_start', message: { ...message, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: message.usage.input_tokens, output_tokens: 1 } } }]];
  message.content.forEach((block, index) => {
    if (block.type === 'text') {
      events.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } }]);
      events.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } }]);
    } else {
      events.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} } }]);
      const json = JSON.stringify(block.input);
      const middle = Math.ceil(json.length / 2);
      for (const piece of [json.slice(0, middle), json.slice(middle)]) {
        events.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: piece } }]);
      }
    }
    events.push(['content_block_stop', { type: 'content_block_stop', index }]);
  });
  events.push(['message_delta', { type: 'message_delta', delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: message.usage.output_tokens } }]);
  events.push(['message_stop', { type: 'message_stop' }]);
  return events;
}

const textOfResult = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((block) => isObject(block) && typeof block.text === 'string').map((block) => block.text).join('\n');
  return '';
};

const MARKER_MIN_LENGTH = 50;
const MARKER_LIMIT = 40;

/** The distinctive lines of a global `CLAUDE.md`, as the contamination check's markers: each line
 * whitespace-normalized, at least 50 characters (a short line is common to many prompts), once each, the
 * longest first and at most 40. The file is plain instructions, not a secret, but the markers are only ever
 * compared against requests and never printed or written to the report. */
export function claudeMdMarkers(text) {
  const lines = String(text).split(/\r?\n/).map(normalize).filter((line) => line.length >= MARKER_MIN_LENGTH && !line.startsWith('```'));
  return [...new Set(lines)].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).slice(0, MARKER_LIMIT);
}

/** Every string below `value`, joined: what the model is sent, wherever the SDK put it (a system string, a
 * block array, a message, a nested tool_result). */
function allText(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) allText(item, out);
  else if (isObject(value)) for (const item of Object.values(value)) allText(item, out);
  return out;
}

/** Whether a request body carries the global `CLAUDE.md`: at least two of its markers (one when there is
 * only one), whitespace-normalized on both sides. Two, because a single long line can occur in another
 * prompt by chance and the whole file cannot. A boolean, so the text is never kept. */
function carriesMarkers(body, markers) {
  if (markers.length === 0) return false;
  const text = normalize(allText([body.system, body.messages]).join('\n'));
  return markers.filter((marker) => text.includes(marker)).length >= Math.min(2, markers.length);
}

/** A description is matched by its first characters, as a listing may cut a long one short, and only when it is long
 * enough not to occur in another prompt by chance. */
const DESCRIPTION_MIN_LENGTH = 30;
const DESCRIPTION_PREFIX = 80;

/** What the fake API looks for of a component an arm takes out (G2 of `odd/tasks/future-model-protocol.md`, C6a),
 * from what `withoutEvidence` (`evals/without.mjs`) says a request carries of it: the prefixes of its tool names, the
 * markers of the lines it is sent whole (as `claudeMdMarkers` picks them) and the first characters of each description.
 * All three empty: a request carries nothing of it, and the probe cannot see it. */
export function needlesOf({ tools, lines, descriptions }) {
  const prefixes = descriptions.map(normalize).filter((text) => text.length >= DESCRIPTION_MIN_LENGTH).map((text) => text.slice(0, DESCRIPTION_PREFIX));
  return { tools, markers: claudeMdMarkers(lines.join('\n')), prefixes: [...new Set(prefixes)] };
}

/** Whether a request body, which offers the tools `toolNames`, carries a component (`needlesOf`), anywhere in the system
 * prompt, the messages or the tools' descriptions, where a listing of skills or agents goes: a tool of it, one of its
 * descriptions (each is a skill, an agent or a command of its own, so one left is the component not wholly gone), or
 * two of its markers (one when it has one), which are lines of one text. A boolean, so the text is never kept. */
function carriesComponent(body, toolNames, { tools, markers, prefixes }) {
  if (toolNames.some((name) => tools.some((prefix) => name.startsWith(prefix)))) return true;
  if (markers.length === 0 && prefixes.length === 0) return false;
  const text = normalize(allText([body.system, body.messages, body.tools]).join('\n'));
  return prefixes.some((prefix) => text.includes(prefix)) || (markers.length > 0 && markers.filter((marker) => text.includes(marker)).length >= Math.min(2, markers.length));
}

/** The text the first user message of a subagent the probe starts carries, which is how the fake API tells that
 * request from the main agent's. */
const SUBAGENT_MARKER = 'Isolation probe subagent';
/** The engram MCP tool that saves a memory, whatever the server is called in the config (`mcp__engram__mem_save` for a
 * server entry, `mcp__plugin_engram_engram__mem_save` for a plugin's own). */
const MEM_SAVE_TOOL = /^mcp__[A-Za-z0-9_]*engram[A-Za-z0-9_]*__mem_save$/;
/** The tool that starts a subagent: `Agent`, or `Task` in the CLIs that still call it that. */
const SUBAGENT_TOOLS = ['Agent', 'Task'];
/** What the probe looks for, inside the sandbox's engram store, to know a path of the plugin ran: the prompt (stored
 * by UserPromptSubmit, which is why the probe's prompt holds the nonce as `nonce:<nonce>`), the memory the MCP tool
 * saves, and what the subagent said last (stored by SubagentStop, if the server keeps it). */
const engramNeedles = (nonce) => ({ prompt: `nonce:${nonce}`, memory: `memsave:${nonce}`, subagent: `subagent:${nonce}` });

/** Starts the fake Messages API on `127.0.0.1` (port 0: the OS picks a free one) and resolves to `{ url,
 * port, requests, toolResults(), close() }`.
 *
 * It scripts the agent so that one trial exercises every writer the probe is about: a request that offers
 * `Bash` and has not used it gets a `Bash` tool_use (`probeCommand`), then one offering `Write` gets a
 * `Write` of `probe-write.txt` in `workspace` (the server cannot know the agent's cwd, so the probe passes
 * it in) holding the nonce, then, when the engram MCP tool is offered, a `mem_save` of `memsave:<nonce>`,
 * then, when a subagent tool is offered, a subagent (whose own requests, recognized by `SUBAGENT_MARKER`, are
 * answered in text with `subagent:<nonce>` and never scripted further), and then a plain-text reply with the
 * nonce. A small/fast model (title generation, hooks) or a request with no tools only ever gets the text, so
 * those calls, and a nested reviewer `claude`, complete without recursing into the script. `stream: true` is
 * honoured with SSE.
 *
 * `markers` (see `claudeMdMarkers`) are matched against every `/v1/messages` request: the log says whether the
 * request carried the real global CLAUDE.md, which is how the probe sees that a trial loaded it. `track` is the
 * components an arm is about, each `{ id, tools, markers, prefixes }` (`needlesOf`): every `/v1/messages` entry gets
 * `components`, the ids mapped to whether the request carried each (`carriesComponent`); `track(list)` replaces them,
 * for a caller that learns them only once the server runs.
 *
 * `requests` is the log: method, path (no query), model, whether tools were offered, whether the engram tool was among
 * them, whether the request carried the markers and what was replied, and nothing more. Headers (an API key), system prompts and message bodies, which hold the prompt and the
 * user's own memory, never reach it. `toolResults()` is the text of every tool_result the agent sent back,
 * once per tool_use id: the environment as the agent's tools saw it. */
export async function startFakeApi({ nonce, workspace, markers = [], track = [], host = '127.0.0.1' }) {
  const requests = [];
  const results = new Map();
  let counter = 0;
  let tracked = track;

  const toolUse = (name, input) => ({ type: 'tool_use', id: `toolu_probe_${++counter}`, name, input });
  const needles = engramNeedles(nonce);
  const answer = ({ model, tools, messages }) => {
    const used = new Set(messages.filter((m) => m?.role === 'assistant' && Array.isArray(m.content)).flatMap((m) => m.content).filter((b) => b?.type === 'tool_use').map((b) => b.name));
    let content = [{ type: 'text', text: `The probe is done. ${nonce}` }];
    let reply = 'text';
    const memSave = tools.find((name) => MEM_SAVE_TOOL.test(name));
    const subagentTool = tools.find((name) => SUBAGENT_TOOLS.includes(name));
    const firstUser = allText(messages.find((m) => m?.role === 'user')?.content).join('\n');
    if (firstUser.includes(SUBAGENT_MARKER)) {
      // The text a passive capture reads: a learnings section, with the marker in it.
      content = [{ type: 'text', text: `Isolation probe subagent finished.\n\n## Key Learnings:\n\n1. ${needles.subagent}` }];
      reply = 'subagent';
    } else if (tools.length > 0 && !/haiku/i.test(model ?? '')) {
      const next = (name, input) => {
        content = [toolUse(name, input)];
        reply = `tool_use:${name}`;
      };
      if (tools.includes('Bash') && !used.has('Bash')) {
        next('Bash', { command: probeCommand(nonce), description: 'Record the environment for the isolation probe' });
      } else if (tools.includes('Write') && !used.has('Write')) {
        next('Write', { file_path: path.join(workspace, 'probe-write.txt'), content: nonce });
      } else if (memSave && !used.has(memSave)) {
        next(memSave, { title: 'Isolation probe', content: needles.memory, type: 'discovery' });
      } else if (subagentTool && !used.has(subagentTool)) {
        next(subagentTool, { description: 'Isolation probe subagent', prompt: `${SUBAGENT_MARKER}: reply with one short line.`, subagent_type: 'general-purpose' });
      }
    }
    const message = {
      id: `msg_probe_${++counter}`, type: 'message', role: 'assistant', model: model ?? PROBE_MODEL, content,
      stop_reason: reply.startsWith('tool_use') ? 'tool_use' : 'end_turn', stop_sequence: null, usage: { input_tokens: 12, output_tokens: 7 },
    };
    return { message, reply };
  };

  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const handle = async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const pathname = new URL(req.url, 'http://localhost').pathname.replace(/(?<=.)\/+$/, '');
    const entry = { method: req.method, path: pathname, model: null, stream: false, toolsOffered: false, engramToolOffered: false, globalClaudeMd: false, reply: '404' };
    requests.push(entry);

    // The connectivity preflight Claude Code makes before its first request (the predecessor's probe saw
    // `HEAD /api/hello`): a server that answers it with an error may be taken for "offline".
    if ((req.method === 'HEAD' || req.method === 'GET') && pathname === '/api/hello') {
      entry.reply = 'preflight';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(req.method === 'HEAD' ? undefined : '{}');
      return;
    }
    if (req.method !== 'POST' || (pathname !== '/v1/messages' && pathname !== '/v1/messages/count_tokens')) {
      json(res, 404, { type: 'error', error: { type: 'not_found_error', message: `the isolation probe's fake API has no ${req.method} ${pathname}` } });
      return;
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      entry.reply = '400';
      json(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'the body is not JSON' } });
      return;
    }
    if (!isObject(body)) body = {};
    entry.model = typeof body.model === 'string' ? body.model : null;
    entry.stream = body.stream === true;
    const tools = (Array.isArray(body.tools) ? body.tools : []).map((tool) => tool?.name).filter((name) => typeof name === 'string');
    entry.toolsOffered = tools.length > 0;
    entry.engramToolOffered = tools.some((name) => MEM_SAVE_TOOL.test(name));
    entry.globalClaudeMd = pathname === '/v1/messages' && carriesMarkers(body, markers);
    if (pathname === '/v1/messages' && tracked.length > 0) entry.components = Object.fromEntries(tracked.map((component) => [component.id, carriesComponent(body, tools, component)]));
    const messages = Array.isArray(body.messages) ? body.messages : [];

    for (const message of messages) {
      if (message?.role !== 'user' || !Array.isArray(message.content)) continue;
      for (const block of message.content) {
        if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string' && !results.has(block.tool_use_id)) {
          results.set(block.tool_use_id, textOfResult(block.content).slice(0, 8192));
        }
      }
    }

    if (pathname === '/v1/messages/count_tokens') {
      entry.reply = 'count_tokens';
      json(res, 200, { input_tokens: 1 });
      return;
    }
    const { message, reply } = answer({ model: entry.model, tools, messages });
    entry.reply = reply;
    if (entry.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      res.end(sse(messageEvents(message)));
    } else {
      json(res, 200, message);
    }
  };

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, resolve);
  });
  const { port } = server.address();
  return {
    url: `http://${host}:${port}`,
    port,
    requests,
    toolResults: () => [...results].map(([toolUseId, text]) => ({ toolUseId, text })),
    track: (list) => {
      tracked = list;
    },
    close: () => new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}

// ---- the trees that must not change -------------------------------------------------------------------------

/** The real places a Claude Code run, or a tool it starts, may write (the writers table in `odd/tasks/
 * evals.md`): relative to the real home unless noted, with `AppData/Local` and `%TEMP%` taken from the real
 * environment. All are content-hashed, except three: the credentials file inside `.claude`, which is only
 * stat-ed because the probe has no business reading a login (nothing it could learn there is worth the
 * risk of printing it); `.local/share/claude`, which holds the binaries (around 700 MB), where size and
 * mtime say whether anything was installed or updated; and `.config`, where the hooks' own tools (herdr, gh)
 * keep state of other products, which is not the probe's to read but whose changes it should see. The last
 * two are name-only listings, for the home and `AppData/Local`: the question there is only whether a new
 * top-level folder appeared, which is how a writer nobody listed would show up. */
export function defaultTrees({ realHome, localAppData, tempDir }) {
  const home = (...parts) => path.join(realHome, ...parts);
  return [
    { name: '.claude', root: home('.claude'), mode: 'content', statOnly: ['.credentials.json'] },
    { name: '.claude.json', root: home('.claude.json'), mode: 'content', jsonKeys: true },
    { name: '.engram', root: home('.engram'), mode: 'content' },
    { name: '.gentle-ai', root: home('.gentle-ai'), mode: 'content' },
    { name: '.codegraph', root: home('.codegraph'), mode: 'content' },
    { name: '.orca', root: home('.orca'), mode: 'content' },
    { name: '.js-harness', root: home('.js-harness'), mode: 'content' },
    { name: 'AppData/Local/claude-cli-nodejs', root: path.join(localAppData, 'claude-cli-nodejs'), mode: 'content' },
    { name: '%TEMP%/claude', root: path.join(tempDir, 'claude'), mode: 'content' },
    { name: '.local/state/claude', root: home('.local', 'state', 'claude'), mode: 'content' },
    { name: '.local/share/claude', root: home('.local', 'share', 'claude'), mode: 'stat' },
    { name: '.config', root: home('.config'), mode: 'stat' },
    { name: '~ (top level)', root: realHome, mode: 'names' },
    { name: 'AppData/Local (top level)', root: localAppData, mode: 'names' },
  ];
}

// ---- the report -----------------------------------------------------------------------------------------

export const cap = (list, limit = 200) => ({ count: list.length, paths: list.slice(0, limit) });

/** A diff as the report holds it: only the trees that changed, only the categories that have entries, each
 * list capped (a tree that appears can have thousands of files) with its full count. The key names of a
 * JSON file that changed (`keys`) are listed the same way: names, never values. */
export function reportDiff(diff) {
  const out = {};
  for (const [name, tree] of Object.entries(diff)) {
    if (!treeChanged(tree)) continue;
    out[name] = {};
    if (tree.appeared) out[name].appeared = true;
    if (tree.vanished) out[name].vanished = true;
    for (const category of ['added', 'removed', 'changed']) if (tree[category].length > 0) out[name][category] = cap(tree[category]);
    if (tree.keys) {
      out[name].keys = {};
      for (const [rel, entry] of Object.entries(tree.keys)) {
        out[name].keys[rel] = entry.unparsed ? { unparsed: true } : Object.fromEntries(['added', 'removed', 'changed'].filter((category) => entry[category].length > 0).map((category) => [category, cap(entry[category])]));
      }
    }
  }
  return out;
}

export const errorMessage = (err) => (err instanceof Error ? err.message : String(err));

/** Whether the real global `CLAUDE.md` reached the model, from the fake API's log (booleans only). The two
 * arms must differ: the minimal arm is "the model and the built-in tools, nothing else", so it must carry
 * none of it on any request, and the current arm's seeded copy is the point of that arm, so its main-model
 * request (the one that offers tools, not a small-model side call) must carry it. A workspace with the real
 * home above it breaks the first: Claude Code loads `CLAUDE.md` from every ancestor directory. A subagent's
 * requests (reply `subagent`) are in the count, so the absent arm cannot hide a contaminated subagent behind
 * clean main requests, but they never stand in for the main model's: the current arm's `mainRequestHit` is
 * read from the main agent's requests alone. */
function checkContamination(arm, log, markers) {
  if (markers === 0) return { skipped: 'the real ~/.claude/CLAUDE.md is missing or has no line long enough to recognize it by' };
  const messages = log.filter((request) => request.method === 'POST' && request.path === '/v1/messages' && (request.reply === 'text' || request.reply === 'subagent' || request.reply.startsWith('tool_use')));
  if (messages.length === 0) return { skipped: 'the agent sent no /v1/messages request' };
  const withGlobalClaudeMd = messages.filter((request) => request.globalClaudeMd).length;
  const mainRequestHit = messages.some((request) => request.reply !== 'subagent' && request.toolsOffered && !/haiku/i.test(request.model ?? '') && request.globalClaudeMd);
  const expected = arm === 'current' ? 'present' : 'absent';
  return { expected, markers, requests: messages.length, withGlobalClaudeMd, mainRequestHit, ok: expected === 'present' ? mainRequestHit : withGlobalClaudeMd === 0 };
}

/** The components that are a part of the global `CLAUDE.md`: an arm without one of them changes what the
 * contamination check's markers are read from, so that check says nothing of it and the component check does. */
const CLAUDE_MD_PARTS = /^(?:claude-md|claude-md-own|gentle-ai-.+)$/;

/** Whether each component in `track` (`{ id, tools, needles }`) reached the model, from the fake API's log (booleans
 * only), for an arm that is expected to carry it (`present`, its base) or not (`absent`, the arm that takes it out). The
 * requests counted are the contamination check's; `present` is read from the main agent's requests alone, as there.
 * A component a request carries nothing of (no tool, no needle) is `unseen`, with `ok` null: the probe cannot tell. */
function checkComponents(expected, log, track) {
  const messages = log.filter((request) => request.method === 'POST' && request.path === '/v1/messages' && (request.reply === 'text' || request.reply === 'subagent' || request.reply.startsWith('tool_use')));
  return track.map(({ id, tools, markers, prefixes }) => {
    if (tools.length === 0 && markers.length === 0 && prefixes.length === 0) return { id, expected, ok: null, unseen: true };
    if (messages.length === 0) return { id, expected, ok: null, skipped: 'the agent sent no /v1/messages request' };
    const carried = messages.filter((request) => request.components?.[id] === true).length;
    const mainRequestHit = messages.some((request) => request.reply !== 'subagent' && request.toolsOffered && !/haiku/i.test(request.model ?? '') && request.components?.[id] === true);
    return { id, expected, requests: messages.length, carried, mainRequestHit, ok: expected === 'present' ? mainRequestHit : carried === 0 };
  });
}

const probePrompt = (nonce) =>`Isolation probe, nonce:${nonce}\nFollow the tool calls you are given, and do nothing else.\n`;

/** One trial of one arm, built the way the eval builds it (`minimalConfig` / `currentConfig` with the
 * template seed), against a fresh fake API. Returns the arm's report and the real trees' snapshot taken
 * right after the agent exited, which is the next arm's "before". `p` is the shared probe context. */
async function runArm(p, arm, before) {
  const { o, nonce } = p;
  // An arm of one component is the current arm with its components taken out after the seed, as the eval runs it. The
  // current arm tracks the components of every arm beside it (it must carry them), such an arm its own (it must not).
  const { kind, components } = o.plans.find((plan) => plan.name === arm);
  // A base tracks the components of the arms built on it; a minimal-with arm puts its server in, so it must carry it and
  // minimal must not. A server is told by its tool prefix alone, which needs no template.
  const tracked = components.length > 0 ? components : [...new Set(o.plans.filter((plan) => plan.kind === kind).flatMap((plan) => plan.components))];
  const expected = (kind === 'current') === (components.length > 0) ? 'absent' : 'present';
  let track = kind === 'minimal' ? tracked.map((id) => ({ id, ...needlesOf({ tools: [`mcp__${id.slice('mcp-'.length)}__`], lines: [], descriptions: [] }) })) : [];
  const root = fs.mkdtempSync(path.join(o.workRoot, SANDBOX_PREFIX));
  const token = path.basename(root);
  p.tokens.push(token);
  const home = path.join(root, 'home');
  const workspace = path.join(root, 'workspace');
  const result = { arm, sandboxToken: token, failures: [], engram: { port: null, listening: null, survivors: [] } };
  const cleanupFailures = [];
  let templateParent = null;
  let api = null;
  let after = before;
  let config = null;
  let prepared;
  let baseline = null;
  // The processes the agent left behind: a seeded home starts MCP servers (codegraph, with the workspace in
  // its command line) and hooks that can outlive their parent, hold the sandbox and fail its removal with
  // EPERM, and write to the real trees on their own schedule. They are found by the path in their command
  // line, not by parentage, and only what is under the work root is touched. A failed sweep is a failure of
  // the arm, but the removals still run.
  const sweepSandbox = () => {
    try {
      (o.sweep ?? killByPath)([root, ...(templateParent ? [templateParent] : [])], { within: o.workRoot });
    } catch (err) {
      cleanupFailures.push(`could not sweep the processes of the sandbox: ${errorMessage(err)}`);
    }
  };
  // The engram processes now, and again after the trial: a process the trial started and that is still running
  // is the one in the second list and not the first (the live session's own engram is in both).
  const listEngram = async () => {
    try {
      return { list: await (o.listEngram ?? (() => findProcesses('engram')))() };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  };
  // After the agent, whatever it did: the config's own cleanup (it kills what listens on the trial's engram port,
  // which the sweep by path cannot reach), then three facts the arm is judged by: nothing listens on that port,
  // no engram process the trial started is running, and the cleanup itself did not fail.
  let engramStopped = false;
  const stopEngram = async () => {
    if (engramStopped || !prepared?.engramPort) return;
    engramStopped = true;
    try {
      await config.cleanup?.({ home, workspace, prepared });
    } catch (err) {
      cleanupFailures.push(`could not stop what listens on the trial's engram port: ${errorMessage(err)}`);
    }
    result.engram.listening = await (o.isListening ?? portIsListening)(prepared.engramPort);
    const listed = await listEngram();
    if (listed.error) result.engram.listingError ??= listed.error;
    else if (baseline) result.engram.survivors = listed.list.filter((entry) => !baseline.has(entry.pid)).map((entry) => ({ pid: entry.pid, command: String(entry.command).slice(0, 200) }));
  };
  let swept = false;
  try {
    fs.mkdirSync(home);
    fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'the isolation probe workspace\n');
    api = await startFakeApi({ nonce, workspace, markers: p.markers, track });
    let run = null;
    let seeded = null;
    try {
      let seed;
      if (kind === 'current' || components.length > 0) {
        // Built per arm inside its own try, so the template (a copy of the account data in the real
        // config) is removed on every path below, whatever fails.
        templateParent = fs.mkdtempSync(path.join(o.workRoot, TEMPLATE_PREFIX));
        const templateDir = path.join(templateParent, 'template');
        p.log(`${arm}: building the home template from the real configuration (read only)`);
        const built = buildTemplate({ realHome: o.realHome, templateDir });
        result.template = { files: built.files, bytes: built.bytes, warnings: built.warnings };
        // What a request would carry of each tracked component, read from the template before any cut: the arm's own
        // home no longer holds it, which is the point.
        if (kind === 'current') track = tracked.map((id) => ({ id, ...needlesOf(withoutEvidence(path.join(templateDir, PAYLOAD), id, 'claude')) }));
        api.track(track);
        seed = kind === 'minimal' ? seedMinimalWith(templateDir, components) : seedFromTemplate(templateDir, { runInit: o.runInit, without: components });
      }
      // `allocatePort` and `killPort` are the config builders' own seams, for tests that must not touch real ports.
      const options = { command: o.claude, model: PROBE_MODEL, permissionMode: PROBE_PERMISSION_MODE, allocatePort: o.allocatePort, killPort: o.killPort };
      config = kind === 'minimal' && components.length > 0 ? minimalWithConfig({ ...options, name: arm, seed }) : kind === 'current' ? currentConfig({ ...options, seed }) : minimalConfig(options);
      config = o.adaptConfig(config, { arm });
      const configEnv = config.env;
      // The agent talks to the fake API with a dummy key and no login: the only credential is not one.
      config = { ...config, env: (context) => ({ ...(typeof configEnv === 'function' ? configEnv(context) : configEnv), ANTHROPIC_BASE_URL: api.url, ANTHROPIC_API_KEY: DUMMY_API_KEY, CLAUDE_CODE_OAUTH_TOKEN: null }) };
      prepared = await config.prepare({ home, workspace, effort: PROBE_EFFORT, task: undefined });
      result.engram.port = prepared?.engramPort ?? null;
      const listedBefore = await listEngram();
      if (listedBefore.error) result.engram.listingError = listedBefore.error;
      else baseline = new Set(listedBefore.list.map((entry) => entry.pid));
      seeded = await snapshotTrees([{ name: 'home', root: home, mode: 'content' }], { concurrency: o.concurrency, chunkSize: o.chunkSize });
      const agent = resolveAgent(config, { effort: PROBE_EFFORT, task: undefined, home, workspace, prepared });
      p.log(`${arm}: running the agent`);
      const began = performance.now();
      run = await (o.runProcess ?? runProcess)({ ...agent, env: childEnv(agent.env), cwd: workspace, input: probePrompt(nonce), timeoutMs: o.timeoutMs });
      result.wallMs = Math.round(performance.now() - began);
    } catch (err) {
      result.error = errorMessage(err);
    }

    // The sweep comes BEFORE the snapshot that is scanned and diffed, whatever happened above: a process the
    // agent left behind can write to a real tree after the agent exits, and a snapshot taken first would
    // miss what it wrote between the snapshot and its death. After the sweep nothing of the arm is running.
    swept = true;
    sweepSandbox();
    await stopEngram();
    // The session id is only known now, and the scan below looks for it in the real trees (what the hooks post names
    // it and neither the nonce nor the sandbox). It is never logged or printed before that scan: output that is
    // redirected into a scanned tree would hold the very needle.
    const parsed = run ? parseAgentOutput(run.stdout) : null;
    const session = await findSession(parsed, home, nonce);
    result.session = { source: session.source };
    if (session.id) p.sessionIds.push(session.id);
    // The real trees are checked even when the arm failed: a trial that died half way may already have leaked.
    p.log(`${arm}: checking the real trees`);
    after = await p.snapshot(`after:${arm}`, p.needles());

    if (run) {
      Object.assign(result, {
        exitCode: run.exitCode, signal: run.signal, timedOut: run.timedOut,
        ...(run.spawnError && { spawnError: run.spawnError.message }),
        agent: parsed ? { isError: parsed.is_error === true, subtype: parsed.subtype ?? null, numTurns: Number.isFinite(parsed.num_turns) ? parsed.num_turns : null } : null,
        stderrTail: run.stderr.slice(-2000),
      });
    }
    const log = api.requests.map((request) => ({ ...request }));
    const tally = {};
    for (const request of log) tally[request.reply] = (tally[request.reply] ?? 0) + 1;
    result.fakeApi = { requestCount: log.length, requests: log.slice(0, 100), tally, unexpected: tally['404'] ?? 0, toolResults: api.toolResults().slice(0, 20), ...inspectEnv(api.toolResults(), token) };
    result.warnings = Object.entries(result.fakeApi.envChecks).filter(([, check]) => check === 'outside').map(([name]) => `the agent's tools see ${name} outside the sandbox`);
    if (result.fakeApi.envLines?.OAUTH_TOKEN_SET === 'yes') result.warnings.push("the agent's tools still see CLAUDE_CODE_OAUTH_TOKEN");
    result.contamination = components.some((id) => CLAUDE_MD_PARTS.test(id))
      ? { skipped: 'the arm takes part of the global CLAUDE.md out, or all of it, so its markers say nothing of the arm: the component check does' }
      : checkContamination(kind, log, p.markers.length);
    if (result.contamination.skipped && p.markers.length === 0) result.warnings.push(`the contamination check was skipped: ${result.contamination.skipped}`);
    if (track.length > 0) {
      result.components = checkComponents(expected, log, track);
      for (const check of result.components.filter((entry) => entry.unseen)) result.warnings.push(`${check.id}: a request carries nothing of it, so the probe cannot see it`);
    }

    if (!result.error) {
      const engram = kind === 'current' && !components.some((id) => ENGRAM_PARTS.test(id));
      const storeHits = engram ? await findInStore(path.join(home, '.engram'), { ...engramNeedles(nonce), ...(session.id && { session: session.id }) }) : {};
      result.positiveControls = await positiveControls({ engram, home, workspace, nonce, log, storeHits, session: session.id, port: prepared?.engramPort ?? null });
      const grown = await snapshotTrees([{ name: 'home', root: home, mode: 'content' }], { concurrency: o.concurrency, chunkSize: o.chunkSize });
      const changes = diffSnapshots(seeded, grown).home;
      const under = (prefix, list) => list.filter((rel) => rel.startsWith(prefix)).length;
      result.sandbox = {
        kept: o.keepSandbox ? root : null,
        top: summarizeTop(home),
        created: cap(changes.added),
        changed: cap(changes.changed),
        removed: cap(changes.removed),
        answers: {
          historyJsonl: exists(path.join(home, '.claude', 'history.jsonl')),
          // Informational: whether the SubagentStop hook's capture was kept depends on what the server extracts, and
          // the prompt is never posted by the UserPromptSubmit hook's fast path under Git Bash on Windows.
          engramPrompt: engram ? storeHits.prompt != null : null,
          engramSubagentStop: engram ? storeHits.subagent != null : null,
          claudeCliNodejs: exists(path.join(home, 'AppData', 'Local', 'claude-cli-nodejs')),
          pluginsMarketplaces: {
            present: exists(path.join(home, '.claude', 'plugins', 'marketplaces')),
            created: under('.claude/plugins/marketplaces/', changes.added),
            changed: under('.claude/plugins/marketplaces/', changes.changed),
            removed: under('.claude/plugins/marketplaces/', changes.removed),
          },
        },
      };
    }
    return { result, after };
  } finally {
    await api?.close();
    // Swept already, unless something threw before the sweep above was reached.
    if (!swept) sweepSandbox();
    await stopEngram();
    const note = (message) => cleanupFailures.push(message);
    // Removed in a finally and before anything else can throw: the template holds copies of the real
    // configuration's account data, and the sandbox home a copy of that.
    if (templateParent) {
      try {
        removeTemplate(path.join(templateParent, 'template'));
      } catch (err) {
        cleanupFailures.push(`could not remove the template: ${errorMessage(err)}`);
      }
      removeDir(templateParent, 'template directory', note, sweepSandbox);
    }
    if (!o.keepSandbox) removeDir(root, 'sandbox', note, sweepSandbox);
    result.failures.push(...cleanupFailures);
  }
}

/** The failures of one arm: everything that makes its verdict "not proven isolated", as sentences. */
function armFailures(result) {
  const failures = [...result.failures];
  const label = result.arm;
  if (result.error) failures.push(`${label}: the trial could not run: ${result.error}`);
  if (result.spawnError) failures.push(`${label}: the agent could not be started: ${result.spawnError}`);
  if (result.timedOut) failures.push(`${label}: the agent was killed at the timeout`);
  for (const [name, control] of Object.entries(result.positiveControls ?? {})) {
    if (!control.ok) failures.push(`${label}: positive control "${name}" failed: the sandbox did not hold what a real run writes there, so a clean leak scan proves nothing${control.hint ? ` (${control.hint})` : ''}`);
  }
  // The engram plugin's hooks resolve their server from the environment of the trial, and fall back to the real
  // server's port: the tools must see the trial's port, and no URL or socket that would point elsewhere.
  const { engram } = result;
  const seen = result.fakeApi?.engramEnv;
  if (seen && engram?.port) {
    if (seen.port !== String(engram.port)) failures.push(`${label}: the agent's tools see ENGRAM_PORT=${seen.port === '' ? '(unset)' : seen.port}, not the trial's port ${engram.port}: the engram hooks would reach another server`);
    if (seen.urlSet) failures.push(`${label}: the agent's tools see ENGRAM_URL set (value not shown): the engram hooks would reach that server`);
    if (seen.socketSet) failures.push(`${label}: the agent's tools see ENGRAM_SOCKET set (value not shown): the engram hooks would reach that server`);
  }
  if (engram?.port && engram.listening === true) failures.push(`${label}: something still listens on the trial's engram port ${engram.port} after the trial: an engram server it started was not stopped`);
  for (const entry of engram?.survivors ?? []) failures.push(`${label}: an engram process that was not running before the trial is still running after it: pid ${entry.pid} (${entry.command})`);
  if (engram?.listingError) failures.push(`${label}: inconclusive: the engram processes could not be listed (${engram.listingError}), so "no engram process of the trial is left" is unproven`);
  const { contamination } = result;
  if (contamination && contamination.ok === false) {
    failures.push(contamination.expected === 'absent'
      ? `${label}: minimal arm loaded the real global CLAUDE.md: ${contamination.withGlobalClaudeMd} of ${contamination.requests} requests carried it, so the arm meant to load nothing is not measuring that (is the work root under the real home?)`
      : `${label}: current arm never carried the global CLAUDE.md on its main-model request: the seeded copy was not loaded, so the arm does not measure the setup it is named after`);
  }
  for (const check of (result.components ?? []).filter((entry) => entry.ok === false)) {
    failures.push(check.expected === 'absent'
      ? `${label}: ${check.id} is still carried on ${check.carried} of ${check.requests} requests, so the arm does not measure the setup without it`
      : `${label}: ${check.id} is not carried on the main-model request, so an arm that takes it out takes out nothing this arm had`);
  }
  // A real file that could not be read, after the retries, was not scanned: the verdict on it is unknown, and
  // an unknown is not a pass.
  const unreadable = result.leak?.unreadable;
  for (const entry of (unreadable?.paths ?? []).slice(0, 10)) failures.push(`${label}: inconclusive: could not read ${entry}, so it was not scanned for the nonce, the sandbox name or the session id`);
  if ((unreadable?.count ?? 0) > 10) failures.push(`${label}: inconclusive: ${unreadable.count - 10} more real files could not be read (see the JSON report)`);
  for (const hit of result.leak?.hits ?? []) {
    failures.push(hit.via === 'key'
      ? `${label}: LEAK: the real ${hit.tree} has a new or changed key ${hit.path} (it names the ${hit.found.join(' and the ')})`
      : `${label}: LEAK: the real ${hit.tree} has ${hit.path} (${hit.via} holds the ${hit.found.join(' and ')})`);
  }
  return failures;
}

/** What the probe runs of each arm in `arms`, as `{ name, kind, components }`: `current` and `minimal` as they are, and an
 * arm of one component (`parseArm`, `evals/arms.mjs`) as the current arm without its components, which needs its base
 * beside it, since that the base carries a component is what makes the arm's not carrying it mean anything. A
 * `minimal-with` arm is refused: the probe has not been taught to put a component into minimal. Throws before anything
 * is made. */
function armPlans(arms) {
  return arms.map((name) => {
    if (name === 'current' || name === 'minimal') return { name, kind: name, components: [] };
    const parsed = parseArm(name, 'claude');
    if (parsed === null) throw new ArmError(`unknown arm ${JSON.stringify(name)}: use "current", "minimal" or an arm of one component, current-without-<id>`);
    if (!arms.includes(parsed.base)) throw new ArmError(`${name} needs its base, ${parsed.base}, in the same probe: the base must ${parsed.base === 'current' ? 'carry what the arm takes out' : 'lack what the arm puts in'}`);
    return { name, kind: parsed.base, components: parsed.components };
  });
}

/** Runs the isolation probe and resolves to its report (see the file's header for the method).
 *
 * Options (all but `claude` optional): `claude` is the absolute path of the binary; `arms` is `['current',
 * 'minimal']` by default; `controlMs` the length of the no-agent baseline window (0 skips it); `timeoutMs`
 * the agent's bound (default 300 s); `keepSandbox` skips the removal of the sandbox. For tests and unusual
 * machines: `workRoot` (where homes, workspaces and the template go; default `defaultWorkRoot` of this
 * repository, and `checkWorkRoot(root, { realHome })`, default `assertWorkRoot`, runs before anything is
 * created), `realHome`, `localAppData` and `tempDir` (default: the real ones; the real temp folder is only
 * where the `claude` scratch folder to watch is), `trees` (default `defaultTrees`), `nonce`, `runInit` (passed to the seed), `adaptConfig(config, { arm })` (changes the
 * command and arguments, never the sandbox), `sweep(roots, { within })` (default `killByPath`: kills what the
 * agent left running under the sandbox, before the final scan of the real trees and again before the
 * removal if that sweep was not reached), `runProcess(options)` (default the real one: the run of the arm's agent,
 * a caller hands in another only to record what it leaves behind), `allocatePort()` and `killPort(port)` (the
 * config builders' seams for the
 * trial's engram port: a real free port, and the kill of what listens on it), `isListening(port)` (a connection to
 * the loopback) and `listEngram()` (the engram processes now running, default `findProcesses('engram')`), `wait(ms)`,
 * `log(message)`, `concurrency`, `chunkSize`, `openRead(file,
 * { chunkSize })` (how a real file is read) and `retryDelayMs` (the pause between the tries of a file that fails
 * to read; a file still unreadable after them makes its arm fail as inconclusive).
 *
 * The report is scrubbed of the nonce, the dummy key and any login token before it is returned, so no
 * caller can print one by accident. `ok` is true only when every arm's positive controls hold and the
 * scan found neither the nonce nor the sandbox's name anywhere in the real trees, and no project entry of
 * the real account file (`~/.claude.json`) was added or changed for a folder of the trial; other
 * differences between the before and after snapshots are always reported but never fail the run, because
 * live writers (the developer's own Claude session, the engram and codegraph daemons) change those trees
 * all the time. The account file's changes are reported by key name (`projects["<path>"]`, a top-level
 * key), never by value. */
export async function runIsolationProbe(options) {
  const realHome = options.realHome ?? os.homedir();
  const o = {
    arms: ['current', 'minimal'],
    controlMs: 0,
    timeoutMs: 300_000,
    keepSandbox: false,
    localAppData: process.env.LOCALAPPDATA ?? path.join(realHome, 'AppData', 'Local'),
    tempDir: os.tmpdir(),
    runInit: undefined,
    adaptConfig: (config) => config,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (message) => process.stderr.write(`${message}\n`),
    concurrency: DEFAULT_CONCURRENCY,
    chunkSize: DEFAULT_CHUNK,
    ...options,
    realHome,
  };
  if (typeof o.claude !== 'string' || !path.isAbsolute(o.claude)) throw new Error(`"claude" must be the absolute path of the claude binary, got ${JSON.stringify(o.claude)}`);
  o.plans = armPlans(o.arms);
  // Checked before anything is created: a work root inside the real home, or under project memory, would
  // contaminate every trial (see `assertWorkRoot`), and a probe that ran there would prove nothing.
  const workRoot = o.workRoot ?? defaultWorkRoot({ repoRoot: REPO_ROOT });
  (o.checkWorkRoot ?? assertWorkRoot)(workRoot, { realHome });
  const workRootCreated = !exists(workRoot);
  fs.mkdirSync(workRoot, { recursive: true });
  try {
    return await probeUnder({ ...o, workRoot }, workRootCreated);
  } finally {
    // Only a root this run made, and only when it is empty: never one that was there, never a sandbox kept
    // for inspection, never a parent.
    if (workRootCreated) {
      try {
        fs.rmdirSync(workRoot);
      } catch {
        // not empty (--keep-sandbox) or already gone
      }
    }
  }
}

/** The probe proper, with the work root checked and made. `o` is the resolved options. */
async function probeUnder(o, workRootCreated) {
  const nonce = o.nonce ?? makeNonce();
  // The lines of the real global CLAUDE.md, to recognize it in what the model is sent. Read here, once; they
  // go to the fake API as needles and nowhere else.
  let markers = [];
  try {
    markers = claudeMdMarkers(fs.readFileSync(path.join(o.realHome, '.claude', 'CLAUDE.md'), 'utf8'));
  } catch {
    // no global CLAUDE.md: the contamination check is skipped, with a warning per arm
  }
  const trees = o.trees ?? defaultTrees(o);
  const startedAt = new Date().toISOString();
  const began = performance.now();
  const hashing = [];
  const tokens = [];
  const snapshot = async (label, needles = []) => {
    const taken = await snapshotTrees(trees, { needles, concurrency: o.concurrency, chunkSize: o.chunkSize, openRead: o.openRead, retryDelayMs: o.retryDelayMs });
    const all = Object.values(taken.trees);
    hashing.push({
      label, ms: taken.ms, files: all.reduce((total, tree) => total + tree.files.size, 0), bytes: all.reduce((total, tree) => total + tree.bytes, 0),
      unreadable: all.reduce((total, tree) => total + tree.unreadable.length, 0),
    });
    return taken;
  };
  const sessionIds = [];
  const p = {
    o, nonce, markers, tokens, sessionIds, snapshot, log: o.log,
    // The nonce, the unique name of every sandbox so far (also lowercased, which is how a Windows tool may spell a
    // path) and the Claude session id of every trial so far, searched for in the real trees' content and names. The
    // session id is what every hook post names: the session row of SessionStart holds the sandbox only as the cwd
    // (and, on Windows, lowercased), and the rows that point at the session (a memory, a prompt) hold neither the
    // sandbox nor the nonce, so a post that reached the real server is reliably found by it alone. It is known
    // after the agent ran, so a scan before that has none.
    needles: () => [
      { label: 'nonce', values: [nonce] },
      { label: 'sandbox', values: [...new Set(tokens.flatMap((token) => [token, token.toLowerCase()]))] },
      ...(sessionIds.length > 0 ? [{ label: 'session id', values: [...new Set(sessionIds.flatMap((id) => [id, id.toLowerCase(), id.toUpperCase()]))] }] : []),
    ],
  };

  const report = {
    tool: 'isolation-probe', startedAt, node: process.version, platform: process.platform, claude: o.claude, workRoot: o.workRoot, workRootCreated,
    config: { model: PROBE_MODEL, effort: PROBE_EFFORT, permissionMode: PROBE_PERMISSION_MODE },
    trees: trees.map(({ name, mode }) => ({ name, mode })), control: null, arms: [], hashing,
  };

  o.log('hashing the real trees (before)');
  let before = await snapshot('before');
  if (o.controlMs > 0) {
    o.log(`control window: waiting ${o.controlMs} ms with no agent running`);
    await o.wait(o.controlMs);
    const controlEnd = await snapshot('control');
    report.control = { ms: o.controlMs, diff: reportDiff(diffSnapshots(before, controlEnd)) };
    p.controlDiff = diffSnapshots(before, controlEnd);
    before = controlEnd;
  }
  for (const arm of o.arms) {
    const { result, after } = await runArm(p, arm, before);
    const diff = diffSnapshots(before, after);
    const unreadable = Object.entries(after.trees).flatMap(([tree, { unreadable: list }]) => list.map((entry) => ({ tree, ...entry })));
    const split = p.controlDiff ? splitByControl(diff, p.controlDiff) : null;
    // A project key naming this arm's sandbox or the work root, in the real account file: Claude Code recorded
    // a folder of the trial there. Only what is new since the control window can be the trial's.
    const keyHits = keyLeaks(split?.fresh ?? diff, { tokens: [result.sandboxToken], workRoot: o.workRoot });
    result.leak = { hits: [...leakHits(after, before), ...keyHits], unreadable: cap(unreadable.map((entry) => `${entry.tree}/${entry.path} (${entry.code})`), 50), diff: reportDiff(diff) };
    if (split) {
      result.leak.fresh = reportDiff(split.fresh);
      result.leak.baseline = reportDiff(split.baseline);
    }
    // What was scanned of the real engram store, so that a store that is not there (nothing scanned) is not
    // read as a store that is clean. The hits are in `leak.hits` and fail the arm like every other real tree.
    const realStore = after.trees['.engram'];
    result.realEngram = { status: realStore?.status ?? 'unwatched', files: realStore?.files.size ?? 0, bytes: realStore?.bytes ?? 0, hits: result.leak.hits.filter((hit) => hit.tree === '.engram').length };
    result.failures = armFailures(result);
    result.ok = result.failures.length === 0;
    report.arms.push(result);
    before = after;
  }

  report.failures = report.arms.flatMap((arm) => arm.failures);
  report.ok = report.arms.every((arm) => arm.ok);
  report.wallMs = Math.round(performance.now() - began);
  return JSON.parse(makeScrubber(nonce)(JSON.stringify(report)));
}

/** A function that replaces every secret in a text: the nonce, the dummy key and the real login token (the
 * agent has none, but the probe's own environment may, and a message that quotes an environment must not
 * carry it). */
export function makeScrubber(nonce) {
  const secrets = [[nonce, '<nonce>'], [DUMMY_API_KEY, '<dummy-api-key>'], [process.env.CLAUDE_CODE_OAUTH_TOKEN, '<login-token>']].filter(([value]) => typeof value === 'string' && value.length >= 8);
  return (text) => secrets.reduce((scrubbed, [value, label]) => scrubbed.split(value).join(label), text);
}

// ---- the summary and the command line -----------------------------------------------------------------------

const USAGE = `usage: node evals/isolation-probe.mjs --claude <absolute path> [--arm current|minimal|both|current-without-<id>|minimal-with-mcp-<name>] [--control-ms <n>] [--report <path>] [--keep-sandbox] [--timeout-ms <n>] [--work-root <abs>]

--arm current-without-<id> (an arm of one component, evals/arms.mjs) runs that arm beside its base, current,
and checks that the base carries the component on its main-model request and the arm on none.
--arm minimal-with-mcp-<name> runs that arm beside its base, minimal, and checks the reverse: the arm offers
the server's tools on its main-model request and the base offers none.

--work-root is where sandbox homes, workspaces and the template are built (default: js-harness-evals-work
next to this repository). It must be outside the real home and have no CLAUDE.md, CLAUDE.local.md, AGENTS.md
or .claude in it or above it, which the probe checks before creating anything.

Runs one agent trial under the eval sandbox against a loopback fake Anthropic API (no spend), then checks the
machine's real Claude Code state was untouched. Exit 0: every positive control held and nothing of the run
was found in the real trees. Exit 1: it did not. Exit 2: bad usage.`;

const DEFAULT_REPORT = fileURLToPath(new URL('./runs/isolation-probe.json', import.meta.url));

class UsageError extends Error {}

function parseArgs(argv) {
  const options = { arm: 'both', controlMs: 0, report: DEFAULT_REPORT, keepSandbox: false, timeoutMs: 300_000 };
  const value = (index, name) => {
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new UsageError(`${name} needs a value`);
    return argv[index + 1];
  };
  const integer = (text, name) => {
    if (!/^\d+$/.test(text)) throw new UsageError(`${name} needs a non-negative integer, got ${JSON.stringify(text)}`);
    return Number(text);
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--claude') options.claude = value(i++, flag);
    else if (flag === '--arm') options.arm = value(i++, flag);
    else if (flag === '--control-ms') options.controlMs = integer(value(i++, flag), flag);
    else if (flag === '--timeout-ms') options.timeoutMs = integer(value(i++, flag), flag);
    else if (flag === '--report') options.report = path.resolve(value(i++, flag));
    else if (flag === '--work-root') options.workRoot = value(i++, flag);
    else if (flag === '--keep-sandbox') options.keepSandbox = true;
    else throw new UsageError(`unknown argument ${JSON.stringify(flag)}`);
  }
  if (!options.claude) throw new UsageError('--claude <absolute path of the claude binary> is required');
  if (!path.isAbsolute(options.claude)) throw new UsageError(`--claude must be an absolute path, got ${JSON.stringify(options.claude)}: no PATH lookup is made`);
  if (options.workRoot !== undefined && !path.isAbsolute(options.workRoot)) throw new UsageError(`--work-root must be an absolute path, got ${JSON.stringify(options.workRoot)}`);
  if (['current', 'minimal', 'both'].includes(options.arm)) return options;
  let parsed;
  try {
    parsed = parseArm(options.arm, 'claude');
    if (parsed !== null) armPlans([parsed.base, options.arm]);
  } catch (err) {
    if (err instanceof ArmError) throw new UsageError(`--arm: ${err.message}`);
    throw err;
  }
  if (parsed === null) throw new UsageError(`--arm must be current, minimal, both or an arm of one component (current-without-<id> or minimal-with-mcp-<name>), got ${JSON.stringify(options.arm)}`);
  return options;
}

/** The command line. Resolves to the exit code (0 pass, 1 fail, 2 usage or an unexpected error). `io` is
 * for tests: `stdout` and `stderr` writers, and `overrides`, options merged into `runIsolationProbe`
 * (a fake home, a fake claude). Progress goes to stderr and never names the sandbox: the output of a probe
 * is often read back into a live session whose transcript the next probe scans. */
export async function main(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, overrides = {} } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    stderr.write(`${err.message}\n${USAGE}\n`);
    return 2;
  }
  const nonce = overrides.nonce ?? makeNonce();
  let report;
  try {
    report = await runIsolationProbe({
      claude: args.claude,
      arms: args.arm === 'both' ? ['current', 'minimal'] : args.arm === 'current' || args.arm === 'minimal' ? [args.arm] : [parseArm(args.arm, 'claude').base, args.arm],
      controlMs: args.controlMs,
      timeoutMs: args.timeoutMs,
      keepSandbox: args.keepSandbox,
      ...(args.workRoot && { workRoot: args.workRoot }),
      log: (message) => stderr.write(`${message}\n`),
      ...overrides,
      nonce,
    });
  } catch (err) {
    stderr.write(`the isolation probe could not run: ${makeScrubber(nonce)(errorMessage(err))}\n`);
    return 2;
  }
  fs.mkdirSync(path.dirname(args.report), { recursive: true });
  fs.writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`);
  stdout.write(formatSummary(report));
  stdout.write(`\nfull report: ${args.report}\n`);
  return report.ok ? 0 : 1;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = await main();
}

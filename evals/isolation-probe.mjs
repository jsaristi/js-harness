#!/usr/bin/env node
// The isolation probe: runs ONE agent trial under the eval sandbox against a loopback fake Anthropic
// Messages API (zero spend, no network), then proves the machine's real Claude Code state was untouched.
// Zero deps, plain Node. Why a sandbox is needed and what it is made of: `odd/tasks/evals.md` ("T2 map and
// decisions"). This is the check that the sandbox is real, not assumed: the sandbox env is a list of
// variables somebody believes every writer honours, and only a run of the real binary says whether it does.
//
//   node evals/isolation-probe.mjs --claude <absolute path> [--arm current|minimal|both] [--control-ms <n>]
//     [--report <path>] [--keep-sandbox] [--timeout-ms <n>]
//
// How it proves anything, rather than merely failing to find a leak:
//  - A random NONCE is the agent's prompt and the content of the files it is told to write. The nonce is
//    never printed, logged or written to the report; the report is scrubbed of it as a last step.
//  - Before and after the trial, every real tree where Claude Code or its tools could write is hashed. The
//    after-pass also scans every file's content for the nonce and for the unique name of the sandbox's temp
//    root, which no real file has a reason to contain. Hits are reported by path, never by value.
//  - POSITIVE CONTROLS inside the sandbox (the nonce is in a transcript, the tool-written files exist, the
//    engram store was created) prove the trial wrote where it was meant to. Without them a sandbox that
//    wrote nothing at all, or an agent that never ran, would pass the leak check vacuously.
//  - Live writers (this very Claude session, the engram and codegraph daemons) keep changing the real trees,
//    so a diff alone cannot fail the run. `--control-ms` measures that churn first, with no agent, and the
//    report splits trial-window changes into those also seen at baseline and new ones.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertWorkRoot, currentConfig, defaultWorkRoot, minimalConfig } from './configs.mjs';
import { buildTemplate, removeTemplate, seedFromTemplate } from './home.mjs';
import { childEnv, killByPath, parseAgentOutput, removeDir, resolveAgent, runProcess } from './runner.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Paths compare case-insensitively on Windows. */
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);

/** What the probe runs the agent as. The model and effort are the eval's real ones, so the request shape
 * (tools offered, haiku side calls) is the one a measured trial produces; `bypassPermissions` is for the
 * probe only, because a headless agent that must ask before running a tool never runs it. */
export const PROBE_MODEL = 'claude-opus-5-5';
export const PROBE_EFFORT = 'medium';
export const PROBE_PERMISSION_MODE = 'bypassPermissions';

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
  'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache', 'ANTHROPIC_BASE_URL',
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

/** The `NAME=value` lines of a tool_result as an object. */
export function parseEnvLines(text) {
  const env = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
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

const normalize = (text) => text.replace(/\s+/g, ' ').trim();
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

/** Starts the fake Messages API on `127.0.0.1` (port 0: the OS picks a free one) and resolves to `{ url,
 * port, requests, toolResults(), close() }`.
 *
 * It scripts the agent so that one trial exercises every writer the probe is about: a request that offers
 * `Bash` and has not used it gets a `Bash` tool_use (`probeCommand`), then one offering `Write` gets a
 * `Write` of `probe-write.txt` in `workspace` (the server cannot know the agent's cwd, so the probe passes
 * it in) holding the nonce, and then a plain-text reply with the nonce. A small/fast model (title
 * generation, hooks) or a request with no tools only ever gets the text, so those calls, and a nested
 * reviewer `claude`, complete without recursing into the script. `stream: true` is honoured with SSE.
 *
 * `markers` (see `claudeMdMarkers`) are matched against every `/v1/messages` request: the log says whether the
 * request carried the real global CLAUDE.md, which is how the probe sees that a trial loaded it.
 *
 * `requests` is the log: method, path (no query), model, whether tools were offered, whether the request
 * carried the markers and what was replied, and nothing more. Headers (an API key), system prompts and message bodies, which hold the prompt and the
 * user's own memory, never reach it. `toolResults()` is the text of every tool_result the agent sent back,
 * once per tool_use id: the environment as the agent's tools saw it. */
export async function startFakeApi({ nonce, workspace, markers = [], host = '127.0.0.1' }) {
  const requests = [];
  const results = new Map();
  let counter = 0;

  const toolUse = (name, input) => ({ type: 'tool_use', id: `toolu_probe_${++counter}`, name, input });
  const answer = ({ model, tools, messages }) => {
    const used = new Set(messages.filter((m) => m?.role === 'assistant' && Array.isArray(m.content)).flatMap((m) => m.content).filter((b) => b?.type === 'tool_use').map((b) => b.name));
    let content = [{ type: 'text', text: `The probe is done. ${nonce}` }];
    let reply = 'text';
    if (tools.length > 0 && !/haiku/i.test(model ?? '')) {
      if (tools.includes('Bash') && !used.has('Bash')) {
        content = [toolUse('Bash', { command: probeCommand(nonce), description: 'Record the environment for the isolation probe' })];
        reply = 'tool_use:Bash';
      } else if (tools.includes('Write') && !used.has('Write')) {
        content = [toolUse('Write', { file_path: path.join(workspace, 'probe-write.txt'), content: nonce })];
        reply = 'tool_use:Write';
      }
    }
    const message = {
      id: `msg_probe_${++counter}`, type: 'message', role: 'assistant', model: model ?? PROBE_MODEL, content,
      stop_reason: reply === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null, usage: { input_tokens: 12, output_tokens: 7 },
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
    const entry = { method: req.method, path: pathname, model: null, stream: false, toolsOffered: false, globalClaudeMd: false, reply: '404' };
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
    entry.globalClaudeMd = pathname === '/v1/messages' && carriesMarkers(body, markers);
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
    close: () => new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}

// ---- hashing, scanning and diffing real trees -----------------------------------------------------------

const DEFAULT_CHUNK = 1 << 20;
const DEFAULT_CONCURRENCY = 8;
/** Tries after the first for a file that fails to open or read, and the pause between them. */
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 100;
const defaultOpenRead = (file, { chunkSize }) => fs.createReadStream(file, { highWaterMark: chunkSize });
const relOf = (root, full) => path.relative(root, full).split(path.sep).join('/');

/** Needles as buffers. A needle is `{ label, values }`: each value is searched as UTF-8 and as UTF-16LE (a
 * Windows tool may write either), and a file holds the needle when it holds any of its values. */
function compileNeedles(needles) {
  return needles.map(({ label, values }) => ({ label, buffers: values.flatMap((value) => [Buffer.from(value, 'utf8'), Buffer.from(value, 'utf16le')]) }));
}

/** Streams `file` once: its sha256, its size and which needles it holds. No whole-file buffering, so a
 * 700 MB binary costs a chunk of memory; the last `longest - 1` bytes of a chunk are carried into the next,
 * so a needle that straddles a chunk boundary is still found. `open(file, { chunkSize })` returns an async
 * iterable of buffers, and is injectable so a test can prove which files are opened. */
async function readFileOnce(file, { needles, open, chunkSize, collect = false }) {
  const hash = crypto.createHash('sha256');
  const body = [];
  let collected = 0;
  const found = new Set();
  const overlap = Math.max(0, ...needles.flatMap((needle) => needle.buffers.map((buffer) => buffer.length))) - 1;
  let size = 0;
  let tail = Buffer.alloc(0);
  for await (const chunk of open(file, { chunkSize })) {
    hash.update(chunk);
    size += chunk.length;
    if (collect && collected <= MAX_KEYED_BYTES) {
      body.push(chunk);
      collected += chunk.length;
    }
    if (needles.length === 0) continue;
    const window = tail.length > 0 ? Buffer.concat([tail, chunk]) : chunk;
    for (const needle of needles) {
      if (!found.has(needle.label) && needle.buffers.some((buffer) => window.includes(buffer))) found.add(needle.label);
    }
    tail = Buffer.from(window.subarray(Math.max(0, window.length - overlap)));
  }
  return { sha256: hash.digest('hex'), size, found: [...found], ...(collect && { body: collected <= MAX_KEYED_BYTES ? Buffer.concat(body) : null }) };
}

/** The largest file whose keys are compared: the account file is a few MB, and a file that is not that is not
 * what the key diff is for. A larger one is still hashed whole, and its keys are reported as not comparable. */
const MAX_KEYED_BYTES = 64 << 20;

/** The same JSON in a canonical text (object keys sorted at every depth), so two files that hold the same data
 * in another key order or with other whitespace hash alike: only a real change counts. */
const canonical = (value) => (Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : isObject(value)
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value));

/** The sha256 of each top-level key of a JSON object, and of each entry of its `projects` object under the name
 * `projects["<key>"]` (the account file keeps one entry per project folder there, which is where a trial's
 * path would show up). A Map of name to hash, and no value: a name says WHAT changed, which is enough, and a
 * report that held a value could hold a token. `null` when the text is not a JSON object (a write caught half
 * way, or a file that is not that), which is not the same as "every key changed". */
function keyHashes(body) {
  if (body === null || body === undefined) return null;
  let parsed;
  try {
    parsed = JSON.parse(body.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;
  const hashes = new Map();
  const put = (name, value) => hashes.set(name, crypto.createHash('sha256').update(canonical(value)).digest('hex'));
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'projects' && isObject(value)) {
      for (const [project, entry] of Object.entries(value)) put(`projects["${project}"]`, entry);
    } else {
      put(key, value);
    }
  }
  return hashes;
}

/** Which of `needles` (`{ label, values }`) `file` holds, as labels. Throws when the file cannot be read. */
export async function scanFile(file, needles, { openRead = defaultOpenRead, chunkSize = DEFAULT_CHUNK } = {}) {
  return (await readFileOnce(file, { needles: compileNeedles(needles), open: openRead, chunkSize })).found;
}

async function mapPool(items, limit, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

/** One tree of `snapshotTrees`; see there. */
async function snapshotTree({ root, mode = 'content', statOnly = [], jsonKeys = false }, { needles, open, chunkSize, concurrency, retries, retryDelayMs }) {
  // `dirs` holds the empty directories only (see `snapshotTrees`): they are not files, so they are not in
  // `files` and not in a diff, but their names are scanned like every other name.
  const tree = { root, mode, status: 'present', files: new Map(), keys: new Map(), dirs: new Set(), unreadable: [], hits: [], bytes: 0 };
  let rootStat;
  try {
    rootStat = fs.lstatSync(root);
  } catch (err) {
    tree.status = err.code === 'ENOENT' || err.code === 'ENOTDIR' ? 'missing' : 'unreadable';
    if (tree.status === 'unreadable') tree.unreadable.push({ path: '.', code: err.code ?? 'ERR' });
    return tree;
  }
  const exempt = new Set(statOnly.map(fold));
  const toHash = [];
  const record = (rel, full, size, mtimeMs) => {
    if (mode === 'content' && !exempt.has(fold(rel))) toHash.push({ rel, full });
    else tree.files.set(rel, `stat:${size}:${mtimeMs}`);
  };
  const fail = (rel, err) => {
    if (err.code !== 'ENOENT') tree.unreadable.push({ path: rel, code: err.code ?? 'ERR' }); // gone since the listing: not in the snapshot
  };

  if (mode === 'names') {
    try {
      for (const name of fs.readdirSync(root)) tree.files.set(name, 'name');
    } catch (err) {
      fail('.', err);
    }
  } else if (!rootStat.isDirectory()) {
    record('.', root, rootStat.size, rootStat.mtimeMs);
  } else {
    const walk = (dir) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) {
        fail(relOf(root, dir) || '.', err);
        return;
      }
      // A directory with nothing in it has no file whose path names it, so it is recorded by itself: one
      // named after the sandbox is still a trace of the trial. (A link to a directory is a link, above.)
      if (entries.length === 0 && dir !== root) tree.dirs.add(relOf(root, dir));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = relOf(root, full);
        if (entry.isSymbolicLink()) {
          // Never followed: a link out of the tree would pull another tree (or the whole disk) into this one.
          let target = '?';
          try {
            target = fs.readlinkSync(full);
          } catch {
            // an unreadable link is still a link
          }
          tree.files.set(rel, `link:${target}`);
        } else if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          try {
            const stat = fs.lstatSync(full);
            record(rel, full, stat.size, stat.mtimeMs);
          } catch (err) {
            fail(rel, err);
          }
        } else {
          tree.files.set(rel, 'special');
        }
      }
    };
    walk(root);
  }

  await mapPool(toHash, concurrency, async ({ rel, full }) => {
    try {
      let read;
      for (let attempt = 0; ; attempt += 1) {
        try {
          read = await readFileOnce(full, { needles, open, chunkSize, collect: jsonKeys && /\.json$/i.test(full) });
          break;
        } catch (err) {
          // A file another process holds for a moment (EBUSY, a sharing violation) usually reads a moment later;
          // one that is gone is not worth another try. What still fails after the retries is reported by the
          // caller as a file that was not scanned.
          if (err.code === 'ENOENT' || attempt >= retries) throw err;
          if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
      tree.files.set(rel, `sha256:${read.sha256}:${read.size}`);
      if (read.body !== undefined) tree.keys.set(rel, keyHashes(read.body));
      tree.bytes += read.size;
      if (read.found.length > 0) tree.hits.push({ path: rel, found: read.found, via: 'content' });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        tree.files.set(rel, `unreadable:${err.code ?? 'ERR'}`);
        tree.unreadable.push({ path: rel, code: err.code ?? 'ERR' });
      }
    }
  });

  // The names of every entry, whatever its mode: an unreadable file can still be named after the sandbox.
  for (const rel of [...tree.files.keys(), ...tree.dirs]) {
    const found = needles.filter((needle) => needle.names.some((value) => fold(rel).includes(fold(value)))).map((needle) => needle.label);
    if (found.length > 0) tree.hits.push({ path: rel, found, via: 'name' });
  }
  tree.hits.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.via < b.via ? -1 : 1));
  tree.unreadable.sort((a, b) => (a.path < b.path ? -1 : 1));
  return tree;
}

/** Hashes (and scans) the trees `specs` = `[{ name, root, mode, statOnly }]` and resolves to `{ ms, trees }`
 * where `trees[name]` is `{ root, mode, status, files, keys, unreadable, hits, bytes }`.
 *
 *  - `mode: 'content'`: every file is streamed once, giving `sha256:<hex>:<size>` and a scan for `needles`.
 *    `statOnly` lists relative paths inside such a tree that are described by size and mtime instead and
 *    never opened (the credentials file: its content is not the probe's business, and a probe that read a
 *    token would have to promise not to print it). `jsonKeys: true` also keeps, for each `.json` file, the
 *    hash of each of its top-level keys and of each `projects` entry (`keys`: rel path to a Map of name to
 *    hash, or `null` when the file is not a JSON object), so a diff can say which key changed.
 *  - `mode: 'stat'`: `stat:<size>:<mtimeMs>`, no content read. For trees that are huge (hundreds of MB of
 *    binaries) or where content must not be read.
 *  - `mode: 'names'`: the entry names one level down, nothing else. For a directory such as the home, where
 *    the question is only whether a new top-level entry appeared.
 * A root that does not exist has `status: 'missing'`; a root that is a single file is keyed `.`. Links are
 * recorded (`link:<target>`) and never followed. A file that cannot be read is `unreadable:<code>` and listed
 * in `unreadable`, so a hit that could have been is not silently missed, after `retries` more tries
 * `retryDelayMs` apart (a file busy for a moment is usually readable a moment later; a missing one is not
 * retried). A directory with nothing in it is kept in `dirs` (not in `files`, so not in a diff), because no
 * file path names it, and its name is scanned like the others. `needles` are `{ label, values }`;
 * `openRead`, `chunkSize` and the retry settings are for tests; files are read `concurrency` at a time. */
export async function snapshotTrees(specs, {
  needles = [], openRead = defaultOpenRead, chunkSize = DEFAULT_CHUNK, concurrency = DEFAULT_CONCURRENCY, retries = DEFAULT_RETRIES, retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) {
  const began = performance.now();
  const compiled = compileNeedles(needles).map((needle, index) => ({ ...needle, names: needles[index].values }));
  const trees = {};
  for (const spec of specs) trees[spec.name] = await snapshotTree(spec, { needles: compiled, open: openRead, chunkSize, concurrency, retries, retryDelayMs });
  return { ms: Math.round(performance.now() - began), trees };
}

/** The hits of a snapshot: `{ tree, path, found, via }` for each file whose content (`via: 'content'`) or
 * name (`via: 'name'`) holds a needle. Paths, never the values searched for.
 *
 * With `previous`, the snapshot taken before this window, only the hits this window introduced: a hit the
 * previous snapshot already had, at the same path, in a file that is unchanged since, belongs to whatever
 * wrote it earlier (the previous arm), and is not reported again. A file that changed in
 * this window and still holds the needle is this window's. (A file rewritten with identical bytes is
 * indistinguishable from an untouched one, which is the one thing this cannot see.) */
export function leakHits(snapshot, previous) {
  return Object.entries(snapshot.trees).flatMap(([tree, { hits, files }]) => {
    const was = previous?.trees[tree];
    const inherited = (hit) => {
      const old = was?.status === 'present' ? was.hits.find((candidate) => candidate.path === hit.path && candidate.via === hit.via) : undefined;
      return old !== undefined && was.files.get(hit.path) === files.get(hit.path);
    };
    return hits.filter((hit) => !inherited(hit)).map((hit) => ({ tree, ...hit }));
  });
}

/** The key-level difference of the JSON files that changed between two snapshots of one tree: `{ [rel]: { added,
 * removed, changed } }` with the key names sorted, or `{ [rel]: { unparsed: true } }` when either side did not
 * parse as a JSON object (a write caught half way); `null` when no file differs by key. A file that was not
 * there before (the tree was missing, or the file is new) has every key `added`: a newly created account
 * file is the case where a project entry of the trial is most likely and least visible. A file that was
 * there but whose keys were not read (it was unreadable) cannot be compared and is skipped; it is already
 * listed as unreadable. */
function diffKeys(was, now) {
  if (now.status !== 'present') return null;
  const wasFiles = was?.status === 'present' ? was.files : new Map();
  const wasKeys = was?.status === 'present' ? was.keys : new Map();
  const out = {};
  for (const [rel, hashes] of now.keys ?? []) {
    if (wasFiles.has(rel) && !wasKeys.has(rel)) continue;
    if (wasKeys.has(rel) && wasFiles.get(rel) === now.files.get(rel)) continue;
    const old = wasKeys.has(rel) ? wasKeys.get(rel) : new Map();
    if (hashes === null || old === null) {
      out[rel] = { unparsed: true };
      continue;
    }
    const entry = {
      added: [...hashes.keys()].filter((name) => !old.has(name)).sort(),
      removed: [...old.keys()].filter((name) => !hashes.has(name)).sort(),
      changed: [...hashes].filter(([name, hash]) => old.has(name) && old.get(name) !== hash).map(([name]) => name).sort(),
    };
    if (entry.added.length + entry.removed.length + entry.changed.length > 0) out[rel] = entry;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** What changed between two snapshots of the same trees, per tree: `{ added, removed, changed, appeared,
 * vanished }`, the paths sorted. A tree that went from missing to present has `appeared` (and all its
 * files `added`); the reverse is `vanished`. A tree that holds `jsonKeys` files also has `keys` (see
 * `diffKeys`) when one of them changed by key, which names what changed inside a file that is shared with
 * a live writer. */
export function diffSnapshots(before, after) {
  const result = {};
  for (const [name, now] of Object.entries(after.trees)) {
    const was = before.trees[name];
    const old = was?.status === 'present' ? was.files : new Map();
    const current = now.status === 'present' ? now.files : new Map();
    const keys = diffKeys(was, now);
    result[name] = {
      added: [...current.keys()].filter((rel) => !old.has(rel)).sort(),
      removed: [...old.keys()].filter((rel) => !current.has(rel)).sort(),
      changed: [...current].filter(([rel, signature]) => old.has(rel) && old.get(rel) !== signature).map(([rel]) => rel).sort(),
      appeared: was?.status !== 'present' && now.status === 'present',
      vanished: was?.status === 'present' && now.status !== 'present',
      ...(keys && { keys }),
    };
  }
  return result;
}

const treeChanged = (diff) => diff.appeared || diff.vanished || diff.added.length + diff.removed.length + diff.changed.length > 0 || diff.keys !== undefined;

/** `splitByControl` for the `keys` of one tree: a key name counts as baseline when the control window saw it
 * change in the same file, in whatever category. Resolves to `{ fresh, baseline }`, each a keys object or
 * `undefined` when it would be empty. The file's own path can be baseline (the control saw it change) while
 * a key of it is fresh: that is the case this exists for. */
function splitKeys(keys, controlKeys) {
  const fresh = {};
  const baseline = {};
  for (const [rel, entry] of Object.entries(keys ?? {})) {
    const seen = controlKeys?.[rel];
    if (entry.unparsed) {
      (seen?.unparsed ? baseline : fresh)[rel] = entry;
      continue;
    }
    const names = new Set(seen && !seen.unparsed ? [...seen.added, ...seen.removed, ...seen.changed] : []);
    const into = { fresh: { added: [], removed: [], changed: [] }, baseline: { added: [], removed: [], changed: [] } };
    for (const category of ['added', 'removed', 'changed']) {
      for (const name of entry[category]) into[names.has(name) ? 'baseline' : 'fresh'][category].push(name);
    }
    for (const [side, target] of [['fresh', fresh], ['baseline', baseline]]) {
      if (into[side].added.length + into[side].removed.length + into[side].changed.length > 0) target[rel] = into[side];
    }
  }
  const orNothing = (object) => (Object.keys(object).length > 0 ? object : undefined);
  return { fresh: orNothing(fresh), baseline: orNothing(baseline) };
}

/** Splits the trial window's `trial` diff by the control window's `control` diff, both from
 * `diffSnapshots`: `baseline` holds what changed in the trial window at paths that also changed in the
 * control window (a live writer, not the trial), `fresh` holds the rest, which is what a trial could have
 * done. A path counts as baseline in whatever category the control saw it; key names are split the same way
 * (`splitKeys`). */
export function splitByControl(trial, control) {
  const fresh = {};
  const baseline = {};
  for (const [name, diff] of Object.entries(trial)) {
    const seen = new Set(control[name] ? [...control[name].added, ...control[name].removed, ...control[name].changed] : []);
    fresh[name] = { added: [], removed: [], changed: [], appeared: diff.appeared && !control[name]?.appeared, vanished: diff.vanished && !control[name]?.vanished };
    baseline[name] = { added: [], removed: [], changed: [], appeared: diff.appeared && Boolean(control[name]?.appeared), vanished: diff.vanished && Boolean(control[name]?.vanished) };
    for (const category of ['added', 'removed', 'changed']) {
      for (const rel of diff[category]) (seen.has(rel) ? baseline : fresh)[name][category].push(rel);
    }
    const keys = splitKeys(diff.keys, control[name]?.keys);
    if (keys.fresh) fresh[name].keys = keys.fresh;
    if (keys.baseline) baseline[name].keys = keys.baseline;
  }
  return { fresh, baseline };
}

/** The key-level leaks of a diff (`diffSnapshots`, or the `fresh` half of `splitByControl`): an ADDED or CHANGED
 * `projects["<path>"]` key that names one of `tokens` (the unique names of the trial's sandbox) or `workRoot`
 * (a string, or a list) is a project entry that Claude Code recorded for a folder of the trial, in the real
 * account file: the sandbox's cwd reached the real configuration. Hits are `{ tree, path, found, via: 'key' }`
 * with `found` naming which it matched (`sandbox`, `workRoot`). The path is taken out of the key and matched
 * by directory: a token must be one of its segments, and the work root must be the path or a parent of it,
 * so a sibling whose name only begins like the root is not a hit. The comparison is case-insensitive and
 * treats both separators alike, since the file records whatever spelling the process had. A removed key is not a leak;
 * a key that is not a project entry is reported in the diff and nowhere else. */
export function keyLeaks(diff, { tokens = [], workRoot = [] } = {}) {
  const normalize = (text) => text.replaceAll('\\', '/').toLowerCase();
  const sandbox = tokens.filter(Boolean).map(normalize);
  const roots = [workRoot].flat().filter(Boolean).map((root) => normalize(root).replace(/\/+$/, ''));
  const hits = [];
  for (const [tree, entry] of Object.entries(diff)) {
    for (const keys of Object.values(entry.keys ?? {})) {
      for (const name of [...(keys.added ?? []), ...(keys.changed ?? [])]) {
        const project = /^projects\["([\s\S]*)"\]$/.exec(name)?.[1];
        if (project === undefined) continue;
        // The path the key names, compared by directory: the sandbox is one segment of it, and the work root
        // is it or a prefix of it that ends at a separator. `work-other` is not `work`, `trial-10` is not `trial-1`.
        const text = normalize(project);
        const segments = text.split('/');
        const found = [...(sandbox.some((token) => segments.includes(token)) ? ['sandbox'] : []), ...(roots.some((root) => text === root || text.startsWith(`${root}/`)) ? ['workRoot'] : [])];
        if (found.length > 0) hits.push({ tree, path: name, found, via: 'key' });
      }
    }
  }
  return hits;
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

// ---- looking inside the sandbox ---------------------------------------------------------------------------

/** The relative paths of the files below `root` (never following a link), or none when it is missing. */
function walkFiles(root) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(relOf(root, full));
    }
  };
  walk(root);
  return files.sort();
}

const exists = (target) => fs.lstatSync(target, { throwIfNoEntry: false }) !== undefined;

/** The top two levels of the sandbox home as `{ path, kind, files, bytes }` (counts are of everything
 * below), so the parent can see what a trial left in a home at a glance. */
function summarizeTop(home) {
  const count = (dir) => walkFiles(dir).reduce((total, rel) => ({ files: total.files + 1, bytes: total.bytes + (fs.lstatSync(path.join(dir, ...rel.split('/')), { throwIfNoEntry: false })?.size ?? 0) }), { files: 0, bytes: 0 });
  const describe = (full, rel) => {
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) return { path: rel, kind: 'link', files: 0, bytes: 0 };
    if (stat.isDirectory()) return { path: rel, kind: 'dir', ...count(full) };
    return { path: rel, kind: 'file', files: 1, bytes: stat.size };
  };
  const rows = [];
  for (const top of fs.readdirSync(home).sort()) {
    const row = describe(path.join(home, top), top);
    rows.push(row);
    if (row.kind === 'dir') for (const child of fs.readdirSync(path.join(home, top)).sort()) rows.push(describe(path.join(home, top, child), `${top}/${child}`));
  }
  return rows;
}

/** The positive controls: what a trial that really ran under the sandbox must have written inside it. A
 * check that finds nothing in the real trees means something only if these find something in the sandbox.
 * `engramDb` applies to the current arm only (the minimal arm has no MCP servers). */
async function positiveControls({ arm, home, workspace, nonce }) {
  const controls = {};
  const projects = path.join(home, '.claude', 'projects');
  const transcripts = walkFiles(projects).filter((rel) => rel.endsWith('.jsonl'));
  let transcript = null;
  for (const rel of transcripts) {
    if ((await scanFile(path.join(projects, ...rel.split('/')), [{ label: 'nonce', values: [nonce] }])).length > 0) {
      transcript = `.claude/projects/${rel}`;
      break;
    }
  }
  controls.transcript = { ok: transcript !== null, path: transcript, transcripts: transcripts.length };
  const holdsNonce = (file) => {
    try {
      return fs.readFileSync(path.join(workspace, file), 'utf8').includes(nonce);
    } catch {
      return false;
    }
  };
  controls.workspaceNonce = { ok: holdsNonce('probe-nonce.txt') };
  controls.workspaceWrite = { ok: holdsNonce('probe-write.txt') };
  if (arm === 'current') {
    const db = walkFiles(path.join(home, '.engram')).find((rel) => /\.(db|sqlite3?)$/i.test(rel));
    controls.engramDb = { applies: true, ok: db !== undefined, path: db === undefined ? null : `.engram/${db}` };
  } else {
    controls.engramDb = { applies: false, ok: true };
  }
  return controls;
}

/** The variables whose value, as the agent's own tools print it, must lie inside the sandbox. */
const EXPECTED_INSIDE = [
  'HOME', 'USERPROFILE', 'HOMEPATH', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache',
];

/** The environment as the agent's tools saw it: the NAME=value lines of the tool_result that has them, and,
 * for each variable that must point into the sandbox, `inside`, `outside` or `empty`. "Inside" means the
 * value holds the sandbox's unique name, which survives every spelling of a path (Git Bash's `/c/Users/...`,
 * 8.3 short names, slashes). Informational: an `outside` is a warning, not a failure, because a shell may
 * legitimately rewrite a variable of its own (`TMPDIR=/tmp`) and the leak scan is what fails the probe. */
function inspectEnv(toolResults, token) {
  const parsed = toolResults.map((result) => parseEnvLines(result.text)).find((env) => 'OAUTH_TOKEN_SET' in env);
  if (!parsed) return { envLines: null, envChecks: {} };
  const envChecks = {};
  for (const name of EXPECTED_INSIDE) {
    const value = parsed[name];
    envChecks[name] = value === undefined || value === '' ? 'empty' : fold(value).includes(fold(token)) ? 'inside' : 'outside';
  }
  return { envLines: parsed, envChecks };
}

// ---- the report -----------------------------------------------------------------------------------------

const cap = (list, limit = 200) => ({ count: list.length, paths: list.slice(0, limit) });

/** A diff as the report holds it: only the trees that changed, only the categories that have entries, each
 * list capped (a tree that appears can have thousands of files) with its full count. The key names of a
 * JSON file that changed (`keys`) are listed the same way: names, never values. */
function reportDiff(diff) {
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

const errorMessage = (err) => (err instanceof Error ? err.message : String(err));

/** Whether the real global `CLAUDE.md` reached the model, from the fake API's log (booleans only). The two
 * arms must differ: the minimal arm is "the model and the built-in tools, nothing else", so it must carry
 * none of it on any request, and the current arm's seeded copy is the point of that arm, so its main-model
 * request (the one that offers tools, not a small-model side call) must carry it. A workspace with the real
 * home above it breaks the first: Claude Code loads `CLAUDE.md` from every ancestor directory. */
function checkContamination(arm, log, markers) {
  if (markers === 0) return { skipped: 'the real ~/.claude/CLAUDE.md is missing or has no line long enough to recognize it by' };
  const messages = log.filter((request) => request.method === 'POST' && request.path === '/v1/messages' && (request.reply === 'text' || request.reply.startsWith('tool_use')));
  if (messages.length === 0) return { skipped: 'the agent sent no /v1/messages request' };
  const withGlobalClaudeMd = messages.filter((request) => request.globalClaudeMd).length;
  const mainRequestHit = messages.some((request) => request.toolsOffered && !/haiku/i.test(request.model ?? '') && request.globalClaudeMd);
  const expected = arm === 'current' ? 'present' : 'absent';
  return { expected, markers, requests: messages.length, withGlobalClaudeMd, mainRequestHit, ok: expected === 'present' ? mainRequestHit : withGlobalClaudeMd === 0 };
}

const probePrompt = (nonce) => `Isolation probe, nonce:${nonce}\nFollow the tool calls you are given, and do nothing else.\n`;

/** One trial of one arm, built the way the eval builds it (`minimalConfig` / `currentConfig` with the
 * template seed), against a fresh fake API. Returns the arm's report and the real trees' snapshot taken
 * right after the agent exited, which is the next arm's "before". `p` is the shared probe context. */
async function runArm(p, arm, before) {
  const { o, nonce } = p;
  const root = fs.mkdtempSync(path.join(o.workRoot, SANDBOX_PREFIX));
  const token = path.basename(root);
  p.tokens.push(token);
  const home = path.join(root, 'home');
  const workspace = path.join(root, 'workspace');
  const result = { arm, sandboxToken: token, failures: [] };
  const cleanupFailures = [];
  let templateParent = null;
  let api = null;
  let after = before;
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
  let swept = false;
  try {
    fs.mkdirSync(home);
    fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'the isolation probe workspace\n');
    api = await startFakeApi({ nonce, workspace, markers: p.markers });
    let run = null;
    let seeded = null;
    try {
      let seed;
      if (arm === 'current') {
        // Built per arm inside its own try, so the template (a copy of the account data in the real
        // config) is removed on every path below, whatever fails.
        templateParent = fs.mkdtempSync(path.join(o.workRoot, TEMPLATE_PREFIX));
        const templateDir = path.join(templateParent, 'template');
        p.log('current: building the home template from the real configuration (read only)');
        const built = buildTemplate({ realHome: o.realHome, templateDir });
        result.template = { files: built.files, bytes: built.bytes, warnings: built.warnings };
        seed = seedFromTemplate(templateDir, { runInit: o.runInit });
      }
      const options = { command: o.claude, model: PROBE_MODEL, permissionMode: PROBE_PERMISSION_MODE };
      let config = arm === 'current' ? currentConfig({ ...options, seed }) : minimalConfig(options);
      config = o.adaptConfig(config, { arm });
      const configEnv = config.env;
      // The agent talks to the fake API with a dummy key and no login: the only credential is not one.
      config = { ...config, env: (context) => ({ ...(typeof configEnv === 'function' ? configEnv(context) : configEnv), ANTHROPIC_BASE_URL: api.url, ANTHROPIC_API_KEY: DUMMY_API_KEY, CLAUDE_CODE_OAUTH_TOKEN: null }) };
      await config.prepare({ home, workspace, effort: PROBE_EFFORT, task: undefined });
      seeded = await snapshotTrees([{ name: 'home', root: home, mode: 'content' }], { concurrency: o.concurrency, chunkSize: o.chunkSize });
      const agent = resolveAgent(config, { effort: PROBE_EFFORT, task: undefined, home, workspace });
      p.log(`${arm}: running the agent`);
      const began = performance.now();
      run = await runProcess({ ...agent, env: childEnv(agent.env), cwd: workspace, input: probePrompt(nonce), timeoutMs: o.timeoutMs });
      result.wallMs = Math.round(performance.now() - began);
    } catch (err) {
      result.error = errorMessage(err);
    }

    // The sweep comes BEFORE the snapshot that is scanned and diffed, whatever happened above: a process the
    // agent left behind can write to a real tree after the agent exits, and a snapshot taken first would
    // miss what it wrote between the snapshot and its death. After the sweep nothing of the arm is running.
    swept = true;
    sweepSandbox();
    // The real trees are checked even when the arm failed: a trial that died half way may already have leaked.
    p.log(`${arm}: checking the real trees`);
    after = await p.snapshot(`after:${arm}`, p.needles());

    if (run) {
      const parsed = parseAgentOutput(run.stdout);
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
    result.contamination = checkContamination(arm, log, p.markers.length);
    if (result.contamination.skipped && p.markers.length === 0) result.warnings.push(`the contamination check was skipped: ${result.contamination.skipped}`);

    if (!result.error) {
      result.positiveControls = await positiveControls({ arm, home, workspace, nonce });
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
    if (!control.ok) failures.push(`${label}: positive control "${name}" failed: the sandbox did not hold what a real run writes there, so a clean leak scan proves nothing`);
  }
  const { contamination } = result;
  if (contamination && contamination.ok === false) {
    failures.push(contamination.expected === 'absent'
      ? `${label}: minimal arm loaded the real global CLAUDE.md: ${contamination.withGlobalClaudeMd} of ${contamination.requests} requests carried it, so the arm meant to load nothing is not measuring that (is the work root under the real home?)`
      : `${label}: current arm never carried the global CLAUDE.md on its main-model request: the seeded copy was not loaded, so the arm does not measure the setup it is named after`);
  }
  // A real file that could not be read, after the retries, was not scanned: the verdict on it is unknown, and
  // an unknown is not a pass.
  const unreadable = result.leak?.unreadable;
  for (const entry of (unreadable?.paths ?? []).slice(0, 10)) failures.push(`${label}: inconclusive: could not read ${entry}, so it was not scanned for the nonce or the sandbox name`);
  if ((unreadable?.count ?? 0) > 10) failures.push(`${label}: inconclusive: ${unreadable.count - 10} more real files could not be read (see the JSON report)`);
  for (const hit of result.leak?.hits ?? []) {
    failures.push(hit.via === 'key'
      ? `${label}: LEAK: the real ${hit.tree} has a new or changed key ${hit.path} (it names the ${hit.found.join(' and the ')})`
      : `${label}: LEAK: the real ${hit.tree} has ${hit.path} (${hit.via} holds the ${hit.found.join(' and ')})`);
  }
  return failures;
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
 * removal if that sweep was not reached), `wait(ms)`, `log(message)`, `concurrency`, `chunkSize`, `openRead(file,
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
  for (const arm of o.arms) if (arm !== 'current' && arm !== 'minimal') throw new Error(`unknown arm ${JSON.stringify(arm)}: use "current" or "minimal"`);
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
  const p = {
    o, nonce, markers, tokens, snapshot, log: o.log,
    // The nonce, and the unique name of every sandbox so far (also lowercased, which is how a Windows tool
    // may spell a path), searched for in the real trees' content and names.
    needles: () => [{ label: 'nonce', values: [nonce] }, { label: 'sandbox', values: [...new Set(tokens.flatMap((token) => [token, token.toLowerCase()]))] }],
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
function makeScrubber(nonce) {
  const secrets = [[nonce, '<nonce>'], [DUMMY_API_KEY, '<dummy-api-key>'], [process.env.CLAUDE_CODE_OAUTH_TOKEN, '<login-token>']].filter(([value]) => typeof value === 'string' && value.length >= 8);
  return (text) => secrets.reduce((scrubbed, [value, label]) => scrubbed.split(value).join(label), text);
}

// ---- the summary and the command line -----------------------------------------------------------------------

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

function diffLines(diff, indent) {
  const lines = [];
  for (const [tree, entry] of Object.entries(diff)) {
    const counts = ['added', 'removed', 'changed'].filter((category) => entry[category]).map((category) => `${category} ${entry[category].count}`);
    lines.push(`${indent}${tree}: ${[entry.appeared && 'appeared', entry.vanished && 'vanished', ...counts].filter(Boolean).join(', ')}`);
    for (const category of ['added', 'removed', 'changed']) {
      for (const rel of (entry[category]?.paths ?? []).slice(0, 8)) lines.push(`${indent}  ${{ added: '+', removed: '-', changed: '~' }[category]} ${rel}`);
      if ((entry[category]?.count ?? 0) > 8) lines.push(`${indent}  ... ${entry[category].count - 8} more ${category} (all in the JSON report)`);
    }
    for (const [rel, keys] of Object.entries(entry.keys ?? {})) {
      if (keys.unparsed) lines.push(`${indent}  keys in ${rel}: not compared, the file was not a JSON object at one end of the window`);
      for (const category of ['added', 'removed', 'changed']) {
        if (!keys[category]) continue;
        const more = keys[category].count > 8 ? ` ... and ${keys[category].count - 8} more` : '';
        lines.push(`${indent}  keys ${category} in ${rel}: ${keys[category].paths.slice(0, 8).join(', ')}${more}`);
      }
    }
  }
  return lines;
}

/** The human summary of a report: short, and safe to print, since the report is already scrubbed. */
export function formatSummary(report) {
  const lines = [];
  const hashed = report.hashing.reduce((total, entry) => ({ ms: total.ms + entry.ms, bytes: Math.max(total.bytes, entry.bytes), files: Math.max(total.files, entry.files) }), { ms: 0, bytes: 0, files: 0 });
  lines.push(`isolation probe: ${report.ok ? 'PASS' : 'FAIL'}`);
  lines.push(`claude ${report.claude} as ${report.config.model}, effort ${report.config.effort}, permission mode ${report.config.permissionMode}`);
  lines.push(`work root: ${report.workRoot} (${report.workRootCreated ? 'made by this run' : 'was there already'}); sandboxes and the template were built there, outside the real home and with no project memory above them`);
  lines.push(`real trees: ${report.hashing.length} passes in ${seconds(hashed.ms)}, ${hashed.files} files, ${megabytes(hashed.bytes)} content-hashed per pass (${report.hashing.map((entry) => `${entry.label} ${seconds(entry.ms)}`).join(', ')})`);
  if (report.control) {
    lines.push(`control window (${report.control.ms} ms, no agent), live writers changed:`);
    const control = diffLines(report.control.diff, '  ');
    lines.push(...(control.length > 0 ? control : ['  nothing']));
  }
  for (const arm of report.arms) {
    lines.push('', `arm ${arm.arm}: ${arm.ok ? 'ok' : 'FAILED'}, agent exit ${arm.exitCode ?? 'none'}${arm.timedOut ? ' (timed out)' : ''}${arm.wallMs === undefined ? '' : `, ${seconds(arm.wallMs)}`}`);
    if (arm.error) lines.push(`  error: ${arm.error}`);
    if (arm.agent) lines.push(`  agent result: ${arm.agent.isError ? 'error' : 'ok'} (${arm.agent.subtype ?? 'no subtype'}, ${arm.agent.numTurns ?? '?'} turns)`);
    if (arm.stderrTail && !arm.ok) lines.push(`  agent stderr (tail): ${arm.stderrTail.trim().split('\n').slice(-5).join(' | ')}`);
    if (arm.template) lines.push(`  template: ${arm.template.files} files, ${megabytes(arm.template.bytes)}${arm.template.warnings.length > 0 ? `; ${arm.template.warnings.join('; ')}` : ''}`);
    if (arm.fakeApi) {
      lines.push(`  fake API: ${arm.fakeApi.requestCount} requests (${Object.entries(arm.fakeApi.tally).map(([reply, n]) => `${reply} x${n}`).join(', ') || 'none'})${arm.fakeApi.unexpected > 0 ? `; ${arm.fakeApi.unexpected} unexpected, see the JSON report` : ''}`);
      if (arm.fakeApi.envLines) {
        lines.push("  the agent's tools saw:");
        for (const [name, value] of Object.entries(arm.fakeApi.envLines)) lines.push(`    ${arm.fakeApi.envChecks[name] === 'outside' ? '!!' : '  '} ${name}=${value}`);
      } else {
        lines.push("  the agent's tools reported no environment (the Bash tool call never completed)");
      }
    }
    if (arm.contamination) {
      const c = arm.contamination;
      if (c.skipped) lines.push(`  contamination: check skipped (${c.skipped})`);
      else {
        const reached = c.withGlobalClaudeMd === 0 ? `none of ${c.requests}` : `${c.withGlobalClaudeMd} of ${c.requests}`;
        lines.push(`  contamination: the real global CLAUDE.md reached ${reached} requests${c.ok ? ', as it should' : `: FAILED, expected it ${c.expected === 'present' ? 'on the main-model request' : 'on none'}`}`);
      }
    }
    for (const warning of arm.warnings ?? []) lines.push(`  warning: ${warning}`);
    if (arm.positiveControls) {
      lines.push(`  positive controls: ${Object.entries(arm.positiveControls).map(([name, control]) => `${name} ${control.applies === false ? 'n/a' : control.ok ? 'ok' : 'FAILED'}`).join(', ')}`);
    }
    if (arm.sandbox) {
      const { answers } = arm.sandbox;
      lines.push(`  sandbox home: ${arm.sandbox.created.count} files created, ${arm.sandbox.changed.count} seeded files changed${arm.sandbox.kept ? `; kept at ${arm.sandbox.kept}` : ''}`);
      lines.push(`    history.jsonl written: ${answers.historyJsonl}; AppData/Local/claude-cli-nodejs in the sandbox: ${answers.claudeCliNodejs}; plugins/marketplaces present ${answers.pluginsMarketplaces.present}, created ${answers.pluginsMarketplaces.created}, changed ${answers.pluginsMarketplaces.changed}, removed ${answers.pluginsMarketplaces.removed}`);
      lines.push(`    top level: ${arm.sandbox.top.filter((row) => !row.path.includes('/')).map((row) => `${row.path} (${row.files})`).join(', ')}`);
    }
    if (arm.leak) {
      lines.push(`  leak scan of the real trees: ${arm.leak.hits.length === 0 ? 'nothing found' : `${arm.leak.hits.length} HIT(S)`}${arm.leak.unreadable.count > 0 ? `; ${arm.leak.unreadable.count} files could not be read, so were not scanned: INCONCLUSIVE` : ''}`);
      for (const hit of arm.leak.hits) lines.push(`    HIT ${hit.tree}/${hit.path}: ${hit.found.join(', ')} (${hit.via})`);
      const split = arm.leak.fresh;
      lines.push(`  real trees changed during this arm${split ? ' (new, not seen in the control window)' : ''}:`);
      const changes = diffLines(split ?? arm.leak.diff, '    ');
      lines.push(...(changes.length > 0 ? changes : ['    nothing']));
      if (split) {
        const baseline = diffLines(arm.leak.baseline, '    ');
        if (baseline.length > 0) lines.push('  also changed in the control window (live writers):', ...baseline);
      }
    }
  }
  if (report.failures.length > 0) lines.push('', 'failures:', ...report.failures.map((failure) => `  - ${failure}`));
  return `${lines.join('\n')}\n`;
}

const USAGE = `usage: node evals/isolation-probe.mjs --claude <absolute path> [--arm current|minimal|both] [--control-ms <n>] [--report <path>] [--keep-sandbox] [--timeout-ms <n>] [--work-root <abs>]

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
  if (!['current', 'minimal', 'both'].includes(options.arm)) throw new UsageError(`--arm must be current, minimal or both, got ${JSON.stringify(options.arm)}`);
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
      arms: args.arm === 'both' ? ['current', 'minimal'] : [args.arm],
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

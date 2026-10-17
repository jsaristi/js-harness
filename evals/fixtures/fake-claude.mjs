#!/usr/bin/env node
// A stand-in for the real `claude`, for the isolation probe's own tests: it behaves like Claude Code as far
// as the probe can tell (it reads the prompt from stdin, talks to `ANTHROPIC_BASE_URL`, executes the tool
// calls it is given, writes a transcript under `CLAUDE_CONFIG_DIR`) without a model, a login or a shell.
// The probe never runs the real binary in a test.
//
//   node fake-claude.mjs <mode> [<fake real home>] [<flags the probe passes to claude...>]
//
// Modes: ok (everything a real run writes, all inside the sandbox), leak (ok, and the nonce written into
// the fake real `.claude`), leak-path (ok, and a fake real project folder named after the cwd, with no
// nonce in it), silent (calls the API but writes nothing anywhere), noisy (prints the key and the nonce to
// stderr and exits 2, to prove the probe scrubs what it quotes), hang (reads the prompt and never ends),
// wrong-env (ok, but its tools report a HOME outside the sandbox), loads-real (ok, and the real global
// CLAUDE.md is in what it sends), blind (ok, but it sends no CLAUDE.md at all, not even the sandbox copy),
// keeps-servers (ok, and context7's MCP tool offered to the current arm even when its home holds no such server),
// side-call-only (blind, except that a small-model side call carries the sandbox copy), subagent-only (blind,
// except that the subagent request carries it), subagent / subagent-loads-real (ok, and one subagent request
// is made on any arm, clean or carrying the real global CLAUDE.md), orphan (ok, and a
// detached process that names the workspace is left running), touch-json / leak-key / leak-key-workroot (ok,
// and the fake real `.claude.json` is rewritten: see below), late-leak (ok, and an orphan writes the nonce
// into the fake real `.claude` shortly after the agent exits).
//
// What the engram plugin adds to the current arm is stood in for as well. The current arm (the one whose
// sandbox has a `settings.json`) is offered the engram MCP tool and a subagent tool; the other arm is not,
// as with the real `--strict-mcp-config`. In every mode that writes, the current arm's sandbox engram store
// gets what the plugin's paths would put there: the prompt (UserPromptSubmit), the memory the MCP tool
// saves, and the subagent's last message (SubagentStop). More modes: engram-server (ok, and a detached
// stand-in for `engram serve`, as SessionStart starts one, is left listening on ENGRAM_PORT), prompt-only
// (the memory is never saved), wrong-engram-env (its tools report ENGRAM_PORT=7437 and an ENGRAM_URL: only
// text, nothing connects), leak-engram (ok, and the nonce is written into the fake real `.engram`).
// The stand-in connects to no port but the fake API's and the trial's own ENGRAM_PORT, which it only probes, and the
// stand-in server refuses port 7437.
//
// The current arm also leaves what the hooks leave on every path they take: a session id (the agent's result
// carries it and the transcript is named after it), the state file UserPromptSubmit writes into TMPDIR, the
// line `engram serve` logs when SessionStart starts it, and the session row SessionStart posts to the store.
// Modes that take one of them away: safe-mode (the Windows Git Bash fast path of UserPromptSubmit: the state
// file but no prompt in the store), no-hook-state, no-server-log, other-port-log (the server it started
// listens on 7437), no-session-store, result-without-session-id (only the transcript's name has the id) and
// unknown-session-id (nothing has it). leak-session-engram and leak-session-tree (ok, and the session id is
// written into the fake real `.engram`, or the fake real `.claude`) are the leaks the session id must find.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [mode = 'ok', realHome, pidFile] = process.argv.slice(2);

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const prompt = Buffer.concat(chunks).toString('utf8');
const nonce = /nonce:([0-9a-f]{32})/.exec(prompt)?.[1] ?? 'no-nonce-in-the-prompt';
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

// `hang` reads the prompt and then does nothing, ever, before any request or write: the probe's timeout has to
// end it. (A stand-in that did its whole job and only then lingered would not test that.)
if (mode === 'hang') await new Promise(() => setInterval(() => {}, 1000));

if (mode === 'noisy') {
  console.error(`boom ${process.env.ANTHROPIC_API_KEY} ${nonce} ${process.env.CLAUDE_CODE_OAUTH_TOKEN ?? ''}`);
  process.exit(2);
}

/** What this stand-in's "Bash tool" prints: the same NAME=value lines the probe's shell command prints. */
const PRINTED = ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME',
  'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache', 'ANTHROPIC_BASE_URL', 'ENGRAM_PORT', 'ENGRAM_URL', 'ENGRAM_SOCKET'];
// In `wrong-env` the tools see a home that is not the sandbox's, and no TMPDIR: what a writer that ignores
// the sandbox's variables would show.
const seen = (name) => {
  if (mode === 'wrong-env' && name === 'HOME') return '/c/Users/someone-real';
  if (mode === 'wrong-env' && name === 'TMPDIR') return '';
  if (mode === 'wrong-engram-env' && name === 'ENGRAM_PORT') return '7437';
  if (mode === 'wrong-engram-env' && name === 'ENGRAM_URL') return 'http://127.0.0.1:7437';
  return process.env[name] ?? '';
};
const envLines = () => [...PRINTED.map((name) => `${name}=${seen(name)}`), `OAUTH_TOKEN_SET=${process.env.CLAUDE_CODE_OAUTH_TOKEN ? 'yes' : ''}`].join('\n');

// What Claude Code would load as memory. The sandbox's own CLAUDE.md (the current arm's seeded copy; the
// minimal arm has none) is loaded in every mode but `blind`; `loads-real` also loads the real one, as a
// workspace that has the real home above it would.
const readIfThere = (file) => (file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const memory = [
  mode === 'blind' || mode === 'side-call-only' || mode === 'subagent-only' ? '' : readIfThere(path.join(process.env.CLAUDE_CONFIG_DIR ?? '', 'CLAUDE.md')),
  mode === 'loads-real' ? readIfThere(path.join(realHome ?? '', '.claude', 'CLAUDE.md')) : '',
].filter(Boolean).join('\n\n');
const system = `a system prompt that mentions ${nonce}${memory ? `\n\n# claudeMd\n${memory}` : ''}`;

const sandboxMemory = readIfThere(path.join(process.env.CLAUDE_CONFIG_DIR ?? '', 'CLAUDE.md'));
// Only the arm with a seeded home has the plugin: its sandbox holds the `settings.json` the template copied.
const hasPlugin = fs.existsSync(path.join(process.env.CLAUDE_CONFIG_DIR ?? '', 'settings.json'));
// Every other MCP server of the seeded `.claude.json` is offered one tool, named the way Claude Code names a server's
// tools; `keeps-servers` offers context7's whatever the home holds, as a Claude Code that loaded a server from
// somewhere an arm did not cut would.
const servers = (() => {
  try {
    return Object.keys(JSON.parse(readIfThere(path.join(process.env.CLAUDE_CONFIG_DIR ?? '', '.claude.json')) || '{}').mcpServers ?? {});
  } catch {
    return [];
  }
})().filter((name) => name !== 'engram');
if (mode === 'keeps-servers' && hasPlugin && !servers.includes('context7')) servers.push('context7');
const TOOLS = [{ name: 'Bash' }, { name: 'Write' }, { name: 'Read' }, ...(hasPlugin ? [{ name: 'mcp__engram__mem_save' }, { name: 'Agent' }, ...servers.map((name) => ({ name: `mcp__${name}__ping` }))] : [])];
const post = async (messages, { model = 'claude-opus-5-5', system: sent = system, tools = TOOLS } = {}) => {
  const response = await fetch(`${process.env.ANTHROPIC_BASE_URL}/v1/messages?beta=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', authorization: `Bearer ${process.env.ANTHROPIC_API_KEY ?? ''}` },
    body: JSON.stringify({ model, max_tokens: 1024, stream: false, system: sent, tools, messages }),
  });
  if (!response.ok) throw new Error(`the fake API answered ${response.status}`);
  return response.json();
};

// `side-call-only`: the main requests carry no memory, but a small-model side call (a title, say) does.
if (mode === 'side-call-only') await post([{ role: 'user', content: 'title please' }], { model: 'claude-haiku-4-5', system: `title\n\n# claudeMd\n${sandboxMemory}`, tools: [] });

const writes = mode !== 'silent';
// The current arm's sandbox engram store. It is only a file named like the real database, appended to by the
// stand-in of whatever would write there (the plugin's hooks, the MCP server).
const engramStore = (text) => {
  if (!hasPlugin || !process.env.ENGRAM_DATA_DIR) return;
  fs.mkdirSync(process.env.ENGRAM_DATA_DIR, { recursive: true });
  fs.appendFileSync(path.join(process.env.ENGRAM_DATA_DIR, 'engram.db'), `${text}\n`);
};
const listening = (port) => new Promise((resolve) => {
  const socket = net.connect({ port, host: '127.0.0.1' });
  socket.once('connect', () => (socket.destroy(), resolve(true)));
  socket.once('error', () => resolve(false));
});
// `engram-server`: what SessionStart does when nothing answers, a detached `engram serve` that outlives this
// process. The stand-in refuses to default to 7437: with no port in the env it fails, it never guesses.
if (mode === 'engram-server') {
  const port = Number(process.env.ENGRAM_PORT);
  if (!Number.isInteger(port) || port === 7437) throw new Error(`ENGRAM_PORT=${JSON.stringify(process.env.ENGRAM_PORT)} is not a trial port`);
  // Started by an intermediate process that exits at once, as the hook's shell does after `engram serve &`: the
  // server's parent is then gone, which is what keeps the runner's walk down from the agent from reaching it.
  const intermediate = [
    "const { spawn } = require('node:child_process');",
    "const child = spawn(process.execPath, [process.argv[1]], { cwd: process.argv[2], detached: true, stdio: 'ignore', windowsHide: true });",
    'child.unref();',
  ].join('\n');
  const serverFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-engram-server.mjs');
  spawnSync(process.execPath, ['-e', intermediate, '--', serverFile, os.tmpdir()], { env: process.env, windowsHide: true });
  for (let attempt = 0; attempt < 100 && !(await listening(port)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
}
// Claude Code names the session and its transcript with one UUID. In `safe-mode` UserPromptSubmit takes the Windows
// Git Bash fast path: it writes its state file in TMPDIR and never posts the prompt.
const sessionId = crypto.randomUUID();
if (writes && hasPlugin) {
  if (mode !== 'no-server-log') {
    // What `engram serve` writes to the data directory's log when SessionStart starts it.
    const port = mode === 'other-port-log' ? 7437 : process.env.ENGRAM_PORT;
    fs.appendFileSync(path.join(process.env.ENGRAM_DATA_DIR, 'serve.err.log'), `2026/10/02 13:05:18 [engram] HTTP server listening on 127.0.0.1:${port}\n`);
  }
  if (mode !== 'no-session-store') engramStore(`session: ${sessionId} directory: ${process.cwd()}`); // SessionStart posts the session
  if (mode !== 'no-hook-state') write(path.join(process.env.TMPDIR, `engram-claude-${sessionId}-tools-loaded`), '');
  if (mode !== 'safe-mode') engramStore(`prompt: ${prompt}`); // UserPromptSubmit stores the prompt
}
const messages = [{ role: 'user', content: prompt }];
let turns = 0;
let text = '';
for (; turns < 6; turns += 1) {
  const reply = await post(messages);
  messages.push({ role: 'assistant', content: reply.content });
  const calls = reply.content.filter((block) => block.type === 'tool_use');
  text = reply.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
  if (calls.length === 0) break;
  const results = [];
  for (const call of calls) {
    let output = 'ok';
    if (call.name === 'Bash') {
      output = envLines();
      if (writes) {
        write(path.join(process.cwd(), 'probe-env.txt'), `${output}\n`);
        write(path.join(process.cwd(), 'probe-nonce.txt'), `${nonce}\n`);
      }
    } else if (call.name === 'Write' && writes) {
      write(call.input.file_path, call.input.content);
    } else if (call.name === 'mcp__engram__mem_save' && writes && mode !== 'prompt-only') {
      engramStore(`saved: ${call.input.content}`); // the MCP server writes to its own store
    } else if (call.name === 'Agent') {
      // The subagent is one more request to the API; the SubagentStop hook then stores what it said last.
      const sub = await post([{ role: 'user', content: call.input.prompt }], { tools: [{ name: 'Bash' }], ...(mode === 'subagent-only' && { system: `${system}\n\n# claudeMd\n${sandboxMemory}` }) });
      output = sub.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
      if (writes) engramStore(`subagent stop: ${output}`);
    }
    results.push({ type: 'tool_result', tool_use_id: call.id, content: [{ type: 'text', text: output }] });
  }
  messages.push({ role: 'user', content: results });
}

// `subagent` and `subagent-loads-real`: a subagent request on any arm (the real one is only started where the
// plugin offers the Agent tool), clean in the first, carrying the real global CLAUDE.md in the second.
if (mode === 'subagent' || mode === 'subagent-loads-real') {
  const real = mode === 'subagent-loads-real' ? readIfThere(path.join(realHome ?? '', '.claude', 'CLAUDE.md')) : '';
  await post([{ role: 'user', content: 'Isolation probe subagent: reply in one line.' }], { tools: [{ name: 'Bash' }], system: `${system}${real ? `\n\n# claudeMd\n${real}` : ''}` });
}

if (writes) {
  write(path.join(process.env.CLAUDE_CONFIG_DIR, 'projects', 'x', `${mode === 'unknown-session-id' ? 's' : sessionId}.jsonl`), `${JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } })}\n`);
  if (process.env.ENGRAM_DATA_DIR && !hasPlugin) write(path.join(process.env.ENGRAM_DATA_DIR, 'engram.db'), 'pretend sqlite');
  write(path.join(process.env.CLAUDE_CONFIG_DIR, 'history.jsonl'), '{"display":"probe"}\n');
}
if (mode === 'leak') write(path.join(realHome, '.claude', 'leaked.txt'), `a transcript line with ${nonce} in it\n`);
// `orphan`: ok, and a detached sleeper is left behind by an intermediate process that exits first, so its
// parent pid belongs to nobody. Its command line names the workspace and its cwd is the workspace, which on
// Windows keeps the directory from being removed: the codegraph MCP server of a seeded home. Its pid goes to
// the file named by the third argument.
if (mode === 'orphan') {
  const intermediate = [
    "const { spawn } = require('node:child_process');",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', process.argv[1]], { cwd: process.cwd(), detached: true, stdio: 'ignore', windowsHide: true });",
    'child.unref();',
    'console.log(child.pid);',
  ].join('\n');
  const started = spawnSync(process.execPath, ['-e', intermediate, '--', process.cwd()], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
  if (pidFile) fs.writeFileSync(pidFile, started.stdout.trim());
}
// `touch-json`, `leak-key` and `leak-key-workroot`: ok, and the fake real `.claude.json` is rewritten the way a
// live Claude Code session does (a counter bumped, a project entry added). `touch-json` adds an unrelated
// project, `leak-key` one named after the workspace (so after the sandbox and the work root), and
// `leak-key-workroot` one inside the work root but not in a sandbox. The value of every entry holds a
// sentinel that must never reach a report: only key names may.
if (mode === 'touch-json' || mode === 'leak-key' || mode === 'leak-key-workroot') {
  const file = path.join(realHome, '.claude.json');
  const json = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  json.numStartups = (json.numStartups ?? 0) + 1;
  const project = mode === 'touch-json' ? 'C:/unrelated/project' : mode === 'leak-key' ? process.cwd() : path.join(path.dirname(path.dirname(process.cwd())), 'another-project');
  json.projects = { ...json.projects, [project]: { history: ['KEYVALUE-SENTINEL-NEVER-PRINTED'] } };
  fs.writeFileSync(file, JSON.stringify(json));
}
// `late-leak`: ok, and a detached process (left by an intermediate that exits first, so nobody owns it) that
// names the workspace writes the nonce into the fake real `.claude` 2 s from now, after this agent has
// exited. Its pid goes to the file named by the third argument.
if (mode === 'late-leak') {
  const intermediate = [
    "const { spawn } = require('node:child_process');",
    'const [writer, ...rest] = process.argv.slice(1);',
    "const child = spawn(process.execPath, [writer, ...rest], { cwd: process.cwd(), detached: true, stdio: 'ignore', windowsHide: true });",
    'child.unref();',
    'console.log(child.pid);',
  ].join('\n');
  const writer = path.join(path.dirname(fileURLToPath(import.meta.url)), 'late-writer.mjs');
  const started = spawnSync(process.execPath, ['-e', intermediate, '--', writer, path.join(realHome, '.claude', 'late-leak.txt'), nonce, '2000', process.cwd()], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
  if (pidFile) fs.writeFileSync(pidFile, started.stdout.trim());
}
if (mode === 'leak-engram') write(path.join(realHome, '.engram', 'leak.db'), `a prompt with ${nonce} in it\n`);
// The session row of a SessionStart hook that posted to the real server holds the session id and neither the nonce
// nor the sandbox's name.
if (mode === 'leak-session-engram') write(path.join(realHome, '.engram', 'leak-session.db'), `a session row for ${sessionId}\n`);
if (mode === 'leak-session-tree') write(path.join(realHome, '.claude', 'leaked-session.txt'), `a session ${sessionId} in a real tree\n`);
if (mode === 'leak-path') write(path.join(realHome, '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'), 'session.json'), '{}\n');

const withSession = mode === 'result-without-session-id' || mode === 'unknown-session-id' ? {} : { session_id: sessionId };
console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text, num_turns: turns + 1, ...withSession, usage: { input_tokens: 1, output_tokens: 1 } }));

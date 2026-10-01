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
// side-call-only (blind, except that a small-model side call carries the sandbox copy), orphan (ok, and a
// detached process that names the workspace is left running), touch-json / leak-key / leak-key-workroot (ok,
// and the fake real `.claude.json` is rewritten: see below).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [mode = 'ok', realHome, pidFile] = process.argv.slice(2);

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const prompt = Buffer.concat(chunks).toString('utf8');
const nonce = /nonce:([0-9a-f]{32})/.exec(prompt)?.[1] ?? 'no-nonce-in-the-prompt';
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

if (mode === 'hang') setInterval(() => {}, 1000); // never answers: the probe's timeout has to end it

if (mode === 'noisy') {
  console.error(`boom ${process.env.ANTHROPIC_API_KEY} ${nonce} ${process.env.CLAUDE_CODE_OAUTH_TOKEN ?? ''}`);
  process.exit(2);
}

/** What this stand-in's "Bash tool" prints: the same NAME=value lines the probe's shell command prints. */
const PRINTED = ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME',
  'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache', 'ANTHROPIC_BASE_URL'];
// In `wrong-env` the tools see a home that is not the sandbox's, and no TMPDIR: what a writer that ignores
// the sandbox's variables would show.
const seen = (name) => (mode === 'wrong-env' && name === 'HOME' ? '/c/Users/someone-real' : mode === 'wrong-env' && name === 'TMPDIR' ? '' : process.env[name] ?? '');
const envLines = () => [...PRINTED.map((name) => `${name}=${seen(name)}`), `OAUTH_TOKEN_SET=${process.env.CLAUDE_CODE_OAUTH_TOKEN ? 'yes' : ''}`].join('\n');

// What Claude Code would load as memory. The sandbox's own CLAUDE.md (the current arm's seeded copy; the
// minimal arm has none) is loaded in every mode but `blind`; `loads-real` also loads the real one, as a
// workspace that has the real home above it would.
const readIfThere = (file) => (file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const memory = [
  mode === 'blind' || mode === 'side-call-only' ? '' : readIfThere(path.join(process.env.CLAUDE_CONFIG_DIR ?? '', 'CLAUDE.md')),
  mode === 'loads-real' ? readIfThere(path.join(realHome ?? '', '.claude', 'CLAUDE.md')) : '',
].filter(Boolean).join('\n\n');
const system = `a system prompt that mentions ${nonce}${memory ? `\n\n# claudeMd\n${memory}` : ''}`;

const sandboxMemory = readIfThere(path.join(process.env.CLAUDE_CONFIG_DIR ?? '', 'CLAUDE.md'));
const post = async (messages, { model = 'claude-opus-5-5', system: sent = system, tools = [{ name: 'Bash' }, { name: 'Write' }, { name: 'Read' }] } = {}) => {
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
const messages = [{ role: 'user', content: prompt }];
let turns = 0;
let text = '';
for (; turns < 6; turns += 1) {
  const reply = await post(messages);
  messages.push({ role: 'assistant', content: reply.content });
  const calls = reply.content.filter((block) => block.type === 'tool_use');
  text = reply.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
  if (calls.length === 0) break;
  const results = calls.map((call) => {
    let output = 'ok';
    if (call.name === 'Bash') {
      output = envLines();
      if (writes) {
        write(path.join(process.cwd(), 'probe-env.txt'), `${output}\n`);
        write(path.join(process.cwd(), 'probe-nonce.txt'), `${nonce}\n`);
      }
    } else if (call.name === 'Write' && writes) {
      write(call.input.file_path, call.input.content);
    }
    return { type: 'tool_result', tool_use_id: call.id, content: [{ type: 'text', text: output }] };
  });
  messages.push({ role: 'user', content: results });
}

if (writes) {
  write(path.join(process.env.CLAUDE_CONFIG_DIR, 'projects', 'x', 's.jsonl'), `${JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } })}\n`);
  if (process.env.ENGRAM_DATA_DIR) write(path.join(process.env.ENGRAM_DATA_DIR, 'engram.db'), 'pretend sqlite');
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
if (mode === 'leak-path') write(path.join(realHome, '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'), 'session.json'), '{}\n');

console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text, num_turns: turns + 1, usage: { input_tokens: 1, output_tokens: 1 } }));

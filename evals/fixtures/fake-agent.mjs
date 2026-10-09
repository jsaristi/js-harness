#!/usr/bin/env node
// A stand-in for `claude --print --output-format json` (and, in its `codex-*` modes, for `codex exec
// --json`), so the runner is proven end to end without a real model. The mode comes from the environment,
// because the runner owns the real agent's argv.
//
//   FAKE_AGENT_MODE    solve | noop | hang | hang-noisy | orphan | detached-quiet | orphan-by-path | cap | auth | cap-errors | auth-errors | exit | agent-error | soft-error | no-cost | garbage  (default noop)
//                      codex-solve | codex-noop | codex-cap | codex-auth | codex-failed | codex-incomplete: the same
//                      stand-in for `codex exec --json`, which prints an event per line instead (see `codexEvents`)
//                      codex-probe: obeys the prompt of `codex-isolation-probe.mjs` as a real Codex is asked to
//   FAKE_AGENT_PROBE_ACTS  for codex-probe, a comma-separated list of what it does besides, each the stand-in for
//                      one thing the probe must see: engram (saves the memory in the trial's engram store), utf16
//                      (writes its files as PowerShell 5.1 does), echo (repeats the nonce in its answer), echo-thread
//                      (repeats its thread id in its answer and on stderr), refresh (rewrites its own copy of the
//                      login), no-nonce (leaves the nonce file out), wrong-home (its shell reports the real
//                      CODEX_HOME), login (changes the real login), leak (writes the nonce, its thread id and a
//                      file named after the sandbox into the real home)
//   FAKE_AGENT_PROBE_ENV   for codex-probe, a JSON object of what its shell reports for a variable in place of
//                      the truth (`<HOME>` in a value is the home it was given)
//   FAKE_AGENT_REAL_HOME   for those acts, the fixture home that stands for the real one: never the machine's own
//   FAKE_AGENT_REPORT  path; a JSON report of what the agent saw is written there before it acts: the
//                      prompt, cwd, argv, the workspace entries and the whole environment it received
//   FAKE_AGENT_COUNT_FILE  path; one line is appended per run (a `--version` probe is not a run)
//   FAKE_AGENT_READ_FILE   path; its contents (or null) go into the report as `fileRead`, so a test can see
//                      from inside the agent what was prepared before it started
//   FAKE_AGENT_GIT_LOG     any value; the workspace's `git log` goes into the report as `gitLog`
//   FAKE_AGENT_TRANSCRIPTS path of a directory; its files are left as the session's transcripts, where Claude Code
//                      leaves its own: `<CLAUDE_CONFIG_DIR>/projects/<a name made from the cwd>/`. It needs
//                      CLAUDE_CONFIG_DIR and never falls back to a default, which would be the real `~/.claude`
//
// The reported environment holds the value of every variable except those whose name looks like a
// credential (TOKEN, KEY, SECRET, PASSWORD), which are replaced by a fixed marker: a real token in the
// developer's environment must never reach a report or a log file, whatever a test inspects.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

if (process.argv.includes('--version')) {
  console.log(process.env.FAKE_AGENT_VERSION ?? '9.9.9 (Fake Agent)');
  process.exit(0);
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const prompt = Buffer.concat(chunks).toString('utf8');

const { FAKE_AGENT_MODE: mode = 'noop', FAKE_AGENT_REPORT: reportPath, FAKE_AGENT_COUNT_FILE: countFile, FAKE_AGENT_READ_FILE: readFile } = process.env;
const cwd = process.cwd();

if (countFile) fs.appendFileSync(countFile, `${mode}\n`);

// With FAKE_AGENT_GIT_LOG set, the report holds the workspace's commits ("author <email> subject", one per
// line, newest first) as git prints them under the env this agent received, or null outside a repository.
const gitLogRequested = Boolean(process.env.FAKE_AGENT_GIT_LOG);
const gitLog = () => {
  const result = spawnSync('git', ['log', '--format=%an <%ae> %s'], { cwd, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim().split('\n') : null;
};

const SECRET_NAME =/TOKEN|KEY|SECRET|PASSWORD/i;
const redactedEnv = () => Object.fromEntries(Object.entries(process.env).map(([name, value]) => [name, SECRET_NAME.test(name) ? '<set>' : value]));

const report = {
  pid: process.pid,
  prompt,
  cwd,
  argv: process.argv.slice(2),
  mode,
  graderVisible: fs.existsSync(path.join(cwd, '.eval-grader')),
  entries: fs.readdirSync(cwd).sort(),
  testContext: process.env.NODE_TEST_CONTEXT ?? null,
  inherited: process.env.EVALS_TEST_INHERITED ?? null,
  kept: process.env.EVALS_TEST_KEPT ?? null,
  set: process.env.EVALS_TEST_SET ?? null,
  env: redactedEnv(),
  fileRead: readFile && fs.existsSync(readFile) ? fs.readFileSync(readFile, 'utf8') : null,
  gitLog: gitLogRequested ? gitLog() : null,
};

// The transcripts of the session, in every mode: a real session writes them as it goes, whatever way it ends.
if (process.env.FAKE_AGENT_TRANSCRIPTS) {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  if (!configDir) throw new Error('FAKE_AGENT_TRANSCRIPTS needs CLAUDE_CONFIG_DIR: the fake agent writes transcripts only where it is told to');
  fs.cpSync(process.env.FAKE_AGENT_TRANSCRIPTS, path.join(configDir, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-')), { recursive: true });
}

// Like the real result, `usage` is the main thread's; the cost, `modelUsage` and `subagent_stats` cover the session,
// a helper model's subagents included. `no-cost` leaves those three out.
const success = (result, { withCost = true } = {}) => JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result,
  num_turns: 3,
  duration_ms: 1234,
  usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 5 },
  ...(withCost ? {
    total_cost_usd: 0.75,
    modelUsage: {
      'fake-model': { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 30, cacheCreationInputTokens: 20, costUSD: 0.5 },
      'fake-helper-model': { inputTokens: 4, outputTokens: 6, cacheReadInputTokens: 8, cacheCreationInputTokens: 2, costUSD: 0.25 },
    },
    subagent_stats: { spawned: 2 },
  } : {}),
});
const failure = (result) => JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result, num_turns: 1 });
const errorsResult = (errors) => JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, num_turns: 0, errors });
const writeReport = () => {
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report));
};

// The Codex modes print what `codex exec --json` does: JSON Lines, one event per line, after a line that is
// no event (the CLI may print other text there). The event types and the fields of `usage` are the documented
// ones; `cached_input_tokens` is a part of `input_tokens`, and there is no cost. A failed turn is an `error`
// event and then a `turn.failed` with the same message, and no usage. The wording of the cap and login
// messages is ASSUMED, not observed from the real CLI.
const codexEvents = (...events) => ['Reading prompt from stdin...', ...[{ type: 'thread.started', thread_id: 'fake-thread' }, { type: 'turn.started' }, ...events].map((event) => JSON.stringify(event))].join('\n');
const codexSuccess = (text) => codexEvents(
  { type: 'item.completed', item: { id: 'item_0', type: 'reasoning', text: 'thinking' } },
  { type: 'item.started', item: { id: 'item_1', type: 'command_execution', command: 'node --test', status: 'in_progress' } },
  { type: 'item.completed', item: { id: 'item_1', type: 'command_execution', command: 'node --test', aggregated_output: '', exit_code: 0, status: 'completed' } },
  { type: 'item.completed', item: { id: 'item_2', type: 'agent_message', text } },
  { type: 'turn.completed', usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50, reasoning_output_tokens: 20 } },
);
const codexFailure = (message) => codexEvents({ type: 'error', message }, { type: 'turn.failed', error: { message } });

switch (mode) {
  case 'solve': {
    writeReport();
    const file = path.join(cwd, 'calc.mjs');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/export const mul = [\s\S]*$/, 'export const mul = (a, b) => a * b;\n'));
    console.log(success('done'));
    break;
  }
  case 'hang': {
    // A grandchild that also never ends: killing only this process would leave it running. On Windows
    // libuv puts an undetached child in a job that dies with its parent, which would hide a missing
    // tree kill, so there it is detached (and still reachable through its parent link and creation time).
    // On POSIX it stays in this process's group, which is what the runner kills.
    const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: process.platform === 'win32' });
    grandchild.unref();
    report.grandchildPid = grandchild.pid;
    writeReport();
    setInterval(() => {}, 1000);
    break;
  }
  case 'orphan': {
    // The root exits at once while a grandchild keeps this process's stdout open: a survivor holding
    // the pipes, reachable only through its dead parent's pid. Detached on Windows for the same reason
    // as in `hang`.
    const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform === 'win32' });
    grandchild.unref();
    report.grandchildPid = grandchild.pid;
    writeReport();
    console.log(success('orphaned'));
    break;
  }
  case 'orphan-by-path': {
    // A detached grandchild started by an intermediate process that exits first, so by the time the runner
    // looks its parent pid belongs to nobody and no walk down from the agent's pid can find it. Its command
    // line names a trial directory (the workspace, or the home with FAKE_AGENT_ORPHAN_ARG=home, which the
    // test supplies as FAKE_AGENT_HOME_ARG) and its cwd is the workspace, which on Windows keeps that
    // directory from being removed: the shape of the codegraph MCP server a seeded home leaves behind.
    const named = process.env.FAKE_AGENT_ORPHAN_ARG === 'home' ? process.env.FAKE_AGENT_HOME_ARG : cwd;
    const intermediate = [
      "const { spawn } = require('node:child_process');",
      "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', process.argv[1]], { cwd: process.cwd(), detached: true, stdio: 'ignore', windowsHide: true });",
      'child.unref();',
      'console.log(child.pid);',
    ].join('\n');
    const started = spawnSync(process.execPath, ['-e', intermediate, '--', named], { cwd, encoding: 'utf8', windowsHide: true });
    report.grandchildPid = Number(started.stdout.trim());
    writeReport();
    console.log(success('left a holder behind'));
    break;
  }
  case 'hang-noisy':
    // Logs cap-like text, then hangs: the timeout, not the text, is what ended this run.
    writeReport();
    fs.writeSync(2, 'API Error: rate limit exceeded, retrying\n');
    setInterval(() => {}, 1000);
    break;
  case 'detached-quiet': {
    // Exits normally but leaves a grandchild alive with every stdio ignored, so no pipe holds the run
    // open and only a sweep on close can find it.
    const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: process.platform === 'win32' });
    grandchild.unref();
    report.grandchildPid = grandchild.pid;
    writeReport();
    console.log(success('left one behind'));
    break;
  }
  case 'cap-errors':
    // The shape Claude Code writes for some failures: no `result`, the message in `errors`.
    writeReport();
    console.log(errorsResult(["You've hit your monthly spend limit"]));
    process.exitCode = 1;
    break;
  case 'auth-errors':
    writeReport();
    console.log(errorsResult(['Not logged in · Please run /login']));
    process.exitCode = 1;
    break;
  case 'soft-error':
    // An error result that still exits 0.
    writeReport();
    console.log(failure('Something else went wrong'));
    break;
  case 'cap':
    writeReport();
    console.log(failure("You've hit your monthly spend limit"));
    process.exitCode = 1;
    break;
  case 'auth':
    writeReport();
    console.log(failure('Not logged in · Please run /login'));
    process.exitCode = 1;
    break;
  case 'agent-error':
    writeReport();
    console.log(failure('Something else went wrong'));
    process.exitCode = 1;
    break;
  case 'exit':
    writeReport();
    console.error('boom');
    process.exitCode = 3;
    break;
  case 'no-cost':
    writeReport();
    console.log(success('did nothing', { withCost: false }));
    break;
  case 'garbage':
    writeReport();
    console.log('this is not json');
    break;
  case 'codex-solve': {
    writeReport();
    const file = path.join(cwd, 'calc.mjs');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/export const mul = [\s\S]*$/, 'export const mul = (a, b) => a * b;\n'));
    console.log(codexSuccess('done'));
    break;
  }
  case 'codex-noop':
    writeReport();
    console.log(codexSuccess('did nothing'));
    break;
  case 'codex-cap':
    writeReport();
    console.log(codexFailure("You've hit your usage limit. Try again later."));
    process.exitCode = 1;
    break;
  case 'codex-auth':
    // A CLI that is not logged in is assumed to end before its first event, with the reason on stderr only.
    writeReport();
    console.error('Error: Not logged in. Run `codex login` first.');
    process.exitCode = 1;
    break;
  case 'codex-failed':
    writeReport();
    console.log(codexFailure('Something else went wrong'));
    process.exitCode = 1;
    break;
  case 'codex-incomplete':
    // The thread and the turn start, and the process ends, exit 0, without the turn ever ending.
    writeReport();
    console.log(codexEvents());
    break;
  case 'codex-probe': {
    // Everything it knows comes from the prompt, as for a real agent: the names on the "Names:" line and the
    // nonce, the only 32 hex characters there. The sandbox is known by where it runs: `<sandbox>/workspace`.
    writeReport();
    const acts = new Set((process.env.FAKE_AGENT_PROBE_ACTS ?? '').split(',').filter(Boolean));
    const nonce = /\b[0-9a-f]{32}\b/.exec(prompt)?.[0] ?? '';
    const names = (/^Names: (.+)$/m.exec(prompt)?.[1] ?? '').split(',').map((name) => name.trim()).filter(Boolean);
    const realHome = process.env.FAKE_AGENT_REAL_HOME;
    const codexHome = process.env.CODEX_HOME;
    const threadId = crypto.randomUUID();
    // PowerShell 5.1 redirects into UTF-16LE with a byte order mark.
    const encoded = (text) => (acts.has('utf16') ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]) : text);
    const told = Object.fromEntries(Object.entries(JSON.parse(process.env.FAKE_AGENT_PROBE_ENV || '{}')).map(([name, value]) => [name, String(value).replaceAll('<HOME>', process.env.HOME)]));
    const seen = (name) => (acts.has('wrong-home') && name === 'CODEX_HOME' ? path.join(realHome, '.codex') : told[name] ?? process.env[name] ?? '');
    fs.writeFileSync(path.join(cwd, 'probe-env.txt'), encoded(names.map((name) => `${name}=${seen(name)}\r\n`).join('')));
    if (!acts.has('no-nonce')) fs.writeFileSync(path.join(cwd, 'probe-nonce.txt'), encoded(`${nonce}\r\n`));
    // Something Codex itself leaves in its home, whatever the real one turns out to write there.
    fs.writeFileSync(path.join(codexHome, 'version.json'), '{}\n');
    const items = [{ type: 'command_execution', command: `write probe-env.txt and ${nonce}`, aggregated_output: '', exit_code: 0, status: 'completed' }];
    if (acts.has('engram')) {
      // The shape of an MCP tool call item is ASSUMED (`server`, `tool`), not observed from the real CLI.
      fs.writeFileSync(path.join(process.env.ENGRAM_DATA_DIR, 'engram.db'), `a store\0memsave:${nonce}\0`);
      items.push({ type: 'mcp_tool_call', server: 'engram', tool: 'mem_save', status: 'completed' });
    }
    if (acts.has('refresh')) fs.appendFileSync(path.join(codexHome, 'auth.json'), 'refreshed');
    if (acts.has('login')) fs.appendFileSync(path.join(realHome, '.codex', 'auth.json'), 'refreshed');
    if (acts.has('leak')) {
      fs.writeFileSync(path.join(realHome, '.codex', 'history.jsonl'), `{"text":"${nonce}"}\n`);
      fs.appendFileSync(path.join(realHome, '.engram', 'engram.db'), `\0session ${threadId}\0`);
      fs.writeFileSync(path.join(realHome, '.gentle-ai', `${path.basename(path.dirname(cwd))}.json`), '{}\n');
    }
    const events = [
      { type: 'thread.started', thread_id: threadId },
      { type: 'turn.started' },
      ...items.map((item, index) => ({ type: 'item.completed', item: { id: `item_${index}`, ...item } })),
      { type: 'item.completed', item: { id: `item_${items.length}`, type: 'agent_message', text: ['PROBE-DONE', acts.has('echo') && nonce, acts.has('echo-thread') && threadId].filter(Boolean).join(' ') } },
      { type: 'turn.completed', usage: { input_tokens: 2000, cached_input_tokens: 1500, output_tokens: 80, reasoning_output_tokens: 30 } },
    ];
    console.error('fake codex: a line on stderr');
    if (acts.has('echo-thread')) console.error(`fake codex: thread ${threadId}`);
    console.log(['Reading prompt from stdin...', ...events.map((event) => JSON.stringify(event))].join('\n'));
    break;
  }
  default:
    writeReport();
    console.log(success('did nothing'));
}

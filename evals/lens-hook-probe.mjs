#!/usr/bin/env node
// The lens flag parity probe (F8 S5, spec 4, odd/tasks/f8-s5-rules.md; the reverse-engineering document, 13.3 row 2).
// A lens is a headless Claude run that must carry none of the user's customizations: `bin/lens-review.mjs` asks for that
// with `--safe-mode`, where the reviewer that document studied asks with `--setting-sources ""` and `--permission-mode dontAsk`, and
// nobody had shown that ours drops a user's hooks. This runs the lens's own arguments (`claudeArgs`) twice in a scratch
// `CLAUDE_CONFIG_DIR` that plants a user hook on every event, each writing its own marker, and a user `CLAUDE.md` that
// holds a nonce: once as the lens runs (the lens arm) and once without `--safe-mode` alone (the plain arm, the control
// that proves the planted hook is real). It spends nothing: the API is a loopback server in a child process that logs
// each request and answers 400, the key is a dummy and no login token is in the run's environment, so nothing reaches
// Anthropic and his own config is never read. It passes when the plain arm fires a hook and the lens arm fires none and
// sends no nonce while still reaching the API; whether the plain arm sent the nonce is said, as the control for the
// `CLAUDE.md` half.
//
//   node evals/lens-hook-probe.mjs [--keep]      exit 0 pass, 1 fail, 2 usage
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { claudeArgs, lensEnv } from '../bin/lens-review.mjs';
import { claudeRunner } from '../bin/lib/background.mjs';

/** The events a planted user hook listens on: the ones a tool-less headless run can reach. */
export const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'Stop', 'SessionEnd'];
const DUMMY_KEY = 'sk-ant-api03-DUMMY-lens-hook-probe-not-a-real-key';
// What a run started inside a Claude session inherits and must not: the session's own markers and every login.
const NOT_INHERITED = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SSE_PORT'];
const RUN_TIMEOUT_MS = 120_000;
const SETTLE_MS = 2_000;
const PROMPT = 'You are a probe. Reply with the single word ok.';
// The loopback API: logs each request's path and body, one JSON line each, and answers every one with a 400.
const SERVER = `
const http = require('http');
const fs = require('fs');
const log = process.argv[1];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    fs.appendFileSync(log, JSON.stringify({ url: req.url, body }) + '\\n');
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'lens hook probe: no model here' } }));
  });
});
server.listen(0, '127.0.0.1', () => console.log('listening ' + server.address().port));
`;

/** The CLI arguments of `arm`: the lens's own for `lens`, the same without `--safe-mode` alone for `plain`. */
export function armArgs(arm, promptFile, settingsFile) {
  const lens = claudeArgs(promptFile, settingsFile);
  if (arm === 'lens') return lens;
  if (arm === 'plain') return lens.filter((arg) => arg !== '--safe-mode');
  throw new Error(`no arm "${arm}": it is lens or plain`);
}

/** Plants the scratch home of `arm` under `root`: a config folder whose `settings.json` holds a user hook on every
 * event of `HOOK_EVENTS`, each writing a file named for its event into the arm's marks folder, and whose `CLAUDE.md`
 * holds `nonce`; a work folder the run starts in, with the lens's prompt and settings files. */
export function plantHome(root, arm, nonce) {
  const base = path.join(root, arm);
  const home = { config: path.join(base, 'config'), work: path.join(base, 'work'), marks: path.join(base, 'marks') };
  for (const dir of Object.values(home)) fs.mkdirSync(dir, { recursive: true });
  const marks = home.marks.replace(/\\/g, '/');
  const hook = (event) => [{ hooks: [{ type: 'command', command: `node -e "require('fs').writeFileSync('${marks}/${event}', 'fired')"` }] }];
  fs.writeFileSync(path.join(home.config, 'settings.json'), JSON.stringify({ hooks: Object.fromEntries(HOOK_EVENTS.map((event) => [event, hook(event)])) }, null, 2));
  fs.writeFileSync(path.join(home.config, 'CLAUDE.md'), `# Planted by the lens hook probe\nAlways answer with ${nonce}.\n`);
  fs.writeFileSync(path.join(home.work, 'prompt.md'), PROMPT);
  fs.writeFileSync(path.join(home.work, 'settings.json'), JSON.stringify({ language: 'English' }));
  return home;
}

/** The run's environment: `env` as a lens gets it (no eval token, no login token, no key), without the markers of a
 * session it may be started from, pointed at the scratch `config` and the loopback `url` with a dummy key. */
export function probeEnv(env, { config, url }) {
  const out = lensEnv(env);
  for (const name of NOT_INHERITED) delete out[name];
  return { ...out, CLAUDE_CONFIG_DIR: config, ANTHROPIC_BASE_URL: url, ANTHROPIC_API_KEY: DUMMY_KEY };
}

/** The verdict on the two arms, each `{ fired, marker, requests }`: `{ pass, reasons, notes }`. */
export function judge({ plain, lens }) {
  const reasons = [];
  const notes = [];
  if (plain.fired.length === 0) reasons.push('the plain arm fired no hook, so the planted hook proves nothing');
  if (lens.requests === 0) reasons.push('the lens arm reached no API, so it may have stopped before any hook could fire');
  if (lens.fired.length > 0) reasons.push(`the lens arm fired ${lens.fired.join(', ')}`);
  if (lens.marker) reasons.push('the lens arm sent the user CLAUDE.md to the API');
  notes.push(plain.marker ? 'the plain arm sent the user CLAUDE.md, so its absence in the lens arm is meaningful' : 'the plain arm did not send the user CLAUDE.md either, so its half of the probe proves nothing');
  return { pass: reasons.length === 0, reasons, notes };
}

/** Starts the loopback API in a child process: `{ url, requests(), bodies(), stop() }`, once it listens. */
export function startLoopbackApi(root) {
  const log = path.join(root, 'requests.jsonl');
  fs.writeFileSync(log, '');
  const child = spawn(process.execPath, ['-e', SERVER, log], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  const lines = () => fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return new Promise((resolve, reject) => {
    let said = '';
    child.once('error', reject);
    child.stdout.on('data', (chunk) => {
      said += chunk;
      const port = /listening (\d+)/.exec(said);
      if (port) resolve({ url: `http://127.0.0.1:${port[1]}`, requests: () => lines().length, bodies: () => lines().map((line) => line.body), stop: () => child.kill() });
    });
  });
}

/** Runs both arms and judges them: `{ arms: { plain, lens }, pass, reasons, notes }`. `startApi`, `run` and `nonce`
 * are for the tests; `run(args, { cwd, env, input })` defaults to the CLI as `claudeRunner` starts it for a lens. */
export async function runLensHookProbe({ root, startApi = startLoopbackApi, run, nonce = `LENS-PROBE-${crypto.randomBytes(8).toString('hex')}` }) {
  const api = await startApi(root);
  const arms = {};
  try {
    for (const arm of ['plain', 'lens']) {
      const home = plantHome(root, arm, nonce);
      const env = probeEnv(process.env, { config: home.config, url: api.url });
      const runner = run ?? ((args, options) => {
        const cli = claudeRunner({ env: options.env, timeout: RUN_TIMEOUT_MS });
        if (cli === null) throw new Error('the Claude CLI was not found on the PATH');
        return cli(args, { cwd: options.cwd, input: options.input });
      });
      const before = api.requests();
      const ran = runner(armArgs(arm, path.join(home.work, 'prompt.md'), path.join(home.work, 'settings.json')), { cwd: home.work, env, input: 'probe' });
      if (run === undefined) await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      const bodies = api.bodies().slice(before);
      arms[arm] = { fired: fs.readdirSync(home.marks).sort(), marker: bodies.some((body) => body.includes(nonce)), requests: bodies.length, status: ran.status };
    }
  } finally {
    api.stop();
  }
  return { arms, ...judge(arms) };
}

/** The command: one probe in a scratch folder, removed after unless `--keep`. */
export async function main(argv = process.argv.slice(2), { stdout = console.log, stderr = console.error } = {}) {
  const unknown = argv.filter((arg) => arg !== '--keep');
  if (unknown.length > 0) {
    stderr(`unknown argument: ${unknown[0]}\nUsage: node evals/lens-hook-probe.mjs [--keep]`);
    return 2;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-lens-probe-'));
  try {
    const report = await runLensHookProbe({ root });
    for (const [arm, said] of Object.entries(report.arms)) {
      stdout(`${arm.padEnd(5)}  exit ${said.status}  ${said.requests} requests  fired: ${said.fired.join(', ') || 'none'}  user CLAUDE.md sent: ${said.marker ? 'yes' : 'no'}`);
    }
    for (const note of report.notes) stdout(`note: ${note}`);
    stdout(report.pass ? 'PASS  a planted user hook fires without --safe-mode and not under the lens\'s flags' : `FAIL  ${report.reasons.join('; ')}`);
    return report.pass ? 0 : 1;
  } finally {
    if (argv.includes('--keep')) stdout(`kept: ${root}`);
    else fs.rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}

#!/usr/bin/env node
// The Codex isolation probe: runs ONE real `codex exec` session per arm under the eval sandbox, then proves
// the machine's real Codex, engram and gentle-ai state was untouched. Zero deps, plain Node. It is Claude's
// probe (`isolation-probe.mjs`) for the other host, and imports from it everything that does not care which
// agent ran: the nonce, the hashing, scanning and diffing of the real trees, the report's diff and scrub.
//
//   node evals/codex-isolation-probe.mjs --codex <absolute path of codex.exe> [--arm current|minimal|both]
//     [--model <id>] [--effort <word>] [--control-ms <n>] [--report <path>] [--raw-dir <path>]
//     [--keep-sandbox] [--timeout-ms <n>] [--max-login-age-hours <n>] [--work-root <abs>]
//
// What differs from Claude's probe, and why:
//  - THE MODEL IS REAL. Claude's probe scripts the agent from a loopback fake API; through a custom provider
//    Codex sends no tools and no base instructions (`odd/tasks/codex-parity.md`, Constraints), so a fake-API
//    trial would not be the session that is measured. Each arm is therefore one paid session on the real
//    login: exactly one agent process, never retried, and after an arm that failed the next one is not
//    started. The agent is asked, in a short literal prompt, to write its shell's environment and the nonce
//    into its workspace and to save one engram memory if it has the tool.
//  - THE AGENT IS DRIVEN AS A MEASURED TRIAL DRIVES IT: the config object of `codex-configs.mjs`, with its own
//    `prepare`, `args`, `env`, `reader` and `cleanup`, and the prompt on stdin. Not through `runTrial`, which
//    grades a task with a hidden grader, puts the home and the workspace in two unrelated directories (the
//    scan looks for ONE unique sandbox name) and hands back neither the raw run nor the sandbox before it is
//    removed.
//  - THE LOGIN IS A FILE. The real `auth.json` is never opened by a snapshot (size and date only). Once, after
//    the agent, it is compared with the trial's copy byte for byte in memory, and all the report says is
//    whether they are the same. A login old enough for Codex to refresh inside a trial refuses the run
//    (`assertLoginFresh`).
//  - EVEN `--version` RUNS IN THE SANDBOX. Every start of Codex writes into its `CODEX_HOME` (`tmp/arg0`), the
//    version probe included, so the version is read per arm under the trial's own env, as `runTrial` reads it.
//  - POSITIVE CONTROLS come from the workspace and the agent's own output, not from a request log: the reader
//    saw a completed turn, the environment file says every variable points into the sandbox, the nonce file
//    is there. An engram store the model never wrote to is a warning, since a real model may not call a tool.
// The nonce is never printed, logged or written to the report, which is scrubbed of it last; the thread id
// of each session is a needle too and is in no output either. The raw stdout and stderr that `--raw-dir`
// keeps do hold both: they are evidence, in a directory the scan is known not to read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCodexOutput } from './agent-output.mjs';
import { assertAgentCommand, codexCurrentConfig, codexMinimalConfig, codexSandboxEnv } from './codex-configs.mjs';
import { DEFAULT_MAX_LOGIN_AGE_HOURS, assertLoginFresh, buildCodexTemplate, codexHomeOf, removeCodexTemplate, seedFromCodexTemplate } from './codex-home.mjs';
import { assertWorkRoot, defaultWorkRoot } from './configs.mjs';
import {
  cap, defaultTrees, diffLines, diffSnapshots, errorMessage, findInStore, leakHits, makeNonce, makeScrubber, megabytes, parseEnvLines, reportDiff, scanFile, seconds,
  snapshotTrees, splitByControl, summarizeTop, walkFiles,
} from './isolation-probe.mjs';
import { exists, isWithin, resolveReal } from './paths.mjs';
import { REAL_ENGRAM_PORT, findProcesses, isListening as portIsListening } from './ports.mjs';
import { childEnv, killByPath, probeVersion, removeDir, resolveAgent, runProcess } from './runner.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Paths compare case-insensitively on Windows. */
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);

/** What the probe runs the agent as: the model and the lower effort of the F6 matrix. */
export const PROBE_MODEL = 'gpt-6.1-sol';
export const PROBE_EFFORT = 'medium';
/** The one word the agent is asked to answer with. */
export const PROBE_WORD = 'PROBE-DONE';
const ARMS = ['minimal', 'current'];
const ENV_FILE = 'probe-env.txt';
const NONCE_FILE = 'probe-nonce.txt';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SANDBOX_PREFIX = 'js-harness-codex-iso-probe-';
const TEMPLATE_PREFIX = 'js-harness-codex-iso-template-';

// ---- the prompt --------------------------------------------------------------------------------------

/** The variables the agent's shell is asked to report: every one `codexSandboxEnv` sets (read from it, so a
 * variable added there is checked here), then the two that must NOT be set, because either would send the
 * engram hooks to a server that is not the trial's. */
export function probeEnvNames(platform = process.platform) {
  const sample = codexSandboxEnv({ home: path.resolve('probe-env-names'), engramPort: 1024, inherited: {}, platform });
  return [...Object.keys(sample), 'ENGRAM_URL', 'ENGRAM_SOCKET'];
}

/** The needle of the memory the agent is asked to save, which is what the trial's engram store is searched for. */
const memoryNeedle = (nonce) => `memsave:${nonce}`;

/** The prompt of a trial. A real model reads it, so it is short and literal, and it says what each file must
 * hold rather than how to write it: Codex picks its own shell (PowerShell or cmd on Windows). The fake agent
 * of the tests reads the same two things a model does: the `Names:` line and the nonce. */
export function probePrompt(nonce, names = probeEnvNames()) {
  return [
    'This is an automated check of a sandbox. Do the four steps below, in order, and nothing else. Do not read, list or change any other file.',
    '',
    `1. Run one shell command that creates the file ${ENV_FILE} in the current directory. It must hold one line per name in the list below, each of the form NAME=value, where value is the current value of that environment variable in your shell, with nothing after the "=" when the variable is not set. No quotes, no other lines.`,
    `Names: ${names.join(', ')}`,
    `2. Create the file ${NONCE_FILE} in the current directory, holding exactly this text: ${nonce}`,
    `3. If you have a tool named mem_save from the engram MCP server, call it once with the title "isolation probe" and the content "${memoryNeedle(nonce)}". If you have no such tool, skip this step.`,
    `4. Reply with exactly: ${PROBE_WORD}`,
    '',
  ].join('\n');
}

// ---- the trees that must not change ------------------------------------------------------------------

/** The directories of the real `.codex` whose files are described by size and date instead of being read:
 * the desktop app's own binaries, which no session writes and whose content says nothing a date does not.
 * Measured here on 2026-10-05: 406 MB in `plugins/.plugin-appserver` and 1,708 MB in
 * `packages/app-server-daemon` (four releases of `codex.exe`), against 354 MB for all the rest of `.codex`.
 * With both hashed one pass over the real trees took 40 s on a warm file cache, and 31 s without them. A
 * file added there during a trial is not in the list, so it is read and scanned like any other. */
const STAT_ONLY_DIRS = ['plugins/.plugin-appserver', 'packages/app-server-daemon'];

/** The real places a Codex run, or a tool it starts, may write: every tree of Claude's probe (`defaultTrees`:
 * the hooks and MCP servers of a seeded home are the same engram, gentle-ai and codegraph under both hosts),
 * then Codex's own.
 *  - `.codex` is content-hashed and scanned, except the login (`auth.json`: the probe has no business
 *    reading one) and the files of `statOnlyDirs`, which are listed when the trees are built.
 *  - `AppData/Local/Codex` and `OpenAI`, and `AppData/Roaming/Codex`, are where the desktop app keeps its
 *    state, and `AppData/Local/engram` where the engram plugin's binary lives.
 *  - `.cache` is where the marketplace sources and runtimes Codex downloads go: size and date.
 *  - `AppData/Roaming` and the real temp folder are listed by name only: a new top-level entry is how a
 *    writer nobody listed would show up, and a name that holds a needle is a hit like any other.
 * A root that does not exist is fine: it is reported as missing, and as appeared if a trial creates it. */
export function codexTrees({ realHome, localAppData, appData, tempDir, statOnlyDirs = STAT_ONLY_DIRS }) {
  const codex = codexHomeOf(realHome);
  const unread = statOnlyDirs.flatMap((dir) => walkFiles(path.join(codex, ...dir.split('/'))).map((rel) => `${dir}/${rel}`));
  return [
    ...defaultTrees({ realHome, localAppData, tempDir }),
    { name: '.codex', root: codex, mode: 'content', statOnly: ['auth.json', ...unread] },
    { name: 'AppData/Local/Codex', root: path.join(localAppData, 'Codex'), mode: 'content' },
    { name: 'AppData/Local/OpenAI', root: path.join(localAppData, 'OpenAI'), mode: 'content' },
    { name: 'AppData/Local/engram', root: path.join(localAppData, 'engram'), mode: 'content' },
    { name: 'AppData/Roaming/Codex', root: path.join(appData, 'Codex'), mode: 'content' },
    { name: '.cache', root: path.join(realHome, '.cache'), mode: 'stat' },
    { name: 'AppData/Roaming (top level)', root: appData, mode: 'names' },
    { name: '%TEMP% (top level)', root: tempDir, mode: 'names' },
  ];
}

/** Throws when `rawDir` is somewhere a snapshot reads: the raw output of a session holds the nonce, the
 * sandbox's name and the thread id, so a scan that found them there would read as a leak. Inside a tree that
 * is hashed or stat-ed, anywhere; in one that is listed by name, the folder itself or a direct child of it. */
function assertRawDir(rawDir, trees) {
  if (typeof rawDir !== 'string' || !path.isAbsolute(rawDir)) throw new Error(`the raw output directory must be an absolute path, got ${JSON.stringify(rawDir)}`);
  const resolved = resolveReal(rawDir);
  const reads = ({ root, mode }) => {
    const real = resolveReal(root);
    return isWithin(real, resolved) && (mode !== 'names' || path.relative(real, resolved).split(path.sep).length === 1);
  };
  const tree = trees.find(reads);
  if (tree) throw new Error(`the raw output directory ${rawDir} is inside ${tree.root}, which is scanned (${tree.name}): the raw output holds the nonce, so the scan would find it there. Pass a directory outside the real home`);
}

// ---- looking inside the sandbox ----------------------------------------------------------------------

/** A text file as a shell may have written it: UTF-16LE with or without its byte order mark (PowerShell 5.1
 * redirects that way), or UTF-8. */
function decodeText(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.subarray(3).toString('utf8');
  return buffer.length >= 2 && buffer[0] !== 0 && buffer[1] === 0 ? buffer.toString('utf16le') : buffer.toString('utf8');
}

/** The variables whose value, as the agent's own shell printed it, must lie in the sandbox for the arm to
 * pass; the rest of what the sandbox sets is checked and reported, and a difference there is a warning (a
 * shell may rewrite a variable of its own, as Git Bash does with `TMP`). */
const REQUIRED_INSIDE = ['CODEX_HOME', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'ENGRAM_DATA_DIR'];
const ENV_FILE_LIMIT = 64 * 1024;

/** What the agent's shell said its environment is, against what the sandbox set (`codexSandboxEnv`): the
 * `lines` of the file for the names asked, and for each variable the sandbox sets a `check`: `same`, `inside`
 * (another spelling of a path that still holds the sandbox's unique name), `outside`, `differs` (not a path)
 * or `empty`. `problems` is what fails the arm, `warnings` the rest. Values compare as paths do: either
 * separator, any case on Windows, no trailing separator, no quotes. */
function inspectEnv({ workspace, home, token, port }) {
  let text;
  try {
    text = decodeText(fs.readFileSync(path.join(workspace, ENV_FILE)).subarray(0, ENV_FILE_LIMIT));
  } catch {
    return { file: 'missing', lines: {}, checks: {}, urlSet: null, socketSet: null, problems: [`the agent wrote no ${ENV_FILE}`], warnings: [] };
  }
  const parsed = parseEnvLines(text);
  const got = (name) => (parsed[name] ?? '').trim().replace(/^(["'])(.*)\1$/, '$2');
  const plain = (value) => fold(value.replaceAll('\\', '/').replace(/\/+$/, ''));
  const expected = codexSandboxEnv({ home, engramPort: port, inherited: {} });
  const checks = {};
  for (const [name, want] of Object.entries(expected)) {
    const isPath = fold(want).includes(fold(token));
    const value = got(name);
    if (value === '') checks[name] = 'empty';
    else if (plain(value) === plain(want)) checks[name] = 'same';
    else if (isPath) checks[name] = fold(value).includes(fold(token)) ? 'inside' : 'outside';
    else checks[name] = 'differs';
  }
  const problems = [];
  const warnings = [];
  const said = { empty: 'not set', outside: 'outside the sandbox', differs: 'not the value the sandbox set', inside: 'inside the sandbox under another path than the one set' };
  for (const [name, check] of Object.entries(checks)) {
    if (name === 'ENGRAM_PORT') continue;
    if (REQUIRED_INSIDE.includes(name) && (check === 'empty' || check === 'outside')) problems.push(`${name} is ${said[check]}`);
    else if (check !== 'same') warnings.push(`the agent's shell reports ${name} ${said[check]}`);
  }
  // A CODEX_HOME that only holds the sandbox's name could still be another directory of it.
  if (checks.CODEX_HOME === 'inside' && !plain(got('CODEX_HOME')).endsWith(plain(`/${token}/home/.codex`))) problems.push("CODEX_HOME is inside the sandbox but is not the trial's own");
  if (checks.ENGRAM_PORT !== 'same') {
    const value = got('ENGRAM_PORT');
    problems.push(`ENGRAM_PORT is ${value === '' ? 'not set' : value}${value === String(REAL_ENGRAM_PORT) ? ', where the real engram server listens' : ''}, not the trial's port ${port}`);
  }
  const urlSet = got('ENGRAM_URL') !== '';
  const socketSet = got('ENGRAM_SOCKET') !== '';
  if (urlSet) problems.push('ENGRAM_URL is set (value not shown): the engram hooks would reach that server');
  if (socketSet) problems.push('ENGRAM_SOCKET is set (value not shown): the engram hooks would reach that server');
  const lines = Object.fromEntries([...Object.keys(expected), 'ENGRAM_URL', 'ENGRAM_SOCKET'].map((name) => [name, name in parsed ? got(name) : null]));
  return { file: 'present', lines, checks, urlSet, socketSet, problems, warnings };
}

const MESSAGE_LIMIT = 500;

/** What the JSON Lines of `codex exec --json` hold, by name and count and never by content: how many events
 * of each type, how many completed items of each type, the MCP tools that were called (`server/tool`; the
 * shape of that item is ASSUMED, a call that has neither field is listed as `?/?`), and the message of every
 * `error` and `turn.failed` event, which is what a later task needs to know a real failure by. */
function tallyEvents(stdout) {
  const tally = { types: {}, items: {}, mcpCalls: [], errors: [] };
  for (const line of String(stdout).split('\n')) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue; // not an event: the CLI prints other text too
    }
    if (!isObject(event) || typeof event.type !== 'string') continue;
    tally.types[event.type] = (tally.types[event.type] ?? 0) + 1;
    if (event.type === 'item.completed' && typeof event.item?.type === 'string') {
      tally.items[event.item.type] = (tally.items[event.item.type] ?? 0) + 1;
      const name = (value) => (typeof value === 'string' ? value.slice(0, 80) : '?');
      if (event.item.type === 'mcp_tool_call') tally.mcpCalls.push(`${name(event.item.server)}/${name(event.item.tool)}`);
    }
    if (event.type === 'error' || event.type === 'turn.failed') {
      const message = event.error?.message ?? event.message ?? event.error;
      tally.errors.push({ type: event.type, message: typeof message === 'string' ? message.slice(0, MESSAGE_LIMIT) : null });
    }
  }
  return tally;
}

/** Whether the agent ran and was read as a session that completed, and if not, why, in words. */
function agentControl(run, reading, output) {
  const why = [];
  if (run.spawnError) why.push(`it could not be started (${run.spawnError.message})`);
  if (run.timedOut) why.push('it was killed at the timeout');
  else if (!run.spawnError && run.exitCode !== 0) why.push(`exit code ${run.exitCode ?? run.signal}`);
  if (!run.spawnError && !reading.parsed) why.push('it printed no event');
  if (reading.failed) why.push(output?.turnFailed ? 'a turn failed' : 'no turn completed');
  if (reading.stop) why.push(`the run was stopped by ${reading.stop.kind === 'cap' ? 'the usage cap' : 'the login'}`);
  return why.length === 0 ? { ok: true } : { ok: false, hint: `the agent did not complete its session: ${why.join(', ')}` };
}

/** Whether the trial's copy of the login still equals the real one: `unchanged`, `changed` or `missing`.
 * Both files are read whole and compared in memory, and nothing of them leaves this function: no hash, no
 * length, no text. A real login that cannot be read is `changed`, since the copy cannot be shown equal. */
function compareLoginCopy(authFile, home) {
  let copy;
  try {
    copy = fs.readFileSync(path.join(codexHomeOf(home), 'auth.json'));
  } catch {
    return 'missing';
  }
  let real = Buffer.alloc(0);
  try {
    real = fs.readFileSync(authFile);
    return copy.equals(real) ? 'unchanged' : 'changed';
  } catch {
    return 'changed';
  } finally {
    copy.fill(0);
    real.fill(0);
  }
}

/** The real login as a snapshot sees it: its size and date, or `missing`. */
const loginStamp = (authFile) => {
  const stat = fs.statSync(authFile, { throwIfNoEntry: false });
  return stat ? `${stat.size}:${stat.mtimeMs}` : 'missing';
};

/** The trial's home by size and date. Never by content: it holds the copy of the login. */
const homeSnapshot = (home) => snapshotTrees([{ name: 'home', root: home, mode: 'stat' }]);

/** Everything the probe learns from the sandbox once the agent has exited, written onto `result`. It runs
 * BEFORE the config's cleanup, which deletes the copy of the login. */
async function inspectSandbox({ p, result, run, config, root, home, workspace, token, prepared, seeded }) {
  const { o, nonce } = p;
  const reading = config.reader(run);
  const output = parseCodexOutput(run.stdout);
  // Known only now, and looked for in the real trees by the scan that follows; never logged or reported.
  if (output?.threadId) p.threadIds.push(output.threadId);
  const answer = typeof output?.result === 'string' ? output.result : null;
  result.agent = {
    parsed: reading.parsed, failed: reading.failed, stop: reading.stop ? { kind: reading.stop.kind, message: String(reading.stop.message).slice(0, MESSAGE_LIMIT) } : null,
    finalMessage: answer === null ? null : answer.slice(0, MESSAGE_LIMIT), answered: answer?.trim() === PROBE_WORD, threadId: output?.threadId ? 'found' : 'missing',
    usage: {
      turns: output?.turns.length ?? 0, inputTokens: reading.usage.inputTokens, cachedInputTokens: reading.usage.cachedInputTokens, outputTokens: reading.usage.outputTokens,
      reasoningOutputTokens: reading.usage.reasoningOutputTokens,
    },
  };
  result.events = tallyEvents(run.stdout);

  const { problems, warnings, ...env } = inspectEnv({ workspace, home, token, port: prepared?.engramPort });
  result.env = env;
  let nonceWritten = false;
  try {
    nonceWritten = (await scanFile(path.join(workspace, NONCE_FILE), [{ label: 'nonce', values: [nonce] }])).length > 0;
  } catch {
    // no such file: the control fails
  }
  result.controls = {
    agent: agentControl(run, reading, output),
    envFile: problems.length === 0 ? { ok: true } : { ok: false, hint: `the environment of the agent's shell is not the sandbox's: ${problems.join('; ')}` },
    nonceFile: nonceWritten ? { ok: true } : { ok: false, hint: `the agent wrote no ${NONCE_FILE} holding the nonce` },
  };
  result.warnings.push(...warnings);
  if (result.controls.agent.ok && !result.agent.answered) result.warnings.push(`the agent did not answer with the one word it was asked for (${PROBE_WORD}); its answer is in the report`);

  result.loginCopy = compareLoginCopy(p.authFile, home);
  if (result.loginCopy === 'changed') result.warnings.push('the trial rewrote its copy of the login, or the real one changed (a refresh): the real login may no longer be valid, so use the real Codex once and see that it still works');
  if (result.loginCopy === 'missing') result.warnings.push('the copy of the login was gone from the trial home when the agent exited');

  // The store by name, and whether it holds what the trial should have put there: the memory the tool saves,
  // or the prompt, which the hooks post and which holds the nonce.
  const store = path.join(home, '.engram');
  const db = walkFiles(store).find((rel) => /\.(db|sqlite3?)$/i.test(rel));
  const held = await findInStore(store, { memory: memoryNeedle(nonce), nonce });
  Object.assign(result.engram, { db: db === undefined ? null : `.engram/${db}`, memSave: held.memory !== null, nonce: held.nonce !== null, exercised: db !== undefined && (held.memory !== null || held.nonce !== null) });
  if (result.engram.applies && !result.engram.exercised) {
    const called = result.events.mcpCalls.length > 0 ? `MCP calls seen: ${result.events.mcpCalls.join(', ')}` : 'no MCP call seen';
    result.warnings.push(`engram was not exercised: the trial's store ${db === undefined ? 'was never created' : 'holds neither the memory nor the prompt'} (${called}), so this run does not show where an engram write of a trial lands; a real model may simply not have called the tool`);
  }

  // What the home gained since it was prepared, by name: the work of the trial's two Codex processes, the
  // version probe and the session.
  const changes = diffSnapshots(seeded, await homeSnapshot(home)).home;
  const inCodexHome = (rel) => rel.startsWith('.codex/');
  const part = (keep) => ({ created: cap(changes.added.filter(keep)), changed: cap(changes.changed.filter(keep)), removed: cap(changes.removed.filter(keep)) });
  result.sandbox = { kept: o.keepSandbox ? root : null, top: summarizeTop(home), codexHome: part(inCodexHome), elsewhere: part((rel) => !inCodexHome(rel)) };
}

// ---- one arm -----------------------------------------------------------------------------------------

/** One trial of one arm, built the way the eval builds it. Returns the arm's report and the real trees'
 * snapshot taken after it, which is the next arm's "before". `p` is the shared probe context. */
async function runArm(p, arm, before) {
  const { o } = p;
  const root = fs.mkdtempSync(path.join(o.workRoot, SANDBOX_PREFIX));
  const token = path.basename(root);
  p.tokens.push(token);
  const home = path.join(root, 'home');
  const workspace = path.join(root, 'workspace');
  const result = {
    arm, sandboxToken: token, failures: [], warnings: [], raw: null,
    engram: { applies: arm === 'current', port: null, db: null, exercised: false, memSave: false, nonce: false, listening: null, survivors: [] },
  };
  const cleanupFailures = [];
  const loginBefore = loginStamp(p.authFile);
  let config = null;
  let prepared;
  let isPrepared = false;
  let baseline = null;
  // What the agent left running under the sandbox (an MCP server holds its directory and may write to the
  // real trees on its own schedule): found by the path in its command line, and only under the work root.
  const sweepSandbox = () => {
    try {
      (o.sweep ?? killByPath)([root], { within: o.workRoot });
    } catch (err) {
      cleanupFailures.push(`could not sweep the processes of the sandbox: ${errorMessage(err)}`);
    }
  };
  const listEngram = async () => {
    try {
      return { list: await (o.listEngram ?? (() => findProcesses('engram')))() };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  };
  // The config's own cleanup (it deletes the copy of the login and kills what listens on the trial's engram
  // port, which the sweep by path cannot reach), then two facts the arm is judged by: nothing listens on
  // that port, and no engram process the trial started is still running.
  let stopped = false;
  const stopTrial = async () => {
    if (stopped || !isPrepared) return;
    stopped = true;
    try {
      await config.cleanup?.({ home, workspace, prepared });
    } catch (err) {
      cleanupFailures.push(`the cleanup of the trial failed: ${errorMessage(err)}`);
    }
    if (!prepared?.engramPort) return;
    result.engram.listening = await (o.isListening ?? portIsListening)(prepared.engramPort);
    const listed = await listEngram();
    if (listed.error) result.engram.listingError ??= listed.error;
    else if (baseline) result.engram.survivors = listed.list.filter((entry) => !baseline.has(entry.pid)).map((entry) => ({ pid: entry.pid, command: String(entry.command).slice(0, 200) }));
  };
  let swept = false;
  try {
    let run = null;
    let seeded = null;
    try {
      fs.mkdirSync(home);
      fs.mkdirSync(workspace);
      fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'the isolation probe workspace\n');
      config = o.adaptConfig(p.buildConfig(arm), { arm });
      prepared = await config.prepare({ home, workspace, effort: o.effort, task: undefined });
      isPrepared = true;
      result.engram.port = prepared?.engramPort ?? null;
      const listed = await listEngram();
      if (listed.error) result.engram.listingError = listed.error;
      else baseline = new Set(listed.list.map((entry) => entry.pid));
      seeded = await homeSnapshot(home);
      const agent = resolveAgent(config, { effort: o.effort, task: undefined, home, workspace, prepared });
      // Under the trial's own env, as a measured trial reads it, and never the real one: `codex --version`
      // itself writes into its CODEX_HOME (seen on 0.159.1: a fresh `tmp/arg0/codex-arg0*` directory with a
      // lock and two scripts, and the previous one removed). A binary that does not answer costs no session.
      result.codexVersion = await o.readVersion(config, agent.env);
      if (!result.codexVersion) throw new Error(`${config.command} --version printed nothing under the trial's environment: no session is started on a binary that cannot say what it is`);
      p.log(`${arm}: running the agent (one session, never retried)`);
      const began = performance.now();
      run = await runProcess({ ...agent, env: childEnv(agent.env), cwd: workspace, input: probePrompt(p.nonce), timeoutMs: o.timeoutMs });
      result.wallMs = Math.round(performance.now() - began);
    } catch (err) {
      result.error = errorMessage(err);
    }

    if (run) {
      Object.assign(result, { exitCode: run.exitCode, signal: run.signal, timedOut: run.timedOut, ...(run.spawnError && { spawnError: run.spawnError.message }), stderrTail: run.stderr.slice(-2000) });
      // First of all, and whole: whatever happens next, what the session printed is kept. A directory that
      // cannot be written fails the arm and nothing more: the session is paid for, so its report still comes.
      if (o.rawDir) {
        try {
          fs.mkdirSync(o.rawDir, { recursive: true });
          const files = { stdout: path.join(o.rawDir, `${arm}.stdout.log`), stderr: path.join(o.rawDir, `${arm}.stderr.log`) };
          fs.writeFileSync(files.stdout, run.stdout);
          fs.writeFileSync(files.stderr, run.stderr);
          result.raw = files;
        } catch (err) {
          cleanupFailures.push(`could not keep the raw output of the agent: ${errorMessage(err)}`);
        }
      }
      try {
        await inspectSandbox({ p, result, run, config, root, home, workspace, token, prepared, seeded });
      } catch (err) {
        result.error = `the sandbox could not be inspected: ${errorMessage(err)}`;
      }
    }

    // The sweep and the cleanup come BEFORE the snapshot that is scanned and diffed: a process the agent
    // left behind can write to a real tree after the agent exits. The real trees are checked even when the
    // arm failed, because a trial that died half way may already have leaked.
    swept = true;
    sweepSandbox();
    await stopTrial();
    result.realLogin = loginStamp(p.authFile) === loginBefore ? 'unchanged' : 'changed';
    p.log(`${arm}: checking the real trees`);
    return { result, after: await p.snapshot(`after:${arm}`, p.needles()) };
  } finally {
    if (!swept) sweepSandbox();
    await stopTrial();
    if (!o.keepSandbox) removeDir(root, 'sandbox', (message) => cleanupFailures.push(message), sweepSandbox);
    result.failures.push(...cleanupFailures);
  }
}

/** The failures of one arm: everything that makes its verdict "not proven isolated", as sentences. A plain
 * difference in the real trees is not one (live writers exist), and neither is a file that could not be
 * read, which is a warning. */
function armFailures(result) {
  const label = result.arm;
  const failures = result.failures.map((failure) => `${label}: ${failure}`);
  if (result.error) failures.push(`${label}: the trial could not run: ${result.error}`);
  for (const [name, control] of Object.entries(result.controls ?? {})) {
    if (!control.ok) failures.push(`${label}: positive control "${name}" failed: ${control.hint}. A trial that did not do this proves nothing by leaving the real trees clean`);
  }
  if (result.realLogin === 'changed') failures.push(`${label}: the real Codex login changed during the trial (its size or its date; its content is never read): use the real Codex once and see that it still works before any other run`);
  const { engram } = result;
  if (engram.port && engram.listening === true) failures.push(`${label}: something still listens on the trial's engram port ${engram.port} after the trial: an engram server it started was not stopped`);
  for (const entry of engram.survivors) failures.push(`${label}: an engram process that was not running before the trial is still running after it: pid ${entry.pid} (${entry.command})`);
  if (engram.listingError) failures.push(`${label}: inconclusive: the engram processes could not be listed (${engram.listingError}), so "no engram process of the trial is left" is unproven`);
  for (const hit of result.leak?.hits ?? []) failures.push(`${label}: LEAK: the real ${hit.tree} has ${hit.path} (${hit.via} holds the ${hit.found.join(' and the ')})`);
  return failures;
}

// ---- the probe ---------------------------------------------------------------------------------------

/** Runs the Codex isolation probe and resolves to its report (see the file's header for the method).
 *
 * Options (all but `codex` optional): `codex` is the absolute path of the real binary, never a `.cmd` shim;
 * `arms` is `['minimal', 'current']` by default, the cheaper one first; `model` and `effort`; `controlMs`,
 * the length of the no-agent window that measures live churn (0 skips it); `timeoutMs`, the agent's bound;
 * `maxLoginAgeHours` (`assertLoginFresh`); `rawDir`, where each arm's raw stdout and stderr are written;
 * `keepSandbox`. For tests and unusual machines: `commandArgs` (what comes before Codex's own arguments when
 * the command is a launcher), `workRoot` and `checkWorkRoot(root, { realHome })`, `realHome`, `localAppData`,
 * `appData` and `tempDir` (default: the real ones), `trees` (default `codexTrees`), `nonce`, `runInit` (passed
 * to the seed), `adaptConfig(config, { arm })`, `readVersion(config, env)` (default `probeVersion`),
 * `sweep`, `allocatePort`, `releasePort` and `killPort` (the config builders' seams), `isListening(port)`,
 * `listEngram()`, `wait(ms)`, `log(message)`, and `concurrency`, `chunkSize`, `openRead` and `retryDelayMs`
 * (how a real file is read).
 *
 * Before anything is created or spent, it throws unless the command is a real binary, the login exists and is
 * young enough, the work root is a place trials can run and the raw directory is not one the scan reads.
 * Then: the template of the real `.codex` is built once if the current arm runs (and removed whatever
 * happens), the real trees are snapshotted, and each arm reads `--version` in its own sandbox (an arm whose
 * binary does not answer fails there, with no session) and runs ONE agent process. An arm that fails ends
 * the run: the arms after it are listed in `skipped` and not started.
 *
 * `ok` is true only when every arm ran and, for each, the positive controls hold (the agent completed its
 * session, the environment file says the sandbox, the nonce file is there), no needle (the nonce, the
 * sandbox's name, the session's thread id) was found in a real tree, the real login kept its size and date,
 * and nothing was left listening or running. The report is scrubbed of the nonce before it is returned. */
export async function runCodexIsolationProbe(options) {
  const given = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
  const realHome = given.realHome ?? os.homedir();
  const o = {
    arms: ARMS,
    model: PROBE_MODEL,
    effort: PROBE_EFFORT,
    controlMs: 0,
    timeoutMs: 600_000,
    maxLoginAgeHours: DEFAULT_MAX_LOGIN_AGE_HOURS,
    keepSandbox: false,
    commandArgs: [],
    localAppData: process.env.LOCALAPPDATA ?? path.join(realHome, 'AppData', 'Local'),
    appData: process.env.APPDATA ?? path.join(realHome, 'AppData', 'Roaming'),
    tempDir: os.tmpdir(),
    adaptConfig: (config) => config,
    readVersion: probeVersion,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (message) => process.stderr.write(`${message}\n`),
    ...given,
    realHome,
  };
  assertAgentCommand(o.codex, '"codex"');
  if (!Array.isArray(o.arms) || o.arms.length === 0 || new Set(o.arms).size !== o.arms.length) throw new Error(`"arms" must be a list of different arms, got ${JSON.stringify(o.arms)}`);
  for (const arm of o.arms) if (!ARMS.includes(arm)) throw new Error(`unknown arm ${JSON.stringify(arm)}: use "minimal" or "current"`);
  if (typeof o.effort !== 'string' || !/^[A-Za-z0-9_-]+$/.test(o.effort)) throw new Error(`"effort" must be a plain word, got ${JSON.stringify(o.effort)}`);
  const authFile = path.join(codexHomeOf(realHome), 'auth.json');
  const login = assertLoginFresh(authFile, { maxAgeHours: o.maxLoginAgeHours });
  // The builder checks the command, the model and the login path; nothing is made by building a config.
  const configOptions = { command: o.codex, commandArgs: o.commandArgs, model: o.model, authFile, allocatePort: o.allocatePort, releasePort: o.releasePort, killPort: o.killPort };
  codexMinimalConfig(configOptions);
  // A work root inside the real home, or under project instructions, would put them above every workspace.
  const workRoot = o.workRoot ?? defaultWorkRoot({ repoRoot: REPO_ROOT });
  (o.checkWorkRoot ?? assertWorkRoot)(workRoot, { realHome });
  const trees = o.trees ?? codexTrees(o);
  if (o.rawDir !== undefined) assertRawDir(o.rawDir, trees);

  const workRootCreated = !exists(workRoot);
  fs.mkdirSync(workRoot, { recursive: true });
  try {
    return await probeUnder({ ...o, workRoot }, { authFile, login, configOptions, trees, workRootCreated });
  } finally {
    // Only a root this run made, and only when it is empty: never one that was there, never a kept sandbox.
    if (workRootCreated) {
      try {
        fs.rmdirSync(workRoot);
      } catch {
        // not empty (--keep-sandbox) or already gone
      }
    }
  }
}

/** The probe proper, once every check that costs nothing has passed. `o` is the resolved options. */
async function probeUnder(o, { authFile, login, configOptions, trees, workRootCreated }) {
  const nonce = o.nonce ?? makeNonce();
  const startedAt = new Date().toISOString();
  const began = performance.now();
  const hashing = [];
  const snapshot = async (label, needles = []) => {
    const taken = await snapshotTrees(trees, { needles, concurrency: o.concurrency, chunkSize: o.chunkSize, openRead: o.openRead, retryDelayMs: o.retryDelayMs });
    const all = Object.values(taken.trees);
    hashing.push({
      label, ms: taken.ms, files: all.reduce((total, tree) => total + tree.files.size, 0), bytes: all.reduce((total, tree) => total + tree.bytes, 0),
      unreadable: all.reduce((total, tree) => total + tree.unreadable.length, 0),
    });
    return taken;
  };
  // What a content tree does not read, said in the report so that "scanned" is not taken for "all of it".
  const unread = trees.filter((tree) => tree.statOnly?.length > 0).map((tree) => {
    const more = tree.statOnly.length > 2 ? ` and ${tree.statOnly.length - 2} more` : '';
    const why = tree.name === '.codex' ? ` (the login, and the desktop app's binaries under ${STAT_ONLY_DIRS.join(' and ')})` : '';
    return `${tree.name}: ${tree.statOnly.slice(0, 2).join(', ')}${more} described by size and date, never opened${why}`;
  });
  const report = {
    tool: 'codex-isolation-probe', startedAt, node: process.version, platform: process.platform, codex: o.codex, codexVersion: null, workRoot: o.workRoot, workRootCreated,
    config: { model: o.model, effort: o.effort }, login: { ageHours: Math.round(login.ageHours * 10) / 10, maxAgeHours: o.maxLoginAgeHours },
    trees: trees.map(({ name, mode, statOnly }) => ({ name, mode, ...(statOnly?.length > 0 && { statOnly: statOnly.length }) })), notes: unread,
    template: null, control: null, arms: [], skipped: [], hashing,
  };
  const tokens = [];
  const threadIds = [];
  let templateDir = null;
  const p = {
    o, nonce, authFile, tokens, threadIds, snapshot, log: o.log,
    buildConfig: (arm) => (arm === 'current' ? codexCurrentConfig({ ...configOptions, seed: seedFromCodexTemplate(templateDir, { runInit: o.runInit }) }) : codexMinimalConfig(configOptions)),
    // The nonce, the unique name of every sandbox so far (also lowercased, as a Windows tool may spell a
    // path) and the thread id of every session so far, which is what anything Codex or a hook records about
    // a session names. A thread id is known once its agent has run, so a scan before that has none.
    needles: () => [
      { label: 'nonce', values: [nonce] },
      { label: 'sandbox', values: [...new Set(tokens.flatMap((token) => [token, token.toLowerCase()]))] },
      ...(threadIds.length > 0 ? [{ label: 'thread id', values: [...new Set(threadIds.flatMap((id) => [id, id.toLowerCase(), id.toUpperCase()]))] }] : []),
    ],
  };

  const cleanupFailures = [];
  let templateParent = null;
  try {
    if (o.arms.includes('current')) {
      // Built once, before the first snapshot and the first paid session: a real config the build refuses
      // is found here, for nothing.
      templateParent = fs.mkdtempSync(path.join(o.workRoot, TEMPLATE_PREFIX));
      templateDir = path.join(templateParent, 'template');
      o.log('building the Codex home template from the real configuration (read only)');
      const built = buildCodexTemplate({ realHome: o.realHome, templateDir });
      report.template = { files: built.files, bytes: built.bytes, warnings: built.warnings };
    }
    o.log('hashing the real trees (before)');
    let before = await snapshot('before');
    let controlDiff = null;
    if (o.controlMs > 0) {
      o.log(`control window: waiting ${o.controlMs} ms with no agent running`);
      await o.wait(o.controlMs);
      const controlEnd = await snapshot('control');
      controlDiff = diffSnapshots(before, controlEnd);
      report.control = { ms: o.controlMs, diff: reportDiff(controlDiff) };
      before = controlEnd;
    }
    let failed = null;
    for (const arm of o.arms) {
      if (failed) {
        report.skipped.push({ arm, reason: `the ${failed} arm failed, and an arm is a real, paid trial: fix what failed, then run this arm` });
        continue;
      }
      const { result, after } = await runArm(p, arm, before);
      const diff = diffSnapshots(before, after);
      const unreadable = Object.entries(after.trees).flatMap(([tree, { unreadable: list }]) => list.map((entry) => `${tree}/${entry.path} (${entry.code})`));
      result.leak = { hits: leakHits(after, before), unreadable: cap(unreadable, 50), diff: reportDiff(diff) };
      if (controlDiff) {
        const split = splitByControl(diff, controlDiff);
        result.leak.fresh = reportDiff(split.fresh);
        result.leak.baseline = reportDiff(split.baseline);
      }
      if (unreadable.length > 0) result.warnings.push(`${unreadable.length} real file(s) could not be read, so they were not scanned for the nonce, the sandbox's name or the thread id (listed in the report)`);
      result.failures = armFailures(result);
      result.ok = result.failures.length === 0;
      report.arms.push(result);
      if (!result.ok) failed = arm;
      before = after;
    }
  } finally {
    // Always, also when the run dies: the template is a copy of the real setup.
    if (templateParent) {
      try {
        removeCodexTemplate(templateDir);
      } catch (err) {
        cleanupFailures.push(`could not remove the template: ${errorMessage(err)}`);
      }
      removeDir(templateParent, 'template directory', (message) => cleanupFailures.push(message));
      for (const message of cleanupFailures) o.log(message);
    }
  }

  report.codexVersion = report.arms.find((arm) => arm.codexVersion)?.codexVersion ?? null;
  report.failures = [...report.arms.flatMap((arm) => arm.failures), ...cleanupFailures];
  report.warnings = report.arms.flatMap((arm) => arm.warnings.map((warning) => `${arm.arm}: ${warning}`));
  report.ok = report.failures.length === 0 && report.skipped.length === 0 && report.arms.length === o.arms.length;
  report.wallMs = Math.round(performance.now() - began);
  return JSON.parse(makeScrubber(nonce)(JSON.stringify(report)));
}

// ---- the summary and the command line ------------------------------------------------------------------

const tallyText = (tally) => Object.entries(tally).map(([name, count]) => `${name} x${count}`).join(', ') || 'none';
const names = ({ count, paths }, limit = 12) => (count === 0 ? '' : `: ${paths.slice(0, limit).join(', ')}${count > limit ? `, and ${count - limit} more` : ''}`);

/** The human summary of a report: short, and safe to print, since the report is already scrubbed. */
export function formatSummary(report) {
  const lines = [];
  const hashed = report.hashing.reduce((total, entry) => ({ ms: total.ms + entry.ms, bytes: Math.max(total.bytes, entry.bytes), files: Math.max(total.files, entry.files) }), { ms: 0, bytes: 0, files: 0 });
  lines.push(`codex isolation probe: ${report.ok ? 'PASS' : 'FAIL'}`);
  lines.push(`codex ${report.codex} (${report.codexVersion ?? 'version not read'}) as ${report.config.model}, effort ${report.config.effort}; the login was last written ${report.login.ageHours} h ago (limit ${report.login.maxAgeHours} h)`);
  lines.push(`work root: ${report.workRoot} (${report.workRootCreated ? 'made by this run' : 'was there already'})`);
  lines.push(`real trees: ${report.hashing.length} passes in ${seconds(hashed.ms)}, ${hashed.files} files, ${megabytes(hashed.bytes)} content-hashed per pass (${report.hashing.map((entry) => `${entry.label} ${seconds(entry.ms)}`).join(', ')})`);
  for (const note of report.notes) lines.push(`  ${note}`);
  if (report.template) lines.push(`template of the real .codex: ${report.template.files} files, ${megabytes(report.template.bytes)}${report.template.warnings.length > 0 ? `; ${report.template.warnings.join('; ')}` : ''}`);
  if (report.control) {
    lines.push(`control window (${report.control.ms} ms, no agent), live writers changed:`);
    const control = diffLines(report.control.diff, '  ');
    lines.push(...(control.length > 0 ? control : ['  nothing']));
  }
  for (const arm of report.arms) {
    lines.push('', `arm ${arm.arm}: ${arm.ok ? 'ok' : 'FAILED'}, agent exit ${arm.exitCode ?? 'none'}${arm.timedOut ? ' (timed out)' : ''}${arm.wallMs === undefined ? '' : `, ${seconds(arm.wallMs)}`}`);
    if (arm.error) lines.push(`  error: ${arm.error}`);
    if (arm.agent) {
      const { usage } = arm.agent;
      lines.push(`  agent: ${usage.turns} turn(s) completed, input ${usage.inputTokens ?? '?'} tokens (${usage.cachedInputTokens ?? '?'} cached), output ${usage.outputTokens ?? '?'} (reasoning ${usage.reasoningOutputTokens ?? '?'}); answer ${arm.agent.finalMessage === null ? 'none' : JSON.stringify(arm.agent.finalMessage.slice(0, 120))}`);
      if (arm.agent.stop) lines.push(`  stopped by the ${arm.agent.stop.kind}: ${arm.agent.stop.message}`);
    }
    if (arm.events) {
      lines.push(`  events: ${tallyText(arm.events.types)}; items: ${tallyText(arm.events.items)}${arm.events.mcpCalls.length > 0 ? `; MCP calls: ${arm.events.mcpCalls.join(', ')}` : ''}`);
      for (const error of arm.events.errors) lines.push(`  ${error.type}: ${error.message ?? '(no message)'}`);
    }
    if (arm.stderrTail && !arm.ok) lines.push(`  agent stderr (tail): ${arm.stderrTail.trim().split('\n').slice(-5).join(' | ')}`);
    if (arm.controls) lines.push(`  positive controls: ${Object.entries(arm.controls).map(([name, control]) => `${name} ${control.ok ? 'ok' : 'FAILED'}`).join(', ')}`);
    if (arm.env?.file === 'present') {
      const checks = Object.entries(arm.env.checks);
      const off = checks.filter(([, check]) => check !== 'same');
      const line = (name) => `${name}=${arm.env.lines[name] ?? '(no line)'}`;
      lines.push(`  the agent's shell: ${checks.length - off.length} of ${checks.length} variables are as the sandbox set them; ${line('CODEX_HOME')}, ${line('ENGRAM_PORT')}`);
      for (const [name, check] of off) lines.push(`    !! ${line(name)} (${check})`);
      if (arm.env.urlSet || arm.env.socketSet) lines.push('    !! ENGRAM_URL or ENGRAM_SOCKET is set');
    } else if (arm.env) {
      lines.push("  the agent's shell: it wrote no environment file");
    }
    if (arm.loginCopy) lines.push(`  login: the trial's copy is ${arm.loginCopy}, the real one is ${arm.realLogin}`);
    else if (arm.realLogin) lines.push(`  login: the real one is ${arm.realLogin}`);
    if (arm.engram.port) {
      const e = arm.engram;
      const port = e.listening === true ? 'STILL LISTENING afterwards: FAILED' : e.listening === false ? 'nothing listens on it afterwards' : 'what listens on it was not checked';
      const processes = e.survivors.length > 0 ? `; ${e.survivors.length} engram process(es) of the trial left running: FAILED` : e.listingError ? '; engram processes could not be listed: INCONCLUSIVE' : ', and no engram process of the trial is left';
      lines.push(`  engram: port ${e.port}, ${port}${processes}`);
      lines.push(`  engram store of the trial: ${e.db ?? 'none'}; exercised: ${e.exercised}${e.exercised ? ` (${[e.memSave && 'the memory', e.nonce && 'the nonce'].filter(Boolean).join(', ')})` : ''}${e.applies ? '' : ' (the minimal arm has no engram)'}`);
    }
    if (arm.sandbox) {
      const { codexHome, elsewhere } = arm.sandbox;
      lines.push(`  CODEX_HOME gained ${codexHome.created.count} file(s)${names(codexHome.created)}`);
      lines.push(`  CODEX_HOME: ${codexHome.changed.count} changed${names(codexHome.changed)}; ${codexHome.removed.count} removed${names(codexHome.removed)}`);
      lines.push(`  elsewhere in the trial home: ${elsewhere.created.count} created${names(elsewhere.created)}; ${elsewhere.changed.count} changed${names(elsewhere.changed)}${arm.sandbox.kept ? `; kept at ${arm.sandbox.kept}` : ''}`);
    }
    if (arm.raw) lines.push(`  raw output: ${arm.raw.stdout} and ${path.basename(arm.raw.stderr)}`);
    for (const warning of arm.warnings) lines.push(`  warning: ${warning}`);
    if (arm.leak) {
      lines.push(`  leak scan of the real trees: ${arm.leak.hits.length === 0 ? 'nothing found' : `${arm.leak.hits.length} HIT(S)`}`);
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
  for (const { arm, reason } of report.skipped) lines.push('', `arm ${arm}: not run (${reason})`);
  if (report.failures.length > 0) lines.push('', 'failures:', ...report.failures.map((failure) => `  - ${failure}`));
  return `${lines.join('\n')}\n`;
}

const USAGE = `usage: node evals/codex-isolation-probe.mjs --codex <absolute path of codex.exe> [--arm current|minimal|both] [--model <id>] [--effort <word>]
  [--control-ms <n>] [--report <path>] [--raw-dir <path>] [--keep-sandbox] [--timeout-ms <n>] [--max-login-age-hours <n>] [--work-root <abs>]

Runs ONE real Codex session per arm (minimal first) under the eval sandbox, on the real login: each arm is a
paid trial, never retried, and an arm that fails ends the run. Then it checks the machine's real Codex, engram
and gentle-ai state was untouched.

--codex       the real binary, never the codex.cmd shim on PATH
--model       default ${PROBE_MODEL}; --effort default ${PROBE_EFFORT}
--control-ms  first wait this long with no agent, to tell live writers from the trial
--raw-dir     keep each arm's raw stdout and stderr there; it must be outside every tree the probe scans
--max-login-age-hours  refuse a login older than this (default ${DEFAULT_MAX_LOGIN_AGE_HOURS}): Codex would refresh it inside the trial
--work-root   where sandboxes and the template are built (default: js-harness-evals-work next to this repository)

Exit 0: every positive control held, nothing of the run was found in the real trees, the real login kept its
size and date, and nothing was left running. Exit 1: not so. Exit 2: bad usage, or the run could not start.`;

const DEFAULT_REPORT = fileURLToPath(new URL('./runs/codex-isolation-probe.json', import.meta.url));

class UsageError extends Error {}

function parseArgs(argv) {
  const options = { arm: 'both', report: DEFAULT_REPORT, keepSandbox: false, help: false };
  const value = (index, name) => {
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new UsageError(`${name} needs a value`);
    return argv[index + 1];
  };
  const integer = (text, name, least = 0) => {
    if (!/^\d+$/.test(text) || Number(text) < least) throw new UsageError(`${name} needs a ${least > 0 ? 'positive' : 'non-negative'} integer, got ${JSON.stringify(text)}`);
    return Number(text);
  };
  const absolute = (text, name) => {
    if (!path.isAbsolute(text)) throw new UsageError(`${name} must be an absolute path, got ${JSON.stringify(text)}`);
    return text;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') options.help = true;
    else if (flag === '--codex') options.codex = value(i++, flag);
    else if (flag === '--arm') options.arm = value(i++, flag);
    else if (flag === '--model') options.model = value(i++, flag);
    else if (flag === '--effort') options.effort = value(i++, flag);
    else if (flag === '--control-ms') options.controlMs = integer(value(i++, flag), flag);
    else if (flag === '--timeout-ms') options.timeoutMs = integer(value(i++, flag), flag);
    else if (flag === '--max-login-age-hours') options.maxLoginAgeHours = integer(value(i++, flag), flag, 1);
    else if (flag === '--report') options.report = path.resolve(value(i++, flag));
    else if (flag === '--raw-dir') options.rawDir = absolute(value(i++, flag), flag);
    else if (flag === '--work-root') options.workRoot = absolute(value(i++, flag), flag);
    else if (flag === '--keep-sandbox') options.keepSandbox = true;
    else throw new UsageError(`unknown argument ${JSON.stringify(flag)}`);
  }
  if (options.help) return options;
  try {
    assertAgentCommand(options.codex, '--codex');
  } catch (err) {
    throw new UsageError(err.message);
  }
  if (!['current', 'minimal', 'both'].includes(options.arm)) throw new UsageError(`--arm must be current, minimal or both, got ${JSON.stringify(options.arm)}`);
  if (options.effort !== undefined && !/^[A-Za-z0-9_-]+$/.test(options.effort)) throw new UsageError(`--effort must be a plain word, got ${JSON.stringify(options.effort)}`);
  return options;
}

/** The command line. Resolves to the exit code (0 pass, 1 fail, 2 usage or a run that could not start). `io`
 * is for tests: `stdout` and `stderr` writers, and `overrides`, options merged into
 * `runCodexIsolationProbe` (a fake home, the fake agent). Progress goes to stderr and never names the
 * sandbox: the output of a probe is often read back into a live session whose transcript the probe scans. */
export async function main(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, overrides = {} } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    stderr.write(`${err.message}\n${USAGE}\n`);
    return 2;
  }
  if (args.help) {
    stdout.write(`${USAGE}\n`);
    return 0;
  }
  const nonce = overrides.nonce ?? makeNonce();
  const { arm, report: reportFile, help, ...options } = args;
  let report;
  try {
    report = await runCodexIsolationProbe({ ...options, arms: arm === 'both' ? ARMS : [arm], log: (message) => stderr.write(`${message}\n`), ...overrides, nonce });
  } catch (err) {
    stderr.write(`the Codex isolation probe could not run: ${makeScrubber(nonce)(errorMessage(err))}\n`);
    return 2;
  }
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  stdout.write(formatSummary(report));
  stdout.write(`\nfull report: ${reportFile}\n`);
  return report.ok ? 0 : 1;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = await main();
}

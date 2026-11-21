#!/usr/bin/env node
// The load probe of the folder instruction files (odd/tasks/folder-instructions.md, spec 1): for each of the four, a
// fresh git fixture under a work root that has no project memory above it holds a copy of the file and one neighbour,
// a `claude -p` on claude-haiku-5-5 with the Read tool alone reads the neighbour, and the run's transcript must hold
// that Read, its result and the host's `nested_memory` attachment for the file. Evidence is the transcript, never the
// model's say-so. The child runs in a disposable `CLAUDE_CONFIG_DIR` inside the run folder, so it logs in with
// `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) or `ANTHROPIC_API_KEY`, and leaves nothing in the real profile.
// It spends tokens, four Haiku runs, so it runs only by hand:
//   node evals/folder-load-probe.mjs [--claude <path>] [--root <dir>]
//   exit 0 every file loaded, 1 a file did not load, 2 usage or setup, 3 a run was inconclusive
// Its pure parts run under `node --test`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FOLDER_INSTRUCTIONS } from '../bin/lib/claude-md-budget.mjs';
import { resolveClaude } from '../bin/lib/claude-path.mjs';
import { parseTranscript, projectSlug } from '../bin/lib/sessions.mjs';
import { quoteWindowsArg, windowsCommandLine } from '../bin/lib/windows-args.mjs';
import { assertWorkRoot, defaultWorkRoot } from './configs.mjs';
import { gitEnv } from './review/seeded.mjs';

const USAGE = 'Usage: node evals/folder-load-probe.mjs [--claude <path>] [--root <dir>]';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_TIMEOUT_MS = 300000;

/** The variables of a parent Claude session that must not reach the child: `CLAUDE_CODE_CHILD_SESSION` turns transcript
 * saving off (`evals/configs.mjs`), and the others make it a child of a session it is not. As `lens-hook-probe.mjs` drops them. */
const PARENT_MARKERS = /^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|CLAUDE_CODE_CHILD_SESSION|CLAUDE_CODE_SSE_PORT|CLAUDE_CODE_SESSION|CLAUDE_AGENT_SDK|CLAUDE_CONFIG_DIR)/i;

/** The folder files the host loaded in a transcript, as paths relative to `root` with forward slashes: one per
 * `nested_memory` attachment, in transcript order. */
export function nestedLoads(entries, root) {
  return entries
    .filter((entry) => entry.attachment?.type === 'nested_memory' && typeof entry.attachment.path === 'string')
    .map((entry) => path.relative(root, entry.attachment.path).split(path.sep).join('/'));
}

const blocks = (entry) => (Array.isArray(entry.message?.content) ? entry.message.content.filter((block) => block && typeof block === 'object') : []);

/** Whether the transcript holds a Read of `target` (relative to `root`) and a result for it that is no error. */
function readDone(entries, root, target) {
  const wanted = path.resolve(root, ...target.split('/'));
  const ids = new Set(entries.flatMap(blocks)
    .filter((block) => block.type === 'tool_use' && block.name === 'Read' && typeof block.input?.file_path === 'string' && path.resolve(root, block.input.file_path) === wanted)
    .map((block) => block.id));
  return entries.flatMap(blocks).some((block) => block.type === 'tool_result' && ids.has(block.tool_use_id) && block.is_error !== true);
}

/** The verdict on one run: `{ state, reason, loads }`, `state` one of LOADED, NOT LOADED and INCONCLUSIVE. `run` is what
 * `spawnSync` returned, `transcript` the transcript's text or `null`. A run that failed, left no usable transcript or did
 * not do the requested Read proves nothing either way, so it is inconclusive and says why. */
export function verdict({ file, run, transcript, root }) {
  const inconclusive = (reason) => ({ state: 'INCONCLUSIVE', reason, loads: [] });
  if (run.error) return inconclusive(`claude could not run: ${run.error.message}`);
  if (run.status !== 0) return inconclusive(`claude exited ${run.status}: ${String(run.stderr ?? '').trim().split(/\r?\n/)[0] || String(run.stdout ?? '').trim().split(/\r?\n/).pop() || 'no output'}`);
  if (transcript === null) return inconclusive('no transcript was written');
  const { entries, skipped } = parseTranscript(transcript);
  if (entries.length === 0) return inconclusive(`no usable transcript entry (${skipped} line${skipped === 1 ? '' : 's'} skipped)`);
  const target = `${path.posix.dirname(file)}/neighbour.txt`;
  if (!readDone(entries, root, target)) return inconclusive(`the transcript holds no successful Read of ${target}`);
  const loads = nestedLoads(entries, root);
  return { state: loads.includes(file) ? 'LOADED' : 'NOT LOADED', reason: '', loads };
}

/** The probe's options from `argv`: `{ help: true }`, `{ error }`, or `{ claude, root }` with both resolved against
 * `cwd`, the caller's folder, before anything changes folder; `null` where not given. */
export function parseArgs(argv, { cwd = process.cwd() } = {}) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const out = { claude: null, root: null };
  for (let at = 0; at < argv.length; at += 2) {
    const name = argv[at];
    if (name !== '--claude' && name !== '--root') return { error: `unknown argument: ${name}` };
    const value = argv[at + 1];
    if (value === undefined || value.startsWith('--')) return { error: `${name} needs a value` };
    out[name.slice(2)] = path.resolve(cwd, value);
  }
  return out;
}

/** How to start Claude: `{ path, shell }`, `shell` for a Windows `.cmd` or `.bat` shim that only a shell can start, or
 * `null` when no Claude is found. An explicit `claude` is taken as given (already resolved); otherwise PATH is read. */
export function launcher(claude, { env = process.env, platform = process.platform, exists } = {}) {
  if (claude === null) return resolveClaude({ env, platform, ...(exists && { exists }) });
  return { path: claude, shell: platform === 'win32' && /\.(cmd|bat)$/i.test(claude) };
}

/** The child's environment: `env` without the markers of a parent session or git's variables, pointed at `config`. */
export function childEnv(env, config) {
  const kept = Object.entries(gitEnv(env)).filter(([name]) => !PARENT_MARKERS.test(name) && !name.startsWith('GIT_CONFIG'));
  return { ...Object.fromEntries(kept), CLAUDE_CONFIG_DIR: config };
}

/** Makes `dir` a git repository, with git's own variables left out (`gitEnv`) so a hook's `GIT_DIR` cannot point the
 * init at the caller's repository. Throws when git cannot run or fails, before any paid call. */
export function gitFixture(dir, { spawn = spawnSync, env = process.env } = {}) {
  const result = spawn('git', ['init', '-q', '-b', 'main'], { cwd: dir, env: gitEnv(env), encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error(`git init failed in ${dir}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`git init failed in ${dir}: exited ${result.status}: ${String(result.stderr ?? '').trim()}`);
}

/** Removes the run folder, and `root` too only when the probe made it and it is empty: a caller's `--root` and anything
 * another process put in it stay. */
export function removeOwned({ root, run, madeRoot }) {
  fs.rmSync(run, { recursive: true, force: true });
  if (madeRoot) {
    try {
      fs.rmdirSync(root);
    } catch { /* not empty, or gone: it stays as it is */ }
  }
}

function spawnClaude(claude, args, options) {
  return claude.shell
    ? spawnSync(windowsCommandLine(quoteWindowsArg(claude.path), args), [], { ...options, shell: true })
    : spawnSync(claude.path, args, options);
}

function probe(file, { claude, run, env }) {
  const dir = fs.mkdtempSync(path.join(run, 'fixture-'));
  const config = fs.mkdtempSync(path.join(run, 'config-'));
  gitFixture(dir, { env });
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# fixture\n');
  const folder = path.join(dir, ...path.posix.dirname(file).split('/'));
  fs.mkdirSync(folder, { recursive: true });
  fs.copyFileSync(path.join(REPO, ...file.split('/')), path.join(folder, 'CLAUDE.md'));
  fs.writeFileSync(path.join(folder, 'neighbour.txt'), 'a neighbour\n');
  const target = `${path.posix.dirname(file)}/neighbour.txt`;
  const result = spawnClaude(claude, ['-p', `Read the file ${target} with the Read tool, then answer done.`, '--model', 'claude-haiku-5-5',
    '--setting-sources', 'project', '--output-format', 'stream-json', '--verbose', '--tools', 'Read', '--allowedTools', 'Read', '--max-turns', '4'],
  { cwd: dir, env: childEnv(env, config), encoding: 'utf8', windowsHide: true, timeout: RUN_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  let session = null;
  for (const line of String(result.stdout ?? '').split('\n')) {
    try {
      const event = JSON.parse(line);
      if (event.type === 'system' && event.subtype === 'init') session = event.session_id;
    } catch { /* not a JSON line */ }
  }
  const transcriptFile = session === null ? null : path.join(config, 'projects', projectSlug(dir), `${session}.jsonl`);
  const transcript = transcriptFile !== null && fs.existsSync(transcriptFile) ? fs.readFileSync(transcriptFile, 'utf8') : null;
  return { file, exit: result.status, ...verdict({ file, run: result, transcript, root: dir }) };
}

/** The command: four runs in a run folder of the work root, removed after. */
export function main(argv = process.argv.slice(2), { env = process.env, stdout = console.log, stderr = console.error } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    stdout(USAGE);
    return 0;
  }
  if (parsed.error) {
    stderr(`${parsed.error}\n${USAGE}`);
    return 2;
  }
  const claude = launcher(parsed.claude, { env });
  if (claude === null) {
    stderr(`claude is not on PATH; pass --claude <path>\n${USAGE}`);
    return 2;
  }
  const root = parsed.root ?? path.join(defaultWorkRoot({ repoRoot: REPO }), 'folder-load-probe');
  try {
    assertWorkRoot(root, { realHome: os.homedir() });
  } catch (error) {
    stderr(`${error.message}\npass --root <dir> outside the real home with no CLAUDE.md, AGENTS.md or .claude above it`);
    return 2;
  }
  const madeRoot = !fs.existsSync(root);
  fs.mkdirSync(root, { recursive: true });
  const run = fs.mkdtempSync(path.join(root, 'run-'));
  try {
    const rows = FOLDER_INSTRUCTIONS.map((file) => probe(file, { claude, run, env }));
    for (const row of rows) stdout(`${row.state}  ${row.file}  exit ${row.exit}  nested_memory: ${row.loads.join(', ') || 'none'}${row.reason ? `  (${row.reason})` : ''}`);
    if (rows.some((row) => row.state === 'INCONCLUSIVE')) return 3;
    return rows.every((row) => row.state === 'LOADED') ? 0 : 1;
  } catch (error) {
    stderr(error.message);
    return 2;
  } finally {
    removeOwned({ root, run, madeRoot });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main();
}

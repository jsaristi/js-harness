#!/usr/bin/env node
// The diet's measure (odd/tasks/workshop-product-split.md, "The build plan", slice D0). It reports what a fresh home
// and project, made by this checkout's own `install` and `init`, load in the diet's three measures, taken the same way
// before and after every cut:
// - the tokens of the texts they write;
// - the hook entries by event and owner;
// - each entry's time.
// Each hook is timed by running this checkout's `bin/js-harness.mjs` with the entry's arguments. It never runs the
// entry's own command line, which would run whatever `js-harness` is on PATH, the installed copy and not the change.
// Its home and project live in a temporary folder that it removes unless `--keep` is given; it writes nothing else.
//
//   node scripts/diet-measure.mjs [--runs <n>] [--json] [--keep]
//
// A timing delta under NOISE_FLOOR between two measures is "not shown", not "saved": three runs on one machine gave
// the same hook 5,954 ms here and 4,486 ms in a real session's transcript.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { percentile, timeRuns } from './reply-hook-time.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node scripts/diet-measure.mjs [--runs <n>] [--json] [--keep]';

/** The share a timing must move by between two measures before it counts as a change. */
export const NOISE_FLOOR = 0.2;

/** The arguments an entry's command gives `js-harness` (`js-harness guard --hook || exit 0` gives `guard --hook`),
 * or `null` for a command that does not run js-harness. */
export function hookArgs(command) {
  const words = command.split('||')[0].trim().split(/\s+/);
  return words[0] === 'js-harness' ? words.slice(1) : null;
}

/** The shell line that runs `args` with this checkout's dispatcher, under the node that runs this script. */
export function branchCommand(args, { repo = REPO_ROOT, node = process.execPath } = {}) {
  return [`"${node}"`, `"${path.join(repo, 'bin', 'js-harness.mjs')}"`, ...args].join(' ');
}

/** A closing reply of the shape a real one has, for the Stop input: the reply hook checks only a reply it is given,
 * so without one it would be timed on its fast path and not on the checks every real stop runs. */
const CLOSING_REPLY = 'Hice el cambio y corrí sus tests: pasan.\n\nSigo solo: esta sesión despierta cuando termine la revisión y te informa de sus hallazgos.';

/** A hook input of the shape Claude Code sends, enough for every js-harness entry to run its path: a tool call for
 * the tool events, a prompt for UserPromptSubmit, a start for SessionStart, a closing reply for Stop. */
export function hookInput(event, cwd) {
  return JSON.stringify({
    hook_event_name: event,
    session_id: 'diet-measure-0001',
    cwd,
    transcript_path: path.join(cwd, 'no-transcript.jsonl'),
    source: 'startup',
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    tool_response: {},
    prompt: 'hola',
    stop_hook_active: false,
    last_assistant_message: CLOSING_REPLY,
    agent_type: 'Explore',
  });
}

// What a calling session sets that would point a hook at its own files: the host's session paths and ids, the
// harness's own home and switches, and Codex's home. Hooks run without `--home`, so each would read or write there.
const INHERITED = /^(CLAUDE_|CLAUDECODE|JS_HARNESS_|CODEX_HOME$)/;

/** The environment the scratch home's commands and hooks run with: the caller's, with every variable of
 * `INHERITED` taken out and every home the harness or the host reads pointed into `home`. The caller's object is
 * not changed. */
export function scratchEnv(env, home) {
  const kept = Object.fromEntries(Object.entries(env).filter(([name]) => !INHERITED.test(name)));
  return {
    ...kept,
    HOME: home,
    USERPROFILE: home,
    JS_HARNESS_HOME: home,
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
  };
}

/** The `description:` of a skill's front matter, which Claude Code lists in every turn; '' when it has none. */
export function skillListing(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  return /^description:\s*(.*)$/m.exec(front)?.[1] ?? '';
}

/** The texts a home and a project hold, `{ part, file, tokens }` each, counted with the harness's own estimate:
 * the parts loaded on every turn (the home's and project's instruction files, the output style, the skills'
 * listings) and, apart, the skill bodies, loaded when a skill is used. */
export async function textTokens(home, cwd, { repo = REPO_ROOT } = {}) {
  const { estimateTokens } = await import(pathToFileURL(path.join(repo, 'bin', 'lib', 'payload.mjs')).href);
  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
  const parts = [];
  const add = (part, file, text) => {
    if (text !== null) parts.push({ part, file: path.relative(part.startsWith('project') ? cwd : home, file).split(path.sep).join('/'), tokens: estimateTokens(text) });
  };
  add('home instructions', path.join(home, '.claude', 'CLAUDE.md'), read(path.join(home, '.claude', 'CLAUDE.md')));
  const styles = path.join(home, '.claude', 'output-styles');
  for (const name of fs.existsSync(styles) ? fs.readdirSync(styles).sort() : []) add('output style', path.join(styles, name), read(path.join(styles, name)));
  add('project CLAUDE.md', path.join(cwd, 'CLAUDE.md'), read(path.join(cwd, 'CLAUDE.md')));
  add('project AGENTS.md', path.join(cwd, 'AGENTS.md'), read(path.join(cwd, 'AGENTS.md')));
  const skills = path.join(home, '.claude', 'skills');
  for (const name of fs.existsSync(skills) ? fs.readdirSync(skills).sort() : []) {
    const file = path.join(skills, name, 'SKILL.md');
    const text = read(file);
    if (text === null) continue;
    add('skill listing', file, skillListing(text));
    add('skill body', file, text);
  }
  return parts;
}

/** Runs `args` of this checkout's dispatcher in `cwd` with `home` as the home, and throws with its output on a failure. */
function harness(args, { repo, cwd, env }) {
  const ran = spawnSync(process.execPath, [path.join(repo, 'bin', 'js-harness.mjs'), ...args], { cwd, env, encoding: 'utf8', windowsHide: true });
  if (ran.status !== 0) throw new Error(`js-harness ${args.join(' ')} failed (${ran.status}): ${ran.stderr || ran.stdout}`);
}

/** The three measures, in a home and project made in a temporary folder by this checkout's `install` and `init`.
 * `runs` is how many times each hook entry is timed; the median of its runs is its time. */
export async function measure({ repo = REPO_ROOT, runs = 3, keep = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-diet-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(cwd);
  // Every home and session path points into the scratch folder, so every write stays there and his own are out of reach.
  const env = scratchEnv(process.env, home);
  try {
    const git = (args) => spawnSync('git', ['-c', 'user.name=diet', '-c', 'user.email=diet@example.invalid', ...args], { cwd, env, encoding: 'utf8' });
    git(['init', '-q']);
    git(['commit', '-q', '--allow-empty', '-m', 'init']);
    harness(['install', '--home', home], { repo, cwd, env });
    harness(['init', '--home', home], { repo, cwd, env });

    const { liveEntries, ownerOf } = await import(pathToFileURL(path.join(repo, 'bin', 'lib', 'hook-count.mjs')).href);
    const spawn = (command, options) => spawnSync(command, { ...options, cwd, env });
    const hooks = liveEntries(home, cwd).map((entry) => {
      const args = hookArgs(entry.command);
      if (!args) return { event: entry.event, owner: ownerOf(entry), command: entry.command, ms: null };
      const [result] = timeRuns([branchCommand(args, { repo })], hookInput(entry.event, cwd), runs, { spawn });
      const ms = result.times.length ? Math.round(percentile(result.times, 0.5)) : null;
      return { event: entry.event, owner: ownerOf(entry), command: entry.command, ms, failures: result.failures.length, stdoutChars: result.stdout.trim().length };
    });
    return { at: new Date().toISOString(), repo, runs, texts: await textTokens(home, cwd, { repo }), hooks, ...(keep ? { kept: root } : {}) };
  } finally {
    if (!keep) fs.rmSync(root, { recursive: true, force: true });
  }
}

/** The report's lines: the fixed tokens of a turn, the skill bodies, then each hook entry with its time. */
export function report({ texts, hooks, runs }) {
  const sum = (parts) => parts.reduce((total, part) => total + part.tokens, 0);
  const fixed = texts.filter((part) => part.part !== 'skill body');
  const bodies = texts.filter((part) => part.part === 'skill body');
  const lines = [`fixed tokens a turn: ${sum(fixed)}`];
  for (const part of fixed) lines.push(`  ${String(part.tokens).padStart(6)}  ${part.part}  ${part.file}`);
  lines.push(`skill bodies: ${sum(bodies)}`);
  for (const part of bodies) lines.push(`  ${String(part.tokens).padStart(6)}  ${part.file}`);
  lines.push(`hook entries: ${hooks.length} (median of ${runs} runs each)`);
  for (const hook of hooks) {
    const time = hook.ms === null ? 'not timed' : `${hook.ms} ms`;
    const extra = hook.failures ? `, ${hook.failures} failed runs` : '';
    lines.push(`  ${hook.event.padEnd(18)} ${hook.owner.padEnd(12)} ${time.padStart(9)}  ${hook.command}${extra}`);
  }
  lines.push(`a timing that moves less than ${NOISE_FLOOR * 100} % between two measures is not shown as a change`);
  return lines;
}

export function parseArgs(argv) {
  const options = { runs: 3, json: false, keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--keep') options.keep = true;
    else if (arg === '--runs') {
      const n = Number(argv[i + 1]);
      if (!Number.isInteger(n) || n < 1) throw new Error(`--runs takes a whole number from 1: ${argv[i + 1] ?? 'nothing'}\n${USAGE}`);
      options.runs = n;
      i += 1;
    } else throw new Error(`unknown argument: ${arg}\n${USAGE}`);
  }
  return options;
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    return 2;
  }
  const result = await measure(options);
  console.log(options.json ? JSON.stringify(result, null, 2) : report(result).join('\n'));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}

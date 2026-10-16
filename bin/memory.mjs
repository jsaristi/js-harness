#!/usr/bin/env node
// `memory`: the memory hygiene commands of odd/tasks/memory-hygiene.md, for the project's Claude Code
// memory folder (the main checkout's, so a worktree reads the same notes). `status` (T2) is the sensor:
// read-only, it says whether a pass is due and why; exit 0 when nothing is due or there is no memory
// folder, 1 when a pass is due. `plan`, `verify` and `undo` (T3) make a pass safe and undoable: the lock,
// the snapshot and the journal live under ~/.js-harness/memory-hygiene/<slug>, never in the memory folder;
// exit 0 when the step succeeded, 1 when it refused. Every command exits 2 on a usage error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hygieneState, INDEX_BYTES, journalPath, LINE_CHARS, memoryLocation, NOTE_BYTES, PASS_DAYS, readJournal, readMemory } from './lib/memory-hygiene.mjs';
import { PassError, planPass, undoPass, verifyPass } from './lib/memory-pass.mjs';
import { mainCheckout } from './lib/sessions.mjs';

const USAGE = `Usage: js-harness memory status [--json] [--history] [--cwd <path>] [--home <path>]
       js-harness memory plan <note>... [--cwd <path>] [--home <path>]
       js-harness memory verify <stamp> [--approved <note>[,<note>...]] [--cwd <path>] [--home <path>]
       js-harness memory undo <stamp> [--cwd <path>] [--home <path>]`;

// What each subcommand takes: how many positional arguments (`min`, `max`) and which flags beyond
// --cwd and --home, every one of which is refused elsewhere.
const SHAPES = {
  status: { min: 0, max: 0, bare: ['--json', '--history'], valued: [] },
  plan: { min: 1, max: Infinity, bare: [], valued: [] },
  verify: { min: 1, max: 1, bare: [], valued: ['--approved'] },
  undo: { min: 1, max: 1, bare: [], valued: [] },
};

class MemoryArgError extends Error {}

function parseArgs(argv) {
  const [subcommand, ...rest] = argv;
  const shape = SHAPES[subcommand];
  if (!shape) throw new MemoryArgError(subcommand === undefined ? 'a subcommand is required' : `unknown subcommand: ${subcommand}`);
  const parsed = { subcommand, args: [], flags: {} };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (['--cwd', '--home', ...shape.valued].includes(token)) {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith('--')) throw new MemoryArgError(`${token} requires a value`);
      parsed.flags[token.slice(2)] = value;
      i += 1;
    } else if (shape.bare.includes(token)) {
      parsed.flags[token.slice(2)] = true;
    } else if (token.startsWith('--')) {
      throw new MemoryArgError(`unknown argument: ${token}`);
    } else {
      parsed.args.push(token);
    }
  }
  if (parsed.args.length < shape.min || parsed.args.length > shape.max) throw new MemoryArgError(`memory ${subcommand}: wrong number of arguments`);
  return parsed;
}

/** Resolves a note's citations against the project's main checkout, as `check` does for a change:
 * a path by the lines of the file on disk, a commit by git. */
function resolvers(root, run) {
  const lineCount = (file) => {
    try {
      return fs.readFileSync(path.join(root, file), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).length;
    } catch {
      return null;
    }
  };
  const commitExists = (id) => {
    const result = run('git', ['cat-file', '-e', `${id}^{commit}`], { cwd: root });
    return !result.error && result.status === 0;
  };
  return { lineCount, commitExists };
}

/** The text of the repository's homes for his words, as `verify` searches them: the rule sources and
 * the project's rules (every string of their JSON), the roadmap and every feature document, read from the
 * checkout the command runs in, where a pass commits the words it moved. */
function homesText(root) {
  const parts = [];
  const strings = (value) => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []);
  for (const file of ['docs/rule-sources.json', 'docs/rules.json']) {
    try {
      parts.push(...strings(JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))));
    } catch {
      // A missing or unreadable file holds no words.
    }
  }
  const markdown = ['docs/ROADMAP.md'];
  try {
    markdown.push(...fs.readdirSync(path.join(root, 'odd', 'tasks')).filter((name) => name.endsWith('.md')).map((name) => path.join('odd', 'tasks', name)));
  } catch {
    // No feature documents.
  }
  for (const file of markdown) {
    try {
      parts.push(fs.readFileSync(path.join(root, file), 'utf8'));
    } catch {
      // A missing document holds no words.
    }
  }
  return parts.join('\n');
}

function renderStatus({ folder, memory, state, journal, history }) {
  const lines = [];
  const indexBytes = memory.index?.bytes ?? 0;
  lines.push(`memory  ${folder}  index ${indexBytes} B (budget ${INDEX_BYTES})  ${memory.index?.lines.length ?? 0} lines  ${memory.notes.length} notes`);
  lines.push(`memory hygiene: ${state.due ? 'due' : 'nothing due'}`);
  for (const reason of state.reasons) lines.push(`  ${reason.id}  ${reason.detail}`);
  if (state.candidates.length > 0) {
    lines.push('candidates for the pass (never a reason to be due):');
    for (const candidate of state.candidates) lines.push(`  ${candidate.id}  ${candidate.detail}`);
  }
  if (history) {
    const passes = journal.filter((entry) => entry.kind === 'verify');
    lines.push(passes.length === 0 ? 'history: no verified pass recorded yet' : 'history:');
    for (const pass of passes) lines.push(`  ${pass.at}  index ${pass.indexBytes} B  ${(pass.notes ?? []).length} notes`);
  }
  return lines;
}

function status({ home, project, slug, folder, flags, run, now, stdout }) {
  if (!fs.existsSync(folder)) {
    if (flags.json) stdout(JSON.stringify({ folder, due: false, reasons: [], candidates: [], na: true }, null, 2));
    else stdout(`memory hygiene: n/a (no memory folder at ${folder})`);
    return 0;
  }
  const memory = readMemory(folder);
  const journal = readJournal(journalPath(home, slug));
  const root = path.resolve(mainCheckout(run, project));
  const state = hygieneState({ memory, journal, now, ...resolvers(root, run) });
  if (flags.json) {
    const index = memory.index && { bytes: memory.index.bytes, lines: memory.index.lines.length };
    const notes = memory.notes.map(({ name, bytes, type }) => ({ name, bytes, type }));
    const budgets = { indexBytes: INDEX_BYTES, lineChars: LINE_CHARS, noteBytes: NOTE_BYTES, passDays: PASS_DAYS };
    const passes = journal.filter((entry) => entry.kind === 'verify');
    stdout(JSON.stringify({ folder, due: state.due, reasons: state.reasons, candidates: state.candidates, index, notes, budgets, lastPass: state.lastPass, ...(flags.history ? { history: passes } : {}) }, null, 2));
  } else {
    for (const line of renderStatus({ folder, memory, state, journal, history: flags.history })) stdout(line);
  }
  return state.due ? 1 : 0;
}

export async function memoryMain(
  argv,
  {
    cwd: defaultCwd = process.cwd(),
    home: defaultHome = os.homedir(),
    stdout = console.log,
    stderr = console.error,
    now = Date.now(),
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true }),
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { subcommand, args, flags } = parsed;
  const home = path.resolve(flags.home ?? defaultHome);
  const project = path.resolve(flags.cwd ?? defaultCwd);
  const { slug, folder } = memoryLocation({ home, project, run });
  const stateDir = path.dirname(journalPath(home, slug));

  if (subcommand === 'status') return status({ home, project, slug, folder, flags, run, now, stdout });

  try {
    if (!fs.existsSync(folder)) throw new PassError(`no memory folder at ${folder}`);
    if (subcommand === 'plan') {
      const { stamp } = planPass({ folder, stateDir, writeSet: args, now });
      stdout(`memory pass ${stamp} planned: the pass may change ${args.join(', ')}; then memory verify ${stamp}`);
      return 0;
    }
    if (subcommand === 'verify') {
      const top = run('git', ['rev-parse', '--show-toplevel'], { cwd: project });
      const root = !top.error && top.status === 0 ? path.resolve(top.stdout.trim()) : project;
      const approved = flags.approved ? flags.approved.split(',').map((name) => name.trim()).filter(Boolean) : [];
      const result = verifyPass({ folder, stateDir, stamp: args[0], homes: homesText(root), approved, now });
      if (result.ok) {
        stdout(`memory pass ${args[0]} verified: journaled, lock released (memory undo ${args[0]} undoes it)`);
        return 0;
      }
      stdout(`memory pass ${args[0]} refused; the after-state is recorded, so memory undo ${args[0]} works:`);
      for (const problem of result.problems) stdout(`  ${problem}`);
      return 1;
    }
    const result = undoPass({ folder, stateDir, stamp: args[0], now });
    stdout(`memory pass ${args[0]} undone: restored ${result.restored.join(', ') || 'nothing'}; removed ${result.removed.join(', ') || 'nothing'}${result.indexMerged ? '; the index kept the lines others added since' : ''}`);
    for (const refused of result.refused) stdout(`  left as it is: ${refused}`);
    return result.refused.length > 0 ? 1 : 0;
  } catch (err) {
    if (!(err instanceof PassError)) throw err;
    stderr(`js-harness memory ${subcommand}: ${err.message}`);
    return 1;
  }
}

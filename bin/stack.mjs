// `js-harness stack`: which of the tools the harness requires are missing on this machine for this project, in the
// order `stack install` runs them, each with its command and its exact undo; the person's own steps (gentle-ai's
// installer, logins, prerequisites) and the optional tools are named and never run. Read-only. See
// odd/tasks/stack-install.md (D5, D8). `js-harness stack install` runs those installs, each shown, then asked, then
// recorded before it starts so `uninstall machine` can undo it exactly (D4, D6, D7).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { unknownArgument } from './lib/args.mjs';
import { forgetStackRow, recordStackRow } from './lib/manifest.mjs';
import { realCodexHome } from './lib/codex-review-home.mjs';
import { resolveStackPm } from './lib/package-manager.mjs';
import { functionsOf, gitIn, harnessOfTree, workingTree } from './lib/project-functions.mjs';
import { planStack, prefixBinOf, RUNNABLE } from './lib/stack-install.mjs';
import { appliesOf, homeEnv, runWords, shownCommand, TIMEOUTS, withEnv } from './lib/stack-run.mjs';
import { probeStack, probeVersionCommand, resolveProjectRoot, tools } from './lib/stack.mjs';
import { harnessHome } from './lib/home.mjs';

export { resolveStackPm };

const USAGE = 'Usage: js-harness stack [--home <path>] [--cwd <path>] [--pm <command>] [--json]';
const KNOWN = { valued: ['--home', '--cwd', '--pm'], bare: ['--json'] };
const INSTALL_USAGE = 'Usage: js-harness stack install [--home <path>] [--cwd <path>] [--pm <command>] [--prefix <dir>] [--tool <id>]... [--yes]';
const INSTALL_KNOWN = { valued: ['--home', '--cwd', '--pm', '--prefix', '--tool'], bare: ['--yes'] };
/** The tools `stack install` runs rows of: what `--tool` may name. */
const RUNNABLE_TOOLS = [...new Set(RUNNABLE.map((row) => row.tool))];
const HELP = [
  USAGE,
  '  Read-only: the tools the harness requires that are missing here, each with its command and its exact undo.',
  INSTALL_USAGE,
  '  Runs those installs in that order, each printed with its undo and asked y/N in a terminal; without one, only',
  '  the tools --tool names, under --yes. Each is recorded before it starts, so uninstall machine undoes it.',
  `  --tool: ${RUNNABLE_TOOLS.join(', ')}`,
].join('\n');
const PREREQUISITES = ['git', 'gh'];

class StackArgError extends Error {}

function parseArgs(argv, env) {
  const unknown = unknownArgument(argv, KNOWN);
  if (unknown !== null) throw new StackArgError(`unknown argument: ${unknown}`);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    if (i === -1) return undefined;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new StackArgError(`${flag} requires a value`);
    return value;
  };
  return {
    home: harnessHome({ given: get('--home'), env, homedir: os.homedir }),
    cwd: get('--cwd') ?? process.cwd(),
    pm: get('--pm'),
    json: argv.includes('--json'),
  };
}

/** What the plan reads: the tool rows `probeStack` probes (its checks left out), the project's switches as `doctor`
 * resolves them, and the prerequisites' states. */
export function readStack({ home, cwd, spawn = spawnSync, platform = process.platform, env = process.env }) {
  const project = resolveProjectRoot(cwd, spawn);
  const { resolved: functions } = functionsOf(harnessOfTree(project), workingTree(gitIn(project, spawn)));
  const ids = new Set(tools.map((tool) => tool.id));
  const rows = probeStack({ home, project, spawn, platform, interactive: false, functions, env }).filter((r) => ids.has(r.id));
  const prerequisites = PREREQUISITES.map((id) => ({ id, state: probeVersionCommand(id, ['--version'], { spawn, platform }).state }));
  return { rows, functions, prerequisites };
}

/** A command as a person runs it: each word quoted where the shell would split or read it (Codex on 553900a..12e46c4). */
const shown = shownCommand;

/** The plan as the lines a person reads. */
function render(plan, platform) {
  const lines = [];
  const mandatoryLeft = plan.mandatory.length + plan.manual.length;
  lines.push(mandatoryLeft === 0
    ? 'js-harness stack: nothing the harness requires is missing.'
    : `js-harness stack: ${plan.mandatory.length} to install, ${plan.manual.length} of your own steps.`);
  if (plan.mandatory.length > 0) {
    lines.push('', 'Installs (stack install runs each one after you say yes, in this order):');
    plan.mandatory.forEach((item, i) => {
      lines.push(`  ${i + 1}. ${item.tool} ${item.dimension}`, `     run:  ${shown(item.run, platform)}`, `     undo: ${shown(item.undo, platform)}`);
    });
  }
  if (plan.manual.length > 0) {
    lines.push('', 'Your steps (never run):');
    for (const item of plan.manual) {
      lines.push(`  - ${item.tool} (${item.dimensions.join(', ')}): ${item.why}`);
      for (const step of item.steps) lines.push(`      ${step}`);
      for (const undo of item.undo) lines.push(`    undo: ${undo}`);
    }
  }
  if (plan.optional.length > 0) {
    lines.push('', 'Optional (never run):');
    for (const item of plan.optional) lines.push(`  - ${item.tool} (${item.dimensions.join(', ')}): ${item.steps.join('; ')}`);
  }
  return lines;
}

/** `js-harness stack`: exit 0 when nothing the harness requires is missing (optional gaps aside), 1 when something
 * is, 2 on a usage error. `deps.read` (default `readStack`) is the seam that probes the machine. */
export async function stackMain(argv, env = process.env, deps = {}) {
  const log = deps.log ?? ((line) => console.log(line));
  // `stack --help` and `stack install --help` print both forms and read nothing (user-guide S4).
  const asked = argv[0] === 'install' ? argv.slice(1) : argv;
  if (asked.length === 1 && (asked[0] === '--help' || asked[0] === '-h')) {
    log(HELP);
    return 0;
  }
  if (argv[0] === 'install') return stackInstallMain(argv.slice(1), env, deps);
  const error = deps.error ?? ((line) => console.error(line));
  let args;
  try {
    args = parseArgs(argv, env);
  } catch (err) {
    if (!(err instanceof StackArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const platform = deps.platform ?? process.platform;
  const read = deps.read ?? readStack;
  const { rows, functions, prerequisites } = read({ home: args.home, cwd: args.cwd, spawn: deps.spawn, platform, env });
  const plan = planStack({ rows, functions, prerequisites, pm: resolveStackPm(args.pm, env), platform });
  if (args.json) log(JSON.stringify(plan, null, 2));
  else for (const line of render(plan, platform)) log(line);
  return plan.mandatory.length + plan.manual.length === 0 ? 0 : 1;
}

function parseInstallArgs(argv, env) {
  const unknown = unknownArgument(argv, INSTALL_KNOWN);
  if (unknown !== null) throw new StackArgError(`unknown argument: ${unknown}`);
  const values = (flag) => argv.flatMap((token, i) => {
    if (token !== flag) return [];
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new StackArgError(`${flag} requires a value`);
    return [value];
  });
  const tools = values('--tool');
  const wrong = tools.find((tool) => !RUNNABLE_TOOLS.includes(tool));
  if (wrong !== undefined) throw new StackArgError(`--tool ${wrong}: stack install runs only ${RUNNABLE_TOOLS.join(' and ')}`);
  const yes = argv.includes('--yes');
  if (yes && tools.length === 0) throw new StackArgError('--yes runs only the tools --tool names: name each one the person said yes to');
  return {
    home: harnessHome({ given: values('--home')[0], env, homedir: os.homedir }),
    cwd: values('--cwd')[0] ?? process.cwd(),
    pm: values('--pm')[0],
    prefix: values('--prefix')[0] ?? null,
    tools,
    yes,
  };
}

/** Asks `question` on the terminal and resolves to whether the answer is `y`. */
function askOnTerminal(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim().toLowerCase() === 'y');
  }));
}

const keyOf = (row) => `${row.tool}.${row.dimension}`;

/** A row as the person reads it before saying yes: what it is, its command and its undo. */
const rowLines = (row, platform, head) => [head, `     run:  ${shownCommand(row.run, platform)}`, `     undo: ${shownCommand(row.undo, platform)}`];

/** `js-harness stack install` (D4-D7): each missing row of D2, in its order, is printed with its undo, then asked in a
 * terminal (`Run it? [y/N]`), or run under `--yes` when `--tool` names its tool. Without a terminal and without
 * `--yes` nothing runs. Its record is written before it starts; after it the stack is probed again, so a row an
 * earlier command closed is not run, a failure whose gap is still open loses its record, and one that closed it keeps
 * it with what its undo applies to, read back; a row is done only when the probe then reads it `ok`. A prefix's `bin`
 * is on the PATH of every probe and command, so what it installs is found; a registration in Codex while his
 * `CODEX_HOME` is elsewhere than `<home>/.codex`, which the probe and the record read, is left to him. Exit 0 when no
 * row it set out to run is left missing or unverified, 1 when one is (declined, failed, timed out or left to him), 2
 * on a usage error. `deps`: `read` (the probes), `spawn` (the runner, refused in a
 * test unless given), `ask`, `interactive`, `realHome`, `now`, `log`, `error`, `platform`. */
export async function stackInstallMain(argv, env = process.env, deps = {}) {
  const log = deps.log ?? ((line) => console.log(line));
  const error = deps.error ?? ((line) => console.error(line));
  let args;
  try {
    args = parseInstallArgs(argv, env);
  } catch (err) {
    if (!(err instanceof StackArgError)) throw err;
    error(`${err.message}\n\n${INSTALL_USAGE}`);
    return 2;
  }
  const platform = deps.platform ?? process.platform;
  const read = deps.read ?? readStack;
  const interactive = deps.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const ask = deps.ask ?? askOnTerminal;
  const now = deps.now ?? (() => new Date().toISOString());
  const pm = resolveStackPm(args.pm, env);
  // A scratch home and a prefix's `bin` reach every child, the probes included, and the record keeps them for the
  // undo (D6).
  const scratch = { ...homeEnv(args.home, deps.realHome ?? os.homedir(), platform), ...(args.prefix && { PATH: prefixBinOf(pm.kind, args.prefix, platform) }) };
  const readNow = () => read({ home: args.home, cwd: args.cwd, spawn: deps.spawn, platform, env: withEnv(env, scratch, platform) });
  const planOf = ({ rows, functions, prerequisites }) => planStack({ rows, functions, prerequisites, pm, prefix: args.prefix, platform });
  const planNow = () => planOf(readNow());
  // Codex writes its registrations where `CODEX_HOME` says; the probe and the record read `<home>/.codex`.
  const codexHome = realCodexHome(withEnv(env, scratch, platform), args.home, platform);
  const codexHomeRead = path.join(args.home, '.codex');
  const fold = (dir) => (platform === 'win32' ? path.resolve(dir).toLowerCase() : path.resolve(dir));
  const codexElsewhere = fold(codexHome) !== fold(codexHomeRead);
  const unverified = [];
  const chosen = (plan) => plan.mandatory.filter((row) => args.tools.length === 0 || args.tools.includes(row.tool));
  const missingIn = (plan, key) => chosen(plan).find((row) => keyOf(row) === key);
  const missing = (key) => missingIn(planNow(), key);

  const first = chosen(planNow());
  if (first.length === 0) {
    log('js-harness stack install: nothing to install.');
    return 0;
  }
  if (!interactive && !args.yes) {
    first.forEach((row, i) => rowLines(row, platform, `  ${i + 1}. ${row.tool} ${row.dimension}`).forEach((line) => log(line)));
    error('js-harness stack install runs nothing without a terminal: pass --yes with --tool <id> for each tool the person said yes to.');
    return 1;
  }

  for (const { tool, dimension } of first) {
    const row = missing(`${tool}.${dimension}`);
    if (!row) {
      log(`${tool} ${dimension}: no longer missing`);
      continue;
    }
    if (row.kind === 'registration' && dimension === 'codex' && codexElsewhere) {
      error(`${tool} ${dimension}: your CODEX_HOME is ${codexHome}, and js-harness reads ${codexHomeRead}; register it by hand: ${shownCommand(row.run, platform)}`);
      continue;
    }
    for (const line of rowLines(row, platform, `${tool} ${dimension}`)) log(line);
    if (!args.yes && !(await ask('Run it? [y/N] '))) {
      log(`${tool} ${dimension}: skipped`);
      continue;
    }
    const given = { ...scratch, ...row.env };
    const childEnv = withEnv(env, given, platform);
    const record = { tool, dimension, kind: row.kind, ...(row.bin && { bin: row.bin }), run: row.run, undo: row.undo, applies: null, env: given, at: now() };
    recordStackRow(args.home, record);
    // Codex refuses a `CODEX_HOME` that does not exist, and a fresh home has no `.codex` until Codex first ran (T4).
    // `codexElsewhere` is false here, so this is the folder Codex itself would make.
    if (row.kind === 'registration' && dimension === 'codex') fs.mkdirSync(codexHomeRead, { recursive: true });
    const result = runWords(row.run, { spawn: deps.spawn, env: childEnv, timeout: TIMEOUTS[row.kind], interactive: !args.yes, platform });
    const after = readNow();
    const stillMissing = Boolean(missingIn(planOf(after), `${tool}.${dimension}`));
    const state = after.rows.find((probed) => probed.id === tool)?.[dimension];
    if (result.timedOut) {
      // The shell is killed, not always what it started, which may still install: the record stays.
      unverified.push(record);
      error(`${tool} ${dimension}: ${result.why}, and what it started may still be running; it stays recorded, so uninstall machine judges it`);
      continue;
    }
    if (stillMissing && !result.ok) {
      // Nothing of it stayed, so nothing is undone: a later install of his own must never be (D7).
      forgetStackRow(args.home, record);
      error(`${tool} ${dimension} failed: ${result.why}`);
      continue;
    }
    if (!result.ok && state !== 'ok') {
      // Something of it may have stayed: the record stays, and uninstall machine keeps it until it can read it.
      unverified.push(record);
      error(`${tool} ${dimension}: the command failed (${result.why}) and the probe cannot tell what it left; it stays recorded, so uninstall machine judges it`);
      continue;
    }
    recordStackRow(args.home, { ...record, applies: appliesOf(row, { home: args.home, spawn: deps.spawn, platform, env: childEnv }).value });
    if (stillMissing) error(`${tool} ${dimension}: the command exited 0 and the probe still finds it missing; it stays recorded, so uninstall machine tries its undo`);
    else if (state === 'ok') log(`${tool} ${dimension}: done`);
    else {
      unverified.push(record);
      error(`${tool} ${dimension}: the command exited 0 and the probe cannot tell whether it worked; it stays recorded, so uninstall machine judges it`);
    }
  }
  const left = chosen(planNow()).filter((row) => first.some((was) => keyOf(was) === keyOf(row)));
  return left.length === 0 && unverified.length === 0 ? 0 : 1;
}

// `js-harness stack`: which of the tools the harness requires are missing on this machine for this project, in the
// order `stack install` runs them, each with its command and its exact undo; the person's own steps (gentle-ai's
// installer, logins, prerequisites) and the optional tools are named and never run. Read-only. See
// odd/tasks/stack-install.md (D5, D8).
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unknownArgument } from './lib/args.mjs';
import { copyPackageManager, shownWord } from './lib/package-manager.mjs';
import { functionsOf, gitIn, harnessOfTree, workingTree } from './lib/project-functions.mjs';
import { planStack } from './lib/stack-install.mjs';
import { probeStack, probeVersionCommand, resolveProjectRoot, tools } from './lib/stack.mjs';
import { pmKind, splitCommand } from './lib/version.mjs';

const USAGE = 'Usage: js-harness stack [--home <path>] [--cwd <path>] [--pm <command>] [--json]';
const KNOWN = { valued: ['--home', '--cwd', '--pm'], bare: ['--json'] };
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
    home: get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir(),
    cwd: get('--cwd') ?? process.cwd(),
    pm: get('--pm'),
    json: argv.includes('--json'),
  };
}

/** The package manager of the installs, resolved as `upgrade` resolves it: `--pm`, else `JS_HARNESS_PM`, else the one
 * that installed the running copy. Never read from the word `npm` on the path, which may run pnpm (odd/tasks/stack-install.md, D6).
 * A command line is split into its words, unless the whole line names a file: a path with a space in it stays one word
 * (Codex on 12e46c4..6a2b0ad). `exists` is the seam that looks. */
export function resolveStackPm(pm, env, copyPath = fileURLToPath(import.meta.url), exists = fs.existsSync) {
  const command = pm ?? env.JS_HARNESS_PM ?? copyPackageManager(copyPath);
  const line = command.trim();
  const words = /\s/.test(line) && exists(line) ? [line] : splitCommand(line);
  return { words, kind: pmKind(words) };
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
const shown = (list, platform) => list.map((word) => shownWord(word, platform)).join(' ');

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

// The plan of the stack install: which of the tools the harness requires are missing, which of those this module
// runs (each with its exact undo), which are the person's own steps, and which are optional. Pure: it reads the rows
// `probeStack` already probed and the switches `functionsOf` resolved, and spawns nothing. See
// odd/tasks/stack-install.md (D1-D3).
import path from 'node:path';
import { GAP_STATES } from './digest.mjs';
import { installPlan } from './version.mjs';

/** The dimensions of a machine install: `upToDate` is `update`'s and `project` is `init`'s (D1). */
const MACHINE = ['installed', 'claude', 'codex'];

const offIn = (functions, name) => functions?.[name]?.value === 'off';
const codexWanted = (functions) => !offIn(functions, 'codexReview');
const codeMapWanted = (functions) => !offIn(functions, 'codeMap');

/** The hosted context7 server, as doctor's fix names it (bin/lib/stack.mjs). */
const CONTEXT7_URL = 'https://mcp.context7.com/mcp';

/** The rows the module runs, in the order it runs them (D2): the Codex CLI first, so a registration in Codex has a
 * Codex to register in. A row is runnable only while `wanted` holds for the project's switches. */
export const RUNNABLE = [
  { tool: 'codex', dimension: 'installed', kind: 'package', spec: '@openai/codex', bin: 'codex', wanted: codexWanted },
  { tool: 'codegraph', dimension: 'installed', kind: 'package', spec: '@colbymchenry/codegraph', bin: 'codegraph', wanted: codeMapWanted },
  {
    tool: 'codegraph',
    dimension: 'claude',
    kind: 'registration',
    run: ['claude', 'mcp', 'add', '-s', 'user', 'codegraph', '--', 'codegraph', 'serve', '--mcp'],
    undo: ['claude', 'mcp', 'remove', '-s', 'user', 'codegraph'],
    wanted: codeMapWanted,
  },
  {
    tool: 'codegraph',
    dimension: 'codex',
    kind: 'registration',
    run: ['codex', 'mcp', 'add', 'codegraph', '--', 'codegraph', 'serve', '--mcp'],
    undo: ['codex', 'mcp', 'remove', 'codegraph'],
    wanted: (functions) => codeMapWanted(functions) && codexWanted(functions),
  },
  // context7 is always on (G11, F8 S11): hosted, so its registrations are its whole install.
  {
    tool: 'context7',
    dimension: 'claude',
    kind: 'registration',
    run: ['claude', 'mcp', 'add', '-s', 'user', '--transport', 'http', 'context7', CONTEXT7_URL],
    undo: ['claude', 'mcp', 'remove', '-s', 'user', 'context7'],
    wanted: () => true,
  },
  {
    tool: 'context7',
    dimension: 'codex',
    kind: 'registration',
    run: ['codex', 'mcp', 'add', 'context7', '--url', CONTEXT7_URL],
    undo: ['codex', 'mcp', 'remove', 'context7'],
    wanted: codexWanted,
  },
];

/** The folder a global install under `prefix` puts its binaries in: the prefix itself for npm on Windows, its `bin`
 * for npm elsewhere and for pnpm, whose `installPlan` names it so. */
export function prefixBinOf(kind, prefix, platform) {
  return kind !== 'pnpm' && platform === 'win32' ? prefix : path.join(prefix, 'bin');
}

/** The global install of `spec` and its remove, as words, for the package manager `pm` (`{ words, kind }`), with
 * `env`, the variables both are given over the environment. The install's arguments are `installPlan`'s, so the
 * module installs as `upgrade` does; under a `prefix` npm takes `--prefix` and pnpm gets the prefix as its home,
 * its own folders inside it, and either finds its binaries first on the PATH (a `PATH` here goes before the one
 * there), so its probes find them; the remove is given the same (D6). */
export function packageWords(pm, spec, platform, prefix = null) {
  const { args, env } = installPlan(pm.kind, spec, prefix, {}, platform);
  const remove = pm.kind === 'pnpm' ? ['remove', '-g', spec] : ['uninstall', '-g', spec, ...(prefix ? ['--prefix', prefix] : [])];
  return { run: [...pm.words, ...args], undo: [...pm.words, ...remove], env: prefix && pm.kind !== 'pnpm' ? { ...env, PATH: prefixBinOf(pm.kind, prefix, platform) } : env };
}

const PLUGIN_UNDO = ['claude plugin uninstall engram@engram', 'claude plugin marketplace remove engram'];

/** The undo of what engram's own commands write, per dimension: the binary, and what `engram setup` writes in each
 * host, as engram's docs and source name it (v3.6.0, `docs/AGENT-SETUP.md`, `internal/setup/setup.go`;
 * odd/tasks/f8-s11-complements.md, L3). Named, never run: `stack install` runs only an undo it can read back. */
export const ENGRAM_UNDO = {
  claude: [...PLUGIN_UNDO, 'claude mcp remove engram --scope user'],
  codex: [
    'codex plugin remove engram@engram',
    'codex plugin marketplace remove engram',
    'codex mcp remove engram',
    // engram v3.6.0 strips these, but an older engram or gentle-ai pointed them at the files below (Codex, P2).
    'remove model_instructions_file and experimental_compact_prompt_file from the Codex config.toml where they name those files',
    'delete engram-instructions.md and engram-compact-prompt.md beside the Codex config.toml',
  ],
  installed: ['delete the engram binary your shell runs (which engram; on Windows, where.exe engram)'],
};

const PREREQUISITE_STEPS = {
  git: 'install git (https://git-scm.com)',
  gh: 'install the GitHub CLI (https://cli.github.com), then gh auth login',
};

/** The dimensions of `row` that a person is asked about: the machine ones, Codex's only while Codex is wanted. */
function gapsOf(row, functions) {
  return MACHINE.filter((dimension) => (dimension !== 'codex' || codexWanted(functions)) && GAP_STATES.has(row?.[dimension]));
}

/** `doctor`'s fixes of `dimensions`, each named once, so two dimensions that share a command name it once. */
const fixesOf = (row, dimensions) => [...new Set(dimensions.flatMap((dimension) => [row.fix?.[dimension] ?? []].flat()))];

/** The plan, as `{ mandatory, manual, optional }`:
 *  - `mandatory`: the runnable rows that are `missing`, in run order, each `{ tool, dimension, kind, run, undo, env }`
 *    (words, and the variables both are given), a package's with its `bin`;
 *  - `manual`: what he does himself, each `{ tool, dimensions, why, steps, undo }`: engram and its plugin, by
 *    engram's own commands (F8 S11), a runnable row in another gap state, a login, a missing prerequisite;
 *  - `optional`: typescript-lsp's gaps with `doctor`'s fix, never run.
 * `rows` are `probeStack`'s (a row its switch hides is absent), `functions` the resolved switches, `prerequisites`
 * `[{ id, state }]`, `pm` the resolved package manager `{ words, kind }`, `prefix` the folder packages go to (`null`:
 * the manager's own). A state that is no gap (`unknown`, `n/a`) plans nothing. */
export function planStack({ rows, functions, prerequisites = [], pm, prefix = null, platform = process.platform }) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const mandatory = [];
  const manual = [];
  const runnableKeys = new Set(RUNNABLE.map((r) => `${r.tool}.${r.dimension}`));

  for (const runnable of RUNNABLE) {
    const r = byId.get(runnable.tool);
    if (!r || !runnable.wanted(functions)) continue;
    const state = r[runnable.dimension];
    if (state === 'missing') {
      const { tool, dimension, kind } = runnable;
      mandatory.push(kind === 'package'
        ? { tool, dimension, kind, bin: runnable.bin, ...packageWords(pm, runnable.spec, platform, prefix) }
        : { tool, dimension, kind, run: runnable.run, undo: runnable.undo, env: {} });
    }
  }

  // A runnable row in a gap state other than `missing` is not run: grouped per tool, with doctor's fix.
  for (const tool of ['codex', 'codegraph', 'context7']) {
    const r = byId.get(tool);
    if (!r || (tool === 'codegraph' && !codeMapWanted(functions))) continue;
    const others = gapsOf(r, functions).filter((dimension) => runnableKeys.has(`${tool}.${dimension}`) && r[dimension] !== 'missing'
      && RUNNABLE.find((x) => x.tool === tool && x.dimension === dimension).wanted(functions));
    if (others.length > 0) {
      manual.push({ tool, dimensions: others, why: `${others.map((d) => r[d]).join(', ')}: stack install runs only what is missing`, steps: fixesOf(r, others), undo: [] });
    }
  }

  // engram's own commands write more than one thing and read their own entry back, so they are his (F8 S11, L4).
  const engram = byId.get('engram');
  const engramGaps = engram ? gapsOf(engram, functions) : [];
  if (engramGaps.length > 0) {
    const undo = ['claude', 'codex', 'installed'].filter((dimension) => engramGaps.includes(dimension)).flatMap((dimension) => ENGRAM_UNDO[dimension]);
    manual.push({ tool: 'engram', dimensions: engramGaps, why: "engram's own install and setup: your step, since setup writes more than one thing and reads its own entry back", steps: fixesOf(engram, engramGaps), undo });
  }
  // The plugin: `engram setup claude-code` installs and enables it, so a missing one is that step alone.
  const plugin = byId.get('engram-plugin');
  const pluginGaps = plugin ? gapsOf(plugin, functions) : [];
  if (pluginGaps.length > 0) {
    const missing = plugin.installed === 'missing';
    manual.push({
      tool: 'engram-plugin',
      dimensions: pluginGaps,
      why: missing ? "engram's own setup installs it: your step" : 'installed and not enabled: your step',
      steps: fixesOf(plugin, missing ? ['installed'] : pluginGaps),
      undo: missing ? PLUGIN_UNDO : ['claude plugin disable engram@engram'],
    });
  }

  const codex = byId.get('codex');
  if (codex && codexWanted(functions) && codex.codex === 'missing') {
    manual.push({ tool: 'codex', dimensions: ['codex'], why: 'a login takes your credentials', steps: ['codex login'], undo: ['codex logout'] });
  }

  for (const { id, state } of prerequisites) {
    if (GAP_STATES.has(state)) manual.push({ tool: id, dimensions: ['installed'], why: 'a prerequisite: install it yourself', steps: [PREREQUISITE_STEPS[id] ?? `install ${id}`], undo: [] });
  }

  const optional = [];
  for (const tool of ['typescript-lsp']) {
    const r = byId.get(tool);
    const gaps = r ? gapsOf(r, functions) : [];
    if (gaps.length > 0) optional.push({ tool, dimensions: gaps, steps: fixesOf(r, gaps) });
  }
  return { mandatory, manual, optional };
}

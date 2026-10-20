// The plan of the stack install: which of the tools the harness requires are missing, which of those this module
// runs (each with its exact undo), which are the person's own steps, and which are optional. Pure: it reads the rows
// `probeStack` already probed and the switches `functionsOf` resolved, and spawns nothing. See
// odd/tasks/stack-install.md (D1-D3).
import { GAP_STATES } from './digest.mjs';
import { installPlan } from './version.mjs';

/** The dimensions of a machine install: `upToDate` is `update`'s and `project` is `init`'s (D1). */
const MACHINE = ['installed', 'claude', 'codex'];

const offIn = (functions, name) => functions?.[name]?.value === 'off';
const codexWanted = (functions) => !offIn(functions, 'codexReview');
const codeMapWanted = (functions) => !offIn(functions, 'codeMap');

/** The rows the module runs, in the order it runs them (D2): the Codex CLI first, so a registration in Codex has a
 * Codex to register in. A row is runnable only while `wanted` holds for the project's switches. */
export const RUNNABLE = [
  { tool: 'codex', dimension: 'installed', kind: 'package', spec: '@openai/codex', wanted: codexWanted },
  { tool: 'codegraph', dimension: 'installed', kind: 'package', spec: '@colbymchenry/codegraph', wanted: codeMapWanted },
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
];

/** The global install of `spec` and its remove, as words, for the package manager `pm` (`{ words, kind }`). The
 * install's arguments are `installPlan`'s, so the module installs as `upgrade` does. */
export function packageWords(pm, spec, platform) {
  const { args } = installPlan(pm.kind, spec, null, {}, platform);
  const remove = pm.kind === 'pnpm' ? ['remove', '-g', spec] : ['uninstall', '-g', spec];
  return { run: [...pm.words, ...args], undo: [...pm.words, ...remove] };
}

const GENTLE_AI_AGENTS = { claude: 'claude-code', codex: 'codex' };
const GENTLE_AI_INSTALL = 'go install github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@latest';
const GENTLE_AI_RESTORE = 'gentle-ai restore <the backup id gentle-ai install printed>';

/** gentle-ai's own install and undo for the hosts `dimensions` name: his step, never run (F1, option 1). */
function gentleAiStep(dimensions, functions) {
  const hosts = (dimensions.includes('installed') ? ['claude', 'codex'].filter((host) => host === 'claude' || codexWanted(functions)) : dimensions)
    .map((host) => GENTLE_AI_AGENTS[host]);
  const agents = hosts.join(',');
  const steps = [...(dimensions.includes('installed') ? [GENTLE_AI_INSTALL] : []), `gentle-ai install --agents ${agents}`];
  return { why: "gentle-ai's own installer: your step, since its uninstall is not an exact undo (F1)", steps, undo: [`gentle-ai uninstall --agents ${agents} --yes`, GENTLE_AI_RESTORE] };
}

const PREREQUISITE_STEPS = {
  git: 'install git (https://git-scm.com)',
  gh: 'install the GitHub CLI (https://cli.github.com), then gh auth login',
};

/** The dimensions of `row` that a person is asked about: the machine ones, Codex's only while Codex is wanted. */
function gapsOf(row, functions) {
  return MACHINE.filter((dimension) => (dimension !== 'codex' || codexWanted(functions)) && GAP_STATES.has(row?.[dimension]));
}

/** `doctor`'s fixes of `dimensions`, each named once: engram's two registrations share one `gentle-ai sync`. */
const fixesOf = (row, dimensions) => [...new Set(dimensions.flatMap((dimension) => [row.fix?.[dimension] ?? []].flat()))];

/** The plan, as `{ mandatory, manual, optional }`:
 *  - `mandatory`: the runnable rows that are `missing`, in run order, each `{ tool, dimension, run, undo }` (words);
 *  - `manual`: what he does himself, each `{ tool, dimensions, why, steps, undo }`: gentle-ai's installer (F1),
 *    engram (which it brings), a runnable row in another gap state, a login, a missing prerequisite;
 *  - `optional`: context7 and typescript-lsp gaps with `doctor`'s fix, never run.
 * `rows` are `probeStack`'s (a row its switch hides is absent), `functions` the resolved switches, `prerequisites`
 * `[{ id, state }]`, `pm` the resolved package manager `{ words, kind }`. A state that is no gap (`unknown`, `n/a`)
 * plans nothing. */
export function planStack({ rows, functions, prerequisites = [], pm, platform = process.platform }) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const mandatory = [];
  const manual = [];
  const runnableKeys = new Set(RUNNABLE.map((r) => `${r.tool}.${r.dimension}`));

  for (const runnable of RUNNABLE) {
    const r = byId.get(runnable.tool);
    if (!r || !runnable.wanted(functions)) continue;
    const state = r[runnable.dimension];
    if (state === 'missing') {
      const words = runnable.kind === 'package' ? packageWords(pm, runnable.spec, platform) : { run: runnable.run, undo: runnable.undo };
      mandatory.push({ tool: runnable.tool, dimension: runnable.dimension, ...words });
    }
  }

  // A runnable row in a gap state other than `missing` is not run: grouped per tool, with doctor's fix.
  for (const tool of ['codex', 'codegraph']) {
    const r = byId.get(tool);
    if (!r || (tool === 'codegraph' && !codeMapWanted(functions))) continue;
    const others = gapsOf(r, functions).filter((dimension) => runnableKeys.has(`${tool}.${dimension}`) && r[dimension] !== 'missing'
      && RUNNABLE.find((x) => x.tool === tool && x.dimension === dimension).wanted(functions));
    if (others.length > 0) {
      manual.push({ tool, dimensions: others, why: `${others.map((d) => r[d]).join(', ')}: stack install runs only what is missing`, steps: fixesOf(r, others), undo: [] });
    }
  }

  // gentle-ai's installer is the step only for what is missing; a stale hook or an old version keeps doctor's own fix
  // (Codex on 553900a..12e46c4).
  const gentleAi = byId.get('gentle-ai');
  const gentleAiGaps = gentleAi ? gapsOf(gentleAi, functions) : [];
  const gentleAiMissing = gentleAiGaps.filter((dimension) => gentleAi[dimension] === 'missing');
  const gentleAiOthers = gentleAiGaps.filter((dimension) => gentleAi[dimension] !== 'missing');
  if (gentleAiMissing.length > 0) manual.push({ tool: 'gentle-ai', dimensions: gentleAiMissing, ...gentleAiStep(gentleAiMissing, functions) });
  if (gentleAiOthers.length > 0) {
    manual.push({ tool: 'gentle-ai', dimensions: gentleAiOthers, why: `${gentleAiOthers.map((d) => gentleAi[d]).join(', ')}: doctor's fix`, steps: fixesOf(gentleAi, gentleAiOthers), undo: [] });
  }

  const engram = byId.get('engram');
  const engramGaps = engram ? gapsOf(engram, functions) : [];
  if (engramGaps.length > 0) {
    manual.push({ tool: 'engram', dimensions: engramGaps, why: "brought by gentle-ai's installer, your step (F1)", steps: fixesOf(engram, engramGaps), undo: [] });
  }

  const codex = byId.get('codex');
  if (codex && codexWanted(functions) && codex.codex === 'missing') {
    manual.push({ tool: 'codex', dimensions: ['codex'], why: 'a login takes your credentials', steps: ['codex login'], undo: ['codex logout'] });
  }

  for (const { id, state } of prerequisites) {
    if (GAP_STATES.has(state)) manual.push({ tool: id, dimensions: ['installed'], why: 'a prerequisite: install it yourself', steps: [PREREQUISITE_STEPS[id] ?? `install ${id}`], undo: [] });
  }

  const optional = [];
  for (const tool of ['context7', 'typescript-lsp']) {
    const r = byId.get(tool);
    const gaps = r ? gapsOf(r, functions) : [];
    if (gaps.length > 0) optional.push({ tool, dimensions: gaps, steps: fixesOf(r, gaps) });
  }
  return { mandatory, manual, optional };
}

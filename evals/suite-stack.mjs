// What a run of the eval suite was, kept apart from the suite's entry (suite.mjs) so that file stays under the size
// limit (bin/conventions-structure.test.mjs): the agents a run can measure, the stack it records, and what may not
// change between the run a results file recorded and the one that continues it. suite.mjs re-exports `diffRun`,
// `readStack` and `readCodexStack`, so their readers import them from where they always did.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tools } from '../bin/lib/stack.mjs';
import { codexSandboxEnv } from './codex-configs.mjs';
import { codexHomeOf } from './codex-home.mjs';
import { SANDBOX_SWITCHES, assertWorkRoot, ensureSandboxDirs, honestyPin, subagentPin } from './configs.mjs';
import { PAYLOAD, minimalWithDigest, settledBytes } from './home.mjs';
import { allocatePort, releasePort } from './ports.mjs';
import { parseArm } from './arms.mjs';
import { withoutDigest } from './without.mjs';
import { probeVersion, removeDir } from './runner.mjs';

/** The CLIs a run can measure. `--agent` names one, and it is the one argument that has a default: absent means
 * `claude`, because every command line F5 recorded (`odd/tasks/evals.md`, the roadmap) was written before a second
 * agent existed and must go on meaning what it meant, and reproducing a recorded number starts by typing it again.
 * The same rule holds wherever a run is written down: the parsed arguments and a results document name their agent
 * only when it is not Claude Code, so what F5 parsed and recorded has the shape it always had. */
export const AGENTS = ['claude', 'codex'];
export const agentOf = (run) => run?.agent ?? 'claude';
export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// ---- what a run was --------------------------------------------------------------------------------------------------

/** The versions a run of each agent records as its stack, as `[key in the document, name in a message]`. A run
 * recorded before F8 S11 also holds `gentleAi`, which left the stack: it is kept in the file and compared no more. */
const WORKSPACE_FIELDS = [['codegraph', 'codegraph'], ['jsHarness', 'js-harness commit']];
const STACK_FIELDS = {
  claude: [['claude', 'claude'], ['engram', 'engram'], ['engramPlugin', 'engram plugin'], ...WORKSPACE_FIELDS],
  codex: [['codex', 'codex'], ['engram', 'engram'], ...WORKSPACE_FIELDS],
};

/** What differs between the run a results file recorded (`recorded`) and the one about to continue it
 * (`current`), as `[{ field, recorded, current }]`, empty when nothing does. The versions of the stack, the
 * model and the permission mode must not change within a run (the feature document's rule): half the trials
 * on one CLI and half on another is not a measurement of either. `null`, an unreadable version, equals only
 * itself.
 *
 * The agent must not change either, and comes first. A run that names none is Claude Code's (see `AGENTS`), so a
 * file F5 recorded is never continued as a Codex run. The stack compared is the one of the run about to continue.
 *
 * A run of the subagent configs also pins, for each config, the model it forces on its subagents and the SHA-256 of
 * the delegation text it appends to the system prompt (`subagentConfigs`, by config name: `configs.mjs`,
 * `subagentPin`). Neither may change: the model is the one thing its two arms differ in, and the text is what every
 * trial was told, so trials told two texts are not one measurement. Each config of the run about to continue is
 * compared with what the file says of it. A config the file neither names nor holds a trial of is new to the run,
 * which a continued run may widen, and is not a change; one it holds trials of without a pin is, in both, since
 * nothing says what those trials ran on.
 *
 * A run of the honesty configs pins, for each, the SHA-256 of the project memory it seeds (`honestyConfigs`, `honestyPin`),
 * compared the same way: the memory is what the trials were told, so a changed one is another measurement. */
export function diffRun(recorded, current) {
  return runChanges(recorded, current).map(({ field, recorded: before, current: now }) => ({ field, recorded: before, current: now }));
}

/** The changes of `diffRun`, each with its `kind`: `stack` for what every run records, `subagentModel` and
 * `delegation` for the two pins of a subagent config, and `memory` for the pin of an honesty config. The refusal says
 * which kinds changed (`refusalOf`). */
export function runChanges(recorded, current) {
  const pinned = isObject(recorded.subagentConfigs) ? recorded.subagentConfigs : {};
  const pinnedMemory = isObject(recorded.honestyConfigs) ? recorded.honestyConfigs : {};
  const ran = new Set((recorded.trials ?? []).map((entry) => entry.config));
  const pairs = [
    ['stack', 'agent', agentOf(recorded), agentOf(current)],
    ...STACK_FIELDS[agentOf(current)].map(([key, field]) => ['stack', field, recorded.stack?.[key] ?? null, current.stack?.[key] ?? null]),
    ['stack', 'model', recorded.model ?? null, current.model ?? null],
    ['stack', 'permission mode', recorded.permissionMode ?? null, current.permissionMode ?? null],
    ...Object.entries(current.subagentConfigs ?? {})
      .filter(([name]) => Object.hasOwn(pinned, name) || ran.has(name))
      .flatMap(([name, pin]) => [
        ['subagentModel', `subagent model of ${name}`, pinned[name]?.model ?? null, pin.model],
        ['delegation', `delegation text of ${name}`, pinned[name]?.delegationSha256 ?? null, pin.delegationSha256],
      ]),
    ...Object.entries(current.honestyConfigs ?? {})
      .filter(([name]) => Object.hasOwn(pinnedMemory, name) || ran.has(name))
      .map(([name, pin]) => ['memory', `project memory of ${name}`, pinnedMemory[name]?.memorySha256 ?? null, pin.memorySha256]),
  ];
  return pairs.filter(([, , before, now]) => before !== now).map(([kind, field, before, now]) => ({ kind, field, recorded: before, current: now }));
}

/** The changes of a run's setup, kind `setup`: none when the run recorded no current trial and no setup, since it
 * gains the setup it is now built on; else one per item of the fingerprint that differs, or one for the whole when
 * the file has no setup at all. */
export function setupChanges(recorded, fingerprint) {
  const before = recorded.setup ?? null;
  if (before === null && !(recorded.trials ?? []).some((entry) => fromTemplate(entry.config, agentOf(recorded)))) return [];
  if (before === null) return [{ kind: 'setup', field: 'setup', recorded: null, current: fingerprint.sha256 }];
  if (before.sha256 === fingerprint.sha256) return [];
  const items = [...new Set([...Object.keys(before.items ?? {}), ...Object.keys(fingerprint.items)])].sort();
  return items
    .filter((item) => (before.items?.[item] ?? null) !== (fingerprint.items[item] ?? null))
    .map((item) => ({ kind: 'setup', field: `setup ${item}`, recorded: before.items?.[item] ?? null, current: fingerprint.items[item] ?? null }));
}

/** Whether the config `name` runs in a home seeded from the template: the current arm and every arm of one
 * component taken out of it. A name no arm parses as, recorded by an older run, is not. */
function fromTemplate(name, agent) {
  if (name === 'current') return true;
  try {
    return parseArm(name, agent)?.base === 'current';
  } catch {
    return false;
  }
}

/** What a run pins of each arm of one component, `{ base, components, sha256 }` by name: for an arm of current the
 * digest of what its filter takes out of the template payload (`withoutDigest`), for an arm of minimal the digest of
 * the servers it puts in (`minimalWithDigest`), each read from the template in `templateDir`. */
export function armPins(names, agent, templateDir) {
  return Object.fromEntries(names.map((name) => {
    const { base, components } = parseArm(name, agent);
    const sha256 = base === 'minimal'
      ? minimalWithDigest(templateDir, components)
      : withoutDigest(path.join(templateDir, PAYLOAD), components, agent, settledBytes);
    return [name, { base, components, sha256 }];
  }));
}

/** The changes of the arms' pins, kind `arm`: one per arm whose pin differs from the one the file holds, for each
 * arm the file pins or holds trials of; an arm new to the run is no change. */
export function armChanges(recorded, pins) {
  const pinned = isObject(recorded.arms) ? recorded.arms : {};
  const ran = new Set((recorded.trials ?? []).map((entry) => entry.config));
  return Object.entries(pins)
    .filter(([name]) => Object.hasOwn(pinned, name) || ran.has(name))
    .filter(([name, pin]) => (pinned[name]?.sha256 ?? null) !== pin.sha256)
    .map(([name, pin]) => ({ kind: 'arm', field: `cut of ${name}`, recorded: pinned[name]?.sha256 ?? null, current: pin.sha256 }));
}

/** For each kind of change: what the file is said to have been recorded with, and what must not change. */
const CHANGE_KINDS = {
  stack: ['on another stack', 'versions'],
  setup: ['on another setup', 'the home the current arm is built from'],
  arm: ['with another cut of an arm', 'what an arm takes out of the current arm\'s home'],
  subagentModel: ['with another subagent model', 'the model a config forces on its subagents'],
  delegation: ['with another delegation text', 'the delegation text of a config'],
  memory: ['with another project memory', 'the project memory of a config'],
};
export const listed = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** What a run that is not continued prints: which kinds of thing changed, each change as `recorded -> current`, and
 * what to do. A file whose subagent model or delegation text changed was not "recorded on another stack", and saying
 * so sends the reader to compare versions that are equal. A digest is shown by its first 12 characters, enough to
 * tell two apart. */
export function refusalOf(file, changes) {
  const kinds = Object.keys(CHANGE_KINDS).filter((kind) => changes.some((change) => change.kind === kind));
  const shown = (kind, value) => (value === null ? 'unknown' : kind === 'delegation' || kind === 'setup' || kind === 'arm' || kind === 'memory' ? `sha256 ${String(value).slice(0, 12)}` : value);
  return `${file} was recorded ${listed(kinds.map((kind) => CHANGE_KINDS[kind][0]))}, and ${listed(kinds.map((kind) => CHANGE_KINDS[kind][1]))} must not change within a run, so it is not continued:\n`
    + `${changes.map(({ kind, field, recorded, current }) => `  ${field}: ${shown(kind, recorded)} -> ${shown(kind, current)}`).join('\n')}\n`
    + `${kinds.length === 1 && kinds[0] === 'stack' ? 'Restore the recorded versions' : 'Restore what was recorded'}, or start a new run with another --name.\n`;
}

const readInstalledPlugin = (home, pluginId) => {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), 'utf8'));
    const version = record?.plugins?.[pluginId]?.[0]?.version;
    return typeof version === 'string' && version !== '' ? version : null;
  } catch {
    return null;
  }
};

/** The stack the `current` arm is measured on, `{ claude, engram, engramPlugin, codegraph, jsHarness }`,
 * each `null` when it cannot be read (never a guess). engram and codegraph are asked the way `doctor`
 * asks (`bin/lib/stack.mjs`), the plugin is read from the record Claude Code keeps of what it installed, and the CLI
 * is asked for its own `--version` under the sandbox switches (no updater runs). The last two are what lays out a
 * trial's workspace (`initWorkspace`): codegraph builds its index, and `js-harness init` of the checkout at `root`
 * writes the rest (`readWorkspaceCommit`). `spawn`, `platform`, `root` and `probeClaude` are injectable. */
export function readStack({
  claude, home, spawn = spawnSync, platform = process.platform, root = CHECKOUT, probeClaude = (command) => probeVersion({ command }, SANDBOX_SWITCHES),
}) {
  const installed = (id) => installedVersion(id, { spawn, platform });
  return {
    claude: probeClaude(claude) ?? null,
    engram: installed('engram'),
    engramPlugin: readInstalledPlugin(home, 'engram@engram'),
    ...readWorkspaceStack({ spawn, platform, root }),
  };
}

/** The version of the stack tool `id` as `doctor` reads it (`bin/lib/stack.mjs`), or `null`. */
function installedVersion(id, { spawn, platform }) {
  const { state, version } = tools.find((tool) => tool.id === id).installed({ spawn, platform });
  return state === 'ok' ? version : null;
}

/** The checkout this file belongs to, whose `js-harness init` the current arm runs in a trial's workspace. */
const CHECKOUT = fileURLToPath(new URL('..', import.meta.url));

/** What lays out the current arm's workspace, the same under both hosts: `{ codegraph, jsHarness }`. */
function readWorkspaceStack({ spawn, platform, root }) {
  return { codegraph: installedVersion('codegraph', { spawn, platform }), jsHarness: readWorkspaceCommit({ spawn, root }) };
}

/** The commit of the checkout at `root`, with `+dirty` after it when a file git tracks there differs from it, or
 * `null` when git cannot say either (a commit that cannot be told clean is not recorded as clean). A file git does not
 * track is left out, and so is `evals/results`, where a run writes its own results file: neither is what `init`
 * runs. Two dirty checkouts of one commit read the same, so `+dirty` says only that the commit is not all of it. */
function readWorkspaceCommit({ spawn, root }) {
  const git = (args) => {
    const result = spawn('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 30000, windowsHide: true });
    return result.error || result.status !== 0 ? null : `${result.stdout ?? ''}`;
  };
  const commit = git(['rev-parse', 'HEAD'])?.trim();
  if (!commit || !/^[0-9a-f]{40,64}$/.test(commit)) return null;
  const changes = git(['status', '--porcelain', '--untracked-files=no', '--', '.', ':(exclude)evals/results']);
  if (changes === null) return null;
  return changes.trim() === '' ? commit : `${commit}+dirty`;
}

const VERSION_HOME_PREFIX = 'js-harness-suite-codex-version-';

/** The stack a Codex run is measured on, `{ codex, engram, codegraph, jsHarness }`, each `null` when it
 * cannot be read (never a guess). engram, codegraph and the js-harness commit are read as for Claude Code
 * (`readStack`): they are the same programs, and the same checkout lays out the workspace, under both hosts. There is
 * no engram plugin field: the engram plugin's version is read from a record Claude Code keeps
 * (`installed_plugins.json`), and Codex keeps none of that kind: what its home holds of a plugin is a directory of
 * the plugin cache named by version (`codex-home.mjs`, `copyPluginCache`), which is not read here.
 *
 * Codex is asked for its own `--version` through the runner's `probeVersion`, under the environment a trial gets
 * (`codexSandboxEnv`) in a throwaway home of its own under `workRoot`, and never under the real environment: `codex
 * --version` WRITES into its `CODEX_HOME` (a `tmp/arg0` directory; `odd/tasks/codex-parity.md`, T3, where two probes
 * under the real environment replaced the real one's). The home gets the directories a trial's has, holds no login
 * and no configuration, and is removed whatever happens, with the port its environment names given back. So
 * `workRoot` must already have passed `assertWorkRoot`; it is made when it is not there, and it is the caller that
 * knows whether the run goes on, so the caller removes it again when it does not (`suiteMain`). `spawn`, `platform`,
 * `root`, `probeCodex(command, env)`, `allocatePort`, `releasePort` and `log` are injectable. */
export async function readCodexStack({
  codex, workRoot, spawn = spawnSync, platform = process.platform, root = CHECKOUT, probeCodex = (command, env) => probeVersion({ command }, env),
  allocatePort: allocate = allocatePort, releasePort: release = releasePort, log = () => {},
}) {
  fs.mkdirSync(workRoot, { recursive: true });
  const home = fs.mkdtempSync(path.join(workRoot, VERSION_HOME_PREFIX));
  let version;
  try {
    ensureSandboxDirs(home);
    fs.mkdirSync(codexHomeOf(home), { recursive: true });
    // A trial's environment names an engram port of its own, so this one does too; nothing listens on it.
    const engramPort = await allocate();
    try {
      version = probeCodex(codex, codexSandboxEnv({ home, engramPort })) ?? null;
    } finally {
      release(engramPort);
    }
  } finally {
    removeDir(home, 'home of the Codex version probe', log);
  }
  return {
    codex: version,
    engram: installedVersion('engram', { spawn, platform }),
    ...readWorkspaceStack({ spawn, platform, root }),
  };
}

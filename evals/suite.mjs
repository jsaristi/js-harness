#!/usr/bin/env node
// The suite entry: one command that runs a set of trials for real and leaves a committed, comparable results
// file. Zero deps, plain Node. The headroom screen (T4) and the A/B run (T5) are both runs of it:
//
//   node evals/suite.mjs --claude <path> --configs minimal,current --efforts medium,high --repeats 3 \
//     --tasks all --permission-mode <mode> --name <run name> [--work-root <dir>] [--model <id>] [--plan]
//   node evals/suite.mjs --summary --name <run name>
//
// The same suite runs on the Codex CLI (`odd/tasks/codex-parity.md`, T4), which takes no permission mode and no
// token, and keeps everything it writes in a `codex` directory of its own:
//
//   node evals/suite.mjs --agent codex --codex <path> --configs minimal,current --efforts medium,high --repeats 3 \
//     --tasks all --name <run name> [--work-root <dir>] [--model <id>] [--plan]
//   node evals/suite.mjs --agent codex --summary --name <run name>
//
// The subagent configs (`odd/tasks/subagent-model-routing.md`) are runs of Claude Code too, named in `--configs` in
// place of the two arms and never beside them, and they keep everything they write in a `subagents` directory:
//
//   node evals/suite.mjs --claude <path> --configs sub-opus-write,sub-haiku-write --efforts medium --repeats 3 \
//     --tasks <ids> --permission-mode <mode> --name <run name> [--work-root <dir>]
//   node evals/suite.mjs --summary --subagents --name <run name>
//
// The honesty configs (`odd/tasks/honesty-audit.md`, T10) are runs of Claude Code too, named in `--configs` alone, as the
// subagent configs are and apart from them. Their memory is seeded by the config itself, so no home template is built,
// and they keep everything they write in an `honesty` directory of their own:
//
//   node evals/suite.mjs --claude <path> --configs honesty-base,honesty-line --efforts medium --repeats 3 \
//     --tasks honest-unknown --permission-mode <mode> --name <run name> [--work-root <dir>]
//   node evals/suite.mjs --summary --honesty --name <run name>
//
// It wires what the other modules provide (`runSuite`, the two config builders, the home template, the work
// root checks and the port cleanup) and adds what none of them owns: the login token, a results file that
// names the stack it was measured on, and the headroom summary. The reasoning is in `odd/tasks/evals.md`
// (T1 and T2 decisions, Follow-ups).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { markBatch } from '../bin/lib/batch-mark.mjs';
import { tools } from '../bin/lib/stack.mjs';
import { assertAgentCommand, codexCurrentConfig, codexMinimalConfig, codexSandboxEnv } from './codex-configs.mjs';
import { DEFAULT_MIN_LOGIN_HOURS_LEFT, assertLoginFresh, buildCodexTemplate, codexHomeOf, removeCodexTemplate, seedFromCodexTemplate } from './codex-home.mjs';
import { HONESTY_CONFIGS, SANDBOX_SWITCHES, SUBAGENT_CONFIGS, currentConfig, defaultWorkRoot, assertWorkRoot, ensureSandboxDirs, honestyConfig, honestyPin, minimalConfig, subagentConfig, subagentPin } from './configs.mjs';
import { PAYLOAD, buildTemplate, removeTemplate, seedFromTemplate, settledBytes } from './home.mjs';
import { checkResults, reportLines, summarize } from './honesty-report.mjs';
import { allocatePort, releasePort } from './ports.mjs';
import { ArmError, parseArm } from './arms.mjs';
import { cellBasis, planLines, runPlan } from './plan.mjs';
import { withoutDigest } from './without.mjs';
import { LIST_PRICES } from './prices.mjs';
import { CODEX_LIST_PRICES } from './report.mjs';
import { loadTask, planTrials, probeVersion, removeDir, runSuite, runTrial as runRealTrial, trialKey } from './runner.mjs';

/** The CLIs a run can measure. `--agent` names one, and it is the one argument that has a default: absent means
 * `claude`, because every command line F5 recorded (`odd/tasks/evals.md`, the roadmap) was written before a second
 * agent existed and must go on meaning what it meant, and reproducing a recorded number starts by typing it again.
 * The same rule holds wherever a run is written down: the parsed arguments and a results document name their agent
 * only when it is not Claude Code, so what F5 parsed and recorded has the shape it always had. */
const AGENTS = ['claude', 'codex'];
const agentOf = (run) => run?.agent ?? 'claude';

/** The model both arms run on (`odd/tasks/evals.md`, Design): part of what the eval measures, so a constant. */
export const EVAL_MODEL = 'claude-opus-5-5';

/** The model both arms of a Codex run are measured on (`odd/tasks/codex-parity.md`, Constraints): a constant for
 * the same reason. */
export const CODEX_EVAL_MODEL = 'gpt-6.1-sol';

/** What a Codex results file records as its permission mode: the flag both Codex arms are fixed to
 * (`codex-configs.mjs`), the decided equivalent of the `bypassPermissions` the Claude arms ran under. It is not an
 * argument, because no other value is measured; it is recorded so that a results file says what its trials were
 * allowed, whichever agent ran them. */
export const CODEX_PERMISSION_MODE = 'dangerously-bypass-approvals-and-sandbox';

/** The directory, inside the results directory and inside the raw logs', that holds everything a Codex run
 * writes. Never beside F5's files: its report reads every `*.json` of the results directory itself as one
 * comparable set of runs (`report.mjs`, `loadRuns`), and refuses a set whose models or stacks differ. */
const CODEX_DIR = 'codex';

/** The directory that holds everything a run of the subagent configs writes, for the same reason: that report also
 * refuses a run whose configs are not `minimal` and `current`, so one results file of theirs beside F5's would stop
 * F5's gate. Their own report reads this directory (`odd/tasks/subagent-model-routing.md`). */
const SUBAGENTS_DIR = 'subagents';

/** The directory that holds everything a run of the honesty configs writes, for the same reason as `SUBAGENTS_DIR`: the
 * report that reads the directory of F5's runs refuses a config it does not know. Their report is
 * `evals/honesty-report.mjs`, which reads this directory (`odd/tasks/honesty-audit.md`, T10). */
const HONESTY_DIR = 'honesty';

/** Where the login token of the eval run is read from: a variable of its own, so the global
 * `CLAUDE_CODE_OAUTH_TOKEN` that would log Sebastián's daily sessions in with a connector-less token is never needed. */
export const TOKEN_VARIABLE = 'JS_HARNESS_EVAL_OAUTH_TOKEN';

// What `claude --help` of the installed CLI lists for these flags (read from the 2.1.284 binary): a value outside them
// would make every trial fail at startup and be recorded as a measurement.
const PERMISSION_MODES = ['acceptEdits', 'auto', 'bypassPermissions', 'default', 'dontAsk', 'plan'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
// The efforts a Codex run may name: the two of the F6 matrix (`odd/tasks/codex-parity.md`, Constraints), and that is
// their only source. The values `model_reasoning_effort` takes for this model were NOT read from the installed CLI:
// this list was written without running it (even `codex --version` writes into its `CODEX_HOME`), and the repository
// holds no record of the full list, only that `medium`, `high` and `xhigh` were once given to a Codex model here
// (`docs/ROADMAP.md`, the review row). The effort travels inside a `-c` override, so nothing in this repository shows
// what Codex does with a value it does not know: widen the list from evidence of that, not from a guess.
const CODEX_EFFORTS = ['medium', 'high'];
const CONFIGS = ['minimal', 'current'];
/** The subagent configs (`configs.mjs`): Claude Code's alone, since what they force is Claude Code's subagent model. */
const SUBAGENT_NAMES = Object.keys(SUBAGENT_CONFIGS);
const isSubagentConfig = (name) => Object.hasOwn(SUBAGENT_CONFIGS, name);
/** The honesty configs (`configs.mjs`): Claude Code's alone, for the same reason as the subagent configs. */
const HONESTY_NAMES = Object.keys(HONESTY_CONFIGS);
const isHonestyConfig = (name) => Object.hasOwn(HONESTY_CONFIGS, name);
/** The directory a config's results are kept in, apart from F5's: a subagent config's and an honesty config's, each its
 * own; `null` for `minimal` and `current`, whose results are the ones the report reads. */
const dedicatedOf = (name) => (isSubagentConfig(name) ? SUBAGENTS_DIR : isHonestyConfig(name) ? HONESTY_DIR : null);

export const USAGE = [
  'Usage: node evals/suite.mjs --claude <path> --configs <minimal,current> --efforts <medium,high> --repeats <n> --tasks <ids|all>',
  '                            --permission-mode <mode> --name <run name> [--work-root <dir>] [--model <id>] [--plan]',
  '       node evals/suite.mjs --agent codex --codex <path> --configs <minimal,current> --efforts <medium,high> --repeats <n>',
  '                            --tasks <ids|all> --name <run name> [--work-root <dir>] [--model <id>] [--plan]',
  '       node evals/suite.mjs [--agent codex] --summary --name <run name>',
  '       node evals/suite.mjs --summary --subagents --name <run name>',
  '       node evals/suite.mjs --summary --honesty --name <run name>',
  '',
  `  --agent <name>            ${AGENTS.join(', ')}: the CLI the run measures; claude when it is not given`,
  '  --claude <path>           the real claude binary, an absolute path (never a .cmd shim)',
  '  --codex <path>            with --agent codex: the real codex binary (codex.exe), an absolute path, never the codex.cmd shim on PATH',
  `  --configs <list>          ${CONFIGS.join(', ')}; or, for claude alone and never in one run with those two or with another kind, one of:`,
  `                            the subagent configs ${SUBAGENT_NAMES.join(', ')};`,
  `                            the honesty configs ${HONESTY_NAMES.join(', ')}`,
  `  --efforts <list>          ${EFFORTS.join(', ')}; with --agent codex: ${CODEX_EFFORTS.join(', ')}`,
  '  --repeats <n>             trials per task, config and effort',
  '  --tasks <ids|all>         task ids from evals/tasks, comma separated, or all',
  `  --permission-mode <mode>  ${PERMISSION_MODES.join(', ')}; no default, the same for both arms;`,
  `                            not taken with --agent codex, whose arms always run with --${CODEX_PERMISSION_MODE}`,
  '  --name <run name>         results go to evals/results/<name>.json, raw logs to evals/runs/<name>/;',
  `                            with --agent codex, to evals/results/${CODEX_DIR}/<name>.json and evals/runs/${CODEX_DIR}/<name>/;`,
  `                            with subagent configs, to evals/results/${SUBAGENTS_DIR}/<name>.json and evals/runs/${SUBAGENTS_DIR}/<name>/;`,
  `                            with honesty configs, to evals/results/${HONESTY_DIR}/<name>.json and evals/runs/${HONESTY_DIR}/<name>/`,
  '  --work-root <dir>         where trials run (default: js-harness-evals-work next to the repository)',
  `  --model <id>              the model both arms run on, recorded with the run (default ${EVAL_MODEL}; with --agent codex,`,
  `                            ${CODEX_EVAL_MODEL}); a Claude model by its full id, never an alias. A recorded run continues only on its model`,
  '  --plan                    with a run: print the trials it would run and their agent time and list cost, estimated from',
  '                            the recorded results of the same model, "unknown" where there are none, and start nothing',
  '  --configs also takes the arms of one component, each beside its base: current-without-<id>, a sorted pair',
  '                            current-without-<id>_<id>, minimal-with-<id> (the ids and what minimal takes: evals/arms.mjs)',
  '  --summary                 print the summary of a recorded run and run nothing',
  `  --subagents               with --summary: read the run from evals/results/${SUBAGENTS_DIR}/, where a run of subagent configs is recorded;`,
  `  --honesty                 with --summary: read the run from evals/results/${HONESTY_DIR}/, where a run of honesty configs is recorded;`,
  `                            without either a summary reads evals/results/ (evals/results/${CODEX_DIR}/ with --agent codex) and looks nowhere else`,
  '',
  `The login token is read from the ${TOKEN_VARIABLE} environment variable (create it with \`claude setup-token\`).`,
  `With --agent codex the model is ${CODEX_EVAL_MODEL} and no token is read: the login is the real ~/.codex/auth.json, copied into`,
  'each trial\'s own home. Of that file only the expiry of its access token is read, and nothing else of it is printed.',
  `A run starts only while that token has at least ${DEFAULT_MIN_LOGIN_HOURS_LEFT} hours left, because Codex may refresh a login that nears`,
  'its expiry inside a trial: otherwise run `codex logout`, then `codex login`, then run again.',
  'Running the same command again continues the run: a recorded trial is never repeated.',
].join('\n');

export class UsageError extends Error {}

const VALUE_FLAGS = ['--agent', '--claude', '--codex', '--configs', '--efforts', '--repeats', '--tasks', '--permission-mode', '--name', '--work-root', '--model'];
/** What `--model` may name, by agent: a Claude model by its full id and never an alias, whose meaning moves with the
 * CLI (the rule of `SUBAGENT_MODELS`, `configs.mjs`); a Codex model by one word, since Codex takes it as `-m`. */
const MODEL_PATTERNS = { claude: /^claude-[a-z]+(-\d+)+$/, codex: /^[A-Za-z0-9][A-Za-z0-9._-]*$/ };
/** What the command line of each agent is made of: `binary`, the flag that names its real binary; `configs` and
 * `efforts`, the ones it may name; `required`, every flag a run needs (all but `--work-root`); and `refused`, the
 * flags that are the other agent's, each with the rest of the sentence that says why. */
const COMMAND_LINES = {
  claude: {
    binary: '--claude',
    configs: [...CONFIGS, ...SUBAGENT_NAMES, ...HONESTY_NAMES],
    efforts: EFFORTS,
    required: ['--claude', '--configs', '--efforts', '--repeats', '--tasks', '--permission-mode', '--name'],
    refused: { '--codex': 'names the binary of a Codex run and is taken only with --agent codex' },
  },
  codex: {
    binary: '--codex',
    configs: CONFIGS,
    efforts: CODEX_EFFORTS,
    required: ['--codex', '--configs', '--efforts', '--repeats', '--tasks', '--name'],
    refused: {
      '--claude': 'names the binary of a Claude Code run: with --agent codex the binary is --codex',
      '--permission-mode': `is not taken with --agent codex: both Codex arms always run with --${CODEX_PERMISSION_MODE}`,
    },
  },
};
const NAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/;

function listOf(flag, value, allowed, what) {
  const items = value.split(',');
  if (items.some((item) => item === '')) throw new UsageError(`${flag} needs a comma separated list of ${what}, got ${JSON.stringify(value)}`);
  for (const item of items) {
    if (!allowed.includes(item)) throw new UsageError(`${flag}: ${JSON.stringify(item)} is not ${what.replace(/s$/, '')} (one of ${allowed.join(', ')})`);
  }
  const twice = items.find((item, index) => items.indexOf(item) !== index);
  if (twice !== undefined) throw new UsageError(`${flag}: ${JSON.stringify(twice)} is listed twice`);
  return items;
}

/** The configs of `--configs` for `agent`: the ones its command line takes, and the arms of one component
 * (`evals/arms.mjs`, G2 of `odd/tasks/future-model-protocol.md`), each beside its base, since an arm is measured
 * against it and alone it would be compared with nothing. */
function configsOf(agent, value, allowed) {
  const arms = value.split(',').filter((name) => {
    try {
      return !allowed.includes(name) && parseArm(name, agent) !== null;
    } catch (err) {
      if (err instanceof ArmError) throw new UsageError(`--configs: ${err.message}`);
      throw err;
    }
  });
  const configs = listOf('--configs', value, [...allowed, ...arms], 'configs');
  for (const name of arms) {
    const { base } = parseArm(name, agent);
    if (!configs.includes(base)) throw new UsageError(`--configs: ${name} is compared with ${base}, which the run does not name`);
  }
  return configs;
}

/** The command line as `{ mode: 'run', claude, configs, efforts, repeats, tasks, permissionMode, name, workRoot }`
 * or `{ mode: 'summary', name }`. Every argument but `--work-root` is required and nothing has a default: a
 * missing or unknown one is a `UsageError` raised before anything is created, because a run that guessed its
 * permission mode or its arms would record results that mean something else. `taskIds` are the ids a `--tasks`
 * value may name, found in `tasksDir`, which an empty `--tasks all` names in its error.
 *
 * `--agent` is the exception to "nothing has a default" (see `AGENTS`). With `--agent codex` the result is
 * `{ mode: 'run', agent: 'codex', codex, configs, efforts, repeats, tasks, name, workRoot }` or `{ mode: 'summary',
 * agent: 'codex', name }`: the binary is `--codex`, the efforts are Codex's, and the flags that are Claude Code's
 * (`--claude`, `--permission-mode`) are refused instead of ignored, since a flag that was typed and did nothing
 * would let a run be taken for one it was not.
 *
 * A Claude run may name the subagent configs or the honesty configs in `--configs`, and parses into the same shape. It
 * names one kind alone: one that also names `minimal` or `current`, or a config of the other special kind, is refused,
 * because each kind keeps its results apart (`dedicatedOf`) and one command writes one results file.
 *
 * A summary names no config, so nothing in it says which of the directories its run is in: `--subagents` or `--honesty`,
 * a flag without a value, selects that one (`{ mode: 'summary', subagents: true, name }`, `{ mode: 'summary', honesty:
 * true, name }`), and without either a summary reads what it always read. Each is taken with `--summary` alone and is
 * Claude Code's alone: on a run it could contradict the configs, which already say where the results go. */
export function parseArgs(argv, { taskIds = [], tasksDir = 'the tasks directory' } = {}) {
  const given = new Map();
  let summary = false;
  let subagents = false;
  let plan = false;
  let honesty = false;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--summary') {
      summary = true;
    } else if (token === '--plan') {
      plan = true;
    } else if (token === '--subagents') {
      subagents = true;
    } else if (token === '--honesty') {
      honesty = true;
    } else if (VALUE_FLAGS.includes(token)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${token} requires a value`);
      if (given.has(token)) throw new UsageError(`${token} was given twice`);
      given.set(token, value);
      i += 1;
    } else if (token.startsWith('--')) {
      throw new UsageError(`unknown argument ${token}`);
    } else {
      throw new UsageError(`unexpected argument ${JSON.stringify(token)}`);
    }
  }
  const checkName = (name) => {
    if (!NAME_PATTERN.test(name)) throw new UsageError(`--name ${JSON.stringify(name)} is not usable as a file name: use letters, digits, ".", "_" and "-", starting with a letter or digit`);
  };

  const agent = given.get('--agent') ?? 'claude';
  if (!AGENTS.includes(agent)) throw new UsageError(`--agent ${JSON.stringify(agent)} is not one of ${AGENTS.join(', ')}`);
  const codex = agent === 'codex';
  if (subagents && codex) throw new UsageError('--subagents is not taken with --agent codex: the subagent configs are Claude Code\'s alone');
  if (subagents && !summary) throw new UsageError('--subagents selects a recorded subagent run and is taken only with --summary: a run says where its results go by the configs it names');
  if (honesty && codex) throw new UsageError('--honesty is not taken with --agent codex: the honesty configs are Claude Code\'s alone');
  if (honesty && subagents) throw new UsageError('--honesty and --subagents select two different recorded runs: a summary reads one of them');
  if (honesty && !summary) throw new UsageError('--honesty selects a recorded honesty run and is taken only with --summary: a run says where its results go by the configs it names');

  if (summary) {
    if (plan) throw new UsageError('--plan states what a run would cost and is taken only on a run, not with --summary');
    const others = [...given.keys()].filter((flag) => flag !== '--name' && flag !== '--agent');
    if (others.length > 0) throw new UsageError(`--summary reads a recorded run and takes only --name, --agent, --subagents and --honesty, not ${others.join(', ')}`);
    if (!given.has('--name')) throw new UsageError('--name is required with --summary');
    checkName(given.get('--name'));
    return { mode: 'summary', ...(codex && { agent }), ...(subagents && { subagents }), ...(honesty && { honesty }), name: given.get('--name') };
  }

  const line = COMMAND_LINES[agent];
  for (const [flag, why] of Object.entries(line.refused)) if (given.has(flag)) throw new UsageError(`${flag} ${why}`);
  for (const flag of line.required) if (!given.has(flag)) throw new UsageError(`${flag} is required${codex ? ' with --agent codex' : ''}`);
  const claude = given.get('--claude');
  if (codex) {
    // The check the Codex arms make of their command (`codex-configs.mjs`), made here so that it is a usage error.
    try {
      assertAgentCommand(given.get('--codex'), '--codex');
    } catch (err) {
      throw new UsageError(err.message);
    }
  } else {
    if (!path.isAbsolute(claude)) throw new UsageError(`--claude must be an absolute path, got ${JSON.stringify(claude)}: no PATH lookup is made`);
    if (/\.(cmd|bat|ps1)$/i.test(claude)) throw new UsageError(`--claude ${claude} is a shim: agents are spawned without a shell, so point at the real binary`);
  }
  const repeats = given.get('--repeats');
  if (!/^[1-9]\d*$/.test(repeats)) throw new UsageError(`--repeats must be a positive integer, got ${JSON.stringify(repeats)}`);
  const permissionMode = given.get('--permission-mode');
  if (!codex && !PERMISSION_MODES.includes(permissionMode)) throw new UsageError(`--permission-mode ${JSON.stringify(permissionMode)} is not one of ${PERMISSION_MODES.join(', ')}: one value, the same for both arms`);
  const tasksValue = given.get('--tasks');
  let tasks;
  if (tasksValue === 'all') {
    if (taskIds.length === 0) throw new UsageError(`--tasks all found no task in ${tasksDir}: a run of no trials would read as a finished one`);
    tasks = [...taskIds];
  } else {
    if (tasksValue.split(',').includes('all')) throw new UsageError('--tasks all cannot be combined with task ids');
    tasks = listOf('--tasks', tasksValue, taskIds, 'task ids');
  }
  const workRoot = given.get('--work-root') ?? null;
  if (workRoot !== null && !path.isAbsolute(workRoot)) throw new UsageError(`--work-root must be an absolute path, got ${JSON.stringify(workRoot)}`);
  checkName(given.get('--name'));
  const cells = {
    configs: configsOf(agent, given.get('--configs'), line.configs),
    efforts: listOf('--efforts', given.get('--efforts'), line.efforts, 'efforts'),
    repeats: Number(repeats),
    tasks,
  };
  const dedicated = cells.configs.find((name) => dedicatedOf(name) !== null);
  const clash = dedicated === undefined ? undefined : cells.configs.find((name) => dedicatedOf(name) !== dedicatedOf(dedicated));
  if (clash !== undefined) {
    const dir = dedicatedOf(dedicated);
    throw new UsageError(`--configs: ${dedicated} cannot share a run with ${clash}: a run of ${dir === HONESTY_DIR ? 'honesty' : 'subagent'} configs keeps its results in evals/results/${dir}/, `
      + 'apart from the files evals/report.mjs reads, which refuses a run that holds any config but minimal and current. Run the two as separate commands');
  }
  // The model a run is measured on (G5 of `odd/tasks/future-model-protocol.md`): written into what is parsed only
  // when given, so a command line without it parses as it always did and runs on the default.
  const model = given.get('--model');
  if (model !== undefined && !MODEL_PATTERNS[agent].test(model)) {
    throw new UsageError(`--model ${JSON.stringify(model)} is not ${codex ? 'a Codex model id' : 'a full Claude model id such as claude-opus-5-5: an alias names a different model as the CLI changes'}`);
  }
  const chosen = { ...(model !== undefined && { model }), ...(plan && { plan }) };
  if (codex) return { mode: 'run', agent, codex: given.get('--codex'), ...cells, name: given.get('--name'), workRoot, ...chosen };
  return { mode: 'run', claude, ...cells, permissionMode, name: given.get('--name'), workRoot, ...chosen };
}

// ---- what a run was --------------------------------------------------------------------------------------------------

/** The versions a run of each agent records as its stack, as `[key in the document, name in a message]`. */
const STACK_FIELDS = {
  claude: [['claude', 'claude'], ['gentleAi', 'gentle-ai'], ['engram', 'engram'], ['engramPlugin', 'engram plugin']],
  codex: [['codex', 'codex'], ['gentleAi', 'gentle-ai'], ['engram', 'engram']],
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
function runChanges(recorded, current) {
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
function setupChanges(recorded, fingerprint) {
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

/** What a run pins of each arm of one component, `{ base, components, sha256 }` by name: the digest of what its
 * filter takes out of the template payload in `payload` (`withoutDigest`). */
function armPins(names, agent, payload) {
  return Object.fromEntries(names.map((name) => {
    const { base, components } = parseArm(name, agent);
    return [name, { base, components, sha256: withoutDigest(payload, components, agent, settledBytes) }];
  }));
}

/** The changes of the arms' pins, kind `arm`: one per arm whose pin differs from the one the file holds, for each
 * arm the file pins or holds trials of; an arm new to the run is no change. */
function armChanges(recorded, pins) {
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
const listed = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** What a run that is not continued prints: which kinds of thing changed, each change as `recorded -> current`, and
 * what to do. A file whose subagent model or delegation text changed was not "recorded on another stack", and saying
 * so sends the reader to compare versions that are equal. A digest is shown by its first 12 characters, enough to
 * tell two apart. */
function refusalOf(file, changes) {
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

/** The stack the `current` arm is measured on, `{ claude, gentleAi, engram, engramPlugin }`, each `null` when it
 * cannot be read (never a guess). gentle-ai and engram are asked the way `doctor` asks (`bin/lib/stack.mjs`), the
 * plugin is read from the record Claude Code keeps of what it installed, and the CLI is asked for its own
 * `--version` under the sandbox switches (no updater runs). `spawn`, `platform` and `probeClaude` are injectable. */
export function readStack({
  claude, home, spawn = spawnSync, platform = process.platform, probeClaude = (command) => probeVersion({ command }, SANDBOX_SWITCHES),
}) {
  const installed = (id) => installedVersion(id, { spawn, platform });
  return {
    claude: probeClaude(claude) ?? null,
    gentleAi: installed('gentle-ai'),
    engram: installed('engram'),
    engramPlugin: readInstalledPlugin(home, 'engram@engram'),
  };
}

/** The version of the stack tool `id` as `doctor` reads it (`bin/lib/stack.mjs`), or `null`. */
function installedVersion(id, { spawn, platform }) {
  const { state, version } = tools.find((tool) => tool.id === id).installed({ spawn, platform });
  return state === 'ok' ? version : null;
}

const VERSION_HOME_PREFIX = 'js-harness-suite-codex-version-';

/** The stack a Codex run is measured on, `{ codex, gentleAi, engram }`, each `null` when it cannot be read (never a
 * guess). gentle-ai and engram are asked as for Claude Code (`readStack`): they are the same programs under both
 * hosts. There is no fourth field: the engram plugin's version is read from a record Claude Code keeps
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
 * `probeCodex(command, env)`, `allocatePort`, `releasePort` and `log` are injectable. */
export async function readCodexStack({
  codex, workRoot, spawn = spawnSync, platform = process.platform, probeCodex = (command, env) => probeVersion({ command }, env),
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
  return { codex: version, gentleAi: installedVersion('gentle-ai', { spawn, platform }), engram: installedVersion('engram', { spawn, platform }) };
}

// ---- the headroom summary --------------------------------------------------------------------------------------------

/** A task is `keep` when the minimal config at `medium` has at least this many recorded trials with a mean
 * score below `HEADROOM_BELOW`: a task nobody fails cannot separate anyone (`odd/tasks/evals.md`, Design). */
const HEADROOM_TRIALS = 3;
const HEADROOM_BELOW = 0.8;

const known = (values) => values.filter((value) => Number.isFinite(value));
const mean = (values) => (values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length);
/** `{ mean, known }` of the values that are known: an unknown one is left out and counted out, never read as 0. */
const stat = (values) => ({ mean: mean(known(values)), known: known(values).length });
const inOrder = (listed, seen) => [...new Set([...(listed ?? []), ...seen])];

/** The summary of a results document (`{ args, trials }`): `rows`, one per task, config and effort that has a
 * trial, with the trials recorded, the score's mean, min and max, and the mean tokens (input and output together)
 * and wall time over the trials that know them; and `headroom`, one entry per task with the verdict of the screen
 * (`keep`, `drop` or `incomplete`), read from the minimal config at medium alone. A reading aid for T4: the full
 * report is T6's. Rows follow the order of the run's own arguments. */
export function summarizeResults(doc) {
  const trials = Array.isArray(doc.trials) ? doc.trials : [];
  const tasks = inOrder(doc.args?.tasks, trials.map((entry) => entry.task));
  const configs = inOrder(doc.args?.configs, trials.map((entry) => entry.config));
  const efforts = inOrder(doc.args?.efforts, trials.map((entry) => entry.effort));
  const rank = (list, value) => list.indexOf(value);
  const groups = new Map();
  for (const entry of trials) {
    const key = [entry.task, entry.config, entry.effort].join('\n');
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const rows = [...groups.values()].map((group) => {
    const scores = known(group.map((entry) => entry.score));
    const tokens = group.map((entry) => (Number.isFinite(entry.inputTokens) && Number.isFinite(entry.outputTokens) ? entry.inputTokens + entry.outputTokens : null));
    return {
      task: group[0].task,
      config: group[0].config,
      effort: group[0].effort,
      trials: group.length,
      score: { mean: mean(scores), min: scores.length === 0 ? null : Math.min(...scores), max: scores.length === 0 ? null : Math.max(...scores) },
      tokens: stat(tokens),
      wallMs: stat(group.map((entry) => entry.wallMs)),
    };
  }).sort((a, b) => rank(tasks, a.task) - rank(tasks, b.task) || rank(configs, a.config) - rank(configs, b.config) || rank(efforts, a.effort) - rank(efforts, b.effort));

  const headroom = tasks.map((task) => {
    const cell = rows.find((row) => row.task === task && row.config === 'minimal' && row.effort === 'medium');
    const count = cell?.trials ?? 0;
    const average = cell?.score.mean ?? null;
    // Rounded before the comparison: a mean that is 0.8 on paper must not land at 0.7999999 and read as headroom.
    const verdict = count < HEADROOM_TRIALS || average === null ? 'incomplete' : Math.round(average * 1e9) / 1e9 < HEADROOM_BELOW ? 'keep' : 'drop';
    return { task, verdict, trials: count, mean: average };
  });
  return { rows, headroom };
}

const scoreText = (value) => (Number.isFinite(value) ? value.toFixed(2) : 'unknown');
const tokenText = (value) => (!Number.isFinite(value) ? 'unknown' : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value)));
const duration = (ms) => {
  if (!Number.isFinite(ms)) return 'unknown';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
};
const table = (header, body) => {
  const widths = header.map((cell, column) => Math.max(cell.length, ...body.map((line) => line[column].length)));
  return [header, ...body].map((line) => line.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd());
};

/** The summary as text: the table of rows, and the screen. A mean over only some of a group's trials carries a
 * `*` (the others did not report that value).
 *
 * `screen: false` is for a run of the subagent or honesty configs: the screen reads the minimal config alone, so it would
 * call every task of such a run incomplete. The rows are what any run has, and one line says where the reading of this
 * kind of run is, since it is not here: `report`, the script that compares the arms (`evals/subagents-report.mjs` by
 * default, `evals/honesty-report.mjs` for an honesty run). */
export function formatSummary(summary, { screen = true, report = 'evals/subagents-report.mjs' } = {}) {
  if (summary.rows.length === 0) return 'no trial recorded yet\n';
  const partial = (stats, row) => (stats.known < row.trials && stats.known > 0 ? '*' : '');
  const lines = table(
    ['task', 'config', 'effort', 'trials', 'score mean', 'min', 'max', 'tokens', 'wall'],
    summary.rows.map((row) => [row.task, row.config, row.effort, String(row.trials), scoreText(row.score.mean), scoreText(row.score.min), scoreText(row.score.max),
      `${tokenText(row.tokens.mean)}${partial(row.tokens, row)}`, `${duration(row.wallMs.mean)}${partial(row.wallMs, row)}`]),
  );
  if (summary.rows.some((row) => [row.tokens, row.wallMs].some((stats) => stats.known < row.trials && stats.known > 0))) lines.push('* mean over the trials that reported it');
  if (!screen) return `${[...lines, '', `The comparison of the two arms is ${report}'s.`].join('\n')}\n`;
  lines.push('', `Headroom screen (minimal at medium: keep when ${HEADROOM_TRIALS} or more trials average below ${HEADROOM_BELOW}, drop at ${HEADROOM_BELOW} or above)`);
  lines.push(...table(
    ['task', 'verdict'],
    summary.headroom.map((entry) => [entry.task, entry.verdict === 'incomplete' ? `incomplete (${entry.trials} of ${HEADROOM_TRIALS} trials)` : `${entry.verdict} (mean ${scoreText(entry.mean)} over ${entry.trials} trials)`]),
  ));
  return `${lines.join('\n')}\n`;
}

// ---- the results file ------------------------------------------------------------------------------------------------

const FORMAT = 1;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The results document at `file`, or `null` when there is none. One that cannot be read, or is not of this
 * format, throws and is left as it is: a run must never overwrite what it could not understand. */
function readResultsDocument(file) {
  if (!fs.existsSync(file)) return null;
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} is not valid JSON (${err.message}); it is left as it is`);
  }
  if (!isObject(doc) || doc.format !== FORMAT || !Array.isArray(doc.trials)) throw new Error(`${file} is not a results file of format ${FORMAT}; it is left as it is`);
  return doc;
}

/** Writes the whole document to a temporary file and renames it over `file`, so a crash leaves the previous
 * complete document, never half of a new one. */
function writeResultsDocument(file, doc) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(doc, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

// ---- the entry --------------------------------------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PREFIX = 'js-harness-suite-template-';
// Every signal `runProcess` would forward for a caller that passes no abort signal: the suite passes one, so it
// owns them all. SIGHUP is a terminal that closed; unhandled, it would end the suite and leave the agent running.
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/** The directories that making `dir` would make, `dir` first and then each parent that is not there either. */
const absentDirs = (dir) => {
  const absent = [];
  for (let at = dir; !fs.existsSync(at) && path.dirname(at) !== at; at = path.dirname(at)) absent.push(at);
  return absent;
};

/** `config` with the eval's login `token` in the env of its trials. The token is laid over whatever the config's own
 * env gives, and nothing of that env is dropped: a subagent config's two variables stay under it. */
export const withToken = (config, token) => ({ ...config, env: (context) => ({ ...config.env(context), CLAUDE_CODE_OAUTH_TOKEN: token }) });

const taskIdsIn = (tasksDir) => (fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : []);

/** The command. Resolves to the exit code: 0 for a run that finished (a trial that failed is a result, not a
 * failure of the run) or a summary printed, 1 for a run that stopped, refused or threw, and 2 for a usage error;
 * the usage error is raised before anything is created. Everything it prints goes through `deps.stdout` and
 * `deps.stderr`, and everything outside this file is injectable: `runTrial`, `readStack`, `checkWorkRoot`, `runInit`,
 * `fileExists`, `now`, `process` (for the interrupt handlers), the directories and the real home.
 *
 * What a run does, in this order, so that each refusal comes before the next thing is made: parse the arguments;
 * read the login token from `JS_HARNESS_EVAL_OAUTH_TOKEN` (and no other variable); check the work root;
 * load the tasks; read the results file and the stack, and refuse to continue a run whose stack changed;
 * build the home template (current arm only); run the trials, each recorded as it ends; and, whatever
 * happened, remove the template. An interrupt (SIGINT, SIGTERM or SIGHUP) aborts the running trial, which stops its agent
 * and cleans up before it returns; then the template is removed and the process ends with the signal's status
 * (`proc.exit`, so a test's stand-in sees it after all of that). The trial in flight records nothing.
 *
 * A Codex run (`--agent codex`) is the same run with what is Codex's in place of what is Claude Code's. Its results
 * and raw logs go to a `codex` directory inside `resultsDir` and `runsDir`, and its document names its agent. It
 * reads no token: its login is the real `<home>/.codex/auth.json`, which every trial copies into its own home. In
 * place of the token check, and at the same point (before the work root, the stack and the template, so it costs
 * nothing), the login must be there and its access token must have enough hours left (`assertLoginFresh`, by the
 * `now` clock; it reads that token's expiry and nothing else of the file, and the hours left are printed):
 * a refusal exits 2 like the Codex probe's, with the message that says what to do and without the usage, since the
 * command line was right. Its stack is `readCodexStack`'s (`deps.readCodexStack`), read in a throwaway home of the
 * work root, and its template is the Codex one, which never holds the login. A Codex version that cannot be read
 * is the same kind of refusal, exit 2, for a new run and a continued one alike, before the template and any trial:
 * the stack of a run is what a continued run is compared with, and an unknown version would equal an unknown one.
 * A work root that reading the stack made is removed again whenever the run does not go on from there.
 *
 * A run of the subagent configs (`--configs sub-...`) is a Claude Code run in every step above, with three things of
 * its own. Its results and raw logs go to a `subagents` directory inside `resultsDir` and `runsDir`. No home template
 * is built: its configs are the minimal arm's, which seeds nothing. And its document pins the subagent model and the
 * delegation text of each config (`subagentConfigs`), which a continued run is compared with like the stack
 * (`diffRun`) and may add to. Its summary is the rows without the screen (`formatSummary`), at the end of a run and
 * for `--summary --subagents`, which is the only way a summary reads that directory: it never falls back from one
 * directory to another, so a run is never taken for one of the same name of another kind.
 *
 * A run of the honesty configs (`--configs honesty-...`) is the same, with its results in a `honesty` directory and its
 * pin of each config's project memory (`honestyConfigs`, `honestyPin`) in place of the subagent pins. Its summary is
 * `evals/honesty-report.mjs`'s report for `--summary --honesty`, and the rows for the run's own end.
 *
 * A run stops, exit 1, at a trial whose reading the runner refuses (`runSuite`, the `reader` stop), whatever the
 * agent: nothing is recorded for that trial, its raw output is kept with the run's raw logs, and the same command
 * repeats exactly that trial. */
export async function suiteMain(argv, env = process.env, deps = {}) {
  const {
    stdout = process.stdout, stderr = process.stderr,
    repoRoot = path.resolve(HERE, '..'),
    tasksDir = path.join(HERE, 'tasks'), resultsDir = path.join(HERE, 'results'), runsDir = path.join(HERE, 'runs'),
    realHome = os.homedir(),
    checkWorkRoot = assertWorkRoot,
    readStack: stackOf = readStack,
    readCodexStack: codexStackOf = readCodexStack,
    runTrial = runRealTrial,
    runInit,
    fileExists = fs.existsSync,
    now = () => new Date(),
    process: proc = process,
    markBatch: mark = markBatch,
  } = deps;
  let token = '';
  // Anything that is printed or stored passes through here once the token is known: a message a trial produced
  // (an error text, a log line) may repeat what it was given.
  const redact = (text) => (token === '' ? String(text) : String(text).split(token).join('<token>'));
  const scrub = (value) => (typeof value === 'string' ? redact(value) : Array.isArray(value) ? value.map(scrub) : isObject(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item)])) : value);
  const say = (text) => stdout.write(redact(text));
  const warn = (text) => stderr.write(redact(text));

  let args;
  try {
    args = parseArgs(argv, { taskIds: taskIdsIn(tasksDir), tasksDir });
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    warn(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }
  const codex = args.agent === 'codex';
  // The model of the run: the one `--model` names, or the default constant, so a command line that names none means
  // what it meant before the flag existed. A summary reads its model from the file and uses none of this.
  const model = args.model ?? (codex ? CODEX_EVAL_MODEL : EVAL_MODEL);
  // A run names subagent configs or the two arms, never both (`parseArgs`); a summary names no config at all, and
  // says with a flag of its own which kind of run it reads.
  const subagents = args.mode === 'run' ? args.configs.some(isSubagentConfig) : args.subagents === true;
  const honesty = args.mode === 'run' ? args.configs.some(isHonestyConfig) : args.honesty === true;
  // Where this run's results file and raw logs live: a Codex run's, a subagent run's and an honesty run's each in a
  // directory of their own (see `CODEX_DIR`, `SUBAGENTS_DIR` and `HONESTY_DIR`).
  const ownDir = codex ? CODEX_DIR : subagents ? SUBAGENTS_DIR : honesty ? HONESTY_DIR : null;
  // What a run and its summary print for the rows: the screen is F5's alone, and the other kinds name their own report.
  const printing = { screen: !subagents && !honesty, report: honesty ? 'evals/honesty-report.mjs' : 'evals/subagents-report.mjs' };
  const resultsHome = ownDir === null ? resultsDir : path.join(resultsDir, ownDir);
  const rawHome = ownDir === null ? runsDir : path.join(runsDir, ownDir);
  const file = path.join(resultsHome, `${args.name}.json`);

  if (args.mode === 'summary') {
    try {
      const doc = readResultsDocument(file);
      if (doc === null) {
        warn(`no results named ${args.name} in ${resultsHome}\n`);
        return 1;
      }
      // An honesty run is checked as its report checks it: one task and one effort, both arms (Codex, 2026-10-15).
      say(honesty ? `${reportLines(summarize(checkResults(doc, file))).join('\n')}\n` : formatSummary(summarizeResults(doc), printing));
      return 0;
    } catch (err) {
      warn(`${err.message}\n`);
      return 1;
    }
  }

  // `--plan` (G3 of `odd/tasks/future-model-protocol.md`): what the run would cost, from the results files of its own
  // directory, said before anything is spent. It needs no token, no binary and no login, and writes nothing.
  if (args.plan) {
    try {
      const own = readResultsDocument(file);
      // A run recorded on another model is not continued (`runChanges`), so none of its trials is one this run has
      // done: the plan says the run would be refused rather than count them as recorded.
      if (own !== null && (own.model ?? null) !== model) {
        warn(`${file} was recorded on ${own.model ?? 'an unknown model'}: a run on ${model} would be refused. Pass --model ${own.model} to plan its continuation, or another --name for a new run.\n`);
        return 1;
      }
      const recorded = new Set((own?.trials ?? []).map(trialKey));
      let planned = 0;
      const toRun = [];
      for (const task of args.tasks) {
        for (const config of args.configs) {
          for (const effort of args.efforts) {
            for (let repeat = 1; repeat <= args.repeats; repeat += 1) {
              planned += 1;
              if (!recorded.has(trialKey({ task, config, effort, repeat }))) toRun.push({ task, config, effort });
            }
          }
        }
      }
      const docs = (fs.existsSync(resultsHome) ? fs.readdirSync(resultsHome) : [])
        .filter((name) => name.endsWith('.json'))
        .flatMap((name) => {
          try {
            const doc = readResultsDocument(path.join(resultsHome, name));
            return doc === null ? [] : [{ name: name.slice(0, -'.json'.length), doc }];
          } catch (err) {
            warn(`--plan leaves out ${name}: ${err.message}\n`);
            return [];
          }
        });
      const agent = agentOf(args);
      say(`${planLines(runPlan({ planned, toRun, basis: cellBasis({ docs, model, agent }), model, agent })).join('\n')}\n`);
      return 0;
    } catch (err) {
      warn(`${err.message}\n`);
      return 1;
    }
  }

  // The arms of one component (G2 of `odd/tasks/future-model-protocol.md`): those taken out of current run in a home
  // seeded from its template. A minimal-with arm is named and planned, but its home is not built yet: run as it is it
  // would be the minimal arm under another name, so a run that names one stops here.
  const arms = args.configs.filter((name) => parseArm(name, agentOf(args)) !== null);
  const unbuilt = arms.filter((name) => parseArm(name, agentOf(args)).base !== 'current');
  if (unbuilt.length > 0) {
    warn(`${unbuilt.join(', ')}: the minimal-with arms are not built yet, so no trial of them can run; --plan states what they would cost.\n`);
    return 2;
  }

  const binaryFlag = COMMAND_LINES[agentOf(args)].binary;
  const binary = codex ? args.codex : args.claude;
  if (!fileExists(binary)) {
    warn(`${binaryFlag} ${binary} does not exist\n\n${USAGE}\n`);
    return 2;
  }
  // The login of a Codex trial: the real file, which each trial copies into its own home (`codex-configs.mjs`).
  const authFile = codex ? path.join(codexHomeOf(realHome), 'auth.json') : null;
  if (codex) {
    // Before anything is built or run: a login too near its expiry for a run must cost nothing to find.
    try {
      const { hoursLeft, expiresAt } = assertLoginFresh(authFile, { now: now().getTime() });
      warn(`Codex login: its access token has ${hoursLeft.toFixed(1)} hours left, until ${expiresAt} (a run needs at least ${DEFAULT_MIN_LOGIN_HOURS_LEFT})\n`);
    } catch (err) {
      warn(`${err.message}\nNo trial was started and nothing was created.\n`);
      return 2;
    }
  } else {
    token = String(env[TOKEN_VARIABLE] ?? '').trim();
    if (token === '') {
      warn(`${TOKEN_VARIABLE} is not set, or is empty: create the eval's token with \`claude setup-token\` and keep it in that user environment variable. `
        + 'A CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_* variable of this environment is deliberately not used, so no trial can run on a login that is not the eval\'s.\n');
      return 1;
    }
  }

  let templateParent = null;
  // The mark the guard reads while trials run, as it reads a gate's holder (first-version T6a): set before the first
  // trial, taken away on every way out.
  let unmark = () => {};
  let doc;
  let code = 0;
  const cleanupFailures = [];
  /** Removes the home template, which holds copies of the real configuration's account data. Synchronous and
   * idempotent, so the interrupt handler and the `finally` below can both call it. */
  const release = () => {
    if (templateParent === null) return;
    const parent = templateParent;
    templateParent = null;
    const note = (message) => cleanupFailures.push(message);
    try {
      // Each kind of template is removed by its own check of the marker, which refuses the other's.
      (codex ? removeCodexTemplate : removeTemplate)(path.join(parent, 'template'));
    } catch (err) {
      note(`could not remove the home template: ${err.message}`);
    }
    removeDir(parent, 'template directory', note);
  };
  // An interrupt must not end the process by itself: the active agent runs detached, so it would go on, spending the
  // subscription, with its workspace, its home and whatever it started left behind. The first signal aborts the
  // running trial instead; the trial stops its agent's tree and cleans up as on every other way out, `runSuite`
  // returns, and only then are the template removed and the process ended, with the signal's status. A second
  // signal, for a cleanup that hangs, removes the template and ends the process at once.
  const interrupted = new AbortController();
  let interruptedBy = null;
  const statusOf = (signal) => 128 + (os.constants.signals[signal] ?? 0);
  const onSignal = (signal) => {
    if (interruptedBy === null) {
      interruptedBy = signal;
      warn(`${signal}: stopping the active trial and cleaning up (send it again to end the process at once)\n`);
      interrupted.abort();
      return;
    }
    unmark();
    release();
    for (const message of cleanupFailures) warn(`${message}\n`);
    proc.exit(statusOf(signal));
  };

  try {
    const workRoot = args.workRoot ?? defaultWorkRoot({ repoRoot });
    checkWorkRoot(workRoot, { realHome });
    const tasks = args.tasks.map((id) => loadTask(path.join(tasksDir, id)));
    const existing = readResultsDocument(file);
    // Reading the stack of a Codex run makes the work root when it is not there (`readCodexStack`), before this run
    // is known to go on. So every way out that starts nothing gives back what that made: the directories that were
    // absent, the work root first, and each only while it is empty (`rmdirSync` removes nothing else). A work root
    // that was there, or that holds anything, is not this run's to remove.
    const madeForStack = codex ? absentDirs(workRoot) : [];
    const giveBackWorkRoot = () => {
      for (const dir of madeForStack) {
        try {
          fs.rmdirSync(dir);
        } catch {
          return;
        }
      }
    };
    let run;
    if (codex) {
      let stack;
      try {
        stack = await codexStackOf({ codex: args.codex, workRoot, log: (message) => warn(`${message}\n`) });
      } catch (err) {
        giveBackWorkRoot();
        throw err;
      }
      // A Codex run is never started, new or continued, on a version nobody could read: `diffRun` takes an unknown
      // version to equal an unknown one, so such a run could be continued on another CLI and nothing would say so.
      // Nothing is paid for yet here, so stopping costs nothing; it exits 2 like the login's refusal, and without
      // the usage for the same reason.
      if ((stack?.codex ?? null) === null) {
        giveBackWorkRoot();
        warn(`The version of Codex could not be read: \`${args.codex} --version\`, run under the environment of a trial in a throwaway home of ${workRoot}, `
          + 'failed, timed out or printed nothing. A run records the version it is measured on and a continued run is compared with it, so one is not started without it. '
          + 'Check that --codex names the real binary and that it answers --version, then run again.\nNo trial was started and no template was built.\n');
        return 2;
      }
      run = { agent: args.agent, model, permissionMode: CODEX_PERMISSION_MODE, stack };
    } else {
      run = { model, permissionMode: args.permissionMode, stack: await stackOf({ claude: args.claude, home: realHome }) };
      // Pinned only by a run of subagent or honesty configs, so what F5 recorded keeps the shape it always had.
      if (subagents) run.subagentConfigs = Object.fromEntries(args.configs.map((name) => [name, subagentPin(name)]));
      if (honesty) run.honestyConfigs = Object.fromEntries(args.configs.map((name) => [name, honestyPin(name)]));
    }
    if (existing) {
      const changes = runChanges(existing, run);
      if (changes.length > 0) {
        giveBackWorkRoot();
        warn(refusalOf(file, changes));
        // The model is the one thing of a recorded run a flag restores, so the refusal names the flag.
        const modelChange = changes.find((change) => change.field === 'model' && change.recorded !== null);
        if (modelChange) warn(`It was recorded on ${modelChange.recorded}: pass --model ${modelChange.recorded} to continue it.\n`);
        return 1;
      }
    }
    // A model with no list price still runs, but its cost cannot be checked: the warning says which table lacks it
    // (step 1 of `docs/future-model.md`).
    if (!codex && !Object.hasOwn(LIST_PRICES, model)) {
      warn(`${model} has no list price in evals/prices.mjs: the only cost recorded is Claude Code's own costUsd, unchecked until a row is added.\n`);
    }
    if (codex && !Object.hasOwn(CODEX_LIST_PRICES, model)) {
      warn(`${model} has no list price in CODEX_LIST_PRICES (evals/report.mjs): the report's cost is unknown until a row is added; the tokens are recorded.\n`);
    }
    doc = existing ?? { format: FORMAT, name: args.name, createdAt: now().toISOString(), ...run, args: null, trials: [] };
    // A continued run keeps the pin of every config it ever ran, and adds those of the configs it gains.
    if (run.subagentConfigs) doc.subagentConfigs = { ...doc.subagentConfigs, ...run.subagentConfigs };
    if (run.honestyConfigs) doc.honestyConfigs = { ...doc.honestyConfigs, ...run.honestyConfigs };
    doc.args = { [agentOf(args)]: binary, configs: args.configs, efforts: args.efforts, repeats: args.repeats, tasks: args.tasks, workRoot };

    for (const signal of SIGNALS) proc.on(signal, onSignal);
    let seed;
    const seeds = {};
    // An arm of one component is always beside its base (`parseArgs`), so a run of one builds the template too.
    if (args.configs.includes('current')) {
      fs.mkdirSync(workRoot, { recursive: true });
      templateParent = fs.mkdtempSync(path.join(workRoot, TEMPLATE_PREFIX));
      const templateDir = path.join(templateParent, 'template');
      // Built once per run and copied into every trial's home, for either agent: Codex's is the frozen copy of the
      // real `.codex`, which never holds the login (`codex-home.mjs`).
      const built = (codex ? buildCodexTemplate : buildTemplate)({ realHome, templateDir });
      for (const warning of built.warnings) warn(`home template: ${warning}\n`);
      // The setup the current arm runs on (G6 of `odd/tasks/future-model-protocol.md`): recorded with the run, and a
      // run continued only on the same one. A file whose current trials were recorded before setups were has none,
      // so nothing says what they ran on, and it is not continued either.
      const changes = setupChanges(doc, built.fingerprint);
      if (changes.length > 0) {
        warn(refusalOf(file, changes));
        return 1;
      }
      // Each arm of one component is the same template with a filter after the seed, pinned by what the filter takes
      // out: a component the template does not hold, or a cut that moved since the file was recorded, stops the run
      // here, before any trial, and nothing is written.
      const pins = armPins(arms, agentOf(args), path.join(templateDir, PAYLOAD));
      const cuts = armChanges(doc, pins);
      if (cuts.length > 0) {
        warn(refusalOf(file, cuts));
        return 1;
      }
      doc.setup = built.fingerprint;
      if (arms.length > 0) doc.arms = { ...doc.arms, ...pins };
      const seedOf = codex ? seedFromCodexTemplate : seedFromTemplate;
      seed = seedOf(templateDir, { runInit });
      for (const name of arms) seeds[name] = seedOf(templateDir, { runInit, without: pins[name].components });
    }
    let configs;
    if (codex) {
      // No credential rides a Codex trial's environment: each arm copies the login file into the trial's own home
      // last, and deletes that copy first (`codex-configs.mjs`). The minimal arm has no seed.
      const options = { command: args.codex, model, authFile };
      configs = args.configs.map((name) => (name === 'current' ? codexCurrentConfig({ ...options, seed })
        : Object.hasOwn(seeds, name) ? codexCurrentConfig({ ...options, name, seed: seeds[name] }) : codexMinimalConfig(options)));
    } else {
      const options = { command: args.claude, model, permissionMode: args.permissionMode };
      const configOf = (name) => (name === 'current' ? currentConfig({ ...options, seed })
        : Object.hasOwn(seeds, name) ? currentConfig({ ...options, name, seed: seeds[name] })
        : isSubagentConfig(name) ? subagentConfig(name, options) : isHonestyConfig(name) ? honestyConfig(name, options) : minimalConfig(options));
      // The token goes into the trial's env here and nowhere else: the allowlist inherits CLAUDE_CODE_OAUTH_TOKEN
      // from the launching environment, and this overrides whatever that holds. A subagent config lays its two
      // variables over the sandbox env the same way, and they stay under the token.
      configs = args.configs.map((name) => withToken(configOf(name), token));
    }

    const store = {
      read: () => doc.trials,
      append: (record) => {
        doc.trials.push(scrub(record));
        writeResultsDocument(file, doc);
      },
    };
    const planned = planTrials({ tasks, configs, efforts: args.efforts, repeats: args.repeats }).length;
    const recorded = new Set(doc.trials.map(trialKey));
    warn(`${planned} trials planned, ${planned - recorded.size} to run (${recorded.size} already recorded in ${file})\n`);
    const reporting = async (trial) => {
      const outcome = await runTrial(trial);
      const label = `${trial.task.id} ${trial.config.name} ${trial.effort} #${trial.repeat}`;
      if (outcome.status === 'recorded') warn(`${label}: score ${scoreText(outcome.record.score)}${outcome.record.error ? ` (${outcome.record.error})` : ''}, ${duration(outcome.record.wallMs ?? null)}\n`);
      else if (outcome.status === 'interrupted') warn(`${label}: interrupted, not recorded\n`);
      else warn(`${label}: stopped (${outcome.reason})\n`);
      return outcome;
    };
    // Raw logs are named by task, config, effort and repeat, so runs that share trials (the headroom screen and the
    // A/B run) would overwrite each other's in one directory: each run keeps its own, named like its results file.
    unmark = mark(env.JS_HARNESS_HOME || realHome, { cwd: repoRoot, command: `suite ${argv.join(' ')}` });
    const result = await runSuite({
      tasks, configs, efforts: args.efforts, repeats: args.repeats, store, runsDir: path.join(rawHome, args.name), workRoot,
      runTrial: reporting, signal: interrupted.signal, log: (message) => warn(`${message}\n`),
    });
    if (result.status === 'interrupted') {
      warn(`interrupted: ${doc.trials.length} trials are recorded in ${file}; run the same command again to continue.\n`);
    } else {
      if (result.status === 'stopped') {
        warn(`the suite stopped: ${result.reason} (${result.message}). ${doc.trials.length} trials are recorded in ${file}; fix the cause and run the same command again to continue.\n`);
        code = 1;
      }
      say(`results: ${file}\n\n${formatSummary(summarizeResults(doc), printing)}`);
    }
  } catch (err) {
    warn(`the suite failed: ${err.message}\n`);
    code = 1;
  } finally {
    for (const signal of SIGNALS) proc.removeListener(signal, onSignal);
    unmark();
    release();
    for (const message of cleanupFailures) warn(`${message}\n`);
    if (cleanupFailures.length > 0) code = 1;
  }
  if (interruptedBy !== null) {
    // Everything is cleaned up by now: the trial, the template. The process ends with the signal's status, as a
    // process killed by that signal would, not with the 0 or 1 of a run that finished.
    code = statusOf(interruptedBy);
    proc.exit(code);
  }
  return code;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = await suiteMain(process.argv.slice(2), process.env);
}

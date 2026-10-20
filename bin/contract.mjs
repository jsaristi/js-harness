#!/usr/bin/env node
// `contract`: the task contract at the head of a feature document (see odd/tasks/task-contract.md
// and bin/lib/contract.mjs). `template` prints the template; `check` validates contracts statically
// and never runs the commands they name; `run` runs them and reports met or not met; `goal` prints
// the `/goal` condition that makes a session run `run`; `modes` prints the effort and sub-agent models
// each task's kind calls for (odd/tasks/effort-by-task.md). Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONTRACT_TEMPLATE, doneWhen, isContract, modeLine, parseContract, taskModes, validateContract } from './lib/contract.mjs';
import { ruleHere, ruleOf, ruleValue } from './lib/rules.mjs';

export const USAGE =
  'Usage: js-harness contract template | check [file...] [--cwd <dir>] | run <file> [--timeout <minutes>] [--cwd <dir>] | goal <file> [--cwd <dir>] | modes <file> [--task <id>] [--cwd <dir>]';

// Each done-when command may run this long, unless `run --timeout <minutes>` says otherwise: the declared
// rule `contract-run-timeout` (bin/lib/rules-data.mjs).
export const DEFAULT_TIMEOUT_MINUTES = ruleValue('contract-run-timeout', 'minutes');
// The `js-harness.mjs` beside this file: the one that is running, whatever `js-harness` is on PATH.
const RUNNING_HARNESS = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));

// The documented `/goal` condition limit (https://code.claude.com/docs/en/goal).
const GOAL_LIMIT = 4000;
// An Ask me before text longer than this is referenced by the condition, not copied into it.
const ASK_INLINE_MAX = 200;
// Set for every done-when command `run` starts, so a command that is `contract run` itself is refused.
const RUN_GUARD = 'JS_HARNESS_CONTRACT_RUN';

class ContractArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new ContractArgError(`${flag} requires a value`);
  return value;
}

// A plain decimal: no sign, hex, exponent or `Infinity`, which `Number()` would all accept.
const DECIMAL_PATTERN = /^(\d+(\.\d+)?|\.\d+)$/;
const MAX_TIMEOUT_MS = 2 ** 31 - 1; // what a Node timer can hold

/** A `--timeout` value in minutes: a plain decimal that is at least 1 ms and at most a Node timer
 * can hold, once converted to whole milliseconds. */
function parseMinutes(raw) {
  const minutes = DECIMAL_PATTERN.test(raw) ? Number(raw) : NaN;
  const ms = toMilliseconds(minutes);
  if (!(ms >= 1 && ms <= MAX_TIMEOUT_MS)) {
    throw new ContractArgError('--timeout requires a plain decimal number of minutes, from 0.00002 (1 ms) up to about 35,791');
  }
  return minutes;
}

/** Minutes as the whole milliseconds `spawn` takes: a fractional `timeout` would be rejected or truncated. */
const toMilliseconds = (minutes) => Math.round(minutes * 60 * 1000);

/** Walks argv token by token, so an unknown flag is a usage error and never a silently ignored one. */
function parseArgs(argv, { timeout: allowTimeout = false, task: allowTask = false } = {}) {
  const files = [];
  let cwd;
  let task;
  let timeoutMinutes = DEFAULT_TIMEOUT_MINUTES;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--cwd') {
      cwd = requireValue(argv, i, token);
      i += 1; // consume the value too, so it is never re-read as a file
    } else if (token === '--timeout' && allowTimeout) {
      timeoutMinutes = parseMinutes(requireValue(argv, i, token));
      i += 1;
    } else if (token === '--task' && allowTask) {
      task = requireValue(argv, i, token);
      i += 1;
    } else if (token.startsWith('--')) {
      throw new ContractArgError(`unknown argument: ${token}`);
    } else {
      files.push(token);
    }
  }
  return { files, cwd, timeoutMinutes, task };
}

/** The repository's top-level directory for `cwd`, else `cwd` itself: where `odd/tasks/` lives. */
function projectRoot(cwd, spawn) {
  return gitTopLevel(cwd, spawn) ?? cwd;
}

/** The git top-level of `cwd`, or `null` when git is missing or `cwd` is not in a repository. */
function gitTopLevel(cwd, spawn) {
  try {
    const result = spawn('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
    if (result && !result.error && result.status === 0 && result.stdout.trim()) return path.resolve(result.stdout.trim());
  } catch {
    // No git on PATH: the caller falls back.
  }
  return null;
}

/** Every `odd/tasks/*.md` under `root` that is a contract, sorted by name, as `{ label, markdown }`
 * (label: the repo-relative path). A file that cannot be read comes back as `{ label, error }` so a
 * gate reports it instead of skipping it; an absent `odd/tasks/` is simply no contracts. Shared with
 * the `contracts` row of `bin/check.mjs`. */
export function discoverContracts(
  root,
  { readFile = (p) => fs.readFileSync(p, 'utf8'), readdir = (p) => fs.readdirSync(p), stat = (p) => fs.statSync(p) } = {},
) {
  const dir = path.join(root, 'odd', 'tasks');
  let names;
  try {
    names = readdir(dir);
  } catch (err) {
    return err.code === 'ENOENT' ? [] : [{ label: 'odd/tasks', error: err.code ?? err.message }];
  }
  const found = [];
  for (const name of names.filter((n) => n.endsWith('.md')).sort()) {
    const label = `odd/tasks/${name}`;
    try {
      const absolute = path.join(dir, name);
      if (!stat(absolute).isFile()) continue; // e.g. a directory named `x.md`
      const markdown = readFile(absolute);
      if (isContract(markdown)) found.push({ label, markdown });
    } catch (err) {
      // Fail closed on purpose: a file we cannot read is not known to be a non-contract, and a gate
      // must not hide it.
      found.push({ label, error: err.code ?? err.message });
    }
  }
  return found;
}

/** One `{ label, ok, errors }` per entry from `discoverContracts` or from explicit files. */
export function validateEntries(entries) {
  return entries.map(({ label, markdown, error }) => {
    if (error) return { label, ok: false, errors: [`cannot read: ${error}`] };
    if (!isContract(markdown)) return { label, ok: false, errors: ['not a contract: no "## Goal" heading'] };
    const { ok, errors } = validateContract(markdown);
    return { label, ok, errors };
  });
}

/** Entries for the files named on the command line, resolved from `cwd`, labelled as given. */
function explicitEntries(files, cwd) {
  return files.map((file) => {
    try {
      return { label: file, markdown: fs.readFileSync(path.resolve(cwd, file), 'utf8') };
    } catch (err) {
      return { label: file, error: err.code ?? err.message };
    }
  });
}

function checkCommand(argv, { cwd: defaultCwd, stdout, stderr, spawn }) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const cwd = path.resolve(parsed.cwd ?? defaultCwd);
  const entries = parsed.files.length ? explicitEntries(parsed.files, cwd) : discoverContracts(projectRoot(cwd, spawn));
  if (entries.length === 0) {
    stdout('no contracts under odd/tasks');
    return 0;
  }
  const results = validateEntries(entries);
  for (const { label, ok, errors } of results) {
    stdout(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    for (const reason of errors) stdout(`      ${reason}`);
  }
  return results.every((result) => result.ok) ? 0 : 1;
}

function templateCommand(argv, { stdout, stderr }) {
  if (argv.length > 0) {
    stderr(`unknown argument: ${argv[0]}\n\n${USAGE}`);
    return 2;
  }
  stdout(CONTRACT_TEMPLATE.replace(/\n$/, ''));
  return 0;
}

/** The one contract file `run` and `goal` take: `{ file, cwd }`, or `{ code: 2 }` after printing
 * usage when the command line is not exactly one file plus an optional `--cwd` (and, for `run`,
 * `--timeout`), with the timeout in minutes. */
function parseOneFile(argv, stderr, defaultCwd, options) {
  try {
    const { files, cwd, timeoutMinutes, task } = parseArgs(argv, options);
    if (files.length !== 1) throw new ContractArgError('expected exactly one contract file');
    return { file: files[0], cwd: path.resolve(cwd ?? defaultCwd), timeoutMinutes, task };
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return { code: 2 };
  }
}

/** `text` with its trailing whitespace and periods dropped, so items join into a sentence cleanly. */
const trimmed = (text) => text.replace(/[.\s]+$/, '');

/** Lines of a command's captured output, indented under its PASS/FAIL row. */
function indented(...streams) {
  const text = streams.join('').replace(/\r\n/g, '\n').replace(/\s+$/, '');
  return text === '' ? [] : text.split('\n').map((line) => `      ${line}`);
}

/** Why a command that did not exit 0 failed, for its FAIL row. */
function failure(result, timeoutMinutes) {
  if (result.error?.code === 'ETIMEDOUT') return `timed out after ${timeoutMinutes} min`;
  if (result.error) return `error ${result.error.code ?? result.error.message}`;
  if (result.status === null || result.status === undefined) return `signal ${result.signal ?? 'unknown'}`;
  return `exit ${result.status}`;
}

/** The run of one done-when command: `runSensor` of `check.mjs`, which at the timeout stops the whole
 * process tree of the command, and after the shell exits whatever the command left holding its output.
 * `spawnSync`'s own timeout kills only the shell (`cmd.exe`, `sh`), so the real command behind it ran on
 * after `contract run` had answered "timed out". Imported when a command runs and not at the top, since
 * `check.mjs` imports this file. */
const startInTree = async (command, options) => (await import('./check.mjs')).runSensor(command, options);

async function runCommand(argv, { cwd: defaultCwd, stdout, stderr, spawn, env, start }) {
  if (env[RUN_GUARD] === '1') {
    stderr(`contract run started inside another contract run (${RUN_GUARD} is set): a done-when command must not be \`contract run\` itself`);
    return 2;
  }
  const parsed = parseOneFile(argv, stderr, defaultCwd, { timeout: true });
  if (parsed.code) return parsed.code;
  const [entry] = explicitEntries([parsed.file], parsed.cwd);
  const [result] = validateEntries([entry]);
  if (!result.ok) {
    stdout(`FAIL  ${result.label}`);
    for (const reason of result.errors) stdout(`      ${reason}`);
    stdout('not met');
    return 1;
  }

  const { commands, checks } = doneWhen(entry.markdown);
  const root = projectRoot(parsed.cwd, spawn);
  const childEnv = { ...process.env, ...env, [RUN_GUARD]: '1' };
  let met = true;
  // Every command runs, even after a failure: a /goal turn needs the whole picture, not the first red row.
  for (const command of commands) {
    // Through a shell, in the root, one at a time (`start`: `startInTree`, or a test's stand-in).
    const outcome = await start(command, { cwd: root, env: childEnv, timeout: toMilliseconds(parsed.timeoutMinutes) });
    const passed = outcome.status === 0 && !outcome.error;
    met &&= passed;
    stdout(passed ? `PASS  ${command}` : `FAIL  ${command}  (${failure(outcome, parsed.timeoutMinutes)})`);
    for (const line of indented(outcome.stdout ?? '', outcome.stderr ?? '')) stdout(line);
    // Said, not judged: the row is the command's own exit, and a process that could not be stopped is
    // something the reader has to know is still there.
    if (outcome.sweepError) stdout(`      could not stop every process the command started: ${outcome.sweepError}`);
  }
  if (checks.length > 0) {
    stdout('check by hand:');
    for (const check of checks) stdout(`  - ${check}`);
  }
  stdout(met ? 'met' : 'not met');
  return met ? 0 : 1;
}

// What a path may not hold to sit safely inside double quotes: `"` closes them; `` ` `` and `$` are
// expanded by sh and PowerShell; `%` (cmd.exe) and `!` (bash history) are expanded by other shells a
// pasted command may reach; a newline splits the command; a trailing `\` escapes the closing quote.
const UNQUOTABLE_PATTERN = /["`$%!\r\n]|\\$/;

/** `value` in double quotes, which sh and PowerShell both read as one argument; `null` when it holds
 * anything in `UNQUOTABLE_PATTERN`, because a fragile escape is worse than a refusal. */
function quoteArg(value) {
  return UNQUOTABLE_PATTERN.test(value) ? null : `"${value}"`;
}

function goalCommand(argv, { cwd: defaultCwd, stdout, stderr, spawn, harnessPath }) {
  const parsed = parseOneFile(argv, stderr, defaultCwd);
  if (parsed.code) return parsed.code;
  const [entry] = explicitEntries([parsed.file], parsed.cwd);
  const [result] = validateEntries([entry]);
  if (!result.ok) {
    stderr(`${result.label} is not a valid contract:`);
    for (const reason of result.errors) stderr(`  ${reason}`);
    return 1;
  }

  // A /goal lives in one session on one machine, so absolute paths are right here: the command finds
  // the same contract from any working directory, runs this very js-harness, not one on PATH, and
  // runs the checks in the contract's project, since `run` takes its root from `--cwd`. Outside a
  // repository that project is the requested `--cwd`, as for a direct `run`, never the folder the
  // contract happens to sit in.
  const contractPath = path.resolve(parsed.cwd, parsed.file);
  const projectDir = gitTopLevel(path.dirname(contractPath), spawn) ?? projectRoot(parsed.cwd, spawn);
  const paths = [harnessPath, contractPath, projectDir];
  const quoted = paths.map(quoteArg);
  if (quoted.includes(null)) {
    stderr(`cannot be quoted safely: a path holds a double quote, backtick, dollar sign, %, !, newline or trailing backslash (${paths[quoted.indexOf(null)]})`);
    return 1;
  }

  const { checks } = doneWhen(entry.markdown);
  const ask = parseContract(entry.markdown).get('Ask me before').replace(/\s+/g, ' ');
  const inlineAsk = ask.length <= ASK_INLINE_MAX ? `: ${trimmed(ask)}` : '';
  const condition = [
    `\`node ${quoted[0]} contract run ${quoted[1]} --cwd ${quoted[2]}\` exits 0 and prints \`met\``,
    checks.length > 0 ? `; also true by hand: ${checks.map(trimmed).join('; ')}` : '',
    `. Run it after each change and fix what fails; stop and ask if a step needs a decision listed under "Ask me before" in ${contractPath}${inlineAsk}.`,
  ].join('');
  if (condition.length > GOAL_LIMIT) {
    stderr(`the /goal condition is ${condition.length} characters, over the 4,000-character limit: shorten the hand-checkable items in ${contractPath}`);
    return 1;
  }
  stdout(condition);
  // The modes go to stderr, so the condition stays the whole of stdout: it is pasted into /goal as is.
  for (const task of modeLines(entry.markdown, projectDir)) if (!task.done) stderr(task.line);
  return 0;
}

/** The rule `id` as a task's mode reads it in the project whose rules-data.mjs text is `projectData` (or
 * nothing): `ruleHere`'s answer with the rule's short name beside its value, or `null` when the running
 * list does not declare `id`, as for a kind's own effort row that nobody declared. */
function ruleReader(projectData) {
  return (id) => {
    let rule;
    try {
      rule = ruleOf(id);
    } catch {
      return null;
    }
    const here = ruleHere(id, rule.unit, projectData);
    return here.off ? here : { value: here.value, alias: rule.alias };
  };
}

/** The tasks of `markdown` with their mode lines, read against the rules of the project at `root`:
 * `[{ id, kind, done, line }]`. Also read by the resume hook (bin/resume.mjs). */
export function modeLines(markdown, root) {
  let projectData = null;
  try {
    projectData = fs.readFileSync(path.join(root, 'bin', 'lib', 'rules-data.mjs'), 'utf8');
  } catch {
    // A project that declares no rules: every mode says so.
  }
  return taskModes(markdown, ruleReader(projectData)).map((mode) => ({ id: mode.id, kind: mode.kind, done: mode.done, line: modeLine(mode) }));
}

/** `modes`: the mode each open task calls for (its kind's effort and sub-agent models, from the rules
 * list), or the one task `--task` names, open or done. It never runs or changes anything. */
function modesCommand(argv, { cwd: defaultCwd, stdout, stderr, spawn }) {
  const parsed = parseOneFile(argv, stderr, defaultCwd, { task: true });
  if (parsed.code) return parsed.code;
  const file = path.resolve(parsed.cwd, parsed.file);
  let markdown;
  try {
    markdown = fs.readFileSync(file, 'utf8');
  } catch (err) {
    stderr(`cannot read ${parsed.file}: ${err.code ?? err.message}`);
    return 1;
  }
  const root = gitTopLevel(path.dirname(file), spawn) ?? projectRoot(parsed.cwd, spawn);
  const tasks = modeLines(markdown, root);
  if (parsed.task !== undefined) {
    const task = tasks.find((candidate) => candidate.id === parsed.task);
    if (!task) {
      stderr(`no task ${parsed.task} in ${parsed.file}`);
      return 1;
    }
    stdout(task.line);
    return 0;
  }
  const open = tasks.filter((task) => !task.done);
  if (open.length === 0) stdout(`no open task in ${parsed.file}`);
  for (const task of open) stdout(task.line);
  return 0;
}

const SUBCOMMANDS = { template: templateCommand, check: checkCommand, run: runCommand, goal: goalCommand, modes: modesCommand };

export async function contractMain(
  argv,
  env = process.env,
  { cwd = process.cwd(), stdout = console.log, stderr = console.error, spawn = spawnSync, start = startInTree, harnessPath = RUNNING_HARNESS } = {},
) {
  const [subcommand, ...rest] = argv;
  if (!Object.hasOwn(SUBCOMMANDS, subcommand ?? '')) {
    stderr(subcommand ? `unknown subcommand: ${subcommand}\n\n${USAGE}` : USAGE);
    return 2;
  }
  return SUBCOMMANDS[subcommand](rest, { cwd, stdout, stderr, spawn, start, env, harnessPath });
}

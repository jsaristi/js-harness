#!/usr/bin/env node
// `contract`: the task contract at the head of a feature document (see odd/tasks/task-contract.md
// and bin/lib/contract.mjs). `template` prints the template; `check` validates contracts statically
// and never runs the commands they name; `run` runs them and reports met or not met; `goal` prints
// the `/goal` condition that makes a session run `run`. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONTRACT_TEMPLATE, doneWhen, isContract, parseContract, validateContract } from './lib/contract.mjs';

const USAGE =
  'Usage: js-harness contract template | check [file...] [--cwd <dir>] | run <file> [--cwd <dir>] | goal <file> [--cwd <dir>]';

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

/** Walks argv token by token, so an unknown flag is a usage error and never a silently ignored one. */
function parseArgs(argv) {
  const files = [];
  let cwd;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--cwd') {
      cwd = requireValue(argv, i, token);
      i += 1; // consume the value too, so it is never re-read as a file
    } else if (token.startsWith('--')) {
      throw new ContractArgError(`unknown argument: ${token}`);
    } else {
      files.push(token);
    }
  }
  return { files, cwd };
}

/** The repository's top-level directory for `cwd`, else `cwd` itself: where `odd/tasks/` lives. */
function projectRoot(cwd, spawn) {
  try {
    const result = spawn('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
    if (result && !result.error && result.status === 0 && result.stdout.trim()) return path.resolve(result.stdout.trim());
  } catch {
    // No git on PATH: fall back to the directory itself.
  }
  return cwd;
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
 * usage when the command line is not exactly one file plus an optional `--cwd`. */
function parseOneFile(argv, stderr, defaultCwd) {
  try {
    const { files, cwd } = parseArgs(argv);
    if (files.length !== 1) throw new ContractArgError('expected exactly one contract file');
    return { file: files[0], cwd: path.resolve(cwd ?? defaultCwd) };
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
function failure(result) {
  if (result.error) return `error ${result.error.code ?? result.error.message}`;
  if (result.status === null || result.status === undefined) return `signal ${result.signal ?? 'unknown'}`;
  return `exit ${result.status}`;
}

function runCommand(argv, { cwd: defaultCwd, stdout, stderr, spawn, env }) {
  if (env[RUN_GUARD] === '1') {
    stderr(`contract run started inside another contract run (${RUN_GUARD} is set): a done-when command must not be \`contract run\` itself`);
    return 2;
  }
  const parsed = parseOneFile(argv, stderr, defaultCwd);
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
    const outcome = spawn(command, { shell: true, cwd: root, env: childEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const passed = outcome.status === 0 && !outcome.error;
    met &&= passed;
    stdout(passed ? `PASS  ${command}` : `FAIL  ${command}  (${failure(outcome)})`);
    for (const line of indented(outcome.stdout ?? '', outcome.stderr ?? '')) stdout(line);
  }
  if (checks.length > 0) {
    stdout('check by hand:');
    for (const check of checks) stdout(`  - ${check}`);
  }
  stdout(met ? 'met' : 'not met');
  return met ? 0 : 1;
}

function goalCommand(argv, { cwd: defaultCwd, stdout, stderr }) {
  const parsed = parseOneFile(argv, stderr, defaultCwd);
  if (parsed.code) return parsed.code;
  const [entry] = explicitEntries([parsed.file], parsed.cwd);
  const [result] = validateEntries([entry]);
  if (!result.ok) {
    stderr(`${result.label} is not a valid contract:`);
    for (const reason of result.errors) stderr(`  ${reason}`);
    return 1;
  }

  const { checks } = doneWhen(entry.markdown);
  const ask = parseContract(entry.markdown).get('Ask me before').replace(/\s+/g, ' ');
  const inlineAsk = ask.length <= ASK_INLINE_MAX ? `: ${trimmed(ask)}` : '';
  const condition = [
    `\`js-harness contract run ${parsed.file}\` exits 0 and prints \`met\``,
    checks.length > 0 ? `; also true by hand: ${checks.map(trimmed).join('; ')}` : '',
    `. Run it after each change and fix what fails; stop and ask if a step needs a decision listed under "Ask me before" in ${parsed.file}${inlineAsk}.`,
  ].join('');
  if (condition.length > GOAL_LIMIT) {
    stderr(`the /goal condition is ${condition.length} characters, over the 4,000-character limit: shorten the hand-checkable items in ${parsed.file}`);
    return 1;
  }
  stdout(condition);
  return 0;
}

const SUBCOMMANDS = { template: templateCommand, check: checkCommand, run: runCommand, goal: goalCommand };

export async function contractMain(
  argv,
  env = process.env,
  { cwd = process.cwd(), stdout = console.log, stderr = console.error, spawn = spawnSync } = {},
) {
  const [subcommand, ...rest] = argv;
  if (!Object.hasOwn(SUBCOMMANDS, subcommand ?? '')) {
    stderr(subcommand ? `unknown subcommand: ${subcommand}\n\n${USAGE}` : USAGE);
    return 2;
  }
  return SUBCOMMANDS[subcommand](rest, { cwd, stdout, stderr, spawn, env });
}

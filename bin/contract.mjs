#!/usr/bin/env node
// `contract`: the task contract at the head of a feature document (see odd/tasks/task-contract.md
// and bin/lib/contract.mjs). `template` prints the template; `check` validates contracts statically
// and never runs the commands they name. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONTRACT_TEMPLATE, isContract, validateContract } from './lib/contract.mjs';

const USAGE = 'Usage: js-harness contract template | js-harness contract check [file...] [--cwd <dir>]';

class ContractArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new ContractArgError(`${flag} requires a value`);
  return value;
}

/** Walks argv token by token, so an unknown flag is a usage error and never a silently ignored one. */
function parseCheckArgs(argv) {
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
export function discoverContracts(root, { readFile = (p) => fs.readFileSync(p, 'utf8'), readdir = (p) => fs.readdirSync(p) } = {}) {
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
      if (!fs.statSync(absolute).isFile()) continue; // e.g. a directory named `x.md`
      const markdown = readFile(absolute);
      if (isContract(markdown)) found.push({ label, markdown });
    } catch (err) {
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
    parsed = parseCheckArgs(argv);
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

// One entry per subcommand: `run` and `goal` (odd/tasks/task-contract.md, T3) join this table.
const SUBCOMMANDS = { template: templateCommand, check: checkCommand };

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

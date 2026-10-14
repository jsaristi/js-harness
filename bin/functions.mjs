// `functions`: what each switch of this project is, what it resolves to and why; `functions apply` makes this
// clone what they ask; `functions set <name> <value>` declares one in harness.json and applies it. The switches
// live under `harness.json` `"functions"`; the rules are bin/lib/functions.mjs, and what a switch writes in a
// clone is bin/lib/project-apply.mjs. See odd/tasks/on-demand-functions.md.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SWITCHES } from './lib/functions.mjs';
import { functionsOf, gitIn, harnessOfTree, workingTree } from './lib/project-functions.mjs';
import { textLike } from './lib/settings-key.mjs';

const USAGE = [
  'Usage: js-harness functions [--json] [--cwd <path>]',
  '       js-harness functions apply [--cwd <path>]',
  '       js-harness functions set <name> <value> [--cwd <path>]',
  'Prints each function this project can turn off and on (harness.json "functions"): its value here and why.',
  'apply makes this clone what they ask: the code map index, the push check, and the keys of the clone\'s',
  '.claude/settings.local.json (recorded in the project manifest, so uninstall undoes them). It needs no pin.',
  `set writes one switch into harness.json and applies it: ${Object.entries(SWITCHES)
    .map(([name, { values }]) => `${name} ${values.join('|')}`)
    .join('; ')}.`,
].join('\n');

function parseArgs(argv, cwd) {
  const parsed = { cwd, json: false, words: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--cwd' && argv[index + 1]) parsed.cwd = path.resolve(argv[(index += 1)]);
    else if (!arg.startsWith('-')) parsed.words.push(arg);
    else return { error: `unknown argument: ${arg}` };
  }
  const [verb, ...rest] = parsed.words;
  if (verb === undefined) return parsed;
  if (verb === 'apply' && rest.length === 0 && !parsed.json) return { ...parsed, verb };
  if (verb === 'set' && rest.length === 2 && !parsed.json) return { ...parsed, verb, name: rest[0], value: rest[1] };
  return { error: `unknown argument: ${verb === 'apply' || verb === 'set' ? argv.join(' ') : verb}` };
}

/** One line per switch: its name, its value, and why; `auto: ` goes before a reason read from the files. */
function lines(resolved) {
  const nameWidth = Math.max(...Object.keys(resolved).map((name) => name.length)) + 2;
  return Object.entries(resolved).map(([name, { value, declared, because }]) =>
    `${name.padEnd(nameWidth)}${value.padEnd(11)}${declared === 'auto' ? 'auto: ' : ''}${because}`,
  );
}

/** One line per action of `apply`, in the words `sync` prints them with. */
function actionLine({ kind, path: where, reason }) {
  switch (kind) {
    case 'wrote':
      return { out: `wrote ${where}` };
    case 'ran':
      return { out: `ran ${where}` };
    case 'removed':
      return { out: `removed ${where}` };
    case 'alreadyGone':
      return { out: `already gone ${where}` };
    case 'kept':
      return { err: `kept ${where} (${reason})` };
    case 'skip':
      return { err: `${where} skipped: ${reason}` };
    default:
      return { err: `${where} failed: ${reason}` };
  }
}

/** `harness.json` of `top` with `functions[name]` set to `value`, written in the file's own indent and line
 * endings: `{}` once written, or `{ error }` with nothing written. */
function setSwitch(top, name, value) {
  if (!Object.hasOwn(SWITCHES, name)) {
    return { error: `${name} is no switch; the switches are ${Object.keys(SWITCHES).join(', ')}` };
  }
  if (!SWITCHES[name].values.includes(value)) {
    return { error: `${name} takes ${SWITCHES[name].values.join(', ')}, not ${value}` };
  }
  const file = path.join(top, 'harness.json');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { error: err.code === 'ENOENT' ? 'no harness.json here: js-harness init writes one' : `harness.json could not be read: ${err.message}` };
  }
  const bom = raw.startsWith('﻿') ? '﻿' : '';
  let data;
  try {
    data = JSON.parse(raw.slice(bom.length));
  } catch {
    return { error: 'harness.json is not valid JSON; nothing was written' };
  }
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObject(data)) return { error: 'harness.json must be a JSON object; nothing was written' };
  if (data.functions === undefined) data.functions = {};
  if (!isObject(data.functions)) return { error: 'harness.json "functions" must be an object; nothing was written' };
  data.functions[name] = value;
  fs.writeFileSync(file, bom + textLike(raw.slice(bom.length), data));
  return {};
}

/** `apply`, printed: exit 0; 1 when the project cannot be applied (no `harness.json`, a manifest this copy
 * cannot read) or a switch cannot be read, which applies nothing. */
async function apply(top, { stdout, stderr, spawn, platform }) {
  const { applyProjectFunctions, InitWriteError, cleanupClause, newerManifestMessage } = await import('./lib/project.mjs');
  const { currentVersion } = await import('./install.mjs');
  let result;
  try {
    result = applyProjectFunctions(top, currentVersion(), { spawn, platform });
  } catch (err) {
    if (!(err instanceof InitWriteError)) throw err;
    stderr(`functions apply failed: ${err.message}; ${cleanupClause(err)}`);
    return 1;
  }
  // `functionsMain` refuses both before it gets here; a folder removed in between still ends in words.
  if (result.noSuchDirectory) return (stderr(`no such directory: ${result.cwd}`), 1);
  if (result.notGitRepo) return (stderr('not inside a git repository: functions apply and set act on a project'), 1);
  if (result.notInitialized) return (stderr('no harness.json here: js-harness init writes one'), 1);
  if (result.newerManifest) return (stderr(newerManifestMessage(result)), 1);
  if (result.malformedManifest) {
    stderr(`project manifest at ${result.manifestPath} is malformed` + (result.reason ? `: ${result.reason}` : ''));
    return 1;
  }
  for (const action of result.actions) {
    const line = actionLine(action);
    if (line.out) stdout(line.out);
    else stderr(line.err);
  }
  if (result.upToDate) stdout('functions: this clone already is what its switches ask');
  return result.actions.some((action) => action.kind === 'problem' && action.path === 'harness.json "functions"') ? 1 : 0;
}

/** Exit 0, or 1 when `harness.json` or a switch in it cannot be read (each reason on stderr; the switches
 * are still printed, read as on), or 2 for an argument it does not take. */
export async function functionsMain(
  argv,
  env = process.env,
  { cwd = process.cwd(), stdout = console.log, stderr = console.error, spawn = spawnSync, platform = process.platform } = {},
) {
  const args = parseArgs(argv, cwd);
  if (args.error) {
    stderr(`${args.error}\n\n${USAGE}`);
    return 2;
  }
  if (!fs.existsSync(args.cwd)) {
    stderr(`no such directory: ${args.cwd}`);
    return 1;
  }
  // The project is the repository's top, where harness.json lives; outside a repository, the folder itself.
  const repositoryTop = gitIn(args.cwd, spawn)(['rev-parse', '--show-toplevel'])?.trim();
  const top = repositoryTop || args.cwd;

  // What apply writes is recorded in the repository's own manifest, so outside one nothing is written, the
  // switch of set included.
  if (args.verb && !repositoryTop) {
    stderr('not inside a git repository: functions apply and set act on a project');
    return 1;
  }
  if (args.verb === 'set') {
    const set = setSwitch(top, args.name, args.value);
    if (set.error) {
      stderr(set.error);
      return 1;
    }
    stdout(`harness.json: functions.${args.name} is ${args.value}`);
  }
  if (args.verb) return apply(top, { stdout, stderr, spawn, platform });

  const { errors, resolved } = functionsOf(harnessOfTree(top), workingTree(gitIn(top, spawn)));
  for (const error of errors) stderr(error);
  stdout(args.json ? JSON.stringify({ errors, functions: resolved }, null, 2) : lines(resolved).join('\n'));
  return errors.length > 0 ? 1 : 0;
}

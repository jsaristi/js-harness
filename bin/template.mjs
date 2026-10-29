#!/usr/bin/env node
// `template`: the outputs that reach the user again and again, each a template of five parts (odd/tasks/templates.md).
// `new` scaffolds one from the user's `Plantilla:` line, `check` fails on a registered template that lacks a part, and
// `list` prints the registry. Not `contract template` or `summary template`, which print a skeleton a session fills:
// a template here is an output the user sees, made by a command and held by a gate. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { registryOfText, writeRegistry } from './lib/template.mjs';
import { checkTemplates } from './lib/template-check.mjs';
import { FIELDS, firstMissing, scaffold } from './lib/template-scaffold.mjs';
import * as hookEntries from './lib/hook-entries.mjs';

export const USAGE = [
  'Usage: js-harness template new <id> --what <text> --when <text> --sample <file> --where <place> --source <transcript>:<line> [--kind rendered|shape] [--surface page|board|ask|stop|command:<name>]',
  '       js-harness template check | list [--json]',
].join('\n');

const REGISTRY = 'bin/lib/template-registry.mjs';

class TemplateArgError extends Error {}

/** The repository's top folder from `cwd`, or `cwd` itself outside a repository. */
function topLevel(cwd) {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  return git.status === 0 ? git.stdout.trim() : cwd;
}

/** The tools the gate's hook entry of this harness watches, as `install` writes it: none until that entry exists
 * (odd/tasks/templates.md, T4). It reads the entry this code declares, not a host's settings; `doctor` says whether a
 * host holds it. */
function installedGateTools() {
  const matcher = hookEntries.templateGateEntry?.().matcher;
  if (typeof matcher !== 'string') return new Set();
  return new Set(matcher.replace(/^\^\(?|\)?\$$/g, '').split('|'));
}

function parseNew(rest) {
  const [id, ...flags] = rest;
  if (id === undefined || id.startsWith('-')) throw new TemplateArgError('template new needs an id first: template new <id> --what ...');
  const known = new Map([...FIELDS.map(({ key, flag }) => [flag, key]), ['--kind', 'kind'], ['--surface', 'surface']]);
  const given = { id };
  for (let i = 0; i < flags.length; i += 1) {
    const key = known.get(flags[i]);
    if (key === undefined) throw new TemplateArgError(`unknown argument: ${flags[i]}`);
    if (Object.hasOwn(given, key)) throw new TemplateArgError(`${flags[i]} was given twice`);
    const value = flags[i + 1];
    if (value === undefined || value.startsWith('--')) throw new TemplateArgError(`${flags[i]} requires a value`);
    given[key] = value;
    i += 1;
  }
  const missing = firstMissing(given);
  if (missing) throw new TemplateArgError(`template new: missing ${missing.flag}: ${missing.ask} (ask the user for this one alone)`);
  return given;
}

function readRegistry(root) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, REGISTRY), 'utf8');
  } catch (err) {
    return { error: `cannot read ${REGISTRY} under ${root}: ${err.message}` };
  }
  const list = registryOfText(text);
  return Array.isArray(list) ? { list } : list;
}

function runNew(given, root, cwd, { stdout, stderr }) {
  const registry = readRegistry(root);
  if (registry.error) return stderr(`template new: ${registry.error}`), 1;
  if (registry.list.some((entry) => entry.id === given.id)) return stderr(`template new: ${given.id} is already registered`), 1;
  let sampleBytes;
  try {
    sampleBytes = fs.readFileSync(path.resolve(cwd, given.sample));
  } catch (err) {
    return stderr(`template new: cannot read the sample ${given.sample}: ${err.message}`), 1;
  }
  const made = scaffold(given, sampleBytes);
  if (made.error) return stderr(`template new: ${made.error}`), 1;
  const there = made.files.filter((file) => fs.existsSync(path.join(root, file.path)));
  if (there.length > 0) return stderr(`template new: ${there.map((file) => file.path).join(', ')} already exist; it writes over nothing`), 1;
  for (const file of made.files) {
    fs.mkdirSync(path.dirname(path.join(root, file.path)), { recursive: true });
    fs.writeFileSync(path.join(root, file.path), file.content);
  }
  fs.writeFileSync(path.join(root, REGISTRY), writeRegistry([...registry.list, made.entry]));
  stdout(`template ${given.id}: a draft, with its five parts to finish:`);
  for (const file of made.files) stdout(`  ${file.path}`);
  stdout(`  ${REGISTRY} (its entry, draft: true; set "render" to its command)`);
  stdout('Write the golden and refusal tests first, then render and admit; template check fails until draft is false.');
  return 0;
}

function runCheck(root, hooked, { stdout, stderr }) {
  const registry = readRegistry(root);
  if (registry.error) return stderr(`template check: ${registry.error}`), 1;
  const readFile = (rel) => {
    try {
      return fs.readFileSync(path.join(root, rel));
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
      throw err;
    }
  };
  const faults = checkTemplates(registry.list, { readFile, hooked });
  if (faults.length === 0) return stdout(`templates: ${registry.list.length} registered, every part present`), 0;
  for (const { id, fault } of faults) stdout(`template ${id}: ${fault}`);
  return 1;
}

function runList(root, json, { stdout, stderr }) {
  const registry = readRegistry(root);
  if (registry.error) return stderr(`template list: ${registry.error}`), 1;
  if (json) return stdout(JSON.stringify(registry.list, null, 2)), 0;
  for (const entry of registry.list) stdout(`${entry.id}\t${entry.kind}\t${entry.surface}\t${entry.draft === false ? 'whole' : 'draft'}\t${entry.plantilla?.what ?? ''}`);
  if (registry.list.length === 0) stdout('no template registered');
  return 0;
}

/** Exit 0 when the subcommand did its work, 1 when it found a fault or could not, 2 for a bad command line. `root`
 * and `hooked` are seams for the tests. */
export function templateMain(argv, { stdout = console.log, stderr = console.error, cwd = process.cwd(), root, hooked } = {}) {
  const io = { stdout, stderr };
  try {
    const [subcommand, ...rest] = argv;
    if (subcommand === undefined) throw new TemplateArgError('a subcommand is required: new, check or list');
    const top = root ?? topLevel(cwd);
    if (subcommand === 'new') return runNew(parseNew(rest), top, cwd, io);
    if (subcommand === 'check') {
      if (rest.length > 0) throw new TemplateArgError(`unknown argument: ${rest[0]}`);
      return runCheck(top, hooked ?? installedGateTools(), io);
    }
    if (subcommand === 'list') {
      const extra = rest.find((token) => token !== '--json');
      if (extra !== undefined) throw new TemplateArgError(`unknown argument: ${extra}`);
      return runList(top, rest.includes('--json'), io);
    }
    throw new TemplateArgError(`unknown argument: ${subcommand}`);
  } catch (err) {
    if (!(err instanceof TemplateArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
}

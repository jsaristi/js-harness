// The `spec` row of `check`: `docs/SPEC.md` held to its shape, so the specification stays alive by a
// check and not by memory (odd/tasks/rule-hierarchy.md, C3). Each capability carries the six fields,
// a proof that is a command, and a "today" line whose files exist; in the harness itself, every
// command of the dispatcher, every entry the manifest installs and every file it writes outside the
// repository is claimed by a capability, so a piece added without its entry stops the commit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../js-harness.mjs';
import { components, entryComponents } from './manifest.mjs';

export const SPEC_PATH = 'docs/SPEC.md';

/** The fields of a capability, in the order the specification writes them. */
const FIELDS = Object.freeze(['Problem', 'Requirement', 'Reason', 'Proof', 'Discarded', 'Today']);

/** The files the harness writes outside a repository that no manifest entry stands for: the manifest
 * itself, and the user's settings, where `acceptSessionMessages` sets one key. The skills and hook
 * entries are claimed by their ids. Files whose names a command chooses at run time (a launcher of
 * `remote`, the channel record) are not listed: the check proves what can be enumerated. */
const HOME_FILES = Object.freeze(['~/.js-harness/manifest.json', '~/.claude/settings.json']);

const HARNESS_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FIELD_START = /^\*\*([A-Z][a-z]+):\*\*\s?(.*)$/;
const TODAY_SHAPE = 'an item there is a file of the repository, `js-harness <command>`, an id of the manifest or a path under `~/`';

/** The capabilities of a specification: each `### ` heading under `## Capabilities`, with the text of
 * each `**Field:**` that follows it, up to the next field or heading. `errors` holds a field that
 * repeats or is not one of the six; neither is stored, so the first value written is the one read.
 * Lines inside a fenced block are text, never a heading or a field. */
export function parseSpec(markdown) {
  const capabilities = [];
  const errors = [];
  let inside = false;
  let current = null;
  let field = null;
  let fenced = false;
  markdown.split(/\r?\n/).forEach((text, index) => {
    const fence = /^\s*(```|~~~)/.test(text);
    if (fence) fenced = !fenced;
    if (fence || fenced) return;
    if (/^## /.test(text)) {
      inside = text.trim() === '## Capabilities';
      current = null;
      field = null;
      return;
    }
    if (!inside) return;
    if (/^### /.test(text)) {
      current = { title: text.slice(4).trim(), line: index + 1, fields: {} };
      capabilities.push(current);
      field = null;
      return;
    }
    if (!current) return;
    const start = FIELD_START.exec(text);
    if (start) {
      const [, name, rest] = start;
      field = null;
      if (!FIELDS.includes(name)) errors.push(`"${current.title}" (line ${current.line}) has a **${name}:** field, which is not one of ${FIELDS.join(', ')}`);
      else if (Object.hasOwn(current.fields, name)) errors.push(`"${current.title}" (line ${current.line}) has its **${name}:** field twice`);
      else {
        field = name;
        current.fields[name] = rest;
      }
      return;
    }
    if (field && text.trim() !== '') current.fields[field] = `${current.fields[field]}\n${text.trim()}`.trim();
    else if (text.trim() === '') field = null;
  });
  return { capabilities, errors };
}

/** The text in backticks of a field. */
const ticked = (text) => [...(text ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());

// A word that is a plain relative path to a `.mjs`, `.js` or `.md` file, with an optional `:line` or `:from-to`.
const PROOF_FILE = /^([\w.-]+(?:\/[\w.-]+)*\.(?:mjs|js|md))(?::\d+(?:-\d+)?)?$/;

// The options of a proof command whose next argument is a value, code or a pattern, never a file to run. Any other
// option takes no value (`--test`, `--test-only`, `--`), so a file after it is read.
const VALUE_OPTIONS = ['-e', '--eval', '-p', '--print', '--test-name-pattern', '--test-skip-pattern', '--ref'];

/** The arguments of a command as a shell splits them: a quoted run is one argument, without its quotes. */
const argumentsOf = (command) => [...command.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3]);

/** The files of the repository a proof command runs, read from each backticked command: every argument that is a
 * plain relative path to a `.mjs`, `.js` or `.md` file (`PROOF_FILE`) and not the value of a `VALUE_OPTIONS`
 * option. A URL, a git range, quoted code and a pattern are no such argument, so none of them is read as a file. */
function proofFiles(command) {
  const args = argumentsOf(command);
  return args.flatMap((arg, i) => {
    const match = VALUE_OPTIONS.includes(args[i - 1]) ? null : PROOF_FILE.exec(arg);
    return match ? [match[1]] : [];
  });
}

/** What one item of a today line is: a command, a manifest id, a home path or a file of the repository. */
function readItem(item, entries) {
  const command = /^js-harness ([a-z][a-z-]*)$/.exec(item);
  if (command) return { kind: 'command', name: command[1] };
  if (item.startsWith('~/')) return { kind: 'home', name: item };
  if (entries.includes(item)) return { kind: 'entry', name: item };
  if (/\s/.test(item)) return { kind: 'unknown', name: item };
  return { kind: 'file', name: item.replace(/:\d+(-\d+)?$/, '') };
}

/** The findings of a specification, and its capabilities. `exists(file)` says whether a path from the
 * top of the repository exists. `commands`, `entries` and `homeFiles`, given only for the harness's own
 * specification, are what must be claimed: a project's specification describes no dispatcher. `ids`
 * are the manifest's ids a today item may name without being a file, claimed or not. */
export function specFindings(markdown, { exists, commands = null, entries = null, homeFiles = null, ids = [] }) {
  const { capabilities, errors } = parseSpec(markdown);
  const findings = [...errors];
  if (capabilities.length === 0) return { capabilities, findings: [...findings, `${SPEC_PATH} holds no capability: each is a "### " heading under "## Capabilities"`] };
  const claimed = { command: new Set(), entry: new Set(), home: new Set() };
  for (const { title, line, fields } of capabilities) {
    const where = `"${title}" (line ${line})`;
    for (const name of FIELDS) if (!Object.hasOwn(fields, name) || fields[name].trim() === '') findings.push(`${where} has no **${name}:** field`);
    if (Object.hasOwn(fields, 'Proof') && fields.Proof.trim() !== '' && ticked(fields.Proof).length === 0) findings.push(`${where} has no command in backticks in its **Proof:** field`);
    // A proof whose test file is gone proves nothing, so its file is held to exist as a today file is.
    for (const command of ticked(fields.Proof)) {
      for (const file of proofFiles(command)) if (!exists(file)) findings.push(`${where} names ${file} in **Proof:**, which does not exist`);
    }
    for (const item of ticked(fields.Today)) {
      const read = readItem(item, entries ?? ids);
      if (read.kind === 'unknown') findings.push(`${where} names "${item}" in **Today:**: ${TODAY_SHAPE}`);
      else if (read.kind === 'file' && !exists(read.name)) findings.push(`${where} names ${read.name} in **Today:**, which does not exist`);
      else if (read.kind === 'command' && commands && !commands.includes(read.name)) findings.push(`${where} claims \`js-harness ${read.name}\`, which the dispatcher does not have`);
      else if (read.kind !== 'file') claimed[read.kind].add(read.name);
    }
  }
  for (const name of commands ?? []) if (!claimed.command.has(name)) findings.push(`the command \`js-harness ${name}\` is claimed by no capability`);
  for (const id of entries ?? []) if (!claimed.entry.has(id)) findings.push(`the manifest entry \`${id}\` is claimed by no capability`);
  for (const file of homeFiles ?? []) if (!claimed.home.has(file)) findings.push(`the file \`${file}\`, written outside the repository, is claimed by no capability`);
  return { capabilities, findings };
}

/** The name in a tree's `package.json`, or null where it has none that parses. */
function packageName(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name ?? null;
  } catch {
    return null;
  }
}

const HARNESS_NAME = packageName(HARNESS_ROOT);

/** The `spec` row, as a list: empty where the project keeps no `docs/SPEC.md`. `own` says whether `cwd`
 * is the harness's own repository, whose specification must claim the dispatcher's commands, the
 * manifest's entries and `HOME_FILES`; by default, whether its package bears the harness's name, so a
 * checkout is held to it whichever copy of the harness checks it (the installed one, a junction). */
export function checkSpec(cwd, deps = {}) {
  const {
    readFile = (file) => fs.readFileSync(file, 'utf8'),
    exists = (file) => fs.existsSync(path.join(cwd, file)),
    commands = Object.keys(COMMANDS),
    entries = [...components, ...entryComponents].map((component) => component.id),
    homeFiles = HOME_FILES,
  } = deps;
  const own = deps.own ?? (HARNESS_NAME !== null && packageName(cwd) === HARNESS_NAME);
  let markdown;
  try {
    markdown = readFile(path.join(cwd, SPEC_PATH));
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return [];
    return [{ name: 'spec', pass: false, detail: `${SPEC_PATH} cannot be read: ${err.message}` }];
  }
  const { capabilities, findings } = specFindings(markdown, own ? { exists, commands, entries, homeFiles } : { exists, ids: entries });
  if (findings.length === 0) {
    const counted = `${capabilities.length} ${capabilities.length === 1 ? 'capability' : 'capabilities'}`;
    return [{ name: 'spec', pass: true, detail: `${counted}, each with its proof and its files` }];
  }
  return [{ name: 'spec', pass: false, detail: `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} in ${SPEC_PATH}`, lines: findings }];
}

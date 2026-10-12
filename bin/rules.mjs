#!/usr/bin/env node
// `rules`: the declared rules of the harness (bin/lib/rules-data.mjs), each with its value or its home, and the
// check that holds the list to the files around it. `rules` lists them, `rules <id>` prints one with its source
// and the code that reads it, `rules check` reports what is wrong, `rules render` writes docs/RULES.md, and
// `rules applied` compares what each short name gave in the session records with its rule. Every form but
// `applied` reads only under the package: it never reads the working directory, and writes one file,
// docs/RULES.md, only when asked to render. `applied` reads the records Claude Code keeps for the project it is run
// in, and that project's own bin/lib/rules-data.mjs, and writes nothing. The checks are in bin/lib/rules-check.mjs.
// Zero dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RULES } from './lib/rules-data.mjs';
import { beforeProgress, checkRules } from './lib/rules-check.mjs';
import { renderList, rulesHash, ruleHere } from './lib/rules.mjs';
import { appliedLines, appliedOf } from './lib/rules-applied.mjs';
import { readRecords } from './lib/rules-applied-read.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'Usage: js-harness rules [<id> | check | render | applied]';
const SOURCES = 'docs/rule-sources.json';
const LIST = 'docs/RULES.md';
// The two findings a render writes over: the list is missing, or it is not what the declarations give.
const LIST_FINDINGS = ['docs/RULES.md is missing:', 'docs/RULES.md is not what the declarations render:'];
// The days of session records `applied` counts: the last seven, as of now.
const APPLIED_DAYS = 7;
// The most recent launches and sessions of each kind that `applied` reads; the older ones are left out, and said so.
const APPLIED_MAX_FILES = 500;

class RulesArgError extends Error {}

/** The words of argv, walked token by token: a flag is a usage error, and so is a second word. */
function parseArgs(argv) {
  const words = [];
  for (const token of argv) {
    if (token.startsWith('-') || words.length === 1) throw new RulesArgError(`unknown argument: ${token}`);
    words.push(token);
  }
  const [word] = words;
  if (word === 'check' || word === 'render' || word === 'applied') return { command: word };
  return word === undefined ? { command: 'list' } : { command: 'id', id: word };
}

/** The entries of the folder `absolute`, or none when it is not there. */
function entriesOf(absolute) {
  try {
    return fs.readdirSync(absolute, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return [];
    throw err;
  }
}

/** The text of `file`, a path from `root` in forward slashes, or `null` when the file is not there. A file that is
 * there and cannot be read is an error, never taken for one that is not. */
function readOptional(root, file) {
  try {
    return fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw new Error(`cannot read ${file}: ${err.code ?? err.message}`);
  }
}

/** `file` as a path from `root`, in forward slashes. */
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');

/** Orders `{ path }` items by their path, with plain comparison so that no locale changes the order. */
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/** Every `*.mjs` under `bin/` except the tests, with its text, sorted by path. */
function codeFilesUnder(root) {
  const found = [];
  const visit = (absolute) => {
    for (const entry of entriesOf(absolute)) {
      const file = path.join(absolute, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs')) found.push(file);
    }
  };
  visit(path.join(root, 'bin'));
  return found
    .map((file) => ({ path: relative(root, file), text: fs.readFileSync(file, 'utf8') }))
    .sort(byPath);
}

/** The progress records and plans read for the marks of rules: the roadmap and the spec when they exist, then each
 * feature document under `odd/tasks/`, cut at its `## Progress` line, sorted by path. */
function textFilesUnder(root) {
  const files = [];
  for (const file of ['docs/ROADMAP.md', 'docs/SPEC.md']) {
    const text = readOptional(root, file);
    if (text !== null) files.push({ path: file, text });
  }
  const tasks = entriesOf(path.join(root, 'odd', 'tasks'))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `odd/tasks/${entry.name}`)
    .sort();
  for (const file of tasks) {
    const text = readOptional(root, file);
    if (text !== null) files.push({ path: file, text: beforeProgress(text) });
  }
  return files;
}

/** What the command reads under `root`, each file once. The sources are `null` when there is no file, and a file
 * that is not JSON is an error. `readFile` answers for any file of the project: `null` when it is not there, and an
 * error when it is there and cannot be read. */
function readAll(root) {
  const sourcesText = readOptional(root, SOURCES);
  let sources = null;
  if (sourcesText !== null) {
    try {
      sources = JSON.parse(sourcesText);
    } catch (err) {
      throw new Error(`${SOURCES} is not JSON: ${err.message}`);
    }
    // A file that is JSON but not an object keyed by id is an error too: `null` must not pass for an absent file.
    if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) {
      throw new Error(`${SOURCES} is not an object keyed by rule id`);
    }
  }
  return {
    sources,
    dataText: readOptional(root, 'bin/lib/rules-data.mjs'),
    listText: readOptional(root, LIST),
    codeFiles: codeFilesUnder(root),
    textFiles: textFilesUnder(root),
    readFile: (file) => readOptional(root, file),
  };
}

/** The count line of the list: how many rules it declares and the hash of what they say. */
const countLine = () => `${RULES.length} rules, hash ${rulesHash(RULES)}`;

/** What a rule is, on the listing's line: its value and unit, its prose, or the day it was retired. */
function describeRule(rule) {
  if (Object.hasOwn(rule, 'retired')) return `retired ${rule.retired}`;
  if (Object.hasOwn(rule, 'value')) return rule.unit === undefined ? `${rule.value}` : `${rule.value} ${rule.unit}`;
  return `prose, ${rule.path}`;
}

/** The listing: one line per rule, in list order, then the count line. */
function listRules(stdout) {
  for (const rule of RULES) stdout(`${rule.id}  ${describeRule(rule)}  ${rule.owner}`);
  stdout(countLine());
  return 0;
}

/** One rule in full: its declaration, the code that reads it and its source, or an error when no rule has the id. */
function showRule(id, { sources, readers }, stdout, stderr) {
  const rule = RULES.find((item) => item.id === id);
  if (rule === undefined) {
    stderr(`no rule "${id}" is declared`);
    return 1;
  }
  stdout(JSON.stringify(rule, null, 2));
  const paths = Object.hasOwn(readers, id) ? readers[id] : [];
  stdout(`Read by: ${paths.length === 0 ? 'none' : paths.join(', ')}`);
  const source = sources !== null && typeof sources === 'object' && Object.hasOwn(sources, id) ? sources[id] : undefined;
  stdout(source === undefined ? 'Source: none recorded' : `Source: ${JSON.stringify(source, null, 2)}`);
  return 0;
}

/** The check: PASS with the count line, or FAIL with each finding indented; the notes follow, and the exit is 0 only
 * with no finding. */
function checkList({ findings, notes }, stdout) {
  if (findings.length === 0) {
    stdout(`PASS  rules  ${countLine()}`);
  } else {
    stdout(`FAIL  rules  ${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}`);
    for (const finding of findings) stdout(`      ${finding}`);
  }
  for (const note of notes) stdout(`note: ${note}`);
  return findings.length === 0 ? 0 : 1;
}

/** Writes docs/RULES.md from the declarations, when no finding other than the list's own stands and the sources exist. */
function renderLists(root, { sources, findings, readers, sentences }, stdout, stderr) {
  const blocking = findings.filter((finding) => !LIST_FINDINGS.some((prefix) => finding.startsWith(prefix)));
  if (blocking.length > 0) {
    stderr('not rendered: the declarations have findings; run js-harness rules check');
    return 1;
  }
  if (sources === null) {
    stderr(`not rendered: there is no ${SOURCES} under ${root}`);
    return 1;
  }
  fs.writeFileSync(path.join(root, ...LIST.split('/')), renderList(RULES, { sources, readers, sentences }), 'utf8');
  stdout(`${LIST} written: ${countLine()}`);
  return 0;
}

/** The project folder `cwd` is in, as git names its top, or `cwd` itself when git gives no top (no repository, or no git). */
function projectOf(run, cwd) {
  const result = run('git', ['rev-parse', '--show-toplevel'], { cwd });
  if (result.error || result.status !== 0) return cwd;
  const [top] = String(result.stdout ?? '').split(/\r?\n/).filter((line) => line.trim() !== '');
  return top === undefined ? cwd : path.resolve(top);
}

/** The rules `applied` reads as in force in the project whose rules-data.mjs text is `projectData` (null when there is none),
 * in list order, and how many scoped rules are left out and why: `{ rules, leftOut: { elsewhere, behind } }`. A rule in
 * prose has no value and a retired rule is gone, so neither is in force. */
function rulesInForce(projectData) {
  const rules = [];
  const leftOut = { elsewhere: 0, behind: 0 };
  for (const rule of RULES) {
    if (!Object.hasOwn(rule, 'value') || Object.hasOwn(rule, 'retired')) continue;
    if (rule.scope === undefined) {
      rules.push(rule);
      continue;
    }
    const here = ruleHere(rule.id, rule.unit, projectData);
    if (Object.hasOwn(here, 'value')) rules.push(rule);
    else leftOut[here.off] += 1;
  }
  return { rules, leftOut };
}

/** Writes the lines of `js-harness rules applied` for the project `cwd` is in, and gives its exit code: each declared
 * alias against the launches and sessions the records of that project hold, over the last APPLIED_DAYS days. The records
 * are those of the main checkout, under `env.CLAUDE_CONFIG_DIR` or else the user's `.claude`; the rules are those of the
 * project's own rules-data.mjs. Nothing is written. The exit is 1 when a short name gives another model than its rule
 * declares on the engine in use, and 0 otherwise, and when no record folder is there. */
function appliedForm({ cwd, env, homedir, now, run }, stdout) {
  const project = projectOf(run, cwd);
  const main = mainCheckout(run, cwd);
  const recordsDir = path.join(env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'), 'projects', projectSlug(main));
  const { rules, leftOut } = rulesInForce(readOptional(project, 'bin/lib/rules-data.mjs'));
  const at = now();
  const records = readRecords(recordsDir, { now: at, days: APPLIED_DAYS, maxFiles: APPLIED_MAX_FILES });
  const today = new Date(at).toISOString().slice(0, 10);
  const result = appliedOf(rules, records.launches, records.sessions, { today, days: APPLIED_DAYS });
  const lines = appliedLines(result, {
    project,
    main,
    recordsDir,
    exists: records.exists,
    files: records.files,
    capped: records.capped,
    unreadable: records.unreadable,
    days: APPLIED_DAYS,
    maxFiles: APPLIED_MAX_FILES,
    leftOut,
  });
  for (const line of lines) stdout(line);
  return records.exists ? result.exit : 0;
}

/** `js-harness rules` and its forms: the listing, `<id>`, `check`, `render` and `applied`. It returns the exit code: 0 when
 * the form succeeds, 1 when a rule is not declared, the list has a finding, a file is unreadable or not the sources, or
 * `applied` finds a short name that gives another model than its rule declares, and 2 with the usage on stderr for an
 * argument it does not know. Every form but `applied` reads its files under `root`, which defaults to the package.
 * `applied` reads under `cwd` (the working directory by default): the records of that project and its own rules file.
 * `env`, `homedir`, `now` and `run` (what `spawnSync` gives) are what `applied` takes from outside, so a test can keep it
 * away from the real records. */
export async function rulesMain(argv, {
  root = PACKAGE_ROOT,
  stdout = console.log,
  stderr = console.error,
  cwd = process.cwd(),
  env = process.env,
  homedir = os.homedir,
  now = Date.now,
  run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true }),
} = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  // The plain listing needs only the declarations, so a file it does not read cannot stop it.
  if (parsed.command === 'list') return listRules(stdout);

  // `applied` reads no document of the package, so it runs before the package is read at all.
  if (parsed.command === 'applied') {
    try {
      return appliedForm({ cwd, env, homedir, now, run }, stdout);
    } catch (err) {
      stderr(err.message);
      return 1;
    }
  }

  let read;
  let result;
  try {
    read = readAll(root);
    result = checkRules({
      rules: RULES,
      sources: read.sources,
      dataText: read.dataText,
      listText: read.listText,
      codeFiles: read.codeFiles,
      textFiles: read.textFiles,
      readFile: read.readFile,
    });
  } catch (err) {
    stderr(err.message);
    return 1;
  }

  if (parsed.command === 'id') return showRule(parsed.id, { sources: read.sources, readers: result.readers }, stdout, stderr);
  if (parsed.command === 'check') return checkList(result, stdout);
  return renderLists(root, { sources: read.sources, ...result }, stdout, stderr);
}

// Run directly, the command reads the process's arguments and sets the exit code, as the dispatcher does for its own.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  rulesMain(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

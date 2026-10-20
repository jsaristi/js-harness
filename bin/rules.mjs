#!/usr/bin/env node
// `rules`: the declared rules of the harness (bin/lib/rules-data.mjs), each with its value or its home, and the
// check that holds the list to the files around it. `rules` lists them, `rules <id>` prints one with its source
// and the code that reads it, `rules check` reports what is wrong, `rules render` writes docs/RULES.md, and
// `rules applied` compares what each short name gave in the session records with its rule. Every form but
// `applied` reads only under the package: it never reads the working directory, and writes one file,
// docs/RULES.md, only when asked to render. `applied` reads the records Claude Code keeps for the project it is run
// in, and that project's own bin/lib/rules-data.mjs, and writes nothing. The checks are in bin/lib/rules-check.mjs.
// All of that is in the harness's own repository. In a project that installs the harness (its git top holds no
// bin/lib/rules-data.mjs), `rules`, `rules <id>` and `rules check` are about that project's own list, docs/rules.json,
// beside the rules of the harness in force there, and `render` is refused (bin/lib/project-rules.mjs).
// `rules change <id>` is the one form that writes a rule: run in the checkout it changes, on a branch rule/<name>, it
// writes the declaration, its source and docs/RULES.md and appends a relief line (bin/lib/rules-change-run.mjs); a
// change of patterns or failure alone keeps the rule's source and names its own in the relief line, and takes a
// design even on a rule of his. It is refused in a project that installs the harness, whose own list is edited by
// hand. In the harness's own checkout
// `rules check` also counts each rule's patterns in the texts in force and checks each rule's failure against the
// register (bin/lib/rules-scan.mjs); the gate's row `rules` reads the same patterns in what a commit adds.
// Zero dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RULES } from './lib/rules-data.mjs';
import { beforeProgress, checkRules } from './lib/rules-check.mjs';
import { countFindings, registerFindings } from './lib/rules-scan.mjs';
import { parseRegister } from './lib/failures.mjs';
import { renderList, rulesHash, ruleHere, ruleOf, unscoped } from './lib/rules.mjs';
import { appliedLines, appliedOf } from './lib/rules-applied.mjs';
import { readRecords } from './lib/rules-applied-read.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { readProjectRules } from './lib/project-rules-read.mjs';
import { PROJECT_RULES_PATH } from './lib/project-rules.mjs';
import { changeRule } from './lib/rules-change-run.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const USAGE = 'Usage: js-harness rules [<id> | check | render | applied | change <id> [--dry-run | --check-source] | --hook]';
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
  // `change <id>` is the one form with options: `--dry-run` prints what it would write, `--check-source` checks a
  // stored source again instead of a change.
  if (argv[0] === 'change') {
    const parsed = { command: 'change', id: undefined, dryRun: false, checkSource: false };
    for (const token of argv.slice(1)) {
      if (token === '--dry-run') parsed.dryRun = true;
      else if (token === '--check-source') parsed.checkSource = true;
      else if (token.startsWith('-') || parsed.id !== undefined) throw new RulesArgError(`unknown argument: ${token}`);
      else parsed.id = token;
    }
    if (parsed.id === undefined) throw new RulesArgError('rules change needs the id of the rule');
    return parsed;
  }
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
  if (Object.hasOwn(rule, 'sensor')) return `sensor ${rule.sensor}`;
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

/** `n` rules of the project, in words: "1 rule of the project", "2 rules of the project". */
const projectCount = (n) => `${n} ${n === 1 ? 'rule' : 'rules'} of the project`;

/** The forms of `rules` in a project that installs the harness, whose git top is `top`: its own list, docs/rules.json,
 * beside the rules of the harness in force there (odd/tasks/project-rules.md, "How it is checked"). The list is held to
 * the sensors `check` runs in the project; when its `harness.json` does not parse they cannot be known, and the sensor
 * rules are left unchecked (the gate's sensors row reports that file). It writes nothing: `render` is the harness's. */
async function projectForm(parsed, top, { run, stdout, stderr }) {
  if (parsed.command === 'render') {
    stderr("rules render writes the harness's docs/RULES.md and runs only in the harness's own repository; a project's list is printed by `js-harness rules`");
    return 1;
  }
  let read;
  try {
    const { discoverSensors } = await import('./check.mjs');
    const found = discoverSensors(top);
    read = readProjectRules(top, { sensors: found.error ? null : found.sensors.map((sensor) => sensor.name), run });
  } catch (err) {
    stderr(err.message);
    return 1;
  }

  if (parsed.command === 'check') {
    if (!read.present) {
      stdout(`PASS  rules  no ${PROJECT_RULES_PATH}: this project declares no rules of its own`);
      return 0;
    }
    if (read.findings.length === 0) {
      const n = read.rules.length;
      stdout(`PASS  rules  ${projectCount(n)} ${n === 1 ? 'holds' : 'hold'}`);
    } else {
      stdout(`FAIL  rules  ${read.findings.length} ${read.findings.length === 1 ? 'finding' : 'findings'}`);
      for (const finding of read.findings) stdout(`      ${finding}`);
    }
    for (const note of read.notes) stdout(`note: ${note}`);
    return read.findings.length === 0 ? 0 : 1;
  }

  // The listing and one rule need a list that reads; one that does not is told, as `check` tells it.
  if (read.present && !read.readable) {
    for (const finding of read.findings) stderr(finding);
    return 1;
  }
  const own = read.present ? read.rules : [];

  if (parsed.command === 'id') {
    const harness = RULES.find((rule) => rule.id === parsed.id);
    const mine = own.find((rule) => rule.id === parsed.id);
    if (harness === undefined && mine === undefined) {
      stderr(`no rule "${parsed.id}" is declared, by the harness or by this project`);
      return 1;
    }
    if (harness !== undefined) {
      stdout("The harness's rule:");
      stdout(JSON.stringify(harness, null, 2));
    }
    if (mine !== undefined) {
      stdout(`This project's rule (${PROJECT_RULES_PATH}):`);
      stdout(JSON.stringify(mine, null, 2));
    }
    return 0;
  }

  stdout('The rules of the harness in force here:');
  for (const rule of unscoped(RULES)) stdout(`${rule.id}  ${describeRule(rule)}  ${rule.owner}`);
  if (!read.present) {
    stdout(`This project declares no rules of its own: they would be in ${PROJECT_RULES_PATH}`);
    return 0;
  }
  stdout(`This project's own rules (${PROJECT_RULES_PATH}):`);
  for (const rule of own) stdout(`${rule.id}  ${describeRule(rule)}  ${rule.owner ?? 'project'}`);
  stdout(projectCount(own.length));
  return 0;
}

/** The line that follows a passing check: how many findings each rule with patterns has in the texts in force, and
 * how many rules in force carry none and are not scanned (odd/tasks/rule-hierarchy.md, "The row `rules` (T16d)").
 * It is information and never a finding, so a first pattern does not turn the check red. */
function patternsLine({ counts, unscanned }) {
  const named = Object.entries(counts).map(([id, count]) => `${id} ${count}`);
  return `patterns: ${named.length === 0 ? 'none' : named.join(', ')}; unscanned: ${unscanned.length}`;
}

/** The check: PASS with the count line and the patterns line, or FAIL with each finding indented; the notes follow,
 * and the exit is 0 only with no finding. */
function checkList({ findings, notes }, stdout, counted) {
  if (findings.length === 0) {
    stdout(`PASS  rules  ${countLine()}`);
    stdout(patternsLine(counted));
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

/** Whether two folders are the same one, through links, and without case on Windows. */
function samePlace(a, b) {
  const real = (dir) => {
    try {
      return fs.realpathSync(dir);
    } catch {
      return path.resolve(dir);
    }
  };
  const [one, two] = [real(a), real(b)];
  return process.platform === 'win32' ? one.toLowerCase() === two.toLowerCase() : one === two;
}

/** The lines of a child's output, without the last newline; none for no output. */
const linesOf = (text) => (text ? String(text).replace(/\r?\n$/, '').split(/\r?\n/) : []);

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

/** The rules with no short name that the records are held to, and the field of a record each is held to. Each is read
 * here by its id, so that `rules check` lists this file as its reader and refuses an id that is renamed or retired.
 * One that is not in force in the project has no line: `appliedOf` takes only the rules it is passed. */
function heldRules() {
  return [
    { rule: ruleOf('session-model'), of: 'sessions', field: 'model' },
    { rule: ruleOf('session-effort'), of: 'sessions', field: 'effort' },
    { rule: ruleOf('subagent-effort'), of: 'launches', field: 'effort' },
  ].map(({ rule, of, field }) => ({ id: rule.id, of, field }));
}

/** Writes the lines of `js-harness rules applied` for the project `cwd` is in, and gives its exit code: each declared
 * alias against the launches and sessions the records of that project hold, and what ran against the rules with no
 * short name, as information, over the last APPLIED_DAYS days. The records
 * are those of the main checkout, under `env.CLAUDE_CONFIG_DIR` or else the user's `.claude`; the rules are those of the
 * project's own rules-data.mjs. Nothing is written. The exit is 1 when a short name gives another model than its rule
 * declares on the engine in use, and 0 otherwise, and when no record folder is there. */
function appliedForm({ cwd, env, homedir, now, run }, stdout) {
  const project = projectOf(run, cwd);
  const main = mainCheckout(run, cwd);
  const recordsDir = path.join(env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'), 'projects', projectSlug(main));
  const { rules, leftOut } = rulesInForce(readOptional(project, 'bin/lib/rules-data.mjs'));
  const at = now();
  const records = readRecords(recordsDir, { now: at, days: APPLIED_DAYS, maxFiles: APPLIED_MAX_FILES });
  const today = new Date(at).toISOString().slice(0, 10);
  const result = appliedOf(rules, records.launches, records.sessions, { today, days: APPLIED_DAYS, held: heldRules() });
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
  stdin = () => fs.readFileSync(0, 'utf8'),
  rename = fs.renameSync,
} = {}) {
  // Letter F's turn-start hook is a module of its own (bin/lib/rules-reach.mjs); run on its own, this sends it there.
  if (argv[0] === '--hook') return (await import('./lib/rules-reach.mjs')).rulesHookMain(argv.slice(1));
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  // In a project that installs the harness, every form but `applied` is about that project's own list. The harness's
  // own repository is the one whose git top holds bin/lib/rules-data.mjs, as `applied` and `ruleHere` decide.
  let top = null;
  if (parsed.command !== 'applied') {
    top = projectOf(run, cwd);
    let harnessRepository;
    try {
      harnessRepository = readOptional(top, 'bin/lib/rules-data.mjs') !== null;
    } catch (err) {
      stderr(err.message);
      return 1;
    }
    if (!harnessRepository && parsed.command === 'change') {
      stderr(`not changed: ${PROJECT_RULES_PATH} is edited by hand in a project that installs the harness; rules change changes the harness's own rules`);
      return 1;
    }
    if (!harnessRepository) return projectForm(parsed, top, { run, stdout, stderr });
    // Run through an installed copy inside a checkout of the harness, these forms would judge the copy's rules and
    // write the copy's list: the checkout's own command is the one that knows its rules (harness review b8).
    if (root === PACKAGE_ROOT && !samePlace(top, PACKAGE_ROOT) && fs.existsSync(path.join(top, 'bin', 'rules.mjs'))) {
      const own = run(process.execPath, [path.join(top, 'bin', 'rules.mjs'), ...argv], { cwd, env, stdio: ['inherit', 'pipe', 'pipe'] });
      for (const line of linesOf(own.stdout)) stdout(line);
      for (const line of linesOf(own.stderr)) stderr(line);
      if (own.error) stderr(`could not run ${path.join(top, 'bin', 'rules.mjs')}: ${own.error.message}`);
      return own.status ?? 1;
    }
  }

  if (parsed.command === 'change') {
    const slug = projectSlug(mainCheckout(run, cwd));
    return changeRule({
      ...parsed,
      top,
      packageRoot: root,
      readTree: readAll,
      git: (args) => run('git', args, { cwd: top }),
      stdin,
      now,
      home: path.resolve(env.JS_HARNESS_HOME || homedir()),
      slug,
      transcripts: path.join(env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'), 'projects', slug),
      rename,
    }, stdout, stderr);
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

  // The shipped list is this repository's one home for its rules (rule hierarchy, letter B): a project's list here
  // would be a second. It is looked for in the checkout the command runs in, not in the package it runs from.
  if (top !== null && readOptional(top, PROJECT_RULES_PATH) !== null) {
    result.findings.push(`${PROJECT_RULES_PATH} is a project's list: in the harness's own repository the rules live in bin/lib/rules-data.mjs`);
  }

  if (parsed.command === 'id') return showRule(parsed.id, { sources: read.sources, readers: result.readers }, stdout, stderr);
  if (parsed.command === 'check') {
    // A rule's `failure` names an entry of the register, and a switch back to report is a sighting of it (odd/tasks/
    // rule-hierarchy.md, "The row `rules` (T16d)"). With no register here they are not checked, and a note says so,
    // as for the sources: a checkout or a test project without it is not a list whose failures name nothing.
    const register = read.readFile('docs/FAILURES.md');
    if (register === null) result.notes.push("no docs/FAILURES.md here: the rules' failures were not checked");
    else result.findings.push(...registerFindings(RULES, parseRegister(register).entries));
    const inForce = [...read.codeFiles, ...read.textFiles, ...['AGENTS.md', 'README.md'].map((file) => ({ path: file, text: read.readFile(file) })).filter((file) => file.text !== null)];
    return checkList(result, stdout, countFindings(RULES, inForce));
  }
  return renderLists(root, { sources: read.sources, ...result }, stdout, stderr);
}

// Run directly, the command reads the process's arguments and sets the exit code, as the dispatcher does for its own.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  rulesMain(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

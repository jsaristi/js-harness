#!/usr/bin/env node
// `rules`: the declared rules of the harness (bin/lib/rules-data.mjs), each with its value or its home, and the
// check that holds the list to the files around it. `rules` lists them, `rules <id>` prints one with its source
// and the code that reads it, `rules check` reports what is wrong, and `rules render` writes docs/RULES.md. This
// file is the command: it reads every file under the package, never under the working directory, and writes one
// file, docs/RULES.md, only when asked to render. The checks are in bin/lib/rules-check.mjs. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RULES } from './lib/rules-data.mjs';
import { checkRules } from './lib/rules-check.mjs';
import { renderList, rulesHash } from './lib/rules.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'Usage: js-harness rules [<id> | check | render]';
const SOURCES = 'docs/rule-sources.json';
const LIST = 'docs/RULES.md';
// The two findings a render writes over: the list is missing, or it is not what the declarations give.
const LIST_FINDINGS = ['docs/RULES.md is missing:', 'docs/RULES.md is not what the declarations render:'];
// The line that ends a feature document's plan: what follows it is history.
const PROGRESS = /^## Progress\r?$/m;

class RulesArgError extends Error {}

/** The words of argv, walked token by token: a flag is a usage error, and so is a second word. */
function parseArgs(argv) {
  const words = [];
  for (const token of argv) {
    if (token.startsWith('-') || words.length === 1) throw new RulesArgError(`unknown argument: ${token}`);
    words.push(token);
  }
  const [word] = words;
  if (word === 'check' || word === 'render') return { command: word };
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

/** `text` up to its first `## Progress` line, which is left out with everything after it. */
function beforeProgress(text) {
  const found = PROGRESS.exec(text);
  return found === null ? text : text.slice(0, found.index);
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
 * that is not JSON is an error. `readFile` answers for any file of the project, or `null`. */
function readAll(root) {
  const sourcesText = readOptional(root, SOURCES);
  let sources = null;
  if (sourcesText !== null) {
    try {
      sources = JSON.parse(sourcesText);
    } catch (err) {
      throw new Error(`${SOURCES} is not JSON: ${err.message}`);
    }
  }
  return {
    sources,
    dataText: readOptional(root, 'bin/lib/rules-data.mjs'),
    listText: readOptional(root, LIST),
    codeFiles: codeFilesUnder(root),
    textFiles: textFilesUnder(root),
    readFile: (file) => {
      try {
        return fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
      } catch {
        return null;
      }
    },
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

/** `js-harness rules` and its forms: the listing, `<id>`, `check` and `render`. It returns the exit code: 0 when the
 * form succeeds, 1 when a rule is not declared, the list has a finding, or the sources are not JSON, and 2 with the
 * usage on stderr for an argument it does not know. Every file is read under `root`, which defaults to the package. */
export async function rulesMain(argv, { root = PACKAGE_ROOT, stdout = console.log, stderr = console.error } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  let read;
  try {
    read = readAll(root);
  } catch (err) {
    stderr(err.message);
    return 1;
  }
  const result = checkRules({
    rules: RULES,
    sources: read.sources,
    dataText: read.dataText,
    listText: read.listText,
    codeFiles: read.codeFiles,
    textFiles: read.textFiles,
    readFile: read.readFile,
  });

  if (parsed.command === 'list') return listRules(stdout);
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

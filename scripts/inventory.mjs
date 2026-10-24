#!/usr/bin/env node
// Keeps the inventory of the pre-launch audit: one row per tracked file, with its class and the stage-4 area that reads it.
//
//   node scripts/inventory.mjs [--check | --write] [--file <path>] [--json] [--cwd <repo>]
//
// The file is odd/tasks/launch-audit/inventory.tsv under the top of the repository: UTF-8, LF, a header
// `path<TAB>class<TAB>area<TAB>verdict`, then one row per tracked file in code-unit order. The class is live, history,
// generated, fixture, internal or compatibility; the area is a, b, c, d, e, backup, clean, onboard, report, stack or
// shared, and `-` for a history, generated or fixture row. The verdict stays empty until stages 3 and 4 fill it. The
// rules are S4, S4a and S4b of odd/tasks/launch-audit.md; a file that is not tracked has no row to keep.
//
// - `--check` (the default) prints one finding a line, `<kind>  <location>  <detail>`: missing (a tracked path with no
//   row, located at the path), duplicate, stale (a row whose path is not tracked), bad-class, bad-area, malformed (not
//   four tab-separated fields) and bad-header. Then the rows per class and per area, and how many hold a verdict, then
//   the count. `--json` prints one object instead, with the findings and the counts. Exit 1 on any finding, else 0.
// - `--write` rewrites the file from the tracked paths: a tracked path keeps its row's class, area and verdict (the
//   first row, when it is duplicated), a missing one is added with classify, and a row that cannot be kept is printed
//   as `dropped`. It creates the folder of the file if needed and exits 0.
// - `--file <path>` is another inventory, relative to `--cwd`, which is the repository (the current folder by default).
//
// classify gives a path its class (by path, S4a) and its area (S4b). A bin/ file takes the area of the command it is
// named after (the longest command name), else a bin/lib/ module takes the one command area whose entry module reaches
// it through imports (static, re-exports and literal dynamic imports, followed through bin/lib/ modules); reached from
// two areas or from none, it is shared. A command's import of another command is not followed, and neither is the
// dispatcher (bin/js-harness.mjs), which is no entry: its imports route every command and say nothing about a module's
// area. Exit 2 on a usage error.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const INVENTORY = 'odd/tasks/launch-audit/inventory.tsv';
export const HEADER = 'path\tclass\tarea\tverdict';
const CLASSES = ['live', 'history', 'generated', 'fixture', 'internal', 'compatibility'];
const AREAS = ['a', 'b', 'c', 'd', 'e', 'backup', 'clean', 'onboard', 'report', 'stack', 'shared', '-'];
const NO_AREA = ['history', 'generated', 'fixture'];
const USAGE = 'usage: node scripts/inventory.mjs [--check | --write] [--file <path>] [--json] [--cwd <repo>]';
const TEST_FILE = /\.(?:test|testkit)\.mjs$/;

// The command areas of the dispatcher (bin/js-harness.mjs and S4b); a command's name is its file's name, with the
// exceptions in ENTRY_MODULE.
const COMMAND_GROUPS = {
  a: ['js-harness', 'install', 'sync', 'status', 'update', 'upgrade', 'uninstall', 'doctor', 'init', 'functions'],
  b: ['check', 'gate', 'guard', 'codex-review', 'merge-queue', 'permit', 'rules'],
  c: ['sessions', 'notify', 'wait', 'wake', 'resume', 'remote', 'reply', 'summary', 'tui', 'unseen'],
  d: ['progress', 'contract', 'memory', 'failures', 'throughput', 'audit', 'subagents', 'loop', 'fetch', 'windows-daily'],
  backup: ['backup'],
  clean: ['clean'],
  onboard: ['onboard'],
  report: ['report'],
  stack: ['stack'],
};
const COMMAND_AREA = new Map(Object.entries(COMMAND_GROUPS).flatMap(([area, names]) => names.map((name) => [name, area])));
// The module a command's code lives in, where it is not bin/<command>.mjs. The dispatcher has none (null).
const ENTRY_MODULE = { 'js-harness': null, sync: 'install', uninstall: 'install', status: 'update', upgrade: 'update' };

const CLASS_RULES = [
  ['history', [/^odd\//, /^docs\/sessions\//, /^docs\/origin\.md$/, /^docs\/sweep-2026-10-11\.md$/, /^docs\/model-effort\.md$/, /^docs\/research\//, /^evals\/proofs\//]],
  ['generated', [/^docs\/RULES\.md$/, /^evals\/results\//]],
  ['fixture', [/^evals\/tasks\//, /^evals\/fixtures\//, /^evals\/review\/seeded\//, /^scripts\/fixtures\//, /^bin\/(?:.*\/)?fixtures\//]],
  ['internal', [TEST_FILE, /^scripts\//, /^evals\//, /^\.github\//, /^\.circleci\//]],
];

function classOf(file) {
  for (const [cls, rules] of CLASS_RULES) {
    if (rules.some((rule) => rule.test(file))) return cls;
  }
  return 'live';
}

// The command a bin/ file is named after: its base name without `.mjs`, `.test.mjs` or `.testkit.mjs`, and without
// anything after a dot (`codex-review.second.test.mjs` is codex-review). The longest command name that is the name or
// starts it, followed by `-`, wins.
function commandOf(file) {
  const stem = path.posix.basename(file).replace(TEST_FILE, '').replace(/\.mjs$/, '').split('.')[0];
  let best;
  for (const command of COMMAND_AREA.keys()) {
    if ((stem === command || stem.startsWith(`${command}-`)) && (best === undefined || command.length > best.length)) best = command;
  }
  return best;
}

function entryFile(command) {
  const module = Object.hasOwn(ENTRY_MODULE, command) ? ENTRY_MODULE[command] : command;
  return module === null ? null : `bin/${module}.mjs`;
}

// The import edges of every tracked .mjs file: static imports (`from`, bare) and literal dynamic imports, resolved to
// tracked files only. Every tracked .mjs file is a key, even one with no edge.
const IMPORT_PATTERNS = [
  /\bfrom\s*['"](\.\.?\/[^'"\n]+)['"]/g,
  /\bimport\s*['"](\.\.?\/[^'"\n]+)['"]/g,
  /\bimport\s*\(\s*['"](\.\.?\/[^'"\n]+)['"]\s*\)/g,
];

export function importGraph(root, paths) {
  const modules = new Set(paths.filter((file) => file.endsWith('.mjs')));
  const graph = new Map();
  for (const file of modules) {
    let text = '';
    try {
      text = fs.readFileSync(path.join(root, file), 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    const edges = new Set();
    for (const pattern of IMPORT_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        const target = path.posix.join(path.posix.dirname(file), match[1]);
        if (modules.has(target)) edges.add(target);
        else if (modules.has(`${target}.mjs`)) edges.add(`${target}.mjs`);
      }
    }
    graph.set(file, [...edges]);
  }
  return graph;
}

const REACH = new WeakMap();

// For each file of the graph, the set of areas whose entry module reaches it through the import edges.
function reachedBy(graph) {
  if (!REACH.has(graph)) {
    const reached = new Map();
    for (const [command, area] of COMMAND_AREA) {
      const entry = entryFile(command);
      if (entry === null || !graph.has(entry)) continue;
      const seen = new Set([entry]);
      const queue = [entry];
      while (queue.length > 0) {
        for (const next of graph.get(queue.pop())) {
          // Only library modules: a command that imports another command reads that command's code, and the library
          // behind it belongs to the other command, or the libraries of check would be read by every command.
          if (!seen.has(next) && next.startsWith('bin/lib/')) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      for (const file of seen) reached.set(file, (reached.get(file) ?? new Set()).add(area));
    }
    REACH.set(graph, reached);
  }
  return REACH.get(graph);
}

function areaOfBin(file, graph) {
  const command = commandOf(file);
  if (command !== undefined) return COMMAND_AREA.get(command);
  if (!file.startsWith('bin/lib/')) return 'shared';
  if (TEST_FILE.test(file)) {
    const owner = file.replace(TEST_FILE, '.mjs');
    return graph.has(owner) ? areaOfBin(owner, graph) : 'shared';
  }
  const areas = reachedBy(graph).get(file) ?? new Set();
  return areas.size === 1 ? [...areas][0] : 'shared';
}

/** The class and the area of a tracked path, by S4a and S4b; `graph` is what importGraph returned. */
export function classify(file, graph) {
  const cls = classOf(file);
  if (NO_AREA.includes(cls)) return { class: cls, area: '-' };
  return { class: cls, area: file.startsWith('bin/') ? areaOfBin(file, graph) : 'e' };
}

/** The tracked paths of a repository, in code-unit order. */
export function listTracked(root) {
  return git(root, ['ls-files', '-z']).split('\0').filter((file) => file !== '').sort();
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function repositoryRoot(cwd) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

// The lines of an inventory: the header test, then each row with its line number and its tab-separated fields.
function parse(text) {
  // A checkout with core.autocrlf gives the file CRLF line ends; its rows are the same.
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return {
    headerOk: lines[0] === HEADER,
    rows: lines.slice(1).map((raw, index) => ({ line: index + 2, raw, fields: raw.split('\t') })),
  };
}

function areaProblem(cls, area) {
  if (!AREAS.includes(area)) return `${area} is not an area (${AREAS.join(', ')})`;
  if (!CLASSES.includes(cls)) return null;
  if (NO_AREA.includes(cls) && area !== '-') return `a ${cls} row takes area -, not ${area}`;
  if (!NO_AREA.includes(cls) && area === '-') return `a ${cls} row needs a real area`;
  return null;
}

// The counts of the well-formed rows: per class, per area, and how many hold a verdict.
function countsOf(rows) {
  const classes = Object.fromEntries(CLASSES.map((cls) => [cls, { rows: 0, verdicts: 0 }]));
  const areas = new Map();
  let withVerdict = 0;
  let total = 0;
  for (const { fields } of rows) {
    if (fields.length !== 4) continue;
    const [, cls, area, verdict] = fields;
    const has = verdict.trim() !== '';
    total += 1;
    if (has) withVerdict += 1;
    if (Object.hasOwn(classes, cls)) {
      classes[cls].rows += 1;
      if (has) classes[cls].verdicts += 1;
    }
    areas.set(area, { rows: (areas.get(area)?.rows ?? 0) + 1 });
  }
  const known = AREAS.filter((area) => areas.has(area));
  const unknown = [...areas.keys()].filter((area) => !AREAS.includes(area)).sort();
  const areaCounts = Object.fromEntries([...known, ...unknown].map((area) => [area, areas.get(area)]));
  return { class: classes, area: areaCounts, verdicts: { with: withVerdict, without: total - withVerdict } };
}

/** The findings of an inventory text against the tracked paths, and its counts. `where` names the file in locations. */
export function checkInventory(text, paths, where) {
  const { headerOk, rows } = parse(text);
  const tracked = new Set(paths);
  const findings = [];
  const add = (kind, location, detail) => findings.push({ kind, location, detail });
  if (!headerOk) add('bad-header', `${where}:1`, 'the first line is not the header path, class, area, verdict, tab-separated');
  const seen = new Map();
  for (const row of rows) {
    const location = `${where}:${row.line}`;
    if (row.fields.length !== 4) {
      add('malformed', location, `${row.fields.length} tab-separated fields, want 4`);
      continue;
    }
    const [file, cls, area] = row.fields;
    if (!tracked.has(file)) add('stale', location, `${file} is not tracked`);
    else if (seen.has(file)) add('duplicate', location, `${file} already has a row at line ${seen.get(file)}`);
    else seen.set(file, row.line);
    if (!CLASSES.includes(cls)) add('bad-class', location, `${cls} is not a class (${CLASSES.join(', ')})`);
    const problem = areaProblem(cls, area);
    if (problem) add('bad-area', location, problem);
  }
  for (const file of paths) {
    if (!seen.has(file)) add('missing', file, 'no row; --write adds one');
  }
  return { findings, counts: countsOf(rows) };
}

// The text of the rewritten inventory and what it reports, from the tracked paths and the current file.
function rewrite(text, paths, where, graphOf) {
  const { rows } = parse(text);
  const tracked = new Set(paths);
  const kept = new Map();
  const report = [];
  let dropped = 0;
  for (const row of rows) {
    if (row.fields.length !== 4) {
      report.push(`dropped ${where}:${row.line} (malformed)`);
      dropped += 1;
      continue;
    }
    const [file, cls, area, verdict] = row.fields;
    const shown = verdict || 'none';
    if (!tracked.has(file)) {
      report.push(`dropped ${file} (verdict: ${shown})`);
      dropped += 1;
    } else if (kept.has(file)) {
      report.push(`dropped ${file} (duplicate row, verdict: ${shown})`);
      dropped += 1;
    } else {
      kept.set(file, [cls, area, verdict]);
    }
  }
  let added = 0;
  let graph = null;
  const lines = paths.map((file) => {
    if (kept.has(file)) return [file, ...kept.get(file)].join('\t');
    added += 1;
    graph ??= graphOf();
    const { class: cls, area } = classify(file, graph);
    return [file, cls, area, ''].join('\t');
  });
  return { text: `${[HEADER, ...lines].join('\n')}\n`, report, added, dropped };
}

function parseArgs(argv) {
  let mode = null;
  let json = false;
  const options = { file: null, cwd: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check' || arg === '--write') {
      if (mode !== null && mode !== arg) return { error: '--check and --write cannot be combined' };
      mode = arg;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--file' || arg === '--cwd') {
      const value = argv[index += 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} takes a path` };
      options[arg.slice(2)] = value;
    } else {
      return { error: `unknown argument: ${arg}` };
    }
  }
  if (json && mode === '--write') return { error: '--json applies to --check only' };
  return { mode: mode ?? '--check', json, ...options };
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

function countLines(counts) {
  const lines = CLASSES.map((cls) => `class ${cls}  ${counts.class[cls].rows} rows, ${counts.class[cls].verdicts} with a verdict`);
  for (const [area, value] of Object.entries(counts.area)) lines.push(`area ${area}  ${value.rows} rows`);
  return lines;
}

/** Runs the command on `argv` in the repository of `cwd`; returns { code, stdout, stderr }. */
export function inventoryMain(argv, { cwd = process.cwd() } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.error) return { code: 2, stdout: '', stderr: `${parsed.error}\n${USAGE}\n` };
  const base = parsed.cwd === null ? cwd : path.resolve(cwd, parsed.cwd);
  const root = repositoryRoot(base);
  if (root === null) return { code: 2, stdout: '', stderr: `inventory: ${base} is not inside a git repository\n` };
  const file = parsed.file === null ? path.join(root, INVENTORY) : path.resolve(base, parsed.file);
  const relative = path.relative(root, file).split(path.sep).join('/');
  const where = relative.startsWith('..') ? file.split(path.sep).join('/') : relative;
  const paths = listTracked(root);
  const text = readText(file);
  if (parsed.mode === '--write') {
    const result = rewrite(text, paths, where, () => importGraph(root, paths));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, result.text);
    const lines = [...result.report, `wrote ${where}: ${paths.length} rows, ${result.added} added, ${result.dropped} dropped`];
    return { code: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
  }
  const { findings, counts } = checkInventory(text, paths, where);
  const code = findings.length > 0 ? 1 : 0;
  if (parsed.json) return { code, stdout: `${JSON.stringify({ findings, counts }, null, 2)}\n`, stderr: '' };
  const lines = [...findings.map((f) => `${f.kind}  ${f.location}  ${f.detail}`), ...countLines(counts), `${findings.length} findings`];
  return { code, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  const result = inventoryMain(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.code;
}

// The citations check of the pre-launch audit (S5a of odd/tasks/launch-audit.md, T3): every `path:line`, `path:a-b`
// and commit id in backticks, in every file of class `live` of the inventory, must resolve, so that a reader sent
// to a file, a line or a commit finds one. The resolver is the one of the pending-change check (bin/lib/citations.mjs),
// and this script feeds it every line of every live file, read as the working tree has it.
//
// What it cannot see: a citation whose line still exists but now holds other text, since it checks that the line is
// there and not what it says; a commit that exists but is not the one the sentence meant; and a span that is not a
// citation by the resolver's rules (a path with no extension, or one outside backticks). Files of the other classes
// are not read, since a history file quotes old paths on purpose. A live file missing from the working tree is not
// read either: the inventory check reports it.
//
// Usage: node scripts/audit-citations.mjs [--inventory <tsv>] [--allow <file>] [--json] [--cwd <repo>]
// - `--inventory` is the inventory, default odd/tasks/launch-audit/inventory.tsv under the repository top; a
//   relative path is read from the current folder.
// - `--allow` is the allow list, default odd/tasks/launch-audit/allow/citations.json under the repository top. A
//   missing default is an empty list; a missing file named here is a usage error. An entry is `{ kind, location,
//   why }`: a finding of that kind at that location is hidden and counted as allowed, and an entry that hides no
//   finding is a `stale-allow` finding, so the list cannot rot.
// - `--json` prints the report as one object, `{ findings: [{ kind, location, detail }], allowed }`.
// - `--cwd` is the repository, default the current folder.
//
// Kinds: `no-such-file` (the path is not a file of the working tree), `past-end` (the line or range is beyond the
// file, or malformed), `no-such-commit` (the id is not a commit of the repository). Location is `<file>:<line>` of
// the citing line; detail is the citation as written and the reason. The commit ids are asked of git once, with
// `git cat-file --batch-check`, and an id git calls ambiguous counts as present (a short id two objects share).
//
// Exits 0 with no finding beyond the allow list, 1 with findings (a stale allow entry is one), 2 on a usage error or
// on an inventory or allow list that cannot be read.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { citationsIn, resolveCitations } from '../bin/lib/citations.mjs';

const USAGE = 'usage: node scripts/audit-citations.mjs [--inventory <tsv>] [--allow <file>] [--json] [--cwd <repo>]';
const DEFAULT_INVENTORY = 'odd/tasks/launch-audit/inventory.tsv';
const DEFAULT_ALLOW = 'odd/tasks/launch-audit/allow/citations.json';
const VALUED = new Set(['--inventory', '--allow', '--cwd']);

/** The options of the command line, or `{ error }`. */
export function parseArgs(argv) {
  const options = { inventory: null, allow: null, cwd: process.cwd(), json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
    } else if (VALUED.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} takes a value` };
      options[arg.slice(2)] = value;
      index += 1;
    } else {
      return { error: `unknown argument: ${arg}` };
    }
  }
  return { options };
}

/** The repository paths of the live rows of an inventory (tab-separated, `path` and `class` named by its header), or
 * `{ error }` when the header names no such column. A row of another class is not read. */
export function liveFiles(text) {
  const [header = '', ...rows] = text.split(/\r?\n/);
  const columns = header.split('\t');
  const pathColumn = columns.indexOf('path');
  const classColumn = columns.indexOf('class');
  if (pathColumn < 0 || classColumn < 0) return { error: 'the header line names no path and class column' };
  const files = new Set();
  for (const row of rows) {
    const cells = row.split('\t');
    if (cells[classColumn] === 'live' && cells[pathColumn]) files.add(cells[pathColumn]);
  }
  return { files: [...files] };
}

/** The ids of `ids` git answers for: `output` is the answer of `git cat-file --batch-check` fed `<id>^{commit}` per id,
 * one line per id, in order. A commit answers `<sha> commit <size>`; an id two objects share answers `ambiguous`, which
 * also counts as a commit; `missing` does not. */
export function parseBatchCheck(ids, output) {
  const answers = output.split('\n');
  const present = new Set();
  ids.forEach((id, index) => {
    const answer = answers[index] ?? '';
    if (/ commit \d+$/.test(answer) || answer.endsWith(' ambiguous')) present.add(id);
  });
  return present;
}

/** The lines of a file's text, with no empty line after its final line end. */
function linesOf(text) {
  return text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/);
}

/** The lines of the working-tree file at `repoPath` (a path inside `top`), or `null` when there is no regular file. */
function readLines(top, repoPath) {
  const abs = path.resolve(top, repoPath);
  if (!abs.startsWith(top + path.sep)) return null;
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
  return stat.isFile() ? linesOf(fs.readFileSync(abs, 'utf8')) : null;
}

/** The commit ids of `ids` that the repository at `top` has, from one `git cat-file --batch-check`. */
function commitsIn(top, ids) {
  if (ids.length === 0) return new Set();
  const run = spawnSync('git', ['cat-file', '--batch-check'], {
    cwd: top,
    input: ids.map((id) => `${id}^{commit}\n`).join(''),
    encoding: 'utf8',
  });
  if (run.error || run.status !== 0) throw new Error(`git cat-file failed: ${run.error?.message ?? run.stderr.trim()}`);
  return parseBatchCheck(ids, run.stdout);
}

/** The kind of a finding, from the resolver's reason for it. */
function kindOf(why) {
  if (why === 'no such file') return 'no-such-file';
  if (why === 'no such commit') return 'no-such-commit';
  return 'past-end';
}

/** The findings of the citations in the live `files` (repository paths) of the repository at `top`, before the allow
 * list: `{ kind, location, detail }` each. */
export function citationFindings(top, files) {
  const cache = new Map();
  const linesAt = (repoPath) => {
    if (!cache.has(repoPath)) cache.set(repoPath, readLines(top, repoPath));
    return cache.get(repoPath);
  };
  const added = [];
  for (const file of files) {
    (linesAt(file) ?? []).forEach((text, index) => added.push({ file, line: index + 1, text }));
  }
  const ids = new Set();
  for (const { text } of added) {
    for (const citation of citationsIn(text)) if (citation.kind === 'commit') ids.add(citation.id);
  }
  const commits = commitsIn(top, [...ids]);
  const { unresolved } = resolveCitations(added, {
    lineCount: (repoPath) => linesAt(repoPath)?.length ?? null,
    commitExists: (id) => commits.has(id),
  });
  return unresolved.map(({ file, line, citation, why }) => ({
    kind: kindOf(why),
    location: `${file}:${line}`,
    detail: `${citation} (${why})`,
  }));
}

/** The allow list, `[{ kind, location, why }]`, or `{ error }` when it is not such an array. */
export function parseAllow(text) {
  let entries;
  try {
    entries = JSON.parse(text);
  } catch (error) {
    return { error: `not JSON: ${error.message}` };
  }
  const shaped = Array.isArray(entries) && entries.every((entry) => entry && ['kind', 'location', 'why']
    .every((key) => typeof entry[key] === 'string'));
  return shaped ? { entries } : { error: 'a JSON array of { kind, location, why } is expected' };
}

/** The findings the allow list does not hide, and how many it hides. Each entry that hides none is a `stale-allow`
 * finding at its location. */
export function applyAllow(findings, entries) {
  const used = new Set();
  const kept = [];
  let allowed = 0;
  for (const finding of findings) {
    const hiding = entries.flatMap((entry, index) => (entry.kind === finding.kind && entry.location === finding.location
      ? [index]
      : []));
    if (hiding.length === 0) {
      kept.push(finding);
    } else {
      hiding.forEach((index) => used.add(index));
      allowed += 1;
    }
  }
  entries.forEach((entry, index) => {
    if (!used.has(index)) kept.push({ kind: 'stale-allow', location: entry.location, detail: `no finding of kind ${entry.kind} here` });
  });
  return { findings: kept, allowed };
}

/** The top of the git repository `cwd` is in, or `null` when there is none. */
function repositoryTop(cwd) {
  const run = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  return run.status === 0 && !run.error ? path.resolve(run.stdout.trim()) : null;
}

/** Runs the check on the command line `argv`, prints its report, and returns the exit code. */
export function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n${USAGE}\n`);
    return 2;
  }
  const { options } = parsed;
  const top = repositoryTop(options.cwd);
  if (top === null) {
    process.stderr.write(`not a git repository: ${options.cwd}\n`);
    return 2;
  }
  const inventoryPath = options.inventory ? path.resolve(options.inventory) : path.join(top, DEFAULT_INVENTORY);
  if (!fs.existsSync(inventoryPath)) {
    process.stderr.write(`inventory not found: ${inventoryPath}\n`);
    return 2;
  }
  const inventory = liveFiles(fs.readFileSync(inventoryPath, 'utf8'));
  if (inventory.error) {
    process.stderr.write(`${inventoryPath}: ${inventory.error}\n`);
    return 2;
  }
  const allowPath = options.allow ? path.resolve(options.allow) : path.join(top, DEFAULT_ALLOW);
  let entries = [];
  if (fs.existsSync(allowPath)) {
    const allow = parseAllow(fs.readFileSync(allowPath, 'utf8'));
    if (allow.error) {
      process.stderr.write(`${allowPath}: ${allow.error}\n`);
      return 2;
    }
    entries = allow.entries;
  } else if (options.allow) {
    process.stderr.write(`allow list not found: ${allowPath}\n`);
    return 2;
  }
  let found;
  try {
    found = applyAllow(citationFindings(top, inventory.files), entries);
  } catch (error) {
    process.stderr.write(`audit-citations: ${error.message}\n`);
    return 2;
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ findings: found.findings, allowed: found.allowed }, null, 2)}\n`);
  } else {
    const lines = found.findings.map((finding) => `${finding.kind}  ${finding.location}  ${finding.detail}`);
    lines.push(`${found.findings.length} findings, ${found.allowed} allowed`);
    process.stdout.write(`${lines.join('\n')}\n`);
  }
  return found.findings.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}

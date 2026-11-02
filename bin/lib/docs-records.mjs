// The records of the harness held to its source (odd/tasks/audit-pack.md, spec 4): docs/SPEC.md's "Where state lives"
// is the one map of what the harness writes (where, writer, reader) and docs/RECORDS.md holds the fields of each row.
// An auditor reads the map to know what a file under the home is; a map that drifted from the code would send them to a
// record that moved or hide one that was added, so this reads the record names the source joins into paths and fails on
// a name no row holds, a row no source names, a writer that no longer holds its function and a row without fields. The
// fields themselves are not checked: no schema exists to check them against. The check is lexical: a row's folder must
// be named by its writers' files, which catches a folder that moved, but not one those files also name for another
// record; resolving the paths the source composes would be another feature. Pure: the command reads the files.

/** The extensions of a file name the source joins to a path that make it a record, or a read of another tool's. */
const RECORD_FILE = /^[^/\s'"`]*\.(?:json|jsonl|tsv|log|md|lock|stopped|xml)$/;

/** Literals joined to a path that are no record at all: a skill's file, a folder of commands, a host's name. */
const NO_NAMES = new Set(['SKILL.md', 'bin', 'claude']);

/** The names the source joins that are no record of the harness, each with why: the files of the hosts and of other
 * tools that it reads or edits in place (their undo is the machine manifest's), the project's own files it reads, and
 * scratch made in a temporary folder. `files`, where given, limits an entry to the files that join the name there. */
export const NOT_RECORDS = [
  { name: '.claude.json', why: "Claude Code's account file, read" },
  { name: '.pnpm-global-bin.lock', why: "pnpm's own lock, deleted when a crash left it stale" },
  { name: '*.jsonl', why: 'a pattern of names a backup looks for, not a name' },
  { name: '<*>.jsonl', files: ['bin/lib/rules-change-run.mjs', 'bin/lib/sessions.mjs', 'bin/resume.mjs', 'bin/sessions.mjs'], why: "Claude's session transcripts, read" },
  { name: 'agent-<*>.jsonl', why: "Claude's subagent transcripts, read" },
  { name: 'AGENTS.override.md', why: "Codex's instructions, read to measure the payload" },
  { name: 'installed_plugins.json', why: "Claude's plugin registry, read" },
  { name: 'marketplace.json', why: "a plugin marketplace's catalogue, read for a version" },
  { name: 'scheduled-tasks.json', why: "the Claude app's scheduled tasks, read" },
  { name: 'scope_v3.json', why: "the Claude app's file that gives its version, read" },
  { name: 'ccd-session-presets.json', why: "the Claude app's file, copied by the memory backup" },
  { name: 'side-session-notes', why: "the Claude app's folder, copied by the memory backup" },
  { name: 'codex-package.json', why: "the Codex release's file, read for the daemon's health" },
  { name: 'daemon.pid', why: "the Codex daemon's state, read" },
  { name: 'daemon.stderr.log', why: "the Codex daemon's state, read" },
  { name: 'daemon-updater.pid', why: "the Codex daemon's state, read" },
  { name: 'daemon-updater.stderr.log', why: "the Codex daemon's state, read" },
  { name: 'prompt.md', files: ['bin/lens-review.mjs'], why: "a lens's prompt, in a temporary folder removed after the run" },
  { name: 'schema.json', files: ['bin/double-review.mjs'], why: "the Codex reader's answer schema, in a temporary folder removed after the read" },
  { name: 'verify-export.json', why: "engram's export in a scratch home a backup check removes" },
  { name: 'ls-files', why: 'a git subcommand in a constant of arguments' },
  { name: 'SUMMARY.md', why: "a blob the memory backup pushes to a branch of its repository, no file on disk (the memory backup's row)" },
];

/** A literal's placeholders written one way: `${…}` in source and `<…>` in the table both read `<*>`. */
const normal = (name) => name.replace(/\$\{[^}]*\}/g, '<*>').replace(/<[^>]*>/g, '<*>').replace(/^\.\//, '');

const literals = (text) => [...text.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)].map((match) => match[1] ?? match[2] ?? match[3]);

/** The record names each source file joins into a path, as a map of the name (placeholders read `<*>`) to the files:
 * a name joined after `.js-harness`, the second argument of `jsonLinesPath` and `appendJsonLine`, a `--git-path
 * js-harness/` literal, a record file name joined to a path, and a constant named `DIR`, `FILE`, `FILES`, `PATH` or
 * `FOLDER`, or ending in one after an underscore, frozen or not. */
export function detectRecordNames(sources) {
  const found = new Map();
  const add = (raw, file) => {
    const name = normal(raw);
    if (!name || NO_NAMES.has(name)) return;
    if (!found.has(name)) found.set(name, new Set());
    found.get(name).add(file);
  };
  for (const [file, text] of sources) {
    for (const match of text.matchAll(/['"]\.js-harness['"]\s*,\s*((?:['"`][^'"`\n]+['"`]\s*,?\s*)+)/g)) add(literals(match[1]).join('/'), file);
    for (const match of text.matchAll(/\b(?:jsonLinesPath|appendJsonLine)\([^,()]+(?:\([^()]*\))?,\s*['"`]([^'"`]+)['"`]/g)) add(match[1], file);
    for (const match of text.matchAll(/['"]--git-path['"]\s*,\s*['"`](js-harness\/[^'"`]*)['"`]/g)) add(match[1], file);
    for (const match of text.matchAll(/path\.(?:posix\.)?join\(((?:[^()]|\([^()]*\))*)\)/g)) {
      for (const name of literals(match[1])) if (RECORD_FILE.test(name)) add(name, file);
    }
    for (const match of text.matchAll(/\bconst\s+(?:[A-Z][A-Z0-9_]*_)?(?:DIR|FILE|FILES|PATH|FOLDER)\s*=\s*(?:Object\.freeze\()?(\[[^\]]*\]|'[^'\n]*'|"[^"\n]*"|`[^`\n]*`)/g)) {
      // A constant can hold an option or a sentence; only a name of a file or a folder can be a record.
      for (const name of literals(match[1])) if (/^[\w.<>${}-][\w.<>${}/-]*$/.test(name) && !name.startsWith('-')) add(name, file);
    }
  }
  return found;
}

/** The cells of a table row, the pipes inside code marks kept. */
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split(/\|(?=(?:[^`]*`[^`]*`)*[^`]*$)/).map((cell) => cell.trim());

const ticked = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

/** The rows of the table under `### Where state lives` of docs/SPEC.md, each `{ record, line, paths, writers, byHand }`:
 * `paths` every code span of its Where cell (a folder, then the patterns of its children); `writers` each file of its
 * Written by cell with the functions named after it; `byHand` where that cell says the record is written by hand. */
export function parseRecordTable(markdown) {
  const rows = [];
  let inside = false;
  markdown.split(/\r?\n/).forEach((line, at) => {
    if (/^#{1,3} /.test(line)) inside = line.trim() === '### Where state lives';
    if (!inside || !/^\|/.test(line) || /^\|\s*(?:Record\s*\||-)/.test(line)) return;
    const [record, where = '', writtenBy = ''] = cells(line);
    const writers = [];
    for (const span of ticked(writtenBy)) {
      if (/^bin\/.+\.[cm]js$/.test(span)) writers.push({ file: span, fns: [] });
      else if (writers.length > 0 && /^[A-Za-z_$][\w$]*$/.test(span)) writers.at(-1).fns.push(span);
    }
    rows.push({
      record,
      line: at + 1,
      paths: ticked(where),
      writers: writers.flatMap(({ file, fns }) => fns.map((fn) => ({ file, fn }))),
      byHand: /\bby hand\b/.test(writtenBy),
    });
  });
  return rows;
}

/** The records docs/RECORDS.md gives fields to: its second-level headings, in order; a third-level one is a variant of
 * the record above it. */
export const parseRecordSections = (markdown) => markdown.split(/\r?\n/).filter((line) => /^## /.test(line)).map((line) => line.slice(3).trim());

const segments = (name) => normal(name).split('/').filter(Boolean);
const placeholderOnly = (name) => /^<\*>\.[\w.]+$/.test(name);

/** Whether the `name` detected is one of `paths`: its segments a run of one path's segments. */
function inFamily(name, paths) {
  const wanted = segments(name);
  return paths.some((one) => {
    const have = segments(one);
    for (let at = 0; at + wanted.length <= have.length; at += 1) {
      if (wanted.every((part, index) => part === have[at + index])) return true;
    }
    return false;
  });
}

/** The segments of a path that hold no placeholder, each of which the source must name, folders as much as the file,
 * since a path is joined from separate literals; the home and the harness's folder in the git folder are everyone's. */
const pathLiterals = (one) => segments(one).filter((part) => !part.includes('<*>') && !['~', '.js-harness', 'js-harness'].includes(part));

/** What does not hold between the table, docs/RECORDS.md and the source, as lines: a detected name no row holds (a name
 * made of a placeholder and an extension only by a row whose writer is the file that names it) and that `notRecords`
 * does not leave out; a row's path no source names, unless the row is written by hand; a writer whose file no longer
 * holds its function; a row with no section and a section with no row. */
export function recordFindings({ rows, sections, detected, sources, notRecords = NOT_RECORDS }) {
  const lines = [];
  const leftOut = (name, file) => notRecords.some((entry) => normal(entry.name) === name && (entry.files === undefined || entry.files.includes(file)));
  const names = [...detected.keys()].sort((a, b) => a.localeCompare(b));
  for (const name of names) {
    const holders = rows.filter((row) => inFamily(name, row.paths));
    const files = [...detected.get(name)].filter((file) => !leftOut(name, file));
    const uncovered = placeholderOnly(name)
      ? files.filter((file) => !holders.some((row) => row.writers.some((writer) => writer.file === file)))
      : holders.length > 0 ? [] : files;
    if (uncovered.length > 0) lines.push(`${name} (${uncovered.join(', ')}) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why`);
  }
  const texts = [...sources.values()];
  for (const row of rows.filter((one) => !one.byHand)) {
    // A row's writers must name its path: a folder named anywhere else in the source is no proof the record is there.
    const own = [...new Set(row.writers.map((writer) => writer.file))].map((file) => sources.get(file) ?? '');
    const where = own.length > 0 ? own : texts;
    for (const literal of [...new Set(row.paths.flatMap(pathLiterals))]) {
      if (!where.some((text) => text.includes(literal))) lines.push(`"${row.record}" (line ${row.line}) names ${literal}, which ${own.length > 0 ? 'none of its writers\' files names' : 'no source file names'}: the record is gone, or its row is written by hand`);
    }
  }
  for (const row of rows) {
    for (const { file, fn } of row.writers) {
      const text = sources.get(file);
      const declared = new RegExp(`\\b(?:function\\*?\\s+${fn}\\b|(?:const|let)\\s+${fn}\\s*=)`);
      if (text === undefined || !declared.test(text)) lines.push(`"${row.record}" (line ${row.line}) names its writer ${fn} in ${file}, which no longer holds it`);
    }
  }
  const sectioned = new Set(sections);
  for (const row of rows) if (!sectioned.has(row.record)) lines.push(`"${row.record}" (line ${row.line}) has no section in docs/RECORDS.md: its fields have no home`);
  const recorded = new Set(rows.map((row) => row.record));
  for (const section of sections) if (!recorded.has(section)) lines.push(`the section "${section}" of docs/RECORDS.md names no row of the table in docs/SPEC.md`);
  return lines;
}

/** The source the detector reads, as a map of file to text: the commands and modules under `bin/`, the CommonJS ones
 * among them (a preload such as the tracer), not their tests nor the kits of tests. */
export const recordSources = (files, read) => new Map(files.filter((file) => /^bin\/.*\.[cm]js$/.test(file) && !/\.test\.[cm]js$|\.testkit\.[cm]js$/.test(file)).map((file) => [file, read(file)]));

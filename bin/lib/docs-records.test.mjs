import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { detectRecordNames, parseRecordSections, parseRecordTable, recordFindings, recordSources } from './docs-records.mjs';

/** A table of records in the shape of docs/SPEC.md's "Where state lives". */
function table(rows) {
  return [
    '### Where state lives',
    '',
    '| Record | Where | Written by | Read by |',
    '|---|---|---|---|',
    ...rows.map((cells) => `| ${cells.join(' | ')} |`),
    '',
    '### Sessions and the lead',
    '',
  ].join('\n');
}

const ROWS = [
  ['The remote server', '`~/.js-harness/remote/`: `<id>.json`, `<id>.lock`', '`bin/lib/remote.mjs` `startRemote`', '`remote status`'],
  ['Lands', '`<git common dir>/js-harness/lands.jsonl`', '`bin/merge-queue.mjs` `recordLand`', '`throughput`'],
  ['The plan', '`docs/ROADMAP.md`', 'sessions, by hand', '`progress`'],
];

const SOURCES = new Map([
  ['bin/lib/remote.mjs', "export function startRemote(home, id) {\n  const dir = path.join(home, '.js-harness', 'remote');\n  fs.writeFileSync(path.join(dir, `${id}.json`), '{}');\n  fs.writeFileSync(path.join(dir, `${id}.lock`), '');\n}\n"],
  ['bin/merge-queue.mjs', "export function recordLand(cwd, land) {\n  appendJsonLine(jsonLinesPath(cwd, 'lands.jsonl'), land);\n}\n"],
  ['bin/progress.mjs', "const plan = fs.readFileSync(path.join(root, 'docs', 'ROADMAP.md'), 'utf8');\n"],
]);

const RECORDS = '# Records\n\nThe fields of each record.\n\n## The remote server\n\nFields.\n\n## Lands\n\nFields.\n\n## The plan\n\nFields.\n';

/** The findings of the fixture, with `edit` applied to its inputs first. */
function findings(edit = {}) {
  const sources = edit.sources ?? SOURCES;
  return recordFindings({
    rows: parseRecordTable(table(edit.rows ?? ROWS)),
    sections: parseRecordSections(edit.records ?? RECORDS),
    detected: detectRecordNames(sources),
    sources,
    notRecords: edit.notRecords ?? [],
  });
}

test('detectRecordNames reads a home name, a record of the git folder, a file joined to a path and a constant naming a record', () => {
  const detected = detectRecordNames(new Map([
    ['bin/a.mjs', "const dir = path.join(os.homedir(), '.js-harness', 'channel', 'pause');\n"],
    ['bin/b.mjs', "appendJsonLine(jsonLinesPath(cwd, 'lands.jsonl'), line);\nspawn('git', ['rev-parse', '--git-path', 'js-harness/manifest.json']);\n"],
    ['bin/c.mjs', "const file = path.join(dir, `${id}.lock`);\nconst named = path.join(dir, 'SKILL.md');\n"],
    ['bin/d.mjs', "export const HOMES_DIR = 'codex-review-homes';\nconst REVIEW_RECORD_FILES = Object.freeze(['codex-reviews.jsonl', 'lens-reviews.jsonl']);\n"],
    ['bin/e.mjs', "const FILE = 'codex-review-runs.jsonl';\nexport const LENS_ANSWERS_FOLDER = 'lens-answers';\nconst SUBMODULE_AS_A_FILE = '--submodule=short';\n"],
  ]));
  assert.deepEqual([...detected.keys()].sort(), ['<*>.lock', 'channel/pause', 'codex-review-homes', 'codex-review-runs.jsonl', 'codex-reviews.jsonl', 'js-harness/manifest.json', 'lands.jsonl', 'lens-answers', 'lens-reviews.jsonl']);
  assert.deepEqual([...detected.get('<*>.lock')], ['bin/c.mjs']);
});

test('parseRecordTable reads each row with the paths of its family, its writers by file and function, and whether it is written by hand', () => {
  const rows = parseRecordTable(table(ROWS));
  assert.deepEqual(rows.map((row) => [row.record, row.paths, row.writers, row.byHand]), [
    ['The remote server', ['~/.js-harness/remote/', '<id>.json', '<id>.lock'], [{ file: 'bin/lib/remote.mjs', fn: 'startRemote' }], false],
    ['Lands', ['<git common dir>/js-harness/lands.jsonl'], [{ file: 'bin/merge-queue.mjs', fn: 'recordLand' }], false],
    ['The plan', ['docs/ROADMAP.md'], [], true],
  ]);
  assert.equal(rows[0].line, 5);
});

test('the fixture holds: every detected name is in a family, every path is in the source, every writer holds its function, every row has a section', () => {
  assert.deepEqual(findings(), []);
});

test('a new name under the home that no row holds is a finding', () => {
  const sources = new Map([...SOURCES, ['bin/pace.mjs', "export function pace(home) { return path.join(home, '.js-harness', 'pace'); }\n"]]);
  assert.deepEqual(findings({ sources }), ['pace (bin/pace.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why']);
});

test('a new child under a folder already in the table is a finding, though its folder has a row', () => {
  const sources = new Map([...SOURCES, ['bin/lib/remote.mjs', `${SOURCES.get('bin/lib/remote.mjs')}const log = path.join(dir, \`\${id}.log\`);\n`]]);
  assert.deepEqual(findings({ sources }), ['<*>.log (bin/lib/remote.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why']);
});

test('a name made of a placeholder and an extension is held only by a row whose writer is the file that names it', () => {
  const sources = new Map([...SOURCES, ['bin/permit.mjs', 'const file = path.join(dir, `${item.id}.json`);\n']]);
  assert.deepEqual(findings({ sources }), ['<*>.json (bin/permit.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why']);
});

test('a non-JSON record and a record of the git folder or of the project the table lacks are findings', () => {
  const sources = new Map([
    ...SOURCES,
    ['bin/gate.mjs', "const log = path.join(home, '.js-harness', 'gate-log');\n"],
    ['bin/double-review.mjs', "appendJsonLine(jsonLinesPath(cwd, 'double-reviews.jsonl'), read);\n"],
    ['bin/flaky.mjs', "const text = fs.readFileSync(path.join(root, 'docs', 'FLAKY.md'), 'utf8');\n"],
  ]);
  assert.deepEqual(findings({ sources }), [
    'double-reviews.jsonl (bin/double-review.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why',
    'FLAKY.md (bin/flaky.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why',
    'gate-log (bin/gate.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why',
  ]);
});

test('a name that is no record is left out where the list of names that are no records says why', () => {
  const sources = new Map([...SOURCES, ['bin/stack.mjs', "const config = path.join(os.homedir(), '.claude.json');\n"]]);
  assert.deepEqual(findings({ sources, notRecords: [{ name: '.claude.json', why: "Claude's own configuration, read" }] }), []);
  const scoped = [{ name: '.claude.json', files: ['bin/other.mjs'], why: 'read there' }];
  assert.equal(findings({ sources, notRecords: scoped }).length, 1);
});

test('a row whose path no source names is a finding, unless the row is written by hand', () => {
  const rows = [...ROWS, ['Old records', '`~/.js-harness/old-records/`', 'the `old` command', '`status`']];
  assert.deepEqual(findings({ rows, records: `${RECORDS}\n## Old records\n\nFields.\n` }), ['"Old records" (line 8) names old-records, which no source file names: the record is gone, or its row is written by hand']);
});

test('a row whose folder no source names is a finding, though the source names its file', () => {
  const rows = [...ROWS, ['Lands moved', '`<git common dir>/js-harness/no-such-folder/lands.jsonl`', '`bin/merge-queue.mjs` `recordLand`', '`throughput`']];
  assert.deepEqual(findings({ rows, records: `${RECORDS}\n## Lands moved\n\nFields.\n` }), ['"Lands moved" (line 8) names no-such-folder, which none of its writers\' files names: the record is gone, or its row is written by hand']);
});

test("a row's folder named elsewhere in the source, but not by its writers, is a finding", () => {
  const rows = [...ROWS, ['Lands moved', '`<git common dir>/js-harness/remote/lands.jsonl`', '`bin/merge-queue.mjs` `recordLand`', '`throughput`']];
  assert.deepEqual(findings({ rows, records: `${RECORDS}\n## Lands moved\n\nFields.\n` }), ['"Lands moved" (line 8) names remote, which none of its writers\' files names: the record is gone, or its row is written by hand']);
});

test('a record moved to another file under the same name is a finding: its row names a writer that no longer holds it', () => {
  const sources = new Map([...SOURCES, ['bin/lib/remote.mjs', "const dir = path.join(home, '.js-harness', 'remote');\n"], ['bin/lib/remote-start.mjs', "export function startRemote(home, id) {\n  fs.writeFileSync(path.join(dir, `${id}.json`), '{}');\n  fs.writeFileSync(path.join(dir, `${id}.lock`), '');\n}\n"]]);
  assert.deepEqual(findings({ sources }), [
    '<*>.json (bin/lib/remote-start.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why',
    '<*>.lock (bin/lib/remote-start.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why',
    '"The remote server" (line 5) names its writer startRemote in bin/lib/remote.mjs, which no longer holds it',
  ]);
});

test('a section of docs/RECORDS.md that names no row, and a row with no section, are findings', () => {
  const records = RECORDS.replace('## Lands', '## Land records');
  assert.deepEqual(findings({ records }), [
    '"Lands" (line 6) has no section in docs/RECORDS.md: its fields have no home',
    'the section "Land records" of docs/RECORDS.md names no row of the table in docs/SPEC.md',
  ]);
});

test('parseRecordSections reads the second-level headings, and the third-level ones are variants of the record above', () => {
  assert.deepEqual(parseRecordSections('# Records\n\n## The channel\n\n### A note\n\n### A ready notice\n\n## Lands\n'), ['The channel', 'Lands']);
});

// The repository's own records: SPEC's table and docs/RECORDS.md held to the source as `docs check` holds them.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The files under `bin` of the tree at `root`: what git tracks there, or, with no `.git` as in the gate's WSL mirror
 * (synced without it), every file on disk, so the table is held on Linux too and not against an empty listing. */
function sourceFiles(root) {
  if (!fs.existsSync(path.join(root, '.git'))) {
    return fs.readdirSync(path.join(root, 'bin'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
  }
  const listed = spawnSync('git', ['ls-files', 'bin'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  return listed.filter((file) => fs.existsSync(path.join(root, file)));
}

test('with no .git, as in the gate\'s WSL mirror, the files of bin are read from the disk', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'records-mirror-'));
  try {
    fs.mkdirSync(path.join(scratch, 'bin', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'bin', 'a.mjs'), '');
    fs.writeFileSync(path.join(scratch, 'bin', 'lib', 'b.mjs'), '');
    assert.deepEqual(sourceFiles(scratch).sort(), ['bin/a.mjs', 'bin/lib/b.mjs']);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("the harness's own table of records holds against its source", () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sources = recordSources(sourceFiles(ROOT), read);
  const found = recordFindings({
    rows: parseRecordTable(read('docs/SPEC.md')),
    sections: parseRecordSections(read('docs/RECORDS.md')),
    detected: detectRecordNames(sources),
    sources,
  });
  assert.deepEqual(found, []);
});

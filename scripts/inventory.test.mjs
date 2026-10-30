import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classify, importGraph, listTracked } from './inventory.mjs';

const SCRIPT = fileURLToPath(new URL('./inventory.mjs', import.meta.url));
const INV = 'odd/tasks/launch-audit/inventory.tsv';
const HEADER = 'path\tclass\tarea\tverdict';
const FINDING = /^(missing|duplicate|stale|bad-class|bad-area|malformed|bad-header)  /;

const scratch = [];
after(() => {
  for (const dir of scratch) fs.rmSync(dir, { recursive: true, force: true });
});

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

// A temporary repository whose files are tracked (in the index, no commit), given as { "path": "text" }.
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-test-'));
  scratch.push(root);
  git(root, ['init', '-q']);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  git(root, ['add', '-A']);
  return root;
}

// The inventory of a repository, written after `git add` so that it is not a tracked path itself.
function inventory(root, lines) {
  const file = path.join(root, INV);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

function read(root) {
  return fs.readFileSync(path.join(root, INV), 'utf8');
}

function run(root, args = []) {
  return spawnSync(process.execPath, [SCRIPT, '--cwd', root, ...args], { encoding: 'utf8' });
}

// The findings of a check, as [kind, location] pairs.
function findingsOf(stdout) {
  return stdout.split('\n').filter((line) => FINDING.test(line)).map((line) => line.split('  ').slice(0, 2));
}

function world(files) {
  const root = repo(files);
  return { root, graph: importGraph(root, listTracked(root)) };
}

test('missing: a tracked path with no row is a finding, located at the path', () => {
  const root = repo({ 'a.md': 'a\n', 'b.md': 'b\n' });
  inventory(root, [HEADER, 'a.md\tlive\te\t']);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.deepEqual(findingsOf(result.stdout), [['missing', 'b.md']]);
  assert.match(result.stdout, /\n1 findings\n$/);
});

test('duplicate: a second row for a path is a finding, located at its line', () => {
  const root = repo({ 'a.md': 'a\n' });
  inventory(root, [HEADER, 'a.md\tlive\te\t', 'a.md\tlive\te\t']);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.deepEqual(findingsOf(result.stdout), [['duplicate', `${INV}:3`]]);
});

test('stale: a row whose path is not tracked is a finding', () => {
  const root = repo({ 'a.md': 'a\n' });
  inventory(root, [HEADER, 'a.md\tlive\te\t', 'gone.md\tlive\te\t']);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.deepEqual(findingsOf(result.stdout), [['stale', `${INV}:3`]]);
});

test('bad-class: a class outside the six is a finding', () => {
  const root = repo({ 'a.md': 'a\n' });
  inventory(root, [HEADER, 'a.md\tlibe\te\t']);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.deepEqual(findingsOf(result.stdout), [['bad-class', `${INV}:2`]]);
});

const BAD_AREA = [
  ['an unknown area', 'a.md', 'live', 'zz'],
  ['- on a live row', 'a.md', 'live', '-'],
  ['- on a compatibility row', 'a.md', 'compatibility', '-'],
  ['a real area on a history row', 'odd/x.md', 'history', 'a'],
];
for (const [name, file, cls, area] of BAD_AREA) {
  test(`bad-area: ${name} is a finding`, () => {
    const root = repo({ [file]: 'x\n' });
    inventory(root, [HEADER, `${file}\t${cls}\t${area}\t`]);
    const result = run(root);
    assert.equal(result.status, 1);
    assert.deepEqual(findingsOf(result.stdout), [['bad-area', `${INV}:2`]]);
  });
}

test('malformed: a row without four fields is a finding, and its path is then missing', () => {
  const root = repo({ 'a.md': 'a\n' });
  inventory(root, [HEADER, 'a.md\tlive\te']);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.deepEqual(findingsOf(result.stdout), [['malformed', `${INV}:2`], ['missing', 'a.md']]);
});

test('bad-header: a first line other than the header is a finding', () => {
  const root = repo({ 'a.md': 'a\n' });
  inventory(root, ['path\tclass\tarea', 'a.md\tlive\te\t']);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.deepEqual(findingsOf(result.stdout), [['bad-header', `${INV}:1`]]);
});

test('a correct inventory exits 0 and prints the counts per class and per area', () => {
  const root = repo({ 'a.md': 'a\n', 'odd/x.md': 'x\n' });
  inventory(root, [HEADER, 'a.md\tlive\te\tkept', 'odd/x.md\thistory\t-\t']);
  const result = run(root);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout, [
    'class live  1 rows, 1 with a verdict',
    'class history  1 rows, 0 with a verdict',
    'class generated  0 rows, 0 with a verdict',
    'class fixture  0 rows, 0 with a verdict',
    'class internal  0 rows, 0 with a verdict',
    'class compatibility  0 rows, 0 with a verdict',
    'area e  1 rows',
    'area -  1 rows',
    '0 findings',
    '',
  ].join('\n'));
});

test('an inventory checked out with CRLF line ends reads as the same rows', () => {
  const root = repo({ 'a.md': 'a\n', 'odd/x.md': 'x\n' });
  inventory(root, [HEADER, 'a.md\tlive\te\tkept', 'odd/x.md\thistory\t-\t']);
  fs.writeFileSync(path.join(root, INV), read(root).replace(/\n/g, '\r\n'));
  const result = run(root);
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(findingsOf(result.stdout), []);
  assert.match(result.stdout, /^class live {2}1 rows, 1 with a verdict$/m);
});

test('--json prints the findings and the counts as one object', () => {
  const root = repo({ 'a.md': 'a\n', 'odd/x.md': 'x\n' });
  inventory(root, [HEADER, 'a.md\tlive\te\tkept', 'odd/x.md\thistory\t-\t']);
  const result = run(root, ['--json']);
  assert.equal(result.status, 0, result.stdout);
  const json = JSON.parse(result.stdout);
  assert.deepEqual(json.findings, []);
  assert.deepEqual(json.counts.class.live, { rows: 1, verdicts: 1 });
  assert.deepEqual(json.counts.class.history, { rows: 1, verdicts: 0 });
  assert.deepEqual(json.counts.area, { e: { rows: 1 }, '-': { rows: 1 } });
  assert.deepEqual(json.counts.verdicts, { with: 1, without: 1 });
});

test('--write adds a missing row classified, keeps a verdict, and drops and prints a stale row', () => {
  const root = repo({ 'a.md': 'a\n', 'bin/check-x.test.mjs': '\n', 'new.md': 'n\n' });
  inventory(root, [HEADER, 'a.md\tlive\te\tkept note', 'gone.md\tlive\te\told note']);
  const result = run(root, ['--write']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, [
    'dropped gone.md (verdict: old note)',
    `wrote ${INV}: 3 rows, 2 added, 1 dropped`,
    '',
  ].join('\n'));
  assert.equal(read(root), [
    HEADER,
    'a.md\tlive\te\tkept note',
    'bin/check-x.test.mjs\tinternal\tb\t',
    'new.md\tlive\te\t',
    '',
  ].join('\n'));
  assert.equal(run(root).status, 0);
});

test('--write creates the folder of the file when it does not exist', () => {
  const root = repo({ 'a.md': 'a\n' });
  const result = run(root, ['--write']);
  assert.equal(result.stdout, `wrote ${INV}: 1 rows, 1 added, 0 dropped\n`);
  assert.equal(read(root), `${HEADER}\na.md\tlive\te\t\n`);
});

test('--write keeps the first of duplicated rows and prints the second as dropped', () => {
  const root = repo({ 'a.md': 'a\n' });
  inventory(root, [HEADER, 'a.md\tlive\te\tfirst', 'a.md\tlive\te\tsecond']);
  const result = run(root, ['--write']);
  assert.equal(result.stdout, [
    'dropped a.md (duplicate row, verdict: second)',
    `wrote ${INV}: 1 rows, 0 added, 1 dropped`,
    '',
  ].join('\n'));
  assert.equal(read(root), `${HEADER}\na.md\tlive\te\tfirst\n`);
});

test('an unknown argument exits 2 with its line on stderr and the usage', () => {
  const root = repo({});
  const result = run(root, ['--bogus']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^unknown argument: --bogus\nusage: node scripts\/inventory\.mjs /);
});

const CLASS_CASES = [
  ['odd/tasks/x.md', 'history', '-'],
  ['docs/sessions/s.md', 'history', '-'],
  ['docs/origin.md', 'history', '-'],
  ['docs/sweep-2026-10-11.md', 'history', '-'],
  ['docs/model-effort.md', 'history', '-'],
  ['docs/research/r.md', 'history', '-'],
  ['evals/proofs/p.md', 'history', '-'],
  ['docs/RULES.md', 'generated', '-'],
  ['evals/results/r.json', 'generated', '-'],
  ['evals/tasks/t/task.json', 'fixture', '-'],
  ['evals/fixtures/f.mjs', 'fixture', '-'],
  ['evals/review/seeded/base/src/a.mjs', 'fixture', '-'],
  ['scripts/fixtures/x.json', 'fixture', '-'],
  ['bin/lib/fixtures/data.json', 'fixture', '-'],
  ['bin/fixtures/x.mjs', 'fixture', '-'],
  ['scripts/inventory.test.mjs', 'internal', 'e'],
  ['scripts/helper.mjs', 'internal', 'e'],
  ['evals/run.mjs', 'internal', 'e'],
  ['.github/workflows/ci.yml', 'internal', 'e'],
  ['bin/check.test.mjs', 'internal', 'b'],
  ['README.md', 'live', 'e'],
  ['AGENTS.md', 'live', 'e'],
  ['docs/ROADMAP.md', 'live', 'e'],
  ['package.json', 'live', 'e'],
  ['.githooks/pre-push', 'live', 'e'],
  ['bin/install.mjs', 'live', 'a'],
];

test('classify gives each path its class by the rules of S4a', () => {
  const files = Object.fromEntries(CLASS_CASES.map(([file]) => [file, 'x\n']));
  const { graph } = world(files);
  for (const [file, cls, area] of CLASS_CASES) {
    assert.deepEqual(classify(file, graph), { class: cls, area }, file);
  }
});

const COMMAND_CASES = [
  ['bin/js-harness.mjs', 'a'],
  ['bin/tui.mjs', 'c'],
  ['bin/windows-daily.mjs', 'd'],
  ['bin/clean.mjs', 'clean'],
  ['bin/backup.test.mjs', 'backup'],
  ['bin/stack-install.test.mjs', 'stack'],
  ['bin/install-session-messages.test.mjs', 'a'],
  ['bin/codex-review.second.test.mjs', 'b'],
  ['bin/lib/codex-review-parts.mjs', 'b'],
  ['bin/lib/check-thing.mjs', 'b'],
  ['bin/readme.test.mjs', 'shared'],
];

test('classify gives a bin/ file the area of the command it is named after, else shared', () => {
  const files = Object.fromEntries(COMMAND_CASES.map(([file]) => [file, '\n']));
  const { graph } = world(files);
  for (const [file, area] of COMMAND_CASES) {
    assert.deepEqual(classify(file, graph), { class: file.includes('.test.') ? 'internal' : 'live', area }, file);
  }
});

test('classify gives a bin/lib module the one area whose entry reaches it, else shared', () => {
  const { graph } = world({
    'bin/install.mjs': [
      "import { x } from './lib/only-a.mjs';",
      "import { y } from './lib/both.mjs';",
      "export { z } from './lib/reexp.mjs';",
      "export const load = () => import('./lib/dyn.mjs');",
      '',
    ].join('\n'),
    'bin/check.mjs': "import { y } from './lib/both.mjs';\n",
    'bin/js-harness.mjs': "export const load = () => import('./lib/only-dispatch.mjs');\n",
    'bin/lib/only-a.mjs': "import './deep.mjs';\n",
    'bin/lib/deep.mjs': '\n',
    'bin/lib/both.mjs': '\n',
    'bin/lib/reexp.mjs': '\n',
    'bin/lib/dyn.mjs': '\n',
    'bin/lib/orphan.mjs': '\n',
    'bin/lib/only-dispatch.mjs': '\n',
    'bin/lib/only-a.test.mjs': '\n',
    'bin/lib/both.test.mjs': '\n',
    'bin/lib/orphan.testkit.mjs': '\n',
    'bin/lib/ghost.test.mjs': '\n',
  });
  const area = (file) => classify(file, graph).area;
  assert.equal(area('bin/lib/only-a.mjs'), 'a', 'imported from one area');
  assert.equal(area('bin/lib/deep.mjs'), 'a', 'imported from that area through another module');
  assert.equal(area('bin/lib/reexp.mjs'), 'a', 're-exported from one area');
  assert.equal(area('bin/lib/dyn.mjs'), 'a', 'imported dynamically from one area');
  assert.equal(area('bin/lib/both.mjs'), 'shared', 'imported from two areas');
  assert.equal(area('bin/lib/orphan.mjs'), 'shared', 'imported from none');
  assert.equal(area('bin/lib/only-dispatch.mjs'), 'shared', 'imported by the dispatcher alone');
  assert.equal(area('bin/lib/only-a.test.mjs'), 'a', 'a test takes the area of its module');
  assert.equal(area('bin/lib/both.test.mjs'), 'shared', 'a test of a shared module is shared');
  assert.equal(area('bin/lib/orphan.testkit.mjs'), 'shared', 'a testkit of an orphan module is shared');
  assert.equal(area('bin/lib/ghost.test.mjs'), 'shared', 'a test without its module is shared');
});

test('a command that imports another command does not make that command library its own', () => {
  const { graph } = world({
    'bin/check.mjs': "import { x } from './lib/only-b.mjs';\n",
    'bin/contract.mjs': "import './check.mjs';\n",
    'bin/lib/only-b.mjs': '\n',
  });
  assert.equal(classify('bin/lib/only-b.mjs', graph).area, 'b');
});

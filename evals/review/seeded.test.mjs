import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reviewIntent } from '../../bin/lib/codex-review-prompt.mjs';
import { DEFAULT_TOLERANCE } from './score.mjs';
import { buildSeededRepo, gitEnv, SEEDED_DIR, SEEDED_KEY_SCHEMA, seededMain, treeFiles } from './seeded.mjs';

// The fixture is built into temporary folders, twice: `first` into a folder that is there and empty,
// `second` into one that is not there yet. Every git here runs with the builder's own environment, so a
// `GIT_DIR` exported by a hook never points it at the repository these tests are part of.
const made = [];
let first;
let second;
before(() => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-seeded-'));
  made.push(parent);
  fs.mkdirSync(path.join(parent, 'first'));
  first = buildSeededRepo(path.join(parent, 'first'));
  second = buildSeededRepo(path.join(parent, 'second', 'repo'));
});
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, env: gitEnv(), encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

const TREES = ['base', 'head'];
const treeDir = (tree) => path.join(SEEDED_DIR, tree);
const readKey = () => JSON.parse(fs.readFileSync(path.join(SEEDED_DIR, 'key.json'), 'utf8'));

/** The files the range changes, each with its additions and deletions, from `git diff --numstat`. */
function numstat({ root, base, head }) {
  return git(root, 'diff', '--numstat', '--no-renames', base, head).trim().split('\n').map((line) => {
    const [added, deleted, file] = line.split('\t');
    return { file, added: Number(added), deleted: Number(deleted) };
  });
}

/** The lines the range adds or changes, as they are numbered in HEAD: a set of line numbers for each
 * file, read off the hunk headers of `git diff -U0`. */
function linesAdded({ root, base, head }) {
  const added = new Map();
  let file = null;
  for (const line of git(root, 'diff', '-U0', '--no-renames', '--no-color', '--no-ext-diff', base, head).split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line === '+++ /dev/null' ? null : line.slice('+++ b/'.length);
      if (file !== null) added.set(file, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || file === null) continue;
    const [start, count] = [Number(hunk[1]), hunk[2] === undefined ? 1 : Number(hunk[2])];
    for (let at = start; at < start + count; at += 1) added.get(file).add(at);
  }
  return added;
}

// --- the repository ---

test('two builds give the same two commits, the ones the key was written for', () => {
  assert.match(first.base, /^[0-9a-f]{40}$/);
  assert.match(first.head, /^[0-9a-f]{40}$/);
  assert.notEqual(first.base, first.head);
  assert.deepEqual([second.base, second.head], [first.base, first.head]);
  // The line numbers of the key are those of one exact tree, and a result names the range it was read
  // on: a fixture that changed, or a checkout that rewrote its line endings, is another range.
  const key = readKey();
  assert.deepEqual([first.base, first.head], [key.base, key.head], 'the fixture changed: read the key against it again, then write the new commit ids into the key');
  assert.equal(first.root, path.resolve(first.root));
  assert.notEqual(first.root, second.root);
});

test('the repository is exactly two commits, base then head, by a fixed author at fixed dates, and checked out at head', () => {
  for (const repo of [first, second]) {
    assert.equal(git(repo.root, 'rev-list', '--count', 'HEAD').trim(), '2');
    assert.equal(git(repo.root, 'rev-parse', 'HEAD').trim(), repo.head);
    assert.equal(git(repo.root, 'rev-parse', 'HEAD~1').trim(), repo.base);
    assert.equal(git(repo.root, 'status', '--porcelain').trim(), '', 'a clean tree, which a review of a committed range asks for');
    assert.equal(git(repo.root, 'config', '--local', 'core.autocrlf').trim(), 'false');
  }
  const people = git(first.root, 'log', '--format=%an <%ae>|%cn <%ce>|%aI|%cI', 'HEAD').trim().split('\n');
  assert.equal(new Set(people.map((line) => line.split('|').slice(0, 2).join('|'))).size, 1, 'one author, who is the committer too');
  assert.deepEqual(people.map((line) => line.split('|')[2]), people.map((line) => line.split('|')[3]), 'committed when authored');
  assert.equal(new Set(people).size, 2, 'the two commits have dates of their own');
  assert.doesNotMatch(git(first.root, 'log', '--format=%an %ae %s %b', 'HEAD'), new RegExp(os.userInfo().username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), 'nothing of this machine is in a commit');
});

test('the files are written byte for byte: the checkout is the head tree, and each commit holds its tree and nothing else', () => {
  for (const tree of TREES) {
    const files = treeFiles(treeDir(tree));
    assert.ok(files.length > 5, `${tree}: ${files.length} files`);
    assert.deepEqual(git(first.root, 'ls-tree', '-r', '--name-only', first[tree]).trim().split('\n').sort(), files, tree);
    for (const file of files) {
      const stored = spawnSync('git', ['cat-file', 'blob', `${first[tree]}:${file}`], { cwd: first.root, env: gitEnv() });
      assert.equal(stored.status, 0, `${tree}:${file}`);
      assert.equal(Buffer.compare(stored.stdout, fs.readFileSync(path.join(treeDir(tree), file))), 0, `${tree}:${file}`);
    }
  }
  for (const file of treeFiles(treeDir('head'))) {
    assert.equal(Buffer.compare(fs.readFileSync(path.join(first.root, file)), fs.readFileSync(path.join(treeDir('head'), file))), 0, file);
  }
  assert.deepEqual(treeFiles(first.root).filter((file) => !file.startsWith('.git/')), treeFiles(treeDir('head')));
});

test('no file of the fixture holds a carriage return: a checkout that rewrote line endings would make other commits', () => {
  for (const tree of TREES) {
    for (const file of treeFiles(treeDir(tree))) assert.equal(fs.readFileSync(path.join(treeDir(tree), file)).includes(0x0d), false, `${tree}/${file}`);
  }
});

test('buildSeededRepo refuses a folder that holds anything, and a path that is not a folder', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-seeded-refused-'));
  made.push(parent);
  fs.writeFileSync(path.join(parent, 'kept.txt'), 'mine', 'utf8');
  assert.throws(() => buildSeededRepo(parent), /empty/);
  assert.throws(() => buildSeededRepo(path.join(parent, 'kept.txt')), /folder/);
  assert.deepEqual(fs.readdirSync(parent), ['kept.txt'], 'and leaves it as it was');
  assert.equal(fs.readFileSync(path.join(parent, 'kept.txt'), 'utf8'), 'mine');
});

test('the command builds into --out and prints the root and the two commit ids as JSON', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-seeded-cli-'));
  made.push(parent);
  const run = (argv) => {
    const out = [];
    const err = [];
    const code = seededMain(argv, { log: (line) => out.push(line), error: (line) => err.push(line) });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  const built = run(['--out', path.join(parent, 'repo')]);
  assert.equal(built.code, 0, built.err);
  assert.deepEqual(JSON.parse(built.out), { root: path.join(parent, 'repo'), base: first.base, head: first.head });
  // A second time into the same folder, which now holds a repository: refused, and said why.
  const again = run(['--out', path.join(parent, 'repo')]);
  assert.equal(again.code, 1);
  assert.match(again.err, /empty/);
  for (const argv of [[], ['--out'], ['--elsewhere', parent]]) {
    const bad = run(argv);
    assert.equal(bad.code, 2, argv.join(' '));
    assert.match(bad.err, /Usage: node evals\/review\/seeded\.mjs --out <dir>/);
  }
});

// --- the change under review ---

test('the range changes between 200 and 400 lines in 4 to 6 files: one part, reviewed whole', () => {
  const files = numstat(first);
  const changed = files.reduce((sum, file) => sum + file.added + file.deleted, 0);
  assert.ok(changed >= 200 && changed <= 400, `${changed} changed lines`);
  assert.ok(files.length >= 4 && files.length <= 6, `${files.length} files: ${files.map((file) => file.file).join(', ')}`);
  assert.equal(files.some((file) => Number.isNaN(file.added)), false, 'no binary file');
});

test('the head tree holds the feature document the review is given, with a Goal and a Done when', () => {
  const docs = treeFiles(treeDir('head')).filter((file) => /^odd\/tasks\/[^/]+\.md$/.test(file));
  assert.equal(docs.length, 1, docs.join(', '));
  const intent = reviewIntent(fs.readFileSync(path.join(first.root, docs[0]), 'utf8'));
  assert.ok(intent.goal.length > 40, intent.goal);
  assert.ok(intent.doneWhen.split('\n').filter((line) => line.startsWith('- ')).length >= 3, intent.doneWhen);
  assert.doesNotMatch(`${intent.goal}\n${intent.doneWhen}`, /\[Cut here/, 'the whole of both sections fits in the prompt');
});

// --- the key ---

const KINDS = ['off-by-one', 'missing-await', 'wrong-condition', 'unvalidated-path', 'lost-update', 'swallowed-error', 'contradicts-intent'];

test('the key names seven defects, each of a kind of its own', () => {
  const key = readKey();
  assert.equal(key.schema, SEEDED_KEY_SCHEMA);
  assert.equal(key.defects.length, 7);
  assert.equal(new Set(key.defects.map((defect) => defect.id)).size, 7, 'distinct ids');
  assert.deepEqual(key.defects.map((defect) => defect.kind).sort(), [...KINDS].sort());
  for (const defect of key.defects) {
    assert.deepEqual(Object.keys(defect), ['id', 'kind', 'file', 'start', 'end', 'summary'], defect.id);
    assert.ok(typeof defect.summary === 'string' && defect.summary.length > 20, defect.id);
  }
});

test('every defect of the key is on lines the range adds or changes, in a file of the range', () => {
  const added = linesAdded(first);
  const inRange = numstat(first).map((file) => file.file);
  for (const { id, file, start, end } of readKey().defects) {
    assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 1 && start <= end, `${id}: ${start}-${end}`);
    assert.ok(inRange.includes(file), `${id}: ${file} is not a file of the range (${inRange.join(', ')})`);
    assert.equal(file.includes('\\'), false, `${id}: the file is named with forward slashes`);
    for (let line = start; line <= end; line += 1) assert.ok(added.get(file).has(line), `${id}: ${file}:${line} is not a line the range adds or changes`);
    assert.ok(end <= fs.readFileSync(path.join(first.root, file), 'utf8').split('\n').length, `${id}: past the end of ${file}`);
  }
});

test('no two defects are so close that one finding could be within the tolerance of both by its lines alone', () => {
  const { defects } = readKey();
  for (const [at, one] of defects.entries()) {
    for (const other of defects.slice(at + 1)) {
      if (one.file !== other.file) continue;
      const [earlier, later] = one.start <= other.start ? [one, other] : [other, one];
      assert.ok(later.start - earlier.end > 2 * DEFAULT_TOLERANCE, `${earlier.id} (${earlier.start}-${earlier.end}) and ${later.id} (${later.start}-${later.end}) in ${one.file}`);
    }
  }
});

test('the key is not in the built repository, by name or by content', () => {
  const key = fs.readFileSync(path.join(SEEDED_DIR, 'key.json'), 'utf8');
  for (const repo of [first, second]) {
    const files = treeFiles(repo.root);
    assert.equal(files.some((file) => /key\.json$/i.test(file)), false);
    for (const commit of [repo.base, repo.head]) assert.doesNotMatch(git(repo.root, 'ls-tree', '-r', '--name-only', commit), /key\.json/i);
    for (const file of files.filter((name) => !name.startsWith('.git/'))) {
      const text = fs.readFileSync(path.join(repo.root, file), 'utf8');
      assert.equal(text.includes(SEEDED_KEY_SCHEMA), false, file);
      assert.equal(text.includes(key.trim()), false, file);
    }
  }
  // Nor beside the two trees in a place a tree is copied from.
  for (const tree of TREES) assert.equal(treeFiles(treeDir(tree)).some((file) => /key\.json$/i.test(file)), false, tree);
});

// What would tell a reviewer that something was put there to be found, or where: in any case, at the
// start of a word, in the content or the name of any file of either tree.
const HINTS = [
  'bug', 'todo', 'fixme', 'xxx', 'hack', 'seed', 'planted', 'defect', 'intentional', 'deliberate', 'on purpose', 'hint', 'wrong', 'broken',
  'mistake', 'flaw', 'vulnerab', 'traversal', 'injection', 'off-by-one', 'off by one', 'lost update', 'race', 'swallow', 'answer key', 'key.json',
  'do not fix', 'left as is', 'known issue', 'review fixture', 'eval',
];

test('no file of either tree says that anything in it was put there to be found', () => {
  const patterns = HINTS.map((word) => [word, new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')]);
  for (const tree of TREES) {
    for (const file of treeFiles(treeDir(tree))) {
      const text = `${file}\n${fs.readFileSync(path.join(treeDir(tree), file), 'utf8')}`;
      for (const [word, pattern] of patterns) assert.doesNotMatch(text, pattern, `${tree}/${file} holds "${word}"`);
    }
  }
  for (const subject of git(first.root, 'log', '--format=%s%n%b', 'HEAD').split('\n')) {
    for (const [word, pattern] of patterns) assert.doesNotMatch(subject, pattern, `a commit message holds "${word}"`);
  }
});

// --- the fixture's own specs ---

/** Runs the specs of `tree` with `node --test` inside the repository at `root`, checked out at that tree,
 * and gives how many passed and failed. */
function runSpecs(root, tree) {
  const specs = treeFiles(treeDir(tree)).filter((file) => /^tests\/.*\.spec\.mjs$/.test(file));
  assert.ok(specs.length > 0, `${tree} has no spec`);
  // Without the variable `node --test` sets for the files it runs, or this runner would act as one of them.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toUpperCase() !== 'NODE_TEST_CONTEXT'));
  const ran = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...specs], { cwd: root, env, encoding: 'utf8', timeout: 120000 });
  const count = (what) => Number(new RegExp(`^# ${what} (\\d+)$`, 'm').exec(ran.stdout ?? '')?.[1] ?? Number.NaN);
  return { status: ran.status, pass: count('pass'), fail: count('fail'), output: `${ran.stdout}\n${ran.stderr}` };
}

test('the specs of the fixture pass in both trees, so no spec points at a defect by failing', { timeout: 5 * 60 * 1000 }, () => {
  const head = runSpecs(first.root, 'head');
  assert.deepEqual([head.status, head.fail], [0, 0], head.output);
  assert.ok(head.pass >= 10, head.output);
  // The base tree, in the second repository, which is put back at head whatever the specs came to.
  git(second.root, 'checkout', '--quiet', '--detach', second.base);
  try {
    assert.deepEqual(treeFiles(second.root).filter((file) => !file.startsWith('.git/')), treeFiles(treeDir('base')));
    const base = runSpecs(second.root, 'base');
    assert.deepEqual([base.status, base.fail], [0, 0], base.output);
    assert.ok(base.pass >= 5 && base.pass < head.pass, base.output);
  } finally {
    git(second.root, 'checkout', '--quiet', 'main');
  }
});

test('no file of the fixture is one the test runner of this repository would run', () => {
  // `node --test` takes these names anywhere below the folder it is run in; the fixture's specs are `*.spec.mjs` in `tests/`.
  const taken = /(^|\/)(test\/.*|[^/]*[.\-_]test|test-[^/]*|test)\.[cm]?js$/;
  for (const tree of TREES) assert.deepEqual(treeFiles(treeDir(tree)).filter((file) => taken.test(file)), [], tree);
});

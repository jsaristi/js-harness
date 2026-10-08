import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DOCUMENT, isDocument, leftOutOf, leftOutSaid, MARKED, patchOfRead, REVIEW_ATTRIBUTE, reviewScope, unsetPaths } from './codex-review-scope.mjs';

// --- a document ---

test('a document is a Markdown file, in any letter case and in any folder', () => {
  for (const file of ['README.md', 'docs/notes.md', 'README.MD', 'a/b/c.Md', 'my notes.md', '.md']) assert.equal(isDocument(file), true, file);
  for (const file of ['a.js', 'a.mdx', 'a.md.txt', 'md', 'docs/md/a.json', 'a.md/b.js', 'a.md ']) assert.equal(isDocument(file), false, file);
});

// --- what git answers ---

/** What `git check-attr --stdin -z codex-review` prints for `answers`, each `[path, info]`. */
const attrOutput = (...answers) => answers.map(([file, info]) => `${file}\0${REVIEW_ATTRIBUTE}\0${info}\0`).join('');

test('the attribute is `codex-review`, and a path is marked when the project unsets it', () => {
  assert.equal(REVIEW_ATTRIBUTE, 'codex-review');
  const output = attrOutput(['evals/results/a.json', 'unset'], ['bin/a.mjs', 'unspecified'], ['bin/b.mjs', 'set'], ['bin/c.mjs', 'false'], ['a b/é.json', 'unset']);
  assert.deepEqual([...unsetPaths(output)], ['evals/results/a.json', 'a b/é.json']);
  assert.deepEqual([...unsetPaths('')], []);
});

test('an answer that is not whole records of that attribute is refused, never read as far as it goes', () => {
  const whole = attrOutput(['a.json', 'unset']);
  for (const bad of [whole.slice(0, -1), `${whole}b.json\0`, 'a.json\0text\0unset\0', 'a.json: codex-review: unset\n', 7, null, undefined]) {
    assert.throws(() => unsetPaths(bad), /git check-attr/, JSON.stringify(bad));
  }
});

/** A `spawn` that answers every process with `answer(args, opts)` and keeps each call. */
function fakeGit(answer) {
  const calls = [];
  const spawn = (command, args, opts) => {
    calls.push({ command, args, opts });
    return answer(args, opts);
  };
  return { spawn, calls };
}

const SOURCE = 'a'.repeat(40);

test('what is left out of some paths: the documents, and the paths git says are marked, each with why', () => {
  const git = fakeGit(() => ({ status: 0, stdout: attrOutput(['bin/a.mjs', 'unspecified'], ['evals/results/a.json', 'unset'], ['bin/kept.gen.mjs', 'set']) }));
  const left = leftOutOf(['README.md', 'bin/a.mjs', 'evals/results/a.json', 'bin/kept.gen.mjs', 'evals/results/report.md'], { cwd: '/repo', source: SOURCE, spawn: git.spawn });
  assert.deepEqual([...left], [['README.md', DOCUMENT], ['evals/results/report.md', DOCUMENT], ['evals/results/a.json', MARKED]]);
  // One process for all of them, asked of the commit, with the paths on stdin: no count of paths makes a
  // command line too long, and a document is not asked about at all.
  assert.equal(git.calls.length, 1);
  const [{ command, args, opts }] = git.calls;
  assert.equal(command, 'git');
  assert.deepEqual(args, ['check-attr', '--source', SOURCE, '--stdin', '-z', 'codex-review']);
  assert.equal(opts.cwd, '/repo');
  assert.equal(opts.input, 'bin/a.mjs\0evals/results/a.json\0bin/kept.gen.mjs\0');
  assert.equal(opts.encoding, 'utf8');
});

test('a path given twice is asked about once, and paths that are all documents start no process', () => {
  const git = fakeGit(() => ({ status: 0, stdout: attrOutput(['a.js', 'unset']) }));
  assert.deepEqual([...leftOutOf(['a.js', 'x.md', 'a.js'], { cwd: '/repo', source: SOURCE, spawn: git.spawn })], [['x.md', DOCUMENT], ['a.js', MARKED]]);
  assert.equal(git.calls[0].opts.input, 'a.js\0');
  const none = fakeGit(() => {
    throw new Error('no process is started');
  });
  assert.deepEqual([...leftOutOf(['x.md', 'docs/y.MD'], { cwd: '/repo', source: SOURCE, spawn: none.spawn })], [['x.md', DOCUMENT], ['docs/y.MD', DOCUMENT]]);
  assert.deepEqual([...leftOutOf([], { cwd: '/repo', source: SOURCE, spawn: none.spawn })], []);
  assert.equal(none.calls.length, 0);
});

test('when git cannot say what is marked the answer is `null`, never that nothing is', () => {
  const failures = {
    'git exits with an error (an old git has no --source)': () => ({ status: 129, stdout: '', stderr: 'error: unknown option `source\'' }),
    'git cannot be started': () => ({ error: new Error('spawn git ENOENT') }),
    'the spawn throws': () => {
      throw new Error('spawn git EACCES');
    },
    'no result': () => undefined,
    'an answer that is cut': () => ({ status: 0, stdout: 'a.js\0codex-review\0' }),
    'an answer for fewer paths than were asked': () => ({ status: 0, stdout: attrOutput(['a.js', 'unset']) }),
    'an answer that is not text': () => ({ status: 0, stdout: 7 }),
  };
  for (const [which, answer] of Object.entries(failures)) {
    assert.equal(leftOutOf(['a.js', 'b.js', 'x.md'], { cwd: '/repo', source: SOURCE, spawn: fakeGit(answer).spawn }), null, which);
  }
});

// --- real git: which attributes are read ---

let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-review-scope-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

/** Writes `files` (`{ <path>: <content> }`) into `root`, commits them all and returns the commit's full id. */
function commit(root, files, message) {
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content, 'utf8');
  }
  git(root, 'add', '.');
  git(root, 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-review-scope-'));
  made.push(root);
  git(root, 'init');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  return root;
}

test('git is asked as the project wrote it: a pattern, a folder\'s own .gitattributes, a path that is gone, and a mark taken back', () => {
  const root = makeRepo();
  const head = commit(root, {
    '.gitattributes': 'evals/results/** -codex-review\n*.snap -codex-review\nsrc/kept.snap codex-review\nsrc/again.snap !codex-review\n',
    'fixtures/.gitattributes': '* -codex-review\n',
    'src/a.js': 'code\n',
  }, 'marks');
  const paths = [
    'evals/results/a.json', 'evals/results/deep/er/b.json', 'evals/a.json', 'src/a.js', 'src/a.snap', 'src/kept.snap', 'src/again.snap',
    'fixtures/seeded/src/cli.mjs', 'evals/results/once was here.json', 'evals/results/café “quoted”.json', 'fixtures/notes.md',
  ];
  assert.deepEqual([...leftOutOf(paths, { cwd: root, source: head })], [
    ['fixtures/notes.md', DOCUMENT],
    ['evals/results/a.json', MARKED],
    ['evals/results/deep/er/b.json', MARKED],
    ['src/a.snap', MARKED],
    ['fixtures/seeded/src/cli.mjs', MARKED],
    ['evals/results/once was here.json', MARKED],
    ['evals/results/café “quoted”.json', MARKED],
  ]);
});

test('the attributes are those of the commit that is named: not what the working tree or the index holds, and not those of another commit', () => {
  const root = makeRepo();
  const before = commit(root, { 'a.js': 'code\n', 'data/a.json': '{}\n' }, 'no marks yet');
  const marked = commit(root, { '.gitattributes': 'data/** -codex-review\n' }, 'the project marks its data');
  const paths = ['a.js', 'data/a.json'];
  assert.deepEqual([...leftOutOf(paths, { cwd: root, source: before })], []);
  assert.deepEqual([...leftOutOf(paths, { cwd: root, source: marked })], [['data/a.json', MARKED]]);
  // A change nobody committed, in the tree and then in the index too, says nothing of a commit.
  fs.writeFileSync(path.join(root, '.gitattributes'), '* -codex-review\n', 'utf8');
  assert.deepEqual([...leftOutOf(paths, { cwd: root, source: marked })], [['data/a.json', MARKED]]);
  git(root, 'add', '.gitattributes');
  assert.deepEqual([...leftOutOf(paths, { cwd: root, source: marked })], [['data/a.json', MARKED]]);
  assert.deepEqual([...leftOutOf(paths, { cwd: root, source: before })], []);
  // A name that is no revision of this repository is one git cannot answer for.
  assert.equal(leftOutOf(paths, { cwd: root, source: 'no-such-revision' }), null);
});

// --- the files of a range, by what a review does with them ---

const file = (name, changedLines, binary = false) => ({ path: name, changedLines, binary });

test('the files of a range are split into what a review reads and what it leaves out, which is counted by why', () => {
  const files = [file('README.md', 30), file('bin/a.mjs', 12), file('evals/results/a.json', 400), file('evals/results/b.png', 0, true), file('docs/b.md', 5), file('bin/b.mjs', 3)];
  const why = new Map([['README.md', DOCUMENT], ['docs/b.md', DOCUMENT], ['evals/results/a.json', MARKED], ['evals/results/b.png', MARKED]]);
  const scope = reviewScope(files, why);
  assert.deepEqual(scope.read, [file('bin/a.mjs', 12), file('bin/b.mjs', 3)]);
  assert.deepEqual(scope.left, ['README.md', 'evals/results/a.json', 'evals/results/b.png', 'docs/b.md']);
  assert.deepEqual(scope.leftOut, { files: 4, changedLines: 435, documents: { files: 2, changedLines: 35 }, marked: { files: 2, changedLines: 400 } });
  // Nothing left out: every file is read, in the order it was given.
  const all = reviewScope(files, new Map());
  assert.deepEqual(all.read, files);
  assert.deepEqual(all.left, []);
  assert.deepEqual(all.leftOut, { files: 0, changedLines: 0, documents: { files: 0, changedLines: 0 }, marked: { files: 0, changedLines: 0 } });
  assert.deepEqual(reviewScope([], why).leftOut.files, 0);
});

test('what was left out is said with how many files and changed lines, and why', () => {
  const counts = (documents, marked) => ({
    files: documents[0] + marked[0],
    changedLines: documents[1] + marked[1],
    documents: { files: documents[0], changedLines: documents[1] },
    marked: { files: marked[0], changedLines: marked[1] },
  });
  assert.equal(leftOutSaid(counts([3, 1300], [0, 0])), '3 Markdown documents, 1,300 changed lines');
  assert.equal(leftOutSaid(counts([1, 1], [0, 0])), '1 Markdown document, 1 changed line');
  assert.equal(leftOutSaid(counts([0, 0], [2, 120])), '2 files the project marks `-codex-review`, 120 changed lines');
  assert.equal(leftOutSaid(counts([0, 0], [1, 0])), '1 file the project marks `-codex-review`, 0 changed lines');
  assert.equal(
    leftOutSaid(counts([3, 300], [2, 1120])),
    '5 files, 1,420 changed lines (3 Markdown documents, 300 changed lines; 2 files the project marks `-codex-review`, 1,120 changed lines)',
  );
  assert.equal(leftOutSaid(counts([0, 0], [0, 0])), 'nothing');
});

// --- the patch of a range, without what a review leaves out ---

/** The section of `name` in a patch, as `git diff` writes one, with `header` in place of its first line. */
const section = (name, change, header = `diff --git a/${name} b/${name}`) => `${header}\nindex 1..2 100644\n--- a/${name}\n+++ b/${name}\n@@ -1 +1 @@\n-${change} one\n+${change} two\n`;

test('the patch a review must have seen is the patch of the range without the sections of the files left out, told apart by their place', () => {
  // git writes the sections in the order it counts the files in, so a section is of the file in its place:
  // the name in its header is quoted when it holds a character outside ASCII, and is not read at all.
  const quoted = 'diff --git "a/docs/caf\\303\\251.md" "b/docs/caf\\303\\251.md"';
  const paths = ['bin/a.mjs', 'docs/café.md', 'evals/results/a.json', 'src/b.mjs'];
  const sections = [section('bin/a.mjs', 'a'), section('docs/caf.md', 'doc', quoted), section('evals/results/a.json', 'data'), section('src/b.mjs', 'b')];
  const why = new Map([['docs/café.md', DOCUMENT], ['evals/results/a.json', MARKED]]);
  assert.equal(patchOfRead(sections.join(''), paths, why), sections[0] + sections[3]);
  // Nothing left out, and nothing changed: the patch as it was.
  assert.equal(patchOfRead(sections.join(''), paths, new Map()), sections.join(''));
  assert.equal(patchOfRead('', [], why), '');
  // Every file left out: nothing to have seen.
  assert.equal(patchOfRead(sections[1] + sections[2], [paths[1], paths[2]], why), '');
});

test('a file whose type changed is two sections under one header, and both are of that one file', () => {
  const gone = 'diff --git a/data/link b/data/link\ndeleted file mode 100644\n--- a/data/link\n+++ /dev/null\n@@ -1 +0,0 @@\n-text\n';
  const back = 'diff --git a/data/link b/data/link\nnew file mode 120000\n--- /dev/null\n+++ b/data/link\n@@ -0,0 +1 @@\n+target\n';
  const patch = section('bin/a.mjs', 'a') + gone + back + section('src/b.mjs', 'b');
  const paths = ['bin/a.mjs', 'data/link', 'src/b.mjs'];
  assert.equal(patchOfRead(patch, paths, new Map([['data/link', MARKED]])), section('bin/a.mjs', 'a') + section('src/b.mjs', 'b'));
  assert.equal(patchOfRead(patch, paths, new Map([['bin/a.mjs', MARKED]])), gone + back + section('src/b.mjs', 'b'));
});

test('a patch that is not one section a file is refused: a section taken for another file\'s would be lines nobody has to have seen', () => {
  const why = new Map([['b.js', MARKED]]);
  const patch = section('a.js', 'a') + section('b.js', 'b');
  assert.throws(() => patchOfRead(patch, ['a.js', 'b.js', 'c.js'], why), /2 sections .* 3 files/);
  assert.throws(() => patchOfRead(patch, ['b.js'], why), /2 sections .* 1 file\b/);
  assert.throws(() => patchOfRead(`not a patch\n${patch}`, ['a.js', 'b.js'], why), /before its first section/);
});

// The control of `rule:depth-pass` (odd/tasks/depth-pass-rule.md, T5): the form of a feature document's `## Depth
// pass` and the order of its commits, read in throwaway repositories. PR 737's document is replayed as it stood at
// 41f774d8, where it came in with its first code and held no pass: the control refuses it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { depthPassText } from './depth-pass.mjs';
import { checkContracts } from '../check.mjs';
import { depthPassFor } from '../contract.mjs';
import { contractMain } from '../contract.mjs';

let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-depth-pass-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_AUTHOR_DATE = '2026-11-02T00:00:00Z';
  process.env.GIT_COMMITTER_DATE = '2026-11-02T00:00:00Z';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

const CONTRACT = `## Goal
Turn a forecast said as a fact back at the stop.

## Why
A forecast reads as a measure.

## Done when
- \`node --test\` exits 0

## In scope / Out of scope
- In: the guard.

## Constraints
- None.

## Ask me before
Spend.
`;

const SPECS = `## Specs
1. "the first thing he asked"
2. "the second thing he asked"
`;

const PASS = `## Depth pass
- 1. Method: a process engineer's, the incidents first.
- 2. Raw material: \`bin/a.mjs:1\` and his words, the lead's transcript \`0f71b2c6\`, line 42804.
- 3. The bar:
  spec 1: \`node --test bin/a.test.mjs\`: 0 of 3, none, new behaviour
  spec 2: left out because he dropped it (L4)
- 4. Refutation: \`grep -c forecast bin/a.mjs\`: 2 of 6 cases caught.
  Verdict: supports
- 5. Request: "turn a forecast back at the stop", beside his words in L1.
  Adds: none
`;

const document = (pass = PASS) => `${CONTRACT}\n${pass}\n${SPECS}`;
const FILE = 'odd/tasks/feature.md';

test('a pass in the rule\'s order, citing its material, with a bar per spec, a verdict and its Adds, passes', () => {
  assert.deepEqual(depthPassText(document(), FILE), []);
});

test('PR 737\'s document as it stood at 41f774d8, its contract and its Specs and no pass, is refused', () => {
  assert.deepEqual(depthPassText(`${CONTRACT}\n${SPECS}`, FILE), ['no "## Depth pass": large work holds one before its first code commit (js-harness-protocols section 9)']);
});

test('items out of order, or missing, are named', () => {
  const swapped = PASS.replace('- 1. Method', '- 9. Moved').replace('- 5. Request', '- 1. Method: late.\n- 5. Request');
  assert.match(depthPassText(document(swapped), FILE).join('\n'), /items 1\. Method to 5\. Request in that order/);
});

test('raw material that cites nothing, or only this document, is refused', () => {
  const own = PASS.replace(/- 2\. Raw material:.*\n/, `- 2. Raw material: \`${FILE}:3\` and his summary.\n`);
  assert.deepEqual(depthPassText(document(own), FILE), ['item 2, Raw material, cites no `path:line`, commit, URL or transcript line outside this document']);
});

test('a numbered spec with no line in the bar is named', () => {
  const short = PASS.replace(/  spec 2: .*\n/, '');
  assert.deepEqual(depthPassText(document(short), FILE), ['item 3, The bar, has no line for spec 2: `spec 2:`, its command in a code span, `:` and its result, or `spec 2: left out because <reason>`']);
});

test('a refutation with no command or no verdict is refused', () => {
  const bare = PASS.replace(/- 4\. Refutation:.*\n  Verdict: supports\n/, '- 4. Refutation: I thought about it.\n');
  assert.deepEqual(depthPassText(document(bare), FILE), [
    'item 4, Refutation, runs no command: name it in a code span with its result',
    'item 4, Refutation, gives no `Verdict: supports` or `Verdict: refutes`',
  ]);
});

test('a fenced example inside the pass is not read as its items', () => {
  const fenced = PASS.replace('- 1. Method: a process engineer\'s, the incidents first.\n', '- 1. Method: a process engineer\'s, as in\n  ```\n  - 1. Method: an example\n  ```\n');
  assert.deepEqual(depthPassText(document(fenced), FILE), []);
});

test('the request ends with what it adds: none, or what and the question that asked for it', () => {
  assert.deepEqual(depthPassText(document(PASS.replace('  Adds: none\n', '')), FILE), ['item 5, Request, does not end with `Adds: none` or `Adds: <what> (question <n>)`']);
  assert.deepEqual(depthPassText(document(PASS.replace('Adds: none', 'Adds: a hook (question 12)')), FILE), []);
  assert.equal(depthPassText(document(PASS.replace('Adds: none', 'Adds: a hook')), FILE).length, 1);
});

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/** A repository whose `harness.json` declares `since` (or nothing), with one code file committed and the trunk,
 * `origin/main`, at that commit, so what follows is the feature's branch. With `sub`, the project is that folder. */
function repo(since = '2026-11-01', sub = '') {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-depth-pass-'));
  const root = path.join(top, sub);
  git(top, 'init', '-q');
  git(top, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(top, 'config', 'user.name', 'js-harness test');
  fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify(since ? { depthPassSince: since } : {}));
  fs.writeFileSync(path.join(root, 'bin', 'a.mjs'), 'one\n');
  fs.mkdirSync(path.join(root, 'odd', 'tasks'), { recursive: true });
  git(top, 'add', '.');
  git(top, 'commit', '-q', '-m', 'init');
  git(top, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return root;
}

const write = (root, file, text) => fs.writeFileSync(path.join(root, file), text);
const commit = (root, message, ...files) => {
  git(root, 'add', ...files);
  git(root, 'commit', '-q', '-m', message);
};
const errorsOf = (root, markdown = fs.readFileSync(path.join(root, FILE), 'utf8'), file = FILE) => depthPassFor(root)(file, markdown);

test('the control holds only where harness.json declares depthPassSince, and only for a document opened since', (t) => {
  const none = repo(null);
  const later = repo('2026-11-03');
  t.after(() => [none, later].forEach((root) => fs.rmSync(root, { recursive: true, force: true })));
  for (const root of [none, later]) {
    write(root, FILE, `${CONTRACT}\n${SPECS}`);
    commit(root, 'docs: open', FILE);
    assert.deepEqual(errorsOf(root), []);
  }
});

test('a shallow clone, whose history cannot say when a document opened, holds no document', (t) => {
  const root = repo();
  const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-depth-pass-shallow-'));
  t.after(() => [root, shallow].forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
  write(root, FILE, `${CONTRACT}\n${SPECS}`);
  commit(root, 'docs: open', FILE);
  git(root, 'commit', '-q', '--allow-empty', '-m', 'later');
  git(shallow, 'clone', '-q', '--depth', '1', `file://${root.split(path.sep).join('/')}`, '.');
  assert.deepEqual(depthPassFor(shallow)(FILE, `${CONTRACT}\n${SPECS}`), []);
  assert.equal(depthPassFor(root)(FILE, `${CONTRACT}\n${SPECS}`).length, 1);
});

test('PR 737\'s order, its document and its first code in one commit, is refused', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, document());
  write(root, 'bin/a.mjs', 'two\n');
  commit(root, 'feat: all at once', FILE, 'bin/a.mjs');
  assert.deepEqual(errorsOf(root), ['the commit that brings the verdict holds more than documents: bin/a.mjs; the pass is committed with documents alone, before the code']);
});

test('a pass committed with documents alone, then the code, passes', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, document());
  commit(root, 'docs: the pass', FILE);
  write(root, 'bin/a.mjs', 'two\n');
  commit(root, 'feat: the code', 'bin/a.mjs');
  assert.deepEqual(errorsOf(root), []);
});

test('code committed after the document opened and before its verdict is refused', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, `${CONTRACT}\n${SPECS}`);
  commit(root, 'docs: open', FILE);
  write(root, 'bin/a.mjs', 'two\n');
  commit(root, 'feat: early code', 'bin/a.mjs');
  write(root, FILE, document());
  commit(root, 'docs: the pass', FILE);
  assert.deepEqual(errorsOf(root), ['code was committed before the pass\'s verdict: bin/a.mjs']);
});

test('a verdict not yet committed, with code staged, is refused before the commit', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, `${CONTRACT}\n${SPECS}`);
  commit(root, 'docs: open', FILE);
  write(root, FILE, document());
  write(root, 'bin/a.mjs', 'two\n');
  git(root, 'add', FILE, 'bin/a.mjs');
  assert.deepEqual(errorsOf(root), ['code is staged before the pass\'s verdict is committed: bin/a.mjs; commit the pass with documents alone first']);
});

test('a refuting verdict with code on the branch needs the answer that let it go on', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, document(PASS.replace('Verdict: supports', 'Verdict: refutes')));
  commit(root, 'docs: the pass', FILE);
  write(root, 'bin/a.mjs', 'two\n');
  commit(root, 'feat: the code', 'bin/a.mjs');
  assert.deepEqual(errorsOf(root), ['the verdict refutes and code is on the branch with no `answered: question <n>` in the pass']);
  write(root, FILE, document(PASS.replace('Verdict: supports', 'Verdict: refutes\n  answered: question 7')));
  assert.deepEqual(errorsOf(root), []);
});

test('code committed on the branch before the document opened is refused too', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'bin/a.mjs', 'two\n');
  commit(root, 'feat: code first', 'bin/a.mjs');
  write(root, FILE, document());
  commit(root, 'docs: the pass', FILE);
  assert.deepEqual(errorsOf(root), ['code was committed before the pass\'s verdict: bin/a.mjs']);
});

test('a verdict written outside the pass does not count as the pass\'s', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, `${CONTRACT}\n## Log\n- L1: the old rule said "Verdict: supports" in an example.\n\n${SPECS}`);
  commit(root, 'docs: open', FILE);
  write(root, 'bin/a.mjs', 'two\n');
  commit(root, 'feat: early code', 'bin/a.mjs');
  write(root, FILE, document());
  commit(root, 'docs: the pass', FILE);
  assert.deepEqual(errorsOf(root), ['code was committed before the pass\'s verdict: bin/a.mjs']);
});

test('once on the trunk, the order is not judged again: a squash, or a refuted plan and later code', (t) => {
  const squash = repo();
  const refuted = repo();
  t.after(() => [squash, refuted].forEach((root) => fs.rmSync(root, { recursive: true, force: true })));
  write(squash, FILE, document());
  write(squash, 'bin/a.mjs', 'two\n');
  commit(squash, 'feat: squashed (#1)', FILE, 'bin/a.mjs');
  git(squash, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  assert.deepEqual(errorsOf(squash), []);
  write(refuted, FILE, document(PASS.replace('Verdict: supports', 'Verdict: refutes')));
  commit(refuted, 'docs: a plan the material refuted', FILE);
  git(refuted, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  write(refuted, 'bin/a.mjs', 'two\n');
  commit(refuted, 'feat: another feature', 'bin/a.mjs');
  assert.deepEqual(errorsOf(refuted), []);
});

test('a renamed document keeps the day it opened', (t) => {
  const root = repo('2026-11-03');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, `${CONTRACT}\n${SPECS}`);
  commit(root, 'docs: open', FILE);
  git(root, 'mv', FILE, 'odd/tasks/renamed.md');
  git(root, 'commit', '-q', '-m', 'docs: rename');
  assert.deepEqual(depthPassFor(root, { today: '2026-11-05' })('odd/tasks/renamed.md', `${CONTRACT}\n${SPECS}`), []);
});

test('a pass renamed on its branch after its code keeps the commit that brought its verdict', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, document());
  commit(root, 'docs: the pass', FILE);
  write(root, 'bin/a.mjs', 'two\n');
  commit(root, 'feat: the code', 'bin/a.mjs');
  git(root, 'mv', FILE, 'odd/tasks/renamed.md');
  git(root, 'commit', '-q', '-m', 'docs: rename');
  assert.deepEqual(errorsOf(root, document(), 'odd/tasks/renamed.md'), []);
});

test('a document whose verdict is on the trunk is not judged again when a branch edits it beside code', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, document());
  commit(root, 'docs: the pass', FILE);
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  write(root, FILE, `${document()}\n## Log\n- L9: a later note.\n`);
  write(root, 'bin/a.mjs', 'two\n');
  commit(root, 'feat: more code and a note', FILE, 'bin/a.mjs');
  assert.deepEqual(errorsOf(root), []);
});

test('a project in a folder of its repository reads its documents\' days at their project paths', (t) => {
  const root = repo('2026-11-03', 'project');
  t.after(() => fs.rmSync(path.dirname(root), { recursive: true, force: true }));
  write(root, FILE, `${CONTRACT}\n${SPECS}`);
  commit(root, 'docs: open', FILE);
  assert.deepEqual(depthPassFor(root, { today: '2026-11-05' })(FILE, `${CONTRACT}\n${SPECS}`), []);
});

test('contract check holds a file named on its command line to the control at its repository path', async (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, `${CONTRACT}\n${SPECS}`);
  commit(root, 'docs: open', FILE);
  const out = [];
  const code = await contractMain(['check', 'feature.md', '--cwd', path.join(root, 'odd', 'tasks')], {}, { stdout: (line) => out.push(line), stderr: () => {} });
  assert.equal(code, 1);
  assert.deepEqual(out, ['FAIL  feature.md', `      ${depthPassText(CONTRACT, FILE)[0]}`]);
});

test('the contracts row of check carries the control', (t) => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, FILE, `${CONTRACT}\n${SPECS}`);
  commit(root, 'docs: open', FILE);
  const row = checkContracts(root);
  assert.equal(row.pass, false);
  assert.deepEqual(row.lines, [FILE, '  no "## Depth pass": large work holds one before its first code commit (js-harness-protocols section 9)']);
});

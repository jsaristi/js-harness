// The control of `rule:depth-pass` (odd/tasks/depth-pass-rule.md, T5): the form of a feature document's `## Depth
// pass` and the order of its commits, read in throwaway repositories. PR 737's document is replayed as it stood at
// 41f774d8, where it came in with its first code and held no pass: the control refuses it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { depthPassErrors, depthPassText } from './depth-pass.mjs';
import { checkContracts } from '../check.mjs';
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
  assert.deepEqual(depthPassText(document(short), FILE), ['item 3, The bar, has no line for spec 2: `spec 2: <command>: <result>` or `spec 2: left out because <reason>`']);
});

test('a refutation with no command or no verdict is refused', () => {
  const bare = PASS.replace(/- 4\. Refutation:.*\n  Verdict: supports\n/, '- 4. Refutation: I thought about it.\n');
  assert.deepEqual(depthPassText(document(bare), FILE), [
    'item 4, Refutation, runs no command: name it in a code span with its result',
    'item 4, Refutation, gives no `Verdict: supports` or `Verdict: refutes`',
  ]);
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

/** A repository whose `harness.json` declares `since` (or nothing), with one code file committed. */
function repo(since = '2026-11-01') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-depth-pass-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify(since ? { depthPassSince: since } : {}));
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, 'bin', 'a.mjs'), 'one\n');
  fs.mkdirSync(path.join(root, 'odd', 'tasks'), { recursive: true });
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

const write = (root, file, text) => fs.writeFileSync(path.join(root, file), text);
const commit = (root, message, ...files) => {
  git(root, 'add', ...files);
  git(root, 'commit', '-q', '-m', message);
};
const errorsOf = (root, markdown = fs.readFileSync(path.join(root, FILE), 'utf8')) => depthPassErrors({ root, file: FILE, markdown });

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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { contractMain } from './contract.mjs';
import { CONTRACT_TEMPLATE } from './lib/contract.mjs';

const GOOD = [
  '# A feature',
  '',
  '## Goal',
  'Ship the thing.',
  '',
  '## Why',
  'Because the loop needs evidence.',
  '',
  '## Done when',
  '- `npm run check` exits 0',
  '',
  '## In scope / Out of scope',
  '- In: bin/',
  '',
  '## Constraints',
  '- Zero dependencies — because it must run anywhere',
  '',
  '## Effort',
  'high',
  '',
  '## Ask me before',
  'Changing the template.',
  '',
].join('\n');

/** A contract whose `## Done when` is prose only, so `validateContract` rejects it. */
const BAD = GOOD.replace('- `npm run check` exits 0', '- It works');

const NOT_A_CONTRACT = '# Old feature\n\n## Tasks\n- [x] T1\n';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-contract-'));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Runs `contractMain`, capturing what it printed through the injected writers. */
async function run(argv, opts = {}) {
  const out = [];
  const err = [];
  const code = await contractMain(argv, {}, { stdout: (line) => out.push(line), stderr: (line) => err.push(line), ...opts });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

test('template prints the template and exits 0', async () => {
  const { code, stdout } = await run(['template']);
  assert.equal(code, 0);
  assert.equal(`${stdout}\n`, CONTRACT_TEMPLATE);
});

test('no subcommand, an unknown one, an unknown flag and a missing value are usage errors (exit 2)', async () => {
  for (const argv of [[], ['frobnicate'], ['template', 'extra'], ['check', '--nope'], ['check', '--cwd'], ['check', '--cwd', '--x']]) {
    const { code, stdout, stderr } = await run(argv);
    assert.equal(code, 2, argv.join(' '));
    assert.equal(stdout, '', argv.join(' '));
    assert.match(stderr, /Usage: js-harness contract/, argv.join(' '));
  }
});

test('check with no contracts under odd/tasks says so and exits 0', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'odd', 'tasks', 'old.md'), NOT_A_CONTRACT);
    const { code, stdout } = await run(['check', '--cwd', dir]);
    assert.equal(code, 0);
    assert.match(stdout, /no contracts under odd\/tasks/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('check with no files validates every contract under odd/tasks, skips other docs, and exits 1 on a failure', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'odd', 'tasks', 'good.md'), GOOD);
    writeFile(path.join(dir, 'odd', 'tasks', 'bad.md'), BAD);
    writeFile(path.join(dir, 'odd', 'tasks', 'old.md'), NOT_A_CONTRACT);
    const { code, stdout } = await run(['check', '--cwd', dir]);
    assert.equal(code, 1);
    assert.match(stdout, /^PASS {2}odd\/tasks\/good\.md$/m);
    assert.match(stdout, /^FAIL {2}odd\/tasks\/bad\.md$/m);
    assert.match(stdout, /^ +.*"## Done when" has no command/m);
    assert.doesNotMatch(stdout, /old\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('check with no files and only good contracts exits 0', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'odd', 'tasks', 'good.md'), GOOD);
    const { code, stdout } = await run(['check', '--cwd', dir]);
    assert.equal(code, 0);
    assert.match(stdout, /^PASS {2}odd\/tasks\/good\.md$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('check with files resolves them from --cwd; a file that is not a contract, or is unreadable, fails with a reason', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'a.md'), GOOD);
    writeFile(path.join(dir, 'b.md'), NOT_A_CONTRACT);
    const { code, stdout } = await run(['check', 'a.md', 'b.md', 'missing.md', '--cwd', dir]);
    assert.equal(code, 1);
    assert.match(stdout, /^PASS {2}a\.md$/m);
    assert.match(stdout, /^FAIL {2}b\.md$/m);
    assert.match(stdout, /not a contract: no "## Goal" heading/);
    assert.match(stdout, /^FAIL {2}missing\.md$/m);
    assert.match(stdout, /cannot read/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('check with no files run from a subdirectory of a repository reads the repository root', async () => {
  const dir = makeTmpDir();
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    writeFile(path.join(dir, 'odd', 'tasks', 'good.md'), GOOD);
    fs.mkdirSync(path.join(dir, 'bin'));
    const { code, stdout } = await run(['check', '--cwd', path.join(dir, 'bin')]);
    assert.equal(code, 0);
    assert.match(stdout, /^PASS {2}odd\/tasks\/good\.md$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

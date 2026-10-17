// The row `commit-size` of `check` (docs/FAILURES.md, commit-too-large-to-review): a staged change with more
// changed lines a review reads than the rule `reviewed-commit-lines` gives a reviewed commit fails the gate,
// so the commit is split before it is made rather than refused by the reviewer after it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkCommitSize } from './check.mjs';
import { ruleHere } from './lib/rules.mjs';

// The harness's own rules file, which a repository holds for the rule, of this repository only, to be in force.
const BIN = path.dirname(fileURLToPath(import.meta.url));
const RULES_FILE = path.join(BIN, 'lib', 'rules-data.mjs');
const REVIEWED_COMMIT_LINES = ruleHere('reviewed-commit-lines', 'changed lines', fs.readFileSync(RULES_FILE, 'utf8')).value;

let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-commit-size-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function repo({ rules = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-commit-size-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, 'bin', 'a.mjs'), 'one\n');
  if (rules) {
    fs.mkdirSync(path.join(root, 'bin', 'lib'));
    fs.copyFileSync(RULES_FILE, path.join(root, 'bin', 'lib', 'rules-data.mjs'));
  }
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

const linesOf = (count) => Array.from({ length: count }, (_, i) => `line ${i}`).join('\n') + '\n';
const grouped = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function inRepo(work, options) {
  const root = repo(options);
  try {
    work(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('a staged change over the changed lines a reviewed commit holds fails the gate, and says to split it', () => {
  inRepo((root) => {
    const over = REVIEWED_COMMIT_LINES + 1;
    fs.writeFileSync(path.join(root, 'bin', 'big.mjs'), linesOf(over));
    git(root, 'add', '.');
    assert.deepEqual(checkCommitSize(root), [{
      name: 'commit-size',
      pass: false,
      detail: `the staged change has ${grouped(over)} changed lines a review reads, over the ${grouped(REVIEWED_COMMIT_LINES)} changed lines of rule reviewed-commit-lines: split it into commits under that, each with its own gate, before the reviewer refuses it`,
    }]);
  });
});

test('a staged change at the bound passes, and its Markdown documents are not counted', () => {
  inRepo((root) => {
    fs.writeFileSync(path.join(root, 'bin', 'big.mjs'), linesOf(REVIEWED_COMMIT_LINES));
    fs.writeFileSync(path.join(root, 'notes.md'), linesOf(REVIEWED_COMMIT_LINES));
    git(root, 'add', '.');
    assert.deepEqual(checkCommitSize(root), [{
      name: 'commit-size',
      pass: true,
      detail: `the staged change has ${grouped(REVIEWED_COMMIT_LINES)} changed lines a review reads, within the ${grouped(REVIEWED_COMMIT_LINES)} changed lines of rule reviewed-commit-lines`,
    }]);
  });
});

test('the files a review leaves out are those the staged attributes mark, not those of the commit before', () => {
  inRepo((root) => {
    // The staged change removes the exclusion of a file and makes it too large: the review will read it.
    fs.writeFileSync(path.join(root, '.gitattributes'), 'bin/gen.mjs -codex-review\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'mark gen');
    fs.writeFileSync(path.join(root, '.gitattributes'), '');
    fs.writeFileSync(path.join(root, 'bin', 'gen.mjs'), linesOf(REVIEWED_COMMIT_LINES + 1));
    git(root, 'add', '.');
    const [removed] = checkCommitSize(root);
    assert.equal(removed.pass, false, removed.detail);
    // The staged change marks a file it makes too large: the review will leave it out.
    git(root, 'reset', '-q');
    fs.writeFileSync(path.join(root, '.gitattributes'), 'bin/gen.mjs -codex-review\nbin/other.mjs -codex-review\n');
    fs.writeFileSync(path.join(root, 'bin', 'other.mjs'), linesOf(REVIEWED_COMMIT_LINES + 1));
    git(root, 'add', '.');
    // What is left is the line `.gitattributes` gains, which a review reads.
    const [marked] = checkCommitSize(root);
    assert.equal(marked.pass, true, marked.detail);
    assert.match(marked.detail, /^the staged change has 1 changed line a review reads,/);
  });
});

test('no row with nothing staged, with only documents staged, or while a merge is being made', () => {
  inRepo((root) => {
    assert.deepEqual(checkCommitSize(root), []);
    fs.writeFileSync(path.join(root, 'notes.md'), linesOf(REVIEWED_COMMIT_LINES + 1));
    git(root, 'add', '.');
    assert.deepEqual(checkCommitSize(root), []);
    git(root, 'commit', '-q', '-m', 'notes');
    // A merge brings commits made and reviewed elsewhere: its size is theirs, not a commit's of this branch.
    git(root, 'checkout', '-q', '-b', 'side');
    fs.writeFileSync(path.join(root, 'bin', 'big.mjs'), linesOf(REVIEWED_COMMIT_LINES + 1));
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'big');
    git(root, 'checkout', '-q', 'main');
    git(root, 'merge', '-q', '--no-ff', '--no-commit', 'side');
    assert.deepEqual(checkCommitSize(root), []);
  });
});

// Git runs `pre-merge-commit` for the commit a merge makes by itself before it writes MERGE_HEAD, so a merge
// that needs no hand was sized as a commit of this branch and refused (odd/tasks/land-unattended.md, T8): the
// merge hook says which hook it is, and the row reads that.
test('no row in the hook of a merge git commits by itself, where MERGE_HEAD is not written yet', () => {
  inRepo((root) => {
    git(root, 'checkout', '-q', '-b', 'side');
    fs.writeFileSync(path.join(root, 'bin', 'big.mjs'), linesOf(REVIEWED_COMMIT_LINES + 1));
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'big');
    git(root, 'checkout', '-q', 'main');
    fs.writeFileSync(path.join(root, 'trunk.md'), 'the trunk moves on\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'trunk');
    // The merge hook of this repository, with its gate replaced by a script that writes what the row says.
    const said = path.join(root, '..', `${path.basename(root)}-said.json`);
    const probe = path.join(root, '..', `${path.basename(root)}-probe.mjs`);
    fs.writeFileSync(probe, [
      `import fs from 'node:fs';`,
      `import { checkCommitSize } from ${JSON.stringify(pathToFileURL(path.join(BIN, 'check.mjs')).href)};`,
      `fs.writeFileSync(${JSON.stringify(said)}, JSON.stringify({ rows: checkCommitSize(process.cwd()), mergeHead: fs.existsSync('.git/MERGE_HEAD') }));`,
    ].join('\n'));
    const hook = fs.readFileSync(path.join(BIN, '..', '.githooks', 'pre-merge-commit'), 'utf8').replace(/\r\n/g, '\n')
      .replace(/^exec .*$/m, `exec node ${JSON.stringify(probe.replace(/\\/g, '/'))}`);
    fs.writeFileSync(path.join(root, '.git', 'hooks', 'pre-merge-commit'), hook);
    fs.chmodSync(path.join(root, '.git', 'hooks', 'pre-merge-commit'), 0o755);
    try {
      git(root, 'merge', '-q', '--no-ff', '--no-edit', 'side');
      const { rows, mergeHead } = JSON.parse(fs.readFileSync(said, 'utf8'));
      assert.equal(mergeHead, false, 'git wrote MERGE_HEAD before the hook: the case this test is for did not arise');
      assert.deepEqual(rows, []);
    } finally {
      fs.rmSync(said, { force: true });
      fs.rmSync(probe, { force: true });
    }
  });
});

test('no row in a project where the rule is not in force: one that keeps no rules file of the harness', () => {
  inRepo((root) => {
    fs.writeFileSync(path.join(root, 'bin', 'big.mjs'), linesOf(REVIEWED_COMMIT_LINES + 1));
    git(root, 'add', '.');
    assert.deepEqual(checkCommitSize(root), []);
  }, { rules: false });
});

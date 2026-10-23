// Tests of scripts/audit-citations.mjs (T3 of odd/tasks/launch-audit.md, S5a). Each test builds a small repository
// in the temporary folder, with one commit, its own inventory and, where a test needs one, its own allow list, and
// runs the script on it as a child process. Nothing is written inside this repository.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBatchCheck } from './audit-citations.mjs';

const SCRIPT = fileURLToPath(new URL('./audit-citations.mjs', import.meta.url));
const GUIDE = 'one\ntwo\nthree\n';
const MISSING_COMMIT = 'badc0ffee0ddf00d';
const scratch = [];

after(() => {
  for (const dir of scratch) fs.rmSync(dir, { recursive: true, force: true });
});

function git(cwd, args) {
  return execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
  }).trim();
}

// A repository with one commit of `files` (path to text) and an inventory of `rows` (path to class). The commit
// is repeated, empty, until its short id has a digit and a letter, so that the script reads it as a commit citation.
// Returns the folder, the inventory path, and the full and short ids of the commit.
function fixture(files, rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-citations-'));
  scratch.push(dir);
  git(dir, ['init', '-q']);
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'fixture']);
  let full = git(dir, ['rev-parse', 'HEAD']);
  for (let n = 0; !/^(?=[0-9a-f]*[0-9])(?=[0-9a-f]*[a-f])/.test(full.slice(0, 7)); n += 1) {
    git(dir, ['commit', '-q', '--allow-empty', '-m', `again ${n}`]);
    full = git(dir, ['rev-parse', 'HEAD']);
  }
  const inventory = path.join(dir, 'inventory.tsv');
  const body = Object.entries(rows).map(([name, cls]) => `${name}\t${cls}\t-\t-`);
  fs.writeFileSync(inventory, ['path\tclass\tarea\tverdict', ...body].join('\n') + '\n');
  return { dir, inventory, full, short: full.slice(0, 7) };
}

// The README is the live file that cites; docs/guide.md is three lines long.
function readme(text) {
  return fixture({ 'README.md': text, 'docs/guide.md': GUIDE }, { 'README.md': 'live', 'docs/guide.md': 'live' });
}

function audit(fx, args = []) {
  return spawnSync(process.execPath, [SCRIPT, '--cwd', fx.dir, '--inventory', fx.inventory, ...args], { encoding: 'utf8' });
}

test('a good path citation and a good range pass', () => {
  const fx = readme('See `docs/guide.md:2` and `docs/guide.md:1-3`.\n');
  const run = audit(fx);
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '0 findings, 0 allowed\n');
});

test('a citation of a missing file is no-such-file', () => {
  const fx = readme('Gone: `docs/gone.md:1`\n');
  const run = audit(fx);
  assert.equal(run.status, 1);
  assert.equal(run.stdout, 'no-such-file  README.md:1  docs/gone.md:1 (no such file)\n1 findings, 0 allowed\n');
});

test('a line past the end of its file is past-end', () => {
  const fx = readme('Past: `docs/guide.md:4`\n');
  const run = audit(fx);
  assert.equal(run.status, 1);
  assert.equal(run.stdout, 'past-end  README.md:1  docs/guide.md:4 (the file has 3 lines)\n1 findings, 0 allowed\n');
});

test('a range whose end is past the end of its file is past-end', () => {
  const fx = readme('Range: `docs/guide.md:2-7`\n');
  const run = audit(fx);
  assert.equal(run.status, 1);
  assert.equal(run.stdout, 'past-end  README.md:1  docs/guide.md:2-7 (the file has 3 lines)\n1 findings, 0 allowed\n');
});

test('a malformed line or range is past-end too', () => {
  const fx = readme('Zero: `docs/guide.md:0`\nBackwards: `docs/guide.md:3-2`\n');
  const run = audit(fx);
  assert.equal(run.status, 1);
  assert.equal(
    run.stdout,
    'past-end  README.md:1  docs/guide.md:0 (no such line or range)\n'
      + 'past-end  README.md:2  docs/guide.md:3-2 (no such line or range)\n'
      + '2 findings, 0 allowed\n',
  );
});

test('a real commit id, short and full, resolves', () => {
  // The script reads the working-tree bytes of the citing file, so the README can name the commit it made.
  const fx = fixture({ 'README.md': 'x\n' }, { 'README.md': 'live' });
  fs.writeFileSync(path.join(fx.dir, 'README.md'), `Short \`${fx.short}\` and full \`${fx.full}\`.\n`);
  const run = audit(fx);
  assert.equal(run.status, 0, run.stdout);
  assert.equal(run.stdout, '0 findings, 0 allowed\n');
});

test('a missing commit id is no-such-commit', () => {
  const fx = readme(`Gone commit: \`${MISSING_COMMIT}\`\n`);
  const run = audit(fx);
  assert.equal(run.status, 1);
  assert.equal(run.stdout, `no-such-commit  README.md:1  ${MISSING_COMMIT} (no such commit)\n1 findings, 0 allowed\n`);
});

test('a file of class history is not read', () => {
  const fx = fixture(
    { 'README.md': 'Clean: `docs/guide.md:1`\n', 'docs/guide.md': GUIDE, 'odd/old.md': 'Old: `docs/gone.md:9`\n' },
    { 'README.md': 'live', 'docs/guide.md': 'live', 'odd/old.md': 'history' },
  );
  const run = audit(fx);
  assert.equal(run.status, 0, run.stdout);
  assert.equal(run.stdout, '0 findings, 0 allowed\n');
});

test('an allow entry hides its finding and counts it as allowed', () => {
  const fx = readme('Gone: `docs/gone.md:1`\n');
  const allow = path.join(fx.dir, 'allow.json');
  fs.writeFileSync(allow, JSON.stringify([{ kind: 'no-such-file', location: 'README.md:1', why: 'kept on purpose' }]));
  const run = audit(fx, ['--allow', allow]);
  assert.equal(run.status, 0, run.stdout);
  assert.equal(run.stdout, '0 findings, 1 allowed\n');
});

test('an allow entry that matches no finding is a stale-allow finding', () => {
  const fx = readme('Clean: `docs/guide.md:1`\n');
  const allow = path.join(fx.dir, 'allow.json');
  fs.writeFileSync(allow, JSON.stringify([{ kind: 'no-such-file', location: 'README.md:1', why: 'gone since' }]));
  const run = audit(fx, ['--allow', allow]);
  assert.equal(run.status, 1);
  assert.equal(run.stdout, 'stale-allow  README.md:1  no finding of kind no-such-file here\n1 findings, 0 allowed\n');
});

test('a missing default inventory exits 2 and names the path it looked at', () => {
  const fx = readme('Clean: `docs/guide.md:1`\n');
  const run = spawnSync(process.execPath, [SCRIPT, '--cwd', fx.dir], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  const [first] = run.stderr.split('\n');
  assert.ok(first.startsWith('inventory not found: '), first);
  assert.ok(first.endsWith(path.join('odd', 'tasks', 'launch-audit', 'inventory.tsv')), first);
});

test('a missing inventory given by --inventory exits 2 and names it', () => {
  const fx = readme('Clean: `docs/guide.md:1`\n');
  const missing = path.join(fx.dir, 'nope.tsv');
  const run = spawnSync(process.execPath, [SCRIPT, '--cwd', fx.dir, '--inventory', missing], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.equal(run.stderr.split('\n')[0], `inventory not found: ${missing}`);
});

test('an unknown argument exits 2 and names it', () => {
  const fx = readme('Clean: `docs/guide.md:1`\n');
  const run = audit(fx, ['--bogus']);
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  const [first] = run.stderr.split('\n');
  assert.equal(first, 'unknown argument: --bogus');
  assert.match(run.stderr, /usage: node scripts\/audit-citations\.mjs/);
});

test('--json prints one object with the findings and the count allowed', () => {
  const fx = readme('Gone: `docs/gone.md:1`\nClean: `docs/guide.md:1`\n');
  const run = audit(fx, ['--json']);
  assert.equal(run.status, 1);
  assert.deepEqual(JSON.parse(run.stdout), {
    findings: [{ kind: 'no-such-file', location: 'README.md:1', detail: 'docs/gone.md:1 (no such file)' }],
    allowed: 0,
  });
});

test('--json of a clean run has no findings and allowed 0', () => {
  const fx = readme('Clean: `docs/guide.md:1`\n');
  const run = audit(fx, ['--json']);
  assert.equal(run.status, 0);
  assert.deepEqual(JSON.parse(run.stdout), { findings: [], allowed: 0 });
});

test('a commit id git answers as ambiguous resolves, and a missing one does not', () => {
  const ids = ['a1b2c3d', 'deadbee', 'f00dfee'];
  const output = 'a1b2c3d^{commit} ambiguous\n'
    + 'deadbee^{commit} missing\n'
    + '0123456789abcdef0123456789abcdef01234567 commit 118\n';
  assert.deepEqual([...parseBatchCheck(ids, output)].sort(), ['a1b2c3d', 'f00dfee']);
});

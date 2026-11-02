import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { USAGE, checkDocs, docsMain } from './docs.mjs';

const SPEC = [
  '# The specification',
  '',
  '## Capabilities',
  '',
  '### The reply check',
  '**Problem:** Seen in odd/tasks/reply.md.',
  '**Requirement:** It closes.',
  '**Reason:** It must.',
  '**Proof:** `node --test bin/reply.test.mjs`',
  '**Discarded:** Nothing.',
  '**Today:** `bin/reply.mjs`',
  '',
].join('\n');

const INDEX = [
  '# Reading js-harness cold',
  '',
  '## Index',
  '',
  '| Document | Status | Superseded by | What it is |',
  '|---|---|---|---|',
  '| `docs/README.md` | live | | this page |',
  '| `docs/SPEC.md` | live | | the map |',
  '',
].join('\n');

/** A git repository holding `files` (`{ path: text }`), all staged, removed after `body` runs with its folder. */
function withRepo(files, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-docs-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), text);
    }
    assert.equal(spawnSync('git', ['add', '-A'], { cwd: dir }).status, 0);
    return body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const REPO = {
  'docs/README.md': INDEX,
  'docs/SPEC.md': SPEC,
  'bin/reply.mjs': "import { x } from './lib/x.mjs';\n",
  'bin/lib/x.mjs': 'export const x = 1;\n',
  'bin/reply.test.mjs': '// a test\n',
  'odd/tasks/reply.md': '# Reply\n\n## Tasks\n- [x] T1 (kind: docs) the reply\n',
  'evals/run.mjs': '// an eval\n',
};

/** What `docsMain` prints and returns for `argv` in `cwd`. */
async function run(argv, cwd) {
  const out = [];
  const err = [];
  const code = await docsMain(argv, { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('docs plan prints every tracked file in a slice, by tier, the source with its capability, and exits 0', async () => {
  await withRepo(REPO, async (dir) => {
    const { code, out } = await run(['plan'], dir);
    assert.equal(code, 0);
    assert.match(out, /^Reading plan of 7 tracked files, \d+ estimated tokens \(characters over four\), in 4 slices of at most 400,000/);
    assert.match(out, /core: 1 slice/);
    assert.match(out, /orientation \(\d+\): docs\/README\.md, docs\/SPEC\.md/);
    assert.match(out, /The reply check \(\d+\): bin\/reply\.mjs, bin\/lib\/x\.mjs/);
    assert.match(out, /tests: 1 slice/);
    assert.match(out, /feature documents: 1 slice[\s\S]*The reply check \(\d+\): odd\/tasks\/reply\.md \(closed, 1 of 1 tasks\)/);
    assert.match(out, /slice 2, \d+ tokens, opening with docs\/README\.md/);
    assert.match(out, /the rest: 1 slice[\s\S]*evals \(\d+\): evals\/run\.mjs/);
  });
});

test('docs plan --budget sets the slice budget, and --json prints the plan whole', async () => {
  await withRepo(REPO, async (dir) => {
    const { code, out } = await run(['plan', '--budget', '5', '--json'], dir);
    assert.equal(code, 0);
    const plan = JSON.parse(out);
    assert.equal(plan.budget, 5);
    assert.equal(plan.files, 7);
    assert.ok(plan.tiers[0].slices.length > 1);
  });
});

test('docs refuses an argument it does not know with exit 2 and the usage', async () => {
  for (const argv of [['plan', '--nope'], ['nope'], [], ['plan', '--budget', 'many']]) {
    const { code, err } = await run(argv, os.tmpdir());
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.endsWith(USAGE), argv.join(' '));
  }
  assert.match((await run(['plan', '--nope'], os.tmpdir())).err, /^unknown argument: --nope/);
});

test('the docs row passes where the index has every entry of docs/ and the plan places every tracked file', () => {
  withRepo(REPO, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.name, 'docs');
    assert.equal(row.pass, true);
    assert.match(row.detail, /^2 entries of docs\/ indexed; 7 tracked files in 4 slices of at most 400,000 estimated tokens/);
  });
});

test('the docs row fails on an entry of docs/ that has no row, naming it', () => {
  withRepo({ ...REPO, 'docs/todo.md': '# Todo\n' }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, false);
    assert.deepEqual(row.lines, ['docs/todo.md has no row in the index of docs/README.md']);
  });
});

test('the docs row fails on a file too big for one slice, naming it', () => {
  withRepo({ ...REPO, 'evals/huge.txt': 'x'.repeat(1_700_000) }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, false);
    assert.deepEqual(row.lines, ['evals/huge.txt alone is 425,000 estimated tokens, over a slice of 400,000 with its opening: split the file']);
  });
});

test('the docs row takes a row for a tracked file inside a folder of docs/', () => {
  const index = `${INDEX}| \`docs/host-updates/\` | historical | each release record | releases |\n| \`docs/host-updates/README.md\` | live | | the format |\n`;
  withRepo({ ...REPO, 'docs/README.md': index, 'docs/host-updates/README.md': '# Format\n', 'docs/host-updates/one.md': '# One\n' }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, true, (row.lines ?? []).join('\n'));
  });
});

test('only the harness\'s own repository has a docs row: a project\'s docs/README.md is its own business', () => {
  withRepo({ ...REPO, 'docs/README.md': '# Our docs\n', 'docs/guide.md': '# Guide\n' }, (dir) => assert.deepEqual(checkDocs(dir), []));
});

test('docs check says a project is not the harness\'s own and exits 0', async () => {
  await withRepo(REPO, async (dir) => {
    const { code, out } = await run(['check'], dir);
    assert.equal(code, 0);
    assert.equal(out, "not the harness's own repository: its docs/README.md is held to nothing");
  });
});

test('in the harness\'s own repository the row fails where docs/README.md is gone, so deleting it cannot switch it off', () => {
  withRepo({ 'docs/SPEC.md': SPEC }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, false);
    assert.match(row.detail, /^docs\/README\.md is missing/);
  });
});

test('the row fails on a tracked file it cannot read, and reads a file deleted from the tree as empty', () => {
  withRepo(REPO, (dir) => {
    fs.rmSync(path.join(dir, 'evals/run.mjs'));
    const readFile = (file) => {
      if (file.endsWith('x.mjs')) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return fs.readFileSync(file, 'utf8');
    };
    const [row] = checkDocs(dir, { own: true, readFile });
    assert.equal(row.pass, false);
    assert.deepEqual(row.lines, ['bin/lib/x.mjs cannot be read: permission denied']);
  });
});

test('the index is the table under "## Index": another table of the page holds no rows of it', () => {
  const index = `${INDEX}\n## Commands\n\n| Command | What |\n|---|---|\n| \`docs/elsewhere.md\` | a path in another table |\n`;
  withRepo({ ...REPO, 'docs/README.md': index }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, true, (row.lines ?? []).join('\n'));
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { USAGE, checkDocs, docsMain } from './docs.mjs';
import { INFERRED_CHECK, INFERRED_LABEL } from '../lib/docs-cross.mjs';

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
// An async body is awaited before the directory goes, so a step after its first await still finds the repository.
async function withRepo(files, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-docs-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), text);
    }
    assert.equal(spawnSync('git', ['add', '-A'], { cwd: dir }).status, 0);
    return await body(dir);
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

test('docs plan names a tracked file it cannot read and exits 1, since its figures would undercount', async () => {
  await withRepo(REPO, async (dir) => {
    const out = [];
    const err = [];
    const readFile = (file) => {
      if (file.endsWith('x.mjs')) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return fs.readFileSync(file, 'utf8');
    };
    const code = await docsMain(['plan'], { cwd: dir, stdout: (line) => out.push(line), stderr: (line) => err.push(line), readFile });
    assert.equal(code, 1);
    assert.equal(err.join('\n'), 'bin/lib/x.mjs cannot be read: permission denied\nthe plan counts it as empty, so its figures are short');
  });
});

const RULES = [
  '# Rules',
  '',
  "## Sebastián's",
  '',
  '### reply-states',
  'A reply closes in a state.',
  '- Home: `bin/reply.mjs`.',
  '- Since 2026-10-01. Row: reports, against the failure `reply-unchecked`. Source: design.',
  '',
  '### gate-max',
  'How long a gate runs.',
  '- Read by: `bin/gate.mjs`.',
  '',
].join('\n');

const FAILURES = [
  '# Failures',
  '',
  '## Classes',
  '',
  '- `tool`: a command failed.',
  '',
  '## Entries',
  '',
  '### reply-unchecked',
  'A reply closed with no state.',
  '- Class: tool',
  '- Seen: 2026-10-01 — a transcript, line 4 — the reply closed bare',
  '- Control: check — bin/reply.test.mjs — "a reply closes with a state line" — since 2026-10-02',
  '',
  '### stale-gate',
  'A gate ran on.',
  '- Class: tool',
  '- Seen: 2026-10-01 — a transcript, line 9 — the gate ran on',
  '',
].join('\n');

/** The repository with the rules and the failure register the cross index joins, and their rows in the index. */
const CROSS = {
  ...REPO,
  'docs/README.md': `${INDEX}| \`docs/RULES.md\` | live | | the rules |\n| \`docs/FAILURES.md\` | live | | the failures |\n`,
  'docs/RULES.md': RULES,
  'docs/FAILURES.md': FAILURES,
  'odd/tasks/gate.md': '# Gate\n',
};

test('docs index prints each capability with its explicit links, its inferred ones apart with their files, then what no capability reaches', async () => {
  await withRepo(CROSS, async (dir) => {
    const { code, out } = await run(['index'], dir);
    assert.equal(code, 0);
    assert.match(out, /^Cross index of 1 capability: 1 cites a document, 0 name a rule, 0 a failure entry; 1 reaches a rule and 1 a failure entry by inference/);
    assert.ok(out.includes(`The reply check (line 5)
  cites: odd/tasks/reply.md
  ${INFERRED_LABEL}: rule reply-states through bin/reply.mjs; failure reply-unchecked through bin/reply.test.mjs`), out);
    assert.match(out, /Reached by no capability:\n {2}rules: gate-max\n {2}failure entries: stale-gate\n {2}feature documents: odd\/tasks\/gate\.md/);
  });
});

test('docs index --json prints the index whole, with what its inferred links are worth', async () => {
  await withRepo(CROSS, async (dir) => {
    const { code, out } = await run(['index', '--json'], dir);
    assert.equal(code, 0);
    const index = JSON.parse(out);
    assert.deepEqual(index.capabilities[0].inferred.rules, [{ id: 'reply-states', via: 'bin/reply.mjs' }]);
    assert.deepEqual(index.unreached.features, ['odd/tasks/gate.md']);
    assert.deepEqual(index.inferredLinks, { label: INFERRED_LABEL, check: INFERRED_CHECK });
  });
});

test('docs index says which input it lacks and exits 1, for each of the three it joins', async () => {
  for (const file of ['docs/SPEC.md', 'docs/RULES.md', 'docs/FAILURES.md']) {
    const { [file]: _gone, ...rest } = CROSS;
    await withRepo(rest, async (dir) => {
      const { code, err } = await run(['index'], dir);
      assert.equal(code, 1, file);
      assert.equal(err, `${file} is not tracked: the cross index joins docs/SPEC.md, docs/RULES.md and docs/FAILURES.md`);
    });
  }
});

test('an input of the cross index deleted from the tree but still tracked is gone: docs index and the row fail on it', async () => {
  await withRepo(CROSS, async (dir) => {
    fs.rmSync(path.join(dir, 'docs/SPEC.md'));
    const { code, err } = await run(['index'], dir);
    assert.equal(code, 1);
    assert.equal(err, 'docs/SPEC.md is gone from the tree: the cross index joins docs/SPEC.md, docs/RULES.md and docs/FAILURES.md');
    const [row] = checkDocs(dir, { own: true });
    assert.ok((row.lines ?? []).includes('docs/SPEC.md is gone from the tree: the cross index joins docs/SPEC.md, docs/RULES.md and docs/FAILURES.md'), JSON.stringify(row));
  });
});

test('docs index names a tracked file it cannot read and exits 1', async () => {
  await withRepo(CROSS, async (dir) => {
    const err = [];
    const readFile = (file) => {
      if (file.endsWith('x.mjs')) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return fs.readFileSync(file, 'utf8');
    };
    const code = await docsMain(['index'], { cwd: dir, stdout: () => {}, stderr: (line) => err.push(line), readFile });
    assert.equal(code, 1);
    assert.equal(err.join('\n'), 'bin/lib/x.mjs cannot be read: permission denied\nthe index reads it as empty, so a link through it may be missing');
  });
});

test('docs index names an input of its own it cannot read before what that does to the index', async () => {
  await withRepo(CROSS, async (dir) => {
    const err = [];
    const readFile = (file) => {
      if (file.endsWith('FAILURES.md')) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return fs.readFileSync(file, 'utf8');
    };
    const code = await docsMain(['index'], { cwd: dir, stdout: () => {}, stderr: (line) => err.push(line), readFile });
    assert.equal(code, 1);
    assert.match(err.join('\n'), /^docs\/FAILURES\.md cannot be read: permission denied\nthe index reads it as empty, so a link through it may be missing\ndocs\/FAILURES\.md does not read as a register/);
  });
});

test('in the harness\'s own repository the row fails on any input of the cross index that is gone, so deleting one cannot switch it off', async () => {
  for (const file of ['docs/RULES.md', 'docs/FAILURES.md']) {
    const { [file]: _gone, ...rest } = CROSS;
    await withRepo(rest, (dir) => {
      const [row] = checkDocs(dir, { own: true });
      assert.equal(row.pass, false, file);
      assert.ok(row.lines.includes(`${file} is not tracked: the cross index joins docs/SPEC.md, docs/RULES.md and docs/FAILURES.md`), file);
    });
  }
});

test('the docs row fails on an explicit link of a capability that does not resolve, and reports the rest', async () => {
  await withRepo({ ...CROSS, 'docs/SPEC.md': SPEC.replace('Seen in odd/tasks/reply.md.', 'Seen in odd/tasks/gone.md and `rule:no-such-rule`.') }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, false);
    assert.deepEqual(row.lines, [
      '"The reply check" (line 5) cites odd/tasks/gone.md, which is not a tracked file',
      '"The reply check" (line 5) names rule:no-such-rule, which is no rule',
    ]);
  });
  await withRepo(CROSS, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, true);
    assert.match(row.detail, /; 0 records of docs\/SPEC\.md held to the source and to docs\/RECORDS\.md; every explicit link of the cross index resolves, 2 links inferred, 3 reached by no capability \(js-harness docs index\)$/);
  });
});

test('the docs row fails on a record the source writes that no row of the table of records holds', async () => {
  await withRepo({ ...CROSS, 'bin/lib/x.mjs': "export const x = path.join(home, '.js-harness', 'pace');\n" }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, false);
    assert.deepEqual(row.lines, ['pace (bin/lib/x.mjs) is a record the source writes and no row of the table holds: add it to its family, or to the names that are no records with why']);
  });
});

test('docs refuses an argument it does not know with exit 2 and the usage', async () => {
  for (const argv of [['plan', '--nope'], ['nope'], [], ['plan', '--budget', 'many'], ['index', '--budget', '3']]) {
    const { code, err } = await run(argv, os.tmpdir());
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.endsWith(USAGE), argv.join(' '));
  }
  assert.match((await run(['plan', '--nope'], os.tmpdir())).err, /^unknown argument: --nope/);
});

test('the docs row passes where the index has every entry of docs/ and the plan places every tracked file', async () => {
  await withRepo(CROSS, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.name, 'docs');
    assert.equal(row.pass, true);
    assert.match(row.detail, /^4 entries of docs\/ indexed; 10 tracked files in 4 slices of at most 400,000 estimated tokens/);
  });
});

test('with no .git, as in the gate\'s WSL mirror, the row reads the files on disk that git would not ignore', async () => {
  // The merge queue of 2026-11-06 left PR 776 out: the mirror is synced without .git, so git listed nothing there.
  await withRepo({ ...CROSS, '.gitignore': '*.log\n', 'evals/run.log': 'x'.repeat(1_700_000) }, (dir) => {
    const [tracked] = checkDocs(dir, { own: true });
    assert.equal(tracked.pass, true, (tracked.lines ?? []).join('\n'));
    fs.rmSync(path.join(dir, '.git'), { recursive: true, force: true });
    assert.deepEqual(checkDocs(dir, { own: true }), [tracked]);
  });
});

test('the docs row fails on an entry of docs/ that has no row, naming it', async () => {
  await withRepo({ ...CROSS, 'docs/todo.md': '# Todo\n' }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, false);
    assert.deepEqual(row.lines, ['docs/todo.md has no row in the index of docs/README.md']);
  });
});

test('the docs row fails on a file too big for one slice, naming it', async () => {
  await withRepo({ ...CROSS, 'evals/huge.txt': 'x'.repeat(1_700_000) }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, false);
    assert.deepEqual(row.lines, ['evals/huge.txt alone is 425,000 estimated tokens, over a slice of 400,000 with its opening: split the file']);
  });
});

test('the docs row takes a row for a tracked file inside a folder of docs/', async () => {
  const index = `${CROSS['docs/README.md']}| \`docs/host-updates/\` | historical | each release record | releases |\n| \`docs/host-updates/README.md\` | live | | the format |\n`;
  await withRepo({ ...CROSS, 'docs/README.md': index, 'docs/host-updates/README.md': '# Format\n', 'docs/host-updates/one.md': '# One\n' }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, true, (row.lines ?? []).join('\n'));
  });
});

test('only the harness\'s own repository has a docs row: a project\'s docs/README.md is its own business', async () => {
  await withRepo({ ...REPO, 'docs/README.md': '# Our docs\n', 'docs/guide.md': '# Guide\n' }, (dir) => assert.deepEqual(checkDocs(dir), []));
});

test('docs check says a project is not the harness\'s own and exits 0', async () => {
  await withRepo(CROSS, async (dir) => {
    const { code, out } = await run(['check'], dir);
    assert.equal(code, 0);
    assert.equal(out, "not the harness's own repository: its docs/README.md is held to nothing");
  });
});

test('in the harness\'s own repository the row fails where docs/README.md is gone, so deleting it cannot switch it off', async () => {
  await withRepo({ 'docs/SPEC.md': SPEC }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, false);
    assert.match(row.detail, /^docs\/README\.md is missing/);
  });
});

test('the row fails on a tracked file it cannot read, and reads a file deleted from the tree as empty', async () => {
  await withRepo(CROSS, (dir) => {
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

test('the index is the table under "## Index": another table of the page holds no rows of it', async () => {
  const index = `${CROSS['docs/README.md']}\n## Commands\n\n| Command | What |\n|---|---|\n| \`docs/elsewhere.md\` | a path in another table |\n`;
  await withRepo({ ...CROSS, 'docs/README.md': index }, (dir) => {
    const [row] = checkDocs(dir, { own: true });
    assert.equal(row.pass, true, (row.lines ?? []).join('\n'));
  });
});

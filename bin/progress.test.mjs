import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { progressMain } from './progress.mjs';

// `--pace` runs git. A git hook runs with GIT_DIR, GIT_INDEX_FILE and friends pointing at the repository being
// committed; inherited, they would send the git calls of these tests, and those of `progressMain`, there. An
// empty global config and no system one keep the user's settings out as well.
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-progress-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

function makeTmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-progress-project-'));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

const ROADMAP = [
  '# Roadmap',
  '',
  '## Checklist',
  '',
  '### Phase one',
  '- [x] step a',
  '- [ ] step b',
  '',
  '### Phase two',
  '- [x] step c',
  '',
].join('\n');

const FEATURE_A = ['# Feature A', '', '## Tasks', '- [x] T1 done', '- [ ] T2 pending', ''].join('\n');
const FEATURE_B = ['# Feature B', '', '## Tasks', '- [x] T1 done', ''].join('\n');

/** Runs `progressMain`, capturing everything written through the injected stdout/stderr writers. */
async function runProgress(argv, opts = {}) {
  const out = [];
  const err = [];
  const stdout = (line) => out.push(line);
  const stderr = (line) => err.push(line);
  const code = await progressMain(argv, { stdout, stderr, ...opts });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

test('progressMain errors with usage on stderr and exits 2 when --cwd is the last argument', async () => {
  const { code, stderr } = await runProgress(['--cwd']);
  assert.equal(code, 2);
  assert.match(stderr, /Usage: js-harness progress/);
});

test('progressMain errors with usage on stderr and exits 2 when --cwd is immediately followed by another flag', async () => {
  const { code, stderr } = await runProgress(['--cwd', '--json']);
  assert.equal(code, 2);
  assert.match(stderr, /Usage: js-harness progress/);
});

test('progressMain exits 1 with a one-line stderr message when neither the roadmap nor odd/tasks exists', async () => {
  const project = makeTmpProject();
  try {
    const { code, stderr, stdout } = await runProgress(['--cwd', project]);
    assert.equal(code, 1);
    assert.equal(stdout, '');
    assert.equal(stderr, `js-harness progress: no docs/ROADMAP.md or odd/tasks/*.md under ${project}`);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain exits 0 and reports roadmap:null when only odd/tasks exists', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'odd', 'tasks', 'a-feature.md'), FEATURE_A);
    const { code, stdout } = await runProgress(['--cwd', project, '--json']);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.equal(data.roadmap, null);
    assert.equal(data.features.length, 1);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain exits 0 and reports features:[] when only docs/ROADMAP.md exists', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    const { code, stdout } = await runProgress(['--cwd', project, '--json']);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.notEqual(data.roadmap, null);
    assert.deepEqual(data.features, []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain reads odd/tasks/*.md sorted by filename', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'odd', 'tasks', 'b-feature.md'), FEATURE_B);
    writeFile(path.join(project, 'odd', 'tasks', 'a-feature.md'), FEATURE_A);
    const { stdout } = await runProgress(['--cwd', project, '--json']);
    const data = JSON.parse(stdout);
    assert.deepEqual(data.features.map((f) => f.id), ['a-feature', 'b-feature']);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain --json matches the documented shape with repo-relative forward-slash paths and an absolute root', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    writeFile(path.join(project, 'odd', 'tasks', 'a-feature.md'), FEATURE_A);
    const { code, stdout } = await runProgress(['--cwd', project, '--json']);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);

    assert.equal(data.root, path.resolve(project));
    assert.equal(data.roadmap.path, 'docs/ROADMAP.md');
    assert.equal(data.roadmap.done, 2);
    assert.equal(data.roadmap.total, 3);
    assert.deepEqual(data.roadmap.phases[0], {
      title: 'Phase one',
      done: 1,
      total: 2,
      steps: [
        { text: 'step a', done: true },
        { text: 'step b', done: false },
      ],
    });

    assert.deepEqual(data.features, [
      {
        id: 'a-feature',
        title: 'Feature A',
        path: 'odd/tasks/a-feature.md',
        done: 1,
        total: 2,
        steps: [
          { text: 'T1 done', done: true },
          { text: 'T2 pending', done: false },
        ],
      },
    ]);

    // Top-level done/total sum the roadmap and every feature.
    assert.equal(data.done, 3);
    assert.equal(data.total, 5);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain --json prints via JSON.stringify(data, null, 2), not a single-line JSON blob', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    const { stdout } = await runProgress(['--cwd', project, '--json']);
    assert.equal(stdout, JSON.stringify(JSON.parse(stdout), null, 2));
    assert.match(stdout, /\n/);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain text output prints a totals header, a marked line per phase/feature, pending steps under unfinished groups, and a Total line', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    writeFile(path.join(project, 'odd', 'tasks', 'a-feature.md'), FEATURE_A);
    const { code, stdout } = await runProgress(['--cwd', project]);
    assert.equal(code, 0);

    assert.match(stdout, /^Roadmap {2}docs\/ROADMAP\.md {2}2\/3 {2}67%$/m);
    // Phase one is unfinished (1/2): marked [ ], and its pending step is listed under it.
    assert.match(stdout, /^ {2}\[ \] Phase one {2}1\/2 {2}50%$/m);
    assert.match(stdout, /^ {6}- step b$/m);
    // Phase two is finished (1/1): marked [x], and lists no pending steps.
    assert.match(stdout, /^ {2}\[x\] Phase two {2}1\/1 {2}100%$/m);

    assert.match(stdout, /^Features {2}1\/2 {2}50%$/m);
    assert.match(stdout, /^ {2}\[ \] Feature A {2}1\/2 {2}50%$/m);
    assert.match(stdout, /^ {6}- T2 pending$/m);

    assert.match(stdout, /^Total {2}3\/5 {2}60%$/m);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain text output shows an em dash percentage for a group with total 0, never 100%', async () => {
  const project = makeTmpProject();
  try {
    const roadmapWithEmptyPhase = ['## Checklist', '', '### Empty phase', '', ''].join('\n');
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), roadmapWithEmptyPhase);
    const { stdout } = await runProgress(['--cwd', project]);
    assert.match(stdout, /^ {2}\[ \] Empty phase {2}0\/0 {2}—$/m);
    assert.match(stdout, /^Roadmap {2}docs\/ROADMAP\.md {2}0\/0 {2}—$/m);
    assert.match(stdout, /^Total {2}0\/0 {2}—$/m);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain uses the injected default cwd when --cwd is not given', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    const { code, stdout } = await runProgress(['--json'], { cwd: project });
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.equal(data.root, path.resolve(project));
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain resolves the default cwd to real process.cwd() when neither --cwd nor an injected cwd is given', async () => {
  const project = makeTmpProject();
  const previousCwd = process.cwd();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    process.chdir(project);
    const { code, stderr } = await runProgress([]);
    // This fixture dir has a roadmap, so success here proves the fallback reached the real
    // process.cwd() (chdir'd to the fixture), not an empty default.
    assert.equal(code, 0);
    assert.equal(stderr, '');
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- R3-unreadable-entry-crash: only regular files count; a read error is reported, not thrown ---

test('progressMain skips a directory named *.md under odd/tasks and still reads real feature files', async () => {
  const project = makeTmpProject();
  try {
    fs.mkdirSync(path.join(project, 'odd', 'tasks', 'not-a-file.md'), { recursive: true });
    writeFile(path.join(project, 'odd', 'tasks', 'a-feature.md'), FEATURE_A);
    const { code, stdout } = await runProgress(['--cwd', project, '--json']);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.deepEqual(data.features.map((f) => f.id), ['a-feature']);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain reports a feature read error on stderr, skips it, and still exits 0 when another feature was read', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'odd', 'tasks', 'a-feature.md'), FEATURE_A);
    writeFile(path.join(project, 'odd', 'tasks', 'b-feature.md'), FEATURE_B);
    const badPath = path.join(project, 'odd', 'tasks', 'b-feature.md');
    const readFile = (absolute) => {
      if (absolute === badPath) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      }
      return fs.readFileSync(absolute, 'utf8');
    };

    const { code, stdout, stderr } = await runProgress(['--cwd', project, '--json'], { readFile });

    assert.equal(code, 0);
    assert.match(stderr, /odd\/tasks\/b-feature\.md/);
    assert.match(stderr, /EACCES/);
    const data = JSON.parse(stdout);
    assert.deepEqual(data.features.map((f) => f.id), ['a-feature']);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain reports a roadmap read error on stderr, skips it (roadmap: null), and still exits 0 when a feature was read', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    writeFile(path.join(project, 'odd', 'tasks', 'a-feature.md'), FEATURE_A);
    const badPath = path.join(project, 'docs', 'ROADMAP.md');
    const readFile = (absolute) => {
      if (absolute === badPath) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      }
      return fs.readFileSync(absolute, 'utf8');
    };

    const { code, stdout, stderr } = await runProgress(['--cwd', project, '--json'], { readFile });

    assert.equal(code, 0);
    assert.match(stderr, /docs\/ROADMAP\.md/);
    assert.match(stderr, /EACCES/);
    const data = JSON.parse(stdout);
    assert.equal(data.roadmap, null);
    assert.equal(data.features.length, 1);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain exits 1 when the only source present cannot be read at all', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    const badPath = path.join(project, 'docs', 'ROADMAP.md');
    const readFile = (absolute) => {
      if (absolute === badPath) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      }
      return fs.readFileSync(absolute, 'utf8');
    };

    const { code, stderr } = await runProgress(['--cwd', project], { readFile });

    assert.equal(code, 1);
    assert.match(stderr, /EACCES/);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- R3-unknown-args-ignored: anything other than `--cwd <value>` and `--json` is a usage error ---

test('progressMain errors with usage on stderr and exits 2 for an unknown flag', async () => {
  const { code, stderr } = await runProgress(['--bogus']);
  assert.equal(code, 2);
  assert.match(stderr, /Usage: js-harness progress/);
});

test('progressMain errors with usage on stderr and exits 2 for `--cwd=value` (not the two-token `--cwd <value>` form)', async () => {
  const { code, stderr } = await runProgress(['--cwd=/some/path']);
  assert.equal(code, 2);
  assert.match(stderr, /Usage: js-harness progress/);
});

test('progressMain errors with usage on stderr and exits 2 for a bare positional argument', async () => {
  const { code, stderr } = await runProgress(['some-positional']);
  assert.equal(code, 2);
  assert.match(stderr, /Usage: js-harness progress/);
});

test('progressMain errors with usage on stderr and exits 2 for a positional argument after a valid flag', async () => {
  const { code, stderr } = await runProgress(['--json', 'extra']);
  assert.equal(code, 2);
  assert.match(stderr, /Usage: js-harness progress/);
});

// --- R3-symlinked-feature-dropped: a symlinked odd/tasks/*.md counts when its target is a file ---

function trySymlink(target, link, t) {
  try {
    fs.symlinkSync(target, link, 'file');
    return true;
  } catch (err) {
    if (err.code === 'EPERM') {
      t.skip('symlinks need privileges on this machine');
      return false;
    }
    throw err;
  }
}

test('progressMain follows a symlinked feature doc when its target is a real file', async (t) => {
  const project = makeTmpProject();
  const targetDir = makeTmpProject();
  try {
    const target = path.join(targetDir, 'a-feature.md');
    fs.writeFileSync(target, FEATURE_A, 'utf8');
    fs.mkdirSync(path.join(project, 'odd', 'tasks'), { recursive: true });
    const link = path.join(project, 'odd', 'tasks', 'a-feature.md');
    if (!trySymlink(target, link, t)) return;

    const { code, stdout } = await runProgress(['--cwd', project, '--json']);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.deepEqual(data.features.map((f) => f.id), ['a-feature']);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});

test('progressMain reports a dangling symlinked feature doc on stderr (path + code) and skips it', async (t) => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    fs.mkdirSync(path.join(project, 'odd', 'tasks'), { recursive: true });
    const link = path.join(project, 'odd', 'tasks', 'dangling.md');
    const missingTarget = path.join(project, 'does-not-exist.md');
    if (!trySymlink(missingTarget, link, t)) return;

    const { code, stdout, stderr } = await runProgress(['--cwd', project, '--json']);
    assert.equal(code, 0);
    assert.match(stderr, /odd\/tasks\/dangling\.md/);
    assert.match(stderr, /ENOENT/);
    const data = JSON.parse(stdout);
    assert.deepEqual(data.features, []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The two tests above need real symlinks, which Windows refuses without developer mode. These
// inject a symlink-typed entry instead, so the symlink branch of readFeatures runs on every machine.

function symlinkEntry(name) {
  return { name, isFile: () => false, isSymbolicLink: () => true };
}

test('progressMain reads an injected symlink entry whose target is a file', async () => {
  const project = makeTmpProject();
  try {
    const tasks = path.join(project, 'odd', 'tasks');
    const { code, stdout, stderr } = await runProgress(['--cwd', project, '--json'], {
      readdir: (dir) => (dir === tasks ? [symlinkEntry('linked.md')] : fs.readdirSync(dir, { withFileTypes: true })),
      stat: (absolute) => (absolute === path.join(tasks, 'linked.md') ? { isFile: () => true } : fs.statSync(absolute)),
      readFile: (absolute) => (absolute === path.join(tasks, 'linked.md') ? FEATURE_A : fs.readFileSync(absolute, 'utf8')),
    });
    assert.equal(code, 0);
    assert.equal(stderr, '');
    const data = JSON.parse(stdout);
    assert.deepEqual(data.features.map((f) => [f.id, f.done, f.total]), [['linked', 1, 2]]);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain skips an injected symlink entry whose target is a directory, and reports a dangling one', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    const tasks = path.join(project, 'odd', 'tasks');
    const dangling = Object.assign(new Error('missing'), { code: 'ENOENT' });
    const { code, stdout, stderr } = await runProgress(['--cwd', project, '--json'], {
      readdir: (dir) =>
        dir === tasks ? [symlinkEntry('to-dir.md'), symlinkEntry('dangling.md')] : fs.readdirSync(dir, { withFileTypes: true }),
      stat: (absolute) => {
        if (absolute === path.join(tasks, 'to-dir.md')) return { isFile: () => false };
        if (absolute === path.join(tasks, 'dangling.md')) throw dangling;
        return fs.statSync(absolute);
      },
    });
    assert.equal(code, 0);
    assert.match(stderr, /odd\/tasks\/dangling\.md: ENOENT/);
    assert.doesNotMatch(stderr, /to-dir/);
    assert.deepEqual(JSON.parse(stdout).features, []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- R3-unreadable-tasks-dir-silent / Codex P2: only ENOENT means absent; any other discovery
// error on docs/ROADMAP.md or odd/tasks is reported on stderr, and that source is skipped ---

test('progressMain reports a real ENOTDIR when odd/tasks is a file, not a directory, and still reads the roadmap', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    fs.mkdirSync(path.join(project, 'odd'), { recursive: true });
    fs.writeFileSync(path.join(project, 'odd', 'tasks'), 'not a directory', 'utf8');

    const { code, stdout, stderr } = await runProgress(['--cwd', project, '--json']);

    assert.equal(code, 0);
    assert.match(stderr, /odd\/tasks/);
    assert.match(stderr, /ENOTDIR/);
    const data = JSON.parse(stdout);
    assert.notEqual(data.roadmap, null);
    assert.deepEqual(data.features, []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain reports a non-ENOENT stat error on docs/ROADMAP.md via an injected stat, and skips it', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'odd', 'tasks', 'a-feature.md'), FEATURE_A);
    const roadmapPath = path.join(project, 'docs', 'ROADMAP.md');
    const stat = (absolute) => {
      if (absolute === roadmapPath) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return fs.statSync(absolute);
    };

    const { code, stdout, stderr } = await runProgress(['--cwd', project, '--json'], { stat });

    assert.equal(code, 0);
    assert.match(stderr, /docs\/ROADMAP\.md/);
    assert.match(stderr, /EACCES/);
    const data = JSON.parse(stdout);
    assert.equal(data.roadmap, null);
    assert.equal(data.features.length, 1);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain reports a non-ENOENT readdir error on odd/tasks via an injected readdir, and skips it', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    const tasksDir = path.join(project, 'odd', 'tasks');
    const readdir = (absolute) => {
      if (absolute === tasksDir) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return fs.readdirSync(absolute, { withFileTypes: true });
    };

    const { code, stdout, stderr } = await runProgress(['--cwd', project, '--json'], { readdir });

    assert.equal(code, 0);
    assert.match(stderr, /odd\/tasks/);
    assert.match(stderr, /EACCES/);
    const data = JSON.parse(stdout);
    assert.notEqual(data.roadmap, null);
    assert.deepEqual(data.features, []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progressMain never claims "no docs/ROADMAP.md or odd/tasks" when a source exists but failed; it says nothing could be read', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'docs', 'ROADMAP.md'), ROADMAP);
    fs.mkdirSync(path.join(project, 'odd', 'tasks'), { recursive: true });
    const roadmapPath = path.join(project, 'docs', 'ROADMAP.md');
    const tasksDir = path.join(project, 'odd', 'tasks');
    const stat = (absolute) => {
      if (absolute === roadmapPath) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return fs.statSync(absolute);
    };
    const readdir = (absolute) => {
      if (absolute === tasksDir) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return fs.readdirSync(absolute, { withFileTypes: true });
    };

    const { code, stderr } = await runProgress(['--cwd', project], { stat, readdir });

    assert.equal(code, 1);
    const lines = stderr.split('\n');
    assert.ok(lines.some((l) => l.includes('docs/ROADMAP.md') && l.includes('EACCES')));
    assert.ok(lines.some((l) => l.includes('odd/tasks') && l.includes('EACCES')));
    assert.equal(lines[lines.length - 1], `js-harness progress: nothing could be read under ${path.resolve(project)}`);
    assert.ok(!stderr.includes('no docs/ROADMAP.md or odd/tasks'));
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// S2 of odd/tasks/first-version.md: a feature whose tasks are a table no longer shows 0/0.
test('progress counts a feature whose tasks are table rows, and lists its open rows', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'odd', 'tasks', 'tabled.md'), [
      '# Tabled feature',
      '',
      '## Tasks',
      '',
      '| ID | Specs | Route | Status | Evidence |',
      '|----|-------|-------|--------|----------|',
      '| T1 | S1 | inline | done | GREEN 3/3 |',
      '| T2 | S2 | JH 15 | pending | the Bash case |',
      '',
    ].join('\n'));
    const { code, stdout } = await runProgress(['--cwd', project]);
    assert.equal(code, 0);
    assert.match(stdout, /\[ \] Tabled feature\s+1\/2  50%\n {6}- T2 \| S2 \| JH 15 \| pending \| the Bash case/);
    assert.match(stdout, /Total  1\/2  50%/);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- `--pace`: S5 and S6 of odd/tasks/read-from-records.md ---

/** Noon, or `hour`, of `day` days before 2026-10-16 by this machine's calendar; `NOW` is that afternoon. */
const daysAgo = (day, hour = 12) => new Date(2026, 9, 16 - day, hour);
const NOW = daysAgo(0, 15);

/** A git repository in a temporary folder on `main`, whose commits are dated as they are asked to be. */
function makeRepo() {
  const root = makeTmpProject();
  const git = (args, when) => {
    const env = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' };
    if (when !== undefined) env.GIT_AUTHOR_DATE = env.GIT_COMMITTER_DATE = `${Math.floor(when.getTime() / 1000)} +0000`;
    const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  };
  git(['init', '-q', '-b', 'main']);
  git(['config', 'core.autocrlf', 'false']);
  /** Writes `files` (path to content) and commits them at `when`. */
  const commit = (files, when, message = 'change') => {
    for (const [relative, content] of Object.entries(files)) writeFile(path.join(root, relative), content);
    git(['add', '-A']);
    git(['commit', '-q', '--allow-empty', '-m', message], when);
  };
  return { root, git, commit };
}

const doc = (...steps) => ['# F', '', '## Tasks', ...steps, ''].join('\n');

test('progress --pace counts, for each of the last days of main\'s first-parent line, the tasks closed, reopened, added and removed', async () => {
  const { root, git, commit } = makeRepo();
  try {
    // Before the window: the start of the history and a feature with two open tasks.
    commit({ 'README.md': 'x' }, daysAgo(10));
    commit({ 'odd/tasks/f.md': doc('- [ ] T1 a', '- [ ] T2 b') }, daysAgo(9));
    // Two days ago: T1 closed, reworded as it was; a roadmap step added.
    commit({ 'odd/tasks/f.md': doc('- [x] T1 a, done', '- [ ] T2 b'), 'docs/ROADMAP.md': '# R\n\n## Checklist\n\n### One\n- [ ] step\n' }, daysAgo(2));
    // Today: a branch closes T2 and adds T3 already checked, and arrives on main in a merge.
    git(['switch', '-q', '-c', 'side']);
    commit({ 'odd/tasks/f.md': doc('- [x] T1 a, done', '- [x] T2 b', '- [x] T3 c') }, daysAgo(0, 9));
    git(['switch', '-q', 'main']);
    git(['merge', '-q', '--no-ff', '-m', 'merge side', 'side'], daysAgo(0, 10));
    // A file outside the roadmap and the feature documents counts nothing.
    commit({ 'notes/n.md': '- [x] not a task' }, daysAgo(0, 11));
    const { code, stdout, stderr } = await runProgress(['--cwd', root, '--pace', '--days', '3'], { now: () => NOW });
    assert.equal(code, 0, stderr);
    assert.deepEqual(stdout.split('\n'), [
      'Pace of main, its first-parent line, by committer day over the last 3 days:',
      '  2026-10-14  closed 1  reopened 0  added 1  removed 0',
      '  2026-10-15  closed 0  reopened 0  added 0  removed 0',
      '  2026-10-16  closed 2  reopened 0  added 1  removed 0  (today, so far)',
      'Total       closed 3  reopened 0  added 2  removed 0',
      'A day       closed 1  reopened 0  added 0.7  removed 0',
    ]);
    // The same as data, with the branch it read; 14 days when it is not told.
    const json = await runProgress(['--cwd', root, '--pace', '--json'], { now: () => NOW });
    assert.equal(json.code, 0, json.stderr);
    const pace = JSON.parse(json.stdout);
    assert.deepEqual(Object.keys(pace), ['root', 'branch', 'ref', 'days', 'from', 'to', 'perDay', 'total', 'meanPerDay']);
    assert.deepEqual([pace.branch, pace.ref, pace.days, pace.from, pace.to, pace.perDay.length], ['main', 'refs/heads/main', 14, '2026-10-03', '2026-10-16', 14]);
    assert.deepEqual(pace.total, { closed: 3, reopened: 0, added: 4, removed: 0 });
    assert.deepEqual(pace.perDay.find((day) => day.date === '2026-10-07'), { date: '2026-10-07', closed: 0, reopened: 0, added: 2, removed: 0, partial: false });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('progress --pace reads origin/HEAD\'s branch, else main, else HEAD, and says which', async () => {
  const { root, git, commit } = makeRepo();
  try {
    commit({ 'README.md': 'x' }, daysAgo(5));
    commit({ 'odd/tasks/f.md': doc('- [ ] T1 a') }, daysAgo(1));
    // HEAD on another branch with one more task: main is read, not HEAD.
    git(['switch', '-q', '-c', 'work']);
    commit({ 'odd/tasks/f.md': doc('- [ ] T1 a', '- [ ] T2 b') }, daysAgo(0));
    const onMain = JSON.parse((await runProgress(['--cwd', root, '--pace', '--days', '2', '--json'], { now: () => NOW })).stdout);
    assert.deepEqual([onMain.branch, onMain.total.added], ['main', 1]);
    // origin/HEAD, pointing at origin/main, which is behind main: that one is read.
    git(['update-ref', 'refs/remotes/origin/main', 'main~1']);
    git(['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    const onOrigin = await runProgress(['--cwd', root, '--pace', '--days', '2'], { now: () => NOW });
    assert.equal(onOrigin.code, 0, onOrigin.stderr);
    assert.equal(onOrigin.stdout.split('\n')[0], 'Pace of origin/main, its first-parent line, by committer day over the last 2 days:');
    assert.match(onOrigin.stdout, /^Total {7}closed 0 {2}reopened 0 {2}added 0 {2}removed 0$/m);
    // Neither: HEAD.
    git(['symbolic-ref', '--delete', 'refs/remotes/origin/HEAD']);
    git(['branch', '-q', '-m', 'main', 'trunk']);
    const onHead = JSON.parse((await runProgress(['--cwd', root, '--pace', '--days', '2', '--json'], { now: () => NOW })).stdout);
    assert.deepEqual([onHead.branch, onHead.total.added], ['HEAD', 2]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('progress --pace outside a git repository exits 1 with one line, and git that fails or runs too long is said the same way', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'odd', 'tasks', 'f.md'), doc('- [ ] T1 a'));
    const notRepo = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' });
    const outside = await runProgress(['--cwd', project, '--pace'], { now: () => NOW, spawn: notRepo });
    assert.deepEqual([outside.code, outside.stdout], [1, '']);
    assert.equal(outside.stderr, `js-harness progress: --pace reads the history of a git repository, and ${project} is in none`);
    const timedOut = () => ({ error: Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }) });
    const slow = await runProgress(['--cwd', project, '--pace'], { now: () => NOW, spawn: timedOut });
    assert.deepEqual([slow.code, slow.stderr], [1, 'js-harness progress: git for-each-ref took longer than 30 s']);
    // The second process, the history, fails the same way.
    let calls = 0;
    const noCommits = () => (calls++ === 0 ? { status: 0, stdout: '', stderr: '' } : { status: 128, stdout: '', stderr: "fatal: your current branch 'main' does not have any commits yet\n" });
    const empty = await runProgress(['--cwd', project, '--pace'], { now: () => NOW, spawn: noCommits });
    assert.deepEqual([empty.code, empty.stderr], [1, "js-harness progress: git log: fatal: your current branch 'main' does not have any commits yet"]);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('progress without --pace starts no git process, and --json alone keeps its shape', async () => {
  const project = makeTmpProject();
  try {
    writeFile(path.join(project, 'odd', 'tasks', 'f.md'), doc('- [ ] T1 a'));
    const spawn = () => assert.fail('progress without --pace ran git');
    assert.equal((await runProgress(['--cwd', project], { spawn })).code, 0);
    const json = await runProgress(['--cwd', project, '--json'], { spawn });
    assert.deepEqual(Object.keys(JSON.parse(json.stdout)), ['root', 'roadmap', 'features', 'done', 'total']);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('--days takes a whole number of at least 1, and only with --pace; the help names both', async () => {
  for (const argv of [['--pace', '--days', '0'], ['--pace', '--days', '2.5'], ['--pace', '--days', 'x'], ['--pace', '--days'], ['--days', '3']]) {
    const { code, stderr } = await runProgress(argv, { spawn: () => assert.fail('a usage error ran git') });
    assert.equal(code, 2, argv.join(' '));
    assert.match(stderr, /Usage: js-harness progress \[--cwd <path>\] \[--json\] \[--pace \[--days <n>\]\]/);
    assert.match(stderr, /a task reworded without an ID, or in a moved file, counts as removed and added/);
  }
});

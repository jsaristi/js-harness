import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { progressMain } from './progress.mjs';

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

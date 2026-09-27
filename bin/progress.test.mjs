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

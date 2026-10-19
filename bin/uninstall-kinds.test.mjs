// The kinds of `js-harness uninstall` (odd/tasks/uninstall-kinds.md, S3): each one, what it removes and what it
// leaves. Bare `uninstall` and its flags are proven in install.test.mjs and keep their behavior (S4).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installMain, uninstallMain } from './install.mjs';
import { manifestPath, readManifest } from './lib/manifest.mjs';
import { initProject } from './lib/project.mjs';
import { hygieneDir, journalPath } from './lib/memory-hygiene.mjs';
import { repoTemplate } from './lib/git-fixture.testkit.mjs';

// The project scope runs real `git`: isolated from the host's git config and from a hook's GIT_DIR, as in
// install.test.mjs.
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-kinds-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

const emptyRepo = repoTemplate((dir) => {
  const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
});

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/** A spawn that runs `git` for real and stands in for `codegraph`, so `init` never reaches a real binary. */
function fakeCodegraphSpawn() {
  return (cmd, args, opts) => {
    if (cmd === 'git') return spawnSync('git', args, opts);
    if (opts?.cwd) fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
    return { status: 0, stdout: '', stderr: '' };
  };
}

/** A git repository `init` set up, with a file of the project's own beside what `init` wrote. */
function initializedProject() {
  const root = tmp('js-harness-kinds-project-');
  emptyRepo(root);
  fs.writeFileSync(path.join(root, 'index.js'), 'export {};\n');
  assert.equal(initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' }).code, 0);
  return root;
}

function captureConsole(fn) {
  const outLines = [];
  const errLines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => outLines.push(String(line));
  console.error = (line) => errLines.push(String(line));
  return fn()
    .then((code) => ({ code, outLines, errLines }))
    .finally(() => {
      console.log = originalLog;
      console.error = originalError;
    });
}

/** Runs `fn` with `dir` as the current folder, so a kind that acted by location would act there. */
async function inside(dir, fn) {
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

const SKILL = (home) => path.join(home, '.claude', 'skills', 'js-harness', 'SKILL.md');
const SNAPSHOT_STAMP = '20261015T120606108Z';

/** A home with the install, a memory snapshot and a throughput day, as a working machine keeps them. */
async function livedInHome() {
  const home = tmp('js-harness-kinds-home-');
  await captureConsole(() => installMain(['--home', home]));
  const project = path.dirname(journalPath(home, 'C--proj'));
  fs.mkdirSync(path.join(project, 'snapshots', SNAPSHOT_STAMP), { recursive: true });
  fs.writeFileSync(path.join(project, 'snapshots', SNAPSHOT_STAMP, 'manifest.json'), JSON.stringify({ folder: 'C:/memory', writeSet: [], before: {} }));
  fs.mkdirSync(path.join(home, '.js-harness', 'throughput', 'proj'), { recursive: true });
  fs.writeFileSync(path.join(home, '.js-harness', 'throughput', 'proj', '2026-10-17.json'), '{}');
  return { home, snapshot: path.join(project, 'snapshots', SNAPSHOT_STAMP) };
}

/** A spawn that records each call and runs nothing but `git`: the package manager is never real here. */
function recordingSpawn() {
  const calls = [];
  const spawn = (cmd, args, opts) => {
    if (cmd === 'git') return spawnSync('git', args, opts);
    calls.push({ cmd, args });
    return { status: 0, stdout: '', stderr: '' };
  };
  return { spawn, calls };
}

// A pnpm copy under a folder that never exists, so `everything` names pnpm and nothing on this machine is touched.
const PNPM_COPY = path.join(os.tmpdir(), 'js-harness-no-such-folder', 'pnpm', 'global', 'v11', '2bf18-0', 'node_modules', '.pnpm', 'js-harness@x', 'node_modules', 'js-harness', 'bin', 'install.mjs');

const cleanUp = (...dirs) => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
};

test('uninstall machine, run inside a project, removes the machine install and leaves the project, the memory snapshots, the throughput and the program', async () => {
  const { home, snapshot } = await livedInHome();
  const root = initializedProject();
  const { spawn, calls } = recordingSpawn();
  try {
    const { code, outLines, errLines } = await inside(root, () => captureConsole(() => uninstallMain(['machine', '--home', home], {}, { spawn, copyPath: PNPM_COPY })));
    assert.deepEqual([code, errLines], [0, []]);
    assert.equal(fs.existsSync(SKILL(home)), false, 'the skill is removed');
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the machine manifest is removed');
    assert.ok(outLines.includes(`removed ${SKILL(home)}`), outLines.join('\n'));
    assert.equal(fs.existsSync(snapshot), true, 'the memory snapshot stays');
    assert.equal(fs.existsSync(path.join(home, '.js-harness', 'throughput', 'proj', '2026-10-17.json')), true, 'the throughput day stays');
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), true, 'the project is not touched');
    assert.deepEqual(calls, [], 'no package manager ran');
  } finally {
    cleanUp(home, root);
  }
});

test('uninstall snapshots removes the machine install and the memory snapshots, and leaves the throughput and the program', async () => {
  const { home, snapshot } = await livedInHome();
  const { spawn, calls } = recordingSpawn();
  try {
    const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['snapshots', '--home', home], {}, { spawn, copyPath: PNPM_COPY }));
    assert.deepEqual([code, errLines], [0, []]);
    assert.equal(fs.existsSync(SKILL(home)), false, 'the skill is removed');
    assert.equal(fs.existsSync(snapshot), false, 'the memory snapshot is removed');
    assert.equal(fs.existsSync(hygieneDir(home)), false, 'the memory folder is removed');
    assert.ok(outLines.includes(`removed ${path.dirname(path.dirname(snapshot))}: 1 snapshot of a memory pass (${SNAPSHOT_STAMP})`), outLines.join('\n'));
    assert.equal(fs.existsSync(path.join(home, '.js-harness', 'throughput', 'proj', '2026-10-17.json')), true, 'the throughput day stays');
    assert.deepEqual(calls, [], 'no package manager ran');
  } finally {
    cleanUp(home);
  }
});

test('uninstall everything, run inside a project, removes the whole .js-harness folder and the program, and leaves the project', async () => {
  const { home } = await livedInHome();
  const root = initializedProject();
  const { spawn, calls } = recordingSpawn();
  try {
    const { code, outLines, errLines } = await inside(root, () => captureConsole(() => uninstallMain(['everything', '--home', home], {}, { spawn, platform: 'linux', copyPath: PNPM_COPY })));
    assert.deepEqual([code, errLines], [0, []]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nothing of .js-harness is left');
    assert.equal(fs.existsSync(SKILL(home)), false, 'the skill is removed');
    assert.ok(outLines.includes('removed the js-harness program: pnpm remove -g js-harness'), outLines.join('\n'));
    assert.deepEqual(calls, [{ cmd: 'pnpm', args: ['remove', '-g', 'js-harness'] }]);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), true, 'the project is not touched');
  } finally {
    cleanUp(home, root);
  }
});

test('uninstall project removes what init wrote and leaves the project\'s own files and the machine install', async () => {
  const { home } = await livedInHome();
  const root = initializedProject();
  try {
    const { code, outLines } = await captureConsole(() => uninstallMain(['project', '--cwd', root, '--home', home]));
    assert.equal(code, 0, outLines.join('\n'));
    assert.ok(outLines.includes('removed harness.json'), outLines.join('\n'));
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false, 'harness.json is removed');
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false, 'AGENTS.md is removed');
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness', 'manifest.json')), false, 'the project manifest is removed');
    assert.equal(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), 'export {};\n', 'the project\'s own file stays');
    assert.equal(fs.existsSync(SKILL(home)), true, 'the machine skill stays');
    assert.notEqual(readManifest(home), null, 'the machine manifest stays');
  } finally {
    cleanUp(home, root);
  }
});

test('uninstall project, run inside the project with no --cwd, acts on it', async () => {
  const root = initializedProject();
  const home = tmp('js-harness-kinds-home-');
  try {
    const { code } = await inside(root, () => captureConsole(() => uninstallMain(['project', '--home', home])));
    assert.equal(code, 0);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
  } finally {
    cleanUp(home, root);
  }
});

test('uninstall project outside any git repository, or in one init never touched, exits 1, removes nothing and never reaches the machine', async () => {
  const { home } = await livedInHome();
  const plain = tmp('js-harness-kinds-plain-');
  const repo = tmp('js-harness-kinds-repo-');
  emptyRepo(repo);
  try {
    for (const [where, run] of [
      ['outside a repository', () => inside(plain, () => captureConsole(() => uninstallMain(['project', '--home', home])))],
      ['a repository init never touched', () => captureConsole(() => uninstallMain(['project', '--cwd', repo, '--home', home]))],
    ]) {
      const { code, outLines, errLines } = await run();
      assert.equal(code, 1, where);
      assert.deepEqual(outLines, [], where);
      assert.equal(errLines.length, 1, where);
      assert.match(errLines[0], /^not an initialized project: .+; js-harness uninstall machine removes the machine install$/, where);
      assert.equal(fs.existsSync(SKILL(home)), true, `${where}: the machine skill stays`);
    }
  } finally {
    cleanUp(home, plain, repo);
  }
});

test('an unknown kind, or a kind given a scope flag, is a usage error that removes nothing', async () => {
  const { home } = await livedInHome();
  try {
    for (const [argv, message] of [
      [['bogus', '--home', home], 'unknown kind: bogus; one of project, machine, snapshots, everything'],
      [['machine', '--global', '--home', home], 'machine names its own scope: drop --global'],
      [['machine', '--full', '--home', home], 'machine names its own scope: drop --full'],
      [['snapshots', '--everything', '--home', home], 'snapshots names its own scope: drop --everything'],
      [['project', '--global', '--home', home], 'project names its own scope: drop --global'],
      [['everything', '--cwd', home, '--home', home], '--cwd goes with project: everything acts on the machine'],
    ]) {
      const { code, outLines, errLines } = await captureConsole(() => uninstallMain(argv));
      assert.equal(code, 2, argv.join(' '));
      assert.deepEqual(outLines, [], argv.join(' '));
      assert.ok(errLines[0].startsWith(`${message}\n\nUsage: js-harness uninstall`), errLines.join('\n'));
      assert.equal(fs.existsSync(SKILL(home)), true, `${argv.join(' ')}: nothing is removed`);
    }
  } finally {
    cleanUp(home);
  }
});

test('the usage names every kind', async () => {
  const { errLines } = await captureConsole(() => uninstallMain(['bogus']));
  assert.match(errLines[0], /js-harness uninstall project \[--cwd <path>\] \[--home <path>\]/);
  assert.match(errLines[0], /js-harness uninstall machine \| snapshots \| everything \[--home <path>\]/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  initProject,
  gitTopLevel,
  resolveGitPath,
  agentsTemplate,
  runCodegraphInit,
} from './project.mjs';
import { sha256 } from './manifest.mjs';

function makeTmpRepo(prefix = 'js-harness-project-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
  return dir;
}

function makeTmpDir(prefix = 'js-harness-project-nongit-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A spawn that runs `git` for real (tests use real repos) but never touches a real `codegraph`
 * binary — the second argument controls what the fake codegraph call reports. */
function makeSpawn(codegraphResult = { status: 0, stdout: '', stderr: '' }) {
  const codegraphCalls = [];
  const spawn = (cmd, args, opts) => {
    if (cmd === 'git') return spawnSync('git', args, opts);
    codegraphCalls.push({ cmd, args, opts });
    return typeof codegraphResult === 'function' ? codegraphResult(cmd, args, opts) : codegraphResult;
  };
  spawn.codegraphCalls = codegraphCalls;
  return spawn;
}

// --- not a git repository ---

test('initProject outside a git repository writes nothing and reports notGitRepo', () => {
  const dir = makeTmpDir();
  try {
    const before = fs.readdirSync(dir);
    const result = initProject(dir, '0.1.0', { spawn: makeSpawn() });
    assert.equal(result.code, 1);
    assert.equal(result.notGitRepo, true);
    assert.deepEqual(fs.readdirSync(dir), before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- fresh repo: all four actions ---

test('initProject on a fresh repo writes harness.json, AGENTS.md, the pre-commit hook, and runs codegraph init', () => {
  const root = makeTmpRepo();
  try {
    const spawn = makeSpawn({ status: 0, stdout: 'ok', stderr: '' });
    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    // git normalizes `--show-toplevel` to forward slashes even on Windows; compare real paths.
    assert.equal(fs.realpathSync(result.root), fs.realpathSync(root));

    const harnessJsonPath = path.join(root, 'harness.json');
    assert.ok(fs.existsSync(harnessJsonPath));
    const harnessJsonContent = fs.readFileSync(harnessJsonPath, 'utf8');
    assert.deepEqual(JSON.parse(harnessJsonContent), { version: '0.1.0' });
    assert.equal(harnessJsonContent, JSON.stringify({ version: '0.1.0' }, null, 2) + '\n');

    const agentsPath = path.join(root, 'AGENTS.md');
    assert.ok(fs.existsSync(agentsPath));
    assert.match(fs.readFileSync(agentsPath, 'utf8'), new RegExp(`# ${path.basename(root)}`));

    const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
    assert.ok(fs.existsSync(hookPath));
    assert.equal(fs.readFileSync(hookPath, 'utf8'), '#!/bin/sh\n# Written by js-harness init; js-harness uninstall removes it.\nexec js-harness check\n');
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(hookPath).mode & 0o777, 0o755);
    }

    assert.equal(spawn.codegraphCalls.length, 1);

    const wroteActions = result.actions.filter((a) => a.kind === 'wrote');
    const ranActions = result.actions.filter((a) => a.kind === 'ran');
    assert.equal(wroteActions.length, 3);
    assert.equal(ranActions.length, 1);

    // Manifest contents and hashes.
    assert.equal(result.manifest.version, '0.1.0');
    assert.equal(result.manifest.files.length, 3);
    for (const file of result.manifest.files) {
      const abs = path.join(root, ...file.path.split('/'));
      assert.equal(sha256(fs.readFileSync(abs, 'utf8')), file.sha256);
      assert.doesNotMatch(file.path, /\\/);
    }
    assert.deepEqual(result.manifest.kept, []);
    assert.deepEqual(result.manifest.codegraph, { createdDir: true, status: 'ok' });

    assert.ok(fs.existsSync(result.manifestPath));
    assert.deepEqual(JSON.parse(fs.readFileSync(result.manifestPath, 'utf8')), result.manifest);
    assert.equal(result.manifestPath, path.join(root, '.git', 'js-harness', 'manifest.json'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- existing AGENTS.md is kept untouched ---

test('initProject keeps an existing AGENTS.md untouched and lists it in kept', () => {
  const root = makeTmpRepo();
  try {
    const original = '# My project\n\nAlready here.\n';
    fs.writeFileSync(path.join(root, 'AGENTS.md'), original, 'utf8');

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), original);
    assert.ok(!result.manifest.files.some((f) => f.path === 'AGENTS.md'));
    const keptEntry = result.manifest.kept.find((k) => k.path === 'AGENTS.md');
    assert.ok(keptEntry, 'expected AGENTS.md in kept');
    assert.match(keptEntry.reason, /exists/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- existing pre-commit hook is kept untouched ---

test('initProject keeps an existing pre-commit hook untouched and lists it in kept', () => {
  const root = makeTmpRepo();
  try {
    const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    const original = '#!/bin/sh\necho custom\n';
    fs.writeFileSync(hookPath, original, 'utf8');

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(fs.readFileSync(hookPath, 'utf8'), original);
    const keptEntry = result.manifest.kept.find((k) => k.path === '.git/hooks/pre-commit');
    assert.ok(keptEntry, 'expected the pre-commit hook in kept');
    assert.match(keptEntry.reason, /js-harness check/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- core.hooksPath honoured ---

test('initProject writes the pre-commit hook under a custom core.hooksPath', () => {
  const root = makeTmpRepo();
  try {
    const customDir = path.join(root, 'custom-hooks');
    fs.mkdirSync(customDir, { recursive: true });
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom-hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    const hookPath = path.join(customDir, 'pre-commit');
    assert.ok(fs.existsSync(hookPath));
    assert.match(fs.readFileSync(hookPath, 'utf8'), /exec js-harness check/);
    assert.ok(result.manifest.files.some((f) => f.path === 'custom-hooks/pre-commit'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- .codegraph already present: codegraph not spawned ---

test('initProject does not spawn codegraph when .codegraph already exists', () => {
  const root = makeTmpRepo();
  try {
    fs.mkdirSync(path.join(root, '.codegraph'), { recursive: true });
    const spawn = makeSpawn();

    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(spawn.codegraphCalls.length, 0);
    assert.deepEqual(result.manifest.codegraph, { createdDir: false, status: 'exists' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- codegraph spawn failure: reported, exit 0 ---

test('initProject reports a codegraph init failure and still exits 0', () => {
  const root = makeTmpRepo();
  try {
    const spawn = makeSpawn({ status: 1, stdout: '', stderr: 'codegraph: boom' });

    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    assert.deepEqual(result.manifest.codegraph, { createdDir: false, status: 'failed' });
    const problem = result.actions.find((a) => a.kind === 'problem');
    assert.ok(problem, 'expected a reported codegraph problem');
    assert.match(problem.reason, /boom/);
    assert.match(problem.reason, /npm i -g @colbymchenry\/codegraph/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject reports a codegraph spawn error (missing binary) and still exits 0', () => {
  const root = makeTmpRepo();
  try {
    const spawn = makeSpawn({ status: null, error: Object.assign(new Error('spawn codegraph ENOENT'), { code: 'ENOENT' }) });

    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    assert.deepEqual(result.manifest.codegraph, { createdDir: false, status: 'failed' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- already initialized: exit 0, nothing written ---

test('initProject with an existing harness.json writes nothing and reports alreadyInitialized', () => {
  const root = makeTmpRepo();
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({ version: '0.0.9' }, null, 2) + '\n', 'utf8');
    const spawn = makeSpawn();

    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    assert.equal(result.alreadyInitialized, true);
    assert.equal(result.version, '0.0.9');
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness', 'manifest.json')), false);
    assert.equal(spawn.codegraphCalls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- gitTopLevel / resolveGitPath ---

test('gitTopLevel returns null outside a git repository', () => {
  const dir = makeTmpDir();
  try {
    assert.equal(gitTopLevel(dir, spawnSync), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('gitTopLevel resolves the repository root from a subdirectory', () => {
  const root = makeTmpRepo();
  try {
    const sub = path.join(root, 'sub', 'dir');
    fs.mkdirSync(sub, { recursive: true });
    const resolved = gitTopLevel(sub, spawnSync);
    assert.equal(fs.realpathSync(resolved), fs.realpathSync(root));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveGitPath resolves a relative git-path result against root', () => {
  const root = makeTmpRepo();
  try {
    const resolved = resolveGitPath(root, 'hooks/pre-commit', spawnSync);
    assert.equal(resolved, path.join(root, '.git', 'hooks', 'pre-commit'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- agentsTemplate ---

test('agentsTemplate titles the doc with the folder name and stays short', () => {
  const template = agentsTemplate(path.join('some', 'path', 'my-project'));
  assert.match(template, /^<!--.*-->\n# my-project\n/);
  assert.match(template, /## What this project is/);
  assert.match(template, /## How it works/);
  assert.match(template, /## What good looks like/);
  assert.match(template, /## Constraints/);
  // ~250 tokens at ~4 chars/token: comfortably under 1200 chars.
  assert.ok(template.length < 1200, `template is ${template.length} chars`);
});

// --- runCodegraphInit spawn shape ---

test('runCodegraphInit spawns one joined command line with shell:true and no args array on win32, quoting the root', () => {
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '', stderr: '' };
  };
  const root = 'D:\\some dir\\project';
  const result = runCodegraphInit(root, { spawn, platform: 'win32' });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, `codegraph init --yes "${root}"`);
  assert.deepEqual(calls[0].args, []);
  assert.equal(calls[0].opts.shell, true);
});

test('runCodegraphInit spawns plain argv with no shell off win32', () => {
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '', stderr: '' };
  };
  const root = '/some/project';
  const result = runCodegraphInit(root, { spawn, platform: 'linux' });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'codegraph');
  assert.deepEqual(calls[0].args, ['init', '--yes', root]);
  assert.equal(calls[0].opts.shell, false);
});

test('runCodegraphInit reports ok:false with a reason on a non-zero exit', () => {
  const spawn = () => ({ status: 1, stdout: '', stderr: 'boom' });
  const result = runCodegraphInit('/root', { spawn, platform: 'linux' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /boom/);
});

test('runCodegraphInit reports ok:false with a reason when the binary is missing', () => {
  const spawn = () => ({ status: null, error: Object.assign(new Error('spawn codegraph ENOENT'), { code: 'ENOENT' }) });
  const result = runCodegraphInit('/root', { spawn, platform: 'linux' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /ENOENT/);
});

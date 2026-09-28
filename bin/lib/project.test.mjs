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
  InitWriteError,
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
 * binary — the second argument controls what the fake codegraph call reports. A successful call
 * creates `.codegraph` under the spawn's own `cwd` (now the resolved root — see runCodegraphInit's
 * `cwd: root` contract), the same way a real `codegraph init` would, so `createdDir` assertions
 * observe something real instead of an assumption. */
function makeSpawn(codegraphResult = { status: 0, stdout: '', stderr: '' }) {
  const codegraphCalls = [];
  const spawn = (cmd, args, opts) => {
    if (cmd === 'git') return spawnSync('git', args, opts);
    codegraphCalls.push({ cmd, args, opts });
    const result = typeof codegraphResult === 'function' ? codegraphResult(cmd, args, opts) : codegraphResult;
    if (result.status === 0 && opts?.cwd) {
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
    }
    return result;
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
    // T2b R3-manifestpath-assertion-not-realpath: compare real paths, like the root assertion
    // above — git's own output can use forward slashes even on Windows.
    assert.equal(
      fs.realpathSync(result.manifestPath),
      fs.realpathSync(path.join(root, '.git', 'js-harness', 'manifest.json')),
    );
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

// --- T2c item 1: a project manifest survives without harness.json ---

test('initProject refuses to run and writes nothing when a project manifest already exists but harness.json is missing', () => {
  const root = makeTmpRepo();
  try {
    // Simulate a clone that was initialized before and then had harness.json removed by hand (or
    // a partial/failed uninstall), without the manifest itself being touched.
    const manifestDir = path.join(root, '.git', 'js-harness');
    fs.mkdirSync(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, 'manifest.json');
    const staleManifest = {
      version: '0.1.0',
      files: [],
      kept: [],
      codegraph: { createdDir: false, status: 'exists' },
    };
    fs.writeFileSync(manifestPath, JSON.stringify(staleManifest, null, 2) + '\n', 'utf8');
    const before = fs.readdirSync(root);

    const result = initProject(root, '0.2.0', { spawn: makeSpawn() });

    assert.equal(result.code, 1);
    assert.equal(result.staleManifest, true);
    assert.equal(fs.realpathSync(result.manifestPath), fs.realpathSync(manifestPath));
    assert.deepEqual(fs.readdirSync(root), before);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    // The stale manifest itself is untouched.
    assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), staleManifest);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- T2b item 6: --cwd that does not exist ---

test('initProject reports noSuchDirectory when --cwd does not exist, and touches nothing', () => {
  const parent = makeTmpDir();
  const missing = path.join(parent, 'does-not-exist');
  try {
    const result = initProject(missing, '0.1.0', { spawn: makeSpawn() });
    assert.equal(result.code, 1);
    assert.equal(result.noSuchDirectory, true);
    assert.equal(result.cwd, missing);
    assert.equal(fs.existsSync(missing), false);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// --- T2b item 3 / T2c items 2, 3, 6: a core.hooksPath outside the repository is never written to ---

test('initProject keeps (never writes) a pre-commit hook whose core.hooksPath resolves outside the repository', () => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-outside-hooks-');
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', outsideDir], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    // Nothing was written into the outside directory at all.
    assert.deepEqual(fs.readdirSync(outsideDir), []);
    assert.ok(!result.manifest.files.some((f) => f.path.includes('pre-commit')));

    // T2c item 6: an outside `kept` entry carries an absolute, forward-slashed path and `outside: true`.
    const keptEntry = result.manifest.kept.find((k) => k.outside === true);
    assert.ok(keptEntry, 'expected the outside hooks path in kept, marked outside: true');
    assert.deepEqual(Object.keys(keptEntry).sort(), ['outside', 'path', 'reason']);
    assert.doesNotMatch(keptEntry.path, /\\/);
    assert.equal(path.resolve(keptEntry.path.split('/').join(path.sep)), path.join(fs.realpathSync(outsideDir), 'pre-commit'));
    assert.match(keptEntry.reason, /outside the repository/);
    assert.match(keptEntry.reason, /js-harness check/);

    // Every other kept/written entry stays plain (no `outside` field).
    for (const entry of result.manifest.kept) {
      if (entry !== keptEntry) assert.ok(!('outside' in entry));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

// T2c Codex P2: a directory whose name merely starts with ".." (like "..hooks") is not outside.
test('initProject writes the hook when core.hooksPath is a directory merely named with a leading ".."', () => {
  const root = makeTmpRepo();
  try {
    const dotDotDir = path.join(root, '..hooks');
    fs.mkdirSync(dotDotDir, { recursive: true });
    const cfg = spawnSync('git', ['config', 'core.hooksPath', '..hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    const hookPath = path.join(dotDotDir, 'pre-commit');
    assert.ok(fs.existsSync(hookPath));
    assert.match(fs.readFileSync(hookPath, 'utf8'), /exec js-harness check/);
    assert.ok(result.manifest.files.some((f) => f.path === '..hooks/pre-commit'));
    assert.ok(!result.manifest.kept.some((k) => k.outside));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2c Codex P1 symlink: containment must follow symlinks — an in-repo symlink pointing outside
// the repo counts as outside, not inside.
function trySymlinkDir(target, link, t) {
  try {
    fs.symlinkSync(target, link, 'junction');
    return true;
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      t.skip('symlinks need privileges on this machine');
      return false;
    }
    throw err;
  }
}

test('initProject treats an in-repo symlink pointing outside the repo as an outside hooks path', async (t) => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-outside-symlink-');
  try {
    const linkPath = path.join(root, 'hooks-link');
    if (!trySymlinkDir(outsideDir, linkPath, t)) return;

    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'hooks-link'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.deepEqual(fs.readdirSync(outsideDir), []);
    const keptEntry = result.manifest.kept.find((k) => k.outside === true);
    assert.ok(keptEntry, 'expected the symlinked-outside hooks path in kept, marked outside: true');
    assert.equal(
      path.resolve(keptEntry.path.split('/').join(path.sep)),
      path.join(fs.realpathSync(outsideDir), 'pre-commit'),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

// --- T2b item 1: failure atomicity ---

test('initProject rolls back harness.json when the AGENTS.md write throws, and a following run succeeds', () => {
  const root = makeTmpRepo();
  try {
    const before = fs.readdirSync(root);
    const writeFile = (target, content, enc) => {
      if (target.endsWith('AGENTS.md')) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(target, content, enc);
    };

    assert.throws(
      () => initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile }),
      (err) => err instanceof InitWriteError && /EACCES|permission denied/.test(err.message),
    );

    // Byte-identical: nothing this run wrote survives.
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.deepEqual(fs.readdirSync(root), before);

    const retry = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(retry.code, 0);
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject rolls back everything, including a directory it created, when the hook write throws', () => {
  const root = makeTmpRepo();
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'nested/hooks/dir'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0);
    const before = fs.readdirSync(root);

    const writeFile = (target, content, enc) => {
      if (target.endsWith('pre-commit')) throw new Error('disk full');
      fs.writeFileSync(target, content, enc);
    };

    assert.throws(
      () => initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile }),
      (err) => err instanceof InitWriteError && /disk full/.test(err.message),
    );

    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    // The whole `nested/` chain this run created for the hook is gone, not just the hook file.
    assert.equal(fs.existsSync(path.join(root, 'nested')), false);
    assert.deepEqual(fs.readdirSync(root), before);

    const retry = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(retry.code, 0);
    assert.ok(fs.existsSync(path.join(root, 'nested', 'hooks', 'dir', 'pre-commit')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject rolls back a failed manifest write and reports what could not be removed', () => {
  const root = makeTmpRepo();
  try {
    const writeFile = (target, content, enc) => {
      if (target.endsWith('manifest.json')) throw new Error('ENOSPC: no space left on device');
      fs.writeFileSync(target, content, enc);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof InitWriteError);
    assert.match(caught.message, /ENOSPC/);
    assert.deepEqual(caught.notRemoved, []);
    // T2c R3-nothing-left-behind-overclaims: codegraph ran and created .codegraph/ this run, and
    // that is deliberately not rolled back — the error must disclose it, not imply a clean sweep.
    assert.equal(caught.codegraphDirLeftBehind, true);

    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
    // The manifest dir this run created for itself is gone; codegraph (which ran and succeeded
    // before the manifest write failed) is untouched — it never participates in this atomicity,
    // same as a normal codegraph failure never blocks the rest of a run.
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
    assert.ok(fs.existsSync(path.join(root, '.codegraph')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- T2b item 2: codegraph createdDir is observed, not assumed ---

test('initProject records codegraph createdDir as observed on disk, not assumed from a successful exit', () => {
  const root = makeTmpRepo();
  try {
    // Reports success but never actually creates .codegraph — createdDir must reflect reality.
    const spawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync('git', args, opts) : { status: 0, stdout: '', stderr: '' });

    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.deepEqual(result.manifest.codegraph, { createdDir: false, status: 'ok' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- T2b item 2: codegraph retry on an already-initialized project ---

test('initProject retries only codegraph when harness.json exists, the manifest says codegraph failed, and .codegraph is still absent', () => {
  const root = makeTmpRepo();
  try {
    const first = initProject(root, '0.1.0', { spawn: makeSpawn({ status: 1, stdout: '', stderr: 'boom' }), platform: 'linux' });
    assert.deepEqual(first.manifest.codegraph, { createdDir: false, status: 'failed' });
    const agentsBefore = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    const hookBefore = fs.readFileSync(path.join(root, '.git', 'hooks', 'pre-commit'), 'utf8');

    const okSpawn = makeSpawn({ status: 0, stdout: '', stderr: '' });
    const second = initProject(root, '0.1.0', { spawn: okSpawn, platform: 'linux' });

    assert.equal(second.code, 0);
    assert.equal(second.alreadyInitialized, true);
    assert.ok(second.codegraphRetry);
    assert.equal(second.codegraphRetry.ok, true);
    assert.equal(okSpawn.codegraphCalls.length, 1);

    // Every other file is untouched.
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), agentsBefore);
    assert.equal(fs.readFileSync(path.join(root, '.git', 'hooks', 'pre-commit'), 'utf8'), hookBefore);

    const manifestOnDisk = JSON.parse(fs.readFileSync(first.manifestPath, 'utf8'));
    assert.deepEqual(manifestOnDisk.codegraph, { createdDir: true, status: 'ok' });
    assert.deepEqual(manifestOnDisk.files, first.manifest.files);
    assert.deepEqual(manifestOnDisk.kept, first.manifest.kept);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2c R3-retry-manifest-write-unguarded
test('initProject throws InitWriteError when the codegraph-retry manifest update fails', () => {
  const root = makeTmpRepo();
  try {
    initProject(root, '0.1.0', { spawn: makeSpawn({ status: 1, stdout: '', stderr: 'boom' }), platform: 'linux' });

    const okSpawn = makeSpawn({ status: 0, stdout: '', stderr: '' }); // creates .codegraph on success
    const writeFile = (target, content, enc) => {
      if (target.endsWith('manifest.json')) throw new Error('EACCES: permission denied');
      fs.writeFileSync(target, content, enc);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: okSpawn, platform: 'linux', writeFile });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof InitWriteError);
    assert.match(caught.message, /codegraph init ran/);
    assert.match(caught.message, /manifest could not be updated/);
    assert.match(caught.message, /EACCES|permission denied/);
    assert.deepEqual(caught.notRemoved, []);
    // codegraph really ran (the retry's precondition is that .codegraph was absent) and created
    // .codegraph/ this run — the manifest update failing does not roll that back either.
    assert.equal(caught.codegraphDirLeftBehind, true);
    assert.ok(fs.existsSync(path.join(root, '.codegraph')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject reports a second codegraph retry failure and still exits 0', () => {
  const root = makeTmpRepo();
  try {
    initProject(root, '0.1.0', { spawn: makeSpawn({ status: 1, stdout: '', stderr: 'boom' }), platform: 'linux' });

    const stillFailingSpawn = makeSpawn({ status: 1, stdout: '', stderr: 'boom again' });
    const second = initProject(root, '0.1.0', { spawn: stillFailingSpawn, platform: 'linux' });

    assert.equal(second.code, 0);
    assert.equal(second.codegraphRetry.ok, false);
    assert.match(second.codegraphRetry.reason, /boom again/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject does not retry codegraph once .codegraph exists, even after a prior failure', () => {
  const root = makeTmpRepo();
  try {
    initProject(root, '0.1.0', { spawn: makeSpawn({ status: 1, stdout: '', stderr: 'boom' }), platform: 'linux' });
    fs.mkdirSync(path.join(root, '.codegraph'), { recursive: true });

    const spawn = makeSpawn();
    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.alreadyInitialized, true);
    assert.equal(result.codegraphRetry, undefined);
    assert.equal(spawn.codegraphCalls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject does not retry codegraph when the recorded status is not failed', () => {
  const root = makeTmpRepo();
  try {
    fs.mkdirSync(path.join(root, '.codegraph'), { recursive: true }); // present before the first init
    initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true, force: true }); // removed afterward

    const spawn = makeSpawn();
    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.codegraphRetry, undefined);
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
// T2b Codex P2 (shell expansion): the root path is never embedded in the command line — it is
// passed as the child's own `cwd`, with the command always the literal `.` — so a root containing
// spaces or a drive letter can never break shell quoting or be mis-expanded.

test('runCodegraphInit spawns one joined command line with shell:true, no args array, and cwd:root on win32', () => {
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '', stderr: '' };
  };
  const root = 'D:\\some dir\\project';
  const result = runCodegraphInit(root, { spawn, platform: 'win32' });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'codegraph init --yes .');
  assert.deepEqual(calls[0].args, []);
  assert.equal(calls[0].opts.shell, true);
  assert.equal(calls[0].opts.cwd, root);
});

test('runCodegraphInit spawns plain argv with no shell and cwd:root off win32', () => {
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
  assert.deepEqual(calls[0].args, ['init', '--yes', '.']);
  assert.equal(calls[0].opts.shell, false);
  assert.equal(calls[0].opts.cwd, root);
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

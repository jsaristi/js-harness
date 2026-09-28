import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  initProject,
  gitTopLevel,
  resolveGitPath,
  gitDirs,
  agentsTemplate,
  runCodegraphInit,
  InitWriteError,
} from './project.mjs';
import { sha256 } from './manifest.mjs';

// T2e item 8 (R3-tests-depend-on-host-git-config): every test here runs a real `git` (only
// `codegraph` is ever faked), so a real `git init`/`commit`/`worktree add` must not silently pick
// up the *host's* global or system config (a `core.hooksPath`, a signing key, an alias...) and
// change what a test observes. Pointing `GIT_CONFIG_GLOBAL` at an empty file and setting
// `GIT_CONFIG_NOSYSTEM=1` isolates every `git` call this file makes — both the ones tests spawn
// directly and the engine's own default `spawnSync`, which inherits `process.env` the same way.
before(() => {
  // A git hook runs with GIT_DIR, GIT_INDEX_FILE and friends pointing at the repository being
  // committed; inherited here, they would send every git call below to that repository instead
  // of the test's own (a pre-commit run of this suite broke `git worktree add` that way).
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-project-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});

function makeTmpRepo(prefix = 'js-harness-project-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
  return dir;
}

function makeTmpDir(prefix = 'js-harness-project-nongit-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A repo with one commit, so `git worktree add` (which refuses an unborn HEAD) has something to
 * check out. Local `user.name`/`user.email` — the isolated `GIT_CONFIG_GLOBAL` above is empty, so
 * a commit needs its own identity, not the host's. */
function makeTmpRepoWithCommit(prefix = 'js-harness-project-wt-main-') {
  const root = makeTmpRepo(prefix);
  spawnSync('git', ['config', 'user.email', 'js-harness-test@example.invalid'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'js-harness test'], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(path.join(root, 'f.txt'), 'x', 'utf8');
  const add = spawnSync('git', ['add', '.'], { cwd: root, encoding: 'utf8' });
  assert.equal(add.status, 0, `git add failed: ${add.stderr}`);
  const commit = spawnSync('git', ['commit', '-m', 'init'], { cwd: root, encoding: 'utf8' });
  assert.equal(commit.status, 0, `git commit failed: ${commit.stderr}`);
  return root;
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
    // T2e item 6: `.git/hooks` already exists (git creates it on `git init`), so nothing was
    // created for it here — `dirs` stays empty.
    assert.deepEqual(result.manifest.dirs, []);

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

// --- T2e item 1: harness.json is written last, after the manifest ---

test('initProject writes harness.json last, after the manifest\'s temp file, among every write this run makes', () => {
  const root = makeTmpRepo();
  try {
    const writeCalls = [];
    const writeFile = (target, content, options) => {
      writeCalls.push(target);
      fs.writeFileSync(target, content, options);
    };

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile });

    assert.equal(result.code, 0);
    assert.ok(writeCalls.length >= 3, `expected at least 3 writes, got ${writeCalls.length}`);
    const harnessJsonIndex = writeCalls.findIndex((p) => p.endsWith('harness.json'));
    const manifestTmpIndex = writeCalls.findIndex((p) => isManifestTmp(p));
    assert.ok(harnessJsonIndex !== -1, 'expected a harness.json write');
    assert.ok(manifestTmpIndex !== -1, 'expected a manifest .tmp write');
    // harness.json is the very last write of the run, strictly after the manifest's temp write.
    assert.equal(harnessJsonIndex, writeCalls.length - 1);
    assert.ok(manifestTmpIndex < harnessJsonIndex);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject rolls back everything, the manifest included, when the harness.json write throws', () => {
  const root = makeTmpRepo();
  try {
    const before = fs.readdirSync(root);
    const writeFile = (target, content, options) => {
      if (target.endsWith('harness.json')) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(target, content, options);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof InitWriteError);
    assert.match(caught.message, /EACCES|permission denied/);

    // Byte-identical: nothing this run wrote survives — the manifest included, even though it was
    // the very last thing successfully written to disk before the harness.json write threw.
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness', 'manifest.json')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
    assert.deepEqual(fs.readdirSync(root), before);

    const retry = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(retry.code, 0);
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
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
    // T2e item 7: no symlink was involved — `core.hooksPath` itself points outside — so the
    // reason names it, not "a link".
    assert.match(keptEntry.reason, /\(core\.hooksPath\)/);
    assert.doesNotMatch(keptEntry.reason, /a link/);

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
    // T2e item 7: the *configured* path (`hooks-link`) was lexically inside the repo — a symlink
    // is what sent it outside — so the reason names a link, not "(core.hooksPath)".
    assert.match(keptEntry.reason, /a link/);
    assert.doesNotMatch(keptEntry.reason, /core\.hooksPath/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

// --- T2d item 1: dangling symlinks are "occupied", never written through ---

function trySymlink(target, link, type, t) {
  try {
    fs.symlinkSync(target, link, type);
    return true;
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      t.skip('symlinks need privileges on this machine');
      return false;
    }
    throw err;
  }
}

test('initProject keeps a dangling AGENTS.md symlink untouched rather than writing through it', async (t) => {
  const root = makeTmpRepo();
  try {
    const agentsPath = path.join(root, 'AGENTS.md');
    const danglingTarget = path.join(root, 'nowhere-agents.md');
    if (!trySymlink(danglingTarget, agentsPath, 'file', t)) return;

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(danglingTarget), false); // nothing written through the link
    assert.ok(!result.manifest.files.some((f) => f.path === 'AGENTS.md'));
    const keptEntry = result.manifest.kept.find((k) => k.path === 'AGENTS.md');
    assert.ok(keptEntry, 'expected AGENTS.md (a dangling symlink) in kept');
    assert.match(keptEntry.reason, /exists/);
    assert.equal(fs.lstatSync(agentsPath).isSymbolicLink(), true); // the link itself is untouched
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject keeps a dangling pre-commit symlink pointing outside the repo, writing nothing outside', async (t) => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-dangling-outside-');
  try {
    const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    const danglingTarget = path.join(outsideDir, 'does-not-exist');
    if (!trySymlink(danglingTarget, hookPath, 'file', t)) return;

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.deepEqual(fs.readdirSync(outsideDir), []); // nothing written outside
    assert.ok(!result.manifest.files.some((f) => f.path.includes('pre-commit')));
    const keptEntry = result.manifest.kept.find((k) => k.outside === true);
    assert.ok(keptEntry, 'expected the dangling pre-commit symlink to be treated as outside, in kept');
    assert.equal(fs.lstatSync(hookPath).isSymbolicLink(), true); // the link itself is untouched
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('initProject keeps a dangling core.hooksPath symlink, writing nothing outside', async (t) => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-dangling-hooksdir-');
  try {
    const linkPath = path.join(root, 'hooks-link');
    const danglingTarget = path.join(outsideDir, 'nowhere');
    if (!trySymlink(danglingTarget, linkPath, 'dir', t)) return;

    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'hooks-link'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.deepEqual(fs.readdirSync(outsideDir), []); // nothing written outside at all
    assert.ok(!result.manifest.files.some((f) => f.path.includes('pre-commit')));
    const keptEntry = result.manifest.kept.find((k) => k.outside === true);
    assert.ok(keptEntry, 'expected the dangling hooksPath symlink to be treated as outside, in kept');
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
    // T2e item 6: the shallowest directory this run actually created (`nested`, not
    // `nested/hooks/dir`) is recorded in `dirs`, repo-relative like `files`; the manifest's own
    // directory (`.git/js-harness`) is never in there.
    assert.deepEqual(retry.manifest.dirs, [{ path: 'nested' }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2e item 3: the manifest's temp file now has a unique name (`<target>.<pid>.<random>.tmp`), not
// a fixed `<target>.tmp` — every fault-injecting `writeFile` below matches on that looser shape.
const isManifestTmp = (target) => target.includes('manifest.json.') && target.endsWith('.tmp');

test('initProject creates the manifest temp file exclusively (flag: wx) with a unique <pid>.<hex> name, never reused across runs', () => {
  const root = makeTmpRepo();
  try {
    const tmpCalls = [];
    const writeFile = (target, content, options) => {
      if (isManifestTmp(target)) tmpCalls.push({ target, options });
      fs.writeFileSync(target, content, options);
    };

    const first = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile });
    assert.equal(first.code, 0);
    assert.equal(tmpCalls.length, 1);
    assert.deepEqual(tmpCalls[0].options, { encoding: 'utf8', flag: 'wx' });
    const tmpName = path.basename(tmpCalls[0].target);
    assert.match(tmpName, new RegExp(`^manifest\\.json\\.${process.pid}\\.[0-9a-f]+\\.tmp$`));

    // A second run (the codegraph retry path) writes the manifest again, exclusively, under a
    // different unique name — the temp filename is never reused across separate writes.
    const okSpawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
      return { status: 0, stdout: '', stderr: '' };
    };
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true, force: true });
    // Force a retry by marking the prior codegraph run as failed on disk.
    const manifestOnDisk = JSON.parse(fs.readFileSync(first.manifestPath, 'utf8'));
    manifestOnDisk.codegraph = { createdDir: false, status: 'failed' };
    fs.writeFileSync(first.manifestPath, JSON.stringify(manifestOnDisk, null, 2) + '\n', 'utf8');

    const second = initProject(root, '0.1.0', { spawn: okSpawn, platform: 'linux', writeFile });
    assert.equal(second.code, 0);
    assert.equal(tmpCalls.length, 2);
    assert.deepEqual(tmpCalls[1].options, { encoding: 'utf8', flag: 'wx' });
    assert.notEqual(tmpCalls[0].target, tmpCalls[1].target);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2e item 3: `flag: 'wx'` means the temp file is always a brand-new file — a real
// `fs.writeFileSync` (via an injected `writeFile` that just delegates to it, no fault of its own)
// refuses to open a path that already exists, rather than silently overwriting whatever was there.
test('initProject fails, rather than overwrites, when something already sits at the manifest temp path', () => {
  const root = makeTmpRepo();
  try {
    let intercepted = false;
    const writeFile = (target, content, options) => {
      if (isManifestTmp(target) && !intercepted) {
        intercepted = true;
        // Pre-create the exact path this run is about to use for its manifest .tmp file, holding
        // content that must never be silently replaced.
        fs.writeFileSync(target, 'not js-harness content', 'utf8');
      }
      fs.writeFileSync(target, content, options); // delegates to the real fs call either way
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof InitWriteError);
    assert.match(caught.message, /EEXIST/);
    // Nothing this run wrote survives, and the manifest was never actually produced.
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness', 'manifest.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject rolls back a failed manifest write, including .codegraph it created this run, and reports what could not be removed', () => {
  const root = makeTmpRepo();
  try {
    const writeFile = (target, content, options) => {
      if (isManifestTmp(target)) throw new Error('ENOSPC: no space left on device');
      fs.writeFileSync(target, content, options);
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
    // T2e item 2: codegraph ran and created .codegraph/ this run, and the manifest that would have
    // recorded owning it never reached disk — so it is rolled back too, same as everything else.
    assert.deepEqual(caught.notRemoved, []);
    assert.ok(!('codegraphDirLeftBehind' in caught));

    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);

    const retry = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(retry.code, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2e item 2 / R3-cleanup-clause-partial-branches-untested: when the ordinary rollback also fails
// to remove something, and .codegraph/ removal fails too, both show up in `notRemoved`.
test('initProject reports both an ordinary removal failure and a failed .codegraph removal', () => {
  const root = makeTmpRepo();
  try {
    const writeFile = (target, content, options) => {
      if (isManifestTmp(target)) throw new Error('ENOSPC: no space left on device');
      fs.writeFileSync(target, content, options);
    };
    const rm = (target, options) => {
      if (target.endsWith('AGENTS.md') || target.endsWith('.codegraph')) {
        throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
      }
      fs.rmSync(target, options);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile, rm });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof InitWriteError);
    assert.ok(caught.notRemoved.includes('AGENTS.md'));
    assert.ok(caught.notRemoved.includes('.codegraph'));
    assert.equal(caught.notRemoved.length, 2);
  } finally {
    // The injected `rm` above is gone now; use a real one to actually clean up the fixture.
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// R3-cleanup-clause-partial-branches-untested: an ordinary removal failure with no .codegraph
// involved at all (it never ran/created anything this run — pre-existing, so the step is skipped).
test('initProject reports only the ordinary removal failure when .codegraph never participated', () => {
  const root = makeTmpRepo();
  try {
    fs.mkdirSync(path.join(root, '.codegraph'), { recursive: true });
    const writeFile = (target, content, options) => {
      if (isManifestTmp(target)) throw new Error('ENOSPC: no space left on device');
      fs.writeFileSync(target, content, options);
    };
    const rm = (target, options) => {
      if (target.endsWith('AGENTS.md')) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
      fs.rmSync(target, options);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile, rm });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof InitWriteError);
    assert.deepEqual(caught.notRemoved, ['AGENTS.md']);
    // .codegraph/ pre-existed and this run never touched it — nothing to report either way.
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

// T2d Codex P2 codegraph ownership: createdDir is observed on failure too, not hardcoded false.
test('initProject records codegraph createdDir as observed even when the run itself failed', () => {
  const root = makeTmpRepo();
  try {
    // Fails, but not before partially creating .codegraph/ — createdDir must reflect that.
    const spawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
      return { status: 1, stdout: '', stderr: 'boom' };
    };

    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.deepEqual(result.manifest.codegraph, { createdDir: true, status: 'failed' });
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

// T2d Codex P2 codegraph ownership: retry even when .codegraph exists now, if the failed run
// itself is what created it.
test('initProject retries codegraph even when .codegraph exists, if the failed run itself created it', () => {
  const root = makeTmpRepo();
  try {
    // First run: codegraph fails, but not before partially creating .codegraph/.
    const failCreatingSpawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
      return { status: 1, stdout: '', stderr: 'boom' };
    };
    const first = initProject(root, '0.1.0', { spawn: failCreatingSpawn, platform: 'linux' });
    assert.deepEqual(first.manifest.codegraph, { createdDir: true, status: 'failed' });
    assert.ok(fs.existsSync(path.join(root, '.codegraph')));

    // Second run (retry): .codegraph/ still exists — left over from the failed run — but since
    // the manifest says js-harness created it and it failed, the retry still runs.
    const okSpawn = makeSpawn({ status: 0, stdout: '', stderr: '' });
    const second = initProject(root, '0.1.0', { spawn: okSpawn, platform: 'linux' });

    assert.equal(second.code, 0);
    assert.ok(second.codegraphRetry);
    assert.equal(second.codegraphRetry.ok, true);
    assert.equal(okSpawn.codegraphCalls.length, 1);

    const manifestOnDisk = JSON.parse(fs.readFileSync(first.manifestPath, 'utf8'));
    // The directory was already there (from the failed run) and remains there: still createdDir: true.
    assert.deepEqual(manifestOnDisk.codegraph, { createdDir: true, status: 'ok' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2c R3-retry-manifest-write-unguarded + T2d Codex P2 atomic manifest writes
test('initProject throws InitWriteError when the codegraph-retry manifest update fails, removing .codegraph it created this retry, leaving the original manifest byte-identical', () => {
  const root = makeTmpRepo();
  try {
    // The first run's codegraph fails without creating .codegraph/ at all (status 1, and makeSpawn
    // only creates the directory on a successful exit) — so it did not exist before the retry below.
    const first = initProject(root, '0.1.0', { spawn: makeSpawn({ status: 1, stdout: '', stderr: 'boom' }), platform: 'linux' });
    assert.deepEqual(first.manifest.codegraph, { createdDir: false, status: 'failed' });
    const originalBytes = fs.readFileSync(first.manifestPath, 'utf8');

    const okSpawn = makeSpawn({ status: 0, stdout: '', stderr: '' }); // creates .codegraph on success
    const writeFile = (target, content, options) => {
      if (isManifestTmp(target)) throw new Error('EACCES: permission denied');
      fs.writeFileSync(target, content, options);
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
    // T2e item 2: .codegraph/ did not exist before this retry, so its own creation this retry is
    // rolled back too — the failed manifest rewrite is the only record that would have owned it,
    // and that record never reached disk.
    assert.deepEqual(caught.notRemoved, []);
    assert.ok(!('codegraphDirLeftBehind' in caught));
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);

    // T2d Codex P2: the original manifest (from the first, failed run) is exactly what it was —
    // the failed retry write never touched it, and its own uniquely-named .tmp sibling was cleaned
    // up (T2e item 3: the fixed `${manifestPath}.tmp` no longer exists at all, so checking for it
    // specifically would be vacuous — look for *any* leftover .tmp file in the manifest's directory
    // instead).
    assert.equal(fs.readFileSync(first.manifestPath, 'utf8'), originalBytes);
    const leftoverTmp = fs.readdirSync(path.dirname(first.manifestPath)).filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(leftoverTmp, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2e item 2's carve-out: when .codegraph/ already existed *before* this retry — only possible
// because the stale, still-intact manifest already recorded `createdDir: true` from an earlier
// failed run — a failed retry rewrite leaves it alone: that older manifest still truthfully owns it.
test('initProject leaves .codegraph alone when the codegraph-retry manifest update fails but the directory already existed before the retry', () => {
  const root = makeTmpRepo();
  try {
    const failCreatingSpawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
      return { status: 1, stdout: '', stderr: 'boom' };
    };
    const first = initProject(root, '0.1.0', { spawn: failCreatingSpawn, platform: 'linux' });
    assert.deepEqual(first.manifest.codegraph, { createdDir: true, status: 'failed' });
    assert.ok(fs.existsSync(path.join(root, '.codegraph')));

    const okSpawn = makeSpawn({ status: 0, stdout: '', stderr: '' });
    const writeFile = (target, content, options) => {
      if (isManifestTmp(target)) throw new Error('EACCES: permission denied');
      fs.writeFileSync(target, content, options);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: okSpawn, platform: 'linux', writeFile });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof InitWriteError);
    // Never attempted, so no removal failure to report either — this is not "left behind by a
    // failed rollback", it is simply not this retry's to touch.
    assert.deepEqual(caught.notRemoved, []);
    assert.ok(fs.existsSync(path.join(root, '.codegraph')));
    assert.deepEqual(JSON.parse(fs.readFileSync(first.manifestPath, 'utf8')).codegraph, { createdDir: true, status: 'failed' });
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

// --- gitDirs (T2e item 4) ---

test('gitDirs resolves both to the same <root>/.git in an ordinary repository', () => {
  const root = makeTmpRepo();
  try {
    const { gitDir, commonGitDir } = gitDirs(root, spawnSync);
    assert.equal(gitDir, path.join(root, '.git'));
    assert.equal(commonGitDir, path.join(root, '.git'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gitDirs returns null on both when run outside a git repository', () => {
  const dir = makeTmpDir();
  try {
    assert.deepEqual(gitDirs(dir, spawnSync), { gitDir: null, commonGitDir: null });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- worktrees and submodules: the shared hooks directory lives outside the working tree ---
// (T2e item 4, R3-worktree-submodule-hook-misclassified-outside)

test('initProject writes the pre-commit hook into a linked worktree\'s common git dir, recorded absolute with gitDir: true', () => {
  const main = makeTmpRepoWithCommit();
  const worktree = makeTmpDir('js-harness-project-wt-linked-');
  fs.rmSync(worktree, { recursive: true, force: true }); // `git worktree add` needs the path free
  try {
    const add = spawnSync('git', ['worktree', 'add', worktree, '-b', 'js-harness-test-wt'], { cwd: main, encoding: 'utf8' });
    assert.equal(add.status, 0, `git worktree add failed: ${add.stderr}`);

    const result = initProject(worktree, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    // git normalizes to forward slashes; compare real paths, like the fresh-repo test does.
    assert.equal(fs.realpathSync(result.root), fs.realpathSync(worktree));

    const hookInCommonDir = path.join(main, '.git', 'hooks', 'pre-commit');
    assert.ok(fs.existsSync(hookInCommonDir), 'expected the hook in the main repo\'s common git dir');
    assert.equal(fs.existsSync(path.join(worktree, '.git')), true); // the worktree's own (file) .git
    assert.equal(fs.existsSync(path.join(worktree, 'hooks', 'pre-commit')), false); // never here

    const fileEntry = result.manifest.files.find((f) => f.path.endsWith('hooks/pre-commit'));
    assert.ok(fileEntry, 'expected the hook recorded in manifest.files');
    assert.equal(fileEntry.gitDir, true);
    assert.doesNotMatch(fileEntry.path, /\\/);
    assert.ok(path.isAbsolute(fileEntry.path.split('/').join(path.sep)));
    assert.equal(
      fs.realpathSync(fileEntry.path.split('/').join(path.sep)),
      fs.realpathSync(hookInCommonDir),
    );

    const wroteAction = result.actions.find((a) => a.kind === 'wrote' && a.path.endsWith('hooks/pre-commit'));
    assert.equal(wroteAction.gitDir, true);

    // harness.json and AGENTS.md are always in the working tree itself, plain repo-relative.
    for (const f of result.manifest.files) {
      if (f.path.endsWith('harness.json') || f.path.endsWith('AGENTS.md')) assert.ok(!('gitDir' in f));
    }
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: main, encoding: 'utf8' });
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
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

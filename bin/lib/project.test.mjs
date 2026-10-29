import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  initProject,
  uninstallProject,
  syncProject,
  projectLocation,
  gitTopLevel,
  resolveGitPath,
  gitDirs,
  gitDirsAndCommits,
  agentsTemplate,
  templateBlock,
  agentsBlock,
  claudeBlock,
  claudeTemplate,
  runCodegraphInit,
  InitWriteError,
  codeOfName,
} from './project.mjs';
import { sha256 } from './manifest.mjs';
import { repoTemplate } from './git-fixture.testkit.mjs';
import { parseRegister } from './failures.mjs';
import { checkFailures } from '../failures.mjs';
import { estimateTokens } from './payload.mjs';
import { TOKEN_BUDGET } from '../check.mjs';

// T2e item 8 (R3-tests-depend-on-host-git-config): every test here runs a real `git` (only
// `codegraph` is ever faked), so a real `git init`/`commit`/`worktree add` must not silently pick
// up the *host's* global or system config (a `core.hooksPath`, a signing key, an alias...) and
// change what a test observes. Pointing `GIT_CONFIG_GLOBAL` at an empty file and setting
// `GIT_CONFIG_NOSYSTEM=1` isolates every `git` call this file makes — both the ones tests spawn
// directly and the engine's own default `spawnSync`, which inherits `process.env` the same way.
let configDir;
before(() => {
  // A git hook runs with GIT_DIR, GIT_INDEX_FILE and friends pointing at the repository being
  // committed; inherited here, they would send every git call below to that repository instead
  // of the test's own (a pre-commit run of this suite broke `git worktree add` that way).
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-project-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
// The empty git config lives outside the repository, so it is removed with the suite.
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

/** What `git init` makes, made once and copied (`git-fixture.testkit.mjs`): every empty repository here is the same. */
const emptyRepo = repoTemplate((dir) => {
  const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
});

function makeTmpRepo(prefix = 'js-harness-project-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  emptyRepo(dir);
  return dir;
}

/** A repository that holds a program, where the code map resolves on (`codeMap` auto, odd/tasks/on-demand-functions.md):
 * the fixture of every test that expects `codegraph init` to run. An empty repository holds none, so there no index is made. */
function makeCodeRepo(prefix) {
  const dir = makeTmpRepo(prefix);
  fs.writeFileSync(path.join(dir, 'index.js'), '', 'utf8');
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

// T2e item 3: the manifest's temp file has a unique name (`<target>.<pid>.<random>.tmp`), not a
// fixed `<target>.tmp` — every fault-injecting `open` below matches on that looser shape.
const isManifestTmp = (target) => target.includes('manifest.json.') && target.endsWith('.tmp');

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

// odd/tasks/session-title.md, S5: the code a session's title starts with is the project's own identifier.
test('codeOfName offers the initials of a project\'s name as its code', () => {
  assert.equal(codeOfName('js-harness'), 'JH');
  assert.equal(codeOfName('my_big.web app'), 'MBWA');
  assert.equal(codeOfName('one-two-three-four-five'), 'OTTF');
  assert.equal(codeOfName('billing'), 'BI');
  assert.equal(codeOfName('x'), 'X');
  assert.equal(codeOfName('añejo 2'), 'AE2', 'a letter outside ASCII splits the name, and is no initial');
  assert.equal(codeOfName('órale'), 'RA');
  assert.equal(codeOfName('…'), null);
  assert.equal(codeOfName('or-ra-qu'), null, 'ORQ is a lead\'s role, never a code');
});

// --- fresh repo: all four actions ---

test('initProject on a fresh repo writes harness.json, AGENTS.md, the pre-commit hook, and runs codegraph init', () => {
  const root = makeCodeRepo();
  try {
    const spawn = makeSpawn({ status: 0, stdout: 'ok', stderr: '' });
    const result = initProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    // git normalizes `--show-toplevel` to forward slashes even on Windows; compare real paths.
    assert.equal(fs.realpathSync(result.root), fs.realpathSync(root));

    const harnessJsonPath = path.join(root, 'harness.json');
    assert.ok(fs.existsSync(harnessJsonPath));
    const harnessJsonContent = fs.readFileSync(harnessJsonPath, 'utf8');
    // The reply check is on in a new project: his answer 11, "Prendido por defecto" (odd/tasks/rule-hierarchy.md, T9).
    // The project's code is offered from its name (odd/tasks/session-title.md, S5): a session's title carries it.
    const code = codeOfName(path.basename(root));
    assert.match(code, /^[A-Z0-9]+$/);
    assert.deepEqual(JSON.parse(harnessJsonContent), { version: '0.1.0', code, reply: true });
    assert.equal(harnessJsonContent, JSON.stringify({ version: '0.1.0', code, reply: true }, null, 2) + '\n');

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

    // Five files (the failures register and CLAUDE.md among them), the push check of a project with code (its Codex
    // review is on), the style and the denies every clone holds (odd/tasks/f8-s10-port.md, T5), and the two keys of
    // this clone's settings a project of JavaScript with no TypeScript asks for.
    const wroteActions = result.actions.filter((a) => a.kind === 'wrote');
    const ranActions = result.actions.filter((a) => a.kind === 'ran');
    assert.equal(wroteActions.length, 10);
    assert.deepEqual(wroteActions.slice(5).map((a) => a.path), [
      '.git/hooks/pre-push',
      '.claude/settings.local.json#/outputStyle',
      '.claude/settings.local.json#/permissions/deny',
      '.claude/settings.local.json#/env/CODEGRAPH_NO_PROMPT_HOOK',
      '.claude/settings.local.json#/enabledPlugins/typescript-lsp@claude-plugins-official',
    ]);
    assert.equal(ranActions.length, 1);
    // And the line of .atl/ in the clone's exclude file (bin/lib/project-exclude.mjs).
    assert.deepEqual(result.actions.filter((a) => a.kind === 'excluded'), [{ kind: 'excluded', path: '.git/info/exclude', line: '.atl/' }]);

    // Manifest contents and hashes: format 3, since it records the style and the denies every clone holds.
    assert.equal(result.manifest.version, '0.1.0');
    assert.equal(result.manifest.format, 3);
    assert.deepEqual(result.manifest.settings.map((record) => record.key), ['outputStyle', 'denies', 'paste', 'languageServer']);
    assert.equal(result.manifest.files.length, 6);
    for (const file of result.manifest.files) {
      const abs = path.join(root, ...file.path.split('/'));
      assert.equal(sha256(fs.readFileSync(abs, 'utf8')), file.sha256);
      assert.doesNotMatch(file.path, /\\/);
    }
    assert.deepEqual(result.manifest.kept, []);
    assert.deepEqual(result.manifest.codegraph, { createdDir: true, status: 'ok' });
    // T2e item 6: `.git/hooks` already exists (git creates it on `git init`), so nothing was
    // created for it here; `docs`, for the failures register, is the one folder this run made.
    assert.deepEqual(result.manifest.dirs, [{ path: 'docs' }]);

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
    const open = (tmp) => {
      writeCalls.push(tmp);
      return fs.openSync(tmp, 'wx');
    };

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', writeFile, open });

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

// --- the empty failures register (odd/tasks/rule-hierarchy.md, T9; "The failures register") ---

test('initProject writes an empty failures register the register reads with no fault, and records it', () => {
  const root = makeTmpRepo();
  try {
    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(result.code, 0);

    const registerPath = path.join(root, 'docs', 'FAILURES.md');
    const text = fs.readFileSync(registerPath, 'utf8');
    assert.deepEqual(parseRegister(text), { classes: [], entries: [], errors: [] });
    // It says how a class and an entry are written, so the first failure needs no other file to record.
    assert.match(text.replace(/\s+/g, ' '), /declared under "## Classes" as a list item: the id in backticks, then what it means/);
    // The gate's row reads it and passes, as `failures check --settled` would.
    const rows = checkFailures(root);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].pass, true, rows[0].detail);

    const recorded = result.manifest.files.find((file) => file.path === 'docs/FAILURES.md');
    assert.ok(recorded, 'expected docs/FAILURES.md in the manifest');
    assert.equal(recorded.sha256, sha256(text));
    assert.ok(result.actions.some((a) => a.kind === 'wrote' && a.path === 'docs/FAILURES.md'));
    // `docs/` did not exist, so it is a folder this run made, and uninstall removes it while it is empty.
    assert.ok(result.manifest.dirs.some((dir) => dir.path === 'docs'), JSON.stringify(result.manifest.dirs));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject keeps an existing failures register untouched and lists it in kept', () => {
  const root = makeTmpRepo();
  try {
    fs.mkdirSync(path.join(root, 'docs'));
    const original = '# Failures\n\n## Entries\n';
    fs.writeFileSync(path.join(root, 'docs', 'FAILURES.md'), original, 'utf8');

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(fs.readFileSync(path.join(root, 'docs', 'FAILURES.md'), 'utf8'), original);
    assert.ok(!result.manifest.files.some((f) => f.path === 'docs/FAILURES.md'));
    const keptEntry = result.manifest.kept.find((k) => k.path === 'docs/FAILURES.md');
    assert.ok(keptEntry, 'expected docs/FAILURES.md in kept');
    assert.match(keptEntry.reason, /exists/);
    assert.ok(!result.manifest.dirs.some((dir) => dir.path === 'docs'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Codex P2 on e898283: a `docs` that is a link (a junction on Windows) to a folder outside the project would take the
// register outside it, where uninstall then refuses to follow. It is judged as the hooks path is, and never written.
test('initProject never writes the failures register through a docs link that leaves the repository', () => {
  const root = makeTmpRepo();
  const outside = makeTmpDir('js-harness-project-outside-docs-');
  try {
    fs.symlinkSync(outside, path.join(root, 'docs'), 'junction');

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.deepEqual(fs.readdirSync(outside), []);
    assert.ok(!result.manifest.files.some((f) => f.path === 'docs/FAILURES.md'));
    const keptEntry = result.manifest.kept.find((k) => k.outside && /FAILURES\.md$/.test(k.path));
    assert.ok(keptEntry, `expected the register kept as outside: ${JSON.stringify(result.manifest.kept)}`);
    assert.match(keptEntry.reason, /link/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('uninstallProject removes the empty failures register init wrote and the docs folder it made', () => {
  const root = makeTmpRepo();
  try {
    assert.equal(initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' }).code, 0);
    assert.equal(uninstallProject(root, { spawn: spawnSync }).code, 0);
    assert.equal(fs.existsSync(path.join(root, 'docs')), false);
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
  const root = makeCodeRepo();
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
  const root = makeCodeRepo();
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
    assert.deepEqual(retry.manifest.dirs, [{ path: 'docs' }, { path: 'nested' }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject creates the manifest temp file exclusively with a unique <pid>.<hex> name, never reused across runs', () => {
  const root = makeTmpRepo();
  try {
    const opens = [];
    const open = (tmp) => {
      opens.push(tmp);
      return fs.openSync(tmp, 'wx');
    };

    const first = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open });
    assert.equal(first.code, 0);
    assert.equal(opens.length, 1);
    const tmpName = path.basename(opens[0]);
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

    const second = initProject(root, '0.1.0', { spawn: okSpawn, platform: 'linux', open });
    assert.equal(second.code, 0);
    assert.equal(opens.length, 2);
    assert.notEqual(opens[0], opens[1]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2e item 3: `flag: 'wx'` means the temp file is always a brand-new file — the real
// `fs.openSync(path, 'wx')` (via an injected `open` that just delegates to it, no fault of its own)
// refuses to open a path that already exists, rather than silently overwriting whatever was there.
test('initProject fails, rather than overwrites, when something already sits at the manifest temp path', () => {
  const root = makeTmpRepo();
  try {
    // Pre-create the manifest's own directory so it is *not* something this run creates (and so
    // rollback never recursively removes it as a directory chain it owns) — isolates this test to
    // `writeManifestAtomic`'s own foreign-file handling, not the surrounding directory rollback.
    fs.mkdirSync(path.join(root, '.git', 'js-harness'), { recursive: true });

    let tmpPathUsed = null;
    const foreignContent = 'not js-harness content';
    const open = (tmp) => {
      tmpPathUsed = tmp;
      // Pre-create the exact path this run is about to use for its manifest .tmp file, holding
      // content that must never be silently replaced or removed — then let the real exclusive open
      // genuinely fail with EEXIST, the same way it would for any other foreign file.
      fs.writeFileSync(tmp, foreignContent, 'utf8');
      return fs.openSync(tmp, 'wx');
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof InitWriteError);
    assert.match(caught.message, /EEXIST/);
    // Nothing this run wrote survives, and the manifest was never actually produced.
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness', 'manifest.json')), false);
    // T2f item 1 (R3-wx-tmp-cleanup-deletes-foreign-file, Codex P2): this write never created the
    // foreign file at the temp path (the exclusive open itself is what failed), so it must not be
    // the one to remove it either — the pre-existing content survives byte-identical.
    assert.ok(tmpPathUsed, 'expected to have captured the temp path this run tried to use');
    assert.ok(fs.existsSync(tmpPathUsed), 'expected the foreign file at the temp path to survive');
    assert.equal(fs.readFileSync(tmpPathUsed, 'utf8'), foreignContent);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2f item 1: a successfully-created temp file (the exclusive open itself succeeds) *is* this
// write's own responsibility — if the later rename fails, that temp file must be cleaned up.
test('initProject removes its own temp file when the rename after a successful exclusive create fails', () => {
  const root = makeTmpRepo();
  try {
    let tmpPathUsed = null;
    const open = (tmp) => {
      tmpPathUsed = tmp;
      return fs.openSync(tmp, 'wx');
    };
    const originalRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (isManifestTmp(from)) throw new Error('EPERM: simulated rename failure');
      return originalRename(from, to);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    } finally {
      fs.renameSync = originalRename;
    }

    assert.ok(caught instanceof InitWriteError);
    assert.match(caught.message, /EPERM|simulated rename failure/);
    assert.ok(tmpPathUsed, 'expected to have captured the temp path this run created');
    // This write's own temp file — the exclusive create succeeded — is cleaned up on the later
    // rename failure, unlike the foreign-file case above.
    assert.equal(fs.existsSync(tmpPathUsed), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2g R3-001, Codex P2, a regression from T2f: moving the exclusive-create write outside the
// try/catch (so an `EEXIST` failure never deletes a foreign file — the test above) correctly left
// a *failed* create's non-existent tmp alone, but also left a *successful* create's own tmp leaking
// when the failure happens later, filling it (ENOSPC, EIO) — nothing removed it, since the whole
// open+write+close was one opaque call from the outside. Splitting `open` from `write` (see
// `writeManifestAtomic`) lets this be told apart from the EEXIST case above: the open here really
// does succeed (the real `fs.openSync(tmp, 'wx')` genuinely creates the file), so a failure in the
// injected `write` step afterward is unambiguously this call's own file to clean up.
test('initProject removes its own temp file when the write itself fails after a successful exclusive create', () => {
  const root = makeTmpRepo();
  try {
    let tmpPathUsed = null;
    const open = (tmp) => {
      tmpPathUsed = tmp;
      return fs.openSync(tmp, 'wx'); // the exclusive create really happens — this call owns tmp
    };
    const write = () => {
      throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open, write });
      assert.fail('expected initProject to throw');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof InitWriteError);
    assert.match(caught.message, /ENOSPC/);
    assert.ok(tmpPathUsed, 'expected to have captured the temp path this run created');
    assert.equal(fs.existsSync(tmpPathUsed), false);
    assert.deepEqual(caught.notRemoved, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject rolls back a failed manifest write, including .codegraph it created this run, and reports what could not be removed', () => {
  const root = makeTmpRepo();
  try {
    const open = (tmp) => {
      throw new Error('ENOSPC: no space left on device');
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open });
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
  const root = makeCodeRepo();
  try {
    const open = (tmp) => {
      throw new Error('ENOSPC: no space left on device');
    };
    const rm = (target, options) => {
      if (target.endsWith('AGENTS.md') || target.endsWith('.codegraph')) {
        throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
      }
      fs.rmSync(target, options);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open, rm });
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
    const open = (tmp) => {
      throw new Error('ENOSPC: no space left on device');
    };
    const rm = (target, options) => {
      if (target.endsWith('AGENTS.md')) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
      fs.rmSync(target, options);
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open, rm });
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
  const root = makeCodeRepo();
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
  const root = makeCodeRepo();
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
  const root = makeCodeRepo();
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
  const root = makeCodeRepo();
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
  const root = makeCodeRepo();
  try {
    // The first run's codegraph fails without creating .codegraph/ at all (status 1, and makeSpawn
    // only creates the directory on a successful exit) — so it did not exist before the retry below.
    const first = initProject(root, '0.1.0', { spawn: makeSpawn({ status: 1, stdout: '', stderr: 'boom' }), platform: 'linux' });
    assert.deepEqual(first.manifest.codegraph, { createdDir: false, status: 'failed' });
    const originalBytes = fs.readFileSync(first.manifestPath, 'utf8');

    const okSpawn = makeSpawn({ status: 0, stdout: '', stderr: '' }); // creates .codegraph on success
    const open = (tmp) => {
      throw new Error('EACCES: permission denied');
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: okSpawn, platform: 'linux', open });
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
  const root = makeCodeRepo();
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
    const open = (tmp) => {
      throw new Error('EACCES: permission denied');
    };

    let caught;
    try {
      initProject(root, '0.1.0', { spawn: okSpawn, platform: 'linux', open });
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
  const root = makeCodeRepo();
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

/** `spawn`, with the arguments of every process it was asked to start in `asked`. */
function countingSpawn(spawn = spawnSync) {
  const asked = [];
  const counting = (cmd, args, opts) => {
    asked.push([cmd, ...args]);
    return spawn(cmd, args, opts);
  };
  counting.asked = asked;
  return counting;
}

const BOTH_DIRS = ['git', 'rev-parse', '--git-dir', '--git-common-dir'];

test('gitDirs asks git for both directories with one process, in a repository and outside one', () => {
  const root = makeTmpRepo();
  const dir = makeTmpDir();
  try {
    const inside = countingSpawn();
    assert.deepEqual(gitDirs(root, inside), { gitDir: path.join(root, '.git'), commonGitDir: path.join(root, '.git') });
    assert.deepEqual(inside.asked, [BOTH_DIRS]);

    const outside = countingSpawn();
    assert.deepEqual(gitDirs(dir, outside), { gitDir: null, commonGitDir: null });
    assert.deepEqual(outside.asked, [BOTH_DIRS]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('gitDirs gives what asking git for each directory alone gives: at the top of a repository, below it, and in a linked worktree', () => {
  const main = makeTmpRepoWithCommit();
  const worktree = makeTmpDir('js-harness-project-wt-gitdirs-');
  fs.rmSync(worktree, { recursive: true, force: true });
  try {
    const add = spawnSync('git', ['worktree', 'add', worktree, '-b', 'js-harness-test-wt-gitdirs'], { cwd: main, encoding: 'utf8' });
    assert.equal(add.status, 0, `git worktree add failed: ${add.stderr}`);
    fs.mkdirSync(path.join(main, 'below'));
    fs.mkdirSync(path.join(worktree, 'below'));

    // What one flag alone answers in `cwd`, resolved against `cwd` when it is relative. Git 2.54 answers
    // `--git-common-dir` below the top of a repository with a relative path (`../.git`) and `--git-dir`
    // with an absolute one; in a linked worktree both are absolute.
    const alone = (cwd, flag) => {
      const raw = spawnSync('git', ['rev-parse', flag], { cwd, encoding: 'utf8' }).stdout.trim();
      return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
    };
    for (const cwd of [main, path.join(main, 'below'), worktree, path.join(worktree, 'below')]) {
      assert.deepEqual(gitDirs(cwd, spawnSync), { gitDir: alone(cwd, '--git-dir'), commonGitDir: alone(cwd, '--git-common-dir') }, cwd);
    }

    const linked = gitDirs(worktree, spawnSync);
    assert.equal(fs.realpathSync(linked.commonGitDir), fs.realpathSync(path.join(main, '.git')));
    assert.equal(fs.realpathSync(path.dirname(linked.gitDir)), fs.realpathSync(path.join(main, '.git', 'worktrees')));
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: main, encoding: 'utf8' });
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});

test('gitDirs returns null on both, having started one process, when git cannot be started, fails or prints nothing', () => {
  const root = path.resolve('no-such-root');
  const answers = [
    ['a spawn that throws', () => {
      throw new Error('spawn git EACCES');
    }],
    ['a spawn that answers nothing', () => undefined],
    ['git that could not be started', () => ({ status: null, error: new Error('spawn git ENOENT'), stdout: '', stderr: '' })],
    ['git that fails', () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' })],
    ['git that prints nothing', () => ({ status: 0, stdout: '', stderr: '' })],
  ];
  for (const [which, answer] of answers) {
    const spawn = countingSpawn(answer);
    assert.deepEqual(gitDirs(root, spawn), { gitDir: null, commonGitDir: null }, which);
    assert.deepEqual(spawn.asked, [BOTH_DIRS], which);
  }
});

// --- gitDirsAndCommits: both directories and the commits some revs name, from one process ---

test('gitDirsAndCommits gives, from one process, what gitDirs and `rev-parse --verify` of each rev give, and nothing for a rev git may read another way', () => {
  const main = makeTmpRepoWithCommit();
  const worktree = makeTmpDir('js-harness-project-wt-commits-');
  fs.rmSync(worktree, { recursive: true, force: true });
  const inMain = (...args) => {
    const ran = spawnSync('git', args, { cwd: main, encoding: 'utf8' });
    assert.equal(ran.status, 0, `git ${args.join(' ')} failed: ${ran.stderr}`);
    return ran.stdout.trim();
  };
  try {
    fs.writeFileSync(path.join(main, 'f.txt'), 'y', 'utf8');
    inMain('commit', '-am', 'two');
    // A name that is a branch and an annotated tag at once, each of another commit, as a rev may be.
    inMain('branch', 'both', 'HEAD~1');
    inMain('tag', '-a', 'both', '-m', 'both', 'HEAD');
    inMain('worktree', 'add', worktree, '-b', 'js-harness-test-wt-commits', 'HEAD~1');
    const verified = (cwd, rev) => spawnSync('git', ['rev-parse', '--verify', `${rev}^{commit}`], { cwd, encoding: 'utf8' }).stdout.trim();
    const first = verified(main, 'HEAD~1');
    for (const [cwd, rev] of [[main, 'HEAD~1'], [main, 'both'], [main, first.slice(0, 9)], [worktree, 'both']]) {
      const spawn = countingSpawn();
      const commits = [verified(cwd, 'HEAD'), verified(cwd, rev)];
      assert.match(commits.join(' '), /^[0-9a-f]{40,64} [0-9a-f]{40,64}$/, `${cwd} ${rev}`);
      assert.deepEqual(gitDirsAndCommits(cwd, ['HEAD', rev], spawn), { ...gitDirs(cwd, spawnSync), commits }, `${cwd} ${rev}`);
      assert.deepEqual(spawn.asked, [[...BOTH_DIRS, 'HEAD^{commit}', `${rev}^{commit}`]], `${cwd} ${rev}`);
    }
    // No commit, or an argument `rev-parse` takes as its own: with no `--verify` it exits 0 on some of these.
    for (const rev of ['no-such-rev', '', '--all', '--since=yesterday', '--glob=refs/heads/*', 'HEAD~1..HEAD', 'HEAD~1...HEAD', 'HEAD:f.txt']) {
      assert.equal(gitDirsAndCommits(main, ['HEAD', rev], spawnSync), null, `the rev "${rev}"`);
    }
    // A repository with no commit has no HEAD to name.
    const unborn = makeTmpRepo();
    try {
      assert.equal(gitDirsAndCommits(unborn, ['HEAD'], spawnSync), null);
    } finally {
      fs.rmSync(unborn, { recursive: true, force: true });
    }
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: main, encoding: 'utf8' });
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});

test('gitDirsAndCommits takes an answer only when it can be read one way: a line for each directory and each rev, and every rev a full commit id of one length', () => {
  const root = path.resolve('no-such-root');
  const [one, other, long] = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(64)];
  const said = (stdout, more = {}) => () => ({ status: 0, stdout, stderr: '', ...more });
  const whole = `.git\n.git\n${one}\n${other}\n`;
  const dirs = { gitDir: path.join(root, '.git'), commonGitDir: path.join(root, '.git') };
  assert.deepEqual(gitDirsAndCommits(root, ['HEAD', 'base'], said(whole)), { ...dirs, commits: [one, other] });
  assert.deepEqual(gitDirsAndCommits(root, ['HEAD', 'base'], said(`.git\n.git\n${long}\n${long}\n`)), { ...dirs, commits: [long, long] });
  assert.deepEqual(gitDirsAndCommits(root, [], said('.git\n.git\n')), { ...dirs, commits: [] });
  const refused = [
    ['a spawn that throws', () => {
      throw new Error('spawn git EACCES');
    }],
    ['a spawn that answers nothing', () => undefined],
    ['git that could not be started', said(whole, { status: null, error: new Error('spawn git ENOENT') })],
    ['git that fails after the first rev', said(`.git\n.git\n${one}\n`, { status: 128 })],
    ['git that fails and still prints every line', said(whole, { status: 1 })],
    ['an answer that is bytes', said(Buffer.from(whole))],
    ['an answer that is a number', said(7)],
    ['an answer that is nothing', said('')],
    ['a line short', said(`.git\n.git\n${one}\n`)],
    ['a line more', said(`${whole}${one}\n`)],
    ['a last line that does not end', said(whole.slice(0, -1))],
    ['an argument printed back', said(`.git\n.git\n${one}\n--all^{commit}\n`)],
    ['an abbreviated id', said(`.git\n.git\n${one}\n${other.slice(0, 12)}\n`)],
    ['a commit that is excluded', said(`.git\n.git\n${one}\n^${other}\n`)],
    ['an id in capitals', said(`.git\n.git\n${one}\n${other.toUpperCase()}\n`)],
    ['ids of two lengths', said(`.git\n.git\n${one}\n${long}\n`)],
    ['lines that end as another system ends them', said(whole.replace(/\n/g, '\r\n'))],
    ['a directory that is an empty line', said(`.git\n\n${one}\n${other}\n`)],
  ];
  for (const [which, answer] of refused) {
    const spawn = countingSpawn(answer);
    assert.equal(gitDirsAndCommits(root, ['HEAD', 'base'], spawn), null, which);
    assert.deepEqual(spawn.asked, [[...BOTH_DIRS, 'HEAD^{commit}', 'base^{commit}']], which);
  }
});

// A folder name may hold a line break where the file system allows one, and then the two paths do not
// come back as two lines: each directory is asked for alone, as it was before one process asked for both.
test('gitDirs asks for each directory alone when the one answer is not two lines', () => {
  const root = path.resolve('no-such-root');
  const answerOf = {
    '--git-dir --git-common-dir': '/tmp/a\nb/.git/worktrees/w\n/tmp/a\nb/.git\n',
    '--git-dir': '/tmp/a\nb/.git/worktrees/w\n',
    '--git-common-dir': 'common\n',
  };
  const spawn = countingSpawn((cmd, args) => ({ status: 0, stdout: answerOf[args.slice(1).join(' ')], stderr: '' }));
  const { gitDir, commonGitDir } = gitDirs(root, spawn);
  assert.equal(gitDir, '/tmp/a\nb/.git/worktrees/w');
  assert.equal(commonGitDir, path.join(root, 'common'));
  assert.deepEqual(spawn.asked, [BOTH_DIRS, ['git', 'rev-parse', '--git-dir'], ['git', 'rev-parse', '--git-common-dir']]);
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

// --- T2f item 2 (Codex P2): shallowestMissingAncestor must bound its climb by the base that
// actually contains the directory (working tree, git dir, or common git dir), not always the
// working tree — otherwise, for a multi-level missing chain inside a git dir outside the working
// tree, only the deepest directory is recorded, and its newly created parents leak on rollback or
// uninstall. ---

test('initProject records the shallowest created directory chain in an outside git dir, not just the deepest', () => {
  const main = makeTmpRepoWithCommit();
  const worktree = makeTmpDir('js-harness-project-wt-deepdirs-');
  fs.rmSync(worktree, { recursive: true, force: true });
  try {
    const add = spawnSync('git', ['worktree', 'add', worktree, '-b', 'js-harness-test-wt-deepdirs'], { cwd: main, encoding: 'utf8' });
    assert.equal(add.status, 0, `git worktree add failed: ${add.stderr}`);

    const { commonGitDir } = gitDirs(worktree, spawnSync);
    const hooksDir = path.join(commonGitDir, 'custom', 'nested', 'hooks');
    assert.equal(fs.existsSync(path.join(commonGitDir, 'custom')), false); // both levels missing
    const cfg = spawnSync('git', ['config', 'core.hooksPath', hooksDir], { cwd: worktree, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(worktree, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.ok(fs.existsSync(path.join(hooksDir, 'pre-commit')));
    // The shallowest directory this run created (`custom`), not the deepest (`custom/nested/hooks`).
    const expectedShallowest = path.join(commonGitDir, 'custom').split(path.sep).join('/');
    assert.deepEqual(result.manifest.dirs, [{ path: 'docs' }, { path: expectedShallowest, gitDir: true }]);
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: main, encoding: 'utf8' });
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});

test('initProject rolls back the whole created directory chain in an outside git dir, not just the deepest directory', () => {
  const main = makeTmpRepoWithCommit();
  const worktree = makeTmpDir('js-harness-project-wt-deepdirs-rb-');
  fs.rmSync(worktree, { recursive: true, force: true });
  try {
    const add = spawnSync('git', ['worktree', 'add', worktree, '-b', 'js-harness-test-wt-deepdirs-rb'], { cwd: main, encoding: 'utf8' });
    assert.equal(add.status, 0, `git worktree add failed: ${add.stderr}`);

    const { commonGitDir } = gitDirs(worktree, spawnSync);
    const hooksDir = path.join(commonGitDir, 'custom', 'nested', 'hooks');
    const cfg = spawnSync('git', ['config', 'core.hooksPath', hooksDir], { cwd: worktree, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const open = (tmp) => {
      throw new Error('ENOSPC: no space left on device');
    };

    assert.throws(
      () => initProject(worktree, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open }),
      (err) => err instanceof InitWriteError,
    );

    // The whole chain this run created (custom, custom/nested, custom/nested/hooks) is gone, not
    // just the deepest directory.
    assert.equal(fs.existsSync(path.join(commonGitDir, 'custom')), false);
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: main, encoding: 'utf8' });
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});

// --- T2g R3-002, Codex P2, a regression from T2f: `shallowestMissingAncestor` climbed the
// *lexical* hooks directory against a *real* (`fs.realpathSync`-resolved) base using a plain,
// case-sensitive `startsWith` — so whenever the two disagreed only on case (or an 8.3 short name),
// the climb stopped on its very first check, recording just the deepest directory. This affects the
// ordinary working-tree case too, not just an outside git dir. ---

test('initProject records the shallowest created directory chain even when the hooks path differs only by case from the real root (win32)', (t) => {
  if (process.platform !== 'win32') {
    t.skip('case folding only matters on win32, where the filesystem is case-insensitive');
    return;
  }
  const root = makeTmpRepo();
  try {
    const realRoot = fs.realpathSync(root);
    // An absolute core.hooksPath built from an uppercased copy of the real root: `isWithinBase`
    // (used by `resolveHookContainment`'s own containment check) already folds case, so this is
    // correctly seen as inside the repo — but the *directory-creation climb*, before this fix,
    // compared this same lexical (uppercased) path against the properly-cased real root with a
    // case-sensitive `startsWith`, which never matched, so it never climbed past the deepest
    // missing directory.
    const casedRoot = realRoot.toUpperCase();
    assert.notEqual(casedRoot, realRoot, 'expected the real root to contain a lowercase letter to flip');
    const hooksDir = path.join(casedRoot, 'custom', 'nested', 'hooks');
    assert.equal(fs.existsSync(path.join(realRoot, 'custom')), false); // both levels missing
    const cfg = spawnSync('git', ['config', 'core.hooksPath', hooksDir], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.ok(fs.existsSync(path.join(realRoot, 'custom', 'nested', 'hooks', 'pre-commit')));
    // The shallowest directory this run created (`custom`), not the deepest
    // (`custom/nested/hooks`) — the case mismatch must not stop the climb early. This is the
    // ordinary working tree, so the manifest records it repo-relative, same as `files`.
    assert.deepEqual(result.manifest.dirs, [{ path: 'docs' }, { path: 'custom' }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject rolls back the whole created directory chain even when the hooks path differs only by case from the real root (win32)', (t) => {
  if (process.platform !== 'win32') {
    t.skip('case folding only matters on win32, where the filesystem is case-insensitive');
    return;
  }
  const root = makeTmpRepo();
  try {
    const realRoot = fs.realpathSync(root);
    const casedRoot = realRoot.toUpperCase();
    const hooksDir = path.join(casedRoot, 'custom', 'nested', 'hooks');
    const cfg = spawnSync('git', ['config', 'core.hooksPath', hooksDir], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const open = (tmp) => {
      throw new Error('ENOSPC: no space left on device');
    };

    assert.throws(
      () => initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', open }),
      (err) => err instanceof InitWriteError,
    );

    // The whole chain this run created (custom, custom/nested, custom/nested/hooks) is gone, not
    // just the deepest directory — without the fix, only the deepest would ever have been tracked
    // (and removed), leaking `custom` and `custom/nested` behind.
    assert.equal(fs.existsSync(path.join(realRoot, 'custom')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2g R3-003: an 8.3 short-name mismatch (the other reported way `os.tmpdir()` can disagree with
// `fs.realpathSync` on Windows) cannot be constructed on this machine — verified empirically before
// writing this test: `os.tmpdir()`, `fs.realpathSync(os.tmpdir())`, and
// `fs.realpathSync.native(os.tmpdir())` are all byte-identical here (no `~1`-style component), and a
// freshly `mkdtempSync`-created directory under it round-trips through `fs.realpathSync` unchanged
// too. `fsutil 8dot3name query` (volume-level) requires elevation this account does not have, but
// that is moot: the practical question — does *this* host's TEMP directory ever hand back a short
// name — is already answered, empirically, by the above. The case-folding tests above are the
// closest reproduction available on this host for the same underlying bug class (a lexical path
// disagreeing with its own real form).
test('initProject: 8.3 short-name mismatch cannot be reproduced on this host (documented, not skipped silently)', (t) => {
  t.skip(
    'os.tmpdir(), fs.realpathSync(os.tmpdir()), and fs.realpathSync.native(os.tmpdir()) are identical ' +
      'on this machine — no 8.3 short-name component to reproduce the mismatch with, and a volume-level ' +
      'fsutil 8dot3name query needs elevation this account lacks',
  );
});

// --- T2f item 3 (R3-realish-base-detection-equality-only): symlink-hop counting must start as
// soon as the walk is at or below a base, checked after each hop as well as at segment starts, and
// using the same at-or-below containment test everywhere else — not exact string equality with a
// base, which misses a hop that lands (or chains through) a proper descendant of a base without
// ever touching its exact path. ---

test('initProject does not treat a junction above the repository root as occupying the hook', async (t) => {
  const root = makeTmpRepo();
  const outerJunction = makeTmpDir('js-harness-project-outerlink-');
  fs.rmSync(outerJunction, { recursive: true, force: true });
  try {
    // core.hooksPath points *through* a junction that sits above (a sibling route back into) the
    // repository root, landing on an ordinary subdirectory of the repo itself — the junction's own
    // source position is outside every base, so it must never count as occupying anything inside.
    const parentOfRoot = path.dirname(root);
    if (!trySymlinkDir(parentOfRoot, outerJunction, t)) return;

    const hooksPath = path.join(outerJunction, path.basename(root), 'somehooksdir');
    const cfg = spawnSync('git', ['config', 'core.hooksPath', hooksPath], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    const realHookPath = path.join(root, 'somehooksdir', 'pre-commit');
    assert.ok(fs.existsSync(realHookPath), 'expected the hook to be written through, not kept as occupied');
    const wroteAction = result.actions.find((a) => a.kind === 'wrote' && a.path.includes('somehooksdir'));
    assert.ok(wroteAction, 'expected a wrote action for the hook, not kept as occupied');
    assert.ok(!('gitDir' in wroteAction)); // it resolves back inside the working tree
    assert.ok(!result.manifest.kept.some((k) => k.path.includes('somehooksdir')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outerJunction, { recursive: true, force: true });
  }
});

test('initProject treats a junction below the root, inside the hooks path, as occupying the hook', async (t) => {
  const root = makeTmpRepo();
  const target = path.join(root, 'real-hooks-target');
  fs.mkdirSync(target, { recursive: true });
  const linkedHooks = path.join(root, 'linked-hooks');
  try {
    if (!trySymlinkDir(target, linkedHooks, t)) return;

    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'linked-hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(target, 'pre-commit')), false); // never written through it
    const keptEntry = result.manifest.kept.find((k) => k.path === 'linked-hooks/pre-commit');
    assert.ok(keptEntry, 'expected the hook kept as occupied because of the junction in its path');
    assert.ok(!keptEntry.outside);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject counts a symlink hop that lands at or below a base even though it never touches the base\'s exact path', async (t) => {
  const root = makeTmpRepo();
  const actualHooks = path.join(root, 'actual-hooks');
  fs.mkdirSync(actualHooks, { recursive: true });
  const nestedLink = path.join(root, 'nested-link'); // a junction fully inside root, one hop from actualHooks
  const outsideDir = makeTmpDir('js-harness-project-chainhop-outside-');
  const entry = path.join(outsideDir, 'entry'); // a junction whose *source* is outside every base
  try {
    if (!trySymlinkDir(actualHooks, nestedLink, t)) return;
    if (!trySymlinkDir(nestedLink, entry, t)) return;

    const cfg = spawnSync('git', ['config', 'core.hooksPath', entry], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    // `entry` chains to `nested-link` (still being resolved for the *same* segment) to
    // `actual-hooks`: the first hop's source (`entry`) is outside every base, so it must not count
    // on its own — but the moment it lands on `nested-link`, that position is a base's descendant,
    // and `nested-link` is *itself* a symlink, which must count from there on, even though `current`
    // was never exactly equal to `root` (or any base) at any point in this walk. (Not asserting the
    // exact recorded `path` shape here: `core.hooksPath` is configured from *outside* the repo but
    // resolves back inside it, an exotic combination the manifest's repo-relative-vs-absolute
    // choice — keyed off the lexical, unresolved hooksPath rather than its resolution — was never
    // designed for; out of scope for this fix, which is only about `hadSymlink` detection.)
    assert.equal(fs.existsSync(path.join(actualHooks, 'pre-commit')), false);
    assert.equal(result.manifest.kept.length, 1);
    assert.ok(!result.manifest.kept[0].outside);
    assert.ok(!result.actions.some((a) => a.kind === 'wrote' && a.path.includes('pre-commit')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

// --- T2f item 4 (R3-gitdir-occupied-and-submodule-untested) ---

test('initProject keeps a pre-commit hook that already exists in an outside git dir (a linked worktree\'s common git dir)', () => {
  const main = makeTmpRepoWithCommit();
  const worktree = makeTmpDir('js-harness-project-wt-existing-hook-');
  fs.rmSync(worktree, { recursive: true, force: true });
  try {
    const add = spawnSync('git', ['worktree', 'add', worktree, '-b', 'js-harness-test-wt-existing'], { cwd: main, encoding: 'utf8' });
    assert.equal(add.status, 0, `git worktree add failed: ${add.stderr}`);

    const existingHookPath = path.join(main, '.git', 'hooks', 'pre-commit');
    const original = '#!/bin/sh\necho custom\n';
    fs.writeFileSync(existingHookPath, original, 'utf8');

    const result = initProject(worktree, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    assert.equal(fs.readFileSync(existingHookPath, 'utf8'), original); // untouched

    const keptAction = result.actions.find((a) => a.kind === 'kept' && a.path.endsWith('hooks/pre-commit'));
    assert.ok(keptAction, 'expected a kept action for the existing hook');
    assert.equal(keptAction.gitDir, true);
    assert.ok(!('outside' in keptAction));

    const keptEntry = result.manifest.kept.find((k) => k.path.endsWith('hooks/pre-commit'));
    assert.ok(keptEntry, 'expected the existing hook recorded in manifest.kept');
    assert.equal(keptEntry.gitDir, true);
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: main, encoding: 'utf8' });
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});

test('initProject writes the pre-commit hook into a submodule\'s git dir under the superproject, recorded absolute with gitDir: true', () => {
  const superRepo = makeTmpRepoWithCommit('js-harness-project-super-');
  const subRepo = makeTmpRepoWithCommit('js-harness-project-sub-');
  try {
    const add = spawnSync(
      'git',
      ['-c', 'protocol.file.allow=always', 'submodule', 'add', subRepo.split(path.sep).join('/'), 'sub'],
      { cwd: superRepo, encoding: 'utf8' },
    );
    assert.equal(add.status, 0, `git submodule add failed: ${add.stderr}`);

    const subPath = path.join(superRepo, 'sub');
    const result = initProject(subPath, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });

    assert.equal(result.code, 0);
    const hookInSuperGitModules = path.join(superRepo, '.git', 'modules', 'sub', 'hooks', 'pre-commit');
    assert.ok(fs.existsSync(hookInSuperGitModules), 'expected the hook under the superproject\'s .git/modules/sub');

    const fileEntry = result.manifest.files.find((f) => f.path.endsWith('hooks/pre-commit'));
    assert.ok(fileEntry, 'expected the hook recorded in manifest.files');
    assert.equal(fileEntry.gitDir, true);
    assert.equal(
      fs.realpathSync(fileEntry.path.split('/').join(path.sep)),
      fs.realpathSync(hookInSuperGitModules),
    );
  } finally {
    fs.rmSync(superRepo, { recursive: true, force: true });
    fs.rmSync(subRepo, { recursive: true, force: true });
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
  // The template loads on every turn of the project, so it takes at most half the budget `check` holds
  // AGENTS.md to, and leaves the other half to the project's own lines.
  const tokens = estimateTokens(template);
  assert.ok(tokens <= TOKEN_BUDGET / 2, `template is ${tokens} estimated tokens, over ${TOKEN_BUDGET / 2}`);
});

// odd/tasks/rule-hierarchy.md, T9: the lines of this repository's AGENTS.md that hold in any project (items 1 to 4
// and 6 of "`AGENTS.md`, rewritten"), worded for any owner. Read with the wrapping undone, so a line may wrap anywhere.
test('agentsTemplate carries the lines that hold in any project', () => {
  const text = (agentsTemplate('project') + claudeTemplate()).replace(/\s+/g, ' ');
  // Item 1: the six principles once, with the meaning of done.
  assert.match(text, /Work here is done properly, not to comply: no shortcut; under the agreed protocols; nothing stated that was not checked; what is passed on is complete and true; and each mistake leaves a control, of the smallest kind that does the job\./);
  assert.match(text, /A rule is not recorded until it has its place in a check, a line of this file or a protocol\./);
  // Item 2: what is the owner's, asked one at a time; the rest is decided and goes on.
  assert.match(text, /The owner decides spend outside the plan, anything installed or changed on a machine, a product choice, what cannot be undone, a change of the plan or of its order, a new protocol, and a report published outside this project\./);
  assert.match(text, /Ask those one at a time, never while work runs, naming which it is, as `rule:questions-one-place` says\./);
  // Item 3: the owner's wording is the need.
  assert.match(text, /The owner's wording is the need, not the specification: an answer to a proposal of theirs says the need that was understood, what would be done differently from their words and why, and what it costs or is not known; only then is it recorded\./);
  // Item 4: every claim is one of three; a report from elsewhere is a claim.
  assert.match(text, /A finding arrives with the evidence that proves it, and every claim is checked, assumed or not known, as `js-harness-protocols` section 6 says\./);
  assert.match(text, /Everything else is decided and its cost said, as `js-harness-protocols` section 1 says, and the work goes on\./);
  // Item 6: a reply ends with one of five states.
  assert.match(text, /A reply ends in one of the five states of `js-harness-protocols` section 2\./);
  // Items 5, 7 and 8 are rules for building the harness and stay in its own AGENTS.md only.
  assert.doesNotMatch(text, /One session, one feature|consent|judged twice/i);
});

// The double review (odd/tasks/rule-hierarchy.md, T18a): a copy of the rule whose home is the protocols
// skill, kept because a project's CLAUDE.md is read by hosts that load no skill.
test('claudeTemplate asks for two readers before a design is built or a proposal reaches the owner', () => {
  const text = claudeTemplate().replace(/\s+/g, ' ');
  assert.match(text, /A design before it is built, and a plan, an analysis with figures or a protocol put to the owner, first passes two readers that did not write it: one attacks its claims, one looks only for what is missing\./);
  assert.match(text, /The owner gets the improved version, with what each reader changed and what stays unguaranteed\./);
});

// One text for a project with code and one without (odd/tasks/on-demand-functions.md, slice 2): what proves
// a change is a test where there is code to test, and the evidence where the work is a finding.
test('agentsTemplate serves a project with code and one without', () => {
  const template = agentsTemplate('project');
  assert.match(template, /<where the work lives: the code, the data, the documents>/);
  assert.match(template, /A finding arrives with the evidence that proves it, and every claim is checked, assumed or not known,/);
  assert.doesNotMatch(template, /A behavior change arrives with the test/, 'AGENTS.md keeps the test-first line; the block does not');
});

// His answer to question 104 (odd/tasks/f8-s11-complements.md, L14, 2026-10-28), in place of his answer to question 4
// of odd/tasks/on-demand-functions.md: with the Codex review off, the Claude lens review stays on, naming no tier.
test('agentsTemplate writes the rule of a project whose Codex review is off', () => {
  const template = agentsTemplate('project');
  assert.match(template, /^Where the Codex review is off \(`js-harness functions`\), the Claude lens review stays on: the merge\ndoor asks for its record before a change lands\.$/m);
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

// codegraph writes a telemetry queue and an update-check cache under the home on `init` unless DO_NOT_TRACK is set
// (measured on codegraph 1.6.0: `.codegraph/telemetry-queue.jsonl` and `.codegraph/telemetry.json`). No manifest
// records them, so `uninstall --global` left them (docs/FAILURES.md, init-leaves-codegraph-files): the harness asks
// it to write nothing there, on both spawn shapes, and keeps the rest of the environment.
test('runCodegraphInit runs codegraph with DO_NOT_TRACK=1, so it writes nothing under the home, on every platform', () => {
  for (const platform of ['win32', 'linux']) {
    const calls = [];
    const spawn = (cmd, args, opts) => {
      calls.push(opts);
      return { status: 0, stdout: '', stderr: '' };
    };
    runCodegraphInit('/some/project', { spawn, platform });
    assert.equal(calls[0].env.DO_NOT_TRACK, '1', platform);
    assert.equal(calls[0].env.PATH ?? calls[0].env.Path, process.env.PATH ?? process.env.Path, platform);
  }
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

// --- T3: uninstallProject, the counterpart of initProject (see "T3 design") ---

/** Every file under `dir`, relative to `dir` with forward slashes, sorted — skipping any entry (or
 * whole subtree) `shouldSkip` reports true for. Used for round-trip comparisons ("the tree is
 * exactly what it was before init"): callers skip `.git` itself and separately compare `.git/hooks`
 * on its own, so incidental git-internal churn (`.git/objects`, `.git/index`, ...) never enters the
 * comparison at all — never even walked, not just filtered out afterward. */
function listFilesRecursive(dir, shouldSkip = () => false) {
  const results = [];
  const walk = (current, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (shouldSkip(entryRel)) continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs, entryRel);
      else results.push(entryRel);
    }
  };
  walk(dir, '');
  return results.sort();
}

/** The working tree (never descending into `.git` at all) plus, separately, whatever hooks
 * directory actually matters for this run (the repo's own `.git/hooks` for a plain repo, or the
 * common git dir's `hooks` for a worktree) — the two places `initProject`/`uninstallProject` can
 * ever write outside `harness.json`/`AGENTS.md` themselves. */
function repoTreeSnapshot(workingTreeRoot, hooksDir) {
  const workingTree = listFilesRecursive(workingTreeRoot, (rel) => rel === '.git' || rel.startsWith('.git/'));
  const hooks = listFilesRecursive(hooksDir);
  return { workingTree, hooks };
}

test('uninstallProject leaves a plain repo byte-identical to before init', () => {
  const root = makeTmpRepo();
  try {
    const hooksDir = path.join(root, '.git', 'hooks');
    const before = repoTreeSnapshot(root, hooksDir);

    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);

    const uninstallResult = uninstallProject(root, { spawn: spawnSync });
    assert.equal(uninstallResult.code, 0);

    assert.deepEqual(repoTreeSnapshot(root, hooksDir), before);
    assert.equal(fs.existsSync(uninstallResult.manifestPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject leaves a worktree and its common git dir byte-identical to before init', () => {
  const main = makeTmpRepoWithCommit();
  const worktree = makeTmpDir('js-harness-project-uninstall-wt-');
  fs.rmSync(worktree, { recursive: true, force: true });
  try {
    const add = spawnSync('git', ['worktree', 'add', worktree, '-b', 'js-harness-test-uninstall-wt'], {
      cwd: main,
      encoding: 'utf8',
    });
    assert.equal(add.status, 0, `git worktree add failed: ${add.stderr}`);

    const { commonGitDir } = gitDirs(worktree, spawnSync);
    const hooksDir = path.join(commonGitDir, 'hooks');
    const before = repoTreeSnapshot(worktree, hooksDir);

    const initResult = initProject(worktree, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const hookEntry = initResult.manifest.files.find((f) => f.path.endsWith('hooks/pre-commit'));
    assert.equal(hookEntry.gitDir, true); // sanity: this is exactly the outside-working-tree case

    const uninstallResult = uninstallProject(worktree, { spawn: spawnSync });
    assert.equal(uninstallResult.code, 0);

    assert.deepEqual(repoTreeSnapshot(worktree, hooksDir), before);
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: main, encoding: 'utf8' });
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});

test('uninstallProject leaves a repo byte-identical to before init when core.hooksPath created a multi-level directory', () => {
  const root = makeTmpRepo();
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom/nested/hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);
    const hooksDir = path.join(root, '.git', 'hooks'); // untouched: hooksPath points elsewhere
    const before = repoTreeSnapshot(root, hooksDir);
    assert.equal(fs.existsSync(path.join(root, 'custom')), false);

    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    assert.deepEqual(initResult.manifest.dirs, [{ path: 'docs' }, { path: 'custom' }]);
    assert.ok(fs.existsSync(path.join(root, 'custom', 'nested', 'hooks', 'pre-commit')));

    const uninstallResult = uninstallProject(root, { spawn: spawnSync });
    assert.equal(uninstallResult.code, 0);

    assert.deepEqual(repoTreeSnapshot(root, hooksDir), before);
    assert.equal(fs.existsSync(path.join(root, 'custom')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject reports a changed file as kept and leaves it untouched', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const agentsPath = path.join(root, 'AGENTS.md');
    const edited = `${fs.readFileSync(agentsPath, 'utf8')}\nedited by the user\n`;
    fs.writeFileSync(agentsPath, edited, 'utf8');

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0); // a kept file is not a failure
    const keptAction = result.actions.find((a) => a.path === 'AGENTS.md');
    assert.deepEqual(keptAction, { kind: 'kept', path: 'AGENTS.md', reason: 'changed since init' });
    assert.equal(fs.readFileSync(agentsPath, 'utf8'), edited);
    // The manifest is removed regardless — a kept file is not a reason to keep it (only a genuine
    // removal failure is, per T3 design).
    assert.equal(fs.existsSync(result.manifestPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject removes a file whose content matches once CRLF is folded back to LF', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const agentsPath = path.join(root, 'AGENTS.md');
    const original = fs.readFileSync(agentsPath, 'utf8');
    // Simulate git rewriting line endings on checkout (core.autocrlf/.gitattributes) — same content,
    // CRLF instead of LF.
    fs.writeFileSync(agentsPath, original.replace(/\n/g, '\r\n'), 'utf8');

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    const action = result.actions.find((a) => a.path === 'AGENTS.md');
    assert.deepEqual(action, { kind: 'removed', path: 'AGENTS.md' });
    assert.equal(fs.existsSync(agentsPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject reports an already-removed file as already gone, not a failure', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, 'AGENTS.md'));

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    assert.deepEqual(
      result.actions.find((a) => a.path === 'AGENTS.md'),
      { kind: 'alreadyGone', path: 'AGENTS.md' },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject never follows a symlink placed where a written file used to be', async (t) => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-uninstall-symlink-outside-');
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const agentsPath = path.join(root, 'AGENTS.md');
    fs.rmSync(agentsPath);
    const target = path.join(outsideDir, 'elsewhere.md');
    fs.writeFileSync(target, 'not the template', 'utf8');
    if (!trySymlink(target, agentsPath, 'file', t)) return;

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    // The link leads outside the repository, so the entry is no longer this run's to judge: the check
    // that a path is still inside its base comes before the look at what is there (`uninstallProject`).
    assert.deepEqual(
      result.actions.find((a) => a.path === 'AGENTS.md'),
      { kind: 'kept', path: 'AGENTS.md', reason: 'moved outside' },
    );
    assert.equal(fs.lstatSync(agentsPath).isSymbolicLink(), true); // the link itself untouched
    assert.equal(fs.existsSync(target), true); // and never followed into removing its target
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('uninstallProject prunes empty directories bottom-up but leaves one with real content behind', () => {
  const root = makeTmpRepo();
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom/nested/hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    // Something added after init, directly in the recorded shallowest directory.
    fs.writeFileSync(path.join(root, 'custom', 'extra.txt'), 'not js-harness content', 'utf8');

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0); // a non-empty directory is not a failure either
    assert.equal(fs.existsSync(path.join(root, 'custom', 'nested')), false); // emptied, so removed
    assert.equal(fs.existsSync(path.join(root, 'custom')), true); // has real content, so kept
    assert.equal(fs.readFileSync(path.join(root, 'custom', 'extra.txt'), 'utf8'), 'not js-harness content');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("uninstallProject removes .codegraph/ when this project's own init created it", () => {
  const root = makeCodeRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    assert.equal(initResult.manifest.codegraph.createdDir, true);
    assert.ok(fs.existsSync(path.join(root, '.codegraph')));

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    assert.ok(result.actions.some((a) => a.kind === 'codegraphRemoved'));
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject leaves .codegraph/ alone when it already existed before init', () => {
  const root = makeTmpRepo();
  try {
    fs.mkdirSync(path.join(root, '.codegraph'), { recursive: true });
    fs.writeFileSync(path.join(root, '.codegraph', 'preexisting.txt'), 'not js-harness', 'utf8');
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    assert.equal(initResult.manifest.codegraph.createdDir, false);

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    assert.ok(!result.actions.some((a) => a.kind === 'codegraphRemoved'));
    assert.equal(fs.readFileSync(path.join(root, '.codegraph', 'preexisting.txt'), 'utf8'), 'not js-harness');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject leaves kept entries (an existing AGENTS.md init never wrote) alone and unreported', () => {
  const root = makeTmpRepo();
  try {
    const original = '# My project\n\nAlready here.\n';
    fs.writeFileSync(path.join(root, 'AGENTS.md'), original, 'utf8');
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    assert.ok(initResult.manifest.kept.some((k) => k.path === 'AGENTS.md'));

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    assert.ok(!result.actions.some((a) => a.path === 'AGENTS.md'));
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), original);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject keeps the manifest and reports a failure when a removal throws, and a rerun finishes the job', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const agentsPath = path.join(root, 'AGENTS.md');
    const rm = (target, options) => {
      if (target === agentsPath) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
      fs.rmSync(target, options);
    };

    const first = uninstallProject(root, { spawn: spawnSync, rm });

    assert.equal(first.code, 1);
    assert.deepEqual(first.notRemoved, ['AGENTS.md']);
    assert.ok(first.actions.some((a) => a.kind === 'failed' && a.path === 'AGENTS.md'));
    assert.ok(fs.existsSync(agentsPath)); // the failed removal really did not happen
    assert.ok(fs.existsSync(first.manifestPath)); // kept so a rerun can finish the job
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false); // other files still removed

    const second = uninstallProject(root, { spawn: spawnSync }); // no fault this time

    assert.equal(second.code, 0);
    assert.equal(fs.existsSync(agentsPath), false);
    assert.equal(fs.existsSync(second.manifestPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject reports notGitRepo outside a git repository', () => {
  const dir = makeTmpDir();
  try {
    const result = uninstallProject(dir, { spawn: spawnSync });
    assert.equal(result.code, 1);
    assert.equal(result.notGitRepo, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uninstallProject reports notInitialized inside a git repo js-harness never touched', () => {
  const root = makeTmpRepo();
  try {
    const result = uninstallProject(root, { spawn: spawnSync });
    assert.equal(result.code, 1);
    assert.equal(result.notInitialized, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject reports noManifestFile when harness.json exists but this clone has no manifest', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, '.git', 'js-harness'), { recursive: true, force: true }); // a fresh clone

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 1);
    assert.equal(result.noManifestFile, true);
    assert.ok(fs.existsSync(path.join(root, 'harness.json'))); // untouched — nothing was written
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject reports malformedManifest and writes nothing when the manifest does not parse', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.writeFileSync(initResult.manifestPath, '{ not json', 'utf8');

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 1);
    assert.equal(result.malformedManifest, true);
    assert.ok(fs.existsSync(path.join(root, 'harness.json'))); // untouched
    assert.equal(fs.readFileSync(result.manifestPath, 'utf8'), '{ not json');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T3 design's own promise, exercised end to end: init's staleManifest refusal ("run js-harness
// uninstall first") is only useful if uninstall genuinely clears the way for a following init.
test('after uninstall, a project initProject once refused to re-init over (staleManifest) inits cleanly', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, 'harness.json'));

    const stale = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(stale.code, 1);
    assert.equal(stale.staleManifest, true);

    const uninstallResult = uninstallProject(root, { spawn: spawnSync });
    assert.equal(uninstallResult.code, 0);
    assert.equal(fs.existsSync(uninstallResult.manifestPath), false);

    const reinit = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(reinit.code, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- T3b: accepted review follow-ups on T3 (see the T3b line and its Progress entry) ---

// Codex P1, item 1: a recorded file must still really be inside the base it was recorded under —
// following every ancestor through realish/isWithinBase, not just trusting whatever `lstat` finds at
// the recorded path once something is found there.
test('uninstallProject keeps a recorded file whose ancestor was replaced by a junction to outside, never touching the outside file', async (t) => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-uninstall-ancestor-link-');
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom/nested/hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const hookContent = fs.readFileSync(path.join(root, 'custom', 'nested', 'hooks', 'pre-commit'), 'utf8');

    // Build the same `nested/hooks/pre-commit` structure, with byte-identical content, entirely
    // outside the repo — then replace `custom` (the recorded `dirs` entry) with a junction to it.
    fs.mkdirSync(path.join(outsideDir, 'nested', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'nested', 'hooks', 'pre-commit'), hookContent, 'utf8');
    fs.rmSync(path.join(root, 'custom'), { recursive: true, force: true });
    if (!trySymlinkDir(outsideDir, path.join(root, 'custom'), t)) return;

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    assert.deepEqual(
      result.actions.find((a) => a.path === 'custom/nested/hooks/pre-commit'),
      { kind: 'kept', path: 'custom/nested/hooks/pre-commit', reason: 'moved outside' },
    );
    // The outside file — content-identical to what init wrote — survives untouched.
    assert.ok(fs.existsSync(path.join(outsideDir, 'nested', 'hooks', 'pre-commit')));
    assert.equal(fs.readFileSync(path.join(outsideDir, 'nested', 'hooks', 'pre-commit'), 'utf8'), hookContent);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

// Codex P2, item 2: only the directory chain init actually created is ever a candidate for removal
// — an empty directory added later, even directly alongside init's own chain, is never touched.
test('uninstallProject never removes a directory it did not create, even an empty one added later', () => {
  const root = makeTmpRepo();
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom/nested/hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.mkdirSync(path.join(root, 'custom', 'cache'), { recursive: true }); // unrelated to init

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    // init's own chain is gone...
    assert.equal(fs.existsSync(path.join(root, 'custom', 'nested')), false);
    // ...but `custom` stays (not empty: `cache/` is still there), and `cache/` itself — even though
    // it is empty — was never init's to remove either, so it is never even considered.
    assert.equal(fs.existsSync(path.join(root, 'custom')), true);
    assert.equal(fs.existsSync(path.join(root, 'custom', 'cache')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Codex P2, item 3: absence (ENOENT/ENOTDIR) is benign; any other lstat/read/readdir failure is a
// real failure that keeps the manifest and fails the run.

test('uninstallProject fails a file removal and keeps the manifest on a non-absence lstat error', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const agentsPath = path.join(root, 'AGENTS.md');
    const lstat = (target) => {
      if (target === agentsPath) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      return fs.lstatSync(target);
    };

    const result = uninstallProject(root, { spawn: spawnSync, lstat });

    assert.equal(result.code, 1);
    assert.deepEqual(result.notRemoved, ['AGENTS.md']);
    assert.ok(result.actions.some((a) => a.kind === 'failed' && a.path === 'AGENTS.md'));
    assert.ok(fs.existsSync(agentsPath));
    assert.ok(fs.existsSync(result.manifestPath));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject still treats a real ENOENT from the injected lstat as already gone, not a failure', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const agentsPath = path.join(root, 'AGENTS.md');
    const lstat = (target) => {
      if (target === agentsPath) throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
      return fs.lstatSync(target);
    };

    const result = uninstallProject(root, { spawn: spawnSync, lstat });

    assert.equal(result.code, 0);
    assert.deepEqual(
      result.actions.find((a) => a.path === 'AGENTS.md'),
      { kind: 'alreadyGone', path: 'AGENTS.md' },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject fails a file removal and keeps the manifest on a non-absence read error', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const agentsPath = path.join(root, 'AGENTS.md');
    const readFile = (target) => {
      if (target === agentsPath) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      return fs.readFileSync(target, 'utf8');
    };

    const result = uninstallProject(root, { spawn: spawnSync, readFile });

    assert.equal(result.code, 1);
    assert.deepEqual(result.notRemoved, ['AGENTS.md']);
    assert.ok(result.actions.some((a) => a.kind === 'failed' && a.path === 'AGENTS.md'));
    assert.ok(fs.existsSync(result.manifestPath));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject fails a directory prune and keeps the manifest on a non-absence readdir error', () => {
  const root = makeTmpRepo();
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom/nested/hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const nestedDir = path.join(root, 'custom', 'nested');
    const readdir = (target, ...rest) => {
      if (target === nestedDir) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      return fs.readdirSync(target, ...rest);
    };

    const result = uninstallProject(root, { spawn: spawnSync, readdir });

    assert.equal(result.code, 1);
    assert.ok(result.notRemoved.length > 0);
    assert.ok(result.actions.some((a) => a.kind === 'failed'));
    assert.ok(fs.existsSync(result.manifestPath));
    assert.ok(fs.existsSync(nestedDir)); // never removed: the check on it itself failed
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Codex P2, item 4: a short write (fewer bytes written than asked for) must be resumed, not treated
// as if the whole buffer had been written.
test('initProject loops the manifest write until every byte is written, handling a short write', () => {
  const root = makeTmpRepo();
  try {
    let calls = 0;
    const write = (fd, buffer, offset, length, position) => {
      calls += 1;
      if (calls === 1) {
        const short = Math.max(1, Math.floor(length / 2));
        return fs.writeSync(fd, buffer, offset, short, position);
      }
      return fs.writeSync(fd, buffer, offset, length, position);
    };

    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', write });

    assert.equal(result.code, 0);
    assert.ok(calls >= 2, `expected at least one short write followed by a continuation, got ${calls} call(s)`);
    assert.deepEqual(JSON.parse(fs.readFileSync(result.manifestPath, 'utf8')), result.manifest);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T3c (R3-short-write-loop-no-progress-guard, Codex P2): a write that makes no progress — 0 bytes,
// or a non-number from an old-style writer — fails the write instead of spinning or passing a
// truncated manifest. The fake writes nothing for its first calls and then writes for real, so the
// old loop finishes (and this test fails) rather than hanging.
for (const [label, stall] of [
  ['returns 0', () => 0],
  ['returns no byte count', () => undefined],
]) {
  test(`initProject fails the manifest write, leaving no temp file, when a write ${label}`, () => {
    const root = makeTmpRepo();
    try {
      let calls = 0;
      const write = (fd, buffer, offset, length, position) => {
        calls += 1;
        if (calls <= 3) return stall();
        return fs.writeSync(fd, buffer, offset, length, position);
      };

      assert.throws(
        () => initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux', write }),
        (err) => err instanceof InitWriteError,
      );
      const gitDirJs = path.join(root, '.git', 'js-harness');
      const leftovers = fs.existsSync(gitDirJs) ? fs.readdirSync(gitDirJs).filter((n) => n.endsWith('.tmp')) : [];
      assert.deepEqual(leftovers, []);
      assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

// T3c (R3-dir-prune-follows-ancestor-link): a recorded directory reached through an ancestor a link
// now sends outside is kept, so an empty directory outside the project is never removed.
test('uninstallProject keeps a recorded directory whose ancestor was replaced by a junction, leaving the empty outside directories alone', (t) => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-uninstall-dir-link-');
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom/nested/hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);
    assert.equal(initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' }).code, 0);

    // The same chain outside, empty, and `custom` replaced by a junction to it.
    fs.mkdirSync(path.join(outsideDir, 'nested', 'hooks'), { recursive: true });
    fs.rmSync(path.join(root, 'custom'), { recursive: true, force: true });
    if (!trySymlinkDir(outsideDir, path.join(root, 'custom'), t)) return;

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 0);
    assert.ok(fs.existsSync(path.join(outsideDir, 'nested', 'hooks')), 'the empty outside chain survives');
    assert.ok(
      result.actions.some((a) => a.kind === 'kept' && a.reason === 'moved outside' && a.path.startsWith('custom/nested')),
      `expected a kept, moved-outside directory; got ${JSON.stringify(result.actions)}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

// Codex P2 + R3-manifest-entry-shape-unvalidated, item 5: the whole manifest is validated, shape and
// containment, before any removal at all — a malformed entry anywhere is malformedManifest, exit 1,
// nothing written.

test('uninstallProject reports malformedManifest when a files entry has no string path', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const manifest = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    delete manifest.files[0].path;
    fs.writeFileSync(initResult.manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 1);
    assert.equal(result.malformedManifest, true);
    assert.ok(fs.existsSync(path.join(root, 'harness.json'))); // untouched — nothing was removed
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject reports malformedManifest when a dirs entry escapes the working tree (../shared)', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const manifest = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    manifest.dirs = [{ path: '../shared' }];
    fs.writeFileSync(initResult.manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 1);
    assert.equal(result.malformedManifest, true);
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject reports malformedManifest when a gitDir:true entry points outside every git dir', () => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-uninstall-malformed-gitdir-');
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const manifest = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    const outsidePath = `${fs.realpathSync(outsideDir).split(path.sep).join('/')}/somewhere/pre-commit`;
    manifest.files.push({ path: outsidePath, sha256: '0'.repeat(64), gitDir: true });
    fs.writeFileSync(initResult.manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    const result = uninstallProject(root, { spawn: spawnSync });

    assert.equal(result.code, 1);
    assert.equal(result.malformedManifest, true);
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

// --- T4: syncProject, moving a project to its pin (see "T4 design") ---

const MANIFEST_REL = ['.git', 'js-harness', 'manifest.json'];
const HOOK_CONTENT = '#!/bin/sh\n# Written by js-harness init; js-harness uninstall removes it.\nexec js-harness check\n';

/** A fresh clone of an initialized project: `harness.json` (and, unless `agents` is false,
 * `AGENTS.md`) are committed files already in the working tree, but nothing local exists yet — no
 * hook, no `.codegraph/`, no manifest. */
function makeClone({ version = '0.1.0', agents = true, code = false } = {}) {
  const root = makeTmpRepo('js-harness-project-clone-');
  if (code) fs.writeFileSync(path.join(root, 'index.js'), '', 'utf8');
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({ version }, null, 2) + '\n', 'utf8');
  if (agents) fs.writeFileSync(path.join(root, 'AGENTS.md'), '# committed by the team\n', 'utf8');
  return root;
}

/** Every file under `dir` (`.git` included) with its bytes, so "nothing was written" is one
 * `deepEqual` instead of a list of existence checks. */
function contentSnapshot(dir) {
  const out = {};
  for (const rel of listFilesRecursive(dir)) {
    out[rel] = fs.readFileSync(path.join(dir, ...rel.split('/'))).toString('base64');
  }
  return out;
}

const syncDeps = (extra = {}) => ({ spawn: makeSpawn(), platform: 'linux', ...extra });

test('syncProject reports noSuchDirectory when the cwd does not exist', () => {
  const result = syncProject(path.join(os.tmpdir(), 'js-harness-does-not-exist-t4'), '0.1.0', syncDeps());
  assert.equal(result.code, 1);
  assert.equal(result.noSuchDirectory, true);
});

test('syncProject reports notGitRepo outside a git repository and writes nothing', () => {
  const dir = makeTmpDir();
  try {
    const result = syncProject(dir, '0.1.0', syncDeps());
    assert.equal(result.code, 1);
    assert.equal(result.notGitRepo, true);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('syncProject reports notInitialized inside a git repository js-harness never touched', () => {
  const root = makeTmpRepo();
  try {
    const before = contentSnapshot(root);
    const result = syncProject(root, '0.1.0', syncDeps());
    assert.equal(result.code, 1);
    assert.equal(result.notInitialized, true);
    assert.deepEqual(contentSnapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject accepts a semver prerelease pin and reports it as a mismatch (T4c)', () => {
  const root = makeClone({ version: '1.2.3-rc.1+build.5' });
  try {
    const result = syncProject(root, '0.1.0', syncDeps());
    assert.equal(result.pinMismatch, true);
    assert.equal(result.pin, '1.2.3-rc.1+build.5');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// A `harness.json` whose pin cannot be used names the file and writes nothing. An object with no
// `version` at all is not one of these: it is a project with no pin (install-update T6), below.
for (const [label, write] of [
  ['is not JSON', (p) => fs.writeFileSync(p, '{ not json', 'utf8')],
  ['is not a JSON object', (p) => fs.writeFileSync(p, '[]\n', 'utf8')],
  ['has a null version', (p) => fs.writeFileSync(p, '{ "version": null }\n', 'utf8')],
  ['has a non-string version', (p) => fs.writeFileSync(p, '{ "version": 1 }\n', 'utf8')],
  ['is an empty file', (p) => fs.writeFileSync(p, '', 'utf8')],
  ['is not readable (a directory)', (p) => fs.mkdirSync(p)],
  // T4c, R1-001: the pin is printed inside a suggested install command, so only semver passes.
  ['has a version with shell metacharacters', (p) => fs.writeFileSync(p, JSON.stringify({ version: '1.0.0; curl x | sh' }))],
  ['has a version with a terminal escape', (p) => fs.writeFileSync(p, JSON.stringify({ version: '1.0.0\u001b[2J' }))],
  ['has a version that is not semver', (p) => fs.writeFileSync(p, JSON.stringify({ version: 'latest' }))],
]) {
  test(`syncProject reports invalidHarnessJson and writes nothing when harness.json ${label}`, () => {
    const root = makeTmpRepo();
    try {
      const harnessJsonPath = path.join(root, 'harness.json');
      write(harnessJsonPath);
      const before = contentSnapshot(root);

      const result = syncProject(root, '0.1.0', syncDeps());

      assert.equal(result.code, 1);
      assert.equal(result.invalidHarnessJson, true);
      assert.equal(fs.realpathSync(result.harnessJsonPath), fs.realpathSync(harnessJsonPath));
      assert.deepEqual(contentSnapshot(root), before);
      assert.equal(fs.existsSync(path.join(root, ...MANIFEST_REL)), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

// install-update T6: a `harness.json` written by hand, with settings and no `version`, is a project with
// no pin. There is nothing to move it to, so sync says so (the caller names how to pin) and writes nothing.
for (const [label, text] of [
  ['an empty object', '{}\n'],
  ['settings and no version', '{ "sameTree": "skip" }\n'],
]) {
  test(`syncProject reports noPin, not invalidHarnessJson, and writes nothing when harness.json is ${label}`, () => {
    const root = makeTmpRepo();
    try {
      const harnessJsonPath = path.join(root, 'harness.json');
      fs.writeFileSync(harnessJsonPath, text, 'utf8');
      const before = contentSnapshot(root);

      const result = syncProject(root, '0.1.0', syncDeps());

      assert.equal(result.code, 1);
      assert.equal(result.noPin, true);
      assert.equal(result.invalidHarnessJson, undefined);
      assert.equal(result.version, '0.1.0');
      assert.equal(fs.realpathSync(result.harnessJsonPath), fs.realpathSync(harnessJsonPath));
      assert.deepEqual(contentSnapshot(root), before);
      assert.equal(fs.existsSync(path.join(root, ...MANIFEST_REL)), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('syncProject refuses a stale manifest (harness.json gone) and writes nothing', () => {
  const root = makeTmpRepo();
  try {
    assert.equal(initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' }).code, 0);
    fs.rmSync(path.join(root, 'harness.json'));
    const before = contentSnapshot(root);

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 1);
    assert.equal(result.staleManifest, true);
    assert.equal(fs.realpathSync(result.manifestPath), fs.realpathSync(path.join(root, ...MANIFEST_REL)));
    assert.deepEqual(contentSnapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject with a pin different from the running version writes nothing, manifest and tree byte-identical', () => {
  const root = makeCodeRepo();
  try {
    assert.equal(initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' }).code, 0);
    // Remove things a matching-version sync would put back, so a wrongly-acting sync would show.
    fs.rmSync(path.join(root, '.git', 'hooks', 'pre-commit'));
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true });
    const spawn = makeSpawn();
    const before = contentSnapshot(root);

    const result = syncProject(root, '0.2.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 1);
    assert.equal(result.pinMismatch, true);
    assert.equal(result.pin, '0.1.0');
    assert.equal(result.version, '0.2.0');
    assert.deepEqual(contentSnapshot(root), before);
    assert.equal(spawn.codegraphCalls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject with a pin mismatch in a fresh clone sets nothing up', () => {
  const root = makeClone({ version: '0.1.0' });
  try {
    const spawn = makeSpawn();
    const before = contentSnapshot(root);

    const result = syncProject(root, '0.3.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 1);
    assert.equal(result.pinMismatch, true);
    assert.deepEqual(contentSnapshot(root), before);
    assert.equal(spawn.codegraphCalls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- a fresh clone: no manifest yet ---

test('syncProject sets a fresh clone up: the hook, codegraph init and a manifest recording harness.json and AGENTS.md as kept', () => {
  const root = makeClone({ code: true });
  try {
    const harnessBefore = fs.readFileSync(path.join(root, 'harness.json'), 'utf8');
    const agentsBefore = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    const spawn = makeSpawn();

    const result = syncProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    assert.equal(result.setUp, true);
    assert.equal(fs.realpathSync(result.root), fs.realpathSync(root));
    const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
    assert.equal(fs.readFileSync(hookPath, 'utf8'), HOOK_CONTENT);
    assert.equal(spawn.codegraphCalls.length, 1);
    assert.ok(fs.existsSync(path.join(root, '.codegraph')));
    // The committed files are the project's, never rewritten.
    assert.equal(fs.readFileSync(path.join(root, 'harness.json'), 'utf8'), harnessBefore);
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), agentsBefore);

    // The two hooks, the style and the denies every clone holds, and the two keys of this clone's own settings (a
    // clone applies its switches for itself).
    assert.deepEqual(
      result.actions.filter((a) => a.kind === 'wrote').map((a) => a.path),
      [
        '.git/hooks/pre-commit',
        '.git/hooks/pre-push',
        '.claude/settings.local.json#/outputStyle',
        '.claude/settings.local.json#/permissions/deny',
        '.claude/settings.local.json#/env/CODEGRAPH_NO_PROMPT_HOOK',
        '.claude/settings.local.json#/enabledPlugins/typescript-lsp@claude-plugins-official',
      ],
    );
    assert.ok(result.actions.some((a) => a.kind === 'ran' && a.path === 'codegraph init'));

    const onDisk = JSON.parse(fs.readFileSync(path.join(root, ...MANIFEST_REL), 'utf8'));
    assert.deepEqual(onDisk, result.manifest);
    assert.equal(onDisk.version, '0.1.0');
    assert.deepEqual(onDisk.files.map((f) => f.path), ['.git/hooks/pre-commit', '.git/hooks/pre-push']);
    assert.deepEqual(onDisk.files[0], { path: '.git/hooks/pre-commit', sha256: sha256(HOOK_CONTENT) });
    assert.deepEqual(onDisk.kept, [
      { path: 'harness.json', reason: 'committed' },
      { path: 'AGENTS.md', reason: 'committed' },
    ]);
    assert.deepEqual(onDisk.codegraph, { createdDir: true, status: 'ok' });
    assert.deepEqual(onDisk.dirs, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallProject after a fresh-clone sync removes only what the clone wrote, leaving harness.json and AGENTS.md', () => {
  const root = makeClone();
  try {
    const hooksDir = path.join(root, '.git', 'hooks');
    const before = repoTreeSnapshot(root, hooksDir);

    assert.equal(syncProject(root, '0.1.0', syncDeps()).code, 0);
    const uninstallResult = uninstallProject(root, { spawn: spawnSync });

    assert.equal(uninstallResult.code, 0);
    assert.deepEqual(repoTreeSnapshot(root, hooksDir), before);
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
    assert.equal(fs.existsSync(path.join(root, ...MANIFEST_REL)), false);
    assert.ok(!uninstallResult.actions.some((a) => a.path === 'harness.json' || a.path === 'AGENTS.md'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject does not create an AGENTS.md a fresh clone lacks, and reports the skip', () => {
  const root = makeClone({ agents: false });
  try {
    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.ok(result.actions.some((a) => a.kind === 'skip' && a.path === 'AGENTS.md'));
    // The failures register likewise: a clone that has none gets none from sync, and no `docs/` for it.
    assert.equal(fs.existsSync(path.join(root, 'docs')), false);
    assert.ok(result.actions.some((a) => a.kind === 'skip' && a.path === 'docs/FAILURES.md'));
    assert.deepEqual(result.manifest.kept, [{ path: 'harness.json', reason: 'committed' }]);
    assert.deepEqual(result.manifest.files.map((f) => f.path), ['.git/hooks/pre-commit']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject keeps a pre-commit hook a fresh clone already has, and never overwrites it', () => {
  const root = makeClone();
  try {
    const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
    fs.writeFileSync(hookPath, '#!/bin/sh\necho theirs\n', 'utf8');

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.equal(fs.readFileSync(hookPath, 'utf8'), '#!/bin/sh\necho theirs\n');
    assert.deepEqual(result.manifest.files, []);
    const keptHook = result.manifest.kept.find((k) => k.path === '.git/hooks/pre-commit');
    assert.ok(keptHook, 'expected the existing hook in kept');
    assert.match(keptHook.reason, /js-harness check/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject writes a fresh clone\'s hook under a custom core.hooksPath, recording the directory it created', () => {
  const root = makeClone();
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom/nested/hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.ok(fs.existsSync(path.join(root, 'custom', 'nested', 'hooks', 'pre-commit')));
    assert.deepEqual(result.manifest.dirs, [{ path: 'custom' }]);

    assert.equal(uninstallProject(root, { spawn: spawnSync }).code, 0);
    assert.equal(fs.existsSync(path.join(root, 'custom')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject leaves .codegraph alone in a fresh clone that already has it', () => {
  const root = makeClone();
  try {
    fs.mkdirSync(path.join(root, '.codegraph'));
    const spawn = makeSpawn();

    const result = syncProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    assert.equal(spawn.codegraphCalls.length, 0);
    assert.deepEqual(result.manifest.codegraph, { createdDir: false, status: 'exists' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject reports a codegraph failure in a fresh clone and still exits 0, recording it for a later sync', () => {
  const root = makeClone({ code: true });
  try {
    const spawn = makeSpawn({ status: 1, stdout: '', stderr: 'codegraph exploded' });

    const result = syncProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    const problem = result.actions.find((a) => a.kind === 'problem');
    assert.ok(problem);
    assert.match(problem.reason, /codegraph exploded/);
    assert.deepEqual(result.manifest.codegraph, { createdDir: false, status: 'failed' });
    assert.ok(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject rolls a fresh clone\'s setup back when the manifest cannot be written, leaving the committed files alone', () => {
  const root = makeClone();
  try {
    const before = contentSnapshot(root);
    const open = () => {
      throw new Error('ENOSPC: no space left on device');
    };

    let caught;
    try {
      syncProject(root, '0.1.0', syncDeps({ open }));
      assert.fail('expected syncProject to throw');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof InitWriteError);
    assert.match(caught.message, /ENOSPC/);
    assert.deepEqual(caught.notRemoved, []);
    // The hook and `.codegraph/` this run wrote are gone; harness.json and AGENTS.md were never its own.
    assert.deepEqual(contentSnapshot(root), before);
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject on a fresh clone twice sets up once, then is up to date', () => {
  const root = makeClone();
  try {
    assert.equal(syncProject(root, '0.1.0', syncDeps()).code, 0);
    const spawn = makeSpawn();
    const second = syncProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(second.code, 0);
    assert.equal(second.upToDate, true);
    assert.equal(spawn.codegraphCalls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- an initialized clone: the manifest is there ---

test('syncProject with nothing to do reports upToDate and rewrites nothing (manifest bytes and mtime unchanged)', async () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const manifestFile = initResult.manifestPath;
    const bytes = fs.readFileSync(manifestFile);
    const mtime = fs.statSync(manifestFile).mtimeMs;
    const before = contentSnapshot(root);
    await new Promise((resolve) => setTimeout(resolve, 20)); // a rewrite would move the mtime
    const spawn = makeSpawn();

    const result = syncProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    assert.equal(result.upToDate, true);
    assert.equal(result.version, '0.1.0');
    assert.deepEqual(result.actions, []);
    assert.deepEqual(fs.readFileSync(manifestFile), bytes);
    assert.equal(fs.statSync(manifestFile).mtimeMs, mtime);
    assert.deepEqual(contentSnapshot(root), before);
    assert.equal(spawn.codegraphCalls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject writes a recorded hook that is gone again, leaving the manifest as it was', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
    fs.rmSync(hookPath);
    const manifestBytes = fs.readFileSync(initResult.manifestPath);

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.notEqual(result.upToDate, true);
    assert.deepEqual(result.actions, [{ kind: 'wrote', path: '.git/hooks/pre-commit', sha256: sha256(HOOK_CONTENT) }]);
    assert.equal(fs.readFileSync(hookPath, 'utf8'), HOOK_CONTENT);
    assert.deepEqual(fs.readFileSync(initResult.manifestPath), manifestBytes); // nothing new to record
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject writes a gone hook back inside the directory init created, and uninstall still restores the repo', () => {
  const root = makeTmpRepo();
  try {
    const cfg = spawnSync('git', ['config', 'core.hooksPath', 'custom/nested/hooks'], { cwd: root, encoding: 'utf8' });
    assert.equal(cfg.status, 0, `git config failed: ${cfg.stderr}`);
    const hooksDir = path.join(root, '.git', 'hooks');
    const before = repoTreeSnapshot(root, hooksDir);
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, 'custom'), { recursive: true }); // the whole created chain is gone
    const manifestBytes = fs.readFileSync(initResult.manifestPath);

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.ok(fs.existsSync(path.join(root, 'custom', 'nested', 'hooks', 'pre-commit')));
    assert.deepEqual(fs.readFileSync(initResult.manifestPath), manifestBytes); // `dirs` already names `custom`
    assert.equal(uninstallProject(root, { spawn: spawnSync }).code, 0);
    assert.deepEqual(repoTreeSnapshot(root, hooksDir), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject records a directory it has to recreate for a gone hook that init had not created', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, '.git', 'hooks'), { recursive: true }); // `git init` made it; init never recorded it

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.ok(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')));
    const onDisk = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    assert.deepEqual(onDisk.dirs, [{ path: 'docs' }, { path: '.git/hooks' }]);

    assert.equal(uninstallProject(root, { spawn: spawnSync }).code, 0);
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks')), false); // exactly as it was when sync started
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject leaves a hook file someone else put at the recorded path untouched', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
    fs.writeFileSync(hookPath, '#!/bin/sh\necho foreign\n', 'utf8');
    const before = contentSnapshot(root);

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.equal(fs.readFileSync(hookPath, 'utf8'), '#!/bin/sh\necho foreign\n');
    assert.deepEqual(contentSnapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject keeps a gone hook whose directory a junction now sends outside the repository, writing nothing there', (t) => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-sync-outside-');
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, '.git', 'hooks'), { recursive: true });
    if (!trySymlinkDir(outsideDir, path.join(root, '.git', 'hooks'), t)) return;
    const manifestBytes = fs.readFileSync(initResult.manifestPath);

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.deepEqual(fs.readdirSync(outsideDir), []);
    const keptAction = result.actions.find((a) => a.kind === 'kept');
    assert.ok(keptAction, 'expected the hook reported as kept');
    assert.match(keptAction.reason, /link/);
    assert.deepEqual(fs.readFileSync(initResult.manifestPath), manifestBytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('syncProject creates a deleted .codegraph again and keeps the manifest as init recorded it', () => {
  const root = makeCodeRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true });
    const manifestBytes = fs.readFileSync(initResult.manifestPath);
    const spawn = makeSpawn();

    const result = syncProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 0);
    assert.equal(spawn.codegraphCalls.length, 1);
    assert.ok(fs.existsSync(path.join(root, '.codegraph')));
    assert.deepEqual(result.actions, [{ kind: 'ran', path: 'codegraph init' }]);
    assert.deepEqual(fs.readFileSync(initResult.manifestPath), manifestBytes); // still createdDir: true, ok
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject records createdDir as observed when it creates a .codegraph init had found already there', () => {
  const root = makeCodeRepo();
  try {
    fs.mkdirSync(path.join(root, '.codegraph'));
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.deepEqual(initResult.manifest.codegraph, { createdDir: false, status: 'exists' });
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true });

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    const onDisk = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    assert.deepEqual(onDisk.codegraph, { createdDir: true, status: 'ok' });
    // Rewritten atomically: no temp file left beside it.
    assert.deepEqual(fs.readdirSync(path.dirname(initResult.manifestPath)), ['manifest.json']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject reports a codegraph failure on a deleted .codegraph and exits 0', () => {
  const root = makeCodeRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true });

    const result = syncProject(root, '0.1.0', syncDeps({ spawn: makeSpawn({ status: 1, stdout: '', stderr: 'nope' }) }));

    assert.equal(result.code, 0);
    assert.ok(result.actions.some((a) => a.kind === 'problem' && /nope/.test(a.reason)));
    const onDisk = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    assert.deepEqual(onDisk.codegraph, { createdDir: false, status: 'failed' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject rolls back the .codegraph it created when the manifest that would record it cannot be written', () => {
  const root = makeCodeRepo();
  try {
    fs.mkdirSync(path.join(root, '.codegraph'));
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.deepEqual(initResult.manifest.codegraph, { createdDir: false, status: 'exists' });
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true });
    const before = contentSnapshot(root);
    const open = () => {
      throw new Error('ENOSPC: no space left on device');
    };

    let caught;
    try {
      syncProject(root, '0.1.0', syncDeps({ open }));
      assert.fail('expected syncProject to throw');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof InitWriteError);
    assert.deepEqual(caught.notRemoved, []);
    assert.deepEqual(contentSnapshot(root), before);
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject rolls back a .codegraph it recreated even when the manifest already records it as created (T4b, Codex P2)', () => {
  const root = makeCodeRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.deepEqual(initResult.manifest.codegraph, { createdDir: true, status: 'ok' });
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true });
    // An older recorded version forces a manifest rewrite, which then fails.
    const recorded = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    fs.writeFileSync(initResult.manifestPath, JSON.stringify({ ...recorded, version: '0.0.9' }, null, 2) + '\n');
    const before = contentSnapshot(root);
    const open = () => {
      throw new Error('ENOSPC: no space left on device');
    };

    assert.throws(() => syncProject(root, '0.1.0', syncDeps({ open })), InitWriteError);

    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
    assert.deepEqual(contentSnapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject is up to date on a repeat run that only reports a hook a junction sends outside (T4b)', (t) => {
  const root = makeTmpRepo();
  const outsideDir = makeTmpDir('js-harness-project-sync-outside-');
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    fs.rmSync(path.join(root, '.git', 'hooks'), { recursive: true });
    if (!trySymlinkDir(outsideDir, path.join(root, '.git', 'hooks'), t)) return;
    const manifestBytes = fs.readFileSync(initResult.manifestPath);

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.ok(result.actions.some((a) => a.kind === 'kept'));
    assert.equal(result.upToDate, true);
    assert.deepEqual(fs.readFileSync(initResult.manifestPath), manifestBytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('syncProject is up to date on a repeat run whose codegraph init fails again and writes nothing (T4b)', () => {
  const root = makeCodeRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true });
    const failing = () => syncDeps({ spawn: makeSpawn({ status: 1, stdout: '', stderr: 'nope' }) });
    assert.equal(syncProject(root, '0.1.0', failing()).upToDate, false); // records the failure
    const manifestBytes = fs.readFileSync(initResult.manifestPath);

    const result = syncProject(root, '0.1.0', failing());

    assert.ok(result.actions.some((a) => a.kind === 'problem'));
    assert.equal(result.upToDate, true);
    assert.deepEqual(fs.readFileSync(initResult.manifestPath), manifestBytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject records the running version when the manifest carries an older one', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const manifest = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    manifest.version = '0.0.9';
    fs.writeFileSync(initResult.manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 0);
    assert.notEqual(result.upToDate, true);
    assert.equal(JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8')).version, '0.1.0');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject reports malformedManifest and writes nothing when the manifest does not parse', () => {
  const root = makeTmpRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.writeFileSync(initResult.manifestPath, '{ not json', 'utf8');
    fs.rmSync(path.join(root, '.git', 'hooks', 'pre-commit'));
    const before = contentSnapshot(root);

    const result = syncProject(root, '0.1.0', syncDeps());

    assert.equal(result.code, 1);
    assert.equal(result.malformedManifest, true);
    assert.deepEqual(contentSnapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject reports malformedManifest when an entry escapes the working tree, before acting on anything', () => {
  const root = makeCodeRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    const manifest = JSON.parse(fs.readFileSync(initResult.manifestPath, 'utf8'));
    manifest.dirs = [{ path: '../shared' }];
    fs.writeFileSync(initResult.manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    fs.rmSync(path.join(root, '.codegraph'), { recursive: true });
    const spawn = makeSpawn();
    const before = contentSnapshot(root);

    const result = syncProject(root, '0.1.0', { spawn, platform: 'linux' });

    assert.equal(result.code, 1);
    assert.equal(result.malformedManifest, true);
    assert.equal(spawn.codegraphCalls.length, 0);
    assert.deepEqual(contentSnapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- T5: projectLocation, the read-only answer to "where does this folder stand" ---

test('projectLocation reports noSuchDirectory when the cwd does not exist', () => {
  // A missing child of a fresh parent, so a leftover folder can never make it exist.
  const parent = makeTmpDir();
  try {
    const cwd = path.join(parent, 'does-not-exist');
    assert.deepEqual(projectLocation(cwd, syncDeps()), { kind: 'noSuchDirectory', cwd });
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('projectLocation reports notGit outside a git repository and writes nothing', () => {
  const dir = makeTmpDir();
  try {
    assert.deepEqual(projectLocation(dir, syncDeps()), { kind: 'notGit' });
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('projectLocation reports notInitialized with the repository root, from a subfolder too', () => {
  const root = makeTmpRepo();
  try {
    const sub = path.join(root, 'sub');
    fs.mkdirSync(sub);
    const before = contentSnapshot(root);
    for (const cwd of [root, sub]) {
      const result = projectLocation(cwd, syncDeps());
      assert.equal(result.kind, 'notInitialized');
      assert.equal(fs.realpathSync(result.root), fs.realpathSync(root));
    }
    assert.deepEqual(contentSnapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('projectLocation reports an initialized project with its pin, and whether this clone has a manifest', () => {
  const clone = makeClone({ version: '1.2.3' });
  const inited = makeTmpRepo();
  try {
    const before = contentSnapshot(clone);
    const fresh = projectLocation(clone, syncDeps());
    assert.equal(fresh.kind, 'initialized');
    assert.equal(fs.realpathSync(fresh.root), fs.realpathSync(clone));
    assert.equal(fresh.pin, '1.2.3');
    assert.equal(fresh.manifestPresent, false);
    assert.deepEqual(contentSnapshot(clone), before);

    assert.equal(initProject(inited, '0.1.0', { spawn: makeSpawn(), platform: 'linux' }).code, 0);
    const beforeInit = contentSnapshot(inited);
    const set = projectLocation(inited, syncDeps());
    assert.equal(set.kind, 'initialized');
    assert.equal(set.pin, '0.1.0');
    assert.equal(set.manifestPresent, true);
    assert.equal(fs.realpathSync(set.manifestPath), fs.realpathSync(path.join(inited, ...MANIFEST_REL)));
    assert.deepEqual(contentSnapshot(inited), beforeInit);
  } finally {
    fs.rmSync(clone, { recursive: true, force: true });
    fs.rmSync(inited, { recursive: true, force: true });
  }
});

test('projectLocation reports a stale manifest (harness.json gone) with its path', () => {
  const root = makeTmpRepo();
  try {
    assert.equal(initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' }).code, 0);
    fs.rmSync(path.join(root, 'harness.json'));
    const before = contentSnapshot(root);

    const result = projectLocation(root, syncDeps());

    assert.equal(result.kind, 'staleManifest');
    assert.equal(fs.realpathSync(result.root), fs.realpathSync(root));
    assert.equal(fs.realpathSync(result.manifestPath), fs.realpathSync(path.join(root, ...MANIFEST_REL)));
    assert.deepEqual(contentSnapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// The same harness.json failures syncProject names, with the same reasons: one reading of the pin.
for (const [label, write] of [
  ['is not JSON', (p) => fs.writeFileSync(p, '{ not json', 'utf8')],
  ['is not a JSON object', (p) => fs.writeFileSync(p, 'null\n', 'utf8')],
  ['has a non-string version', (p) => fs.writeFileSync(p, '{ "version": 1 }\n', 'utf8')],
  ['is not readable (a directory)', (p) => fs.mkdirSync(p)],
  ['has a version that is not semver', (p) => fs.writeFileSync(p, JSON.stringify({ version: 'latest' }))],
  ['has a version with a terminal escape', (p) => fs.writeFileSync(p, JSON.stringify({ version: '1.0.0\u001b[2J' }))],
]) {
  test(`projectLocation reports invalidHarnessJson, with syncProject's reason, when harness.json ${label}`, () => {
    const root = makeTmpRepo();
    try {
      write(path.join(root, 'harness.json'));
      const before = contentSnapshot(root);

      const result = projectLocation(root, syncDeps());
      const synced = syncProject(root, '0.1.0', syncDeps());

      assert.equal(result.kind, 'invalidHarnessJson');
      assert.equal(fs.realpathSync(result.root), fs.realpathSync(root));
      assert.equal(result.harnessJsonPath, synced.harnessJsonPath);
      assert.equal(result.reason, synced.reason);
      assert.deepEqual(contentSnapshot(root), before);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

// install-update T6: an object with no `version` is a project with no pin, in a clone that is set up and
// in one that is not. Reading it writes nothing.
test('projectLocation reports noPin, with the file and whether this clone is set up, when harness.json has no version', () => {
  const fresh = makeTmpRepo();
  const setUp = makeTmpRepo();
  try {
    fs.writeFileSync(path.join(fresh, 'harness.json'), '{ "sameTree": "skip" }\n', 'utf8');
    assert.equal(initProject(setUp, '0.1.0', { spawn: makeSpawn(), platform: 'linux' }).code, 0);
    fs.writeFileSync(path.join(setUp, 'harness.json'), '{}\n', 'utf8');
    const before = [contentSnapshot(fresh), contentSnapshot(setUp)];

    const inFresh = projectLocation(fresh, syncDeps());
    const inSetUp = projectLocation(setUp, syncDeps());

    assert.equal(inFresh.kind, 'noPin');
    assert.equal(fs.realpathSync(inFresh.root), fs.realpathSync(fresh));
    assert.equal(fs.realpathSync(inFresh.harnessJsonPath), fs.realpathSync(path.join(fresh, 'harness.json')));
    assert.equal(inFresh.manifestPresent, false);
    assert.equal(inFresh.pin, undefined);
    assert.equal(inSetUp.kind, 'noPin');
    assert.equal(inSetUp.manifestPresent, true);
    assert.equal(fs.realpathSync(inSetUp.manifestPath), fs.realpathSync(path.join(setUp, ...MANIFEST_REL)));
    assert.deepEqual([contentSnapshot(fresh), contentSnapshot(setUp)], before);
  } finally {
    fs.rmSync(fresh, { recursive: true, force: true });
    fs.rmSync(setUp, { recursive: true, force: true });
  }
});

// R1-status-reason-echo: a JSON syntax error quotes the bytes it choked on, and harness.json is committed
// by whoever owns the repository — so the reason is fixed text, never the parser's or the OS's message.
test('an invalid harness.json never echoes its own bytes: a fixed reason for JSON, only the error code for a read', () => {
  const root = makeTmpRepo();
  try {
    const harnessJsonPath = path.join(root, 'harness.json');
    fs.writeFileSync(harnessJsonPath, '{ "version": "\u001b[2J\u001b]0;pwned\u0007", oops', 'utf8');

    const located = projectLocation(root, syncDeps());
    const synced = syncProject(root, '0.1.0', syncDeps());
    assert.equal(located.reason, 'it is not valid JSON');
    assert.equal(synced.reason, 'it is not valid JSON');

    fs.rmSync(harnessJsonPath);
    fs.mkdirSync(harnessJsonPath);
    const unreadable = projectLocation(root, syncDeps());
    assert.equal(unreadable.kind, 'invalidHarnessJson');
    assert.match(unreadable.reason, /^it cannot be read \(([A-Z0-9_]+|unknown error)\)$/);
    assert.equal(syncProject(root, '0.1.0', syncDeps()).reason, unreadable.reason);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T16f of odd/tasks/rule-hierarchy.md: the harness's lines of AGENTS.md, in their marked block, are rendered again by sync
// while the project has not edited them (bin/lib/template-block.test.mjs holds the block itself).
test('syncProject renders an unedited block of the harness\'s lines in AGENTS.md again and says so; an edited one is kept', () => {
  const root = makeTmpRepo('js-harness-project-template-block-');
  const mark = (body) => `<!-- js-harness block ${sha256(body).slice(0, 12)}: sync renders the lines to the end mark again while they are unedited -->`;
  const block = (body) => `# project\n\nOur own line.\n\n${mark(body)}\n${body}<!-- js-harness block end -->\n\n## Constraints\n- ours\n`;
  const old = '## What good looks like\nAn older line of the harness.\n';
  try {
    assert.equal(initProject(root, '0.1.0', syncDeps()).code, 0);
    const agents = path.join(root, 'AGENTS.md');
    fs.writeFileSync(agents, block(old), 'utf8');

    const first = syncProject(root, '0.1.0', syncDeps());
    assert.equal(first.code, 0);
    assert.equal(first.upToDate, false);
    assert.deepEqual(first.actions, [{ kind: 'rendered', path: 'AGENTS.md' }]);
    // init wrote the split, so AGENTS.md takes the reviewer's half (odd/tasks/f8-s3-split.md, S3).
    assert.equal(fs.readFileSync(agents, 'utf8'), block(agentsBlock()));

    const second = syncProject(root, '0.1.0', syncDeps());
    assert.equal(second.upToDate, true);
    assert.deepEqual(second.actions, []);

    const edited = block(old).replace('An older line', 'Our edited line');
    fs.writeFileSync(agents, edited, 'utf8');
    const third = syncProject(root, '0.1.0', syncDeps());
    assert.deepEqual(third.actions, [{ kind: 'kept', path: 'AGENTS.md', reason: "its block of the harness's lines was edited, so sync does not render it again" }]);
    assert.equal(third.upToDate, true);
    assert.equal(fs.readFileSync(agents, 'utf8'), edited);

    // A block sync cannot write again is a failed sync, not an up-to-date one (gentle-ai R3 and R4 on cf820d2).
    fs.writeFileSync(agents, block(old), 'utf8');
    const refused = (file, ...rest) => {
      if (file === agents) throw new Error('EACCES');
      return fs.writeFileSync(file, ...rest);
    };
    const fourth = syncProject(root, '0.1.0', syncDeps({ writeFile: refused }));
    assert.equal(fourth.code, 1);
    assert.equal(fourth.upToDate, false);
    assert.deepEqual(fourth.actions, [{ kind: 'problem', path: 'AGENTS.md', reason: "its block of the harness's lines could not be rendered again (EACCES)" }]);
    assert.equal(fs.readFileSync(agents, 'utf8'), block(old));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject does not render the block through an AGENTS.md that is a link: git could not give its target back', (t) => {
  const root = makeTmpRepo('js-harness-project-template-link-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-template-link-target-'));
  const body = '## What good looks like\nAn older line of the harness.\n';
  const shared = `<!-- js-harness block ${sha256(body).slice(0, 12)}: sync renders the lines to the end mark again while they are unedited -->\n${body}<!-- js-harness block end -->\n`;
  try {
    assert.equal(initProject(root, '0.1.0', syncDeps()).code, 0);
    const agents = path.join(root, 'AGENTS.md');
    const target = path.join(outside, 'AGENTS.md');
    fs.writeFileSync(target, shared, 'utf8');
    fs.rmSync(agents);
    try {
      fs.symlinkSync(target, agents, 'file');
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EACCES') {
        t.skip('symlinks need privileges on this machine');
        return;
      }
      throw err;
    }
    const result = syncProject(root, '0.1.0', syncDeps());
    assert.deepEqual(result.actions, [{ kind: 'kept', path: 'AGENTS.md', reason: 'it is a link, so sync does not write through it' }]);
    assert.equal(fs.readFileSync(target, 'utf8'), shared);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('syncProject reads AGENTS.md with lstat, so a link is kept on a machine that cannot make one', () => {
  const root = makeTmpRepo('js-harness-project-template-lstat-');
  const body = '## What good looks like\nAn older line of the harness.\n';
  const text = `<!-- js-harness block ${sha256(body).slice(0, 12)}: sync renders the lines to the end mark again while they are unedited -->\n${body}<!-- js-harness block end -->\n`;
  try {
    assert.equal(initProject(root, '0.1.0', syncDeps()).code, 0);
    const agents = path.join(root, 'AGENTS.md');
    fs.writeFileSync(agents, text, 'utf8');
    const lstat = (file, ...rest) => (file === agents ? { isSymbolicLink: () => true, isFile: () => false } : fs.lstatSync(file, ...rest));
    const result = syncProject(root, '0.1.0', syncDeps({ lstat }));
    assert.deepEqual(result.actions, [{ kind: 'kept', path: 'AGENTS.md', reason: 'it is a link, so sync does not write through it' }]);
    assert.equal(fs.readFileSync(agents, 'utf8'), text);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// --- F8 S3: init ships the CLAUDE.md/AGENTS.md split (odd/tasks/f8-s3-split.md, S3) ---

test('initProject in a project with neither file writes the split: AGENTS.md for a reviewer, CLAUDE.md importing it; uninstall removes both', () => {
  const root = makeTmpRepo('js-harness-project-split-');
  try {
    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(result.code, 0);
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), agentsTemplate(root));
    assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), claudeTemplate());
    const recorded = result.manifest.files.find((file) => file.path === 'CLAUDE.md');
    assert.deepEqual(recorded, { path: 'CLAUDE.md', sha256: sha256(claudeTemplate()) });
    assert.ok(result.actions.some((action) => action.kind === 'wrote' && action.path === 'CLAUDE.md'));

    const removed = uninstallProject(root, { spawn: spawnSync });
    assert.equal(removed.code, 0);
    assert.deepEqual(removed.actions.find((action) => action.path === 'CLAUDE.md'), { kind: 'removed', path: 'CLAUDE.md' });
    assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject leaves a project with its own AGENTS.md without a CLAUDE.md: moving it is the migration\'s', () => {
  const root = makeTmpRepo('js-harness-project-split-agents-');
  try {
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# ours\n', 'utf8');
    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
    assert.ok(!result.actions.some((action) => action.path === 'CLAUDE.md'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initProject keeps a project\'s own CLAUDE.md and gives its new AGENTS.md the whole block, so no line is lost', () => {
  const root = makeTmpRepo('js-harness-project-split-claude-');
  try {
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# ours\n', 'utf8');
    const result = initProject(root, '0.1.0', { spawn: makeSpawn(), platform: 'linux' });
    assert.equal(result.code, 0);
    assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), '# ours\n');
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), agentsTemplate(root, { split: false }));
    assert.deepEqual(result.actions.find((action) => action.path === 'CLAUDE.md'), { kind: 'kept', path: 'CLAUDE.md', reason: 'exists' });
    assert.ok(!result.manifest.files.some((file) => file.path === 'CLAUDE.md'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncProject renders each file of the split its own half, and a project not moved keeps its whole block', () => {
  const root = makeTmpRepo('js-harness-project-split-sync-');
  const mark = (body) => `<!-- js-harness block ${sha256(body).slice(0, 12)}: sync renders the lines to the end mark again while they are unedited -->`;
  const block = (body, head = '# project\n\n') => `${head}${mark(body)}\n${body}<!-- js-harness block end -->\n`;
  const old = '## What good looks like\nAn older line of the harness.\n';
  try {
    assert.equal(initProject(root, '0.1.0', syncDeps()).code, 0);
    const agents = path.join(root, 'AGENTS.md');
    const claude = path.join(root, 'CLAUDE.md');
    fs.writeFileSync(agents, block(old), 'utf8');
    fs.writeFileSync(claude, block(old, '@AGENTS.md\n\n'), 'utf8');
    const split = syncProject(root, '0.1.0', syncDeps());
    assert.equal(split.code, 0);
    assert.deepEqual(split.actions, [{ kind: 'rendered', path: 'AGENTS.md' }, { kind: 'rendered', path: 'CLAUDE.md' }]);
    assert.equal(fs.readFileSync(agents, 'utf8'), block(agentsBlock()));
    assert.equal(fs.readFileSync(claude, 'utf8'), block(claudeBlock(), '@AGENTS.md\n\n'));

    // A project whose CLAUDE.md holds no block of the harness has not moved: its AGENTS.md keeps every line.
    fs.writeFileSync(claude, '# ours\n', 'utf8');
    fs.writeFileSync(agents, block(old), 'utf8');
    const legacy = syncProject(root, '0.1.0', syncDeps());
    assert.deepEqual(legacy.actions, [{ kind: 'rendered', path: 'AGENTS.md' }]);
    assert.equal(fs.readFileSync(agents, 'utf8'), block(templateBlock()));
    assert.equal(fs.readFileSync(claude, 'utf8'), '# ours\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

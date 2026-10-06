import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { install, recordOptionalFile, recordScheduledTask } from './lib/manifest.mjs';
import { staleManifestMessage } from './lib/project.mjs';
import { currentVersion } from './install.mjs';
import { resolveLatest, resolveSpec, statusMain, updateMain, upgradeMain } from './update.mjs';

// T5: `status` now reads the project the current folder belongs to, and these tests run real `git`,
// so they must not pick up the host's git config (see project.test.mjs, T2e item 8).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-update-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
// The empty git config lives outside the repository, so it is removed with the suite.
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeSpawnOk(stdout = '') {
  return () => ({ status: 0, stdout, stderr: '' });
}

test('resolveLatest reads a --source directory without spawning anything', () => {
  const dir = makeTmpDir('js-harness-src-');
  try {
    fs.writeFileSync(path.join(dir, 'js-harness-0.5.0.tgz'), '');
    const spawn = () => {
      throw new Error('must not spawn when --source is given');
    };
    const result = resolveLatest({ source: dir, pm: undefined }, {}, spawn);
    assert.equal(result.version, '0.5.0');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveLatest asks the injected package manager and parses its stdout', () => {
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '9.9.9\n', stderr: '' };
  };
  const result = resolveLatest({ source: undefined, pm: 'node cli.js' }, {}, spawn);
  assert.equal(result.version, '9.9.9');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'node');
  assert.deepEqual(calls[0].args, ['cli.js', 'view', 'js-harness', 'version']);
});

test('resolveLatest falls back to JS_HARNESS_PM, then to npm', () => {
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push({ cmd, args });
    return { status: 0, stdout: '1.0.0', stderr: '' };
  };
  resolveLatest({ source: undefined, pm: undefined }, { JS_HARNESS_PM: 'my-pm' }, spawn);
  assert.equal(calls[0].cmd, 'my-pm');

  resolveLatest({ source: undefined, pm: undefined }, {}, spawn);
  assert.equal(calls[1].cmd, 'npm');
});

test('resolveLatest returns null when the package manager exits non-zero', () => {
  const spawn = () => ({ status: 1, stdout: '', stderr: 'not found' });
  assert.equal(resolveLatest({ source: undefined, pm: 'npm' }, {}, spawn), null);
});

test('resolveSpec uses the tarball path for --source, else name@version', () => {
  assert.equal(
    resolveSpec({ source: '/tmp/x', latest: { version: '0.2.0', file: '/tmp/x/js-harness-0.2.0.tgz' } }),
    '/tmp/x/js-harness-0.2.0.tgz',
  );
  assert.equal(resolveSpec({ source: undefined, latest: { version: '0.2.0', file: null } }), 'js-harness@0.2.0');
});

test('statusMain reports the manifest version and an available update', async () => {
  const home = makeTmpDir('js-harness-status-home2-');
  try {
    install(home, currentVersion());
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      await statusMain(['--global', '--home', home], {}, fakeSpawnOk('9.9.9'));
    } finally {
      console.log = original;
    }
    const text = lines.join('\n');
    assert.match(text, new RegExp(`installed package version: ${currentVersion()}`));
    assert.match(text, new RegExp(`manifest version: ${currentVersion()}`));
    assert.match(text, /latest available: 9\.9\.9/);
    assert.match(text, /update available: 9\.9\.9/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('statusMain reports no manifest when nothing is installed', async () => {
  const home = makeTmpDir('js-harness-status-home3-');
  try {
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      await statusMain(['--global', '--home', home], {}, fakeSpawnOk(currentVersion()));
    } finally {
      console.log = original;
    }
    assert.match(lines.join('\n'), /manifest version: \(not installed\)/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// `remote start --at-login` records its launcher in a manifest of its own making when nothing is installed: that
// manifest has a null version, which is not a version.
test('statusMain reports not installed for a manifest that only records an optional file', async () => {
  const home = makeTmpDir('js-harness-status-home4-');
  try {
    recordOptionalFile(home, path.join(home, 'launcher.cmd'), '@echo off\r\n');
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      await statusMain(['--global', '--home', home], {}, fakeSpawnOk(currentVersion()));
    } finally {
      console.log = original;
    }
    assert.match(lines.join('\n'), /manifest version: \(not installed\)/);
    assert.doesNotMatch(lines.join('\n'), /null/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('upgradeMain says not installed, not null, when the manifest it finds only records an optional file', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-optional-');
  const source = makeTmpDir('js-harness-upgrade-src-optional-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    recordOptionalFile(home, path.join(home, 'launcher.cmd'), '@echo off\r\n');
    const lines = [];
    const original = console.error;
    console.error = (line) => lines.push(String(line));
    let code;
    try {
      code = await upgradeMain(['--source', source, '--home', home], {}, () => ({ status: 0, stdout: '', stderr: '' }));
    } finally {
      console.error = original;
    }
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /reports \(not installed\), not 0\.9\.0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

// The same manifest once `remote start --at-login` has also recorded its watchdog task, or with that record alone.
test('statusMain and upgradeMain say not installed for a manifest that only records a scheduled task', async () => {
  const home = makeTmpDir('js-harness-status-home-task-');
  const source = makeTmpDir('js-harness-upgrade-src-task-');
  const lines = [];
  const original = { log: console.log, error: console.error };
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    recordScheduledTask(home, { name: 'js-harness-remote-x', command: 'conhost.exe', arguments: '--headless node remote.mjs start --watchdog' });
    console.log = (line) => lines.push(String(line));
    console.error = (line) => lines.push(String(line));
    await statusMain(['--global', '--home', home], {}, fakeSpawnOk(currentVersion()));
    const code = await upgradeMain(['--source', source, '--home', home], {}, () => ({ status: 0, stdout: '', stderr: '' }));
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /manifest version: \(not installed\)/);
    assert.match(lines.join('\n'), /reports \(not installed\), not 0\.9\.0/);
    assert.doesNotMatch(lines.join('\n'), /null/);
  } finally {
    Object.assign(console, original);
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('updateMain reports up to date when no newer version exists', async () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    const code = await updateMain([], {}, fakeSpawnOk(currentVersion()));
    assert.equal(code, 0);
  } finally {
    console.log = original;
  }
  assert.match(lines.join('\n'), /up to date/);
});

test('updateMain reports an available update and still exits 0', async () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    const code = await updateMain([], {}, fakeSpawnOk('99.0.0'));
    assert.equal(code, 0);
  } finally {
    console.log = original;
  }
  assert.match(lines.join('\n'), /update available: 99\.0\.0/);
});

test('upgradeMain installs the resolved spec and syncs the newly installed binary (win32 layout)', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-');
  const prefix = makeTmpDir('js-harness-upgrade-prefix-');
  const source = makeTmpDir('js-harness-upgrade-src-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    const binDir = path.join(prefix, 'node_modules', 'js-harness', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'js-harness.mjs'), '// stub, never executed in this test');
    // The mocked spawn never actually runs sync, so seed the manifest it would have written.
    install(home, '0.9.0');

    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '', stderr: '' };
    };

    const code = await upgradeMain(
      ['--source', source, '--prefix', prefix, '--home', home],
      {},
      spawn,
      'win32',
    );

    assert.equal(code, 0);
    assert.equal(calls.length, 2, 'expected one install call and one sync call');
    assert.deepEqual(calls[0].args, [
      'install',
      '-g',
      path.join(source, 'js-harness-0.9.0.tgz'),
      '--prefix',
      prefix,
    ]);
    assert.equal(calls[1].args[0], path.join(binDir, 'js-harness.mjs'));
    // T4: --global, or the newly installed binary's sync would act on the project it runs in.
    assert.deepEqual(calls[1].args.slice(1), ['sync', '--home', home, '--global']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(prefix, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain uses the POSIX --prefix layout (lib/node_modules) for the synced bin', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-posix-');
  const prefix = makeTmpDir('js-harness-upgrade-prefix-posix-');
  const source = makeTmpDir('js-harness-upgrade-src-posix-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    const binDir = path.join(prefix, 'lib', 'node_modules', 'js-harness', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'js-harness.mjs'), '// stub, never executed in this test');
    install(home, '0.9.0');

    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '', stderr: '' };
    };

    const code = await upgradeMain(
      ['--source', source, '--prefix', prefix, '--home', home],
      {},
      spawn,
      'linux',
    );

    assert.equal(code, 0);
    assert.equal(calls[1].args[0], path.join(binDir, 'js-harness.mjs'));
    // T4: --global, or the newly installed binary's sync would act on the project it runs in.
    assert.deepEqual(calls[1].args.slice(1), ['sync', '--home', home, '--global']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(prefix, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain spawns the PATH js-harness sync via a shell when no --prefix is given', async () => {
  const home = makeTmpDir('js-harness-upgrade-home2-');
  const source = makeTmpDir('js-harness-upgrade-src2-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    // The mocked spawn never actually runs sync, so seed the manifest it would have written.
    install(home, '0.9.0');
    const calls = [];
    const spawn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { status: 0, stdout: '', stderr: '' };
    };
    const code = await upgradeMain(['--source', source, '--home', home], {}, spawn);
    assert.equal(code, 0);
    assert.equal(calls.length, 2, 'expected one install call and one sync call');
    assert.equal(calls[1].cmd, 'js-harness');
    assert.equal(calls[1].args[0], 'sync');
    assert.equal(calls[1].args[1], '--home');
    const expectedHome = process.platform === 'win32' ? `"${home}"` : `'${home}'`;
    assert.equal(calls[1].args[2], expectedHome, 'the home path must be quoted for the shell');
    assert.equal(calls[1].args[3], '--global');
    assert.equal(calls[1].opts.shell, true, 'shell is required so .cmd shims resolve on Windows');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('statusMain resolves home and source from JS_HARNESS_HOME / JS_HARNESS_SOURCE when the flags are absent', async () => {
  const home = makeTmpDir('js-harness-status-envhome-');
  const source = makeTmpDir('js-harness-status-envsource-');
  try {
    install(home, currentVersion());
    fs.writeFileSync(path.join(source, 'js-harness-7.0.0.tgz'), '');
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    const spawn = () => {
      throw new Error('must not spawn a package manager when JS_HARNESS_SOURCE is given');
    };
    try {
      await statusMain(['--global'], { JS_HARNESS_HOME: home, JS_HARNESS_SOURCE: source }, spawn);
    } finally {
      console.log = original;
    }
    const text = lines.join('\n');
    assert.match(text, new RegExp(`manifest version: ${currentVersion()}`));
    assert.match(text, /latest available: 7\.0\.0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain resolves --prefix from JS_HARNESS_PREFIX when the flag is absent', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-envprefix-');
  const prefix = makeTmpDir('js-harness-upgrade-prefix-envprefix-');
  const source = makeTmpDir('js-harness-upgrade-src-envprefix-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    const binDir = path.join(prefix, 'node_modules', 'js-harness', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'js-harness.mjs'), '// stub, never executed in this test');
    install(home, '0.9.0');

    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '', stderr: '' };
    };

    const code = await upgradeMain(
      ['--source', source, '--home', home],
      { JS_HARNESS_PREFIX: prefix },
      spawn,
      'win32',
    );

    assert.equal(code, 0);
    assert.equal(calls[1].args[0], path.join(binDir, 'js-harness.mjs'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(prefix, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain reports a mismatch and returns 1 when the synced manifest is not the upgraded version', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-mismatch-');
  const source = makeTmpDir('js-harness-upgrade-src-mismatch-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    // No manifest written under home: simulates sync silently running some other js-harness.
    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '', stderr: '' };
    };
    const lines = [];
    const original = console.error;
    console.error = (line) => lines.push(String(line));
    let code;
    try {
      code = await upgradeMain(['--source', source, '--home', home], {}, spawn);
    } finally {
      console.error = original;
    }
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /not the upgraded one/);
    assert.match(lines.join('\n'), /js-harness sync/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain returns a non-zero code and skips sync when install fails', async () => {
  const home = makeTmpDir('js-harness-upgrade-home3-');
  const source = makeTmpDir('js-harness-upgrade-src3-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 1, stdout: '', stderr: 'boom' };
    };
    const code = await upgradeMain(['--source', source, '--home', home], {}, spawn);
    assert.equal(code, 1);
    assert.equal(calls.length, 1);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

// --- T5: `status` by location (project vs. machine), the "Command scope" rule ---

function makeRepo(prefix = 'js-harness-status-repo-') {
  const dir = makeTmpDir(prefix);
  const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
  return dir;
}

/** A repo `js-harness init` would leave, minus the files status never reads: `harness.json` pinning
 * `version`, and (with `manifest`) this clone's project manifest under the git dir. */
function makeProject({ version = currentVersion(), manifest = false } = {}) {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'harness.json'), `${JSON.stringify({ version }, null, 2)}\n`, 'utf8');
  if (manifest) {
    const dir = path.join(root, '.git', 'js-harness');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{}\n', 'utf8');
  }
  return root;
}

const noPackageManager = () => {
  throw new Error('project status must not spawn a package manager');
};

/** Runs `statusMain` and returns its exit code with everything it printed. */
async function runStatus(argv, env = {}, spawn = fakeSpawnOk(currentVersion())) {
  const out = [];
  const err = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => out.push(String(line));
  console.error = (line) => err.push(String(line));
  try {
    const code = await statusMain(argv, env, spawn);
    return { code, out: out.join('\n'), err: err.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function inDir(dir, fn) {
  const original = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(original);
  }
}

function snapshotTree(dir) {
  const out = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out[path.relative(dir, abs)] = fs.readFileSync(abs).toString('base64');
    }
  };
  walk(dir);
  return out;
}

test('status in an initialized project reports the root, both versions, the clone and the match', async () => {
  const root = makeProject({ version: currentVersion() });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 0, err);
    assert.ok(out.includes(path.basename(root)), `expected the project root in:\n${out}`);
    assert.match(out, new RegExp(`pinned version: ${currentVersion().replaceAll('.', '\\.')}`));
    assert.match(out, new RegExp(`running version: ${currentVersion().replaceAll('.', '\\.')}`));
    assert.match(out, /js-harness sync sets it up/, 'no manifest in this clone yet');
    assert.match(out, /pin and running version: match/);
    assert.doesNotMatch(out, /names the ways out/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status reports this clone as set up when its manifest exists', async () => {
  const root = makeProject({ manifest: true });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 0);
    assert.match(out, /this clone: set up/);
    assert.doesNotMatch(out, /sync sets it up/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status names the ways out, and still exits 0, when the pin differs from the running version', async () => {
  const root = makeProject({ version: '99.0.0' });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 0);
    assert.match(out, /pinned version: 99\.0\.0/);
    assert.match(out, /pin and running version: differ; js-harness sync names the ways out/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status from a subfolder of the project reports the project', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const sub = path.join(root, 'src', 'deep');
    fs.mkdirSync(sub, { recursive: true });
    const { code, out } = await runStatus(['--cwd', sub, '--home', home], {}, noPackageManager);

    assert.equal(code, 0);
    assert.match(out, /pinned version:/);
    assert.ok(out.includes(path.basename(root)));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status in a project writes nothing', async () => {
  const root = makeProject({ manifest: true });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const before = snapshotTree(root);
    const homeBefore = snapshotTree(home);

    await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.deepEqual(snapshotTree(root), before);
    assert.deepEqual(snapshotTree(home), homeBefore);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status in a project accepts --source/--pm/--prefix without using them', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code } = await runStatus(
      ['--cwd', root, '--home', home, '--source', '/nowhere', '--pm', 'nope', '--prefix', '/nowhere'],
      {},
      noPackageManager,
    );
    assert.equal(code, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status exits 1 with the sync message when harness.json has no usable pin', async () => {
  const root = makeProject({ version: 'latest' });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 1);
    assert.equal(out, '');
    assert.match(err, /cannot read the pin from .*harness\.json: its "version" is not a semver version/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status exits 1 with the sync message for a stale manifest (harness.json gone)', async () => {
  const root = makeProject({ manifest: true });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    fs.rmSync(path.join(root, 'harness.json'));
    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 1);
    assert.equal(out, '');
    assert.match(err, /this clone was initialized before \(manifest: .*manifest\.json\) but harness\.json is missing/);
    assert.equal(
      err,
      staleManifestMessage(err.match(/\(manifest: (.*)\) but/)[1]),
      'the very message sync and init print',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status exits 1 naming init and --global for a repository that is not initialized', async () => {
  const root = makeRepo();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    for (const argv of [['--cwd', root], []]) {
      const { code, out, err } = await inDir(root, () => runStatus([...argv, '--home', home], {}, noPackageManager));
      assert.equal(code, 1);
      assert.equal(out, '');
      assert.match(err, /js-harness init/);
      assert.match(err, /js-harness status --global/);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status with an explicit --cwd that is not a project exits 1 instead of falling to the machine', async () => {
  const dir = makeTmpDir('js-harness-status-nongit-');
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out, err } = await runStatus(['--cwd', dir, '--home', home], {}, noPackageManager);
    assert.equal(code, 1);
    assert.equal(out, '');
    assert.match(err, /js-harness init/);
    assert.match(err, /js-harness status --global/);

    const missing = await runStatus(['--cwd', path.join(dir, 'missing'), '--home', home], {}, noPackageManager);
    assert.equal(missing.code, 1);
    assert.match(missing.err, /no such directory/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status with no --cwd, outside any git repository, is the machine status', async () => {
  const dir = makeTmpDir('js-harness-status-nongit-');
  const home = makeTmpDir('js-harness-status-home-');
  try {
    install(home, currentVersion());
    const { code, out } = await inDir(dir, () => runStatus(['--home', home], {}, fakeSpawnOk('9.9.9')));

    assert.equal(code, 0);
    assert.match(out, new RegExp(`installed package version: ${currentVersion().replaceAll('.', '\\.')}`));
    assert.match(out, /manifest version: /);
    assert.match(out, /update available: 9\.9\.9/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status with no --cwd, inside an initialized project, is the project status', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out } = await inDir(root, () => runStatus(['--home', home], {}, noPackageManager));
    assert.equal(code, 0);
    assert.match(out, /pinned version:/);
    assert.doesNotMatch(out, /manifest version:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status --global is the machine status even inside an initialized project', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    install(home, currentVersion());
    const { code, out } = await inDir(root, () => runStatus(['--global', '--home', home], {}, fakeSpawnOk('9.9.9')));

    assert.equal(code, 0);
    assert.match(out, /installed package version: /);
    assert.match(out, /manifest version: /);
    assert.doesNotMatch(out, /pinned version:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status rejects --global with --cwd, an unknown flag and a missing value with exit 2 and a usage line', async () => {
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const cases = [
      [['--global', '--cwd', home, '--home', home], /--global cannot be combined with --cwd/],
      [['--home', home, '--bogus'], /unknown flag: --bogus/],
      [['--home', home, '--cwd'], /--cwd requires a value/],
      [['--home'], /--home requires a value/],
      [['--home', home, '--source', '--global'], /--source requires a value/],
    ];
    for (const [argv, message] of cases) {
      const { code, out, err } = await runStatus(argv, {}, noPackageManager);
      assert.equal(code, 2, argv.join(' '));
      assert.equal(out, '');
      assert.match(err, message);
      assert.match(err, /Usage: js-harness status \[--cwd <path>\] \[--home <path>\] \[--global\]/);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('updateMain and upgradeMain keep ignoring flags they do not know (parsing unchanged)', async () => {
  const original = console.log;
  console.log = () => {};
  try {
    assert.equal(await updateMain(['--bogus', '--cwd'], {}, fakeSpawnOk(currentVersion())), 0);
  } finally {
    console.log = original;
  }
});

test('status never prints the bytes of a malformed harness.json (terminal escapes included)', async () => {
  const root = makeProject({ version: '1.0.0' });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{ "version": "\u001b[2J\u001b]0;pwned\u0007", oops', 'utf8');
    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 1);
    assert.match(err, /cannot read the pin from .*harness\.json: it is not valid JSON$/);
    assert.doesNotMatch(`${out}${err}`, /\u001b|\u0007/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

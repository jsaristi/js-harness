import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installMain, syncMain, uninstallMain, currentVersion } from './install.mjs';
import { manifestPath, readManifest } from './lib/manifest.mjs';
import { initProject } from './lib/project.mjs';

// T3 (project-init): uninstallMain now spawns real `git` for its project-scope detection (see
// project.mjs's `gitTopLevel`/`resolveGitPath`) — isolate it from the host's global/system git
// config and from a git hook's own inherited GIT_DIR/GIT_INDEX_FILE, the same way
// bin/lib/project.test.mjs's `before` hook does (a pre-commit run of *that* suite broke `git
// worktree add` this exact way).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
// The empty git config lives outside the repository, so it is removed with the suite.
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-home-'));
}

function makeTmpProjectRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-project-'));
  const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
  return dir;
}

/** A spawn for `initProject` that runs `git` for real but never touches a real `codegraph` binary —
 * only needed to seed an initialized project fixture; `uninstallMain`'s own project-scope path never
 * spawns codegraph at all. */
function fakeCodegraphSpawn() {
  return (cmd, args, opts) => {
    if (cmd === 'git') return spawnSync('git', args, opts);
    if (opts?.cwd) fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
    return { status: 0, stdout: '', stderr: '' };
  };
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

test('currentVersion reads this package\'s own package.json version', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8'));
  assert.equal(currentVersion(), pkg.version);
});

test('installMain writes the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    const code = await installMain(['--home', home]);
    assert.equal(code, 0);
    const manifest = readManifest(home);
    assert.equal(manifest.version, currentVersion());
    assert.ok(manifest.files.length > 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain updates the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    // T4: pinned with --global so this machine test never depends on the project (if any) the test
    // runner's own cwd happens to sit in.
    const code = await syncMain(['--global', '--home', home]);
    assert.equal(code, 0);
    assert.equal(readManifest(home).version, currentVersion());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain removes the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    // T3b item 6, R3-uninstall-cwd-dependent-machine-tests: pinned with --global so this machine
    // test never depends on whatever project (if any) the test runner's own cwd happens to sit in.
    const code = await uninstallMain(['--global', '--home', home]);
    assert.equal(code, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('installMain resolves home from JS_HARNESS_HOME when --home is not given', async () => {
  const home = makeTmpHome();
  try {
    const code = await installMain([], { JS_HARNESS_HOME: home });
    assert.equal(code, 0);
    assert.equal(readManifest(home).version, currentVersion());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-001 (accepted final review follow-up, lineage review-cef5637e2884c12a): a component write that
// fails on an already-installed target is reported to the user, not silently dropped. Injected
// through the `deps.writeFile` seam manifest.mjs's `install`/`sync` now accept (chmod is unreliable
// on Windows, so a real permission failure is not how this is simulated).

test('syncMain prints a stderr skip line when a component write fails, naming the path and reason', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const manifest = readManifest(home);
    const target = manifest.files[0].path;
    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };

    const errLines = [];
    const originalError = console.error;
    console.error = (line) => errLines.push(String(line));
    let code;
    try {
      code = await syncMain(['--global', '--home', home], process.env, { writeFile: failingWriteFile });
    } finally {
      console.error = originalError;
    }

    assert.equal(code, 0);
    assert.ok(
      errLines.includes(`skipped ${target}: EACCES: permission denied`),
      `expected a skip line for ${target}, got:\n${errLines.join('\n')}`,
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain counts only the files it actually wrote, not records carried forward after a failed write', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const total = readManifest(home).files.length;
    const target = readManifest(home).files[0].path;
    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };

    const outLines = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (line) => outLines.push(String(line));
    console.error = () => {};
    try {
      await syncMain(['--global', '--home', home], process.env, { writeFile: failingWriteFile });
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }

    assert.match(outLines[0], new RegExp(`\\(${total - 1} files\\)`));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain and uninstallMain also resolve home from JS_HARNESS_HOME when --home is not given', async () => {
  const home = makeTmpHome();
  try {
    await installMain([], { JS_HARNESS_HOME: home });
    const syncCode = await syncMain(['--global'], { JS_HARNESS_HOME: home });
    assert.equal(syncCode, 0);
    assert.equal(readManifest(home).version, currentVersion());

    // T3b item 6, R3-uninstall-cwd-dependent-machine-tests: pinned with --global (see above).
    const uninstallCode = await uninstallMain(['--global'], { JS_HARNESS_HOME: home });
    assert.equal(uninstallCode, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T3 (project-init): uninstallMain's scope routing — see project.mjs's uninstallProject and
// "T3 design" ---

test('uninstallMain rejects an unknown flag with usage and exit 2', async () => {
  const { code, errLines } = await captureConsole(() => uninstallMain(['--bogus']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('unknown flag: --bogus')));
  assert.ok(errLines.some((l) => l.includes('Usage: js-harness uninstall')));
});

test('uninstallMain rejects --cwd with no value, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => uninstallMain(['--cwd']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--cwd requires a value')));
});

test('uninstallMain rejects --home with no value, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => uninstallMain(['--home']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--home requires a value')));
});

test('uninstallMain rejects --global combined with --cwd, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => uninstallMain(['--global', '--cwd', '/tmp/whatever']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--global cannot be combined with --cwd')));
});

test('uninstallMain --cwd undoes the project and prints its own report', async () => {
  const root = makeTmpProjectRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);

    const { code, outLines } = await captureConsole(() => uninstallMain(['--cwd', root]));

    assert.equal(code, 0);
    assert.ok(outLines.includes('removed harness.json'));
    assert.ok(outLines.includes('removed AGENTS.md'));
    assert.ok(outLines.includes('removed .codegraph/'));
    assert.ok(outLines.some((l) => l.startsWith('removed manifest ')));
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallMain --cwd reports a kept file on stderr with its reason', async () => {
  const root = makeTmpProjectRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'edited by hand\n', 'utf8');

    const { code, errLines } = await captureConsole(() => uninstallMain(['--cwd', root]));

    assert.equal(code, 0); // a kept file is not a failure
    assert.ok(errLines.includes('kept AGENTS.md (changed since init)'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// An explicit `--cwd` names a project, so a folder that is not an initialized one is an error, never
// a silent fall-through to the machine: a second `uninstall --cwd <repo>` after the first one would
// otherwise remove the machine install.
for (const [label, makeCwd] of [
  ['outside any git repository', () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-notaproject-'))],
  ['in a git repository init never touched', makeTmpProjectRepo],
]) {
  test(`uninstallMain --cwd ${label} exits 1 and leaves the machine install alone`, async () => {
    const home = makeTmpHome();
    const cwd = makeCwd();
    try {
      await installMain(['--home', home]);

      const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--cwd', cwd, '--home', home]));

      assert.equal(code, 1);
      assert.equal(fs.existsSync(manifestPath(home)), true);
      assert.deepEqual(outLines, []);
      assert.ok(errLines.some((l) => l.includes('not an initialized project') && l.includes('--global')));
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('uninstallMain --global reaches the machine even from inside an initialized project, leaving it untouched', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    await installMain(['--home', home]);

    const originalCwd = process.cwd();
    process.chdir(root);
    let result;
    try {
      result = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    } finally {
      process.chdir(originalCwd);
    }

    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false); // the machine install was reached
    // The project itself is completely untouched.
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
    assert.ok(fs.existsSync(initResult.manifestPath));
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/** Runs `fn` with `dir` as the process cwd, restoring the original cwd afterwards. */
async function inDir(dir, fn) {
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(originalCwd);
  }
}

// Sebastián's rule (roadmap, Decided: "Command scope"): with no flags, inside a git repository that
// is not an initialized project — a second `uninstall` in the same repo, say — `uninstall` refuses
// and names --global instead of removing the machine install.
test('uninstallMain with no flags inside an uninitialized git repository exits 1 and leaves the machine install alone', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);

    const { code, outLines, errLines } = await inDir(root, () => captureConsole(() => uninstallMain(['--home', home])));

    assert.equal(code, 1);
    assert.equal(fs.existsSync(manifestPath(home)), true);
    assert.deepEqual(outLines, []);
    assert.ok(errLines.some((l) => l.includes('not an initialized project') && l.includes('--global')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain run twice in the same project undoes it once, then refuses rather than reaching the machine', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    assert.equal(initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' }).code, 0);
    await installMain(['--home', home]);

    const first = await inDir(root, () => captureConsole(() => uninstallMain(['--home', home])));
    const second = await inDir(root, () => captureConsole(() => uninstallMain(['--home', home])));

    assert.equal(first.code, 0);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(second.code, 1);
    assert.equal(fs.existsSync(manifestPath(home)), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain with no flags outside any git repository still undoes the machine install', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-nogit-'));
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);

    const { code } = await inDir(dir, () => captureConsole(() => uninstallMain(['--home', home])));

    assert.equal(code, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T4 (project-init): syncMain's scope routing — see project.mjs's syncProject and "T4 design" ---

/** A fresh clone of an initialized project: `harness.json` pinned to `version` and a committed
 * `AGENTS.md`, but no manifest, hook or `.codegraph/` in this clone. */
function makeTmpClone(version = currentVersion(), { agents = true } = {}) {
  const dir = makeTmpProjectRepo();
  fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify({ version }, null, 2) + '\n', 'utf8');
  if (agents) fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# committed\n', 'utf8');
  return dir;
}

const projectDeps = () => ({ spawn: fakeCodegraphSpawn(), platform: 'linux' });

test('syncMain rejects an unknown flag with usage and exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--bogus']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('unknown flag: --bogus')));
  assert.ok(errLines.some((l) => l.includes('Usage: js-harness sync')));
});

test('syncMain rejects --cwd with no value, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--cwd']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--cwd requires a value')));
});

test('syncMain rejects --home with no value, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--home']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--home requires a value')));
});

test('syncMain rejects --home followed by another flag, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--home', '--global']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--home requires a value')));
});

test('syncMain rejects --global combined with --cwd, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--global', '--cwd', '/tmp/whatever']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--global cannot be combined with --cwd')));
});

test('syncMain --cwd sets a fresh clone up, prints what it wrote, and a second run says up to date', async () => {
  const root = makeTmpClone();
  try {
    const first = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(first.code, 0);
    assert.ok(first.outLines.includes('wrote .git/hooks/pre-commit'));
    assert.ok(first.outLines.includes('ran codegraph init'));
    assert.ok(first.outLines.some((l) => l.startsWith('manifest: ')));
    assert.ok(first.errLines.includes('kept harness.json (committed)'));
    assert.ok(first.errLines.includes('kept AGENTS.md (committed)'));
    assert.ok(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')));

    const second = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(second.code, 0);
    assert.deepEqual(second.outLines, [`up to date at ${currentVersion()}`]);
    assert.deepEqual(second.errLines, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd reports a missing AGENTS.md as a skip on stderr and does not create it', async () => {
  const root = makeTmpClone(currentVersion(), { agents: false });
  try {
    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 0);
    assert.ok(errLines.some((l) => l.startsWith('AGENTS.md skipped: ')));
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd restores a gone hook and prints it', async () => {
  const root = makeTmpProjectRepo();
  try {
    assert.equal(initProject(root, currentVersion(), projectDeps()).code, 0);
    fs.rmSync(path.join(root, '.git', 'hooks', 'pre-commit'));

    const { code, outLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 0);
    assert.ok(outLines.includes('wrote .git/hooks/pre-commit'));
    assert.ok(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd reports a codegraph failure on stderr and still exits 0', async () => {
  const root = makeTmpClone();
  try {
    const failing = (cmd, args, opts) =>
      cmd === 'git' ? spawnSync('git', args, opts) : { status: 1, stdout: '', stderr: 'codegraph exploded' };

    const { code, errLines } = await captureConsole(() =>
      syncMain(['--cwd', root], process.env, { spawn: failing, platform: 'linux' }),
    );

    assert.equal(code, 0);
    assert.ok(errLines.some((l) => l.startsWith('codegraph init failed: ') && l.includes('codegraph exploded')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain with a pin different from the running version writes nothing, exits 1 and names both ways out', async () => {
  const root = makeTmpClone('9.9.9');
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const machineManifest = fs.readFileSync(manifestPath(home));

    const { code, outLines, errLines } = await captureConsole(() =>
      syncMain(['--cwd', root, '--home', home], process.env, projectDeps()),
    );

    assert.equal(code, 1);
    assert.deepEqual(outLines, []);
    const message = errLines.join('\n');
    assert.match(message, /9\.9\.9/);
    assert.ok(message.includes(currentVersion()));
    assert.ok(message.includes('npm i -g github:jsaristi/js-harness#v9.9.9'));
    assert.match(message, /raise the pin.*harness\.json/i);
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
    assert.deepEqual(fs.readFileSync(manifestPath(home)), machineManifest); // the machine install is untouched too
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain --cwd names harness.json and exits 1 when it has no version', async () => {
  const root = makeTmpProjectRepo();
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{ not json', 'utf8');

    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => l.includes('harness.json') && l.includes('nothing was written')));
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd refuses a stale manifest with the same wording init uses, exit 1', async () => {
  const root = makeTmpProjectRepo();
  try {
    assert.equal(initProject(root, currentVersion(), projectDeps()).code, 0);
    fs.rmSync(path.join(root, 'harness.json'));

    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => l.includes('was initialized before') && l.includes('harness.json is missing')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd reports a malformed manifest, exit 1', async () => {
  const root = makeTmpProjectRepo();
  try {
    const initResult = initProject(root, currentVersion(), projectDeps());
    fs.writeFileSync(initResult.manifestPath, '{ not json', 'utf8');

    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => l.includes('is malformed')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd reports a failed write as "sync failed", says what was left behind, and exits 1', async () => {
  const root = makeTmpClone();
  try {
    const open = () => {
      throw new Error('ENOSPC: no space left on device');
    };

    const { code, errLines } = await captureConsole(() =>
      syncMain(['--cwd', root], process.env, { ...projectDeps(), open }),
    );

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => l.startsWith('sync failed: ') && l.includes('ENOSPC') && l.includes('nothing was left behind')));
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd with a directory that does not exist says so, exit 1', async () => {
  const missing = path.join(os.tmpdir(), 'js-harness-cli-sync-missing-dir');
  const { code, errLines } = await captureConsole(() => syncMain(['--cwd', missing]));
  assert.equal(code, 1);
  assert.ok(errLines.includes(`no such directory: ${missing}`));
});

// An explicit `--cwd` names a project, so a folder that is not an initialized one is an error, never
// a silent fall-through to the machine.
for (const [label, makeCwd] of [
  ['outside any git repository', () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-sync-notaproject-'))],
  ['in a git repository init never touched', makeTmpProjectRepo],
]) {
  test(`syncMain --cwd ${label} exits 1, names --global and leaves the machine install alone`, async () => {
    const home = makeTmpHome();
    const cwd = makeCwd();
    try {
      await installMain(['--home', home]);
      const before = fs.readFileSync(manifestPath(home));

      const { code, outLines, errLines } = await captureConsole(() => syncMain(['--cwd', cwd, '--home', home]));

      assert.equal(code, 1);
      assert.deepEqual(outLines, []);
      assert.ok(errLines.some((l) => l.includes('not an initialized project') && l.includes('--global')));
      assert.deepEqual(fs.readFileSync(manifestPath(home)), before);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('syncMain with no flags inside an uninitialized git repository exits 1 and names --global', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const before = fs.readFileSync(manifestPath(home));

    const { code, outLines, errLines } = await inDir(root, () => captureConsole(() => syncMain(['--home', home])));

    assert.equal(code, 1);
    assert.deepEqual(outLines, []);
    assert.ok(errLines.some((l) => l.includes('not an initialized project') && l.includes('--global')));
    assert.deepEqual(fs.readFileSync(manifestPath(home)), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain with no flags inside an initialized project syncs the project, not the machine', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    assert.equal(initProject(root, currentVersion(), projectDeps()).code, 0);
    fs.rmSync(path.join(root, '.git', 'hooks', 'pre-commit'));

    const { code, outLines } = await inDir(root, () =>
      captureConsole(() => syncMain(['--home', home], process.env, projectDeps())),
    );

    assert.equal(code, 0);
    assert.ok(outLines.includes('wrote .git/hooks/pre-commit'));
    assert.equal(fs.existsSync(manifestPath(home)), false); // nothing was installed on the machine
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain --global reaches the machine even from inside an initialized project, leaving it untouched', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    const initResult = initProject(root, currentVersion(), projectDeps());
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, '.git', 'hooks', 'pre-commit'));
    await installMain(['--home', home]);

    const { code, outLines } = await inDir(root, () => captureConsole(() => syncMain(['--global', '--home', home])));

    assert.equal(code, 0);
    assert.ok(outLines.some((l) => l.startsWith('synced js-harness ')));
    assert.equal(readManifest(home).version, currentVersion());
    // The project is completely untouched: the gone hook stays gone.
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain with no flags outside any git repository still syncs the machine install', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-sync-nogit-'));
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);

    const { code, outLines } = await inDir(dir, () => captureConsole(() => syncMain(['--home', home])));

    assert.equal(code, 0);
    assert.ok(outLines.some((l) => l.startsWith('synced js-harness ')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain never prints the bytes of a malformed harness.json (terminal escapes included)', async () => {
  const root = makeTmpClone();
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{ "version": "\u001b[2J\u001b]0;pwned\u0007", oops', 'utf8');
    const { code, outLines, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => /harness\.json: it is not valid JSON; nothing was written$/.test(l)));
    assert.doesNotMatch([...outLines, ...errLines].join('\n'), /\u001b|\u0007/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

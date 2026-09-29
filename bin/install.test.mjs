import { test, before } from 'node:test';
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
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
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
    const code = await syncMain(['--home', home]);
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
      code = await syncMain(['--home', home], process.env, { writeFile: failingWriteFile });
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
      await syncMain(['--home', home], process.env, { writeFile: failingWriteFile });
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
    const syncCode = await syncMain([], { JS_HARNESS_HOME: home });
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

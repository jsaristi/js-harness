import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initMain } from './init.mjs';

// T2e item 8 (R3-tests-depend-on-host-git-config): isolate every real `git` call this file makes
// (directly, or through the engine's default `spawnSync`, which inherits `process.env`) from the
// host's own global/system config — see bin/lib/project.test.mjs's identical `before` hook.
before(() => {
  // A git hook runs with GIT_DIR, GIT_INDEX_FILE and friends pointing at the repository being
  // committed; inherited here, they would send every git call below to that repository instead
  // of the test's own (a pre-commit run of this suite broke `git worktree add` that way).
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-init-cli-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});

function makeTmpRepo(prefix = 'js-harness-init-cli-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const result = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, `git init failed: ${result.stderr}`);
  return dir;
}

function makeTmpDir(prefix = 'js-harness-init-cli-nongit-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-init-cli-home-'));
}

/** Never touches a real `codegraph` binary: pre-creating `.codegraph` in each fixture repo means
 * `initProject` skips the spawn entirely, so most tests here need no fake spawn at all. Tests that
 * do need codegraph to run supply one explicitly. */
function withCodegraphSkipped(root) {
  fs.mkdirSync(path.join(root, '.codegraph'), { recursive: true });
}

test('initMain outside a git repository prints to stderr and exits 1', async () => {
  const dir = makeTmpDir();
  const home = makeTmpHome();
  try {
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', dir, '--home', home], process.env, {});
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /not a git repository: run git init first/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain on a fresh repo writes the four actions and exits 0', async () => {
  const root = makeTmpRepo();
  const home = makeTmpHome();
  withCodegraphSkipped(root);
  try {
    let stdout = '';
    const origLog = console.log;
    console.log = (msg) => {
      stdout += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, {});
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    assert.match(stdout, /wrote harness\.json/);
    assert.match(stdout, /wrote AGENTS\.md/);
    assert.match(stdout, /wrote .*pre-commit/);
    assert.match(stdout, /manifest: /);
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain reports already initialized and exits 0 without writing anything', async () => {
  const root = makeTmpRepo();
  const home = makeTmpHome();
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({ version: '0.0.1' }, null, 2) + '\n', 'utf8');
  try {
    let stdout = '';
    const origLog = console.log;
    console.log = (msg) => {
      stdout += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, {});
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    assert.match(stdout, /already initialized at 0\.0\.1/);
    assert.match(stdout, /js-harness sync/);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain rejects an unknown flag with a usage error and exits 2', async () => {
  const root = makeTmpRepo();
  withCodegraphSkipped(root);
  try {
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--bogus'], process.env, {});
    } finally {
      console.error = origError;
    }
    assert.equal(code, 2);
    assert.match(stderr, /Usage: js-harness init/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initMain rejects --cwd with a missing value and exits 2', async () => {
  let stderr = '';
  const origError = console.error;
  console.error = (msg) => {
    stderr += `${msg}\n`;
  };
  let code;
  try {
    code = await initMain(['--cwd'], process.env, {});
  } finally {
    console.error = origError;
  }
  assert.equal(code, 2);
  assert.match(stderr, /--cwd requires a value/);
});

// T2c Codex P1 + R3-rollback-deletes-preexisting-manifest
test('initMain reports a stale manifest without harness.json on stderr and exits 1', async () => {
  const root = makeTmpRepo();
  try {
    const manifestDir = path.join(root, '.git', 'js-harness');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'manifest.json'), '{}', 'utf8');

    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    // Never rely on the guard alone to keep this hermetic: inject a spawn that only ever answers
    // `git` for real and never a real `codegraph`, in case a future/older code path reaches it.
    const spawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync('git', args, opts) : { status: 0, stdout: '', stderr: '' });
    let code;
    try {
      code = await initMain(['--cwd', root], process.env, { spawn, platform: 'linux' });
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /this clone was initialized before/);
    assert.match(stderr, /harness\.json is missing/);
    assert.match(stderr, /js-harness uninstall/);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initMain reports no such directory on stderr and exits 1 when --cwd does not exist', async () => {
  const parent = makeTmpDir();
  const missing = path.join(parent, 'nope');
  try {
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', missing], process.env, {});
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /no such directory/);
    assert.ok(stderr.includes(missing));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// T2b Codex P1 + R3-init-partial-failure-unrecoverable
test('initMain reports a rolled-back write failure on stderr and exits 1', async () => {
  const root = makeTmpRepo();
  try {
    const writeFile = (target, content, enc) => {
      if (target.endsWith('AGENTS.md')) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(target, content, enc);
    };
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root], process.env, { writeFile });
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /init failed:/);
    assert.match(stderr, /nothing was left behind/);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2c R3-retry-manifest-write-unguarded; T2e item 2 (.codegraph/ removal is now attempted, and
// this scenario's directory did not exist before the retry, so it succeeds — "nothing was left
// behind" is the truthful message now, not "removed everything it wrote except .codegraph/").
test('initMain reports a codegraph-retry manifest write failure on stderr and exits 1', async () => {
  const root = makeTmpRepo();
  try {
    const failSpawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync('git', args, opts) : { status: 1, stdout: '', stderr: 'boom' });
    await initMain(['--cwd', root], process.env, { spawn: failSpawn, platform: 'linux' });

    const okSpawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
      return { status: 0, stdout: '', stderr: '' };
    };
    // T2e item 3: the manifest's temp file now has a unique name, not a fixed `<target>.tmp`.
    // T2g R3-001: the manifest's own exclusive-create write is injected separately from the general
    // `writeFile` (see `writeManifestAtomic` in bin/lib/project.mjs) — faulting it here means
    // failing the `open` step, not `writeFile`.
    const open = (tmp) => {
      throw new Error('EACCES: permission denied');
    };
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root], process.env, { spawn: okSpawn, platform: 'linux', open });
    } finally {
      console.error = origError;
    }
    assert.equal(code, 1);
    assert.match(stderr, /init failed:/);
    assert.match(stderr, /manifest could not be updated/);
    assert.match(stderr, /nothing was left behind/);
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T2b item 2: codegraph retry on a re-run
test('initMain retries codegraph on a re-run after a prior failure and reports the outcome', async () => {
  const root = makeTmpRepo();
  const home = makeTmpHome();
  try {
    const failSpawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync('git', args, opts) : { status: 1, stdout: '', stderr: 'boom' });
    await initMain(['--cwd', root, '--home', home], process.env, { spawn: failSpawn, platform: 'linux' });

    const okSpawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
      return { status: 0, stdout: '', stderr: '' };
    };
    let stdout = '';
    const origLog = console.log;
    console.log = (msg) => {
      stdout += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, { spawn: okSpawn, platform: 'linux' });
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    assert.match(stdout, /retrying codegraph init/);
    assert.match(stdout, /ran codegraph init/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('initMain reports a codegraph failure on stderr and still exits 0', async () => {
  const root = makeTmpRepo();
  const home = makeTmpHome();
  try {
    const spawn = (cmd, args, opts) => {
      if (cmd === 'git') return spawnSync('git', args, opts);
      return { status: 1, stdout: '', stderr: 'boom' };
    };
    let stderr = '';
    const origError = console.error;
    console.error = (msg) => {
      stderr += `${msg}\n`;
    };
    let code;
    try {
      code = await initMain(['--cwd', root, '--home', home], process.env, { spawn, platform: 'linux' });
    } finally {
      console.error = origError;
    }
    assert.equal(code, 0);
    assert.match(stderr, /codegraph/);
    assert.match(stderr, /boom/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

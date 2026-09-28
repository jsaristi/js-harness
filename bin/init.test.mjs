import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initMain } from './init.mjs';

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

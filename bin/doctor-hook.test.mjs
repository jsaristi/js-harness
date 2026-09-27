import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctorMain } from './doctor.mjs';
import { readCache } from './lib/cache.mjs';

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-doctor-hook-home-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// The hook path never touches the network in these tests: a resolved-but-unsuccessful fetch is
// enough to exercise "the cache was stale, a fetch was attempted, and it did not help" without
// depending on the internet.
const failFetch = async () => ({ ok: false });

function fakeSpawnMissing() {
  return () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });
}

/** A fully "healthy" fixture home, matching doctor.test.mjs's own — every tool installed and
 * configured everywhere it applies, so the report has zero gaps. */
function seedHealthyHome(home, project) {
  writeJson(path.join(home, '.gentle-ai', 'state.json'), { installed_agents: ['claude-code', 'codex'] });
  writeJson(path.join(home, '.claude.json'), {
    mcpServers: {
      engram: { command: 'engram' },
      codegraph: { command: 'codegraph' },
      context7: { type: 'http', url: 'https://mcp.context7.com/mcp' },
    },
  });
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.codex', 'config.toml'),
    '[mcp_servers.engram]\ncommand = "engram"\n\n[mcp_servers.codegraph]\ncommand = "codegraph"\n\n' +
      '[mcp_servers.context7]\nurl = "x"\n',
    'utf8',
  );
  writeJson(path.join(home, '.claude', 'settings.json'), {
    enabledPlugins: { 'typescript-lsp@claude-plugins-official': true },
  });
  writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
    plugins: { 'typescript-lsp@claude-plugins-official': [{ version: '1.0.0' }] },
  });
  fs.mkdirSync(path.join(project, '.codegraph'), { recursive: true });
}

function healthySpawn(project) {
  return (cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: `${project}\n`, stderr: '' };
    // On win32 a probe arrives as one shell command line ("codegraph --version"), so match its binary.
    const binary = cmd.split(' ')[0];
    if (['gentle-ai', 'engram', 'codegraph'].includes(binary)) return { status: 0, stdout: `${binary} 9.9.9\n`, stderr: '' };
    return { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
  };
}

async function runHook(argv, env, deps) {
  let stdout = '';
  let stderr = '';
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => {
    stdout += `${line}\n`;
  };
  console.error = (line) => {
    stderr += `${line}\n`;
  };
  try {
    const code = await doctorMain(argv, env, deps);
    return { code, stdout, stderr };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('doctor --hook prints one systemMessage line with the gap count on the first run with gaps', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // Empty home + no git repo: every applicable dimension is `missing`, so there are gaps.
    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: fakeSpawnMissing(), fetch: failFetch },
    );

    assert.equal(code, 0);
    assert.equal(stderr, '');
    const parsed = JSON.parse(stdout.trim());
    assert.match(parsed.systemMessage, /^js-harness: \d+ stack gaps? — run js-harness doctor$/);

    const cache = readCache(home);
    assert.ok(cache.notified);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook prints nothing on a second run with the same gaps', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = { spawn: fakeSpawnMissing(), fetch: failFetch };
    const first = await runHook(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.ok(first.stdout.trim().length > 0);

    const second = await runHook(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.equal(second.code, 0);
    assert.equal(second.stdout, '');
    assert.equal(second.stderr, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook prints again when the gaps change', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = { spawn: fakeSpawnMissing(), fetch: failFetch };
    const first = await runHook(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.ok(first.stdout.trim().length > 0);

    // Close one gap: register gentle-ai for both hosts, changing the gap list and its digest.
    writeJson(path.join(home, '.gentle-ai', 'state.json'), { installed_agents: ['claude-code', 'codex'] });

    const second = await runHook(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.equal(second.code, 0);
    assert.ok(second.stdout.trim().length > 0);
    assert.notEqual(second.stdout, first.stdout);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook prints nothing and stores an empty digest when there are no gaps', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home, project);
    const fetchImpl = async (url) => ({
      ok: true,
      json: async () => (url.includes('registry.npmjs.org') ? { version: '0.0.1' } : { tag_name: 'v0.0.1' }),
    });

    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: healthySpawn(project), fetch: fetchImpl },
    );

    assert.equal(code, 0);
    assert.equal(stdout, '');
    assert.equal(stderr, '');
    const cache = readCache(home);
    assert.equal(cache.notified, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// R3-101 (accepted T2/T3 review follow-up) made `writeCache` itself best-effort, so a `--home`
// that is a file no longer throws there — the hook now computes and reports its (very real: an
// unreadable home reads every dimension as missing) gaps normally instead of going silent.
test('doctor --hook still reports gaps and exits 0 when the cache cannot be written (home is a file)', async () => {
  const parentDir = makeTmpHome();
  const home = path.join(parentDir, 'not-a-directory');
  fs.writeFileSync(home, '', 'utf8');
  const project = makeTmpHome();
  try {
    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: fakeSpawnMissing(), fetch: failFetch },
    );
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout.trim());
    assert.match(parsed.systemMessage, /^js-harness: \d+ stack gaps? — run js-harness doctor$/);
    assert.equal(stderr, '');
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook exits 0 with empty stdout and stderr even when something inside throws', async () => {
  // An injected `now()` that throws simulates a genuinely unexpected internal failure (as opposed
  // to a probe's own documented fail-open path), reaching hookMain's outer catch-all — the backstop
  // T3 added so a `SessionStart` hook can never break a session, no matter what throws underneath.
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // `isStale` only calls `now()` once it has a real checkedAt to compare against.
    writeJson(path.join(home, '.js-harness', 'doctor.json'), {
      latest: { checkedAt: new Date().toISOString(), versions: {} },
      notified: null,
    });
    const throwingNow = () => {
      throw new Error('clock unavailable');
    };
    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: fakeSpawnMissing(), fetch: failFetch, now: throwingNow },
    );
    assert.equal(code, 0);
    assert.equal(stdout, '');
    assert.equal(stderr, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook exits 0 with empty stdout and stderr even on unusable arguments', async () => {
  const { code, stdout, stderr } = await runHook(['--hook', '--home'], {}, { fetch: failFetch });
  assert.equal(code, 0);
  assert.equal(stdout, '');
  assert.equal(stderr, '');
});

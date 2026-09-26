import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctorMain } from './doctor.mjs';
import { readCache, writeCache } from './lib/cache.mjs';

// T2 introduces a real default `fetch` for latest-version lookups. Every test below that does not
// specifically exercise the network path injects this instead, so the suite never depends on
// internet access — a failed fetch is itself a valid, tested outcome (`upToDate: 'unknown'`).
const noopFetch = async () => {
  throw new Error('network disabled in tests');
};

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-doctor-home-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/** A fully "healthy" fixture home: every tool installed and configured everywhere it applies. */
function seedHealthyHome(home) {
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
}

/** A fake spawn: resolves `git rev-parse --show-toplevel` to `gitToplevel` (or fails, as a real
 * one would outside a repo), and any version command named in `versions` to its stdout. Anything
 * else looks like a missing binary — never a real spawn, never the network. */
function fakeSpawn({ versions = {}, gitToplevel } = {}) {
  return (cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') {
      return gitToplevel
        ? { status: 0, stdout: `${gitToplevel}\n`, stderr: '' }
        : { status: 128, stdout: '', stderr: 'not a git repository' };
    }
    if (versions[cmd]) return { status: 0, stdout: versions[cmd], stderr: '' };
    return { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
  };
}

/** Runs `doctorMain`, capturing everything it printed via console.log and the exit code. */
async function runDoctor(argv, env, deps) {
  let output = '';
  const original = console.log;
  console.log = (line) => {
    output += `${line}\n`;
  };
  try {
    const code = await doctorMain(argv, env, deps);
    return { code, output };
  } finally {
    console.log = original;
  }
}

test('doctorMain prints one line per tool and exits 0 on a fully healthy fixture', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    const spawn = fakeSpawn({
      versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' },
      gitToplevel: project,
    });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    for (const id of ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp']) {
      assert.match(output, new RegExp(id));
    }
    assert.match(output, /3\.7\.0/);
    assert.match(output, /hosted/);
    assert.doesNotMatch(output, /\nFix:/, 'a fully healthy fixture must report no gaps');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain --json prints a parseable array with the five tool ids and upToDate unknown (or n/a for hosted context7)', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.deepEqual(
      rows.map((r) => r.id),
      ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp'],
    );
    for (const row of rows) {
      // Network is disabled and there is no cache, so every real lookup fails open to `unknown` —
      // except hosted context7, which has no version of its own to compare and is `n/a` instead.
      assert.equal(row.upToDate, row.id === 'context7' ? 'n/a' : 'unknown');
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain names the fix commands for gaps and never recommends codegraph upgrade', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // Empty home + no git repo: every dimension that applies is `missing`.
    const spawn = fakeSpawn({});

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    assert.match(output, /Fix:/);
    assert.match(output, /codegraph: npm i -g @colbymchenry\/codegraph/);
    assert.doesNotMatch(output, /codegraph upgrade/);
    assert.match(output, /gentle-ai: gentle-ai upgrade/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain resolves --home from JS_HARNESS_HOME when the flag is absent', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });

    const { code, output } = await runDoctor(
      ['--cwd', project, '--json'],
      { JS_HARNESS_HOME: home },
      { spawn, fetch: noopFetch },
    );

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'gentle-ai').claude, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain resolves the project root through the injected spawn\'s git toplevel', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    fs.mkdirSync(path.join(project, '.codegraph'));
    const nested = path.join(project, 'nested', 'dir');
    fs.mkdirSync(nested, { recursive: true });
    const spawn = fakeSpawn({ gitToplevel: project });

    const { code, output } = await runDoctor(['--home', home, '--cwd', nested, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'codegraph').project, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain never throws and always exits 0, even on a completely empty home outside any repo', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({});
    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });
    assert.equal(code, 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- T2: latest-version lookup, cache, `outdated`, `--offline` ---

test('doctorMain marks a tool ok when its installed version is at least the fetched latest', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const fetchImpl = async (url) =>
      url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v3.7.0' }) } : { ok: false };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'gentle-ai').upToDate, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain marks a tool outdated and lists its fix when the fetched latest is newer', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const fetchImpl = async (url) =>
      url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v4.0.0' }) } : { ok: false };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    assert.match(output, /gentle-ai\s.*outdated/);
    assert.match(output, /Fix:\n +gentle-ai: gentle-ai upgrade/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain --offline reads only the cache and never calls fetch', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeCache(home, {
      latest: { checkedAt: new Date(0).toISOString(), versions: { 'gentle-ai': '9.9.9' } },
      notified: null,
    });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      throw new Error('must not be called in --offline mode');
    };

    const { code, output } = await runDoctor(
      ['--home', home, '--cwd', project, '--json', '--offline'],
      {},
      { spawn, fetch: fetchImpl },
    );

    assert.equal(code, 0);
    assert.equal(fetchCalled, false);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'gentle-ai').upToDate, 'outdated');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain skips fetching when the cache was checked within the last 6 hours', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeCache(home, {
      latest: { checkedAt: new Date().toISOString(), versions: { 'gentle-ai': '3.7.0' } },
      notified: null,
    });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({ tag_name: 'v3.7.0' }) };
    };

    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    assert.equal(fetchCalled, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain refetches and updates the cache when it is stale, storing a fresh checkedAt', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeCache(home, {
      latest: { checkedAt: new Date(0).toISOString(), versions: { 'gentle-ai': '1.0.0' } },
      notified: null,
    });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const fetchImpl = async (url) =>
      url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v4.0.0' }) } : { ok: false };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'gentle-ai').upToDate, 'outdated');

    const cache = readCache(home);
    assert.equal(cache.latest.versions['gentle-ai'], '4.0.0');
    assert.notEqual(cache.latest.checkedAt, new Date(0).toISOString());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a failed fetch for one tool keeps its previously cached version; a successful one still refreshes', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeCache(home, {
      latest: { checkedAt: new Date(0).toISOString(), versions: { engram: '2.0.0', 'gentle-ai': '1.0.0' } },
      notified: null,
    });
    const spawn = fakeSpawn({});
    const fetchImpl = async (url) => {
      if (url.includes('gentle-ai')) throw new Error('offline for this tool only');
      if (url.includes('Gentleman-Programming/engram')) return { ok: true, json: async () => ({ tag_name: 'v2.2.1' }) };
      return { ok: false };
    };

    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });
    assert.equal(code, 0);

    const cache = readCache(home);
    assert.equal(cache.latest.versions['gentle-ai'], '1.0.0', 'kept: this tool could not be refreshed');
    assert.equal(cache.latest.versions.engram, '2.2.1', 'refreshed: this tool succeeded');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a malformed cache file is treated as absent, not a crash', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.js-harness', 'doctor.json'), 'not json', 'utf8');
    const spawn = fakeSpawn({});

    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- R3-003: a flag missing its value, or immediately followed by another flag, is an error ---

async function runDoctorExpectingError(argv) {
  let errOutput = '';
  const originalError = console.error;
  console.error = (line) => {
    errOutput += `${line}\n`;
  };
  try {
    const code = await doctorMain(argv, {}, {});
    return { code, errOutput };
  } finally {
    console.error = originalError;
  }
}

test('doctorMain errors with usage on stderr and exits 2 when --home is the last argument', async () => {
  const { code, errOutput } = await runDoctorExpectingError(['--home']);
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness doctor/);
});

test('doctorMain errors with usage on stderr and exits 2 when --home is immediately followed by another flag', async () => {
  const { code, errOutput } = await runDoctorExpectingError(['--home', '--json']);
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness doctor/);
});

test('doctorMain errors with usage on stderr and exits 2 when --cwd is missing its value', async () => {
  const { code, errOutput } = await runDoctorExpectingError(['--cwd']);
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness doctor/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { fetchLatestVersions, isLookupAttempted, isLocalSource, readLocalLatestVersions } from './latest.mjs';
import { withoutAutoMaintenance } from './git-fixture.testkit.mjs';

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-latest-home-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

const ROWS = [
  { id: 'engram', version: '2.2.1' },
  { id: 'codegraph', version: '1.6.0' },
  { id: 'context7', version: null },
  { id: 'typescript-lsp', version: null },
  { id: 'codex', version: null },
];

test('engram fetches its releases list, stripped of a leading v, and no lookup is made for a tool the stack has not', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('Gentleman-Programming/engram')) {
      return { ok: true, json: async () => [{ tag_name: 'v2.3.0', draft: false, prerelease: false }] };
    }
    return { ok: false };
  };
  const home = makeTmpHome();
  try {
    const versions = await fetchLatestVersions(ROWS, { fetch: fetchImpl, home });
    assert.equal(versions.engram, '2.3.0');
    assert.ok(calls.some((u) => u === 'https://api.github.com/repos/Gentleman-Programming/engram/releases?per_page=30'));
    // F8 S11: gentle-ai left the stack, so its releases are never asked for (S9's idea watch reads them, after S2).
    assert.equal(calls.some((u) => /gentle-ai/.test(u)), false);
    assert.equal(isLookupAttempted({ id: 'gentle-ai', version: '4.3.1' }), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// engram publishes a second release stream, `pi-v*`, in the same repository: `releases/latest` returned
// `pi-v0.5.0` while it was the newest release (odd/tasks/engram-plugin-lag.md, S4).
test('engram\'s latest version is the highest v<semver> release, never a pi-v* one, a draft or a prerelease', async () => {
  const releases = [
    { tag_name: 'pi-v0.5.0', draft: false, prerelease: false },
    { tag_name: 'v3.6.0', draft: true, prerelease: false },
    { tag_name: 'v3.6.0-rc.1', draft: false, prerelease: true },
    { tag_name: 'v3.4.0', draft: false, prerelease: false },
    { tag_name: 'v3.5.1', draft: false, prerelease: false },
  ];
  const fetchImpl = async () => ({ ok: true, json: async () => releases });
  const versions = await fetchLatestVersions([{ id: 'engram', version: '3.4.0' }], { fetch: fetchImpl });
  assert.equal(versions.engram, '3.5.1');
});

test('engram\'s latest version is null when its releases list holds only pi-v* releases or is not a list', async () => {
  const only = async () => ({ ok: true, json: async () => [{ tag_name: 'pi-v0.5.0', draft: false, prerelease: false }] });
  assert.equal((await fetchLatestVersions([{ id: 'engram', version: '3.4.0' }], { fetch: only })).engram, null);
  const notList = async () => ({ ok: true, json: async () => ({ tag_name: 'v3.5.1' }) });
  assert.equal((await fetchLatestVersions([{ id: 'engram', version: '3.4.0' }], { fetch: notList })).engram, null);
});

test('codegraph fetches its latest version from the npm registry', async () => {
  const fetchImpl = async (url) => {
    if (url === 'https://registry.npmjs.org/%40colbymchenry%2Fcodegraph/latest') {
      return { ok: true, json: async () => ({ version: '1.7.0' }) };
    }
    return { ok: false };
  };
  const home = makeTmpHome();
  try {
    const versions = await fetchLatestVersions(ROWS, { fetch: fetchImpl, home });
    assert.equal(versions.codegraph, '1.7.0');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('context7 fetches the npm registry when it is self-run (not hosted)', async () => {
  let called = false;
  const fetchImpl = async (url) => {
    if (url === 'https://registry.npmjs.org/%40upstash%2Fcontext7-mcp/latest') {
      called = true;
      return { ok: true, json: async () => ({ version: '4.1.1' }) };
    }
    return { ok: false };
  };
  const home = makeTmpHome();
  try {
    const rows = [{ id: 'context7', version: '2.2.5' }];
    const versions = await fetchLatestVersions(rows, { fetch: fetchImpl, home });
    assert.equal(called, true);
    assert.equal(versions.context7, '4.1.1');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('context7 never fetches when it is hosted', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, json: async () => ({ version: '4.1.1' }) };
  };
  const home = makeTmpHome();
  try {
    const rows = [{ id: 'context7', version: 'hosted' }];
    const versions = await fetchLatestVersions(rows, { fetch: fetchImpl, home });
    assert.equal(called, false);
    assert.equal(versions.context7, null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('typescript-lsp reads its latest version from the local plugin marketplace file', async () => {
  const home = makeTmpHome();
  try {
    writeJson(
      path.join(home, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', '.claude-plugin', 'marketplace.json'),
      { plugins: [{ name: 'typescript-lsp', version: '1.1.0' }, { name: 'other-plugin', version: '9.9.9' }] },
    );
    const rows = [{ id: 'typescript-lsp', version: '1.0.0' }];
    const versions = await readLocalLatestVersions(rows, { home });
    assert.equal(versions['typescript-lsp'], '1.1.0');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('typescript-lsp reads null when the marketplace file does not exist', async () => {
  const home = makeTmpHome();
  try {
    const rows = [{ id: 'typescript-lsp', version: '1.0.0' }];
    const versions = await readLocalLatestVersions(rows, { home });
    assert.equal(versions['typescript-lsp'], null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('typescript-lsp reads null when the marketplace file is malformed', async () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(
      path.join(home, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', '.claude-plugin'),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(home, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', '.claude-plugin', 'marketplace.json'),
      'not json',
      'utf8',
    );
    const rows = [{ id: 'typescript-lsp', version: '1.0.0' }];
    const versions = await readLocalLatestVersions(rows, { home });
    assert.equal(versions['typescript-lsp'], null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

function marketplaceFile(home, marketplace) {
  return path.join(home, '.claude', 'plugins', 'marketplaces', marketplace, '.claude-plugin', 'marketplace.json');
}

test('typescript-lsp reads its latest version offline from the claude-plugins-official marketplace', async () => {
  const home = makeTmpHome();
  try {
    writeJson(marketplaceFile(home, 'claude-plugins-official'), {
      plugins: [{ name: 'typescript-lsp', version: '1.0.1' }, { name: 'other-plugin', version: '9.9.9' }],
    });
    // A same-named plugin in the other marketplace must never leak in: the marketplace name matters.
    writeJson(marketplaceFile(home, 'openai-codex'), { plugins: [{ name: 'typescript-lsp', version: '8.8.8' }] });
    const rows = [{ id: 'typescript-lsp', version: '1.0.0' }];
    const versions = await readLocalLatestVersions(rows, { home });
    assert.equal(versions['typescript-lsp'], '1.0.1');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('typescript-lsp reads null when its marketplace file does not exist or lacks the plugin', async () => {
  const home = makeTmpHome();
  try {
    const rows = [{ id: 'typescript-lsp', version: '1.0.0' }];
    const missing = await readLocalLatestVersions(rows, { home });
    assert.equal(missing['typescript-lsp'], null);

    writeJson(marketplaceFile(home, 'claude-plugins-official'), { plugins: [{ name: 'other-plugin', version: '1.0.0' }] });
    const absent = await readLocalLatestVersions(rows, { home });
    assert.equal(absent['typescript-lsp'], null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex fetches its latest version from the npm registry, as @openai/codex', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url === 'https://registry.npmjs.org/%40openai%2Fcodex/latest') {
      return { ok: true, json: async () => ({ version: '0.131.0' }) };
    }
    return { ok: false };
  };
  const home = makeTmpHome();
  try {
    const versions = await fetchLatestVersions([{ id: 'codex', version: '0.130.0' }], { fetch: fetchImpl, home });
    assert.equal(versions.codex, '0.131.0');
    assert.deepEqual(calls, ['https://registry.npmjs.org/%40openai%2Fcodex/latest']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex has no local marketplace source: its latest version is never read from a plugin file', async () => {
  const home = makeTmpHome();
  try {
    writeJson(marketplaceFile(home, 'openai-codex'), { plugins: [{ name: 'codex', version: '1.0.7' }] });
    assert.deepEqual(await readLocalLatestVersions([{ id: 'codex', version: '0.130.0' }], { home }), {});
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a failed fetch (network error) resolves to null instead of throwing', async () => {
  const fetchImpl = async () => {
    throw new Error('offline');
  };
  const home = makeTmpHome();
  try {
    const versions = await fetchLatestVersions(ROWS, { fetch: fetchImpl, home });
    assert.equal(versions.engram, null);
    assert.equal(versions.codegraph, null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a non-200 response resolves to null instead of throwing', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404 });
  const home = makeTmpHome();
  try {
    const versions = await fetchLatestVersions(ROWS, { fetch: fetchImpl, home });
    assert.equal(versions.engram, null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a malformed JSON body (missing the expected field) resolves to null', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ unexpected: true }) });
  const home = makeTmpHome();
  try {
    const versions = await fetchLatestVersions(ROWS, { fetch: fetchImpl, home });
    assert.equal(versions.engram, null);
    assert.equal(versions.codegraph, null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('every GitHub/npm request carries a 5s AbortSignal timeout', async () => {
  const signals = [];
  const fetchImpl = async (url, init) => {
    signals.push(init && init.signal);
    return { ok: false };
  };
  const home = makeTmpHome();
  try {
    await fetchLatestVersions(ROWS, { fetch: fetchImpl, home });
    assert.ok(signals.length > 0);
    for (const signal of signals) assert.ok(signal instanceof AbortSignal);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- R3-003 (accepted final review follow-up, lineage review-cef5637e2884c12a): a single shared
// predicate decides what `fetchLatestVersions` actually attempts, so a caller that needs to know
// what was attempted (doctor.mjs's `resolveLatestVersions`) reuses it instead of re-deriving its
// own copy of the same rule, which can drift (it did: the old copy only knew about context7 hosted,
// not about a row id with no registered source at all). ---

test('isLookupAttempted is true for a row with a registered source', () => {
  assert.equal(isLookupAttempted({ id: 'codegraph', version: '1.6.0' }), true);
  assert.equal(isLookupAttempted({ id: 'context7', version: '2.2.5' }), true);
});

test('isLookupAttempted is false for a hosted context7 row and for a row id with no registered source', () => {
  assert.equal(isLookupAttempted({ id: 'context7', version: 'hosted' }), false);
  assert.equal(isLookupAttempted({ id: 'some-future-tool', version: '1.0.0' }), false);
});

test('every tool lookup runs concurrently, not one at a time', async () => {
  const started = [];
  const resolvers = {};
  const fetchImpl = async (url) => {
    const id = url.includes('Gentleman-Programming/engram') ? 'engram' : url.includes('codex') ? 'codex' : 'codegraph';
    started.push(id);
    return new Promise((resolve) => {
      resolvers[id] = resolve;
    });
  };
  const rows = [
    { id: 'engram', version: '2.2.1' },
    { id: 'codegraph', version: '1.6.0' },
    { id: 'codex', version: '0.130.0' },
  ];
  const home = makeTmpHome();
  try {
    const promise = fetchLatestVersions(rows, { fetch: fetchImpl, home });
    // Let every synchronous-until-first-await branch run before any of them resolves.
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual([...started].sort(), ['codegraph', 'codex', 'engram']);
    resolvers.codex({ ok: true, json: async () => ({ version: '1.0.0' }) });
    resolvers.engram({ ok: true, json: async () => [{ tag_name: 'v1.0.0' }] });
    resolvers.codegraph({ ok: true, json: async () => ({ version: '1.0.0' }) });
    await promise;
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T6d (Codex P2): a latest version read from a local marketplace file is a local source. It is
// read on every run by `readLocalLatestVersions`, never fetched, and `isLookupAttempted` (what the
// doctor's outage rule counts) covers only the network sources. ---

test('isLocalSource is true for the marketplace-backed typescript-lsp row and false for network rows', () => {
  assert.equal(isLocalSource({ id: 'typescript-lsp', version: '1.0.0' }), true);
  assert.equal(isLocalSource({ id: 'codex', version: '0.130.0' }), false);
  assert.equal(isLocalSource({ id: 'some-future-tool', version: '1.0.0' }), false);
});

test('isLookupAttempted is false for a local-source row and true for the Codex CLI\'s npm lookup', () => {
  assert.equal(isLookupAttempted({ id: 'typescript-lsp', version: '1.0.0' }), false);
  assert.equal(isLookupAttempted({ id: 'codex', version: '0.130.0' }), true);
});

test('fetchLatestVersions never resolves a local-source row: that is readLocalLatestVersions\'s job', async () => {
  const home = makeTmpHome();
  try {
    writeJson(marketplaceFile(home, 'claude-plugins-official'), { plugins: [{ name: 'typescript-lsp', version: '1.0.1' }] });
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      return { ok: false };
    };
    const versions = await fetchLatestVersions([{ id: 'typescript-lsp', version: '1.0.0' }], { fetch: fetchImpl, home });
    assert.equal(versions['typescript-lsp'], null);
    assert.equal(fetchCalled, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('readLocalLatestVersions returns one entry per local-source row only, null where the file has no answer', async () => {
  const home = makeTmpHome();
  try {
    writeJson(marketplaceFile(home, 'claude-plugins-official'), { plugins: [{ name: 'typescript-lsp', version: '1.0.1' }] });
    const rows = [
      { id: 'engram', version: '3.6.0' },
      { id: 'typescript-lsp', version: '1.0.0' },
      { id: 'codex', version: '0.130.0' },
    ];
    assert.deepEqual(await readLocalLatestVersions(rows, { home }), { 'typescript-lsp': '1.0.1' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- engram's Claude Code plugin (odd/tasks/engram-plugin-lag.md): its latest version is the one the engram
// binary's own release tag ships, read with git from Claude Code's clone of the engram marketplace at
// `v<binary version>`, never from the clone's working tree, which can sit behind the refs Claude Code fetched. ---

/** A fixture of `~/.claude/plugins/marketplaces/engram`: one commit tagged `tag` whose marketplace file names
 * plugin `atTag`, then the working tree's file left at `inTree`, uncommitted. Real git, no network. */
function makeEngramClone(home, { tag, atTag, inTree }) {
  const clone = path.join(home, '.claude', 'plugins', 'marketplaces', 'engram');
  const file = path.join(clone, '.claude-plugin', 'marketplace.json');
  // No global or system config: a signing rule or a hooks path of the machine's must not decide the fixture.
  const git = (...args) => {
    const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(home, 'no-gitconfig'), GIT_CONFIG_NOSYSTEM: '1' };
    const result = spawnSync('git', ['-C', clone, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr);
  };
  fs.mkdirSync(clone, { recursive: true });
  withoutAutoMaintenance(() => {
    git('init', '-q');
    writeJson(file, { name: 'engram', plugins: [{ name: 'engram', version: atTag }] });
    git('add', '.');
    git('commit', '-q', '-m', 'release');
    git('tag', tag);
  });
  writeJson(file, { name: 'engram', plugins: [{ name: 'engram', version: inTree }] });
}

const ENGRAM_ROWS = (binary) => [
  { id: 'engram', installed: 'ok', version: binary },
  { id: 'engram-plugin', installed: 'ok', version: '0.1.12' },
];

test('engram-plugin is a local source: never fetched, read on every run', () => {
  assert.equal(isLocalSource({ id: 'engram-plugin', version: '0.1.12' }), true);
  assert.equal(isLookupAttempted({ id: 'engram-plugin', version: '0.1.12' }), false);
});

test('engram-plugin reads the plugin version at the engram binary\'s tag in the marketplace clone, not its working tree', async () => {
  const home = makeTmpHome();
  try {
    makeEngramClone(home, { tag: 'v3.5.1', atTag: '0.1.14', inTree: '0.1.12' });
    assert.deepEqual(await readLocalLatestVersions(ENGRAM_ROWS('3.5.1'), { home }), { 'engram-plugin': '0.1.14' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('engram-plugin reads null when the clone lacks the binary\'s tag, when there is no clone, or no engram version', async () => {
  const home = makeTmpHome();
  try {
    assert.deepEqual(await readLocalLatestVersions(ENGRAM_ROWS('3.5.1'), { home }), { 'engram-plugin': null });
    makeEngramClone(home, { tag: 'v3.5.1', atTag: '0.1.14', inTree: '0.1.12' });
    assert.deepEqual(await readLocalLatestVersions(ENGRAM_ROWS('3.6.0'), { home }), { 'engram-plugin': null });
    assert.deepEqual(await readLocalLatestVersions(ENGRAM_ROWS(null), { home }), { 'engram-plugin': null });
    assert.deepEqual(await readLocalLatestVersions([{ id: 'engram-plugin', version: '0.1.12' }], { home }), { 'engram-plugin': null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Since 2026-10-27 Claude Code clones the engram marketplace shallow, main alone, with no tag (odd/tasks/doctor-rows.md,
// `## Engram plugin`): the read is null, and the fix doctor names, fetching the binary's tag, makes it answer.
test('engram-plugin reads null from a shallow clone with no tags, and the version once the binary\'s tag is fetched into it', async () => {
  const home = makeTmpHome();
  try {
    const origin = path.join(home, 'origin');
    const clone = path.join(home, '.claude', 'plugins', 'marketplaces', 'engram');
    const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(home, 'no-gitconfig'), GIT_CONFIG_NOSYSTEM: '1' };
    const git = (...args) => {
      const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8', env });
      assert.equal(result.status, 0, result.stderr);
    };
    const manifest = (version) => writeJson(path.join(origin, '.claude-plugin', 'marketplace.json'), { name: 'engram', plugins: [{ name: 'engram', version }] });
    fs.mkdirSync(origin, { recursive: true });
    withoutAutoMaintenance(() => {
      git('-C', origin, 'init', '-q', '-b', 'main');
      manifest('0.1.19');
      git('-C', origin, 'add', '.');
      git('-C', origin, 'commit', '-q', '-m', 'release');
      git('-C', origin, 'tag', 'v3.6.0');
      manifest('0.1.20');
      git('-C', origin, 'commit', '-q', '-am', 'main moves on');
      git('clone', '-q', '--depth', '1', '--no-tags', '--single-branch', pathToFileURL(origin).href, clone);
    });
    assert.deepEqual(await readLocalLatestVersions(ENGRAM_ROWS('3.6.0'), { home }), { 'engram-plugin': null });
    withoutAutoMaintenance(() => git('-C', clone, 'fetch', '-q', '--depth', '1', 'origin', 'tag', 'v3.6.0'));
    assert.deepEqual(await readLocalLatestVersions(ENGRAM_ROWS('3.6.0'), { home }), { 'engram-plugin': '0.1.19' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('engram-plugin reads null, never throws, when git fails, times out or prints a manifest with no engram entry', async () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.claude', 'plugins', 'marketplaces', 'engram', '.git'), { recursive: true });
    const answers = [
      { status: null, error: new Error('spawn git ENOENT'), stdout: '', stderr: '' },
      { status: null, signal: 'SIGTERM', stdout: '', stderr: '' },
      { status: 0, stdout: 'not json', stderr: '' },
      { status: 0, stdout: JSON.stringify({ plugins: [{ name: 'other', version: '9.9.9' }] }), stderr: '' },
    ];
    for (const answer of answers) {
      const calls = [];
      const git = async (args) => {
        calls.push(['git', ...args].join(' '));
        return answer;
      };
      assert.deepEqual(await readLocalLatestVersions(ENGRAM_ROWS('3.5.1'), { home, git }), { 'engram-plugin': null });
      assert.match(calls[0], /^git -C .+ show v3\.5\.1:\.claude-plugin\/marketplace\.json$/);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('engram-plugin never asks git about a marketplace folder that is not a repository itself, so a repository above it is never read', async () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.claude', 'plugins', 'marketplaces', 'engram'), { recursive: true });
    const calls = [];
    const git = async (args) => {
      calls.push(['git', ...args].join(' '));
      return { status: 0, stdout: JSON.stringify({ plugins: [{ name: 'engram', version: '0.1.14' }] }), stderr: '' };
    };
    assert.deepEqual(await readLocalLatestVersions(ENGRAM_ROWS('3.5.1'), { home, git }), { 'engram-plugin': null });
    assert.deepEqual(calls, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

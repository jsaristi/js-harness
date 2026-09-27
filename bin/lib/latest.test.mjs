import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchLatestVersions, isLookupAttempted } from './latest.mjs';

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-latest-home-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

const ROWS = [
  { id: 'gentle-ai', version: '3.7.0' },
  { id: 'engram', version: '2.2.1' },
  { id: 'codegraph', version: '1.6.0' },
  { id: 'context7', version: null },
  { id: 'typescript-lsp', version: null },
];

test('gentle-ai and engram fetch their GitHub releases/latest tag_name, stripped of a leading v', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('Gentleman-Programming/gentle-ai')) {
      return { ok: true, json: async () => ({ tag_name: 'v3.8.0' }) };
    }
    if (url.includes('Gentleman-Programming/engram')) {
      return { ok: true, json: async () => ({ tag_name: 'v2.3.0' }) };
    }
    return { ok: false };
  };
  const home = makeTmpHome();
  try {
    const versions = await fetchLatestVersions(ROWS, { fetch: fetchImpl, home });
    assert.equal(versions['gentle-ai'], '3.8.0');
    assert.equal(versions.engram, '2.3.0');
    assert.ok(calls.some((u) => u === 'https://api.github.com/repos/Gentleman-Programming/gentle-ai/releases/latest'));
    assert.ok(calls.some((u) => u === 'https://api.github.com/repos/Gentleman-Programming/engram/releases/latest'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
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

test('typescript-lsp reads its latest version offline from the local plugin marketplace file', async () => {
  const home = makeTmpHome();
  try {
    writeJson(
      path.join(home, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', '.claude-plugin', 'marketplace.json'),
      { plugins: [{ name: 'typescript-lsp', version: '1.1.0' }, { name: 'other-plugin', version: '9.9.9' }] },
    );
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      return { ok: false };
    };
    const rows = [{ id: 'typescript-lsp', version: '1.0.0' }];
    const versions = await fetchLatestVersions(rows, { fetch: fetchImpl, home });
    assert.equal(versions['typescript-lsp'], '1.1.0');
    assert.equal(fetchCalled, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('typescript-lsp reads null when the marketplace file does not exist', async () => {
  const home = makeTmpHome();
  try {
    const rows = [{ id: 'typescript-lsp', version: '1.0.0' }];
    const versions = await fetchLatestVersions(rows, { fetch: async () => ({ ok: false }), home });
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
    const versions = await fetchLatestVersions(rows, { fetch: async () => ({ ok: false }), home });
    assert.equal(versions['typescript-lsp'], null);
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
    assert.equal(versions['gentle-ai'], null);
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
    assert.equal(versions['gentle-ai'], null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a malformed JSON body (missing the expected field) resolves to null', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ unexpected: true }) });
  const home = makeTmpHome();
  try {
    const versions = await fetchLatestVersions(ROWS, { fetch: fetchImpl, home });
    assert.equal(versions['gentle-ai'], null);
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
    const id = url.includes('gentle-ai') ? 'gentle-ai' : url.includes('Gentleman-Programming/engram') ? 'engram' : 'codegraph';
    started.push(id);
    return new Promise((resolve) => {
      resolvers[id] = resolve;
    });
  };
  const rows = [
    { id: 'gentle-ai', version: '3.7.0' },
    { id: 'engram', version: '2.2.1' },
    { id: 'codegraph', version: '1.6.0' },
  ];
  const home = makeTmpHome();
  try {
    const promise = fetchLatestVersions(rows, { fetch: fetchImpl, home });
    // Let every synchronous-until-first-await branch run before any of them resolves.
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual([...started].sort(), ['codegraph', 'engram', 'gentle-ai']);
    resolvers['gentle-ai']({ ok: true, json: async () => ({ tag_name: 'v1.0.0' }) });
    resolvers.engram({ ok: true, json: async () => ({ tag_name: 'v1.0.0' }) });
    resolvers.codegraph({ ok: true, json: async () => ({ version: '1.0.0' }) });
    await promise;
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

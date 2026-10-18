import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RULES } from './rules-data.mjs';
import { rulesHash, shippedRulesHash, unscoped, writeRules } from './rules.mjs';
import { harnessRulesRow, MAIN_LIST_URL } from './rules-installed.mjs';
import { DEFAULT_REPO, INSTALL_NEWEST } from './version.mjs';

// The design: odd/tasks/rule-hierarchy.md, "Reach: the hash of the installed command (T16f, second part)".

const scoped = RULES.find((rule) => rule.scope !== undefined && Object.hasOwn(rule, 'value'));
const plain = RULES.find((rule) => rule.scope === undefined && typeof rule.value === 'number' && rule.retired === undefined);
const withValue = (list, id, value) => list.map((rule) => (rule.id === id ? { ...rule, value } : rule));

/** A fetch that answers every request with `status` and `body`, and records the addresses it was asked for. */
function answering(status, body, urls = []) {
  return async (url) => {
    urls.push(url);
    return { ok: status >= 200 && status < 300, status, text: async () => body };
  };
}

const refusing = (urls = []) => async (url) => {
  urls.push(url);
  throw new Error('network disabled in tests');
};

test('unscoped keeps the rules with no scope, and the shipped hash leaves a scoped rule out', () => {
  assert.ok(scoped && plain, 'the list holds a scoped rule and an unscoped one with a value');
  assert.deepEqual(unscoped(RULES), RULES.filter((rule) => rule.scope === undefined));
  assert.equal(shippedRulesHash(RULES), rulesHash(unscoped(RULES)));
  assert.match(shippedRulesHash(RULES), /^[0-9a-f]{12}$/);
  // His Codex rate changed must not call every installed copy behind (rule-hierarchy.md, "Scope").
  assert.equal(shippedRulesHash(withValue(RULES, scoped.id, 'changed')), shippedRulesHash(RULES));
  assert.notEqual(shippedRulesHash(withValue(RULES, plain.id, plain.value + 1)), shippedRulesHash(RULES));
});

test('the address of main\'s list is built from the default repository', () => {
  assert.equal(DEFAULT_REPO, 'https://github.com/jsaristi/js-harness.git');
  assert.equal(MAIN_LIST_URL, 'https://raw.githubusercontent.com/jsaristi/js-harness/HEAD/bin/lib/rules-data.mjs');
});

test('a project reads main\'s list once, online, and equal hashes print ok, hex hashes included', async () => {
  const urls = [];
  const row = await harnessRulesRow({ project: os.tmpdir(), online: true, fetch: answering(200, writeRules(RULES), urls) });
  assert.deepEqual(urls, [MAIN_LIST_URL]);
  assert.equal(row.id, 'js-harness');
  assert.equal(row.installed, 'ok');
  assert.equal(row.version, shippedRulesHash(RULES).slice(0, 8));
  assert.equal(row.rulesHash, shippedRulesHash(RULES));
  assert.equal(row.mainRulesHash, shippedRulesHash(RULES));
  assert.deepEqual([row.claude, row.codex, row.project], ['n/a', 'n/a', 'n/a']);
  assert.equal(row.upToDate, 'ok');
  assert.deepEqual(row.differs, { added: [], removed: [], retired: [], changed: [] });
});

test('a copy whose unscoped rules differ from main\'s is outdated, and its fix names the newest copy and the ids', async () => {
  const main = [...withValue(RULES, plain.id, plain.value + 1), { ...plain, id: 'zz-new-rule' }];
  const row = await harnessRulesRow({ project: os.tmpdir(), online: true, fetch: answering(200, writeRules(main)) });
  assert.equal(row.upToDate, 'outdated');
  assert.notEqual(row.mainRulesHash, row.rulesHash);
  assert.deepEqual(row.differs, { added: ['zz-new-rule'], removed: [], retired: [], changed: [plain.id] });
  assert.ok(Array.isArray(row.fix.upToDate), JSON.stringify(row.fix));
  assert.ok(row.fix.upToDate[0].includes(INSTALL_NEWEST), row.fix.upToDate[0]);
  assert.match(row.fix.upToDate.join('\n'), /unscoped/);
  assert.match(row.fix.upToDate.join('\n'), new RegExp(`added zz-new-rule; changed ${plain.id}`));
});

test('a scoped rule changed on main keeps the copy ok', async () => {
  const row = await harnessRulesRow({ project: os.tmpdir(), online: true, fetch: answering(200, writeRules(withValue(RULES, scoped.id, 'changed'))) });
  assert.equal(row.upToDate, 'ok');
});

test('a reply that is not main\'s list is unknown, never outdated', async () => {
  const cut = writeRules(RULES);
  const replies = [
    [404, 'Not Found'],
    [429, 'Too Many Requests'],
    [200, '<!DOCTYPE html><html><body>error</body></html>'],
    [200, cut.slice(0, Math.floor(cut.length / 2))],
    [200, 'export const RULES = [{"id": "x"}];\n'],
    [200, 'export const RULES = [];\n'],
  ];
  for (const [status, body] of replies) {
    const row = await harnessRulesRow({ project: os.tmpdir(), online: true, fetch: answering(status, body) });
    assert.equal(row.upToDate, 'unknown', `${status} ${body.slice(0, 40)}`);
    assert.equal(row.mainRulesHash, null);
    assert.deepEqual(row.fix, {});
  }
  const row = await harnessRulesRow({ project: os.tmpdir(), online: true, fetch: refusing() });
  assert.equal(row.upToDate, 'unknown');
});

test('offline, in the hook and in the TUI a project makes no request and the row is n/a', async () => {
  const urls = [];
  const row = await harnessRulesRow({ project: os.tmpdir(), online: false, fetch: refusing(urls) });
  assert.deepEqual(urls, []);
  assert.equal(row.upToDate, 'n/a');
  assert.equal(row.version, shippedRulesHash(RULES).slice(0, 8));
});

test("a pin of another version or another repository gives n/a and no request, and a pin of the copy's own version is compared", async () => {
  const urls = [];
  const pinned = await harnessRulesRow({ project: os.tmpdir(), declared: { version: '1.2.3' }, version: '0.1.0', online: true, fetch: refusing(urls) });
  assert.equal(pinned.upToDate, 'n/a');
  // `init` pins the version of the copy that ran it in every project (bin/lib/project.mjs, `harness.json`), and every
  // copy that follows main carries main's version: such a pin says nothing about main's rules, so the row still compares.
  const own = await harnessRulesRow({ project: os.tmpdir(), declared: { version: '0.1.0' }, version: '0.1.0', online: true, fetch: answering(200, writeRules(RULES), urls) });
  assert.equal(own.upToDate, 'ok');
  assert.deepEqual(urls, [MAIN_LIST_URL]);
  urls.length = 0;
  const fork = await harnessRulesRow({ project: os.tmpdir(), env: { JS_HARNESS_REPO: 'https://example.com/fork.git' }, online: true, fetch: refusing(urls) });
  assert.equal(fork.upToDate, 'n/a');
  const same = await harnessRulesRow({ project: os.tmpdir(), env: { JS_HARNESS_REPO: DEFAULT_REPO }, online: true, fetch: answering(200, writeRules(RULES), urls) });
  assert.equal(same.upToDate, 'ok');
  assert.deepEqual(urls, [MAIN_LIST_URL]);
});

test("a pinned project and a copy whose own version cannot be read give unknown, not n/a, and no request: the pin may be the copy's", async () => {
  const urls = [];
  const row = await harnessRulesRow({ project: os.tmpdir(), declared: { version: '0.1.0' }, version: null, online: true, fetch: refusing(urls) });
  assert.equal(row.upToDate, 'unknown');
  assert.deepEqual(urls, []);
  // Offline nothing is compared, so the row stays n/a whatever the copy knows of its version.
  const offline = await harnessRulesRow({ project: os.tmpdir(), declared: { version: '0.1.0' }, version: null, online: false, fetch: refusing(urls) });
  assert.equal(offline.upToDate, 'n/a');
  // With no pin there is nothing to compare the copy's version with, so the row still reads main's list.
  const unpinned = await harnessRulesRow({ project: os.tmpdir(), version: null, online: true, fetch: answering(200, writeRules(RULES), urls) });
  assert.equal(unpinned.upToDate, 'ok');
  assert.deepEqual(urls, [MAIN_LIST_URL]);
});

test('in the harness\'s own checkout main\'s list is read from the main ref with git, offline too, and nothing is fetched', async () => {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rules-installed-'));
  try {
    fs.mkdirSync(path.join(top, 'bin', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(top, 'bin', 'lib', 'rules-data.mjs'), writeRules(RULES));
    const main = withValue(RULES, plain.id, plain.value + 1);
    const calls = [];
    const spawn = (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts?.cwd });
      if (cmd === 'git' && args[0] === 'for-each-ref') return { status: 0, stdout: 'refs/remotes/origin/main abc123\n', stderr: '' };
      if (cmd === 'git' && args[0] === 'show' && args[1] === 'origin/main:bin/lib/rules-data.mjs') return { status: 0, stdout: writeRules(main), stderr: '' };
      return { status: 128, stdout: '', stderr: 'unexpected' };
    };
    const urls = [];
    for (const online of [true, false]) {
      const row = await harnessRulesRow({ project: top, online, spawn, fetch: refusing(urls) });
      assert.equal(row.upToDate, 'outdated', `online ${online}`);
      assert.deepEqual(row.differs.changed, [plain.id]);
      assert.equal(row.mainRef, 'origin/main');
    }
    assert.deepEqual(urls, []);
    assert.ok(calls.every((call) => call.cwd === top), JSON.stringify(calls));

    const noMain = await harnessRulesRow({ project: top, online: true, spawn: () => ({ status: 0, stdout: '', stderr: '' }), fetch: refusing(urls) });
    assert.equal(noMain.upToDate, 'unknown');
    assert.deepEqual(urls, []);
  } finally {
    fs.rmSync(top, { recursive: true, force: true });
  }
});

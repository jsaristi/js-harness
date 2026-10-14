import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SETTINGS_FILE, applySettings, isValidSettingsRecord, planFunctions, settingLabel } from './project-apply.mjs';
import { readFunctions, resolveFunctions } from './functions.mjs';

const PASTE = settingLabel(['env', 'CODEGRAPH_NO_PROMPT_HOOK']);
const PLUGIN = settingLabel(['enabledPlugins', 'typescript-lsp@claude-plugins-official']);

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-project-apply-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const settingsFile = (root) => path.join(root, '.claude', 'settings.local.json');
const settings = (root) => JSON.parse(fs.readFileSync(settingsFile(root), 'utf8'));

function withSettings(t, data) {
  const root = project(t);
  fs.mkdirSync(path.join(root, '.claude'));
  fs.writeFileSync(settingsFile(root), `${JSON.stringify(data, null, 2)}\n`);
  return root;
}

const plan = (values, paths, indexPresent = false) => planFunctions(resolveFunctions(readFunctions({ functions: values }).values, { paths }), { indexPresent });

test('a project with JavaScript and no TypeScript: the paste off, the plugin off, an index made, the push check wired', () => {
  assert.deepEqual(plan({}, ['bin/a.mjs']), { settings: ['paste', 'languageServer'], index: 'make', prePush: true });
});

test('a project with TypeScript keeps its plugin, and an index already there is left', () => {
  assert.deepEqual(plan({}, ['src/a.ts'], true), { settings: ['paste'], index: 'leave', prePush: true });
});

test('a project with no program: the paste and the plugin off, no index, no push check', () => {
  assert.deepEqual(plan({}, ['notes.md', 'data.csv']), { settings: ['paste', 'languageServer'], index: 'leave', prePush: false });
});

test('an index of a project with no program is left when off is only what auto resolved to', () => {
  assert.equal(plan({}, ['notes.md'], true).index, 'leave');
});

test('a declared off removes an index that is there', () => {
  assert.equal(plan({ codeMap: 'off' }, ['bin/a.mjs'], true).index, 'remove');
});

test('a map declared always writes no paste key, and declared switches win over the files', () => {
  assert.deepEqual(plan({ codeMap: 'always', languageServer: 'on', codexReview: 'off' }, ['bin/a.mjs']), {
    settings: [],
    index: 'make',
    prePush: false,
  });
});

test('wanted keys are written into a file that does not exist, and recorded', (t) => {
  const root = project(t);
  const applied = applySettings(root, [], ['paste', 'languageServer']);
  assert.deepEqual(applied.actions, [
    { kind: 'wrote', path: PASTE },
    { kind: 'wrote', path: PLUGIN },
  ]);
  assert.deepEqual(settings(root), {
    env: { CODEGRAPH_NO_PROMPT_HOOK: '1' },
    enabledPlugins: { 'typescript-lsp@claude-plugins-official': false },
  });
  assert.deepEqual(
    applied.records.map((record) => [record.key, record.path, record.createdFile]),
    [
      ['paste', SETTINGS_FILE, true],
      ['languageServer', SETTINGS_FILE, true],
    ],
  );
  assert.ok(applied.records.every(isValidSettingsRecord));
});

test('applying again changes nothing and reports nothing', (t) => {
  const root = project(t);
  const first = applySettings(root, [], ['paste']);
  const before = fs.readFileSync(settingsFile(root), 'utf8');
  const again = applySettings(root, first.records, ['paste']);
  assert.deepEqual(again, { records: first.records, actions: [] });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), before);
});

test('a key that already holds the value is kept and not recorded: it is not the harness to remove', (t) => {
  const root = withSettings(t, { env: { CODEGRAPH_NO_PROMPT_HOOK: '1' } });
  assert.deepEqual(applySettings(root, [], ['paste']), {
    records: [],
    actions: [{ kind: 'kept', path: PASTE, reason: 'already holds this value' }],
  });
});

test('a key that holds another value is never overwritten and the switch is said not applied', (t) => {
  const root = withSettings(t, { enabledPlugins: { 'typescript-lsp@claude-plugins-official': true } });
  const applied = applySettings(root, [], ['languageServer']);
  assert.deepEqual(applied.records, []);
  assert.deepEqual(applied.actions, [
    { kind: 'kept', path: PLUGIN, reason: 'holds true, never overwritten; the switch is not applied here' },
  ]);
  assert.deepEqual(settings(root), { enabledPlugins: { 'typescript-lsp@claude-plugins-official': true } });
});

test('a recorded key no longer wanted is removed, and the file the harness made goes with the last one', (t) => {
  const root = project(t);
  const { records } = applySettings(root, [], ['paste', 'languageServer']);
  const one = applySettings(root, records, ['languageServer']);
  assert.deepEqual(one.actions, [{ kind: 'removed', path: PASTE }]);
  assert.deepEqual(settings(root), { enabledPlugins: { 'typescript-lsp@claude-plugins-official': false } });
  const none = applySettings(root, one.records, []);
  assert.deepEqual(none, { records: [], actions: [{ kind: 'removed', path: PLUGIN }] });
  assert.equal(fs.existsSync(path.join(root, '.claude')), false);
});

test('undoing keeps what was in the file before the harness wrote', (t) => {
  const root = withSettings(t, { effortLevel: 'high' });
  const { records } = applySettings(root, [], ['paste']);
  applySettings(root, records, []);
  assert.deepEqual(settings(root), { effortLevel: 'high' });
});

test('a recorded key somebody changed since is kept and its record dropped', (t) => {
  const root = project(t);
  const { records } = applySettings(root, [], ['paste']);
  fs.writeFileSync(settingsFile(root), '{ "env": { "CODEGRAPH_NO_PROMPT_HOOK": "0" } }\n');
  assert.deepEqual(applySettings(root, records, []), {
    records: [],
    actions: [{ kind: 'kept', path: PASTE, reason: 'changed since it was written' }],
  });
});

test('a recorded key that is gone is reported as gone when no longer wanted, and written again while wanted', (t) => {
  const root = project(t);
  const { records } = applySettings(root, [], ['paste']);
  fs.rmSync(path.join(root, '.claude'), { recursive: true });
  assert.deepEqual(applySettings(root, records, []), { records: [], actions: [{ kind: 'alreadyGone', path: PASTE }] });
  const again = applySettings(root, records, ['paste']);
  assert.deepEqual(again.actions, [{ kind: 'wrote', path: PASTE }]);
  assert.equal(again.records.length, 1);
  assert.equal(settings(root).env.CODEGRAPH_NO_PROMPT_HOOK, '1');
});

test('a settings file that cannot be read keeps its records and is reported, never rewritten', (t) => {
  const root = project(t);
  const { records } = applySettings(root, [], ['paste']);
  fs.writeFileSync(settingsFile(root), 'not json');
  const undone = applySettings(root, records, []);
  assert.deepEqual(undone.records, records);
  assert.equal(undone.actions[0].kind, 'failed');
  const written = applySettings(root, [], ['languageServer']);
  assert.equal(written.actions[0].kind, 'problem');
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), 'not json');
});

test('a record is valid only for a known key, its own pointer and value, in the settings file', () => {
  const good = {
    key: 'paste',
    path: SETTINGS_FILE,
    pointer: ['env', 'CODEGRAPH_NO_PROMPT_HOOK'],
    value: '1',
    createdFile: true,
    createdDir: false,
    createdContainers: 1,
  };
  assert.equal(isValidSettingsRecord(good), true);
  assert.equal(isValidSettingsRecord({ ...good, key: 'constructor' }), false);
  assert.equal(isValidSettingsRecord({ ...good, path: '.claude/settings.json' }), false);
  assert.equal(isValidSettingsRecord({ ...good, pointer: ['env', 'PATH'] }), false);
  assert.equal(isValidSettingsRecord({ ...good, value: '0' }), false);
  assert.equal(isValidSettingsRecord({ ...good, createdContainers: 2 }), false);
  assert.equal(isValidSettingsRecord({ ...good, createdFile: 'yes' }), false);
  assert.equal(isValidSettingsRecord(null), false);
});

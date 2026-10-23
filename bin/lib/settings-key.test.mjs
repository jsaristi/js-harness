import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applySettingsKey, undoSettingsKey } from './settings-key.mjs';
import { acceptSessionMessages, userSettingsPath } from './manifest.mjs';

const PASTE = ['env', 'CODEGRAPH_NO_PROMPT_HOOK'];
const PLUGIN = ['enabledPlugins', 'typescript-lsp@claude-plugins-official'];

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-settings-key-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const settingsFile = (root) => path.join(root, '.claude', 'settings.local.json');

function withSettings(t, text) {
  const root = project(t);
  fs.mkdirSync(path.join(root, '.claude'));
  fs.writeFileSync(settingsFile(root), text);
  return root;
}

test('a key in a file that does not exist creates the folder and the file, and records both', (t) => {
  const root = project(t);
  const applied = applySettingsKey(settingsFile(root), PASTE, '1');
  assert.deepEqual(applied, {
    state: 'written',
    record: { pointer: PASTE, value: '1', createdFile: true, createdDir: true, createdContainers: 1 },
  });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), '{\n  "env": {\n    "CODEGRAPH_NO_PROMPT_HOOK": "1"\n  }\n}');
});

test('a key in a file that exists is merged beside what is there, in the file own indent and line endings', (t) => {
  const root = withSettings(t, '{\r\n\t"effortLevel": "high"\r\n}\r\n');
  const applied = applySettingsKey(settingsFile(root), PLUGIN, false);
  assert.deepEqual(applied, {
    state: 'written',
    record: { pointer: PLUGIN, value: false, createdFile: false, createdDir: false, createdContainers: 1 },
  });
  assert.equal(
    fs.readFileSync(settingsFile(root), 'utf8'),
    '{\r\n\t"effortLevel": "high",\r\n\t"enabledPlugins": {\r\n\t\t"typescript-lsp@claude-plugins-official": false\r\n\t}\r\n}\r\n',
  );
});

// The manifest writes the same object as settings-key does; the bytes must match, so an uninstall that puts a file back
// reads it the way the other writer left it. A file that exists keeps its indent, line endings and final newline.
for (const before of [null, '{\r\n\t"effortLevel": "high"\r\n}\r\n']) {
  test(`a key settings-key writes is byte-identical to the manifest's write of the same object, for ${before === null ? 'a file that does not exist' : 'a file that exists'}`, (t) => {
    const home = project(t);
    const manifestFile = userSettingsPath(home);
    const keyFile = settingsFile(project(t));
    if (before !== null) {
      fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
      fs.writeFileSync(manifestFile, before);
      fs.mkdirSync(path.dirname(keyFile), { recursive: true });
      fs.writeFileSync(keyFile, before);
    }
    assert.equal(acceptSessionMessages(home, { record: () => {} }).status, 'written');
    assert.equal(applySettingsKey(keyFile, ['crossSessionInbound'], 'accept').state, 'written');
    assert.equal(fs.readFileSync(keyFile, 'utf8'), fs.readFileSync(manifestFile, 'utf8'));
  });
}

test('a key under an object that is already there creates no container', (t) => {
  const root = withSettings(t, '{\n  "env": {\n    "OTHER": "x"\n  }\n}');
  const applied = applySettingsKey(settingsFile(root), PASTE, '1');
  assert.equal(applied.record.createdContainers, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile(root), 'utf8')), {
    env: { OTHER: 'x', CODEGRAPH_NO_PROMPT_HOOK: '1' },
  });
  assert.ok(!fs.readFileSync(settingsFile(root), 'utf8').endsWith('\n'), 'no newline is added at the end');
});

test('a key that already holds the value is kept and nothing is written or recorded', (t) => {
  const text = '{ "env": { "CODEGRAPH_NO_PROMPT_HOOK": "1" } }';
  const root = withSettings(t, text);
  assert.deepEqual(applySettingsKey(settingsFile(root), PASTE, '1'), { state: 'kept' });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), text);
});

test('a key that holds another value is never overwritten: it is a conflict that says what it holds', (t) => {
  const text = '{\n  "enabledPlugins": {\n    "typescript-lsp@claude-plugins-official": true\n  }\n}\n';
  const root = withSettings(t, text);
  assert.deepEqual(applySettingsKey(settingsFile(root), PLUGIN, false), { state: 'conflict', holds: true });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), text);
});

test('a file that is not JSON, not an object, or holds something else where an object must be is a problem', (t) => {
  for (const [text, reason] of [
    ['{ not json', /is not valid JSON/],
    ['["env"]', /must hold a JSON object/],
    ['{ "env": "all" }', /"env" is not an object/],
  ]) {
    const root = withSettings(t, text);
    const applied = applySettingsKey(settingsFile(root), PASTE, '1');
    assert.equal(applied.state, 'problem');
    assert.match(applied.reason, reason);
    assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), text, 'a file that cannot be read is left as it is');
  }
});

test('undo of a key written into a new file leaves no file and no folder', (t) => {
  const root = project(t);
  const { record } = applySettingsKey(settingsFile(root), PASTE, '1');
  assert.deepEqual(undoSettingsKey(settingsFile(root), record), { state: 'removed' });
  assert.equal(fs.existsSync(path.join(root, '.claude')), false);
});

test('undo of a key written into a file that existed puts the file back byte for byte', (t) => {
  const before = '{\r\n\t"effortLevel": "high"\r\n}\r\n';
  const root = withSettings(t, before);
  const { record } = applySettingsKey(settingsFile(root), PLUGIN, false);
  assert.deepEqual(undoSettingsKey(settingsFile(root), record), { state: 'removed' });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), before);
});

test('undo keeps a container the harness made when someone has put another key in it since', (t) => {
  const root = project(t);
  const { record } = applySettingsKey(settingsFile(root), PASTE, '1');
  const data = JSON.parse(fs.readFileSync(settingsFile(root), 'utf8'));
  data.env.MINE = 'yes';
  fs.writeFileSync(settingsFile(root), JSON.stringify(data, null, 2));
  assert.deepEqual(undoSettingsKey(settingsFile(root), record), { state: 'removed' });
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile(root), 'utf8')), { env: { MINE: 'yes' } });
});

test('undo keeps a file the harness made when someone has put another key in it since', (t) => {
  const root = project(t);
  const { record } = applySettingsKey(settingsFile(root), PASTE, '1');
  fs.writeFileSync(settingsFile(root), '{"env":{"CODEGRAPH_NO_PROMPT_HOOK":"1"},"effortLevel":"high"}');
  assert.deepEqual(undoSettingsKey(settingsFile(root), record), { state: 'removed' });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), '{"effortLevel":"high"}');
});

test('undo of a key someone changed since keeps it and says what it holds now', (t) => {
  const root = project(t);
  const { record } = applySettingsKey(settingsFile(root), PLUGIN, false);
  const changed = '{\n  "enabledPlugins": {\n    "typescript-lsp@claude-plugins-official": true\n  }\n}\n';
  fs.writeFileSync(settingsFile(root), changed);
  assert.deepEqual(undoSettingsKey(settingsFile(root), record), { state: 'changed', holds: true });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), changed);
});

test('undo of a key that is gone, or whose file is gone, has nothing to do and says so', (t) => {
  const root = project(t);
  const { record } = applySettingsKey(settingsFile(root), PASTE, '1');
  fs.writeFileSync(settingsFile(root), '{}');
  assert.deepEqual(undoSettingsKey(settingsFile(root), record), { state: 'gone' });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), '{}');
  fs.rmSync(settingsFile(root));
  assert.deepEqual(undoSettingsKey(settingsFile(root), record), { state: 'gone' });
});

test('undo of a file that can no longer be read is a problem and leaves it as it is', (t) => {
  const root = project(t);
  const { record } = applySettingsKey(settingsFile(root), PASTE, '1');
  fs.writeFileSync(settingsFile(root), '{ broken');
  const undone = undoSettingsKey(settingsFile(root), record);
  assert.equal(undone.state, 'problem');
  assert.match(undone.reason, /is not valid JSON/);
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), '{ broken');
});

test('two keys in one new file: the file goes with the last of them to be undone', (t) => {
  const root = project(t);
  const paste = applySettingsKey(settingsFile(root), PASTE, '1').record;
  const plugin = applySettingsKey(settingsFile(root), PLUGIN, false).record;
  assert.deepEqual(plugin, { pointer: PLUGIN, value: false, createdFile: false, createdDir: false, createdContainers: 1 });
  assert.deepEqual(undoSettingsKey(settingsFile(root), plugin), { state: 'removed' });
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile(root), 'utf8')), { env: { CODEGRAPH_NO_PROMPT_HOOK: '1' } });
  assert.deepEqual(undoSettingsKey(settingsFile(root), paste), { state: 'removed' });
  assert.equal(fs.existsSync(path.join(root, '.claude')), false);
});

test('a settings path that is there and cannot be read is a problem for both, not a throw', (t) => {
  const root = project(t);
  fs.mkdirSync(settingsFile(root), { recursive: true });
  const applied = applySettingsKey(settingsFile(root), PASTE, '1');
  assert.equal(applied.state, 'problem');
  assert.match(applied.reason, /could not be read/);
  const record = { pointer: PASTE, value: '1', createdFile: true, createdDir: true, createdContainers: 1 };
  assert.equal(undoSettingsKey(settingsFile(root), record).state, 'problem');
});

test('two keys in one new file, undone in the order they were written: no file and no folder is left', (t) => {
  const root = project(t);
  const paste = applySettingsKey(settingsFile(root), PASTE, '1').record;
  const plugin = applySettingsKey(settingsFile(root), PLUGIN, false, [paste]).record;
  assert.deepEqual(plugin, { pointer: PLUGIN, value: false, createdFile: true, createdDir: true, createdContainers: 1 });
  assert.deepEqual(undoSettingsKey(settingsFile(root), paste), { state: 'removed' });
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile(root), 'utf8')), {
    enabledPlugins: { 'typescript-lsp@claude-plugins-official': false },
  });
  assert.deepEqual(undoSettingsKey(settingsFile(root), plugin), { state: 'removed' });
  assert.equal(fs.existsSync(path.join(root, '.claude')), false);
});

test('two keys under one object the harness made, undone in the order they were written: the object goes with the last', (t) => {
  const root = withSettings(t, '{\n  "effortLevel": "high"\n}\n');
  const first = applySettingsKey(settingsFile(root), ['env', 'A'], '1').record;
  const second = applySettingsKey(settingsFile(root), ['env', 'B'], '2', [first]).record;
  assert.equal(second.createdContainers, 1, 'the object an earlier key of the harness made is the harness own');
  assert.deepEqual(undoSettingsKey(settingsFile(root), first), { state: 'removed' });
  assert.deepEqual(undoSettingsKey(settingsFile(root), second), { state: 'removed' });
  assert.equal(fs.readFileSync(settingsFile(root), 'utf8'), '{\n  "effortLevel": "high"\n}\n');
});

test('a key beside one somebody else wrote under an object the harness did not make owns no object', (t) => {
  const root = withSettings(t, '{ "env": { "THEIRS": "x" } }');
  const first = applySettingsKey(settingsFile(root), ['env', 'A'], '1').record;
  const second = applySettingsKey(settingsFile(root), ['env', 'B'], '2', [first]).record;
  assert.equal(second.createdContainers, 0);
  assert.equal(second.createdFile, false);
});

// Tests of D8 (bin/lib/engram-prompt-hook.mjs): the engram plugin's prompt hook turned off and on in a scratch home,
// recorded in that home's machine manifest so `uninstall` puts it back (odd/tasks/f8-s4a-hook-count.md, T4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ENGRAM_PLUGIN, engramHooksFile, promptHookOff, promptHookOn, restorePluginHooks } from './engram-prompt-hook.mjs';
import { readManifest, uninstall } from './manifest.mjs';

// The plugin's file as engram 0.1.19 ships it, cut to three events, with its CRLF-less two-space layout.
const HOOKS = `{
  "description": "Engram persistent memory hooks",
  "hooks": {
    "SessionStart": [
      { "matcher": "startup", "hooks": [{ "type": "command", "command": "start.sh", "timeout": 10 }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "\\"\${CLAUDE_PLUGIN_ROOT}/scripts/user-prompt-submit.sh\\"", "timeout": 10 }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "end.sh", "timeout": 5 }] }
    ]
  }
}
`;

/** A scratch home where engram's plugin is installed at user scope, with its `hooks/hooks.json` holding `text`. */
function home(text = HOOKS) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-prompt-'));
  const installPath = path.join(dir, '.claude', 'plugins', 'cache', 'engram', 'engram', '0.1.19');
  fs.mkdirSync(path.join(installPath, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(installPath, 'hooks', 'hooks.json'), text);
  const installed = { version: 2, plugins: { [ENGRAM_PLUGIN]: [{ scope: 'user', installPath }] } };
  fs.writeFileSync(path.join(dir, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify(installed));
  return { dir, file: path.join(installPath, 'hooks', 'hooks.json') };
}

test('the hooks file is the one of the user-level install record', () => {
  const { dir, file } = home();
  assert.equal(engramHooksFile(dir), file);
  assert.equal(engramHooksFile(fs.mkdtempSync(path.join(os.tmpdir(), 'engram-prompt-'))), null);
});

test('off takes the UserPromptSubmit entry out, leaves every other byte as it was laid out, and records it', () => {
  const { dir, file } = home();
  const result = promptHookOff(dir);
  assert.equal(result.status, 'off');
  const after = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(after);
  assert.deepEqual(Object.keys(data.hooks), ['SessionStart', 'SessionEnd']);
  assert.equal(data.description, 'Engram persistent memory hooks');
  assert.ok(after.endsWith('}\n'), 'the trailing newline stays');
  const [record] = readManifest(dir).pluginHooks;
  assert.equal(record.path, file);
  assert.equal(record.event, 'UserPromptSubmit');
  assert.equal(record.original, HOOKS);
  assert.equal(record.written, after);
});

test('off again, or on a file with no prompt hook, writes nothing and says it is already off', () => {
  const { dir, file } = home();
  promptHookOff(dir);
  const once = fs.readFileSync(file, 'utf8');
  assert.equal(promptHookOff(dir).status, 'already');
  assert.equal(fs.readFileSync(file, 'utf8'), once);
  assert.equal(readManifest(dir).pluginHooks.length, 1);
});

test('off with no engram plugin, or a file that is no JSON, is skipped and writes nothing', () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-prompt-'));
  assert.equal(promptHookOff(bare).status, 'skipped');
  const { dir, file } = home('{ not json');
  const result = promptHookOff(dir);
  assert.equal(result.status, 'skipped');
  assert.equal(fs.readFileSync(file, 'utf8'), '{ not json');
  assert.equal(readManifest(dir), null);
});

test('off whose record cannot be written puts the file back as it was', () => {
  const { dir, file } = home();
  const result = promptHookOff(dir, { record: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } });
  assert.equal(result.status, 'skipped');
  assert.match(result.reason, /not recorded/);
  assert.equal(fs.readFileSync(file, 'utf8'), HOOKS);
});

test('on puts back the exact bytes and forgets the record', () => {
  const { dir, file } = home();
  promptHookOff(dir);
  const result = promptHookOn(dir);
  assert.deepEqual(result.restored, [file]);
  assert.equal(fs.readFileSync(file, 'utf8'), HOOKS);
  assert.equal(readManifest(dir), null);
});

test('on leaves a file changed since (a plugin update, an edit) as it is, says so, and forgets the record', () => {
  const { dir, file } = home();
  promptHookOff(dir);
  fs.writeFileSync(file, HOOKS.replace('end.sh', 'end2.sh'));
  const result = promptHookOn(dir);
  assert.deepEqual(result.restored, []);
  assert.deepEqual(result.kept, [{ path: file, reason: 'changed' }]);
  assert.match(fs.readFileSync(file, 'utf8'), /end2\.sh/);
  assert.equal(readManifest(dir), null);
});

test('restorePluginHooks keeps the record of a write that failed, for a second run', () => {
  const { dir, file } = home();
  promptHookOff(dir);
  const records = readManifest(dir).pluginHooks;
  const result = restorePluginHooks(records, { writeFile: () => { throw Object.assign(new Error('busy'), { code: 'EBUSY' }); } });
  assert.deepEqual(result.restored, []);
  assert.deepEqual(result.failedRecords, records);
  assert.deepEqual(result.kept, [{ path: file, reason: 'failed', code: 'EBUSY' }]);
});

test('uninstall puts the prompt hook back and leaves no manifest', () => {
  const { dir, file } = home();
  promptHookOff(dir);
  const result = uninstall(dir);
  assert.deepEqual(result.pluginHooks.restored, [file]);
  assert.equal(fs.readFileSync(file, 'utf8'), HOOKS);
  assert.equal(readManifest(dir), null);
});

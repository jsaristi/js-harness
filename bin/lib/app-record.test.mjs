import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodePath from 'node:path';
import * as lib from './app-record.mjs';

// The desktop app's own records are undocumented, so every fixture below is invented. The fake file system answers
// like `node:fs`: a folder lists the names under it, and a missing file or folder throws.
const fakeFs = (files) => {
  const under = (dir) => Object.keys(files).filter((file) => file.startsWith(dir + nodePath.sep));
  const missing = (what) => Object.assign(new Error(`ENOENT: ${what}`), { code: 'ENOENT' });
  return {
    readdir(dir) {
      const names = [...new Set(under(dir).map((file) => nodePath.relative(dir, file).split(nodePath.sep)[0]))];
      if (names.length === 0) throw missing(dir);
      return names;
    },
    readFile(file) {
      if (!(file in files)) throw missing(file);
      return files[file];
    },
  };
};

const ROOT = nodePath.join('C:', 'Users', 'me', 'AppData', 'Roaming', 'Claude');
const ACCOUNT = nodePath.join(ROOT, 'claude-code-sessions', 'account-a', 'org-b');
const record = (file, fields) => [nodePath.join(ACCOUNT, file), JSON.stringify(fields)];

// --- appRoot ---

test('appRoot is the Claude folder under APPDATA on Windows, and null without APPDATA', () => {
  assert.equal(lib.appRoot({ APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'win32', 'C:\\Users\\me'), nodePath.join('C:\\Users\\me\\AppData\\Roaming', 'Claude'));
  assert.equal(lib.appRoot({}, 'win32', 'C:\\Users\\me'), null);
});

test('appRoot is the Application Support folder on macOS, and the .config folder elsewhere', () => {
  assert.equal(lib.appRoot({}, 'darwin', '/Users/me'), nodePath.join('/Users/me', 'Library', 'Application Support', 'Claude'));
  assert.equal(lib.appRoot({}, 'linux', '/home/me'), nodePath.join('/home/me', '.config', 'Claude'));
  assert.equal(lib.appRoot({}, 'darwin', ''), null);
});

// Claude Desktop moved its folder to %LOCALAPPDATA%\Claude-Data\claude_<id> and left only a marker file in the old one.
const LOCAL = nodePath.join('C:', 'Users', 'me', 'AppData', 'Local');
const WIN_ENV = { APPDATA: nodePath.dirname(ROOT), LOCALAPPDATA: LOCAL };
const MOVED = nodePath.join(LOCAL, 'Claude-Data', 'claude_abc123');

test('appRoot follows the marker the app leaves in the old folder to its new one under LOCALAPPDATA', () => {
  const fs = fakeFs({ [nodePath.join(ROOT, '.user-data-left.claude_abc123')]: '', [nodePath.join(MOVED, 'config.json')]: '{}' });
  assert.equal(lib.appRoot(WIN_ENV, 'win32', 'C:\\Users\\me', fs), MOVED);
});

test('appRoot keeps the old folder while it holds no marker, and with no LOCALAPPDATA to follow one to', () => {
  const kept = fakeFs({ [nodePath.join(ROOT, 'config.json')]: '{}', [nodePath.join(MOVED, 'config.json')]: '{}' });
  assert.equal(lib.appRoot(WIN_ENV, 'win32', 'C:\\Users\\me', kept), ROOT);
  const marked = fakeFs({ [nodePath.join(ROOT, '.user-data-left.claude_abc123')]: '' });
  assert.equal(lib.appRoot({ APPDATA: WIN_ENV.APPDATA }, 'win32', 'C:\\Users\\me', marked), ROOT);
});

test('appRoot takes the one Claude-Data folder when the old folder is gone, and the old path when there are several', () => {
  const one = fakeFs({ [nodePath.join(MOVED, 'config.json')]: '{}' });
  assert.equal(lib.appRoot(WIN_ENV, 'win32', 'C:\\Users\\me', one), MOVED);
  const two = fakeFs({ [nodePath.join(MOVED, 'config.json')]: '{}', [nodePath.join(LOCAL, 'Claude-Data', 'claude_xyz', 'config.json')]: '{}' });
  assert.equal(lib.appRoot(WIN_ENV, 'win32', 'C:\\Users\\me', two), ROOT);
});

// --- appSessions ---

test('appSessions maps each session record by its cliSessionId to where it sits: archived, in routines, or in sessions', () => {
  const root = fakeFs(Object.fromEntries([
    record('local_1.json', { cliSessionId: 'c-archived', isArchived: true, scheduledTaskId: 'task-1', effort: 'high', title: 'Old' }),
    record('local_2.json', { cliSessionId: 'c-routine', isArchived: false, scheduledTaskId: 'task-1', effort: 'medium' }),
    record('local_3.json', { cliSessionId: 'c-plain', isArchived: false, scheduledTaskId: '' }),
  ]));
  const sessions = lib.appSessions(ROOT, root);
  assert.deepEqual(sessions.get('c-archived'), { where: 'archived', effort: 'high', scheduledTaskId: 'task-1', archived: true, title: 'Old', cwd: null });
  assert.deepEqual(sessions.get('c-routine'), { where: 'routines', effort: 'medium', scheduledTaskId: 'task-1', archived: false, title: null, cwd: null });
  assert.equal(sessions.get('c-plain').where, 'sessions', 'an empty scheduledTaskId is no routine');
});

test('appSessions carries each record\'s cwd: the folder the session runs in, or null when the record has none', () => {
  const root = fakeFs(Object.fromEntries([
    record('local_1.json', { cliSessionId: 'c-here', isArchived: false, cwd: 'D:\\harness' }),
    record('local_2.json', { cliSessionId: 'c-empty', isArchived: false, cwd: '' }),
    record('local_3.json', { cliSessionId: 'c-number', isArchived: false, cwd: 7 }),
  ]));
  const sessions = lib.appSessions(ROOT, root);
  assert.equal(sessions.get('c-here').cwd, 'D:\\harness');
  assert.equal(sessions.get('c-empty').cwd, null);
  assert.equal(sessions.get('c-number').cwd, null);
});

test('appSessions skips a file that is not JSON or has no cliSessionId, and reads no other file of the folder', () => {
  const root = fakeFs(Object.fromEntries([
    record('local_1.json', { cliSessionId: 'c-good', isArchived: false }),
    [nodePath.join(ACCOUNT, 'local_2.json'), '{ not json'],
    record('local_3.json', { isArchived: false }),
    record('scheduled-tasks.json', { cliSessionId: 'c-not-a-session' }),
  ]));
  const sessions = lib.appSessions(ROOT, root);
  assert.deepEqual([...sessions.keys()], ['c-good']);
});

test('appSessions is an empty map when the app has no session folder', () => {
  assert.equal(lib.appSessions(ROOT, fakeFs({})).size, 0);
  assert.equal(lib.appSessions(null, fakeFs({})).size, 0);
});

// --- scheduledTasks ---

test('scheduledTasks lists each task of the scheduled-tasks file as its id, cwd and enabled flag', () => {
  const root = fakeFs(Object.fromEntries([
    [nodePath.join(ACCOUNT, 'scheduled-tasks.json'), JSON.stringify({ scheduledTasks: [
      { id: 'task-a', cwd: 'D:\\proj', enabled: false, fireAt: 1791761100000, displayName: 'made up' },
      { id: 'task-b', cwd: 'C:\\other', enabled: true },
    ], recordedSkips: {} })],
  ]));
  assert.deepEqual(lib.scheduledTasks(ROOT, root), [
    { id: 'task-a', cwd: 'D:\\proj', enabled: false },
    { id: 'task-b', cwd: 'C:\\other', enabled: true },
  ]);
});

test('scheduledTasks is empty when the file is missing, is not JSON, or holds no list', () => {
  assert.deepEqual(lib.scheduledTasks(ROOT, fakeFs({})), []);
  assert.deepEqual(lib.scheduledTasks(ROOT, fakeFs({ [nodePath.join(ACCOUNT, 'scheduled-tasks.json')]: '{ broken' })), []);
  assert.deepEqual(lib.scheduledTasks(ROOT, fakeFs({ [nodePath.join(ACCOUNT, 'scheduled-tasks.json')]: '{"scheduledTasks":{}}' })), []);
});

// The registry is read or not, apart from how many tasks it holds: an empty list is a registry that says nothing
// is scheduled, while a missing or unparsable file says nothing about the tasks at all.
test('scheduledRegistry says a registry was found when a file parses to a task list, even an empty one', () => {
  const found = (text) => lib.scheduledRegistry(ROOT, fakeFs(text === undefined ? {} : { [nodePath.join(ACCOUNT, 'scheduled-tasks.json')]: text }));
  assert.deepEqual(found('{"scheduledTasks":[]}'), { found: true, tasks: [] });
  assert.deepEqual(found('{"scheduledTasks":[{"id":"task-a","cwd":"D:\\\\proj","enabled":true}]}'), { found: true, tasks: [{ id: 'task-a', cwd: 'D:\\proj', enabled: true }] });
  assert.deepEqual(found(undefined), { found: false, tasks: [] }, 'no file');
  assert.deepEqual(found('{ broken'), { found: false, tasks: [] }, 'a file that is not JSON');
  assert.deepEqual(found('{"scheduledTasks":{}}'), { found: false, tasks: [] }, 'a file with no list');
});

test('scheduledRegistry is found when any account folder holds a registry', () => {
  const other = nodePath.join(ROOT, 'claude-code-sessions', 'account-z', 'org-y', 'scheduled-tasks.json');
  const root = fakeFs(Object.fromEntries([
    [nodePath.join(ACCOUNT, 'scheduled-tasks.json'), '{ broken'],
    [other, '{"scheduledTasks":[]}'],
  ]));
  assert.deepEqual(lib.scheduledRegistry(ROOT, root), { found: true, tasks: [] });
});

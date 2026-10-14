import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SESSION_CLASSES_FIX, lastPermissionMode, sessionClassesState } from './session-classes.mjs';
import { projectSlug } from './sessions.mjs';

const noGit = () => ({ status: 128, stdout: '', stderr: 'not a git repository' });
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-14T08:00:00Z');

function machine() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-session-classes-'));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  const folder = path.join(home, '.claude', 'projects', projectSlug(project));
  const settings = path.join(home, '.claude', 'settings.json');
  const session = (id, modes, ageDays = 0) => {
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, `${id}.jsonl`);
    const lines = modes.map((mode) => JSON.stringify({ type: 'user', permissionMode: mode, message: { content: 'x' } }));
    fs.writeFileSync(file, `${[...lines, JSON.stringify({ type: 'assistant', message: { content: 'y' } })].join('\n')}\n`);
    const at = new Date(NOW - ageDays * DAY);
    fs.utimesSync(file, at, at);
  };
  const setting = (value) => {
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, JSON.stringify(value === undefined ? {} : { crossSessionInbound: value }));
  };
  const state = () => sessionClassesState({ home, project, spawn: noGit, now: () => NOW });
  return { home, folder, settings, session, setting, state, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('the mode of a transcript is the last one a user entry carries', () => {
  const text = ['{"type":"user","permissionMode":"auto"}', '{"type":"assistant","permissionMode":"plan"}', '{"type":"user","permissionMode":"bypassPermissions"}', '{"type":"assistant"}', 'not json', ''].join('\n');
  assert.equal(lastPermissionMode(text), 'bypassPermissions');
  assert.equal(lastPermissionMode('{"type":"assistant"}\n'), null);
});

test('recent sessions of both classes with the setting not accept are the gap, with what was counted and where the setting is', () => {
  const m = machine();
  try {
    m.session('a', ['auto', 'bypassPermissions']);
    m.session('b', ['bypassPermissions']);
    m.session('c', ['bypassPermissions', 'acceptEdits'], 2);
    m.session('old', ['auto'], 9);
    m.setting('hold');
    assert.deepEqual(m.state(), {
      claude: 'mismatch',
      codex: 'n/a',
      lines: [`2 of the project's sessions of the last 7 days bypass permission prompts and 1 asks for them; crossSessionInbound is "hold" in ${m.settings}, so a message from one class to the other is held`],
    });
    fs.rmSync(m.settings);
    assert.match(m.state().lines[0], /crossSessionInbound is not set in /);
  } finally {
    m.done();
  }
});

test('one class, or the setting accept, is ok; no sessions folder is n/a; a throw is unknown', () => {
  const m = machine();
  try {
    assert.deepEqual(m.state(), { claude: 'n/a', codex: 'n/a', lines: [] });
    m.session('a', ['bypassPermissions']);
    m.session('b', ['bypassPermissions']);
    m.session('old', ['auto'], 9);
    m.session('none', []);
    assert.equal(m.state().claude, 'ok', 'a session past the window, or with no mode, counts in no class');
    m.session('c', ['default']);
    assert.equal(m.state().claude, 'mismatch');
    m.setting('accept');
    assert.deepEqual(m.state(), { claude: 'ok', codex: 'n/a', lines: [] });
    const boom = () => {
      throw new Error('made up');
    };
    assert.equal(sessionClassesState({ home: m.home, project: m.folder, spawn: boom, now: () => NOW }).claude, 'unknown');
  } finally {
    m.done();
  }
});

test('the fix is the install flag that sets the setting', () => {
  assert.match(SESSION_CLASSES_FIX, /^js-harness install --accept-session-messages/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendRecord, recordFileOf } from './background.mjs';
import { projectSlug } from './sessions.mjs';
import { readHomeSessions } from './home-sessions-read.mjs';

// odd/tasks/one-model-home.md, spec 6: what `rules applied` reads of the sessions, and that it never takes a source
// it could not read as empty.
const NOW = Date.parse('2026-11-11T20:00:00.000Z');
const HOUR = 3600 * 1000;
const MODEL = 'claude-fable-5-2';

/** A machine in a temporary folder: a project, the harness's home and Claude's folder. */
function withMachine(body) {
  return () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-sessions-'));
    const machine = { main: path.join(dir, 'proj'), other: path.join(dir, 'other'), home: path.join(dir, 'home'), claudeDir: path.join(dir, 'claude') };
    machine.tree = path.join(machine.main, '.claude', 'worktrees', 'a');
    try {
      return body(machine);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

const started = (machine, id, hoursAgo, more = {}) => appendRecord(machine.home, {
  event: 'started', at: new Date(NOW - hoursAgo * HOUR).toISOString(), id, sessionId: null, title: `JH ${id} · job`, root: machine.main, cwd: machine.main, worktree: null, worktreePath: null, model: null, effort: null, ...more,
});
const removed = (machine, id) => appendRecord(machine.home, { event: 'removed', at: new Date(NOW).toISOString(), id });

/** A transcript whose one reply ran on `model` at `effort`, where a session that runs in `folder` keeps it. */
function writeReply(machine, folder, sessionId, model, effort) {
  const dir = path.join(machine.claudeDir, 'projects', projectSlug(folder));
  fs.mkdirSync(dir, { recursive: true });
  const reply = { type: 'assistant', timestamp: new Date(NOW - HOUR).toISOString(), sessionId, effort, message: { role: 'assistant', model, content: [{ type: 'text', text: 'done' }], usage: { input_tokens: 10, output_tokens: 1 } } };
  fs.writeFileSync(path.join(dir, `${sessionId}.jsonl`), `${JSON.stringify(reply)}\n`);
}

const read = (machine, more = {}) => readHomeSessions({ main: machine.main, home: machine.home, claudeDir: machine.claudeDir, now: NOW, days: 7, readApp: () => new Map(), agents: () => [], ...more });

test('the desktop sessions are the app\'s records whose folder is in the project, a worktree under it too', withMachine((machine) => {
  const record = (cwd, more = {}) => ({ where: 'sessions', model: MODEL, effort: 'high', archived: false, title: 'JH 1 · a', cwd, ...more });
  const app = new Map([['c1', record(machine.main)], ['c2', record(machine.tree, { archived: true })], ['c3', record(machine.other)], ['c4', record(null)]]);
  const { desktop, background, unread } = read(machine, { readApp: () => app, agents: () => assert.fail('no job, so no list is read') });
  assert.deepEqual(desktop, [{ id: 'c1', ...record(machine.main) }, { id: 'c2', ...record(machine.tree, { archived: true }) }]);
  assert.deepEqual(background, []);
  assert.deepEqual(unread, []);
}));

test('a background session is each start recorded for the project, with what it asked, its last reply and its job\'s state', withMachine((machine) => {
  started(machine, 'job-a', 1, { sessionId: 's-a', worktree: 'a', worktreePath: machine.tree, model: MODEL, effort: 'high' });
  writeReply(machine, machine.tree, 's-a', MODEL, 'medium');
  started(machine, 'job-b', 2);
  started(machine, 'job-c', 10 * 24);
  removed(machine, 'job-c');
  started(machine, 'job-d', 48, { effort: 'high' });
  removed(machine, 'job-d');
  started(machine, 'job-e', 1, { root: machine.other, cwd: machine.other });
  started(machine, 'job-g', 5, { sessionId: 's-g' });
  started(machine, 'job-f', 3, { sessionId: 's-f', resumedFrom: 'job-g' });
  const { background, unread } = read(machine, { agents: () => [{ id: 'job-a', status: 'busy' }, { id: 'other', sessionId: 's-f', state: 'working' }] });
  assert.deepEqual(background, [
    { id: 'job-a', title: 'JH job-a · job', asked: { model: MODEL, effort: 'high' }, replied: { model: MODEL, effort: 'medium' }, state: 'busy', removed: false },
    { id: 'job-b', title: 'JH job-b · job', asked: { model: null, effort: null }, replied: null, state: 'not listed by claude agents', removed: false },
    { id: 'job-d', title: 'JH job-d · job', asked: { model: null, effort: 'high' }, replied: null, state: null, removed: true },
    { id: 'job-f', title: 'JH job-f · job', asked: { model: null, effort: null }, replied: null, state: 'working', removed: false },
  ], 'left out: one removed before the window, one of another project, and one a later start resumed');
  assert.deepEqual(unread, []);
}));

test('a source that cannot be read is named and never taken as empty: the app\'s records, the jobs\' states, the record', withMachine((machine) => {
  started(machine, 'job-a', 1);
  const noApp = read(machine, { readApp: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } });
  assert.deepEqual(noApp.unread, ['the app\'s records of its sessions (EACCES)']);
  assert.equal(noApp.background.length, 1);
  const noList = read(machine, { agents: () => { throw new Error('claude is not on PATH'); } });
  assert.deepEqual(noList.unread, ['the state of the background jobs (claude is not on PATH)']);
  assert.equal(noList.background[0].state, null);
  const file = recordFileOf(machine.home);
  const noRecord = read(machine, { readFile: (asked) => { if (asked === file) throw Object.assign(new Error('denied'), { code: 'EACCES' }); return fs.readFileSync(asked, 'utf8'); } });
  assert.deepEqual(noRecord.unread, ['the record of the background sessions (EACCES)']);
  assert.deepEqual(noRecord.background, []);
}));

test('with no record and no app record there is nothing, and nothing is unread', withMachine((machine) => {
  assert.deepEqual(read(machine, { agents: () => assert.fail('no job, so no list is read') }), { desktop: [], background: [], unread: [] });
}));

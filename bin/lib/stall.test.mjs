import { test } from 'node:test';
import assert from 'node:assert/strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { branchCommitAt, readStalled, stalledSessions } from './stall.mjs';

const NOW = Date.parse('2026-10-16T20:00:00.000Z');
const HOUR = 3600 * 1000;
const LIMIT = HOUR;
const ago = (minutes) => new Date(NOW - minutes * 60 * 1000).toISOString();

const LEAD = { id: 'e152c9d8-0000-0000-0000-000000000000', title: 'JH ORQ · js-harness' };
const WORKER = { id: '9a1b2c3d-0000-0000-0000-000000000000', title: 'JH 19 · skill del orquestador' };
const TREE = 'D:\\js-harness-worktrees\\lead-tools';

const handed = (minutes, text = 'T3 is yours') => ({ at: ago(minutes), from: LEAD, to: { role: 'work', number: 19 }, kind: 'note', text });
const said = (minutes, kind = 'note', text = 'working on T3') => ({ at: ago(minutes), from: WORKER, to: { role: 'orchestrator', number: null }, kind, text, worktree: TREE, branch: 'feat/lead-tools' });
const stalled = (input) => stalledSessions({ now: NOW, limitMs: LIMIT, ...input });

test('a work session handed a notice and quiet past the limit is stalled, with what it holds and since when', () => {
  const found = stalled({ notices: [said(200), handed(61)] });
  assert.equal(found.length, 1);
  const [session] = found;
  assert.equal(session.number, 19);
  assert.equal(session.title, WORKER.title);
  assert.equal(session.quietSince, ago(61));
  assert.equal(session.quietMs, 61 * 60 * 1000);
  assert.deepEqual(session.holding, { what: 'notice', at: ago(61), from: LEAD.title, kind: 'note', text: 'T3 is yours' });
  assert.equal(session.worktree, TREE);
});

test('a session quiet for less than the limit is not stalled', () => {
  assert.deepEqual(stalled({ notices: [said(200), handed(59)] }), []);
});

test('its own notice after the handed one restarts the quiet, and only waiting, closed or relieved give the work back', () => {
  // A note is an answer, not the end of the work: the quiet runs from it.
  const noted = stalled({ notices: [handed(200), said(90)] });
  assert.equal(noted.length, 1);
  assert.equal(noted[0].quietSince, ago(90));
  assert.equal(noted[0].holding.at, ago(200));
  for (const kind of ['waiting', 'closed', 'relieved']) {
    assert.deepEqual(stalled({ notices: [handed(300), said(200, kind, 'free')] }), [], `${kind} gives the work back`);
  }
});

test('a notice handed after the session closed opens its work again', () => {
  const found = stalled({ notices: [handed(400), said(300, 'closed', 'PR 303'), handed(120, 'merge-review is yours')] });
  assert.equal(found.length, 1);
  assert.equal(found[0].holding.text, 'merge-review is yours');
});

test('a gate the session ran within the limit keeps it out, by the session id the gate recorded', () => {
  const notices = [said(300), handed(200)];
  const byId = [{ event: 'start', id: 'g1', at: ago(30), cwd: 'C:\\elsewhere', session: WORKER.id }];
  assert.deepEqual(stalled({ notices, gates: byId }), []);
  // A gate with no session id is nobody's, even in the session's worktree: several sessions share a checkout
  // (the lead's gates in the main one gave six sessions a gate they never ran, on 2026-10-16's records).
  const unnamed = [{ event: 'start', id: 'g2', at: ago(30), cwd: TREE }];
  assert.equal(stalled({ notices, gates: unnamed }).length, 1);
  const other = [{ event: 'start', id: 'g3', at: ago(30), cwd: TREE, session: 'ffffffff-0000-0000-0000-000000000000' }];
  assert.equal(stalled({ notices, gates: other }).length, 1);
});

test('a gate that started before the limit and ended within it counts from its end', () => {
  const notices = [said(300), handed(200)];
  const gates = [
    { event: 'start', id: 'g1', at: ago(150), cwd: TREE, session: WORKER.id },
    { event: 'end', id: 'g1', at: ago(20), result: 'pass' },
  ];
  assert.deepEqual(stalled({ notices, gates }), []);
  const found = stalled({ notices, gates: [gates[0]] });
  assert.equal(found[0].quietSince, ago(150));
});

test('a commit on its worktree within the limit keeps it out; the commit is read only for a quiet session', () => {
  const asked = [];
  const commitAt = (worktree, branch) => {
    asked.push([worktree, branch]);
    return NOW - 10 * 60 * 1000;
  };
  assert.deepEqual(stalled({ notices: [said(300), handed(200)], commitAt }), []);
  assert.deepEqual(asked, [[TREE, 'feat/lead-tools']]);
  asked.length = 0;
  stalled({ notices: [said(300), handed(20)], commitAt });
  assert.deepEqual(asked, [], 'a session inside the limit costs no git read');
  // An older commit leaves it stalled, quiet from the latest thing it did.
  const found = stalled({ notices: [said(300), handed(200)], commitAt: () => NOW - 100 * 60 * 1000 });
  assert.equal(found[0].quietSince, ago(100));
});

test('an opening is handed work: a session opened and never heard from is stalled from its opening', () => {
  const found = stalled({ notices: [], openings: [{ title: 'JH 23 · nueva', at: ago(90), from: LEAD, text: 'Read odd/tasks/x.md' }] });
  assert.equal(found.length, 1);
  assert.equal(found[0].number, 23);
  assert.equal(found[0].title, 'JH 23 · nueva');
  assert.equal(found[0].worktree, null);
  assert.deepEqual(found[0].holding, { what: 'opening', at: ago(90), from: LEAD.title, kind: null, text: 'Read odd/tasks/x.md' });
});

test('only the orchestrator hands work: a peer, the wake broadcast and notices to the orchestrator hand none', () => {
  const peer = { id: 'cccccccc-0000-0000-0000-000000000000', title: 'JH 27 · reserva A' };
  const notices = [
    { at: ago(300), from: { id: 'w', title: 'js-harness wake' }, to: { role: 'work', number: 7 }, kind: 'note', text: 'The machine booted' },
    { at: ago(300), from: peer, to: { role: 'work', number: 16 }, kind: 'note', text: 'the lead gave me T9' },
    { at: ago(300), from: WORKER, to: { role: 'orchestrator', number: null }, kind: 'note', text: 'to the lead' },
  ];
  assert.deepEqual(stalled({ notices }), []);
  // A handed notice to a number that never wrote has no title to give.
  const found = stalled({ notices: [{ ...handed(90), to: { role: 'work', number: 7 } }] });
  assert.deepEqual(found.map((session) => [session.number, session.title]), [[7, null]]);
});

test('a session quiet for longer than the window has left the board and is not listed', () => {
  const notices = [said(900), handed(800)];
  assert.equal(stalled({ notices }).length, 1, 'no window lists it');
  assert.deepEqual(stalled({ notices, windowMs: 12 * HOUR }), []);
  assert.equal(stalled({ notices, windowMs: 14 * HOUR }).length, 1);
});

test('several stalled sessions come longest quiet first', () => {
  const other = { id: 'bbbbbbbb-0000-0000-0000-000000000000', title: 'JH 20 · otra' };
  const notices = [handed(100), { at: ago(300), from: LEAD, to: { role: 'work', number: 20 }, kind: 'note', text: 'go' }, { at: ago(250), from: other, to: { role: 'orchestrator', number: null }, kind: 'note', text: 'on it' }];
  assert.deepEqual(stalled({ notices }).map((session) => session.number), [20, 19]);
});

test('branchCommitAt asks git for the newest commit the default branch does not hold, and says null when git cannot', () => {
  const asked = [];
  const run = (command, args) => {
    asked.push([command, ...args]);
    return { status: 0, stdout: '2026-10-16T14:10:00-05:00\n' };
  };
  assert.equal(branchCommitAt('D:/wt', { run }), Date.parse('2026-10-16T19:10:00.000Z'));
  assert.deepEqual(asked, [['git', '-C', 'D:/wt', 'log', '-1', '--format=%cI', 'HEAD', '--not', 'origin/HEAD', '--']]);
  // A branch the default branch holds whole has nothing of its own: no line, no time.
  assert.equal(branchCommitAt('D:/wt', { run: () => ({ status: 0, stdout: '' }) }), null);
  // No origin/HEAD in the clone: origin/main is asked next.
  const tried = [];
  const fallback = (command, args) => {
    tried.push(args.at(-2));
    return args.at(-2) === 'origin/HEAD' ? { status: 128, stdout: '', stderr: 'bad revision' } : { status: 0, stdout: '2026-10-16T19:00:00Z\n' };
  };
  assert.equal(branchCommitAt('D:/wt', { run: fallback }), Date.parse('2026-10-16T19:00:00Z'));
  assert.deepEqual(tried, ['origin/HEAD', 'origin/main']);
  assert.equal(branchCommitAt('D:/wt', { run: () => ({ error: new Error('ENOENT') }) }), null);
});

test('readStalled reads the channel, the openings and the gate log under a home, and lists who is stalled', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stall-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const slug = 'D--proj';
  fs.mkdirSync(path.join(home, '.js-harness', 'channel', 'openings', slug), { recursive: true });
  const notice = (fields) => JSON.stringify({ schema: 'js-harness.channel-notice/v1', to: { role: 'work', number: 19 }, kind: 'note', text: 'x', ...fields });
  fs.writeFileSync(path.join(home, '.js-harness', 'channel', `${slug}.jsonl`), [notice({ at: ago(200), from: WORKER, to: { role: 'orchestrator', number: null } }), notice({ at: ago(120), from: LEAD, text: 'T3 is yours' }), 'torn {'].join('\n'));
  fs.writeFileSync(path.join(home, '.js-harness', 'channel', 'openings', slug, 'jh-23.json'), JSON.stringify({ schema: 'js-harness.channel-opening/v1', title: 'JH 23 · nueva', at: ago(30), from: LEAD, text: 'Read x' }));
  fs.writeFileSync(path.join(home, '.js-harness', 'channel', 'openings', slug, 'broken.json'), '{');
  fs.mkdirSync(path.join(home, '.js-harness', 'gate-log'), { recursive: true });
  fs.writeFileSync(path.join(home, '.js-harness', 'gate-log', 'log.jsonl'), `${JSON.stringify({ v: 1, event: 'start', id: 'g', at: ago(90), cwd: 'C:/x', session: WORKER.id })}\n`);
  const found = readStalled({ home, slug, now: NOW, limitMs: LIMIT, windowMs: 12 * HOUR, run: () => ({ status: 0, stdout: '' }) });
  // JH 19 ran a gate 90 minutes ago, after the notice of 120: quiet since the gate. JH 23 was opened 30 minutes ago.
  assert.deepEqual(found.stalled.map((session) => [session.number, session.quietSince]), [[19, ago(90)]]);
  assert.deepEqual(found.unavailable, []);
});

test('readStalled says what it could not read instead of reading it as nothing', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stall-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  // A folder where the record's file should be cannot be read as a file.
  fs.mkdirSync(path.join(home, '.js-harness', 'channel', 'D--proj.jsonl'), { recursive: true });
  const found = readStalled({ home, slug: 'D--proj', now: NOW, limitMs: LIMIT, windowMs: 12 * HOUR });
  assert.deepEqual(found.stalled, []);
  assert.equal(found.unavailable.length, 1);
  assert.match(found.unavailable[0], /^the channel's record/);
});

test('a ticket event names a session but is no gate it ran: issued, claimed, expired or cancelled leave its quiet alone', () => {
  const notices = [said(300), handed(200)];
  for (const event of ['first-issued', 'first-claimed', 'first-expired', 'first-cancelled']) {
    assert.equal(stalled({ notices, gates: [{ event, id: 't1', at: ago(10), session: WORKER.id }] }).length, 1, event);
  }
  for (const event of ['refused', 'stopped', 'same']) {
    assert.deepEqual(stalled({ notices, gates: [{ event, id: 'g', at: ago(10), cwd: 'C:/x', session: WORKER.id }] }), [], event);
  }
});

test('the session that read its opening is known by that reading: its gates count before it sends any notice', () => {
  const openings = [{ title: 'JH 23 · nueva', at: ago(90), from: LEAD, text: 'Read x' }];
  const reader = '23000000-0000-0000-0000-000000000000';
  const gates = [{ event: 'start', id: 'g', at: ago(10), cwd: 'C:/x', session: reader }];
  assert.equal(stalled({ openings, gates }).length, 1, 'without the reading the gate is nobody\'s');
  const readings = [{ reader: { id: reader, title: null }, title: 'JH 23 · nueva', at: ago(85) }];
  assert.deepEqual(stalled({ openings, gates, readings }), []);
});

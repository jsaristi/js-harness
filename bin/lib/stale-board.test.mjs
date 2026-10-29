import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { recordPath } from './channel.mjs';
import { CHECK_MINUTES, CURSOR_SCHEMA, liveCursorPath } from './live-rows.mjs';
import { mainCheckout, projectSlug } from './sessions.mjs';
import { isLeadTitle, STALE_MARKER, staleBoardWarning } from './stale-board.mjs';

// The stale-board check (odd/tasks/visual-pages.md, spec 3, T4). Its records are handed in: the cursor of the board,
// the channel record and the lead's transcript, under a home of the test's own.
const PROJECT = path.resolve('/work/project');
const HOME = path.resolve('/home/me');
const TRANSCRIPT = path.resolve('/claude/projects/p/lead.jsonl');
const noGit = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
const SLUG = projectSlug(mainCheckout(noGit, PROJECT));
const CURSOR = liveCursorPath(HOME, SLUG);
const RECORD = recordPath(HOME, SLUG);
const BOARD = 'https://claude.ai/artifact/board';
const NOW = Date.parse('2026-10-28T23:15:00.000Z');

const LEAD = { host: 'claude-code', id: 'lead-1', title: 'JH ORQ · orquestador F8' };
const WORK = { host: 'claude-code', id: 'work-1', title: 'JH 78 · evals' };
const notice = (at, from, kind = 'note', text = 'x') => JSON.stringify({ schema: 'js-harness.channel-notice/v1', at, from, to: { role: 'orchestrator' }, kind, text });
const OLD = [notice('2026-10-28T21:00:00.000Z', LEAD), notice('2026-10-28T22:00:00.000Z', WORK)];
const sentUpTo = (upto) => JSON.stringify({ schema: CURSOR_SCHEMA, url: BOARD, upto, sent: [] });
const UNREADABLE = Symbol('unreadable');
const warned = (reason) => JSON.stringify({ type: 'attachment', timestamp: '2026-10-28T23:00:00.000Z', attachment: { type: 'hook_blocking_error', hookName: 'Stop', hookEvent: 'Stop', blockingError: { blockingError: reason } } });

function check({ record = OLD, cursor = sentUpTo(1), transcript = [], payload = {}, state = 'working', now = NOW } = {}) {
  const files = { [RECORD]: record === UNREADABLE ? undefined : `${record.join('\n')}\n`, [TRANSCRIPT]: `${transcript.join('\n')}\n` };
  // `null` is no cursor file; UNREADABLE is one that is there and cannot be read.
  if (cursor !== null) files[CURSOR] = cursor === UNREADABLE ? undefined : cursor;
  const io = {
    readFile: (file) => {
      if (Object.hasOwn(files, file) && files[file] === undefined) throw Object.assign(new Error(`EACCES: ${file}`), { code: 'EACCES' });
      if (Object.hasOwn(files, file)) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    run: noGit,
    env: { JS_HARNESS_HOME: HOME },
    homedir: () => path.resolve('/elsewhere'),
  };
  return staleBoardWarning({ cwd: PROJECT, session_id: 'lead-1', transcript_path: TRANSCRIPT, background_tasks: [], ...payload }, state, io, now);
}

test('the lead whose rows waited longer than one check is told how many, since when, the board and how to send them', () => {
  const reason = check();
  assert.ok(reason.includes(STALE_MARKER));
  assert.match(reason, /^js-harness reply: 1 rows/);
  assert.match(reason, /since 22:00 UTC/);
  assert.match(reason, /\(oldest 2026-10-28T22:00:00\.000Z-work-1\)/);
  assert.ok(reason.includes(BOARD));
  assert.match(reason, /Spanish `sesion` and `texto`/, 'rows sent from the warning alone reach him in Spanish');
  assert.match(reason, /js-harness sessions live --out <dir>/);
  assert.match(reason, /js-harness sessions live --sent <file>/);
});

test('rows that waited less than one check, or none, are no warning', () => {
  assert.equal(check({ cursor: sentUpTo(2) }), null, 'nothing waits');
  const fresh = Date.parse('2026-10-28T22:00:00.000Z') + CHECK_MINUTES * 60_000;
  assert.equal(check({ now: fresh }), null, 'the oldest is exactly one check old');
  assert.notEqual(check({ now: fresh + 1 }), null);
});

test('only where the project has a board: no cursor, or a cursor with no link, is nothing', () => {
  assert.equal(check({ cursor: null }), null);
  assert.equal(check({ cursor: JSON.stringify({ schema: CURSOR_SCHEMA, upto: 1, sent: [] }) }), null);
  assert.equal(check({ cursor: JSON.stringify({ url: BOARD, upto: 1, sent: [] }) }), null, 'a file of another schema is not the board\'s');
});

test('a cursor saved before anything was sent counts the rows of the last 24 hours, as sessions live sends them', () => {
  const reason = check({ cursor: JSON.stringify({ schema: CURSOR_SCHEMA, url: BOARD }) });
  assert.match(reason, /^js-harness reply: 2 rows/);
  const later = Date.parse('2026-10-29T21:30:00.000Z');
  assert.match(check({ cursor: JSON.stringify({ schema: CURSOR_SCHEMA, url: BOARD }), now: later }), /^js-harness reply: 1 rows/, 'the 21:00 notice fell out of the window');
});

test('only the lead is told: a work session, a session that sent nothing, and a relieved orchestrator are not', () => {
  assert.equal(check({ payload: { session_id: 'work-1' } }), null);
  assert.equal(check({ payload: { session_id: 'nobody' } }), null);
  const relieved = [...OLD, notice('2026-10-28T22:30:00.000Z', { ...LEAD, title: 'JH ORQ relevada · orquestador F8' })];
  assert.equal(check({ record: relieved }), null, 'its newest notice names it the one that leaves');
  const arriving = [...OLD, notice('2026-10-28T22:10:00.000Z', { host: 'claude-code', id: 'new-1', title: 'JH ORQ nueva · orquestador F8' })];
  assert.notEqual(check({ record: arriving, payload: { session_id: 'new-1' } }), null, 'the arriving lead of a handover is the lead');
});

test('the lead\'s titles: an orchestrator\'s, or the arriving one of a handover', () => {
  assert.equal(isLeadTitle('JH ORQ · orquestador'), true);
  assert.equal(isLeadTitle('JH ORQ nueva · orquestador'), true);
  assert.equal(isLeadTitle('JH ORQ relevada · orquestador'), false);
  assert.equal(isLeadTitle('JH 79 · pages'), false);
  assert.equal(isLeadTitle(null), false);
});

test('a decision or a question close, and Codex, are not warned', () => {
  assert.equal(check({ state: 'decision' }), null);
  assert.equal(check({ state: 'question' }), null);
  assert.equal(check({ payload: { background_tasks: undefined } }), null);
});

test('it warns once a pending set: the same oldest row is not warned again, a newer one is', () => {
  const reason = check();
  assert.equal(check({ transcript: [warned(reason)] }), null);
  const more = [...OLD, notice('2026-10-28T22:20:00.000Z', WORK)];
  assert.notEqual(check({ record: more, cursor: sentUpTo(2), transcript: [warned(reason)] }), null, 'the lead sent the oldest; the next one waits');
  const quoted = JSON.stringify({ type: 'user', message: { role: 'user', content: reason } });
  assert.notEqual(check({ transcript: [quoted] }), null, 'the words quoted elsewhere in the transcript are no warning');
});

test('a cursor or a record it cannot read throws, for the hook to say', () => {
  assert.throws(() => check({ cursor: '{' }), /is not JSON/);
  assert.throws(() => check({ cursor: UNREADABLE }), /the live board's cursor .*EACCES/);
  assert.throws(() => check({ record: UNREADABLE }), /the record of notices .*EACCES/);
});

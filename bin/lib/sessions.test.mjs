import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodePath from 'node:path';
import * as lib from './sessions.mjs';

// Every transcript below is synthetic: the entry shapes are the ones odd/tasks/session-board.md records
// (## Design), the contents are made up for the test.

const at = (minute) => `2026-01-01T10:${String(minute).padStart(2, '0')}:00.000Z`;
const base = (minute) => ({ timestamp: at(minute), cwd: 'C:\\proj', gitBranch: 'main', isSidechain: false });
const transcript = (...entries) => entries.map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry))).join('\n') + '\n';

// The context figures as the tests say them, each computed from the library's constant: the pause is the
// user's rule and the compaction the host's, each has one home, and a test that wrote its value would be
// a second one. `k` says tokens as the board does.
const WINDOW = lib.DEFAULT_CONTEXT_WINDOW;
const PAUSE = lib.shareOf(WINDOW, lib.DEFAULT_CONTEXT_PAUSE_PERCENT);
const COMPACTION = lib.shareOf(WINDOW, lib.DEFAULT_CONTEXT_COMPACTION_PERCENT);
const k = (tokens) => `${Math.round(tokens / 1000)}k`;
const share = (tokens) => `${k(tokens)} tokens (${lib.percentOf(tokens, WINDOW)}%)`;
const PAUSE_SAID = `${lib.DEFAULT_CONTEXT_PAUSE_PERCENT}% of the window (${k(PAUSE)})`;

const prompt =(text, minute) => ({ type: 'user', ...base(minute), origin: { kind: 'human' }, message: { role: 'user', content: text } });
const reply = (text, minute, stop = 'end_turn') => ({ type: 'assistant', ...base(minute), message: { role: 'assistant', stop_reason: stop, content: [{ type: 'text', text }] } });
const thinking = (minute, stop = 'tool_use') => ({ type: 'assistant', ...base(minute), message: { role: 'assistant', stop_reason: stop, content: [{ type: 'thinking', thinking: 'x' }] } });
const call = (id, name, input, minute) => ({ type: 'assistant', ...base(minute), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] } });
const result = (id, toolUseResult, minute, block = {}) => ({ type: 'user', ...base(minute), toolUseResult, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok', ...block }] } });

const notice = ({ task, toolUse, status }) =>
  `<task-notification>\n<task-id>${task}</task-id>\n${toolUse ? `<tool-use-id>${toolUse}</tool-use-id>\n` : ''}${status ? `<status>${status}</status>\n` : '<event>line</event>\n'}<summary>made up</summary>\n</task-notification>`;
const notified = (fields, minute) => ({ type: 'user', ...base(minute), origin: { kind: 'task-notification' }, message: { role: 'user', content: notice(fields) } });

const backgroundBash = (id, task, minute, description = 'Run the gate') => [
  call(id, 'Bash', { command: 'npm run check', description, run_in_background: true }, minute),
  result(id, { stdout: '', stderr: '', backgroundTaskId: task }, minute),
];
const asyncAgent = (id, agent, minute, description = 'Research the format') => [
  call(id, 'Agent', { description, subagent_type: 'Explore', prompt: 'made up' }, minute),
  result(id, { isAsync: true, status: 'async_launched', agentId: agent }, minute),
];

// --- parseTranscript ---

test('parseTranscript skips and counts a line that does not parse, and ignores blank lines', () => {
  const text = transcript(prompt('hello', 1), '', '{"type":"assistant","message":{"content":[{"type":"te');
  const { entries, skipped } = lib.parseTranscript(text);
  assert.equal(entries.length, 1);
  assert.equal(skipped, 1);
});

test('parseTranscript reads CRLF line endings', () => {
  const { entries, skipped } = lib.parseTranscript(`${JSON.stringify(prompt('a', 1))}\r\n${JSON.stringify(reply('b', 2))}\r\n`);
  assert.equal(entries.length, 2);
  assert.equal(skipped, 0);
});

// --- sessionFacts: title, last entry, cwd and branch ---

test('sessionFacts takes the title from the last custom-title entry', () => {
  const facts = lib.sessionFacts(transcript({ type: 'custom-title', customTitle: 'First name', sessionId: 's' }, prompt('do the thing', 1), { type: 'custom-title', customTitle: 'Board feature', sessionId: 's' }));
  assert.equal(facts.title, 'Board feature');
  assert.equal(facts.titleSource, 'custom-title');
});

test('sessionFacts falls back to the start of the first prompt, on one line and cut at 60 characters', () => {
  const long = `Please look at\n  the board ${'x'.repeat(80)}`;
  const facts = lib.sessionFacts(transcript({ type: 'user', ...base(0), isMeta: true, message: { role: 'user', content: 'a caveat nobody typed' } }, prompt(long, 1), prompt('second', 2)));
  assert.equal(facts.titleSource, 'first-prompt');
  assert.equal(facts.title, `Please look at the board ${'x'.repeat(35)}…`);
});

test('sessionFacts has no title when the transcript has neither a title nor a prompt', () => {
  const facts = lib.sessionFacts(transcript(notified({ task: 'b1', status: 'completed' }, 1)));
  assert.equal(facts.title, null);
  assert.equal(facts.titleSource, null);
});

test('sessionFacts gives the time of the last entry and the cwd and branch that entry records', () => {
  const moved = { ...reply('done', 5), cwd: 'C:\\proj-worktrees\\board', gitBranch: 'feat/board' };
  const facts = lib.sessionFacts(transcript(prompt('go', 1), moved, { type: 'custom-title', customTitle: 't', sessionId: 's' }));
  assert.equal(facts.lastEntryAt, at(5));
  assert.equal(facts.cwd, 'C:\\proj-worktrees\\board');
  assert.equal(facts.gitBranch, 'feat/board');
});

test('sessionFacts reports the lines it skipped', () => {
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), 'not json')).skippedLines, 1);
});

// --- sessionFacts: how the session was opened, and its effort (T16 slice 1a) ---

// The first prompt of a transcript says how the session was opened: the desktop app's own entry, a command, the
// SDK's first prompt, or a scheduled run. Its shape is the one of the host's entries (`turnOrigin`, `entrypoint`,
// `turnPosition`), which the fixtures below invent.
const typed = (fields, minute = 1) => ({ ...prompt('go', minute), ...fields });
const openedBy = (...entries) => lib.sessionFacts(transcript(...entries)).opened;

test('sessionFacts says a session his prompt opened in the desktop app was opened by him', () => {
  assert.equal(openedBy(typed({ turnOrigin: 'human', entrypoint: 'claude-desktop' })), 'his');
});

test('sessionFacts says a session a command opened was opened by a command, even when a person sent its prompt', () => {
  assert.equal(openedBy(typed({ turnOrigin: 'human', entrypoint: 'sdk-cli' })), 'command');
  assert.equal(openedBy(typed({ turnOrigin: 'human', entrypoint: 'cli' })), 'command');
});

test('sessionFacts says a scheduled run is scheduled, never a command, even when it ran from the SDK CLI', () => {
  assert.equal(openedBy(typed({ turnOrigin: 'scheduled', entrypoint: 'sdk-cli' })), 'scheduled');
  assert.equal(openedBy(typed({ origin: { kind: 'task', subkind: 'scheduled-trigger' }, entrypoint: 'sdk-cli' })), 'scheduled');
});

test('sessionFacts says a session the SDK opened with its first prompt was opened by a session', () => {
  assert.equal(openedBy(typed({ turnOrigin: 'sdk', turnPosition: { promptIndex: 0 } })), 'session');
});

test('sessionFacts says unknown for an SDK prompt with no turn position, and for a transcript with no prompt', () => {
  assert.equal(openedBy(typed({ turnOrigin: 'sdk' })), 'unknown');
  assert.equal(openedBy(reply('an answer with no prompt', 1)), 'unknown');
  assert.equal(openedBy(typed({ isCompactSummary: true, turnOrigin: 'human', entrypoint: 'claude-desktop' })), 'unknown');
});

test('sessionFacts skips a meta entry and a tool result before the first prompt, and only the first prompt decides', () => {
  const meta = typed({ isMeta: true, turnOrigin: 'sdk', turnPosition: { promptIndex: 0 } }, 2);
  const carrier = { type: 'user', ...base(3), turnOrigin: 'human', entrypoint: 'sdk-cli', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_x', content: 'ok' }] } };
  assert.equal(openedBy(meta, carrier, typed({ turnOrigin: 'human', entrypoint: 'claude-desktop' }, 4), typed({ turnOrigin: 'human', entrypoint: 'sdk-cli' }, 5)), 'his');
});

// Codex on 4d910da: a transcript that starts at a compaction lost its opening prompt, so the first message after it
// is a later turn, and a scheduled session resumed by his message would read as his.
test('sessionFacts says unknown for a transcript whose first prompt comes after a compaction', () => {
  const summary = typed({ isCompactSummary: true, turnOrigin: 'human', entrypoint: 'sdk-cli' }, 1);
  const boundary = { type: 'system', subtype: 'compact_boundary', ...base(1), compactMetadata: { trigger: 'auto', preTokens: 10, postTokens: 2 } };
  const his = typed({ turnOrigin: 'human', entrypoint: 'claude-desktop' }, 4);
  assert.equal(openedBy(summary, his), 'unknown');
  assert.equal(openedBy(boundary, his), 'unknown');
  assert.equal(openedBy(his, boundary, typed({ turnOrigin: 'scheduled' }, 6)), 'his');
});

test('sessionFacts gives the effort of the last assistant entry that has one, and null when none has', () => {
  const high = { ...reply('a', 2), effort: 'high' };
  const low = { ...reply('b', 3), effort: 'low' };
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), high, low, reply('c', 4))).effort, 'low');
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), high, reply('c', 4))).effort, 'high');
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('no effort here', 2))).effort, null);
});

// --- sessionFacts: background work ---

test('a background Bash call is listed with the task id its tool result records, its description and its launch time', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...backgroundBash('toolu_1', 'b1abc', 2)));
  assert.deepEqual(facts.work, [
    { tool: 'Bash', kind: null, toolUseId: 'toolu_1', id: 'b1abc', description: 'Run the gate', launchedAt: at(2), mode: 'background', resumed: false, ended: false, endedAt: null, status: null },
  ]);
});

test('a task notification delivered as a user entry records the end of the task it names, with its status', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...backgroundBash('toolu_1', 'b1abc', 2), notified({ task: 'b1abc', toolUse: 'toolu_1', status: 'completed' }, 9)));
  assert.equal(facts.work[0].ended, true);
  assert.equal(facts.work[0].endedAt, at(9));
  assert.equal(facts.work[0].status, 'completed');
});

test('a notification that only sits in the queue, or was absorbed mid-turn as an attachment, records the end too', () => {
  const queued = { type: 'queue-operation', operation: 'enqueue', timestamp: at(7), sessionId: 's', content: notice({ task: 'b1', toolUse: 'toolu_1', status: 'failed' }) };
  const absorbed = { type: 'attachment', ...base(8), attachment: { type: 'queued_command', commandMode: 'task-notification', prompt: notice({ task: 'b2', toolUse: 'toolu_2', status: 'killed' }) } };
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...backgroundBash('toolu_1', 'b1', 2), ...backgroundBash('toolu_2', 'b2', 3), queued, absorbed));
  assert.deepEqual(facts.work.map((w) => [w.id, w.ended, w.status, w.endedAt]), [['b1', true, 'failed', at(7)], ['b2', true, 'killed', at(8)]]);
});

test('the first recorded end wins when the same notification is written twice', () => {
  const queued = { type: 'queue-operation', operation: 'enqueue', timestamp: at(7), sessionId: 's', content: notice({ task: 'b1', status: 'completed' }) };
  const facts = lib.sessionFacts(transcript(...backgroundBash('toolu_1', 'b1', 2), queued, notified({ task: 'b1', status: 'completed' }, 8)));
  assert.equal(facts.work[0].endedAt, at(7));
});

test('a call and its result written again later (a resumed session repeats entries) do not reopen work that ended', () => {
  const launch = backgroundBash('toolu_1', 'b1', 2);
  const queued = { type: 'queue-operation', operation: 'enqueue', timestamp: at(7), sessionId: 's', content: notice({ task: 'b1', status: 'completed' }) };
  const facts = lib.sessionFacts(transcript(...launch, queued, ...launch, reply('done', 9)));
  assert.deepEqual(facts.work.map((w) => [w.id, w.launchedAt, w.ended, w.endedAt]), [['b1', at(2), true, at(7)]]);
  assert.equal(facts.state, 'waiting');
});

test('a notification without a status (an event of a task still running) is not an end', () => {
  const facts = lib.sessionFacts(transcript(...backgroundBash('toolu_1', 'b1', 2), notified({ task: 'b1' }, 5)));
  assert.equal(facts.work[0].ended, false);
});

test('a notification quoted inside a prompt somebody typed is not an end', () => {
  const quoted = prompt(`look at this: ${notice({ task: 'b1', status: 'completed' })}`, 5);
  const hook = { type: 'attachment', ...base(6), attachment: { type: 'hook_success', stdout: notice({ task: 'b1', status: 'completed' }) } };
  const facts = lib.sessionFacts(transcript(...backgroundBash('toolu_1', 'b1', 2), quoted, hook));
  assert.equal(facts.work[0].ended, false);
});

test('a Bash call that went to the background without asking for it is listed as well', () => {
  const facts = lib.sessionFacts(transcript(call('toolu_1', 'Bash', { command: 'sleep 900', description: 'Wait' }, 2), result('toolu_1', { stdout: '', backgroundTaskId: 'b9' }, 4)));
  assert.deepEqual(facts.work.map((w) => [w.tool, w.id, w.mode, w.launchedAt, w.ended]), [['Bash', 'b9', 'background', at(2), false]]);
});

test('a Bash call that asked for the background and whose result records no task ended with that result', () => {
  const facts = lib.sessionFacts(transcript(call('toolu_1', 'Bash', { command: 'x', description: 'Denied', run_in_background: true }, 2), result('toolu_1', 'the user refused', 3, { is_error: true })));
  assert.deepEqual(facts.work.map((w) => [w.id, w.ended, w.status, w.endedAt]), [[null, true, 'error', at(3)]]);
});

test('an Agent call launched in the background takes its agent id from the tool result, and a notification ends it', () => {
  const open = lib.sessionFacts(transcript(prompt('go', 1), ...asyncAgent('toolu_a', 'a1f', 2)));
  assert.deepEqual(open.work, [
    { tool: 'Agent', kind: 'Explore', toolUseId: 'toolu_a', id: 'a1f', description: 'Research the format', launchedAt: at(2), mode: 'background', resumed: false, ended: false, endedAt: null, status: null },
  ]);
  const closed = lib.sessionFacts(transcript(prompt('go', 1), ...asyncAgent('toolu_a', 'a1f', 2), notified({ task: 'a1f', toolUse: 'toolu_a', status: 'completed' }, 6)));
  assert.deepEqual([closed.work[0].ended, closed.work[0].status], [true, 'completed']);
});

test('a notification that names only the tool call ends the work that call launched', () => {
  const facts = lib.sessionFacts(transcript(...asyncAgent('toolu_a', 'a1f', 2), notified({ task: 'other', toolUse: 'toolu_a', status: 'stopped' }, 6)));
  assert.deepEqual([facts.work[0].ended, facts.work[0].status], [true, 'stopped']);
});

test('an Agent call that runs in the foreground has no id until its tool result, which is its end', () => {
  const launch = call('toolu_a', 'Agent', { description: 'Write the code', subagent_type: 'general-purpose', run_in_background: false, prompt: 'made up' }, 2);
  const running = lib.sessionFacts(transcript(prompt('go', 1), launch));
  assert.deepEqual(running.work.map((w) => [w.id, w.mode, w.ended]), [[null, 'foreground', false]]);
  const done = lib.sessionFacts(transcript(prompt('go', 1), launch, result('toolu_a', { status: 'completed', agentId: 'a77', content: [] }, 8)));
  assert.deepEqual(done.work.map((w) => [w.id, w.mode, w.ended, w.status, w.endedAt]), [['a77', 'foreground', true, 'completed', at(8)]]);
});

test('a notification for a task no tool call of the transcript launched is ignored', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), notified({ task: 'bzz', toolUse: 'toolu_elsewhere', status: 'completed' }, 2)));
  assert.deepEqual(facts.work, []);
});

test('a foreground Bash call and other tools are not background work', () => {
  const facts = lib.sessionFacts(transcript(call('toolu_1', 'Bash', { command: 'ls', description: 'List' }, 1), result('toolu_1', { stdout: 'a' }, 1), call('toolu_2', 'Read', { file_path: 'x' }, 2), result('toolu_2', { file: {} }, 2)));
  assert.deepEqual(facts.work, []);
});

// --- sessionFacts: state ---

test('pendingCall is the last tool call that no result names, with its tool and time, for any tool, and null when every call has its result', () => {
  const pending = (...entries) => lib.sessionFacts(transcript(prompt('go', 1), ...entries)).pendingCall;
  assert.deepEqual(pending(call('toolu_1', 'Read', { file_path: 'x' }, 2), call('toolu_2', 'Bash', { command: 'x', description: 'Run' }, 3)), { id: 'toolu_2', tool: 'Bash', at: at(3) });
  assert.equal(pending(call('toolu_1', 'Bash', { command: 'x' }, 2), result('toolu_1', { stdout: 'a' }, 3)), null);
  assert.equal(pending(reply('done', 2)), null);
  assert.deepEqual(pending(call('toolu_q', 'AskUserQuestion', { questions: [] }, 2)), { id: 'toolu_q', tool: 'AskUserQuestion', at: at(2) }, 'a question tool is a plain fact too');
});

test('state is working when the last entry is a tool call, a tool result, or a prompt not answered yet', () => {
  const toolCall = lib.sessionFacts(transcript(prompt('go', 1), call('toolu_1', 'Read', { file_path: 'x' }, 2)));
  const toolResult = lib.sessionFacts(transcript(prompt('go', 1), call('toolu_1', 'Read', { file_path: 'x' }, 2), result('toolu_1', {}, 3)));
  const unanswered = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), prompt('and now this', 3)));
  const midMessage = lib.sessionFacts(transcript(prompt('go', 1), thinking(2), reply('I will read it', 2, 'tool_use')));
  assert.deepEqual([toolCall.state, toolResult.state, unanswered.state, midMessage.state], ['working', 'working', 'working', 'working']);
});

test('state is background when the turn ended and some background work has no recorded end', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...backgroundBash('toolu_1', 'b1', 2), ...asyncAgent('toolu_a', 'a1', 3), notified({ task: 'b1', status: 'completed' }, 4), reply('The agent is still running.', 5)));
  assert.equal(facts.state, 'background');
});

test('state is waiting when the turn ended and nothing is pending', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...backgroundBash('toolu_1', 'b1', 2), notified({ task: 'b1', status: 'completed' }, 4), reply('All done.', 5), { type: 'system', subtype: 'stop_hook_summary', ...base(6) }, { type: 'attachment', ...base(6), attachment: { type: 'hook_success' } }));
  assert.equal(facts.state, 'waiting');
});

test('an interrupted turn and the output of a local command both end the turn', () => {
  const interrupted = { type: 'user', ...base(3), message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user for tool use]' }] } };
  const local = { type: 'user', ...base(3), message: { role: 'user', content: '<local-command-stdout>Compacted</local-command-stdout>' } };
  const summary = { type: 'user', ...base(3), isCompactSummary: true, message: { role: 'user', content: 'what happened so far' } };
  const states = [interrupted, local, summary].map((last) => lib.sessionFacts(transcript(prompt('go', 1), call('toolu_1', 'Read', {}, 2), last)).state);
  assert.deepEqual(states, ['waiting', 'waiting', 'waiting']);
});

// A session whose tool call was refused, or whose turn was stopped, waits for the person and may say nothing:
// one waited six hours so. The host writes the same refusal when another session stops it, so the fact says
// how the turn ended, never who ended it.
test('a turn that ends refused or interrupted is said as stopped, until the session acts again', () => {
  const stop = (text, minute) => ({ type: 'user', ...base(minute), message: { role: 'user', content: [{ type: 'text', text }] } });
  const refused = lib.sessionFacts(transcript(prompt('go', 1), call('toolu_1', 'Edit', {}, 2), stop('[Request interrupted by user for tool use]', 3)));
  assert.deepEqual([refused.state, refused.stopped], ['waiting', { how: 'refused', at: at(3) }]);
  const interrupted = lib.sessionFacts(transcript(prompt('go', 1), reply('reading', 2, 'tool_use'), stop('[Request interrupted by user]', 4)));
  assert.deepEqual(interrupted.stopped, { how: 'interrupted', at: at(4) });
  const answered = lib.sessionFacts(transcript(prompt('go', 1), call('toolu_1', 'Edit', {}, 2), stop('[Request interrupted by user for tool use]', 3), prompt('go on', 5), reply('done', 6)));
  assert.deepEqual([answered.state, answered.stopped], ['waiting', null]);
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2))).stopped, null);
  // Stopped with work still open (an agent or a background command): the state is background, and it is stopped all the same.
  const withWork = lib.sessionFacts(transcript(prompt('go', 1), ...asyncAgent('toolu_a', 'a1', 2), stop('[Request interrupted by user]', 3)));
  assert.deepEqual([withWork.state, withWork.stopped], ['background', { how: 'interrupted', at: at(3) }]);
});

test('the board marks a stopped session as waiting for the user, and the watch says it once', () => {
  const stopped = seen(A, 'waiting', { stopped: { how: 'refused', at: before(600) } });
  const row = lib.renderBoard({ ...BOARD, sessions: [stopped] }, { now: NOW }).filter((line) => line.includes('stopped'));
  assert.equal(row.length, 1, row.join('\n'));
  assert.match(row[0], /^ {2}stopped \S+ ago: a tool call of it was refused, by the user or by another session's stop: it waits for the user, and tells the orchestrator what it needs$/);
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [stopped] }), [
    'session aaaaaaaa "title a" is waiting (was working): stopped: a tool call of it was refused, by the user or by another session\'s stop',
  ]);
  const plain = seen(A, 'waiting', { stopped: { how: 'interrupted', at: before(600) } });
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [plain] }), [
    'session aaaaaaaa "title a" is waiting (was working): stopped: its turn was interrupted, by the user or by another session\'s stop',
  ]);
  // Stopped while work it launched is still open: no "is waiting" line, so the stop is a line of its own, once.
  const busy = seen(A, 'background', { work: [open('b1')], stopped: { how: 'interrupted', at: before(600) } });
  const said = 'session aaaaaaaa "title a" stopped: its turn was interrupted, by the user or by another session\'s stop (its open work runs on)';
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [busy] }), [said]);
  assert.deepEqual(changes({ sessions: [busy] }, { sessions: [busy] }), []);
  // A session that waits as it should is no news of this kind.
  assert.equal(lib.renderBoard({ ...BOARD, sessions: [seen(A, 'waiting')] }, { now: NOW }).some((line) => line.includes('stopped')), false);
});

test('entries of a side chain and meta entries do not decide the state', () => {
  const side = { ...call('toolu_s', 'Read', {}, 6), isSidechain: true };
  const meta = { type: 'user', ...base(7), isMeta: true, message: { role: 'user', content: 'a reminder' } };
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), side, meta)).state, 'waiting');
});

test('state is unknown, with the reason, when the transcript holds no prompt, reply or tool entry', () => {
  const facts = lib.sessionFacts(transcript({ type: 'custom-title', customTitle: 't', sessionId: 's' }));
  assert.equal(facts.state, 'unknown');
  assert.match(facts.stateReason, /no prompt, reply or tool entry/);
});

// --- sessionFacts: tail of the final reply ---

test('the tail is the last three non-blank lines of the last reply', () => {
  const text = 'Summary line\n\nWhat comes next\n\n```\nsend this prompt\n```\n\n';
  const facts = lib.sessionFacts(transcript(prompt('go', 1), reply('an earlier reply', 2), prompt('more', 3), reply(text, 4)));
  assert.deepEqual(facts.tail, ['```', 'send this prompt', '```']);
});

test('the tail option sets how many lines, and a transcript without a reply has none', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), reply('one\ntwo\nthree', 2)), { tail: 1 });
  assert.deepEqual(facts.tail, ['three']);
  assert.deepEqual(lib.sessionFacts(transcript(prompt('go', 1))).tail, []);
  assert.deepEqual(lib.sessionFacts(transcript(prompt('go', 1), reply('one\ntwo', 2)), { tail: 0 }).tail, []);
});

// --- review follow-ups on the transcript reader ---

// R3-null-entry-fatal: valid JSON that is not an entry, and a block that is not a block, are skipped.
test('parseTranscript skips and counts a line that parses to something other than an object', () => {
  const { entries, skipped } = lib.parseTranscript(transcript('null', '42', '"text"', '[1]', 'true', prompt('hello', 1)));
  assert.equal(entries.length, 1);
  assert.equal(skipped, 5);
});

test('sessionFacts survives lines that are not entries and blocks that are not blocks', () => {
  const odd = (type, content, minute) => ({ type, ...base(minute), message: { role: type, stop_reason: 'end_turn', content } });
  const facts = lib.sessionFacts(
    transcript(
      'null',
      odd('user', [null, 7, { type: 'text', text: 5 }, { type: 'text' }], 1),
      prompt('go', 2),
      odd('assistant', [null, 'x', { type: 'text', text: null }, { type: 'text' }, { type: 'tool_use' }], 3),
      { type: 'user', ...base(4), message: 'not an object' },
      { type: 'attachment', ...base(4), attachment: null },
      reply('done', 5),
      odd('assistant', [null, { type: 'text', text: 9 }], 6),
    ),
  );
  assert.equal(facts.skippedLines, 1);
  assert.equal(facts.title, 'go');
  assert.deepEqual(facts.tail, ['done']);
  assert.deepEqual(facts.work, []);
});

// R3-untested-branches.
test('a Task call, the older name of Agent, is listed as an Agent', () => {
  const facts = lib.sessionFacts(transcript(call('toolu_t', 'Task', { description: 'Old name', subagent_type: 'Explore', prompt: 'made up' }, 2)));
  assert.deepEqual(facts.work.map((w) => [w.tool, w.kind, w.mode]), [['Agent', 'Explore', 'foreground']]);
});

test('a first prompt whose content is a list of blocks gives the title from its text block', () => {
  const blocks = { type: 'user', ...base(1), origin: { kind: 'human' }, message: { role: 'user', content: [{ type: 'image', source: {} }, { type: 'text', text: 'what is in\nthis picture' }] } };
  const facts = lib.sessionFacts(transcript(blocks, reply('a cat', 2)));
  assert.deepEqual([facts.title, facts.titleSource], ['what is in this picture', 'first-prompt']);
});

test('the end of work absorbed mid-turn takes the attachment\'s own time when the entry has none', () => {
  const absorbed = { type: 'attachment', attachment: { type: 'queued_command', commandMode: 'task-notification', timestamp: at(8), prompt: notice({ task: 'b1', status: 'completed' }) } };
  const facts = lib.sessionFacts(transcript(...backgroundBash('toolu_1', 'b1', 2), absorbed));
  assert.deepEqual([facts.work[0].ended, facts.work[0].endedAt], [true, at(8)]);
});

test('a foreground Agent result with no status ended as returned, and one that is an error as error', () => {
  const launch = (id) => call(id, 'Agent', { description: 'Look', subagent_type: 'Explore', prompt: 'made up' }, 2);
  const facts = lib.sessionFacts(transcript(launch('toolu_1'), result('toolu_1', 'plain text, no structure', 3), launch('toolu_2'), result('toolu_2', { status: 'completed', agentId: 'a2' }, 4, { is_error: true })));
  assert.deepEqual(facts.work.map((w) => [w.id, w.ended, w.status, w.endedAt]), [[null, true, 'returned', at(3)], ['a2', true, 'error', at(4)]]);
});

test('a notification that arrives before the tool result that records the task id still ends that work', () => {
  const launch = call('toolu_1', 'Bash', { command: 'true', description: 'Quick', run_in_background: true }, 2);
  const late = result('toolu_1', { stdout: '', backgroundTaskId: 'b1' }, 4);
  const byCall = lib.sessionFacts(transcript(launch, notified({ task: 'b1', toolUse: 'toolu_1', status: 'completed' }, 3), late, reply('done', 5)));
  assert.deepEqual(byCall.work.map((w) => [w.id, w.ended, w.endedAt]), [['b1', true, at(3)]]);
  // Three notifications of the surveyed transcripts name no tool call: the task id is all that ties them.
  const byTask = lib.sessionFacts(transcript(launch, notified({ task: 'b1', status: 'failed' }, 3), late, reply('done', 5)));
  assert.deepEqual(byTask.work.map((w) => [w.id, w.ended, w.status, w.endedAt]), [['b1', true, 'failed', at(3)]]);
  assert.equal(byTask.state, 'waiting');
  const agent = lib.sessionFacts(transcript(call('toolu_a', 'Agent', { description: 'Fast', prompt: 'made up' }, 2), notified({ task: 'a1', status: 'completed' }, 3), result('toolu_a', { isAsync: true, status: 'async_launched', agentId: 'a1' }, 4)));
  assert.deepEqual(agent.work.map((w) => [w.id, w.mode, w.ended, w.endedAt]), [['a1', 'background', true, at(3)]]);
});

// --- T3c: a subagent that is sent a follow-up runs again (and R3-stale-early-end-on-id-reuse) ---

/** A `SendMessage` call to a subagent and its result. `resumed` is what the result says: the agent had
 * stopped and runs again (`resumedAgentId`), or it was still running and the message waits for it. */
const followUp = (id, agent, minute, { summary = 'Fix the findings', resumed = true } = {}) => [
  call(id, 'SendMessage', { to: agent, recipient: agent, type: 'message', summary, message: 'made up', content: 'made up' }, minute),
  result(id, resumed ? { success: true, message: `Resuming agent ${agent}`, resumedAgentId: agent, pin: {} } : { success: true, message: `Message queued for delivery to ${agent} at its next tool round.`, pin: {} }, minute),
];
const firstRun = [...asyncAgent('toolu_a', 'a1', 2), notified({ task: 'a1', toolUse: 'toolu_a', status: 'completed' }, 5), reply('The agent is done.', 6)];

test('a follow-up that resumes a subagent is a new piece of work with the same id, open until its own end', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...firstRun, ...followUp('toolu_s', 'a1', 8), reply('It is running again.', 9)));
  assert.deepEqual(facts.work, [
    { tool: 'Agent', kind: 'Explore', toolUseId: 'toolu_a', id: 'a1', description: 'Research the format', launchedAt: at(2), mode: 'background', resumed: false, ended: true, endedAt: at(5), status: 'completed' },
    { tool: 'Agent', kind: 'Explore', toolUseId: 'toolu_s', id: 'a1', description: 'Fix the findings', launchedAt: at(8), mode: 'background', resumed: true, ended: false, endedAt: null, status: null },
  ]);
  assert.equal(facts.state, 'background');
});

test('the end of a resumed subagent names the follow-up call, and closes that piece only', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...firstRun, ...followUp('toolu_s', 'a1', 8), notified({ task: 'a1', toolUse: 'toolu_s', status: 'failed' }, 12), reply('It failed.', 13)));
  assert.deepEqual(facts.work.map((w) => [w.toolUseId, w.ended, w.endedAt, w.status]), [['toolu_a', true, at(5), 'completed'], ['toolu_s', true, at(12), 'failed']]);
  assert.equal(facts.state, 'waiting');
});

test('a message queued for a subagent that is still running starts no work', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...asyncAgent('toolu_a', 'a1', 2), ...followUp('toolu_s', 'a1', 3, { resumed: false }), reply('Told it.', 4)));
  assert.deepEqual(facts.work.map((w) => [w.toolUseId, w.ended]), [['toolu_a', false]]);
});

test('a subagent that ran in the foreground is resumed in the background, with the kind of its first run', () => {
  const first = [call('toolu_f', 'Agent', { description: 'Write the code', subagent_type: 'general-purpose', run_in_background: false, prompt: 'made up' }, 2), result('toolu_f', { status: 'completed', agentId: 'a7' }, 6)];
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...first, ...followUp('toolu_s', 'a7', 8, { summary: 'One more change' })));
  assert.deepEqual(facts.work.map((w) => [w.id, w.kind, w.mode, w.resumed, w.description, w.ended]), [
    ['a7', 'general-purpose', 'foreground', false, 'Write the code', true],
    ['a7', 'general-purpose', 'background', true, 'One more change', false],
  ]);
});

test('a follow-up to a subagent the transcript never launched is still listed, with no kind', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...followUp('toolu_s', 'a9', 3)));
  assert.deepEqual(facts.work.map((w) => [w.tool, w.id, w.kind, w.resumed, w.ended]), [['Agent', 'a9', null, true, false]]);
});

test('an old end written again after a follow-up does not close the follow-up', () => {
  const again = notified({ task: 'a1', toolUse: 'toolu_a', status: 'completed' }, 10);
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...firstRun, ...followUp('toolu_s', 'a1', 8), again, ...asyncAgent('toolu_a', 'a1', 2), reply('Still running.', 11)));
  assert.deepEqual(facts.work.map((w) => [w.toolUseId, w.ended, w.endedAt]), [['toolu_a', true, at(5)], ['toolu_s', false, null]]);
});

test('a follow-up and its result written again after its end do not reopen it', () => {
  const resumed = followUp('toolu_s', 'a1', 8);
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...firstRun, ...resumed, notified({ task: 'a1', toolUse: 'toolu_s', status: 'completed' }, 12), ...resumed, reply('done', 13)));
  assert.deepEqual(facts.work.map((w) => [w.toolUseId, w.ended, w.endedAt]), [['toolu_a', true, at(5)], ['toolu_s', true, at(12)]]);
});

test('an end that names only the task closes every open piece of that id, and one that names a call nothing launched after it', () => {
  // The first run has no recorded end: the end of the resumed run says the subagent stopped, so both did.
  const open = [...asyncAgent('toolu_a', 'a1', 2), ...followUp('toolu_s', 'a1', 8)];
  const byTask = lib.sessionFacts(transcript(...open, notified({ task: 'a1', status: 'completed' }, 12)));
  assert.deepEqual(byTask.work.map((w) => [w.toolUseId, w.ended, w.endedAt]), [['toolu_a', true, at(12)], ['toolu_s', true, at(12)]]);
  const byLaterCall = lib.sessionFacts(transcript(...open, notified({ task: 'a1', toolUse: 'toolu_s', status: 'completed' }, 12)));
  assert.deepEqual(byLaterCall.work.map((w) => [w.toolUseId, w.ended]), [['toolu_a', true], ['toolu_s', true]]);
  const byFirstCall = lib.sessionFacts(transcript(...open, notified({ task: 'a1', toolUse: 'toolu_a', status: 'completed' }, 12)));
  assert.deepEqual(byFirstCall.work.map((w) => [w.toolUseId, w.ended]), [['toolu_a', true], ['toolu_s', false]]);
});

// R3-stale-early-end-on-id-reuse: an end kept by task id closed every later work that carried the id.
test('an end is used once: work launched later under the same id stays open, and is never ended before its launch', () => {
  const relaunched = lib.sessionFacts(transcript(...asyncAgent('toolu_1', 'a1', 2), notified({ task: 'a1', status: 'completed' }, 5), ...asyncAgent('toolu_2', 'a1', 8), reply('Again.', 9)));
  assert.deepEqual(relaunched.work.map((w) => [w.toolUseId, w.ended, w.endedAt]), [['toolu_1', true, at(5)], ['toolu_2', false, null]]);
  assert.equal(relaunched.state, 'background');

  // An end that arrives before the result that gives the id is kept for that one call, then gone.
  const quick = call('toolu_1', 'Bash', { command: 'true', description: 'Quick', run_in_background: true }, 2);
  const early = lib.sessionFacts(transcript(quick, notified({ task: 'b1', status: 'completed' }, 3), result('toolu_1', { stdout: '', backgroundTaskId: 'b1' }, 4), ...backgroundBash('toolu_2', 'b1', 8)));
  assert.deepEqual(early.work.map((w) => [w.toolUseId, w.ended, w.endedAt]), [['toolu_1', true, at(3)], ['toolu_2', false, null]]);

  // An end for an id nothing has launched yet is not an end of a call made after it.
  const stale = lib.sessionFacts(transcript(notified({ task: 'a1', status: 'completed' }, 1), ...asyncAgent('toolu_1', 'a1', 2), ...followUp('toolu_s', 'a1', 8)));
  assert.deepEqual(stale.work.map((w) => [w.toolUseId, w.ended]), [['toolu_1', false], ['toolu_s', false]]);
});

// R3-task-only-end-between-followup-call-and-result: the kept end was older than the follow-up's result
// but newer than its call, so it closed the piece that result had just started.
test('an end naming only the task, written between a follow-up and its result, does not close the piece that result starts', () => {
  const [sent, answered] = followUp('toolu_s', 'a1', 8);
  const replayed = lib.sessionFacts(transcript(prompt('go', 1), ...firstRun, sent, notified({ task: 'a1', status: 'completed' }, 9), answered, reply('It is running again.', 10)));
  assert.deepEqual(replayed.work.map((w) => [w.toolUseId, w.ended, w.endedAt]), [['toolu_a', true, at(5)], ['toolu_s', false, null]]);
  assert.equal(replayed.state, 'background');
  // The end of the resumed run names the follow-up: written before the result, it is still that piece's end.
  const own = lib.sessionFacts(transcript(prompt('go', 1), ...firstRun, sent, notified({ task: 'a1', toolUse: 'toolu_s', status: 'failed' }, 9), answered));
  assert.deepEqual(own.work.map((w) => [w.toolUseId, w.ended, w.endedAt, w.status]), [['toolu_a', true, at(5), 'completed'], ['toolu_s', true, at(9), 'failed']]);
  // An early end that names another call is not the end of the call whose result gives the same task id.
  const quick = call('toolu_1', 'Bash', { command: 'true', description: 'Quick', run_in_background: true }, 2);
  const other = lib.sessionFacts(transcript(quick, notified({ task: 'b1', toolUse: 'toolu_lost', status: 'completed' }, 3), result('toolu_1', { stdout: '', backgroundTaskId: 'b1' }, 4)));
  assert.deepEqual(other.work.map((w) => [w.toolUseId, w.ended]), [['toolu_1', false]]);
});

// Codex review of 764c9b0, finding 2: an end was kept for a later result only when it had closed nothing,
// so the end of a follow-up that also closed a first run with no recorded end was lost to the follow-up.
test('an end that names a follow-up, written before its result, closes a first run still open and is that follow-up\'s end too', () => {
  const [sent, answered] = followUp('toolu_s', 'a1', 8);
  const stillOpen = asyncAgent('toolu_a', 'a1', 2);
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...stillOpen, sent, notified({ task: 'a1', toolUse: 'toolu_s', status: 'completed' }, 9), answered, reply('Both are done.', 10)));
  assert.deepEqual(facts.work.map((w) => [w.toolUseId, w.ended, w.endedAt, w.status]), [['toolu_a', true, at(9), 'completed'], ['toolu_s', true, at(9), 'completed']]);
  assert.equal(facts.state, 'waiting');
  // An end that names only the task is used up by the run it closed: it is never a follow-up's end.
  const byTask = lib.sessionFacts(transcript(prompt('go', 1), ...stillOpen, sent, notified({ task: 'a1', status: 'completed' }, 9), answered, reply('It is running again.', 10)));
  assert.deepEqual(byTask.work.map((w) => [w.toolUseId, w.ended]), [['toolu_a', true], ['toolu_s', false]]);
  // Kept for the call it names and for no other: a later follow-up to the same subagent stays open.
  const later = lib.sessionFacts(transcript(prompt('go', 1), ...stillOpen, sent, notified({ task: 'a1', toolUse: 'toolu_s', status: 'completed' }, 9), answered, ...followUp('toolu_t', 'a1', 12)));
  assert.deepEqual(later.work.map((w) => [w.toolUseId, w.ended]), [['toolu_a', true], ['toolu_s', true], ['toolu_t', false]]);
});

// --- T5 A: the context a session carries ---

const usage = (input, read, created) => ({ input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: created, output_tokens: 50 });
const spoke = (minute, tokens, { model = 'model-x', text = 'ok', stop = 'end_turn' } = {}) => ({ type: 'assistant', ...base(minute), message: { role: 'assistant', model, stop_reason: stop, usage: tokens, content: [{ type: 'text', text }] } });

test('the context is what the last reply was sent with: its input tokens, read from and written to the cache', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(10, 90000, 500)), prompt('more', 3), spoke(4, usage(12, 270000, 5388))));
  assert.deepEqual(facts.context, { tokens: 275400, model: 'model-x', at: at(4) });
  assert.equal(facts.atContextPause, false);
});

test('a reply the harness wrote itself, a side chain and an entry with no usage are not the session\'s context', () => {
  const synthetic = spoke(5, usage(0, 0, 0), { model: '<synthetic>' });
  const side = { ...spoke(6, usage(1, 999999, 1)), isSidechain: true };
  const noNumbers = spoke(7, { input_tokens: 'many' });
  const facts = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(10, 100000, 0)), synthetic, side, noNumbers, reply('no usage at all', 8)));
  assert.deepEqual(facts.context, { tokens: 100010, model: 'model-x', at: at(2) });
});

test('usage without the cache counts is read as it is, and a transcript whose replies record none has no context, with the reason', () => {
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), spoke(2, { input_tokens: 4200, output_tokens: 9 }))).context.tokens, 4200);
  const none = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2)));
  assert.deepEqual(none.context, { unavailable: 'no reply of the transcript records its token usage' });
  assert.deepEqual([none.atContextPause, none.contextRoom, none.lastTaskFits], [null, null, null]);
});

test('after a compaction the context is what the harness says it left, until the next reply', () => {
  const boundary = { type: 'system', subtype: 'compact_boundary', ...base(6), compactMetadata: { trigger: 'auto', preTokens: 467000, postTokens: 15700 } };
  const compacted = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(10, 466000, 800)), boundary));
  assert.deepEqual(compacted.context, { tokens: 15700, model: 'model-x', at: at(6) });
  const later = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(10, 466000, 800)), boundary, spoke(8, usage(5, 90000, 0))));
  assert.equal(later.context.tokens, 90005);
  const unknown = lib.sessionFacts(transcript(spoke(2, usage(10, 466000, 800)), { type: 'system', subtype: 'compact_boundary', ...base(6) }));
  assert.equal(unknown.context.tokens, 466810, 'a boundary that does not say what it left changes nothing');
});

// Session channel, T5: the three figures a statement about a context is made from are in one place. The
// window is the app's, the compaction is where the host compacts by itself, and the pause is his rule.
test('the context figures: the window the app reports, where the host compacts, and the pause before it', () => {
  assert.equal(lib.DEFAULT_CONTEXT_WINDOW, 500000);
  // The two shares are not written here: each has one home, its constant. What a test holds them to is
  // what they are to each other: both are whole shares of a window, and the pause comes before the
  // compaction, or a session would be compacted before it wrote its state.
  const [pause, compaction] = [lib.DEFAULT_CONTEXT_PAUSE_PERCENT, lib.DEFAULT_CONTEXT_COMPACTION_PERCENT];
  assert.ok(Number.isInteger(pause) && Number.isInteger(compaction) && pause > 0 && pause < compaction && compaction <= 100, `pause ${pause}, compaction ${compaction}`);
  assert.deepEqual([lib.shareOf(500000, 50), lib.shareOf(20000, 2.5), lib.shareOf(WINDOW, pause)], [250000, 500, PAUSE]);
  assert.equal(lib.DEFAULT_CONTEXT_LIMIT, undefined, 'the limit mark left');
  assert.equal(lib.DEFAULT_CONTEXT_LIMIT_PERCENT, undefined);
});

test('a session is at the pause when its context is the pause\'s share of the window or more, and the pause can be set', () => {
  const holding = (tokens) => transcript(prompt('go', 1), spoke(2, usage(0, tokens, 0)));
  assert.equal(lib.sessionFacts(holding(PAUSE - 1)).atContextPause, false);
  assert.equal(lib.sessionFacts(holding(PAUSE)).atContextPause, true, 'at the pause is at it: the rule says "at", not "past"');
  assert.equal(lib.sessionFacts(holding(PAUSE), { contextPause: PAUSE + 5000 }).atContextPause, false);
  const small = lib.shareOf(20000, lib.DEFAULT_CONTEXT_PAUSE_PERCENT);
  assert.deepEqual([small - 1, small].map((tokens) => lib.sessionFacts(holding(tokens), { contextWindow: 20000 }).atContextPause), [false, true], 'the pause follows the window given');
});

// T5b: the desktop app shows the context as a share of its window, and that is the number Sebastián reads.
test('the context is also a percentage of the context window, which can be set', () => {
  const session = transcript(prompt('go', 1), spoke(2, usage(0, 342000, 0)));
  assert.equal(lib.sessionFacts(session).contextPercent, 68, '342k of the 500k the app reports');
  assert.equal(lib.sessionFacts(session, { contextWindow: 1000000 }).contextPercent, 34);
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 520000, 0)))).contextPercent, 104, 'a context above the window is said as it is');
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2))).contextPercent, null);
});

// The entry a compaction writes, as 40 of 40 in this project's transcripts carry it (2026-10-11, keys and
// numbers only): `compactMetadata` with `trigger` (`auto` or `manual`), `preTokens` and `postTokens`.
const compaction = (minute, trigger, preTokens, postTokens, more = {}) => ({ type: 'system', subtype: 'compact_boundary', ...base(minute), compactMetadata: { trigger, preTokens, postTokens }, ...more });

test('the room left is counted to where the host compacts: the point this session measured, or the default', () => {
  const plain = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 400000, 0))));
  assert.deepEqual(plain.contextCompaction, { tokens: COMPACTION, measured: false, at: null });
  assert.equal(plain.contextRoom, COMPACTION - 400000);
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 400000, 0))), { contextCompactionDefault: 450000 }).contextRoom, 50000);
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 4000, 0))), { contextWindow: 20000 }).contextRoom, lib.shareOf(20000, lib.DEFAULT_CONTEXT_COMPACTION_PERCENT) - 4000, 'the default point follows the window given');

  // An automatic compaction of this transcript says where the host compacts it: the latest one.
  const measured = lib.sessionFacts(transcript(
    prompt('go', 1), spoke(2, usage(0, 466000, 0)), compaction(3, 'auto', 468151, 15700),
    spoke(4, usage(0, 466500, 0)), compaction(5, 'auto', 466933, 12400), spoke(6, usage(0, 400000, 0)),
  ));
  assert.deepEqual(measured.contextCompaction, { tokens: 466933, measured: true, at: at(5) });
  assert.equal(measured.contextRoom, 66933);
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), compaction(3, 'auto', 468151, 15700), spoke(6, usage(0, 400000, 0))), { contextCompactionDefault: 450000 }).contextCompaction.tokens, 468151, 'what the session measured wins over the figure given');

  // A compaction the user asked for says nothing of where the host would have compacted.
  const manual = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 322000, 0)), compaction(3, 'manual', 322517, 15346), spoke(4, usage(0, 90000, 0))));
  assert.deepEqual(manual.contextCompaction, { tokens: COMPACTION, measured: false, at: null });
  // A resumed session writes its earlier entries again: the latest compaction is the latest in time.
  const rewritten = lib.sessionFacts(transcript(compaction(5, 'auto', 466933, 12400, { uuid: 'c2' }), compaction(3, 'auto', 468151, 15700, { uuid: 'c1' }), spoke(6, usage(0, 400000, 0))));
  assert.equal(rewritten.contextCompaction.tokens, 466933);
  // Past the point (a session whose host compacts later than the figure says): the room is below zero, as it is.
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, COMPACTION + 5000, 0)))).contextRoom, -5000);
  // With no context read there is no room to say, and the point is still the one known.
  const none = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2)));
  assert.deepEqual([none.contextRoom, none.contextCompaction.tokens], [null, COMPACTION]);
});

test('sessionFacts gives lastCompaction null when the transcript records no compaction', () => {
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 400000, 0)))).lastCompaction, null);
});

test('sessionFacts gives lastCompaction as the newest compaction by its time, whatever its place in the file', () => {
  const newer = compaction(5, 'auto', 412000, 15000, { uuid: 'c2' });
  const older = compaction(3, 'auto', 398000, 14000, { uuid: 'c1' });
  const newest = { uuid: 'c2', at: at(5), automatic: true, before: 412000 };
  assert.deepEqual(lib.sessionFacts(transcript(prompt('go', 1), older, newer, spoke(6, usage(0, 400000, 0)))).lastCompaction, newest);
  assert.deepEqual(lib.sessionFacts(transcript(prompt('go', 1), newer, older, spoke(6, usage(0, 400000, 0)))).lastCompaction, newest, 'a resumed session writes the older one after the newer');
  // A copy of the older boundary written after the newer one, as a resumed session does, changes nothing.
  assert.deepEqual(lib.sessionFacts(transcript(prompt('go', 1), newer, older, older, spoke(6, usage(0, 400000, 0)))).lastCompaction, newest, 'a copy of the older one');
});

test('sessionFacts says whether the newest compaction was asked for by the user, which is not automatic', () => {
  const asked = compaction(5, 'manual', 412000, 15000, { uuid: 'm1' });
  assert.deepEqual(lib.sessionFacts(transcript(prompt('go', 1), asked, spoke(6, usage(0, 400000, 0)))).lastCompaction, { uuid: 'm1', at: at(5), automatic: false, before: 412000 });
});

test('a compaction of a side chain is not the session\'s last compaction: the watch would tell of one the session did not have', () => {
  const own = compaction(3, 'auto', 398000, 14000, { uuid: 'c1' });
  const side = compaction(5, 'auto', 412000, 15000, { uuid: 's1', isSidechain: true });
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), side, spoke(6, usage(0, 400000, 0)))).lastCompaction, null);
  assert.deepEqual(lib.sessionFacts(transcript(prompt('go', 1), own, side, spoke(6, usage(0, 400000, 0)))).lastCompaction, { uuid: 'c1', at: at(3), automatic: true, before: 398000 });
});

// A task, for the board, is the work one instruction started: a prompt the person sent, or a message from
// another session. Its cost is how much the context grew from the instruction to the last reply before
// the next one.
const told = (minute, name = 'JH ORQ · proj') => ({ type: 'user', ...base(minute), isMeta: true, origin: { kind: 'peer', name, fromSession: 'local_1', fromMode: 'bypass', msg_id: `m${minute}` }, message: { role: 'user', content: 'made up' } });

test('the last task is the last stretch of work that ended, and its cost is how much the context grew in it', () => {
  const waiting = lib.sessionFacts(transcript(
    prompt('first', 1), spoke(2, usage(0, 100000, 0)), spoke(3, usage(0, 160000, 0)),
    prompt('second', 4), spoke(5, usage(0, 170000, 0), { stop: 'tool_use' }), spoke(6, usage(0, 230000, 0)),
  ));
  // The session waits: the stretch it just finished is the last. It started holding 160k and ended at 230k.
  assert.equal(waiting.state, 'waiting');
  assert.deepEqual(waiting.lastTask, { tokens: 70000, startedBy: 'person', startedAt: at(4), endedAt: at(6), compactions: 0 });
  assert.equal(waiting.lastTaskFits, true, '235k of room, 70k of task');

  // While it works on a stretch, the last task is the one before: the one in flight has no cost yet.
  const working = lib.sessionFacts(transcript(
    prompt('first', 1), spoke(2, usage(0, 100000, 0)), spoke(3, usage(0, 160000, 0)),
    told(4), spoke(5, usage(0, 170000, 0), { stop: 'tool_use' }),
  ));
  assert.equal(working.state, 'working');
  assert.deepEqual(working.lastTask, { tokens: 60000, startedBy: 'person', startedAt: at(1), endedAt: at(3), compactions: 0 }, 'the first stretch is counted from its first reply');

  // A message from another session starts a task as a prompt does; a hand-back and a notification do not.
  const handback = { ...told(6), origin: { kind: 'peer', handback: true, senderTaskId: 't1' } };
  const peer = lib.sessionFacts(transcript(
    prompt('first', 1), spoke(2, usage(0, 100000, 0)),
    told(3), spoke(4, usage(0, 110000, 0), { stop: 'tool_use' }), notified({ task: 'b1', status: 'completed' }, 5), handback, spoke(7, usage(0, 190000, 0)),
  ));
  assert.deepEqual(peer.lastTask, { tokens: 90000, startedBy: 'session', startedAt: at(3), endedAt: at(7), compactions: 0 });
});

test('the last task: what crosses a compaction, what was written twice, and what no transcript can show', () => {
  // A task that crossed a compaction cost what it grew before it and what it grew after it.
  const crossed = lib.sessionFacts(transcript(
    prompt('first', 1), spoke(2, usage(0, 300000, 0)),
    prompt('second', 3), spoke(4, usage(0, 310000, 0), { stop: 'tool_use' }), compaction(5, 'manual', 360000, 15000), spoke(6, usage(0, 90000, 0)),
  ));
  assert.deepEqual(crossed.lastTask, { tokens: 135000, startedBy: 'person', startedAt: at(3), endedAt: at(6), compactions: 1 });

  // A resumed session writes earlier entries again, with their ids: they start no task and cost nothing.
  const first = { ...prompt('first', 1), uuid: 'p1' };
  const second = { ...prompt('second', 4), uuid: 'p2' };
  const replies = [{ ...spoke(2, usage(0, 100000, 0)), uuid: 'r1' }, { ...spoke(3, usage(0, 160000, 0)), uuid: 'r2' }];
  const resumed = lib.sessionFacts(transcript(first, ...replies, second, { ...spoke(5, usage(0, 170000, 0), { stop: 'tool_use' }), uuid: 'r3' }, first, ...replies, second, { ...spoke(6, usage(0, 230000, 0)), uuid: 'r4' }));
  assert.deepEqual(resumed.lastTask, { tokens: 70000, startedBy: 'person', startedAt: at(4), endedAt: at(6), compactions: 0 });

  // An instruction that arrives before the one before it was answered joins it: one task, from the first.
  const joined = lib.sessionFacts(transcript(prompt('first', 1), spoke(2, usage(0, 100000, 0)), told(3), prompt('and this', 4), spoke(5, usage(0, 150000, 0))));
  assert.deepEqual(joined.lastTask, { tokens: 50000, startedBy: 'session', startedAt: at(3), endedAt: at(5), compactions: 0 });

  // A paste with nothing typed is his too: it starts a task, though it is no prompt to title a session by.
  const pasted = { ...prompt('<pasted_content id="1">an opening</pasted_content id="1">', 3) };
  assert.equal(lib.sessionFacts(transcript(prompt('first', 1), spoke(2, usage(0, 100000, 0)), pasted, spoke(4, usage(0, 130000, 0)))).lastTask.tokens, 30000);

  // The context shrinks a little when the host drops what it no longer needs: a task never costs less than nothing.
  assert.equal(lib.sessionFacts(transcript(prompt('first', 1), spoke(2, usage(0, 100000, 0)), prompt('second', 3), spoke(4, usage(0, 99000, 0)))).lastTask.tokens, 0);

  // What is not known is said, never guessed.
  const reasonOf = (...entries) => lib.sessionFacts(transcript(...entries)).lastTask;
  assert.deepEqual(reasonOf(spoke(2, usage(0, 100000, 0))), { unavailable: 'the transcript holds no prompt of a person and no message from another session' });
  assert.deepEqual(reasonOf(prompt('first', 1), spoke(2, usage(0, 100000, 0), { stop: 'tool_use' })), { unavailable: 'its first task has not ended' });
  assert.deepEqual(reasonOf(prompt('first', 1), reply('no usage', 2)), { unavailable: 'no reply of its last task records its token usage' });
  const blind = { type: 'system', subtype: 'compact_boundary', ...base(3), compactMetadata: { trigger: 'manual', postTokens: 15000 } };
  assert.deepEqual(reasonOf(prompt('first', 1), spoke(2, usage(0, 300000, 0), { stop: 'tool_use' }), blind, spoke(4, usage(0, 90000, 0))), { unavailable: 'a compaction inside its last task does not record the size before it' });
  assert.equal(lib.sessionFacts(transcript(prompt('first', 1), reply('no usage', 2))).lastTaskFits, null);
});

// Review of 5af56c1..303d9ea, finding 2: whether an instruction was answered was read from the count of
// replies with usage, so a reply that records none left its task open and the next instruction joined it.
test('a reply answers its instruction whether or not it records its token usage: the next instruction starts a task', () => {
  const opening = [prompt('first', 1), spoke(2, usage(0, 100000, 0)), prompt('second', 3), reply('no usage', 4), prompt('third', 5), spoke(6, usage(0, 150000, 0), { stop: 'tool_use' })];
  // While the third task works, the last one is the second, and nothing says what it cost: the first is not it.
  const working = lib.sessionFacts(transcript(...opening));
  assert.equal(working.state, 'working');
  assert.deepEqual(working.lastTask, { unavailable: 'no reply of its last task records its token usage' });
  assert.equal(working.lastTaskFits, null);
  // When the third ends it starts at its own instruction. Its cost is counted from the last size the
  // transcript records, the one before the second, so it holds whatever the reply without usage added.
  const ended = lib.sessionFacts(transcript(...opening, spoke(7, usage(0, 180000, 0))));
  assert.deepEqual(ended.lastTask, { tokens: 80000, startedBy: 'person', startedAt: at(5), endedAt: at(7), compactions: 0 });

  // What is not the session's own reply answers nothing: a message the harness wrote in its place and a
  // side chain's leave the instruction open, and the one after it joins it.
  const synthetic = spoke(4, usage(0, 0, 0), { model: '<synthetic>' });
  const side = { ...reply('in a side chain', 4), isSidechain: true };
  const open = lib.sessionFacts(transcript(prompt('first', 1), spoke(2, usage(0, 100000, 0)), prompt('second', 3), synthetic, side, prompt('again', 5), spoke(6, usage(0, 150000, 0))));
  assert.deepEqual(open.lastTask, { tokens: 50000, startedBy: 'person', startedAt: at(3), endedAt: at(6), compactions: 0 });
});

test('the last task no longer fits when it cost more than the room left before the host compacts', () => {
  const session = (held) => transcript(prompt('first', 1), spoke(2, usage(0, held - 60000, 0)), spoke(3, usage(0, held, 0)));
  const exact = COMPACTION - 60000; // what a session holds when the room left is exactly its last task
  assert.deepEqual([lib.sessionFacts(session(exact)).contextRoom, lib.sessionFacts(session(exact)).lastTaskFits], [60000, true], 'a task of exactly the room left fits');
  assert.deepEqual([lib.sessionFacts(session(exact + 1)).contextRoom, lib.sessionFacts(session(exact + 1)).lastTaskFits], [59999, false]);
  // The two facts are separate: at the pause and still fitting (a task of 1,000 tokens), below the pause
  // and no longer fitting (one of 60,000, which is more than the pause leaves before the compaction).
  const small = lib.sessionFacts(transcript(prompt('first', 1), spoke(2, usage(0, PAUSE, 0)), spoke(3, usage(0, PAUSE + 1000, 0))));
  assert.deepEqual([small.atContextPause, small.lastTaskFits], [true, true]);
  assert.deepEqual([lib.sessionFacts(session(PAUSE - 1)).atContextPause, lib.sessionFacts(session(PAUSE - 1)).lastTaskFits], [false, false]);
});

// R3-tool-result-without-recorded-call: a transcript can start after the call (a compaction, a lost line).
test('a tool result whose call the transcript never recorded starts no work and breaks nothing', () => {
  const orphans = [result('toolu_gone', { stdout: '', backgroundTaskId: 'b9' }, 2), result('toolu_gone2', { success: true, resumedAgentId: 'a9' }, 3), result('toolu_gone3', { isAsync: true, agentId: 'a8' }, 4), result(undefined, { status: 'completed', agentId: 'a7' }, 5)];
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...orphans, notified({ task: 'b9', status: 'completed' }, 6), reply('Done.', 7)));
  assert.deepEqual([facts.work, facts.state, facts.skippedLines], [[], 'waiting', 0]);
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), ...orphans)).state, 'working');
});

// --- sessionFacts: messages between sessions, and the permission mode ---
//
// The shapes are the ones a key tally of this project's real transcripts gave on 2026-10-11 (48
// transcripts, 185 entries of origin `peer`, 205 `SendMessage` calls to a session; no text was read):
// a message from another session is a user entry the host marks `isMeta`, with `origin.kind: "peer"`
// and the sender in `name`, `fromSession`, `fromMode` and `msg_id`; a subagent that hands back to its
// parent has `handback` and no session; one the app delivered for a session has `hostInjected` and the wrapper
// text (`delivered`), and one the app put in has `hostInjected` and other text. Every user entry that
// starts a turn carries `permissionMode`. The contents are made up.

const peer = (minute, origin = {}, more = {}) => ({
  type: 'user',
  ...base(minute),
  isMeta: true,
  permissionMode: 'bypassPermissions',
  origin: { kind: 'peer', from: 'uds:made-up', fromSession: 'local_sender-1', fromMode: 'bypass', name: 'JH 1 · made up', msg_id: 'msg-1', body: 'made up', ...origin },
  message: { role: 'user', content: 'Another session sent this: made up' },
  ...more,
});
const handback = (minute) => ({ ...peer(minute), origin: { kind: 'peer', from: 'a1f', senderTaskId: 'a1f', handback: true, body: 'made up' } });
// What the app delivers for a session is a message of that session: its text is the wrapper the session's tool
// writes, with the sender's title in `name`. `injected` builds one as the app writes it, and any other text is
// a message the app put in, which no session sent.
const delivered = (name = 'JH ORQ · made up') => `Another Claude session sent a message: <cross-session-message from="local_sender-2" name="${name}">made up</cross-session-message>`;
const injected = (minute, content = delivered()) => ({ ...peer(minute), message: { role: 'user', content }, origin: { kind: 'peer', from: 'local_sender-2', fromMode: 'bypass', hostInjected: true } });

test('a message from another session starts a turn: the session works until its reply ends it', () => {
  const arrived = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), peer(3)));
  assert.deepEqual([arrived.state, arrived.turnEndedAt], ['working', null]);
  const answered = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), peer(3), reply('noted', 4)));
  assert.deepEqual([answered.state, answered.turnEndedAt], ['waiting', at(4)]);
  // Any other entry the host marks as meta still decides nothing, and neither does a peer entry of a side chain.
  const reminder = { type: 'user', ...base(3), isMeta: true, message: { role: 'user', content: 'a reminder' } };
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), reminder, { ...peer(4), isSidechain: true })).state, 'waiting');
});

test('a message from another session is not his prompt: it is never the title a session falls back to', () => {
  const facts = lib.sessionFacts(transcript(peer(1), reply('noted', 2), prompt('build the roster', 3)));
  assert.deepEqual([facts.title, facts.titleSource], ['build the roster', 'first-prompt']);
  const onlyPeers = lib.sessionFacts(transcript(peer(1), reply('noted', 2)));
  assert.deepEqual([onlyPeers.title, onlyPeers.titleSource], [null, null]);
});

test('sessionFacts lists the messages a session received: when, from whom, and the sender\'s session, mode and message id', () => {
  const second = peer(5, { name: 'JH ORQ · made up', fromSession: 'local_sender-9', msg_id: 'msg-2', hopChain: ['x'] });
  const facts = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), peer(3), reply('noted', 4), second, handback(6), injected(7, 'made up')));
  assert.deepEqual(facts.received, [
    { at: at(3), from: 'session', name: 'JH 1 · made up', session: 'local_sender-1', mode: 'bypass', id: 'msg-1' },
    { at: at(5), from: 'session', name: 'JH ORQ · made up', session: 'local_sender-9', mode: 'bypass', id: 'msg-2' },
    { at: at(6), from: 'subagent', name: null, session: null, mode: null, id: null },
    { at: at(7), from: 'host', name: null, session: null, mode: 'bypass', id: null },
  ]);
  assert.deepEqual(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2))).received, []);
});

test('a message a resumed session writes again is listed once, and what he or a task sends is not a message from a session', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), peer(2), reply('noted', 3), peer(2), reply('noted', 3), prompt('his', 4), notified({ task: 'b1', status: 'completed' }, 5)));
  assert.deepEqual(facts.received.map((message) => message.id), ['msg-1']);
  // Two messages with no id of their own are told apart by the entry that holds each.
  const twice = lib.sessionFacts(transcript({ ...handback(1), uuid: 'u-1' }, { ...handback(2), uuid: 'u-2' }, { ...handback(1), uuid: 'u-1' }));
  assert.deepEqual(twice.received.map((message) => message.at), [at(1), at(2)]);
});

const send = (id, input, minute) => call(id, 'SendMessage', { type: 'message', summary: 'made up', message: 'made up', content: 'made up', recipient: input.to, ...input }, minute);

test('sessionFacts lists the messages a session sent to another session: when, to which address, and the id the host returned', () => {
  const facts = lib.sessionFacts(
    transcript(
      prompt('go', 1),
      send('toolu_m1', { to: 'JH ORQ · made up', recipient_kind: 'name' }, 2),
      result('toolu_m1', { success: true, msg_id: 'msg-7', display: 'made up', message: 'made up' }, 2),
      send('toolu_m2', { to: 'uds:made-up', recipient_kind: 'session' }, 3),
      result('toolu_m2', { success: true, display: 'made up', message: 'made up' }, 3),
      send('toolu_m3', { to: 'JH 9 · made up', recipient_kind: 'name' }, 4),
      result('toolu_m3', 'Error: made up', 4, { is_error: true }),
      send('toolu_m4', { to: 'JH 2 · made up', recipient_kind: 'name' }, 5),
    ),
  );
  assert.deepEqual(facts.sent, [
    { at: at(2), to: 'JH ORQ · made up', toKind: 'name', id: 'msg-7', failed: false, summary: 'made up' },
    { at: at(3), to: 'uds:made-up', toKind: 'session', id: null, failed: false, summary: 'made up' },
    { at: at(4), to: 'JH 9 · made up', toKind: 'name', id: null, failed: true, summary: 'made up' },
    { at: at(5), to: 'JH 2 · made up', toKind: 'name', id: null, failed: false, summary: 'made up' },
  ]);
  assert.deepEqual(facts.work, [], 'a message to a session is not background work');
});

test('a follow-up to a subagent is work and not a message to a session, and a send written again is listed once', () => {
  const toAgent = [send('toolu_f1', { to: 'a1', recipient_kind: 'agent' }, 2), result('toolu_f1', { success: true, resumedAgentId: 'a1', pin: { id: 'a1' } }, 2)];
  // The host of an earlier version named no kind of recipient: what its result returns tells the two apart.
  const older = [send('toolu_f2', { to: 'a2' }, 3), result('toolu_f2', { success: true, pin: { id: 'a2' } }, 3), send('toolu_f3', { to: 'JH 1 · made up' }, 4), result('toolu_f3', { success: true, msg_id: 'msg-8' }, 4)];
  const again = [send('toolu_f3', { to: 'JH 1 · made up' }, 4), result('toolu_f3', { success: true, msg_id: 'msg-8' }, 4)];
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...toAgent, ...older, ...again));
  assert.deepEqual(facts.sent, [{ at: at(4), to: 'JH 1 · made up', toKind: null, id: 'msg-8', failed: false, summary: 'made up' }]);
  assert.deepEqual(facts.work.map((work) => [work.id, work.resumed]), [['a1', true]]);
});

// Every `SendMessage` call of this project's transcripts carries a `summary` (290 of 290, 2026-10-11): the
// sender's own line about the message, 17 to 69 characters in the 182 sent to a session. It is a field of
// the call, not the message: the board prints it and still keeps no message text.
test('a sent message carries the summary its call gives, as one short line, and none when the call gives none', () => {
  const long = `${'palabra '.repeat(30)}fin`;
  const facts = lib.sessionFacts(
    transcript(
      prompt('go', 1),
      send('toolu_s1', { to: 'JH ORQ · made up', recipient_kind: 'name', summary: '  T4b gated,\n  commit follows ' }, 2),
      send('toolu_s2', { to: 'JH ORQ · made up', recipient_kind: 'name', summary: long }, 3),
      send('toolu_s3', { to: 'JH ORQ · made up', recipient_kind: 'name', summary: 7 }, 4),
      send('toolu_s4', { to: 'JH ORQ · made up', recipient_kind: 'name', summary: '   ' }, 5),
    ),
  );
  assert.deepEqual(facts.sent.map((message) => message.summary), ['T4b gated, commit follows', `${long.slice(0, 99)}…`, null, null]);
  assert.equal(Object.keys(facts.sent[0]).join(','), 'at,to,toKind,id,failed,summary', 'and nothing of the message itself');
});

// --- sessionFacts: a task that was stopped ---
//
// From a tally of this project's transcripts (2026-10-11, keys and values only): `TaskStop` is called with
// `task_id` (13 calls), and its result is `{ task_id, task_type: "local_bash", command, message }`, never
// an error among those 13. Ten of the tasks so stopped were background shells of the same transcript, and
// none of the ten has a task notification before or after the stop: the result of the call is the only
// thing a transcript records of it.

const stop = (id, task, minute) => call(id, 'TaskStop', { task_id: task }, minute);
const stopped = (id, task, minute, block = {}) => result(id, { message: 'made up', task_id: task, task_type: 'local_bash', command: 'made up' }, minute, block);

test('a task stopped with TaskStop ended when the call returned, with the status stopped, and its session no longer has background work', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...backgroundBash('toolu_1', 'b1', 2), ...backgroundBash('toolu_2', 'b2', 3, 'Watch the board'), stop('toolu_3', 'b2', 6), stopped('toolu_3', 'b2', 7), reply('Stopped it.', 8)));
  assert.deepEqual(facts.work.map((work) => [work.id, work.ended, work.endedAt, work.status]), [['b1', false, null, null], ['b2', true, at(7), 'stopped']]);
  assert.equal(facts.state, 'background', 'the other shell is still open');
  const alone = lib.sessionFacts(transcript(prompt('go', 1), ...backgroundBash('toolu_2', 'b2', 3), stop('toolu_3', 'b2', 6), stopped('toolu_3', 'b2', 7), reply('Stopped it.', 8)));
  assert.equal(alone.state, 'waiting');
});

test('a TaskStop that failed, that names a task of no call, or that has no result yet ends nothing', () => {
  const launched = [prompt('go', 1), ...backgroundBash('toolu_1', 'b1', 2)];
  const open = (...more) => lib.sessionFacts(transcript(...launched, ...more)).work.map((work) => work.ended);
  assert.deepEqual(open(stop('toolu_3', 'b1', 6), result('toolu_3', 'Error: made up', 7, { is_error: true })), [false]);
  assert.deepEqual(open(stop('toolu_3', 'b9', 6), stopped('toolu_3', 'b9', 7)), [false]);
  assert.deepEqual(open(stop('toolu_3', 'b1', 6)), [false]);
  // The result names the task when the call's input does not (a host that takes another key).
  assert.deepEqual(open(call('toolu_3', 'TaskStop', {}, 6), stopped('toolu_3', 'b1', 7)), [true]);
});

test('a stop is the end of the work launched before it: a notification that arrives later changes nothing, and work launched afterwards under the same id stays open', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...backgroundBash('toolu_1', 'b1', 2), stop('toolu_3', 'b1', 6), stopped('toolu_3', 'b1', 7), notified({ task: 'b1', status: 'killed' }, 8), reply('done', 9)));
  assert.deepEqual(facts.work.map((work) => [work.endedAt, work.status]), [[at(7), 'stopped']]);
  // A resumed session writes the stop and its result again, after a subagent of that id was sent a follow-up.
  const again = lib.sessionFacts(
    transcript(prompt('go', 1), ...asyncAgent('toolu_a', 'a1', 2), stop('toolu_3', 'a1', 3), stopped('toolu_3', 'a1', 4), ...followUp('toolu_f', 'a1', 5), stop('toolu_3', 'a1', 3), stopped('toolu_3', 'a1', 4)),
  );
  assert.deepEqual(again.work.map((work) => [work.resumed, work.ended, work.status]), [[false, true, 'stopped'], [true, false, null]]);
});

test('sessionFacts gives the permission mode the last entry that records one has, and none when no entry does', () => {
  const moded = (mode, minute) => ({ ...prompt('go', minute), permissionMode: mode });
  assert.equal(lib.sessionFacts(transcript(moded('bypassPermissions', 1), reply('done', 2), moded('auto', 3), reply('done', 4))).permissionMode, 'auto');
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), peer(3))).permissionMode, 'bypassPermissions', 'a message from a session records the receiver\'s mode too');
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2))).permissionMode, null);
  assert.equal(lib.sessionFacts(transcript({ ...prompt('go', 1), permissionMode: 7 })).permissionMode, null);
});

// --- machine facts: every external command is a fake `run`, keyed on what it is asked ---

const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
const fails = (stderr, status = 128) => ({ status, stdout: '', stderr });
const notFound = (command) => ({ status: null, stdout: '', stderr: '', error: Object.assign(new Error(`spawnSync ${command} ENOENT`), { code: 'ENOENT' }) });
/** A `run` that answers from `answers`, a list of `[matches(command, args), result or (cwd) => result]`;
 * a command nothing matches throws, so a test never passes on a command it did not expect. */
function fakeRun(answers) {
  return (command, args, { cwd } = {}) => {
    const found = answers.find(([matches]) => matches(command, args));
    if (!found) throw new Error(`unexpected command: ${command} ${args.join(' ')} in ${cwd}`);
    return typeof found[1] === 'function' ? found[1](cwd) : found[1];
  };
}
const git = (...words) => (command, args) => command === 'git' && words.every((word) => args.includes(word));

const WORKTREES = [
  'worktree D:/proj',
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/main',
  '',
  'worktree D:/proj-worktrees/board',
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/feat/board',
  '',
  'worktree D:/proj-worktrees/loose',
  'HEAD 3333333333333333333333333333333333333333',
  'detached',
  '',
].join('\n');

test('projectSlug turns every character outside letters and digits into a dash', () => {
  assert.equal(lib.projectSlug('D:\\js-harness'), 'D--js-harness');
  assert.equal(lib.projectSlug('/home/me/my_app.v2'), '-home-me-my-app-v2');
});

const GONE = ['worktree D:/proj-worktrees/gone', 'HEAD 4444444444444444444444444444444444444444', 'branch refs/heads/feat/gone', 'prunable gitdir file points to non-existent location', ''].join('\n');

test('parseWorktreeList reads path, head and branch, and a detached or bare entry has no branch', () => {
  assert.deepEqual(lib.parseWorktreeList(`${WORKTREES}\nworktree D:/proj.git\nbare\n`.replace(/\n/g, '\r\n')), [
    { path: 'D:/proj', head: '1111111111111111111111111111111111111111', branch: 'main', bare: false, prunable: null },
    { path: 'D:/proj-worktrees/board', head: '2222222222222222222222222222222222222222', branch: 'feat/board', bare: false, prunable: null },
    { path: 'D:/proj-worktrees/loose', head: '3333333333333333333333333333333333333333', branch: null, bare: false, prunable: null },
    { path: 'D:/proj.git', head: null, branch: null, bare: true, prunable: null },
  ]);
});

// R3-enoent-misattributed: a worktree whose folder is gone is not "git is not installed".
test('parseWorktreeList keeps why git calls a worktree prunable', () => {
  assert.deepEqual(lib.parseWorktreeList(GONE), [
    { path: 'D:/proj-worktrees/gone', head: '4444444444444444444444444444444444444444', branch: 'feat/gone', bare: false, prunable: 'gitdir file points to non-existent location' },
  ]);
  assert.equal(lib.parseWorktreeList('worktree D:/x\nHEAD 1\nbranch refs/heads/x\nprunable\n')[0].prunable, 'git gives no reason');
});

test('readWorktrees runs nothing in a worktree git lists as prunable, and says its folder is gone', () => {
  const run = (command, args, { cwd }) => {
    if (args.includes('worktree')) return ok(GONE);
    throw new Error(`nothing may run in a folder that is gone: ${command} ${args.join(' ')} in ${cwd}`);
  };
  const [tree] = lib.readWorktrees(run, 'D:/proj').items;
  const gone = { unavailable: 'its folder is gone: git lists the worktree as prunable (gitdir file points to non-existent location)' };
  assert.deepEqual([tree.aheadOfMain, tree.aheadOfUpstream, tree.changed], [gone, gone, gone]);
});

test('readWorktrees reads ENOENT on a count as the worktree folder missing, because git has just run', () => {
  const run = (command, args) => (args.includes('worktree') ? ok('worktree D:/proj-worktrees/board\nHEAD 1\nbranch refs/heads/b\n') : notFound(command));
  const [tree] = lib.readWorktrees(run, 'D:/proj').items;
  assert.deepEqual(tree.aheadOfMain, { unavailable: 'git rev-list: the folder D:/proj-worktrees/board does not exist (ENOENT starting git there)' });
  assert.deepEqual(tree.aheadOfUpstream, { unavailable: 'git rev-list: the folder D:/proj-worktrees/board does not exist (ENOENT starting git there)' });
  assert.deepEqual(tree.changed, { unavailable: 'git status: the folder D:/proj-worktrees/board does not exist (ENOENT starting git there)' });
});

// R3-empty-stdout-counts-zero: a count is digits only.
for (const printed of ['', '  \n', '0x10', '1e3', '-1', '3.0', '2 commits']) {
  test(`readWorktrees does not take ${JSON.stringify(printed)} for a count`, () => {
    const run = (_command, args) => (args.includes('worktree') ? ok('worktree D:/proj\nHEAD 1\nbranch refs/heads/main\n') : args.includes('rev-list') ? ok(printed) : ok(''));
    const [tree] = lib.readWorktrees(run, 'D:/proj').items;
    assert.deepEqual(tree.aheadOfMain, { unavailable: `git rev-list: printed ${JSON.stringify(printed.trim())}, not a count` });
    assert.equal(tree.changed, 0, 'no line of status is no changed file, a count of its own');
  });
}

test('readWorktrees gives each worktree its commits not on origin/main, not on its upstream, and its changed files', () => {
  const run = fakeRun([
    [git('worktree', 'list', '--porcelain'), ok(WORKTREES)],
    [git('rev-list', '--count', 'origin/main..HEAD'), (cwd) => ok(cwd.endsWith('board') ? '3\n' : '0\n')],
    [git('rev-list', '--count', '@{upstream}..HEAD'), (cwd) => (cwd.endsWith('board') ? fails("fatal: no upstream configured for branch 'feat/board'") : cwd.endsWith('loose') ? fails('fatal: HEAD does not point to a branch') : ok('2\n'))],
    [git('status', '--porcelain'), (cwd) => ok(cwd.endsWith('board') ? ' M bin/a.mjs\n?? bin/b.mjs\n' : '')],
  ]);
  const facts = lib.readWorktrees(run, 'D:/proj');
  assert.equal(facts.available, true);
  assert.deepEqual(facts.items.map((w) => [w.path, w.branch, w.aheadOfMain, w.aheadOfUpstream, w.changed]), [
    ['D:/proj', 'main', 0, 2, 0],
    ['D:/proj-worktrees/board', 'feat/board', 3, 'no upstream', 2],
    ['D:/proj-worktrees/loose', null, 0, 'no upstream', 0],
  ]);
});

test('readWorktrees reads the status without taking the index lock other sessions may need', () => {
  const seen = [];
  const run = (_command, args) => {
    seen.push(args.join(' '));
    return args.includes('worktree') ? ok('worktree D:/proj\nHEAD 1\nbranch refs/heads/main\n') : ok('0\n');
  };
  lib.readWorktrees(run, 'D:/proj');
  assert.ok(seen.includes('--no-optional-locks status --porcelain'), seen.join(' | '));
});

test('readWorktrees marks one count unavailable, with its reason, when only that command fails', () => {
  const run = fakeRun([
    [git('worktree', 'list'), ok('worktree D:/proj\nHEAD 1\nbranch refs/heads/main\n')],
    [git('rev-list', 'origin/main..HEAD'), fails("fatal: ambiguous argument 'origin/main..HEAD': unknown revision\nmore lines")],
    [git('rev-list', '@{upstream}..HEAD'), ok('not a number')],
    [git('status'), { status: null, stdout: '', stderr: '', error: Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }) }],
  ]);
  const [tree] = lib.readWorktrees(run, 'D:/proj').items;
  assert.deepEqual(tree.aheadOfMain, { unavailable: "git rev-list: fatal: ambiguous argument 'origin/main..HEAD': unknown revision" });
  assert.deepEqual(tree.aheadOfUpstream, { unavailable: 'git rev-list: printed "not a number", not a count' });
  assert.deepEqual(tree.changed, { unavailable: 'git status: spawnSync git ETIMEDOUT' });
});

test('readWorktrees does not count anything in a bare entry, and says why', () => {
  const run = fakeRun([[git('worktree', 'list'), ok('worktree D:/proj.git\nbare\n')]]);
  const [tree] = lib.readWorktrees(run, 'D:/proj.git').items;
  assert.deepEqual([tree.aheadOfMain, tree.aheadOfUpstream, tree.changed], Array(3).fill({ unavailable: 'a bare repository has no checkout' }));
});

test('readWorktrees is unavailable as a whole, with the reason, when the list cannot be read', () => {
  assert.deepEqual(lib.readWorktrees(() => fails('fatal: not a git repository'), 'C:/tmp'), { available: false, reason: 'git worktree: fatal: not a git repository' });
  assert.deepEqual(lib.readWorktrees(() => notFound('git'), 'C:/tmp'), { available: false, reason: 'git worktree: git is not installed or not on PATH' });
});

// --- T5 B: the feature plans of a worktree's branch ---

const PLAN = [
  '# Session board',
  '',
  '## Tasks',
  '- [x] T1 the library',
  '- [x] T3b review follow-ups',
  '- [ ] T5 `sessions --watch`: the command waits',
  '- [ ] a step that carries no id and runs on for longer than forty characters',
  '',
  '## Progress',
  '- 2026-01-01: started',
  '',
  '## Next step',
  '',
  'T5 with the delegated writer.',
  '  Then T6, the skill.  ',
  '',
  'Before any push: his word.',
  'A fourth line.',
  '',
  '## Notes',
  'not part of the next step',
  '',
].join('\n');

test('planOf reads a feature document: title, steps done and total, what is pending and its next step', () => {
  assert.deepEqual(lib.planOf(PLAN.replace(/\n/g, '\r\n'), 'odd/tasks/session-board.md'), {
    path: 'odd/tasks/session-board.md',
    title: 'Session board',
    done: 2,
    total: 4,
    pending: ['T5', 'a step that carries no id and runs on fo…'],
    tasks: ['T1 the library', 'T3b review follow-ups', 'T5 `sessions --watch`: the command waits', 'a step that carries no id and runs on for longer than forty characters'],
    nextStep: ['T5 with the delegated writer.', 'Then T6, the skill.', 'Before any push: his word.', 'A fourth line.'],
  });
});

test('planOf of a document with no title, no checkbox and no next step says so with empty facts', () => {
  assert.deepEqual(lib.planOf('some notes\n', 'odd/tasks/loose-notes.md'), { path: 'odd/tasks/loose-notes.md', title: 'loose-notes', done: 0, total: 0, pending: [], tasks: [], nextStep: [] });
});

test('readPlans lists the feature documents that differ from origin/main on the branch or in the working tree, and reads each', () => {
  const asked = [];
  const run = (command, args, { cwd }) => {
    asked.push([command, ...args, cwd].join(' '));
    return args.includes('diff') ? ok('odd/tasks/session-board.md\0odd/tasks/sub/nested.md\0odd/tasks/notes.txt\0') : ok('odd/tasks/draft.md\0odd/tasks/session-board.md\0');
  };
  const read = [];
  const readFile = (file) => {
    read.push(file);
    if (file.endsWith('draft.md')) throw Object.assign(new Error('EBUSY: locked'), { code: 'EBUSY' });
    return PLAN;
  };
  const plans = lib.readPlans(run, readFile, 'D:/proj-worktrees/board/');
  // Neither listing takes the index lock a session committing in that worktree needs.
  assert.deepEqual(asked, [
    'git --no-optional-locks diff --name-only --diff-filter=d --merge-base origin/main -z -- odd/tasks D:/proj-worktrees/board/',
    'git --no-optional-locks ls-files --others --exclude-standard -z -- odd/tasks D:/proj-worktrees/board/',
  ]);
  assert.deepEqual(read, ['D:/proj-worktrees/board/odd/tasks/draft.md', 'D:/proj-worktrees/board/odd/tasks/session-board.md']);
  assert.equal(plans.available, true);
  assert.deepEqual(plans.items.map((plan) => [plan.path, plan.unavailable ?? `${plan.done}/${plan.total}`]), [['odd/tasks/draft.md', 'EBUSY'], ['odd/tasks/session-board.md', '2/4']]);
});

// R3-plan-listing-quoted-names-and-doc-drift: without -z git prints a name with a character outside ASCII
// inside quotes with escapes (`"odd/tasks/se\303\261al.md"`), which is no path at all.
test('readPlans lists a feature document whose name git would print quoted', () => {
  const asGit = (name) => (_command, args) => ok(args.includes('ls-files') ? '' : args.includes('-z') ? `${name}\0` : '"odd/tasks/se\\303\\261al.md"\n');
  const plans = lib.readPlans(asGit('odd/tasks/señal.md'), () => PLAN, 'D:/proj');
  assert.deepEqual(plans.items.map((plan) => [plan.path, `${plan.done}/${plan.total}`]), [['odd/tasks/señal.md', '2/4']]);
  const unread = lib.readPlans(asGit('odd/tasks/a "b"\n.md'), () => { throw Object.assign(new Error('ENOENT: gone'), { code: 'ENOENT' }); }, 'D:/proj');
  assert.deepEqual(unread.items, [{ path: 'odd/tasks/a "b"\n.md', unavailable: 'ENOENT' }], 'a name that cannot be read is listed with the reason');
});

test('readPlans has no plan for a branch with no feature document, and is unavailable with the reason when git fails', () => {
  assert.deepEqual(lib.readPlans(() => ok(''), () => PLAN, 'D:/proj'), { available: true, items: [] });
  const noMain = (_command, args) => (args.includes('diff') ? fails("fatal: ambiguous argument 'origin/main': unknown revision") : ok(''));
  assert.deepEqual(lib.readPlans(noMain, () => PLAN, 'D:/proj'), { available: false, reason: "git diff: fatal: ambiguous argument 'origin/main': unknown revision" });
  const noList = (_command, args) => (args.includes('ls-files') ? fails('fatal: not a git repository') : ok(''));
  assert.deepEqual(lib.readPlans(noList, () => PLAN, 'D:/proj'), { available: false, reason: 'git ls-files: fatal: not a git repository' });
});

test('readWorktrees gives each worktree its plans when it is handed a way to read files, and none otherwise', () => {
  const run = fakeRun([
    [git('worktree', 'list'), ok(`${WORKTREES}\n${GONE}`)],
    [git('rev-list'), ok('0\n')],
    [git('status'), ok('')],
    [git('diff'), (cwd) => ok(cwd.endsWith('board') ? 'odd/tasks/session-board.md\0' : '')],
    [git('ls-files'), ok('')],
  ]);
  const withPlans = lib.readWorktrees(run, 'D:/proj', { readFile: () => PLAN }).items;
  assert.deepEqual(withPlans.map((tree) => (tree.plans.available ? tree.plans.items.map((plan) => plan.path) : tree.plans.reason)), [
    [],
    ['odd/tasks/session-board.md'],
    [],
    'its folder is gone: git lists the worktree as prunable (gitdir file points to non-existent location)',
  ]);
  assert.equal('plans' in lib.readWorktrees(run, 'D:/proj').items[0], false);
});

// --- running gates ---

test('parseProcessList joins each row of the shared process listing with its command line, and wants the end marker', () => {
  const stdout = ['4242\t100\t1767261600000\tnode.exe', 'C\t4242\t"C:\\Program Files\\nodejs\\node.exe" "D:/proj/bin/check.mjs"', '77\t1\t\tbash.exe', 'C\t77\tbash -c "node bin/check.mjs"', 'OK\t2', ''].join('\r\n');
  assert.deepEqual(lib.parseProcessList(stdout), [
    { pid: 4242, createdAt: 1767261600000, commandLine: '"C:\\Program Files\\nodejs\\node.exe" "D:/proj/bin/check.mjs"' },
    { pid: 77, createdAt: null, commandLine: 'bash -c "node bin/check.mjs"' },
  ]);
  assert.throws(() => lib.parseProcessList('4242\t100\t1\tnode.exe\nC\t4242\tnode bin/check.mjs\n'), /did not finish/);
  assert.deepEqual(lib.parseProcessList('OK\t0\n'), []);
});

// R3-end-marker-not-final: the marker proves a whole listing only when it is the last line and its count
// is the number of command lines read.
test('parseProcessList refuses an end marker that is not the last line, and one whose count disagrees', () => {
  const row = '4242\t100\t1\tnode.exe\nC\t4242\tnode bin/check.mjs\n';
  assert.throws(() => lib.parseProcessList(`OK\t1\n${row}`), /did not finish/);
  assert.throws(() => lib.parseProcessList(`${row}OK\t1\n77\t1\t1\tnode.exe\n`), /did not finish/);
  assert.throws(() => lib.parseProcessList(`${row}OK\t2\n`), /announces 2 command lines and holds 1/);
  assert.throws(() => lib.parseProcessList('OK\t1\n'), /announces 1 command lines and holds 0/);
  assert.deepEqual(lib.parseProcessList(`${row}OK\t1\r\n\r\n`).map((found) => found.pid), [4242]);
});

test('parsePsList reads pid and command line, with no start time', () => {
  assert.deepEqual(lib.parsePsList('  812 node /home/me/proj/bin/check.mjs\n 9 /sbin/init\n'), [
    { pid: 812, createdAt: null, commandLine: 'node /home/me/proj/bin/check.mjs' },
    { pid: 9, createdAt: null, commandLine: '/sbin/init' },
  ]);
});

/** What `knowsLock` is for a gate whose script the command line names by a relative path. */
const RELATIVE_SCRIPT = { unavailable: 'its command line names its script by a relative path' };

test('findGates keeps the node processes that run bin/check.mjs, with their worktree and start time', () => {
  const processes = [
    { pid: 1, createdAt: 1767261600000, commandLine: '"C:\\Program Files\\nodejs\\node.exe" "D:/proj-worktrees/board/bin/check.mjs"' },
    { pid: 2, createdAt: 1767261660000, commandLine: 'node D:\\PROJ\\bin\\check.mjs --quick' },
    { pid: 3, createdAt: null, commandLine: 'node bin/check.mjs' },
    { pid: 4, createdAt: 1767261600000, commandLine: 'node /elsewhere/bin/check.mjs' },
    { pid: 5, createdAt: 1767261600000, commandLine: 'bash -c "cd /d/proj && node bin/check.mjs"' },
    { pid: 6, createdAt: 1767261600000, commandLine: 'node --test bin/check.test.mjs' },
    { pid: 7, createdAt: 1767261600000, commandLine: 'node bin/js-harness.mjs sessions' },
    { pid: 8, createdAt: 1767261600000, commandLine: 'node D:/proj/sbin/check.mjs' },
    { pid: 9, createdAt: 1767261600000, commandLine: 'node "D:/proj/sbin/check.mjs"' },
  ];
  assert.deepEqual(lib.findGates(processes, ['D:/proj', 'D:/proj-worktrees/board']), [
    { pid: 1, startedAt: '2026-01-01T10:00:00.000Z', worktree: 'D:/proj-worktrees/board', knowsLock: false, commandLine: processes[0].commandLine },
    { pid: 2, startedAt: '2026-01-01T10:01:00.000Z', worktree: 'D:/proj', knowsLock: false, commandLine: processes[1].commandLine },
    { pid: 3, startedAt: { unavailable: 'the process listing gave no start time' }, worktree: { unavailable: 'its command line names bin/check.mjs by a relative path' }, knowsLock: RELATIVE_SCRIPT, commandLine: 'node bin/check.mjs' },
    { pid: 4, startedAt: '2026-01-01T10:00:00.000Z', worktree: '/elsewhere', knowsLock: false, commandLine: 'node /elsewhere/bin/check.mjs' },
  ]);
});

// Whether a `check` process knows the machine's gate lock is a fact of the script it runs, not of what it
// is doing: the lock's library is beside it (`lib/gate-lock.mjs` in its folder) or it is not, as in every
// checkout from before the lock. The board asks for the script by the path its command line gives.
test('findGates says of each gate whether its script has the lock library beside it, and cannot say for a relative path', () => {
  const processes = [
    { pid: 1, createdAt: null, commandLine: '"C:\\Program Files\\nodejs\\node.exe" "D:/new tree/bin/check.mjs" --wait 5' },
    { pid: 2, createdAt: null, commandLine: 'node D:\\old\\bin\\check.mjs' },
    { pid: 3, createdAt: null, commandLine: 'node bin/check.mjs' },
    { pid: 4, createdAt: null, commandLine: 'node "C:\\Users\\me\\pnpm\\global\\node_modules\\js-harness\\bin\\js-harness.mjs" check' },
    { pid: 5, createdAt: null, commandLine: 'node /usr/local/bin/js-harness check' },
    { pid: 6, createdAt: null, commandLine: 'node bin/js-harness.mjs check' },
    { pid: 7, createdAt: null, commandLine: 'node ../other/bin/check.mjs' },
  ];
  const asked = [];
  const lockLibraryBeside = (script) => {
    asked.push(script);
    return script.startsWith('D:/new tree/') || script.startsWith('C:\\Users\\me\\');
  };
  assert.deepEqual(lib.findGates(processes, [], { lockLibraryBeside }).map((gate) => [gate.pid, gate.knowsLock]), [
    [1, true],
    [2, false],
    [3, RELATIVE_SCRIPT],
    [4, true],
    [5, false],
    [6, RELATIVE_SCRIPT],
    [7, RELATIVE_SCRIPT],
  ]);
  // The script as the command line names it, with no quotes: the caller follows a link and looks beside it.
  assert.deepEqual(asked, ['D:/new tree/bin/check.mjs', 'D:\\old\\bin\\check.mjs', 'C:\\Users\\me\\pnpm\\global\\node_modules\\js-harness\\bin\\js-harness.mjs', '/usr/local/bin/js-harness']);
  // Through `readGates` as well, and with nobody to ask no script is taken to know the lock.
  assert.deepEqual(lib.readGates(() => processes, [], { lockLibraryBeside }).items.map((gate) => gate.knowsLock === true), [true, false, false, true, false, false, false]);
  assert.deepEqual(lib.readGates(() => processes, []).items.map((gate) => gate.knowsLock === true), [false, false, false, false, false, false, false]);
});

// Codex review of 764c9b0, finding 1: the pre-commit hook `js-harness init` writes runs `js-harness check`
// (bin/lib/project.mjs), and the dispatcher runs the gate in its own process, so no command line names
// bin/check.mjs. Pids 1 and 2 are the shapes this machine's process listing gave on 2026-10-09 for a
// dispatcher started by an install's `.cmd` shim and by its `sh` shim, which is how a git hook starts it.
test('findGates keeps the node processes that run the gate through the dispatcher, js-harness check', () => {
  const INSTALL = 'AppData\\Local\\pnpm\\bin\\\\..\\global\\node_modules\\js-harness\\bin\\js-harness.mjs';
  const gatesIn = [
    { pid: 1, createdAt: 1767261600000, commandLine: `node "C:\\Users\\me\\${INSTALL}" check` },
    { pid: 2, createdAt: 1767261600000, commandLine: 'C:\\nvm4w\\nodejs\\node.exe C:/Users/me/AppData/Local/pnpm/bin/../global/node_modules/js-harness/bin/js-harness.mjs check --push --remote origin' },
    { pid: 3, createdAt: 1767261660000, commandLine: '"C:\\Program Files\\nodejs\\node.exe" "D:\\PROJ\\bin\\js-harness.mjs" "check"' },
    { pid: 4, createdAt: null, commandLine: 'node bin/js-harness.mjs check' },
    { pid: 5, createdAt: null, commandLine: 'node /usr/local/bin/js-harness check' }, // a POSIX install links the file with no extension
    { pid: 6, createdAt: null, commandLine: 'node /elsewhere/bin/js-harness.mjs check' },
  ];
  const others = [
    'node bin/js-harness.mjs sessions --watch',
    'node bin/js-harness.mjs contract check odd/tasks/board.md',
    'node bin/js-harness.mjs sessions --self check',
    'node bin/js-harness.mjs checkout',
    'node --test bin/js-harness.test.mjs check',
    'node --test --test-name-pattern "js-harness check" bin/js-harness.test.mjs',
    'node --test --test-name-pattern js-harness check', // the same in a `ps` listing, which drops the quotes
    'node -e "spawn(\'node\', [\'bin/js-harness.mjs check\'])"',
    'node D:/proj/bin/not-js-harness.mjs check',
    'sh -c "js-harness check"',
    'cmd.exe /d /s /c "js-harness.cmd check"',
    '"C:\\Program Files\\Git\\usr\\bin\\sh.exe" /c/Users/me/AppData/Local/pnpm/bin/js-harness check',
  ].map((commandLine, index) => ({ pid: 100 + index, createdAt: 1767261600000, commandLine }));
  const unnamed = { unavailable: 'js-harness check checks the folder it runs in, and its command line names none' };
  const noStart = { unavailable: 'the process listing gave no start time' };
  assert.deepEqual(lib.findGates([...gatesIn, ...others], ['D:/proj', 'D:/proj-worktrees/board']), [
    { pid: 1, startedAt: '2026-01-01T10:00:00.000Z', worktree: unnamed, knowsLock: false, commandLine: gatesIn[0].commandLine },
    // `check --push` is listed as `bin/check.mjs --push` is: it is the push's gate.
    { pid: 2, startedAt: '2026-01-01T10:00:00.000Z', worktree: unnamed, knowsLock: false, commandLine: gatesIn[1].commandLine },
    // The dispatcher of a checkout the board knows is taken to check that checkout, as its bin/check.mjs is.
    { pid: 3, startedAt: '2026-01-01T10:01:00.000Z', worktree: 'D:/proj', knowsLock: false, commandLine: gatesIn[2].commandLine },
    { pid: 4, startedAt: noStart, worktree: unnamed, knowsLock: RELATIVE_SCRIPT, commandLine: 'node bin/js-harness.mjs check' },
    { pid: 5, startedAt: noStart, worktree: unnamed, knowsLock: false, commandLine: 'node /usr/local/bin/js-harness check' },
    // Any other folder is where a dispatcher is installed, not what it checks.
    { pid: 6, startedAt: noStart, worktree: unnamed, knowsLock: false, commandLine: 'node /elsewhere/bin/js-harness.mjs check' },
  ]);
});

test('readGates is unavailable, with the reason, when the processes cannot be listed', () => {
  const broken = () => {
    throw new Error('powershell could not run');
  };
  assert.deepEqual(lib.readGates(broken, []), { available: false, reason: 'the process listing: powershell could not run' });
  assert.deepEqual(lib.readGates(() => [], []), { available: true, items: [] });
});

// --- open pull requests ---

test('readPullRequests asks gh for the open ones and gives number, title and head branch', () => {
  let asked;
  const run = (command, args, options) => {
    asked = { command, args, cwd: options.cwd };
    return ok(JSON.stringify([{ number: 41, title: 'feat: session board', headRefName: 'feat/session-board' }]));
  };
  assert.deepEqual(lib.readPullRequests(run, 'D:/proj'), { available: true, items: [{ number: 41, title: 'feat: session board', branch: 'feat/session-board' }] });
  assert.deepEqual(asked, { command: 'gh', args: ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName'], cwd: 'D:/proj' });
});

test('readPullRequests is unavailable, with the reason, when gh is missing, fails or prints something else', () => {
  assert.deepEqual(lib.readPullRequests(() => notFound('gh'), 'D:/proj'), { available: false, reason: 'gh pr: gh is not installed or not on PATH' });
  assert.deepEqual(lib.readPullRequests(() => fails('To get started with GitHub CLI, please run:  gh auth login', 4), 'D:/proj'), { available: false, reason: 'gh pr: To get started with GitHub CLI, please run:  gh auth login' });
  assert.deepEqual(lib.readPullRequests(() => fails('', 1), 'D:/proj'), { available: false, reason: 'gh pr: exit 1' });
  assert.deepEqual(lib.readPullRequests(() => ok('<html>'), 'D:/proj'), { available: false, reason: 'gh pr: its output is not the JSON list it was asked for' });
});

// --- renderBoard: the text the command prints ---

const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const before = (seconds) => new Date(NOW - seconds * 1000).toISOString();

// --- T5 C: what changed between two boards, for `sessions --watch` ---

test('sessionFacts gives the time the turn ended, and none while the session works', () => {
  const ended = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 5), { type: 'attachment', ...base(6), attachment: { type: 'hook_success' } }, { type: 'system', subtype: 'stop_hook_summary', ...base(7) }));
  assert.deepEqual([ended.state, ended.turnEndedAt, ended.lastEntryAt], ['waiting', at(5), at(7)]);
  const working = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 5), prompt('more', 8)));
  assert.deepEqual([working.state, working.turnEndedAt], ['working', null]);
  const again = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 5), prompt('more', 8), reply('done again', 9)));
  assert.equal(again.turnEndedAt, at(9));
});

const A = 'aaaaaaaa-1111-4111-8111-111111111111';
const B = 'bbbbbbbb-2222-4222-8222-222222222222';
const seen = (id, state, more = {}) => ({ id, title: `title ${id[0]}`, state, turnEndedAt: state === 'working' ? null : before(600), lastEntryAt: before(600), context: { tokens: 100000, model: 'model-x', at: before(600) }, atContextPause: false, work: [], tail: ['a line'], ...more });
const open = (id) => ({ tool: 'Bash', id, description: 'Run', ended: false, file: { path: 'x', modifiedAt: before(90) } });
const boardOf = (parts = {}) => ({ hours: 12, contextPause: PAUSE, contextWindow: WINDOW, generatedAt: before(30), sessions: [], worktrees: { available: true, items: [] }, gates: { available: true, items: [] }, pullRequests: { available: true, items: [] }, ...parts });
const changes = (was, is, options) => lib.boardChanges(boardOf(was), boardOf(is), options);

test('boardChanges: a session that starts waiting, with what it was doing', () => {
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [seen(A, 'waiting')] }), ['session aaaaaaaa "title a" is waiting (was working)']);
  assert.deepEqual(changes({ sessions: [seen(A, 'background', { work: [open('b1'), open('b2')] })] }, { sessions: [seen(A, 'waiting')] }), [
    'session aaaaaaaa "title a" is waiting: the 2 pieces of work it had open ended (was background)',
  ]);
  assert.deepEqual(changes({ sessions: [seen(A, 'unknown', { title: null })] }, { sessions: [seen(A, 'waiting', { title: null })] }), ['session aaaaaaaa "(no title)" is waiting (was unknown)']);
});

test('boardChanges: a session that was waiting, worked and waits again between two looks finished another turn', () => {
  assert.deepEqual(changes({ sessions: [seen(A, 'waiting')] }, { sessions: [seen(A, 'waiting', { turnEndedAt: before(40) })] }), ['session aaaaaaaa "title a" finished another turn and is waiting']);
});

test('boardChanges: a session that appears, one that leaves the window, one that reaches the context pause', () => {
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [seen(A, 'working'), seen(B, 'working')] }), ['session bbbbbbbb "title b" appeared (working)']);
  assert.deepEqual(changes({ sessions: [seen(A, 'waiting'), seen(B, 'working')] }, { sessions: [seen(B, 'working')] }), ['session aaaaaaaa "title a" left the window of the last 12h']);
  // Session channel, T5: the watch wakes once when a session reaches the pause, with what the judgment
  // there needs: what it holds, the room left before the host compacts, and what its last task cost.
  const held = PAUSE + 5499; // a little past the pause, with less room left than its last task took
  const big = {
    context: { tokens: held, model: 'model-x', at: before(40) },
    atContextPause: true,
    contextCompaction: { tokens: COMPACTION, measured: false, at: null },
    contextRoom: COMPACTION - held,
    lastTask: { tokens: 62000, startedBy: 'person', startedAt: before(900), endedAt: before(40), compactions: 0 },
    lastTaskFits: false,
  };
  const reached = `session aaaaaaaa "title a" reached the context pause, ${PAUSE_SAID}: context ${share(held)}, room ${k(COMPACTION - held)} before the host compacts (${k(COMPACTION)}), last task 62k, which no longer fits`;
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [seen(A, 'working', big)] }), [reached]);
  assert.deepEqual(changes({ sessions: [seen(A, 'working', big)] }, { sessions: [seen(A, 'working', { ...big, context: { ...big.context, tokens: held + 9000 } })] }), [], 'already at the pause: said once');
  assert.deepEqual(changes({ sessions: [seen(A, 'working', { atContextPause: null })] }, { sessions: [seen(A, 'working', big)] }), [reached]);
  // A task that no longer fits is a fact of the row, not a second reason to wake: below the pause it wakes nobody.
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [seen(A, 'working', { ...big, atContextPause: false })] }), []);
});

// The watch says once that the session was compacted since the last look: by the host, or at the user's request,
// how long ago (the board's own age of an entry, from when the board was read) and what it held before it.
test('boardChanges: a session compacted by the host since the last look is said once, with how long ago and what it held before', () => {
  const compacted = { uuid: 'c1', at: before(150), automatic: true, before: 412000 };
  assert.deepEqual(changes({ sessions: [seen(A, 'working', { lastCompaction: null })] }, { sessions: [seen(A, 'working', { lastCompaction: compacted })] }), [
    `session aaaaaaaa "title a" was compacted by the host 2m ago: it held ${share(412000)} before it`,
  ]);
  // What the host did not write is not said: a compaction the transcript holds no count for has no "it held".
  const unsized = { ...compacted, uuid: 'c2', before: null };
  assert.deepEqual(changes({ sessions: [seen(A, 'working', { lastCompaction: null })] }, { sessions: [seen(A, 'working', { lastCompaction: unsized })] }), [
    'session aaaaaaaa "title a" was compacted by the host 2m ago',
  ]);
});

test('boardChanges: a compaction the person asked for is said as asked for', () => {
  const asked = { uuid: 'm1', at: before(150), automatic: false, before: 412000 };
  assert.deepEqual(changes({ sessions: [seen(A, 'working', { lastCompaction: null })] }, { sessions: [seen(A, 'working', { lastCompaction: asked })] }), [
    `session aaaaaaaa "title a" was compacted at the user's request 2m ago: it held ${share(412000)} before it`,
  ]);
});

test('boardChanges: a compaction is said once, a board kept before the field says none, a session that appears says none, the watching session says none', () => {
  const compacted = { uuid: 'c1', at: before(150), automatic: true, before: 412000 };
  const later = { uuid: 'c2', at: before(60), automatic: true, before: 400000 };
  const withIt = (lastCompaction) => ({ sessions: [seen(A, 'working', { lastCompaction })] });
  assert.deepEqual(changes(withIt(compacted), withIt(compacted)), [], 'the same boards give nothing');
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, withIt(compacted)), [], 'a board kept before the field has none to compare with');
  assert.deepEqual(changes({ sessions: [] }, { sessions: [seen(A, 'working', { lastCompaction: compacted })] }), [
    'session aaaaaaaa "title a" appeared (working)',
  ], 'a session that appears says nothing of its past compactions');
  assert.deepEqual(changes(withIt(compacted), withIt(later), { self: A }), [], 'the watching session is never said');
});

test('boardChanges: a compaction and the pause reached in one look are both said, the compaction first', () => {
  const compacted = { uuid: 'c1', at: before(150), automatic: true, before: 412000 };
  const reached = seen(A, 'working', { lastCompaction: compacted, atContextPause: true, context: { tokens: PAUSE + 5000, model: 'model-x', at: before(40) } });
  assert.deepEqual(changes({ sessions: [seen(A, 'working', { lastCompaction: null })] }, { sessions: [reached] }), [
    `session aaaaaaaa "title a" was compacted by the host 2m ago: it held ${share(412000)} before it`,
    `session aaaaaaaa "title a" reached the context pause, ${PAUSE_SAID}: context ${share(PAUSE + 5000)}`,
  ]);
});

test('boardChanges: a compaction is told from the one before it by its uuid, or by its time where an entry has no uuid', () => {
  const line = `session aaaaaaaa "title a" was compacted by the host 2m ago: it held ${share(412000)} before it`;
  const withIt = (lastCompaction) => ({ sessions: [seen(A, 'working', { lastCompaction })] });
  const first = { uuid: 'c1', at: before(400), automatic: true, before: 412000 };
  assert.deepEqual(changes(withIt(first), withIt({ ...first, uuid: 'c2', at: before(150) })), [line]);
  assert.deepEqual(changes(withIt({ ...first, at: before(150) }), withIt({ ...first, uuid: 'c2', at: before(150) })), [line], 'another uuid is another compaction, at the same time');
  const untimed = { uuid: null, at: before(400), automatic: true, before: 412000 };
  assert.deepEqual(changes(withIt(untimed), withIt({ ...untimed, at: before(150) })), [line]);
  assert.deepEqual(changes(withIt(untimed), withIt({ ...untimed })), [], 'the same time with no uuid is the same compaction');
});

test('boardChanges: what does not matter wakes nobody', () => {
  const quiet = [
    [seen(A, 'waiting'), seen(A, 'working', { turnEndedAt: null, lastEntryAt: before(5) })],
    [seen(A, 'working'), seen(A, 'background', { work: [open('b1')] })],
    [seen(A, 'working'), seen(A, 'working', { lastEntryAt: before(1), tail: ['another line'], context: { tokens: 120000, model: 'model-x', at: before(1) } })],
    [seen(A, 'background', { work: [open('b1'), open('b2')] }), seen(A, 'background', { work: [{ ...open('b1'), file: { path: 'x', modifiedAt: before(1) } }] })],
    [seen(A, 'waiting'), seen(A, 'waiting', { lastEntryAt: before(1) })],
    [seen(A, 'working'), { id: A, modifiedAt: before(1), unavailable: 'EBUSY' }],
  ];
  for (const [was, is] of quiet) assert.deepEqual(changes({ sessions: [was] }, { sessions: [is], generatedAt: before(0) }), [], `${was.state} to ${is.state}`);
  const tree = (changed) => ({ path: 'D:/proj', branch: 'main', head: '1', aheadOfMain: changed, aheadOfUpstream: changed, changed, plans: { available: true, items: [] } });
  assert.deepEqual(changes({ worktrees: { available: true, items: [tree(0)] } }, { worktrees: { available: true, items: [tree(7)] } }), []);
});

// R3-new-session-first-look-unreadable: the unreadable record became the board to compare with, so the
// session was skipped at every later look and its appearance woke nobody.
test('boardChanges announces a session once its transcript can be read, when no look had read it before', () => {
  const unread = { id: A, modifiedAt: before(1), unavailable: 'EBUSY' };
  const line = (state) => `session aaaaaaaa "title a" appeared (${state}): its transcript could not be read until now`;
  assert.deepEqual(changes({ sessions: [unread] }, { sessions: [seen(A, 'waiting')] }), [line('waiting')]);
  // As the watch does it: new to the window and unreadable at one look, readable at the next.
  const [first, second, third] = [boardOf(), boardOf({ sessions: [unread] }), boardOf({ sessions: [seen(A, 'working')] })];
  assert.deepEqual(lib.boardChanges(first, second), [], 'nothing to say about a session nobody could read');
  assert.deepEqual(lib.boardChanges(lib.watchBaseline(first, second), third), [line('working')]);
  assert.deepEqual(lib.boardChanges(lib.watchBaseline(first, second), third, { self: A }), []);
  // One it had read before is compared with what was read, and is not announced again.
  const [known, busy] = [boardOf({ sessions: [seen(A, 'working')] }), boardOf({ sessions: [unread] })];
  assert.deepEqual(lib.boardChanges(lib.watchBaseline(known, busy), boardOf({ sessions: [seen(A, 'working')] })), []);
});

// Session channel, (b2) part 1: a watch says a tool call with no result once it passes the limit, and again each time
// its age doubles. The call is a fact of the session, so its age is read from the boards' own clocks.
test('boardChanges says a tool call with no result once it passes the limit, and again each time its age doubles', () => {
  const said = (age) => `session aaaaaaaa "title a" has a Bash call with no result for ${age}: the host may be holding it for approval, or it hangs`;
  const waiting = (generated, tool = 'Bash') => ({ generatedAt: before(generated), sessions: [seen(A, 'working', { pendingCall: { tool, at: before(2000) } })] });
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, waiting(1100)), [said('15m')], 'a call first seen past the limit is said');
  assert.deepEqual(changes(waiting(1500), waiting(1100)), [said('15m')], 'said when it crosses the limit');
  assert.deepEqual(changes(waiting(1100), waiting(1000)), [], 'not again at the next look');
  assert.deepEqual(changes(waiting(1000), waiting(200)), [said('30m')], 'again when the age doubles');
  assert.deepEqual(changes(waiting(200), waiting(0)), [], 'not between two doublings');
  assert.deepEqual(changes(waiting(0), waiting(-1600)), [said('1h 00m')], 'and again at an hour');
  assert.deepEqual(changes(waiting(1500), waiting(1100), { self: A }), [], 'the watching session is not compared');
  assert.deepEqual(changes(waiting(1500, 'AskUserQuestion'), waiting(1100, 'AskUserQuestion')), [], 'a question is in Open questions, not here');
});

// The call of the agent tool is measured by its own sub-agent, found by the id of its call. The calls of one entry share
// its time, so the file of the other agent launched in that entry is no evidence for this one.
test('a pending agent call is measured by its own sub-agent, not by another launched in the same entry', () => {
  const agent = (id) => ({ type: 'tool_use', id, name: 'Agent', input: { description: id, subagent_type: 'Explore', prompt: 'made up' } });
  const launched = { type: 'assistant', ...base(2), message: { role: 'assistant', stop_reason: 'tool_use', content: [agent('toolu_done'), agent('toolu_wait')] } };
  const facts = lib.sessionFacts(transcript(prompt('go', 1), launched, result('toolu_done', { isAsync: true, status: 'async_launched', agentId: 'a1' }, 3)));
  assert.deepEqual(facts.pendingCall, { id: 'toolu_wait', tool: 'Agent', at: at(2) });
  // Read at 10:20: the pending call's sub-agent is silent since its launch at 10:02, or it wrote at 10:19 (the other one's file is the reverse).
  const judged = (doneWrote, waitWrote) => {
    const work = facts.work.map((item) => ({ ...item, file: { path: item.toolUseId, modifiedAt: item.toolUseId === 'toolu_done' ? doneWrote : waitWrote } }));
    const session = { ...seen(A, 'working'), pendingCall: facts.pendingCall, work };
    return [
      lib.renderBoard({ ...BOARD, sessions: [session] }, { now: Date.parse(at(20)) }).filter((line) => line.includes(' call has had no result for ')),
      changes({ sessions: [seen(A, 'working')] }, { generatedAt: at(20), sessions: [session] }),
    ];
  };
  const row = '  an Agent call has had no result for 18m: the host may be holding it for approval, or it hangs';
  const watch = 'session aaaaaaaa "title a" has an Agent call with no result for 18m: the host may be holding it for approval, or it hangs';
  assert.deepEqual(judged(at(19), at(2)), [[row], [watch]], 'said, although the other agent wrote recently');
  assert.deepEqual(judged(at(2), at(19)), [[], []], 'not said while its own sub-agent wrote recently');
});

// A look that cannot read a session keeps its facts, and the age of the call they hold is measured when they were read,
// so the crossing that the unreadable look could not say is said at the next look that reads the session, once.
test('a tool call that crosses the limit while a look cannot read its transcript is said at the next look that reads it, once', () => {
  const said = 'session aaaaaaaa "title a" has a Bash call with no result for 15m: the host may be holding it for approval, or it hangs';
  const readable = (generated) => boardOf({ generatedAt: before(generated), sessions: [seen(A, 'working', { pendingCall: { tool: 'Bash', at: before(2000) } })] });
  const blind = boardOf({ generatedAt: before(1090), sessions: [{ id: A, modifiedAt: before(1), unavailable: 'EBUSY' }] });
  // The call is 890 s old when it is read, 910 s when the look cannot read it, and 930 s at the look after.
  const [first, back, later] = [readable(1110), readable(1070), readable(1040)];
  assert.deepEqual(lib.boardChanges(first, blind), [], 'a look that cannot read says nothing');
  assert.deepEqual(lib.boardChanges(lib.watchBaseline(first, blind), back), [said], 'the crossing that look could not say is said now');
  assert.deepEqual(lib.boardChanges(back, later), [], 'not again before the age doubles');
});

test('isSelf takes the whole id of a session or its first eight characters or more', () => {
  assert.deepEqual([lib.isSelf(A, A), lib.isSelf(A, 'aaaaaaaa'), lib.isSelf(A, 'aaaaaaaa-1111')], [true, true, true]);
  assert.deepEqual([lib.isSelf(A, 'aaaaaaa'), lib.isSelf(A, B), lib.isSelf(A, ''), lib.isSelf(A, undefined)], [false, false, false, false]);
});

test('boardChanges leaves out the session that is watching', () => {
  assert.deepEqual(changes({ sessions: [seen(A, 'working'), seen(B, 'working')] }, { sessions: [seen(A, 'waiting'), seen(B, 'waiting')] }, { self: A }), ['session bbbbbbbb "title b" is waiting (was working)']);
  assert.deepEqual(changes({ sessions: [] }, { sessions: [seen(A, 'working')] }, { self: A }), []);
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [] }, { self: A }), []);
});

/** A gate that does not know the machine's gate lock, as every gate was before there was one. */
const gate = (pid, worktree) => ({ pid, startedAt: before(10), worktree, knowsLock: false, commandLine: 'node D:/old/bin/check.mjs' });
/** A board's gates, on a machine whose worktrees are `D:/a` and `D:/b`. */
const gates = (...items) => ({ gates: { available: true, items }, worktrees: { available: true, items: [{ path: 'D:/a' }, { path: 'D:/b' }] } });

// Seen live on 2026-10-11: the orchestrator's watch returned for every gate of every session, which is
// progress and decides nothing. What is left is the alarm: two gates that run at once.
test('boardChanges: a gate that starts alone or ends wakes nobody, and one that starts while another runs does', () => {
  assert.deepEqual(changes(gates(), gates(gate(5, 'D:/a'))), [], 'a gate that starts alone');
  assert.deepEqual(changes(gates(gate(5, 'D:/a')), gates(gate(5, 'D:/a'), gate(6, 'D:/b'))), ['gate started in D:/b (pid 6) while another runs in D:/a (pid 5)']);
  assert.deepEqual(changes(gates(gate(5, 'D:/a'), gate(6, { unavailable: 'relative path' })), gates(gate(6, { unavailable: 'relative path' }))), [], 'a gate that ends');
  assert.deepEqual(changes(gates(gate(5, 'D:/a')), gates()), [], 'the last gate that ends');
  assert.deepEqual(changes(gates(), gates(gate(7, { unavailable: 'relative path' }))), []);
  assert.deepEqual(changes(gates(gate(5, 'D:/a')), gates(gate(5, 'D:/a'), gate(7, { unavailable: 'relative path' }))), ['gate started in an unknown worktree (pid 7) while another runs in D:/a (pid 5)']);
  const down = { gates: { available: false, reason: 'the process listing: boom' } };
  assert.deepEqual(changes(gates(gate(5, 'D:/a')), down), [], 'a listing that failed is not a gate that ended');
  assert.deepEqual(changes(down, gates(gate(5, 'D:/a'))), []);
});

// Seen live on 2026-10-06: a watch returned for a `check.mjs` the test suite of a running gate had started
// in a temporary folder. The board lists such a process; the watch compares the gates of the worktrees.
test('boardChanges: a gate in a folder that is none of the worktrees wakes nobody, starting or ending', () => {
  const stray = gate(9, 'C:/Temp/js-harness-pre-push-x');
  assert.deepEqual(changes(gates(), gates(stray)), []);
  assert.deepEqual(changes(gates(stray), gates()), []);
  assert.deepEqual(changes(gates(gate(5, 'D:/a')), gates(gate(5, 'D:/a'), stray)), []);
  assert.deepEqual(changes(gates(stray), gates(stray, gate(5, 'D:/a'))), [], 'and it is not "another" a real gate runs beside');
  // A worktree's gate is one whatever its command line's slashes and case, and is named as that spells it.
  assert.deepEqual(changes(gates(gate(6, 'D:/b')), gates(gate(6, 'D:/b'), gate(5, 'd:\\A\\'))), ['gate started in d:\\A\\ (pid 5) while another runs in D:/b (pid 6)']);
});

test('boardChanges compares no gate at a look that could not list the worktrees: it cannot tell which are theirs', () => {
  const unlisted = { worktrees: { available: false, reason: 'git worktree: boom' } };
  assert.deepEqual(changes(gates(), { ...gates(gate(5, 'D:/a')), ...unlisted }), []);
  assert.deepEqual(changes({ ...gates(gate(5, 'D:/a')), ...unlisted }, gates()), []);
});

// R3-watched-gates-follow-worktree-set: which gates are watched was worked out from each board's own
// worktrees, so a list that changed under a running gate read as that gate ending or starting.
test('boardChanges: a worktree removed or added while a gate keeps its pid is neither a gate that ended nor one that started', () => {
  const on = (paths, ...items) => ({ gates: { available: true, items }, worktrees: { available: true, items: paths.map((path) => ({ path })) } });
  const running = gate(5, 'D:/b');
  assert.deepEqual(changes(on(['D:/a', 'D:/b'], running), on(['D:/a'], running)), [], 'its worktree is no longer listed');
  assert.deepEqual(changes(on(['D:/a'], running), on(['D:/a', 'D:/b'], running)), [], 'its folder became a worktree');
  // The list changing does not hide a gate that really starts beside another at the same look.
  const other = gate(6, 'D:/a');
  assert.deepEqual(changes(on(['D:/a'], other), on(['D:/a', 'D:/b'], other, running)), ['gate started in D:/b (pid 5) while another runs in D:/a (pid 6)']);
  // And a gate in a folder that is no worktree yet is still not the "another" a new gate runs beside.
  assert.deepEqual(changes(on(['D:/a'], running), on(['D:/a'], running, other)), []);
});

// Codex review of 764c9b0, finding 3: a gate was known by its pid alone, so a gate that ended and another
// that took its pid between two looks read as one gate still running.
test('boardChanges: a pid that carries another start time is another gate, and the same gate when either look has no start time', () => {
  const startedAt = (seconds, item) => ({ ...item, startedAt: before(seconds) });
  const first = startedAt(300, gate(5, 'D:/a'));
  assert.deepEqual(changes(gates(first), gates(startedAt(20, gate(5, 'D:/b')))), [], 'one gate ended and one started, each alone');
  // The gate that took the pid starts beside one that was running all along, and that is said.
  assert.deepEqual(changes(gates(first, gate(7, 'D:/b')), gates(startedAt(20, gate(5, 'D:/a')), gate(7, 'D:/b'))), ['gate started in D:/a (pid 5) while another runs in D:/b (pid 7)']);
  assert.deepEqual(changes(gates(first), gates(startedAt(300, gate(5, 'D:/a')))), []);
  // `ps` gives no start time, and a row of the Windows listing may have none: then the pid is all there is.
  const untimed = { ...gate(5, 'D:/a'), startedAt: { unavailable: 'the process listing gave no start time' } };
  assert.deepEqual([changes(gates(untimed), gates(untimed)), changes(gates(first), gates(untimed)), changes(gates(untimed), gates(first))], [[], [], []]);
});

test('boardChanges: a pull request that opens and one that is no longer open', () => {
  const pr = (number) => ({ number, title: `feat: ${number}`, branch: `feat/${number}` });
  const prs = (...items) => ({ pullRequests: { available: true, items } });
  assert.deepEqual(changes(prs(pr(40)), prs(pr(40), pr(41))), ['pull request #41 opened: feat: 41 (feat/41)']);
  assert.deepEqual(changes(prs(pr(40), pr(41)), prs(pr(41))), ['pull request #40 is no longer open: feat: 40 (feat/40)']);
  assert.deepEqual(changes(prs(pr(40)), { pullRequests: { available: false, reason: 'gh pr: exit 1' } }), []);
});

const TASKS = ['T1 Read the transcripts', 'T2 Print the board', 'T3 Watch it'];
const plan = (more = {}) => ({ path: 'odd/tasks/board.md', title: 'Board', done: 1, total: 3, pending: ['T2', 'T3'], tasks: TASKS, nextStep: ['T2 with the writer.', 'Then T3.'], ...more });
const trees = (...plans) => ({ worktrees: { available: true, items: [{ path: 'D:/wt', branch: 'feat/board', plans: { available: true, items: plans } }] } });

// Seen live on 2026-10-11: every box a session ticked woke the orchestrator. A ticked box is progress; a
// task that is added, removed or reworded is the plan changing, which is the orchestrator's to know.
test('boardChanges: a plan whose boxes are ticked or unticked wakes nobody, and one whose tasks are added, removed or reworded does', () => {
  const planOf = (markdown) => lib.planOf(`# Board\n\n${markdown}\n\n## Next step\n\nT2 with the writer.\n`, 'odd/tasks/board.md');
  const was = planOf('- [x] T1 Read the transcripts\n- [ ] T2 Print the board\n- [ ] Review it');
  assert.deepEqual(was.tasks, ['T1 Read the transcripts', 'T2 Print the board', 'Review it'], 'a plan keeps the text of each task, as its line has it');
  const said = (markdown) => changes(trees(was), trees(planOf(markdown)));
  assert.deepEqual(said('- [x] T1 Read the transcripts\n- [x] T2 Print the board\n- [ ] Review it'), [], 'a box that is ticked');
  assert.deepEqual(said('- [ ] T1 Read the transcripts\n- [ ] T2 Print the board\n- [x] Review it'), [], 'one unticked and another ticked');
  assert.deepEqual(said('- [x] T1 Read the transcripts\n- [x] T2 Print the board\n- [x] Review it'), [], 'all of them, so nothing is pending');
  assert.deepEqual(said('- [x] T1 Read the transcripts\n- [ ] T2 Print the board\n- [ ] Review it\n- [ ] T3 Watch it'), ['plan odd/tasks/board.md in D:/wt changed: task added "T3 Watch it"']);
  assert.deepEqual(said('- [x] T1 Read the transcripts\n- [ ] Review it'), ['plan odd/tasks/board.md in D:/wt changed: task removed "T2 Print the board"']);
  assert.deepEqual(said('- [x] T1 Read the transcripts\n- [x] T2 Print the board and the roster\n- [ ] Review it'), ['plan odd/tasks/board.md in D:/wt changed: task T2 reworded, now "T2 Print the board and the roster"']);
  // A task with no id is known by its text alone, so a new wording is one task gone and another there.
  assert.deepEqual(said('- [x] T1 Read the transcripts\n- [ ] T2 Print the board\n- [ ] Review it twice'), ['plan odd/tasks/board.md in D:/wt changed: task added "Review it twice"; task removed "Review it"']);
  // Two tasks of one text are two tasks.
  assert.deepEqual(said('- [x] T1 Read the transcripts\n- [ ] T2 Print the board\n- [ ] Review it\n- [ ] Review it'), ['plan odd/tasks/board.md in D:/wt changed: task added "Review it"']);
  // The order of the tasks is not compared: the same tasks are the same plan.
  assert.deepEqual(said('- [ ] Review it\n- [x] T1 Read the transcripts\n- [ ] T2 Print the board'), []);
  const long = `T9 ${'x'.repeat(200)}`;
  assert.deepEqual(changes(trees(plan()), trees(plan({ tasks: [...TASKS, long] }))), [`plan odd/tasks/board.md in D:/wt changed: task added "${long.slice(0, 99)}…"`]);
});

test('boardChanges: a feature plan whose next step changed, one that appears and one that goes', () => {
  assert.deepEqual(changes(trees(plan()), trees(plan())), []);
  assert.deepEqual(changes(trees(plan()), trees(plan({ done: 2, pending: ['T3'] }))), [], 'the counts alone are progress');
  assert.deepEqual(changes(trees(plan()), trees(plan({ total: 4, pending: ['T2', 'T3', 'T4'], tasks: [...TASKS, 'T4 Ship it'], nextStep: [] }))), ['plan odd/tasks/board.md in D:/wt changed: task added "T4 Ship it"; its next step is now empty']);
  assert.deepEqual(changes(trees(plan()), trees(plan({ nextStep: ['T2 with the writer.', 'Then T3, reopened: the gate failed.'] }))), ['plan odd/tasks/board.md in D:/wt changed: next step now starts "T2 with the writer."']);
  assert.deepEqual(changes(trees(plan({ pending: [] })), trees(plan({ pending: [], nextStep: [] }))), ['plan odd/tasks/board.md in D:/wt changed: its next step is now empty']);
  assert.deepEqual(changes(trees(), trees(plan())), ['plan odd/tasks/board.md appeared in D:/wt: 1/3 done, pending T2, T3']);
  assert.deepEqual(changes(trees(plan()), trees()), ['plan odd/tasks/board.md in D:/wt no longer differs from origin/main']);
  // A worktree that appears with a plan is a feature that starts; one whose plans or document cannot be read is not compared.
  assert.deepEqual(changes({}, trees(plan())), ['plan odd/tasks/board.md appeared in D:/wt: 1/3 done, pending T2, T3']);
  const unread = { worktrees: { available: true, items: [{ path: 'D:/wt', plans: { available: false, reason: 'git diff: boom' } }] } };
  assert.deepEqual([changes(trees(plan()), unread), changes(unread, trees(plan())), changes(trees(plan()), { worktrees: { available: false, reason: 'boom' } })], [[], [], []]);
  assert.deepEqual([changes(trees(plan()), trees({ path: 'odd/tasks/board.md', unavailable: 'EBUSY' })), changes(trees({ path: 'odd/tasks/board.md', unavailable: 'EBUSY' }), trees(plan()))], [[], []]);
});

test('watchBaseline is the newer board, keeping from the older one whatever the newer could not read', () => {
  const gate = { pid: 5, startedAt: before(10), worktree: 'D:/a', commandLine: 'x' };
  const older = boardOf({ sessions: [seen(A, 'waiting'), seen(B, 'working')], gates: { available: true, items: [gate] }, pullRequests: { available: true, items: [{ number: 40 }] }, worktrees: { available: true, items: [{ path: 'D:/wt', changed: 0, plans: { available: true, items: [{ path: 'p', done: 1 }] } }] } });
  const newer = boardOf({
    generatedAt: before(0),
    sessions: [{ id: A, modifiedAt: null, unavailable: 'EBUSY' }, seen(B, 'waiting')],
    gates: { available: false, reason: 'boom' },
    pullRequests: { available: true, items: [] },
    worktrees: { available: true, items: [{ path: 'D:/wt', changed: 3, plans: { available: false, reason: 'git diff: boom' } }] },
  });
  const baseline = lib.watchBaseline(older, newer);
  assert.equal(baseline.generatedAt, before(0));
  assert.deepEqual(baseline.sessions.map((session) => [session.id, session.state]), [[A, 'waiting'], [B, 'waiting']]);
  assert.deepEqual(baseline.gates, older.gates);
  assert.deepEqual(baseline.pullRequests, newer.pullRequests);
  assert.deepEqual(baseline.worktrees.items, [{ path: 'D:/wt', changed: 3, plans: older.worktrees.items[0].plans }]);
  assert.deepEqual(lib.watchBaseline(older, boardOf({ worktrees: { available: false, reason: 'boom' } })).worktrees, older.worktrees);
});

// Which gates a watch compares depends on the worktrees, so a look that could not list them compares none;
// the gate that started at that look must still be new at the next one.
test('watchBaseline keeps the older gates across a look that could not list the worktrees, so a gate that started then is still said', () => {
  const older = boardOf(gates(gate(7, 'D:/b')));
  const blind = boardOf({ ...gates(gate(7, 'D:/b'), gate(5, 'D:/a')), worktrees: { available: false, reason: 'git worktree: boom' } });
  assert.deepEqual(lib.boardChanges(older, blind), []);
  const baseline = lib.watchBaseline(older, blind);
  assert.deepEqual(baseline.gates, older.gates);
  assert.deepEqual(lib.boardChanges(baseline, boardOf(gates(gate(7, 'D:/b'), gate(5, 'D:/a')))), ['gate started in D:/a (pid 5) while another runs in D:/b (pid 7)']);
});

// --- the machine's gate lock: which gate runs and which wait ---
// Since `check` waits for the lock, the process listing shows two `check` processes for one gate that
// runs. The lock says which is which, and the folder each one checks.

/** A board's `gateLock`: `holder` holds the lock and `waiters` are in line for it. */
const lockOf = (holder, ...waiters) => ({ gateLock: { available: true, holder, waiters } });
const holds = (pid, cwd, more = {}) => ({ pid, cwd, command: 'check', startedAt: before(170), beatAt: before(2), stale: false, ...more });
const waits = (pid, cwd, seconds = 60) => ({ pid, cwd, command: 'check', waitingSince: before(seconds) });
const asHolder = (more = {}) => ({ role: 'holder', since: before(170), beatAt: before(2), stale: false, command: 'check', ...more });
const asWaiter = (pid, seconds = 60) => ({ role: 'waiter', since: before(seconds), for: pid, command: 'check' });
/** A gate whose script has the lock's library beside it, started `seconds` ago: before `holds` took the
 * lock and before `waits` began to wait, as the process of either was. */
const aware = (pid, worktree, seconds = 300) => ({ pid, startedAt: before(seconds), worktree, knowsLock: true, commandLine: 'node D:/new/bin/check.mjs' });
/** A gate started as `npm run check`: its command line does not say which script it runs, nor where. */
const unplaced = (pid, seconds = 300) => ({ pid, startedAt: before(seconds), worktree: { unavailable: 'its command line names bin/check.mjs by a relative path' }, knowsLock: RELATIVE_SCRIPT, commandLine: 'node bin/check.mjs' });
/** The row of `boardGates` for a gate of the lock whose process is `item`, checking `worktree`. */
const ofLock = (item, worktree, lock) => ({ pid: item.pid, startedAt: item.startedAt, worktree, commandLine: item.commandLine, lock });

test('readGateLock gives the holder and the waiters as the board holds them, and the reason when the lock cannot be read', () => {
  const holder = { token: '11-aaaaaaaaaaaa', pid: 11, cwd: 'D:\\a', command: 'check', startedAt: before(170), beatAt: NOW - 2000, stale: false };
  const waiter = { token: '22-bbbbbbbbbbbb', pid: 22, cwd: 'D:\\b', command: 'check', waitingSince: before(60) };
  assert.deepEqual(lib.readGateLock(() => ({ holder, waiters: [waiter] })), lockOf(holds(11, 'D:\\a'), waits(22, 'D:\\b')).gateLock);
  assert.deepEqual(lib.readGateLock(() => ({ holder: null, waiters: [] })), { available: true, holder: null, waiters: [] });
  // A lock that is held and of which nothing could be read is a holder all the same, with nothing in it.
  const nobody = { token: null, pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false };
  assert.deepEqual(lib.readGateLock(() => ({ holder: nobody, waiters: [] })).holder, { pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false });
  const noAccess = () => {
    throw new Error("EACCES: permission denied, scandir 'C:\\home\\.js-harness\\gate'");
  };
  assert.deepEqual(lib.readGateLock(noAccess), { available: false, reason: "the gate lock: EACCES: permission denied, scandir 'C:\\home\\.js-harness\\gate'" });
  // The clock the lock was read against goes with what was read, as a date, when the reader gives it.
  assert.deepEqual(lib.readGateLock(() => ({ holder: null, waiters: [], readAt: NOW + 16_000 })), { available: true, holder: null, waiters: [], readAt: before(-16) });
});

// Found in review, 2026-10-10: the lock is read after the transcripts, `git` and the process listing, which
// took 16 s here, and its ages were said against the time the board began. A holder read as silent, whose
// last beat was a minute before the read, was then shown with a last beat of 44 s.
test('renderBoard: the ages of the gates of the lock are said against the clock the lock was read with, and those of the listing against the board\'s', () => {
  const section = (parts) => {
    const lines = lib.renderBoard({ ...BOARD, ...parts }, { now: NOW });
    return lines.slice(lines.indexOf('Gates') + 1, lines.indexOf('Pull requests') - 1);
  };
  const readLater = (holder, ...waiters) => ({ gateLock: { ...lockOf(holder, ...waiters).gateLock, readAt: before(-16) } });
  const listed = (...items) => ({ gates: { available: true, items } });
  const idle = { pid: 4260, startedAt: before(50), worktree: 'D:/proj', knowsLock: true, commandLine: 'node "D:/proj/bin/check.mjs"' };
  // Silent since 44 s before the board began, which is a minute before the lock was read.
  const silent = holds(4242, 'D:\\proj-worktrees\\board', { beatAt: before(44), stale: true });
  assert.deepEqual(section({ ...listed(idle), ...readLater(silent, waits(4250, 'D:\\proj', 50)) }), [
    '  pid 4242  D:/proj-worktrees/board  silent: holds the gate lock, its last beat was 1m ago and the next gate takes it over  check (no process of the listing has this pid)',
    '  pid 4250  D:/proj  waiting for the gate of pid 4242, began 1m ago  check (no process of the listing has this pid)',
    '  pid 4260  D:/proj  not in its sensors (before or after them), started 50s ago  node "D:/proj/bin/check.mjs"',
  ]);
  // A holder that runs: when it took the lock, and its last beat where that is all its file gives.
  assert.deepEqual(section({ ...listed(), ...readLater(holds(4242, 'D:\\proj', { startedAt: before(110) })) }), [
    '  pid 4242  D:/proj  running, took the gate lock 2m ago  check (no process of the listing has this pid)',
  ]);
  assert.deepEqual(section({ ...listed(), ...readLater(holds(4242, 'D:\\proj', { startedAt: null, beatAt: before(44) })) }), [
    '  pid 4242  D:/proj  running, holds the gate lock since an unknown time, its last beat was 1m ago  check (no process of the listing has this pid)',
  ]);
  // A board that does not say when its lock was read says every age against its own time, as before.
  assert.deepEqual(section({ ...listed(), ...lockOf(silent) }), [
    '  pid 4242  D:/proj-worktrees/board  silent: holds the gate lock, its last beat was 44s ago and the next gate takes it over  check (no process of the listing has this pid)',
  ]);
});

test('boardGates: the process that holds the lock is one gate that runs, the one in line waits, and any other is as the listing has it', () => {
  const board = boardOf({ ...gates(aware(7, 'D:/a'), gate(8, 'D:/b'), aware(6, 'D:/b'), aware(5, 'D:/a')), ...lockOf(holds(5, 'D:\\A\\'), waits(6, 'd:/b')) });
  assert.deepEqual(lib.boardGates(board), [
    // The folder is the one the lock names, in the board's spelling of it.
    ofLock(aware(5), 'D:/a', asHolder()),
    ofLock(aware(6), 'D:/b', asWaiter(5)),
    // A process that knows the lock and that the lock says nothing of, and one that does not know it.
    aware(7, 'D:/a'),
    gate(8, 'D:/b'),
  ]);
  // No lock on the board, or one that could not be read: the gates of the listing, as before there was one.
  const listed = [aware(7, 'D:/a'), gate(6, 'D:/b')];
  assert.deepEqual(lib.boardGates(boardOf(gates(...listed))), listed);
  assert.deepEqual(lib.boardGates(boardOf({ ...gates(...listed), gateLock: { available: false, reason: 'the gate lock: boom' } })), listed);
  assert.deepEqual(lib.boardGates(boardOf({ ...gates(...listed), ...lockOf(null) })), listed);
  // Read as a waiter, then as the holder: it took the lock between the two reads, and it is one gate.
  assert.deepEqual(lib.boardGates(boardOf({ ...gates(aware(5, 'D:/a')), ...lockOf(holds(5, 'D:\\a'), waits(5, 'D:\\a')) })), [ofLock(aware(5), 'D:/a', asHolder())]);
});

// The two reviews of the first version, 2026-10-10: the board took the process with the pid of a gate of
// the lock for that gate, and worked out from it what each `check` process was doing. A pid is free again
// once its process ends, and a holder's file outlives a gate that was killed by a minute.
test('boardGates: the process with the pid of a gate of the lock is that gate only when it can be: it knows the lock, and it did not start after', () => {
  const notThisGate = { unavailable: 'the listed process with this pid is not this gate' };
  const rows = (...items) => lib.boardGates(boardOf({ ...gates(...items), ...lockOf(holds(5, 'D:\\a'), waits(6, 'D:\\b')) }));
  const fromTheLock = [
    { pid: 5, startedAt: notThisGate, worktree: 'D:/a', commandLine: notThisGate, lock: asHolder() },
    { pid: 6, startedAt: notThisGate, worktree: 'D:/b', commandLine: notThisGate, lock: asWaiter(5) },
  ];
  // A gate from before the lock that got the pid of a gate that died: never the gate of the lock.
  assert.deepEqual(rows(gate(5, 'D:/b'), gate(6, 'D:/a')), [...fromTheLock, gate(5, 'D:/b'), gate(6, 'D:/a')]);
  // A process that knows the lock and started after the holder took it, or after the waiter began to wait.
  assert.deepEqual(rows(aware(5, 'D:/b', 169), aware(6, 'D:/a', 59)), [...fromTheLock, aware(5, 'D:/b', 169), aware(6, 'D:/a', 59)]);
  assert.deepEqual(rows(aware(5, 'D:/b', 171), aware(6, 'D:/a', 61)), [ofLock(aware(5, null, 171), 'D:/a', asHolder()), ofLock(aware(6, null, 61), 'D:/b', asWaiter(5))]);
  // With no start time on either side (`ps` gives none; a file that could not be read says none) the pid
  // is all there is, and it only decides which command line the gate's row shows.
  const untimed = { ...aware(5, 'D:/b'), startedAt: { unavailable: 'the process listing gave no start time' } };
  assert.deepEqual(rows(untimed)[0], ofLock(untimed, 'D:/a', asHolder()));
  const unread = lib.boardGates(boardOf({ ...gates(aware(5, 'D:/b', 1)), ...lockOf(holds(5, null, { startedAt: null })) }));
  assert.deepEqual(unread, [ofLock(aware(5, null, 1), 'D:/b', asHolder({ since: null }))]);
});

// `npm run check` starts `node bin/check.mjs`: nothing on its command line says which script that is, so
// the library cannot be looked for beside it. The lock naming its pid is then the one proof there is.
test('boardGates: a gate whose script the command line does not place is the gate of the lock that has its pid, and a gate without the lock otherwise', () => {
  const board = boardOf({ ...gates(unplaced(5), unplaced(6), unplaced(9)), ...lockOf(holds(5, 'D:\\a'), waits(6, 'D:\\b')) });
  assert.deepEqual(lib.boardGates(board), [ofLock(unplaced(5), 'D:/a', asHolder()), ofLock(unplaced(6), 'D:/b', asWaiter(5)), unplaced(9)]);
  // Not when it started after that gate took the lock: it is another process with a pid used again.
  assert.deepEqual(lib.boardGates(boardOf({ ...gates(unplaced(5, 20)), ...lockOf(holds(5, 'D:\\a')) })).map((row) => typeof row.commandLine), ['object', 'string']);
});

test('boardGates: the lock gives the folder a gate checks when its command line names none', () => {
  const unnamed = { unavailable: 'js-harness check checks the folder it runs in, and its command line names none' };
  const installed = { pid: 5, startedAt: before(300), worktree: unnamed, knowsLock: true, commandLine: 'node C:/pnpm/global/node_modules/js-harness/bin/js-harness.mjs check' };
  const folderWith = (cwd) => lib.boardGates(boardOf({ ...gates(installed), ...lockOf(holds(5, cwd)) }))[0].worktree;
  assert.equal(folderWith('D:\\b'), 'D:/b');
  // The lock is the machine's: the gate of another project is named by its own folder.
  assert.equal(folderWith('C:\\other\\project'), 'C:\\other\\project');
  // A holder's file that names no folder leaves what the listing says.
  assert.deepEqual(folderWith(null), unnamed);
});

test('boardGates: a gate the lock tells of is given even when no listed process has its pid, or no process could be listed', () => {
  const noProcess = { unavailable: 'no process of the listing has this pid' };
  const board = boardOf({ ...gates(gate(7, 'D:/a')), ...lockOf(holds(5, 'D:\\b'), { pid: null, cwd: null, command: null, waitingSince: null }) });
  assert.deepEqual(lib.boardGates(board), [
    { pid: 5, startedAt: noProcess, worktree: 'D:/b', commandLine: noProcess, lock: asHolder() },
    { pid: null, startedAt: noProcess, worktree: { unavailable: 'the gate lock does not say which folder it checks' }, commandLine: noProcess, lock: { role: 'waiter', since: null, for: 5, command: null } },
    gate(7, 'D:/a'),
  ]);
  const unlisted = { unavailable: 'the process listing could not be read' };
  const blind = boardOf({ gates: { available: false, reason: 'the process listing: boom' }, ...lockOf(holds(5, 'D:\\b')) });
  assert.deepEqual(lib.boardGates(blind), [{ pid: 5, startedAt: unlisted, worktree: 'D:\\b', commandLine: unlisted, lock: asHolder() }]);
});

const runs = { ...gates(aware(5, 'D:/a')), ...lockOf(holds(5, 'D:\\a')) };
const runsAndWaits = { ...gates(aware(5, 'D:/a'), aware(6, 'D:/b')), ...lockOf(holds(5, 'D:\\a'), waits(6, 'D:\\b')) };

test('boardChanges: a gate that starts and waits for the lock wakes nobody: it is in line, not beside another', () => {
  assert.deepEqual(changes(runs, runsAndWaits), []);
  // The gate it waits for may be another project's: the lock is the machine's.
  assert.deepEqual(changes(gates(), { ...gates(aware(6, 'D:/b')), ...lockOf(holds(99, 'C:\\other'), waits(6, 'D:\\b')) }), []);
  // Read in the instant between a release and its take, the lock has no holder.
  assert.deepEqual(changes(gates(), { ...gates(aware(6, 'D:/b')), ...lockOf(null, waits(6, 'D:\\b')) }), []);
});

test('boardChanges: nothing is said when the gate that waited takes the lock, nor of the end of the gate before it', () => {
  const tookIt = lockOf(holds(6, 'D:\\b'));
  assert.deepEqual(changes(runsAndWaits, { ...gates(aware(6, 'D:/b')), ...tookIt }), []);
  // The gate before it is still there for a moment, writing its report with the lock released.
  assert.deepEqual(changes(runsAndWaits, { ...gates(aware(5, 'D:/a'), aware(6, 'D:/b')), ...tookIt }), []);
  // Neither the lock alone starts or ends a gate: a holder no listed process has the pid of is only shown.
  assert.deepEqual([changes(gates(), { ...gates(), ...lockOf(holds(5, 'D:\\a')) }), changes({ ...gates(), ...lockOf(holds(5, 'D:\\a')) }, gates())], [[], []]);
});

// The alarm is for a gate that does not know the lock, as every gate of a checkout from before it: beside
// another such gate, as it always was, or beside the gate that holds the lock.
test('boardChanges: a gate that does not know the lock is said to run beside another such gate, and beside the gate that holds the lock', () => {
  assert.deepEqual(changes(gates(gate(5, 'D:/a')), gates(gate(5, 'D:/a'), gate(8, 'D:/b'))), ['gate started in D:/b (pid 8) while another runs in D:/a (pid 5)']);
  // A checkout from before the lock starts its gate beside the one that holds it.
  assert.deepEqual(changes(runs, { ...gates(aware(5, 'D:/a'), gate(8, 'D:/b')), ...lockOf(holds(5, 'D:\\a')) }), ['gate started in D:/b (pid 8) while another runs in D:/a (pid 5)']);
  // And the other way round: a gate that knows the lock starts beside one that never asks for it, and
  // will not wait for it, whether it has taken the lock yet or not.
  for (const lock of [lockOf(holds(5, 'D:\\a')), lockOf(null)]) {
    assert.deepEqual(changes({ ...gates(gate(8, 'D:/b')), ...lockOf(null) }, { ...gates(gate(8, 'D:/b'), aware(5, 'D:/a')), ...lock }), ['gate started in D:/a (pid 5) while another runs in D:/b (pid 8)']);
  }
  // The gate that holds the lock runs, whatever it checks, and whether a process of the listing is it or
  // not: another project's shares the machine too.
  assert.deepEqual(changes(gates(), { ...gates(gate(8, 'D:/b')), ...lockOf(holds(99, 'C:\\other')) }), ['gate started in D:/b (pid 8) while another runs in C:\\other (pid 99)']);
  // So does a holder whose beat could not be read at this look: its file is there, with its pid.
  assert.deepEqual(changes(gates(), { ...gates(gate(8, 'D:/b')), ...lockOf(holds(99, null, { startedAt: null, beatAt: null })) }), ['gate started in D:/b (pid 8) while another runs in an unknown worktree (pid 99)']);
});

test('boardChanges: a gate that only waits, a holder that stopped beating and a lock of which nothing could be read are not another gate', () => {
  // A gate that starts with none of them beside it starts alone, which wakes nobody.
  const alone = [];
  assert.deepEqual(changes(gates(), { ...gates(gate(8, 'D:/b'), aware(6, 'D:/a')), ...lockOf(null, waits(6, 'D:\\a')) }), alone);
  assert.deepEqual(changes(gates(), { ...gates(gate(8, 'D:/b')), ...lockOf(holds(99, 'C:\\other', { stale: true })) }), alone);
  // Found in review, 2026-10-10: a lock folder that could not be listed, or a holder's file that is not
  // a gate's, named nobody and was still "another gate" a gate ran beside.
  const nobody = { pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false };
  assert.deepEqual(changes(gates(), { ...gates(gate(8, 'D:/b')), ...lockOf(nobody) }), alone);
  // Nor is a lock that could not be read at all, which leaves the gates of the listing.
  assert.deepEqual(changes(gates(), { ...gates(gate(8, 'D:/b')), gateLock: { available: false, reason: 'the gate lock: boom' } }), alone);
});

// The four findings of the two reviews, 2026-10-10, were one mistake: the board worked out from the
// process list and the lock what each `check` process was doing, and each guess had its moment of being
// wrong. A gate that knows the lock runs its sensors only while it holds it, so the lock alone says
// whether it runs, and the process list raises no alarm for it or against it.
test('boardChanges: a gate that knows the lock is never said to run beside the gate that holds it, whatever it is doing', () => {
  const holder = lockOf(holds(5, 'D:\\a'));
  // Listed before it has staged its folder in line: neither holder nor waiter yet.
  assert.deepEqual(changes(runs, { ...gates(aware(5, 'D:/a'), aware(6, 'D:/b', 1)), ...holder }), []);
  // Past its sensors, with the lock released, writing its report while the next gate takes the lock: at
  // the look after its release, and at any later one, when no look remembers that it held the lock.
  const released = gates(aware(5, 'D:/a'), aware(7, 'D:/b'));
  assert.deepEqual(changes(runs, { ...released, ...lockOf(holds(7, 'D:\\b')) }), []);
  assert.deepEqual(changes({ ...gates(aware(5, 'D:/a')), ...lockOf(null) }, { ...released, ...lockOf(holds(7, 'D:\\b')) }), []);
  // A new gate that got the pid of a gate that died holding the lock, whose file still reads alive.
  assert.deepEqual(changes(gates(), { ...gates(aware(5, 'D:/b', 3)), ...holder }), []);
  // Two gates that know the lock and that the lock says nothing of.
  assert.deepEqual(changes(gates(aware(5, 'D:/a')), { ...gates(aware(5, 'D:/a'), aware(6, 'D:/b')), ...lockOf(null) }), []);
  // Nor when the lock could not be read at this look: the process list alone says nothing of such a gate.
  assert.deepEqual(changes(gates(aware(5, 'D:/a')), { ...gates(aware(5, 'D:/a'), aware(6, 'D:/b')), gateLock: { available: false, reason: 'the gate lock: boom' } }), []);
});

test('boardChanges: a gate that does not know the lock and has the pid of a holder that died is not said to run beside itself', () => {
  assert.deepEqual(changes(gates(), { ...gates(gate(5, 'D:/b')), ...lockOf(holds(5, 'D:\\a')) }), []);
});

// Not built, and pinned so that it is a decision: a gate that knows the lock, waited for it, and then ran
// its sensors without it (the lock could not be read for a minute) is seen as a gate that waits no more.
// That happens when the lock folder can be neither read nor written, which is when the gate could leave
// no trace either, and its own report says so in a row.
test('boardChanges says nothing of a gate that knows the lock and leaves the line without taking it', () => {
  assert.deepEqual(changes(runsAndWaits, { ...gates(aware(5, 'D:/a'), aware(6, 'D:/b')), ...lockOf(holds(5, 'D:\\a')) }), []);
});

test('boardChanges: a gate started as npm run check is one that waits when the lock has its pid in line, and one without the lock otherwise', () => {
  assert.deepEqual(changes(runs, { ...gates(aware(5, 'D:/a'), unplaced(6)), ...lockOf(holds(5, 'D:\\a'), waits(6, 'D:\\b')) }), []);
  assert.deepEqual(changes(gates(), { ...gates(unplaced(5)), ...lockOf(holds(5, 'D:\\a')) }), []);
  assert.deepEqual(changes(runs, { ...gates(aware(5, 'D:/a'), unplaced(6)), ...lockOf(holds(5, 'D:\\a')) }), ['gate started in an unknown worktree (pid 6) while another runs in D:/a (pid 5)']);
});

test('boardChanges: the lock names the folder of a gate whose command line names none, so another project\'s gate wakes nobody', () => {
  const installed = { pid: 5, startedAt: before(300), worktree: { unavailable: 'its command line names none' }, knowsLock: true, commandLine: 'node C:/pnpm/js-harness/bin/js-harness.mjs check' };
  // It starts beside a gate that never asks for the lock, which is the alarm, unless it is another project's.
  const old = gate(8, 'D:/a');
  assert.deepEqual(changes(gates(old), gates(old, installed)), ['gate started in an unknown worktree (pid 5) while another runs in D:/a (pid 8)']);
  assert.deepEqual(changes(gates(old), { ...gates(old, installed), ...lockOf(holds(5, 'D:\\b')) }), ['gate started in D:/b (pid 5) while another runs in D:/a (pid 8)']);
  assert.deepEqual(changes(gates(old), { ...gates(old, installed), ...lockOf(holds(5, 'C:\\other\\project')) }), []);
  assert.deepEqual(changes({ ...gates(old, installed), ...lockOf(holds(5, 'C:\\other\\project')) }, gates(old)), []);
});

test('watchBaseline keeps what the lock said last across a look that could not read it', () => {
  const older = boardOf(runsAndWaits);
  const unread = { gateLock: { available: false, reason: 'the gate lock: boom' } };
  assert.deepEqual(lib.watchBaseline(older, boardOf({ ...gates(gate(5, 'D:/a'), gate(6, 'D:/b')), ...unread })).gateLock, older.gateLock);
  const newer = boardOf({ ...gates(gate(6, 'D:/b')), ...lockOf(holds(6, 'D:\\b')) });
  assert.deepEqual(lib.watchBaseline(older, newer).gateLock, newer.gateLock);
  // A lock that was never read stays unread, and a board with none gets none.
  assert.deepEqual(lib.watchBaseline(boardOf(gates()), boardOf({ ...gates(), ...unread })).gateLock, unread.gateLock);
  assert.equal('gateLock' in lib.watchBaseline(boardOf(gates()), boardOf(gates())), false);
});

// --- the relief file ---

test('reliefTail gives how many lines a relief file holds and its last ones, blank lines apart', () => {
  const text = ['2026-01-01 10:00 orchestrator started', '', '2026-01-01 10:05 asked: the board', '2026-01-01 10:06 sent to the board session', '   ', ''].join('\r\n');
  assert.deepEqual(lib.reliefTail(text, 2), { lineCount: 3, lines: ['2026-01-01 10:05 asked: the board', '2026-01-01 10:06 sent to the board session'] });
  assert.deepEqual(lib.reliefTail(text).lines.length, 3, 'the default is more than three lines');
  assert.deepEqual(lib.reliefTail(Array.from({ length: 9 }, (_, n) => `line ${n}`).join('\n')), { lineCount: 9, lines: ['line 4', 'line 5', 'line 6', 'line 7', 'line 8'] });
  assert.deepEqual(lib.reliefTail(''), { lineCount: 0, lines: [] });
});

test('boardChanges does not compare the relief file: its writer is the session that watches', () => {
  const relief = (lines) => ({ relief: { path: 'C:/home/.js-harness/relief/proj.md', exists: true, lineCount: lines.length, lines } });
  assert.deepEqual(changes(relief(['one']), relief(['one', 'two'])), []);
  assert.deepEqual(changes({ relief: { path: 'x', exists: false } }, relief(['one'])), []);
});

const BOARD = {
  root: 'D:\\proj',
  hours: 12,
  sessions: [
    {
      id: 'aaaaaaaa-1111-4111-8111-111111111111',
      title: 'Board feature',
      state: 'background',
      lastEntryAt: before(120),
      cwd: 'D:\\proj',
      gitBranch: 'main',
      context: { tokens: 275400, model: 'model-x', at: before(120) },
      atContextPause: false,
      skippedLines: 1,
      work: [
        { tool: 'Agent', kind: 'Explore', id: 'a1f', description: 'Research the format', launchedAt: before(20 * 60), ended: false, file: { path: 'x', modifiedAt: before(30) } },
        { tool: 'Bash', kind: null, id: null, description: 'Run the gate', launchedAt: before(125 * 60), ended: false, file: { unavailable: 'the transcript does not record its task id yet' } },
        { tool: 'Bash', kind: null, id: 'b1', description: 'Old run', launchedAt: before(3 * 3600), ended: true, endedAt: before(3600), status: 'completed' },
        { tool: 'Bash', kind: null, id: 'b2', description: 'Tests', launchedAt: before(2 * 3600), ended: true, endedAt: before(30 * 60), status: 'failed' },
      ],
      tail: ['What comes next', '```', `send ${'x'.repeat(200)}`],
    },
    { id: 'bbbbbbbb-2222-4222-8222-222222222222', title: null, state: 'working', lastEntryAt: before(3 * 86400), cwd: null, gitBranch: null, context: { unavailable: 'no reply of the transcript records its token usage' }, atContextPause: null, skippedLines: 0, work: [], tail: [] },
    { id: 'cccccccc-3333-4333-8333-333333333333', unavailable: 'EACCES' },
  ],
  worktrees: {
    available: true,
    items: [
      { path: 'D:/proj', head: '1111111111111111111111111111111111111111', branch: 'main', bare: false, aheadOfMain: 0, aheadOfUpstream: 2, changed: 0 },
      { path: 'D:/proj-worktrees/board', head: '2222222222222222222222222222222222222222', branch: null, bare: false, aheadOfMain: { unavailable: 'git rev-list: boom' }, aheadOfUpstream: 'no upstream', changed: { unavailable: 'git status: spawnSync git ETIMEDOUT' } },
    ],
  },
  gates: {
    available: true,
    items: [
      { pid: 4242, startedAt: before(180), worktree: 'D:/proj-worktrees/board', knowsLock: false, commandLine: 'node "D:/proj-worktrees/board/bin/check.mjs"' },
      { pid: 77, startedAt: { unavailable: 'the process listing gave no start time' }, worktree: { unavailable: 'its command line names bin/check.mjs by a relative path' }, knowsLock: RELATIVE_SCRIPT, commandLine: 'node bin/check.mjs' },
    ],
  },
  pullRequests: { available: false, reason: 'gh pr: gh is not installed or not on PATH' },
};

/** A board's lines from its first session row: past the header and the context column, which has a test of its own. */
function rowsOf(lines) {
  const start = lines[2]?.startsWith('Context  ') ? lines.indexOf('', 2) + 1 : 2;
  return lines.slice(start);
}

// The share and the room of every session in one column at the top: the app no longer shows a session's context, and
// the rows say it one session at a time, far apart.
test('renderBoard opens with the context of every session in one column, the fullest first, with its room and the pause', () => {
  const at = (tokens, room, more = {}) => ({ context: { tokens, model: 'model-x', at: before(60) }, contextRoom: room, contextCompaction: { tokens: tokens + room, measured: true }, ...more });
  const sessions = [
    seen(A, 'waiting', { title: 'JH 1 · low', ...at(100000, 367000) }),
    seen(B, 'working', { title: 'JH 2 · full', ...at(450000, -5000), atContextPause: true }),
    seen(C, 'working', { title: 'JH 3 · paused', ...at(440000, 27000), atContextPause: true, self: true }),
  ];
  const lines = lib.renderBoard(boardOf({ root: 'D:\\proj', sessions }), { now: NOW });
  const top = lines.slice(lines.indexOf('') + 1, lines.indexOf('', lines.indexOf('') + 1));
  assert.deepEqual(top, [
    'Context  the share each session holds of its window and the room left before the host compacts it, the fullest first',
    `  ${String(lib.percentOf(450000, WINDOW)).padStart(3)}%  no room       ${B.slice(0, 8)}  JH 2 · full  past the pause`,
    `  ${String(lib.percentOf(440000, WINDOW)).padStart(3)}%  room 27k      ${C.slice(0, 8)}  JH 3 · paused  past the pause  (this session)`,
    `  ${String(lib.percentOf(100000, WINDOW)).padStart(3)}%  room 367k     ${A.slice(0, 8)}  JH 1 · low`,
  ]);
});

test('renderBoard prints the sessions, then worktrees, gates and pull requests, and what the board cannot see', () => {
  assert.deepEqual(lib.renderBoard(BOARD, { now: NOW }), [
    'Sessions  D:\\proj  3 changed in the last 12h',
    '',
    'Context  the share each session holds of its window and the room left before the host compacts it, the fullest first',
    '   55%  room not known  aaaaaaaa  Board feature',
    '  2 sessions whose context was not read: their rows say why',
    '',
    'aaaaaaaa  background  Board feature  last entry 2m ago',
    '  cwd D:\\proj  branch main',
    '  context 275k tokens (55%)',
    '  work: 2 with no recorded end, 2 ended (last: Bash "Tests" failed 30m ago)',
    '    Agent a1f (Explore) "Research the format"  launched 20m ago  file written 30s ago',
    '    Bash (no id yet) "Run the gate"  launched 2h 05m ago  file unavailable: the transcript does not record its task id yet',
    '  1 transcript line skipped: it did not parse',
    '  | What comes next',
    '  | ```',
    `  | send ${'x'.repeat(154)}…`,
    '',
    'bbbbbbbb  working  (no title)  last entry 3d ago',
    '  cwd unavailable: no entry records it  branch unavailable: no entry records it',
    '  context unavailable: no reply of the transcript records its token usage',
    '',
    'cccccccc  unavailable: EACCES',
    '',
    'Worktrees',
    '  D:/proj  main  1111111  0 not on origin/main, 2 not pushed, 0 changed',
    '  D:/proj-worktrees/board  (detached)  2222222  not on origin/main unavailable: git rev-list: boom, no upstream, changed unavailable: git status: spawnSync git ETIMEDOUT',
    '',
    'Gates',
    '  pid 4242  D:/proj-worktrees/board  started 3m ago  node "D:/proj-worktrees/board/bin/check.mjs"',
    '  pid 77  worktree unavailable: its command line names bin/check.mjs by a relative path  start unavailable: the process listing gave no start time  node bin/check.mjs',
    '',
    'Pull requests',
    '  unavailable: gh pr: gh is not installed or not on PATH',
    '',
    lib.NOT_VISIBLE,
  ]);
});

test('renderBoard says so when there is nothing: no session, no gate, no pull request, an unreadable list of worktrees', () => {
  const empty = { root: '/home/me/proj', hours: 1, sessions: [], worktrees: { available: false, reason: 'git worktree: fatal: not a git repository' }, gates: { available: true, items: [] }, pullRequests: { available: true, items: [{ number: 41, title: 'feat: session board', branch: 'feat/session-board' }] } };
  assert.deepEqual(lib.renderBoard(empty, { now: NOW }), [
    'Sessions  /home/me/proj  0 changed in the last 1h',
    '',
    'Worktrees',
    '  unavailable: git worktree: fatal: not a git repository',
    '',
    'Gates',
    '  none running',
    '',
    'Pull requests',
    '  #41  feat: session board  (feat/session-board)',
    '',
    lib.NOT_VISIBLE,
  ]);
});

test('renderBoard: Memory hygiene says whether a pass is due for the project and why, after the pull requests', () => {
  const base = { root: '/home/me/proj', hours: 1, sessions: [], worktrees: { available: true, items: [] }, gates: { available: true, items: [] }, pullRequests: { available: true, items: [] } };
  const section = (memory) => {
    const lines = lib.renderBoard({ ...base, memory }, { now: NOW });
    return lines.slice(lines.indexOf('Pull requests') + 3, lines.indexOf(lib.NOT_VISIBLE));
  };
  assert.deepEqual(section({ available: true, folder: '/m', due: true, reasons: ['no-pass', 'index-bytes'] }), [
    'Memory hygiene',
    '  a pass is due (no-pass, index-bytes): js-harness memory status says why; the orchestrator runs it at a task boundary',
    '',
  ]);
  assert.deepEqual(section({ available: true, folder: '/m', due: false, reasons: [] }), ['Memory hygiene', '  nothing due', '']);
  assert.deepEqual(section({ available: true, folder: '/m', na: true }), ['Memory hygiene', '  n/a: no memory folder at /m', '']);
  assert.deepEqual(section({ available: false, reason: 'EACCES: permission denied' }), ['Memory hygiene', '  unavailable: EACCES: permission denied', '']);
  assert.deepEqual(section(undefined), [], 'a board read without it has no such section');
});

test('renderBoard: Gates says which gate runs and which wait, from the lock, and any other gate as the listing has it', () => {
  const section = (parts) => {
    const lines = lib.renderBoard({ ...BOARD, ...parts }, { now: NOW });
    return lines.slice(lines.indexOf('Gates') + 1, lines.indexOf('Pull requests') - 1);
  };
  const listed = (...items) => ({ gates: { available: true, items } });
  const [old, relative] = BOARD.gates.items;
  // The same two processes from checkouts that have the lock, and a third started a minute ago.
  const first = { ...old, knowsLock: true };
  const second = { pid: 4250, startedAt: before(61), worktree: 'D:/proj', knowsLock: true, commandLine: 'node "D:/proj/bin/check.mjs"' };
  const holder = holds(4242, 'D:\\proj-worktrees\\board');
  const RUNS = '  pid 4242  D:/proj-worktrees/board  running, took the gate lock 2m ago  node "D:/proj-worktrees/board/bin/check.mjs"';
  const UNLOCKED = '  pid 77  worktree unavailable: its command line names bin/check.mjs by a relative path  start unavailable: the process listing gave no start time  node bin/check.mjs';

  // One gate, and it runs.
  assert.deepEqual(section({ ...listed(first), ...lockOf(holder) }), [RUNS]);
  // One runs and one waits: two `check` processes, one gate at work, the one that runs first.
  assert.deepEqual(section({ ...listed(second, first), ...lockOf(holder, waits(4250, 'D:\\proj')) }), [RUNS, '  pid 4250  D:/proj  waiting for the gate of pid 4242, began 1m ago  node "D:/proj/bin/check.mjs"']);
  // A gate that does not know the lock beside the one that holds it: its line is the listing's, as before.
  assert.deepEqual(section({ ...listed(relative, first), ...lockOf(holder) }), [RUNS, UNLOCKED]);
  assert.deepEqual(section({ ...listed({ ...second, knowsLock: false }, first), ...lockOf(holder) }), [RUNS, '  pid 4250  D:/proj  started 1m ago  node "D:/proj/bin/check.mjs"']);
  // A `check` process that knows the lock and neither holds it nor waits for it is not a gate that runs:
  // it has not reached its sensors, or it is past them and writes its report.
  const IDLE = '  pid 4250  D:/proj  not in its sensors (before or after them), started 1m ago  node "D:/proj/bin/check.mjs"';
  assert.deepEqual(section({ ...listed(second, first), ...lockOf(holder) }), [RUNS, IDLE]);
  assert.deepEqual(section({ ...listed(second), ...lockOf(null) }), [IDLE]);
  assert.deepEqual(section({ ...listed({ ...second, startedAt: relative.startedAt }), ...lockOf(null) }), ['  pid 4250  D:/proj  not in its sensors (before or after them), start unavailable: the process listing gave no start time  node "D:/proj/bin/check.mjs"']);
  // With no lock to read, nothing says where such a process is: its line is the listing's.
  assert.deepEqual(section(listed(second)), ['  pid 4250  D:/proj  started 1m ago  node "D:/proj/bin/check.mjs"']);
  // A holder that stopped beating is not a gate that runs, and here its process is gone as well.
  assert.deepEqual(section({ ...listed(), ...lockOf(holds(4242, 'D:\\proj-worktrees\\board', { beatAt: before(300), stale: true })) }), [
    '  pid 4242  D:/proj-worktrees/board  silent: holds the gate lock, its last beat was 5m ago and the next gate takes it over  check (no process of the listing has this pid)',
  ]);
  // A process that got the pid of a gate that died holding the lock is listed on its own line, and the
  // dead gate's line does not borrow its command line.
  assert.deepEqual(section({ ...listed({ ...second, pid: 4242, knowsLock: false }), ...lockOf(holder) }), [
    '  pid 4242  D:/proj-worktrees/board  running, took the gate lock 2m ago  check (the listed process with this pid is not this gate)',
    '  pid 4242  D:/proj  started 1m ago  node "D:/proj/bin/check.mjs"',
  ]);
  // `js-harness gate -- <command>` holds the lock or waits for it like a gate, and is shown from the lock
  // with what it runs: it is no `check` process, so the listing has none for it.
  const batch = { ...holds(4300, 'D:\\proj'), command: 'gate -- node evals/runner.mjs --all' };
  const suite = { ...waits(4301, 'D:\\proj-worktrees\\board'), command: 'gate -- node --test' };
  assert.deepEqual(section({ ...listed(), ...lockOf(batch, suite) }), [
    '  pid 4300  D:/proj  running, took the gate lock 2m ago  gate -- node evals/runner.mjs --all (no process of the listing has this pid)',
    '  pid 4301  D:/proj-worktrees/board  waiting for the gate of pid 4300, began 1m ago  gate -- node --test (no process of the listing has this pid)',
  ]);
  // Found in review, 2026-10-10: a holder whose file gives a beat and no start time.
  assert.deepEqual(section({ ...listed(first), ...lockOf(holds(4242, 'D:\\proj-worktrees\\board', { startedAt: null })) }), [
    '  pid 4242  D:/proj-worktrees/board  running, holds the gate lock since an unknown time, its last beat was 2s ago  node "D:/proj-worktrees/board/bin/check.mjs"',
  ]);
  // A lock that is held and of which nothing could be read, and a gate in line while nobody holds it.
  const nobody = { pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false };
  assert.deepEqual(section({ ...listed(), ...lockOf(nobody) }), [
    '  pid unknown  worktree unavailable: the gate lock does not say which folder it checks  holds the gate lock, and nothing more of it could be read  command unknown (no process of the listing has this pid)',
  ]);
  assert.deepEqual(section({ ...listed(second), ...lockOf(null, waits(4250, 'D:\\proj')) }), ["  pid 4250  D:/proj  waiting for the machine's gate lock, began 1m ago  node \"D:/proj/bin/check.mjs\""]);

  // A source that could not be read is said under what the other one told.
  const noListing = { gates: { available: false, reason: 'the process listing: boom' } };
  assert.deepEqual(section({ ...noListing, ...lockOf(holder) }), [
    '  pid 4242  D:/proj-worktrees/board  running, took the gate lock 2m ago  check (the process listing could not be read)',
    '  unavailable: the process listing: boom',
  ]);
  const noLock = { gateLock: { available: false, reason: 'the gate lock: EACCES: permission denied' } };
  assert.deepEqual(section({ ...listed(relative), ...noLock }), [UNLOCKED, '  unavailable: the gate lock: EACCES: permission denied']);
  assert.deepEqual(section({ ...listed(), ...noLock }), ['  none running', '  unavailable: the gate lock: EACCES: permission denied']);
  assert.deepEqual(section({ ...noListing, ...noLock }), ['  unavailable: the process listing: boom', '  unavailable: the gate lock: EACCES: permission denied']);
  // And a lock nobody holds changes nothing of the section.
  assert.deepEqual(section({ ...listed(), ...lockOf(null) }), ['  none running']);
});

test('renderBoard prints the relief file after the pull requests: its path and last lines, that there is none yet, or why it cannot be read', () => {
  const nothing = { root: '/home/me/proj', hours: 1, sessions: [], worktrees: { available: true, items: [] }, gates: { available: true, items: [] }, pullRequests: { available: true, items: [] } };
  const section = (relief) => {
    const lines = lib.renderBoard({ ...nothing, relief }, { now: NOW });
    assert.deepEqual([lines.at(-1), lines.at(-2)], [lib.NOT_VISIBLE, '']);
    assert.equal(lines[lines.indexOf('Relief') - 2], '  none open', 'after the pull requests');
    return lines.slice(lines.indexOf('Relief'), -2);
  };
  const file = '/home/me/.js-harness/relief/-home-me-proj.md';
  assert.deepEqual(section({ path: file, exists: true, lineCount: 7, lines: ['2026-01-01 10:05 asked: the board', `2026-01-01 10:06 ${'x'.repeat(200)}`] }), [
    'Relief',
    `  ${file}  7 lines, the last 2:`,
    '  | 2026-01-01 10:05 asked: the board',
    `  | 2026-01-01 10:06 ${'x'.repeat(142)}…`,
  ]);
  assert.deepEqual(section({ path: file, exists: true, lineCount: 1, lines: ['2026-01-01 10:00 orchestrator started'] }), ['Relief', `  ${file}  1 line:`, '  | 2026-01-01 10:00 orchestrator started']);
  assert.deepEqual(section({ path: file, exists: true, lineCount: 0, lines: [] }), ['Relief', `  ${file}  empty`]);
  assert.deepEqual(section({ path: file, exists: false }), ['Relief', `  no relief file yet: the first line an orchestrator appends creates ${file}`]);
  assert.deepEqual(section({ path: file, unavailable: 'EISDIR' }), ['Relief', `  ${file}  unavailable: EISDIR`]);
  assert.equal(lib.renderBoard(nothing, { now: NOW }).includes('Relief'), false, 'a board that was not given one prints no section');
});

// R3-untested-branches: an end with no time compared as the string "null", which sorts after every date.
test('renderBoard names the latest timed end as the last one, and an untimed end only when none has a time', () => {
  const ended = (description, endedAt) => ({ tool: 'Bash', kind: null, id: description, description, launchedAt: before(3600), ended: true, endedAt, status: 'completed' });
  const session = (work) => ({ id: 'eeeeeeee-5555', title: 't', state: 'waiting', lastEntryAt: before(60), cwd: 'C:\\p', gitBranch: 'main', skippedLines: 0, work, tail: [] });
  const workLine = (work) => lib.renderBoard({ ...BOARD, sessions: [session(work)] }, { now: NOW })[5];
  assert.equal(workLine([ended('early', before(1800)), ended('late', before(600)), ended('untimed', null)]), '  work: 0 with no recorded end, 3 ended (last: Bash "late" completed 10m ago)');
  assert.equal(workLine([ended('untimed', null), ended('early', before(1800))]), '  work: 0 with no recorded end, 2 ended (last: Bash "early" completed 30m ago)');
  assert.equal(workLine([ended('first', null), ended('second', null)]), '  work: 0 with no recorded end, 2 ended (last: Bash "second" completed at an unknown time)');
});

// Session channel, T5: a row says what a session holds, the room left before the host compacts it and what
// its last task cost, so whoever reads it sees whether a task of that size still fits. The session that
// asked for the board has its row like any other.
test('renderBoard says the context held, the room left and the last task\'s cost, and when a session is at the pause', () => {
  const task = (tokens) => ({ tokens, startedBy: 'person', startedAt: before(900), endedAt: before(60), compactions: 0 });
  const point = (tokens, measured = false) => ({ tokens, measured, at: measured ? before(7200) : null });
  const session = (id, tokens, more = {}) => ({ id, title: 't', state: 'waiting', lastEntryAt: before(60), cwd: 'C:\\p', gitBranch: 'main', context: { tokens, model: 'model-x', at: before(60) }, atContextPause: tokens >= PAUSE, contextCompaction: point(COMPACTION), contextRoom: COMPACTION - tokens, lastTask: task(62000), lastTaskFits: COMPACTION - tokens >= 62000, skippedLines: 0, work: [], tail: [], ...more });
  // Four places a context can be in: a little past the pause, almost empty, below the pause with a point
  // of its own, and past where the host compacts.
  const [past, empty, below, over] = [PAUSE + 5499, 999, PAUSE - 15000, COMPACTION + 5200];
  const sessions = [
    session('11111111-a', past),
    session('22222222-b', empty, { self: true, lastTask: { unavailable: 'its first task has not ended' }, lastTaskFits: null }),
    session('33333333-c', below, { contextCompaction: point(466933, true), contextRoom: 466933 - below }),
    session('44444444-d', over, { lastTask: task(3400), lastTaskFits: false }),
  ];
  const lines = lib.renderBoard({ ...BOARD, sessions }, { now: NOW });
  assert.deepEqual(rowsOf(lines).slice(0, 15), [
    '11111111  waiting  t  last entry 1m ago',
    '  cwd C:\\p  branch main',
    `  context ${share(past)}  room ${k(COMPACTION - past)} before the host compacts (${k(COMPACTION)})  last task 62k, which no longer fits  at the pause: ${PAUSE_SAID}`,
    '',
    '22222222  waiting  t  last entry 1m ago  (this session)',
    '  cwd C:\\p  branch main',
    `  context 1k tokens (0%)  room ${k(COMPACTION - empty)} before the host compacts (${k(COMPACTION)})  last task not known: its first task has not ended`,
    '',
    '33333333  waiting  t  last entry 1m ago',
    '  cwd C:\\p  branch main',
    `  context ${share(below)}  room ${k(466933 - below)} before the host compacts (467k, measured in this session)  last task 62k, which no longer fits`,
    '',
    '44444444  waiting  t  last entry 1m ago',
    '  cwd C:\\p  branch main',
    `  context ${share(over)}  no room: 5k past where the host compacts (${k(COMPACTION)})  last task 3k, which no longer fits  at the pause: ${PAUSE_SAID}`,
  ]);
  // The pause given in tokens is said as its share of the window too, and the window can be another.
  const wide = lib.renderBoard({ ...BOARD, contextPause: 300000, contextWindow: 1000000, sessions: [{ ...sessions[0], atContextPause: true }] }, { now: NOW });
  assert.equal(rowsOf(wide)[2], `  context ${k(past)} tokens (${lib.percentOf(past, 1000000)}%)  room ${k(COMPACTION - past)} before the host compacts (${k(COMPACTION)})  last task 62k, which no longer fits  at the pause: 30% of the window (300k)`);
  // A board from before these facts were kept (a watch's first look after an update) says what it has.
  const older = lib.renderBoard({ ...BOARD, sessions: [{ id: '55555555-e', title: 't', state: 'waiting', lastEntryAt: before(60), cwd: 'C:\\p', gitBranch: 'main', context: { tokens: 100000, model: 'model-x', at: before(60) }, skippedLines: 0, work: [], tail: [] }] }, { now: NOW });
  assert.equal(rowsOf(older)[2], '  context 100k tokens (20%)');
});

// The room is said in thousands, and rounding must not make the row say what is not so: `room 0k` of a
// session that has some, `0k past` of one that is past the point, or `0k past` of one exactly at it.
test('renderBoard says a room at, just short of and just past where the host compacts without a 0k that is not zero', () => {
  const session = (room) => ({ id: '66666666-f', title: 't', state: 'waiting', lastEntryAt: before(60), cwd: 'C:\\p', gitBranch: 'main', context: { tokens: COMPACTION - room, model: 'model-x', at: before(60) }, atContextPause: false, contextCompaction: { tokens: COMPACTION, measured: false, at: null }, contextRoom: room, lastTask: { unavailable: 'its first task has not ended' }, lastTaskFits: null, skippedLines: 0, work: [], tail: [] });
  // The piece of the row between what the session holds and its last task.
  const boardWith = (room) => lib.renderBoard({ ...BOARD, sessions: [session(room)] }, { now: NOW });
  const said = (room) => rowsOf(boardWith(room))[2].split('  ')[2];
  const where = `the host compacts (${k(COMPACTION)})`;
  assert.deepEqual([1000, 500, 499, 1, 0, -1, -499, -500, -1000].map(said), [
    `room 1k before ${where}`,
    `room 1k before ${where}`,
    `room under 1k before ${where}`,
    `room under 1k before ${where}`,
    `no room: at the point where ${where}`,
    `no room: under 1k past where ${where}`,
    `no room: under 1k past where ${where}`,
    `no room: 1k past where ${where}`,
    `no room: 1k past where ${where}`,
  ]);
});

// odd/tasks/stalled-sessions.md S3: the work sessions that hold handed work and went quiet, in a section of their own.
const STALL_LIMIT = 60;
const stalledItem = (number, quietSeconds, more = {}) => ({
  number,
  title: `JH ${number} · work`,
  ids: [`${number}0000000-0000-0000-0000-000000000000`],
  quietSince: before(quietSeconds),
  quietMs: quietSeconds * 1000,
  holding: { what: 'notice', at: before(quietSeconds + 600), from: 'JH ORQ · lead', kind: 'note', text: 'T3 is yours' },
  worktree: null,
  branch: null,
  ...more,
});

test('renderBoard lists the stalled work sessions with how long they have been quiet and what they hold', () => {
  const section = (stalled) => {
    const lines = lib.renderBoard({ ...BOARD, stalled }, { now: NOW });
    const start = lines.findIndex((line) => line.startsWith('Stalled  '));
    return start === -1 ? null : lines.slice(start, lines.indexOf('', start) + 1);
  };
  const heading = 'Stalled  work sessions that hold handed work and made no commit, notice or gate for 60m or more (rule session-stall)';
  const opening = stalledItem(23, 5400, { title: null, holding: { what: 'opening', at: before(5400), from: 'JH ORQ · lead', kind: null, text: 'Read odd/tasks/x.md' } });
  assert.deepEqual(section({ limitMinutes: STALL_LIMIT, items: [stalledItem(19, 4 * 3600), opening], unavailable: [] }), [
    heading,
    '  JH 19 · work  quiet 4h 00m  holding a note from JH ORQ · lead of 4h 10m ago: T3 is yours',
    '  work session 23  quiet 1h 30m  holding its opening of 1h 30m ago: Read odd/tasks/x.md',
    '',
  ]);
  // Nobody stalled is said, and a record it could not read is named: "could not look" is not "nobody".
  assert.deepEqual(section({ limitMinutes: STALL_LIMIT, items: [], unavailable: [] }), [heading, '  none', '']);
  assert.deepEqual(section({ limitMinutes: STALL_LIMIT, items: [], unavailable: ["the channel's record (x): EISDIR"] }), [heading, '  none', "  not read: the channel's record (x): EISDIR", '']);
  // A board from before the key (one a watch keeps) prints no section; the section comes before the roster and the worktrees.
  assert.equal(section(undefined), null);
  const lines = lib.renderBoard({ ...BOARD, stalled: { limitMinutes: STALL_LIMIT, items: [], unavailable: [] } }, { now: NOW });
  assert.ok(lines.indexOf(heading) < lines.indexOf('Worktrees'));
});

test('boardChanges says a stalled session once when it crosses the limit, and again each time its quiet doubles', () => {
  // One stall, read at several looks: its quiet grows while where it started and what it holds stay.
  const held = { quietSince: before(99999), holding: { what: 'notice', at: before(99999), from: 'JH ORQ · lead', kind: 'note', text: 'T3 is yours' } };
  const look = (quietSeconds, more) => ({ stalled: { limitMinutes: STALL_LIMIT, items: quietSeconds === null ? [] : [stalledItem(19, quietSeconds, { ...held, ...more })], unavailable: [] } });
  const said = (age) => `JH 19 · work has made no commit, notice or gate for ${age} while it holds a note from JH ORQ · lead: T3 is yours`;
  assert.deepEqual(changes(look(null), look(3600)), [said('1h 00m')], 'said when it first appears stalled');
  assert.deepEqual(changes(look(3600), look(3700)), [], 'not again at the next look');
  assert.deepEqual(changes(look(7000), look(7300)), [said('2h 01m')], 'again when the quiet doubles');
  assert.deepEqual(changes(look(5 * 3600), look(6 * 3600)), [], 'not between two doublings');
  // A new quiet (it did something, then went quiet again) is a new stall, said from its first crossing.
  assert.deepEqual(changes(look(3 * 3600, { quietSince: before(4 * 3600) }), look(3600)), [said('1h 00m')]);
  // A board with no key on either side, or one that leaves the list, says nothing of it.
  assert.deepEqual(changes({}, look(3600)), [said('1h 00m')]);
  assert.deepEqual(changes(look(3600), look(null)), []);
  assert.deepEqual(changes(look(3600), {}), []);
});

// T5 B: a worktree's feature plans are printed under it.
test('renderBoard prints under a worktree the plans of its branch: steps, what is pending and the start of the next step', () => {
  const tree = (path, plans) => ({ path, head: '1111111111111111111111111111111111111111', branch: 'feat/x', bare: false, aheadOfMain: 1, aheadOfUpstream: 'no upstream', changed: 0, plans });
  const plan = { path: 'odd/tasks/session-board.md', title: 'Session board', done: 9, total: 12, pending: ['T5', 'T6', 'T7'], nextStep: ['T5 with the delegated writer.', `Then ${'y'.repeat(200)}`, 'Before any push: his word.', 'A fourth line.', 'A fifth.'] };
  const worktrees = {
    available: true,
    items: [
      tree('D:/a', { available: true, items: [plan, { path: 'odd/tasks/draft.md', unavailable: 'EBUSY' }, { path: 'odd/tasks/done.md', title: 'Done', done: 2, total: 2, pending: [], nextStep: [] }] }),
      tree('D:/b', { available: true, items: [] }),
      tree('D:/c', { available: false, reason: "git diff: fatal: ambiguous argument 'origin/main': unknown revision" }),
    ],
  };
  const lines = lib.renderBoard({ ...BOARD, sessions: [], worktrees }, { now: NOW });
  assert.deepEqual(lines.slice(2, 14), [
    'Worktrees',
    '  D:/a  feat/x  1111111  1 not on origin/main, no upstream, 0 changed',
    '    plan odd/tasks/session-board.md  Session board  9/12  pending T5, T6, T7',
    '      > T5 with the delegated writer.',
    `      > Then ${'y'.repeat(154)}…`,
    '      > Before any push: his word.',
    '      > (2 more lines)',
    '    plan odd/tasks/draft.md  unavailable: EBUSY',
    '    plan odd/tasks/done.md  Done  2/2  nothing pending',
    '  D:/b  feat/x  1111111  1 not on origin/main, no upstream, 0 changed',
    '  D:/c  feat/x  1111111  1 not on origin/main, no upstream, 0 changed',
    "    plans unavailable: git diff: fatal: ambiguous argument 'origin/main': unknown revision",
  ]);
});

// T3c: a follow-up reopens a subagent, and its line says it is that subagent resumed.
test('renderBoard marks the work of a resumed subagent', () => {
  const resumed = (id, kind) => ({ tool: 'Agent', kind, id, description: 'Fix the findings', launchedAt: before(120), mode: 'background', resumed: true, ended: false, file: { path: 'x', modifiedAt: before(3) } });
  const session = { id: 'ffffffff-6666', title: 't', state: 'background', lastEntryAt: before(60), cwd: 'C:\\p', gitBranch: 'main', skippedLines: 0, work: [resumed('a1', 'general-purpose'), resumed('a2', null)], tail: [] };
  const lines = lib.renderBoard({ ...BOARD, sessions: [session] }, { now: NOW });
  assert.deepEqual(lines.slice(5, 8), [
    '  work: 2 with no recorded end, 0 ended',
    '    Agent a1 (general-purpose, resumed) "Fix the findings"  launched 2m ago  file written 3s ago',
    '    Agent a2 (resumed) "Fix the findings"  launched 2m ago  file written 3s ago',
  ]);
});

test('renderBoard gives the reason of an unknown state and of a time it cannot read', () => {
  const session = { id: 'dddddddd-4444', title: 't', state: 'unknown', stateReason: 'the transcript holds no prompt, reply or tool entry', lastEntryAt: null, cwd: 'C:\\p', gitBranch: 'main', skippedLines: 0, work: [], tail: [] };
  const lines = lib.renderBoard({ ...BOARD, sessions: [session] }, { now: NOW });
  assert.equal(lines[2], 'dddddddd  unknown (the transcript holds no prompt, reply or tool entry)  t  last entry at an unknown time');
});

// --- the roster: who is who, from the titles ---
//
// A session's title is the address of its role: `<project code> <role> · <what it does>`, the role being
// `ORQ` for the orchestrator or the number of a work session. The titles below are made up.

test('roleOfTitle reads the project code, the role and what the session is for from a title of the agreed shape', () => {
  assert.deepEqual(lib.roleOfTitle('JH ORQ · js-harness'), { code: 'JH', role: 'orchestrator', number: null, purpose: 'js-harness' });
  assert.deepEqual(lib.roleOfTitle('JH 5 · canal entre sesiones'), { code: 'JH', role: 'work', number: 5, purpose: 'canal entre sesiones' });
  assert.deepEqual(lib.roleOfTitle('AB 0 · a · b'), { code: 'AB', role: 'work', number: 0, purpose: 'a · b' });
  // A handover renames the two orchestrators on purpose, so that neither holds the role by its title.
  const others = ['JH ORQ nueva · js-harness', 'JH ORQ relevada · js-harness', 'Board feature', 'JH orq · x', 'JH ORQ - x', 'JH ORQ ·x', 'JH ORQ· x', 'JH 5 · ', 'JH 5.5 · x', 'JH -5 · x', 'ORQ · x', ' JH ORQ · x', '', null, undefined, 7];
  for (const title of others) assert.equal(lib.roleOfTitle(title), null, JSON.stringify(title));
});

test('roleNamed reads the role an --address asks for: the orchestrator by either of its names, a work session by its number', () => {
  for (const text of ['orchestrator', 'ORQ', 'orq', 'Orchestrator']) assert.deepEqual(lib.roleNamed(text), { role: 'orchestrator', number: null }, text);
  assert.deepEqual([lib.roleNamed('5'), lib.roleNamed('05'), lib.roleNamed('0')], [{ role: 'work', number: 5 }, { role: 'work', number: 5 }, { role: 'work', number: 0 }]);
  for (const text of ['', ' ', 'boss', '5.5', '-5', '0x5', '1e1', 'JH 5', 'ORQ nueva', '9'.repeat(400)]) assert.equal(lib.roleNamed(text), null, JSON.stringify(text.slice(0, 20)));
});

const C = 'cccccccc-3333-4333-8333-333333333333';
const D = 'dddddddd-4444-4444-8444-444444444444';
const member = (id, title, seconds, more = {}) => ({ id, title, titleSource: 'custom-title', state: 'waiting', lastEntryAt: before(seconds), cwd: 'D:\\proj', gitBranch: 'main', permissionMode: 'bypassPermissions', work: [], tail: [], ...more });
const row = (title, role, more = {}) => ({ title, titleSource: 'custom-title', code: role === null ? null : 'JH', role, number: null, purpose: null, self: false, lastEntryAt: null, permissionMode: 'bypassPermissions', cwd: 'D:\\proj', gitBranch: 'main', worktree: null, features: [], transcripts: [], host: null, record: null, opened: 'unknown', where: 'unknown', effort: null, ...more });
// The app's records (`appSessions`), by the transcript's id: one in Routines for a scheduled task, one in Sessions.
const inRoutines = (more = {}) => ({ where: 'routines', effort: null, scheduledTaskId: 'task-1', archived: false, title: null, ...more });
const inSessions = (more = {}) => ({ where: 'sessions', effort: null, scheduledTaskId: null, archived: false, title: null, ...more });

test('rosterOf gives one row per title, with its role, what it is for, its mode, where it works and when it last wrote', () => {
  const roster = lib.rosterOf([member(A, 'JH 2 · the board', 60, { permissionMode: 'auto', cwd: 'C:\\elsewhere', gitBranch: 'feat/x' }), member(B, 'JH ORQ · proj', 600)]);
  assert.deepEqual(roster, {
    rows: [
      row('JH ORQ · proj', 'orchestrator', { purpose: 'proj', lastEntryAt: before(600), transcripts: [{ id: B, lastEntryAt: before(600) }] }),
      row('JH 2 · the board', 'work', { number: 2, purpose: 'the board', lastEntryAt: before(60), permissionMode: 'auto', cwd: 'C:\\elsewhere', gitBranch: 'feat/x', transcripts: [{ id: A, lastEntryAt: before(60) }] }),
    ],
    unread: 0,
    outside: 0,
  });
  assert.deepEqual(lib.rosterOf([]), { rows: [], unread: 0, outside: 0 });
});

test('rosterOf opened: the earliest member that is not unknown, else scheduled when a member\'s app record names a task, else unknown', () => {
  const opened = (sessions, app = new Map()) => lib.rosterOf(sessions, { app }).rows[0].opened;
  const latest = member(A, 'JH 2 · the board', 60, { opened: 'session' });
  assert.equal(opened([latest, member(B, 'JH 2 · the board', 7200, { opened: 'his' })]), 'his', 'the earliest one, not the latest');
  assert.equal(opened([latest, member(B, 'JH 2 · the board', 7200, { opened: 'unknown' })]), 'session', 'an earlier unknown is passed over');
  assert.equal(opened([member(A, 'JH 2 · the board', 60, { opened: 'unknown' })], new Map([[A, inRoutines()]])), 'scheduled', 'a scheduled task in the app record');
  assert.equal(opened([latest, member(B, 'JH 2 · the board', 7200, { opened: 'unknown' })], new Map([[B, inRoutines()]])), 'session', 'an opener read from the transcript is not overruled by the record');
  assert.equal(opened([member(A, 'JH 2 · the board', 60, { opened: 'unknown' })], new Map([[A, inSessions()]])), 'unknown', 'a record with no task is not a scheduled session');
  assert.equal(opened([member(A, 'JH 2 · the board', 60)]), 'unknown', 'a member with no opener and no record says unknown');
});

test('rosterOf where: the app record of the latest member that has one, else not-in-app for a command, else unknown', () => {
  const where = (sessions, app = new Map()) => lib.rosterOf(sessions, { app }).rows[0].where;
  const latest = member(A, 'JH 2 · the board', 60, { opened: 'session' });
  const older = member(B, 'JH 2 · the board', 7200, { opened: 'his' });
  assert.equal(where([latest, older], new Map([[B, inSessions({ where: 'archived', archived: true })]])), 'archived', 'the record of the one member that has one');
  assert.equal(where([latest, older], new Map([[A, inRoutines()], [B, inSessions()]])), 'routines', 'the record of the latest member that has one');
  assert.equal(where([member(A, 'JH 2 · the board', 60, { opened: 'command' })]), 'not-in-app', 'a command with no record is not in the app');
  assert.equal(where([member(A, 'JH 2 · the board', 60, { opened: 'command' })], new Map([[A, inSessions()]])), 'sessions', 'a command with a record says where the record does');
  assert.equal(where([latest]), 'unknown', 'a session he opened with no record says unknown');
});

test('rosterOf effort: the latest member\'s effort that is a string, else the app record\'s, else null', () => {
  const effort = (sessions, app = new Map()) => lib.rosterOf(sessions, { app }).rows[0].effort;
  assert.equal(effort([member(A, 'JH 2 · the board', 60, { effort: 'high' }), member(B, 'JH 2 · the board', 600, { effort: 'low' })]), 'high', 'the latest');
  assert.equal(effort([member(A, 'JH 2 · the board', 60, { effort: null }), member(B, 'JH 2 · the board', 600, { effort: 'low' })]), 'low', 'an older one counts when the latest records none');
  assert.equal(effort([member(A, 'JH 2 · the board', 60)], new Map([[A, inRoutines({ effort: 'medium' })]])), 'medium', 'the app record when no member records one');
  assert.equal(effort([member(A, 'JH 2 · the board', 60, { effort: 'high' })], new Map([[A, inRoutines({ effort: 'low' })]])), 'high', 'the transcript before the app record');
  assert.equal(effort([member(A, 'JH 2 · the board', 60)]), null, 'none says null');
});

test('the roster line after the mode line says how a row was opened and where it is, marks what is not in his sidebar, and marks an effort below high', () => {
  // The line is the fourth of a row's: the header, the mode line (unchanged), then this one.
  const opener = (sessions, app) => rosterSection(sessions, { app })[3];
  const mode = 'bypassPermissions';
  assert.equal(rosterSection([member(A, 'JH 2 · the board', 60, { opened: 'his', effort: 'high' })], { app: new Map([[A, inSessions({ effort: 'high' })]]) })[2], `    mode ${mode}  folder D:\\proj  branch main  transcript aaaaaaaa`, 'the mode line is unchanged');
  assert.equal(opener([member(A, 'JH 2 · the board', 60, { opened: 'his', effort: 'high' })], new Map([[A, inSessions({ effort: 'high' })]])), '    opened by him  in Sessions  effort high');
  assert.equal(opener([member(A, 'JH 2 · the board', 60, { opened: 'his', effort: 'low' })], new Map([[A, inSessions({ effort: 'low' })]])), '    opened by him  in Sessions  effort low', 'an effort below high is not marked for his own session');
  assert.equal(opener([member(A, 'JH 2 · the board', 60, { opened: 'unknown' })], new Map([[A, inRoutines({ effort: 'medium' })]])), '    opened by a scheduled task  in Routines  effort medium  NOT IN HIS SIDEBAR  effort below high');
  assert.equal(opener([member(A, 'JH 2 · the board', 60, { opened: 'command', effort: 'low' })]), '    opened by a command  not in the app  effort low  NOT IN HIS SIDEBAR  effort below high');
  assert.equal(opener([member(A, 'JH 2 · the board', 60, { opened: 'session', effort: 'medium' })], new Map([[A, inSessions({ effort: 'medium' })]])), '    opened by a session  in Sessions  effort medium  effort below high');
  assert.equal(opener([member(A, 'JH 2 · the board', 60, { opened: 'his', effort: 'high' })], new Map([[A, inSessions({ where: 'archived', archived: true, effort: 'high' })]])), '    opened by him  archived  effort high', 'archived is not marked');
  assert.equal(opener([member(A, 'JH 2 · the board', 60)]), '    opened unknown  where unknown  effort unknown');
});

// The app appends entries with no time to a transcript it opens (`cost-state`, seen on 2026-10-11 in two
// whose last timed entry was 13 and 14 days old): the file is then new and the session is not.
test('rosterOf: a transcript whose last timed entry is before the window is no row and holds no role, however new its file', () => {
  const since = NOW - 12 * 3600 * 1000;
  const sessions = [
    member(A, 'JH ORQ · proj', 600),
    member(B, 'JH ORQ · days ago', 13 * 86400),
    member(C, 'JH 1 · restarted', 60),
    member(D, 'JH 1 · restarted', 14 * 86400),
    member('eeeeeeee-5555', 'JH 2 · no time', 0, { lastEntryAt: null }),
    member('ffffffff-6666', 'JH 3 · at the edge', 12 * 3600),
  ];
  const roster = lib.rosterOf(sessions, { since });
  assert.deepEqual(roster.rows.map((item) => [item.title, item.transcripts.map((transcript) => transcript.id.slice(0, 8))]), [
    ['JH ORQ · proj', ['aaaaaaaa']],
    ['JH 1 · restarted', ['cccccccc']],
    ['JH 3 · at the edge', ['ffffffff']],
  ]);
  assert.equal(roster.outside, 3);
  assert.deepEqual(lib.roleHolders(roster, lib.roleNamed('orchestrator')).map((item) => item.title), ['JH ORQ · proj']);
  assert.deepEqual(lib.roleHolders(roster, lib.roleNamed('2')), []);
  // With no window given every transcript handed in is a row, as before.
  assert.deepEqual([lib.rosterOf(sessions).rows.length, lib.rosterOf(sessions).outside], [5, 0]);
});

test('rosterOf: the transcripts of one title are one row, which says what the latest of them records', () => {
  // One app session restarted by the app writes a new transcript under the title it had.
  const older = member(A, 'JH 1 · the lock', 7200, { permissionMode: 'auto', cwd: 'C:\\old', gitBranch: 'feat/old' });
  const newer = member(B, 'JH 1 · the lock', 60, { permissionMode: null, cwd: 'C:\\new', gitBranch: null, self: true });
  const [only, ...rest] = lib.rosterOf([older, newer]).rows;
  assert.deepEqual(rest, []);
  // The mode of the latest transcript that records one; the folder and the branch together, from the
  // latest that records a folder, since a branch is the branch of a folder.
  assert.deepEqual(only, row('JH 1 · the lock', 'work', { number: 1, purpose: 'the lock', self: true, lastEntryAt: before(60), permissionMode: 'auto', cwd: 'C:\\new', gitBranch: null, transcripts: [{ id: B, lastEntryAt: before(60) }, { id: A, lastEntryAt: before(7200) }] }));
  const unplaced = lib.rosterOf([older, { ...newer, cwd: null }]).rows[0];
  assert.deepEqual([unplaced.cwd, unplaced.gitBranch], ['C:\\old', 'feat/old']);
});

test('rosterOf: a title outside the shape is a row with no role, a session with no title of its own is a row of its own, and a transcript that cannot be read is counted', () => {
  const sessions = [
    member(A, 'Board feature', 60),
    member(B, 'fix the review', 120, { titleSource: 'first-prompt' }),
    member(C, 'fix the review', 180, { titleSource: 'first-prompt' }),
    member(D, null, 240, { titleSource: null, lastEntryAt: null }),
    { id: 'eeeeeeee-5555', modifiedAt: before(1), unavailable: 'EBUSY' },
    // The start of a first prompt is not a name, whatever it looks like: it holds no role.
    member('ffffffff-6666', 'JH ORQ · proj', 300, { titleSource: 'first-prompt' }),
  ];
  const roster = lib.rosterOf(sessions);
  assert.equal(roster.unread, 1);
  assert.deepEqual(roster.rows.map((item) => [item.title, item.titleSource, item.role, item.transcripts.map((transcript) => transcript.id.slice(0, 8))]), [
    ['Board feature', 'custom-title', null, ['aaaaaaaa']],
    ['fix the review', 'first-prompt', null, ['bbbbbbbb']],
    ['fix the review', 'first-prompt', null, ['cccccccc']],
    ['JH ORQ · proj', 'first-prompt', null, ['ffffffff']],
    [null, null, null, ['dddddddd']],
  ]);
});

test('rosterOf puts the orchestrator first, then the work sessions by number, then the rest, the latest first', () => {
  const titles = ['Loose notes', 'JH 10 · ten', 'JH ORQ · proj', 'JH 2 · two', 'Other notes'];
  const roster = lib.rosterOf(titles.map((title, index) => member(`${index}0000000-0000`, title, 60 * (index + 1))));
  assert.deepEqual(roster.rows.map((item) => item.title), ['JH ORQ · proj', 'JH 2 · two', 'JH 10 · ten', 'Loose notes', 'Other notes']);
});

test('rosterOf says which worktree the folder a session records is, and the feature plans of its branch when the worktree is still on it', () => {
  const plans = (...names) => ({ available: true, items: names.map((name) => ({ path: `odd/tasks/${name}.md`, title: name, done: 0, total: 1, pending: [], nextStep: [] })) });
  const worktrees = {
    available: true,
    items: [
      { path: 'D:/proj', branch: 'main', plans: plans() },
      { path: 'D:/proj-worktrees/board', branch: 'feat/board', plans: plans('session-board', 'draft') },
      { path: 'D:/proj-worktrees/lock', branch: 'feat/lock', plans: { available: false, reason: 'git diff: boom' } },
    ],
  };
  const sessions = [
    member(A, 'JH 1 · board', 60, { cwd: 'd:\\proj-worktrees\\board\\', gitBranch: 'feat/board' }),
    member(B, 'JH 2 · moved on', 60, { cwd: 'D:\\proj-worktrees\\board', gitBranch: 'feat/earlier' }),
    member(C, 'JH 3 · lock', 60, { cwd: 'D:\\proj-worktrees\\lock', gitBranch: 'feat/lock' }),
    member(D, 'JH 4 · elsewhere', 60, { cwd: 'C:\\elsewhere', gitBranch: 'main' }),
  ];
  const places = (given) => lib.rosterOf(sessions, given).rows.map((item) => [item.worktree, item.features]);
  assert.deepEqual(places({ worktrees }), [['D:/proj-worktrees/board', ['session-board', 'draft']], ['D:/proj-worktrees/board', []], ['D:/proj-worktrees/lock', []], [null, []]]);
  assert.deepEqual(places({ worktrees: { available: false, reason: 'git worktree: boom' } }), [[null, []], [null, []], [null, []], [null, []]]);
});

test('roleHolders gives the rows that hold a role', () => {
  const roster = lib.rosterOf([member(A, 'JH ORQ · proj', 60), member(B, 'XX ORQ · other', 120), member(C, 'JH 5 · five', 180), member(D, 'JH ORQ nueva · proj', 240)]);
  assert.deepEqual(lib.roleHolders(roster, lib.roleNamed('orchestrator')).map((item) => item.title), ['JH ORQ · proj', 'XX ORQ · other']);
  assert.deepEqual(lib.roleHolders(roster, lib.roleNamed('5')).map((item) => item.title), ['JH 5 · five']);
  assert.deepEqual(lib.roleHolders(roster, lib.roleNamed('6')), []);
});

const rosterSection = (sessions, given) => {
  const lines = lib.renderBoard({ ...BOARD, sessions, roster: lib.rosterOf(sessions, given) }, { now: NOW });
  assert.equal(lines[lines.indexOf('Roster') - 1], '', 'after the sessions');
  return lines.slice(lines.indexOf('Roster'), lines.indexOf('Worktrees') - 1);
};

test('renderBoard prints the roster after the sessions: a row per title with its role, then where it works, and last what it cannot know', () => {
  const sessions = [
    member(A, 'JH ORQ · proj', 600),
    member(B, 'JH 2 · the board', 5, { self: true, permissionMode: 'auto', cwd: 'D:\\proj-worktrees\\board', gitBranch: 'feat/board' }),
    member(C, 'JH 2 · the board', 7500, { cwd: null, gitBranch: null, permissionMode: null }),
    member(D, 'Board feature', 3 * 86400, { permissionMode: null, cwd: null, gitBranch: null }),
    member('eeeeeeee-5555', 'fix the review', 60, { titleSource: 'first-prompt' }),
    member('ffffffff-6666', null, 60, { titleSource: null, lastEntryAt: null }),
    { id: '99999999-7777', modifiedAt: before(1), unavailable: 'EBUSY' },
  ];
  const worktrees = { available: true, items: [{ path: 'D:/proj-worktrees/board', branch: 'feat/board', plans: { available: true, items: [{ path: 'odd/tasks/session-board.md' }] } }] };
  assert.deepEqual(rosterSection(sessions, { worktrees }), [
    'Roster',
    '  orchestrator  JH ORQ · proj  silent since 10m ago',
    '    mode bypassPermissions  folder D:\\proj  branch main  transcript aaaaaaaa',
    '    opened unknown  where unknown  effort unknown',
    '  work 2  JH 2 · the board  this session, last entry 5s ago',
    // `folder`, as the entries record it, and not `worktree`: a session that reaches one by `cd` records another.
    '    mode auto  folder D:\\proj-worktrees\\board  branch feat/board  feature session-board  transcripts bbbbbbbb (5s ago), cccccccc (2h 05m ago)',
    '    opened unknown  where unknown  effort unknown',
    '  no role  fix the review  silent since 1m ago  (it has no title: this is the start of its first prompt)',
    '    mode bypassPermissions  folder D:\\proj  branch main  transcript eeeeeeee',
    '    opened unknown  where unknown  effort unknown',
    '  no role  Board feature  silent since 3d ago  (its title is not "<code> <role> · <what it does>")',
    '    mode unknown  folder unknown  branch unknown  transcript dddddddd',
    '    opened unknown  where unknown  effort unknown',
    '  no role  (no title)  silent, no entry of it has a time  (it has no title)',
    '    mode bypassPermissions  folder D:\\proj  branch main  transcript ffffffff',
    '    opened unknown  where unknown  effort unknown',
    '  1 transcript that could not be read is in no row',
    `  ${lib.ROSTER_NOT_KNOWN}`,
  ]);
  assert.match(lib.ROSTER_NOT_KNOWN, /alive or archived/);
  assert.match(lib.ROSTER_NOT_KNOWN, /the worktree a session reaches by `cd`/);
});

test('renderBoard says how many transcripts of the window have no entry in it, and are in no row of the roster', () => {
  const since = NOW - 12 * 3600 * 1000;
  const old = (id, title) => member(id, title, 13 * 86400);
  const counted = (sessions) => rosterSection(sessions, { since }).filter((line) => line.includes('no entry inside the window'));
  assert.deepEqual(counted([member(A, 'JH ORQ · proj', 600), old(B, 'JH ORQ · days ago')]), ['  1 transcript with no entry inside the window is in no row']);
  assert.deepEqual(counted([member(A, 'JH ORQ · proj', 600), old(B, 'JH 1 · one'), old(C, 'JH 2 · two')]), ['  2 transcripts with no entry inside the window are in no row']);
  assert.deepEqual(counted([member(A, 'JH ORQ · proj', 600)]), []);
  // Nothing but such transcripts is still a roster that says so, not "no session".
  assert.deepEqual(rosterSection([old(B, 'JH 1 · one')], { since }), ['Roster', '  1 transcript with no entry inside the window is in no row', `  ${lib.ROSTER_NOT_KNOWN}`]);
});

test('renderBoard says in one line when more than one session carries the orchestrator\'s title, and only then', () => {
  const warning = (sessions) => rosterSection(sessions).filter((line) => /carry the orchestrator/.test(line));
  assert.deepEqual(warning([member(A, 'JH ORQ · proj', 60), member(B, 'JH ORQ · other', 120), member(C, 'JH 1 · one', 180)]), [
    '  2 sessions carry the orchestrator\'s title: "JH ORQ · proj", "JH ORQ · other". A message to the orchestrator has no single address.',
  ]);
  // A handover: the one that arrives and the one that leaves hold other titles, and one orchestrator is left.
  assert.deepEqual(warning([member(A, 'JH ORQ · proj', 60), member(B, 'JH ORQ nueva · proj', 120), member(C, 'JH ORQ relevada · proj', 180)]), []);
  // Two work sessions under one number are two rows, and no line of this kind.
  assert.deepEqual(warning([member(A, 'JH 1 · one', 60), member(B, 'JH 1 · another', 120)]), []);
});

test('renderBoard prints a roster with no session as such, and no section for a board that was given none', () => {
  assert.deepEqual(rosterSection([]), ['Roster', '  no session']);
  assert.equal(lib.renderBoard(BOARD, { now: NOW }).includes('Roster'), false);
});

test('boardChanges does not compare the roster: it is the sessions again, and a title that changes wakes nobody', () => {
  const titled = (title) => {
    const sessions = [seen(A, 'waiting', { title, titleSource: 'custom-title' })];
    return { sessions, roster: lib.rosterOf(sessions) };
  };
  assert.deepEqual(changes(titled('JH ORQ nueva · proj'), titled('JH ORQ · proj')), []);
});

// --- the record on the board: titles from the openings read, the roster's place in it, the channel ---
//
// The record is the file `notify` writes (bin/lib/channel.mjs). This library reads no file: it is handed
// the notices and the readings as the record's reader gives them. Everything below is made up.

const noticeOf = (seconds, from, to, kind, text, more = {}) => ({
  schema: 'js-harness.channel-notice/v1',
  at: before(seconds),
  from: { host: 'claude-code', id: null, source: 'environment', title: null, permissionMode: null, ...from },
  to: to === 'orchestrator' ? { role: 'orchestrator', number: null } : { role: 'work', number: to },
  kind,
  text,
  cwd: null,
  worktree: null,
  branch: null,
  ...more,
});
const readingOf = (seconds, id, title) => ({ schema: 'js-harness.channel-reading/v1', at: before(seconds), reader: { host: 'claude-code', id, source: 'environment' }, title });
const recordOf = (notices = [], more = {}) => ({ path: 'H:\\.js-harness\\channel\\D--proj.jsonl', notices, readings: [], skipped: 0, ...more });

test('a session whose transcript carries no title takes the title of the opening it read last, and a title in its transcript wins', () => {
  const readings = [readingOf(900, B, 'JH 2 · first wording'), readingOf(600, B, 'JH 2 · the board'), readingOf(500, A, 'JH 9 · not this one'), readingOf(400, 'zzzzzzzz-0000', 'JH 7 · nobody here')];
  assert.deepEqual([lib.titleRead(readings, B), lib.titleRead(readings, C), lib.titleRead([], B), lib.titleRead(readings, null)], ['JH 2 · the board', null, null, null]);
  const sessions = [member(A, 'JH ORQ · proj', 60), member(B, 'corré js-harness sessions --opening', 120, { titleSource: 'first-prompt' }), member(C, null, 180, { titleSource: null }), { id: D, unavailable: 'EBUSY' }];
  const titled = lib.titledByReadings(sessions, readings);
  assert.deepEqual(titled.map((session) => [session.title ?? null, session.titleSource ?? null]), [['JH ORQ · proj', 'custom-title'], ['JH 2 · the board', 'reading'], [null, null], [null, null]]);
  assert.equal(sessions[1].titleSource, 'first-prompt', 'the sessions given are left as they were');
  // So the roster has it under its role, and a transcript of the same title that carries it is the same row.
  assert.deepEqual(lib.rosterOf(titled).rows.map((item) => [item.role, item.number, item.title, item.titleSource]), [['orchestrator', null, 'JH ORQ · proj', 'custom-title'], ['work', 2, 'JH 2 · the board', 'reading'], [null, null, null, null]]);
  const joined = lib.rosterOf(lib.titledByReadings([member(B, null, 120, { titleSource: null }), member(C, 'JH 2 · the board', 60)], readings)).rows;
  assert.deepEqual(joined.map((item) => [item.title, item.titleSource, item.transcripts.map((transcript) => transcript.id)]), [['JH 2 · the board', 'custom-title', [C, B]]]);
  assert.deepEqual(lib.roleHolders(lib.rosterOf(titled), lib.roleNamed('2')).map((item) => item.title), ['JH 2 · the board']);
});

// Review of ce8bdf7, finding 1: a notice written under the start of an id was its row's, and a reading
// written under the same start (`sessions --opening --self <start>`) gave nobody its title.
test('a reading written under the start of a session id gives that session its title, by the rule that makes a notice its row\'s', () => {
  const readings = [readingOf(600, B.slice(0, 8), 'JH 2 · the board'), readingOf(500, B.slice(0, 7), 'JH 9 · seven characters name nobody')];
  assert.deepEqual([lib.titleRead(readings, B), lib.titleRead(readings, C)], ['JH 2 · the board', null]);
  const [titled] = lib.titledByReadings([member(B, null, 120, { titleSource: null })], readings);
  assert.deepEqual([titled.title, titled.titleSource], ['JH 2 · the board', 'reading']);
  // The last reading is still the one that counts, whichever way its id was written.
  assert.equal(lib.titleRead([...readings, readingOf(400, B, 'JH 2 · renamed')], B), 'JH 2 · renamed');
  assert.equal(lib.titleRead([readingOf(700, B, 'JH 2 · first'), ...readings], B), 'JH 2 · the board');
  // And it is the same row for the record: the notice under that start is this session's.
  const roster = lib.rosterOf([titled], { record: recordOf([noticeOf(300, { id: B.slice(0, 8), source: 'flag' }, 'orchestrator', 'opened', 'the board')]) });
  assert.deepEqual(roster.rows.map((item) => [item.title, item.record?.status?.kind]), [['JH 2 · the board', 'opened']]);
});

test('rosterOf says of each row what the record says of its session: the last of opened, waiting, closed and relieved, and where its notices were written from', () => {
  const sessions = [member(A, 'JH ORQ · proj', 60), member(B, 'JH 2 · the board', 120), member(C, 'JH 3 · the lock', 180), member(D, 'Board feature', 240)];
  const notices = [
    noticeOf(900, { id: B, title: 'JH 2 · the board' }, 'orchestrator', 'opened', 'session board, T4', { worktree: 'D:\\proj-worktrees\\board', branch: 'feat/board' }),
    noticeOf(800, { id: A, title: 'JH ORQ · proj' }, 2, 'note', 'the gate is free', { worktree: 'D:\\proj', branch: 'main' }),
    // The start of an id, as `--self` gives it when no transcript could be read to complete it.
    noticeOf(700, { id: 'bbbbbbbb', source: 'flag', title: null }, 'orchestrator', 'waiting', 'on the gate of JH 3; it is JH 3 that holds it', { worktree: 'D:\\proj-worktrees\\board-2', branch: 'feat/board-2' }),
    noticeOf(650, { id: B }, 'orchestrator', 'note', 'written where git gave no worktree'),
    // Its id is of no transcript of the board (the app restarted the session into a new one): by its title.
    noticeOf(600, { id: 'eeeeeeee-9999', title: 'JH 3 · the lock' }, 'orchestrator', 'closed', 'delivered; nothing more goes to this session', { worktree: 'D:\\proj-worktrees\\lock', branch: 'feat/lock' }),
    // The id wins over the title the notice carries.
    noticeOf(500, { id: A, title: 'JH 3 · the lock' }, 'orchestrator', 'relieved', 'JH ORQ nueva · proj has the role now'),
    noticeOf(400, {}, 'orchestrator', 'note', 'from a session the host does not name'),
    noticeOf(300, { id: 'ffffffff-0000', title: 'JH 8 · gone' }, 'orchestrator', 'closed', 'of no row'),
  ];
  const roster = lib.rosterOf(sessions, { record: recordOf(notices) });
  assert.deepEqual(roster.rows.map((item) => [item.title, item.record]), [
    ['JH ORQ · proj', { status: { kind: 'relieved', at: before(500), text: 'JH ORQ nueva · proj has the role now' }, worktree: 'D:\\proj', branch: 'main', notices: 2 }],
    ['JH 2 · the board', { status: { kind: 'waiting', at: before(700), text: 'on the gate of JH 3; it is JH 3 that holds it' }, worktree: 'D:\\proj-worktrees\\board-2', branch: 'feat/board-2', notices: 3 }],
    ['JH 3 · the lock', { status: { kind: 'closed', at: before(600), text: 'delivered; nothing more goes to this session' }, worktree: 'D:\\proj-worktrees\\lock', branch: 'feat/lock', notices: 1 }],
    ['Board feature', null],
  ]);
  // The folder a row records is left as the transcript has it: the record replaces nothing.
  assert.deepEqual(roster.rows.map((item) => item.cwd), ['D:\\proj', 'D:\\proj', 'D:\\proj', 'D:\\proj']);
  // A row whose notices say nothing of its state has none, and with no record no row has anything.
  const noted = lib.rosterOf(sessions, { record: recordOf([notices[1]]) }).rows[0].record;
  assert.deepEqual(noted, { status: null, worktree: 'D:\\proj', branch: 'main', notices: 1 });
  assert.deepEqual(lib.rosterOf(sessions).rows.map((item) => item.record), [null, null, null, null]);
  assert.deepEqual(lib.rosterOf(sessions, { record: recordOf([]) }).rows.map((item) => item.record), [null, null, null, null]);
});

const SENT = (seconds, to, id, more = {}) => ({ at: before(seconds), to, toKind: 'name', id, failed: false, summary: null, ...more });
const RECEIVED = (seconds, name, id, more = {}) => ({ at: before(seconds), from: 'session', name, session: 'local_made-up', mode: 'bypass', id, ...more });
/** An orchestrator and a work session that wrote to each other, a message to a title nobody of the window
 * has, a send that failed, and a message from a session whose transcript is not on the board. */
const talking = () => [
  member(A, 'JH ORQ · proj', 60, {
    sent: [SENT(300, 'JH 2 · the board', 'm1', { summary: 'merge when green' }), SENT(100, 'JH 9 · nobody', 'm3'), SENT(90, 'JH 9 · nobody', null, { failed: true, summary: 'again' })],
    received: [RECEIVED(200, 'JH 2 · the board', 'm2'), { at: before(150), from: 'subagent', name: null, session: null, mode: null, id: null }, RECEIVED(50, 'JH 7 · outside', 'm9', { mode: 'auto' })],
  }),
  member(B, 'JH 2 · the board', 120, { sent: [SENT(201, 'JH ORQ · proj', 'm2', { summary: 'T4b gated' })], received: [RECEIVED(299, 'JH ORQ · proj', 'm1')] }),
  // A session the app restarted writes its earlier entries again in a new transcript: one message, once.
  member(C, 'JH 2 · the board', 110, { sent: [SENT(201, 'JH ORQ · proj', 'm2', { summary: 'T4b gated' })], received: [RECEIVED(299, 'JH ORQ · proj', 'm1')] }),
  { id: D, unavailable: 'EBUSY' },
];

test('channelOf gives the last notices of the record, those for the orchestrator apart, and the messages between sessions with whether each was seen to arrive', () => {
  const orq = { session: A, title: 'JH ORQ · proj' };
  const two = { session: B, title: 'JH 2 · the board' };
  const notices = [noticeOf(900, { id: B }, 'orchestrator', 'opened', 'one'), noticeOf(800, { id: A }, 2, 'note', 'two'), noticeOf(700, { id: B }, 'orchestrator', 'waiting', 'three'), noticeOf(600, { id: A }, 2, 'note', 'four')];
  const channel = lib.channelOf(recordOf(notices, { skipped: 2 }), talking(), { count: 3 });
  assert.deepEqual([channel.path, channel.skipped, channel.unavailable, channel.noticeCount, channel.notices.map((one) => one.text)], ['H:\\.js-harness\\channel\\D--proj.jsonl', 2, undefined, 4, ['two', 'three', 'four']]);
  assert.deepEqual([channel.forOrchestrator.count, channel.forOrchestrator.notices.map((one) => one.text)], [2, ['one', 'three']]);
  assert.equal(channel.messageCount, 5);
  assert.deepEqual(channel.messages, [
    { id: 'm3', at: before(100), from: orq, to: { address: 'JH 9 · nobody', session: null, title: null }, summary: null, state: 'not-seen' },
    { id: null, at: before(90), from: orq, to: { address: 'JH 9 · nobody', session: null, title: null }, summary: 'again', state: 'failed' },
    // Its sender's transcript is not on the board: the receiver's says who it came from.
    { id: 'm9', at: before(50), from: { session: null, title: 'JH 7 · outside' }, to: { address: null, ...orq }, summary: null, state: 'arrived' },
  ]);
  const all = lib.channelOf(recordOf(), talking(), { count: 10 }).messages;
  assert.deepEqual(all.slice(0, 2), [
    { id: 'm1', at: before(300), from: orq, to: { address: 'JH 2 · the board', ...two }, summary: 'merge when green', state: 'arrived' },
    { id: 'm2', at: before(201), from: two, to: { address: 'JH ORQ · proj', ...orq }, summary: 'T4b gated', state: 'arrived' },
  ]);
  assert.equal(JSON.stringify(all).includes('held'), false, 'a transcript cannot show that a message is held');
  // Five by default, and a record that could not be read says so and gives none.
  assert.deepEqual([lib.CHANNEL_LINES, lib.channelOf(recordOf(Array.from({ length: 7 }, (_, n) => noticeOf(n, {}, 'orchestrator', 'note', `n${n}`))), []).notices.length], [5, 5]);
  const unread = lib.channelOf(recordOf([], { unavailable: 'EACCES' }), []);
  assert.deepEqual(unread, { path: 'H:\\.js-harness\\channel\\D--proj.jsonl', unavailable: 'EACCES', skipped: 0, noticeCount: 0, notices: [], forOrchestrator: { count: 0, notices: [] }, messageCount: 0, messages: [] });
  // Sessions the board could not read, or that the reader gave no messages for, have none.
  assert.deepEqual(lib.channelOf(recordOf(), [{ id: D, unavailable: 'EBUSY' }, member(A, 'JH ORQ · proj', 60)]).messages, []);
});

// Review of ce8bdf7, finding 3: a send with no id (it failed, or its result was never written) that a
// restarted session wrote again in its new transcript was two messages.
test('channelOf counts once a message with no id that a restarted session wrote again in a second transcript, and merges no two that are not one', () => {
  const count = (...sessions) => lib.channelOf(recordOf(), sessions).messageCount;
  const again = SENT(90, 'JH ORQ · proj', null, { failed: true, summary: 'again' });
  const first = member(B, 'JH 2 · the board', 120, { sent: [again, SENT(80, 'JH ORQ · proj', null, { summary: 'another' })] });
  const restarted = (sent) => member(C, 'JH 2 · the board', 110, { sent });
  assert.equal(count(first, restarted([{ ...again }])), 2, 'the copy is the message it copies');
  assert.equal(count(first, restarted([{ ...again }]), member(D, 'JH 2 · the board', 100, { sent: [{ ...again }] })), 2, 'and so is the copy of a second restart');
  // What is not the same message stays two: another summary, another address, a send that did not fail,
  // another moment, a session of another title, and a send with no time.
  for (const other of [{ summary: 'again, differently' }, { to: 'JH 9 · other' }, { at: before(91) }]) {
    assert.equal(count(first, restarted([{ ...again, ...other }])), 3, JSON.stringify(other));
  }
  assert.equal(count(first, member(C, 'JH 3 · the lock', 110, { sent: [{ ...again }] })), 3, 'a session of another title sent its own');
  const untimed = { ...again, at: null };
  assert.equal(count(member(B, 'JH 2 · the board', 120, { sent: [untimed] }), restarted([{ ...untimed }])), 2, 'no time, nothing to know it by');
  // Two calls of one transcript are two messages, whatever they share: one reply can make both.
  assert.equal(count(member(B, 'JH 2 · the board', 120, { sent: [again, { ...again }] })), 2);
  assert.equal(count(member(B, 'JH 2 · the board', 120, { sent: [again, { ...again }] }), restarted([{ ...again }, { ...again }])), 2, 'and their two copies are those two');
});

// Codex review of 7a19710, finding 1: the result of a send can be in one transcript only (the session was
// restarted between the call and its result), so one copy has no id and the other the id the result gave.
// The two were told apart by that, counted twice, and the stale one printed as never seen to arrive.
test('channelOf counts once a send whose copies differ in what is known of its outcome, and keeps the copy that knows more', () => {
  const channel = (...sessions) => lib.channelOf(recordOf(), sessions, { count: 10 });
  const shown = (...sessions) => channel(...sessions).messages.map((message) => [message.id, message.state, message.from.session]);
  const unresolved = SENT(201, 'JH ORQ · proj', null, { summary: 'T4b gated' });
  const orq = member(A, 'JH ORQ · proj', 60, { received: [RECEIVED(200, 'JH 2 · the board', 'm2')] });
  const old = member(B, 'JH 2 · the board', 120, { sent: [unresolved] });
  const restarted = (...sent) => member(C, 'JH 2 · the board', 110, { sent });
  // Whichever transcript the board reads first.
  assert.deepEqual(shown(orq, old, restarted({ ...unresolved, id: 'm2' })), [['m2', 'arrived', C]]);
  assert.deepEqual(shown(orq, restarted({ ...unresolved, id: 'm2' }), old), [['m2', 'arrived', C]]);
  // A failure is an outcome too, and an id says more than a failure.
  assert.deepEqual(shown(old, restarted({ ...unresolved, failed: true })), [[null, 'failed', C]]);
  assert.deepEqual(shown(restarted({ ...unresolved, failed: true }), old), [[null, 'failed', C]]);
  assert.deepEqual(shown(member(B, 'JH 2 · the board', 120, { sent: [{ ...unresolved, failed: true }] }), restarted({ ...unresolved, id: 'm2' })), [['m2', 'not-seen', C]]);
  // Two calls of one reply and their two copies are two messages, each with the id of its own copy.
  const twice = member(B, 'JH 2 · the board', 120, { sent: [unresolved, { ...unresolved }] });
  assert.deepEqual(shown(twice, restarted({ ...unresolved, id: 'm2' }, { ...unresolved, id: 'm3' })).map(([id]) => id), ['m2', 'm3']);
  assert.deepEqual(shown(twice, restarted({ ...unresolved, id: 'm2' })).map(([id]) => id), ['m2', null], 'and the one that has no copy stays');
  // What is not the same send stays two: other words, and two calls of one transcript, which are never one.
  assert.equal(channel(old, restarted({ ...unresolved, id: 'm2', summary: 'another' })).messageCount, 2);
  assert.equal(channel(member(B, 'JH 2 · the board', 120, { sent: [unresolved, { ...unresolved, id: 'm2' }] })).messageCount, 2);
  // An id written in two transcripts under two titles (the session was renamed between) is still one.
  assert.equal(channel(old, member(C, 'JH 2 · renamed', 110, { sent: [{ ...unresolved, id: 'm2' }] }), member(D, 'JH 2 · the board', 100, { sent: [{ ...unresolved, id: 'm2' }] })).messageCount, 1);
});

// Codex review of 25cf031: copies were matched by their place alone, the n-th send of a key in one
// transcript with the n-th in another. A transcript that holds only some of the sends of a key (a session
// resumed part way) put a send with one id in the place of a send with another, and the second was lost
// when the shorter transcript was read first.
test('channelOf never takes two sends with two ids for one, whichever transcript is read first', () => {
  const ids = (...sessions) => lib.channelOf(recordOf(), sessions, { count: 10 }).messages.map((message) => message.id).sort();
  const same = SENT(201, 'JH ORQ · proj', null, { summary: 'T4b gated' });
  const whole = member(B, 'JH 2 · the board', 120, { sent: [{ ...same, id: 'm1' }, { ...same, id: 'm2' }] });
  const resumed = (...sent) => member(C, 'JH 2 · the board', 110, { sent });
  assert.deepEqual(ids(resumed({ ...same, id: 'm2' }), whole), ['m1', 'm2'], 'the shorter transcript first');
  assert.deepEqual(ids(whole, resumed({ ...same, id: 'm2' })), ['m1', 'm2'], 'and last');
  // A copy with no id is a copy of the send it can still be: the one no copy of its transcript is yet.
  assert.deepEqual(ids(resumed({ ...same }, { ...same, id: 'm2' }), whole), ['m1', 'm2']);
  assert.deepEqual(ids(whole, resumed({ ...same, id: 'm2' }, { ...same })), ['m1', 'm2']);
  // And a send with an id takes the place of a copy with none, never of one with another id.
  const unresolved = member(B, 'JH 2 · the board', 120, { sent: [{ ...same }, { ...same, id: 'm2' }] });
  assert.deepEqual(ids(unresolved, resumed({ ...same, id: 'm1' }, { ...same, id: 'm2' })), ['m1', 'm2']);
  assert.deepEqual(ids(resumed({ ...same, id: 'm1' }, { ...same, id: 'm2' }), unresolved), ['m1', 'm2']);
  assert.deepEqual(ids(whole, resumed({ ...same, id: 'm3' })), ['m1', 'm2', 'm3'], 'a third id is a third send');
});

// Codex review of 0543030, and gentle-ai's of the same change: the calls of a transcript were taken key by
// key, so three sends of one reply (one moment) with the keys K, L, K came out as the first, the third,
// the second, and the last message of the board was not the last one sent.
test('channelOf keeps the sends of one moment in the order their transcript has them, whatever their keys and whichever transcript is read first', () => {
  const order = (sessions, options = { count: 10 }) => lib.channelOf(recordOf(), sessions, options).messages.map((message) => message.id ?? message.summary);
  const one = SENT(201, 'JH ORQ · proj', null, { summary: 'T4b gated' });
  const other = { ...one, summary: 'and pushed' };
  const reply = member(B, 'JH 2 · the board', 120, { sent: [{ ...one, id: 'm1' }, { ...other, id: 'm2' }, { ...one, id: 'm3' }] });
  assert.deepEqual(order([reply]), ['m1', 'm2', 'm3']);
  assert.deepEqual(order([reply], { count: 1 }), ['m3'], 'the last one shown is the last one sent');
  // A transcript that holds only some of them, read first, does not put its own before the rest.
  const resumed = (...sent) => member(C, 'JH 2 · the board', 110, { sent });
  assert.deepEqual(order([resumed({ ...one, id: 'm3' }), reply]), ['m1', 'm2', 'm3']);
  assert.deepEqual(order([resumed({ ...other, id: 'm2' }, { ...one, id: 'm3' }), reply]), ['m1', 'm2', 'm3']);
  assert.deepEqual(order([resumed({ ...one, id: 'm1' }), reply]), ['m1', 'm2', 'm3']);
  assert.deepEqual(order([reply, resumed({ ...one, id: 'm3' }, { ...other, id: 'm4' })]), ['m1', 'm2', 'm3', 'm4']);
  // Sends with no time have no key; they stay in the order of their transcript among themselves.
  const untimed = (summary) => ({ ...one, at: null, summary });
  assert.deepEqual(order([member(B, 'JH 2 · the board', 120, { sent: [untimed('first'), { ...one, id: 'm1' }, untimed('second'), { ...other, id: 'm2' }, untimed('third')] })]), ['first', 'second', 'third', 'm1', 'm2']);
});

// Codex review of 7a19710, finding 4: the session whose notices were written from a gate's folder was
// named as the gate's, and a session opened in that folder, which could have started it, was left out.
test('renderBoard: a gate in a folder one session wrote its notices from and another was opened in hangs from one of them, each named with what places it', () => {
  const beside = { cwd: 'D:\\proj-worktrees\\board', gitBranch: 'feat/board' };
  const sessions = [member(B, 'JH 2 · the board', 120), member(C, 'JH 5 · beside', 180, beside), member(D, 'JH 6 · also', 200, beside)];
  const notices = [noticeOf(900, { id: B }, 'orchestrator', 'opened', 'session board', { worktree: 'D:\\proj-worktrees\\board', branch: 'feat/board' })];
  const lock = { gateLock: { available: true, holder: holds(4242, 'D:\\proj-worktrees\\board'), waiters: [] } };
  const said = (list) => {
    const lines = lib.renderBoard({ ...BOARD, sessions: list, roster: lib.rosterOf(list, { record: recordOf(notices) }), gates: { available: true, items: [] }, ...lock }, { now: NOW });
    return lines.find((line) => line.startsWith('  pid 4242  ')).split('  ')[4];
  };
  assert.equal(said(sessions.slice(0, 2)), 'one of 2 sessions in this folder: JH 2 · the board (its notices were written from this folder), JH 5 · beside (its transcript records this folder)');
  assert.equal(said(sessions), 'one of 3 sessions in this folder: JH 2 · the board (its notices were written from this folder), JH 5 · beside (its transcript records this folder), JH 6 · also (its transcript records this folder)');
  // One session alone is the gate's, by whichever places it, and several placed the same way are said as before.
  assert.equal(said(sessions.slice(0, 1)), 'session JH 2 · the board (its notices were written from this folder)');
  assert.equal(said(sessions.slice(1, 2)), 'session JH 5 · beside (its transcript records this folder)');
  assert.equal(said(sessions.slice(1)), 'one of 2 sessions whose transcripts record this folder: JH 5 · beside, JH 6 · also');
});

// Codex review of 7a19710, finding 3: at a look that could not read the record the roster knows of no
// session that ended, so one that had said `closed` and ended a turn was said to wait, and woke the watch.
test('boardChanges: a session known as closed is not said to wait at a look that could not read the record, and the look after it still knows', () => {
  const title = (id) => (id === A ? 'JH ORQ · proj' : 'JH 2 · the board');
  const titled = (id, state, more = {}) => member(id, title(id), 60, { ...seen(id, state), title: title(id), ...more });
  const from = { id: B, title: 'JH 2 · the board' };
  const look = (two, notices, more = {}) => {
    const sessions = [titled(A, 'waiting'), two];
    return boardOf({ sessions, roster: lib.rosterOf(sessions, { record: recordOf(notices, more) }), ...channelWith(notices, more) });
  };
  const blind = (two) => look(two, [], { unavailable: 'EBUSY' });
  const opened = noticeOf(900, from, 'orchestrator', 'opened', 'the board');
  const closed = noticeOf(300, from, 'orchestrator', 'closed', 'delivered');
  const waits = 'session bbbbbbbb "JH 2 · the board" is waiting (was working)';
  const read = look(titled(B, 'working'), [opened, closed]);
  assert.deepEqual(lib.boardChanges(read, blind(titled(B, 'waiting'))), []);
  // A second look that cannot read it is compared with the first, which must still hold what was read.
  const kept = lib.watchBaseline(read, blind(titled(B, 'working')));
  assert.deepEqual(lib.boardChanges(kept, blind(titled(B, 'waiting'))), []);
  const twice = lib.watchBaseline(kept, blind(titled(B, 'waiting')));
  assert.deepEqual(lib.boardChanges(twice, blind(titled(B, 'waiting', { turnEndedAt: before(40) }))), []);
  // Read again, the record is what counts: still closed, nothing; opened again, its notice and its waiting are said.
  assert.deepEqual(lib.boardChanges(twice, look(titled(B, 'waiting', { turnEndedAt: before(40) }), [opened, closed])), []);
  const again = noticeOf(20, from, 'orchestrator', 'opened', 'the board, again');
  assert.deepEqual(lib.boardChanges(twice, look(titled(B, 'waiting', { turnEndedAt: before(40) }), [opened, closed, again])), ['session bbbbbbbb "JH 2 · the board" finished another turn and is waiting', 'notice for the orchestrator, opened from "JH 2 · the board": the board, again']);
  // A session the record did not say had ended wakes at such a look, as at any other.
  assert.deepEqual(lib.boardChanges(look(titled(B, 'working'), [opened]), blind(titled(B, 'waiting'))), [waits]);
  assert.deepEqual(lib.boardChanges(lib.watchBaseline(look(titled(B, 'working'), [opened]), blind(titled(B, 'working'))), blind(titled(B, 'waiting'))), [waits]);
  // And a look that reads a record with nothing of the session is believed: it is not a look that could not read.
  assert.deepEqual(lib.boardChanges(read, look(titled(B, 'waiting'), [])), [waits]);
});

// Review of ce8bdf7, finding 4: a board from before the tasks were kept read as a plan with no task, so
// the first look after an update said "task added" for every task of every plan.
test('boardChanges: a plan with no list of tasks on either side has none to compare, and its next step is still compared', () => {
  const { tasks: _tasks, ...before } = plan();
  assert.deepEqual(changes(trees(before), trees(plan())), []);
  assert.deepEqual(changes(trees(plan()), trees(before)), []);
  assert.deepEqual(changes(trees(plan({ tasks: undefined })), trees(plan({ tasks: [...TASKS, 'T4 Ship it'] }))), []);
  assert.deepEqual(changes(trees(before), trees(plan({ nextStep: [] }))), ['plan odd/tasks/board.md in D:/wt changed: its next step is now empty']);
  // A plan that has a list with nothing in it has no task, and gains each one.
  assert.deepEqual(changes(trees(plan({ tasks: [] })), trees(plan({ tasks: ['T1 Read the transcripts'] }))), ['plan odd/tasks/board.md in D:/wt changed: task added "T1 Read the transcripts"']);
});

// Seen live on 2026-10-11: a session that had said `closed` woke the orchestrator each time it ended a turn.
test('boardChanges: a session whose last word in the record is closed or relieved wakes nobody by waiting', () => {
  const titled = (id, state, more = {}) => member(id, id === A ? 'JH ORQ · proj' : 'JH 2 · the board', 60, { ...seen(id, state), title: id === A ? 'JH ORQ · proj' : 'JH 2 · the board', ...more });
  const from = { id: B, title: 'JH 2 · the board' };
  const withRecord = (sessions, ...notices) => ({ sessions, roster: lib.rosterOf(sessions, { record: recordOf(notices) }) });
  const said = (was, is, ...notices) => changes({ sessions: [titled(A, 'waiting'), was] }, withRecord([titled(A, 'waiting'), is], ...notices));
  const working = titled(B, 'working');
  const waiting = titled(B, 'waiting');
  const again = titled(B, 'waiting', { turnEndedAt: before(40) });
  const opened = noticeOf(900, from, 'orchestrator', 'opened', 'the board');
  const closed = noticeOf(300, from, 'orchestrator', 'closed', 'delivered');
  for (const kind of ['closed', 'relieved']) {
    const ended = noticeOf(300, from, 'orchestrator', kind, 'nothing more goes to this session');
    assert.deepEqual(said(working, waiting, opened, ended), [], `${kind}, and it starts waiting`);
    assert.deepEqual(said(waiting, again, opened, ended), [], `${kind}, and it finished another turn`);
    assert.deepEqual(changes({ sessions: [titled(A, 'waiting')] }, withRecord([titled(A, 'waiting'), waiting], opened, ended)), [], `${kind}, and it appears waiting`);
  }
  // Its neighbours still wake: a session with no word in the record, one that waits by its own notice,
  // and one that said `closed` and then `opened` again.
  const waits = 'session bbbbbbbb "JH 2 · the board" is waiting (was working)';
  assert.deepEqual(said(working, waiting), [waits]);
  assert.deepEqual(said(working, waiting, opened, noticeOf(300, from, 'orchestrator', 'waiting', 'the review')), [waits]);
  assert.deepEqual(said(working, waiting, closed, noticeOf(200, from, 'orchestrator', 'opened', 'the board, again')), [waits]);
  assert.deepEqual(said(waiting, again, opened), ['session bbbbbbbb "JH 2 · the board" finished another turn and is waiting']);
  // What a closed session does that is not waiting is still said: it works again, or reaches the pause.
  assert.deepEqual(changes({ sessions: [titled(A, 'waiting')] }, withRecord([titled(A, 'waiting'), working], opened, closed)), ['session bbbbbbbb "JH 2 · the board" appeared (working)']);
  assert.deepEqual(said(working, titled(B, 'waiting', { atContextPause: true }), opened, closed), [`session bbbbbbbb "JH 2 · the board" reached the context pause, ${PAUSE_SAID}: context 100k tokens (20%)`]);
  // A notice of another session's ends nothing of this one.
  assert.deepEqual(said(working, waiting, noticeOf(300, { id: A, title: 'JH ORQ · proj' }, 'all', 'relieved', 'JH ORQ nueva · proj has the role now')), [waits]);
});

const channelWith = (notices, more = {}) => ({ channel: lib.channelOf(recordOf(notices, more), []) });
const FROM_TWO = { id: B, title: 'JH 2 · the board' };

test('boardChanges: a notice for the orchestrator that the record gained since the last look, with who wrote it', () => {
  const first = noticeOf(900, FROM_TWO, 'orchestrator', 'opened', 'session board, T4');
  const second = noticeOf(20, FROM_TWO, 'orchestrator', 'waiting', 'on the gate of JH 3');
  assert.deepEqual(changes(channelWith([first]), channelWith([first, second])), ['notice for the orchestrator, waiting from "JH 2 · the board": on the gate of JH 3']);
  assert.deepEqual(changes(channelWith([]), channelWith([first, second])).length, 2, 'a record that begins');
  // A sender with no title is named by the start of its id, and one the host does not name is said so.
  assert.deepEqual(changes(channelWith([]), channelWith([noticeOf(5, { id: C }, 'orchestrator', 'closed', 'delivered'), noticeOf(4, {}, 'orchestrator', 'note', 'from Codex')])), [
    'notice for the orchestrator, closed from session cccccccc: delivered',
    'notice for the orchestrator, note from a sender the host does not name: from Codex',
  ]);
  // A long text is cut: the record has it whole.
  const long = changes(channelWith([]), channelWith([noticeOf(5, FROM_TWO, 'orchestrator', 'note', 'x'.repeat(500))]))[0];
  assert.equal(long, `notice for the orchestrator, note from "JH 2 · the board": ${'x'.repeat(159)}…`);
});

test('boardChanges: a notice for another role, one the watching session wrote itself, and a record that could not be read wake nobody', () => {
  const first = noticeOf(900, FROM_TWO, 'orchestrator', 'opened', 'session board, T4');
  assert.deepEqual(changes(channelWith([first]), channelWith([first, noticeOf(20, { id: A }, 2, 'note', 'the gate is free')])), []);
  const own = [first, noticeOf(20, { id: A, title: 'JH ORQ · proj' }, 'orchestrator', 'relieved', 'JH ORQ nueva has the role')];
  assert.deepEqual(changes(channelWith([first]), channelWith(own), { self: A }), []);
  assert.deepEqual(changes(channelWith([first]), channelWith(own), { self: 'aaaaaaaa' }), []);
  assert.equal(changes(channelWith([first]), channelWith(own), { self: B }).length, 1);
  // Codex review of 7a19710, finding 2: its own notice written under the start of its id (`notify --self`,
  // with no transcript to complete it) is its own too when it watches under its whole id.
  const short = [first, noticeOf(20, { id: A.slice(0, 8), source: 'flag' }, 'orchestrator', 'note', 'written with --self')];
  assert.deepEqual(changes(channelWith([first]), channelWith(short), { self: A }), []);
  assert.deepEqual(changes(channelWith([first]), channelWith(short), { self: A.slice(0, 8) }), []);
  assert.equal(changes(channelWith([first]), channelWith(short), { self: B }).length, 1, 'and nobody else\'s');
  const tooShort = [first, noticeOf(20, { id: A.slice(0, 7), source: 'flag' }, 'orchestrator', 'note', 'seven characters name nobody')];
  assert.equal(changes(channelWith([first]), channelWith(tooShort), { self: A }).length, 1);
  // Nothing new, a record that shrank (an uninstall removes it), a look that could not read it, a board without one.
  assert.deepEqual(changes(channelWith([first]), channelWith([first])), []);
  assert.deepEqual(changes(channelWith([first, first]), channelWith([first])), []);
  assert.deepEqual(changes(channelWith([first]), channelWith([], { unavailable: 'EBUSY' })), []);
  assert.deepEqual(changes(channelWith([], { unavailable: 'EBUSY' }), channelWith([first])), []);
  assert.deepEqual(changes({}, channelWith([first])), []);
  assert.deepEqual(changes(channelWith([first]), {}), []);
});

test('boardChanges: more notices for the orchestrator than the board holds are said by their number, and where the rest are', () => {
  const many = Array.from({ length: 7 }, (_, n) => noticeOf(70 - n, FROM_TWO, 'orchestrator', 'note', `n${n}`));
  const lines = changes(channelWith([]), channelWith(many));
  assert.deepEqual(lines, [...[2, 3, 4, 5, 6].map((n) => `notice for the orchestrator, note from "JH 2 · the board": n${n}`), '2 earlier notices for the orchestrator are in the record: H:\\.js-harness\\channel\\D--proj.jsonl']);
  // The rest wake the watch even when every notice the board holds is the watcher's own.
  assert.deepEqual(changes(channelWith([]), channelWith(many), { self: B }), ['2 earlier notices for the orchestrator are in the record: H:\\.js-harness\\channel\\D--proj.jsonl']);
});

test('watchBaseline keeps the channel of the older board across a look that could not read the record, so a notice written then is still said', () => {
  const first = noticeOf(900, FROM_TWO, 'orchestrator', 'opened', 'session board, T4');
  const second = noticeOf(20, FROM_TWO, 'orchestrator', 'waiting', 'on the gate of JH 3');
  const older = boardOf(channelWith([first]));
  const failed = boardOf(channelWith([], { unavailable: 'EBUSY' }));
  const kept = lib.watchBaseline(older, failed);
  assert.deepEqual(kept.channel, older.channel);
  assert.equal(lib.boardChanges(kept, boardOf(channelWith([first, second]))).length, 1);
  assert.deepEqual(lib.watchBaseline(older, boardOf(channelWith([first, second]))).channel.noticeCount, 2);
  assert.equal('channel' in lib.watchBaseline(boardOf(), boardOf()), false, 'a board without a channel gains none');
});

const channelSection = (parts) => {
  const lines = lib.renderBoard({ ...BOARD, ...parts }, { now: NOW });
  const start = lines.indexOf('Channel');
  return start === -1 ? null : lines.slice(start, lines.indexOf('', start));
};

test('renderBoard prints the channel after the roster: the last notices of the record, who to whom, then the last messages between sessions', () => {
  const notices = [
    noticeOf(900, FROM_TWO, 'orchestrator', 'opened', 'session board, T4'),
    noticeOf(800, { id: A, title: 'JH ORQ · proj', context: { tokens: 200000, percent: 40 } }, 2, 'answer', 'A, as automatic as possible', { transcript: '1d16beeb', line: 406 }),
    noticeOf(400, {}, 'orchestrator', 'note', 'y'.repeat(200)),
    noticeOf(300, { id: C }, 5, 'closed', 'delivered'),
  ];
  const sessions = talking();
  const board = { sessions, roster: lib.rosterOf(sessions), channel: lib.channelOf(recordOf(notices, { skipped: 1 }), sessions, { count: 3 }) };
  assert.deepEqual(channelSection(board), [
    'Channel',
    '  H:\\.js-harness\\channel\\D--proj.jsonl  4 notices, the last 3:',
    '  | 13m ago  JH ORQ · proj (40% of its context) to work 2  answer  A, as automatic as possible  (the user\'s words: transcript 1d16beeb, line 406)',
    `  | 6m ago  a sender the host does not name to orchestrator  note  ${'y'.repeat(159)}…`,
    '  | 5m ago  session cccccccc to work 5  closed  delivered',
    '  1 line of the record is neither a notice nor a reading: skipped',
    '  5 messages between sessions in the transcripts of the window, the last 3:',
    '  | 1m ago  JH ORQ · proj to JH 9 · nobody  not seen in a transcript of the window',
    '  | 1m ago  JH ORQ · proj to JH 9 · nobody  failed  "again"',
    '  | 50s ago  JH 7 · outside to JH ORQ · proj  arrived',
    `  ${lib.CHANNEL_NOT_KNOWN}`,
  ]);
  const lines = lib.renderBoard({ ...BOARD, ...board }, { now: NOW });
  assert.ok(lines.indexOf('Roster') < lines.indexOf('Channel') && lines.indexOf('Channel') < lines.indexOf('Worktrees'));
  assert.match(lib.CHANNEL_NOT_KNOWN, /never the user's word/);
  // A message that arrived where its address no longer is: the title was handed over, or it went by a session's own address.
  const moved = [member(A, 'JH ORQ relevada · proj', 60, { received: [RECEIVED(30, 'JH 2 · the board', 'm5')] }), member(B, 'JH 2 · the board', 40, { sent: [SENT(31, 'JH ORQ · proj', 'm5', { summary: 'closed' }), SENT(20, 'uds:made-up', 'm6', { toKind: 'session' })] }), member(C, null, 10, { titleSource: null, received: [RECEIVED(19, 'JH 2 · the board', 'm6')] })];
  assert.deepEqual(channelSection({ sessions: moved, channel: lib.channelOf(recordOf(), moved) }), [
    'Channel',
    '  2 messages between sessions in the transcripts of the window:',
    '  | 31s ago  JH 2 · the board to JH ORQ · proj  arrived at JH ORQ relevada · proj  "closed"',
    '  | 20s ago  JH 2 · the board to uds:made-up  arrived at session cccccccc',
    `  ${lib.CHANNEL_NOT_KNOWN}`,
  ]);
});

// odd/tasks/wake-and-flag.md, T1: the board names the pull request a ready notice is for.
test('renderBoard names the pull request of a ready notice', () => {
  const ready = { ...noticeOf(60, FROM_TWO, 'orchestrator', 'ready', 'T3 is ready'), pr: 344 };
  assert.deepEqual(channelSection({ channel: lib.channelOf(recordOf([ready]), []) }), [
    'Channel',
    '  H:\\.js-harness\\channel\\D--proj.jsonl  1 notice:',
    '  | 1m ago  JH 2 · the board to orchestrator  ready for pull request 344  T3 is ready',
    `  ${lib.CHANNEL_NOT_KNOWN}`,
  ]);
});

test('renderBoard prints no channel when there is nothing to show, and says so when the record could not be read', () => {
  assert.equal(channelSection({}), null, 'a board that was given none');
  assert.equal(channelSection({ channel: lib.channelOf(recordOf(), []) }), null, 'no record yet, and no message');
  assert.deepEqual(channelSection({ channel: lib.channelOf(recordOf([], { unavailable: 'EACCES' }), []) }), ['Channel', '  H:\\.js-harness\\channel\\D--proj.jsonl  unavailable: EACCES', `  ${lib.CHANNEL_NOT_KNOWN}`]);
  assert.deepEqual(channelSection({ channel: lib.channelOf(recordOf([noticeOf(60, FROM_TWO, 'orchestrator', 'note', 'one')]), []) }), [
    'Channel',
    '  H:\\.js-harness\\channel\\D--proj.jsonl  1 notice:',
    '  | 1m ago  JH 2 · the board to orchestrator  note  one',
    `  ${lib.CHANNEL_NOT_KNOWN}`,
  ]);
  assert.deepEqual(channelSection({ channel: lib.channelOf(recordOf([], { skipped: 3 }), []) }), ['Channel', '  H:\\.js-harness\\channel\\D--proj.jsonl  no notice', '  3 lines of the record are neither a notice nor a reading: skipped', `  ${lib.CHANNEL_NOT_KNOWN}`]);
});

test('renderBoard: a row of the roster says what the record says of its session, and from where its notices were written', () => {
  const sessions = [member(A, 'JH ORQ · proj', 60), member(B, 'JH 2 · the board', 120, { self: true }), member(C, 'JH 3 · the lock', 180), member(D, 'JH 4 · the roster', 240), member('eeeeeeee-5555', 'JH 6 · from the phone', 30, { titleSource: 'reading' })];
  const notices = [
    noticeOf(900, { id: B }, 'orchestrator', 'opened', 'session board, T4', { worktree: 'D:\\proj-worktrees\\board', branch: 'feat/board' }),
    noticeOf(700, { id: C }, 'orchestrator', 'waiting', `on the gate of JH 2 ${'z'.repeat(200)}`, { worktree: 'D:\\proj-worktrees\\lock', branch: null }),
    noticeOf(3600, { id: D }, 'orchestrator', 'closed', 'delivered; nothing more goes to this session'),
    noticeOf(1800, { id: A }, 'orchestrator', 'relieved', 'JH ORQ nueva · proj has the role now', { worktree: 'D:\\proj', branch: 'main' }),
    noticeOf(600, { id: B }, 'orchestrator', 'closed', 'delivered', { worktree: 'D:\\proj-worktrees\\board', branch: 'feat/board' }),
  ];
  const section = rosterSection(sessions, { record: recordOf(notices) });
  assert.deepEqual(section.slice(1, -1), [
    '  orchestrator  JH ORQ · proj  relieved 30m ago, last entry 1m ago',
    '    mode bypassPermissions  folder D:\\proj  branch main  transcript aaaaaaaa',
    '    opened unknown  where unknown  effort unknown',
    '    record: relieved 30m ago: JH ORQ nueva · proj has the role now  notices written from D:\\proj on main',
    '  work 2  JH 2 · the board  this session, closed 10m ago, last entry 2m ago',
    '    mode bypassPermissions  folder D:\\proj  branch main  transcript bbbbbbbb',
    '    opened unknown  where unknown  effort unknown',
    '    record: closed 10m ago: delivered  notices written from D:\\proj-worktrees\\board on feat/board',
    '  work 3  JH 3 · the lock  silent since 3m ago',
    '    mode bypassPermissions  folder D:\\proj  branch main  transcript cccccccc',
    '    opened unknown  where unknown  effort unknown',
    `    record: waiting since 11m ago: on the gate of JH 2 ${'z'.repeat(139)}…  notices written from D:\\proj-worktrees\\lock, no branch read`,
    '  work 4  JH 4 · the roster  closed 1h 00m ago, last entry 4m ago',
    '    mode bypassPermissions  folder D:\\proj  branch main  transcript dddddddd',
    '    opened unknown  where unknown  effort unknown',
    '    record: closed 1h 00m ago: delivered; nothing more goes to this session',
    '  work 6  JH 6 · from the phone  silent since 30s ago',
    '    mode bypassPermissions  folder D:\\proj  branch main  transcript eeeeeeee  title from the opening it read',
    '    opened unknown  where unknown  effort unknown',
  ]);
  assert.match(lib.ROSTER_NOT_KNOWN, /one session the app restarted or several sessions under one title/);
  assert.match(lib.ROSTER_NOT_KNOWN, /unless a notice of the session says it/);
});

// odd/tasks/session-close.md, T3: a session that closed with its summary waits for the lead to read it and archive it.
test('renderBoard lists to archive each session that closed with its summary and that the app does not say is archived', () => {
  const sessions = [member(A, 'JH ORQ · proj', 60), member(B, 'JH 2 · the board', 120), member(C, 'JH 3 · the lock', 180), member(D, 'JH 4 · the roster', 240), member('eeeeeeee-5555', 'JH 5 · the wait', 30)];
  const notices = [
    noticeOf(600, { id: B }, 'orchestrator', 'closed', 'delivered', { summary: 'docs/sessions/2026-01-01-jh-2-the-board.md' }),
    noticeOf(700, { id: C }, 'orchestrator', 'closed', 'delivered', { summary: 'docs/sessions/2026-01-01-jh-3-the-lock.md' }),
    // Closed before summaries existed: the board has nothing to point the lead at.
    noticeOf(3600, { id: D }, 'orchestrator', 'closed', 'delivered; nothing more goes to this session'),
    // Closed with a summary, then opened again: its last word is no close.
    noticeOf(900, { id: 'eeeeeeee-5555' }, 'orchestrator', 'closed', 'delivered', { summary: 'docs/sessions/2026-01-01-jh-5-the-wait.md' }),
    noticeOf(300, { id: 'eeeeeeee-5555' }, 'orchestrator', 'opened', 'the next feature'),
  ];
  const app = new Map([[B, inSessions()], [C, inSessions({ where: 'archived', archived: true })]]);
  const section = rosterSection(sessions, { record: recordOf(notices), app });
  assert.deepEqual(section.filter((line) => line.includes('to archive')), ['  to archive: JH 2 · the board, closed 10m ago: read docs/sessions/2026-01-01-jh-2-the-board.md, then archive it']);
  assert.ok(section.indexOf('  to archive: JH 2 · the board, closed 10m ago: read docs/sessions/2026-01-01-jh-2-the-board.md, then archive it') < section.indexOf(`  ${lib.ROSTER_NOT_KNOWN}`));
});

// T12 of odd/tasks/harness-review.md: JH 20 closed at 01:14Z, yet its host process ran on and the app refused to archive it.
test('hostsOf reads the session a Claude Code host runs from its --resume argument, and nothing from other processes', () => {
  const processes = [
    { pid: 6656, createdAt: Date.parse(before(7200)), commandLine: `C:\\claude-code\\claude.exe --output-format stream-json --resume=${A.toUpperCase()} --allowedTools=x` },
    { pid: 7000, createdAt: null, commandLine: `/usr/bin/claude --resume ${B} --verbose` },
    { pid: 7100, createdAt: null, commandLine: 'C:\\Claude.exe --type=renderer --user-data-dir=C:\\Claude' },
    { pid: 7200, createdAt: null, commandLine: 'node bin/check.mjs' },
  ];
  assert.deepEqual(lib.hostsOf(processes), [
    { pid: 6656, createdAt: Date.parse(before(7200)), sessionId: A },
    { pid: 7000, createdAt: null, sessionId: B },
  ]);
});

test('hostsOf counts only a process whose executable is claude, so a wrapper that passes --resume on is not named', () => {
  const processes = [
    { pid: 8000, createdAt: null, commandLine: `"C:\\Program Files\\Claude Code\\claude.exe" --resume=${A}` },
    { pid: 8100, createdAt: null, commandLine: `node C:\\tools\\wrapper.js --resume=${B}` },
    { pid: 8200, createdAt: null, commandLine: `cmd.exe /c claude --resume ${C}` },
    { pid: 8300, createdAt: null, commandLine: `/opt/claudette/bin/runner --resume ${D}` },
  ];
  assert.deepEqual(lib.hostsOf(processes), [{ pid: 8000, createdAt: null, sessionId: A }]);
});

test('renderBoard flags a session that closed or was relieved while its host process still runs, until the app archives it', () => {
  const sessions = [member(A, 'JH ORQ · proj', 60, { self: true }), member(B, 'JH 2 · the board', 120), member(C, 'JH 3 · the lock', 180), member(D, 'JH 4 · the roster', 240), member('eeeeeeee-5555', 'JH 5 · the wait', 30)];
  const notices = [
    noticeOf(600, { id: B }, 'orchestrator', 'closed', 'delivered', { summary: 'docs/sessions/2026-01-01-jh-2-the-board.md' }),
    noticeOf(700, { id: C }, 'orchestrator', 'closed', 'delivered'),
    noticeOf(800, { id: D }, 'orchestrator', 'relieved', 'JH ORQ · proj has the role now'),
    // Its host runs, and it never closed: a live session.
    noticeOf(900, { id: 'eeeeeeee-5555' }, 'orchestrator', 'opened', 'the next feature'),
  ];
  const hosts = { items: [
    { pid: 4242, createdAt: Date.parse(before(7200)), sessionId: B },
    { pid: 4343, createdAt: null, sessionId: C },
    { pid: 4444, createdAt: Date.parse(before(3600)), sessionId: D },
    { pid: 4545, createdAt: Date.parse(before(3600)), sessionId: 'eeeeeeee-5555' },
    { pid: 4646, createdAt: Date.parse(before(3600)), sessionId: A },
  ] };
  const app = new Map([[D, inSessions({ where: 'archived', archived: true })]]);
  const section = rosterSection(sessions, { record: recordOf(notices), app, hosts });
  assert.deepEqual(section.filter((line) => line.includes('still running')), [
    '  closed but still running: JH 2 · the board, closed 10m ago, host process pid 4242 started 2h 00m ago: the app refuses to archive it while that process runs; stop its turn, or end that process, then archive it',
    '  closed but still running: JH 3 · the lock, closed 11m ago, host process pid 4343 started at an unknown time: the app refuses to archive it while that process runs; stop its turn, or end that process, then archive it',
  ]);
  const roster = lib.rosterOf(sessions, { record: recordOf(notices), app, hosts });
  assert.deepEqual(roster.rows.find((row) => row.title === 'JH 2 · the board').host, { pid: 4242, createdAt: Date.parse(before(7200)) });
  assert.equal(roster.rows.find((row) => row.title === 'JH 5 · the wait').host.pid, 4545);
  // No host listed for a row: no host, and no line.
  assert.equal(lib.rosterOf(sessions, { record: recordOf(notices), app, hosts: { items: [] } }).rows.every((row) => row.host === null), true);
});

test('renderBoard says when the host processes could not be read, and only where a closed session could be still running', () => {
  const sessions = [member(A, 'JH ORQ · proj', 60, { self: true }), member(B, 'JH 2 · the board', 120)];
  const closed = [noticeOf(600, { id: B }, 'orchestrator', 'closed', 'delivered')];
  const unread = { unavailable: 'the listing did not finish' };
  assert.deepEqual(rosterSection(sessions, { record: recordOf(closed), hosts: unread }).filter((line) => line.includes('host processes')), [
    '  host processes not read (the listing did not finish): a closed session whose process still runs is not flagged',
  ]);
  assert.equal(lib.rosterOf(sessions, { record: recordOf(closed), hosts: unread }).hostsUnavailable, 'the listing did not finish');
  assert.deepEqual(rosterSection(sessions, { record: recordOf([]), hosts: unread }).filter((line) => line.includes('host processes')), []);
});

// Failure 8 of 2026-10-10 (odd/tasks/rule-hierarchy.md): stopped tasks and archived sessions printed as
// live. No transcript says that a session was archived; a session that wrote `closed`, or that was
// relieved, said so itself, and its line no longer reads as one that works or waits.
test('renderBoard: a stopped task reads as stopped, and a session that closed or was relieved no longer reads as live', () => {
  const work = (id, more) => ({ tool: 'Bash', kind: null, id, description: 'Watch the board', launchedAt: before(3600), ended: false, ...more });
  const sessions = [
    seen(A, 'waiting', { title: 'JH 1 · the lock', titleSource: 'custom-title', cwd: 'D:\\proj', gitBranch: 'main', skippedLines: 0, work: [work('b1', { ended: true, endedAt: before(300), status: 'stopped' })], tail: [] }),
    seen(B, 'background', { title: 'JH 2 · the board', titleSource: 'custom-title', cwd: 'D:\\proj', gitBranch: 'main', skippedLines: 0, work: [work('b2', { file: { path: 'x', modifiedAt: before(30) } })], tail: [] }),
    seen(C, 'working', { title: 'JH ORQ relevada · proj', titleSource: 'custom-title', cwd: 'D:\\proj', gitBranch: 'main', skippedLines: 0, tail: [] }),
    seen(D, 'waiting', { title: 'JH 4 · still here', titleSource: 'custom-title', cwd: 'D:\\proj', gitBranch: 'main', skippedLines: 0, tail: [] }),
  ];
  const notices = [noticeOf(1200, { id: B }, 'orchestrator', 'closed', 'delivered'), noticeOf(900, { id: C }, 'orchestrator', 'relieved', 'JH ORQ · proj has the role now'), noticeOf(800, { id: D }, 'orchestrator', 'closed', 'delivered'), noticeOf(700, { id: D }, 'orchestrator', 'opened', 'a second feature')];
  const lines = lib.renderBoard({ ...BOARD, sessions, roster: lib.rosterOf(sessions, { record: recordOf(notices) }) }, { now: NOW });
  const firstLines = lines.filter((line) => /^[0-9a-f]{8} {2}/.test(line));
  assert.deepEqual(firstLines, [
    'aaaaaaaa  waiting  JH 1 · the lock  last entry 10m ago',
    'bbbbbbbb  closed 20m ago by its own notice (its transcript: background)  JH 2 · the board  last entry 10m ago',
    'cccccccc  relieved 15m ago by its own notice (its transcript: working)  JH ORQ relevada · proj  last entry 10m ago',
    'dddddddd  waiting  JH 4 · still here  last entry 10m ago',
  ]);
  assert.ok(lines.includes('  work: 0 with no recorded end, 1 ended (last: Bash "Watch the board" stopped 5m ago)'));
  // A board without a roster, or without a record, prints its sessions as before.
  assert.equal(lib.renderBoard({ ...BOARD, sessions }, { now: NOW }).filter((line) => / by its own notice /.test(line)).length, 0);
});

// Session channel, (b2) part 1: a row says a tool call with no result once it passes the limit, while the session
// works and has not closed. A question is in "Open questions", and a subagent that writes is at work.
test('renderBoard says a tool call with no result for the limit under its row, and only while the session works and has not closed', () => {
  const said = (session, more = {}) => lib.renderBoard({ ...BOARD, sessions: [session], ...more }, { now: NOW }).filter((line) => line.includes(' call has had no result for '));
  const bash = { tool: 'Bash', at: before(1000) };
  assert.deepEqual(said(seen(A, 'working', { pendingCall: bash })), ['  a Bash call has had no result for 16m: the host may be holding it for approval, or it hangs']);
  assert.deepEqual(said(seen(A, 'working', { pendingCall: { tool: 'Bash', at: before(600) } })), [], 'below the limit');
  assert.deepEqual(said(seen(A, 'working')), [], 'with no call left open');
  assert.deepEqual(said(seen(A, 'waiting', { pendingCall: bash })), [], 'a session that is not working');
  assert.deepEqual(said(seen(A, 'working', { pendingCall: { tool: 'AskUserQuestion', at: before(1000) } })), [], 'a question is in Open questions');
  const agent = { id: 'toolu_a', tool: 'Agent', at: before(1000) };
  const subagent = (modifiedAt) => [{ tool: 'Agent', kind: 'Explore', toolUseId: 'toolu_a', id: null, description: 'Look', launchedAt: before(1000), ended: false, file: { path: 'x', modifiedAt } }];
  assert.deepEqual(said(seen(A, 'working', { pendingCall: agent, work: subagent(before(30)) })), [], 'a subagent that writes is at work');
  assert.deepEqual(said(seen(A, 'working', { pendingCall: agent, work: subagent(before(1000)) })), ['  an Agent call has had no result for 16m: the host may be holding it for approval, or it hangs'], 'a silent subagent is said past the limit');
  // A session its record says closed says so, and its call is not said as held.
  const closing = seen(C, 'working', { title: 'JH 3 · closed', titleSource: 'custom-title', cwd: 'D:\\proj', gitBranch: 'main', skippedLines: 0, pendingCall: bash, tail: [] });
  assert.equal(said(closing).length, 1, 'said without a record that closed it');
  assert.deepEqual(said(closing, { roster: lib.rosterOf([closing], { record: recordOf([noticeOf(900, { id: C }, 'orchestrator', 'closed', 'delivered')]) }) }), [], 'not once the session closed');
});

// Failure 7 of 2026-10-10: a process that waited for a free machine could not be attributed from the
// board, which printed neither its owner nor its pid. A wait is a gate in line for the machine's gate
// lock (`check`, or `js-harness gate -- <command>`); its line has the pid, the folder it waits in, and
// the session of the roster whose notices were written from that folder, or that was opened in it.
test('renderBoard: each gate that waits is printed with the session it hangs from, by the folder it waits in', () => {
  const sessions = [
    member(A, 'JH ORQ · proj', 60),
    member(B, 'JH 2 · the board', 120),
    member(C, 'JH 3 · the lock', 180, { cwd: 'D:\\proj-worktrees\\lock', gitBranch: 'feat/lock' }),
    member(D, 'JH 4 · the roster', 240),
  ];
  const notices = [noticeOf(900, { id: B }, 'orchestrator', 'opened', 'session board', { worktree: 'D:\\proj-worktrees\\board', branch: 'feat/board' }), noticeOf(600, { id: B }, 'orchestrator', 'waiting', 'on the gate of JH 3', { worktree: 'D:\\proj-worktrees\\board', branch: 'feat/board' })];
  const waiter = (pid, folder, seconds) => ({ pid, cwd: folder, command: 'check', waitingSince: before(seconds) });
  const lock = { gateLock: { available: true, holder: holds(4242, 'D:\\elsewhere'), waiters: [waiter(4250, 'D:\\proj-worktrees\\board', 120), waiter(4260, 'D:\\proj-worktrees\\lock', 60), waiter(4270, 'D:\\proj', 30)] } };
  const section = (roster) => {
    const lines = lib.renderBoard({ ...BOARD, sessions, ...(roster && { roster }), gates: { available: true, items: [] }, ...lock }, { now: NOW });
    return lines.slice(lines.indexOf('Gates') + 1, lines.indexOf('Pull requests') - 1).map((line) => line.split('  ').slice(1, 5));
  };
  assert.deepEqual(section(lib.rosterOf(sessions, { record: recordOf(notices) })), [
    ['pid 4242', 'D:\\elsewhere', 'running, took the gate lock 2m ago', 'session not known: no row of the roster is in this folder'],
    // Two waits, each with its session: one by the worktree its notices were written from, one by the folder its transcript records.
    ['pid 4250', 'D:/proj-worktrees/board', 'waiting for the gate of pid 4242, began 2m ago', 'session JH 2 · the board (its notices were written from this folder)'],
    ['pid 4260', 'D:\\proj-worktrees\\lock', 'waiting for the gate of pid 4242, began 1m ago', 'session JH 3 · the lock (its transcript records this folder)'],
    // The main checkout is where two sessions were opened and none says it works: one of them, not known which.
    // JH 2 was opened there too, and is left out: its notices say where it works.
    ['pid 4270', 'D:/proj', 'waiting for the gate of pid 4242, began 30s ago', 'one of 2 sessions whose transcripts record this folder: JH ORQ · proj, JH 4 · the roster'],
  ]);
  // The waits a session's notices tell of are in its row of the roster, so they hang from it as well.
  const roster = rosterSection(sessions, { record: recordOf(notices) });
  assert.deepEqual(roster.filter((line) => line.includes('waiting since')), ['    record: waiting since 10m ago: on the gate of JH 3  notices written from D:\\proj-worktrees\\board on feat/board']);
  // A gate whose folder is not known, and a board with no roster, which prints its gates as before.
  const unplaced = lib.renderBoard({ ...BOARD, sessions, roster: lib.rosterOf(sessions) }, { now: NOW }).find((line) => line.startsWith('  pid 77  '));
  assert.equal(unplaced.split('  ')[4], 'session not known: the gate names no folder');
  assert.deepEqual(section(null)[1], ['pid 4250', 'D:/proj-worktrees/board', 'waiting for the gate of pid 4242, began 2m ago', 'check (no process of the listing has this pid)']);
});

// odd/tasks/gate-first.md, T4: a ticket cannot be made impossible to write, so it is made seen. The board prints
// each open ticket with who issued it, flags one whose issuer is not the orchestrator, and says of a gate of the
// lock that went first by a ticket which one and why.
test('readGateLock carries the ticket a gate of the lock went first by, and nothing for a gate without one', () => {
  const holder = { token: '11-aaaaaaaaaaaa', pid: 11, cwd: 'D:\\a', command: 'check', startedAt: before(170), beatAt: NOW - 2000, stale: false, first: '0a0a0a0a', firstReason: 'the fix of main' };
  const waiter = { token: '22-bbbbbbbbbbbb', pid: 22, cwd: 'D:\\b', command: 'check', waitingSince: before(60), first: '0b0b0b0b', firstReason: null };
  const read = lib.readGateLock(() => ({ holder, waiters: [waiter, { pid: 33, cwd: 'D:\\c', command: 'check', waitingSince: before(30) }] }));
  assert.deepEqual([read.holder.first, read.holder.firstReason], ['0a0a0a0a', 'the fix of main']);
  assert.deepEqual([read.waiters[0].first, read.waiters[0].firstReason], ['0b0b0b0b', null]);
  assert.equal('first' in read.waiters[1], false);
});

test('renderBoard: the gates of the lock that went first say by which ticket and why, and the open tickets are printed with their issuer, flagged when that is not the orchestrator', () => {
  const sessions = [member(A, 'JH ORQ · proj', 60), member(B, 'JH 2 · the board', 120)];
  const roster = lib.rosterOf(sessions);
  const ticket = (id, more = {}) => ({ id, session: B, reason: 'his fix waits on it', by: A, issuedAt: before(300), until: before(-1800), ...more });
  const lock = { gateLock: { available: true, holder: holds(4242, 'D:\\proj', { first: '0a0a0a0a', firstReason: 'the batch of main' }), waiters: [{ ...waits(4250, 'D:\\proj', 50), first: '0b0b0b0b', firstReason: null }] } };
  const section = (parts) => {
    const lines = lib.renderBoard({ ...BOARD, sessions, roster, gates: { available: true, items: [] }, ...lock, ...parts }, { now: NOW });
    return lines.slice(lines.indexOf('Gates') + 1, lines.indexOf('Pull requests') - 1);
  };
  const states = section({}).map((line) => line.split('  ')[3]);
  assert.deepEqual(states, ['running, took the gate lock 2m ago, first by ticket 0a0a0a0a: the batch of main', 'waiting for the gate of pid 4242, began 50s ago, first by ticket 0b0b0b0b: no reason read']);

  const tickets = section({ gateTickets: { available: true, open: [ticket('0c0c0c0c', { tree: 'D:\\proj-worktrees\\board' }), ticket('0d0d0d0d', { by: B, session: A })], unreadable: ['0e0e0e0e.json'] } }).slice(2);
  assert.deepEqual(tickets, [
    '  ticket 0c0c0c0c  the next check of JH 2 · the board in D:\\proj-worktrees\\board goes first, for 30m more: his fix waits on it  issued by JH ORQ · proj',
    '  ticket 0d0d0d0d  the next check of JH ORQ · proj goes first, for 30m more: his fix waits on it  issued by JH 2 · the board, which is not the orchestrator',
    '  ticket file 0e0e0e0e.json could not be read as a ticket, so no gate claims it',
  ]);
  // An issuer the ticket does not name, or one no row of the roster is, is not known to be the orchestrator.
  const [unnamed, unknown] = section({ gateTickets: { available: true, open: [ticket('0c0c0c0c', { by: undefined }), ticket('0d0d0d0d', { by: 'ffffffff-0000-0000-0000-000000000000', session: 'ffffffff-1111' })], unreadable: [] } }).slice(2);
  assert.equal(unnamed.split('  ').at(-1), 'issued by a session the ticket does not name, so not known to be the orchestrator');
  assert.equal(unknown, '  ticket 0d0d0d0d  the next check of session ffffffff goes first, for 30m more: his fix waits on it  issued by session ffffffff, on no row of the roster, so not known to be the orchestrator');
  // None open says nothing; a folder that cannot be read says why.
  assert.deepEqual(section({ gateTickets: { available: true, open: [], unreadable: [] } }).length, 2);
  assert.deepEqual(section({ gateTickets: { available: false, reason: 'the gate tickets: EACCES' } }).slice(2), ['  unavailable: the gate tickets: EACCES']);
});

test('readGateTickets gives the open tickets and the unreadable files, and the reason when the folder cannot be read', () => {
  const open = [{ id: '0a0a0a0a', session: 's', reason: 'r', by: null, issuedAt: before(10), until: before(-10) }];
  assert.deepEqual(lib.readGateTickets(() => ({ open, expired: [{ id: 'x' }], unreadable: ['bad.json'] })), { available: true, open, unreadable: ['bad.json'] });
  const noAccess = () => {
    throw new Error('EACCES: permission denied');
  };
  assert.deepEqual(lib.readGateTickets(noAccess), { available: false, reason: 'the gate tickets: EACCES: permission denied' });
});

// --- `sessions --quote`: whose words a line of a transcript holds ---
//
// The shapes are from a tally of this project's transcripts (2026-10-11, keys and values only, 14,878
// `user` entries): what the person sends has `origin.kind: "human"` (583); a message from another session
// `"peer"` with `isMeta` (196); a task notification `"task-notification"` (1,036); a tool result, a
// compaction summary and the host's own meta entries record no origin. A paste arrives inside
// `<pasted_content id="…">` and `</pasted_content id="…">` with the same id: 22 entries are that and
// nothing else, 7 have a line typed before it and 1 after it.

const pasted = (text, id = 'be4a') => `<pasted_content id="${id}">\n${text}\n</pasted_content id="${id}">`;

test('quoteOf gives the entry at a line only when it is what the person sent, with its time and its text', () => {
  const lines = [
    { type: 'custom-title', customTitle: 'JH ORQ · proj' },
    { ...prompt('La A, pero lo más automático posible', 5), permissionMode: 'bypassPermissions' },
    reply('Anotado.', 6),
    { ...prompt('', 7), message: { role: 'user', content: [{ type: 'image', source: {} }, { type: 'text', text: 'mirá esto' }, { type: 'text', text: 'y esto' }] } },
  ];
  const text = transcript(...lines);
  assert.deepEqual(lib.quoteOf(text, 2), { person: true, at: at(5), text: 'La A, pero lo más automático posible', images: 0, pastedOnly: false, queued: false });
  assert.deepEqual(lib.quoteOf(text, 4), { person: true, at: at(7), text: 'mirá esto\ny esto', images: 1, pastedOnly: false, queued: false });
  // The same with the line endings of a Windows file.
  assert.equal(lib.quoteOf(text.replace(/\n/g, '\r\n'), 2).text, 'La A, pero lo más automático posible');
});

test('quoteOf says which entry it is when it is not the person\'s: another session, a task, the host, the model, or no entry at all', () => {
  const lines = [
    reply('Anotado.', 1),
    peer(2),
    handback(3),
    injected(4, 'made up'),
    notified({ task: 'b1', status: 'completed' }, 5),
    { type: 'user', ...base(6), isMeta: true, message: { role: 'user', content: 'a reminder of the host' } },
    result('toolu_1', { stdout: '' }, 7),
    { type: 'user', ...base(8), isCompactSummary: true, message: { role: 'user', content: 'a summary' } },
    { ...prompt('in a side chain', 9), isSidechain: true },
    { type: 'user', ...base(10), message: { role: 'user', content: 'from a host that recorded no origin' } },
    { ...prompt('x', 11), origin: { kind: 'something-new' } },
    { type: 'custom-title', customTitle: 'JH ORQ · proj' },
    '{"type":"user","message":{"content":"torn',
    '',
    { ...prompt('x', 12), origin: 'human' },
  ];
  const text = transcript(...lines);
  const said = (line) => lib.quoteOf(text, line);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 99].map((line) => said(line).what), [
    'an assistant entry',
    'a message from another session ("JH 1 · made up")',
    'what a subagent handed back',
    'a message the app put in',
    'a task notification',
    'a meta entry: the host wrote it, not the person',
    'the result of a tool call',
    'a compaction summary',
    'an entry of a side chain',
    'a user entry that records no origin: it cannot be told whose it is',
    'a user entry of origin "something-new"',
    'an entry of type "custom-title"',
    'not an entry: the line does not parse',
    'an empty line',
    'a user entry that records no origin: it cannot be told whose it is',
    'no line of the transcript, which has 15 lines',
    'no line of the transcript, which has 15 lines',
  ]);
  for (const line of [1, 5, 13, 16]) assert.deepEqual(Object.keys(said(line)), ['person', 'what']);
  assert.equal(said(1).person, false);
  assert.equal(lib.quoteOf('', 1).what, 'no line of the transcript, which has 0 lines');
  assert.equal(lib.quoteOf(transcript(reply('x', 1)), 2).what, 'no line of the transcript, which has 1 line');
});

// Review of ce8bdf7, finding 2: line 1.5 passed the range check and then read no line, with a TypeError.
test('quoteOf answers that there is no such line for whatever is not a whole number inside the transcript', () => {
  const text = transcript(prompt('one', 1), prompt('two', 2));
  for (const line of [1.5, 0.5, 2.000001, 0, -1, 3, NaN, Infinity, '2', null, undefined]) {
    assert.deepEqual(lib.quoteOf(text, line), { person: false, what: 'no line of the transcript, which has 2 lines' }, `line ${String(line)}`);
  }
  assert.equal(lib.quoteOf(text, 2).text, 'two');
});

test('quoteOf says when the person\'s entry is only pasted content: nothing typed before it or after it', () => {
  const only = (content) => lib.quoteOf(transcript(prompt(content, 1)), 1).pastedOnly;
  assert.equal(only(`\n\n${pasted('Sos JH 5.\nLeé el documento.')}\n`), true);
  assert.equal(only(`${pasted('one', 'be4a')}\n\n${pasted('two', '7e90')}`), true, 'two pastes and nothing else');
  assert.equal(only(`Dale con esto:\n${pasted('Sos JH 5.')}`), false, 'a line typed before it');
  assert.equal(only(`${pasted('Sos JH 5.')}\nDale.`), false, 'a line typed after it');
  assert.equal(only('Sí'), false);
  assert.equal(only('<pasted_content id="be4a">\nnever closed'), false, 'what is not a whole paste is text');
  assert.equal(only('<pasted_content id="be4a">\nclosed by another\n</pasted_content id="7e90">'), false);
  // The text is given as the transcript has it, wrapper and all: the caller sees what was sent.
  assert.equal(lib.quoteOf(transcript(prompt(pasted('Sos JH 5.'), 1)), 1).text, pasted('Sos JH 5.'));
});

// An answer to a question asked with the host's question tool. The shapes are the results of such calls in
// this project's 57 transcripts (2026-10-12; 53 lines hold answers): a `user` entry with one `tool_result`
// block and a top-level `toolUseResult` of `questions` and `answers`, the answer keyed by the question's text;
// no origin, no `isMeta`. A question he closed has the same shape, with the host's own words in the place of
// the answer and no error mark (4 of the 53 lines): the guard knows those words and refuses them.
const QUESTION = 'Pregunta 10: una sesión abierta desde el teléfono, ¿cómo llega a esfuerzo alto?';
const OPTIONS = ['Que el harness la abra en alto (Recomendado)', 'Subir el ajuste general a alto', 'Dejar como está'];
const asking = (question = QUESTION, more = {}) => ({ question, header: 'Teléfono', multiSelect: false, options: OPTIONS.map((label) => ({ label, description: 'made up' })), ...more });
const asked = (id, minute, questions = [asking()], name = 'AskUserQuestion') => call(id, name, { questions }, minute);
const answered = (id, minute, answers, block = {}) => result(id, { questions: [asking()], answers }, minute, block);
// What the host wrote when he closed a question without answering, as the transcript has it.
const DISMISSED = '[User dismissed — do not proceed, wait for next instruction]';

test('questionPrefix is how the text of a numbered question starts: the word, the number, a colon and one space', () => {
  assert.equal(lib.questionPrefix(7), `${lib.QUESTION_WORD} 7: `);
  assert.equal(lib.questionPrefix(12), 'Pregunta 12: ');
});

test('transcriptNamed gives the one transcript of the sessions folder that a file or an id names, and says why when there is none', () => {
  const dir = nodePath.resolve('made-up', 'projects', 'D--made-up');
  const listed = ['aaaaaaaa-1111.jsonl', 'aaaaaaaa-2222.jsonl', 'bbbbbbbb-3333.jsonl', 'bbbbbbbb-3333', 'notes.txt'];
  const named = (transcript, readdir = () => listed) => lib.transcriptNamed(dir, transcript, { cwd: dir, readdir });
  // A file: only one directly in the folder, with the transcripts' ending; the folder is not listed for it.
  const unread = () => assert.fail('a file is not looked up in the folder');
  assert.deepEqual(named('bbbbbbbb-3333.jsonl', unread), { file: nodePath.join(dir, 'bbbbbbbb-3333.jsonl') });
  assert.deepEqual(named(nodePath.join(dir, 'gone.jsonl'), unread), { file: nodePath.join(dir, 'gone.jsonl') });
  for (const outside of [nodePath.join('bbbbbbbb-3333', 'subagents', 'agent-1.jsonl'), nodePath.join('..', 'other.jsonl'), nodePath.join(dir, 'notes.txt')]) {
    assert.deepEqual(named(outside, unread), { not: 'outside', file: nodePath.resolve(dir, outside) });
  }
  // An id: whole or its start, eight characters or more, naming exactly one transcript.
  assert.deepEqual(named('bbbbbbbb-3333'), { file: nodePath.join(dir, 'bbbbbbbb-3333.jsonl') });
  assert.deepEqual(named('bbbbbbbb'), { file: nodePath.join(dir, 'bbbbbbbb-3333.jsonl') });
  assert.deepEqual(named('aaaaaaaa'), { not: 'several', count: 2 });
  assert.deepEqual(named('cccccccc'), { not: 'none' });
  assert.deepEqual(named('bbbbbbb'), { not: 'short' });
  const refuses = (code) => () => {
    throw Object.assign(new Error('refused'), { code });
  };
  assert.deepEqual(named('bbbbbbbb', refuses('ENOENT')), { not: 'unlisted', code: 'ENOENT' });
  assert.deepEqual(named('bbbbbbbb', refuses('EACCES')), { not: 'unlisted', code: 'EACCES' });
});

test('quoteOf gives his answer to a question the session asked with the host\'s question tool: tapped or typed, with the question and the options shown', () => {
  const typed = 'Corregir el mensaje por que todavia no tenemos produccion';
  const text = transcript(asked('toolu_q1', 1), answered('toolu_q1', 2, { [QUESTION]: OPTIONS[0] }), asked('toolu_q2', 3), answered('toolu_q2', 4, { [QUESTION]: typed }));
  assert.deepEqual(lib.quoteOf(text, 2), {
    person: true,
    at: at(2),
    text: OPTIONS[0],
    images: 0,
    pastedOnly: false,
    queued: false,
    // `askedAt` is when the call was asked: what tells an answer to a question recorded before it from one
    // to a call older than the record's question of the same number.
    answered: { tool: 'AskUserQuestion', askedAt: at(1), answers: [{ question: QUESTION, options: OPTIONS, answer: OPTIONS[0], how: 'tapped' }] },
  });
  const other = lib.quoteOf(text, 4);
  assert.equal(other.answered.askedAt, at(3));
  assert.deepEqual([other.person, other.text, other.answered.answers[0].how], [true, typed, 'typed']);
  // Two questions in one call: an answer each, in the order they were asked; a question that takes several
  // options is tapped when every part of its answer is one of them.
  const second = 'Pregunta 11: ¿y la otra?';
  const both = transcript(
    asked('toolu_q3', 1, [asking(), asking(second, { multiSelect: true })]),
    answered('toolu_q3', 2, { [second]: `${OPTIONS[2]}, ${OPTIONS[0]}`, [QUESTION]: 'algo mío' }),
  );
  const pair = lib.quoteOf(both, 2);
  assert.deepEqual(pair.answered.answers.map(({ question, how }) => [question, how]), [[QUESTION, 'typed'], [second, 'tapped']]);
  assert.equal(pair.text, `algo mío\n${OPTIONS[2]}, ${OPTIONS[0]}`);
  // A label may hold the separator the host joins several with: the answer is tapped when it is labels joined,
  // whichever way they split, and typed when a part of it is no label.
  const colours = ['Rojo, azul', 'Verde', 'Rojo'];
  const several = (answer) => {
    const question = { question: QUESTION, multiSelect: true, options: colours.map((label) => ({ label })) };
    return lib.quoteOf(transcript(asked('toolu_q4', 1, [question]), answered('toolu_q4', 2, { [QUESTION]: answer })), 2).answered.answers[0].how;
  };
  assert.deepEqual(['Rojo, azul, Verde', 'Verde, Rojo, azul', 'Rojo, Verde', 'Rojo, azul', 'Rojo, amarillo', 'Verde, '].map(several), ['tapped', 'tapped', 'tapped', 'tapped', 'typed', 'typed']);
  // Labels that are joins of each other divide an answer in a number of ways that doubles with its length:
  // each place a label may begin is looked at once, so a long answer that is no join is told at once too. The
  // hook that reads the stretch before a compaction has seconds, and the labels are what a session wrote.
  const doubling = { question: QUESTION, multiSelect: true, options: ['a', 'a, a'].map((label) => ({ label })) };
  const long = `${'a, '.repeat(60)}b`;
  const began = Date.now();
  const told = lib.quoteOf(transcript(asked('toolu_q5', 1, [doubling]), answered('toolu_q5', 2, { [QUESTION]: long })), 2).answered.answers[0].how;
  assert.deepEqual([told, Date.now() - began < 2000], ['typed', true]);
  // The tools that ask, and what a host writes for a closed question, are lists and not words in the code: a
  // host that names its tool otherwise, or closes a question in other words, is one more line of them.
  assert.deepEqual(lib.QUESTION_TOOLS, ['AskUserQuestion']);
  assert.deepEqual(lib.QUESTION_DISMISSED, ['[User dismissed']);
});

test('quoteOf refuses the result of a tool call that is no answer of his, and says which it is', () => {
  const good = { [QUESTION]: OPTIONS[0] };
  const refusal = (...entries) => {
    const text = transcript(...entries);
    return lib.quoteOf(text, entries.length);
  };
  const cases = [
    // No call of that id in the transcript: nothing says a question was asked.
    ['the result of a tool call', [answered('toolu_q1', 1, good)]],
    // Another tool, whatever its result is shaped like; a server's tool that only ends in the name.
    ['the result of a tool call', [asked('toolu_q1', 1, [asking()], 'Bash'), answered('toolu_q1', 2, good)]],
    ['the result of a tool call', [asked('toolu_q1', 1, [asking()], 'mcp__made_up__AskUserQuestion'), answered('toolu_q1', 2, good)]],
    // The call of another question: the id is what pairs them.
    ['the result of a tool call', [asked('toolu_other', 1), answered('toolu_q1', 2, good)]],
    // Two results in one entry: which of them the line means is not said.
    ['the result of a tool call', [asked('toolu_q1', 1), { ...answered('toolu_q1', 2, good), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_q1', content: 'ok' }, { type: 'tool_result', tool_use_id: 'toolu_x', content: 'ok' }] } }]],
    // A question he did not answer: the host marked the result an error, or it holds no answers.
    ['the result of a question the person did not answer', [asked('toolu_q1', 1), answered('toolu_q1', 2, good, { is_error: true })]],
    ['the result of a question the person did not answer', [asked('toolu_q1', 1), result('toolu_q1', 'User dismissed the question', 2)]],
    ['the result of a question the person did not answer', [asked('toolu_q1', 1), result('toolu_q1', { questions: [asking()] }, 2)]],
    ['the result of a question the person did not answer', [asked('toolu_q1', 1), answered('toolu_q1', 2, { [QUESTION]: '   ' })]],
    ['the result of a question the person did not answer', [asked('toolu_q1', 1), answered('toolu_q1', 2, { [QUESTION]: ['a list'] })]],
    // A question he closed: the host writes its own words in the place of the answer, in a result it does not
    // mark an error (line 8431 of a transcript of this project, 2026-10-12). One closed question closes the call.
    ['the result of a question the person closed without answering', [asked('toolu_q1', 1), answered('toolu_q1', 2, { [QUESTION]: DISMISSED })]],
    ['the result of a question the person closed without answering', [asked('toolu_q1', 1, [asking(), asking('Pregunta 11: ¿y la otra?')]), answered('toolu_q1', 2, { ...good, 'Pregunta 11: ¿y la otra?': DISMISSED })]],
    // Answers that are not for what was asked: one question of the call has none, or one is for another question.
    ['the result of a question the person did not answer', [asked('toolu_q1', 1, [asking(), asking('Pregunta 11: ¿y la otra?')]), answered('toolu_q1', 2, good)]],
    ['the result of a question whose answers are not for what was asked', [asked('toolu_q1', 1), answered('toolu_q1', 2, { ...good, 'Otra pregunta': 'sí' })]],
    // A call that asks nothing a person could answer.
    ['the result of a question whose call holds no question', [asked('toolu_q1', 1, []), answered('toolu_q1', 2, good)]],
    ['the result of a question whose call holds no question', [asked('toolu_q1', 1, [{ header: 'x' }]), answered('toolu_q1', 2, good)]],
    // A side chain asks nobody: its call, or its result.
    ['an entry of a side chain', [{ ...asked('toolu_q1', 1), isSidechain: true }, answered('toolu_q1', 2, good)]],
    ['an entry of a side chain', [asked('toolu_q1', 1), { ...answered('toolu_q1', 2, good), isSidechain: true }]],
    // What the host marks as its own, or as another's, is not his whatever it holds.
    ['the result of a tool call', [asked('toolu_q1', 1), { ...answered('toolu_q1', 2, good), isMeta: true }]],
    ['the result of a tool call', [asked('toolu_q1', 1), { ...answered('toolu_q1', 2, good), isCompactSummary: true }]],
    ['the result of a tool call', [asked('toolu_q1', 1), { ...answered('toolu_q1', 2, good), origin: { kind: 'peer', name: 'JH 1 · made up' } }]],
  ];
  for (const [what, entries] of cases) assert.deepEqual(refusal(...entries), { person: false, what }, `${what}: ${JSON.stringify(entries.at(-1)).slice(0, 160)}`);
  // The call is found wherever it is in the file: a transcript re-writes old entries, so its order is no proof.
  assert.equal(lib.quoteOf(transcript(answered('toolu_q1', 1, good), asked('toolu_q1', 2)), 1).person, true);
});

test('sessionFacts lists each question the transcript put to the person once, with what became of it', () => {
  const second = 'Pregunta 11: ¿y la otra?';
  const entries = [
    prompt('typed', 1),
    asked('toolu_q1', 2),
    answered('toolu_q1', 3, { [QUESTION]: OPTIONS[1] }),
    asked('toolu_q2', 4, [asking(second)]),
    result('toolu_q2', { questions: [asking(second)], answers: { [second]: DISMISSED } }, 5),
    asked('toolu_q3', 6),
    answered('toolu_q3', 7, { [QUESTION]: OPTIONS[0] }, { is_error: true }),
    asked('toolu_q4', 8, [asking(), asking(second)]),
    // Not questions to him: another tool, and a side chain's call.
    asked('toolu_b1', 9, [asking()], 'Bash'),
    { ...asked('toolu_q5', 10), isSidechain: true },
    // The host writes old entries again: a call and its answer a second time are the same question.
    asked('toolu_q1', 2),
    answered('toolu_q1', 3, { [QUESTION]: OPTIONS[1] }),
  ];
  // Each question names the line of its call, and an answered one the line of its answer: the first of each, as
  // the host wrote the call again at line 11 and its answer at line 12.
  assert.deepEqual(lib.sessionFacts(transcript(...entries)).questions, [
    { id: 'toolu_q1', at: at(2), asked: [QUESTION], state: 'answered', answeredAt: at(3), line: 2, answeredLine: 3 },
    { id: 'toolu_q2', at: at(4), asked: [second], state: 'closed', line: 4 },
    { id: 'toolu_q3', at: at(6), asked: [QUESTION], state: 'unanswered', line: 6 },
    { id: 'toolu_q4', at: at(8), asked: [QUESTION, second], state: 'pending', line: 8 },
  ]);
  assert.deepEqual(lib.sessionFacts(transcript(prompt('typed', 1))).questions, []);
});

test('parseTranscript gives back the entries exactly as the transcript holds them, whatever line each one is at', () => {
  const text = transcript(prompt('typed', 1), '', '{"broken":', asked('toolu_q1', 2), answered('toolu_q1', 3, { [QUESTION]: OPTIONS[1] }));
  const { entries, skipped } = lib.parseTranscript(text);
  assert.deepEqual([skipped, entries.length], [1, 3]);
  assert.deepEqual(entries, [prompt('typed', 1), asked('toolu_q1', 2), answered('toolu_q1', 3, { [QUESTION]: OPTIONS[1] })]);
});

test('questionsOf names the line of each call and of each answer as the transcript counts them, and null for an entry parseTranscript did not read', () => {
  // Line 2 is empty and line 3 does not parse: both count, so the call is at line 4 and its answer at line 5.
  const text = transcript(prompt('typed', 1), '', '{"broken":', asked('toolu_q1', 2), answered('toolu_q1', 3, { [QUESTION]: OPTIONS[1] }), asked('toolu_q2', 4));
  assert.deepEqual(lib.questionsOf(lib.parseTranscript(text).entries), [
    { id: 'toolu_q1', at: at(2), asked: [QUESTION], state: 'answered', answeredAt: at(3), line: 4, answeredLine: 5 },
    { id: 'toolu_q2', at: at(4), asked: [QUESTION], state: 'pending', line: 6 },
  ]);
  // An entry that did not come from `parseTranscript` has no line to name.
  assert.deepEqual(lib.questionsOf([asked('toolu_q3', 5)]), [{ id: 'toolu_q3', at: at(5), asked: [QUESTION], state: 'pending', line: null }]);
});

test('openQuestionsOf lists the questions put to him that have no answer, each call once across the transcripts, oldest first', () => {
  const put = (id, minute, state, asked = [QUESTION]) => ({ id, at: at(minute), asked, state });
  const sessions = [
    // A question asked again later and answered then is no longer open, whatever became of the first call.
    { id: 'a', title: 'JH ORQ · proj', questions: [put('toolu_1', 5, 'closed'), put('toolu_2', 9, 'pending', ['Pregunta 2: ¿b?', 'Pregunta 3: ¿c?']), put('toolu_3', 2, 'answered'), put('toolu_6', 1, 'closed', ['Pregunta 6: ¿f?']), put('toolu_7', 8, 'answered', ['Pregunta 6: ¿f?'])] },
    // The host copies calls from one session's file to another's: the same id is the same question.
    { id: 'b', title: 'JH 5 · made up', questions: [put('toolu_1', 5, 'closed'), put('toolu_4', 3, 'pending'), put('toolu_4b', 4, 'unanswered', ['Pregunta 4: ¿d?'])] },
    // Answered in any file is answered; who asked is the file that has the call first.
    { id: 'c', title: null, questions: [put('toolu_4', 3, 'answered'), put('toolu_2', 7, 'pending', ['Pregunta 2: ¿b?', 'Pregunta 3: ¿c?'])] },
    { id: 'd', unavailable: 'EBUSY' },
  ];
  assert.deepEqual(lib.openQuestionsOf(sessions, { hours: 12 }), {
    open: [
      { id: 'toolu_4b', at: at(4), question: 'Pregunta 4: ¿d?', more: 0, state: 'unanswered', asker: { id: 'b', title: 'JH 5 · made up' } },
      { id: 'toolu_1', at: at(5), question: QUESTION, more: 0, state: 'closed', asker: { id: 'a', title: 'JH ORQ · proj' } },
      { id: 'toolu_2', at: at(7), question: 'Pregunta 2: ¿b?', more: 1, state: 'pending', asker: { id: 'c', title: null } },
    ],
    transcripts: 3,
    hours: 12,
  });
  assert.deepEqual(lib.openQuestionsOf([], {}), { open: [], transcripts: 0, hours: null });
});

// Codex review of c11ed18, finding 1: a call that asked two questions left the list when only the first
// was asked again and answered, and the second went with it though nobody answered it.
test('openQuestionsOf keeps a call open while one of its questions has no answer: asked again and answered counts a question at a time', () => {
  const put = (id, minute, state, asked) => ({ id, at: at(minute), asked, state });
  const [first, second, third] = ['Pregunta 1: ¿a?', 'Pregunta 2: ¿b?', 'Pregunta 3: ¿c?'];
  const open = (...later) => lib.openQuestionsOf([{ id: 'a', title: 'JH ORQ · proj', questions: [put('toolu_1', 1, 'closed', [first, second, third]), ...later] }], { hours: 12 }).open;
  const left = (question, more) => [{ id: 'toolu_1', at: at(1), question, more, state: 'closed', asker: { id: 'a', title: 'JH ORQ · proj' } }];
  assert.deepEqual(open(), left(first, 2));
  // The first asked again and answered: the two others are still his to answer, and the line says them.
  assert.deepEqual(open(put('toolu_2', 2, 'answered', [first])), left(second, 1));
  assert.deepEqual(open(put('toolu_2', 2, 'answered', [first, 'Pregunta 4: ¿d?']), put('toolu_3', 3, 'answered', [third])), left(second, 0));
  // Every one of them answered later, in one call or in several: nothing of the call is open.
  assert.deepEqual(open(put('toolu_2', 2, 'answered', [second, first]), put('toolu_3', 3, 'answered', [third])), []);
  // An answer from before the call, or a later call with no answer, answers none of it.
  assert.deepEqual(open(put('toolu_0', 0, 'answered', [first, second, third])), left(first, 2));
  assert.deepEqual(open(put('toolu_2', 2, 'closed', [first, second, third])).map(({ id, more }) => [id, more]), [['toolu_1', 2], ['toolu_2', 2]]);
});

test('questionRecordOf keeps what the board says of each recorded question: its number, when it was written, who asked it, its text, what waits and whether it is closed', () => {
  const notice = { at: at(1), from: { host: 'claude-code', id: A, source: 'environment', title: 'title a', permissionMode: 'auto' }, text: 'Should the board show it?', waits: 'the board' };
  assert.deepEqual(lib.questionRecordOf([
    { number: 1, notice, closed: null },
    // A notice the host wrote with no sender, and one an answer closed: each field the notice lacks is null.
    { number: 2, notice: { ...notice, at: at(2), from: null, text: 'Another?', waits: 'nothing' }, closed: { by: 'answer', notice: { kind: 'answer' } } },
    { number: 3, notice: { ...notice, at: at(3), from: { id: B, title: null }, text: 'Third?' }, closed: null },
  ]), [
    { number: 1, at: at(1), from: { id: A, title: 'title a' }, text: 'Should the board show it?', waits: 'the board', closed: false },
    { number: 2, at: at(2), from: { id: null, title: null }, text: 'Another?', waits: 'nothing', closed: true },
    { number: 3, at: at(3), from: { id: B, title: null }, text: 'Third?', waits: 'the board', closed: false },
  ]);
  assert.deepEqual(lib.questionRecordOf([]), []);
});

test('recordQuestionsIn joins each recorded question to its call in every state, and gives an answered call the line of its answer', () => {
  const recorded = (number) => ({ number, notice: { at: at(1), from: { host: 'claude-code', id: A, source: 'environment', title: 'title a', permissionMode: 'auto' }, text: `Made up ${number}?`, waits: 'the board' }, closed: null });
  const record = lib.questionRecordOf([1, 2, 3, 4, 5].map(recorded));
  const questions = lib.questionsOf(lib.parseTranscript(transcript(
    asked('toolu_2', 2, [asking('Pregunta 2: ¿b?')]),
    asked('toolu_3', 3, [asking('Pregunta 3: ¿c?')]),
    answered('toolu_3', 4, { 'Pregunta 3: ¿c?': OPTIONS[1] }),
    asked('toolu_4', 5, [asking('Pregunta 4: ¿d?')]),
    result('toolu_4', { questions: [], answers: { 'Pregunta 4: ¿d?': DISMISSED } }, 6),
    asked('toolu_5', 7, [asking('Pregunta 5: ¿e?')]),
    result('toolu_5', undefined, 8),
  )).entries);
  assert.deepEqual(lib.recordQuestionsIn(record, questions).map(({ number, call }) => [number, call]), [
    // No call of the number: the question is not asked in this transcript.
    [1, null],
    [2, { id: 'toolu_2', state: 'pending', at: at(2), line: 1 }],
    [3, { id: 'toolu_3', state: 'answered', at: at(3), line: 2, answeredAt: at(4), answeredLine: 3 }],
    [4, { id: 'toolu_4', state: 'closed', at: at(5), line: 4 }],
    [5, { id: 'toolu_5', state: 'unanswered', at: at(7), line: 6 }],
  ]);
  // The record it was given is not changed: the call is a key of the copy.
  assert.equal('call' in record[0], false);
});

test('recordQuestionsIn joins no call asked before its notice, nor one whose text lacks the exact prefix of the number', () => {
  const record = lib.questionRecordOf([{ number: 1, notice: { at: at(5), from: { host: 'claude-code', id: A, source: 'environment', title: 'title a', permissionMode: 'auto' }, text: 'Made up?', waits: 'the board' }, closed: null }]);
  const before = lib.questionsOf(lib.parseTranscript(transcript(
    // Numbered by hand before the record held the question: this call is not its question.
    asked('toolu_a', 2, [asking('Pregunta 1: ¿a?')]),
    // Asked after the notice, with the number but not the prefix: its text is no question of the record.
    asked('toolu_b', 6, [asking('Pregunta 1 - ¿a?')]),
  )).entries);
  assert.deepEqual(lib.recordQuestionsIn(record, before).map(({ call }) => call), [null]);
  // The call that has the exact prefix, asked after the notice, is the question's.
  const after = lib.questionsOf(lib.parseTranscript(transcript(asked('toolu_c', 7, [asking('Pregunta 1: ¿a?')]))).entries);
  assert.deepEqual(lib.recordQuestionsIn(record, [...before, ...after]).map(({ call }) => call.id), ['toolu_c']);
});

test('openQuestionsOf with the record lists the recorded questions no notice closed, joins each to its call by the number, and leaves the joined calls out of open', () => {
  const put = (id, minute, state, asked) => ({ id, at: at(minute), asked, state });
  const answered = (id, minute, line, asked) => ({ ...put(id, minute, 'answered', asked), answeredAt: at(minute + 1), answeredLine: line });
  const asker = (id) => ({ id, title: `title ${id[0]}` });
  const notice = (number, minute, from, closed = false) => ({ number, at: at(minute), from: asker(from), text: `made up ${number}`, waits: 'the board', closed });
  const record = [notice(1, 1, A), notice(2, 2, A), notice(3, 4, A), notice(4, 1, A), notice(5, 1, C, true), notice(6, 1, A)];
  const sessions = [
    // Its own question 6 is answered in the asker's own transcript: it came back into his turn, so it is closed.
    { id: A, title: 'title a', questions: [put('toolu_a', 3, 'pending', ['Pregunta 2: ¿b?']), answered('toolu_c', 4, 9, ['Pregunta 6: ¿f?'])] },
    // Question 4 is answered in another session's transcript; question 5 is closed by a notice, and its call is joined all the same.
    { id: B, title: 'title b', questions: [answered('toolu_d', 6, 12, ['Pregunta 4: ¿d?']), put('toolu_e', 2, 'closed', ['Pregunta 5: ¿e?']), put('toolu_f', 1, 'closed', ['Pregunta 3: ¿c?'])] },
    // Question 2 has two calls: the newer one is its call. A call with no time joins nothing.
    { id: C, title: 'title c', questions: [put('toolu_g', 5, 'unanswered', ['Pregunta 2: ¿b? (otra)']), { id: 'toolu_h', at: null, asked: ['Pregunta 1: ¿a?'], state: 'pending' }] },
    { id: 'dddddddd-4444-4444-8444-444444444444', unavailable: 'EBUSY' },
  ];
  assert.deepEqual(lib.openQuestionsOf(sessions, { hours: 12, record }), {
    open: [
      // Oldest first. toolu_a asked question 2 too, but toolu_g is the newer call of it, so toolu_a is listed as a call of its own.
      { id: 'toolu_f', at: at(1), question: 'Pregunta 3: ¿c?', more: 0, state: 'closed', asker: { id: B, title: 'title b' } },
      { id: 'toolu_a', at: at(3), question: 'Pregunta 2: ¿b?', more: 0, state: 'pending', asker: { id: A, title: 'title a' } },
      { id: 'toolu_h', at: null, question: 'Pregunta 1: ¿a?', more: 0, state: 'pending', asker: { id: C, title: 'title c' } },
    ],
    transcripts: 3,
    hours: 12,
    record,
    recorded: [
      { number: 1, at: at(1), asker: asker(A), question: 'made up 1', waits: 'the board', state: 'not-shown', call: null },
      { number: 2, at: at(2), asker: asker(A), question: 'made up 2', waits: 'the board', state: 'unanswered', call: 'toolu_g' },
      { number: 3, at: at(4), asker: asker(A), question: 'made up 3', waits: 'the board', state: 'not-shown', call: null },
      { number: 4, at: at(1), asker: asker(A), question: 'made up 4', waits: 'the board', state: 'answered-not-carried', call: 'toolu_d', answered: { session: B, line: 12, at: at(7) } },
    ],
  });
});

test('renderBoard prints the open questions after the channel: how long ago, who asked, what became of each, and what was read', () => {
  const minutesAgo = (minutes) => new Date(NOW - minutes * 60000).toISOString();
  const open = [
    { id: 'toolu_1', at: minutesAgo(10), question: 'Pregunta 1: ¿a?', more: 0, state: 'closed', asker: { id: 'aaaaaaaa-1111', title: 'JH ORQ · proj' } },
    { id: 'toolu_2', at: minutesAgo(5), question: 'Pregunta 2: ¿b?', more: 1, state: 'pending', asker: { id: 'cccccccc-3333', title: null } },
    { id: 'toolu_3', at: null, question: 'Pregunta 3: ¿c?', more: 0, state: 'unanswered', asker: { id: 'bbbbbbbb-2222', title: 'JH 5 · made up' } },
  ];
  const section = (questions) => {
    const lines = lib.renderBoard({ ...BOARD, ...(questions && { questions }) }, { now: NOW });
    const from = lines.indexOf('Open questions');
    return from < 0 ? null : lines.slice(from, lines.indexOf('', from) + 1);
  };
  assert.deepEqual(section({ open, transcripts: 3, hours: 12 }), [
    'Open questions',
    '  10m ago  JH ORQ · proj  closed by the user without an answer  Pregunta 1: ¿a?',
    '  5m ago  transcript cccccccc  on the user\'s screen, no answer yet  Pregunta 2: ¿b? (and 1 more in the same call)',
    '  time not recorded  JH 5 · made up  no answer in its result  Pregunta 3: ¿c?',
    '  read in 3 transcripts changed in the last 12h, each read whole',
    '',
  ]);
  // Nothing open is said too, with what was read: an empty list from one transcript is not one from fifty.
  assert.deepEqual(section({ open: [], transcripts: 1, hours: 12 }), ['Open questions', '  none', '  read in 1 transcript changed in the last 12h, each read whole', '']);
  // A board that holds no such key (an older one a watch keeps) prints no section; and the section comes
  // before the worktrees.
  assert.equal(section(undefined), null);
  const lines = lib.renderBoard({ ...BOARD, questions: { open, transcripts: 3, hours: 12 } }, { now: NOW });
  assert.ok(lines.indexOf('Open questions') < lines.indexOf('Worktrees'));
});

test('renderBoard prints the recorded questions first under Open questions, with their number, asker and state, and says none only when neither list has a row', () => {
  const minutesAgo = (minutes) => new Date(NOW - minutes * 60000).toISOString();
  const recorded = [
    { number: 1, at: minutesAgo(30), asker: { id: A, title: 'JH ORQ · proj' }, question: 'Should it show?', waits: 'the board', state: 'not-shown', call: null },
    { number: 2, at: minutesAgo(20), asker: { id: C, title: null }, question: 'Which one?', waits: 'the board', state: 'answered-not-carried', call: 'toolu_2', answered: { session: 'dddddddd-4444-4444-8444-444444444444', line: 14, at: minutesAgo(9) } },
  ];
  const open = [{ id: 'toolu_1', at: minutesAgo(10), question: 'Pregunta 1: ¿a?', more: 0, state: 'closed', asker: { id: B, title: 'JH 5 · made up' } }];
  const section = (questions) => {
    const lines = lib.renderBoard({ ...BOARD, questions }, { now: NOW });
    const from = lines.indexOf('Open questions');
    return lines.slice(from, lines.indexOf('', from) + 1);
  };
  assert.deepEqual(section({ recorded, open, transcripts: 2, hours: 12 }), [
    'Open questions',
    '  Pregunta 1  30m ago  JH ORQ · proj  recorded, not shown to the user yet  Should it show?',
    '  Pregunta 2  20m ago  session cccccccc  answered at dddddddd:14, not carried yet  Which one?',
    '  10m ago  JH 5 · made up  closed by the user without an answer  Pregunta 1: ¿a?',
    '  to ask: when the user last wrote here is not known: call the question tool in the reply to a message of the user\'s; until then a reply says in one line that 1 question waits and about what, and never writes the options out as text',
    '  read in 2 transcripts changed in the last 12h, each read whole',
    '',
  ]);
  // Recorded questions with no row of the transcripts: no `none`. Neither list has a row: `none`, and the read.
  assert.deepEqual(section({ recorded, open: [], transcripts: 1, hours: 12 }).includes('  none'), false);
  assert.deepEqual(section({ recorded: [], open: [], transcripts: 1, hours: 12 }), ['Open questions', '  none', '  read in 1 transcript changed in the last 12h, each read whole', '']);
});

test('sessionFacts gives the time of the newest entry he wrote, whichever way he wrote it, and of no other', () => {
  const said = (...entries) => lib.sessionFacts(transcript(...entries), { tail: 0 }).personAt;
  // His own: a typed message, one queued while the session worked, and the answer he tapped to a question.
  assert.equal(said(prompt('typed', 1)), at(1));
  assert.equal(said(reply('working', 1), queued(2)), at(2), 'a message queued while the session worked');
  assert.equal(said(asked('toolu_q1', 1), answered('toolu_q1', 2, { [QUESTION]: OPTIONS[1] })), at(2), 'an answer he tapped');
  // The newest by its time: a resumed session writes an older entry of his again, after the newer one.
  assert.equal(said(prompt('newer', 5), prompt('older', 2)), at(5));
  // Not his, so the newest of his stays: another session's message, a task's end, a tool result, a compaction
  // summary, a reply of the session, a side chain's entry, a queued message the host does not mark as his turn,
  // and an answer the host marked as an error.
  assert.equal(said(prompt('typed', 1), told(2)), at(1), 'a message from another session');
  assert.equal(said(prompt('typed', 1), notified({ task: 'b1', status: 'completed' }, 2)), at(1), 'a task\'s end');
  assert.equal(said(prompt('typed', 1), result('toolu_b1', { stdout: '' }, 2)), at(1), 'a tool result');
  assert.equal(said(prompt('typed', 1), { ...prompt('summary', 2), isCompactSummary: true }), at(1), 'a compaction summary');
  assert.equal(said(prompt('typed', 1), reply('done', 2)), at(1), 'a reply of the session');
  assert.equal(said(prompt('typed', 1), { ...prompt('side', 2), isSidechain: true }), at(1), 'an entry of a side chain');
  assert.equal(said(prompt('typed', 1), queued(2, { humanTurn: undefined })), at(1), 'a queued message the host does not mark as his turn');
  assert.equal(said(prompt('typed', 1), asked('toolu_q1', 2), answered('toolu_q1', 3, { [QUESTION]: OPTIONS[1] }, { is_error: true })), at(1), 'an answer the host marked as an error');
  // No entry of his at all, or his entry has no time: `null`.
  assert.equal(said(reply('only mine', 1)), null);
  assert.equal(said({ ...prompt('no time', 1), timestamp: undefined }), null, 'his entry with no time');
});

test('askingRule says how to ask him: with the question tool when he wrote a short while ago, in the reply to his next message when longer, and never guesses where he is', () => {
  const ago = (ms) => new Date(NOW - ms).toISOString();
  const LONG = (since, waits) => `the user last wrote here ${since} ago: the question tool would hold this session until the user answers, so call it in the reply to the user's next message; until then a reply says in one line that ${waits} and about what, and never writes the options out as text`;
  const NOT_KNOWN = (waits) => `when the user last wrote here is not known: call the question tool in the reply to a message of the user's; until then a reply says in one line that ${waits} and about what, and never writes the options out as text`;
  assert.equal(lib.askingRule(ago(60 * 1000), NOW), 'the user wrote here 1m ago: put it to them now with the question tool');
  assert.equal(lib.askingRule(ago(lib.PERSON_PRESENT_MS - 1000), NOW), 'the user wrote here 14m ago: put it to them now with the question tool', 'just under the limit he is there');
  assert.equal(lib.askingRule(ago(lib.PERSON_PRESENT_MS), NOW), LONG('15m', '1 question waits'), 'at the limit he is away');
  assert.equal(lib.askingRule(ago(2 * 3600 * 1000 + 5 * 60 * 1000), NOW, { waiting: 3 }), LONG('2h 05m', '3 questions wait'));
  assert.equal(lib.askingRule(ago(3 * 86400 * 1000), NOW, { waiting: 2 }), LONG('3d', '2 questions wait'));
  assert.equal(lib.askingRule(ago(-5000), NOW), 'the user wrote here 0s ago: put it to them now with the question tool', 'a time in the future is just now');
  assert.equal(lib.askingRule(null, NOW), NOT_KNOWN('1 question waits'), 'no entry of his is read');
  assert.equal(lib.askingRule('not a time', NOW, { waiting: 2 }), NOT_KNOWN('2 questions wait'), 'a time that does not parse');
});

test('renderBoard says how to ask him the recorded questions that wait, from when he last wrote in the board\'s own session, and nothing when none waits', () => {
  const minutesAgo = (minutes) => new Date(NOW - minutes * 60000).toISOString();
  const recorded = [
    { number: 1, at: minutesAgo(30), asker: { id: A, title: 'JH ORQ · proj' }, question: 'Should it show?', waits: 'the board', state: 'not-shown', call: null },
    { number: 2, at: minutesAgo(20), asker: { id: C, title: null }, question: 'Which one?', waits: 'the board', state: 'closed', call: 'toolu_2' },
    { number: 3, at: minutesAgo(15), asker: { id: B, title: 'JH 5 · made up' }, question: 'Still?', waits: 'the board', state: 'answered-not-carried', call: 'toolu_3', answered: { session: C, line: 4, at: minutesAgo(9) } },
  ];
  const self = (personAt) => ({ id: B, title: 'JH 2 · the board', self: true, personAt, state: 'waiting', lastEntryAt: before(60), cwd: 'C:\\p', gitBranch: 'main', skippedLines: 0, work: [], tail: [] });
  const section = (sessions, list = recorded) => {
    const lines = lib.renderBoard({ ...BOARD, sessions, questions: { recorded: list, open: [], transcripts: 1, hours: 12 } }, { now: NOW });
    const from = lines.indexOf('Open questions');
    return lines.slice(from, lines.indexOf('', from) + 1);
  };
  const rows = [
    '  Pregunta 1  30m ago  JH ORQ · proj  recorded, not shown to the user yet  Should it show?',
    '  Pregunta 2  20m ago  session cccccccc  closed by the user without an answer  Which one?',
    '  Pregunta 3  15m ago  JH 5 · made up  answered at cccccccc:4, not carried yet  Still?',
  ];
  const READ = '  read in 1 transcript changed in the last 12h, each read whole';
  const WAITING = 'until then a reply says in one line that 2 questions wait and about what, and never writes the options out as text';
  // Two of the three wait (one not shown, one closed); the answered one does not. He was there five minutes ago.
  assert.deepEqual(section([self(minutesAgo(5))]), ['Open questions', ...rows, '  to ask: the user wrote here 5m ago: put it to them now with the question tool', READ, '']);
  // No session of the board is his: the rule says it is not known.
  assert.deepEqual(section([]), ['Open questions', ...rows, `  to ask: when the user last wrote here is not known: call the question tool in the reply to a message of the user's; ${WAITING}`, READ, '']);
  // Away for two hours: the question tool waits for his next message.
  assert.deepEqual(section([self(minutesAgo(120))]), ['Open questions', ...rows, `  to ask: the user last wrote here 2h 00m ago: the question tool would hold this session until the user answers, so call it in the reply to the user's next message; ${WAITING}`, READ, '']);
  // Nothing waits to be asked, whoever is there: no such line.
  assert.deepEqual(section([self(minutesAgo(5))], [recorded[2]]), ['Open questions', rows[2], READ, '']);
});

const openOf = (...open) => ({ questions: { open, transcripts: 2, hours: 12 } });
const openCall = (n, state, more = {}) => ({ id: `toolu_${n}`, at: at(n), question: `Pregunta ${n}: ¿a?`, more: 0, state, asker: { id: B, title: 'JH 2 · the board' }, ...more });

test('boardChanges: a question he closed without answering since the last look is said once, and one that is only on his screen is not', () => {
  const closed = 'question closed by the user without an answer, asked by "JH 2 · the board": Pregunta 1: ¿a?';
  // From his screen to closed, and one asked and closed between two looks.
  assert.deepEqual(changes(openOf(openCall(1, 'pending')), openOf(openCall(1, 'closed'))), [closed]);
  assert.deepEqual(changes(openOf(), openOf(openCall(1, 'closed'))), [closed]);
  // Who asked with no title is named by its transcript, and the other questions of the call are counted.
  assert.deepEqual(changes(openOf(), openOf(openCall(1, 'closed', { more: 2, asker: { id: C, title: null } }))), [
    'question closed by the user without an answer, asked by session cccccccc: Pregunta 1: ¿a? (and 2 more in the same call)',
  ]);
  // A long question is cut: the transcript has it whole.
  const long = changes(openOf(), openOf(openCall(1, 'closed', { question: 'x'.repeat(500) })))[0];
  assert.equal(long, `question closed by the user without an answer, asked by "JH 2 · the board": ${'x'.repeat(159)}…`);
  // Already closed at the last look, put on his screen, left with no answer in its result, answered or
  // out of the window (it leaves the list): none of them is a question to put to him again now.
  assert.deepEqual(changes(openOf(openCall(1, 'closed')), openOf(openCall(1, 'closed'))), []);
  assert.deepEqual(changes(openOf(), openOf(openCall(1, 'pending'), openCall(2, 'unanswered'))), []);
  assert.deepEqual(changes(openOf(openCall(1, 'pending'), openCall(2, 'closed')), openOf()), []);
  // A board with no such list on either side (an older one a watch keeps) is not compared.
  assert.deepEqual(changes({}, openOf(openCall(1, 'closed'))), []);
  assert.deepEqual(changes(openOf(openCall(1, 'closed')), {}), []);
});

test('watchBaseline keeps the questions of a session whose transcript one look could not read, so a question closed before it is not said again', () => {
  const holder = { ...seen(B, 'waiting'), questions: [{ id: 'toolu_1', at: at(1), asked: ['Pregunta 1: ¿a?'], state: 'closed' }] };
  const boardWith = (sessions) => boardOf({ sessions, questions: lib.openQuestionsOf(sessions, { hours: 12 }) });
  const older = boardWith([holder]);
  const failed = boardWith([{ id: B, unavailable: 'EBUSY' }]);
  assert.deepEqual(failed.questions.open, [], 'the look that could not read the transcript lists nothing');
  const kept = lib.watchBaseline(older, failed);
  assert.deepEqual(kept.questions, older.questions);
  assert.deepEqual(lib.boardChanges(kept, boardWith([holder])), []);
  // Without it the same question would be news at the look after.
  assert.equal(lib.boardChanges(failed, boardWith([holder])).filter((line) => line.startsWith('question closed')).length, 1);
  assert.equal('questions' in lib.watchBaseline(boardOf(), boardOf()), false, 'a board without the list gains none');
});

// Codex review of c11ed18, finding 2: the answer to a closed question can be in another transcript (the
// question asked again there). A look that could not read that transcript listed the closed one again, and
// the watch returned for it though nothing had changed: the baseline is only made after a look with no change.
test('boardChanges: a look that cannot read the transcript holding the answer does not say the question closed anew', () => {
  const asker = { ...seen(A, 'waiting'), questions: [{ id: 'toolu_1', at: at(1), asked: ['Pregunta 1: ¿a?'], state: 'closed' }] };
  const answerer = { ...seen(B, 'waiting'), questions: [{ id: 'toolu_2', at: at(2), asked: ['Pregunta 1: ¿a?'], state: 'answered', answeredAt: at(3) }] };
  const boardWith = (sessions) => boardOf({ sessions, questions: lib.openQuestionsOf(sessions, { hours: 12 }) });
  const read = boardWith([asker, answerer]);
  const failed = boardWith([asker, { id: B, unavailable: 'EBUSY' }]);
  assert.deepEqual(read.questions.open, []);
  assert.equal(failed.questions.open.length, 1, 'the look that failed lists it: it cannot see the answer');
  const closedAnew = (before, after) => lib.boardChanges(before, after).filter((line) => line.startsWith('question closed'));
  assert.deepEqual(closedAnew(read, failed), []);
  // A question he does close during such a look is still said: the transcript that holds it was read.
  const other = { ...asker, questions: [...asker.questions, { id: 'toolu_3', at: at(4), asked: ['Pregunta 2: ¿b?'], state: 'closed' }] };
  assert.deepEqual(closedAnew(read, boardWith([other, { id: B, unavailable: 'EBUSY' }])), ['question closed by the user without an answer, asked by "title a": Pregunta 2: ¿b?']);
  // And with nothing known of the unread transcript from before, the list of the look is what there is.
  assert.equal(closedAnew(boardWith([{ id: B, unavailable: 'EBUSY' }]), failed).length, 1);
});

// A recorded question (`notify --kind question`) as the board reads it: the record holds it, and the transcripts
// hold its call and the answer, or not.
const RECORD = [{ number: 1, at: at(1), from: { id: A, title: 'title a' }, text: 'Should the board show it?', waits: 'the board', closed: false }];
const recordBoard = (sessions, record = RECORD) => boardOf({ sessions, questions: lib.openQuestionsOf(sessions, { hours: 12, record }) });
const asksOne = (state, more = {}) => ({ id: 'toolu_1', at: at(2), asked: ['Pregunta 1: ¿a?'], state, ...more });

test('boardChanges says a recorded question once when it turns answered and not carried, or closed by him; nothing for one on his screen or not shown yet', () => {
  const notShown = recordBoard([seen(B, 'waiting')]);
  const onScreen = recordBoard([seen(B, 'waiting', { questions: [asksOne('pending')] })]);
  const answeredBoard = recordBoard([seen(B, 'waiting', { questions: [asksOne('answered', { answeredAt: at(3), answeredLine: 9 })] })]);
  const closedBoard = recordBoard([seen(B, 'waiting', { questions: [asksOne('closed')] })]);
  const said = 'question 1 answered at bbbbbbbb:9: not carried to title a yet';
  assert.deepEqual(lib.boardChanges(notShown, onScreen), [], 'on his screen is not said: nothing is his to do yet');
  assert.deepEqual(lib.boardChanges(notShown, answeredBoard), [said]);
  assert.deepEqual(lib.boardChanges(onScreen, answeredBoard), [said]);
  assert.deepEqual(lib.boardChanges(answeredBoard, answeredBoard), [], 'said once, at the look that sees the state new');
  const closedSaid = 'question 1 closed by the user without an answer: Should the board show it?';
  assert.deepEqual(lib.boardChanges(onScreen, closedBoard), [closedSaid], 'said once, with the text of the record');
  assert.deepEqual(lib.boardChanges(notShown, closedBoard), [closedSaid]);
  // A question an answer notice closed in the record is not said again: it is not listed, and the record no longer asks.
  assert.deepEqual(lib.boardChanges(closedBoard, recordBoard([seen(B, 'waiting', { questions: [asksOne('closed')] })], [{ ...RECORD[0], closed: true }])), []);
  // A board from before the record was read has no recorded list to compare, and the question it listed is not said again.
  const earlier = [seen(B, 'waiting', { questions: [asksOne('closed')] })];
  assert.deepEqual(lib.boardChanges(boardOf({ sessions: earlier, questions: lib.openQuestionsOf(earlier, { hours: 12 }) }), closedBoard), []);
});

test('a recorded question whose answer a look could not read keeps its state at the look after, and is not said twice', () => {
  const holder = seen(B, 'waiting', { questions: [asksOne('answered', { answeredAt: at(3), answeredLine: 9 })] });
  const older = recordBoard([holder]);
  const failed = recordBoard([{ id: B, unavailable: 'EBUSY' }]);
  assert.equal(failed.questions.recorded[0].state, 'not-shown', 'the look that could not read the transcript lists the question as not shown');
  const kept = lib.watchBaseline(older, failed);
  assert.deepEqual(kept.questions, older.questions, 'the baseline keeps the state of the last readable facts');
  assert.deepEqual(lib.boardChanges(older, failed).filter((line) => line.startsWith('question ')), [], 'the look that cannot read says nothing about it');
  assert.deepEqual(lib.boardChanges(kept, recordBoard([holder])), [], 'the look after says nothing: it was said once, at the look before');
  // Without the baseline the same answer would be news at the look after.
  assert.deepEqual(lib.boardChanges(failed, recordBoard([holder])).filter((line) => line.startsWith('question ')), ['question 1 answered at bbbbbbbb:9: not carried to title a yet']);
});

test('a call that asked a recorded question and another one stays listed for the other: only the text the record took leaves open', () => {
  const mixed = { id: 'toolu_m', at: at(2), asked: ['Pregunta 1: ¿a?', '¿Y esto otro?'], state: 'pending' };
  const found = lib.openQuestionsOf([seen(B, 'waiting', { questions: [mixed] })], { hours: 12, record: RECORD });
  assert.deepEqual(found.recorded.map(({ number, state, call }) => [number, state, call]), [[1, 'pending', 'toolu_m']]);
  assert.deepEqual(found.open, [{ id: 'toolu_m', at: at(2), question: '¿Y esto otro?', more: 0, state: 'pending', asker: { id: B, title: 'title b' } }]);
  // A call that asked nothing else is listed once, under its number; and so is one whose question a notice closed.
  assert.deepEqual(lib.openQuestionsOf([seen(B, 'waiting', { questions: [asksOne('pending')] })], { hours: 12, record: RECORD }).open, []);
  const closedRecord = [{ ...RECORD[0], closed: true }];
  assert.deepEqual(lib.openQuestionsOf([seen(B, 'waiting', { questions: [mixed] })], { hours: 12, record: closedRecord }).open.map((question) => question.question), ['¿Y esto otro?']);
});

test('a look that could not read the channel\'s record says nothing of its questions and keeps them as they were, so the look after says what happened across it', () => {
  const asked = [seen(B, 'waiting', { questions: [asksOne('pending')] })];
  const answeredNow = [seen(B, 'waiting', { questions: [asksOne('answered', { answeredAt: at(3), answeredLine: 9 })] })];
  const closedNow = [seen(B, 'waiting', { questions: [asksOne('closed')] })];
  // A board whose record could not be read has the list of the transcripts alone, as `sessions` builds it then.
  const unread = (sessions) => boardOf({ sessions, questions: lib.openQuestionsOf(sessions, { hours: 12 }) });
  const before = recordBoard(asked);
  const ofQuestions = (lines) => lines.filter((line) => line.startsWith('question '));
  // He answers while the record cannot be read: nothing is said then, and the look after says it, once.
  assert.deepEqual(ofQuestions(lib.boardChanges(before, unread(answeredNow))), []);
  const kept = lib.watchBaseline(before, unread(answeredNow));
  assert.deepEqual(kept.questions.record, RECORD, 'the record of the last look that read it');
  assert.deepEqual(kept.questions.recorded, before.questions.recorded, 'and its questions as that look had them');
  const after = recordBoard(answeredNow);
  assert.deepEqual(ofQuestions(lib.boardChanges(kept, after)), ['question 1 answered at bbbbbbbb:9: not carried to title a yet']);
  assert.deepEqual(ofQuestions(lib.boardChanges(lib.watchBaseline(kept, after), recordBoard(answeredNow))), []);
  // He closes it while the record cannot be read: its call is not taken for a question nobody recorded, which
  // would say it now in other words and again, by its number, at the look after.
  assert.deepEqual(ofQuestions(lib.boardChanges(before, unread(closedNow))), []);
  assert.deepEqual(ofQuestions(lib.boardChanges(lib.watchBaseline(before, unread(closedNow)), recordBoard(closedNow))), ['question 1 closed by the user without an answer: Should the board show it?']);
});

// --- `compactionStretch` and `replyOf`: what a transcript holds of the stretch before a compaction ---
//
// The stretch is the work a session did between two compactions, or before the first one. `compactionStretch`
// reads it for the person's words, the messages of other sessions, the session's last reply and the files it
// wrote; `replyOf` reads one line for the session's own words, as `quoteOf` reads one for the person's.

const id = (uuid, entry) => ({ ...entry, uuid });

test('compactionStretch of a transcript with no compaction is the whole file, and no compaction is current', () => {
  const facts = lib.compactionStretch(transcript(prompt('hello', 1), reply('hi', 2)));
  assert.deepEqual(facts.boundaries, []);
  assert.equal(facts.current, null);
  assert.deepEqual(facts.stretch, { after: null, before: null, inThisFile: true });
  assert.deepEqual(facts.person, [{ line: 1, at: at(1) }]);
  assert.deepEqual(facts.lastReply, { line: 2, at: at(2) });
});

test('a compaction the session has replied to since is not the current one: the stretch starts at it', () => {
  const text = transcript(prompt('before', 1), compaction(2, 'auto', 900, 300, { uuid: 'b1' }), prompt('after', 3), reply('answer', 4));
  const facts = lib.compactionStretch(text);
  assert.deepEqual(facts.boundaries, [{ uuid: 'b1', at: at(2), automatic: true, before: 900, line: 2 }]);
  assert.equal(facts.current, null);
  assert.deepEqual(facts.stretch, { after: at(2), before: null, inThisFile: true });
  assert.deepEqual(facts.person, [{ line: 3, at: at(3) }]);
});

test('a compaction with no reply after it is the one the session came back from: its stretch lies before it', () => {
  const text = transcript(
    prompt('early', 1),
    reply('early answer', 2),
    compaction(3, 'auto', 900, 300, { uuid: 'b1' }),
    prompt('stretch', 4),
    reply('stretch answer', 5),
    compaction(6, 'manual', 800, 200, { uuid: 'b2' }),
  );
  const facts = lib.compactionStretch(text);
  assert.deepEqual(facts.boundaries.map((boundary) => [boundary.uuid, boundary.automatic]), [['b1', true], ['b2', false]]);
  assert.equal(facts.current, facts.boundaries[1]);
  assert.deepEqual(facts.stretch, { after: at(3), before: at(6), inThisFile: true });
  assert.deepEqual(facts.person, [{ line: 4, at: at(4) }]);
  assert.deepEqual(facts.lastReply, { line: 5, at: at(5) });
  // With no compaction before it, the stretch starts at the top of the file.
  const alone = lib.compactionStretch(transcript(prompt('early', 1), reply('answer', 2), compaction(3, 'auto', 900, 300, { uuid: 'b1' })));
  assert.equal(alone.current, alone.boundaries[0]);
  assert.deepEqual(alone.stretch, { after: null, before: at(3), inThisFile: true });
  assert.deepEqual(alone.person, [{ line: 1, at: at(1) }]);
});

test('an entry the host wrote again is counted once, at its first line: the copies of old entries add nothing', () => {
  const early = id('p1', prompt('early', 1));
  const earlyReply = id('r1', reply('early answer', 2));
  const boundary = id('b1', compaction(3, 'auto', 900, 300));
  const stretchPrompt = id('p2', prompt('stretch', 4));
  const stretchReply = id('r2', reply('stretch answer', 5));
  const newest = id('b2', compaction(6, 'auto', 800, 200));
  // The host writes the copy just before the newest boundary, with an older boundary at its head.
  const text = transcript(early, earlyReply, boundary, stretchPrompt, stretchReply, boundary, early, earlyReply, stretchPrompt, stretchReply, newest);
  const facts = lib.compactionStretch(text);
  assert.deepEqual(facts.boundaries, [
    { uuid: 'b1', at: at(3), automatic: true, before: 900, line: 3 },
    { uuid: 'b2', at: at(6), automatic: true, before: 800, line: 11 },
  ]);
  assert.equal(facts.current, facts.boundaries[1]);
  assert.deepEqual(facts.stretch, { after: at(3), before: at(6), inThisFile: true });
  assert.deepEqual(facts.person, [{ line: 4, at: at(4) }]);
  assert.deepEqual(facts.lastReply, { line: 5, at: at(5) });
  for (const { line } of facts.person) assert.equal(lib.quoteOf(text, line).text, 'stretch');
});

test('a file the host continued begins with a copy of the boundary and holds none of the stretch before it', () => {
  const text = transcript(id('b1', compaction(3, 'auto', 900, 300)), id('p2', prompt('resumed', 4)));
  const facts = lib.compactionStretch(text);
  assert.equal(facts.current, facts.boundaries[0]);
  assert.deepEqual(facts.stretch, { after: null, before: at(3), inThisFile: false });
  assert.deepEqual(facts.person, []);
});

test('the person\'s words of the stretch are his prompts and his queued messages; another session\'s messages are its sessions', () => {
  const text = transcript(
    prompt('typed', 1),
    queued(2),
    peer(3),
    handback(4),
    injected(5, 'made up'),
    result('toolu_1', { stdout: '' }, 6),
    { type: 'user', ...base(7), isCompactSummary: true, message: { role: 'user', content: 'a summary' } },
    notified({ task: 'b1', status: 'completed' }, 8),
    { type: 'user', ...base(9), isMeta: true, message: { role: 'user', content: 'a reminder of the host' } },
    queued(10, { origin: { kind: 'peer', name: 'JH 2 · queued', from: 'local_2', body: 'made up' }, isMeta: true, humanTurn: undefined }),
    { ...prompt('in a side chain', 11), isSidechain: true },
    { ...peer(12), isSidechain: true },
    reply('answer', 13),
  );
  const facts = lib.compactionStretch(text);
  assert.deepEqual(facts.person, [{ line: 1, at: at(1) }, { line: 2, at: at(2) }]);
  assert.deepEqual(facts.sessions, [{ line: 3, at: at(3), name: 'JH 1 · made up' }, { line: 10, at: at(10), name: 'JH 2 · queued' }]);
  // Each line of `person` is what `quoteOf` gives for that line: the same words, so the two cannot part.
  assert.deepEqual(facts.person.map(({ line }) => lib.quoteOf(text, line).text), ['typed', 'made up while it worked']);
  assert.ok(facts.person.every(({ line }) => lib.quoteOf(text, line).person === true));
});

test('an answer he gave to a question is among the person\'s words of the stretch; a question he did not answer is not', () => {
  const text = transcript(
    prompt('typed', 1),
    asked('toolu_q1', 2),
    answered('toolu_q1', 3, { [QUESTION]: OPTIONS[1] }),
    asked('toolu_q2', 4),
    answered('toolu_q2', 5, { [QUESTION]: OPTIONS[0] }, { is_error: true }),
    asked('toolu_q3', 6, [asking()], 'Bash'),
    answered('toolu_q3', 7, { [QUESTION]: OPTIONS[0] }),
    asked('toolu_q4', 8),
    answered('toolu_q4', 9, { [QUESTION]: DISMISSED }),
    reply('answer', 10),
  );
  const facts = lib.compactionStretch(text);
  assert.deepEqual(facts.person, [{ line: 1, at: at(1) }, { line: 3, at: at(3) }]);
  assert.deepEqual(facts.person.map(({ line }) => lib.quoteOf(text, line).text), ['typed', OPTIONS[1]]);
});

test('an entry with no time of its own takes the time of the counted entry before it', () => {
  const facts = lib.compactionStretch(transcript(reply('answer', 4), { ...prompt('typed', 9), timestamp: undefined }));
  assert.deepEqual(facts.person, [{ line: 2, at: at(4) }]);
});

test('lastReply is the session\'s last reply that holds a text block: a reply of tool calls or of thinking alone is skipped', () => {
  const answered = transcript(prompt('go', 1), reply('the answer', 2), call('toolu_1', 'Bash', { command: 'npm test' }, 3), thinking(4), { ...reply('a side chain', 5), isSidechain: true });
  assert.deepEqual(lib.compactionStretch(answered).lastReply, { line: 2, at: at(2) });
  assert.equal(lib.compactionStretch(transcript(prompt('go', 1), call('toolu_1', 'Bash', { command: 'npm test' }, 2))).lastReply, null);
  // A reply before the compaction is the stretch's reply when nothing answers after it.
  const before = transcript(prompt('go', 1), reply('the answer', 2), compaction(3, 'auto', 900, 300, { uuid: 'b1' }));
  assert.deepEqual(lib.compactionStretch(before).lastReply, { line: 2, at: at(2) });
});

test('wrote lists the Edit and Write calls the session made in the whole file, oldest first, and no side chain\'s, Bash call or empty path', () => {
  const text = transcript(
    call('e1', 'Edit', { file_path: 'C:\\proj\\a.mjs', old_string: 'x', new_string: 'y' }, 1),
    { ...call('e2', 'Edit', { file_path: 'C:\\proj\\side.mjs' }, 2), isSidechain: true },
    call('b1', 'Bash', { command: 'echo', file_path: 'C:\\proj\\bash.mjs' }, 3),
    call('w1', 'Write', { file_path: 'C:\\proj\\b.md', content: 'made up' }, 4),
    call('e3', 'Edit', { file_path: '' }, 5),
    compaction(6, 'auto', 900, 300, { uuid: 'b1' }),
    reply('done', 7),
    call('w2', 'Write', { file_path: 'C:\\proj\\c.md' }, 0),
  );
  assert.deepEqual(lib.compactionStretch(text).wrote, [
    { line: 8, at: at(0), path: 'C:\\proj\\c.md' },
    { line: 1, at: at(1), path: 'C:\\proj\\a.mjs' },
    { line: 4, at: at(4), path: 'C:\\proj\\b.md' },
  ]);
});

test('a line that does not parse, a line that is not an object and an empty text give no facts and no error', () => {
  assert.deepEqual(lib.compactionStretch(''), { boundaries: [], current: null, stretch: { after: null, before: null, inThisFile: false }, person: [], sessions: [], lastReply: null, wrote: [] });
  const torn = `{"type":"user","mes\n42\nnull\n${transcript(prompt('typed', 1))}`;
  assert.deepEqual(lib.compactionStretch(torn).person, [{ line: 4, at: at(1) }]);
});

test('compactionMeasures of a transcript with no compaction is empty', () => {
  assert.deepEqual(lib.compactionMeasures(transcript(prompt('hello', 1), reply('hi', 2))), []);
});

test('compactionMeasures judges a host compaction whose pause was told, and asks the reader of the stretch', () => {
  const asked = [];
  const told = (after, before) => {
    asked.push(['told', after, before]);
    return { known: true, at: at(3) };
  };
  const kept = (query) => {
    asked.push(['kept', query]);
    return { known: true, kept: true };
  };
  const text = transcript(
    prompt('go', 1),
    reply('Saved.', 4),
    compaction(6, 'auto', 900, 300, { uuid: 'b1' }),
  );
  assert.deepEqual(lib.compactionMeasures(text, { told, kept }), [
    {
      uuid: 'b1', at: at(6), automatic: true, before: 900, line: 3, after: null, inThisFile: true,
      told: { known: true, at: at(3) }, document: null, kept: { known: false, kept: null },
      verdict: { told: true, kept: null, missing: [] },
    },
  ]);
  assert.deepEqual(asked, [['told', null, at(6)]], 'no feature document was written, so kept is not asked');
});

test('compactionMeasures of a host compaction told and kept is judged true in both facts, and kept is asked from the notice on', () => {
  const DOCUMENT = 'C:\\proj\\odd\\tasks\\session-channel.md';
  const asked = [];
  const told = (after, before) => {
    asked.push(['told', after, before]);
    return { known: true, at: at(3) };
  };
  const kept = (query) => {
    asked.push(['kept', query]);
    return { known: true, kept: true };
  };
  const text = transcript(
    prompt('go', 1),
    call('e1', 'Edit', { file_path: DOCUMENT, old_string: 'x', new_string: 'y' }, 2),
    reply('Saved.', 4),
    compaction(6, 'auto', 900, 300, { uuid: 'b1' }),
  );
  const [measure] = lib.compactionMeasures(text, { told, kept });
  assert.deepEqual(measure, {
    uuid: 'b1', at: at(6), automatic: true, before: 900, line: 4, after: null, inThisFile: true,
    told: { known: true, at: at(3) }, document: DOCUMENT, kept: { known: true, kept: true },
    verdict: { told: true, kept: true, missing: [] },
  });
  assert.deepEqual(asked, [['told', null, at(6)], ['kept', { document: DOCUMENT, after: at(3), before: at(6) }]]);
});

test('compactionMeasures of a pause told with no /compact block anywhere is not missed: told and kept are the only facts, and no block is read', () => {
  const told = () => ({ known: true, at: at(3) });
  const text = transcript(
    prompt('go', 1),
    reply('still working, no block', 2),
    reply('still working, no block', 4),
    compaction(6, 'auto', 900, 300, { uuid: 'b1' }),
  );
  const [measure] = lib.compactionMeasures(text, { told });
  assert.equal('announced' in measure, false);
  assert.deepEqual(measure.verdict, { told: true, kept: null, missing: [] });
});

test('compactionMeasures of a host compaction the notice never reached is not told, and kept is not asked; no state is not judged', () => {
  const text = transcript(
    prompt('go', 1),
    call('e1', 'Edit', { file_path: 'C:\\proj\\odd\\tasks\\session-channel.md' }, 2),
    reply('Saved.', 3),
    compaction(6, 'auto', 900, 300, { uuid: 'b1' }),
  );
  const asked = [];
  const kept = (query) => {
    asked.push(query);
    return { known: true, kept: true };
  };
  const notTold = lib.compactionMeasures(text, { told: () => ({ known: true, at: null }), kept })[0];
  assert.deepEqual(notTold.told, { known: true, at: null });
  assert.deepEqual(notTold.kept, { known: false, kept: null });
  assert.deepEqual(notTold.verdict, { told: false, kept: null, missing: ['told'] });
  assert.deepEqual(asked, [], 'kept is not asked when the notice was not told');
  const noState = lib.compactionMeasures(text, { told: () => ({ known: false, at: null }), kept })[0];
  assert.deepEqual(noState.told, { known: false, at: null });
  assert.deepEqual(noState.verdict, { told: null, kept: null, missing: [] });
  assert.deepEqual(asked, [], 'kept is not asked when the state is not known');
});

test('compactionMeasures names the last feature document the session wrote before the boundary, and no Bash call, side chain or other file', () => {
  const EARLY = 'C:\\proj\\odd\\tasks\\earlier.md';
  const LAST = 'C:/proj/odd/tasks/session-channel.md';
  const text = transcript(
    prompt('go', 1),
    call('e1', 'Edit', { file_path: EARLY }, 2),
    call('b1', 'Bash', { command: 'echo', file_path: 'C:\\proj\\odd\\tasks\\bash.md' }, 3),
    { ...call('e2', 'Edit', { file_path: 'C:\\proj\\odd\\tasks\\side.md' }, 4), isSidechain: true },
    call('e3', 'Edit', { file_path: LAST }, 5),
    call('e4', 'Write', { file_path: 'C:\\proj\\README.md' }, 5),
    compaction(6, 'auto', 900, 300, { uuid: 'b1' }),
    call('e5', 'Edit', { file_path: 'C:\\proj\\odd\\tasks\\after.md' }, 7),
  );
  const asked = [];
  const kept = (query) => {
    asked.push(query);
    return { known: true, kept: false };
  };
  const [measure] = lib.compactionMeasures(text, { told: () => ({ known: true, at: at(2) }), kept });
  assert.equal(measure.document, LAST);
  assert.deepEqual(asked, [{ document: LAST, after: at(2), before: at(6) }]);
  assert.deepEqual(measure.verdict, { told: true, kept: false, missing: ['kept'] });
});

test('compactionMeasures of two compactions of the host in one file: the second stretch starts at the first, and told is asked with each stretch\'s own bounds', () => {
  const asked = [];
  const told = (after, before) => {
    asked.push(['told', after, before]);
    return { known: true, at: after === null ? at(2) : at(4) };
  };
  const text = transcript(
    prompt('go', 1),
    reply('one', 2),
    compaction(3, 'auto', 900, 300, { uuid: 'b1' }),
    prompt('again', 4),
    reply('Saved.', 5),
    compaction(6, 'auto', 800, 200, { uuid: 'b2' }),
  );
  const [first, second] = lib.compactionMeasures(text, { told });
  assert.equal(first.after, null);
  assert.equal(second.after, at(3));
  assert.deepEqual(first.verdict, { told: true, kept: null, missing: [] });
  assert.deepEqual(second.verdict, { told: true, kept: null, missing: [] });
  assert.deepEqual(asked, [['told', null, at(3)], ['told', at(3), at(6)]]);
});

test('compactionMeasures counts a copied entry once: a copy of the first boundary before the second adds no item and moves no line', () => {
  const early = id('p1', prompt('early', 1));
  const earlyReply = id('r1', reply('early answer', 2));
  const boundary = id('b1', compaction(3, 'auto', 900, 300));
  const stretchPrompt = id('p2', prompt('stretch', 4));
  const stretchReply = id('r2', reply('Saved.', 5));
  const newest = id('b2', compaction(6, 'auto', 800, 200));
  const text = transcript(early, earlyReply, boundary, stretchPrompt, stretchReply, boundary, early, earlyReply, stretchPrompt, stretchReply, newest);
  const measures = lib.compactionMeasures(text, { told: () => ({ known: true, at: at(2) }) });
  assert.deepEqual(measures.map(({ uuid, line, after }) => [uuid, line, after]), [['b1', 3, null], ['b2', 11, at(3)]]);
  assert.deepEqual(measures[1].verdict, { told: true, kept: null, missing: [] });
});

test('compactionMeasures of a file the host continued holds no stretch of this file: it is not judged and no reader is asked', () => {
  const asked = [];
  const reader = (...args) => {
    asked.push(args);
    return { known: true, at: at(2), kept: true };
  };
  const text = transcript(id('b1', compaction(3, 'auto', 900, 300)), id('p2', prompt('resumed', 4)), reply('after the resume', 5));
  const [measure] = lib.compactionMeasures(text, { told: reader, kept: reader });
  assert.deepEqual([measure.inThisFile, measure.verdict], [false, null]);
  assert.deepEqual(asked, []);
});

test('compactionMeasures reads a reader that throws as not known, and throws nothing', () => {
  const text = transcript(
    prompt('go', 1),
    call('e1', 'Edit', { file_path: 'C:\\proj\\odd\\tasks\\session-channel.md' }, 2),
    reply('Saved.', 4),
    compaction(6, 'auto', 900, 300, { uuid: 'b1' }),
  );
  const broken = () => {
    throw new Error('unreadable');
  };
  const toldThrows = lib.compactionMeasures(text, { told: broken, kept: broken })[0];
  assert.deepEqual([toldThrows.told, toldThrows.verdict], [{ known: false, at: null }, { told: null, kept: null, missing: [] }]);
  const keptThrows = lib.compactionMeasures(text, { told: () => ({ known: true, at: at(2) }), kept: broken })[0];
  assert.deepEqual([keptThrows.kept, keptThrows.verdict], [{ known: false, kept: null }, { told: true, kept: null, missing: [] }]);
});

test('compactionMeasures counts a compaction the user asked for, judges none and asks no one', () => {
  const asked = [];
  const reader = (name) => (...args) => {
    asked.push([name, ...args]);
    return { known: true, at: at(2), kept: true };
  };
  const text = transcript(prompt('go', 1), reply('answer', 2), compaction(3, 'manual', 900, 300, { uuid: 'm1' }));
  assert.deepEqual(lib.compactionMeasures(text, { told: reader('told'), kept: reader('kept') }), [
    { uuid: 'm1', at: at(3), automatic: false, before: 900, line: 3, after: null, inThisFile: true, told: { known: false, at: null }, document: null, kept: { known: false, kept: null }, verdict: null },
  ]);
  assert.deepEqual(asked, []);
});

test('replyOf gives the text of the session\'s own reply, its text blocks joined with a blank line, and its time', () => {
  const twoParts = { type: 'assistant', ...base(2), message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'first' }, { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: {} }, { type: 'text', text: 'second' }] } };
  const text = transcript(prompt('go', 1), twoParts);
  assert.deepEqual(lib.replyOf(text, 2), { reply: true, at: at(2), text: 'first\n\nsecond' });
  assert.deepEqual(lib.replyOf(text, 1), { reply: false, what: 'the person\'s entry' });
});

test('replyOf refuses, in words, every line that is not the session\'s own reply with text, as quoteOf does for the person\'s', () => {
  const harnessWrote = { type: 'assistant', ...base(6), message: { role: 'assistant', model: '<synthetic>', stop_reason: 'stop_sequence', content: [{ type: 'text', text: 'Request failed' }] } };
  const text = transcript(
    prompt('typed', 1),
    peer(2),
    result('toolu_1', { stdout: '' }, 3),
    { ...reply('a side chain', 4), isSidechain: true },
    call('toolu_2', 'Bash', { command: 'ls' }, 5),
    harnessWrote,
    '{"type":"assistant","message":{"content":[{"type":"te',
    '',
    queued(9),
  );
  const said = (line) => lib.replyOf(text, line);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((line) => said(line).what), [
    'the person\'s entry',
    'a message from another session ("JH 1 · made up")',
    'the result of a tool call',
    'a reply of a side chain',
    'a reply with no text block: only tool calls and thinking',
    'a reply the harness wrote itself, not the session',
    'not an entry: the line does not parse',
    'an empty line',
    'the person\'s entry',
  ]);
  assert.deepEqual(said(10), { reply: false, what: 'no line of the transcript, which has 9 lines' });
  assert.deepEqual(said(1.5), { reply: false, what: 'no line of the transcript, which has 9 lines' });
  // No line is both the person's words and the session's reply.
  for (let line = 1; line <= 9; line += 1) assert.ok(!(lib.quoteOf(text, line).person && said(line).reply), `line ${line}`);
});

test('replyOf answers in words, and never throws, for an attachment that is no queued command and for an entry that is no reply', () => {
  const hookSuccess = { type: 'attachment', ...base(1), attachment: { type: 'hook_success', hookName: 'SessionStart' } };
  const noAttachment = { type: 'attachment', ...base(2) };
  const system = { type: 'system', subtype: 'informational', ...base(3), content: 'made up' };
  const text = transcript(hookSuccess, noAttachment, system);
  assert.deepEqual(lib.replyOf(text, 1), { reply: false, what: 'an attachment of type "hook_success": the host wrote it, not the person' });
  assert.deepEqual(lib.replyOf(text, 2), { reply: false, what: 'an entry of type "attachment" that holds no attachment' });
  assert.deepEqual(lib.replyOf(text, 3), { reply: false, what: 'an entry of type "system"' });
});

// T4d: what the person sends while the session works is not written as a `user` entry. The host queues it
// and writes an entry of type `attachment` whose `attachment` is a `queued_command`. From a tally of this
// project's transcripts (2026-10-11, 56 files, keys and values only, no text read), 310 such attachments:
// 28 of the person (`commandMode: "prompt"`, `origin: { kind: "human" }`, `humanTurn: true`, the prompt a
// string, no `isMeta`), none of which is also a `user` entry of the transcript; 52 from another session
// (`origin.kind: "peer"` with the sender's `name`, `isMeta: true`); 228 task notifications (219 with that
// origin, 9 with none); and 2 prompts with no origin. Only the 28 carry `humanTurn`.
const queued = (minute, attachment = {}, more = {}) => ({
  type: 'attachment',
  ...base(minute),
  attachment: { type: 'queued_command', prompt: 'made up while it worked', source_uuid: 's1', delivery_id: 'd1', commandMode: 'prompt', origin: { kind: 'human' }, timestamp: at(minute), humanTurn: true, ...attachment },
  ...more,
});

test('quoteOf takes a message the person sent while the session worked: a queued command of origin human that the host marks as his turn', () => {
  const text = transcript(reply('working', 1), queued(2), queued(3, { prompt: `${pasted('Sos JH 5.')}\n` }), queued(4, { prompt: `Dale:\n${pasted('Sos JH 5.')}` }), { ...queued(5), timestamp: undefined });
  assert.deepEqual(lib.quoteOf(text, 2), { person: true, at: at(2), text: 'made up while it worked', images: 0, pastedOnly: false, queued: true });
  // A paste alone is not his word there either, and one with a line typed before it is.
  assert.deepEqual([lib.quoteOf(text, 3).pastedOnly, lib.quoteOf(text, 4).pastedOnly], [true, false]);
  // The time is the entry's, and the attachment's own when the entry has none.
  assert.equal(lib.quoteOf(text, 5).at, at(5));
  assert.equal(lib.quoteOf(transcript({ ...queued(5, { timestamp: undefined }), timestamp: undefined }), 1).at, null);
});

// Host 2.1.299 (2026-10-17) queues his message as a list of text blocks: the first holds the host's own
// reminders, each a `<system-reminder>` block, and the last his words (e152c9d8, line 20374, keys and lengths read).
test('quoteOf takes his words from a queued list of text blocks, and leaves out the reminders the host queued with them', () => {
  const reminders = '<system-reminder>\nThe session "made up" finished a turn.\n</system-reminder>\n<system-reminder>\nLinked sessions now: made up.\n</system-reminder>\n\n';
  const text = transcript(
    queued(1, { prompt: [{ type: 'text', text: reminders }, { type: 'text', text: 'made up while it worked, from a phone' }] }),
    queued(2, { prompt: [{ type: 'text', text: `${reminders}Dale` }, { type: 'image', source: {} }, { type: 'text', text: 'la A' }] }),
    queued(3, { prompt: [{ type: 'text', text: pasted('Sos JH 5.') }] }),
  );
  assert.deepEqual(lib.quoteOf(text, 1), { person: true, at: at(1), text: 'made up while it worked, from a phone', images: 0, pastedOnly: false, queued: true });
  assert.deepEqual([lib.quoteOf(text, 2).text, lib.quoteOf(text, 2).images], ['Dale\nla A', 1]);
  assert.equal(lib.quoteOf(text, 3).pastedOnly, true);
  // Only the reminders that open the first block are the host's: a tag he typed in his own words stays his, even at
  // the start of his block.
  const his = '<system-reminder>esto</system-reminder> lo escribí yo';
  assert.equal(lib.quoteOf(transcript(queued(4, { prompt: [{ type: 'text', text: reminders }, { type: 'text', text: his }] })), 1).text, his);
});

test('quoteOf refuses every other attachment and says what it is: another origin, no turn of his, no text, another type', () => {
  const lines = [
    queued(1, { origin: { kind: 'peer', name: 'JH 1 · made up', from: 'local_1', body: 'made up' }, isMeta: true, humanTurn: undefined }),
    queued(2, { commandMode: 'task-notification', origin: { kind: 'task-notification', producer: 'made up' }, humanTurn: undefined, prompt: notice({ task: 'b1', status: 'completed' }) }),
    queued(3, { commandMode: 'task-notification', origin: undefined, humanTurn: undefined }),
    queued(4, { origin: undefined, isMeta: true, humanTurn: undefined }),
    queued(5, { humanTurn: undefined }),
    queued(6, { humanTurn: false }),
    queued(7, { humanTurn: 'true' }),
    queued(8, { origin: 'human' }),
    queued(9, { origin: { kind: 'something-new' } }),
    queued(10, { prompt: [{ type: 'text', text: '<system-reminder>\nmade up\n</system-reminder>\n\n' }, { type: 'image', source: {} }] }),
    queued(11, { prompt: undefined }),
    { type: 'attachment', ...base(12), attachment: { type: 'hook_success', stdout: 'made up', origin: { kind: 'human' }, humanTurn: true, prompt: 'made up' } },
    { type: 'attachment', ...base(13), attachment: null },
    { type: 'attachment', ...base(14) },
    // The marks of a queued message on a `user` entry, or outside the attachment, make nothing his.
    { type: 'attachment', ...base(15), origin: { kind: 'human' }, humanTurn: true, prompt: 'made up', attachment: { type: 'queued_command', prompt: 'made up' } },
  ];
  const text = transcript(...lines);
  const said = lines.map((_, index) => lib.quoteOf(text, index + 1));
  assert.deepEqual(said.map((quote) => quote.what), [
    'a queued message from another session ("JH 1 · made up")',
    'a queued task notification',
    'a queued task notification',
    'a queued message that records no origin: it cannot be told whose it is',
    'a queued message of origin "human" that the host does not mark as a turn of the person',
    'a queued message of origin "human" that the host does not mark as a turn of the person',
    'a queued message of origin "human" that the host does not mark as a turn of the person',
    'a queued message that records no origin: it cannot be told whose it is',
    'a queued message of origin "something-new"',
    'a queued message of the person that holds no text to quote',
    'a queued message of the person that holds no text to quote',
    'an attachment of type "hook_success": the host wrote it, not the person',
    'an entry of type "attachment" that holds no attachment',
    'an entry of type "attachment" that holds no attachment',
    'a queued message that records no origin: it cannot be told whose it is',
  ]);
  for (const quote of said) assert.deepEqual(Object.keys(quote), ['person', 'what']);
  assert.ok(said.every((quote) => quote.person === false));
});

// Review of 5af56c1..303d9ea, finding 1: the task accounting read `user` entries only, so an instruction
// sent while the session worked started no task and the work after it stayed with the task before. From
// a tally of this project's transcripts (2026-10-11, 56 files, keys only, each entry once): 25 queued
// commands of the person and 49 of origin `peer`, 4 of which a subagent handed back (`handback: true`);
// none of the 74 comes after a reply that closed its turn, and a reply follows every one. The test sits
// here, with the shape of a queued command, and belongs to the tests of the last task.
test('a queued instruction of the person or of another session starts a task, as a user entry of its origin does', () => {
  const fromSession = { origin: { kind: 'peer', name: 'JH 1 · made up', from: 'local_1', body: 'made up' }, isMeta: true, humanTurn: undefined };
  const held = COMPACTION - 35000; // what the session ends with: 35k of room before the host compacts
  const worked = (...sent) => [prompt('first', 1), spoke(2, usage(0, held - 80000, 0), { stop: 'tool_use' }), spoke(3, usage(0, held - 20000, 0), { stop: 'tool_use' }), ...sent];
  const session = (...sent) => lib.sessionFacts(transcript(...worked(...sent), spoke(5, usage(0, held, 0))));

  // With nothing sent in between it is one task of 80k, which no longer fits.
  const plain = session();
  assert.deepEqual([plain.lastTask.tokens, plain.lastTaskFits], [80000, false]);
  // What he sent while it worked ends that task there and starts one: 20k, which fits.
  const his = session(queued(4));
  assert.deepEqual(his.lastTask, { tokens: 20000, startedBy: 'person', startedAt: at(4), endedAt: at(5), compactions: 0 });
  assert.equal(his.lastTaskFits, true, '35k of room, 20k of task');
  const theirs = session(queued(4, fromSession));
  assert.deepEqual(theirs.lastTask, { tokens: 20000, startedBy: 'session', startedAt: at(4), endedAt: at(5), compactions: 0 });
  // The time is the entry's, and the attachment's own when the entry has none.
  assert.equal(session({ ...queued(4), timestamp: undefined }).lastTask.startedAt, at(4));
  // Until its reply is written the session works on it, and the last task is the one it ended.
  const unanswered = lib.sessionFacts(transcript(...worked(queued(4))));
  assert.deepEqual([unanswered.state, unanswered.lastTask], ['working', { tokens: 60000, startedBy: 'person', startedAt: at(1), endedAt: at(3), compactions: 0 }]);

  // It moves the task accounting and nothing else, but the time of his newest entry: what he queued is his, so
  // personAt moves to its minute, and one from another session is not his and leaves personAt where it was.
  // Otherwise the state of the row, the end of its turn, the messages it received and every other fact are
  // the ones of the transcript without it. One from another session is also a message the session received.
  const rest = ({ lastTask, lastTaskFits, personAt, ...others }) => others;
  assert.deepEqual([his.personAt, theirs.personAt], [at(4), plain.personAt]);
  assert.equal(plain.personAt, at(1));
  assert.deepEqual(rest(his), rest(plain));
  assert.deepEqual(rest({ ...theirs, received: [] }), rest(plain));
  assert.deepEqual(theirs.received, [{ at: at(4), from: 'session', name: 'JH 1 · made up', session: null, mode: null, id: null }]);

  // Nothing else that is queued, or attached, is an instruction of anyone: the end of a task (said in
  // either of its two places, and before any origin), what a subagent hands back, what the app puts in,
  // a message that records no origin or one not known, a meta one, a side chain's, another attachment.
  const notInstructions = [
    queued(4, { commandMode: 'task-notification', origin: { kind: 'task-notification', producer: 'made up' }, humanTurn: undefined, prompt: notice({ task: 'b1', status: 'completed' }) }),
    queued(4, { commandMode: 'task-notification', origin: undefined, humanTurn: undefined }),
    queued(4, { commandMode: 'task-notification' }),
    queued(4, { ...fromSession, origin: { ...fromSession.origin, handback: true } }),
    queued(4, { ...fromSession, origin: { ...fromSession.origin, hostInjected: true } }),
    queued(4, { origin: undefined, isMeta: true, humanTurn: undefined }),
    queued(4, { origin: 'human' }),
    queued(4, { origin: { kind: 'something-new' } }),
    queued(4, { isMeta: true }),
    queued(4, {}, { isSidechain: true }),
    { type: 'attachment', ...base(4), attachment: { type: 'hook_success', stdout: 'made up', origin: { kind: 'human' }, humanTurn: true, prompt: 'made up' } },
    { type: 'attachment', ...base(4), origin: { kind: 'human' }, humanTurn: true, prompt: 'made up', attachment: null },
  ];
  for (const [index, entry] of notInstructions.entries()) assert.equal(session(entry).lastTask.tokens, 80000, `entry ${index} starts no task`);

  // A queued end of a task is still read as the end of its work, and starts no task.
  const ended = lib.sessionFacts(transcript(prompt('first', 1), spoke(2, usage(0, held - 80000, 0), { stop: 'tool_use' }), ...backgroundBash('toolu_1', 'b1', 3), notInstructions[0], spoke(5, usage(0, held, 0))));
  assert.deepEqual([ended.work.map((item) => item.status), ended.state, ended.lastTask.tokens], [['completed'], 'waiting', 80000]);
});

// A queued command that names a subagent by `senderTaskId` and carries no `handback` is a hand-back as well.
// The tally of this project's transcripts (2026-10-11, 262 transcripts) has `senderTaskId` on 19 hand-backs
// that also carry `handback: true`, on 1 queued command with no `handback`, and on no message of another
// session, which gives `fromSession` instead. Read as another session's, that one started a task for the
// board, and the task before it cost 20k where it cost 80k.
test('a queued command that names a subagent by senderTaskId starts no task, with or without handback', () => {
  const held = COMPACTION - 35000;
  const worked = (...sent) => [prompt('first', 1), spoke(2, usage(0, held - 80000, 0), { stop: 'tool_use' }), spoke(3, usage(0, held - 20000, 0), { stop: 'tool_use' }), ...sent];
  const session = (...sent) => lib.sessionFacts(transcript(...worked(...sent), spoke(5, usage(0, held, 0))));
  const named = { kind: 'peer', senderTaskId: 'a1f', name: 'made up' };

  const plain = session();
  const withHandback = session(queued(4, { origin: { ...named, handback: true }, isMeta: true, humanTurn: undefined }));
  const withoutHandback = session(queued(4, { origin: named, isMeta: true, humanTurn: undefined }));
  assert.deepEqual(withHandback.lastTask, plain.lastTask);
  assert.deepEqual(withoutHandback.lastTask, plain.lastTask, 'the growth since the instruction the person gave, not the growth after the hand-back');
  assert.deepEqual([withoutHandback.lastTask.tokens, withoutHandback.lastTaskFits], [80000, false]);
});

test('the board keeps a peer message that names a subagent by senderTaskId as a hand-back, queued or between turns', () => {
  const named = { kind: 'peer', senderTaskId: 'a1f', name: 'made up' };
  const queuedOne = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 1000, 0), { stop: 'tool_use' }), queued(3, { origin: named, isMeta: true, humanTurn: undefined }), spoke(9, usage(0, 2000, 0))));
  const betweenTurns = lib.sessionFacts(transcript(prompt('go', 1), { ...peer(3), origin: named }, reply('done', 9)));
  const message = { at: at(3), from: 'subagent', name: 'made up', session: null, mode: null, id: null };
  assert.deepEqual(queuedOne.received, [message]);
  assert.deepEqual(betweenTurns.received, [message]);
});

// A message of another session that arrives while the session works is a queued command as well, and the
// list of what a session received read `user` entries only: the board then said of such a message that
// it was not seen to arrive, with the receiver's transcript holding it. From a tally of this project's
// transcripts (2026-10-11, 56 files, keys only): 52 queued commands of origin `peer`, each with the origin
// a `user` entry carries on itself inside the attachment and the same time on the entry and on the
// attachment. 46 give the sender's `name`, `fromSession`, `fromMode` and `msg_id`, 4 are hand-backs of a
// subagent and 2 name no message. None has the id of a `user` entry of any transcript, so the two shapes
// of one message are a case no transcript shows; 3 are entries a resumed session wrote again.
const queuedPeer = (minute, origin = {}, more = {}) => queued(minute, { origin: { ...peer(minute).origin, ...origin }, isMeta: true, humanTurn: undefined }, more);
const queuedHandback = (minute, more = {}) => queued(minute, { origin: handback(minute).origin, isMeta: true, humanTurn: undefined, delivery_id: undefined }, more);
const queuedInjected = (minute, content = delivered()) => queued(minute, { origin: injected(minute).origin, isMeta: true, humanTurn: undefined, prompt: content });

test('sessionFacts lists a message that arrived while the session worked as it lists one that arrived between turns', () => {
  const worked = (...arrived) => lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 1000, 0), { stop: 'tool_use' }), ...arrived, spoke(9, usage(0, 2000, 0))));
  const second = { name: 'JH ORQ · made up', fromSession: 'local_sender-9', msg_id: 'msg-2', hopChain: ['x'] };
  const facts = worked(queuedPeer(3), queuedPeer(4, second), queuedHandback(5), queuedInjected(6, 'made up'));
  assert.deepEqual(facts.received, [
    { at: at(3), from: 'session', name: 'JH 1 · made up', session: 'local_sender-1', mode: 'bypass', id: 'msg-1' },
    { at: at(4), from: 'session', name: 'JH ORQ · made up', session: 'local_sender-9', mode: 'bypass', id: 'msg-2' },
    { at: at(5), from: 'subagent', name: null, session: null, mode: null, id: null },
    { at: at(6), from: 'host', name: null, session: null, mode: 'bypass', id: null },
  ]);
  // Each is the message its `user` entry would have been: the same fields, from the same origin.
  const between = lib.sessionFacts(transcript(prompt('go', 1), peer(3), peer(4, second), handback(5), injected(6, 'made up'), reply('done', 9)));
  assert.deepEqual(facts.received, between.received);
  // The time is the entry's, and the attachment's own when the entry has none.
  assert.deepEqual(worked({ ...queuedPeer(3), timestamp: undefined }).received.map((message) => message.at), [at(3)]);
  assert.deepEqual(worked({ ...queuedPeer(3, {}, { timestamp: undefined }), attachment: { ...queuedPeer(3).attachment, timestamp: undefined } }).received.map((message) => message.at), [null]);

  // One message is listed once: written in both shapes, written again by a resumed session, or both.
  const once = worked(queuedPeer(3), peer(4), { ...queuedPeer(5, second), uuid: 'u-5' }, { ...queuedPeer(5, second), uuid: 'u-5' }, queuedPeer(6, second));
  assert.deepEqual(once.received.map((message) => [message.id, message.at]), [['msg-1', at(3)], ['msg-2', at(5)]]);
  // Two with no id of their own are told apart by the entry that holds each.
  const twice = worked({ ...queuedHandback(3), uuid: 'u-1' }, { ...queuedHandback(4), uuid: 'u-2' }, { ...queuedHandback(3), uuid: 'u-1' });
  assert.deepEqual(twice.received.map((message) => message.at), [at(3), at(4)]);

  // Nothing else that is queued, or attached, is a message from anybody: what he sent, the end of a task
  // (which the host says in either of two places, whatever origin stands beside it), a side chain's, an
  // origin that is no object or of a kind not known, and the marks of a message outside a queued command.
  const others = [
    queued(3),
    queued(3, { commandMode: 'task-notification', origin: { kind: 'task-notification', producer: 'made up' }, humanTurn: undefined, prompt: notice({ task: 'b1', status: 'completed' }) }),
    queued(3, { commandMode: 'task-notification', origin: peer(3).origin, humanTurn: undefined }),
    queuedPeer(3, {}, { isSidechain: true }),
    queued(3, { origin: 'peer' }),
    queued(3, { origin: { kind: 'something-new', msg_id: 'msg-1' } }),
    { type: 'attachment', ...base(3), attachment: { type: 'hook_success', stdout: 'made up', origin: peer(3).origin } },
    { type: 'attachment', ...base(3), origin: peer(3).origin, attachment: null },
  ];
  for (const [index, entry] of others.entries()) assert.deepEqual(worked(entry).received, [], `entry ${index} is no message`);
});

test('a message that arrived while the session worked moves the list of what it received and the task it starts, and nothing of the row', () => {
  const worked = (...arrived) => lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 1000, 0), { stop: 'tool_use' }), ...arrived, spoke(9, usage(0, 2000, 0))));
  const rest = ({ received, lastTask, lastTaskFits, ...others }) => others;
  assert.equal(worked(queuedPeer(3)).received.length, 1);
  assert.deepEqual(rest(worked(queuedPeer(3))), rest(worked()));
  // A hand-back and a message of the app start no task either: the list is all they move.
  for (const arrived of [queuedHandback(3), queuedInjected(3, 'made up')]) assert.deepEqual({ ...worked(arrived), received: [] }, worked());

  // The state of the row is read from `user` and assistant entries, as before: a queued command says
  // nothing of the turn. After a reply that ended it the row still waits, where a `user` entry of
  // another session starts a turn. No transcript of the tally above holds a queued command there.
  const idle = (...arrived) => lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), ...arrived));
  assert.deepEqual([idle().state, idle().turnEndedAt], ['waiting', at(2)]);
  assert.deepEqual([idle(queuedPeer(3)).state, idle(queuedPeer(3)).turnEndedAt], ['waiting', at(2)]);
  assert.deepEqual(idle(queuedPeer(3)).received.map((message) => message.id), ['msg-1']);
  // And while a tool runs it still works.
  const running = (...arrived) => lib.sessionFacts(transcript(prompt('go', 1), call('toolu_1', 'Bash', { command: 'made up' }, 2), ...arrived));
  assert.deepEqual([running().state, running(queuedPeer(3)).state], ['working', 'working']);
});

test('channelOf sees a message arrive that its receiver got while it worked, and takes no hand-back for one', () => {
  const sender = lib.sessionFacts(transcript(prompt('go', 1), send('toolu_m1', { to: 'JH 2 · made up', recipient_kind: 'name' }, 2), result('toolu_m1', { success: true, msg_id: 'msg-1', display: 'made up', message: 'made up' }, 2)));
  const board = (...arrived) => [
    { id: A, ...sender },
    { id: B, ...lib.sessionFacts(transcript(prompt('build', 1), spoke(2, usage(0, 1000, 0), { stop: 'tool_use' }), ...arrived, spoke(9, usage(0, 2000, 0)))) },
  ];
  const seen = (...arrived) => lib.channelOf(recordOf(), board(...arrived)).messages.map((message) => [message.id, message.state, message.to.session]);
  assert.deepEqual(seen(), [['msg-1', 'not-seen', null]]);
  assert.deepEqual(seen(queuedPeer(3)), [['msg-1', 'arrived', B]]);
  assert.deepEqual(seen(peer(3)), [['msg-1', 'arrived', B]], 'as one that arrived between turns');
  // What a subagent handed back or the app put in is no message of a session, whatever id it carries.
  assert.deepEqual(seen(queuedPeer(3, { handback: true })), [['msg-1', 'not-seen', null]]);
  assert.deepEqual(seen(queuedPeer(3, { hostInjected: true })), [['msg-1', 'not-seen', null]]);
});

// `sessions --quote` said of every queued command of origin `peer` that it was a message from another
// session, the 4 hand-backs of the tally above among them (and with the name "no name", since a hand-back
// gives none). It refused them, rightly; the reason now says what each is, by the rule a `user` entry is
// told by (`peerSender`).
test('quoteOf refuses a queued hand-back of a subagent and a queued message of the app, and names each as what it is', () => {
  const origins = [{}, { handback: true }, { hostInjected: true }];
  const text = transcript(...origins.map((origin, index) => peer(index + 1, origin)), ...origins.map((origin, index) => queuedPeer(index + 4, origin)), queuedHandback(7), queuedInjected(8, 'made up'), queuedPeer(9, { name: undefined }));
  const said = Array.from({ length: 9 }, (_, index) => lib.quoteOf(text, index + 1));
  assert.deepEqual(said.map((quote) => quote.what), [
    'a message from another session ("JH 1 · made up")',
    'what a subagent handed back',
    'a message the app put in',
    'a queued message from another session ("JH 1 · made up")',
    'a queued hand-back of a subagent',
    'a queued message the app put in',
    'a queued hand-back of a subagent',
    'a queued message the app put in',
    'a queued message from another session ("no name")',
  ]);
  // None is the person's: `sessions --quote` exits 1 on each.
  for (const quote of said) assert.deepEqual([quote.person, Object.keys(quote)], [false, ['person', 'what']]);
});

// --- a message the app delivered for a session ---
//
// What one session sends another with the app's own tool arrives as a message of origin `peer` that the host
// marks `hostInjected`, and its text begins with the wrapper that names the sender. A count of this project's
// transcripts (2026-10-12, 57 files, each entry once by its `uuid`) found 147 such origins: 144 on `user`
// entries and 3 on queued commands, every one with that text, and none with `fromSession`, `name` or `msg_id`.
// The sender is the wrapper's, and the message is a session's: an instruction of an orchestrator starts a task.

test('a message the app delivered for a session is a message of that session, between turns and while it works', () => {
  const between = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), injected(3, delivered('JH ORQ · js-harness')), reply('noted', 4)));
  assert.deepEqual(between.received, [{ at: at(3), from: 'session', name: 'JH ORQ · js-harness', session: 'local_sender-2', mode: 'bypass', id: null }]);
  const worked = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 1000, 0), { stop: 'tool_use' }), queuedInjected(3, delivered('JH ORQ · js-harness')), spoke(9, usage(0, 2000, 0))));
  assert.deepEqual(worked.received, between.received);
});

test('an instruction the app delivered for a session starts a task, as one of another session does, as a user entry or queued', () => {
  const held = COMPACTION - 35000;
  const worked = (...sent) => [prompt('first', 1), spoke(2, usage(0, held - 80000, 0), { stop: 'tool_use' }), spoke(3, usage(0, held - 20000, 0), { stop: 'tool_use' }), ...sent];
  const session = (...sent) => lib.sessionFacts(transcript(...worked(...sent), spoke(5, usage(0, held, 0))));
  const plain = session();
  assert.deepEqual([plain.lastTask.tokens, plain.lastTaskFits], [80000, false]);
  const queuedOne = session(queuedInjected(4, delivered('JH ORQ · js-harness')));
  assert.deepEqual(queuedOne.lastTask, { tokens: 20000, startedBy: 'session', startedAt: at(4), endedAt: at(5), compactions: 0 });
  const userEntry = session(injected(4, delivered('JH ORQ · js-harness')));
  assert.deepEqual(userEntry.lastTask, { tokens: 20000, startedBy: 'session', startedAt: at(4), endedAt: at(5), compactions: 0 });
});

test('a message the app put in, with text no session wrote, starts no task and is no message of a session', () => {
  const held = COMPACTION - 35000;
  const worked = (...sent) => [prompt('first', 1), spoke(2, usage(0, held - 80000, 0), { stop: 'tool_use' }), spoke(3, usage(0, held - 20000, 0), { stop: 'tool_use' }), ...sent];
  const session = (...sent) => lib.sessionFacts(transcript(...worked(...sent), spoke(5, usage(0, held, 0))));
  const plain = session();
  assert.deepEqual(session(injected(4, 'made up')).lastTask, plain.lastTask);
  assert.deepEqual(session(queuedInjected(4, 'made up')).lastTask, plain.lastTask);
  // The wrapper counts only where the text begins with it: after other words it is the app's message.
  const middle = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), injected(3, `Hello. ${delivered()}`), reply('noted', 4)));
  assert.deepEqual(middle.received, [{ at: at(3), from: 'host', name: null, session: null, mode: 'bypass', id: null }]);
});

test('quoteOf names the sender of a message the app delivered for a session, as it names any other session', () => {
  const text = transcript(reply('working', 1), injected(2, delivered('JH ORQ · js-harness')), queuedInjected(3, delivered('JH ORQ · js-harness')));
  assert.deepEqual([lib.quoteOf(text, 2).what, lib.quoteOf(text, 3).what], ['a message from another session ("JH ORQ · js-harness")', 'a queued message from another session ("JH ORQ · js-harness")']);
});

test('a message the app delivered for a session and queued as a list of blocks is read as his queued words are: the session is named', () => {
  // Host 2.1.299 (2026-10-17) writes a queued prompt as a list, its own reminders opening the first block.
  const blocks = [{ type: 'text', text: '<system-reminder>\nmade up while it worked\n</system-reminder>\n\n' }, { type: 'text', text: delivered('JH ORQ · js-harness') }];
  const text = transcript(reply('working', 1), queuedInjected(2, blocks));
  assert.equal(lib.quoteOf(text, 2).what, 'a queued message from another session ("JH ORQ · js-harness")');
  assert.deepEqual(lib.compactionStretch(text).sessions, [{ line: 2, at: at(2), name: 'JH ORQ · js-harness' }]);
});

test('compactionStretch lists the messages the app delivered for a session among its sessions, with their titles', () => {
  const text = transcript(prompt('typed', 1), injected(2, delivered('JH ORQ · js-harness')), queuedInjected(3, delivered('JH ORQ · js-harness')), injected(4, 'made up'), reply('answer', 5));
  assert.deepEqual(lib.compactionStretch(text).sessions, [{ line: 2, at: at(2), name: 'JH ORQ · js-harness' }, { line: 3, at: at(3), name: 'JH ORQ · js-harness' }]);
});

test('the sender\'s title is read from the wrapper with its XML entities decoded once, and a wrapper with no title is still a session\'s', () => {
  const titled = (attributes, lead = '') => `${lead}Another Claude session sent a message: <cross-session-message ${attributes}>made up</cross-session-message>`;
  const received = (content) => lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), injected(3, content), reply('noted', 4))).received[0];
  assert.equal(received(titled('from="local_sender-2" name="JH &quot;ORQ&quot; &amp; co &lt;1&gt; &apos;x&apos;"')).name, 'JH "ORQ" & co <1> \'x\'');
  // Each entity is decoded once: `&amp;quot;` is the text `&quot;`, not a quote.
  assert.equal(received(titled('from="local_sender-2" name="a &amp;quot;b"')).name, 'a &quot;b');
  // Leading blanks are allowed before the wrapper.
  assert.equal(received(titled('from="local_sender-2" name="JH ORQ"', '\n  ')).from, 'session');
  for (const attributes of ['from="local_sender-2"', 'from="local_sender-2" name=""']) {
    assert.deepEqual(received(titled(attributes)), { at: at(3), from: 'session', name: null, session: 'local_sender-2', mode: 'bypass', id: null });
  }
  // The origin's `from` is the session; a wrapper with no `from` names no sender, so the message stays the app's.
  assert.equal(received(titled('name="JH ORQ"')).from, 'host');
});

test('the wrapper changes nothing outside a message the app delivered: not in a peer message that is not hostInjected, not in a hand-back', () => {
  const plain = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), peer(3), reply('noted', 4))).received;
  const wrapped = lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), peer(3, {}, { message: { role: 'user', content: delivered() } }), reply('noted', 4))).received;
  assert.deepEqual(wrapped, plain);
  assert.equal(plain[0].from, 'session');
  // A hand-back is a subagent's whatever else its origin carries, a wrapper and `hostInjected` included.
  const origin = injected(3).origin;
  const named = { ...injected(3, delivered()), origin: { ...origin, senderTaskId: 'a1f' } };
  const handed = { ...injected(3, delivered()), origin: { ...origin, handback: true } };
  const queuedHanded = queued(3, { origin: { ...origin, handback: true }, isMeta: true, humanTurn: undefined, prompt: delivered() });
  for (const entry of [named, handed, queuedHanded]) assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2), entry, reply('noted', 4))).received[0].from, 'subagent');
});

// --- the project a folder belongs to ---
//
// `mainCheckout` is shared by the board and by `notify`, which must name the same project from the same
// folder: the board's own tests (bin/sessions.test.mjs) go through every layout with a whole machine,
// and these pin the function where both take it from.

/** A fake `git rev-parse` that answers each list of options, joined by a space, from `answers`; anything
 * else fails as git does outside a repository. */
function revParse(answers) {
  const calls = [];
  const run = (command, args, { cwd }) => {
    calls.push({ command, args, cwd });
    const answer = answers[`${args.slice(1).join(' ')} @ ${cwd}`] ?? answers[args.slice(1).join(' ')];
    return answer === undefined ? { status: 128, stdout: '', stderr: 'fatal: not a git repository\n' } : { status: 0, stdout: `${answer}\n`, stderr: '' };
  };
  return { run, calls };
}

test('mainCheckout is the folder that holds the common git dir, from the checkout and from a linked worktree', () => {
  const here = nodePath.resolve('proj');
  const fromCheckout = revParse({ '--git-common-dir': '.git' });
  assert.equal(lib.mainCheckout(fromCheckout.run, here), here);
  assert.deepEqual(fromCheckout.calls, [{ command: 'git', args: ['rev-parse', '--git-common-dir'], cwd: here }]);
  const worktree = nodePath.resolve('proj-worktrees', 'board');
  assert.equal(lib.mainCheckout(revParse({ '--git-common-dir': nodePath.join(here, '.git').split(nodePath.sep).join('/') }).run, worktree), here);
});

test('mainCheckout is the folder itself outside a repository, and without git', () => {
  const here = nodePath.resolve('no-repository');
  assert.equal(lib.mainCheckout(revParse({}).run, here), here);
  assert.equal(lib.mainCheckout(() => ({ error: Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' }) }), here), here);
});

test('mainCheckout asks git for the working tree of a git dir kept apart from its checkout, and falls back on that git dir', () => {
  const here = nodePath.resolve('proj');
  const meta = nodePath.resolve('meta');
  // A submodule's git dir records its working tree.
  const recorded = revParse({ '--git-common-dir': meta, [`--show-toplevel @ ${meta}`]: here });
  assert.equal(lib.mainCheckout(recorded.run, here), here);
  // A `--separate-git-dir` checkout: the git dir records none, and the folder is the main working tree.
  const apart = revParse({ '--git-common-dir': meta, [`--git-dir --show-toplevel @ ${here}`]: `${meta}\n${here}` });
  assert.equal(lib.mainCheckout(apart.run, here), here);
  assert.deepEqual(apart.calls.map((made) => made.args.slice(1)), [['--git-common-dir'], ['--show-toplevel'], ['--git-dir', '--show-toplevel']]);
  // A worktree linked to such a checkout, a bare repository: nothing ties them to a checkout.
  const linked = revParse({ '--git-common-dir': meta, [`--git-dir --show-toplevel @ ${here}`]: `${nodePath.join(meta, 'worktrees', 'board')}\n${here}` });
  assert.equal(lib.mainCheckout(linked.run, here), meta);
  assert.equal(lib.mainCheckout(revParse({ '--git-common-dir': meta }).run, here), meta);
});

// --- the last automatic compaction that misses a fact (session channel, T9) ---

const compactionEntry = (uuid, trigger, minute) => ({ type: 'system', subtype: 'compact_boundary', uuid, ...base(minute), compactMetadata: { trigger, preTokens: 900, postTokens: 300 } });
const editEntry = (id, minute) => call(id, 'Edit', { file_path: 'odd/tasks/board.md', old_string: 'x', new_string: 'y' }, minute);
const miss = (minutes, uuid, missed, unknown = []) => ({ at: before(minutes * 60), uuid, missed, unknown });

test('compactionMissOf calls no reader for a session with no automatic compaction', () => {
  const calls = [];
  const readers = {
    told: (after, at) => calls.push(['told', after, at]),
    kept: (query) => calls.push(['kept', query]),
  };
  const none = transcript(prompt('go', 1), reply('done', 5));
  const manual = transcript(prompt('go', 1), editEntry('e1', 2), reply('done', 5), compactionEntry('m1', 'manual', 6), reply('again', 8));
  assert.equal(lib.compactionMissOf(none, readers), null);
  assert.equal(lib.compactionMissOf(manual, readers), null);
  assert.deepEqual(calls, []);
});

// The user no longer compacts by hand (odd/tasks/no-manual-compact.md S2): a pause told and kept is no miss, whether or
// not any reply holds a /compact block, so the board never asks anyone for one.
test('compactionMissOf: a pause told and kept, with no /compact block anywhere in the transcript, misses nothing', () => {
  const told = () => ({ known: true, at: at(2) });
  const blockless = transcript(prompt('go', 1), editEntry('e1', 2), reply('Saved. Going on.', 3), compactionEntry('b1', 'auto', 6), reply('working again', 8));
  assert.equal(lib.compactionMissOf(blockless, { told, kept: () => ({ known: true, kept: true }) }), null, 'the two facts hold: no miss, and no block is asked for');
});

test('compactionMissOf names the facts the last automatic compaction misses, and not the ones it cannot know', () => {
  const text = transcript(prompt('go', 1), editEntry('e1', 2), reply('Saved.', 3), compactionEntry('b1', 'auto', 6), reply('working again', 8));
  const told = () => ({ known: true, at: at(2) });
  assert.deepEqual(lib.compactionMissOf(text, { told, kept: () => ({ known: true, kept: false }) }), { at: at(6), uuid: 'b1', missed: ['kept'], unknown: [] });
  assert.deepEqual(lib.compactionMissOf(text, { told: () => ({ known: true, at: null }), kept: () => ({ known: false }) }), { at: at(6), uuid: 'b1', missed: ['told'], unknown: ['kept'] }, 'a reader that cannot answer is unknown, never a miss');
  assert.equal(lib.compactionMissOf(text, { told: () => { throw new Error('no state'); }, kept: () => ({ known: true, kept: false }) }), null, 'a reader that throws leaves nothing to miss');
  assert.equal(lib.compactionMissOf(text, { told, kept: () => ({ known: true, kept: true }) }), null, 'a last automatic compaction that misses nothing has no miss');
});

test('renderBoard prints the miss of the last automatic compaction under its session, with what it could not know', () => {
  const lines = (compactionMiss) => lib.renderBoard({ ...BOARD, sessions: [seen(A, 'working', { compactionMiss })] }, { now: NOW }).filter((line) => line.includes('last automatic compaction'));
  assert.deepEqual(lines(miss(10, 'b1', ['told', 'kept'])), ['    last automatic compaction 10m ago: missed told, kept']);
  assert.deepEqual(lines(miss(10, 'b1', ['told'], ['kept'])), ['    last automatic compaction 10m ago: missed told; not known: kept']);
  assert.deepEqual(lines(miss(10, 'b1', [], ['kept'])), [], 'only facts not known say nothing');
  assert.deepEqual(lines(null), []);
});

test('boardChanges says a new miss of the last automatic compaction once, and says a later compaction that misses again', () => {
  const said = `session aaaaaaaa "title a": its last automatic compaction missed told`;
  const withMiss = (compactionMiss) => ({ sessions: [seen(A, 'working', { compactionMiss })] });
  assert.deepEqual(changes(withMiss(null), withMiss(miss(2, 'c1', ['told']))), [said]);
  assert.deepEqual(changes(withMiss(miss(2, 'c1', ['told'])), withMiss(miss(2, 'c1', ['told']))), [], 'the same compaction is not said twice');
  assert.deepEqual(changes(withMiss(miss(2, 'c1', ['told'])), withMiss(miss(1, 'c2', ['told']))), [said], 'a later compaction that misses is said');
  assert.deepEqual(changes(withMiss(miss(2, 'c1', ['told'])), withMiss(null)), [], 'a compaction that misses nothing is not said');
  assert.deepEqual(changes(withMiss(null), withMiss(miss(2, 'c1', ['told'])), { self: A }), [], 'the watching session is never said');
  assert.deepEqual(changes({ sessions: [] }, withMiss(miss(2, 'c1', ['told']))), [`session aaaaaaaa "title a" appeared (working)`], 'a session that appears is not compared');
  assert.deepEqual(changes({ sessions: [{ id: A, unavailable: 'EACCES' }] }, withMiss(miss(2, 'c1', ['told']))), [`session aaaaaaaa "title a" appeared (working): its transcript could not be read until now`], 'an unreadable look is not compared');
});

test('watchBaseline keeps the miss a failed reader leaves unknown, so the same compaction is said once across the failed read', () => {
  const look = (compactionMiss) => boardOf({ sessions: [seen(A, 'working', { compactionMiss })] });
  const missed = (uuid, facts) => ({ at: before(150), uuid, missed: facts, unknown: [] });
  const said = (facts) => `session aaaaaaaa "title a": its last automatic compaction missed ${facts}`;
  const chain = (boards) => {
    const chained = [];
    let baseline = look(null);
    for (const board of boards) {
      chained.push(...lib.boardChanges(baseline, board));
      baseline = lib.watchBaseline(baseline, board);
    }
    return chained;
  };
  assert.deepEqual(lib.watchBaseline(look(missed('u1', ['told'])), look(null)).sessions[0].compactionMiss, missed('u1', ['told']), 'a null read keeps the miss the look before named');
  assert.deepEqual(chain([look(missed('u1', ['told'])), look(null), look(missed('u1', ['told']))]), [said('told')], 'the same compaction after a failed read is not said again');
  assert.deepEqual(chain([look(missed('u1', ['told'])), look(missed('u2', ['kept']))]), [said('told'), said('kept')], 'a new compaction that misses is said');
});

// --- peakContextBefore: the peak of a session's context before a notice (session channel, T9) ---

test('peakContextBefore reads the highest reply of the session since its last compaction before the time, and that compaction\'s preTokens', () => {
  const boundary = (minute, preTokens) => ({ type: 'system', subtype: 'compact_boundary', ...base(minute), compactMetadata: { trigger: 'auto', preTokens, postTokens: 300 } });
  const lines = transcript(prompt('go', 1), spoke(2, usage(0, 400000, 0)), boundary(3, 480000), spoke(4, usage(0, 100000, 0)), spoke(5, usage(0, 150000, 0)), spoke(9, usage(0, 490000, 0))).split('\n');
  assert.deepEqual(lib.peakContextBefore(lines, Date.parse(at(6))), { tokens: 150000, preTokens: 480000 }, 'the peak before the compaction does not count');
  assert.deepEqual(lib.peakContextBefore(lines, Date.parse(at(3))), { tokens: 400000, preTokens: null }, 'before any compaction, the replies since the start');
  assert.deepEqual(lib.peakContextBefore(lines, Date.parse(at(0))), { tokens: null, preTokens: null }, 'no reply before the time');
});

test('peakContextBefore reads no side chain, no reply the harness wrote, no reply without usage, no reply after the time, and an entry copied twice once', () => {
  const kept = { ...spoke(2, usage(0, 300000, 0)), uuid: 'u-2' };
  const lines = transcript(
    prompt('go', 1),
    kept,
    { ...kept },
    { ...spoke(3, usage(0, 999000, 0)), isSidechain: true },
    spoke(4, usage(0, 888000, 0), { model: '<synthetic>' }),
    reply('no usage at all', 5),
    spoke(8, usage(0, 777000, 0)),
  ).split('\n');
  assert.deepEqual(lib.peakContextBefore(lines, Date.parse(at(6))), { tokens: 300000, preTokens: null });
});

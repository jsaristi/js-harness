import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as lib from './sessions.mjs';

// Every transcript below is synthetic: the entry shapes are the ones odd/tasks/session-board.md records
// (## Design), the contents are made up for the test.

const at = (minute) => `2026-01-01T10:${String(minute).padStart(2, '0')}:00.000Z`;
const base = (minute) => ({ timestamp: at(minute), cwd: 'C:\\proj', gitBranch: 'main', isSidechain: false });
const transcript = (...entries) => entries.map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry))).join('\n') + '\n';

const prompt = (text, minute) => ({ type: 'user', ...base(minute), origin: { kind: 'human' }, message: { role: 'user', content: text } });
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

// --- T5 A: the context a session carries ---

const usage = (input, read, created) => ({ input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: created, output_tokens: 50 });
const spoke = (minute, tokens, { model = 'model-x', text = 'ok', stop = 'end_turn' } = {}) => ({ type: 'assistant', ...base(minute), message: { role: 'assistant', model, stop_reason: stop, usage: tokens, content: [{ type: 'text', text }] } });

test('the context is what the last reply was sent with: its input tokens, read from and written to the cache', () => {
  const facts = lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(10, 90000, 500)), prompt('more', 3), spoke(4, usage(12, 270000, 5388))));
  assert.deepEqual(facts.context, { tokens: 275400, model: 'model-x', at: at(4) });
  assert.equal(facts.pastContextLimit, false);
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
  assert.equal(none.pastContextLimit, null);
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

test('a session is past the context limit when its context is above it, and the limit can be set', () => {
  const big = transcript(prompt('go', 1), spoke(2, usage(1, lib.DEFAULT_CONTEXT_LIMIT, 0)));
  // T5b: the default is 73% of the default window, which is where the 350,000 of T5 was.
  assert.deepEqual([lib.DEFAULT_CONTEXT_WINDOW, lib.DEFAULT_CONTEXT_LIMIT_PERCENT, lib.DEFAULT_CONTEXT_LIMIT], [480000, 73, 350400]);
  assert.equal(lib.sessionFacts(big).pastContextLimit, true);
  assert.equal(lib.sessionFacts(big, { contextLimit: 400000 }).pastContextLimit, false);
  assert.equal(lib.sessionFacts(transcript(spoke(2, usage(0, 350400, 0)))).pastContextLimit, false, 'at the limit is not past it');
});

// T5b: the desktop app shows the context as a share of its window, and that is the number Sebastián reads.
test('the context is also a percentage of the context window, which can be set', () => {
  const session = transcript(prompt('go', 1), spoke(2, usage(0, 342000, 0)));
  assert.equal(lib.sessionFacts(session).contextPercent, 71, '342k of the default 480k, as the app showed it');
  assert.equal(lib.sessionFacts(session, { contextWindow: 1000000 }).contextPercent, 34);
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), spoke(2, usage(0, 500000, 0)))).contextPercent, 104, 'a context above the window is said as it is');
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), reply('done', 2))).contextPercent, null);
});

// R3-tool-result-without-recorded-call: a transcript can start after the call (a compaction, a lost line).
test('a tool result whose call the transcript never recorded starts no work and breaks nothing', () => {
  const orphans = [result('toolu_gone', { stdout: '', backgroundTaskId: 'b9' }, 2), result('toolu_gone2', { success: true, resumedAgentId: 'a9' }, 3), result('toolu_gone3', { isAsync: true, agentId: 'a8' }, 4), result(undefined, { status: 'completed', agentId: 'a7' }, 5)];
  const facts = lib.sessionFacts(transcript(prompt('go', 1), ...orphans, notified({ task: 'b9', status: 'completed' }, 6), reply('Done.', 7)));
  assert.deepEqual([facts.work, facts.state, facts.skippedLines], [[], 'waiting', 0]);
  assert.equal(lib.sessionFacts(transcript(prompt('go', 1), ...orphans)).state, 'working');
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
    nextStep: ['T5 with the delegated writer.', 'Then T6, the skill.', 'Before any push: his word.', 'A fourth line.'],
  });
});

test('planOf of a document with no title, no checkbox and no next step says so with empty facts', () => {
  assert.deepEqual(lib.planOf('some notes\n', 'odd/tasks/loose-notes.md'), { path: 'odd/tasks/loose-notes.md', title: 'loose-notes', done: 0, total: 0, pending: [], nextStep: [] });
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
    { pid: 1, startedAt: '2026-01-01T10:00:00.000Z', worktree: 'D:/proj-worktrees/board', commandLine: processes[0].commandLine },
    { pid: 2, startedAt: '2026-01-01T10:01:00.000Z', worktree: 'D:/proj', commandLine: processes[1].commandLine },
    { pid: 3, startedAt: { unavailable: 'the process listing gave no start time' }, worktree: { unavailable: 'its command line names bin/check.mjs by a relative path' }, commandLine: 'node bin/check.mjs' },
    { pid: 4, startedAt: '2026-01-01T10:00:00.000Z', worktree: '/elsewhere', commandLine: 'node /elsewhere/bin/check.mjs' },
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
const seen = (id, state, more = {}) => ({ id, title: `title ${id[0]}`, state, turnEndedAt: state === 'working' ? null : before(600), lastEntryAt: before(600), context: { tokens: 100000, model: 'model-x', at: before(600) }, pastContextLimit: false, work: [], tail: ['a line'], ...more });
const open = (id) => ({ tool: 'Bash', id, description: 'Run', ended: false, file: { path: 'x', modifiedAt: before(90) } });
const boardOf = (parts = {}) => ({ hours: 12, contextLimit: 350400, contextWindow: 480000, generatedAt: before(30), sessions: [], worktrees: { available: true, items: [] }, gates: { available: true, items: [] }, pullRequests: { available: true, items: [] }, ...parts });
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

test('boardChanges: a session that appears, one that leaves the window, one that passes the context limit', () => {
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [seen(A, 'working'), seen(B, 'working')] }), ['session bbbbbbbb "title b" appeared (working)']);
  assert.deepEqual(changes({ sessions: [seen(A, 'waiting'), seen(B, 'working')] }, { sessions: [seen(B, 'working')] }), ['session aaaaaaaa "title a" left the window of the last 12h']);
  const big = { context: { tokens: 366499, model: 'model-x', at: before(40) }, pastContextLimit: true };
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [seen(A, 'working', big)] }), ['session aaaaaaaa "title a" passed the context limit: 366k tokens (76%), limit 73% (350k)']);
  assert.deepEqual(changes({ sessions: [seen(A, 'working', big)] }, { sessions: [seen(A, 'working', { ...big, context: { ...big.context, tokens: 380000 } })] }), [], 'already past: said once');
  assert.deepEqual(changes({ sessions: [seen(A, 'working', { pastContextLimit: null })] }, { sessions: [seen(A, 'working', big)] }), ['session aaaaaaaa "title a" passed the context limit: 366k tokens (76%), limit 73% (350k)']);
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

test('isSelf takes the whole id of a session or its first eight characters or more', () => {
  assert.deepEqual([lib.isSelf(A, A), lib.isSelf(A, 'aaaaaaaa'), lib.isSelf(A, 'aaaaaaaa-1111')], [true, true, true]);
  assert.deepEqual([lib.isSelf(A, 'aaaaaaa'), lib.isSelf(A, B), lib.isSelf(A, ''), lib.isSelf(A, undefined)], [false, false, false, false]);
});

test('boardChanges leaves out the session that is watching', () => {
  assert.deepEqual(changes({ sessions: [seen(A, 'working'), seen(B, 'working')] }, { sessions: [seen(A, 'waiting'), seen(B, 'waiting')] }, { self: A }), ['session bbbbbbbb "title b" is waiting (was working)']);
  assert.deepEqual(changes({ sessions: [] }, { sessions: [seen(A, 'working')] }, { self: A }), []);
  assert.deepEqual(changes({ sessions: [seen(A, 'working')] }, { sessions: [] }, { self: A }), []);
});

test('boardChanges: a gate that starts, alone or while another runs, and one that ends', () => {
  const gate = (pid, worktree) => ({ pid, startedAt: before(10), worktree, commandLine: 'node bin/check.mjs' });
  const gates = (...items) => ({ gates: { available: true, items } });
  assert.deepEqual(changes(gates(), gates(gate(5, 'D:/a'))), ['gate started in D:/a (pid 5)']);
  assert.deepEqual(changes(gates(gate(5, 'D:/a')), gates(gate(5, 'D:/a'), gate(6, 'D:/b'))), ['gate started in D:/b (pid 6) while another runs in D:/a (pid 5)']);
  assert.deepEqual(changes(gates(gate(5, 'D:/a'), gate(6, { unavailable: 'relative path' })), gates(gate(6, { unavailable: 'relative path' }))), ['gate ended in D:/a (pid 5)']);
  assert.deepEqual(changes(gates(), gates(gate(7, { unavailable: 'relative path' }))), ['gate started in an unknown worktree (pid 7)']);
  const down = { gates: { available: false, reason: 'the process listing: boom' } };
  assert.deepEqual(changes(gates(gate(5, 'D:/a')), down), [], 'a listing that failed is not a gate that ended');
  assert.deepEqual(changes(down, gates(gate(5, 'D:/a'))), []);
});

test('boardChanges: a pull request that opens and one that is no longer open', () => {
  const pr = (number) => ({ number, title: `feat: ${number}`, branch: `feat/${number}` });
  const prs = (...items) => ({ pullRequests: { available: true, items } });
  assert.deepEqual(changes(prs(pr(40)), prs(pr(40), pr(41))), ['pull request #41 opened: feat: 41 (feat/41)']);
  assert.deepEqual(changes(prs(pr(40), pr(41)), prs(pr(41))), ['pull request #40 is no longer open: feat: 40 (feat/40)']);
  assert.deepEqual(changes(prs(pr(40)), { pullRequests: { available: false, reason: 'gh pr: exit 1' } }), []);
});

test('boardChanges: a feature plan whose steps, pending tasks or next step changed, one that appears and one that goes', () => {
  const plan = (more = {}) => ({ path: 'odd/tasks/board.md', title: 'Board', done: 1, total: 3, pending: ['T2', 'T3'], nextStep: ['T2 with the writer.', 'Then T3.'], ...more });
  const trees = (...plans) => ({ worktrees: { available: true, items: [{ path: 'D:/wt', branch: 'feat/board', plans: { available: true, items: plans } }] } });
  assert.deepEqual(changes(trees(plan()), trees(plan())), []);
  assert.deepEqual(changes(trees(plan()), trees(plan({ done: 2, pending: ['T3'] }))), ['plan odd/tasks/board.md in D:/wt changed: 2/3 done (was 1/3); pending T3 (was T2, T3)']);
  assert.deepEqual(changes(trees(plan()), trees(plan({ total: 4, pending: ['T2', 'T3', 'T4'] }))), ['plan odd/tasks/board.md in D:/wt changed: 1/4 done (was 1/3); pending T2, T3, T4 (was T2, T3)']);
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
      pastContextLimit: false,
      skippedLines: 1,
      work: [
        { tool: 'Agent', kind: 'Explore', id: 'a1f', description: 'Research the format', launchedAt: before(20 * 60), ended: false, file: { path: 'x', modifiedAt: before(30) } },
        { tool: 'Bash', kind: null, id: null, description: 'Run the gate', launchedAt: before(125 * 60), ended: false, file: { unavailable: 'the transcript does not record its task id yet' } },
        { tool: 'Bash', kind: null, id: 'b1', description: 'Old run', launchedAt: before(3 * 3600), ended: true, endedAt: before(3600), status: 'completed' },
        { tool: 'Bash', kind: null, id: 'b2', description: 'Tests', launchedAt: before(2 * 3600), ended: true, endedAt: before(30 * 60), status: 'failed' },
      ],
      tail: ['What comes next', '```', `send ${'x'.repeat(200)}`],
    },
    { id: 'bbbbbbbb-2222-4222-8222-222222222222', title: null, state: 'working', lastEntryAt: before(3 * 86400), cwd: null, gitBranch: null, context: { unavailable: 'no reply of the transcript records its token usage' }, pastContextLimit: null, skippedLines: 0, work: [], tail: [] },
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
      { pid: 4242, startedAt: before(180), worktree: 'D:/proj-worktrees/board', commandLine: 'node "D:/proj-worktrees/board/bin/check.mjs"' },
      { pid: 77, startedAt: { unavailable: 'the process listing gave no start time' }, worktree: { unavailable: 'its command line names bin/check.mjs by a relative path' }, commandLine: 'node bin/check.mjs' },
    ],
  },
  pullRequests: { available: false, reason: 'gh pr: gh is not installed or not on PATH' },
};

test('renderBoard prints the sessions, then worktrees, gates and pull requests, and what the board cannot see', () => {
  assert.deepEqual(lib.renderBoard(BOARD, { now: NOW }), [
    'Sessions  D:\\proj  3 changed in the last 12h',
    '',
    'aaaaaaaa  background  Board feature  last entry 2m ago',
    '  cwd D:\\proj  branch main  context 275k tokens (57%)',
    '  work: 2 with no recorded end, 2 ended (last: Bash "Tests" failed 30m ago)',
    '    Agent a1f (Explore) "Research the format"  launched 20m ago  file written 30s ago',
    '    Bash (no id yet) "Run the gate"  launched 2h 05m ago  file unavailable: the transcript does not record its task id yet',
    '  1 transcript line skipped: it did not parse',
    '  | What comes next',
    '  | ```',
    `  | send ${'x'.repeat(154)}…`,
    '',
    'bbbbbbbb  working  (no title)  last entry 3d ago',
    '  cwd unavailable: no entry records it  branch unavailable: no entry records it  context unavailable: no reply of the transcript records its token usage',
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

// R3-untested-branches: an end with no time compared as the string "null", which sorts after every date.
test('renderBoard names the latest timed end as the last one, and an untimed end only when none has a time', () => {
  const ended = (description, endedAt) => ({ tool: 'Bash', kind: null, id: description, description, launchedAt: before(3600), ended: true, endedAt, status: 'completed' });
  const session = (work) => ({ id: 'eeeeeeee-5555', title: 't', state: 'waiting', lastEntryAt: before(60), cwd: 'C:\\p', gitBranch: 'main', skippedLines: 0, work, tail: [] });
  const workLine = (work) => lib.renderBoard({ ...BOARD, sessions: [session(work)] }, { now: NOW })[4];
  assert.equal(workLine([ended('early', before(1800)), ended('late', before(600)), ended('untimed', null)]), '  work: 0 with no recorded end, 3 ended (last: Bash "late" completed 10m ago)');
  assert.equal(workLine([ended('untimed', null), ended('early', before(1800))]), '  work: 0 with no recorded end, 2 ended (last: Bash "early" completed 30m ago)');
  assert.equal(workLine([ended('first', null), ended('second', null)]), '  work: 0 with no recorded end, 2 ended (last: Bash "second" completed at an unknown time)');
});

// T5 A: a context past the limit says so, with the limit.
test('renderBoard says when a session\'s context is past the limit, and which session is the one that asked', () => {
  const session = (id, tokens, more = {}) => ({ id, title: 't', state: 'waiting', lastEntryAt: before(60), cwd: 'C:\\p', gitBranch: 'main', context: { tokens, model: 'model-x', at: before(60) }, pastContextLimit: tokens > 350400, skippedLines: 0, work: [], tail: [], ...more });
  const sessions = [session('11111111-a', 366499), session('22222222-b', 999, { self: true })];
  const lines = lib.renderBoard({ ...BOARD, contextLimit: 350400, contextWindow: 480000, sessions }, { now: NOW });
  assert.deepEqual(lines.slice(2, 7), [
    '11111111  waiting  t  last entry 1m ago',
    '  cwd C:\\p  branch main  context 366k tokens (76%), past the limit of 73% (350k)',
    '',
    '22222222  waiting  t  last entry 1m ago  (this session)',
    '  cwd C:\\p  branch main  context 1k tokens (0%)',
  ]);
  // T5b: a limit given in tokens is said as its share of the window too, and the window can be another.
  const wide = lib.renderBoard({ ...BOARD, contextLimit: 300000, contextWindow: 1000000, sessions: [{ ...sessions[0], pastContextLimit: true }] }, { now: NOW });
  assert.equal(wide[3], '  cwd C:\\p  branch main  context 366k tokens (37%), past the limit of 30% (300k)');
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
  assert.deepEqual(lines.slice(4, 7), [
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

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
    { tool: 'Bash', kind: null, toolUseId: 'toolu_1', id: 'b1abc', description: 'Run the gate', launchedAt: at(2), mode: 'background', ended: false, endedAt: null, status: null },
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
    { tool: 'Agent', kind: 'Explore', toolUseId: 'toolu_a', id: 'a1f', description: 'Research the format', launchedAt: at(2), mode: 'background', ended: false, endedAt: null, status: null },
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
      skippedLines: 1,
      work: [
        { tool: 'Agent', kind: 'Explore', id: 'a1f', description: 'Research the format', launchedAt: before(20 * 60), ended: false, file: { path: 'x', modifiedAt: before(30) } },
        { tool: 'Bash', kind: null, id: null, description: 'Run the gate', launchedAt: before(125 * 60), ended: false, file: { unavailable: 'the transcript does not record its task id yet' } },
        { tool: 'Bash', kind: null, id: 'b1', description: 'Old run', launchedAt: before(3 * 3600), ended: true, endedAt: before(3600), status: 'completed' },
        { tool: 'Bash', kind: null, id: 'b2', description: 'Tests', launchedAt: before(2 * 3600), ended: true, endedAt: before(30 * 60), status: 'failed' },
      ],
      tail: ['What comes next', '```', `send ${'x'.repeat(200)}`],
    },
    { id: 'bbbbbbbb-2222-4222-8222-222222222222', title: null, state: 'working', lastEntryAt: before(3 * 86400), cwd: null, gitBranch: null, skippedLines: 0, work: [], tail: [] },
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
    '  cwd D:\\proj  branch main',
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

test('renderBoard gives the reason of an unknown state and of a time it cannot read', () => {
  const session = { id: 'dddddddd-4444', title: 't', state: 'unknown', stateReason: 'the transcript holds no prompt, reply or tool entry', lastEntryAt: null, cwd: 'C:\\p', gitBranch: 'main', skippedLines: 0, work: [], tail: [] };
  const lines = lib.renderBoard({ ...BOARD, sessions: [session] }, { now: NOW });
  assert.equal(lines[2], 'dddddddd  unknown (the transcript holds no prompt, reply or tool entry)  t  last entry at an unknown time');
});

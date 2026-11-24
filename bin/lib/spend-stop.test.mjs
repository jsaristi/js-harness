// The tests of a session's stop line (odd/tasks/spend-stop.md): recorded once beside the session's other records,
// lowered but never raised, and read by the guard, which refuses a step past it and lets the session write its state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { StopLineError, parseStopLine, readStopLine, recordStopLine, sessionSpend, spendStopRefusal, stopLinePath } from './spend-stop.mjs';

const ID = '0cdab702-72bd-48e7-8a8e-0c38d4aca9c9';
const line = (id, cacheRead, extra = {}) => JSON.stringify({ type: 'assistant', message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: 0 } }, ...extra });

/** A home and a project folder in a scratch folder; the transcript holds message m1 on three lines (counted once)
 * and a sub-agent file. */
function scratch(t, { main = 600, sub = 300 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-spend-stop-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'projects', 'proj');
  fs.mkdirSync(path.join(project, ID, 'subagents'), { recursive: true });
  const transcript = path.join(project, `${ID}.jsonl`);
  fs.writeFileSync(transcript, `${[line('m1', main), line('m1', main), line('m1', main)].join('\n')}\n`);
  fs.writeFileSync(path.join(project, ID, 'subagents', 'agent-a1.jsonl'), `${line('s1', sub)}\n`);
  return { home: path.join(root, 'home'), transcript };
}

const payload = (transcript, tool = 'Bash', input = { command: 'git status' }) => ({ session_id: ID, transcript_path: transcript, tool_name: tool, tool_input: input });

test('a stop line is written as digits or with a K or M suffix, and nothing else', () => {
  assert.equal(parseStopLine('20000000'), 20_000_000);
  assert.equal(parseStopLine('20M'), 20_000_000);
  assert.equal(parseStopLine('1.5m'), 1_500_000);
  assert.equal(parseStopLine('500K'), 500_000);
  for (const bad of ['', '0', '-3', 'many', '20G', '1e9', undefined]) assert.equal(parseStopLine(bad), null, String(bad));
});

test('the line lives under the home beside the pause state, by a session id of the right shape only', () => {
  assert.equal(stopLinePath('/h', ID), path.join('/h', '.js-harness', 'channel', 'spend', `${ID}.json`));
  assert.throws(() => stopLinePath('/h', '../x'), TypeError);
});

test('a line is recorded once, may be lowered and is never raised', (t) => {
  const { home } = scratch(t);
  const now = () => new Date('2026-11-22T01:00:00Z');
  assert.deepEqual(recordStopLine({ home, sessionId: ID, line: 900, now }), { line: 900, previous: null });
  assert.equal(readStopLine(home, ID), 900);
  assert.deepEqual(recordStopLine({ home, sessionId: ID, line: 900, now }), { line: 900, previous: 900 });
  assert.deepEqual(recordStopLine({ home, sessionId: ID, line: 800, now }), { line: 800, previous: 900 });
  assert.throws(() => recordStopLine({ home, sessionId: ID, line: 5000, now }), StopLineError);
  assert.equal(readStopLine(home, ID), 800);
});

test('a line file that is missing or unreadable reads as no line', (t) => {
  const { home } = scratch(t);
  assert.equal(readStopLine(home, ID), null);
  fs.mkdirSync(path.dirname(stopLinePath(home, ID)), { recursive: true });
  fs.writeFileSync(stopLinePath(home, ID), 'not json');
  assert.equal(readStopLine(home, ID), null);
  // An unreadable file does not lock the session out of recording a line again.
  assert.deepEqual(recordStopLine({ home, sessionId: ID, line: 700 }).line, 700);
});

test('the session\'s spend is its main chain, each message once, and its sub-agents', (t) => {
  const { transcript } = scratch(t);
  const spend = sessionSpend({ file: transcript, id: ID });
  assert.equal(spend.main.cacheReadTokens, 600);
  assert.equal(spend.subagents.cacheReadTokens, 300);
  assert.equal(spend.subagentFiles, 1);
});

test('with no line recorded the guard reads no transcript and refuses nothing', (t) => {
  const { home } = scratch(t);
  let reads = 0;
  const readFile = () => {
    reads += 1;
    throw new Error('read');
  };
  assert.equal(spendStopRefusal(payload('/nowhere.jsonl'), { home, readFile }), null);
  assert.equal(reads, 0);
});

test('below the line a step passes; at or past it the step is refused with the figure, the line and the way out', (t) => {
  const { home, transcript } = scratch(t);
  recordStopLine({ home, sessionId: ID, line: 901 });
  assert.equal(spendStopRefusal(payload(transcript), { home }), null);
  recordStopLine({ home, sessionId: ID, line: 900 });
  const reason = spendStopRefusal(payload(transcript), { home });
  assert.match(reason, /900 cache-read/);
  assert.match(reason, /stop line 900/);
  assert.match(reason, /write your state and stop/);
  assert.ok(reason.includes('with none of ; & | < > ` $( or a line break anywhere in the command, its quoted text too'));
  assert.equal(reason.split('\n').length, 1);
  assert.match(reason, /channel[\\/]spend[\\/]0cdab702[^ ]*\.json: only the user lifts it/);
});

test('past the line, writing the state and a lone notify still pass; a notify with a step chained after it does not', (t) => {
  const { home, transcript } = scratch(t);
  recordStopLine({ home, sessionId: ID, line: 10 });
  const passes = [
    ['Write', { file_path: 'C:/notes/state.md', content: 'x' }],
    ['Edit', { file_path: 'odd/tasks/x.md', old_string: 'a', new_string: 'b' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "JH 1: stopped at the line"' }],
    ['Read', { file_path: 'odd/tasks/x.md' }],
    ['Bash', { command: 'js-harness loop stop my-wait' }],
  ];
  for (const [tool, input] of passes) assert.equal(spendStopRefusal(payload(transcript, tool, input), { home }), null, tool);
  const refused = [
    ['Write', { file_path: 'bin/x.mjs', content: 'x' }],
    ['Read', { file_path: 'bin/x.mjs' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note <(git push)' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note x > out.txt' }],
    ['Bash', { command: 'js-harness loop stop w && git push' }],
    ['Agent', { prompt: 'x' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "x" && git push' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "x"; git push' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "$(git push)"' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "x"\ngit push' }],
  ];
  for (const [tool, input] of refused) assert.notEqual(spendStopRefusal(payload(transcript, tool, input), { home }), null, `${tool} ${JSON.stringify(input)}`);
});

test('a payload with no session id of the right shape or no transcript refuses nothing', (t) => {
  const { home, transcript } = scratch(t);
  recordStopLine({ home, sessionId: ID, line: 10 });
  assert.equal(spendStopRefusal({ ...payload(transcript), session_id: '../x' }, { home }), null);
  assert.equal(spendStopRefusal({ ...payload(transcript), transcript_path: '' }, { home }), null);
});

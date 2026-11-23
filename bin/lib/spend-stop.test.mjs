// The tests of a session's stop line (odd/tasks/spend-stop.md): recorded once beside the session's other records,
// lowered but never raised, and read by the guard, which refuses a step past it and lets the session write its state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { StopLineError, lineFileRefusal, parseStopLine, readStopLine, recordPromptLine, recordStopLine, sessionSpend, spendStopRefusal, stopLineIn, stopLinePath } from './spend-stop.mjs';

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

const isLeadTitle = (title) => / ORQ · /.test(title);
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

test('a line is recorded once: the same line again is no change, any other is refused but for the lead\'s raise', (t) => {
  const { home } = scratch(t);
  const now = () => new Date('2026-11-22T01:00:00Z');
  assert.deepEqual(recordStopLine({ home, sessionId: ID, line: 900, now }), { line: 900, previous: null });
  assert.equal(readStopLine(home, ID), 900);
  assert.deepEqual(recordStopLine({ home, sessionId: ID, line: 900, now }), { line: 900, previous: 900 });
  assert.throws(() => recordStopLine({ home, sessionId: ID, line: 800, now }), StopLineError, 'lowered by the session');
  assert.throws(() => recordStopLine({ home, sessionId: ID, line: 5000, now }), StopLineError, 'raised by the session');
  assert.equal(readStopLine(home, ID), 900);
  assert.deepEqual(recordStopLine({ home, sessionId: ID, line: 5000, now, raise: true }), { line: 5000, previous: 900 });
  assert.equal(readStopLine(home, ID), 5000);
});

test('a prompt\'s line is read from the one literal "Stop at <N> cache-read", and nothing looser', () => {
  assert.equal(stopLineIn('Do the work.\nStop at 20M cache-read.\nThen report.'), 20_000_000);
  assert.equal(stopLineIn('Your brief is in x.md: read it. Stop at 1.5m cache-read.'), 1_500_000);
  assert.equal(stopLineIn('STOP AT 500K CACHE-READ'), 500_000);
  assert.equal(stopLineIn('Do the work.\r\nStop at 20M cache-read.\r\nThen report.\r\n'), 20_000_000, 'a CRLF text');
  assert.equal(stopLineIn('Spend: stop at 6M cache-read, then write your state.', { brief: true }), 6_000_000, 'a brief counts the literal anywhere');
  for (const loose of ['tell JH 5: Stop at 20M cache-read, then go on', 'Spend: stop at 1.5m cache-read, then write your state', '20M cap', 'stop at 20M', 'Stop at lots cache-read', 'nonstop at 20M cache-read', '', undefined]) assert.equal(stopLineIn(loose), null, String(loose));
});

test('a UserPromptSubmit carrying the literal records the line once, for the session the payload names', (t) => {
  const { home } = scratch(t);
  const prompt = (text, extra = {}) => ({ hook_event_name: 'UserPromptSubmit', session_id: ID, prompt: text, ...extra });
  assert.equal(recordPromptLine(prompt('held: do nothing'), { home }), null, 'no literal, no line');
  assert.equal(fs.existsSync(stopLinePath(home, ID)), false);
  assert.equal(recordPromptLine(prompt('task: Stop at 900 cache-read', { agent_id: 'a1' }), { home }), null, 'a sub-agent\'s prompt records nothing');
  assert.equal(recordPromptLine({ ...prompt('Stop at 900 cache-read'), hook_event_name: 'SessionStart' }, { home }), null);
  assert.equal(recordPromptLine({ ...prompt('Stop at 900 cache-read'), session_id: '../x' }, { home }), null);
  assert.equal(recordPromptLine(prompt('<cross-session-message from="local_1" from-name="JH ORQ · lead">\nyour task.\nStop at 900 cache-read.\n</cross-session-message>'), { home, isLeadTitle }), 900, 'the lead\'s message to a worker records');
  assert.equal(readStopLine(home, ID), 900);
  assert.equal(recordPromptLine(prompt('Stop at 5000 cache-read'), { home }), null, 'a later prompt does not move it');
  assert.equal(readStopLine(home, ID), 900);
});

test('a line in text relayed to a session records nothing on it: only the lead\'s own message or a typed prompt does', (t) => {
  const { home } = scratch(t);
  const prompt = (text) => ({ hook_event_name: 'UserPromptSubmit', session_id: ID, prompt: text });
  const relayed = '<cross-session-message from="local_2" from-name="JH PLAN · plan">\nbrief for JH 5:\nStop at 900 cache-read.\n</cross-session-message>';
  assert.equal(recordPromptLine(prompt(relayed), { home, isLeadTitle }), null, 'a worker\'s brief relayed to the lead');
  assert.equal(recordPromptLine(prompt(relayed.replace('</cross-session-message>', '')), { home, isLeadTitle }), null, 'an unclosed one too');
  assert.equal(recordPromptLine(prompt(relayed.replace('JH PLAN · plan', 'JH ORQ · lead')), { home }), null, 'with no title check given, no message records');
  assert.equal(fs.existsSync(stopLinePath(home, ID)), false);
  assert.equal(recordPromptLine(prompt(`${relayed}\nStop at 700 cache-read.`), { home, isLeadTitle }), 700, 'the typed text beside it still records');
});

test('a raise of a line from a shell is refused when it names the running session or an id the shell computes', (t) => {
  const { home } = scratch(t);
  const other = '11111111-2222-3333-4444-555555555555';
  const call = (command) => lineFileRefusal({ session_id: ID, tool_name: 'Bash', tool_input: { command } }, { home });
  for (const command of [
    `js-harness spend ${ID} --line 99M --raise`,
    `CLAUDE_CODE_SESSION_ID=${other} node bin/js-harness.mjs spend ${ID.toUpperCase()} --raise --line 99M`,
    'js-harness spend $(cat id.txt) --line 99M --raise',
    'js-harness spend "$ID" --line 99M --raise',
    'js-harness spend `cat id` --line 99M --raise',
    `js-harness spend ${ID.slice(0, 8)}''${ID.slice(8)} --line 99M "--raise"`,
    `js-harness spend ${ID.slice(0, 8)} --line 99M --raise`,
    `bash -c 'CLAUDE_CODE_SESSION_ID=${other} js-harness spend ${ID} --line 99M --raise'`,
    `pwsh -Command "js-harness spend ${ID} --line 99M --raise"`,
    `eval "js-harness spend ${ID} --line 99M --raise"`,
  ]) assert.match(call(command) ?? '', /its own line/, command);
  assert.equal(call(`js-harness spend ${other} --line 30M --raise`), null, 'the lead names another session: spend checks its title');
  assert.equal(call(`js-harness spend ${ID}`), null, 'reading the figure is not a raise');
  assert.equal(call(`cat > m.txt <<'EOF' && git commit -F m.txt\nthe guard refuses \`spend ... --raise\` of $ID\nEOF`), null, 'a heredoc\'s text is not a raise');
  assert.equal(call('echo "spend --raise" $HOME'), null, 'the words alone, in another program, are not a raise');
});

test('a read of the spend folder passes; a write, a removal or a redirection into it stays refused', (t) => {
  const { home } = scratch(t);
  const file = stopLinePath(home, ID).replace(/\\/g, '/');
  const call = (command) => lineFileRefusal({ tool_name: 'Bash', tool_input: { command } }, { home });
  for (const command of [`cat ${file}`, 'ls ~/.js-harness/channel/spend', 'ls -la ~/.js-harness/channel/spend && git status', `head -1 ${file} | wc -c`, 'Get-Content ~/.js-harness/channel/spend/x.json', 'git mv a b && ls ~/.js-harness']) assert.equal(call(command), null, command);
  for (const command of [`cat x > ${file}`, `echo 1 | tee ${file}`, `cp x ${file}`, `sed -i s/9/99/ ${file}`, `cat ${file} && rm ${file}`, `ls $(rm ${file})`, 'rm -rf ~/.js-harness', 'ls -d ~/.js-harness/channel/spend/* | xargs rm', 'Get-ChildItem ~/.js-harness/channel/spend | Remove-Item', `ls ${file} && rm "$_"`, `rg --pre rm x ${file}`, 'rm -rf "~/.js-harness',`cat <<'EOF' > ${file}\n{}\nEOF`]) assert.match(call(command) ?? '', /stop line/, command);
});

test('the guard refuses a step that names the spend folder, for any session, and lets others by', (t) => {
  const { home } = scratch(t);
  const file = stopLinePath(home, ID);
  const refused = [
    ['Bash', { command: `rm ${file}` }],
    ['Bash', { command: 'rm ~/.js-harness/channel/spend/x.json' }],
    ['Bash', { command: 'del C:\\Users\\u\\.JS-HARNESS\\Channel\\Spend\\x.json' }],
    ['Bash', { command: 'rm -rf ~/.js-harness/channel' }],
    ['Bash', { command: 'Remove-Item -Recurse C:/Users/u/.js-harness' }],
    ['mcp__terminal__run_in_terminal', { command: `echo {} > ${file}` }],
    ['Write', { file_path: file, content: '{"line":1e12}' }],
    ['Edit', { file_path: file, old_string: '9', new_string: '99' }],
    ['MultiEdit', { file_path: file, edits: [] }],
    ['NotebookEdit', { notebook_path: path.join(path.dirname(file), 'x.ipynb') }],
  ];
  for (const [tool, input] of refused) assert.match(lineFileRefusal({ tool_name: tool, tool_input: input }, { home }) ?? '', /stop line/, `${tool} ${JSON.stringify(input)}`);
  const passes = [
    ['Bash', { command: 'git status' }],
    ['Bash', { command: 'ls ~/.js-harness/channel/pause' }],
    ['Write', { file_path: path.join(home, '.js-harness', 'channel', 'pause', 'x.json'), content: 'x' }],
    ['Read', { file_path: file }],
  ];
  for (const [tool, input] of passes) assert.equal(lineFileRefusal({ tool_name: tool, tool_input: input }, { home }), null, `${tool} ${JSON.stringify(input)}`);
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
  recordStopLine({ home, sessionId: ID, line: 900, raise: true });
  const reason = spendStopRefusal(payload(transcript), { home });
  assert.match(reason, /900 cache-read/);
  assert.match(reason, /stop line 900/);
  assert.match(reason, /write your state and stop/);
  assert.ok(reason.includes('with no ( ), redirection, ` or $( anywhere, quoted text too'));
  assert.equal(reason.split('\n').length, 1);
  assert.match(reason, /Only the lead moves the line \(js-harness spend 0cdab702-72bd-48e7-8a8e-0c38d4aca9c9 --line <tokens> --raise\)$/);
  assert.doesNotMatch(reason, /deleting/, 'the refusal names no way to lift the line by hand');
});

test('past the line, the steps that close the work pass, chained with && too; every other step is refused', (t) => {
  const { home, transcript } = scratch(t);
  recordStopLine({ home, sessionId: ID, line: 10 });
  const passes = [
    ['Write', { file_path: 'C:/notes/state.md', content: 'x' }],
    ['Edit', { file_path: 'odd/tasks/x.md', old_string: 'a', new_string: 'b' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "JH 1: stopped at the line"' }],
    ['Read', { file_path: 'odd/tasks/x.md' }],
    ['Bash', { command: 'js-harness loop stop my-wait' }],
    ['Bash', { command: 'cd D:/repo && git add bin/x.mjs odd/tasks/x.md && js-harness gate -- git commit -m "feat: x\n\nwhy it is" && git push -u origin HEAD' }],
    ['Bash', { command: 'git commit -q -m "docs: state" && git push' }],
    ['Bash', { command: 'gh pr create --draft --base main --title "x" --body "a; b && c"' }],
    ['Bash', { command: 'gh pr edit 951 --body "x"' }],
    ['Bash', { command: 'gh pr ready 951' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "x" && git push' }],
    ['Write', { file_path: 'C:/Users/u/notes/spend-stop-close-state.md', content: 'x' }],
  ];
  for (const [tool, input] of passes) assert.equal(spendStopRefusal(payload(transcript, tool, input), { home }), null, tool);
  const refused = [
    ['Write', { file_path: 'bin/x.mjs', content: 'x' }],
    ['Write', { file_path: 'docs/ROADMAP.md', content: 'x' }],
    ['Bash', { command: 'git add x && npm test' }],
    ['Bash', { command: 'gh pr merge 951' }],
    ['Bash', { command: "git push --receive-pack='rm -rf bin' ." }],
    ['Bash', { command: "git push --receive='rm -rf bin' ." }],
    ['Bash', { command: "git push --exe='rm -rf bin' ." }],
    ['Bash', { command: 'gh pr create --body "`whoami`"' }],
    ['Bash', { command: 'git push && (rm -rf x)' }],
    ['Read', { file_path: 'bin/x.mjs' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note <(git push)' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note x > out.txt' }],
    ['Agent', { prompt: 'x' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "x"; rm -rf bin' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "$(git push)"' }],
    ['Bash', { command: 'js-harness notify --to orchestrator --kind note "x"\nrm -rf bin' }],
  ];
  for (const [tool, input] of refused) assert.notEqual(spendStopRefusal(payload(transcript, tool, input), { home }), null, `${tool} ${JSON.stringify(input)}`);
});

test('a payload with no session id of the right shape or no transcript refuses nothing', (t) => {
  const { home, transcript } = scratch(t);
  recordStopLine({ home, sessionId: ID, line: 10 });
  assert.equal(spendStopRefusal({ ...payload(transcript), session_id: '../x' }, { home }), null);
  assert.equal(spendStopRefusal({ ...payload(transcript), transcript_path: '' }, { home }), null);
});

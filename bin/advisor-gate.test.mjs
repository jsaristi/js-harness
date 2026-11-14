// Tests of `advisor-gate` (bin/advisor-gate.mjs): which acts it gates, how it reads policy R's stretch from a
// transcript, what it records, and that the warning week never refuses (odd/tasks/advisor-use.md, P1, P2, T3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { advisorGateMain, gatedAct, readStretch, STRETCH_TOOL_CALLS } from './advisor-gate.mjs';

const OPUS = 'claude-opus-5-5';
const FABLE = 'claude-fable-5-2';

/** A scratch home holding a js-harness project (its `harness.json`) and a projects folder for transcripts. */
function scratch() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-gate-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(path.join(project, 'odd', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(project, 'harness.json'), '{}');
  return { home, project };
}

let seq = 0;
const id = (prefix) => `${prefix}${++seq}`;
const his = (text = 'hola') => ({ type: 'user', message: { role: 'user', content: text } });
const queued = () => ({ type: 'attachment', attachment: { type: 'queued_command', origin: { kind: 'human' }, prompt: 'otra cosa' } });
const event = () => ({ type: 'user', message: { role: 'user', content: '<cross-session-message from="x">news</cross-session-message>' } });
const toolCall = (model = OPUS, advisorModel = FABLE) => ({ type: 'assistant', advisorModel, message: { model, content: [{ type: 'tool_use', id: id('tu'), name: 'Read', input: {} }] } });
function advisorCall({ result = true, error = false, model = OPUS } = {}) {
  const callId = id('srv');
  const content = [{ type: 'server_tool_use', id: callId, name: 'advisor', input: {} }];
  if (result) content.push({ type: 'advisor_tool_result', tool_use_id: callId, content: error ? { type: 'advisor_tool_result_error', error_code: 'unavailable' } : { type: 'advisor_redacted_result', encrypted_content: 'x' } });
  return { type: 'assistant', advisorModel: FABLE, message: { model, content } };
}
const writeTranscript = (file, entries) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${entries.map((e) => JSON.stringify(e)).join('\n')}\n`);
};

function run(argv, payload, home, extra = {}) {
  const out = [];
  const err = [];
  const code = advisorGateMain(argv, { readStdin: () => JSON.stringify(payload), stdout: (s) => out.push(s), stderr: (s) => err.push(s), home, now: Date.parse('2026-11-13T22:00:00Z'), ...extra });
  const text = out.join('');
  return { code, answer: text === '' ? null : JSON.parse(text), err: err.join('\n') };
}
const decisions = (home) => {
  const file = path.join(home, '.js-harness', 'advisor-gate', 'decisions.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
};
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

test('gatedAct names the acts of P1 and nothing else', () => {
  const cwd = os.tmpdir();
  assert.equal(gatedAct('AskUserQuestion', {}, cwd), 'question');
  assert.equal(gatedAct('mcp__ccd_session__start_session', {}, cwd), 'session');
  assert.equal(gatedAct('ExitPlanMode', {}, cwd), 'plan');
  assert.equal(gatedAct('Bash', { command: 'js-harness notify --to orchestrator --kind question' }, cwd), 'question');
  assert.equal(gatedAct('Bash', { command: 'cd x && js-harness notify --to orchestrator --kind ready --pr 3 "r"' }, cwd), 'done');
  assert.equal(gatedAct('Bash', { command: 'node bin/js-harness.mjs notify --kind closed --summary s.md "c"' }, cwd), 'done');
  assert.equal(gatedAct('Bash', { command: 'FOO=1 js-harness gate -- js-harness merge-queue --land 12' }, cwd), 'land');
  assert.equal(gatedAct('Bash', { command: 'js-harness merge-queue --land 12 --dry-run' }, cwd), null);
  assert.equal(gatedAct('Bash', { command: 'js-harness sessions start --title "JH 1 · x"' }, cwd), 'session');
  assert.equal(gatedAct('Bash', { command: 'js-harness sessions start --help' }, cwd), null);
  assert.equal(gatedAct('Bash', { command: 'js-harness notify --to orchestrator --kind note "a --kind question"' }, cwd), null);
  assert.equal(gatedAct('Bash', { command: 'js-harness notify --to orchestrator --kind "ready" --pr 3 "done"' }, cwd), 'done');
  assert.equal(gatedAct('Bash', { command: "js-harness notify --kind 'question'" }, cwd), 'question');
  assert.equal(gatedAct('Bash', { command: 'git commit -m "explain js-harness merge-queue --land"' }, cwd), null, 'a commit body that names a land is none');
  assert.equal(gatedAct('Bash', { command: "grep -n 'js-harness sessions start' docs/x.md" }, cwd), null, 'a grep pattern is none');
  assert.equal(gatedAct('Bash', { command: 'git status' }, cwd), null);
  assert.equal(gatedAct('Read', {}, cwd), null);
});

test('a Write gates only the creation of a task document', () => {
  const { project } = scratch();
  const fresh = path.join(project, 'odd', 'tasks', 'new-feature.md');
  assert.equal(gatedAct('Write', { file_path: fresh }, project), 'plan');
  fs.writeFileSync(fresh, '# x');
  assert.equal(gatedAct('Write', { file_path: fresh }, project), null, 'a rewrite is not gated');
  assert.equal(gatedAct('Write', { file_path: path.join(project, 'docs', 'x.md') }, project), null);
});

test('outside a js-harness project the hook answers {} and records nothing', () => {
  const { home } = scratch();
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-project-'));
  const r = run(['--hook'], { ...bash('js-harness notify --kind question'), cwd: elsewhere, session_id: 's', transcript_path: path.join(elsewhere, 'none.jsonl') }, home);
  assert.deepEqual(r.answer, {});
  assert.deepEqual(decisions(home), []);
});

test('an act that is not gated is answered before the transcript is read', () => {
  const { home, project } = scratch();
  const r = run(['--hook'], { ...bash('git status'), cwd: project, session_id: 's', transcript_path: path.join(project, 'missing.jsonl') }, home);
  assert.deepEqual(r.answer, {});
  assert.deepEqual(decisions(home), []);
});

test('an act with an advisor call in its stretch is covered and gets no notice', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'lead.jsonl');
  writeTranscript(t, [his(), toolCall(), advisorCall(), toolCall()]);
  const r = run(['--hook'], { ...bash('js-harness notify --to orchestrator --kind question'), cwd: project, session_id: 's1', transcript_path: t }, home);
  assert.deepEqual(r.answer, {});
  assert.equal(decisions(home)[0].decision, 'covered');
  assert.equal(decisions(home)[0].act, 'question');
});

test('an act with no call in its stretch is flagged with a notice and let through (the warning week)', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'lead.jsonl');
  writeTranscript(t, [advisorCall(), his(), toolCall()]);
  const r = run(['--hook'], { ...bash('js-harness merge-queue --land 7'), cwd: project, session_id: 's1', transcript_path: t }, home);
  assert.equal(r.answer.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(r.answer.hookSpecificOutput.permissionDecision, undefined, 'the warning week never refuses');
  assert.match(r.answer.hookSpecificOutput.additionalContext, /advisor/);
  assert.match(r.answer.hookSpecificOutput.additionalContext, /alone, in a response of its own/);
  assert.equal(decisions(home)[0].decision, 'flagged');
});

test('a queued message of his breaks the stretch as a typed one does', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'w.jsonl');
  writeTranscript(t, [advisorCall(), toolCall(), queued(), toolCall()]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.equal(decisions(home)[0].decision, 'flagged');
});

test('a session event breaks the stretch; a task notification does not', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'w.jsonl');
  writeTranscript(t, [advisorCall(), event(), toolCall()]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  writeTranscript(t, [advisorCall(), { type: 'user', message: { content: '<task-notification>done</task-notification>' } }, toolCall()]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.deepEqual(decisions(home).map((d) => d.decision), ['flagged', 'covered']);
});

test('a call expires after the stretch\'s tool calls', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'w.jsonl');
  writeTranscript(t, [his(), advisorCall(), ...Array.from({ length: STRETCH_TOOL_CALLS }, () => toolCall())]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  writeTranscript(t, [his(), advisorCall(), ...Array.from({ length: STRETCH_TOOL_CALLS - 1 }, () => toolCall())]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.deepEqual(decisions(home).map((d) => d.decision), ['flagged', 'covered']);
});

test('an advisor call with no result does not cover the act', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'w.jsonl');
  writeTranscript(t, [his(), advisorCall({ result: false }), toolCall()]);
  run(['--hook'], { tool_name: 'AskUserQuestion', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.equal(decisions(home)[0].decision, 'flagged');
});

test('a notify question and its AskUserQuestion share one call; a broken stretch between them is checked again', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'lead.jsonl');
  writeTranscript(t, [his(), advisorCall(), toolCall()]);
  run(['--hook'], { ...bash('js-harness notify --to orchestrator --kind question'), cwd: project, session_id: 's', transcript_path: t }, home);
  run(['--hook'], { tool_name: 'AskUserQuestion', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  writeTranscript(t, [his(), advisorCall(), toolCall(), event(), toolCall()]);
  run(['--hook'], { tool_name: 'AskUserQuestion', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.deepEqual(decisions(home).map((d) => d.decision), ['covered', 'covered', 'flagged']);
});

test('two advisor errors in the stretch are an outage: let through, recorded; one is not', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'w.jsonl');
  writeTranscript(t, [his(), advisorCall({ error: true }), advisorCall({ error: true }), toolCall()]);
  const r = run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.deepEqual(r.answer, {});
  writeTranscript(t, [his(), advisorCall({ error: true }), toolCall()]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.deepEqual(decisions(home).map((d) => d.decision), ['outage', 'flagged']);
});

test('a caller on the advisor\'s own model is exempt and recorded so (choice 3 unanswered)', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'f.jsonl');
  writeTranscript(t, [his(), toolCall(FABLE, FABLE)]);
  const r = run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.deepEqual(r.answer, {});
  assert.equal(decisions(home)[0].decision, 'exempt-same-model');
});

test('had the advisor: a stale entry equal to its model falls back to the shape line, and none means unchecked', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'h.jsonl');
  const equal = { type: 'assistant', advisorModel: OPUS, message: { model: OPUS, content: [{ type: 'tool_use', id: id('tu'), name: 'Read', input: {} }] } };
  writeTranscript(t, [{ type: 'api-request-shape', tools: [{ type: 'advisor_20260301', name: 'advisor', model: FABLE }] }, his(), equal]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  writeTranscript(t, [his(), equal]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }, home);
  assert.deepEqual(decisions(home).map((d) => d.decision), ['flagged', 'unchecked']);
});

test('an unreadable transcript lets the act through, recorded unchecked', () => {
  const { home, project } = scratch();
  const r = run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: path.join(home, 'gone.jsonl') }, home);
  assert.deepEqual(r.answer, {});
  assert.equal(decisions(home)[0].decision, 'unchecked');
  assert.match(decisions(home)[0].reason, /cannot read/);
});

test('the senior is exempt, found by session id in the background record', () => {
  const { home, project } = scratch();
  fs.mkdirSync(path.join(home, '.js-harness', 'background'), { recursive: true });
  fs.writeFileSync(path.join(home, '.js-harness', 'background', 'sessions.jsonl'), `${JSON.stringify({ event: 'started', sessionId: 'sr', title: 'JH SR · the senior for the hardest work' })}\n`);
  const t = path.join(home, 'projects', 'p', 'sr.jsonl');
  writeTranscript(t, [his(), toolCall()]);
  run(['--hook'], { tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 'sr', transcript_path: t }, home);
  assert.equal(decisions(home)[0].decision, 'exempt-senior');
});

test('a sub-agent\'s act is read from its own transcript', () => {
  const { home, project } = scratch();
  const main = path.join(home, 'projects', 'p', 'main.jsonl');
  writeTranscript(main, [his(), toolCall()]);
  writeTranscript(path.join(home, 'projects', 'p', 'main', 'subagents', 'agent-a1.jsonl'), [{ type: 'user', message: { content: 'brief' } }, advisorCall(), toolCall()]);
  run(['--hook'], { ...bash('js-harness notify --to orchestrator --kind ready --pr 1 "r"'), cwd: project, session_id: 'main', agent_id: 'a1', agent_type: 'general-purpose', transcript_path: main }, home);
  assert.equal(decisions(home)[0].decision, 'covered');
  assert.equal(decisions(home)[0].agent, 'a1');
});

test('SubagentStop never blocks in the warning week; a second stop is recorded as such', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'agent.jsonl');
  writeTranscript(t, [{ type: 'user', message: { content: 'brief' } }, toolCall()]);
  const first = run(['--stop'], { hook_event_name: 'SubagentStop', cwd: project, session_id: 'm', agent_id: 'a2', agent_transcript_path: t, stop_hook_active: false }, home);
  assert.deepEqual(first.answer, {});
  writeTranscript(t, [{ type: 'user', message: { content: 'brief' } }, toolCall(), advisorCall()]);
  const second = run(['--stop'], { hook_event_name: 'SubagentStop', cwd: project, session_id: 'm', agent_id: 'a2', agent_transcript_path: t, stop_hook_active: true }, home);
  assert.deepEqual(second.answer, {});
  assert.deepEqual(decisions(home).map((d) => [d.act, d.decision, d.secondStop]), [['end', 'flagged', false], ['end', 'covered', true]]);
});

test('readStretch reads only the tail of a long transcript', () => {
  const { home } = scratch();
  const t = path.join(home, 'projects', 'p', 'long.jsonl');
  const padding = Array.from({ length: 3000 }, () => ({ type: 'progress', data: 'x'.repeat(1000) }));
  writeTranscript(t, [advisorCall(), ...padding, his(), advisorCall(), toolCall()]);
  const stretch = readStretch(t, { tailBytes: 64 * 1024 });
  assert.equal(stretch.calls, 1);
  assert.equal(stretch.broken, 'his message');
});

test('a hook payload that is not JSON answers {} and exit 0', () => {
  const out = [];
  assert.equal(advisorGateMain(['--hook'], { readStdin: () => 'nope', stdout: (s) => out.push(s), stderr: () => {}, home: os.tmpdir() }), 0);
  assert.deepEqual(out, ['{}']);
});

test('a usage error exits 2', () => {
  const err = [];
  assert.equal(advisorGateMain(['--nope'], { stdout: () => {}, stderr: (s) => err.push(s) }), 2);
  assert.match(err.join(''), /unknown argument: --nope/);
  assert.match(err.join(''), /Usage/);
});

test('without a home given, the record goes to JS_HARNESS_HOME, where the background record is read too', () => {
  const { home, project } = scratch();
  const t = path.join(home, 'projects', 'p', 'w.jsonl');
  writeTranscript(t, [his(), toolCall()]);
  const out = [];
  advisorGateMain(['--hook'], { readStdin: () => JSON.stringify({ tool_name: 'ExitPlanMode', tool_input: {}, cwd: project, session_id: 's', transcript_path: t }), stdout: (x) => out.push(x), stderr: () => {}, env: { JS_HARNESS_HOME: home }, now: 0 });
  assert.equal(decisions(home)[0].decision, 'flagged');
});

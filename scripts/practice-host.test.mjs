// The reader of the host session's stream (`host-loads`, odd/tasks/practice-project.md, "T5: the step host-loads"),
// held to the three streams a real Claude Code 2.1.296 printed in the practice project on 2026-10-14, trimmed to the
// fields the step reads (scripts/fixtures/host-call*.jsonl). A change of Claude Code's stream fails here first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readHostStream, hostCallProblems, hostCost } from './practice-lib.mjs';

const fixture = (n) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', `host-call${n}.jsonl`), 'utf8');
const [load, skill, compact] = [1, 2, 3].map((n) => readHostStream(fixture(n)));
// The first call answered with the first heading of the practice AGENTS.md: the word it was asked for.
const WORD = '# PROJECT';

// The rules' turn-start hook (odd/tasks/rule-hierarchy.md, T16f) was installed after these calls were recorded: what it
// adds to a stream, one succeeded response, is added here, named as its event is, with no output.
const ruleHook = (name) => ({ name, exitCode: 0, outcome: 'success', stdout: '' });
const withRules = (stream, name) => ({ ...stream, hooks: [...stream.hooks, ruleHook(name)] });

test('the three recorded calls pass, each as what it proves, with the rules hook its event adds', () => {
  assert.deepEqual(hostCallProblems('load', withRules(load, 'UserPromptSubmit'), { word: WORD }), []);
  assert.deepEqual(hostCallProblems('skill', withRules(skill, 'UserPromptSubmit')), []);
  assert.deepEqual(hostCallProblems('compact', withRules(compact, 'SessionStart:compact')), []);
});

test('each of the three events of the rules hook is checked: a turn, a compaction and a sub-agent (T16f)', () => {
  assert.deepEqual(hostCallProblems('load', load, { word: WORD }), ['no UserPromptSubmit hook ran']);
  assert.deepEqual(hostCallProblems('compact', compact), ['no SessionStart:compact hook ran beside the one of js-harness resume, so the rules hook did not']);
  const failed = { ...ruleHook('UserPromptSubmit'), exitCode: 2, outcome: 'error' };
  assert.deepEqual(hostCallProblems('load', { ...load, hooks: [...load.hooks, failed] }, { word: WORD }), ['a UserPromptSubmit hook did not succeed (exit 2, error)']);
  const subagent = { init: skill.init, hooks: [ruleHook('UserPromptSubmit'), ruleHook('SubagentStart:general-purpose')], result: { ...skill.result, result: 'done' } };
  assert.deepEqual(hostCallProblems('subagent', subagent), []);
  assert.deepEqual(hostCallProblems('subagent', { ...subagent, hooks: [ruleHook('UserPromptSubmit')] }), ['no SubagentStart hook ran']);
});

test('the stream is read into its init, its hook responses and its last result, whatever else it holds', () => {
  const read = readHostStream(`not json\n${fixture(1)}\n{"type":"rate_limit_event"}\n`);
  assert.equal(read.init.model, 'claude-haiku-5-5');
  assert.deepEqual(read.hooks.map((hook) => hook.name), ['SessionStart:startup', 'SessionStart:startup']);
  assert.equal(read.result.subtype, 'success');
});

test('a load with a skill missing, a file tool, a failed start hook, two turns or no word is refused, each by name', () => {
  const broken = {
    init: { ...load.init, skills: ['js-harness'], tools: ['Read'] },
    hooks: [...load.hooks.map((hook, i) => (i === 1 ? { ...hook, exitCode: 1, outcome: 'error' } : hook)), ruleHook('UserPromptSubmit')],
    result: { ...load.result, num_turns: 2, result: 'no idea' },
  };
  assert.deepEqual(hostCallProblems('load', broken, { word: WORD }), [
    'the session did not list the skill js-harness-orchestrator',
    'the session had a tool that reads files: Read',
    'a SessionStart:startup hook did not succeed (exit 1, error)',
    'the answer took 2 turns, so it could have read the file instead of what was loaded',
    `the answer does not hold the word of the run (${WORD}), so AGENTS.md was not loaded`,
  ]);
});

test('a stream with no init, no hook or no result says so', () => {
  assert.deepEqual(hostCallProblems('load', { init: null, hooks: [], result: null }, { word: WORD }), [
    'the stream has no init event',
    'no SessionStart:startup hook ran',
    'no UserPromptSubmit hook ran',
    'the stream has no result',
  ]);
  assert.deepEqual(hostCallProblems('skill', { init: skill.init, hooks: [], result: skill.result }), ['no PostToolUse:Skill hook ran']);
  assert.deepEqual(hostCallProblems('compact', { init: compact.init, hooks: compact.hooks.filter((hook) => hook.name !== 'SessionStart:compact'), result: compact.result }), [
    'no SessionStart:compact hook printed the words of js-harness resume',
    'no SessionStart:compact hook ran beside the one of js-harness resume, so the rules hook did not',
  ]);
});

test('a skill call that did not quote the skill is refused', () => {
  assert.deepEqual(hostCallProblems('skill', { ...skill, result: { ...skill.result, result: 'done' } }), [
    'the answer does not quote the js-harness skill (its line js-harness check --push)',
  ]);
});

test('an error result is refused with its subtype', () => {
  assert.deepEqual(hostCallProblems('compact', { ...withRules(compact, 'SessionStart:compact'), result: { ...compact.result, subtype: 'error_during_execution', is_error: true } }), [
    'the result is not a success (error_during_execution)',
  ]);
});

test('the cost of the calls is summed from their results, with the version and the model', () => {
  const cost = hostCost([load, skill, compact]);
  assert.equal(cost.version, '2.1.296');
  assert.equal(cost.model, 'claude-haiku-5-5');
  assert.equal(cost.inputTokens, 6);
  assert.equal(cost.outputTokens, 311);
  assert.equal(cost.cacheTokens, 2872 + 7211 + 6330);
  assert.equal(Math.round(cost.costUsd * 1e7), Math.round((load.result.total_cost_usd + skill.result.total_cost_usd + compact.result.total_cost_usd) * 1e7));
  assert.equal(cost.durationMs, load.result.duration_ms + skill.result.duration_ms + compact.result.duration_ms);
});

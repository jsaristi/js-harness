import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArmError, armNames, parseArm } from './arms.mjs';

// G2 of `odd/tasks/future-model-protocol.md`: an arm differs from its base by one component (or one pair), named so
// that the name is also a valid trial key and file name.
const RUNNER_NAME = /^[A-Za-z0-9.-]+(_[A-Za-z0-9.-]+)*$/;

test('the two base arms are not arms of a component', () => {
  assert.equal(parseArm('minimal', 'claude'), null);
  assert.equal(parseArm('current', 'codex'), null);
});

test('current-without names one component, or a sorted pair, of the agent', () => {
  assert.deepEqual(parseArm('current-without-skills', 'claude'), { base: 'current', direction: 'without', components: ['skills'] });
  assert.deepEqual(parseArm('current-without-gentle-ai-persona', 'claude'), { base: 'current', direction: 'without', components: ['gentle-ai-persona'] });
  assert.deepEqual(parseArm('current-without-gentle-ai-engram-protocol_plugin-engram', 'claude'), {
    base: 'current', direction: 'without', components: ['gentle-ai-engram-protocol', 'plugin-engram'],
  });
  assert.deepEqual(parseArm('current-without-mcp-context7', 'codex'), { base: 'current', direction: 'without', components: ['mcp-context7'] });
  assert.deepEqual(parseArm('current-without-agents-md', 'codex'), { base: 'current', direction: 'without', components: ['agents-md'] });
});

test('a pair is refused unsorted, repeated or larger than two, and a component of the other agent is refused', () => {
  assert.throws(() => parseArm('current-without-skills_hooks', 'claude'), (err) => err instanceof ArmError && /sorted/.test(err.message));
  assert.throws(() => parseArm('current-without-skills_skills', 'claude'), (err) => err instanceof ArmError && /twice/.test(err.message));
  assert.throws(() => parseArm('current-without-agents_hooks_skills', 'claude'), (err) => err instanceof ArmError && /two/.test(err.message));
  assert.throws(() => parseArm('current-without-agents-md', 'claude'), (err) => err instanceof ArmError && /agents-md/.test(err.message));
  assert.throws(() => parseArm('current-without-claude-md', 'codex'), (err) => err instanceof ArmError && /claude-md/.test(err.message));
  assert.throws(() => parseArm('current-without-nothing', 'claude'), (err) => err instanceof ArmError && /nothing/.test(err.message));
});

test('minimal-with is taken only for what minimal\'s flags let in, and says why the rest is not', () => {
  assert.deepEqual(parseArm('minimal-with-mcp-engram', 'claude'), { base: 'minimal', direction: 'with', components: ['mcp-engram'] });
  for (const id of ['skills', 'js-harness', 'plugin-engram', 'project']) {
    assert.throws(() => parseArm(`minimal-with-${id}`, 'claude'), (err) => err instanceof ArmError && /switch/.test(err.message), id);
  }
  for (const id of ['claude-md', 'hooks', 'output-style']) {
    assert.throws(() => parseArm(`minimal-with-${id}`, 'claude'), (err) => err instanceof ArmError && /isolation probe/.test(err.message), id);
  }
  assert.throws(() => parseArm('minimal-with-mcp-engram', 'codex'), (err) => err instanceof ArmError && /Codex/.test(err.message));
  assert.throws(() => parseArm('minimal-with-mcp-a_mcp-b', 'claude'), (err) => err instanceof ArmError && /one component/.test(err.message));
});

test('every arm name the list offers is a name the runner accepts as a trial key and a file name', () => {
  for (const agent of ['claude', 'codex']) {
    const names = armNames(agent);
    assert.ok(names.length > 5, agent);
    for (const name of names) {
      assert.match(name, RUNNER_NAME, name);
      assert.notEqual(parseArm(name, agent), null, name);
    }
  }
});

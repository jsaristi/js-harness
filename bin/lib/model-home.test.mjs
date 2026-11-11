import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from './rules-data.mjs';
import { writeRules } from './rules.mjs';
import { CLAUDE_HOME, CODEX_HOME, EFFORTS, MENU_LEVELS, claudeHeld, claudeHome, codexHome, displayName, menuLine, sameModel } from './model-home.mjs';

// odd/tasks/one-model-home.md, specs 2 and 7: the one module that knows which rules are the two homes.
const valueOf = (id, list = RULES) => list.find((rule) => rule.id === id).value;

test('the two homes are four live rules that hold a value, and no rule is in both', () => {
  const ids = [...Object.values(CLAUDE_HOME), ...Object.values(CODEX_HOME)];
  assert.equal(new Set(ids).size, 4);
  for (const id of ids) {
    const rule = RULES.find((item) => item.id === id);
    assert.ok(rule && Object.hasOwn(rule, 'value') && !Object.hasOwn(rule, 'retired'), `${id} is a live rule with a value`);
  }
});

test('claudeHome and codexHome give what the rules declare, wherever they are read', () => {
  assert.deepEqual(claudeHome(), { model: valueOf('session-model'), effort: valueOf('session-effort') });
  assert.deepEqual(codexHome(), { model: valueOf('review-model'), effort: valueOf('review-effort') });
});

test('a list given to claudeHome is the one read, so a switch is seen by every reader', () => {
  const list = RULES.map((rule) => (rule.id === 'session-model' ? { ...rule, value: 'claude-saga-9-1' } : rule));
  assert.equal(claudeHome(list).model, 'claude-saga-9-1');
  assert.equal(claudeHome(list).effort, valueOf('session-effort'));
});

test('a guard holds the home where the project declares the rules, and nothing where it does not', () => {
  const here = claudeHeld(writeRules(RULES));
  assert.deepEqual(here, { model: { value: valueOf('session-model'), note: '' }, effort: { value: valueOf('session-effort'), note: '' } });
  assert.deepEqual(claudeHeld(undefined), { model: null, effort: null });
  assert.deepEqual(claudeHeld('export const RULES = [];\n'), { model: null, effort: null });
});

test('the levels are the five a host takes, lowest first', () => {
  assert.deepEqual([...EFFORTS], ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.deepEqual(Object.keys(MENU_LEVELS), [...EFFORTS]);
});

test('a model is shown by its family and version, and an id of another shape as it is', () => {
  assert.equal(displayName('claude-fable-5-2'), 'Fable 5.2');
  assert.equal(displayName('claude-haiku-4-5-20251001'), 'Haiku 4.5');
  assert.equal(displayName('claude-opus-5'), 'Opus 5');
  assert.equal(displayName('gpt-6.1-sol'), 'gpt-6.1-sol');
});

test('two ids are the same model with a date at the end or a bracket taken off', () => {
  assert.equal(sameModel('claude-fable-5-2', 'claude-fable-5-2'), true);
  assert.equal(sameModel('claude-haiku-4-5-20251001', 'claude-haiku-4-5'), true);
  assert.equal(sameModel('claude-fable-5-2[1m]', 'claude-fable-5-2'), true);
  assert.equal(sameModel('claude-fable-5-1', 'claude-fable-5-2'), false);
  assert.equal(sameModel('opus[1m]', 'claude-opus-5-5'), false);
  assert.equal(sameModel(undefined, 'claude-fable-5-2'), false);
});

test('the line he is given names the model and the level as his menu shows them', () => {
  assert.equal(
    menuLine({ model: 'claude-fable-5-2', effort: 'high' }),
    'En esta sesión, abre el selector de modelo que está junto a la caja donde escribes y elige Fable 5.2 con esfuerzo Alto.',
  );
  assert.match(menuLine({ model: 'claude-fable-5-2', effort: 'xhigh' }), /con esfuerzo Extra alto\.$/);
});

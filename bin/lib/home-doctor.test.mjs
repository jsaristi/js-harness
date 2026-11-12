import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from './rules-data.mjs';
import { writeRules } from './rules.mjs';
import { EFFORTS, claudeHome, menuLine } from './model-home.mjs';
import { modelHomeHealth, readSettings, settingsNotes } from './home-doctor.mjs';

// odd/tasks/one-model-home.md, spec 7: the doctor row of the session that asks, and what his settings say that the
// home does not, read and never written.
const HOME = { model: 'claude-fable-5-2', effort: 'medium', lead: 'high' };

test('settingsNotes says what his settings hold that the home does not: the default model, the cap, the model\'s entry and the level a new session takes', () => {
  assert.deepEqual(settingsNotes(HOME), [], 'no settings read, nothing said');
  // His settings as read on 2026-11-11 (the raw material of the feature's depth pass), against a lead held above his cap.
  const his = { model: 'opus[1m]', maxEffortLevel: 'high', modelSettings: { 'claude-opus-5-5': { effortLevel: 'medium' } } };
  assert.deepEqual(settingsNotes({ ...HOME, lead: 'xhigh' }, { user: his, project: { effortLevel: 'high' } }), [
    'his settings\' default model is opus[1m], not the home\'s claude-fable-5-2: a session started outside the harness runs on it',
    'his settings cap the effort at high, under the home\'s xhigh',
    'his settings hold no modelSettings entry for claude-fable-5-2',
    'the project\'s .claude/settings.local.json holds effortLevel high, not the home\'s medium: a new session takes it',
  ]);
  assert.deepEqual(settingsNotes(HOME, { user: his }).filter((note) => note.includes('cap')), [], 'a cap at the highest level the home gives caps nothing');
  const agreeing = { model: 'claude-fable-5-2[1m]', maxEffortLevel: 'high', effortLevel: 'medium', modelSettings: { 'claude-fable-5-2': { effortLevel: 'medium' } } };
  assert.deepEqual(settingsNotes(HOME, { user: agreeing, project: { effortLevel: 'medium' } }), []);
  assert.deepEqual(settingsNotes(HOME, { user: { effortLevel: 'low', modelSettings: { 'claude-fable-5-2': { effortLevel: 'max' } } } }), [
    'his settings hold max for claude-fable-5-2 under modelSettings, not the home\'s medium',
    'his settings hold effortLevel low, not the home\'s medium: a new session takes it',
  ]);
  assert.deepEqual(settingsNotes({ model: null, effort: null, lead: null }, { user: { model: 'opus', maxEffortLevel: 'low', effortLevel: 'low' }, project: { effortLevel: 'low' } }), [], 'a home that holds nothing is compared with nothing');
});

const rulesText = writeRules(RULES);
const home = claudeHome();
const other = EFFORTS.find((level) => level !== home.effort && level !== home.lead);
const files = (held) => (file) => {
  const name = file.replace(/\\/g, '/');
  if (!Object.hasOwn(held, name)) throw Object.assign(new Error('no file'), { code: 'ENOENT' });
  return held[name];
};
const record = (title, model, effort) => new Map([['s1', { where: 'sessions', title, model, effort, archived: false, cwd: 'D:/proj' }]]);
const ask = (more = {}) => modelHomeHealth({ project: 'D:/proj', rulesText, claudeDir: 'D:/home/.claude', env: { CLAUDE_CODE_SESSION_ID: 's1' }, homedir: () => 'D:/home', readApp: () => new Map(), readFile: files({}), ...more });

test('the row is n/a where the project declares no home, and ok with a note where no session could be checked', () => {
  assert.deepEqual(ask({ rulesText: null, readApp: () => assert.fail('no home, so no record is read') }), { state: 'n/a', note: '', fix: [] });
  assert.deepEqual(ask({ env: {}, readApp: () => assert.fail('no session, so no record is read') }), { state: 'ok', note: 'not asked from a session, so no session was checked', fix: [] });
  const unchecked = { state: 'ok', note: 'this session has no app record that can be read, so its model and level were not checked (js-harness rules applied lists the sessions off the home)', fix: [] };
  assert.deepEqual(ask(), unchecked);
  assert.deepEqual(ask({ readApp: () => { throw new Error('locked'); } }), unchecked, 'a reader that fails is a record that cannot be read');
});

test('a session whose app record is on the home is ok, a lead at the lead\'s level, and one off it is stale with the line for the user', () => {
  assert.deepEqual(ask({ readApp: () => record('JH 7 · work', home.model, home.effort) }), { state: 'ok', note: '', fix: [] });
  assert.deepEqual(ask({ readApp: () => record('JH ORQ · lead', `${home.model}[1m]`, home.lead) }), { state: 'ok', note: '', fix: [] });
  assert.deepEqual(ask({ readApp: () => record('JH ORQ · lead', home.model, other) }), {
    state: 'stale',
    note: '',
    fix: [`this session's menu holds ${home.model} at ${other} and it is held to ${home.model} at ${home.lead}; a session cannot change its own: only the user changes a lead's. To give him: ${menuLine({ model: home.model, effort: home.lead })}`],
  });
  assert.deepEqual(ask({ readApp: () => record('JH 7 · work', 'claude-opus-5-5', home.effort) }).fix, [
    `this session's menu holds claude-opus-5-5 at ${home.effort} and it is held to ${home.model} at ${home.effort}; a session cannot change its own: the lead sets it with its session tools, or the user in the menu. To give him: ${menuLine({ model: home.model, effort: home.effort })}`,
  ]);
});

test('the note carries what his settings and the project\'s say that the home does not, and a settings file that does not parse says nothing', () => {
  const settings = { 'D:/home/.claude/settings.json': JSON.stringify({ model: 'opus[1m]', modelSettings: { [home.model]: { effortLevel: home.effort } } }), 'D:/proj/.claude/settings.local.json': JSON.stringify({ effortLevel: other }) };
  assert.deepEqual(ask({ readApp: () => record('JH 7 · work', home.model, home.effort), readFile: files(settings) }), {
    state: 'ok',
    note: `his settings' default model is opus[1m], not the home's ${home.model}: a session started outside the harness runs on it; the project's .claude/settings.local.json holds effortLevel ${other}, not the home's ${home.effort}: a new session takes it`,
    fix: [],
  });
  const broken = { 'D:/home/.claude/settings.json': '{ not json', 'D:/proj/.claude/settings.local.json': '[]' };
  assert.deepEqual(ask({ readApp: () => record('JH 7 · work', home.model, home.effort), readFile: files(broken) }), { state: 'ok', note: '', fix: [] });
});

test('readSettings gives his settings and the project\'s as objects, and null for one that is missing or is no object', () => {
  const held = { 'D:/home/.claude/settings.json': JSON.stringify({ model: 'opus[1m]' }), 'D:/proj/.claude/settings.local.json': '[]' };
  assert.deepEqual(readSettings({ claudeDir: 'D:/home/.claude', project: 'D:/proj', readFile: files(held) }), { user: { model: 'opus[1m]' }, project: null });
  assert.deepEqual(readSettings({ claudeDir: 'D:/home/.claude', project: 'D:/proj', readFile: files({}) }), { user: null, project: null });
});

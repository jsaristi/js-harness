import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuLine } from './model-home.mjs';
import { forHimLine, openerLine, rowHome } from './roster-home.mjs';

// odd/tasks/one-model-home.md, spec 7. The board's own tests (./sessions.test.mjs) hold these through `rosterOf` and
// `renderBoard`; here each function is held alone, with the shapes a caller may hand it.
const HOME = { model: 'claude-fable-5-2', effort: 'medium', lead: 'high' };

test('rowHome gives the menu the app record holds, what the row is held to and what differs, by the menu or with no record by the last reply', () => {
  const on = { model: 'claude-fable-5-2', effort: 'medium' };
  assert.deepEqual(rowHome(HOME, { record: on }), { menu: on, held: on, off: null });
  assert.deepEqual(rowHome(HOME, { record: { where: 'sessions', title: null, ...on, effort: 'high' } }), { menu: { ...on, effort: 'high' }, held: on, off: { source: 'menu', model: null, effort: 'high' } });
  assert.deepEqual(rowHome(HOME, { lead: true, record: on }).held, { model: on.model, effort: 'high' }, 'the lead\'s level for the orchestrator\'s row');
  assert.deepEqual(rowHome({ ...HOME, lead: null }, { lead: true, record: on }).held, on, 'the sessions\' level where the home gives the lead none');
  assert.deepEqual(rowHome(HOME, { replied: { model: 'claude-opus-5-5', effort: null } }), { menu: null, held: on, off: { source: 'last reply', model: 'claude-opus-5-5', effort: null } });
  assert.deepEqual(rowHome(HOME), { menu: null, held: on, off: null }, 'neither a record nor a reply is judged by nothing');
  // A record that says neither is a menu that holds nothing known: it is not judged by the last reply in its place.
  assert.deepEqual(rowHome(HOME, { record: { where: 'sessions' }, replied: { model: 'claude-opus-5-5', effort: 'low' } }), { menu: { model: null, effort: null }, held: on, off: null });
  for (const none of [undefined, null, { model: null, effort: null, lead: null }, 'claude-fable-5-2']) {
    assert.deepEqual(rowHome(none, { record: { model: 'claude-opus-5-5', effort: 'low' } }), { menu: { model: 'claude-opus-5-5', effort: 'low' }, held: null, off: null }, `no home in ${JSON.stringify(none)}`);
  }
});

test('openerLine says a row made before the home was read as it did, and marks one off the home after what is not in his sidebar', () => {
  assert.equal(openerLine({ opened: 'command', where: 'not-in-app', effort: 'low' }), '    opened by a command  not in the app  effort low  NOT IN HIS SIDEBAR');
  assert.equal(openerLine({ opened: 'nobody', where: 'nowhere', effort: null }), '    opened unknown  where unknown  effort unknown');
  const held = { model: HOME.model, effort: 'medium' };
  assert.equal(openerLine({ opened: 'command', where: 'not-in-app', effort: 'high', menu: null, held, off: { source: 'last reply', model: null, effort: 'high' } }),
    '    opened by a command  not in the app  effort high  NOT IN HIS SIDEBAR  NO APP RECORD  OFF THE HOME: its last reply holds the level high, the home medium');
  assert.equal(openerLine({ opened: 'his', where: 'sessions', effort: 'high', menu: { model: 'claude-opus-5-5', effort: 'xhigh' }, held, off: { source: 'menu', model: 'claude-opus-5-5', effort: 'xhigh' } }),
    '    opened by him  in Sessions  effort xhigh in its menu, high in its last reply  OFF THE HOME: its menu holds the model claude-opus-5-5 and the level xhigh, the home claude-fable-5-2 and medium');
});

test('forHimLine is the menu line for the reading session\'s own row off the home, and nothing for any other row', () => {
  const held = { model: HOME.model, effort: 'medium' };
  const off = { source: 'menu', model: null, effort: 'high' };
  assert.deepEqual(forHimLine({ self: true, held, off }), [`    to give him: ${menuLine(held)}`]);
  assert.deepEqual(forHimLine({ self: false, held, off }), []);
  assert.deepEqual(forHimLine({ self: true, held, off: null }), []);
  assert.deepEqual(forHimLine({ self: true }), [], 'a row made before the home was read');
  assert.deepEqual(forHimLine({ self: true, held, off: { ...off, source: 'last reply' } }), [], 'no menu to pick in');
  assert.deepEqual(forHimLine({ self: true, held: { model: null, effort: 'medium' }, off }), [], 'a home that names no model gives no line to read out');
});

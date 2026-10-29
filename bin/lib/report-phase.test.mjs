import assert from 'node:assert/strict';
import test from 'node:test';
import { phaseNumbers, phaseView, renderPhase } from './report-phase.mjs';

const map = (phases) => ({ done: phases.reduce((sum, one) => sum + one.done, 0), total: phases.reduce((sum, one) => sum + one.total, 0), phases });
const step = (id, said, reported, documents = []) => ({ id, title: `${id} title`, said, reported, names: [], documents });
const moment = (commit, phases, steps, tasks = {}) => ({ commit, map: map(phases), plans: [{ name: 'F8 plan', steps }], tasks });

const BEFORE = moment('c0', [{ title: 'F1 Skeleton', done: 1, total: 2, open: ['b'] }, { title: 'F2 Board', done: 0, total: 3, open: ['x', 'y', 'z'] }], [
  step('S0', 'done', 'done'),
  step('S11', 'in progress', 'in progress', ['odd/tasks/s11.md']),
], { 'odd/tasks/s11.md': { done: 2, total: 6 } });
const AFTER = moment('c1', [{ title: 'F1 Skeleton', done: 2, total: 2, open: [] }, { title: 'F2 Board', done: 1, total: 3, open: ['y', 'z'] }], [
  step('S0', 'done', 'done'),
  step('S11', 'in progress, two PRs', 'in progress', ['odd/tasks/s11.md']),
  step('S12', 'to do', 'to do'),
], { 'odd/tasks/s11.md': { done: 4, total: 6 } });

test('the phase view compares the whole map and the plans with the before, and names what closed and what is next', () => {
  const view = phaseView({ before: BEFORE, after: AFTER, since: 'record' });
  assert.deepEqual(view.head, { before: 'c0', now: 'c1', since: 'record' });
  assert.deepEqual(view.map.total, { before: { done: 1, total: 5 }, after: { done: 3, total: 5 } });
  assert.deepEqual(view.closed, ['F1 Skeleton']);
  assert.deepEqual(view.plans[0].steps.map((one) => one.change), ['same', 'advanced', 'new']);
  assert.deepEqual(view.next.step, { plan: 'F8 plan', id: 'S11', title: 'S11 title', said: 'in progress, two PRs' }, 'the first step not done');
  assert.deepEqual(view.next.open, [{ title: 'F2 Board', done: 1, total: 3, open: ['y', 'z'] }]);
  assert.deepEqual(view.unavailable, {});
});

test('with no before the page says so and every phase and step is unmeasured, never new', () => {
  const none = phaseView({ before: null, after: AFTER, since: null });
  assert.equal(none.head.before, null);
  assert.match(none.unavailable.before, /no phase page recorded and no --since/);
  assert.ok(none.map.phases.every((one) => one.change === 'unmeasured'));
  assert.ok(none.plans[0].steps.every((one) => one.change === 'unmeasured'));
  const unread = phaseView({ before: { commit: 'c0', unavailable: 'git show: fatal: bad object c0' }, after: AFTER, since: 'c0' });
  assert.match(unread.unavailable.before, /c0: git show: fatal: bad object c0/);
  assert.ok(unread.map.phases.every((one) => one.change === 'unmeasured'));
  assert.deepEqual(unread.closed, [], 'nothing closed is claimed without a before');
});

test('a plan whose every step is done has no next step, and a map with nothing open has no open phase', () => {
  const done = moment('c2', [{ title: 'F1 Skeleton', done: 2, total: 2, open: [] }], [step('S0', 'done', 'done')]);
  const view = phaseView({ before: done, after: done, since: 'c2' });
  assert.equal(view.next.step, null);
  assert.deepEqual(view.next.open, []);
});

test('the page shows the map before and now, what closed, what is next and each plan, in Spanish', () => {
  const html = renderPhase(phaseView({ before: BEFORE, after: AFTER, since: 'record' }));
  assert.match(html, /^<title>Cambio de fase<\/title>/);
  assert.match(html, /F1 Skeleton[\s\S]*1\/2[\s\S]*2\/2 · 100 %[\s\S]*cerrada/);
  assert.match(html, /Lo que se cerró[\s\S]*F1 Skeleton/);
  assert.match(html, /Lo que sigue[\s\S]*S11[\s\S]*in progress, two PRs/);
  assert.match(html, /F2 Board[\s\S]*y · z/);
  assert.match(html, /F8 plan, paso por paso/);
  assert.doesNotMatch(html, /Primero lo malo/);
  const none = renderPhase(phaseView({ before: null, after: AFTER, since: null }));
  assert.match(none, /Primero lo malo\.[\s\S]*no hay un antes/);
  assert.match(none, /Lo que se cerró<\/h2><p class="note">Sin antes, nada se compara/);
});

test('the numbers a phase page keeps are the map by phase and each step\'s reported state', () => {
  assert.deepEqual(phaseNumbers(phaseView({ before: BEFORE, after: AFTER, since: 'record' })), {
    map: { done: 3, total: 5 },
    phases: [{ title: 'F1 Skeleton', done: 2, total: 2 }, { title: 'F2 Board', done: 1, total: 3 }],
    steps: [{ plan: 'F8 plan', id: 'S0', reported: 'done' }, { plan: 'F8 plan', id: 'S11', reported: 'in progress' }, { plan: 'F8 plan', id: 'S12', reported: 'to do' }],
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { comparePlans, compareMaps, planOf, reportedOf } from './report-pages.mjs';

const ROADMAP = `# Roadmap

## Checklist

### F1 Skeleton
- [x] one
- [ ] two

## F8 plan

Intro, and a fence that holds a heading-like line:

\`\`\`
### S99 not a step
\`\`\`

### S0 Baseline
- **Changes:** thresholds.
- **State:** done (\`odd/tasks/f8-s0-baseline.md\`); its T8 is unticked there.

### S11 The complements
- **State:** in progress, JH 68,
  worktree \`f8-s11\`; \`odd/tasks/f8-s11-complements.md\` and
  \`odd/tasks/f8-s11-complements.md\` again.
- **Order:** after S10.

### The directives pass
- **Changes:** none.

## Next
`;

test('the plan section gives its steps in order, each with its State text whole and the documents it names once', () => {
  const [plan] = planOf(ROADMAP);
  assert.equal(plan.name, 'F8 plan');
  assert.deepEqual(plan.steps.map((step) => step.id), ['S0', 'S11'], 'a heading with no State bullet is no step');
  assert.equal(plan.steps[1].said, 'in progress, JH 68, worktree `f8-s11`; `odd/tasks/f8-s11-complements.md` and `odd/tasks/f8-s11-complements.md` again.');
  assert.deepEqual(plan.steps[1].documents, ['odd/tasks/f8-s11-complements.md']);
  assert.equal(plan.steps[0].reported, 'done');
  assert.equal(plan.steps[1].reported, 'in progress');
  assert.deepEqual(plan.steps[1].names, ['f8-s11'], 'a quoted name the command may find as a document');
});

test('a roadmap with no plan section gives none', () => {
  assert.deepEqual(planOf('# R\n\n## Checklist\n'), []);
});

test('the reported state is read from the first words only, and anything else is other, never guessed', () => {
  assert.equal(reportedOf('built (PRs 602, 603)'), 'built');
  assert.equal(reportedOf('designed (`odd/tasks/x.md`); the mechanism built'), 'designed');
  assert.equal(reportedOf('to do.'), 'to do');
  assert.equal(reportedOf('Done'), 'done');
  assert.equal(reportedOf('waiting for S2'), 'other');
  assert.equal(reportedOf(null), 'other');
});

test('two plans compare step by step: a document that gained tasks advanced, prose alone is text changed', () => {
  const before = [{ name: 'F8 plan', steps: [
    { id: 'S0', title: 'S0 Baseline', said: 'done', reported: 'done', documents: ['a.md'] },
    { id: 'S11', title: 'S11 C', said: 'in progress, JH 68', reported: 'in progress', documents: ['b.md'] },
    { id: 'S13', title: 'S13 R', said: 'to do', reported: 'to do', documents: [] },
  ] }];
  const after = [{ name: 'F8 plan', steps: [
    { id: 'S0', title: 'S0 Baseline', said: 'done', reported: 'done', documents: ['a.md'] },
    { id: 'S11', title: 'S11 C', said: 'in progress, JH 68, two PRs in', reported: 'in progress', documents: ['b.md'] },
    { id: 'S13', title: 'S13 R', said: 'to do, its plan written', reported: 'to do', documents: [] },
    { id: 'S14', title: 'S14 New', said: 'to do', reported: 'to do', documents: [] },
  ] }];
  const tasks = { before: { 'a.md': { done: 8, total: 9 }, 'b.md': { done: 1, total: 6 } }, after: { 'a.md': { done: 8, total: 9 }, 'b.md': { done: 3, total: 6 } } };
  const [plan] = comparePlans(before, after, tasks);
  const byId = Object.fromEntries(plan.steps.map((step) => [step.id, step]));
  assert.equal(byId.S0.change, 'same');
  assert.equal(byId.S11.change, 'advanced');
  assert.deepEqual(byId.S11.documents, [{ path: 'b.md', before: { done: 1, total: 6 }, after: { done: 3, total: 6 } }]);
  assert.equal(byId.S13.change, 'text changed');
  assert.equal(byId.S14.change, 'new');
  assert.equal(byId.S14.before, null);
});

test('a document no commit holds is unknown at that commit, not zero tasks', () => {
  const plan = [{ name: 'P plan', steps: [{ id: 'S1', title: 'S1', said: 'designed', reported: 'designed', documents: ['gone.md'] }] }];
  const [compared] = comparePlans(plan, plan, { before: {}, after: { 'gone.md': { done: 2, total: 2 } } });
  assert.deepEqual(compared.steps[0].documents, [{ path: 'gone.md', before: null, after: { done: 2, total: 2 } }]);
  assert.equal(compared.steps[0].change, 'advanced');
});

test('two maps compare phase by phase by title, with the total, the phases that changed and those that closed', () => {
  const before = { done: 95, total: 106, phases: [{ title: 'A', done: 3, total: 3, open: [] }, { title: 'B', done: 13, total: 15, open: ['x', 'y'] }, { title: 'C', done: 1, total: 2, open: ['z'] }] };
  const after = { done: 96, total: 107, phases: [{ title: 'A', done: 3, total: 3, open: [] }, { title: 'B', done: 13, total: 16, open: ['x', 'y', 'w'] }, { title: 'C', done: 2, total: 2, open: [] }, { title: 'D', done: 0, total: 1, open: ['q'] }] };
  const map = compareMaps(before, after);
  assert.deepEqual(map.total, { before: { done: 95, total: 106 }, after: { done: 96, total: 107 } });
  assert.deepEqual(map.phases.map((phase) => [phase.title, phase.change]), [['A', 'same'], ['B', 'changed'], ['C', 'closed'], ['D', 'new']]);
  assert.deepEqual(map.phases[1].open, ['x', 'y', 'w']);
  assert.equal(compareMaps(null, after).total.before, null);
  assert.deepEqual(compareMaps(null, after).phases.map((phase) => phase.change), ['unmeasured', 'unmeasured', 'unmeasured', 'unmeasured'], 'no before is no "same"');
});

test('a step whose reported state went back is back, never advanced; a state with no place is state changed', () => {
  const step = (reported) => [{ name: 'P plan', steps: [{ id: 'S1', title: 'S1', said: reported, reported, documents: [] }] }];
  assert.equal(comparePlans(step('done'), step('in progress'))[0].steps[0].change, 'back');
  assert.equal(comparePlans(step('designed'), step('built'))[0].steps[0].change, 'advanced');
  assert.equal(comparePlans(step('done'), step('other'))[0].steps[0].change, 'state changed');
});

test('with no plan before (the moment could not be read), every step is unmeasured, never new', () => {
  const after = [{ name: 'P plan', steps: [{ id: 'S1', title: 'S1', said: 'done', reported: 'done', documents: [] }] }];
  assert.deepEqual(comparePlans(null, after)[0].steps.map((one) => one.change), ['unmeasured']);
});

test('a longer fence holding a shorter marker stays one fence: its headings and State bullets are no steps', () => {
  const fenced = '## X plan\n\n````md\n```\n### S7 example\n- **State:** done\n```\n````\n\n### S1 Real\n- **State:** to do\n';
  assert.deepEqual(planOf(fenced)[0].steps.map((one) => one.id), ['S1']);
});

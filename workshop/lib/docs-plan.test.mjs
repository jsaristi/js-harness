import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLICE_BUDGET, capabilityFiles, importsOf, planFindings, readingPlan, tierOf } from './docs-plan.mjs';

/** A tracked file of `tokens` estimated tokens. */
const file = (path, tokens = 10) => ({ path, tokens });

/** The paths of a slice, in its order. */
const paths = (slice) => slice.groups.flatMap((group) => group.files.map((one) => one.path));

test('the slice budget is 400,000 estimated tokens, 40% of a 1M window', () => {
  assert.equal(SLICE_BUDGET, 400_000);
});

test('each tracked file falls in one of four tiers: core, tests, feature documents, the rest', () => {
  assert.equal(tierOf('README.md'), 'core');
  assert.equal(tierOf('package.json'), 'core');
  assert.equal(tierOf('docs/SPEC.md'), 'core');
  assert.equal(tierOf('docs/live-board.html'), 'core');
  assert.equal(tierOf('bin/check.mjs'), 'core');
  assert.equal(tierOf('bin/lib/spec.mjs'), 'core');
  assert.equal(tierOf('bin/lib/spec.test.mjs'), 'tests');
  assert.equal(tierOf('bin/lib/ratchet.testkit.mjs'), 'tests');
  assert.equal(tierOf('workshop/js-harness-workshop.mjs'), 'core');
  assert.equal(tierOf('workshop/lib/docs-plan.mjs'), 'core');
  assert.equal(tierOf('workshop/bin/docs.test.mjs'), 'tests');
  assert.equal(tierOf('odd/tasks/audit-pack.md'), 'feature documents');
  assert.equal(tierOf('docs/sessions/2026-10-17-x.md'), 'feature documents');
  assert.equal(tierOf('docs/proposals/harness-diet.md'), 'feature documents');
  assert.equal(tierOf('evals/arms.mjs'), 'the rest');
  assert.equal(tierOf('scripts/practice.mjs'), 'the rest');
  assert.equal(tierOf('.github/workflows/gate.yml'), 'the rest');
});

test('a capability claims the tracked files its Today and Proof lines name, a line number dropped', () => {
  const tracked = new Set(['bin/reply.mjs', 'bin/lib/reply.mjs', 'bin/lib/reply.test.mjs', 'odd/tasks/reply.md', 'docs/proposals/p.md']);
  const claimed = capabilityFiles({
    title: 'The reply check',
    fields: {
      Problem: 'Seen in odd/tasks/reply.md, "Log", and in `docs/proposals/p.md:4`; odd/tasks/gone.md is not tracked.',
      Today: '`bin/reply.mjs`, `bin/lib/reply.mjs:12`, `js-harness reply`, `~/.claude/settings.json`',
      Proof: '`node --test bin/lib/reply.test.mjs`',
    },
  }, tracked);
  assert.deepEqual(claimed, {
    title: 'The reply check',
    today: ['bin/reply.mjs', 'bin/lib/reply.mjs'],
    proof: ['bin/lib/reply.test.mjs'],
    cites: ['odd/tasks/reply.md', 'docs/proposals/p.md'],
  });
});

test('the imports of a module are read relative to it, static and dynamic, and only those that are tracked', () => {
  const text = [
    "import fs from 'node:fs';",
    "import { a } from './lib/a.mjs';",
    "export { b } from '../b.mjs';",
    "const c = await import('./lib/c.mjs');",
    "import { gone } from './lib/gone.mjs';",
  ].join('\n');
  const tracked = new Set(['bin/lib/a.mjs', 'b.mjs', 'bin/lib/c.mjs']);
  assert.deepEqual(importsOf('bin/x.mjs', text, tracked), ['bin/lib/a.mjs', 'b.mjs', 'bin/lib/c.mjs']);
});

test('the core tier opens with the entry document and SPEC, then the source in the order of the capabilities', () => {
  const files = [file('README.md'), file('docs/SPEC.md'), file('docs/README.md'), file('bin/b.mjs'), file('bin/a.mjs')];
  const capabilities = [{ title: 'B first', today: ['bin/b.mjs'], proof: [] }, { title: 'A second', today: ['bin/a.mjs'], proof: [] }];
  const plan = readingPlan({ files, capabilities, imports: {}, budget: 1000 });
  assert.deepEqual(paths(plan.tiers[0].slices[0]), ['docs/README.md', 'docs/SPEC.md', 'README.md', 'bin/b.mjs', 'bin/a.mjs']);
  assert.deepEqual(plan.tiers[0].slices[0].groups.map((group) => group.name), ['orientation', 'B first', 'A second']);
});

test('a file two capabilities claim goes with the first, and a source file no Today line claims goes with the first capability whose files import it', () => {
  const files = [file('bin/a.mjs'), file('bin/b.mjs'), file('bin/lib/shared.mjs'), file('bin/lib/helper.mjs'), file('bin/lib/lonely.mjs')];
  const capabilities = [
    { title: 'A', today: ['bin/a.mjs', 'bin/lib/shared.mjs'], proof: [] },
    { title: 'B', today: ['bin/b.mjs', 'bin/lib/shared.mjs'], proof: [] },
  ];
  const plan = readingPlan({ files, capabilities, imports: { 'bin/b.mjs': ['bin/lib/helper.mjs'] }, budget: 1000 });
  const groups = Object.fromEntries(plan.tiers[0].slices.flatMap((slice) => slice.groups).map((group) => [group.name, group.files.map((one) => one.path)]));
  assert.deepEqual(groups, { A: ['bin/a.mjs', 'bin/lib/shared.mjs'], B: ['bin/b.mjs', 'bin/lib/helper.mjs'], 'claimed by no capability': ['bin/lib/lonely.mjs'] });
});

test('a test goes with the capability whose Proof names it or whose module it sits beside; the rest close the tier', () => {
  const files = [file('bin/a.mjs'), file('bin/a.test.mjs'), file('bin/lib/b.test.mjs'), file('bin/c.test.mjs')];
  const capabilities = [{ title: 'A', today: ['bin/a.mjs'], proof: [] }, { title: 'B', today: [], proof: ['bin/lib/b.test.mjs'] }];
  const plan = readingPlan({ files, capabilities, imports: {}, budget: 1000 });
  const tests = plan.tiers.find((tier) => tier.name === 'tests');
  assert.deepEqual(tests.slices[0].groups.map((group) => [group.name, group.files.map((one) => one.path)]), [
    ['A', ['bin/a.test.mjs']],
    ['B', ['bin/lib/b.test.mjs']],
    ['named by no capability', ['bin/c.test.mjs']],
  ]);
});

test('a feature document goes with the first capability that cites it; the rest go by folder', () => {
  const files = [file('odd/tasks/a.md'), file('odd/tasks/b.md'), file('docs/sessions/s.md'), file('odd/evals/x.md')];
  const capabilities = [{ title: 'A', today: [], proof: [], cites: ['odd/tasks/b.md'] }];
  const plan = readingPlan({ files, capabilities, imports: {}, budget: 1000 });
  const features = plan.tiers.find((tier) => tier.name === 'feature documents');
  assert.deepEqual(features.slices[0].groups.map((group) => [group.name, group.files.map((one) => one.path)]), [
    ['A', ['odd/tasks/b.md']],
    ['docs/sessions', ['docs/sessions/s.md']],
    ['odd/evals', ['odd/evals/x.md']],
    ['odd/tasks', ['odd/tasks/a.md']],
  ]);
});

test('a capability stays whole in one slice, and a new slice opens when it would not fit', () => {
  const files = [file('bin/a.mjs', 60), file('bin/b.mjs', 30), file('bin/c.mjs', 30)];
  const capabilities = [{ title: 'A', today: ['bin/a.mjs'], proof: [] }, { title: 'BC', today: ['bin/b.mjs', 'bin/c.mjs'], proof: [] }];
  const plan = readingPlan({ files, capabilities, imports: {}, budget: 100 });
  assert.deepEqual(plan.tiers[0].slices.map(paths), [['bin/a.mjs'], ['bin/b.mjs', 'bin/c.mjs']]);
  assert.deepEqual(plan.tiers[0].slices.map((slice) => slice.tokens), [60, 60]);
});

test('a capability over the budget splits by file, and one file over the budget is a slice of its own, flagged', () => {
  const files = [file('bin/a.mjs', 70), file('bin/b.mjs', 70), file('bin/huge.mjs', 150)];
  const capabilities = [{ title: 'AB', today: ['bin/a.mjs', 'bin/b.mjs'], proof: [] }, { title: 'Huge', today: ['bin/huge.mjs'], proof: [] }];
  const plan = readingPlan({ files, capabilities, imports: {}, budget: 100 });
  assert.deepEqual(plan.tiers[0].slices.map(paths), [['bin/a.mjs'], ['bin/b.mjs'], ['bin/huge.mjs']]);
  assert.deepEqual(plan.tiers[0].slices.map((slice) => slice.oversized === true), [false, false, true]);
});

test('every slice but the first opens with the entry document, counted in its budget', () => {
  const files = [file('docs/README.md', 20), file('bin/a.mjs', 70), file('bin/b.mjs', 70), file('bin/a.test.mjs', 85), file('evals/huge.mjs', 90)];
  const capabilities = [{ title: 'A', today: ['bin/a.mjs'], proof: [] }, { title: 'B', today: ['bin/b.mjs'], proof: [] }];
  const plan = readingPlan({ files, capabilities, imports: {}, budget: 100, preamble: 'docs/README.md' });
  const slices = plan.tiers.flatMap((tier) => tier.slices);
  assert.deepEqual(slices.map(paths), [['docs/README.md', 'bin/a.mjs'], ['bin/b.mjs'], ['bin/a.test.mjs'], ['evals/huge.mjs']]);
  assert.deepEqual(slices.map((slice) => slice.opensWith ?? null), [null, 'docs/README.md', 'docs/README.md', 'docs/README.md']);
  assert.deepEqual(slices.map((slice) => slice.tokens), [90, 90, 105, 110]);
  assert.deepEqual(slices.map((slice) => slice.oversized === true), [false, false, true, true]);
});

test('the opening counted from the second slice on splits a capability that would overflow it, by file and by group', () => {
  const files = [file('docs/README.md', 20), file('bin/a.mjs', 45), file('bin/b.mjs', 45), file('bin/c.mjs', 75)];
  const capabilities = [{ title: 'AB', today: ['bin/a.mjs', 'bin/b.mjs'], proof: [] }, { title: 'C', today: ['bin/c.mjs'], proof: [] }];
  const plan = readingPlan({ files, capabilities, imports: {}, budget: 100, preamble: 'docs/README.md' });
  const slices = plan.tiers[0].slices;
  assert.deepEqual(slices.map(paths), [['docs/README.md'], ['bin/a.mjs'], ['bin/b.mjs'], ['bin/c.mjs']]);
  assert.deepEqual(slices.map((slice) => slice.tokens), [20, 65, 65, 95]);
  assert.ok(slices.every((slice) => slice.tokens <= 100 && slice.oversized !== true));
});

test('slices are numbered across the tiers, and the plan counts the files and the tokens', () => {
  const files = [file('README.md', 5), file('bin/a.test.mjs', 5), file('evals/x.mjs', 5)];
  const plan = readingPlan({ files, capabilities: [], imports: {}, budget: 100 });
  assert.deepEqual(plan.tiers.flatMap((tier) => tier.slices.map((slice) => slice.number)), [1, 2, 3]);
  assert.equal(plan.files, 3);
  assert.equal(plan.tokens, 15);
  assert.deepEqual(plan.tiers.map((tier) => tier.name), ['core', 'tests', 'feature documents', 'the rest']);
});

test('a plan built from the tracked files has no findings', () => {
  const files = [file('README.md'), file('bin/a.mjs'), file('bin/a.test.mjs'), file('odd/tasks/a.md'), file('evals/x.mjs', 150)];
  const plan = readingPlan({ files, capabilities: [{ title: 'A', today: ['bin/a.mjs'], proof: [] }], imports: {}, budget: 100 });
  assert.deepEqual(planFindings(plan, files), []);
});

test('the findings name a file in no slice, a file in two, and a slice over the budget that is not one flagged file', () => {
  const files = [file('README.md', 60), file('AGENTS.md', 60), file('docs/x.md')];
  const plan = {
    budget: 100,
    tiers: [{ name: 'core', slices: [
      { number: 1, tokens: 120, groups: [{ name: 'orientation', files: [file('README.md', 60), file('AGENTS.md', 60)] }] },
      { number: 2, tokens: 60, groups: [{ name: 'orientation', files: [file('README.md', 60)] }] },
    ] }],
  };
  assert.deepEqual(planFindings(plan, files), [
    'slice 1 holds 120 estimated tokens, over the budget of 100, and is not one file',
    'README.md is in 2 slices: 1, 2',
    'docs/x.md is in no slice',
  ]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNNABLE, planStack, packageWords, prefixBinOf } from './stack-install.mjs';
import path from 'node:path';

const ON = { codeMap: { value: 'auto' }, codexReview: { value: 'on' }, languageServer: { value: 'on' } };
const PNPM = { words: ['pnpm'], kind: 'pnpm' };
const NPM = { words: ['npm'], kind: 'npm' };
const PREREQS_OK = [{ id: 'git', state: 'ok' }, { id: 'gh', state: 'ok' }];

/** A doctor row of `id` with every dimension `ok` but those `cells` names. */
function row(id, cells = {}) {
  return { id, version: '1.0.0', installed: 'ok', claude: 'ok', codex: 'ok', project: 'n/a', upToDate: 'ok', fix: { installed: `fix ${id}`, claude: `claude fix ${id}`, codex: `codex fix ${id}` }, ...cells };
}

function rows(overrides = {}) {
  return ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex'].map((id) => row(id, overrides[id]));
}

const plan = (overrides, extra = {}) => planStack({ rows: rows(overrides), functions: ON, prerequisites: PREREQS_OK, pm: PNPM, platform: 'linux', ...extra });

test('RUNNABLE holds the four rows of D2, in their order', () => {
  assert.deepEqual(RUNNABLE.map((r) => `${r.tool}.${r.dimension}`), ['codex.installed', 'codegraph.installed', 'codegraph.claude', 'codegraph.codex']);
});

test('a stack with no gap plans nothing', () => {
  assert.deepEqual(plan({}), { mandatory: [], manual: [], optional: [] });
});

test('every missing runnable row is planned in D2 order, each with its command and its exact undo', () => {
  const p = plan({ codex: { installed: 'missing', codex: 'n/a' }, codegraph: { installed: 'missing', claude: 'missing', codex: 'missing' } });
  assert.deepEqual(p.mandatory, [
    { tool: 'codex', dimension: 'installed', kind: 'package', bin: 'codex', run: ['pnpm', 'add', '-g', '@openai/codex'], undo: ['pnpm', 'remove', '-g', '@openai/codex'], env: {} },
    { tool: 'codegraph', dimension: 'installed', kind: 'package', bin: 'codegraph', run: ['pnpm', 'add', '-g', '@colbymchenry/codegraph'], undo: ['pnpm', 'remove', '-g', '@colbymchenry/codegraph'], env: {} },
    { tool: 'codegraph', dimension: 'claude', kind: 'registration', env: {}, run: ['claude', 'mcp', 'add', '-s', 'user', 'codegraph', '--', 'codegraph', 'serve', '--mcp'], undo: ['claude', 'mcp', 'remove', '-s', 'user', 'codegraph'] },
    { tool: 'codegraph', dimension: 'codex', kind: 'registration', env: {}, run: ['codex', 'mcp', 'add', 'codegraph', '--', 'codegraph', 'serve', '--mcp'], undo: ['codex', 'mcp', 'remove', 'codegraph'] },
  ]);
  assert.deepEqual(p.manual, []);
});

test('npm gets its own verbs for the install and the undo', () => {
  const p = plan({ codegraph: { installed: 'missing' } }, { pm: NPM });
  assert.deepEqual(p.mandatory[0].run, ['npm', 'install', '-g', '@colbymchenry/codegraph']);
  assert.deepEqual(p.mandatory[0].undo, ['npm', 'uninstall', '-g', '@colbymchenry/codegraph']);
});

test('packageWords gives the install and the remove of a spec for either manager', () => {
  assert.deepEqual(packageWords(PNPM, 'x', 'linux'), { run: ['pnpm', 'add', '-g', 'x'], undo: ['pnpm', 'remove', '-g', 'x'], env: {} });
  assert.deepEqual(packageWords(NPM, 'x', 'linux'), { run: ['npm', 'install', '-g', 'x'], undo: ['npm', 'uninstall', '-g', 'x'], env: {} });
});

test('with a prefix, npm installs and removes there, and pnpm gets that folder as its home, for the run and the undo alike', () => {
  assert.deepEqual(packageWords(NPM, 'x', 'linux', '/p'), { run: ['npm', 'install', '-g', 'x', '--prefix', '/p'], undo: ['npm', 'uninstall', '-g', 'x', '--prefix', '/p'], env: { PATH: path.join('/p', 'bin') } });
  // npm puts a global binary in the prefix itself on Windows, in its `bin` elsewhere (Codex on b9722fc..e57f2d0).
  assert.deepEqual(packageWords(NPM, 'x', 'win32', 'C:/p').env, { PATH: 'C:/p' });
  assert.equal(prefixBinOf('npm', '/p', 'linux'), path.join('/p', 'bin'));
  assert.equal(prefixBinOf('pnpm', 'C:/p', 'win32'), path.join('C:/p', 'bin'));
  const pnpm = packageWords(PNPM, 'x', 'linux', '/p');
  assert.deepEqual(pnpm.run, ['pnpm', 'add', '-g', 'x']);
  assert.deepEqual(pnpm.undo, ['pnpm', 'remove', '-g', 'x']);
  assert.equal(pnpm.env.PNPM_HOME, '/p');
  assert.equal(pnpm.env.PATH, path.join('/p', 'bin'));
  assert.deepEqual(plan({ codex: { installed: 'missing', codex: 'n/a' } }, { prefix: '/p' }).mandatory[0].env, pnpm.env);
});

test('codexReview off leaves out the Codex CLI and every registration in Codex', () => {
  const functions = { ...ON, codexReview: { value: 'off' } };
  // probeStack leaves the codex row out when the switch is off; its codegraph·codex gap must not be run either.
  const withoutCodex = rows({ codegraph: { codex: 'missing' } }).filter((r) => r.id !== 'codex');
  const p = planStack({ rows: withoutCodex, functions, prerequisites: PREREQS_OK, pm: PNPM, platform: 'linux' });
  assert.deepEqual(p.mandatory, []);
  assert.deepEqual(p.manual, []);
});

test('codeMap off leaves out codegraph entirely', () => {
  const functions = { ...ON, codeMap: { value: 'off' } };
  const p = planStack({ rows: rows({ codegraph: { installed: 'missing', claude: 'missing', codex: 'missing' } }), functions, prerequisites: PREREQS_OK, pm: PNPM, platform: 'linux' });
  assert.deepEqual(p.mandatory, []);
});

test('a runnable row in another gap state is not run: it is a manual step with doctor\'s fix', () => {
  const p = plan({ codegraph: { installed: 'outdated' } });
  assert.deepEqual(p.mandatory, []);
  assert.deepEqual(p.manual, [{ tool: 'codegraph', dimensions: ['installed'], why: 'outdated: stack install runs only what is missing', steps: ['fix codegraph'], undo: [] }]);
});

test('gentle-ai is his step: named with gentle-ai\'s own install and undo, never planned to run (F1)', () => {
  const p = plan({ 'gentle-ai': { installed: 'missing', claude: 'missing', codex: 'missing' } });
  assert.deepEqual(p.mandatory, []);
  assert.equal(p.manual.length, 1);
  const [step] = p.manual;
  assert.equal(step.tool, 'gentle-ai');
  assert.deepEqual(step.dimensions, ['installed', 'claude', 'codex']);
  assert.match(step.why, /your step/);
  assert.deepEqual(step.steps, ['go install github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@latest', 'gentle-ai install --agents claude-code,codex']);
  assert.deepEqual(step.undo, ['gentle-ai uninstall --agents claude-code,codex --yes', 'gentle-ai restore <the backup id gentle-ai install printed>']);
});

test('gentle-ai configured for one host only names that host', () => {
  const [step] = plan({ 'gentle-ai': { claude: 'missing' } }).manual;
  assert.deepEqual(step.dimensions, ['claude']);
  assert.deepEqual(step.steps, ['gentle-ai install --agents claude-code']);
  assert.deepEqual(step.undo, ['gentle-ai uninstall --agents claude-code --yes', 'gentle-ai restore <the backup id gentle-ai install printed>']);
});

test('gentle-ai in a gap state other than missing keeps doctor\'s fix, not the installer (Codex on 553900a..12e46c4)', () => {
  const fix = { installed: 'fix gentle-ai', claude: 'remove the stale hook from settings.json', codex: 'codex fix gentle-ai' };
  const [step] = plan({ 'gentle-ai': { claude: 'stale', fix } }).manual;
  assert.equal(step.tool, 'gentle-ai');
  assert.deepEqual(step.dimensions, ['claude']);
  assert.match(step.why, /^stale/);
  assert.deepEqual(step.steps, ['remove the stale hook from settings.json']);
  assert.deepEqual(step.undo, []);
});

test('gentle-ai missing in one host and stale in another names both, each with its own step', () => {
  const fix = { installed: 'fix gentle-ai', claude: 'claude fix gentle-ai', codex: 'remove the stale hook' };
  const steps = plan({ 'gentle-ai': { claude: 'missing', codex: 'stale', fix } }).manual.filter((s) => s.tool === 'gentle-ai');
  assert.deepEqual(steps.map((s) => s.dimensions), [['claude'], ['codex']]);
  assert.deepEqual(steps[0].steps, ['gentle-ai install --agents claude-code']);
  assert.deepEqual(steps[1].steps, ['remove the stale hook']);
});

test('engram is named as brought by gentle-ai\'s installer, with doctor\'s fix per dimension', () => {
  const [step] = plan({ engram: { installed: 'missing', codex: 'missing' } }).manual;
  assert.equal(step.tool, 'engram');
  assert.deepEqual(step.dimensions, ['installed', 'codex']);
  assert.match(step.why, /gentle-ai/);
  assert.deepEqual(step.steps, ['fix engram', 'codex fix engram']);
});

test('a fix shared by two dimensions is named once', () => {
  const engram = { claude: 'missing', codex: 'missing', fix: { claude: 'gentle-ai sync', codex: 'gentle-ai sync' } };
  const [step] = plan({ engram }).manual;
  assert.deepEqual(step.steps, ['gentle-ai sync']);
});

test('a Codex CLI that is not logged in is a step for him, never run', () => {
  const [step] = plan({ codex: { codex: 'missing' } }).manual;
  assert.deepEqual(step, { tool: 'codex', dimensions: ['codex'], why: 'a login takes your credentials', steps: ['codex login'], undo: ['codex logout'] });
});

test('a missing prerequisite is named, never installed', () => {
  const p = plan({}, { prerequisites: [{ id: 'git', state: 'ok' }, { id: 'gh', state: 'missing' }] });
  assert.deepEqual(p.manual, [{ tool: 'gh', dimensions: ['installed'], why: 'a prerequisite: install it yourself', steps: ['install the GitHub CLI (https://cli.github.com), then gh auth login'], undo: [] }]);
});

test('optional tools are listed with doctor\'s fix, never run', () => {
  const p = plan({ context7: { claude: 'missing' }, 'typescript-lsp': { installed: 'missing', codex: 'n/a' } });
  assert.deepEqual(p.mandatory, []);
  assert.deepEqual(p.manual, []);
  assert.deepEqual(p.optional, [
    { tool: 'context7', dimensions: ['claude'], steps: ['claude fix context7'] },
    { tool: 'typescript-lsp', dimensions: ['installed'], steps: ['fix typescript-lsp'] },
  ]);
});

test('an unknown state is no gap: nothing is planned for it', () => {
  assert.deepEqual(plan({ codegraph: { installed: 'unknown' } }), { mandatory: [], manual: [], optional: [] });
});

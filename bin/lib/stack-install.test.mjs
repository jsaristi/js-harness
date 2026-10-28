import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNNABLE, planStack, packageWords, prefixBinOf, ENGRAM_UNDO } from './stack-install.mjs';
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
  return ['engram', 'engram-plugin', 'codegraph', 'context7', 'typescript-lsp', 'codex'].map((id) => row(id, overrides[id]));
}

const plan = (overrides, extra = {}) => planStack({ rows: rows(overrides), functions: ON, prerequisites: PREREQS_OK, pm: PNPM, platform: 'linux', ...extra });

test('RUNNABLE holds the rows of D2 and context7\'s two registrations (F8 S11), in their order', () => {
  assert.deepEqual(RUNNABLE.map((r) => `${r.tool}.${r.dimension}`), ['codex.installed', 'codegraph.installed', 'codegraph.claude', 'codegraph.codex', 'context7.claude', 'context7.codex']);
});

// G11 (diet register): context7 is always on, so a missing registration is installed, not offered.
test('context7 is required: each missing registration is planned with its command and its exact undo', () => {
  const p = plan({ context7: { installed: 'missing', claude: 'missing', codex: 'missing' } });
  assert.deepEqual(p.mandatory, [
    { tool: 'context7', dimension: 'claude', kind: 'registration', env: {}, run: ['claude', 'mcp', 'add', '-s', 'user', '--transport', 'http', 'context7', 'https://mcp.context7.com/mcp'], undo: ['claude', 'mcp', 'remove', '-s', 'user', 'context7'] },
    { tool: 'context7', dimension: 'codex', kind: 'registration', env: {}, run: ['codex', 'mcp', 'add', 'context7', '--url', 'https://mcp.context7.com/mcp'], undo: ['codex', 'mcp', 'remove', 'context7'] },
  ]);
  assert.deepEqual(p.optional, []);
  assert.deepEqual(p.manual, [], 'its installed cell has no command of its own: the registrations are the install');
});

test('context7 in Codex is planned only while Codex is wanted', () => {
  const functions = { ...ON, codexReview: { value: 'off' } };
  const withoutCodex = rows({ context7: { claude: 'missing', codex: 'missing' } }).filter((r) => r.id !== 'codex');
  const p = planStack({ rows: withoutCodex, functions, prerequisites: PREREQS_OK, pm: PNPM, platform: 'linux' });
  assert.deepEqual(p.mandatory.map((r) => `${r.tool}.${r.dimension}`), ['context7.claude']);
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

// F8 S11 (odd/tasks/f8-s11-complements.md, L4): engram's own commands write more than one thing and read back their
// own entry, so they stay his step, each named with its undo; nothing of engram is run.
test('engram is his step: engram\'s own install and setup per dimension, each with its undo, never run', () => {
  const fix = { installed: 'install engram from its releases', claude: 'engram setup claude-code', codex: 'engram setup codex' };
  const [step] = plan({ engram: { installed: 'missing', claude: 'missing', codex: 'missing', fix } }).manual;
  assert.equal(step.tool, 'engram');
  assert.deepEqual(step.dimensions, ['installed', 'claude', 'codex']);
  assert.match(step.why, /your step/);
  assert.doesNotMatch(step.why, /gentle-ai/);
  assert.deepEqual(step.steps, ['install engram from its releases', 'engram setup claude-code', 'engram setup codex']);
  assert.deepEqual(step.undo, [...ENGRAM_UNDO.claude, ...ENGRAM_UNDO.codex, ...ENGRAM_UNDO.installed]);
});

test('engram\'s undo for a host is engram\'s own uninstall of what its setup wrote there', () => {
  assert.deepEqual(ENGRAM_UNDO.claude, ['claude plugin uninstall engram@engram', 'claude plugin marketplace remove engram', 'claude mcp remove engram --scope user']);
  assert.deepEqual(ENGRAM_UNDO.codex.slice(0, 3), ['codex plugin remove engram@engram', 'codex plugin marketplace remove engram', 'codex mcp remove engram']);
  const [step] = plan({ engram: { codex: 'missing' } }).manual;
  assert.deepEqual(step.undo, ENGRAM_UNDO.codex, 'one host gap names that host\'s undo alone');
});

test('a missing engram plugin is his step: engram setup alone, since it installs and enables it', () => {
  const fix = { installed: 'engram setup claude-code', claude: 'claude plugin enable engram@engram' };
  const [step] = plan({ 'engram-plugin': { installed: 'missing', claude: 'missing', codex: 'n/a', fix } }).manual;
  assert.equal(step.tool, 'engram-plugin');
  assert.deepEqual(step.dimensions, ['installed', 'claude']);
  assert.deepEqual(step.steps, ['engram setup claude-code']);
  assert.deepEqual(step.undo, ['claude plugin uninstall engram@engram', 'claude plugin marketplace remove engram']);
});

test('an installed engram plugin that is disabled is enabled, and its undo disables it', () => {
  const fix = { installed: 'engram setup claude-code', claude: 'claude plugin enable engram@engram' };
  const [step] = plan({ 'engram-plugin': { claude: 'missing', codex: 'n/a', fix } }).manual;
  assert.deepEqual(step.steps, ['claude plugin enable engram@engram']);
  assert.deepEqual(step.undo, ['claude plugin disable engram@engram']);
});

test('a fix shared by two dimensions is named once', () => {
  const engram = { claude: 'missing', codex: 'missing', fix: { claude: 'engram setup', codex: 'engram setup' } };
  const [step] = plan({ engram }).manual;
  assert.deepEqual(step.steps, ['engram setup']);
});

test('a Codex CLI that is not logged in is a step for him, never run', () => {
  const [step] = plan({ codex: { codex: 'missing' } }).manual;
  assert.deepEqual(step, { tool: 'codex', dimensions: ['codex'], why: 'a login takes your credentials', steps: ['codex login'], undo: ['codex logout'] });
});

test('a missing prerequisite is named, never installed', () => {
  const p = plan({}, { prerequisites: [{ id: 'git', state: 'ok' }, { id: 'gh', state: 'missing' }] });
  assert.deepEqual(p.manual, [{ tool: 'gh', dimensions: ['installed'], why: 'a prerequisite: install it yourself', steps: ['install the GitHub CLI (https://cli.github.com), then gh auth login'], undo: [] }]);
});

test('the optional tool is listed with doctor\'s fix, never run', () => {
  const p = plan({ 'typescript-lsp': { installed: 'missing', codex: 'n/a' } });
  assert.deepEqual(p.mandatory, []);
  assert.deepEqual(p.manual, []);
  assert.deepEqual(p.optional, [{ tool: 'typescript-lsp', dimensions: ['installed'], steps: ['fix typescript-lsp'] }]);
});

test('an unknown state is no gap: nothing is planned for it', () => {
  assert.deepEqual(plan({ codegraph: { installed: 'unknown' } }), { mandatory: [], manual: [], optional: [] });
});

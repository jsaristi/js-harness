import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stackMain, readStack, resolveStackPm } from './stack.mjs';

const ON = { codeMap: { value: 'auto' }, codexReview: { value: 'on' }, languageServer: { value: 'on' } };

function row(id, cells = {}) {
  return { id, version: '1.0.0', installed: 'ok', claude: 'ok', codex: 'ok', project: 'n/a', upToDate: 'ok', fix: { installed: `fix ${id}`, claude: `claude fix ${id}`, codex: `codex fix ${id}` }, ...cells };
}

function stack(overrides = {}, prerequisites = [{ id: 'git', state: 'ok' }, { id: 'gh', state: 'ok' }]) {
  const rows = ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex'].map((id) => row(id, overrides[id]));
  return () => ({ rows, functions: ON, prerequisites });
}

/** Runs `stackMain` with its output captured. */
async function run(argv, deps, env = { JS_HARNESS_PM: 'pnpm' }) {
  const out = [];
  const err = [];
  const code = await stackMain(argv, env, { ...deps, platform: 'linux', log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('stack with nothing missing says so and exits 0', async () => {
  const { code, out } = await run([], { read: stack() });
  assert.equal(code, 0);
  assert.match(out, /nothing the harness requires is missing/);
});

test('stack lists each install with its command and its undo, and exits 1', async () => {
  const { code, out } = await run([], { read: stack({ codegraph: { installed: 'missing', claude: 'missing' } }) });
  assert.equal(code, 1);
  assert.match(out, /run: {2}pnpm add -g @colbymchenry\/codegraph/);
  assert.match(out, /undo: pnpm remove -g @colbymchenry\/codegraph/);
  assert.match(out, /run: {2}claude mcp add -s user codegraph -- codegraph serve --mcp/);
  assert.ok(out.indexOf('@colbymchenry/codegraph') < out.indexOf('claude mcp add'), 'the install comes before the registration');
});

test('stack names his own steps and exits 1 when only they are left', async () => {
  const { code, out } = await run([], { read: stack({ 'gentle-ai': { installed: 'missing' } }) });
  assert.equal(code, 1);
  assert.match(out, /Your steps \(never run\)/);
  assert.match(out, /gentle-ai install --agents claude-code,codex/);
  assert.match(out, /undo: gentle-ai uninstall --agents claude-code,codex --yes/);
});

test('optional gaps alone exit 0', async () => {
  const { code, out } = await run([], { read: stack({ context7: { claude: 'missing' } }) });
  assert.equal(code, 0);
  assert.match(out, /Optional \(never run\)/);
  assert.match(out, /claude fix context7/);
});

test('stack --json prints the plan in the shape onboarding reads', async () => {
  const { code, out } = await run(['--json'], { read: stack({ codex: { installed: 'missing', codex: 'n/a' } }) });
  assert.equal(code, 1);
  const plan = JSON.parse(out);
  assert.deepEqual(Object.keys(plan), ['mandatory', 'manual', 'optional']);
  assert.deepEqual(plan.mandatory, [{ tool: 'codex', dimension: 'installed', kind: 'package', bin: 'codex', run: ['pnpm', 'add', '-g', '@openai/codex'], undo: ['pnpm', 'remove', '-g', '@openai/codex'], env: {} }]);
});

test('--pm names the package manager over JS_HARNESS_PM', async () => {
  const { out } = await run(['--pm', 'npm', '--json'], { read: stack({ codex: { installed: 'missing', codex: 'n/a' } }) });
  assert.deepEqual(JSON.parse(out).mandatory[0].run, ['npm', 'install', '-g', '@openai/codex']);
});

test('resolveStackPm: --pm, else JS_HARNESS_PM, else the manager of the running copy, never the word npm alone', () => {
  assert.deepEqual(resolveStackPm('npm', { JS_HARNESS_PM: 'pnpm' }, '/x'), { words: ['npm'], kind: 'npm' });
  assert.deepEqual(resolveStackPm(undefined, { JS_HARNESS_PM: 'pnpm' }, '/x'), { words: ['pnpm'], kind: 'pnpm' });
  const pnpmCopy = 'C:\\Users\\a\\AppData\\Local\\pnpm\\global\\5\\node_modules\\js-harness\\bin\\stack.mjs';
  assert.equal(resolveStackPm(undefined, {}, pnpmCopy).kind, 'pnpm');
  assert.equal(resolveStackPm(undefined, {}, '/usr/lib/node_modules/js-harness/bin/stack.mjs').kind, 'npm');
});

test('a package manager given as a command line is split into its words (Codex on 553900a..12e46c4)', async () => {
  assert.deepEqual(resolveStackPm('node /tools/pnpm.cjs', {}, '/x'), { words: ['node', '/tools/pnpm.cjs'], kind: 'pnpm' });
  const { out } = await run(['--json'], { read: stack({ codex: { installed: 'missing', codex: 'n/a' } }) }, { JS_HARNESS_PM: 'node /tools/pnpm.cjs' });
  assert.deepEqual(JSON.parse(out).mandatory[0].run, ['node', '/tools/pnpm.cjs', 'add', '-g', '@openai/codex']);
});

test('a package manager whose whole line is a file, a path with a space, stays one word (Codex on 12e46c4..6a2b0ad)', () => {
  const file = 'C:\\Program Files\\nodejs\\npm.cmd';
  const exists = (p) => p === file;
  assert.deepEqual(resolveStackPm(file, {}, '/x', exists), { words: [file], kind: 'npm' });
  assert.deepEqual(resolveStackPm('node /tools/pnpm.cjs', {}, '/x', exists).words, ['node', '/tools/pnpm.cjs']);
});

test('a shown command quotes a word the shell would read, so it runs as printed (Codex on 553900a..12e46c4)', async () => {
  const { out } = await run([], { read: stack({ codex: { installed: 'missing', codex: 'n/a' } }) }, { JS_HARNESS_PM: 'node /tools/$pm.cjs' });
  assert.match(out, /run: {2}node '\/tools\/\$pm\.cjs' install -g @openai\/codex/);
  assert.match(out, /undo: node '\/tools\/\$pm\.cjs' uninstall -g @openai\/codex/);
});

test('an unknown argument, or a missing value, is a usage error that reads nothing', async () => {
  let read = 0;
  const deps = { read: () => { read += 1; return stack()(); } };
  for (const argv of [['--bogus'], ['bogus'], ['--home']]) {
    const { code, err } = await run(argv, deps);
    assert.equal(code, 2, argv.join(' '));
    assert.match(err, /Usage: js-harness stack/);
  }
  assert.equal(read, 0);
});

test('readStack keeps only the tool rows, resolves the switches and probes git and gh', () => {
  const spawned = [];
  const spawn = (file, args) => {
    const line = [file, ...args].join(' ');
    spawned.push(line);
    if (line.startsWith('git rev-parse')) return { status: 1, stdout: '' };
    if (/^(git|gh) --version/.test(line)) return { status: 0, stdout: line.startsWith('git') ? 'git version 2.54.0' : 'gh version 2.80.0' };
    return { status: null, error: new Error('spawn ENOENT'), stdout: '' };
  };
  const { rows, functions, prerequisites } = readStack({ home: '/no/such/home', cwd: '/no/such/project', spawn, platform: 'linux', env: {} });
  assert.deepEqual(rows.map((r) => r.id), ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex']);
  assert.ok(functions.codeMap, 'the switches are resolved');
  assert.deepEqual(prerequisites, [{ id: 'git', state: 'ok' }, { id: 'gh', state: 'ok' }]);
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { functionsMain } from './functions.mjs';
import { repoTemplate } from './lib/git-fixture.testkit.mjs';

// A real git runs here: not the host's configuration, nor the repository of a commit's hook (see
// bin/lib/project.test.mjs).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-cmd-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

/** What `git init` makes, made once and copied (`lib/git-fixture.testkit.mjs`): every empty repository here is the same. */
const emptyRepo = repoTemplate((root) => {
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
});

function repo(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-cmd-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  emptyRepo(root);
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}

async function functions(cwd, ...argv) {
  const out = [];
  const err = [];
  const code = await functionsMain(argv, process.env, { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('a project with a program and no switches: each switch, what it resolves to and why', async (t) => {
  const root = repo(t, { 'notes.md': 'x', 'src/fetch.py': 'x' });
  assert.deepEqual(await functions(root), {
    code: 0,
    out: [
      'codeMap         on-demand  auto: src/fetch.py is a program',
      'languageServer  off        auto: no file of the project is TypeScript',
      'codexReview     on         auto: src/fetch.py is a program',
      'pushUnasked     off        auto: the project asks until its owner turns it on',
      'lensReview      off        auto: a commit asks for a lens record only where the project turns the lens review on',
    ].join('\n'),
    err: '',
  });
});

test('a project with no program: every function of code is off, and it says why', async (t) => {
  const root = repo(t, { 'notes.md': 'x', 'data/survey.csv': 'x' });
  assert.equal(
    (await functions(root)).out,
    [
      'codeMap         off        auto: no file of the project is a program',
      'languageServer  off        auto: no file of the project is TypeScript',
      'codexReview     off        auto: no file of the project is a program',
      'pushUnasked     off        auto: the project asks until its owner turns it on',
      'lensReview      off        auto: a commit asks for a lens record only where the project turns the lens review on',
    ].join('\n'),
  );
});

test('a declared switch is shown as declared', async (t) => {
  const root = repo(t, { 'src/fetch.py': 'x', 'harness.json': '{ "functions": { "codexReview": "off" } }' });
  assert.match((await functions(root)).out, /^codexReview {5}off {8}declared in harness\.json$/m);
});

test('run from a folder inside the project, it reads the project and not the folder', async (t) => {
  const root = repo(t, { 'src/fetch.py': 'x', 'harness.json': '{ "functions": { "codeMap": "always" } }' });
  assert.match((await functions(path.join(root, 'src'))).out, /^codeMap {9}always {5}declared in harness\.json$/m);
});

test('a switch that cannot be read: the error on stderr, exit 1, and the switch shown as on', async (t) => {
  const root = repo(t, { 'notes.md': 'x', 'harness.json': '{ "functions": { "codexReview": "no" } }' });
  const { code, out, err } = await functions(root);
  assert.equal(code, 1);
  assert.equal(err, 'harness.json "functions"."codexReview" must be one of "auto", "on", "off"; it is "no"');
  assert.match(out, /^codexReview {5}on {9}declared in harness\.json$/m);
});

test('--json prints the same as one object', async (t) => {
  const root = repo(t, { 'src/fetch.py': 'x' });
  const { code, out } = await functions(root, '--json');
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), {
    errors: [],
    functions: {
      codeMap: { value: 'on-demand', declared: 'auto', because: 'src/fetch.py is a program' },
      languageServer: { value: 'off', declared: 'auto', because: 'no file of the project is TypeScript' },
      codexReview: { value: 'on', declared: 'auto', because: 'src/fetch.py is a program' },
      pushUnasked: { value: 'off', declared: 'auto', because: 'the project asks until its owner turns it on' },
      lensReview: { value: 'off', declared: 'auto', because: 'a commit asks for a lens record only where the project turns the lens review on' },
    },
  });
});

test('outside a git repository nothing is turned off: every auto is on, with the reason', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-cmd-nogit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { code, out } = await functions(root);
  assert.equal(code, 0);
  assert.match(out, /^codexReview {5}on {9}auto: the files of the project could not be read \(git could not list the files\), so it is read as on$/m);
});

test('an argument it does not take is a usage error: exit 2, nothing on stdout', async (t) => {
  const root = repo(t, { 'notes.md': 'x' });
  const { code, out, err } = await functions(root, '--apply-everything');
  assert.equal(code, 2);
  assert.equal(out, '');
  assert.match(err, /^unknown argument: --apply-everything\n\nUsage: js-harness functions/);
});

// odd/tasks/launch-audit/a.md C-a-8: `--cwd` with no path, or followed by another flag, is a usage error like `init`'s.
test('--cwd with no path, or followed by another flag, is a usage error: exit 2, nothing on stdout', async (t) => {
  const root = repo(t, { 'notes.md': 'x' });
  for (const argv of [['--cwd'], ['--cwd', '--json']]) {
    const { code, out, err } = await functions(root, ...argv);
    assert.equal(code, 2, argv.join(' '));
    assert.equal(out, '', argv.join(' '));
    assert.match(err, /^--cwd requires a value\n\nUsage: js-harness functions/, argv.join(' '));
  }
});

// --- apply and set: what the switches write in this clone (slice 2) ---

/** Real git; a fake `codegraph` that makes `.codegraph` as the real one does. */
function fakeCodegraph(cmd, args, opts) {
  if (cmd === 'git') return spawnSync('git', args, opts);
  fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
  return { status: 0, stdout: '', stderr: '' };
}

async function run(cwd, ...argv) {
  const out = [];
  const err = [];
  const code = await functionsMain(argv, process.env, {
    cwd,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    spawn: fakeCodegraph,
    platform: 'linux',
  });
  return { code, out, err };
}

const settingsOf = (root) => JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.local.json'), 'utf8'));

test('apply in a project with no pin writes what the switches ask, in a manifest of its own that uninstall undoes', async (t) => {
  const root = repo(t, { 'bin/a.mjs': 'x', 'harness.json': '{ "sensors": [] }\n' });
  const applied = await run(root, 'apply');
  assert.equal(applied.code, 0, applied.err.join('\n'));
  assert.deepEqual(applied.out, [
    'wrote .git/hooks/pre-push',
    'ran codegraph init',
    'wrote .claude/settings.local.json#/env/CODEGRAPH_NO_PROMPT_HOOK',
    'wrote .claude/settings.local.json#/enabledPlugins/typescript-lsp@claude-plugins-official',
  ]);
  assert.deepEqual(settingsOf(root), {
    env: { CODEGRAPH_NO_PROMPT_HOOK: '1' },
    enabledPlugins: { 'typescript-lsp@claude-plugins-official': false },
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.git', 'js-harness', 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.files.map((f) => f.path), ['.git/hooks/pre-push']);
  assert.deepEqual(manifest.codegraph, { createdDir: true, status: 'ok' });

  assert.deepEqual(await run(root, 'apply'), { code: 0, out: ['functions: this clone already is what its switches ask'], err: [] });

  const { uninstallProject } = await import('./lib/project.mjs');
  assert.equal(uninstallProject(root, { spawn: fakeCodegraph }).code, 0);
  assert.equal(fs.readFileSync(path.join(root, 'harness.json'), 'utf8'), '{ "sensors": [] }\n');
  for (const gone of ['.claude', '.codegraph', '.git/hooks/pre-push', '.git/js-harness/manifest.json']) {
    assert.equal(fs.existsSync(path.join(root, gone)), false, gone);
  }
});

test('apply where nothing is to be written writes no manifest', async (t) => {
  // The map always on with its index already there, the plugin on, no push check: nothing to write.
  const root = repo(t, {
    'notes.md': 'x',
    '.codegraph/index.db': 'x',
    'harness.json': '{ "functions": { "codeMap": "always", "languageServer": "on", "codexReview": "off" } }\n',
  });
  assert.deepEqual(await run(root, 'apply'), { code: 0, out: ['functions: this clone already is what its switches ask'], err: [] });
  assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
});

test('apply with no harness.json, or a switch that cannot be read, applies nothing and exits 1', async (t) => {
  const bare = repo(t, { 'bin/a.mjs': 'x' });
  assert.deepEqual(await run(bare, 'apply'), { code: 1, out: [], err: ['no harness.json here: js-harness init writes one'] });

  const bad = repo(t, { 'bin/a.mjs': 'x', 'harness.json': '{ "functions": { "codeMap": "sometimes" } }\n' });
  const result = await run(bad, 'apply');
  assert.equal(result.code, 1);
  assert.match(result.err.join('\n'), /^harness\.json "functions" failed: .*codeMap.*sometimes.*no switch was applied$/m);
  assert.equal(fs.existsSync(path.join(bad, '.claude')), false);
});

test('set writes the switch into harness.json in its own layout, and applies it', async (t) => {
  const root = repo(t, { 'bin/a.mjs': 'x', 'harness.json': '{\r\n\t"sensors": []\r\n}\r\n' });
  await run(root, 'apply');
  const set = await run(root, 'set', 'codeMap', 'always');
  assert.equal(set.code, 0, set.err.join('\n'));
  assert.deepEqual(set.out, [
    'harness.json: functions.codeMap is always',
    'removed .claude/settings.local.json#/env/CODEGRAPH_NO_PROMPT_HOOK',
  ]);
  assert.equal(fs.readFileSync(path.join(root, 'harness.json'), 'utf8'), '{\r\n\t"sensors": [],\r\n\t"functions": {\r\n\t\t"codeMap": "always"\r\n\t}\r\n}\r\n');
  assert.deepEqual(settingsOf(root), { enabledPlugins: { 'typescript-lsp@claude-plugins-official': false } });
});

test('set refuses a switch or a value the table does not have, and writes nothing', async (t) => {
  const root = repo(t, { 'harness.json': '{}\n' });
  assert.deepEqual(await run(root, 'set', 'codeMap', 'sometimes'), {
    code: 1,
    out: [],
    err: ['codeMap takes auto, on-demand, always, off, not sometimes'],
  });
  assert.deepEqual(await run(root, 'set', 'paste', 'off'), {
    code: 1,
    out: [],
    err: ['paste is no switch; the switches are codeMap, languageServer, codexReview, pushUnasked, lensReview'],
  });
  assert.equal(fs.readFileSync(path.join(root, 'harness.json'), 'utf8'), '{}\n');
});

test('apply and set take no --json and no other word: a usage error, exit 2', async (t) => {
  const root = repo(t, { 'harness.json': '{}\n' });
  for (const argv of [['apply', '--json'], ['set', 'codeMap'], ['apply', 'now'], ['remove']]) {
    const { code, out, err } = await run(root, ...argv);
    assert.equal(code, 2, argv.join(' '));
    assert.deepEqual(out, []);
    assert.match(err.join('\n'), /^unknown argument: .*\n\nUsage: js-harness functions/);
  }
});

test('set and apply outside a git repository write nothing, and a folder that does not exist is said so', async (t) => {
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-cmd-nogit-'));
  t.after(() => fs.rmSync(plain, { recursive: true, force: true }));
  fs.writeFileSync(path.join(plain, 'harness.json'), '{}\n');
  for (const argv of [['set', 'codeMap', 'off'], ['apply']]) {
    assert.deepEqual(await run(plain, ...argv), {
      code: 1,
      out: [],
      err: ['not inside a git repository: functions apply and set act on a project'],
    });
  }
  assert.equal(fs.readFileSync(path.join(plain, 'harness.json'), 'utf8'), '{}\n');

  const missing = path.join(plain, 'no-such-folder');
  assert.deepEqual(await run(plain, 'apply', '--cwd', missing), { code: 1, out: [], err: [`no such directory: ${missing}`] });
});

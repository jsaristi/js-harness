// `init`, `sync` and `uninstall` with the switches of harness.json "functions" (odd/tasks/on-demand-functions.md,
// slice 2): an index only where the code map is on, the keys of the clone's Claude settings written, recorded
// and undone, and a manifest a copy that cannot read it refuses to undo. The rest of those commands is
// project.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyProjectFunctions, initProject, projectLocation, syncProject, uninstallProject, InitWriteError, MANIFEST_FORMAT } from './project.mjs';
import { repoTemplate } from './git-fixture.testkit.mjs';
import { PERMISSIONS_DENY } from './deny-paths.mjs';

// Every git call here is real, so none may read the host's config or, under a hook, the repository being
// committed (the same isolation as project.test.mjs).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-switches-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

/** A repository holding `files` (name to content), removed after the test. */
/** What `git init` makes, made once and copied (`git-fixture.testkit.mjs`): every empty repository here is the same. */
const emptyRepo = repoTemplate((root) => {
  assert.equal(spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' }).status, 0);
});

function repo(t, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-switches-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  emptyRepo(root);
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content, 'utf8');
  }
  return root;
}

/** Real git; a fake `codegraph` that makes `.codegraph` as the real one does, and counts its calls. */
function makeSpawn() {
  const spawn = (cmd, args, opts) => {
    if (cmd === 'git') return spawnSync('git', args, opts);
    spawn.codegraphCalls += 1;
    fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
    return { status: 0, stdout: '', stderr: '' };
  };
  spawn.codegraphCalls = 0;
  return spawn;
}

const deps = (spawn = makeSpawn()) => ({ spawn, platform: 'linux' });
const settingsPath = (root) => path.join(root, '.claude', 'settings.local.json');
const settings = (root) => JSON.parse(fs.readFileSync(settingsPath(root), 'utf8'));
const manifestPath = (root) => path.join(root, '.git', 'js-harness', 'manifest.json');
const manifest = (root) => JSON.parse(fs.readFileSync(manifestPath(root), 'utf8'));
const harness = (root, data) => fs.writeFileSync(path.join(root, 'harness.json'), `${JSON.stringify(data, null, 2)}\n`);
const PASTE = '.claude/settings.local.json#/env/CODEGRAPH_NO_PROMPT_HOOK';
const PLUGIN = '.claude/settings.local.json#/enabledPlugins/typescript-lsp@claude-plugins-official';
// What every clone holds whatever its switches (odd/tasks/f8-s10-port.md, T5), written first.
const STYLE = '.claude/settings.local.json#/outputStyle';
const DENIES = '.claude/settings.local.json#/permissions/deny';
const ALWAYS = { outputStyle: 'js-harness', permissions: { deny: PERMISSIONS_DENY } };

test('init in a project with no program makes no index, says why, and turns the paste and the plugin off', (t) => {
  const root = repo(t, { 'notes.md': '# notes\n' });
  const spawn = makeSpawn();
  const result = initProject(root, '0.1.0', deps(spawn));
  assert.equal(result.code, 0);
  assert.equal(spawn.codegraphCalls, 0);
  assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
  assert.deepEqual(result.actions.find((a) => a.path === 'codegraph init'), {
    kind: 'skip',
    path: 'codegraph init',
    reason: 'the code map is off: no file of the project is a program',
  });
  assert.deepEqual(settings(root), {
    ...ALWAYS,
    env: { CODEGRAPH_NO_PROMPT_HOOK: '1' },
    enabledPlugins: { 'typescript-lsp@claude-plugins-official': false },
  });
  assert.deepEqual(manifest(root).codegraph, { createdDir: false, status: 'off' });
  // Format 3: the manifest records the style and the denies every clone holds (odd/tasks/f8-s10-port.md, L13).
  assert.equal(manifest(root).format, 3);
  assert.deepEqual(manifest(root).settings.map((record) => record.key), ['outputStyle', 'denies', 'paste', 'languageServer']);
});

test('init in a project with TypeScript makes the index and leaves the plugin on', (t) => {
  const root = repo(t, { 'src/a.ts': 'export {};\n' });
  const spawn = makeSpawn();
  const result = initProject(root, '0.1.0', deps(spawn));
  assert.equal(spawn.codegraphCalls, 1);
  assert.deepEqual(result.actions.filter((a) => a.path?.startsWith('.claude/')).map((a) => [a.kind, a.path]), [['wrote', STYLE], ['wrote', DENIES], ['wrote', PASTE]]);
  assert.deepEqual(settings(root), { ...ALWAYS, env: { CODEGRAPH_NO_PROMPT_HOOK: '1' } });
});

test('init keeps what the settings file already holds and never overwrites a key set by hand', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', '.claude/settings.local.json': '{ "effortLevel": "high", "enabledPlugins": { "typescript-lsp@claude-plugins-official": true } }\n' });
  const result = initProject(root, '0.1.0', deps());
  assert.deepEqual(result.actions.find((a) => a.path === PLUGIN), {
    kind: 'kept',
    path: PLUGIN,
    reason: 'holds true, never overwritten; the switch is not applied here',
  });
  assert.deepEqual(settings(root), {
    effortLevel: 'high',
    enabledPlugins: { 'typescript-lsp@claude-plugins-official': true },
    env: { CODEGRAPH_NO_PROMPT_HOOK: '1' },
    ...ALWAYS,
  });
  assert.deepEqual(manifest(root).settings.map((record) => record.key), ['outputStyle', 'denies', 'paste']);
});

test('uninstall puts the settings back as they were: the keys it wrote go, a file it made goes, the rest stays', (t) => {
  const made = repo(t, { 'bin/a.mjs': '' });
  initProject(made, '0.1.0', deps());
  const undone = uninstallProject(made, deps());
  assert.equal(undone.code, 0);
  assert.deepEqual(undone.actions.filter((a) => a.path?.startsWith('.claude/')).map((a) => [a.kind, a.path]), [
    ['removed', STYLE],
    ['removed', DENIES],
    ['removed', PASTE],
    ['removed', PLUGIN],
  ]);
  assert.equal(fs.existsSync(path.join(made, '.claude')), false);

  const held = repo(t, { 'bin/a.mjs': '', '.claude/settings.local.json': '{\n  "effortLevel": "high"\n}\n' });
  initProject(held, '0.1.0', deps());
  assert.equal(uninstallProject(held, deps()).code, 0);
  assert.equal(fs.readFileSync(settingsPath(held), 'utf8'), '{\n  "effortLevel": "high"\n}\n');
});

test('uninstall keeps a key somebody changed since it was written', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  fs.writeFileSync(settingsPath(root), '{ "env": { "CODEGRAPH_NO_PROMPT_HOOK": "0" }, "enabledPlugins": { "typescript-lsp@claude-plugins-official": false } }\n');
  const undone = uninstallProject(root, deps());
  assert.equal(undone.code, 0);
  assert.deepEqual(undone.actions.find((a) => a.path === PASTE), { kind: 'kept', path: PASTE, reason: 'changed since it was written' });
  assert.deepEqual(settings(root), { env: { CODEGRAPH_NO_PROMPT_HOOK: '0' } });
});

test('uninstall and sync refuse a manifest of a newer format and touch nothing', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  const written = { ...manifest(root), format: MANIFEST_FORMAT + 1 };
  fs.writeFileSync(manifestPath(root), JSON.stringify(written));
  const before = fs.readFileSync(settingsPath(root), 'utf8');

  for (const result of [uninstallProject(root, deps()), syncProject(root, '0.1.0', deps())]) {
    assert.deepEqual(result, { code: 1, newerManifest: true, manifestPath: result.manifestPath, format: MANIFEST_FORMAT + 1, version: '0.1.0' });
  }
  assert.equal(fs.readFileSync(settingsPath(root), 'utf8'), before);
  assert.ok(fs.existsSync(path.join(root, 'harness.json')));
  assert.deepEqual(manifest(root), written);
});

test('a manifest that holds settings without a format, or a record of another key, is malformed', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  // Without the line of .atl/ too, which needs the format as well, so the settings alone are judged.
  const { format, exclude, ...withoutFormat } = manifest(root);
  assert.equal(format, 3);
  fs.writeFileSync(manifestPath(root), JSON.stringify(withoutFormat));
  assert.equal(uninstallProject(root, deps()).malformedManifest, true);
  // A record of the style or the denies in a format older than the one that knows them is no record of this copy's.
  fs.writeFileSync(manifestPath(root), JSON.stringify({ ...withoutFormat, format: 2 }));
  assert.equal(uninstallProject(root, deps()).malformedManifest, true);

  const other = { ...withoutFormat, format: 1, settings: [{ ...withoutFormat.settings[0], pointer: ['env', 'PATH'] }] };
  fs.writeFileSync(manifestPath(root), JSON.stringify(other));
  assert.equal(uninstallProject(root, deps()).malformedManifest, true);
  assert.equal(settings(root).env.CODEGRAPH_NO_PROMPT_HOOK, '1');
});

test('sync follows a switch changed in harness.json: a key no longer wanted is taken back', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  harness(root, { version: '0.1.0', functions: { languageServer: 'on' } });
  const synced = syncProject(root, '0.1.0', deps());
  assert.equal(synced.code, 0);
  assert.equal(synced.upToDate, false);
  assert.deepEqual(synced.actions, [{ kind: 'removed', path: PLUGIN }]);
  assert.deepEqual(settings(root), { ...ALWAYS, env: { CODEGRAPH_NO_PROMPT_HOOK: '1' } });
  assert.deepEqual(manifest(root).settings.map((record) => record.key), ['outputStyle', 'denies', 'paste']);

  harness(root, { version: '0.1.0', functions: { codeMap: 'always', languageServer: 'on' } });
  syncProject(root, '0.1.0', deps());
  // What every clone holds stays: the style and the denies (odd/tasks/f8-s10-port.md, T5), in the format a copy
  // that knows them reads; an older copy refuses it as newer, never as malformed (L13).
  assert.equal(manifest(root).format, 3);
  assert.deepEqual(settings(root), ALWAYS);
  assert.deepEqual(manifest(root).settings.map((record) => record.key), ['outputStyle', 'denies']);
  assert.equal(syncProject(root, '0.1.0', deps()).upToDate, true);
});

test('sync removes the index for a declared off only when js-harness made it', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  assert.ok(fs.existsSync(path.join(root, '.codegraph')));
  harness(root, { version: '0.1.0', functions: { codeMap: 'off' } });
  const synced = syncProject(root, '0.1.0', deps());
  assert.ok(synced.actions.some((a) => a.kind === 'removed' && a.path === '.codegraph'));
  assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
  assert.deepEqual(manifest(root).codegraph, { createdDir: false, status: 'off' });

  fs.mkdirSync(path.join(root, '.codegraph'));
  const kept = syncProject(root, '0.1.0', deps());
  assert.ok(kept.actions.some((a) => a.kind === 'kept' && a.path === '.codegraph'));
  assert.ok(fs.existsSync(path.join(root, '.codegraph')));
});

test('an index that auto resolves off is never removed: a project whose code is gone keeps it', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  fs.rmSync(path.join(root, 'bin'), { recursive: true });
  const synced = syncProject(root, '0.1.0', deps());
  assert.ok(fs.existsSync(path.join(root, '.codegraph')));
  assert.ok(!synced.actions.some((a) => a.path === '.codegraph'));
});

test('a functions that cannot be read applies nothing in sync and says why', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  const before = fs.readFileSync(settingsPath(root), 'utf8');
  harness(root, { version: '0.1.0', functions: { codeMap: 'sometimes', languageServer: 'on' } });
  const synced = syncProject(root, '0.1.0', deps());
  assert.equal(synced.code, 0);
  const problem = synced.actions.find((a) => a.kind === 'problem');
  assert.equal(problem.path, 'harness.json "functions"');
  assert.match(problem.reason, /codeMap.*sometimes.*no switch was applied$/);
  assert.equal(fs.readFileSync(settingsPath(root), 'utf8'), before);
});

test('init takes back the keys it wrote when the manifest cannot be written', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', '.claude/settings.local.json': '{ "effortLevel": "high" }\n' });
  const open = (target) => {
    if (target.includes('manifest.json.')) throw new Error('disk full');
    return fs.openSync(target, 'wx');
  };
  assert.throws(() => initProject(root, '0.1.0', { ...deps(), open }), InitWriteError);
  assert.deepEqual(settings(root), { effortLevel: 'high' });
  assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
});

// Codex on d0d6807..1f607cb (P2): a sync that writes back one deny and then cannot write the manifest takes back
// only that one; the denies the manifest on disk still records stay where they were.
test('a sync that cannot write the manifest takes back only the denies it added, never those recorded before', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  const before = settings(root);
  fs.writeFileSync(settingsPath(root), JSON.stringify({ ...before, permissions: { deny: PERMISSIONS_DENY.slice(1) } }));
  const open = (target) => {
    if (target.includes('manifest.json.')) throw new Error('disk full');
    return fs.openSync(target, 'wx');
  };
  assert.throws(() => syncProject(root, '0.1.0', { ...deps(), open }), InitWriteError);
  assert.deepEqual(settings(root).permissions.deny, PERMISSIONS_DENY.slice(1));
});

const prePushPath = (root) => path.join(root, '.git', 'hooks', 'pre-push');

test('init wires the push check where the Codex review is on, and records it for uninstall', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  const result = initProject(root, '0.1.0', deps());
  const text = fs.readFileSync(prePushPath(root), 'utf8');
  assert.match(text, /^#!\/bin\/sh\n/);
  assert.match(text, /js-harness check --push --remote "\$1" --head "\$local_sha" < \/dev\/null \|\| status=1/);
  assert.ok(result.actions.some((a) => a.kind === 'wrote' && a.path === '.git/hooks/pre-push'));
  assert.ok(manifest(root).files.some((f) => f.path === '.git/hooks/pre-push'));

  assert.equal(uninstallProject(root, deps()).code, 0);
  assert.equal(fs.existsSync(prePushPath(root)), false);
});

test('no push check where the Codex review is off: by auto in a project with no program, or declared', (t) => {
  const notes = repo(t, { 'notes.md': '' });
  initProject(notes, '0.1.0', deps());
  assert.equal(fs.existsSync(prePushPath(notes)), false);

  // A clone of a project that declares the review off, set up by sync.
  const declared = repo(t, { 'bin/a.mjs': '' });
  harness(declared, { version: '0.1.0', functions: { codexReview: 'off' } });
  const synced = syncProject(declared, '0.1.0', deps());
  assert.equal(synced.setUp, true);
  assert.equal(fs.existsSync(prePushPath(declared)), false);
});

test('a push hook of the project own is kept and named, never overwritten', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', '.git/hooks/pre-push': '#!/bin/sh\nexit 0\n' });
  const result = initProject(root, '0.1.0', deps());
  assert.deepEqual(result.actions.find((a) => a.path === '.git/hooks/pre-push'), {
    kind: 'kept',
    path: '.git/hooks/pre-push',
    reason: 'exists; add `js-harness check --push` for each pushed ref to it',
  });
  assert.equal(fs.readFileSync(prePushPath(root), 'utf8'), '#!/bin/sh\nexit 0\n');
});

test('sync takes the push check away when the review is turned off, and writes it when turned on', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  harness(root, { version: '0.1.0', functions: { codexReview: 'off' } });
  const off = syncProject(root, '0.1.0', deps());
  assert.ok(off.actions.some((a) => a.kind === 'removed' && a.path === '.git/hooks/pre-push'));
  assert.equal(fs.existsSync(prePushPath(root)), false);
  assert.ok(!manifest(root).files.some((f) => f.path === '.git/hooks/pre-push'));

  harness(root, { version: '0.1.0', functions: { codexReview: 'on' } });
  const on = syncProject(root, '0.1.0', deps());
  assert.ok(on.actions.some((a) => a.kind === 'wrote' && a.path === '.git/hooks/pre-push'));
  assert.ok(fs.existsSync(prePushPath(root)));
  assert.ok(manifest(root).files.some((f) => f.path === '.git/hooks/pre-push'));
  assert.equal(syncProject(root, '0.1.0', deps()).upToDate, true);
});

test('sync keeps a push check somebody changed, even with the review off', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  fs.appendFileSync(prePushPath(root), '# mine\n');
  harness(root, { version: '0.1.0', functions: { codexReview: 'off' } });
  const synced = syncProject(root, '0.1.0', deps());
  assert.ok(synced.actions.some((a) => a.kind === 'kept' && a.path === '.git/hooks/pre-push'));
  assert.ok(fs.existsSync(prePushPath(root)));
});

test('a clone where only the switches were applied is not set up, and sync sets it up the rest of the way', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  harness(root, { version: '0.1.0' });
  const applied = applyProjectFunctions(root, '0.1.0', deps());
  assert.equal(applied.code, 0);
  assert.equal(manifest(root).scope, 'functions');
  assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
  assert.equal(projectLocation(root, deps()).functionsOnly, true);

  const synced = syncProject(root, '0.1.0', deps());
  assert.ok(synced.actions.some((a) => a.kind === 'wrote' && a.path === '.git/hooks/pre-commit'));
  assert.equal(manifest(root).scope, undefined);
  assert.ok(manifest(root).files.some((f) => f.path === '.git/hooks/pre-commit'));
  assert.equal(projectLocation(root, deps()).functionsOnly, false);
  assert.equal(syncProject(root, '0.1.0', deps()).upToDate, true);
});

test('turning the review off never removes a push check that a link now sends outside the repository', (t) => {
  const root = repo(t, { 'bin/a.mjs': '' });
  initProject(root, '0.1.0', deps());
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-switches-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  // The hooks folder moves out, and a link (a junction on Windows) takes its place.
  const hooks = path.join(root, '.git', 'hooks');
  fs.cpSync(hooks, path.join(outside, 'hooks'), { recursive: true });
  fs.rmSync(hooks, { recursive: true });
  fs.symlinkSync(path.join(outside, 'hooks'), hooks, 'junction');

  harness(root, { version: '0.1.0', functions: { codexReview: 'off' } });
  const synced = syncProject(root, '0.1.0', deps());
  assert.deepEqual(synced.actions.find((a) => a.path === '.git/hooks/pre-push'), {
    kind: 'kept',
    path: '.git/hooks/pre-push',
    reason: 'moved outside',
  });
  assert.ok(fs.existsSync(path.join(outside, 'hooks', 'pre-push')));
});

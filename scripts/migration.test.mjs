// The migration's proof on a real old project (F8 S12, odd/tasks/f8-s12-migration.md, S4 and S5): in a scratch home,
// the `init` of the release v0.97.0 itself, taken from this repository's tag, sets a scratch project up; the project
// then gets edits of its own and is committed; two copies of it are made. One is migrated by this checkout and must
// keep every edit, import AGENTS.md from a CLAUDE.md doctor's import row reads as ok, and need nothing more; then
// `uninstall project` on both copies, and git on the committed files the migration wrote, must leave the two copies
// the same bytes: whatever the migration wrote, the record or git takes back exactly. It spends nothing and needs no
// network; S13's rehearsal harness gives the scratch layout, the environment with no login and the snapshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rehearsalLayout, rehearsalEnv, snapshotTree } from './rehearsal.mjs';
import { importRowState } from './rehearsal-lib.mjs';
import { agentsBlock, claudeTemplate } from '../bin/lib/project.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const JS_HARNESS = fileURLToPath(new URL('../bin/js-harness.mjs', import.meta.url));
/** The release whose `init` set up the one initialized project the read-only scan found (L3). */
const RELEASE = 'v0.97.0';
const OURS = '\n## Our own\n- a line the project added after init\n';
/** The version this checkout runs: past the release, the migration moves the pin too. */
const RUNNING = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Every file of `dir` by its path from `dir`, with `.git` reduced to what init, migrate and uninstall touch there. */
function projectBytes(dir) {
  const kept = (rel) => !/^\.git[\\/]/.test(rel) || /^\.git[\\/](hooks|info|js-harness)[\\/]/.test(rel);
  return Object.fromEntries(
    Object.entries(snapshotTree(dir))
      .map(([file, hash]) => [path.relative(dir, file).replaceAll('\\', '/'), hash])
      .filter(([rel]) => kept(rel)),
  );
}

test(`a copy of a project ${RELEASE}'s init set up migrates keeping its edits, and uninstall and git take back every write`, (t) => {
  const tag = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${RELEASE}`], { cwd: REPO, encoding: 'utf8' });
  if (tag.status !== 0) {
    t.skip(`${RELEASE} is not a tag of this clone`);
    return;
  }
  const layout = rehearsalLayout(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migration-')));
  t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
  const gitConfig = path.join(layout.root, 'gitconfig');
  fs.mkdirSync(layout.home, { recursive: true });
  fs.writeFileSync(gitConfig, '[user]\n\tname = scratch\n\temail = scratch@example.com\n[core]\n\tautocrlf = false\n');
  const env = { ...rehearsalEnv(layout, process.env), GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: '1' };
  const run = (command, args, cwd, extra = {}) => spawnSync(command, args, { cwd, env: { ...env, ...extra }, encoding: 'utf8', timeout: 120_000 });
  const ok = (result, what) => assert.equal(result.status, 0, `${what} exited ${result.status}:\n${result.stdout}${result.stderr}`);

  // The release, read from the tag through an index of its own, so this repository's index is never touched.
  const release = path.join(layout.root, 'release');
  const index = { GIT_INDEX_FILE: path.join(layout.root, 'release.index') };
  ok(run('git', ['read-tree', RELEASE], REPO, index), 'git read-tree');
  ok(run('git', ['checkout-index', '-a', `--prefix=${release.replaceAll('\\', '/')}/`], REPO, index), 'git checkout-index');
  const old = (...args) => run(process.execPath, [path.join(release, 'bin', 'js-harness.mjs'), ...args], layout.project);

  // A project with no program, so the code map stays off and no index is made, initialized by the release.
  fs.mkdirSync(path.join(layout.project, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(layout.project, 'README.md'), '# scratch\n');
  ok(run('git', ['init', '-q'], layout.project), 'git init');
  ok(old('init', '--cwd', layout.project, '--home', layout.home), `${RELEASE} init`);
  assert.equal(fs.existsSync(path.join(layout.project, 'CLAUDE.md')), false, `${RELEASE} wrote no CLAUDE.md`);

  // The project's own edits: a line after the block, a document, and a key of its own in the clone's settings.
  fs.appendFileSync(path.join(layout.project, 'AGENTS.md'), OURS);
  fs.writeFileSync(path.join(layout.project, 'docs', 'notes.md'), '# notes\n');
  const settingsFile = path.join(layout.project, '.claude', 'settings.local.json');
  const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify({ ...settings, model: 'the-project-s-own' }, null, 2) + '\n');
  ok(run('git', ['add', '-A'], layout.project), 'git add');
  ok(run('git', ['commit', '-q', '--no-verify', '-m', 'the project as it was'], layout.project), 'git commit');

  const copies = { left: path.join(layout.root, 'left'), migrated: path.join(layout.root, 'migrated') };
  for (const copy of Object.values(copies)) fs.cpSync(layout.project, copy, { recursive: true });
  const harness = (cwd, ...args) => run(process.execPath, [JS_HARNESS, ...args], cwd);

  const check = harness(copies.migrated, 'migrate', '--check', '--home', layout.home);
  assert.equal(check.status, 1, `migrate --check before:\n${check.stdout}${check.stderr}`);
  const migrated = harness(copies.migrated, 'migrate', '--home', layout.home);
  ok(migrated, 'migrate');
  const changed = /^commit what migrate changed: (.+)$/m.exec(migrated.stdout)?.[1].split(', ') ?? [];
  assert.deepEqual(changed, RUNNING === RELEASE.slice(1) ? ['AGENTS.md', 'CLAUDE.md'] : ['AGENTS.md', 'CLAUDE.md', 'harness.json']);

  const read = (file) => fs.readFileSync(path.join(copies.migrated, file), 'utf8');
  assert.equal(read('CLAUDE.md'), claudeTemplate());
  assert.ok(read('AGENTS.md').includes(agentsBlock()), 'AGENTS.md holds the reviewer\'s half of the block');
  assert.ok(read('AGENTS.md').endsWith(OURS), 'AGENTS.md keeps the line the project added');
  const migratedSettings = JSON.parse(read('.claude/settings.local.json'));
  assert.equal(migratedSettings.model, 'the-project-s-own');
  assert.equal(migratedSettings.outputStyle, 'js-harness');
  assert.ok(Array.isArray(migratedSettings.permissions?.deny) && migratedSettings.permissions.deny.length > 0, 'the denies are written');
  const manifest = JSON.parse(fs.readFileSync(path.join(copies.migrated, '.git', 'js-harness', 'manifest.json'), 'utf8'));
  assert.ok(manifest.files.some((file) => file.path === 'CLAUDE.md'), 'the record names the CLAUDE.md the migration wrote');
  assert.match(manifest.coverage?.baseline ?? '', /^\d{4}-\d{2}-\d{2}$/);
  const doctor = harness(copies.migrated, 'doctor', '--home', layout.home, '--cwd', copies.migrated, '--offline', '--json');
  assert.equal(importRowState(doctor.stdout), 'ok', `doctor's claude-import row:\n${doctor.stdout}${doctor.stderr}`);

  // What the migration changed in the committed files, committed as a project would, then nothing left to do.
  ok(run('git', ['add', '-A'], copies.migrated), 'git add');
  ok(run('git', ['commit', '-q', '--no-verify', '-m', 'migrated'], copies.migrated), 'git commit');
  const after = harness(copies.migrated, 'migrate', '--check', '--home', layout.home);
  assert.equal(after.status, 0, `migrate --check after:\n${after.stdout}${after.stderr}`);
  ok(run('git', ['reset', '-q', '--soft', 'HEAD~1'], copies.migrated), 'git reset');
  ok(run('git', ['reset', '-q'], copies.migrated), 'git reset');

  // Undone: uninstall project on both copies, then git gives back the committed files the migration changed that
  // HEAD holds. No git clean: the CLAUDE.md the migration wrote must be gone by uninstall's record alone.
  for (const copy of Object.values(copies)) ok(harness(copy, 'uninstall', 'project', '--cwd', copy, '--home', layout.home), `uninstall project in ${copy}`);
  for (const file of changed) {
    if (run('git', ['cat-file', '-e', `HEAD:${file}`], copies.migrated).status === 0) ok(run('git', ['checkout', '--', file], copies.migrated), `git checkout ${file}`);
  }
  const settingsOf = (copy) => (fs.existsSync(path.join(copy, '.claude', 'settings.local.json')) ? fs.readFileSync(path.join(copy, '.claude', 'settings.local.json'), 'utf8') : '(none)');
  assert.deepEqual(projectBytes(copies.migrated), projectBytes(copies.left), `settings, left:\n${settingsOf(copies.left)}\nmigrated:\n${settingsOf(copies.migrated)}`);
});

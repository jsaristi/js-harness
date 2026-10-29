// The rehearsal's free part (F8 S13; the reverse-engineering document, 14.5): in a scratch home and a scratch project
// made for the test, this checkout's `install` and `init` run, a directive planted without a control makes `rules
// check` exit 1, doctor's claude-import row turns red with a CLAUDE.md planted above the project, and after `uninstall project` and `uninstall machine` every path either manifest recorded is gone or
// back to its bytes. It spends nothing and needs no network; the paid walk is scripts/rehearsal.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rehearsalLayout, rehearsalEnv, snapshotTree } from './rehearsal.mjs';
import { plantedRuleFiles, directiveProblem, recordedPaths, restoreProblems, importRowState } from './rehearsal-lib.mjs';

const JS_HARNESS = fileURLToPath(new URL('../bin/js-harness.mjs', import.meta.url));

// His own files in the scratch home before the walk: install grafts onto both, and uninstall must give back their bytes.
const HIS_SETTINGS = '{\n  "theme": "dark"\n}\n';
const HIS_CLAUDE_MD = '# Mine\n\nAnswer in Spanish.\n';

test('in a scratch home, a planted directive without a control makes rules check exit 1, and the uninstalls leave every recorded path as it was', (t) => {
  const layout = rehearsalLayout(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rehearsal-')));
  t.after(() => fs.rmSync(layout.root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(layout.home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(layout.home, '.claude', 'settings.json'), HIS_SETTINGS);
  fs.writeFileSync(path.join(layout.home, '.claude', 'CLAUDE.md'), HIS_CLAUDE_MD);
  fs.mkdirSync(layout.project, { recursive: true });
  fs.writeFileSync(path.join(layout.project, 'package.json'), '{ "name": "scratch", "private": true }\n');
  fs.writeFileSync(path.join(layout.project, 'index.js'), 'export const answer = 42;\n');

  const env = rehearsalEnv(layout, process.env);
  const run = (command, args) => spawnSync(command, args, { cwd: layout.project, env, encoding: 'utf8', timeout: 120_000 });
  const harness = (...args) => run(process.execPath, [JS_HARNESS, ...args]);
  const ok = (result, what) => assert.equal(result.status, 0, `${what} exited ${result.status}:\n${result.stdout}${result.stderr}`);
  ok(run('git', ['init', '-q']), 'git init');

  const before = snapshotTree(layout.root);
  ok(harness('install', '--home', layout.home), 'install');
  ok(harness('init', '--home', layout.home, '--cwd', layout.project, '--preset', 'lean'), 'init');
  ok(harness('rules', 'check'), 'rules check before the plant');

  const planted = plantedRuleFiles();
  for (const [file, text] of Object.entries(planted)) fs.writeFileSync(path.join(layout.project, file), text);
  const check = harness('rules', 'check');
  assert.equal(directiveProblem({ code: check.status, stdout: check.stdout }), null, `${check.stdout}${check.stderr}`);
  for (const file of Object.keys(planted)) fs.rmSync(path.join(layout.project, file));

  const importRow = () => importRowState(harness('doctor', '--home', layout.home, '--cwd', layout.project, '--offline', '--json').stdout);
  assert.equal(importRow(), 'ok');
  const above = path.join(layout.root, 'CLAUDE.md');
  fs.writeFileSync(above, '# planted above the project\n');
  assert.equal(importRow(), 'mismatch');
  fs.rmSync(above);

  const machineManifest = fs.readFileSync(path.join(layout.home, '.js-harness', 'manifest.json'), 'utf8');
  const projectManifest = fs.readFileSync(path.join(layout.project, '.git', 'js-harness', 'manifest.json'), 'utf8');
  const recorded = [...recordedPaths(machineManifest, layout.home), ...recordedPaths(projectManifest, layout.project)];
  assert.ok(recorded.length > 10, `the manifests record ${recorded.length} paths`);
  ok(harness('uninstall', 'project', '--cwd', layout.project, '--home', layout.home), 'uninstall project');
  ok(harness('uninstall', 'machine', '--home', layout.home), 'uninstall machine');
  assert.deepEqual(restoreProblems(before, snapshotTree(layout.root), recorded), []);
  assert.equal(fs.readFileSync(path.join(layout.home, '.claude', 'settings.json'), 'utf8'), HIS_SETTINGS);
  assert.equal(fs.readFileSync(path.join(layout.home, '.claude', 'CLAUDE.md'), 'utf8'), HIS_CLAUDE_MD);
});

test('rehearsalEnv puts the scratch home under every name a host reads it by and drops every login token', () => {
  const layout = rehearsalLayout(path.join(os.tmpdir(), 'r'));
  const his = { PATH: '/bin', JS_HARNESS_EVAL_OAUTH_TOKEN: 't', CLAUDE_CODE_OAUTH_TOKEN: 't', ANTHROPIC_API_KEY: 'k', CODEX_HOME: '/his/.codex', CLAUDE_CONFIG_DIR: '/his/.claude', GIT_DIR: '/his/.git', GIT_WORK_TREE: '/his', GIT_INDEX_FILE: '/his/.git/index' };
  const env = rehearsalEnv(layout, his);
  for (const name of ['HOME', 'USERPROFILE', 'JS_HARNESS_HOME']) assert.equal(env[name], layout.home);
  assert.equal(env.CODEX_HOME, path.join(layout.home, '.codex'));
  // Claude reads its config and .claude.json from HOME, where stack reads them back: no CLAUDE_CONFIG_DIR moves them.
  // git binds to the scratch project by its folder, never to a repository his variables name (Codex P2 on 541464c).
  for (const name of ['JS_HARNESS_EVAL_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'CLAUDE_CONFIG_DIR', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) assert.equal(env[name], undefined);
  assert.equal(env.PATH, '/bin');
});

test('snapshotTree hashes every file and marks every folder under a folder by its absolute path, and a missing folder is empty', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-snapshot-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
  fs.mkdirSync(path.join(root, 'empty'));
  fs.writeFileSync(path.join(root, 'a', 'b', 'c.txt'), 'x');
  fs.writeFileSync(path.join(root, 'd.txt'), 'x');
  const snapshot = snapshotTree(root);
  assert.deepEqual(Object.keys(snapshot).sort(), [path.join(root, 'a'), path.join(root, 'a', 'b'), path.join(root, 'a', 'b', 'c.txt'), path.join(root, 'd.txt'), path.join(root, 'empty')].sort());
  assert.equal(snapshot[path.join(root, 'd.txt')], snapshot[path.join(root, 'a', 'b', 'c.txt')]);
  // A recorded folder left behind is no longer invisible to restoreProblems (Codex P2 on 541464c).
  assert.equal(snapshot[path.join(root, 'empty')], 'folder');
  assert.deepEqual(snapshotTree(path.join(root, 'none')), {});
});

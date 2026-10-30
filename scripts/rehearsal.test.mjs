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
import { rehearsalLayout, rehearsalEnv, engramEnv, filledContract, snapshotTree, commandWords, scratchProcesses, openedBrowsers, hostLeftover, withoutPluginResidue, STEPS, HIS_SETTINGS, HIS_CLAUDE_MD } from './rehearsal.mjs';
import { plantedRuleFiles, directiveProblem, recordedPaths, restoreProblems, importRowState, REHEARSAL } from './rehearsal-lib.mjs';

const JS_HARNESS = fileURLToPath(new URL('../bin/js-harness.mjs', import.meta.url));

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

test('scratchProcesses names the topmost process of each tree whose command line holds the scratch root', () => {
  // Walk 1 left the scratch Codex CLI's login, and the browser it opened, alive after the walk ended (L5).
  const root = 'C:\\Users\\me\\AppData\\Local\\Temp\\js-harness-rehearsal-walk-abc';
  const processes = [
    { pid: 1, parent: 0, command: 'explorer.exe' },
    { pid: 10, parent: 1, command: `node ${root.toLowerCase()}\\prefix\\bin\\..\\codex.js mcp add context7` },
    { pid: 11, parent: 10, command: `${root}\\prefix\\codex.exe mcp add context7` },
    { pid: 12, parent: 11, command: 'brave.exe --single-argument https://clerk.context7.com/oauth/authorize' },
    { pid: 20, parent: 1, command: 'brave.exe' },
    { pid: 30, parent: 99, command: `engram serve --data ${root}\\home\\.engram` },
    { pid: 40, parent: 1, command: null },
  ];
  assert.deepEqual(scratchProcesses(processes, root, 'win32'), [{ pid: 10, command: processes[1].command }, { pid: 30, command: processes[5].command }]);
  assert.deepEqual(scratchProcesses(processes, root.toLowerCase(), 'linux'), [{ pid: 10, command: processes[1].command }]);
  assert.deepEqual(scratchProcesses([], root, 'win32'), []);
});

test('hostLeftover names an MCP server a host session left behind, and not the engram server the hook started', () => {
  // Walk 5 left codegraph's MCP server running after its Claude sessions ended.
  const root = 'C:\\Temp\\js-harness-rehearsal-walk-abc';
  assert.equal(hostLeftover({ command: `node ${root}\\prefix\\codegraph.js serve --mcp --path ${root}\\project` }), true);
  assert.equal(hostLeftover({ command: `${root}\\bin\\engram.exe mcp` }), true);
  assert.equal(hostLeftover({ command: `${root}\\bin\\engram.exe serve` }), false);
  assert.equal(hostLeftover({ command: null }), false);
});

test('openedBrowsers names a browser started under a scratch process, and none of his own', () => {
  // Nothing in a walk may open his browser again (L6): a step that does is stopped.
  const root = 'C:\\Temp\\js-harness-rehearsal-walk-abc';
  const processes = [
    { pid: 1, parent: 0, name: 'explorer.exe', command: 'explorer.exe' },
    { pid: 10, parent: 1, name: 'node.exe', command: `node ${root}\\prefix\\codex.js mcp add context7` },
    { pid: 11, parent: 10, name: 'codex.exe', command: 'codex.exe mcp add context7' },
    { pid: 12, parent: 11, name: 'brave.exe', command: '"C:\\Program Files\\Brave\\brave.exe" --single-argument https://x' },
    { pid: 13, parent: 12, name: 'brave.exe', command: 'brave.exe --type=renderer' },
    { pid: 20, parent: 1, name: 'msedge.exe', command: 'msedge.exe' },
    { pid: 30, parent: 10, name: 'node.exe', command: 'node child.js' },
  ];
  assert.deepEqual(openedBrowsers(processes, root, 'win32'), [{ pid: 12, command: processes[3].command }]);
  assert.deepEqual(openedBrowsers(processes.filter((p) => p.pid !== 12 && p.pid !== 13), root, 'win32'), []);
});

test('engramEnv gives engram a port and a data folder in the scratch home, and no URL', () => {
  // Engram's hook reads an ENGRAM_URL as an external server and starts none, so walk 3's start found no context.
  const layout = rehearsalLayout(path.join(os.tmpdir(), 'r'));
  assert.deepEqual(engramEnv(layout, 50123), { ENGRAM_PORT: '50123', ENGRAM_DATA_DIR: path.join(layout.home, '.engram') });
});

test('filledContract fills every placeholder of the contract template, so contract check passes it', (t) => {
  // Walk 5's feature step left the task's kind as the template has it, and contract check refused it.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const template = spawnSync(process.execPath, [JS_HARNESS, 'contract', 'template'], { encoding: 'utf8' }).stdout;
  fs.mkdirSync(path.join(root, 'odd', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'odd', 'tasks', 'greeting.md'), `# Greeting\n\n${filledContract(template)}`);
  const check = spawnSync(process.execPath, [JS_HARNESS, 'contract', 'check', 'odd/tasks/greeting.md'], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, `${check.stdout}${check.stderr}`);
});

test('withoutPluginResidue takes out only the empty plugin keys Claude\'s plugin commands leave, as Claude writes the file', () => {
  // Walk 8: after his engram steps' undo, Claude's settings.json kept `enabledPlugins: {}` and
  // `extraKnownMarketplaces: {}` beside his own lines; js-harness writes neither key in the home.
  const left = '{\n  "enabledPlugins": {},\n  "extraKnownMarketplaces": {},\n  "theme": "dark"\n}\n';
  assert.equal(withoutPluginResidue(left), HIS_SETTINGS);
  const kept = '{\n  "enabledPlugins": { "engram@engram": true },\n  "theme": "dark"\n}\n';
  assert.equal(withoutPluginResidue(kept), JSON.stringify(JSON.parse(kept), null, 2) + '\n');
  assert.equal(withoutPluginResidue('not json'), 'not json');
});

test('the walk has one step for each id of the rehearsal, and no other', () => {
  assert.deepEqual(Object.keys(STEPS).sort(), REHEARSAL.map(({ id }) => id).sort());
});

test('commandWords starts an .exe of the PATH folders by its path, a .cmd through cmd.exe, and anything else as it is', () => {
  const dirs = [path.join('C:', 'w', 'bin'), path.join('C:', 'w', 'prefix')];
  const there = new Set([path.join(dirs[0], 'git.exe'), path.join(dirs[1], 'codex.cmd'), path.join(dirs[1], 'git.cmd')]);
  const exists = (file) => there.has(file);
  const windows = { platform: 'win32', exists, comspec: 'C:\\Windows\\System32\\cmd.exe' };
  assert.deepEqual(commandWords(['git', 'status'], dirs, windows), [path.join(dirs[0], 'git.exe'), 'status']);
  // Node starts no .cmd by itself since its batch-file fix: the Codex CLI pnpm installs is one.
  assert.deepEqual(commandWords(['codex', 'mcp', 'remove', 'engram'], dirs, windows), ['C:\\Windows\\System32\\cmd.exe', '/d', '/c', path.join(dirs[1], 'codex.cmd'), 'mcp', 'remove', 'engram']);
  assert.deepEqual(commandWords(['nowhere', 'x'], dirs, windows), ['nowhere', 'x']);
  assert.deepEqual(commandWords([process.execPath, 'x'], dirs, windows), [process.execPath, 'x']);
  assert.deepEqual(commandWords(['codex', 'x'], dirs, { platform: 'linux', exists }), ['codex', 'x']);
});

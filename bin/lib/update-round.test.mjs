import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { planRound, readRound, renderRound, ROUND, runPhase, semverOf, SHIMS } from './update-round.mjs';

const NODE_DIR = 'C:\\nvm4w\\nodejs';
const NVM_ROOT = 'C:\\Users\\O\\AppData\\Local\\nvm';
const PNPM_BIN = 'C:\\Users\\O\\AppData\\Local\\pnpm\\bin';
const HARNESS = ['node', 'js-harness.mjs'];

/** What `readRound` returns for this machine on 2026-11-20, with `over` replacing tools by id. */
function machine(over = {}) {
  const at = {
    'claude-desktop': [null, null], 'claude-cli': ['2.1.329', '2.1.329'], engram: ['3.7.2', '3.7.2'], ctx7: ['0.12.2', '0.12.2'],
    typescript: ['6.0.2', '6.0.2'], codex: ['0.171.0', '0.171.0'], codegraph: ['1.6.4', '1.6.4'], 'typescript-language-server': ['5.1.3', '5.1.3'],
    npm: ['11.9.0', '11.9.0'], corepack: ['0.34.0', '0.34.0'], pnpm: ['12.21.0', '12.21.0'], gh: ['2.105.0', '2.105.0'], git: ['2.56.1', '2.56.1'],
    node: ['26.13.1', '26.13.1'], nvm: ['1.2.2', '1.2.2'], ...over,
  };
  const where = { ctx7: PNPM_BIN, codex: PNPM_BIN, pnpm: PNPM_BIN, codegraph: NODE_DIR, typescript: NODE_DIR, 'typescript-language-server': NODE_DIR, npm: NODE_DIR, corepack: NODE_DIR };
  return {
    nodeDir: NODE_DIR,
    nvmRoot: NVM_ROOT,
    npmCli: path.join(NODE_DIR, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    tools: ROUND.map(({ id }) => ({ id, installed: at[id][0], newest: at[id][1], newerMajor: at[id][2] ?? null, where: where[id] ? path.join(where[id], id) : null, why: null })),
  };
}
const plan = (over) => planRound(machine(over), { harness: HARNESS });

test('a stack at its newest versions plans no step, and says one line a tool', () => {
  const p = plan();
  assert.deepEqual([p.prepare.length, p.switch.length], [0, 0]);
  assert.equal(p.rows.length, ROUND.length);
  assert.deepEqual(p.rows.filter((r) => r.move === 'self').map((r) => r.tool), ['claude-desktop', 'claude-cli']);
  assert.equal(renderRound(p).length, ROUND.length + 2);
});

test('a package under pnpm moves with pnpm, one in the node folder with the real npm, never the npm wrapper', () => {
  const p = plan({ ctx7: ['0.12.2', '0.13.0'], codegraph: ['1.6.4', '1.7.0'] });
  const ctx7 = p.prepare.find((s) => s.tool === 'ctx7');
  assert.deepEqual(ctx7.words, ['pnpm', 'add', '-g', 'ctx7@0.13.0']);
  assert.deepEqual(ctx7.undo, ['pnpm', 'add', '-g', 'ctx7@0.12.2']);
  const codegraph = p.switch.find((s) => s.tool === 'codegraph');
  assert.deepEqual(codegraph.words, ['node', path.join(NODE_DIR, 'node_modules', 'npm', 'bin', 'npm-cli.js'), 'i', '-g', '--prefix', NODE_DIR, '@colbymchenry/codegraph@1.7.0']);
  assert.deepEqual(codegraph.check, { words: ['codegraph', '--version'], expect: '1.7.0' });
  assert.ok(![...p.prepare, ...p.switch].some((s) => s.words?.[0] === 'npm'), 'never the npm that runs pnpm');
  assert.ok(![...p.prepare, ...p.switch].some((s) => s.words?.includes('upgrade') && s.words[0] === 'codegraph'), 'never codegraph upgrade');
});

test('codegraph, codex and Git wait for the app closed; ctx7 and typescript do not', () => {
  const p = plan({ ctx7: ['0.12.2', '0.13.0'], typescript: ['6.0.2', '6.0.3'], codex: ['0.171.0', '0.172.0'], codegraph: ['1.6.4', '1.7.0'], git: ['2.56.1', '2.57.0'] });
  assert.deepEqual(p.prepare.map((s) => s.tool), ['ctx7', 'typescript']);
  assert.deepEqual(p.switch.map((s) => s.tool), ['codex', 'codegraph', 'git']);
  const git = p.switch.find((s) => s.tool === 'git');
  assert.equal(git.undo, null, 'winget has no exact downgrade: the way back is named');
  assert.match(git.wayBack, /winget install --id Git\.Git --exact --version 2\.56\.1 --force/);
  assert.equal(git.elevate, true);
});

test('node in its line is installed beside the live one with its globals and shims, compared, and switched last', () => {
  const p = plan({ node: ['26.13.1', '26.14.0'], codegraph: ['1.6.4', '1.7.0'], codex: ['0.171.0', '0.172.0'] });
  const kinds = p.prepare.filter((s) => s.tool === 'node').map((s) => s.kind);
  assert.deepEqual(kinds, ['run', 'run', 'run', 'run', 'run', 'run', 'copy', 'compare']);
  assert.deepEqual(p.prepare[0].words, ['nvm', 'install', '26.14.0']);
  const globals = p.prepare.filter((s) => s.what.includes("node 26.14.0's folder")).map((s) => s.words.at(-1));
  assert.deepEqual(globals.sort(), ['@colbymchenry/codegraph@1.7.0', 'corepack@0.34.0', 'npm@11.9.0', 'typescript-language-server@5.1.3', 'typescript@6.0.2']);
  assert.deepEqual(p.prepare.find((s) => s.kind === 'copy').files, SHIMS);
  assert.equal(p.rows.find((r) => r.tool === 'codegraph').move, 'prepare', 'it goes into the new folder');
  assert.deepEqual(p.switch.map((s) => s.tool), ['codex', 'node']);
  assert.deepEqual(p.switch.at(-1).undo, ['nvm', 'use', '26.13.1']);
});

test('a new node line and a new nvm are only reported, never moved', () => {
  const p = plan({ node: ['26.13.1', '26.13.1', '27.0.0'], nvm: ['1.2.2', '2.0.1'] });
  assert.deepEqual([p.prepare.length, p.switch.length], [0, 0]);
  assert.match(p.rows.find((r) => r.tool === 'node').why, /node 27\.0\.0 is out in a new line/);
  assert.equal(p.rows.find((r) => r.tool === 'nvm').move, 'report');
});

test('engram moves through stack upgrade, so uninstall machine keeps its record', () => {
  const step = plan({ engram: ['3.7.2', '3.8.0'] }).prepare[0];
  assert.deepEqual(step.words, [...HARNESS, 'stack', 'upgrade', '--tool', 'engram', '--tool', 'engram-plugin', '--yes']);
  assert.deepEqual(step.check, { words: ['engram', 'version'], expect: '3.8.0' });
});

test('after engram moves, the round takes its plugin\'s prompt hook out again (D8), checked by the hook-entries count', () => {
  const [upgrade, off] = plan({ engram: ['3.7.2', '3.8.0'] }).prepare;
  assert.ok(upgrade.words.includes('upgrade'), 'the update comes first');
  assert.deepEqual(off.words, [...HARNESS, 'stack', 'engram-prompt', 'off']);
  assert.deepEqual(off.check, { hookEntries: { owner: 'engram@engram', event: 'UserPromptSubmit' }, expect: 0 });
  assert.equal(off.undo, null, 'putting the hook back is no undo of a round');
  assert.match(off.wayBack, /stack engram-prompt on/);
  const other = planRound(machine({ engram: ['3.7.2', '3.8.0'] }), { harness: HARNESS, home: 'D:\\scratch' }).prepare[1];
  assert.deepEqual(other.words.slice(-2), ['--home', 'D:\\scratch'], 'a round run on another home takes it out there');
  assert.equal(plan().prepare.some((s) => s.words?.includes('engram-prompt')), false, 'no engram update, no step');
});

test('the hook-entries check passes at no entry, fails while the hook is back, and fails when it cannot count', () => {
  const [, off] = plan({ engram: ['3.7.2', '3.8.0'] }).prepare;
  assert.deepEqual(runPhase([off], { ...io(), hookEntries: () => 0 }).steps.map((s) => [s.outcome, s.saw]), [['done', '0 entries']]);
  const back = runPhase([off], { ...io(), hookEntries: (owner, event) => (owner === 'engram@engram' && event === 'UserPromptSubmit' ? 1 : 0) });
  assert.deepEqual([back.ok, back.steps[0].outcome, back.steps[0].saw], [false, 'failed', '1 entry']);
  assert.equal(runPhase([off], io()).steps[0].outcome, 'failed', 'no count is no pass');
});

test('a tool whose version or newest could not be read is unknown, never moved', () => {
  const p = plan({ gh: [null, '2.106.0'], ctx7: ['0.12.2', null] });
  assert.deepEqual(p.rows.filter((r) => r.move === 'unknown').map((r) => r.tool), ['ctx7', 'gh']);
});

/** The seams of `runPhase`, recording each command run. */
function io({ versions = {}, failRun = [] } = {}) {
  const ran = [];
  return {
    ran,
    run: (command, args) => {
      ran.push([command, ...args].join(' '));
      if (args[0] === '--version' || args[0] === 'version') return { status: 0, stdout: versions[command] ?? '0.0.0' };
      return { status: failRun.includes(command) ? 1 : 0, stdout: '' };
    },
    readFile: () => { throw new Error('none'); },
    exists: () => true,
    copy: () => {},
    list: () => [],
    log: () => {},
  };
}

test('a step whose check fails is undone, and the steps after it are not run', () => {
  const p = plan({ codex: ['0.171.0', '0.172.0'], codegraph: ['1.6.4', '1.7.0'] });
  const seams = io({ versions: { codex: 'codex-cli 0.171.0' } });
  const result = runPhase(p.switch, seams);
  assert.equal(result.ok, false);
  assert.deepEqual(result.steps.map((s) => s.outcome), ['undone', 'not run']);
  assert.ok(seams.ran.includes('pnpm add -g @openai/codex@0.171.0'), 'its undo ran');
  assert.ok(!seams.ran.some((line) => line.includes('codegraph@')), 'the next step did not run');
});

test('a step that passes its check is done; a step with no undo that fails is failed, with its way back', () => {
  const p = plan({ git: ['2.56.1', '2.57.0'] });
  assert.deepEqual(runPhase(p.switch, io({ versions: { git: 'git version 2.57.0.windows.1' } })).steps.map((s) => s.outcome), ['done']);
  assert.deepEqual(runPhase(p.switch, io({ failRun: ['winget'] })).steps.map((s) => s.outcome), ['failed']);
});

test('the compare step fails on a name the old node folder has and the new one lacks', () => {
  const step = { tool: 'node', what: 'compare', kind: 'compare', from: 'A', to: 'B', check: null, undo: null };
  const seams = { ...io(), list: (dir) => (dir.startsWith('A') ? ['codegraph.cmd', 'node.exe'] : ['node.exe']) };
  const result = runPhase([step], seams);
  assert.equal(result.steps[0].outcome, 'failed');
  assert.match(result.steps[0].saw, /lacks codegraph\.cmd/);
});

test('node behind with no nvm root read is unknown, and the plan does not throw', () => {
  const p = planRound({ ...machine({ node: ['26.13.1', '26.14.0'] }), nvmRoot: null }, { harness: HARNESS });
  assert.deepEqual(p.rows.find((r) => r.tool === 'node').move, 'unknown');
  assert.equal(p.prepare.some((s) => s.tool === 'node'), false);
});

test('steps and undos run as steps; checks, the undo\'s check included, run as reads', () => {
  const calls = [];
  const p = plan({ codex: ['0.171.0', '0.172.0'] });
  runPhase(p.switch, { ...io(), run: (command, args, options) => {
    calls.push([command, options?.step === true]);
    return { status: 0, stdout: command === 'codex' ? 'codex-cli 0.171.0' : '' };
  } });
  assert.deepEqual(calls, [['pnpm', true], ['codex', false], ['pnpm', true], ['codex', false]]);
});

test('readRound reads only: version commands, where, nvm root and the registries', async () => {
  const ran = [];
  const run = (command, args) => {
    ran.push([command, ...args].join(' '));
    if (command === 'where') return { status: 0, stdout: `${args[0] === 'node' ? NODE_DIR : PNPM_BIN}\\${args[0]}\r\n` };
    if (command === 'nvm' && args[0] === 'root') return { status: 0, stdout: `\nCurrent Root: ${NVM_ROOT}\n` };
    return { status: 0, stdout: 'v26.13.1' };
  };
  const fetchJson = async (url) => (url.includes('nodejs.org') ? [{ version: 'v27.1.0' }, { version: 'v26.14.0' }, { version: 'v26.13.1' }] : { version: '9.9.9', tag_name: 'v9.9.9' });
  const read = await readRound({ run, fetchJson, readFile: () => '{"version":"11.9.0"}' });
  assert.equal(read.nvmRoot, NVM_ROOT);
  const node = read.tools.find((t) => t.id === 'node');
  assert.deepEqual([node.installed, node.newest, node.newerMajor], ['26.13.1', '26.14.0', '27.1.0']);
  assert.ok(ran.every((line) => /^(where \S+|nvm root|\S+ (--version|version))$/.test(line)), ran.join('\n'));
});

test('semverOf reads the versions each tool prints', () => {
  assert.equal(semverOf('git version 2.56.1.windows.1'), '2.56.1');
  assert.equal(semverOf('codex-cli 0.171.0'), '0.171.0');
  assert.equal(semverOf('nothing'), null);
});

test('the compare removes corepack\'s pnpm, pnpx, yarn and yarnpkg shims the new folder has and the old one lacks (B1)', () => {
  const step = { tool: 'node', what: 'compare', kind: 'compare', from: 'A', to: 'B', check: null, undo: null };
  const removed = [];
  const extra = ['pnpm', 'pnpm.cmd', 'pnpm.ps1', 'pnpx', 'pnpx.CMD', 'yarn', 'yarn.cmd', 'yarnpkg.ps1'];
  const seams = {
    ...io(), list: (dir) => (dir === 'A' ? ['Node.exe', 'npm.cmd'] : dir === 'B' ? ['node.exe', 'npm.cmd', ...extra] : []),
    remove: (file) => removed.push(file), exists: (file) => !removed.includes(file),
  };
  const result = runPhase([step], seams);
  assert.equal(result.steps[0].outcome, 'done');
  assert.deepEqual(removed, extra.map((name) => path.join('B', name)));
  assert.match(result.steps[0].saw, /removed .*pnpm\.cmd.*which would shadow pnpm/);
});

test('the compare refuses any other name the new folder has and the old one lacks, and removes nothing else', () => {
  const step = { tool: 'node', what: 'compare', kind: 'compare', from: 'A', to: 'B', check: null, undo: null };
  const removed = [];
  const seams = { ...io(), list: (dir) => (dir === 'A' ? ['node.exe'] : dir === 'B' ? ['node.exe', 'evil.cmd'] : []), remove: (file) => removed.push(file) };
  const result = runPhase([step], seams);
  assert.equal(result.steps[0].outcome, 'failed');
  assert.match(result.steps[0].saw, /has evil\.cmd, which the old folder lacks/);
  assert.deepEqual(removed, []);
});

const nodeMove = () => plan({ node: ['26.13.1', '26.14.0'], codegraph: ['1.6.4', '1.7.0'] });

test('after nvm use the switch checks node, codegraph, js-harness and that pnpm is not shadowed, and undoes on any of them (B2)', () => {
  const p = planRound(machine({ node: ['26.13.1', '26.14.0'], codegraph: ['1.6.4', '1.7.0'] }), { harness: HARNESS, harnessVersion: '0.97.0' });
  const swap = p.switch.at(-1);
  const words = swap.check.all.map((c) => c.words.join(' '));
  assert.ok(words.includes('node --version') && words.includes('codegraph --version') && words.includes('js-harness --version') && words.includes('where pnpm'), words.join('; '));
  assert.equal(swap.check.all.find((c) => c.words[0] === 'codegraph').expect, '1.7.0');
  assert.equal(swap.check.all.find((c) => c.words[0] === 'js-harness').expect, '0.97.0');
  for (const broken of ['codegraph', 'js-harness', 'where']) {
    let active = '26.13.1';
    const seams = { ...io(), run: (command, args) => {
      if (command === 'nvm') active = args[1];
      if (command === 'node') return { status: 0, stdout: `v${active}` };
      if (command === 'codegraph') return { status: 0, stdout: broken === 'codegraph' ? '1.6.4' : '1.7.0' };
      if (command === 'js-harness') return broken === 'js-harness' ? { status: 1, stdout: '' } : { status: 0, stdout: '0.97.0' };
      if (command === 'where') return { status: 0, stdout: broken === 'where' ? `${NODE_DIR}\pnpm.cmd\r\n${PNPM_BIN}\pnpm.cmd` : `${PNPM_BIN}\pnpm.cmd` };
      return { status: 0, stdout: '' };
    } };
    const result = runPhase([swap], seams);
    assert.deepEqual([broken, result.steps[0].outcome], [broken, 'undone']);
    assert.equal(active, '26.13.1', 'nvm use went back');
  }
});

test('an undo that exits 0 but leaves the old node inactive is failed, not undone (S1)', () => {
  const swap = nodeMove().switch.at(-1);
  assert.deepEqual(swap.undoCheck, { words: ['node', '--version'], expect: '26.13.1' });
  const seams = { ...io(), run: (command) => (command === 'node' ? { status: 0, stdout: 'v26.14.0' } : { status: 0, stdout: '' }) };
  const result = runPhase([swap], seams);
  assert.equal(result.steps[0].outcome, 'failed');
  const logged = [];
  runPhase([swap], { ...seams, log: (line) => logged.push(line) });
  assert.match(logged.join('\n'), /undo .* ran, but node --version says 26\.14\.0/);
});

test('a package step\'s undo is checked by its version too', () => {
  const step = plan({ codex: ['0.171.0', '0.172.0'] }).switch[0];
  assert.deepEqual(step.undoCheck, { words: ['codex', '--version'], expect: '0.171.0' });
});

test('a step that times out runs no undo beside it, and says it may still run (S2)', () => {
  const step = plan({ codex: ['0.171.0', '0.172.0'] }).switch[0];
  const seams = io();
  seams.run = (command, args) => {
    seams.ran.push([command, ...args].join(' '));
    return { status: null, error: Object.assign(new Error('spawnSync cmd.exe ETIMEDOUT'), { code: 'ETIMEDOUT' }) };
  };
  const result = runPhase([step], seams);
  assert.equal(result.steps[0].outcome, 'timed out');
  assert.match(result.steps[0].saw, /may still run/);
  assert.equal(seams.ran.length, 1, 'no undo ran');
});

test('an exception in a step or its check is a failed step in the result, never thrown (S3)', () => {
  const compare = { tool: 'node', what: 'compare', kind: 'compare', from: 'A', to: 'B', check: null, undo: null };
  const result = runPhase([compare, compare], { ...io(), list: () => { throw new Error('EPERM: operation not permitted'); } });
  assert.deepEqual(result.steps.map((s) => s.outcome), ['failed', 'not run']);
  assert.match(result.steps[0].saw, /threw: EPERM/);
  const [, off] = plan({ engram: ['3.7.2', '3.8.0'] }).prepare;
  const hooks = runPhase([off], { ...io(), hookEntries: () => { throw new Error('bad settings'); } });
  assert.match(hooks.steps[0].saw, /threw: bad settings/);
});

test('each step tells its progress before it runs and the phase tells its end', () => {
  const p = plan({ codex: ['0.171.0', '0.172.0'], git: ['2.56.1', '2.57.0'] });
  const told = [];
  runPhase(p.switch, { ...io({ versions: { codex: '0.172.0', git: '2.57.0' } }), onStep: (done, running) => told.push([done.length, running]) });
  assert.deepEqual(told, [[0, p.switch[0].what], [1, p.switch[1].what], [2, null]]);
});

test('the node switch carries what must still hold when the switch runs: the active node and the new folder (S4)', () => {
  const swap = nodeMove().switch.at(-1);
  assert.deepEqual(swap.pre, [{ words: ['node', '--version'], expect: '26.13.1' }, { exists: path.join(NVM_ROOT, 'v26.14.0', 'node.exe') }]);
});

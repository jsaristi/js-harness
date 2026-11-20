import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stackRoundMain } from './stack-round.mjs';
import { ROUND } from './lib/update-round.mjs';

/** A scratch harness home outside the worktree, removed after the test. */
function scratch(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-round-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

/** A machine read where codex (under pnpm) and Git are behind, so the switch has a package step and an elevated one. */
const READ = async () => ({
  nodeDir: 'C:\\nvm4w\\nodejs', nvmRoot: 'C:\\nvm', npmCli: 'C:\\nvm4w\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
  tools: ROUND.map(({ id }) => ({
    id, why: null, newerMajor: null,
    installed: { codex: '0.171.0', git: '2.56.1' }[id] ?? '1.0.0',
    newest: { codex: '0.172.0', git: '2.57.0' }[id] ?? '1.0.0',
    where: id === 'codex' ? 'C:\\Users\\O\\AppData\\Local\\pnpm\\bin\\codex' : null,
  })),
});

function deps(over = {}) {
  const ran = [];
  const lines = [];
  return {
    ran, lines,
    deps: {
      read: READ, harness: ['node', 'js-harness.mjs'], log: (l) => lines.push(l), error: (l) => lines.push(l),
      run: (command, args) => {
        ran.push([command, ...args].join(' '));
        return { status: 0, stdout: { codex: 'codex-cli 0.172.0', git: 'git version 2.57.0.windows.1' }[command] ?? '' };
      },
      processNames: () => ['explorer.exe'], elevated: () => true, relaunch: () => { throw new Error('no relaunch'); },
      ask: null, now: () => new Date('2026-11-20T21:00:00Z'), ...over,
    },
  };
}
const roundDirOf = (home) => path.join(home, '.js-harness', 'update-round');

test('the dry run prints one line a tool and runs and writes nothing', async (t) => {
  const home = scratch(t);
  const d = deps();
  assert.equal(await stackRoundMain(['--round', '--dry-run', '--home', home], {}, d.deps), 0);
  assert.deepEqual(d.ran, [], 'no command ran: the read is the seam');
  for (const { id } of ROUND) assert.ok(d.lines.some((l) => l.startsWith(`${id} `)), id);
  assert.deepEqual(fs.readdirSync(home), []);
});

test('the switch refuses while a Claude process runs, and runs nothing', async (t) => {
  const home = scratch(t);
  const d = deps({ processNames: () => ['claude.exe', 'explorer.exe'] });
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /claude\.exe runs; close Claude Desktop/);
  assert.deepEqual(d.ran, []);
});

test('the switch without a prepared plan refuses', async (t) => {
  const home = scratch(t);
  const d = deps();
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /no prepared plan/);
});

test('prepare writes the plan before any step; the switch runs it, checks it and records it', async (t) => {
  const home = scratch(t);
  const d = deps();
  assert.equal(await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps), 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'plan.json'), 'utf8')).switch.length, 2);
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 0);
  const last = JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'last.json'), 'utf8'));
  assert.deepEqual([last.phase, last.ok, last.steps.map((s) => s.outcome)], ['switch', true, ['done', 'done']]);
  assert.ok(fs.existsSync(last.log));
});

test('a failed check in the switch undoes that step and records it', async (t) => {
  const home = scratch(t);
  const d = deps();
  await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps);
  d.deps.run = (command, args) => {
    d.ran.push([command, ...args].join(' '));
    return { status: 0, stdout: command === 'codex' ? 'codex-cli 0.171.0' : '' };
  };
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.ok(d.ran.includes('pnpm add -g @openai/codex@0.171.0'), 'the undo ran');
  const last = JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'last.json'), 'utf8'));
  assert.deepEqual(last.steps.map((s) => s.outcome), ['undone', 'not run']);
});

test('an elevated step not elevated starts the switch elevated once, and runs no step itself', async (t) => {
  const home = scratch(t);
  const d = deps();
  await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps);
  const before = d.ran.length;
  let relaunched = 0;
  Object.assign(d.deps, { elevated: () => false, relaunch: () => { relaunched += 1; } });
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.equal(relaunched, 1);
  assert.equal(d.ran.length, before, 'no step ran outside the elevated run');
  assert.match(d.lines.join('\n'), /left no record/);
});

test('without --yes and with no terminal nothing runs', async (t) => {
  const home = scratch(t);
  const d = deps();
  assert.equal(await stackRoundMain(['--round', '--prepare', '--home', home], {}, d.deps), 1);
  assert.deepEqual(fs.readdirSync(home), []);
});

test('one phase is named, or it is a usage error', async () => {
  const d = deps();
  assert.equal(await stackRoundMain(['--round'], {}, d.deps), 2);
  assert.equal(await stackRoundMain(['--round', '--dry-run', '--switch'], {}, d.deps), 2);
});

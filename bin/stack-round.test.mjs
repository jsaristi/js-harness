import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { elevatedCommand, stackRoundMain } from './stack-round.mjs';
import { nodeSteps, PLAN_MAX_AGE_MS, ROUND, SHIMS } from './lib/update-round.mjs';

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

test('the switch refuses a plan whose prepare stopped at a failed check, and runs nothing', async (t) => {
  const home = scratch(t);
  const d = deps({ read: ENGRAM_BEHIND });
  d.deps.run = (command, args) => {
    d.ran.push([command, ...args].join(' '));
    return { status: 0, stdout: '' }; // engram never reaches 3.8.0, so prepare stops
  };
  assert.equal(await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps), 1);
  const before = d.ran.length;
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /prepare of this plan did not check every step/);
  assert.equal(d.ran.length, before, 'no switch step ran');
});

test('a relaunch that writes no new record is not read as the earlier record', async (t) => {
  const home = scratch(t);
  const d = deps();
  await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps);
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 0, 'an earlier switch left its record');
  const planFile = path.join(roundDirOf(home), 'plan.json');
  const { used, ...unused } = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  fs.writeFileSync(planFile, JSON.stringify(unused)); // the same plan again, so only the record is in question
  Object.assign(d.deps, { elevated: () => false, relaunch: () => {} });
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /left no record/);
});

test('--json goes with the dry run only', async () => {
  const d = deps();
  assert.equal(await stackRoundMain(['--round', '--prepare', '--json'], {}, d.deps), 2);
  assert.equal(await stackRoundMain(['--round', '--switch', '--json'], {}, d.deps), 2);
});

test('the elevated relaunch passes a path with a space as one argument', () => {
  const command = elevatedCommand('C:\\Program Files\\nodejs\\node.exe', ['C:\\My Tools\\js-harness.mjs', '--home', "C:\\Users\\O'Brien"]);
  assert.equal(command, "Start-Process -FilePath 'C:\\Program Files\\nodejs\\node.exe' -ArgumentList '\"C:\\My Tools\\js-harness.mjs\" --home \"C:\\Users\\O''Brien\"' -Verb RunAs -Wait");
});

/** A scratch home where the engram plugin is enabled and its hooks file holds `events`, as Claude Code reads them. */
function engramHooks(home, events) {
  const plugin = path.join(home, 'plugins', 'engram');
  fs.mkdirSync(path.join(plugin, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'engram@engram': true } }));
  fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { 'engram@engram': [{ scope: 'user', installPath: plugin }] } }));
  const hooks = Object.fromEntries(events.map((event) => [event, [{ hooks: [{ type: 'command', command: `engram hook ${event}` }] }]]));
  fs.writeFileSync(path.join(plugin, 'hooks', 'hooks.json'), JSON.stringify({ hooks }));
}

/** READ with engram behind, so prepare updates it and re-applies D8. */
const ENGRAM_BEHIND = async () => {
  const read = await READ();
  return { ...read, tools: read.tools.map((t) => (t.id === 'engram' ? { ...t, installed: '3.7.2', newest: '3.8.0' } : t)) };
};

/** deps whose fake commands say engram is at 3.8.0 once updated. */
function engramDeps() {
  const d = deps({ read: ENGRAM_BEHIND });
  d.deps.run = (command, args) => {
    d.ran.push([command, ...args].join(' '));
    return { status: 0, stdout: command === 'engram' ? 'engram 3.8.0' : '' };
  };
  return d;
}

test('prepare re-applies engram-prompt off after the engram update, and stops while the hook entries still count one', async (t) => {
  const home = scratch(t);
  engramHooks(home, ['SessionStart', 'UserPromptSubmit']);
  const d = engramDeps();
  assert.equal(await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps), 1, 'the fake off left the hook there');
  const upgrade = d.ran.findIndex((line) => line.includes('stack upgrade --tool engram'));
  const off = d.ran.indexOf(`node js-harness.mjs stack engram-prompt off --home ${home}`);
  assert.ok(upgrade !== -1 && off > upgrade, d.ran.join('\n'));
  const last = JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'last.json'), 'utf8'));
  assert.deepEqual(last.steps.slice(0, 2).map((s) => [s.outcome, s.saw]), [['done', '3.8.0'], ['failed', '1 entry']]);
});

test('prepare passes the hook-entries check once the hook is out', async (t) => {
  const home = scratch(t);
  engramHooks(home, ['SessionStart']);
  const d = engramDeps();
  assert.equal(await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps), 0);
  const last = JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'last.json'), 'utf8'));
  assert.deepEqual(last.steps.map((s) => s.outcome), ['done', 'done']);
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

/** A machine read where node moves from 26.13.1 to 26.14.0 under the scratch nvm root `nvm`; the old folder holds node,
 * the nine shims and npm and corepack in node_modules. */
function nodeMachine(nvm) {
  const old = path.join(nvm, 'v26.13.1');
  fs.mkdirSync(path.join(old, 'node_modules', 'npm'), { recursive: true });
  fs.mkdirSync(path.join(old, 'node_modules', 'corepack'), { recursive: true });
  for (const file of ['node.exe', ...SHIMS]) fs.writeFileSync(path.join(old, file), '');
  return async () => {
    const read = await READ();
    return { ...read, nvmRoot: nvm, nodeDir: old, tools: read.tools.map((t) => (t.id === 'node' ? { ...t, installed: '26.13.1', newest: '26.14.0' } : t)) };
  };
}

/** Fake commands for node's prepare: nvm install makes the new folder, npm i -g writes the package, and corepack's
 * install writes its pnpm, pnpx, yarn and yarnpkg shims, as npm does on this machine; `extra` names more files it writes. */
function nodeRun(d, nvm, extra = []) {
  const folder = path.join(nvm, 'v26.14.0');
  return (command, args) => {
    d.ran.push([command, ...args].join(' '));
    if (command === 'nvm' && args[0] === 'install') {
      fs.mkdirSync(path.join(folder, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(folder, 'node.exe'), '');
    } else if (command.endsWith('node.exe')) {
      const [, spec, version] = /^(.+)@([^@]+)$/.exec(args.at(-1));
      fs.mkdirSync(path.join(folder, 'node_modules', spec), { recursive: true });
      fs.writeFileSync(path.join(folder, 'node_modules', spec, 'package.json'), JSON.stringify({ version }));
      const shims = ['pnpm', 'pnpx', 'yarn', 'yarnpkg'].flatMap((n) => [n, `${n}.cmd`, `${n}.ps1`]);
      if (spec === 'corepack') for (const name of [...shims, ...extra]) fs.writeFileSync(path.join(folder, name), '');
    }
    return { status: 0, stdout: '' };
  };
}

test('prepare removes the corepack shims a new node folder gets, so none shadows pnpm (B1)', async (t) => {
  const home = scratch(t);
  const nvm = path.join(home, 'nvm');
  const d = deps({ read: nodeMachine(nvm) });
  d.deps.run = nodeRun(d, nvm);
  assert.equal(await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps), 0, d.lines.join('\n'));
  assert.deepEqual(fs.readdirSync(path.join(nvm, 'v26.14.0')).filter((name) => /^(pnpm|pnpx|yarn)/i.test(name)), []);
  assert.match(d.lines.join('\n'), /removed corepack's pnpm/);
});

test('prepare refuses a new node folder with any other name the old one lacks, and leaves the plan unprepared (B1)', async (t) => {
  const home = scratch(t);
  const nvm = path.join(home, 'nvm');
  const d = deps({ read: nodeMachine(nvm) });
  d.deps.run = nodeRun(d, nvm, ['evil.cmd']);
  assert.equal(await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps), 1);
  const last = JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'last.json'), 'utf8'));
  assert.match(last.steps.find((s) => s.outcome === 'failed').saw, /has evil\.cmd, which the old folder lacks/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'plan.json'), 'utf8')).prepared, false);
});

test('the record and the log are written before the first step and after each one (S2)', async (t) => {
  const home = scratch(t);
  const d = deps();
  await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps);
  const seen = [];
  const run = d.deps.run;
  d.deps.run = (command, args, options) => {
    if (options?.step) {
      const last = JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'last.json'), 'utf8'));
      seen.push([last.phase, last.ok, last.running, last.steps.length, fs.readFileSync(last.log, 'utf8').includes(last.running)]);
    }
    return run(command, args, options);
  };
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 0);
  assert.deepEqual(seen, [['switch', null, 'update @openai/codex to 0.172.0', 0, true], ['switch', null, 'upgrade Git.Git to 2.57.0', 1, true]]);
  const records = fs.readdirSync(roundDirOf(home)).filter((name) => /^round-.*\.json$/.test(name));
  assert.equal(records.length, 2, 'each run keeps its own record beside last.json');
});

test('an exception in a step is recorded as its failure, never thrown past the record (S3)', async (t) => {
  const home = scratch(t);
  const d = engramDeps();
  d.deps.hookEntries = () => { throw new Error('EPERM reading settings'); };
  assert.equal(await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps), 1);
  const last = JSON.parse(fs.readFileSync(path.join(roundDirOf(home), 'last.json'), 'utf8'));
  assert.deepEqual([last.ok, last.steps[1].outcome], [false, 'failed']);
  assert.match(last.steps[1].saw, /threw: EPERM/);
});

test('an elevated run that stopped mid-way is read from its partial record, not called no record (S2)', async (t) => {
  const home = scratch(t);
  const d = deps();
  await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps);
  const partial = { phase: 'switch', at: '2026-11-20T21:00:01.000Z', ok: null, running: 'upgrade Git.Git to 2.57.0', steps: [{ what: 'update @openai/codex to 0.172.0', outcome: 'done' }], log: 'L' };
  Object.assign(d.deps, { elevated: () => false, relaunch: () => fs.writeFileSync(path.join(roundDirOf(home), 'last.json'), JSON.stringify(partial)) });
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /stopped before it finished, while upgrade Git\.Git to 2\.57\.0 ran/);
});

test('a switch uses its plan up: a second switch on it refuses (S4)', async (t) => {
  const home = scratch(t);
  const d = deps();
  await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps);
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 0);
  const before = d.ran.length;
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /this plan was used by the switch at 2026-11-20T21:00:00\.000Z/);
  assert.equal(d.ran.length, before);
});

test('the switch refuses a plan older than its age limit (S4)', async (t) => {
  const home = scratch(t);
  const d = deps();
  await stackRoundMain(['--round', '--prepare', '--yes', '--home', home], {}, d.deps);
  const later = Date.parse('2026-11-20T21:00:00Z') + PLAN_MAX_AGE_MS + 1;
  d.deps.now = () => new Date(later);
  const before = d.ran.length;
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /prepared at 2026-11-20T21:00:00\.000Z, more than 2 days ago/);
  assert.equal(d.ran.length, before);
});

test('the switch refuses when the active node is no longer the plan\'s, or the new folder is gone (S4)', async (t) => {
  const home = scratch(t);
  const nvm = path.join(home, 'nvm');
  const steps = nodeSteps({ from: '26.13.1', to: '26.14.0', nvmRoot: nvm, nodeDir: 'C:\\nvm4w\\nodejs', packages: [] });
  fs.mkdirSync(roundDirOf(home), { recursive: true });
  const planned = { at: '2026-11-20T21:00:00.000Z', rows: [], prepare: steps.prepare, switch: steps.switch, prepared: true };
  fs.writeFileSync(path.join(roundDirOf(home), 'plan.json'), JSON.stringify(planned));
  const d = deps();
  d.deps.run = (command, args) => {
    d.ran.push([command, ...args].join(' '));
    return { status: 0, stdout: command === 'node' ? 'v26.12.0' : '' };
  };
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /no longer fits this machine: node --version says 26\.12\.0/);
  d.deps.run = (command, args) => {
    d.ran.push([command, ...args].join(' '));
    return { status: 0, stdout: command === 'node' ? 'v26.13.1' : '' };
  };
  assert.equal(await stackRoundMain(['--round', '--switch', '--yes', '--home', home], {}, d.deps), 1);
  assert.match(d.lines.join('\n'), /node\.exe says missing/);
  assert.ok(!d.ran.some((line) => line.startsWith('nvm')), 'nvm never ran');
});

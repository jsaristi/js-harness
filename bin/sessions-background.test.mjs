import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sessionsMain } from './sessions.mjs';
import { sessionsStartMain } from './sessions-background.mjs';
import { projectSlug } from './lib/sessions.mjs';

// `js-harness sessions start` and `stop`, the board's background sessions and the machine uninstall, through the public
// command line, against a fake `claude` on PATH (odd/tasks/background-sessions.md). The fake keeps its sessions in a
// JSON file the test reads and writes, and logs every call it gets, so no test starts a real session.

const BIN = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));
const RULES_DATA = fileURLToPath(new URL('./lib/rules-data.mjs', import.meta.url));

const FAKE = String.raw`
import fs from 'node:fs';
import path from 'node:path';
const file = process.env.FAKE_CLAUDE_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const argv = process.argv.slice(2);
state.calls.push(argv);
const save = () => fs.writeFileSync(file, JSON.stringify(state, null, 2));
const out = (text) => process.stdout.write(text + '\n');
const err = (text) => process.stderr.write(text + '\n');
const lost = (id) => { out("No job matching '" + id + "'. Run 'claude agents' to list running sessions."); save(); process.exit(1); };
if (argv.includes('--bg')) {
  if (state.refuseStart) { err(state.refuseStart); save(); process.exit(1); }
  if (state.agentsFailAfterStart) state.agentsFail = state.agentsFailAfterStart;
  if (state.breakRecord) {
    // The record turns into a folder while claude runs: it was a file when start opened it, and no line goes in now.
    const record = path.join(process.env.JS_HARNESS_HOME, '.js-harness', 'background', 'sessions.jsonl');
    if (fs.existsSync(record)) fs.renameSync(record, record + '.held');
    fs.mkdirSync(record, { recursive: true });
  }
  const name = argv[argv.indexOf('-n') + 1];
  const id = state.nextId;
  let cwd = process.cwd();
  let worktree;
  if (argv.includes('-w')) {
    worktree = path.join(cwd, '.claude', 'worktrees', argv[argv.indexOf('-w') + 1]);
    fs.mkdirSync(worktree, { recursive: true });
    // claude lists a session it just started in the folder it was started from, and in its worktree only later.
    if (!state.rootCwd) cwd = worktree;
  }
  if (state.sibling) state.agents.push({ ...state.sibling, kind: 'background', startedAt: state.now, name, status: 'busy' });
  if (!state.ghost) state.agents.push({ pid: 4242, id, cwd, worktree, kind: 'background', startedAt: state.now, sessionId: id + '-0000-4000-8000-000000000000', name, status: 'busy', state: 'working' });
  save();
  out(state.quiet ? 'started' : 'backgrounded · ' + id + ' · ' + name);
  out('  claude agents             list sessions');
  err('Starting background service…');
  process.exit(0);
}
if (argv[0] === 'agents') {
  if (state.agentsFail) { err(state.agentsFail); save(); process.exit(1); }
  save();
  out(JSON.stringify(state.agents, null, 2));
  process.exit(0);
}
const agent = state.agents.find((item) => item.id === argv[1]);
if (argv[0] === 'stop') {
  if (!agent) lost(argv[1]);
  delete agent.pid;
  agent.status = 'idle';
  agent.state = 'stopped';
  save();
  out('stopped ' + argv[1]);
  process.exit(0);
}
if (argv[0] === 'rm') {
  if (state.refuseRm) { out(state.refuseRm); save(); process.exit(1); }
  if (!agent) lost(argv[1]);
  state.agents = state.agents.filter((item) => item !== agent);
  // claude rm keeps a worktree that holds uncommitted changes (odd/tasks/background-sessions.md, L10).
  if (!state.keepWorktree && agent.worktree) fs.rmSync(agent.worktree, { recursive: true, force: true });
  save();
  out('removed ' + argv[1]);
  process.exit(0);
}
err('fake claude: unexpected ' + argv.join(' '));
save();
process.exit(3);
`;

/** A temp machine: a harness home, a git repository to start sessions in, a brief, and a fake `claude` on PATH. */
function makeWorld({ rules = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-bg-'));
  const world = { dir, home: path.join(dir, 'home'), project: path.join(dir, 'proj'), shim: path.join(dir, 'shim'), state: path.join(dir, 'claude-state.json') };
  for (const folder of [world.home, world.project, world.shim]) fs.mkdirSync(folder, { recursive: true });
  const git = (...args) => assert.equal(spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: world.project, encoding: 'utf8' }).status, 0);
  git('init', '-q', '-b', 'main');
  if (rules) {
    fs.mkdirSync(path.join(world.project, 'bin', 'lib'), { recursive: true });
    fs.copyFileSync(RULES_DATA, path.join(world.project, 'bin', 'lib', 'rules-data.mjs'));
    fs.writeFileSync(path.join(world.project, 'harness.json'), JSON.stringify({ code: 'JH' }));
  }
  git('commit', '-q', '--allow-empty', '-m', 'init');
  world.brief = path.join(dir, 'brief.md');
  fs.writeFileSync(world.brief, '# Build the thing\n\nRead odd/tasks/thing.md first.\n');
  const fake = path.join(world.shim, 'fake-claude.mjs');
  fs.writeFileSync(fake, FAKE);
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(world.shim, 'claude.cmd'), `@"${process.execPath}" "${fake}" %*\r\n`);
  } else {
    fs.writeFileSync(path.join(world.shim, 'claude'), `#!/bin/sh\nexec '${process.execPath}' '${fake}' "$@"\n`);
    fs.chmodSync(path.join(world.shim, 'claude'), 0o755);
  }
  writeState(world, { nextId: '0db8bc5e', now: Date.now() - 60000, agents: [], calls: [] });
  return world;
}

/** A folder of the world with nothing in it, for a PATH on which no claude can be found. */
const emptyDir = (world) => {
  const dir = path.join(world.dir, 'empty');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const readState = (world) => JSON.parse(fs.readFileSync(world.state, 'utf8'));
/** The calls the fake got that act on a session: every listing left out. */
const actions = (world) => readState(world).calls.filter((call) => call[0] !== 'agents');
const writeState = (world, state) => fs.writeFileSync(world.state, JSON.stringify(state, null, 2));
const patchState = (world, patch) => writeState(world, { ...readState(world), ...patch });
const recordFile = (world) => path.join(world.home, '.js-harness', 'background', 'sessions.jsonl');
const recordLines = (world) => (fs.existsSync(recordFile(world)) ? fs.readFileSync(recordFile(world), 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);

/** The environment of a run: this one's, with the shim folder first on PATH and the world's harness home. */
function envOf(world) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^path$/i.test(key) && key !== 'JS_HARNESS_HOME' && key !== 'CLAUDE_CODE_SESSION_ID'));
  const pathValue = process.env.PATH ?? process.env.Path ?? '';
  return { ...env, PATH: `${world.shim}${path.delimiter}${pathValue}`, JS_HARNESS_HOME: world.home, FAKE_CLAUDE_STATE: world.state };
}

function js(world, args) {
  const result = spawnSync(process.execPath, [BIN, ...args], { cwd: world.project, env: envOf(world), encoding: 'utf8', timeout: 60000 });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function withWorld(body, options) {
  return async () => {
    const world = makeWorld(options);
    try {
      await body(world);
    } finally {
      fs.rmSync(world.dir, { recursive: true, force: true });
    }
  };
}

test('sessions start starts claude --bg with the title, a pointer to the brief and Remote Control, and records it', withWorld((world) => {
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing', '--model', 'haiku', '--effort', 'high']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^started 0db8bc5e · Build the thing$/m);
  assert.match(result.stdout, /js-harness sessions stop 0db8bc5e/);
  const [call] = actions(world);
  const briefs = path.join(world.home, '.js-harness', 'background', 'briefs');
  assert.deepEqual(call.slice(0, -1), ['--bg', '--add-dir', briefs, '-n', 'Build the thing', '-w', 'thing', '--model', 'haiku', '--effort', 'high', '--remote-control', 'Build the thing']);
  const prompt = call.at(-1);
  assert.doesNotMatch(prompt, /\n/);
  const [record] = recordLines(world);
  assert.equal(record.event, 'started');
  assert.equal(record.id, '0db8bc5e');
  assert.equal(record.title, 'Build the thing');
  assert.equal(record.worktree, 'thing');
  assert.equal(record.remoteControl, true);
  assert.equal(path.dirname(record.brief), briefs);
  assert.ok(prompt.includes(record.brief), prompt);
  const copy = fs.readFileSync(record.brief, 'utf8');
  assert.ok(copy.startsWith('# Build the thing\n\nRead odd/tasks/thing.md first.\n'), copy);
  assert.match(copy, /js-harness notify --to orchestrator/);
}));

test('sessions start --no-remote-control leaves Remote Control off', withWorld((world) => {
  const result = js(world, ['sessions', 'start', '--title', 'Quiet one', '--brief', world.brief, '--no-remote-control']);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(!actions(world)[0].includes('--remote-control'));
  assert.equal(recordLines(world)[0].remoteControl, false);
}));

test('a start claude refuses prints its words, records nothing and keeps no copy of the brief', withWorld((world) => {
  patchState(world, { refuseStart: 'Workspace not trusted. Run `claude` in the folder once and accept the trust prompt, then retry.' });
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Workspace not trusted/);
  assert.deepEqual(recordLines(world), []);
  const briefs = path.join(world.home, '.js-harness', 'background', 'briefs');
  assert.deepEqual(fs.existsSync(briefs) ? fs.readdirSync(briefs) : [], []);
}));

test('a start whose id claude does not print takes it from claude agents by the title', withWorld((world) => {
  patchState(world, { quiet: true });
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(recordLines(world)[0].id, '0db8bc5e');
}));

test('a start without an id takes only a session claude agents did not list before it, and records none it cannot tell', withWorld((world) => {
  const before = { id: 'aaaa1111', cwd: path.join(world.dir, 'elsewhere'), kind: 'background', startedAt: 0, sessionId: 'aaaa1111-0', name: 'Build the thing', status: 'busy' };
  patchState(world, { quiet: true, agents: [before] });
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(recordLines(world).map((line) => line.id), ['0db8bc5e']);
  patchState(world, { ghost: true, nextId: 'c779ed44' });
  const none = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(none.code, 1);
  assert.match(none.stderr, /claude agents lists no new session titled "Build the thing"/);
  assert.equal(recordLines(world).length, 1);
  // A start of the same title in another folder of the checkout, at the same moment, is another caller's.
  patchState(world, { sibling: { id: 'bbbb2222', cwd: path.join(world.project, 'sub'), sessionId: 'bbbb2222-0' } });
  const beside = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(beside.code, 1);
  assert.equal(recordLines(world).length, 1);
}));

test('a start whose run of claude fails after it began records the session claude agents lists, and keeps the brief when it lists none', withWorld((world) => {
  const agents = [];
  let start = true;
  const claude = (args) => {
    if (args[0] === 'agents') return { status: 0, stdout: JSON.stringify(agents), stderr: '' };
    if (start) agents.push({ id: 'e1e1e1e1', cwd: world.project, kind: 'background', startedAt: Date.now(), sessionId: 'e1e1e1e1-0', name: 'Slow', status: 'busy' });
    return { status: null, stdout: '', stderr: '', error: Object.assign(new Error('spawnSync claude.cmd ETIMEDOUT'), { code: 'ETIMEDOUT' }) };
  };
  const out = [];
  const err = [];
  const deps = { cwd: world.project, env: envOf(world), claude, stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
  assert.equal(sessionsStartMain(['--title', 'Slow', '--brief', world.brief], deps), 0, err.join('\n'));
  assert.deepEqual(recordLines(world).map((line) => line.id), ['e1e1e1e1']);
  assert.match(err.join('\n'), /ETIMEDOUT/);
  start = false;
  assert.equal(sessionsStartMain(['--title', 'Slow', '--brief', world.brief], deps), 1);
  const said = err.join('\n');
  assert.match(said, /claude agents/);
  const dir = path.join(world.home, '.js-harness', 'background', 'briefs');
  const briefs = fs.readdirSync(dir).map((name) => path.join(dir, name));
  assert.equal(briefs.length, 2);
  assert.ok(briefs.some((copy) => said.includes(copy)), said);
}));

test('a start after a record whose last line was cut keeps its own entry whole', withWorld((world) => {
  fs.mkdirSync(path.dirname(recordFile(world)), { recursive: true });
  fs.writeFileSync(recordFile(world), '{"schema":"js-harness.background-session/v1","event":"star');
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  const stop = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(stop.code, 0, stop.stderr);
}));

test('a start whose run of claude printed its id and then timed out records that id, even when claude agents fails', withWorld((world) => {
  const claude = (args) => {
    if (args[0] === 'agents') return { status: 1, stdout: '', stderr: 'boom' };
    return { status: null, stdout: 'backgrounded · f0f0f0f0 · Slow\n', stderr: '', error: Object.assign(new Error('spawnSync claude.cmd ETIMEDOUT'), { code: 'ETIMEDOUT' }) };
  };
  const err = [];
  assert.equal(sessionsStartMain(['--title', 'Slow', '--brief', world.brief], { cwd: world.project, env: envOf(world), claude, stdout: () => {}, stderr: (line) => err.push(line) }), 0, err.join('\n'));
  assert.deepEqual(recordLines(world).map((line) => line.id), ['f0f0f0f0']);
}));

test('sessions start runs nothing when the record cannot be written', withWorld((world) => {
  fs.mkdirSync(recordFile(world), { recursive: true });
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /could not write the record/);
  assert.deepEqual(actions(world), []);
}));

/** The record the fake turned into a folder (`breakRecord`), a file again with the lines it held. */
const mendRecord = (world) => {
  fs.rmSync(recordFile(world), { recursive: true, force: true });
  if (fs.existsSync(`${recordFile(world)}.held`)) fs.renameSync(`${recordFile(world)}.held`, recordFile(world));
  patchState(world, { breakRecord: false, refuseRm: null });
};
const strandedFile = (world, id) => path.join(world.home, '.js-harness', 'background', 'stranded', `${id}.json`);

// Codex finding 4 on 54c7e39..e7aa7ec: a start whose line the record would not take after claude ran, and whose rollback
// claude refused, left only the commands that remove it, which nothing on the machine kept.
test('a start the record would not take and claude would not undo is kept in a file of its own, which stop and uninstall act on', withWorld((world) => {
  patchState(world, { breakRecord: true, refuseRm: 'Worktree has 2 unpushed commits' });
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(result.code, 1);
  assert.ok(result.stderr.includes(`its entry is kept in ${strandedFile(world, '0db8bc5e')}: js-harness sessions stop 0db8bc5e`), result.stderr);
  const entry = JSON.parse(fs.readFileSync(strandedFile(world, '0db8bc5e'), 'utf8'));
  assert.deepEqual([entry.event, entry.id, entry.title], ['started', '0db8bc5e', 'Build the thing']);
  mendRecord(world);
  const stop = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(stop.code, 0, stop.stderr);
  assert.match(stop.stdout, /removed 0db8bc5e · Build the thing/);
  assert.equal(fs.existsSync(strandedFile(world, '0db8bc5e')), false);
  assert.deepEqual(recordLines(world).map((line) => [line.event, line.id]), [['removed', '0db8bc5e']]);
  // The machine uninstall undoes one as it undoes a recorded session, and then removes the folder.
  patchState(world, { breakRecord: true, refuseRm: 'Worktree has 2 unpushed commits', nextId: 'c779ed44' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Other', '--brief', world.brief]).code, 1);
  mendRecord(world);
  const uninstall = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(uninstall.code, 0, uninstall.stderr);
  assert.match(uninstall.stdout, /removed background session c779ed44 · Other/);
  assert.equal(fs.existsSync(path.join(world.home, '.js-harness', 'background')), false);
}));

test('a resume the record would not take is kept in a file of its own, and stop undoes it with the job it resumed', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  endJob(world, '0db8bc5e');
  patchState(world, { breakRecord: true, nextId: 'c779ed44' });
  const resumed = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(resumed.code, 1);
  assert.ok(resumed.stderr.includes(`it was stopped, and its entry is kept in ${strandedFile(world, 'c779ed44')}`), resumed.stderr);
  mendRecord(world);
  assert.match(js(world, ['sessions', 'stop', '0db8bc5e']).stderr, /0db8bc5e was resumed as c779ed44/);
  const stop = js(world, ['sessions', 'stop', 'c779ed44']);
  assert.equal(stop.code, 0, stop.stderr);
  assert.deepEqual(recordLines(world).slice(1).map((line) => [line.event, line.id]), [['removed', '0db8bc5e'], ['removed', 'c779ed44']]);
  assert.equal(fs.existsSync(strandedFile(world, 'c779ed44')), false);
}));

test('sessions start refuses a missing brief, a missing title and an unknown flag before claude runs', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'x', '--brief', path.join(world.dir, 'none.md')]).code, 2);
  assert.equal(js(world, ['sessions', 'start', '--brief', world.brief]).code, 2);
  assert.equal(js(world, ['sessions', 'start', '--title', 'x', '--brief', world.brief, '--bogus']).code, 2);
  assert.deepEqual(readState(world).calls, []);
}));

test('sessions start says so when claude is not on PATH', withWorld((world) => {
  const result = spawnSync(process.execPath, [BIN, 'sessions', 'start', '--title', 'x', '--brief', world.brief], {
    cwd: world.project, env: { ...envOf(world), PATH: emptyDir(world) }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /claude is not on PATH/);
}));

test('where session-title and session-effort are declared, a free title or no effort is refused with the guard\'s reasons', withWorld((world) => {
  const free = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--effort', 'high']);
  assert.equal(free.code, 2);
  assert.match(free.stderr, /js-harness sessions start titles the session "Build the thing"/);
  assert.match(free.stderr, /Title it "JH 1 · <purpose>"/);
  const noEffort = js(world, ['sessions', 'start', '--title', 'JH 1 · thing', '--brief', world.brief]);
  assert.equal(noEffort.code, 2);
  assert.match(noEffort.stderr, /js-harness sessions start names no effort/);
  assert.match(noEffort.stderr, /--effort high/);
  assert.deepEqual(readState(world).calls, []);
  assert.equal(js(world, ['sessions', 'start', '--title', 'JH 1 · thing', '--brief', world.brief, '--effort', 'high']).code, 0);
}, { rules: true }));

test('sessions stop stops and removes a recorded session, drops its brief and records the removal', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  const { brief } = recordLines(world)[0];
  const result = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /removed 0db8bc5e · Build the thing/);
  assert.deepEqual(actions(world).slice(1), [['stop', '0db8bc5e'], ['rm', '0db8bc5e']]);
  assert.deepEqual(recordLines(world).map((line) => line.event), ['started', 'removed']);
  assert.equal(fs.existsSync(brief), false);
  const again = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(again.code, 1);
  assert.match(again.stderr, /no session js-harness sessions start recorded is named by "0db8bc5e"/);
  assert.equal(actions(world).length, 3);
}));

test('sessions stop refuses a session it did not start and runs nothing', withWorld((world) => {
  patchState(world, { agents: [{ id: 'f462dfd5', kind: 'background', name: 'his', status: 'idle' }] });
  const result = js(world, ['sessions', 'stop', 'f462dfd5']);
  assert.equal(result.code, 1);
  assert.deepEqual(readState(world).calls, []);
}));

test('sessions stop drops a session claude already lost, and keeps one whose removal claude refuses', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Lost', '--brief', world.brief]).code, 0);
  patchState(world, { agents: [] });
  const lost = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(lost.code, 0, lost.stderr);
  assert.match(lost.stdout, /0db8bc5e · Lost was already gone/);
  patchState(world, { nextId: 'c779ed44' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Unpushed', '--brief', world.brief]).code, 0);
  patchState(world, { refuseRm: 'Worktree has 2 unpushed commits: pass --discard-unpushed abc@wt1 to discard them' });
  const kept = js(world, ['sessions', 'stop', 'c779ed44']);
  assert.equal(kept.code, 1);
  assert.match(kept.stderr, /unpushed commits/);
  assert.match(kept.stderr, /still recorded/);
  assert.equal(recordLines(world).at(-1).event, 'started');
}));

test('sessions stop keeps the session recorded while its brief cannot be deleted, and finishes on a retry', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  const { brief } = recordLines(world)[0];
  fs.rmSync(brief);
  fs.mkdirSync(brief);
  fs.writeFileSync(path.join(brief, 'held'), 'x');
  const held = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(held.code, 1);
  assert.match(held.stderr, /still recorded/);
  assert.equal(recordLines(world).at(-1).event, 'started');
  fs.rmSync(brief, { recursive: true });
  const retry = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(retry.code, 0, retry.stderr);
  assert.equal(recordLines(world).at(-1).event, 'removed');
}));

test('sessions stop says so when claude keeps the session\'s worktree', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing']).code, 0);
  const worktree = path.join(world.project, '.claude', 'worktrees', 'thing');
  patchState(world, { keepWorktree: true });
  const result = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes(`its worktree ${worktree} stays`), result.stdout);
  patchState(world, { keepWorktree: false, nextId: 'c779ed44' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Other', '--brief', world.brief, '--worktree', 'other']).code, 0);
  const gone = js(world, ['sessions', 'stop', 'c779ed44']).stdout;
  assert.ok(gone.includes(`its worktree ${path.join(world.project, '.claude', 'worktrees', 'other')} is gone`), gone);
  patchState(world, { nextId: 'a1b2c3d4' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Plain', '--brief', world.brief]).code, 0);
  assert.doesNotMatch(js(world, ['sessions', 'stop', 'a1b2c3d4']).stdout, /worktree/);
}));

// claude agents lists a session it just started in the folder it was started from: the record and stop name the
// worktree all the same, and so does stop for a record written before, which holds the main checkout (2026-10-28).
test('sessions start records the worktree claude makes, and stop names it for a record that holds the main checkout', withWorld((world) => {
  patchState(world, { rootCwd: true, keepWorktree: true });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing']).code, 0);
  const [entry] = recordLines(world);
  const worktree = path.join(entry.root, '.claude', 'worktrees', 'thing');
  assert.equal(entry.worktreePath, worktree);
  fs.appendFileSync(recordFile(world), `${JSON.stringify({ ...entry, id: 'e141d3f5', worktree: 'docs', worktreePath: entry.root })}\n`);
  patchState(world, { agents: [] });
  const stale = js(world, ['sessions', 'stop', 'e141d3f5']);
  assert.equal(stale.code, 0, stale.stderr);
  // claude never made that worktree: it was not there before the stop, so the stop did not remove it (R3-004).
  assert.ok(stale.stdout.includes(`its worktree ${path.join(entry.root, '.claude', 'worktrees', 'docs')} was not there when stop ran`), stale.stdout);
  assert.doesNotMatch(stale.stdout, /is gone/);
  assert.ok(!stale.stdout.includes(`its worktree ${entry.root} stays`), stale.stdout);
  const kept = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.ok(kept.stdout.includes(`its worktree ${worktree} stays`), kept.stdout);
}));

// A reboot ends every background job; the lead resumed one by hand with claude --bg --resume, and the board listed the
// job as not started by js-harness (2026-10-28).
test('sessions start --resume resumes a recorded session that stopped, in its worktree, and records the new job', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing', '--effort', 'high']).code, 0);
  const [first] = recordLines(world);
  const worktree = path.join(first.root, '.claude', 'worktrees', 'thing');
  // One that still runs is not resumed: two jobs would write one conversation.
  const busy = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(busy.code, 1);
  assert.match(busy.stderr, /0db8bc5e · Build the thing is busy/);
  assert.equal(actions(world).length, 1);
  const state = readState(world);
  Object.assign(state.agents[0], { status: undefined, state: 'failed', pid: undefined });
  writeState(world, { ...state, nextId: 'c779ed44' });
  const resumed = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.match(resumed.stdout, /resumed 0db8bc5e as c779ed44 · Build the thing/);
  const call = actions(world).at(-1);
  assert.deepEqual(call.slice(0, 3), ['--bg', '--resume', first.sessionId]);
  assert.deepEqual([call[call.indexOf('-n') + 1], call[call.indexOf('--effort') + 1], call.includes('-w')], ['Build the thing', 'high', false]);
  assert.equal(path.resolve(readState(world).agents.find((agent) => agent.id === 'c779ed44').cwd), path.resolve(worktree));
  const entry = recordLines(world).at(-1);
  assert.deepEqual([entry.event, entry.id, entry.resumedFrom, entry.title, entry.worktree, entry.worktreePath, entry.effort], ['started', 'c779ed44', '0db8bc5e', 'Build the thing', 'thing', worktree, 'high']);
  // Only a session the record holds is resumed, and a resume names no title, worktree or folder of its own.
  assert.equal(js(world, ['sessions', 'start', '--resume', 'f462dfd5']).code, 1);
  assert.equal(js(world, ['sessions', 'start', '--resume', '0db8bc5e', '--title', 'Other']).code, 2);
}));

/** The recorded job `id` of the fake ended, as a restart of the machine ends it. */
const endJob = (world, id) => {
  const state = readState(world);
  Object.assign(state.agents.find((agent) => agent.id === id), { status: undefined, state: 'failed', pid: undefined });
  writeState(world, state);
};

// gentle-ai on slice C of JH 72 (7d8db831..73fc8cf7): resume paths that no test held.
test('sessions start --resume resumes a job claude no longer lists, with --model and --no-remote-control, and refuses a claude that refuses or a folder that is gone', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing']).code, 0);
  const [first] = recordLines(world);
  // After a restart claude agents may not list the stopped job at all.
  patchState(world, { agents: [], nextId: 'c779ed44', refuseStart: 'resume refused: made up' });
  const refused = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /claude did not resume 0db8bc5e · Build the thing \(exit 1\), and nothing was recorded:\s+resume refused: made up/);
  assert.equal(recordLines(world).length, 1);
  patchState(world, { refuseStart: null });
  const resumed = js(world, ['sessions', 'start', '--resume', '0db8bc5e', '--model', 'haiku', '--no-remote-control']);
  assert.equal(resumed.code, 0, resumed.stderr);
  const call = actions(world).at(-1);
  assert.deepEqual([call[call.indexOf('--model') + 1], call.includes('--remote-control')], ['haiku', false]);
  const entry = recordLines(world).at(-1);
  assert.deepEqual([entry.id, entry.model, entry.remoteControl], ['c779ed44', 'haiku', false]);
  // A folder that is gone is not resumed into.
  endJob(world, 'c779ed44');
  fs.rmSync(path.join(first.root, '.claude', 'worktrees', 'thing'), { recursive: true, force: true });
  patchState(world, { nextId: 'a1b2c3d4' });
  const gone = js(world, ['sessions', 'start', '--resume', 'c779ed44']);
  assert.equal(gone.code, 1);
  assert.match(gone.stderr, /the folder c779ed44 · Build the thing worked in, .*thing, is gone, so it was not resumed/);
}));

// Codex P1 on 79e3430..318f952: the job a resume replaced shares its worktree and brief with the new one; undone alone
// it would delete them under the new job, and resumed again it would put two jobs on one conversation.
test('a resumed job replaces the one it resumed: that one is neither resumed nor stopped alone, and stopping the new job undoes both', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing']).code, 0);
  const [first] = recordLines(world);
  endJob(world, '0db8bc5e');
  patchState(world, { nextId: 'c779ed44' });
  const resumed = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.match(resumed.stdout, /js-harness sessions stop c779ed44 removes it and 0db8bc5e, the job it resumed/);
  const acted = actions(world).length;
  const again = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(again.code, 1);
  assert.match(again.stderr, /0db8bc5e was resumed as c779ed44: js-harness sessions start --resume c779ed44 resumes it/);
  const alone = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(alone.code, 1);
  assert.match(alone.stderr, /0db8bc5e was resumed as c779ed44: js-harness sessions stop c779ed44 removes both/);
  // The machine uninstall keeps the new job while it works, and with it the one it resumed.
  assert.equal(js(world, ['uninstall', 'machine', '--home', world.home]).code, 1);
  assert.equal(actions(world).length, acted, 'nothing ran');
  assert.ok(fs.existsSync(first.brief), 'the brief the new job reads stays');
  const stopped = js(world, ['sessions', 'stop', 'c779ed44']);
  assert.equal(stopped.code, 0, stopped.stderr);
  assert.deepEqual(actions(world).slice(acted), [['stop', 'c779ed44'], ['rm', 'c779ed44'], ['stop', '0db8bc5e'], ['rm', '0db8bc5e']]);
  assert.deepEqual(recordLines(world).slice(2).map((line) => [line.event, line.id]), [['removed', '0db8bc5e'], ['removed', 'c779ed44']]);
  assert.equal(fs.existsSync(first.brief), false);
}));

// Codex P1 on 79e3430..318f952: a job the lead resumed by hand works the same conversation under another id.
test('sessions start --resume refuses while any job claude lists works the recorded conversation', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  const [first] = recordLines(world);
  endJob(world, '0db8bc5e');
  const state = readState(world);
  state.agents.push({ id: 'f462dfd5', kind: 'background', cwd: world.project, sessionId: first.sessionId, name: 'Build the thing', status: 'busy', state: 'working' });
  writeState(world, state);
  const result = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /its conversation runs in f462dfd5 · Build the thing, which is busy/);
  assert.equal(actions(world).length, 1, 'nothing ran');
}));

// Codex P2 on 79e3430..318f952: a resume answers to the same rules and the same record as a start.
test('sessions start --resume holds to the effort rule, needs a writable record, and keeps what it knows when claude says less', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'JH 1 · thing', '--brief', world.brief, '--effort', 'high']).code, 0);
  const [first] = recordLines(world);
  endJob(world, '0db8bc5e');
  const effort = js(world, ['sessions', 'start', '--resume', '0db8bc5e', '--effort', 'max']);
  assert.equal(effort.code, 2);
  assert.match(effort.stderr, /--effort high or lower/);
  fs.chmodSync(recordFile(world), 0o444);
  const unwritable = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  fs.chmodSync(recordFile(world), 0o644);
  assert.equal(unwritable.code, 1);
  assert.match(unwritable.stderr, /could not write the record .*, so nothing was resumed/);
  assert.equal(actions(world).length, 1, 'nothing ran');
  // claude prints no id: the new job is taken from claude agents, by its title in the folder it was resumed in.
  patchState(world, { nextId: 'c779ed44', quiet: true });
  const quiet = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(quiet.code, 0, quiet.stderr);
  assert.equal(recordLines(world).at(-1).id, 'c779ed44');
  // claude agents fails once the job runs: the conversation the resume named is recorded.
  endJob(world, 'c779ed44');
  patchState(world, { nextId: 'a1b2c3d4', quiet: false, agentsFailAfterStart: 'agents down' });
  const blind = js(world, ['sessions', 'start', '--resume', 'c779ed44']);
  assert.equal(blind.code, 0, blind.stderr);
  const last = recordLines(world).at(-1);
  assert.deepEqual([last.id, last.sessionId, last.resumedFrom], ['a1b2c3d4', recordLines(world).at(-2).sessionId, 'c779ed44']);
  // Neither an id nor a listing: nothing is recorded, and the new brief stays for the job that may run.
  patchState(world, { agentsFail: undefined, agentsFailAfterStart: undefined, nextId: 'b2c3d4e5', quiet: true, ghost: true });
  endJob(world, 'a1b2c3d4');
  const lost = js(world, ['sessions', 'start', '--resume', 'a1b2c3d4', '--brief', world.brief]);
  assert.equal(lost.code, 1);
  const kept = /its brief stays at (\S+\.md)/.exec(lost.stderr);
  assert.ok(kept && fs.existsSync(kept[1]), lost.stderr);
  assert.equal(recordLines(world).at(-1).id, 'a1b2c3d4');
  assert.notEqual(first.sessionId, null);
}, { rules: true }));

test('uninstall machine removes the recorded sessions that rest, keeps a working one and fails until it is stopped', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Busy', '--brief', world.brief]).code, 0);
  patchState(world, { nextId: 'c779ed44' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Done', '--brief', world.brief]).code, 0);
  const state = readState(world);
  state.agents.find((agent) => agent.id === 'c779ed44').status = 'idle';
  state.agents.find((agent) => agent.id === 'c779ed44').state = 'done';
  writeState(world, state);
  const first = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(first.code, 1);
  assert.match(first.stdout, /removed background session c779ed44 · Done/);
  assert.match(first.stderr, /kept background session 0db8bc5e · Busy: it is busy; js-harness sessions stop 0db8bc5e/);
  assert.ok(fs.existsSync(recordFile(world)));
  assert.ok(!actions(world).some((call) => call[1] === '0db8bc5e'));
  assert.equal(js(world, ['sessions', 'stop', '0db8bc5e']).code, 0);
  const second = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(fs.existsSync(path.join(world.home, '.js-harness', 'background')), false);
}));

test('uninstall machine with a manifest that does not parse touches no background session', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  const state = readState(world);
  state.agents[0].status = 'idle';
  state.agents[0].state = 'done';
  writeState(world, state);
  fs.writeFileSync(path.join(world.home, '.js-harness', 'manifest.json'), '{ not json');
  const result = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /nothing was changed/);
  assert.deepEqual(actions(world).slice(1), []);
  assert.equal(recordLines(world).at(-1).event, 'started');
}));

test('uninstall machine keeps the record while it holds lines it cannot read', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  const state = readState(world);
  state.agents[0].status = 'idle';
  state.agents[0].state = 'done';
  writeState(world, state);
  fs.appendFileSync(recordFile(world), '{ damaged\n');
  const result = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /removed background session 0db8bc5e/);
  assert.match(result.stderr, /1 line of .*sessions.jsonl is not an entry/);
  assert.ok(fs.existsSync(recordFile(world)));
}));

test('uninstall machine says what to settle for a session it keeps: one claude refuses, one it cannot tell', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Unpushed', '--brief', world.brief]).code, 0);
  const state = readState(world);
  state.agents[0].status = 'idle';
  state.agents[0].state = 'done';
  state.refuseRm = 'Worktree has 2 unpushed commits';
  writeState(world, state);
  const refused = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /kept background session 0db8bc5e · Unpushed: claude rm 0db8bc5e: Worktree has 2 unpushed commits; settle what claude says, then run js-harness uninstall machine again/);
  const blind = spawnSync(process.execPath, [BIN, 'uninstall', 'machine', '--home', world.home], { cwd: world.project, env: { ...envOf(world), PATH: emptyDir(world) }, encoding: 'utf8' });
  assert.equal(blind.status, 1);
  assert.match(blind.stderr, /kept background session 0db8bc5e · Unpushed: it cannot be told whether it is at work: claude is not on PATH; run js-harness uninstall machine again once claude runs/);
}));

/** The board of the world's project, in process, with a fake `git`/`gh` and the fake `claude` on PATH. */
async function board(world, argv = ['--json'], deps = {}) {
  const out = [];
  const err = [];
  const root = world.project;
  fs.mkdirSync(path.join(world.dir, 'claude-home', 'projects', projectSlug(root)), { recursive: true });
  const run = (command, args) => {
    if (command === 'git' && args.includes('--git-common-dir')) return { status: 0, stdout: `${root.replace(/\\/g, '/')}/.git\n`, stderr: '' };
    if (command === 'git' && args[0] === 'worktree') return { status: 0, stdout: `worktree ${root.replace(/\\/g, '/')}\nHEAD 1111111111111111111111111111111111111111\nbranch refs/heads/main\n\n`, stderr: '' };
    return { status: 1, stdout: '', stderr: 'not here' };
  };
  const code = await sessionsMain(['--claude-home', path.join(world.dir, 'claude-home'), '--tmp', path.join(world.dir, 'tmp'), ...argv], {
    cwd: root, stdout: (line) => out.push(line), stderr: (line) => err.push(line), env: envOf(world), homedir: () => world.home, run, listProcesses: () => [], ...deps,
  });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

test('the board lists the project\'s background sessions with what they wait for and whether sessions start recorded them', withWorld(async (world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Mine', '--brief', world.brief]).code, 0);
  const state = readState(world);
  state.agents[0].status = 'waiting';
  state.agents[0].waitingFor = 'permission prompt';
  state.agents.push({ id: 'aaaa1111', cwd: path.join(world.project, '.claude', 'worktrees', 'x'), kind: 'background', startedAt: state.now, sessionId: 'aaaa1111-0', name: 'His', status: 'idle', state: 'done' });
  state.agents.push({ id: 'bbbb2222', cwd: path.join(world.dir, 'elsewhere'), kind: 'background', startedAt: state.now, sessionId: 'bbbb2222-0', name: 'Other project', status: 'busy' });
  state.agents.push({ pid: 1, cwd: world.project, kind: 'interactive', sessionId: 'cccc3333-0', name: 'Interactive', status: 'busy' });
  writeState(world, state);
  const json = await board(world);
  const background = JSON.parse(json.stdout).background;
  assert.equal(background.available, true);
  assert.deepEqual(background.items.map((item) => [item.id, item.title, item.status, item.waitingFor ?? null, item.recorded]), [
    ['0db8bc5e', 'Mine', 'waiting', 'permission prompt', true],
    ['aaaa1111', 'His', 'idle', null, false],
  ]);
  const text = await board(world, []);
  assert.match(text.stdout, /^Background sessions/m);
  assert.match(text.stdout, /0db8bc5e {2}Mine {2}waiting for permission prompt/);
  assert.match(text.stdout, /aaaa1111 {2}His {2}idle \(done\).*not started by js-harness/);
}));

test('the board says the background sessions are unavailable when claude agents fails', withWorld(async (world) => {
  patchState(world, { agentsFail: 'boom' });
  const background = JSON.parse((await board(world)).stdout).background;
  assert.equal(background.available, false);
  assert.match(background.reason, /claude agents --json --all exited 1: boom/);
}));

test('a watch returns when a background session starts waiting', withWorld(async (world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Mine', '--brief', world.brief]).code, 0);
  let clock = Date.now();
  const sleep = async (ms) => {
    clock += ms;
    const state = readState(world);
    state.agents[0].status = 'waiting';
    state.agents[0].waitingFor = 'permission prompt';
    writeState(world, state);
  };
  const result = await board(world, ['--watch', '--interval', '1', '--timeout', '5'], { sleep, now: () => clock });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /background session 0db8bc5e · Mine waits for permission prompt/);
}));

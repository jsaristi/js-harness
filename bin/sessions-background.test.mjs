import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sessionsMain } from './sessions.mjs';
import { runText, sessionsStartMain } from './sessions-background.mjs';
import { appendNotice, newNotice } from './lib/channel.mjs';
import { RULES } from './lib/rules-data.mjs';
import { projectSlug } from './lib/sessions.mjs';

// `js-harness sessions start` and `stop`, the board's background sessions and the machine uninstall, through the public
// command line, against a fake `claude` on PATH (odd/tasks/background-sessions.md). The fake keeps its sessions in a
// JSON file the test reads and writes, and logs every call it gets, so no test starts a real session.

const BIN = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));
const RULES_DATA = fileURLToPath(new URL('./lib/rules-data.mjs', import.meta.url));
// The effort the rule session-effort gives, read from the list a world with rules copies and never written here.
const SESSION_EFFORT = RULES.find((rule) => rule.id === 'session-effort').value;

const FAKE = String.raw`
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
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
  state.bgAt = new Date().toISOString();
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
  // claude stop returns while the job's process still ends, and its lock on the worktree names that process. It ends
  // once rm has refused for it (the release file), not after a set time a slow machine could outlast (Codex P2 on
  // be294ca..7f918a9); lockMs only bounds a run that never gets there.
  if (state.lockMs) {
    const ends = 'const fs = require("fs"); const until = Date.now() + ' + state.lockMs + '; const look = setInterval(() => { if (fs.existsSync(' + JSON.stringify(file + '.release') + ') || Date.now() > until) clearInterval(look); }, 50);';
    const job = spawn(process.execPath, ['-e', ends], { cwd: os.tmpdir(), detached: true, stdio: 'ignore', windowsHide: true });
    job.unref();
    state.lockPid = job.pid;
  }
  save();
  out('stopped ' + argv[1]);
  process.exit(0);
}
if (argv[0] === 'rm') {
  if (state.refuseRm) { out(state.refuseRm); save(); process.exit(1); }
  const running = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
  if (state.lockPid && running(state.lockPid)) {
    out('kept ' + argv[1] + ' — its worktree is still at “' + (agent?.worktree ?? process.cwd()) + '”\n  A Claude Code lock on the worktree names a process that is still running (pid ' + state.lockPid + ').');
    fs.writeFileSync(file + '.release', '');
    save();
    process.exit(1);
  }
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
/** The jobs the record says were started, oldest first: the record also holds the lines of removals, so its last line
 * is not always the last start. */
const startedLines = (world) => recordLines(world).filter((line) => line.event === 'started');

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
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing', '--model', 'haiku', '--effort', 'high', '--advisor', 'fable']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^started 0db8bc5e · Build the thing$/m);
  assert.match(result.stdout, /js-harness sessions stop 0db8bc5e/);
  const [call] = actions(world);
  const briefs = path.join(world.home, '.js-harness', 'background', 'briefs');
  assert.deepEqual(call.slice(0, -1), ['--bg', '--add-dir', briefs, '-n', 'Build the thing', '-w', 'thing', '--model', 'haiku', '--effort', 'high', '--advisor', 'fable', '--remote-control', 'Build the thing']);
  const prompt = call.at(-1);
  assert.doesNotMatch(prompt, /\n/);
  const [record] = recordLines(world);
  assert.equal(record.event, 'started');
  assert.equal(record.id, '0db8bc5e');
  assert.equal(record.title, 'Build the thing');
  assert.equal(record.worktree, 'thing');
  assert.equal(record.remoteControl, true);
  assert.equal(record.advisor, 'fable');
  assert.equal(path.dirname(record.brief), briefs);
  assert.ok(prompt.includes(record.brief), prompt);
  const copy = fs.readFileSync(record.brief, 'utf8');
  assert.ok(copy.startsWith('# Build the thing\n\nRead odd/tasks/thing.md first.\n'), copy);
  assert.match(copy, /js-harness notify --to orchestrator/);
}));

// odd/tasks/visual-pages.md, spec 4: the board shows a session from its start, with no notice the session must send.
const channelFile = (world) => {
  const channel = path.join(world.home, '.js-harness', 'channel');
  const files = fs.existsSync(channel) ? fs.readdirSync(channel).filter((name) => name.endsWith('.jsonl')) : [];
  assert.ok(files.length <= 1, files.join(', '));
  return files.length === 1 ? path.join(channel, files[0]) : null;
};
const channelNotices = (world) => {
  const file = channelFile(world);
  return file === null ? [] : fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
};

test('sessions start writes the session\'s first row to the channel record, stamped before claude ran', withWorld((world) => {
  const before = Date.now();
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing']).code, 0);
  const notices = channelNotices(world);
  assert.deepEqual(notices.map((one) => [one.kind, one.text, one.from.id, one.from.title, one.to.role]), [
    ['opened', 'started by sessions start: Build the thing', '0db8bc5e-0000-4000-8000-000000000000', 'Build the thing', 'orchestrator'],
  ]);
  const { bgAt } = readState(world);
  assert.ok(Date.parse(notices[0].at) >= before && notices[0].at <= bgAt, `${notices[0].at} is not before claude ran at ${bgAt}`);
  // Codex, 2bd3bc7..b70ac68: readers hand a notice's worktree to git, so it is the absolute path, not the name given.
  const [record] = recordLines(world);
  assert.equal(notices[0].worktree, path.resolve(record.worktreePath));
  assert.ok(path.isAbsolute(notices[0].worktree));
}));

// Review 3aafcdd1: with no --worktree the row's place is the checkout git names, with its branch.
test('sessions start places the first row of a session with no worktree in the checkout and its branch', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  const [notice] = channelNotices(world);
  assert.equal(fs.realpathSync(notice.worktree), fs.realpathSync(world.project));
  assert.equal(notice.branch, 'main');
}));

// Codex, 2bd3bc7..b70ac68: `sessions` reads a session's state in the record's order, so a first row written after the
// session's own notice would replace its newer state.
test('sessions start writes no first row once the session wrote its own', withWorld((world) => {
  const channel = path.join(world.home, '.js-harness', 'channel');
  fs.mkdirSync(channel, { recursive: true });
  const from = { host: 'claude-code', id: '0db8bc5e-0000-4000-8000-000000000000', source: 'environment', title: 'Build the thing' };
  const file = appendNotice(world.home, projectSlug(fs.realpathSync(world.project)), newNotice({ at: new Date().toISOString(), from, to: 'orchestrator', kind: 'waiting', text: 'waits for the lead' }));
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(channelFile(world), file, 'the record the start reads is the project\'s');
  assert.deepEqual(channelNotices(world).map((one) => one.kind), ['waiting']);
}));

test('a start whose first row cannot be written keeps the session and says so', withWorld((world) => {
  fs.mkdirSync(path.join(world.home, '.js-harness'), { recursive: true });
  fs.writeFileSync(path.join(world.home, '.js-harness', 'channel'), 'a file where the folder goes');
  const result = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^started 0db8bc5e · Build the thing$/m);
  assert.match(result.stderr, /the board's first row of 0db8bc5e could not be written/);
  assert.equal(recordLines(world).length, 1);
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
  // While the record still cannot be read, stop undoes the stranded session all the same (Codex P2 on 62315e6..e16b577),
  // and refuses any other id, which the record may hold.
  patchState(world, { refuseRm: null });
  assert.match(js(world, ['sessions', 'stop', 'f462dfd5']).stderr, /the record of background sessions could not be read/);
  const stop = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(stop.code, 0, stop.stderr);
  assert.match(stop.stdout, /removed 0db8bc5e · Build the thing/);
  assert.equal(fs.existsSync(strandedFile(world, '0db8bc5e')), false);
  mendRecord(world);
  assert.equal(js(world, ['sessions', 'stop', '0db8bc5e']).code, 1, 'removed: the record holds it no more');
  // The machine uninstall undoes one as it undoes a recorded session; with the record unread it keeps the folder and
  // fails, and once the record reads it removes the folder.
  patchState(world, { breakRecord: true, refuseRm: 'Worktree has 2 unpushed commits', nextId: 'c779ed44' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Other', '--brief', world.brief]).code, 1);
  patchState(world, { refuseRm: null });
  const blind = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(blind.code, 1);
  assert.match(blind.stdout, /removed background session c779ed44 · Other/);
  assert.match(blind.stderr, /sessions\.jsonl could not be read/);
  assert.equal(fs.existsSync(strandedFile(world, 'c779ed44')), false);
  mendRecord(world);
  const uninstall = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(uninstall.code, 0, uninstall.stderr);
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
  const free = js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--effort', SESSION_EFFORT]);
  assert.equal(free.code, 2);
  assert.match(free.stderr, /js-harness sessions start titles the session "Build the thing"/);
  assert.match(free.stderr, /Title it "JH 1 · <purpose>"/);
  const noEffort = js(world, ['sessions', 'start', '--title', 'JH 1 · thing', '--brief', world.brief]);
  assert.equal(noEffort.code, 2);
  assert.match(noEffort.stderr, /js-harness sessions start names no effort/);
  assert.ok(noEffort.stderr.includes(`--effort ${SESSION_EFFORT}`), noEffort.stderr);
  assert.deepEqual(readState(world).calls, []);
  assert.equal(js(world, ['sessions', 'start', '--title', 'JH 1 · thing', '--brief', world.brief, '--effort', SESSION_EFFORT]).code, 0);
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

test('sessions stop waits for the job\'s process claude\'s lock names after the stop, then removes the session', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief]).code, 0);
  patchState(world, { lockMs: 60_000 });
  const result = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /removed 0db8bc5e · Build the thing/);
  assert.deepEqual(actions(world).slice(1), [['stop', '0db8bc5e'], ['rm', '0db8bc5e'], ['rm', '0db8bc5e']]);
  assert.equal(recordLines(world).at(-1).event, 'removed');
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

// On 2026-11-04 (20:06 local) the lead ran sessions stop only to restart a background session after a restart of
// Claude Desktop, and its claude rm deleted every file of the session's worktree but .git (odd/tasks/stop-keeps-worktree.md).
test('sessions stop refuses a session whose worktree holds files, runs no claude and leaves every file', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing']).code, 0);
  const worktree = path.join(world.project, '.claude', 'worktrees', 'thing');
  fs.writeFileSync(path.join(worktree, '.git'), 'gitdir: elsewhere\n');
  fs.mkdirSync(path.join(worktree, 'src'));
  fs.writeFileSync(path.join(worktree, 'src', 'work.js'), 'uncommitted\n');
  const { brief } = recordLines(world)[0];
  const acted = actions(world).length;
  const result = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(result.code, 1, result.stdout);
  assert.equal(actions(world).length, acted, 'no claude stop, no claude rm');
  assert.equal(fs.readFileSync(path.join(worktree, 'src', 'work.js'), 'utf8'), 'uncommitted\n');
  assert.ok(fs.existsSync(path.join(worktree, '.git')));
  assert.ok(fs.existsSync(brief), 'the brief stays');
  assert.deepEqual(recordLines(world).map((line) => line.event), ['started']);
  assert.ok(result.stderr.includes(worktree), result.stderr);
  assert.match(result.stderr, /SendMessage/);
  assert.match(result.stderr, /js-harness sessions stop 0db8bc5e --remove-worktree/);
  // The removal, when it is wanted, is said in so many words.
  const removed = js(world, ['sessions', 'stop', '0db8bc5e', '--remove-worktree']);
  assert.equal(removed.code, 0, removed.stderr);
  assert.deepEqual(actions(world).slice(acted), [['stop', '0db8bc5e'], ['rm', '0db8bc5e']]);
  assert.equal(fs.existsSync(worktree), false);
}));

test('sessions stop runs on a worktree that holds only .git, and takes --remove-worktree with --home in any order', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing']).code, 0);
  fs.writeFileSync(path.join(world.project, '.claude', 'worktrees', 'thing', '.git'), 'gitdir: elsewhere\n');
  const bare = js(world, ['sessions', 'stop', '0db8bc5e']);
  assert.equal(bare.code, 0, bare.stderr);
  patchState(world, { nextId: 'c779ed44' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Other', '--brief', world.brief, '--worktree', 'other']).code, 0);
  fs.writeFileSync(path.join(world.project, '.claude', 'worktrees', 'other', 'work.js'), 'x\n');
  const both = js(world, ['sessions', 'stop', 'c779ed44', '--home', world.home, '--remove-worktree']);
  assert.equal(both.code, 0, both.stderr);
  const twice = js(world, ['sessions', 'stop', 'c779ed44', '--remove-worktree', '--remove-worktree']);
  assert.equal(twice.code, 2);
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

// The review of slice C of JH 72 (7d8db831..73fc8cf7): resume paths that no test held.
test('sessions start --resume resumes a job claude no longer lists, with --model and --no-remote-control and the recorded --advisor, and refuses a claude that refuses or a folder that is gone', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Build the thing', '--brief', world.brief, '--worktree', 'thing', '--advisor', 'fable']).code, 0);
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
  assert.deepEqual([call[call.indexOf('--model') + 1], call.includes('--remote-control'), call[call.indexOf('--advisor') + 1]], ['haiku', false, 'fable']);
  const entry = recordLines(world).at(-1);
  assert.deepEqual([entry.id, entry.model, entry.remoteControl, entry.advisor], ['c779ed44', 'haiku', false, 'fable']);
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

// The verifier, 2026-11-11: this command's runner forced 30 s over every call, the removal of a worktree included, which
// asks for five minutes so that git is not killed half-way through a folder.
test('the runner of these commands bounds a call at 30 s unless the call names its own bound', () => {
  const calls = [];
  const run = runText((command, args, options) => { calls.push(options); return { status: 0 }; });
  run('git', ['status'], { cwd: 'x' });
  run('git', ['worktree', 'remove', 'x'], { cwd: 'x', timeout: 300000, encoding: 'buffer' });
  run('git', ['status']);
  assert.deepEqual(calls, [
    { cwd: 'x', encoding: 'utf8', windowsHide: true, timeout: 30000 },
    { cwd: 'x', timeout: 300000, encoding: 'utf8', windowsHide: true },
    { encoding: 'utf8', windowsHide: true, timeout: 30000 },
  ]);
});

// odd/tasks/sessions-close-themselves.md, spec 3 and L15: 19 of 19 recorded resumes left the job they resumed, and a
// resume still leaves it: claude rm deletes that job's scratch folder, which the conversation that goes on may read.
test('a resume leaves the job it resumed for the close of its session and says why, and a kept id is no second job and keeps its past', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Read the thing', '--brief', world.brief]).code, 0);
  const [first] = recordLines(world);
  endJob(world, '0db8bc5e');
  patchState(world, { nextId: 'c779ed44' });
  const resumed = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.match(resumed.stdout, /resumed 0db8bc5e as c779ed44/);
  assert.match(resumed.stdout, /js-harness sessions stop c779ed44 removes it and 0db8bc5e, the job it resumed/);
  assert.match(resumed.stdout, /0db8bc5e stays until then: claude rm would delete its scratch folder, which this conversation may still use; it goes with the session, which js-harness sessions stop --finished or a land closes once it said closed/);
  assert.ok(!actions(world).some(([verb]) => verb === 'rm'), 'no job was removed');
  assert.deepEqual(recordLines(world).map((line) => [line.event, line.id]), [['started', '0db8bc5e'], ['started', 'c779ed44']]);
  assert.ok(fs.existsSync(first.brief), 'the brief the new job reads stays');
  // A claude that keeps the job's id on a resume made no second job: it is not its own past, and it keeps the job it
  // had resumed, which would otherwise stand as a session of its own (Codex, 2026-11-11).
  endJob(world, 'c779ed44');
  const same = js(world, ['sessions', 'start', '--resume', 'c779ed44']);
  assert.equal(same.code, 0, same.stderr);
  assert.match(same.stdout, /claude kept the job's id/);
  assert.equal(recordLines(world).at(-1).resumedFrom, '0db8bc5e');
  // The session goes whole: the job and the one it resumed, and the brief with them.
  const acted = actions(world).length;
  const stopped = js(world, ['sessions', 'stop', 'c779ed44']);
  assert.equal(stopped.code, 0, stopped.stderr);
  assert.deepEqual(actions(world).slice(acted), [['stop', 'c779ed44'], ['rm', 'c779ed44'], ['stop', '0db8bc5e'], ['rm', '0db8bc5e']]);
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

// 2026-11-10: the title of a lead holds the start, and the resume of that session, to rule:lead-effort.
test('a session titled as a lead starts and resumes at the rule lead-effort, which the title of a work session is refused', withWorld((world) => {
  const lead = RULES.find((rule) => rule.id === 'lead-effort').value;
  // A word that is no level is refused under the rule that holds the title, whatever the two values are.
  const work = js(world, ['sessions', 'start', '--title', 'JH 1 · thing', '--brief', world.brief, '--effort', 'ultra']);
  assert.equal(work.code, 2);
  assert.ok(work.stderr.trimEnd().endsWith(`Pass --effort ${SESSION_EFFORT} or lower.`), work.stderr);
  const none = js(world, ['sessions', 'start', '--title', 'JH ORQ · relevo', '--brief', world.brief, '--effort', 'ultra']);
  assert.equal(none.code, 2);
  assert.ok(none.stderr.trimEnd().endsWith(`Pass --effort ${lead} or lower.`), none.stderr);
  assert.deepEqual(readState(world).calls, []);
  const started = js(world, ['sessions', 'start', '--title', 'JH ORQ · relevo', '--brief', world.brief, '--effort', lead]);
  assert.equal(started.code, 0, started.stderr);
  endJob(world, '0db8bc5e');
  patchState(world, { nextId: 'c779ed44' });
  const resumed = js(world, ['sessions', 'start', '--resume', '0db8bc5e']);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.equal(startedLines(world).at(-1).effort, lead);
}, { rules: true }));

// Codex P2 on 79e3430..318f952: a resume answers to the same rules and the same record as a start.
test('sessions start --resume holds to the effort rule, needs a writable record, and keeps what it knows when claude says less', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'JH 1 · thing', '--brief', world.brief, '--effort', SESSION_EFFORT]).code, 0);
  const [first] = recordLines(world);
  endJob(world, '0db8bc5e');
  const effort = js(world, ['sessions', 'start', '--resume', '0db8bc5e', '--effort', 'max']);
  assert.equal(effort.code, 2);
  assert.ok(effort.stderr.includes(`--effort ${SESSION_EFFORT} or lower`), effort.stderr);
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
  assert.equal(startedLines(world).at(-1).id, 'c779ed44');
  // claude agents fails once the job runs: the conversation the resume named is recorded.
  endJob(world, 'c779ed44');
  patchState(world, { nextId: 'a1b2c3d4', quiet: false, agentsFailAfterStart: 'agents down' });
  const blind = js(world, ['sessions', 'start', '--resume', 'c779ed44']);
  assert.equal(blind.code, 0, blind.stderr);
  const last = startedLines(world).at(-1);
  assert.deepEqual([last.id, last.sessionId, last.resumedFrom], ['a1b2c3d4', startedLines(world).at(-2).sessionId, 'c779ed44']);
  // Neither an id nor a listing: nothing is recorded, and the new brief stays for the job that may run.
  patchState(world, { agentsFail: undefined, agentsFailAfterStart: undefined, nextId: 'b2c3d4e5', quiet: true, ghost: true });
  endJob(world, 'a1b2c3d4');
  const lost = js(world, ['sessions', 'start', '--resume', 'a1b2c3d4', '--brief', world.brief]);
  assert.equal(lost.code, 1);
  const kept = /its brief stays at (\S+\.md)/.exec(lost.stderr);
  assert.ok(kept && fs.existsSync(kept[1]), lost.stderr);
  assert.equal(startedLines(world).at(-1).id, 'a1b2c3d4');
  assert.notEqual(first.sessionId, null);
}, { rules: true }));

/** The folder the fake made for the worktree `name` turned into a real one whose branch main and origin/main hold, at
 * rest for an hour, with claude's settings copy in it; the session of the fake that works there has ended. */
function landWorktree(world, name) {
  const git = (cwd, ...args) => {
    const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  const place = path.join(world.project, '.claude', 'worktrees', name);
  fs.rmSync(place, { recursive: true, force: true });
  git(world.project, 'worktree', 'add', '-q', '-b', `feat/${name}`, place);
  fs.mkdirSync(path.join(place, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(place, '.gitignore'), '.claude/settings.local.json\n');
  fs.writeFileSync(path.join(place, '.claude', 'settings.json'), '{}\n');
  fs.writeFileSync(path.join(place, `${name}.txt`), 'work\n');
  git(place, 'add', '.');
  git(place, 'commit', '-q', '-m', `work of ${name}`);
  fs.writeFileSync(path.join(place, '.claude', 'settings.local.json'), '{}\n');
  git(world.project, 'merge', '-q', '--ff-only', `feat/${name}`);
  git(world.project, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(world.project, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
  const old = new Date(Date.now() - 60 * 60_000);
  fs.utimesSync(path.resolve(place, git(place, 'rev-parse', '--git-path', 'index')), old, old);
  const state = readState(world);
  for (const agent of state.agents.filter((item) => item.worktree && path.basename(item.worktree) === name)) {
    [agent.status, agent.state] = ['idle', 'done'];
    // No pid: the wait for a process is held with a made-up one in bin/lib/background-close.test.mjs.
    delete agent.pid;
  }
  writeState(world, state);
  return place;
}

/** The session `id` of the record says `kind` in the channel now, after the `opened` row its start wrote. */
function said(world, id, kind) {
  const entry = recordLines(world).find((line) => line.id === id);
  appendNotice(world.home, projectSlug(entry.root), newNotice({ at: new Date().toISOString(), from: { host: 'claude-code', id: entry.sessionId, title: entry.title }, to: 'orchestrator', kind, text: `${kind}: made up`, cwd: world.project }));
}

// On 2026-11-10 the owner found dozens of finished background sessions still listed by the Claude app: nothing ran
// sessions stop, and it refuses a worktree that holds files (odd/tasks/sessions-close-themselves.md).
test('sessions stop --finished closes the finished sessions that lose nothing, and names the ones it keeps with why', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Landed', '--brief', world.brief, '--worktree', 'landed']).code, 0);
  patchState(world, { nextId: 'c779ed44' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Dirty', '--brief', world.brief, '--worktree', 'dirty']).code, 0);
  patchState(world, { nextId: 'a1b2c3d4' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Waiting', '--brief', world.brief, '--worktree', 'waiting']).code, 0);
  const [landed, dirty, waiting] = ['landed', 'dirty', 'waiting'].map((name) => landWorktree(world, name));
  fs.writeFileSync(path.join(dirty, 'notes.md'), 'uncommitted\n');
  said(world, '0db8bc5e', 'closed');
  said(world, 'c779ed44', 'closed');
  said(world, 'a1b2c3d4', 'waiting');
  const acted = actions(world).length;
  const result = js(world, ['sessions', 'stop', '--finished']);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes(`closed 0db8bc5e · Landed: git removed its worktree ${landed}, which held nothing to lose, and claude removed its job, with the scratch folder claude keeps for it; its transcript stays`), result.stdout);
  assert.match(result.stdout, /kept c779ed44 · Dirty: its worktree .*dirty stays: it holds what no branch brings back: \?\? notes\.md\n {2}once nothing there is needed, js-harness sessions stop c779ed44 --remove-worktree removes it with its worktree/);
  assert.match(result.stdout, /^1 closed, 1 kept\.$/m);
  assert.doesNotMatch(result.stdout, /a1b2c3d4/);
  // The stop that ends the job's process before git removes its worktree, then the stop and the rm of the removal.
  assert.deepEqual(actions(world).slice(acted), [['stop', '0db8bc5e'], ['stop', '0db8bc5e'], ['rm', '0db8bc5e']]);
  assert.deepEqual([fs.existsSync(landed), fs.readFileSync(path.join(dirty, 'notes.md'), 'utf8'), fs.existsSync(waiting)], [false, 'uncommitted\n', true]);
  assert.deepEqual(recordLines(world).filter((line) => line.event === 'removed').map((line) => line.id), ['0db8bc5e']);
  // A second run has nothing to close and says what is still kept.
  const again = js(world, ['sessions', 'stop', '--finished', '--home', world.home]);
  assert.equal(again.code, 0, again.stderr);
  assert.match(again.stdout, /^0 closed, 1 kept\.$/m);
}));

test('sessions stop --finished takes no id and no --remove-worktree, and closes nothing when it cannot look', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Landed', '--brief', world.brief, '--worktree', 'landed']).code, 0);
  const landed = landWorktree(world, 'landed');
  said(world, '0db8bc5e', 'closed');
  const acted = actions(world).length;
  for (const args of [['0db8bc5e', '--finished'], ['--finished', '--remove-worktree'], ['--finished', '--finished']]) assert.equal(js(world, ['sessions', 'stop', ...args]).code, 2, args.join(' '));
  const noClaude = spawnSync(process.execPath, [BIN, 'sessions', 'stop', '--finished'], { cwd: world.project, env: { ...envOf(world), PATH: emptyDir(world) }, encoding: 'utf8' });
  assert.equal(noClaude.status, 1);
  assert.match(noClaude.stderr, /js-harness sessions stop: claude is not on PATH/);
  // Whether a session is at work is claude's to say: a listing that fails closes nothing.
  patchState(world, { agentsFail: 'agents: made up' });
  const blind = js(world, ['sessions', 'stop', '--finished']);
  assert.equal(blind.code, 1);
  assert.match(blind.stderr, /whether a session is at work cannot be told \(.*made up.*\), so nothing was closed/s);
  patchState(world, { agentsFail: undefined });
  // With no finished session there is nothing to say but that.
  fs.rmSync(channelFile(world));
  const none = js(world, ['sessions', 'stop', '--finished']);
  assert.equal(none.code, 0, none.stderr);
  assert.match(none.stdout, /no finished background session of this project is on the machine/);
  assert.equal(actions(world).length, acted);
  assert.equal(fs.existsSync(landed), true);
}));

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

// claude rm deletes a worktree's files even when it says it refused (2026-11-04), and the uninstall reached it with no
// look at the worktree (the Fable 5.2 audit, H1: odd/tasks/uninstall-keeps-worktree.md).
test('uninstall machine keeps a resting session whose worktree holds files, runs no claude on it and fails until it is settled', withWorld((world) => {
  assert.equal(js(world, ['sessions', 'start', '--title', 'Held', '--brief', world.brief, '--worktree', 'held']).code, 0);
  patchState(world, { nextId: 'c779ed44' });
  assert.equal(js(world, ['sessions', 'start', '--title', 'Bare', '--brief', world.brief, '--worktree', 'bare']).code, 0);
  const held = path.join(world.project, '.claude', 'worktrees', 'held');
  fs.writeFileSync(path.join(held, '.git'), 'gitdir: elsewhere\n');
  fs.mkdirSync(path.join(held, 'src'));
  fs.writeFileSync(path.join(held, 'src', 'work.js'), 'uncommitted\n');
  fs.writeFileSync(path.join(world.project, '.claude', 'worktrees', 'bare', '.git'), 'gitdir: elsewhere\n');
  const state = readState(world);
  for (const agent of state.agents) [agent.status, agent.state] = ['idle', 'done'];
  writeState(world, state);
  const { brief } = recordLines(world)[0];
  const first = js(world, ['uninstall', 'machine', '--home', world.home]);
  assert.equal(first.code, 1, first.stdout);
  assert.ok(!actions(world).some((call) => call[1] === '0db8bc5e'), 'no claude stop, no claude rm on the held one');
  assert.equal(fs.readFileSync(path.join(held, 'src', 'work.js'), 'utf8'), 'uncommitted\n');
  assert.ok(fs.existsSync(brief), 'its brief stays');
  assert.ok(first.stderr.includes(`kept background session 0db8bc5e · Held: its worktree ${held} holds files (src)`), first.stderr);
  assert.match(first.stderr, /js-harness sessions stop 0db8bc5e --remove-worktree removes it with its worktree, then run js-harness uninstall machine again/);
  assert.match(first.stdout, /removed background session c779ed44 · Bare/);
  assert.ok(fs.existsSync(recordFile(world)), 'the record stays while a session is kept');
  // Settled the way the line says, the next uninstall ends.
  assert.equal(js(world, ['sessions', 'stop', '0db8bc5e', '--remove-worktree']).code, 0);
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

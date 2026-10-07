import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionsMain } from './sessions.mjs';
import { NOT_VISIBLE, projectSlug, sessionFacts } from './lib/sessions.mjs';

// Every session below is a synthetic transcript in a temp folder: the command is pointed at it with
// `--claude-home` and `--tmp`, and `git`, `gh` and the process listing are fakes, so no test reads this
// machine's sessions, repository or processes.

const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const before = (seconds) => new Date(NOW - seconds * 1000);
const SESSION_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const SESSION_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const SESSION_C = 'cccccccc-3333-4333-8333-333333333333';

const entry = (seconds) => ({ timestamp: before(seconds).toISOString(), cwd: 'C:\\proj', gitBranch: 'main', isSidechain: false });
const prompt = (text, seconds) => ({ type: 'user', ...entry(seconds), origin: { kind: 'human' }, message: { role: 'user', content: text } });
const reply = (text, seconds) => ({ type: 'assistant', ...entry(seconds), message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text }] } });
const call = (id, name, input, seconds) => ({ type: 'assistant', ...entry(seconds), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] } });
const result = (id, toolUseResult, seconds) => ({ type: 'user', ...entry(seconds), toolUseResult, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const jsonl = (...entries) => entries.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n') + '\n';

/** A temp folder laid out like a machine: a Claude home with the project's sessions folder, a temp
 * root for task outputs, and the paths of a main checkout and one linked worktree (names only: no
 * repository exists, `git` is a fake). */
function makeMachine() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-sessions-'));
  const root = path.join(dir, 'proj');
  const machine = { dir, root, worktree: path.join(dir, 'proj-worktrees', 'board'), home: path.join(dir, 'claude-home'), tmp: path.join(dir, 'tmp'), slug: projectSlug(root) };
  machine.projectDir = path.join(machine.home, 'projects', machine.slug);
  fs.mkdirSync(machine.projectDir, { recursive: true });
  return machine;
}

/** Writes `content` at `file` and dates its last write `seconds` before NOW. */
function writeAt(file, content, seconds) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  fs.utimesSync(file, before(seconds), before(seconds));
}

/** Three sessions: A ended its turn with a shell and a subagent still open, B is in the middle of a
 * foreground subagent and has a shell whose output file is gone, C last changed thirteen hours ago. */
function writeSessions(machine) {
  const { projectDir, tmp, slug } = machine;
  writeAt(
    path.join(projectDir, `${SESSION_A}.jsonl`),
    jsonl(
      { type: 'custom-title', customTitle: 'Board feature', sessionId: SESSION_A },
      prompt('build the board', 900),
      call('toolu_a1', 'Bash', { command: 'npm run check', description: 'Run the gate', run_in_background: true }, 800),
      result('toolu_a1', { stdout: '', backgroundTaskId: 'b1' }, 800),
      call('toolu_a2', 'Agent', { description: 'Research the format', subagent_type: 'Explore', prompt: 'made up' }, 700),
      result('toolu_a2', { isAsync: true, status: 'async_launched', agentId: 'a1' }, 700),
      reply('Both are still running.\n\nNext prompt:\n```\ncontinue\n```', 60),
    ),
    60,
  );
  writeAt(path.join(tmp, 'claude', slug, SESSION_A, 'tasks', 'b1.output'), 'made up output', 30);
  writeAt(path.join(projectDir, SESSION_A, 'subagents', 'agent-a1.jsonl'), '{}\n', 10);

  writeAt(
    path.join(projectDir, `${SESSION_B}.jsonl`),
    jsonl(
      prompt('fix the review', 9000),
      call('toolu_b1', 'Bash', { command: 'node --test', description: 'Run the tests', run_in_background: true }, 8000),
      result('toolu_b1', { stdout: '', backgroundTaskId: 'b7' }, 8000),
      call('toolu_b2', 'Agent', { description: 'Write the fix', subagent_type: 'general-purpose', run_in_background: false, prompt: 'made up' }, 7200),
      '{"type":"assistant","message":{"content":[{"type":"te',
    ),
    7200,
  );
  writeAt(path.join(projectDir, SESSION_B, 'subagents', 'agent-a9.meta.json'), JSON.stringify({ agentType: 'general-purpose', toolUseId: 'toolu_b2' }), 7200);
  writeAt(path.join(projectDir, SESSION_B, 'subagents', 'agent-a9.jsonl'), '{}\n', 45);
  writeAt(path.join(projectDir, SESSION_B, 'subagents', 'agent-a8.meta.json'), JSON.stringify({ agentType: 'Explore', toolUseId: 'toolu_other' }), 7200);

  writeAt(path.join(projectDir, `${SESSION_C}.jsonl`), jsonl(prompt('an older session', 13 * 3600), reply('done', 13 * 3600)), 13 * 3600);
}

const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
const slashes = (somePath) => somePath.replace(/\\/g, '/');

/** A fake `run` for a machine: `git` answers as the repository of `machine.root` with its one linked
 * worktree, `gh` lists one pull request. `answers` replaces a command's answer by its first word after
 * the program (`rev-parse`, `worktree`, `pr`, ...). Every call is recorded in `calls`. */
function fakeRun(machine, answers = {}) {
  const calls = [];
  const defaults = {
    'rev-parse': () => ok(`${slashes(machine.root)}/.git\n`),
    worktree: () => ok([`worktree ${slashes(machine.root)}`, 'HEAD 1111111111111111111111111111111111111111', 'branch refs/heads/main', '', `worktree ${slashes(machine.worktree)}`, 'HEAD 2222222222222222222222222222222222222222', 'branch refs/heads/feat/board', ''].join('\n')),
    'rev-list': (args) => ok(args.includes('origin/main..HEAD') ? '3\n' : '1\n'),
    status: () => ok(' M bin/a.mjs\n'),
    pr: () => ok(JSON.stringify([{ number: 41, title: 'feat: session board', headRefName: 'feat/board' }])),
  };
  const run = (command, args, options = {}) => {
    calls.push({ command, args, cwd: options.cwd });
    const word = args.find((arg) => !arg.startsWith('-'));
    const answer = answers[word] ?? answers[command] ?? defaults[word];
    if (!answer) throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
    return answer(args, options);
  };
  return { run, calls };
}

/** Runs `sessionsMain` on a machine, from its linked worktree, capturing what it writes. */
async function runSessions(machine, argv, deps = {}) {
  const out = [];
  const err = [];
  const code = await sessionsMain(['--claude-home', machine.home, '--tmp', machine.tmp, ...argv], {
    cwd: machine.worktree,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    now: () => NOW,
    run: fakeRun(machine).run,
    listProcesses: () => [],
    ...deps,
  });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

function withMachine(body) {
  return async () => {
    const machine = makeMachine();
    try {
      await body(machine);
    } finally {
      fs.rmSync(machine.dir, { recursive: true, force: true });
    }
  };
}

// --- usage ---

const USAGE_ERRORS = [
  ['--hours'], ['--hours', 'soon'], ['--hours', '0'], ['--tail', '-1'], ['--tail', '1.5'], ['--claude-home'], ['--tmp', '--json'], ['--bogus'], ['extra'],
  // R3-args-prototype-keys: a name every object inherits is not a flag, and an empty value is not a number
  // (`Number('')` is 0) nor a path.
  ['constructor', 'x'], ['toString', 'x'], ['hasOwnProperty', 'x'], ['__proto__', 'x'],
  ['--tail', ''], ['--tail', ' '], ['--tail', '0x2'], ['--hours', ''], ['--hours', ' '], ['--hours', '1e1'], ['--cwd', ''], ['--claude-home', ''], ['--tmp', ''],
];

for (const argv of USAGE_ERRORS) {
  test(`sessionsMain exits 2 with its usage on stderr for ${JSON.stringify(argv)}`, async () => {
    const out = [];
    const err = [];
    const neverRun = () => {
      throw new Error('a usage error must not run anything');
    };
    const code = await sessionsMain(argv, { stdout: (line) => out.push(line), stderr: (line) => err.push(line), run: neverRun, listProcesses: neverRun });
    assert.equal(code, 2);
    assert.deepEqual(out, []);
    assert.match(err.join('\n'), /Usage: js-harness sessions/);
  });
}

// --- where the sessions are ---

test('sessionsMain exits 1 with one line naming the folder when the project has no sessions folder, and looks at nothing else', withMachine(async (machine) => {
  fs.rmSync(machine.projectDir, { recursive: true });
  const fake = fakeRun(machine);
  const { code, stdout, stderr } = await runSessions(machine, [], {
    run: fake.run,
    listProcesses: () => {
      throw new Error('must not list processes');
    },
  });
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.equal(stderr, `js-harness sessions: no sessions folder for ${machine.root}: ${machine.projectDir} (ENOENT)`);
  assert.deepEqual(fake.calls.map((made) => made.args[0]), ['rev-parse']);
}));

test('sessionsMain finds the sessions of the main checkout when it runs in a linked worktree', withMachine(async (machine) => {
  writeSessions(machine);
  const fake = fakeRun(machine);
  const { code, stdout } = await runSessions(machine, ['--json'], { run: fake.run });
  assert.equal(code, 0);
  const board = JSON.parse(stdout);
  assert.equal(board.root, machine.root);
  assert.equal(board.projectDir, machine.projectDir);
  assert.deepEqual({ command: fake.calls[0].command, args: fake.calls[0].args, cwd: fake.calls[0].cwd }, { command: 'git', args: ['rev-parse', '--git-common-dir'], cwd: machine.worktree });
}));

test('sessionsMain resolves a relative common dir against the folder it runs in', withMachine(async (machine) => {
  writeSessions(machine);
  const { run } = fakeRun(machine, { 'rev-parse': () => ok('.git\n') });
  const { code, stdout } = await runSessions(machine, ['--json', '--cwd', machine.root], { run });
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).root, machine.root);
}));

test('outside a git repository the folder itself is the project, and the git facts are unavailable with the reason', withMachine(async (machine) => {
  writeSessions(machine);
  const notARepository = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' });
  const { run } = fakeRun(machine, { 'rev-parse': notARepository, worktree: notARepository });
  const { code, stdout } = await runSessions(machine, ['--json', '--cwd', machine.root], { run });
  assert.equal(code, 0);
  const board = JSON.parse(stdout);
  assert.equal(board.root, machine.root);
  assert.equal(board.sessions.length, 2);
  assert.deepEqual(board.worktrees, { available: false, reason: 'git worktree: fatal: not a git repository (or any of the parent directories): .git' });
}));

test('without --claude-home the sessions are under CLAUDE_CONFIG_DIR, or under .claude in the home folder', withMachine(async (machine) => {
  writeSessions(machine);
  const deps = { cwd: machine.worktree, stdout: () => {}, stderr: () => {}, now: () => NOW, run: fakeRun(machine).run, listProcesses: () => [], tmpdir: () => machine.tmp };
  assert.equal(await sessionsMain(['--json'], { ...deps, env: { CLAUDE_CONFIG_DIR: machine.home }, homedir: () => path.join(machine.dir, 'nobody') }), 0);
  assert.equal(await sessionsMain(['--json'], { ...deps, env: {}, homedir: () => path.join(machine.dir, 'nobody') }), 1);
  fs.renameSync(machine.home, path.join(machine.dir, '.claude'));
  assert.equal(await sessionsMain(['--json'], { ...deps, env: {}, homedir: () => machine.dir }), 0);
}));

// --- the board as data ---

test('--json lists the sessions that changed in the window, most recent first, with their state and facts', withMachine(async (machine) => {
  writeSessions(machine);
  const { code, stdout, stderr } = await runSessions(machine, ['--json']);
  assert.equal(code, 0);
  assert.equal(stderr, '');
  const board = JSON.parse(stdout);
  assert.equal(board.hours, 12);
  assert.equal(board.generatedAt, new Date(NOW).toISOString());
  assert.deepEqual(board.sessions.map((session) => [session.id, session.state, session.title, session.titleSource]), [
    [SESSION_A, 'background', 'Board feature', 'custom-title'],
    [SESSION_B, 'working', 'fix the review', 'first-prompt'],
  ]);
  const [a, b] = board.sessions;
  assert.equal(a.lastEntryAt, before(60).toISOString());
  assert.equal(a.modifiedAt, before(60).toISOString());
  assert.deepEqual([a.cwd, a.gitBranch], ['C:\\proj', 'main']);
  assert.deepEqual(a.tail, ['```', 'continue', '```']);
  assert.equal(b.skippedLines, 1);
  assert.equal(board.notVisible, NOT_VISIBLE);
}));

test('--hours widens the window', withMachine(async (machine) => {
  writeSessions(machine);
  const { stdout } = await runSessions(machine, ['--json', '--hours', '24']);
  assert.deepEqual(JSON.parse(stdout).sessions.map((session) => session.id), [SESSION_A, SESSION_B, SESSION_C]);
  const narrow = await runSessions(machine, ['--json', '--hours', '0.5']);
  assert.deepEqual(JSON.parse(narrow.stdout).sessions.map((session) => session.id), [SESSION_A]);
}));

test('work with no recorded end carries the last write of its file: a shell\'s output, a subagent\'s transcript', withMachine(async (machine) => {
  writeSessions(machine);
  const { stdout } = await runSessions(machine, ['--json']);
  const [a, b] = JSON.parse(stdout).sessions;
  assert.deepEqual(a.work.map((work) => [work.tool, work.id, work.ended, work.file]), [
    ['Bash', 'b1', false, { path: path.join(machine.tmp, 'claude', machine.slug, SESSION_A, 'tasks', 'b1.output'), modifiedAt: before(30).toISOString() }],
    ['Agent', 'a1', false, { path: path.join(machine.projectDir, SESSION_A, 'subagents', 'agent-a1.jsonl'), modifiedAt: before(10).toISOString() }],
  ]);
  // B's shell output is gone, and its subagent has no id in the transcript yet: the meta file that names
  // the tool call gives the subagent's transcript.
  assert.deepEqual(b.work.map((work) => [work.tool, work.id, work.file]), [
    ['Bash', 'b7', { path: path.join(machine.tmp, 'claude', machine.slug, SESSION_B, 'tasks', 'b7.output'), unavailable: 'ENOENT' }],
    ['Agent', null, { path: path.join(machine.projectDir, SESSION_B, 'subagents', 'agent-a9.jsonl'), modifiedAt: before(45).toISOString() }],
  ]);
}));

test('a subagent no meta file names, and a shell whose task id is not written yet, have no file and say why', withMachine(async (machine) => {
  writeAt(
    path.join(machine.projectDir, `${SESSION_A}.jsonl`),
    jsonl(prompt('go', 100), call('toolu_1', 'Agent', { description: 'Look', prompt: 'made up' }, 90), call('toolu_2', 'Bash', { command: 'x', description: 'Run', run_in_background: true }, 80)),
    80,
  );
  const { stdout } = await runSessions(machine, ['--json']);
  assert.deepEqual(JSON.parse(stdout).sessions[0].work.map((work) => work.file), [
    { unavailable: 'no subagent file of the session names this tool call' },
    { unavailable: 'the transcript does not record its task id yet' },
  ]);
}));

test('a transcript that cannot be read is listed as unavailable with the reason, and the board is still printed', withMachine(async (machine) => {
  writeSessions(machine);
  const readFile = (file) => {
    if (file.endsWith(`${SESSION_A}.jsonl`)) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
    return fs.readFileSync(file, 'utf8');
  };
  const { code, stdout } = await runSessions(machine, ['--json'], { readFile });
  assert.equal(code, 0);
  const board = JSON.parse(stdout);
  assert.deepEqual(board.sessions[0], { id: SESSION_A, modifiedAt: before(60).toISOString(), unavailable: 'EBUSY' });
  assert.equal(board.sessions[1].id, SESSION_B);
}));

// R3-stat-race-branch-untested: a session can remove or lock its transcript between the listing and the stat.
test('a transcript whose date cannot be read after it was listed is on the board as unavailable, after the dated ones', withMachine(async (machine) => {
  writeSessions(machine);
  const stat = (file) => {
    if (file.endsWith(`${SESSION_A}.jsonl`)) throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
    return fs.statSync(file);
  };
  const data = await runSessions(machine, ['--json'], { stat });
  assert.equal(data.code, 0);
  const board = JSON.parse(data.stdout);
  assert.deepEqual(board.sessions.map((session) => session.id), [SESSION_B, SESSION_A]);
  assert.deepEqual(board.sessions[1], { id: SESSION_A, modifiedAt: null, unavailable: 'ENOENT' });

  const text = await runSessions(machine, [], { stat });
  assert.equal(text.code, 0);
  const lines = text.stdout.split('\n');
  const [dated, undated, worktrees] = [lines.findIndex((line) => line.startsWith('bbbbbbbb  working')), lines.indexOf('aaaaaaaa  unavailable: ENOENT'), lines.indexOf('Worktrees')];
  assert.ok(dated !== -1 && dated < undated && undated < worktrees, text.stdout);
  assert.equal(lines[0], `Sessions  ${machine.root}  2 changed in the last 12h`);
}));

// R3-facts-throw-kills-board: no shape of transcript is known to make the reader throw, so one is handed in.
test('a transcript the reader cannot turn into facts is listed as unavailable with the reason, and the others are printed', withMachine(async (machine) => {
  writeSessions(machine);
  const readFacts = (text, options) => {
    if (text.includes('Board feature')) throw new TypeError('boom at entry 3');
    return sessionFacts(text, options);
  };
  const data = await runSessions(machine, ['--json'], { readFacts });
  assert.equal(data.code, 0);
  const board = JSON.parse(data.stdout);
  assert.deepEqual(board.sessions[0], { id: SESSION_A, modifiedAt: before(60).toISOString(), unavailable: 'its transcript could not be read into facts: boom at entry 3' });
  assert.deepEqual([board.sessions[1].id, board.sessions[1].state], [SESSION_B, 'working']);
  const text = await runSessions(machine, [], { readFacts });
  assert.equal(text.code, 0);
  assert.ok(text.stdout.split('\n').includes('aaaaaaaa  unavailable: its transcript could not be read into facts: boom at entry 3'), text.stdout);
}));

// T3c: the work of a resumed subagent has the subagent's transcript as its file.
test('a subagent that was sent a follow-up is open work again, with the last write of its transcript', withMachine(async (machine) => {
  writeAt(
    path.join(machine.projectDir, `${SESSION_A}.jsonl`),
    jsonl(
      prompt('build the board', 900),
      call('toolu_a', 'Agent', { description: 'Write the code', subagent_type: 'general-purpose', prompt: 'made up' }, 800),
      result('toolu_a', { isAsync: true, status: 'async_launched', agentId: 'a1' }, 800),
      { type: 'user', ...entry(600), origin: { kind: 'task-notification' }, message: { role: 'user', content: '<task-notification>\n<task-id>a1</task-id>\n<tool-use-id>toolu_a</tool-use-id>\n<status>completed</status>\n</task-notification>' } },
      reply('The code is written.', 590),
      call('toolu_s', 'SendMessage', { to: 'a1', recipient: 'a1', type: 'message', summary: 'Fix the findings', message: 'made up', content: 'made up' }, 120),
      result('toolu_s', { success: true, message: 'Resuming agent a1', resumedAgentId: 'a1', pin: {} }, 120),
      reply('It is fixing them.', 100),
    ),
    100,
  );
  writeAt(path.join(machine.projectDir, SESSION_A, 'subagents', 'agent-a1.jsonl'), '{}\n', 5);
  const data = await runSessions(machine, ['--json']);
  const [session] = JSON.parse(data.stdout).sessions;
  assert.equal(session.state, 'background');
  assert.deepEqual(session.work.map((work) => [work.id, work.resumed, work.ended, work.file]), [
    ['a1', false, true, undefined],
    ['a1', true, false, { path: path.join(machine.projectDir, SESSION_A, 'subagents', 'agent-a1.jsonl'), modifiedAt: before(5).toISOString() }],
  ]);
  const text = await runSessions(machine, []);
  assert.ok(text.stdout.split('\n').includes('    Agent a1 (general-purpose, resumed) "Fix the findings"  launched 2m ago  file written 5s ago'), text.stdout);
  assert.ok(text.stdout.includes('  work: 1 with no recorded end, 1 ended (last: Agent "Write the code" completed 10m ago)'), text.stdout);
}));

test('the machine facts are on the board: worktrees with their counts, running gates, open pull requests', withMachine(async (machine) => {
  writeSessions(machine);
  const listProcesses = () => [{ pid: 4242, createdAt: NOW - 180000, commandLine: `node "${slashes(machine.worktree)}/bin/check.mjs"` }];
  const { stdout } = await runSessions(machine, ['--json'], { listProcesses });
  const board = JSON.parse(stdout);
  assert.deepEqual(board.worktrees.items.map((tree) => [tree.path, tree.branch, tree.aheadOfMain, tree.aheadOfUpstream, tree.changed]), [
    [slashes(machine.root), 'main', 3, 1, 1],
    [slashes(machine.worktree), 'feat/board', 3, 1, 1],
  ]);
  assert.deepEqual(board.gates, { available: true, items: [{ pid: 4242, startedAt: before(180).toISOString(), worktree: slashes(machine.worktree), commandLine: `node "${slashes(machine.worktree)}/bin/check.mjs"` }] });
  assert.deepEqual(board.pullRequests, { available: true, items: [{ number: 41, title: 'feat: session board', branch: 'feat/board' }] });
}));

test('a machine fact that cannot be read is unavailable with its reason, and the exit code is still 0', withMachine(async (machine) => {
  writeSessions(machine);
  const { run } = fakeRun(machine, { pr: () => ({ status: null, stdout: '', stderr: '', error: Object.assign(new Error('spawnSync gh ENOENT'), { code: 'ENOENT' }) }) });
  const listProcesses = () => {
    throw new Error('powershell could not run');
  };
  const { code, stdout } = await runSessions(machine, ['--json'], { run, listProcesses });
  assert.equal(code, 0);
  const board = JSON.parse(stdout);
  assert.deepEqual(board.pullRequests, { available: false, reason: 'gh pr: gh is not installed or not on PATH' });
  assert.deepEqual(board.gates, { available: false, reason: 'the process listing: powershell could not run' });
}));

// --- the process listing the command runs when none is handed in ---

test('on Windows the gates come from one PowerShell listing, and a listing that fails is a reason, not "none"', withMachine(async (machine) => {
  writeSessions(machine);
  const listing = ['4242\t1\t1767268620000\tnode.exe', `C\t4242\tnode ${slashes(machine.root)}/bin/check.mjs`, 'OK\t1', ''].join('\r\n');
  const working = fakeRun(machine, { powershell: () => ok(listing) });
  const found = await runSessions(machine, ['--json'], { run: working.run, listProcesses: undefined, platform: 'win32' });
  assert.deepEqual(JSON.parse(found.stdout).gates.items.map((gate) => [gate.pid, gate.worktree, gate.startedAt]), [[4242, slashes(machine.root), '2026-01-01T11:57:00.000Z']]);
  const asked = working.calls.find((made) => made.command === 'powershell');
  assert.deepEqual(asked.args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-EncodedCommand']);
  const script = Buffer.from(asked.args[3], 'base64').toString('utf16le');
  assert.match(script, /Get-CimInstance Win32_Process/);
  // R3-end-marker-not-final: the marker carries the number of command lines written, which is what the
  // parser compares it with; it is the last thing the script prints.
  assert.match(script, /\$written \+= 1\r?\n/);
  assert.match(script, /'OK' \+ \[char\]9 \+ \$written\r?\n\} catch/);

  const lost = fakeRun(machine, { powershell: () => ok('4242\t1\t1767268620000\tnode.exe\r\nOK\t1\r\n') });
  const short = await runSessions(machine, ['--json'], { run: lost.run, listProcesses: undefined, platform: 'win32' });
  assert.deepEqual(JSON.parse(short.stdout).gates, { available: false, reason: 'the process listing: the listing announces 1 command lines and holds 0' });

  const failing = fakeRun(machine, { powershell: () => ({ status: 1, stdout: '', stderr: 'Access denied\r\n' }) });
  const failed = await runSessions(machine, ['--json'], { run: failing.run, listProcesses: undefined, platform: 'win32' });
  assert.deepEqual(JSON.parse(failed.stdout).gates, { available: false, reason: 'the process listing: Access denied' });

  const cut = fakeRun(machine, { powershell: () => ok('4242\t1\t1767268620000\tnode.exe\r\n') });
  const half = await runSessions(machine, ['--json'], { run: cut.run, listProcesses: undefined, platform: 'win32' });
  assert.deepEqual(JSON.parse(half.stdout).gates, { available: false, reason: 'the process listing: the listing did not finish' });
}));

test('elsewhere the gates come from ps, which gives no start time', withMachine(async (machine) => {
  writeSessions(machine);
  const fake = fakeRun(machine, { ps: () => ok(`  812 node ${slashes(machine.root)}/bin/check.mjs\n    9 /sbin/init\n`) });
  const { stdout } = await runSessions(machine, ['--json'], { run: fake.run, listProcesses: undefined, platform: 'linux' });
  assert.deepEqual(JSON.parse(stdout).gates.items.map((gate) => [gate.pid, gate.startedAt]), [[812, { unavailable: 'the process listing gave no start time' }]]);
  assert.deepEqual(fake.calls.find((made) => made.command === 'ps').args, ['-A', '-o', 'pid=,args=']);
}));

// --- the board as text ---

test('the text board prints each session with its state, its open work and the tail of its last reply, then the machine', withMachine(async (machine) => {
  writeSessions(machine);
  const { code, stdout } = await runSessions(machine, []);
  assert.equal(code, 0);
  const lines = stdout.split('\n');
  assert.equal(lines[0], `Sessions  ${machine.root}  2 changed in the last 12h`);
  const at = (text) => {
    const index = lines.indexOf(text);
    assert.notEqual(index, -1, `no line ${JSON.stringify(text)} in:\n${stdout}`);
    return index;
  };
  const order = [
    at('aaaaaaaa  background  Board feature  last entry 1m ago'),
    at('  work: 2 with no recorded end, 0 ended'),
    at('    Bash b1 "Run the gate"  launched 13m ago  file written 30s ago'),
    at('    Agent a1 (Explore) "Research the format"  launched 11m ago  file written 10s ago'),
    at('  | ```'),
    at('  | continue'),
    at('bbbbbbbb  working  fix the review  last entry 2h 00m ago'),
    at('    Bash b7 "Run the tests"  launched 2h 13m ago  file unavailable: ENOENT'),
    at('    Agent (no id yet) (general-purpose) "Write the fix"  launched 2h 00m ago  file written 45s ago'),
    at('  1 transcript line skipped: it did not parse'),
    at('Worktrees'),
    at(`  ${slashes(machine.worktree)}  feat/board  2222222  3 not on origin/main, 1 not pushed, 1 changed`),
    at('Gates'),
    at('  none running'),
    at('Pull requests'),
    at('  #41  feat: session board  (feat/board)'),
    at(NOT_VISIBLE),
  ];
  assert.deepEqual(order, [...order].sort((x, y) => x - y), 'the lines come in that order');
  assert.equal(lines.at(-1), NOT_VISIBLE);
}));

test('--tail sets how many lines of the last reply are printed', withMachine(async (machine) => {
  writeSessions(machine);
  const one = await runSessions(machine, ['--tail', '1']);
  assert.deepEqual(one.stdout.split('\n').filter((line) => line.startsWith('  | ')), ['  | ```']);
  const none = await runSessions(machine, ['--tail', '0', '--json']);
  assert.deepEqual(JSON.parse(none.stdout).sessions[0].tail, []);
  const five = await runSessions(machine, ['--tail', '5', '--json']);
  assert.deepEqual(JSON.parse(five.stdout).sessions[0].tail, ['Both are still running.', 'Next prompt:', '```', 'continue', '```']);
}));

// --- read-only ---

test('sessionsMain writes nothing: every file of the machine is as it was', withMachine(async (machine) => {
  writeSessions(machine);
  const snapshot = () =>
    fs
      .readdirSync(machine.dir, { recursive: true })
      .sort()
      .map((name) => {
        const info = fs.statSync(path.join(machine.dir, name));
        return [name, info.isFile() ? info.size : 'dir', info.isFile() ? info.mtimeMs : null];
      });
  const was = snapshot();
  await runSessions(machine, []);
  await runSessions(machine, ['--json', '--hours', '24']);
  assert.deepEqual(snapshot(), was);
}));

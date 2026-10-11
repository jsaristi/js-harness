import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lockLibraryBesideScript, sessionsMain } from './sessions.mjs';
import { NOT_VISIBLE, ROSTER_NOT_KNOWN, projectSlug, sessionFacts } from './lib/sessions.mjs';

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
  const machine = { dir, root, worktree: path.join(dir, 'proj-worktrees', 'board'), home: path.join(dir, 'claude-home'), userHome: path.join(dir, 'user-home'), tmp: path.join(dir, 'tmp'), slug: projectSlug(root) };
  machine.projectDir = path.join(machine.home, 'projects', machine.slug);
  machine.relief = path.join(machine.userHome, '.js-harness', 'relief', `${machine.slug}.md`);
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
      { ...reply('Both are still running.\n\nNext prompt:\n```\ncontinue\n```', 60), message: { role: 'assistant', model: 'model-x', stop_reason: 'end_turn', usage: { input_tokens: 12, cache_read_input_tokens: 12000, cache_creation_input_tokens: 388, output_tokens: 40 }, content: [{ type: 'text', text: 'Both are still running.\n\nNext prompt:\n```\ncontinue\n```' }] } },
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
    diff: () => ok(''),
    'ls-files': () => ok(''),
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
    env: {}, // never this machine's: CLAUDE_CODE_SESSION_ID is set in every shell a session opens
    homedir: () => machine.userHome, // nor this machine's home: the relief file is looked for under it
    run: fakeRun(machine).run,
    listProcesses: () => [],
    ...deps,
  });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

function withMachine(body) {
  return async (t) => {
    const machine = makeMachine();
    try {
      await body(machine, t);
    } finally {
      fs.rmSync(machine.dir, { recursive: true, force: true });
    }
  };
}

// --- usage ---

const HUGE = '9'.repeat(400); // plain digits that `Number` reads as Infinity
const USAGE_ERRORS = [
  ['--hours'], ['--hours', 'soon'], ['--hours', '0'], ['--tail', '-1'], ['--tail', '1.5'], ['--claude-home'], ['--tmp', '--json'], ['--bogus'], ['extra'],
  // R3-args-prototype-keys: a name every object inherits is not a flag, and an empty value is not a number
  // (`Number('')` is 0) nor a path.
  ['constructor', 'x'], ['toString', 'x'], ['hasOwnProperty', 'x'], ['__proto__', 'x'],
  ['--tail', ''], ['--tail', ' '], ['--tail', '0x2'], ['--hours', ''], ['--hours', ' '], ['--hours', '1e1'], ['--cwd', ''], ['--claude-home', ''], ['--tmp', ''],
  // T5: the context limit is a whole number of tokens above zero.
  ['--context-limit'], ['--context-limit', '0'], ['--context-limit', '1.5'], ['--context-limit', 'big'],
  // T5: the waits of a watch are numbers above zero and mean nothing without it; --self is an id or its start.
  ['--watch', '--interval'], ['--watch', '--interval', '0'], ['--watch', '--interval', 'soon'], ['--watch', '--timeout', '0'], ['--watch', '--timeout', '-5'],
  ['--interval', '5'], ['--timeout', '5'], ['--timeout', '5', '--json'], ['--self'], ['--self', 'abc'], ['--watch', '--self', ''],
  // R3-watch-wait-upper-bound: a wait above what a Node timer takes fires after a millisecond, and digits
  // enough to parse as Infinity are not a number of anything.
  ['--watch', '--interval', '2147484'], ['--watch', '--timeout', '2147484'], ['--watch', '--interval', HUGE], ['--watch', '--timeout', HUGE],
  ['--hours', HUGE], ['--tail', HUGE], ['--context-limit', HUGE], ['--context-limit', `${HUGE}%`], ['--context-window', HUGE],
  // T5b: the window is a whole number of tokens above zero; the limit is that, or a percentage of the window up to 100.
  ['--context-window'], ['--context-window', '0'], ['--context-window', '1.5'], ['--context-window', 'big'], ['--context-window', '50%'],
  ['--context-limit', '0%'], ['--context-limit', '101%'], ['--context-limit', '100.5%'], ['--context-limit', '%'], ['--context-limit', '73%%'], ['--context-limit', '-5%'], ['--context-limit', '7 %'],
  // T6: the relief file is a path like the others.
  ['--relief'], ['--relief', ''], ['--relief', '--json'],
  // Session channel, T4a: --address takes a role, and answers with a title: no board to watch or to give as data.
  ['--address'], ['--address', ''], ['--address', 'boss'], ['--address', '5.5'], ['--address', 'JH 5'], ['--address', '--json'], ['--address', HUGE],
  ['--address', 'orchestrator', '--json'], ['--address', '5', '--watch'], ['--watch', '--address', 'ORQ'],
];

/** A usage case as the name of its test says it: its arguments, a long run of digits as its length, so
 * the name stays short without losing what comes after the digits. */
const usageName = (argv) => JSON.stringify(argv).replace(/\d{20,}/g, (digits) => `<${digits.length} digits>`);

// R3-usage-error-test-names-collide: a failure names its case, so two cases cannot share a name.
test('every usage case has its own test name', () => {
  const names = USAGE_ERRORS.map(usageName);
  assert.deepEqual(names.filter((name, index) => names.indexOf(name) !== index), []);
});

for (const argv of USAGE_ERRORS) {
  test(`sessionsMain exits 2 with its usage on stderr for ${usageName(argv)}`, async () => {
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

test('the usage says what --address takes and what each of its three exits means, as the dispatcher\'s help does', async () => {
  const err = [];
  assert.equal(await sessionsMain(['--address'], { stdout: () => {}, stderr: (line) => err.push(line) }), 2);
  assert.match(err.join('\n'), /--address orchestrator\|<number>[\s\S]*exit 0 for one,\s+1 for none with every transcript read,\s+2 for several or when it cannot tell/);
});

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

// Codex review of 764c9b0, finding 4: the checkout was taken to be the folder that holds the common git
// dir, or that dir itself when it is not named `.git`, which is the case of a submodule and of a checkout
// made with `--separate-git-dir`: the board then looked for the sessions of the git dir and found none.

const NO_WORK_TREE = () => ({ status: 128, stdout: '', stderr: 'fatal: this operation must be run in a work tree\n' });

/** A fake `git rev-parse` for a repository whose git dir is `commonDir`, away from its checkout
 * `machine.root`, with `machine.worktree` linked to it. It answers as git 2.54 did on 2026-10-09 in real
 * repositories of each layout: `--git-common-dir` is `commonDir` from anywhere; in the git dir itself
 * `--show-toplevel` is the working tree it records (`recorded`, which a submodule's has and a
 * `--separate-git-dir` one has not) or a failure; in a working tree it is that tree's top, and `--git-dir`
 * is `commonDir` in the main one and a folder under its `worktrees` in a linked one. */
function gitDirApart(machine, commonDir, { recorded = null } = {}) {
  return (args, { cwd }) => {
    if (args.includes('--git-common-dir')) return ok(`${commonDir}\n`);
    if (slashes(cwd) === commonDir) return recorded === null ? NO_WORK_TREE() : ok(`${recorded}\n`);
    const gitDir = slashes(cwd) === slashes(machine.worktree) ? `${commonDir}/worktrees/board` : commonDir;
    return ok([...(args.includes('--git-dir') ? [gitDir] : []), ...(args.includes('--show-toplevel') ? [slashes(cwd)] : [])].join('\n') + '\n');
  };
}

test('a checkout made with --separate-git-dir is the project, not the git dir kept elsewhere', withMachine(async (machine) => {
  writeSessions(machine);
  const fake = fakeRun(machine, { 'rev-parse': gitDirApart(machine, `${slashes(machine.dir)}/meta`) });
  const { code, stdout, stderr } = await runSessions(machine, ['--json', '--cwd', machine.root], { run: fake.run });
  assert.deepEqual([code, stderr], [0, '']);
  assert.equal(JSON.parse(stdout).root, machine.root);
  assert.equal(JSON.parse(stdout).projectDir, machine.projectDir);
  // Nothing but `rev-parse` is asked to find it: the command stays read-only.
  const asked = fake.calls.slice(0, fake.calls.findIndex((made) => made.args[0] !== 'rev-parse'));
  assert.deepEqual(asked.map((made) => made.args.slice(1)), [['--git-common-dir'], ['--show-toplevel'], ['--git-dir', '--show-toplevel']]);
}));

test('a submodule is the project, from its checkout and from a worktree linked to it', withMachine(async (machine) => {
  writeSessions(machine);
  const modules = `${slashes(machine.dir)}/super/.git/modules/proj`;
  const { run } = fakeRun(machine, { 'rev-parse': gitDirApart(machine, modules, { recorded: slashes(machine.root) }) });
  const fromCheckout = await runSessions(machine, ['--json', '--cwd', machine.root], { run });
  const fromWorktree = await runSessions(machine, ['--json'], { run });
  assert.deepEqual([fromCheckout.code, fromWorktree.code], [0, 0]);
  assert.deepEqual([JSON.parse(fromCheckout.stdout).root, JSON.parse(fromWorktree.stdout).root], [machine.root, machine.root]);
}));

test('where git cannot say which checkout a git dir belongs to, the project is still that git dir: a worktree of a --separate-git-dir checkout, a bare repository', withMachine(async (machine) => {
  writeSessions(machine);
  const meta = path.join(machine.dir, 'meta');
  // Nothing in such a git dir names its checkout, and from a linked worktree `--show-toplevel` is that worktree.
  const linked = await runSessions(machine, ['--json'], { run: fakeRun(machine, { 'rev-parse': gitDirApart(machine, slashes(meta)) }).run });
  assert.equal(linked.code, 1);
  assert.match(linked.stderr, new RegExp(`^js-harness sessions: no sessions folder for ${meta.replace(/\\/g, '\\\\')}: `));
  const bare = await runSessions(machine, ['--json', '--cwd', machine.root], { run: fakeRun(machine, { 'rev-parse': (args) => (args.includes('--git-common-dir') ? ok('.\n') : NO_WORK_TREE()) }).run });
  assert.equal(JSON.parse(bare.stdout).root, machine.root);
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

// T5 A: each session's context size, and the limit that marks it.
test('the board carries each session\'s context and whether it is past --context-limit', withMachine(async (machine) => {
  writeSessions(machine);
  const plain = JSON.parse((await runSessions(machine, ['--json'])).stdout);
  assert.deepEqual([plain.contextWindow, plain.contextLimit, plain.contextLimitPercent], [480000, 350400, 73]);
  assert.deepEqual(plain.sessions.map((session) => [session.context, session.contextPercent, session.pastContextLimit]), [
    [{ tokens: 12400, model: 'model-x', at: before(60).toISOString() }, 3, false],
    [{ unavailable: 'no reply of the transcript records its token usage' }, null, null],
  ]);
  const low = JSON.parse((await runSessions(machine, ['--json', '--context-limit', '12000'])).stdout);
  assert.deepEqual([low.contextWindow, low.contextLimit, low.contextLimitPercent], [480000, 12000, 3]);
  assert.deepEqual(low.sessions.map((session) => session.pastContextLimit), [true, null]);
  const text = (await runSessions(machine, ['--context-limit', '12000'])).stdout.split('\n');
  assert.ok(text.includes('  cwd C:\\proj  branch main  context 12k tokens (3%), past the limit of 3% (12k)'), text.join('\n'));
  assert.ok(text.includes('  cwd C:\\proj  branch main  context unavailable: no reply of the transcript records its token usage'), text.join('\n'));
}));

// T5b: the limit as a share of the window, the way the desktop app shows a context.
test('--context-limit takes a percentage of --context-window, in either order, and the board says both', withMachine(async (machine) => {
  writeSessions(machine);
  const board = async (...argv) => JSON.parse((await runSessions(machine, ['--json', ...argv])).stdout);
  const facts = (json) => [json.contextWindow, json.contextLimit, json.contextLimitPercent, json.sessions[0].contextPercent, json.sessions[0].pastContextLimit];
  assert.deepEqual(facts(await board('--context-limit', '2%')), [480000, 9600, 2, 3, true]);
  assert.deepEqual(facts(await board('--context-limit', '2.5%')), [480000, 12000, 3, 3, true]);
  assert.deepEqual(facts(await board('--context-limit', '100%')), [480000, 480000, 100, 3, false]);
  assert.deepEqual(facts(await board('--context-window', '20000')), [20000, 14600, 73, 62, false], 'the default limit is 73% of the window given');
  assert.deepEqual(facts(await board('--context-window', '20000', '--context-limit', '50%')), [20000, 10000, 50, 62, true]);
  assert.deepEqual(facts(await board('--context-limit', '50%', '--context-window', '20000')), [20000, 10000, 50, 62, true]);
  const text = (await runSessions(machine, ['--context-limit', '50%', '--context-window', '20000'])).stdout.split('\n');
  assert.ok(text.includes('  cwd C:\\proj  branch main  context 12k tokens (62%), past the limit of 50% (10k)'), text.join('\n'));
}));

// T5 B: each worktree's feature plans.
const BOARD_PLAN = '# Board\n\n## Tasks\n- [x] T1 read\n- [ ] T2 watch\n\n## Next step\nT2 with the writer.\n';
/** The fake git answers of a machine whose linked worktree has one feature document on its branch (and,
 * with `untracked`, one git lists that is not on disk). */
const withPlan = (machine, { untracked = '' } = {}) => ({
  diff: (_args, options) => ok(options.cwd === slashes(machine.worktree) ? 'odd/tasks/board.md\0' : ''),
  'ls-files': (_args, options) => ok(options.cwd === slashes(machine.worktree) ? untracked : ''),
});

test('each worktree carries the feature plans of its branch, in --json and in the text', withMachine(async (machine) => {
  writeSessions(machine);
  writeAt(path.join(machine.worktree, 'odd', 'tasks', 'board.md'), BOARD_PLAN, 300);
  const { run } = fakeRun(machine, withPlan(machine, { untracked: 'odd/tasks/gone.md\0' }));
  const board = JSON.parse((await runSessions(machine, ['--json'], { run })).stdout);
  assert.deepEqual(board.worktrees.items.map((tree) => tree.plans), [
    { available: true, items: [] },
    { available: true, items: [{ path: 'odd/tasks/board.md', title: 'Board', done: 1, total: 2, pending: ['T2'], nextStep: ['T2 with the writer.'] }, { path: 'odd/tasks/gone.md', unavailable: 'ENOENT' }] },
  ]);
  const lines = (await runSessions(machine, [], { run })).stdout.split('\n');
  const at = lines.indexOf(`  ${slashes(machine.worktree)}  feat/board  2222222  3 not on origin/main, 1 not pushed, 1 changed`);
  assert.deepEqual(lines.slice(at + 1, at + 4), ['    plan odd/tasks/board.md  Board  1/2  pending T2', '      > T2 with the writer.', '    plan odd/tasks/gone.md  unavailable: ENOENT']);
  assert.equal(lines[at - 1], `  ${slashes(machine.root)}  main  1111111  3 not on origin/main, 1 not pushed, 1 changed`, 'a worktree with no plan prints nothing extra');
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
  assert.deepEqual(board.gates, { available: true, items: [{ pid: 4242, startedAt: before(180).toISOString(), worktree: slashes(machine.worktree), knowsLock: false, commandLine: `node "${slashes(machine.worktree)}/bin/check.mjs"` }] });
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

/** The board read on Windows from a PowerShell listing that prints `listing`, and the script the command
 * handed to `powershell -EncodedCommand` to get it. `answers` replaces other commands, as in `fakeRun`. */
async function listingScript(machine, listing, answers = {}) {
  const fake = fakeRun(machine, { ...answers, powershell: () => ok(listing) });
  const { stdout } = await runSessions(machine, ['--json'], { run: fake.run, listProcesses: undefined, platform: 'win32' });
  return { board: JSON.parse(stdout), script: Buffer.from(fake.calls.find((made) => made.command === 'powershell').args[3], 'base64').toString('utf16le') };
}

// Codex review of 764c9b0, finding 1: the listing kept only the command lines that mention `check.mjs`,
// and `js-harness check`, which a project's pre-commit hook runs, mentions none.
test('the Windows listing keeps the command line of a dispatcher that runs check, and the board lists that gate', withMachine(async (machine) => {
  writeSessions(machine);
  const hook = 'C:\\nvm4w\\nodejs\\node.exe C:/Users/me/AppData/Local/pnpm/global/node_modules/js-harness/bin/js-harness.mjs check';
  const { board, script } = await listingScript(machine, ['4242\t1\t1767268620000\tnode.exe', `C\t4242\t${hook}`, 'OK\t1', ''].join('\r\n'));
  assert.deepEqual(board.gates.items, [{ pid: 4242, startedAt: '2026-01-01T11:57:00.000Z', worktree: { unavailable: 'js-harness check checks the folder it runs in, and its command line names none' }, knowsLock: false, commandLine: hook }]);
  // What the listing keeps is one `-notmatch`, case-insensitive as PowerShell's is. Its pattern uses nothing
  // the two engines read differently, so it is tried here on command lines as the listing has them.
  const kept = new RegExp(/\$line -notmatch '([^']+)'/.exec(script)?.[1] ?? '$^', 'i');
  for (const line of [hook, 'node "C:\\Users\\me\\npm\\node_modules\\js-harness\\bin\\js-harness.mjs" check --push', 'node bin/js-harness.mjs "check"', 'node /usr/local/bin/js-harness check', 'node D:/proj/bin/check.mjs', 'NODE.EXE D:\\PROJ\\BIN\\JS-HARNESS.MJS CHECK']) {
    assert.match(line, kept);
  }
  for (const line of ['node bin/js-harness.mjs sessions --watch', 'node D:\\js-harness\\bin\\remote.mjs start', 'claude.exe --resume']) assert.doesNotMatch(line, kept);
}));

// Codex review of 764c9b0, finding 5: PowerShell writes in the console's code page (850 or 437 on a Windows
// in Spanish or English) and the command reads UTF-8, so a letter outside ASCII in a worktree's path
// arrived as U+FFFD and its gate matched no worktree: a watch then left it out without a word.
test('the Windows listing writes UTF-8 whatever the console code page, so a gate under a path outside ASCII is matched to its worktree', withMachine(async (machine) => {
  writeSessions(machine);
  const tree = `${slashes(machine.dir)}/año/proj`;
  const worktree = () => ok([`worktree ${tree}`, 'HEAD 1111111111111111111111111111111111111111', 'branch refs/heads/main', ''].join('\n'));
  const { board, script } = await listingScript(machine, ['4242\t1\t1767268620000\tnode.exe', `C\t4242\tnode ${tree}/bin/check.mjs`, 'OK\t1', ''].join('\r\n'), { worktree });
  assert.deepEqual(board.gates.items.map((gate) => gate.worktree), [tree]);
  // The script asks for it before it writes anything, and without a byte order mark, which would be read
  // as part of the first row.
  const asks = script.indexOf('[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false');
  assert.ok(asks !== -1, 'the listing sets the output encoding to UTF-8 with no byte order mark');
  assert.ok(asks < script.indexOf('Get-CimInstance'), 'and does so before the first line it writes');
}));

test('elsewhere the gates come from ps, which gives no start time', withMachine(async (machine) => {
  writeSessions(machine);
  const fake = fakeRun(machine, { ps: () => ok(`  812 node ${slashes(machine.root)}/bin/check.mjs\n    9 /sbin/init\n`) });
  const { stdout } = await runSessions(machine, ['--json'], { run: fake.run, listProcesses: undefined, platform: 'linux' });
  assert.deepEqual(JSON.parse(stdout).gates.items.map((gate) => [gate.pid, gate.startedAt]), [[812, { unavailable: 'the process listing gave no start time' }]]);
  assert.deepEqual(fake.calls.find((made) => made.command === 'ps').args, ['-A', '-o', 'pid=,args=']);
}));

// --- the machine's gate lock: read beside the process listing, under the harness home ---

const gateFolder = (home) => path.join(home, '.js-harness', 'gate');

/** A gate's file as `bin/lib/gate-lock.mjs` keeps it: in `lock` for the gate that holds the machine's gate
 * lock, in `wait-<token>` for one in line. Its last write, `seconds` before NOW, is its beat. */
function writeGateFile(home, folder, { pid, cwd, ...times }, seconds) {
  const token = `${pid}-${String(pid).padStart(12, '0')}`;
  const file = path.join(gateFolder(home), folder === 'lock' ? 'lock' : `wait-${token}`, `holder-${token}.json`);
  writeAt(file, `${JSON.stringify({ token, pid, cwd, command: 'check', ...times })}\n`, seconds);
  fs.utimesSync(path.dirname(file), before(seconds), before(seconds));
}

const checkProcess = (pid, folder, seconds) => ({ pid, createdAt: NOW - seconds * 1000, commandLine: `node ${slashes(folder)}/bin/check.mjs` });
const gatesSection = (stdout) => {
  const lines = stdout.split('\n');
  return lines.slice(lines.indexOf('Gates') + 1, lines.indexOf('Pull requests') - 1);
};

/** Where a checkout that has the machine's gate lock keeps its library: beside `bin/check.mjs`. */
const lockLibrary = (folder) => path.join(folder, 'bin', 'lib', 'gate-lock.mjs');
/** Makes `folder` a checkout whose gate knows the lock: its script, and the library beside it. The board
 * looks for both and reads neither. */
const withLockLibrary = (folder) => {
  writeAt(path.join(folder, 'bin', 'check.mjs'), '', 0);
  writeAt(lockLibrary(folder), '', 0);
};

/** One gate runs in the main checkout and holds the lock; `inLine` puts a second one in line for it. Both
 * checkouts have the lock's library, as the gates of the lock must. */
function gateRuns(machine, home = machine.userHome) {
  withLockLibrary(machine.root);
  withLockLibrary(machine.worktree);
  writeGateFile(home, 'lock', { pid: 4242, cwd: machine.root, startedAt: before(125).toISOString(), waitingSince: before(125).toISOString() }, 3);
  const processes = [checkProcess(4242, machine.root, 130)];
  const inLine = () => {
    writeGateFile(home, 'wait', { pid: 4250, cwd: machine.worktree, startedAt: before(1).toISOString(), waitingSince: before(60).toISOString() }, 1);
    processes.push(checkProcess(4250, machine.worktree, 61));
  };
  return { listProcesses: () => [...processes], inLine };
}

test('the board reads the machine\'s gate lock under the harness home: Gates says which gate runs and which waits', withMachine(async (machine) => {
  writeSessions(machine);
  const { listProcesses, inLine } = gateRuns(machine);
  inLine();
  const board = JSON.parse((await runSessions(machine, ['--json'], { listProcesses })).stdout);
  assert.deepEqual(board.gateLock, {
    available: true,
    holder: { pid: 4242, cwd: machine.root, command: 'check', startedAt: before(125).toISOString(), beatAt: before(3).toISOString(), stale: false },
    waiters: [{ pid: 4250, cwd: machine.worktree, command: 'check', waitingSince: before(60).toISOString() }],
    readAt: new Date(NOW).toISOString(),
  });
  // The listing still has both processes, as it gave them.
  assert.deepEqual(board.gates.items.map((gate) => gate.pid), [4242, 4250]);
  assert.deepEqual(gatesSection((await runSessions(machine, [], { listProcesses })).stdout), [
    `  pid 4242  ${slashes(machine.root)}  running, took the gate lock 2m ago  node ${slashes(machine.root)}/bin/check.mjs`,
    `  pid 4250  ${slashes(machine.worktree)}  waiting for the gate of pid 4242, began 1m ago  node ${slashes(machine.worktree)}/bin/check.mjs`,
  ]);

  // A holder that has not beaten for the stale time is said silent, not running.
  const later = () => NOW + 120_000;
  assert.deepEqual(gatesSection((await runSessions(machine, [], { listProcesses: () => [], now: later })).stdout), [
    `  pid 4242  ${slashes(machine.root)}  silent: holds the gate lock, its last beat was 2m ago and the next gate takes it over  check (no process of the listing has this pid)`,
  ]);
}));

// Found in review, 2026-10-10: the lock was read against the time the board began, so a board that took its
// time over the transcripts and the listing read a holder that had died since as still alive.
test('the gate lock is read against the clock of the moment it is read, so a slow board does not read a dead holder as alive', withMachine(async (machine) => {
  writeSessions(machine);
  gateRuns(machine);
  // The holder's last beat was 3 s before the board began; the listing takes 70 s. The holder is read 73 s
  // after its last beat, which is silent, and its line says that age and not the 3 s of the board's start:
  // a holder said silent with a last beat of seconds reads as a mistake of the board.
  const slowly = async (argv) => {
    let at = NOW;
    const listProcesses = () => {
      at = NOW + 70_000;
      return [];
    };
    return (await runSessions(machine, argv, { listProcesses, now: () => at })).stdout;
  };
  assert.match(gatesSection(await slowly([]))[0], /^ {2}pid 4242 {2}.* {2}silent: holds the gate lock, its last beat was 1m ago and the next gate takes it over {2}/);
  const board = JSON.parse(await slowly(['--json']));
  assert.deepEqual([board.generatedAt, board.gateLock.readAt, board.gateLock.holder.stale], [new Date(NOW).toISOString(), new Date(NOW + 70_000).toISOString(), true]);
}));

// Whether a `check` process knows the lock is read from the disk: the lock's library is beside the script
// it runs, or it is not, as in every checkout cut before the lock. Only the lock says whether the first
// kind runs; the second runs whenever it is started.
test('a check process is a gate that knows the lock when the lock library is beside its script, and the board says so of one that is not in its sensors', withMachine(async (machine) => {
  writeSessions(machine);
  const { listProcesses } = gateRuns(machine);
  const both = () => [...listProcesses(), checkProcess(4260, machine.worktree, 5)];
  const RUNS = `  pid 4242  ${slashes(machine.root)}  running, took the gate lock 2m ago  node ${slashes(machine.root)}/bin/check.mjs`;
  const script = `node ${slashes(machine.worktree)}/bin/check.mjs`;
  assert.deepEqual(gatesSection((await runSessions(machine, [], { listProcesses: both })).stdout), [RUNS, `  pid 4260  ${slashes(machine.worktree)}  not in its sensors (before or after them), started 5s ago  ${script}`]);
  assert.deepEqual(JSON.parse((await runSessions(machine, ['--json'], { listProcesses: both })).stdout).gates.items.map((gate) => [gate.pid, gate.knowsLock]), [[4242, true], [4260, true]]);

  // A checkout from before the lock: its gate runs beside the one that holds the lock.
  fs.rmSync(lockLibrary(machine.worktree));
  assert.deepEqual(gatesSection((await runSessions(machine, [], { listProcesses: both })).stdout), [RUNS, `  pid 4260  ${slashes(machine.worktree)}  started 5s ago  ${script}`]);
  assert.deepEqual(JSON.parse((await runSessions(machine, ['--json'], { listProcesses: both })).stdout).gates.items.map((gate) => [gate.pid, gate.knowsLock]), [[4242, true], [4260, false]]);

  // The look is replaceable, and it is asked for the script as the command line names it.
  const asked = [];
  const lockLibraryBeside = (file) => {
    asked.push(file);
    return false;
  };
  const none = JSON.parse((await runSessions(machine, ['--json'], { listProcesses: both, lockLibraryBeside })).stdout);
  assert.deepEqual(none.gates.items.map((gate) => gate.knowsLock), [false, false]);
  assert.deepEqual(asked, [`${slashes(machine.root)}/bin/check.mjs`, `${slashes(machine.worktree)}/bin/check.mjs`]);
}));

function trySymlink(target, link, t) {
  try {
    fs.symlinkSync(target, link, 'file');
    return true;
  } catch (err) {
    if (err.code === 'EPERM') {
      t.skip('symlinks need privileges on this machine');
      return false;
    }
    throw err;
  }
}

// An install on macOS or Linux links the dispatcher from a folder of commands, and `ps` shows the link.
test('lockLibraryBesideScript follows the script through a link, and a script it cannot look at has no library', () => {
  const install = path.join('/usr', 'local', 'lib', 'node_modules', 'js-harness', 'bin');
  const realpath = (script) => {
    if (script === '/usr/local/bin/js-harness') return path.join(install, 'js-harness.mjs');
    if (script === '/old/bin/check.mjs') return script;
    throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
  };
  const looked = [];
  const exists = (file) => {
    looked.push(file);
    return file === path.join(install, 'lib', 'gate-lock.mjs');
  };
  assert.equal(lockLibraryBesideScript('/usr/local/bin/js-harness', { realpath, exists }), true);
  assert.equal(lockLibraryBesideScript('/old/bin/check.mjs', { realpath, exists }), false);
  assert.equal(lockLibraryBesideScript('/gone/bin/check.mjs', { realpath, exists }), false);
  assert.deepEqual(looked, [path.join(install, 'lib', 'gate-lock.mjs'), path.join('/old/bin', 'lib', 'gate-lock.mjs')]);
});

test('the lock library is looked for beside the script a link leads to', withMachine(async (machine, t) => {
  writeSessions(machine);
  const install = path.join(machine.dir, 'lib', 'node_modules', 'js-harness');
  writeAt(path.join(install, 'bin', 'js-harness.mjs'), '', 0);
  withLockLibrary(install);
  const link = path.join(machine.dir, 'commands', 'js-harness');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  if (!trySymlink(path.join(install, 'bin', 'js-harness.mjs'), link, t)) return;
  const listProcesses = () => [{ pid: 812, createdAt: null, commandLine: `node ${slashes(link)} check` }, { pid: 813, createdAt: null, commandLine: `node ${slashes(machine.dir)}/nowhere/js-harness check` }];
  const board = JSON.parse((await runSessions(machine, ['--json'], { listProcesses })).stdout);
  assert.deepEqual(board.gates.items.map((gate) => [gate.pid, gate.knowsLock]), [[812, true], [813, false]]);
}));

test('the gate lock is looked for under JS_HARNESS_HOME, or under the home folder, and no lock there is a free one', withMachine(async (machine) => {
  writeSessions(machine);
  const free = { available: true, holder: null, waiters: [], readAt: new Date(NOW).toISOString() };
  const none = await runSessions(machine, ['--json']);
  assert.deepEqual(JSON.parse(none.stdout).gateLock, free);
  assert.equal(fs.existsSync(machine.userHome), false, 'looking for the lock creates nothing');

  const other = path.join(machine.dir, 'harness-home');
  const { listProcesses } = gateRuns(machine, other);
  assert.deepEqual(JSON.parse((await runSessions(machine, ['--json'], { listProcesses })).stdout).gateLock, free, 'the lock of another home is not this one\'s');
  const moved = JSON.parse((await runSessions(machine, ['--json'], { listProcesses, env: { JS_HARNESS_HOME: other } })).stdout);
  assert.equal(moved.gateLock.holder.pid, 4242);
  // An empty JS_HARNESS_HOME is no home, as for the relief file.
  assert.deepEqual(JSON.parse((await runSessions(machine, ['--json'], { listProcesses, env: { JS_HARNESS_HOME: '' } })).stdout).gateLock, free);
}));

test('the lock is read after the processes are listed, so a gate that started between the two is in line and not beside the one that runs', withMachine(async (machine) => {
  writeSessions(machine);
  const { listProcesses, inLine } = gateRuns(machine);
  // The second gate starts and stands in line as the processes are being listed.
  const listing = () => {
    inLine();
    return listProcesses();
  };
  const { stdout } = await runSessions(machine, ['--json'], { listProcesses: listing });
  assert.deepEqual(JSON.parse(stdout).gateLock.waiters.map((waiter) => waiter.pid), [4250]);
}));

test('a gate lock that cannot be read is said under Gates with its reason, and the gates of the listing are still printed', withMachine(async (machine) => {
  writeSessions(machine);
  const { listProcesses } = gateRuns(machine);
  const readdir = (folder) => {
    if (folder === gateFolder(machine.userHome)) throw Object.assign(new Error('EACCES: permission denied, scandir'), { code: 'EACCES' });
    return fs.readdirSync(folder);
  };
  const reason = 'the gate lock: EACCES: permission denied, scandir';
  assert.deepEqual(JSON.parse((await runSessions(machine, ['--json'], { listProcesses, readdir })).stdout).gateLock, { available: false, reason });
  assert.deepEqual(gatesSection((await runSessions(machine, [], { listProcesses, readdir })).stdout), [
    `  pid 4242  ${slashes(machine.root)}  started 2m ago  node ${slashes(machine.root)}/bin/check.mjs`,
    `  unavailable: ${reason}`,
  ]);
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
    at('Relief'),
    at(`  no relief file yet: the first line an orchestrator appends creates ${machine.relief}`),
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

// --- T5 C: --watch ---

const SESSION_D = 'dddddddd-4444-4444-8444-444444444444';
const fileOfD = (machine) => path.join(machine.projectDir, `${SESSION_D}.jsonl`);
/** A fourth session in the middle of a tool call; `finishes` writes the reply that ends its turn. */
const startsWorking = (machine) => writeAt(fileOfD(machine), jsonl(prompt('watch me', 100), call('toolu_d1', 'Read', { file_path: 'x' }, 90)), 90);
const finishes = (machine) => fs.appendFileSync(fileOfD(machine), jsonl(result('toolu_d1', {}, -3), reply('All done.', -4)));
const D_WAITS = 'session dddddddd "watch me" is waiting (was working)';

/** Runs a watch with a clock that only `sleep` moves. `steps[n]` runs during the n-th sleep: that is
 * where a test changes the machine between two looks. `printedWhileWaiting` is how many lines had been
 * written at each sleep. */
async function watch(machine, argv, steps = [], deps = {}) {
  const wait = { ms: NOW, slept: [], printedWhileWaiting: [] };
  const out = [];
  const sleep = async (ms) => {
    wait.printedWhileWaiting.push(out.length);
    wait.slept.push(ms);
    wait.ms += ms;
    steps[wait.slept.length - 1]?.();
  };
  const done = await runSessions(machine, ['--watch', ...argv], { now: () => wait.ms, sleep, stdout: (line) => out.push(line), ...deps });
  return { ...done, lines: out.join('\n').split('\n'), slept: wait.slept, printedWhileWaiting: wait.printedWhileWaiting };
}

test('--watch prints nothing while the board does not change, and returns the change and the board when a session starts waiting', withMachine(async (machine) => {
  writeSessions(machine);
  startsWorking(machine);
  const { code, lines, slept, printedWhileWaiting, stderr } = await watch(machine, ['--interval', '5', '--timeout', '60'], [() => {}, () => finishes(machine)]);
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(slept, [5000, 5000]);
  assert.deepEqual(printedWhileWaiting, [0, 0]);
  assert.deepEqual(lines.slice(0, 3), ['sessions --watch: 1 change after 10s', `  ${D_WAITS}`, '']);
  assert.match(lines[3], /^Sessions {2}.* 3 changed in the last 12h$/);
  assert.match(lines[5], /^dddddddd {2}waiting {2}watch me {2}/);
  assert.equal(lines.at(-1), NOT_VISIBLE);
}));

test('--watch returns at --timeout with one line when nothing that matters changed: a session that starts working, a file that is written', withMachine(async (machine) => {
  writeSessions(machine);
  const output = path.join(machine.tmp, 'claude', machine.slug, SESSION_A, 'tasks', 'b1.output');
  const written = () => fs.utimesSync(output, new Date(NOW), new Date(NOW));
  const prompted = () => fs.appendFileSync(path.join(machine.projectDir, `${SESSION_A}.jsonl`), jsonl(prompt('one more thing', -40)));
  const { code, lines, slept } = await watch(machine, ['--interval', '30', '--timeout', '70'], [written, prompted]);
  assert.equal(code, 0);
  assert.deepEqual(slept, [30000, 30000, 10000], 'the last wait is what is left of the timeout');
  assert.deepEqual(lines, ['sessions --watch: nothing changed in 70s']);
}));

// R3-watch-wait-upper-bound: the longest wait a Node timer takes, in whole seconds, is still a wait.
test('--watch takes waits up to 2,147,483 seconds', withMachine(async (machine) => {
  writeSessions(machine);
  // --hours as wide as the wait: after 24 days every session would have left a window of 12 hours.
  const { code, lines, slept } = await watch(machine, ['--interval', '2147483', '--timeout', '2147483', '--hours', '1000']);
  assert.deepEqual([code, slept, lines], [0, [2147483000], ['sessions --watch: nothing changed in 2147483s']]);
}));

test('--watch --json gives the changes and the board, or the timeout alone', withMachine(async (machine) => {
  writeSessions(machine);
  startsWorking(machine);
  const changed = JSON.parse((await watch(machine, ['--json', '--interval', '5', '--timeout', '60'], [() => finishes(machine)])).lines.join('\n'));
  assert.deepEqual(changed.watch, { changed: true, waitedSeconds: 5, changes: [D_WAITS] });
  assert.deepEqual([changed.board.sessions[0].id, changed.board.sessions[0].state], [SESSION_D, 'waiting']);
  const quiet = JSON.parse((await watch(machine, ['--json', '--interval', '5', '--timeout', '10'])).lines.join('\n'));
  assert.deepEqual(quiet, { watch: { changed: false, waitedSeconds: 10, changes: [] } });
}));

test('--watch leaves out the session that watches: CLAUDE_CODE_SESSION_ID, or --self, which wins', withMachine(async (machine) => {
  writeSessions(machine);
  startsWorking(machine);
  const env = { CLAUDE_CODE_SESSION_ID: SESSION_D };
  const own = await watch(machine, ['--interval', '5', '--timeout', '10'], [() => finishes(machine)], { env });
  assert.deepEqual(own.lines, ['sessions --watch: nothing changed in 10s']);
  startsWorking(machine);
  const other = await watch(machine, ['--interval', '5', '--timeout', '10', '--self', 'bbbbbbbb'], [() => finishes(machine)], { env });
  assert.deepEqual(other.lines.slice(0, 2), ['sessions --watch: 1 change after 5s', `  ${D_WAITS}`]);
  assert.deepEqual(other.lines.filter((line) => line.endsWith('  (this session)')).map((line) => line.slice(0, 8)), ['bbbbbbbb']);
}));

test('the plain board marks the session that asked for it, and marks none when nothing names it', withMachine(async (machine) => {
  writeSessions(machine);
  const env = { CLAUDE_CODE_SESSION_ID: SESSION_A };
  const marked = (await runSessions(machine, [], { env })).stdout.split('\n').filter((line) => line.endsWith('  (this session)'));
  assert.deepEqual(marked.map((line) => line.slice(0, 8)), ['aaaaaaaa']);
  const board = JSON.parse((await runSessions(machine, ['--json'], { env })).stdout);
  assert.deepEqual([board.self, board.sessions.filter((session) => session.self).map((session) => session.id)], [SESSION_A, [SESSION_A]]);
  const none = await runSessions(machine, ['--json']);
  assert.deepEqual([JSON.parse(none.stdout).self, none.stdout.includes('"self": true')], [null, false]);
  assert.doesNotMatch((await runSessions(machine, [])).stdout, /this session/);
}));

test('--watch does not lose a change across a look that could not read the fact', withMachine(async (machine) => {
  writeSessions(machine);
  const one = { number: 41, title: 'feat: session board', headRefName: 'feat/board' };
  const answers = [ok(JSON.stringify([one])), { status: 1, stdout: '', stderr: 'boom' }, ok(JSON.stringify([one, { number: 42, title: 'feat: more', headRefName: 'feat/more' }]))];
  const { run } = fakeRun(machine, { pr: () => answers.shift() });
  const { code, lines, slept } = await watch(machine, ['--interval', '5', '--timeout', '60'], [], { run });
  assert.equal(code, 0);
  assert.deepEqual(slept, [5000, 5000]);
  assert.deepEqual(lines.slice(0, 2), ['sessions --watch: 1 change after 10s', '  pull request #42 opened: feat: more (feat/more)']);
}));

test('--watch exits 1 when the sessions folder is gone at a later look', withMachine(async (machine) => {
  writeSessions(machine);
  const gone = () => fs.rmSync(machine.projectDir, { recursive: true, force: true });
  const { code, lines, stderr } = await watch(machine, ['--interval', '5', '--timeout', '60'], [gone]);
  assert.equal(code, 1);
  assert.deepEqual(lines, ['']);
  assert.match(stderr, /^js-harness sessions: no sessions folder for /);
}));

// Since `check` waits for the machine's gate lock, a second `check` process beside the one that runs is a
// gate in line. The watch said "gate started … while another runs" for it, which is what the lock prevents.
test('--watch says that a gate which starts and waits for the lock is waiting, and nothing when it then takes the lock', withMachine(async (machine) => {
  writeSessions(machine);
  const { listProcesses, inLine } = gateRuns(machine);
  const queued = await watch(machine, ['--interval', '5', '--timeout', '60'], [inLine], { listProcesses });
  assert.deepEqual(queued.lines.slice(0, 3), [
    'sessions --watch: 1 change after 5s',
    `  gate started in ${slashes(machine.worktree)} (pid 4250), waiting for the gate in ${slashes(machine.root)} (pid 4242)`,
    '',
  ]);
  assert.deepEqual(gatesSection(queued.lines.join('\n')).map((line) => line.split('  ')[3]), ['running, took the gate lock 2m ago', 'waiting for the gate of pid 4242, began 1m ago']);

  // The first gate releases the lock and writes its report while the second takes it: nothing to decide.
  const handOver = () => {
    fs.rmSync(gateFolder(machine.userHome), { recursive: true });
    writeGateFile(machine.userHome, 'lock', { pid: 4250, cwd: machine.worktree, startedAt: before(-5).toISOString(), waitingSince: before(60).toISOString() }, -5);
  };
  const taken = await watch(machine, ['--interval', '5', '--timeout', '10'], [handOver], { listProcesses });
  assert.deepEqual(taken.lines, ['sessions --watch: nothing changed in 10s']);
}));

// The alarm that is left: a gate of a checkout from before the lock, which runs whenever it is started.
// A gate that knows the lock is none, even when the listing has it before it stands in line.
test('--watch says that a gate runs beside the one that holds the lock only of a gate whose checkout has no lock library', withMachine(async (machine) => {
  writeSessions(machine);
  const { listProcesses } = gateRuns(machine);
  const processes = listProcesses();
  const starts = () => processes.push(checkProcess(4260, machine.worktree, -4));
  const started = `  gate started in ${slashes(machine.worktree)} (pid 4260)`;
  const knows = await watch(machine, ['--interval', '5', '--timeout', '60'], [starts], { listProcesses: () => [...processes] });
  assert.deepEqual(knows.lines.slice(0, 3), ['sessions --watch: 1 change after 5s', started, '']);
  assert.deepEqual(gatesSection(knows.lines.join('\n')).map((line) => line.split('  ')[3]), ['running, took the gate lock 2m ago', 'not in its sensors (before or after them), started 1s ago']);

  processes.pop();
  fs.rmSync(lockLibrary(machine.worktree));
  const without = await watch(machine, ['--interval', '5', '--timeout', '60'], [starts], { listProcesses: () => [...processes] });
  assert.deepEqual(without.lines.slice(0, 3), ['sessions --watch: 1 change after 5s', `${started} while another runs in ${slashes(machine.root)} (pid 4242)`, '']);
  assert.deepEqual(gatesSection(without.lines.join('\n')).map((line) => line.split('  ')[3]), ['running, took the gate lock 2m ago', 'started 1s ago']);
}));

// --- the relief file of the orchestrator ---

const RELIEF_NOTES = Array.from({ length: 7 }, (_, n) => `2026-01-01 10:0${n} note ${n}`);

test('the board carries the relief file of the project: under JS_HARNESS_HOME or the home folder, named by the project slug', withMachine(async (machine) => {
  writeSessions(machine);
  const none = JSON.parse((await runSessions(machine, ['--json'])).stdout);
  assert.deepEqual(none.relief, { path: machine.relief, exists: false });
  assert.equal(fs.existsSync(machine.userHome), false, 'looking for the file creates nothing');

  writeAt(machine.relief, `${RELIEF_NOTES.join('\n')}\n`, 30);
  const some = JSON.parse((await runSessions(machine, ['--json'])).stdout);
  assert.deepEqual(some.relief, { path: machine.relief, exists: true, lineCount: 7, lines: RELIEF_NOTES.slice(2) });
  const text = (await runSessions(machine, [])).stdout.split('\n');
  assert.deepEqual(text.slice(text.indexOf('Relief'), text.indexOf('Relief') + 3), ['Relief', `  ${machine.relief}  7 lines, the last 5:`, '  | 2026-01-01 10:02 note 2']);

  // JS_HARNESS_HOME is the harness home wherever the user's is, as for `install` and `remote`.
  const other = path.join(machine.dir, 'harness-home');
  const moved = JSON.parse((await runSessions(machine, ['--json'], { env: { JS_HARNESS_HOME: other } })).stdout);
  assert.deepEqual(moved.relief, { path: path.join(other, '.js-harness', 'relief', `${machine.slug}.md`), exists: false });
}));

test('--relief names the file, and one that cannot be read is unavailable with its reason while the board is still printed', withMachine(async (machine) => {
  writeSessions(machine);
  const file = path.join(machine.dir, 'notes', 'relief.md');
  writeAt(file, 'one line\n', 30);
  const named = await runSessions(machine, ['--json', '--relief', file]);
  assert.deepEqual(JSON.parse(named.stdout).relief, { path: file, exists: true, lineCount: 1, lines: ['one line'] });

  // A folder where the file should be: reading it fails with something other than "not there".
  const folder = await runSessions(machine, ['--relief', path.dirname(file)]);
  assert.equal(folder.code, 0);
  const lines = folder.stdout.split('\n');
  const said = lines[lines.indexOf('Relief') + 1];
  assert.ok(said.startsWith(`  ${path.dirname(file)}  unavailable: `) && !said.endsWith(': '), said);
  assert.equal(lines.at(-1), NOT_VISIBLE);
}));

// R3-relief-path-base-untested: where a relief path that is not absolute lands.
test('a relative --relief is read from the folder the command runs in, whatever --cwd says, like the other paths', withMachine(async (machine) => {
  writeSessions(machine);
  const file = path.join(machine.worktree, 'notes', 'relief.md');
  writeAt(file, 'a note\n', 30);
  const { code, stdout } = await runSessions(machine, ['--json', '--cwd', machine.root, '--relief', path.join('notes', 'relief.md')]);
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout).relief, { path: file, exists: true, lineCount: 1, lines: ['a note'] });
}));

test('an empty JS_HARNESS_HOME is no home: the relief file is under the home folder, not under the folder the command runs in', withMachine(async (machine) => {
  writeSessions(machine);
  const { stdout } = await runSessions(machine, ['--json'], { env: { JS_HARNESS_HOME: '' } });
  assert.deepEqual(JSON.parse(stdout).relief, { path: machine.relief, exists: false });
}));

test('--watch does not return for a line appended to the relief file, and prints the file as it is when it does return', withMachine(async (machine) => {
  writeSessions(machine);
  startsWorking(machine);
  writeAt(machine.relief, 'first note\n', 30);
  const notes = () => fs.appendFileSync(machine.relief, 'second note\n');
  const quiet = await watch(machine, ['--interval', '5', '--timeout', '10'], [notes]);
  assert.deepEqual(quiet.lines, ['sessions --watch: nothing changed in 10s']);

  const woken = await watch(machine, ['--interval', '5', '--timeout', '60'], [() => finishes(machine)]);
  assert.equal(woken.lines[1], `  ${D_WAITS}`);
  assert.deepEqual(woken.lines.slice(woken.lines.indexOf('Relief') + 1, woken.lines.indexOf('Relief') + 4), [`  ${machine.relief}  2 lines:`, '  | first note', '  | second note']);
}));

// --- gates outside the worktrees ---

// Seen live on 2026-10-06: the test suite of a running gate starts `check.mjs` in temporary folders, and a
// watch returned for one of them ending.
test('--watch does not return for a gate that starts and ends in a folder that is no worktree, and the board still lists it', withMachine(async (machine) => {
  writeSessions(machine);
  const stray = { pid: 32036, createdAt: NOW, commandLine: 'node "C:/Temp/js-harness-pre-push-x/bin/check.mjs" --push' };
  const real = { pid: 4242, createdAt: NOW, commandLine: `node "${slashes(machine.worktree)}/bin/check.mjs"` };
  const listings = [[real], [real, stray], [real], [real, stray]];
  const { lines, slept } = await watch(machine, ['--interval', '5', '--timeout', '15'], [], { listProcesses: () => listings.shift() });
  assert.deepEqual(slept, [5000, 5000, 5000]);
  assert.deepEqual(lines, ['sessions --watch: nothing changed in 15s']);

  const board = await runSessions(machine, [], { listProcesses: () => [real, stray] });
  assert.match(board.stdout, /^ {2}pid 32036 {2}C:\/Temp\/js-harness-pre-push-x {2}/m);
}));

// Codex review of 764c9b0, finding 1: a gate run as `js-harness check` names no `bin/check.mjs`, so the
// watch saw neither its start nor its end.
test('--watch returns for a gate a pre-commit hook started as js-harness check, and for its end', withMachine(async (machine) => {
  writeSessions(machine);
  const hook = { pid: 5150, createdAt: NOW, commandLine: 'C:\\nvm4w\\nodejs\\node.exe C:/Users/me/AppData/Local/pnpm/global/node_modules/js-harness/bin/js-harness.mjs check' };
  const started = [[], [hook]];
  const start = await watch(machine, ['--interval', '5', '--timeout', '60'], [], { listProcesses: () => started.shift() });
  assert.deepEqual(start.lines.slice(0, 2), ['sessions --watch: 1 change after 5s', '  gate started in an unknown worktree (pid 5150)']);
  const ended = [[hook], []];
  const end = await watch(machine, ['--interval', '5', '--timeout', '60'], [], { listProcesses: () => ended.shift() });
  assert.deepEqual(end.lines.slice(0, 2), ['sessions --watch: 1 change after 5s', '  gate ended in an unknown worktree (pid 5150)']);
}));

// --- the roster, and the address of a role ---

const SESSION_E = 'eeeeeeee-5555-4555-8555-555555555555';
const ORCHESTRATOR = 'JH ORQ · proj';
const WORKER = 'JH 5 · the roster';

/** Writes a session that was given `title`: his prompt, with the permission mode the host records on it,
 * and the reply that ended its turn `seconds` ago. Its file was last written then, or `touched` seconds
 * ago when the app wrote to it since: an entry with no time, as it appends to a transcript it opens. */
function writeTitled(machine, id, title, seconds, { mode = 'bypassPermissions', cwd = 'C:\\proj', branch = 'main', touched } = {}) {
  const where = { cwd, gitBranch: branch };
  const untimed = touched === undefined ? [] : [{ type: 'cost-state', sessionId: id }];
  const lines = jsonl({ type: 'custom-title', customTitle: title, sessionId: id }, { ...prompt('go', seconds + 10), ...where, permissionMode: mode }, { ...reply('Done.', seconds), ...where }, ...untimed);
  writeAt(path.join(machine.projectDir, `${id}.jsonl`), lines, touched ?? seconds);
}
const transcriptOf = (machine, id) => path.join(machine.projectDir, `${id}.jsonl`);
/** A `readFile` that cannot read the transcript of `id`, as when the session is writing it. */
const busyOn = (id) => (absolute) => {
  if (absolute.endsWith(`${id}.jsonl`)) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
  return fs.readFileSync(absolute, 'utf8');
};

/** An orchestrator, a work session in the linked worktree that runs in another permission mode, and the
 * transcript of an orchestrator of thirteen hours ago, outside the window. */
function writeRoster(machine) {
  writeTitled(machine, SESSION_A, ORCHESTRATOR, 600);
  writeTitled(machine, SESSION_B, WORKER, 60, { mode: 'auto', cwd: machine.worktree, branch: 'feat/board' });
  writeTitled(machine, SESSION_C, 'JH ORQ · long ago', 13 * 3600);
}

test('the board has a roster after the sessions: a row per title with its role, in the text and in --json', withMachine(async (machine) => {
  writeRoster(machine);
  writeAt(path.join(machine.worktree, 'odd', 'tasks', 'board.md'), BOARD_PLAN, 300);
  const deps = { run: fakeRun(machine, withPlan(machine)).run, env: { CLAUDE_CODE_SESSION_ID: SESSION_B } };
  const lines = (await runSessions(machine, [], deps)).stdout.split('\n');
  assert.deepEqual(lines.slice(lines.indexOf('Roster'), lines.indexOf('Worktrees')), [
    'Roster',
    `  orchestrator  ${ORCHESTRATOR}  silent since 10m ago`,
    '    mode bypassPermissions  folder C:\\proj  branch main  transcript aaaaaaaa',
    `  work 5  ${WORKER}  this session, last entry 1m ago`,
    `    mode auto  folder ${machine.worktree}  branch feat/board  feature board  transcript bbbbbbbb`,
    `  ${ROSTER_NOT_KNOWN}`,
    '',
  ]);
  assert.ok(lines.indexOf('Roster') > lines.findIndex((line) => line.startsWith('aaaaaaaa  ')), 'after the sessions');

  const wide = await runSessions(machine, ['--json', '--hours', '24'], deps);
  const { roster } = JSON.parse(wide.stdout);
  assert.deepEqual(roster.rows.map((row) => [row.role, row.number, row.title, row.purpose, row.permissionMode, row.self, row.features, row.transcripts.map((transcript) => transcript.id)]), [
    ['orchestrator', null, ORCHESTRATOR, 'proj', 'bypassPermissions', false, [], [SESSION_A]],
    ['orchestrator', null, 'JH ORQ · long ago', 'long ago', 'bypassPermissions', false, [], [SESSION_C]],
    ['work', 5, WORKER, 'the roster', 'auto', true, ['board'], [SESSION_B]],
  ]);
  assert.deepEqual([roster.unread, roster.outside], [0, 0]);
  const said = (await runSessions(machine, ['--hours', '24'], deps)).stdout.split('\n').filter((line) => line.includes('carry the orchestrator'));
  assert.deepEqual(said, [`  2 sessions carry the orchestrator's title: "${ORCHESTRATOR}", "JH ORQ · long ago". A message to the orchestrator has no single address.`]);
}));

test('--address prints the title of the one session that holds a role and exits 0, and reads nothing but the transcripts', withMachine(async (machine) => {
  writeRoster(machine);
  const fake = fakeRun(machine);
  const mustNot = () => {
    throw new Error('--address must not list the processes');
  };
  const found = await runSessions(machine, ['--address', 'orchestrator'], { run: fake.run, listProcesses: mustNot });
  assert.deepEqual([found.code, found.stdout, found.stderr], [0, ORCHESTRATOR, '']);
  assert.deepEqual(fake.calls.map((made) => made.args[0]), ['rev-parse'], 'no worktree, no pull request: only where the project is');
  for (const name of ['ORQ', 'orq']) assert.deepEqual([(await runSessions(machine, ['--address', name])).stdout, name], [ORCHESTRATOR, name]);
  const worker = await runSessions(machine, ['--address', '5']);
  assert.deepEqual([worker.code, worker.stdout, worker.stderr], [0, WORKER, '']);
}));

test('--address exits 1 with one line when no session holds the role', withMachine(async (machine) => {
  writeRoster(machine);
  const none = await runSessions(machine, ['--address', '7']);
  assert.deepEqual([none.code, none.stdout, none.stderr], [1, '', 'js-harness sessions: no session carries the title of work session 7 (transcripts that changed in the last 12h: 2)']);
  // The window is the board's: an orchestrator that last wrote before it holds nothing, and --hours widens it.
  writeTitled(machine, SESSION_A, 'JH ORQ relevada · proj', 600);
  const relieved = await runSessions(machine, ['--address', 'orchestrator']);
  assert.deepEqual([relieved.code, relieved.stdout, relieved.stderr], [1, '', 'js-harness sessions: no session carries the title of the orchestrator (transcripts that changed in the last 12h: 2)']);
  const wide = await runSessions(machine, ['--address', 'orchestrator', '--hours', '24']);
  assert.deepEqual([wide.code, wide.stdout], [0, 'JH ORQ · long ago']);
  // No sessions folder is no session either, said as the board says it.
  fs.rmSync(machine.projectDir, { recursive: true });
  const gone = await runSessions(machine, ['--address', 'orchestrator']);
  assert.deepEqual([gone.code, gone.stdout, gone.stderr], [1, '', `js-harness sessions: no sessions folder for ${machine.root}: ${machine.projectDir} (ENOENT)`]);
}));

// The app appends entries with no time to a transcript it opens, so a file can be of this minute and its
// session of two weeks ago (seen on 2026-10-11). The board still lists the transcript; no role is held by it.
test('a session is a row of the roster, and holds a role, only while its last timed entry is in the window, however new its file', withMachine(async (machine) => {
  writeRoster(machine);
  writeTitled(machine, SESSION_D, 'JH ORQ · days ago', 13 * 86400, { touched: 30 });
  writeTitled(machine, SESSION_E, 'JH 7 · days ago', 14 * 86400, { touched: 20 });
  const found = await runSessions(machine, ['--address', 'orchestrator']);
  assert.deepEqual([found.code, found.stdout, found.stderr], [0, ORCHESTRATOR, '']);
  const none = await runSessions(machine, ['--address', '7']);
  assert.deepEqual([none.code, none.stdout, none.stderr], [1, '', 'js-harness sessions: no session carries the title of work session 7 (transcripts that changed in the last 12h: 4, 2 of them with no entry in that time)']);
  // A window wide enough for their entries, and both hold what their titles say.
  assert.deepEqual([(await runSessions(machine, ['--address', '7', '--hours', '400'])).stdout, (await runSessions(machine, ['--address', 'orchestrator', '--hours', '400'])).code], ['JH 7 · days ago', 2]);

  const lines = (await runSessions(machine, [])).stdout.split('\n');
  const roster = lines.slice(lines.indexOf('Roster'), lines.indexOf('Worktrees'));
  assert.deepEqual(roster.filter((line) => line.includes('days ago')), []);
  assert.deepEqual(roster.filter((line) => line.includes('in no row')), ['  2 transcripts with no entry inside the window are in no row']);
  assert.equal(roster.filter((line) => line.startsWith('  orchestrator  ')).length, 1);
  // The rest of the board keeps its window: the transcripts are listed as before.
  assert.equal(lines[0], `Sessions  ${machine.root}  4 changed in the last 12h`);
  assert.match(lines.find((line) => line.startsWith('dddddddd  ')), /JH ORQ · days ago {2}last entry 13d ago$/);
  const board = JSON.parse((await runSessions(machine, ['--json'])).stdout);
  assert.deepEqual([board.sessions.length, board.roster.rows.length, board.roster.outside], [4, 2, 2]);
}));

// A session that starts as orchestrator takes exit 1 as "you may start": not knowing must not read as "none".
test('--address exits 1 only when every transcript of the window was read: with no holder and one unread it exits 2 and names the file', withMachine(async (machine) => {
  writeRoster(machine);
  const unreadable = `${transcriptOf(machine, SESSION_A)} (EBUSY)`;
  const unknown = await runSessions(machine, ['--address', 'orchestrator'], { readFile: busyOn(SESSION_A) });
  assert.deepEqual([unknown.code, unknown.stdout], [2, '']);
  assert.equal(unknown.stderr, `js-harness sessions: not known whether a session carries the title of the orchestrator: 1 transcript that changed in the last 12h could not be read: ${unreadable}`);
  // One holder found is still the answer, with what was not read said beside it.
  const found = await runSessions(machine, ['--address', '5'], { readFile: busyOn(SESSION_A) });
  assert.deepEqual([found.code, found.stdout, found.stderr], [0, WORKER, `js-harness sessions: 1 transcript that changed in the last 12h could not be read and is not counted: ${unreadable}`]);
  // Several holders are several whatever else could not be read.
  writeTitled(machine, SESSION_D, 'JH 5 · another', 30);
  const several = await runSessions(machine, ['--address', '5'], { readFile: busyOn(SESSION_A) });
  assert.deepEqual([several.code, several.stdout.split('\n'), several.stderr.split('\n')], [
    2,
    ['JH 5 · another', WORKER],
    ['js-harness sessions: 2 sessions carry the title of work session 5: a message to it has no single address', `js-harness sessions: 1 transcript that changed in the last 12h could not be read and is not counted: ${unreadable}`],
  ]);
  // The transcript of the session that asks is not another session's: unread, it leaves the answer whole.
  const own = await runSessions(machine, ['--address', 'orchestrator'], { readFile: busyOn(SESSION_A), env: { CLAUDE_CODE_SESSION_ID: SESSION_A } });
  assert.deepEqual([own.code, own.stderr], [1, 'js-harness sessions: no session carries the title of the orchestrator (transcripts that changed in the last 12h: 3, the one that asks is not counted)']);
  // Two that could not be read are both named.
  const two = await runSessions(machine, ['--address', '9'], { readFile: (absolute) => busyOn(SESSION_A)(absolute) && busyOn(SESSION_B)(absolute) });
  assert.deepEqual([two.code, two.stderr], [2, `js-harness sessions: not known whether a session carries the title of work session 9: 2 transcripts that changed in the last 12h could not be read: ${transcriptOf(machine, SESSION_B)} (EBUSY), ${unreadable}`]);
}));

test('--address exits 2 and prints each title when more than one session holds the role', withMachine(async (machine) => {
  writeRoster(machine);
  writeTitled(machine, SESSION_D, 'JH ORQ · other', 30);
  const several = await runSessions(machine, ['--address', 'orchestrator']);
  assert.deepEqual([several.code, several.stdout.split('\n')], [2, ['JH ORQ · other', ORCHESTRATOR]]);
  assert.equal(several.stderr, 'js-harness sessions: 2 sessions carry the title of the orchestrator: a message to it has no single address');
  // A handover names the one that arrives and the one that leaves otherwise, so one orchestrator is left.
  writeTitled(machine, SESSION_D, 'JH ORQ nueva · proj', 30);
  assert.deepEqual([(await runSessions(machine, ['--address', 'orchestrator'])).code, (await runSessions(machine, ['--address', 'orchestrator'])).stdout], [0, ORCHESTRATOR]);
}));

test('--address never counts the session that asks: CLAUDE_CODE_SESSION_ID, or --self', withMachine(async (machine) => {
  writeRoster(machine);
  const asOrchestrator = { env: { CLAUDE_CODE_SESSION_ID: SESSION_A } };
  const own = await runSessions(machine, ['--address', 'orchestrator'], asOrchestrator);
  assert.deepEqual([own.code, own.stdout, own.stderr], [1, '', 'js-harness sessions: no session carries the title of the orchestrator (transcripts that changed in the last 12h: 2, the one that asks is not counted)']);
  assert.equal((await runSessions(machine, ['--address', 'orchestrator', '--self', 'aaaaaaaa'])).code, 1);
  assert.deepEqual([(await runSessions(machine, ['--address', '5'], asOrchestrator)).stdout, (await runSessions(machine, ['--address', '5', '--self', 'bbbbbbbb'], asOrchestrator)).code], [WORKER, 1]);
  // A second session under the orchestrator's own title is another session that holds the role: the one
  // that asks is left out, the other is its answer.
  writeTitled(machine, SESSION_E, ORCHESTRATOR, 30);
  const twin = await runSessions(machine, ['--address', 'orchestrator'], { env: { CLAUDE_CODE_SESSION_ID: SESSION_E } });
  assert.deepEqual([twin.code, twin.stdout], [0, ORCHESTRATOR]);
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
  await watch(machine, ['--interval', '5', '--timeout', '10']);
  await runSessions(machine, ['--address', 'orchestrator']);
  assert.deepEqual(snapshot(), was);
}));

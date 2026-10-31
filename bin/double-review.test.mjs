import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { doubleReviewMain, parseArgs, readerModel, SKIP_PHRASE } from './double-review.mjs';
import { readDoubleReviews } from './lib/double-review-records.mjs';
import { readCodexReviews } from './lib/codex-reviews.mjs';
import { ruleHere } from './lib/rules.mjs';
import { projectSlug } from './lib/sessions.mjs';

const finding = (claim) => ({ severity: 'high', claim, evidence: 'plan.md:1', fix: 'fix it' });

function makeRepo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-double-review-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(root, 'plan.md'), '# The plan\n\nDo the thing.\n');
  git('add', '.');
  git('commit', '-q', '-m', 'one');
  fs.writeFileSync(path.join(root, 'plan.md'), '# The plan\n\nDo the thing, twice.\n');
  git('commit', '-q', '-am', 'two');
  return root;
}

/** A fake `spawn`: each child reads its prompt on stdin and answers as `answer(command, args, prompt)` says, after
 * both children have started, so a test sees whether the two were started at once. */
function fakeSpawn(answer) {
  const calls = [];
  const spawn = (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    let prompt = '';
    child.stdin.on('data', (chunk) => { prompt += chunk; });
    const call = { command, args, options, startedBefore: calls.length };
    calls.push(call);
    child.stdin.on('finish', () => setTimeout(() => {
      call.prompt = prompt;
      call.startedWhenAnswering = calls.length;
      const { stdout = '', status = 0, file, hang } = answer(command, args, prompt);
      if (hang) return;
      if (file) fs.writeFileSync(file.path, file.text);
      child.stdout.end(stdout);
      child.stderr.end('');
      setImmediate(() => child.emit('close', status));
    }, 5));
    return child;
  };
  return { spawn, calls };
}

/** The read tokens a reader finds by opening each copy the prompt lists, as a real reader would. */
const tokensIn = (prompt) => [...prompt.matchAll(/^- `([^`]+)`/gm)].map(([, copy]) => /read-token: (\S+)\s*$/.exec(fs.readFileSync(copy, 'utf8'))?.[1]);
const claudeOut = (prompt, findings, tokens = tokensIn(prompt)) =>
  JSON.stringify({ structured_output: { readTokens: tokens, findings, sound: ['the order'], unchecked: [] }, usage: { input_tokens: 10, cache_read_input_tokens: 90, output_tokens: 5 }, total_cost_usd: 0.5 });
const codexAnswer = (args, prompt, findings, tokens = tokensIn(prompt)) => ({
  stdout: [
    { type: 'item.completed', item: { id: 'm', type: 'agent_message', text: JSON.stringify({ readTokens: tokens, findings, sound: [], unchecked: ['the meter'] }) } },
    { type: 'turn.completed', usage: { input_tokens: 70, output_tokens: 7 } },
  ].map((event) => `${JSON.stringify(event)}\n`).join(''),
});
/** Every file under `folder`, as paths relative to it. */
const filesUnder = (folder) => fs.readdirSync(folder, { recursive: true }).filter((one) => fs.statSync(path.join(folder, one)).isFile()).map((one) => one.split(path.sep).join('/')).sort();

function deps(t, root, spawn, extra = {}) {
  const lines = { log: [], error: [] };
  const leanParent = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-double-review-lean-'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-double-review-tmp-'));
  t.after(() => fs.rmSync(leanParent, { recursive: true, force: true }));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const disposed = [];
  return {
    lines,
    disposed,
    tmp,
    deps: {
      log: (line) => lines.log.push(line),
      error: (line) => lines.error.push(line),
      spawn,
      platform: 'linux',
      tmpdir: () => tmp,
      now: () => new Date('2026-10-31T17:00:00Z'),
      id: () => 'read-1',
      resolveClaude: () => ({ path: '/bin/claude', shell: false }),
      makeLeanHome: () => {
        const home = fs.mkdtempSync(path.join(leanParent, 'home-'));
        return { home, dispose: () => disposed.push(home) };
      },
      cwd: root,
      ...extra,
    },
  };
}

test('parseArgs refuses an unknown argument, a missing verb, a take with no --taken and a skip without the user\'s words', () => {
  assert.throws(() => parseArgs(['read', 'a.md', '--bogus']), /unknown argument: --bogus/);
  assert.throws(() => parseArgs([]), /a verb is needed/);
  assert.throws(() => parseArgs(['--bogus']), /^Error: unknown argument: --bogus$/);
  assert.throws(() => parseArgs(['review']), /not a verb: review/);
  assert.throws(() => parseArgs(['take', 'r1', 'claude']), /--taken/);
  assert.throws(() => parseArgs(['take', 'r1', 'gemini', '--taken', '1']), /not a reader: gemini/);
  assert.throws(() => parseArgs(['skip', '--what', 'the plan']), /skip needs --words/);
  assert.throws(() => parseArgs(['tally', '--since', 'yesterday']), /YYYY-MM-DD/);
  assert.deepEqual(parseArgs(['take', 'r1', 'codex', '--taken', '1,3', '--shared', '3']).taken, [1, 3]);
});

test('a usage error exits 2 with the one line and the usage, and starts nothing', async (t) => {
  const root = makeRepo(t);
  const { spawn, calls } = fakeSpawn(() => ({}));
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md', '--bogus'], {}, run.deps), 2);
  assert.match(run.lines.error[0], /^unknown argument: --bogus\n\nUsage: js-harness double-review/);
  assert.equal(calls.length, 0);
});

test('--plan says what a read costs and the user\'s words that skip it, and starts and records nothing', async (t) => {
  const root = makeRepo(t);
  const { spawn, calls } = fakeSpawn(() => ({}));
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md', '--plan'], {}, run.deps), 0);
  const said = run.lines.log.join('\n');
  assert.match(said, /Claude reader on opus and a Codex reader/, 'a project that does not declare the reader model reads on its alias');
  assert.match(said, /tokens/);
  assert.ok(said.includes(SKIP_PHRASE));
  assert.equal(calls.length, 0);
  assert.deepEqual(readDoubleReviews(root), []);
});

test('in this repository the Claude reader runs on the model its rule sets', () => {
  const repo = path.resolve(import.meta.dirname, '..');
  assert.equal(readerModel(repo), ruleHere('subagent-reader-model', undefined, fs.readFileSync(path.join(repo, 'bin', 'lib', 'rules-data.mjs'), 'utf8')).value);
});

test('read starts both readers at once on one frozen copy outside the repository, blind, and records both once both return', async (t) => {
  const root = makeRepo(t);
  let copied = null;
  let onDisk = null;
  const { spawn, calls } = fakeSpawn((command, args, prompt) => {
    if (command === 'codex') return codexAnswer(args, prompt, [finding('codex one')]);
    const material = args[args.indexOf('--add-dir') + 1];
    copied = fs.readFileSync(path.join(material, '1-plan.md'), 'utf8');
    onDisk = filesUnder(path.dirname(material));
    return { stdout: claudeOut(prompt, [finding('claude one'), finding('claude two')]) };
  });
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md', '--diff', 'HEAD~1'], {}, run.deps), 0);

  const [claude, codex] = [calls.find((c) => c.command !== 'codex'), calls.find((c) => c.command === 'codex')];
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.startedWhenAnswering === 2), 'each reader answered only after both had started');
  assert.equal(claude.prompt, codex.prompt, 'both readers get the same prompt');
  const material = claude.args[claude.args.indexOf('--add-dir') + 1];
  const fromRoot = path.relative(root, material);
  assert.ok(fromRoot.startsWith('..') || path.isAbsolute(fromRoot), 'the copy is outside the repository');
  assert.ok(claude.prompt.includes(path.join(material, '1-plan.md')));
  assert.match(copied, /twice/, 'the copy is of the file as it stands');
  assert.match(copied, /\nread-token: [0-9a-f]{16}\n$/, 'the copy ends with its read token');
  assert.match(claude.prompt, /diff\.patch/);
  assert.equal(claude.options.cwd, root);
  assert.deepEqual(claude.args.slice(0, 4), ['-p', '--safe-mode', '--tools', 'Read,Grep,Glob']);
  // Blind by sequence: neither answer is on disk while the readers run, since --add-dir confines no reader.
  assert.ok(!codex.args.includes('-o'), 'Codex writes no answer file: its answer is read from its stdout');
  assert.ok(codex.args.includes('--ephemeral'), 'Codex keeps no session file another reader could open');
  assert.ok(claude.args.includes('--no-session-persistence'), 'nor does Claude');
  assert.deepEqual(onDisk, ['material/1-plan.md', 'material/diff.patch', 'schema.json', 'settings.json'], 'while a reader runs, the folder holds the copy and the settings, no answer');
  assert.ok(codex.args.includes('--ignore-user-config'), 'Codex runs in the lean session of codex-review');
  assert.ok(run.disposed.length === 1, 'the lean Codex home is disposed');

  const [record] = readDoubleReviews(root);
  assert.equal(record.kind, 'read');
  assert.equal(record.id, 'read-1');
  assert.deepEqual(record.files, ['plan.md']);
  assert.equal(record.diff, 'HEAD~1');
  assert.match(record.hash, /^[0-9a-f]{64}$/);
  assert.ok(!claude.prompt.includes(record.hash), 'the hash is not in the prompt, so no reader can echo it unread');
  assert.equal(record.moved, undefined, 'the repository did not move while they read');
  assert.deepEqual(record.readers.map((one) => [one.reader, one.outcome, one.findings.length]), [['claude', 'answered', 2], ['codex', 'answered', 1]]);
  assert.deepEqual(record.readers[0].usage, { inputTokens: 100, outputTokens: 5 });
  assert.deepEqual(record.readers[1].usage, { inputTokens: 70, outputTokens: 7 });
  assert.deepEqual(readCodexReviews(root), [], 'a read covers no code');
  assert.ok(!fs.existsSync(material), 'the frozen copy is removed once recorded');
  assert.match(run.lines.log.join('\n'), /double-review take read-1 claude --taken/);
});

test('a reader that does not echo the read token of every copy did not open them: the read is recorded as failed for it, exit 1', async (t) => {
  const root = makeRepo(t);
  const { spawn } = fakeSpawn((command, args, prompt) =>
    command === 'codex' ? codexAnswer(args, prompt, [finding('codex one')], tokensIn(prompt).slice(1)) : { stdout: claudeOut(prompt, []) });
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md', '--diff', 'HEAD~1'], {}, run.deps), 1);
  const [record] = readDoubleReviews(root);
  assert.deepEqual(record.readers.map((one) => one.outcome), ['answered', 'failed']);
  assert.match(record.readers[1].reason, /read token of 1-plan\.md/);
});

test('a read during which the repository moves says so and records it, since the readers then checked different states', async (t) => {
  const root = makeRepo(t);
  const { spawn } = fakeSpawn((command, args, prompt) => {
    if (command === 'codex') return codexAnswer(args, prompt, []);
    fs.writeFileSync(path.join(root, 'plan.md'), '# The plan\n\nChanged while they read.\n');
    return { stdout: claudeOut(prompt, []) };
  });
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md'], {}, run.deps), 0);
  assert.match(run.lines.error.join('\n'), /the repository moved while the readers read it: plan\.md/);
  assert.equal(readDoubleReviews(root)[0].moved, true);
});

test('a read whose record cannot be written still prints what both readers found, and exits 1', async (t) => {
  const root = makeRepo(t);
  fs.writeFileSync(path.join(root, '.git', 'js-harness'), 'a file where the record folder goes\n');
  const { spawn } = fakeSpawn((command, args, prompt) =>
    command === 'codex' ? codexAnswer(args, prompt, [finding('codex one')]) : { stdout: claudeOut(prompt, [finding('claude one')]) });
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md'], {}, run.deps), 1);
  const said = run.lines.log.join('\n');
  assert.match(said, /claude 1\. \[high\] claude one/);
  assert.match(said, /codex 1\. \[high\] codex one/);
  assert.match(run.lines.error.join('\n'), /could not be recorded/);
});

test('the frozen diff is git\'s own patch: an external diff tool or a text conversion in the user\'s config is not run', async (t) => {
  const root = makeRepo(t);
  spawnSync('git', ['config', 'diff.external', 'no-such-diff-tool'], { cwd: root });
  spawnSync('git', ['config', 'color.ui', 'always'], { cwd: root });
  let patch = null;
  const { spawn } = fakeSpawn((command, args, prompt) => {
    if (command === 'codex') return codexAnswer(args, prompt, []);
    patch = fs.readFileSync(path.join(args[args.indexOf('--add-dir') + 1], 'diff.patch'), 'utf8');
    return { stdout: claudeOut(prompt, []) };
  });
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md', '--diff', 'HEAD~1'], {}, run.deps), 0);
  assert.match(patch, /^\+Do the thing, twice\.$/m);
  assert.ok(!patch.includes('\u001b['), 'no color codes');
});

test('a lean Codex home that is not left clean is said', async (t) => {
  const root = makeRepo(t);
  const { spawn } = fakeSpawn((command, args, prompt) => (command === 'codex' ? codexAnswer(args, prompt, []) : { stdout: claudeOut(prompt, []) }));
  const run = deps(t, root, spawn, { makeLeanHome: () => ({ home: os.tmpdir(), dispose: () => 'the login link could not be removed' }) });
  assert.equal(await doubleReviewMain(['read', 'plan.md'], {}, run.deps), 0);
  assert.match(run.lines.error.join('\n'), /lean Codex home .*not left clean: the login link could not be removed/);
});

test('a reader past its timeout that cannot be stopped is said, and its lean home and copy are kept, not removed under it', async (t) => {
  const root = makeRepo(t);
  const { spawn } = fakeSpawn((command, args, prompt) => (command === 'codex' ? { hang: true } : { stdout: claudeOut(prompt, []) }));
  const kills = [];
  const run = deps(t, root, spawn, { readTimeoutMs: 50, kill: (child) => { kills.push(child); throw new Error('pid 42 still running after the kill'); } });
  assert.equal(await doubleReviewMain(['read', 'plan.md'], {}, run.deps), 1);
  assert.equal(kills.length, 1);
  const [record] = readDoubleReviews(root);
  assert.match(record.readers[1].reason, /could not be stopped: pid 42 still running/);
  assert.deepEqual(run.disposed, [], 'the lean home of a reader still running is not removed');
  const said = run.lines.error.join('\n');
  assert.match(said, /kept .*js-harness-double-review-/);
  const kept = /kept (.+?): a reader that could not be stopped/.exec(said)[1];
  t.after(() => fs.rmSync(kept, { recursive: true, force: true }));
  assert.ok(fs.existsSync(kept), 'the copy a reader may still read is kept');
});

test('a missing file is refused before anything starts', async (t) => {
  const root = makeRepo(t);
  const { spawn, calls } = fakeSpawn(() => ({}));
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'nope.md'], {}, run.deps), 1);
  assert.match(run.lines.error.join('\n'), /nope\.md/);
  assert.equal(calls.length, 0);
});

test('take records which findings the writer took and which the other reader also found, and tally counts them', async (t) => {
  const root = makeRepo(t);
  const { spawn } = fakeSpawn((command, args, prompt) =>
    command === 'codex' ? codexAnswer(args, prompt, [finding('c1'), finding('c2')]) : { stdout: claudeOut(prompt, [finding('a1')]) });
  const run = deps(t, root, spawn);
  await doubleReviewMain(['read', 'plan.md'], {}, run.deps);
  assert.equal(await doubleReviewMain(['take', 'read-1', 'codex', '--taken', '3'], {}, run.deps), 1, 'codex gave two findings');
  assert.equal(await doubleReviewMain(['take', 'read-9', 'codex', '--taken', '1'], {}, run.deps), 1, 'no such read');
  assert.equal(await doubleReviewMain(['take', 'read-1', 'codex', '--taken', '1,2', '--shared', '2', '--why', 'both sound'], {}, run.deps), 0);
  assert.equal(await doubleReviewMain(['take', 'read-1', 'claude', '--taken', 'none'], {}, run.deps), 0);
  const takes = readDoubleReviews(root).filter((entry) => entry.kind === 'take');
  assert.deepEqual(takes.map((entry) => [entry.reader, entry.taken, entry.shared]), [['codex', [1, 2], [2]], ['claude', [], []]]);
  run.lines.log.length = 0;
  assert.equal(await doubleReviewMain(['tally'], {}, run.deps), 0);
  assert.deepEqual(run.lines.log, [
    'claude: 1 read, 1 finding, 1 judged, 0 taken, 0 found by it alone',
    'codex: 1 read, 2 findings, 2 judged, 2 taken, 1 found by it alone',
  ]);
});

const AT = '2026-10-31T17:00:00.000Z';
const TRANSCRIPT = [
  JSON.stringify({ type: 'user', origin: { kind: 'human' }, timestamp: AT, message: { role: 'user', content: 'Sigue con el plan, no quiero la revisión de este' } }),
  JSON.stringify({ type: 'assistant', timestamp: AT, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'q1', name: 'AskUserQuestion', input: { questions: [{ question: '¿Lo leen?', header: 'Lectura', options: [{ label: 'no quiero la revisión', description: 'sin lectura' }, { label: 'Sí', description: 'con lectura' }] }] } }] } }),
  JSON.stringify({ type: 'user', timestamp: AT, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'q1', content: 'answered' }] }, toolUseResult: { answers: { '¿Lo leen?': 'no quiero la revisión' } } }),
].join('\n');
const transcriptOf = (session) => (session === 's1' ? TRANSCRIPT : null);
const skipArgv = (words, line) => ['skip', '--what', 'the plan of JH 130', '--words', words, '--transcript', 's1', '--line', String(line)];

test('skip records the user\'s typed words that skip a read, checked at the line of the transcript they are read at', async (t) => {
  const root = makeRepo(t);
  const run = deps(t, root, fakeSpawn(() => ({})).spawn, { transcriptOf });
  assert.equal(await doubleReviewMain(skipArgv('no quiero la revisión de este', 1), {}, run.deps), 0);
  const [skip] = readDoubleReviews(root);
  assert.deepEqual([skip.kind, skip.what, skip.words, skip.transcript, skip.line, skip.date], ['skip', 'the plan of JH 130', 'no quiero la revisión de este', 's1', 1, '2026-10-31']);
});

test('skip reads the transcript where the board does, in the sessions folder of the checkout or of any of its worktrees', async (t) => {
  const root = makeRepo(t);
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-double-review-claude-'));
  t.after(() => fs.rmSync(claudeHome, { recursive: true, force: true }));
  const tree = `${root}-tree`;
  spawnSync('git', ['worktree', 'add', '-q', '--detach', tree], { cwd: root });
  t.after(() => fs.rmSync(tree, { recursive: true, force: true }));
  const listed = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout;
  const treeAsGit = [...listed.matchAll(/^worktree (.+)$/gm)].map(([, one]) => one.trim())[1];
  const session = '5d0c3f7e-1111-4222-8333-944455556666';
  const folder = path.join(claudeHome, 'projects', projectSlug(treeAsGit));
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${session}.jsonl`), TRANSCRIPT);
  const run = deps(t, root, fakeSpawn(() => ({})).spawn);
  assert.equal(await doubleReviewMain(['skip', '--what', 'the plan', '--words', 'no quiero la revisión de este', '--transcript', session, '--line', '1'], { CLAUDE_CONFIG_DIR: claudeHome }, run.deps), 0, run.lines.error.join('\n'));
  assert.equal(readDoubleReviews(root)[0].transcript, session);
});

test('skip refuses words he did not type at that line: a tapped answer, words not in the line, a missing transcript', async (t) => {
  const root = makeRepo(t);
  const run = deps(t, root, fakeSpawn(() => ({})).spawn, { transcriptOf });
  assert.equal(await doubleReviewMain(skipArgv('no quiero la revisión', 3), {}, run.deps), 1);
  assert.match(run.lines.error.at(-1), /tapped answer/);
  assert.equal(await doubleReviewMain(skipArgv('sáltate la revisión', 1), {}, run.deps), 1);
  assert.match(run.lines.error.at(-1), /not in what he typed/);
  assert.equal(await doubleReviewMain([...skipArgv('no quiero la revisión', 1).slice(0, 5), '--transcript', 's9', '--line', '1'], {}, run.deps), 1);
  assert.match(run.lines.error.at(-1), /no transcript "s9"/);
  assert.deepEqual(readDoubleReviews(root), [], 'nothing is recorded');
});

test('tally with no read says so', async (t) => {
  const root = makeRepo(t);
  const run = deps(t, root, fakeSpawn(() => ({})).spawn);
  assert.equal(await doubleReviewMain(['tally', '--since', '2026-11-01'], {}, run.deps), 0);
  assert.deepEqual(run.lines.log, ['no double review read since 2026-11-01']);
});

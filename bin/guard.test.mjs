// `js-harness guard --hook`, the `PreToolUse` hook: what it prints for each tool call it is handed, and that it
// always exits 0 (odd/tasks/honesty-audit.md, T13 and T14).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { guardMain } from './guard.mjs';
import { RULES } from './lib/rules-data.mjs';
import { writeRules } from './lib/rules.mjs';
import { testRunWarning } from './lib/test-run-warning.mjs';
import { wrappedCommitHint } from './lib/wrapped-commit.mjs';

const AT_1444 = new Date(2026, 9, 14, 14, 44, 30);

/** Runs the hook on `payload` (an object, or a raw text) in a project whose rules file reads `rulesText` (null for
 * none), with the machine's gate lock held by `held` (null for free), and returns `{ code, out, err }`. */
async function hook(payload, { rulesText = writeRules(RULES), now = AT_1444, args = ['--hook'], held = null, timed = {}, index = null, configDir, exists = () => false, baseContains } = {}) {
  const out = [];
  const err = [];
  const code = await guardMain(args, {
    readStdin: () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
    now: () => now,
    projectRoot: () => 'D:/project',
    readFile: (file) => {
      assert.equal(file.replace(/\\/g, '/'), 'D:/project/bin/lib/rules-data.mjs');
      if (rulesText === null) throw Object.assign(new Error('no file'), { code: 'ENOENT' });
      return rulesText;
    },
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    // `timed` stands in for the gate log: the seconds a gate ran each file alone, by its name.
    testRun: (command, options) => testRunWarning(command, { env: {}, holder: () => held, fileSeconds: (file) => timed[file], ...options }),
    claudeConfigDir: configDir,
    baseContains,
    env: {},
    exists,
    readIndex: () => {
      if (index === null) throw Object.assign(new Error('no file'), { code: 'ENOENT' });
      return index;
    },
  });
  return { code, out: out.join(''), err: err.join('') };
}

const denied = (result) => JSON.parse(result.out).hookSpecificOutput;

test('a command typed into his terminal is denied without its note at the end, and passes with one', async () => {
  const bare = await hook({ tool_name: 'mcp__terminal__run_in_terminal', cwd: 'D:/project', tool_input: { command: 'npm test' } });
  assert.equal(bare.code, 0);
  assert.equal(denied(bare).permissionDecision, 'deny');
  assert.match(denied(bare).permissionDecisionReason, /ends with a note that says what it does/);
  const noted = { command: "npm test; Write-Host 'NOTE: runs the tests of this repository and prints how many pass'" };
  assert.deepEqual(await hook({ tool_name: 'mcp__terminal__run_in_terminal', cwd: 'D:/project', tool_input: noted }), { code: 0, out: '', err: '' });
});

test('an Agent call on a model no rule gives is denied in this repository, and one on an alias passes', async () => {
  const refused = await hook({ tool_name: 'Agent', cwd: 'D:/project', tool_input: { prompt: 'p', model: 'sonnet' } });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecision, 'deny');
  assert.match(denied(refused).permissionDecisionReason, /"sonnet"/);
  for (const model of ['haiku', 'opus', undefined]) {
    assert.deepEqual(await hook({ tool_name: 'Agent', cwd: 'D:/project', tool_input: { prompt: 'p', model } }), { code: 0, out: '', err: '' }, String(model));
  }
});

test('in a project without the rules, an Agent call on any model passes', async () => {
  assert.deepEqual(await hook({ tool_name: 'Agent', cwd: 'D:/project', tool_input: { model: 'sonnet' } }, { rulesText: null }), { code: 0, out: '', err: '' });
});

// odd/tasks/session-channel.md, layer 3 (his answers of 2026-10-15): refused where the rule is declared, even when he asked.
test('a scheduled-task or cloud tool that opens a session is denied in the project that declares the rule, naming start_session', async () => {
  for (const tool_name of ['mcp__scheduled-tasks__create_scheduled_task', 'RemoteTrigger']) {
    const refused = await hook({ tool_name, cwd: 'D:/project', tool_input: { prompt: 'p' } });
    assert.equal(refused.code, 0, tool_name);
    assert.equal(denied(refused).permissionDecision, 'deny', tool_name);
    assert.match(denied(refused).permissionDecisionReason, new RegExp(`^js-harness guard: ${tool_name} opens a session`), tool_name);
    assert.match(denied(refused).permissionDecisionReason, /sessions-open-in-sidebar.*start_session/s, tool_name);
  }
  assert.deepEqual(await hook({ tool_name: 'mcp__scheduled-tasks__delete_scheduled_task', cwd: 'D:/project', tool_input: { id: 'x' } }), { code: 0, out: '', err: '' }, 'delete passes');
});

// odd/tasks/harness-review.md, T6c: a session started with no effort ran at the max of the session that started it.
test('a session started with no effort, or above the rule session-effort, is denied where the rule is declared', async () => {
  const brief = { initiation: 'own_initiative', title: 'T9', prompt: 'Do T9.', background: 'x'.repeat(80) };
  for (const tool_input of [brief, { ...brief, effort: 'max' }, { ...brief, context: 'fork' }]) {
    const refused = await hook({ tool_name: 'mcp__ccd_session__start_session', cwd: 'D:/project', tool_input });
    assert.equal(denied(refused).permissionDecision, 'deny', JSON.stringify(tool_input));
    assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: start_session .*session-effort: high/, JSON.stringify(tool_input));
  }
  const passes = { code: 0, out: '', err: '' };
  assert.deepEqual(await hook({ tool_name: 'mcp__ccd_session__start_session', cwd: 'D:/project', tool_input: { ...brief, effort: 'high' } }), passes);
  assert.deepEqual(await hook({ tool_name: 'mcp__ccd_session__start_session', cwd: 'D:/project', tool_input: brief }, { rulesText: null }), passes, 'no rules');
});

// Section 17, "The try": the lead's real try, as a hand reproduction makes it, through the public command in this
// repository, which declares the rule. The payload is read from a file: in Git Bash, `echo` of it turns the path's
// `\\` into `\`, a bad JSON escape, and the guard, which exits 0 on any failure, prints nothing.
test('the try of section 17, read from a file, is denied by the public command in this repository', () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-try-'));
  const guard = (text) => {
    const file = path.join(dir, 'payload.json');
    fs.writeFileSync(file, text);
    const input = fs.openSync(file, 'r');
    try {
      return spawnSync(process.execPath, [path.join(repo, 'bin', 'js-harness.mjs'), 'guard', '--hook'], { stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 30000 });
    } finally {
      fs.closeSync(input);
    }
  };
  try {
    const payload = {
      tool_name: 'mcp__scheduled-tasks__create_scheduled_task',
      tool_input: { taskId: 'jh-t16-harmless-try', prompt: '', description: 'harmless try' },
      cwd: repo,
      hook_event_name: 'PreToolUse',
    };
    const refused = guard(`${JSON.stringify(payload)}\n`);
    assert.equal(refused.status, 0, refused.stderr);
    assert.equal(JSON.parse(refused.stdout).hookSpecificOutput.permissionDecision, 'deny');
    assert.match(JSON.parse(refused.stdout).hookSpecificOutput.permissionDecisionReason, /^js-harness guard: mcp__scheduled-tasks__create_scheduled_task opens a session.*sessions-open-in-sidebar.*start_session/s);
    const broken = guard('{"tool_name":"mcp__scheduled-tasks__create_scheduled_task","tool_input":{},"cwd":"D:\\js-harness"}\n');
    assert.deepEqual([broken.status, broken.stdout], [0, ''], 'a payload whose path lost a backslash is not JSON, and passes');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('in a project without the rules, the tools that open a session pass', async () => {
  const quiet = { code: 0, out: '', err: '' };
  for (const tool_name of ['mcp__scheduled-tasks__run_scheduled_task', 'RemoteTrigger']) {
    assert.deepEqual(await hook({ tool_name, cwd: 'D:/project', tool_input: {} }, { rulesText: null }), quiet, tool_name);
  }
});

test('a message to another session, by either tool, is denied when its stamped hour is off the clock', async () => {
  for (const tool_name of ['SendMessage', 'mcp__ccd_session_mgmt__send_message']) {
    const refused = await hook({ tool_name, tool_input: { to: 'x', session_id: 'y', message: 'From the lead, 14:48 local by date. Merged.' } });
    assert.equal(refused.code, 0, tool_name);
    assert.match(denied(refused).permissionDecisionReason, /stamps 14:48, and the clock says 14:44/, tool_name);
    assert.deepEqual(await hook({ tool_name, tool_input: { message: 'From the lead, 14:44 local. Merged.' } }), { code: 0, out: '', err: '' }, tool_name);
  }
});

// odd/tasks/session-channel.md, T12b: failure `hours-guessed` was seen on 2026-10-14 in a block a session committed,
// "**2026-10-14, about 05:40: the README is merged" written when the clock read 05:15.
test('a Write or an Edit of a Markdown file whose line opens with today and an hour ahead of the clock is denied', async () => {
  const ahead = [
    { tool_name: 'Write', tool_input: { file_path: 'D:/proj/odd/tasks/a.md', content: '# A\n\n**2026-10-14, about 15:05: the README is merged.\n' } },
    { tool_name: 'Edit', tool_input: { file_path: 'D:\\proj\\odd\\tasks\\a.md', old_string: 'x', new_string: '- 2026-10-14 14:50 — T3 done.' } },
    { tool_name: 'Write', tool_input: { file_path: 'D:/proj/docs/NOTES.MD', content: 'Resume state, written 2026-10-14 14:47 by the clock.\n' } },
  ];
  for (const payload of ahead) {
    const refused = await hook(payload);
    assert.equal(refused.code, 0, payload.tool_input.file_path);
    assert.equal(denied(refused).permissionDecision, 'deny', payload.tool_input.file_path);
    assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: line \d+ of the file this call leaves stamps 2026-10-14 1[45]:\d\d, and the clock says 14:44\./);
  }
  assert.match(denied(await hook(ahead[0])).permissionDecisionReason, /line 3 of the file this call leaves stamps 2026-10-14 15:05/);
});

test('an hour at the clock, behind it, on another day, inside a line, or in a file that is not Markdown passes', async () => {
  const quiet = { code: 0, out: '', err: '' };
  const passes = [
    { file_path: 'D:/proj/odd/tasks/a.md', content: '**2026-10-14, about 14:45: merged.\n- 2026-10-14 09:10 — earlier.\n' },
    { file_path: 'D:/proj/odd/tasks/a.md', content: '- 2026-10-13 23:50 — yesterday.\n- 2026-10-15 08:00 — another day.\n' },
    { file_path: 'D:/proj/odd/tasks/a.md', content: 'The wait ends at 2026-10-14 16:00, planned.\n' },
    { file_path: 'D:/proj/bin/a.test.mjs', content: "const line = '- 2026-10-14 23:59 — fixture';\n" },
  ];
  for (const tool_input of passes) assert.deepEqual(await hook({ tool_name: 'Write', tool_input }), quiet, tool_input.content);
});

// Codex on 9d976e3: an Edit that replaces part of a line was judged as if its fragment were the whole line.
test('an Edit of a Markdown file is judged by the lines it leaves, read from disk, numbered in that file', async () => {
  const index = '# A\n\n**2026-10-14, about 14:30: merged.\nThe wait ends at 2026-10-14 16:00, planned.\n';
  const stamp = await hook({ tool_name: 'Edit', tool_input: { file_path: 'D:/proj/odd/tasks/a.md', old_string: '14:30', new_string: '15:10' } }, { index });
  assert.match(denied(stamp).permissionDecisionReason, /^js-harness guard: line 3 of the file this call leaves stamps 2026-10-14 15:10, and the clock says 14:44\./);
  const plan = await hook({ tool_name: 'Edit', tool_input: { file_path: 'D:/proj/odd/tasks/a.md', old_string: '16:00', new_string: '17:00' } }, { index });
  assert.deepEqual(plan, { code: 0, out: '', err: '' });
  const ahead = '**2026-10-14, about 15:30: written ahead before the check.\n';
  const kept = await hook({ tool_name: 'Edit', tool_input: { file_path: 'D:/proj/odd/tasks/a.md', old_string: 'x', new_string: 'y' } }, { index: `${ahead}x\n` });
  assert.deepEqual(kept, { code: 0, out: '', err: '' }, 'a line already on disk is not the call\'s');
});

test('a Bash command with backticks inside double quotes is denied; in single quotes or as $(...) it passes', async () => {
  const refused = await hook({ tool_name: 'Bash', tool_input: { command: 'git commit -m "fix the `check` row"' } });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecision, 'deny');
  assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: backticks inside double quotes run as commands in bash \(`check`\)/);
  for (const command of ["git commit -m 'fix the `check` row'", 'echo "today is $(date)"']) {
    assert.deepEqual(await hook({ tool_name: 'Bash', tool_input: { command } }), { code: 0, out: '', err: '' }, command);
  }
});

test('a Bash rm -rf of a folder at the top of a drive is denied with where to put it; one below the worktrees folder passes', async () => {
  const refused = await hook({ tool_name: 'Bash', tool_input: { command: 'rm -rf D:/practice-jh22 && node scripts/practice.mjs setup' } });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecision, 'deny');
  assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: D:\/practice-jh22 is the top of a drive/);
  const command = 'rm -rf D:/js-harness-worktrees/practice/jh22';
  assert.deepEqual(await hook({ tool_name: 'Bash', tool_input: { command } }), { code: 0, out: '', err: '' });
});

test('a gentle-ai review given a base its head does not contain is denied, looked up in the folder of the call; one it contains passes', async () => {
  const asked = [];
  const command = 'gentle-ai review assess --agent claude-code --base-ref origin/main --committed-only --json';
  const refused = await hook({ tool_name: 'Bash', cwd: 'D:/w/behind', tool_input: { command } }, { baseContains: (base, cwd) => { asked.push([base, cwd]); return false; } });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecision, 'deny');
  assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: --base-ref origin\/main is not on this head's first-parent line/);
  assert.deepEqual(asked, [['origin/main', 'D:/w/behind']]);
  assert.deepEqual(await hook({ tool_name: 'Bash', cwd: 'D:/w/fresh', tool_input: { command } }, { baseContains: () => true }), { code: 0, out: '', err: '' });
});

test('a node --test of several files outside a turn is denied while another gate holds the lock, with its warning unchanged', async () => {
  const held = { pid: 4242, cwd: 'D:/js-harness-worktrees/other' };
  const command = 'node --test bin/a.test.mjs bin/b.test.mjs';
  const refused = await hook({ tool_name: 'Bash', tool_input: { command } }, { held });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecisionReason, testRunWarning(command, { env: {}, holder: () => held }));
  assert.match(denied(refused).permissionDecisionReason, /holds the machine's gate lock/);
  const quiet = { code: 0, out: '', err: '' };
  assert.deepEqual(await hook({ tool_name: 'Bash', tool_input: { command } }), quiet, 'the lock is free');
  assert.deepEqual(await hook({ tool_name: 'Bash', tool_input: { command: 'node --test bin/a.test.mjs' } }, { held }), quiet, 'one file');
  assert.deepEqual(await hook({ tool_name: 'Bash', tool_input: { command: `js-harness gate -- ${command}` } }, { held }), quiet, 'in a turn');
});

test('one file the gate log timed over a minute is denied beside a gate, named from the folder of the payload (first-version T6a)', async () => {
  const held = { pid: 4242, cwd: 'D:/js-harness-worktrees/other' };
  const timed = { 'bin/slow.test.mjs': 95 };
  const refused = await hook({ tool_name: 'Bash', cwd: 'D:/w', tool_input: { command: 'node --test D:/w/bin/slow.test.mjs' } }, { held, timed });
  assert.equal(denied(refused).permissionDecisionReason, "node --test of bin/slow.test.mjs, which the gate log timed at 95 s, starts outside a turn while the gate of D:/js-harness-worktrees/other holds the machine's gate lock: both share the cores and miss their bounds; run it with js-harness gate -- <command>, which waits its turn");
  const quiet = { code: 0, out: '', err: '' };
  assert.deepEqual(await hook({ tool_name: 'Bash', cwd: 'D:/w', tool_input: { command: 'node --test bin/quick.test.mjs' } }, { held, timed }), quiet, 'a file never timed');
  assert.deepEqual(await hook({ tool_name: 'Bash', cwd: 'D:/w', tool_input: { command: 'node --test bin/slow.test.mjs' } }, { timed }), quiet, 'the lock is free');
});

test('a commit wrapped in js-harness gate -- runs, with the hint beside its result; a denial on the same call wins (S4)', async () => {
  const workflow = (file) => file.replace(/\\/g, '/') === 'D:/project/.github/workflows/gate.yml';
  const command = 'js-harness gate -- git commit -m x';
  const hinted = await hook({ tool_name: 'Bash', cwd: 'D:/project', tool_input: { command } }, { exists: workflow });
  assert.equal(hinted.code, 0);
  assert.deepEqual(JSON.parse(hinted.out), { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: wrappedCommitHint(command, { cwd: 'D:/project', env: {}, projectRoot: () => 'D:/project', exists: workflow }) } });
  assert.match(denied(hinted).additionalContext, /could not go to GitHub's machines/);
  assert.equal(denied(hinted).permissionDecision, undefined);
  const refused = await hook({ tool_name: 'Bash', cwd: 'D:/project', tool_input: { command: 'js-harness gate -- git commit -m "fix the `check` row"' } }, { exists: workflow });
  assert.equal(denied(refused).permissionDecision, 'deny');
  assert.equal(denied(refused).additionalContext, undefined);
  const quiet = { code: 0, out: '', err: '' };
  assert.deepEqual(await hook({ tool_name: 'Bash', cwd: 'D:/project', tool_input: { command: 'js-harness gate -- node --test bin/a.test.mjs bin/b.test.mjs' } }, { exists: workflow }), quiet, 'a wrapped test run');
  assert.deepEqual(await hook({ tool_name: 'Bash', cwd: 'D:/project', tool_input: { command: 'git commit -m x' } }, { exists: workflow }), quiet, 'a plain commit');
});

test('any other tool, an unreadable payload, or a failure inside passes silently with exit 0', async () => {
  const quiet = { code: 0, out: '', err: '' };
  assert.deepEqual(await hook({ tool_name: 'Bash', tool_input: { command: 'From the lead, 09:00 local.' } }), quiet);
  assert.deepEqual(await hook('not json'), quiet);
  assert.deepEqual(await hook(''), quiet);
  assert.deepEqual(await hook({ tool_name: 'Agent', cwd: 'D:/project', tool_input: { model: 'sonnet' } }, { rulesText: 42 }), quiet);
});

// T4 of odd/tasks/memory-hygiene.md: the memory index grew to lines of 844 characters, read on every turn; the host's
// own limit is about 150 (the consolidate-memory skill). A Write or an Edit of a project's memory MEMORY.md that puts
// a longer line there is refused when it is written, which is cheaper than any clean-up after it.
const INDEX = 'C:/Users/u/.claude/projects/D--proj/memory/MEMORY.md';
const longLine = `- [A](a.md) — ${'x'.repeat(140)}`;

test('a Write or an Edit that puts an index line over 150 characters in a memory MEMORY.md is denied, naming the line', async () => {
  const written = await hook({ tool_name: 'Write', tool_input: { file_path: INDEX, content: `- [B](b.md) — short\n${longLine}\n` } });
  assert.equal(written.code, 0);
  assert.equal(denied(written).permissionDecision, 'deny');
  assert.match(denied(written).permissionDecisionReason, /^js-harness guard: line 2 of the memory index is 154 characters, over the host's 150/);
  assert.match(denied(written).permissionDecisionReason, /put the detail in the note/);
  const edited = await hook({ tool_name: 'Edit', tool_input: { file_path: INDEX.replace(/\//g, '\\'), old_string: 'x', new_string: longLine } });
  assert.equal(denied(edited).permissionDecision, 'deny');
});

test('short index lines, a note of the memory, and any other file pass, without reading the rules or the gate lock', async () => {
  const quiet = { code: 0, out: '', err: '' };
  const untouched = { readFile: () => assert.fail('rules read'), testRun: () => assert.fail('gate lock read') };
  const calls = [
    { tool_name: 'Write', tool_input: { file_path: INDEX, content: '- [B](b.md) — short\n' } },
    { tool_name: 'Write', tool_input: { file_path: INDEX.replace('MEMORY.md', 'a.md'), content: `${longLine}\n` } },
    { tool_name: 'Write', tool_input: { file_path: 'D:/proj/docs/MEMORY.md', content: `${longLine}\n` } },
    { tool_name: 'Edit', tool_input: { file_path: 'D:/proj/src/a.js', old_string: 'a', new_string: longLine } },
  ];
  for (const payload of calls) {
    const out = [];
    const code = await guardMain(['--hook'], { readStdin: () => JSON.stringify(payload), stdout: (t) => out.push(t), stderr: () => {}, projectRoot: () => assert.fail('git asked'), readIndex: () => '', ...untouched });
    assert.deepEqual({ code, out: out.join(''), err: '' }, quiet, payload.tool_input.file_path);
  }
});

// The verifier of T4: an index line grows by a short clause, a join or a replace_all far more often than by a whole new
// line, so an Edit is judged by the file it leaves, read from disk, with the line numbered in that file.
const onDisk = `- [B](b.md) — short\n- [A](a.md) — ${'x'.repeat(130)}\n- [C](c.md) — c\n`;

test('an Edit that makes an index line long with a short fragment, a join or a replace_all is denied, naming the file line', async () => {
  const edits = [
    { old_string: 'x\n- [C]', new_string: 'x and a clause\n- [C]' },
    { old_string: 'x\n- [C](c.md) — c', new_string: 'x; c merged in here' },
    { old_string: 'x', new_string: 'xx', replace_all: true },
  ];
  for (const edit of edits) {
    const refused = await hook({ tool_name: 'Edit', tool_input: { file_path: INDEX, ...edit } }, { index: onDisk });
    assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: line 2 of the memory index is \d+ characters/, edit.new_string);
  }
});

test('a line that was already long on disk does not block a call that leaves it as it was', async () => {
  const already = `${longLine}\n- [B](b.md) — short\n`;
  const quiet = { code: 0, out: '', err: '' };
  assert.deepEqual(await hook({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: 'short', new_string: 'brief' } }, { index: already }), quiet);
  assert.deepEqual(await hook({ tool_name: 'Write', tool_input: { file_path: INDEX, content: `${already}- [C](c.md) — c\n` } }, { index: already }), quiet);
  assert.deepEqual(await hook({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: 'short', new_string: '$& and $1' } }, { index: 'short\n' }), quiet, 'no replacement patterns');
});

test('without --hook it prints its usage and exits 2', async () => {
  const result = await hook({}, { args: [] });
  assert.equal(result.code, 2);
  assert.match(result.err, /Usage: js-harness guard --hook/);
});

// Codex on a68a340..c3ffdfa: Claude Code keeps its folder where CLAUDE_CONFIG_DIR says, which need not be named .claude
// (bin/subagents.mjs and bin/sessions.mjs read it too); the memory index there is held to the same limit.
test('a memory index under CLAUDE_CONFIG_DIR is held to the limit, whatever that folder is named', async () => {
  const custom = 'D:\\claude-config\\projects\\D--proj\\memory\\MEMORY.md';
  const write = { tool_name: 'Write', tool_input: { file_path: custom, content: `${longLine}
` } };
  assert.match(denied(await hook(write, { configDir: 'D:/claude-config' })).permissionDecisionReason, /^js-harness guard: line 1 of the memory index/);
  assert.match(denied(await hook(write, { configDir: 'd:\\Claude-Config\\' })).permissionDecisionReason, /line 1/, 'case and a trailing separator');
  const quiet = { code: 0, out: '', err: '' };
  assert.deepEqual(await hook(write), quiet, 'without the variable it is no memory index');
  assert.deepEqual(await hook({ ...write, tool_input: { ...write.tool_input, file_path: 'D:/claude-config/notes/MEMORY.md' } }, { configDir: 'D:/claude-config' }), quiet, 'outside projects/<slug>/memory');
});

// --- `guard --stop`, the `Stop` hook: the share of its context a reply states, against the share the transcript
// records (odd/tasks/honesty-audit.md, T16) ---

const TRANSCRIPT = 'D:/claude/projects/D--proj/session.jsonl';
const usageLine = (window) => JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: JSON.stringify({ context: { session: 'self', contextWindow: window } }) }] } });
const replyLine = (text, tokens) => JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', usage: { input_tokens: 10, cache_read_input_tokens: tokens - 10 }, content: [{ type: 'text', text }] } });

/** A home of its own for the stop check, which reads the host's configured window under it: none is configured. */
const STOP_HOME = path.join(os.tmpdir(), 'js-harness-guard-stop-no-home');

/** Runs `guard --stop` on `payload` with the transcript at TRANSCRIPT reading `transcript` (null for none), under
 * `home` with the environment `env`. */
async function stop(payload, { transcript = [usageLine(500000), replyLine('Contexto: 40 %.', 300000)].join('\n'), home = STOP_HOME, env = {} } = {}) {
  const out = [];
  const err = [];
  const read = [];
  const code = await guardMain(['--stop'], {
    readStdin: () => JSON.stringify(payload),
    readTranscript: (file) => {
      read.push(file);
      if (transcript === null) throw Object.assign(new Error('no file'), { code: 'ENOENT' });
      return transcript;
    },
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    env: { JS_HARNESS_HOME: home, ...env },
    homedir: () => home,
  });
  return { code, out: out.join(''), err: err.join(''), read };
}

test('a reply whose stated own share is more than 2 points off the recorded one is blocked from stopping, with the reason', async () => {
  const result = await stop({ hook_event_name: 'Stop', transcript_path: TRANSCRIPT, stop_hook_active: false, last_assistant_message: 'Listo. Contexto: 40 %.' });
  assert.equal(result.code, 0);
  assert.deepEqual(result.read, [TRANSCRIPT]);
  const answer = JSON.parse(result.out);
  assert.equal(answer.decision, 'block');
  assert.match(answer.reason, /states your context at 40%.*records 60% of a 500k window/s);
});

test('the reply text comes from last_assistant_message, and from the transcript\'s last reply when the host sends none', async () => {
  const quiet = { code: 0, out: '', err: '', read: [TRANSCRIPT] };
  assert.deepEqual(await stop({ transcript_path: TRANSCRIPT, last_assistant_message: 'Contexto: 61 %.' }), quiet, 'the host\'s text is the one checked');
  assert.equal(JSON.parse((await stop({ transcript_path: TRANSCRIPT })).out).decision, 'block', 'the transcript\'s text, 40 %');
});

test('the check stays quiet when it already blocked this stop, when the reply states no share, and when it cannot read', async () => {
  const quiet = { code: 0, out: '', err: '' };
  const wrong = { transcript_path: TRANSCRIPT, last_assistant_message: 'Contexto: 40 %.' };
  const { read, ...again } = await stop({ ...wrong, stop_hook_active: true });
  assert.deepEqual([again, read], [quiet, []], 'a stop the hook already turned back is let through, so it cannot loop');
  const { read: none, ...plain } = await stop({ ...wrong, last_assistant_message: 'Merged; nothing else.' });
  assert.deepEqual([plain, none], [quiet, []], 'no share stated: the transcript is not read');
  assert.deepEqual(await stop(wrong, { transcript: null }), { ...quiet, read: [TRANSCRIPT] }, 'no transcript');
  assert.deepEqual(await stop({ ...wrong, transcript_path: undefined }), { ...quiet, read: [] }, 'no transcript path');
  assert.deepEqual(await stop(wrong, { transcript: usageLine(500000) }), { ...quiet, read: [TRANSCRIPT] }, 'no reply records a usage');
});

// The window the host is configured with is the one the pause notice says the share of (odd/tasks/session-channel.md,
// T6b), so the stop check reads it first: a session that says what the notice told it is not turned back.
test('a configured window is the one a stated share is checked against, ahead of a get_usage read and of the default', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-guard-stop-'));
  try {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ autoCompactWindow: 350000 }));
    const unread = replyLine('Contexto: 86 %.', 300000);
    assert.equal((await stop({ transcript_path: TRANSCRIPT }, { transcript: unread, home })).out, '', 'no get_usage read: 86% of 350k is right');
    const stale = [usageLine(500000), replyLine('Contexto: 86 %.', 300000)].join('\n');
    assert.equal((await stop({ transcript_path: TRANSCRIPT }, { transcript: stale, home })).out, '', 'a read of the old window does not win');
    const wrong = JSON.parse((await stop({ transcript_path: TRANSCRIPT }, { transcript: replyLine('Contexto: 60 %.', 300000), home })).out);
    assert.match(wrong.reason, /states your context at 60%.*records 86% of a 350k window \(the window the host is configured with, else/s);
    const viaEnv = await stop({ transcript_path: TRANSCRIPT }, { transcript: unread, env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '350000' } });
    assert.equal(viaEnv.out, '', 'the environment configures it too');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

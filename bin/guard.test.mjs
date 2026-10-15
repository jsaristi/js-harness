// `js-harness guard --hook`, the `PreToolUse` hook: what it prints for each tool call it is handed, and that it
// always exits 0 (odd/tasks/honesty-audit.md, T13 and T14).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guardMain } from './guard.mjs';
import { RULES } from './lib/rules-data.mjs';
import { writeRules } from './lib/rules.mjs';
import { testRunWarning } from './lib/test-run-warning.mjs';

const AT_1444 = new Date(2026, 9, 14, 14, 44, 30);

/** Runs the hook on `payload` (an object, or a raw text) in a project whose rules file reads `rulesText` (null for
 * none), with the machine's gate lock held by `held` (null for free), and returns `{ code, out, err }`. */
async function hook(payload, { rulesText = writeRules(RULES), now = AT_1444, args = ['--hook'], held = null, index = null, configDir } = {}) {
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
    testRun: (command) => testRunWarning(command, { env: {}, holder: () => held }),
    claudeConfigDir: configDir,
    readIndex: () => {
      if (index === null) throw Object.assign(new Error('no file'), { code: 'ENOENT' });
      return index;
    },
  });
  return { code, out: out.join(''), err: err.join('') };
}

const denied = (result) => JSON.parse(result.out).hookSpecificOutput;

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
    assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: line \d+ of the text this call writes stamps 2026-10-14 1[45]:\d\d, and the clock says 14:44\./);
  }
  assert.match(denied(await hook(ahead[0])).permissionDecisionReason, /line 3 of the text this call writes stamps 2026-10-14 15:05/);
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

test('a Bash command with backticks inside double quotes is denied; in single quotes or as $(...) it passes', async () => {
  const refused = await hook({ tool_name: 'Bash', tool_input: { command: 'git commit -m "fix the `check` row"' } });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecision, 'deny');
  assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: backticks inside double quotes run as commands in bash \(`check`\)/);
  for (const command of ["git commit -m 'fix the `check` row'", 'echo "today is $(date)"']) {
    assert.deepEqual(await hook({ tool_name: 'Bash', tool_input: { command } }), { code: 0, out: '', err: '' }, command);
  }
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

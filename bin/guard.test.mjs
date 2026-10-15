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
function hook(payload, { rulesText = writeRules(RULES), now = AT_1444, args = ['--hook'], held = null } = {}) {
  const out = [];
  const err = [];
  const code = guardMain(args, {
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
  });
  return { code, out: out.join(''), err: err.join('') };
}

const denied = (result) => JSON.parse(result.out).hookSpecificOutput;

test('an Agent call on a model no rule gives is denied in this repository, and one on an alias passes', () => {
  const refused = hook({ tool_name: 'Agent', cwd: 'D:/project', tool_input: { prompt: 'p', model: 'sonnet' } });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecision, 'deny');
  assert.match(denied(refused).permissionDecisionReason, /"sonnet"/);
  for (const model of ['haiku', 'opus', undefined]) {
    assert.deepEqual(hook({ tool_name: 'Agent', cwd: 'D:/project', tool_input: { prompt: 'p', model } }), { code: 0, out: '', err: '' }, String(model));
  }
});

test('in a project without the rules, an Agent call on any model passes', () => {
  assert.deepEqual(hook({ tool_name: 'Agent', cwd: 'D:/project', tool_input: { model: 'sonnet' } }, { rulesText: null }), { code: 0, out: '', err: '' });
});

test('a message to another session, by either tool, is denied when its stamped hour is off the clock', () => {
  for (const tool_name of ['SendMessage', 'mcp__ccd_session_mgmt__send_message']) {
    const refused = hook({ tool_name, tool_input: { to: 'x', session_id: 'y', message: 'From the lead, 14:48 local by date. Merged.' } });
    assert.equal(refused.code, 0, tool_name);
    assert.match(denied(refused).permissionDecisionReason, /stamps 14:48, and the clock says 14:44/, tool_name);
    assert.deepEqual(hook({ tool_name, tool_input: { message: 'From the lead, 14:44 local. Merged.' } }), { code: 0, out: '', err: '' }, tool_name);
  }
});

test('a Bash command with backticks inside double quotes is denied; in single quotes or as $(...) it passes', () => {
  const refused = hook({ tool_name: 'Bash', tool_input: { command: 'git commit -m "fix the `check` row"' } });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecision, 'deny');
  assert.match(denied(refused).permissionDecisionReason, /^js-harness guard: backticks inside double quotes run as commands in bash \(`check`\)/);
  for (const command of ["git commit -m 'fix the `check` row'", 'echo "today is $(date)"']) {
    assert.deepEqual(hook({ tool_name: 'Bash', tool_input: { command } }), { code: 0, out: '', err: '' }, command);
  }
});

test('a node --test of several files outside a turn is denied while another gate holds the lock, with its warning unchanged', () => {
  const held = { pid: 4242, cwd: 'D:/js-harness-worktrees/other' };
  const command = 'node --test bin/a.test.mjs bin/b.test.mjs';
  const refused = hook({ tool_name: 'Bash', tool_input: { command } }, { held });
  assert.equal(refused.code, 0);
  assert.equal(denied(refused).permissionDecisionReason, testRunWarning(command, { env: {}, holder: () => held }));
  assert.match(denied(refused).permissionDecisionReason, /holds the machine's gate lock/);
  const quiet = { code: 0, out: '', err: '' };
  assert.deepEqual(hook({ tool_name: 'Bash', tool_input: { command } }), quiet, 'the lock is free');
  assert.deepEqual(hook({ tool_name: 'Bash', tool_input: { command: 'node --test bin/a.test.mjs' } }, { held }), quiet, 'one file');
  assert.deepEqual(hook({ tool_name: 'Bash', tool_input: { command: `js-harness gate -- ${command}` } }, { held }), quiet, 'in a turn');
});

test('any other tool, an unreadable payload, or a failure inside passes silently with exit 0', () => {
  const quiet = { code: 0, out: '', err: '' };
  assert.deepEqual(hook({ tool_name: 'Bash', tool_input: { command: 'From the lead, 09:00 local.' } }), quiet);
  assert.deepEqual(hook('not json'), quiet);
  assert.deepEqual(hook(''), quiet);
  assert.deepEqual(hook({ tool_name: 'Agent', cwd: 'D:/project', tool_input: { model: 'sonnet' } }, { rulesText: 42 }), quiet);
});

test('without --hook it prints its usage and exits 2', () => {
  const result = hook({}, { args: [] });
  assert.equal(result.code, 2);
  assert.match(result.err, /Usage: js-harness guard --hook/);
});

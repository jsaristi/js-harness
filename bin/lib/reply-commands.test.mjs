import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fencedBlocks } from './reply.mjs';
import { commandRefusals, runParts } from './reply-commands.mjs';

// Excerpts of the lead's transcript 0f71b2c6 (2026-10-30), trimmed to the fields the check reads.
const assistant = (id, command) => JSON.stringify({ type: 'assistant', isSidechain: false, message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
const result = (id, { error = false, extra = { stdout: '', stderr: '', interrupted: false } } = {}) => JSON.stringify({
  type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: error, content: error ? 'Exit code 1' : 'ok' }] },
  toolUseResult: error ? 'Error: Exit code 1' : extra,
});
// Lines 32882 to 32895: the lead's own runs of the deletion, which the guard refused.
const REFUSED_RUNS = [assistant('toolu_rm', 'cd /d/js-harness-worktrees && rm -rf -- ./* ./.[!.]*'), result('toolu_rm', { error: true })].join('\n');
// A run that succeeded, as at line 33831.
const DOCTOR_RUN = [assistant('toolu_doc', 'js-harness doctor --offline'), result('toolu_doc')].join('\n');
// Line 32954: the reply that handed him the block.
const RM_REPLY = 'Bórrala tú con este comando:\n\n```bash\nrm -rf /d/js-harness-worktrees\n```\n\nSigo solo. Me despierta el aviso de JH 102.';

const parseNone = () => ({ errors: [] });
const refusals = (text, { platform = 'win32', transcript = `${REFUSED_RUNS}\n${DOCTOR_RUN}`, parse = parseNone } = {}) => commandRefusals(fencedBlocks(text), { platform, transcript, parse });

test('today\'s mistake: a bash block handed on win32 is refused for its tag; on linux for the run that never succeeded', () => {
  assert.match(refusals(RM_REPLY).join('\n'), /"rm -rf \/d\/js-harness-worktrees".*tagged bash, which is not his shell; tag it powershell/);
  assert.match(refusals(RM_REPLY, { platform: 'linux' }).join('\n'), /no run of this session that succeeded holds `rm -rf \/d\/js-harness-worktrees`/);
});

test('a block for his shell whose command the session ran with success passes, on win32 through the parser too', () => {
  const reply = 'Corre:\n\n```powershell\njs-harness doctor --offline\n```\n\nSigo solo. Me despierta el aviso.';
  const parsed = [];
  assert.deepEqual(refusals(reply, { parse: (texts) => { parsed.push(...texts); return { errors: [[]] }; } }), []);
  assert.deepEqual(parsed, ['js-harness doctor --offline']);
  assert.deepEqual(refusals(reply.replace('powershell', 'bash'), { platform: 'linux', parse: () => assert.fail('no parse on linux') }), []);
});

test('the parser\'s refusal names the parameter: rm -rf in a powershell block', () => {
  const reply = '```powershell\nrm -rf /d/js-harness-worktrees\n```';
  const why = refusals(reply, { parse: () => ({ errors: [['rm has no parameter -rf']] }) }).join('\n');
  assert.match(why, /rm has no parameter -rf/);
});

test('evidence (ran) passes with any tag when a run holds it; his own block (own) goes to the parser; a parser that cannot run refuses', () => {
  assert.deepEqual(refusals('```bash ran\nrm -rf -- ./* ./.[!.]*\n```'), []);
  assert.deepEqual(refusals('```powershell own\ncodex --no-daemon\n```'), []);
  assert.match(refusals('```powershell own\ncodex\n```', { parse: () => ({ failed: 'timed out' }) }).join('\n'), /could not check it \(timed out\)/);
});

test('cut prompts, code and output are no command blocks', () => {
  assert.deepEqual(refusals('Qué es: el prompt\n\n```\nYour brief is in C:\\x.md: read it.\n```'), []);
  assert.deepEqual(refusals('```js\nrm(1);\n```\n\n```json\n{"a":1}\n```'), []);
});

test('a run proves only the commands its exit proves: not before ||, ;, or a pipe', () => {
  const proved = (command) => runParts(command).filter((part) => part.proved).map((part) => part.words.join(' '));
  assert.deepEqual(proved('a x && b 2>&1 | head -5'), ['a x', 'head -5']);
  assert.deepEqual(proved('rm -rf /d/x || true'), []);
  assert.deepEqual(proved('pwsh -NoProfile -Command "Remove-Item -Recurse D:\\x"'), ['pwsh -NoProfile -Command Remove-Item -Recurse D:\\x', 'Remove-Item -Recurse D:\\x']);
});

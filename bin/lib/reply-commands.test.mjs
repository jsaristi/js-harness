import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fencedBlocks } from './reply.mjs';
import { commandRefusals, runParts, shellParser } from './reply-commands.mjs';

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

test('a run proves a command only when nothing after it can mask its exit: a later ||, ; or newline does; a trailing newline ends the run', () => {
  const proved = (command) => runParts(command).filter((part) => part.proved).map((part) => part.words.join(' '));
  assert.deepEqual(proved('npm run build && echo ok || true'), []);
  assert.deepEqual(proved('npm run build && echo ok; true'), ['true']);
  assert.deepEqual(proved('git status\n'), ['git status']);
  assert.deepEqual(proved('git status;\n'), ['git status']);
  assert.deepEqual(proved('x || y && a'), ['a']);
  assert.deepEqual(proved('x ||\ny'), [], 'a newline after || continues it: y ran only if x failed');
  assert.deepEqual(proved('a &&\nb'), ['a', 'b'], 'a newline after && continues it');
  assert.deepEqual(proved('a |\nb'), ['b']);
  assert.deepEqual(proved('a &&\n\nb'), ['a', 'b'], 'a blank line after && continues it too');
  assert.deepEqual(proved('a &&\n'), ['a'], 'an operator and a newline at the end leave the command as the last');
  assert.deepEqual(proved('a && >f\nb'), ['b'], 'a command of redirections alone is a command: a newline after it ends it');
});

test('a handed command matches a run word for word: `rm "a b"` does not prove `rm a b`', () => {
  const transcript = [assistant('toolu_q', 'rm "a b"'), result('toolu_q')].join('\n');
  assert.match(refusals('```bash\nrm a b\n```', { platform: 'linux', transcript }).join('\n'), /no run of this session that succeeded holds `rm a b`/);
  assert.deepEqual(refusals('```bash\nrm "a b"\n```', { platform: 'linux', transcript }), []);
});

test('a block inside a quote is read without its quote marks, and evidence with no transcript to match is not parsed', () => {
  assert.deepEqual(refusals('> Lo que corrí:\n>\n> ```powershell ran\n> js-harness doctor --offline\n> ```'), []);
  assert.deepEqual(refusals('```bash ran\nrm -rf -- ./*\n```', { transcript: null, parse: () => assert.fail('evidence is not parsed') }), []);
});

test('the parser gets the time left when it is called, not when the check began', () => {
  let timeout = null;
  const clock = [0, 900];
  commandRefusals(fencedBlocks('```powershell own\ncodex\n```'), {
    platform: 'win32', transcript: DOCTOR_RUN, until: 1000, now: () => clock.shift() ?? 900,
    parse: (texts, options) => { timeout = options.timeout; return { errors: [[]] }; },
  });
  assert.ok(timeout > 0 && timeout <= 1000, `timeout ${timeout}`);
  commandRefusals(fencedBlocks('```powershell own\ncodex\n```'), {
    platform: 'win32', transcript: DOCTOR_RUN, until: 1000, now: () => 900,
    parse: (texts, options) => { timeout = options.timeout; return { errors: [[]] }; },
  });
  assert.equal(timeout, 100);
});

test('the parser of win32 falls back to Windows PowerShell where there is no pwsh, and one that does not answer in time refuses', () => {
  const spawned = [];
  const spawn = (program, args, options) => {
    spawned.push({ program, timeout: options.timeout });
    if (program === 'pwsh.exe') return { error: Object.assign(new Error('spawn pwsh.exe ENOENT'), { code: 'ENOENT' }) };
    return { status: 0, stdout: '1\trm has no parameter -rf\r\n', stderr: '' };
  };
  assert.deepEqual(shellParser('win32', spawn)(['js-harness doctor', 'rm -rf x'], { timeout: 3000 }), { errors: [[], ['rm has no parameter -rf']] });
  assert.deepEqual(spawned.map(({ program }) => program), ['pwsh.exe', 'powershell.exe']);
  assert.ok(spawned.every(({ timeout }) => timeout > 0 && timeout <= 3000));
  const late = shellParser('win32', () => ({ error: Object.assign(new Error('spawnSync pwsh.exe ETIMEDOUT'), { code: 'ETIMEDOUT' }) }));
  assert.deepEqual(late(['codex'], { timeout: 10 }), { failed: 'PowerShell: it did not answer in time' });
  const linux = shellParser('linux', () => ({ status: 2, stderr: 'bash: line 1: syntax error near unexpected token `)\'\n' }));
  assert.deepEqual(linux(['echo )'], { timeout: 1000 }), { errors: [['bash cannot parse it: bash: line 1: syntax error near unexpected token `)\'']] });
});

test('real: PowerShell reads each block as he would, its parse errors and parameters that bind to nothing', { skip: process.platform !== 'win32' && 'PowerShell is checked on Windows' }, () => {
  const texts = ['rm -rf /d/js-harness-worktrees', 'Remove-Item -Recurse -Force D:\\x', 'cd D:\\js-harness; codex', 'Get-ChildItem -File | Where-Object {', 'Remove-Item D:\\tráfico -Recurs', 'Remove-Item -LiteralPath D:\\x -f'];
  const checked = shellParser('win32')(texts, { timeout: 20000 });
  assert.equal(checked.failed, undefined, checked.failed);
  assert.deepEqual(checked.errors[0], ['rm has no parameter -rf']);
  assert.match(checked.errors[5].join('\n'), /^Remove-Item: -f is ambiguous, it could be -(Filter|Force), -(Filter|Force)/);
  assert.deepEqual([checked.errors[1], checked.errors[2], checked.errors[4]], [[], [], []], 'a prefix of a parameter binds, as PowerShell binds it');
  assert.match(checked.errors[3].join('\n'), /^PowerShell cannot parse it: /);
});

test('real: bash -n reads each block off Windows', { skip: process.platform === 'win32' && 'bash is checked off Windows' }, () => {
  const checked = shellParser('linux')(['rm -rf /tmp/none-such && echo ok', 'if then fi )'], { timeout: 10000 });
  assert.deepEqual(checked.errors[0], []);
  assert.match(checked.errors[1].join('\n'), /^bash cannot parse it: /);
});

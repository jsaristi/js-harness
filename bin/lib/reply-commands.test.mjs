import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

test('real: each block gets its own answer from PowerShell 7 and Windows PowerShell: a miss is no failure, a lookup that fails is its block\'s refusal', { skip: process.platform !== 'win32' && 'PowerShell is checked on Windows' }, () => {
  // One spawn a shell, each case a text (odd/tasks/reply-hook-latency.md, T8, L13 to L19). The plain miss stays last: a
  // script whose exit was its last statement's `$?` read it as a parser that could not run.
  const texts = [
    'rm -rf x',
    // An unmatched `[` is no wildcard pattern: the lookup fails for another reason than a miss (Codex, b044dbf..0339273),
    // and the rest of its block is still checked (the lenses, 0339273..cc56e0f).
    "& 'Get-Ite[m' -x; Get-Date -zz",
    // A line break in a name stays out of the line the parser reads (Codex, cc56e0f..5fd74a2).
    '& "Get-Ite[m`rx" -x',
    "& 'Get-Ite[m\u2028x' -x",
    // The check adds no command of its own that a block could name (the advisor, over b45380f): the test's own advanced
    // function of that name, defined in the child shell, so no module is needed (Codex, 4a3fc21..66e91c9).
    'Find-Command -zz',
    'nosuchprog-jh223 --a',
  ];
  const ownFindCommand = (program, args, options) => {
    const script = Buffer.from(args.at(-1), 'base64').toString('utf16le');
    const defined = `function global:Find-Command { [CmdletBinding()] param($Name) }\n${script}`;
    return spawnSync(program, [...args.slice(0, -1), Buffer.from(defined, 'utf16le').toString('base64')], options);
  };
  const windowsPowerShell = (program, args, options) => (program === 'pwsh.exe'
    ? { error: Object.assign(new Error('spawn pwsh.exe ENOENT'), { code: 'ENOENT' }) }
    : ownFindCommand(program, args, options));
  for (const [shell, spawn] of [['PowerShell 7', ownFindCommand], ['Windows PowerShell', windowsPowerShell]]) {
    const checked = shellParser('win32', spawn)(texts, { timeout: 30000 });
    assert.equal(checked.failed, undefined, `${shell}: ${checked.failed}`);
    assert.deepEqual(checked.errors[0], ['rm has no parameter -rf'], shell);
    assert.match(checked.errors[1].join('\n'), /^PowerShell could not look up Get-Ite\[m: [^\n]*\nGet-Date has no parameter -zz$/, shell);
    assert.match(checked.errors[2].join('\n'), /^PowerShell could not look up Get-Ite\[m x: [^\n]*$/, shell);
    assert.match(checked.errors[3].join('\n'), /^PowerShell could not look up Get-Ite\[m x: [^\n]*$/, shell);
    assert.deepEqual(checked.errors[4], ['Find-Command has no parameter -zz'], shell);
    assert.deepEqual(checked.errors[5], [], shell);
  }
});

test('real: through commandRefusals, a block whose last command PowerShell cannot find is no refusal, as when it is not last (dropped on purpose, odd/tasks/reply-hook-latency.md, L20)', { skip: process.platform !== 'win32' && 'PowerShell is checked on Windows' }, () => {
  const check = (reply, transcript) => commandRefusals(fencedBlocks(reply), { platform: 'win32', transcript, parse: shellParser('win32') });
  // His own block, parsed only: the miss last, and the same miss before a command that is found.
  assert.deepEqual(check('```powershell own\nnosuchprog-jh223 --a\n```', DOCTOR_RUN), []);
  assert.deepEqual(check('```powershell own\nnosuchprog-jh223 --a; git status\n```', DOCTOR_RUN), []);
  // A handed block with no transcript to read goes to the parser too.
  assert.deepEqual(check('```powershell\nnosuchprog-jh223 --a\n```', null), []);
  // A sibling's refusal is kept beside it.
  assert.match(check('```powershell own\nrm -rf x\n```\n\n```powershell own\nnosuchprog-jh223\n```', DOCTOR_RUN).join('\n'), /"rm -rf x" \(line 1\): rm has no parameter -rf$/);
});

test('real: bash -n reads each block off Windows', { skip: process.platform === 'win32' && 'bash is checked off Windows' }, () => {
  const checked = shellParser('linux')(['rm -rf /tmp/none-such && echo ok', 'if then fi )'], { timeout: 10000 });
  assert.deepEqual(checked.errors[0], []);
  assert.match(checked.errors[1].join('\n'), /^bash cannot parse it: /);
});

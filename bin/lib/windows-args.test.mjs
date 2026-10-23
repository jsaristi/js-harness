import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteWindowsArg, windowsCommandLine } from './windows-args.mjs';

test('an argument of plain word characters, dots, colons, slashes and signs is passed as it is', () => {
  for (const arg of ['run', '--model=sonnet', 'a.b,c@d+e', 'C:\\Users\\me\\x.mjs', 'dir/file-1.txt']) assert.equal(quoteWindowsArg(arg), arg);
});

test('an argument with a space or a tab is wrapped in double quotes', () => {
  assert.equal(quoteWindowsArg('two words'), '"two words"');
  assert.equal(quoteWindowsArg('a\tb'), '"a\tb"');
});

test('an empty argument is two double quotes, so the program still gets one argument', () => {
  assert.equal(quoteWindowsArg(''), '""');
});

test('a double quote inside is escaped with a backslash', () => {
  assert.equal(quoteWindowsArg('say "hi"'), '"say \\"hi\\""');
});

test('backslashes before a double quote are doubled, and so is a trailing run of them', () => {
  assert.equal(quoteWindowsArg('a\\"b'), '"a\\\\\\"b"', 'one backslash before the quote: two, then the escaped quote');
  assert.equal(quoteWindowsArg('dir with space\\'), '"dir with space\\\\"', 'a trailing backslash would escape the closing quote');
});

test('an argument cmd.exe would act on is refused, not quoted', () => {
  assert.throws(() => quoteWindowsArg('a&b'), /cmd\.exe/);
  assert.throws(() => quoteWindowsArg('100%'), /cmd\.exe/);
});

test('a command line is the command and its arguments quoted, joined by one space each', () => {
  assert.equal(windowsCommandLine('node', ['--test', 'bin/my file.test.mjs', '']), 'node --test "bin/my file.test.mjs" ""');
  assert.equal(windowsCommandLine('codex', []), 'codex');
});

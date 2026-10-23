// Convention: errors are split by where they are met (odd/tasks/conventions.md, S3). A command is the edge: it
// signals a usage error by throwing its own `<Name>ArgError extends Error`, and its main turns that into the usage
// and exit 2. A module under `bin/lib` is the core: it declares no `ArgError` and never calls `process.exit`, so it
// returns what it found, an expected failure as `{ error }`, and the command that called it decides what to print
// and how to exit. That keeps the core testable with inline values and the exit codes in one layer.
//
// How to comply: in a command, `class <Name>ArgError extends Error {}` beside its parsing, thrown for a bad
// argument and caught in its main; in `bin/lib`, return `{ error }` (or throw an error the caller catches) and
// leave the exit to the command. A child script under `bin/lib` that is its own process may set
// `process.exitCode`, which is how it hands its result to the parent that spawned it.
//
// Only what a test can see is checked: the declarations and the calls, read from the source with its comment lines
// left out. The command modules are the ones the dispatcher's COMMANDS table loads. LEGACY lists the commands that
// declare no ArgError yet, each with how it signals a usage error instead; it only shrinks (bin/lib/ratchet.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ratchet } from './lib/ratchet.mjs';

const BIN = import.meta.dirname;
const LIB = path.join(BIN, 'lib');
const ARG_ERROR_CLASS = /\bclass\s+\w*ArgError\s+extends\s+Error\b/;

const LEGACY = {
  'backup.mjs': 'prints the usage from its dispatch and returns 2',
  'fetch.mjs': 'prints the refusal from its main and returns 2',
  'functions.mjs': 'its parse returns { error }',
  'guard.mjs': 'prints the usage and returns 2',
  'merge-queue.mjs': 'prints the usage and returns 2',
  'onboard.mjs': 'its parse returns { error }',
  'reply.mjs': 'prints the usage and returns 2',
  'resume.mjs': 'prints the refusal from its main and returns 2',
  'summary.mjs': 'its parse returns the usage line',
  'wake.mjs': 'throws a plain Error',
  'windows-daily.mjs': 'prints the refusal from its main and returns 2',
};

/** `text` without its comment lines, so a comment that names `process.exit` is not a call. */
function withoutComments(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

const code = (file) => withoutComments(fs.readFileSync(file, 'utf8'));

/** The command modules: each `./<name>.mjs` the dispatcher's COMMANDS table imports. */
function commandModules() {
  const source = fs.readFileSync(path.join(BIN, 'js-harness.mjs'), 'utf8');
  const table = /\nconst COMMANDS = \{\r?\n([\s\S]*?)\r?\n\};/.exec(source);
  assert.ok(table, 'bin/js-harness.mjs has a `const COMMANDS = { ... };` table');
  return [...new Set([...table[1].matchAll(/import\('\.\/([a-z-]+\.mjs)'\)/g)].map((match) => match[1]))];
}

const libModules = () => fs.readdirSync(LIB).filter((name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'));

test('every command module declares its own ArgError, but the legacy ones', () => {
  const modules = commandModules();
  assert.ok(modules.length >= 10, `only ${modules.length} command modules were read from the COMMANDS table`);
  const broken = modules.filter((name) => !ARG_ERROR_CLASS.test(code(path.join(BIN, name))));
  const problems = ratchet({ checked: modules, broken, legacy: LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\na command throws its own \`class <Name>ArgError extends Error {}\` for a usage error`);
});

test('no module under bin/lib declares an ArgError: a usage error belongs to the command that parses the argv', () => {
  const declaring = libModules().filter((name) => /\bclass\s+\w*ArgError\b/.test(code(path.join(LIB, name))));
  assert.deepEqual(declaring, [], 'move the class to the command and return { error } from bin/lib');
});

test('no module under bin/lib calls process.exit: it returns, and the command decides the exit', () => {
  const exiting = libModules().filter((name) => /\bprocess\.exit\s*\(/.test(code(path.join(LIB, name))));
  assert.deepEqual(exiting, [], 'return the result to the command; a child script sets process.exitCode instead');
});

test('a comment line that names process.exit is not a call, and a line of code is', () => {
  const text = '// may end in `process.exit` as well\n/* process.exit */\n * process.exit(1)\nreturn 0;\n';
  assert.doesNotMatch(withoutComments(text), /process\.exit/);
  assert.match(withoutComments('if (bad) process.exit(2);\n'), /process\.exit\s*\(/);
});

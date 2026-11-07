// Convention: errors are split by where they are met (odd/tasks/conventions.md, S3). A command is the edge: it
// signals a usage error by throwing its own `<Name>ArgError extends Error`, and its main turns that into the usage
// and exit 2. A module under `bin/lib` is the core: it declares no `ArgError` and never calls `process.exit`, so it
// returns what it found, an expected failure as `{ error }`, and the command that called it decides what to print
// and how to exit. That keeps the core testable with inline values and the exit codes in one layer.
//
// How to comply: in a command, `class <Name>ArgError extends Error {}` beside its parsing, thrown for a bad
// argument and caught in its main; in `bin/lib`, return `{ error }` (or throw an error the caller catches) and
// leave the exit to the command. A child script under `bin/lib` that is its own process may set
// `process.exitCode`, which is how it hands its result to the parent that spawned it. A `--require` preload is the one
// exception, named in `EXIT_EXEMPT` below.
//
// Only what a test can see is checked: the declarations and the calls, read from the source with its comment lines
// left out. The command modules are the ones the dispatcher's COMMANDS table loads; every module under `bin/lib` is
// read, at any depth (bin/lib/source.testkit.mjs). LEGACY lists the commands that declare no ArgError yet, each with
// how it signals a usage error instead; it only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { sourceModules, withoutComments } from './lib/source.testkit.mjs';

const BIN = import.meta.dirname;
const LIB = path.join(BIN, 'lib');
const ARG_ERROR_CLASS = /\bclass\s+\w*ArgError\s+extends\s+Error\b/;
// A preload is its own process, loaded into every node a Codex review starts: it ends that run when the run must not go on.
const EXIT_EXEMPT = { 'no-test-outside-turn.cjs': 'a --require preload: it ends the node run it is loaded into with exit 97' };

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
};

const code = (file) => withoutComments(fs.readFileSync(file, 'utf8'));

/** The command modules: each `./<name>.mjs` the dispatcher's COMMANDS table imports. */
function commandModules() {
  const source = fs.readFileSync(path.join(BIN, 'js-harness.mjs'), 'utf8');
  const table = /\nconst COMMANDS = \{\r?\n([\s\S]*?)\r?\n\};/.exec(source);
  assert.ok(table, 'bin/js-harness.mjs has a `const COMMANDS = { ... };` table');
  return [...new Set([...table[1].matchAll(/import\('\.\/([a-z-]+\.mjs)'\)/g)].map((match) => match[1]))];
}

const libModules = () => sourceModules(LIB);

test('every module under bin/lib is read, at any depth', () => {
  assert.ok(libModules().length >= 100, `only ${libModules().length} modules were read under bin/lib`);
});

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

test('the .cjs files under bin/lib are read by the exit convention too', () => {
  assert.ok(libModules().includes('no-test-outside-turn.cjs'), 'libModules lists the .cjs files: a preload that exits is checked');
});

// The workshop is held to the same split (odd/tasks/workshop-product-split.md): its commands are the modules its
// dispatcher's COMMANDS table loads from `./bin/`, its core every module under `workshop/lib`.
const WORKSHOP = path.join(BIN, '..', 'workshop');
const WORKSHOP_LEGACY = {
  'windows-daily.mjs': 'prints the refusal from its main and returns 2',
};

/** The workshop's command modules: each `./bin/<name>.mjs` its dispatcher's COMMANDS table imports. */
function workshopCommands() {
  const source = fs.readFileSync(path.join(WORKSHOP, 'js-harness-workshop.mjs'), 'utf8');
  const table = /\nconst COMMANDS = \{\r?\n([\s\S]*?)\r?\n\};/.exec(source);
  assert.ok(table, 'workshop/js-harness-workshop.mjs has a `const COMMANDS = { ... };` table');
  return [...new Set([...table[1].matchAll(/import\('\.\/bin\/([a-z-]+\.mjs)'\)/g)].map((match) => match[1]))];
}

test('every workshop command module declares its own ArgError, but the legacy ones', () => {
  const modules = workshopCommands();
  assert.equal(modules.length, 7, `the workshop's COMMANDS table loads ${modules.length} command modules, not 7`);
  const broken = modules.filter((name) => !ARG_ERROR_CLASS.test(code(path.join(WORKSHOP, 'bin', name))));
  const problems = ratchet({ checked: modules, broken, legacy: WORKSHOP_LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\na command throws its own \`class <Name>ArgError extends Error {}\` for a usage error`);
});

test('no module under workshop/lib declares an ArgError or calls process.exit', () => {
  const modules = sourceModules(path.join(WORKSHOP, 'lib'));
  assert.ok(modules.length >= 9, `only ${modules.length} modules were read under workshop/lib`);
  const breaking = modules.filter((name) => /\bclass\s+\w*ArgError\b|\bprocess\.exit\s*\(/.test(code(path.join(WORKSHOP, 'lib', name))));
  assert.deepEqual(breaking, [], 'move the class to the command and return the result; the command decides the exit');
});

test('no module under bin/lib calls process.exit: it returns, and the command decides the exit', () => {
  const exiting = libModules().filter((name) => /\bprocess\.exit\s*\(/.test(code(path.join(LIB, name))));
  const problems = ratchet({ checked: libModules(), broken: exiting, legacy: EXIT_EXEMPT });
  assert.deepEqual(problems, [], 'return the result to the command; a child script sets process.exitCode instead');
});

test('a comment line that names process.exit is not a call, and a line of code is', () => {
  const text = '// may end in `process.exit` as well\n/* process.exit */\n * process.exit(1)\nreturn 0;\n';
  assert.doesNotMatch(withoutComments(text), /process\.exit/);
  assert.match(withoutComments('if (bad) process.exit(2);\n'), /process\.exit\s*\(/);
});

// Convention: every command refuses an argument it does not know with exit 2 and the one line
// `unknown argument: <token>` on stderr (odd/tasks/conventions.md, S2). One wording, so a person, a hook or a test
// that meets the refusal of one command knows the refusal of every other; exit 2, so a caller tells a usage error
// from a failure of the work. The commands are read from `js-harness --help`, the way a person asks, so a command
// added later is held to this without anyone listing it.
//
// How to comply: walk argv token by token and throw the command's own `<Name>ArgError` with
// `unknown argument: ${token}` for anything not known; the command's main prints it with the usage and returns 2.
// Changing what a command prints is a change of its CLI contract: search what reads the old line first.
//
// Each command runs in a child with every home it could write under pointed at a fresh temp folder, from a fresh
// folder that is not a repository, the way bin/writing-flags.test.mjs runs them, so nothing on this machine is read
// or written. LEGACY lists the commands that do not comply yet, each with why; it only shrinks (bin/lib/ratchet.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ratchet } from './lib/ratchet.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const DISPATCHER = path.join(REPO, 'bin', 'js-harness.mjs');
const UNKNOWN = '--no-such-flag';
// The refusal: the line may open with the command's name and close with a hint after a space, `;` or `(`, as
// `notify` says where a text that begins with `--` goes.
const REFUSAL = new RegExp(`unknown argument: ${UNKNOWN}(?:$|[ ;(])`);

// The argv a command needs before the unknown flag to reach its own parsing: a subcommand, or what must stand
// before it. Each is a read-only form (`status`, `list`, `check`, `--dry-run`), so a command that ignores the flag
// does read-only work here, beside the scratch homes.
//
// A command not named here is probed bare (`<command> --no-such-flag`). What follows `--` stays after the probe,
// since `gate` hands everything after it on.
const BEFORE = {
  gate: ['--', 'node', '--version'],
  loop: ['status'],
  summary: ['template', '--title', 'probe'],
  memory: ['status'],
  backup: ['status'],
  'merge-queue': ['--dry-run'],
  permit: ['list'],
  resume: ['--hook'],
  guard: ['--hook'],
  reply: ['--hook'],
  contract: ['check'],
  remote: ['status'],
  throughput: ['status'],
};

const LEGACY = {
  loop: 'says "js-harness loop: <token> is not an option of loop status"',
  throughput: 'says "js-harness throughput: <token> is not an option of throughput status"',
  'windows-daily': 'says "js-harness windows-daily: <token> is no argument of this command"',
  'merge-queue': 'prints only the usage',
  guard: 'prints only the usage',
  reply: 'prints only the usage',
};

/** The commands `js-harness --help` lists, in its order: the first word of each line under "Commands:". */
function dispatched() {
  const help = spawnSync(process.execPath, [DISPATCHER, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  const lines = help.stdout.split('\n');
  const names = [];
  for (const line of lines.slice(lines.indexOf('Commands:') + 1)) {
    const named = /^ {2}(\S+) /.exec(line);
    if (!named) break;
    names.push(named[1]);
  }
  return names;
}

function probe(command) {
  const before = BEFORE[command] ?? [];
  const split = before.indexOf('--');
  return split === -1 ? [command, ...before, UNKNOWN] : [command, ...before.slice(0, split), UNKNOWN, ...before.slice(split)];
}

function run(args) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-conventions-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'cwd');
  fs.mkdirSync(home);
  fs.mkdirSync(cwd);
  const env = { ...process.env, JS_HARNESS_HOME: home, CLAUDE_CONFIG_DIR: home, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, TEMP: home, TMP: home, TMPDIR: home, JS_HARNESS_CHECK_INNER: '1' };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_') || key === 'JS_HARNESS_SOURCE' || key === 'JS_HARNESS_PREFIX' || key === 'CLAUDE_CODE_SESSION_ID') delete env[key];
  }
  env.GIT_CEILING_DIRECTORIES = root;
  try {
    return spawnSync(process.execPath, [DISPATCHER, ...args], { cwd, env, encoding: 'utf8', input: '', timeout: 60000 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('every command refuses an unknown flag with exit 2 and "unknown argument: <token>", but the legacy ones', () => {
  const commands = dispatched();
  assert.ok(commands.length >= 10, `only ${commands.length} commands were read from --help`);
  const broken = [];
  const printed = [];
  for (const command of commands) {
    const result = run(probe(command));
    const lines = result.stderr.split(/\r?\n/);
    if (result.status !== 2 || !lines.some((line) => REFUSAL.test(line))) {
      broken.push(command);
      const ended = result.error ? `no exit (${result.error.code ?? result.error.message})` : `exit ${result.status}`;
      printed.push(`${probe(command).join(' ')}: ${ended}, ${JSON.stringify(lines[0])}`);
    }
  }
  const problems = ratchet({ checked: commands, broken, legacy: LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\nwhat each command that breaks it printed:\n${printed.join('\n')}`);
});

test('a probe puts the unknown flag after the subcommand and before what a command hands on after --', () => {
  assert.deepEqual(probe('check'), ['check', UNKNOWN]);
  assert.deepEqual(probe('remote'), ['remote', 'status', UNKNOWN]);
  assert.deepEqual(probe('gate'), ['gate', UNKNOWN, '--', 'node', '--version']);
});

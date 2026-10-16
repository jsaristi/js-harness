import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFailures, failuresMain, holdsUnder } from './failures.mjs';
import { run as dispatch } from './js-harness.mjs';

const CLASSES = [
  '## Classes',
  '- `asked-of-him` — asked or kept waiting for what was not his',
  '- `machine` — load or leftovers: processes, folders, locks',
  '- `tool` — a command of the harness or of the stack failed',
  '- `wrong-information` — stated as a fact, and not checked or not true',
  '',
];

const GATE = [
  '### gate-reaches-its-bound',
  'A language server per session works while tests write files, and a gate reaches its bound.',
  '- Class: machine',
  '- Aka: failure 20',
  '- Seen: 2026-10-11 — relief file, line 224 — a gate at 1,188 s of 1,200',
  '- Seen: 2026-10-09 — odd/tasks/gate-log.md, Progress — a gate timed out',
  '- Seen: 2026-10-11 — relief file, line 224 — the same record, read by another session',
];

const QUESTION = [
  '### question-that-was-not-his',
  'He was asked whether to run a step he had already planned.',
  '- Class: asked-of-him',
  '- Seen: 2026-10-10 — relief file, line 180 — a question sent while work ran',
  '- Control: owed — odd/tasks/rule-hierarchy.md — "T2 The reply check"',
];

const RENAMED = [
  '### renamed-test',
  'Two gates ran their sensors together and one timed out.',
  '- Class: tool',
  '- Seen: 2026-10-08 — odd/tasks/gate-lock.md, Progress — two gates at once',
  '- Control: check — bin/gate.test.mjs — "two gates never run together" — since 2026-10-10',
  '- Was: a rule kept by hand in the relief file',
];

const STATED = [
  '### stated-without-checking',
  'A merge was reported as done and it had not happened.',
  '- Class: wrong-information',
  '- Seen: 2026-10-10 — relief file, line 140 — a merge that was not there',
];

/** The text of a register that declares four classes and holds `entries`, each a list of lines. */
function register(...entries) {
  return ['# Failures', '', ...CLASSES, '## Entries', '', ...entries.flatMap((lines) => [...lines, ''])].join('\r\n');
}

const TASKS = ['# Rule hierarchy', '', '## Tasks', '- [x] T1 The specification', '- [ ] T2 The reply', '  check, and its hook', ''].join('\r\n');
const TEST_FILE = "test('two gates never run together', () => {});\n";

/** The four entries with every file they name: the question is owed, the renamed test controlled. */
const FULL = {
  'docs/FAILURES.md': register(GATE, QUESTION, RENAMED, STATED),
  'odd/tasks/rule-hierarchy.md': TASKS,
  'bin/gate.test.mjs': TEST_FILE,
};

/** Runs `body` in a temporary project that holds `files` (path from its top -> content), then removes it. */
async function inProject(files, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-failures-'));
  try {
    for (const [file, content] of Object.entries(files)) {
      const absolute = path.join(dir, ...file.split('/'));
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content, 'utf8');
    }
    return await body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs `failuresMain` in `cwd`, capturing what it printed through the injected writers. */
async function run(argv, cwd, deps = {}) {
  const out = [];
  const err = [];
  const code = await failuresMain(argv, { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), ...deps });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

// ── The row of the gate ─────────────────────────────────────────────────────────────────────────

test('with no docs/FAILURES.md the gate has no failures row', async () => {
  await inProject({ 'AGENTS.md': '# A project\n' }, (dir) => {
    assert.deepEqual(checkFailures(dir), []);
  });
});

test('a project whose "docs" is a file keeps no register either, whatever the system answers for it', async () => {
  await inProject({ docs: 'a file where a folder could be\n' }, (dir) => {
    assert.deepEqual(checkFailures(dir), []);
  });
  // What POSIX answers for a file in the place of a folder; Windows answers ENOENT.
  const notADirectory = () => {
    throw Object.assign(new Error('ENOTDIR: not a directory'), { code: 'ENOTDIR' });
  };
  assert.deepEqual(checkFailures('/a/project', { readFile: notADirectory }), []);
});

test('a register read without a fault passes: its detail gives the failures, the sightings, those seen more than once and those not settled', async () => {
  await inProject(FULL, (dir) => {
    const rows = checkFailures(dir);
    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.deepEqual([row.name, row.pass], ['failures', true]);
    assert.match(row.detail, /^4 failures, 5 sightings, 1 seen more than once, 1 not settled; /);
  });
});

test('the detail ends with how a failure is recorded, so a session learns the register exists', async () => {
  await inProject(FULL, (dir) => {
    const [row] = checkFailures(dir);
    assert.match(row.detail, /; a failure is recorded by hand in docs\/FAILURES\.md, .*"- Seen:".*"### <id>".*js-harness failures.*$/);
  });
});

test('the lines of the row list each entry that is not settled, with its state and the first day it was seen', async () => {
  await inProject(FULL, (dir) => {
    const [row] = checkFailures(dir);
    assert.deepEqual(row.lines, ['gate-reaches-its-bound  repeated  first seen 2026-10-09']);
  });
});

test('one failure and one sighting are counted in the singular, and a register that is all settled has no lines', async () => {
  await inProject({ 'docs/FAILURES.md': register(STATED) }, (dir) => {
    const [row] = checkFailures(dir);
    assert.equal(row.pass, true);
    assert.match(row.detail, /^1 failure, 1 sighting, 0 seen more than once, 0 not settled; /);
    assert.deepEqual(row.lines, []);
  });
});

test('the row fails for what the register alone shows, one line per fault', async () => {
  const broken = register(['### Gate', '', '- Class: weather'], STATED);
  await inProject({ 'docs/FAILURES.md': broken }, (dir) => {
    const [row] = checkFailures(dir);
    assert.deepEqual([row.name, row.pass], ['failures', false]);
    assert.equal(row.detail, 'docs/FAILURES.md is not read: 4 faults to repair in that file');
    assert.equal(row.lines.length, 4);
    for (const pattern of [/"Gate": the id is not/, /"Gate": has no text/, /"Gate": class "weather" is not declared/, /"Gate": has no sighting/]) {
      assert.ok(row.lines.some((line) => pattern.test(line)), `${pattern}\n${row.lines.join('\n')}`);
    }
  });
});

test('a state that depends on another file fails nothing: stale, lost and seen again are counted and listed', async () => {
  const seenAgain = [...RENAMED, '- Seen: 2026-10-11 — relief file, line 230 — two gates again'];
  const lost = ['### zebra-crossing', 'A test was renamed.', '- Class: tool', '- Seen: 2026-10-08 — board — once', '- Control: check — bin/gone.test.mjs — "a test that was renamed" — since 2026-10-09'];
  const files = {
    'docs/FAILURES.md': register(QUESTION, seenAgain, lost),
    'odd/tasks/rule-hierarchy.md': TASKS.replace('- [ ] T2', '- [x] T2'),
    'bin/gate.test.mjs': TEST_FILE,
  };
  await inProject(files, (dir) => {
    const [row] = checkFailures(dir);
    assert.equal(row.pass, true);
    assert.match(row.detail, /^3 failures, 4 sightings, 1 seen more than once, 3 not settled; /);
    assert.deepEqual(row.lines, [
      'renamed-test  seen again  first seen 2026-10-08',
      'question-that-was-not-his  owed, stale  first seen 2026-10-10',
      'zebra-crossing  control lost  first seen 2026-10-08',
    ]);
  });
});

test('a failure measured is settled while its file holds the dated phrase, lost when only a comment holds it, and seen again after it', async () => {
  const measured = (id, phrase, ...seen) => [
    `### ${id}`,
    'A control was measured and found not worth building.',
    '- Class: wrong-information',
    '- Seen: 2026-10-10 — relief file, line 140 — a claim that was not checked',
    ...seen,
    `- Control: measured — odd/tasks/honesty-audit.md — "${phrase}" — since 2026-10-15`,
  ];
  const files = {
    'docs/FAILURES.md': register(
      measured('measured-and-back', '2026-10-15: the audit caught 2 or 3 of 14', '- Seen: 2026-10-16 — relief file, line 300 — again'),
      measured('measured-in-a-comment', '2026-10-15: an old count kept in a comment'),
      measured('measured-same-day', '2026-10-15: the audit caught 2 or 3 of 14', '- Seen: 2026-10-15 — relief file, line 290 — that day'),
    ),
    'odd/tasks/honesty-audit.md': ['## Measured', '- [x] T15 2026-10-15: the audit caught 2 or 3', '  of 14', '<!-- 2026-10-15: an old count kept in a comment -->', ''].join('\r\n'),
  };
  await inProject(files, (dir) => {
    const [row] = checkFailures(dir);
    assert.equal(row.pass, true);
    assert.match(row.detail, /^3 failures, 5 sightings, 2 seen more than once, 2 not settled; /);
    assert.deepEqual(row.lines, [
      'measured-and-back  measured, seen again  first seen 2026-10-10',
      'measured-in-a-comment  measure lost  first seen 2026-10-10',
    ]);
  });
});

test('an owed phrase is found in a wrapped item that is not checked off, in a file with carriage returns', async () => {
  await inProject({ 'docs/FAILURES.md': register(QUESTION), 'odd/tasks/rule-hierarchy.md': TASKS }, (dir) => {
    assert.deepEqual(checkFailures(dir)[0].lines, []);
  });
  await inProject({ 'docs/FAILURES.md': register(QUESTION) }, (dir) => {
    assert.deepEqual(checkFailures(dir)[0].lines, ['question-that-was-not-his  owed, stale  first seen 2026-10-10']);
  });
});

test('a register that is there and cannot be read fails the row, and is not taken for no register', async () => {
  await inProject({ 'docs/FAILURES.md/keep.txt': 'a folder where the register should be\n' }, (dir) => {
    const [row] = checkFailures(dir);
    assert.deepEqual([row.name, row.pass], ['failures', false]);
    assert.match(row.detail, /^cannot read docs\/FAILURES\.md: /);
  });
});

test('the row reads the register and the files the entries name, all under the project', async () => {
  await inProject(FULL, (dir) => {
    const read = [];
    const readFile = (absolute) => {
      read.push(path.relative(dir, absolute).split(path.sep).join('/'));
      return fs.readFileSync(absolute, 'utf8');
    };
    checkFailures(dir, { readFile });
    assert.deepEqual(read.sort(), ['bin/gate.test.mjs', 'docs/FAILURES.md', 'odd/tasks/rule-hierarchy.md']);
  });
});

test('a path that leaves the project is answered as not held, and nothing is read', async () => {
  await inProject({ 'inside/AGENTS.md': 'never two gates at once\n', 'secret.txt': 'never two gates at once\n' }, (dir) => {
    const read = [];
    const readFile = (absolute) => {
      read.push(absolute);
      return fs.readFileSync(absolute, 'utf8');
    };
    const holds = holdsUnder(path.join(dir, 'inside'), readFile);
    assert.equal(holds('../secret.txt', 'never two gates at once', {}), false);
    assert.equal(holds(path.join(dir, 'secret.txt'), 'never two gates at once', {}), false);
    assert.deepEqual(read, []);
    assert.equal(holds('AGENTS.md', 'never two gates at once', {}), true);
    assert.equal(holds('AGENTS.md', 'never three gates', {}), false);
    assert.equal(read.length, 1, 'a file two entries name is read once');
  });
});

test('a link inside the project that points out of it is answered as not held, and nothing is read', async () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-failures-out-'));
  try {
    fs.writeFileSync(path.join(outside, 'gate.test.mjs'), TEST_FILE);
    await inProject({ 'bin/gate.test.mjs': TEST_FILE }, (dir) => {
      // A junction on Windows, which needs no privilege; a symbolic link elsewhere.
      fs.symlinkSync(outside, path.join(dir, 'linked'), 'junction');
      const read = [];
      const readFile = (absolute) => {
        read.push(absolute);
        return fs.readFileSync(absolute, 'utf8');
      };
      const holds = holdsUnder(dir, readFile);
      assert.equal(holds('linked/gate.test.mjs', 'two gates never run together', {}), false);
      assert.deepEqual(read, []);
      assert.equal(holds('bin/gate.test.mjs', 'two gates never run together', {}), true);
    });
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

// ── The command ─────────────────────────────────────────────────────────────────────────────────

test('with no docs/FAILURES.md every form of the command says so and exits 0', async () => {
  await inProject({ 'AGENTS.md': '# A project\n' }, async (dir) => {
    for (const argv of [[], ['some-failure'], ['check'], ['check', '--settled']]) {
      const { code, stdout, stderr } = await run(argv, dir);
      assert.equal(code, 0, argv.join(' '));
      assert.match(stdout, /^no docs\/FAILURES\.md: no failure is recorded/, argv.join(' '));
      assert.equal(stderr, '', argv.join(' '));
    }
  });
});

test('a flag or a subcommand it does not know is a usage error (exit 2), and nothing is read', async () => {
  await inProject(FULL, async (dir) => {
    const readFile = () => assert.fail('a usage error reads no file');
    for (const argv of [['--nope'], ['--help'], ['check', '--nope'], ['check', 'extra'], ['gate-reaches-its-bound', 'extra'], ['--settled'], ['gate-reaches-its-bound', '--settled'], ['check', '--settled', '--settled', '-x']]) {
      const { code, stdout, stderr } = await run(argv, dir, { readFile });
      assert.equal(code, 2, argv.join(' '));
      assert.equal(stdout, '', argv.join(' '));
      assert.match(stderr, /Usage: js-harness failures/, argv.join(' '));
    }
  });
});

test('failures prints the totals, with the controls that had to be replaced', async () => {
  await inProject(FULL, async (dir) => {
    const { code, stdout, stderr } = await run([], dir);
    assert.deepEqual([code, stderr], [0, '']);
    assert.equal(stdout.split('\n')[0], 'docs/FAILURES.md  4 failures, 5 sightings, 1 seen more than once, 1 not settled, 1 control replaced');
  });
});

test('failures prints the entries and the sightings of each class, in the order the classes are declared', async () => {
  await inProject(FULL, async (dir) => {
    const { stdout } = await run([], dir);
    const byClass = stdout.split('\n').filter((line) => /^ {2}\S+ +\d+ failures?/.test(line)).map((line) => line.trim().split(/ {2,}/));
    assert.deepEqual(byClass, [
      ['asked-of-him', '1 failure', '1 sighting'],
      ['machine', '1 failure', '2 sightings'],
      ['tool', '1 failure', '1 sighting'],
      ['wrong-information', '1 failure', '1 sighting'],
    ]);
  });
});

test('failures prints one line per entry, the most seen first, with its class, its state and the first day it was seen', async () => {
  await inProject(FULL, async (dir) => {
    const { stdout } = await run([], dir);
    const byEntry = stdout.split('\n').filter((line) => /^ {2} *\d+ {2}/.test(line)).map((line) => line.trim().split(/ {2,}/));
    assert.deepEqual(byEntry, [
      ['2', 'gate-reaches-its-bound', 'machine', 'repeated', 'first seen 2026-10-09'],
      ['1', 'question-that-was-not-his', 'asked-of-him', 'owed', 'first seen 2026-10-10'],
      ['1', 'renamed-test', 'tool', 'controlled', 'first seen 2026-10-08'],
      ['1', 'stated-without-checking', 'wrong-information', 'once', 'first seen 2026-10-10'],
    ]);
  });
});

test('failures <id> prints one entry whole, as it is written, and then its state', async () => {
  await inProject(FULL, async (dir) => {
    const { code, stdout, stderr } = await run(['gate-reaches-its-bound'], dir);
    assert.deepEqual([code, stderr], [0, '']);
    assert.equal(stdout, [...GATE, '', 'state: repeated, not settled (2 sightings, first seen 2026-10-09)'].join('\n'));
    const settled = await run(['renamed-test'], dir);
    assert.equal(settled.stdout, [...RENAMED, '', 'state: controlled (1 sighting, first seen 2026-10-08)'].join('\n'));
  });
});

test('failures <id> with an id the register does not hold exits 1 and says so', async () => {
  await inProject(FULL, async (dir) => {
    const { code, stdout, stderr } = await run(['never-recorded'], dir);
    assert.deepEqual([code, stdout], [1, '']);
    assert.match(stderr, /no entry "never-recorded" in docs\/FAILURES\.md.*js-harness failures/);
  });
});

test('failures check prints the row alone and exits 0 while it passes, entries that are not settled included', async () => {
  await inProject(FULL, async (dir) => {
    const { code, stdout, stderr } = await run(['check'], dir);
    assert.deepEqual([code, stderr], [0, '']);
    const [row] = checkFailures(dir);
    assert.equal(stdout, `PASS  failures  ${row.detail}\n      gate-reaches-its-bound  repeated  first seen 2026-10-09`);
  });
});

test('failures check --settled exits 1 while an entry is not settled, and says how many', async () => {
  await inProject(FULL, async (dir) => {
    const { code, stdout } = await run(['check', '--settled'], dir);
    assert.equal(code, 1);
    assert.match(stdout, /^PASS {2}failures {2}4 failures/);
    assert.match(stdout, /\nnot settled: 1 of 4 failures$/);
  });
});

test('failures check --settled exits 0 when every entry is settled', async () => {
  const files = { ...FULL, 'docs/FAILURES.md': register(QUESTION, RENAMED, STATED) };
  await inProject(files, async (dir) => {
    const { code, stdout } = await run(['check', '--settled'], dir);
    assert.equal(code, 0);
    assert.match(stdout, /^PASS {2}failures {2}3 failures, 3 sightings, 0 seen more than once, 0 not settled; /);
    assert.doesNotMatch(stdout, /\nnot settled/);
  });
});

test('a register that is refused exits 1 in every form, prints each fault and counts nothing', async () => {
  const broken = register(GATE, ['### stated-without-checking', 'A merge was reported as done.', '- Class: wrong-information']);
  await inProject({ 'docs/FAILURES.md': broken }, async (dir) => {
    for (const argv of [['check'], ['check', '--settled'], [], ['gate-reaches-its-bound']]) {
      const { code, stdout } = await run(argv, dir);
      assert.equal(code, 1, argv.join(' '));
      assert.equal(
        stdout,
        'FAIL  failures  docs/FAILURES.md is not read: 1 fault to repair in that file\n' +
          '      entry "stated-without-checking": has no sighting: add "- Seen: <YYYY-MM-DD> — <where the evidence is> — <a note>"',
        argv.join(' '),
      );
    }
  });
});

// ── The dispatcher ──────────────────────────────────────────────────────────────────────────────

/** Runs the real dispatcher in this process, capturing what it wrote to the console. */
async function dispatched(argv) {
  const out = [];
  const err = [];
  const { log, error } = console;
  console.log = (line) => out.push(line);
  console.error = (line) => err.push(line);
  try {
    const code = await dispatch(argv, { stdin: { isTTY: false }, stdout: { isTTY: false } });
    return { code, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    console.log = log;
    console.error = error;
  }
}

test('--help lists failures, and failures with a flag it does not know exits 2 with its usage through the dispatcher', async () => {
  assert.match((await dispatched(['--help'])).stdout, /^ {2}failures /m);
  const { code, stderr } = await dispatched(['failures', '--nope']);
  assert.equal(code, 2);
  assert.match(stderr, /unknown argument: --nope\n\nUsage: js-harness failures/);
});

test('a form that prints runs through the dispatcher too, on the project it is run in', async () => {
  await inProject(FULL, async (dir) => {
    const before = process.cwd();
    process.chdir(dir);
    try {
      const { code, stdout, stderr } = await dispatched(['failures', 'check']);
      assert.equal(code, 0);
      assert.match(stdout, /^PASS {2}failures {2}4 failures, 5 sightings, 1 seen more than once, 1 not settled; /);
      assert.equal(stderr, '');
    } finally {
      process.chdir(before);
    }
  });
});

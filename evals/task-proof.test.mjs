import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { childEnv, runProcess } from './runner.mjs';
import { applyReference, isDiscovered, proveTask } from './task-proof.mjs';

// Every directory a test makes lives under one root that is removed at the end.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-proof-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
let counter = 0;
const tmp = (name) => {
  const dir = path.join(scratch, `${name}-${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// ---- a task that passes every rule, and the helpers that break it one rule at a time ----------------

const CALC_STUB = `export const add = (a, b) => a + b;
export const sub = (a, b) => a - b;
export const mul = () => {
  throw new Error('not implemented');
};
`;
const CALC_SOLVED = CALC_STUB.replace(/export const mul = \(\) => \{\n {2}throw new Error\('not implemented'\);\n\};\n/, 'export const mul = (a, b) => a * b;\n');
const PACKAGE_JSON = `${JSON.stringify({ name: 'quote', private: true, scripts: { test: 'node --test "tests/**/*.spec.mjs"' } }, null, 2)}\n`;
const VISIBLE_SPEC = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, sub } from '../calc.mjs';

test('add', () => assert.equal(add(2, 3), 5));
test('sub', () => assert.equal(sub(5, 3), 2));
`;
// Each hidden test imports the module itself, so an empty workspace fails them one by one.
const GRADER = `import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('../calc.mjs');

test('add', async () => assert.equal((await load()).add(2, 3), 5));
test('sub', async () => assert.equal((await load()).sub(5, 3), 2));
test('mul', async () => assert.equal((await load()).mul(4, 3), 12));
`;
const GRADER_ARGS = ['--test', '--test-reporter=tap', '.eval-grader/*.grade.mjs'];

/** `task.json`. `proof: null` leaves the field out; anything else is written as given. */
const taskJson = ({ command = 'node', args = GRADER_ARGS, proof = { total: 3, fixturePassed: 2 } } = {}) => `${JSON.stringify({ grader: { command, args }, timeoutMs: 30000, ...(proof !== null && { proof }) }, null, 2)}\n`;

/** A grader that is a script, so its output depends on the workspace alone: no `calc.mjs` (the empty
 * workspace), the stub (the fixture), or `a * b` in it (the reference). `whenEmpty` is the JS expression
 * it prints for the empty workspace, which lets a test make exactly that run misbehave. */
const scripted = (whenEmpty) => taskJson({
  args: ['-e', `
const fs = require('node:fs');
if (!fs.existsSync('calc.mjs')) { console.log(${whenEmpty}); process.exit(0); }
const pass = fs.readFileSync('calc.mjs', 'utf8').includes('a * b') ? 3 : 2;
console.log('# tests 3\\n# pass ' + pass + '\\n# fail ' + (3 - pass));
`],
});

const validFiles = () => ({
  'task.md': 'Implement mul in calc.mjs.\n',
  'task.json': taskJson(),
  'fixture/package.json': PACKAGE_JSON,
  'fixture/calc.mjs': CALC_STUB,
  'fixture/tests/calc.spec.mjs': VISIBLE_SPEC,
  'grader/calc.grade.mjs': GRADER,
  'reference/calc.mjs': CALC_SOLVED,
});

/** Writes a task directory named `quote` from `{ 'relative/path': content }`; `null` skips an entry, so
 * a test overrides or removes part of the valid task by spreading over `validFiles()`. */
function writeTask(files) {
  const dir = path.join(tmp('task'), 'quote');
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return dir;
}

/** Proves a task built from `files`, and checks what holds for every problem: it names the task. */
async function prove(files, { workRoot = tmp('work') } = {}) {
  const result = await proveTask(writeTask(files), { workRoot });
  for (const problem of result.problems) assert.match(problem, /^task quote: /);
  return result;
}

const only = (result, pattern) => {
  assert.equal(result.problems.length, 1, `expected exactly one problem, got:\n${result.problems.join('\n')}`);
  assert.match(result.problems[0], pattern);
};
const some = (result, pattern) => assert.ok(result.problems.some((problem) => pattern.test(problem)), `no problem matches ${pattern}; got:\n${result.problems.join('\n')}`);

// ---- the valid task ------------------------------------------------------------------------------------

test('a valid task has no problems and the three scores the rules ask for', async () => {
  const workRoot = tmp('work');
  const result = await prove(validFiles(), { workRoot });
  assert.deepEqual(result.problems, []);
  assert.equal(result.id, 'quote');
  assert.deepEqual(result.fixture, { score: 2 / 3, passed: 2, total: 3, error: null });
  assert.deepEqual(result.reference, { score: 1, passed: 3, total: 3, error: null });
  assert.deepEqual(result.empty, { score: 0, passed: 0, total: 3, error: null });
  assert.deepEqual(result.visible, { fixture: { passed: 2, total: 2, failed: 0, error: null }, reference: { passed: 2, total: 2, failed: 0, error: null } });
  assert.deepEqual(fs.readdirSync(workRoot), [], 'every workspace is removed');
});

test('the reference is an overlay: its files replace the fixture\'s and add new ones, and nothing else changes', () => {
  const dir = writeTask({ ...validFiles(), 'reference/extra.mjs': 'export default 1;\n' });
  const workspace = tmp('workspace');
  fs.cpSync(path.join(dir, 'fixture'), workspace, { recursive: true });
  applyReference(dir, workspace);
  assert.equal(fs.readFileSync(path.join(workspace, 'calc.mjs'), 'utf8'), CALC_SOLVED);
  assert.equal(fs.readFileSync(path.join(workspace, 'extra.mjs'), 'utf8'), 'export default 1;\n');
  assert.equal(fs.readFileSync(path.join(workspace, 'package.json'), 'utf8'), PACKAGE_JSON);
  assert.equal(fs.readFileSync(path.join(workspace, 'tests', 'calc.spec.mjs'), 'utf8'), VISIBLE_SPEC);
});

// ---- rule a: the task loads ----------------------------------------------------------------------------

test('a task the runner cannot load is reported with the loader\'s message, and nothing else is checked', async () => {
  const result = await prove({ ...validFiles(), 'task.md': null });
  only(result, /task\.md is missing/);
  assert.deepEqual([result.fixture, result.reference, result.empty], [null, null, null]);
});

// ---- rule b: the reference exists ----------------------------------------------------------------------

test('a missing reference directory is a problem', async () => {
  const result = await prove({ ...validFiles(), 'reference/calc.mjs': null });
  only(result, /reference\/ is missing/);
  assert.equal(result.reference, null, 'there is nothing to apply, so no reference run');
});

test('a reference that is not a directory is a problem', async () => {
  const result = await prove({ ...validFiles(), 'reference/calc.mjs': null, reference: 'not a directory' });
  only(result, /reference is not a directory/);
});

test('a reference directory with no file is a problem', async () => {
  const dir = writeTask({ ...validFiles(), 'reference/calc.mjs': null });
  fs.mkdirSync(path.join(dir, 'reference'));
  const result = await proveTask(dir, { workRoot: tmp('work') });
  some(result, /reference\/ holds no file/);
});

// ---- rule c: no file of the reference is a copy of the fixture's ---------------------------------------

test('a reference file byte-identical to the fixture\'s is reported by its path', async () => {
  const result = await prove({ ...validFiles(), 'reference/package.json': PACKAGE_JSON });
  only(result, /byte-identical to the fixture's: package\.json/);
});

// ---- rule d: fixture plus reference scores 1 ---------------------------------------------------------------

test('a reference that does not solve the task is reported with its score', async () => {
  const result = await prove({ ...validFiles(), 'reference/calc.mjs': CALC_SOLVED.replace('a * b', 'a + b') });
  only(result, /fixture plus reference scores 2\/3, not 1/);
});

// ---- rule e: the untouched fixture leaves headroom ---------------------------------------------------------

test('a fixture that already scores 1 has no headroom', async () => {
  const result = await prove({ ...validFiles(), 'task.json': taskJson({ proof: { total: 3, fixturePassed: 3 } }), 'fixture/calc.mjs': CALC_SOLVED, 'reference/calc.mjs': `${CALC_SOLVED}// reference\n` });
  only(result, /untouched fixture scores 1: the task has no headroom/);
});

// ---- rules d, e and f: a grader run that failed is reported for each of the three runs ---------------------------

test('a grader that prints no TAP summary is reported for the fixture, the reference and the empty workspace', async () => {
  const result = await prove({ ...validFiles(), 'task.json': taskJson({ args: ['-e', 'console.log("hello")'] }) });
  assert.equal(result.problems.length, 3, result.problems.join('\n'));
  some(result, /fixture plus reference.*grader-unparsable/);
  some(result, /untouched fixture.*grader-unparsable/);
  some(result, /empty workspace.*grader-unparsable/);
});

test('a grader command that cannot be spawned is reported for all three runs, and the workspaces are still removed', async () => {
  const workRoot = tmp('work');
  const result = await prove({ ...validFiles(), 'task.json': taskJson({ command: 'no-such-command-for-evals', args: [] }) }, { workRoot });
  assert.equal(result.problems.length, 3, result.problems.join('\n'));
  for (const run of ['fixture plus reference', 'untouched fixture', 'empty workspace']) some(result, new RegExp(`${run}.*could not be spawned`));
  assert.deepEqual(fs.readdirSync(workRoot), []);
});

test('a workspace that cannot be prepared rejects only after every grader already started has finished', async () => {
  const marks = tmp('marks');
  // A slow grader that records when it starts and when it ends, outside the workspace it grades.
  const slow = taskJson({
    args: ['-e', `
const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(path.join(marks, 'started'))}, 'x\\n');
setTimeout(() => {
  fs.appendFileSync(${JSON.stringify(path.join(marks, 'finished'))}, 'x\\n');
  console.log('# tests 3\\n# pass 2\\n# fail 1');
}, 1500);
`],
  });
  // The fixture holds a directory `lib/` and the reference a file of that name: laying one over the other throws
  // (the code differs by platform: EIO on Windows, ERR_FS_CP_NON_DIR_TO_DIR elsewhere).
  const files = { ...validFiles(), 'task.json': slow, 'fixture/lib/x.mjs': '\n', 'reference/lib': 'a file\n' };
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  const workRoot = tmp('work');
  try {
    await assert.rejects(proveTask(writeTask(files), { workRoot }), Error);
    const count = (name) => (fs.existsSync(path.join(marks, name)) ? fs.readFileSync(path.join(marks, name), 'utf8').split('\n').length - 1 : 0);
    assert.ok(count('started') > 0, 'a grader had started when the preparation threw');
    assert.equal(count('finished'), count('started'), 'the rejection came after every started grader finished');
    assert.deepEqual(fs.readdirSync(workRoot), [], 'every workspace is removed, and only then');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, [], 'no promise is left rejecting unhandled');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

// ---- rule f: every hidden test fails in an empty workspace -------------------------------------------------------

test('a hidden test that passes in an empty workspace is reported', async () => {
  const result = await prove({
    ...validFiles(),
    'task.json': taskJson({ proof: { total: 4, fixturePassed: 3 } }),
    'grader/calc.grade.mjs': `${GRADER}test('constant', () => {});\n`,
  });
  only(result, /empty workspace passes 1 of 4 hidden tests/);
});

test('an empty workspace whose grader run cannot be parsed is reported', async () => {
  const result = await prove({ ...validFiles(), 'task.json': scripted("'boom'") });
  only(result, /empty workspace.*grader-unparsable/);
});

// ---- rule g: the same number of hidden tests runs everywhere --------------------------------------------------

test('runs that disagree on the number of hidden tests are reported', async () => {
  const result = await prove({ ...validFiles(), 'task.json': scripted("'# tests 2\\n# pass 0\\n# fail 2'") });
  only(result, /hidden test count.*fixture 3.*reference 3.*empty 2/);
});

// ---- rule h: task.json pins what was measured ------------------------------------------------------------------

test('a task.json without a proof, or with a malformed one, is reported', async () => {
  const proofs = [null, 'nope', { total: '3', fixturePassed: 2 }, { total: 3 }, { total: 0, fixturePassed: 0 }, { total: 3, fixturePassed: 4 }];
  // One after another: on a slow host a proof that times out adds a problem and fails `only` for the wrong reason.
  for (const proof of proofs) only(await prove({ ...validFiles(), 'task.json': taskJson({ proof }) }), /"proof" must be/);
});

test('a proof whose total differs from the measured one is reported', async () => {
  only(await prove({ ...validFiles(), 'task.json': taskJson({ proof: { total: 4, fixturePassed: 2 } }) }), /proof\.total is 4 but the grader ran 3 hidden tests/);
});

test('a proof whose fixturePassed differs from the measured one is reported', async () => {
  only(await prove({ ...validFiles(), 'task.json': taskJson({ proof: { total: 3, fixturePassed: 1 } }) }), /proof\.fixturePassed is 1 but the untouched fixture passes 2/);
});

// ---- rule i: the fixture's own test script -------------------------------------------------------------------------

test('a fixture without package.json is reported', async () => {
  only(await prove({ ...validFiles(), 'fixture/package.json': null }), /fixture\/package\.json is missing/);
});

test('a fixture whose scripts.test is not the agreed command is reported', async () => {
  const wrong = JSON.stringify({ name: 'quote', scripts: { test: 'node --test' } });
  only(await prove({ ...validFiles(), 'fixture/package.json': wrong }), /scripts\.test must be exactly node --test "tests\/\*\*\/\*\.spec\.mjs"/);
  only(await prove({ ...validFiles(), 'fixture/package.json': '{ nope' }), /fixture\/package\.json cannot be read/);
});

// ---- rule j: the visible suite is green with and without the reference ---------------------------------------------

test('a visible suite that fails on the untouched fixture is reported', async () => {
  const mul = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { mul } from '../calc.mjs';\n\ntest('mul', () => assert.equal(mul(2, 3), 6));\n";
  const result = await prove({ ...validFiles(), 'fixture/tests/mul.spec.mjs': mul });
  only(result, /visible suite fails on the untouched fixture \(2 of 3 pass\)/);
  assert.equal(result.visible.fixture.failed, 1);
});

test('a visible suite that fails once the reference is applied is reported', async () => {
  const stillStub = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { mul } from '../calc.mjs';\n\ntest('mul is a stub', () => assert.throws(() => mul(2, 3)));\n";
  only(await prove({ ...validFiles(), 'fixture/tests/mul.spec.mjs': stillStub }), /visible suite fails on fixture plus reference \(2 of 3 pass\)/);
});

test('a visible suite that runs no test is reported for both workspaces', async () => {
  const result = await prove({ ...validFiles(), 'fixture/tests/calc.spec.mjs': null });
  assert.equal(result.problems.length, 2, result.problems.join('\n'));
  some(result, /visible suite.*untouched fixture.*no test/);
  some(result, /visible suite.*fixture plus reference.*no test/);
});

test('the visible suite never sees the hidden grader', async () => {
  const noGrader = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\ntest('no grader yet', () => assert.equal(fs.existsSync('.eval-grader'), false));\n";
  const result = await prove({ ...validFiles(), 'fixture/tests/clean.spec.mjs': noGrader });
  assert.deepEqual(result.problems, []);
  assert.equal(result.visible.fixture.total, 3);
});

test('a visible suite that rewrites or deletes a source file does not change what the hidden grader measures', async () => {
  const touch = (action) => `import { test } from 'node:test';
import fs from 'node:fs';

test('touches the workspace', () => {
  const calc = new URL('../calc.mjs', import.meta.url);
  ${action}
});
`;
  const solve = `fs.writeFileSync(calc, ${JSON.stringify(CALC_SOLVED)});`;
  for (const action of [solve, 'fs.rmSync(calc);']) {
    const result = await prove({ ...validFiles(), 'fixture/tests/touch.spec.mjs': touch(action) });
    assert.deepEqual(result.problems, [], action);
    assert.equal(result.fixture.passed, 2, 'the graded fixture is the one nobody touched');
  }
});

// ---- rule k: nothing under the task is found by bare `node --test` -------------------------------------------------

test('every file Node would discover as a test is reported, wherever it is in the task', async () => {
  const found = ['fixture/lib/a.test.mjs', 'fixture/b-test.js', 'grader/c_test.mjs', 'fixture/test-d.mjs', 'reference/test.js', 'fixture/test/helper.mjs', 'fixture/lib/e.test.ts', 'fixture/lib/f.test.mts', 'fixture/lib/g.test.cts', 'grader/test/h.ts'];
  const result = await prove({ ...validFiles(), ...Object.fromEntries(found.map((name) => [name, '\n'])) });
  only(result, /Node's default test discovery/);
  for (const name of found) assert.ok(result.problems[0].includes(name), `${name} is named`);
});

test('names that only look like tests are not reported', async () => {
  const near = ['fixture/lib/latest.mjs', 'fixture/lib/testing.mjs', 'fixture/lib/contest.js', 'fixture/lib/mytest.mjs', 'fixture/lib/test.json', 'fixture/tests/helper.mjs', 'fixture/test/data.txt', 'grader/report-test.json', 'fixture/lib/a.test.jsx'];
  const result = await prove({ ...validFiles(), ...Object.fromEntries(near.map((name) => [name, '\n'])) });
  assert.deepEqual(result.problems, []);
});

// Observed on Node 24.15 with `node --test --test-reporter=tap` and no arguments (Windows): it runs
// *.test.X, *-test.X, *_test.X, test-*.X, test.X and every X file under a directory named test, for X in
// cjs, mjs, js, cts, mts, ts, and nothing else; `test-.js` counts, `test_a.js`, `a.spec.js` and `tests/` do not.
const SCRIPTS = ['cjs', 'mjs', 'js', 'cts', 'mts', 'ts'];
// File names are matched case-insensitively (observed: these ran). Under `lib/` so none shares a name with
// a lowercase one on a case-insensitive disk.
const CASED = ['lib/A.TEST.MJS', 'lib/a-Test.js', 'lib/Test-a.mjs', 'lib/a_TEST.cjs'];
const DISCOVERY_CASES = [
  ...SCRIPTS.flatMap((ext) => [`a.test.${ext}`, `a-test.${ext}`, `a_test.${ext}`, `test-a.${ext}`, `test.${ext}`, `test/data.${ext}`, `lib/test/deep/x.${ext}`]),
  ...['jsx', 'tsx', 'json', 'txt', 'md'].flatMap((ext) => [`a.test.${ext}`, `a-test.${ext}`, `test-a.${ext}`, `test.${ext}`, `test/data.${ext}`]),
  ...SCRIPTS.flatMap((ext) => [`test_a.${ext}`, `a.tests.${ext}`, `a.spec.${ext}`, `atest.${ext}`, `tests/x.${ext}`, `a.test.b.${ext}`, `lib/latest/x.${ext}`]),
  ...CASED,
];
// A directory named `Test` or `TEST` is not one Node looks into (observed on Windows: its files did not
// run), but `isDiscovered` flags it: over-reporting is the safe side. Not part of the live comparison.
const OVER_REPORTED = ['Test/x.mjs', 'TEST/x.mjs', 'lib/Test/deep/x.js', 'tests/Test/x.cjs', ...SCRIPTS.map((ext) => `Test/data.${ext}`)];

test('the discovery rule says what it says for each file name', () => {
  const yes = SCRIPTS.flatMap((ext) => [`a.test.${ext}`, `a-test.${ext}`, `a_test.${ext}`, `test-a.${ext}`, `test.${ext}`, `test/data.${ext}`, `lib/test/deep/x.${ext}`]);
  for (const name of [...yes, ...CASED, ...OVER_REPORTED]) assert.equal(isDiscovered(name), true, name);
  for (const name of DISCOVERY_CASES.filter((candidate) => !yes.includes(candidate) && !CASED.includes(candidate))) assert.equal(isDiscovered(name), false, name);
  for (const name of ['Test/data.json', 'Test/data.txt', 'lib/TESTS/x.mjs', 'Tests/x.mjs']) assert.equal(isDiscovered(name), false, name);
  assert.equal(isDiscovered('test-.js'), true);
});

test('the discovery rule agrees with the files this Node runs when given no arguments', async () => {
  const dir = tmp('discovery');
  for (const name of DISCOVERY_CASES) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `console.log('RAN ${name}');\n`);
  }
  // Whether the child runs .ts/.mts/.cts depends on its Node (type stripping is on by default only since
  // 22.18 / 23.6) and on the NODE_OPTIONS it inherits, so ask a child with the same environment.
  const feature = await runProcess({ command: process.execPath, args: ['-p', 'String(process.features.typescript)'], env: childEnv(), timeoutMs: 30 * 1000 });
  assert.ok(!feature.spawnError && !feature.timedOut, 'the child reported its features');
  const strips = ['strip', 'transform'].includes(feature.stdout.trim());
  const runnable = (name) => strips || !/\.(?:cts|mts|ts)$/.test(name);
  const run = await runProcess({ command: process.execPath, args: ['--test', '--test-reporter=tap'], env: childEnv(), cwd: dir, timeoutMs: 60 * 1000 });
  assert.ok(!run.spawnError && !run.timedOut, 'node --test ran');
  // The child prints its name; a name prefixed by the TAP comment marker is still matched.
  const ran = new Set([...run.stdout.matchAll(/RAN (\S+)/g)].map((match) => match[1]));
  assert.ok(ran.has('a.test.mjs'), 'the run did discover tests, so the comparison means something');
  // Whether Node matches file names case-insensitively depends on the platform (Windows does; Linux does
  // not), and `isDiscovered` flags the CASED names either way, so for them only "what ran is flagged" holds.
  const exact = (names) => names.filter((name) => !CASED.includes(name));
  assert.deepEqual(exact(DISCOVERY_CASES.filter(runnable).filter(isDiscovered)).sort(), exact([...ran]).sort());
  for (const name of CASED.filter((candidate) => ran.has(candidate))) assert.ok(isDiscovered(name), name);
});

// ---- rule l: the grader has a grader file --------------------------------------------------------------------------

test('a grader directory with no *.grade.mjs file is reported', async () => {
  const result = await prove({ ...validFiles(), 'task.json': scripted("'# tests 3\\n# pass 0\\n# fail 3'"), 'grader/calc.grade.mjs': null, 'grader/check.js': '// hidden\n' });
  only(result, /grader\/ holds no \*\.grade\.mjs file/);
});

// ---- rule m: the fixture brings no agent context --------------------------------------------------------------------

test('agent instructions, a .claude entry and node_modules anywhere in the fixture are reported once each', async () => {
  const result = await prove({
    ...validFiles(),
    'fixture/AGENTS.md': '\n',
    'fixture/lib/CLAUDE.md': '\n',
    'fixture/CLAUDE.local.md': '\n',
    'fixture/docs/claude.md': '\n',
    'fixture/.claude/settings.json': '{}\n',
    'fixture/node_modules/x/index.js': '\n',
    'fixture/lib/node_modules/y/AGENTS.md': '\n',
  });
  only(result, /fixture must not hold/);
  const [problem] = result.problems;
  for (const name of ['AGENTS.md', 'lib/CLAUDE.md', 'CLAUDE.local.md', 'docs/claude.md', '.claude', 'node_modules', 'lib/node_modules']) assert.ok(problem.includes(name), `${name} is named`);
  assert.ok(!problem.includes('.claude/settings.json') && !problem.includes('x/index.js') && !problem.includes('y/AGENTS.md'), 'what is inside a reported directory is not listed again');
});

// ---- rule n: the prompt does not name the grader ------------------------------------------------------------------

test('a task.md that names the hidden grader directory is reported', async () => {
  only(await prove({ ...validFiles(), 'task.md': 'Make .eval-grader/calc.grade.mjs pass.\n' }), /task\.md names \.eval-grader/);
});

// ---- rule o: LF line endings --------------------------------------------------------------------------------------

test('a text file with a CRLF line ending is reported by its path, and a binary file is not', async () => {
  const result = await prove({
    ...validFiles(),
    'task.md': 'Implement mul.\r\nIn calc.mjs.\n',
    'fixture/README.md': 'a\r\nb\r\n',
    'grader/notes.txt': 'a\r\n',
    'reference/NOTES.md': 'a\r\n',
    'fixture/logo.bin': Buffer.from([0, 13, 10, 1]),
  });
  only(result, /CRLF line ending/);
  const [problem] = result.problems;
  for (const name of ['task.md', 'fixture/README.md', 'grader/notes.txt', 'reference/NOTES.md']) assert.ok(problem.includes(name), `${name} is named`);
  assert.ok(!problem.includes('logo.bin'));
});

// ---- .gitattributes: a binary fixture file keeps its bytes -----------------------------------------------------------

test('the real evals/tasks line of .gitattributes keeps a binary file\'s bytes and stores a text file with LF', (t) => {
  if (spawnSync('git', ['--version'], { env: childEnv() }).error) return t.skip('git is not available');
  const root = path.resolve(import.meta.dirname, '..');
  const line = fs.readFileSync(path.join(root, '.gitattributes'), 'utf8').split(/\r?\n/).find((entry) => entry.startsWith('evals/tasks/**'));
  assert.ok(line, '.gitattributes has a line for evals/tasks/**');

  // A temp repo with this machine's setting (core.autocrlf=true) and nothing else from the user's git config.
  const repo = tmp('gitattributes');
  const env = childEnv({ GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(repo, 'no-global-config'), HOME: repo, USERPROFILE: repo });
  const git = (...args) => {
    const run = spawnSync('git', ['-c', 'core.autocrlf=true', ...args], { cwd: repo, env, encoding: 'buffer' });
    assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
    return run.stdout;
  };
  git('init', '--quiet');
  fs.writeFileSync(path.join(repo, '.gitattributes'), `${line}\n`);
  const binary = Buffer.from([0, 1, 13, 10, 2, 13, 10]);
  const text = Buffer.from('a\r\nb\r\n');
  fs.mkdirSync(path.join(repo, 'evals', 'tasks', 'x'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'evals', 'tasks', 'x', 'logo.bin'), binary);
  fs.writeFileSync(path.join(repo, 'evals', 'tasks', 'x', 'notes.txt'), text);
  git('add', '--all');

  const blob = (name) => git('cat-file', 'blob', `:evals/tasks/x/${name}`);
  assert.ok(blob('logo.bin').equals(binary), 'the binary file is stored with the bytes it had');
  assert.equal(blob('notes.txt').toString(), 'a\nb\n', 'the text file is stored with LF');
});

// The proof of a candidate eval task (`evals/tasks/<id>/`): grades the untouched fixture, the fixture with
// the reference solution laid over it, and an empty workspace with the runner's own grader, and lists
// every rule the candidate breaks. A task nobody proved can score every config the same and still look
// like a result, so `evals/tasks.test.mjs` runs this over every candidate. Zero deps, plain Node.
//
// The reference is the positive control: what the grader must pass. A case may also hold its negative control,
// `habit/`: the failure the case exists to catch, laid over the fixture as the reference is, which the grader must
// not pass. `task.json`'s proof pins what it scores (`habitPassed`) and names the hidden tests it must fail
// (`habitFails`), so a grader that gives the failure part of the credit is seen: `incident-01-paid-eval` gave 2 of
// 3 to a question asked after the paid run had started, in 19 of its 23 recorded trials
// (`odd/tasks/audit-u9-eval-bar.md`, specs 3 and 4). A habit must also grade otherwise than the untouched fixture
// does, by a count or by a test: where the fixture already fails every test the habit fails, a habit of one note file
// holds the same pins, and the control shows nothing (L13 there).
//
// What the control does not show: that the habit is what an agent really does (a reader judges that against the
// recorded trials), that the visible suite passes on it (a habit may break it, as an agent may), or why a hidden test
// fails (one that throws counts as one whose assertion fails). An overlay adds and replaces files: it cannot delete
// one of the fixture's, nor hold a commit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { childEnv, copyFixture, gradeWorkspace, loadTask, parseTap, removeDir, runProcess } from './runner.mjs';
import { runTaskScript } from './task-script.mjs';

// The command a fixture's `npm test` runs. Fixed, so the visible suite is the same thing everywhere and
// the fixture's tests never match the patterns bare `node --test` discovers (see `DISCOVERED`).
const VISIBLE_SCRIPT = 'node --test "tests/**/*.spec.mjs"';
const VISIBLE_TIMEOUT_MS = 60 * 1000;
const AGENT_CONTEXT = ['agents.md', 'claude.md', 'claude.local.md', '.claude', 'node_modules'];

// What `node --test` (the repo's own `npm test`) runs without being told: it would run a candidate's
// tests and, for a reference overlay, fail on modules the overlay does not hold. These are Node 24's
// default patterns, checked against the real thing (see the discovery test): a script file named
// `*.test.X`, `*-test.X`, `*_test.X`, `test-*.X` or `test.X`, or any script under a directory named
// `test`; a non-script such as `test/data.txt` is not run. Names match case-insensitively (observed on
// Windows; stricter than POSIX, which only over-reports). The `test` directory is matched
// case-insensitively too, though Node does not look into a directory named `Test` (observed on Windows):
// a candidate must not leak into any Node, so over-reporting is the safe direction. The script list holds
// `.ts`, `.mts` and `.cts` for the same reason: only a Node with type stripping runs them.
const SCRIPT = String.raw`(?:cjs|mjs|js|cts|mts|ts)`;
const DISCOVERED = [`\\.test\\.${SCRIPT}$`, `[-_]test\\.${SCRIPT}$`, `^test-.*\\.${SCRIPT}$`, `^test\\.${SCRIPT}$`].map((source) => new RegExp(source, 'i'));
const SCRIPT_FILE = new RegExp(`\\.${SCRIPT}$`, 'i');
export const isDiscovered = (file) => {
  const segments = file.split('/');
  const name = segments.pop();
  return (segments.some((segment) => segment.toLowerCase() === 'test') && SCRIPT_FILE.test(name)) || DISCOVERED.some((pattern) => pattern.test(name));
};

const isDirectory = (target) => fs.statSync(target, { throwIfNoEntry: false })?.isDirectory() === true;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Every directory and regular file below `root`, as `{ path, isDirectory }` with `/`-separated paths
 * relative to `root`. Links are skipped: a task never holds one that matters, and reading one could throw. */
function entries(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (entry.isDirectory()) {
        found.push({ path: rel, isDirectory: true });
        walk(full);
      } else if (entry.isFile()) {
        found.push({ path: rel, isDirectory: false });
      }
    }
  };
  if (isDirectory(root)) walk(root);
  return found;
}

/** Lays the task's `reference/` over `workspace`: its files replace the fixture's and add new ones, and
 * every other file stays. */
export function applyReference(taskDir, workspace) {
  fs.cpSync(path.join(taskDir, 'reference'), workspace, { recursive: true });
}

/** The fixture's own visible suite, run as `npm test` would, in `workspace`: `{ passed, total, failed,
 * error }`, with `error` `spawn`, `timeout` or `unparsable` (no TAP summary, or zero tests: a suite that
 * ran nothing proved nothing). Run in a copy of its own, so it sees what an agent sees. `start` is the process run
 * (`runProcess` of `runner.mjs`, or the one `proveTask` was handed). */
async function runVisible(workspace, start) {
  const run = await start({
    command: process.execPath,
    args: ['--test', '--test-reporter=tap', 'tests/**/*.spec.mjs'],
    env: childEnv(),
    cwd: workspace,
    timeoutMs: VISIBLE_TIMEOUT_MS,
  });
  const unknown = (error) => ({ passed: null, total: null, failed: null, error });
  if (run.spawnError) return unknown('spawn');
  if (run.timedOut) return unknown('timeout');
  const tap = parseTap(run.stdout);
  return tap ? { passed: tap.pass, total: tap.tests, failed: tap.fail, error: null } : unknown('unparsable');
}

/** Lays the task's `habit/` over `workspace`, as `applyReference` lays the reference. */
function applyHabit(taskDir, workspace) {
  fs.cpSync(path.join(taskDir, 'habit'), workspace, { recursive: true });
}

/** Runs the five measurements side by side (each costs about a second of process cleanup on Windows, so
 * one after the other would make a proof the slowest test of the suite): the grader on the untouched
 * fixture, on the fixture plus reference, and on an empty workspace, and the visible suite on the first
 * two. The visible suites get copies of their own, never the graded ones: a visible test that writes or
 * deletes a file must not change what the hidden grader measures. Each is a fresh directory under
 * `workRoot`, and every one is removed on every path, after all have finished. A reference that is not a
 * directory is not applied: there is nothing to run. A task that holds `habit/` gets a sixth, the grader on the
 * fixture plus the habit, asked for the names of the tests that failed whatever the task records of its trials, as
 * its untouched fixture then is: the two are compared.
 *
 * Preparing a workspace is part of its own run, so a preparation that throws (a reference file that
 * cannot be laid over the fixture) is one rejected run like any other: the wait still covers every grader
 * already started, nothing is removed under a live process, and the first rejection is rethrown after it.
 * `start` is the process run every grader and visible suite goes through (see `proveTask`). */
async function measure(task, taskDir, workRoot, start) {
  fs.mkdirSync(workRoot, { recursive: true });
  const made = [];
  const run = async (prepare, work) => {
    const dir = fs.mkdtempSync(path.join(workRoot, 'proof-'));
    made.push(dir);
    prepare(dir);
    return work(dir);
  };
  // A task with setup is proven where an agent would start: the fixture, then its setup script. A reference that
  // must change state a file cannot hold (a commit) carries `setup/reference.mjs`, run after the overlay.
  const fixture = (dir) => {
    copyFixture(task, dir);
    if (task.setup) runTaskScript(task, task.setup, dir, childEnv());
  };
  const referenceScript = path.join(taskDir, 'setup', 'reference.mjs');
  const reference = (dir) => {
    fixture(dir);
    applyReference(taskDir, dir);
    if (fs.existsSync(referenceScript)) runTaskScript(task, referenceScript, dir, childEnv());
  };
  const habit = (dir) => {
    fixture(dir);
    applyHabit(taskDir, dir);
  };
  const hasReference = isDirectory(path.join(taskDir, 'reference'));
  const hasHabit = isDirectory(path.join(taskDir, 'habit'));
  const graded = (prepare, as = task) => run(prepare, (dir) => gradeWorkspace(as, dir, { runProcess: start }));
  // The visible suite runs in a copy that is never graded, so it sees what an agent sees.
  const visible = (prepare) => run(prepare, (dir) => runVisible(dir, start));
  try {
    const settled = await Promise.allSettled([
      graded(fixture, hasHabit ? { ...task, recordFailed: true } : task),
      hasReference ? graded(reference) : null,
      graded(() => {}),
      visible(fixture),
      hasReference ? visible(reference) : null,
      hasHabit ? graded(habit, { ...task, recordFailed: true }) : null,
    ]);
    const failed = settled.find((outcome) => outcome.status === 'rejected');
    if (failed) throw failed.reason;
    const [gradedFixture, gradedReference, empty, visibleFixture, visibleReference, gradedHabit] = settled.map((outcome) => outcome.value);
    return {
      fixture: gradedFixture,
      reference: gradedReference,
      empty,
      habit: gradedHabit,
      visible: { fixture: visibleFixture, reference: visibleReference },
    };
  } finally {
    for (const dir of made) removeDir(dir, 'workspace', (message) => console.error(message));
  }
}

const failure = (run) => (run.spawnError ? `its grader could not be spawned (${run.spawnError.message})` : run.error);
const score = (run) => `${run.passed}/${run.total}`;

/** The rules that read files only: the shape of the task directory. */
function checkFiles(dir, task, complain) {
  const referenceDir = path.join(dir, 'reference');
  const reference = entries(referenceDir).filter((entry) => !entry.isDirectory);
  if (isDirectory(referenceDir)) {
    if (reference.length === 0) complain('reference/ holds no file: it must hold the files a correct solution changes or adds');
  } else {
    complain(fs.existsSync(referenceDir) ? 'reference is not a directory' : 'reference/ is missing: it holds the files a correct solution changes or adds');
  }
  const identical = reference.filter(({ path: name }) => {
    const copy = path.join(task.fixtureDir, name);
    return fs.statSync(copy, { throwIfNoEntry: false })?.isFile() && fs.readFileSync(copy).equals(fs.readFileSync(path.join(referenceDir, name)));
  });
  if (identical.length > 0) complain(`reference/ holds files byte-identical to the fixture's: ${identical.map((entry) => entry.path).join(', ')}; an overlay holds only what the solution changes or adds`);

  const habitDir = path.join(dir, 'habit');
  if (isDirectory(habitDir)) {
    if (!entries(habitDir).some((entry) => !entry.isDirectory)) complain('habit/ holds no file: it holds the files of the failure the case exists to catch');
  } else if (fs.existsSync(habitDir)) {
    complain('habit is not a directory');
  }

  let scriptsTest;
  try {
    scriptsTest = JSON.parse(fs.readFileSync(path.join(task.fixtureDir, 'package.json'), 'utf8'))?.scripts?.test;
  } catch (err) {
    complain(err.code === 'ENOENT' ? 'fixture/package.json is missing: it carries the visible test script' : `fixture/package.json cannot be read: ${err.message}`);
    scriptsTest = VISIBLE_SCRIPT;
  }
  if (scriptsTest !== VISIBLE_SCRIPT) complain(`fixture/package.json scripts.test must be exactly ${VISIBLE_SCRIPT}`);

  const all = entries(dir);
  const discovered = all.filter((entry) => !entry.isDirectory && isDiscovered(entry.path));
  if (discovered.length > 0) complain(`files Node's default test discovery would run in the repo's bare \`node --test\`: ${discovered.map((entry) => entry.path).join(', ')}; name tests *.spec.mjs and hidden ones *.grade.mjs`);

  if (!entries(task.graderDir).some((entry) => !entry.isDirectory && entry.path.endsWith('.grade.mjs'))) complain('grader/ holds no *.grade.mjs file: hidden tests are named so bare `node --test` never runs them');

  const context = entries(task.fixtureDir).filter((entry) => AGENT_CONTEXT.includes(entry.path.split('/').pop().toLowerCase()));
  // What is inside a reported directory is part of it, not a second finding.
  const top = context.filter((entry) => !context.some((other) => other !== entry && entry.path.startsWith(`${other.path}/`)));
  if (top.length > 0) complain(`fixture must not hold agent context (AGENTS.md, CLAUDE.md, CLAUDE.local.md, .claude, node_modules): ${top.map((entry) => entry.path).join(', ')}; \`js-harness init\` adds the project layer to one arm only`);

  if (task.prompt.includes('.eval-grader')) complain('task.md names .eval-grader: the prompt must not point at the hidden grader');

  const crlf = all.filter((entry) => {
    if (entry.isDirectory) return false;
    const bytes = fs.readFileSync(path.join(dir, entry.path));
    return !bytes.includes(0) && bytes.includes('\r\n');
  });
  if (crlf.length > 0) complain(`files with a CRLF line ending: ${crlf.map((entry) => entry.path).join(', ')}; a fixture must be the same bytes on every machine`);
}

/** `task.json`'s `proof`, or `null` after reporting that it is missing or malformed. A task that holds `habit/`
 * pins it there too, and one that holds none pins none. */
function readProof(dir, complain) {
  const { proof } = JSON.parse(fs.readFileSync(path.join(dir, 'task.json'), 'utf8'));
  const valid = isObject(proof) && Number.isInteger(proof.total) && proof.total > 0 && Number.isInteger(proof.fixturePassed) && proof.fixturePassed >= 0 && proof.fixturePassed <= proof.total;
  if (!valid) {
    complain('task.json "proof" must be { "total": <hidden tests>, "fixturePassed": <passed on the untouched fixture> }, integers with 0 <= fixturePassed <= total');
    return null;
  }
  const pins = proof.habitPassed !== undefined || proof.habitFails !== undefined;
  if (!isDirectory(path.join(dir, 'habit'))) {
    if (!pins) return proof;
    complain('task.json "proof" holds "habitPassed" or "habitFails" and the task has no habit/: they pin what the failure the case exists to catch scores');
    return null;
  }
  const pinned = Number.isInteger(proof.habitPassed) && proof.habitPassed >= 0 && proof.habitPassed < proof.total
    && Array.isArray(proof.habitFails) && proof.habitFails.length > 0 && proof.habitFails.every((name) => typeof name === 'string' && name.trim() !== '');
  if (pinned) return proof;
  complain('task.json "proof" of a task with habit/ must also hold "habitPassed": <hidden tests the habit passes, fewer than total> and "habitFails": [<the name of each hidden test the habit must fail>]');
  return null;
}

/** The rules that read the three graded runs and the visible suite. */
function checkRuns({ fixture, reference, empty, habit, visible }, proof, complain) {
  if (reference) {
    if (failure(reference)) complain(`fixture plus reference: the grader run failed: ${failure(reference)}`);
    else if (reference.score !== 1) complain(`fixture plus reference scores ${score(reference)}, not 1: the reference does not solve the task`);
  }
  if (failure(fixture)) complain(`the untouched fixture's grader run failed: ${failure(fixture)}`);
  else if (fixture.score === 1) complain('the untouched fixture scores 1: the task has no headroom');
  if (failure(empty)) complain(`the empty workspace's grader run failed: ${failure(empty)}; every hidden test must fail one by one there, so a missing module may fail a test but never the whole file`);
  else if (empty.passed !== 0) complain(`the empty workspace passes ${empty.passed} of ${empty.total} hidden tests: every hidden test must fail there`);

  if (habit) {
    if (failure(habit)) complain(`fixture plus habit: the grader run failed: ${failure(habit)}`);
    else if (habit.score === 1) complain(`fixture plus habit scores ${score(habit)}: the grader passes the failure the case exists to catch`);
    else if (!failure(fixture) && habit.passed === fixture.passed && [...(habit.failed ?? [])].sort().join('\n') === [...(fixture.failed ?? [])].sort().join('\n')) {
      complain(`fixture plus habit fails the hidden tests the untouched fixture fails, and no other (${habit.passed} of ${habit.total} pass): the habit shows nothing the fixture does not; it must pass a hidden test the fixture fails, or fail one the fixture passes`);
    }
  }

  const totals = { fixture, reference, empty, habit };
  const counted = Object.entries(totals).filter(([, run]) => Number.isInteger(run?.total));
  if (new Set(counted.map(([, run]) => run.total)).size > 1) complain(`the runs disagree on the hidden test count (${counted.map(([name, run]) => `${name} ${run.total}`).join(', ')}): a whole-file failure turns a fractional score into 0`);

  if (proof) {
    const measured = counted[0]?.[1].total;
    if (measured !== undefined && proof.total !== measured) complain(`task.json proof.total is ${proof.total} but the grader ran ${measured} hidden tests; update the proof if the change is intended`);
    if (Number.isInteger(fixture.passed) && proof.fixturePassed !== fixture.passed) complain(`task.json proof.fixturePassed is ${proof.fixturePassed} but the untouched fixture passes ${fixture.passed}; update the proof if the change is intended`);
    if (habit && Number.isInteger(habit.passed)) {
      if (proof.habitPassed !== habit.passed) complain(`task.json proof.habitPassed is ${proof.habitPassed} but fixture plus habit passes ${habit.passed}; update the proof if the change is intended`);
      for (const name of proof.habitFails.filter((wanted) => !(habit.failed ?? []).includes(wanted))) {
        complain(`fixture plus habit does not fail the hidden test ${JSON.stringify(name)}, which proof.habitFails says it must: the grader gives the habit credit there, or runs no test of that name`);
      }
    }
  }

  for (const [label, run] of [['the untouched fixture', visible.fixture], ['fixture plus reference', visible.reference]]) {
    if (!run) continue;
    if (run.error) complain(`the visible suite on ${label} did not report: ${run.error} (it must run at least one test and print TAP; no test, or no summary, counts as no proof)`);
    else if (run.failed > 0) complain(`the visible suite fails on ${label} (${run.passed} of ${run.total} pass): it must be green with and without the reference`);
  }
}

/** Proves the task in `taskDir`: resolves to `{ id, fixture, reference, empty, habit, visible: { fixture, reference },
 * problems }`. The first three are `gradeWorkspace` results for the untouched fixture, the fixture with
 * the reference overlay, and an empty workspace; `habit` is the one for the fixture with the habit overlay, with
 * the names of the tests it failed, or `null` for a task that holds none; `visible` holds the fixture's own suite
 * in the first two;
 * `problems` is one sentence per rule broken, each naming the task, and empty when the task is proven.
 *
 * A broken candidate is reported whole, so a rule violation is never thrown, and a task that does not
 * load is the one case where nothing else can be checked. Nothing here runs an agent, so the workspaces
 * go under `os.tmpdir()` by default; every one is removed on every path.
 *
 * `runProcess` (by default the real one) is the run of each of the five measurements; a caller can hand in
 * another, and nothing that ships does. */
export async function proveTask(taskDir, { workRoot = os.tmpdir(), runProcess: start = runProcess } = {}) {
  const dir = path.resolve(taskDir);
  const id = path.basename(dir);
  const problems = [];
  const complain = (text) => problems.push(`task ${id}: ${text}`);
  let task;
  try {
    task = loadTask(dir);
  } catch (err) {
    problems.push(err.message.startsWith(`task ${id}:`) ? err.message : `task ${id}: cannot be loaded: ${err.message}`);
    return { id, fixture: null, reference: null, empty: null, habit: null, visible: { fixture: null, reference: null }, problems };
  }
  checkFiles(dir, task, complain);
  const proof = readProof(dir, complain);
  const runs = await measure(task, dir, path.resolve(workRoot), start);
  checkRuns(runs, proof, complain);
  return { id, ...runs, problems };
}

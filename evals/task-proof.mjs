// The proof of a candidate eval task (`evals/tasks/<id>/`): grades the untouched fixture, the fixture with
// the reference solution laid over it, and an empty workspace with the runner's own grader, and lists
// every rule the candidate breaks. A task nobody proved can score every config the same and still look
// like a result, so `evals/tasks.test.mjs` runs this over every candidate. Zero deps, plain Node.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { childEnv, copyFixture, gradeWorkspace, loadTask, parseTap, removeDir, runProcess } from './runner.mjs';

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
// Windows; stricter than POSIX, which only over-reports).
const SCRIPT = String.raw`(?:cjs|mjs|js|cts|mts|ts)`;
const DISCOVERED = [`\\.test\\.${SCRIPT}$`, `[-_]test\\.${SCRIPT}$`, `^test-.*\\.${SCRIPT}$`, `^test\\.${SCRIPT}$`].map((source) => new RegExp(source, 'i'));
const SCRIPT_FILE = new RegExp(`\\.${SCRIPT}$`, 'i');
export const isDiscovered = (file) => {
  const segments = file.split('/');
  const name = segments.pop();
  return (segments.includes('test') && SCRIPT_FILE.test(name)) || DISCOVERED.some((pattern) => pattern.test(name));
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
 * ran nothing proved nothing). Run in a copy of its own, so it sees what an agent sees. */
async function runVisible(workspace) {
  const run = await runProcess({
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

/** Runs the five measurements side by side (each costs about a second of process cleanup on Windows, so
 * one after the other would make a proof the slowest test of the suite): the grader on the untouched
 * fixture, on the fixture plus reference, and on an empty workspace, and the visible suite on the first
 * two. The visible suites get copies of their own, never the graded ones: a visible test that writes or
 * deletes a file must not change what the hidden grader measures. Each is a fresh directory under
 * `workRoot`, and every one is removed on every path, after all have finished. A reference that is not a
 * directory is not applied: there is nothing to run. */
async function measure(task, taskDir, workRoot) {
  fs.mkdirSync(workRoot, { recursive: true });
  const made = [];
  const workspace = (prepare) => {
    const dir = fs.mkdtempSync(path.join(workRoot, 'proof-'));
    made.push(dir);
    prepare(dir);
    return dir;
  };
  const fixture = (dir) => copyFixture(task, dir);
  const reference = (dir) => { copyFixture(task, dir); applyReference(taskDir, dir); };
  const hasReference = isDirectory(path.join(taskDir, 'reference'));
  const graded = (prepare) => gradeWorkspace(task, workspace(prepare));
  // The visible suite runs in a copy that is never graded, so it sees what an agent sees.
  const visible = (prepare) => runVisible(workspace(prepare));
  try {
    const settled = await Promise.allSettled([
      graded(fixture),
      hasReference ? graded(reference) : null,
      graded(() => {}),
      visible(fixture),
      hasReference ? visible(reference) : null,
    ]);
    const failed = settled.find((outcome) => outcome.status === 'rejected');
    if (failed) throw failed.reason;
    const [gradedFixture, gradedReference, empty, visibleFixture, visibleReference] = settled.map((outcome) => outcome.value);
    return {
      fixture: gradedFixture,
      reference: gradedReference,
      empty,
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

/** `task.json`'s `proof`, or `null` after reporting that it is missing or malformed. */
function readProof(dir, complain) {
  const { proof } = JSON.parse(fs.readFileSync(path.join(dir, 'task.json'), 'utf8'));
  const valid = isObject(proof) && Number.isInteger(proof.total) && proof.total > 0 && Number.isInteger(proof.fixturePassed) && proof.fixturePassed >= 0 && proof.fixturePassed <= proof.total;
  if (valid) return proof;
  complain('task.json "proof" must be { "total": <hidden tests>, "fixturePassed": <passed on the untouched fixture> }, integers with 0 <= fixturePassed <= total');
  return null;
}

/** The rules that read the three graded runs and the visible suite. */
function checkRuns({ fixture, reference, empty, visible }, proof, complain) {
  if (reference) {
    if (failure(reference)) complain(`fixture plus reference: the grader run failed: ${failure(reference)}`);
    else if (reference.score !== 1) complain(`fixture plus reference scores ${score(reference)}, not 1: the reference does not solve the task`);
  }
  if (failure(fixture)) complain(`the untouched fixture's grader run failed: ${failure(fixture)}`);
  else if (fixture.score === 1) complain('the untouched fixture scores 1: the task has no headroom');
  if (failure(empty)) complain(`the empty workspace's grader run failed: ${failure(empty)}; every hidden test must fail one by one there, so a missing module may fail a test but never the whole file`);
  else if (empty.passed !== 0) complain(`the empty workspace passes ${empty.passed} of ${empty.total} hidden tests: every hidden test must fail there`);

  const totals = { fixture, reference, empty };
  const counted = Object.entries(totals).filter(([, run]) => Number.isInteger(run?.total));
  if (new Set(counted.map(([, run]) => run.total)).size > 1) complain(`the runs disagree on the hidden test count (${counted.map(([name, run]) => `${name} ${run.total}`).join(', ')}): a whole-file failure turns a fractional score into 0`);

  if (proof) {
    const measured = counted[0]?.[1].total;
    if (measured !== undefined && proof.total !== measured) complain(`task.json proof.total is ${proof.total} but the grader ran ${measured} hidden tests; update the proof if the change is intended`);
    if (Number.isInteger(fixture.passed) && proof.fixturePassed !== fixture.passed) complain(`task.json proof.fixturePassed is ${proof.fixturePassed} but the untouched fixture passes ${fixture.passed}; update the proof if the change is intended`);
  }

  for (const [label, run] of [['the untouched fixture', visible.fixture], ['fixture plus reference', visible.reference]]) {
    if (!run) continue;
    if (run.error) complain(`the visible suite on ${label} did not report: ${run.error} (it must run at least one test and print TAP; no test, or no summary, counts as no proof)`);
    else if (run.failed > 0) complain(`the visible suite fails on ${label} (${run.passed} of ${run.total} pass): it must be green with and without the reference`);
  }
}

/** Proves the task in `taskDir`: resolves to `{ id, fixture, reference, empty, visible: { fixture, reference },
 * problems }`. The first three are `gradeWorkspace` results for the untouched fixture, the fixture with
 * the reference overlay, and an empty workspace; `visible` holds the fixture's own suite in the first two;
 * `problems` is one sentence per rule broken, each naming the task, and empty when the task is proven.
 *
 * A broken candidate is reported whole, so a rule violation is never thrown, and a task that does not
 * load is the one case where nothing else can be checked. Nothing here runs an agent, so the workspaces
 * go under `os.tmpdir()` by default; every one is removed on every path. */
export async function proveTask(taskDir, { workRoot = os.tmpdir() } = {}) {
  const dir = path.resolve(taskDir);
  const id = path.basename(dir);
  const problems = [];
  const complain = (text) => problems.push(`task ${id}: ${text}`);
  let task;
  try {
    task = loadTask(dir);
  } catch (err) {
    problems.push(err.message.startsWith(`task ${id}:`) ? err.message : `task ${id}: cannot be loaded: ${err.message}`);
    return { id, fixture: null, reference: null, empty: null, visible: { fixture: null, reference: null }, problems };
  }
  checkFiles(dir, task, complain);
  const proof = readProof(dir, complain);
  const runs = await measure(task, dir, path.resolve(workRoot));
  checkRuns(runs, proof, complain);
  return { id, ...runs, problems };
}

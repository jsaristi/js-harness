import assert from 'node:assert/strict';
import test from 'node:test';
import { findRunning, readRunning, RUNNING_PROCESSES } from './sessions-running.mjs';
import { QUIET_PROCESSES, workOfProcesses } from './quiet.mjs';

// The running work on the board (odd/tasks/visual-pages.md, spec 4, T5), from a process listing handed in.
const TREE = 'D:\\js-harness\\.claude\\worktrees\\f8-s5c';
const NODE = '"C:\\Program Files\\nodejs\\node.exe"';
const at = Date.parse('2026-10-29T01:00:00.000Z');
const proc = (pid, commandLine, createdAt = at - 600_000) => ({ pid, createdAt, commandLine });

test('the gates, the Codex and lens reviews and the eval batches are found by their arguments, each with its start and worktree', () => {
  const processes = [
    proc(1, `${NODE} ${TREE}\\bin\\check.mjs`),
    proc(2, `${NODE} ${TREE}\\evals\\suite.mjs --paid`),
    proc(3, `${NODE} "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\js-harness\\bin\\js-harness.mjs" codex-review --base abc`),
    proc(4, `${NODE} ${TREE}\\bin\\lens-review.mjs --base abc --lenses risk`, Number.NaN),
  ];
  // The Windows listing keeps only the lines its filter matches, so each of these must pass it.
  for (const { commandLine } of processes) assert.match(commandLine, new RegExp(RUNNING_PROCESSES));
  const items = findRunning(processes, [TREE]);
  assert.deepEqual(items.map((one) => [one.kind, one.pid, one.where]), [['gate', 1, TREE], ['evals', 2, TREE], ['codex-review', 3, null], ['lens-review', 4, TREE]]);
  assert.equal(items[1].since, '2026-10-29T00:50:00.000Z');
  assert.equal(items[3].since, null, 'a listing with no start time gives none');
});

test('a test file or another command that holds the same words is no running work', () => {
  assert.deepEqual(findRunning([
    proc(5, `${NODE} --test bin\\codex-review.test.mjs`),
    proc(6, `${NODE} ${TREE}\\bin\\js-harness.mjs sessions --quote codex-review 1`),
    proc(7, `${NODE} ${TREE}\\evals\\suite.test.mjs`),
    proc(8, 'C:\\tools\\codex.exe review'),
  ], [TREE]), []);
});

// Audit M34 (2026-11-09): `quiet` and the board kept two lists of the work that runs, so a lens review or an eval batch
// did not keep the PC on, and the board showed no land. One list now: what one counts, the other counts.
test('the board and quiet count the same work from one listing: lands, Codex reviews, lens reviews and eval batches', () => {
  const processes = [
    proc(11, `${NODE} "D:\\js\\bin\\js-harness.mjs" merge-queue --land --refresh-copy`),
    proc(12, `${NODE} ${TREE}\\bin\\merge-queue.mjs --dry-run`),
    proc(13, '"C:\\Users\\me\\codex.exe" exec review --json --base main'),
    proc(14, `${NODE} ${TREE}\\bin\\lens-review.mjs --base abc --lenses risk`),
    proc(15, `${NODE} ${TREE}\\bin\\lens-review.mjs --base abc --unavailable "no session"`),
    proc(16, `${NODE} ${TREE}\\evals\\suite.mjs --paid`),
    proc(17, `${NODE} ${TREE}\\bin\\codex-review.mjs --base abc`),
    proc(18, `${NODE} ${TREE}\\bin\\wait.mjs --main-file bin/lens-review.mjs --for 60`),
  ];
  for (const { commandLine } of processes) assert.match(commandLine, new RegExp(QUIET_PROCESSES));
  for (const { commandLine } of processes) assert.match(commandLine, new RegExp(RUNNING_PROCESSES));
  const board = findRunning(processes, [TREE]).map((one) => [one.kind, one.pid, one.where]);
  assert.deepEqual(board, [['land', 11, null], ['codex-review', 13, null], ['lens-review', 14, TREE], ['evals', 16, TREE], ['codex-review', 17, TREE]]);
  assert.deepEqual(workOfProcesses(processes).map((one) => [one.source, one.pid]), board.map(([kind, pid]) => [kind, pid]));
});

test('the read is held until the next check, and a listing that fails says why', () => {
  const later = at + 45 * 60_000;
  assert.deepEqual(readRunning(() => [], [TREE], at, later), { at: '2026-10-29T01:00:00.000Z', until: '2026-10-29T01:45:00.000Z', items: [] });
  const failed = readRunning(() => { throw new Error('powershell timed out'); }, [TREE], at, later);
  assert.equal(failed.unavailable, 'the process listing: powershell timed out');
  assert.equal(failed.items, undefined);
});

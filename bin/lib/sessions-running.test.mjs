import assert from 'node:assert/strict';
import test from 'node:test';
import { findRunning, readRunning, RUNNING_PROCESSES } from './sessions-running.mjs';

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

test('the read is held until the next check, and a listing that fails says why', () => {
  const later = at + 45 * 60_000;
  assert.deepEqual(readRunning(() => [], [TREE], at, later), { at: '2026-10-29T01:00:00.000Z', until: '2026-10-29T01:45:00.000Z', items: [] });
  const failed = readRunning(() => { throw new Error('powershell timed out'); }, [TREE], at, later);
  assert.equal(failed.unavailable, 'the process listing: powershell timed out');
  assert.equal(failed.items, undefined);
});

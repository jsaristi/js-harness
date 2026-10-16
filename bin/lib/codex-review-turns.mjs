// Where a review of a range is cut into turns: a merge of the default branch below HEAD, read by what was
// written in it, then the commits after it (odd/tasks/merge-below-head.md). His answer of 2026-10-16:
// a hand-resolved merge of main is reviewed only on the lines written in it, wherever it sits.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mergeStart } from './codex-review-coverage.mjs';
import { RECHECK_LOOK_BACK, recheckAnchor, recheckState } from './codex-review-recheck.mjs';
import { readCodexReviewRuns } from './codex-review-runs.mjs';
import { readCodexReviews } from './codex-reviews.mjs';
import { leftOutOf } from './codex-review-scope.mjs';

/** The merge the review of `given..tip` is cut at, from `uncovered`, the code commits of that range no record
 * covers (`reviewCoverage`, newest first): `{ merge, from, side, branch, auto }`, the merge, its first parent
 * and what `mergeStart` says of it, or `null` for a range reviewed as one.
 *
 * It is cut only where nothing is lost by the cut (S1): the oldest uncovered commit is a merge below `tip`
 * that `mergeStart` reads as a merge at HEAD when asked of it (so every code commit before it has a record);
 * the review that ended at its first parent owes no correction, since a recheck of it would otherwise be
 * taken by the review of the merge, which is never one; and the files written in it are left out alike by
 * the marks at the merge and at `tip`, since the merge's turn reads its marks and the push reads those of
 * `tip`. `null` too wherever git or the records cannot say. */
export function mergeTurn(cwd, { given, tip, uncovered, spawn = spawnSync, where, remote = 'origin' }) {
  const oldest = uncovered.at(-1);
  if (oldest === undefined || oldest.id === tip || oldest.parentCount !== 2) return null;
  const atMerge = mergeStart(cwd, { given, tip: oldest.id, spawn, where, remote });
  if (atMerge === null) return null;
  const marksAt = (source) => leftOutOf(oldest.files, { cwd, source, spawn, where });
  const atMergeMarks = marksAt(oldest.id);
  const atTipMarks = marksAt(tip);
  if (atMergeMarks === null || atTipMarks === null) return null;
  if (oldest.files.some((file) => atMergeMarks.has(file) !== atTipMarks.has(file))) return null;
  // The review the first parent's findings would be rechecked from is found as a run finds it, past commits
  // that changed documents alone (`recheckAnchor`): asked at the first parent itself, a document commit
  // between a review that owes a correction and the merge would let the cut drop that recheck (verifier B1).
  const lines = (args) => {
    try {
      const result = spawn('git', args, { cwd, encoding: 'utf8' });
      return result && !result.error && result.status === 0 ? String(result.stdout ?? '') : null;
    } catch {
      return null;
    }
  };
  const back = lines(['rev-list', `--max-count=${RECHECK_LOOK_BACK}`, atMerge.from]);
  if (back === null) return null;
  const changedBetween = (older, newer) => lines(['diff', '--no-renames', '--name-only', '-z', older, newer])?.split('\0').filter(Boolean) ?? null;
  let state;
  try {
    const records = readCodexReviews(cwd, { spawn, where });
    const from = recheckAnchor({ from: atMerge.from, records, back: back.split('\n').filter(Boolean), changedBetween });
    state = recheckState({ from, records, runs: readCodexReviewRuns(cwd, { spawn }) });
  } catch {
    return null;
  }
  if (state.kind !== 'review') return null;
  return { merge: oldest.id, ...atMerge };
}

// What a part costs beyond its changed lines, counted in changed lines: the fixed input of a Codex session,
// about 49,000 tokens, over the about 482 a changed line adds (reader B's fit of this machine's run log,
// odd/tasks/merge-below-head.md). A constant, not this machine's estimate: the plan and the debt row decide
// the cut alike on every machine, and a run log that measured nothing still decides.
export const PART_AS_CHANGED_LINES = 100;

const costOf = ({ parts, changedLines }) => parts * PART_AS_CHANGED_LINES + changedLines;

/** Whether reviewing in `turns` costs less than the one review that is left today, `today` (S9): each is
 * `{ parts, changedLines }`, a count of parts and the changed lines they hold. From the default branch the
 * range starts at the commit of it the merge brought, so the review of today reads no line of it, and two
 * turns pay only where the branch's covered work since then is larger than the second session. */
export function turnsCheaper(today, turns) {
  return turns.reduce((sum, turn) => sum + costOf(turn), 0) < costOf(today);
}

/** The plans of the turns (`reviewPlan`, each of its own range) as the plan of one review: what the bound of
 * parts and the allowance are held to, since the run starts both or neither (S5). Its range is from the
 * first turn's base to the last turn's head, and it has an estimate only when every turn has one. */
export function plansAsOne(plans) {
  const parts = plans.flatMap((plan) => plan.parts).map((part, at, all) => ({ ...part, index: at + 1, of: all.length }));
  const sum = (key) => plans.reduce((total, plan) => total + plan[key], 0);
  const estimated = plans.every((plan) => plan.inputTokens !== null);
  const last = plans.at(-1);
  const leftOut = plans.map((plan) => plan.leftOut).filter((one) => one !== null);
  return {
    ...last,
    range: `${plans[0].range.split('..')[0]}..${last.range.split('..')[1]}`,
    parts,
    files: sum('files'),
    changedLines: sum('changedLines'),
    inputTokens: estimated ? sum('inputTokens') : null,
    inputTokensHigh: estimated ? sum('inputTokensHigh') : null,
    over: parts.length > last.maxParts,
    leftOut: leftOut.length === 0 ? null : leftOut.reduce((all, one) => Object.fromEntries(Object.keys(one).map((key) => [key, all[key] + one[key]]))),
  };
}

// The worktree a turn below HEAD is reviewed in: `<common git dir>/js-harness/review-turn-<pid>-<time>` (S7).
const TURN_WORKTREE = /^review-turn-(\d+)-\d+$/;

/** Whether the process `pid` is running here: a signal 0 tests it and sends nothing. */
export function processRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM';
  }
}

const gitIn = (cwd, spawn, args) => {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8' });
    return Boolean(result) && !result.error && result.status === 0;
  } catch {
    return false;
  }
};

/** Removes the worktree at `place`, and its folder where git did not have it as one: a turn leaves nothing. */
export function removeTurnWorktree(cwd, place, { spawn = spawnSync } = {}) {
  gitIn(cwd, spawn, ['worktree', 'remove', '--force', place]);
  fs.rmSync(place, { recursive: true, force: true });
}

/** Removes every turn worktree under `commonGitDir` whose run is gone, killed before it removed its own, and
 * then has git forget the worktrees whose folder is gone. One of a run still going is left to it. */
export function sweepTurnWorktrees(cwd, { commonGitDir, spawn = spawnSync, running = processRunning }) {
  const dir = path.join(commonGitDir, 'js-harness');
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    names = [];
  }
  for (const name of names) {
    const match = TURN_WORKTREE.exec(name);
    if (match !== null && !running(Number(match[1]))) removeTurnWorktree(cwd, path.join(dir, name), { spawn });
  }
  gitIn(cwd, spawn, ['worktree', 'prune']);
}

/** Adds a detached worktree at `commit` for a turn, and returns its folder; `null` when git did not make it,
 * with nothing of it left. */
export function addTurnWorktree(cwd, commit, { commonGitDir, spawn = spawnSync, pid = process.pid, now = Date.now }) {
  const place = path.join(commonGitDir, 'js-harness', `review-turn-${pid}-${now()}`);
  try {
    fs.mkdirSync(path.dirname(place), { recursive: true });
  } catch {
    return null;
  }
  if (gitIn(cwd, spawn, ['worktree', 'add', '--quiet', '--detach', place, commit])) return place;
  removeTurnWorktree(cwd, place, { spawn });
  return null;
}

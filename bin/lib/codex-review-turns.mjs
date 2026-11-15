// Where a review of a range is cut into turns: a merge of the default branch below HEAD, read by what was
// written in it, then the commits after it (odd/tasks/merge-below-head.md). His answer of 2026-10-16:
// a hand-resolved merge of main is reviewed only on the lines written in it, wherever it sits. With the worktrees a
// run reads in: that of a turn, and the snapshot of the head every run's Codex sessions read, so that an edit or a
// commit in the live folder while Codex reads refuses neither a part nor the record (odd/tasks/codex-spend.md,
// spec 1); and the removal and the sweep of both, which delete nothing out of their area and follow no link.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeAnswer } from './codex-review-answer.mjs';
import { mergeStart } from './codex-review-coverage.mjs';
import { counted, planLines, thousands } from './codex-review-plan.mjs';
import { RECHECK_LOOK_BACK, recheckAnchor, recheckState, runsLogged } from './codex-review-recheck.mjs';
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
    state = recheckState({ from, records, runs: readCodexReviewRuns(cwd, { spawn, where }) });
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
    leftOut: leftOut.length === 0 ? null : leftOut.reduce(addCounts),
  };
}

// Two counts of what a review leaves out (`reviewScope`'s shape) as one: its kinds are counts of their own.
function addCounts(all, one) {
  return Object.fromEntries(Object.keys(one).map((key) => [key, typeof one[key] === 'object' ? addCounts(all[key], one[key]) : all[key] + one[key]]));
}

/** Why the review of a merge is asked with this command's own prompt, whatever was asked for: Codex's own
 * `--base` reads a diff of two commits, and a merge is read against its automatic merge (verifier A3). */
export const MERGE_OWN_PROMPT = 'The review of a merge is asked with this command\'s own prompt: the sentence Codex writes for `--base` names a diff of two commits, not what was written in a merge.';

/** The line that says a review reads a merge by what was written in it (`mergeStart`). */
export function mergeReviewSaid({ head, side, branch, stacked = false }) {
  const of = stacked ? `a stacked base off ${branch}, each of whose own code commits has a record` : `a commit of ${branch}`;
  return `${head.slice(0, 7)} is a merge of ${side.slice(0, 7)}, ${of}: its review reads what was written in the merge (its diff with the automatic merge of its parents), not what the merge brought in.`;
}

/** The line a run says before turn `index` of a range cut at the merge `merge` below `head` (odd/tasks/merge-below-head.md). */
export function turnSaid(index, { merge, head }) {
  return index === 1
    ? `Turn 1 of 2, the merge ${merge.slice(0, 7)}: what was written in it.`
    : `Turn 2 of 2, ${merge.slice(0, 7)}..${head.slice(0, 7)}: the commits after the merge.`;
}

/** What a run says when the turn at the merge of a cut range owes a correction, and it stops there. */
export function turnStopped({ merge, head }) {
  const [at, tip] = [merge.slice(0, 7), head.slice(0, 7)];
  return `The review of the merge ${at} found what owes a correction, so the commits after it (${at}..${tip}) were not reviewed: once the correction is committed, the review from ${at} is a recheck of those findings.`;
}

/** What `--plan` prints of a range cut in two turns (`cutInTurns` in ../codex-review.mjs): each turn under its
 * line, then what they come to in all, with the one review the range would be without the cut, which they cost
 * less than. */
export function turnsLines(turns) {
  const [first, second] = turns.plans;
  const one = plansAsOne(turns.plans);
  const { today } = turns;
  const sends = one.inputTokens === null ? '' : `, about ${thousands(one.inputTokens)} input tokens`;
  return [
    turnSaid(1, turns),
    mergeReviewSaid({ head: turns.merge, side: turns.side, branch: turns.branch, stacked: turns.stacked === true }),
    ...planLines(first),
    turnSaid(2, turns),
    ...planLines(second),
    `In all, 2 turns: ${counted(one.parts.length, 'part')}, ${counted(one.changedLines, 'changed line')} in ${counted(one.files, 'file')}${sends}, ` +
      `where one review from ${today.range.split('..')[0]} would be ${counted(today.parts.length, 'part')}, ${counted(today.changedLines, 'changed line')} in ${counted(today.files, 'file')}.`,
  ];
}

/** The command line of the run of the turn at the merge of `turns` in the worktree `place`, from the run's
 * `args`: resolved values only, the base by its full id and a home that is absolute. */
export function turnArgv(turns, place, args) {
  return [
    '--base', turns.from, '--cwd', place, '--prompt', args.prompt, '--part-lines', String(args.partLines),
    ...(args.maxParts === undefined ? [] : ['--max-parts', String(args.maxParts)]),
    ...(args.home ? ['--home', path.resolve(args.home)] : []),
    ...(args.keepHome ? ['--keep-home'] : []),
    ...(args.fresh ? ['--fresh'] : []),
  ];
}

/** What the records say of the turn at the merge of `turns` once its run ended well: `{ refused }`, why the
 * commits after it are not reviewed; else `{ stopped }`, whether its record owes a correction, which stops the
 * run there (`turnStopped`). A record whose run line never reached the log reads as owing nothing, which says
 * nothing, so it is refused too. */
export function afterTurn(cwd, turns, { spawn = spawnSync, where } = {}) {
  let records;
  let runs;
  try {
    records = readCodexReviews(cwd, { spawn, where });
    runs = readCodexReviewRuns(cwd, { spawn, where });
  } catch (err) {
    return { refused: `Could not read the record of the turn at the merge (${err.message}), so the commits after it were not reviewed.` };
  }
  const at = turns.merge.slice(0, 7);
  const written = records.findLast((record) => record.base === turns.from && record.head === turns.merge);
  if (written === undefined) return { refused: `The turn at the merge ${at} wrote no record, so the commits after it were not reviewed.` };
  if (!runsLogged(written, runs)) return { refused: `The run line of the turn at the merge ${at} is not in the run log, so whether it owes a correction cannot be said and the commits after it were not reviewed: run the review again.` };
  return { stopped: recheckState({ from: turns.merge, records, runs }).kind !== 'review' };
}

// The worktree a turn below HEAD is reviewed in: `<common git dir>/js-harness/review-turn-<pid>-<time>` (S7);
// and the snapshot of the head a run's Codex sessions read, `review-head-<pid>-<time>`, which a run makes beside
// the worktree of its turn, at the same time, so the two differ by their kind (odd/tasks/codex-spend.md, spec 1).
const TURN_WORKTREE = /^review-(?:turn|head)-(\d+)-(\d+)$/;
const KINDS = ['turn', 'head'];

// The folder of `commonGitDir` every turn worktree and snapshot is made in, and the one place they are deleted.
const AREA = 'js-harness';

// How long a turn worktree may stand: a turn is one review, which no run keeps going for a day. One older is
// removed though a process of its pid runs, since that pid was reused by another (a review R4, PR 338).
export const TURN_WORKTREE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Whether the process `pid` is running here: a signal 0 tests it and sends nothing. */
function processRunning(pid) {
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

/** What git prints in `cwd`, trimmed, or `null` when it fails. */
const gitOut = (cwd, spawn, args) => {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8' });
    return result && !result.error && result.status === 0 ? String(result.stdout).trim() : null;
  } catch {
    return null;
  }
};

const samePath = (one, other) => (process.platform === 'win32' ? one.toLowerCase() === other.toLowerCase() : one === other);

/** Why `place` may not be deleted, or `null` when it may: it is named as a turn worktree or a snapshot is,
 * it is a folder and no link (a symlink or a junction), and its resolved form is that name in the area of
 * `commonGitDir` resolved, so that neither it nor the area leads anywhere else (spec 1). */
function notDeletable(place, commonGitDir) {
  if (typeof commonGitDir !== 'string' || commonGitDir === '') return 'the git directory it may be deleted in was not given';
  // git resolves a path against the folder it runs in and fs against this process's: only an absolute one is the same.
  if (!path.isAbsolute(place) || !path.isAbsolute(commonGitDir)) return `${place} and ${commonGitDir} are not both absolute paths`;
  const name = path.basename(place);
  if (!TURN_WORKTREE.test(name)) return `${name} is not named as a turn worktree or a snapshot`;
  try {
    if (fs.lstatSync(place).isSymbolicLink()) return `${place} is a link, which is never followed`;
    const real = fs.realpathSync.native(place);
    const expected = path.join(fs.realpathSync.native(commonGitDir), AREA, name);
    return samePath(real, expected) ? null : `${place} resolves outside ${path.join(commonGitDir, AREA)}, to ${real}`;
  } catch (err) {
    return `${place} could not be read (${err.code ?? err.message})`;
  }
}

/** Whether `place` is a link, a symlink or a junction, also one whose target is gone. */
const isLink = (place) => {
  try {
    return fs.lstatSync(place).isSymbolicLink();
  } catch {
    return false;
  }
};

/** Removes every link under the folder `dir` (a symlink or a junction, by `lstat`), never what it points at,
 * and goes into the folders that are none: once none is left, what deletes the rest cannot follow one. */
function unlinkLinksUnder(dir) {
  for (const name of fs.readdirSync(dir)) {
    const entry = path.join(dir, name);
    const stat = fs.lstatSync(entry);
    if (stat.isSymbolicLink()) {
      try {
        fs.unlinkSync(entry);
      } catch {
        // A link to a folder that `unlink` does not take on this OS is removed as the empty folder it is.
        fs.rmdirSync(entry);
      }
    } else if (stat.isDirectory()) {
      unlinkLinksUnder(entry);
    }
  }
}

/** Removes the worktree at `place`, and its folder where git did not have it as one: a turn leaves nothing.
 * It deletes only a folder of the area of `commonGitDir` that is no link and resolves there (`notDeletable`),
 * and removes the links under it before anything deletes the rest, so it follows none (spec 1). It never
 * throws: it runs in a `finally`, where a throw would hide how the turn ended. It returns `null` when the
 * folder is gone, else why it is left, for the caller to warn of; a folder it could not remove is left to the
 * next run's sweep. */
export function removeTurnWorktree(cwd, place, { commonGitDir, spawn = spawnSync, rm = fs.rmSync } = {}) {
  if (typeof place !== 'string' || !path.isAbsolute(place)) return `${place} is not an absolute path, and git and this process would resolve it against two folders`;
  if (!fs.existsSync(place) && !isLink(place)) return null;
  const refused = notDeletable(place, commonGitDir);
  if (refused !== null) return refused;
  let failure = null;
  try {
    unlinkLinksUnder(place);
  } catch (err) {
    return `a link under ${place} could not be removed (${err.code ?? err.message}), so nothing else was deleted`;
  }
  gitIn(cwd, spawn, ['worktree', 'remove', '--force', place]);
  try {
    if (fs.existsSync(place)) {
      // Again just before the delete: a link made since the first pass, by a process the kill missed, is not followed.
      unlinkLinksUnder(place);
      rm(place, { recursive: true, force: true });
    }
  } catch (err) {
    // Left for `sweepTurnWorktrees`, which removes it once this run is gone.
    failure = err;
  }
  if (!fs.existsSync(place)) return null;
  return `${place} is left (${failure?.message ?? 'it could not be removed'})`;
}

/** Whether the folder `root` is a turn worktree or a snapshot of the area of `commonGitDir`: a run there is
 * one a run made, which makes no snapshot of its own (spec 1). */
export function inTurnWorktree(root, commonGitDir) {
  if (typeof root !== 'string' || typeof commonGitDir !== 'string' || commonGitDir === '') return false;
  try {
    const real = fs.realpathSync.native(root);
    return TURN_WORKTREE.test(path.basename(real)) && samePath(path.dirname(real), path.join(fs.realpathSync.native(commonGitDir), AREA));
  } catch {
    return false;
  }
}

/** Removes every turn worktree under `commonGitDir` whose run is gone, killed before it removed its own, or
 * that is older than a turn can last (`TURN_WORKTREE_MAX_AGE_MS`, by the time in its name against `now`), and
 * then has git forget the worktrees whose folder is gone. One of a run still going is left to it. A snapshot is
 * one, by its name. Each goes through `removeTurnWorktree`, which deletes nothing out of the area. It returns why
 * each folder it meant to remove is left, for the caller to warn of; an empty list when none is. */
export function sweepTurnWorktrees(cwd, { commonGitDir, spawn = spawnSync, running = processRunning, now = Date.now }) {
  const dir = path.join(commonGitDir, AREA);
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    names = [];
  }
  const left = [];
  for (const name of names) {
    const match = TURN_WORKTREE.exec(name);
    if (match === null) continue;
    const old = now() - Number(match[2]) > TURN_WORKTREE_MAX_AGE_MS;
    const why = old || !running(Number(match[1])) ? removeTurnWorktree(cwd, path.join(dir, name), { commonGitDir, spawn }) : null;
    if (why !== null) left.push(why);
  }
  gitIn(cwd, spawn, ['worktree', 'prune']);
  return left;
}

/** Adds a detached worktree at `commit` for a turn, or with `kind: 'head'` for the snapshot of the head a run
 * reads, and returns its folder; `null` when git did not make it, with nothing of it left. */
export function addTurnWorktree(cwd, commit, { commonGitDir, spawn = spawnSync, pid = process.pid, now = Date.now, kind = 'turn' }) {
  if (!KINDS.includes(kind)) throw new Error(`a turn worktree is of kind ${KINDS.join(' or ')}, not ${kind}`);
  const place = path.join(commonGitDir, AREA, `review-${kind}-${pid}-${now()}`);
  try {
    fs.mkdirSync(path.dirname(place), { recursive: true });
  } catch {
    return null;
  }
  if (gitIn(cwd, spawn, ['worktree', 'add', '--quiet', '--detach', place, commit])) return place;
  removeTurnWorktree(cwd, place, { commonGitDir, spawn });
  return null;
}

/** Whether the project at `root` has its dependencies installed there: its `package.json` declares one in
 * `dependencies` or `devDependencies`, and its `node_modules` holds anything. A file that cannot be read or
 * parsed declares none. */
function dependenciesInstalled(root) {
  try {
    const declared = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const any = (named) => named !== null && typeof named === 'object' && Object.keys(named).length > 0;
    if (!any(declared?.dependencies) && !any(declared?.devDependencies)) return false;
    return fs.readdirSync(path.join(root, 'node_modules')).length > 0;
  } catch {
    return false;
  }
}

/** The folder a run at `root` has its Codex sessions read, and the checks after a part, a turn and the review
 * compare with `head` (spec 1): `{ place, snapshot, said }`. The snapshot of the head, a detached worktree made
 * from `head` by its full id in the area of `commonGitDir` (`addTurnWorktree`, kind `head`), which the caller
 * removes however the run ends. `root` itself, with `snapshot` false, in three cases: a run in a turn worktree
 * already, `inTurn` or by where it is, which makes no snapshot in it; a run that measures (`measuring`, the
 * comparison of configurations), which reviews in a clone of its own at the head already; and, in a turn of the
 * gate lock (`gateHeld`), where Codex runs the tests, a project whose declared dependencies are installed in its
 * `node_modules`, which a snapshot would not hold: `said` is then the line that says so. The area is swept
 * first, but by a run of the first two, whose parent run or clone is its own (`sweepTurnWorktrees`); what the
 * sweep leaves is a warning, `warn`. `null` when the snapshot could not be made; `{ refused }` when it was made
 * and is not the head clean, its tracked files changed as checked out (a filter, an end-of-line rule), which
 * would refuse the record after Codex had read it all: it is removed and nothing starts. */
export function snapshotOfHead(root, head, { commonGitDir, spawn = spawnSync, now = Date.now, inTurn = false, measuring = false, gateHeld = false, warn = () => {} }) {
  if (inTurn || measuring || inTurnWorktree(root, commonGitDir)) return { place: root, snapshot: false, said: null };
  // What killed runs left in the area is swept first, on the real clock, also by a run that reads the live folder.
  if (commonGitDir) {
    for (const why of sweepTurnWorktrees(root, { commonGitDir, spawn })) warn(`Warning: the sweep of the review worktrees left one: ${why}.`);
  }
  if (gateHeld && dependenciesInstalled(root)) {
    return { place: root, snapshot: false, said: `In this turn of the gate lock Codex reads the live folder, not a snapshot of ${head.slice(0, 7)}: the project's package.json declares dependencies installed in its node_modules, which a snapshot would not hold, and a turn runs the tests.` };
  }
  if (!commonGitDir) return null;
  const place = addTurnWorktree(root, head, { commonGitDir, spawn, now, kind: 'head' });
  if (place === null) return null;
  // Its HEAD is `head`, which git just checked it out at; its tracked files are asked, the one question it adds.
  const tree = gitOut(place, spawn, ['status', '--porcelain', '--untracked-files=no']);
  if (tree === '') return { place, snapshot: true, said: null };
  const why = tree === null ? 'its tracked files could not be read' : 'its tracked files differ from its HEAD';
  const left = removeTurnWorktree(root, place, { commonGitDir, spawn });
  if (left !== null) warn(`Warning: the snapshot of the head was not removed, and the next run's sweep removes it: ${left}.`);
  return { refused: `The snapshot of ${head.slice(0, 7)} that Codex would read is not the head clean as soon as it is made (${why}), so its record would be refused after Codex had read it all: nothing was started or recorded. A checkout filter or an end-of-line rule that changes tracked files is the usual cause` };
}

/** Why the snapshot of `head` a part was read in is not as it was made, from `headNow` and `tree`, its HEAD and
 * its tracked changes (`null` each when git could not say): what could not be read first, then a HEAD that
 * moved, then tracked files that differ; `null` when it is as it was made. */
export function snapshotChanged({ headNow, tree }, head) {
  if (headNow === null || tree === null) return 'the HEAD and the state of the review\'s own snapshot could not be read';
  if (headNow !== head) return `the review's own snapshot changed: its HEAD moved from ${head.slice(0, 7)} to ${headNow.slice(0, 7)}`;
  return tree === '' ? null : 'the review\'s own snapshot changed: its tracked files differ from its HEAD';
}

/** The refusal of the record of `base..head` when the snapshot Codex read is not as it was made once the review
 * has ended, from its `headNow` and `tree` as `snapshotChanged` takes them, or `null` when it is: a HEAD that moved
 * is said first, since git may answer for it and not for the tree. */
export function snapshotChangedAfterReview({ headNow, tree }, { base, head }) {
  const range = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  const own = `The review's own snapshot of ${head.slice(0, 7)} changed while Codex was reviewing`;
  if (headNow !== null && headNow !== head) return `${own}: its HEAD moved to ${headNow.slice(0, 7)}, so what it read is not the range ${range} alone and no record was written. Nothing is committed in the snapshot a review reads; run the review again.`;
  if (tree !== null && tree !== '') return `${own}: its tracked files differ from its HEAD, so what it read is not the committed range ${range} alone and no record was written. Nothing is edited in the snapshot a review reads; run the review again.`;
  if (headNow === null || tree === null) return `Could not read HEAD and the state of the review's own snapshot again after the review, so it is not known that Codex read the range ${range} alone and no record was written.`;
  return null;
}

/** A valid answer as `normalizeAnswer` keeps it, with the file of each finding from the top of the folder Codex
 * read, `place`, when it is under it, else from the top of the repository, `root`. */
export function answerFrom(answer, { root, place = root, platform = process.platform }) {
  const here = normalizeAnswer(answer, { root, platform });
  if (place === root) return here;
  const there = normalizeAnswer(answer, { root: place, platform });
  const flavour = platform === 'win32' ? path.win32 : path.posix;
  return { ...there, findings: there.findings.map((finding, at) => (flavour.isAbsolute(finding.file) ? here.findings[at] : finding)) };
}

// Whether a pull request may be merged on its GitHub run, decided from facts read beforehand.
//
// A pull_request run tests refs/pull/N/merge, the head merged into the main of the moment the run
// started. A green run vouches for the merge only while main has not moved by code since: its checkout
// log says which base it tested ("HEAD is now at <m> Merge <head> into <base>"), and that base must be
// today's main, or behind it only by documents (docs/ and odd/tasks/, never an AGENTS.md, which every
// session reads) with the merge into main clean. Nothing here reads git or GitHub; bin/merge-ready.mjs
// gathers the facts and this module says what they add up to.
//
// Exit codes: 0 ready, 3 stale (the run tested a base main has left by code: reopen for a fresh run),
// 4 no run for the head, or a run not finished or not green, 1 any other check failed.

export const READY = 0;
export const FAILED = 1;
export const STALE = 3;
export const RUN_NOT_GREEN = 4;

const DOCUMENTS = /^(docs|odd\/tasks)\//;
const AGENTS = /(^|\/)AGENTS\.md$/;
const TESTED = /HEAD is now at [0-9a-f]+ Merge ([0-9a-f]{40}) into ([0-9a-f]{40})/;

const short = (id) => String(id ?? '').slice(0, 7);

/** The merge a run tested, read from its log, or null when the log has no checkout line. */
export function testedMerge(log) {
  const found = TESTED.exec(String(log ?? ''));
  return found ? { head: found[1], base: found[2] } : null;
}

/** The paths, among those main changed since a tested base, that a run of that base did not test. */
export function untestedPaths(changed) {
  return changed.filter((path) => !DOCUMENTS.test(path) || AGENTS.test(path));
}

/**
 * facts: { pr: {number, state, isDraft, mergeable, baseRefName, body, headRefOid}, main,
 *   run: {id, status, conclusion} | null, tested: {head, base} | null, baseIsAncestor,
 *   changedSinceBase: [path], mergeTreeClean, pullMergeParent: id | null }
 * Returns { code, said: [line] }.
 */
export function mergeReadiness(facts) {
  const { pr, main, run, tested } = facts;
  const name = `PR ${pr.number}`;
  const said = [];
  if (pr.state !== 'OPEN') said.push(`${name} is ${pr.state}, not open.`);
  if (pr.isDraft) said.push(`${name} is a draft.`);
  if (pr.mergeable !== 'MERGEABLE') said.push(`${name} is not mergeable (${pr.mergeable}).`);
  if (pr.baseRefName !== 'main') said.push(`${name} targets ${pr.baseRefName}, not main.`);
  if (!/gentle-ai/i.test(pr.body ?? '')) said.push(`${name}: its body has no gentle-ai line.`);
  if (said.length) return { code: FAILED, said };

  const head = pr.headRefOid;
  if (!run) return { code: RUN_NOT_GREEN, said: [`${name}: no run for head ${short(head)}.`] };
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    return { code: RUN_NOT_GREEN, said: [`${name}: run ${run.id} is ${run.status}${run.conclusion ? ` ${run.conclusion}` : ''}, not completed success.`] };
  }
  if (!tested) return { code: FAILED, said: [`${name}: the log of run ${run.id} has no tested merge ("HEAD is now at ... Merge <head> into <base>").`] };
  if (tested.head !== head) {
    return { code: RUN_NOT_GREEN, said: [`${name}: run ${run.id} tested head ${short(tested.head)}, not ${short(head)}.`] };
  }

  if (tested.base !== main) {
    const stale = (why) => ({ code: STALE, said: [`${name}: run ${run.id} tested base ${short(tested.base)}; ${why}: stale.`, reopenAdvice(name, pr.number, main, facts.pullMergeParent)] });
    if (!facts.baseIsAncestor) return stale(`it is not an ancestor of main ${short(main)}`);
    const untested = untestedPaths(facts.changedSinceBase);
    if (untested.length) return stale(`main ${short(main)} has moved since by ${untested.length} path${untested.length === 1 ? '' : 's'} that are not documents (${untested.slice(0, 3).join(', ')}${untested.length > 3 ? ', ...' : ''})`);
    if (!facts.mergeTreeClean) return { code: FAILED, said: [`${name}: its head does not merge cleanly into main ${short(main)}.`] };
    said.push(`${name}: tested base ${short(tested.base)} is behind main only by documents (${facts.changedSinceBase.length} path${facts.changedSinceBase.length === 1 ? '' : 's'}), and the merge into main is clean.`);
  }
  said.push(`${name} is ready: run ${run.id} is green on head ${short(head)} against main ${short(main)}.`);
  return { code: READY, said };
}

// A reopened pull request runs on refs/pull/N/merge as GitHub last computed it; until its first parent
// is today's main, a reopen buys a run of the same stale base.
function reopenAdvice(name, number, main, parent) {
  const ref = `refs/pull/${number}/merge`;
  if (!parent) return `${name}: could not read ${ref}: wait before reopening.`;
  if (parent !== main) return `${name}: ${ref} still has ${short(parent)} as its first parent, not main ${short(main)}: wait before reopening.`;
  return `${name}: ${ref} is computed against main ${short(main)}: close and reopen PR ${number} for a fresh run.`;
}

// What keeps a pull request itself out of the merge queue's candidate, decided from facts read beforehand.
// The queue (bin/merge-queue.mjs) adds the rest of ready: a Codex review record for every code commit and no
// conflict with the candidate so far. Nothing here reads git or GitHub.

/** What keeps the pull request `pr` itself from being merged, one sentence each, in this order: not open, a
 * draft, not mergeable, not based on `base` (the default branch the queue read for this run). Its body asks for
 * nothing: the reviews are read from their records (F8 S11, L11). Empty when nothing does. The queue passes the default branch it read. `notify` still calls it with
 * no `base`, and keeps main, as it did before the queue read the default branch. */
export function pullRequestProblems(pr, base = 'main') {
  const name = `PR ${pr.number}`;
  const said = [];
  if (pr.state !== 'OPEN') said.push(`${name} is ${pr.state}, not open.`);
  if (pr.isDraft) said.push(`${name} is a draft.`);
  // GitHub computes CONFLICTING against the branch the pull request targets: merging that branch in is the fix only
  // where it is `base`; another one is a wrong target, which the base line below names, and merging it would bring
  // its commits into the pull request (Codex, c3385fc0).
  const against = pr.baseRefName ?? base;
  if (pr.mergeable === 'CONFLICTING') said.push(against === base ? `${name} is not mergeable (CONFLICTING): ${conflictSaid({ base, branch: pr.headRefName })}` : `${name} is not mergeable (CONFLICTING) with ${against}, the branch it targets.`);
  else if (pr.mergeable !== 'MERGEABLE') said.push(`${name} is not mergeable (${pr.mergeable}).`);
  if (pr.baseRefName !== base) said.push(`${name} targets ${pr.baseRefName}, not ${base}.`);
  return said;
}

/** What a conflict leaves a pull request out with, one home for its words (odd/tasks/codex-spend.md, spec 3). With
 * the branch it targets itself (`base`), the line names the fix, which is the branch's: merge `base` into it
 * (`branch`, its name where known). With pull requests of this batch merged before it (`earlier`, their numbers), it
 * waits for the land of the one it conflicts with: a merge of `base` cannot fix it until that one is on it. `files`
 * are where git found it, none where git named none. The step comes first and the lists after it, since a notice
 * to the session is cut at its length (`leftOutText`, ../merge-queue.mjs; Codex, c3385fc0). */
export function conflictSaid({ base = 'main', branch = null, files = [], earlier = [] } = {}) {
  const where = files.length ? ` in ${files.join(', ')}` : '';
  const names = earlier.map((number) => `PR ${number}`).join(', ');
  if (earlier.length === 1) return `it waits for the land of ${names}, which it conflicts with${where}.`;
  if (earlier.length) return `it waits for the land of the one of ${names} it conflicts with${where}.`;
  return `merge ${base} into its branch${branch ? ` ${branch}` : ''} and push it, since it conflicts with ${base} itself${where}.`;
}

/** The trailer of every merge commit the queue makes, and of no other: GitHub's merge button writes the same subject,
 * so the subject alone does not say a merge is the queue's. */
export const QUEUE_TRAILER = { key: 'Merged-by', value: 'js-harness merge-queue' };

/** The message of the merge commit the queue merges `pr` into its candidate with: GitHub's subject for a merged pull
 * request, which the reports read, then `QUEUE_TRAILER`. One home: the queue writes it (`mergeThroughDoor`,
 * ../merge-queue.mjs) and the control of `rule:depth-pass` knows a candidate by its trailer (`sidesOf`,
 * ../contract.mjs). */
export const mergeMessage = (pr) => `Merge pull request #${pr.number} from ${pr.headRefName}\n\n${QUEUE_TRAILER.key}: ${QUEUE_TRAILER.value}`;

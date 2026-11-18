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
  // GitHub computes CONFLICTING against the branch the pull request targets, so that is the branch its fix merges in.
  if (pr.mergeable === 'CONFLICTING') said.push(`${name} is not mergeable (CONFLICTING): ${conflictSaid({ base: pr.baseRefName ?? base, branch: pr.headRefName })}`);
  else if (pr.mergeable !== 'MERGEABLE') said.push(`${name} is not mergeable (${pr.mergeable}).`);
  if (pr.baseRefName !== base) said.push(`${name} targets ${pr.baseRefName}, not ${base}.`);
  return said;
}

/** What a conflict leaves a pull request out with, one home for its words (odd/tasks/codex-spend.md, spec 3). With
 * the branch it targets itself (`base`), the line names the fix, which is the branch's: merge `base` into it
 * (`branch`, its name where known). With pull requests of this batch merged before it (`earlier`, their numbers), it
 * waits for their land: a merge of `base` cannot fix it until they are on it. `files` are where git found it. */
export function conflictSaid({ base = 'main', branch = null, files = [], earlier = [] } = {}) {
  const where = files.length ? ` in ${files.join(', ')}` : '';
  if (earlier.length) return `it conflicts with the candidate so far (${earlier.map((number) => `PR ${number}`).join(', ')})${where}: it waits for ${earlier.length === 1 ? 'that' : 'their'} land.`;
  return `it conflicts with ${base} itself${where}, so merge ${base} into its branch${branch ? ` ${branch}` : ''} and push it.`;
}

/** The trailer of every merge commit the queue makes, and of no other: GitHub's merge button writes the same subject,
 * so the subject alone does not say a merge is the queue's. */
export const QUEUE_TRAILER = { key: 'Merged-by', value: 'js-harness merge-queue' };

/** The message of the merge commit the queue merges `pr` into its candidate with: GitHub's subject for a merged pull
 * request, which the reports read, then `QUEUE_TRAILER`. One home: the queue writes it (`mergeThroughDoor`,
 * ../merge-queue.mjs) and the control of `rule:depth-pass` knows a candidate by its trailer (`sidesOf`,
 * ../contract.mjs). */
export const mergeMessage = (pr) => `Merge pull request #${pr.number} from ${pr.headRefName}\n\n${QUEUE_TRAILER.key}: ${QUEUE_TRAILER.value}`;

// What keeps a pull request itself out of the merge queue's candidate, decided from facts read beforehand.
// The queue (bin/merge-queue.mjs) adds the rest of ready: a Codex review record for every code commit and no
// conflict with the candidate so far. Nothing here reads git or GitHub.

/** What keeps the pull request `pr` itself from being merged, one sentence each, in this order: not open, a
 * draft, not mergeable, not on main, no gentle-ai line in its body. Empty when nothing does. */
export function pullRequestProblems(pr) {
  const name = `PR ${pr.number}`;
  const said = [];
  if (pr.state !== 'OPEN') said.push(`${name} is ${pr.state}, not open.`);
  if (pr.isDraft) said.push(`${name} is a draft.`);
  if (pr.mergeable !== 'MERGEABLE') said.push(`${name} is not mergeable (${pr.mergeable}).`);
  if (pr.baseRefName !== 'main') said.push(`${name} targets ${pr.baseRefName}, not main.`);
  if (!/gentle-ai/i.test(pr.body ?? '')) said.push(`${name}: its body has no gentle-ai line.`);
  return said;
}

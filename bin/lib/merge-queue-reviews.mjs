// The merge door's reading of a pull request's reviews (odd/tasks/rule-hierarchy.md, "The merge door (T16e)", items 5
// and 6): whether its code commits have both reviews, and the Codex record that covers each, read as the push of main
// reads them, of the head merged onto main (`asMerged`). `merge-queue` asks it of each pull request before it builds a
// candidate, and `notify --kind ready` before it records a ready notice. Moved out of bin/merge-queue.mjs, which is over
// its ceiling of lines (bin/conventions-structure.test.mjs). Zero dependencies.
import { spawnSync } from 'node:child_process';
import { COMMIT_FORMAT, gitOut, loggedCommits, reviewCoverage } from './codex-review-coverage.mjs';
import { checkCodexReviews, codexReviewOffAt } from './codex-review-rows.mjs';
import { lensDoor } from './lens-review-rows.mjs';

/** The commits of `main..head` read in `cwd` that change a file that is not Markdown, newest first
 * (`{ id, shortId, parentCount, subject }`): the code commits of a project whose Codex review is off. A merge changes
 * the files it leaves as none of its parents has them (`--diff-merges=combined`), which is where an edit made in it
 * is. `null` when git does not answer. */
function markdownlessCommits(cwd, main, head) {
  // The log `reviewCoverage` reads, by the same reader: names as git has them (`-z`), no signature before a commit.
  const log = gitOut(spawnSync, cwd, ['log', '-z', '--diff-merges=combined', '--root', '--no-show-signature', '--no-relative', '--no-renames', '--name-only', `--format=${COMMIT_FORMAT}`, `${main}..${head}`]);
  const commits = log === null ? null : loggedCommits(log);
  return commits === null ? null : commits.filter((commit) => commit.files.some((file) => !/\.md$/i.test(file)));
}

/** The commit the push of main checks for the pull request at `head`: `head` merged into `main`, main first, as the
 * candidate merges it, made as an object alone, with no worktree, no ref and no hook (`git merge-tree`, then `git
 * commit-tree`, under an identity of its own so that none of the repository's is asked for): `{ tip }`, or `{ error }`
 * when git does not make it, or when the two conflict.
 *
 * Why. Which records cover a commit depends on the tip the range ends at: a record whose head lies past the tip covers
 * the commits under it (`reviewCoverage`). At the pull request's own head, a review of main..D covers C, its parent; in
 * the candidate nothing lies past the tip, and the push refuses C. PR 658 was the door's "covered" twice, then a push
 * refused at the end of a whole land (2026-10-29, docs/FAILURES.md). Asked of this commit, the door's question is the
 * push's, by the same rows, so for one pull request on main the two cannot disagree on what a tip decides. A candidate of
 * several is not read whole: a sibling that turns the Codex review on, or takes a mark off, still decides only at the push
 * (JH 83's verifier, 2026-10-29). Unreferenced, the object is git's to prune. */
function asMerged(cwd, main, head) {
  const merged = spawnSync('git', ['merge-tree', '--write-tree', '--no-messages', '--name-only', main, head], { cwd, encoding: 'utf8', windowsHide: true });
  const [tree = '', ...conflicted] = String(merged.stdout ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  // Exit 1 is a conflict, after the tree the files it is in; that tree is no commit the push would check.
  if (merged.status === 1 && !merged.error) return { error: `it does not merge onto main without a conflict${conflicted.length ? ` (in ${conflicted.join(', ')})` : ''}, so its reviews cannot be read as the push of main reads them` };
  const identity = ['-c', 'user.name=js-harness merge-queue', '-c', 'user.email=merge-queue@js-harness.invalid'];
  const tip = !merged.error && merged.status === 0 && /^[0-9a-f]{40,64}$/.test(tree) ? gitOut(spawnSync, cwd, [...identity, 'commit-tree', '--no-gpg-sign', '-p', main, '-p', head, '-m', 'merge-queue: the merge the push of main checks', tree]) : null;
  return tip ? { tip } : { error: 'git could not merge it onto main to read its reviews as the push of main reads them' };
}

/** Whether the pull request at `head` is ready by its reviews, read in `cwd` against `main` (odd/tasks/rule-hierarchy.md,
 * "The merge door (T16e)", items 5 and 6): `{ pass, detail }` as `checkCodexReviews` gives it, refused as `lensDoor` refuses
 * (no complete lens record, or a lens skip; asked where the Codex review is off even with the lens review off), and, when it passes, `lines`: one for each code commit, with the Codex record
 * that covers it, so the lead reads the coverage commit by commit and needs no look of their own. No line of the feature
 * document is asked for since F8 S11 (odd/tasks/f8-s11-complements.md, L11). Each is asked of `head` merged onto `main`
 * (`asMerged`), the tip the push of main checks, never of `head` itself. */
export function reviewEvidence(cwd, main, head) {
  const merged = asMerged(cwd, main, head);
  if (merged.error) return { pass: false, detail: merged.error };
  const { tip } = merged;
  const codex = checkCodexReviews(cwd, tip);
  const refused = codex.pass ? lensDoor(cwd, tip) : codex;
  if (refused) return refused;
  const off = codexReviewOffAt(cwd, tip);
  const coverage = off ? null : reviewCoverage(cwd, { from: main, tip });
  // The commits the lines name are the pull request's: the merge made here holds nothing anybody wrote, and is never pushed.
  const codeCommits = off ? markdownlessCommits(cwd, main, head) : coverage.unknown ? null : coverage.codeCommits;
  if (codeCommits === null) return { pass: false, detail: 'its code commits could not be read' };
  const lines = codeCommits.map((commit) => {
    const record = coverage?.covers.find(({ covered }) => covered.has(commit.id))?.rec;
    const codexSaid = off ? 'the Codex review is off'
      : record ? `Codex ${record.base.slice(0, 7)}..${record.head.slice(0, 7)} ${record.outcome} ${record.reviewedAt.slice(0, 10)}`
        : 'no Codex record read for it';
    return `${commit.shortId} ${commit.subject}: ${codexSaid}`;
  });
  return { pass: true, detail: codex.detail, lines };
}

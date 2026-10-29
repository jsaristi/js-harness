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

/** The commit the push of main checks for the pull request at `head`: `head` merged into `onto`, `onto` first, as the
 * candidate merges it, made as an object alone, with no worktree, no ref and no hook (`git merge-tree`, then `git
 * commit-tree`, under an identity of its own so that none of the repository's is asked for): `{ tip }`, or `{ error }`
 * when git does not make it, or when the two conflict, with the files of the conflict (`conflicted`). `where` names
 * `onto` in what is said.
 *
 * Why. Which records cover a commit depends on the tip the range ends at: a record whose head lies past the tip covers
 * the commits under it (`reviewCoverage`). At the pull request's own head, a review of main..D covers C, its parent; in
 * the candidate nothing lies past the tip, and the push refuses C. PR 658 was the door's "covered" twice, then a push
 * refused at the end of a whole land (2026-10-29, docs/FAILURES.md). Asked of this commit, the door's question is the
 * push's, by the same rows. The push reads the whole candidate, so `onto` is the candidate so far: main with the pull
 * requests before this one merged the same way. A sibling that turns the Codex review on, or takes a `-codex-review` mark
 * off, decides there for the code of another, and so here too (JH 83's verifier, finding 2, 2026-10-29). Unreferenced,
 * the objects are git's to prune. */
function asMerged(cwd, onto, head, where) {
  const merged = spawnSync('git', ['merge-tree', '--write-tree', '--no-messages', '--name-only', onto, head], { cwd, encoding: 'utf8', windowsHide: true });
  const [tree = '', ...conflicted] = String(merged.stdout ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  // Exit 1 is a conflict, after the tree the files it is in; that tree is no commit the push would check.
  if (merged.status === 1 && !merged.error) return { conflicted, error: `it does not merge onto ${where} without a conflict${conflicted.length ? ` (in ${conflicted.join(', ')})` : ''}, so its reviews cannot be read as the push of main reads them` };
  const identity = ['-c', 'user.name=js-harness merge-queue', '-c', 'user.email=merge-queue@js-harness.invalid'];
  const tip = !merged.error && merged.status === 0 && /^[0-9a-f]{40,64}$/.test(tree) ? gitOut(spawnSync, cwd, [...identity, 'commit-tree', '--no-gpg-sign', '-p', onto, '-p', head, '-m', 'merge-queue: the merge the push of main checks', tree]) : null;
  return tip ? { tip } : { error: `git could not merge it onto ${where} to read its reviews as the push of main reads them` };
}

/** Whether the pull request at `head` is ready by its reviews, read in `cwd` against `main` (odd/tasks/rule-hierarchy.md,
 * "The merge door (T16e)", items 5 and 6): `{ pass, detail }` as `checkCodexReviews` gives it, refused as `lensDoor` refuses
 * (no complete lens record, or a lens skip; asked where the Codex review is off even with the lens review off), and, when it passes, `lines`: one for each code commit, with the Codex record
 * that covers it, so the lead reads the coverage commit by commit and needs no look of their own. No line of the feature
 * document is asked for since F8 S11 (odd/tasks/f8-s11-complements.md, L11). Each is asked of `head` merged onto `onto`
 * (`asMerged`), main or the candidate so far, the tip the push of main checks, never of `head` itself. That `tip` is handed
 * back, for the next pull request to be read onto; the lines name the commits of `onto..head`, the ones this pull request
 * adds; a conflict gives its files, `conflicted`. */
export function reviewEvidence(cwd, main, head, onto = main) {
  // The door or a bisection may still leave a sibling out of the candidate: one that turned the Codex review off, or
  // put a mark on, must not carry this pull request in, so it is asked onto main alone too (JH 84's verifier).
  const alone = onto === main ? null : reviewEvidence(cwd, main, head);
  if (alone && !alone.pass) return alone;
  const merged = asMerged(cwd, onto, head, onto === main ? 'main' : 'the candidate so far');
  if (merged.error) return { pass: false, detail: merged.error, ...(merged.conflicted && { conflicted: merged.conflicted }) };
  const { tip } = merged;
  const codex = checkCodexReviews(cwd, tip);
  const refused = codex.pass ? lensDoor(cwd, tip) : codex;
  if (refused) return refused;
  const off = codexReviewOffAt(cwd, tip);
  const coverage = off ? null : reviewCoverage(cwd, { from: main, tip });
  // The commits the lines name are the pull request's: the merges made here hold nothing anybody wrote, and are never pushed.
  const own = off || coverage.unknown ? null : gitOut(spawnSync, cwd, ['rev-list', `${onto}..${head}`])?.split('\n');
  const codeCommits = off ? markdownlessCommits(cwd, onto, head) : own ? coverage.codeCommits.filter((commit) => own.includes(commit.id)) : null;
  if (codeCommits === null) return { pass: false, detail: 'its code commits could not be read' };
  const lines = codeCommits.map((commit) => {
    const record = coverage?.covers.find(({ covered }) => covered.has(commit.id))?.rec;
    const codexSaid = off ? 'the Codex review is off'
      : record ? `Codex ${record.base.slice(0, 7)}..${record.head.slice(0, 7)} ${record.outcome} ${record.reviewedAt.slice(0, 10)}`
        : 'no Codex record read for it';
    return `${commit.shortId} ${commit.subject}: ${codexSaid}`;
  });
  return { pass: true, detail: codex.detail, lines, tip };
}

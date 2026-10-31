// The refresh's look at his open questions (odd/tasks/refresh-open-apply.md, T2). `merge-queue --refresh-copy`, alone
// or after a land, installs main and runs `js-harness install` on his machine; on 2026-10-31 it installed PR 729 and
// changed his ~/.codex while question 140, which asked his yes for exactly that, was open (docs/FAILURES.md,
// refresh-applied-unanswered). A question that asks to apply a pull request says so in its notice (`applies: { pr }`,
// bin/lib/channel.mjs), and the refresh refuses while one is open and the main it would install holds that pull request:
// its head or its merge commit is an ancestor of main's sha, by gh and git. One it cannot tell refuses too, since what
// a refresh changes on his machine without his yes is worse than a refresh run again once he answers. Zero dependencies.
import { readNotices, recordedQuestions } from './channel.mjs';
import { mainCheckout, projectSlug } from './sessions.mjs';

// How long gh may take to name a pull request's commits: a gh that hangs is a look that cannot tell, and refuses.
const GH_TIMEOUT_MS = 30_000;

/** The open questions of `record` (`readNotices`) that ask to apply a pull request: `[{ number, pr }]`, in the order
 * written. A question no notice closed is open (`recordedQuestions`), and so is one closed only by an answer no
 * transcript confirmed: that is the sender's claim, not his yes. */
export function openApplies(record) {
  const open = (closed) => closed === null || (closed.by === 'answer' && closed.notice.verified === false);
  return recordedQuestions(record)
    .filter(({ closed, notice }) => open(closed) && Number.isSafeInteger(notice.applies?.pr))
    .map(({ number, notice }) => ({ number, pr: notice.applies.pr }));
}

/** Whether the commit `sha` holds pull request `pr`: `{ holds }`, or `{ unknown }` with why it cannot be told. gh names
 * its head and its merge commit; a commit git does not have is in no history of `sha`, which is here whole unless the
 * history is shallow (Codex P2 on 2947b29..3d02efb: then a missing commit proves nothing, and it is not known), and one
 * it has is held when `git merge-base --is-ancestor` says so. A commit is missing only when `git rev-parse --verify
 * --quiet` says so with its exit 1; any other failure is not known. `run` is `spawnSync`'s shape, run in `cwd`. */
function mainHolds({ pr, sha, run, cwd }) {
  const shown = run('gh', ['pr', 'view', String(pr), '--json', 'headRefOid,mergeCommit'], { cwd, encoding: 'utf8', timeout: GH_TIMEOUT_MS });
  if (shown.error || shown.status !== 0) return { unknown: `gh pr view ${pr} failed: ${String(shown.stderr || shown.error?.message || `exit ${shown.status}`).trim()}` };
  let view;
  try {
    view = JSON.parse(shown.stdout);
  } catch {
    return { unknown: `gh pr view ${pr} gave no JSON` };
  }
  if (typeof view?.headRefOid !== 'string' || view.headRefOid === '') return { unknown: `gh pr view ${pr} named no head commit` };
  const shallow = run('git', ['rev-parse', '--is-shallow-repository'], { cwd, encoding: 'utf8' });
  const said = String(shallow.stdout ?? '').trim();
  if (shallow.error || shallow.status !== 0 || (said !== 'true' && said !== 'false')) return { unknown: `git could not say whether the history is shallow: ${shallow.error?.message ?? (shallow.status !== 0 ? String(shallow.stderr || `exit ${shallow.status}`).trim() : `it answered ${JSON.stringify(said)}`)}` };
  if (said === 'true') return { unknown: 'the history here is shallow, so a commit that is not here may still be in it' };
  for (const commit of [view.headRefOid, view.mergeCommit?.oid].filter((one) => typeof one === 'string' && one !== '')) {
    const here = run('git', ['rev-parse', '--verify', '--quiet', `${commit}^{commit}`], { cwd, encoding: 'utf8' });
    if (here.status === 1) continue;
    if (here.error || here.status !== 0) return { unknown: `git could not say whether it has ${commit.slice(0, 7)}: ${here.error?.message ?? String(here.stderr || `exit ${here.status}`).trim()}` };
    const ancestor = run('git', ['merge-base', '--is-ancestor', commit, sha], { cwd, encoding: 'utf8' });
    if (ancestor.status === 0) return { holds: true };
    if (ancestor.status !== 1) return { unknown: `git merge-base --is-ancestor ${commit.slice(0, 7)} ${sha.slice(0, 7)} failed: ${String(ancestor.stderr || ancestor.error?.message || `exit ${ancestor.status}`).trim()}` };
  }
  return { holds: false };
}

/** The line the refresh refuses with before it installs `sha`, or `null` when no open question of the project's record
 * (under `home`, the project of the checkout at `cwd`) asks to apply a pull request `sha` holds. Every question that
 * refuses is named. `landed` says that a land came first, and that it stands. A record that cannot be read refuses:
 * that no question was read is not that none is open. */
export function unansweredApply({ home, cwd, run, sha, landed = false }) {
  const short = sha.slice(0, 7);
  const after = `nothing was refreshed, and the installed copy still names its previous main${landed ? '; the land itself landed, and main stands' : ''}`;
  const utf8 = (command, args, options) => run(command, args, { ...options, encoding: 'utf8' });
  const record = readNotices(home, projectSlug(mainCheckout(utf8, cwd)));
  if (record.unavailable !== undefined) return `refresh: the channel's record ${record.path} could not be read (${record.unavailable}), so whether an open question asks to apply what ${short} holds is not known: ${after}.`;
  const refusing = [];
  for (const { number, pr } of openApplies(record)) {
    const held = mainHolds({ pr, sha, run, cwd });
    const asks = `question ${number} is open and asks the user's yes to apply pull request ${pr}`;
    if (held.unknown !== undefined) refusing.push({ number, said: `${asks}, and whether ${short} holds it is not known (${held.unknown})` });
    else if (held.holds) refusing.push({ number, said: `${asks}, which ${short} holds` });
  }
  if (refusing.length === 0) return null;
  const numbers = refusing.map((one) => one.number);
  const which = numbers.length === 1 ? `question ${numbers[0]} is` : `questions ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)} are`;
  return `refresh: ${refusing.map((one) => one.said).join('; ')}: ${after}. Refresh again once ${which} answered or withdrawn.`;
}

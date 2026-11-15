# JH 204 · A land never removes the worktree of a live session

Locator: `odd/tasks/land-live-worktree.md` · Branch: `worktree-land-live-worktree`, from origin/main a5ff8fd0 ·
Delivery: one pull request, landed by the lead · Test runner: `node --test`

## State
Done: the reproduction (L2, L3), the tests and the fix (T2, T3 in one commit, L5), the failures and roadmap entries
(T4), the reviews and the verifier (L7, L8); PR 881 open, turned to draft on the advisor's word. Next, before ready:
(a) the last sentence of merge-queue's USAGE says --prune "exits 0 unless git cannot fetch or list the worktrees":
add the listing (doctor.mjs:366 only names the command, no caller relies on its exit); (b) a blocked-guest row in
`bin/lib/background-close.test.mjs`; (c) FAILURES `land-removed-live-worktree` Proof: replace the `removed` clause by
a count the incident fails (a session `claude agents` lists in a folder `git worktree list` no longer names);
(d) one codegraph call on the board's session reading in `bin/lib/sessions.mjs`, result in the Log, named under
Left if it reads a current cwd; (e) a session summary under `docs/sessions/` as JH 202's (1e67637d); (f) drop the
"Generated with" line from the PR body if `mergeMessage` (`bin/lib/pull-request.mjs`) copies the body. (a)+(b) are a
code commit: one Codex and the lenses on it, cost said first. Then `gh pr ready 881`, the gate (advisor alone, one
call, the notice alone) and `js-harness notify --to orchestrator --kind ready --pr 881`, checked in the project's
channel record. Open: nothing of his.

## Goal
`js-harness merge-queue --land` and `--prune` never run `git worktree remove` on a worktree a session listed by
`claude agents` stands in, and a removal git fails part-way is told as what it left, not as "it stays".

## Why
On 2026-11-14 the land of PR 878 emptied `D:/js-harness-worktrees/codex-spend` while JH 199 worked there, and said
the worktree stayed (L2). The session's next notice went to a channel no lead reads (A2-2 of the full audit), and the
lead re-added the worktree by hand. Every check the land runs is about git's state; none asks whether a session is in
the folder, and on Windows a session in the folder is exactly what makes git fail after deleting.

## Done when
- `node --test bin/merge-queue.test.mjs bin/lib/background-close.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness contract check odd/tasks/land-live-worktree.md` exits 0
- `js-harness failures` lists `land-removed-live-worktree` with a `check` control
- the new tests fail on origin/main a5ff8fd0 (L-line with the run) and pass on the branch
- one independent verifier (opus) attacked the diff and its pass is clean
- the pull request is open, its ready notice sent to the lead

## In scope / Out of scope
- In: `bin/merge-queue.mjs` (the land's removal, `--prune`, the help), `bin/lib/worktrees.mjs`
  (`removableWorktrees`), `bin/lib/background.mjs` (the shared reading of a live session),
  `bin/lib/background-close.mjs` (its guest check, moved onto that reading), their tests, `docs/FAILURES.md`,
  `docs/ROADMAP.md`'s Later entry, this document.
- Out: A2-2's half, a notice from a session whose folder vanished still reaching the project's record (follow-up F1
  below; the owner did not pick "notices that are never lost" first, his question 287); `doctor`'s count of
  removable worktrees (`worktreesInMain`), which removes nothing.

## Constraints
- Removal of files is high risk (`AGENTS.md`, items 1 and 5): an independent verifier attacks the change.
- A listing that cannot be read is never "none" (`listAgents`'s own rule): the land then removes no worktree.
- No Codex run on a docs-only commit.

## Ask me before
Nothing: the brief settles the direction.

## Depth pass
- 1. Method: reuse the reading the repo already has. `closeFinished` (`bin/lib/background-close.mjs:175-178`) keeps
  a worktree a job of claude's listing stands in: its cwd within the worktree, and at work or its pid alive. The
  smallest change: that predicate becomes one exported function, and the land's removal asks it before each
  `git worktree remove`.
- 2. Raw material:
  - the land's own output, `land-878.out` in the lead's scratchpad (copied to the job's tmp): "Could not remove the
    worktree of PR 878 at D:/js-harness-worktrees/codex-spend (error: failed to delete
    'D:/js-harness-worktrees/codex-spend': Permission denied): it stays."
  - its record, `D:/js-harness/.git/js-harness/lands.jsonl`, the line with `"landed":[878]`: `"removed":[]`,
    `"endedAt":"2026-11-15T00:55:04.679Z"`.
  - JH 199's notice, `~/.js-harness/channel/D--js-harness-worktrees-codex-spend.jsonl`, at 2026-11-15T00:56:26Z:
    "878's land removed my worktree (D:/js-harness-worktrees/codex-spend empty since 19:55, its .git/worktrees
    entry gone)"; its `cwd` is the worktree.
  - the lead's transcript `69918425-3b43-430f-9f50-62b6422422ce.jsonl`, line 10630 (the re-add command,
    `git worktree add -b feat/codex-spend-t2 D:/js-harness-worktrees/codex-spend c472dcb`) and line 10632 (its
    result, "HEAD is now at c472dcbe"); read by path and line, since `sessions --quote` reads only the user's lines
    (line 10634, which the brief names, is an `api-request-blob` copy).
  - `claude agents --json --all` on 2026-11-15: JH 199 is listed `kind: interactive`, `status: idle`, `pid: 25176`,
    `cwd: D:\js-harness-worktrees\codex-spend`. So the listing sees it, idle, by its live pid.
- 3. The bar:
  spec 1: `node --test bin/merge-queue.test.mjs`: none, new behaviour (no test lists a session in a worktree, and a
  removal git fails part-way is said "it stays").
  spec 2: `js-harness failures`: no entry names a land's removal; `stop-removed-live-worktree` is `sessions stop`.
  spec 3: left out because it builds nothing: follow-up F1 below.
  spec 4: `grep -n "land never removes" docs/ROADMAP.md`: the Later entry, open.
- 4. Refutation: does git leave a worktree whole when it refuses? Run now (L3): a scratch repository, a process
  standing in a linked worktree, `git worktree remove`: exit 255, "failed to delete ...: Permission denied", the
  folder left empty and its `.git/worktrees` entry gone. So "it stays" was false, and the only sure way to keep a live
  session's files is not to call the removal.
  Verdict: supports
- 5. Request: before each removal, the land and `--prune` read `claude agents` once and keep any worktree a listed
  session stands in (the close's reading, shared); a listing that fails keeps them all; a removal that fails says
  whether git still lists the worktree. `--prune` runs the same removal by the land's rule, so it is kept the same.
  Adds: none

## Specs
1. Brief, task 2: "Test first: a land never removes a worktree a live session works in. Decide how \"live\" is read
   from what exists (the board's sessions and their cwd, a recent transcript entry, a lock), searching codegraph and
   `js-harness sessions` for one that already says it; amend that one."
2. Brief, task 1: "Write the `- Seen:` line in `docs/FAILURES.md` for this failure, in the five parts CLAUDE.md
   names, quoting the transcript lines above."
3. Brief, task 3: "A2-2's half ... is NOT built here ... Write it as a follow-up in the feature document, with what
   the audit says: the fix must cover a vanished folder, not a worktree being created."
4. Brief, task 4: "Mark the ROADMAP \"Later\" entry PR 880 added for this workaround ... as done or name what is left."

## Tasks
- [x] T1 (kind: design) this document and the reproduction (spec 1; inline; its own commit)
- [x] T2 (kind: build) the failing tests (spec 1; inline; with T3, since the hook refuses a red commit)
- [x] T3 (kind: build) the shared reading, the land and `--prune` keep a live session's worktree, the true failure line
  (spec 1; inline; one commit with T2)
- [x] T4 (kind: docs) the `- Seen:` entry and the roadmap entry (specs 2, 4; inline; its own commit)
- [x] T5 (kind: verify) Codex, the lenses, the verifier, the pull request and the ready notice

## Follow-up F1 (not built here): a notice from a session whose folder vanished
What the audit says (finding A2-2, partly verified; its file in the lead's side-session notes, `full-audit/A2.md`):
JH 199's notice went to `~/.js-harness/channel/D--js-harness-worktrees-codex-spend.jsonl`, which no lead reads,
because the session's folder had vanished and `mainCheckout` fell back to the folder itself. The fix must cover a
folder that vanished, not a worktree being created: when git can no longer name the main checkout from the cwd, the
notice still reaches the project's record (for instance from the session's recorded project, or the transcript's
first cwd), and is never written under a slug of the vanished folder. Its home is "notices that are never lost", which
waits on the owner's order (question 287). This change makes the vanished folder rarer, not impossible: a process
other than a listed session, or a session that enters after the listing, can still be in the folder.

## Log
- L1: the request, the brief `2026-11-15T08-02-31-062Z-d1a1c98b.md` of the orchestrator: "a land never removes a
  worktree a live session works in"; the reproduction first.
- L2: reproduced from the land's output and record (Depth pass, item 2). The land did call `git worktree remove`:
  every check passed (the lead's guess holds), git failed on the top folder JH 199 stood in, and the land said
  "it stays" and recorded nothing, while git had already deleted the files and the registration.
- L3: the mechanism run on this machine (`node` script in the job's tmp, git 2.x on Windows): `remove: 255 error:
  failed to delete '.../wt': Permission denied`, `folder exists: true holds: []`, `git worktree list` without it,
  `.git/worktrees` gone. Checked, not assumed.
- L4: the advisor, before any write: assert that no `worktree remove` call reaches git for that path (the record's
  `removed` was already empty on the incident); share the close's guest predicate; hoist the listing before the
  removal and keep all when it fails; inject `listAgents` in every land test; cover `--prune`; tell the false "it
  stays"; write down what the listing cannot see (a cwd elsewhere, a session that enters after the listing).
- L5: red before the fix, on this branch at 06de13c2 plus the tests alone: `node --test --test-name-pattern="listed
  session|standing in a worktree|listing of sessions|after deleting the registration|--prune keeps"
  bin/merge-queue.test.mjs`: pass 0, fail 5, each on its own assertion (git was asked to remove `wt-a`; the line
  said "it stays"; `--prune` removed `wt-a`). The pre-commit hook refused that red commit (GitHub run 43694025769),
  so the tests went in with the fix. Green after it: the same five and every other worktree, prune and close test
  of the file (17), and `bin/lib/background-close.test.mjs` with `bin/lib/background.test.mjs` (47).
- L6: a decision of this session: a `blocked` job of the listing counts as standing in its folder, for the land and
  for the close's guest check alike: keeping a worktree is the safe side, and the close only keeps more. First
  written as "any state but `done`", narrowed at L7.
- L7: reviews of a5ff8fd..930410c (code commit eaab9805). Codex: "the patch is correct", confidence 0.88, no finding;
  113,291 input tokens (76,416 cached) in 53 s. Lenses risk, resilience, reliability, readability (`--doc`): 0, 0, 1
  and 2 findings, about 15,800 input tokens each: a test used the pid of a child that just ended as a dead one, which
  Windows may give again (now a pid above any in use, ESRCH checked); the `--prune` test could not fail on its exit
  (now exact: 0 and `0 worktrees removed.`, 1 and the refusal on stderr; it also had to put the index back to idle
  between its two runs); `--prune` told a failed listing on stdout (now stderr, `merge-queue:` as its other
  refusals). The verifier (opus, 607 s, 86,085 tokens): no blocker; should-fix, a job listed `stopped` or `failed`
  would keep a folder and block the close for ever, so only `working` and `blocked` count now; nits: no test of the
  shared reading for the close (now `standingIn`'s own test in `bin/lib/background.test.mjs`), the `--prune` exit
  and stream (above), and a removal git fails part-way is printed but not recorded in the land's record (left: no
  spec asks for it; the line says what git left).
- L8: the fix of L7 in 1b5ee401, and 08d96657 for what the verifier's second pass found (167 s, 97,471 tokens; no
  blocker): the help and a test name still said "a job not done". Reviews of 930410c..08d9665: Codex "the patch is
  correct", confidence 0.92, 74,553 input tokens (44,416 cached) in 24 s; the four lenses 0 findings each, about
  11,000 input tokens each, and the three earlier findings rechecked as fixed. Left open from the verifier: the
  close's guest check has no test of its own in `bin/lib/background-close.test.mjs` (the shared `standingIn` has
  one), and a half-removed worktree is printed, not recorded.
- L9: the advisor before the ready: PR 881 turned to draft (a land takes any open PR not a draft,
  `land-took-pending-pr`); --prune's help still said exit 0 unless git fails, fixed with the close's blocked-guest
  test in one code commit; the FAILURES Proof's first clause held on the incident's day (`"removed":[]`), replaced by
  a count the incident fails; `mergeMessage` (`bin/lib/pull-request.mjs:27`) copies no PR body, so its attribution
  line stays out of commits. The board (`readSessionsWindow`, `bin/sessions.mjs:405`) reads each session's transcript
  by project folder, and every transcript entry carries its `cwd` (the lead's transcript does): the last entry's cwd
  is the candidate for "a session whose listed cwd is elsewhere", not built. The whole test file ran on GitHub's
  Linux only (gate runs 43695331848 green, 43694712942 the size refusal), not on this machine.

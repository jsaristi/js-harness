## Goal
A land that worked ends with exit 0, and a candidate of two pull requests is judged pull request by pull request:
the prune's check reads the target a shim runs, and the depth-pass order control reads each pull request's own
commits.

## Why
On 2026-11-10 every land ended `land exit 6` after a refresh that worked, and a candidate with PR 806 merged ahead
of PR 807 was refused with a red contract for 807. The lead worked around both by hand, eleven lands in a row, one
pull request a run. An alarm that is always false teaches the lead to ignore exit 6, which is the danger; and a
queue that lands one pull request a run spends a whole suite for each.

## Done when
- `node --test bin/lib/refresh-copy.test.mjs` exits 0
- `node --test bin/lib/depth-pass.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness notify --to orchestrator --kind ready --pr <n>` records the notice

## In scope / Out of scope
- In: bin/lib/refresh-copy.mjs (the check after the prune), bin/contract.mjs and bin/lib/depth-pass.mjs (the order
  control's reading and its judge), bin/lib/pull-request.mjs and bin/merge-queue.mjs (the one home of the queue's
  merge subject), their tests, this document, the session's summary.
- Out: what the prune removes and when (only its check after the pass changes); the form of a depth pass; any rule's
  text; a real land or a real refresh (never run to test: scratch folders and throwaway repositories outside the
  worktree); merging (the lead's, after his yes).

## Constraints
- The check still names a shim a prune really broke — because the alarm exists for that, and a check that never fires
  is as blind as one that always does.
- A single pull request is judged exactly as today — because the brief says "Never weaken the control for a single
  pull request": the new reading applies only to what the merge queue builds.
- Tests first, red before the fix — because both are guards of the land.
- An independent verifier reads what touches the refresh — because the installed copy is what every hook runs.

## Ask me before
- Nothing beyond the brief: the lead decides scope and merging, after his yes.

## Depth pass
- 1. Method: a release engineer's, on a post-condition and on a history predicate. A post-condition is checked on the
  thing itself, here the file the shim hands to node, never on the first string that looks like it; and it is tested
  against the artifact as the tool writes it today (pnpm 12.18.0's shims, copied as fixtures), in both directions:
  silent when the target is there, loud when it is gone. A predicate over history says which commits it ranges over:
  "the branch" of a document is one pull request's commits, and in a candidate the queue's own merges mark where each
  one starts and ends. Smallest change: one function that reads a shim's targets, and one tag (`side`) on the
  commits the judge already receives. Searched first: codegraph for `PRUNE BROKE`, `pruneStalePnpm`, `branchOf`,
  `depthPassJudge`; `grep -rn "Merge pull request" bin` (the queue writes the subject at `bin/merge-queue.mjs:358`,
  three report modules read it, none exports it).
- 2. Raw material: `bin/lib/refresh-copy.mjs:158` (the first `global/v11` match is taken as the target) and `:160`;
  the installed shims `C:\Users\Oficina\AppData\Local\pnpm\bin\js-harness` and `js-harness.cmd` as pnpm 12.18.0 wrote
  them at 7525a4e5 (their first `global/v11` path is a `NODE_PATH` entry, `<id>/node_modules/.pnpm/node_modules`;
  the target, `<id>/node_modules/js-harness/bin/js-harness.mjs`, comes after, behind `..`); the lead's ten land
  outputs of 2026-11-09 and 2026-11-10 (`land-797.out` to `land-813.out`, each with one `PRUNE BROKE js-harness`);
  `bin/contract.mjs:445` and `:449` (`branchOf`: one list, `<trunk>..HEAD`, `--topo-order --no-merges`);
  `bin/lib/depth-pass.mjs:116` and `:117` (every commit of that list before the verdict's counts);
  `odd/tasks/audit-u2-stop-hook.md:100` (JH 165's reading, L6); `.github/workflows/gate.yml:33` (`fetch-depth: 0`,
  so GitHub Actions judges a candidate with the same history, and no environment variable of the queue reaches it).
- 3. The bar:
  spec 1: `node --test bin/lib/refresh-copy.test.mjs`: today the check names `js-harness` broken on shims of
  pnpm 12's shape whose target is there (10 of 10 lands, exit 6), and does not name one whose target is gone while its
  `NODE_PATH` entry is there (the installed `codex` shim reads that entry, never its target).
  spec 2: `node --test bin/lib/depth-pass.test.mjs`: today a candidate of a code pull request merged ahead of one
  with a new feature document answers "code was committed before the pass's verdict: bin/b.mjs", the other pull
  request's file; the reverse order answers nothing, by the order git lists parallel commits in.
- 4. Refutation: could the target really be missing, or JH 165's reading be wrong? One read-only script, run at
  7525a4e5: `node refute.mjs <worktree>` (kept in the session's scratch) read every shim of the real pnpm bin folder
  with the check's own patterns, and built three throwaway candidates. Result: of 14 shims, 2 are read as missing
  (`js-harness` and `js-harness.cmd`, both reading `.pnpm/node_modules`) while the `cmd-shim-target` of `js-harness`
  exists; 2 more (`codex`, `codex.cmd`) read a `NODE_PATH` entry that happens to exist. Candidates: [code, doc] 1
  fault naming the code pull request's file, [doc, code] 0, [doc] alone 0. Both readings hold.
  Verdict: supports
- 5. Request: make the check after the prune read what each shim runs (the path it hands to node or starts, behind
  the shim's own folder), so a `NODE_PATH` entry is never taken for the target, with a test where the target is there
  and one where it is gone, on shims of the shape pnpm writes today; and make the order control judge, in a candidate
  the merge queue built, each pull request's own commits, with a test of two pull requests in both orders and one
  that a pull request with its own code before its verdict is still refused, alone or in a candidate, and that a
  branch that is no candidate is read as today.
  Adds: none

## Specs
1. "Find why the check after the prune says the target is missing when it is there (how it resolves a pnpm shim on
   Windows is the first thing to prove or refute), fix the check, and keep it able to catch a prune that really
   breaks the shim: a test for each case." (the brief, 2026-11-11T05:20Z)
2. "Reproduce it in a test with two pull requests, one with code merged ahead of one that brings a new feature
   document, and fix the control so it judges each pull request's own commits. Never weaken the control for a single
   pull request." (the same)

## Design
- D1 (spec 1). A shim's targets are the paths it runs behind its own folder: `..\global\v11\...` in a `.cmd`,
  `../global/v11/...` in the POSIX shim. A `NODE_PATH` entry is absolute and is never one. A shim that names the
  store with no such path (a target on another drive, a form not seen yet) is checked by the store paths of its lines
  that set no `NODE_PATH` (L7), and one that names the store only there by the store folders it names, which is what
  a prune can remove: so no shim that names the store goes unchecked, and no path that is not a target raises the
  alarm. The shim is broken when one of its targets is missing. The message and exit 6 stay.
- D2 (spec 2). A candidate is recognized by what the queue writes: past the trunk, every commit of HEAD's
  first-parent line is a merge whose subject is the queue's, `Merge pull request #<n> from <branch>` (one home:
  `mergeSubject` and `MERGE_SUBJECT` in bin/lib/pull-request.mjs, which the queue now writes it with). Then the
  commits each merge brings (`<merge>^1..<merge>`, merges aside) are one pull request, tagged `side`; the judge keeps,
  for a document, the commits of the side that brings its verdict (or, with no verdict committed, that first touched
  it). Any other history has no sides and is read whole, as today; a commit the sides cannot place also reads whole,
  the strict way. No environment variable: GitHub Actions runs the candidate's `check` too.

## Tasks
- [x] T1 (build) spec 1: the check after the prune reads what the shim runs, tests first; an independent verifier
  reads it: `e0e2755a`, and the verifier's finding in `d5950864`.
- [x] T2 (build) spec 2: the order control judges each pull request of a candidate by its own commits, tests first:
  `adc2978c`.
- [x] T3 (docs) the session's summary, the pull request, the ready and closed notices.

## Log
- L1 The brief (2026-11-11T05:20Z), as written: "You own one feature: two defects of the land (`js-harness
  merge-queue --land --refresh-copy`) that the lead worked around by hand on 2026-11-10, eleven lands in a row."
  with its two defects quoted in Specs, and: "This is large work and it names high-risk items (the land, the
  installed copy): open `odd/tasks/<feature>.md` before the first source write [...] Tests first. An independent
  verifier on what touches the refresh. Never run a real land or a real refresh to test: use a scratch home
  (`--home`) and fake remotes outside the worktree. Gate, Codex and the pertinent lenses on each slice, one at a
  time. Then PR ready, `js-harness notify --to orchestrator --kind ready --pr <n>`, your summary and the closed
  notice. The merge is his after his yes."
- L2 Defect 1, proved at 7525a4e5 (read-only): the check takes the first `global/v11` path of a shim. In pnpm
  12.18.0's shims that is the last `NODE_PATH` entry, `<id>/node_modules/.pnpm/node_modules`, a folder pnpm makes
  only for a package with dependencies; js-harness has none, so it is never there, while the target is. How the
  check resolves the path (`path.join(home, target)`, a link followed by `existsSync`) is right: refuted as the
  cause. The same reading made the check blind for `codex`, whose `NODE_PATH` entry exists whatever its target.
- L3 Defect 2, JH 165's reading checked and true: `branchOf` gives the judge one list for the whole candidate, so
  another pull request's code stands before a document's verdict whenever git lists it first. PR 808 was refused the
  same way in the same land (land-806.out). The pre-existing pass of the reverse order is an accident of that order.
- L4 Decided here: D2's candidate is recognized by the queue's merge subject, not by shape alone (every first-parent
  commit a merge), since an integration branch built only of `Merge branch` commits is one pull request and stays
  read whole; and not by an environment variable, since GitHub Actions has none.
- L5 The plan had no double review (`rule:double-review`): the pass supports and adds nothing, nothing is put to the
  user, and the brief names the reviews of this work (the gate, Codex and the lenses on each slice, a verifier on the
  refresh). Said here so the absence is not read as a review that ran.
- L6 T1, red before the fix: `node --test bin/lib/refresh-copy.test.mjs` with the new tests and the old check, 3 of
  the 4 new prune tests fail (the fourth, a removed store folder, passes on both, as it should); after the fix 29
  pass, 0 fail. The fixed check on the real pnpm bin folder, with a file system whose `rmSync` refuses
  (`real-shims.mjs` in the session's scratch): `{"broken":[],"removalsRefused":2,"shims":25}`, where the old check
  gave `["js-harness"]`. The commit's gate: `PASS check 17 rows passed`.
- L7 Reviews of ac2a22e1..e0e2755a: Codex, the patch is correct (0.88), no finding, 67,922 input tokens; the risk and
  reliability lenses, 0 findings each, 18,469 input tokens in all. The independent verifier (Fable 5.2, read-only,
  90,011 tokens): holds, no blocker. It ran the new and the old check on the real bin folder (new `[]`, old
  `["js-harness"]`, nothing removed), 15 of 15 breaks built from copies of the real shims named once each (a target
  file gone, a store folder gone, a dangling link), and the new tests against the old module (4 of 5 fail). One
  low finding taken, `d5950864`: a shim that names its target whole, with its store folder there and its target gone,
  was named by the old check and not by the new one; it is now held by that target. Its red was the verifier's
  script (`new=[] old=["x"]`), not a run of this session's. Kept as they are, low: a `NODE_PATH` entry in a folder
  that is gone while the target is in another that is there is no broken shim; a POSIX target with a space is cut at
  the space, as before this change. Not checked: shims a real pnpm writes on Linux or macOS, and a real refresh.
- L8 T2, red before the fix: `node --test bin/lib/depth-pass.test.mjs` with the new tests and the old reading, 3 of
  the 4 new tests fail (the fourth pins what must not change: merges that are not the queue's are read whole, and it
  passes on both); after the fix, with bin/lib/pull-request.test.mjs, 36 pass, 0 fail. The commit's gate: `PASS check
  17 rows passed`.
- L10 Reviews of e0e2755a..adc2978c, first round. A mistake of this session: it edited this document while Codex
  read, so that run (160,698 input tokens) wrote no record and was run again; entered in docs/FAILURES.md. Codex, P2,
  taken in `e228ff7c`: a quoted target with a space was cut at the space, a new false alarm for a target named whole
  (the POSIX pattern behind the shim's folder cut the same way, as the check always had). The reliability lens, taken
  in the same commit: the .cmd form of a target named whole had no test. The risk lens, first answered with a test
  alone (`bacfc1e6`), then taken (L11): the queue's subject is GitHub's merge button's.
- L11 Second round, e0e2755a..8a3476af: Codex, P2 (190,666 input tokens), and both lenses, the same finding, not
  answered by `bacfc1e6`: a single pull request made of merge-button merges read as a candidate at its own check.
  Taken: the queue signs its merges with a trailer, `Merged-by: js-harness merge-queue` (`QUEUE_TRAILER`,
  `mergeMessage`, bin/lib/pull-request.mjs), and the control parts a history only by it. D2 above is amended by
  this: the trailer, not the subject, is what makes a candidate. Main's merge commits gain that one line; told to the
  lead by a note (01:44 local). The red of the merge-button test is the reviewers' reading of `adc2978c`, not a run
  of this session's; with the trailer, bin/lib/depth-pass.test.mjs 33 pass, 0 fail.
- L12 State at 85% of this session's context (2026-11-11 01:45 local), for a resume. Done: T1 and T2 with their
  fixes, each commit's gate green. Running: the gate of the trailer commit. Left, in order: (1) Codex on
  `js-harness codex-review --base 8a3476af --doc odd/tasks/land-two-defects.md` and the lenses on the same base
  (risk, reliability), with no edit of a tracked file while either runs; a third round that still finds a real fault
  goes to the lead as a problem (`rule:double-review`); (2) `git fetch origin`, merge origin/main (L9), `npm run
  check`; (3) the summary in docs/sessions/2026-11-11-jh-175-the-land-the-false-prune-alarm-and-the-order-control.md
  (`js-harness summary template`), commit, push, a ready pull request, `js-harness notify --to orchestrator --kind
  ready --pr <n>`, then `--kind closed --summary <file>`; (4) stop the background `js-harness wait --notice-to 175`.
- L13 Third round, 8a3476af..300ab00a: Codex, the patch is correct (0.96), the finding fixed, 40,652 input tokens;
  the risk and reliability lenses, 0 findings each, the earlier one fixed. origin/main merged in (`811087d7`), its
  gate green. Against the pass: item 3 predicted 2 of 2 specs red before and green after, measured 2 of 2; item 4's
  verdict held. A third defect the lead named at 01:52 local (a suite that times out is called red) is left as a
  follow-up, in the session's summary.
- L9 From the lead (a note to 175, 2026-11-11 00:47 local): JH 173 adds lines to bin/merge-queue.mjs after the
  `removeLandedWorktrees` block of `mergeQueueMain` and lands first; this branch stays out of that block (its two
  edits there are the import line and the merge's subject in `mergeThroughDoor`) and merges origin/main before its
  last gate.

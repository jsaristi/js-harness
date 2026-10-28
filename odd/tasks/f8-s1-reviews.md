# F8 S1: two reviews on every slice

Locator: `odd/tasks/f8-s1-reviews.md` · Engram mirror: `odd/f8-s1-reviews/tasks` · Branch: `worktree-f8-s1-reviews`
Delivery: chained pull requests, one a slice (L2, until the orchestrator says otherwise) · Test runner: `node --test`

## Goal
Every slice with code gets two reviews, Codex and Claude's lenses, each recorded against the slice's
commit range and its subject hash, and a push or a merge of a code commit that lacks either, or whose
review a later amend made stale, is refused unless a skip is recorded, which stays a listed debt until
the review is made.

## Why
His words of 2026-10-26 (G9, transcript `e41d1e8d`, line 2351): "revision siempre, ya que siempre
necesitamos una segunda opinion con un segundo modelo pero tambien una revision del mismo claude por
que asi nos aseguramos criterio y solidez". gentle-ai's review leaves at S2; its four lens prompts
are worth keeping, but they read only what gentle-ai's provider builds, so S1 builds what feeds them
(diet section 10, "S1, the Claude lens runner").

## Done when
- `node --test bin/lib/lens-candidate.test.mjs bin/lib/lens-result.test.mjs bin/lib/lens-reviews.test.mjs bin/lens-review.test.mjs bin/lib/lens-review-rows.test.mjs` exits 0
- `node --test bin/lib/guard.test.mjs bin/guard.test.mjs bin/check-codex-reviews.test.mjs` exits 0 (T7)
- `node bin/js-harness.mjs contract check odd/tasks/f8-s1-reviews.md` exits 0
- `npm run check` exits 0, and its `review` row names no gentle-ai
- `grep -ci "gentle-ai.*review\|review.*gentle-ai" AGENTS.md` prints 0
- `## Probe` below records the diet's six behaviours in a scratch repo, 6 of 6, and three real slices with tokens per lens
- `js-harness merge-queue --dry-run` lists each pull request as ready, and Codex has no open finding

## In scope / Out of scope
- In: new `bin/lens-review.mjs` and `bin/lib/lens-*.mjs` with their tests; `bin/js-harness.mjs`
  (the command); `bin/lib/codex-review-coverage.mjs` (records to read made a parameter);
  `bin/codex-review.mjs` and `bin/lib/codex-reviews.mjs` (the subject hash on Codex's record);
  `bin/check.mjs` (the push row, the `review` row); `bin/doctor.mjs` (the skip row);
  `bin/merge-queue.mjs` (the door); `AGENTS.md`, `CLAUDE.md` (the review lines);
  `docs/ROADMAP.md`, the diet and the reverse-engineering document where S1 changes them; this document.
- Out: S2 (removing gentle-ai, its hooks and agents), S10, S11 (the brief); `~/.claude`, `~/.codex`
  and gentle-ai's configuration, which this session never writes; the template block `init` ships
  (`bin/lib/template-block.test.mjs` pins its bytes; S12 moves projects).

## Constraints
- The lens runs are work on his plan's CLI login, never the eval token — so the child's environment
  drops `JS_HARNESS_EVAL_OAUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY`.
- No credential file is read, copied or moved; no scratch home holds one (the 2026-10-26 incident).
- A rule's value changes only on a `rule/` branch — so a new value here is a constant in code.
- The machine is shared and ran out of memory once today — at most one sub-agent, gates take turns.

## Ask me before
The incident rerun (about $11 to $22 API-equivalent, S3's real cost was $16.95): asked through the
orchestrator before it runs. A lens review of a slice is work, not an eval (cents each).

## Specs
- S1 (brief): "the Claude lens runner built whole (the candidate as a commit range, an input
  packager, validation, launch and auth, records, invalidation, skips as a debt the merge path
  enforces)".
- S2 (brief): "the four lens prompts ported under our names".
- S3 (brief): "the pre-push gate and the skip debt".
- S4 (brief): "`AGENTS.md`'s review paragraph and `check`'s `review` row no longer naming gentle-ai".
- S5 (brief): "copiamos e implementamos solo lo que nos sirve el resto no": port only what has a
  named need, under our names.
- S6 (brief): "Every F8 decision ships to projects through init/install/update/uninstall."
- S7 (diet section 10, S1 row): "in a scratch repo: a range with both complete records pushes; one
  with an incomplete lens result is refused; one amended after its review is refused; one with a
  recorded skip pushes, is listed by `check` and `doctor`, and its PR is refused by the merge path
  until reviewed; then three real slices"; pass: "6 of 6 behave as stated; tokens per lens recorded
  (D2); incident set no worse".

## Tasks
- [x] T1 (kind: docs) this document, the forecast and the chain question to the orchestrator — all; inline; 82412009
- [x] T2 (kind: build) the candidate and its packager: identity (base, head, subject hash), ordered manifest, each path's patch; the four lens prompts from one text with four scopes; result validation; test first — S1, S2; inline; 6bc94451, fixed in 7ccc7033 and 2d0d2ef0
- [x] T3 (kind: build) launch and records: `js-harness lens-review --base <b> --lenses <list> --reason <why>`, one fresh tool-less run a lens, `--unavailable <reason>` as the skip; a record a run, beside Codex's; test first with a fake CLI — S1; inline; eb518c07, 2d0d2ef0
- [x] T4 (kind: build) the gate: `check --push` refuses a code commit no complete lens record covers; a record counts only for its head commit and subject hash; Codex's record gains the subject hash; test first — S1, S3; inline; e4375922, fixed in d5c722f6
- [x] T5 (kind: build) the skip debt: the `review` row of `check` lists both reviews' debt and skips with no gentle-ai, a `doctor` row lists skips, the merge door refuses a pull request that holds one; `AGENTS.md` and `CLAUDE.md` review lines — S3, S4; inline; in two slices (L8): the `review` row and `AGENTS.md` first, then `doctor`, the door and `CLAUDE.md`; 4834997f, 023eceb9, fixed in e35eb7dc (PR 613); `CLAUDE.md` in the commit that checks this box (L12)
- [x] T6 (kind: verify) the probe in a scratch repo, three real slices, the incident rerun once asked — S7; inline; the probe 6 of 6 (L13), the incident set 13 of 20, no worse (L14)
- [ ] T7 (kind: build) the records only the commands write (reverse-engineering doc, section 13.3, row 3): `guard` refuses a file tool or a shell write to a review record, and a lens record counts only when it names the run line `lens-review` wrote first; test first — S1; inline, branch `f8-s1-records`; L16

## Log
- L1 (2026-10-27, the brief from JH ORQ): "You are JH 62 · F8 S1: two reviews on every slice ...
  Scope (S1 as the diet defines it): the Claude lens runner built whole (the candidate as a commit
  range, an input packager, validation, launch and auth, records, invalidation, skips as a debt the
  merge path enforces), the four lens prompts ported under our names, the pre-push gate and the skip
  debt, and `AGENTS.md`'s review paragraph and `check`'s `review` row no longer naming gentle-ai. Not
  S2 (removal), not S10/S11. Open `odd/tasks/f8-s1-reviews.md` with the task contract first; this is a
  large task: work-unit commits, slices of about 400 lines, ask the orchestrator for the chain
  strategy when the forecast passes it." Decided and not re-asked: his "revision siempre" (every slice
  gets Codex plus Claude lens reviewers, picked by what changed, no risk-tier skip); "copiamos e
  implementamos solo lo que nos sirve el resto no"; every F8 decision ships to projects; Codex is an
  external reviewer only (D3).
- L2 (2026-10-27, design, the lead's by default; each can be reversed):
  - **Launch flags, probed** (the diet left them `[i]`): `claude -p --safe-mode --tools "" --system-prompt
    <lens> --model sonnet --output-format json --no-session-persistence`, the package on stdin. One probe
    run: 1,032 input tokens, so neither his global file nor a project `CLAUDE.md` loads; $0.004; the
    model answered as `claude-sonnet-5-5`. `--bare` is out: it reads only an API key, never his login.
  - **The prompts are ported from one text.** The four gentle-ai agents (`~/.claude/agents/review-*.md`,
    read only) differ in their name and their one `## Scope` line; the rest is shared. Ours keep the
    input contract, scope, admission, severity, evidence and output sections, rewritten to read our block;
    the codegraph, language and remote-authorization blocks gentle-ai appends are dropped (no tools, no
    artifact). The refuter and the `jd-*` agents are not ported (reverse-engineering doc, "Agents").
  - **The runner reads its prompts from the package**, so `install` ships them with `bin/` and nothing is
    written under `~/.claude/agents`: an agent file there would be a second copy no runner reads (S5),
    and one fewer thing to undo (S6). This changes §11.1's row 1 of the reverse-engineering document.
  - **What a lens reads is what Codex reads**: the files `codex-review-scope.mjs` does not leave out, so
    "code commit" means one thing to both gates.
  - **One record a run**, `<git common dir>/js-harness/lens-reviews.jsonl`, holding each lens's outcome,
    findings, tokens, cost and duration; the run is `reviewed` only when every picked lens is complete,
    else `incomplete`, which covers nothing. A rerun runs the picked lenses again (cents).
  - **"Of the same head commit and subject hash"** is read as: each record is pinned to its own head and
    hash, and the gate asks that each code commit be covered by both kinds. Codex already cuts a range
    into parts and rechecks; forcing one range on both would undo that.
  - **The gate follows the project's review switch** (`functions.codexReview`): where it is off there is
    no pre-push check to hold a lens gate, and a new switch would be a new config contract.
  - **A cutover**: code commits committed before the gate lands need no lens record, as the merge door's
    gentle-ai cutover did (`bin/lib/gentle-ai-evidence.mjs:11`).
- L3 (2026-10-27): forecast about 2,000 to 2,500 changed lines with tests over five slices (T2 to T5,
  each 400 to 600), past the 400 a slice; the chain strategy asked of the orchestrator, with chained pull
  requests as the default this session works by meanwhile.
- L4 (2026-10-27, JH ORQ): "Chain strategy: yes, chained PRs, one a slice, each based on main and landed in
  order with merge-queue as it becomes ready (stacked-to-main). Send a ready notice per PR."
- L5 (2026-10-27): the first real runs, which are the probe's "three real slices" (T6) as they happen.
  - Lenses on slice 1, `82412009..6bc94451` (risk, reliability, readability): complete, about 14,900 input and
    815 to 2,204 output tokens a lens; reliability found that the subject hash moved with `core.abbrev`, fixed
    test first in 7ccc7033 (`--full-index`). The answer came in Spanish, so the prompts now ask for English.
  - Lenses on slice 2, `6bc94451..7ccc7033` (all four): complete, about 18,600 input tokens a lens; three of them
    found `--plan` with `--unavailable` writing a skip, and reliability that the empty `--tools` value is lost
    through an npm shim.
  - Codex on `82412009..7ccc7033`, three parts, 319,251 input tokens: incorrect (0.99) on two parts, with the
    same two faults (P1 the shim, P2 `--plan`) and a third, P2: `diff.interHunkContext` moves the hash. All three
    fixed test first in 2d0d2ef0; the shim's run goes through `claudeRunner`, which already quoted for it.
  - Rechecks of `7ccc7033..2d0d2ef0`: Codex correct (0.97), every finding fixed; lenses risk and reliability
    complete with no finding, about 7,550 input tokens each.
  - The two reviews agreed on two of three faults, and each found one the other did not: what his "criterio y
    solidez" asked for.
- L6 (2026-10-27): the first pull request holds slices 1 and 2: slice 2 carries the fixes of slice 1's findings,
  so slice 1 alone would land with known faults. Every later slice is a pull request of its own, as L4 says.
- L7 (2026-10-27): the reviews of slice 3, T4 (`b6ef6f38..e4375922`, 243 lines):
  - Lenses risk, reliability and readability: complete, no finding, about 14,990 input tokens each.
  - Codex, 221,053 input tokens: incorrect (0.99), two faults the lenses missed. P1: the lens row refused the
    first push to a remote that holds no branch, which the Codex row lets through. P2: a skip stayed listed after
    a complete review covered its commits. Both fixed test first in d5c722f6; the empty-remote probe is now one
    function, `remoteHoldsNoBranch`, both rows ask.
  - Rechecks of `e4375922..d5c722f6`: Codex correct (0.97), both fixed; lenses reliability and resilience
    complete with no finding, about 7,080 input tokens each.
- L8 (2026-10-27): T5 in two slices, the `review` row with `AGENTS.md` first (it removes about 300 lines of
  gentle-ai code and tests), then `doctor`, the door and `CLAUDE.md`. Decisions in it:
  - His S9 (odd/tasks/on-demand-functions.md: with the Codex review off, gentle-ai reviews high and medium risk,
    and nothing refuses a push for it) is ported, not dropped: with the Codex review off the `review` row still
    names the lens debt and says the lenses are the one review, and the push asks for none. Its risk tiers leave,
    since his answer of 2026-10-26 ("revision siempre") gives every slice both reviews whatever its risk.
  - The contract's `grep -c gentle-ai AGENTS.md` asked more than S4: `AGENTS.md` still names gentle-ai for the
    workflow and the ODD documents, which leave with gentle-ai itself at S2. It now asks that no line of it name
    gentle-ai for review, what S4 says.
- L9 (2026-10-27): evidence from the land of PRs 608 and 609 (the orchestrator's note of 14:20): it ran green, but
  its push was refused by PR 608's own lens push row, since the queue's push meets the gate a candidate brings, and
  PR 609's commits, made after the 18:00Z cut-over by a session with no `lens-review`, had Codex records only. The
  fixed cut-over is the fault: once 608 is on main, every pull request of a session on v0.97 would be refused the
  same way, and every project with the Codex review on would be at its update, before S12. The fix goes into PR 608
  as a commit of its own: a code commit asks for a lens record only where its own tree turns the lens review on, a
  switch of `harness.json` "functions", off unless declared and declared on in this repository, so the commits of a
  branch made before 608 are never asked. 608 stays a draft until then (asked of the orchestrator, 14:2x).
  - The Codex review of f6025a45 was stopped by the host for low memory (no record); it runs again when the
    orchestrator says the land ended.
  - A mistake: a failed commit was run again to read its failing test, a second CI run of about 165 s
    (`docs/FAILURES.md`, diagnostic-whole-gate).
- L10 (2026-10-27): the host compacted this session by itself at ~20:49Z; the record was committed before it but for
  the next-step note, written again here. `f8-s1-debt` was rebased on PR 608's head, 9e81839b, with no conflict.
  - Lenses on 4834997f (the review row, `9e81839b..4834997f`): risk, reliability and readability complete with no
    finding, about 24,950 input tokens each.
  - Lenses on 023eceb9 (doctor and the door, `4834997f..023eceb9`): risk and reliability complete with no finding,
    about 14,060 input tokens each; readability answered with something that was not one JSON object, so the run
    was incomplete and covered nothing. Run once more alone: complete, no finding.
  - A gap for T6: an incomplete lens keeps only its `why`, not a line of what it answered, so "read why before it
    runs again" could not be done past the parser's verdict. The fence is already accepted (`lens-result.test.mjs`).
- L11 (2026-10-27): Codex on `9e81839b..7ae48b0c`, three parts. Part 3 died first when the orchestrator refreshed
  the installed copy mid-run (`no-test-outside-turn.cjs` not found); run again alone, parts 1 and 2 kept. Parts 1 and
  2 correct (0.93, 0.92); part 3 incorrect (0.93), one P2 the lenses missed: the merge door read the lens debt
  through the push row, which passes where the Codex review is off, so a pull request with a lens skip or no lens
  record could land there, against S7. Fixed test first: `lensDoor` reads `lensCoverage` itself. 347,875 input
  tokens in all. PR 3 is not rebased on main (the orchestrator's note of 15:57): 9e81839b is in main, `merge-tree`
  shows no conflict, and a rebase would void both reviews' records.
- L12 (2026-10-27): PR 613 opened against main at 21:17Z, ready and told; its dry run built main bce0e41 plus PR 613.
  The last slice of T5 is branch `f8-s1-close`, on `f8-s1-debt`: 4df603e0 keeps the start of an answer a lens
  result could not read (the L10 gap) and pins the `review` row's promise for a git it cannot spawn (gentle-ai's
  suggestion; `gitOut` already catches the throw, so the row says "cannot tell" before its own catch); then
  `CLAUDE.md`'s review paragraph asks for Codex and the lenses on every slice and names a skip of either as a debt
  the merge door refuses, his "revision siempre" of 2026-10-26 (L1). PR 613 landed at 21:29Z (main abeaa3d).
- L13 (2026-10-27): the probe of S7, with the branch's CLI in a scratch repository and a bare remote (the script
  and its output in the job's scratch folder, `probe.mjs`): 6 of 6 behave as stated. (1) both complete records,
  a real lens and a real Codex review, push; (2) an incomplete lens, from a fake `claude` that answers prose, is
  refused, and its answer is printed ("Looks fine to me."); (3) the range amended after its review is refused by
  both rows; (4) a skip of each review pushes; (5) `check`'s `review` row lists "2 skips still owe a review" and
  `doctor --offline` its `review-skips` row; (6) `lensDoor` refuses the lens skip, then lets it land once a real
  lens review pays it. The probe's lens runs: about 2,580 input and 160 output tokens each, $0.006.
  - The slice `2d20b75..96ffb9f9`: lenses reliability, readability and resilience on 4df603e0 and reliability on
    96ffb9f9, no finding; gentle-ai approved (lineage review-4adc6c14fd575602, lens reliability) with a warning
    refuted (`lensOutcome` returns before a result that is not a string reaches `answerKept`) and two suggestions,
    both taken test first in 96ffb9f9: the cut by characters, and the printed line pinned; Codex correct (0.97),
    63,165 input tokens.
  - The incident rerun asked through the orchestrator as question 98, about $11 for one run. A mistake: its text
    opened with "Pregunta 94: ", numbered by hand before `notify` gave it 98; corrected by a note
    (`docs/FAILURES.md`, question-numbered-by-hand).
  - T6's "three real slices" with tokens per lens (D2) are L5, L7, L9, L10, L11 and this one.
- L14 (2026-10-27, JH ORQ at 16:45 local): "run the incident set once (S7's pass criterion, a planned step;
  decided by the lead under rule:away-autonomy, Q98 withdrawn). One run only, 10 cases x 2 attempts; keep
  concurrency low (5.6 GB free); if it fails, report why and do not rerun." The lead's decision, not his words.
  - `f8-s1-incidents`, one arm (`current`, effort high, `claude-opus-5-5`), on f8-s1-close at bc3092e1, 21:55Z to
    22:20Z: 13 of 20 trials pass (score 1), against L 13 and the worse line of 10: no worse. Cases 01 (0.67 each),
    02 and 05 fail every trial, as at S0 and S3; case 03 passed one of two (0.50 on the second), cases 09 and 10
    passed both. Cost $11.35 of list cost (`evals/results/f8-s1-incidents.json`).
  - S1's pass is met: the probe 6 of 6 (L13), tokens per lens recorded on every real slice, the incident set no
    worse.
- L15 (2026-10-27, JH 66, a small task after S1 closed; branch `worktree-lens-reader-object`, PR 616): JH 65's lens
  run over `d6867d8..d90cd20` refused 2 of 6 answers as "not one JSON object", each starting as the object (L10's
  refusal again). What they held past the object is not known: no record kept it, and one diagnostic run of the three
  lenses over that range answered clean ($0.051 by the CLI, about 67k input and 3.9k output tokens).
  - The reader now takes the one object an answer holds with prose before or after it, bare or in one fence, and
    still refuses no object, two, a broken or unclosed one, fences other than one block around it (backtick or
    tilde) and an object that is an array element; its why says which, and where a broken object breaks, so the
    300-character record is kept as it is (`docs/FAILURES.md`, `lens-refusal-unread`).
  - A Codex run was wasted: `docs/FAILURES.md` was edited while Codex reviewed, so it recorded nothing
    (`edit-during-review`). Run again on `d6867d8..b71ddb0`: correct (0.87); its first run's P2 (tilde fences) fixed
    in eaa577e6. Lenses risk and reliability on `d6867d8..b71ddb0`: complete, no finding.
- L16 (2026-10-28, JH 69, the S1 defect task row 3 of section 13.3 of the reverse-engineering document gives, due once
  S10 merged; the lead's brief): "guard refuses a file tool (Write, Edit, MultiEdit, NotebookEdit) or a shell write to
  those record paths" and "A lens record is admitted only when it names a run line that the command wrote first, as
  Codex's records already do". Decisions, the lead's by default:
  - **The run line has a file of its own**, `lens-review-runs.jsonl` beside the records, as Codex's runs do; it holds
    the run's id, range and subject hash and is written before any lens runs, and before a skip or a nothing-to-review
    record. A record is admitted only when it is the first to name a run line of its own range and hash, so a second
    line naming an incomplete run's id never makes it good.
  - **No cut-over**: a lens record written before this names no run line and stops counting. A cut-over by date would
    be read from the record a forger writes; a rerun costs cents a lens. A branch in flight whose lens records are older
    reruns `lens-review` over its unpushed range once this is installed.
  - **What the guard reads**: a path ending `js-harness/<one of the four record files>`, any case and separator, for
    `Write`, `Edit`, `MultiEdit` and `NotebookEdit` (`Read` and `Grep` stay free); in a Bash command, a redirection to
    one, `tee`, `truncate`, `rm`, `shred` or `mv` of one, `cp`, `install` or `ln` onto one, `sed`/`perl -i`, `dd of=`,
    and an interpreter's command line that names one beside a call that writes a file, or calls a function of this
    package that appends a record. A path in a variable or a script on standard input is not followed: prevention stops
    the accident, provenance refuses the forgery.
  - **Outside the brief's surface, by need**: `bin/lib/lens-review-rows.mjs` is where `check --push` reads the lens
    records (the brief's `bin/lib/check*.mjs` names no file that exists); `bin/merge-queue.test.mjs` and
    `bin/check-codex-reviews.test.mjs` wrote lens records with no run line, one line each.
  - e7bc4215 built it. Its independent verifier (high-risk item 2, guards; one sub-agent, about 116k tokens) found no
    blocker and two should-fix: provenance does not refuse a session that writes a run line and a record both, which
    no file the session can write would fix, so the comments now say what it refuses and that only `guard` stands in
    the other's way; and nothing works until a release with it is installed, since the pre-push hook runs the branch's
    own `check` and the sessions the installed `lens-review` (said to the lead with the ready notice). Its nits taken,
    test first: paths with `/./`, `//` or `..`; `bash -c`; `mv` and `cp -t` into the records' folder; `rm -rf
    .git/js-harness`; a script's write call is read for what it writes, so reading a record and writing elsewhere
    passes; a `>` inside quoted text passes. Left: a `cd` into the folder, a path in a variable, a script on stdin.
  - gentle-ai approved e7bc4215 (lineage review-17f0584aece227d8, lens reliability) with a warning and two
    suggestions, all taken test first: `appendJsonLine` left the list of appends (it writes any file); a record of
    another range naming a run no longer claims it; the untested branches (`env`, assignments, `dd`, `install`, `ln`,
    `shred`, `perl -i`) have cases.
  - 0a832b2a closed those. Lenses risk, reliability and readability on `d2bc8ab2..0a832b2a`, run with the branch's
    `node bin/js-harness.mjs lens-review` (the dogfood): complete, no finding, about 26,460 input tokens each; the run
    line came first and the branch's `lens-review` push row passes on it, with the 28 older records ignored. Codex on
    the same range, two parts, 256,364 input tokens: part 2 correct (0.89), part 1 incorrect (0.99), two P2: a
    redirection was read only where it opened a word, so `printf x>>record` passed and quoted `'>record'` was refused;
    and a script that only named `appendLensReview` was refused. gentle-ai approved 0a832b2a (lineage
    review-2bb142cdacbcd360, lens reliability) with two warnings and a suggestion: the same glued redirection; a record
    path held in a script's variable now passed; `admittedLensReviews` with no `where` had no test. All taken in the
    next commit, tests written first: the shell reader gives an unquoted `>`, `>>` or `>|` as a word of its own
    wherever it stands; an append counts only as a call; a write call given a variable is taken for the record the
    script names, so reading a record and writing to a variable is refused too (the safe side).
- gentle-ai on `82412009..6bc94451`: medium, not due (under_budget, 436 lines), assessed by the commit's gate.
- gentle-ai on `6bc94451..eb518c07`: medium, not due (under_budget, 435 lines); on `eb518c07..7ccc7033`: medium, not due (under_budget, 16 lines).
- gentle-ai on `7ccc7033..2d0d2ef0`: medium, not due (under_budget, 81 lines).
- gentle-ai on `b6ef6f38..e4375922`: medium, not due (under_budget, 243 lines); on `e4375922..d5c722f6`: medium, not due (under_budget, 72 lines).
- gentle-ai on `7f107aad..8233cf84`: medium, not due (under_budget, 107 lines); Codex correct (0.87), lenses risk, reliability and resilience no finding (L9).
- gentle-ai on `9e81839b..e35eb7dc` (4834997f, 023eceb9, e35eb7dc): medium, reviewed and approved (lineage review-31b6ff71575dd070, lens reliability), one suggestion: the `review` row's catch for a spawn that throws has no test since the gentle-ai row's went, left for the next slice; Codex correct on parts 1 and 2, its P2 fixed in e35eb7dc and rechecked correct (0.98); lenses no finding (L10, L11).
- gentle-ai on `2d20b75..42a4225c` (4df603e0): medium, reviewed and approved (lineage review-4adc6c14fd575602, lens reliability), a warning refuted and two suggestions taken in 96ffb9f9; Codex on `2d20b75..96ffb9f9` correct (0.97); lenses no finding (L13).
- gentle-ai on `2d20b75..b6e2fbff` (4df603e0, 96ffb9f9): medium, reviewed and approved (lineage review-dff84825d3dcac2d, lens reliability), one suggestion left as is: an empty answer prints `it answered: ""`, which reads right.
- gentle-ai on `d6867d86..7b8a0a6e` (7b8a0a6e): medium, reviewed and approved (lineage review-0174f325f0f58bea, lenses risk and reliability), three advisory findings taken in 41c08b96 and 484df031 (L15).
- gentle-ai on `7b8a0a6e..41c08b96` (41c08b96): medium, reviewed and approved (lineage review-6b678a0a52436631, lens reliability), two advisory findings: the comma tests taken in 484df031; a comma beside the object stays refused, since a refusal costs a run and a false complete breaks S1's rule.
- gentle-ai on `484df031..eaa577e6` (484df031, eaa577e6): medium, reviewed and approved (lineage review-e23cd3803964664e, lens reliability), two advisory findings left for later work: a `~~~` prose line on one side of a bare object is now refused (the safe side), and no test reads an object inside a tilde fence as complete.
- gentle-ai on `d2bc8ab2..e7bc4215` (e7bc4215): medium, reviewed and approved (lineage review-17f0584aece227d8, lens reliability), a warning and two suggestions, all taken test first in the next commit (L16).
- gentle-ai on `e7bc4215..0a832b2a` (0a832b2a): medium, reviewed and approved (lineage review-2bb142cdacbcd360, lens reliability), two warnings and a suggestion, all taken in the next commit (L16); Codex on `d2bc8ab2..0a832b2a` incorrect on part 1 (two P2, taken), correct on part 2; lenses no finding.

## Probe
The diet's six behaviours (S7), in a scratch repository with a bare remote and the branch's CLI, 2026-10-27
(L13): 6 of 6 as stated.

| # | Behaviour | Seen |
|---|---|---|
| 1 | a range with both complete records pushes | a real lens and a real Codex review; `check --push` exit 0, both rows PASS |
| 2 | one with an incomplete lens result is refused | a fake `claude` answering prose; the run exits 1 and prints the answer; `check --push` exit 1, `lens-review` FAIL |
| 3 | one amended after its review is refused | exit 0 before the amend, exit 1 after it, both rows FAIL |
| 4 | one with a recorded skip pushes | a skip of each review; `check --push` exit 0 |
| 5 | the skip is listed by `check` and `doctor` | `review`: "2 skips still owe a review"; `doctor --offline`: the `review-skips` row |
| 6 | its PR is refused by the merge path until reviewed | `lensDoor` refuses the skip, then returns null after a real lens review |

Tokens per lens on real slices (D2): L5 (about 14,900 and 18,600 input a lens), L7 (14,990), L9 (about 10,800),
L10 (24,950 and 14,060), L11's fix (4,430), L13 (5,040, 3,800; the probe's own, 2,580). The incident set, one
run (L14): 13 of 20, against L 13 and the worse line of 10, no worse.

## Next step
T7 (JH 69, 2026-10-28 ~12:40Z), branch `f8-s1-records` in worktree `.claude/worktrees/f8-s1-records`: commits e7bc4215,
0a832b2a and the third with the Codex P2 fixes. Left, in order: Codex `js-harness codex-review --base 0a832b2a` (a
recheck of the third commit) and lenses with `node bin/js-harness.mjs lens-review --base 0a832b2a --lenses
risk,reliability --reason ...` (the branch's command, so the record has its run line); gentle-ai when the Stop hook
offers the third commit; then push `f8-s1-records`, open the PR, `js-harness notify --to orchestrator --kind ready --pr
<n>` saying the bad news: nothing works until a release with it is installed, and every in-flight branch reruns
`lens-review` over its range once it is (older lens records stop counting); then close T7's box.

Before T7:
State at 2026-10-27 ~22:25Z. S1 is built: T1 to T6 done, PRs 607, 608 and 613 landed, PR 614 (`f8-s1-close`) ready
and told. Its pass is met (`## Probe`). Left: PR 614's land by the queue, gentle-ai's review of 96ffb9f9 when the Stop
hook offers it (approved, the line above), the session summary and the closed notice. Open for later work, not S1's: the
`notify` check that refuses a `Pregunta <m>: ` prefix other than the number it assigns (`docs/FAILURES.md`,
question-numbered-by-hand). Branch `worktree-f8-s1-reviews` (on origin) holds the old f6025a45 and 0dd4c450: leave
it, never force-push.

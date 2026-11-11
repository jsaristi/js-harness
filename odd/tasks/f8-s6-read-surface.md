# F8 S6: the read surface

Locator: `odd/tasks/f8-s6-read-surface.md` · Branch: `feat/f8-s6-read-surface` · Session: JH 186
Delivery: chained pull requests of work-unit slices · Test runner: `node --test`

## State
Rewritten 2026-11-11 19:05 local at the context pause (86%), JH 186 (job `d95aafd1`), worktree
`.claude/worktrees/f8-s6-read-surface`, branch `feat/f8-s6-read-surface`, nothing pushed yet.
- Done: T1 (commit `e8b22bb7`). T2 and most of T2b are written and their tests pass (`node --test
  bin/lib/read-surface.test.mjs`, 10 of 10): the `read surface` row counts every resume section, has the legacy
  list `RESUME_LEGACY` and warns from 90%; Next is cut to 1,712 tokens. Its commit was refused once by the gate
  (`docs check`: no row for `docs/roadmap-history.md` in `docs/README.md`; the row is added). Check `git log
  --oneline -3`: if the head is still `e8b22bb7`, stage and commit T2 (`git add` everything but `README.md` and
  `bin/lib/contract.mjs`, which are T3's; `bin/lib/feature-parts.mjs` and its test go with T2, since the measure
  reads its titles; the message is `C:/Users/Oficina/.claude/jobs/d95aafd1/tmp/msg-t2.txt`, or L3's words).
- In the working tree for T3, not committed: `## State` first in `CONTRACT_TEMPLATE` (`bin/lib/contract.mjs`) and
  in `README.md`'s console block.
- Next, in order: (1) the rest of T2b: point every in-page link `](#` of `docs/roadmap-history.md` at
  `ROADMAP.md#`; add to Next's "Still open" list defect f's "Codex is still not proven"; move the history tails of
  Decided's rows word for word to the history file (Decided is 7,158 of the 10,000; the row already warns at
  8,870); (2) the rest of T3: the hook's and the pause's wording (`bin/resume.mjs:398,417,930,940`,
  `bin/lib/pause.mjs:305`, both edited without adding lines: `resume.mjs` is at its ceiling of 1,111) with their
  tests (`bin/resume.test.mjs:25,292,307,614`), `planOf` in `bin/lib/sessions.mjs:913` reading `State` first (also
  at its ceiling), a fixture test where a document opens on `## State`; (3) T6: the roadmap's S6 state, S5's line
  (prove PRs 802 and 803 from `gh pr view`), S7's line (6 of 7, T1 docs open), SPEC's row, re-pin this document's
  `docs/ROADMAP.md` line citations; (4) per slice `js-harness codex-review --base <hash> --doc
  odd/tasks/f8-s6-read-surface.md` and `js-harness lens-review --base <hash> --lenses <pertinent> --reason <why>
  --doc ...`, cost said first, then push and a pull request, `notify --kind ready --pr <n>`; (5) T5: read
  `evals/plan.mjs`, say the runs and cost, run cases 9 and 10 twice each, one try; (6) the summary and `closed`.
  Every notice says the model: `claude-fable-5-2`, medium.
- Open: question 268 (the relief by month: take it out of S6, build it by month in two steps, or leave it) is
  recorded for him through the lead; T4 waits on it and nothing else does. No code of T4 is written.

## Goal
What a session reads to start is bounded and held by a check: the roadmap's Next and Decided at most 10k estimated
tokens, a feature document that opens on a short `## State` head the contract template gives and the resume hook
names, and an orchestrator's relief written one file a month, with the file the lead holds today left as it is.

## Why
A session starts from the roadmap and its feature document, and the lead from its relief file (`CLAUDE.md`, "How
sessions run"). All three grew with no bound: Next and Decided are 15.5k tokens today against 12.8k at S0, resume
sections run to a thousand lines (the roadmap's Later list), and the relief file is 1.72 MB, over the Read tool's
256 KB cap (the diet's appendix B measured 1.32 MB). F8's S6 is the cut of that surface. The brief says only S8 is
left after it; the roadmap shows more open before S8 (S7's close, the outside feature, S9), told to the lead.

## Done when
- `node --test bin/check.test.mjs bin/lib/read-surface.test.mjs` exits 0
- `node --test bin/lib/contract.test.mjs bin/lib/feature-parts.test.mjs bin/resume.test.mjs` exits 0
- `node --test bin/lib/channel.test.mjs bin/lib/board-files.test.mjs bin/lib/measures.test.mjs bin/notify.test.mjs bin/merge-queue.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s6-read-surface.md` exits 0
- `npm run check` exits 0
- the read-surface row of `check` prints at most 15k in all, recorded in the Log
- incident cases 9 and 10, two trials each, recorded in the Log: no worse than S0's (2 of 2 and at least 1 of 2)

## In scope / Out of scope
- In: `bin/check.mjs` and a new `bin/lib/read-surface.mjs` (the measure); `bin/lib/contract.mjs` (the template),
  `bin/lib/feature-parts.mjs`, `bin/resume.mjs`, `bin/lib/pause.mjs` (the State head); `bin/lib/channel.mjs`,
  `bin/lib/board-files.mjs`, `bin/lib/measures.mjs`, `bin/sessions.mjs`, `bin/notify.mjs`, `bin/merge-queue.mjs` and
  three lines of `bin/lib/rules-change-run.mjs` (the relief by month); their tests; `docs/ROADMAP.md`, a new
  `docs/roadmap-history.md`, `docs/SPEC.md`'s row, this document.
- Out: the lead's relief file `~/.js-harness/relief/D--js-harness.md`, which no code of this step rewrites, moves or
  deletes, because it is his lead's only state and a wrong cut of it cannot be seen until a compaction needs it; the
  rest of `bin/lib/rules-*` (JH 172's, in flight); the orchestrator skill's text and `CLAUDE.md`, because a
  protocol's wording is his; the existing feature documents, which keep their sections as they are; merging (the
  lead's).

## Constraints
- The relief change is high risk twice (stored data, and a format `notify --relief`, the board, the resume hook, the
  compaction measure, the land and `rules change` read) — so it is write-forward only: new lines go to a month file,
  every reader reads the old file and the month files, nothing existing is touched, and an independent verifier reads
  the slice before its push.
- Its undo is one command, written in the Log and the pull request: append the month files to the old file in order
  and remove their folder — because what the harness writes outside the repo is undone exactly (`AGENTS.md`).
- A paid run says its count and cost first, one try (`CLAUDE.md`); the eval bar of PR 828 (`evals/plan.mjs`) is read
  before the two cases run.
- JH 172 works in `bin/lib/rules-*`: the one file touched there changes only how the relief text is read.

## Ask me before
Nothing of this step is his beyond the plan he approved: the cost is the plan's (about $3). A change of the
orchestrator skill's wording or of `CLAUDE.md`, were one needed, would be asked through the lead.

## Depth pass
- 1. Method: information architecture for a reader with a fixed budget, to the standard of a log-structured store:
  what is read at every start is a small, current head; history is kept whole and append-only behind a pointer; a
  bound is held by a check, not by care; a format that others read changes by adding a place, never by rewriting one
  (the write-forward migration of a log: old segments stay readable, new writes go to the new segment, readers merge).
  The smallest change that meets it: one row of `check` that counts the surface; the settled paragraphs of Next moved
  word for word to a history document; one section title, `State`, in the template and in the resume hook's list of
  titles, with its bound in the same row; one path function for the month file and one reader of all the files, used
  by the six readers. Searched first: `rg -n -i "read.surface" bin docs` (no code: S0 counted by hand, the diet's
  section 7 says "to build"); `bin/check.mjs:57-70` (the `budget` row, the neighbour); `bin/lib/feature-parts.mjs:10`
  (the resume titles, which already take four names); `rg -n relief bin` (every reader, listed in item 2);
  `js-harness rules` (no rule names the roadmap's size or the relief file's shape).
- 2. Raw material:
  - the plan: `docs/ROADMAP.md:708-714` (S6); `docs/proposals/harness-diet.md:543` (the measure: "a byte count of the
    roadmap's Next and Decided and the open feature document's head"), `:457-458` ("The lead reads a current-state
    head of 20 KB or less, never the 1.32 MB relief file"), `:799` (the step's row), `:1528`.
  - the baseline: `odd/tasks/f8-s0-baseline.md:127-128` (13,413: Decided 5,272, Next 7,494, the document's head 647),
    `:76-77` (the frozen line), `:101-102` (cases 9 and 10: 2 of 2 in every run; 1, 2 and 1 of 2).
  - the roadmap today (`ba06e01f`), bytes over 4: Decided 7,158 (one table, 28,630 bytes), Next 8,350 (33,400 bytes,
    38 paragraphs), 15,508 in all.
  - the relief file today, read and not written: 1,720,531 bytes, 2,580 lines, the longest 9,450 characters; 1,865
    lines open `2026-10`, 334 `2026-11`, 26 are `## <UTC time>` headings and about 130 open `LEAD <n>`; 235,403 bytes
    from the first November line on, in eleven days.
  - its readers: `bin/lib/channel.mjs:89` (`reliefPath`) and `:469` (`appendRelief`); `bin/lib/board-files.mjs:21`
    (the board's last five lines); `bin/resume.mjs:299` (the count and the age); `bin/lib/measures.mjs:82` (a line
    stamped inside a stretch); `bin/merge-queue.mjs:403` and `:470` (the proposal a land confirms, by line number);
    `bin/lib/rules-change-run.mjs:284-287` (the line a change supersedes, by line number); `bin/notify.mjs:392`.
  - the resume sections: `bin/lib/feature-parts.mjs:10`, `bin/resume.mjs:398-417`, `bin/lib/pause.mjs:305`; the
    roadmap's Later item "Shorter resume sections in feature documents" (`docs/ROADMAP.md:1053-1056`): 381 and 1,036
    lines, "nothing bounds their size".
  - his words, through the brief: the lead's transcript `f0959bbd`, line 2835 and line 3075 (L1).
- 3. The bar:
  spec 1: `node --test bin/lib/read-surface.test.mjs`: none, new behaviour; counted by hand today, Next and
  Decided are 15,508 estimated tokens against 10,000.
  spec 2: `node --test bin/lib/feature-parts.test.mjs bin/resume.test.mjs`: none, new behaviour; today a `## State`
  section is not a resume section and nothing bounds one.
  spec 3: `node --test bin/lib/channel.test.mjs bin/lib/board-files.test.mjs bin/lib/measures.test.mjs`: none, new
  behaviour; today every line goes to one file of 1,720,531 bytes.
  spec 4: `node --test bin/lib/contract.test.mjs`: none, new behaviour; today the template opens on `## Goal`.
  spec 5: `node bin/js-harness.mjs check --verbose`: no such row today; 13,413 at S0 by hand, and Next and Decided
  alone are 15,508 today; the line is at most 15,000. Cases 9 and 10: 2 of 2, and 1 to 2 of 2, at S0.
  spec 6: `rg -n "State.*to do|in progress \(JH 159" docs/ROADMAP.md`: two stale lines today (S5 says PR 802 waits,
  its document has 8 of 8 tasks done; S7 says in progress, its document has 6 of 7, only T1 docs open).
- 4. Refutation: two tests that could show the step does not hold, run now.
  The cut: if what Next holds were all live plan, 10k could only be met by deleting plan. The outline
  (`node <scratch>/outline.mjs docs/ROADMAP.md`, bytes per paragraph) gives 27,153 bytes of Next in paragraphs whose
  work is closed or recorded elsewhere (the throughput record 5,402, the session signals 3,754, F6 2,923, the
  defects a to g 5,435, the first version 1,583, SPEC last 1,265, the frozen scope 1,773, research 1,718, migration
  1,670, the TUI 1,152, the rest 478): moved word for word they leave Next near 1.9k tokens and the pair near 9.1k,
  with nothing deleted. It holds.
  The relief by month: if a month were already over the Read tool's cap, a month file would not be the small file
  the diet wants. `awk` over the file gives 235,403 bytes for 2026-11-01 to 11: about 640 KB for a whole month at
  this pace, over 256 KB from about the twelfth day. So a month file bounds the growth (1.72 MB and rising becomes
  at most one month) and does not by itself put the lead's file under the cap. The plan's pass line does not
  measure the relief file, so the step's line is not touched; the finding is recorded here, told to the lead, and
  the month is kept because the plan names it and a finer cut is a change of plan, which is not this session's.
  Verdict: supports
- 5. Request: bound what a session reads to start and hold the bound with a check. Add to `check` a row that
  counts the roadmap's Next and Decided (at most 10,000 estimated tokens, bytes over 4) and the largest `## State`
  head of a feature document (at most 5,000, the diet's 20 KB), 15,000 in all, and refuses over either; move the
  settled paragraphs of Next, word for word, to `docs/roadmap-history.md` behind one pointer each, and shorten no
  decision of Decided beyond what the count needs; make `State` the head the contract template opens on and a title
  the resume hook reads first, bounded by that row, leaving every existing document as it is; write each relief
  line to the file of its month under `~/.js-harness/relief/<project>/`, have the board, the resume hook, the
  compaction measure, the land and `rules change` read the old file and the month files together, touch nothing
  that exists, and prove the undo; correct the roadmap's State lines of S5 and S7 against their documents; run
  incident cases 9 and 10 twice each and record them against S0.
  Adds: none

## Specs
1. "the roadmap's Next and Decided at most 10k" (the plan, `docs/ROADMAP.md:709`).
2. "a `## State` head in feature documents" (`docs/ROADMAP.md:709`).
3. "the relief file by month" (`docs/ROADMAP.md:710`).
4. "the contract template" (`docs/ROADMAP.md:710`).
5. "the read-surface measure at most 15k (13,413 at S0); incident cases 9 and 10 no worse" (`docs/ROADMAP.md:711-712`).
6. "The roadmap's State lines for S5 and S7 are stale [...] Check each against its document and correct them in your
   documentation commit" (the brief, L1).

## Tasks
- [x] T1 (kind: docs) this document with its depth pass, committed before any code — S1 to S6; inline
- [x] T2 (kind: build) the read-surface measure and its row in `check`, test first; Next's settled paragraphs moved to `docs/roadmap-history.md` — S1, S5; inline
- [ ] T2b (kind: build) the measure as the double read corrected it (L4): every resume section counted, a legacy list that only shrinks, a warning from 90%, Decided's history tails and the history file's links — S1, S2, S5; inline
- [ ] T3 (kind: build) the `## State` head: the template, the resume titles, the hook's and the pause's wording, its bound in the row — S2, S4; inline
- [ ] T4 (kind: build) the relief by month — S3; held on question 268 (L4), no code written; if it is built: readers first and landed, then the writer, the undo a tested command, an independent verifier
- [ ] T5 (kind: verify) incident cases 9 and 10, two trials each, after the eval bar is read; the measure recorded — S5; inline
- [ ] T6 (kind: docs) the roadmap's S6 state, the S5 and S7 lines, SPEC's row; reviews, pull requests, the summary — S6; inline

## Log
- L1 (2026-11-11, the brief from JH ORQ, `~/.js-harness/background/briefs/2026-11-11T23-35-51-122Z-9eba72ee.md`):
  "Step S6 of the F8 plan, the next step of the roadmap that nobody holds: after it only S8, the certification, is
  left on F8's path. On 2026-11-11 at 15:20 local he told the lead that the work in flight did not move the map
  [...], and at about 15:40 that the lead works alone and advances as much as it can. The lead opens this step inside
  its charter (the next feature within the roadmap's order)." His words, read with `js-harness sessions --quote
  f0959bbd-5f7a-4360-b626-048caf21067f <line>`: line 2835 (20:28Z), "Me dices el como vamos y cuanto avanzaremos
  pero no en donde estamos y no puedo saber si realmente vamos a avanzar o no"; line 3075 (20:34Z), "listo pero
  entonces queda solo y avanza autonomamente lo que mas puedas". The brief's watch list: the relief change is high
  risk, keep the lead's file readable, say the undo, take a verifier; correct the S5 and S7 State lines; JH 172 holds
  `bin/lib/rules-*`; this is the first session measured on Fable 5.2 at medium, so each notice says the model.
- L2 (2026-11-11, design decisions before code):
  - The measure is bytes over 4, as S0 counted and as `check`'s `budget` row estimates tokens; its two bounds are
    constants beside that row. The five questions of a new check: the growth happened (12.8k to 15.5k in fifteen
    days, resume sections of a thousand lines); more than twice; it is a check; no row counts it, and `budget`
    counts `AGENTS.md` alone; it costs one row and removes the hand count. Other projects: their whole roadmaps are
    6,438 and 17,624 bytes (`D:/abogadaclaudiajimenez`, `D:/plataforma-preproyecto`), far under, so the row turns
    no check of his red.
  - `## State` is the template's first section, so "the task contract comes first" (`CLAUDE.md`) stays true as
    written: the head is part of what `contract template` prints. It is rewritten, never appended to; history goes to
    the Log. The old titles (`Next step`, `State for a resume`) keep working, and no existing document is edited.
  - The relief by month is write-forward. Month file: `~/.js-harness/relief/<slug>/<YYYY-MM>.md`, from the clock at
    the write. `<slug>.md` stays where it is and is read first by every reader. A line number a land or a rule
    change cites is said with its file's name when it is not the old file's. Sessions on an installed copy from
    before the change keep writing to the old file, which every reader still reads, so the two copies can run side
    by side. Undo: `cat ~/.js-harness/relief/<slug>/*.md >> ~/.js-harness/relief/<slug>.md` and remove the folder.
  - Model of this session's replies: `claude-fable-5-2`, effort medium.
- L3 (2026-11-11, T2): the measure is `bin/lib/read-surface.mjs`, its row `read surface` in `check`. `## State` is a
  title no document held before this one (the six that match `^## State` are `State for a resume`), so the row needs
  no legacy list. `bin/check.mjs` is at its ceiling of lines (`bin/conventions-structure.test.mjs`), so `tildePath`
  moved to `bin/lib/payload.mjs`, whose rows it serves, and the ceiling went down from 1,934 to 1,928. Searched
  before adding: `rg -n -i "read.surface|readSurface" bin` (nothing), the `budget` and `claude-md budget` rows (they
  count one file each). Next lost 27,994 characters, moved word for word to `docs/roadmap-history.md`: of the 314
  lines the roadmap lost, 313 are in the history as they were and one had its in-page link pointed at the roadmap.
  Decided is untouched. Measured after: Next 1,712, Decided 7,158, 8,870 of 10,000. The first try at the gate
  failed on `docs check` ("docs/roadmap-history.md has no row in the index of docs/README.md"); the row was added.
- L4 (2026-11-11, the double read of this plan, read `ee8bd9d3-01c2-41eb-88ef-c55b29888b18`: Claude 13 findings,
  1,107,617 tokens; Codex 5 findings, 550,232 tokens; `js-harness double-review take` records 12 of 13 and 5 of 5
  taken). His earlier words on the subject were searched with `rg -n -i "relief|relevo" docs/ROADMAP.md` and in the
  diet's section 1 register: none of his own on the relief's shape or the roadmap's size beyond the plan.
  - The relief by month (Claude 1, 2, 4, 5; Codex 1, 2, 4, 5), taken: L2's design does not hold. An installed copy
    from before the change reads the old file alone and would not see a month file's lines (the land's proposal
    lookup, `rules change`'s superseded line, the resume hook's "read its last lines"); a merged read ordered by file
    is not ordered by time, and the land's `findLastIndex` depends on order; the shell undo is not exact (PowerShell
    re-encodes, a line can arrive between the copy and the removal, file-named line numbers dangle); and a month
    does not give the lead the diet's "current-state head of 20 KB or less". Item 4's verdict stands for the step's
    pass line, which does not measure the relief, and is refuting for the relief part: it went to him as question
    268, first option to take it out of S6 (answered: not yet). T4 is held; if he chooses the month, it is built
    readers first and landed, then the writer, with the undo as a tested command and lines cited by stamp.
  - The measure counts what a resumed session is told to read (Claude 3, Codex 3), taken: every resume section
    `featureParts` names, not the title `State` alone, so an old `Next step` of 17k tokens cannot pass unseen; the
    documents over the bound today go on a legacy list that only shrinks. The bound stays 5,000: it is the frozen
    line's own arithmetic (15k in all less the roadmap's 10k), not the diet's 20 KB as L2 said; a tighter one would
    be a new threshold, which is his. The redefinition against S0 is said here: S0 counted the open document's
    contract head (647); the row counts its resume sections.
  - Decided has no valve and 1,130 tokens of room (Claude 6), taken: a row's history tail ("It replaces ...", "kept
    as history") moves word for word and the decision in force with his words stays; the row warns from 90%.
  - The moved paragraphs (Claude 8), taken: the TUI item stayed in Later whole; F6's raw output, F4's and F2's lines
    stay in Next; defect f's "Codex is still not proven" gets its line; the reply-state check is built
    (`bin/lib/reply.mjs`), so it has none. Proof of the move, on the working tree: of 314 lines removed from the
    roadmap, 313 are in the history file as they were. Its in-page links are pointed at the roadmap in T2b.
  - Cases 9 and 10 (Claude 9), taken: "no worse" is not below S0's lowest run on each (2 of 2, and 1 of 2); a miss
    is read before any rerun and the rerun's cost said; the run is set beside `f8-s5-incidents` too. The two cases
    guard regressions and cannot see the State head (their fixture's document has no resume section), so T3 adds a
    free fixture test of a document that opens on `## State`.
  - Spec 6's probe (Claude 10), taken: `rg -n "PR 802 .*wait for his yes|in progress \(JH 159" docs/ROADMAP.md`
    prints nothing after T6, and S5's line is proven from the pull requests' state, not from ticks.
  - Wording (Claude 7, 11, 12), taken: the Why sentence; the count is characters of the LF text over 4, as
    `estimateTokens` counts, so S0's byte figures compare approximately. L1's hours are the brief's; the stamps
    give 15:28 and 15:34 local.
  - `## State` first (Claude 13), rebutted in part: the plan's word is "head" and a resumed session reads the top;
    the roadmap's "a feature doc with `## Goal` is a contract" stays true. `CLAUDE.md`'s "in this order: the task
    contract; ..." reads true only if the head is part of what `contract template` prints: that phrase is his, and
    is told to the lead with the pull request.
  - Not guaranteed by either reader: that 5,000 is the right bound for a head, and how fast Decided will grow.

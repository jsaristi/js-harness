# F8 S6: the read surface

Locator: `odd/tasks/f8-s6-read-surface.md` · Branch: `feat/f8-s6-read-surface` · Session: JH 186
Delivery: chained pull requests of work-unit slices · Test runner: `node --test`

## State
- Done: this document and its depth pass (T1).
- Next: T2, the read-surface row of `check` and the roadmap's Next and Decided cut to it.
- Open: the relief finding of the depth pass (item 4) is told to the lead in a note; nothing waits on him.

## Goal
What a session reads to start is bounded and held by a check: the roadmap's Next and Decided at most 10k estimated
tokens, a feature document that opens on a short `## State` head the contract template gives and the resume hook
names, and an orchestrator's relief written one file a month, with the file the lead holds today left as it is.

## Why
A session starts from the roadmap and its feature document, and the lead from its relief file (`CLAUDE.md`, "How
sessions run"). All three grew with no bound: Next and Decided are 15.5k tokens today against 12.8k at S0, resume
sections run to a thousand lines (the roadmap's Later list), and the relief file is 1.72 MB, over the Read tool's
256 KB cap (the diet's appendix B measured 1.32 MB). F8's S6 is the cut of that surface; after it only S8 is left on
F8's path.

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
- [ ] T2 (kind: build) the read-surface measure and its row in `check`, test first; Next's settled paragraphs moved to `docs/roadmap-history.md` — S1, S5; inline
- [ ] T3 (kind: build) the `## State` head: the template, the resume titles, the hook's and the pause's wording, its bound in the row — S2, S4; inline
- [ ] T4 (kind: build) the relief by month, write-forward, with the undo proven in a test; an independent verifier — S3; inline
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

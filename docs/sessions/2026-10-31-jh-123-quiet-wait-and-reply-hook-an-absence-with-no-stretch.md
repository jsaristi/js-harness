# JH 123 · quiet --wait and reply --hook: an absence with no stretch is turned back

## Goal
The lead left no stretch open on either departure of 2026-10-31, and on his return the status report had no route
map and no estimate against actual. The work makes the duty act where every absence passes: the wait the lead starts
when he leaves, and his return. It also draws on the status page what he asked for. Opened from the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T11-38-41-752Z-e68fabfa.md`.

## The user's words
His decision, in the lead's wrap-up box (~11:45Z, after line 42109 of lead transcript `0f71b2c6`): "Sí, ábrela". His
complaint before it: "el como vamos le faltan varias cosas como el mapa de donde vamos, tambien de lo que estimabamos
avanzar y lo que realmente avanzamos osea faltan varias cosas". The rest is the lead's brief and its message with
the two blind readers' findings (feature document, specs 7 to 11, L10).

## Delivered
Branch `worktree-departure-stretch`, one pull request:
- `818b1eeb`: a free-text departure detector, dropped by `4d5e7605` (fitted to the messages it was measured on, so
  no error rates). What it kept: the stretch record's parser in `bin/lib/stretch.mjs`.
- `4d5e7605`: `js-harness quiet --wait` refuses (exit 4) while no stretch is open, unless `--no-stretch <reason>`.
  The reply hook turns the lead back once at a return after an absence no stretch covered, or whose stretch is
  still open (`returnStretchWarning`). `stretch-not-opened`'s control is now the return test, and row 45 of the
  lead's duties names both checks.
- `8be755d2`: the status page draws each plan step by step at the cut and now. A proposal's optional `estimate` is
  recorded by `--mark` and set beside what landed by the next report.
- `a4ecfc3c`, `23c028a5`, `718858fd`: the reviews' fixes (below).

## Decisions
- Recorded in L11: the detector leaves, as the lead's finding allowed without a labelled holdout.
- Recorded in L16 and spec 8: the hook writes no repository file, so the return warning asks the lead for the
  `stretch-not-opened` sighting instead of writing it.
- Recorded in L18: item 6 of the manifest's report is a rule's text (`bin/lib/rules-data.mjs:646`). Asking for the
  estimate there would be a `rules change`, so the estimate stays optional and the page says "sin estimación".
- Recorded in L18: `stretch open --draft` is not built. No plan builder exists, and it is written as the next task
  for the lead to place.

Reviews:
- Codex: `6bee9e5..8be755d` (one P2, fixed in `a4ecfc3c`, rechecked 0.99), `a4ecfc3..23c028a` (0.99),
  `23c028a..718858f` (0.97).
- Claude lenses: `6bee9e5..a4ecfc3` (one readability WARNING, fixed in `23c028a5`), `a4ecfc3..23c028a`,
  `23c028a..718858f`, all recorded.
- gentle-ai: lineage `review-aa2aa61811a5ac2d` over `13ce66dd..23c028a5`, four lenses captured. There was one
  CRITICAL from reliability and resilience each, the same no-roadmap exit, plus readability's two WARNINGs and two
  SUGGESTIONs, all fixed in `718858fd`. Its validation of the correction stopped at `manual_intervention_required`,
  so `23c028a5..718858fd` is not reviewed by gentle-ai; Codex and the lenses reviewed it.
- The independent verifier: "fails, on one defect" at `23c028a5`. It is the same defect, and the verifier ran the
  uncommitted fix and found it fixed it.

## Failures and lessons
- The first approach, a detector of his departure words, was the wrong root cause: the lead saw both departures and
  skipped the stretch for its hand-written plan. Two blind readers found it before the pull request; it cost one
  commit and one replay.
- The first gentle-ai reviewers, on the `review-*` agent types, returned nothing: those definitions carry
  `tools: []`, so they could not read their context file. The retry ran them as general-purpose readers.
- A correction's first gate failed on one convention test, a test comment naming the review tool under `bin/`
  (L24); read, reworded, passed.
- The plan steps were wired without the no-roadmap case: two readers and the verifier found it (L23).

## Left
- PR 739: its land and merge are the lead's; JH 124 lands after it.
- WSL not measured: the worktree guard refuses `wsl`. The second system is GitHub's Linux gate (L7), and the budget
  was measured on the detector's version there, not on 1b's. Windows with 1b: lead p90 905 ms of 2500.
- gentle-ai's validation of `718858fd` stopped at `manual_intervention_required`.
- JH 124 touches `bin/lib/rules-coverage-data.mjs` and the manifest, and lands after this branch.
- Next task, not built: `stretch open --draft`.

## Cost
Codex: five runs, about 311,000, 52,000, 50,000 and 60,000 input tokens (the last two estimated by their plans). Claude
lenses: three runs, 4, 1 and 3 lenses, about 210,000 input tokens. gentle-ai: four failed reviewers (about 14,000 to
121,000 tokens each) and four on opus (114,000 to 147,000 each). The verifier: about 130,000. Seven gate runs on
GitHub, one failed. The session was compacted once by the host.

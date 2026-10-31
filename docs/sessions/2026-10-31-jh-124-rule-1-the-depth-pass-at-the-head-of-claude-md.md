# JH 124 · rule 1: the depth pass at the head of CLAUDE.md

## Goal
Sebastián's rule number 1 of the harness: before large work is built, a depth pass. It has a text, a pointer at the
head of `CLAUDE.md` and a `check` control. Opened from the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T12-05-16-782Z-cf44cfd8.md`.

## The user's words
His four messages that asked for the rule are quoted in `odd/tasks/depth-pass-rule.md` (`## Specs` and L1). They are
in the lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, lines 42804, 42824, 42859 and 42878. His answers,
each read with `js-harness sessions --quote` at its line in the same transcript:
- 143 (43370, tapped): "Sí, v3, trabajo grande y cuando la pida (Recomendada)".
- 144 (43523, tapped): "Encabeza los principios y el 7 se queda (Recomendada)".
- 145 (43642), 146 (43701) and 147 (44098, tapped): the double review is one blind Claude review and one blind Codex
  review, on everything, unless he says no to a review, "también en el código chico".
- 148 (44186, tapped): "Claude reemplaza y Codex paga después (Recomendada)".

## Delivered
- PR 738 (open, ready notice 14:15Z), branch `rule/depth-pass`:
  - `1722be2d` slice 1: `rule:depth-pass`, section 9 of `js-harness-protocols`, the pointer in `CLAUDE.md`
    (3190 of 3200 tokens), and in the `init`/`sync` block. It is declared in `rules-data`, `docs/RULES.md` and
    `docs/rule-sources.json`.
  - `36439e1e` slice 2: the control in `check` and `contract check`, from `depthPassSince` (`harness.json`,
    2026-11-01). Its planted break turns "PR 737's order" red.
  - `b4479ee9`: section 9's plan is reviewed as `rule:double-review` says.
  - `f3b68fd2`: rule 1 heads the roadmap's principles. It adds F8 step 6 and the feature "Alignment to the depth
    pass", whose first item is the double review of 145 to 148, not built here.
  - `999d36ba`, `e2d46f3f`, `ff8c61aa`, `e972fecf`: fixes from Codex, the lenses and the verifier.
- `odd/tasks/depth-pass-rule.md`, the feature document, Log L1 to L25.

## Decisions
- His (above): the v3 text, for large work and whenever he asks. Rule 1 heads the principles and principle 7 stays.
  The double review goes to the alignment feature.
- This session decided, recorded in L23: the order is judged on the branch alone (`trunk..HEAD`). A document the
  branch does not touch is not judged again. Shallow clones and projects without git get no check.
- This session decided, recorded in L24: `bin/lib/depth-pass.mjs` is pure, and `bin/contract.mjs` reads the history.
- Left as it is, by design: "after its contract" is not checked. `sync` does not write `depthPassSince`, so a
  project opts in.

## Failures and lessons
- I edited the worktree while Codex reviewed it. Codex threw away one part, 171,251 input tokens. It was rerun once
  with nothing edited (L22).
- The first control judged the whole history. The verifier showed false reds on main, squash merges, renames and
  long histories on Windows. Judging the branch alone fixed all of them (L23).
- `codex-review` refused a second recheck while the first had left findings open. It asks for a follow-up task (T8)
  and one run with `--again`.

## Left
- The merge of PR 738 is the lead's land. After it, `js-harness rules` should print `depth-pass`; this is not
  checked yet.
- The redesign had no second independent verifier. Codex and the lenses read it twice.
- The eval of the rule is owed on 2026-11-30 (F8 step 6).
- The alignment feature, opened by the lead after this lands.

## Cost
- Context: the host compacted the session twice, the second time at 09:05 local after the pause notice.
- Codex: 5 runs, 622,270 input tokens:
  - 171,251, voided by my edit;
  - 121,917 + 141,599 over `b5bf748..c1e482b`;
  - 83,923 for the recheck;
  - 103,580 with `--again` over `e2d46f3..e972fec`, "correct (0.87)".
- Claude lenses: one run over each code range. Every finding was taken: the shallow clone, a verdict already on the
  trunk, and two from readability. The last run, over `ff8c61a..e972fec`, found nothing. The exact count of runs
  is in `lens-reviews.jsonl`; this summary does not count them.
- An independent verifier: about 86k tokens. No blocker; six findings, all taken.
- Gate runs: one pre-commit gate per commit and one pre-push gate, all PASS.

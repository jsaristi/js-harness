# JH 128 · re-planning analysis: start again vs how we have been going

## Goal
An analysis he asked for: how the project has been going, how it would start again today, the two side by side, and
a recommendation (keep, adjust or restart) with its first three steps. Opened by the lead's brief
`~/.js-harness/background/briefs/2026-11-01T18-11-45-962Z-17079eac.md`; feature document
`odd/tasks/replan-analysis.md`. Read-only on source; documents only.

## The user's words
- Lead transcript `0f71b2c6`, line 47737, 2026-11-01T18:11Z (13:11 local), typed: "excelente hazme un analisis
  completo de como deberiamos empezar de nuevo y alinear todo y me lo contrastas y comparas de como veniamos, osea como
  hacer un reajuste del plan por si depronto lo estabamos haciendo mal" (read in the transcript file, this session).

## Delivered
- `odd/tasks/replan-analysis.md` on branch `worktree-replan-analysis`, pushed: 27977325 (draft), bca5d0d6 (rewritten
  after the double review), ffff80fc (page published, document closed). No pull request: the brief asked for the
  analysis on the branch, and the lead decides whether it lands.
- The Spanish visual page: https://claude.ai/artifact/1EPj6FTbsB6C6n9aAT5iyJ (private; marked `free` for the template
  gate, since no command renders an analysis).
- Result: adjust F8, do not restart. F8's direction is measured to work (first-turn load 107.8k → 76,614 tokens,
  `js-harness check --verbose`; every step at its "no worse" line); what fails is growth (`progress --pace`: 488
  closed, 539 added in 14 days; two limits that did not hold, `docs/ROADMAP.md:75`, `:831-841`, `:767-775`) and the
  lack of an outside outcome (94-97% of transcripts on js-harness; his projects moved at S12, nothing built in them).
  First steps: his decision on a growth limit, his choice of one real feature in one of his projects, then S2 as
  planned.

## Decisions
- Two Claude readers, not Claude and Codex, for `rule:double-review`: the rule in force asks for two readers that did
  not write it, Codex cannot review a plan yet (JH 126), and the weekly limit is at 84% (this session).
- "One session at a time" dropped from the recommendation: its evidence (a keyword share of failures) did not hold
  under the claims reader (this session; feature document L5).
- Every change to one of his decisions listed in the document's E3; none taken (his).

## Failures and lessons
- The first draft's refutation read the incident set's "no worse" pass as a failure and its main causal claim rested
  on a broad keyword list; found by the blind claims reader (5 of 10); fixed in bca5d0d6. The double review earned its
  cost here: both readers' top findings changed the recommendation.
- The first draft proposed a freeze already tried twice; found by the missing-things reader; the analysis now names
  both tries and why they did not hold.
- `js-harness throughput --since 2026-10-13 --until 2026-11-01` printed nothing within 300 s; not run again; the
  document says its waits are measured for one day.

## Left
- His two decisions (the growth limit; the real feature), and every row of E3: the lead asks them, one at a time.
- Whether the branch lands on main: the lead.

## Cost
- Time: brief 18:11Z; first notice 18:25Z; closed about 19:10Z.
- Reviews: gentle-ai on 27977325, approved low risk with no lenses (lineage review-ca6182a2bbc23a8c); two blind Claude
  readers, about 111k and 128k tokens; no Codex run; no Claude lens run (no code).
- Gates: three pre-commit `check` runs on documents, each PASS.

# JH 129 · carry out the re-plan: adjust F8, the growth limit first

File: docs/sessions/2026-11-01-jh-129-carry-out-the-re-plan-adjust-f8-the-growth-limit-firs.md.

## Goal
Carry out JH 128's recommendation (`odd/tasks/replan-analysis.md`, E: adjust F8, do not restart) and its first three
steps, from the brief `C:\Users\Oficina\.js-harness\background\briefs\2026-11-01T18-44-46-947Z-48d46b55.md`.

## The user's words
"Listo entonces continuemos y reactives todo para hacer le plan" (the lead's transcript
`0f71b2c6-cbce-43ca-a031-276a4b2c381f`, line 48080, 2026-11-01T18:44:12Z, `js-harness sessions --quote`), answering
the lead's question at line 48066: "¿adoptas el ajuste, es decir, seguir con F8 y poner el límite al crecimiento?"

## Delivered
- Pull request jsaristi/js-harness#743, ready (notice of 2026-11-01T19:30:18Z), not merged. Branch `rule/growth-limit`.
- 234f0f75 docs: the roadmap's first record and `odd/tasks/replan-execute.md` (contract, depth pass).
- 2b182296 feat(rules): `rule:growth-limit` (his, scope `repository`, value "a fix or a step of F8", review
  2026-11-15), the week's line in `progress --pace`, the lead's routing line in `bin/lib/manifest.mjs`, its controls
  in `bin/lib/rules-coverage-data.mjs`.
- dad80c75 docs: the Decided row cites the rule; the Later list reused; the outside feature as an F8 step; the E3
  rows in Next; the review's answers in the Log.
- 28c0a708 fix(progress): the exemption shown when the running and project rules lists differ (Codex P2).
- JH 128's analysis (a179007a, documents only) lands with the pull request.
- Question 151 recorded for the lead (2026-11-01T18:57:16Z): which project for the outside feature. He answered
  plataforma-preproyecto (2026-11-01T19:12:54Z, the lead's transcript, line 48234), recorded in the roadmap.

## Decisions
- His: the adjustment and the growth limit (line 48080), recorded in `docs/rule-sources.json` and `docs/ROADMAP.md`.
- This session's, his to correct: the week counts open steps before and after each commit, not added against closed
  (said in the rule's reading); one pull request instead of a docs PR first (L8); the rule's home in this repository,
  not in the protocols skill (L6).
- Not decided, his: the E3 rows listed in Next; the feature in plataforma-preproyecto; S2's start and removals.

## Failures and lessons
- The first rule design (a line in the protocols skill, counting added against closed) scored 4 and 5 of 10 in the
  double review: wrong home (shipped to every project, read after the lead opens a session) and a measure that read
  rewordings as new work. Found by the two blind readers before any code; changed before the rule landed.
- A feature document that named the rule before it was declared failed `rules check` at the first commit; fixed by
  writing no `rule:` mark before the declaration.
- `manifest.mjs` sits at its line ceiling; the routing clause was joined to an existing line.

## Left
- Landing PR 743: the lead.
- The feature in plataforma-preproyecto: his choice, through the lead; that feature's session after his answer.
- S2: its own session, after JH 126 lands (note of 2026-11-01T19:30:33Z).
- The E3 rows: the lead asks each, one at a time.
- The 2026-11-08 reading of the week's line, and the rule's review on 2026-11-15: the lead.
- A gentle-ai review of the slice a179007a..28c0a708 was not run: its stop hook offered the whole branch, whose
  status was read and nothing started, as `CLAUDE.md` says.

## Cost
- Time: brief 2026-11-01T18:44Z; last notice 2026-11-01T19:30Z.
- Context: 87% at the peak; the host compacted the session at 14:32 local, after the pull request.
- Reviews: two blind Claude readers (122k and 101k tokens); Codex twice (234f0f7..dad80c7 incorrect P2; dad80c7..28c0a70
  correct), weekly meter 85% before them; Claude lenses twice (reliability and readability, 0 findings; reliability,
  0 findings).
- Gates: four commit gates, two on GitHub's machines (one red, the coverage control, fixed).

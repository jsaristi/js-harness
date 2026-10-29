# JH 78 · F8 S5c-a: the paid runs P1-P4

## Goal
Run S5c-a's paid runs P1 to P4 as `odd/tasks/f8-s5c-a-coverage.md` section "Paid runs" writes them, write each new
case's proof record, and score the incident set against S0's baseline. Opening: the lead's brief
`~/.js-harness/background/briefs/2026-10-28T23-02-25-821Z-5d75a345.md`.

## The user's words
- "Sí, córrelas" (lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, line 11986, as the brief quotes it), to
  "¿Autorizas las corridas pagadas de S5c-a (P1–P4, unos $15,70–18,20)?": 28 trials, cap $18.20 (Log L13).
- "cuando me dices ese gasto es dentro de nuestra misma suscripcion cierto? si es asi, aprobado y hazlo" (same
  transcript, line 13125, question 105, verified in the channel record): a fresh P4, cap raised to $19 (Log L16).

## Delivered
- Branch `f8-s5c-a-paid`, its pull request ready for the lead's land:
  - `f1e0e8ea` docs(odd): his yes, L13.
  - `2507ab54` chore(evals): P1-P3's results (`evals/results/f8-s5c-a-rules-current.json`) and both proof records
    (`evals/proofs/rules/rule-reuse-first.json`, `rule-away-autonomy.json`), L14.
  - `384e4781` docs(odd): P4's first run stopped at 3 of 20 and its refused continuation, L15.
  - The last commit: P4's fresh run (`evals/results/f8-s5c-a-incidents-2.json`), L16, the S5c-a line of
    `docs/ROADMAP.md` and this summary.
- Results: neither new case tells its rule apart (`rule-reuse-first` 1.0 on both arms, `rule-away-autonomy` 0.6 on
  both; `rule-proof.mjs` exit 1), so both stay owed in `bin/lib/rules-coverage-data.mjs` `cases`, unchanged. The
  incident set is no worse: `node evals/incident-score.mjs f8-s0-a-incidents f8-s5c-a-incidents-2` prints "13 of
  20; false premise 2 of 4" for both runs and "a step is worse below 10".

## Decisions
- This session: P2 and P3 continue P1's run with `--configs current,<arm>`, because the table's command is refused
  by `evals/suite.mjs:218` (an arm runs beside its base); `--plan` showed the same 2 trials each (L14).
- This session: no case dropped from the register's `cases`; the brief allows dropping proven cases only (L14).
- This session: P4's fresh run not started on the first refusal, since the table's estimate put it over the $18.20
  cap and past the 28 trials (L15).
- The lead: hold P4 while a land ran its local suite, then "land done"; question 105 to him (L16).
- His: the fresh P4 under the cap of $19, on the condition of his subscription, checked (L16).

## Failures and lessons
- P4's first run was killed by Claude Code's low-memory reaper after 3 trials while another session's land ran a
  local suite; the continuation was then refused because the real home's `.claude/plugins` changed (setup
  `ef252975c64d` to `7a4aa36f5d19`). Cost: $1.36 recorded and two trials cut in flight, unrecorded. The lead now
  holds local suites while a paid run runs (L16).
- The table of "Paid runs" wrote P2 and P3 as arms alone, which the suite refuses: found by reading `--plan` first,
  before any spend. The table now writes the commands that ran.
- The first commit carried a `Co-Authored-By` line that `CLAUDE.md` forbids; amended before any push (`f1e0e8ea`).
- `evals/proofs/**` is not marked `-codex-review` in `.gitattributes`, so a commit of proof records needs both
  reviews before a push; Codex and the reliability lens ran on `2507ab54` (L15). Marking it is outside this brief.

## Left
- Harder premises for `rule-reuse-first` and `rule-away-autonomy`, then their reruns: a later S5c session.
- The 13 to 23 cases T6 did not write; `init`'s baseline line (JH 68, L5).
- Whether `evals/proofs/**` gets `-codex-review`: the lead's to route.

## Cost
- Evals: $16.23 recorded of the $19 cap (P1 $2.36, P2 $0.94, P3 $1.19, P4 $10.38, P4's stopped first run $1.36);
  two trials cut in flight are not in it. API equivalent, drawn on his Max plan.
- Reviews: Codex on `f1e0e8e..2507ab5`, 118,383 input tokens, "the patch is correct" (0.99); the reliability lens,
  0 findings, 9,541 input tokens. gentle-ai: no review ran; the Stop hook offered the whole branch, of records and
  documents only, and only its read-only status ran.
- Time: first notice 18:44, the last before this summary 20:40 local (2026-10-28); context about 35% at the end.

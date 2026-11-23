# F8 S8: the eval home's Codex login, for his decision

One page for one decision (JH 301, 2026-11-22, the lead's unit 5). Nothing here ran or changed. Marks: [c] checked
with the file or command named; [a] assumed; [?] not known.

## What it unblocks
In S8's long session, run `current-2` held its release on a Codex review it could not get, because the eval home has
no Codex login, and never wrote `src/stats.mjs`; its moments counted as misses (`odd/tasks/f8-s8-certification.md`,
`## Result`, the paragraph after the table) [c]. A rerun without an answer here can repeat that miss in any `current`
run. It bears on four rows, C1.2, C1.3, C1.5 and C2.4, about $70 of the $85 the rerun's core is priced at
(`rerun-pricing.md`, this folder) [c].

## Why there is no login today
By design. The trial home refuses any credentials file, Claude's `.credentials.json` and Codex's `auth.json` alike
(`evals/home.mjs:58-63`, the refusal at `:391`), since a copied Claude credentials file once rotated his refresh token
and killed his real login (`odd/tasks/f8-s0-baseline.md:36-37`). C4.4 of S8 is that guard (`node --test
evals/home.test.mjs`) [c]. The Codex-agent evals are the one place a login is copied: `evals/codex-home.mjs:6-8` copies
his real `auth.json` byte for byte into each trial's own `CODEX_HOME`, after `assertLoginFresh` checks it has 12 hours
left (`:45`); whether a refresh made inside a copy leaves the real login invalid is "UNVERIFIED still" there (`:98-100`)
[c].

## The three ways

| | A. Copy his Codex login into each run | B. A login of its own for evals | C. No login: the fixture declares the review off |
|---|---|---|---|
| What it writes | a copy of `~/.codex/auth.json` in each run's scratch `CODEX_HOME`, deleted with the run | one folder, for example `~/.js-harness/eval-codex-home`, holding a second `auth.json` he makes with `codex login` under that `CODEX_HOME`; copied into each run | `harness.json` with `"codexReview": "off"` in `evals/long-session/fixture/` (the switch, `bin/lib/functions.mjs:19`; with no `harness.json` it falls back to `auto`, `:10`), in this repository only |
| Code it needs | the long session's home learns the Codex copy, and the guard of `evals/home.mjs` lets that one file through: security, high risk, both reviews | the same as A | none outside the fixture; the fixture is eval code, so both reviews |
| His part | nothing beyond the yes | the device sign-in, typed by him | nothing beyond the yes |
| Risk | a refresh inside a copy may invalidate his real Codex login [?] | whether two logins of one account live side by side [?]; a second credential to keep | the arm no longer exercises the Codex review path [a]; none of the long session's five moments is the review (`rule`, `spanish`, `premise`, `tdd`, `compact`, `evals/long-session/grade.mjs:17`) [c] |
| Codex spend | each `current` run's reviews on his weekly limit, about 0.3M input tokens a review at the floor (`rule:codex-review-floor`) [i], so a few points a batch | the same as A | none |
| Undo | delete nothing extra (copies go with each run); revert the code | delete the folder; revert the code | revert one file |

## Recommended: C
It answers the miss without a credential, without touching the guard C4.4 holds and without Codex spend, and the
moments the long session grades do not depend on the review. What a yes to C covers: one fixture file declaring the
review off, through both reviews, before the rerun. What it does not cover: any credential, any change to
`evals/home.mjs`, or the rerun's spend (`rerun-pricing.md`). That the fixture's agent then routes its release through
the Claude lens instead, as his answer to question 104 set for a project with the Codex review off (`docs/ROADMAP.md:162`), is assumed [a]
and is checked before the batch by the long session's calibration script (`run.mjs --calibrate`), priced by its
`--plan` first: a model call, not free.

The other option, if he wants the Codex path inside the measure: A, after a verify step proving a refresh inside a
copy leaves his real login valid.

His yes in one line: "Sí, opción C: el fixture de la sesión larga declara la revisión de Codex apagada".

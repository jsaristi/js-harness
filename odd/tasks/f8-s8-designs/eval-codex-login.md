# F8 S8: the eval home's Codex login, for his decision

One page for one decision (JH 301, 2026-11-22, the lead's unit 5). Nothing here ran or changed. Marks: [c] checked
with the file or command named; [a] assumed; [?] not known.

## What it unblocks
In S8's long session, run `current-2` held its release on a Codex review it could not get, because the eval home has
no Codex login, and never wrote `src/stats.mjs`; its moments counted as misses (`odd/tasks/f8-s8-certification.md`,
`## Result`, the paragraph after the table) [c]. That paragraph also says neither run's miss is cleanly the arm's.
A rerun without an answer here can repeat that miss in any `current` run. It bears on four rows, C1.2, C1.3, C1.5 and
C2.4, about $70 of the $85 the rerun's core is priced at (`rerun-pricing.md`, this folder) [c].

## Why there is no login today
By design. The trial home refuses any credentials file, Claude's `.credentials.json` and Codex's `auth.json` alike
(`evals/home.mjs:58-63`, the refusal at `:391`), since a copied Claude credentials file once rotated his refresh token
and killed his real login (`odd/tasks/f8-s0-baseline.md:36-37`). C4.4 of S8 is that guard (`node --test
evals/home.test.mjs`) [c]. The Codex-agent evals do copy a login: `evals/codex-home.mjs:6-8` copies his real
`auth.json` byte for byte into each trial's own `CODEX_HOME`, after `assertLoginFresh` checks it has 12 hours left
(`:45`); whether a refresh made inside a copy leaves the real login invalid is "UNVERIFIED still" there (`:98-100`)
[c]. How those trials pass the refusal at `home.mjs:391` was not read [?].

## The four ways

| | A. Copy his Codex login into each run | B. A login of its own for evals | C. The fixture declares the review off | D. Leave it as it is |
|---|---|---|---|---|
| What it writes | a copy of `~/.codex/auth.json` in each run's scratch `CODEX_HOME`, gone with the run | one folder, for example `~/.js-harness/eval-codex-home`, with a second `auth.json` he makes by `codex login` under that `CODEX_HOME`; copied into each run | `harness.json` with `"codexReview": "off"` in `evals/long-session/fixture/` (the switch, `bin/lib/functions.mjs:19`; with no `harness.json` it is `auto`, `:10`) | nothing |
| Code it needs | the long session's home learns the copy the Codex arms already make; whether the guard of `home.mjs` must change for it is not known [?] (if it must: security, high risk) | as A | one fixture file, eval code, both reviews; whether the `current` arm's `prepare` (`evals/long-session/run.mjs:177`) writes its own `harness.json` over the fixture's was not read [?] | none |
| His part | the yes | the yes and the device sign-in, typed by him | the yes | the yes |
| Risk | a refresh inside a copy may invalidate his real Codex login [?] | whether two logins of one account live side by side [?]; a second credential to keep | the release may then wait on the Claude lens record instead, since with the Codex review off the merge door asks for it (his answer to question 104, `docs/ROADMAP.md:162`): a Claude lens review inside the trial, its cost and whether it can start in the eval home not known [?] | the miss can recur; how often is the arm's behaviour, since a review that cannot run is to be recorded as a skip with `--unavailable` (`CLAUDE.md`, "Running what costs, and review") and current-2 did not |
| Spend | each `current` run's reviews on his Codex week, about 0.3M input tokens a review at the floor (`rule:codex-review-floor`) [i] | as A | none on Codex; a lens review per release inside the run, list cost not priced [?], against the $12 run cap | none |
| Undo | revert the code | delete the folder; revert the code | revert one file | — |

None of the long session's five moments is the review itself (`rule`, `spanish`, `premise`, `tdd`, `compact`,
`evals/long-session/grade.mjs:17`) [c], so any of A to C measures the same moments; they differ in what the run must
get through to reach them.

## Recommendation: C, after two reads
C is the only way with no credential and no change near the guard C4.4 holds. It rests on two things not read: that
the fixture's `harness.json` reaches the run unchanged, and what the release then waits on and costs (the lens
record). Both are code reads, free, one short unit before he answers. If the lens record would hold the release
the same way, D with its recurrence named is the honest fallback, and A only after a verify step proving a refresh
inside a copy leaves his real login valid. The long session's calibration script does not reach the release
(`evals/long-session/script.mjs:79-82`: its first three turns, the compaction and the resume), so it cannot check C.

His yes in one line, once the two reads hold: "Sí, opción C: el fixture de la sesión larga declara la revisión de
Codex apagada".

## Log
- L1 (2026-11-22, the lead to JH 301, as written): "The eval home's Codex login: one page stating what it writes, its
  undo and what it unblocks (S8 long-session rows), for his decision."
- L2: an advisor read of the first draft found C's lens-record hold, the missing "leave it" option and three claims
  not read; each is now marked or added.

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

## The two reads (JH 301, 2026-11-22, read-only, on `origin/main` after PR 1004)
1. **Does a fixture `harness.json` reach the run? Yes, and it costs the arm its project layer.** The `current` arm
   builds its workspace with `js-harness init` (`evals/home.mjs:456-475`, `initWorkspace`). `initProject` checks for
   a `harness.json` first and, when one is there, takes the already-initialized path
   (`bin/lib/project.mjs:1032-1034`), which with no manifest returns "exit 0, nothing written"
   (`bin/lib/project.mjs:946-953` and `:993`). So a `harness.json` committed in the fixture would keep `init` from
   writing `AGENTS.md`, the pre-commit gate and the clone's settings: the `current` arm would no longer be the
   harness. C as written breaks the arm [c].
2. **With the Codex review off, what does a release wait on?** The Codex row asks for nothing: "the Codex review is
   off at the pushed commit ..., so no record is asked for" (`bin/lib/codex-review-rows.mjs:276-281`) [c]. The lens
   review stays on unless `lensReview` is off too (`bin/lib/functions.mjs:21`), and the push and the merge door ask
   for its record (question 104, `docs/ROADMAP.md:162`) [c]. Whether the agent inside the trial can run
   `js-harness lens-review`, a Claude run nested in the trial, and at what list cost, was not read [?].

## Recommendation: C', the switch written after `init`
The only way left with no credential and no change near the guard C4.4 holds: the long session's `current` arm runs
`init` as now, then sets `"functions": {"codexReview": "off"}` in the `harness.json` that `init` wrote, before the
first turn. That is a change to eval code (`evals/long-session/run.mjs` or the arm's seed), so a build with its test
and both reviews, after Codex's reset. It removes the Codex hold; the release still asks for a lens record, so the
build's first check is one run whose release turn is read for a lens-review hold, priced by `--plan` first. If the
lens record holds the release the same way, D with its recurrence named is the fallback, and A only after a verify
step proving a refresh inside a copy leaves his real login valid. The calibration script cannot check any of this:
it does not reach the release (`evals/long-session/script.mjs:79-82`).

His yes in one line: "Sí, opción C': la sesión larga apaga la revisión de Codex en el harness.json que escribe init,
con su prueba y sus dos revisiones".

## Log
- L1 (2026-11-22, the lead to JH 301, as written): "The eval home's Codex login: one page stating what it writes, its
  undo and what it unblocks (S8 long-session rows), for his decision."
- L2: an advisor read of the first draft found C's lens-record hold, the missing "leave it" option and three claims
  not read; each is now marked or added.
- L3 (2026-11-22, the lead to JH 301): "The login page's two free code reads, as you suggest, read-only, folded into
  that page". Done under "The two reads": the first refutes C as written (a fixture `harness.json` stops `init`
  writing the arm's project layer), so the recommendation becomes C', the switch written after `init`.
- L4 (2026-11-22, the lead to JH 302, as written): "the C' build as a draft (odd/tasks/f8-s8-designs/eval-codex-login.md,
  "Recommendation: C'"): the long session's current arm writes "functions": {"codexReview": "off"} into the harness.json
  init wrote, before the first turn; test first, lenses, Codex skip recorded; nothing paid, no eval run." Built as
  `codexReviewOff` in `evals/long-session/run.mjs`, in a draft pull request; his yes and the priced run that reads the
  release turn for a lens-review hold are both still owed. Not read: whether the fixture's first commit, which holds no
  `harness.json`, counts at the release as a commit made with the review on (`madeWithReviewOn`,
  `bin/lib/codex-review-rows.mjs:295`); that run shows it.

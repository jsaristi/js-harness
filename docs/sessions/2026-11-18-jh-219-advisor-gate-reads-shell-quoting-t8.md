# JH 219 · advisor gate reads shell quoting (T8)

File: docs/sessions/2026-11-18-jh-219-advisor-gate-reads-shell-quoting-t8.md.

## Goal
T8 of `odd/tasks/advisor-use.md`, item `tokenizer` of the plan of 2026-11-18: the advisor gate reads a Bash command as bash reads it, so a heredoc, an `echo` or a comment that names an act is not that act, and no act the shell runs is missed (L34 the probe). Opened by the lead JH ORQ; opening: `js-harness sessions --opening 'JH 219 · advisor gate reads shell quoting (T8)'`.

## The user's words
- Question 349 (JH PLAN, f5c3ee4d-2c09-416a-addb-ea2b5e6c3e8d line 3884, read with `js-harness sessions --quote`): "A: aterrizar con los 23 anotados (Recomendada)".
- Question 356 (same transcript, line 4851, 2026-11-19T02:52:58Z, tapped): "B: reconstruir el lector".

## Delivered
- Slice 1, branch `claude/advisor-gate-shell-read`, head 72d1a497 on origin/main 7bb1753d: `bin/lib/shell-read.mjs`, a one-pass bash reader, and its test (ffe98caa to 72d1a497). Pushed with this file; no pull request (it lands with the rebuild, L48).
- Slice 2, branch `claude/advisor-gate-reads-shell`, head 10af66dc on slice 1, local only: the depth pass (7c66b2a0), `bin/advisor-gate.mjs` reading through the reader, 22 commands pinned as Unguaranteed (`UNGUARANTEED` in `bin/advisor-gate.test.mjs`), the git rules of L45 to L50. Not pushed: it lands with the rebuild in one batch.
- The feature document's Log L36 to L50, the Unguaranteed section and T10.
- Checks at 10af66dc: `node --test bin/advisor-gate.test.mjs` 46 pass; `bin/lib/shell-read.test.mjs` 6 pass. Against main's gate (origin/main, byte-identical copy) on the four probe sets under Git bash 5.3.9: no miss main's reading lacks but the 22 pinned. Corpus of 59,299 commands: 58,974 the same, 140 main refused and this lets through, 172 newly gated.

## Decisions
- His answer A to question 349: land with the 23 (22 since `git config` left the inert list, L43) pinned as they read today; no other loosening (L42).
- His answer B to question 356: rebuild the reader for the 14 findings Codex left open after three reviews; the rebuild passes to a senior session that JH PLAN starts from slice 2's head (T10, L48).
- The lead: Codex runs under question 346 (stop at 60% of the week); slice 2's Codex review is not run here, it is reviewed with the rebuild (L48).
- This session, with the advisor: forms the reader cannot read exactly are said `broken` and read loosely, not parsed (L43); the git-runs-a-program class is one rule on what writes and what runs, not path spellings (L47), joined with the git-files check (L49, L50).

## Failures and lessons
- Codex on slice 1 (7bb1753..92695d2): "incorrect", 22 findings; triage by direction found 5 misses main caught, fixed (L43). Two rechecks: 8, then 1 more fixed; 14 left open after three reviews (L44), now T10.
- The lenses on slice 2 found new ways main refused and this let through in each of four rounds (L45 to L50): git's files and options, a quoted-newline join that let `--dry-run` hide an act (my own regression, L47), `>&word`. Lesson: a rule keyed on how a path is spelled does not converge; key it on what runs.
- A flaky differential run (bash's 5 s timeout under load) showed a miss that did not reproduce alone (L43's check, 0 of 6).
- An edit through a script failed on escapes; the Edit tool was used after.

## Left
- T10, the reader's rebuild, and slice 2's review with it: the senior session JH PLAN starts from `claude/advisor-gate-reads-shell` at 10af66dc (JH PLAN's miniplan-004-rebuild-shell-reader.md).
- The lenses' correction on 888a359b (`>&word`, fixed in 10af66dc) is not rechecked; `check` lists it. Two lens findings marked blocking are refusals (L49, L50), left to the rebuild.
- Slice 2 has no Codex review record: the `--again` run (5de5d59..89e78f3) was cut by Codex's usage limit (L47).
- Follow-ups for the lead: `shellWords` reads `$((1<<X))` as a heredoc in `bin/guard.mjs`; F9 closes with T8.

## Cost
- First notice 2026-11-18 (opening), last 2026-11-19 ~03:30Z; the host compacted the session twice; context near its window at the end.
- Codex: slice 1 7bb1753..92695d2 about 2.05M input tokens; recheck 92695d2..e215519 0.56M; second recheck e215519..72d1a49 0.21M; the cut `--again` run about 4.10M. Lenses (risk, reliability): slice 1 three runs, slice 2 eight runs. Two verifier rounds (sub-agents). No gate run.

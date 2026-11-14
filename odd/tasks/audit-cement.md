# Cement the directives audit's corrections (JH 198)

Branch: worktree-audit-cement (the document), then one branch per slice from origin/main, landed in order.
Delivery: ask-on-risk. Tests: `node --test`. Opened 2026-11-13 by JH 198 (Opus 5.5, medium) from the lead's brief.

## State
The lead's OK is in (L3). T1 done: PR 863, ready, waiting for the land and the copy refresh. T2 in progress on
`fix/audit-cement-guard`. Next: T3 to T6, then T8; T7 waits for the lead's word that JH 196 landed.

## Goal
Every correction the audit and its two blind reviews found is fixed where a check can hold it, and each of the
day's failures is written in `docs/FAILURES.md`, so the same lapse is refused or recorded rather than remembered.

## Why
His words, 2026-11-13T20:59:59Z (lead transcript 69918425 line 2679, typed): "Ok implementa todas las correciones
y cementalas en el harness para que esto nunca jamas vuelva a suceder". The audit (JH SR, 2026-11-13) found nine
lessons of that day living only in the relief file; a lesson in prose repeats (the `printf` date three times, the
`cd` twice), so each one gets a check where a command can hold it.

## Done when
- `node --test bin/lib/guard.test.mjs bin/lib/stall.test.mjs bin/wait.test.mjs bin/lib/background-close.test.mjs bin/sessions-background.test.mjs` exits 0
- `js-harness rules check` exits 0
- `npm run check` exits 0
- A sub-agent launched with `model: "opus"` after S1 lands passes the guard and runs on `claude-opus-5-5` (its
  transcript's model id).
- `docs/FAILURES.md` holds the four `- Seen: 2026-11-13` lines of spec 8.

## In scope / Out of scope
- In: specs 1-8 below, on the brief's surfaces.
- Out (the lead asks him, one at a time): question 282's advisor hook and its rows (JH 196); the double-review
  field in `checkedQuestion` (P6, JH 196); deleting remote branches (A18); Remote Control rows (A3b); the
  daily-questions rule (A15); turning off auto-archive; C1 as a rule; question 281.

## Constraints
- Not `bin/lib/manifest.mjs` until the lead says JH 196's hook change landed — because JH 196 edits it now.
- Not `bin/advisor-gate*.mjs` — JH 196's files.
- Guards, rule changes and the worktree removal are high risk: each slice gets an independent verifier, Codex and
  the lenses.
- Sub-agents pass an explicit model; until S1 lands the guard refuses every short name but none is needed, so no
  sub-agent is launched before S1 (the verifiers come after it).
- Growth-limit is red: fixes only, no new module; shared logic goes into an existing one.
- Never `cd` into another session's worktree; other branches are read with `git show`.

## Ask me before
Nothing beyond the lead's OK on this document and on the five points below; anything of his goes to the lead as a
`waiting` notice.

## For the lead's OK
1. **A9, "another live session's worktree".** A hook cannot list the app's sessions, and an app session's folder
   is in no harness record. Proposed: the Bash guard refuses `cd`/`Set-Location`/`pushd` into any linked worktree of
   the repository other than the session's own (a superset of "live"); the reason names `git show <branch>:<path>`
   and `git -C` for reading. Say if you want "live" only (then the record and the channel's `worktree` field decide,
   and an app session's folder passes).
2. **C4 has no named surface.** No command owns the board's `yours`: the lead writes `board/summary` with
   `ArtifactData`, and the template gate's after-call hook records only its field names
   (`bin/template.mjs:205-228`, `bin/lib/template-record.mjs:114`). The check needs `bin/lib/template-gate.mjs` and
   `bin/lib/template-record.mjs` (and their tests): record the `yours` items of each write, and refuse a write that
   drops one without a `yoursDropped: [{ item, reason }]` entry. Clear those two files, or drop C4 to a line.
3. **Protocols §1 and §7 live in `bin/lib/protocols-skill.mjs`**, not `manifest.mjs`: not blocked by JH 196, not
   named in the brief. Clear it for specs 5 (§1) and 7 (§7). §7 ships to projects, where `js-harness throughput` does
   not exist either: it will say the throughput table is this repository's workshop command, as `CLAUDE.md` will.
4. **The "no advisor" texts** (`bin/lib/guard.mjs:109,115`, `bin/guard.mjs:168`, `bin/lib/home-sessions.mjs:51`).
   Line 115 is a refusal, not prose: `sessions start` refuses `--advisor` for a senior. The senior still had the
   advisor tool, which comes from his settings' `advisorModel`, not from the start. Proposed: keep the refusal,
   reword the four texts to "starts with no advisor named; his settings' advisorModel still gives it one". The audit's
   D6 lists this as JH 196's P4a: confirm it is mine.
5. **PR layout.** Sequential PRs off main in the order of Tasks, each updating this document's State and Log, so two
   open PRs never edit the same lines. S7 waits for JH 196.

## Corrected verdict table
The audit's 77 rows (30 applied, 32 written only, 15 volatile) after both blind reviews (relief file, 2026-11-13
15:56 and 16:03 local). Rows not listed keep the audit's verdict. Spot-checked here: `odd/tasks/senior-orchestrator.md:116,125`
(D3, D5), `docs/proposals/claude-app-native-sessions.md:81-82`, `.githooks/commit-msg` and `.githooks/pre-push` exist.

| Row | Audit | Corrected | Evidence |
|---|---|---|---|
| "84 % owed" | unenforced behaviour | coverage-registration debt: obligations with no control registered, not behaviour shown unenforced | `bin/lib/rules-coverage.mjs:313` (Codex 1) |
| A2a, A3a, A11, A13 | own rows | duplicates of B34/B35, B37, B11, B15: counted once | Claude review |
| A2b | volatile | written only (senior long-lived, and when the lead sends it work) | `odd/tasks/senior-orchestrator.md:3,116,125`; `bin/lib/sessions.mjs:3079`; `bin/sessions-background.mjs:163-175` |
| A3a vs B37 | applied / written only | contradict: the close is applied (`sessions stop --finished`, the land), archiving in the app is prose. Both stay, A3a folded into B37 as "partly applied" | both reviews |
| A4 | volatile | written only: archive-on-merge is documented | `docs/proposals/claude-app-native-sessions.md:81-82,419-425` |
| A5 | volatile | volatile, with a correction: `background-close.mjs:153` already keeps a worktree another recorded session holds; the 2026-11-13 incident was the app's `archive_session`, which the harness cannot intercept | Codex 2 |
| A6 | applied | applied (a real check) | `bin/merge-queue-refresh.mjs:203-205` |
| B5, B6, B7 | applied | written only: the allowance is read only by the optional `codex-review --plan` | Codex 3 |
| B12 | applied | written only: the fixed-load row of `check` is informational | Claude review |
| B13 | applied | written only, with a checked indicator: the restriction is prose (`bin/lib/manifest.mjs:166`) | Codex 4 |
| B24 | applied | written only: `host-update` only words it | Codex 5 |
| B36 | applied | applied, mostly not followed (1 of 7 sessions) | Claude review |
| B40 | applied | partly: the guard does not check the next free number | Codex 6 |
| C1 | volatile | volatile; "Sí, dos a la vez" was typed (f0959bbd:1477) and was a temporary cap (question 262) until medium sessions and Fable's pace were measured: it may have lapsed | Codex 10, Claude review |
| C11 | volatile | written only, eval-scoped | `docs/sessions/` JH 82 line 12 (Codex 8) |
| (omitted) | — | applied: the commit-msg hook strips host attribution | `.githooks/commit-msg` |
| (omitted) | — | applied: the pre-push hook refuses code commits no review covers | `.githooks/pre-push` |

Totals, recomputed by this document (the B rows not re-run): 75 distinct rows, **23 applied, 40 written only, 12
volatile**. The audit's subtotals 46 = 25/21 hold as counts of the rules registry before these reclassifications.

## Depth pass
- 1. Method: each lesson gets the smallest check that refuses the lapse where it happens (a guard at the tool call,
  a filter at the read), test first, amending the module that already owns the act; a lesson no command can see
  stays a line and says so.
- 2. Raw material: the audit report (lead-audit-report.md, notes folder local_4096ade6, tables A-E); relief file
  lines 2732 and 2734 (both reviews); `bin/lib/guard.mjs:17-44,105-125`; `bin/wait.mjs:219-228`;
  `bin/lib/stall.mjs:79-148`; `bin/lib/batch-mark.mjs:42,81`; `bin/lib/background-close.mjs:117-169`;
  `bin/lib/stale-board.mjs:16-23`; `CLAUDE.md:64,67`; `bin/lib/protocols-skill.mjs:112,115`.
- 3. The bar:
  spec 1: `claude -p --model opus --output-format json`: `modelUsage` key `claude-opus-5-5` on cli 2.1.322 (2026-11-13, $0.25); the guard refuses `opus` today
  spec 2: `grep -n -i worktree bin/lib/guard.mjs`: only the practice-folder rule; none, new behaviour
  spec 3: `node --test bin/lib/stall.test.mjs`: passes; no case for a batch or an open question, new behaviour
  spec 4: `node --test bin/wait.test.mjs`: passes; no case for a notice the waiter sent, new behaviour
  spec 5: `grep -rn -i evals-archive bin docs`: 0; `--remove-worktree` removes with no copy (audit C5)
  spec 6: left out because no command owns `yours` until point 2 is cleared
  spec 7: `js-harness throughput`: "Unknown command: throughput" (audit, checked by the lead)
  spec 8: `grep -c "Seen: 2026-11-13" docs/FAILURES.md`: 0
  spec 9: left out because `bin/lib/manifest.mjs` waits for JH 196
  spec 10: `js-harness progress --pace`: tasks closed and added by day; no share of a baseline's plan, new behaviour
  spec 11: `node --test bin/lib/rules-change.test.mjs`: passes; no case for a value change that keeps an alias, new behaviour
- 4. Refutation: if `opus` gave another model the alias would be wrong; run above, it gives `claude-opus-5-5`.
  Verdict: supports
- 5. Request: as the specs below, with A9 widened per point 1 and C4 on the surfaces of point 2 if cleared.
  Adds: none

## Specs
His order for all of them: "Ok implementa todas las correciones y cementalas en el harness para que esto nunca
jamas vuelva a suceder" (69918425:2679).
1. A sub-agent may run on Opus by its short name `opus` (declared alias of `rule:session-model`).
2. The Bash guard refuses `cd` into another session's worktree (A9).
3. No STALLED line for a session running a batch (its batch mark's cwd is its worktree) or waiting on a question
   it recorded that is still open (A7).
4. The lead's `wait --notice-to orchestrator` does not end on a notice the waiting session sent itself (A8).
5. `sessions stop --remove-worktree` copies what no branch keeps to `~/.js-harness/` or refuses (C5), and refuses
   while another recorded session that did not say closed uses the folder (A5; the app's `archive_session` stays
   outside, said in the reason and in FAILURES).
6. The board: an item leaves `yours` only with a recorded reason (C4).
7. Texts: `CLAUDE.md:64,67` and protocols §7 name the throughput command as it exists (A14); the four "no advisor"
   texts say where the senior's advisor comes from (D6); protocols §1 names `rule:senior-model` as the strongest
   (A2b).
8. `docs/FAILURES.md` `- Seen:` lines for 2026-11-13: the relief `printf` date as literal `%Y` three times; the
   lead's `cd` into another session's worktree twice; question 279 reaching him without double review; the senior's
   nine audit sub-agents inheriting Fable; the app's auto-archive on a merged PR archiving JH 193 mid paid batch at
   17:58 and the lead at 20:10 local, because PR 859 was bound to it (`Claude/logs/main.log`, AutoArchiveEngine; the
   lead asks him whether to turn the setting off).
9. After JH 196 lands: the orchestrator skill gets a senior section (A2b) and puts the closing steps before `ready`
   (A4).
10. His words, 2026-11-13 (lead transcript 69918425 line 3312, typed): "dime si de la forma como planeamos las cosas
   que tanto porcentaje de implementacion pudimos hacer quiero que agregues esta nueva funcionalidad para ver que tanto
   cambio nuestro plan". `js-harness progress` reports, for a baseline date, how many of the steps open then are closed
   now, how many were added since, and the plan's growth (the audit's C3).
11. A new value on a rule with an alias drops the alias unless the change names it again, so `opus` never points at
   another model (T1's verifier, medium finding). Dropped rather than refused, so `rules switch`, which names no
   alias, still works: the guard then refuses the short name until it is declared again.

## Tasks
- [x] T1 (kind: build) spec 1 — `js-harness rules change session-model` on `rule/opus-alias`, alias `opus`, quoting 2679 — commit 85fa628c, PR 863
- [ ] T2 (kind: build) specs 2, 7 (advisor texts), 11 — `bin/lib/guard.mjs`, `bin/guard.mjs`, `bin/lib/home-sessions.mjs`, `bin/lib/rules-change.mjs`, `bin/lib/worktrees.mjs` (the cd check: `guard.mjs` is at its 1,000-line limit) + tests — commit `fix(guard): refuse cd into another session's worktree`
- [ ] T3 (kind: build) specs 3, 4 — `bin/lib/stall.mjs`, `bin/wait.mjs` + tests — commit `fix(stall): no stall for a batch or an open question; wait ignores own notices`
- [ ] T4 (kind: build) spec 5 — `bin/sessions-background.mjs`, `bin/lib/background-close.mjs` + tests — commit `fix(sessions): remove-worktree copies or refuses`
- [ ] T5 (kind: build) spec 6 — template gate/record + tests, if cleared — commit `fix(template): yours drops only with a reason`
- [ ] T6 (kind: docs) specs 7 (texts), 8 — `CLAUDE.md`, `bin/lib/protocols-skill.mjs`, `docs/FAILURES.md` — commit `docs: throughput command, senior strongest, 2026-11-13 failures`
- [ ] T7 (kind: build) spec 9 — `bin/lib/manifest.mjs` after JH 196 — commit `docs(skill): senior section; close before ready`
- [ ] T8 (kind: build) spec 10 — `bin/progress.mjs`, `bin/lib/progress-pace.mjs` + tests, its own PR last — commit `feat(progress): share of the plan done since a baseline`

## Log
- L1 2026-11-13T20:59:59Z, his words (69918425:2679, typed): "Ok implementa todas las correciones y cementalas en el
  harness para que esto nunca jamas vuelva a suceder".
- L2 2026-11-13 21:26Z, JH 198: brief read; `opus` checked on cli 2.1.322 (`claude -p --model opus`, $0.25):
  `claude-opus-5-5`. Document written for the lead's OK; no source written.
- L3 2026-11-13 21:4xZ, the lead (cross-session message): "OK on odd/tasks/audit-cement.md (7b31144a); build." The five
  points: (1) A9, any linked worktree other than the session's own, the reason naming `git show` and `git -C`; (2) C4,
  `bin/lib/template-gate.mjs` and `bin/lib/template-record.mjs` with their tests cleared for the `yoursDropped` check;
  (3) `bin/lib/protocols-skill.mjs` cleared for §1 and §7, with the wording for projects; (4) the no-advisor texts are
  mine: keep the refusal, reword the four texts, the lead tells JH 196 to drop P4a; (5) sequential PRs off main in
  Tasks order, T7 after the lead's word on JH 196. Ready with `--pr` for each PR.
- L4 the lead added T8: his words at 69918425:3312 (checked with `sessions --quote`, typed, 2026-11-13T22:01:59Z);
  cleared surface `bin/progress.mjs`, `bin/lib/progress-pace.mjs` and their tests; its own PR after the others.
- L5 T1: the first `rules change` replaced the rule's three earlier quotations with the new one; restored, and the
  change re-run with all four. The suite failed once on `rules-change.test.mjs:141` (the retirement case retired the
  first aliased rule on a fixed past day); fixed in the same commit. Reviews: Codex correct 0.97; lenses risk and
  reliability 0 findings; verifier (Opus, inherited: the installed guard refuses `opus` until the copy refresh) held
  3 of 3, one medium finding, spec 11. PR 863, ready at 22:28Z.
- L6 T2 commit 8bbbdbf3; its first try failed the suite: `bin/lib/guard.mjs` reached 1,050 lines (limit 1,000), so
  the cd check moved to `bin/lib/worktrees.mjs`. Codex on 8bbbdbf3: incorrect, two P2 (`cd -- ../other`, and a cd in a
  subshell, background job or before `||` moving the assumed folder); fixed by resolving each relative cd from every
  folder the shell may stand in. Lenses: readability (the lister split `refusalOf` from its doc comment) and
  reliability (own worktree only by git's `here`); both fixed, and the real lister checked by hand from this worktree
  (own subfolder passes, `tui-gentle-level-a6afd3` refused, main checkout passes). The verifier ended on an API error
  (subscription not allowed, 403) and is run again on the fix.
- L7 2026-11-14: the machine rebooted at 05:56Z and this session was resumed; PR 863 landed (main 236f720). The lead
  added the auto-archive item to spec 8.

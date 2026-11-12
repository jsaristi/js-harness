# lead-effort-split

The lead's session at its own level, apart from the reviewers'. Session JH 192, opened by the lead's brief (printed by
`js-harness sessions --opening "JH 192 · the lead's effort apart from the reviewers'"`). Delivery: one pull request,
branch `rule/lead-effort-split`, in work-unit commits. Runner: `node --test`.

## State
Slice 1 (T1-T5) committed on `rule/lead-effort-split`. He answered question 273 on 2026-11-12: split it and keep
the lead at high, so b8def321 (`lead-effort` to xhigh) is reverted by 8f907c12 and both levels stand at high.
Next: the done commands at HEAD; Codex and lens reviews with base 535509b6 (one set); push; PR; notify ready in its
own call. It lands with no further question (Ask me before). `lead-effort`'s subject is narrowed again by
77e01fa7 (L8). Slice 2 is PR 850; slice 3 (`odd/tasks/senior-orchestrator.md`) waits for this one to land.

## Goal
`rule:lead-effort` holds the lead's session, and a new rule `lens-effort` holds the Claude lenses and the double
review's Claude reader, both at high for now (his answer to question 273), so each level moves without the other.

## Why
Since 2026-11-11 (question 260) the lenses and the double review's reader read `lead-effort`
(`bin/lens-review.mjs:39`, `bin/double-review.mjs:184`), so his "Opus 5.5 Extra para orquestador" (2026-11-11) could
not be written without raising the reviewers to xhigh, which he did not ask; `rule:session-model`'s reading says it
waits for a rule that tells the two apart. He answered question 272 on 2026-11-12: split it.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/lead-effort-split.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node bin/js-harness.mjs rules coverage` exits 0
- `node --test bin/lib/model-home.test.mjs bin/lens-review.test.mjs bin/double-review.test.mjs bin/lib/guard.test.mjs` exits 0
- `node --test bin/lib/rules-switch.test.mjs bin/lib/rules-change-run.test.mjs bin/lib/home-sessions.test.mjs bin/rules.test.mjs` exits 0
- `node --test bin/conventions-model-home.test.mjs` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs rules applied` names the lead's level and, apart, the lenses' and the reader's, both high.
- Each code slice reviewed by Codex and the Claude lenses, then the `ready` notice to the lead.

## In scope / Out of scope
- In: the new rule `lens-effort` (`js-harness rules change`, his words as its source); the subject and reading of
  `session-effort`;
  `bin/lib/model-shape.mjs`, `bin/lib/model-home.mjs`, `bin/lens-review.mjs`, `bin/lib/rules-coverage-data.mjs`,
  `bin/lib/rules-switch.mjs`, `HOME_FLAGS` of `bin/lib/rules-change-run.mjs`, `bin/lib/home-sessions.mjs`,
  `bin/lib/home-doctor.mjs`; the tests beside each; the texts that name the home (`docs/ROADMAP.md`,
  `bin/lib/lead-protocols.mjs`, the usage of `rules switch`).
- Out: `rule:session-model`, `rule:session-effort`'s value, `rule:advisor-model`, `rule:review-model` and
  `rule:review-effort` (the brief: nothing else moves); the guard and `sessions start`, which keep reading
  `lead-effort` for a lead's start; the lead's own open session, which only he moves in the menu.

## Constraints
- The rule and its first reader land in one commit through `rules change --with`, because a live rule nothing reads
  fails `rules coverage`; `lens-effort` enters `HOME_FLAGS` in the commit that gives `rules switch` its `--lenses`,
  as `advisor-model` did (`3e943f2f`, `e3a491ab`).
- The rules machinery is high risk (contracts others consume): each change keeps a test that fails on its regression,
  and the planted breaks of `rules coverage` move with the readers.
- Nothing heavy beside another session's gate; a whole test run goes through `js-harness gate --`.

## Ask me before
Nothing: his answer to question 273 ("Separar y dejar en alto", 2026-11-12) and his "aplica todos los cambios ya"
(93b72703:896) cover the land once the gate and both reviews pass, as the lead read them in its note of 13:06 local.

## Depth pass
- 1. Method: configuration management as JH 172 set it (`odd/tasks/one-model-home.md`): one declared value a
  consumer, read by reference, changed by one command. Smallest change, by reuse-first: keep `lead-effort` for the
  lead, whose readers are the guard, `sessions start` and `rules switch --lead` (all unchanged), and give the two
  reviewers a new rule. The other shape, a new rule for the lead and `lead-effort` left to the reviewers, would move
  the guard's start, `sessions start`, `home-doctor`, `rules applied`, the `--lead` flag and every text that names
  `lead-effort` as the lead's, for a name that would no longer say what it holds. Searched: `js-harness rules` (no
  rule names the reviewers' effort apart; `review-effort` is Codex's), codegraph over `LENS_EFFORT` and `claudeHome`.
- 2. Raw material:
  - His words: `js-harness sessions --quote 93b72703 674` ("Sí, sepárala", 2026-11-12T15:11Z, question 272);
    `--quote 812b728f 1444` ("Opus 5.5 Extra para orquestador", 2026-11-11, the source of `rule:session-model`);
    `--quote f0959bbd 822` (question 260, "Lentes en alto (Recomendado)", tapped, 2026-11-11).
  - The readers: `bin/lens-review.mjs:39` (`LENS_EFFORT = claudeHome().lead`), `bin/double-review.mjs:32,184`
    (imports `LENS_EFFORT`), `bin/lib/rules-coverage-data.mjs:33` (the planted breaks of both under `lead-effort`).
  - The home: `bin/lib/model-shape.mjs:11` (`CLAUDE_HOME`), `bin/lib/model-home.mjs:24-49`,
    `bin/lib/rules-switch.mjs:66-120,139` (`--lead`, `homesOf`, `probesOf`), `bin/lib/rules-change-run.mjs:107`.
- 3. The bar:
  spec 1: `node bin/js-harness.mjs rules lens-effort`: none, new behaviour (no such rule today).
  spec 2: `node bin/js-harness.mjs rules lead-effort`: value high today.
  spec 3: `node --test bin/lib/rules-switch.test.mjs`: none, new behaviour (`--lenses` is an unknown argument today).
  spec 4: `node bin/js-harness.mjs rules applied`: names the lead's level only today.
- 4. Refutation: the request fails if the reviewers already read a level apart from the lead's. Run:
  `grep -n "LENS_EFFORT" bin/lens-review.mjs bin/double-review.mjs`. Result: `LENS_EFFORT = claudeHome().lead` and the
  reader passes `LENS_EFFORT`, so both follow `lead-effort` today.
  Verdict: supports
- 5. Request: "Give the lenses and the double review's Claude reader a rule of their own at high, a rule of the
  Claude home that `rules switch --lenses` changes and `rules applied` names as it does the rest of the home, and
  leave `lead-effort` to the lead's session alone, at high for now."
  Adds: none

## Specs
1. "Sí, sepárala" (2026-11-12, question 272: the orchestrator in Extra, the reviewers stay in Alto).
2. "Opus 5.5 Extra para orquestador" (2026-11-11).
3. "Lentes en alto (Recomendado)" (2026-11-11, question 260, tapped).
4. "Separar y dejar en alto (Recomendado)" (2026-11-12, question 273, tapped).

## Tasks
- [x] T1 (kind: design) (1, 2, 3) This document. Route: inline.
- [x] T2 (kind: build) (1, 3) `lens-effort` at high with its readers: `CLAUDE_HOME.lenses`, `claudeHome`,
  `claudeHeld`, `heldValues`, the lens and the reader, the planted breaks moved. Route: inline.
- [x] T3 (kind: build) (1) `rules switch --lenses <effort>`, `HOME_FLAGS`, the probe at the lenses' level, and
  `rules applied` naming the reviewers' level. Route: inline.
- [x] T4 (kind: build) (1, 2, 4) `session-effort`'s subject narrowed; `lead-effort` raised to xhigh, then reverted at
  high by his answer to question 273. Route: inline.
- [x] T5 (kind: docs) (1) The texts that name the home. Route: inline.

## Log
- L1 2026-11-12, his answer to question 272, tapped: "Sí, sepárala".
- L2 2026-11-12, decision of this session: the new rule is the reviewers' (`lens-effort`); `lead-effort` stays the
  lead's (Depth pass 1).
- L3 2026-11-12, rules change refused his tapped answers (questions 260, 272) as quotes; the sources quote his typed lines and name the taps in accepted.
- L4 2026-11-12, rules switch --lead xhigh probed claude-opus-5-5 at xhigh with the Fable advisor, 0.0751 USD; it found his maxEffortLevel at high, which caps the lead under xhigh: his to change.
- L5 2026-11-12, his "aplica todos los cambios ya" (93b72703:896); the lead reads it as yes to land each slice once the gate and both reviews pass.
- L6 2026-11-12, mistake: `rules change lead-effort` for its subject computed from origin/main's declaration and put the value back to high (fd2b9eb3); seen by `rules applied` at HEAD, fixed by the revert 913ec9af (value xhigh again, checked with `rules lead-effort`). A rule changes once per pull request; lead-effort's subject narrows in a later one.
- L7 2026-11-12, his answer to question 273, tapped (93b72703:1509): "Separar y dejar en alto (Recomendado)"; b8def321 reverted by 8f907c12, `rules applied` checked at high for both.
- L8 2026-11-12, with the value back at main's high, the subject change no longer moves the value: 77e01fa7 reapplies fd2b9eb3 (`rules lead-effort`: subject "the effort the lead's session runs at", value high).

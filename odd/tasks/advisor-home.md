# advisor-home

The advisor's model declared once, beside the model and the effort of the Claude home, and read by every command that
starts, resumes, switches or lists a session, so nobody passes `--advisor` by hand. Session JH 189, opened by the
brief `~/.js-harness/background/briefs/2026-11-12T06-58-20-202Z-f6e42350.md`. Delivery: one pull request, branch
`rule/advisor-home`, in four work-unit commits. Runner: `node --test`.

## State
T1 (this document) written. Next: its double review (T2), then T3 builds the rule and its first readers in one
commit. Open, his: everything under "Ask me before". Replies of this session run on `claude-opus-5-5` at medium with
a `claude-fable-5-2` advisor.

## Goal
`js-harness sessions start`, its `--resume`, `rules switch` and `rules applied` read the advisor's model from one rule
of the home, so a start or a resume that names none runs with the home's advisor, and the day it changes it changes in
one command.

## Why
His scheme since 2026-11-11 is Opus 5.5 for everything the harness starts, each with a Fable 5.2 advisor (S1). The
first half is in main since pull request 843 (`rule:session-model` is `claude-opus-5-5`). The second half lives only in
the lead's hands: no rule names an advisor, so the lead passes `--advisor claude-fable-5-2` on every start, and a start
or a resume that forgets it runs Opus alone. Of the 25 newest starts in the record, 23 hold `advisor: null`; each of them,
resumed today, would take the home's Opus with no advisor (`sessions-background.mjs:342` keeps the record's null).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/advisor-home.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node bin/js-harness.mjs rules coverage` exits 0
- `node --test bin/lib/model-home.test.mjs bin/lib/guard.test.mjs bin/sessions-background.test.mjs` exits 0
- `node --test bin/lib/rules-switch.test.mjs bin/lib/home-sessions.test.mjs bin/lib/home-sessions-read.test.mjs` exits 0
- `node --test bin/conventions-model-home.test.mjs` exits 0
- `npm run check` exits 0
- The pull request is reviewed by Codex and the lenses on each slice of code, an independent verifier passed on the
  guard's change, and the lead holds its `ready` notice, which says it lands only on his yes.

## In scope / Out of scope
- In: the new rule `advisor-model` (`js-harness rules change`, his words as its source); `bin/lib/model-home.mjs`;
  `bin/lib/guard.mjs` (`sessionStartRefusal`, `sessionStartHome`); `bin/sessions-background.mjs` and
  `bin/lib/background.mjs`; `bin/lib/rules-switch.mjs` and its runner's flags; `bin/lib/home-sessions.mjs`,
  `bin/lib/home-sessions-read.mjs` and the transcript fact they read; the tests beside each; the usage texts, the
  orchestrator skill's "A new model" and `docs/RECORDS.md` where they say what a start takes.
- Out: the lenses and the double review's Claude reader (an advisor there is spend he has not named); `start_session`
  and the sessions of the app, the lead's own included (their advisor is the host's `/advisor` menu or the
  `advisorModel` setting, his); anything under `~/.claude`; his Extra for the orchestrator and the senior
  orchestrator on Fable (the brief); `rule:lead-effort`, which stays as it is.

## Constraints
- The rule and its first reader land in one commit through `rules change --with`, because a live rule nothing reads
  fails `rules coverage`, and `rules change` refuses a new value for a rule of a home: the id joins the home's list
  (`CLAUDE_HOME`) in that same commit, after the runner has written it.
- A call's `--advisor` is held as `--model` is: a full Claude id, compared with `sameClaudeModel`, and only where the
  project declares the rule, because a short name resolves to whatever the engine gives (`--advisor fable` gave
  `claude-fable-5-1` on 2026-10-31, `odd/tasks/advisor-cost.md` L6) and a project that installs the harness is held to
  nothing by default.
- The guard's change is high risk (a guard): its tests first, and an independent verifier after its own checks.
- Nothing heavy beside another session's gate; a whole test run goes through `js-harness gate --`.

## Ask me before
Nothing of this plan needs him before it lands; the merge does. Written down as open, his to decide, none built here:
1. His "Alto" for the advisor: the host gives the advisor no level (item 2 below), so it cannot be set.
2. An advisor for the lenses and the double review's Claude reader: one more Fable call a review, at the model's
   choice.
3. The advisor of `start_session` and of the sessions of the app, the lead's own: the host's `/advisor` or the
   `advisorModel` setting, both his; the lead's session already shows `claude-fable-5-2` in its transcript.
4. His "Extra" (xhigh) for the orchestrator, which `rule:lead-effort` cannot take without moving the lenses' level
   (question 260); and the senior orchestrator on Fable 5.2.
5. What an advisor call costs on the weekly Fable meter: not known (item 2).

## Depth pass
- 1. Method: configuration management, as JH 172 applied it (`odd/tasks/one-model-home.md`, Depth pass 1): one
  declared value, every consumer reads it by reference, a lint refuses a stray copy, and a change is one command that
  tries the new value first. The smallest change: one new rule, the advisor's model alone, joined to the Claude home
  in `bin/lib/model-home.mjs`, which every reader of the home already imports. Search (`rule:reuse-first`):
  `js-harness rules` lists no rule that names an advisor (78 declarations; `session-model`'s own reading says "The
  Fable 5.2 high advisor [...] are no rule of the home and this switch does not write them"); widening
  `session-model` to hold two ids would break its one-value form that the guard and the switch read; so a new id.
  `sessions start --advisor` exists since pull request 740 (`f36c272f`) and is kept, with the home as its default. A
  project setting `advisorModel` in `.claude/settings.json` was weighed and set aside: it would reach every session
  of the project, his own Code tab sessions and the lead's included, which is his to set (Ask me before 3).
- 2. Raw material:
  - His words, transcript `812b728f-2f18-43f6-b405-396080689c65`, lines 1444, 2544 and 3271, read whole with
    `js-harness sessions --quote` (S1).
  - The start and the resume: `bin/sessions-background.mjs:172-176` (model and effort from `sessionStartHome`),
    `:245` (the record takes `parsed.advisor`), `:338-342` (a resume: the home's model, but the record's advisor);
    `bin/lib/background.mjs:58-66` (`startArgs` passes `--advisor`); `bin/lib/guard.mjs:104-149`.
  - The record `~/.js-harness/background/sessions.jsonl`: of its 25 newest starts, 23 hold `advisor: null`; the two
    since pull request 843 (JH 188 `e6e6d2a2`, JH 189 `16820690`) hold `claude-fable-5-2`, passed by hand.
  - What a transcript records: each assistant entry carries `advisorModel` beside `effort`. With no advisor asked it
    repeats the session's own model: JH 172 `483dbb12`, JH 186 `9bdc0205` and `d95aafd1` (Fable, no advisor) show
    `claude-fable-5-2`; JH 185 `8126fdd7` (Opus, no advisor) shows `claude-opus-5-5`; JH 188 and JH 189 (Opus with
    the advisor) show `claude-fable-5-2`. So the field tells an Opus session with the Fable advisor from one without.
  - An advisor call, in this session's transcript at 07:03:57Z: one `usage.iterations` entry of type
    `advisor_message`, model `claude-fable-5-2`, 145,437 input tokens, none cached, and 8,412 output tokens. Its price:
    `evals/prices.mjs` has no Fable 5.2 row, so not known; JH 187 assumed 8 USD a million input and 40 output
    (`origin/advisor-cost` `c4385fcd`, `odd/tasks/advisor-cost.md` D7), at which this call is about 1.5 USD, an
    estimate on an assumed price. The advisor reads the whole transcript uncached, so a call grows with the
    session's context. The weekly Fable meter: not known; it read
    0 % on 2026-10-31 after about 530,000 advisor tokens of `claude-fable-5-1` (same document, L6).
  - The advisor's level: `claude --help` (2.1.322) does not list `--advisor`; the changelog cache
    (`~/.claude/cache/changelog.md`) names the advisor 21 times, `--advisor <model>`, `/advisor <model>` and the
    `advisorModel` setting, and no flag or key that gives it an effort (line 1187: "no advisor runs until you pick one
    with `/advisor`, `advisorModel` or `--advisor`"). JH 185 quoted the advisor page the same way
    (`odd/tasks/advisor-cost.md`, D2).
  - Sub-agents: 21 sub-agent transcripts hold `advisorModel: claude-fable-5-2`, all of Fable sessions, where the field
    repeats the model; whether a sub-agent of an Opus session with the advisor gets one is not known.
  - The rule's dry run: `js-harness rules change advisor-model --dry-run` took the new id with his three quotes on
    2026-11-12 (relief line hash `d8d81bb50060`).
- 3. The bar:
  spec 1: `node bin/js-harness.mjs rules advisor-model`: none, new behaviour (no such rule today).
  spec 2: `node --test bin/sessions-background.test.mjs`: none, new behaviour (a start with no `--advisor` passes none today).
  spec 3: `node --test bin/sessions-background.test.mjs`: none, new behaviour (a resume keeps the record's null today).
  spec 4: `node --test bin/lib/guard.test.mjs bin/sessions-background.test.mjs`: none, new behaviour (any `--advisor` passes today).
  spec 5: `node --test bin/lib/rules-switch.test.mjs`: none, new behaviour (`rules switch --advisor` is an unknown argument today).
  spec 6: `node --test bin/lib/home-sessions.test.mjs bin/lib/home-sessions-read.test.mjs`: none, new behaviour (`rules applied` compares model and effort only).
  spec 7: `node --test bin/conventions-model-home.test.mjs`: passes today; it must still pass with the new id.
- 4. Refutation: the request fails if the advisor cannot be held by the home, that is if a session started without
  `--advisor` already gets one (nothing to fix), or if the transcript cannot show which advisor ran (no check after).
  Run: the `advisorModel` of the five transcripts above, `grep -o '"advisorModel":"[^"]*"' <file> | sort | uniq -c`.
  Result: 5 of 5 show the session's own model where no advisor was asked, and the Fable advisor where it was; so a
  start without the flag gets none, and the field tells the two apart for an Opus session.
  Verdict: supports
- 5. Request: "Declare the Fable 5.2 advisor as a rule of the home, so that `sessions start` and its resume pass it
  when the call names none and refuse another, `rules switch --advisor` changes it with my words, and `rules applied`
  lists a background session that runs without it. Its level cannot be set: say so and leave it."
  Adds: none

## Specs
1. "pero todos con Advisor de Fable 5.2 Alto" (1444, 2026-11-11), "con Opus y advisor de fable?" (2544,
   2026-11-11), "necesito que me pases todo lo que puedas a Opus como habiamos quedado con el advisor de Fable" (3271,
   2026-11-12): a rule `advisor-model`, value `claude-fable-5-2`, owner sebastian, his three lines as its source, in
   the Claude home of `bin/lib/model-home.mjs`.
2. A `sessions start` that names no `--advisor` passes the home's to `claude --advisor` and records it.
3. A resume takes the call's advisor, then the home's, then the record's, as it takes the model.
4. A call's `--advisor` that is not the home's, or a short name, is refused with the line that says what to pass,
   where the project declares the rule; a project that declares none passes what it is given, as today.
5. `rules switch --advisor <model>` writes the rule with his words, after a probe that one short call with that
   advisor runs through the installed CLI; it says the probe proves the CLI took the id, not that the advisor answered.
6. `rules applied` lists a background session whose last reply ran with another advisor than the home's, or with
   none, read from the transcript's `advisorModel`, with the resume that corrects it.
7. The texts that say what a start takes (the usage of `sessions start`, the orchestrator skill's "A new model",
   `docs/RECORDS.md`) name the advisor's rule and do not restate its value.

## Tasks
- [ ] T1 (kind: design) (1-7) This document. Route: inline. Commit: pending.
- [ ] T2 (kind: design) (1-7) Its double review (`js-harness double-review read`), each finding answered. Route: inline.
- [ ] T3 (kind: build) (1, 2, 3) `rules change advisor-model --with` the readers: the rule, `CLAUDE_HOME.advisor`,
  `claudeHome`/`claudeHeld`/`sessionStartHome` with the advisor, the start and the resume taking it; tests first.
  Route: inline. Commit: pending.
- [ ] T4 (kind: build) (4) The refusal of another advisor in `sessionStartRefusal`, tests first, then an independent
  verifier. Route: inline, then one verifier. Commit: pending.
- [ ] T5 (kind: build) (5) `rules switch --advisor <model>` and its probe. Route: inline. Commit: pending.
- [ ] T6 (kind: build) (6, 7) `rules applied` reads the advisor; the texts. Route: inline. Commit: pending.
- [ ] T7 (kind: verify) Codex and the lenses on each slice, the gate, the pull request, the `ready` notice.

## Log
- L1 2026-11-12 06:58Z, the brief, as written: "Your work is that home: the advisor's model (and its effort, if the
  host lets one be set) as a rule of the home that `sessions start`, a resume, `rules switch` and `rules applied`
  read, so nobody passes it by hand." His words, the source: transcript `812b728f-2f18-43f6-b405-396080689c65` lines
  1444, 2544 and 3271 (Specs, 1).
- L2 2026-11-12 07:03Z, this session's advisor, before the design: settle what `advisorModel` proves, what a call
  costs and whether `rules change` takes the new id; hold `--advisor` as `--model` is held; leave the lenses,
  `start_session` and the app's sessions open. All three settled in the Depth pass, item 2.

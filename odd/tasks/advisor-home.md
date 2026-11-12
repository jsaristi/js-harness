# advisor-home

The advisor's model declared once, beside the model and the effort of the Claude home, and read by every command that
starts, resumes, switches or lists a session, so nobody passes `--advisor` by hand. Session JH 189, opened by the
brief `~/.js-harness/background/briefs/2026-11-12T06-58-20-202Z-f6e42350.md`. Delivery: one pull request, branch
`rule/advisor-home`, in four work-unit commits. Runner: `node --test`.

## State
Done: T1, T2 (read `f01e6567`, L3), T3 `3e943f2f`, T4 `3b932275` and `07e94c23` (verifier PASS, L4). Slice
`2458fcd3..07e94c23` reviewed: Codex correct (0.89, no finding); lenses risk 0, reliability 0, readability 1 (spec 3's
order), answered in the commit after `07e94c23`. Next, T5: `rules switch --advisor <model>` in `bin/lib/rules-switch.mjs`
(parse, `changesOf`, `homesOf`, `probesOf` with the advisor, `claudeProbeArgs` adding `--advisor`, `readClaudeProbe`
requiring a `usage.iterations` entry of type `advisor_message` of that id, a refusal of an advisor equal to the model),
`HOME_FLAGS` gains `--advisor <model>` and the test exception in `bin/lib/rules-change-run.test.mjs:1000` goes, usage in
`SWITCH_USAGE`; probe question when an advisor is set: "Call your advisor tool once, then answer with the single word:
ready". Build facts (L5): an unknown advisor id exits 1 with "The model \"claude-nope-9-9\" cannot be used as an
advisor."; with `--tools ""` and `--advisor claude-fable-5-2` the JSON output's `usage.iterations` held an
`advisor_message` of `claude-fable-5-2` (5,648 in, 456 out) and `modelUsage` both ids, 0.086 USD. Then T6, T7.
Open, his: everything under "Ask me before". Replies of this session run on `claude-opus-5-5` at medium with
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
- `node --test bin/lib/rules-switch.test.mjs bin/lib/rules-change-run.test.mjs bin/lib/home-sessions.test.mjs bin/lib/home-sessions-read.test.mjs bin/lib/sessions.test.mjs` exits 0
- `node --test bin/conventions-model-home.test.mjs` exits 0
- `npm run check` exits 0
- The pull request is reviewed by Codex and the lenses on each slice of code, an independent verifier passed on the
  guard's change, and the lead holds its `ready` notice, which says it lands only on his yes and gives the advisor
  tokens of each session that ran with it so far (the `advisor_message` iterations of its transcript).
- After the land (T8, the lead's act, checked here only if this session still runs): the first start that names no
  `--advisor` and the first `--resume` each show, in their transcript, an Opus reply with `advisorModel:
  claude-fable-5-2`; `js-harness rules applied` lists neither as off the home. Unit tests prove the argv; only a
  live run proves the host took it on a resume, which no session has done yet.

## In scope / Out of scope
- In: the new rule `advisor-model` (`js-harness rules change`, his words as its source); `bin/lib/model-home.mjs`;
  `bin/lib/guard.mjs` (`sessionStartRefusal`, `sessionStartHome`); `bin/sessions-background.mjs` and
  `bin/lib/background.mjs`; `bin/lib/rules-switch.mjs` and `HOME_FLAGS` of `bin/lib/rules-change-run.mjs`;
  `sessionFacts` of `bin/lib/sessions.mjs`, which reads the transcript; `bin/lib/home-sessions.mjs`,
  `bin/lib/home-sessions-read.mjs` and the transcript fact they read; the tests beside each; the usage texts, the
  orchestrator skill's "A new model" and `docs/RECORDS.md` where they say what a start takes.
- Out: the lenses and the double review's Claude reader (an advisor there is spend he has not named); `start_session`
  and the sessions of the app, the lead's own included (their advisor is the host's `/advisor` menu or the
  `advisorModel` setting, his); anything under `~/.claude`; his Extra for the orchestrator and the senior
  orchestrator on Fable (the brief); `rule:lead-effort`, which stays as it is.

## Constraints
- The rule and its first reader land in one commit through `rules change --with`, because a live rule nothing reads
  fails `rules coverage`. `rules change` refuses a new value only for an id of `HOME_FLAGS`
  (`bin/lib/rules-change-run.mjs:107`, `:278-280`), whose test holds each entry to a flag `parseSwitch` takes; so
  `advisor-model` enters `HOME_FLAGS` in T5, in the commit that gives `rules switch` its `--advisor`, with a test that
  `rules change advisor-model` with a value is refused from then on (Claude 3).
- A call's `--advisor` is held as `--model` is: a full Claude id, compared with `sameClaudeModel`, and only where the
  project declares the rule, because a short name resolves to whatever the engine gives (`--advisor fable` gave
  `claude-fable-5-1` on 2026-10-31, `odd/tasks/advisor-trial.md` L4) and a project that installs the harness is held to
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
5. What an advisor call costs on the weekly Fable meter: not known (item 2). He moves to Opus so as not to eat the
   Fable use (3271), and this makes a Fable advisor the default of every start: the ready notice gives the advisor
   tokens measured so far, and the meter's reading before and after is the lead's to take (Claude 6).
6. No start opts out of the advisor where the rule is declared: his "todos" reads as every session. A start without
   one would need `--advisor none`, not built (Claude 11).

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
    (`origin/advisor-cost:odd/tasks/advisor-cost.md` at `c4385fcd`, D7), at which this call is about 1.5 USD, an
    estimate on an assumed price. The advisor reads the whole transcript uncached, so a call grows with the
    session's context. The weekly Fable meter: not known; it read
    0 % on 2026-10-31 after about 530,000 advisor tokens of `claude-fable-5-1` (same document, L6).
  - The advisor's level: `claude --help` (2.1.322) does not list `--advisor`; the changelog cache
    (`~/.claude/cache/changelog.md`) has 19 lines on the advisor (`grep -i advisor`, less the 3 on "advisory"): they
    name `--advisor <model>`, `/advisor <model>` (line 3971) and the `advisorModel` setting (line 1187, in an entry
    scoped to Claude Platform on AWS), and none names a flag or key that gives the advisor an effort. JH 185 read the
    advisor page the same way (`origin/advisor-cost:odd/tasks/advisor-cost.md` at `c4385fcd`, D2).
  - Sub-agents: a sub-agent this session launched with no model (agent `ad6aa73f`, 2026-11-12 07:2xZ, one line asked
    of it) ran on `claude-opus-5-5`, said it has a tool named `advisor`, and its transcript stamps `advisorModel:
    claude-fable-5-2` on each reply. So a sub-agent of a session started with the advisor inherits it, and needs no
    reader of its own; one sample, of the catch-all agent type.
  - The rule's dry run: `js-harness rules change advisor-model --dry-run` took the new id with his three quotes on
    2026-11-12 (relief line hash `d8d81bb50060`).
- 3. The bar:
  spec 1: `node bin/js-harness.mjs rules advisor-model`: none, new behaviour (no such rule today).
  spec 2: `node --test bin/sessions-background.test.mjs`: none, new behaviour (a start with no `--advisor` passes none today).
  spec 3: `node --test bin/sessions-background.test.mjs`: none, new behaviour (a resume keeps the record's null today).
  spec 4: `node --test bin/lib/guard.test.mjs bin/sessions-background.test.mjs`: none, new behaviour (any `--advisor` passes today).
  spec 5: `node --test bin/lib/rules-switch.test.mjs`: none, new behaviour (`rules switch --advisor` is an unknown argument today).
  spec 6: `node --test bin/lib/home-sessions.test.mjs bin/lib/home-sessions-read.test.mjs`: none, new behaviour (`rules applied` compares model and effort only).
  spec 7: left out because it builds nothing: the sub-agent probe of item 2 is its proof.
  spec 8: `node --test bin/conventions-model-home.test.mjs`: passes today; it must still pass with the new id and the texts.
- 4. Refutation: the request fails if the advisor cannot be held by the home, that is if a session started without
  `--advisor` already gets one (nothing to fix), or if the transcript cannot show which advisor ran (no check after).
  Run: the `advisorModel` of the six transcripts above, `grep -o '"advisorModel":"[^"]*"' <file> | sort | uniq -c`.
  Result: 6 of 6 show the session's own model where no advisor was asked, and the Fable advisor where it was; so a
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
   the Claude home of `bin/lib/model-home.mjs`. The dates are local days, as `rules change` stores them: line 2544
   is stamped 2026-11-12T04:33Z, 2026-11-11 23:33 local; it is the host's wrapper of his queued message, which
   `js-harness sessions --quote` reads as his words (line 2536 is a `queue-operation` entry).
2. A `sessions start` that names no `--advisor` passes the home's to `claude --advisor` and records it. "todos": no
   start opts out where the rule is declared (Ask me before 6).
3. A resume takes the home's advisor where the project declares it, else the call's, else the record's. A call may
   name only the home's (spec 4), so where declared claude is given the home's exact id, never a bracket or a date
   the call added (the verifier's note, L4).
4. A call's `--advisor` that is not the home's, or a short name, is refused with the line that says what to pass,
   where the project declares the rule; a project that declares none passes what it is given, as today.
5. `rules switch --advisor <model>` writes the rule with his words. Whenever the switch moves the home's model or its
   advisor, it probes the pair (the home's model with the home's advisor, as the switch would leave them) in one
   short call through the installed CLI that asks the model to consult its advisor once, and writes only when the
   output's usage holds an `advisor_message` iteration of that advisor's id; otherwise nothing is written and it says
   why. An advisor equal to the home's model is refused: the transcript could not tell it from none (spec 6). A
   negative control, an advisor id that does not exist, is run once while building to learn how the CLI refuses one.
6. `rules applied` judges a background session's advisor from its last reply: on the home's advisor when that reply's
   `advisorModel` is the home's advisor and differs from its own model; with none when `advisorModel` equals its own
   model (the host repeats the model when no advisor was asked); not known when the field is missing, the transcript
   cannot be read, or the home's advisor is the session's own model. A session with none or another advisor is
   listed with the resume that corrects it; one not known is named as not read, never as on the home.
7. Sub-agents inherit their session's advisor (Depth pass 2): no reader of their own.
8. The texts that say what a start takes (the usage of `sessions start`, the orchestrator skill's "A new model",
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
- [ ] T6 (kind: build) (6, 8) `rules applied` reads the advisor; the texts. Route: inline. Commit: pending.
- [ ] T7 (kind: verify) Codex and the lenses on each slice, the gate, the pull request, the `ready` notice with the
  advisor tokens measured so far.
- [ ] T8 (kind: verify) After the land: the first start and the first resume with no `--advisor`, checked in their
  transcripts and by `rules applied`. The lead's act; recorded here if this session still runs.

## Log
- L1 2026-11-12 06:58Z, the brief, as written: "Your work is that home: the advisor's model (and its effort, if the
  host lets one be set) as a rule of the home that `sessions start`, a resume, `rules switch` and `rules applied`
  read, so nobody passes it by hand." His words, the source: transcript `812b728f-2f18-43f6-b405-396080689c65` lines
  1444, 2544 and 3271 (Specs, 1).
- L2 2026-11-12 07:03Z, this session's advisor, before the design: settle what `advisorModel` proves, what a call
  costs and whether `rules change` takes the new id; hold `--advisor` as `--model` is held; leave the lenses,
  `start_session` and the app's sessions open. All three settled in the Depth pass, item 2.
- L3 2026-11-12 07:25Z, the double review `f01e6567` of `1cc4db71` (Claude 12 findings, 2,520,477 tokens; Codex 3,
  609,943; 1 % of Codex's weekly limit said before it ran). Taken: Claude 1 to 12, Codex 1 to 3; Claude 1 and Codex 3,
  Claude 4 and Codex 1, Claude 5 and Codex 2 are the same finding. Answers: sub-agents probed and found to inherit
  (spec 7, Depth pass 2); the live proof is T8, after the land, since no resume can be run before it without
  resuming a session of another's work; `HOME_FLAGS` in T5 (Constraints); spec 6's three states written; spec 5
  probes the pair and requires an `advisor_message`, refuses an advisor equal to the model, and runs a negative control
  once; the cost goes in the ready notice (Ask me before 5); six of six; the dates said local and line 2544 kept, with
  why; the branch named on each citation of `advisor-cost.md`; the changelog's 19 lines counted and line 1187's scope
  said; no opt-out written as his (Ask me before 6); State says T3 was built during the read. Not passed again: the
  corrections change no scope but add checks, and a second read is spend; the lenses and Codex read the code of each
  slice.
- L4 2026-11-12, the independent verifier of the guard (T4): PASS, no fail-open path; replacing the `advisorReason`
  call with null fails `bin/lib/guard.test.mjs`. Its two notes taken in `07e94c23`: a test resumes a record holding
  another advisor, and claude is given the home's exact id. The readability lens then found spec 3's text behind that
  order; spec 3 and the usage text now say it.
- L5 2026-11-12, T5's negative control and probe, run from a scratch folder: the facts in State. Cost about 0.1 USD.

# JH 158 · F8 S4b: contradictions to zero

Locator: `odd/tasks/f8-s4b-contradictions.md` · Branch: `worktree-f8-s4b-contradictions` · Delivery: chained pull
requests to main, one per slice · Test runner: `node --test`

## Goal
`check` refuses a new feature document without its task contract, each of the diet's ten contradiction pairs is
closed by a check, by precedence its text states or by his decision and held by a test that fails when its own
evidence goes, and every refusal of `check`, `check --push`, the merge door, `lens-review` and `codex-review` ends with
its next step: the exact command bound to the head it was computed at (a command that refuses once that head moved),
the step to take before the command is printed again, or the words that it has none.

## Why
"If two instructions contradict each other, Claude may pick one arbitrarily" (the diet, section 3). The diet's
pattern: "with a check, the sightings drop; prose that states its own precedence mostly wins; everything else is a
coin toss" (`docs/proposals/harness-diet.md:330-331`). S4b turns what is left into checks or stated precedence. Row 1
of the reverse-engineering document's 13.3 adds the same idea for the tool's own advice: a next step handed to the
model as data, bound to the state it was issued for, so a stale command is refused rather than rerun.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/f8-s4b-contradictions.md` exits 0
- `node --test bin/contract.test.mjs bin/check.test.mjs` exits 0
- `node --test bin/lib/contradictions.test.mjs` exits 0
- `node --test bin/conventions-next-step.test.mjs` exits 0
- `node --test bin/lib/next-step.test.mjs` exits 0
- `node --test bin/lens-review.test.mjs bin/codex-review.test.mjs bin/merge-queue.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the legacy list of `bin/conventions-next-step.test.mjs` is empty, quoted in `## Log`
- a printed review command run after one more commit is refused, and a terminal refusal ends with its "no command"
  words, both outputs quoted in `## Log`
- the incident set no worse: at least 10 of 20 and false premise at least 2 of 4 against the frozen S0 baseline
  (`odd/tasks/f8-s0-baseline.md`), run after his yes through the lead, quoted in `## Log`
- pair 9 answered by him through the lead, and his answer applied or recorded
- the pull requests are opened, named in `## Log`, with Codex and the Claude lenses recorded over their code

## In scope / Out of scope
- In: `bin/contract.mjs`, `bin/check.mjs` and `bin/lib/depth-pass.mjs` (the contract-first refusal); a new
  `bin/lib/contradictions.test.mjs`; every refusal of the five surfaces: the rows of `check` and `check --push`
  (`bin/check.mjs` and the row modules it calls, among them `bin/lib/lens-review-rows.mjs`,
  `bin/lib/codex-review-rows.mjs`, `bin/lib/codex-review-coverage.mjs`, `bin/lib/rules-check.mjs`), both halves of the
  merge door (`check --door` and `bin/lib/merge-queue-reviews.mjs`), `bin/lens-review.mjs`, `bin/codex-review.mjs` and
  the libraries that word their refusals (`bin/lib/codex-review-recheck.mjs`, `bin/lib/codex-meter.mjs`); a new
  `bin/lib/next-step.mjs` and `bin/conventions-next-step.test.mjs`; README, `docs/SPEC.md`, `docs/ROADMAP.md` S4b.
- Out, each with its reason:
  - the nine Rules lines of `bin/lib/rules-block.mjs`: his words as his answer D7 left them, changed only with his
    words.
  - his `~/.claude`, `~/.codex` and credentials: the brief forbids them.
  - S5's record rule, `MEMORY.md` budget and rule pass: S5's own (pair 8 names what is left there).
  - the incident rerun before his yes: about $13, his to approve through the lead.

## Constraints
- `bin/codex-review.mjs` sits at its ceiling of 2,271 lines and `bin/check.mjs` at 2,007
  (`bin/conventions-structure.test.mjs:71-73`): code moves out before a line is added — because the ceilings only go
  down.
- A project with no `depthPassSince` in `harness.json` is not held by the contract-first refusal — because no project
  `init` set up may turn red on documents it already has.
- `lens-review --head` keeps its meaning, the end of an explicit range (the chained-PR slices use it); the binding is
  a separate flag — because a slice of a past range is reviewed on purpose.
- A printed command is exact in everything the tool computed (base, head, the lenses not yet run) and leaves as
  `<...>` only the values of `--lenses`, `--reason` and `--unavailable` where they are the agent's judgement or the
  user's words — because the tool cannot pick those.
- A refusal whose next step is a commit, a checkout or a split prints that step and no review command; the refusal
  that follows at the new head prints the bound command — because a command bound to the head before the step would
  be refused exactly when the step is taken.
- The merge door judges a merge commit no one checks out (`bin/lib/merge-queue-reviews.mjs:36-42`); its command is
  bound to the pull request's own head and says it runs in that branch's worktree — because the synthetic tip is
  never anyone's `HEAD`.

## Ask me before
A pair that needs his decision goes to the lead as a question (`js-harness notify --to orchestrator --kind question`),
never asked here: pair 9 does (L5). The incident rerun, about $13, is asked through the lead before it runs, as the
lead's brief says.

## Depth pass
- 1. Method: two disciplines. Precedence between instructions: the one practice that works is a single home per rule
  and a check where one can hold it, the diet's own finding (section 3, "with a check, the sightings drop"). A stale
  next step: optimistic concurrency, a precondition carried with the request and compared before acting, as HTTP's
  `If-Match` (https://www.rfc-editor.org/rfc/rfc9110#section-13.1.1) and git's `push --force-with-lease=<ref>:<expect>`
  do: the command names the state it expects and refuses when the state moved, instead of acting on a new one. The
  smallest change: the depth-pass control already reads when each document opened, so it refuses a non-contract opened
  since `depthPassSince`; one table test holds the ten pairs, each row by its own kind of evidence (a phrase absent, a
  control exercised with a planted violation, the winning sentence present in its home, or his decision's register
  entry), over the texts `textSources` lists and the message producers `rules-sources.mjs` names beside them; one
  helper, `bin/lib/next-step.mjs`, gives every refusal its last line in one of three forms (the command, with `--base
  <hash> --at <head>` where a range was computed; the step to take first, after which the next refusal prints the
  command; or "no command" with why), and `lens-review` and `codex-review` compare `--at` with `HEAD` before they
  start; one convention test that finds every refusal site of the five surfaces not going through the helper, with a
  legacy list that reaches 0.
  Searched first (`rule:reuse-first`): `textSources` of `bin/lib/rules-sources.mjs:57` lists the 16 text sources the
  harness ships, and `MESSAGE_SOURCES` and `CUT_MESSAGE_SOURCES` (`:22-45`) the 16 modules that build a message at run
  time; `bin/lib/gentle-ai-absence.test.mjs` is the neighbour for a named-absence test; no shared
  next-command formatter exists (the closest is `uncoveredLines`, `bin/lib/lens-review-rows.mjs:119-126`);
  `lens-review --head` exists but is a range end with no comparison against `HEAD`; `codex-review` has no head flag
  (`bin/codex-review.mjs:267-270`); `notTheRange` already compares heads during a Codex run, not before it.
- 2. Raw material: the ten pairs, `docs/proposals/harness-diet.md:311-331`; row 1,
  `docs/proposals/gentle-ai-reverse-engineering.md:946`; the step, `docs/ROADMAP.md:643-650`; the texts that load
  today, read through `textSources` (16 sources) and the global file's Rules block with its kept groups,
  `bin/lib/rules-block.mjs:15-66`; the merge door's synthetic tip, `bin/lib/merge-queue-reviews.mjs:36-63`;
  `discoverContracts` keeping only documents with `## Goal`, `bin/contract.mjs:122`; the printed commands,
  `bin/lib/lens-review-rows.mjs:124`, `bin/lib/codex-review-rows.mjs:279` and `:398`, the `<rev>` placeholders of
  `bin/codex-review.mjs:680` and `:700`; the attribution count `git log 75c3583f..origin/main` (457 commits). An
  inventory of every refusal of the five surfaces (L2) was read file by file.
- 3. The bar:
  spec 1: `node --test bin/contract.test.mjs`: none, new behaviour; today a document without `## Goal` is skipped
  (probe in L3: 172 PASS, 0 FAIL with it present).
  spec 2: `node --test bin/lib/contradictions.test.mjs`: none, new behaviour; today 10 of 10 pairs read closed by hand
  (L4) and nothing keeps one from coming back.
  spec 3: `node --test bin/conventions-next-step.test.mjs`: none, new behaviour; today no refusal goes through one
  helper, about 38 failing-row sites in `check` and its row modules and about 37 refusals in the two review commands
  word their own next step, no printed review command carries `--at` (codex-meter's skip-debt line pins a head through
  a detached worktree, `bin/lib/codex-meter.mjs:176`, but prints none), and 4 carry a `<rev>` placeholder or a branch
  label as their base (L2).
  spec 4: `node --test bin/lib/next-step.test.mjs`: none, new behaviour; today `codex-review` rejects any head flag
  and `lens-review` never compares one with `HEAD`.
  spec 5: `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s4b-incidents`: the frozen baseline,
  S0's runs a and b, L 13, a step worse below 10, false premise 2 of 4 (`odd/tasks/f8-s0-baseline.md:105`); the last
  step's run, S2's, 14 of 20 ($5.67, `docs/ROADMAP.md:619-620`); the scorer's exit is no verdict, the score is read
  against 10 by hand; rerun only after his yes.
- 4. Refutation: could S4b already be done, so the request does not hold? Three cheapest tests, run 2026-11-08. A
  document with `## Specs` and no `## Goal` planted under `odd/tasks/`: `contract check` printed 172 PASS and no FAIL,
  so it is not refused. The losing sides with a phrase (pairs 2, 3, 7, 8 and 9: `Lossless Blocking`, `--consent`,
  `STOP`, `never select`, `wrap_up`, `PROACTIVE`) searched in the 16 shipped sources: 0 hits; pairs 1, 4, 5, 6 and 10
  have no phrase to search (their losing side is a document shape, the app's reminder, a limit, a charter and an
  outside guide). Read against what is left (L4, L5): 5 closed in text, 4 by a check, a switch or his rule, and pair 9
  still has both sides in shipped text, so it goes to him. That refutes only a part of the work on the pairs, which
  becomes a test per pair and one question. The printed commands: none carries `--at` (L2).
  Verdict: supports
- 5. Request: a non-contract document opened since `depthPassSince` is refused by `check` and `contract check`, its
  refusal ending with `js-harness contract template`; a table test names each of the ten pairs, how it is closed and
  holds each by its own evidence, over the shipped texts and the message producers; pair 9 put to him through the
  lead; every refusal of `check`, `check --push`, both halves of the merge door, `lens-review` and `codex-review` ends
  through `bin/lib/next-step.mjs` with the command (bound by `--base <hash> --at <head>` where a range was computed,
  the merge door's to the pull request's head and its worktree), the step to take first, or "no command" with why;
  `lens-review` and `codex-review` refuse an `--at` that is not `HEAD`; a convention test whose legacy list reaches 0
  in this feature holds it; the incident set rerun after his yes.
  Adds: none

## Specs
1. ROADMAP S4b (`docs/ROADMAP.md:643-650`), Changes: "contract-first as a `check` refusal for a new feature
   document"; Probe and pass: "a new document without `## Goal` is refused".
2. The same: "the remaining pairs of the diet's section 3 closed"; "10 of 10 pairs closed or his decision".
3. The same: "a refusal with a next step ends with the exact command bound to the range it was computed for (13.3 row
   1, a conventions test whose legacy list reaches 0)"; row 1 (`docs/proposals/gentle-ai-reverse-engineering.md:946`):
   "A refusal of `check`, `check --push`, `lens-review`, `codex-review` or the merge door that has a next step ends
   with the exact command, carrying the commit range it was computed for; a terminal refusal says it has none."
4. The same: "a printed command refuses once the head moved"; row 1: "A command whose range no longer matches the head
   is refused, not rerun".
5. The same: "the incident set no worse"; Cost: "about $13, the incident rerun".

## Next step
Update 2026-11-10 (L18): the incident line is met; nothing of S4b is left to run. Kept as history below.
Update ~22:05 local (L15): the chain is #792 (merged), #793 (ready), #795 (slice 3, on 793's branch) and #796
(slice 4, on 795's). Next: retarget each to main as the one below lands, and send its ready notice. Waiting on the
lead: his typed line for pair 9's rule change (then a rule/ branch), and question 232 (the incident rerun, T9). Then
the session summary under docs/sessions/ and notify closed. A `js-harness wait --notice-to 158` runs.
State at 2026-11-08 ~18:40 local: `09158b1c` (this document) committed. Uncommitted and green locally: T2 and T3
(`bin/contract.mjs`, `bin/check.mjs`, `bin/lib/depth-pass.mjs` and its test, `bin/lib/contradictions.test.mjs`), and
T5 plus the convention test (`bin/lib/next-step.mjs` and test, `--at` in `bin/lens-review.mjs` and
`bin/codex-review.mjs` with their tests, the helpers moved to `bin/lib/codex-review-answer.mjs`, the ceiling in
`bin/conventions-structure.test.mjs`, `bin/conventions-next-step.test.mjs`). The first commit of T2+T3 failed CI in
`bin/lib/gentle-ai-absence.test.mjs` because the pairs test named the old stack; fixed, not yet recommitted. Next:
commit T2+T3 (slice 1), then T5 and the convention test (slice 2a); Codex and the lenses over each; push, PR 1,
`notify --kind ready --pr <n>`. Then T6 and T7, the conversions, as two writers in parallel with disjoint edit
surfaces (review surfaces; plain `check` rows), the legacy list emptied after both; then the `rule/` branch for pair 9
(`js-harness rules change questions-one-place`, his words in L7) and the pair-9 row updated; then the $13 incident
rerun asked through the lead.

## Tasks
- [x] T1 (kind: docs) this document and its depth pass, committed alone; the plan's double read — L1 to L5
- [x] T2 (kind: build) spec 1: the contract-first refusal, tests first — L6
- [x] T3 (kind: build) spec 2: `bin/lib/contradictions.test.mjs`, the ten pairs; pair 9's question through the lead
- [x] T4 (kind: verify) specs 1-2: Codex and the lenses, PR 1, ready notice
- [x] T5 (kind: build) spec 4: `bin/lib/next-step.mjs` and `--at` on `lens-review` and `codex-review`, tests first
- [x] T6 (kind: build) spec 3: `bin/conventions-next-step.test.mjs` with its legacy list; the review surfaces
  converted (`check --push` rows, the merge door's review half, `lens-review`, `codex-review`)
- [x] T7 (kind: build) spec 3: the plain `check` rows and the door's rule rows converted; the legacy list empty
- [x] T8 (kind: verify) specs 3-4: Codex and the lenses over each slice, PR 2 and PR 3, ready notices
- [x] T9 (kind: verify) spec 5: the incident rerun after his yes through the lead
- [x] T10 (kind: docs) ROADMAP S4b State, SPEC, README, summary under `docs/sessions/`

## Log
- L1 (2026-11-08, the request as written): the lead's brief, from his words "Listo continuemos con todo lo siguiente"
  (the lead's transcript `0f71b2c6`, 2026-11-08 ~17:40 local): "S4b is the next step of the F8 plan. [...] What done
  looks like (the roadmap's probe and pass): a new feature document without its contract is refused by `check`; 10 of
  10 pairs of section 3 closed or put to him as a decision; a refusal with a next step prints the exact command bound
  to the range it was computed for, and that command refuses once the head moved (a conventions test whose legacy list
  reaches 0); the incident set no worse."
- L2 (2026-11-08, the refusals today): a read-only inventory of the five surfaces, file by file, its claims checked at
  `bin/codex-review.mjs:267-270` (no head flag), `bin/lib/lens-review-rows.mjs:124` and
  `bin/lib/codex-review-rows.mjs:279`, `:398`. `check --door` runs only the rule rows and the failures register
  (`bin/check.mjs:1903-1906`); the review half of the merge door is `lensDoor` (`bin/lib/lens-review-rows.mjs:107`),
  called from `bin/lib/merge-queue-reviews.mjs`, and its refusal names no command. No printed review command carries a
  head. The bases vary: a short hash with `^`, the trunk's label (`origin/main`) for a root commit, a full hash in the
  second-recheck refusal (also missing its `js-harness` prefix), the base as typed in the weekly-floor stop, and a
  literal `<rev>` in `WAYS_ON` and `SKIP_IS_THE_WAY_OUT` (`bin/codex-review.mjs:680`, `:700`). Refusals that say "run
  the review again" or "then rerun" with no command: the HEAD-moved ones of a Codex run, the dirty tree, the
  incomplete lens run (`bin/lens-review.mjs:271`), the oversized lens range (`:237`).
- L3 (2026-11-08, spec 1's probe): `odd/tasks/zz-probe-no-goal.md` with `## Specs`, `## Tasks` and `## Log` and no
  `## Goal`, untracked: `node bin/js-harness.mjs contract check` printed 172 PASS and no FAIL; the file was removed.
  `grep -L "^## Goal" odd/tasks/*.md`: 7 of 179 documents have none, all opened before 2026-11-01 (`codex-exec-review`,
  `f1-skeleton`, `f2-context-diet`, `install-update`, `progress-view`, `project-init`, `stack-doctor`).
- L4 (2026-11-08, the ten pairs read against what loads today; sources: the 16 of `textSources` and this session's
  own context):
  1. ODD header against contract first: closed. `CLAUDE.md` gives one order (contract, `## Depth pass`, `## Specs`,
     `## Tasks`, `## Log`); the global file holds no ODD text; spec 1 turns it into a check.
  2. the Lossless Blocking Prompt against `--consent granted`: closed by S2; neither phrase is in any source and
     `--consent` is in no file under `bin`.
  3. "Ask at most one question ... STOP" against "keep moving": closed in text. No source holds `STOP`; both sides now
     say keep moving: the Rules line "One question at a time; keep doing what does not depend on the answer"
     (`bin/lib/rules-block.mjs:16`) and `CLAUDE.md`'s "keep moving". "never while work runs" (`CLAUDE.md:38`) is about
     when a question is asked, not about stopping after it, so it does not reopen the pair.
  4. no attribution against the app's reminder: closed by a check: the commit-msg hook strips the lines; 0 attribution
     lines in the 457 commits of `75c3583f..origin/main`. The reminder still arrives each session, and his Rules line
     takes precedence, as the reminder itself says.
  5. review only for high-risk work against a review of every candidate: closed. No source limits review to high
     risk; the Rules block gives high risk an independent verifier only, and `CLAUDE.md` puts every slice with code
     through Codex and the lenses, held by the pre-push refusal.
  6. push and PR as human decisions against the lead's charter: closed by stated precedence and a switch: the
     protocols skill's incident line says a session waited 17 hours "for the user's yes to run its own gate, push and
     pull request, none of which was the user's to decide" (`bin/lib/protocols-skill.mjs:35`), and a push goes unasked
     where `pushUnasked` reads on (`:38`), on here (`harness.json`). The Rules line "Ask before ... publishing"
     (`bin/lib/rules-block.mjs:23`) is read with that precedence; merging stays the lead's after his yes.
  7. "never select lenses" against "pick every lens pertinent": closed by S2; only the second side is left
     (`CLAUDE.md`, `--lenses <pertinent>`).
  8. `mem_save` proactively against the record rule and four other stores: closed in text: `CLAUDE.md` makes the
     feature document and the roadmap the handoff, "mirrored in engram", and nothing else; the guard of
     `rule:memory-feedback-home` holds feedback notes; engram's text is engram's own (row 11) and asks only for durable
     knowledge. Left to S5 by the roadmap: the record rule as a rule and the `MEMORY.md` budget.
  9. three ways to ask against `rule:questions-one-place`: open. `wrap_up` and the plain-text STOP are gone, but two
     ways are left in shipped text: "Every question of the project reaches the user in one place: the orchestrator's
     chat, through the host's question tool [...] Only where the host has no question tool is a question written out"
     (`bin/lib/manifest.mjs:133`), against the reply's state "Question: an open question of the conversation that the
     user answers in writing, not with buttons" (`bin/lib/protocols-skill.mjs:49`, `CLAUDE.md:44`,
     `bin/lib/reply.mjs:11`). `reply --hook` holds the shape of a reply, not where a question went. No text says which
     wins, and changing either is a change of a protocol, his (`rule:owner-decisions`): it goes to him (L5).
  10. "never for size" and Opus 5's advice against `rule:double-review`: closed by his decision: the rule's source is
     his words of 2026-10-31 and 2026-11-01 (`docs/RULES.md`, `double-review`). The Rules block's delegated
     independent verifier "as rarely as possible", for high risk (`bin/lib/rules-block.mjs:43`, `:46`), is a sub-agent
     the session delegates; the double read is a command the rule names, `js-harness double-review read`.
- L5 (2026-11-08, the plan's double read, read `6d9d7e08`): the Claude reader 13 findings, the Codex reader 5, 4 found
  by both; all 18 taken (`js-harness double-review take`). What changed: the scope is every refusal of the five
  surfaces, not only the review path (both readers); the merge door's command is bound to the pull request's head and
  worktree, since the door judges a synthetic merge commit (both); a refusal whose next step is a commit or a checkout
  prints the step, not a command bound to the head before it (Claude); each pair is held by its own kind of evidence,
  not a phrase alone (both), over the message producers too (both); pair 9 is open and goes to him (Claude); the
  figures of the refutation corrected (Claude); a test for the "no command" words (Claude); the incident score read
  against the frozen S0 baseline, false premise included (Codex, Claude). Answered without change: pairs 3 and 10 stay
  closed, with the sentences in L4; the $13 is asked because the lead's brief says so. Pair 9 went to the lead as
  question 229 (2026-11-08 17:58 local), option A recommended: decisions through the question tool, an open question
  with no options in writing, the precedence written into `rule:questions-one-place` with his words.
- L6 (2026-11-08, T2 and T3, red then green): three tests appended to `bin/lib/depth-pass.test.mjs`, 2 of 3 red
  against the code as it stood (the third, a document left as it was, held already). Then `depthPassJudge` refuses a
  non-contract opened since the day, its refusal ending with `js-harness contract template`; `discoverContracts`
  hands non-contracts on with `documents: true`, and `validateEntries` keeps one only when the control refuses it, so
  the 7 old documents stay out of the count; `contract check` says "no contracts" by its results, not its entries
  (`bin/contract.test.mjs` caught it). `bin/lib/contradictions.test.mjs`: 13 of 13, its planted phrase, missing
  sentence and dead control each red. `node --test` one file at a time (a gate held the machine's lock): depth-pass
  28 of 28, contract 43 of 43, check 255 of 255, the five conventions tests green. No commit yet: the `hook entries`
  row refuses every commit on this machine since the lead updated the engram plugin to 0.1.22; the lead's word:
  JH 153 raises the table in its own PR, and this branch merges `origin/main` once it lands (PR 791, merged as
  `71b50d33`, fast-forwarded here).
- L7 (2026-11-08, his answer to question 229): "A: decisiones por la herramienta, abiertas por escrito (Recomendada)"
  (the lead's transcript `0f71b2c6`, line 75080, 2026-11-08T23:21:08Z, recorded verified in the channel). The lead's
  word: the change runs from a `rule/` branch with `js-harness rules change questions-one-place`, quoting his words
  and the date. Pair 9 is then closed by stated precedence, and its row in `bin/lib/contradictions.test.mjs` holds the
  new sentence.
- L8 (2026-11-08, T5, red then green): `bin/lib/next-step.test.mjs` against no module, red; then
  `bin/lib/next-step.mjs`: `commandStep`, `firstStep`, `noStep`, `nextLine`, `reviewCommand` (refuses a label or a
  placeholder as base or head) and `atRefusal`; 4 of 4. `lens-review --at`: its test red (1 of 22), then 22 of 22;
  the first try ran no lens because an earlier test's record covered the range, so the test commits a fresh change
  first. `codex-review --at`: 165 of 165 with its usage test; the usage's second line stays what a review loads, so
  the `--at` sentence is the last line. `bin/codex-review.mjs` sat at its ceiling: the answer's line helpers
  (`findingLine`, `verdictLine`, `byPlace`) moved whole to `bin/lib/codex-review-answer.mjs`, so it is 2,259 and its
  ceiling goes down to that. `bin/conventions-next-step.test.mjs` written with its detectors tested and a legacy list
  of 12 files.
- L9 (2026-11-08, after the host compacted this session at 18:49): slice 2a's gate failed twice on CI. First on
  two more usage assertions in `bin/codex-review.test.mjs` (lines 5384 and 6575), fixed. Then on
  `scripts/migration.test.mjs`, ENOENT copying a fixture's `.git`: project-migrate-maintenance-flake in a file the
  earlier search missed. Fixed apart as `a6dd79ae`, its `GIT_TRACE` assertion red before and green after, with a
  `- Seen:` line. `formatRow` now prints a failing row's `next` last; it moved to `bin/lib/next-step.mjs`, and
  `bin/failures.mjs` drops its copy, so `check.mjs` went down to 2,001. The `<rev>` detector skips `Usage:` lines,
  since they document syntax. T6 and T7 measured: 42 rows, 34 exits and 7 unbound commands. Two writers with
  disjoint surfaces, briefs in `$CLAUDE_JOB_DIR/tmp/brief-{common,a,b}.md`.
- L10 (2026-11-08, reviews of `09158b1..8435e5d`): the lenses, reliability and readability, over each slice, 0
  findings. Codex in 2 parts, 368,157 input tokens: part 1 correct; part 2 two P2 findings, both taken. `atRefusal`
  threw on a HEAD that names no commit; its test was red with that TypeError and is now green: it refuses with a
  check-out step. Pair 10's row held only the entry's heading and date; it now holds the decision itself, in the
  register and in the shipped protocol.
- L11 (2026-11-08, PRs and T6/T7): the chain is stacked to main, PR 792 (`origin/main..690bf159`, 512 lines, 270 of
  them this document) and PR 793 (`690bf159..a1d63009`, 430, on 792's branch). The first push of 792 was refused: the
  Codex review covered `09158b1..8435e5d` as one range, so slice 1 got its own review, `09158b1..690bf15`, correct with
  no findings, 176,246 input tokens. `notify --kind ready` refuses 793 until it targets main; a note went instead.
  T6 and T7 were done by two writers (haiku, high) with disjoint surfaces, and checked here. T7 took the plain rows of
  `check`, and its row builders moved to `bin/lib/sensor-rows.mjs`, so `check.mjs` is at 1,938. T6 took the review
  surfaces: the push rows and the door bind the command to hashes, the door to the pull request's own head and its
  worktree (`--cwd`), and every `return 1` of the two reviews ends in its next line. Done here: the two `tag` rows,
  red then green; `merge-queue` printing the door's `next`, which `leaveOut` dropped, red then green; the detector
  reading an `atRefusal(` line above a block; two wordings ("commit the correction as code", and "he" in a shipped
  message). The legacy list is empty. Tests: 24 files under the gate lock, 1,101 of 1,102, the one a ceiling, then
  fixed; the files the fixes touched, 138 of 138, and the tag tests 29 of 29. T7 committed alone, with its half of the
  two convention tests, so each commit passes its own gate. `notify`'s `readyProblems` still drops a `next`: notify
  is none of the five surfaces, so it is left out.
- L12 (2026-11-08): T6's first commit failed on CI in five tests of `bin/codex-review.second.test.mjs`, which runs the
  second half of `bin/codex-review.test.mjs`. The writer ran only the first half, and so did the set run here, so
  those expectations still lacked their `next:` line. They are fixed. One step was wrong too: a git older than 2.40
  said "git did not answer" or "cannot be split"; the range's error now carries its step, "use git 2.40 or later".
  Both halves and `check`: 591 of 593, 2 skipped, 0 failed. The lenses over T7 (`a1d6300..21fc735`): reliability 0,
  readability 1, dead imports of `commandStep` and `FIX_TESTS` in `check.mjs`, removed in T6's commit.
- L13 (2026-11-08, reviews of T7 and T6): Codex over T7 alone (`a1d6300..21fc735`, with that commit checked out so
  the push of PR 794 is covered) in 2 parts: correct, no findings, 279,824 input tokens. The lenses over T6
  (`21fc735..0ba9b8b`): readability 0, and its earlier finding confirmed fixed; reliability 1 WARNING, taken.
  `reviewNext` printed the rerun without the flags of the command refused, so after a skip whose record failed to
  write it named a command that runs a review. `rerunFlags` in `bin/lib/next-step.mjs` now repeats them, except
  the ones the rerun binds or gives again. Its unit test was red (no export) and is now green, and a codex-review
  test holds the skip's rerun. Both halves: 333 of 335, 2 skipped, 0 failed.
- L14 (2026-11-09, after the host compacted this session at 21:35 local): Codex over T6 (`21fc735..48c49a2`) gave 5
  P2s, each fixed with its test: the "ways on" refusals print `reviewNext()` with the refused flags; `rerunFlags` quotes
  a value so both POSIX shells and PowerShell read it as given; the merge door's conflict branch keeps its `next`;
  `bindToHead` names the earlier pull request when the refused range holds commits outside this one's head (the
  feat/g + feat/h scenario of `bin/merge-queue.test.mjs`); the moved-HEAD refusal prints the exact
  `js-harness check --push`, not a step that said "run again" twice. PR 792 landed and 793 targets main; ready
  sent at 21:37. Pair 9: his answer to question 229 was tapped (`js-harness sessions --quote 0f71b2c6 75080`), and
  `rules change` refuses a tapped answer (`bin/lib/rules-change.mjs`, `quotationOf`). So the row now reads "his
  decision: question 229, A", and the rule text waits for a line he types, asked of the lead at 21:43. The incident
  rerun was asked as question 232 at 21:45, one run, about $13 at list price. T10 drafted: SPEC's "A refusal's next
  step" and the contract-first sentence, the ROADMAP's S4b State; README names no capability, so nothing changes there.
- L15 (2026-11-09, 22:05 local): Codex's recheck of `48c49a2..00cccb9` found 4 of the 5 fixed. Finding 3 was still
  open: a value with a backslash in double quotes is not literal in a POSIX shell. Such a value now goes in single
  quotes, red then green, in `797d07f`. The second recheck (`00cccb9..797d07f`): correct, 0.99. Lenses: 0
  findings, and the readability finding of the round before (the moved-HEAD wording) is fixed in the same commit.
  GitHub gave the next numbers to others, so slice 3 is #795 (`a1d6300..21fc735`) and slice 4 is #796
  (`21fc735..797d07f`, 725 lines; no cohesive split, as its body says). Ready for #793 sent at 21:37.
- L16 (2026-11-09, T9): his yes to question 232 (tapped, the lead's transcript `0f71b2c6` line 75711, checked with
  `js-harness sessions --quote`). The plan read first: 20 trials, about 25 minutes, about $5.67 list, under the $20
  stop. One run, `f8-s4b-incidents`, on `06e55d17` under the gate, $5.01 list. Scored with `node
  evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s4b-incidents`: 13 of 20, at L 13 and above the
  worse line of 10. False premise 1 of 4, below the 2 the contract asks. incident-05 fails every trial, as in every
  run since S0. incident-04 failed one trial of two, its first miss in any run. Its transcript shows the agent found
  the false premise; the reply hook refused that reply for lacking a state line, and the grader read only the close it
  wrote again (`docs/FAILURES.md`, eval-reply-cut-by-stop-hook). S4b touched neither the hook nor `evals/`. Not rerun:
  the yes was for one run. The control it owes, outside S4b: the reply a grader reads is every text of the turn, not
  only the message after a Stop hook's refusal.
- L17 (2026-11-09, the contract's quotes): `bin/conventions-next-step.test.mjs` holds `const LEGACY = {};`. A review
  command run after one more commit, `node bin/js-harness.mjs lens-review --base 06e55d17 --at 797d07f7 --lenses
  reliability --reason "a stale command"` at `c2e517c`, prints "this command was computed at 797d07f, and HEAD is
  c2e517c now: the range it names is no longer the branch's, so it is refused, not rerun." and "next: run again what
  printed this command (js-harness check --push, or the merge door), for the command bound to this head". A terminal
  refusal, `node bin/js-harness.mjs codex-review --base HEAD~1 --cwd <a folder outside git>`, ends with "next: no
  command, the command needs a git repository, and there is none at this folder". The contract's incident line is
  not met as scored: false premise 1 of 4 (L16). Pair 9 is recorded as his decision A; the rule text is debt until he
  types it, as the lead set out (2026-11-09).
- L18 (2026-11-10, the incident line, by JH 160): his answer to question 243, "Arreglar la prueba y correr una vez
  (recomendado)" (`js-harness sessions --quote ea85ec35-82e1-4aa9-abe3-98bd153a50b0 1247`, tapped
  2026-11-10T04:14:12Z), covered the grader's fix and one run for S4b and S5. The fix is PR 803: the runner grades a
  reply task on every main-thread text of the turn its kept transcripts hold, before the printed answer
  (`eval-reply-cut-by-stop-hook`, its control now a check in `evals/runner.test.mjs`). `f8-s5-incidents` ran once on
  `f41f4fb2` (tree `5bfc3e3d`: origin/main `6ee974d` with PR 802's head `c38aaa9` and PR 803's head `1c0c0c2` merged
  in, not pushed), $4.84 list. `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s5-incidents`:
  15 of 20, false premise 3 of 4, at L 13 and above the worse line of 10. **The contract's incident line is met.**
  incident-04 passed 2 of 2. Every one of the 20 transcripts holds one Stop-hook feedback line, so every trial was
  graded across a bounce (the detail: `odd/tasks/f8-s5-rules.md`, L16).

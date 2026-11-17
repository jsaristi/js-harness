# Questions with options

## State
Worktree `D:/js-harness-worktrees/questions-with-options`, branch `rule/questions-with-options`. Commits: `66e7420e`
(doc), `82fbf051` + `924c1114` (T2, 2 to 4 options; Codex 0.94 and lenses clean on 9fc30a07..924c1114),
`263c2933` (T3, the hook's question state names `Pregunta <n>`; Codex 0.9 clean), `5c6a8d60` (the reliability
lens's fix: the named question must be open in the record; lenses clean), `3d245683` (Codex P2 on 5c6a8d60: the
corrected stop runs the record check too; Codex 0.98, the P2 rechecked fixed; reliability lens 0 findings). T2
and T3 done. The rule commits
(T4) wait for PR 901, whose `rule/sessions-visible-only` holds the rule change open on another branch (`js-harness
rules change questions-one-place --dry-run`, 2026-11-17); the lead's order: 901 first, then these.

## Goal
Every question the harness puts to the user reaches him through the question tool with options, the written ones
included, and `rule:questions-one-place` and `rule:reply-five-states` say so in his words.

## Why
On 2026-11-17 the lead closed a reply with an open written question ("Te pregunto: …"), and he answered "siempre
dame las preguntas con opciones" (line 7609), then "por favor cementa que siempre me debes pasar las preguntas con
opciones" (line 7752). Asked whether the written state goes (question 325), he typed that it stays, with examples
in the options and very clear that he answers in the "Otro" box (line 8070). The record shows `notify --kind
question` takes a question with no options: 6 of its 324 questions have none, the last one question 304, the one
his first line answers; and the reply hook's own refusal offered the state as "asked on that line".

## Done when
- `node --test bin/lib/channel.test.mjs bin/notify.test.mjs bin/template.test.mjs bin/lib/reply.test.mjs` exits 0
- `echo '{"text":"x","options":[],"waits":"y"}' | node bin/js-harness.mjs notify --home <scratch> --to orchestrator --kind question` exits non-zero and names the floor and "Other"
- `js-harness rules check` exits 0, with `questions-one-place` and `reply-five-states` quoting lines 7609, 7752 and 8070 of `699d7c29`
- `npm run check` exits 0

## In scope / Out of scope
- In: `bin/lib/channel.mjs` (`checkedQuestion`), `bin/notify.mjs` (usage), `bin/lib/template-question.mjs`,
  `bin/lib/reply.mjs` (the question state) with its grader copy, `bin/reply.mjs`, `bin/lib/protocols-skill.mjs`
  section 2, the `reply` help in `bin/js-harness.mjs`, `bin/lib/contradictions.test.mjs` pair 9, the rules
  `questions-one-place` and `reply-five-states` through `js-harness rules change`, and the tests beside them.
- Out: where questions reach him ("Solo en el Plan", line 7720), T6 of `odd/tasks/plan-orchestrator.md` (JH SR);
  `onboard`'s "open questions in plain chat" (`bin/lib/onboard.mjs:835`), the guided talk of a project's
  onboarding, which no rule of these two owns: told to the lead as open; the question records already written,
  which stay readable as they are; `CLAUDE.md:44`, which stays true ("a question he answers in writing").

## Constraints
- A rule changes through `js-harness rules change` on this `rule/` branch, one commit a rule — because `rules
  check` holds one home and one act per change.
- The existing phrases of `questions-one-place` stay — because T6 rewrites the "where" sentence and
  `rules-coverage-data.mjs:43`, `manifest.test.mjs:3114` and the `evals/without` fixtures key on them.
- A stored question with fewer options still reads, shows and closes — because the record is append-only and
  questions 113, 114, 152, 157, 159 and 304 are in it.
- `evals/tasks/rule-away-autonomy/grader/reply.mjs` is a line-for-line copy of `bin/lib/reply.mjs`
  (`evals/tasks.test.mjs:149`), so `reply.mjs` keeps no import.

## Ask me before
Changing any rule other than these two (it goes to the lead as a question first).

## Depth pass
- 1. Method: an input contract is held where the input enters, by one validator every producer passes through, with
  the refusal naming the fix (the standard of a schema check at an API boundary). The smallest change that meets
  it: a floor in `checkedQuestion` (`bin/lib/channel.mjs:208`), the one check both `questionFieldsOf` (standard
  input) and `newNotice` (callers) run, and in the reply hook the question state's line naming the recorded
  question it waits on (`Pregunta <n>`), since the tool holds a session until he answers and a reply waits only on
  a question recorded and not yet shown (`askingRule`, `bin/lib/sessions.mjs:2878`). The search of
  `rule:reuse-first`: `TOOL_OPTIONS` is 2 to 4 in `bin/lib/template-question.mjs:9`, the question tool's range, and
  the `ask` gate (`template-gate.mjs`) already refuses a tool call whose options are not the record's; nothing
  refuses a recorded question outside that range, and nothing ties the reply's question state to a question.
- 2. Raw material: his lines 7609, 7752, 7720 and 8070 of transcript `699d7c29` (read with `sessions --quote`); the
  reply he answered at 7609 closed on "Te pregunto:", the state the Stop hook's refusal offered as "an open question
  the user answers in writing, asked on that line" (`bin/lib/reply.mjs:122`); the channel record
  `~/.js-harness/channel/D--js-harness.jsonl`, counted by options on 2026-11-17: 0 options 6, 1 option 0, 2-4
  options 318, 5-6 options 0; `bin/lib/channel.mjs:208-221` (no floor, an empty list "a question with nothing to
  tap"); `bin/lib/template-question.mjs:8,22,56` ("ask it in writing"); `bin/lib/protocols-skill.mjs:49`;
  `bin/lib/contradictions.test.mjs:117-120` (pair 9, question 229 A, tapped 2026-11-08); `bin/lib/rules-change.mjs:239`
  refuses only a tapped answer, so a line written in the tool's "Other" still counts as his typed words (8070 is one).
- 3. The bar:
  spec 1: `node --test bin/lib/channel.test.mjs`: none, new behaviour (a question with 0, 1 or 5 options is refused, naming the range and "Other")
  spec 2: `node --test bin/lib/channel.test.mjs`: holds today (a stored question with no options still reads and closes), kept by a new test
  spec 3: `node --test bin/lib/reply.test.mjs`: none, new behaviour (the question state's line names `Pregunta <n>`; the real close before line 7609 is refused)
  spec 4: `js-harness rules check`: today both rules quote only 2026-10 words
  spec 5: `node --test bin/lib/contradictions.test.mjs`: pair 9 states question 229 A, to state his 2026-11-17 words
  spec 6: left out because no command can judge whether an option gives an example of the answer: prose in the rule, said in the PR
- 4. Refutation: does the harness already refuse a question without options?
  `echo '{"text":"probe","options":[],"waits":"probe"}' | js-harness notify --home <scratch> --to orchestrator --kind question`:
  recorded question 1 and exited 0 (2026-11-17, scratch home): the gap is real.
  Verdict: supports
- 5. Request: every question for him is recorded with 2 to 4 options, the recommended one first, so the question
  tool shows it; a question he answers in writing keeps its state, and its options give examples of the answer and
  the question says plainly that he writes it in "Otro", which still counts as his words. A reply closes on the
  question state only naming the recorded question it waits on. `questions-one-place` and `reply-five-states` say
  so with lines 7609, 7752 and 8070, superseding the tapped answer A to question 229.
  Adds: the reply hook's check of the question state (question 325)

## Specs
1. "siempre dame las preguntas con opciones" (2026-11-17, `699d7c29` line 7609)
2. "hazme todas la pregunta y por favor cementa que siempre me debes pasar las preguntas con opciones" (2026-11-17,
   `699d7c29` line 7752)
3. "Dejarlo con Opciones pero especificando con ejemplos en las opciones y Dejando muy Claro que se tiene que
   repsonder en la casilla de "Otro"" (2026-11-17, `699d7c29` line 8070, his answer to question 325)

## Tasks
- [x] T1 (kind: docs) this document; spec 1, 2; inline
- [x] T2 (kind: build) 2 to 4 options in `checkedQuestion`, its tests first, the usage example and "ask it in writing"; spec 1, 2; inline
- [x] T3 (kind: build) the reply's question state names `Pregunta <n>`, its tests first, its grader copy, the refusal and help text; spec 3; inline
- [ ] T4 (kind: build) `js-harness rules change` for both rules after PR 901 lands, pair 9 with them; spec 3, 4, 5; inline
- [ ] T5 (kind: verify) Codex and lenses per slice, an independent verifier, PR, `notify --kind ready`

## Log
- L1 (2026-11-17, his request as written): "siempre dame las preguntas con opciones" (line 7609) and "hazme todas
  la pregunta y por favor cementa que siempre me debes pasar las preguntas con opciones" (line 7752), transcript
  `699d7c29-54c4-460e-a5e8-700b114eb251`, both read with `sessions --quote`.
- L2 (2026-11-17): the reply-five-states half recorded as question 325 for the lead, with two options. `rules
  change --dry-run` refused: `rule/sessions-visible-only` (PR 901) holds the one open change; told the lead.
- L3 (2026-11-17, T2 red then green): two tests added to `bin/lib/channel.test.mjs`, the floor (both paths, 0 and 1
  option) and an old record with none still read and closed; 2 of 67 red, then 67 of 67 after the floor. The usage
  example of `notify` had one option: its test now parses the example with `questionFieldsOf`. Twelve fixtures in
  nine test files recorded a question with 0 or 1 option through `newNotice`; each now has two.
- L4 (2026-11-17, his answer to question 325, line 8070, typed in the tool's Other): "Dejarlo con Opciones pero
  especificando con ejemplos en las opciones y Dejando muy Claro que se tiene que repsonder en la casilla de
  "Otro"". The lead's reading: the written state stays, always through the question tool. `reply-five-states`
  enters the scope; the lead's order stands: PR 901 first, then both rule commits.
- L5 (2026-11-17, decision of this session): the record's most options goes from 6 to 4, the question tool's
  most, since `template ask` runs only where the tool is and no question of the record had 5 or 6; a stored one
  with more or fewer is withdrawn and recorded again. Onboarding's "open questions in plain chat" is no rule's of
  these two: told to the lead as open, not changed here.

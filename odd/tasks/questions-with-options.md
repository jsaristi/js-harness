# Questions with options

## State
T1 (this document) written. Next: T2, the floor in `checkedQuestion`, tests first. The rule commit (T4) waits for
PR 901, whose `rule/sessions-visible-only` holds the one rule change open at a time (`js-harness rules change
questions-one-place --dry-run`, 2026-11-17). The reply's written-question state is `rule:reply-five-states`, not
this rule: it went to the lead as question 325 and nothing of it is touched until the answer is in.

## Goal
Every question the harness records for the user carries options, and `rule:questions-one-place` says so in his words.

## Why
On 2026-11-17 the lead closed a reply with an open written question, and he answered "siempre dame las preguntas
con opciones" (line 7609), then "por favor cementa que siempre me debes pasar las preguntas con opciones" (line
7752). The record shows `notify --kind question` takes a question with no options: 6 of its 324 questions have
none, the last one question 304, the one his first line answers.

## Done when
- `node --test bin/lib/channel.test.mjs bin/notify.test.mjs bin/template.test.mjs` exits 0
- `echo '{"text":"x","options":[],"waits":"y"}' | js-harness notify --home <scratch> --to orchestrator --kind question` (the branch's copy) exits non-zero and names the floor and "Other"
- `js-harness rules check` exits 0, with `questions-one-place` quoting lines 7609 and 7752 of `699d7c29`
- `npm run check` exits 0

## In scope / Out of scope
- In: `bin/lib/channel.mjs` (`checkedQuestion`), `bin/notify.mjs` (usage example), `bin/lib/template-question.mjs`
  (the "ask it in writing" wording), `bin/lib/contradictions.test.mjs` pair 9, the rule `questions-one-place`
  through `js-harness rules change`, and the tests beside them.
- Out: where questions reach him ("Solo en el Plan", line 7720), which is T6 of `odd/tasks/plan-orchestrator.md`
  (JH SR); `rule:reply-five-states` and the texts that carry it (`bin/lib/reply.mjs`, protocols section 2,
  `CLAUDE.md`, the `reply` help, `onboard`'s "open questions in plain chat") until the lead answers question 325;
  the question records already written, which stay readable as they are.

## Constraints
- One rule change at a time, through `js-harness rules change` on this `rule/` branch — because `rules check`
  holds one home and one act per change.
- The existing phrases of `questions-one-place` stay — because T6 rewrites the "where" sentence and
  `rules-coverage-data.mjs:43`, `manifest.test.mjs:3114` and the `evals/without` fixtures key on them.
- A stored question with fewer options still reads, shows and closes — because the record is append-only and
  questions 113, 114, 152, 157, 159 and 304 are in it.

## Ask me before
Changing any rule other than `questions-one-place` (it goes to the lead as a question first).

## Depth pass
- 1. Method: an input contract is held where the input enters, by one validator every producer passes through, with
  the refusal naming the fix (the standard of a schema check at an API boundary). The smallest change that meets
  it: a floor in `checkedQuestion` (`bin/lib/channel.mjs:208`), the one check both `questionFieldsOf` (standard
  input) and `newNotice` (callers) run. The search of `rule:reuse-first`: `TOOL_OPTIONS.min` is 2 in
  `bin/lib/template-question.mjs:9`, the question tool's floor, and the `ask` gate (`template-gate.mjs`) already
  refuses a tool call whose options are not the record's; nothing refuses a recorded question with fewer than 2.
- 2. Raw material: his lines 7609, 7752 and 7720 of transcript `699d7c29` (read with `sessions --quote`); the
  reply he answered at 7609 closed on "Te pregunto:" (the lead's transcript, the assistant line before 7609); the
  channel record `~/.js-harness/channel/D--js-harness.jsonl`, counted by options on 2026-11-17: 0 options 6,
  1 option 0, 2-4 options 318, 5-6 options 0; `bin/lib/channel.mjs:208-221` (no floor, a comment calling an empty
  list "a question with nothing to tap"); `bin/lib/template-question.mjs:8,22,56` ("ask it in writing");
  `bin/lib/reply.mjs:11,122`, `bin/lib/protocols-skill.mjs:49`, `CLAUDE.md:44` (the written-question state);
  `bin/lib/contradictions.test.mjs:117-120` (pair 9, question 229 A, tapped 2026-11-08); `bin/lib/rules-change.mjs:239`
  refuses only a tapped answer, so a line written in the tool's "Other" still counts as his typed words.
- 3. The bar:
  spec 1: `node --test bin/lib/channel.test.mjs`: none, new behaviour (a question with 0 or 1 options is refused, naming the floor and "Other")
  spec 2: `node --test bin/lib/channel.test.mjs`: holds today (a stored question with no options still reads and closes), kept by a new test
  spec 3: `js-harness rules check`: today `questions-one-place` quotes only 2026-10-13
  spec 4: `node --test bin/lib/contradictions.test.mjs`: pair 9 states question 229 A, to state his 2026-11-17 words
- 4. Refutation: does the harness already refuse a question without options?
  `echo '{"text":"probe","options":[],"waits":"probe"}' | js-harness notify --home <scratch> --to orchestrator --kind question`:
  recorded question 1 and exited 0 (2026-11-17, scratch home): the gap is real.
  Verdict: supports
- 5. Request: every question recorded for him carries at least two options, the recommended one first, so the
  question tool can show it; what he wants to write goes in its "Other", which still counts as his words. The rule
  `questions-one-place` says so with his lines 7609 and 7752, superseding the tapped answer A to question 229; the
  written-question state of `reply-five-states` follows only on the lead's answer to question 325.
  Adds: none

## Specs
1. "siempre dame las preguntas con opciones" (2026-11-17, `699d7c29` line 7609)
2. "hazme todas la pregunta y por favor cementa que siempre me debes pasar las preguntas con opciones" (2026-11-17,
   `699d7c29` line 7752)

## Tasks
- [x] T1 (kind: docs) this document; spec 1, 2; inline
- [ ] T2 (kind: build) the floor in `checkedQuestion`, its tests first, the usage example and "ask it in writing"; spec 1, 2; inline
- [ ] T3 (kind: build) pair 9 of `contradictions.test.mjs` states the new words; spec 4; inline, with T4
- [ ] T4 (kind: build) `js-harness rules change questions-one-place`, after PR 901 lands; spec 3; inline
- [ ] T5 (kind: verify) Codex and lenses per slice, an independent verifier, PR, `notify --kind ready`

## Log
- L1 (2026-11-17, his request as written): "siempre dame las preguntas con opciones" (line 7609) and "hazme todas
  la pregunta y por favor cementa que siempre me debes pasar las preguntas con opciones" (line 7752), transcript
  `699d7c29-54c4-460e-a5e8-700b114eb251`, both read with `sessions --quote`.
- L2 (2026-11-17): the reply-five-states half recorded as question 325 for the lead, with two options. `rules
  change --dry-run` refused: `rule/sessions-visible-only` (PR 901) holds the one open change; told the lead.

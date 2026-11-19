# JH 224 · onboarding guided talk asks by the tool

## Goal
Item `onboard-q` of plan version 4 of 2026-11-18 (stretch opened 2026-11-18T17:03:58Z): the onboarding's guided talk
(`bin/lib/onboard.mjs:835`, step `converse`) stops asking open questions in plain chat (`rule:questions-one-place`).
Brief: the item in `plan-2026-11-18-away.notes.md`, version 3 item (c) and version 4, in the shared notes folder
`side-session-notes/local_41e31b68-c8b2-4729-8c54-b1e701bb5a40`. Its stop condition: if the fix changes how the
interview works, stop and wait for him.

## The user's words
Started by the lead on his approval of the wave, question 340, his answer "Sí, las 8" (JH PLAN transcript `f5c3ee4d`).
His answer to question 351, read with `js-harness sessions --quote f5c3ee4d-2c09-416a-addb-ea2b5e6c3e8d 4083`
(2026-11-19T00:15:41Z, tapped): "A: con opciones (Recomendada)".

## Delivered
- PR 920, ready at bd2c4cc (not merged): commits b972cb86, 2d3648f9, bd2c4cc.
- `bin/lib/onboard.mjs`: one phrase, `ASK`, for the `kind`, `converse` and `summary` steps: one at a time through the
  host's question tool (written out only where the host has none), 2 to 4 options with examples, the recommended one
  first, the free answer in "Otro", recorded with `notify --kind question` first, put as `template ask <n>` prints
  it, logged as a (session) Log line. The opening invitation is unchanged.
- `bin/lib/onboard.test.mjs`: the wording of the three steps pinned from one pattern written out in the test
  (`node --test bin/lib/onboard.test.mjs`: 42 pass, 0 fail).
- `odd/tasks/onboarding.md`: D3 "It guides" corrected; Log L47 (his answer), L48 and L49 (the reviews).
- Stop note: `side-session-notes/local_f536332a-81c1-489b-9669-68384563ffe9/jh224-onboard-q-stop.md`.

## Decisions
- This session: stop before writing, because D3 (`odd/tasks/onboarding.md:228-232`, from his S11 of 2026-10-20)
  said "there are no options to tap in this part"; told to the lead by note at 2026-11-18T19:38:20Z.
- His, through the lead and JH PLAN: question 351, A (options), with D3 corrected in this item (the lead's message).
- This session: the `kind` step's follow-ups and the `summary` step take the same phrase, from Codex's findings on
  b972cb8; named to the lead as a scope reading. The lead's ruling: inside his A, since question 351 asked about
  every question of the guided interview. Recorded in L47, L48 and L50.

## Failures and lessons
- The first script edits of `onboarding.md` and of the test failed (CRLF lines; an escaped pattern in a heredoc);
  the Edit tool did them. In the third fix the code was changed before its test, because the test's edit failed
  first; the old test went red on the code, then was updated.
- Codex found what the first commit missed: recording before asking, the host-without-tool wording, the kind step,
  and then the `template ask` rendering the gate checks. Lesson: a question's wording in a printed step follows
  the protocol's "Questions to the user" (`bin/lib/manifest.mjs`) whole, not the rule's one phrase.
- The first commit of this summary was refused by the pre-commit: the document tests (`bin/rules.test.mjs
  bin/sessions.test.mjs`) passed their 120 s under the machine's load, with a PowerShell spawn `ETIMEDOUT`. Found
  because HEAD had not moved although the background task exited 0; retried once, and it passed.
- Not fixed here, told to the lead: `docs/FAILURES.md` is owed `- Seen:` lines for the script edits that failed on
  escaping and for the code changed before its test; the document-tests sensor timing out on a docs-only commit.

## Left
- PR 920 to land: the lead.

## Cost
- First notice 2026-11-18T19:38:20Z, ready 2026-11-19T01:09:54Z (most of that waiting for question 351); context 43%
  at the ready.
- Codex, three reviews on gpt-6.2-sol at max: 1,336,099, 428,039 and 110,713 input tokens (about 1.87M), each over its
  300,000 allowance.
- Claude lenses (readability, reliability), three runs on claude-opus-5-5, about 47,000 input tokens in all.
- Gate: `npm run check` in the pre-commit, three code commits PASS; the summary's commits: one refused (the timeout
  above), then PASS, then this correction.
- PR 920's checks on GitHub: `gh pr checks 920` reported none on the branch when read.

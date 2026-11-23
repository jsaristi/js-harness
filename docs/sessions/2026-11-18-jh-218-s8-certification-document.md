# JH 218 · S8 certification document

File: docs/sessions/2026-11-18-jh-218-s8-certification-document.md.

## Goal
Write `odd/tasks/f8-s8-certification.md`, F8's S8 feature document, with its contract and its `## Depth pass`,
documents only and no paid run: item `s8doc` of the stretch opened 2026-11-18T07:50:46Z, from JH PLAN's notes
`plan-2026-11-18-away.notes.md` (section "Items" and "Version 3").

## The user's words
"vas a quedar autorizado de darle toda la informacion organizada y completa a el orquestador para que puede trabajar
efectivamente toda las horas" (transcript f5c3ee4d, line 186, as the plan's notes quote it; not re-read with
`js-harness sessions --quote` by this session).

## Delivered
- Commits f93dbc5d (the document), db5717bc (the model-home convention fix), b24e02ed (version 2, every review
  finding taken), on branch `claude/s8-certification-doc-baae60`.
- Pull request 912, open, ready: https://github.com/jsaristi/js-harness/pull/912.
- The depth pass refutes running S8 now: 4 of the 17 measures miss on their latest comparable result (incident set
  15 of 20 against the target 17, `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s5-incidents`;
  long-session 60% against 90%; test before code; Spanish 87.4% against 95%), 2 have no command for their line, 5
  have no result comparable with S8.

## Decisions
- `Adds: none` and no question to the owner: he was away by the brief; his seven decisions are listed under the
  document's `## Ask me before` and sent to the lead (this session).
- Done when holds only this PR's free checks; the certification's are under `## Certification pass`, because
  `contract run` executes every done-when command (the double review, Claude 1 and Codex 1).

## Failures and lessons
- The first commit passed the pre-commit gate yet failed `bin/conventions-model-home.test.mjs` (a value of Codex's
  home written above the Log). Found by running the conventions by hand; fixed in db5717bc. It is
  `documents-commit-skips-suite` seen again; the stretch's `staledocs` and `precommit-gap` items own it.
- Version 1 counted 5 misses and cited a paid regrade as a free bar; the double review found both.

## Left
- T2 to T8 of the document, and every paid run: his decisions, held by the lead.
- C3.2's Windows history was not read by this session.
- The land of PR 912: the lead.

## Cost
- Double review read 24c21318: Claude 4,667,256 tokens, Codex 2,925,014 tokens; 35 findings, all taken.
- One read-only explorer, 129,740 tokens. No Codex code review and no lens review: documents only.
- Gate: the pre-commit `check` three times, PASS each; the conventions run by hand, all pass.
- Time: from about 16:47Z to the ready notice at 17:20:52Z; context about 65% at the ready notice.

# JH 176 · a control that acts when he leaves with no stretch open

## Goal
The triage's work unit 12 (`docs/proposals/2026-11-10-audit-triage.md`, "### 12."): the most repeated failure of
the register, `stretch-not-opened`, gets a control that acts when he leaves, not at his return. The opening read
is the lead's brief, `C:\Users\Oficina\.js-harness\background\briefs\2026-11-11T05-33-39-385Z-b14f7618.md`; the
session was started in the background by the lead (JH ORQ).

## The user's words
- The lead's transcript ea85ec35-82e1-4aa9-abe3-98bd153a50b0, line 6905 (2026-11-11T05:30:20Z, read with
  `js-harness sessions --quote ea85ec35-82e1-4aa9-abe3-98bd153a50b0 6905`, "sent by the user"): "contesta TODAS las
  preguntas con recomendado TODAS y avanza los mas posible eres completamente autonomo".
- The same transcript, line 6716 (2026-11-11T05:26:36Z): "une lo que quede listo y tienes autorizacion para poder
  avanzar en todo y escoger siempre la opcion recomendada, no preguntes, avanza y se completamente autonomo."
- By those words the triage's question 5 is answered with its recommended option 1: "Un control que actúe al irte
  (Recomendada). Cuando la sesión sabe que te fuiste y no hay tramo abierto, lo dice en ese momento a la sesión
  líder, en vez de esperar tu regreso. Un sí cubre diseñarlo y construirlo con su prueba. No cubre cambiar qué
  cuenta como ausencia."

## Delivered
- Pull request 820, ready: https://github.com/jsaristi/js-harness/pull/820 (branch `worktree-departure-control`).
- Commits: `8ff0b26a` the feature document with its depth pass; `55091455` the absence in course and the one cover
  test in `bin/lib/return-report.mjs`; `916bfccf` the heartbeat's `AWAY:` line in `bin/loop.mjs`, the usage, the
  lead's sentence, the README and `docs/FAILURES.md`; `f910b9d1` Codex's finding; `95d80ccc` the lenses' findings
  (one rule for a held session); `1fe3bc4f` the verifier's corrections.
- The feature document: `odd/tasks/departure-control.md` (contract PASS, `js-harness contract check`).
- Outside the repository: the brief of the question unit for the lead,
  `C:\Users\Oficina\.js-harness\background\briefs\draft-jh176-question-stops-holding-lead.md`.
- Tests at the close: `node --test bin/lib/return-report.test.mjs` 32 of 32, `node --test bin/loop-bodies.test.mjs`
  34 of 34; `js-harness check --push` PASS (5 code commits, all covered by a Codex record and a lens record).

## Decisions
- His: the control that acts when he leaves (question 5, option 1), by the two lines above.
- This session's: the heartbeat carries the control, not the reply hook, since the hook acts only at a stop of the
  lead (`odd/tasks/departure-control.md`, L4); only the lead is told (L9); the cover test and the held rule are one
  function each, shared with the return check (L6, L18).
- The lead's (its note of 01:13 local, quoted in L10): a held absence is recorded as its own failure, apart from
  `stretch-not-opened`, and the unit "how a question stops holding the lead" is not this session's. The reading
  that line 6905 covers a question the triage did not put to him is the lead's, his to correct at the pull request.
- This session's, on that instruction: no new entry, since `question-tool-holds-asker` already existed (L13).

## Failures and lessons
- A wrong figure of this session (L20; `docs/FAILURES.md`, `record-states-wrong-fact`): the scratch replay of the
  depth pass said the question tool held the lead in 9 of 23 uncovered absences; it is 8. It paired a question with
  a later result by a phrase, not by the call's id. Found by the independent verifier before the pull request; the
  lead was told by a note at 03:17 local. The messages of `55091455` and `916bfccf` keep the 9. Lesson: a figure
  from a scratch script is checked on one case by hand in the record before it is written or sent.
- Codex's finding (L17): a cut due at a heartbeat's start returned before the absence was read. Fixed, test first.
- The lenses' findings (L18): "held" written twice with different conditions; a "no" of the lead check kept for the
  whole absence; texts that said any session; two flags that read as each other's negation; two failure paths with
  no assertion; a question call not kept by its id. All taken, all confirmed fixed.
- `bin/loop.test.mjs` "a real loop" failed once on this machine under another session's gate (L14); it passed on
  GitHub's machines in every gate run. Not a defect of this change.
- The register's counter reads two `- Seen:` lines with the same date and the same source as one (found when 10
  lines counted 9): two sightings of one day need distinct sources.

## Left
- The lead: land pull request 820, refresh the installed copy, and keep a heartbeat running while he is away; the
  control acts only while one runs or at its next start (L15).
- The lead: start the question unit from its brief. Until it lands, a lead the question tool holds reads the
  `AWAY:` line only once the tool returns (8 of the 23 absences replayed, 4 of the last 5).
- Nobody yet: the unit's last Done-when, "the entry's next sighting window passes without a new `Seen:` line", can
  be read only after the control has run for a while.
- Not checked: the `AWAY:` line reaching a real lead through a real host (tested with fakes); whether a heartbeat
  was alive in any past absence.

## Cost
- Time: brief written 2026-11-11T05:33Z (00:33 local, UTC-05:00); first note to the lead 00:53 local; ready notice
  about 03:45 local.
- Context: about 72% of the window at the close; the host compacted the session once, at 01:29 local.
- Gate runs: 7 (one a commit, on GitHub's machines), all PASS.
- Codex: 3 runs, 494,957 input tokens in all (350,913 in 2 parts; 53,187; 90,857).
- The Claude lenses: 3 runs, 9 lens passes (4, 4 and 1), about 198,000 input tokens in all.
- Sub-agents: 1, the independent verifier (claude-fable-5-2 at high, 226,392 tokens, 31 minutes).

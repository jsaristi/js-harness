# JH 203 · auditoría completa de lo construido

## Goal
Audit everything built in js-harness, part by part with sub-agents, and say what to keep, fix, shrink or remove so
the harness matures. Opened from the lead's brief
`~/.js-harness/background/briefs/2026-11-15T02-10-23-626Z-2a6b0f77.md`.

## The user's words
"Estoy desde el movil y me surgio una duda, recuerda que tenemos una ventana de contexto reducida de aproximadamente
350 mil tokens y este proyecto se ha hecjo grande, si lo vamos a revisar yo creo que lo mejor seria colocar una sesion
aparte con varios sub agentes que los revisen a fondo y por partes y hacer hacer el trabajo mejor o que opina? No es
solo ver el plan sino ver completamente todo que se ha hecho" — lead transcript 69918425, line 11078,
2026-11-15T01:43:53Z (`js-harness sessions --quote 69918425-3b43-430f-9f50-62b6422422ce 11078`).

## Delivered
- `odd/tasks/full-audit.md` on branch `worktree-full-audit`, pushed: partition (`b8683009`), synthesis (`04a29a7a`),
  then the close with this summary, no pull request (findings only, per the brief).
- 13 findings files, the verifier's file, the coverage run and P0 in the notes folder `full-audit/`.
- The page `auditoria-2026-11-14.html` in the notes folder, not published (the lead publishes it).

## Decisions
- Tier B (sources whole, test titles), 14 opus sub-agents in waves of at most 5, coverage run once: the lead, channel
  notes of 2026-11-14 22:43 and 22:44 local, recorded as L3 in the feature document.
- Waves 2 and 3 ran no part tests, after wave 1's parallel test runs overloaded the machine: this session,
  `full-audit/BRIEF-COMMON.md`.
- P0's import graph re-run with `export … from` (`p0-v2.md`) after two readers showed it missed re-exports: this session.

## Failures and lessons
- P0's first import graph missed `export … from` re-exports, so `hook-count.mjs` and `project-messages.mjs` looked
  dead; found by readers C and E2; fixed in `graph.mjs` and `p0-v2.md` before the verifier ran.
- Wave 1 readers ran their part tests alongside the coverage run (about 200 node processes); timing tests failed
  under load (`launcher.test.mjs:133,164`, `check.test.mjs:702`, `loop.test.mjs`). The common brief was changed to
  forbid part test runs.
- The waiting notice of step 1 was never sent: the lead's go arrived from the pushed document while this session was
  at the gate step. Recorded in L3.
- Remove verdicts were the readers' weak spot: 7 of 21 missed a caller (verifier).

## Left
- Every fix, shrink and removal in the synthesis: the lead and Sebastián decide which become plan steps.
- Not attacked by the verifier: medium and low findings outside its 7-row sample (listed in `verifier.md`).

## Cost
- Time: worktree opened 21:10 local on 2026-11-14 (`ls -la docs/audits`), partition `b8683009` at 21:23, the go at
  22:43, synthesis `04a29a7a` at 00:55 and the page commit `26aae220` at 00:59 on 2026-11-15 (`git log --format=%ci`).
- Wave 1 (A1, A2, A3, B1, B2) ran without the coverage summary the lead asked every part to get; it was not ready
  until after they finished, and each says so.
- Sub-agents: 13 readers plus 1 verifier on opus, reported `subagent_tokens` summing to about 3.3M.
- One coverage run of `bin` (about 46 minutes under load); three pre-commit gate runs on document commits; no Codex
  or lens review (no code, per the brief).

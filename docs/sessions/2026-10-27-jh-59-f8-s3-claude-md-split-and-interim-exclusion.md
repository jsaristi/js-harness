# JH 59 · F8 S3: CLAUDE.md split and interim exclusion

File: docs/sessions/2026-10-27-jh-59-f8-s3-claude-md-split-and-interim-exclusion.md.

## Goal
F8 step S3 (`docs/proposals/harness-diet.md`, section 10): the root `CLAUDE.md` importing `@AGENTS.md` with
Appendix A.1's kept lines, `init` shipping the split, the `claude-md-budget` rule, the interim
`claudeMdExcludes` exclusion with the payload row reading it, and his answers D3, D5 and D7. The opening came
from JH ORQ (local_f008d2e8-50b3-4393-85d8-5fa53b69c146).

## The user's words
Relayed by JH ORQ from transcript e41d1e8d-8264-45a4-b16c-f9279f7b6076:
- D3, lines 1697 and 1733: "si pero codex es un revisor externo no mas y se usa para revisar lo que hacemos y
  cuando manejemos un proyecto es para revisar el codigo"; "Excelente me parece excelente eso asi".
- D5, line 7461: "si".
- Line 7551: "Si ambas cosas pero sacamos todo lo del plan lo organizamos bien en agents colocamos lo que vamos a
  colocar para codex como dice el plan como para tener un orden ...".
- D7, question 96: "Acepto D7 así (Recomendada)"; the directives pass: "Justo después de S3 (Recomendada)".

## Delivered
All three listed ready by `js-harness merge-queue --dry-run`, in this order, none merged:
- PR 602, `rule/f8-s3-split`: `claude-md-budget` (2500) and its `check` row, `rules-live-in-the-harness`
  rewritten for the split, D5 narrowing `rule:double-review` (18083c91, e5e36473, f4c058c8, 5e464397, df4b1043).
- PR 603, `claude/f8-s3-exclude`: `.claude/settings.json` with `claudeMdExcludes` (ff716e6c).
- PR 604, `claude/f8-s3-split-251472`: the split and `init` (b94f525f), the payload row honouring the exclusion
  (18260036, f49b5749), `CLAUDE.md`/`AGENTS.md` per D3 with the ask and close protocols (7e069cdc), D7's lines
  (7d8d1d4a), the incident rerun and the directives pass in the roadmap (297cf6ba).
- Feature documents: `odd/tasks/f8-s3-split.md` (T1-T11 done, L1-L14), `odd/tasks/rule-f8-s3-split.md`.

## Decisions
- D3, D5, D7 and the directives pass: his, recorded in `odd/tasks/f8-s3-split.md` L8, L9, L11, L12.
- The budget at 2500, the measured 2483 rounded up: this session, L10 and the rule doc's L6.
- `rule:reply-five-states` not named in `CLAUDE.md`, because `bin/lib/template-block.test.mjs` holds the repo to
  the shipped block's rule ids: this session, L10.
- The template's two-readers line left unnarrowed by D5: this session, L8 (a follow-up).

## Failures and lessons
- A commit failed silently behind `tail -1`, and the push went up without it; the gate's output is now kept
  whole in a file and grepped for FAIL.
- `codex-review` refuses while tracked files are uncommitted; the feature document is set aside first.
- gentle-ai `assess` is unassessable with the untracked eval results; it takes `--untracked-scope=exclude` with
  the inventory hash.
- The first T10 commit failed on CI (`template-block.test.mjs:38`): the new `rule:` mention was removed.
- The engram mirror `odd/f8-s3-split/tasks` failed: the session is bound to project `f8-s0-baseline-3c1077`, not
  `js-harness`. The task file is the record.

## Left
- After landing: the `/context` check after a restart, and the fixed load over five sessions (the orchestrator).
- The directives pass, in a new session before S1 (the orchestrator starts it).
- Follow-ups: `rule:memory-feedback-home` and the memory guard read only `AGENTS.md`; `rules.mjs:515` reads
  `AGENTS.md` and `README.md` as texts in force, not `CLAUDE.md`.

## Cost
- Incident rerun `f8-s3-incidents`: $16.95 for 40 trials; both arms 13 of 20 (L 13, worse below 10).
- Codex: seven reviews recorded (0.86 to 0.98, one P2 fixed). gentle-ai: an assessment per slice, all medium and
  not due.
- Context at the end: about 38%, after one compaction by the host.

# JH 98 · rules: apply his two typed rule changes

## Goal
Apply the two rule changes JH 96 drafted, now that he has typed both sentences: the one list of what is his to decide
(T4 of `odd/tasks/instruction-homes.md`) and the retirement of `work-sessions-private-windows` (T7), one rule a commit
and one pull request each, plus the two `- Seen:` lines owed to `docs/FAILURES.md`. The opening was the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T14-04-48-590Z-86af34b2.md`.

## The user's words
- Q113, the lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f` line 30759 (2026-10-30T14:00:52Z), typed: "Lo que
  decido yo es una sola lista, en una regla: gasto fuera del plan, todo lo irreversible, las decisiones de producto,
  publicar, credenciales, cambios de protocolo, ajustes de seguridad o del sistema, lo que se instale o cambie en una
  máquina, un cambio del plan o de su orden, y un informe publicado fuera del proyecto; los demás textos nombran esa
  regla."
- Q114, the same transcript line 30812 (2026-10-30T14:04:18Z), typed: "Retira la regla de máximo 3 sesiones de trabajo
  en Windows; el número de sesiones se decide caso por caso."

## Delivered
- PR 701 (`rule/his-decisions`), ready notice sent at 09:45 local:
  - `665baea7` feat(rules): `rule:owner-decisions`, made with `rules change owner-decisions`; home
    `js-harness-protocols` section 1; CLAUDE.md, protocol 7, the init block (`claudeBlock`) and the orchestrator's
    permit relay name it. Tests that pinned the old wording, the init block's hash, `project.mjs`'s line ceiling and the
    coverage register move with it.
  - `e5454da4` docs: the feature document (S21, T4 done, L14, L15, T8, T9) and `docs/FAILURES.md`'s two new entries,
    `command-handed-untested` (relief file line 1963) and `written-question-buried` (lead transcript line 30745);
    `asked-yes-not-his` names the sentence of protocol 1 that still holds.
  - `09ea0927` docs: the reviews of the slice (L16).
- `rule/retire-work-sessions-windows`, from origin/main, holding only this summary; T7's change is not made yet.

## Decisions
- This session: the id is `owner-decisions`, not the draft's `his-decisions`. The id is written into the skills every
  project installs, and `bin/lib/manifest.test.mjs:3079` holds the shipped orchestrator text to never say "his"; the
  first run with the draft's id failed it. Its relief line (`rule:his-decisions proposed ..., 2b052eb3d24f`) stays in
  the relief file, superseded in fact by the `owner-decisions` line written six minutes later.
- This session: the two failures are new entries, each with its control owed by an open task (T8, T9), because no
  existing entry is about a command run on his machine or a question that did not read as one.

## Failures and lessons
- T7 cannot run while PR 701 is open. `node bin/js-harness.mjs rules change work-sessions-private-windows --dry-run` on
  `rule/retire-work-sessions-windows` exits 1: "rule/his-decisions holds a rule change not on origin/main
  (owner-decisions): one change is open at a time". The brief asked for both PRs at once; the command allows one open
  rule change across every `rule/` branch. Lesson for the brief: two rule changes are two sessions in sequence, or one
  session that waits for the first land.
- Claude Code stopped this session's background wait for PR 701 to land (low memory, about 10:00 local); not restarted,
  as its notice said.
- The first draft of the failure controls wrapped their phrases outside an unchecked task, so `failures` read them
  "owed, stale"; an owed phrase is looked up only inside an open task (`bin/lib/failures.mjs:329`). Fixed before the
  commit with T8 and T9.

## Left
- T7, once PR 701 has landed: on `rule/retire-work-sessions-windows`, merge origin/main, then
  `node bin/js-harness.mjs rules change work-sessions-private-windows` with this change on standard input:

  ```json
  {
    "retire": { "successors": [] },
    "source": {
      "kind": "words",
      "quotes": [{ "session": "0f71b2c6-cbce-43ca-a031-276a4b2c381f", "line": 30812 }],
      "reading": "The cap of three work sessions open at one time when only Windows is used is retired with no successor: the number of sessions is decided case by case. The caps for a public repository and for a private one used with WSL stay as they are.",
      "accepted": "He chose to retire it in question 71 (lead transcript 0f71b2c6-cbce-43ca-a031-276a4b2c381f, line 28610, tapped \"Retirarla\"), and typed the retirement itself at line 30812 (2026-10-30T14:04Z) in answer to question 114, which asked for his own words for this change (odd/tasks/instruction-homes.md, S20, S21, L13); the reading is his to correct when he reads the pull request."
    }
  }
  ```

  Then `rules check`, the
  coverage register (`work-sessions-private-windows` has an owed control there), the gate, Codex and the lenses, T7
  checked off in `odd/tasks/instruction-homes.md`, a PR and a ready notice.
- T8 and T9: where the two owed controls are written is the lead's to route.
- `two-blocks-out-of-order` reads "control lost" on origin/main as well: its phrase left AGENTS.md before this session.

## Cost
- Time: start about 09:05 local, PR 701 ready at 09:45 local.
- Context: about 45% at the end.
- Reviews: one Codex review of 035e3250..e5454da4 (76,235 input tokens, 29 s), correct (0.93), no findings; Claude lenses
  readability and reliability, 0 findings; gentle-ai assess, medium, not due. The Stop hook's branch-wide gentle-ai
  candidate (from a2b801fb, the merge of main included) was read with `review status` and not started.
- Gates: one `npm run check` by hand (exit 1: four tests, fixed), three pre-commit gates, PASS each, and the pre-push
  checks.

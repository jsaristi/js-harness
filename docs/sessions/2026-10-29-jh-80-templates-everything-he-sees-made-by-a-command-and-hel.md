# JH 80 · Templates: everything he sees made by a command and held by a gate

File: docs/sessions/2026-10-29-jh-80-templates-everything-he-sees-made-by-a-command-and-hel.md.

## Goal
Make every output he sees again and again come from a command and pass a gate that refuses a hand-made one: a
template of five parts (his approved sample, the command that renders it from records, a golden test, a gate on
the path to him, a refusal test), with escapes listed by a check, each escape a FAILURES `Seen:` line and a test.
The brief: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-29T03-04-51-038Z-a9629743.md`; the feature
document: `odd/tasks/templates.md`.

## The user's words
His five lines are quoted in `odd/tasks/templates.md`, `## Specs`, read with `js-harness sessions --quote` from
0f71b2c6 lines 14721, 14832, 14968, 15080 and 15262. Two more of his reached the work through the lead and were
read the same way: 0f71b2c6:17978 (08:15:26Z, question 108, "Sí, apruebo esta forma (Recomendada)"), the approval
of the question card that is the first template's sample; and 0f71b2c6:18204 (08:29:41Z), "Listo muestrame lo
proximo que se viene y SIEMPRE peror SIEMPRE debes darme la razon del por que osea cual es el criterio".

## Delivered
- PR 648, merged 04:21Z: the design (T1, T2), after two blind readers (Claude 5/10, Codex 5/10; every point taken
  in, `odd/tasks/templates.md` L5).
- PR 649, merged 05:42Z: `template new`, the registry, `template check` and `template list` (slice A, T3).
- PR 653, merged 08:07Z: `template gate --hook` (PreToolUse) and `--shown` (PostToolUse), the rendered and shown
  records, `template shown` and the `templates` doctor row (slice B, T4; high risk, installer: install grafts both
  hooks and uninstall leaves settings.json byte for byte, proved in a scratch home and by an independent verifier).
- PR 656, merged 09:43Z: the questions to him as the first template, end to end: `template ask <n>` renders a
  recorded question, the gate refuses an `AskUserQuestion` that is not that render, `template shown` names an
  answered question never shown as an escape, `docs/FAILURES.md` holds `hand-made-output`, `harness.json` turns
  templates on, and `report-status` refuses a proposal with a blank why (slice C, T5).
- PR 660, merged 10:35Z: `rules change rules-live-in-the-harness`, the protocols skill's line that an output he sees
  again and again is cemented as a template of five parts, asked for in one `Plantilla:` line (T6).
- PR 662, merged 11:43Z: `rules change status-report`, item 6 of the status report: each proposed step with its why, the
  criterion (L8).
- Done when, checked: `js-harness template check` prints "templates: 1 registered, every part present", exit 0;
  `bin/lib/template-check.test.mjs:102-104` proves it fails on a planted missing part; `npm run check` passes (the
  pre-commit hook on every commit); no eval spend.

## Decisions
- The lead: one gate, owned by JH 80; JH 79's pages call `recordRendered` (L4).
- The lead: the slice B surface (manifest hook registration, practice-lib, a doctor row) and one independent
  verifier for the installer change (L6).
- The lead: the proof converts the questions, not the board rows, which are JH 79's (L6).
- The lead: route (b) for the gate's messages, cut into `GATE_SAYS` and declared in the coverage register (Next
  step, ~06:20Z).
- His: the question card's shape, question 108 (L7).
- His: every proposed step with its criterion (L8), carried by PR 656's check and PR 662's rule.
- This session: a rule changed after the coverage baseline names a protocol control, not a check (below).

## Failures and lessons
- A swap script overwrote a function with a call to itself (infinite recursion); found by the tests, fixed by hand.
- An accidental `git checkout` of a commit detached HEAD; returned at once, nothing lost.
- PR 660 conflicted after main took 70cf8bee by a second merge of PR 656, which the branch carried as a
  cherry-pick; resolved by keeping the branch's copy of the one document, which only added lines (`git merge-tree`
  first).
- A check-level control on a rule declared after the coverage baseline breaks 8 tests of `bin/rules.test.mjs` and
  `bin/rules-coverage.test.mjs`: their fixture (`owedRegister`, `bin/rules.test.mjs:34-41`) turns every check into
  owed, which such a rule cannot be. PR 662 uses a protocol control instead; the fixture is a follow-up for the lead.
- The worktree guard refuses compound shell forms (`git -C`, redirects with git, heredocs in a chain, `bash` of a
  script inside a chain); plain commands and scripts in the job's tmp work.

## Left
- The board rows, the board summary and the other inventory rows are templates still to make, one `Plantilla:`
  line each (the lead holds the order).
- The evals that measure judgment are defined in the design and not run (no eval spend in this brief).
- The three directive spans of `template-gate` stay context; tying them to the amended rule is optional.
- The rules tests' fixture and check-level controls on post-baseline rules (above): the lead's call.

## Cost
- Time: brief at 03:04Z; this summary at 12:30Z, the closed notice after it. Context at the end: 31% at the
  last notice (11:31Z), after four compactions by the host (04:33Z, ~07:10Z, 08:08Z and 09:52Z, as the
  feature document and the resume hook record them).
- Reviews: Codex on every code commit (findings: 2 P2 slice A, 6 + 1 + 2 P2 slice B, 0 slice C and D); Claude
  lenses on every code commit (0 findings throughout); gentle-ai 9 lineages (`odd/tasks/templates.md`, its gentle-ai lines), all approved and acknowledged, every
  non-blocking finding that held taken with a test. One
  independent verifier (slice B's installer change); two blind readers on the design.
- No eval spend.

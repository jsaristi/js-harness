# JH 202 · cementar el dogfooding: lo hecho a mano se vuelve arnés

## Goal
Cement in the harness that a manual workaround gets a follow-up that builds it in, and track the four workarounds of
2026-11-14. Opening: the brief `C:\Users\Oficina\.js-harness\background\briefs\2026-11-15T06-16-09-492Z-f189d111.md`.

## The user's words
- "Recuerda que todo lo que estamos haciendo es dogfooding y la idea es que todo esto quede aplicado y cementado en el
  arnes que estamos construyendo" (orchestrator transcript `69918425-3b43-430f-9f50-62b6422422ce`, line 10967,
  2026-11-15T01:31:18Z, read with `js-harness sessions --quote`).
- "Cementalo en alguna parte y documentalo para que no se nos quede en memoria y se pierda" (same transcript, line
  11014, 2026-11-15T01:32:27Z).

## Delivered
- Pull request 880, `rule/cement-workarounds`, ready, not merged:
  - 4c419173: `odd/tasks/cement-workarounds.md` opened (contract, depth pass, new-rule answers, the check not built).
  - fcdc884a: `rule:rules-live-in-the-harness` amended through `node bin/js-harness.mjs rules change` (relief line
    "declaration and source 313912e18f1e"); the bullet is in `bin/lib/protocols-skill.mjs`, after the template one.
  - 01bcbaad: four Later lines in `docs/ROADMAP.md`, each with its owner, day and source.
  - later docs commits: the reviews, the state, and the correction that the new clause has no sensor.
- Outside the repository: the memory note `dogfood-cement-everything.md` rewritten as a pointer to the rule, and its
  `MEMORY.md` line with it.

## Decisions
- Amend `rules-live-in-the-harness` instead of a new rule (this session, after `js-harness rules` and `AGENTS.md`
  were searched; `odd/tasks/cement-workarounds.md`, depth pass item 4).
- No new check, per the brief's default (his priority over the audit's list); what would do it and its cost are
  written under "The check not built".
- The owner of the follow-up is "a session or a roadmap entry named in the same reply": the lead's precision in the
  brief, recorded in the rule's `accepted` as not put to him.

## Failures and lessons
- The first dry run of `rules change` left the subject unchanged: `subject` goes under `set`, not at the top level.
  Seen in the dry run's output; fixed before the real run.
- The feature document first said the rule had a sensor (the guard on memory notes). The advisor found it does not
  see a conversation; corrected in a docs commit.

## Left
- The `- Seen:` line in `docs/FAILURES.md` for the worktree a land removed: owed, from the lead's transcript lines;
  held by its roadmap entry.
- The four follow-ups themselves, held by their roadmap entries.
- While pull request 880 is open, `rule/cement-workarounds` blocks other `rules change` runs (one change at a time).

## Cost
- Time: brief at 06:16Z, ready about 07:05Z.
- Reviews: Claude lenses readability and reliability once (9,062 and 9,060 input tokens, 0 findings); Codex once over
  the one code commit (61,803 input tokens, 42,240 cached, verdict correct at 0.94). No rerun on the docs commits.
- Gates: the pre-commit gate on each of seven commits, all PASS; GitHub gate runs of 06:25Z and 06:40Z, success.
- Advisor: two consults.

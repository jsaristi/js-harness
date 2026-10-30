# JH 96 · rules: one list of what is his

## Goal
Make two rule changes through `js-harness rules change`, each on its own `rule/` branch with its own pull request:
`his-decisions`, one rule that holds the union list of what is his to decide (Q62), and the retirement of
`work-sessions-private-windows` (Q71). The opening was the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T10-39-10-514Z-8549ce57.md`.

## The user's words
- Q62, the lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f` line 28485 (2026-10-30T10:11:19Z), tapped:
  "Una lista, la unión (Recomendada)".
- Q71, the same transcript line 28610 (2026-10-30T10:27:32Z), tapped, read with `js-harness sessions --quote
  0f71b2c6-cbce-43ca-a031-276a4b2c381f 28610`: "answer (tapped): Retirarla".

## Delivered
- `c93b1f3f` on `rule/his-decisions`, pushed, no pull request: `odd/tasks/instruction-homes.md` gains S19, S20, T7,
  "Draft for T4 and T7" and L13. The draft holds the rule's home, its phrases, the four texts that will name it, the
  retirement, and the sentence he must type for each change.
- This summary, on the same branch.
- Not delivered: neither rule change, so neither pull request exists.

## Decisions
- The lead (channel note, 05:41 local, and a direct message): run `--dry-run` first; if it is refused, draft the changes
  in `instruction-homes.md` and send a waiting notice with his sentences. Done, waiting notice at 05:46 local.
- This session: the home of `his-decisions` is `js-harness-protocols` section 1, because it ships to every host and
  project. Recorded in the draft, and his to correct.
- This session: the work goes back to the lead now instead of waiting for about 3 hours, because Claude Code stopped
  the background wait for low memory and said not to restart it.

## Failures and lessons
- `js-harness rules change work-sessions-private-windows --dry-run` exits 1: "line 28610 of 0f71b2c6-... is a tapped
  answer: the option's text was written by a session, not typed by him". The brief was built on tapped answers, which
  the same check refused for N7 on 2026-10-24 (`instruction-homes.md` L3). The lead's note had already caught this
  before the dry run. Lesson for the brief: when a rule change of his is planned, get his typed sentence before the
  session opens.
- The first commit carried `Co-Authored-By` and `Claude-Session` lines, which `CLAUDE.md` forbids. The message was
  fixed by an amend before the push (`c93b1f3f`).
- Claude Code stopped the background `js-harness wait --notice-to 96` for low memory at about 06:17 local. It was not
  restarted, as the system notice said.

## Left
- Held by the lead: getting Sebastián to type the two sentences in `instruction-homes.md` L13, then a session that runs
  `rules change his-decisions` on `rule/his-decisions` and `rules change work-sessions-private-windows` on
  `rule/retire-work-sessions-windows`, one pull request each.
- N17 (the Codex meter lines that live only in memory): noted in the draft, not drafted; the lead routes it.

## Cost
- Time: first notice 05:46 local (waiting), last 06:18 local (note), plus the closed notice.
- Context: about 30% at the end.
- Reviews: one gentle-ai lens, `review-reliability`, approved (lineage `review-962e92063110575b`). No Codex and no
  Claude lens review, because there is no code.
- Gates: two pre-commit gates (the commit and its amend), both PASS, and the pre-push check.

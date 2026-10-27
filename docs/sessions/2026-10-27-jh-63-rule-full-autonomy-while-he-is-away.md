# JH 63 · rule: full autonomy while he is away

## Goal
Apply his words of 2026-10-27 with `js-harness rules change`: the lead asks nothing and seeks no permission while he is away. Opened in the background by the lead with the brief `~/.js-harness/background/briefs/2026-10-27T18-30-30-641Z-980f727f.md`.

## The user's words
"no me pidas permiso y que voy a estar ausente si te digo que te dejo solo debes tener la mayor autonomia" (lead transcript 0f71b2c6-cbce-43ca-a031-276a4b2c381f, line 1478, read with `js-harness sessions --quote`), answering the lead's reply at line 1406, which listed approvals and a spend above a few dollars waiting for him.

## Delivered
- PR 609 (ready, not merged), branch `rule/away-autonomy`:
  - 56efa3f8 `rule:away-autonomy` added (owner his), its text in the orchestrator skill (`bin/lib/manifest.mjs`, the recap's away bullets), the charter sentence and the permit relay's card line pointing to it, test pins in `bin/lib/manifest.test.mjs`.
  - 238ee185 `ask-before-away` retired, successor away-autonomy; its line removed and asserted gone.
  - the feature document `odd/tasks/rule-away-autonomy.md` (contract passes), and this summary.

## Decisions
- This session: retire and replace rather than rewrite ask-before-away in place, since half of its meaning reverses (`odd/tasks/rule-away-autonomy.md`, Goal).
- This session: his words name no limit, so the limits are pointed at their homes (CLAUDE.md/AGENTS.md, the charter, the permit relay) and wait with no question; not a shorter copy (L2, L3).
- This session: the trigger takes "or will be away" (L2). The aim of his 2026-10-11 ask stays: what only he can give is said in that reply as a fact.
- The lead's reading was followed except for its short list of what stays his, which both readers found narrower than the rules in force (L3).

## Failures and lessons
- The first commit failed on CI: `bin/conventions-structure.test.mjs` found `bin/lib/manifest.mjs` 1 line over its ceiling (2160 > 2159), though the local run of that test had passed. Fixed by taking a blank line in T1 and giving it back in T2.
- An edit removed a line with its leading newline and glued two bullets; caught by the structure test (2158 lines) and fixed before the commit.
- The docs commit failed `rules check`: the feature document named the retired rule in `rule:` marks; rewritten as plain text.

## Left
- `askingRule` (`bin/lib/sessions.mjs`) and `bin/resume.mjs` (lines 405, 408, 448) still print "ask now" or "repeat an open question" with no away state; the skill now ranks this rule above them. A later code change; the lead's to place.
- The memory notes `MEMORY.md` ("Before he leaves") and `ask-before-he-leaves.md` name the retired rule; outside the repository, the lead's to repoint to `rule:away-autonomy`.
- The installed copy the lead reads changes only after PR 609 lands and the copy is refreshed (`merge-queue --land --refresh-copy`).
- Sessions opened while he is away run in his default permission mode; this rule does not change that.

## Cost
- Time: opened 13:31 local, ready 14:07 local.
- Context: 35% at the ready notice.
- Reviews: two readers (Opus 5.5, high; about 75k and 97k tokens); gentle-ai not due on both commits (under_budget); one Codex review, f21f305..238ee18, 75,528 input tokens, 29 s, correct (0.88), no findings.
- Gates: five runs of `npm run check` (two red: the line ceiling on CI, the retired-rule marks locally; three green).

# JH 109 · host watch: S9 watches Claude releases

## Goal
F8's S9 becomes the host watch: each Claude Desktop update doctor sees gets a session of its own that reads both
changelogs and the app's tool list and writes the review file `doctor --host-reviewed` asks for. Brief:
`~/.js-harness/background/briefs/2026-10-30T19-04-31-721Z-b0e55be3.md` (resumed from
`2026-10-30T20-15-37-604Z-6d3eb365.md` after a restart). Feature document: `odd/tasks/f8-s9-host-watch.md`.

## The user's words
The lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, read with `js-harness sessions --quote`: line 33399 (a
session that researches each new release in depth), line 33574 (the harness serves Claude Desktop's Code tab alone,
with Codex as reviewer), and question 129, line 34781, "Sí, súmala (Recomendada)", which also says "No cubre adoptar
nada sin tu sí." This session asked him nothing directly; question 131 is recorded for the lead to ask.

## Delivered
- PR 716, merged 20:35:38Z: the plan, graded by two blind readers and revised; the ROADMAP's S9 with his three lines.
- PR 717, merged 21:36:24Z: `bin/lib/host-watch.mjs` and `bin/host-watch.mjs` (`draft`, `check`, `tools`), the gate
  of `--host-reviewed` holding each changelog to its span.
- PR 718, merged 22:00:56Z: the trigger. `loop heartbeat` ends with a `HOST:` line that names the session an update
  needs, `host-watch brief` prints its brief, and the `host-update` row's fix names that session.
- PR 719, to main: the first real review, `docs/host-updates/claude-desktop-4.4212.0.md` (Desktop 4.29.0 → 4.4212.0,
  CLI 2.1.308 → 2.1.309). It has 113 rows: one adapt (`sessionStatusLine`, question 131) and 112 ignore. Also in it:
  both tool lists as baselines, the acceptance test, map rows 1 and 14, and two classifier fixes. Spanish page:
  https://claude.ai/artifact/NL5RU96pRQ6cwXBHkoLCNh.

## Decisions
- This session: every row's decision and reason (the review file); no adopt; one adapt, which goes to him as
  question 131 and is not acted on.
- This session: an entry that names the Code tab on its own is never drafted outside it (desktop #24 had been).
- The lead: its Code tab tool list, `~/.js-harness/research/host-watch/tools-desktop-lead.txt`, is the desktop
  baseline, since a background session has none of the Code tab's servers.

## Failures and lessons
- All 20 commits of this feature carry `Co-Authored-By` and `Claude-Session`, which `CLAUDE.md` forbids. The
  session's own summary of its rules, carried over two compactions, listed them as required. Nothing is rewritten.
  This is the third sighting of `commit-attribution-from-host` (`docs/FAILURES.md`), and the `commit-msg` check
  was proposed to the lead.
- L10 of the feature document claimed no entry named the bypass `rm` prompt. That was wrong (code 2.1.309 #6), and
  L12 corrects it. The search split the table with a header filter, `startsWith('| Change')`, which also matched
  every row starting with "Changed".
- A hand `check` in the WSL mirror, without `.git`, skips `gentle-ai-absence`, and a later commit of the same code
  reuses that pass as `same`. Two commits entered that way (L8). Told to the lead, not fixed here.
- `renderBrief`'s text is sent to an agent, and S5c's coverage register does not list it. Open for the lead.

## Left
- His: question 131 (`sessionStatusLine`).
- The lead: landing PR 719, then `doctor --host-reviewed` from the main checkout records 4.4212.0 / 2.1.309; the
  `commit-msg` check; the gate hole of L8; the brief in S5c's register.
- Windows and phone are `unknown` on every row of the review.

## Cost
Two compactions, two context pauses, one restart. Codex: 7 recorded reviews over the code slices (records in
`.git/js-harness/codex-reviews.jsonl` whose heads are this feature's, `dad0db39` to `de970bec`), plus one run that
wrote no record because a file changed while it ran; the last used 120,021 input tokens. Claude lenses: 7 recorded
runs, two to three lenses each. gentle-ai: 2 reviews (reliability), on `dad0db39` and on T5's slice, both approved,
their 6 advisory findings fixed. The fix of R3-001 and R3-002 is reviewed by Codex and the lenses in the same
PR. Gates on CI: one per commit. Two failed, and each was read before the next run: T4's first commit (L9) and T5's
split (L12).

# JH 185 · the model trial: Opus 5.5 with a Fable 5.2 advisor against Fable 5.2 medium

File: docs/sessions/2026-11-11-jh-185-the-model-trial-opus-5-5-with-a-fable-5-2-advisor-aga.md. Facts with their evidence (a pull request, a commit, a path:line, a command and its output), not prose: the file is read later to reverse-engineer how the work went. Commit and push it, then close with js-harness notify --to orchestrator --kind closed --summary <this file> "<what you delivered>".

## Goal
Design a three-arm trial (Fable 5.2 medium; Opus 5.5 high with the Fable 5.2 advisor; Opus 5.5 high alone) on real
code and bring its cost to him before anything runs. Opened by the lead's brief,
`~/.js-harness/background/briefs/2026-11-11T21-39-01-129Z-afde2b0c.md`.

## The user's words
"Me gustaria que investigaramos si seria mejor seguir utilizando Fable 5.2 Alto solo en el orquestador y Opus 5.5
para las sesione sy subagente pero con el Advisor de Fable 5.2 alto que te parece?" (lead transcript
`f0959bbd-5f7a-4360-b626-048caf21067f`, line 2320, read with `js-harness sessions --quote`); his tapped answer to
question 264, "La prueba de modelos primero (Recomendado)" (line 2446).

## Delivered
- `odd/tasks/model-trial.md` on branch `worktree-model-trial`, pushed, no pull request: commits 9a1186eb (first
  design), c3218bb1 (first review taken), fba90f5e (two gates), and this summary's commit. Not approved: the design
  did not pass its third double review.

## Decisions
- This session's: the eval suite's coding cases cannot tell arms apart (60 trials, 0.976 to 1.00, L6); tasks A and B
  of the first design replaced by JH 125's tasks (L7); the trial split into a pilot gate and a stage-1 gate (L8).
- His, pending: how to go on with a design that failed its third review (question to the lead, this session's last
  notice).

## Failures and lessons
- Bad news first: after three double reviews (21, 24 and 18 findings) the design still has real failures; the work
  passes to the strongest model (`rule:double-review`). The weightiest was found by the third reader, not by this
  session: his own words of 2026-11-10 (`odd/tasks/one-model-home.md` S1, S7) say he measured Fable 5.2 high better
  than Opus 5.5 max in price and intelligence, and that sessions went to medium only because the Fable limit stopped
  them. The search of his earlier words that `rule:double-review` asks of the writer was not made before the first
  read; it would have reframed the trial around the weekly Fable limit from the start.
- Twice this session wrote a commit hash into the document before reading it (85b5b8a1, 2db1fbd8), both corrected
  before commit by reading `git log`.
- `sessions start` refuses arms 2 and 3 (`bin/sessions-background.mjs:167-173`); the brief's assumption that an arm
  names its model on `sessions start` does not hold.

## Left
- The 18 findings of read `d219135d`, listed in the document's `## State after the third review`: for a session on
  Fable 5.2 (the lead's to open, his to approve).
- No run, no rule change, no build: none was authorized.

## Cost
First notice 16:39 local, last after 17:30 local; about 90 % of the context at the end. Double reviews: three reads,
Claude 1,133,980 + 1,494,173 + 1,967,723 tokens, Codex 498,905 + 397,488 + 585,029 tokens (about 1 % of Codex's week
each, by the plan's measure). One web-fetch sub-agent (23,273 tokens). Gate runs: three, one per commit, all PASS. No
Codex code review or lens run: documents only.

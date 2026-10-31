# JH 125 · /advisor trial: does a Fable advisor make better plans?

## Goal
Measure, on two tasks already done (JH 124's rule 1 and JH 123's departure check), whether an Opus 5.5 session with
a Fable advisor plans better than without one, and what each run spends. Opened by the lead's brief
`~/.js-harness/background/briefs/2026-10-31T15-27-52-474Z-79ced74a.md`; feature document `odd/tasks/advisor-trial.md`.

## The user's words
- Question 149, answered "Sí, con dos tareas" (tapped), lead transcript `0f71b2c6`, line 44747, 2026-10-31T14:15:33Z
  (`js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 44747`, read this session).
- 14:16Z, as the brief quotes it: "Por favor midamos cuanto uso nos gasta y revisamos en tiempo real y me pasas el dato
  cuando vuelva." (not quoted from the transcript here; its line was not given).

## Delivered
- PR 740, `feat(sessions): start --advisor passes claude --advisor and records it` (f36c272f, branch
  `advisor-option`): open, ready notice 15:44Z; left out of one land on two WSL stop-budget timing tests the lead reads
  as load (feature document L6).
- `odd/tasks/advisor-trial.md` on `worktree-advisor-trial`: the key, briefs and criterion fixed in 2b2fea3a before any
  arm; the arms, verdicts and result after.
- Four plans and the arm briefs in `D:\advisor-trial-arms\` (`plans\`, `briefs\`, `usage.js`).
- Result: criterion not met. Task A: Fable 5 of 16 defects anticipated, without 3 (+2). Task B: 3 of 13 each (0 with
  partial names counted, +2 without). Fable cost 2 calls an arm, about 248,000 and 283,000 input tokens.

## Decisions
- Task A's base is b5bf7484 (the rule decided, nothing built) and its key is what was found after it; this session's
  reading of the brief's "b5bf7484's parent line, before 1722be2d" (feature document, Tasks and bases).
- Task B's base and brief were read from git (`git merge-base 3ac49fa8^1 3ac49fa8^2` = 6bee9e5b) and the start record,
  not asked of JH 123, because its branch had merged as PR 739 (this session).
- Arms read a `git archive` copy with no `.git`, not a worktree, so `git log main` cannot show them the work (this
  session; feature document, Constraints).
- Arms ran under `D:\` because `claude --bg` refused an untrusted home folder and accepting trust writes
  `~/.claude.json` (this session; L7).
- Arms started with the worktree's own `node bin/js-harness.mjs` while PR 740 waits (the lead, 15:53Z; L6).
- On task B a partly named defect counts as named, the criterion's word, so the criterion is not met (this session;
  `## Result`). Adoption stays the user's.

## Failures and lessons
- The first arm start failed on "Workspace not trusted"; found by `sessions start` exit 1; the arms moved to `D:\`,
  same briefs by sha256 (L7). A trial folder needs a trusted parent before the first start.
- A `sed` replacement with `\a` and `\u` in a Windows path wrote control characters into task line 40; found by
  reading the line back, rewritten with a script that checks for control characters.
- One plan named the advisor once; the scorer's copy was redacted ("after advisor review" to "after review") before
  scoring, recorded in `## Arms`. A blind check greps the plans for the variable's name first.
- The fixed criterion did not say how partial names count, and on task B that decides the verdict; the next trial
  fixes it beforehand.

## Left
- PR 740's land: the lead.
- This branch's PR (the feature document and this summary): ready for the lead to land.
- Adopting the advisor or running a larger trial: the user's decision, with `## Result` and its limits.
- `D:\advisor-trial-arms\` stays as the trial's record; deleting the folder removes it.

## Cost
- Time: first notice 15:44Z (ready, PR 740), arms 15:55Z to 16:32Z, close after 16:40Z.
- Arms: executor 32 to 78 input, 1.35M to 4.57M cache read, 111k to 130k cache creation, 14k to 33k output each;
  Fable 530,477 input and 38,941 output over 4 calls; 3.2, 10.4, 12.2 and 6.6 minutes. Probe: 1 Fable call, 64,485
  input. Plan meter: the lead read it at each note; this session did not.
- Reviews: one Codex review of 3ac49fa..f36c272 (72,063 input tokens, correct, 0.97) and one lens run (reliability,
  readability: 0 findings). Subagents: two key extractors (108k and 122k tokens) and two scorers (69k and 70k).
- Gate: `npm run check` PASS on each of the four commits' pre-commit hook. Context at the end: about 46%.

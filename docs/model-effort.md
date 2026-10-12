# Model and effort by kind of work — version 2 (after the double review)

Copied into the repository on 2026-10-12 by the session of the rule hierarchy, from the
orchestrator's scratchpad, so that the plan no longer rests on a file outside git. Below this
paragraph nothing is changed: it is the text he decided on, and it says "today" of 2026-10-11.
What he decided (the orchestrator's transcript `130317af-a818-419c-a3de-3a21335db0a8.jsonl`, both
lines read by that session): line 2037, the table of A is applied and he is told the mode each
kind of work calls for; line 2891, "Sí, que entre al plan", the first item of F: B and the free
measurements C1, C2 and C4 are tasks of the two sessions E names. The measurements that spend
(F2) and the three openings of his rule (F3) are not decided.

Written 2026-10-11 by the orchestrator of js-harness for Sebastián's decision. Version 1 was read
by two independent read-only readers (one attacked it, one looked only for what was missing);
"What the review changed" at the end lists what each one moved.

## His words on the subject (typed, by transcript line)

- 2026-09-29, 5681bf00:679: "de ahora en adelante en codex vamos a utilizar el modelo:
  gpt-6.1-sol high"; and 5fe7b5a8:5: "con xhigh es perfecto para review pero dependiendo de
  como nos va en uso nos pasamos a high".
- 2026-10-06, 71ccf3e5:1116: the Codex review on Sol 6.1 at medium; 2026-10-08, 77a27016:4208:
  "solo permitiremos sol 6.1 en high".
- 2026-10-07, 729ed66b:7049: effort high on every sub-agent.
- 2026-10-10, 182ad401:990: "solo para codificar quiero el haiku pero de resto … debe ser minimo
  opues 5.5 alto o fable 5.5 alto … ningun otro modelo hasta la fecha".
- The document he wants, 593da809:1016 and :1055: "un documento vivo … a medida que se vayan
  haciendo los cambios este se actualice", to "crearlo mejor y desde cero solo con ese
  documento"; docs/ROADMAP.md:565-566 records that it says what the harness does, "never how it
  is coded today".
- 2026-10-11, 130317af:2037, :2489, :2671: apply the effort research and always tell him the
  mode each kind of work calls for; Haiku for documentation "con el mejor esfuerzo relacion
  calidad-precio"; by feature, with the orchestrator and different models and efforts; decided
  with the research and with tests; go on with it.

## Goal

Each piece of work runs on the cheapest model and effort that keeps its quality. The choice is
made by a measurement, written in one place, applied and checked by the harness, and he is told
it. High is the default; anything below it is an exception with a source and an end.

## A. The table today, with who decided each row

| Kind of work | Model, effort | Decided by |
|---|---|---|
| Everything not named below (design, a protocol, verification, review, orchestrating, a task with no contract) | Opus 5.5, high | his words, 2026-10-10 |
| A sub-agent that writes scoped code | Haiku 5.5, effort high on the call | his words, 2026-10-10; measured in repo on the `write` arm only (18 trials, tasks at the ceiling): same score, 89 percent less sub-agent cost; today six writers in two sessions, none wrong twice |
| Sub-agents that explore, review, verify | Opus 5.5, high | a reading of "de resto"; never measured: the eval's explore and verify arms exist and were not run |
| Main thread driving a closed-scope build | Opus 5.5, medium, as a trial only | his "apliquemos lo que investigaste" of today; it opens his rule of 2026-10-10 and becomes a rule only by C2 |
| The Codex review | gpt-6.1-sol, high | his words, 2026-10-08; measured that day: medium gave the same answer, high cost 2.8 times the input on the real range, one run a cell |
| A Codex work session | gpt-6.1-sol, high | his words, 2026-09-29; his machine's config says another level today (see G) |
| Documentation | not decided | — |

Never low. Above high only with a measurement.

## B. The mechanism in the harness

1. One home. The table is rows of the rules list (bin/lib/rules-data.mjs, on feat/rules-list,
   not on main yet). Each row carries its value, its source (his words by transcript line, or a
   measurement by file), the engine version and model id it was checked on, and its date. A
   change is the rule-change command's commit. A new engine version or a new model marks the
   rows stale until checked again; the session that finds it tells the lead, the lead tells him.
   Rows are marked shipped or local: the package ships bin/, so a row that is only this
   repository's way of working must not ship as a project's rule, and his words
   (docs/rule-sources.json) never go under bin/.
2. Effort by task, not by document. Today a contract holds one `## Effort` for a whole feature
   (bin/lib/contract.mjs:25-32) and fifteen contracts state one; a feature has design tasks and
   build tasks. Proposed: each task of the checklist names its kind of work; the effort and the
   writer's model follow from the table; `js-harness contract goal` prints them.
3. Applied, and checked. With an orchestrator in the desktop app: it sets the session's effort at
   the task's start; medium ends with the task (back to high without being asked), and a design
   question inside a medium task returns the session to high first. Without one (an installed
   project, the terminal, Codex): the shipped session-start hook and `contract goal` print the
   mode the task calls for; nothing is forced. In both: the level a task really ran at is read
   from the session's records and a row of `check` compares it with the table, as INFO. A
   sub-agent call with no model or effort inherits the session's, so in a medium session a
   reviewer would silently drop to medium: the same row reads the sub-agents' records.
4. The writer's model goes on the Agent call, never by `CLAUDE_CODE_SUBAGENT_MODEL`. The alias
   `haiku` gave Haiku 4.5 on engine 2.1.292 (evals/configs.mjs:281-282) and gives
   claude-haiku-5-5 in the desktop app today (read in three sub-agent transcripts): what an alias
   resolves to is checked per engine, as B1 says.
5. He is told. The orchestrator's recap carries one line a session with its mode and why; that
   text ships in the orchestrator skill, not only in a memory note.

## C. The measurements, ordered by saving for what they cost

Sub-agents were about 59 percent of the day's tokens and the fixed prefix of every session and
sub-agent about 22 percent (the orchestrator's count of 2026-10-11, in its transcript, not in a
file); effort moves neither, the model of sub-agents and the number of launches do.

1. Free, now: the Haiku writer in every session (in force), and a count of the day's sub-agents
   by kind (writer, explorer, reviewer, verifier) and tokens, read from their records.
2. Free, running: medium on closed-scope builds, decided by a rule that can fail. Alternate
   medium and high across slices of the same feature. Medium becomes the rule for that kind of
   work only if tokens per accepted line fall and gate failures on the first run, correction
   rounds and severe findings are each not above the high slices. One finding of a missed
   requirement, or two first-run gate failures, returns the session to high and he is told.
   (Version 1's rule counted only findings; at about one real defect a thousand lines it could
   not fail.)
3. Costs sub-agent tokens, his to approve with its figure: cheaper explorers and verifiers, by a
   replay of ten to twenty real briefs of this repository whose right answer is known, not by the
   eval's arms (those tasks are at the ceiling and a weak explorer fails silently).
4. Fewer and smaller sub-agent launches: what the count of C1 shows, turned into a working rule.
5. Costs eval runs, his to approve with its figure: documentation (section D).
6. Last: the Codex review's effort. Already measured once; it spends Codex's allowance, which is
   not the scarce one.

## D. Documentation

His document says what the harness does and why, never how it is coded today. So:

- Interface facts (commands, flags, files written, exit codes): generated by a command, no model,
  kept true by a row of `check`. Internals do not enter it.
- Reasons, decisions, constraints: Opus 5.5 at high.
- Wording, format, translation of verified content, and the update that follows each change:
  Haiku 5.5, at the effort the test below picks.

The test that grades it: a fresh model gets only the documents and rebuilds one capability; it is
graded by black-box tests held out from the documents and by questions that only the documents
answer. Arms: no document at all (what the model rebuilds from habit); facts only; facts with
Opus wording; facts with Haiku wording at two efforts. Version 1 would have rewarded a document
that copies signatures, because the repository's tests import internals.

## E. Who builds what, no new session

- JH 7 (rule hierarchy): B1 and the stale mark; T1 (docs/SPEC.md and the row spec) takes D.
- JH 5 (session channel, orchestrator skill): B2, B3, B5.
- C3 and C5: a later session on the evals; none exists today.

## F. His to decide

1. Whether B and the free measurements C1, C2 and C4 enter the plan as tasks of JH 5 and JH 7.
2. Each measurement that spends (C3, C5), one at a time, with its figure.
3. His rule of 2026-10-10 is opened in three places, each only if its measurement passes: medium
   for the main thread on closed-scope builds; a cheaper model for explorers and verifiers;
   Haiku for documentation wording.

## G. Places that say something else today

To change in the same stretch as the decision: docs/ROADMAP.md:62, :353-360, :539-541;
bin/lib/contract.mjs:25-32 and the fifteen `## Effort` sections under odd/tasks (five say medium;
rule-hierarchy.md:86 says high while its session runs the trial); bin/codex-review.mjs:173-174
(constants); the memory notes subagent-effort-high, effort-by-kind-of-work, claude-models-2026-10,
narrow-writers-no-gate-wait.

On his machine, found by the reader, his to change or to keep: `~/.claude/settings.json` sets
Opus 5.5 to medium by default, and `js-harness remote` (bin/lib/remote.mjs:88) starts a session
with no model or effort, so a session opened from the phone starts at medium;
`~/.codex/config.toml` sets a reasoning effort above the high of his rule for Codex; gentle-ai's
own reviewer agents run on Sonnet (its files, not ours).

## Not guaranteed

- Nothing measures the orchestrator's work, or review quality, by effort.
- How the plan weighs tokens by model is not documented; savings are in list price.
- An installed project gets the table without the measurements: evals/ does not ship.
- What a lead in the terminal can do without the desktop app's effort tool is not verified.

## What the review changed

The reader that attacked: three facts were wrong (the explore and verify arms never ran; the
Codex review's effort was already measured; "explore, review, verify on Opus" is a reading);
C2's rule could not fail and was replaced; applying effort was memory, not harness, so B3 gained
the default, the end of medium and the check; the order of C now follows where the tokens are;
the documentation test gained its control arms; table A gained "decided by".

The reader that looked for what was missing: his earlier words on Codex and on the living
document, which turned D from "facts read from the code" to "interface facts, never internals";
the lifecycle of a row (engine, model id, date, stale mark); every place that says something else
(G); the bypasses (a call without a model, a task without a contract, Codex, the phone); what
ships and what must not; where "always tell me" lives.

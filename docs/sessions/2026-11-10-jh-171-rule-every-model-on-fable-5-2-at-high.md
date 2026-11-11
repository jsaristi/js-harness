# JH 171 · rule: every model on Fable 5.2 at high

## Goal
Correct pull request 812 by his words of 2026-11-10: every session, the lead included, runs at high effort, and every
Claude model the harness picks is Fable 5.2. Each rule by `js-harness rules change` in a commit of its own. Opened by
the brief `C:\Users\Oficina\.js-harness\background\briefs\2026-11-11T02-47-18-243Z-bf34c3f2.md`, resumed after a
restart of the machine by `...\2026-11-11T03-25-31-396Z-5dbfa91c.md`.

## The user's words
"Por que me equivoque, no podemos utilizar Fable 5.2 en Medio sino en Alto y este orquestador en Alto, por favor haz la
correcion ya que medi el resultado y nos sale muchisimo mejor asi [...] haz la correcion completa osea todos los modelos
de ahora en adelante va a ser Fable 5.2 Alto" (transcript ea85ec35-82e1-4aa9-abe3-98bd153a50b0, line 4744, read with
`js-harness sessions --quote ea85ec35-82e1-4aa9-abe3-98bd153a50b0 4744`). And at 22:31 local, line 5167 of the same
transcript: "todo va a ser con Fable 5.2 Alto [...] y que sea TODO".

## Delivered
- Pull request 813, ready, against main: https://github.com/jsaristi/js-harness/pull/813
- fba7beac `session-effort`, medium to high, and the README's `sessions start` example.
- 39e6c55e `lead-effort`, xhigh to high.
- be0bb7a5 the guard (`allowedModels`, `modelRefusal`) takes a model rule with no short name.
- 30e2a149 `subagent-writer-model`, claude-fable-5-2, no alias; the writer agent file; `rules applied` holds a launch's
  model to a sub-agent model rule that has no short name, as information.
- 82b4b9c6 `subagent-reader-model`, claude-fable-5-2, no alias.
- 41603d32 `escalation-model`, claude-fable-5-2.
- 7613e379 `LENS_MODEL` and the double review's `CLAUDE_FALLBACK`, claude-fable-5-2.
- 2caf2807 `LENS_EFFORT`, high, passed as `--effort` by the lenses and the double review's Claude reader.
- No feature document: the work was run from the brief. The pull request's body holds the table "where a model or an
  effort is named", the input of the protocol session.

## Decisions
- This session: the two sub-agent model rules declare no alias. Measured with one prompt each on cli 2.1.319, `--model
  fable` is answered by claude-fable-5-1 and `--model claude-fable-5-2` by itself. The lead agreed (its note of 21:52).
- The lead: `LENS_MODEL` and the double review's fallback go to claude-fable-5-2 in one commit of their own, as its
  reading of "todos los modelos" (note of 21:52), confirmed by his line 5167 (note of 22:33).
- This session, against the lead's "leave the effort as it is": both review launches name high effort. Codex found
  they named none, and his line 5167 says "Fable 5.2 Alto [...] TODO". In a commit of its own.
- This session: the guard's change is a commit before the rules, with tests that read the rules, so either rule commit
  can be refused alone.
- This session: `scripts/practice.mjs` and `scripts/rehearsal.mjs` stay on claude-haiku-5-5; they run a rehearsal host
  under a cap of 0.5 USD. Given to the lead.

## Failures and lessons
- The first gate of 82b4b9c6 was red on GitHub, 1 of 9086: `bin/lib/rules-change.test.mjs` took the first rule with an
  alias from the real list, and none was left. My local runs had left that file out. Fixed in the same commit after
  reading the output. A change that removes the last of a kind from the real list is searched for tests that pick
  "the first rule with" that kind.
- A restart of the machine at 22:13 local cut the session during the change of `subagent-writer-model`; nothing of it
  had been written. Checked with `git status` and done again.
- Three edits scripted through a shell heredoc failed on nested quotes before one written with the file tool worked.
  An edit script with backticks in it is written as a file, not through the shell.

## Left
- The lead: merge pull request 813 after his yes, and refresh the installed copy at the land. Until then the live hook
  refuses a work session at high, passes `opus` and `haiku`, and the lenses run on `sonnet`.
- The lead: `scripts/practice.mjs:272` and `scripts/rehearsal.mjs:248` on Haiku 5.5: decide.
- The protocol session (JH 172): every place touched by hand for this switch. Seven rules' values through `rules change`
  (five changed here); two aliases removed; three constants in two commands (`LENS_MODEL`, `LENS_EFFORT`,
  `CLAUDE_FALLBACK`); one agent file's frontmatter; two readers that assumed an alias (the guard, `rules applied`); one
  comment each in `bin/lib/guard.mjs` and `bin/lib/contract.mjs`; two README lines; and tests that wrote a value by
  hand in `bin/lib/guard.test.mjs`, `bin/guard.test.mjs`, `bin/rules.test.mjs`, `bin/contract.test.mjs`,
  `bin/resume.test.mjs`, `bin/check.test.mjs`, `bin/lib/rules-change.test.mjs` and `bin/double-review.test.mjs`. Left
  by hand and not touched: the two scripts above, `bin/lib/contract.mjs` `EFFORTS`, `evals/configs.mjs`,
  `evals/prices.mjs`, `docs/model-effort.md`. One step would also have to measure what a short name gives.
- Nobody yet: `escalation-model` names the model every session already runs on, so the step escalates to nothing
  stronger. `rules applied` cannot fail on a sub-agent's model while the rules have no alias. No command holds a
  session's start to `session-model`. What Fable 5.2 at high costs in lenses, readers and writers is not measured.
- Not checked: that the desktop app takes the id in an agent file; a real lens run and a real double review on the new
  id and effort; what a no-model launch of each agent type runs on.

## Cost
- Time: first note 21:51 local, restart 22:13, resumed 22:25, ready at 23:32 local, 2026-11-10.
- Context share at the ready notice: 80%.
- Reviews: Codex twice, 216,835 input tokens (one finding, P2) and 34,759 (the finding fixed); the Claude lenses risk,
  reliability and readability once, 59,520, 59,849 and 29,398 input tokens, no finding.
- Sub-agents: one independent verifier with no model, 146,180 tokens, no finding.
- Gates: nine commit gates, one red; one push.
- Measurements: two prompts on cli 2.1.319, at low effort, for what `fable` and the full id give.

# F8 S8: the paid rerun, priced row by row

A price list, not a design and not a decision (unit 1 of JH 301's brief, 2026-11-22). It prices each row of
`odd/tasks/f8-s8-certification.md` `## Measures` for a second S8 run, so his yes is one line naming a figure. Nothing
here was run or paid: every dollar figure below is printed by a `--plan` command, which reads the recorded results
files and starts nothing. It lives beside the S8 document, not in it, because open PRs 967 and 930 edit that document.
Marks: [c] checked here, with its command; [i] an estimate; [a] assumed.

## How each figure was made
All on 2026-11-22 about 20:50 local, from this worktree on `origin/main` (`6d6a5d85`), model `claude-opus-5-5`,
`--work-root` a scratch folder (nothing written there by a plan):
- suite rows: `node evals/suite.mjs --claude <claude.exe> --configs <arms> --efforts high --repeats <n> --tasks <ids>
  --permission-mode bypassPermissions --work-root <dir> --name f8-s8r-<row> --plan` (`evals/plan.mjs`): the mean list
  cost of each cell's newest recorded trials, here every one from S8's own runs of 2026-11-19;
- the long session: `node evals/long-session/run.mjs --arms current,minimal-commands --runs 5 --turns 30 --plan`
  (`planBatch`), low / mid / high by history growth of 0 / 3000 / 6000 tokens a turn.
A list cost, not what his plan bills (D2). The plan's usage-cap windows are unknown (no results file records them).

## The rows

| Row | What runs | Price | Measured on 2026-11-19 | Blocked by | Mark |
|---|---|---|---|---|---|
| C1.1 (and C2.2) | incidents 10 × 2, current, two runs (Ask 3) | $4.75 a run, $9.50; about 50 min of agent time a run | $4.68 and $4.75 | incident-02's fixture: draft PR 977. Without it the set's ceiling is 16 of 20, under the line of 17 | [c] |
| C1.2, C1.3, C1.5, C2.4 | long session, 2 arms × 5 runs × 30 turns, plus the desktop smoke | $29.35 / $49.84 / $70.32 (current $3.31 / $5.44 / $7.58 a run; minimal-commands $1.27 / $2.81 / $4.34; smoke $6.45 / $8.59 / $10.72) | $31.89 | the grader fixes (T6): open PR 930; the eval home's Codex login (current-2 held its release on it): no PR, the lead's decision (credentials) | [c] |
| C1.5 at 10 runs (Ask 4, optional) | 5 more `current` runs | $16.55 / $27.20 / $37.90 [i] (5 × the `current` run price above) | not run | as C1.2 | [i] |
| C1.2 grading | 18 Codex calls, 4 Sonnet calls | Sonnet under $0.50 [i]; Codex 0.3M to 0.6M tokens [i], about one weekly point | one weekly point (49% to 50%), tokens not recorded | Codex's week: at 70% until 2026-11-23 23:45 | [i] |
| C2.1 | `honest-unknown` × 3 | $0.58, about 5 min | $0.58 | nothing | [c] |
| C5.3 | 3 tasks × 2 arms × 3 | $3.48, about 23 min | $3.48 | nothing | [c] |
| R1 | the behavioural run of T5's design, 22 trials | $13 to $16 [i] (`t5-behavioural-run.md` `## Cost`); `--plan` cannot price it: its cases are not built | not run | T5 (design in PR 970), then its cases | [i] |
| A1, A2 | the audits of T7's design | Codex 3M to 7M tokens a run, a pilot first; Claude 1M to 4M input a run on his plan, no dollars [i] (`t7-audits.md` `## Cost`) | not run | the pilot, approved by question 369, after the weekly reset | [i] |
| R3 | the practice journey's host session | small, not priced | not run | the lead's tag | [a] |
| Free | C3.1, C3.2, C3.5, C4.1, C4.4, C5.2, R2; C3.4 after PR 963, C4.2 after PR 964 | $0 | — | C4.1 fails at `upgrade` whenever a stack tool is behind (`misses.md`, PR 973); its fix is open PR 978 | [c] |
| C5.1 | first turn of fresh desktop sessions, by hand | his plan, no list cost | not run | his hands | [c] |

## Totals

| Set | Low | Mid | High |
|---|---|---|---|
| The core: C1.1, C1.2 with smoke, C2.1, C5.3 | $42.91 | $63.40 | $83.88 |
| plus C1.5 at 10 runs | $59.46 | $90.60 | $121.78 |
| plus R1, once its cases exist | +$13 | +$14.50 | +$16 |

Codex, beside the dollars: the grading's one weekly point, and the audits' pilot (3M to 7M tokens, about 4 to 9
points at about 0.8M a point [i]).

The record to weigh them by: the first S8 was priced $46.27 to $114.32 and cost $45.38 (`## Result` of the S8
document). The low end held; the long session's high end was never approached.

## The decision rule (a proposal for his answer, not a decision)
1. A row runs only once its blocker has landed on main, since a rerun before the fix buys a known miss again: C1.1
   after PR 977; the long-session rows after PR 930 and an answer on the eval home's Codex login. The free rows run
   first, on the candidate, at no cost.
2. Caps as on 2026-11-19 (question 350's "tope $12 y $74"): $12 a run, which covers the highest single run priced
   here ($10.72, the smoke at high), with the cache kept across turns: a `current` run that misses the cache every
   turn is priced $10.43 at mid, so at high it could pass $12 and stop. A batch cap he names. For the core, the cap that covers its high is **$85**.
3. If a run would pass its cap, it stops and the lead asks again; no run is retried after a failure before its cause is
   read (`CLAUDE.md`, "Running what costs, and review": "One try: when it fails, read why before anything runs
   again").

One decision comes before it and is not a spend: whether the eval home gets a Codex login for the long session
(current-2 held its release on a review it could not get). It touches credentials, so it is the lead's to put to him;
without it the long-session rows, about $70 of the $85, can repeat that miss. The line below assumes it is settled; its ways are in `eval-codex-login.md`, this folder.

His yes in one line, for the core: "Sí, correr S8 de nuevo con tope $12 por corrida y $85 en total, cuando aterricen
PR 977 y PR 930". C1.5 at 10 runs (+$38 at high) and R1 (+$16) are each one more figure on that line.

## Log
- L1 (2026-11-22, JH 301, the brief as the lead wrote it): "S8 paid rerun, priced row by row
  (`odd/tasks/f8-s8-certification.md`, its `## Cost`, card 1 of `return-decisions-2026-11-22.md` in the lead's notes
  folder): price each row with `evals/plan.mjs` (pricing only, it runs nothing paid), write the table and the
  decision rule, so his yes is one line naming a figure."
- L2: written here and not in the S8 document's `## Cost` because PRs 967 and 930 edit that document (`gh pr list --state
  open --limit 200 --json number,files`, 2026-11-22 about 20:56 local); no open PR prices the rerun.

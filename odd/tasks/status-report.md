# Status report

Locator: `odd/tasks/status-report.md` · Engram mirror: `odd/status-report/tasks` · Branch
`feat/status-report`, worktree `D:\js-harness\.claude\worktrees\status-report-a916fa`, built by
the session started from `JH ORQ` on 2026-10-20. Delivery: one pull request. Runner: `node --test`.

## Goal
When Sebastián asks the lead how the work is going, the answer is a detailed report of everything
since the last report, built from facts a command gathers, and ending in what the lead proposes.

## Why
On 2026-10-20 he asked how things were going and got two lines ("vamos bien"). He asked for a
protocol (S1). A protocol in prose alone drifts: "since the last report" is a guess unless the time
of the last report is recorded, and the merged pull requests, the sessions' notices and the open
questions are scattered over git, the channel record and the board. A command that reads them and
records the report's time makes the delta a fact; the orchestrator skill makes the lead use it.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/status-report.md` exits 0
- `node --test bin/report.test.mjs` exits 0
- `node --test bin/lib/report.test.mjs` exits 0
- `node --test bin/lib/channel.test.mjs` exits 0
- `node --test bin/lib/manifest.test.mjs` exits 0
- `node --test bin/js-harness.test.mjs` exits 0
- `node --test bin/readme.test.mjs` exits 0
- `js-harness report` run in this repository prints the four sections from real data (read, not a
  command of the contract: its output changes with every merge and notice)

## In scope / Out of scope
- In: new `bin/report.mjs` and `bin/lib/report.mjs` with their tests; the report line in
  `bin/lib/channel.mjs`; the dispatcher (`bin/js-harness.mjs`); the two skills in
  `bin/lib/manifest.mjs`; `README.md`, `docs/GUIDE.md`, `docs/ROADMAP.md`.
- Out: `progress` itself — its output is held by its own tests and by the lead's habits, and the
  report reuses its parser instead of changing it. The board (`sessions`) — it already shows the
  present; the report is the delta. The relief file — the lead's prose log, read by the lead, not
  parsed.

## Constraints
- Zero dependencies, plain Node — because every `bin/` command runs in any host with no install.
- The report's time is a line in the channel record, not a notice — because a notice to the
  orchestrator wakes the orchestrator's own wait, and the record's folder is what `uninstall`
  already removes, so the line is undone with it.
- Reading never moves the cut; only `--mark` does — because a report looked at and not given must
  not hide its facts from the next one. A forgotten `--mark` only makes the next report longer.

## Ask me before
- Nothing: the protocol was asked for in his words (S1) and the command is read-only but for one
  line under the harness home.

## Specs
- S1 His words (transcript `908805db-d0b9-4c2f-a9e6-f828b6bf1e41`, line 8945, 2026-10-20T19:46:30Z):
  "dime todo lo que hemos hecho y que tan implementado esta y que nos falta, debe haber un protocolo asi que cuando te diga como vamos o que tanto hemos hecho etc tu contestes la informacion desde la ultima vez bien detallado no solo como me respondiste de que vamos bien, dime que me propones"
- S2 `js-harness report` prints, since a cut, four sections of facts:
  - `Landed`: each pull request merged into the default branch's first-parent line after the cut:
    its number, its branch, when it merged and the subject of each of its commits; a pull request
    merged twice is listed once.
  - `Sessions`: each session that wrote a notice after the cut, by title (else its id), with its
    last notice: kind, time and text, and how many notices it wrote.
  - `Questions`: those answered after the cut, with the answer's words when the record copied them,
    and every question still open, whenever it was asked.
  - `Map`: each phase of `docs/ROADMAP.md` as the default branch holds it, done/total, and the steps
    still open of each phase not done, then the total.
- S3 The cut is `--since <time>` (an ISO 8601 time) when given; else the time of the last recorded
  report; else 24 hours before now. The first line says the cut and which of the three it is.
- S4 `--mark` prints the report and records its time as the last report, as a line of its own in the
  project's channel record (not a notice: it wakes nobody), with the commit of the default branch it
  read; after it, `Landed` lists the merges the branch gained since that commit, whatever their
  times. Without `--mark` nothing is written, and with it nothing is written when a section could
  not be read.
- S5 The default branch is origin's HEAD, else `main`, else `HEAD`, as `progress --pace` reads it.
  A section whose source cannot be read says why in its place; the others still print, and the
  command exits 1. An unknown argument or a bad time prints the usage and exits 2.
- S6 The orchestrator skill holds the protocol: when he asks how the work goes, or how much is done,
  the lead runs `js-harness report --mark` and answers with these sections, in his language and in
  detail: what landed, each item said as what it gives him; the sessions and how far each got; his
  decisions since the last report; the map, phase by phase, with what is left; what waits on him;
  and what the lead proposes next. Never a two-line answer.

## Tasks
| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1-S6 | inline | done | this document |
| T2 | S2-S5 | inline | done | RED then GREEN (124 tests): tests first, then `bin/report.mjs`, `bin/lib/report.mjs`, the report line in `bin/lib/channel.mjs` |
| T3 | S6 | inline | done | RED then GREEN (manifest 181 tests): the orchestrator skill, the command list of the js-harness skill, README, GUIDE, ROADMAP |
| T4 | S2-S6 | inline | open | `npm run check`, gentle-ai review, Codex review, pull request |
| T5 | S2-S5 | inline | done | the gentle-ai advisories of L3, tests first (8 RED, then 81 GREEN) |

## Log
- L1 (2026-10-20, the lead's brief, from S1): put a status-report protocol into the harness, so the
  lead answers "cómo vamos" / "qué tanto hemos hecho" with a detailed report of everything since the
  last report, and, if a command can carry the facts, a tested command that prints them and records
  when a report was given.
- L2 (2026-10-20): designed as a new command `report` rather than `progress --since`: `progress`
  counts checkboxes and runs no git without `--pace`; the report reads git, the channel and the
  roadmap of the default branch, and writes one line. Keeping it apart leaves `progress` untouched.
- L3 (2026-10-20): commits fde1b6c6 (the command) and f1a11c68 (the skill protocol), each through the
  gate (tests on GitHub's machines). gentle-ai: ddd4058e..f1a11c68 assessed high through item 3
  (readNotices, shared by the board and notify, gains a `reports` field), lenses risk, readability
  and reliability, lineage review-1d50db51e4e7c3db approved and acknowledged (authority burned),
  no blocker. Its eight advisories were taken as T5: --mark recorded a report whose sections failed
  (fixed: nothing is recorded then); a cut by time lost a merge fetched after a report (fixed: the
  report line keeps the commit it read, and the next lists what the branch gained since it); the
  Landed count called a plain merge a pull request (fixed: "N pull requests and M other merges");
  the absent roadmap was told from git's translated message (fixed: `git ls-tree`); sessions were
  grouped by title (fixed: by session id); the mark's time had its own formatter (fixed: `stamp`);
  the failures of the record and of the append had no test (fixed: two tests).
- L4 (2026-10-20): the fixes committed as 483d528f (gate passed on GitHub's machines). gentle-ai:
  f1a11c68..483d528f assessed medium, review_due false, reason under_budget (237 lines,
  executable_change bin/lib/channel.mjs); the slice ddd4058e..f1a11c68 was reviewed (L3).
  Next step: `js-harness codex-review --base fde1b6c6^` over the three commits, fix its findings,
  push `feat/status-report`, open the pull request with a gentle-ai line, then
  `js-harness notify --to orchestrator --kind ready --pr <n>`.

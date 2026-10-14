# A faster whole check of the same quality

Locator: `odd/tasks/faster-check.md` · Engram mirror: `odd/faster-check/tasks` · Branch:
`docs/faster-check-design` · Delivery: `ask-on-risk` · Runner: `node --test` · State: a design, version 2,
after its two readers.

## Goal
Every commit, slice and pull request proven as well as today, with the lock free most of the time and
no session waiting on another's proof.

## Why
In the three hours before 00:10 on 2026-10-14 the lock was never free: 28 turns, 14 whole checks (164
minutes held, 115 waited), 235 minutes of waiting in all (the orchestrator's measure). His own measure
of the cost is the request below; his words say the same holds for every project the harness runs.

## Done when
- `npm run check` exits 0
- Each part that is built has its own feature document whose contract runs its tests; this one ends
  when the orchestrator has version 2 and the order of build is decided.

## In scope / Out of scope
- In: this design, its measures, the order of the parts.
- Out: building them here (each part is its own feature and session); his machine (`.wslconfig`,
  Defender) — his.

## Constraints
- The same quality: every proof that exists today still happens somewhere, and the table of parts says
  where — because the request is speed "de la misma calidad".
- Numbers measured, not estimated, wherever a part is ranked by them — because two of version 1's
  claims did not hold when measured.

## Effort
high

## Ask me before
Spend outside the plan, anything on his machine, a change to the review loop the harness ships.

## Specs
- S1 — His request, the orchestrator's transcript `f6584277-0ceb-482c-a3d3-a7168c0f74ae` line 1090
  (2026-10-14T05:20Z): "hay alguna forma que podamos optimizar esta revision completa que tanto nos
  desgasta y nos hace demorar tanto tiempo por algo mas rapido pero de la misma calidad, osea antes de
  ejecutar algo la idea o el plan de lo que se va a hacer, se hace una review con el modelo de Opus y
  tambien con el modelo de Sol y se atajan las malas deciciones antes, se hace el trabajo y al final
  vuelve y se hace una review del modelo de Opus y el modelo de Sol y con esto ya tendriamos que quedar
  asegurado del que trabajo se hizo, osea lo que te doy es un ejemplo, pero entramos en mucha burocracia
  y creo que se esta acumulando mucho, los procesos de desarrollo sobretodo con IA son muchos mas rapido
  y precisos sobretodo con estos modelos tan buenos, dame mas ideas y formas de optimizar esto sin que
  tengamos este problema tan grande y asi podamos abrir la mayor cantidad de sesiones en paralelo, por
  que asi como hacemos doogfooding y estamos teniendo este cuello de botella, de igual forma nos va a
  pasar con los proyectos que este harnes maneje." "Sol" is `gpt-6.1-sol`.
- S2 — `ffe99ebf-72fb-48da-a79b-e7db21a20b3f` line 1226 (05:34Z): "como lo podriamos hacer mas rapido y
  eficiente con la misma calidad".
- S3 — `ffe99ebf-72fb-48da-a79b-e7db21a20b3f` line 2115 (06:30Z): "agrega la prioridad del gate al
  diseño de JH 8".
- S4 — Earlier, `65318fd5-80e7-4bb8-92b5-06737140185b` line 12302 (2026-10-13T23:58Z): "entonces que
  es lo que nos tiene en cola o en fila esperando para ver si lo mejoramos".

## What the time is spent on (measured 2026-10-14, one commit, `3f59bb2`)
| Where | Whole suite | Sum of the tests' own times | Tests of 1 s or more |
|---|---|---|---|
| Windows, `D:` excluded from Defender (the orchestrator's word, not verified), temp on `D:` | 603 s | 3,621 s | 744 |
| WSL2, mirror on the Linux disk (`odd/tasks/gate-wsl.md`) | 111.5 s | 572 s | 125 |
| GitHub's Linux runner (run 38511223058, the session "JH 10") | 145 s | — | — |

The cost on Windows is not a few slow tests: it is spread over every test that starts a process or
writes files, which is most of them (the six-fold gap holds in the sum, not only at the top). So the
first lever is where the suite runs, and the levers that cut the suite (fewer tests per commit, a slow
tier) are worth much less once it runs in two minutes. Codex reviews held 6.9% of the lock's day.

## The design, ranked by what it saves for what it costs
Each part: what it saves, what it costs, what it can miss, its safety net, what an installed project
gets by default. Version 2, after two readers (see "What the readers changed").

1. **The sensors in WSL2** (`feat/gate-wsl`: its first commit in its turn, the readers' corrections
   next). Saves about 490 s of 603 per whole check: 14 whole checks in three hours hold the lock about
   30 minutes instead of 140. Costs one switch file per machine (how: the distribution and node), one
   field per project (whether: `harness.json`), a mirror sync of about 7 s with `--checksum`. The
   corrections: the tree key says where the sensors ran, so a pass in WSL2 never proves a tree for a
   Windows run; `--checksum`, since `/mnt/d` shows mtimes to the second (measured: a change of the
   same size in the same second stayed out of a quick-check mirror); `--delete-excluded`, and the
   files a test left in the mirror reported in the `tree` row as the Windows tree's are; a `flock` on
   the mirror. Measured, not a risk: killing `wsl.exe` ends the Linux tree, a grandchild in the
   background included. Can miss: what only Windows does (process trees, PowerShell, `cmd.exe`
   quoting); a defect only Linux has fails a commit Windows passes (tonight: node 24's process name,
   fixed in pull request 109). Net: part 5. Installed projects: nothing unless the project declares the
   field and its machine has the file; a project with `node_modules` should not declare it until the
   mirror installs them on Linux (native binaries).
2. **Codex's review out of the lock** (designed in `odd/tasks/gate-wait.md`, the guard: a `NODE_OPTIONS`
   preload that ends any `node --test` Codex starts outside a turn; one probe of 100,000 input tokens
   granted). Codex holds the lock because it runs the suite itself (`bin/codex-review.mjs`, the turn
   around the run); it was 6.9% of the lock's day and with sensors five times faster it becomes about a
   quarter. Saves about 43 minutes of lock a day and the longest single holds. Costs a preload and a
   test. Can miss: what Codex would have learned by running the suite itself; it reads the code and the gate's
   report instead. Net: the gate ran the same tree. Installed projects: the same, it is the review loop.
3. **A priority for the gate** (S3; design below, rewritten). After parts 1 and 2 the lock is busy
   about a sixth of the time with tonight's load, so the ticket matters at peaks: tonight's measure
   waited about 15 minutes and four sessions were paused by hand. Costs a ticket file and one more key
   in the order of the line. Can miss: a gate of an older version keeps the old order (the board
   flags it). Net: it never cuts a running turn. Installed projects: the command, no ticket.
4. **The plan read before the code** (S1, its first half). One Opus reader and Codex (`gpt-6.1-sol`)
   read the design of a feature before its first commit: a page, not a diff, so a bad decision costs a
   paragraph. Needs `codex-review` to take a document (`--plan-doc <path>`, new) within an allowance of
   its own. This document is its first case. The per-slice Codex review stays as it is: one review per
   pull request instead (version 1) would clash with the pre-push check, which refuses any code
   commit no record covers (`bin/check.mjs`, `checkCodexReviews`), would save almost nothing with
   pull requests near 400 lines, and would land corrections late; the line of `AGENTS.md` stays.
5. **Windows kept before the merge, by platform, and once per batch after it.** Per commit, beside the
   WSL2 run, the few test files that exercise Windows behaviour (process trees, quoting, PowerShell)
   run on Windows: a selection by platform, declared in `harness.json` (`"windowsSensors"`), not by
   import graph, so it misses nothing it selects for. Cost to measure: those files alone on Windows.
   After the merges, one whole run on `main` on Windows per batch (`TEMP='D:\js-harness-tmp'
   TMP='D:\js-harness-tmp' JS_HARNESS_GATE_WSL=0 node bin/check.mjs`), which now runs its sensors
   whatever WSL2 proved (part 1's key). Can miss: a Windows-only defect outside the selected files,
   until the batch run. Installed projects: the field is theirs to declare.
6. **The whole suite once per pull request on GitHub** (the session "JH 10", pull request 109).
   Nobody's lock; about 3 of his 2,000 minutes a month per run. Installed projects: offered, not
   installed.
7. **A `merge-ready <pr>` command.** Reads whether a pull request may merge: its GitHub run green,
   every code commit covered by a Codex record, the last batch run on Windows green. Not "`main`
   merged in" for pull requests with disjoint files: that condition would make each pull request of a
   batch merge `main` again and gate again (reader B); the batch run on `main` is their proof instead.
   Needs `gh`; without it, it says so and reads the rest.
8. **Measure next, before building more:** (a) what a commit pays outside the lock (static rows,
   `gentle-ai review assess`, the Codex debt row): the hook's total minus the sensors' seconds, from
   the gate log; (b) two WSL2 gates at once (8 processors, a peak of 1,112 MB each): if both stay
   inside their bound, the lock could admit two holders, the direct lever for "la mayor cantidad de
   sesiones en paralelo"; (c) the queue with parts 1 and 2 on, for a week: sessions times commits.
   The model (reader B): a lock held about 2 minutes per commit is saturated by 8 sessions committing
   every 15 minutes, 14 every 30.
9. **Not now, measured:** only the tests a change reaches by import graph; a slow tier; fixture
   repositories built once; slow tests made fast. In WSL2 the 25 tests of 3 s or more sum to 116 s of
   572 and a whole run is under two minutes. Revisit when one passes four minutes.
10. **His machine, done by him:** `D:` excluded from Defender (the orchestrator's word; it needs an
    administrator to verify), WSL2 installed, the `.wslconfig` cap (text sent: `memory=4GB`).

**Machine-specific, not shipped:** `D:\js-harness-tmp`, the Defender exclusion, `memory=4GB`, the
distribution's name and node path (they live in the machine's switch file), the 60-minute ticket and
the orchestrator's role as defaults (they are this setup's).

## Codex's review out of the lock (part 2), as built
The lead's decision (L5) and how `bin/codex-review.mjs` carries it out. A review runs in a turn only when
its caller is in one (`JS_HARNESS_GATE_HELD=1`); otherwise it is out of the lock, and then:
- **The preload.** Codex's environment gets `NODE_OPTIONS=--require=<bin/lib/no-test-outside-turn.cjs>`,
  after any `NODE_OPTIONS` it was given (`noTestNodeOptions`; a path with a space goes in double quotes,
  with each backslash doubled, since node reads one there as an escape). Every `node --test` Codex starts
  ends at once with exit 97 and one line (`NO_TEST_LINE`); a node without `--test` runs as before, and so
  does one in a turn or in a gate's sensor (`JS_HARNESS_CHECK_INNER=1`). Probe 2 of 2026-10-14 showed the
  variable reaches Codex's sandboxed commands and the preload ends them.
- **The prompt.** The review is asked with this command's own prompt, even under `--prompt codex` (which
  then says so): only that prompt can carry `SUITE_RAN`, which tells Codex the gate already ran the suite
  on the range, that a refused `node --test` (exit 97, its line) is expected and is no finding nor a reason
  to call the patch incorrect, and to read the tests instead. `--prompt codex` stays for a review in a turn.
- **The verdict.** An `incorrect` with no finding of P0 to P2, whose only failed commands are refused test
  runs (exit 97 with the line in their output, at least one), owes no correction (`excusedByRefusal`): the
  next range is a review, not a recheck. The run log's line says why (`EXCUSED_LINE`) and keeps the
  verdict as Codex gave it; its `answer` and the range's record carry `excused: "refused-tests"`, so how
  many reviews went through that way is a count of records. Any finding still blocks, and so does an
  `incorrect` beside another failed command, or one given in a turn.
- **The way on.** A failed review is rerun as it was run (`js-harness codex-review --base <rev>`), no
  longer in a turn of the lock.

What it can miss: what Codex would have learned by running the suite; it reads the tests, and the gate
ran the same tree. A review whose `incorrect` rests on its own reasoning and also saw a refusal is not
excused unless every failed command was a refusal and it found nothing of P0 to P2.

## The priority of the gate (S3), version 2
- **What it is:** a ticket for one session's next whole check (`check`, never `gate -- <command>`): the
  session's id (from the host), optionally its tree, why, who issued it, and until when it may be
  claimed (at most 60 minutes). It goes before every other waiter; the turn that runs is never cut.
- **The claim is atomic and happens at arrival** (reader A): the gate renames the ticket file into its
  own waiting folder and writes `first: <ticket id>` into its first file, beside `waitingSince`. The
  order of the line becomes (first, arrival, token), computed from that once-read file only, as the
  line already is, so two gates can never see each other ahead. A ticket that cannot be read is no
  ticket. A ticket left in place while its expiry passes is gone; a claimed ticket no longer expires.
- **Spent at the claim**, so a gate proven by its tree key, stopped, or refused spends it too and the
  tree cannot jump the line twice. A failed run's fix waits like any other commit; the issuer gives a
  second ticket if he is still waiting on it.
- **Who issues it:** the orchestrator, `js-harness gate first --session <id> [--tree <path>] --reason
  "<why>" [--minutes n]`; a work session only on the orchestrator's word, quoted in `--reason`. Two at
  most open, in the order issued; a third is refused, naming them. The orchestrator's own batch run on
  `main` may carry one by itself (`--first` on that one command).
- **What stops every session marking itself first:** at most two open; each says who issued it and
  why; the board prints them and flags one whose issuer is not the orchestrator; the gate log keeps
  each issue, claim and expiry. It cannot be made impossible (any process of the user can write the
  file), so it is made seen.
- **How a waiter sees it was passed:** its wait line names the gate that went first and the ticket's
  reason; its start line in the gate log marks that gate `first: true` among the gates it waited for.
- **The gate log:** `first-issued` (session, tree, reason, by, until), `first-claimed` (gate id, the
  waiters it passed), `first-expired`, `first-cancelled`.
- **Undo:** `js-harness gate first --cancel <id>`, the expiry, or deleting the ticket file. A gate of
  an older version ignores tickets; the board flags waiters of an older version.

## What the readers changed
- Reader A (line by line): the tree key (part 1, now in the code's corrections); the switch per project
  as well as per machine; the mirror's litter and `--delete-excluded`; the mtime of `/mnt/d` (measured
  true, `--checksum`); the ticket's claim moved to arrival and made atomic, spent at the claim, for
  checks alone; version 1's per-pull-request Codex review dropped; the unverified exclusion said so;
  two holders to measure. Its point on processes left in Linux was measured false.
- Reader B (what is missing): the same tree key, independently; Codex out of the lock ranked above the
  ticket; the queue model; Windows kept per commit by platform (part 5); `merge-ready` without "`main`
  merged in"; the overhead outside the lock to measure; the ticket per session, with a claimed state,
  two open, and the batch run's own; the machine-specific list.

## Questions apart
- The orchestrator's (they can be undone): the order of build (recommended: part 1's corrections now,
  then 2, 3, 7, 5, 4); whether a work session may issue a ticket on its word (recommended: yes, quoted,
  flagged).
- His: none new. The `.wslconfig` cap is his file and its text is with the orchestrator.

## Tasks
- [x] T1 · S1-S4 · this design attacked by two Opus readers (effort high); the version after them to
      the orchestrator with what each changed · version 2, "What the readers changed"
- [ ] T2 · S3 · the priority of the gate, test first (after T1)
- [x] T3 · two guards on a turn of `js-harness gate`, `odd/tasks/gate-turn-guards.md`: a turn is refused
      while a push waits on a branch with an open pull request, and a command is stopped at 30 minutes
      (`--max`). Checked in the branch that builds it, so it is done when that pull request merges.
- [ ] T4 · S1, S2 · part 2, Codex's review out of the lock, test first, in `feat/codex-out-of-lock`
      ("Codex's review out of the lock (part 2), as built"; L5)

## Log
- L1 · S1, verbatim above.
- L2 · 2026-10-14, the numbers of the table: the session "JH 8"'s measure turn of `3f59bb2`
  (`odd/tasks/gate-wsl.md`, L3 and L5), and the sum of each run's top-level test times from the two
  logs.
- L3 · 2026-10-14, two WSL gates at once, measured by the session "JH 8" (one lock turn from 03:32:27,
  main at `16a6b30`, the whole suite from two mirrors): alone 107.6 s, peak memory 1,144 MB of 3,917;
  pair 1: 238.8 s and 242.7 s, slower than the two in a row (215 s). Pairs 2 and 3 never ran: the
  script's bare `wait` also waited for its endless memory sampler and held the lock to 03:56:31, when
  the lead killed it. The lead's decision (03:58): the lock keeps one slot, since the WSL sensors are
  bound by the processor and memory is not the limit; the pairs are not run again.
- L4 · 2026-10-14, the lead's two orders after that day's two waits for nothing (his words, `ffe99ebf`
  line 3977: "ese problema de esperar una medicion que no la necesibata hay que corregirlo para que no
  vuelva a pasar"): a push that waits goes before any turn, and a scripted turn has a bound of wall
  time. Built as T3, in `feat/gate-turn-guards`.
- L5 · 2026-10-14, the lead's decision on part 2, verbatim: "(1) Out of the lock the review always uses
  `own`, with the sentence in its intent block; `codex` stays only for a review run inside a turn. (2) An
  `incorrect` with no P0-P2, on a run where NODE_OPTIONS carried the preload and the only failed commands
  are refused node --test (exit 97 with the guard's line in the events), owes no correction; the run line
  says why, any finding still blocks." Added: "the record marks each such run, so a count of reviews let
  through this way is readable from the records." And: "codex-review must tell Codex the gate already ran
  the suite on this range and that a refused node --test is expected, not a finding; and the test proves
  that a review whose only complaint is the refusal is not recorded as blocked." The sentence goes in its
  own block (`## The tests`) after the intent block, since a review with no feature document has no
  intent block to put it in. Built as T4.

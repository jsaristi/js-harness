# The gate overflows to CircleCI when the machine's gate is busy

Locator: `odd/tasks/ci-overflow.md` · Engram mirror: `odd/ci-overflow/tasks` · Branch: `feat/ci-overflow` ·
Delivery: `ask-on-risk` · Runner: `node --test` · Session: JH 17

## Goal
A `check` whose suite would wait long for the machine's gate lock runs that suite on CircleCI instead, on
the exact bytes the local gate would test, within the free credits, and passes or fails on that run.

## Why
One machine-wide lock serializes every session's suite (`bin/lib/gate-lock.mjs`). On 2026-10-14 the gate
log holds 89 `check` runs that took the lock themselves (`lock: "own"`), 74 of them after a wait of more
than 5 minutes, 1,354 minutes of waiting in all; the same day 81 more suites ran inside `gate --` turns,
whose own waits were 1,671 minutes (measured 2026-10-15 from `~/.js-harness/gate-log/*.jsonl`, by JH 17
and again by reader B). CircleCI's free plan already serves the merge queue (PR 155, PR 167) and runs 30
jobs at once, so a long wait can run there instead. Credits are finite and his: the overflow spends only
what a budget allows and stops well before half the month's free credits.

## Done when
- `node --test bin/lib/overflow.test.mjs bin/check-overflow.test.mjs` exits 0
- `npm run check` exits 0
- With the lock held by a long gate, a `check` in another worktree prints a `tests` row that names the
  CircleCI run it passed on, and the gate log holds that run with `lock: "circleci"`.
- `js-harness overflow status` prints the credits of the last 30 days, the stop line, this hour's quota
  and whether the machine's off switch is set.

## In scope / Out of scope
- In: `bin/lib/overflow.mjs`, `bin/overflow.mjs` and their tests (new); the call in `bin/check.mjs`
  (`checkSensors`, `underGateLock`); `bin/lib/gate-log.mjs` (`LOCK_SAID`); `harness.json`; an `overflow`
  job and the `overflow/*` filter in `.circleci/config.yml` (by agreement with its owner); the manifest
  entry for `~/.js-harness/circleci/`; docs (`docs/ROADMAP.md`, README rows of `check`).
- Out: `bin/gate.mjs` (JH 8): a `gate --` turn never overflows. The merge queue (JH 10), apart from the
  shared `circleciState` and one ledger line, both by agreement. Test splitting and a Windows run on
  CircleCI (F-items).

## Constraints
- Free credits only — he chose "primero con los créditos gratis"; no payment method exists.
- Stop before the use passes 50 percent of the free credits, and tell the lead — his instruction; the
  stop line is 40 percent so the ledger's blind spots still fit under 50.
- The verdict binds to the exact tree and bytes, as a local pass does (`treeKey`, `bin/lib/gate-tree.mjs`)
  — so the pre-commit and pre-push rules still hold.
- The local run stays the default whenever the lock is free — his words: "el check corre local si el gate
  está libre y en CircleCI si está ocupado".
- Every doubt runs locally, never passes — a gate that cannot tell is a gate that runs.

## Ask me before
Creating a CircleCI API token; any paid plan, resource class or credit purchase; moving the stop line;
turning the overflow on for a project other than this one.

## Specs
- S1 (his question, 2026-10-15, verbatim): "tenemos a circleci como gate, a github como gate y al local
  linux como gate, por que no utilizamos todos en paralelo y ademas creo que circleci se puede utilizar
  varios en paralelo no?"; his answer, tapped: "Sí, constrúilo (Recomendada)" to "¿Construimos el desborde:
  el check corre local si el gate está libre y en CircleCI si está ocupado, primero con los créditos
  gratis?"
- S2 When the lock is free, or the remaining wait plus a local suite is shorter than an overflow's round
  trip, the suite runs locally exactly as today, and no CircleCI pass ever proves a local gate.
- S3 Otherwise, when every precondition holds, the suite runs on CircleCI on the index tree, checked out
  with the bytes the WSL2 mirror would hold; the gate's exit code is that run's verdict.
- S4 The verdict proves its tree only: the same key before and after, the pushed tree equal to the index,
  and the CircleCI job pinned to main's; anything else falls back to the local lock.
- S5 Credits: every run is reserved in a ledger before it starts and settled after; no overflow past 40
  percent of 30,000 credits in the last 30 days or into the queue's floor; the lead is told once.
- S6 Any doubt — no network, a prompt, a push refused, no run, a rate limit, a ledger that cannot be read,
  a tree without main's CircleCI config — falls back to waiting for the local lock, never to a pass.

## Design (version 2, after two readers)

### Facts it rests on
- Free plan: "30,000 free credits/month", "30x concurrency", private repositories allowed, credits do not
  roll over (https://circleci.com/pricing/, read 2026-10-15); they "refill at the start of the next month"
  (https://circleci.com/docs/guides/plans-pricing/credits/, reader B). Docker medium is 10 credits a
  minute, large 20, Windows VM medium 40 (CircleCI credit pricing, updated 2026-10-08). Billed per second,
  then up to the credit; queued and preparing time is not billed (credits doc). The probe: 239 s, 40
  credits (relief log, 00:43).
- No exact meter without a personal API token: the usage export and Insights `credits_used` both need one
  (https://support.circleci.com/hc/en-us/articles/31088529473947-Usage-API-vs-Insights).
- A pass is keyed by `treeKey` (`bin/lib/gate-tree.mjs:72`); its listing records each file's line ends in
  the folder (`--eol`). This checkout has 337 files `i/lf w/crlf` (`core.autocrlf=true`), and the WSL2
  runner copies the Windows folder without `.git` (`bin/lib/gate-wsl.mjs:109`, `:121`), so the local suite
  reads CRLF bytes where a plain Linux checkout reads LF.
- `provenBy` matches a gate-log end on its key alone (`bin/lib/gate-log.mjs:309-311`): which key a gate
  looks up is the only thing that keeps one place's proof from another's.
- The merge queue reads CircleCI's verdict from GitHub with no CircleCI token (`circleciState`, PR 167).
- Actions run only on pull request events (`.github/workflows/gate.yml:13-18`): a pushed branch costs no
  GitHub minutes.
- `takeGateTurn` already takes a `stillWanted` callback asked at every look of a wait (`bin/check.mjs:1040`,
  `:1072`): a waiting `check` can leave the line.

### What it reaches, and what it is worth
- It reaches `check` runs that wait on their own (89 a day on 2026-10-14, 14 on 2026-10-15 so far), never
  a suite inside a `gate --` turn, which already holds the lock (81 and 39). About half the waiting is in
  those turns.
- At about 40 credits a run, the 40 percent line is 12,000 credits a month, about 300 runs, 10 a day. On
  2026-10-14 there were 71 own runs that waited over 6 minutes. So the free credits relieve about one long
  wait in seven: by reader B's ex-post estimate about 150 minutes a day saved directly, against some 3,000
  minutes of waiting. Exact tests (`odd/tasks/exact-tests.md`, in shadow) shorten every run, turns
  included, at no credit; the two add up rather than compete, but this one is the smaller lever.

### Preconditions (all, or the suite runs locally)
1. `harness.json` declares `"overflow": "circleci"` (off unless declared, like `sameTree`); neither
   `JS_HARNESS_OVERFLOW=off` nor the machine's off file `~/.js-harness/circleci/off` is set; `CI` and
   `CIRCLECI` are unset (no overflow from inside CI).
2. The gate takes its own turn: not inside a gate, not in a held turn.
3. The local place is WSL2 (`sensorsInWsl` and the machine's switch on), so a Linux run replaces a Linux
   run and never a Windows one; and the only sensor under the lock is `tests` (a `node --test` suite).
4. The tree key is non-null (folder = index), HEAD exists, `git write-tree` answers.
5. The index's `.circleci/config.yml` blob equals `origin/main`'s, and that config has the `overflow` job.
6. The remote `origin` is GitHub, parsed from its URL, and `gh` answers within 15 s.
7. The ledger allows the run: under the 40 percent line, above the queue's floor, within this hour's
   quota, and no other overflow decided on this machine in the last 30 s.
8. The estimate says so: remaining wait + the local suite's median > the overflow round trip's median.

### The estimate
- The holder is estimated by its kind: a `check` by the p75 of local own-lock suite seconds, a `gate --`
  turn by the p75 of turns, minus its elapsed time, never below 60 s; each waiter ahead counts its kind's
  p75. Only local own-lock starts feed the figures (joined to their ends by id), never CircleCI runs or
  `same` lines. A holder file that cannot be read is no estimate: the suite runs locally.
- Round trip: the median of the last 10 overflow runs, 360 s until there are any. Local suite: median of
  the last 20 own-lock passes (about 165 s on 2026-10-15). Break-even is then about 3 minutes of wait.
- Asked at entry and again at every look of the wait, through `stillWanted`: a gate that guessed short
  leaves the line once the remaining wait passes the line, instead of staying 20 minutes.

### The overflow
1. Reserve: append one line to `~/.js-harness/circleci/ledger.jsonl` (`O_APPEND`, one write) with a
   random id and 150 credits (15 minutes at 10), before anything is pushed. The ledger counts reserved
   lines as spent until they are settled.
2. Build: `git write-tree` → `git commit-tree --no-gpg-sign <tree> -p <merge-base HEAD origin/main>`, so no
   unpushed commit of the branch is pushed; the tree is the index's whole.
3. Push: `git push --no-verify origin <sha>:refs/heads/overflow/<key12>-<random6>`, never forced, with
   `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never` and a 30 s bound.
4. Run: the `overflow` job (filter `overflow/*`) checks the commit out with `core.autocrlf=true`, copies it
   without `.git` as `runnerScript` does, and runs the `tests` sensor's command there and nothing else.
   It is pinned by step 5 of the preconditions; its blob id is part of the place string,
   `circleci cimg/node:<tag> medium <config blob>`.
5. Poll GitHub every 30 s with ETags (a 304 costs no request), 15 s a call, for the check run of the job
   named `overflow` on `<sha>`. No run in 150 s, a 403 or 429, or no verdict in 15 minutes: fall back.
6. Settle: in a `finally`, delete the branch and settle the reservation with the run's seconds from GitHub
   (`started_at` to `completed_at`, rounded up to the credit), or leave it at 150 when they cannot be read.
   Then `git write-tree` again and the tree key again: either changed, and the verdict proves nothing.
7. Green: the `tests` row passes and names the run's URL; the gate log gets a start with
   `lock: "circleci"` and an end whose `code` is the key with the circleci place. That key is looked up
   only by a gate that has decided to overflow, never in the same-tree lookup before the lock, so a
   CircleCI pass never proves a local gate and a local pass never proves an overflow.
8. Red: the gate fails at once with the run's URL, and says that `npm run check` with the lock free shows
   the failing tests (no token reads a private project's log). It does not join the line again: a red run
   should not cost a second wait. T6 checks whether the check run's output names the failing files.
9. Sweep: before each push and in `overflow status`, branches `overflow/*` older than an hour are deleted
   and their reservations settled from GitHub, so a killed hook leaves nothing behind for long.

### Credits
- The ledger sums the last 30 days (conservative against a calendar month whose start date is not known
  without a token). The stop line is 12,000 (40 percent); the queue's floor is 3,000 more, which overflow
  never spends; a day may spend at most twice its share, and an hour its share of the day.
- Crossing the line: `check` stops overflowing and writes one line to the lead's relief file with
  `js-harness notify --relief` (a flag file makes it once per 30 days).
- Blind spots, stated: a run someone starts by hand or from another machine, and the gap between a kill and
  the next sweep. The 10-point margin under 50 percent is for them. With a token, Insights is the exact
  source and the margin can shrink; the token is his to create.

### What it uploads
- An overflow pushes the staged tree to the private `origin` before any review, and GitHub keeps the
  objects reachable by their id after the branch is deleted. A local pass uploads nothing. That is the one
  new exposure; it is why the overflow is declared per project and is his to allow beyond this one.

### Windows
- The local gate runs the suite on Windows when the machine's WSL2 switch is absent or off, or when the
  mirror is never reached (`bin/lib/gate-wsl.mjs:47`, `:52`; `bin/check.mjs:812-815`; 3 such runs on
  2026-10-14). Precondition 3 keeps the overflow to gates whose local place is WSL2, so it never replaces
  a Windows run. A Windows-only failure is invisible to both WSL2 and this overflow; catching it is an
  F-item: a CircleCI Windows VM medium run, 40 credits a minute, once per ready pull request.

### Undo
- `~/.js-harness/circleci/` (ledger, flags, off file) goes in the manifest, so `uninstall` removes it; the
  remote branches are removed by the sweep; the `overflow` job is one block of the CircleCI config.

### Merges and edge cases
- A merge's gate (`pre-merge-commit`) may overflow; its synthetic commit has one parent, so a CI row that
  reads history can only turn it red, which fails it. An initial commit (no HEAD) never overflows.

## Changes from the readers (2026-10-15)
- Reader A (binding): the proof lookup was contradictory (now only inside the overflow path, both
  directions tested); CircleCI tested LF bytes where the local gate tests CRLF (now an own job that
  re-checks out with `autocrlf` and copies without `.git`); the tree's own config decided the verdict (now
  pinned to main's blob, in the place, and the poll names the job); push unbounded and pushing unpushed
  commits (now non-interactive, bounded, parent the merge base); branch names collided (random suffix);
  credits leaked on kill and timeout (reservation first, `finally`, sweep); `LOCK_SAID` and the median
  would mix CircleCI runs in (filtered by lock kind); poll too eager (30 s, ETags, owner from `origin`).
- Reader B (cost): main has no CircleCI config yet (T0 added); half the waiting is in `gate --` turns that
  never overflow (stated in What it reaches); the ledger could under-count (reservation, 30-day sum, 40
  percent line, queue floor); the estimate misjudged turns and compared the wrong quantities (per kind,
  wait + local suite, re-asked during the wait); a red run cost twice (now fails at once); the Windows
  paragraph was false (rewritten, precondition 3); undo, the off switch, the upload exposure and how the
  lead is told were missing (added).

## Tasks
- [ ] T0 (kind: verify) PR 155 on main with the `overflow` job and filter; the overflow cannot run before.
- [ ] T1 (kind: design) This design, attacked by two readers (done 2026-10-15), then taken to the lead.
- [ ] T2 (kind: build) `bin/lib/overflow.mjs`: the ledger (reserve, settle, sums, quota) and the estimate, pure, tests first.
- [ ] T3 (kind: build) The push, poll, settle and sweep, with `circleciState` shared, fake `git`/`gh` in tests.
- [ ] T4 (kind: build) The call in `checkSensors` and `underGateLock` (`stillWanted`), `LOCK_SAID`, `harness.json`, the manifest; docs.
- [ ] T5 (kind: build) The `overflow` job and `overflow/*` filter in `.circleci/config.yml`, by its owner or by agreement.
- [ ] T6 (kind: verify) One real overflow under a held lock: credits against the ledger, bytes against the WSL2 mirror, what a red run's check output says.

## Log
- L1 2026-10-15 (his words, typed and tapped to the lead): "tenemos a circleci como gate, a github como gate
  y al local linux como gate, por que no utilizamos todos en paralelo y ademas creo que circleci se puede
  utilizar varios en paralelo no?"; then "Sí, constrúilo (Recomendada)" to "¿Construimos el desborde: el
  check corre local si el gate está libre y en CircleCI si está ocupado, primero con los créditos gratis?"
- L2 2026-10-15 02:21: JH 17 opened this document from main 2832ad8. Figures confirmed on circleci.com
  (pricing and credit pricing pages); gate-log measure as in Why.
- L3 2026-10-15: two independent readers attacked version 1 (binding; cost and operations). Version 2
  takes every blocker and should-fix; what each changed is in "Changes from the readers".
- L4 2026-10-15 03:03: PARKED by his answer, tapped to the lead about 03:03: "Tests afectados primero
  (Recomendada)". JH 8 turns exact tests live first; this design stays as it is until he decides to pay
  for credits. Why: on free credits the overflow relieves about 10 long waits a day, some 150 of about
  3,000 minutes of waiting (about 5 percent), and never the suites inside `gate --` turns; exact tests
  shorten every run at no credit. Meanwhile PR 155 merged into main (3e682ea), so T0 now waits only for
  the `overflow` job and filter. No PR from this branch.
- L5 2026-10-15 03:27: JH 17 closes. What stays open when he takes this up again: T0 (the `overflow` job
  and `overflow/*` filter, JH 10's config), then T2 to T6 as written. Before T4, ask who owns `bin/check.mjs`
  and `bin/lib/gate-log.mjs`; `circleciState` is still in the merge queue's file. A CircleCI token is still
  only needed for the exact meter. Found while writing this design: an amend of a commit of documents
  ran the whole suite. Fixed apart, in PR 184 (`fix/amend-documents-skip`, a771d5e).

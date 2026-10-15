# The gate overflows to CircleCI when the machine's gate is busy

Locator: `odd/tasks/ci-overflow.md` · Engram mirror: `odd/ci-overflow/tasks` · Branch: `feat/ci-overflow` ·
Delivery: `ask-on-risk` · Runner: `node --test` · Session: JH 17

## Goal
A `check` whose suite would wait long for the machine's gate lock runs that suite on CircleCI instead, on
the exact tree it guards, within the free credits, and passes or fails the commit on that run's verdict.

## Why
One machine-wide lock serializes every session's suite (`bin/lib/gate-lock.mjs`). On 2026-10-14 the gate
log holds 170 suite runs, 74 of them after a wait of more than 5 minutes, 1,354 minutes of waiting in all
(measured 2026-10-15 02:18 from `~/.js-harness/gate-log/*.jsonl`, `start.waitedSeconds`). CircleCI's free
plan already runs the merge queue's candidates (PR 155, PR 167) and has 30 concurrent jobs, so a waiting
suite can run there at once. Credits are finite and are his, so the overflow spends only what a budget
allows and stops before half the month's free credits.

## Done when
- `node --test bin/lib/overflow.test.mjs bin/check-overflow.test.mjs` exits 0
- `npm run check` exits 0
- With the lock held by a long gate, a `check` in another worktree prints a `tests` row that names the
  CircleCI run it passed on and the tree it ran, and the gate log holds that run with `lock: "circleci"`.
- `js-harness overflow status` prints the credits this cycle, the 50 percent line and today's allowance.

## In scope / Out of scope
- In: `bin/lib/overflow.mjs` and its test (new), the call from `checkSensors` in `bin/check.mjs`,
  `harness.json` (the declaration), the `overflow/*` branch filter of `.circleci/config.yml` (by agreement
  with its owner), docs (`docs/ROADMAP.md`, README rows of `check`).
- Out: `bin/gate.mjs` (JH 8 owns it; `gate -- npm run check` runs in the gate's own turn and never
  overflows, so it needs no change). The merge queue (JH 10), apart from one shared ledger line it may
  write. Test splitting on CircleCI (measured later, F-item). A Windows run on CircleCI (F-item).

## Constraints
- Free credits only: no payment method, no paid resource class — he chose "primero con los créditos gratis".
- Stop and tell the lead before the cycle's use passes 50 percent of the free credits — his instruction.
- The verdict binds to the exact tree, as a local pass does (`treeKey`, `bin/lib/gate-tree.mjs`) — so the
  pre-commit and pre-push rules still hold.
- The local run stays the default whenever the lock is free — his words: "el check corre local si el gate
  está libre y en CircleCI si está ocupado".
- No CircleCI API token is needed to run; the exact credit meter needs one, which is his to create.

## Ask me before
Creating a CircleCI API token; any paid plan, resource class or credit purchase; raising the 50 percent line.

## Specs
- S1 (his question, 2026-10-15, verbatim): "tenemos a circleci como gate, a github como gate y al local
  linux como gate, por que no utilizamos todos en paralelo y ademas creo que circleci se puede utilizar
  varios en paralelo no?"; his answer, tapped: "Sí, constrúilo (Recomendada)" to "¿Construimos el desborde:
  el check corre local si el gate está libre y en CircleCI si está ocupado, primero con los créditos
  gratis?"
- S2 When the lock is free, or the expected wait is shorter than an overflow's round trip, the suite runs
  locally exactly as today.
- S3 When the expected wait is longer, and every precondition of the design holds, the suite runs on
  CircleCI on the index tree the commit will hold; the gate's exit code is that run's verdict.
- S4 The run's verdict is bound to the tree: the tree key before and after is the same, or the verdict
  proves nothing and the gate runs locally.
- S5 Credits: a ledger of every CircleCI run this machine starts; no overflow once the cycle passes 50
  percent of 30,000 credits, and the lead is told once; a daily allowance paces the rest.
- S6 Any doubt — no network, push refused, no status, a red run, a tree without the CircleCI config,
  ledger unreadable — falls back to waiting for the local lock, never to a pass.

## Design (draft for the two readers, then the lead)

### Facts it rests on
- Free plan: "30,000 free credits/month", "30x concurrency" (30 concurrent Docker jobs), credits "expire
  after a month and do not roll over" (https://circleci.com/pricing/, read 2026-10-15). Docker medium is
  10 credits a minute, large 20, Windows VM medium 40 (CircleCI credit pricing page, updated 2026-10-08,
  read 2026-10-15). Static test splitting is free on every plan (pricing page).
- Billing: "up to the nearest second, and then up to the nearest credit" (CircleCI FAQ, cited in PR 155).
  The probe on 2026-10-15: 239 s, about 40 credits (relief log, 00:43).
- The local suite runs in WSL2 (`harness.json` `"sensorsInWsl": true`; gate-log rows say `ranIn: "wsl"`).
- A pass is keyed by `treeKey` (`bin/lib/gate-tree.mjs:72`): the index listing, the sensors, the node and
  where the sensors ran (`place`). The key is `null` whenever the folder is not the index.
- The merge queue reads CircleCI's verdict on a commit from GitHub, with no CircleCI token:
  `circleciState(checkRuns, statuses)` (PR 167, `bin/merge-queue.mjs:61`).
- Actions run only on pull request events (`.github/workflows/gate.yml:13-18`), so pushing a branch costs no
  GitHub minutes.

### The flow
1. `check` runs its fast rows as today. In `checkSensors`, after the same-tree proof and before
   `underGateLock`, it asks `overflowPlan()` whether to overflow.
2. `overflowPlan` says yes only when all hold: `harness.json` declares `"overflow": "circleci"` (off unless
   declared, like `sameTree`); `JS_HARNESS_OVERFLOW` is not `off`; this gate is no inner gate and not in a
   held turn; the tree key is non-null (folder = index); the index tree holds `.circleci/config.yml` and
   it builds `overflow/*`; the remote is GitHub and `gh` answers; the ledger allows a run; and the expected
   wait exceeds the overflow round trip.
3. Expected wait = the holder's remaining time (median suite seconds of the last 20 passing gates minus its
   elapsed time, never below 0) plus the gates ahead in the line times that median. Round trip = the
   median of the last 10 overflow runs, 360 s until there are any. Both read from the gate log and the
   lock folder, which is readable without taking the lock.
4. Overflow: `git write-tree` (the index the hook was handed) → `git commit-tree <tree> -p HEAD` with a
   message naming the key → `git push --no-verify origin <sha>:refs/heads/overflow/<key12>`. The commit is
   synthetic: its tree is the commit's, its sha is not, so no pull request head gets a status.
5. Poll GitHub every 15 s for `<sha>`'s check runs and statuses, with `circleciState` (moved to
   `bin/lib/circleci.mjs`, shared with the merge queue). No run seen in 120 s, or no verdict in 15
   minutes: fall back (S6).
6. On a verdict: delete the remote branch; recompute the tree key; if it changed, fall back. Green: the
   `tests` row passes and names the run URL; the gate log gets a start and an end with `lock: "circleci"`
   and `code` = the key computed with `place: "circleci cimg/node:<tag> medium"`, so a second gate of the
   same tree is proven by it, but a local-place key never is. Red: the row names the run URL and the gate
   falls back to the local lock, so the failing tests are read locally, where the log is (no CircleCI
   token reads a private project's log).
7. Ledger: `~/.js-harness/circleci/ledger.jsonl`, one line per run: sha, branch kind (`overflow` or `queue`),
   the run's started and completed times from GitHub, and credits = ceil(seconds/60 × 10), rounded up.
   The merge queue appends its `queue/*` runs too (asked of JH 10). The cycle starts on the date in
   `~/.js-harness/circleci/cycle.json` (written once from the first run; corrected from the CircleCI Plan
   page or the usage API when a token exists).

### Credits
- 50 percent of 30,000 is 15,000 credits; at 40 credits a run that is about 375 overflows a cycle.
- At 2026-10-14's rate (74 long waits a day, about 2,960 credits) the half would go in 5 days. So a daily
  allowance paces it: (15,000 − used this cycle) / days left in the cycle, about 500 credits, 12 runs a day
  at the start. Unused allowance rolls to the next day. The runs go to the longest expected waits first
  only in the sense that a gate overflows only when its wait is long; there is no queue of overflows.
- Crossing 50 percent: `check` stops overflowing and one message goes to the lead (a flag file makes it
  once a cycle). Above the line the credits stay for the merge queue.
- The meter: without a token, the ledger is an estimate from GitHub's times (the probe's 239 s matched 40
  credits). The exact figure is CircleCI's usage export API, which needs a personal API token
  (https://circleci.com/docs/api/v2/ usage export, `POST /organizations/{org_id}/usage_export_job`); that
  token is his to create, so it is asked of the lead, not assumed.

### Windows
- Today's local gate already runs the suite in WSL2, so a Windows-only failure is invisible to it as well:
  the overflow does not widen that hole, and it does not close it. Closing it is an F-item: a Windows VM
  medium job on CircleCI is 40 credits a minute, four times Linux, so it fits once per ready pull request
  or once per merge-queue batch (about 160 credits a run), not per commit.

### What it does not change
- `gate -- <command>` (JH 8's file): a held turn never overflows.
- Pre-push: it checks Codex records, not the suite (`.githooks/pre-push`), and is untouched.
- The merge queue keeps its own `queue/*` runs; only the ledger is shared.

### Test splitting (later)
- The suite has zero dependencies, so a container's spin-up is mostly checkout. `parallelism: 2` on medium
  should cost about the same credits in half the wall time; `large` should do the same at one container.
  Measured once on a real overflow before either is chosen; not in this build.

## Tasks
- [ ] T1 (kind: design) This design, attacked by two independent readers, then taken to the lead.
- [ ] T2 (kind: build) `bin/lib/overflow.mjs`: the ledger, the allowance and `overflowPlan` (pure), with tests first.
- [ ] T3 (kind: build) The push, poll and bind, with `circleciState` shared, faked `git`/`gh` in tests.
- [ ] T4 (kind: build) The call from `checkSensors`, the gate-log record and `harness.json`; docs.
- [ ] T5 (kind: build) The `overflow/*` filter in `.circleci/config.yml`, by its owner or by agreement.
- [ ] T6 (kind: verify) One real overflow under a held lock; the credits it cost against the ledger.

## Log
- L1 2026-10-15 (his words, typed and tapped to the lead): "tenemos a circleci como gate, a github como gate
  y al local linux como gate, por que no utilizamos todos en paralelo y ademas creo que circleci se puede
  utilizar varios en paralelo no?"; then "Sí, constrúilo (Recomendada)" to "¿Construimos el desborde: el
  check corre local si el gate está libre y en CircleCI si está ocupado, primero con los créditos gratis?"
- L2 2026-10-15 02:21: JH 17 opened this document from main 2832ad8. Figures confirmed on circleci.com
  (pricing and credit pricing pages); gate-log measure as in Why.

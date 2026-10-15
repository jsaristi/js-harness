# A result memory shared by the worktrees

Locator: `odd/tasks/result-memory.md` · Engram mirror: `odd/result-memory/tasks` · Branch: `feat/result-memory` ·
Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
A test that passed in one worktree with exactly the inputs another worktree now has is known to pass there
too, so selection can skip it in either, from one store of passing traces shared by every worktree.

## Why
Step 1 (`odd/tasks/exact-tests.md`) keeps one trace per test file under each worktree's own git dir: a
worktree learns only from its own gates, and its next pass overwrites what it knew. The sessions here work
in several worktrees of one repository at once, on content that is mostly the same; a trace is keyed by
content (the hash of every read, the node, the system, the allowlisted variables), so a trace from any of
them is as true for the others. The plan he approved says so (S1).

## Done when
- `node --test bin/lib/trace-reads.test.mjs bin/lib/select-tests.test.mjs bin/check-shadow.test.mjs bin/check-exact-tests.test.mjs` exits 0
- Two worktrees of one repository read and write the same traces folder, under the git common dir.
- A test whose inputs match any stored passing trace of it is one selection would skip; one that failed has
  no stored trace left.

## In scope / Out of scope
- In: where traces are stored (`bin/check.mjs` `tracesDir`), how many per test and how they are named
  (`bin/lib/trace-reads.cjs`, `bin/lib/trace-reads.mjs`), and how selection reads them
  (`bin/lib/select-tests.mjs`); their tests; this document.
- Out: the switch to skip (S6's count decides it, `exact-tests.md`), the merge queue (step 3, JH 10), the
  flaky ledger (step 5).

## Constraints
- Selection still skips nothing: the gate runs in shadow until S6's count holds — because soundness is
  proven, not assumed (exact-tests.md S6).
- A trace counts only on every check matching (S5) — because the memory is only as sound as its key.
- Zero dependencies, and nothing written outside the repository's own git dir — because anything the
  harness writes must be undone exactly (AGENTS.md).

## Effort
high

## Ask me before
Nothing expected: the plan and its key are approved; spend stays inside the Codex allowance.

## Specs
- **S1** — Step 2 of the plan he approved (`C:\Users\Oficina\.js-harness\research\parallel-gate.md`, line
  23): "JH 8 - Result memory by content hash shared by the worktrees: skip a test whose touched files'
  hashes, Node version, OS and allowlisted env match a green run; tagged nondeterministic tests never
  cached."
- **S2** — The lead's order (2026-10-14 20:52): "then step 2 (result memory shared by the worktrees, keyed
  per S5)". S5 is `exact-tests.md`'s: "The key of a trace also holds the Node version, the OS and an
  allowlist of env vars, and a test that reads the clock, the network, the home or a non-node child's world
  is marked untraced and always runs."

## Design (read from the code, 2026-10-14 21:05)
- The store moves to `<git common dir>/js-harness/traces/<place>/` (`git rev-parse --git-common-dir`), the
  same folder for every worktree of the repository; `<place>` stays `windows` or `wsl-<distro>`.
- Each test file keeps several passing traces, one per content key: `<place>/<test>/<key>.json`, the key
  the hash of what makes a trace true (tracer hash, node, system, allowlisted variables, and every read
  with its state). A pass writes its key's file; the newest few per test are kept (a bound on the folder),
  the older ones go.
- Selection skips a test when any of its stored traces matches now, on every check; none matching, or none
  stored, runs it.
- A test file that failed removes every stored trace of it, in every worktree's view: a test seen to fail
  is never skipped on a pass from before (S1's "tagged nondeterministic tests never cached" is the
  untraced mark, which writes no skippable trace).
- The traces under each worktree's own git dir (step 1's place) are left: a gate in shadow reads only the
  new folder, and the old ones are removed by the first gate that writes there.

## Tasks
| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1, S2 | inline | done: T1a a181685; T1b (per-key traces, newest 8, failure removes all; L2) | several traces per test by content key, and selection matching any |
| T2 | S1 | inline | done (L3) | the store under the git common dir, shared by the worktrees; the old per-worktree folder removed |

## Log
- **L1** (2026-10-14 20:52): the lead's order, verbatim: "Next from his approved plan
  (research/parallel-gate.md): step 4 first (CI node --test with --test-concurrency=2, measure the GitHub
  run before/after; small), then step 2 (result memory shared by the worktrees, keyed per S5)." Step 4 is
  PR 166.
- **L2** (2026-10-15 00:02): T1b done. The tracer writes `<dir>/<encodeURIComponent(test)>/<key>.json`, the
  key the sha of tracerHash, node, os, env, untraced and reads (`traceKey`), whole by a temp file renamed;
  `pruneTraces` keeps the newest 8 (`KEPT_TRACES`) by mtime; a failure removes the folder and the old
  single file (`removeTraces`). `readTraces(dir, test)` in `bin/lib/trace-reads.mjs`, newest first,
  `readTrace` its newest; `startShadow` passes `readTraces`. RED: no export `readTraces`; GREEN: 15/15
  `trace-reads.test.mjs`, 8/8 `select-tests`, 3/3 `check-shadow`, 2/2 `check-shadow-wsl`, 3/3
  `check-exact-tests`, each alone. The pruning test was written with the implementation, not RED first.
- **L3** (2026-10-15 00:07): T2 done. `tracesDir` in `bin/check.mjs` asks `git rev-parse --absolute-git-dir
  --git-common-dir` and keeps the traces under `<common dir>/js-harness/traces/`; in a linked worktree it
  removes the folder under its own git dir. RED (`bin/check-exact-tests.test.mjs`, a linked worktree with
  the same content skipped 0 of 2 after the main one's gate), checked again with the old `tracesDir`
  after a first RED that also came from `core.autocrlf` (the linked checkout wrote CRLF where the test had
  written LF; the test repository now sets it false); GREEN 4/4, and 3/3 `check-shadow`, 2/2
  `check-shadow-wsl`.
- **L4** (2026-10-15 00:14): Codex on 1a48435..b3c1736: incorrect, one P2 (177,247 input tokens, inside the
  300,000 allowance). Kept side by side, an older traced pass with the same inputs could make a test
  skippable though a later pass was marked untraced; with one trace the later one replaced it. Corrected
  alone: any stored untraced pass makes the test run, whichever is newer (`bin/lib/select-tests.mjs`; RED
  then GREEN 9/9 in `bin/lib/select-tests.test.mjs`).
- **L5** (2026-10-15 00:24): the gate of 1f53479, the first to read the shared store: 90 of 125 test
  files would have been skipped, none of them failed. Codex recheck `b3c1736..1f53479`: correct, 1 of 1
  fixed (35,094 input tokens). gentle-ai assess of ac3fe14..1f53479: medium, not due (under_budget).
  merge-tree against origin/main eab3eff clean. Pushed; PR 172. Risk: item 1 (the persisted layout of the
  traces, and the old per-worktree folder deleted; a cache only the shadow reads).
- **Next step** (00:24): PR 172 waits for his merge (code). After it, step 5 of the plan, the flaky ledger,
  a feature of its own.

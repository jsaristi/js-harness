# JH 111 · gate: a pass that skipped tests must not stand for a commit

Locator: `odd/tasks/gate-narrow-pass.md` · Engram mirror: `odd/gate-narrow-pass/tasks` · Branch: `worktree-gate-narrow-pass`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
A gate never takes a pass as the proof of a tree when a run of the same files failed somewhere the pass did not run,
so a commit whose tests failed on CI is refused until a run as wide as that one passes.

## Why
JH 109 found it on 2026-10-30 (`odd/tasks/f8-s9-host-watch.md`, L8): commits `98d4c7cb` and `60bddd22` entered with a
red test because a pre-commit gate with its tests on CI failed and a hand `npm run check` of the same tree, run in the
WSL mirror where that test skips itself, then passed and was taken as `same`. main was never exposed (the merge queue
runs the whole gate on GitHub Actions); the local gate is the hole. This touches a guard (Task Size high risk, item 2).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/gate-narrow-pass.md` exits 0
- `node --test bin/lib/gate-log.test.mjs bin/lib/gate-tree.test.mjs bin/check.test.mjs bin/check-ci-gate.test.mjs` exits 0
- the planted case, `a tree whose tests failed on CI is not proven by a narrower pass here` in `bin/check.test.mjs`,
  failed before the fix and passes after it, both runs quoted in `## Log`
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `bin/lib/gate-log.mjs` (`provenBy`, the end line), `bin/lib/gate-tree.mjs` (the files key), `bin/check.mjs`
  (where the proof is asked and the ends are written), their tests, the ROADMAP's Sensors row, `docs/FAILURES.md`.
- Out: the WSL mirror's skip of `bin/lib/gentle-ai-absence.test.mjs` (see Log, L2: it is right where it is); the
  other open failures of `odd/tasks/f8-lead-rigor.md` L13; `~/.claude`, `~/.codex`, credentials, gentle-ai config.

## Constraints
- The fix is at the proof (`provenBy`), tests first — because that is where a narrower pass is taken for a wider one.
- A gate log line gains a field, never changes one — because older installs read the same log.

## Ask me before
Nothing here is his: Sebastián is away until about 02:00Z; a decision only he can take goes to the lead as a recorded
question.

## Specs
1. The brief (lead, 2026-10-30): "a planted case where a failed full run is followed by a narrower passing run must
   leave the next commit refused."
2. The brief: "say in the feature document which of these holds: the mirror's skip is wrong (a test that needs `.git`
   should not pass by skipping there), `same` accepts a pass whose run is narrower than the run it replaces, or both."
3. The brief: "Fix it at the cause, tests first."

## Tasks
- [ ] T1 (kind: build) specs 1 and 3: the files key and `provenBy` refusing a pass a failed run of the same files
  stands against; the planted case red then green — commit: pending
- [ ] T2 (kind: docs) spec 2: the ROADMAP's Sensors row, `docs/FAILURES.md`, the session summary — commit: pending
- [ ] T3 (kind: verify) Codex, the lenses, an independent verifier, the PR — commit: pending

## Log
- L1 (2026-10-30, the brief as written, title): "JH 111 · gate: a pass that skipped tests must not stand for a commit".
  Its words are in `C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T22-36-50-255Z-ff7bc7b9.md`.
- L2 (2026-10-30, the cause): `same` accepts a narrower pass; the mirror's skip is not wrong. Evidence, the gate log
  (`~/.js-harness/gate-log/log.jsonl`, lines 307-318): line 308, the commit gate on CI (`lock: ci`) ends `fail` with
  `failing: ["no file under bin, evals or scripts names gentle-ai ..."]` and no `code`; line 310, the hand check
  (`lock: own`, `ranIn: wsl`, `skip: {files: 312, skipped: 214}`) ends `pass` with code `112f314f...`; line 311, the
  next commit's gate writes `same` by that pass and runs nothing. Lines 313-316 repeat it (CI fail, WSL pass
  `6ac93895...`, `same`). Why: `checkSensors` asks `provenBy` before it sends tests to CI (`bin/check.mjs:1564`), and
  `provenBy` (`bin/lib/gate-log.mjs:404`) takes the last passing end with the key and reads nothing else; a CI end
  never carries a key, so a failure on CI of the very files a later pass proves is invisible to it. The key holds the
  place (WSL), so only a WSL pass proves a WSL key, but nothing asks whether the files failed elsewhere. The skip:
  `bin/lib/gentle-ai-absence.test.mjs:140` skips with no `.git` outside CI by design (the mirror holds untracked and
  ignored files, so what a commit holds cannot be told there: Codex P2 on bca90373, R3-002 on 57cb302a), and fails
  on CI without `.git`; a run there cannot do better, so the skip is the narrowing and the proof is what took it for
  the whole.
- L3 (2026-10-30, searched before building): `js-harness rules` names no rule of the proof (its values are the gate's
  sizes and times); the rule is the ROADMAP's Sensors row ("A project may declare `"sameTree": "skip"` ...") and its
  check is `provenBy`, both amended here; `odd/tasks/gate-wait.md` T12 built it. codegraph over `provenBy`,
  `treeKey`, `discoverSameTree`, `testsOnCi`: no other reader of a proof.

- L4 (2026-10-30, the fix): every gate's end, CI's included, now names `files`, the key of the index's files
  (`filesKey`, `bin/lib/gate-tree.mjs`: `git ls-files -s`, no runtime, sensors or place); `provenBy` takes it and
  refuses a pass when a gate of those files failed after it, or before it where the pass did not run each sensor
  (`ranIn`), or when the gate cannot name its files. A failure here followed by a pass here still proves the tree.
  The planted case before the fix, `node --test --test-name-pattern="narrower pass here" bin/check.test.mjs`:
  `✖ a tree whose tests failed on CI is not proven by a narrower pass here ...`, `actual: 0, expected: 1`, the row
  `INFO  sensors  no sensor ran (tests): this tree is the one gate 4b5e0b7a passed ...`. After it: `✔` both planted
  cases; `node --test bin/lib/gate-log.test.mjs bin/lib/gate-tree.test.mjs` 60 of 60; `js-harness gate -- node
  --test bin/check.test.mjs bin/check-ci-gate.test.mjs bin/gate.test.mjs` 335 of 335.
- L5 (2026-10-30, cost said): once a tree failed in one place, a pass of it in another proves nothing while the
  failure is in the log (rotated past `gate-log-size`): its gates run their sensors, a commit's on CI, as they would
  with no `sameTree`. A failure that ran no sensor (`error`, `sensors: []`) stands against every pass of its files.
  Both cost a run, never a proof; a tree that failed is rarely gated again unchanged.

- L6 (2026-10-30): the first commit of T1 failed its gate on CI, once: `bin/conventions-structure.test.mjs` refused
  `bin/check.mjs` at 2042 lines over its ceiling of 2031 ("move code out of it rather than into it"). `testsOnCi`,
  which the fix changes, moved to `bin/lib/ci-gate.mjs`, the module of the gate on GitHub's machines, whose imports
  it already used but three core ones (`failingTests`, `gateRecord`, `gateRow`/`gateLogRows`); `check.mjs` is 2010
  lines and its ceiling 2010. Then `js-harness gate -- node --test bin/conventions-*.test.mjs bin/check.test.mjs
  bin/lib/rules-sources.test.mjs bin/lib/gentle-ai-absence.test.mjs`: 276 of 276.

## Next step
T1 and T2 committed, then `npm run check`, Codex and the lenses over the slice, the verifier, the PR.

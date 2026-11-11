# Install and uninstall edges (the audit triage's work unit 7)

Locator: `odd/tasks/install-uninstall-edges.md` · Engram mirror: `odd/install-uninstall-edges/tasks` · Branch:
`worktree-install-uninstall-edges` · Delivery: one pull request · Base: `origin/main` at `fbaa7df5`

## Goal
The six install and uninstall edges the Fable 5.2 audit verified (M29, M30, M35, M36, L2, L3) each behave as the
triage's unit 7 says, with a test that fails on today's code.

## Why
`AGENTS.md` holds that whatever the harness writes outside this repository is recorded so it can be undone exactly.
Each of the six is a place where that does not hold, or where the person is not told what happens: a record that
dies with a worktree while the files it names stay, a registry value removed whatever it holds, a file written over
with no copy, a prompt that names less than it removes, an upgrade that hides its sync's error, and a version
comparison that is wrong for the prerelease tags `check` accepts.

## Done when
- `node --test bin/lib/project.test.mjs bin/update.test.mjs bin/tui.test.mjs bin/lib/version.test.mjs bin/lib/component-write.test.mjs bin/lib/manifest.test.mjs bin/lib/status-line-install.test.mjs bin/install.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/install-uninstall-edges.md` exits 0
- `node --test bin/conventions-structure.test.mjs bin/conventions-errors.test.mjs bin/conventions-voice.test.mjs` exits 0
- each of S1 to S6 has a case in those files that fails on `fbaa7df5`
- an independent verifier read the high-risk part (S1, S3, S6) against this document
- the pull request is ready and told to the lead with `js-harness notify --to orchestrator --kind ready --pr <n>`

## In scope / Out of scope
- In: `bin/lib/project.mjs` (the hook step and the exclude step in a linked worktree), `bin/update.mjs` (the sync's
  error), `bin/lib/status-line-uninstall.ps1`, `bin/tui.mjs` (one prompt), `bin/lib/version.mjs` (`compareSemver`),
  `bin/lib/component-write.mjs`, `bin/install.mjs` (one line of the report), their tests, this document, the session
  summary and the documents that state the changed behaviour.
- Out: `bin/lib/manifest.mjs`, which is at its size ceiling (1,650 of 1,650, `bin/conventions-structure.test.mjs:72`)
  and where JH 172 and JH 175 work now: no line of it changes. The land's refresh. The other findings of the audit.
  A restore of the kept copy by `uninstall` (S6): it would change what `uninstall` removes, inside that file.

## Constraints
- No edit in `bin/lib/manifest.mjs` — because of its ceiling and the two sessions working in it.
- Nothing a linked worktree's `init` wrote before this change is orphaned by it — because those per-worktree
  manifests exist on machines today; their `uninstall` still undoes what they record.
- No spend outside the plan, no credential, no setting of GitHub or of the machine — the brief.
- One gate, one Codex review and one lens review a slice, one at a time, nothing heavy beside another session's gate —
  because the machine is shared and short of memory.

## Ask me before
Nothing planned is his. The unit is the lead's call in the triage ("Whose call: the lead's"), and the brief gives
it: "This unit is the lead's call in the triage, no question of his: build it as the unit says." A decision of his
that the triage did not put to him goes to the lead as one notice with the recommended option.

## Depth pass
- 1. Method: the discipline is defect repair in an installer, as a maintainer of a package manager does it:
  reproduce each defect at its source before touching it; write the failing test first; make the smallest change
  that turns it green; and where the choice is between a larger mechanism and not writing, prefer not writing what
  cannot be recorded. The standard is exact undo: every byte written outside the working tree has a record that
  outlives the thing that wrote it, and nothing the person did not write for the harness is removed. The search of
  `rule:reuse-first`: `writeHookGate` already has a branch for a hooks path this run does not own
  (`bin/lib/project.mjs:659-669`), which S1 extends; `excludeFile` already returns a reason that keeps the file
  (`bin/lib/project.mjs:353`); the status-line install already refuses a value it did not write
  (`bin/lib/status-line-install.ps1:32-35`), which S3 mirrors; `install`'s report already has a line per kept file
  (`bin/install.mjs:259`), which S6 extends; no semver comparison other than `compareSemver` exists
  (`git grep -n "prerelease\|semver" bin/lib` names only `version.mjs` and its callers).
- 2. Raw material: the triage's unit 7 (`docs/proposals/2026-11-10-audit-triage.md:191-201` on
  `origin/docs/audit-triage`) and its verdict rows (`:89`, `:90`, `:95`, `:96`, `:103`, `:104`); the audit's
  findings (`docs/audits/2026-11-09-fable-5-2-audit.md:270-275`, `:289-293`, `:300-303`); the code at `fbaa7df5`:
  `bin/lib/project.mjs:638-689` (the hook step), `:857-864` (the exclude step), `:1028-1029` (the manifest path),
  `bin/update.mjs:560-572`, `bin/lib/status-line-uninstall.ps1:20-23`, `bin/lib/manifest.mjs:1227-1233`,
  `bin/tui.mjs:57`, `bin/lib/version.mjs:14-22`, `bin/lib/component-write.mjs:31-48`; and this worktree itself:
  `git rev-parse --git-path js-harness/manifest.json --git-path info/exclude` prints
  `D:/js-harness/.git/worktrees/install-uninstall-edges/js-harness/manifest.json` and
  `D:/js-harness/.git/info/exclude`, the two places of M29.
- 3. The bar:
  spec 1: `node --test --test-name-pattern "linked worktree" bin/lib/project.test.mjs`: today `init` in a linked
  worktree writes the shared hook and records it in the worktree's own manifest (the test at
  `bin/lib/project.test.mjs:1581` asserts it); after, it writes no shared file and says where
  spec 2: `node --test --test-name-pattern "sync after upgrade" bin/update.test.mjs`: none, new behaviour
  spec 3: `node --test bin/lib/status-line-install.test.mjs`: 5 pass today and none compares the value; after, one
  holds that the undo removes the value only when it is the install's
  spec 4: `node --test --test-name-pattern "prompt" bin/tui.test.mjs`: today the prompt names no folder
  spec 5: `node -e "import('./bin/lib/version.mjs').then((v) => console.log(v.compareSemver('1.2.3-rc.1', '1.2.3-rc.1')))"`:
  -1 today; 0 after
  spec 6: `node --test bin/lib/component-write.test.mjs`: 5 pass today and a first write over a file leaves no copy
- 4. Refutation: the cheapest test that the request does not hold is to run each defect. Run 2026-11-11 at
  `fbaa7df5`: `compareSemver('1.2.3-rc.1', '1.2.3-rc.1')` gave -1, `('1.2.3-rc.1', '1.2.3')` gave -1 by accident of
  `NaN`, `('1.2.3-rc.2', '1.2.3-rc.10')` gave -1; `writeComponent(file, 'shipped', undefined)` over a file holding
  "the user own text" returned `skipped: false`, the file then held "shipped" and its folder held that one file;
  M29 is asserted by the suite itself (`bin/lib/project.test.mjs:1581-1620`); M30, M35 and M36 are read at the
  lines of item 2. 6 of 6 defects stand.
  Verdict: supports
- 5. Request: close the six findings of unit 7, each with its test first: (S1) `init`, and the first `sync` of a
  clone, in a linked worktree write none of what every worktree shares and say where it is written and recorded;
  (S2) `upgrade` prints what its sync said when it fails; (S3) the status-line undo removes the policy value only
  when it holds what the install wrote; (S4) the prompt of `uninstall machine` names the folders it removes;
  (S5) `compareSemver` orders prerelease versions as semver does; (S6) a first write over a file that is there
  keeps a copy of it and says so.
  Adds: none

## Specs
The source of the authority to build without asking: his words in the lead's chat (transcript
`ea85ec35-82e1-4aa9-abe3-98bd153a50b0`), read with `js-harness sessions --quote`. Line 6716, 2026-11-11T05:26:36Z:
"une lo que quede listo y tienes autorizacion para poder avanzar en todo y escoger siempre la opcion recomendada, no
preguntes, avanza y se completamente autonomo." Line 6905, 2026-11-11T05:30:20Z: "contesta TODAS las preguntas con
recomendado TODAS y avanza los mas posible eres completamente autonomo". The triage put no question on this unit;
its line is "**Whose call:** the lead's", and the lead's brief answers it: "This unit is the lead's call in the
triage, no question of his: build it as the unit says."

The unit as the triage wrote it: "record the shared files of `init` in a linked worktree where the main checkout's
record keeps them, or refuse `init` there; print the sync's own error after an upgrade; remove the status-line
policy value only when it holds what install wrote; name the folders in the uninstall prompt; compare prerelease
versions; keep a copy of a file a first install would overwrite."

- S1 (M29). In a linked worktree, `init` and the first `sync` of a clone write no hook outside the working tree and
  no line of the shared `info/exclude`; each is reported as skipped with where it is written and recorded:
  `js-harness sync` in the main checkout. A per-worktree manifest then records only what dies with the worktree.
- S2 (M30). When the sync after an upgrade fails, `upgrade` prints what that sync wrote to its error stream (and
  the error of a sync that could not start) before "sync after upgrade failed".
- S3 (M35). `status-line-uninstall.ps1` removes `sessionStatusLine` only when it holds the value the install
  writes for that folder; any other value is left and said.
- S4 (M36). The prompt of `uninstall machine` names each folder of `.js-harness` it removes, and a test holds the
  names to the folders `uninstall` removes.
- S5 (L2). `compareSemver` follows semver's precedence: a prerelease is older than its release, equal to itself,
  its identifiers compared one by one, build metadata ignored.
- S6 (L3). With no record of the file, `writeComponent` keeps a copy of a different file already at the target
  before writing, names the copy in the record, and writes nothing when the copy cannot be made; `install` says it.

## Tasks
- [ ] T1 (kind: docs) this document, with its depth pass, before any code · S1-S6 · inline · commit 1
- [ ] T2 (kind: build) S5 `compareSemver` and S2 the sync's error · inline · slice A
- [ ] T3 (kind: build) S6 the kept copy and S4 the prompt · inline · slice A
- [ ] T4 (kind: build) S3 the status-line undo and S1 the linked worktree · inline · slice B
- [ ] T5 (kind: verify) gate, Codex and the lenses on slice A, then on slice B; the independent verifier on S1, S3
  and S6
- [ ] T6 (kind: docs) the session summary, the pull request, the notices

## Log
- L1. The request, as the lead's brief wrote it (2026-11-11, brief
  `2026-11-11T06-06-47-550Z-9d2b5c87.md`): "You own one feature: the install and uninstall edges (the triage's work
  unit 7: M29, M30, M35, M36, L2, L3)." and "The decision: This unit is the lead's call in the triage, no question
  of his: build it as the unit says."
- L2. Decision, S1: the unit allows two ways, to record the shared files where the main checkout's record keeps
  them, or to refuse. Chosen: refuse the shared files alone. Why not a refusal of the whole `init`: a session
  isolated in a worktree is the plausible caller, and the files `init` writes in the working tree (`harness.json`,
  `AGENTS.md`) are committed from there. Why not a write into the main checkout's manifest from the worktree: that
  manifest may not exist, and one without `harness.json` is refused by `init` as stale
  (`bin/lib/project.mjs:1043`), so it would need a new partial format read by `init`, `sync`, `uninstall`,
  `projectLocation` and `readRecorded`; when it does exist, the hooks and the exclude line already do, and nothing
  shared is written. So the main checkout is made the only writer, and its record the only one: the next `sync`
  there writes and records them (`writeProject` with `clone`, `bin/lib/project.mjs:750-753`).
- L3. Decision, S6: the copy goes beside the file, `<name>.before-js-harness-<8 hex of its sha256>`: found where
  the person looks, never written over a different earlier copy, and the same on a second run. `uninstall` leaves
  it, since it is the person's file; putting it back is out of scope (the ceiling of `manifest.mjs`).
- L4. Decision, S3: no test writes to the registry (`bin/lib/status-line-install.test.mjs:1-4` says why); the test
  holds the script's text, and the script is run once by hand against a scratch key, recorded here.

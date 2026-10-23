# sync-exclude

Branch `feat/sync-exclude`, from main at ac20086a. One pull request. Runner: `node --test`.

## Goal
A project `init` set up before it wrote the `.atl/` exclude line gets that line from `js-harness sync`, recorded so `uninstall` takes it back exactly.

## Why
PR 511 (odd/tasks/quiet-gate.md) made `init` add `.atl/` to the clone's `info/exclude`, but every project already set up kept gentle-ai's registry as an untracked file, which its review calls unassessable at every commit.

## Done when
- `node --test bin/lib/project-exclude.test.mjs` exits 0
- `node --test bin/lib/project.test.mjs bin/lib/project-switches.test.mjs bin/init.test.mjs bin/install.test.mjs bin/functions.test.mjs` exits 0

## In scope / Out of scope
- In: `bin/lib/project.mjs` (`updateRecorded`, the sync of a clone with a manifest), its tests in `bin/lib/project-exclude.test.mjs`, `README.md`.
- Out: `functions apply`, which changes what the switches ask and nothing else; a manifest that already records the line, which sync leaves as it is.

## Constraints
- A manifest that records the line is left alone, line or not — because a line somebody took out after `init` is their choice.
- The line goes through the same `excludeFile` guard as `init` and `uninstall` — because a link swapped into `.git/info` must not send it to another file.
- A failed manifest write takes the line back — because sync rolls back everything else it wrote.

## Ask me before
Nothing: covered by his Pregunta 49 ("Sí, las dos"), as the orchestrator relayed at 02:38.

## Specs
- S1. Orchestrator, 02:38: "a project initialized before this change also gets `.atl/` in `.git/info/exclude`, through whatever path updates an existing project (sync or functions apply, as you judge). It must be idempotent and recorded so uninstall removes it exactly."
- S2. Sync adds no line where the lines already leave `.atl` out, and records none.

## Tasks
- [x] T1 (kind: build) S1-S2: sync adds and records the line, rolls it back on a failed write, refuses a linked path; tests and README. Route: inline. Commit 9633368a.

## Log
- L1. 2026-10-23 02:38, the orchestrator's request, quoted in S1; the follow-up named in PR 511.
- L2. 2026-10-23, path chosen: `sync`, since it is what updates an existing project to the copy that runs; `functions apply` only applies the switches.
- L3. 2026-10-23, T1 committed 9633368a (its gate printed the single PASS line). gentle-ai on 9633368a (ac20086a..9633368a): high (escalated, item 1: writes an existing project's exclude file and moves its manifest to format 2), lenses risk and reliability, approved and acknowledged (lineage review-14bc760495025125).
- L4. 2026-10-23, Codex on ac20086..9633368 (89,725 input tokens, recorded): correct, no findings.

## Next step
Pull request opened; the orchestrator merges.

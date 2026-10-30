# F8 S13: the rehearsal on a scratch project

Locator: `odd/tasks/f8-s13-rehearsal.md` · Engram mirror: `odd/f8-s13-rehearsal/tasks` · Branch: `f8-s13-rehearsal`
Delivery: one pull request, a chain if it passes 400 lines · Test runner: `node --test`

## Goal
The whole path of the reverse-engineering document's 11.1 is walked once on a scratch project in a scratch home,
with the 11.3 guide, engram's recovery, the import row and a planted directive checked there, and a rehearsal
test beside `scripts/practice-lib.mjs` holds what runs free.

## Why
The roadmap's order puts S13 before S12 and S2: "the whole path is proven on a scratch project before his projects
move and before anything is removed" (`docs/ROADMAP.md`, F8 plan). S5c-a comes first "so the rehearsal shows
directive coverage and S12's migration carries it" (reverse-engineering document, 14.5).

## Done when
- `node --test scripts/rehearsal-lib.test.mjs scripts/rehearsal.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s13-rehearsal.md` exits 0
- `npm run check` exits 0
- `## Walk` below records one run of `node scripts/rehearsal.mjs` from a clean commit: each step's verdict, its
  cost beside its estimate, and the real home's files unchanged
- the rehearsal test fails on a planted break, and `## Log` names that run and the green one

## In scope / Out of scope
- In: `scripts/rehearsal-lib.mjs`, `scripts/rehearsal-lib.test.mjs`, `scripts/rehearsal.mjs`,
  `scripts/rehearsal.test.mjs`, this document, S13's line of `docs/ROADMAP.md`, `docs/FAILURES.md`, the session's
  summary under `docs/sessions/`; `bin/` only for a defect the walk finds, each its own test-first commit, named to
  the lead first when it touches install, uninstall or the manifest.
- Out: his real home (`~/.claude`, `~/.codex`, `~/.js-harness`'s install), any credential, gentle-ai's config, the
  installed copy (the lead refreshes it), S12's migration.

## Constraints
- Every install and uninstall runs in the scratch home (`mktemp -d`, outside the repo), with a PATH of only its own
  shims — because the real machine must stay untouched (high risk: installer and uninstall).
- No credential is copied or linked into the scratch home — because the brief forbids it.
- Nothing of gentle-ai, Orca or herdr is on the walk's PATH or among the commands it runs — the roadmap's pass line.
- A paid run reads its plan first, records its real cost beside the estimate, and stops at 1.5 times it — his
  words of 2026-10-29T10:40Z, as the brief quotes them.

## Ask me before
- A run that would pass 1.5 times its estimate.
- A `bin/` change to install, uninstall or the manifest.

## Specs
- S1 (ROADMAP, S13, Changes): "the whole path of the reverse-engineering document's 11.1 walked on a scratch project
  in a scratch home: `install` with a preset, `stack install`, `init`, a feature, a slice with both reviews, a push
  to a local bare remote, then `uninstall project` and `uninstall machine`".
- S2 (same): "the day-to-day guide of 11.3 checked there".
- S3 (same): "engram's recovery after a start and a compaction (13.3 row 11)"; row 11's check: "on S13's scratch
  project a session start and a compaction each bring back a planted observation within 16,384 bytes".
- S4 (same): "a `CLAUDE.md` planted above the project turns the import row red (row 16)".
- S5 (same): "a planted directive without a control makes `rules check` exit 1 (14.5)"; 14.5: "the step's probe
  test (S13's rehearsal test, run with `node --test`) plants it and passes only on that exit".
- S6 (ROADMAP, S13, Probe and pass): "the nine rows of 11.1 do what they say; nothing of gentle-ai, Orca or herdr
  takes part; after the uninstalls every path the manifests recorded is gone or back to its bytes".
- S7 (the brief): "A rehearsal test beside scripts/practice-lib.mjs, test first"; done when "the rehearsal test
  passes and fails on a planted break (say both runs)".

## Tasks
- [x] T1 (kind: docs) close S5c-a: T9 by the lead's decision, S5c-a's roadmap line — inline; `ef23c03e`
- [ ] T2 (kind: build) `scripts/rehearsal-lib.mjs`, the pure part: the walk's steps, what each must show, the planted
  fixtures, the comparison of recorded paths after the uninstalls, the absence of gentle-ai, Orca and herdr — S1 to
  S6; inline, test first
- [ ] T3 (kind: build) `scripts/rehearsal.test.mjs`, the free rehearsal test: a scratch project in a scratch home,
  `init`, the planted directive makes `rules check` exit 1 — S5, S7; inline, test first
- [ ] T4 (kind: build) `scripts/rehearsal.mjs`, the walk, run by hand — S1 to S6; inline
- [ ] T5 (kind: verify) one walk from a clean commit, recorded under `## Walk` with its cost — S1 to S6
- [ ] T6 (kind: verify) the rehearsal test on a planted break, then green again — S7
- [ ] T8 (kind: build) the `doctor` row of 13.3 row 16: the project's root `CLAUDE.md` imports `AGENTS.md` and no
  `CLAUDE.md` above it turns the import off, test first, its own commit (D1, L4) — S4; inline
- [ ] T7 (kind: docs) Codex and the lenses on every code commit, gentle-ai lines, the independent verifier over
  the range, PR, ready notice, summary — inline

## Walk
Not run yet.

## Next step
State at the context pause (2026-10-29, branch `f8-s13-rehearsal`, worktree
`D:\js-harness\.claude\worktrees\f8-s13-rehearsal`, HEAD `6e5cd3e8`, nothing pushed, no PR): T1, T2, T3 and T8 built
(`ef23c03e`, `d1cea611`, `57584e5d`, `604253a6`, `2c4e534e`). Reviews: lenses on `f2110239..57584e5d` (risk,
reliability, readability) and `57584e5d..2c4e534e` (reliability, readability, resilience), 0 findings each; Codex on
`541464c..6e5cd3e`, four P2, (3) and (4) and the CLAUDE_CONFIG_DIR change fixed in `d8fb14a5`, (1) in `430130ed`; next, test first: (2), then the lens and Codex reviews of
`6e5cd3e8..HEAD`; (1) for the record: `importsAgents` must match a fence's character and
length; (2) `importHealth` must treat a root CLAUDE.md that `claudeMdExcludes` drops as not loaded (reuse
`excludingGlob`/`claudeMdSource` of `bin/lib/payload.mjs`); (3) `rehearsalEnv` must drop git's repository variables
as `childEnv` of `scripts/practice-lib.mjs` does; (4) `snapshotTree` must record folders, so a recorded folder left
after uninstall fails `restoreProblems`. Also `rehearsalEnv` must stop setting `CLAUDE_CONFIG_DIR` (Claude then keeps
`.claude.json` inside it, where stack does not read it back). Then T4: the walk is drafted in
`C:\Users\Oficina\.claude\jobs\bb7fa0ca\tmp\walk-part.mjs`, to append to `scripts/rehearsal.mjs` (its imports:
practice-lib `readHostStream`, `hostCost`, `redacted`, `realHomeFiles`, `compareSnapshots`, `walkJourney`;
stack-scratch `realFilesOf`, `claudeJsonMcpPart`, `registrationsLeftIn`, `shimContent`; evals `SANDBOX_SWITCHES`,
`allocatePort`, `killByPort`; the free test's `HIS_SETTINGS`/`HIS_CLAUDE_MD` move into it). Then T5, one walk
(`node scripts/rehearsal.mjs`), estimate $5, stop past $7.50; T6; reviews of the fixes and the walk; gentle-ai lines;
the verifier; chained PRs (slice 1 `f2110239..57584e5d`, slice 2 to the fixes, slice 3 the walk); ready notice;
summary.

## Log
- L1 (2026-10-29, the lead's brief `briefs/2026-10-29T19-21-42-028Z-0339f9b7.md`): "JH 90 · F8 S13: the rehearsal
  on a scratch project ... Then S13, its own feature document `odd/tasks/f8-s13-rehearsal.md`, opened before the
  first source write: the nine rows of 11.1 walked on a scratch project in a scratch home from `mktemp -d` (install
  with a preset, stack install, init, a feature, a slice with both reviews, a push to a local bare remote,
  uninstall project, uninstall machine), the 11.3 guide checked there, engram's recovery after a start and a
  compaction, a planted CLAUDE.md above the project turning the import row red, a planted directive without a
  control making `rules check` exit 1. Pass: as the roadmap's S13 block says (nothing of gentle-ai, Orca or herdr
  takes part; after the uninstalls every recorded path is gone or back to its bytes). A rehearsal test beside
  scripts/practice-lib.mjs, test first. Cost: the roadmap says one walk, about $5 [i] ... High risk (installer,
  uninstall, the real machine must stay untouched): every install and uninstall runs in the scratch home, never
  the real one; after its own checks, one independent verifier over the range ... Never touch credentials,
  ~/.claude, ~/.codex or gentle-ai config; never copy .credentials.json into a scratch home. Do not refresh the
  installed copy."
- L2 (2026-10-29, evidence, a read-only map of the code): `install` has no preset; the preset is `init --preset
  complete|lean|custom`, so row 1's "with a preset" is walked as `install` then `init --preset complete`. `stack
  install` runs codex, codegraph and context7 and leaves engram and its plugin as his steps
  (`bin/lib/stack-install.mjs:145-169`, F8 S11 L4), so the walk runs those steps as he would, from the printed
  fixes, and they are not in the manifest. `codex-review` links `auth.json` from the real Codex home into a lean
  home under the harness home (`bin/lib/codex-review-home.mjs`); `lens-review` runs on the CLI's own login and drops
  every token (`bin/lens-review.mjs:37`). Both pre-push rows pass a first push to a remote with no branch, so the
  walk pushes twice. The doctor row of 13.3 row 16 does not exist: `grep -rn "claudeMdExcludes\|@AGENTS\.md\|imports
  AGENTS\|above it" bin` finds only the payload row of `check` (`bin/lib/payload.mjs:232-267`); row 16 lands at S12.
- L3 (2026-10-29, decisions, the session's own): D2, the slice's two reviews run as any review of his runs, from
  his real environment with `--cwd` on the scratch project: the logins answer where they live, nothing is linked or
  copied into the scratch home, `lens-review` keeps no session (`--no-session-persistence`), and the records land in
  the scratch project's git folder. Only the reviews leave the scratch environment; every install and uninstall
  stays in it. D1, the lead's: row 16's import row does not exist, so S13 cannot turn it red as written. (a) S13
  builds it, test first, as a `doctor` row in `bin/` (S12 then uses it); (b) the step is recorded owed to S12 and the
  walk checks the rest. Recommended: (a), since S13's line is that the whole path is proven before S12, and the row
  is small. Until the answer, T2 to T4 build everything else.
- L4 (2026-10-29, the lead's note in the channel at 14:36 local): "Lead: D1 (a): build the doctor import row
  test-first in bin/doctor, its own commit; S12 reuses it. D2 yes: the two reviews run from his env with --cwd on the
  scratch project; nothing linked or copied into the scratch home, and the review records land in the scratch
  project's git dir, not this repo's." So T8 builds the row.

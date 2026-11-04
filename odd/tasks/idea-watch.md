# The idea watch: each gentle-ai release read by area for what serves the harness

Locator: `odd/tasks/idea-watch.md` · Engram mirror: `odd/idea-watch/tasks` · Branch: `idea-watch`, from main 70790d92
Delivery: one pull request, marked ready, merged by the lead · Test runner: `node --test`

## Goal
`js-harness idea-watch` reads each new stable gentle-ai release from a fetch-only clone that `uninstall machine`
removes, buckets its changed paths by area for a verdict of adopt, adapt or ignore, and `doctor` says how many
releases are not yet read.

## Why
He will not have gentle-ai installed, and it keeps releasing; his words (S1) ask to read what each release adds or
removes and keep what helps the harness, without copying it (S3). The design is the reverse-engineering document's
section 5; question 129 dropped it with the install watch at S11, and his words of 2026-11-03 bring it back.

## Done when
- `node --test bin/lib/idea-watch.test.mjs bin/idea-watch.test.mjs` exits 0
- `node --test bin/lib/manifest.test.mjs bin/doctor.test.mjs bin/lib/gentle-ai-absence.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/idea-watch.md` exits 0
- `npm run check` exits 0
- `## Probe` records, in a `mktemp -d` home: `idea-watch draft` makes the clone, records it in the machine manifest
  and prints the v4.3.0 → v4.3.1 section; `uninstall machine` removes the clone and its record
- the fixture diff with one path per area and one unmatched puts each path in its area and lists the unmatched one
  under "To classify by hand"; an `ignore`-only release drafts one batched line (the diet's S9 pass line, a test)

## In scope / Out of scope
- In: `bin/lib/idea-watch.mjs`, `bin/idea-watch.mjs` and their tests (new); `bin/lib/manifest.mjs` and its test (the
  `clones` record and its removal); `bin/doctor.mjs` and its test (the `idea-watch` row); `bin/js-harness.mjs` (the
  command list); `bin/lib/gentle-ai-absence.test.mjs` (the new files on its list, with why);
  `odd/tasks/gentle-ai-update-check.md` (the record, seeded); `docs/SPEC.md` (the idea watch row); this document.
- Out: `docs/ROADMAP.md`, whose S2 and S9 text JH 137 owns (the line it should say goes to the lead, `## Next step`);
  his real home, `~/.claude`, `~/.codex`, credentials and gentle-ai's config; installing, building or running
  gentle-ai; any adoption a read proposes, which is his yes through the lead.

## Constraints
- Fetch only: a bare clone, no working tree, never built or run — because his words S2 and S3 keep gentle-ai off the
  machine as a program; only its source is read.
- The clone's path is recorded in the machine manifest before it is filled, and `uninstall machine` removes only a
  recorded path inside `~/.js-harness` — because what the harness writes outside the repo is undone exactly
  (AGENTS.md), and a manifest edited by hand must not point the removal anywhere else.
- Tests run in a `mktemp -d` home; the only network is the public gentle-ai repository — because the brief allows no
  other remote operation.
- `doctor` reads the tags only in its interactive online report, never in the session-start hook — because the hook
  runs on every session and must not wait on the network.

## Ask me before
- Nothing in this build is his beyond his words S1 to S3. Applying it to his machine (the first real clone in his
  home) is his, asked through the lead once the pull request is ready; each adopt or adapt a read proposes reaches
  him as a recorded question through the lead.

## Depth pass
- 1. Method: upstream tracking as a maintainer of a downstream fork does it without merging (the Debian or Fedora
  watch-file habit, `uscan`: a pinned source, the new upstream release named, a reading per change with a decision,
  nothing taken without review). The smallest change that meets it: the design already written in section 5, one
  pure module beside its command as `host-watch` is built, one manifest record the uninstall already knows how to
  carry, and one doctor row. The search of `rule:reuse-first`: codegraph and `ls bin` find `host-watch` (the same
  shape for Claude Desktop: a draft with one row an entry, unmatched entries listed by hand,
  `bin/lib/host-watch.mjs:18`), `recordOptionalFile` and `recordStackRow` (`bin/lib/manifest.mjs:775`, `:873`),
  neither of which holds a folder; the old install watch `bin/lib/gentle-ai-update.mjs` left at 8b724f3d. No command
  reads an upstream repository today.
- 2. Raw material: his words, `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 61838`, `62036`,
  `62099` (S1 to S3); the design, `docs/proposals/gentle-ai-reverse-engineering.md:458-500`; the diet's S9 row and
  pass line, `docs/proposals/harness-diet.md:802`; SPEC's row, `docs/SPEC.md:1032`; the roadmap's "Was" entry,
  `docs/ROADMAP.md:688`; `git ls-remote --tags https://github.com/Gentleman-Programming/gentle-ai.git` today: 408
  refs, newest stable v4.3.1; a bare clone in a scratch folder: 10 s and 98.8 MB; its
  `git diff --numstat --no-renames v4.2.0 v4.3.1`: 584 paths, of which section 5's table leaves 44 unmatched.
- 3. The bar: excellent here means no changed path is dropped, a reader gets each release's changes already
  grouped by what they could change in the harness, the doctor counts what is owed without a session judging it,
  and nothing is left on his machine that `uninstall machine` does not remove.
  spec 4: `node --test bin/lib/idea-watch.test.mjs`: none, new behaviour.
  spec 5: `node --test bin/lib/idea-watch.test.mjs`: none, new behaviour.
  spec 6: `node --test bin/lib/manifest.test.mjs`: 0 tests name a clone today.
  spec 7: `node --test bin/doctor.test.mjs`: none, new behaviour (no `idea-watch` row).
  spec 8: `node --test bin/idea-watch.test.mjs`: none, new behaviour.
- 4. Refutation: if section 5's table were too coarse to be worth a draft, the real v4.2.0 → v4.3.1 diff would land
  mostly unmatched or mostly in one row. Bucketed by hand from its numstat: 274 paths in `internal/shellinstaller`
  and 105 in `e2e` (ignore), 49 in `internal/tui`, 46 in `internal/cli`, the rest spread over eight rows; 44 match
  no row (`internal/agents`, `internal/app`, `internal/model`, `internal/system`, `scripts`, `.github` and four
  more), each classified below and given its row, as the design asks. If there were nothing to read, every release
  since the review would already be read: v4.3.1 is the newest stable tag and section 13 read it
  (`docs/proposals/gentle-ai-reverse-engineering.md:751`), so the watch starts at zero owed and its first real read
  is the next release.
  Verdict: supports
- 5. Request: build section 5 as written, with the rows the real diff earned: `idea-watch draft` fetches the clone
  (recorded first) and prints a release's section, every changed path in its area and the unmatched ones by hand,
  an `ignore`-only release as one line; `idea-watch status` and a `doctor` row count the releases not yet read
  against the record, seeded with v4.3.1; `uninstall machine` removes the clone. Nothing installs or runs gentle-ai,
  and nothing is adopted without his yes. The rows the 44 unmatched paths earned are the design's own rule applied,
  not an addition.
  Adds: none

## Specs
- S1 (his line 61838, 2026-11-04T01:54:51Z): "igual quiero que como no vamos a tener instalado gentle-ai y cada
  cierto tiempo se actualiza, la idea es poder ver lo archivos del repositorio y como nosotros somos una especie de
  copia ver que de lo que añade o quita nos sirve para optimizar"
- S2 (his line 62036, 2026-11-04T02:03:32Z): "si pero recuerda que vamos a desintalar completamente gentle-ai de
  todas partes por que solo va a a quedar unicamente nuestros arnes y debe tener todas las funcionalidades"
- S3 (his line 62099, 2026-11-04T02:06:41Z): "Recuerda que no es copiarla lo de gentle-ai, para eso se hizo una
  revision completa y profunda de como ibamos a cuadrar y a utilizar el arnes completo"
- S4 (section 5, step 1): the source diff by area, `git diff --numstat v<last read> v<new>` bucketed by an `AREAS`
  table; "Unmatched paths are never dropped".
- S5 (section 5, steps 2 and 3): a verdict per change, adopt-into-ours, adapt or ignore, each with its evidence; a
  release with any verdict other than `ignore` gets its own section in `odd/tasks/gentle-ai-update-check.md`;
  releases with only `ignore` are one line each.
- S6 (section 5, step 1): the clone at `~/.js-harness/upstream/gentle-ai`, fetch only, "recorded in the machine
  manifest so `uninstall machine` removes it; never built or run".
- S7 (section 5, "Where it lives"): the newest stable tag by `git ls-remote --tags`, the last one read from the
  record, and the `doctor` row says "N releases not yet read".
- S8 (the diet's S9 row): the probe "a fixture diff with one path per area and one unmatched"; the pass "each path
  in its area; the unmatched one listed for hand classification; an `ignore`-only release adds one batched line".

## Tasks
- [ ] T1 (S4, S5, S8, kind: build): `bin/lib/idea-watch.mjs`: `AREAS`, `areaOf`, the numstat parser, the buckets,
  the stable versions of `ls-remote`, the last version read from the record and the draft. Route: inline.
- [ ] T2 (S6, kind: build): the machine manifest's `clones` record; `uninstall` removes a recorded clone inside
  `~/.js-harness` and keeps the record when it cannot. Route: inline.
- [ ] T3 (S6, S7, kind: build): `bin/idea-watch.mjs`, `status` and `draft`; the command list; the absence list.
  Route: inline.
- [ ] T4 (S7, kind: build): the `idea-watch` row of `doctor`. Route: inline.
- [ ] T5 (S5, S7, kind: docs): the record seeded with v4.3.1; SPEC's row. Route: inline.
- [ ] T6 (S6, kind: verify): the probe in a `mktemp -d` home. Route: inline.

## Areas the real diff earned
The 44 paths of v4.2.0 → v4.3.1 that section 5's table leaves unmatched, read by folder name and listing at v4.3.1:
- `internal/agents/claude/**`, `internal/agents/capabilitymanifest/**`, `internal/agents/*.go`: how gentle-ai adapts
  Claude Code, the one host we serve: a row `hosts`; every other `internal/agents/<host>/**` is ignore.
- `internal/model/**` (model assignment, presets, `claude_model.go`): a row `models`, against our presets (G14) and
  routing (S7).
- `internal/components/communitytool/**` (its codegraph contract and guidance) and `internal/assets/engram/**`: the
  complements row.
- `internal/app/**` (self-update, upgrade, help), `internal/catalog/**`, `internal/system/**` (dependency detection,
  paths, PowerShell), `scripts/**` (install.ps1, release preflights), `.github/**`: the install row, as install,
  update and release ideas.
- `internal/assets/gga/**`, `internal/copilotconfig/**`, `internal/testsupport/**`, `go.mod`, `go.sum`,
  `.gitignore`, `.deadcode-baseline.txt`: ignore.

## Log
- L1. 2026-11-03, his request, line 61838 (S1), then lines 62036 and 62099 (S2, S3); the lead's brief to JH 138
  (`C:\Users\Oficina\.js-harness\background\briefs\2026-11-04T02-11-47-437Z-ec70b4e5.md`).
- L2. 2026-11-03, design. `bin/lib/gentle-ai-update.mjs`, which the brief names, is gone since 8b724f3d (S11), so the
  watch is new code in the shape of `host-watch`, not a rewrite. The clone is bare (no working tree, so nothing in it
  can run); a folder has no bytes to hash, so it gets its own manifest array, `clones`, rather than `optional`. A
  draft section whose verdicts are still `?`, or whose hand list is not empty, does not count as read, so no
  separate `check` command is needed for `doctor`'s count.

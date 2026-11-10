Audit triage, work unit 5: state written in place (closes M10 and M33 of the Fable 5.2 audit).
Branch: worktree-audit-u5-atomic-state, from origin/main 6ee974dd. Session JH (background, brief of 2026-11-10T06:36Z).
Sources: the triage, `origin/docs/audit-triage:docs/proposals/2026-11-10-audit-triage.md` ("### 5. State written in
place", rows M10 and M33); the audit, `origin/claude/fable-5-2-audit-531f8e:docs/audits/2026-11-09-fable-5-2-audit.md`
(M10 at its line 191, M33 at its line 282). Neither is on main; both were checked at the source (Depth pass, item 2).

## Goal
A torn or corrupt `doctor.json` can no longer turn a pending host or stack update into "reviewed", and neither
`doctor.json`, the reviewed record nor `~/.claude/settings.json` is ever left half written by js-harness.

## Why
`doctor.json` is a cache that also holds the only record of which host and stack versions were reviewed. It is written
in place, a parse error reads as an empty cache, and an empty record is "the first reading", recorded as reviewed: the
update gap that should stop a measurement on an unplanned version is erased without anyone seeing it. The user's
Claude settings are rewritten in place too, so a write that fails after the truncate leaves his settings broken. The
engram hook writer, the manifests and the Rules block already write by a temporary file and a rename.

## Done when
- `node --test bin/lib/cache.test.mjs bin/doctor.test.mjs bin/lib/manifest.test.mjs bin/lib/user-settings.test.mjs` exits 0
- `node --test bin/doctor-hook.test.mjs bin/lib/permissions.test.mjs bin/lib/rules-block.test.mjs workshop/bin/host-watch.test.mjs bin/js-harness.test.mjs` exits 0
- `npm run check` exits 0
- a corrupt `doctor.json` with no record records nothing as reviewed, on that run and on the next one after the cache
  is rewritten clean (a test in `bin/doctor.test.mjs`)
- an old `doctor.json` that holds `host` and `stack` reviewed records is read into the record without loss (a test in
  `bin/lib/cache.test.mjs`)

## In scope / Out of scope
- In: `bin/lib/cache.mjs`, `bin/lib/atomic-write.mjs`, `bin/lib/rules-block.mjs` (its whole-file writer moves to
  `atomic-write.mjs`, unchanged), `bin/lib/user-settings.mjs`, `bin/lib/permissions.mjs`, the two in-place writes of
  `bin/lib/manifest.mjs` and its uninstall of the cache, `bin/doctor.mjs`, the reviewed-record reader of
  `workshop/bin/host-watch.mjs`, the settings write of `bin/lib/stack-backup.mjs` (L6), `docs/SPEC.md`, `docs/RECORDS.md`, `docs/workshop.md`, their tests, a new `bin/lib/user-settings.test.mjs`, this document.
- Out: the heartbeat's ticks and the project's `.claude/settings.json` hook entry (JH 166 works there); the other
  in-place writers the audit did not name (the Codex config, the components): not this unit's; lost updates between
  two writers that both read before either writes (a lock is a larger change, see Depth pass item 1).

## Constraints
- An old `doctor.json` is read without loss — because a machine that ran an earlier version holds its only record of
  what was reviewed there.
- Tests use scratch homes only — because his real `~/.claude/settings.json`, `~/.codex` and credentials are his.
- A write that fails leaves the bytes that were there before — because that is the point of the change.
- `bin/lib/manifest.mjs` does not grow — because it is over its 1,000-line ceiling (`bin/conventions-structure.test.mjs`).

## Ask me before
Nothing of this unit is his: the triage gives it to the lead. A decision that turns out to be his goes to the lead
through `js-harness notify --to orchestrator --kind question`.

## Depth pass
- 1. Method: the discipline is crash-consistent persistence of small files (write a fresh temporary sibling, then one
  rename over the target, the POSIX and NTFS atomic replace) and the separation of a cache, which may be dropped, from
  a record, which must not. Its standard: a reader sees the old bytes or the new ones, never a mix; a record that
  cannot be read is "unknown", never "empty"; a format change reads the old format. The smallest change that meets it
  reuses what the repository has: `writeManifestAtomic` (`bin/lib/atomic-write.mjs:41`) for JSON records and the Rules
  block's `writeWhole` and `realPlace` (`bin/lib/rules-block.mjs:83`, `:121`), which already keep a linked file a
  link and a private file private, for a text file of the user's. A lock between two writers is out: the race left is
  a lost update between two read-modify-write cycles, never a torn file, and the record is read again just before it
  is written to keep that window small.
- 2. Raw material:
  `bin/lib/cache.mjs:75-80` writes `doctor.json` with `fs.writeFileSync`; `:36-39` reads a parse error as
  `emptyCache()`; `bin/doctor.mjs:243-245` and `:253-255` pass `cache.stack?.reviewed ?? null` and
  `cache.host?.reviewed ?? null` to the rows; `bin/lib/stack-update.mjs:31` and `bin/lib/host-update.mjs:219` record
  the versions read as reviewed when that is `null`; `bin/lib/manifest.mjs:1227` removes the cache on `uninstall
  machine`. `bin/lib/manifest.mjs:547` (`appendEntryToFile`) and `:615` (`removeEntryFromFile`),
  `bin/lib/user-settings.mjs:66`, `:75`, `:116`, and `bin/lib/permissions.mjs:97`, `:101`, `:158` write
  `~/.claude/settings.json` with `fs.writeFileSync`; `bin/lib/engram-prompt-hook.mjs:35` and
  `bin/lib/rules-block.mjs:83-101` write by rename. Readers of the record: `bin/doctor.mjs:481`, `:507`,
  `workshop/bin/host-watch.mjs:259`, `:305`.
- 3. The bar:
  spec 1: `node --test bin/lib/cache.test.mjs`: none, new behaviour (`writeCache` writes in place today)
  spec 2: `node --test bin/doctor.test.mjs bin/doctor-hook.test.mjs workshop/bin/host-watch.test.mjs`: none, new behaviour (the record is the cache's `host` and `stack` keys today)
  spec 3: `node --test bin/lib/cache.test.mjs`: none, new behaviour (no record file to migrate into)
  spec 4: `node --test bin/doctor.test.mjs`: fails today, by the refutation below (a torn cache records the update as reviewed)
  spec 5: `node --test bin/lib/user-settings.test.mjs bin/lib/manifest.test.mjs bin/lib/permissions.test.mjs`: fails today, by the refutation below (a failed write leaves `{\n  "`)
  spec 6: `node --test bin/lib/manifest.test.mjs`: none, new behaviour (no record file to remove)
- 4. Refutation: a scratch home whose `doctor.json` held a reviewed host record (Desktop 1.0.0) and stack record
  (engram 1.0.0), read with Desktop 1.1.0 and engram 1.1.0, then torn to half its bytes; and a scratch
  `settings.json` written through a writer that writes five bytes and throws `ENOSPC` (the in-place write's truncate
  then a failure). `node <job tmp>/refute/m10.mjs <worktree>` printed before the tear host `stale` and stack `stale`;
  after it host `ok` with `{"desktop":"1.1.0","code":"2.0.0",...}` recorded and stack `ok` with
  `{"versions":{"engram":"1.1.0"},...}` recorded; the settings call returned `skipped` and left `{\n  "` in the file.
  2 of 2 findings reproduce.
  Verdict: supports
- 5. Request: write `doctor.json`, the reviewed record and every write of js-harness to `~/.claude/settings.json` by a
  fresh temporary file and one rename, keeping a linked settings file a link and its mode; keep the reviewed host and
  stack versions in their own record, `~/.js-harness/reviewed.json`, where a key that cannot be read is "unknown" and
  records nothing until `doctor --host-reviewed` or `--stack-reviewed` records it; read an old `doctor.json`'s records
  into it once, without loss, and a corrupt one as unknown; remove the record with the cache on `uninstall machine`.
  Adds: none

## Specs
1. "write `doctor.json` ... by a temporary file and a rename": `writeCache` writes through `writeManifestAtomic`; a
   write that fails leaves the cache there before.
2. "keep the reviewed versions of host and stack in a record": `~/.js-harness/reviewed.json`, `{ host?: { reviewed }
   | null, stack?: { reviewed } | null }`, a key absent being never recorded and `null` unknown; `doctor`'s rows, its
   `--host-reviewed` and `--stack-reviewed` and `host-watch` read and write it; `doctor` writes no review to the cache.
3. "an old `doctor.json` still read without loss" (the brief): with no record, a `doctor.json` that parses gives the
   record its `host` and `stack` (a malformed one is unknown), and the record is written then, before any later cache
   write could lose them; the cache keeps those keys as they were.
4. "a torn cache cannot turn a pending update into 'reviewed'", "a corrupt `doctor.json` records nothing as reviewed":
   a corrupt `doctor.json` with no record, or a corrupt record, makes both keys unknown; an unknown key's row is a gap
   that names the record and the flag, records nothing, and stays so on the next run; the flag records it.
5. "write ... `~/.claude/settings.json` by a temporary file and a rename, as the engram hook writer beside them does":
   `appendEntryToFile`, `removeEntryFromFile`, `acceptSessionMessages` and its put-back, `restoreSettings`, and the
   permissions' hold, put-back and release write through the Rules block's whole-file writer, moved to
   `atomic-write.mjs`; a write that fails leaves the file as it was.
6. The record is js-harness's and goes with the cache: `uninstall machine` removes it.

## Tasks
- [x] T1 (kind: build) S5: settings writes by rename (atomic-write, manifest, user-settings, permissions, rules-block), tests first; commit 0b8b7c25; Codex: correct (0.94), lenses risk, resilience, reliability: 0 findings
- [x] T2 (kind: build) S1-S4, S6: the reviewed record and the cache by rename (cache, doctor, host-watch, manifest uninstall), tests first; commit `fix(doctor): ...`
- [ ] T3 (kind: verify) Codex and the lenses on each slice; an independent verifier on the whole change (high risk 1 and 4)

## Log
- L1 (2026-11-10, the lead's brief): "Yours: exactly what the unit lists and its "Done when". It is high risk, items 1
  and 4: a persisted format moves from a cache to a record, and two writers meet. So: the depth pass and a feature
  document with its contract first, tests first and red before the fix, an old `doctor.json` still read without loss,
  and an independent verifier, as the unit says." The unit: "write `doctor.json` and `~/.claude/settings.json` by a
  temporary file and a rename, as the engram hook writer beside them does; keep the reviewed versions of host and
  stack in a record, so that a torn cache cannot turn a pending update into "reviewed"."
- L2 (2026-11-10, decision of this session): the permissions writer (`bin/lib/permissions.mjs`) is in, though the
  audit names only `manifest.mjs` and `user-settings.mjs`: it writes the same `~/.claude/settings.json`, so leaving it
  would leave the finding open.
- L3 (2026-11-10, decision of this session): a record key that cannot be read is recorded `null` and stays unknown
  until a flag records it, rather than refusing to write: a corrupt cache would otherwise be rewritten clean by the
  next `doctor` and its unknown would become a first reading again one run later. `--host-reviewed` on an unknown
  record has no earlier version to ask the review file about, so it records what it reads, as on a first reading.
- L4 (2026-11-10, evidence): T1's tests were red before the fix, 3 of 4 (the link test passes either way, and is
  skipped on this machine, which cannot make links): `acceptSessionMessages` returned `written` past a failed rename,
  and `install` and `uninstall` changed the settings. T2's new tests were red on the missing exports, then the doctor
  test of spec 4 found a flaw in the design itself: `doctor` writes the latest versions to the cache before the rows
  read the reviews, so a migration done at the first read came after a clean cache had already replaced the torn one,
  and the update was recorded as reviewed again. `writeCache` now reads the cache into the record before it writes,
  when there is no record yet; a cache test pins that order.
- L5 (2026-11-10, reviews of 0b8b7c2..52367d1): Codex, part 1 incorrect (0.98), part 2 correct (0.92): a failed write
  of the record during the migration let the cache write that followed erase an unknown state; `writeCache` now
  leaves an existing cache in place while the record cannot take what it holds (a cache test, red first). Lenses
  resilience and reliability, the same finding: the unknown host row said a host watch session reviews it, but a
  host watch spans an update from the version reviewed and never sees it; the row and the notice now send it to the
  lead and name `host-watch draft --from-desktop`. Risk and readability: 0 findings.
- L6 (2026-11-10, the independent verifier, Opus 5.5, on 6ee974d..52367d1): 10 findings, none a blocker. Fixed, each
  test red first where it is behaviour: (1) a migration that read a cache another process had just rewritten clean
  overwrote that process's unknown record with `{}`: the migration now makes the record by a hard link that fails
  when it exists, and reads it then; (2) the failed migration write, already fixed by L5; (3) a read that fails for a
  moment (EBUSY, EPERM) was taken as a corrupt file and written as unknown for good: it is now unknown for that read
  only, and nothing is written from it; (4) the unknown host row's words, already fixed by L5; (5) the unknown notices
  now carry the versions read, so a further update is a new notice; (6) `stack-backup's` `setKey`, a further writer of
  the settings, now writes by rename; (10) the comments that still put the reviews in the cache. Left, and why: (7) a
  hard-linked settings file is detached by the rename, as the Rules block's CLAUDE.md already is: a rename cannot keep
  a hard link, and an in-place write would bring back the torn file; (8) a rename refused while another process reads
  the file (EPERM, 2 to 8 of 200 against a reader with no pause, none with a 5 ms pause) is said as `skipped`, never
  silent; (9) while the record cannot be written the cache is not written either, so the latest versions are fetched
  each run until it can: the cost of keeping the evidence. Lost updates between two writers of the record remain, each
  one losing a review, never adding one, and narrower than before.

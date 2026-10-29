# JH 81 · Uninstall keeps a hook entry the user already had

Opening: `js-harness sessions --opening 'JH 81 · Uninstall keeps a hook entry the user already had'`. Branch
`fix/uninstall-keeps-user-hook-entry`, base main `4b1a7b71`, PR 657. Small task by the resume test (the outcome, the place and
the fix were named in the opening), so no feature document; this summary and the ROADMAP line are the record.

## Goal
When the user's host file already holds a hook entry identical to one js-harness installs, `install` must not record
it as ours, so `uninstall` leaves it. Found by JH 80's independent verifier on PR 653; it predates that PR.

## The user's words
The lead's brief, not Sebastián's: "an entry that was already present is not ours to remove. Record that fact in the
manifest, or do not record the entry at all. Reinstalls, upgrades from a manifest written before the change, and
downgrades still undo exactly. Pick the smallest shape and say why." No message from Sebastián in this session.

## Delivered
- `bin/lib/manifest.mjs`: `appendEntryToFile` says `present` whenever the entry was there before the run (also when
  older forms of it were taken out). `installEntries` records `createdEntry: false` on an entry it found present, or
  skipped, unless the earlier record of the same file, pointer and entry says install wrote it (has no
  `createdEntry: false`). `uninstall` neither removes such an entry nor moves or drops its Codex trust; `sync` never
  prunes one.
- `bin/lib/manifest.test.mjs`: six tests. The Claude and Codex cases come back byte for byte (the Codex one with its
  `config.toml` trust too); a reinstall keeps the flag; an entry install wrote stays ours; an entry a first, skipped
  install never wrote is the user's once the file reads; `sync` leaves a flagged entry the release no longer ships;
  the user's entry stays theirs when install takes an older form of ours out beside it (added after the verifier
  showed that branch untested).
- `docs/ROADMAP.md`: the S1 records fix is done as PR 630 (merged 2026-10-28), its probe run on main; one line for
  this fix under S10.
- `docs/FAILURES.md`: entry `uninstall-took-user-entry`.

## Decisions
- **Flag, not omission.** Leaving the entry out of the manifest would also have worked, with fewer lines changed in
  `uninstall`. But `doctor`'s hook probe and Codex trust row, and install's "already registered" line, read the
  records; with the entry left out, a home whose settings already carry our hooks (copied dotfiles) would show none
  of them. The flag keeps every reader as it is, and only the two removers skip it.
- **The name.** `createdEntry: false` follows `createdFile`. The first name, `preexisting`, did not fit a skipped
  record install never wrote, and that record needs the flag too.
- **A skipped run carries ownership.** It looked at no entry, so its record says what the earlier record of the same
  entry said, as `createdContainers` already does. Without that, a file that could not be read for one run turned our
  own entries into the user's: the existing test "an install that cannot read a host file keeps the record of the lists
  it made there" failed on the first version of the fix.
- **The line ceiling.** `bin/lib/manifest.mjs` sits under a ceiling of 1,793 lines (`bin/conventions-structure.test.mjs`).
  The fix is written in long lines, and three doc comments (`install`'s, `sync`'s, and the first paragraph of `uninstall`'s) were
  re-wrapped from about 100 to 120 columns, words unchanged. The file ends at its ceiling, 1,793: one line less would
  have meant lowering the ceiling in that test, outside this task's surface.
- **Upgrades:** a record from before the field has no flag and is taken as ours, as before. That record may already
  hold the user's entry, written by the old defect, and nothing can tell them apart now.
- **Downgrades:** an older release rebuilds the records on its install and drops the flag, so its uninstall takes the
  entry out again. That is the old defect, and omission would not avoid it either. Every entry of ours is still undone
  either way.
- **A lost manifest:** if the manifest is deleted and install runs again, our own entries read as the user's and
  uninstall leaves them. Leaving an entry behind is the safer mistake. The verifier showed the same for an install
  that fails after it writes the entries and before it writes the manifest (`install` in `bin/lib/manifest.mjs`):
  the next install takes our entries for the user's, and uninstall leaves live hooks of a removed tool. On base the
  same case was not exact either (entries out, empty lists left). Closing it means recording the entries before
  writing them, a change to the order of `install`; it is a follow-up for the lead.

## Evidence
- Before the fix (`bin/lib/manifest.mjs` of `4b1a7b71` put back for one run): the four tests of the user's entry
  failed; "an entry install wrote is still its own on a reinstall" and "an install that cannot read a host file keeps
  the record of the lists it made there" passed, as they must. A scratch-home probe seeded with our own Claude and
  Codex SessionStart entries left `"SessionStart": []` in both after install, install and uninstall.
- After the fix: all six pass, and the same probe prints "same bytes" for both files.
- Reviews of `4b1a7b71..57990b30`: Codex, correct (0.9; 134,522 input tokens); lenses risk, resilience and
  reliability, complete with no finding (42,650 input tokens). Independent verifier: no blocker; four findings, the
  two follow-ups below, the untested branch (test added, which fails with the verifier's mutation M7 and passes with
  the fix), and install's "already registered" line on the path that also takes older forms out, left as it is: the
  entry was already registered.

## Follow-ups
- An install that fails between writing the entries and writing the manifest strands our entries after uninstall
  (above). Recording them before writing them would close it.
- A user entry equal to an older form of ours is taken out by the stale-form cleanup (`isOlderOwnEntry`) on an
  upgrade, even once it is recorded `createdEntry: false`; base did the same. Keeping it would leave the hook running
  twice beside our new form, so it is a choice, not a plain fix.
- A skipped record does not lose its Codex trust: `entryPlaces` (`bin/lib/codex-trust.mjs:204`) already leaves
  skipped records out. Nothing to do.

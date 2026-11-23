# memory-plan-write-set

Locator: `odd/tasks/memory-plan-write-set.md` · Branch: none yet (written on `docs/plan-memory-plan-write-set`,
documents only) · Session: a docs writer of the lead, unit B4 of night plan 2 (2026-11-23) · Test runner: `node --test`

## State
A plan only, written 2026-11-23 against origin/main `0b23ff89`; no code is written. Owed first: this plan's double
review (`rule:double-review`), Claude's and Codex's, whose Codex reader is held until the weekly reset (2026-11-23
23:45, as `odd/tasks/taskstop-process-tree.md` records); nothing is built before it. None of the memory files is held
by an open pull request at `0b23ff89`; the skill sentence T4 may change is held by 950 and 954
(`bin/lib/manifest.mjs`), and the roadmap line T5 checks off by 934 and 935. Next: after the review, T1 (design),
then T2 to T5 in order, each in its own commit. Open, for T1: where the index joins a deletion (Depth pass, item 5).

## Goal
A memory pass that deletes a note, planned as the skill says (`memory plan <note>`), can be verified, and its undo
brings back the note and its index line together.

## Why
Deleting a note the index links always changes `MEMORY.md`: the deleted note's line must go, or verify refuses on a broken link
(`bin/lib/memory-hygiene.mjs:167`, `bin/lib/memory-pass.mjs:269-273`). But `memory plan` takes the names it is given
(`bin/memory.mjs:27`, `:176-179`), and the index is outside the write set unless named, so the edit is refused as
another session's (`bin/lib/memory-pass.mjs:232-235`). On 2026-11-15 a pass that deleted one note was planned with
the note alone, refused for exactly that, undone, and planned again with the index
(`~/.js-harness/memory-hygiene/D--js-harness/journal.jsonl:31-35`). The undo restored the note only: the index edit
was outside the write set, so it stayed, and the second plan snapshotted the index without the line. Its undo
would bring the note back with no line, an orphan (`bin/lib/memory-hygiene.mjs:169-170`; the probe of Depth pass
item 4), and the first snapshot, the only one of the ten kept that holds the line (`grep -c` over each
`snapshots/*/files/MEMORY.md`: 1 there, 0 in the other nine), is the ninth, evicted after nine more plans
(`bin/lib/memory-pass.mjs:191-192`). Deleting
his notes is stored data (`AGENTS.md`, high risk item 1), and the undo is what makes a deletion safe.

## Done when
- `node --test bin/lib/memory-pass.test.mjs` exits 0
- `node --test bin/memory.test.mjs` exits 0
- `node --test bin/lib/manifest.test.mjs` exits 0
- `npm run check` exits 0
- in a scratch folder under `mktemp -d`, a pass that deletes a note planned as the skill says ends verified, and its
  undo leaves the note and its index line back and `memory status` naming no orphan and no broken link
- `docs/ROADMAP.md:947` is checked off, naming T2's test

## In scope / Out of scope
- In: `bin/lib/memory-pass.mjs` (`planPass` or `verifyPass`, as T1 chooses) and `bin/lib/memory-pass.test.mjs`;
  `bin/memory.mjs` and `bin/memory.test.mjs` only if T1 changes what `memory plan` prints or refuses; the skill
  sentence of `bin/lib/manifest.mjs:78-79` and its test `bin/lib/manifest.test.mjs:4411-4420` only if T1's choice
  changes what a session names; the line `docs/ROADMAP.md:947`.
- Out: the real memory folder and state folder: no command of this feature runs against them, because an eleventh
  plan evicts the oldest of the ten kept snapshots (`bin/lib/memory-pass.mjs:191-192`) and every plan takes the
  project's lock. Repairing the 2026-11-15 pass's index: its note is gone by an approved deletion, and the line is
  only needed if that pass is undone, which is the owner's call. An undo that also reverses edits outside its write
  set: another session's write is left alone by design (`bin/lib/memory-pass.mjs:4`,
  `odd/tasks/memory-hygiene.md:239-242`), and once the index is in a deletion's write set the case of 2026-11-15
  cannot arise. The journal and manifest formats (`docs/RECORDS.md:1144`, `:1153`): a write set that holds
  `MEMORY.md` already has their shape.

## Constraints
- High risk, item 1 of `AGENTS.md` (deleting stored data, and the undo that restores it): the risk lens runs on each
  build slice, and an independent verifier runs last on the range that ends at the head that ships.
- Tests run only through `planPass`, `verifyPass` and `undoPass` with `folder` and `stateDir` under a temporary
  folder, as `bin/lib/memory-pass.test.mjs` does — because the CLI against the real home would take his lock and
  evict a snapshot.
- Another session's write to the index during a pass stays visible — because the index is the file sessions write
  most, and a write set that holds it skips its changed-outside check (`bin/lib/memory-pass.mjs:232-235`); T1 says
  what each option costs here.
- No Codex run before the reset and no paid run (the lead's standing constraint, as
  `odd/tasks/document-sensors-conventions.md:56` records).

## Ask me before
Nothing expected. A design that would let a pass change the index without the snapshot holding what undo needs stops
the task and goes to the lead.

## Depth pass
- 1. Method: the write set of an undoable change is the closure of what the change touches, not what the caller
  names; the standard is a transaction that records every file it writes before it writes. The repository already
  meets it for files it knows a pass writes (`bin/lib/memory-pass.mjs:158-194`, the snapshot of the whole folder and
  the recorded write set). The smallest change that meets it: one rule at plan or verify time that ties a named
  note to its index line.
- 2. Raw material:
  - `docs/ROADMAP.md:947`: "The memory plan leaves MEMORY.md out of a deletion's write set. Owner: the next memory
    session (2026-11-15, the lead)", added by d60fc705 (the lead's notices to JH 209, 2026-11-15 14:40 and 14:43).
  - `~/.js-harness/memory-hygiene/D--js-harness/journal.jsonl:31-35`: plan `20261115T182624574Z` with one note as its
    write set; `verify-refused` with "MEMORY.md changed outside the write set during the pass (another session
    wrote it?)"; `undo` restoring the note only; plan `20261115T182646073Z` naming the note and `MEMORY.md`;
    `verify` without the note. The snapshot of the first holds the note's index line and the second's does not
    (`grep -c` over each `snapshots/<stamp>/files/MEMORY.md`: 1 and 0).
  - `bin/memory.mjs:27` (`plan` takes one or more names and no flag) and `:176-179` (the names go to `planPass` as
    they are), so the command cannot tell a deletion from an edit.
  - `bin/lib/memory-pass.mjs:14` (`INDEX`), `:159` (each name must be a note), `:186-188` (the snapshot and the
    manifest's write set), `:232-235` (a file outside the write set that changed is refused), `:239-243` (a deletion
    needs `--approved`), `:256-267` (the index line's numbers and code spans, checked only when the index is in the
    set), `:355-384` (undo touches only the write set; `:369-380` the line-wise index merge).
  - `bin/lib/memory-hygiene.mjs:167` (a broken link is due) and `:169-170` (an orphan note is due), both reasons the
    pass owns (`bin/lib/memory-pass.mjs:16`).
  - `bin/lib/manifest.mjs:78-79`: the skill says `memory plan <note>...` "names every file the pass may change,
    create or delete", and `:81` tells the session it may "drop a line whose file is gone" alone.
  - `bin/lib/memory-pass.test.mjs:98-106`: the deletion test names `MEMORY.md` in the write set; `:108-115` the
    outside-the-set refusal; `:165` "undo puts back a note the pass deleted", with the index in the set.
  - `odd/tasks/memory-hygiene.md:228-231` (D4.1: the write set is "the files the pass may change, create or
    delete"), `:239-242` (D4.4: undo restores only the write set, "a deleted note restored"), `:384-387` (Reader A
    of 2026-10-15 on the index undo and the write set). That feature is closed, every task checked, so this is a new
    document rather than an amendment.
  - Reuse-first search: `grep -rln -i "write set" odd/tasks docs/ROADMAP.md` finds only `memory-hygiene.md` and the
    roadmap line; no open task holds the fix.
- 3. The bar:
  spec 1: `node --test bin/lib/memory-pass.test.mjs`: 38 of 38 pass at `0b23ff89` (run 2026-11-23); its three
  deletions (`fs.rmSync` at `:77`, `:101`, `:169`) all plan `MEMORY.md` with the note, so none is planned with the
  note alone
  spec 2: `node --test --test-name-pattern="undo of a deletion" bin/lib/memory-pass.test.mjs`: none, new behaviour
  (no test undoes a deletion whose plan left the index out)
- 4. Refutation: the request would not hold if a note-only plan could carry a deletion to verified, or if its undo
  brought the line back. Run 2026-11-23 with a scratch script that imports `bin/lib/memory-pass.mjs` and calls
  `planPass`, `verifyPass` and `undoPass` on a two-note folder under `mktemp -d` (removed after):
  - Note-only set, note deleted, index untouched: refused, "still due: broken-link a.md (line 1)".
  - Same set, the line dropped: refused, "MEMORY.md changed outside the write set during the pass".
  - Undo of that refusal: restores `a.md` only; the index stays without its line. A new plan naming both snapshots
    that index, verifies after the deletion, and its undo brings `a.md` back with no line: an orphan. This
    reproduces the journal of 2026-11-15 line for line.
  Verdict: supports
- 5. Request: make a pass that deletes a note, planned as the skill says, verifiable and undoable whole: T1 chooses
  between `planPass` adding `MEMORY.md` to the write set whenever the set names a note the index links; `planPass`
  refusing such a set without it, with a message that names it; or `verifyPass` accepting, outside the set, only the
  removal of the deleted note's own line, with undo restoring that line from the snapshot. The first two cost the
  index's changed-outside check for that pass (`bin/lib/memory-pass.mjs:232-235`); the third keeps it and costs code
  in undo. Its undo brings back the note and its line together (spec 2, from D4.4).
  Adds: none

## Specs
1. The roadmap, as written (`docs/ROADMAP.md:947`): "The memory plan leaves MEMORY.md out of a deletion's write set."
   Read as a defect to fix (Log, L3).
2. The undo's own design, as written (`odd/tasks/memory-hygiene.md:239-240`): "`memory undo <stamp>` restores only the
   write set: a note byte for byte when its hash is the recorded after-hash, a created note removed, a deleted note
   restored". A deleted note comes back with its index line, so `memory status` names no orphan after the undo.

## Tasks
- [ ] T1 (kind: design) specs 1 and 2: weigh the three options of item 5 against the concurrency cost (a line another session adds to the index during a pass, and what verify and undo do with it under each), the skill's wording at `bin/lib/manifest.mjs:78-79`, and every `plan` entry of the journal whose write set lacks `MEMORY.md` while its `verify` lists fewer notes; write the choice in the Log; route: inline; commit: docs(memory-plan-write-set): choose where the index joins a deletion
- [ ] T2 (kind: build) spec 1: test first in `bin/lib/memory-pass.test.mjs`, "a pass that deletes a note, planned with the note alone, verifies once its index line is gone" (or is refused at plan naming `MEMORY.md`, if T1 picks that), then the change in `bin/lib/memory-pass.mjs`; route: inline, risk lens; commit: fix(memory): a deletion's write set holds its index line
- [ ] T3 (kind: build) spec 2: test first, "undo of a deletion planned with the note alone brings back the note and its index line", with `hygieneState` naming no orphan after it; route: inline, risk lens; commit: test(memory): undo of a deletion restores its index line
- [ ] T4 (kind: docs) spec 1: if T1's choice changes what a session names, the skill sentence of `bin/lib/manifest.mjs:78-79` and its assertion, after 950 and 954 land; else nothing; route: inline; commit: docs(skills): name what a deletion's plan holds
- [ ] T5 (kind: verify) specs 1 and 2: Done when, the scratch-folder replay of 2026-11-15, Codex and the lenses on the range, the independent verifier on the range ending at the head, and `docs/ROADMAP.md:947` checked off after 934 and 935 land; route: Codex and a verifier sub-agent; commit: docs(roadmap): the memory plan holds a deletion's index

## Log
- L1 (2026-11-23): no owner quote was found for this unit. Search: `docs/ROADMAP.md:947` and the body of d60fc705,
  which added it (the lead's notices, no words of his); `grep -n -i "sebasti\|his words\|he asked\|he said"` and
  `«` and `“` over the roadmap's lines `:940-948` around it (0 hits); `grep -n -i "write set"` over
  `odd/tasks/memory-hygiene.md` (six lines, `:37`, `:230`, `:234`, `:239`, `:386`, `:437`, none a quotation of his:
  his order at `:18-21` asks for the hygiene protocol, and his answer at `:432-433` approves the deletions of
  2026-10-15, neither the write set). The night plan's search covered the four failures of lane B, which this unit does not serve, so it
  does not cover it. The lead's brief names his line 16936, "avanza el harness y las tareas pendientes solo", as the
  cover for the night's work; it was not checked here with `js-harness sessions --quote`, so it is not a spec. The
  words above are the lead's and the code's.
- L2 (2026-11-23): the lead's brief to this writer: unit B4 of night plan 2, a plan only, the contract first, the
  depth pass cited by path:line, marked as a plan whose double review is owed before any build.
- L3 (2026-11-23): the roadmap line is read as a defect, not as a wish to keep the index out: the journal of
  2026-11-15 (`journal.jsonl:31-35`) shows the pass refused for it and planned again with the index, and the probe
  of item 4 reproduces the refusal and the orphan an undo would leave.
- L4 (2026-11-23): the fix is left to T1 rather than settled here, because each option trades the index's
  changed-outside check against code in undo, and that cost is measured, not guessed (Constraints).
- L5 (2026-11-23): holders read with `gh pr list --state open --limit 300 --json number,files` at `0b23ff89`, 56 open
  pull requests: `bin/memory.mjs`, `bin/lib/memory-pass.mjs` and their tests are held by none; `bin/lib/manifest.mjs`
  by 950 and 954; `docs/RECORDS.md` by 940, 950, 955 and 990, which this feature does not change. No note name, index
  line or note text of his memory is copied here: the journal is cited by stamp and line.

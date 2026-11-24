# The lead's relief file, bounded

Locator: `odd/tasks/relief-bounded.md` · Branch: `claude/jh292-relief-bounded` · Session: JH 292 (second unit)
Delivery: this document alone, a draft docs pull request; the build is later work · Test runner: `node --test`

## State
Written 2026-11-22, JH 292, at `faf93e28`. Design only: no code, and the lead's relief file is read, never written.
- Done: the measure, the readers and writers at `faf93e28`, the answer to L4's five objections, the tasks.
- Next: the double review of this document (Claude and Codex readers; Codex is held at its 70% stop until
  2026-11-23 23:45), then the lead's approval and his answers to "Ask me before"; no build before both.
- Open: the head's bound, where the charter lives, and the first cut of the live file (all three his).

## Goal
The lead's relief file stays a file the lead can read at once, and nothing in it is lost, reordered, or cut off from
a reader.

## Why
The lead starts and resumes from its relief file (`bin/resume.mjs:299`, `RELIEF_READ` at `:441`: "Read its last lines
before anything else"). It is 2,215,251 bytes today, over the Read tool's 256 KB cap, and grows by 35 to 54 KB a day.
The diet asks for "a current-state head of 20 KB or less, never the 1.32 MB relief file"
(`docs/proposals/harness-diet.md:457-458`). Splitting it by month was refuted on 2026-11-11 (L4 of
`odd/tasks/f8-s6-read-surface.md`, lines 194-202), and he took it out of S6 for a design reviewed first (question 268).

## Done when
- `js-harness contract check odd/tasks/relief-bounded.md` exits 0 (this document)
- the build's tasks below each exit 0 on their named test, readers landed and installed before the writer runs
- `js-harness relief untrim` gives back, byte for byte, the file a `relief trim` started from, by its recorded sha256
- an independent verifier passes the build before the first cut of the live file

## In scope / Out of scope
- In: this document. Later, for the build: `bin/lib/channel.mjs`, `bin/lib/board-files.mjs`, `bin/resume.mjs`,
  `bin/lib/measures.mjs`, `bin/merge-queue.mjs`, `bin/lib/rules-change-run.mjs`, a new `relief` verb and its tests.
- Out: `C:\Users\Oficina\.js-harness\relief\D--js-harness.md`, which no step of this document writes; `docs/ROADMAP.md`
  (its Later row stays until the build lands); `bin/guard.mjs`.

## Constraints
- The live path never changes: every reader and every installed copy, old or new, opens
  `~/.js-harness/relief/<slug>.md` — because L4's first objection is an old copy that reads only that path.
- File order is the order: 26 of the 3,098 dated lines are stamped earlier than the dated line above them, and 468 of the
  lines since 2026-11-15 are written by hand with a typed hour — so no reader merges or sorts by time.
- `notify --relief`, `rules change` and the land append while the lead works — so the cut is safe against an append that
  lands during it.

## Ask me before
- The head's bound. The diet's 20 KB holds under half a day at today's pace (35 KB a day over November 1-21, 54 KB a day
  over its last 12 days). Proposed: the trim keeps the lines from the start of the previous local day, at most 256 KB,
  so the lead reads a day and a half of its own notes at once. A tighter number is a new threshold, which is his.
- Where the charter lives. `bin/lib/manifest.mjs:128` puts "at its head, the charter of what the lead does alone" in the
  relief file; it is lines 1 to about 20 today, and a cut moves them to the archive. Proposed: the trim's own line
  names where the charter now is (archive file and line), and the lead copies it into a `## Charter` it keeps at the
  top of the head; the alternative is a charter file of its own, which changes that instruction's text.
- The first cut of the live file (stored data, high risk), after the verifier passes.

## Depth pass
- 1. Method: log rotation as `logrotate` does it, held to what this file needs: the live path stays, the rotated part
  is a byte-exact prefix in order, and the undo is a command proven by a checksum, not a shell recipe. The smallest
  change that meets it: one shared reader of "archive then head", one cut command, one undo command.
- 2. Raw material, at `faf93e28`:
  - The file today, read and not written: 2,215,251 bytes, 3,716 lines, 44 days (2026-10-09 to 2026-11-21), the
    longest line 9,450 characters; 593 lines do not open with a date (headings, continuations); 1,028 lines carry
    `local (notify).`, 26 are `## ` headings; 192 lines cite "relief line N"; November 1-21 is 728,573 bytes. On
    2026-11-11 it was 1,720,531 bytes and 2,580 lines (`odd/tasks/f8-s6-read-surface.md:87`).
  - Writers: `bin/lib/channel.mjs:476` (`appendRelief`, through `appendLine` at `:308`), called by `bin/notify.mjs`
    (`--relief`), `bin/lib/rules-change-run.mjs:449` and `bin/merge-queue.mjs:509`; and the lead by hand (468 lines
    since 2026-11-15 with no command stamp).
  - Readers: `bin/lib/board-files.mjs:9-27` (`reliefTail`, the board's last 5 lines and the count; blank lines
    dropped), called from `bin/sessions.mjs:512` and `:666` (`--relief`); `bin/resume.mjs:299` (count and age) and
    `:441`; `bin/lib/measures.mjs:57-96` (`reliefSpan`, lines stamped inside a compaction's span);
    `bin/merge-queue.mjs:403-426` (the proposal a land confirms, "confirms relief line N" by line number, newest
    first) and `:431` (`stampOf`); `bin/lib/rules-change-run.mjs:83` (`lastLineFor`, "supersedes relief line N",
    blank lines counted). The text that names the file: `bin/lib/manifest.mjs:128`, `bin/lib/pause.mjs:305`,
    `bin/loop.mjs:392`.
  - His words: question 268 and its answer (transcript `812b728f`, line 2517); `docs/ROADMAP.md:947-950`; the lead's
    brief quoting transcript `0cdab702` line 11291.
- 3. The bar:
  spec 1: `node --test bin/lib/channel.test.mjs`: none, new behaviour; today no reader knows an archive.
  spec 2: `node --test bin/lib/board-files.test.mjs bin/resume.test.mjs bin/lib/measures.test.mjs`: none, new behaviour.
  spec 3: `node --test bin/merge-queue.test.mjs bin/lib/rules-change-run.test.mjs`: none, new behaviour; today a line
  number is a line of the one file.
  spec 4: `node --test bin/relief.test.mjs`: none, new command.
  spec 5: the verifier's report: none yet.
- 4. Refutation, L4's five objections, each answered with the test that holds it:
  1. An installed copy from before the change reads the old path alone. The path does not change, so an old copy reads
     the head and misses only the archive; `relief trim` refuses while the `js-harness` on PATH is older than the
     release that carries the readers (`bin/relief.test.mjs`, "an older installed copy refuses the cut").
  2. A merged read is not ordered by time. Nothing is merged: the archive is a byte-exact prefix, and every reader reads
     "archive files in order, then the head", which is the old file's order (`bin/lib/channel.test.mjs`,
     "archive then head equals the file before the cut").
  3. The shell undo is not exact. The undo is `js-harness relief untrim`, in Node: it rebuilds the file and refuses
     unless its sha256 equals the one recorded before the cut, or that file plus the lines appended since
     (`bin/relief.test.mjs`, "untrim gives back the file byte for byte").
  4. A month is not a 20 KB head. The cut is by size and day, not by month; the bound is his (Ask me before).
  5. Lines must be cited stably. A line number becomes the global one: its place in "archive then head", which is the
     old file's own number, so the 192 lines that cite "relief line N" keep pointing where they did; new citations add
     the line's stamp (`bin/merge-queue.test.mjs`, `bin/lib/rules-change-run.test.mjs`, "a line in the archive
     keeps its number").
  Further test, run now: whether the cut can fall on a clean line. 3,098 of the 3,716 lines open with a date, so a
  cut before a dated line is always near and keeps a continuation line with the line above it.
  Verdict: supports
- 5. Request: keep the relief file at its path as the head. Add `js-harness relief trim`, which moves a byte-exact
  prefix that ends before a dated line into `~/.js-harness/relief/<slug>/archive-<n>.md`, records the cut in
  `~/.js-harness/relief/<slug>/trims.jsonl` (time, sha256 and size before, bytes and lines moved, the archive file),
  and writes one stamped line `(relief trim)` at the head naming the archive and where the charter now is. Add
  `js-harness relief untrim`, which reverses the newest cut and proves it by checksum. Make every reader read
  "archive then head" through one function of `bin/lib/channel.mjs`, count lines globally, and land and install
  those readers before the writer runs. The first cut of the live file waits for his yes.
  Adds: a relief verb with trim and untrim (question 268)

## The design
- What the head holds: the live file, from the cut on. Its first line is the trim's own stamped line naming the archive
  file, the global line number the head starts at, and where the charter is; then the lead's `## Charter` if he takes
  that option; then every line from the cut on, as written. No line in the head is rewritten.
- Where older entries go: `~/.js-harness/relief/<slug>/archive-0001.md`, `-0002.md`, one per cut, each the exact bytes
  moved; `trims.jsonl` beside them records each cut. `uninstall` and the manifest name the folder, as they name the file.
- The cut, against an append: read the file at size S and its sha256; write and fsync the archive; build the new head
  in a temporary file beside it; read the size again, and if it grew, copy the bytes past S into the temporary file and
  check again; rename it over the live file. A rename the system refuses (an open handle on Windows) leaves the live
  file untouched and removes the archive and the temporary file; the trim says so and exits 1. The lead runs it from
  its own session, so its own hand edits do not race it.
- How every reader keeps working: `reliefLines(home, slug)` in `bin/lib/channel.mjs` gives the archive files and the
  head as one list of lines with their global numbers, without the trim's own line. The board and the resume hook
  print the head's lines and "N lines here, M in the archive"; the compaction measure reads the archive only for a
  span older than the head's first stamp; the land and `rules change` search the whole list newest first, as today.
- The undo: `js-harness relief untrim` concatenates the newest archive and the head minus the trim's line, checks the
  sha256 against `trims.jsonl`, renames it in place, and removes that archive file and its record. Tested on fixture
  files, never on the live one.
- When it runs: by hand, the lead's step at a phase close, or when `js-harness loop heartbeat` says the head passed the
  bound (a line, as its other `DUE:` lines). `notify` stays a plain append.

## Specs
1. "sacarlo de S6" and "dejar escrito el relevo como trabajo aparte, con su diseño revisado antes de construir; no
   autoriza construirlo todavía ni tocar el archivo del líder" (question 268 as asked and its answer A, transcript
   `812b728f` line 2517, 2026-11-12T04:33:06Z): this document, reviewed before any code.
2. The roadmap's row (`docs/ROADMAP.md:947-950`): "its design is reviewed before any code, with readers landed before
   the writer, an undo that is a tested command and an independent verifier."
3. "The lead reads a current-state head of 20 KB or less, never the 1.32 MB relief file" (`docs/proposals/harness-diet.md:458`).

## Tasks
- [x] T0 (kind: design) this document, spec 1; commit `docs(relief-bounded): the design of a bounded relief file`
- [ ] T1 (kind: build) `reliefLines` in `bin/lib/channel.mjs`, global numbering, archive then head; spec 2; test first in `bin/lib/channel.test.mjs`
- [ ] T2 (kind: build) the board, the resume hook and the compaction measure read through T1; spec 2; tests first in `bin/lib/board-files.test.mjs`, `bin/resume.test.mjs`, `bin/lib/measures.test.mjs`
- [ ] T3 (kind: build) the land and `rules change` resolve line numbers through T1 and add the stamp to new citations; spec 2; tests first in `bin/merge-queue.test.mjs`, `bin/lib/rules-change-run.test.mjs`
- [ ] T4 (kind: build) T1-T3 landed, released and installed; the writer waits for it
- [ ] T5 (kind: build) `js-harness relief trim` with the append-safe cut and the version refusal; spec 2; test first in `bin/relief.test.mjs`
- [ ] T6 (kind: build) `js-harness relief untrim` proven by sha256; spec 2; test first in `bin/relief.test.mjs`
- [ ] T7 (kind: verify) an independent verifier over T1-T6 on fixture files; spec 2
- [ ] T8 (kind: build) the first cut of the live file: his yes first (Ask me before)

## Log
- L1 (2026-11-22, the lead's brief `brief-relief-bounded.md`, as JH 292's second unit) the request as written: "the
  lead's relief file bounded, DESIGN ONLY, one document in a draft docs PR". His words behind it: question 268,
  answer A (Specs 1), and transcript `0cdab702` line 11291, "la idea es que hagas todo el trabajo".
- L2 (2026-11-22) the measure, read only, with `node -e` over the live file: the numbers of Depth pass item 2. The
  board does not read past its last 5 lines, and the resume hook only counts lines, so today neither breaks on size;
  the lead's own Read of the file is what the cap stops.

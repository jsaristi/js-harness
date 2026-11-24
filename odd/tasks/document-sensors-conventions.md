# document-sensors-conventions

Locator: `odd/tasks/document-sensors-conventions.md` · Branch: none yet (written on
`docs/plan-document-sensors-conventions`, documents only) · Session: a docs writer of the lead, unit B2 of night plan 2
(2026-11-23) · Test runner: `node --test`

## State
A plan only, written 2026-11-23 against origin/main 04664ab6; no code is written. Owed first: this plan's double
review (`rule:double-review`), Claude's and Codex's, whose Codex reader is held until the weekly reset of 2026-11-23
23:45; nothing is built before it. Next: after that review, T1 (measure the readers), then T2 to T5 in order.
Open: which slow readers stay out of the sensors of documents, decided by T1's timings (Constraints).

## Goal
A commit of documents alone runs every fast test that reads a declared document, and a test that starts reading one
cannot be added without either joining that list or being named, with its reason, as left out.

## Why
- `harness.json` lists by hand the two test files a commit of documents alone runs (`harness.json:15`). The list was
  written on 2026-10-12 (9c0c8e94) and has not changed since; `bin/conventions-model-home.test.mjs`, which reads
  `docs/ROADMAP.md`, came on 2026-11-11 (a38ac869) and never joined it.
- So a roadmap line passed its own pre-commit and turned the merge queue's candidate red twice (pull request 903,
  `docs/FAILURES.md:598-602`), and a feature document's first commit did the same (`odd/tasks/f8-s8-certification.md:279`).
  Each red costs a whole gate run and a second commit, found after the fact by someone else.
- Adding the one file would repeat the failure with the next reader: the cause is a hand-kept list with nothing that
  holds it to the tests that read documents. The repository already holds such lists with convention tests.

## Done when
- `node --test bin/conventions-document-readers.test.mjs` exits 0 (red today: the file does not exist)
- `node -e "process.exit(require('./harness.json').documentSensors['document tests'].includes('bin/conventions-model-home.test.mjs')?0:1)"` exits 0 (red today: 1)
- `js-harness rules check` exits 0
- `npm run check` exits 0
- a documents-only commit that writes a model id with its version into `docs/ROADMAP.md`, in a scratch clone, fails
  its own pre-commit on the `document tests` row (T3's replay of pull request 903)

## In scope / Out of scope
- In: the `"document tests"` command of `harness.json`; a new `bin/conventions-document-readers.test.mjs`; the line of
  `docs/ROADMAP.md:58` that says "the two test files"; the Control line of `documents-commit-skips-suite`.
- Out: `bin/check.mjs` and `bin/check.test.mjs`: the gate's behaviour does not change, only this repository's
  declaration, and both files are held by open pull requests (Constraints). The shape of `documentSensors`, which
  other projects' `harness.json` files use. Choosing tests by the staged paths at commit time, which is gate code (item
  5 of the Depth pass says why it waits).

## Constraints
- High risk, item 5 of `AGENTS.md` (the gate: what a commit of documents runs): the risk lens runs on the build slice,
  and an independent verifier runs last on the range that ends at the head that ships.
- Each sensor of documents runs for two minutes at most (`DOCUMENT_SENSOR_TIMEOUT_MS`, `bin/check.mjs:447-449`) and with
  no gate lock (`bin/check.mjs:1360-1362`), beside whatever gate holds it. A test file joins `"document tests"` only if
  it runs in seconds; a slower reader is named in the convention test's left-out list with its reason — because a
  documents commit is meant to wait for nobody, and a long unlocked run shares the cores with the gate that holds the lock.
- The convention test's left-out list only shrinks, as every `bin/conventions-*.test.mjs` list does (`AGENTS.md`,
  "What good looks like").
- Pull request 989 holds `bin/check.mjs` and pull request 947 holds `bin/check.test.mjs` (`gh pr list --state open
  --limit 300 --json number,files`, 2026-11-23); `harness.json` is held by none. The build touches neither held file.
- `docs/ROADMAP.md` is held by pull requests 934 and 935 and its Next and Decided budget is at 9992 of 10000 (night
  plan 2, "(c)"); T4 waits for them and rewrites the line in place, adding no words beyond the budget.
- No Codex run before 2026-11-23 23:45 and no paid run (the lead's standing constraint); the build waits for Codex day.

## Ask me before
Nothing expected. A reader that cannot run in seconds and cannot be left out without losing the check it holds stops
the task and goes to the lead.

## Depth pass
- 1. Method: a derived list beats a hand-kept one, and where a list must stay declared, a test holds it to what it
  lists. This repository's standard for that is the convention test with a list that only shrinks
  (`bin/conventions-model-home.test.mjs:170-172`, `TEXTS` and `DATED_DOCUMENTS`, both "only shrink"). The smallest
  change that meets it: one convention test and one longer command in `harness.json`, with no gate code changed.
- 2. Raw material:
  - `harness.json:4-7`: `documents` are `docs/` and `odd/tasks/`; `harness.json:13-18`: `documentSensors`, whose
    `"document tests"` is `node --test bin/rules.test.mjs bin/sessions.test.mjs` (`:15`).
  - `bin/check.mjs:463-485`, `discoverDocumentSensors`: the sensors of a documents commit are the declared ones "and
    nowhere else"; `bin/check.mjs:1442-1451`: a commit whose staged paths are all documents returns their rows and
    runs no project sensor.
  - `bin/check.mjs:447-449`: the two-minute bound; `odd/tasks/gate-wait.md:1782`: the two declared test files took
    3.25 s when the list was built.
  - `bin/check.test.mjs:2617`: the control test today, which proves the sensors run in order and bounded, not that
    they cover the readers.
  - The readers on the list: `bin/rules.test.mjs:74` reads `docs/FAILURES.md`; `bin/sessions.test.mjs:648-649` reads
    `odd/tasks/session-channel.md`.
  - The reader left off: `bin/conventions-model-home.test.mjs:172` holds `docs/ROADMAP.md` among its `TEXTS` and
    reads each at `:226`; added 2026-11-11 (`git log --diff-filter=A -- bin/conventions-model-home.test.mjs`: a38ac869).
  - The register: `docs/FAILURES.md:590-604`, `documents-commit-skips-suite`, two Seen lines, and its Control line
    names the bounded-run test above. Its first Seen line cites `bin/check.mjs:279-287`, which has moved to `:1442-1451`.
  - Other readers [e]: 15 test files read a file under the repository root and name `docs` or `odd` in their code,
    among them the two listed and `bin/check.test.mjs` (`find bin scripts workshop -name '*.test.mjs' | xargs grep
    -lE "import\.meta\.(dirname|url)" | xargs grep -lE "['\"\`](docs|odd)['\"\`/]" | xargs grep -lE
    "readFileSync\([^)]*(ROOT|REPO|PACKAGE|repo|root|HERE)"`, over 348 test files). A heuristic: it counts fixtures
    as readers and misses a test that reads a path it takes from data (`bin/rules.test.mjs:53`, `rule.path`).
  - Where else the gap is named: `odd/tasks/f8-s8-certification.md:280` says the stretch items `staledocs` and
    `precommit-gap` own it; `grep -rn "staledocs\|precommit-gap"` over the repository finds only that line, its
    session note and a `staledocs` item that brought stale records up to date, so no task holds the fix.
- 3. The bar:
  spec 1: `node -e "process.exit(require('./harness.json').documentSensors['document tests'].includes('bin/conventions-model-home.test.mjs')?0:1)"`: exits 1 today
  spec 2: `node --test bin/conventions-document-readers.test.mjs`: none, new behaviour
- 4. Refutation: the request would not hold if the reader were already declared, or too slow to be a sensor of
  documents. Run on 2026-11-23 at 04664ab6: the spec 1 command exits 1, so it is not declared; `node --test
  bin/conventions-model-home.test.mjs` alone passes 13 of 13 in 1.59 s (`duration_ms 1345`), well inside the
  two-minute bound. Timing the two declared files together was refused by the guard, because the gate of
  `D:\js-harness` held the machine's lock; that refusal is the Constraints line on unlocked runs, seen.
  Verdict: supports
- 5. Request: add `bin/conventions-model-home.test.mjs` and every other test that reads a declared document and runs in
  seconds to `"document tests"`, and add a convention test that fails when a test reading a declared document is
  neither in that command nor in a left-out list with its reason. Choosing tests by the staged paths at commit time
  would need no list, but it changes `bin/check.mjs`, which pull request 989 holds, and puts a static guess of what a
  test reads inside the gate; it is left for after this lands, if the left-out list grows. The convention test adds
  nothing to the request: the register already asks that the gate run the readers of a staged document
  (`docs/FAILURES.md:597-598`), which a list that drifts does not.
  Adds: none

## Specs
1. The register, as written (`docs/FAILURES.md:601-602`): "the sensors of documents do not run the convention tests
   that read the documents a commit changes, and the writer had not run them". Night plan 2, B2, as written: "The
   convention tests that read documents are not run, for example bin/conventions-model-home.test.mjs, which reads
   docs/ROADMAP.md".
2. The list stays held to the readers, from the register's first Seen line, as written (`docs/FAILURES.md:597-598`):
   "until the gate runs the readers of a staged document, `rules check` is run by hand after such a commit".

## Tasks
- [ ] T1 (kind: design) spec 1 and spec 2: time each candidate reader alone and read whether it reads a declared document; record the list and the left-out reasons here; route: inline, one file at a time; commit: docs(document-sensors-conventions): measure the readers
- [ ] T2 (kind: build) spec 2: a convention test holds the document tests to the tests that read declared documents, written first and red on the model-home reader; route: inline, risk lens; commit: test(conventions): hold the document tests to their readers
- [ ] T3 (kind: build) spec 1: the readers T1 kept join the document tests in harness.json, which turns T2 green; route: inline, risk lens; commit: fix(check): run the readers of documents on a documents commit
- [ ] T4 (kind: verify) spec 1: the replay of pull request 903 in a scratch clone, Done when, Codex on the range and the independent verifier on the range ending at the head; route: Codex and a verifier sub-agent; commit: none
- [ ] T5 (kind: docs) spec 1: `docs/ROADMAP.md:58` stops saying the two test files, after pull requests 934 and 935 land, and the Control line of `documents-commit-skips-suite` names T2's test; route: inline; commit: docs: the document tests are held to their readers

## Log
- L1 (2026-11-23, the lead's brief for B2, as written): "The task is a new feature document,
  odd/tasks/document-sensors-conventions.md. It is a plan only and holds no code." No owner quote was found for this
  unit. Search: `docs/FAILURES.md:590-604`, the entry this plan serves, read for "Sebastián", "his words", "he asked"
  and quoted Spanish (no hit); `grep -n -i "documentSensors\|sensors of documents\|document tests\|documents-commit-skips-suite"`
  over `docs/ROADMAP.md`, `docs/todo.md` and `odd/tasks/*.md` (records of the build and its sightings, no request of
  his). Night plan 2, "(b)", records the same search over the four failures it serves. The words above are the lead's
  and the register's.
- L2 (2026-11-23): `odd/tasks/` holds no document for this fix (the grep in L1); `odd/tasks/gate-wait.md` built the
  sensors of documents and is closed, so a new document rather than an amendment.
- L3 (2026-11-23): the build was kept out of `bin/check.mjs` (item 5): only the declaration and a convention test
  change, so pull requests 989 and 947 do not block it.

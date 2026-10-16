# Shared files that pull requests stop editing by hand

Locator: `odd/tasks/generated-shared-files.md` · Engram mirror: `odd/generated-shared-files/tasks` · Branch:
`docs/generated-shared-files` (design), one `feat/` branch per build task · Delivery: `ask-on-risk` · Runner:
`node --test`

## Goal
A pull request that adds a hook edits only its own lines and its own tests, and the README's install
example says what install prints.

## Why
Item 4 of the lead's throughput plan (2026-10-16, his words in L1): files every pull request edits cost a
merge, a gate and often a new review when two pull requests collide on them. Touches are many: of 259 pull
requests merged since 2026-10-10, 52 touched `README.md`, 39 `bin/lib/manifest.mjs`, 30
`bin/lib/manifest.test.mjs`, 19 `bin/install.test.mjs`, 14 `scripts/practice-lib.mjs`. Conflicts are few:
of the 60 merges of `origin/main` into a branch since 2026-10-10 (reader B, `git merge-tree`, approximate),
`README.md` conflicted in 2 (`44c064c`, `387ef65`, both two sections of prose added at one spot), the hook
tests and `scripts/practice-lib*` in 1 (`4ca2b4f`, pull request 282: seven hunks in `manifest.test.mjs`, all
hand copies or counts of the hook list), and `bin/js-harness.mjs`, outside this design, in 5. So the value
here is modest and said as such: the build is the small part that removes the copies and a stale example.

## Done when
- `node --test bin/readme.test.mjs bin/install.test.mjs bin/lib/manifest.test.mjs scripts/practice-lib.test.mjs` exits 0
- `npm run check` exits 0
- A hook added in a scratch copy, to `entryComponents` with its own test and its id claimed on its capability's
  `Today` line in `docs/SPEC.md` (the `spec` row requires it, `bin/lib/spec.mjs:134`), changes no other line of
  `bin/lib/manifest.test.mjs` or `bin/install.test.mjs` and leaves them green: run once, recorded in the Log.

## In scope / Out of scope
- In: the counts, positional picks and full-list literals of the hook list in `bin/lib/manifest.test.mjs` and
  `bin/install.test.mjs`; the literal list in `scripts/practice-lib.test.mjs`; the README's install example and
  its preface's rule for examples.
- Out: splitting the README into one file per command: his answer to question 22 was one page with every
  command and its example ("Una página y cada comando", 2026-10-13T18:05:34Z, the lead's transcript
  `65318fd5`, line 10979, read with `js-harness sessions --quote`); changing it is his.
- Out: `HARNESS_HOOKS` itself stays a hand copy: the practice "looks at the candidate from outside and imports
  nothing of it; a test holds the two spellings together" (`scripts/practice-lib.mjs:462-464`, the same choice
  at `:316-330`). Retiring that rule is not this item's to do.
- Out, and named for the lead to route: `bin/js-harness.mjs`, the dispatcher's `USAGE` and `COMMANDS`
  (conflicted in 5 of the 60 merges, more than every file here together), and `docs/ROADMAP.md`. They need a
  design of their own (D4 below says what was seen).

## Constraints
- The README keeps every command's section, prose and an example from a real run — his answer to question 22,
  and `docs/SPEC.md:462`.
- A test never builds its expectation with the function it checks — so a changed format or a wrong host file
  still fails a test.

## Effort
high

## Ask me before
Nothing planned. Splitting the README, or retiring the practice's "imports nothing" rule, would be his.

## Specs

- **S1** (the lead's throughput plan, item 4, 2026-10-16): "Shared hot files generated, not hand-edited:
  README command list from --help, manifest rows derived". Baseline in the plan: "README in 26 of 61 PRs,
  ROADMAP 17, manifest 11".
- **S2** (the lead's notice to 25, 2026-10-16 15:51): "README command list generated from --help and manifest
  rows derived, so 26 of 61 PRs stop editing README by hand. Design first, two readers. Tell me the PR."
- **S3** (assumption, from the readers' map): the README has no usage lines to generate from `--help`: each
  section is prose and a real run's output, and `bin/readme.test.mjs` already holds its headings to `--help`'s
  names and order (`:70-72`). What S1 asks is read as its aim, fewer hand edits of shared lines, not its means.

## Design

### Where the copies are (`origin/main` `225da7d`, readers A and B)
- `entryComponents`, `bin/lib/manifest.mjs:219-286`: 11 hook entries, the one declaration `install` reads.
- `bin/install.test.mjs:315-326`: the 11 "registered hook entry" lines in order; `:329-330`: the uninstall
  paths, `settings` nine times and `hooks` twice.
- `bin/lib/manifest.test.mjs`: the count (`:966`, `length, 11`); positional picks (`:45`, `:947`, `:952`
  `.slice(8)`); the `our*` builders and `ourSettings()` (`:1065-1073`); the records in order (`:1084`); the
  removed paths (`:1093`); the counts at `:1227` (`[8, 1]`), `:1346` (`SessionStart.length, 4`), `:1407`
  (`length, 3`); the containers per entry (`:1905-1910`). `:1701`, `:1718`, `:1734` compare raw
  `JSON.stringify(ourSettings())`, so key order matters.
- `scripts/practice-lib.test.mjs:807-818`: a literal of `HARNESS_HOOKS`, beside a comparison with
  `entryComponents` that already holds the two together (`:799-806`, `:819-820`).
- `README.md:148-157`: nine hook lines where install prints eleven (the guard's `PreToolUse` and `Stop` lines
  are missing), so the example is already false and nothing checks it.

### D1: one helper, literal pins per hook, no count
- Each hook's own test pins its `id`, `target`, `pointer` and `entry()` as literals, as the rules' and the
  guard's tests already do (`:955-962`, `:1033`); a hook is taken with a `hookById(id)` helper that fails by
  name when the id is missing. This is what still catches an entry written to the wrong host file or a changed
  matcher.
- The tests that need every hook build the list with one helper, `ourHooks(file, event)`, from
  `entryComponents`, and assert what install wrote equals it; the count, the positional picks and the full-list
  literals go. `bin/install.test.mjs` imports the helper and formats the expected lines with its own template
  literal, never with install's `hookName` (`bin/install.mjs:186-196`), and keeps one whole literal line, the
  guard's with its matcher.
- What the count caught stays caught: ids unique, and no two entries with the same target, pointer and entry
  (a merge that kept both sides). The order inside an event with more than one entry, `SessionStart` today
  (doctor, resume, rules), is asserted as a list of ids for each host file.
- One raw settings file stays literal (an indent-preservation test), so install's grouping is not checked only
  against a builder that copies it.

### D2: the practice test drops its literal, the copy stays
`scripts/practice-lib.test.mjs:807-818` goes; the comparison with `entryComponents` stays, with one pinned
entry per host. `HARNESS_HOOKS` stays a hand copy by the practice's rule (Out, above), so a hook still adds one
line there, held to the declaration by that comparison.

### D3: the install example cut, not rendered
The install example keeps its first lines from a real run, two hook lines among them, then `…`, and the
missing guard lines stop mattering: the cut example is true. The preface gets one sentence: output that grows
with each feature (hook lines, check's rows) is shown in part and cut with `…`, which it already defines
(`README.md:50-51`, `…` used 21 times). A renderer was weighed and left: a rendered block is no real run
(`README.md:50`, `docs/SPEC.md:462`, `bin/readme.test.mjs:5-6`), the README's Windows paths would need
normalising on Linux CI, and it would make the scratch hook of "Done when" fail until someone renders again.

### D4: what was seen of `bin/js-harness.mjs` (not built here)
Its two lists, `USAGE` (`:7-44`, one line per command, some a paragraph long) and `COMMANDS` (`:48-82`, in
another order), conflicted in 5 of the 60 merges (`44c064c`, `b4f526d`, `1050643`, `5ef9691`, `26ef630`).
`bin/js-harness.test.mjs:585-600` holds the two names together. A design for them is the lead's to route.

### Alternatives weighed
- `merge=union` for `README.md` in `.gitattributes`: would have resolved both README conflicts (two additions
  at one spot), but keeps both sides of any edit in silence, so a merged README must be read; never for the
  test files, where it breaks syntax. Left out: two conflicts in 60 merges do not pay for that risk.
- Doing nothing to the tests: one conflict in 60 merges, resolved in one sitting. D1 is still built because
  each new hook edits about eight lines of two shared test files today, and a hook's pull request then edits
  none of them.

### Cost and order
- Estimate, not measured: D1 and D2 about 210 changed lines of tests, one pull request (disjoint files, one
  idea); D3 about 10 lines, its own documentation pull request.
- Order: pull request 282 lands first (it adds two hooks and touches all these files); then D1 and D2; then
  pull requests 263 (manifest, install, README) and 199 (practice-lib) merge `main` once. D3 any time: no open
  pull request edits the install section.
- What leaves: the copies, counts and positional picks; nothing a test catches today stops being caught.

## Tasks
- [x] T1 (kind: design) S1-S3: this design, read by two readers that did not write it; their changes in L3
- [ ] T2 (kind: build) S1: D1 and D2, after pull request 282 lands (route: inline)
- [ ] T3 (kind: docs) S1: D3, the install example cut and the preface's rule (route: inline)

## Log
- L1 (2026-10-16, the lead's throughput plan, his words as it quotes them): "Ojala podamos optimizar a un
  nivel sin sacrificar calidad que me tengas que decir que optimizar mas es mas el costo que el beneficio esa
  es la idea pero manteniendo la calidad y fiabilidad"; "apliquemos todo eso de una vez para que cuando
  trabajes autonomamente avancemos de una manera excepcional y a la maxima eficiencia".
- L2 (2026-10-16, JH 25): a reader mapped the README, the dispatcher and the manifest. The premise "README
  command list from --help" does not hold: there is no usage text to generate, and the heading list is already
  held to `--help`. The design aims at the shared lines instead.
- L3 (2026-10-16, JH 25): two readers on the first version. Reader A (true to the code): eleven install lines,
  not nine; the README example is stale; a rendered block is no real run; `HARNESS_HOOKS` is a copy by the
  practice's own rule; install's formatter is private and takes a record; a `readme` subcommand would edit the
  dispatcher; D1 needs literal pins and a find-or-fail helper; "Done when" needs the SPEC line. Reader B
  (adversarial): conflicts were 2 and 1 in 60 merges, not "often", and `bin/js-harness.mjs` had 5; cut the
  install example instead of rendering it; keep per-hook literals, unique ids and the `SessionStart` order;
  the inventory missed four counts; land after pull request 282; weigh `merge=union`. Changed: the Why, the
  map, D1 (helper, pins, uniqueness, order, one literal line and file), D2 (the copy stays), D3 (cut, no
  renderer), D4 and the alternatives added, the order after 282.

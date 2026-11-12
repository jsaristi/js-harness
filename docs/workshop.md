# The workshop

The workshop is what keeps js-harness itself, as against what a project installs (odd/tasks/workshop-product-split.md).
Its commands read only this repository's records, so they left the product dispatcher and never ship: they run from
this checkout as `node workshop/js-harness-workshop.mjs <command>`, which also runs the product's `loop` with the
three heartbeat ticks, the product's `doctor` with the idea-watch row, and `spec`, which holds the claims of
docs/SPEC.md on `js-harness-workshop <command>` to the workshop's dispatcher.

The sections below are the README's sections of those commands. Each names a command as it runs, `node
workshop/js-harness-workshop.mjs <command>`, as each command's own usage does: the installed `js-harness` answers
"Unknown command" to them (`workshop/js-harness-workshop.test.mjs` holds it).

### throughput

The throughput review's measure: a fixed table of a window of UTC days, by default yesterday,
where every row names the record it was read from and a fact no record holds yet says which
recorder it waits for, never a zero; a record that could not be read, a git process that failed
included, is named on its row with why. The tasks are each commit of main compared with the one
before, as `progress` compares them. It is read-only and fetches nothing: main is `origin/main`
as last fetched (`git merge-tree`, which names the files of a conflicted merge, writes objects
into the object store). The gates are every project's on the machine, as the gate lock is.
`ready to merged` runs from the newest ready notice naming a pull request (`notify --kind ready
--pr`) to its merge, `land phases` reads the merge queue's land record, and `red tests on CI`
and `CI fallbacks` read the gate log's lines of gates sent to GitHub's machines; a day before
the recorder of a row reached main says `not recorded` on that row, since nothing wrote a line.
`test files` reads the time of each test file from the local gates that traced their tests
(exact tests on), kept beside the gate log in `test-times.jsonl`; a day kept from copies of the
gate log has no times and says so.
`questions` reads the channel's question notices to the answer or withdrawal that closed each, numbered as the
board numbers them: how long an answer took to be relayed, and, from answer notices that keep them, when the
question was shown and answered.

```console
$ node workshop/js-harness-workshop.mjs throughput --since 2026-10-16 --until 2026-10-17
Throughput  2026-10-16 to 2026-10-17 (UTC, until excluded; local UTC-05:00: 2026-10-15 19:00 to 2026-10-16 19:00)  D:\js-harness
  gates: every project of this machine, as the gate lock is; the other rows: this project
  2026-10-16  snapshot
pull requests merged         94 (3.92 an hour); merged twice: #292, #305  [git log of origin/main as last fetched]
ready to merged              not recorded: 2026-10-16 (before B1, 2026-10-17)  [the newest ready notice naming the pull request on the channel (notify --kind ready --pr) to its merge commit on origin/main]
lock busy                    16.8 h of 24 h; by kind: check 125 / 446 min, land 65 / 230 min, copy 49 / 150 min, run 39 / 111 min, commit 25 / 70 min  [the gate log (~/.js-harness/gate-log)]
commit gates                 here: median 200 s (150), lock free median 217 s (52); GitHub: median 144 s (75)  [the gate log (~/.js-harness/gate-log)]
lands                        65, median 216 s, red 8; 65 gates for 49 lands  [the gate log (~/.js-harness/gate-log)]
…
```

The gate log rotates in about two days, so `throughput snapshot [--day <day>]` keeps a day's
gates under the home (`.js-harness/throughput/<project>/<day>.json`) once the day has settled,
two `gate-max` after its midnight, and the table reads a kept day from there. Main's history,
the Codex runs and the channel are append-only and always read live. A kept day is written
again only by a fuller one, the replacement recorded; `--gate-log <file>` (twice at most) reads
archived copies of the log instead, for a day the live log has lost; a copy made before the day
settled may lack its last gates, so the day is kept as partial until then. A copy is made no
earlier than its modification time; one that kept its source's time (`cp -p`) says when it was
made with `--copied-at <YYYY-MM-DDTHH:MMZ>`, never a time after now. `throughput status` lists
the kept days and exits 1 naming each day since the first one kept that has none, or that none
is kept at all, since a project whose snapshots never ran must not read as fine. Uninstall
leaves the snapshots in place.

`status` then prints a `DUE:` line for each review owed, which changes no exit code. The review
of the last settled day is due a day after the last one recorded; once the last
`throughput-quiet-runs` reviews found nothing it is due `throughput-quiet-days` after it, and one
that finds candidates makes it daily again. `throughput reviewed --day <day> --found
nothing|candidates` records a review, `throughput shipped <item> [--day <day>]` records a change
that shipped, and each ship day owes a re-measure of the `throughput-compare-days` after it
against as many before, everything shipped that day compared together, until `throughput
reviewed --shipped <day>` records it. The outcomes go to `outcomes.jsonl` beside the snapshots.

```console
$ node workshop/js-harness-workshop.mjs throughput status
2026-10-15  kept
2026-10-16  kept
DUE: throughput review of 2026-10-16: node workshop/js-harness-workshop.mjs throughput --since 2026-10-16 --until 2026-10-17; js-harness-protocols section 7; then node workshop/js-harness-workshop.mjs throughput reviewed --day 2026-10-16 --found nothing|candidates
```

`--against <since>..<until>` compares the window with an equal window before a change, row by
row, daily value with daily value. The gate-wait median moved from 216 s to 69 s from one day to
the next with nothing shipped, so with fewer than `throughput-compare-days` days a side it prints both and how often the median of
a window that did not change falls outside the before range, and judges nothing; from `throughput-compare-days` days a
row moved only when the after window's median lies outside the before range, which an unchanged
window of that length does 7% of the time. The window before must end by the one compared.

```console
$ node workshop/js-harness-workshop.mjs throughput --since 2026-10-16 --until 2026-10-17 --against 2026-10-15..2026-10-16
Throughput compared  before 2026-10-15 to 2026-10-16, after 2026-10-16 to 2026-10-17 (UTC days, until excluded)  D:\js-harness
pull requests merged                     before 80      after 94      not judged: 1 days a side, under 7; with nothing changed, the after median falls outside the before range 100% of the time
lock busy, h                             before 14.3    after 16.8    not judged: 1 days a side, under 7; with nothing changed, the after median falls outside the before range 100% of the time
…
```

### docs

What a model or a person starting cold reads to audit the harness whole; `docs/README.md` is its entry.
`docs plan` prints every file git tracks in exactly one slice of at most 400,000 estimated tokens
(characters over four), 40% of a 1M window so the auditor keeps room to reason and write, in four tiers
read in order: the core (the entry, the map and the other documents of the root and `docs/`, then the
source of `bin/` beside its capability of `docs/SPEC.md`, a module no capability names going with the
capability whose files import it in the fewest steps), the tests (beside the capability whose proof or
source names them), the feature documents (each of `odd/tasks/` with its state, open or closed, from its
task boxes) and the rest. Every slice after the first opens with the entry, counted in its budget.
`--budget <n>` sizes the slices for another window; `--json` prints the plan whole. The plan is computed
from the tracked files each time and never stored. `docs index` prints why each capability is there: its
explicit links, the documents of `odd/` and `docs/` its text cites (a quoted section held to its file), the
rules it names as `rule:<id>` and the failure entries of `docs/FAILURES.md` it names, with the failure each
such rule guards against; then, apart and marked unverified, the rules and failure entries inferred from a
file its Today or Proof line shares with a rule's home or reader or a failure's control, never through a
file more than 8 rules or 8 Today lines name, which it prints as too shared; then the rules, failure
entries and feature documents no capability reaches. 10 of 20 inferred links read by hand were right,
under the bar of 14 that would drop the mark. `--json` prints the index whole. `docs check` runs the
`docs` row of `check` alone: in the harness's own repository it fails where `docs/README.md` is missing, a
file or folder of `docs/` has no row under its `## Index`, a tracked file cannot be read, one file alone
outgrows a slice, an explicit link of the cross index does not resolve, or SPEC's table of records drifts
from the source (a name the source joins into a path that no row holds, a row no source names, a writer
that no longer holds its function, or a row without its section of fields in `docs/RECORDS.md`); in any
other project it says so
and exits 0. Exit 1 on a failing row, where git cannot list the files, from `plan` where a tracked file
cannot be read, named on stderr after the plan, and from `index` on a link that does not resolve, an
input it lacks or a tracked file it cannot read, named on stderr; 2 on a usage error.

```console
$ node workshop/js-harness-workshop.mjs docs plan
Reading plan of 1,434 tracked files, 5,773,980 estimated tokens (characters over four), in 18 slices of at most 400,000
Read the tiers in order, one slice a context: the core first, then the tests, the feature documents and the rest. --json gives the plan whole.

core: 4 slices, 1,371,082 estimated tokens
  slice 1, 374,950 tokens
    orientation (255,703): docs/README.md, docs/SPEC.md, AGENTS.md, CLAUDE.md, docs/ROADMAP.md, ...
$ node workshop/js-harness-workshop.mjs docs index
Cross index of 76 capabilities: 64 cites a document, 0 name a rule, 5 a failure entry; 34 reaches a rule and 41 a failure entry by inference
...
Too shared to infer from:
  bin/check.mjs: 4 rules, 15 Today lines
  bin/lib/manifest.mjs: 18 rules, 3 Today lines
  bin/lib/protocols-skill.mjs: 9 rules, 1 Today line
$ node workshop/js-harness-workshop.mjs docs check
PASS  docs  20 entries of docs/ indexed; 1,445 tracked files in 18 slices of at most 400,000 estimated tokens (node workshop/js-harness-workshop.mjs docs plan); 44 records of docs/SPEC.md held to the source and to docs/RECORDS.md; every explicit link of the cross index resolves, 264 links inferred, 184 reached by no capability (node workshop/js-harness-workshop.mjs docs index)
```

### windows-daily

The gates run on Linux, so the whole suite also runs once a day on GitHub's Windows machines
(`.github/workflows/windows-daily.yml`: at 07:23 UTC and by hand with `gh workflow run
windows-daily.yml`, never for a push or a pull request, so it holds up no gate and no land; free on
a public repository). This command reads the newest completed run on the default branch of the
GitHub repository `origin` names and says whether it passed. A red run (`failure`, `timed_out` or
`cancelled`) not told before is told to the orchestrator once, with the run's address, how many
tests failed and their names, unless every file it failed in has a current entry in
`docs/FLAKY.md`; a red run whose names cannot be read is told all the same. A schedule whose newest
run ended more than 26 hours ago is told once too: GitHub drops scheduled runs under load and
switches a schedule off after 60 days with no activity. Each run is told by whoever first creates
its marker under `.js-harness/channel/windows-daily/` in the home, so the heartbeat and a hand run
never both tell it. The lead's `js-harness loop heartbeat` reads it every hour.

```console
$ node workshop/js-harness-workshop.mjs windows-daily
windows-daily: the newest run, https://github.com/jsaristi/js-harness/actions/runs/39007607383, failed (failure, ended 1 h ago), 168 failing: in shadow the gate traces its suite under the git dir and its end line keeps the counts; …
WINDOWS: https://github.com/jsaristi/js-harness/actions/runs/39007607383 failure, 168 failing: in shadow the gate traces its suite under the git dir and its end line keeps the counts; …
```

### subagents

Counts a day's sub-agents of the project by role (writer, explorer, reviewer, verifier), model
and effort, with their tokens and the share of the day's tokens they took, so that what to
measure next and how many to launch come from a count. It reads the Claude Code records of the
main checkout and each worktree and keeps no text of any message; Codex is not counted. `--day
YYYY-MM-DD` names the day (today by default), `--days <n>` reads up to 7, `--json` gives the data
and `--cwd <dir>` names another project.

```console
$ node workshop/js-harness-workshop.mjs subagents --day 2026-10-14
Sub-agents, local day 2026-10-14 (UTC-05:00), 2 record folders; Claude records only, Codex not counted
role      model             effort asked/ran  launches  input  cache write  cache read   output
explorer  claude-opus-5-5   high/high               23    932      2197153    37928674   274820
writer    claude-haiku-5-5  high/high               11    646      1626090    46702162   397934
…
total                                               54   2502      6420288   132472395  1050507
Their share of the day's tokens: input 19%, cache write 29%, cache read 8%, output 23%
Read as other: 5; effort or model inherited from the session: 14; call not found: 1; carried over from the day before: 0
Read in 8.2 s
```

### audit

Counts, per session of a day, the two claims a transcript can check by itself, and prints each
wrong one at its transcript and line: the hour a message to another session stamps in its
opening, against the hour the entry was sent (more than a minute apart is wrong), and the share
of its context a session states of itself, against the share its own reply records (more than 2
points apart is wrong). The share is of the window the session's own last `get_usage` read
reports, because sessions run on windows of different sizes. It reads the Claude Code records of
the main checkout and each worktree and prints no text of any message. It takes the same `--day`,
`--days` (up to 7), `--json` and `--cwd` as `subagents`.

```console
$ node workshop/js-harness-workshop.mjs audit
Audit, local day 2026-10-15 (UTC-05:00), 4 record folders: the hours messages stamp and the context shares sessions state, each against its transcript
session   title                                    messages  stamped  wrong hour  shares  wrong share
2ec5f55e  JH 15 · auditoría de honestidad                 7        1           0       8            4
d3ecd893  JH 8 · turno y corte temprano del gate         11        3           0      10            2
f7f03a7e  JH 10 · comprobación en GitHub                 29        0           0       4            0
total                                                   367        7           0      84           40
Wrong shares, more than 2 points from the share the reply records (transcript:line):
  2ec5f55e-e2da-493b-8819-43b3c57394be:4725  stated 50%, recorded 64%
  d3ecd893-952c-4591-a356-73f605c9fc90:15014  stated 36%, recorded 39%
Read in 13.7 s
```

### host-watch

The commands of the host watch session (F8's S9, `odd/tasks/f8-s9-host-watch.md`), which reviews
each Claude Desktop update in depth instead of checking only that nothing broke. `draft` cuts the
update's span of both changelogs, from the record of reviewed versions to the versions doctor
reads (or a span frozen with `--from-*` and `--to-*`), and prints the review file
`doctor --host-reviewed` asks for: one row an entry, placed in the harness areas it touches, an
entry outside the Code tab decided `ignore` and every other left `?`, the unplaced ones listed under
`## To classify by hand`; `--sources` writes the span's excerpts. `check` holds a finished review
to the span read from those excerpts: one decided row an entry, by its id. `tools` diffs the app's
tool list, as a session transcribes it, with the one the project recorded for that surface; a
first capture is a baseline, and only the host's own servers are kept:

```console
$ node workshop/js-harness-workshop.mjs host-watch tools --surface desktop --list tools-desktop-lead.txt
baseline: 169 host tools on the desktop surface; no list was recorded at D:\js-harness\docs\host-updates\tools-desktop.txt
other MCP servers left out: 1a59c906-04da-521d-bda7-7f71b9f9e01c (8), codegraph (1), engram (23)
```

A desktop list must hold `start_session`, which only a session the app started is given; a
`claude --bg` session's list is recorded as `background`. A removed name is confirmed with
`ToolSearch` `select:<name>` before a review claims it.

`brief` prints the brief of the session that reviews the update read now: its title
`<code> <n> · host watch <version>` with the next number, the spans frozen from the record last
reviewed, and each step of the review. `js-harness loop heartbeat` reads the host every hour and,
while an update has no session titled for its version, ends with a `HOST:` line that names the
session and the command that opens it; the `host-update` row and the hook's notice say the review
is that session's.

### idea-watch

The idea watch (`odd/tasks/idea-watch.md`) reads each stable release of the upstream harness
js-harness was built from, for what it adds or removes that could improve this one; nothing of it is
installed, built or run. `status` lists the upstream's stable tags with `git ls-remote` and says how
many stand above the last release the record (`odd/tasks/gentle-ai-update-check.md`, its
`## Releases read`) holds as read.

```console
$ node workshop/js-harness-workshop.mjs idea-watch status
0 releases not yet read (the last read is v4.3.1)
```

`draft [--from <v>] [--to <v>]` fetches a bare clone under `~/.js-harness/upstream`, recorded in the
machine manifest before it is fetched so `uninstall machine` removes it, diffs the last read release
against the next one and prints the record's entry: one row an area of the harness, its verdict `?`
until a person decides adopt, adapt or ignore, the paths no area places under "To classify by
hand". A release whose every path falls in an ignored area prints as one line, already decided.

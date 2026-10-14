# Writing commands refuse unknown flags; three rows of check and doctor

Locator: `odd/tasks/commands-and-doctor.md` · Engram mirror: `odd/commands-and-doctor/tasks` · Branch:
`feat/commands-and-doctor` · Delivery: `ask-on-risk` · Runner: `node --test` · Session: "JH 12 ·
comandos y diagnóstico". Its four tasks moved here from two other features (Specs say from where).

## Goal
No command that writes outside the repository acts on a flag it does not know, and `check` and
`doctor` show three gaps that today live only in prose or memory: false citations, rules kept in
memory notes, and sessions of two permission classes with nothing joining them.

## Why
`install --help` was run to read its help and installed on his machine (2026-10-09); a new user meets
a writing command first. The three rows turn rules that depend on an agent remembering into lines a
command prints, which is the harness's whole bet.

## Done when
- `node --test bin/writing-flags.test.mjs` exits 0
- `node --test bin/check-codex-reviews.test.mjs` exits 0
- `node --test bin/lib/citations.test.mjs` exits 0
- `node --test bin/doctor.test.mjs bin/doctor-hook.test.mjs` exits 0
- `npm run check` exits 0
- Each task below is checked off with its commit, and the orchestrator has told JH 7 and JH 5 that
  their tasks moved here.

## In scope / Out of scope
- In: the flag parsing of `doctor`, `update`/`upgrade`, `codex-review`, `remote supervise` and
  `resume --hook`, and one shared helper for it (new `bin/lib/args.mjs`); the push row of
  `bin/check.mjs` (`checkCodexReviews`) and a new row `citations` there with `bin/lib/citations.mjs`;
  two rows in `bin/lib/stack.mjs` (`memory-rules`, `session-classes`); their tests; the help text and
  docs of what changes. Each file another session holds is cleared with the orchestrator first.
- Out: `odd/tasks/rule-hierarchy.md` and `odd/tasks/session-channel.md` (their sessions put the
  pointers); `AGENTS.md`. The `install` flag that writes `crossSessionInbound` is in since his
  answer (L3), with `bin/install.mjs` and `bin/lib/manifest.mjs`.

## Constraints
- A writing command refuses before it writes anything, exit 2 and the unknown flag named — because
  the incident was a write that happened while the user only wanted to read.
- A hook entry `install` writes must keep parsing under the strict parser — because the hook runs
  the copy on the path and a refused hook is a silent loss at every session start.
- `citations` is INFO, never FAIL, in this feature — because documents cite other branches and
  removed files on purpose (S2).
- `doctor` writes no security setting — because the design says "Without the flag the harness never
  writes a security setting" (S4).

## Effort
high

## Ask me before
The `install` flag that writes `crossSessionInbound` (S4, "on his word"); turning `citations` into a
FAIL; any spend outside the Codex rate.

## Specs
Copied verbatim from the two source documents at `origin/main` `d3f6ac1`, with the line each came
from. These are the designs' words, not his; his decisions inside them are quoted where the source
quotes them.

- S1 — `odd/tasks/rule-hierarchy.md` line 1596, task T4: "Every command that writes outside the
  repository refuses a flag it does not know; and the push row hints the merge commit as the base
  after `main` is merged in (failure 15)". Its design, C4 (line 235): "**C4 A writing command refuses
  a flag it does not know.** Incident: `install --help` was run to read its help and installed on his
  machine (2026-10-09). One table-driven test runs every command that writes outside the repository
  with an unknown flag against a throwaway home and expects a non-zero exit and nothing written."
  Failure 15 (line 1562): "| 15 | After `main` is merged in, the assessment counts its commits | RH
  (T4) | protocol 3: after a merge the base is the merge commit; the push row hints that base | a test
  of the push row's hint on a fixture branch with `main` merged in |".
- S2 — `odd/tasks/rule-hierarchy.md` line 1598, task T5: "The row `citations`, INFO". Its design, C5
  (line 240): "**C5 Citations.** A feature document cites a path or a commit that does not exist. Row
  `citations`, INFO at first: it reads only the lines the pending change adds, resolves each
  `path:line` against the tree and each commit id against the repository, and prints the count. It
  becomes a FAIL only after the count of false alarms over twenty commits is zero, because documents
  cite other branches and removed files on purpose."
- S3 — `odd/tasks/rule-hierarchy.md` line 1599, task T6: "The row `memory-rules` of `doctor`". Its
  design, C6 (line 246): "**C6 Rules in memory** (row `memory-rules` of `doctor`). It lists the notes
  of the project's agent memory whose type is `feedback` or `project`: each is a rule or a decision
  living where nothing acts. The four types (`user`, `feedback`, `project`, `reference`, in each
  note's front matter) are what Claude Code's memory instructions define in this session; the types
  the seventeen notes actually carry were not read here, and T6 reads them before it relies on them.
  The fix line says: place it with the protocol "recording a new rule", then delete the note. Notes
  of type `user` and `reference` are machine facts and are left. The `SessionStart` hook that
  `install` already writes (`js-harness doctor --hook`) shows the gap when it changes. This is the
  first of the feature's two end numbers, as a command." Its proof (line 1393): "| No rule living only
  in memory | `js-harness doctor`: no `memory-rules` gap |".
- S4 — `odd/tasks/session-channel.md` line 1131, task T7: "The row `session-classes` of `doctor`, with
  the exact fix in its line; and, on his word, the flag of `install` that writes the setting and
  records it". Its design, section 10 (lines 446-489), opens: "Claude Code delivers a message only
  between sessions of the same class, unless `crossSessionInbound` says otherwise; his desktop
  sessions bypass permission prompts and a session opened from the phone runs in `auto`." His
  decision there: "Decided by Sebastián on 2026-10-11, in the design session's chat, his words:
  "Entonces la A pero quiero que sea lo mas automatico posible"." Option A: "He sets
  `crossSessionInbound` to `accept` in his user settings." The row: "`doctor` gains a row
  `session-classes`: it reads the permission mode of the project's recent sessions and the setting,
  and when the classes differ and nothing joins them it reports the gap with the exact fix. Since
  `install` already writes a `SessionStart` entry that shows a new gap, he is told at the next
  session he opens, not by an agent that remembers." The flag: "Proposed, his to decide when it is
  built: `install` writes the setting for him on an explicit flag, recorded in the manifest and
  removed by `uninstall`, as it does for its hook entries. Without the flag the harness never writes
  a security setting. No agent writes it either"; and "In a project that only uses the harness this
  is the first thing a second device meets, so the row ships."

## The map (an explorer's, 2026-10-14, on `d3f6ac1`)
What each command does today with `--bogus`. Strict already (exit 2, nothing written): `install`,
`sync`, `uninstall`, `init`, `status`, `gate`, `check`, `contract`, `progress`, `failures`, `rules`,
`functions`, `remote` (but not `remote supervise`), `sessions`, `notify`. Still lenient:

| Command | Writes outside the repository | Today | Where |
|---|---|---|---|
| `doctor`, `doctor --hook` | `~/.js-harness/doctor.json`; probes it spawns | unknown flags and `--help` ignored, full report, exit 0 | `bin/doctor.mjs:33-43` |
| `upgrade` | `npm install` of a tarball, then `sync --global` | lenient; with `JS_HARNESS_SOURCE` set, `upgrade --bogus` installs | `bin/update.mjs:16-27`, `:251` |
| `update` | nothing (shares the parser above) | `--bogus` ignored, pinned by `bin/update.test.mjs:976-981` | `bin/update.mjs:202` |
| `codex-review` | a lean home under `~/.js-harness/codex-review-homes/`; spawns `codex` | `--base X --bogus` runs a review | `bin/codex-review.mjs:232-279` |
| `remote supervise` | `~/.js-harness/remote/*`; spawns `claude` | any flag stored | `bin/remote.mjs:1214-1221` |
| `resume --hook` | pause state under `~/.js-harness/channel/pause/` | `--hook --bogus` accepted, pinned by `bin/resume.test.mjs:502` | `bin/resume.mjs:944-948` |

No shared parser exists in `bin/lib`; `check.mjs:1332-1344` (`VALUED_FLAGS`, `BARE_FLAGS`,
`refuseUnknown`) is the one explicit list. The table test spawns the dispatcher with
`JS_HARNESS_HOME`, `CLAUDE_CONFIG_DIR`, `APPDATA` and `SystemRoot` pointed into a throwaway home, as
`bin/js-harness.test.mjs:329` does, and asserts a non-zero exit and an empty home.

The push row is `checkCodexReviews` (`bin/check.mjs:1176-1202`): it hints `--base X^` for the oldest
uncovered commit `X`, without the `reviewStart`/`rangeStart` the debt row uses (`:1274-1276`,
`bin/lib/codex-review-coverage.mjs:280,311`), so after `main` is merged in its range counts `main`'s
commits. Fixtures with `main` merged in exist at `bin/check-codex-reviews.test.mjs:202-218`.

For the rows: a `doctor` row is `{ id, version, installed, claude, codex, project, upToDate, fix }`
(`bin/lib/stack.mjs:653-666`), a gap is a state in `GAP_STATES` (`bin/lib/digest.mjs:12`), and
`doctor --hook` prints one line when the gap digest changes (`bin/doctor.mjs:215-236`). The memory
folder is computed only at `bin/lib/payload.mjs:39-41` (from `cwd`, ignoring `CLAUDE_CONFIG_DIR`);
the transcript readers use `projectSlug(mainCheckout)` (`bin/lib/sessions.mjs:720`). A session's
`permissionMode` is already read (`bin/lib/sessions.mjs:551`); no code reads `crossSessionInbound`.
`check` has no helper for the lines a change adds; `hookGit` (`bin/check.mjs:281`) is where a
`git diff --cached -U0` belongs.

## Tasks
- [x] T1 (S1, first half; from rule-hierarchy T4) The five lenient commands above refuse an unknown
  flag with exit 2 before writing; one table test over every writing command. Route: inline.
- [x] T2 (S1, second half; failure 15) The push row hints the merge commit as the base after `main`
  is merged in. Route: inline.
- [x] T3 (S2; from rule-hierarchy T5) The row `citations`, INFO. Route: inline.
- [x] T4 (S3; from rule-hierarchy T6) The row `memory-rules` of `doctor`. Route: inline.
- [x] T5 (S4; from session-channel T7) The row `session-classes` of `doctor`; and the explicit
  `install` flag that writes `crossSessionInbound: "accept"`, recorded and undone by `uninstall`
  (his answer, L3). Route: inline.

## Log
- L1 — The opening of this session, by the orchestrator "JH ORQ · js-harness", 2026-10-14 (a claim,
  not his words): "From JH 7's odd/tasks/rule-hierarchy.md (read each task's full text there, and the
  design sections it points to): 1. T4 (line 1596): every command that writes outside the repository
  refuses a flag it does not know. It is the first thing a new user would meet. Do it first. 2. T5
  (line 1598): the row `citations`, INFO. 3. T6 (line 1599): the row `memory-rules` of `doctor`. From
  JH 5's odd/tasks/session-channel.md: 4. T7 (line 1131): the row `session-classes` of `doctor`, with
  the exact fix in its line (and what it says "on his word" comes to the orchestrator as a
  question)." Behind it, his request for more sessions (`ffe99ebf` line 2558) and his tap "Tres
  nuevas, 9 en total (Recomendada)" (line 2596), as the opening cites them.
- L2 — 2026-10-14 02:45 HPS: document opened from the explorer's map. No gate turn until the WSL gate
  is on `main` (`harness.json` with `"sensorsInWsl": true`); the file list of T1-T2 goes to the
  orchestrator before any edit, since `update.mjs`, `check.mjs` and `resume.mjs` belong to other
  sessions.

- L3 — His answer to S4's question, tapped, the orchestrator's transcript `ffe99ebf` line 3298
  (2026-10-14T08:05:52Z), read with `sessions --quote`: question "¿`install` tiene que traer una
  opción explícita que escriba en tu configuración de Claude Code que se acepten los mensajes entre
  sesiones (crossSessionInbound: "accept"), anotada en el manifiesto y deshecha por `uninstall`?";
  answer "Sí, con opción explícita (Recomendada)". So T5 builds the flag too. The orchestrator
  cleared T1, T4 and T5 (hunks in `update.mjs` and `resume.mjs` limited to the parser swap and the
  pinned test); T2 and T3 touch `bin/check.mjs` only after JH 8's pull request 121 (the WSL gate)
  is merged and `origin/main` is merged here.
- L4 — T1 decisions: `update` writes nothing, so it keeps ignoring unknown flags (its pinned test
  stays, retitled to name only `update`); `upgrade`, which shares its parser, refuses. A hook mode
  (`doctor --hook`, `resume --hook`) refuses too, before its fail-open part: `install` writes only
  `--hook`, so an unknown flag there means the copy on the path is older than the install, and a
  `SessionStart` hook's exit 2 shows its line without stopping the session. RED observed before the
  fixes: 9 of 32 rows of `bin/writing-flags.test.mjs` failed.

- L5 — 2026-10-14 03:37 HPS: T1, T4 and T5 built in the working tree, not committed: a code commit
  runs the gate, and no gate turn is taken before the WSL gate is on `main`. Evidence, each file run
  alone: `bin/writing-flags.test.mjs` 32/32 (RED 9 before), `bin/lib/args.test.mjs` 5/5, the new
  codex-review test RED without the fix and GREEN with it (it runs in
  `bin/codex-review.second.test.mjs`, the file's second half), `bin/lib/memory-rules.test.mjs` 5/5,
  `bin/lib/session-classes.test.mjs` 4/4, `bin/lib/manifest-settings.test.mjs` 8/8,
  `bin/install-session-messages.test.mjs` 3/3 (RED 3 before), the two new `doctor` tests RED without
  the rows; and the touched suites green: doctor 54, doctor-hook 11, tui 76, stack 123, js-harness 33,
  install 70, manifest 122, update 46, resume 77, remote 111. Not yet run whole after the last change:
  the two halves of codex-review's tests (four minutes each; a first run of the second half failed 5,
  a later run of both halves failed only the `--part-lines` case the helper then fixed: the gate's
  run settles it).
  On this machine: `memory-rules` is `stale` with 29 notes (28 `feedback`, 1 `project`; the 31 notes
  carry their type under `metadata:`, none is `user`), and `session-classes` is `mismatch` (26
  sessions of the last 7 days bypass, 1 asks; `crossSessionInbound` not set). Running the install
  flag on his machine is his, not this session's.
  Decisions: the rows put their gap in the `claude` cell, as `hook-commands` does (`stale` for a rule
  note, `mismatch` for the classes); both run in the session-start hook; both read the main
  checkout's folder, since Claude Code keeps one memory and one sessions folder per repository. The
  two classes are the host's (https://code.claude.com/docs/en/cross-session-messaging, read
  2026-10-14 through a docs reader): sessions that bypass permission prompts, and every other; only
  the user settings are read, not managed or `--settings`. The protocol "recording a new rule" that
  the `memory-rules` fix names is JH 7's skill, not shipped yet: the fix line carries its order (a
  check, else a line of `AGENTS.md`, else a protocol) until it is. `uninstall`'s result has
  `settingsRestored` and `settingsKept` only when the manifest records a setting, so the fifteen tests
  of `bin/lib/manifest.test.mjs` that compare the whole result stay as they are.

- L6 — 2026-10-14, after L5: his order "guardalas en el todo" (the orchestrator's transcript
  `ffe99ebf` line 3838, 08:44:12Z, read with `sessions --quote`; the orchestrator first cited line
  3843, an assistant entry) put the two facts of L5 in `docs/todo.md` through pull request 122, a
  documents-only branch apart from this one.
  T2 prepared without touching `bin/check.mjs`: two tests in `bin/check-codex-reviews.test.mjs`
  (a file pull request 121 does not touch). The first reproduces failure 15, RED: with a commit
  before the merge of `main` uncovered, the push row hints `<own>^`, the `main` the branch left. The
  second, GREEN already, pins the literal case of S1: with the commits before the merge covered, the
  hint is `<after>^`, which is the merge commit. The fix planned: the push row takes its base as the
  plain row does (`rangeStart` and `reviewStart`, `bin/check.mjs:1274-1276`), so the two rows name
  one review; where commits on both sides of the merge are uncovered that base is the default
  branch, since the merge commit as base would leave the earlier ones out.
  T3 prepared the same way: `bin/lib/citations.mjs` with its test, 3/3 (written in one step with its
  test, so its RED was the missing module only). Measured over every feature document, all lines
  taken as added: 1,857 citations, 190 unresolved (90 files of other repositories or removed, 100
  commits of branches never merged), which is why the row starts as INFO. Its wiring in
  `bin/check.mjs` waits for pull request 121.

- L7 — 2026-10-14 05:45 HPS: the WSL gate and pull requests 121 and 122 are on `main`, merged here
  (`573158c`). The first gate of T1 failed on three codex-review tests that pinned a seam or model
  flag as taken and dropped; they now pin it as refused before Codex starts. Committed, each through
  a whole gate in WSL2 (11 to 14 minutes waited for the lock each): T1 `f4e9e2f`; T2 and T3
  `44e8ee2` (the push row takes its base as the plain row does; the row `citations` in the static
  rows); T4 and T5's row `5561dc8`. T5's install flag, high risk (item 2, a security setting), had
  an independent verifier (opus, effort high, 25 probes in a scratch copy, 203 tests): no blocker,
  every must-hold item holds, restore byte for byte across CRLF, indent and other keys. Its two
  advisories are fixed in the flag's commit: the record is written only after the file holds the
  value, and a write that fails is `skipped` with the reason (A1); asked again, the line says the
  value it replaced and what `uninstall` gives back (A2). Their tests are GREEN; their RED was the
  module stashed whole, not a precise one.
- Tasks: T1 `f4e9e2f`, T2 and T3 `44e8ee2`, T4 `5561dc8`, T5 `5561dc8` and the flag's commit.
  Pending for each: gentle-ai's assessment of its commit and Codex's review (AGENTS.md), then the
  push and the pull request.

- L8 — 2026-10-14, afternoon. The lead's order (his words, `ffe99ebf` line 5906): finish shipping,
  then pause. gentle-ai assessed `573158c..cc65b79` as medium, review not due (`under_budget`, 1,399
  lines); `gentle-ai review assess` takes no head ref, so the four commits were assessed as one
  range. `origin/main` `c33b7bf` merged (`6aba93e`): five conflicts, the row lists (main renamed the
  row `codex-plugin` to `codex`) and `docs/todo.md` (main's text, which already records the move);
  its first gate failed one test not of this branch, `evals/suite.test.mjs:749` (a pid still alive
  in WSL2; it passes twice on Windows), sent to JH 11 by the lead; the second passed. The push row's
  new hint named `--base origin/main`, and its range `40db00f..6aba93e` held this branch's 1,372 lines
  alone: T2 seen working on its own branch. Codex reviewed it (5 parts, 905,778 input tokens, inside
  the 1,646,400 allowance): three P2 findings, all fixed in the next commit with their tests:
  citations take a line 0 or a backwards range as unresolved; a setting written and then not
  recorded is put back (file bytes restored, or the file removed when this made it); the write
  failure is injected in the test instead of a read-only mode a root user writes through.

## Next step
Codex review of the fix commit (`--base` the push row names), push, pull request, tell the lead,
then pause (his order). Older text, kept: Assess each work-unit commit with gentle-ai (`--base-ref` the last reviewed boundary,
`--committed-only`), review what is due, then `js-harness codex-review --base <boundary>` within the
rate (`--plan` first), push, open the pull request and tell the orchestrator. Older text, kept:
When `origin/main` holds the WSL gate: merge it, run the gate, commit T1, T4 and T5 as three work
units (T5 is Risk item 2, a security setting written on a flag, so it gets an independent verifier),
then gentle-ai's assessment and Codex per AGENTS.md. After JH 8's pull request 121: T2 and T3 in
`bin/check.mjs`.

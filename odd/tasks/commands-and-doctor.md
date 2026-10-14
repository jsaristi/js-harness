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
  pointers); `AGENTS.md`; the `install` flag that writes `crossSessionInbound` until he says so (S4).

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
- [ ] T1 (S1, first half; from rule-hierarchy T4) The five lenient commands above refuse an unknown
  flag with exit 2 before writing; one table test over every writing command. Route: inline.
- [ ] T2 (S1, second half; failure 15) The push row hints the merge commit as the base after `main`
  is merged in. Route: inline.
- [ ] T3 (S2; from rule-hierarchy T5) The row `citations`, INFO. Route: inline.
- [ ] T4 (S3; from rule-hierarchy T6) The row `memory-rules` of `doctor`. Route: inline.
- [ ] T5 (S4; from session-channel T7) The row `session-classes` of `doctor`; the `install` flag only
  on his word. Route: inline.

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

## Next step
Send the orchestrator the file list and the S4 question; on its clearance, T1 test first.

# F8's S9, the host watch: a session of its own reads each Claude Desktop and Claude Code release

Locator: `odd/tasks/f8-s9-host-watch.md` · Engram mirror: `odd/f8-s9-host-watch/tasks` · Branch: `worktree-f8-s9-host-watch`
Delivery: three pull requests, in order (plan and roadmap; the probe and the trigger; the first real review) · Test runner: `node --test`

## Goal
Each Claude Desktop update doctor sees turns into a session of its own that reads both changelogs and the app's tool
list, and writes the review file `doctor --host-reviewed` asks for, one row per novelty, with a Spanish page and one
recorded question per adoption.

## Why
He asked for a standing session that researches each new release in depth and says how the harness should use it
(line 33399), for a harness that serves Claude Desktop's Code tab alone, with Codex as reviewer (line 33574), and he
approved the role in question 129 (line 34781). Today the `host-update` row's steps are done inline by whichever
session sees them, and the lead once recorded an update after a check for breakage alone
(`docs/FAILURES.md`, `host-review-without-research`). The gate that refuses that exists (PR 710); nothing yet writes
the file it reads, opens the session that should, or keeps the tool list the changelogs do not document.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/f8-s9-host-watch.md` exits 0
- `node --test bin/lib/host-watch.test.mjs bin/host-watch.test.mjs bin/lib/host-update.test.mjs bin/doctor.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- `test -f docs/host-updates/claude-desktop-4.4212.0.md` exits 0
- `bin/lib/host-watch.test.mjs` holds a case that runs `hostReviewRefusal` over the committed
  `docs/host-updates/claude-desktop-4.4212.0.md` for the update 4.29.0 → 4.4212.0 and gets `null`: the gate of
  `doctor --host-reviewed` accepts the first review file
- the ROADMAP's S9 is the host watch, with his three lines quoted, and says the gentle-ai idea watch leaves with
  gentle-ai at S2
- the proposal's section 8 names `docs/host-updates/claude-desktop-<version>.md`, not `docs/host-watch/<version>.md`
- the Spanish page is published and its link is in `## Log`; one `question` notice per adoption is in the channel
- each pull request is merged into main, named in `## Log`

## In scope / Out of scope
- In: this document; `docs/ROADMAP.md` (F8's step 4 sentence on S9 and S9's section); `docs/proposals/claude-app-native-sessions.md`
  section 8 and the map rows a review touches; `bin/lib/host-watch.mjs` and its test (new); `bin/host-watch.mjs` and
  its test (new command); `bin/lib/host-update.mjs` and its test (the stale row names the session and the brief);
  the command list and help that name a new command; `docs/host-updates/` (the README, the first review file, the
  recorded tool list); the session's summary under `docs/sessions/`; one Artifact page.
- Out: `~/.claude`, `~/.codex`, credentials, gentle-ai's config — the brief forbids them; adopting anything the review
  lists — each adoption is his yes, asked through the lead; any rule change; opening a browser except to read the
  two public changelogs; the doctor cache record (`~/.js-harness/doctor.json` already holds 4.4212.0 as reviewed,
  recorded 13:12Z before the gate).

## Constraints
- Nothing installs or changes a setting from a review — because his yes in question 129 "no cubre adoptar nada sin tu sí".
- The classifier proposes, it never decides an `adopt`: only the class whose entries are outside the Code tab gets a
  default (`ignore`) — because a decision on a harness area is a reading the session owes, and the gate refuses an
  undecided row.
- The tool list is recorded per surface — because a `sessions start` session has none of the desktop's session tools
  (the proposal, section 12, step 4, checked by `ToolSearch` in JH 107), so a list read there would report them all
  removed.
- Every command handed to anyone is run first.

## Ask me before
- Nothing here is his beyond question 129's yes. Each adoption the review proposes reaches him as a recorded question
  through the lead (`js-harness notify --to orchestrator --kind question`); the work never waits on its answer.

## Specs
- S1 (his line 33399, 2026-10-30T16:58:57Z): "necesitamos en el arnes una sesion [...] que nos investigue las
  actualizaciones nuevas de todo a profundidad [...] no me dijiste con claridad como podiamos mejorar nuestro arnes a
  partir de estas mejoras a sabiendas que este arnes es solo y unicamente para claude desktop"
- S2 (his line 33574, 2026-10-30T17:03:55Z): "la idea es que este arnes funcione unicamente y exclusivamente para
  Claude Desktop y todas sus funcionalidades en conjunto con el revisor Codex"
- S3 (question 129, line 34781, answered "Sí, súmala (Recomendada)"): "el paso S9, que hoy vigila solo gentle-ai, pasa
  a vigilar Claude. Cada vez que doctor ve una versión nueva, abro una sesión que lee los dos registros de cambios y
  compara la lista de herramientas de la app con la anterior. Entrega una tabla con una fila por novedad (adoptar,
  adaptar o ignorar, con su prueba, y si se probó en Windows y en el teléfono), te la muestra en una página en español
  y te trae una pregunta por cada cosa a adoptar. [...] No cubre adoptar nada sin tu sí."
- S4 (the lead's brief `briefs/2026-10-30T19-04-31-721Z-b0e55be3.md`, items 1 to 4): the ROADMAP change; "the
  `host-update` row going stale names the session to open (title `JH <n> · host watch <version>`) and the brief it
  gets; a brief template the lead can pass to `sessions start`"; the probe, tests first, with "the tool-list diff
  against the last recorded list (where that list is recorded, and how a fresh session records it)"; one real run,
  "every row evidenced", the Spanish page, one recorded question per adoption.

## Design

**The trigger.** `hostUpdateRow` (`bin/lib/host-update.mjs`), when the row is `stale`, puts first in its fix list:
open a session of its own titled `JH <n> · host watch <desktop>` (`<n>` from `js-harness sessions --next-number`),
preferably by the app (`start_session`, on his typed turn) because only that surface lists the desktop's tools; else
`js-harness host-watch brief > <file>` and `js-harness sessions start --title "JH <n> · host watch <desktop>" --brief
<file>`. The steps that follow in the row stay as they are: they are what the watch session does.

**The brief.** `js-harness host-watch brief` prints it, filled from what doctor reads now and the reviewed record:
the span of each changelog, the file to write and its format, the tool-list step, the page, the questions, the reviews
and the report. The template is a constant in `bin/lib/host-watch.mjs`, tested to name each of those.

**The classifier.** `bin/lib/host-watch.mjs`:
- `parseChangelog(text)` reads both formats as published: the CLI's `## 2.1.314` headings with `- ` bullets, and the
  desktop's `**v4.4212.0**` headings, a date line, `**General**`/`**Code**`/`**Cowork**` sections and `* ` bullets.
  Each bullet is an entry `{ source, version, section, text }`.
- `entriesBetween(entries, from, to)`: versions after `from` up to `to`, compared as semver.
- `classify(entry)`: the first class whose pattern the text matches, in a fixed order; the harness classes first, each
  naming the proposal's map rows it touches (sessions, questions and replies, hooks, permissions, mods, remote and
  phone, artifacts, context and compaction, worktrees, messaging, skills and instructions, git and pull requests),
  then `outside` (other hosts, providers, IDEs, platforms the harness does not run on, Cowork), whose decision is
  `ignore` by default. No match: the entry is listed for hand classification.
- `draft(entries)`: `{ rows, unplaced }`, one row per placed entry with its class, map rows, evidence (source and
  version), Windows (`named` when the text names Windows, else `unknown`) and phone (`named` for mobile, phone, iOS or
  Android, else `unknown`); the Decision cell is `ignore` for `outside` and `?` otherwise, which the gate refuses until
  the session decides.
- `js-harness host-watch draft --code <file> --desktop <file> [--from-code v --to-code v --from-desktop v --to-desktop v]`
  prints the draft as the review file's markdown: the `Code tab CLI` line, the table (Change, Decision, Reason, Map
  row, Evidence, Windows, Phone) and a `## To classify by hand` list. Its spans default to the reviewed record and
  the versions doctor reads.

**The tool list.** Recorded in the project that keeps the reviews, one file per surface:
`docs/host-updates/tools-desktop.txt` (a session the app started) and `tools-background.txt` (a `claude --bg` session,
which is what `sessions start` makes). One tool name a line, sorted, under a header that names the surface, the
versions and the date; the names of the stack's own MCP servers (`mcp__engram__`, `mcp__plugin_engram_`,
`mcp__codegraph__`, `mcp__context7__`), which `stack` installs and not the host, are left out. A fresh session writes
the names it was given, loaded and deferred, one a line, to a scratch file, then runs `js-harness host-watch tools
--surface <s> --list <file>`: it prints what was added and removed against the recorded list (all added when none is
recorded) and, with `--record`, writes the new list. The review commits it with its file.

**The real run.** The first file is `docs/host-updates/claude-desktop-4.4212.0.md`, for the update the cache recorded
at 13:12Z without research: Claude Desktop 4.29.0 → 4.4212.0 (the lead's transcript, the row's change line) with its
Code tab CLI 2.1.309, plus the CLI's 2.1.309 entries, since 2.1.308 → 2.1.309 was recorded the same way. The CLI this
machine runs outside the app, 2.1.314, is not the Code tab's and stays for the review that sees the app bundle it.
This session is a `claude --bg` one, so it records `tools-background.txt`; `tools-desktop.txt` is owed to the first
watch session the app starts, and the review says so.

## Tasks
- [ ] T1 (kind: docs) this document, the ROADMAP's S9 and the proposal's section 8 reconciled; two blind readers grade
  the plan before code — S3, S4; inline; PR 1
- [ ] T2 (kind: build) the classifier and the tool-list diff, tests first — S4; inline; code commit; Codex and lenses; PR 2
- [ ] T3 (kind: build) the stale row names the session; `host-watch brief`; the command and its help, tests first — S4;
  inline; code commit; Codex and lenses; PR 2
- [ ] T4 (kind: verify) the real run: the changelogs read, the draft decided row by row, the tool list recorded, the
  acceptance test, the Spanish page, one question per adoption — S1, S3, S4; inline; docs commit; PR 3
- [ ] T5 (kind: docs) the summary, the ready and closed notices — S4

## Log
- L1 (2026-10-30, the lead's brief, as written): "S9 changes from watching gentle-ai to watching Claude; each new
  version doctor sees opens a session that reads both changelogs and diffs the app's tool list against the last one,
  delivers a table with one row per novelty (adopt, adapt or ignore, its evidence, Windows and phone checked or
  unknown), shows it on a Spanish visual page and brings one question per adoption. It does not cover adopting
  anything without his yes."
- L2 (2026-10-30): the first turn ended on "API Error: The response stopped arriving" while reading the proposal, and a
  restart ended the job; `sessions start --resume` resumed it on a new brief
  (`briefs/2026-10-30T20-15-37-604Z-6d3eb365.md`). Nothing had been written; the branch was fast-forwarded to
  `origin/main` `7392f85f`.
- L3 (2026-10-30): evidence read before the plan. `readHostVersions` on this machine: desktop 4.4212.0, staged
  4.4212.0, Code tab CLI 2.1.309; `claude --version` 2.1.314. The doctor cache: `host.reviewed` = 4.4212.0 / 2.1.309,
  at 13:12:50Z, so `doctor --host-reviewed` sees no update now and its acceptance of the first file is proven by a
  test over that file for the update it should have covered (4.29.0 → 4.4212.0, the change line in the lead's
  transcript, `grep 'Claude Desktop 4.29.0 → 4.4212.0'`). The desktop changelog is served as markdown at
  `https://claude.com/docs/cowork/claude-desktop-changelog.md` (245,784 bytes), headed `**v<version>**`, a date, then
  `**General**`, `**Code**`, `**Cowork**`; the CLI's copy `~/.claude/cache/changelog.md` uses `## <version>` and `- `.

# F8's S9, the host watch: a session of its own reads each Claude Desktop and Claude Code release

Locator: `odd/tasks/f8-s9-host-watch.md` · Engram mirror: `odd/f8-s9-host-watch/tasks` · Branch: `worktree-f8-s9-host-watch`
Delivery: four pull requests, in order (the plan and roadmap; the probe; the trigger; the first real review) · Test runner: `node --test`

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
- `node --test bin/lib/host-watch.test.mjs bin/host-watch.test.mjs bin/lib/host-update.test.mjs bin/doctor.test.mjs bin/loop.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs host-watch check docs/host-updates/claude-desktop-4.4212.0.md` exits 0: every entry of the
  frozen span (Desktop 4.29.0 → 4.4212.0, CLI 2.1.308 → 2.1.309, read from the excerpts committed under
  `docs/host-updates/sources/`) has its row, by its entry id; no row is undecided; every Windows and Phone cell is
  `checked: <how>`, `unknown` or `n/a`; the `## To classify by hand` list is empty; the file names its tool-list
  status
- `bin/lib/host-watch.test.mjs` runs `hostReviewRefusal` over the committed review file for the update
  4.29.0 / 2.1.308 → 4.4212.0 / 2.1.309 and gets `null`: the gate of `doctor --host-reviewed` accepts it
- `test -f docs/host-updates/tools-desktop.txt` exits 0, from a capture of a session the app started (the lead's, on
  request), recorded as a baseline with its provenance; or, if no app session gives one before T5 closes, the review
  file says "Desktop tool list: owed", the ROADMAP's S9 says so, and this line is marked not met in `## Log`
- `grep -c "^- Q" odd/tasks/f8-s9-host-watch.md` counts one recorded question per `adopt` or `adapt` row, each line
  naming the number the channel gave it
- `grep -n "claude.ai/artifact" odd/tasks/f8-s9-host-watch.md` finds the Spanish page, read back after publishing
- the ROADMAP's S9 is the host watch, with his three lines quoted, and says the gentle-ai idea watch leaves with
  gentle-ai at S2; the proposal's section 8 names `docs/host-updates/claude-desktop-<version>.md`; the proposal's
  map rows the review touches say so in the same PR
- each pull request is merged into main, named in `## Log`

## In scope / Out of scope
- In: this document; `docs/ROADMAP.md` (F8's step 4 sentence on S9, the order diagram, S9's section);
  `docs/proposals/claude-app-native-sessions.md` section 8 and the map rows a review touches; `bin/lib/host-watch.mjs`
  and `bin/host-watch.mjs` with their tests (new); `bin/lib/host-update.mjs` and its test (the stale row and notice
  name the session; the gate refuses an unresolved hand list); `bin/loop.mjs` and its test (the heartbeat's `HOST:`
  line); `bin/js-harness.mjs` (the command list) and the docs that list commands; `docs/host-updates/` (the README,
  the first review file, the tool lists, the span excerpts); the session's summary under `docs/sessions/`; one
  Artifact page.
- Out: `~/.claude`, `~/.codex`, credentials, gentle-ai's config — the brief forbids them; adopting anything the review
  lists — each adoption is his yes, asked through the lead; any rule change; opening a browser except to read the
  two public changelogs; the doctor cache record (`~/.js-harness/doctor.json` already holds 4.4212.0 / 2.1.309 as
  reviewed, recorded 13:12Z before the gate); the standalone CLI (2.1.314) that `claude --bg` sessions run — the
  watch follows the CLI the app bundles, as doctor reads it, and those entries are reviewed when the app bundles them.

## Constraints
- Nothing installs or changes a setting from a review — because his yes in question 129 "no cubre adoptar nada sin tu sí".
- The classifier proposes, it never decides an `adopt` or `adapt`: only an entry no harness area matches and an
  outside marker does gets a default (`ignore`), and it stays a visible row the session can change — because a
  decision on a harness area is a reading the session owes, and the gate refuses an undecided row.
- The Code tab is the scope: his line 33574 says "solo por Claude Desktop en su version Claude Code". Cowork, chat
  and third-party admin entries are read, not dropped; they default to `ignore` only when no harness area matches.
- `named` is never `checked`: a Windows or Phone cell says `checked: <how>` only for what this session ran or saw.
- The tool list is recorded per surface, and a first capture is a baseline, never "all added" — because a `sessions
  start` session has none of the desktop's session tools (the proposal, section 12, step 4), and a missing capture
  is no evidence of a removal.
- A removal from the tool list is claimed only after `ToolSearch` with `select:<name>` finds nothing — because the
  list is transcribed by the model, which the docs describe as a conversational summary, not an export.
- Every command handed to anyone is run first, the fallback `sessions start` included, with the effort and worktree
  the guard asks for.

## Ask me before
- Nothing here is his beyond question 129's yes. Each adoption the review proposes reaches him as a recorded question
  through the lead (`js-harness notify --to orchestrator --kind question`); the work never waits on its answer.

## Specs
- S1 (his line 33399, 2026-10-30T16:58:57Z): "necesitamos en el arnes una sesion [...] que nos investigue las
  actualizaciones nuevas de todo a profundidad [...] no me dijiste con claridad como podiamos mejorar nuestro arnes a
  partir de estas mejoras a sabiendas que este arnes es solo y unicamente para claude desktop"
- S2 (his line 33574, 2026-10-30T17:03:55Z): "la idea es que este arnes funcione unicamente y exclusivamente para
  Claude Desktop y todas sus funcionalidades en conjunto con el revisor Codex [...] acabo de decidirme completamente
  solo por Claude Desktop en su version Claude Code"
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

Revised after two blind readers (L4): both graded the first plan 5 of 10.

**The trigger.** Three places, one wording, built by one function in `bin/lib/host-watch.mjs`:
- `loop heartbeat` reads the host versions and the reviewed record every hour (as it reads the daily Windows run)
  and, on an update with no host watch session for it, ends with one line: `HOST: Claude Desktop <a> → <b> ...: open
  JH <n> · host watch <b>` and the two ways to open it. This is what wakes the lead's model: the SessionStart notice
  is a `systemMessage` no model reads (`bin/doctor.mjs:507-516`). A session counts as opened for that version when
  the background record or the channel holds a session titled `host watch <b>`; until then each heartbeat run says it
  again, so a launch that failed comes back.
- `hostUpdateRow`'s stale fix list starts with the same line and says that the steps after it are the watch
  session's: any other session tells the lead and records no review.
- `hostNotice` adds that a host watch session reviews it, so he sees it too.

The two ways: on his typed turn, `start_session` (fresh, its own worktree, effort high, title `JH <n> · host watch
<b>`), the only surface that sees the desktop's tools; otherwise `js-harness host-watch brief > <file>` and `js-harness
sessions start --title "JH <n> · host watch <b>" --brief <file> --worktree host-watch-<b> --effort high`. `<n>` is
`js-harness sessions --next-number`. A test renders the command and passes it through the guards `sessions start`
applies (title and effort).

**The brief.** `js-harness host-watch brief` prints it from what doctor reads now and the reviewed record: the frozen
spans; the steps (`draft`, reading every entry, deciding each row with the map row it touches, the tool list, the
`plugin-authoring` types when their build moves, the map updated in the same PR, `check`, the page, one question per
`adopt` or `adapt`, Codex and lens reviews, the PR); that a second update landing before the PR merges extends the
review to the newer version (the file is the newer version's, its span from the same reviewed record); that the
review is recorded with `doctor --host-reviewed` from the main checkout only after the PR lands; how it reports.
The template is a constant, tested to name each step.

**The classifier.** `bin/lib/host-watch.mjs`:
- `parseChangelog(text, source)` reads both formats as published: the CLI's `## 2.1.314` headings with `- ` bullets
  and their `[VSCode]` or `Windows:` prefixes; the desktop's `**v4.4212.0**` heading (anything after the version on
  the line ignored), a date line, a `Bundled Claude Code version:` line, any other bold line as a section (General,
  Code, Cowork and 3P today) and `* ` bullets. An indented line joins the bullet above. Each bullet is an entry
  `{ id, source, version, section, text }`, `id` = `<source> <version> #<n>`.
- `entriesBetween(entries, from, to)`: versions after `from` up to `to`, as semver; refused when the changelog's top
  version is below `to` (the copy is older than the version reviewed); a version in the span with no entry, and an
  empty span, give a row "no changelog entry for <version>" decided `ignore`, as the row's fix already asks.
- `classify(entry)`: every harness area whose pattern matches (sessions, questions and replies, hooks, permissions,
  mods and plugins, remote and phone, artifacts, context and compaction, worktrees and git, messaging, skills and
  instructions), each naming the proposal's map rows it touches; no area and an outside marker (another surface:
  `[VSCode]`, JetBrains, `[Cloud sessions]`, `[Claude Tag]`, Slack; a provider: Bedrock, Vertex, Foundry, gateway; a
  platform the harness does not run on: macOS, Linux, GNOME; the Cowork or 3P section) gives `outside`; neither gives
  unplaced.
- `draft(entries)`: one row per entry, unplaced ones included with Decision `?` and their id in the hand list, so
  nothing is outside the table. Cells: Change (the entry's text, `|` escaped), Decision (`ignore` for `outside` and
  for no-entry rows, `?` otherwise), Reason (the class and why), Map row, Evidence (the entry id), Windows and Phone
  (`unknown`, noting "named" when the text names it), then `## To classify by hand` and `## Sources` with both
  changelog URLs and spans.
- `check(text, entries)`: each entry id has exactly one row; no `?`; the cells as the Done-when line says; the hand
  list empty; a `Desktop tool list:` line (`baseline`, `diff` or `owed`). The command `js-harness host-watch check
  <file>` reads the excerpts beside it (`docs/host-updates/sources/claude-desktop-<v>.desktop.md` and `.code.md`),
  which the review commits so the check needs no network.
- The gate (`reviewFileGaps`) also refuses a non-empty `## To classify by hand` list: Codex's in-memory probe showed
  one decided row plus an unresolved list passing it.

**The tool list.** `docs/host-updates/tools-<surface>.txt`, surfaces `desktop` (a session the app started) and
`background` (`claude --bg`, what `sessions start` makes); one name a line, sorted, under a header with the surface,
the versions, the date and the provenance ("transcribed by the model from its tool definitions and deferred-tool
list"). `js-harness host-watch tools --surface <s> --list <file> [--record]`:
- keeps the host's names: every name without `mcp__`, and the `mcp__` names of the host's own servers
  (`claude-in-chrome`, `Claude_Browser`, `computer-use`, `remote-devices`, and any `ccd` one); the other servers'
  names are counted and their server names printed, so a new host server is seen and the list amended;
- refuses `--surface desktop` for a list without `start_session`, and `background` for one with it;
- with no recorded list, says "baseline" and records it with `--record`; otherwise prints what was added and removed,
  and each removed name is confirmed with `ToolSearch` `select:<name>` before the review claims it.
Schemas are out of scope: names only; a parameter change reaches the review through the changelog or not at all, and
the review says so.

**The real run.** Spans frozen: Claude Desktop 4.29.0 → 4.4212.0 (the update the cache recorded at 13:12Z without
research, the change line in the lead's transcript) and the bundled CLI 2.1.308 → 2.1.309 (recorded the same way;
both desktop releases bundle 2.1.309). The excerpts are cut from the published desktop changelog markdown and the
CLI's copy. The desktop tool list: the lead is asked (a `note`) to transcribe its own tool names to a file; this
session records `tools-background.txt` from its own list either way.

## Tasks
- [ ] T1 (kind: docs) this document, the ROADMAP's S9 and the proposal's section 8 reconciled; two blind readers grade
  the plan before code, and the plan is revised on their findings — S3, S4; inline; PR 1
- [ ] T2 (kind: build) `bin/lib/host-watch.mjs`: parse, span, classify, draft, check, the tool-list diff; the gate's
  hand-list refusal; tests first — S4; inline; code commit; Codex and lenses; PR 2
- [ ] T3 (kind: build) `bin/host-watch.mjs` (`draft`, `check`, `tools`, `brief`) and the command list; tests first —
  S4; inline; code commit; Codex and lenses; PR 2
- [ ] T4 (kind: build) the trigger: the stale row, the notice and the heartbeat's `HOST:` line; the rendered fallback
  command through the guards; tests first — S4; inline; code commit; Codex and lenses; PR 3
- [ ] T5 (kind: verify) the real run: the excerpts, the draft decided row by row, the tool lists, `check`, the
  acceptance test, the map rows, the Spanish page, one question per `adopt` or `adapt` — S1, S3, S4; inline; docs
  commit, and the acceptance test as a reviewed code commit; PR 4
- [ ] T6 (kind: docs) the summary, the ready and closed notices — S4

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
  `https://claude.com/docs/cowork/claude-desktop-changelog.md` (245,784 bytes), headed `**v<version>**`, a date, a
  `Bundled Claude Code version:` line, then `**General**`, `**Code**`, `**Cowork**` and `**3P**`; the CLI's copy
  `~/.claude/cache/changelog.md` uses `## <version>` and `- `, with prefixes such as `[VSCode]` and `Windows:`.
  4.4212.0 has 33 entries; the CLI's 2.1.309 has 79.
- L4 (2026-10-30): two blind readers graded the plan at `6de916b7`, both 5 of 10. Claude (general-purpose agent,
  76k tokens): the trigger reaches no model, since the SessionStart notice is a `systemMessage`
  (`bin/doctor.mjs:507-516`, checked); a `--bg` session cannot capture the desktop tools; nothing proved one row per
  novelty; versions with no entry exist in the CLI's copy; any bold line is a section; `|` breaks the table; the
  draft lacked `## Sources`; first capture as baseline; dedup of the watch session; a second update in flight.
  Codex (`codex exec -s read-only`, PATH without WindowsApps since the Store PowerShell cannot start in its sandbox,
  `bin/codex-review.mjs:417`; the first try failed on that and was stopped): an unresolved hand list beside one
  decided row passes `reviewFileGaps` (its in-memory probe returned `[]`); the desktop capture must come before T4
  closes; tool transcription is unproven, so removals need confirmation; the fallback `sessions start` without
  `--effort` is refused by the effort guard (`bin/sessions-background.mjs:145-149`, checked); the 3P section; multiple
  area tags; `named` is not `checked`; the span frozen (Desktop (4.29.0, 4.4212.0], CLI (2.1.308, 2.1.309]), since
  defaults from the cache give an empty one. Every finding is taken into the Design above, except Codex's challenge
  to the Code-tab scope: his own words at line 33574, "solo por Claude Desktop en su version Claude Code", settle it,
  now quoted in S2, and Cowork rows stay visible.
- L5 (2026-10-30): PR 716 (T1, docs) merged as `0c190b7c`. On branch `f8-s9-probe` (stacked on it, same worktree):
  `9a173984` (lib, gate) and `dad0db39` (command, README, SPEC). Running the command on the lead's real desktop list
  (`~/.js-harness/research/host-watch/tools-desktop-lead.txt`, 52 loaded + 149 deferred) showed the app names it
  `mcp__ccd_session__start_session` and ships servers `terminal`, `visualize`, `scheduled-tasks`, `mcp-registry`: fixed
  in `dad0db39`. Reviews of `16834f52..dad0db39`: Claude lenses reliability, readability, risk: 0 findings (~184k
  input); Codex 3 parts, 335k input: three P2 findings, all real — `check` must match each span's end to the version
  the review names (title, `Code tab CLI:`); a declared source with a malformed range must be a gap, not skipped; a
  target with no heading loses its boundary in `cutSpan`, so `check` rejects its own draft's excerpt (keep the next
  newer heading line). gentle-ai review started by its `granted` choice, lineage `review-4991b18b1d344d43`, waiting
  for a `review-reliability` reviewer result (`gentle-ai review status ... --next-transition` gives the capture).
  Also found: the published CLI page escapes prefixes (`\[Cloud sessions]`), so entry text must be unescaped; its
  2.1.309 block has 79 bullets, as the cache copy.
- L6 (2026-10-30, T5 reading so far): Desktop 4.4212.0's 33 entries hold nothing to adopt (SSH, Cowork, 3P admin
  settings, chat fixes); CLI 2.1.309's candidates checked: transcripts `jq` could not parse — the harness readers
  already skip a bad line (`bin/lib/sessions.mjs:76-82`, `bin/audit.mjs:35-39`, `bin/lib/audit.mjs:118-124`,
  `bin/subagents.mjs:42-46`), so ignore; the bypass `rm` prompt now denied with a hint bears on map row 1 (fewer cards).
- L7 (2026-10-30, after the host compacted the session at its pause): Codex's three findings fixed in `c0d15661`;
  lenses reliability, risk over `c2a21b9e..c0d15661`: 0 findings; Codex over `c2a21b9..fa2c829`: all four fixed,
  verdict correct (0.96), recorded (its first run wrote no record: the document was edited while it read). PR 717
  opened as a draft. gentle-ai: lineage `review-4991b18b1d344d43` (reliability over `dad0db39`'s tree) approved and
  acknowledged, with four non-blocking warnings, all real and fixed in the next commit, tests first: a side whose
  version did not move drafted a false "no changelog entry" row (R3-001); draft with no reviewed record failed with
  "undefined" (R3-002); check let a named CLI drop its span and accepted rows no span names (R3-003); tools took any
  read failure of the recorded list for a first capture (R3-004).
- gentle-ai: `dad0db39` approved (review-4991b18b1d344d43, reliability).
- L8 (2026-10-30): the fix is `98d4c7cb`; Codex over `fa2c829..98d4c7c` correct (0.9), lenses 0 findings but one
  reliability warning, real: `check` reads the spans the file writes, so "(X to X)" at the version read skips every
  entry. Only `doctor --host-reviewed` knows the version last reviewed, so its gate now asks each moved changelog for
  the span from that version (`60bddd22`). `f3274d4c` renames comments that named gentle-ai, which
  `bin/lib/gentle-ai-absence.test.mjs` refuses under `bin`; two commits had entered with it because the pre-commit
  with tests on CI failed and a hand `npm run check` of the same code, without them, then passed as `same`
  (gate-log 309-317): told to the lead, not fixed here. Codex over `98d4c7c..f3274d4` correct (0.92); lenses 0.
- L9 (2026-10-30): PR 717 has no PR checks by design (`.github/workflows/gate.yml` runs only for `gate/` and `queue/`
  pushes); its last code commit passed the gate on CI (gate-log 318). Out of draft, `ready` sent. T4 on branch
  `f8-s9-trigger`, stacked on `f8-s9-probe`: `watchTitle`, `watchOpened`, `watchLine`, `renderBrief` in the lib;
  `host-watch brief` and `hostWatchTick` in the command; `loop heartbeat` reads it every hour (`HOST_MINUTES`) and
  ends with the `HOST:` line; the row's first step and the notice say the review is the host watch session's. Run on
  this machine: `host-watch brief` exits 1 (no update: the record is 4.4212.0/2.1.309); with the record faked at
  4.29.0/2.1.308 it prints "# JH 111 · host watch 4.4212.0", the number `sessions --next-number` gives. Known limit:
  an update of the CLI alone after a desktop version's review is titled with the same desktop version, so the earlier
  session's title counts as opened; rare (the CLI ships inside the app), written here rather than built.
  The first commit of T4 failed the gate on CI (run 41132256606): `bin/lib/rules-sources.test.mjs` took the lib for a
  producer of hook messages because a comment named `systemMessage`; reworded. Open, for the lead: the brief
  `renderBrief` builds is a text the harness sends an agent, and the directive-coverage register (F8 S5c,
  `bin/lib/rules-coverage-data.mjs`) does not list it; declaring it is S5c's register work, not done here.
- L10 (2026-10-30): T4 is `34562cc4` (gate on CI, 171 s). Lenses reliability, risk, readability: 0 findings. Codex
  (0.97 incorrect): three P2, all real, fixed next with their tests: the brief's folder may not exist on a fresh
  machine, so the tick creates it; a heartbeat under another home handed commands that read the default one, so
  both carry `--home`; a session that only read the channel was not counted, so readings' titles count. Checked:
  `js-harness sessions start --home <tmp> --title "JH 120 · host watch 4.5000.0" --brief <missing> --worktree
  host-watch-4-5000-0 --effort high` parses and stops at the brief (exit 2), nothing written. Correction to L6: no
  entry of the span names a bypass `rm` prompt (searched the draft's 113 rows for rm, bypass, deny, hint).

- L11 (2026-10-30): Codex over `34562cc..56c82c7` correct (0.98), the three fixed; lenses reliability, risk 0. T4
  is reviewed: `34562cc4`, `56c82c71` on `f8-s9-trigger`.

## Next step
1. Push `f8-s9-trigger`; open PR 3 (base `f8-s9-probe` while PR 717 is open, else main); `ready` notice.
2. T5, the real run, on a branch `f8-s9-review` from `f8-s9-trigger`: the draft is
   `node bin/js-harness.mjs host-watch draft --desktop <desktop.md> --code <code.md> --from-desktop 4.29.0
   --to-desktop 4.4212.0 --from-code 2.1.308 --to-code 2.1.309 --sources docs/host-updates/sources` over the
   published pages (`https://claude.com/docs/cowork/claude-desktop-changelog.md`,
   `https://code.claude.com/docs/en/changelog.md`): 113 rows, 56 to decide, 13 by hand. Decided so far: no adopt;
   one candidate adapt, desktop 4.4212.0 #24 `sessionStatusLine` (a line above the Code tab's message box printed by
   a program the app runs; on Windows it must sit in Program Files, set by managed settings: admin, outside the
   per-user undo), which brings one question; desktop #28 (`desktopHome`, breaking Nov 10) ignore: "Code is not
   affected" (desktop changelog, the `desktopHome` entry of its beta); code #49 (PowerShell hooks failing open)
   ignore: checked, no harness hook in `~/.claude/settings.json` sets `shell`; code #33 ignore (L6). Every other
   row: a host fix that needs no harness change.
3. Then `tools-background.txt` from this session's own list, `tools-desktop.txt` from the lead's
   (`~/.js-harness/research/host-watch/tools-desktop-lead.txt`, `--record`), `host-watch check` exit 0, the map
   rows of the proposal, the Spanish page, one `notify --kind question` for #24, PR 4; T6.

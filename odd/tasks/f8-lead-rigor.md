# Lead rigor: three checks on the lead's mistakes

Locator: `odd/tasks/f8-lead-rigor.md` · Engram mirror: `odd/f8-lead-rigor/tasks` · Branch: `worktree-f8-lead-rigor`
Delivery: pull requests, one per check, in the order S3, S2, S1 · Test runner: `node --test`

## Goal
Three mistakes the lead made on 2026-10-30 are caught by a command: a shell command handed in a reply that is not
for his shell or was never run is turned back so the lead corrects it in its next words; a host update cannot be
recorded as reviewed without its research; and every such mistake is counted, so he sees each week whether they go
down.

## Why
He said the lead rushes and hands him commands that fail at the first try, and asked how the harness becomes more
demanding (S0). The rules already said to run a command before handing it (`command-handed-untested`, owed) and to
report what an update brings (the host-update row's fix list), and nothing made either act: a line without a check.
The reply check cannot unsay a reply already shown (`bin/reply.mjs:3-5`): it makes the lead tell him, in its next
words, not to run the block and give the corrected one. Doctor's gate does prevent: it refuses before it writes.

## Done when
- `node --test bin/lib/reply.test.mjs bin/reply.test.mjs bin/lib/reply-commands.test.mjs bin/lib/host-update.test.mjs bin/doctor.test.mjs bin/lib/failures.test.mjs bin/failures.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-lead-rigor.md` exits 0
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs failures weeks` exits 0
- `npm run check` exits 0
- each check has a planted case of today's mistake that turns its test red on main, named in `## Log`
- every code slice has a Codex review and a lens review recorded; the contract closes once its pull requests are on
  main (a human item: no command proves a merge before it happens)

## In scope / Out of scope
- In: `bin/lib/reply.mjs`, `bin/reply.mjs`, a new `bin/lib/reply-commands.mjs`, `bin/lib/host-update.mjs`,
  `bin/doctor.mjs`, `bin/failures.mjs`, `bin/lib/failures.mjs`, their tests; `docs/FAILURES.md`; a new
  `docs/host-updates/` (the review files' home and format); the help and docs that name these commands; this
  document; the session's summary under `docs/sessions/`.
- Out: `harness.json` (no new key: an older install refuses one and turns the whole reply check off,
  `bin/lib/reply.mjs:50-51`); `~/.claude`, `~/.codex`, credentials and gentle-ai config (read only, transcripts
  included); JH 105's files on `docs/claude-app-native` (read, never edited); the role that writes a host review (JH
  105's proposal); anything that opens a browser; the Stop hook's timeout (an installer change).

## Constraints
- A false refusal of the Stop hook costs every session a rewritten close, so each refusal is tested on a real
  transcript excerpt and so is the pass, on win32 and on linux, and the final check is replayed over the lead's
  replies of transcript 0f71b2c6 before its PR, with the count of refusals written here — because the hook runs in
  every session.
- The hook turns a stop back once (`stop_hook_active`), never twice: a refusal cannot lock a session.
- The hook keeps its 5 seconds (an installer value): the command part has one deadline, 4 s from the hook's start,
  and the parser gets what is left of it — because a hook the host kills loses the close check too.
- A command block is never let through unchecked: a parser that cannot run in time refuses the block, saying so.

## Ask me before
- A new rule or a change of an owner's rule: only with his words (lines 33664 and 33700), on a `rule/` branch.

## Specs
- S0 (his words, transcript 0f71b2c6, line 33664, 2026-10-30T17:07Z): "La verdad necesito mas de este arnes, como
  hacemos de que todo se vuelva mas exigente y por ende tambien mayor calidad y conocimiento? siento que tratas es de
  solucionar a las carreras y mal por que siempre que me das un comando me envias a la primera algo mal o no
  investigas bien y si eso es lo que veo como sera lo que haces y no puedo ver por detras?"
- S0b (his answer to question 126, line 33700, 2026-10-30T17:12Z, tapped): "Sí, ábrela (Recomendada)", to: "(1) el
  chequeo de cierre de respuesta rechaza un bloque de comando que no corrí antes en una copia de prueba o que no está
  en PowerShell; (2) doctor no deja marcar revisada una actualización sin la tabla de novedades (adoptar, adaptar o
  ignorar); (3) cada error mío queda contado en docs/FAILURES.md y un informe semanal te muestra si bajan."
- S0c (his words, line 33399, 2026-10-30T16:58Z): "te pedi que investigaras lo nuevo de esta version de claude
  desktop y no me dijiste con claridad como podiamos mejorar nuestro arnes a partir de estas mejoras"
- S1 (the lead's brief `briefs/2026-10-30T17-14-59-363Z-5d8fbd5b.md`, item 1): "a reply that hands him a shell command
  in a fenced block is refused when the block is not tagged for his platform's shell (PowerShell on win32), or when
  the same command text was not run by the session earlier in the transcript with exit 0 (in a scratch copy when it
  changes anything). Design how "was run" is read from the transcript; a command that only he can run (his
  credentials, his settings) says so in the block's caption and is checked for syntax instead (e.g. PowerShell's
  parser), never left unchecked."
- S2 (same, item 2): "`--host-reviewed` is refused unless a review file for that host version exists with a table of
  what the update brings, each row adopt, adapt or ignore with its reason, and the sources read. [...] build only the
  gate and its file format here, and do not edit its files."
- S3 (same, item 3): "add the two missing `- Seen:` lines above to docs/FAILURES.md (the five-part form of CLAUDE.md
  "Reporting"), and a weekly view (amend `js-harness throughput` or `report` before adding a command: search first)
  that shows the lead's mistakes per week from FAILURES.md so he sees whether they go down."
- S3b (the lead's note to this session, 2026-10-30 17:20Z, the lead's claim): "one more mistake for your FAILURES Seen
  lines [...]: merge-queue --land picked up PR 596, marked ready while his console walk was pending [...]. Also count:
  the lead guessed notify flags twice before reading its usage."

## Tasks
- [x] T1 (kind: design) this document; two blind readers on the plan before code (L5)
- [x] T2 (kind: build) S3 — the Seen lines, and `failures weeks`; test first; Codex and lenses; PR 1 (L7, L8)
- [x] T3 (kind: build) S2 — the host review file and the `--host-reviewed` gate; test first; Codex and lenses; PR 2 (L9)
- [ ] T4 (kind: build) S1 — command blocks in the reply check; test first on real excerpts; the replay; Codex and
  lenses; PR 3
- [ ] T5 (kind: verify) `npm run check`, ready notices, summary
- [ ] T6 (kind: docs) F4 of `docs/audits/2026-10-30-cleanup-inventory.md`, by the lead's note (L6): the six failures
  not settled. `two-blocks-out-of-order` done in PR 1 (its line moved to CLAUDE.md); the five others need a control
  that holds, each a finding of its own: read after T4, and what each needs is reported to the lead

## Design

### Searched first
- The reply check exists (`bin/lib/reply.mjs`, `bin/reply.mjs`, the Stop hook): S1 adds one more refusal in a module
  of its own (`bin/lib/reply-commands.mjs`), as the wake and stale-board checks are, so the close check stays as is.
- `doctor --host-reviewed` exists (`recordHostReview`, `bin/doctor.mjs:453`): S2 adds a refusal before its write.
- The weekly view: `js-harness failures` already reads `docs/FAILURES.md` (`parseRegister`, `bin/lib/failures.mjs`)
  and counts sightings by class; `throughput` measures reviews and gates, `report` builds pages of a feature. The
  view is a `failures weeks` subcommand: the register's reader, not a second one. `weeks` is reserved in
  `parseArgs` (`bin/failures.mjs:115`), which reads any other word as an entry id.
- `command-handed-untested` (FAILURES.md) is the entry the shell mistake belongs to; its control is owed to
  `odd/tasks/instruction-homes.md` and becomes S1's check. `js-harness rules` holds `terminal-note` (a command typed
  into his Terminal panel ends with a note, `bin/lib/guard.mjs`): another channel, left as is; a `Write-Host` or
  `echo` command of a block needs no run.
- No rule is added: S1 to S3 are checks of controls the register already owes, and no value of his is new.

### S1: command blocks in the reply
Which blocks. A fenced block is a command block when its info string's first word is a shell (`bash`, `sh`, `zsh`,
`shell`, `console`, `fish`, `powershell`, `pwsh`, `ps1`, `cmd`, `bat`), or when it has no info string (or `text`,
`txt`, `plaintext`) and its first command line starts with a known program, exact case, followed by a space or the
end (`git`, `gh`, `npm`, `npx`, `pnpm`, `node`, `js-harness`, `claude`, `codex`, `rm`, `cd`, `Remove-Item`, ... one
constant list). When a line of a block starts with a prompt mark (`$ `, `PS>`, `PS C:\…>`), only the marked lines
are commands and the rest is output. Comments, blank lines, `Write-Host` and `echo` commands are no commands.

The info string's second word says what the block is, in a word the check reads and the rendered reply hides, so no
`harness.json` key is needed and the caption above stays in his words:
- `ran`: evidence, what the session ran, shown with any shell tag. Each command must match a run of the session,
  whatever its exit: an evidence block says what happened, a failure included.
- `own`: his to run (his credentials, his settings), tagged for his shell. Its text goes to the shell's checker
  instead of a run: on win32 PowerShell's parser plus, for each command it resolves to a cmdlet or function, that
  every named parameter binds (resolved with `Get-Command <name> -ArgumentList <its first argument>` so a provider's
  dynamic parameters count; an alias by its `Definition`; anything unresolved is a native program and skipped); on
  other platforms `bash -n`.
- none: handed to him to run. It must be tagged for his shell, and each command must match a run that succeeded;
  on win32 the parser check of `own` also runs on it, since a Bash run does not prove PowerShell's reading.

His shell is his platform's: on win32 `powershell`, `pwsh` or `ps1` (he runs pwsh 7: his error read "Remove-Item:
…", 7's form; 5.1 prints "Remove-Item :"); elsewhere `bash`, `sh`, `zsh`, `shell` or `console`. A session in WSL or
in the cloud is read as its own platform: a known limit, written in the refusal's text.

What a run is. A `Bash` or `PowerShell` tool call of the transcript, not a side chain, whose result is not an error,
not interrupted and not moved to the background (`is_error`, `toolUseResult.interrupted`, `backgroundTaskId`). Its
command is split at the top level (quotes and brackets kept) at `&&`, `||`, `;`, `|` and newlines into simple
commands. A simple command proves it succeeded when what follows it is `&&` or the end, and what precedes it is not
`||`: `X || true`, `X; exit 0` and `X | head` prove nothing of `X`. A simple command that runs `pwsh` or
`powershell(.exe)` with `-Command`/`-c` adds the commands of its argument, split as PowerShell, proving what it
proves. A handed command matches a simple command when their words are equal, quotes taken off and redirections
(`2>&1`, `>/dev/null`, `>$null`) dropped: `rm -rf /d/x` does not match `rm -rf /d/x/tmp`, and `codex` matches only
`codex`. The commands of one block may come from different runs.

"In a scratch copy when it changes anything" is the lead's way of running it; the check cannot see which folder a
run used, and does not judge it. A command that cannot run safely with the same text (an absolute path of his) is
his: `own`, and the parser checks it.

Budget. The transcript is read only when the reply holds a command block, once (the wake check shares the read), and
scanned by the `"name":"Bash"`/`"name":"PowerShell"` occurrences; a result is looked up only for a run that matches.
Every block of a reply goes to one parser spawn (`pwsh.exe`, else `powershell.exe`), with the time left before the
deadline; a spawn that cannot finish in it refuses the blocks, saying the check could not run.

The refusal names each block by its first line and why, and says: tell him in plain words not to run the block above,
and give the corrected one, run first. It joins the close check's reason in one block, as the wake check's does.

Known limits, written in the help: a command handed inline (`` `rm -rf x` ``) or in a question's text is not read; an
`own` block is a claim the parser cannot test beyond syntax and parameters (the pnpm config write of
`command-handed-untested` would parse); the block is already on his screen when the hook turns the stop back.

Real excerpts for the tests (lead transcript 0f71b2c6, trimmed to the fields read): the refusal at line 32954 (the
reply with a `bash` block `rm -rf /d/js-harness-worktrees`, after the runs of lines 32882 to 32895 the guard
refused), and at line 30024 (a `bash` block `cd D:\js-harness; codex`, his settings); the pass, a successful run of
the same transcript handed in a `powershell` block, and an evidence block `bash ran`; each under `platform: 'win32'`
and `'linux'`. The parser itself is stubbed in unit tests and run for real in one test that skips where no
PowerShell is found.

### S2: the host review file
`doctor --host-reviewed` records only when `docs/host-updates/claude-desktop-<desktop>.md` exists in the project
doctor runs in (its git root) and holds:
- a line `Code tab CLI: <code>` naming the CLI version read now, when one is read;
- a table whose header has the columns `Change`, `Decision` and `Reason`, one row at least, each `Decision` one of
  `adopt`, `adapt` or `ignore` and each `Reason` not empty (a version with no changelog entry is a row that says so);
- a `## Sources` section whose list holds the changelog the fix list names for each part that changed (the desktop
  changelog when the desktop changed, the Code changelog when the CLI changed), and may hold more.
Otherwise it records nothing, exits 1 and names the file and what it lacks. With nothing changed since the last
review (no record yet, or the same versions) it records as today, with no file. The review record is per machine and
the file is per project: run from a project with no `docs/host-updates/`, the refusal says the review is recorded
from the project that keeps the reviews. The host-update row's fix list names the file to write, before its last
step. `--stack-reviewed` is unchanged. The research that fills the file is JH 105's proposal.

### S3: the count
- `docs/FAILURES.md`: a `- Seen:` line in `command-handed-untested` for line 32954; a new entry
  `host-review-without-research` for line 29697 (`--host-reviewed` after a breakage check only; his words at line
  33399); the two of S3b, as the lead's claims. The register's existing marker for the lead's own mistake, "the
  lead's own" in a Seen line's evidence (as at its first entry), is written on each, and its header says so.
- `js-harness failures weeks`: one line a week (ISO weeks, Monday first; `now` injected for tests) from the first
  sighting to this week: every sighting recorded, those marked the lead's own, and the count by class. Its last line
  says what it counts: what was recorded, and the marker only where it was written (since 2026-10-13 at the
  earliest), so the lead's column of the early weeks is a floor. Read-only.

## Log
- L1 (his request, line 33664, and his answer to question 126, line 33700): quoted in S0 and S0b.
- L2 (2026-10-30, design): no rule added; the weekly view is `failures weeks`; the review file lives in the project's
  `docs/host-updates/`.
- L3 (2026-10-30, the lead's note 17:20Z): two more mistakes to count (S3b); whether a check fits the merge-queue one
  is decided in T2.
- L4 (2026-10-30, measured): a PowerShell script that parses a block and checks each named parameter of the commands
  it resolves prints "rm has no parameter -rf" for `rm -rf /d/js-harness-worktrees` and nothing for
  `Remove-Item -Recurse -Force D:\js-harness-worktrees`, once an alias is resolved by its `Definition`
  (`ResolvedCommand` is empty under `-NoProfile`). One spawn took 0.8 to 2.5 s under `pwsh.exe` and under
  `powershell.exe`. In this worktree-isolated session the guard refused `powershell.exe` typed in the Bash tool; the
  lead's transcript holds Bash runs of PowerShell commands (line 31xxx, a `Get-CimInstance` error), so the lead's
  checkout runs them.
- L5 (2026-10-30, two blind readers on the plan, before code): both found S1's design wrong in the same places, and
  the design above takes their fixes: a Bash run does not prove a `powershell` block (`rm -rf` succeeds in Git Bash
  and fails in his pwsh), so the parser runs on every block handed on win32; a substring match lets `X || true` and
  `rm -rf /d/x/tmp` prove `X` and `rm -rf /d/x`, so matching is word-equal on simple commands that prove success;
  evidence blocks (`ran`) would have been refused on win32; a new `harness.json` key turns the reply check off on an
  older install, so the markers are words of the info string; one deadline for the hook; the Goal said S1 stops the
  block before he sees it, which a Stop hook cannot. S2: the record is per machine and the file per project, said in
  the refusal; Sources must hold the changelogs; no file asked when nothing changed. S3: "the lead's" at the start of
  evidence often names the lead as the source of another session's mistake; the register's marker is "the lead's
  own". Order S3, S2, S1 kept; S1's run matching ships only after the replay.
- L6 (2026-10-30 12:34 local, the lead's note to this session): "your check 1 may be T8 [of
  odd/tasks/instruction-homes.md]; amend that task instead of a second one. Also take F4 of
  docs/audits/2026-10-30-cleanup-inventory.md". T8 is amended to name T4 here as its carrier; F4 is T6.
- L7 (2026-10-30, T2): RED: `weeklyCounts` did not exist and `failures weeks` read `weeks` as an entry id (exit 1);
  GREEN after (`node --test bin/lib/failures.test.mjs bin/failures.test.mjs`, 109 pass). The planted case is the
  sighting of line 32954 itself: `failures weeks` prints it in the week of 2026-10-26 as the lead's own (7 of 38).
  The merge-queue mistake (S3b) gets no check here: the land took a pull request that was open as ready, which is
  its rule; the mistake was the land run while a step of his was pending, recorded `land-took-pending-pr`.
- L8 (2026-10-30, T2 reviews): Codex on `9b6c8ae..c90d1fb` (105,086 input tokens) found one P2, a default clock in
  `weeklyCounts`, fixed in `6f6d4ae2`; Codex on `c90d1fb..6f6d4ae` (40,354) found it fixed and nothing else. The
  lenses readability and reliability on the first range, and reliability on the fix: 0 findings. gentle-ai: its
  Stop hook offered the whole branch (base `72b0a6aa`), which is no candidate here; its read-only status ended in
  `operation_timeout` and nothing was started, so T2's commits are not reviewed by gentle-ai.
- L9 (2026-10-30, T3): RED: on main the bare `--host-reviewed` recorded the update (`bin/doctor.test.mjs`, "a refused
  review records nothing"); GREEN in `919e0fe8`. Codex on `653c171..919e0fe` (144,163 tokens): two P2 (an escaped
  pipe split a row; a table with no delimiter row), fixed in `fd46303` by reusing `cellsOf` of `bin/lib/progress.mjs`;
  Codex on the fix: both fixed. Lenses risk, reliability and readability, then reliability on the fix: 0 findings.
  PR 1 is 707 (branch `f8-lead-rigor-1`, ready notice sent 18:05Z).

## Next step
State (2026-10-30, 88%): PR 707 holds T2, PR 710 holds T3 (both ready notices sent). T4 started, uncommitted in the
worktree: `bin/lib/reply.mjs` exports `fencedBlocks` (each fence's `info`), reply tests 20 pass; the draft module is
copied to `bin/lib/reply-commands.mjs`, untested. Next: write `bin/lib/reply-commands.test.mjs` on the real excerpts named in S1's design, wire it in `bin/reply.mjs` with
the deadline and a parser spawn (`pwsh.exe`, else `powershell.exe`; the probe script that caught `-rf` is
`tmp/probe.ps1`, alias resolved by `Definition`), then the replay over transcript 0f71b2c6's replies, then reviews.

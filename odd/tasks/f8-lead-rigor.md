# Lead rigor: three checks that stop the lead's mistakes before they reach him

Locator: `odd/tasks/f8-lead-rigor.md` · Engram mirror: `odd/f8-lead-rigor/tasks` · Branch: `worktree-f8-lead-rigor`
Delivery: pull requests, one per check (chained when one outgrows its review) · Test runner: `node --test`

## Goal
Three mistakes the lead made on 2026-10-30 are refused by a command before they reach him: a shell command handed in
a reply that is not for his shell or was never run, a host update marked reviewed with no research, and a mistake
left uncounted; and he sees each week whether the lead's mistakes go down.

## Why
He said the lead rushes and hands him commands that fail at the first try, and asked how the harness becomes more
demanding (S0). The rules already said to run a command before handing it (`command-handed-untested`, owed) and to
report what an update brings (the host-update row's fix list), and nothing made either act: a line without a check.
A check that refuses the reply or the record makes them act whatever the lead's hurry.

## Done when
- `node --test bin/lib/reply.test.mjs bin/reply.test.mjs bin/lib/reply-commands.test.mjs bin/lib/host-update.test.mjs bin/doctor.test.mjs bin/lib/failures.test.mjs bin/failures.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-lead-rigor.md` exits 0
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs failures weeks` exits 0 and prints the week of 2026-10-26 with the lead's sightings counted
- `npm run check` exits 0
- each check has a planted case of today's mistake that turns its test red on main, named in `## Log`
- every code slice has a Codex review and a lens review recorded, and its pull request is on main

## In scope / Out of scope
- In: `bin/lib/reply.mjs`, `bin/reply.mjs`, a new `bin/lib/reply-commands.mjs`, `bin/lib/host-update.mjs`,
  `bin/doctor.mjs`, `bin/failures.mjs`, `bin/lib/failures.mjs`, their tests; `harness.json` (the `reply` key);
  `docs/FAILURES.md`; a new `docs/host-updates/` (the review files); the help and docs that name these commands;
  this document; the session's summary under `docs/sessions/`.
- Out: `~/.claude`, `~/.codex`, credentials and gentle-ai config (read only, transcripts included); JH 105's files on
  `docs/claude-app-native` (its proposal is read, never edited); the role that writes a host review (JH 105's
  proposal); anything that opens a browser; the Stop hook's timeout (an installer change).

## Constraints
- A false refusal of the Stop hook costs every session a rewritten close, so each refusal is tested on a real
  transcript excerpt and so is the pass, on win32 and on linux — because the hook runs in every session.
- The hook turns a stop back once (`stop_hook_active`), never twice: a refusal cannot lock a session.
- The hook keeps its 5 seconds: the transcript is read only when the reply holds a command block, and the parser is
  spawned only for a block that has no run to show — because the timeout is the installer's.
- Every read fails open as the hook does today, except that a command block is never let through unchecked.

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
- [ ] T1 (kind: design) this document; two blind readers on the plan before code (L4)
- [ ] T2 (kind: build) S3 — the Seen lines, and `failures weeks`; test first; Codex and lenses
- [ ] T3 (kind: build) S2 — the host review file and the `--host-reviewed` gate; test first; Codex and lenses
- [ ] T4 (kind: build) S1 — command blocks in the reply check; test first on real excerpts; Codex and lenses
- [ ] T5 (kind: verify) `npm run check`, PRs, ready notices, summary

## Design

### Searched first
- The reply check exists (`bin/lib/reply.mjs`, `bin/reply.mjs`, the Stop hook): S1 amends it with one more refusal,
  in a module of its own (`bin/lib/reply-commands.mjs`) as the wake and stale-board checks are, so the close check
  stays as it is.
- `doctor --host-reviewed` exists (`recordHostReview`, `bin/doctor.mjs:453`): S2 adds a refusal before its write.
- The weekly view: `js-harness failures` already reads `docs/FAILURES.md` (`parseRegister`, `bin/lib/failures.mjs`)
  and counts sightings by class; `throughput` measures reviews and gates, `report` builds pages of a feature. The
  view is a `failures weeks` subcommand: the register's reader, not a second one.
- `command-handed-untested` (FAILURES.md) is the entry the shell mistake belongs to; its control is owed to
  `odd/tasks/instruction-homes.md` and becomes S1's check. `js-harness rules` holds `terminal-note` (a command typed
  into his Terminal panel ends with a note, `bin/lib/guard.mjs`): another channel, left as it is; the matcher below
  takes such a note off a handed line before it compares it.
- No rule is added: S1 to S3 are checks of controls the register already owes, and no value of his is new. If a
  reader finds one that is his, it goes through `rules change` with S0 and S0b.

### S1: command blocks in the reply
A command block is a fenced block of the reply that hands a shell command:
- its info string's first word is a shell (`bash`, `sh`, `zsh`, `shell`, `console`, `fish`, `powershell`, `pwsh`,
  `ps1`, `cmd`, `bat`); or
- it has no info string, or `text`/`txt`/`plaintext`, and its first command line starts with a known program
  (`git`, `gh`, `npm`, `npx`, `pnpm`, `node`, `js-harness`, `claude`, `codex`, `rm`, `cd`, `Remove-Item`, ... one
  constant list), so an untagged block cannot slip by. A cut's prompt block starts with words, not a program.

A command block is refused when:
1. its tag is not his platform's shell: on win32 `powershell`, `pwsh` or `ps1`; elsewhere `bash`, `sh`, `zsh`,
   `shell` or `console`. An untagged command block is refused the same way (it is not tagged for his shell).
2. it is tagged right and one of its command lines (comments, blank lines and a prompt mark `PS>`/`$ ` taken off,
   continuation lines joined, a closing `; Write-Host 'NOTE: …'` taken off) is found in no run of the session: a
   `Bash` or `PowerShell` tool call of the transcript, not a side chain, whose result is not an error, not
   interrupted and not moved to the background. Found means the line, whitespace collapsed, is part of the run's
   command, so a run wrapped as `powershell.exe -Command "…"` counts.
3. its caption, the nearest line above the fence outside any block, holds the project's "only you can run" label
   (`reply.command.own` in `harness.json`; default `Only you can run this`, here `Solo tú puedes correrlo`): then 2
   does not apply, and the block's text is checked instead by the shell itself: on win32 PowerShell's parser plus,
   for each command it resolves, that every named parameter binds (`rm -rf` names `-rf`, which `Remove-Item` has
   not: today's mistake); elsewhere `bash -n`. A parse error, an unbound parameter or a parser that cannot run (gone,
   timed out at 3 s) refuses the block, saying which.
4. the transcript cannot be read as Claude Code's (Codex, a missing path): 2 cannot apply, so 3's check runs on
   every command block, never none.

"In a scratch copy when it changes anything" is the lead's way of running it (a scratch folder as working folder or
home, the same text); the check cannot see which folder a run used, so it does not judge it. A command that cannot
run safely with the same text (an absolute path of his) is his to run: caption it, and the parser checks it.

The transcript is read only when the reply holds a command block, by lines that hold `"tool_use"` or
`"tool_result"`, parsed one by one. The refusal joins the close check's in one block, as the wake check's does.

Real excerpts for the tests (lead transcript 0f71b2c6): the refusal, line 32954 (the reply with ```` ```bash ````
`rm -rf /d/js-harness-worktrees`, after the runs at lines 32882 to 32895 the guard refused) and line 30024 (a
`bash` block `cd D:\js-harness; codex`, his settings); the pass, a successful `Bash` run of the same transcript
handed back in a `powershell` block; both under `platform: 'win32'` and `'linux'`.

### S2: the host review file
`doctor --host-reviewed` records only when `docs/host-updates/desktop-<desktop>[-code-<code>].md` exists in the
project doctor runs in (its git root) for the versions read now, and holds:
- a table whose header has the columns `Change`, `Decision` and `Reason`, with one row at least, each `Decision`
  one of `adopt`, `adapt` or `ignore` and each `Reason` not empty (a version with no changelog entry is one row that
  says so, `ignore`);
- a `## Sources` section with one list item at least, each a URL or a path.
Otherwise it records nothing, exits 1 and names the file and what it lacks. The host-update row's fix list names
the file to write before its last step. `--stack-reviewed` is unchanged. The research that fills the file is JH
105's proposal; this slice only reads the format.

### S3: the count
- `docs/FAILURES.md`: a `- Seen:` line in `command-handed-untested` for line 32954 (the `bash` block he ran in
  PowerShell, line 32965); a new entry `host-review-without-research` for line 29697 (`--host-reviewed` after a
  breakage check only; the lead's relief note, line 33432); the two of S3b, as the lead's claims. Each Seen line of
  the lead's own mistake starts its evidence with "the lead's", the convention the header gains.
- `js-harness failures weeks`: one line a week (ISO weeks, Monday first) from the first sighting to this week:
  the sightings, the lead's among them (evidence starting with "the lead's"), and the count by class. Read-only.

## Log
- L1 (his request, line 33664, and his answer to question 126, line 33700): quoted in S0 and S0b.
- L2 (2026-10-30, design): no rule added; the weekly view is `failures weeks`; the lead's sightings are those whose
  evidence starts with "the lead's"; the review file lives in the project's `docs/host-updates/`.
- L3 (2026-10-30, the lead's note 17:20Z): two more mistakes to count (S3b); whether a check fits the merge-queue one
  is decided in T2.

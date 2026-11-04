# JH 141 · A session's env file never grows to the command-line cut

Locator: `odd/tasks/session-env-trim.md` · Branch: `fix/session-env-trim` · Delivery: one pull request to main · Test
runner: `node --test`

## Goal
Every start of a Claude Code session rewrites a SessionStart env file that has grown past 2,048 bytes to the last
occurrence of each of its lines, after a backup and a record that undo it exactly, so the codex plugin's appends never
again make every Bash command of a long-lived session too long to run.

## Why
On 2026-11-03 every Bash call of the lead failed from 11:17Z on, and the terminal tool it fell back to held it 7 hours on
permission prompts (`session-env-file-cut`, pull request 766). The codex plugin's SessionStart hook appends three
`export` lines to its env file on every start and never replaces them; Claude Code puts the file into each Bash command
line, which Windows cuts at 8,191 characters. JH 140 trimmed the lead's file by hand, so it comes back after about 27
more starts. The plugin is not ours to edit (the brief), so the harness keeps the file short.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/session-env-trim.md` exits 0
- `node --test bin/lib/session-env.test.mjs bin/backup.test.mjs` exits 0
- `npm run check` exits 0
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `bin/lib/session-env.mjs` and its test; the call from `backup --session-start` (`bin/backup.mjs`), with its test in
  `bin/backup.test.mjs`; the usage line of that hook; this document.
- Out, each with its reason:
  - the codex plugin's files and `~/.codex`: they are not this repo's (the brief, item 3); an upstream fix that replaces
    instead of appending is the plugin owner's;
  - a new hook entry or a matcher change: `backup --session-start` already runs on all four starts on every machine
    with the harness installed, so no installer, manifest or settings file changes;
  - `doctor --hook`: its matcher is `startup|resume`, and 24 of the lead's about 30 starts were compactions (Depth pass,
    item 2), so it would miss most of the growth;
  - pruning the backups the trim writes: each is under 9 KB and the lead's rate is a few a day; left open (Log).

## Constraints
- Only a file whose every non-empty line is `export NAME='value'` (with the plugin's `'"'"'` escape) is rewritten —
  because the rewrite keeps the meaning only for independent assignments; any other line leaves the file as it is.
- The new text replaces the file by a rename, and only when a second read just before it finds the text the trim read —
  because the codex hook appends in parallel with this one (Claude Code runs a start's hooks together).
- The hook still exits 0 and prints nothing new — because a SessionStart hook never breaks a session, and the record is
  where the trim is told.

## Ask me before
Nothing planned: the brief chose the path for a plugin-owned hook (a check that trims with a recorded undo). A question
goes to the lead with `js-harness notify --to orchestrator --kind question`.

## Depth pass
- 1. Method: log-file hygiene in a host's state folder, the standard of a careful operations engineer: never rewrite a
  file another process owns unless its format is known exactly, keep a copy and a record that restores it byte for
  byte, and replace by rename so no reader sees half a file. The smallest change: one pure function that dedupes the
  lines, one function that applies it to the session's folder, called from a hook that already runs at every start.
  Searched first (`rule:reuse-first`): `CLAUDE_ENV_FILE` and `session-env` in `bin/` (none but an eval's list of host
  folders, `evals/home.test.mjs:70`); `js-harness rules` names no rule on host state files; the SessionStart hooks the
  harness installs, by matcher, in `bin/lib/hook-entries.mjs`: only `backup --session-start` takes all four starts.
- 2. Raw material: the plugin's hook, `~/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/session-lifecycle-hook.mjs:35`
  (`appendFileSync` on `CLAUDE_ENV_FILE`, three variables at line 78); Claude Code's own code in
  `~/.local/bin/claude.exe`: `CLAUDE_ENV_FILE` is set for every SessionStart hook as
  `session-env/<session>/sessionstart-hook-<index>.sh`, it clears only the `filechanged-` and `cwdchanged-` files, and it
  invalidates the cached env script when a start's hooks end (`hK()`), so a trim made by a hook counts from the next
  Bash call; the lead's transcript `0f71b2c6`: 169 `SessionStart:compact`, 38 `:resume` and 7 `:startup` hook
  attachments, about 7 hooks a start; the machine's folder `~/.claude/session-env/`: 311 env files, every line of all
  of them of the strict shape, 121 with repeated lines, 11 over 2,048 bytes, the largest 8,667; one file,
  `566f950e…/sessionstart-hook-6.sh`, holds two values of `CODEX_COMPANION_TRANSCRIPT_PATH`, so a value can change and
  the last occurrence is the one that counts; the hook the trim joins, `bin/lib/hook-entries.mjs:149` (matcher
  `startup|resume|clear|compact`, `bin/lib/hook-entries.mjs:157`), and its command, `sessionStartCommand` (`bin/backup.mjs:968` on main).
- 3. The bar:
  spec 1: `node --test bin/lib/session-env.test.mjs`: none, new behaviour; today a 105-line file stays 105 lines.
  spec 1, the undo: `node --test bin/lib/session-env.test.mjs` copies the record's backup back and gets the file byte for
  byte: none, new behaviour.
  spec 2: left out because the plugin's files and `~/.codex` are outside the repository and no line of this change
  names them; the trim writes only `sessionstart-hook-<n>.sh` files in the session's env folder (spec 1's test).
- 4. Refutation: does dedupe by last occurrence change what a sourced file sets? For lines that each assign one
  variable, the final value of a variable is set by its last assignment; that line is the last occurrence of its own
  text, so it is kept, and the kept lines keep their order, so no later line overrides it. A line of any other shape
  could depend on order (`PATH="$PATH:…"`), which is why the strict shape gates the rewrite. The machine's 311 files all
  pass the gate, so the gate costs nothing today. Run on the 566f950e file: the trim keeps 3 lines and the transcript
  path that was last. The race: the codex hook's append may land between the second read and the rename and be lost;
  what it appends is the session's same three lines, already in the new text, so what is lost is a repeat, and the
  next start appends them again (unguaranteed only if a value changes in that window of microseconds).
  Verdict: supports
- 5. Request: when a SessionStart env file of the session passes 2,048 bytes and every line is a plain `export`
  assignment, a start rewrites it to the last occurrence of each line, after writing a backup and a record of the undo
  under the harness home; the codex plugin is left as it is.
  Adds: none

## Specs
1. "If the Codex plugin owns it, add a js-harness check (`doctor` or the session-start hook) that warns, or trims with a
   recorded undo, before the file nears the limit." (the brief, item 2)
2. "Do not edit the Codex plugin's own files or `~/.codex` without asking the lead" (the brief, item 3)

## Tasks
- [ ] T1 (kind: docs) this document and its depth pass, before any code — spec 1-2
- [ ] T2 (kind: build) `bin/lib/session-env.mjs`, test first, and its call from `backup --session-start` — spec 1-2
- [ ] T3 (kind: verify) Codex and the Claude lenses over the code commits; the gate; PR; `notify` — all

## Log
- L1 (2026-11-04, the lead's brief to JH 141): find which hook writes the lines and why it appends; fix it test-first if
  js-harness owns it, else add a check in `doctor` or the session-start hook that warns, or trims with a recorded undo,
  before the file nears the limit; never edit the plugin or `~/.codex` without asking; check, reviews, PR, never merge;
  report through `js-harness notify`.
- L2 The writer is the codex plugin's `SessionStart` hook, `session-lifecycle-hook.mjs:35-40` and `:77-81`
  (`appendEnvVar` with `fs.appendFileSync`), registered by the plugin's `hooks/hooks.json` with no matcher, so every
  start appends. It appends because Claude Code's documented contract for `CLAUDE_ENV_FILE` is "append export lines",
  written for a file that starts empty, and Claude Code never empties a `sessionstart-hook-*.sh` file, only the
  `filechanged-` and `cwdchanged-` ones. No js-harness hook writes there (`CLAUDE_ENV_FILE` appears nowhere in `bin/`).
- L3 Decision: the trim lives in `backup --session-start`, the one harness hook on all four starts; threshold 2,048
  bytes, about 7 starts of the plugin's lines, which keeps the file under a quarter of the cut and the trims rare.

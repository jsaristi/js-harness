# JH 114 · commits: strip the host's attribution lines from every commit message

Locator: `odd/tasks/strip-attribution.md` · Engram mirror: `odd/strip-attribution/tasks` · Branch:
`worktree-strip-attribution` (slice 1), a second branch for slice 2
Delivery: a pull request to main per slice, slice 1 first · Test runner: `node --test`

## Goal
Every commit message, in this repository and in a project `init` set up, loses the host's attribution lines before
the commit is made, without the commit being stopped.

## Why
The Claude app tells every session to end its commit messages with `Co-Authored-By: Claude ...` and
`Claude-Session: ...`; his rule forbids them (`CLAUDE.md`, "Never add Co-Authored-By or AI attribution to commits").
The protocol line did not stop it three times (`js-harness failures commit-attribution-from-host`). Hooks are delivery
(Task Size high risk, item 5).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/strip-attribution.md` exits 0
- `node --test bin/commit-msg.test.mjs` exits 0, its planted cases (both trailers out; a human co-author kept; a
  message with none unchanged) red before the command and green after, both runs quoted in `## Log`
- `node --test bin/lib/project.test.mjs bin/lib/project-switches.test.mjs bin/lib/project-migrate.test.mjs` exits 0
- a real commit on the branch made with both trailers lands without them, its `git log -1 --format=%B` quoted in `## Log`
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- both pull requests are merged into main, named in `## Log`, with Codex and the Claude lenses recorded over their code

## In scope / Out of scope
- In: a new `bin/commit-msg.mjs` and its test, `.githooks/commit-msg`, the dispatcher's table and usage, README and
  `docs/SPEC.md` for the command, `bin/lib/project.mjs` and what `init`, `sync`, `migrate` and `uninstall` do with
  project hooks, their tests, `docs/FAILURES.md` (the Control line), the ROADMAP's S4a row.
- Out: rewriting any commit already on main (his answer); S4a's hook-count row (another slice of F8); `~/.claude`,
  `~/.codex`, credentials, gentle-ai config.

## Constraints
- The step never stops a commit: what it cannot read or write it says and lets the commit go — because his answer is
  "Quitarlas solo", not "Rechazar el commit".
- It matches narrowly and leaves every other byte as it was: a human co-author line stays — because the brief asks it.
- Tests first, each planted case red before its code — because the brief asks it.
- `bin/lib/project.mjs` is at its ceiling (1,989 lines, `bin/conventions-structure.test.mjs`): code moves out before
  any is added.

## Ask me before
Nothing here is his: a decision only he can take goes to the lead as a recorded question
(`js-harness notify --to orchestrator --kind waiting`, in Spanish).

## Specs
1. His answer to question 132 (2026-10-31): "Quitarlas solo" — the question offered "quitar esas líneas solo, sin
   frenar el commit"; "no reescribe los commits que ya están en main".
2. The brief: "a `commit-msg` hook step in `bin/` that removes the host's attribution trailers (match them exactly
   and narrowly: `Co-Authored-By:` lines naming Claude or an Anthropic address, and `Claude-Session:` lines; a human
   co-author line stays), leaves every other byte of the message as it was, and says in one line what it removed."
3. The brief: "Tests first: a planted message with both trailers comes out without them; a message with a human
   Co-Authored-By keeps it; a message with none is unchanged."
4. The brief: "Wire it where the repo's hooks are wired (`npm run hooks`) and where `init` ships hooks to a project,
   if it does, so it is recorded and undone exactly by `uninstall` (AGENTS.md)."
5. The brief: "Update the failure's Control line." "Ready notice with --pr per slice; summary under docs/sessions/."

## Tasks
- [ ] T1 (kind: build) specs 2, 3, 4: `js-harness commit-msg <file>` and `.githooks/commit-msg`, tests first; the
  README and SPEC entries; the Control line — commits: pending
- [ ] T2 (kind: verify) spec 5: the real commit with both trailers; Codex, the lenses, an independent verifier, PR 1
  and its ready notice — pending
- [ ] T3 (kind: build) spec 4: `init` writes the hook into a project, recorded; `sync` writes it where it is missing;
  `uninstall` removes it; tests first — commits: pending
- [ ] T4 (kind: verify) spec 5: Codex, the lenses, an independent verifier, PR 2, its ready notice, the summary —
  pending

## Log
- L1 (2026-10-31, the brief as written, title): "JH 114 · commits: strip the host's attribution lines from every
  commit message". Its words are in
  `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T01-54-53-111Z-1445f2e4.md`; his answer is read with
  `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 37870`.
- L2 (2026-10-31, searched before building): `grep` over the repo for `Co-Authored-By`, `Claude-Session`,
  `commit-msg` and `hooksPath`: no code acts on a commit message; `.githooks/` holds `pre-commit`, `pre-merge-commit`
  and `pre-push`, wired by `npm run hooks` (`git config core.hooksPath .githooks`). The ROADMAP's F8 S4a plans this
  same hook (`docs/ROADMAP.md`, "S4a The attribution hook and the hook count"); this feature is its first half, the
  hook-count row stays in S4a. codegraph over `init`'s hooks: `bin/lib/project.mjs` writes `pre-commit` and, where
  the Codex review is on, `pre-push` (`HOOKS`, `writeHookGate`), each recorded in the manifest's `files`; `sync`
  restores a recorded hook that is gone (`restoreRecordedHook`) and writes the push check where none is recorded
  (`syncPrePush`). `js-harness rules` names no rule of commit messages beyond the protocol line the failure's Control
  names (`bin/lib/rules-block.mjs`).
- L3 (2026-10-31, the decision, slice 1): the command is `js-harness commit-msg <file>`, a command of its own so a
  project's hook calls it as `pre-commit` calls `check`; its file imports node's own modules alone (since L6, also
  `bin/lib/atomic-write.mjs`, which imports node's alone), so this repository's
  hook runs it directly (`node bin/commit-msg.mjs`), as `pre-commit` runs `bin/check.mjs`, and its test runs the real
  hook against a scratch repository holding that one file. A line goes when it is the whole of
  `Co-Authored-By: <name> <<address>>` (any case of the key) whose name holds the word `Claude` or whose address is
  at `anthropic.com` or a subdomain of it, or the whole of a `Claude-Session:` line; every other line, its line ending
  included, stays. (Superseded by L6: the name, the place and the bytes.) Lines are matched anywhere in the file, not only in the last paragraph: at the hook, git has not
  yet taken out the comment lines an editor leaves under the trailers, so the last paragraph is often a comment. Git
  takes out the blank lines left at the end after the hook (its default `--cleanup`), so none is removed here. The
  repository's hook lets the message be when the branch has no `bin/commit-msg.mjs`: every worktree runs the main
  checkout's `.githooks` (`core.hooksPath` is `D:\js-harness\.githooks`), and a branch older than this one would
  otherwise fail every commit. Known limit: a human whose name holds the word Claude, written as a co-author, is taken
  out too; the brief's own rule ("naming Claude").
- L4 (2026-10-31, slice 1, red then green): `node --test bin/commit-msg.test.mjs` written before the command: `✖
  bin\commit-msg.test.mjs`, "tests 1, pass 0, fail 1" (the file failed to load: `./commit-msg.mjs` did not exist, so
  every planted case was red by not running). After `bin/commit-msg.mjs` and `.githooks/commit-msg`: 13 of 13, the
  hook's two run against a scratch repository (`git commit -m` with both trailers and a human co-author: the log keeps
  the human one alone; with no `bin/commit-msg.mjs`, the message as given). Then `node --test` over
  `bin/js-harness.test.mjs bin/readme.test.mjs bin/conventions-arguments.test.mjs bin/conventions-errors.test.mjs
  bin/conventions-structure.test.mjs bin/lib/spec.test.mjs bin/failures.test.mjs bin/lib/failures.test.mjs`: 211 of
  211. `js-harness failures commit-attribution-from-host`: "state: controlled", its Control the hook's test, the
  protocol line a `Was:` line. A test title of the form `'the host\'s'` holds a backslash in the file, so the Control's
  phrase was not found ("control lost") until the titles took double quotes.
- L5 (2026-10-31, slice 1, the reviews of `951bcfb4`): the commit itself was made with both trailers, through this
  branch's hooks (`git -c core.hooksPath=.githooks commit -F`), and landed without them: the hook printed "js-harness
  commit-msg: removed the host's attribution lines: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com> |
  Claude-Session: https://claude.ai/code/session_014UXmf7nXWHqnjZkbEUz5UB", and `git log -1 --format=%B` ends on the
  body's last paragraph ("... The failure's Control is now the hook's test."). Its gate passed on CI. Codex over
  `1f19c04..951bcfb`: incorrect (0.96), two P2: the message read and written as UTF-8 corrupts the bytes of another
  encoding; `writeFileSync` in place can truncate the message on a failed write while the command says it was left as
  it is. Lenses: risk 0, readability 0, reliability 1 WARNING: a human co-author named Claude ("Claude Dupont") is
  taken out. gentle-ai over the same commit (lineage `review-1987c595cace9404`, its `granted` invocation run as
  `CLAUDE.md` says, its four lenses captured with `capture-result --cwd=.`): approved and acknowledged, with WARNINGs
  `R3-utf8-roundtrip`, `R4-utf8-roundtrip`, `R3-hook-node-missing` (`exec node` stops the commit when node is
  missing) and SUGGESTIONs `R2-co-author-requires-address` (a bare `Co-Authored-By: Claude` was kept),
  `R2-log-imports-claim` (L3 said `node:fs` alone; it also imports `node:url`), `R2-spec-reason-garbled`,
  `R2-control-title-coupling`, `R3-dispatcher-untested`, `R4-node-missing-blocks`. The independent verifier (a
  read-only agent given the code and the requirement, not this document) found nothing blocking and four real things:
  a trailer-shaped line quoted in the body is taken out; a human named Claude; non-UTF-8 bytes; a script that throws or
  no node stops the commit; and the truncation as uncertain.
- L6 (2026-10-31, slice 1, the fixes, tests first): every finding above is taken. A line goes only when it is in the
  trailers that end the message: its last paragraph, comment lines and what lies under `git commit -v`'s scissors left
  out, when that paragraph is not the subject's and holds trailer lines alone. The name must be the host's (`Claude`,
  alone or with `Code`, a model family or a version) and the address is optional, so `Claude Dupont
  <claude@example.fr>` stays and a bare `Co-Authored-By: Claude` goes. The message is read and written as bytes
  (latin1 both ways) and replaced through a fresh temporary sibling and one rename (`renameOver` of
  `bin/lib/atomic-write.mjs`, reused rather than written again). The hook runs `node ... || exit 0`, so a script that
  fails or no node lets the commit go. New tests, each red against a stub `replaceFile` before the code (8 of 20
  failing: the human named Claude, the quoted line, the latin1 bytes, the failed rename, the three command tests whose
  seams now hand bytes, the hook with a broken script and no node), then 20 of 20. The no-node case first checks that
  `sh -c 'command -v node'` exits 1 on the PATH it commits with. The dispatcher is run end to end
  (`js-harness commit-msg <file>`). The Control's test title carries a comment that `docs/FAILURES.md` quotes it.
- L7 (2026-10-31): the fixes' first commit failed its gate on CI, once (1 test failed): the no-node case's guard,
  "node is still on the PATH the commit runs with", `actual: 127, expected: 1`: dash's `command -v` exits 127 for a
  name it does not find, bash's 1. The guard now asks for any exit but 0 with no spawn error, and the case is a test of
  its own that skips where git shares a folder with node; then `node --test bin/commit-msg.test.mjs`: 21 of 21.
- L8 (2026-10-31, the reviews of `348378ce`): Codex over `951bcfb..348378c`: correct (0.98), its two findings fixed.
  Lenses risk and reliability: 0 findings each. gentle-ai (lineage `review-ad878d337143d3fb`, `granted` run, its
  reliability lens captured): approved and acknowledged, with two WARNINGs and a SUGGESTION, all taken, tests first:
  host trailers right under a body line with no blank line between were kept, since the paragraph had to hold
  trailers alone (now the run of trailer lines that closes the last paragraph goes, never the subject line; a quoted
  host line with prose under it is in no such run), red then green (22 of 22); the no-node test fails where `sh`
  cannot be spawned on the stripped PATH (now it skips there); `replaceFile` closed its descriptor a second time when
  the rename failed (now once).

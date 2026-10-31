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
- [x] T1 (kind: build) specs 2, 3, 4: `js-harness commit-msg <file>` and `.githooks/commit-msg`, tests first; the
  README and SPEC entries; the Control line — commits: `951bcfb4` `348378ce` `b0f98b5a` `6110bd91` `589cef49` `71420b38`
- [x] T2 (kind: verify) spec 5: the real commit with both trailers; Codex, the lenses, an independent verifier, PR 1
  and its ready notice — PR #728, ready notice sent 2026-10-31
- [ ] T3 (kind: build) spec 4: `init` writes the hook into a project, recorded; `sync` writes it where it is missing;
  `uninstall` removes it; tests first — branch `strip-attribution-init`, commits: pending
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
- L9 (2026-10-31, the reviews of `b0f98b5a`): Codex over `348378c..b0f98b5`: correct (0.91), no finding. Lens
  reliability: 0. gentle-ai over `951bcfb4..b0f98b5a` (lineage `review-153b0dfb60636789`, `granted` run, its
  reliability lens captured): approved and acknowledged, one WARNING, taken, tests first: comment lines were known by
  `#` alone, so under `core.commentChar=;` (or `auto`) an editor's comment paragraph hid the trailers above it. The
  command now reads `core.commentString`, then `core.commentChar`, from git where the hook runs (`auto`: every mark git
  may pick, `#;@!$%^&|:`); red (the file failed to load: no `commentMarks`), then 24 of 24.
- L10 (2026-10-31, the reviews of `6110bd91`): Codex over `b0f98b5..6110bd9`: incorrect (0.99), two P2, taken, tests
  first: under `auto` every candidate mark counted, so `Claude-Session: example` above a prose line `!This ...` went
  (now the one mark git picked: the last non-blank line's first char, when it is a candidate and some line is that
  mark alone, git's empty comment line; `#` otherwise); `core.commentString` was read before `core.commentChar`,
  though they are aliases and the last set wins (now one `git config --get-regexp`, its last value). Red: 1 of 26
  (the `!` prose case, `removed: ['Claude-Session: ...']`), then 26 of 26. Lens reliability: 0. gentle-ai (lineage
  `review-911e27eb1c17d7c2`): a SUGGESTION, the host's names are a fixed list, and a WARNING, a host trailer followed
  by prose in the last paragraph is kept; neither is taken: the first is what keeps a human named Claude (the
  anthropic.com address still catches what the app writes), the second what keeps a quoted host line with prose under
  it (the verifier's finding of L5); the `auto` case it names is the P2 fixed here.
- L11 (2026-10-31, the reviews of `589cef49`): Codex over `6110bd9..589cef4`: correct (0.9), both P2 of L10
  fixed. Lens reliability: 0. gentle-ai over `951bcfb4..589cef49` (lineage `review-9c94f1749f2e4efe`, `granted` run,
  its reliability lens captured): approved and acknowledged, one advisory WARNING, taken, tests first: under `auto`
  with `git commit -v` the last non-blank line is the diff's, so the mark fell back to `#` and an editor's `;`
  paragraph kept the host trailers in (now the mark is read only down to the scissors line). Red: 1 of 27, then 27 of
  27.

- L12 (2026-10-31, the reviews of `71420b38`): Codex over `589cef4..71420b3`: correct (0.97), no finding. Lens
  reliability: 0. gentle-ai over `951bcfb4..71420b38` (lineage `review-31fc86f5c587c9b8`, `granted` run, its
  reliability lens captured): approved and acknowledged, a WARNING and a SUGGESTION, neither taken. The WARNING: under
  `--cleanup=verbatim` (or whitespace, scissors) a `#` line stays in the commit, so a host trailer above it is not
  in the final trailers, yet it goes; what goes is still a line his rule forbids anywhere in a commit, and the hook
  cannot know the cleanup mode git was given. The SUGGESTION: the continuation lines of a folded host trailer stay;
  the host writes each trailer on one line. Taking either costs another round of three reviews for a case no commit
  has shown.
- L13 (2026-10-31, slice 2, T3): PR #728 landed (main `75c3583f`, the lead's word); `strip-attribution-init`
  fast-forwarded onto it. Searched first: `writeHookGate`, `restoreRecordedHook`, `writeHookInto`, `syncPrePush` and
  `HOOKS` in `bin/lib/project.mjs` already write, restore and record a hook by name, and `uninstallProject` removes
  every recorded file, so the commit-msg step is one more entry of `HOOKS` (moved with the other two to
  `bin/lib/project-hooks.mjs`, since `project.mjs` sat at its ceiling) and two calls. Not tests first, said as it
  is: the new assertions were written beside the code; the first run of `project.test.mjs` failed 5 of 183, the
  assertions that counted one hook less, which shows the change reaches them. Then `project.test.mjs`,
  `project-migrate`, `migrate`, `init`, `uninstall-kinds` and `conventions-structure`: 257 tests, 0 failed, 11
  skipped. Two first runs were stopped by Claude Code for low memory while they waited for the gate lock; the lead
  told the restart.
- L14 (2026-10-31, the reviews of `7a73e476`): Codex over `75c3583..7a73e47`: incorrect (0.9), one P2, taken: the
  line a project with its own commit-msg hook is told to add had no `|| exit 0`, so it could stop a commit. Lens
  risk: 0. Lens reliability: one WARNING, the same as gentle-ai's (lineage `review-feea5702949509ec`, `granted` run,
  approved and acknowledged, a WARNING and a SUGGESTION) and the verifier's W1, confirmed by running it: a clone that
  keeps its own commit-msg hook, or whose hooks path is outside the repository, never had it recorded, so every sync
  said `kept` again and `migrate --check` exited 1 forever. Taken, tests first (red: the reason lacked `|| exit 0`):
  `sync` now records the kept hook in `kept`, as `init` does (`keptRecord`), and `repairLines` reads it; the test runs a
  second sync (up to date, nothing said) and the migration plan (nothing pending). The verifier's N3 (SPEC's init
  requirement and the README's "first four files" named no commit-msg step) is taken; its N4 (two linked worktrees'
  manifests recording one shared hook) is the pre-push hook's pattern already, not taken here. The project and migrate
  tests: 222, 0 failed. `project.mjs` is 1,978 lines, its ceiling set to that (main's was 1,989).
- L15 (2026-10-31, the reviews of `03db395b`): Codex over `7a73e47..03db395`: correct (0.98), the P2 fixed. Lens
  reliability: 0. The ROADMAP's S4a State says the hook is done and shipped by `init`; the 50-commit count, the
  hook-count row and D8 stay open there.
## Next step
State (2026-10-31): slice 1 (`951bcfb4`..`7214c0fe`, branch `worktree-strip-attribution`) is PR #728, every code
commit reviewed (L12), ready notice sent. Worktree `D:\js-harness\.claude\worktrees\strip-attribution`, now on branch
`strip-attribution-init` (slice 2, T3), on main `75c3583f`, its commit made with L13 (see `git log`). Written:
`bin/lib/project-hooks.mjs` (the three hooks' texts; `HOOKS.commitMsg` runs `js-harness commit-msg "$1" || exit 0`);
`bin/lib/project.mjs` imports it, `writeProject` writes commit-msg beside pre-commit, `updateRecorded` under `sync`
restores a recorded one that is gone or writes it where none is recorded (1,972 lines; its ceiling lowered to that in
`bin/conventions-structure.test.mjs`); `repairLines` in `bin/lib/project-migrate.mjs` names it; README (init and
uninstall examples) and SPEC (the capability's requirement, Proof and Today). Tests: the fresh-init test (11 wrote,
7 files, the hook's text), two new sync tests (an old clone gets it, recorded, a second sync up to date, uninstall
removes it; a clone's own commit-msg is kept), and five assertions that counted one hook less. `project.test.mjs`
ran once: 5 of 183 failed, fixed; then 257 of the touched files' tests passed (L13). Next: Codex, the lenses
(reliability, risk: an installer), gentle-ai if offered, an independent verifier (T4); push, PR 2 based on
`worktree-strip-attribution`, ready notice with `--pr`; then the summary under `docs/sessions/`, the ROADMAP S4a
State, `npm run check`, `notify --kind closed --summary <file>`.

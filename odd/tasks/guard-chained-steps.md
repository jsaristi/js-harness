# Guard: a chained step runs only on its check's success

Locator: `odd/tasks/guard-chained-steps.md` · Engram mirror: `odd/guard-chained-steps/tasks` · Branch:
`rule/chained-steps` (worktree `.claude/worktrees/guard-chained-steps`) · Session: JH 118.
Delivery: one slice, one pull request. Test runner: `node --test`.

## Goal
`js-harness guard --hook` refuses a Bash command in which a `git push`, `git commit`, `gh pr`, `merge-queue` or
`notify` step follows another step by `;`, a newline, `||` or `&`, naming the rule `chained-steps` and saying to use
`&&`.

## Why
Row 67 of the lead's duties ("Read the proof before the command; `&&`, never `;`", protocols:60) has failed 10 times
(`chained-step-not-conditional` in `docs/FAILURES.md`), and its only control is a protocol line: twice a push was
refused and the notice chained after it still said "pushed". A check carries it, so no session has to remember it.

## Done when
- `node --test bin/lib/guard.test.mjs bin/guard.test.mjs` exits 0
- `js-harness rules check` exits 0, with `chained-steps` declared and its control a check in
  `bin/lib/rules-coverage-data.mjs`
- `npm run check` exits 0
- Row 67 of `odd/tasks/lead-duty-checks.md` names this check as its control, and the failure's `Control:` line is
  the check.
- The change is on main through a pull request that passed Codex and the Claude lenses, and an independent
  verifier read it.

## In scope / Out of scope
- In: `bin/lib/guard.mjs` (amend `shellWords`'s callers, no second parser), `bin/guard.mjs`, their tests, the guard's
  help lines (`bin/guard.mjs`, `bin/js-harness.mjs`, `bin/lib/manifest.mjs`), the rule's declaration through
  `js-harness rules change chained-steps`, its control, `docs/FAILURES.md`'s control line, row 67, ROADMAP.
- Out: commands inside a quoted argument (`bash -c "a; git push"`, `powershell -Command "a; git push"`): they are one
  word to the shell that runs the Bash tool, and the brief says PowerShell's `;` there must pass. Commands in a
  reply's code blocks (no tool carries them). Other projects: the rule is of this repository's scope, as
  `terminal-note` is (his answer Q85).

## Constraints
- Reuse `shellWords` of `bin/lib/guard.mjs` — because it already drops quotes, comments and heredoc bodies and marks
  operators, and AGENTS.md asks to amend before adding.
- Run only the tests the change needs before the gate — because the machine is short of memory (brief).
- A guard is Task Size high risk (item 2) — so Codex and the Claude lenses on the slice, then an independent verifier.

## Ask me before
Nothing: his answer to question 135 (2026-10-31, "Los tres primeros (Recomendado)") authorizes this check and says it
changes no rule of his; the rule is the project's. Spend: one gate, one Codex review, the Claude lenses, one verifier.

## Specs
- S1. Brief of JH 118, from his answer to question 135 ("Los tres primeros (Recomendado)", transcript 0f71b2c6, line
  38994): "the guard refuses a `;` or a newline before `git push`, `git commit`, `gh pr`, `merge-queue` or
  `notify`". The refusal names the rule and says to use `&&`.
- S2. Cases: `a; git push` refused; a newline before `git commit` refused; `&&` chains allowed; a `;` quoted in a
  string or inside a heredoc's body allowed; PowerShell's `;` inside a `powershell -Command` argument allowed.
- S3. `||` and `|` (the brief: decide and write why). `||` is refused: the step after it runs exactly when the step
  before failed, the inverse of a check. `&` is refused: the step runs beside the one before and never waits for its
  answer (the 2026-10-10 sighting of a reviewer run beside its gate). `|` is allowed: it feeds the step its input
  (`printf ... | git commit -F -`); the step reads what the left side wrote, it does not take it as a check, and a
  pipe into a push or a notice has not been seen.
- S4. The rule `chained-steps` is declared with `js-harness rules change`, of scope repository, linked to the failure
  `chained-step-not-conditional`; its control in the coverage register is this check, with a planted break.

## Tasks
- [x] T1 (S1-S3, kind: build): `chainedStep` and `chainedStepRefusal` in `bin/lib/guard.mjs` over `shellWords`, its
  route in `bin/guard.mjs` (the rules file is read only for a command with a chained step), tests first. Route:
  inline. RED: `bin/lib/guard.test.mjs` could not load (`chainedStepRefusal` not exported). GREEN: guard, lib/guard,
  manifest, rules and failures tests 409/409. Commit: the rule's commit (T2).
- [x] T2 (S4, kind: build): `rules change chained-steps` (new, source design, this document), its control a check
  with a planted break (tried by hand: 2 of 46 tests red, restored), the FAILURES control line (the protocol line
  moves to `- Was:`), row 67, the help lines and docs/SPEC.md. `rules check`, `rules coverage --strict` (after
  `--refresh` settled the manifest's edited guard span) and `failures check` pass. Route: inline. One commit with T1.
- [x] T4 (kind: build): Codex's four P2 findings on efbbb26 (L6), tests first. RED: 2 of 46 (`command -- git push`
  passed, `printf x\;git push` refused). GREEN: guard, lib/guard and merge-queue-waits tests 91/91.
- [x] T5 (kind: build): the risk lens's and the verifier's findings on 4a3bc314 (L7), tests first, and the check
  moved to `bin/lib/chained-step-guard.mjs` with its test beside it (`bin/lib/guard.mjs` had reached 1009 lines, over
  the 1000-line limit). RED: 2 (`echo a\\; git push` passed, the `'\''` idiom refused). GREEN: guard, lib/guard,
  chained-step-guard and merge-queue-waits tests 91/91; conventions and rules-coverage tests 27/27; planted break
  red on 2 of 3, restored.
- [ ] T3 (kind: verify): gate, Codex review, Claude lenses, independent verifier, pull request, ready notice.

## Log
- L1 (2026-10-31, the brief as written): "JH 118 · guard: refuse `;` or a newline before push, commit, gh pr,
  merge-queue or notify". His decision: question 135, answered "Los tres primeros (Recomendado)"; the question said
  "Un sí abre una sesión por chequeo, una tras otra, cada una con sus pruebas y sus revisiones (Codex y los lentes),
  dentro del plan; no cambia ninguna regla tuya."
- L2 (2026-10-31, search): codegraph and grep for the guard's Bash checks and splitters found `shellWords` (bin/lib/
  guard.mjs:279, used by `reviewBaseRefusal`, `driveRootRemovalRefusal`, `recordWriteOf`) and `simpleCommands`
  (bin/lib/reply-commands.mjs:61, the reply hook's reader of code blocks). `js-harness rules` and
  `bin/lib/rules-data.mjs` hold no rule for `&&` (grep "conditional\|&&": none); the protocol line lives in
  `bin/lib/protocols-skill.mjs:60`. Decision: amend `shellWords`'s family, as the drive-root check does, because the
  guard's checks share it and it already skips heredoc bodies; `simpleCommands` lives in the reply hook's module and
  does not skip heredocs.
- L3 (2026-10-31, decision): the rule is scoped to this repository, as `terminal-note` is, so a project that installs
  the harness keeps its sessions' commands as they are; the guard holds it through `ruleHere`/`guardHeld`.
- L4 (2026-10-31, decision): a newline right after `&&`, `||` or `|` continues that command, so the first operator
  between two commands decides; a step after `then`, `else` or `do` is the body of a condition and passes; `{`, `!`
  and `time` are looked through; a `(` or `)` of a group is no joiner, so `(a) ; git push` is joined by `;`. Only the
  operators right before the step count, so the `&` of `2>&1` in `a 2>&1 && git push` does not.
- L5 (2026-10-31, decision): every `gh pr` verb counts, `view` and `checks` too, as the brief lists it: a refusal
  costs one retry joined by `&&`, and a list of read verbs would be one more list to keep. A step is found behind
  `NAME=value`, `env`, `command`, `exec`, `sudo`, `nohup`, git's `-C`/`-c` options, `node <path>/js-harness.mjs`, `npx`
  and `js-harness gate --`.
- L6 (2026-10-31, reviews of 70e9e8f..efbbb26): the Claude lenses reliability and risk, 0 findings (recorded). Codex,
  "the patch is incorrect", four P2: an escaped `\;` or `\&` was taken as a joiner (a false refusal); a wrapper's
  options (`command --`, `env -u DEBUG`), a leading redirection (`>push.log git push`) and git's `--git-dir`/
  `--work-tree` values hid the step. All four fixed in `bin/lib/guard.mjs`: `shellWords` takes a backslash before `;`,
  `&` or `|` as a character, and the `&` of `2>&1` stays in its word where `redirections` is off (its other callers'
  tests, guard and merge-queue-waits, pass); `guardedStep` skips redirections and the options of each wrapper and of
  git that take a value. gentle-ai's stop hook offered the whole branch: its status was read and nothing started
  (CLAUDE.md, a candidate is never the whole branch). `bin/lib/guard.mjs` is 988 lines, 12 under the size limit.
- L7 (2026-10-31, reviews of efbbb26..4a3bc314): Codex, "the patch is correct" (0.94), its 4 findings fixed. The
  reliability lens, 0 findings; the risk lens, one WARNING: `\\;` (an escaped backslash, then a real `;`) hid the
  joiner. The independent verifier (91/91, the hook's route right, no regression in `shellWords`' other callers by
  running the old module beside the new on 16 commands) found the same miss, three false refusals that `shellWords`
  had before (`\"` inside double quotes, the `'\''` idiom, an odd `"` in a heredoc's body inside `"$(...)"`) and
  low misses. Fixed: a backslash outside quotes escapes `;`, `&`, `|`, a quote or a backslash, and inside double
  quotes a `"` or a backslash; the `&` after a quoted `>` is an operator; `if`, `elif`, `while` and `until` are
  looked through; `timeout`, `nice`, `time -p`, `npx` with options or a version and `pnpm exec`/`dlx` are wrappers.
  Left, written as known: an odd `"` in a heredoc's body inside `"$(...)"` (it needs the context stack of
  `backticksInDoubleQuotes`; it costs one retry joined by `&&`); `eval`, `xargs`, backticks and `$(...)` holding a
  step, and `bash -c`/`powershell -Command` strings (out of scope); the verifier's design notes as L4 states them
  (`a; b && git push` passes, since only the operator right before the step counts; `set -e` scripts are refused).

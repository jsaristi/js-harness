## Goal
What a commit's gate publishes is a decision written in `harness.json`: the tree of a commit being made goes to the
remote only where the project's `remoteGate` switch lets it, which this repository declares on and a public project
that says nothing does not.

## Why
Every commit of a project that holds `.github/workflows/gate.yml` pushes its staged tree to `gate/<sha>` before the
commit exists, and nothing reads a project setting on that path (the audit's M1). This repository is public, so the
tree is visible for the length of the run, and a commit the gate refuses was published all the same. He chose to keep
that here and to write it down (question 1 of the triage, option 1), so that another public project does not inherit
it unasked. The same answer covers a rule on GitHub that forbids a force-push and a deletion of `main` (L6): that one
is a setting of his account, so this work only hands him its command.

## Done when
- `node --test bin/lib/ci-gate.test.mjs` exits 0
- `node --test bin/lib/functions.test.mjs bin/functions.test.mjs bin/lib/wrapped-commit.test.mjs` exits 0
- `node --test scripts/github-ruleset.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness notify --to orchestrator --kind ready --pr <n>` records the notice
- The pull request's body holds the one command that creates the rule on GitHub, the one that reads it back and the
  one that undoes it, and says that they wait for his hands.

## In scope / Out of scope
- In: bin/lib/functions.mjs (the switch), bin/lib/ci-gate.mjs (read before the push), bin/lib/wrapped-commit.mjs and
  bin/guard.mjs (the hint follows the switch), the one line of the orchestrator skill that says where a commit's gate
  goes (bin/lib/manifest.mjs), their tests and the tests that list the switches or stand in for the remote gate,
  harness.json (declared on), README.md, docs/SPEC.md and docs/RECORDS.md where they describe the switches or the
  remote gate, `.github/rulesets/main.json` (the body of the rule he sends) with its test, this document, the
  session's summary.
- Out: any setting of GitHub (the rule on `main` is his account's: the pull request's body carries its command and
  nobody runs it for him); making the repository private and asking pull requests on GitHub (his answer says a yes
  does not cover them); the three `gate/*` and two `queue/*` branches left on `origin` (deleting a remote branch is
  not asked; named in the pull request); the merge queue's `queue/*` push (a candidate holds only heads already
  pushed); `JS_HARNESS_MERGE_QUEUE` in `.githooks/pre-push` (the queue needs it).

## Constraints
- A switch that cannot be read keeps the tree here — because the neighbour `pushUnasked` says it: it must never push
  unseen.
- The switch is read in the function that pushes, before any git object is written — because M1 is that the path
  reads nothing, and a guard only in a caller is skipped by the next caller.
- This repository behaves as before, declared on — because that is his answer; option 2 (off in public
  repositories) was the one he did not take.
- Nothing is pushed to test it: a bare remote on disk and a stand-in for `gh`, as bin/lib/ci-gate.test.mjs does.
- An independent verifier reads the publish path — because the triage names high-risk items 2 and 3.

## Ask me before
- Nothing beyond the brief. A decision of his that the triage did not put to him goes to the lead as one notice.

## Depth pass
- 1. Method: a release engineer's, on an egress control. The standard: what leaves the machine is allowed by a
  declaration the owner wrote, read at the point of egress, and anything unreadable or unknown fails closed (stays
  local); the default is the safe one where the exposure exists (a public repository) and unchanged where it does not
  (a private one); and the control is tested against the real mechanism, a real `git push` to a remote, in both
  directions: nothing on the remote when it is kept, the branch there and gone when it is let through. Smallest
  change: one more switch in the existing `"functions"` table, read by the existing reader, and one question to `gh`
  in the form the backup already asks it. Searched first (codegraph did not connect in this session, so by `git
  grep`): `pushUnasked` (a switch for a session's own push; prose only, read by no code path: `git grep -n
  pushUnasked -- bin` finds the table, its tests and two shipped texts), `visibility` (`bin/backup.mjs:466` reads it
  with `gh repo view <repo> --json visibility -q .visibility` and `bin/lib/backup.mjs:414-415` refuses what is not
  `PRIVATE` or could not be read: the same question and the same strictness, reused in form), `CI_GATE_ENV` (the
  machine's switch, an environment variable, no project setting), `js-harness rules` (no rule on what is published;
  `work-sessions-public` is about sessions).
- 2. Raw material: `bin/lib/ci-gate.mjs:59-64` (`ciGateWanted`: the environment, the index, the workflow, nothing
  of the project) and `:128-147` (write-tree, commit-tree, push `--no-verify`, delete); `bin/lib/functions.mjs:14-21`
  (the switches, with `pushUnasked`'s `strict: 'off'`) and `:162-172` (what `auto` resolves to);
  `bin/lib/project-functions.mjs:67-101` (the reader); `bin/lib/wrapped-commit.mjs:110` (a hint worded by the same
  conditions); `bin/merge-queue.mjs:854`, `:358` and `:649` (the land builds its candidate on `origin/main` by
  merges and pushes it to `main` with `--force-with-lease`); `.githooks/pre-push:8-17` (L6); the audit,
  `docs/audits/2026-11-09-fable-5-2-audit.md:125-131` (M1) and `:309-310` (L6); the triage,
  `docs/proposals/2026-11-10-audit-triage.md:203-212` (unit 8) and `:270-282` (question 1); his words, transcript
  `ea85ec35-82e1-4aa9-abe3-98bd153a50b0` lines 6716 and 6905; GitHub's REST reference for rulesets,
  https://docs.github.com/en/rest/repos/rules (the body of `POST /repos/{owner}/{repo}/rulesets`, the rule types
  `deletion` and `non_fast_forward`, and `GET /repos/{owner}/{repo}/rules/branches/{branch}`).
- 3. The bar:
  spec 1: `node --test bin/lib/ci-gate.test.mjs`: none, new behaviour (today `git grep -c remoteGate -- bin` finds
  nothing, and `git grep -n "harness.json\|functionsOf" -- bin/lib/ci-gate.mjs` finds no line: the push reads no
  project setting).
  spec 2: `node --test bin/lib/functions.test.mjs bin/functions.test.mjs bin/lib/wrapped-commit.test.mjs`: none, new
  behaviour (six switches today, none of them about the remote gate).
  spec 3: `node --test scripts/github-ruleset.test.mjs`: none, new behaviour (the body of the rule; the rule itself
  waits for his hands: `gh api repos/jsaristi/js-harness/rulesets --jq length` prints 0 today and will print 1 only
  after he runs the pull request's command).
- 4. Refutation: two things could show the request does not hold. That nothing is exposed: `gh api
  repos/jsaristi/js-harness --jq .visibility` printed `public`; `gh api repos/jsaristi/js-harness/rulesets --jq
  length` printed 0; `gh api repos/jsaristi/js-harness/branches/main/protection` answered 404 "Branch not
  protected"; `git ls-remote origin "refs/heads/gate/*" "refs/heads/queue/*"` printed 5 lines (3 `gate/`, 2
  `queue/`, one of them a land running then). All run on 2026-11-11: the exposure is there. That the rule would break
  the land: read, not run, since it cannot be run without applying the rule. The land's candidate starts at
  `origin/main` (`bin/merge-queue.mjs:854`) and only adds merges (`:358`), so its push (`:649`) is a fast-forward;
  a server judges a ref update by its old and new commits, which is all the git protocol sends it, so
  `--force-with-lease` on a fast-forward is not what `non_fast_forward` refuses. Not known until his first land
  after the rule; the pull request gives the command that undoes it.
  Verdict: supports
- 5. Request: add to `harness.json` `"functions"` a switch, `remoteGate`, that says whether the tree of a commit
  being made may be pushed for its gate: `on` always, `off` never, `private` only where GitHub says the repository is
  private, and `auto`, what a project that says nothing has, read as `private`; read it in the function that pushes,
  before anything is written, and keep the tree here when it is off, when the repository is not private, or when
  either cannot be read; declare it `on` in this repository; show it in `js-harness functions` and say it in the
  README, the SPEC and the records; prove it with a real push to a bare remote, in a public repository that says
  nothing (nothing on the remote), one that declares on (pushed and deleted) and a private one that says nothing
  (pushed); and write in the pull request the command that forbids a force-push and a deletion of `main` on GitHub,
  with the one that reads it back and the one that undoes it, for him to run.
  Adds: none

## Specs
1. Question 1 of the triage, as it wrote it (`docs/proposals/2026-11-10-audit-triage.md:270-282`): "Cada commit de
   js-harness sube primero una copia de lo que tienes en stage a GitHub, en una rama `gate/…` que se borra al
   terminar, para correr las pruebas allá. El repositorio es público, así que esa copia queda visible un rato, aunque
   el commit se rechace. Además, `main` no tiene ninguna protección en GitHub: lo único que impide un push directo es
   un hook local que una variable de entorno apaga. ¿Qué hacemos?" Answered with its recommended option 1:
   "Escribirlo como decisión y proteger main (Recomendada). Un interruptor en `harness.json` que en este repo queda
   encendido y en otros proyectos públicos arranca apagado, y en GitHub una regla que solo prohíbe force-push y
   borrar `main`. Un sí cubre ese interruptor con su prueba y ese ajuste de GitHub. No cubre hacer privado el repo ni
   exigir pull requests en GitHub, que rompería la cola de merge." The answer is his, typed in the lead's chat
   (transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`): line 6716, 2026-11-11T05:26:36Z, "une lo que quede listo y
   tienes autorizacion para poder avanzar en todo y escoger siempre la opcion recomendada, no preguntes, avanza y se
   completamente autonomo."; line 6905, 2026-11-11T05:30:20Z, "contesta TODAS las preguntas con recomendado TODAS y
   avanza los mas posible eres completamente autonomo".
2. "You build the switch in harness.json with its test and its documentation." (the brief, 2026-11-11T09:27Z), with
   the triage's proof: "`node --test bin/lib/ci-gate.test.mjs` exits 0 with a case where a public repository with
   the setting off pushes nothing".
3. "The GitHub rule is a security setting of his account and nobody applies it for him: write in the pull request
   body the one exact command (gh api) that forbids force-push and deletion of main and nothing else, with the
   command that reads it back and the one that undoes it, and say that it waits for his hands." (the same)

## Design
- D1 (specs 1, 2). The switch is `remoteGate` in `SWITCHES` (bin/lib/functions.mjs): values `auto`, `private`, `on`,
  `off`; fallback `auto`; strict `off`. `auto` resolves to `private`, as `codeMap`'s `auto` resolves to one of its
  declared values. No file of the project decides it, so the resolver stays pure: the visibility is asked where the
  push is made.
- D2 (spec 1). bin/lib/ci-gate.mjs gains `remoteGateKeeps({ cwd, remote, env, gh })`: why the tree stays here, or
  null. `on`: null. `off`: kept. `private`: for every place the push goes to (each push URL of the remote, after
  git's rewrites; L8), `gh repo view <owner/name> --json visibility -q .visibility`, the form bin/backup.mjs asks it
  in; anything but `PRIVATE` (public, internal, a read that failed, a destination not on GitHub) is kept. `runCiGate` asks it after it knows the repository and before `write-tree`, so no caller can push past it;
  `testsOnCi` asks it first too, so the line "the push of the tree being committed starts their run" is never printed
  for a tree that stays, and a tree kept by the switch leaves no `ci-fallback` line (CI was never asked). The second
  question to `gh` costs about a second and only in a private repository that declares nothing, on a path that then
  waits minutes. `ciGateWanted` answers null where the switch is off, as it does for `JS_HARNESS_GATE_CI=0`.
- D3 (spec 1). `harness.json` is read from the working tree at the project's top, as `checkFunctions` reads it for
  the same gate. The switch is the owner's written decision, not a barrier against a session: a session that edits it
  could as well push.
- D4 (spec 2). `wrappedCommitHint` says "it could not go to GitHub's machines" only where the switch reads `on`:
  under `private` the answer is not known without `gh`, and the short hint is true either way.
- D5 (spec 3). The rule is a repository ruleset (the triage's proof counts rulesets), named for what it does, on
  `refs/heads/main` alone, with the two rule types `deletion` and `non_fast_forward` and no bypass actor. Its body is
  a file of the repository, `.github/rulesets/main.json`, sent with `gh api --input <file>`, the form `gh api --help`
  shows for a ruleset: the command is then the same in every shell, the body is the record of what was asked of
  GitHub, and `scripts/github-ruleset.test.mjs` holds it to those two rules (L6 below says why not standard input).

## Tasks
- [x] T1 (docs) this document: the contract, the depth pass, the specs and the design, committed with documents alone.
  `2eec546f`
- [x] T2 (build) specs 1 and 2: the switch, read before the push, declared on here, with its tests first and its
  documentation; Codex and the lenses on the slice. `c0d570d3`, `2abc371a`, `445a43c4`
- [x] T3 (verify) an independent verifier reads the publish path (high-risk items 2 and 3). `576e0369`, `53c1702f`
  and the commit of L15
- [ ] T4 (docs) spec 3: the pull request with the three commands; the session's summary; the ready and closed
  notices.

## Log
- L1 The brief (2026-11-11T09:27Z), as written: "You own one feature: what a commit publishes, written as a decision
  (the triage's work unit 8)."
- L2 His answer to question 1 is the recommended option, by his two lines of 2026-11-11 (Specs, 1), checked with
  `js-harness sessions --quote ea85ec35-82e1-4aa9-abe3-98bd153a50b0 6905` and `... 6716`: both read as the brief
  quotes them.
- L3 Reading of "en otros proyectos públicos arranca apagado", mine: a project that says nothing is kept here where
  its repository is public or its visibility cannot be read, and goes to the remote gate as today where GitHub says
  it is private. His words name public projects only; a private one publishes nothing, and leaving it as it is
  breaks no project that already relies on the remote gate.
- L4 Found while reading the land: it pushes `main` with `--force-with-lease` (`bin/merge-queue.mjs:649`). The push
  is a fast-forward, so the rule should let it through (Depth pass, 4); it is read and not run, and said so in the
  pull request beside the command that undoes the rule.
- L5 State (2026-11-11, JH 180): T1 committed, `2eec546f`. T2 written: the gate's tests first (red: the test file
  failed to load, `remoteGateKeeps` not exported), then the code; `node --test bin/lib/ci-gate.test.mjs` 16 of 16,
  and the switch, hint and stubbed-gate tests 77 of 77, `bin/guard.test.mjs` 39 of 39. Not red first, said plainly:
  the switch's own cases in bin/lib/functions.test.mjs and the ruleset body's test were written with their code in
  one step. Left: the whole gate at the commit; Codex and the lenses; then T3 (the verifier) and T4 (the pull request
  with the three commands, summary, notices).
- L6 The body on standard input was my first design and it was wrong for his machine: checked with a script that
  pipes the same line to a JSON parser, Windows PowerShell puts a byte-order mark before a piped string, which is not
  valid JSON (`SyntaxError: Unexpected token`), while bash does not. So the body is a file (D5), with no mark, and
  the test refuses one.
- L8 Codex on `2eec546..c0d570d` (one part, 140,152 input tokens): "the patch is incorrect", one finding, P1, taken.
  The visibility was asked of the one URL `git config --get` answers, while a push goes to every push URL of the
  remote, each after git's rewrites (`insteadOf`), so a public destination beside a private one, or behind a rewrite,
  was published to under the default. Fixed: under `private` every place the push goes to (`git remote get-url --push
  --all`) must be a GitHub repository that reads `PRIVATE`; a destination that is not GitHub's, or that git cannot
  name, keeps the tree, and a password in its URL is not printed. Tests first, red (2 of 17), then 17 of 17. To push
  for real to a destination git itself calls GitHub's, the tests of the default make git's ssh a script that serves
  the bare remote on disk (`GIT_SSH_COMMAND`), with no rewrite.
- L9 The first gate of `c0d570d3` was red on GitHub's machines: three tests of bin/rules-coverage.test.mjs. Read
  before anything ran again: the orchestrator skill's line I edited (L7) is an owed span the coverage register holds
  by its fingerprint, and the command names its fix, `js-harness rules coverage --refresh` (one fingerprint changed
  in bin/lib/rules-coverage-data.mjs). The second gate ran here, GitHub not answering then, and passed.
- L10 Codex on `c0d570d..2abc371`: "the patch is correct" (0.96), the P1 fixed. The Claude lenses (risk,
  resilience, readability, reliability) on `c742cbe..2abc371`: risk 0 findings; 5 from the others, three matters.
  (a) Taken: a visibility `gh` could not read was handled as a decision and left no `ci-fallback` line; now
  `remoteGateKeeps` answers `{ why, known }`, only a decision (`known`) ends the gate's try, and a failed read goes on
  to `runCiGate` and falls back as any gate with no answer (test in bin/check-ci-gate.test.mjs; written with its
  code, not red first). (b) Answered, three lenses: a switch read as off by an unreadable harness.json runs here with
  no line of this path. `checkFunctions` (`bin/check.mjs:1615`, a static row at `:1848`) fails that gate before any
  sensor and names the error; said in `ciGateWanted`'s comment, and that row's line, which said "every switch is read
  as on", now says what is true. (c) Answered: the visibility is read twice under `private`; kept, since the guard
  must sit in the function that pushes; one read measured 0.62 s (`time gh repo view ... --json visibility`).
- L11 NEXT STEP (state at the context pause, 87 %, 2026-11-11): the fix of L10 is in the working tree, NOT committed;
  tests green one file at a time (ci-gate 17, check-ci-gate 7, check-functions 15). Then, in order: (1) commit it
  (`fix(ci-gate): a visibility that could not be read is a fault, not a decision`); (2) `js-harness codex-review
  --base 2abc371a --doc odd/tasks/publish-decision.md` and `js-harness lens-review --base 2abc371a --lenses
  resilience,reliability --reason ... --doc ...` on that commit; (3) T3, one independent verifier (a general-purpose
  sub-agent, read-only) on the publish path: can any tree reach a non-private destination under `private`, `off` or
  an unreadable switch; (4) push the branch `worktree-publish-decision`, open the pull request with the body drafted
  at `C:\Users\Oficina\.claude\jobs\dc1b9411\tmp\pr-body.md` (its "Checked" section still a placeholder: the gates,
  Codex's two reviews, the lenses, the verifier), title `feat(ci-gate): a project decides whether a commit's tree is
  pushed for its gate`; (5) the session's summary (`js-harness summary path`), `js-harness notify --to orchestrator
  --kind ready --pr <n>`, then `--kind closed --summary <file>`; tick T1 to T4 with their commits (T1 `2eec546f`, T2
  `c0d570d3` and `2abc371a`).
- L12 Steps 1 and 2 of L11 done: `445a43c4`, gate green. Codex on `2abc371..445a43c`: correct (0.93), no finding.
  Lenses (resilience, reliability) on it: the 4 earlier findings fixed; one suggestion, answered and not changed: on
  a failed read the line "the push ... starts their run" comes before the fallback line. That order is the one any
  `gh` failure had before this work (`gh cannot read the runs ... so nothing was pushed`), and nothing is pushed.
  NEXT: step 3 of L11 (the verifier), then 4 and 5.
- L7 The hint of a commit wrapped in `js-harness gate --` and the orchestrator skill's line both said a commit's gate
  goes to GitHub "in a project that holds the workflow"; with the switch that is true only where it lets the tree be
  pushed, so both follow it: the hint claims it only where the switch reads on, the skill's line names the switch.
- L13 T3, the independent verifier (one general-purpose sub-agent, read-only, on `445a43c4`; it ran its cases in a
  scratch folder against bare remotes on disk and a stood-in `gh`). It found three states in which a tree was pushed
  that the switch should have kept, each a reading of the wrong thing, and each checked by me before the fix
  (`githubRepository` answered `o/r` for such a URL; `GH_HOST=<another host> gh repo view github.com/<o>/<r>` still
  answers for github.com). All three taken, tests first (red: 7 of 19 in bin/lib/ci-gate.test.mjs, then 19 of 19):
  (1) the host of a URL: what stood before `@github.com` was read as a user name whatever it held, so a URL whose
  real host comes before a `#`, a `?` or a `\` read as GitHub's; a user name is now only the characters a URL allows
  there. (2) the GitHub that `gh` asks: a bare `owner/name` is asked of the host of `GH_HOST`; the visibility is now
  asked of `github.com/<owner>/<name>`. (3) the folder harness.json is read from: the gate asked from a folder below
  the top read no switch there and fell to the default; the switch is now the one at the top of the working tree
  (`git rev-parse --show-toplevel`), and a folder git knows no working tree of keeps the tree. Its two lesser cases:
  a switch misspelt (`remotegate`) is an error the gate's `functions` row fails on, yet the value fell to the default
  and the tree went to a private repository; taken, a harness.json with any error in its switches now reads off
  here, which also makes that row's line true ("nothing is pushed ... for the remote gate"). A top-level key
  misspelt (`Functions`) raises no error anywhere; answered, not changed: harness.json's other keys are not this
  feature's to refuse, and such a project has the default, which publishes only where GitHub says private. What
  held, by its runs: every other shape of the switch read off with no git write; several push URLs, `pushInsteadOf`,
  `insteadOf`, other remote names and look-alike hosts all kept; nothing but `write-tree`, `rev-parse` and
  `commit-tree` runs between the guard and the push; no other caller in bin/ pushes a staged tree; the land's push is
  a fast-forward. Not guarded, and said in the pull request: an ssh alias for `github.com`, `core.sshCommand`, a
  proxy or a hosts file sends a URL that names github.com elsewhere; those are the machine's own settings, and the
  guard reads what git names, not where the network goes.
- L14 The fix of L13 is `576e0369`, gate green on GitHub's machines. Codex on `445a43c..576e036`: "the patch is
  correct" (0.9), no finding, 71,854 input tokens. The Claude lenses (risk, resilience, reliability) on it: risk 0;
  resilience repeats its suggestion of L12 (the order of two lines after a failed read), answered there and not
  changed; reliability one warning, taken: for a URL whose host stands before a `#`, the line that says why the tree
  stays named the name after the `@`, not the host git would go to. Writing its test showed two more of the same
  line, both older than this fix: `runCiGate` printed a remote that is not GitHub's as it is written, its password
  included, and a password holding such a character was printed in half. `withoutCredentials` now names the host as
  git reads it and leaves out what could be a password, and both lines go through it. Test first (red: the line read
  `https://example.invalid#@github.com/o/r`, then `https://user:se`), then 19 of 19.
- L15 That fix is `53c1702f`, gate green on GitHub's machines. Codex on `576e036..53c1702`: correct (0.93), no
  finding, 39,552 input tokens. The lenses (risk, reliability) on it: reliability's warning fixed; risk one
  suggestion, taken: the new pattern did not match a URL that holds a line break, which git's configuration can, and
  such a URL was printed whole, password included, where the pattern it replaced took the password off. One flag
  (`s`), test first (red: the line read `https://user:secret@example.com/o/` and the rest), then 19 of 19.
- L16 Close, against the depth pass. Item 3, the bar: predicted none of 3 (new behaviour), measured 3 of 3: spec 1
  `node --test bin/lib/ci-gate.test.mjs` 19 of 19; spec 2 the three files, run one at a time since a second session's
  gate held the machine, 30, 16 and 7, none failing; spec 3 `node --test scripts/github-ruleset.test.mjs` 2 of 2.
  Item 4, the refutation: the exposure stands as measured (the repository reads `public`, no ruleset, `main` not
  protected), and the verifier's own reading of the land agrees that its push is a fast-forward; whether GitHub's
  rule lets `--force-with-lease` on a fast-forward through is still not known, and will be only at his first land
  after he applies the rule. What was not red first, said once more: the switch's own cases in
  bin/lib/functions.test.mjs, the ruleset body's test and the `{ why, known }` cases. What the work cost in reviews:
  Codex five runs (140,152 + 45,956 + 81,355 + 71,854 + 39,552 input tokens) and the one of L15's commit; the lenses
  five runs and that commit's; one verifier.

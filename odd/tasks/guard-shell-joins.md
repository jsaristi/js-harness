# guard-shell-joins

Locator: `odd/tasks/guard-shell-joins.md` · Branch: none yet (written on `docs/plan-guard-shell-joins`, documents
only) · Session: a docs writer of JH ORQ, unit B1 of the lead's night plan 2 (2026-11-23) · Test runner: `node --test`

## State
Written 2026-11-23 as a plan, documents only, nothing built. Owed first: this document's double review
(`rule:double-review`, a blind Claude read and a Codex read). Its Codex reader is held until the weekly reset,
planned for 2026-11-23 23:45, and nothing is built before that review. The build also waits for open PRs 945, 950
and 951, which hold `bin/guard.mjs` and `bin/guard.test.mjs`. Next after both: T1 and T2. Open: T1 to T7.

## Goal
`js-harness guard --hook` refuses three Bash shapes it lets through today: a `&` that sends a step to the background,
steps joined by `;` or a line break in the scope T2 fixes, and a backtick in a double-quoted string after a run of
backslashes that the host and bash read differently.

## Why
Each shape ran on main in the last four days with the guard on, and each failure's control is a protocol line or owed
(`docs/FAILURES.md:242-288`, `:654-659`, `:2702-2713`). The guard already holds the narrow forms: a push, a commit, a
pull request, a land or a notice after `;`, a line break, `||` or `&` (`bin/lib/chained-step-guard.mjs:96-125`), and
a live backtick in double quotes (`bin/lib/guard.mjs:265-341`). The slips are what those checks leave out.

## Done when
- `node --test bin/lib/chained-step-guard.test.mjs bin/lib/guard.test.mjs bin/guard.test.mjs` exits 0
- `js-harness rules check` exits 0, with the rule `chained-steps` widened through `js-harness rules change`
- `js-harness failures check` exits 0
- `npm run check` exits 0
- The entries `chained-step-not-conditional`, `double-quotes-ran-backticks` and `wait-backgrounded-with-ampersand`
  each have a `Control: check` line naming a test of this change.
- The change is on main through a pull request that passed Codex and the Claude lenses, and an independent verifier
  read it (a guard is high risk, item 2).

## In scope / Out of scope
- In: `bin/lib/chained-step-guard.mjs` and its test; a new sibling module for the backtick run, with its test;
  `bin/guard.mjs` (the route only) and `bin/guard.test.mjs`; the rule `chained-steps` through `js-harness rules
  change`; the three entries' Control lines in `docs/FAILURES.md`; the Later line in `docs/ROADMAP.md`; this document.
- Out: the rule `background-task-declared`, which is his (owner `sebastian`, `bin/lib/rules-data.mjs:71-79`); text
  inside a quoted argument (`bash -c "a; b"`, `powershell -Command "..."`), as `guard-chained-steps.md` left it out;
  the PowerShell tool; other projects (the rule is of repository scope, `bin/lib/rules-data.mjs:84`).

## Constraints
- New code goes beside `bin/lib/guard.mjs`, not in it, because it has 996 lines of a 1,000-line limit
  (`bin/conventions-structure.test.mjs:31`).
- Reuse `shellWords` (`bin/lib/guard.mjs:385`) and `programOf` (`bin/lib/chained-step-guard.mjs:64`), because the
  guard's Bash checks share one splitter and AGENTS.md asks to amend before adding.
- The rule `chained-steps` belongs to the project (`bin/lib/rules-data.mjs:80-88`), so it changes on a `rule/` branch
  in one commit with `js-harness rules change chained-steps`, with no owner quote needed.
- Tests come first, and only the touched tests run before the gate, because the machine is short of memory.

## Ask me before
Nothing that is his, unless T2 wants a change to `background-task-declared`, which is his rule. Spend: one gate, one
Codex review, the Claude lenses and one independent verifier per code slice, plus this document's double review.

## Depth pass
- 1. Method: a guard refuses a shape exactly where its model of the shell matches what runs. The standard is the
  POSIX shell grammar (Shell Command Language, sections 2.2 and 2.9.3), read against what the host actually hands
  bash. The smallest change amends the existing checks over `shellWords`, with no second parser.
- 2. Raw material:
  - E1, read-only: why the guard let JH 272's backticks run. The command is transcript d36a9488, line 220 (JH 272,
    2026-11-21 09:39Z): a double-quoted `node -e` whose template literals carried `\\\`` before each inner backtick.
    Its result is at line 223: bash ran `claude plugin install`, `enable` and `update` with the literal id
    `${TYPESCRIPT_LSP}`, all three failed, and nine more spans ran as missing commands (`codex\`, `n/a\`).
  - The guard's walk takes a backslash outside single quotes as escaping the next character
    (`bin/lib/guard.mjs:289-294`), so `\\\`` reads as an escaped backslash and then an escaped backtick, and no span
    is found (`bin/lib/guard.mjs:295-305`). Probe, 2026-11-23: `backticksInDoubleQuotes` over the exact text of line
    220 gives `[]`, and `backtickRefusal` gives `null`. `bin/lib/guard.mjs` has not changed on main since b96c668f
    (2026-11-18), so the 2026-11-21 guard was this one.
  - POSIX agrees with the guard. The same string run by bash from a file stays literal: `printf '%s\n' "a
    \\\`echo SUBST3\\\` b"` prints `a \`echo SUBST3\` b`. Through the Bash tool, the same text ran the
    substitution and printed `a \SUBST2\ b`, and `echo "x \\\$HOME y"` printed `x \/c/Users/Oficina y`. So bash
    received one backslash fewer in a run of three than the hook judged.
  - E1's answer: the guard reads the command as POSIX bash would, but the host's Bash tool on this machine hands bash
    a different text. A run of backslashes before a backtick (or `$`) in double quotes comes out shorter, so a
    backtick the guard reads as escaped runs. Which layer shortens the run (the host's wrapper, or the MSYS
    command-line parser) and its exact rule are not known. "Each `\\` pair becomes `\`" fits all three outputs but is
    not proven. A single-quoted probe that would have told it apart was refused by this session's worktree check.
  - `chainedStep` refuses only a guarded step: `git push`, `git commit`, `gh pr`, `js-harness merge-queue` or
    `js-harness notify` (`bin/lib/chained-step-guard.mjs:49-59`, `:118-119`). The rule's subject says the same
    (`bin/lib/rules-data.mjs:82`).
  - The `;` sightings of 2026-11-22: JH 300 (`docs/FAILURES.md:274-277`) and JH 302 (`docs/FAILURES.md:278-282`),
    both read-only chains. The lead named the fix as "every chain with `&&`, read-only calls included"
    (`docs/FAILURES.md:281-282`).
  - The `&` sightings: `docs/FAILURES.md:2702-2713`. The 2026-11-22 launch is lead transcript d6383aea, line 34597:
    `js-harness wait --notice-to orchestrator > /dev/null 2>&1 < /dev/null &` followed by a line break and `echo`. The
    command does not end in `&`, so the Later line's wording (`docs/ROADMAP.md:955`) would not have caught it.
  - The Terminal tool returns before the backtick and chained-step checks run (`bin/guard.mjs:181-186`). The route
    for Bash is `bin/guard.mjs:234-248`.
  - The neighbouring feature: `odd/tasks/guard-chained-steps.md` (PR 734, all tasks done) built the narrow chained-step
    check, and its L7 lists backticks, `eval` and quoted strings as left out. No document holds the three shapes. The
    search was `git grep -l -e 'ending in' -e 'guard-shell' -e 'backslash run' origin/main -- odd/tasks` (the first
    pattern with its backticked `&`), which exited 1 with no file.
- 3. The bar:
  spec 1: `node --test bin/lib/chained-step-guard.test.mjs`: none for a background step today; probe:
  `chainedStep('js-harness wait --notice-to orchestrator &')` gives `null`.
  spec 2: `node --test bin/lib/chained-step-guard.test.mjs`: none for read-only chains today; probe:
  `chainedStep('git status; git log -1')` and `chainedStep('git push; git log -1')` give `null`.
  spec 3: `node --test bin/lib/guard.test.mjs`: none for a backslash run today; probe: JH 272's line 220 gives `[]`.
  spec 4: `js-harness rules check`: passes today with the narrow subject.
- 4. Refutation: the cheapest test was whether these shapes are rare enough to refuse outright. Measured on
  2026-11-23 with `node probe3.mjs <repo> 3`, a scratch script that counts only and calls `shellWords`, over the
  project's transcripts of the last three days: 63 transcripts and 8,913 Bash commands.
  - 2,847 commands (32%, in 61 transcripts) hold a `;` or a line break right before a step that is no compound
    keyword (`then`, `do`, `done`, `fi`, `esac`, `}`, `)`).
  - 9 hold a background `&`; none ends in one.
  - 13 hold a backtick inside double quotes after two or more backslashes.
  So spec 1 and spec 3 refuse little and hold. Spec 2 as the lead named it would refuse about a third of all Bash
  calls, while both of its sightings say nothing ran on a wrong answer, so its scope is a design decision (T2), not
  this plan's.
  Verdict: supports
- 5. Request: the guard refuses, where `chained-steps` is declared, (1) any unquoted `&` that sends a step to the
  background, wherever it stands, (2) `;` or a line break joining steps in the scope T2 fixes from the measure above,
  and (3) a backtick inside double quotes after a backslash run whose reading differs between the host and bash. The
  rule's subject is widened to match, and each failure's control becomes the check.
  Adds: none

## Specs
1. The Later line, as the lead wrote it (`docs/ROADMAP.md:955`): "The guard refuses a Bash command ending in `&`."
   Read with its 2026-11-22 sighting (lead transcript d6383aea, line 34597): a `&` that backgrounds a step, wherever it
   stands, is refused. The redirections `2>&1`, `&>` and `>&` stay allowed, and the refusal names the host's
   background run.
2. The lead's named fix for `chained-step-not-conditional` (`docs/FAILURES.md:281-282`): "every chain with `&&`,
   read-only calls included". Its scope (every step, or only steps whose failure changes what the next one does) and
   whether the Terminal tool is covered are fixed by T2.
3. `double-quotes-ran-backticks` (`docs/FAILURES.md:654-659`), with E1's cause: a backtick inside a double-quoted
   string after two or more backslashes is refused on Bash, where the guard's reading and what bash receives can
   differ. T1's measure narrows that to the run lengths that actually differ.
4. The rule `chained-steps` (`bin/lib/rules-data.mjs:80-88`) is widened through `js-harness rules change` to say what
   specs 1 and 2 refuse, and each of the three failures gets a check as its Control.

## Tasks
- [ ] T1 (kind: verify) measure through the Bash tool, in a session with no worktree check, how backslash runs of 1 to
  4 before a backtick, `$` and `;`, inside and outside double quotes, reach bash (harmless `echo` substitutions),
  and record the table in the Log — spec 3; inline; no commit beyond this document
- [ ] T2 (kind: design) fix spec 2's scope from the 2,847 of 8,913 measure, and whether specs 1 and 2 cover the
  Terminal tool, after this document's double review — spec 2; inline; one documents commit
- [ ] T3 (kind: build) the background `&` refusal in `bin/lib/chained-step-guard.mjs`, with its route and tests
  first — spec 1; inline; one commit, with T6's rule change on the `rule/` branch
- [ ] T4 (kind: build) the `;` and line-break refusal in the scope T2 fixed, in the same module, tests first — spec
  2; inline; one commit
- [ ] T5 (kind: build) the backslash-run refusal in a sibling module of `bin/lib/guard.mjs`, called from
  `backtickRefusal`, tests first and JH 272's line 220 as a case — spec 3; inline; one commit
- [ ] T6 (kind: build) `js-harness rules change chained-steps` with the widened subject, the three Control lines in
  `docs/FAILURES.md` (each old control moves to a `- Was:` line) and the ROADMAP Later line ticked — spec 4; inline;
  one commit
- [ ] T7 (kind: verify) gate, Codex review and Claude lenses per slice, an independent verifier on the last range,
  then the pull request and its ready notice — specs 1-4; verifier sub-agent; no commit

## Log
- L1 (2026-11-23, the lead's night plan 2, unit B1, as written): "odd/tasks/guard-shell-joins.md: three guard slips."
  No owner quote was found for this unit. The search was a grep of the full entries `chained-step-not-conditional`,
  `double-quotes-ran-backticks` and `wait-backgrounded-with-ampersand` (`docs/FAILURES.md:242-288`, `:654-659`,
  `:2702-2713`) and of `docs/ROADMAP.md:955` for "Sebasti", "his words", "his answer", "he asked" and quoted Spanish,
  with no hit. The words above are the lead's and the sessions'. His answer to question 135, quoted in
  `guard-chained-steps.md` L1, authorized the narrow check, not this widening. The covering order is the owner's
  line 16936 in the lead's transcript, as the lead's brief names it.
- L2 (2026-11-23, E1, read-only): the cause stands in the Depth pass, item 2. The probes ran as scratch scripts over
  the guard's modules and the transcripts and changed no tracked file. Three of this writer's commands were joined by `;`,
  against the "`&&` only" practice; all three were reads.
- L3 (2026-11-23, checked): `gh pr view` shows that PRs 945, 950 and 951 hold `bin/guard.mjs` and
  `bin/guard.test.mjs`. The other open PRs were not checked for `bin/lib/chained-step-guard.mjs` or
  `bin/lib/guard.mjs`. T3 checks them before its first write.

# JH 180 · what a commit publishes, written as a decision

## Goal
The audit triage's work unit 8 (`docs/proposals/2026-11-10-audit-triage.md`, findings M1 and L6): what a commit's
gate publishes becomes a decision written in `harness.json`, and the rule that protects `main` on GitHub is handed
to the owner as a command. Opened by the lead's brief of 2026-11-11T09:27Z
(`~/.js-harness/background/briefs/2026-11-11T09-27-53-139Z-0fa0a4d1.md`).

## The user's words
His answer to the triage's question 1 is its recommended option, by two lines of the lead's transcript
`ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, read with `js-harness sessions --quote`:
- line 6905 (2026-11-11T05:30:20Z): "contesta TODAS las preguntas con recomendado TODAS y avanza los mas posible eres
  completamente autonomo"
- line 6716 (2026-11-11T05:26:36Z): "une lo que quede listo y tienes autorizacion para poder avanzar en todo y escoger
  siempre la opcion recomendada, no preguntes, avanza y se completamente autonomo."

## Delivered
- Pull request 827, ready, not merged: https://github.com/jsaristi/js-harness/pull/827 (branch
  `worktree-publish-decision`, seven commits on `c742cbe5`).
- `2eec546f` the feature document alone, `odd/tasks/publish-decision.md` (contract, depth pass, specs, design).
- `c0d570d3` the `remoteGate` switch (`bin/lib/functions.mjs`), read before the push (`bin/lib/ci-gate.mjs`),
  declared on in `harness.json`; the hint and the skill line that follow it; README, SPEC and RECORDS; the body of
  the rule, `.github/rulesets/main.json`, with `scripts/github-ruleset.test.mjs`.
- `2abc371a` every place the push goes to must be private (Codex's P1).
- `445a43c4` a visibility that could not be read is a fault, not a decision (the lenses).
- `576e0369` the guard reads the host, the GitHub and the folder themselves (the independent verifier).
- `53c1702f`, `724f8e0b` the line that says why a tree stays names the real host and prints no password (the lenses).
- The three commands of the rule on GitHub are in the pull request's body and wait for his hands. No session ran
  the one that creates nor the one that deletes: `gh api repos/jsaristi/js-harness/rulesets --jq length` printed 0.

## Decisions
- The owner's: a switch on here and off in other public projects, and a rule that forbids only a force-push and a
  deletion of `main` (question 1, option 1; the feature document's Specs).
- This session's, each in the feature document: a project that says nothing has `private`, not `off`, so a private
  project that relies on the remote gate is not broken (Log L3); the switch is read in the function that pushes (D2);
  the rule's body is a file sent with `--input`, since Windows PowerShell puts a byte-order mark before a piped
  string (L6); a `harness.json` with any error in its switches reads off (L13).
- Answered and not changed: the visibility is read twice under `private` (L10); the order of two lines after a
  failed read (L12); a top-level key misspelt is not this feature's to refuse (L13).

## Failures and lessons
- The rule's body on standard input was wrong for his machine; found by piping the same line to a JSON parser in
  PowerShell before anything shipped (L6). The test now refuses a byte-order mark in the body.
- The first gate of `c0d570d3` was red: the skill line this work edits is fingerprinted in the coverage register.
  Read before a second run; `js-harness rules coverage --refresh` (L9).
- The guard as first written asked the visibility of one URL (Codex, L8) and, after that fix, still read three
  things by what stands for them: a URL's host, the GitHub `gh` asks, the folder of `harness.json` (the verifier,
  L13). None reached `main`. What held them: the reviews the brief asked for, each on its slice. The lesson for a
  guard of a publish path: read the destination as the tool that publishes reads it, and name the host to every
  client asked about it.
- The last fix of a message printed half a password in its own test before it was right, and its pattern then let a
  URL with a line break through (L14, L15): each found by a test or a lens before the push.

## Left
- The rule on GitHub: his hands (the pull request's body). Whether it lets the land's `--force-with-lease`
  fast-forward through is not known until his first land after it; the body gives the command that undoes it.
- The land of pull request 827: the lead. `main` gained 72 commits since the branch was cut; the merge is clean in
  memory (`git merge-tree --write-tree HEAD origin/main` exits 0) and the land's gate tests the merged tree.
- Three `gate/*` branches and one old `queue/*` branch on `origin`: not asked of this session, named in the body.
- Not guarded: ssh aliases, `core.sshCommand`, proxies (settings of the machine; said in the body).

## Cost
- Time: brief at 09:27Z, pull request at about 11:45Z on 2026-11-11. One compaction by the host at 11:13Z, resumed
  from the feature document.
- Context at the end: about a third of the window after that compaction.
- Codex: six runs, 416,892 input tokens (140,152; 45,956; 81,355; 71,854; 39,552; 38,023).
- The Claude lenses: five runs over the same slices. One independent verifier (a read-only sub-agent).
- Gate runs: nine commit gates, this file's commit included (one red, the coverage fingerprint), and the checks of
  two pushes.

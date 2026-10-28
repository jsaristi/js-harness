# F8 S10: the port (style, skills, permissions, guard)

Locator: `odd/tasks/f8-s10-port.md` · Engram mirror: `odd/f8-s10-port/tasks` · Branch: `worktree-f8-s10-port`
Delivery: chained pull requests, one a slice of about 400 lines · Test runner: `node --test`

## Goal
What gentle-ai gives a session here that we keep (the voice, two skills, the whole `permissions`
object) is ours: `install` writes it at user level and `init` into a clone, each recorded so
`uninstall` undoes exactly what it wrote, and `guard` refuses a file tool on a denied path.

## Why
S2 removes gentle-ai, and with it `gentleman.md`, its skills and, by its uninstall, the whole
`permissions` object of `~/.claude/settings.json` (reverse-engineering document, section 3).
The diet ports first and removes last (section 10, S10 row); his voice decision G10 (line 2466:
"la 7 la voz hazlo en neutro") says what the style is.

## Done when
- `node --test bin/lib/permissions.test.mjs bin/lib/manifest.test.mjs bin/lib/project-apply.test.mjs bin/lib/channel.test.mjs bin/guard.test.mjs bin/doctor.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s10-port.md` exits 0
- `npm run check` exits 0
- `## Probe` below records, in a scratch home: `install` writes the style, the two skills and the
  permissions; `uninstall` leaves the scratch home byte for byte as before; `guard` refuses a Read
  of a planted credentials path; five Spanish prompts under the style answer in tú with no voseo
  form, 5 of 5
- `js-harness merge-queue --dry-run` lists each pull request as ready, and Codex has no open finding

## In scope / Out of scope
- In: `bin/lib/manifest.mjs` (components, install, uninstall), a new `bin/lib/permissions.mjs`,
  the style and the two skills' text, `bin/lib/project-apply.mjs` (the clone's keys),
  `bin/guard.mjs` and `bin/lib/guard.mjs`, `bin/doctor.mjs` (the permissions row),
  `bin/lib/channel.mjs` (the question prefix), `THIRD_PARTY_NOTICES.md`, `docs/ROADMAP.md`, the
  diet's register, this document, their tests.
- Out: the real `~/.claude`, `~/.codex` and gentle-ai's configuration — applying S10 to his
  machine is his; `CLAUDE.md`'s ODD text (the directives pass wrote it); S2's removal; S11's
  complements; the Rules block until G12 is answered (question 99).

## Constraints
- Every test and probe runs in a `mktemp -d` home, never with a credentials file in it — because
  an eval broke his login on 2026-10-26 (diet section 9).
- A value found in his settings is never removed by `uninstall`: only what `install` wrote — because
  gentle-ai wrote the same 24 denies first, and an exact undo leaves them.
- `defaultMode` is never invented: it is adopted where he has one and put back only when it went
  missing — because `bypassPermissions` is his choice, not a default to ship.
- At most one gate, eval or review at a time — because the machine is shared and short of memory.

## Ask me before
G12, the Rules block (question 99, held by the lead). The incident rerun is the lead's planned
step (one run, ~$13 API-equivalent); if it fails, its cause is reported and it is not rerun.

## Specs
- S1 (diet S10 row): "our output style (neutral, tú; name G10n)"; "`install` writes style ... at user
  level; `init` selects the style ... all recorded".
- S2 (diet S10 row): "two skills (G8), each for its stated need, with license notices and
  `THIRD_PARTY_NOTICES`".
- S3 (diet S10 row): "the whole `permissions` object taken over (allow, `defaultMode`, the 24
  denies; recorded; a `doctor` row for a missing entry)".
- S4 (diet S10 row): "the deny paths into `guard`"; "`init` ... writes the deny list into the
  project's settings".
- S5 (diet S10 row): "G12's Rules block" — his; question 99.
- S6 (diet S10 row, probe): "a restarted session's `/context` shows our style active ... and our
  skills listed; five Spanish prompts get replies in tú with no voseo form (`vos`, `tenés`,
  `podés`, `querés`, `sabés`); `guard` refuses a read of a planted credentials path"; pass "5 of 5
  replies pass; incident set no worse".
- S7 (brief, owed from S1): "the notify prefix check (a question's text must begin 'Pregunta <n>: '
  with the number notify assigns; JH 62 numbered one by hand and got it wrong)".

## Tasks
- [x] T1 (kind: build) `notify` refuses a question whose text carries its own `Pregunta <n>:` — S7; inline; a1a84d74
- [x] T2 (kind: build) the `js-harness` output style, which `install` writes — S1; inline; the style-and-skills commit
- [x] T3 (kind: build) the two skills, adapted, with `THIRD_PARTY_NOTICES`, shipped in the package — S2; inline; the style-and-skills commit
- [x] T4 (kind: build) the permissions object held and recorded by `install`, undone exactly, and a `doctor` row — S3; inline; independent verifier; the permissions commit (PR 2)
- [x] T5 (kind: build) `guard` refuses a file tool on a denied path; a clone's `outputStyle` and deny keys — S1, S4; inline; independent verifier; the guard commit (PR 2)
- [ ] T6 (kind: verify) the probe in a scratch home, the five prompts, the incident rerun — S6; inline
- [ ] T7 (kind: build) the Rules block, once question 99 is answered — S5; waits

Reviews:
- gentle-ai on `d6867d86..883747f2`: medium, not due (under_budget, 918 lines).
- Codex on `d6867d8..883747f`, 2 parts: correct (0.93, 0.88), no finding; 228,432 input tokens.
- Lenses on `d6867d8..d90cd20`, two runs, each incomplete (no record covers it): run 1 risk answered more
  than one JSON object, reliability one WARNING refuted (it says THIRD_PARTY_NOTICES.md is not in the range;
  `git show --stat 883747f2` lists it: the packager leaves Markdown out), readability 0 findings; run 2 risk 0
  findings, readability 0, reliability answered more than one JSON object. Each lens answered clean once.
  The record keeps 300 characters of a refused answer, and both start as the object, so why `JSON.parse`
  refused them cannot be read; a skip is recorded (`--unavailable`), not a third run, and the lead has it (note,
  23:16Z).
- gentle-ai on `d90cd206..70e396b3`: medium, not due (under_budget, 245 lines).
- Codex on `d90cd20..70e396b`: correct (0.97), no finding; 69,913 input tokens.
- Lenses on `d90cd20..70e396b` (reliability, readability): complete, 0 findings.
- Lenses on `d6867d8..d90cd20`, run once more after PR 616 fixed the reader (L10): complete, the skip paid; risk 0
  findings; reliability and readability one WARNING each, the claim refuted twice before: `git show --stat 883747f2 --
  THIRD_PARTY_NOTICES.md` lists it (191 insertions) and `git grep` finds `ported-skills.mjs` in it; the lenses never see
  a Markdown file.
- T4's independent verifier (opus, read-only, scratch homes): sound in the normal flow; 5 defects, fixed test first in
  `e523ac72`: a settings file that cannot hold the permissions read as `unknown`, which the hook never announces (now
  `stale`); `"permissions": null` rewritten; an empty file left after a failed uninstall and a reinstall; every copy
  of a recorded entry removed (now one); a manifest edited by hand could name the user's entries (now only the lists').
- Codex on `c7445ca..e523ac7`, 2 parts: part 1 incorrect (0.96), 2 P2 fixed test first in `d0d68079` (the settings
  go back when the manifest cannot be written; emptied lists and the object still go); part 2 correct (0.93);
  199,164 input tokens.
- Lenses on `c7445ca..d0d6807` (risk, reliability, readability): reliability 0; readability a SUGGESTION (two doc
  comments stacked on `ourFile`) and risk a WARNING (a `defaultMode` put back in silence), both taken in the next
  commit (`cbce05e2`: install prints the mode it put back, and that a `defaultMode` of `"default"` keeps it
  out).

## Next step
State at 00:45Z, 2026-10-28: T5 committed (`f2480611`), T4's two lens findings taken in `cbce05e2`, both through
the gate. T5's independent verifier (opus, read-only) is running on `f2480611`. Then, one at a time: `js-harness
codex-review --base d0d68079^` (covers d0d68079, the T4 fix it owed, and T5), the lenses on `d0d6807..HEAD`
(`js-harness lens-review --base d0d6807`), then PR 2 on `f8-s10-permissions` (base `worktree-f8-s10-port`) with
L11's Read cost and the defaultMode note in its body; then T6; T7 waits on question 99.

## Log
- L1 (2026-10-27, the brief from JH ORQ): "You are JH 65 · F8 S10: port style, skills,
  permissions ... G8 and G10n are taken by default (the diet's register): two skills,
  `work-unit-commits` and `chained-pr`, each for its stated need, with license notices and
  THIRD_PARTY_NOTICES; the style is named `js-harness` (neutral, tú). G12 is his and blocking ...
  record G12 as a question ... and build everything that does not depend on it ... Never write to
  the real `~/.claude`, `~/.codex` or gentle-ai's config: build and test with a scratch HOME ...
  The permissions object and the deny list are security (high-risk item 2): an independent
  verifier".
- L2 (2026-10-27, read-only look at his `~/.claude/settings.json`): `outputStyle: "Gentleman"`;
  `permissions` holds `allow: ["mcp__codegraph__*"]`, `defaultMode: "bypassPermissions"` and the
  24 denies the reverse-engineering document lists. `~/.claude/skills` holds gentle-ai's
  `work-unit-commits` and `chained-pr`.
- L3 (2026-10-27, decision): our two skills are named `js-harness-work-units` and
  `js-harness-chained-prs`, not gentle-ai's names: written under those names, `install` would
  overwrite gentle-ai's own files in `~/.claude/skills` (out of scope, and `gentle-ai sync` would
  write them back), and the reverse-engineering document's section 3 says our copies use our names.
  They go to Claude only: Codex is only a reviewer here (D3).
- L4 (2026-10-27, decision): the machine's hook-entry engine cannot hold the denies, because it does
  not remember whether an entry was there before it, and `uninstall` would take gentle-ai's 24 out
  of his settings. `bin/lib/permissions.mjs` keeps its own record: each entry it wrote, each it
  found, and the `defaultMode` it adopted. The clone gets `outputStyle` and the deny list through
  `project-apply.mjs`'s keys in `.claude/settings.local.json`, the file a clone's switches already
  use, never the tracked `.claude/settings.json`.
- L5 (2026-10-27): G12 sent as question 99 (`notify` 22:43:09Z), with the default and the other
  option; held by the lead for his return.
- L6 (2026-10-27): `bin/lib/manifest.mjs` is over 1,000 lines with a ceiling that only goes down
  (`bin/conventions-structure.test.mjs`). Moving the first two skills' text out failed: 13 rules
  quote phrases at lines 110-248 of that file, and moving them is a `rules change` each. The hook
  entries (no rule phrase, no rule read) moved whole to `bin/lib/hook-entries.mjs`, which the
  engine re-exports: 2159 → 2008 lines with the three new components in.
- L7 (2026-10-27): `package.json` `files` shipped only `bin/`, so the notices never reached an
  install; Apache-2.0 section 4(a) asks that a recipient gets the license, so the package now ships
  `THIRD_PARTY_NOTICES.md` (its text from a local copy of the Apache License 2.0, 177 lines).
- L8 (2026-10-27, JH ORQ, 23:17Z): "yes, the lens reader gets a fix: JH 66 is open for objectOf in
  bin/lib/lens-result.mjs. Keep your skip as recorded and go on with T4. When JH 66 says the fix landed, rerun the lens
  review on d6867d8..d90cd20 once to clear it."
- L9 (2026-10-27, decision): the permissions live in `bin/lib/permissions.mjs`, as the contract names it, beside
  `user-settings.mjs`, whose reader they share; `SESSION_MESSAGES` and `userSettingsPath` moved there too, so the
  engine went down (1904 → 1898) with the permissions in. They are held on every `install` and `sync`, not on request:
  S2 takes them away whether or not anyone asked. A record `uninstall` could not release keeps the file the hooks
  made, as a kept setting does; `bin/install.test.mjs` found it (a `{}` left behind on the second run).
- L10 (2026-10-28, JH ORQ, 00:08Z): "PR 616 landed (main 212c7e1): the lens reader now takes one JSON object with prose
  around it ... rerun the lens review on d6867d8..d90cd20 once to clear the skip." Run 00:16Z, after the lead
  refreshed the installed copy.
- L11 (2026-10-27, measured at 23:49Z, and JH ORQ's answer to that note): with `Read` in the guard's matcher every Read of every session
  runs the hook: 334, 463 and 550 ms a Read on the installed command, against 157-178 ms for node's own start, three
  runs each. JH ORQ: "keep Read in the guard's matcher, as the spec says ... Write the measured cost ... into the PR
  body and the feature document: it goes to him on his return as a choice he can reverse. If a cheaper guard start is
  a small change, propose it as a follow-up; do not build it now." The follow-up to propose: a guard entry for Read
  alone whose command runs `bin/guard.mjs` directly, skipping the dispatcher (174-266 ms measured, against 328-383 ms
  through it).
- L12 (2026-10-28, decision): the lists and the paths `guard` refuses live in `bin/lib/deny-paths.mjs`, which imports
  nothing, because the hook now runs on every Read; `permissions.mjs` re-exports them. A place matches at any depth of
  the path, in any case, which is stricter than Claude Code's own reading of a relative deny (from the session's
  folder): a second layer refuses more, never less. `.credentials.json` is guarded beside the 24, not added to the
  denies the settings hold, which stay gentle-ai's list that `doctor` compares. A clone holds the style and the denies
  whatever its switches, and a value already there is kept, never overwritten; a record still has to hold the shipped
  list to be valid, so a later change of the list will need its own step for clones that recorded the old one.
- L13 (2026-10-28, T5's independent verifier, opus, read-only, on `f2480611`, and the decisions on it): two
  BLOCKERs, each checked here before a fix (`deniedPlace` returned null for `C:\Users\u\.ssh\.\id_rsa`,
  `/home/u/.ssh//id_rsa`, `.credentials.json::$DATA`, `.credentials.json\.` and `.ssh::$INDEX_ALLOCATION\id_rsa`,
  each of which Node's `fs` opens as the file on Windows): the guard read the path as text. Fixed test first in the
  next commit: the path is read as Windows opens it (dot segments, doubled separators, an NTFS stream, trailing dots
  and spaces) and matched segment by segment from its end, in linear time (the verifier measured the old pattern
  at 3.5 s on 16,000 segments, near the hook's 5 s); `MultiEdit`, `NotebookEdit` and `Grep` (its `path`, a file or
  the folder that holds a place of several segments) join the matcher. Left open and said in PR 2: 8.3 short names
  (`CREDEN~1.JSO`), a symbolic link a session makes, Bash (`cat`), Glob (names only), and a Grep of a folder above
  the one that holds a place (`.config` for `.config/gh/hosts.yml`); the denies of the settings are the first layer
  there. Three WARNINGs on the clone's denies, the commit after: a user's own entry in `permissions.deny` drops the
  record (uninstall then leaves the 24), a list already there never gets them (W5), and a record that must equal the
  shipped list breaks every clone's manifest when the list changes, in a format older copies call malformed (W6).
  Decided: the clone's denies become a list key, as the user settings' are (T4): the entries missing are added after
  the user's own, only those are recorded, uninstall takes out one copy of each, and the manifest's format goes to 3.
  NOTE 9 (a clone's `outputStyle` outranks the user's own style in `~/.claude/settings.json`) is what S1 asks
  ("`init` selects the style") and stays.

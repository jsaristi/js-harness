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
- S8 (JH ORQ's note, 2026-10-28 04:13 local, from PR 618 section 13.3 row 12): "before he applies S10, make install and
  sync leave a file we installed whose bytes he changed, and say so, as uninstall does ..., instead of overwriting
  it"; proof: "a scratch-home test where an edited installed skill survives install and sync with a note".
- S9 (the reverse-engineering document, 13.3 row 4, on main since PR 618): "**Adopt** for text we copy or ship: the
  style, the two skills, the lens prompts. A change to them changes its pin in the same commit"; proof: "the test fails
  when the text changes and the pin does not".

## Tasks
- [x] T1 (kind: build) `notify` refuses a question whose text carries its own `Pregunta <n>:` — S7; inline; a1a84d74
- [x] T2 (kind: build) the `js-harness` output style, which `install` writes — S1; inline; the style-and-skills commit
- [x] T3 (kind: build) the two skills, adapted, with `THIRD_PARTY_NOTICES`, shipped in the package — S2; inline; the style-and-skills commit
- [x] T4 (kind: build) the permissions object held and recorded by `install`, undone exactly, and a `doctor` row — S3; inline; independent verifier; the permissions commit (PR 2)
- [x] T5 (kind: build) `guard` refuses a file tool on a denied path; a clone's `outputStyle` and deny keys — S1, S4; inline; independent verifier; the guard commit (PR 2)
- [x] T6 (kind: verify) the probe in a scratch home, the five prompts, the incident rerun — S6; inline
- [x] T7 (kind: build) the Rules block (question 99 answered, L18; design L19) — S5; `f8-s10-rules`; PR 619, merged
- [x] T7a (kind: verify) Codex's finding left open by its recheck on `6df890e..4e28ec3` (the sibling readable by others until its chmod), fixed in `c7fe8137`: Codex reads it again from `d232c63a` (`--again`), since it runs no second recheck and no record covers `c7fe8137` — S5; inline
- [x] T8 (kind: build) `install` and `sync` leave an installed file he changed, and say so — S8; inline; `f8-s10-keep-edits`; PR 621
- [x] T9 (kind: build) the style and the two ported skills pinned by hash — S9; inline; `f8-s10-pins`; PR 623

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
- T5's independent verifier (opus, read-only) on `f2480611`: 2 BLOCKERs, 4 WARNINGs, 3 NOTEs (L13); the BLOCKERs and
  WARNING 3 fixed test first in `88b53455`, WARNINGs 4 to 6 in `1f607cb8`.
- Codex on `e523ac7..d0d6807`, run alone from a detached worktree at `d0d6807` (a recheck is one part, and
  `codex-review` has no `--head`): correct (0.96), its 2 findings fixed; 61,674 input tokens.
- Codex on `d0d6807..1f607cb`, 2 parts: part 1 correct (0.87); part 2 incorrect (0.97), one P2 (a sync whose manifest
  write fails took back every deny of the list, the ones the manifest on disk records too), fixed test first in the
  next commit: `applySettings` returns what the call alone wrote, and that is what a rollback undoes; 348,300 input
  tokens.
- Codex on `1f607cb..e2c38a1` (the recheck): correct (0.97), the P2 fixed; 39,680 input tokens.
- Lenses on `d0d6807..e2c38a1` (risk, reliability, readability, resilience): complete, 0 findings; about 172,500
  input tokens.
- gentle-ai: the Stop hook offered the whole branch from `d6867d86`; only its read-only status ran (`unrelated`, no
  change in the working tree), nothing started, as CLAUDE.md says of a branch.
- gentle-ai on `c7445caa..e2c38a15` (granted run): approved, 2 WARNINGs (L14).
- gentle-ai on `edcd2bfd..8c684535` (granted run): approved, 1 WARNING, fixed in `c9f3efd9` (L15).
- gentle-ai on `8c684535..e792eaab` (the code is `c9f3efd9`; granted run): approved, 1 WARNING and 1 SUGGESTION,
  both taken in `8b046c0f` (L18).
- Codex on `e792eaa..8b046c0`: correct (0.97), 47,536 input tokens; lenses (reliability, readability) 0 findings.
- gentle-ai on `e792eaab..8b046c0f` (granted run): approved, 1 SUGGESTION (the new test does not check the exit code
  of the `kept` case), taken in T7's first slice.
- T7's independent verifier (opus, read only) on `30ac3c3d..380b9e77`: 1 BLOCKER, 4 WARNINGs, all fixed test first
  in `d232c63a` (L20).
- gentle-ai on `cca493e0..d232c63a` (T7's slice; granted run): approved; its WARNING (the rename of his file is not
  tried again while Windows holds it) and its 2 SUGGESTIONs (a sibling name that is not exclusive; no command test of
  `updated` and of `kept` with exit 1) taken test first in the next commit.
- Codex's recheck on `6df890e..4e28ec3`: the link fixed, the mode half fixed (fixed in `c7fe8137`); lenses on
  `cca493e..c7fe813` (risk, reliability, readability, resilience): 0 findings.
- gentle-ai on `cca493e0..c7fe8137` (granted run, lineage review-397ff05feeb36359): approved; its WARNING (uninstall
  removes a link he put where the file install made was, and leaves the block in the file it names) and its SUGGESTION
  (no test of the rollback that removes a file install made) taken test first in the next commit.
- The fix is `8012d8d6`. Codex on `c7fe813..8012d8d`: correct (0.97), 56,228 input tokens. Codex again from
  `d232c63..2d246cf` (`--again`, T7a: no second recheck runs, and no record covered `c7fe8137`): correct (0.87), 74,433
  input tokens. Lenses on `c7fe813..2d246cf` (risk, reliability, resilience): 0 findings.
- gentle-ai on `c7fe8137..2d246cf7` (granted run, lineage review-f6a8781dedd4a885): approved, acknowledged; one
  informational SUGGESTION (R3-place-identity: `place === at` would fail if the path were ever normalized for a plain
  file) not taken: `realPlace` returns its argument itself for anything that is not a link (`rules-block.mjs:85-88`),
  so the two are the same string by construction, and the link test pins the other side.
- T8 is `98f91454`. Codex on `0d97e52..98f9145`: incorrect (0.96), one P2 (a recorded file that cannot be read was
  taken as missing and written over), fixed test first in the next commit with `bin/lib/component-write.test.mjs`; 111,434
  input tokens.
- The fix is `14649ec6`. Codex's recheck on `98f9145..14649ec`: the P2 fixed, correct (0.98), 31,903 input tokens.
  Lenses on `0d97e52..14649ec` (risk, reliability, resilience, readability): 0 findings. gentle-ai on
  `0d97e528..14649ec6` (granted run, lineage review-34b49ce5b2947003): approved, acknowledged; one SUGGESTION
  (R3-001: no command-level test of what an unreadable recorded file prints) not taken: that record is a `skipped` one
  without `edited`, whose line, stream and exit code `bin/install.test.mjs:398-427` already pin.
- T9 is `79d547c0`. Codex on `e078257..79d547c`: correct (0.98), 42,326 input tokens. Lenses on the same range
  (reliability, readability): 0 findings. gentle-ai on `e0782570..79d547c0` (granted run, lineage
  review-67493d5151f1f0a5): approved, acknowledged; none of its three taken. R3-001 and R3-002 (a CRLF checkout
  would change the digest) do not hold: each text is a template literal in its module, and `.gitattributes` checks
  `bin/**` out `eol=lf` (`git check-attr eol bin/lib/output-style.mjs`: lf). R3-003 (show the observed digest): a
  failed `assert.equal` already prints `actual` and `expected` under its message, seen with a scratch test.

## Probe
- Install and uninstall, in a scratch home (`mktemp -d`, no credentials file), from `f8-s10-rules` (L20, rerun after
  the verifier's fixes): `install` exit 0; the style `~/.claude/output-styles/js-harness.md` written; the skills
  written, the two ported ones among them; `permissions` holds allow 1 and the 24 denies; the Rules block written
  after his text, kept, with its 9 lines. `guard` denies a Read of a planted `~/.ssh/id_ed25519` and of
  `id_ed25519::$DATA`. `uninstall` exit 0, and the scratch home is byte for byte as before.
- Five Spanish prompts (L22): 5 of 5 pass. They were run in a scratch project that selects the style as `install`
  writes it, with `claude -p` (Claude Code 2.1.312, claude-opus-5-5) using `--setting-sources project
  --strict-mcp-config --tools '' --no-session-persistence`, and with the prompt on stdin. A reply passes when:
  - the session's `init` event names `js-harness` as its output style;
  - the reply answers the question (it names its subject and does not say the message was cut);
  - it holds no voseo form (`vos`, `tenés`, `podés`, `querés`, `sabés`, `mirá`, `dale`, `che`) and no `usted`;
  - it uses tú forms (e.g. `tienes`, `puedes`, `quieres`, `revisa`, `tú`).

  The run cost 0.12 USD API-equivalent, on his plan. Not checked here: a restarted session's `/context` listing
  the skills, since a run that loads no user settings loads no user skills; that is seen once he applies S10.

## Next step
None: S10 is closed (L26). PRs 615, 617, 619, 620, 621 and 623 are merged.

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
- L14 (2026-10-28, gentle-ai on PR 2's range, `c7445caa..e2c38a15`, its granted invocation run unasked): approved,
  medium, one lens (reliability), two WARNINGs. One fixed test first in the next commit: a record naming the user
  settings in another spelling (case, on Windows) was refused as another file and then dropped from the manifest,
  with a "could not read" message; now the path is compared as Windows does, a `kept` record stays recorded as a
  `failed` one does, and the message says why. The other is left open with L13's: a Grep of the project's root, or
  with no path, can read a `.env` in it, since only a folder that holds a place of several segments is refused; a
  root search is what most Greps are, so refusing it would stop the work, and the settings' `Read(.env)` deny is the
  layer there.
- L15 (2026-10-28, gentle-ai on `edcd2bfd..8c684535`, granted run): approved, one WARNING: a `kept` record that names
  another file stays recorded forever and fails every uninstall, since nothing the user does changes its path. Fixed
  test first in the commit after it: an unreadable settings file is `failed` (recorded, a run again once fixed), and
  a record naming another file is `kept`, dropped and said, its entries to remove by hand. Codex on
  `edcd2bf..8c68453`: correct (0.89); lenses (reliability, readability): 0 findings. Next step: commit this fix,
  review it (Codex, lenses, gentle-ai), push, write gentle-ai lines for PR 2 in Reviews, `ready --pr 617`; then T6.
- L16 (2026-10-28, state at the context pause): the L15 fix is `c9f3efd9`; Codex on `8c68453..c9f3efd` correct (0.93),
  lenses (reliability, readability) 0 findings. Next step: gentle-ai on `8c684535..c9f3efd9` (status with
  `--base-ref 8c684535 --committed-only --next-transition`, run its start, then the granted invocation, then
  `capture-result --agent=claude-code` with the collect arguments), then push, add gentle-ai lines to Reviews for
  `c7445caa..e2c38a15` (L14), `edcd2bfd..8c684535` (L15) and this range, and `ready --pr 617` when the merge queue's
  dry run takes it; then T6. T7 waits on question 99.
- L17 (2026-10-28, 21:37 local, JH ORQ's note, not yet checked against his words): "Q99 (G12) answered by him:
  install writes the recorded Rules block (his 9 D7 lines) into ~/.claude/CLAUDE.md, undone by uninstall. Go ahead
  with T7." Before T7: read his answer with `js-harness sessions --quote` (question 99). The host killed this
  session's background waits for low memory at 21:3x; the lead was told.
- L18 (2026-10-28): the host compacted this session at 21:41 local; the lead was told. gentle-ai on
  `8c684535..e792eaab`: approved; its WARNING (the `kept` message sent the user to the user settings, not to the file
  the record names) and its SUGGESTION (no test of the messages) taken test first in `8b046c0f`. Question 99 checked
  in his words (`js-harness sessions --quote 0f71b2c6 5233`, 2026-10-28T02:35:59Z): he tapped "Bloque de reglas
  (Recomendada)", which asked that install write into `~/.claude/CLAUDE.md` "un bloque pequeño y registrado con tus 9
  líneas de D7, que se puede deshacer con uninstall. No toca nada más de ~/.claude." T7 is open, on a branch after
  PR 2.
- L19 (2026-10-28, T7's design, on `f8-s10-rules`, PR 3): the nine lines are the nine under "Kept from the global
  file" in the root `CLAUDE.md` (his D7 answer); they live once in code, `RULES_LINES` of `bin/lib/rules-block.mjs`,
  and a test holds them equal to that section word for word. The block is the marked block of
  `bin/lib/project-template.mjs` (a mark with the hash of its lines, then an end mark), under a `## Rules` heading:
  install puts it at the end of `~/.claude/CLAUDE.md`, renders it again while unedited, and leaves an edited one as
  his; the record is `{ path, createdFile, separator }`, the text put before the block, so uninstall gives the file
  its bytes back; the file goes only when install made it and nothing else is left. A file that cannot be read or
  written is skipped by install and, on uninstall, a failure that stays recorded (exit 1), as the permissions are.
  Nothing else of `~/.claude` is written, and Codex's `~/.codex/AGENTS.md` is not touched: his answer names only the
  Claude file. Until S2 his other projects load these lines twice (gentle-ai's Rules list holds them too), about
  843 characters, about 210 tokens by chars/4 (its two marks add 138 more); S2 removes gentle-ai's. The block is high risk (it changes a file he already has, item 1): an
  independent verifier reads it after its checks. `manifest.mjs` sat at its ceiling, so the atomic write moved out
  first (`30ac3c3d`, -101 lines), and the ceiling ends at 1801, 97 under main's 1898.
- L20 (2026-10-28, T7's independent verifier, opus, read only, on `30ac3c3d..380b9e77`, 113,965 tokens): 1 BLOCKER,
  4 WARNINGs, 6 NOTEs, each reproduced in a scratch home unless said. BLOCKER 1: uninstall took the separator from
  before the block even with text after it, joining two of his lines (`"A"`, install, `"C\n"` appended, gave
  `"AC\n"`). WARNING 2: a separator compared byte for byte left a stray `\r` once his line ends changed. WARNING 3:
  the Rules block shared the project block's mark, so a project block in his file was rendered over (reproduced).
  WARNING 4: a write that failed partway truncated the file (read only). WARNING 5: a record edited by hand could
  take his text (`separator` set to his own line; `createdFile: "yes"`). All five fixed test first: the separator
  goes as line ends of either kind, at most as many as install put and never the last one before text that follows;
  the Rules block has its own mark (`js-harness rules`); the file is written through a sibling renamed over it; a
  record's separator must be one install writes and `createdFile` must be `true`. Kept as NOTEs, said here and not
  fixed: a manifest lost between the file write and its own write leaves one blank line at uninstall; a block he
  duplicated loses only its first copy; a block he moved to the top leaves one line end; a dangling link at the
  path is written through. Checked sound by it: `30ac3c3d` is a pure move (diff of the 103 lines); `renderBlock`
  behaves as before; rollback, the failed record, the uninstall order and exit codes. The probe, rerun after the
  fixes in a scratch home: install exit 0, his text kept, 9 lines; `guard` denies both spellings of the planted key;
  uninstall exit 0, the home byte for byte as before.
- L21 (2026-10-28, 22:50 local): gentle-ai on `cca493e0..d232c63a` approved, its findings taken in `b27d0633`. Codex
  on `cca493e..b27d063` (3 parts, 334,825 input tokens): parts 1 and 3 correct (0.86, 0.90); part 2 incorrect (0.99),
  two P2s on `bin/lib/rules-block.mjs:44-45` (the rename of the sibling): his `CLAUDE.md` as a link (into a dotfiles
  repository) is replaced by a regular file, and on Unix a 0600 file comes back 0644. Planned fix: write into the file
  the link names (`fs.realpathSync` after an `lstat`), skip a link to nothing, and give the sibling the file's mode
  (`chmodSync`) before the rename. Its two tests are written in `bin/lib/rules-block.test.mjs`, uncommitted: both
  skip on this machine (it cannot make links; Windows keeps no Unix mode), so only CI's Linux run proves them. JH
  ORQ asked a pause for his restart (Claude Desktop, gentle-ai, Codex): nothing ran at that point; nothing pushed.
- L22 (2026-10-28, T6): PR 619 (T7) opened and `ready` sent (the merge queue's dry run takes it after PR 618). The five
  Spanish prompts, on `f8-s10-probe`: the first run is void. Its probe passed each prompt to `claude -p` through a
  shell (`shell: true` on Windows), which cut it at its first space, and its score passed five replies that only said
  the message was cut (0.06 USD). Read before it was reported; the rerun puts the prompt on stdin with no shell and
  counts a reply only when it answers: 5 of 5 (`## Probe`, 0.12 USD). The incident rerun is held, not run: the
  current arm copies his real `~/.claude` into each trial home (`evals/home.mjs:41`, `:258`) and runs this checkout's
  `init` in the workspace (`evals/home.mjs:454-458`), so run now it would measure his home without S10's user-level
  part, with a clone that selects a style the trial home lacks; about $13 for a measure of neither. Asked of the lead
  (its planned step): run it once S10 is applied to his machine, or now as it is.
- L23 (2026-10-28, 02:19 local, JH ORQ's note): "Lead's call: run the incident rerun only after he applies S10 to his
  machine, so it measures S10 as he will run it. Hold it". The ROADMAP and the diet's register are updated on
  `f8-s10-probe` (`5da88074`); T7 is marked done (PR 619 merged, main `e1725c83`).
- L24 (2026-10-28, 04:13 local, JH ORQ's note): T8, S8. Design: a component whose file has a record, still exists and
  holds neither the recorded bytes nor this version's is his; it is left, its record carried forward with the
  recorded hash (so `uninstall` still keeps it as his) and marked `edited`, not counted as written, and the command
  says `kept (modified by you)` with how to take this version's text. A file he deleted is written again; one he put
  back to the recorded bytes is updated. Not in scope: a file at a component's path that install never recorded
  (still overwritten on a first install, as before). The write moves into its own module, since `manifest.mjs` is at
  its ceiling (1801). Not high risk by the sizing test (it makes install write less); the usual reviews.
- L25 (2026-10-28): PR 621 (T8) opened and `ready`; PR 620 took main in by a docs merge (`a6303b1f`), since PR 618
  added section 13's tasks to the roadmap line S10's record goes on. Section 13.5 puts rows 4, 12 and 15 into S10:
  row 12 is T8; row 15 builds nothing (it keeps `chained-pr`, copied in T3, and `lens-review`'s input limit); row 4 is
  T9, S9: no S10 slice touched a lens prompt, so T9 pins the style and the two skills only.
- L26 (2026-10-28, 05:40 local): PRs 620, 621 and 623 merged. He answered question 102 "Aplicar ahora" (transcript
  `0f71b2c6`, line 7242, read before the run); the lead installed S10 on his machine at 05:14. The incident rerun ran
  once, `f8-s10-incidents` (results committed), the `current` arm at effort high on `4ccb184f`, 10:17Z to 10:39Z:
  13 of 20 (false premise 2 of 4), at the baseline's L of 13 and above its worse line of 10, so no worse; cases 01, 02 and 05 still fail every trial, and 10 passed 1 of 2; $10.61. S6's pass line holds: the probe 5 of 5 and the incident set no worse. The trial homes held his
  post-install files: the run's setup fingerprint (`fingerprintOf` in `evals/home.mjs`, recomputed over his home with
  its `settledBytes`) matches his `.claude/settings.json`, `.claude/CLAUDE.md` and `.claude/output-styles`. Its
  `.claude/skills` item differs only by files the host's skill sync wrote after the run started (two under
  `skills/synced/`, `find -newermt 05:17`); the `js-harness-*` skills were last written at 05:14. (gentle-ai's R3-001
  on `1e173dde` asked for this caveat to reach the roadmap; checked, it no longer holds.) His `outputStyle` stays Neutral
  (Q101), so the `js-harness` style is installed but not selected in these trials.

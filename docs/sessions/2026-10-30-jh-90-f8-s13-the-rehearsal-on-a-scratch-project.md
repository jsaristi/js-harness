# JH 90 · F8 S13: the rehearsal on a scratch project

Started in the background by the lead with `js-harness sessions start`; brief
`~/.js-harness/background/briefs/2026-10-29T19-21-42-028Z-0339f9b7.md`. Branch `f8-s13-rehearsal`, base main
`f2110239`, worktree `.claude/worktrees/f8-s13-rehearsal`. Large by the resume test, so its feature document is
`odd/tasks/f8-s13-rehearsal.md`, opened before the first source write (`541464ce`).

## Goal
Close S5c-a's roadmap line by the lead's decision on T9, then S13: the nine rows of 11.1 walked on a scratch project
in a scratch home, the guide checked there, engram's recovery after a start and a compaction, a planted `CLAUDE.md`
turning the import row red, a planted directive without a control making `rules check` exit 1, and a rehearsal test
beside `scripts/practice-lib.mjs`, test first.

## The user's words
The only message of his in this session is the pointer to the brief: "Your brief is in
C:\Users\Oficina\.js-harness\background\briefs\2026-10-29T19-21-42-028Z-0339f9b7.md: read it whole before anything
else, and do the work it gives you." The brief carries his words on spend, read from the lead's transcript
0f71b2c6-cbce-43ca-a031-276a4b2c381f line 19692 (2026-10-29T10:40Z): eval and model runs use his Max 20x plan with no
dollar cap. Everything else came from the lead (the feature document's Log, L1-L14).

## Delivered
- `ef23c03e` docs: S5c-a closed, T9 by the lead's decision; `rules coverage --strict` and `--prove` exit 0 on main.
- PR #685 (ready, `main` ← `f8-s13-rehearsal-1`, `f2110239..bb6223b9`): the free rehearsal test
  (`scripts/rehearsal-lib.mjs`, `scripts/rehearsal.test.mjs`) and the `doctor` claude-import row (D1).
- PR #686 (ready, `f8-s13-rehearsal-1` ← `f8-s13-rehearsal-2`, `bb6223b9..ee22f206`): the walk,
  `scripts/rehearsal.mjs`, and the fixes runs 1-9 found, `bin/stack.mjs`'s end-of-run read among them (L10).
- The third pull request (`f8-s13-rehearsal-2` ← `f8-s13-rehearsal`, `ee22f206..HEAD`): the review fixes
  (`608a8e68`, `cf3e6a01`, `08d724a1`), walks 10 and 11, the gentle-ai records, this summary.
- Out of the brief's edit surface, each named: `bin/lib/gentle-ai-absence.test.mjs` (its NAMED list),
  `bin/lib/payload.mjs` (an export), `bin/stack.mjs` with `bin/stack-install.test.mjs` (the lead's L10).

## Checked
- Walk 11 at `08d724a1`, `node scripts/rehearsal.mjs`: 21 of 21 steps PASS, `ok: true`, `leftProcesses` and
  `cleanupProblems` empty, 3.5 minutes, host cost $0.0186. Runs 9 and 10 passed whole before it.
- The rehearsal test fails on a planted break and passes again (L8); 29 of 29 in `scripts/rehearsal*.test.mjs`.
- The S13 pass line: none of gentle-ai, Orca or herdr among 55 commands and 4,893 files on the PATH; 20 recorded
  paths gone or back to their bytes after both uninstalls; his 19 real-home files hashed the same before and after.
- Reviews: Codex and the Claude lenses on every code commit (the pre-push check: 17 of 17 on branch 2); the
  independent verifier over `f2110239..ee22f20`, approve with notes (L13); gentle-ai on each slice (L14).

## Decisions
- The lead: D1 (the import row built here), D2 (the slice's reviews run as his), D3 corrected (T9 dropped), L10 (fix
  `stack install` here, cause proven first), L11 (go on; stop only on a material absolute cost). In the Log.
- This session: the chain cut where the review records end, not at the planned 57584e5d and d4dd7199, because a
  record whose head lies past a pull request's head is not counted at push (JH 79, #645).
- This session: of gentle-ai's advisory findings, the three that let the walk pass on what it did not see fixed
  (`08d724a1`); the setup gaps that fail loudly kept as owed (L14).

## Failures and lessons
- The lens plan gap told to the lead with an unread cause (the prompt), corrected within a minute; `docs/FAILURES.md`.
- ROADMAP committed while Codex ran, so the review recorded nothing (58,369 tokens); `edit-during-review` seen again,
  in `docs/FAILURES.md`. Every later Codex run had the tree untouched.
- A declared wait exited 127 when merge-queue refreshed the installed copy, so the lead's L11 was read 35 minutes late.
- A splice of the feature document matched an earlier mention of `## Log` and duplicated text; caught in the diff
  before the commit and rebuilt; anchored at the heading.

## Left
- Owed to S12, in S13's roadmap State: jq for engram's plugin; Codex's `mcp add` of context7 opening its OAuth login;
  `claude -p` leaving codegraph's MCP server; empty plugin keys in his settings; the lens plan gap; the cold
  `codex.exe` start. The walk's own setup gaps, L14.
- The chain's landing, and the refresh of the installed copy: the lead's.

## Cost
- Time: brief 2026-10-29T19:21Z; this summary 2026-10-30 ~06:20Z; compacted by the host at least at 02:37Z and 05:19Z.
- Walks: eleven runs, host cost $0.1277 against the roadmap's $5 [i].
- Codex: `f2110239..bb6223b9`'s records; `bb6223b..ee22f20` 3 parts, 407,979 input tokens; `ee22f20..ceabd88`
  75,699; `999afac..08d724a` 66,468; the void run 58,369.
- Lenses: `bb6223b..1a21375` 4 lenses, 137,337 input tokens; `ee22f20..276db39` 3 lenses, 76,766;
  `999afac..08d724a` 2 lenses, 14,636. gentle-ai: three reviews, one lens each, on his plan.

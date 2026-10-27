# f8-s3-exclude

Branch `claude/f8-s3-exclude`, from main (84b6b7ed). One pull request. Runner: `node --test`. The interim exclusion of
F8's S3; the split is `odd/tasks/f8-s3-split.md` on `claude/f8-s3-split-251472`.

## Goal
Keep gentle-ai's global `~/.claude/CLAUDE.md` from loading in this repo until F8's S2 removes gentle-ai, with
`claudeMdExcludes: ["**/.claude/CLAUDE.md"]` in a committed `.claude/settings.json`.

## Why
The brief from JH ORQ: "Interim exclusion: `claudeMdExcludes: [\"**/.claude/CLAUDE.md\"]` in a committed
`.claude/settings.json` in this repo only". The lines of the global file this repo keeps move to its root
`CLAUDE.md` (diet Appendix A.1), so excluding the rest banks its load on every turn. The setting is alone in
ff716e6c so S2 reverts exactly that commit.

## Done when
- `npm run check` exits 0
- `node -e "process.exit(JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).claudeMdExcludes[0]==='**/.claude/CLAUDE.md'?0:1)"` exits 0

## In scope / Out of scope
- In: `.claude/settings.json` with the one key.
- Out: the payload row that reads it and the root `CLAUDE.md` (the split's pull request); its revert (S2).

## Constraints
- The glob needs `.claude/CLAUDE.md` adjacent, so a worktree's root `CLAUDE.md` under `.claude/worktrees/` is not
  excluded. Desktop worktree sessions read settings from the main checkout (`--project-config-root`), so the
  exclusion takes effect for them once this lands on main.
- Land it with or after the split's pull request: before it, no root `CLAUDE.md` holds the kept lines.

## Ask me before
Nothing: the brief orders it.

## Tasks
- [x] T1 (kind: build) the setting, in ff716e6c. Route: inline.

## Log
- L1. 2026-10-27: committed through the gate; the pre-push hook counts `.claude/settings.json` as code, so it gets
  Codex and this document.
- gentle-ai on `ff716e6c`: medium, not due (under_budget, configuration_change, 3 lines).
- L2. 2026-10-27, Codex on 84b6b7e..ff716e6: the patch is correct (0.93), no findings: the pattern does not match a
  worktree's root `CLAUDE.md`. Recorded (86,497 input tokens, 32 s).

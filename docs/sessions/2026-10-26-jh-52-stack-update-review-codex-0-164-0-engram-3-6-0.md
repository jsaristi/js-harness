# JH 52 · stack update review (codex 0.164.0, engram 3.6.0)

## Goal
Review the stack update that `js-harness doctor` flagged (`stack-update` row: codex 0.163.0 → 0.164.0, engram 3.5.4 → 3.6.0), check the harness still works on the new versions, fix only what broke, and record the review. Opening read: the lead's brief `~/.js-harness/background/briefs/2026-10-26T10-13-47-538Z-8f10db44.md`.

## The user's words
None in this session: it ran in the background from the lead's brief, and no message of Sebastián's reached it.

## Delivered
- `jsaristi/js-harness#592` (branch `docs/stack-review-0164`, commit d0681ff7), ready: one entry under "Stack doctor notes" in `docs/ROADMAP.md` with the two changelog links (https://github.com/openai/codex/releases/tag/rust-v0.164.0, https://github.com/Gentleman-Programming/engram/releases/tag/v3.6.0).
- The review recorded on this machine: `js-harness doctor --stack-reviewed` printed "Recorded claude 2.1.310, codegraph 1.6.2, codex 0.164.0, engram 3.6.0, engram-plugin 0.1.14, typescript-lsp 1.0.0 as reviewed." and the `stack-update` row then showed no gap.
- No code changed: nothing broke, so no `fix/stack-0164` branch.

## Decisions
- This session: no code change, since every check passed (brief, step 3).
- This session: the note goes under "Stack doctor notes" of the roadmap, the section that holds the doctor's findings.

## Failures and lessons
- Evidence for "nothing broke":
  - `npm run check`: "PASS check 12 rows passed" on codex-cli 0.164.0 and engram 3.6.0.
  - Codex probe in a `mktemp -d` folder with a scratch `HOME`, `USERPROFILE` and `CODEX_HOME` (only `auth.json` copied in, the folder removed after): `codex exec` with the five harness hooks in `hooks.json` and no trust record ran none of them; with `--dangerously-bypass-hook-trust` all five ran (`doctor --hook`, `resume --hook`, `backup --session-start`, `reply --hook`, `backup --hook`), each exit 0, and the hook input still carries `session_id`, `turn_id`, `cwd` and `hook_event_name`.
  - `js-harness codex-meter --json` read the five-hour and weekly windows from `codex app-server`, exit 0.
  - `js-harness codex-review --help`, exit 0.
  - engram through this session: `mem_current_project` resolved `js-harness`, `mem_search` answered, `mem_doctor` ran.
- Changelog items that touch what the harness uses, none of which breaks it: codex #54619 binds trust of plugin hooks to their contents (the harness's hooks are `hooks.json` entries, not plugin hooks); engram's `mem_save` now returns `candidate_detection_status: "incomplete"` when conflict detection fails, and `obsidian-export --limit` is refused; no harness code reads either (grep over the repo, outside `odd/`, found no use).
- Seen, not caused by the update: the `codex-trust` row (four harness Codex hooks with no trust record, his step); engram's doctor reports 13 foreign sync targets and two active runtime sessions for `d:\js-harness` (no doctor file changed between v3.5.4 and v3.6.0).
- The worktree guard refused compound shell commands and setting `HOME` in the shell, so the probe ran through a small Node launcher that set the scratch environment.

## Left
- Landing `jsaristi/js-harness#592`: the lead.
- Trusting the four Codex hooks in interactive `codex` ("Trust all and continue"): Sebastián.
- engram's foreign sync targets and the doubled active session: unowned; engram's doctor names its own repair steps.

## Cost
- Time: brief 10:13Z, ready notice 10:28Z.
- Context at the ready notice: 34%.
- Reviews: no gentle-ai review (assessed passive, not due), no Codex review (Markdown only).
- Gate runs: two (`npm run check`, and the pre-commit gate on d0681ff7).
- Codex: one probe turn of `codex exec` with the trust bypass and one without, plus one `codex-meter` read, which spends no tokens.

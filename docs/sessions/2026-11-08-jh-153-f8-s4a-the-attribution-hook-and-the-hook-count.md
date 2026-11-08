# JH 153 · F8 S4a: the attribution hook and the hook count

File: docs/sessions/2026-11-08-jh-153-f8-s4a-the-attribution-hook-and-the-hook-count.md.

## Goal
F8's S4a: the 50-commit count of attribution lines on `main`, a `check` row holding the machine's hook entries to a
ceiling by event and owner, and D8, the engram plugin's prompt hook off with a way back. Feature document
`odd/tasks/f8-s4a-hook-count.md`; opened by the lead's opening for JH 153 (2026-11-06), read with
`js-harness sessions --opening 'JH 153 · F8 S4a: the attribution hook and the hook count'`.

## The user's words
All relayed by the lead and read on its transcript `0f71b2c6`:
- D8, his answer of 2026-10-26 (transcript `e41d1e8d`, line 3740): "Apagarlo (Recommended)".
- Question 208, line 70355 (2026-11-06T19:08:10Z, `js-harness sessions --quote`): "Apagarlo igual (Recomendado)",
  after the question named that the hook also saves his prompts to engram (L7).
- Question 211: "Unir la serie (recomendado)", the fold of #782 into #772's module (L11).
- Questions 213 and 214: land #782, then #784 after it (L13).
- Question 221 (2026-11-08, 17:40 local): "Aplicar D8 (recomendado)" (L14).
- Question 225, line 74904 (2026-11-08, 17:49 local): "Aceptar el hook (recomendado)", engram 0.1.22's `PostToolUse`
  entry (L15).

## Delivered
- T1, no pull request: 0 attribution lines in the 341 commits on `main` since `75c3583f` (L2).
- #782 merged (`b099fa05`): `"hookCount": true` in `harness.json` holds every owner × event cell of the live entries
  to `HOOK_CEILINGS` in `bin/lib/hook-count.mjs`, and fails on an owner the table does not name; folded into #772's
  `hook entries` row (L11).
- #784 merged (`5dc274c3`): `js-harness stack engram-prompt off|on`, the hooks file's whole text before and after in
  the machine manifest (`pluginHooks`), put back by `on` and `uninstall`, written through `replaceFile`
  (`bin/lib/atomic-write.mjs`); the `hook entries` row names `off` when the hook comes back (L7-L12).
- #786 merged: L13. #787 and #790: two `stretch-not-opened` sightings in `docs/FAILURES.md`, at the lead's request.
- On his machine, after question 221, run by the lead: `stack engram-prompt off`; the engram `hooks.json` holds no
  `UserPromptSubmit`, recorded in `~/.js-harness/manifest.json` (L14).
- This file's pull request: in `HOOK_CEILINGS` (test first), the engram `UserPromptSubmit` cell out (L14) and an
  engram `PostToolUse` ceiling of 1 for the plugin 0.1.22's new hook (L15), the commit that lets this machine's
  commits pass the `hook entries` row again; T5 and T6, the ROADMAP's S4a State as done, SPEC's D8 requirement
  naming the `hook entries` row.

## Decisions
- His: D8 and its application (questions 208, 221); engram 0.1.22's `PostToolUse` hook accepted (225); the fold (211); the order of the two merges (213, 214); the hook
  takes the attribution lines out and never stops a commit (question 132, before this session).
- The lead's: build D8 test-first and apply it after its merge (L7); Fable for the undo line by
  rule:escalation-model (L10); merge `main` into #782 rather than rebase (L13).
- This session's: plugin entries count like settings entries (L3); js-harness's ceiling is what `install` writes, so
  it is not in the table (L11); the ceiling of 0 in the docs PR the lead asked for, since T5's line holds it (L14).

## Failures and lessons
- L5, L9, L10, L12: Codex found four P2s and the independent verifier one P1 and one P2 in D8 (a quoted program path,
  a read error forgetting the undo record, the undo line's `--home` and its quoting, `uninstall` silent on a failed
  put-back, a write before its record, a non-atomic write); each fixed test-first and rechecked.
- L9: the undo line's quoting failed three Codex rounds; by rule:escalation-model it went to claude-fable-5-1 (JH
  155), which proved it in the real shell.
- L15: an engram plugin update added a hook entry, and the row refused every commit on this machine until his answer
  raised the cell; the row did what it is for, a new entry seen at the first commit after it.
- L13: a merge resolved with "ours" and "theirs" inverted was refused by the pre-commit gate and redone; the pre-push
  hook asked for review records on the merge commit, run before the push.

## Left
- Nothing in S4a. Two follow-ups the lead holds: a declared suspension satisfying the return check (#790's line); and
  `stack upgrade` of the engram plugin running the hook count after the update and naming the cells that moved
  (`docs/FAILURES.md`, `stack-update-moved-hooks`, the lead's own miss, recorded in this pull request).
- D8 takes effect at his next Claude restart; its undo is `js-harness stack engram-prompt on`.

## Cost
- From the opening on 2026-11-06 to this closing on 2026-11-08; several host compactions; 22% of the context at the
  last notice.
- Reviews: Codex and the Claude lenses on every code slice, from `1d4f63db` (L5) to the merges (L13), Codex up to
  0.99 on the last, lenses 0 findings on every final round; one independent verifier (opus, L9); one Fable session
  for the undo line (L10). This pull request's two-cell ceiling change: one Codex review and the reliability lens.
- No paid eval run.

# JH 162 · audit H1: uninstall keeps a session's work

## Goal
Fix the Fable 5.2 audit's finding H1 (2026-11-09): `uninstall machine` ran `claude stop` and `claude rm` on idle
background sessions with no worktree guard. The lead then handed this session finding H2 (the backup's secret
blanking) as its own slice and PR. The opening read the brief
`~/.js-harness/background/briefs/2026-11-10T04-02-12-534Z-8509e8f8.md`.

## The user's words
- H2, his answer to question 242, transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0` line 1136
  (2026-11-10T04:05:10Z), read with `js-harness sessions --quote`: "Ampliar patrones y corregir la ayuda
  (recomendado)". The question said a yes does not authorize touching his pushed backup repos or rotating any key.
- H1 came from the lead's brief, not from his words.

## Delivered
- PR 801, ready, not merged: https://github.com/jsaristi/js-harness/pull/801, branch
  `worktree-audit-h1-uninstall-guard`.
  - The fix, bd161b52: `undoBackground` (`bin/lib/background.mjs`) runs `worktreeHolding`, reused unchanged from
    `sessions stop`, before `undoSession`, and keeps a held session with the settle `holds`; `bin/install.mjs` prints
    `sessions stop <id> --remove-worktree`.
  - Its test in `bin/sessions-background.test.mjs` failed before the fix ("removed background session 0db8bc5e · Held",
    exit 0).
  - Feature document: `odd/tasks/uninstall-keeps-worktree.md`.
- PR 804, ready, not merged: https://github.com/jsaristi/js-harness/pull/804, branch `fix/audit-h2-backup-redact`.
  - Code: 92d5989c, 9396ec2c, b0c940c3, 8bc45785, dac1ef3e and e631914c, the commits that change `SECRETS` and
    `redactSecrets` (`bin/lib/backup.mjs`) and the help of `backup run` (`bin/backup.mjs`).
  - Each test case failed before its fix.
  - Feature document: `odd/tasks/backup-redact-shapes.md`.

## Decisions
- H1 is large work, not small, because it touches an irreversible deletion (this session; `uninstall-keeps-worktree.md`
  L2).
- The `at-work` settle line stays as it is, since stop's own refusal covers it (this session; In scope / Out of scope).
- The scope of H2 is wider patterns and a corrected help, with no bundle scan (his answer; `backup-redact-shapes.md`
  Specs 1).
- Where an H2 pattern may start: after JSON's `\n`, `\t` or `\r`, or after a literal backslash in an even run or an odd
  run before a non-escape letter. The run is bounded to 16 (this session, from the verifier's findings; L7 and L9).
- A bare `pass` counts as a field name only as an env line's `PASS=`. YAML's `pass:` and `pass = value` stay unblanked,
  since code and prose have the same shapes, and they are pinned by tests (this session, answering Codex and the
  reliability lens; L8 and L10).
- No third verifier pass on H2: the last three commits answer the verifier's own finding A and two review findings,
  each with a test that failed first (this session; L11).

## Failures and lessons
- `edit-during-review`, seen again. This session edited `bin/lib/backup.test.mjs` while Codex reviewed
  `b0c940c..dac1ef3`, so the run recorded nothing and 136,092 input tokens were spent for nothing. It is recorded as a
  `- Seen:` line in `docs/FAILURES.md`. The rerun was made with no edit until both reviews ended.
- The first verifier pass on H2 found a high leak: a key that starts a line inside a JSON string follows `\n`, and a
  `\b` reads that `n` as part of the key. This had been true on main for the Anthropic and OpenAI shapes too. The lesson
  is to test a secret pattern in the contexts the backup copies (JSON-escaped text), not only in raw lines.
- Codex found over-wide patterns twice: the `sk-` prefix on any word ending in `sk`, and `pass(?==)` in code. The
  lesson is that a blanker runs on worktree patches too, so a false positive on code corrupts a restore.
- The first commit of H2's code was refused by `bin/conventions-structure.test.mjs`: `bin/backup.mjs` grew to 1303
  lines, over its ceiling of 1302. The help line was folded into the line before it.

## Left
- The owner merges PR 801 and PR 804.
- The low notes left open on H1 (`uninstall-keeps-worktree.md` L6):
  - a rewritten `--worktree` name escapes `worktreeHolding`, as it does in `sessions stop`
  - the `at-work` settle line's wording
- The notes left open on H2 (`backup-redact-shapes.md` L7, L8 and L9):
  - URL fixtures in tests and docs get blanked
  - quadratic time on hostile input, mostly older than this branch
  - shapes outside the nine: `DB_PASSPHRASE=`, `curl -u`, URLs with escaped slashes, YAML `pass:`
  - keys after an ANSI colour code
  - a raw `\npm_…`
- Not covered, as the question said: scanning bundles, his pushed backup repos, rotating keys.

## Cost
- Time: from the brief at 2026-11-10T04:02Z to this summary at about 05:30Z.
- Context: about 29% at the H1 ready notice, at 04:25Z. The share at the end was not measured.
- Codex, five runs (input tokens): H1 67,757; H2 116,261, 44,422, 136,092 (recorded nothing) and 73,281.
- Claude lenses, five runs (input tokens): H1 37,617; H2 48,676, 43,517, 41,223 and 27,792.
- Independent verifiers: H1 73,621 tokens; H2 102,455 and 137,574.
- Gates: one gate refusal on H2 (the line ceiling); every other commit passed its gate.

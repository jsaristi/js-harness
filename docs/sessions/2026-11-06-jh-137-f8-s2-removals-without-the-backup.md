# JH 137 · F8 S2: removals without the backup

File: docs/sessions/2026-11-06-jh-137-f8-s2-removals-without-the-backup.md.

## Goal
F8's S2: remove gentle-ai, Orca and herdr from his machine, each removal asked first, then prove the harness still
works (entries, session loads, `fixed load`, smoke walk, incident set). Feature document
`odd/tasks/f8-s2-removal.md`, branch `f8-s2-removal`; opened by the lead's brief
`~/.js-harness/background/briefs/2026-11-02T20-04-49-764Z-f23ac024.md`, resumed by its later briefs (the last
`2026-11-06T13-53-10-227Z-8ad149cd.md`).

## The user's words
All relayed by the lead and read here with `js-harness sessions --quote` on the lead's transcript `0f71b2c6`:
- line 55309: "Sí, abre el S2" (L1).
- line 60749: "hagamoslo entonves sin la copia de seguridad, [...] no importa si se nos borra informacion.", then
  question 179, "Sí, sin copia", line 60802 (L20).
- Tapped answers: 182 "Solo en init" (63496), 183 "Desinstalar gentle-ai" (63973), 184 "Con --all" (64128), 185
  "Dejarlas quitadas" (64284), 186 "Desinstalar Orca" (64405), 187 "Desinstalar herdr" (64544), 188 "Borrar las
  .atl/" (64610), 189 "Reiniciar ahora" (64993), 194 "Correr el smoke walk" (67993), 197 "Correr el incident set"
  (68237), 200 "Aplicar el borrador" (68570), 201 "Borrar los tres" (68771), 203 "Unir el PR 778" (the lead's brief),
  204 "Usar js-harness" (68947).

## Delivered
- PR 761 merged (`698c5311`): `js-harness stack backup` with its restore drill and `scripts/s2-verify.mjs`; built and
  unused, since question 179 dropped the backup.
- PR 763 merged (`7aa2ab9c`): T13, Appendix A.1's kept lines in js-harness's block of `~/.claude/CLAUDE.md`.
- PR 768 merged (`b0d55ebb`): T9's build, the interim exclusion reverted and the global file loading here again (`85d17a02`).
- PR 778 merged (`8d1284a6`): T10, the five rule lines of `CLAUDE.md` and `AGENTS.md` that named gentle-ai.
- Branch `f8-s2-removal` (this file's PR): the Log L43-L60, the incident run's result
  `evals/results/f8-s2-incidents.json` with its entry in `bin/lib/gentle-ai-absence.test.mjs` (`78f1d226`),
  `README.md` and `docs/SPEC.md` no longer saying gentle-ai leaves (`7de6b95f`), S2's roadmap state, two
  `docs/FAILURES.md` entries.
- On his machine, each after its yes: gentle-ai uninstalled with `--all`; Orca; herdr; each project's `.atl/`;
  `~/.gentle-ai`, its PATH entry and its eight native agents with their ownership file (L58); the permissions and the
  engram and context7 entries back from gentle-ai's snapshot; `outputStyle: js-harness` in this repo's
  `.claude/settings.local.json` (L60).
- Checked: six reopened sessions load no gentle-ai text (L47); `fixed load` 77,144 to 77,288 in this repo's four
  Desktop sessions, at most 80,000 (L48); the smoke walk 21 of 21 (L51); the incident set 14 of 20, false premise 2
  of 4, no worse than S10's 13 (L53).

## Decisions
- His: S2 without the backup (question 179); each removal and its scope (183-188, 201); the restart (189); each paid
  run (194, 197); T10's wording (200); this repo's output style (204). Recorded in the Log with their lines.
- The lead's: 778 lands after 777 (question 203's relay); the two `FAILURES.md` lines.
- This session's: the presets row closed by question 182 (L33); a result file naming gentle-ai goes on the named list
  as `RESULT` rather than rewording the result (L54).

## Failures and lessons
- L34: question 183 asked before the command's scope was read; `--all` also touched Codex and Antigravity. Stopped
  before running; question 184 asked the scope (`told-him-unverified`).
- L43: the earlier JH 137's worktree was deleted by `sessions stop` with its files; new entry
  `stop-removed-live-worktree`, control owed as T15.
- L46: a headless `claude -p "/context"` from Git Bash had its prompt rewritten into a path and ran unattended twice
  (about $0.85, estimated); it made a local commit, undone, and its temp files were removed. New entry
  `headless-prompt-path-converted`, control owed as T16.
- L52: question 196 claimed the incident set stops at 1.5 times its estimate; it has no stop. Withdrawn, re-asked as
  197 with a 20 USD read of `--plan`.
- L30, L54: the gate refused two commits (Engram names in shipped text; a result file naming gentle-ai); each fixed in
  its own commit and reviewed.

## Left
- T15 and T16, follow-ups proposed to him through the lead, not authorized.
- `D:\js-harness\.claude\worktrees\f8-s2-nobackup`: deleting it is his call, untouched.
- In `D:\abogadaclaudiajimenez`: an unfilled `AGENTS.md` template, a rule pointing to a file gone with gentle-ai,
  memory notes naming gentle-ai (L47); his project, reported only.
- D4, the `fixed load` budget, his right after S2 (the roadmap).

## Cost
- From the brief at 2026-11-02T20:04Z to the closed notice on 2026-11-06; 20% of the context at the end of the last
  stretch, after several host compactions.
- Paid runs: the smoke walk $0.0134; the incident set $5.67 (29.3 minutes); the stray headless runs about $0.85,
  estimated.
- Reviews: Codex and the Claude lenses on every code slice: PR 761's range several rounds (L10-L16, Codex up to 0.96,
  lenses 0 findings), plus an independent verifier (L13); `ae79fad2` (Codex 0.92, three lenses 0); `85d17a02`
  (Codex 0.94); `78f1d226` (Codex 0.99, reliability 0); PR 778 (Codex 0.98, reliability 0).

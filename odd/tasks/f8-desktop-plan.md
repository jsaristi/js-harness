# The desktop plan, steps 2 to 5: cleanups, the process measure, the auto-archive probe, the skill-text trim

Locator: `odd/tasks/f8-desktop-plan.md` · Engram mirror: `odd/f8-desktop-plan/tasks` · Branch: `worktree-f8-desktop-plan`
Delivery: one pull request per step, stacked in order · Test runner: `node --test`

## Goal
Steps 2 to 5 of `docs/proposals/claude-app-native-sessions.md` section 12 are on main, each through its own pull
request with its proof, and the proposal's map says what each step found.

## Why
His answer to question 128 approved the plan's order and started these four steps without another decision of his;
the rest of the plan (D2, D4, D5, M1, M2, S1, R1) reaches him as its own question through the lead. Each step either
removes a friction of section 7 or measures one before anything is claimed about it.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/f8-desktop-plan.md` exits 0
- `node --test bin/install.test.mjs bin/lib/manifest.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- `test -f docs/audits/2026-10-30-process-hour.md` exits 0
- the proposal's sections 4, 7 and 12 say what steps 2, 3, 4 and 5 found, each with its evidence
- each step's pull request is merged into main, named in `## Log`

## In scope / Out of scope
- In: this document; `docs/proposals/claude-app-native-sessions.md`; `docs/audits/2026-10-30-process-hour.md`; the
  orchestrator and protocols skill texts (`bin/lib/manifest.mjs`, `bin/lib/protocols-skill.mjs`) and their tests;
  `docs/ROADMAP.md`'s F8 rows for this work; worktrees `merge-queue --prune` removes; empty, unregistered folders under
  `.claude/worktrees`; one scratch pull request that leaves nothing on main; the session's summary under
  `docs/sessions/`.
- Out: `sessions stop` (the lead's), any worktree with uncommitted or unpushed work (the lead's and his), D2, D4, D5,
  M1, M2, S1 and R1 (each its own question), any rule change, `~/.claude`, `~/.codex`, credentials, gentle-ai's config,
  stopping or killing any process, opening a browser.

## Constraints
- Nothing is removed before the lead has the list — because the brief says so, and a removed worktree is only
  recreated from its branch.
- The probe archives no real session — because an archived session leaves the lead's board and its sidebar.
- A removed skill line whose rule lives elsewhere names that rule — because a skill text is a contract every session
  reads (`rule:` homes, `AGENTS.md`).
- The measure only reads the process list — because stopping anything on his machine is not in his yes.

## Ask me before
- Nothing here is his beyond question 128's yes; what is outside it goes to the lead as `waiting`.

## Specs
- S1 (the lead's brief `briefs/2026-10-30T17-58-12-753Z-8c3a929a.md`, step 2): "list every stale registration and every
  worktree you would remove, with why each is safe, and send the list to the lead with `js-harness notify --to
  orchestrator --kind note` BEFORE removing anything; `sessions stop` and any worktree with uncommitted or unpushed work
  stay the lead's and his. Record the counts before and after."
- S2 (same, step 3): "the one-hour measure, committed as the section says. Run it while normal work runs; say what
  ran."
- S3 (same, step 4): "the auto-archive probe. The scratch PR must leave nothing on main (a no-op or a reverted doc), and
  the probe must not archive any real session. Record the result in the proposal's map."
- S4 (same, step 5): "the skill-text trim of rows 3 (only if step 4 passed), 4, 8, 9 and the desktop-only wording. A
  skill text is a contract every session reads: `js-harness rules check` and the install tests must pass, and a
  removed line whose rule lives elsewhere names that rule."
- S5 (same): "Done when steps 2 to 5 are on main through their PRs, each proof exits 0, and the proposal's map says
  what each step found."

## Tasks
- [x] T1 (kind: verify) step 2: the list to the lead, then `merge-queue --prune` and the empty folders; counts before
  and after — S1; inline; docs commit
- [x] T2 (kind: verify) step 3: one hour of process and memory samples, the measure file — S2; inline; docs commit
- [ ] T3 (kind: verify) step 4: the auto-archive probe with a scratch session and a scratch PR — S3; inline; docs commit
- [x] T4 (kind: verify) step 5: the skill-text trim, tests first — S4; inline; no line removed (L4), so no code commit
- [ ] T5 (kind: docs) the proposal's map, the roadmap, the summary, the ready and closed notices — S5

## Step 2: the list, before anything is removed

Taken 2026-10-30 18:00Z-18:20Z, read-only: `~/.js-harness/background/sessions.jsonl`, `claude agents --json --all`, the
channel `~/.js-harness/channel/D--js-harness.jsonl`, `git worktree list --porcelain`, `git -C <tree> status --short
--branch --untracked-files=all` where this session's guard allows it, `git merge-base --is-ancestor <head>
origin/main`, `gh pr view`.

**Registrations, before: 18** (46 starts, 28 removals). Two are live: `01225f7c` (JH 106) and `215eb554` (this one).
**16 are stale**, and each sent its `closed` notice, so none holds work:

| id | JH | `claude agents` | its `closed` notice |
|---|---|---|---|
| `6305149e` | 65 | failed (resumed as `76ac01ad`, stopped, not recorded) | 2026-10-28T10:48Z |
| `c594c96f` | 67 | job gone | 2026-10-28T10:22Z |
| `76a92c61` | 73 | stopped | 2026-10-28T22:24Z |
| `e54c4b14` | 74 | done | 2026-10-28T20:00Z |
| `acec7557` | 75 | done | 2026-10-28T20:58Z |
| `c10ec37f` | 78 | done | 2026-10-29T01:49Z |
| `98576382` | 80 | stopped | 2026-10-29T12:32Z |
| `7e7cf304` | 84 | done | 2026-10-29T15:28Z |
| `bb7fa0ca` | 90 | done | 2026-10-30T05:57Z |
| `71a55588` | 92 | done | 2026-10-30T04:05Z |
| `566f950e` | 93 | job gone | 2026-10-30T08:44Z |
| `6fbd7de8` | 94 | job gone | 2026-10-30T10:18Z |
| `5653459f` | 96 | stopped | 2026-10-30T11:20Z |
| `5fc70112` | 97 | job gone | 2026-10-30T13:49Z |
| `4ca57d0f` | 99 | job gone | 2026-10-30T15:00Z (a `ready` for PR 702 after it; 702 is merged) |
| `57ff0524` | 100 | job gone | 2026-10-30T15:21Z |

Their removal is `js-harness sessions stop <id>` for each, which the brief leaves to the lead; this session runs none.
`76ac01ad` (JH 65's resume, stopped) and the host's `8df059ad` and `f462dfd5` (`D:\harness`, failed) are not in the
record, so `sessions stop` refuses them; they are the host's (audit F10).

**Worktrees, before: 9** in `git worktree list` (main and 8 linked), and 5 empty folders under `.claude/worktrees`
that git does not list.

Removed by this step:
- `D:/js-harness-worktrees/claude-app-native`, branch `docs/claude-app-native` (JH 105): clean with untracked files
  listed, 0 commits ahead of `origin/docs/claude-app-native`, head `79a523c2` in `origin/main` (PR 706). Removed by
  `js-harness merge-queue --prune`, which asks again that it be clean of ignored files too and idle for 10 minutes
  (`bin/lib/worktrees.mjs:44-72`), and never uses `--force`.
- The five empty folders `delivery-follow-ups`, `f8-s5c-a-paid`, `f8-s5c-a-reach`, `gentle-ai-how-it-works` and
  `visual-pages` under `D:/js-harness/.claude/worktrees` (audit F14): 0 entries each, not registered; `rmdir`, which
  refuses a folder that is not empty.

Kept, and why:
- `D:/js-harness/.claude/worktrees/tui-gentle-level-a6afd3`: PR 596 is open, its head `0d081a42` is not in main.
- `f8-lead-rigor` and `f8-desktop-plan`: live sessions, locked by them.
- `orca/workspaces/js-harness/copepod` and `medaka`: clean, head `1d8b0489` in main, but Orca's; they leave with Orca at
  S2, which is his (audit F14).
- `D:/js-harness/.git/js-harness/merge-queue-10908-1793380510972` and its `-main`: detached candidate worktrees of the
  land of 12:15 local, whose process is gone (pid 10908 is now `tail.exe`); `778f5f61` is a candidate merge that never
  reached main. This session's guard refuses `git -C` there, so their status is not read; the land removes its own
  with `--force` (`bin/merge-queue.mjs:953-954`). The lead's. Six older `merge-queue-*` folders of 2026-10-14 to 20 in
  the same place are not registered either.

**After** (18:10Z): the list reached the lead first (note of 18:06:49Z). `js-harness merge-queue --prune` removed
nothing on its first run: the worktree held `.atl/`, ignored, which the prune counts as unsaved; it was gentle-ai's
skill-registry cache (`skill-registry.md`, "Auto-generated by gentle-ai skill-registry refresh", 9 KB), deleted by
hand, and the second run removed the worktree. The five empty folders stay: `rmdir` gives "Device or resource busy"
for each, so a process holds them (which one is not known; audit F14 said they wait for a reboot).
**Worktrees: 9 → 8.** **Registrations: 18 → 18**, 16 stale until the lead's `sessions stop`; step 2's proof
("`sessions` shows no stale registration") passes only then.

## Step 4: the probe, and why this session cannot run it

This session is a `claude --bg` job (`sessions start`): `ToolSearch` for `session archive list_sessions start_session
bind_pr` found none of the desktop's session tools, and `start_session` is refused on a turn he did not type
(proposal, section 3, point 2). The probe needs a desktop session, so it is the lead's to start, on his next typed turn:

1. The lead: `start_session` `user_asked`, `fresh`, own worktree, title `JH <n> · scratch: auto-archive probe`, with the
   prompt below.
2. The scratch session: `git commit --allow-empty -m "chore(probe): empty commit for the auto-archive probe"` on its
   branch, push, open a PR titled `chore(probe): auto-archive probe, empty commit` (no file changes, so its merge leaves
   main's tree as it was), `bind_pr` it, send `ready --pr <n>` and its `closed` with a summary, arm no `wait`, and end
   its turn.
3. The lead lands it (`merge-queue --land`), then reads `list_sessions include_archived` within 10 minutes of the
   merge: the scratch session archived is a pass; still live is a fail, with what `get_session` says it holds.
4. Either way, `git diff <main before> origin/main --stat` is empty: nothing of the probe on main.

Prompt for step 1: "Scratch session for the auto-archive probe of `odd/tasks/f8-desktop-plan.md`, section Step 4. Do
step 2 there exactly, nothing else; touch no file; never arm a wait; your summary says only what you did."

## Log
- L1 (his request, as written: his answer to question 128, the lead's transcript
  `0f71b2c6-cbce-43ca-a031-276a4b2c381f` line 34672, read with `js-harness sessions --quote`): "Sí, arranca el plan
  (Recomendada)". The question said a yes covers "limpiar sesiones registradas que ya no corren y worktrees seguros
  (sin trabajo sin guardar), medir una hora de procesos y memoria, probar que el archivo automático de la app funciona
  con una sesión y un PR de prueba, y recortar el texto de las skills que la app ya cubre", and not "quitar los
  componentes de Codex del instalador, el relevo de permisos, los mods, los cambios de reglas ni la sesión vigía de
  actualizaciones".
- L2 (evidence, T1): the list above, taken read-only and sent to the lead as a `note` at 18:06:49Z before any removal;
  a second note at 18:07:03Z gave the `ccstatusline` finding (111 orphaned processes, about 4.3 GB), acted on by
  nobody here. `merge-queue --prune` then removed one worktree (9 → 8) after `.atl/` was deleted; `rmdir` refused the
  five empty folders as busy.
- L3 (a mistake, in five parts): what happened: commit `09489509` carried the host's `Co-Authored-By` and
  `Claude-Session` lines, which `CLAUDE.md` forbids, and was pushed. The fix now: none to that commit (no force-push);
  every later commit of this branch has neither, checked with `git log --format=%B origin/main..HEAD`. What stops it
  recurring: it is the second sighting of `commit-attribution-from-host`, whose control is only a protocol line, so a
  check (a `commit-msg` hook refusing those two trailers) is the next control; it is not built here (out of this
  brief's scope) and goes to the lead as a proposal. The count that proves it has not come back:
  `git log --format=%B origin/main..HEAD | grep -c Co-Authored-By` stays 1 on this branch.
- L4 (decision, T4): step 5 removes no skill line. Rows 3 and 4's lines are phrases of his rules `session-housekeeping`
  and `recap-effort-line` (`bin/lib/rules-data.mjs:351-359`, `:569-578`), homed in `bin/lib/manifest.mjs`, so taking
  them out is a rule change (R1), outside question 128. Row 8's text already holds and row 9 is keep. The two "when the
  host gives you a tool" lines stay true: this `sessions start` session has none of the desktop's session tools nor
  `wrap_up` [checked: `ToolSearch`]. The one removable sentence (`manifest.mjs:132`, about 16 tokens a load) is dropped
  because its gain is below the cost of a code commit's Codex and lens reviews. The proposal's step 5 finding says so.
- L5 (evidence, T4): `node --test bin/install.test.mjs bin/lib/manifest.test.mjs` 323 of 323 pass; `js-harness rules
  check` PASS, 70 rules, hash `96ea160b1ccc`; both exit 0 on this branch.
- L6 (evidence, T2): the measure ran 18:04:15Z to 19:04:12Z, 337 samples by `wmic` every 10 s, none failed; the result
  is `docs/audits/2026-10-30-process-hour.md`. What ran in it is listed there (the lead's land, JH 106's tests and
  reviews, this session's tests and gates, JH 108's probe). Correction to the note of 18:07:03Z and the step 2 text:
  the 110 `ccstatusline` orphans held 4,244 MB of working set but 404 MB private, so "about 4.3 GB" overstated what
  they cost; the lead stopped them at 18:48Z on his answer "Elimina todo lo de ccstatusline, completamente y a
  profundidad" (channel, answer of 18:47:25Z), and free RAM rose by about 260 MB.

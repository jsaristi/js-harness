A read-only check that says whether this machine can be wiped without losing work, and the small gaps of `js-harness backup` closed.
Branch: feat/backup-ready. Delivery: ask-on-risk. Tests: `node --test` through `npm run check`.

## Goal
`js-harness backup ready` names everything the backup is configured for that has no copy off this machine and exits non-zero while there is any; the backup itself also copies the stash entries, the uncommitted worktree edits, the codex-review records, Claude Desktop's notes and presets, and the plugin lists.

## Why
His words (S0): "si yo hoy quiero volver a instalar windows y dejar todo desde cero pero no quiero perder el avance de lo que hemos hecho". `backup verify` restored the backup byte for byte on 2026-10-20, but two readers then found what a disk loss or a reinstall would still lose: stash entries after the first, uncommitted edits in the worktrees, the review records the pre-push hook reads, and a few small Desktop and plugin files. Nothing said, before a wipe, whether anything was still only on this disk.

## Done when
- `node --test bin/backup.test.mjs bin/lib/backup.test.mjs bin/lib/backup-restore.test.mjs bin/lib/backup-ready.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness backup ready` on his machine lists what is still not copied, and exits non-zero while anything configured has no copy off the machine (S9).

## In scope / Out of scope
- In: `bin/backup.mjs`, `bin/lib/backup.mjs`, `bin/lib/backup-restore.mjs`, a new `bin/lib/backup-ready.mjs`, their tests, the backup help, README and user guide lines.
- Out: the default scope and the Claude transcripts — both are his open decisions (S8); other projects' backups, which come later.

## Constraints
- `backup ready` writes nothing — because it is run right before a wipe, when a write is the last thing to risk.
- No secret reaches the backup: every new file goes through `redactSecrets` — because a private repository is one leaked token or one visibility flip away from public.
- Nothing hardcodes `D:/js-harness`: the repositories come from config.json's `bundles` — because the check has to work for every configured repository and every machine.
- Destructive and restore tests run only in `mktemp -d` scratch homes — because a test must never touch his real home.
- The repository is public: no client project names anywhere — because it is public.

## Ask me before
Nothing: review consent is pre-granted; product questions go to the orchestrator with `js-harness notify --to orchestrator --kind question`.

## Specs
- S0 (his words): Pregunta 36 "¿Arranco JH 41 con el chequeo 'listo para formatear' y los huecos chicos del backup de js-harness?" → "Sí, arrancalo (Recommended)". Earlier: "si yo hoy quiero volver a instalar windows y dejar todo desde cero pero no quiero perder el avance de lo que hemos hecho".
- S1 (the lead's brief, the check): "It writes nothing. It exits non-zero while anything the backup is configured for has no copy off this machine, and names each thing". Chosen name: `js-harness backup ready` — it answers "is this machine ready to wipe", sits beside `status` and `verify`, and reads as the question he asks.
- S2 (the lead's brief, per repository in `bundles`): "uncommitted files in the checkout and in each of its worktrees; every stash entry; unpushed commits not in the latest bundle; no remote at all."
- S3 (the lead's brief, the clone): "The backup clone itself: behind or ahead of origin, or never pushed."
- S4 (the lead's brief): "Things the backup does not copy, each reported as \"not copied\", with its size: Claude transcripts `~/.claude/projects/*/*.jsonl`, and Claude Desktop data." These are reported and do not fail the check, since the backup is not configured for them.
- S5 (the lead's brief, gaps, each test-first): "every stash entry, as refs in the bundle; fresh patches of uncommitted worktree edits taken at backup time; the `.git/js-harness/*` records; Claude Desktop's side-session-notes and session presets; `installed_plugins.json` and `known_marketplaces.json` as reference copies, the way `settings.json` is copied."
- S6 (the lead's brief): "Fix the wrong doc comment" at `bin/backup.mjs:136`.
- S7 (the lead's brief): "A secret must never reach the backup: run the existing blanking over anything new."
- S8 (the lead's brief): "Do NOT change the default scope, and do NOT add transcripts: both are open decisions of his."
- S9 (the lead's brief, done): "running the check on this machine shows what is still not copied."
- S10 (assumption): of `.git/js-harness/`, the top-level files are the records (`codex-reviews.jsonl`, `codex-review-runs.jsonl`, `lands.jsonl`); `traces/` (test timing caches, 18 MB) and `merge-queue-*` (a land's scratch folders) are left out.
- S11 (assumption): the check also names a memory, home or config file that differs from the last backup, and an Engram whose counts differ from it, since those are configured too.

## Tasks
- [x] T1 (docs) this document — inline
- [x] T2 (build) every stash entry and detached worktree HEAD as refs in the bundle, built in a scratch repository that borrows the source's objects, so the source is never written; doc comment fixed (S5, S6) — inline
- [x] T3 (build) patches of uncommitted edits per worktree and the `.git/js-harness` records under `git/<source>/`, secrets blanked; restore puts them beside the bundles with the line that uses them (S5, S7, S10) — inline
- [x] T4 (build) Desktop side-session-notes and session presets, the plugin lists, as reference copies; a change to them makes a backup due (S5, S7) — inline
- [ ] T5 (build) `backup ready` (S1-S4, S11) — inline
- [ ] T6 (docs) help, README, user guide — inline
- [ ] T7 (verify) gate, gentle-ai review, codex-review, run on his machine (S9) — inline

## Log
- L1 (2026-10-20, the lead's brief): build a read-only readiness check and close the small gaps of `js-harness backup`, as an ODD feature, on `feat/backup-ready`.
- L2 (2026-10-20) verified the readers' facts: the bundle is `git bundle create --all --not --remotes` (`bin/backup.mjs:173`), and a test bundle of a repo with two stash entries named only `refs/stash`; `git bundle create … 'stash@{1}'` names no ref for it, so the entries become refs in a scratch repository whose `objects/info/alternates` points at the source. `--all` in the source also reaches every worktree's detached HEAD, which `for-each-ref` does not list, so those become refs too. The Desktop files are `%APPDATA%\Claude\side-session-notes\` and `%APPDATA%\Claude\ccd-session-presets.json`. His config is `bundles: ["D:/js-harness"]`, `scope: "all"`; the checkout has 59 worktrees and two stash entries.
- L3 (2026-10-20) T2-T4 built test-first, each RED observed first. Found on the way: a worktree copy two whole-path names deep in the clone passed Windows' 260 characters and `git add -A` left it out while the manifest named it; the copies now sit under short names (`<last path part>-<hash>`), the add runs with `core.longpaths`, and a failed add fails the run. The Desktop folder comes from `deps.desktop` (`%APPDATA%\Claude` by default), never from the environment inside a test, so no test reads his real notes.

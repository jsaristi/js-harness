# gentle-ai update check

Branch `feat/gentle-ai-update-check`, from main 99a4849. One pull request; tests run with `node --test`, one file at a time.

## Goal
`js-harness doctor` makes a new gentle-ai version a gap until it is reviewed, with a step that shows what its sync changed in the global CLAUDE.md.

## Why
A gentle-ai sync rewrites `~/.claude/CLAUDE.md`, which gentle-ai owns, and nobody notices: 4.1.1 → 4.2.0 changed the persona's Rules line and made the delegation triggers conditional. The project's rules live in `AGENTS.md`, so a change there can contradict them without a word.

## Done when
- `node --test bin/lib/gentle-ai-update.test.mjs` exits 0
- `node --test bin/lib/cache.test.mjs` exits 0
- `node --test bin/doctor.test.mjs` exits 0
- `node --test bin/doctor-hook.test.mjs` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: bin/lib/gentle-ai-update.mjs and its test, bin/lib/cache.mjs and its test, bin/doctor.mjs and its two tests, bin/js-harness.test.mjs (the dispatcher's list of doctor rows), README.md (the doctor section), docs/ROADMAP.md (one checklist line), this document.
- Out: the global CLAUDE.md itself: js-harness never writes it (only bin/lib/payload.mjs reads it), because gentle-ai owns it.

## Constraints
- It reads machine state only (the gentle-ai version, the backup manifests) and writes only its own record in the doctor cache (`~/.js-harness/doctor.json`), which `uninstall` already removes — because anything the harness writes outside the repo must be undoable exactly.
- The hook's notice stays a `systemMessage`: zero model tokens (docs/ROADMAP.md, Decided, "Notifications").

## Ask me before
- Nothing beyond the repository's rules.

## Specs
- S1. The lead's order (cross-session message from "JH ORQ · js-harness (350k)" to JH 21, 2026-10-16), relaying his request: "Como hacemos para que en cada nueva version de gentle-ai no nos pase esto ya que nosotros no utilizamos Claude.md? y despues no nos genere conflicto". The order: "Build: doctor treats a gentle-ai version change like a host update. It is a gap with its review steps until it is recorded as reviewed. One step diffs the global CLAUDE.md against the pre-sync snapshot gentle-ai keeps in ~/.gentle-ai/backups/<stamp>/snapshot.tar.gz and checks it against AGENTS.md for conflicts. Also note in README that js-harness never writes the global CLAUDE.md (only bin/lib/payload.mjs reads it). Record the current 4.2.0 as reviewed once it lands; I did the review today."
- S2. The `gentle-ai-sync` row: version column the installed gentle-ai version (the gentle-ai row's); `claude` is `ok`, or `stale` while it differs from the reviewed version, with the review steps as its fix: the release notes for the range; the diff of the global CLAUDE.md against its copy in the first backup gentle-ai took after the review (read from the backup manifests, the command given whole); the check of each change against the project's AGENTS.md; a report to the user; `js-harness doctor --gentle-ai-reviewed`. No version read: every cell `n/a`.
- S3. The first reading with no record records the version as reviewed, with no gap. `--gentle-ai-reviewed` records the installed version and says which; with `--json` it prints `{"reviewed":{"version":...,"at":...}}`; with no version read it records nothing and exits 1.
- S4. `doctor --hook`'s `systemMessage` names the change since the last review, after the host update's when both are due, and a later version before the review is a new notice.
- S5. Without the snapshot reader (doctor called by other code, as the TUI does), the report prints what it printed before, and other writers of the doctor cache keep the record.

## Tasks
- [x] T1 (S1-S5, kind: build): the row, the snapshot reader, the record, `--gentle-ai-reviewed`, the hook's words, README and the roadmap line. Route: inline. RED: gentle-ai-update.test.mjs could not load its module; cache 13/14; doctor's two new tests failed on the old doctor (2 of 4 matching). GREEN: gentle-ai-update 7/7, cache 14/14, doctor 71/71, doctor-hook 13/13.

## Log
- L1. 2026-10-16, the lead's order, quoted in S1. What it reported: the gentle-ai 4.1.1 → 4.2.0 sync rewrote ~/.claude/CLAUDE.md; its persona Rules line changed (upstream gentle-ai #4173, a tool mandate that does not hold on Windows), and the delegation triggers became conditional.
- L2. 2026-10-16, design. gentle-ai takes a backup before each sync (`~/.gentle-ai/backups/<id>/manifest.json` and `snapshot.tar.gz`); the manifest lists each file's `original_path` and its `snapshot_path` in the archive. The diff uses the first backup taken after the review, which holds the file as the review left it; on this machine that is `upgrade-20261016T044339Z`, and the step's command, run live, showed the Rules line change L1 names. The command `cd`s into the backup folder first, because Git Bash's tar reads `C:` in an archive path as a remote host. The row is `gentle-ai-sync`, not `gentle-ai-update`: a 16-character id fills the table's first column and runs into the version.
- L3. Next step: the gate, gentle-ai and Codex review, the pull request; after it lands, `js-harness doctor --gentle-ai-reviewed` records 4.2.0 (the lead reviewed it on 2026-10-16).

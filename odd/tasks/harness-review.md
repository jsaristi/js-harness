The whole harness reviewed and documented, the lead's remaining manual steps automated, the application tested end to end, and two real releases cut, 0.9.0 and 1.0.0, so the update between them is proven.
Branch: feat/harness-review (this document); each part lands as its own pull request off main. Delivery: stacked-to-main, one slice per part. Tests: `node --test` through `js-harness gate`; the commit's tests run on CI.

## Goal
A user who installs js-harness 0.9.0 from its git tag and runs `js-harness upgrade` ends on 1.0.0 with everything working, on a harness whose every command matches its documentation.

## Why
He asked on 2026-10-18 for three things in one order (S1): apply the review, the documentation and the automation the lead still lacks; then test the whole application; then add a feature and use it to prove that an update installs and applies correctly. No tag has ever been cut (`package.json` says 0.1.0), and the upgrade has never run from a real GitHub tag through a real package manager: `bin/clean-home.test.mjs` uses a git-clone stand-in, and `scripts/e2e.mjs` uses tarballs. ROADMAP's row "1.0.0 review and record" already asked for a whole-project review before 1.0.0, so that the project can be rebuilt by reverse engineering; this feature is that review.

## Done when
- `npm run check` exits 0
- `node --test` exits 0
- `npm run e2e` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/harness-review.md` exits 0
- `git ls-remote --exit-code --tags origin v0.9.0` exits 0
- `git ls-remote --exit-code --tags origin v1.0.0` exits 0
- In a throwaway home and prefix, js-harness installed from `github:jsaristi/js-harness#v0.9.0` by real pnpm and by real npm, then `js-harness upgrade`, reports 1.0.0 from `--version`, `status --global` and the manifest, and `uninstall --global` leaves the home as it found it; the log is in this document.
- The lead's own installed copy goes through the same upgrade, 0.9.0 to 1.0.0, and keeps working (hooks, relay, gate) afterwards.
- Every command in the dispatcher's help has a README section and a SPEC capability that match what it does, and every finding of the review is fixed or written down here with why it waits.

## In scope / Out of scope
- In: every file of the repository (review and documentation); the lead's tools (`bin/`, the orchestrator skill in `bin/lib/manifest.mjs`); `package.json`'s version; the release procedure; tags v0.9.0 and v1.0.0 on his yes.
- In: what the lead does by hand today, moved into commands: the steps in `~/.js-harness/lead/` that the repository does not hold and no test covers.
- Out: an npm registry publish — no date was set for it (ROADMAP, "Release source"), and it is his to decide.
- Out: other tools' own configuration (gentle-ai, engram, codegraph) — js-harness reports them, never changes them (ROADMAP, "Stack visibility").

## Constraints
- A tag is created and pushed only on his explicit yes, each one — because a tag is a public, installable release that cannot be quietly taken back.
- The tagged commit's `package.json` carries the tag's version — because `upgrade` refuses when the manifest's version differs from the tag (`bin/update.mjs:366-374`).
- The lead's installed copy keeps working at every step — because every session runs its hooks, the relay and the gate from it.
- A review finding that changes a command, flag, output or file format others consume is risk item 3 and gets an independent verifier — because sessions and his phone read those outputs.
- Nothing is removed from a check, test or review to make the work fit (ROADMAP principle 7: judgment acts inside the plan).

## Ask me before
- Creating and pushing the v0.9.0 tag, and then the v1.0.0 tag.
- Whether 1.0.0 still waits for gentle-ai #4036, open with no update since 2026-09-12 (his earlier answer "Sí, la espera" was given for a 1.0.0 that came first; now 0.9.0 comes first).
- The feature that 1.0.0 adds, chosen from a short list with a recommendation.
- Any card or step that touches what is his (spend, publishing, anything irreversible outside the project, credentials, his security settings) — brought to him with a recommendation (held-sessions S9).

## Specs
- S1 (his words, typed, 2026-10-18T01:45:47Z, lead transcript `e152c9d8`, line 29195): "Listo apliquemos todo esto y despues de todo hacemos un test completo de la aplicacion para ver si funciona y cuando todo funcione vamos a añadirle una nueva funcionalidad y con eso probaremos si la actualizacion funciona y se actualiza bien osea que realmente la version inicial va a ser la version 1.1.0"
- S2 (his words, typed, 2026-10-18T01:43:17Z, line 29122, what "todo esto" applies): "que nos falta automatizar para que seas mas autonomo y tambien recuerda lo de la revision de todo el harnes ademas de la documentacion no se si lo hacemos al mismo tiempo aprovechando que vamos a revisar todo el harnes completo"
- S3 (his words, typed, 2026-10-17T09:32Z, line 21180, ROADMAP "1.0.0 review and record"): "Quiero que cuando lleguemos a la version 1.0.0 hagamos una revision completa de todo el proyecto y de una ve documentamos para poder en un futuro hacer un ingenieria inversa exacta y precisa."
- S4 (his words, typed, 2026-10-18T01:49:11Z, line 29353): "obvio la idea es que ahi si la version sera la version inicial definitiva pero si nos llega a salir errores para parchear tendremos que hacer la 1.0.1 si me entiendes? o prefieres que la version inicial sea la 0.9.0?"; and his answer by the question tool to "Pregunta 15" (line 29367, 01:51:07Z): "0.9.0 → 1.0.0 (Recommended)", whose option read: first tag 0.9.0, a rehearsal; the new feature ships as 1.0.0, the definitive one, and proves the update; patches are 1.0.1, 1.0.2.
- S5 (the lead's scope, from S2): the lead's manual steps become commands with tests: (a) the channel watch and the relay lease renewal are one command, not a hand-written shell pipeline; (b) landing the ready queue and refreshing the installed copy is one command held in the repository, not `~/.js-harness/lead/update-copy.sh`; (c) the board names the sessions that are closed and idle, ready for Remote Control off and archive, and the orchestrator skill says to do it at each wake; (d) a session cleared by the lead gets its stored opening without the lead remembering it, or the board flags the ones that did not; (e) any other step the lead repeated by hand in its relief file this month, found by the review, is listed with its cost and either built here or written down with why it waits.
- S6 (the lead's scope, from S2 and S3): every command, library and document is read against the code: help text, README section and SPEC capability match the behavior; dead code, stale text and untested behavior are findings; findings are fixed in slices; `docs/SPEC.md` is written last, complete enough to rebuild the harness from it (rule-hierarchy T1).
- S7 (the lead's scope, from S1): before the first tag, the whole application is tested: the full suite on Windows and on WSL2, `npm run check`, `npm run e2e`, the practice run, and a clean-home cycle; failures are fixed before the tag.
- S8 (the lead's scope, from S1 and S4): the release is cut by a written procedure (version bump in `package.json`, the tag on that commit, the push); 0.9.0 is installed from its tag by real pnpm and npm; then 1.0.0 adds one real feature and `js-harness upgrade` moves both a throwaway home and the lead's own copy from 0.9.0 to 1.0.0, verified by version, manifest, hooks and a working session.

## Tasks
- [x] T1 (kind: design) (S4) Record the versioning decision: ROADMAP "Release source" and the Decided rows say tagging starts at 0.9.0, a rehearsal, and 1.0.0 is the first definitive release; the stale "the repository is private" wording in `bin/update.mjs` goes. Route: inline. Done: ROADMAP row "Versioning" and checklist "Review and release"; RED: `bin/release-tags.test.mjs` "a repository whose tags cannot be listed" failed on the private line; GREEN: 56 of 56 (`release-tags`, `update`).
- [ ] T2 (kind: build) (S5a) One command for the lead's watch: renew the relay lease when this session holds it, then end on the next channel line that is not the lead's own (or after its limit), printing it. Tests first. Route: delegated writer (parallel unit). Risk: item 4 (lease timing).
- [ ] T3 (kind: build) (S5b) One command that lands the ready queue and, when something landed, refreshes the installed copy from main the way `update-copy.sh` does (gated, retried, verified by the shim's sha), held in the repository with tests. Tests first. Route: delegated writer (parallel unit). Risk: item 5 (installs).
- [ ] T4 (kind: build) (S5c, S5d) The board marks sessions closed and idle as ready to archive, and cleared sessions whose opening was not sent; the orchestrator skill says what to do with each at every wake. Tests first. Route: delegated writer (parallel unit).
- [ ] T5 (kind: verify) (S5e, S6) The review, by four readers on Opus at high effort, one per area: (a) install, sync, update, upgrade, uninstall, doctor, init, functions; (b) check, gate, guard, codex-review, merge-queue, permit, rules; (c) sessions, notify, wait, wake, resume, remote, reply, summary, tui, unseen; (d) progress, contract, memory, failures, throughput, audit, subagents, loop, fetch, windows-daily, and the relief file's repeated manual steps. Each returns findings with path:line, severity, and whether it changes a consumed contract. The findings are listed in the Log. Route: delegated readers.
- [ ] T6 (kind: build) (S6) Fix the review's findings, one slice per area, each with its tests and docs. Route: inline, or a writer per area when two or more areas are each several files (Writer trigger a). Risk: per finding; item 3 when it changes a consumed output.
- [ ] T7 (kind: docs) (S6) README brought to the commands in force; `docs/SPEC.md` written last and complete (rule-hierarchy T1). Route: inline.
- [ ] T8 (kind: verify) (S7) The full application test on the release candidate: `node --test` on Windows and WSL2, `npm run check`, `npm run e2e`, the practice run, the clean-home cycle; each result logged here. Route: per-action workers for the long runs.
- [ ] T9 (kind: build) (S8) The release procedure written (README "Releasing") and checked by a test: the tag's version equals `package.json`'s; `package.json` goes to 0.9.0. Route: inline. Risk: item 5.
- [ ] T10 (kind: verify) (S8) His yes, then tag v0.9.0 and push it; install it from the tag in a throwaway home by real pnpm and by real npm; log both. Route: inline.
- [ ] T11 (kind: build) (S8) The 1.0.0 feature, chosen by him from a short list (a held-back automation from S5 is the lead's recommendation, because it is real work he needs and proves the update with code that matters), with its tests and docs; `package.json` goes to 1.0.0. Route: per its size.
- [ ] T12 (kind: verify) (S8) His yes, then tag v1.0.0; `js-harness upgrade` moves a throwaway home (pnpm and npm) and the lead's own copy from 0.9.0 to 1.0.0; version, manifest, hooks and a session checked after; then the lead's copy returns to following main. Route: inline.

## Log
- L1 (2026-10-18, his words) S1, quoted above; S2 is the message it answers.
- L2 (2026-10-18, the lead, from a read-only map) Release state: the release source is built as git tags (`bin/update.mjs:52-66`, `bin/lib/version.mjs:32-61`); no `vX.Y.Z` tag exists; `upgrade` compares the tag with the running copy's `package.json` and requires the manifest to equal the tag (`bin/update.mjs:322-374`); the lead's copy is a pnpm global install pinned to main's sha by `~/.js-harness/lead/update-copy.sh`, outside the repository and untested; `npm` on this machine is a pnpm shim, so `upgrade` without `--pm pnpm` goes through it; pnpm may refuse a release younger than 24 hours (`update-copy.sh:4-5`), unchecked for a tag.
- L3 (2026-10-18, his words and answer) S4. He then left for about three hours (line 29385, 01:51:30Z): "Listo necesito que continues de nuevo solo, vas a quedar unas 3 horas o mas solo". The tags, the #4036 question and the 1.0.0 feature wait for him; T1-T8 do not.

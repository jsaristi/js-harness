A session the host holds on a card for him stays on the board, and the lead brings the card to him in the lead's session.
Branch: feat/held-sessions-relayed. Delivery: ask-on-risk. Tests: `node --test` through `js-harness gate`; the commit's tests run on CI.

## Goal
No session waits on a card in its own window without him being told in the lead's session, with what the card asks.

## Why
On 2026-10-17 JH 22 and JH 23 sat 20 and 31 hours on a permission card for a Bash command, and JH 26 on a held message, while he was away for ten hours and the lead reported "nothing unblocked". The board drops a transcript not written in the last 12 hours (`bin/sessions.mjs:147`, `readSessionsWindow` at `:472`), and a held session writes nothing, so its 15-minute "held for approval" line (`bin/lib/sessions.mjs:2885-2889`) left the board with it: JH 23 at about 00:14Z, JH 22 at about 10:57Z. The app's note listed all three as "needs the user" the whole time; the lead read that as his to handle in their windows instead of bringing it to him here, though his standing word is that only the lead asks him.

## Done when
- `node --test bin/lib/sessions.test.mjs bin/sessions.test.mjs` exits 0
- `node --test bin/lib/manifest.test.mjs` exits 0
- `npm run check` exits 0
- A session whose last call has had no result for 15 minutes is on the board however old its transcript, and its line says the host may be holding it for approval.

## In scope / Out of scope
- In: the board's window (`bin/sessions.mjs`, `bin/lib/sessions.mjs`), the orchestrator skill text (`bin/lib/manifest.mjs`), their tests, README.
- Out: his permission settings and the host's own approval cards: they are his security settings, and a command cannot answer a card in another window.

## Constraints
- The 12-hour window stays for every other session — because the board is read on a phone and old finished sessions are noise.
- The lead never answers a card for him and never stops a session to get around one — because the card is the host asking him.

## Ask me before
Nothing beyond the usual: the cards themselves are his to answer.

## Specs
- S1 (his words, typed, 2026-10-17 ~19:45Z, lead transcript): "haz un protocolo para que esto no pase, yo ya te habia dicho que me pasaras las decisiones a esta sesion"
- S2 (his words, typed, same minute): "como puedo darle permitir todo para que tengas mas independencia?"
- S3 (his answer by the question tool to "Pregunta 3", what JH 22's card says): "Permiso para un comando"
- S4 (the lead's scope, from S1): a session whose last call has had no result for the held-call limit stays on the board whatever its transcript's age.
- S5 (the lead's scope, from S1): the orchestrator skill says that a session the host holds (the board's held-call line, or the app's "needs the user") is brought to him in the lead's session that turn, with the question tool: which session, what the card asks, and what the lead recommends; he answers it in that window.
- S6 (his words, typed, 2026-10-17 ~19:52Z): "La idea es quer tu como orquestador revises que estan pidiendo y veas que si es seguro lo admitas y lo dejes proceder, esta es la idea de todo esto"
- S7 (his answer by the question tool to "Pregunta 13", whether to install a `PermissionRequest` hook that approves writes inside the project's worktrees or the session's scratchpad): "No, solo el guard". So: `js-harness guard` refuses, with a hint, the command that makes the host ask him even in bypass mode, a recursive `rm` or an `rmdir` of a folder at the top of a drive; a denial comes back at once, where a card holds the session until he answers.

## Tasks
- [x] T1 (kind: build) (S4) The board keeps a held session past its window: `readSessionsWindow` reads the last 256 KiB of a transcript last written within seven days, and keeps it when its facts end on a call with no result for the held-call limit, confirmed by the whole read with its subagents' files (`heldPastLimit`, `heldOutsideWindow`). Tests first. Route: inline. RED: `bin/sessions.test.mjs` "stays on the board past the window" got `[]`; a first GREEN broke "--hours widens the window" (a foreground subagent that wrote 45 s ago counted as held from the tail alone), fixed by the whole read; GREEN: `bin/sessions.test.mjs` and `bin/lib/sessions.test.mjs` 540 pass, 0 fail. On the real board it brings back JH 22 (20h 47m), JH 23 (31h 35m), JH 19 (35h 44m) and JH 20 (36h 14m); the look took 32 s, as before (31.8 s).
- [ ] T3 (kind: verify) (S4) A Codex review of a later range that touches `heldOutsideWindow` confirms 6f2b290 closes the multibyte P2 (L7): the second recheck is refused by `codex-review` by design, so the range 6abc7f0..6f2b290 is recorded as a skip. Route: inline.
- [x] T2 (kind: docs) (S5) The orchestrator skill (section "Questions to the user") and README. Tests first. Route: inline. RED: `bin/lib/manifest.test.mjs` "how a question reaches the user" failed at the new assertion; GREEN: 174 of 174.
- [x] T4 (kind: build) (S6, S7) `driveRootRemovalRefusal` in `bin/lib/guard.mjs`, called by `guard --hook` for Bash: a command that starts `rm` with a recursive option, or `rmdir`, on a drive's root or a folder at its top (`D:/x`, `D:\x`, `/d/x`) is refused with where to put such a folder instead; a heredoc's body and quoted text are not commands. Help text and README. Tests first. Route: inline. RED: `bin/lib/guard.test.mjs` failed on the missing export, `bin/guard.test.mjs` "rm -rf of a folder at the top of a drive is denied" got no denial; GREEN: the guard and skill tests 228 pass, 0 fail.

## Log
- L1 (2026-10-17, his words) S1 and S2, quoted above.
- L2 (2026-10-17, the lead) Evidence. JH 22's last entry is a Bash tool_use at 2026-10-16T22:57:47Z with no result (`rm -rf D:/practice-jh22` then `node scripts/practice.mjs setup/run --no-host`, run in the background); JH 23's is a Bash tool_use at 2026-10-16T12:10:03Z with no result (`sed -i` on a scratchpad script, `mkdir -p D:/jh23-fp-scratch`, `node fp-build.mjs`). `stop_session` on both said "it is waiting for the user to answer a request". All three run in `bypassPermissions`; `~/.claude/settings.json` has no `ask` rule, only `deny` rules for secrets, and `js-harness guard` only denies (`bin/guard.mjs:50`). So the card is the host's own; both commands write to a new folder at the root of `D:`, outside the session's folders: the likely cause, not proven.
- L3 (2026-10-17, the lead) Answer to S2: his settings already allow everything they can (bypass mode, deny rules only for secrets); the card is the host's own check and not a setting to open. What keeps sessions from tripping it is scratch inside their scratchpad or a `mktemp -d` folder, as the test discipline already says; the lead does not change his security settings.
- L4 (2026-10-17, the lead) The fixed board found two more held sessions nobody knew of: JH 19 and JH 20, the "dormant reserves" whose queued messages never ran, each on a Bash call with no result for about 36 hours. The lead's mistake, for the record: the app's note marked JH 22, JH 23 and JH 26 "needs the user" for the whole stretch he was away, and the lead treated that as his to find in their windows, against his standing word that every question reaches him in the lead's chat. T2 writes the opposite into the skill.
- L5 (2026-10-17) T1 and T2 are commit f9195084. gentle-ai assess on origin/main..f9195084: medium, review not due (under_budget). Codex reviews the range next.
- L6 (2026-10-17) Codex on ad47461..bf65c4f, P2 (0.98) at `bin/sessions.mjs:460`: a held call larger than the 256 KiB tail leaves no whole line, so the session was dropped. RED: `bin/sessions.test.mjs` "a held session whose last call is longer than the tail read stays on the board" (a 300 KiB heredoc) got `[]`; GREEN: a full tail with fewer than two lines reads the whole transcript; both board test files 541 pass, 0 fail. Commit 6abc7f00.
- L7 (2026-10-17) Codex recheck of bf65c4f..6abc7f0: not fixed (0.99): the fallback compared the decoded text's length with the byte budget, so a multibyte entry skipped it. RED: the same test with a body of `é` got `[]`; GREEN: the line count alone decides; 542 pass, 0 fail.
- L8 (2026-10-17) gentle-ai assess on bf65c4f..6f2b290 (6abc7f00, 6f2b290d): medium, review not due (under_budget).
- L9 (2026-10-17) PR 421 landed (main fda6269) with T1 and T2. A claude-code-guide agent read the docs for S6: in `bypassPermissions` the host still asks before `rm`/`rmdir` of critical paths, which include the folders at the top of a Windows drive, as well as for explicit `ask` rules and cross-session safeguards; allow rules have no effect in bypass; the only documented way to answer a card without him is a `PermissionRequest` hook. He chose the guard alone (S7). The other cards (JH 23's `mkdir`, JH 19's heredoc, JH 20's commit) have no documented trigger found, so T4 covers only the one that is documented.

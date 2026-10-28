# JH 72 · Harness follow-ups: sessions, addressing, refresh, guard

Brief: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T15-16-00-845Z-c94e80c8.md` (six defects the lead
found running the board). Branch `fix/board-follow-ups`, worktree `.claude/worktrees/board-follow-ups`, base main
`79e3430` (main is now `19f2d80`; the installed copy was refreshed to it at about 16:20Z). No feature document: each item
is small, one work unit a commit.

## Done (each commit through the pre-commit gate)
- `493e5110` item 3: `sessions stop` names the real worktree, or says it is gone (records held the main checkout).
- `e58323ac` item 1: `--next-number` counts the titles `sessions start` recorded (real record: JH 73, was JH 71).
- `e30ae69d` item 2: `--address` reads recorded sessions' transcripts in their worktree's folder (resolves 68 and 71 live).
  `--next-number` moved to `sessions-background.mjs` for room; ceilings lowered.
- `ca6cac1c` item 4: `--refresh-copy` waits up to 30 min for no session at work (`claude agents`, `atWork`), else exit 75.
- `7d8db831` item 4, lead's addition at 16:20Z: `clearPnpmLock` names an old lock it keeps, its age and why. The pin needed
  no change: `refreshHoldingLock` already judges each try by `--version` and the shim's sha, not pnpm's exit.
- `73fc8cf7` item 5: `sessions start --resume <id>` resumes a stopped recorded job in its folder and records the new job.
- `3982ae68` item 6: the guard reads `RegExp('…').exec(` as no string run; shadowed RegExp and named receivers still count.
- `b5d28ae5` item 6, the verifier's regression: the skip holds only where nothing could make exec eval (REGEXP_REDIRECTED);
  every regressed case is a refused test, and the first verifier's compare (`cmp.mjs` over cases, cases2, cases3) shows
  only the intended passes left. A second verifier was cut off by a safety classifier before it ran a case: the
  independent reading of `b5d28ae5` is Codex's and the risk lens's.
- `2e51fff7` Codex P2: the refresh looks at the sessions once more holding the gate lock (`stillQuiet`, `lookOnce`).
- `c7cd82c6` Codex P1+P2: a resumed job replaces the one it resumed (`resumedAs`, `resumedChain`); resume checks every job
  of the conversation, the effort rule and the record first, finds a job printed without id, keeps the conversation id;
  `worktreeOf` skips a same-named main checkout. The three new tests fail on the code before it (checked).

## Reviews
- Codex `79e3430..318f952`: incorrect, 2 P1 and 6 P2, all answered in `2e51fff7` and `c7cd82c6`.
- Codex `a1cd4c5..eb669c9` (recheck, one part): correct, confidence 0.93, 8 of 8 fixed; 132,203 input tokens.
- Claude lenses risk, resilience, reliability, readability over `79e3430..eb669c9`: 0 findings each, about 187,000
  input tokens in all (the plan said about 106,000).
- gentle-ai: the Stop hook offered the whole branch; only its read-only status ran, as CLAUDE.md says. No slice review.
- Merges clean with origin/main `b4fdda99` (`git merge-tree`).

## Waiting on the lead (2026-10-28 17:47Z)
PR 636 is pushed (`gh pr view 636`). `notify --kind ready` is refused by the merge door: no written gentle-ai evidence
for the 10 code commits, which it reads only from a gentle-ai line of an `odd/tasks/<name>.md` feature document
(`bin/lib/gentle-ai-evidence.mjs:69`). The brief said no feature document and Codex and the lenses as reviews. Sent
`waiting` with three choices: (a) gentle-ai on about 6 slices, each checked out in its own worktree (`--base-ref`
reviews only to HEAD), plus `odd/tasks/board-follow-ups.md`; (b) he authorizes one review of the whole branch; (c) he
lands it another way. No line was written to pass the door without a review. `js-harness wait --notice-to 72` runs
(this session's task; it ends on his answer or after 480 minutes).

## Next step
0. (done, kept for the record) What the verifier and Codex found, 2026-10-28 ~16:50Z:
   - Verifier, REGRESSION in `3982ae68`: the RegExp skip lets a write pass when exec is redirected to eval through the
     prototype (`Object.getPrototypeOf(RegExp('')).exec = eval`, `__proto__`, `Reflect.set`) or RegExp is replaced under
     a computed name (`globalThis['Reg'+'Exp'] = () => ({exec: eval})`, `atob`), or `RegExp(a)['exec'](...)`, or a
     `(0, eval)(...)` beside it. Its cases and a compare script: `C:\Users\Oficina\.claude\jobs\00ab404f\tmp\verifier\`
     (`cmp.mjs`, `cases2.txt`, `cases3.txt`). Fix: skip only when the blanked code has no `[`, and none of eval,
     Function, prototype, __proto__, getPrototypeOf, setPrototypeOf, defineProperty, Reflect, Object, globalThis,
     global, window, self, this, with, atob; add every verifier case as a refused test; rerun the verifier once.
   - Codex on 79e3430..318f952 (recorded; output in the task file of this session): P1 resume must check every job
     using the conversation (agents with the same sessionId, not only the recorded id) before resuming; P1 protect
     resources shared with the resumed job (stop of either job: brief and worktree shared). P2: recheck activity after
     the gate lock is obtained (merge-queue-refresh.mjs:68); worktreeOf must not take a main checkout named like the
     worktree (background.mjs:173); validate the resumed effort with sessionEffortRefusal; look the job up in claude
     agents when no id is printed; check the record is writable before launching and handle append failure; keep
     `entry.sessionId` when the listing fails (sessions-background.mjs:274).
1. (done) Independent verifier on `3982ae68`.
2. Codex over `318f952..HEAD` (the fixes), then the reviews over `79e3430..HEAD` (lens records before the 16:20Z refresh do not count): `js-harness codex-review --base
   79e3430` and `js-harness lens-review --base 79e3430 --lenses risk,reliability --reason "..."`; gentle-ai per slice.
3. Push, open the PR, `js-harness notify --to orchestrator --kind ready --pr <n>`, then `closed --summary` this file.

## Found, not fixed (for the lead)
- The guard does not read a shell command inside a child process's string: `node -e "cp.exec('echo x >> <record>')"`
  passes today, before this branch too (probe in the session). Unsafe side; outside item 6.
- `bin/conventions-structure.test.mjs` (ceilings), `bin/update.mjs` (the lead's addition) and `bin/lib/refresh-copy.mjs`
  (the recheck under the lock, read as the refresh-copy path) are outside the brief's edit surface as written;
  `bin/lib/background.mjs` was read as where `sessions start` lives.

## Failures
- The first commit carried AI attribution lines, which CLAUDE.md forbids; amended before any push.

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

## Next step
0. Fix what the verifier and Codex found (both done 2026-10-28 ~16:50Z; nothing pushed):
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
2. Reviews over `79e3430..HEAD` (lens records before the 16:20Z refresh do not count): `js-harness codex-review --base
   79e3430` and `js-harness lens-review --base 79e3430 --lenses risk,reliability --reason "..."`; gentle-ai per slice.
3. Push, open the PR, `js-harness notify --to orchestrator --kind ready --pr <n>`, then `closed --summary` this file.

## Found, not fixed (for the lead)
- The guard does not read a shell command inside a child process's string: `node -e "cp.exec('echo x >> <record>')"`
  passes today, before this branch too (probe in the session). Unsafe side; outside item 6.
- `bin/conventions-structure.test.mjs` (ceilings) and `bin/update.mjs` (the lead's addition) are outside the brief's
  edit surface; `bin/lib/background.mjs` was read as where `sessions start` lives.

## Failures
- The first commit carried AI attribution lines, which CLAUDE.md forbids; amended before any push.

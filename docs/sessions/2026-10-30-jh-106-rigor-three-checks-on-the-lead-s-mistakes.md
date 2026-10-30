# JH 106 · rigor: three checks on the lead's mistakes

File: docs/sessions/2026-10-30-jh-106-rigor-three-checks-on-the-lead-s-mistakes.md.

## Goal
Three checks that stop the lead's mistakes before they reach him, from the brief
`~/.js-harness/background/briefs/2026-10-30T17-14-59-363Z-5d8fbd5b.md`: a reply check on command blocks, a gate on
`doctor --host-reviewed`, and the missing sightings with a weekly view of the lead's mistakes. Feature document:
`odd/tasks/f8-lead-rigor.md`.

## The user's words
Transcript 0f71b2c6, line 33664 (2026-10-30T17:07Z): "La verdad necesito mas de este arnes, como hacemos de que todo
se vuelva mas exigente y por ende tambien mayor calidad y conocimiento? siento que tratas es de solucionar a las
carreras y mal por que siempre que me das un comando me envias a la primera algo mal o no investigas bien y si eso es
lo que veo como sera lo que haces y no puedo ver por detras?" Line 33700: "Sí, ábrela (Recomendada)".

## Delivered
- PR 707 (merged): T2, `js-harness failures weeks` and the sightings (`weeklyCounts` in `bin/lib/failures.mjs`); the
  week of 2026-10-26 reads 38 sightings, 7 the lead's own.
- PR 710 (merged): T3, `doctor --host-reviewed` refuses without `docs/host-updates/claude-desktop-<version>.md` and
  its table (`hostReviewRefusal` in `bin/lib/host-update.mjs`).
- PR 714 (ready, `ccd7e3f9` to `19348fd4`): T4, the Stop hook refuses a command block not tagged for
  his shell, not run with success first, or rejected by his shell's parser (`bin/lib/reply-commands.mjs`).
- T6: F4 of `docs/audits/2026-10-30-cleanup-inventory.md`: one failure settled, five routed to the lead (L13).

## Decisions
- This session: no `harness.json` key for the check (an older install refuses one and turns the reply check off);
  markers are words of the fence's info string (`ran`, `own`). Recorded in the design of S1 and L5.
- This session, after two blind readers: run matching word for word, a run proving only what its exit proves; the
  parser on every block handed on win32 (L5).
- This session: a parser that cannot answer refuses the block, as the brief says "never left unchecked" (L12).
- The lead (L6): T8 of `odd/tasks/instruction-homes.md` is carried by T4; F4 is T6.

## Failures and lessons
- `3ed7fd47` was committed with `--no-verify` under the context pause; the next commit ran the gate (L10).
- The gate refused the module twice for conventions it broke (`Stop-Process`, `gentle-ai` named in `bin/`); each cause
  was read before the retry (L10).
- A batch of eight test files ran twice because a filter cut its summary: a `- Seen:` line of
  `diagnostic-whole-gate` (L13). Outputs of long runs go to a file before they are filtered.
- Codex found six P2 in the first T4 slice and the lenses one; all fixed with a test each, RED first (L12).
- gentle-ai approved T4's slice with three advisory findings, among them a false pass (`x ||`, a newline, `y`
  proved `y`) the other reviews missed; all three fixed, test first (L15).

## Left
- PR 714 waits for the merge queue (the lead).
- The five unsettled failures of F4 (L13), held by the lead.
- T8 of `odd/tasks/instruction-homes.md` closes when PR 714 lands.
- JH 105's research role for host reviews: its document had not landed when T3 was built.

## Cost
- Time: brief at 17:14Z; PR 714 opened at about 19:25Z, ready at about 20:10Z.
- Context: 44% at 19:14Z, after one compaction by the host at 18:38Z.
- Codex: T2 145k input tokens (2 runs), T3 two runs (144k and the fix), T4 about 540k input tokens (4 runs).
- Claude lenses: T2 3 runs, T3 4 runs, T4 8 lens runs, all recorded in `.git/js-harness/lens-reviews.jsonl`.
- gentle-ai: T2 and T3 not reviewed (whole-branch candidate, `operation_timeout`); T4 three lineages, each one lens, approved (L15 to L17).
- Gates: every commit's pre-commit gate except `3ed7fd47`; two of T4's refused, then passed.

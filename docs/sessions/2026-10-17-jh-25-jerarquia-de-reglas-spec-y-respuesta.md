# JH 25 · jerarquía de reglas (spec y respuesta)

File: docs/sessions/2026-10-17-jh-25-jerarquia-de-reglas-spec-y-respuesta.md. Facts with their evidence (a pull request, a commit, a path:line, a command and its output), not prose: the file is read later to reverse-engineer how the work went. Commit and push it, then close with js-harness notify --to orchestrator --kind closed --summary <this file> "<what you delivered>".

## Goal
The session opened for rule-hierarchy T1 (docs/SPEC.md) and T2 (the reply check), with T12 (the reply hook step), per
`odd/tasks/rule-hierarchy.md`. The lead routed this split on 2026-10-16T12:16Z ("JH 25 has T1/T2/T12"). After that,
the lead moved more work to it: first-version T3 (16:49Z), T6 the stability pass (17:49Z) and its tasks, throughput
item 4, and first-version T6f. The opening file in the channel
(`openings/D--js-harness/jh-25-jerarquia-de-reglas-spec-y-respuesta-4b1c9f370a86.json`) holds only the resume
prompt of 2026-10-17T05:04Z. The first opening of 2026-10-16 is not in the channel.

## The user's words
- T6f, his answer to the question in L21 of `odd/tasks/first-version.md`, read with `js-harness sessions --quote`
  from `e152c9d8-53bc-4366-8fa5-526b1576bcb6.jsonl` line 18380, at 03:23:54Z. To the question "En Windows la suite
  entera ya tarda más que los 20 minutos que le diste a un sensor el 4 de octubre (1.398 s una vez, 1.114 s la
  última). ¿Cómo queda ese límite?", he tapped "Por silencio (Recomendada)". It is recorded verbatim in L28.
- Question 9 (the reply check, rule-hierarchy T2) was answered in the lead's transcript at line 13501. This session
  checked that answer before taking PR 282 out of draft (channel note of 2026-10-16T21:04Z).

## Delivered
All merged, read with `gh pr view <n> --json state,mergedAt` on 2026-10-17:
- 293, rule-hierarchy T1: docs/SPEC.md and the check row `spec`. Merged 2026-10-16T16:47Z.
- 282, rule-hierarchy T2 and T12: the reply check as a Stop hook, and the reply key with the Spanish labels. Merged
  21:27Z.
- 294, first-version T3: the 2026-10-13 list checked in the code. 12 of 17 items were already fixed and 1 was not a
  defect. Merged 17:21Z.
- 297, first-version T3a to T3c: the hooks' words a session can act on. Merged 17:55Z.
- 304, first-version T6, first pass: the findings as T6a to T6d. Merged 20:41Z.
- 308, T6b: read both shapes of `npm pack --json`. Merged 20:41Z.
- 309, T6c: the launcher test's first read under load. Merged 20:41Z.
- 319, throughput item 4: the design for generated shared files. Merged 22:12Z.
- 320: the README install example cut. Merged 22:12Z.
- 325, generated-shared-files T2: hook tests find hooks by id. Merged 23:12Z.
- 334: T6d closed, overtaken by 723af7c. Merged 23:34Z.
- 337, T6a: the guard refuses a heavy run beside a gate. Merged 2026-10-17T00:15Z.
- 342, T6g: `bin/gate.test.mjs` no longer reads the host's `CLAUDE_CODE_SESSION_ID`. Merged 02:11Z.
- 347: T6 closed, L25 and L26. Merged 03:07Z.
- 360, T6f: a sensor is stopped after 20 minutes of silence (rule `sensor-silence`), and `sensor-timeout` goes from
  20 to 60 minutes as a ceiling. Commits 7a19ed98, 8a078a18, 99316599, 08214376 and d2ade12. Merged 05:44Z.

## Decisions
- His (the user's): T6f's bound measures silence (L28). The silence figure, 20 minutes, is twice the longest silence
  measured in a whole Windows run of the suite on `main` `5bb111a`, 572 s (L29). The figure 10 had been assumed
  before that measure.
- The lead's: the task split of rule-hierarchy (channel, 2026-10-16T12:16Z). The moves of first-version T3, T6, T6b,
  T6c and T6f to this session. T6d to be built only if it does not narrow coverage (19:00Z note); it closed as
  overtaken, in 334.
- This session's: T1 left two parts out, and said so to the lead (15:33Z note). The paid documentation eval (C5)
  waits on his figure, and the AGENTS.md pointer belongs to T8. The three gentle-ai advisories on T6f were fixed
  in 08214376 rather than left (L30).

## Failures and lessons
- **PR 360 was left out of the land.** The cause: no gentle-ai line named 08214376, because L30 named the lineage but
  no hash. Fixed by L31 in d2ade12. The rule in `bin/lib/gentle-ai-evidence.mjs:69`: a line that says gentle-ai must
  name each code commit made after the cutover, by its hash or a range that holds it.
- **The T6f rules change was refused.** Another session's open rule change (rule/ci-gate-bound) held the one slot.
  T6f waited for PR 353 to land (channel, 03:52Z).
- **Feature-document log numbers collided twice**, L24 and then L27, when other branches took them first. They were
  renumbered to L25 and L28 after merging main.
- **gentle-ai START broke when run through cmd.exe**, because single quotes broke the arguments. It ran with its
  argument tokens and no shell. The consent envelope's `granted.invocation` is a POSIX shell string, run as is in
  bash.
- **Tests failed under load.** T6f's steady test failed once on a loaded machine. The quiet test and the ceiling test
  had the same race: node's start can outlast a short silence bound. All three now use 4 s (08214376).
- **Found and reported, not fixed here:** a Linux flake from PR 303. `doctor.test.mjs:1668` fails about half its runs
  because `bin/lib/pnpm-lock.mjs:31` prints a truncated mtime (channel, 2026-10-16T20:57Z).
- **A red land ran on an old head:** PR 293 at d876b02, after the fix 9b0ca91 had been pushed (16:20Z note).

## Left
- Question 9 was answered (PR 282 merged), but `js-harness sessions` still lists it as "recorded, no answer yet".
  The lead holds recording the answer with `--kind answer --question 9`, from its transcript at line 13501.
- Two advisories from the T6f verifier, both the lead's to route:
  - A pre-existing microsecond race in `runSensor`.
  - No gate-level run in which the silence bound stops a real 20-minute hang.
- rule-hierarchy T1's section D (C5, the paid documentation eval) waits on his figure. The AGENTS.md pointer to
  docs/SPEC.md belongs to T8.

## Cost
- Time: the first channel notice was at 2026-10-16T12:13Z and the last at 2026-10-17T05:35Z. The session's first
  turn was at 2026-10-16T11:26Z (the fixed-load row of `js-harness check`). The host compacted it at least five times, by
  its own channel notes.
- Context: 29% at the 05:15Z notice, after the last compaction.
- gentle-ai reviews:
  - `review-95be76221f6981fc` (293) and `review-eecd8b566b6888dd` (360), both approved and acknowledged.
  - 337 approved (channel, 00:00Z).
  - The rest were passive or under budget, each named on its PR's gentle-ai line.
- Codex reviews: on each code PR. Among them 293 (0.84), 282 (0.94), 342 (0.98), and 360 (0.88 and 0.97), recorded
  in `.git/js-harness/codex-reviews.jsonl`.
- Gate runs: each commit's tests ran on GitHub's machines once gate.yml was in. Four whole Windows runs of the suite
  for T6 and T6f: 1,398 s, then the second pass, then 1,114 s on 42e520d, then the measure on 5bb111a, whose longest
  silence was 572 s.

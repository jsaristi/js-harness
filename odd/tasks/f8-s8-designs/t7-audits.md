# F8 S8 T7: the audits, the design

Design only (task T7 of `odd/tasks/f8-s8-certification.md`, spec 7: "a Claude audit and a Codex audit, three runs
each, side by side with the baseline", `docs/ROADMAP.md:831-832`). Nothing here is built or run; the runs, the
baseline, the candidate and the spend are the owner's. Written 2026-11-19 by JH 235, version 2 after one double read
(read `b9b33782`). Marks: [c] checked, [i] estimate, [a] assumed.

State (2026-11-22): version 3, its gaps filled in `## Completed (2026-11-22)`, proposed and not covered by his
answer to question 369. Its double review waits for Codex, after the weekly reset of 2026-11-23 23:45 (no Codex
before it, the lead's brief for JH 293). No paid run.

## What exists today
- One graded audit, the baseline the S8 document names (`odd/tasks/f8-s8-certification.md:79`):
  `docs/proposals/harness-diet.md` section 8, Codex on `gpt-6.1-sol`, one run, C1 to C5 each 0 to 10, 774,997 input
  tokens, the five-hour window 50% to 56% and the weekly 8% to 9% [c]. One sample, another model and effort than
  `rule:review-model` and `rule:review-effort` name now: not comparable with a run today.
- The reading plan: `node workshop/js-harness-workshop.mjs docs plan`, 1,721 tracked files, about 7.5M estimated
  tokens in 24 slices of at most 400,000 [c]. His want is a whole-project audit in depth (`odd/tasks/audit-pack.md:15`).
- No runner or frozen rubric for a graded repository audit. Reusable: the fresh-reader launch and usage recording of
  `bin/double-review.mjs`, and `workshop/bin/audit.mjs`, which audits claims in transcripts, a different job [c].

## The design
1. **The rubric, frozen in a file before any run**: section 8's five criteria, each with written anchors for the
   bands 0-2, 3-4, 5-6, 7-8 and 9-10 (what evidence earns each), the evidence a `path:line` or a recorded command
   output. The prompt names no earlier grade.
2. **The package, built by one rule at each commit**: the core tier of `docs plan` in its order, up to 400,000
   estimated tokens, exported without `.git`, plus the free measure outputs captured at that commit as files (`npm
   run check`, `rules coverage --json`, `js-harness failures`, `node --test evals/home.test.mjs`, and the release
   proof where it runs), since C3 and C4 were graded on host and CI state (`harness-diet.md:670-671`) that a text
   export does not hold. Each commit's file list and SHA-256 are recorded, with the files present at one commit and
   not the other. The report says the grade is of that package, not of the whole project.
3. **Blinding, as a recorded grep**: the package is searched for grade-bearing text (for example
   `\b\d(\.\d)?/10\b|overall \d\.\d|gave \d`) and each hit is listed and removed; excluded whole:
   `docs/proposals/harness-diet.md`, `docs/audits/`, `evals/results/`, the S8 document and this design. The packages
   are labelled X and Y at random, the key kept by the session that runs them. Blind cannot hide dates, versions or
   the roadmap's state inside the files; the report says so.
4. **Baseline and candidate, fixed before any audit runs**: the candidate is the commit S8's measures ran on, named
   before its audit is read; today that is `0c28d083`, whatever its result. The baseline is his choice: a fresh audit
   of `b304719`, where S0's evals ran (`evals/results/f8-s0-a-incidents.json`'s `stack.jsHarness`), 12 runs; or
   section 8's one run read as "not comparable", 6 runs.
5. **Pinned once, before the first run, the same for every run**: Codex on `rule:review-model` at
   `rule:review-effort`; Claude on `rule:session-model` at `rule:lens-effort`, the home of the double review's
   Claude reader (`bin/lib/rules-data.mjs:699`). Each run's record holds the values read. Read-only, no network, one
   run a context.
6. **Three runs each**, reported per criterion: the three grades, their mean and their range, baseline beside
   candidate. The claim is the overall per auditor: a difference counts when all three runs of one commit sit above
   all three of the other, which happens by chance in 2 of 20 orderings (1 in 10) when nothing changed; per criterion
   the grades are descriptive, and a criterion's difference is named only when both auditors agree. No combined
   score with the measures (13.3 row 14).
7. **Record**: one JSON a run (auditor, model, effort, package hash, label, grades, evidence, tokens), the
   unblinded table in S8's `## Result`.

## Cost [i]
- Codex: the recorded `gpt-6.2-sol` reads cost 2.9M to 6.8M input each (the last five in
  `.git/js-harness/double-reviews.jsonl`; those records hold no effort field and are smaller material), so an audit
  of a 400,000-token package is priced at 3M to 7M, 18M to 42M for 6 runs, about 22 to 51 weekly points at about
  0.8M a point (`odd/tasks/double-review-alignment.md:126`, itself an estimate). That does not fit under the lead's
  60% weekly stop (the brief of question 361, not a repository rule; the repository's rule is
  `rule:codex-weekly-floor`) in one week. So: **one pilot audit first**, its tokens and its weekly and five-hour
  deltas read (section 8's one run moved the five-hour window 6 points), then the other runs planned over windows.
- Claude: about 1M to 4M input a run, on his plan's limits, no dollars.

## His decision
Question 369, his answer "Sí, piloto tras el reinicio (Recomendada)" (2026-11-19, JH PLAN's transcript `f5c3ee4d`,
line 6881, verified by the lead): this design is approved, with one pilot audit first, run after the weekly reset of
2026-11-23 23:45. The pilot's spend is asked before it runs. Still his: the baseline (fresh, 12 runs, or section 8,
6 runs); the candidate; how the remaining Codex runs spread over weekly windows, once the pilot is measured.

## Completed (2026-11-22)
JH 293 filled the gaps that L6 of the S8 document names (draft PR 967), with no model call, on `6ee70c0b`. What
follows is proposed. His answer to question 369 does not cover it. Marks as above.

1. **The rubric's anchors** (item 1). They are frozen into the rubric file before the pilot and not edited after its
   first run.
   - **The bands are ceilings, not grades.** A criterion's measures set the highest band it may reach. Findings the
     measures miss, each with its `path:line` or captured output, lower the grade by any amount, and each such
     finding is named in the run's record. So the audit adds what the measures do not see. It cannot grade above a
     failing measure, and it is no restatement of the measures: two packages with the same measures can grade apart
     by their findings. Item 6's "no combined score" holds.
   - **"A measure"** is a row of `docs/proposals/harness-diet.md` section 7 (`:522-545`). **"Met"** means its Pass
     column holds in a captured output of the package (item 2).

   | Criterion | Ceiling 2 | Ceiling 4 | Ceiling 6 | Ceiling 8 | Ceiling 10 |
   | --- | --- | --- | --- | --- | --- |
   | C1 Judgment | the incident set under its baseline, or absent | the incident set at its baseline; no long-session result | the incident set meets its S8 line, or the long-session eval meets its line | both meet their lines | both meet, and the known contradictions are 0 |
   | C2 Truthfulness | `honest-unknown` under 3 of 3 | `honest-unknown` 3 of 3, nothing else measured | and the false-premise cases at 3 of 4 or more | and replies in his language at 95 % of turns or more | and sampled hand-off claims hold at 95 % or more |
   | C3 Works | the gate red | the gate green, and neither of the Windows daily (7 days) nor the hooks row (100 %) meets its line | the gate green, and one of those two meets its line | both meet | both meet, and every `--help` command runs end to end on a scratch home |
   | C4 Left as it should be | `uninstall` does not restore a scratch home | it restores it; 100 or more leftovers older than a day | it restores it; 1 to 99 leftovers | no leftover older than a day | and a read-only command is shown to write nothing |
   | C5 Optimized | the first turn over 100k | 80k to 100k | at or under 80k | at or under 75k, and the start read at or under 15k | and the cost against the minimal arm at or under 1.2× at equal score |

   - **Calibration, today's measures only** (the prompt holds none of them). C4's leftovers are 2,614 (L6), so C4's
     ceiling is 4. C3's hooks row reads 80.4 % clean, so with the gate green and the Windows daily red, C3's
     ceiling is 4; a green daily would raise it to 6.
   - **[a] The band edges** (100 leftovers, 80k and 100k, the order of the measures inside each row) are proposed
     here, not taken from his words. They are his to set or move, before the pilot.
2. **The package builder and the blinding grep** (A1 and A2). This is their specification, for whoever builds the
   runner. A hand run follows the same steps:
   1. Run `node workshop/js-harness-workshop.mjs docs plan --json` in a worktree at `<commit>`. Read the core tier
      in its order, drop the paths item 3 excludes, and stop at the first file that would carry the sum past
      400,000 estimated tokens. The package is a prefix: no later file is pulled in to fill the gap.
      - On `6ee70c0b` that is 39 files and 395,638 tokens [c]: slice 1 whole (orientation, 27 files) and the
        first 12 files of slice 2's "The commit gate" group.
      - It stops at `bin/lib/codex-review-rows.mjs`. It holds no test, feature document or eval.
   2. Run `git archive <commit> <the files>` and extract it to `<out>/files`. `<out>/manifest.json` holds each path
      with its SHA-256, and the files present at one commit and not the other.
   3. Capture the measure outputs at `<commit>` into `<out>/measures/`, read-only and free: everything every ceiling
      of item 1 reads, beyond item 2 of the design.
      - `npm run check`, `rules coverage --json`, `js-harness failures` and `failures closing --json`.
      - `js-harness doctor --json` (the hooks row) and `js-harness clean --age --json`.
      - The Windows daily's last 7 runs, and the `check` row of the fixed load.
      - The release proof, where it runs.
      - The results of S8's runs: the incident set, `honest-unknown`, the long-session eval and the minimal arm's
        cost. They go in as scores and lines only, in one `s8-measures.json`, since `evals/results/` is excluded
        whole.

      A ceiling whose measure is missing from the package reads "not measured" and caps the criterion at the band
      below it.
   4. Run the blinding grep over `<out>`. Each hit is listed in `<out>/blinding.txt` with its line, and that line
      becomes `[grade removed]`. The package is refused while a hit remains.
      - The design's pattern (item 3), run on the 39 files [c], finds 3 hits, all false:
        - `docs/FAILURES.md:708`, "gave 120 pass";
        - `docs/rule-sources.json:1745`, "gave 3 for every repository";
        - `docs/sweep-2026-10-11.md:664`, "gave 342,000 tokens".
      - It misses the three real grades in the package: `docs/ROADMAP.md:107` and `docs/roadmap-history.md:32` and
        `:36`, which grade the roadmap's design passes ("Claude 6.4, Codex 6.0"). They are not grades of the
        repository, but they tell an auditor what an earlier reader thought, so they go.
      - The pattern becomes, case-insensitive:
        `\b(Claude|Codex)\s+[0-9]\.[0-9]\b(?!\.[0-9])|\b[0-9](\.[0-9])?/10\b|\boverall\s+[0-9]\.[0-9]\b|\bgraded?\s+(it\s+)?[0-9](\.[0-9])?\b`.
        On the same 39 files it finds those 3 lines and nothing else, and leaves versions such as "Claude Code 2.1"
        [c, scratch script over step 1's files].
      - It is a floor, not a proof of blindness. It still misses "Codex gave it 7", "scored 6.0" and "Codex: 6.0".
        The builder's test plants each known form, those three among them, and fails on any it does not remove. The
        pattern grows until that test passes and is re-measured on the candidate for false hits.
3. **Still his**: the baseline (item 4: a fresh audit of `b304719` in 12 runs, or section 8 read as not comparable,
   in 6) and the band edges of item 1 of this section.
4. **Still waiting, by date**:
   - The pilot runs after the weekly reset of 2026-11-23 23:45, and its spend is asked then (question 369's answer).
   - Six Codex runs, at 18M to 42M, take more than one weekly window at the lead's 60 % stop (`## Cost`). So after
     the pilot, the remaining five are planned over two windows or more.
   - No such plan is made before the pilot's tokens are read.

# F8 S8 T7: the audits, the design

Design only (task T7 of `odd/tasks/f8-s8-certification.md`, spec 7: "a Claude audit and a Codex audit, three runs
each, side by side with the baseline", `docs/ROADMAP.md:831-832`). Nothing here is built or run; the runs, the
baseline, the candidate and the spend are the owner's. Written 2026-11-19 by JH 235, version 2 after one double read
(read `b9b33782`). Marks: [c] checked, [i] estimate, [a] assumed.

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

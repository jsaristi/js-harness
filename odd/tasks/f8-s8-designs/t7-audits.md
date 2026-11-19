# F8 S8 T7: the audits, the design

Design only (task T7 of `odd/tasks/f8-s8-certification.md`, spec 7: "a Claude audit and a Codex audit, three runs
each, side by side with the baseline", `docs/ROADMAP.md:831-832`). Nothing here is built or run; the runs, the
baseline commit and the spend are the owner's. Written 2026-11-19 by JH 235. Marks: [c] checked, [i] estimate,
[a] assumed.

## What exists today
- One graded audit: `docs/proposals/harness-diet.md` section 8, Codex on `gpt-6.1-sol`, one run, C1 to C5 each
  0 to 10, overall 5.0, 774,997 input tokens [c]. Its own Claude grade was left out as anchored. It is not
  comparable with a run today: one sample, another model and effort than `rule:review-model` and
  `rule:review-effort` now name.
- The audit reading plan: `docs/README.md` and `node workshop/js-harness-workshop.mjs docs plan`: 1,721 tracked
  files, about 7.5M estimated tokens in 24 slices of at most 400,000 [c]. A whole-repo audit is not three runs.
- Nothing runs an audit: no command, prompt or rubric file (searched `docs/audits/`, `odd/tasks/audit-pack.md`,
  `bin/`, `workshop/` for `audit` commands: only citation, expiry, export, flag and hygiene checks) [c].

## The design
1. **The rubric, frozen in a file before any run**: section 8's five criteria (C1 judgment, C2 truthfulness, C3
   works, C4 left as it should be, C5 optimized), each 0 to 10 with the evidence that earns the grade (a
   `path:line` or a command and its output), and an overall as their mean. The prompt names no expected grade.
2. **The package, frozen and the same rule at both commits**: an export of the tree without `.git`, made of the
   core tier of `docs plan` (5 slices, about 1.65M tokens at main [c]) cut to one slice of 400,000 by a fixed file
   list, with its SHA-256 recorded. Excluded by name, because they carry earlier grades or results:
   `docs/proposals/harness-diet.md` section 8, `docs/audits/`, the S8 document's `## Result`, `evals/results/`,
   and every Log line that quotes a grade. Blind covers which commit is which (packages labelled X and Y at random,
   the key held by the session that runs them) and the earlier grades; it cannot hide dates or the roadmap's state
   inside the files, said in the report.
3. **Baseline and candidate**: baseline `b304719` (the commit S0's evals ran on, `f8-s0-a-incidents.json`'s
   `stack.jsHarness` [c]; which commit section 8 graded is not checked here and is his to confirm); candidate a
   parameter, the commit S8's measures certify (not `0c28d083`, which failed). The audits run after the measures
   (`harness-diet.md:519-520`).
4. **Pinned**: the Codex auditor on `rule:review-model` at `rule:review-effort`; the Claude auditor on the model
   and effort `rule:session-model` and `rule:session-effort` give a lead [a: check which rule homes an auditor],
   both read and recorded in each run's record before it starts. Read-only, no network, one run a context.
5. **Three runs each**, on each commit: 2 auditors × 2 commits × 3 runs = 12 runs. Reported per criterion: the
   three grades, their mean and their spread (max minus min), baseline beside candidate. A difference counts only
   when the candidate's three grades all sit above (or below) the baseline's three; otherwise "within spread".
   No combined score with the measures (13.3 row 14).
6. **Record**: one JSON a run (auditor, model, effort, package hash, label, grades, evidence, tokens), and the
   unblinded table in S8's `## Result`.

## Cost [i]
- Codex, 6 runs: about 0.8M to 2M input each over a 400,000-token package (section 8 read 0.78M at an older
  effort; design reads at max effort now cost 2.9M to 6.8M, `double-reviews.jsonl`), so 5M to 12M, about 6 to 15
  weekly points at about 0.8M a point. That does not fit under the 60% stop in one week beside other work: the
  6 runs are spread over two weekly windows, or the package halved.
- Claude, 6 runs: about 1M to 4M input each, on his plan's limits, no dollars.

## For his decision
The package's file list, the baseline commit, the candidate, and the Codex spend across windows.

# Lens review: answers cut before their JSON closes

The lead's brief JH 75 of 2026-10-28. Branch `fix/lens-cut-answers` from `main` 3019155; owner `JH 75 · lens-review:
lens answers cut before their JSON closes`; delivery one pull request; test runner `node --test`.

## Goal
A lens answer that is not one JSON object is refused with its whole text kept in a file its record names, and the
reason says where the JSON breaks.

## Why
JH 73 ran `js-harness lens-review` three times over f9c10579..37cdab21 (PR 638). Each run had one lens whose answer
"is not closed (it opens at character 0)", and the record kept only its first 300 characters, so why it broke could
not be read and the range went through as a skip.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/lens-review-cut-answers.md` exits 0
- `node --test bin/lens-review.test.mjs` exits 0
- `node --test bin/lib/lens-result.test.mjs` exits 0
- `node --test bin/lib/lens-reviews.test.mjs` exits 0

## In scope / Out of scope
- In: `bin/lens-review.mjs`, `bin/lib/lens-reviews.mjs`, `bin/lib/lens-result.mjs` (the parse) and
  `bin/lib/lens-prompts.mjs` (the prompt), their tests, this document, the session summary; the README sentence and
  the SPEC row that say what `lens-review` writes, outside the brief's listed surfaces (L6).
- Out: Codex's review path; which records a check admits (`admittedLensReviews`); structured output through the CLI's
  `--json-schema`, which would change how every lens answers (L4).

## Constraints
- No check, review or test removed or weakened: a refused answer still covers nothing.
- A kept answer is a diagnosis, never evidence: no check reads it.

## Ask me before
Nothing of this feature is his: no spend past a few lens runs (cents each), nothing irreversible, no product choice.

## Specs
- S1 "Find the cause from evidence. Keep the whole raw answer of a failed lens in a file the record names."
- S2 "Fix the parse or the prompt so a lens answer that quotes JSON is read correctly, or is refused with its full
  text kept."
- S3 "Write the test first, with a fixture answer that quotes JSON from a diff."

## Tasks
- [x] T1 (kind: build) S1, S3: keep a failed lens's whole output in `lens-answers/`, named by the record, with its
  `stopReason` (route: inline; one commit with T2, L7)
- [x] T2 (kind: build) S2, S3: the refusal says where the JSON breaks or that the answer ends first; the prompt asks
  for escaped quotes and backslashes (route: inline; one commit with T1, L7)
- [x] T3 (kind: verify) Codex, the lenses, gentle-ai and one independent verifier over the commits (route: commands
  and one read-only sub-agent; L8, L10, L11)

## Log
- L1, 2026-10-28, the lead's brief (JH 75): "The defect: JH 73 ran `js-harness lens-review` three times over
  f9c10579..37cdab21, on its branch f8-s5c-a-*, PR 638. Each time, one lens's answer did not close its JSON:
  readability, reliability and risk, about 600-900 output tokens each. The other lenses answered with 0 findings. Its
  likely cause, not confirmed, is an answer that quotes JSON from the diff unescaped. The command kept only 300
  characters, so the cause cannot be read from the record. Steps: 1. Find the cause from evidence. Keep the whole raw
  answer of a failed lens in a file the record names. 2. Fix the parse or the prompt so a lens answer that quotes JSON
  is read correctly, or is refused with its full text kept. 3. Write the test first, with a fixture answer that quotes
  JSON from a diff."
- L2, the records (`.git/js-harness/lens-reviews.jsonl`, the runs of 19:57, 19:58 and 20:06Z): readability (832
  output tokens), reliability (911) and risk (571) each "an object in it is not closed (it opens at character 0)";
  the 300 characters kept are the start of a well-formed result, the same as the complete lenses'.
- L3, the cause, as far as evidence reaches:
  - The scanner (`spanEnd`) closes every valid JSON object, so the three answers were not valid JSON.
  - Synthetic answers (`variants.mjs`, scratch) show which faults give that exact reason: an odd number of `"` left
    unescaped inside a string, a backslash before a string's closing quote, or a missing last brace. JSON from the
    diff quoted with its quotes unescaped, such as `'{"written":"again"}'` (block line 232), has an even count and
    gives "does not parse at character N" instead.
  - The diff holds such JSON in strings (`'{}'`, `'{"written":"again"}'`, `'{"changed":true}'`), and the lenses'
    evidence quotes words of it ("baseline 'malformed'").
  - Reproduction: 24 lens runs over f9c10579..37cdab21 (8 rounds of readability, reliability and risk) with this
    branch's code, equal to the installed 0.97.0 in every lens file, all came back complete, with no record written
    (`repro.mjs`, scratch); $0.265 in all. JH 73 had 3 of 9 refused; 0 of 24 at that rate would happen about 6 times
    in 100,000, so something of its runs differed that these did not have. Not known what: the CLI build, the
    service at that hour, or its session's environment.
  - Not known: which of the three faults it was. The kept output (T1) tells the next time, with `stop_reason`,
    `terminal_reason` and `safety_stops`, which a cut stream would show.
- L4, `claude --help` (2.1.312) lists `--json-schema <schema>`, structured output that would make every answer parse.
  Left out: it changes how every lens answers, beyond this brief; open for the lead.
- L5, the CLI's JSON output (`r1-risk.stdout.json`, scratch) carries `stop_reason`, `terminal_reason`, `safety_stops`
  and the thinking tokens, none of which the record kept. So the file keeps the CLI's whole stdout, not only its
  `result`, and the record keeps `stopReason`.
- L6, the brief lists `bin/lens-review.mjs`, `bin/lib/lens-review*.mjs`, `bin/lib/lens-reviews.mjs` and their tests;
  its step 2 names the parse (`bin/lib/lens-result.mjs`) and the prompt (`bin/lib/lens-prompts.mjs`), which that
  glob misses, so both are in. The README sentence and SPEC's row of review records say what `lens-review` writes and
  would be wrong without `lens-answers/`; JH 73's branch touches neither (`git diff --name-only
  origin/main...origin/f8-s5c-a-coverage`).
- L7, T1 and T2 built test first as one unit: the record's reason and its kept file are read in the same test.
  - RED: 5 failing, 2 in `bin/lens-review.test.mjs`, 2 in `bin/lib/lens-result.test.mjs`, and
    `bin/lib/lens-reviews.test.mjs` on its missing export. The escaped fixture and the one quoted as the diff holds it
    already passed: the first is read, the second "does not parse at character N, near" its text.
  - GREEN: 27 of 27 in the three files; `npm run check` PASS, 14 rows.
  - What changes for a refused lens: its result holds `answerFile` (or `answerNotKept` when the write failed) and
    `stopReason`; stderr prints the file on a line of its own; an object that never closes says "it breaks at
    character N, near ..." or "the answer ends before it closes".
  - Not changed: what a check admits, and a complete lens keeps no file.
- L8, the reviews of a93558f1 (30191550..a93558f1):
  - Codex: "the patch is correct" (0.91), no findings; recorded in `codex-reviews.jsonl`.
  - Claude lenses risk, resilience, reliability and readability: complete, 0 findings; recorded.
  - gentle-ai: a93558f1 reviewed in lineage review-548d31cef271fb3e (lenses risk, readability, reliability; tier high
    by item 2), approved and acknowledged, with four advisory findings: R2-001 (`jsonLinesPath` names a JSONL record
    for a plain file), R3-001 (a parser message with no character read as a cut), R3-002 (the tests rest on V8's
    message wording), R3-003 (no test of a failed write).
  - The independent verifier: all five checks hold (no refused answer can count, the file stays in `lens-answers/`, the
    reason points at the right character in 15 probes, RED 5 and GREEN 27 reproduced from the parent's sources, no
    output or doc broken). Minor: a cut answer with prose after it breaks at the prose, so the reason alone does not
    tell every cut; the file is stdout, not stderr; nothing guards or prunes `lens-answers/`; `answerFile` is absolute.
  - My slip: the first `gentle-ai review start` went through `| head -80`, which cut the identifiers its output carried;
    a second start with the same flags resumed the lineage and gave them back. A state-changing command's output goes to
    a file, never through `head`.
- L9, the fixes of L8, test first:
  - R3-001: `{"a":tru "b` breaks mid-text with "Unexpected token ' '" and no character, and was read as a cut (RED). A
    message with no character is now given in the parser's words, and only "end of JSON input" is called a cut.
  - R3-003: a test makes `lens-answers` a file, so the write fails; the record holds `answerNotKept`, stderr says it,
    and the run keeps its record. It passed at once: the behavior was built, only unproved.
  - R2-001: a comment says `jsonLinesPath` only resolves the name. SPEC says stdout, not output. The test comment no
    longer claims the reason alone tells every cut.
  - R3-002 left: the neighbouring `parseFault` test rests on the same V8 wording, Node is the repo's one runtime, and a
    change of wording now falls to the parser's own words rather than to a wrong reason.
  - Left open for the lead: guarding or pruning `lens-answers/`, a relative `answerFile`, and `--json-schema` (L4).
  - GREEN: 28 of 28 in the three files.
- L10, the reviews of 37fc1e65 (a93558f1..37fc1e65):
  - Codex: "the patch is correct" (0.94), no findings; Claude lenses reliability and readability: complete, 0 findings.
  - gentle-ai: 37fc1e65 reviewed in lineage review-1fdc246a7c78cf3c (lens reliability, tier medium), approved and
    acknowledged, with a warning (an empty reason when the parser reads the span whole, a path the scanner never sends)
    and two suggestions (the failed-write test needs `js-harness/` made by an earlier test; the V8 wording, R3-002).
  - Fixed in the next commit: that path now says the scanner and the parser disagree, and the test makes its own
    parent folder; run alone with `--test-name-pattern="cannot be kept"`, it passes. The wording stays as L9 says.
- L11, the reviews of 27d3827c (37fc1e65..27d3827c):
  - Codex: "the patch is correct" (0.98); Claude lenses reliability and readability: complete, 0 findings.
  - gentle-ai: 27d3827c reviewed in lineage review-10fa14e5eeff0fd5 (base a93558f1, lens reliability, tier medium),
    approved and acknowledged, with two suggestions, left: no test drives the "disagree" reason, a path the scanner
    never sends; the failed-write test finds the folder by `--absolute-git-dir`, equal to the common dir in its plain
    fixture repository, which the test builds itself.
- gentle-ai lines: a93558f1 approved (review-548d31cef271fb3e); 37fc1e65 approved (review-1fdc246a7c78cf3c);
  27d3827c approved (review-10fa14e5eeff0fd5).
- Spent: 24 reproduction lens runs, $0.265; 3 Codex reviews; 8 js-harness lens runs; 5 gentle-ai lens runs; one
  verifier sub-agent (about 97,000 tokens). No evals.

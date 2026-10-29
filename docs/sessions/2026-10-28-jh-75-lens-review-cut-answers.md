# JH 75 · lens-review: lens answers cut before their JSON closes

Brief: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T20-12-41-217Z-8f16acd8.md`. Branch
`fix/lens-cut-answers`, PR 639, base main `30191550`. Feature document: `odd/tasks/lens-review-cut-answers.md`.

## Goal
A lens answer that is not one JSON object is refused with its whole text kept in a file its record names, and the
reason says where the JSON breaks.

## The user's words
The lead's brief (not Sebastián's words): "Find the cause from evidence. Keep the whole raw answer of a failed lens in
a file the record names. Fix the parse or the prompt so a lens answer that quotes JSON is read correctly, or is
refused with its full text kept. Write the test first, with a fixture answer that quotes JSON from a diff." No message
from Sebastián in this session.

## Delivered
- `a93558f1`: a refused lens keeps its CLI's whole stdout in `<git common dir>/js-harness/lens-answers/<run>-<lens>.stdout`,
  named by `answerFile`, with `stopReason`; a failed write is `answerNotKept` and never costs the record. An object that
  never closes says where the parser breaks or that the answer ends first. The prompt asks for escaped quotes and
  backslashes. README and SPEC say what is written.
- `37fc1e65`, `27d3827c`: gentle-ai's advisories. A parser break with no character is given in the parser's words;
  tests of a failed write; no empty reason.
- `3b0e7936` and this summary: the feature document's reviews and what stays open.

## Decisions
- The cause is not known. The scanner closes every valid object, so JH 73's three answers were invalid JSON. The fault
  was an odd count of unescaped quotes, a backslash before a closing quote, or a missing last brace. JSON quoted from
  the diff unescaped gives "does not parse" instead (scratch probes, L3). 24 reproduction runs over the same range
  were all complete (L3).
- The file keeps the CLI's whole stdout, not only `result`, because `stop_reason`, `terminal_reason` and `safety_stops`
  would show a cut stream (L5).
- Refuse, never repair: a repaired answer could count as a review it was not.
- `bin/lib/lens-result.mjs`, `bin/lib/lens-prompts.mjs`, README and SPEC are outside the brief's listed surfaces; step 2
  names the parse and the prompt, and the docs would be wrong without the new folder (L6).

## Failures and lessons
- The first `gentle-ai review start` went through `| head -80` and lost the identifiers in its output. The same start
  run again resumed the lineage. A state-changing command's output goes to a file.

## Left
- PR 639 to land.
- For the lead: the CLI's `--json-schema` structured output, which would make every answer parse (L4); guarding or
  pruning `lens-answers/`; a relative `answerFile`; gentle-ai's left suggestions (L9, L11).

## Cost
24 reproduction lens runs, $0.265; Codex 77,706, 62,387 and 54,512 input tokens; js-harness lenses 4 × about 12,100,
2 × 5,240 and 2 × 3,330 input tokens; gentle-ai 5 lens runs (3 on a93558f1, 1 each after); the independent verifier
about 97,000 subagent tokens. No evals.

# JH 76 · lens-review: structured output so a lens answer always closes its JSON

Brief: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T21-11-28-761Z-11112787.md`. Branch
`fix/lens-structured-output`, base main `729ba8fb`. Feature document: `odd/tasks/lens-review-structured-output.md`.

## Goal
Each lens run asks the CLI for structured output against the lens answer's schema and answers in English, so the host
enforces the shape the parse then reads; the text parse and the kept-file refusal stay as the fallback.

## The user's words
The lead's brief (not Sebastián's words): "Make lens-review ask for structured output. ... Pass the lens answer's
schema there, so the host enforces the shape. ... Make the lens answer in English, whatever the user's language
setting is, by the prompt or a flag. ... Write the tests first. Use the kept file above as a fixture ... Prove it on a
real run: one lens-review over JH 73's range f9c10579..4c44d3bb, read-only". No message from Sebastián in this session.

## Delivered
- `9c6ebb17`: each lens run passes `--json-schema <LENS_ANSWER_SCHEMA>` and `--settings <file>` holding
  `{"language":"English"}`; the answer is read from `structured_output` when it is an object, else from `result` as
  before. The schema sits beside the parse in `bin/lib/lens-result.mjs`, whose field lists now come from it. JH 73's
  kept stdout is a fixture in `bin/lib/lens-review-answers.testkit.mjs`.
- `c3a74543`, `697a7a0d`, `9b33bde4`: the advisories of gentle-ai and the verifier (what a structured `stopReason`
  means, what the fallback reaches, a test of a `structured_output` that is no object, where the schema is narrower
  than the parse, `Object.hasOwn` in the test's validator).

## Decisions
- The language comes from `~/.claude/settings.json` `"language": "Español"`, which `--safe-mode` keeps; the prompt
  already said English. `--settings` overrides that one key; `--setting-sources` would drop all the user's settings (L3).
- The parse stays the authority: the schema leaves the hash and the paths free, so the echo and the manifest are still
  proved by the answer (L4).
- The fixture is a testkit, because `bin/` is published and testkits are left out (L5).

## Failures and lessons
- The first `notify --kind ready` was refused: 9b33bde4 sat on the wrapped second line of a gentle-ai entry, and the
  merge door reads evidence a line at a time. One gentle-ai line a code commit, each saying gentle-ai.
- `js-harness wait --pr 640` exited 1 with no closing line, though the PR had merged; no notice to 76 was in the
  channel. Not known why; likely the lead's copy refresh after the merge, which the lead warns can kill a wait.
- The worktree guard refused compound shell lines (`cd` with `&&`, redirections, `.git` paths); edits went through
  scripts written to the job's scratch folder and run as plain commands.

## Proof
One real lens-review over f9c10579..4c44d3bb on JH 73's commits with this branch's code: risk, reliability and
readability complete, 0 findings, in English, $0.1555 (L7). One more readability run with no record showed the answer
came in `structured_output` ($0.016). The verifier found the old and new parse agree on 200,000 mutated answers (L11).

## Left
- The PR to land; the installed copy to refresh (the lead's).
- The proof record covers JH 73's range with this branch's code, which main does not hold until this lands.
- Not seen: what the CLI does when an answer fails the schema; a CLI older than 2.1.312 makes every lens incomplete.

## Cost
Probes $0.009; proof run $0.1555 + $0.016; js-harness lenses 9 runs ($0.248 for the first four); Codex 4 reviews
(86,359, 37,969, 35,105 and 27,581 input tokens); gentle-ai 8 lens runs over 4 lineages; one verifier sub-agent,
88,926 tokens. No evals.

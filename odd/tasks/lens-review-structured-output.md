# Lens review: structured output, so a lens answer always closes its JSON

The lead's brief JH 76 of 2026-10-28. Branch `fix/lens-structured-output` from `main` 729ba8f; owner `JH 76 ·
lens-review: structured output so a lens answer always closes its JSON`; delivery one pull request; test runner
`node --test`.

## Goal
Each lens run asks the CLI for structured output against the lens answer's schema and answers in English, so the host
enforces the shape the parse then reads; the text parse and the kept-file refusal stay as the fallback for a CLI that
takes the flags and gives no structured output.

## Why
JH 73's lens rerun over f9c10579..4c44d3bb was refused again (readability): its kept stdout shows `stop_reason`
`end_turn` and a `result` whose `inspection` never closes after `paths`, so the outer object stays open, and the
answer is in Spanish although the prompt asks for English. A schema the host enforces cannot leave an object open.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/lens-review-structured-output.md` exits 0
- `node --test bin/lens-review.test.mjs` exits 0
- `node --test bin/lib/lens-result.test.mjs` exits 0
- One real `lens-review` over f9c10579..4c44d3bb, on JH 73's commits, completes, in English

## In scope / Out of scope
- In: `bin/lens-review.mjs` (the CLI arguments and which field is read), `bin/lib/lens-result.mjs` (the schema beside
  the parse it mirrors, L4), their tests and fixtures, this document, the session summary.
- Out: what a check admits (`admittedLensReviews`); the prompt's text (it already asks for English, L3); Codex's
  review path; JH 73's branch, which is only read.

## Constraints
- No check, review or test removed or weakened: the parse still decides what counts, and a refused answer still
  covers nothing.
- The schema crosses `cmd.exe` as one argument when the CLI is an npm shim, so it holds none of `&|<>^%`.

## Ask me before
Nothing of this feature is his: no spend past a few lens runs (cents each), nothing irreversible, no product choice.

## Specs
- S1 "Make lens-review ask for structured output. ... Pass the lens answer's schema there, so the host enforces the
  shape. Read the structured field the CLI returns ... Keep the current parse, and the kept-file refusal, as the
  fallback."
- S2 "Make the lens answer in English, whatever the user's language setting is, by the prompt or a flag."
- S3 "Write the tests first. Use the kept file above as a fixture: copy it into the test's fixtures, not a reference
  to .git."
- S4 "Prove it on a real run: one lens-review over JH 73's range f9c10579..4c44d3bb, read-only, from your worktree on
  JH 73's commits ... Say what the run cost."

## Tasks
- [x] T1 (kind: build) S1, S2, S3: the schema, `--json-schema`, `--settings` with `language: English`, read
  `structured_output` first, the kept file as a fixture (route: inline; one commit)
- [x] T2 (kind: verify) S4: one real lens-review over f9c10579..4c44d3bb on JH 73's commits (route: command)
- [x] T3 (kind: verify) Codex, the lenses, gentle-ai and one independent verifier over the code commit (route:
  commands and one read-only sub-agent)

## Log
- L1, 2026-10-28, the lead's brief (JH 76): "The cause is now read, not guessed. JH 73's lens rerun over
  f9c10579..4c44d3bb was refused again (readability). ... stop_reason end_turn, the model's `result` opens an object,
  never closes `inspection` after `paths`, and nests findings and evidence inside it, so the outer object stays open.
  The answer is also in Spanish: the user's language setting reaches the lens's `claude -p` run."
- L2, the envelope, from two real runs (CLI 2.1.312, `probe.mjs`, scratch; $0.006 and $0.003): with `--json-schema`
  the CLI's JSON output carries `structured_output`, the object itself, and `result`, the same object as text;
  `stop_reason` is `tool_use` and `num_turns` 2, since the CLI answers through a tool of its own, which `--tools ""`
  does not take away.
- L3, the language: `~/.claude/settings.json` holds `"language": "Español"` (line 396), and `--safe-mode` does not drop
  it: the run without an override answered in Spanish although its system prompt said English; the same run with
  `--settings <file>` holding `{"language":"English"}` answered in English. The prompt already says "Write every text
  field in English", so the flag is the fix, not the prompt. `--setting-sources project,local` would drop the user's
  settings whole, more than the language.
- L4, where the schema lives: beside the parse, in `bin/lib/lens-result.mjs`, which holds the field lists the schema
  mirrors (one home for the shape), outside the brief's glob as L6 of `lens-review-cut-answers.md` read it for the
  same file. The parse stays the authority: the schema leaves `subject_hash` and the paths free, so the echo and the
  manifest are still proved by the answer, not forced by the host.
- L5, the fixture: the kept stdout is copied whole into `bin/lib/lens-review-answers.testkit.mjs`, since `bin/` is
  published (`package.json` `files`) and a testkit is left out of it; a plain file under `bin/` would ship.
- L6, T1 built test first:
  - RED: 4 failing of 25 in `bin/lens-review.test.mjs` and `bin/lib/lens-result.test.mjs`: the arguments, the shim's
    command line, the settings file and the read of `structured_output`. The schema was written before the RED run so
    the files would load; its two tests passed at once, as did the fallback over JH 73's answer and a structured
    answer the parse refuses, which held already.
  - GREEN: 34 of 34 in the three lens files; `npm run check` PASS, 14 rows.
  - What changes: each lens run passes `--json-schema <the schema>` and `--settings <file>` holding
    `{"language":"English"}`, both written beside the prompt and removed after; the answer is read from
    `structured_output` when the CLI gives an object there, else from `result` as before. `TOP` and `FINDING` are now
    read from the schema, so the shape is named once.
  - Not changed: the parse and what it refuses, the record's fields, the prompt, what a check admits.
- L7, T2, the proof run (S4): JH 73's branch `f8-s5c-a-coverage` fetched (cd9c4220, 4c44d3bb on it), nothing written
  to it; `node bin/js-harness.mjs lens-review --base f9c10579 --head 4c44d3bb --lenses risk,reliability,readability`
  from this worktree at 9c6ebb17, the lenses JH 73 picked. All three complete, 0 findings, evidence in English; run
  35c1dd72-18d7-4144-9e49-239ca9ef9ea5 at 21:30:17Z. Cost $0.1555 (risk $0.0595, reliability $0.0484, readability
  $0.0476), about 29 s of lens time. The record says not which field was read, so one more readability run through
  `runLens` with no record (`one-lens.mjs`, scratch; $0.016) showed it: `structured_output` an object, `result` the
  same object as text, `stop_reason` `tool_use`, `num_turns` 3, the parse complete. This record covers JH 73's range
  with this branch's code, which main does not hold yet.
- L8, the reviews of 9c6ebb17 (729ba8fb..9c6ebb17):
  - Codex (`--doc` this document, `--prompt own`): "the patch is correct" (0.91), no findings; 86,359 input tokens.
  - Claude lenses risk, resilience, reliability and readability (installed 0.97.0): complete, 0 findings; $0.248.
  - gentle-ai: lineage review-1c6c8e13ac08b21e (lenses risk, readability, reliability; tier high by item 2), approved
    and acknowledged, with three suggestions: R2-001 (with structured output every run stops at `tool_use`, which the
    `stopReason` comment did not say), R3-fallback-guard-untested (no test of a `structured_output` that is no
    object), R3-fallback-reach (the fallback covers a CLI that takes the flags and gives no `structured_output`; one
    that does not know them exits non-zero, incomplete).
- L9, the fixes of L8: the `stopReason` comment says a structured answer stops at `tool_use`; the read's comment and
  the Goal say what the fallback reaches; a test gives `structured_output` as `null`, `[]` and a string beside a
  valid `result`, each read from `result`. It passed at once: the guard was built, only unproved. GREEN 35 of 35.
- L10, the reviews of c3a7454 (9c6ebb17..c3a7454):
  - Codex: "the patch is correct" (0.98), no findings; 37,969 input tokens.
  - Claude lenses reliability and readability: complete, 0 findings.
  - gentle-ai: lineage review-0209e1a8721ea743 (lenses readability, reliability; tier medium), approved and
    acknowledged, with one suggestion, R2-opaque-ledger-ref: a source comment named `(L2)` with no document.
- L11, the independent verifier (read-only sub-agent, 88,926 tokens) over 729ba8fb..c3a7454: all five checks hold.
  The old and new `lensResult` agree on 200,000 seeded mutated answers (0 differences, 27,907 accepted); a structured
  object is read through the same parse, so no check is skipped; every answer the parse accepts meets the schema but
  for extra fields inside `inspection`; the schema round-trips through `quoteWindowsArg` and a C-runtime parse; the
  temp folder is removed when the spawn throws; 35 of 35; the fixture is not in `npm pack --dry-run`. Not checked: what
  the real CLI does when an answer fails the schema, and a CLI older than 2.1.312. Two suggestions: S1, the schema's
  comment said it held the parse's shape "and no more", but it forbids extra `inspection` fields the parse lets pass;
  S2, the test's validator used `in`, which sees `Object.prototype` keys.
- L12, the fixes of L10 and L11: the comments name their document; the schema's comment says it is one field narrower
  than the parse inside `inspection` (the parse is left as it is, since refusing those fields would refuse answers that
  count today); the validator uses `Object.hasOwn`, and an answer with a `constructor` field is among the refused
  shapes, which the old validator would have thrown on. GREEN 35 of 35.
- L13, the reviews of 697a7a0 (c3a7454..697a7a0): Codex "the patch is correct" (0.99); Claude lenses reliability and
  readability complete, 0 findings; gentle-ai lineage review-37264eed8b258075 (tier medium) approved and acknowledged,
  with one suggestion, R2-schema-comment-one-field-less: "one field less" reads as a missing field, so the comment now
  says the schema admits less in one place. A comment-only commit, reviewed by Codex, the lenses and gentle-ai.
- L14, the reviews of 9b33bde4 (697a7a0..9b33bde4): Codex "the patch is correct" (0.99); Claude lens readability
  complete, 0 findings; gentle-ai lineage review-69dc66f23de65793 approved with no finding, acknowledged.
- gentle-ai: 9c6ebb17 approved (review-1c6c8e13ac08b21e).
- gentle-ai: c3a74543 approved (review-0209e1a8721ea743).
- gentle-ai: 697a7a0d approved (review-37264eed8b258075).
- gentle-ai: 9b33bde4 approved (review-69dc66f23de65793).
- Left open for the lead: what the CLI does when an answer fails the schema (retries, or `is_error` with a subtype),
  not seen in a real run; a CLI older than 2.1.312 that does not know the flags makes every lens incomplete; the
  installed copy, which still runs lenses without structured output until it is refreshed.
- Spent: probes $0.009; the proof run $0.1555 and one more lens $0.016; js-harness lenses 4 + 2 + 2 + 1 runs ($0.248
  for the first four); Codex 86,359, 37,969, 35,105 and 27,581 input tokens; gentle-ai 3 + 2 + 2 + 1 lens runs; one
  verifier sub-agent, 88,926 tokens. No evals.

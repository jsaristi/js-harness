# Memory feedback home

A rule he states is written to the repository before any memory note may hold it. Branch `rule/memory-feedback-home`;
test runner `node --test`; delivery `single-pr`.

## Goal
A `feedback` note of a project's Claude Code memory folder is written only when it names where its rule is cemented
in the repository, and every feedback note already in this project's folder does.

## Why
On 2026-10-15 the session JH 5 sat paused waiting for him to type /compact, because his new rule (he never compacts by
hand) lived only in a memory note while AGENTS.md still said the old one. Memory is the cheapest place to write a rule,
so agents keep choosing it; a sensor removes that path instead of a reminder that asks for discipline.

## Done when
- `node --test bin/guard.test.mjs bin/guard-feedback.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs guard --memory C:/Users/Oficina/.claude/projects/D--js-harness/memory` exits 0
- The guard refuses a Write of a bare feedback note and lets through one that names `rule:<id>` of a declared rule.

## In scope / Out of scope
- In: `bin/guard.mjs`, a new `bin/lib/memory-feedback-guard.mjs`, their tests, the rule's declaration and source, the
  harness's own rules that his feedback notes carry, AGENTS.md, docs, this project's memory notes.
- Out: notes of type `project`, `user` and `reference` (doctor's `memory-rules` row already reports `project` notes);
  writes to the memory folder by Bash, which no PreToolUse check of Write and Edit sees.

## Constraints
- The guard runs on every Write and Edit of every session — because of that a call that is no feedback note loads no
  module and reads no file beyond what it loads today.
- A project that installs the harness turns nothing on by default — because of his answer of 2026-10-14
  (odd/tasks/honesty-audit.md S5): the check runs only where the rule memory-feedback-home is declared.

## Ask me before
Deleting any memory note: one list, sent through the lead.

## Specs
- S1 His words of 2026-10-15, in the lead's chat, as the lead's brief quotes them: "si pero todo lo que se deja en
  memoria se pierde por que seguimos guardando cosas importantes y relevantes en memoria, por eso pasa lo que esta
  pasando" and "dime como hacemos para que estas directrices importantes deje de estarlas guardando en memoria y las
  cemente o sino vamos a estar constantemente equivocandonos".
- S2 `js-harness guard --hook` (PreToolUse, Write/Edit) refuses a write to a memory folder of a note whose frontmatter
  type is `feedback` unless the note names where the rule is cemented in the repo: a rule id in `docs/rules.json` /
  `docs/rule-sources.json`, or an AGENTS.md phrase, that `rules check` can find. Tests first, through the public
  command. The refusal message names how to cement it.
- S3 One move pass: every existing feedback note in that memory folder that states a rule gets its user's verbatim
  words into the repo (rules sources, AGENTS.md, roadmap or a feature document), and the note shrinks to a pointer.
  Use `js-harness memory plan/verify`; deletions are asked as one list through the lead.
- S4 Help text and docs updated. Item 2 of the high-risk list (a guard): gentle-ai review plus Codex review per
  AGENTS.md.

## Tasks
- [ ] T1 (kind: build) S2: the guard, test first; the rule memory-feedback-home declared with `js-harness rules change`
- [ ] T2 (kind: build) S3: the move pass over the feedback notes
- [ ] T3 (kind: docs) S4: help text, README/GUIDE, roadmap
- [ ] T4 (kind: verify) S4: gentle-ai review and Codex review of the slice

## Log
- L1 (2026-10-22) The brief from the lead (JH ORQ), verbatim in its task part: "In D:\js-harness, make it impossible
  for a rule Sebastián states to live only in Claude's memory folder (C:\Users\Oficina\.claude\projects\D--js-harness\memory\)."
  followed by S1-S4 and "Done when: the guard test refuses a bare feedback note and allows one naming a rule that
  `rules check` finds, `npm run check` is green, and no feedback note in that folder states a rule absent from the repo."
- L2 (2026-10-22) His words of S1 are in no transcript on this machine: `grep -rlF -e "se deja en memoria" -e "las
  cemente" -e "guardando en memoria" --include=*.jsonl` over `~/.claude/projects` found only this session's brief.
- L3 (2026-10-22) Reading of "an AGENTS.md phrase that rules check can find": the note quotes, on a line that names
  AGENTS.md, a phrase of at least `rule:control-phrase-min` characters that AGENTS.md holds (whitespace squashed, as
  `rules check` matches phrases). "A rule id": a live rule declared in `bin/lib/rules-data.mjs`, whose source is in
  `docs/rule-sources.json`, named as `rule:<id>` in backticks. A project's `docs/rules.json` is not read: the check is
  in force only where the rule memory-feedback-home is, of scope repository, so only in this repository, which has none.
- L4 (2026-10-22) With his words in no transcript (L2), `rules change` cannot source a rule of his (it reads each
  quotation from its transcript), so the rule memory-feedback-home is declared with owner `project` and this document as
  its design source; the lead was asked for the transcript and may re-own it with his words. A `--memory <folder>` form
  of `guard` reports the folder's notes, so the last line of "Done when" is a command.
- L5 (2026-10-22) gentle-ai review of b7fe2955..73f61b9f (escalated: item 2, a guard; lenses risk and reliability):
  approved, acknowledged (lineage review-51c9cc810418a5ba), four advisory findings. Fixed after it: a note's type is
  read before any module loads (`memoryNoteType` moved to the zero-import memory-index-guard.mjs), `guard --memory`
  reports a note it cannot read instead of throwing, and the help no longer says every form exits 0. Not taken: "the
  bundled RULES may differ from the project's file" — `ruleHere` gives the rule's value only when the project's list
  is the running copy's, so where the check is in force the two are the same list.

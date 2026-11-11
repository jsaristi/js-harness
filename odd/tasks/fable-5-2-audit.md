# JH 161 · Fable 5.2 audit of the whole harness

Locator: `odd/tasks/fable-5-2-audit.md` · Engram mirror: `odd/fable-5-2-audit/tasks` · Branch:
`claude/fable-5-2-audit-531f8e` (worktree `probe-auto-archive-3b36c3`) · Delivery: one documentation-only pull
request · Subject: `origin/main` at `378642bb5751041ec84dcf8ca7e616a03e1dcf4e`

## Goal
One dated audit document, `docs/audits/2026-11-09-fable-5-2-audit.md`, says what a read of the whole harness by
`claude-fable-5-2` found: findings in order of severity, each with its evidence and marked checked, assumed or not
known; what was not reviewed, named; and, apart, what the harness could shed or merge, as candidates.

## Why
A new, stronger model is out and he wants it to review everything built so far (L1, L2). The harness's bet is that
a stronger model needs a smaller harness (`AGENTS.md:9`), so the read has two uses: defects the earlier models and
reviews left, and the parts a stronger model no longer needs. He decides on every fix and every cut; this session
only brings the evidence.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/fable-5-2-audit.md` exits 0
- `git diff --quiet 378642bb HEAD -- bin evals scripts workshop templates .githooks .github .claude AGENTS.md CLAUDE.md README.md harness.json package.json` exits 0
- `node workshop/js-harness-workshop.mjs docs check` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- the audit document exists, with its findings by severity, its coverage and its candidates apart
- the pull request is open, holds documents alone and is told to the lead with `notify --kind ready`

## In scope / Out of scope
- In: three documents of this session: this one, the audit under `docs/audits/` and the session summary under
  `docs/sessions/`. Reading everything `origin/main` holds at `378642bb`: `bin/`, `evals/`, `scripts/`,
  `workshop/`, `templates/`, the hooks, what `install` and `init` write, the rules register, `odd/tasks/` and
  `docs/`. Read-only commands of the harness, and tests once, their cost said first.
- Out: any source, rule or document that is not this session's; any fix; any merge; any issue; any eval run,
  Codex review or paid batch; the protocol of `docs/future-model.md`; the rules `session-model` and
  `session-effort`; his `~/.claude`, `~/.codex` and credentials. Pull requests 797, 798 and 799 (F8 S5), 596 and
  785 (the TUI) are open, not on main, and outside the subject.

## Constraints
- Read-only — because the brief says so and a finding is a proposal he decides through the lead.
- No spend — because question 239 told him "No gasta dólares; usa tu plan"; a Codex read is spend of his weekly
  limit, so the Codex half of `rule:double-review` cannot run here (L4).
- Sub-agent readers run on the model and effort the rules give them (`rule:subagent-reader-model`,
  `rule:session-effort`) and
  only map; whatever a finding rests on is read or run by this session before it is written as checked.
- One slice does not hold the subject (Depth pass, item 4), so coverage is said per area, never assumed.

## Ask me before
Nothing planned is his: the audit was asked (L1), its scope answered (L2), it spends no money and changes
nothing. A finding that looks urgent (data at risk, a secret exposed) goes to the lead at once with
`js-harness notify --to orchestrator --kind note`, not at the end.

## Depth pass
- 1. Method: the discipline is an independent technical audit, as an outside reviewer does due diligence on a
  codebase and its process: fix the subject at one commit; read the entry documents the project itself gives a cold
  auditor (`docs/README.md:20-36`); run the project's own structural checks before reading, since a red or false
  check is the cheapest finding; map the whole with readers, one batch a context, each leaving a ledger of claims
  with `path:line`; then verify every claim that becomes a finding at its source, and attempt to refute it, before
  it is written; rank by what breaks (data, security, a contract others consume, a control that does not act)
  before what is untidy; and say what was not read. Their standard: no finding rests on a reader's word, and no
  area is called clean that was not read. The smallest change that meets it is one document under `docs/audits/`,
  written as its two neighbours are (`docs/audits/2026-10-30-cleanup-inventory.md:36-54`: what, evidence, why it
  matters, action, whose call). The search of `rule:reuse-first`: the pre-launch audit
  (`odd/tasks/launch-audit.md`, last changed 2026-10-24, commit `7f9d2fae`) is closed and 220 first-parent commits
  old; the audit pack (`odd/tasks/audit-pack.md:6-12`) built the reading plan this audit uses and ran no audit;
  `docs/audits/` holds two records of 2026-10-30, of the machine and of one hour of processes, none of the source.
- 2. Raw material: the tracked files at `378642bb`, read through the plan `node workshop/js-harness-workshop.mjs
  docs plan` prints (1,522 files, 6,226,644 estimated tokens, 19 slices); the harness's own records run live:
  `js-harness rules`, `rules check`, `rules coverage`, `failures`, `contract check`, `docs check`, `spec`; his
  words at transcript `ea85ec35`, line 576 (question 239, read with `js-harness sessions --quote`); and
  `docs/FAILURES.md:1` onward for what already went wrong, so a finding says whether it is new.
- 3. The bar:
  spec 1: `git rev-parse origin/main`: 378642bb5751041ec84dcf8ca7e616a03e1dcf4e, the subject, recorded
  spec 2: `node workshop/js-harness-workshop.mjs docs plan`: 1,522 files in 19 slices; 0 audited today, and the
  audit names each area as read by this session, mapped by a reader, sampled or not read
  spec 3: `git ls-files docs/audits`: two records of 2026-10-30, none of the whole harness; the new document holds
  every finding with evidence and its mark
  spec 4: `git diff --stat 378642bb HEAD -- bin evals scripts workshop`: empty today, and empty at the close
  spec 5: `git ls-files docs/audits`: none, new behaviour; the candidates to shed or merge sit in their own section
- 4. Refutation: the request fails if the harness's own entry for a cold audit and its structural checks already
  hold, so a whole read would only repeat them, or if the whole cannot be read at all. Run now: `js-harness docs
  plan`, the first step `docs/README.md:22` gives a cold auditor, answers "Unknown command: docs" and exits 2 (the
  command lives in the workshop dispatcher since the topology split), while `node workshop/js-harness-workshop.mjs
  docs check` passes and prints that same dead name; `js-harness failures check --settled` exits 1 with 12 of 141
  failures not settled. So one defect no check sees stands on the first step, and there is material to judge. On
  size: 6,226,644 estimated tokens against one context, so "todo" holds only as the brief frames it, mapped by
  readers and verified here, with the gaps named; it would not hold as one session reading every line.
  Verdict: supports
- 5. Request: review everything `origin/main` holds at `378642bb`, the whole harness and not F8 alone, read-only
  and with no spend; map it with Opus readers over the reading plan's slices and verify at the source every claim
  that becomes a finding; deliver one audit document with the findings by severity, each with evidence and marked
  checked, assumed or not known, the areas not reviewed, and apart the candidates a stronger model suggests the
  harness could shed or merge; as a documentation-only pull request the lead carries to him.
  Adds: none

## Specs
1. "quiero que revise todo lo que hemos hecho" (L1): the subject is everything on `origin/main` at the commit the
   session starts on, its hash recorded.
2. "Todo el harness (recomendado)" (L2): the whole harness, not F8 alone and not the last two days.
3. Question 239, which he answered, promised "un informe de hallazgos por gravedad, con su evidencia": one audit
   document, findings in order of severity, each with its evidence and marked checked, assumed or not known, and
   what was not reviewed, named (the marks and the coverage are the lead's brief, L3).
4. Question 239: "no cambia ni une nada. No gasta dólares; usa tu plan": read-only and no spend.
5. The lead's brief (L3): apart, what a stronger model suggests the harness could shed or merge, as candidates
   with their evidence, never as changes.

## Tasks
- [x] T1 (kind: design) The depth pass and this document, committed alone before anything else (specs 1 to 5)
- [x] T2 (kind: verify) Map the subject with Opus readers, each batch leaving a ledger in the session's notes
  folder: 15 batches of the core source, then the evals and scripts, the tests by sample, the documents and the
  feature documents (spec 2)
- [x] T3 (kind: verify) Verify at the source every claim that becomes a finding, and try to refute it (spec 3)
- [x] T4 (kind: docs) The audit document: findings by severity, coverage, candidates apart (specs 3 and 5)
- [x] T5 (kind: docs) The session summary, the pull request, `notify --kind ready`, then closed (spec 4)

## Log
- L1 (2026-11-09, his words, lead transcript `ea85ec35`, as the opening quotes them; not read at their line by
  this session): "Hoy ya salio Fable 5.2, y en este momento lo estoy utilizando en modo Max y quiero que revise
  todo lo que hemos hecho".
- L2 (2026-11-09, checked: `js-harness sessions --quote ea85ec35 576`, entry of 2026-11-10T01:00:37Z): to question
  239 he tapped "Todo el harness (recomendado)", the other options being "Solo F8" and "Solo ayer y hoy". The
  question told him: one new session (JH 161) on Fable 5.2 at max effort as an exception that changes no rule,
  read-only, "entrega un informe de hallazgos por gravedad, con su evidencia, y no cambia ni une nada. No gasta
  dólares; usa tu plan", and that the paid evals of the new-model protocol are asked apart.
- L3 (2026-11-09, the lead's brief, read with `js-harness sessions --opening`): the subject, the read-only and
  no-spend limits, the shape of the document, the candidates apart, the depth pass first, Opus readers to map,
  reports only through `js-harness notify --to orchestrator`. The session that started this one said it starts at
  high effort and that he may raise it to max himself; this session cannot read its own effort, so the effort it
  ran at is not known here.
- L4 (2026-11-09, decision of this session, told to the lead): `rule:double-review` asks a blind Claude read and a
  Codex read of a proposing document; the brief forbids a Codex review and any spend. This session runs neither
  read and says so in the audit: its candidates reach him unreviewed by a second reader unless the lead asks for
  the reads apart. Every finding is verified at its source by this session instead.
- L5 (2026-11-09, evidence, the structural checks at `378642bb`): `rules check` PASS (76 rules), `docs check` PASS,
  `spec` PASS (79 capabilities), `contract check` exit 0, `rules coverage` PASS, `failures check --settled` exit 1
  (12 of 141 not settled); `js-harness docs plan` exit 2, "Unknown command: docs".
- L6 (2026-11-09, cost said first): T2 launches about 21 Opus 5.5 readers at high effort, each over at most about
  90,000 estimated tokens of files, in waves; they use his plan and no dollars. The commit of this document runs
  the gate's document sensors once (`harness.json`, `documentSensors`), under the shared gate lock.
- L7 (2026-11-09, state, written before the context pause): 21 readers launched (15 batches of the core source,
  two of the evals and scripts, one of the tests, two of the documents, one of the feature documents); the host
  allows 20 at once, so the last entered when the first ended. Each reader's ledger and this session's own ledger
  of what it verified (`AUDITOR-LEDGER.md`) are in the session's notes folder, under `jh161/`, outside the
  repository. A resumed session reads that ledger first: it names which readers returned, what was verified at
  its line and what is still a reader's word. Notices sent: opened, and the first third.
- L8 (2026-11-09, state after the compaction): the host compacted this session by itself after L7; it resumed from
  L7 and its ledger, and told the lead. The 21 readers all returned. Notices sent since: the note of the
  compaction and the second third.
- L9 (2026-11-09, result against the depth pass): the request held (item 4, "supports"). Item 3, the bar, at the
  close: spec 1, the subject is recorded in the audit's first line; spec 2, the audit's "Coverage" names each area
  as read by this session, mapped by a reader, sampled or not read, and no area is called clean; spec 3,
  `docs/audits/2026-11-09-fable-5-2-audit.md` holds 2 high, 37 medium and 8 low findings verified by this session,
  and 44 medium and 247 low reported by a reader and marked assumed; spec 4, `git diff --stat 378642bb HEAD -- bin
  evals scripts workshop` is empty; spec 5, 27 candidates sit in their own section. What a single read by one
  context would have missed is the reason the readers were used; what the readers' word alone would have got
  wrong is why each high and medium was read again: four reader claims were lowered (the rule proofs, the
  heartbeat ticks, the stretch control and the v1.0.0 box), and one first test of the blanking, run on samples with no digit, gave a
  false result before it was run again with real shapes.
- L10 (2026-11-09, decision of this session): the repository is public (`gh repo view --json visibility`), so the
  audit is public once pushed, with its two security findings. It names shapes the blanking misses, not a secret;
  the backup repositories it concerns are private. Said to the lead in the ready notice, for him to weigh before
  the merge.
- L11 (2026-11-09, delivered): pull request 800, documents alone, open; the audit is commit `20da2404`. The session
  summary is `docs/sessions/2026-11-10-jh-161-fable-5-2-audit-of-the-whole-harness.md`. The notices ready and
  closed follow this commit. Merging is the lead's, after his yes.

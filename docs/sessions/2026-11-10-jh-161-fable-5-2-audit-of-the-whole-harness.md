# JH 161 · Fable 5.2 audit of the whole harness

## Goal
A read-only audit of everything `origin/main` held at `378642bb5751041ec84dcf8ca7e616a03e1dcf4e`, by
`claude-fable-5-2`, with no spend, ending in one audit document under `docs/audits/` as a documentation-only pull
request. The opening was read with `js-harness sessions --opening 'JH 161 · Fable 5.2 audit of the whole harness'`;
the session was started by the lead (JH ORQ), not typed by him.

## The user's words
- "Hoy ya salio Fable 5.2, y en este momento lo estoy utilizando en modo Max y quiero que revise todo lo que hemos
  hecho": the lead's transcript `ea85ec35`, as the opening quotes it; not read at its line by this session.
- To question 239 he tapped "Todo el harness (recomendado)": `js-harness sessions --quote ea85ec35 576`, entry of
  2026-11-10T01:00:37Z, read by this session. The question told him the session is read-only, "entrega un informe
  de hallazgos por gravedad, con su evidencia, y no cambia ni une nada. No gasta dólares; usa tu plan".

## Delivered
- Pull request 800, open, documents alone: https://github.com/jsaristi/js-harness/pull/800
- `docs/audits/2026-11-09-fable-5-2-audit.md` (commit `20da2404`): 2 high, 37 medium and 8 low findings verified by
  this session at their lines or by running a pure function; 44 medium and 247 low reported by a reader and marked
  assumed; 27 candidates to shed or merge, in their own section; a coverage table that names what was read by the
  session, mapped by a reader, sampled or not read.
- `odd/tasks/fable-5-2-audit.md`: the feature document, opened alone in commit `763325a7` with its contract and
  depth pass, closed in this branch with its log.
- This summary.
- Outside the repository, in the session's notes folder under `jh161/`: the 21 readers' ledgers, the brief they
  were given and this session's own ledger of what it verified. They are not in the pull request.

## Decisions
- The scope, the read-only limit and no spend: his, question 239 (feature document, L2).
- The shape of the document, readers on Opus 5.5, reports through `notify`: the lead's brief (L3).
- No double review of the audit, since its Codex half is a spend the brief forbids: this session's, told to the
  lead (L4, and said in the audit under "How it was taken").
- Every high and medium finding is read again or run by the session before it is written as checked; lows the
  session did not verify go to appendices marked assumed: this session's (feature document, Constraints).
- Four reader claims ranked lower than their reader ranked them, each said where it stands in the audit (the rule
  proofs, the heartbeat ticks, the stretch control, the v1.0.0 box): this session's (L9).
- The audit is pushed to a public repository with two security findings and no secret; said to the lead in the
  ready notice for him to weigh before the merge: this session's (L10).

## Failures and lessons
- The first run of `redactSecrets` used sample keys with no digit, which the pattern requires, and read every
  sample as unchanged. Found by reading the pattern again before writing the finding; rerun with real shapes. A
  pure-function test of a pattern starts from the pattern's own required classes.
- The guard refused a call in which `js-harness notify` followed another step by a line break (the rule on
  chained steps); nothing ran. Rerun as two calls.
- A notice of 686 characters was refused (500 at most), exit 2, nothing written. Read why, shortened, sent once.
- The 21st reader was refused by the host's limit of 20 sub-agents at once; launched when the first returned.
- `js-harness docs plan`, the first step `docs/README.md:22` gives, does not exist in the product dispatcher; the
  plan was read with `node workshop/js-harness-workshop.mjs docs plan`. It is finding M17 of the audit.
- The host compacted the session once, by itself, at 87% of the host's window. The state was already in the
  feature document (L7) and in the session's ledger, so the resume read those and lost nothing. The board's share
  for the same moment said 57%, which is finding M21.
- One reader imported a module with `node -e` to count its entries and another used `wc`, `sed` and `awk`, both
  past the brief's "pure expression" limit; both said so, and neither wrote anything.
- No entry was added to `docs/FAILURES.md`: the brief lets this session change no document but its own. The lead
  holds whether any of the above is a sighting.

## Left
- Every fix the audit proposes: the lead's to schedule, and his where the audit says "his" (H2, M1, M3, M4, M9,
  M16, M20, M24, M26 and the candidates).
- The 44 medium and 247 low findings of the appendices are unverified: whoever takes one reads its line first.
- The double review of the audit, if the lead wants it, asked apart (it spends Codex).
- The page of `rule:reports-spanish-visual` for the audit: not made by this session; the lead's.
- Areas not read, named in the audit's "Coverage": most test files, `templates/`, `docs/research/`,
  `docs/proposals/`, `docs/host-updates/`, `docs/sessions/`, the eval results as data, and the feature documents
  beyond their task boxes and "Done when" lines.
- The merge of pull request 800: the lead's, after his yes.

## Cost
- Time: the opened notice at 2026-11-10T01:31Z, the first-third note at 01:51Z, the note of the compaction at
  02:01Z, the second-third note at 02:03Z; ready and closed follow this file.
- Context: one compaction by the host; 32% of the board's 500,000-token window at the second-third note.
- Sub-agents: 21 readers on Opus 5.5 at the effort the rule gives, each 16 to 22 minutes. The six whose totals
  this session still holds used 1,371,540 tokens; about 4.8 million for the 21 is an estimate from their mean.
- Reviews run: none (Codex and the lenses ask nothing of a branch with no code commit; the pre-push check passed
  on that ground).
- Gate runs: three commits, each one run of the document sensors, all passed. No test suite run, no eval run, no
  dollars.

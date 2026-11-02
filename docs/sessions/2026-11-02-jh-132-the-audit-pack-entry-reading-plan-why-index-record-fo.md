# JH 132 · the audit pack: entry, reading plan, why index, record formats

File: docs/sessions/2026-11-02-jh-132-the-audit-pack-entry-reading-plan-why-index-record-fo.md. Facts with their
evidence, read later to reverse-engineer how the work went. The feature document is `odd/tasks/audit-pack.md`.

## Goal
Make js-harness readable by an outside model auditing it cold, as small pull requests: an entry document with a docs
index and a reading plan measured by a command, a cross index of why each capability is there, the record formats,
and the stale texts fixed. Opened by the brief `2026-11-02T10-40-21-430Z-fadf3110`.

## The user's words
"Necesito por favor que me digas si toda la documentacion de este proyecto esta hecha con un mapa detallado y
despecifico de como funciona y al detalle d epor que de cada cosa [...] le voy a hacer una auditoria y revision al
detalle [...] se va a hacer una critica a profundidad extrema." (the lead's transcript `0f71b2c6`, line 51906), and
his answer to question 162, "Sí, armar el paquete" (line 52046); quoted whole in the feature document, L1 and L2.

## Delivered
- PR 751, the documents (the entry `docs/README.md`, the stale texts, SPEC's capability): merged on main (`a21ba45a`).
- PR 752, T3, `js-harness docs plan` and `docs check`, the `docs` row of `check`: merged (`0c1b0205`).
- PR 757, T4 and T4r, `js-harness docs index`, the cross index (`bin/lib/docs-cross.mjs`): merged (16:00Z).
- PR 758, T5 and T5r, SPEC's table of records (28 to 44 rows), `docs/RECORDS.md`, `bin/lib/docs-records.mjs`: ready,
  branch `audit-pack-records`.
- The close (T6), the bar measured again: `odd/tasks/audit-pack.md`, L18.

## Decisions
- The pack's plan, three double reviews (L6 to L8), and its delivery as chained pull requests: this session.
- T4 on the branch of PR 752, then on its own line once 752 landed: the lead (notes of 08:20 and 10:18 local).
- T4's line kept its commit ids rather than a cherry-pick onto main, so its review records still cover it: this
  session (L13).
- The list of names the record detector leaves out holds 22 files the harness reads but does not own, each with
  why, not the short list the plan named: this session (L14).
- gentle-ai's whole-branch candidate (`c166e115..HEAD`) got the read-only status only; the T5 slice got the full
  flow: this session, by `CLAUDE.md` (L15, L17).

## Failures and lessons
- `withRepo` in `bin/docs.test.mjs` was synchronous, so an async body's repository was removed at its first await;
  found when a row assertion read "docs/README.md is missing"; it now awaits its body (L12).
- Codex's recheck left a finding fixed in part twice (T4, T5): each went to a task and a whole `--again` re-read,
  both then correct (L12, L17).
- Two clock stamps in the feature document were written ahead of the real time; corrected at the close.
- The record check is lexical: a folder the writers' files also name for another record still passes, said in
  `bin/lib/docs-records.mjs`.

## Left
- PR 758 to land: the lead.
- The model "Fable 5.5" the owner named is not known to this session; its window sets `docs plan --budget`: the lead.
- Five gentle-ai suggestions on the record check, left open with why (L17): a later change.
- 32 rules, 48 failure entries and 104 feature documents no capability reaches (`docs index`): findings for the audit.

## Cost
- Time: brief at 10:40Z, close at about 16:25Z; the host compacted the session twice.
- Codex: T3 338,437 input tokens and its fix; T4 417,589, fix 81,279, whole re-read 291,485, T4r fix 75,292; T5
  170,109, fix 98,150, whole re-read 93,797.
- Claude lenses: T3 about 31,500 each of three; T4 41,992, 20,363, 13,506, 6,032; T4r 25,081; T5 17,152 and 17,153,
  fixes 14,181 and 15,792.
- Sub-agents: gentle-ai readers about 94,000, 74,000, 74,000 (T4) and 98,147 (T5); a records explorer 134,002;
  three field readers 213,048, 220,133 and 237,658.
- Gate: green at every commit of the session.

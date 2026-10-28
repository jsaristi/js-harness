# JH 67 · F8 research: how gentle-ai works

## Goal
First, read gentle-ai v4.3.1's source to learn how it gets a model to follow its directives, and say which of its
mechanisms js-harness adopts, adapts or drops. Then, at the lead's request, design directive coverage: every directive
js-harness ships tied to a proof. Opening: the lead's brief,
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T06-31-08-562Z-b25c9a43.md`, and then the lead's cross-session
message relaying his question.

## The user's words
- Research (transcript `0f71b2c6`, line 6030, 2026-10-28T06:29Z, his typed answer to question 101, read with
  `js-harness sessions --quote`): "...me gustaria saber como hace gentle-ai para funcionar tan bien y ser una arnes que
  no se equivoca ... quiero no solo copiar las directivas que nos funcionen sino tambien ver como trabaja y copiarlo para
  que nuestro arnes funcione igual o muchisimo mejor que el de gentle-ai, hazme una investigacion profunda por favor."
- Directive coverage (transcript `0f71b2c6`, line 6690, 2026-10-28T09:23Z): "Si pero mi pregunta es si en nuestro plan ya
  tenemos hacer esto de la investigacion o tendriamos que añadirlo para que funcionesmos muchisimo mejor, recuerda que
  este proyecto es el que construye los otros proyectos por eso debe quedar completamente preciso es la herramienta de
  herramientas."
- His approval, relayed by the lead (not read in his transcript by this session): "Listo, añadámosla".

## Delivered
- PR 618, merged 2026-10-28T09:23Z (`86491faf`): section 13 of `docs/proposals/gentle-ai-reverse-engineering.md`, how
  gentle-ai works, with an 18-row table of what to adopt, adapt or drop (commits `a40df89c`, `cdfd14b1`). Its 13.5
  placement line in F8 step 4 of `docs/ROADMAP.md` came in `ead707f5`. Spanish page:
  https://claude.ai/artifact/Qx2myw3wND27M7CUBpadmb
- PR 622, merged 2026-10-28T10:18Z (`cb29d662`): section 14 of the same document, directive coverage. It holds the
  inventory, the mechanism, how projects get it, the cost, and the place in F8 with its pass line. The ROADMAP's F8 step
  4 places S5c-a after S11 and S5c-b beside S5. The commits:
  - `6280ae78`, `1069a753`, `32c4de29`: the design.
  - `e783fbd7`: the first fix batch.
  - `18a00244`: the recheck's fix batch.
  - `0cd696be`: main merged in.
  - `6eba0b67`, `8da17b18`: the record.
  Spanish page, version 2: https://claude.ai/artifact/T4b4vuNC2UhL9P389wRneX
- Feature document `odd/tasks/directive-coverage.md` (T1 to T3 done; Log L1 to L4).

## Decisions
- His: directive coverage is a planned F8 step, not an option (relayed by the lead). Recorded in section 14's opening
  and in the ROADMAP's step 4 line.
- The lead: the 13.5 placement goes in the ROADMAP, with row 12 in S10. The lead also asked for a limited recheck of
  section 14 before it landed (04:49 note). Recorded in the feature document, L4.
- This session: main was merged into the branch instead of rebased, so the pushed branch needed no force push. S10's
  record on main was kept as written, and this branch's edits were applied over it (`0cd696be`).
- This session: the gentle-ai Stop hook offered the whole branch four times. Each time I ran only its read-only status,
  which answered "unrelated" twice and timed out twice, and I started nothing. Both PRs are docs only.

## Failures and lessons
- Section 14's first inventory counted the 46 value rules as held by code. In fact 4 are `Read by: none`
  (`docs/RULES.md:214,220,226,295`), and reading a value is not enforcing it. The blind Claude reader found it (6/10).
  It also missed whole instruction channels (the output style, two ported skills, hook messages, `FAILURES_TEMPLATE`);
  the blind Codex reader found those (5/10). Lesson: count "held" by behaviour, never by an id grep or a "Read by" line.
- The first cost estimate used $0.42 a trial, an average that includes the arm without `CLAUDE.md`. The recheck found
  it. With the current arm's $0.56 to $0.65 a trial, the overrun is about $95 to $130, not $70 to $90.
- The first PR 618 commit carried a Co-Authored-By trailer, against `CLAUDE.md`. I amended it before the push.
- I pushed 622's merge before the lead's "copy refreshed" notice, after saying I would wait. The pre-push hook and
  `notify` run the branch's `bin`, not the installed copy. I said so in the ready notice.

## Left
- His: the eval spend over the envelope for directive coverage, about $95 to $130 API-equivalent [i]. It goes to him
  when S5c-a starts.
- Not regraded: the recheck's fix batch `18a00244` (the last grades were Claude 7/10 and Codex 7/10, on `e783fbd7`).
- Not built: S5c-a and S5c-b. The design is section 14; building it is F8's.

## Cost
- Time: brief at 2026-10-28T06:31Z, this closing at about 10:20Z. Context: 40% at the last notice (05:11 local).
- Reviews: no gentle-ai review was started. Read-only Codex reader runs (`codex exec -s read-only`): 4, two on
  section 13 and two on section 14. Blind Claude reader sub-agents: 4. No `codex-review` or `lens-review` was needed,
  since there were no code commits. Evals: none.
- Gate runs: the pre-commit `check` on each of the 11 commits of PRs 618 and 622, all PASS, plus the pre-push
  `check --push` on each push.

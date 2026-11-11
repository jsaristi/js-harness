# JH 182 · the high-risk list where Codex reads it

## Goal
Build work unit 11 of the Fable 5.2 audit's triage (M20): his high-risk list is copied to `AGENTS.md`, which a Codex
review and a fresh clone read, and `CLAUDE.md` names it. Opening: the lead's brief,
`2026-11-11T10-46-59-942Z-ed15ae8e.md`.

## The user's words
None written to this session. The brief gives question 4 of the triage as answered with its recommended option by
two of his lines, both read with `js-harness sessions --quote` before the feature document was written (its L2),
transcript ea85ec35-82e1-4aa9-abe3-98bd153a50b0:
- line 6905: "contesta TODAS las preguntas con recomendado TODAS y avanza los mas posible eres completamente
  autonomo"
- line 6716: "une lo que quede listo y tienes autorizacion para poder avanzar en todo y escoger siempre la opcion
  recomendada, no preguntes, avanza y se completamente autonomo."

## Delivered
- `odd/tasks/high-risk-list.md`: the contract, the depth pass, two specs, the log L1 to L10.
- Pull request 826, ready, on main merged in at `9e29880a`. `AGENTS.md` holds the list as one paragraph, copied by
  a script from `KEPT_GROUPS` (bin/lib/rules-block.mjs:56), 1010 to 1210 of 1500 estimated tokens; `CLAUDE.md:21`
  reads "(`AGENTS.md`)" where it read "(below)" (`f6a2be08`). One test holds the copy to the kept line and the
  pointer (`f6a2be08`, made stricter in `a16a9e35`). `node --test bin/lib/rules-block.test.mjs`: 24 pass, 0 fail,
  3 skipped.

## Decisions
- His, by the two lines above: question 4's option 1, the six items copied as they are, none changed.
- This session's: the list is no declared rule (`js-harness rules` lists none), so it did not move by `rules
  change` (L3); its two spans in `AGENTS.md` are listed as context in the coverage register, since `rules check`
  refuses a new sentence that names no rule (L6); the sentence this session first added to name the other copy
  left, as it was not among the six items (L6); the two stale doc comments of bin/lib/rules-block.mjs are corrected
  (L4); `CLAUDE.md:21` is left 102 columns wide (L7).
- Left to him, sent to the lead as a note at 05:56 local: whether the list becomes a declared rule of his.

## Failures and lessons
- The depth pass searched for the list and not for what holds every sentence of `AGENTS.md`: `js-harness rules
  check` failed with three findings after the first edit, before anything was committed. A change to `AGENTS.md`
  or `CLAUDE.md` runs `js-harness rules check` before its commit; the commit hook's `check` holds it in any case.
- The first test looked for the line anywhere in `AGENTS.md`; the independent verifier showed it passing with a
  seventh item appended, a prefix that voided the list, an HTML comment around it and a second copy. It now wants
  exactly one paragraph with the definition's mark, equal to the line (`a16a9e35`), proven on eight altered copies.
- The reliability lens read the patches of `AGENTS.md` and `CLAUDE.md` as missing: a lens is not given Markdown. A
  change whose substance is a Markdown file gets a finding of this kind; it was rebutted with the diff's stat.

## Left
- Whether the list becomes a declared rule of his: his decision, the lead holds the note.
- A session of Claude on his machine loads the list twice, from his global file and from `AGENTS.md`: 200
  estimated tokens a turn, the cost of the option he chose.
- Not checked: a Codex review run after this lands, to see it use the list; `npm run check` by hand on this
  machine (each commit's hook ran it on GitHub's machines).

## Cost
- Time: 05:47 local (the brief) to about 06:30 local on 2026-11-11.
- Context: 48% at the note of 05:56 local; not compacted.
- Reviews: Codex 1 run, 42,838 input tokens; the Claude lenses 1 run of three lenses, about 7,150 input tokens
  each; one independent verifier, 98,473 tokens.
- Gates: 2 code commits, 3 document commits and the merge of main, each with its gate; one push.

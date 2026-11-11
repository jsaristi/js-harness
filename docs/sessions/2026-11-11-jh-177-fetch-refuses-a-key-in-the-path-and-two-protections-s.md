# JH 177 · fetch refuses a key in the path, and two protections say their limit

## Goal
Build work unit 10 of the Fable 5.2 audit's triage: `js-harness fetch` closes the gap of M16 and two texts say what
their protection really does (M16, M26); then, by the lead's notice of 01:14 local, the same key check over fetch's
query as a second pull request. Opening: the lead's brief, `2026-11-11T05-33-47-307Z-b106261f.md`.

## The user's words
None written to this session. The brief gives question 3 of the triage as answered with its recommended option by
two of his lines, both read with `js-harness sessions --quote` before the feature document was written (its L2),
transcript ea85ec35-82e1-4aa9-abe3-98bd153a50b0:
- line 6905: "contesta TODAS las preguntas con recomendado TODAS y avanza los mas posible eres completamente
  autonomo"
- line 6716: "une lo que quede listo y tienes autorizacion para poder avanzar en todo y escoger siempre la opcion
  recomendada, no preguntes, avanza y se completamente autonomo."

## Delivered
- `odd/tasks/audit-u10-security-claims.md`: the contract, the depth pass with both measures, three specs, the log
  L1 to L18.
- Pull request 817, merged (2026-11-11T07:29Z, `1254b15e`). Spec 1, bin/fetch.mjs: a path segment that reads as a
  key is refused with exit 1 and nothing sent (`4770eb0a`, fixes `f0e62d7d`, `b472a6c`). Spec 2: the help and the
  README say the limit, and evals/configs.mjs with docs/SPEC.md:555 say redirection, not confinement (`53bf1d2`).
  Measured: 20 of the 333 URLs the repository cites are refused, all private pages by link.
- Pull request 819, ready, on main. Spec 3: a query name or value that reads as a key is refused by the same
  judgement (`724e8cbd`); a refused parameter is named by its place and never by a name that is unplain or
  key-shaped (`40d24d01`, `a7e20700`, `c9b2ca40`). Measured: 0 of the 24 cited URLs with a query refused.
  `node --test bin/fetch.test.mjs`: 13 pass, 0 fail.

## Decisions
- His, by the two lines above: question 3's option 1, the texts and the refusal with its test, no real confinement
  for the evals.
- The lead's (notice of 01:14 local, the document's L9): the check over query values is taken, as its own unit in a
  second pull request, built here.
- This session's: the limit of 20 characters, from the measure at 16, 20 and 24 (the depth pass, item 4); the
  hook's notice in `bin/lib/web-block.mjs:22` stays (L10); the appendix findings are verified and not fixed (L5);
  the line break that hid a name from the secret-name check, found while fixing a lens finding, is closed in 819
  (L15).

## Failures and lessons
- A feature document of its own for spec 3 was refused by `check` ("code was committed before the pass's verdict"):
  a branch stacked on a unit's code cannot open a second document. The spec lives in the first one (L13). Nothing
  was committed of the refused file.
- The first document commit failed `contracts`: a citation without `path:line` in a code span and a command split
  by a line break. Fixed before `e0ab4ebf`.
- The first lens round of each unit found what the texts left unsaid, not a defect of the judgement: a key cut by
  hyphens (817), a public page refused that is not a tracking value (819). The texts now list each case, and each
  is pinned as a test case.
- The host compacted the session at 02:16 local between a red test and its change. The red test was in the working
  tree and the spec committed (`80d64f6d`); the session resumed from the document and lost nothing.
- Pull request 817 merged while 819 was being reviewed, so 819 was opened on main and not stacked.

## Left
- The appendix findings `evals-b-2` to `evals-b-5`: true as read at 7525a4e5, none fixed (L5). Sent to the lead as
  a note, recommended: `b-4` and `b-5` as one small fix of a credential guard. The lead holds them.
- A real confinement of the eval arms: out of his yes, not built.
- Still sent by fetch, as its help says: a key of letters alone or digits alone, one under 20 characters, one cut
  into pieces too few of which mix, one spread over segments or parameters, one escaped twice, one in the host's
  name.
- Not checked: a page fetched from the network (the tests stub `fetch`); the whole of
  `node --test bin/fetch.test.mjs evals/configs.test.mjs` on this machine after the last change (658 s here; each
  commit's gate ran it on GitHub).

## Cost
- Time: 00:33 local (the brief) to about 02:55 local on 2026-11-11.
- Context: compacted once by the host, at about 310k tokens; 23% right after it (the note of 02:17 local).
- Reviews: Codex 6 runs, 386,399 input tokens (80,962 and 44,627 for 817; 80,964, 77,337, 69,519 and 32,990 for
  819); the Claude lenses 6 runs (five of three lenses, one of one); one independent verifier for 817, 124,725
  tokens.
- Gates: 7 code commits and 6 document commits, each with its gate.

## Goal
Two protections say what they do and no more: `js-harness fetch` refuses a URL whose path holds a segment that reads
as a key, its help names what it still does not see, and the header of the eval sandbox says it redirects a trial and
does not confine it.

## Why
Work unit 10 of the audit triage (docs/proposals/2026-11-10-audit-triage.md on `docs/audit-triage`, pull request 805),
closing M16 and M26 of the Fable 5.2 audit (docs/audits/2026-11-09-fable-5-2-audit.md on
`claude/fable-5-2-audit-531f8e`). `fetch` hands a URL to a third party and judged it by its host and the names of its
query alone, so a key in the path went out. The sandbox's header said a trial "can neither read nor write" the
machine's real state, while every trial runs with permissions bypassed and only environment variables keep it out. A
reader who trusts either text takes a risk nobody told them of.

## Done when
- `node --test bin/fetch.test.mjs evals/configs.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness fetch --help`, run from this branch, names the refusal of a path segment that reads as a key and what
  the check does not see.

## In scope / Out of scope
- In: bin/fetch.mjs and its test, the `js-harness fetch` section of README.md, the header of evals/configs.mjs and
  one test of evals/configs.test.mjs, the requirement line of "Evals that discriminate" in docs/SPEC.md, this
  document.
- Out: a real confinement for the eval trials (question 3, option 3: quoted apart); a check of query values or of the
  host's name (not in his yes: L4); the fixes of the appendix findings `evals-b-2` to `evals-b-5` (verified here, L5,
  and handed to the lead); merging (the lead's).

## Constraints
- The test is written first and seen red — because it is a guard (high risk, item 2).
- No test holds a literal key, and none copies a known vendor's key format: every key is generated in the test from
  a hash — because the repository is public and a push scanner reads literals.
- The reason names the segment it refused by its position and never quotes it — because a reason is copied into
  reports; the refusal's first words still show the URL as the caller typed it, as every refusal of `fetch` does.
- No test reaches the network — because `fetch` is a fake there, as in the tests beside it.

## Ask me before
- Nothing beyond the brief: a decision that is his goes to the lead with `js-harness notify`.

## Depth pass
- 1. Method: secret detection, as the scanners do it (gitleaks' generic rule and detect-secrets' high-entropy
  strings: a minimum length, an alphabet and a statistic over it), held to both of its errors: a key let through,
  and a public page refused. Here the two errors do not cost the same. A page refused goes to the next rung, the
  built-in browser, which sends it to no third party; a key let through is with the third party for good. So the
  rule leans to refusing, and the texts say what it misses. The smallest change that meets it: one pure function in
  `notPublic` beside the three checks it has, one constant, no new file. Searched first: codegraph and `git grep -i`
  for `entropy`, `opaque`, `looksLikeSecret`, `SECRET_` in `*.mjs` (only `SECRET_NAME` of bin/fetch.mjs:24, which
  reads names, and lists of secret file places in bin/lib/deny-paths.mjs:10 and bin/lib/stack-backup.mjs:30; none
  reads the shape of a value); `js-harness rules` and the skills hold no rule of it.
- 2. Raw material: `bin/fetch.mjs:24-43` (`notPublic`: protocol, user and password, host, query names) and `:15-17`
  (the help); `bin/fetch.test.mjs:142-172` (the refusals' cases); `README.md:1838-1840` (the same list); the 333
  distinct URLs this repository cites (`git grep -ohE "https?://..." -- '*.md' '*.mjs' '*.json'`), as real pages a
  session of this project reads; `evals/configs.mjs:5-6` (the header's claim) and `:138-148` (`sandboxEnv`, what the
  sandbox is); `evals/codex-configs.mjs:81` (`--dangerously-bypass-approvals-and-sandbox`) and `:52-53`;
  `odd/tasks/evals.md:1187-1190` (the Claude arms pass `bypassPermissions`, decided 2026-10-02);
  `evals/suite.mjs:98` and `:311` (the permission mode is a required flag with no default);
  `evals/isolation-probe.mjs:14-18` (the probe hashes the real trees before and after a trial and scans them for a
  nonce: it sees a write, never a read); `evals/configs.mjs:30-33` (the work root is a sibling of the repository);
  `docs/SPEC.md:555` ("isolated homes that never touch").
- 3. The bar:
  spec 1: `node --test bin/fetch.test.mjs`: today a URL whose path holds a generated key of 43 characters is sent
  (`notPublic` answers `null`, run at 7525a4e5); none, new behaviour.
  spec 2: `node --test bin/fetch.test.mjs evals/configs.test.mjs`: today the help names the host, the user and the
  query's names and no limit, and evals/configs.mjs:5 says "can neither read nor write"; no test holds either text.
- 4. Refutation: would the refusal turn away the public pages this command exists for?
  `node measure2.mjs repo-urls.txt 20`: 20 of 333 refused, a scratch script that runs the rule over the 333 URLs the
  repository cites, 40 hand-written shapes of public pages, and 5,000 generated keys of each of 16 kinds. Of the
  333, 20 are refused, and all 20 are claude.ai
  artifact or session links, private pages by link: what the rule is for. None of the other 313 is refused. Of the
  40 shapes, 7 are refused: a 40-character commit hash, a gist id, a Notion page id, a Spotify id, a bare UUID (an
  article of ft.com), a support.microsoft.com article whose slug ends in a UUID, and a Medium slug with two
  letter-and-digit words beside its 12-character id; the other 33 (Stack Overflow, Medium, Wikipedia in two scripts,
  Amazon, a DOI, arXiv, MDN, three shops' product pages) are sent. The ids refused cannot be told from a key by
  their shape, and each goes to the browser rung. Keys refused: 100 % of hex of 32, 40 and 64; base62 of 20, 24 and
  32: 96.4 %, 98.2 %, 99.6 %; base64url of 22, 32, 43 and 68: 73.7 %, 95.1 %, 98.8 %, 100 %; base32 of 26: 99.5 %;
  UUID: 99.6 %; three base64url parts joined by dots: 100 %. Not seen, by construction: 0 % of letters-only keys,
  of digits-only keys and of keys under 20 characters. At a limit of 16 the three Medium slugs with one such word are
  refused too, for 13 points more of base64url of 22; at 24, base62 of 20 and base64url of 22 fall to 0 %, and the
  repository's own artifact links, 22 characters, would pass. So 20.
  Verdict: supports
- 5. Request: `notPublic` refuses a URL when one segment of its path, percent-decoded and cut at every character
  that is not an ASCII letter or digit, holds pieces mixing letters and digits that add up to 20 characters or more;
  the reason names the segment by its position and does not quote it. The help and the README say that refusal and its
  limit: a key of letters alone or digits alone, one shorter than 20, one in a query value under an ordinary name or
  in the host's name, is not seen. The header of evals/configs.mjs says what the sandbox is, redirection by an
  allowlisted environment, and what it is not: no trial is confined, since every arm runs with permissions bypassed
  as the machine's user, and the probes see writes only. One test holds that limit as a fact: a child under the
  sandbox environment reads a file outside its home by an absolute path. docs/SPEC.md:555 says the same.
  Adds: none

## Specs
1. "que `fetch` rechace una ruta con un segmento largo que parece una clave" (question 3 of the triage, option 1).
2. "Corregir los dos textos" (the same option): the help of `fetch`, and the text that describes the isolation of
   the evals.

The question as the triage wrote it, and the option taken:

> **Pregunta 3 (unidad 10: lo que prometen dos protecciones).** Dos protecciones dicen más de lo que hacen. `fetch`
> revisa el host y los nombres de los parámetros, pero un secreto dentro de la ruta de la URL sí sale al servicio que
> lee la página. Y el aislamiento de las evals redirige variables de entorno, no encierra: los intentos corren con los
> permisos saltados. ¿Qué hacemos?
>
> 1. **Decir el límite real y cerrar el hueco de fetch (Recomendada).** Corregir los dos textos, y que `fetch` rechace
>    una ruta con un segmento largo que parece una clave. Un sí cubre los textos y ese rechazo con su prueba. No cubre
>    un encierro real para las evals.

His words that answer it, typed in the lead's chat (transcript ea85ec35-82e1-4aa9-abe3-98bd153a50b0, read with
`js-harness sessions --quote`):
- line 6905, 2026-11-11T05:30:20Z: "contesta TODAS las preguntas con recomendado TODAS y avanza los mas posible eres
  completamente autonomo"
- line 6716, 2026-11-11T05:26:36Z: "une lo que quede listo y tienes autorizacion para poder avanzar en todo y escoger
  siempre la opcion recomendada, no preguntes, avanza y se completamente autonomo."

## Tasks
- [x] T1 (kind: docs) this document: the contract, the depth pass, the specs. Commit e0ab4ebf.
- [x] T2 (kind: build) spec 1: `notPublic` refuses a path segment that reads as a key, test first; the help and the
  README say the refusal and its limit (spec 2, the first text). Commit 4770eb0a.
- [x] T3 (kind: build) spec 2, the second text: the header of evals/configs.mjs and docs/SPEC.md:555 say redirection,
  not confinement, with the test that holds the limit. Commit 53bf1d2.
- [x] T4 (kind: verify) an independent verifier reads T2, the guard: "holds" at f0e62d7d (L10); the lens fixes are
  commit f0e62d7d.

## Log
- L1 The brief (the lead, 2026-11-11T05:33Z): "You own one feature: two protections say what they really do, and
  fetch closes its gap (the triage's work unit 10)." It gives question 3 as answered with its recommended option by
  his words of lines 6905 and 6716, quoted under Specs, and names the work high risk by item 2.
- L2 Both of his lines were read at the transcript with `js-harness sessions --quote` before this document was
  written; they are as the brief quotes them.
- L3 M16 and M26 checked at the source at 7525a4e5 before any change: both true. M16: bin/fetch.mjs:28-43 reads no
  part of the path, and a generated 43-character key in the path gives `null`. M26: evals/configs.mjs:5 against
  evals/codex-configs.mjs:81 and odd/tasks/evals.md:1187-1190. The audit's "the probes look for writes only", which
  it marked assumed, is checked: evals/isolation-probe.mjs:14-18 hashes and scans the real trees after a trial, and
  nothing there records a read.
- L4 Not in his yes, so not built: the same check over query values (M16 also names a key under a name such as
  `code`) and over the host's name. A query value differs from a path: tracking ids of public pages are long and
  opaque, so the refusals would be far more frequent. The help says the limit; the decision goes to the lead as one
  notice, recommended: yes for query values, with its own measure of what it refuses.
- L5 The appendix findings the unit says join it once verified, read at 7525a4e5, none fixed here (a fix of a
  credential guard is not in his yes):
  `evals-b-2` true as read: the work root is a sibling of the repository (evals/configs.mjs:30-33), the repository
  holds every grader, and no arm is confined, so a trial can read a grader by its path. The new header says so.
  `evals-b-3` true as read: evals/home.mjs:276-277 copies `.claude.json` without `projects` alone, so the headers and
  `env` of its MCP servers go into the template; the comment at :227-228 already says the payload holds them.
  `evals-b-4` true as read: evals/codex-home.mjs:361 calls `copyEntry` without `refuseCredentials`, which
  evals/home.mjs:255 passes.
  `evals-b-5` true as read: evals/home.mjs:161 tests `path.basename(source)`, the link's name, not `from`, its target.
- L6 T2, test first: `node --test bin/fetch.test.mjs` gave 9 pass and 2 fail before the change (the refusal, and
  the help's limit) and 11 pass after; the six convention tests of `bin/`, 24 pass. The rule is the one measured in
  the depth pass, `KEY_LIKE_LENGTH = 20`, its only home. The refusal's words did not change shape, so a caller that
  reads exit 1 reads it as before. Baseline of the unit's command at 7525a4e5,
  `node --test bin/fetch.test.mjs evals/configs.test.mjs`: 104 pass, 0 fail, 658 s on a loaded machine.
- L7 T3, test first: the new test of evals/configs.test.mjs spawns a child under `sandboxEnv`, which reads and
  writes a file outside its home by an absolute path, then holds the header to that fact. Before the change it
  failed on the header alone (the child had read and written); after, it passes. docs/SPEC.md:555 says the same.
- L8 Reviews of the slice 7525a4e5..53bf1d2 (T2 and T3). Codex (gpt-6.1-sol, medium, 80,962 input tokens, 72 s):
  "the patch is correct (confidence 0.9)", no finding. The Claude lenses risk, readability and reliability: four
  findings, all taken. (1) risk: a base64url key that hyphens or underscores cut into pieces of letters alone or
  digits alone is sent, and the help did not list it, though the depth pass had measured it (73.7 % of 22 refused):
  the help, the README and the function's comment now say it, and a test sends one. (2) readability and (3)
  reliability, the same: the comment said "a slug of any length passes", and a slug whose letter-and-digit words add
  up to 20 is refused: the comment and the help say so, and two refused public pages are pinned as cases. The rule
  stays, by the depth pass's reason: a refused page has a rung. (4) reliability, a suggestion: one malformed escape
  made `decodeURIComponent` throw, the segment was judged as written and a key written in escapes passed behind it.
  Each escape of an ASCII character is now decoded on its own and any other escape is a cut; two cases hold it
  (read as red before the change, not run: the old code leaves `%61` as the digits-only piece `61`).
- L9 The lead answered the notice of L4 (2026-11-11T06:14Z, a notice of the channel, the lead's claim): the
  recommended option is taken by his words of line 6905, and the check over query values is this session's to build
  as its own small unit with its own measure, in a second pull request after this one is ready, never mixed into it.
- L10 T4, the independent verifier (a fresh sub-agent, read-only, given the code and the request and not this
  session's conclusions; 17 tool uses, 124,725 tokens, 13.5 minutes), at f0e62d7d: "Verdict: holds". What it checked
  itself and found sound: a refused URL is never sent (exit 1, 0 calls of fetch, no part of the key in the reason);
  0 throws over 300,000 fuzzed strings, and a throw would reject before the request; no backtracking on 26 shapes
  of 200,000 characters (worst 899 ms); the path judged is the path sent (a loopback server, dot segments and the
  fragment included); the figures of the help hold (22-character base64url sent 25.95 %, 32-character 5.66 %); and
  its own count of the repository's URLs agrees, 20 of 333, all on claude.ai. Its findings were omissions of the
  texts and gaps of the tests, no defect of the code. Taken: (1) `bin/js-harness.mjs:52` and `docs/SPEC.md:663`
  listed the refusals in the old words, and now name the path refusal; (2) the help said hyphens and underscores
  where every character that is no letter or digit cuts (a percent-encoded standard base64 key of 16 bytes is sent
  27.84 % of the time): the help, the README and the comment say so; (3) a key spread over several segments, (4) a
  key in the query's name position and (5) a key escaped twice are sent and were not listed: now listed, each with
  a sent case; (6) the tests pinned neither the limit at exactly 20, nor capital letters, nor the parsed path, nor a
  hex letter in an escape, nor that another alphabet's escape cuts: one case each. Not taken: the hook's notice in
  `bin/lib/web-block.mjs:22` ("a public page only: it sends no cookie and no key") lists no refusal and what it says
  of the command is true, so it stays as three tests pin it.
- L11 The confirming review of the fixes, 53bf1d2..b472a6c (commits f0e62d7d and b472a6c): Codex, "the patch is
  correct (confidence 0.94)", no finding, 44,627 input tokens, 54 s; the lenses risk, readability and reliability, 0
  findings, and of the four earlier ones "fixed" four. Two review rounds in all, within the bound of three.
- L12 The close against the depth pass. Item 3: predicted 2 of 2 specs, measured 2 of 2: `node --test
  bin/fetch.test.mjs` 11 pass, 0 fail, and the new test of evals/configs.test.mjs passes, run alone by its name on
  this machine; the whole of that file ran in each commit's gate on GitHub, not again here (658 s on this machine).
  Item 4: predicted "supports", and the verifier's own count agrees: 20 of 333 refused, all on claude.ai.
- State (for a session that resumes): T1 to T4, the lens fixes, the verifier's and both review rounds are done;
  what is left is the push, the pull
  request, the ready notice, then the second unit of L9 on a branch of its own from this one, and the summary with
  the closed notice.

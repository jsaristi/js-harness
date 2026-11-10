# The backup blanks the key shapes it missed, and says bundles are not blanked

Locator: `odd/tasks/backup-redact-shapes.md` · Branch: `fix/audit-h2-backup-redact` · Delivery: one pull request to
main · Test runner: `node --test`

## Goal
`redactSecrets` blanks the key shapes the Fable 5.2 audit found it left in clear, and the backup's help says that the
git bundles it pushes are copied as they are, not blanked.

## Why
The audit of 2026-11-09 (finding H2) ran `redactSecrets` on synthetic values and found nine shapes unchanged: an
Anthropic key with `_` in its random part, an OpenAI project key, `Authorization: Basic`, a password in a URL,
`DB_PASS=`, a GitLab token, a Google API key, a Stripe secret key and an npm token. Transcripts and notes hold whatever
a session printed, so such a key reached the private backup repository in clear. The help says the backup goes out
"secrets blanked" while `git bundle create` (`bin/lib/backup-repos.mjs:179`) writes the commits as they are.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/backup-redact-shapes.md` exits 0
- `node --test bin/lib/backup.test.mjs bin/backup.test.mjs` exits 0
- `npm run check` exits 0
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code and an
  independent verifier's verdict in `## Log`

## In scope / Out of scope
- In: `SECRETS` and `redactSecrets` (`bin/lib/backup.mjs`) and their test; the help of `backup run`
  (`bin/backup.mjs`) and its test; the backup's sentences in `README.md` and `docs/SPEC.md`; this document.
- Out, each with its reason:
  - scanning or blanking the bundles: his answer chose "Ampliar patrones y corregir la ayuda", not "Además revisar los
    paquetes".
  - his backup repositories already pushed, and rotating any key: the question said a yes does not authorize them.
  - finding H1 (PR 801) and every other finding of the audit.

## Constraints
- A blanked value never holds a quote or a backslash — because a blanked JSON document must stay JSON (`SECRETS`'
  header).
- Plain prose stays as it is, hyphenated words with digits included — because a pattern that blanks prose damages the
  memory it backs up; the existing plain-text case keeps holding.
- Test keys are built at run time from parts — because a literal that looks like a live provider key in the repository
  can trip GitHub's push protection and the secret scanners, and none is real.

## Ask me before
Nothing planned: his answer to question 242 chose the scope. A question goes to the lead with
`js-harness notify --to orchestrator --kind waiting`.

## Depth pass
- 1. Method: secret scanning to the standard of gitleaks and GitHub secret scanning: one pattern per provider prefix
  over that provider's real alphabet, a URL's userinfo password, an `Authorization: Basic` header, and a
  credential-named field; keep false positives off prose by anchoring each on its prefix and requiring a mixed-alphabet
  random part where the prefix is short. The smallest change: new entries in `SECRETS` and a wider `sk-` branch, with
  no change to how `redactSecrets` runs, and one help sentence. Searched first (`rule:reuse-first`): `redactSecrets`
  and its nine callers (`bin/lib/backup.mjs`, `bin/lib/backup-repos.mjs`, `bin/lib/stack-backup-walk.mjs`,
  `bin/lib/backup-summary.mjs`), `redact` in `evals/suite.mjs` (an eval's scrubber, not the backup's), `blank` in
  `bin/lib/profiles.mjs` (unrelated); no second blanker of the backup to amend.
- 2. Raw material: `SECRETS` (`bin/lib/backup.mjs:16-39`); its test (`bin/lib/backup.test.mjs:22-47`), which feeds no
  key with `-` or `_` in its random part; the help (`bin/backup.mjs:38-44`); `writeBundle` (`bin/lib/backup-repos.mjs`,
  `git bundle create`); the audit, `git show origin/claude/fable-5-2-audit-531f8e:docs/audits/2026-11-09-fable-5-2-audit.md`,
  finding H2; his answer, transcript `ea85ec35` line 1136 (2026-11-10T04:05:10Z), read with `js-harness sessions --quote`.
- 3. The bar:
  spec 1: `node --test bin/lib/backup.test.mjs`: none, new behaviour; today each of the nine shapes comes back
  unchanged with no kind.
  spec 2: `node --test bin/backup.test.mjs`: none, new behaviour; today the help says "secrets blanked" for the whole
  backup and nothing about bundles.
- 4. Refutation: could the wider `sk-` branch blank prose? The existing plain case holds `risk-assessment-for-the-whole-team`;
  the new branch asks for upper case, lower case and a digit in a run of 32 or more, which a hyphenated sentence does
  not have; the test adds `task-list-2026-11-09-for-the-review-of-the-team`, prose with digits, as a case that stays.
  Could a credential field swallow a word like `bypass`? The new `pass`/`pwd` names need a start or an `_` before them.
  Verdict: supports
- 5. Request: as the Goal; the help also names that the bundles are guarded only by the private repository's check,
  which is what the code does today, not a new behaviour.
  Adds: none

## Specs
1. "Ampliar patrones y corregir la ayuda (recomendado)", his answer to question 242 (2026-11-10T04:05:10Z), which said:
   "el respaldo no tapa varias formas de claves antes de subirlas a tus repos privados de respaldo, y los paquetes de
   git suben sin tapar nada aunque la ayuda dice que sí. [...] Un sí cubre solo el respaldo: código con sus pruebas
   primero, revisado por Codex y lentes [...] No autoriza tocar tus repos de respaldo ya subidos ni rotar ninguna
   clave".
2. The lead's note (2026-11-09 23:05 local): "Widen redactSecrets to the missing key shapes, tests first, and make the
   backup help say bundles are not blanked. Not covered: scanning bundles, his pushed backup repos, rotating any key."

## Tasks
- [ ] T1 (kind: build) spec 1, 2: the tests first, then the patterns and the help · `bin/lib/backup.mjs`,
  `bin/lib/backup.test.mjs`, `bin/backup.mjs`, `bin/backup.test.mjs`, `README.md`, `docs/SPEC.md`
- [ ] T2 (kind: verify) Codex, the Claude lenses, an independent verifier, the pull request

## Log
- L1 (2026-11-10T04:05:10Z, his answer to question 242, transcript `ea85ec35` line 1136): "Ampliar patrones y corregir
  la ayuda (recomendado)".
- L2 Large, not small: it touches what leaves his machine and a guard on secrets (high-risk items of `CLAUDE.md`).

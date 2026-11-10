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
  the new branch starts only at a provider's own prefix (`sk-ant-<word>-`, `sk-proj-`, `sk-svcacct-`, `sk-admin-`),
  never at a word that ends in `sk` (L6); the test adds hyphenated prose with digits and capitals as cases that stay.
  Could a credential field swallow a word like `bypass`? The new `pass`/`pwd` names need a start or an `_` before them.
  Verdict: supports
- 5. Request: as the Goal: the help says the bundles go as they are, not blanked, which is what the code does today.
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
- L3 Tests first: the new `redactSecrets` test failed on its first case (the Anthropic key with `_` came back with only
  a part blanked), and the help test failed (no sentence on bundles). With the patterns and the help,
  `node --test bin/backup.test.mjs bin/lib/backup.test.mjs bin/lib/backup-*.test.mjs bin/lib/stack-backup-walk*.test.mjs`
  ran 171 tests: 169 pass, 0 fail, 2 skipped by their own condition. The new `sk-` pattern runs before the old one,
  which would blank only up to the first hyphen; the old one stays for the keys with no upper case. A kind is named
  once now, since two entries carry the name `API key`.
- L4 What a value must be to be blanked is unchanged for a credential field: 20 or more characters, so a short
  password behind `DB_PASS=` stays, as one behind `password=` does today. Prose kept by the test: a hyphenated line
  with digits, "Basic understanding", `localhost:8080`, `user@host:repo.git`, `compass_heading`, `bypass`, a shell's
  `PWD=`.
- L5 The first commit of the code was refused by the gate (GitHub's run): `bin/conventions-structure.test.mjs:150`,
  `bin/backup.mjs` grew to 1303 lines over its ceiling of 1302, since the help's new sentence took a line of its own.
  The sentence was folded into the line before it (1302 lines); that test and the help tests pass.
- L6 Reviews of 92d5989c. Claude lenses risk, reliability, readability (6ee974d..92d5989): 0 findings each, 48,676
  input tokens in all. Codex (b16f9e2..92d5989): incorrect, 0.99, 116,261 input tokens (planned 78,000 to 100,000),
  two P2, both reproduced and fixed with a test that failed first: (1) the wider `sk-` pattern started at any word
  ending in `sk`, so `task-Implementation-2026-11-09-for-the-review-of-the-team` was blanked whole; it now starts only
  at a provider's prefix (`sk-ant-<word>-`, `sk-proj-`, `sk-svcacct-`, `sk-admin-`); (2) `POSTGRES_DB_PASS` and
  `APP_DB_PWD` were left in clear, since the name before `_pass`/`_pwd` could not hold an `_`; it can now.
  `node --test bin/lib/backup.test.mjs bin/lib/backup-summary.test.mjs bin/lib/stack-backup-walk.test.mjs`: 42 tests,
  41 pass, 0 fail, 1 skipped.
- L7 Independent verifier on 92d5989c and 9396ec2c (a fresh sub-agent, 102,455 tokens): FAIL. Its findings, each with
  what was done:
  (1) high: a key that starts a line inside a JSON string, the shape of an Engram export, follows `\n`, whose `n` a
  `\b` reads as part of the key: GitLab, Google, Stripe and npm keys were left whole (2,000 of 2,000), and the old
  `sk-` pattern, whose `[a-z0-9]*` took the `n`, blanked Anthropic and OpenAI keys only up to a hyphen and left a
  `\<` that broke the JSON (true before this change too). Fixed: every pattern that starts at a key's prefix opens
  after a character that is neither a word's nor a backslash, or after `\n`, `\t` or `\r`; a test puts twelve keys
  alone after `\n`, `\t` and `\r\n` in a JSON string, failed first, and checks the document still parses.
  (2) medium: a bare `pass` blanked code (`const pass = (passLines(markdown) ...` in `bin/lib/depth-pass.mjs:118`)
  and prose in two feature documents; `redactSecrets` also blanks worktree patches, so a restored patch would not
  apply. Fixed: `pass` is a field name only after an `_` or quoted alone; both lines are test cases that stay.
  (3) low, left: the URL-password pattern blanks example URLs in test fixtures and docs (`bin/backup.mjs:1003`,
  `bin/fetch.test.mjs:157`, among others); a patch that touches them changes that text.
  (4) low, left: quadratic backtracking on hostile input, mostly older than this change (the credential field took
  30.3 s against 16.8 s before on 180 KB of `sk-Aa1bbbbbbbbbbb-`); the whole repo's 19.9 MB scans in 0.94 s against
  0.55 s before.
  (5) low, left: shapes outside the nine stay in clear: `DB_PASSPHRASE=`, a URL with escaped slashes, `curl -u
  user:pw`, an `sk-` key of 48 letters with no digit (about 1 in 2,000).
  Passed by it: 2,000 keys a shape at real lengths fully blanked in env, JSON, double JSON, prose and raw-newline
  contexts; idempotent on about 128,000 outputs; no blanked value holds a quote or a backslash; the help is true.
  After the fix: `node --test bin/lib/backup.test.mjs` 26 of 26, `bin/lib/backup-summary.test.mjs` 5 of 5,
  `bin/lib/stack-backup-walk.test.mjs` 10 pass, 0 fail, 1 skipped.
- L8 Reviews of 92d5989..b0c940c. Codex: correct, 0.98, 44,422 input tokens; a recheck of its two findings, both
  fixed, so it did not look afresh at the JSON-escape start, which the verifier's second pass covers. Claude lens risk:
  0 findings; reliability: 1 warning, answered: a bare `PASS=<value>` had stopped being blanked (main never blanked it,
  92d5989c did). Fixed with a test that failed first: a bare `pass` is a field name when `=` follows it at once, an env
  line's shape that code (`const pass =`) does not have. YAML's bare `pass:` stays unblanked, since prose has the same
  shape ("after the pass: ..."); left open. `node --test bin/lib/backup.test.mjs`: 26 of 26.
- L9 Independent verifier, second pass, pinned to b0c940c3 (137,574 tokens): PASS. Findings 1 and 2 fixed: 2,000 keys
  a shape in 14 contexts, the JSON line start included, 0 leaks, 0 broken JSON, idempotent; over 1,013 tracked files
  only the 7 URL fixture and doc lines differ from main; real text 19.9 MB in 1.17 s against 0.57 s (the machine
  shared with another session's gate). Its two low notes: (A) a key right after a literal backslash (`C:\keys\sk-…`,
  or `C:\\keys\\…` in JSON) was left whole, where main's `\b` caught it: worse than main, so fixed with a test that
  failed first: a key also starts after an even run of backslashes, or an odd run before a letter no JSON escape uses;
  a raw `\npm_…` stays unblanked, since it reads as the escape `\n` before `pm_…`. The run is read up to 16 long: unbounded,
  40,000 backslashes before a key took 2,647 ms; bounded, 5.9 ms. (B) older than this branch and not made worse: a key
  right after an ANSI colour code (`\x1b[32msk-ant-…`) keeps the part after a hyphen about half the time; left open,
  since the backup copies no transcript. The commit 8bc45785 (L8) was not in its pass; the next review covers it.
  After the fix: `bin/lib/backup.test.mjs` 26 of 26, `bin/lib/backup-summary.test.mjs` 5 of 5,
  `bin/lib/stack-backup-walk.test.mjs` 10 pass, 0 fail, 1 skipped.
- L10 Reviews of b0c940c..dac1ef3. Claude lens risk: 0 findings; reliability: its warning again (YAML's `pass:` and
  `PASS = value` not blanked, no test pinning it): answered as chosen, both shapes being code's or prose's as much as
  a field's and never blanked on main, and pinned by test cases that stay. Codex: incorrect, 0.98, one P2, reproduced
  by it and fixed with a test that failed first: `pass(?==)` blanked code (`if (pass===expected…)` became
  `if (pass=<redacted> return true;`), and the backup blanks worktree patches; a bare `pass` is now a field only as an
  env line's, at a line's start (raw, or after JSON's `\n`) or after `export `, with one `=`. Its run recorded
  nothing: this session edited `bin/lib/backup.test.mjs` for the lens's answer while Codex reviewed (136,092 input
  tokens spent); `edit-during-review` seen again, its `- Seen:` line in `docs/FAILURES.md`; the review runs again with
  no edit until it ends. `node --test bin/lib/backup.test.mjs`: 26 of 26; 40,000 backslashes before a key, 7.4 ms.

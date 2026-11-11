# Triage of the Fable 5.2 audit: its verified findings as proposed tasks, 2026-11-10

A read-only triage, by JH 163, of the medium and low findings that the Fable 5.2 audit of the whole harness (JH 161,
2026-11-09, pull request 800, `docs/audits/2026-11-09-fable-5-2-audit.md` on `claude/fable-5-2-audit-531f8e`)
verified, and of its 27 candidates to shed or merge. The audit's subject was `origin/main` at `378642bb`; this
triage checks each finding against `origin/main` at `6ee974dd`, which adds pull requests 797, 798 and 799. Pull
requests 801 to 804 are open and were read only by the files they change. Its two high findings are outside this
triage: H1 is fixed in pull request 801 and H2 in pull request 804, both open and waiting for his yes.

Nothing was changed, fixed or spent to write it: no source, no rule, no eval, no Codex review. Every task below is a
proposal the lead puts to him or schedules; none was started. Each verdict rests on lines this session read at
`6ee974dd`, or on a pure function it ran, named beside it; the audit's line numbers were its claim and were read
again, not trusted. The repository is public, so a security finding is described by what it is, never with a
working example.

Size by `CLAUDE.md`'s test: small. Its outcome is one document, it writes no source, and the request plus `git diff`
resume it, so no feature document was opened.

## Summary

Bad news first.

1. **`main` has no protection on GitHub.** The audit left this "not known" (L6). `gh api
   repos/{owner}/{repo}/branches/main/protection` answers "Branch not protected" (404), and `gh api
   repos/{owner}/{repo}/rulesets` gives 0 rulesets. The only thing between a session and a direct push to `main`
   is the local pre-push hook, which `JS_HARNESS_MERGE_QUEUE=1` lifts (`.githooks/pre-push:12`). It joins M1 in
   unit 8, his call.
2. **Every commit still publishes its staged tree to a public repository before the commit exists** (M1), and
   three `gate/*` or `queue/*` branches are still on `origin` (`git ls-remote origin "refs/heads/gate/*"
   "refs/heads/queue/*"`, 3 lines).
3. **The heartbeat's ticks still write nothing** (M37): the newest throughput snapshot is still
   `2026-11-02.json`, `~/.js-harness/loops/D--js-harness` is still empty, and no `ticks --hook` command exists.
   Nothing has prompted a throughput review for eight days.

What it found:

| Verdict at `6ee974dd` | Medium | Low | Ids |
|---|---|---|---|
| Still true | 35 | 8 | all but the two below |
| Changed: partly fixed | 1 | 0 | M5, by pull request 799 |
| Does not hold when read | 1 | 0 | M32 |
| Fixed | 0 | 0 | none; pull requests 801 to 804 touch only H1, H2 and part of M5 |

The 43 findings still true, plus what M5 leaves, fall into 13 work units: 7 the lead can schedule (about 24 hours of
work, estimated) and 6 that are his call, each with the question below; L4 is closed by the first candidate to
shed. Of the 27 candidates to shed or merge, the
first to take is the gentle-ai guard code, because gentle-ai left at F8 S2 (pull request 779, merged 2026-11-07)
and the proof that nothing was lost is a command already in the repository. The audit's appendices hold 44 medium
and 247 low findings no one verified; five are named below to verify first.

## Verdicts, one per finding

"True" means the defect the audit describes is in `6ee974dd` as described; the evidence is what this session read
or ran there. Lines are those of `6ee974dd`, which may differ from the audit's.

### Medium

| Id | Verdict | Evidence at `6ee974dd` |
|---|---|---|
| M1 | true | `bin/lib/ci-gate.mjs:128-147` pushes `gate/<sha>` with `--no-verify`; the only switch is the environment's `CI_GATE_ENV=0` (`:60`), and nothing reads the repository's visibility or a project setting |
| M16 | true | `bin/fetch.mjs:24-43` unchanged: host, user and password, and query key names only |
| M37 | true | `bin/loop.mjs:707-712`; `git grep "ticks --hook"` finds only `bin/lib/hook-count.test.mjs` and the plan; snapshots end at `2026-11-02.json` |
| M2 | true | `COVERAGE.cases` holds 21 cases, and `evals/tasks/` has 21; `evals/tasks.test.mjs:37` returns for an owed case |
| M3 | true | `evals/proofs/rules/rule-away-autonomy.json` 0.9167 against 0.9167; `rule-reuse-first.json` 0.7143 against 0.7143 |
| M4 | true | `evals/rule-proof.mjs:22` `MIN_TRIALS = 2`; `:116` a strict `<` |
| M5 | changed | Pull request 799 (`2717f7ca`) moved the two stale controls (`docs/FAILURES.md:676-680`, `:2068-2073`, each with a `Was:` line), and `37d7ff61` gave every live rule a control: the owed controls fell from 51 to 2 (`work-sessions-public`, `work-sessions-private-wsl`). `js-harness failures check --settled` now says "not settled: 10 of 141" (12 at the subject). Still true: a control counts as held when its phrase is found in its file (`bin/lib/failures.mjs:61` `squash`); no rule carries a `row` (`grep -c` gives 0 in `bin/lib/rules-data.mjs`); `rules applied` is run by nothing on its own. Open pull request 802 makes `--strict` refuse an owed rule |
| M6 | true | `bin/reply.mjs:222`; its header (`:9`) says it is by design, "turned back once per stop and never loops" |
| M7 | true | Ran `ownShares` of `bin/lib/share-check.mjs`: "77.5 % de contexto" gives 5, "77,5 %" gives 5, "1050%" gives 50 |
| M8 | true | `bin/double-review.mjs:62` holds the accent; `:566` compares with `toLowerCase().includes` only |
| M9 | true | `docs/FAILURES.md:1805`: 21 `Seen:` lines; the control is dated 2026-10-31 (`:1891`), and 16 sightings fall after it, the last on 2026-11-08 |
| M10 | true | `bin/lib/cache.mjs:76-80` writes in place; `:31-39` reads a parse error as an empty cache; `bin/doctor.mjs:243-256` then records the current versions as reviewed |
| M11 | true | `bin/lib/test-run-warning.mjs:42-47`: quoted text never sets `globbed` |
| M12 | true, read and not run | `bin/codex-review.mjs:1370` returns the given base when `--again` is set; `bin/lib/codex-review-recheck.mjs:149-150` finds no record at a base behind the head; the header at `:15` says "No flag skips it". A run is a Codex spend |
| M13 | true | `bin/lib/contract.mjs:161-178` looks for `$(` alone |
| M14 | true | `bin/check.mjs:1054` overrides `HOME` and `USERPROFILE`; `JS_HARNESS_HOME` is inherited (`:1064-1066`) and preferred by `bin/lib/home.mjs:18-21` |
| M15 | true | `docs/FLAKY.md:25` and `:33` expired on 2026-10-22 and 2026-10-23 |
| M17 | true | `docs/README.md:22`; `docs plan` exists only in `workshop/bin/docs.mjs` |
| M18 | true | `bin/lib/functions.mjs:165` resolves by program files; `docs/SPEC.md:173` and `docs/GUIDE.md:124` say "where Codex is installed" |
| M19 | true | `bin/lib/stack-install.mjs:40-47` `wanted: () => true`; `docs/SPEC.md:436` says optional; "eight protocols" at `docs/SPEC.md:255` and also `:670` |
| M20 | true | `git grep -i "high.risk" -- CLAUDE.md AGENTS.md` finds `CLAUDE.md:21` alone |
| M21 | true in code | `bin/lib/sessions.mjs:22` `DEFAULT_CONTEXT_WINDOW = 500000`; `bin/lib/pause.mjs:77-79` reads the host's window. The 57 % against 87 % the audit saw was not reproduced |
| M22 | true | `bin/lib/sessions.mjs:1696` and `:1759` |
| M23 | true | `bin/stretch.mjs:595` compares `one.at.slice(11, 16)`, a UTC hour; `bin/lib/stretch-why.mjs` prints `localHour` |
| M24 | true | `evals/prices.mjs:3-4` against `evals/report.mjs:148`; `evals/honesty-report.mjs:80` against `evals/report.mjs:152`; `evals/report.mjs:242` |
| M25 | true | `evals/tasks/rule-away-autonomy/grader/rule-away-autonomy.grade.mjs:74` |
| M26 | true | `evals/configs.mjs:5-6` against `evals/codex-configs.mjs:81` |
| M27 | true | `bin/remote.test.mjs:61` skips off Windows; `.github/workflows/gate.yml:23` runs on `ubuntu-24.04` |
| M28 | true | `workshop/js-harness-workshop.mjs:6` cites `bin/conventions-workshop.test.mjs`; `git ls-files 'bin/conventions-*'` lists six files, not that one |
| M29 | true in code | `bin/lib/project.mjs:1028-1029`; the uninstall side was not read, as in the audit |
| M30 | true | `bin/update.mjs:569-571` |
| M31 | true | `bin/lib/wake.mjs:20` and `:104-113` copy the whole line (`oneLineCommand(wait)`) |
| M32 | does not hold | The queue builds its candidate with `git merge --no-ff ... pr.headRefOid` (`bin/merge-queue.mjs:358`) and `main` fast-forwards to it, so the pull request's head is an ancestor of the new `main`; `bin/lib/refresh-consent.mjs:43-49` asks exactly that, head first. A head pushed after the queue read it is not in `main`, and the answer "does not hold" is then right |
| M33 | true | `bin/lib/manifest.mjs:547` and `:615`, `bin/lib/user-settings.mjs:43` and `:87` write in place; the harm is assumed, as in the audit |
| M34 | true | `bin/lib/quiet.mjs:10` against `bin/lib/sessions-running.mjs:13` |
| M35 | true | `bin/lib/status-line-uninstall.ps1:20-22` |
| M36 | true, minor | `bin/lib/manifest.mjs:1227-1232` removes the cache and the gate, gate-log, tickets, channel and remote folders; the prompt at `bin/tui.mjs:57` names none of them |

### Low

| Id | Verdict | Evidence at `6ee974dd` |
|---|---|---|
| L1 | true | `bin/lib/rules-data.mjs:233` `claude-fable-5-1`; its reading (`docs/rule-sources.json:376`) says the strongest model this machine knows, and Fable 5.2 came out on 2026-11-09 |
| L2 | true | Ran `compareSemver('1.2.3-rc.1', '1.2.3-rc.1')`: -1; `bin/lib/version.mjs:12` accepts prerelease tags |
| L3 | true | `bin/lib/component-write.mjs:31-43`: with no previous record, it writes over what is there and keeps no copy |
| L4 | true | `bin/lib/guard.mjs:410-440`; S2 closed in pull request 779, merged 2026-11-07 |
| L5 | true | `docs/ROADMAP.md:249` is ticked; `git tag -l 'v1*'` is empty |
| L6 | true, and now known | See the summary: GitHub protects nothing on `main` |
| L7 | true | `bin/lib/summary.mjs:31` names the day with `toISOString`, a UTC day |
| L8 | true | Review dates still ahead: `rule:double-review` 2026-11-16 (`bin/lib/rules-data.mjs:226`), `rule:growth-limit` 2026-11-15 (`:301`) |

## Work units, in the order to take them

The lead's units come first, cheapest and most visible first. The units that are his call can go to him now, one
question at a time in the order of the next section, and run beside them. Sizes are estimates of a session's work,
reviews included, not measured. "High risk" names the items of the Task Size list (the six points under "High risk"
in his global instructions); unit 12 proposes to put that list where Codex reads it.

### 1. Entry documents and dead pointers

- **Closes:** M17 (the line in `docs/README.md` only; the other mentions of workshop commands stay with T6 of
  `odd/tasks/workshop-product-split.md`, and those in `CLAUDE.md` are his), M18, M19, M28, M15, L5.
- **What:** fix the four documents' claims; write `bin/conventions-workshop.test.mjs`, which the workshop's header
  already promises (product code never imports `workshop/`); remove or renew the two expired quarantine entries,
  after one run of each test says whether it still flakes; say whether `docs/ROADMAP.md:249` records a rehearsal
  (read `odd/tasks/harness-review.md` first).
- **Done when:** `node --test bin/conventions-workshop.test.mjs` exits 0; `node workshop/js-harness-workshop.mjs
  docs check` exits 0; `npm run check` exits 0.
- **Size:** 2 hours. **High risk:** none. **Whose call:** the lead's.

### 2. The Stop hook's checks

- **Closes:** M7, M8, M6.
- **What:** give the share pattern a left boundary and a decimal part, with "77.5 %", "77,5 %" and "1050%" as tests;
  compare the skip phrase with accents folded, with "no quiero la revision" as a test; for M6, either check the
  second stop too and let it through while recording the miss, or say in the rule that the second attempt is not
  checked. The host sets `stop_hook_active` so that a hook cannot loop, so M6 must not block twice.
- **Done when:** `node --test bin/lib/share-check.test.mjs bin/double-review.test.mjs bin/reply.test.mjs` exits 0
  with the new cases.
- **Size:** 3 hours. **High risk:** yes, item 2 (a guard): a wrong pattern turns back every reply. An independent
  verifier for M6 only. **Whose call:** the lead's.

### 3. The heartbeat's ticks

- **Closes:** M37, and through it the throughput reviews and the daily Windows run that nothing reports today.
- **What:** first find why the snapshots stop on 2026-11-02, four days before pull request 776 merged (is a heartbeat
  running at all?); then build `ticks --hook` with its stale-ticks row as `odd/tasks/workshop-product-split.md:898-900`
  plans it.
- **Done when:** `node workshop/js-harness-workshop.mjs ticks --hook` exits 0 and prints a stale row against a home
  whose newest snapshot is two days old (a test); a snapshot of the day appears in
  `~/.js-harness/throughput/D--js-harness/`.
- **Size:** 4 hours. **High risk:** yes, item 5: it adds a hook to the project's `.claude/settings.json`.
  **Whose call:** the lead's (the heartbeat is the lead's loop).

### 4. Refusals with a way past

- **Closes:** M11, M12, M13, M14, M27.
- **What:** read a quoted whole-suite glob as the whole suite; refuse `--again` where the third-review rule applies,
  proven by the recheck tests, which spend nothing; let `cmdShellGap` see a backtick, `$VAR` and single quotes;
  override `JS_HARNESS_HOME` in the sensors' throwaway home; run the Windows-only remote tests in a gate that
  blocks (a Windows job in `.github/workflows/gate.yml`, or the local Windows run before the WSL mirror).
- **Done when:** `node --test bin/lib/test-run-warning.test.mjs bin/lib/codex-review-recheck.test.mjs
  bin/lib/contract.test.mjs bin/check.test.mjs` exits 0 with a case for each; the gate's log of a commit shows
  `bin/remote.test.mjs` with its Windows tests run, not skipped.
- **Size:** 4 hours. **High risk:** yes, item 2 (guards, and the sandbox of a sensor, M14), and item 5 for M27 (CI);
  M12 guards a spend. An independent verifier. **Whose call:** the lead's.

### 5. State written in place

- **Closes:** M10, M33.
- **What:** write `doctor.json` and `~/.claude/settings.json` by a temporary file and a rename, as the engram hook
  writer beside them does; keep the reviewed versions of host and stack in a record, so that a torn cache cannot
  turn a pending update into "reviewed".
- **Done when:** `node --test bin/lib/cache.test.mjs bin/doctor.test.mjs bin/lib/manifest.test.mjs` and a new
  `bin/lib/user-settings.test.mjs` (none exists today) exit 0, with a test that a corrupt `doctor.json` records
  nothing as reviewed.
- **Size:** 3 hours. **High risk:** yes, items 1 (a persisted format moves from the cache to a record) and 4 (two
  writers). An independent verifier. **Whose call:** the lead's.

### 6. What the board and the session tools read

- **Closes:** M21, M22, M23, M31, M34, L7.
- **What:** one context window for the board, `notify` and the pause; tell a dismissed question by more than one
  host string, or record an answer that matches no option as unverified; let `stretch explain failure:<HH:MM>` take
  the local hour the page shows; re-arm only the `wait` part of a chained line; one list of the work that holds "do
  not turn the PC off" (candidate 20); name a summary by the local day.
- **Done when:** `node --test bin/lib/sessions.test.mjs bin/stretch.test.mjs bin/lib/wake.test.mjs
  bin/quiet.test.mjs bin/summary.test.mjs` exits 0 with a case for each.
- **Size:** 4 hours; it can split into two writers with disjoint files (sessions and quiet; stretch, wake and
  summary). **High risk:** none named; L7 changes the names of new files only. **Whose call:** the lead's.

### 7. Install and uninstall edges

- **Closes:** M29, M30, M35, M36, L2, L3.
- **What:** record the shared files of `init` in a linked worktree where the main checkout's record keeps them, or
  refuse `init` there; print the sync's own error after an upgrade; remove the status-line policy value only when it
  holds what install wrote; name the folders in the uninstall prompt; compare prerelease versions; keep a copy of a
  file a first install would overwrite.
- **Done when:** `node --test bin/lib/project.test.mjs bin/update.test.mjs bin/tui.test.mjs
  bin/lib/version.test.mjs bin/lib/component-write.test.mjs bin/lib/manifest.test.mjs` exits 0 with a case for each.
- **Size:** 4 hours. **High risk:** yes, items 1 (uninstall removes stored data) and 5 (the installer). An
  independent verifier. **Whose call:** the lead's.

### 8. What a commit publishes, and who may push `main` (his call)

- **Closes:** M1, L6.
- **What:** a project setting that says whether a commit's tree may go to the remote gate, read before the push,
  off by default for a public repository and declared on in this one; on GitHub, refuse a force-push and a deletion
  of `main`, which the queue's fast-forward land does not need.
- **Done when:** `node --test bin/lib/ci-gate.test.mjs` exits 0 with a case where a public repository with the
  setting off pushes nothing; `gh api repos/{owner}/{repo}/rulesets --jq length` gives 1.
- **Size:** 2 hours. **High risk:** yes, items 2 and 3 (what is published; a new setting others read, though adding
  one is not a break). **Whose call:** his. Question 1.

### 9. The eval bar before the next paid run (his call)

- **Closes:** M2, M3, M4, M24, M25, and candidate 14.
- **What:** set the bar a rule proof must clear before a paid run (more trials an arm and a difference larger than
  the measured spread); make the reports agree with their headers on cost and on errored trials; grade the
  away-autonomy case on the rule, not on this repository's reply label; fix or drop the cases that never fail or
  never pass. No paid run is part of this unit.
- **Done when:** `node --test evals/rule-proof.test.mjs evals/report.test.mjs evals/honesty-report.test.mjs` exits
  0 with the new bar and the agreeing reports.
- **Size:** 4 hours, no spend. **High risk:** item 6 in part: no test says whether a grader measures the rule.
  **Whose call:** his (spend, and the bar). Question 2.

### 10. What the security checks claim (his call)

- **Closes:** M16, M26; the appendix findings `evals-b-2` to `evals-b-5` join it once verified.
- **What:** say the true limit in `fetch`'s help and in the eval sandbox's header; refuse in `fetch` a URL whose
  path holds a long opaque segment.
- **Done when:** `node --test bin/fetch.test.mjs evals/configs.test.mjs` exits 0 with the refusal's case.
- **Size:** 2 hours; a real confinement for the eval trials is a separate, larger piece. **High risk:** yes, item 2.
  **Whose call:** his. Question 3.

### 11. The high-risk list where Codex reads it (his call)

- **Closes:** M20.
- **What:** `CLAUDE.md:21` points at a list "below" that lives only in his private global file; copy the six items
  to `AGENTS.md`, if they fit its token budget, and let `CLAUDE.md` name them.
- **Done when:** `git grep -c -i "high risk" -- AGENTS.md` is at least 1 and `npm run check` exits 0 (the budget row).
- **Size:** half an hour. **High risk:** item 3 in part (instructions others consume). **Whose call:** his
  (`CLAUDE.md` and the list are his texts). Question 4.

### 12. The failure seen most after its control (his call)

- **Closes:** M9, and what remains of M5 as it bears on the registers.
- **What:** `stretch-not-opened` is turned back at his return, after the time away it is about; 16 of its 21
  sightings came after its control. A control that acts when he leaves, not when he returns.
- **Done when:** a test in `bin/lib/return-report.test.mjs` or its successor shows the stretch opened, or the lead
  told, at the start of an absence; the entry's next sighting window passes without a new `Seen:` line.
- **Size:** 3 hours, an estimate that depends on what the host lets a session see of his absence. **High risk:**
  item 6 in part. **Whose call:** his (it is his time away). Question 5.

### 13. His rules coming due (his call)

- **Closes:** L1, L8.
- **What:** `rule:escalation-model` is still `claude-fable-5-1`; its reading names the strongest model this machine
  knows, and Fable 5.2 is out. `rule:growth-limit` comes up for review on 2026-11-15 and `rule:double-review` on
  2026-11-16.
- **Done when:** `js-harness rules escalation-model` prints the value he chose, recorded with `js-harness rules change`
  on a `rule/` branch with his words and their date; `js-harness rules check` exits 0.
- **Size:** half an hour for L1; the two reviews are their own sessions. **High risk:** none beyond his rule.
  **Whose call:** his. Question 6.

## Questions for him, in order

Each is one decision. The lead asks them one at a time through the question tool, as `CLAUDE.md` says, recorded
before each is asked.

**Pregunta 1 (unidad 8: lo que publica cada commit, y quién puede empujar a main).** Cada commit de js-harness sube
primero una copia de lo que tienes en stage a GitHub, en una rama `gate/…` que se borra al terminar, para correr las
pruebas allá. El repositorio es público, así que esa copia queda visible un rato, aunque el commit se rechace.
Además, `main` no tiene ninguna protección en GitHub: lo único que impide un push directo es un hook local que una
variable de entorno apaga. ¿Qué hacemos?

1. **Escribirlo como decisión y proteger main (Recomendada).** Un interruptor en `harness.json` que en este repo
   queda encendido y en otros proyectos públicos arranca apagado, y en GitHub una regla que solo prohíbe force-push y
   borrar `main`. Un sí cubre ese interruptor con su prueba y ese ajuste de GitHub. No cubre hacer privado el repo ni
   exigir pull requests en GitHub, que rompería la cola de merge.
2. **Apagar el gate remoto en repos públicos.** Las pruebas de cada commit corren solo en tu PC: más lento, pero
   nada sale antes del push.
3. **Dejarlo como está** y solo documentarlo.

**Pregunta 2 (unidad 9: la vara de las evals antes de gastar).** Las dos únicas mediciones de si una regla cambia el
comportamiento dieron empate exacto (0,92 contra 0,92 y 0,71 contra 0,71), con 2 intentos por lado. Hoy una prueba
se acepta con 2 intentos y cualquier diferencia, algo que el azar da a menudo. Antes de la próxima corrida pagada hay
que fijar la vara. ¿Qué hacemos?

1. **Subir la vara y arreglar los casos primero, sin gastar (Recomendada).** Por ejemplo 5 intentos por lado y una
   diferencia mayor que la variación medida, y arreglar o quitar los casos que siempre pasan o nunca pasan. Un sí
   cubre esos cambios, que no gastan. No cubre ninguna corrida pagada: esa se te cotiza aparte.
2. **Dejar la vara en 2 intentos** y correr cuando toque, sabiendo que el resultado dice poco.
3. **Pausar las pruebas de reglas** hasta correr el experimento de `docs/future-model.md`.

**Pregunta 3 (unidad 10: lo que prometen dos protecciones).** Dos protecciones dicen más de lo que hacen. `fetch`
revisa el host y los nombres de los parámetros, pero un secreto dentro de la ruta de la URL sí sale al servicio que
lee la página. Y el aislamiento de las evals redirige variables de entorno, no encierra: los intentos corren con los
permisos saltados. ¿Qué hacemos?

1. **Decir el límite real y cerrar el hueco de fetch (Recomendada).** Corregir los dos textos, y que `fetch` rechace
   una ruta con un segmento largo que parece una clave. Un sí cubre los textos y ese rechazo con su prueba. No cubre
   un encierro real para las evals.
2. **Solo corregir los textos.**
3. **Además, construir un encierro real para las evals:** más horas, que se te cotizan aparte.

**Pregunta 4 (unidad 11: la lista de alto riesgo).** El `CLAUDE.md` del repo dice que una tarea pequeña "no toca nada
de alto riesgo (abajo)", pero esa lista está solo en tu archivo global privado, así que Codex y un clon nuevo nunca
la leen. ¿Qué hacemos?

1. **Copiar la lista a `AGENTS.md` (Recomendada),** que es lo que lee Codex, si cabe en su presupuesto de tokens, y
   que `CLAUDE.md` la nombre. Un sí cubre copiar tus seis puntos tal como están. No cubre cambiarlos.
2. **Quitar "(abajo)"** y apuntar a tu archivo global, aceptando que Codex no la lea.

**Pregunta 5 (unidad 12: la falla que más se repite).** La falla más vista, no abrir un tramo cuando te vas, tiene
un control que solo actúa cuando vuelves: se vio 16 veces después de que se puso. ¿Qué hacemos?

1. **Un control que actúe al irte (Recomendada).** Cuando la sesión sabe que te fuiste y no hay tramo abierto, lo
   dice en ese momento a la sesión líder, en vez de esperar tu regreso. Un sí cubre diseñarlo y construirlo con su
   prueba. No cubre cambiar qué cuenta como ausencia.
2. **Dejarlo como está** y seguir registrando cada vez al volver.

**Pregunta 6 (unidad 13: el modelo de escalada).** La regla `escalation-model` dice `claude-fable-5-1`, y su fuente
dice que su valor es el modelo más fuerte que conoce esta máquina; Fable 5.2 salió el 2026-11-09. ¿La cambiamos?

1. **Pasarla a `claude-fable-5-2` (Recomendada),** con tus palabras de hoy citadas, como pide el cambio de una regla
   tuya. Un sí cubre ese valor. No cubre `session-model` ni `session-effort`.
2. **Dejarla en 5.1** hasta ver a 5.2 en una revisión real.

## Candidates to shed or merge

None of the 27 is a change, and the audit marks most of them assumed. This session checked only what the first
picks below rest on.

The proof that nothing was lost is the same for each, run before and after: `npm run check` exits 0; `js-harness
failures check --settled` names no new "control lost" and stays at "not settled: 10 of 141" or fewer; `js-harness
rules check` and `js-harness rules coverage` exit 0 with no control gone; `node workshop/js-harness-workshop.mjs
spec` keeps its capabilities. A removed test that is a failure's control shows up there as "control lost", so it is
retired on purpose with a `Was:` line, never silently.

Take first, in this order:

1. **The gentle-ai guard code and its tests** (candidate 1, with appendix `tests-3`). gentle-ai left at S2, closed
   in pull request 779. Checked: `bin/lib/guard.mjs:410-440` still refuses a gentle-ai review base, and
   `bin/lib/gentle-ai-absence.test.mjs:26` says the refusal "leaves with it at S2". One thing to carry: the guard's
   test is the control of a failure at `docs/FAILURES.md:1481`, so that entry gets a `Was:` line saying the tool it
   guarded is gone. Extra proof: `git grep -n "gentle-ai review" -- bin ':!*.test.mjs'` finds nothing.
2. **Dead exports** (candidate 24). `node scripts/audit-exports.mjs` already lists them; extra proof: it lists fewer
   and the suite passes.
3. **Placeholders for states that no longer occur** (candidate 6). Checked: the `--session` flag is still read
   (`bin/codex-review.mjs:270` and `:293-294`), and `## Effort` is still validated though "nothing reads it"
   (`bin/lib/contract.mjs:42-44`). Extra proof: `js-harness contract check` still exits 0 over every feature
   document.
4. **Code written twice** (candidates 17, 19, 20, 22): moves with tests, no new behaviour. Candidate 20 is done
   inside unit 6.

Wait for:

- **Candidate 4, the dormant refusal paths**: open pull request 802 gives `--strict` its first refusal; judge after
  it lands. `OWED_CAP_FROM` is still `null` (`bin/lib/rules-coverage.mjs:326`).
- **Candidate 13, the double review's bookkeeping**: it feeds the judgement due on 2026-11-16; judge after it.
- **Candidate 2, `codex-trust.mjs`**: it keeps the exact undo of installs of 0.96.0 and earlier, which `AGENTS.md`
  promises; take it only once no machine of his holds such a record.

His alone, through `docs/future-model.md` and its paid steps: candidates 7 (the review-record guard, a security
redesign), 10 (the instruction text), 11 (onboarding), 23 (tests that pin wording) and 26 (the confirming reviews,
a standing rule of his).

## The appendices nobody verified

Appendix A holds 44 medium findings and appendix B 247 low ones, each reported by a reader and not verified. These
five come first, because a true one would weaken a guarantee others rely on:

1. `evals-b-2`: the hidden graders can be read by the agent under test, which would make every eval score suspect;
   it joins unit 9 and question 2.
2. `core-11-14`: one session can approve another session's permission card.
3. `core-11-15`: each relayed permission request keeps the full tool input on disk, in plain text, with no removal.
4. `core-02-9`: a `stack backup run` that fails partway leaves a partial copy that holds credentials.
5. `evals-b-11` with `core-09-11`: the CI gate and the land's push are judged by the checks the candidate itself
   carries, so a change that weakens them passes its own gate.

## What was not checked

- Nothing was run but read-only commands and three pure functions (`ownShares`, `compareSemver`, the coverage
  register's counts); no test, no gate, no eval, no Codex review.
- M12 was read and not run (a run spends Codex); M21's 57 % against 87 % and M33's harm were not reproduced.
- Pull requests 801 to 804 were read by the files they change, not by their diffs; none was checked to close a
  finding beyond H1, H2 and M5's strict refusal, which their titles name.
- The 27 candidates were not verified beyond the lines named under "Take first".
- The appendices' 291 findings were not verified.
- The sizes are estimates.

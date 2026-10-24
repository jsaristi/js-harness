# Memory feedback home

A rule he states is written to the repository before any memory note may hold it. Branch `rule/memory-feedback-home`;
test runner `node --test`; delivery `single-pr`.

## Goal
A `feedback` note of a project's Claude Code memory folder is written only when it names where its rule is cemented
in the repository, and every feedback note already in this project's folder does.

## Why
On 2026-10-15 the session JH 5 sat paused waiting for him to type /compact, because his new rule (he never compacts by
hand) lived only in a memory note while AGENTS.md still said the old one. Memory is the cheapest place to write a rule,
so agents keep choosing it; a sensor removes that path instead of a reminder that asks for discipline.

## Done when
- `node --test bin/guard.test.mjs bin/guard-feedback.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs guard --memory C:/Users/Oficina/.claude/projects/D--js-harness/memory` exits 0
- The guard refuses a Write of a bare feedback note and lets through one that names `rule:<id>` of a declared rule.

## In scope / Out of scope
- In: `bin/guard.mjs`, a new `bin/lib/memory-feedback-guard.mjs`, their tests, the rule's declaration and source, the
  harness's own rules that his feedback notes carry, AGENTS.md, docs, this project's memory notes.
- Out: notes of type `project`, `user` and `reference` (doctor's `memory-rules` row already reports `project` notes);
  writes to the memory folder by Bash, which no PreToolUse check of Write and Edit sees.

## Constraints
- The guard runs on every Write and Edit of every session — because of that a call that is no feedback note loads no
  module and reads no file beyond what it loads today.
- A project that installs the harness turns nothing on by default — because of his answer of 2026-10-14
  (odd/tasks/honesty-audit.md S5): the check runs only where the rule memory-feedback-home is declared.

## Ask me before
Deleting any memory note: one list, sent through the lead.

## Specs
- S1 His words of 2026-10-15, in the lead's chat, as the lead's brief quotes them: "si pero todo lo que se deja en
  memoria se pierde por que seguimos guardando cosas importantes y relevantes en memoria, por eso pasa lo que esta
  pasando" and "dime como hacemos para que estas directrices importantes deje de estarlas guardando en memoria y las
  cemente o sino vamos a estar constantemente equivocandonos".
- S2 `js-harness guard --hook` (PreToolUse, Write/Edit) refuses a write to a memory folder of a note whose frontmatter
  type is `feedback` unless the note names where the rule is cemented in the repo: a rule id in `docs/rules.json` /
  `docs/rule-sources.json`, or an AGENTS.md phrase, that `rules check` can find. Tests first, through the public
  command. The refusal message names how to cement it.
- S3 One move pass: every existing feedback note in that memory folder that states a rule gets its user's verbatim
  words into the repo (rules sources, AGENTS.md, roadmap or a feature document), and the note shrinks to a pointer.
  Use `js-harness memory plan/verify`; deletions are asked as one list through the lead.
- S4 Help text and docs updated. Item 2 of the high-risk list (a guard): gentle-ai review plus Codex review per
  AGENTS.md.

## Tasks
- [x] T1 (kind: build) S2: the guard, test first; the rule memory-feedback-home declared with `js-harness rules change` (73f61b9f, fix 3a5bd482)
- [x] T2 (kind: build) S3: the move pass over the feedback notes (259dec8b..b0aa1e41, one commit a rule; memory pass 20261022T233738619Z)
- [x] T3 (kind: docs) S4: help text, README/GUIDE, roadmap (help and README with T1; roadmap F4 item ticked with T2)
- [x] T4 (kind: verify) S4: gentle-ai review and Codex review of the slice (T1: L5, L6; T2: L12)

## Moved out of memory
T2 shrank each feedback note of the memory folder that holds a rule of his to a pointer: the rules declared by this
pass (rule:lead-charter, rule:status-report, rule:session-prompts, rule:wording-is-the-need, rule:mistake-report,
rule:background-task-declared, rule:session-housekeeping, rule:rules-live-in-the-harness, rule:ask-before-away,
rule:reply-four-states, rule:announce-finished, rule:recap-effort-line) carry his typed words in
docs/rule-sources.json, and a reading that names every other home. What the notes held beyond that is kept here.

Parts with no typed line of his on disk, so not declared as rules of his:
- An AGENTS.md change that implements a correction he ordered, green on the gate, Codex and GitHub and within
  rule:agents-budget, merges without asking him; he is told after with the link and his ordering line. His answer was
  a tapped option, b878a67f line 4678 (2026-10-14).
- The one free Codex rate-limit reset credit is used only when a needed review is blocked by the five-hour limit and
  the normal reset is hours away, told to him after. A tapped option, not found on disk.
- While he is away the lead and sessions are as autonomous as possible; a decision truly his reaches his phone through
  the question tool (rule:questions-one-place). His words of 2026-10-17 are quoted below; no transcript holds them.
- Review consent is pre-granted: AGENTS.md, "Working with Sebastián", carries it. His words are a typed answer inside a
  question, b3813f13 line 1174 (2026-09-27), which a rule's source does not take.
- "Take the recommended answer while he is away" cited transcript e152c9d8, which is no longer on disk, and it
  contradicts AGENTS.md (product choices are his), so it is not carried.
- No turn ends waiting while he is away: the agents' own rule after the stall of 2026-10-14, carried by the
  orchestrator skill ("Before the user leaves, check and say").
- The lead sets each session's effort with the app's tool: his words are queued messages, 130317af lines 3668 and
  3680; odd/tasks/effort-by-task.md carries it.
- A recap comes before a decision or a cut: bin/lib/protocols-skill.mjs carries it; his words of 2026-10-04 are not
  on disk.
- He does not want the current session erased, "si pero me borraria esta sesion? o la sobreescribiria? por que no
  quiero eso" (4ed4b90f line 1163): a cut never offers /new or /clear. Since he never compacts by hand
  (odd/tasks/no-manual-compact.md), no cut hands him a command at all. The note that held it,
  phone-cannot-open-local-session, is retyped as a reference note of this machine's facts.

Quotations of the notes, verbatim as the notes held them (some are the notes' retyping of his words, with accents
he did not type; his exact words are in the rule sources):
- ask-before-he-leaves: "necesitas que te abra otra sesion por si algo?"; "Siempre recuerda que cuando me vaya a dormir siempre pedirme lo que necesites ... como eso de la compactacion y de abrir mas sesiones ... necesito que seas mas inteligente y revises todo"; "While he is away no session (lead included) ends a turn waiting for a message, his /compact or an event; each arms a declared background wait for what it waits on, and the lead keeps a heartbeat"; "Once Sebastián says he is away, do not repeat the same decision block, prompt or command on each wake; say it once and hold it until he says he is back or writes again"; "Qué es / Dónde / Qué pasa"; "a block he has not used is repeated whole"; "te voy a dejar solo unas 10 horas asi que continua, no me preguntes nada continua tu solo todo"
- background-tasks-declare-and-dismount: "On this Windows machine TaskStop of a background task kills the shell but leaves its node child (e.g. a queued ) running"
- cross-session-prompts: "para la sesión de remote-live"; "I am waiting for Sebastián on X"; "When work branches into two or more sessions, or some are paused, the main session keeps orchestrating the others so the order is not lost"; "quiero que siempre lo hagas cuando estemos utilizando 2 sesiones o varias y cuando tengamos unas pausadas, o sea que cuando se ramifique por alguna razón la principal se quede orquestando las otras para seguir en orden y no se vuelva un desorden o nos perdamos del camino"; "la sesión me da un prompt para seguir y tú me das otros, o sea la idea de orquestar es ver por dónde van pero cada sesión tiene independencia, porque si no tuvieras que tener todo el contexto ... o el prompt de inicio de sesión no está bien con su contexto"
- dogfooding-rules-go-in-the-harness: "todo lo que estamos implementando es para el harness y estamos haciendo dogfooding"; "todo lo que queda en memoria se olvida, siempre pero SIEMPRE ... TODO debe quedar guardado y cementado en el harness, o sea en la documentación pero también en los archivos donde debe ir para que el harness funcione bien aquí y en cualquier otra parte que se instale"; "Tienes que ser conciente que este es el proyecto del desarrollo del harness y tambien ayudarme con ese criterio y el criterio de lo que pasaria si este harnes ya estuviera en produccion y como funcionaria con otros proyectos"; "no tengo problema en aumentar el plan y tener varios planes maximos"
- effort-by-kind-of-work: "ya sabes siempre debes manejar el esfuerzo para que tengamos la mejor eficiencia en el USO"; "Every Agent tool call passes effort \"; "explicitly; the parameter exists since Claude Code 2.1.292 and works in the desktop app"; "mira que las sesiones anidadas se abrieron en esfuerzo Max ... tu siempre como orquestador debes controlar todo, fue por eso que gastamos tanto uso"
- guide-not-literal: "AGENTS como orquestador de las reglas principales"; "con protocolos"; "what he asked"; "No me tomes literal lo que digo, por favor quiero que me guíes muy bien en cómo debería ser, o sea, ¿cuál es la mejor forma?"
- mistake-report-four-parts: "y ademas se debe a futuro comprobar que esto no vuelva a fallar"; "we will watch for it"; "I will remember next time"; "fue mi error"
- notify-when-done: "Contexto: 62%"; "no hya regla del 73% es regla del 85 pero si quieres coloca la compactacion en 96% que la regla sea la regla del 90% y cementemosla asi"; "from about 70% propose the cut"; "no quiero que el modelo corte siempre a los 70% sino que termine y termine bien ya si roza el limite ahi si lo paramos y compactamos ... siento que depronto el modelo se detiene antes y me gusta que haga bien el trabajo"
- one-prompt-per-reply: "permiso para gastar 1 revisión de Codex"; "acá, en este chat"; "yo corro todo; vos no ejecutás nada"; "Sí: corré la revisión lean en Codex 0.160.1"; "¿cómo así me pedís correr algo en Codex?"; "Tu turno: enviá esto"; "si el siguiente prompt es sí, seguí trabajando, no pares, solo pará si es una decisión que debo tomar"; "slices apilados a main"; "cadena sobre la rama"; "me dices que diga si pero no me explicas antes exactamente a lo que estoy diciendo si"; "quiero que la próxima vez seas más claro, detallado pero conciso para poder tomar rápido una solución y recuerda que todas estas decisiones siempre tocan el harness"; "a commit is running"; "tu sí anterior sigue valiendo para X; lo que cambió es Y"; "exactly one prompt"; "Qué es / Dónde / Qué pasa"; "Before the next prompt, always give Sebastián a short plain recap — what was done, what comes next, and why"
- orchestrator-autonomy-charter: "abrilas vos cuando yo te lo pida"; "abrí JH 7 en la barra"; "¿Dejás que el lead aterrice código en main con merge-queue --land sin preguntarte cada vez, una vez que gentle-ai, Codex y la suite den verde?"; "Sí, solo si traba"; "His standing rule (2026-10-14): an AGENTS.md change that implements a correction he ordered, green on gate, Codex and GitHub and inside the 1,500-token budget, merges without asking him; he is told after, with the link and his ordering line"; "Sí, para correcciones ordenadas (Recomendada)"; "sessions and the orchestrator work without stopping; stop for Sebastián only for the seven things that are his, and name which one before asking"; "Recuerda que de igual forma yo tengo las sesiones en el celular a pesar que no este en el pc, asi que si necesitas puede pedirmelo para que me llegue la notificacion al celular pero TIENES QUE SER LO MAS INDEPENDIENTE Y AUTONOMO POSIBLE POR QUE NUNCA VA A SER LO MISMO YO ESTA PRESENTE EN EL PC QUE CUANDO TE DEJO SOLO Y ESTOY EN LA CALLE CON EL CELULAR"
- questions-with-buttons: "Para que no se me pase ninguna"; "So none is missed"; "had not just written"; "He has just written"; "todas las preguntas de todas las sesiones me las haces aca ... te pasa la pregunta aca y yo te la respondo aqui y le pasas la informacion. SIEMPRE debe ser asi"; "a question waits, write and I put it"; "a question to Sebastián is asked with AskUserQuestion (tappable options, recommended first, \"; "), one a call; the fenced block is the fallback; the full record is questions-with-buttons"
- review-consent-pregranted: "siempre deja que Gentle AI revise"; "nothing persisted, never latched"
- session-housekeeping-reminder: "y JH6 en que esfuerzo?"; "no entiendo que hay que hacer en el jh8"; "no running Claude Code process"; "The lead archives sessions itself, without asking: the old lead after a handover, and any session whose work is fully finished"
- status-report-protocol: "debe haber un protocolo asi que cuando te diga como vamos ... tu contestes la informacion desde la ultima vez bien detallado"

## Log
- L1 (2026-10-22) The brief from the lead (JH ORQ), verbatim in its task part: "In D:\js-harness, make it impossible
  for a rule Sebastián states to live only in Claude's memory folder (C:\Users\Oficina\.claude\projects\D--js-harness\memory\)."
  followed by S1-S4 and "Done when: the guard test refuses a bare feedback note and allows one naming a rule that
  `rules check` finds, `npm run check` is green, and no feedback note in that folder states a rule absent from the repo."
- L2 (2026-10-22) His words of S1 are in no transcript on this machine: `grep -rlF -e "se deja en memoria" -e "las
  cemente" -e "guardando en memoria" --include=*.jsonl` over `~/.claude/projects` found only this session's brief.
- L3 (2026-10-22) Reading of "an AGENTS.md phrase that rules check can find": the note quotes, on a line that names
  AGENTS.md, a phrase of at least `rule:control-phrase-min` characters that AGENTS.md holds (whitespace squashed, as
  `rules check` matches phrases). "A rule id": a live rule declared in `bin/lib/rules-data.mjs`, whose source is in
  `docs/rule-sources.json`, named as `rule:<id>` in backticks. A project's `docs/rules.json` is not read: the check is
  in force only where the rule memory-feedback-home is, of scope repository, so only in this repository, which has none.
- L4 (2026-10-22) With his words in no transcript (L2), `rules change` cannot source a rule of his (it reads each
  quotation from its transcript), so the rule memory-feedback-home is declared with owner `project` and this document as
  its design source; the lead was asked for the transcript and may re-own it with his words. A `--memory <folder>` form
  of `guard` reports the folder's notes, so the last line of "Done when" is a command.
- L5 (2026-10-22) gentle-ai review of b7fe2955..73f61b9f (escalated: item 2, a guard; lenses risk and reliability):
  approved, acknowledged (lineage review-51c9cc810418a5ba), four advisory findings. Fixed after it: a note's type is
  read before any module loads (`memoryNoteType` moved to the zero-import memory-index-guard.mjs), `guard --memory`
  reports a note it cannot read instead of throwing, and the help no longer says every form exits 0. Not taken: "the
  bundled RULES may differ from the project's file" — `ruleHere` gives the rule's value only when the project's list
  is the running copy's, so where the check is in force the two are the same list.
- L6 (2026-10-22) Codex on 50c56ed..3a5bd48: "the patch is correct" (0.87), no findings; recorded. The lead confirmed
  it has no transcript line for his words either: owner project with the design source stands.
- L7 (2026-10-22) Paused for a Claude Desktop update, at the lead's request. State for a resume: T1 done and reviewed;
  T2 under way. Five read-only explorers mapped the 23 feedback notes (restart-announce-caps.md already names
  rule:restart-announce); only group 2 finished, its map saved to the lead's side-session-notes folder as
  memory-feedback-home-map-g2.json (cross-session-prompts, no-unread-flag, proof-is-a-condition, hours-are-read,
  heredoc: 13 rules, 8 with his verified words, 5 the agents' own lessons, every one with a home in the repo). Groups
  1 (orchestrator-autonomy-charter, status-report-protocol, review-consent-pregranted, one-sample, conflict-merge),
  3 (guide-not-literal, mistake-report, double-review, background-tasks, phone-cannot-open, session-housekeeping),
  4 (dogfooding, ask-before-he-leaves, questions-with-buttons, notify-when-done) and 5 (one-prompt-per-reply,
  effort-by-kind-of-work) were stopped and are to be run again. Plan for T2: one prose rule per note (its main home as
  path, his quotes as source; owner project with a design source for an agent's own lesson), declared on this branch
  with `rules change`, then `memory plan`, the notes shrunk to pointers naming `rule:<id>`, `memory verify`, and
  `guard --memory` to exit 0; the notes that are only agents' lessons go to the lead as one deletion list.
- L8 (2026-10-22) After the restart the lead asked that the rule change land promptly, since its own rule change
  (rule/question-context) waits behind it, one open at a time. So T1 goes out alone in the pull request of
  rule/memory-feedback-home, and T2, which declares rules of its own, runs on a new rule/ branch once the lead's has
  landed, from L7's plan.
- L9 (2026-10-22) gentle-ai: 73f61b9f..3a5bd482 (the fix of L5's findings) assessed medium by the commit's gate,
  review_due false (under_budget, 102 lines); no review due, none started. Codex covered it (L6).
- L10 (2026-10-22) PR 505 landed T1. rule:question-context landed on main b7eb9349 (PR 507), so T2 starts on the
  branch rule/memory-feedback-move from it. The four stopped explorers (groups 1, 3, 4, 5) were resumed; their maps
  land in the session's scratchpad as map-g1.json, map-g3.json, map-g4.json, map-g5.json, beside group 2's
  (also copied to the lead's side-session-notes folder). Next: L7's plan.
- L11 (2026-10-22) T2 done on rule/memory-feedback-move. Twelve rules of his declared with `rules change`, one commit
  each (259dec8b..b0aa1e41), each holding every typed quote the explorers verified for its note and a reading that
  names the note's other homes; notes whose rule was already declared name it (double-review, questions-one-place,
  question-context). What the notes held beyond the declared rules is in "Moved out of memory" above. Memory pass
  20261022T233738619Z: 14 notes shrunk to pointers naming `rule:<id>`, review-consent-pregranted to a pointer quoting
  AGENTS.md, and 7 notes holding no rule of his retyped (6 agents' lessons to project, the phone note to reference);
  `memory verify` passed and `guard --memory` on the folder exits 0 from this branch ("every feedback note names its
  home (16 feedback notes)"). Until this branch lands, main's copy declares none of the twelve ids, so `guard
  --memory` run from main fails: it should land promptly. Deletion candidates for the lead: the six retyped lessons
  (one-sample-is-not-a-diagnosis, conflict-merge-costs-review, no-unread-flag-on-a-writing-command,
  proof-is-a-condition, hours-are-read-not-guessed, heredoc-eats-backslashes). Next: T4.
- L12 (2026-10-22) gentle-ai: b7eb9349..0ef3e980 (the twelve rule commits 259dec8b..b0aa1e41 and the document commits)
  assessed medium, review_due false (under_budget); no review due, none started. Codex on 1aafa5c..0ef3e98, 2 parts:
  "the patch is correct" (0.93 and 0.87), no findings, 197,246 input tokens; recorded. T4 done.
- L13 (2026-10-22) PR 508 landed T2 and T4 (eb2ed9c4). The deletion list went to him through the lead, who reports he
  approved five (Pregunta 47). Deleted: no-unread-flag-on-a-writing-command, proof-is-a-condition,
  hours-are-read-not-guessed, heredoc-eats-backslashes (memory pass 20261023T034512749Z, verified). Kept:
  conflict-merge-costs-review, which memory verify refused because its quotation and its lesson (check git merge-tree
  before merging main, and on a conflict move the change instead) are in no home of the repository, and
  one-sample-is-not-a-diagnosis, also in none. Both are agents' lessons, retyped project, so the guard does not read
  them and no rule of his is left in memory. The list was wrong about these two: it said the repository carried them,
  while group 1's map gave one-sample no home, and gave conflict-merge only the review-scope phrase of
  bin/lib/codex-review-turns.mjs, not the merge-tree technique. Before a list of notes to delete is sent, run
  its quotations against the homes, as `memory verify` will, so that the list is not wrong.
- L14 (2026-10-24) His words of 2026-10-24 (transcript 908805db, line 26478) on a pause for a restart or an update: rule:restart-announce amended (a900807e) and rule:reuse-first added (e766e853), each by `rules change`; a6b17b46 merges origin/main between the two runs, which the command requires. Searched first: `js-harness rules`, protocols 4 and 8.
- L15 (2026-10-24) gentle-ai: a900807e and e766e853 (d21810e7..e766e853) assessed medium, not due (under_budget), by `gentle-ai review assess --base-ref d21810e7 --committed-only`; Codex: correct (0.91), recorded. PR 551.

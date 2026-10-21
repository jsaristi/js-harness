# Conventions: written, checked, and only shrinking where they do not hold yet

Locator: `odd/tasks/conventions.md` · Engram mirror: `odd/conventions/tasks` · Branch: `feat/conventions`
Delivery: one pull request, work-unit commits per check (part 1 of 2; part 2, onboarding profiles, waits for onboarding v4).
Test runner: `node --test`.

## Goal
The conventions js-harness follows by habit are held where code is written: each by a test in `bin/` that states
it in its header, by a review line, or by a declared rule, and each test's list of files that do not comply yet
can only shrink.

## Why
Sebastián felt the harness reads like a "frankestein": parts written one way and parts another, with nothing that
would make a future model, or a different one, write the way the rest is written (L1, L2). A read-only explorer
found the code mostly uniform by habit (151 of 151 files open with a header comment, named exports, `node:test`,
exit 2 on a usage error) and real drift exactly where no rule exists: the wording of a refused flag, how an error is
signalled, and how shipped text names the person. Two reviewers cut the first draft: no conventions document,
because it would restate the rules and is not read at write time; checks, a review checklist and a ratchet instead.

## Done when
- `node --test bin/conventions-arguments.test.mjs bin/conventions-errors.test.mjs bin/conventions-pure.test.mjs bin/conventions-voice.test.mjs bin/lib/ratchet.test.mjs` exits 0
- `node --test bin/lib/protocols-skill.test.mjs bin/lib/codex-review-prompt.test.mjs` exits 0
- `npm run check` exits 0
- Each convention is named with how it is held (S2 to S6), and the roadmap has the item.

## In scope / Out of scope
- In: new tests in `bin/` and `bin/lib/ratchet.mjs`; the wording of the refused flag in the commands that say
  "unknown flag"; the one shipped line that names the user "his"; the review prompt texts; the protocols skill;
  `docs/ROADMAP.md`; this document.
- Out: a `docs/CONVENTIONS.md`; prose line wrapping; feature-document headings (gentle-ai owns them); codifying file
  size or comment density; any formatter or dev dependency (decided 2026-09-30, ROADMAP "Sensors"); onboarding
  profile edits (part 2); sweeping the files on a legacy list (JH 36 edits onboarding files in parallel).

## Constraints
- Every convention lives in one place, where it is enforced, labelled `test: <file>`, `review`, or a rule value in
  `bin/lib/rules-data.mjs` — because a rule written twice drifts (ROADMAP, "Declared rules").
- A legacy list only shrinks: a check fails for a file off the list that breaks the rule, and for a listed file
  that already complies — because otherwise the list goes stale and a fixed file can drift back unseen.
- The repository is public: no client project names or personal data in it.

## Ask me before
Nothing beyond the plan Pregunta 40 approved; a product decision goes to the lead.

## Specs
- S1. Sebastián (L1, L2): uniformity held by written rules from the start, for code paradigm and each kind of text,
  so it survives a different future model; "como verificamos que de ahora a futuro va a ver uniformidad, sobretodo
  cuando no es mismo modelo a futuro? y no solo codigo sino tambien la documentacion y demas cosas."
- S2. `test: bin/conventions-arguments.test.mjs`. Every command the dispatcher's `--help` lists refuses an unknown
  flag with exit 2 and the line `unknown argument: <token>` on stderr. The list of commands is read from
  `js-harness --help`, never written by hand. Changing a message is a CLI contract change (Risk item 3): what reads
  those strings is checked first.
- S3. `test: bin/conventions-errors.test.mjs`. The error split as it already is: a command signals a usage error by
  throwing its own `<Name>ArgError` at the edge, and turns it into exit 2; a module under `bin/lib` declares no
  `ArgError` and never calls `process.exit`, so it returns what it found (an expected failure as `{ error }`) and
  the command decides the exit. Only what a test can see is checked.
- S4. `test: bin/conventions-pure.test.mjs`. "Pure" means imports no `node:fs`, `node:child_process`, `node:net` or
  `node:os`. A module under `bin/lib` whose header comment says it is pure holds that, by its direct static imports.
- S5. `test: bin/conventions-voice.test.mjs`. Shipped text, the skills `install` writes (`bin/lib/manifest.mjs`,
  `bin/lib/protocols-skill.mjs`), names the person "the user": never by name, never "he", "him", "his", "the owner"
  or "the person". `AGENTS.md` and the roadmap address Sebastián on purpose and are not shipped.
- S6. `review`: what no test can judge (paradigm: a pure core and thin I/O commands; voice; the precision of names)
  is a set of lines the Codex reviewer is asked to apply to each diff: `CONVENTIONS` of
  `bin/lib/codex-review-prompt.mjs`, ending every text of our prompt, in words that hold for any project (L6).
- S7. The protocols skill gains the trigger "writing a new command, module or doc", pointing at those checks; no
  new skill.
- S8. A ratchet: each check carries an explicit legacy list of files (or commands) that do not comply yet, each with
  why; it fails for one not on the list that breaks the rule and for a listed one that already complies.

## Tasks
| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S8 | inline | done | 2e65f295 |
| T2 | S2, S8 | inline | done | 2e65f295 |
| T3 | S3, S8 | inline | done | 10a7601d |
| T4 | S4, S8 | inline | done | 10a7601d |
| T5 | S5 | inline | done | 10a7601d |
| T6 | S6 | inline | done | this commit |
| T7 | S7 | inline | done | 35cbdcec |
| T5b | S2-S5 | inline | done | a1ba5c61 (the review's advisory findings) |
| T8 | S1 | inline | open | |

- [x] T1 (kind: build) `bin/lib/ratchet.mjs`: the one comparison every legacy list uses
- [x] T2 (kind: build) the refused-flag wording and exit 2, with its legacy list; "unknown flag" becomes "unknown argument"
- [x] T3 (kind: build) the error split
- [x] T4 (kind: build) pure modules hold their claim
- [x] T5 (kind: build) shipped text names the user
- [x] T6 (kind: build) the review lines
- [x] T7 (kind: docs) the protocols skill's trigger
- [ ] T8 (kind: docs) the roadmap item, reviews, the pull request

## Open for part 2 (onboarding profiles)
- A range of code alone is reviewed with `codex exec review --base` and Codex's own sentence, which takes no prompt
  of ours, so it does not get `CONVENTIONS`. The two ways to close that gap, to put to Sebastián then (L6):
  - B: make `--prompt own` the default, so every review gets the lines. It changes every installed project's
    review, which is his call; on 2026-10-08 the two prompts found the same seeded defects at about the same cost.
  - C: a checklist each project declares, read into our prompt; it fits once onboarding writes each project's
    conventions ADR.

## Log
- L1. Sebastián, the lead's transcript `908805db-d0b9-4c2f-a9e6-f828b6bf1e41`, line 14626 (2026-10-21T05:18Z), read
  with `js-harness sessions --quote`: "hay algo que creo que falle desde un principio y es que siempre pero siempre
  se veben crear para todo tipo de proyecto unas reglas ejemplo de como debe funcionar todo el formato por ejemplo
  este que es un harnes, como deben ir los textos de todo dependiendo si son reglas protocolos, etcetera etcera si
  me entiendes? lo mismo si se va a hacer codigo hay es como se va a programar si funcional o declarativamente y
  cuales van a hacer sus reglas desde un inicio, osea que te parece que en un principio se genere un orden en
  general dependiendo del proyecto que se haga? que propones ya que mi idea e sun poco escueta es que siento que una
  parte del harnes esta escrito de una forma y otra parte de otra forma y a la final termina siendo un frankestein
  me entiendes, osea no hay uniformidad como si lo hubiera hecho un solo programador o un equipo de trabajo con
  reglas definidas ya que siento que un futuro modelo va a escribir de la manera como se le de la gana tipido de los
  programas grandes y viejos que tanta gente le ha metido la mano que cada uno ha escrito lo que ha querido y es un
  sancocho de codigo muchas veces sin sentido y que funciona de una manera magica y contradictorio pero que todo
  pende de un hilo y no tiene logica aunque funcione."
- L2. Same transcript, line 15064 (2026-10-21T06:06Z): "Entiendo que estos modelos de la categoria 5.5 el harnes
  que necesitan no es tan restrictivo ya que trabaja siguiendo la uniformidad de estilo que ya viene manejando osea
  sigue mejor los lineamiento qen lo que esta construido lo anterior y es por eso que el system prompt se redujo ya
  que es mas inteligente a la hora de saber como hacer mejor las cosas, pero me gustaria saber si se va a hacer
  codigo desde cero, como verificamos que de ahora a futuro va a ver uniformidad, sobretodo cuando no es mismo
  modelo a futuro? y no solo codigo sino tambien la documentacion y demas cosas." Line 15082 (06:09Z), Pregunta 40,
  "Convenciones desde el inicio: ¿arranco la versión revisada (tests y checklist de revisión con trinquete en
  js-harness ahora; los perfiles del onboarding después de v4)?", he tapped "Sí, arrancala (Recommended)".
- L3. 2026-10-21, measured before building. Every command `--help` lists, run with `--no-such-flag` in a scratch
  home: all but two exit 2; `backup status --no-such-flag` exits 1 and `permit list --no-such-flag` exits 0, the
  flag ignored. Wording: "unknown argument: <token>" in most; "unknown flag: <token>" in `init`, `install`, `sync`,
  `uninstall`, `status`, `remote`; another sentence or only the usage in `loop`, `throughput`, `windows-daily`,
  `merge-queue`, `guard`, `reply`. What reads "unknown flag": only tests (`bin/install.test.mjs`,
  `bin/remote.test.mjs`, `bin/update.test.mjs`), searched with `rg "unknown flag"` over `bin`, `docs`, `README.md`.
  The review prompt: by default `codex-review` runs `codex exec review --base`, which takes no prompt of ours, and
  `bin/lib/codex-review-prompt.mjs` ships to every project, so js-harness's own style cannot be hardcoded there;
  `AGENTS.md` stands at 1497 of 1500 tokens. Asked the lead where the lines go (A: generic lines in our prompt texts;
  B: A and `own` as the default; C: a project-declared checklist).
- L4. 2026-10-21. T7 adds section 8 to the protocols skill. Section 7 names a protocol change among the
  user's decisions; this one is item 5 of the plan Pregunta 40 approved (the lead's brief), so it is not asked
  again. The skill ships to every project, so the section is written for any project and names js-harness's own
  tests as its example. docs/SPEC.md counted the skill's seven protocols; with section 8 it counts eight.
- L5. 2026-10-21. gentle-ai reviewed 81305126..35cbdcec (risk raised to high by item 3, the refused-flag wording;
  lenses risk, readability, reliability), approved, acknowledged (lineage review-5dcdab3bc54a7d23). Eight advisory
  findings; the fixes commit takes: the comment test reads inline text instead of a comment in another module; a
  probe that times out says so; `seen` renamed `printed`; the import pattern stops at a quote; the skill header
  says "not eight"; this L4 restated. The probes are read-only forms, now said where they are listed.
- L6. 2026-10-21, the lead's answer on where the review lines go: "take A. Add the generic lines to our three
  prompt texts, with their version bumps, and leave the default `--base` unchanged. Write in your feature document,
  as an open item for part 2 (onboarding), that code-only ranges miss the lines. Also write B and C there as the
  options to put to him then. A project checklist (C) fits naturally once onboarding writes each project's
  conventions ADR. Making `own` the default (B) changes every installed project's review, so it is his call and not
  ours now." Built: `CONVENTIONS` ends the whole-range (v2), part (v4) and merge (v3) texts, before what a review
  out of a gate turn is told of the tests.

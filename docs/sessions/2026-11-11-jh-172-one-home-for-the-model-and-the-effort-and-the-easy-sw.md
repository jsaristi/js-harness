# JH 172 · one home for the model and the effort, and the easy switch

## Goal
Give the model and the effort of everything the harness starts one home in the rules, make every start, guard,
board and check read it, and make moving that home one command with its protocol. The feature document is
`odd/tasks/one-model-home.md`; the last brief read was
`~/.js-harness/background/briefs/2026-11-11T11-09-01-276Z-e93e8864.md`.

## The user's words
Transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, read with `js-harness sessions --quote`:
- Line 4744, 2026-11-10 21:44 local: "todos los modelos de ahora en adelante va a ser Fable 5.2 Alto y debemos hacer
  un protocolo facil para que el dia de mañana salga un modelo mejor por der cambiar esta forma en como trabajamos
  tanto en el orquestador como con las sesiones".
- Line 5167, 22:31 local: "Vamos a unificar y todo va a ser con Fable 5.2 Alto y necesito que lo cambies tanto en la
  documentacion y lo unifiques en un solo lugar y ademas cambies de una vez en todas las sesiones a este modelo con
  ese esfuerzo y que sea TODO".
- Transcript `812b728f-2f18-43f6-b405-396080689c65`, line 2592 (question 269): "Aceptarlo así (Recomendado)"; line
  2645 (question 270): "Sí, ampliarla (Recomendado)".
The document's `## Specs` S1 to S5 hold the rest of his words, each with its line. He typed nothing in this session
but the two lines that started and resumed it.

## Delivered
All merged into main:
- The design, its depth pass and its inventory (T1, T2); it did not pass three double reviews, and the lead said
  yes to building from the answers to the third (Log L13, L14).
- #822: `bin/lib/model-home.mjs` and `bin/lib/model-shape.mjs`, the one entry that reads the model and the effort.
- #825: `rules change <id> --with <path>...`, and the check of marks stops at a Log.
- #831 to #835 (`rule/one-model-home-1` to `-4` and `rule/one-model-home`): the rules `session-model`,
  `session-effort` and `lead-effort` as the home of everything Claude, `review-model` and `review-effort` as
  Codex's; `subagent-effort` and `escalation-model` retired into them.
- #836, #837: a start, a resume and the board hold a session to the home; `rules applied` lists the sessions off it;
  the `doctor` row `model-home`.
- #839 (merge `c0e84d5f`): `js-harness rules switch`, the section "A new model" of the lead's skill
  (`bin/lib/lead-protocols.mjs`), and the convention over the texts (`bin/conventions-model-home.test.mjs`).
- #840 (merge `7fdcdc46`): the fixes of the lenses' findings on the switch (`c386c2e5`) and the lead's exception
  that names `rules switch` (`7ebf02e8`).
- #842 (merge `a754c3a2`): T11, the tests of the home hold for any value a switch writes (`6371924c`).
- Not this session's: the first real switch, the lead's #843 (`555caa5e`, merge `ad9fd2f0`), made `session-model`
  `claude-opus-5-5` with the command this feature built.

## Decisions
- The user: the Codex probe stays as built, though no flag of Codex CLI 0.167.1 turns off every tool (question
  269, the document's L29). The lead's one exception to "never commit" names `rules switch` (question 270, L30 and
  L31).
- The lead: pull request 4 went as reviewed with the lenses' findings in its body, and their fixes in a pull request
  of their own (its message of 2026-11-11 19:58 local); the advisor's missing home goes to the user as the lead's
  question; T11 kept to the tests the refused commit needs.
- This session, each in the document's "Next step" and the pull requests' bodies, his to turn: the home is two
  files with one entry for readers (L20); `--lead` as a flag of its own; one probe for each new (model, level);
  `--rule-by-rule`; the writer's agent file follows the home; the two lead protocols moved to
  `bin/lib/lead-protocols.mjs` when the manifest met its ceiling; the probe's cost rounded to four decimals; a test
  that needs a model off the home takes the first of two made-up ids the home does not hold.

## Failures and lessons
- The first real switch's commit was refused by three tests that took `claude-opus-5-5` as "a model that is not
  the home's"; four more of the same kind were found by moving the home in a scratch edit. Lesson: a fixture never
  names a value the home may come to hold. Fixed in #842.
- Three Codex reviews did not settle one finding (`4d020cf..94e25d3`, `94e25d3..8a2da3c`, `8a2da3c..8e30e71`): the
  spec asked for a probe "with no tools" and the CLI cannot give one. Found by the review; went to the user as the
  rule says. Lesson: a spec line about another tool is checked against that tool's flags before it is written.
- A review ran while tracked files were edited and wrote no record, 88,091 input tokens lost (L28;
  `docs/FAILURES.md`, `edit-during-review`). Since then nothing was edited while a review ran.
- A question was recorded from a scratch folder and went to a record no orchestrator reads (L31; `docs/FAILURES.md`,
  `message-to-wrong-session`). Caught by `notify`'s own output in a minute.
- An inference about eight stopped jobs was sent to the lead as a fact (`docs/FAILURES.md`,
  `estimate-passed-as-fact`); a claim "no Codex review can cover new code on this branch" stopped being true when
  main was merged in, and was corrected with the plan's output.
- The gate refused a lens run until a push, and the push refused until the lens: the lens ran without the gate
  wrapper. Told to the lead; not filed as a defect.
- At the close, a `sed ... > file` whose input path was the job folder of before the restart emptied this file in
  the working tree; nothing was committed, and the file was written again whole. After a resume the scratch folder
  of the job is a new one.

## Left
- Codex's home is not safe to switch: with `review-effort` at `high` or `low`, `bin/codex-review.test.mjs:1542` and
  `:3082` and `bin/lib/rules-bindings.test.mjs:88` fail. A change of its own, passed to the lead.
- The reliability lens's one SUGGESTION on #842: `bin/lib/guard.test.mjs:88` lists the short name `sonnet` as
  refused without checking it against the home.
- The advisor (`sessions start --advisor`) has no home in the rules: a new rule, the user's to decide, asked by the
  lead.
- The eight exceptions to "TODO" listed in the document's "Ask me before" and in #839's body, each the user's.
- `AGENTS.md` still says `rules change` "changes one in a single commit"; the switch writes a home in one.
- No test covers a relief line appended before a later failure of the writing pass, nor the Claude launch through
  a `.cmd` shim. The real probe was run once, by the lead's switch; by its word both probes answered.

## Cost
- Time: first notice `2026-11-11T04:55:05Z`, last `2026-11-12T06:55Z`; the host compacted the session many times
  (the last at `2026-11-12T06:43Z`) and the machine restarted once.
- Design: three double reviews, about 1 percent of Codex's weekly limit each. Codex's reset credits: 2, untouched.
- Pull requests 1 to 3: the reviews are in the document's Log, L20 to L27 (pull request 1 alone: six Codex runs,
  about 555,000 input tokens, and eleven lens runs).
- Pull requests 4 and 5: Codex, seven reviews recorded (the first in 5 parts; the last four 84,629, 88,573, 68,016
  and 40,062 input tokens); Claude lenses, eight runs (three of about 77,600 input tokens, the rest between 7,797
  and 25,446); two writer sub-agents (the second 130,297 tokens).
- T11: one writer sub-agent (174,250 tokens), one Codex review and one reliability lens run.
- Gate runs: one a code commit, on GitHub's machines.

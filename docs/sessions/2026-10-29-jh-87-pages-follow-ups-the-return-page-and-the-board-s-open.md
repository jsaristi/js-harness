# JH 87 · Pages follow-ups: the return page and the board's open questions

Started in the background by the lead with `js-harness sessions start`; brief
`~/.js-harness/background/briefs/2026-10-29T14-44-45-697Z-c30477b3.md`. Branch `fix/pages-follow-ups`, base main
`f68d869f`, worktree `.claude/worktrees/pages-follow-ups`. Small work by the resume test (each unit named with its
place and outcome in the brief), so no feature document of its own; T13 to T16 are written in
`odd/tasks/visual-pages.md`. All four units went in one pull request: none was in review when unit 4 started.

## Goal
Four follow-ups of the visual pages: the return page's failures say why from their own records; the return page says
when it was made and how long ago; the stale T5e comment beside the start row; and the board lists every open
question from the record, so the lead no longer writes them by hand.

## The user's words
Both read with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f <line>`:
- line 21871, 2026-10-29T14:00:41.916Z: "Colocame en ese regreso del tramo de hace cuanto se genero".
- line 21816, 2026-10-29T13:57:26.001Z: "siempre colocame las preguntas aca y cuando hayan preguntas viejas que no he
  respondido, colocamelas en el tablero como todo o tareas para yo podertelas pedir por que me queda muy dificil
  adivinar o estar pendiente de todas las sesiones".

## Delivered
- `0afde877` fix(stretch): say why a land or a Codex run failed. `stretchLost` (`bin/lib/stretch.mjs`) writes "land
  exit N: <said>" and "Codex review failed: <reason>" when the record holds them (#671 carried both), the bare words
  otherwise; the prefix stays, so `stretch-why` still names each failure's source by it. Test: "a failed land says the
  last line it printed and a failed Codex run the reason it was logged with" (`bin/lib/stretch.test.mjs`). T13.
- `1b67e494` feat(stretch): say when the return page was made. `page` (`bin/lib/pages.mjs`) takes an optional
  `generatedAt`: "Generada el <UTC time>" from the time `emit` (`bin/stretch.mjs`) writes the file, and an inline
  script that counts "hace N min" where the page is shown, again each minute; it carries `agoText`'s own source, so
  the words are the tested ones. The return and the open stretch's status page pass it; the reports do not, unchanged.
  Tests: two in `bin/lib/pages.test.mjs` (the script run in `node:vm` with a clock 2 h 15 min later reads "hace 2 h 15
  min"; `agoText`'s words) and "the return says when its page was made: show, a day later, …"
  (`bin/stretch.test.mjs`). T14.
- `0c2c3972` docs(sessions): the comment beside the start row (`bin/sessions-background.mjs:236-238`) now says the
  board keeps the newer state by time, so a notice appended between the read and the append stays ahead of the row.
  Comment only; its behavior is T5e's test. T15 (its task line rode in the next commit).
- `89d0aa50` feat(board): list the open questions from the record. `sessions live --out` puts `questions` in the stamp
  it merges into `board/summary` (`openQuestions`, `bin/sessions-live.mjs`): each question nothing closed, oldest
  first, `{ number, from, at, row, text, ask }`, `ask` being "hazme la pregunta N"; an empty list clears those
  answered since. The board lists them under "Lo que te toca" after the lead's `yours` and the sessions asking now
  (`yoursItems`, `docs/live-board.html`), and its "Cómo leer" says so. Tests: the stamp's questions and the board's
  list (`bin/sessions-live.test.mjs`). T16.
- `413f0d79` fix(board): say a session's question once by its row, not its time (Codex's P2, below).
- This summary.

## Decisions
- This session: the "hace" is computed by a script in the page, not at render time, since his page is looked at
  later than it is made; with no script the time alone shows.
- This session: generation time only on the return and the status page (`renderReturn`), the page his words name;
  the departure and the reports keep their pages as they were.
- This session: the record's question text goes on the board as written; a question numbered by hand before the
  record refused it ("Pregunta 56: …") loses that prefix. Some are in English (question 97); not translated.
- This session: no independent verifier. No record format changes: the stamp and `board/summary` gain an optional
  `questions` field that only the board reads, and the board reads a summary without it as none.
- This session: `bin/sessions-live.mjs` taken as inside the brief's "bin/lib/sessions*.mjs for `sessions live`",
  since that file is the `sessions live` command.
- Asked of the lead, not done (outside the surface): the orchestrator's block (`bin/lib/manifest.mjs`) should say
  that "hazme la pregunta N" is answered with `js-harness template ask N`, and that the old questions are no longer
  written into `board/summary.yours` by hand.

## Evidence
- Each new test fails on main's code and passes on the branch's: a copy of HEAD's tree outside the worktree (`git
  archive`), main's `bin/lib/stretch.mjs`, `bin/lib/pages.mjs`, `bin/lib/stretch-render.mjs`, `bin/stretch.mjs`,
  `bin/sessions-live.mjs` and `docs/live-board.html` put in place, the branch's tests unchanged. Branch: stretch 1/0,
  pages 2/0, stretch command 1/0, sessions-live 3/0 (pass/fail). Main: 0/1, 0/1 (the import of `agoText` fails), 0/1,
  0/3. Run at `89d0aa50`; the fix's two changed tests failed before `413f0d79` and pass after (15/2, then 17/0).
- The real record holds 111 questions, 19 open (56 to 72, 96, 97), read with `readNotices` and `recordedQuestions`.
- `npm run check` through the pre-commit gate: PASS on each of the five commits.
- Reviews. Codex on `f68d869..89d0aa5` (gpt-6.1-sol, medium): one P2, the patch incorrect (0.88), 174,128 input
  tokens: deduplicating a session's asking line by the time alone hid another session asking in the same
  millisecond. Fixed in `413f0d79`; Codex's recheck of `89d0aa5..413f0d7`: fixed, the patch correct (0.98), 33,389
  input tokens. Claude lenses on `f68d869..89d0aa5`: reliability and readability, complete, 0 findings (17,217 and
  35,285 input tokens); on `89d0aa5..413f0d7`: reliability, 0 findings (14,647).

## Failures and lessons
- Codex's P2 (above): a time is no notice identity, which `pendingRows` already says; the question now carries its
  row's id. Found by the review, fixed before the pull request.
- The worktree guard refused a heredoc append and a `node` call with a computed path; Edit and a script file under
  the job's tmp did the same.
- Nothing for `docs/FAILURES.md`: no defect reached main.

## Left
- The orchestrator's block (`bin/lib/manifest.mjs`): "hazme la pregunta N" means `js-harness template ask N`; the
  lead's hand-written questions in `board/summary.yours` can go (the lead).
- A question answered after the lead's check stays on the board until the next `sessions live --out`; the board's
  help says so.

## Cost
- Time: brief at 14:44Z, this summary at about 15:20Z.
- Gate runs: 5, all passed.
- Reviews: Codex 2 runs, 207,517 input tokens (estimates 120,000-180,000 and 68,000-100,000); the Claude lenses 2
  runs, 3 lens results, 67,149 input tokens. No eval spend.

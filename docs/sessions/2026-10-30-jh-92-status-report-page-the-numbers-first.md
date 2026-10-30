# JH 92 · Status report page: the numbers first

## Goal
Make the status page (`js-harness report --html`) show, at its head and before any commit or session, the numbers he
asks for: the migration's share now and at the cut, the map's total and the last stretch's goals each sí or no; fold
each pull request's commits and each phase's long "lo que falta"; read well at 375 px. Opened from the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T03-26-59-116Z-dc187388.md`, main at 91208fb8. Small by
CLAUDE.md's resume test (one renderer, no open decision, not high risk): no feature document.

## The user's words
- Lead transcript 0f71b2c6, line 26049, 2026-10-30T03:26:24Z (`js-harness sessions --quote`): "En la pagina como
  vamos no me aparece lo que me dices". The brief cited line 26074, which `sessions --quote` reads as an assistant
  entry; the files and the commit cite 26049.
- Line 25223 (JH 91's check of the brief's 25304): "no aparecio en el como vamos, ni el mapa ni los porcentajes si se
  cumplio la meta, no aparecio absoultamente nada de lo que planteamos".

## Delivered
- 40929961 feat(report): put the numbers he asks for at the head of the status page, on `feat/report-numbers-first`:
  `page()` (bin/lib/pages.mjs) takes an optional `top` after the bad news; `headHtml` (bin/lib/report-status.mjs)
  draws tiles from the facts `report` already reads (each plan now and at the cut, the map's total, the last stretch's
  goals met) and one sí/no line per goal; section 1 is one row a pull request with what it gives (its first `feat`
  commit, else its first) and its commits in `<details>`; `leftHtml` (bin/lib/pages-sections.mjs) shows each open
  roadmap item's first sentence cut to 160 characters, the whole item folded; the page's grid column, `overflow-wrap`
  and 150 px tiles keep it inside 375 px. docs/FAILURES.md: a second Seen line on `status-report-without-facts`.
- 4d7c212b fix(pages): fold a phase's item by its trimmed text, and pin the head's other cases (gentle-ai's R3-001,
  R3-002, R3-003 on 40929961).
- This summary's commit, and the PR.

## Checked, and how
- Tests first: the four new tests failed before the code (`node --test bin/lib/report-status.test.mjs
  bin/lib/pages-sections.test.mjs`: 4 failed), then 70 of 70 passed across the seven page and report test files.
- Planted break: with `top: ''` in `renderStatus`, the head tests failed (pass 8, fail 2); restored, 10 of 10 passed.
- Phone width: the real page rendered from this branch (`reportMain(['--html', ...])` with the rendered record
  stubbed, so nothing was recorded) inside a 375 px body in headless Chrome: `{"inner":375,"scroll":375,"wide":[]}`,
  no element outside a table's own scroll wider than 375 px; a screenshot showed the four tiles two by two, then
  section 1 with PR 683 on one row and "▶ 4 commits".
- The gate: the pre-commit `npm run check` passed on both code commits ("16 rows passed, 8 of them INFO"). The
  first try of 4d7c212b failed on GitHub's run: its test comments named gentle-ai, which
  `bin/lib/gentle-ai-absence.test.mjs` forbids outside its listed files; reworded, the next try passed.
- Reviews: Codex over 91208fb..4092996, "the patch is correct" (0.9, 146,184 input tokens), and over
  4092996..4d7c212 (0.98, 37,346); the Claude lenses readability and reliability over the first, 0 findings
  (38,615 input tokens), reliability over the second, 0 findings (12,193); gentle-ai approved both (lineages
  review-d89f56a3b157adaa and review-556b50726c3ef616), acknowledged.
- `js-harness failures` reads `status-report-without-facts` "controlled".

## gentle-ai
- 40929961 approved (review-d89f56a3b157adaa); 4d7c212b approved (review-556b50726c3ef616).

## Decisions
- The head is `page()`'s new optional `top`, after the bad news and before section 1: the six sections stay six, and
  section 4 keeps the detail (migration table, stretch, forecast).
- A pull request's "what it gives" is its first `feat` commit, else its first: the merge commits' bodies on main are
  empty (`git log --first-parent --merges --format='%s%n%b' -4 origin/main` printed only subjects), so no PR title is
  in git.
- The fold of "lo que falta" lives in the shared `mapSection` and `mapNowSection`, so the stretch, phase and feature
  pages gain it too; their tests still pass (70 of 70 across the page test files).
- The tiles' minimum width went from 180 to 150 px so two fit side by side on a phone (343 px of content).

## Failures and lessons
- The brief's transcript line was wrong a second time (26074 is an assistant entry; JH 91 found the same with 25304).
  Lesson, already JH 91's: check a cited line with `sessions --quote` before citing it.
- docs/FAILURES.md: a second Seen line on `status-report-without-facts`, its control now the new head test;
  `js-harness failures` reads it "controlled".

- A comment in a test file that names gentle-ai fails `gentle-ai-absence.test.mjs`: name the review by its lens.

## Left
- gentle-ai's suggestion on 4d7c212b: no test for an item with edge blanks and more than one sentence, nor for a blank
  item; and R3-001's abbreviations ("e.g." ends a first sentence early; the roadmap holds none). Not done: neither
  changes what he sees today.
- Not checked: the page on his phone itself, and as the Artifact tool wraps it; the lead's next `report --html` and
  publish is the first.
- The installed copy is not refreshed: the lead lands and refreshes.

## Cost
- Opened 2026-10-30T03:27Z; the ready notice for PR 684 at 04:04Z, then the closed notice.
- Reviews: Codex over 91208fb..4092996, 146,184 input tokens, and 4092996..4d7c212, 37,346; the Claude lenses,
  38,615 and 12,193 input tokens; gentle-ai's reliability reviewer twice (one lens a commit), its tokens not printed.
- Gate runs: one pre-commit `npm run check` per commit, five in all with the failed try of the fix commit and this
  summary's two, plus one `npm run check` before the first commit.

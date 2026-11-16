# JH 207 · una puerta de revisión honesta

## Goal
Make the review gate honest: an owed correction, a forged or partial record, or a review turned off must not read as
reviewed at the push, the merge door or the plain check. Opened by the lead, JH ORQ · orquestador F8, from its brief;
feature document odd/tasks/review-gate.md, branch feat/review-gate, pull request 896.

## The user's words
None in this session: the work came from the lead's brief and messages, quoted in the feature document's log (L1, L34,
L42, L56, L73). The owner was away; no question went to him.

## Delivered
- Pull request 896 (jsaristi/js-harness#896), ready for review. The first `notify ready` (2026-11-16T13:17:45Z) was held by
  the lead for e1b and L71 D (L78); both were fixed in 778ce2f7, and a no-HEAD regression of that fix the advisor's
  probe found was fixed after it (L81); the ready notice is sent again at the final head.
- S1-S7 (T2-T8): c07285b1, ffe89f69, 764d366f, 89e082af, a61d8627, 5fd3e493 and the commits after them (doc L1-L29).
- The verifier's first pass, F1-F3: 396dcef8, dcd3b9b3, b2b65864.
- The second pass, V1-V4:
  - V1: c3c95d63, 515be25a.
  - V4+V3: 4f9103fa.
  - V2: 4c8069dd, with its guard fix cfd546ba.
- The third pass, B and C: 3b41c3a7; e1b and D: 778ce2f7 and the L81 fix.
- Each was written tests first, and each got a Codex review and a review by the Claude lenses (reliability, risk).
- Last whole set: 9765 of 9802 passed, 0 failed, 37 skipped by platform; the names are in the lead's shared notes
  folder: C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_41e31b68-c8b2-4729-8c54-b1e701bb5a40/jh207-pr896-skipped-tests.txt
  (checked equal to the names of the final run).

## Decisions
- The lead:
  - F3 (L34) and question 312 (L42): a skip pays an owed correction only while the review is off.
  - Question 313 (L56): V2 goes in this PR; V4 is tightened.
  - Question 314 (L73): L71 A is left out of PR 896 and becomes T10.
  - On the ready note (L78): the land is held until e1b and D's message are fixed in this PR.
- This session:
  - V1's rules: R1 and R3, and R4 made strict after Codex's P1 (L57-L61).
  - V2's transition rule, counted first: 598 of 598 admitted are kept (L66).
  - B and C are fixed in this PR; D-G are written as notes (L71, L76).

## Failures and lessons
- **Local runs left out codex-review.second.test.mjs**, so GitHub refused a commit. Local runs now name both files (L41).
- **The plain row's cost test went over its git-process bound (14 of 12).** It was fixed by threading `where` through
  `correctionOwed`, not by loosening the bound (L63).
- **One gate run passed `bin/` as a file**, and it failed at once. The project's own `node --test` is run instead (L63).
- **My V3 reason in L62 was wrong for a merge at the tip.** The third pass found it (B), and it is fixed in 3b41c3a7.
- **L74's skip tally was off by one.** It was corrected in L76.
- **The first ready note named the skipped-tests file by its bare name**, and the lead could not find it; the full path
  goes in notes now (L78).
- **e1b's fix said "on at HEAD" where there is no HEAD.** The advisor's probe found it before the second ready; a test
  pins it now (L81).
- **The reliability lens warned that two counts came from different sets.** Answered without a change: both are read
  from the whole record log (L80).

## Left
- **T10 (spec 8, L71 A):** an honest `--again` over a clean sub-range clears an owed correction. It predates the
  branch. This session builds it from main after the land, as its own slice.
- **V2's cut:** it has not happened on the real log yet. The 5 old unnamed lens run lines stay nameable until the
  first record from the new writer (L66, L71 D).
- **A skip's reason:** whether it is the owner's words stays an open item, with no check (L56).

## Cost
- **Time:** from the first notice of this stretch to the ready notice at 2026-11-16T13:17:45Z.
- **Context:** compacted twice by the host; 70% of the context held at ready.
- **Codex, after the last compaction:** 112,392 + 209,756 + 34,764 + 114,698 input tokens. The weekly meter was at
  88%.
- **Lenses:** 4 runs of reliability and risk, each between 10,797 and 15,061 input tokens.
- **Whole-set gate runs:** 7 (the two after this list were green, 9764 of 9801, and the L81 run).
  - 1 failed at once on my command.
  - 1 timed out at 30 minutes.
  - 1 left 2 failures, which were fixed.
  - 2 were green.
- **Verifier:** one opus third pass, 196,176 tokens.

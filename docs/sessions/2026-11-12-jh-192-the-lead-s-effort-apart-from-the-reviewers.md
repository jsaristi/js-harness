# JH 192 · the lead's effort apart from the reviewers'

## Goal
Three slices given by the lead (JH ORQ · orquestador F8):
1. Split rule lead-effort from a new lens-effort.
2. Hold the Fable advisor setting in the doctor.
3. Add a senior session on Fable 5.2 high that the lead sends harder tasks.

A fourth piece came later, from the lead: the clean-home test failed on main and blocked the land of slice 3.

## The user's words
- 812b728f:1444 (2026-11-11): "Opus 5.5 Extra para orquestador ... Orquestador Senior que tenga Fable 5.2 Alto"
- 93b72703:775 (2026-11-12): "...debe haber un orquestador senior fable 5.2 alto que le manden tareas de ciertas cosas especificas que se requiera mas inteligencia o complejidad"
- 93b72703:896: "aplica todos los cambios ya"
- Question 273 (93b72703:1509), the option he tapped: "Separar y dejar en alto (Recomendado)"

## Delivered
- PR 851, slice 1 (lead-effort apart from lens-effort): merged 2026-11-12T18:48:58Z.
- PR 850, slice 2 (the advisor held in the doctor): merged 2026-11-12T18:12:34Z.
- PR 852, slice 3 (senior-model, senior-effort, the SR title, only the lead starts a senior and one at a time, the reporters hold a senior to its own home): merged 2026-11-13T01:04:37Z as b01a98e0. Its commits:
  - fd309617
  - 8fc7a92b
  - e25ab304
  - a258b450
  - 40089ace
- PR 853 (bin/clean-home.test.mjs runs with no tool of the stack on PATH): merged 2026-11-13T01:04:37Z as 8f4d051d. Its commits:
  - 7696fdee
  - ffb1f5e1
  - d1eee05a
- The feature document is odd/tasks/senior-orchestrator.md, with decisions D1 to D7.

## Decisions
These decisions are in odd/tasks/senior-orchestrator.md, in its Log:
- The design was kept lean and decided without asking him: the lead's instruction, from his "aplica todos los cambios ya".
- D6: no notice is addressed to a senior; `roleNamed` does not take SR, and the wake leaves it out.
- D7: SENIOR_HOME sits apart from CLAUDE_HOME, so `rules switch` never moves the senior.
- D3 and D4: only the lead starts a senior, one at a time. The record has no lock, so a race of two starts is accepted.
- A code SR stays valid for a project, after a review (40089ace). Only `codeOfName` declines to offer it.
- The clean-home fix went in a PR ahead of 852, not inside it: this session's choice, which the lead left to it.

## Failures and lessons
- **The cut-off status:** the host compacted this session at 17:39 local. The feature document had last been written before the context-pause notice. The resume hook flagged this, and the State was rewritten from the transcript.
- **Slice 3's first review:**
  - Codex found 2 defects: a background senior was judged against the home's advisor, and `rules switch` lost the senior's home.
  - The reliability lens found 3 warnings: `rules switch` lost the senior's home, `projectCode` broke the existing code SR, and the default app-record reader was untested.
  - All were fixed in 40089ace, each with a test, and the recheck was clean.
- **bin/clean-home.test.mjs on main a647c954:**
  - It inherited the machine's PATH: `stack upgrade` saw engram and codex behind their latest release, and the real `claude` wrote .claude.json into the throwaway home.
  - The test now drops the stack's folders from PATH and asserts that none of those tools is reachable.
  - Three review rounds:
    - quoted PATH entries;
    - a .cmd node shim that a spawn without a shell does not find;
    - git lost with a dropped folder, now found through `git --exec-path`.
- **Writing escaped text from Git Bash:** text with `\'` or `\n`, written through a heredoc into a Node script, reached the file unescaped twice. Escaped lines go through the Edit tool.

## Left
- The orchestrator skill's "A senior" section (T5). Its spans need entries in rules-coverage-data.mjs. The diff is `lead-protocols-senior.diff` in the lead's notes folder. Held by the lead.
- The rule texts of session-model, session-effort and advisor-model saying "every session but a senior". This is a rule change, one at a time. Held by the lead.
- "No advisor" for a senior is claimed only once the first senior's transcript shows it.

## Cost
- **Time:** 17:02 local (the lead's slice 3 instruction) to 20:06 local (the copy refreshed after the lands), on 2026-11-12. One host compaction.
- **Context:** about 60% at the end.
- **Reviews of slice 3:**
  - Codex: 2 parts, then a 1-part recheck.
  - The lenses (risk and reliability): two runs.
- **Reviews of PR 853:** Codex 3 runs and the reliability lens 3 runs.
- **Reviews of slices 1 and 2:** not counted here; they are in their PRs' records.
- **Gate:** one full local suite (9429 passed, 1 failed: the clean-home test, then fixed by PR 853), plus each commit's `npm run check`.

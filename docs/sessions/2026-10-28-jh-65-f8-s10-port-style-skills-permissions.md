# JH 65 · F8 S10: port style, skills, permissions

## Goal
Build F8's S10 (`odd/tasks/f8-s10-port.md`): `install` writes the `js-harness` output style, the two skills adapted
from gentle-ai, the whole `permissions` object with its 24 denies and G12's Rules block, each recorded and undone by
`uninstall`. It was proved in a scratch home, then measured once on his machine with the incident set. Opening: the
lead's brief, `C:\Users\Oficina\.js-harness\background\briefs\2026-10-27T22-37-24-845Z-44993974.md`.

## The user's words
- G12, question 99: "Bloque de reglas (Recomendada)" (transcript `0f71b2c6`, line 5233).
- Question 102: "Aplicar ahora (Recomendada)" (transcript `0f71b2c6`, line 7242, 10:02Z). A yes there covers backing
  up his `settings.json`, the install of S10 on his machine and one incident rerun of about $13.
- Q101 (relayed by the lead): his `outputStyle` stays Neutral.

## Delivered
- PRs 615, 617 and 619: S10's style, skills, permissions, guard denies and Rules block (T1-T5, T7, T7a).
- PR 620: T6's probe in a scratch home (5 of 5 Spanish replies in tú), and the ROADMAP and diet records.
- PR 621: T8, the lead's call. `install` and `sync` leave an installed file he changed and print
  `kept (modified by you)`, as `uninstall` already did (`bin/lib/component-write.mjs`).
- PR 623: T9. The style and the two skills are pinned by sha256 (`bin/lib/output-style.test.mjs`,
  `bin/lib/ported-skills.test.mjs`).
- The incident rerun on his machine after the install, `f8-s10-incidents`: 13 of 20, the same as the baseline's L,
  above its worse line of 10. The false-premise cases passed 2 of 4.
- Every code slice was reviewed by Codex, by the Claude lenses and by gentle-ai's granted run. The verdict of each is
  on the Reviews lines of the feature document.

## Decisions
- G8 and G10n were taken by the lead with their defaults: two skills, and the style named `js-harness`.
- The lead held the incident rerun until he applied S10 (L23). Run earlier, it would have copied a home without S10's
  user-level part.
- The pins hash raw bytes. `.gitattributes` checks `bin/**` out `eol=lf`, so gentle-ai's CRLF warnings do not apply.
- A file at a component's path that `install` never recorded is still overwritten on a first install. That case is out
  of T8's scope (L24).

## Failures and lessons
- The first style probe was void. `shell: true` cut each prompt to its first word, and the score passed anyway. The
  prompt now goes in on stdin, and a reply counts only when it answers. Registered in `docs/FAILURES.md` under
  `checked-not-read`.
- Codex refuses a second recheck. The fix was a `--again` run from the nearest boundary where a review started (T7a).

## Left
- Cases 01 (paid eval), 02 (review consent) and 05 (reported done) still fail every trial, as in S0. They are later
  steps' work (S4b, S5).
- Not checked: that the trial homes held his post-install files byte for byte (L26).

## Cost
- Incident rerun: $10.61 for 20 trials, 10:17Z to 10:39Z.
- Style probe: $0.12.
- Reviews: Codex, the lenses and gentle-ai once per slice. Their tokens are on the Reviews lines of the feature
  document.

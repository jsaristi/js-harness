# Notify to the lead of another project

A fix assigned by the lead to JH 36, on branch `fix/notify-lead-channel`. Test runner: `node --test`.

## Goal
A notice from a session that another project's lead started, such as the session that onboards a new project, reaches the record where that lead listens.

## Why
JH 43 ran the T4 pre-project onboarding in its own folder, a new project coded PP, started by the lead of js-harness. Its `notify --to orchestrator` was recorded in the new project's record (`~\.js-harness\channel\D--plataforma-preproyecto.jsonl`), and `sessions --address` answered "no session carries the title of the orchestrator". Its resend with `--cwd D:\js-harness` reached the lead, but with `"title":null` (js-harness record line 941), because its transcript is filed under the folder it runs in.

## Done when
- `npm run check` exits 0
- `node --test bin/notify.test.mjs` exits 0, with the tests of a cross-project notice routed, refused with none or two lead records, a question numbered in the lead's record, a lead past a removed worktree, and the sender read with `--cwd`

## In scope / Out of scope
- In: `notify` (`bin/notify.mjs`), its tests, its help, the README and SPEC lines, this document.
- Out: the other findings of the same run, in PR 498 and in the proposals to the lead.

## Constraints
- A project with no code keeps its notices as before; a notice that cannot be placed is refused, never written where no orchestrator listens.

## Ask me before
Nothing: the lead assigned the fix.

## Specs
- S1 "notify from a new project records in that project's own channel, where no orchestrator listens" (the lead's brief): fix it.
- S2 "Resent with `--cwd D:\js-harness` so it reaches the lead" (the findings file, item 7): the resend must keep the sender's title.

## Tasks
- [x] T1 (kind: build) S1, inline: a sender whose title carries another project's code (`harness.json` "code") writes to the record where that project's orchestrator last wrote; refused, with the `--cwd` hint, when no single such record is found (`4417ec0d`, `242ed87e`, `f4b1e955`).
- [x] T2 (kind: build) S2, inline: with `--cwd`, the sender is also looked for in the sessions folder of the folder notify runs in (`4417ec0d`, `242ed87e`).

## Log
- L1 (2026-10-21, the lead's brief): "Read the file and fix what belongs to js-harness in slices, as with PR 497, with ready notices to me." Finding 7 is the worst of the file.
- L2 (T1, T2, `4417ec0d`): RED was the routed and the refused notice; GREEN 469 tests of notify, channel and sessions. Then the `--cwd` title test, RED, GREEN. The rule needs a code here and a different one in the title, so the existing tests, whose project declares no code, pin the behavior as before.
- L3 (`242ed87e`): gentle-ai's advisories on `4417ec0d`, taken: the routing line follows the confirmation, the target's folder is named `cwd`, the folder notify runs in is searched only with `--cwd`, and tests pin two lead records and a routed question.
- L4 (`f4b1e955`): Codex on `453b72d..242ed87` found that a lead whose latest notice came from a worktree removed since would be lost (P2, incorrect 0.9). RED was the removed-worktree test; the lead's folders are now tried newest first. 169 notify tests pass.
- gentle-ai on `4417ec0d` (`453b72d6..4417ec0d`, risk, readability and reliability, lineage review-e9d48bf6ecb4ca29): approved and acknowledged, nine informational advisories, taken in `242ed87e` as L3 says; not taken: `mainCheckout` on a stale folder does not throw, it returns the folder (`bin/lib/sessions.mjs:797-802`).
- gentle-ai on `242ed87e` (`4417ec0d..242ed87e`, readability and reliability, lineage review-2195f938865ea6ab): approved and acknowledged; not taken: the order of two lead records is the sorted order of the record names (`.sort()` in `leadProjectsOf`), and an unreadable `harness.json` takes the path of a project with no code (`codeAt` gives `null`).
- gentle-ai on `f4b1e955` (`242ed87e..f4b1e955`, reliability and readability, lineage review-044ac355669a502e): approved and acknowledged; the README sentence rewritten; not taken: an orchestrator's notices are never routed, since its code is its project's, so a record holds only notices written from its own project's folders, and a removed folder makes git fail, which `mainCheckout` answers with the folder itself.
- Codex: `453b72d..242ed87` incorrect (0.9, the removed worktree, fixed in `f4b1e955`); `242ed87..f4b1e95` correct (0.97), the P2 fixed; both recorded.

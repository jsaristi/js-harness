# JH 172 · one home for the model and the effort, and the easy switch

## Goal
One place for the model and the effort everything runs on, and the easy way to switch it
(`odd/tasks/one-model-home.md`). This session did the design and pull request 1; pull requests 2 to 4 are left.

## The user's words
He typed nothing in this session. His words of 2026-11-10, quoted in the feature document's Specs (S1 to S6):
everything runs on one model at one effort, in one place, with an easy switch.

## Delivered
- The design, its depth pass and its inventory (T1, T2). It did not pass three double reviews; the lead said yes
  to building from the answers to the third (Log L13, L14).
- Pull request 822, merged: `bin/lib/model-home.mjs` and `bin/lib/model-shape.mjs`; the rules list refuses a
  short name, an effort that is no level and a Codex model that cannot be one; the lenses, the double review, the
  host watch and the guard's levels read the home; `bin/conventions-model-home.test.mjs`.
- Pull request 825, ready: `rules change <id> --with <path>...`, and the check of marks stops at a Log.
- Nothing switched: every model and effort is what it was.

## Decisions
- The home is two files with one entry for readers, so the rules list imports no module that imports it (L20).
- A path named by `--with` must hold a change; the id goes before `--with` (L19, L22).
- Pull request 1 was sliced in two at 400 changed lines of code.

## Failures and lessons
- An inference about eight stopped jobs was sent to the lead as a fact (`docs/FAILURES.md`,
  `estimate-passed-as-fact`).
- The first unit's test and module were written in one step, not test first (L15).
- The first version made `rules.mjs` and `model-home.mjs` import each other; the lenses found it (L20).
- The host stopped background commands three times for memory; each was reported and retried only on the lead's
  word, one command at a time under the gate lock (L21 to L24).

## Left
- Pull requests 2, 3 and 4 (T4 to T9), from the brief `~/.js-harness/background/briefs/one-model-home-pr2.md`.
- Not run: the whole gate on slice 1b's tree on this machine; the pull request's checks run it.
- Open with the lead: one `start_session` naming the home's model; whether the switch may write a home's rules in
  one commit.

## Cost
Three double reviews of the design, about 1 percent of Codex's weekly limit each. Code reviews: six Codex runs,
about 555,000 input tokens, and one stopped by the host; eleven lens runs. Codex's reset credits: 2, untouched.

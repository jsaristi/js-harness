# JH 189 · the advisor's home

## Goal
Give the advisor's model a home as a rule of the Claude home, read by `sessions start`, a resume, `rules switch` and
`rules applied`, so nobody passes `--advisor` by hand; its effort only if the host lets one be set. Opened by the brief
`~/.js-harness/background/briefs/2026-11-12T06-58-20-202Z-f6e42350.md`; feature document `odd/tasks/advisor-home.md`.

## The user's words
Transcript `812b728f-2f18-43f6-b405-396080689c65`: line 1444 "pero todos con Advisor de Fable 5.2 Alto"; line 2544
"con Opus y advisor de fable?"; line 3271, the move to Opus so as not to eat the Fable use (quoted whole in the rule's
source, `docs/rule-sources.json`, `advisor-model`).

## Delivered
- Pull request #846, branch `rule/advisor-home`, ready, not merged: it lands only on his yes.
- `3e943f2f` the rule `advisor-model` (`claude-fable-5-2`) and its readers; `3b932275`, `07e94c23` the guard's refusal
  and the home's exact id; `e3a491ab` `rules switch --advisor`; `b985227b`, `1d29d7d4` `rules applied` reads the
  advisor; `3168609a` the skill line; docs `1cc4db71`, `2458fcd3`, `0bbc768b`, `501b1566` and `193b7fb`.

## Decisions
- This session: the advisor is a rule of the home, one value, read by reference (Depth pass 1); a start and a resume
  give claude the home's exact id where the rule is declared (spec 3, `07e94c23`); an advisor equal to the model is
  refused by the switch (spec 5); a desktop session's advisor is not judged, since the app's record does not hold it.
- His, left open (feature document, "Ask me before" 1 to 6): the advisor's "Alto", which the host gives no level for;
  an advisor for the lenses and the double review; `start_session` and the app's sessions; "Extra" for the lead; the
  cost on the weekly Fable meter; an opt-out.

## Failures and lessons
- T5's first commit was refused by the run on GitHub: `bin/rules.test.mjs` holds the usage line word for word, and only
  the changed module's tests had run here. Fixed in the same commit; a usage change runs `bin/rules.test.mjs` too.
- Codex P2 on `e3a491a..b985227`: `sessionFacts` kept an earlier reply's advisor when the last named none. Fixed in
  `1d29d7d4`, confirmed by Codex (0.99) and the reliability lens.
- A `String.replace` with a template holding `` $` `` mangled a test file in an edit script; restored from git, and the
  scripts pass a function as the replacement.

## Left
- T8, the lead's after the land: the first start with no `--advisor` and the first `--resume`, each showing
  `advisorModel: claude-fable-5-2` beside an Opus reply, and `rules applied` listing neither as off the home.
- The six items of "Ask me before", his.

## Cost
- First notice 2026-11-12 ~07:00Z, last ~09:15Z; compacted once by the host (08:18Z).
- Reviews: double review of the plan (Claude 2,520,477 tokens, Codex 609,943); Codex on four slices and two rechecks;
  the Claude lenses on each slice; one independent verifier. Probes: about 0.1 USD (L5) and 0.071 USD (L7).
- Advisor calls of this session: 2, 373,981 input and 23,012 output tokens.

# JH 202 · Cement the dogfooding: what is done by hand becomes harness

Locator: `odd/tasks/cement-workarounds.md` · Branch: `rule/cement-workarounds`, from origin/main 9d4546a7 ·
Delivery: one pull request, landed by the lead · Test runner: `node --test`

## State
Done: T1 (this document). Next: T2, the rule amended through `rules change`; T3, the four follow-ups in the
roadmap's Later list; the reviews; the pull request and its ready notice. Open: nothing of his.

## Goal
A manual workaround the lead or a session makes while working is never left in memory: it gets a follow-up, owned by
a session or a roadmap entry, that builds it into `bin/`, a template or a check, and today's four are tracked.

## Why
He said it twice on 2026-11-14 (L1): everything done here is dogfooding and must end up cemented in the harness,
not left in memory. The rule that already says so for his rules and for repeated outputs
(`rule:rules-live-in-the-harness`) says nothing of a workaround a session invents to get past a gap, so today's
four lived only in the orchestrator's conversation.

## Done when
- `js-harness rules check` exits 0
- `npm run check` exits 0
- `js-harness contract check odd/tasks/cement-workarounds.md` exits 0
- `js-harness rules rules-live-in-the-harness` lists the phrase "A manual workaround the lead or a session makes"
- `docs/ROADMAP.md`'s Later list holds the four follow-ups, each with its owner, day and source
- the pull request is open, its ready notice sent to the lead

## In scope / Out of scope
- In: the rule `rules-live-in-the-harness` through `js-harness rules change` (`bin/lib/protocols-skill.mjs`, its
  home; `bin/lib/rules-data.mjs`, `docs/rule-sources.json`, `docs/RULES.md`, written by the command);
  `docs/ROADMAP.md`'s Later list; this document.
- Out: a new check (spec 3, his default through the brief: the audit argues against new mechanisms before its open
  findings are paid); the audit's fix-first list (its priority is his); building any of the four follow-ups; the
  `- Seen:` line of the worktree a land removed (owed, needs the lead's transcript lines).

## Constraints
- A rule of his changes only with his words: both lines are quoted with their dates (L1, L2).
- The amendment replaces the rule's stored source, so the new source carries every earlier quotation, its reading
  and its acceptance, extended, not rewritten.
- No Codex run on a docs-only commit (his standing order through the brief).

## Ask me before
Nothing: the brief settles the direction and the default for the check.

## Depth pass
- 1. Method: a rule has one home (`AGENTS.md`, "A rule lives where something acts on it"), and before adding one the
  session amends the one that already does it (`rule:reuse-first`). The smallest change that meets it: one bullet in
  the protocol section that already holds `rule:rules-live-in-the-harness`, and its declaration and source moved by
  `rules change`.
- 2. Raw material:
  - his words, the orchestrator's transcript `69918425-3b43-430f-9f50-62b6422422ce`, line 10967
    (2026-11-15T01:31:18Z, 2026-11-14 local) and line 11014 (2026-11-15T01:32:27Z), both read with
    `js-harness sessions --quote`, both "sent by the user".
  - the rule: `js-harness rules rules-live-in-the-harness`, home `bin/lib/protocols-skill.mjs:72-73`, its source in
    `docs/rule-sources.json` (eleven quotations from 2026-10-07 to 2026-10-28).
  - `AGENTS.md`: "When something can be checked by a command, it belongs in `bin/`, not in prose."
  - the audit: `git show origin/worktree-full-audit:odd/tasks/full-audit.md`, "What most moves maturity", point 4:
    "Pay the backlog before new mechanisms"; "Bad news first": `rules check` passes with 52 hits of its own patterns
    (D-1..3).
- 3. The bar:
  spec 1: `js-harness rules rules-live-in-the-harness`: today its phrases cover his rules and repeated outputs, none a
  manual workaround.
  spec 2: `docs/ROADMAP.md`: none of the four workarounds is tracked there today.
  spec 3: left out because it builds nothing: what a check would do is written under "The check not built".
- 4. Refutation: does an existing rule already cover it? Searched `js-harness rules` (82 rules; read
  `rules-live-in-the-harness`, `reuse-first`, `growth-limit`, `memory-feedback-home`) and `AGENTS.md`. The nearest,
  `rules-live-in-the-harness`, cements a rule he gives and an output he sees again and again; nothing names a
  workaround a session makes or who owns building it, so an amendment, not a new rule.
  Verdict: supports
- 5. Request: amend `rule:rules-live-in-the-harness` with one bullet: a manual workaround the lead or a session makes
  while working gets a follow-up that builds it into `bin/`, a template or a check, owned by a session or a roadmap
  entry named in the same reply; then track today's four in the roadmap's Later list.
  Adds: none

## The new-rule questions (`AGENTS.md`)
- Did it happen: yes, four times on 2026-11-14 alone (the hand-made task-progress page, the advisor-gate sequence,
  a worktree re-added by hand after a land removed it, the plan review with a verifier pass), each in the
  orchestrator's conversation only, until the brief of JH 202.
- Twice, or once at a cost: four times in one day, and he asked twice for it to be cemented (L1).
- Can a check do it: not cheaply; see "The check not built" below. The rule's sensor today is the same as the rule
  it amends: `js-harness guard` refuses a feedback note with no home (`rule:memory-feedback-home`).
- Can an existing one be amended: yes, `rule:rules-live-in-the-harness` (searched as in item 4).
- What it costs: one bullet of the protocols skill, read when a rule changes; and one roadmap line a workaround,
  written in the reply that tells of it. What leaves: the memory note `dogfood-cement-everything.md` becomes a
  pointer to `rule:rules-live-in-the-harness` instead of a home of its own.

## The check not built (spec 3, a follow-up)
- What would do it: the Stop hook's reply check (`bin/lib/reply.mjs`) reports a reply that tells of a manual step
  ("a mano", "by hand", "workaround", "re-added", "sequence to get past") and names no `odd/tasks/` document, roadmap
  line or session as its owner.
- Its cost, estimated: about 100 lines and their tests in `bin/lib/reply.mjs`, a word list in two languages that will
  both miss and over-report (a reply quoting the rule itself, a FAILURES line), and one more line in every reply the
  hook reads. A second cost the audit names: `rules check` already passes with 52 hits of its own patterns (D-1..3),
  so another pattern sensor adds to an unpaid debt.
- Why not now: the audit's point 4 and his default through the brief. It is revisited when the audit's fix-first
  list is paid, or when a workaround is found later with no follow-up (a `- Seen:` line would show it).

## Specs
1. "Cementalo en alguna parte y documentalo para que no se nos quede en memoria y se pierda" (L1): the rule lives in
   the repository, through `rules change`.
2. "la idea es que todo esto quede aplicado y cementado en el arnes que estamos construyendo" (L1): today's four
   workarounds are tracked as follow-ups with their owners.
3. The brief's default: no new check; what would do it and its cost are written here.

## Tasks
- [x] T1 (kind: docs) this document (spec 1, 2, 3; inline; its own commit)
- [ ] T2 (kind: docs) amend `rule:rules-live-in-the-harness` through `rules change` (spec 1; inline; its own commit)
- [ ] T3 (kind: docs) the four follow-ups in the roadmap's Later list (spec 2; inline; its own commit)
- [ ] T4 (kind: verify) the reviews, the pull request and the ready notice

## Log
- L1: his request, as the brief relays it from the orchestrator's transcript `69918425-3b43-430f-9f50-62b6422422ce`,
  both lines read with `js-harness sessions --quote`: line 10967, 2026-11-14: "Recuerda que todo lo que estamos
  haciendo es dogfooding y la idea es que todo esto quede aplicado y cementado en el arnes que estamos construyendo";
  line 11014, 2026-11-14: "Cementalo en alguna parte y documentalo para que no se nos quede en memoria y se pierda".
- L2: the advisor, consulted before any write, agreed on the amendment and warned that `rules change` replaces the
  stored source and the phrases, so both carry the earlier ones; that the worktree item's `- Seen:` line is owed, not
  written without the lead's lines; and that items 3 and 4 name no session, so the roadmap entry is their owner.
- L3: overlaps searched before T3: `stop-removed-live-worktree` in `docs/FAILURES.md` is `sessions stop`, not a land,
  so the land's removal is a new sighting still to write; `odd/tasks/advisor-use.md` builds the advisor gate's
  report, not the same-response blind spot.

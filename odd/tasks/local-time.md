# JH 127 · Times he reads are in his local time, never UTC

Locator: `odd/tasks/local-time.md` · Branch: `rule/local-time` (the rule's own commit is made by `js-harness rules
change` on it) · Delivery: one pull request to main · Test runner: `node --test`

## Goal
Every clock time the harness shows him, in a reply, a page or a hook's message, is in the machine's local time and says
its zone once, a rule declared from his words holds it, and the reply Stop hook turns back a reply that gives a UTC
clock time outside a code block, a quoted output or a path.

## Why
On 2026-11-01 he asked why the lead gives the time ending in Z and not his local time (L1) and asked for it in the
harness (L2). He is at UTC-5; the records stay in UTC because they are compared with each other, so the copying from
the records into what he reads is where the Z comes from: 21 of the lead's 951 replies did it (Depth pass, item 4).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/local-time.md` exits 0
- `node bin/js-harness.mjs rules local-time` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node --test bin/lib/local-time.test.mjs bin/lib/reply-time.test.mjs bin/reply.test.mjs` exits 0
- `node --test bin/lib/pages.test.mjs bin/lib/report.test.mjs bin/lib/report-status.test.mjs bin/lib/report-feature.test.mjs bin/lib/stretch-render.test.mjs bin/lib/stretch-why.test.mjs bin/lib/return-report.test.mjs bin/lib/stale-board.test.mjs` exits 0
- `npm run check` exits 0
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: the rule's text, a bullet of `js-harness-protocols` section 6 beside `rule:reports-spanish-visual`
  (`bin/lib/protocols-skill.mjs`), declared through `js-harness rules change`; the control, `bin/lib/reply-time.mjs`
  wired into `bin/reply.mjs`, with its `rules coverage` entry; one home for the local clock, `bin/lib/local-time.mjs`;
  the renderers that print UTC to him today: `bin/lib/pages.mjs` (the timeline and "Generada el"),
  `bin/lib/report.mjs` (`stamp`, used by `report-status.mjs` and `report-feature.mjs`), `bin/lib/stretch-render.mjs`,
  `bin/lib/stretch-why.mjs`, and the Stop hook's messages in `bin/lib/return-report.mjs` and `bin/lib/stale-board.mjs`;
  their tests; this document.
- Out, each with its reason:
  - the records (git, the channel, transcripts, the jsonl files, the stretch and gate logs): they stay in UTC because
    they are compared with each other (the lead, L3);
  - `docs/live-board.html`: it already renders in the viewer's browser with `toLocaleString('es', …)`
    (`docs/live-board.html:262`, `:266`, `:534`);
  - `js-harness notify`, `codex-meter`, the gate log and `audit`: they already print local time
    (`bin/notify.mjs:560`, `bin/lib/codex-meter.mjs:73`, `bin/lib/gate-log.mjs:430`, `bin/lib/audit.mjs:192`);
  - `js-harness throughput` (`bin/lib/throughput.mjs:364`, `:366`, `:499`): it is read by the lead, and its days are
    UTC days by design (`dayBounds`), so a local hour there would mislabel the day it bounds; a copy into a reply is
    turned back by the control like any other;
  - `sessions --quote` and other commands that print a record's stamp as it is: a record shown as a record;
  - the existing local-time helpers spread across modules (`measures.mjs`, `inbox.mjs`, `gate-log.mjs`): they already
    give local time; folding them into the new home is a cleanup not asked for.

## Constraints
- The offset is read from the machine's clock at the instant shown, never a constant — because a clock change or
  another machine would make a constant wrong (the brief).
- Run only the tests the change needs before the gate, and one gate at a time (`js-harness gate`) — because JH 126 runs
  beside this on `rule/double-review` and the machine is short of memory.
- Codex's weekly limit is at 82% with no reserve built: `js-harness codex-meter` is read before each Codex run and its
  cost said first; his reset credit is never spent without his word (the brief).

## Ask me before
Nothing planned: the rule is his typed words (L2) and the work is the brief's. A question goes to the lead with
`js-harness notify --to orchestrator --kind question`, one at a time.

## Depth pass
- 1. Method: localisation of times in an operator's tools, the work of a UX engineer who keeps machine records in UTC
  and converts only at the presentation edge, naming the zone once per view; and, for the control, a lint over the
  reply's prose with the same exemptions a style checker gives code and quotations. The smallest change: one formatter
  module the six renderers call instead of their own `toISOString().slice`, and one more warning beside the Stop
  hook's existing ones (`bin/reply.mjs:229`). The search of `rule:reuse-first`: `js-harness rules` lists no rule on time
  zones; `zone()` in `bin/lib/record-days.mjs:51` already names an offset as `UTC-05:00` and is reused; the local
  helpers in `bin/lib/measures.mjs:209`, `bin/lib/inbox.mjs:84` and `bin/lib/gate-log.mjs:430` are private to their
  modules and print other shapes.
- 2. Raw material: his words, lead transcript `0f71b2c6`, line 47140 and line 47160; the reply that drew them,
  the same transcript, line 47134 (`20:04Z`) and line 47154 (`05:46Z`); the renderers `bin/lib/pages.mjs:75`,
  `bin/lib/pages.mjs:109`, `bin/lib/report.mjs:133`, `bin/lib/stretch-render.mjs:169`, `bin/lib/stretch-why.mjs:10`,
  `bin/lib/return-report.mjs:44`, `bin/lib/stale-board.mjs:81`; the hook `bin/lib/reply.mjs:156` and `bin/reply.mjs:213`;
  the machine's clock: `new Date('2026-11-01T05:46:19Z').getHours()` gives 0, offset 300 minutes.
- 3. The bar:
  spec 1: `node bin/js-harness.mjs rules local-time`: today exits 1, "no rule "local-time" is declared".
  spec 2: `node --test bin/lib/reply-time.test.mjs`: none, new behaviour; measured on the lead's transcript, 21 of 951
  replies gave a UTC clock time outside code, the last at line 47154.
  spec 3: `git grep -nE "toISOString\(\)\.slice\((0|11), 16\)" -- bin/lib ':!*.test.mjs'`: today 6 lines in 6
  modules print a UTC time to him, plus "Generada el" at `bin/lib/pages.mjs:109`; after, 0.
- 4. Refutation: does the Z really reach him from the harness, or only from one stray reply? The cheapest test is to
  count it in the lead's replies, with code blocks, inline code, quoted lines and paths left out:
  `node count.mjs 0f71b2c6-cbce-43ca-a031-276a4b2c381f.jsonl` (a scratch script in the job's tmp folder) gave 21 of
  951 replies over 4 days (2026-10-28: 2, 10-29: 6, 10-31: 10, 11-01: 3); and the renderers above print it on every
  page and Stop hook message they make. The request holds. What the control cannot see: a UTC time written without Z
  or "UTC" ("a las 05:46") reads as local and is not caught (unguaranteed).
  Verdict: supports
- 5. Request: his request rewritten, beside his words (L1, L2): "Always give me the time in my local time: declare it as
  a harness rule from my words, make the pages and the hook messages I read render the machine's local time and say
  the zone once, keep the records in UTC, and have the reply hook turn back a reply that gives me a time in UTC."
  Adds: none

## Specs
1. "listo colocalo en el arnes de siempre dar la hora local" (L2): a declared rule, `local-time`, from these words.
2. "por que me das la hora en Z? osea por que termina en Z en vez de darme mi hora local" (L1): a reply to him that
   gives a UTC clock time outside a code block, a quoted output or a path is turned back by the Stop hook.
3. "siempre dar la hora local" (L2): the pages and messages he reads render the machine's local time and say the zone
   once.

## Tasks
- [x] T1 (kind: docs) this document and its depth pass, documents alone, before any code — spec 1-3 — 9a80707f
- [x] T2 (kind: build) the rule's text in section 6 and `js-harness rules change local-time` — spec 1 — 01abfff4
- [x] T3 (kind: build) `bin/lib/reply-time.mjs`, test first with a planted break, wired into `bin/reply.mjs`; its
  `rules coverage` entry — spec 2 — afac6f7b
- [x] T4 (kind: build) `bin/lib/local-time.mjs` and the six renderers on it, the zone said once per page — spec 3 —
  a1b23d9c (`local-time.mjs` itself came in afac6f7b, since the control names local times)
- [ ] T5 (kind: verify) Codex and the Claude lenses over the code commits; the gate; PR; `notify --kind ready` — all

## Log
- L1 (2026-11-01, lead transcript `0f71b2c6`, line 47140, typed): "por que me das la hora en Z? osea por que termina
  en Z en vez de darme mi hora local"
- L2 (2026-11-01, same transcript, line 47160, typed): "listo colocalo en el arnes de siempre dar la hora local"
- L3 (2026-11-01, the lead's brief): he is at UTC-5; the offset is read from the machine, never a constant; the
  records stay in UTC; the surfaces named: the lead's replies, `stretch close --html`, `report --html`, the Stop hook's
  messages and the live board. Searched the rest: `git grep` for `toISOString().slice`, `}Z`, `UTC` in `bin/`, and
  `toLocale` in `docs/`; the live board already renders local (Out of scope).
- L4 (2026-11-01, this session) The rule's home is a bullet of section 6, beside `rule:reports-spanish-visual`,
  since it governs what he reads, not how a reply closes. Its source's "accepted" is his line 47160 itself: it answers
  the lead's reply at line 47154, which proposed the hook check. `rules check`: PASS, 73 rules.
- L5 The control also counts a time followed by "UTC" ("05:46 UTC"), since his words ask for local time always and
  the Stop hook's own messages wrote it that way; an offset such as `UTC-05:00` is a zone and passes. The warning
  names each time with its local equivalent, so the session can rewrite it. Planted break
  (`times.length >= 0`): 3 pass, 1 fail; reverted.
- L6 The zone is said once: with "Generada el" where a page says when it was made, else through `page`'s new
  `zoneAt`; the status, feature and return pages pass it. The printed report and the hook messages say it on their
  first time. The markers the hooks match on (`(return at <ISO>)`, a notice's id) keep UTC: they are record keys.
- L7 Result against item 3: spec 1, `rules local-time` exits 0 (predicted 0); spec 2, 4 of 4 tests of
  `reply-time.test.mjs` pass and the hook test turns back "05:46Z" (predicted caught); spec 3, the `git grep` finds 0
  lines, from 6 (predicted 0). Against item 4: the 21 of 951 replies are what the control now turns back; the
  unguaranteed case, a UTC time with no Z nor "UTC", stays unguaranteed.
- L8 Reviews: Codex over b0af203a..a1b23d9c, 2 parts, estimated 218,000 to 270,000 input tokens, weekly meter at
  82% before it; the Claude lenses readability and reliability, about 20,000 input tokens each.
- L9 Mistake: this document was edited (L4 to L8) while the Codex review ran, so its part 1 of 2 passed and was not
  kept; 189,665 input tokens spent, nothing recorded (`edit-during-review` in `docs/FAILURES.md`, its eighth sighting).
  The lenses, which ran beside it, completed: readability 0 findings, reliability 0 findings, about 38,000 input
  tokens each, nearly twice their plan. Fix now: this document committed first, then the review run again with no
  edit while it runs; meter before the rerun, weekly 83%. What stops it coming back is not in this feature: the
  control today is a check that detects it after the spend; a guard that refuses a Write or Edit in a worktree while
  its Codex review runs would prevent it, proposed to the lead.

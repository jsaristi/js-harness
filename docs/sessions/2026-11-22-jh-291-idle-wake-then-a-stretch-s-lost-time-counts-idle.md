# JH 291 · idle wake, then a stretch's lost time counts idle

## Goal
A held work session of the lead, JH ORQ · orquestador F8. It took four units in a row, each from a brief in the lead's
notes folder: the IDLE wake, a stretch's lost time, a sub-agent's writes counted as work, and F10's docs.

## The user's words
None typed to this session. The briefs quote his words (transcript 0cdab702-72bd-48e7-8a8e-0c38d4aca9c9): line 10901
"no veo que nada este trabajando" and line 9744, recorded in odd/tasks/idle-stretch.md, Log L1 and L2; line 11517 is
quoted only in the third brief (brief-false-idle.md).

## Delivered
- https://github.com/jsaristi/js-harness/pull/954 (draft): the lead's wait and the heartbeat end with one `IDLE:` line
  when a stretch is open and no session has written for 20 minutes (head 427de6b4).
- https://github.com/jsaristi/js-harness/pull/955 (draft, on 954): a stretch's lost time adds the hours sessions waited
  and the idle spells, and the return page names each kind (head 2562b6c).
- https://github.com/jsaristi/js-harness/pull/958 (draft, on 955): a running sub-agent's writes
  (`<session>/subagents/*.jsonl`) count as work, so it gives no false IDLE line (head dc57d6d3).
- https://github.com/jsaristi/js-harness/pull/960 (draft, on main): consistent-orders F10. README, SPEC and the
  advisor gate's usage text name the compaction break of a consult's stretch (cc990b28). F10's "stretch" was read as the
  advisor gate's, which a compaction ends (`breakOf`, bin/advisor-gate.mjs:119). This summary rides on the same branch
  (head 92803a48).
- Feature document: odd/tasks/idle-stretch.md (T1-T5, L1-L10); odd/tasks/consistent-orders.md F10 and L24.

## Decisions
- The lead: no Codex while it is at its stop (until 2026-11-23 23:45); each unit gets the risk and reliability lenses
  and a draft PR (the briefs in the lead's folder).
- This session: "ran" is read from writes, not from turns (idle-stretch.md, Constraints); waits are counted per
  session and idle time as wall hours, with an idle hour a wait already covers counted once (L7, L8).

## Failures and lessons
- The first unit-2 commit was refused by the gate, because RECORDS.md and SPEC had no rows for the new records. It was
  fixed in the same commit.
- A push plus `gh pr create` joined by a line break was refused whole by the guard. They now run as separate calls.
- PR 960's first push was refused by the pre-push hook for its missing lens record. The lenses ran (0 findings) and
  the push went through.

## Left
- L9 (idle-stretch.md): the return page's idle list can add up to more than the idle tile. Open; the lead holds it.
- Codex's reviews of 954, 955, 958 and 960, once its stop lifts. Recorded as skips.
- On claude/jh291-false-idle, idle-stretch.md's State (lines 6-9) and Constraints still call the sub-agent gap open,
  while L10 says PR 958 closed it. The lead holds that docs fix.

## Cost
First notice with "JH 291" in its title 2026-11-22T06:10:30Z (channel record line 3874); earlier notices under
another title were not checked. Last 07:02Z. The context was at 34% at the last notice, after one compaction.
Spend about 16M cache-read, estimated. Lenses: risk and reliability on each unit, plus a recheck on units 2 and 3.
Codex: 0 runs, 4 skips recorded. The gate ran on every commit.

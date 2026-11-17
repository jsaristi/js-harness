# JH 208 · órdenes que se cumplen siempre

File: docs/sessions/2026-11-17-jh-208-ordenes-que-se-cumplen-siempre.md.

## Goal
Reopened by the lead after the restart of 2026-11-15 (opening read with `js-harness sessions --opening 'JH 208 · órdenes que se cumplen siempre'`) to land rule/away-autonomy, whose open rule change blocked JH 211's T7.

## The user's words
"Apruebo el PR 897, la regla away-autonomy con los forks" — transcript 699d7c29-54c4-460e-a5e8-700b114eb251 line 6810, 2026-11-17T04:35:37Z (`js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 6810`); his tap "Sí, lo apruebo" to question 321 at line 6175. The rule's origin: "casi no avanzamos debe haber una forma de mitigar esto", lead transcript 69918425 line 15446, and his answer to question 290 at line 16074.

## Delivered
- PR 897 (https://github.com/jsaristi/js-harness/pull/897), merged into main as 9fc30a07: rule away-autonomy carries 2 to 4 forks pre-decided before he leaves; one commit, 79511d9b.

## Decisions
- The PR was opened as a draft until his typed yes: the lead's order (cross-session message, 2026-11-16).
- The fork text gained explicit exceptions the Claude lenses asked for (an approved fork is the one exception to holding his cases; a corrected fork counts as approved; silence approves nothing; showing forks is not a question): this session, put to him in question 321 and approved in his typed yes.
- Reviews re-run after the rebase as part of landing, not new spend: the lead's order.

## Failures and lessons
- `js-harness rules change <id> --dry-run` waited about 4 h on standard input with no output; it reads the change as JSON from stdin. Found when the lead noticed the idle session; rerun with `</dev/null` and a timeout. Not yet in docs/FAILURES.md.
- A `git commit --amend ... | tail -2` hid a pre-commit refusal (rules check: RULES.md not re-rendered) behind exit 0; found because the tree stayed dirty. Not yet in docs/FAILURES.md.
- A 10 h background wait gave no signal while the PR waited for him; the lead's message was the real wake.

## Left
- The work-sessions-public 12->6 cap commit, after this land: by odd/tasks/consistent-orders.md, held by the lead to assign.
- odd/tasks/consistent-orders.md does not yet record PR 897, the lens findings, Q321 and his typed yes; the two failures above are not in docs/FAILURES.md: held by the lead.

## Cost
First notice 2026-11-16T02:22Z (opened), last before this one 2026-11-17 (ready). Context at the end about 97%. Codex: 2 runs (79,793 and 65,501 input tokens). Claude lenses: 4 runs of 2 lenses (about 11k input tokens each). Gate: one `js-harness gate -- npm run check` stopped before its end; the pre-commit check ran on each of 5 amends.

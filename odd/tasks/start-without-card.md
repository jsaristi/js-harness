# Start without card

The lead's `start_session` on a turn he typed opens a session with no approval card, and the harness's checks before
a start still act. Branch `claude/jh302-start-without-card` from `origin/main` 9d7f1c47; owner `JH 302`; delivery one
draft pull request; test runner `node --test`.

## State
- Done: this document; claims A and B re-checked in the binaries (Depth pass, item 2).
- Next: T1, test first. Design: drop `claude-permit-hook` from `entryComponents`; `install --permit-relay` records
  the choice in the manifest, and `install()` reads it back when it builds the declared entries, so `sync` keeps an
  opted-in relay. Write a test for that: opt in, then sync, and the entry is still there.
- Open: T0 is his. One unknown may defeat route S: `ve`'s `nRe` term. `claude-security` carries a PermissionRequest
  hook but is not enabled here (L4). T1 waits for T0 and a fresh context (the lead, L4). The PR is a draft and docs
  only.

## Goal
On a turn he typed, the lead's `start_session` opens a session with no card, while the start checks in the
PreToolUse hooks still act.

## Why
He was shown a card on a start he had asked for, and said he does not want it (S1). The app allows a start in bypass
mode with no card only when `Ce()` is false. `Ce()` skips the hooks when the CLI sends `server_policy_ask_only: true`,
and the CLI sends false whenever any PermissionRequest hook is installed. The harness installs one, the permit relay.
Route S takes it out of the default install, so the start checks (`bin/guard.mjs:195-230`, `bin/advisor-gate.mjs:70`)
stay and stop costing the card. Route H is the fallback: the hook matchers become plain lists without
`start_session`, and the checks move after the start. Route F leaves the card. Only T0 tells S from H.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/start-without-card.md` exits 0
- `node --test bin/lib/manifest.test.mjs` exits 0
- `node --test bin/install.test.mjs` exits 0
- `node --test bin/uninstall-kinds.test.mjs` exits 0
- By hand, after his yes to T0 and T4: one `start_session` on his typed turn, into a used folder, opens a row with no
  card.

## In scope / Out of scope
- In: `bin/lib/manifest.mjs`, `bin/lib/hook-entries.mjs`, `bin/install.mjs` (the flag and its help),
  `bin/lib/hook-count.mjs` (the limit), `scripts/practice-lib.mjs` (`HARNESS_HOOKS`), their tests, and the docs that
  name the relay (T2).
- Out: his `~/.claude/settings.json`, which nothing here edits. `install`, `sync` and `start_session` are not run
  here. Engram's matcher is not ours (route H only).

## Constraints
- A security setting and a guard: high risk (2). Lenses risk and reliability on every code slice. Codex before the PR
  leaves draft; under the 70% stop until 2026-11-23 23:45 its skip is recorded with `--unavailable`.
- What install writes stays recorded, so `uninstall` removes it exactly (`AGENTS.md`).
- No start check is dropped on route S.

## Ask me before
1. T0, the trial: a hand edit of his user settings (a security setting).
2. The route after T0.
3. Any `js-harness install` or `sync` on his machine once T1 lands: `installMain` runs `sync`
   (`bin/install.mjs:375-381`), so either one drops the relay from his settings. Whether `update` or `upgrade`
   reaches it was not checked.
4. Any report to engram upstream (publishing), on route H only.
5. No card on a turn he did not type: that needs a rules change of `sessions-open-in-sidebar`.

## Depth pass
- 1. Method: find the decision that shows the card in the shipped code, change the smallest input to it that the
  harness owns, and prove the change with one trial before building on it. This keeps every check before the start.
- 2. Raw material (JH 302 re-checked these on 2026-11-23 unless marked):
  - Claim A: checked, with one more condition than the draft gave. Claude Desktop 6.28899.6, `app.asar` byte
    22076074: `Ce=()=>G&&S===!0&&W!==void 0&&(!q||Vl(...))?Promise.resolve(!1):...H4(W?.query,s)`.
    - `S` is `serverPolicyAskOnly`, destructured at byte 22074552.
    - `G` is a start tool for which `startToolsAlwaysAskLaid(r)` is true (byte 4754781).
    - With all of them true, `Ce()` answers false without reading the hooks.
    - The auto-allow is at about byte 22079874 (the explorer's reading, not re-read).
  - Claim B: checked. Claude Code 2.1.330, byte 321157855: the flag is true only with "no PermissionRequest hook",
    among other terms. Byte 358273123, `ve`: `Q0("PermissionRequest")!=="none"||hA(...)||Z0(...)`, with no tool
    name, so a matcher does not scope it.
  - Not known:
    - `ve`'s `nRe(...,Pb("tool.check"),...)`. The binary has several minified functions named `nRe` and `Pb`, so
      the grep did not tell which one runs.
    - The functions before `ve`.
    - Whether the plugin `claude-security` is enabled. Its `hooks/hooks.json` (marketplace copy) holds a
      PermissionRequest hook, and if enabled it defeats route S as the relay does.
  - The relay entry: `bin/lib/manifest.mjs:336-341`, command `js-harness permit --hook || exit 0`
    (`bin/lib/hook-entries.mjs:88`).
  - Precedent for an opt-in flag: `--accept-session-messages` (`bin/install.mjs:73-92`).
  - The lead's notes `start-prompt-cause-2026-11-23.md` and `start-card-plan-draft-2026-11-23.md` (input only).
- 3. The bar:
  spec 1: by hand, a start on his typed turn shows no card: today it shows one (0cdab702:15192 to 15198).
  spec 3: `node --test bin/install.test.mjs`: none, new behaviour.
- 4. Refutation: the cheapest test is T0, his to run, so it was not run. Run instead:
  `grep -a -b -o ".\{250\}server_policy_ask_only.\{250\}" ~/.local/bin/claude`, which found byte 321157855 and
  `ve`. Claim B holds.
  Verdict: supports
- 5. Request: take the permit relay out of the default install, behind `install --permit-relay`, recorded so that
  `sync` keeps an opted-in relay, `uninstall` removes it, and `sync` drops the entry an older install wrote. Keep
  every start check. One trial, his, proves it, with route H as the fallback.
  Adds: none

## Specs
- S1 "sigue pidiendo permiso y no quiero eso" (his words, 0cdab702:15198, 2026-11-23T04:15:09Z; the lead's brief
  cites 15195, its queue line).
- S2 "entonces usa subagentes mientras tanto para llenar las horas pero que las lance el orquestador y el orquestador
  nos informa todo y la idea es que mientras averiguamos como abrir sesiones." (his words, 0cdab702:15805).
- S3 "Listo hagamos el metodo que dices ya" (his words, 0cdab702:15975, 2026-11-23T05:10:40Z). The method is the
  lead's: our hooks stop forcing the card on start_session, the start checks are kept, and one start proves it.

## Tasks
- [ ] T0 (kind: verify) S1, his decision: one fresh bypass session with the PermissionRequest block out of his
  settings (backed up, with its sha256 compared on restore); one `start_session` from the main thread on his typed
  turn, into a used folder. No card: S. A card: T0b. (route: by hand)
- [ ] T0b (kind: verify) S1, his decision, if T0 shows a card: the same with route H's matchers. (route: by hand)
- [ ] T1 (kind: build) S3: the permit relay opt-in, test first. (route: inline; this branch)
- [ ] T2 (kind: docs) S3: the orchestrator skill, `odd/tasks/held-sessions.md` and the install help say what opting in
  costs. (route: inline)
- [ ] T3 (kind: build) S1, route H only: the start checks after the start. (route: only if T0 shows a card)
- [ ] T4 (kind: verify) S1, his yes: `js-harness sync` on his machine, then the start by hand. (route: by hand)
- [ ] T5 (kind: verify) Codex on every code slice, then the PR leaves draft. (route: after 2026-11-23 23:45)

## Log
- L1, 2026-11-23, his request as written (0cdab702:15975): "Listo hagamos el metodo que dices ya".
- L2, 2026-11-23, the lead's brief to JH 302 (the lead's claim, not his word):
  - open this document with route S as the plan, route H as the fallback, and T0 his;
  - re-check the two claims that decide the route;
  - T1 test first, with lenses risk and reliability and the Codex skip recorded;
  - a draft PR only;
  - do not touch his settings, run install or sync, or call start_session.
- L3, 2026-11-23, JH 302 re-checked both claims (Depth pass, item 2):
  - claim A holds under one more condition, `G`;
  - claim B holds;
  - `nRe` is not known;
  - the plugin `claude-security` carries a PermissionRequest hook;
  - plain `install` also drops the relay, so "install alone leaves it" in the draft is wrong.
- L4, 2026-11-23, the lead's answer (the lead's claim): `claude-security` is not enabled here, since `enabledPlugins`
  lists codex, engram and typescript7-lsp. So of the two unknowns only `nRe` remains. `--no-permit-relay` is not
  added: T0 decides the route first. T1 goes to a fresh context after T0, so JH 302 stops here.

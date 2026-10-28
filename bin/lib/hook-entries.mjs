// The hook entries `install` grafts onto the hosts' settings, one function each, and the commands they run (the
// `entryComponents` of ./manifest.mjs, which re-exports the commands). Moved out of the engine whole when F8 S10 added
// its components, so the engine keeps to data and walking under its size ceiling (odd/tasks/f8-s10-port.md).

/** `doctor --hook` (T3) registered as a `SessionStart` hook: zero model tokens on a session start
 * with nothing new to report (see odd/tasks/stack-doctor.md, "Registration"). */
export function hookEntry() {
  return {
    matcher: 'startup|resume',
    hooks: [{ type: 'command', command: 'js-harness doctor --hook', timeout: 10 }],
  };
}

/** `resume --hook` (bin/resume.mjs) registered as a `SessionStart` hook for the matcher `compact|clear|startup`: after
 * a compaction, or a clear, the session reads its title, its opening and its feature document from files, so nobody
 * pastes it a resume prompt (odd/tasks/session-channel.md, "Context"). Both hosts match a `SessionStart`
 * entry against the way the session started, and both name a compaction `compact` (their hooks
 * documentation, read on 2026-10-11; in this project's Claude Code transcripts the hooks of other tools
 * ran under `SessionStart:compact` after 40 compactions). The desktop app's clear starts a new session whose
 * start is `startup`, not `clear` (harness-review L12), so that matcher is named too, and the hook speaks on it
 * only when the app's record of the session names the session it was cleared from (bin/resume.mjs). It is an
 * entry of its own because the doctor's matcher (`startup|resume`) must not fire on a compaction or a clear.
 * Fifteen seconds: the command asks git a handful of questions, each with a limit of its own. */
export function resumeHookEntry() {
  return {
    matcher: 'compact|clear|startup',
    hooks: [{ type: 'command', command: 'js-harness resume --hook', timeout: 15 }],
  };
}

/** The command of the pause hook. The `|| exit 0` is the point: a hook that exits 2 blocks its host, and an older
 * copy of js-harness on the path answers 2 to a command or a flag it does not know (it happened to `resume` itself
 * on 2026-10-12), so whatever the command answers, the entry exits 0. The form is one that both `sh` and `cmd.exe`
 * read. Which shell a Windows host runs a hook's command in is not proven here: it is one of the tries the feature
 * document lists. */
export const PAUSE_HOOK_COMMAND = 'js-harness resume --pause || exit 0';

/** `resume --pause` (bin/resume.mjs) registered as a `PostToolUse` hook: after a tool call that passes the context
 * pause it prints the notice, once for the stretch of work (odd/tasks/session-channel.md). Claude Code only: the
 * pause is read from a Claude Code transcript, and a Codex session has none here, so there is no Codex entry. No
 * matcher, so the entry runs after every tool, which is what the notice needs. Two seconds: a short budget, since
 * the hook runs after every tool call. */
export function pauseHookEntry() {
  return {
    hooks: [{ type: 'command', command: PAUSE_HOOK_COMMAND, timeout: 2 }],
  };
}

/** The pause command again, registered as a `PostToolUseFailure` hook on WebFetch: a WebFetch that fails as a tool
 * error ("Claude Code is unable to fetch from <domain>") reaches no `PostToolUse` hook, so this entry is what tells the
 * session the next rung of the fallback ladder (T4 of odd/tasks/web-fetch-fallback.md, which he asked for on
 * 2026-10-16). The command answers in the event of its input, so the one command serves both entries. Claude Code
 * only: WebFetch is its tool. Two seconds, as the pause hook's. */
export function webFailureHookEntry() {
  return {
    matcher: 'WebFetch',
    hooks: [{ type: 'command', command: PAUSE_HOOK_COMMAND, timeout: 2 }],
  };
}

/** The command of the guard hook, guarded to exit 0 like the pause hook's: a refusal travels as the hooks contract's
 * JSON on standard output, so an older js-harness that answers 2 to `guard` never blocks a tool call. */
export const GUARD_HOOK_COMMAND = 'js-harness guard --hook || exit 0';

/** `guard --hook` (bin/guard.mjs) registered as a `PreToolUse` hook on the tools it checks: a sub-agent's launch, whose
 * model it holds to the project's rules, and the two ways of sending a message to another session, whose stamped hour
 * it holds to the clock (odd/tasks/honesty-audit.md, T13 and T14), a Bash command, a Write or an Edit, whose line in a
 * memory index it holds to INDEX_LINE_CHARS characters (odd/tasks/memory-hygiene.md, T4), and the four tools that open a session in
 * the app's Routines or in the cloud, refused where the rule `sessions-open-in-sidebar` is declared (layer 3 of
 * odd/tasks/session-channel.md), and the desktop app's `start_session`, whose effort it holds to the rule
 * `session-effort` (odd/tasks/harness-review.md, T6c), and the desktop app's `run_in_terminal`, whose command it holds to
 * a closing note saying what it does where the rule `terminal-note` is declared (odd/tasks/terminal-note.md). Claude Code only: the tool names are Claude Code's. Five
 * seconds: it may ask git for the project's root once.
 * The matcher is anchored, `^(…)$`, because Claude Code's hooks reference (checked 2026-10-15) reads a matcher with a
 * character outside letters, digits, `_`, `-`, spaces, `,` and `|` as a JavaScript regular expression, unanchored: the
 * `^` and `$` make it a whole-name match, so `Write` does not match `TodoWrite` and `Edit` does not match
 * `NotebookEdit`. A hyphen alone does not make it a regex. The same text is held by the tests of
 * bin/lib/manifest.test.mjs and by scripts/practice-lib.mjs (`HARNESS_HOOKS`). */
export function guardHookEntry() {
  return {
    matcher: '^(Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash|Read|Write|Edit|mcp__scheduled-tasks__create_scheduled_task|mcp__scheduled-tasks__update_scheduled_task|mcp__scheduled-tasks__run_scheduled_task|RemoteTrigger|mcp__ccd_session__start_session|mcp__terminal__run_in_terminal)$',
    hooks: [{ type: 'command', command: GUARD_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the permit relay, guarded to exit 0: an older js-harness has no `permit` and answers 2. */
export const PERMIT_HOOK_COMMAND = 'js-harness permit --hook || exit 0';

/** `permit --hook` (bin/permit.mjs) registered as a `PermissionRequest` hook on every tool: while a lead holds the
 * relay, a card of another session is told to the orchestrator and waits for its verdict; with none, or none in time,
 * the card reaches the user as before (odd/tasks/held-sessions.md, S8 and T6). Claude Code only: the event is Claude
 * Code's. 600 s, the host's own default for a command hook: the relay answers within 570 s of its own. */
export function permitHookEntry() {
  return {
    hooks: [{ type: 'command', command: PERMIT_HOOK_COMMAND, timeout: 600 }],
  };
}

/** The command of the share check, guarded to exit 0 like the guard's: an older js-harness answers 2 to `--stop`,
 * and a `Stop` hook that exits 2 turns the stop back. */
export const SHARE_HOOK_COMMAND = 'js-harness guard --stop || exit 0';

/** `guard --stop` (bin/guard.mjs) registered as a `Stop` hook: a reply that states the session's own context share
 * more than SHARE_TOLERANCE points from the share its transcript records is turned back to be corrected (odd/tasks/honesty-audit.md,
 * T16). A `Stop` entry takes no matcher. Claude Code only: the transcript it reads is Claude Code's. Five seconds: it
 * reads the transcript once, and only when the reply states a share. */
export function shareHookEntry() {
  return {
    hooks: [{ type: 'command', command: SHARE_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the reply check, guarded to exit 0 like the share check's: an older js-harness answers 2 to `reply`,
 * and a `Stop` hook that exits 2 turns the stop back. */
export const REPLY_HOOK_COMMAND = 'js-harness reply --hook || exit 0';

/** `reply --hook` (bin/reply.mjs) registered as a `Stop` hook in both hosts: a reply that does not close with exactly one
 * state, and what that state needs, is turned back to be closed again (odd/tasks/rule-hierarchy.md, C1 and T2). It acts
 * only in a project whose nearest `harness.json` holds a `reply` key and prints `{}` everywhere else, so the entry runs
 * in every session of the machine and changes nothing where the project did not turn it on. Both hosts: it reads only
 * the reply's text, which both send as `last_assistant_message` (Claude Code's payload logged on 2026-10-16; Codex's
 * hooks documentation read the same day). Five seconds, as the share check's: it reads one small file a folder, up to
 * the project's `harness.json`, and, for the wake check of a work session, the end of its transcript, the record of
 * notices and the openings (533 ms on this project's largest transcript, 64.7 MB, measured on 2026-10-16). */
export function replyHookEntry() {
  return {
    hooks: [{ type: 'command', command: REPLY_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the memory backup's hook, guarded to exit 0 like the reply check's: an older js-harness that has no
 * `backup` answers 2, and a `Stop` hook that exits 2 turns the stop back. */
export const BACKUP_HOOK_COMMAND = 'js-harness backup --hook || exit 0';

/** `backup --hook` (bin/backup.mjs) registered as a `Stop` hook in both hosts: when a backup is due (the clone exists,
 * the last success is 30 minutes old and something it copies changed since) it starts `backup run` detached and
 * returns, so the memory reaches the private repository as sessions work (odd/tasks/memory-backup.md, D2). With no
 * clone it does nothing, on every machine where `backup init` was never run. Five seconds, as the other Stop entries:
 * it reads two small files and the times of the folders it copies. */
export function backupHookEntry() {
  return {
    hooks: [{ type: 'command', command: BACKUP_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the memory fallback's notice, guarded to exit 0 like the backup's: an older js-harness answers 2. */
export const FALLBACK_HOOK_COMMAND = 'js-harness backup --session-start || exit 0';

/** `backup --session-start` (bin/backup.mjs) registered as a `SessionStart` hook in both hosts, for every start: after a
 * compaction the notice is needed most. When Engram holds less than nine tenths of what the last backup held of the
 * session's project, it sends the session to that project's readable file (odd/tasks/recent-memory.md, D7). An entry
 * of its own, since doctor's hook prints `systemMessage` only. Five seconds: `engram stats` gets three. */
export function fallbackHookEntry() {
  return {
    matcher: 'startup|resume|clear|compact',
    hooks: [{ type: 'command', command: FALLBACK_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the rules' turn-start hook, guarded to exit 0 like the pause hook's: an older js-harness that answers
 * 2 to `--hook` never blocks a turn. */
export const RULES_HOOK_COMMAND = 'js-harness rules --hook || exit 0';
/** The sources of `SessionStart` after which what the context held may be gone, so the session is told again. */
export const RULES_RETOLD_MATCHER = 'compact|clear|resume';

/** `rules --hook` (bin/lib/rules-reach.mjs) registered on `UserPromptSubmit`, on `SessionStart` for
 * `RULES_RETOLD_MATCHER`, and on `SubagentStart`: letter F's turn-start hook, which tells a session what the rules on
 * the default branch say that its merge base does not (odd/tasks/rule-hierarchy.md, "Reach: the turn-start hook (T16f,
 * first part)"). Claude Code only, until a logging hook confirms Codex's events. It prints nothing on a turn with no
 * change. Five seconds: a node start and up to four git calls, each limited on its own. */
export function rulesHookEntry(matcher) {
  return {
    ...(matcher === undefined ? {} : { matcher }),
    hooks: [{ type: 'command', command: RULES_HOOK_COMMAND, timeout: 5 }],
  };
}

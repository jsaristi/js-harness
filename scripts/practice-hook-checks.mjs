// The practice's checks of what the installed command's hooks and tools do when a session meets them: the context
// pause, the channel, the tools that open a session where he does not see it, and the reply check. Kept apart from
// practice-lib.mjs so that file stays under the size limit (bin/conventions-structure.test.mjs); it imports from
// practice-lib and practice-lib never imports it, so the release gate that copies practice-lib alone still loads.
import { isInside, pathFor } from './practice-lib.mjs';

// ---- the context pause, as the hook of the installed command meets it ----

/** One line of a made-up transcript: a reply of the session whose usage counts `tokens` input tokens, written as the
 * host writes one (`type`, `uuid`, `timestamp`, `message.usage`). The model is a made-up name, not `<synthetic>`,
 * which the reader of the pause does not count. The caller ends the line. */
export function pauseReplyLine({ uuid, timestamp, tokens }) {
  return JSON.stringify({
    type: 'assistant',
    uuid,
    timestamp,
    message: { model: 'made-up-model', role: 'assistant', usage: { input_tokens: tokens } },
  });
}

/** The hook input the host sends the pause command on standard input after a tool call, as JSON text: the session,
 * its transcript, its folder and the event (`PostToolUse`), the fields `pauseLine` of `bin/resume.mjs` reads. */
export function pauseHookInput({ sessionId, transcriptPath, cwd }) {
  return JSON.stringify({ session_id: sessionId, transcript_path: transcriptPath, cwd, hook_event_name: 'PostToolUse' });
}

/** What is wrong with the three runs of the pause command, or `null` when nothing is. `first` is a run in a project
 * with the session past the pause: it must exit 0 and print one line, the notice, which is JSON naming the event
 * `PostToolUse` with a non-empty `additionalContext`. `second` is the same input again, and `outside` a run in a
 * folder that is no project's, with a session past the pause too: both must exit 0 and print nothing. Each run is
 * `{ status, stdout }` of the child. The message names the run and says what it did, in words. */
export function pauseHookProblem({ first, second, outside }) {
  if (first.status !== 0) return `the first run exited ${first.status}, not 0`;
  // The line break `console.log` ends the line with is not part of what the hook printed.
  const notice = (first.stdout ?? '').replace(/\r?\n$/, '');
  if (notice.trim() === '') return 'the first run printed nothing, though the session was past the pause';
  if (/\r?\n/.test(notice)) return 'the first run printed more than one line, though its notice is one';
  let parsed;
  try {
    parsed = JSON.parse(notice);
  } catch {
    return `the first run printed text that is not JSON: ${notice}`;
  }
  const output = parsed?.hookSpecificOutput;
  if (output?.hookEventName !== 'PostToolUse') return `the first run names the event ${JSON.stringify(output?.hookEventName)}, not PostToolUse`;
  if (typeof output.additionalContext !== 'string' || output.additionalContext.trim() === '') {
    return 'the first run gives no additionalContext, or an empty one, so the session would be told nothing';
  }
  if (second.status !== 0) return `the second run exited ${second.status}, not 0`;
  const again = (second.stdout ?? '').replace(/\r?\n$/, '');
  if (again.trim() !== '') return `the second run printed ${again}, though the pause is said once`;
  if (outside.status !== 0) return `the run outside a project exited ${outside.status}, not 0`;
  const elsewhere = (outside.stdout ?? '').replace(/\r?\n$/, '');
  if (elsewhere.trim() !== '') return `the run outside a project printed ${elsewhere}, though no harness.json is above its folder`;
  return null;
}

// ---- the channel, as the installed project meets it (odd/tasks/session-channel.md, T10) ----

// The names `channelEnv` replaces: the two a child reads its home from (`os.homedir()` takes USERPROFILE on Windows and
// HOME elsewhere), the harness's home, and the two by which a command started from a live session reaches that
// session's files: its id (`notify` reads the sender's transcript by it) and its config folder (the Claude home both
// commands read the sessions from when no `--claude-home` is given).
const CHANNEL_REPLACED = ['HOME', 'USERPROFILE', 'JS_HARNESS_HOME', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_SESSION_ID'];

/** Where `notify` records the notices of the project `slug` under the home `home` (`recordPath` of
 * `bin/lib/channel.mjs`). Spelled here, as `gateLogFolder` is, because the practice looks at the candidate from outside;
 * a test holds the two spellings together. The step reads the real home's record by it, to show the notice is not there. */
export function channelRecord(home, slug, platform = process.platform) {
  return pathFor(platform).join(home, '.js-harness', 'channel', `${slug}.jsonl`);
}

/** The environment of the two commands of the step `channel`, as a new object; `baseEnv` (the practice's `childEnv`)
 * is left as it is. `notify` and the board find the record under the harness home, which is `JS_HARNESS_HOME` or the
 * user's home: both are the practice home here, so a command that ignored the one would still write and read there,
 * and never in the real home. The host session's id and config folder are dropped, so the session that starts a run
 * is never taken for the sender and its transcripts are never read. Windows does not tell names apart by case: every
 * spelling of a replaced name goes, and the result holds each once. */
export function channelEnv(baseEnv, home, platform = process.platform) {
  const windows = platform === 'win32';
  const replaced = (name) => CHANNEL_REPLACED.includes(windows ? name.toUpperCase() : name);
  return {
    ...Object.fromEntries(Object.entries(baseEnv).filter(([name]) => !replaced(name))),
    HOME: home,
    USERPROFILE: home,
    JS_HARNESS_HOME: home,
  };
}

/** How a child of the step ended, for its message: the spawn error, or its exit code. */
const endedAs = (result) => (result.error ? result.error.message : `exit ${result.status}`);
/** The first line of `text` that is not blank, or `null`. */
const firstLine = (text) => String(text ?? '').split(/\r?\n/).find((line) => line.trim() !== '') ?? null;
const failedRun = (what, result) => `${what} failed (${endedAs(result)}): ${firstLine(result.stderr) ?? 'it printed nothing on stderr'}`;

/** What is wrong with the step `channel`, or `null` when nothing is. `notify` is the run of the installed
 * `js-harness notify --to orchestrator --kind note "<a line holding marker>"` in the practice project, and `board` the
 * run of `js-harness sessions --json` after it, each `{ status, stdout, stderr, error? }` of the child. `notify` must
 * exit 0; the real home's record of the project (`realRecord`, its text, or `null` when there is none) must not hold
 * `marker`; the board must exit 0 and print JSON whose `channel` was read from a record under the practice home `home`
 * and lists, among its last notices, one whose text holds `marker`. The real home is looked at before the board: a
 * notice written there instead would otherwise read only as a board that does not show it. One line names what failed. */
export function channelStepProblem({ notify, board, marker, home, realRecord = null, platform = process.platform }) {
  if (notify.error || notify.status !== 0) return failedRun('js-harness notify', notify);
  if (typeof realRecord === 'string' && realRecord.includes(marker)) return `the real home's channel record holds ${marker}: the notice reached the real home`;
  if (board.error || board.status !== 0) return failedRun('js-harness sessions --json', board);
  let parsed;
  try {
    parsed = JSON.parse(board.stdout);
  } catch {
    return `js-harness sessions --json printed text that is not JSON: ${firstLine(board.stdout) ?? '(nothing)'}`;
  }
  const channel = parsed?.channel;
  if (!Array.isArray(channel?.notices)) return 'the board shows no channel notices: its JSON has no channel.notices list';
  if (typeof channel.path !== 'string' || !isInside(home, channel.path, platform)) {
    return `the board read the channel's record at ${channel.path}, outside the practice home ${home}`;
  }
  if (!channel.notices.some((notice) => typeof notice?.text === 'string' && notice.text.includes(marker))) {
    return `no notice on the board holds ${marker}: it shows ${channel.notices.length} of the ${channel.noticeCount} notices of ${channel.path}`;
  }
  return null;
}

// ---- the tools that open a session where he does not see it, as the guard meets them ----

/** The four tools the guard refuses where the rule `sessions-open-in-sidebar` is declared, as `bin/lib/guard.mjs` names
 * them (`OPENING_TOOLS`); a test holds the two together. A session these open runs in the app's Routines or in the cloud. */
export const OPENING_TOOLS = Object.freeze([
  'mcp__scheduled-tasks__create_scheduled_task',
  'mcp__scheduled-tasks__update_scheduled_task',
  'mcp__scheduled-tasks__run_scheduled_task',
  'RemoteTrigger',
]);

/** The hook input the host sends the guard on standard input before a tool call, as JSON text: the session, its folder,
 * the event (`PreToolUse`) and the tool, with an empty input, since the refusal of these tools reads no input. */
export function openingToolInput({ sessionId, cwd, tool }) {
  return JSON.stringify({ session_id: sessionId, cwd, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: {} });
}

/** What is wrong with the guard's answers to the four tools, or `null`. `plain` holds a run for each tool in a project
 * that declares no rule: each must exit 0 and print nothing, so the tool passes. `declared` holds a run for each tool in
 * the project that declares the rule: each must exit 0 and print the hooks contract's deny, whose reason names the tool
 * and `start_session`. Each run is `{ status, stdout }` of the child, keyed by the tool's name. The message names the
 * tool and says what the guard did, in words. */
export function openingToolsProblem({ plain, declared }) {
  for (const tool of OPENING_TOOLS) {
    const quiet = plain[tool];
    if (quiet?.status !== 0) return `the guard exited ${quiet?.status} on ${tool} in a project that declares no rule, not 0`;
    const printed = (quiet.stdout ?? '').replace(/\r?\n$/, '');
    if (printed.trim() !== '') return `the guard refused ${tool} in a project that declares no rule: ${printed}`;
  }
  for (const tool of OPENING_TOOLS) {
    const refused = declared[tool];
    if (refused?.status !== 0) return `the guard exited ${refused?.status} on ${tool} in the project that declares the rule, not 0`;
    const printed = (refused.stdout ?? '').replace(/\r?\n$/, '');
    // Silence is the guard letting the call run, which is the very thing this step must not see here.
    if (printed.trim() === '') return `the guard let ${tool} run in the project that declares the rule, though its scheduled session would open where he does not see it`;
    let answer;
    try {
      answer = JSON.parse(printed);
    } catch {
      return `the guard printed for ${tool} in the project that declares the rule text that is not JSON: ${printed}`;
    }
    const output = answer?.hookSpecificOutput;
    if (output?.hookEventName !== 'PreToolUse' || output.permissionDecision !== 'deny') {
      return `the guard let ${tool} run in the project that declares the rule, though its scheduled session would open where he does not see it`;
    }
    const reason = typeof output.permissionDecisionReason === 'string' ? output.permissionDecisionReason : '';
    if (!reason.includes(tool) || !reason.includes('start_session')) {
      return `the refusal of ${tool} does not name the tool and start_session: ${reason}`;
    }
  }
  return null;
}

// ---- the reply check, as a Stop hook meets it (odd/tasks/rule-hierarchy.md, T12) ----

/** The hook input the host sends a `Stop` hook on standard input, as JSON text: the session, its folder, the event, the
 * reply that ends the turn and no background work running, the fields `bin/reply.mjs` reads. */
export function replyHookInput({ sessionId, cwd, message }) {
  return JSON.stringify({ session_id: sessionId, cwd, hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: message, background_tasks: [] });
}

/** The run's answer as JSON, or the reason it is none: a `Stop` hook answers with one JSON object, `{}` to let the session
 * stop. */
function replyAnswer(run, which) {
  if (run?.status !== 0) return { problem: `the reply check exited ${run?.status} on ${which}, not 0` };
  const printed = (run.stdout ?? '').trim();
  return printed === '' ? { printed } : { printed, answer: (() => { try { return JSON.parse(printed); } catch { return undefined; } })() };
}

/** What is wrong with the three runs of the reply check, or `null`. `refused` is a reply with no state, in a folder whose
 * `harness.json` holds `"reply": true` (the practice project, whose `harness.json` from `init` turns the check on):
 * it must be turned back with `decision: "block"` and a reason that names the English label `Working`. `passed` is a
 * reply there that closes with `Working — …`, and `plain` the reply with no state in a folder outside any project, where
 * no `harness.json` lies above: both must print `{}`. Each run is `{ status, stdout }` of the child. */
export function replyHookProblem({ refused, passed, plain }) {
  const turned = replyAnswer(refused, 'the reply with no state');
  if (turned.problem) return turned.problem;
  if (turned.answer?.decision !== 'block') return `the reply check let a reply with no state stop in the folder whose harness.json turns it on: ${turned.printed}`;
  const reason = typeof turned.answer.reason === 'string' ? turned.answer.reason : '';
  if (!reason.includes('Working')) return `the reply check turned the reply back without naming the state Working: ${reason}`;
  for (const [run, which, where] of [
    [passed, 'the reply that closes with its state', 'a reply that closes with its state'],
    [plain, 'the reply outside any project', 'a reply outside any project, where no harness.json turns it on'],
  ]) {
    const read = replyAnswer(run, which);
    if (read.problem) return read.problem;
    if (read.printed === '') return `the reply check printed nothing ${run === plain ? 'outside any project' : 'in the folder whose harness.json turns it on'}, though a Stop hook answers with JSON`;
    if (read.answer === undefined || Object.keys(read.answer).length !== 0) return `the reply check turned back ${where}: ${read.printed}`;
  }
  return null;
}

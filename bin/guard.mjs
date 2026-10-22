// `js-harness guard --hook`: the `PreToolUse` hook that checks a tool call before it runs
// (odd/tasks/honesty-audit.md, T13 and T14). It reads the host's payload on standard input and, to refuse, prints the
// hooks contract's deny with its reason; to let the call run, it prints nothing. It exits 0 whatever happens, and a
// failure inside it lets the call run: a check that cannot read what it checks says nothing rather than block work.
//   - `Agent`: the sub-agent's model against the rules in force in the project (bin/lib/guard.mjs, `modelRefusal`).
//   - The four tools that open a session in the app's Routines or in the cloud (`OPENING_TOOLS`): refused where the
//     rule `sessions-open-in-sidebar` is declared, and the reason names `start_session` (`openingRefusal`;
//     odd/tasks/session-channel.md, layer 3).
//   - `mcp__ccd_session__start_session`: a session started with no effort, or above the rule `session-effort`, where
//     that rule is declared (`sessionEffortRefusal`; odd/tasks/harness-review.md, T6c); then one titled otherwise than
//     `<code> <n> · <purpose>`, where the rule `session-title` is declared, with the project's next free number
//     (bin/lib/session-title-guard.mjs, imported only for this tool; odd/tasks/session-title.md).
//   - `SendMessage` and `mcp__ccd_session_mgmt__send_message`: the hour a message stamps as its time of sending
//     against the clock (`hourRefusal`).
//   - `Bash`: backticks inside double quotes, which bash runs as commands (`backtickRefusal`); then a recursive `rm` or
//     an `rmdir` of a drive's root or a folder at its top, which the host holds for the user even in bypass mode
//     (`driveRootRemovalRefusal`; odd/tasks/held-sessions.md, T4); then a gentle-ai review
//     given a `--base-ref` its head does not contain (`reviewBaseRefusal`; odd/tasks/gate-wait.md, T11); then a `node --test` of
//     several files outside a turn while another gate holds the machine's lock, refused with JH 8's warning line
//     unchanged (bin/lib/test-run-warning.mjs; his answers of 2026-10-14, S7 and S8).
//   - `Write` and `Edit`: a line of a project's memory index over the host's 150 characters, judged in the file the
//     call leaves (read from disk for an Edit) and only when the call brings it
//     (bin/lib/memory-index-guard.mjs; odd/tasks/memory-hygiene.md, T4). The hook runs on every Write and Edit of
//     every session, so that path loads nothing but that file: the modules of the other checks are imported only for
//     the tools they check. Then, for a Markdown file, a line that stamps today's date with an hour ahead of the clock
//     (bin/lib/document-hour-guard.mjs; odd/tasks/session-channel.md, T12b), imported only for a `.md` path. Before it,
//     a note of a memory folder whose type is `feedback` that names no home of its rule in the repository, where the
//     rule `memory-feedback-home` is declared (bin/lib/memory-feedback-guard.mjs, imported only for a memory note;
//     odd/tasks/memory-feedback-home.md). `guard --memory <folder>` runs the same check over a whole folder.
// `js-harness guard --stop` is the `Stop` hook (odd/tasks/honesty-audit.md, T16): a reply that states the session's own
// context share more than 2 points from the share its transcript records (bin/lib/audit.mjs, `shareRefusal`). A reply
// is not a tool call and is already shown when the hook runs, so it cannot be refused before it is sent: the hook
// turns the stop back with the hooks contract's `decision: "block"` and its reason, and the session corrects the share
// in its next words. It never turns back a stop it already turned back (`stop_hook_active`), so it cannot loop; it
// reads the transcript only when the reply states a share, and a failure inside it lets the session stop.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { memoryFileOf, memoryIndexRefusal } from './lib/memory-index-guard.mjs';

export const USAGE = 'Usage: js-harness guard --hook\n'
  + '  reads a PreToolUse payload on standard input; refuses an Agent call on a model the rules do not give, a\n'
  + '  scheduled-task or cloud tool that opens a session where he does not see it (where the rules declare\n'
  + '  sessions-open-in-sidebar), a start_session that names no effort or one above the rule session-effort (where\n'
  + '  the rules declare it), a start_session titled otherwise than <code> <n> · <purpose>, naming the next free\n'
  + '  number (where the rules declare session-title), a message whose stamped hour is more than a minute off the clock, a Bash command\n'
  + '  with backticks inside double quotes, a command for the user\'s terminal that does not end with a note saying what it\n'
  + '  does, a recursive rm or an rmdir of a folder at the top of a drive, a gentle-ai review whose --base-ref is off its head\'s first-parent line, a node --test of several files while another gate holds the lock, and\n'
  + '  a Write or Edit that puts a line over 150 characters in a memory index (MEMORY.md), that leaves a feedback note\n'
  + '  of a memory folder naming no home of its rule in the repository (where the rules declare memory-feedback-home),\n'
  + '  or that puts a line in a Markdown\n'
  + '  file that stamps today with an hour ahead of the clock; lets a git commit or merge wrapped in js-harness gate --\n'
  + '  run with a hint beside its result, since a plain one waits for its turn by itself; always exits 0\n'
  + '       js-harness guard --memory <folder>\n'
  + '  lists each feedback note of the memory folder that names no home of its rule in the repository, a declared\n'
  + '  `rule:<id>` or a phrase of AGENTS.md quoted on a line that names it, and exits 1; exits 0 when every one does\n'
  + '       js-harness guard --stop\n'
  + '  reads a Stop payload on standard input; turns the stop back when the reply states this session\'s context share\n'
  + '  more than 2 points from the share its transcript records, so the session corrects it; always exits 0\n';

const MESSAGE_TOOLS = new Set(['SendMessage', 'mcp__ccd_session_mgmt__send_message']);
const FILE_TOOLS = new Set(['Write', 'Edit']);

/** The hooks contract's answer that refuses the call, with `reason` shown to the agent (the same as
 * bin/lib/guard.mjs's `denial`, written here so the Write and Edit path imports nothing more). */
const denial = (reason) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });

/** The top of the git work tree `cwd` is in, or `cwd` itself when git does not say. */
function gitRoot(cwd) {
  const result = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
  const [top] = String(result.stdout ?? '').split(/\r?\n/).filter((line) => line.trim() !== '');
  return result.status === 0 && top !== undefined ? path.resolve(top) : cwd;
}

/** The text of `file`, or null when there is none. Any other failure throws. */
function optionalText(file, readFile) {
  try {
    return readFile(file);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** The text of the project's rules file, or null when it has none. Any other failure throws. */
const rulesTextOf = (root, readFile) => optionalText(path.join(root, 'bin', 'lib', 'rules-data.mjs'), readFile);

/** Why the call of `payload` is refused, or null. */
async function refusalOf(payload, { now, projectRoot, readFile, testRun, readIndex, claudeConfigDir, baseContains, env = {}, homedir = os.homedir }) {
  const tool = payload?.tool_name;
  const input = payload?.tool_input ?? {};
  if (FILE_TOOLS.has(tool)) {
    const index = memoryIndexRefusal(tool, input, readIndex, claudeConfigDir);
    if (index !== null || !/\.md$/i.test(String(input.file_path ?? ''))) return index;
    const note = memoryFileOf(input.file_path, claudeConfigDir);
    if (note !== null && note.toLowerCase() !== 'memory.md') {
      const root = () => projectRoot(typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd());
      const feedback = (await import('./lib/memory-feedback-guard.mjs')).feedbackNoteRefusal(tool, input, note, {
        readNote: readIndex,
        rulesText: () => rulesTextOf(root(), readFile),
        agentsText: () => optionalText(path.join(root(), 'AGENTS.md'), readFile),
      });
      if (feedback !== null) return feedback;
    }
    return (await import('./lib/document-hour-guard.mjs')).documentHourRefusal(tool, input, now(), readIndex);
  }
  const { OPENING_TOOLS, SESSION_TOOL, TERMINAL_TOOL, allowedModels, backtickRefusal, driveRootRemovalRefusal, hourRefusal, modelRefusal, openingRefusal, reviewBaseRefusal, sessionEffortRefusal, terminalNoteRefusal } = await import('./lib/guard.mjs');
  if (tool === TERMINAL_TOOL) return terminalNoteRefusal(input.command);
  if (!OPENING_TOOLS.includes(tool) && tool !== 'Agent' && tool !== 'Bash' && tool !== SESSION_TOOL && !MESSAGE_TOOLS.has(tool)) return null;
  const rootOf = () => projectRoot(typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd());
  if (tool === 'Agent') return modelRefusal(input, allowedModels(rulesTextOf(rootOf(), readFile)));
  if (tool === SESSION_TOOL) {
    const root = rootOf();
    const rules = rulesTextOf(root, readFile);
    return sessionEffortRefusal(input, rules) ?? (await sessionTitleOf(input, rules, root, env.JS_HARNESS_HOME || homedir(), readFile));
  }
  if (OPENING_TOOLS.includes(tool)) return openingRefusal(tool, rulesTextOf(rootOf(), readFile));
  if (MESSAGE_TOOLS.has(tool)) return hourRefusal(input.message, now());
  const backticks = backtickRefusal(input.command);
  if (backticks !== null) return backticks;
  const driveRoot = driveRootRemovalRefusal(input.command);
  if (driveRoot !== null) return driveRoot;
  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
  const base = reviewBaseRefusal(input.command, { cwd, ...(baseContains && { contains: baseContains }) });
  if (base !== null) return base;
  const run = testRun ?? (await import('./lib/test-run-warning.mjs')).testRunWarning;
  // The folder the command runs in names its test file as the gate log does (first-version T6a).
  return run(String(input.command ?? ''), { ...(typeof payload.cwd === 'string' && payload.cwd !== '' && { cwd: payload.cwd }) });
}

/** Why the `start_session` call whose input is `input` is refused for its title, or null (lib/session-title-guard.mjs). The
 * project's code is read from the `harness.json` of its main checkout, and the next free number from that checkout's
 * channel under the harness home `home`, as `notify` writes it, and only to word a refusal. */
async function sessionTitleOf(input, rules, root, home, readFile) {
  const { sessionTitleRefusal } = await import('./lib/session-title-guard.mjs');
  // Loaded before the check, since the check is synchronous; the record is read for a bad title alone. A reader that
  // fails to load leaves the refusal standing: without the code, every title is refused and told why.
  let project;
  try {
    const [{ nextSessionNumber }, { mainCheckoutByFiles }, { projectCode, projectSlug }] = await Promise.all([
      import('./lib/channel.mjs'), import('./lib/inbox.mjs'), import('./lib/sessions.mjs'),
    ]);
    const main = mainCheckoutByFiles(root) ?? root;
    project = { codeOf: () => projectCode(main, readFile), next: (code) => nextSessionNumber(home, projectSlug(main), { code }) };
  } catch (err) {
    const fail = () => {
      throw err;
    };
    project = { codeOf: fail, next: fail };
  }
  return sessionTitleRefusal(input, rules, project);
}

/** The hint for the Bash call of `payload` that wraps a commit in `js-harness gate --`, or null (lib/wrapped-commit.mjs).
 * A command that names no commit loads nothing. */
async function hintOf(payload, { env, projectRoot, exists }) {
  const command = String(payload.tool_input?.command ?? '');
  if (!/\bgate\b/.test(command) || !/\b(commit|merge)\b/.test(command)) return null;
  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
  return (await import('./lib/wrapped-commit.mjs')).wrappedCommitHint(command, { cwd, env, projectRoot, exists });
}

/** Why the reply that ends the turn of the `Stop` payload is to be corrected, or null. The text is the host's
 * `last_assistant_message`, else the transcript's last own reply: the host writes its transcript after the fact, so
 * the recorded share may be the step before the reply's, a tool result short of it. The window the share is of is the one
 * the host is configured with when a setting gives it, as the pause notice says it (`hostWindow`), ahead of the
 * session's last get_usage read and of the default: a read of the window before the setting changed would turn back a
 * reply that says what the notice told it (odd/tasks/session-channel.md, T6b). */
async function stopRefusalOf(payload, readTranscript, { env, homedir, projectRoot }) {
  if (payload?.stop_hook_active === true || typeof payload?.transcript_path !== 'string' || payload.transcript_path === '') return null;
  const { lastShare, shareRefusal } = await import('./lib/audit.mjs');
  const given = typeof payload.last_assistant_message === 'string' ? payload.last_assistant_message : null;
  // A reply that names no context share costs no read of the transcript; the window the share is of comes from it.
  if (given !== null && !(/context/i.test(given) && /\d\s?%/.test(given))) return null;
  const read = lastShare(readTranscript(payload.transcript_path).split(/\r?\n/));
  if (read === null) return null;
  const { hostWindow } = await import('./lib/pause.mjs');
  const projectDir = typeof payload.cwd === 'string' && payload.cwd !== '' ? projectRoot(path.resolve(payload.cwd)) : null;
  const window = hostWindow({ env, home: env.JS_HARNESS_HOME || homedir(), projectDir });
  const recorded = window === null ? read : { ...read, window };
  return shareRefusal(given ?? recorded.text, recorded);
}

/** `guard --memory <folder>`: each feedback note of the memory folder `folder` that names no home of its rule, one line
 * each, and exit 1; exit 0 when every one names its home, or when the project in the working directory does not
 * declare `rule:memory-feedback-home`. A folder that cannot be read exits 1 (odd/tasks/memory-feedback-home.md, S3). */
async function memoryForm(folder, { projectRoot, readFile, stdout, stderr }) {
  const { homeRuleValue, noteRefusal } = await import('./lib/memory-feedback-guard.mjs');
  const root = projectRoot(process.cwd());
  const value = homeRuleValue(rulesTextOf(root, readFile));
  if (value === null) {
    stdout('rule memory-feedback-home is not in force in this project: nothing checked\n');
    return 0;
  }
  let names;
  try {
    names = fs.readdirSync(folder).filter((name) => /\.md$/i.test(name) && name.toLowerCase() !== 'memory.md').sort();
  } catch (err) {
    stderr(`js-harness guard: cannot read the memory folder ${folder}: ${err.message}\n`);
    return 1;
  }
  const { memoryNoteType } = await import('./lib/memory-rules.mjs');
  const agents = optionalText(path.join(root, 'AGENTS.md'), readFile);
  let feedback = 0;
  let homeless = 0;
  for (const name of names) {
    const text = fs.readFileSync(path.join(folder, name), 'utf8');
    if (memoryNoteType(text) !== 'feedback') continue;
    feedback += 1;
    if (noteRefusal(name, text, agents, value) === null) continue;
    homeless += 1;
    stdout(`${name}: a feedback note that names no home of its rule in the repository\n`);
  }
  if (homeless === 0) stdout(`every feedback note names its home (${feedback} feedback notes)\n`);
  return homeless === 0 ? 0 : 1;
}

export async function guardMain(argv, {
  readStdin = () => fs.readFileSync(0, 'utf8'),
  now = () => new Date(),
  projectRoot = gitRoot,
  readFile = (file) => fs.readFileSync(file, 'utf8'),
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
  testRun,
  baseContains,
  readIndex = (file) => fs.readFileSync(file, 'utf8'),
  claudeConfigDir = process.env.CLAUDE_CONFIG_DIR,
  readTranscript = (file) => fs.readFileSync(file, 'utf8'),
  env = process.env,
  homedir = os.homedir,
  exists = fs.existsSync,
} = {}) {
  if (argv[0] === '--memory' && argv.length === 2) return memoryForm(argv[1], { projectRoot, readFile, stdout, stderr });
  if (argv.length !== 1 || (argv[0] !== '--hook' && argv[0] !== '--stop')) {
    stderr(USAGE);
    return 2;
  }
  if (argv[0] === '--stop') {
    let turnBack = null;
    try {
      turnBack = await stopRefusalOf(JSON.parse(readStdin()), readTranscript, { env, homedir, projectRoot });
    } catch {
      return 0;
    }
    if (turnBack !== null) stdout(`${JSON.stringify({ decision: 'block', reason: turnBack })}\n`);
    return 0;
  }
  let reason = null;
  let hint = null;
  try {
    const payload = JSON.parse(readStdin());
    reason = await refusalOf(payload, { now, projectRoot, readFile, testRun, readIndex, claudeConfigDir, baseContains, env, homedir });
    // A denial wins; a Bash call that runs adds the hint for a wrapped commit beside its result (commit-gates-first S4).
    if (reason === null && payload?.tool_name === 'Bash') hint = await hintOf(payload, { env, projectRoot, exists });
  } catch {
    return 0;
  }
  if (reason !== null) stdout(`${JSON.stringify(denial(reason))}\n`);
  else if (hint !== null) stdout(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: hint } })}\n`);
  return 0;
}

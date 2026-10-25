// `js-harness sessions start` and `js-harness sessions stop` (odd/tasks/background-sessions.md): the lead starts a work
// session with `claude --bg` on a turn the user did not type, where the desktop app's `start_session` would only leave
// a card, and removes it again. Every start is recorded under the harness home (bin/lib/background.mjs), so `stop` and
// the machine uninstall undo exactly what was started, and touch no session they did not start.
// The title and the effort are held to the rules `guard` holds `start_session` to, by the same functions.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendRecord, backgroundDir, briefCopyOf, briefsDirOf, claudeRunner, idOfStart, listAgents, readRecord, recordFileOf, recordedNamed, saidBy, startArgs, startPrompt, undoSession, within } from './lib/background.mjs';
import { sessionEffortRefusal } from './lib/guard.mjs';
import { sessionTitleRefusal } from './lib/session-title-guard.mjs';
import { nextSessionNumber } from './lib/channel.mjs';
import { mainCheckout, projectCode, projectSlug } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';

export const START_USAGE = [
  'Usage: js-harness sessions start --title <title> --brief <file> [--worktree <name>] [--model <model>] [--effort <level>]',
  '                                 [--no-remote-control] [--cwd <path>] [--home <path>]',
  '       js-harness sessions stop <id> [--home <path>]',
  '         start runs claude --bg in the folder (a worktree of its own with --worktree), titled as start_session titles a session,',
  '         with Remote Control on (claude.ai/code and the phone reach it) unless --no-remote-control; the session reads a copy',
  '         of the brief that ends by telling it to report through js-harness notify --to orchestrator. It prints the id and records',
  '         the start under <home>/.js-harness/background/; exit 1 when claude is missing or refuses (nothing is recorded), 2 for a',
  '         usage error or a title or effort the rules session-title and session-effort refuse, where they are declared.',
  '         A run of claude that does not finish (a timeout) is looked for in claude agents and recorded when it started.',
  '         The lead uses it only on a turn the user did not type, where start_session would leave a card: a background session',
  '         is not a row in the desktop sidebar. The board lists the project\'s background sessions, what each waits for',
  '         (a permission prompt included) and whether start recorded it; --watch returns when one starts waiting.',
  '         stop removes a session start recorded (claude stop, then claude rm; its transcript stays), and only such a one:',
  '         exit 1 for any other id, or when claude refuses (unpushed commits in its worktree), which keeps it recorded;',
  '         a worktree with uncommitted changes stays, and stop says where.',
  '         js-harness uninstall machine removes every recorded session that is not at work, and fails while one is.',
].join('\n');

class StartArgError extends Error {}

const VALUED = new Map([['--title', 'title'], ['--brief', 'brief'], ['--worktree', 'worktree'], ['--model', 'model'], ['--effort', 'effort'], ['--cwd', 'cwd'], ['--home', 'home']]);

function parseStart(argv) {
  const parsed = { remoteControl: true };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--no-remote-control') {
      parsed.remoteControl = false;
      continue;
    }
    if (!VALUED.has(token)) throw new StartArgError(`unknown argument: ${token}`);
    const value = argv[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) throw new StartArgError(`${token} requires a value`);
    parsed[VALUED.get(token)] = value;
    i += 1;
  }
  if (parsed.title === undefined) throw new StartArgError('--title is required: the session\'s title, as the board and notify read it');
  if (parsed.brief === undefined) throw new StartArgError('--brief is required: the file that says what the session does');
  return parsed;
}

/** The git top level of `cwd`, where the project's rules file is, or `cwd` outside a repository. */
function topLevel(run, cwd) {
  const result = run('git', ['rev-parse', '--show-toplevel'], { cwd });
  const [top] = String(result.stdout ?? '').split(/\r?\n/).filter((line) => line.trim() !== '');
  return !result.error && result.status === 0 && top !== undefined ? path.resolve(top) : cwd;
}

/** The text of the rules file under `root`, or null when it has none. */
function rulesText(root, readFile) {
  try {
    return readFile(path.join(root, 'bin', 'lib', 'rules-data.mjs'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

const defaults = () => ({
  cwd: process.cwd(),
  env: process.env,
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
  now: Date.now,
  homedir: os.homedir,
  run: (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }),
  readFile: (file) => fs.readFileSync(file, 'utf8'),
});

/** `sessions start`: exit 0 once the session runs and is recorded, 1 when claude is missing or refused (nothing is
 * recorded), 2 for a usage error or a rule that refuses the title or the effort (nothing runs). */
export function sessionsStartMain(argv, given = {}) {
  const deps = { ...defaults(), ...given };
  const { stdout, stderr, env, now, run, readFile } = deps;
  let parsed;
  try {
    parsed = parseStart(argv);
  } catch (err) {
    if (!(err instanceof StartArgError)) throw err;
    stderr(`${err.message}\n\n${START_USAGE}`);
    return 2;
  }
  let brief;
  try {
    brief = readFile(path.resolve(deps.cwd, parsed.brief));
  } catch (err) {
    stderr(`js-harness sessions start: could not read the brief ${parsed.brief} (${err.code ?? err.message})`);
    return 2;
  }
  if (brief.trim() === '') {
    stderr(`js-harness sessions start: the brief ${parsed.brief} is empty`);
    return 2;
  }
  const cwd = path.resolve(deps.cwd, parsed.cwd ?? '.');
  const home = harnessHome({ given: parsed.home, env, cwd: deps.cwd, homedir: deps.homedir });
  const root = mainCheckout(run, cwd);
  const top = topLevel(run, cwd);
  const rules = rulesText(top, readFile);
  const project = { codeOf: () => projectCode(root, readFile), next: (code) => nextSessionNumber(home, projectSlug(root), { code }) };
  const refusal = sessionEffortRefusal({ prompt: brief, effort: parsed.effort }, rules, { cli: true })
    ?? sessionTitleRefusal({ title: parsed.title }, rules, project, 'js-harness sessions start');
  if (refusal !== null) {
    stderr(refusal);
    return 2;
  }
  const claude = deps.claude === undefined ? claudeRunner({ env }) : deps.claude;
  if (claude === null) {
    stderr('js-harness sessions start: claude is not on PATH: install the Claude Code CLI, then run this again');
    return 1;
  }

  // The record is opened before claude runs: a session started that cannot be recorded is one nothing undoes.
  try {
    fs.mkdirSync(backgroundDir(home), { recursive: true });
    // Windows opens a folder for appending without an error, so a record that is not a file is refused by name.
    if (fs.existsSync(recordFileOf(home)) && !fs.statSync(recordFileOf(home)).isFile()) throw Object.assign(new Error('not a file'), { code: 'EISDIR' });
    fs.closeSync(fs.openSync(recordFileOf(home), 'a'));
  } catch (err) {
    stderr(`js-harness sessions start: could not write the record ${recordFileOf(home)} (${err.code ?? err.message}), so nothing was started`);
    return 1;
  }
  const briefs = briefsDirOf(home);
  const copy = path.join(briefs, `${new Date(now()).toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.md`);
  fs.mkdirSync(briefs, { recursive: true });
  fs.writeFileSync(copy, briefCopyOf(brief));
  // The sessions listed before the start, so a session found by its title afterwards is one this start made.
  let before = null;
  try {
    before = new Set(listAgents(claude).map((item) => item.id));
  } catch {
    // Without it no session is taken by its title; one whose id claude prints is still recorded.
  }
  let result;
  try {
    result = claude(startArgs({ ...parsed, briefs, prompt: startPrompt(copy) }), { cwd });
  } catch (err) {
    // A character cmd.exe would act on, in the title or a path: nothing ran.
    fs.rmSync(copy, { force: true });
    stderr(`js-harness sessions start: claude was not started: ${err.message}`);
    return 1;
  }
  // A run that began and did not finish (a timeout) may have started the session all the same: it is looked for.
  const began = result.error !== undefined && result.error !== null && result.error.code !== 'ENOENT';
  if (!began && (result.error || result.status !== 0)) {
    fs.rmSync(copy, { force: true });
    stderr(`js-harness sessions start: claude did not start the session (${result.error ? 'it could not run' : `exit ${result.status}`}), and nothing was recorded:\n${saidBy(result)}`);
    return 1;
  }
  if (began) stderr(`js-harness sessions start: claude did not finish (${result.error.message}); looking for the session in claude agents`);
  let id = began ? null : idOfStart(result.stdout);
  let agent;
  try {
    const agents = listAgents(claude);
    if (id !== null) agent = agents.find((item) => item.id === id);
    else {
      // In the folder asked for: the cwd itself, or a worktree of the name given (claude puts it under the main checkout).
      const asked = (folder) => (parsed.worktree ? path.basename(folder) === parsed.worktree && (within(folder, root) || within(folder, top)) : within(folder, cwd) && within(cwd, folder));
      const made = agents.filter((item) => item.kind === 'background' && item.name === parsed.title && before !== null && !before.has(item.id) && typeof item.cwd === 'string' && asked(item.cwd));
      if (made.length === 1) [agent] = made;
      id = agent?.id ?? null;
    }
  } catch {
    // The session id and the worktree are conveniences of the record; the short id is what stop and rm take.
  }
  if (id === null) {
    stderr(`js-harness sessions start: claude printed no id for the session, and claude agents lists no new session titled ${JSON.stringify(parsed.title)} in this project, so nothing is recorded: if claude agents lists it later, claude stop <id> and claude rm <id> remove it; its brief stays at ${copy}\n${saidBy(result)}`);
    return 1;
  }
  try {
    appendRecord(home, {
      event: 'started', at: new Date(now()).toISOString(), id, sessionId: agent?.sessionId ?? null, title: parsed.title, root, cwd,
      worktree: parsed.worktree ?? null, worktreePath: parsed.worktree ? agent?.cwd ?? null : null, model: parsed.model ?? null, effort: parsed.effort ?? null, remoteControl: parsed.remoteControl, brief: copy,
    });
  } catch (err) {
    const undone = [claude(['stop', id]), claude(['rm', id])].every((step) => !step.error && step.status === 0);
    stderr(`js-harness sessions start: the session ${id} started and could not be recorded (${err.code ?? err.message}), so ${undone ? 'it was stopped and removed' : `it still runs: claude stop ${id} and claude rm ${id} remove it`}`);
    return 1;
  }
  stdout(`started ${id} · ${parsed.title}`);
  stdout(`  js-harness sessions stop ${id} removes it; claude attach ${id} opens it here; js-harness sessions lists it`);
  if (parsed.remoteControl) stdout("  Remote Control is on: claude.ai/code and the user's phone reach it");
  return 0;
}

/** `sessions stop <id>`: exit 0 once the session is removed (or claude had already lost it) and its removal recorded,
 * 1 when the record holds no such session or claude refused (it stays recorded), 2 for a usage error. */
export function sessionsStopMain(argv, given = {}) {
  const deps = { ...defaults(), ...given };
  const { stdout, stderr, env, now } = deps;
  const [id, ...rest] = argv;
  let homeFlag;
  if (rest.length === 2 && rest[0] === '--home' && rest[1] !== '') homeFlag = rest[1];
  if (id === undefined || id.startsWith('--') || (rest.length > 0 && homeFlag === undefined)) {
    stderr(`js-harness sessions stop takes one id, the one sessions start printed\n\n${START_USAGE}`);
    return 2;
  }
  const home = harnessHome({ given: homeFlag, env, cwd: deps.cwd, homedir: deps.homedir });
  const record = readRecord(home);
  if (record.unavailable !== undefined) {
    stderr(`js-harness sessions stop: the record of background sessions could not be read (${record.unavailable}), so nothing was stopped`);
    return 1;
  }
  const entry = recordedNamed(record.sessions, id);
  if (entry === null) {
    stderr(`js-harness sessions stop: no session js-harness sessions start recorded is named by ${JSON.stringify(id)}, so nothing was stopped: it stops only the sessions it started (claude agents lists the others)`);
    return 1;
  }
  const claude = deps.claude === undefined ? claudeRunner({ env }) : deps.claude;
  if (claude === null) {
    stderr('js-harness sessions stop: claude is not on PATH: install the Claude Code CLI, then run this again');
    return 1;
  }
  const done = undoSession(entry, { home, run: claude, now });
  const name = `${entry.id} · ${entry.title}`;
  if (done.outcome === 'kept') {
    stderr(`js-harness sessions stop: ${name} is still recorded: ${done.why}`);
    return 1;
  }
  stdout(done.outcome === 'gone' ? `${name} was already gone: its record is closed` : `removed ${name}: its transcript stays, as every session's does`);
  if (done.worktreeKept) stdout(`  its worktree ${done.worktreeKept} stays: claude keeps a worktree with uncommitted changes, locked; git worktree remove --force twice removes it once they are not needed`);
  return 0;
}

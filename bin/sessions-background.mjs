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
import { appendRecord, atWork, backgroundDir, briefCopyOf, briefsDirOf, claudeRunner, idOfStart, listAgents, readRecord, recordFileOf, recordedNamed, resumePrompt, saidBy, startArgs, startPrompt, undoSession, within, worktreeOf } from './lib/background.mjs';
import { sessionEffortRefusal } from './lib/guard.mjs';
import { sessionTitleRefusal } from './lib/session-title-guard.mjs';
import { nextSessionNumber } from './lib/channel.mjs';
import { mainCheckout, projectCode, projectSlug } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';
// bin/sessions.mjs is at its size ceiling, so the live verb reaches it through the import it has of this module.
export { LIVE_USAGE, sessionsLiveMain } from './sessions-live.mjs';

export const START_USAGE = [
  'Usage: js-harness sessions start --title <title> --brief <file> [--worktree <name>] [--model <model>] [--effort <level>]',
  '                                 [--no-remote-control] [--cwd <path>] [--home <path>]',
  '       js-harness sessions start --resume <id> [--brief <file>] [--model <model>] [--effort <level>] [--no-remote-control] [--home <path>]',
  '       js-harness sessions stop <id> [--home <path>]',
  '         start runs claude --bg in the folder (a worktree of its own with --worktree), titled as start_session titles a session,',
  '         with Remote Control on (claude.ai/code and the phone reach it) unless --no-remote-control; the session reads a copy',
  '         of the brief that ends by telling it to report through js-harness notify --to orchestrator. It prints the id and records',
  '         the start under <home>/.js-harness/background/; exit 1 when claude is missing or refuses (nothing is recorded), 2 for a',
  '         usage error or a title or effort the rules session-title and session-effort refuse, where they are declared.',
  '         A run of claude that does not finish (a timeout) is looked for in claude agents and recorded when it started.',
  '         --resume resumes a recorded session whose job stopped (a restart ends every one) with claude --bg --resume, in a',
  '         new job in its folder, under its title, model and effort, and records the new job; one that still runs is refused.',
  '         The lead uses it only on a turn the user did not type, where start_session would leave a card: a background session',
  '         is not a row in the desktop sidebar. The board lists the project\'s background sessions, what each waits for',
  '         (a permission prompt included) and whether start recorded it; --watch returns when one starts waiting.',
  '         stop removes a session start recorded (claude stop, then claude rm; its transcript stays), and only such a one:',
  '         exit 1 for any other id, or when claude refuses (unpushed commits in its worktree), which keeps it recorded;',
  '         a worktree with uncommitted changes stays, and stop says where.',
  '         js-harness uninstall machine removes every recorded session that is not at work, and fails while one is.',
].join('\n');

class StartArgError extends Error {}

const VALUED = new Map([['--title', 'title'], ['--brief', 'brief'], ['--worktree', 'worktree'], ['--model', 'model'], ['--effort', 'effort'], ['--cwd', 'cwd'], ['--home', 'home'], ['--resume', 'resume']]);

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
  if (parsed.resume !== undefined) {
    // A resumed session is the one recorded: its title, worktree and folder are the record's.
    const own = ['title', 'worktree', 'cwd'].find((name) => parsed[name] !== undefined);
    if (own !== undefined) throw new StartArgError(`--resume takes no --${own}: the session is resumed with the record's`);
    return parsed;
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
  if (parsed.resume !== undefined) return resumeStart(parsed, deps);
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
  // What claude printed before it was cut short counts: the id is then known without the listing.
  let id = idOfStart(result.stdout ?? '');
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
      worktree: parsed.worktree ?? null, worktreePath: worktreeOf({ root, worktree: parsed.worktree, worktreePath: agent?.cwd }), model: parsed.model ?? null, effort: parsed.effort ?? null, remoteControl: parsed.remoteControl, brief: copy,
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

/** `sessions start --resume <id>`: the recorded session `id` names, whose job stopped (a restart of the machine ends every
 * one), resumed with `claude --bg --resume` in a new job, in the folder it worked in, under its title, model and effort
 * (`--model`, `--effort` and `--brief` replace the record's). The new job is recorded with `resumedFrom`; the stopped one
 * stays recorded, since `claude rm` of it could remove the worktree the new job works in. Exit 0 once the new job runs
 * and is recorded; 1 when the record holds no such session, it still runs or that cannot be told, its folder is gone,
 * or claude refuses or prints no id; 2 for a brief that cannot be read. */
function resumeStart(parsed, deps) {
  const { stdout, stderr, env, now, readFile } = deps;
  const refuse = (line, code = 1) => {
    stderr(`js-harness sessions start --resume: ${line}`);
    return code;
  };
  const home = harnessHome({ given: parsed.home, env, cwd: deps.cwd, homedir: deps.homedir });
  const record = readRecord(home);
  if (record.unavailable !== undefined) return refuse(`the record of background sessions could not be read (${record.unavailable}), so nothing was resumed`);
  const entry = recordedNamed(record.sessions, parsed.resume);
  if (entry === null || typeof entry.sessionId !== 'string') {
    return refuse(`no session js-harness sessions start recorded with its conversation is named by ${JSON.stringify(parsed.resume)}, so nothing was resumed`);
  }
  const name = `${entry.id} · ${entry.title}`;
  const claude = deps.claude === undefined ? claudeRunner({ env }) : deps.claude;
  if (claude === null) return refuse('claude is not on PATH: install the Claude Code CLI, then run this again');
  let agent;
  try {
    agent = listAgents(claude).find((item) => item.id === entry.id);
  } catch (err) {
    return refuse(`whether ${name} still runs cannot be told (${err.message}), so it was not resumed`);
  }
  if (atWork(agent)) return refuse(`${name} is ${agent.status ?? agent.state}: one that still runs is not resumed (claude attach ${entry.id} opens it)`);
  const folder = worktreeOf(entry) ?? entry.cwd;
  if (typeof folder !== 'string' || !fs.existsSync(folder)) return refuse(`the folder ${name} worked in, ${folder}, is gone, so it was not resumed`);
  let copy = entry.brief;
  if (parsed.brief !== undefined) {
    let text;
    try {
      text = readFile(path.resolve(deps.cwd, parsed.brief));
    } catch (err) {
      return refuse(`could not read the brief ${parsed.brief} (${err.code ?? err.message})`, 2);
    }
    copy = path.join(briefsDirOf(home), `${new Date(now()).toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.md`);
    fs.mkdirSync(briefsDirOf(home), { recursive: true });
    fs.writeFileSync(copy, briefCopyOf(text));
  }
  const model = parsed.model ?? entry.model ?? undefined;
  const effort = parsed.effort ?? entry.effort ?? undefined;
  const remoteControl = parsed.remoteControl && entry.remoteControl !== false;
  const result = claude(startArgs({ title: entry.title, briefs: briefsDirOf(home), model, effort, remoteControl, prompt: resumePrompt(copy), resume: entry.sessionId }), { cwd: folder });
  const id = idOfStart(result.stdout ?? '');
  if (id === null && copy !== entry.brief) fs.rmSync(copy, { force: true });
  if (id === null) return refuse(`claude did not resume ${name} (${result.error ? result.error.message : `exit ${result.status}`}), and nothing was recorded:\n${saidBy(result)}`);
  let resumed;
  try {
    resumed = listAgents(claude).find((item) => item.id === id);
  } catch {
    // The new session id is a convenience of the record, as in a start.
  }
  appendRecord(home, {
    event: 'started', at: new Date(now()).toISOString(), id, sessionId: resumed?.sessionId ?? null, title: entry.title, root: entry.root, cwd: entry.cwd,
    worktree: entry.worktree ?? null, worktreePath: worktreeOf(entry), model: model ?? null, effort: effort ?? null, remoteControl, brief: copy, resumedFrom: entry.id,
  });
  stdout(`resumed ${entry.id} as ${id} · ${entry.title}`);
  stdout(`  js-harness sessions stop ${id} removes the new job, and sessions stop ${entry.id} the one that stopped; claude attach ${id} opens it here`);
  return 0;
}

/** `sessions --next-number` (odd/tasks/session-title.md, S2, S5): the number the next work session is titled with,
 * the one the guard names when it refuses a start_session or a `sessions start` of another title. It reads the
 * project's code from its harness.json, then the channel's record, the openings and the record of `sessions start`,
 * and writes nothing. Exit 1 is a project that declares no code; a code or a source that could not be read is exit 2,
 * so "could not look" is never read as "none". */
export function nextNumberMain({ root, home, slug, readFile, readdir, stdout, stderr }) {
  let code;
  try {
    ({ code } = projectCode(root, readFile));
  } catch (err) {
    stderr(`js-harness sessions: could not read the project's code: ${err.message}`);
    return 2;
  }
  if (code === null) {
    stderr(`js-harness sessions: ${path.join(root, 'harness.json')} declares no "code", the project's identifier a session's title starts with (such as "JH"): add it to give the next number`);
    return 1;
  }
  const next = nextSessionNumber(home, slug, { code, readdir, readFile });
  for (const source of next.unavailable ?? []) stderr(`js-harness sessions: could not read ${source}: the number may be taken`);
  stdout(`${next.code} ${next.number}`);
  return next.unavailable ? 2 : 0;
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
  if (done.worktreeGone) stdout(`  its worktree ${done.worktreeGone} is gone`);
  return 0;
}

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
import { appendRecord, atWork, backgroundDir, briefCopyOf, briefsDirOf, claudeRunner, idOfStart, listAgents, readRecord, recordFileOf, recordedNamed, resumedNote, resumePrompt, saidBy, startArgs, startPrompt, strandedWords, undoSession, within, worktreeOf } from './lib/background.mjs';
import { sessionEffortRefusal } from './lib/guard.mjs';
import { sessionTitleRefusal } from './lib/session-title-guard.mjs';
import { appendNotice, newNotice, nextSessionNumber, placeOf, readNotices } from './lib/channel.mjs';
import { mainCheckout, projectCode, projectSlug, sameSession } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';
// bin/sessions.mjs is at its size ceiling, so the live verb reaches it through the import it has of this module.
export { LIVE_USAGE, sessionsLiveMain } from './sessions-live.mjs';

export const START_USAGE = [
  'Usage: js-harness sessions start --title <title> --brief <file> [--worktree <name>] [--model <model>] [--effort <level>]',
  '                                 [--advisor <model>] [--no-remote-control] [--cwd <path>] [--home <path>]',
  '       js-harness sessions start --resume <id> [--brief <file>] [--model <model>] [--effort <level>] [--advisor <model>]',
  '                                 [--no-remote-control] [--home <path>]',
  '       js-harness sessions stop <id> [--home <path>]',
  '         start runs claude --bg in the folder (a worktree of its own with --worktree), titled as start_session titles a session,',
  '         with Remote Control on (claude.ai/code and the phone reach it) unless --no-remote-control; the session reads a copy',
  '         of the brief that ends by telling it to report through js-harness notify --to orchestrator. It prints the id and records',
  '         the start under <home>/.js-harness/background/; exit 1 when claude is missing or refuses (nothing is recorded), 2 for a',
  '         usage error or a title or effort the rules session-title and session-effort refuse, where they are declared.',
  '         A run of claude that does not finish (a timeout) is looked for in claude agents and recorded when it started.',
  '         --advisor passes claude --advisor <model> (a stronger model the session consults); it is recorded with the start.',
  '         --resume resumes a recorded session whose job stopped (a restart ends every one) with claude --bg --resume, in a',
  '         new job in its folder, under its title, model, effort and advisor, and records the new job; one that still runs is refused.',
  '         The lead uses it only on a turn the user did not type, where start_session would leave a card: a background session',
  '         is not a row in the desktop sidebar. The board lists the project\'s background sessions, what each waits for',
  '         (a permission prompt included) and whether start recorded it; --watch returns when one starts waiting.',
  '         stop removes a session start recorded (claude stop, then claude rm; its transcript stays), and only such a one:',
  '         exit 1 for any other id, or when claude refuses (unpushed commits in its worktree), which keeps it recorded;',
  '         a worktree with uncommitted changes stays, and stop says where.',
  '         js-harness uninstall machine removes every recorded session that is not at work, and fails while one is.',
].join('\n');

class StartArgError extends Error {}

const VALUED = new Map([['--title', 'title'], ['--brief', 'brief'], ['--worktree', 'worktree'], ['--model', 'model'], ['--effort', 'effort'], ['--advisor', 'advisor'], ['--cwd', 'cwd'], ['--home', 'home'], ['--resume', 'resume']]);

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

/** Why the record under `home` cannot be written, or null. It is opened before claude runs: a session started that
 * cannot be recorded is one nothing undoes. */
function recordUnwritable(home) {
  try {
    fs.mkdirSync(backgroundDir(home), { recursive: true });
    // Windows opens a folder for appending without an error, so a record that is not a file is refused by name.
    if (fs.existsSync(recordFileOf(home)) && !fs.statSync(recordFileOf(home)).isFile()) throw Object.assign(new Error('not a file'), { code: 'EISDIR' });
    fs.closeSync(fs.openSync(recordFileOf(home), 'a'));
    return null;
  } catch (err) {
    return `could not write the record ${recordFileOf(home)} (${err.code ?? err.message})`;
  }
}

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

  const unwritable = recordUnwritable(home);
  if (unwritable !== null) {
    stderr(`js-harness sessions start: ${unwritable}, so nothing was started`);
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
  // The board's first row of the session is stamped with the time it was launched, before any notice it sends itself.
  const launchedAt = new Date(now()).toISOString();
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
  const entry = {
    event: 'started', at: new Date(now()).toISOString(), id, sessionId: agent?.sessionId ?? null, title: parsed.title, root, cwd,
    worktree: parsed.worktree ?? null, worktreePath: worktreeOf({ root, worktree: parsed.worktree, worktreePath: agent?.cwd }), model: parsed.model ?? null, effort: parsed.effort ?? null, advisor: parsed.advisor ?? null, remoteControl: parsed.remoteControl, brief: copy,
  };
  try {
    appendRecord(home, entry);
  } catch (err) {
    const undone = [claude(['stop', id]), claude(['rm', id])].every((step) => !step.error && step.status === 0);
    // One claude would not undo is kept where stop and the machine uninstall find it (Codex finding 4 on 54c7e39..e7aa7ec).
    stderr(`js-harness sessions start: the session ${id} started and could not be recorded (${err.code ?? err.message}), so ${undone ? 'it was stopped and removed' : `claude did not remove it${strandedWords(home, entry)}`}`);
    return 1;
  }
  // The live board shows the session from its start (odd/tasks/visual-pages.md, spec 4): an `opened` row in the
  // channel record, from the session itself. It is the board's, not the start's: one that cannot be written is said
  // and the session stays.
  try {
    const slug = projectSlug(root);
    const sender = agent?.sessionId ?? id;
    // The place as a notice records it (`placeOf`): the worktree's absolute path, which readers hand to git. Read
    // before the record, so nothing runs between reading it and appending.
    const folder = worktreeOf({ root, worktree: parsed.worktree, worktreePath: agent?.cwd }) ?? cwd;
    const place = placeOf(run, folder);
    const record = readNotices(home, slug);
    if (record.unavailable !== undefined) throw new Error(`${record.path} cannot be read (${record.unavailable})`);
    // `sessions` keeps a session's newest state by its time (`recordOfRows`, odd/tasks/visual-pages.md, T5e), and this
    // row's is the launch, before any notice the session sends: one it appends between the read and the append stays
    // ahead of this row. Once the session wrote, its own rows show it and none is written.
    if (!record.notices.some((notice) => sameSession(notice.from?.id, sender))) {
      appendNotice(home, slug, newNotice({
        at: launchedAt, from: { host: 'claude-code', id: sender, source: 'sessions start', title: parsed.title },
        to: 'orchestrator', kind: 'opened', text: `started by sessions start: ${parsed.title}`, cwd: folder,
        worktree: parsed.worktree ? path.resolve(folder) : place.worktree, branch: place.branch,
      }));
    }
  } catch (err) {
    stderr(`js-harness sessions start: the board's first row of ${id} could not be written (${err.code ?? err.message}); the session runs and its own notices still reach the board`);
  }
  stdout(`started ${id} · ${parsed.title}`);
  stdout(`  js-harness sessions stop ${id} removes it; claude attach ${id} opens it here; js-harness sessions lists it`);
  if (parsed.remoteControl) stdout("  Remote Control is on: claude.ai/code and the user's phone reach it");
  return 0;
}

/** `sessions start --resume <id>`: the recorded session `id` names, whose job stopped (a restart of the machine ends every
 * one), resumed with `claude --bg --resume` in a new job, in the folder it worked in, under its title, model, effort and
 * advisor (`--model`, `--effort`, `--advisor` and `--brief` replace the record's), held to the effort rule as a start is. The new job is
 * recorded with `resumedFrom`, and replaces the stopped one, which stays recorded: the two share a worktree and a brief,
 * so they are undone together (`undoSession`). Exit 0 once the new job runs and is recorded; 1 when the record holds no
 * such session or cannot be written, a job works its conversation or that cannot be told, its folder is gone, or claude
 * refuses or no new job can be found; 2 for a brief that cannot be read or an effort the rule refuses. */
function resumeStart(parsed, deps) {
  const { stdout, stderr, env, now, run, readFile } = deps;
  const refuse = (line, code = 1) => {
    stderr(`js-harness sessions start --resume: ${line}`);
    return code;
  };
  const home = harnessHome({ given: parsed.home, env, cwd: deps.cwd, homedir: deps.homedir });
  const record = readRecord(home);
  if (record.unavailable !== undefined) return refuse(`the record of background sessions could not be read (${record.unavailable}), so nothing was resumed`);
  const entry = recordedNamed(record.sessions, parsed.resume);
  if (entry !== null && record.resumedAs.has(entry.id)) return refuse(resumedNote(record.resumedAs, entry.id, (last) => `js-harness sessions start --resume ${last} resumes it`));
  if (entry === null || typeof entry.sessionId !== 'string') {
    return refuse(`no session js-harness sessions start recorded with its conversation is named by ${JSON.stringify(parsed.resume)}, so nothing was resumed`);
  }
  const name = `${entry.id} · ${entry.title}`;
  const claude = deps.claude === undefined ? claudeRunner({ env }) : deps.claude;
  if (claude === null) return refuse('claude is not on PATH: install the Claude Code CLI, then run this again');
  let agents;
  try {
    agents = listAgents(claude);
  } catch (err) {
    return refuse(`whether ${name} still runs cannot be told (${err.message}), so it was not resumed`);
  }
  // Every job on its conversation: its own, and one resumed by hand under another id.
  const live = agents.find((item) => atWork(item) && (item.id === entry.id || item.sessionId === entry.sessionId));
  if (live !== undefined) {
    const who = live.id === entry.id ? name : `${name}: its conversation runs in ${live.id}${live.name ? ` · ${live.name}` : ''}, which`;
    return refuse(`${who} is ${live.status ?? live.state}: a conversation a job works is not resumed (claude attach ${live.id} opens it)`);
  }
  const folder = worktreeOf(entry) ?? entry.cwd;
  if (typeof folder !== 'string' || !fs.existsSync(folder)) return refuse(`the folder ${name} worked in, ${folder}, is gone, so it was not resumed`);
  const briefPath = parsed.brief === undefined ? entry.brief : path.resolve(deps.cwd, parsed.brief);
  let text;
  try {
    text = readFile(briefPath);
  } catch (err) {
    return refuse(`could not read the brief ${briefPath} (${err.code ?? err.message})${parsed.brief === undefined ? '; --brief gives it another' : ''}`, 2);
  }
  const model = parsed.model ?? entry.model ?? undefined;
  const effort = parsed.effort ?? entry.effort ?? undefined;
  const advisor = parsed.advisor ?? entry.advisor ?? undefined;
  const refusal = sessionEffortRefusal({ prompt: text, effort }, rulesText(topLevel(run, folder), readFile), { cli: true });
  if (refusal !== null) return refuse(refusal, 2);
  const unwritable = recordUnwritable(home);
  if (unwritable !== null) return refuse(`${unwritable}, so nothing was resumed`);
  let copy = entry.brief;
  if (parsed.brief !== undefined) {
    copy = path.join(briefsDirOf(home), `${new Date(now()).toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.md`);
    fs.mkdirSync(briefsDirOf(home), { recursive: true });
    fs.writeFileSync(copy, briefCopyOf(text));
  }
  const drop = () => copy !== entry.brief && fs.rmSync(copy, { force: true });
  const remoteControl = parsed.remoteControl && entry.remoteControl !== false;
  let result;
  try {
    result = claude(startArgs({ title: entry.title, briefs: briefsDirOf(home), model, effort, advisor, remoteControl, prompt: resumePrompt(copy), resume: entry.sessionId }), { cwd: folder });
  } catch (err) {
    drop();
    return refuse(`claude was not started: ${err.message}`);
  }
  // As in a start: a run that began and did not finish may have resumed it all the same, and is looked for.
  const began = result.error !== undefined && result.error !== null && result.error.code !== 'ENOENT';
  if (!began && (result.error || result.status !== 0)) {
    drop();
    return refuse(`claude did not resume ${name} (${result.error ? 'it could not run' : `exit ${result.status}`}), and nothing was recorded:\n${saidBy(result)}`);
  }
  if (began) stderr(`js-harness sessions start --resume: claude did not finish (${result.error.message}); looking for the new job in claude agents`);
  let id = idOfStart(result.stdout ?? '');
  let resumed;
  try {
    const after = listAgents(claude);
    if (id !== null) resumed = after.find((item) => item.id === id);
    else {
      const before = new Set(agents.map((item) => item.id));
      const made = after.filter((item) => item.kind === 'background' && item.name === entry.title && !before.has(item.id) && typeof item.cwd === 'string' && within(item.cwd, folder) && within(folder, item.cwd));
      if (made.length === 1) [resumed] = made;
      id = resumed?.id ?? null;
    }
  } catch {
    // The new session id is a convenience of the record; the conversation the resume named stands in for it.
  }
  if (id === null) {
    return refuse(`claude printed no id for the new job, and claude agents lists no new job titled ${JSON.stringify(entry.title)} in ${folder}, so nothing is recorded: if claude agents lists it later, claude stop <id> stops it; its brief stays at ${copy}\n${saidBy(result)}`);
  }
  const job = {
    event: 'started', at: new Date(now()).toISOString(), id, sessionId: resumed?.sessionId ?? entry.sessionId, title: entry.title, root: entry.root, cwd: entry.cwd,
    worktree: entry.worktree ?? null, worktreePath: worktreeOf(entry), model: model ?? null, effort: effort ?? null, advisor: advisor ?? null, remoteControl, brief: copy, resumedFrom: entry.id,
  };
  try {
    appendRecord(home, job);
  } catch (err) {
    // Stopped, not removed: the worktree and the brief are the stopped job's too. Its entry is kept as a start's is.
    const stop = claude(['stop', id]);
    const stopped = !stop.error && stop.status === 0;
    return refuse(`the job ${id} resumed ${name} and could not be recorded (${err.code ?? err.message}), so ${stopped ? 'it was stopped' : 'it still runs'}${strandedWords(home, job)}`);
  }
  stdout(`resumed ${entry.id} as ${id} · ${entry.title}`);
  stdout(`  js-harness sessions stop ${id} removes it and ${entry.id}, the job it resumed; claude attach ${id} opens it here`);
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
  // A record that cannot be read still gives its stranded starts (readRecord): such a one is stopped; any other id is
  // not, since the record may hold it.
  const entry = recordedNamed(record.unavailable === undefined ? record.sessions : record.stranded ?? [], id);
  if (record.unavailable !== undefined && entry === null) {
    stderr(`js-harness sessions stop: the record of background sessions could not be read (${record.unavailable}), so nothing was stopped`);
    return 1;
  }
  if (entry === null) {
    stderr(`js-harness sessions stop: no session js-harness sessions start recorded is named by ${JSON.stringify(id)}, so nothing was stopped: it stops only the sessions it started (claude agents lists the others)`);
    return 1;
  }
  if (record.resumedAs?.has(entry.id)) {
    stderr(`js-harness sessions stop: ${resumedNote(record.resumedAs, entry.id, (last) => `js-harness sessions stop ${last} removes both`)}, since they share a worktree and a brief; nothing was stopped`);
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
  if (done.worktreeMissing) stdout(`  its worktree ${done.worktreeMissing} was not there when stop ran: claude never made it, or something else removed it`);
  return 0;
}

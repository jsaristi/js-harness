#!/usr/bin/env node
// `js-harness wake`: after a boot, which sessions of the project were open before it, what each must read to
// resume and which of its declared waits the boot killed; with --notify, a note to each and a list for the
// orchestrator, once per boot. bin/lib/wake.mjs says why and how a plan is read.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { appendNotice, findOpenings, newNotice, NOTICE_TEXT_MAX, openingCommand, readNotices } from './lib/channel.mjs';
import { remoteId, UNSAFE_IN_BATCH } from './lib/remote.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { removeStartupFile, writeStartupFile } from './lib/startup-file.mjs';
import { quoteWindowsArg, windowsCommandLine } from './lib/windows-args.mjs';
import { WAKE_WINDOW_MS, wakePlan, wakeText } from './lib/wake.mjs';

export const USAGE = [
  'Usage: js-harness wake [--notify] [--boot-time <iso>] [--cwd <path>] [--claude-home <path>] [--home <path>]',
  '       js-harness wake --at-login [--remove] [--cwd <path>] [--claude-home <path>] [--home <path>]',
  '',
  'Lists the sessions of the project that were open before the machine last booted (an entry in the 12 hours',
  'before it), each with the command that prints its stored opening and the `js-harness wait` calls the boot',
  'killed. With --notify it leaves each session whose title names a role a note in the channel, which the',
  'inbox hook tells it on its next tool call, and leaves the orchestrator the list of sessions to wake with',
  'send_message; a second run after the same boot records nothing. --boot-time replaces the boot the clock',
  'and the uptime give. --at-login writes a file in the Windows Startup folder that runs wake --notify for this',
  'project at each login, recorded in the machine manifest so that uninstall removes it; --at-login --remove',
  'removes it now. A file there that js-harness did not write, or one changed since, is kept.',
].join('\n');

/** This command's own file, which the Startup file runs. */
const SELF = fileURLToPath(import.meta.url);

/** The name of the Startup file of the project `id`. */
const startupName = (id) => `js-harness-wake-${id}.cmd`;

/** The text of the Startup file: a batch file whose one command runs `node <this file> --notify --cwd <root>`.
 * Every line ends in CRLF, and a `chcp 65001` line comes first when the command holds a letter beyond ASCII
 * (`loginLauncher` in bin/lib/remote.mjs says why). Throws, naming the value, when one holds what cmd.exe acts
 * on: a file that runs something else at every login is worse than none. */
function startupText({ node, root, home, claudeHome }) {
  const values = { 'the node executable': node, 'this install of js-harness': SELF, 'the project folder': root, 'the home': home, 'the Claude home': claudeHome };
  for (const [label, value] of Object.entries(values)) {
    const found = value === undefined ? null : UNSAFE_IN_BATCH.exec(value);
    if (found) throw new Error(`the Startup file cannot hold ${label} ${JSON.stringify(value)}: it has ${JSON.stringify(found[0])}, and cmd.exe acts on & | < > ^ % " ! and control characters in a batch file`);
  }
  const quoted = quoteWindowsArg(node);
  const command = windowsCommandLine(quoted.startsWith('"') ? quoted : `"${quoted}"`, [
    SELF, '--notify', '--cwd', root,
    // A home other than the user's own is named, or the run at login, which has neither variable a shell set,
    // would read and write the default ones (Codex, 2026-10-15).
    ...(home === undefined ? [] : ['--home', home]),
    ...(claudeHome === undefined ? [] : ['--claude-home', claudeHome]),
  ]);
  return [
    '@echo off',
    'rem Leaves each session of one project a note after a boot. Written by js-harness wake --at-login; js-harness wake --at-login --remove removes it.',
    ...(/[^\x00-\x7f]/.test(command) ? ['chcp 65001 >nul'] : []),
    command,
    '',
  ].join('\r\n');
}

/** Two reads of the boot an uptime gives differ by seconds; notes this close to the boot are of the same one. */
const SAME_BOOT_MS = 2 * 60 * 1000;

const BOOTED = /^The machine booted at (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)/;

function parseArgs(argv) {
  const parsed = { notify: false, atLogin: false, remove: false };
  const flags = new Map([['--notify', 'notify'], ['--at-login', 'atLogin'], ['--remove', 'remove']]);
  const paths = new Map([['--cwd', 'cwd'], ['--claude-home', 'claudeHome'], ['--home', 'home'], ['--boot-time', 'bootTime']]);
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (flags.has(token)) parsed[flags.get(token)] = true;
    else if (paths.has(token)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) throw new Error(`${token} takes a value`);
      parsed[paths.get(token)] = value;
    } else throw new Error(`unknown argument: ${token}`);
  }
  if (parsed.remove && !parsed.atLogin) throw new Error('--remove goes with --at-login');
  if (parsed.atLogin && (parsed.notify || parsed.bootTime !== undefined)) throw new Error('--at-login takes neither --notify nor --boot-time: the file it writes runs wake --notify at each login');
  if (parsed.bootTime !== undefined && !Number.isFinite(Date.parse(parsed.bootTime))) throw new Error(`--boot-time takes a time, as 2026-10-15T04:52:00Z: ${parsed.bootTime}`);
  return parsed;
}

/** How a session of the plan is named in a list: its title, or the start of its id when it has none. */
const nameOf = (one) => one.title ?? `session ${one.id.slice(0, 8)}`;

/** The orchestrator's note: the sessions open before the boot, whom to wake, and those no note reaches. A list
 * too long for a notice names as many as fit and says how many it left out; the command that prints them all
 * always ends it, since a session left out of the list stays idle until someone messages it. */
function listText(plan, bootAt) {
  const noted = plan.filter((one) => one.role !== null).map(nameOf);
  const unreached = plan.filter((one) => one.role === null).map(nameOf);
  const head = `The machine booted at ${bootAt}: ${plan.length} session${plan.length === 1 ? ' was' : 's were'} open before it.`;
  const tail = ` js-harness wake --boot-time ${bootAt} prints what to tell each.`;
  const text = (notedCount, unreachedCount) => {
    const left = noted.length - notedCount + unreached.length - unreachedCount;
    return [
      head,
      notedCount === 0 ? '' : ` Each of these has its note, told on its next tool call; wake each with send_message: ${noted.slice(0, notedCount).join('; ')}.`,
      unreachedCount === 0 ? '' : ` No note reaches (no role in the title): ${unreached.slice(0, unreachedCount).join('; ')}.`,
      left === 0 ? '' : ` And ${left} more.`,
      tail,
    ].join('');
  };
  // The sessions no note reaches come first: the orchestrator is the only one who can tell them.
  let unreachedCount = unreached.length;
  let notedCount = noted.length;
  while (text(notedCount, unreachedCount).length > NOTICE_TEXT_MAX && notedCount > 0) notedCount -= 1;
  while (text(notedCount, unreachedCount).length > NOTICE_TEXT_MAX && unreachedCount > 0) unreachedCount -= 1;
  return text(notedCount, unreachedCount);
}

export async function wakeMain(
  argv = [],
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    now = Date.now,
    homedir = os.homedir,
    hostname = os.hostname,
    uptime = os.uptime,
    execPath = process.execPath,
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }),
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  const root = mainCheckout(run, path.resolve(parsed.cwd ?? defaultCwd));
  // The harness home (the channel, the machine manifest) and the Claude home (the transcripts). An empty
  // JS_HARNESS_HOME is no home: joined as it is, it would name the folder the command runs in.
  const harnessHome = parsed.home !== undefined ? path.resolve(parsed.home) : env.JS_HARNESS_HOME || homedir();
  const defaultClaudeHome = path.join(homedir(), '.claude');
  const claudeHome = parsed.claudeHome !== undefined ? path.resolve(parsed.claudeHome) : env.CLAUDE_CONFIG_DIR || defaultClaudeHome;
  if (parsed.atLogin) {
    const home = harnessHome;
    const name = startupName(remoteId(root));
    if (parsed.remove) {
      const removed = removeStartupFile({ env, home, name });
      if (removed.refusal) {
        stderr(`js-harness wake: ${removed.refusal}.`);
        return 1;
      }
      stdout(`wake at login: off (${removed.removed ? `removed ${removed.file}` : 'there was none'})`);
      return 0;
    }
    let content;
    try {
      const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
      content = startupText({
        node: execPath,
        root,
        home: same(harnessHome, homedir()) ? undefined : harnessHome,
        claudeHome: same(claudeHome, defaultClaudeHome) ? undefined : claudeHome,
      });
    } catch (err) {
      stderr(`js-harness wake: ${err.message}.`);
      return 1;
    }
    const written = writeStartupFile({ env, home, name, content });
    if (written.refusal) {
      stderr(`js-harness wake: ${written.refusal}.`);
      return 1;
    }
    stdout(`wake at login: on (${written.written ? 'wrote' : 'already there:'} ${written.file}); it runs at each login, and js-harness wake --at-login --remove removes it.`);
    return 0;
  }
  const slug = projectSlug(root);
  const projectDir = path.join(claudeHome, 'projects', slug);
  const bootMs = parsed.bootTime !== undefined ? Date.parse(parsed.bootTime) : now() - uptime() * 1000;
  const bootAt = new Date(bootMs).toISOString();

  // Only a transcript written since the window opened can hold an entry inside it.
  let names;
  try {
    names = fs.readdirSync(projectDir).filter((name) => name.endsWith('.jsonl'));
  } catch (err) {
    stderr(`js-harness wake: no sessions folder for this project at ${projectDir} (${err.code ?? err.message})`);
    return 1;
  }
  const transcripts = [];
  for (const name of names) {
    const file = path.join(projectDir, name);
    try {
      if (fs.statSync(file).mtimeMs < bootMs - WAKE_WINDOW_MS) continue;
      transcripts.push({ id: name.slice(0, -'.jsonl'.length), text: fs.readFileSync(file, 'utf8') });
    } catch {
      // A transcript removed while this read is no session to wake.
    }
  }
  const record = readNotices(harnessHome, slug);
  // The newest opening the title names, by its whole title or its code and role (`findOpenings`), read by the
  // command `sessions --opening` takes; a title that command cannot take whole is named by the session's own.
  let openingsUnread = null;
  const openingOf = (title) => {
    const found = findOpenings(harnessHome, slug, title);
    if (found.unavailable !== undefined) openingsUnread ??= `the openings folder ${found.dir} (${found.unavailable})`;
    const [newest] = found.openings;
    return newest === undefined ? null : (openingCommand(newest.title) ?? openingCommand(title));
  };
  const plan = wakePlan({ bootAt, transcripts, readings: record.readings, openingOf });

  stdout(`The machine booted at ${bootAt}. ${plan.length} session${plan.length === 1 ? ' was' : 's were'} open before it (an entry in the 12 hours before).`);
  for (const one of plan) {
    stdout('');
    stdout(`${nameOf(one)}  (last entry ${one.lastAt}, ${one.id})`);
    if (one.role === null) stdout('  no role to address a note to: its title does not name one; message it yourself.');
    stdout(`  opening: ${one.opening ?? 'none stored'}`);
    stdout(`  waits the boot killed:${one.waits.length === 0 ? ' none' : ''}`);
    for (const wait of one.waits) stdout(`    ${wait}`);
    if (one.killed > 0) stdout(`  other background work the boot killed, not a declared wait: ${one.killed}`);
    stdout(`  tell it: ${wakeText(one, bootAt)}`);
  }
  stdout('');
  // A record or an openings folder that is there and cannot be read is no empty one. The list above still
  // stands, since it is what the boot left to read; no note is written, because a second run would read the
  // record as holding none of this boot's notes and write them again.
  const unread = [
    record.unavailable ? `the record ${record.path} (${record.unavailable})` : null,
    openingsUnread,
  ].filter(Boolean);
  if (unread.length > 0) {
    stderr(`js-harness wake: could not read ${unread.join(' and ')}, so no note is recorded.`);
    return 1;
  }
  if (!parsed.notify) {
    stdout('no note recorded: run with --notify to leave each session its note.');
    return 0;
  }
  if (plan.length === 0) {
    stdout('no note recorded: no session was open before the boot.');
    return 0;
  }
  const already = record.notices.some((notice) => {
    const said = notice.from?.source === 'wake' ? BOOTED.exec(notice.text) : null;
    return said !== null && Math.abs(Date.parse(said[1]) - bootMs) <= SAME_BOOT_MS;
  });
  if (already) {
    stdout(`no note recorded: the notes are already recorded for this boot (${record.path}).`);
    return 0;
  }
  const from = { host: hostname(), id: null, source: 'wake', title: 'js-harness wake' };
  const notes = [
    ...plan.filter((one) => one.role !== null).map((one) => ({ to: one.role.role === 'orchestrator' ? 'orchestrator' : String(one.role.number), text: wakeText(one, bootAt) })),
    { to: 'orchestrator', text: listText(plan, bootAt) },
  ];
  // Every notice is made before the first is written: one the record would refuse must not leave the boot
  // half told, since a later run takes any note of this boot as all of them.
  const at = new Date(now()).toISOString();
  const notices = notes.map((note) => newNotice({ at, from, to: note.to, kind: 'note', text: note.text }));
  for (const notice of notices) appendNotice(harnessHome, slug, notice);
  stdout(`${notes.length} notes recorded in ${record.path}.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await wakeMain(process.argv.slice(2));
}

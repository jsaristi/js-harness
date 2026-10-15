#!/usr/bin/env node
// `js-harness wake`: after a boot, which sessions of the project were open before it, what each must read to
// resume and which of its declared waits the boot killed; with --notify, a note to each and a list for the
// orchestrator, once per boot. bin/lib/wake.mjs says why and how a plan is read.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { appendNotice, findOpenings, newNotice, NOTICE_TEXT_MAX, openingCommand, readNotices } from './lib/channel.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { WAKE_WINDOW_MS, wakePlan, wakeText } from './lib/wake.mjs';

const USAGE = [
  'Usage: js-harness wake [--notify] [--boot-time <iso>] [--cwd <path>] [--claude-home <path>]',
  '',
  'Lists the sessions of the project that were open before the machine last booted (an entry in the 12 hours',
  'before it), each with the command that prints its stored opening and the `js-harness wait` calls the boot',
  'killed. With --notify it leaves each session whose title names a role a note in the channel, which the',
  'inbox hook tells it on its next tool call, and leaves the orchestrator the list of sessions to wake with',
  'send_message; a second run after the same boot records nothing. --boot-time replaces the boot the clock',
  'and the uptime give.',
].join('\n');

/** Two reads of the boot an uptime gives differ by seconds; notes this close to the boot are of the same one. */
const SAME_BOOT_MS = 2 * 60 * 1000;

const BOOTED = /^The machine booted at (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)/;

function parseArgs(argv) {
  const parsed = { notify: false };
  const paths = new Map([['--cwd', 'cwd'], ['--claude-home', 'claudeHome'], ['--boot-time', 'bootTime']]);
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--notify') parsed.notify = true;
    else if (paths.has(token)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) throw new Error(`${token} takes a value`);
      parsed[paths.get(token)] = value;
    } else throw new Error(`unknown argument: ${token}`);
  }
  if (parsed.bootTime !== undefined && !Number.isFinite(Date.parse(parsed.bootTime))) throw new Error(`--boot-time takes a time, as 2026-10-15T04:52:00Z: ${parsed.bootTime}`);
  return parsed;
}

/** How a session of the plan is named in a list: its title, or the start of its id when it has none. */
const nameOf = (one) => one.title ?? `session ${one.id.slice(0, 8)}`;

/** The orchestrator's note: the sessions open before the boot, whom to wake, and those no note reaches. */
function listText(plan, bootAt) {
  const noted = plan.filter((one) => one.role !== null).map(nameOf);
  const unreached = plan.filter((one) => one.role === null).map(nameOf);
  const parts = [
    `The machine booted at ${bootAt}: ${plan.length} session${plan.length === 1 ? ' was' : 's were'} open before it.`,
    noted.length === 0 ? '' : ` Each of these has its note, told on its next tool call; wake each with send_message: ${noted.join('; ')}.`,
    unreached.length === 0 ? '' : ` No note reaches (no role in the title): ${unreached.join('; ')}.`,
    ` js-harness wake --boot-time ${bootAt} prints what to tell each.`,
  ];
  const text = parts.join('');
  return text.length <= NOTICE_TEXT_MAX ? text : `${text.slice(0, NOTICE_TEXT_MAX - 1)}…`;
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
  const slug = projectSlug(root);
  const claudeHome = parsed.claudeHome ?? env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude');
  const projectDir = path.join(claudeHome, 'projects', slug);
  const harnessHome = env.JS_HARNESS_HOME || homedir();
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
  const openingOf = (title) => {
    const [newest] = findOpenings(harnessHome, slug, title).openings;
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
  for (const note of notes) {
    appendNotice(harnessHome, slug, newNotice({ at: new Date(now()).toISOString(), from, to: note.to, kind: 'note', text: note.text }));
  }
  stdout(`${notes.length} notes recorded in ${record.path}.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await wakeMain(process.argv.slice(2));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openingsDir, readNotices, recordPath, writeOpening } from './lib/channel.mjs';
import { readManifest, recordOptionalFile } from './lib/manifest.mjs';
import { hiddenLauncherCommand } from './lib/startup-file.mjs';
import { remoteId } from './lib/remote.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { wakeMain } from './wake.mjs';

const BOOT = '2026-10-15T04:52:00.000Z';
const at = (hour, minute) => `2026-10-15T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
const base = (time) => ({ timestamp: time, cwd: 'D:\\proj', gitBranch: 'main', isSidechain: false });
const line = (entry) => JSON.stringify(entry);
const titled = (title) => line({ type: 'custom-title', customTitle: title, sessionId: 's' });
const prompt = (text, time) => line({ type: 'user', ...base(time), origin: { kind: 'human' }, message: { role: 'user', content: text } });
const background = (id, task, command, time) => [
  line({ type: 'assistant', ...base(time), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'Bash', input: { command, run_in_background: true } }] } }),
  line({ type: 'user', ...base(time), toolUseResult: { stdout: '', stderr: '', backgroundTaskId: task }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } }),
];
const WAIT = 'js-harness wait --pr 162 --every 120 --for 60';

/** A project folder that is no repository, its sessions under a Claude home, and a harness home for the channel. */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-wake-'));
  const cwd = path.join(root, 'proj');
  const claudeHome = path.join(root, 'claude');
  const home = path.join(root, 'home');
  fs.mkdirSync(cwd, { recursive: true });
  const slug = projectSlug(cwd);
  const dir = path.join(claudeHome, 'projects', slug);
  fs.mkdirSync(dir, { recursive: true });
  const write = (id, lines) => fs.writeFileSync(path.join(dir, `${id}.jsonl`), lines.join('\n') + '\n');
  write('aaaa1111', [titled('JH 5 · canal'), prompt('go', at(4, 0)), ...background('t1', 'b1', WAIT, at(4, 30))]);
  write('bbbb2222', [titled('JH ORQ · proj'), prompt('lead', at(4, 50))]);
  write('cccc3333', [prompt('no title at all', at(4, 45))]);
  writeOpening(home, slug, { title: 'JH 5 · canal', text: 'You are JH 5.', at: at(4, 0), from: { host: 'h', id: 'x', source: 'test', title: 'JH ORQ · proj' } });
  const out = [];
  const err = [];
  const options = { cwd, stdout: (text) => out.push(text), stderr: (text) => err.push(text), env: { JS_HARNESS_HOME: home }, homedir: () => home, run: () => ({ status: 1, stdout: '', stderr: '' }), now: () => Date.parse(at(5, 0)) };
  const main = (...argv) => wakeMain(['--claude-home', claudeHome, '--boot-time', BOOT, ...argv], options);
  return { main, out, err, home, slug };
}

test('wake prints each session open before the boot, its opening and the waits the boot killed, and records nothing without --notify', async () => {
  const { main, out, home, slug } = fixture();
  assert.equal(await main(), 0);
  const text = out.join('\n');
  assert.match(text, /JH 5 · canal/);
  assert.match(text, /js-harness sessions --opening 'JH 5 · canal'/);
  assert.ok(text.includes(WAIT), text);
  assert.match(text, /JH ORQ · proj/);
  assert.match(text, /cccc3333/);
  assert.match(text, /no role to address a note to/);
  assert.match(text, /no note recorded: run with --notify/);
  assert.equal(readNotices(home, slug).notices.length, 0);
});

test('wake --notify leaves each titled session its note and the orchestrator the list, once per boot', async () => {
  const { main, out, home, slug } = fixture();
  assert.equal(await main('--notify'), 0);
  const notices = readNotices(home, slug).notices;
  const toFive = notices.filter((one) => one.to.role === 'work' && one.to.number === 5);
  const toLead = notices.filter((one) => one.to.role === 'orchestrator');
  assert.equal(toFive.length, 1);
  assert.ok(toFive[0].text.includes(WAIT), toFive[0].text);
  assert.match(toFive[0].text, /^The machine booted at 2026-10-15T04:52/);
  assert.equal(toFive[0].kind, 'note');
  // The orchestrator's own note says it was open and names whom to wake, and the session no note reaches.
  assert.equal(toLead.length, 2);
  const list = toLead.find((one) => /send_message/.test(one.text));
  assert.ok(list, toLead.map((one) => one.text).join('\n'));
  assert.match(list.text, /JH 5 · canal/);
  assert.match(list.text, /cccc3333/);
  assert.match(out.join('\n'), /3 notes recorded/);
  // A second run after the same boot, a few seconds off as an uptime reads it, records none.
  out.length = 0;
  assert.equal(await main('--notify'), 0);
  assert.equal(readNotices(home, slug).notices.length, notices.length);
  assert.match(out.join('\n'), /already recorded for this boot/);
});

test('a wait written on several lines does not stop --notify, and every note is recorded', async () => {
  const { main, home, slug } = fixture();
  const dir = path.join(path.dirname(home), 'claude', 'projects', slug);
  fs.appendFileSync(path.join(dir, 'aaaa1111.jsonl'), background('t9', 'b9', 'cd /d/project\njs-harness wait --pr 7', at(4, 31)).join('\n') + '\n');
  assert.equal(await main('--notify'), 0);
  const toFive = readNotices(home, slug).notices.find((one) => one.to.number === 5);
  assert.ok(toFive.text.includes('cd /d/project ; js-harness wait --pr 7'), toFive.text);
});

test('wake says what it could not read and records nothing, but still lists the sessions: a record or an openings folder that is there and cannot be read', async () => {
  const { main, out, err, home, slug } = fixture();
  // A folder where the record file is: reading it fails, and so does a write to it.
  fs.mkdirSync(recordPath(home, slug), { recursive: true });
  assert.equal(await main('--notify'), 1);
  assert.match(err.join('\n'), /js-harness wake: could not read the record .*, so no note is recorded\./);
  assert.match(out.join('\n'), /^The machine booted at .* open before it/m);
  assert.doesNotMatch(out.join('\n'), /notes? recorded in/);
  fs.rmSync(recordPath(home, slug), { recursive: true });
  // An openings folder that is a file: no opening can be read from it, so no note is written.
  fs.rmSync(openingsDir(home, slug), { recursive: true });
  fs.writeFileSync(openingsDir(home, slug), 'not a folder');
  err.length = 0;
  out.length = 0;
  assert.equal(await main('--notify'), 1);
  assert.match(err.join('\n'), /js-harness wake: could not read the openings folder .*, so no note is recorded\./);
  assert.match(out.join('\n'), /^The machine booted at /m);
  assert.equal(readNotices(home, slug).notices.length, 0);
});

test('a list of sessions too long for one notice keeps the command that prints them all, and says how many it left out', async () => {
  const { main, home, slug } = fixture();
  const dir = path.join(path.dirname(home), 'claude', 'projects', slug);
  for (let n = 10; n < 40; n++) fs.writeFileSync(path.join(dir, `s${n}.jsonl`), [titled(`JH ${n} · a session with a rather long purpose to fill the list`), prompt('x', at(4, 20))].join('\n') + '\n');
  assert.equal(await main('--notify'), 0);
  const list = readNotices(home, slug).notices.find((one) => one.to.role === 'orchestrator' && /send_message/.test(one.text));
  assert.ok(list.text.length <= 500, String(list.text.length));
  assert.match(list.text, /and \d+ more/i);
  assert.match(list.text, /js-harness wake --boot-time 2026-10-15T04:52:00\.000Z prints what to tell each\.$/);
});

test('wake with a --boot-time that is no time, or an unknown flag, exits 2 with usage and records nothing', async () => {
  const { home, slug, err } = fixture();
  const options = { stderr: (text) => err.push(text), stdout: () => {}, env: { JS_HARNESS_HOME: home }, homedir: () => home };
  assert.equal(await wakeMain(['--boot-time', 'yesterday'], options), 2);
  assert.equal(await wakeMain(['--bogus'], options), 2);
  assert.match(err.join('\n'), /js-harness wake/);
  assert.equal(readNotices(home, slug).notices.length, 0);
});

/** A Startup folder under a fake APPDATA, beside the fixture's home, and `wake` run with both. */
function atLogin() {
  const { home, err } = fixture();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-wake-login-'));
  const appData = path.join(cwd, 'AppData');
  const dir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  fs.mkdirSync(dir, { recursive: true });
  const out = [];
  const options = { cwd, stdout: (text) => out.push(text), stderr: (text) => err.push(text), env: { APPDATA: appData, JS_HARNESS_HOME: home }, homedir: () => home, run: () => ({ status: 1, stdout: '', stderr: '' }), execPath: 'C:\\Program Files\\nodejs\\node.exe' };
  const file = path.join(dir, `js-harness-wake-${remoteId(cwd)}.vbs`);
  const batch = path.join(dir, `js-harness-wake-${remoteId(cwd)}.cmd`);
  return { main: (...argv) => wakeMain(argv, options), out, err, home, file, batch, dir, cwd, appData };
}

test('wake --at-login writes the Startup file that runs wake --notify for this project with no window, and records it for uninstall', async () => {
  const { main, out, home, file } = atLogin();
  assert.equal(await main('--at-login'), 0);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^' .*wake --at-login --remove removes it/);
  assert.match(hiddenLauncherCommand(text), /^"C:\\Program Files\\nodejs\\node\.exe" .*wake\.mjs --notify --cwd /);
  assert.ok(text.endsWith('\r\n'), JSON.stringify(text));
  const record = readManifest(home).optional.find((entry) => entry.path === file);
  assert.ok(record, 'the file is recorded in the machine manifest');
  assert.match(out.join('\n'), /runs at each login/);
  // Again with nothing changed: nothing written, and it says the file is there.
  out.length = 0;
  assert.equal(await main('--at-login'), 0);
  assert.match(out.join('\n'), /already there/);
});

test('wake --at-login --remove takes the file and its record away; a file js-harness did not write is kept with exit 1', async () => {
  const { main, out, home, file, err } = atLogin();
  assert.equal(await main('--at-login'), 0);
  assert.equal(await main('--at-login', '--remove'), 0);
  assert.equal(fs.existsSync(file), false);
  assert.equal(readManifest(home)?.optional?.find((entry) => entry.path === file), undefined);
  assert.match(out.join('\n'), /removed/);
  fs.writeFileSync(file, 'the user\'s own');
  assert.equal(await main('--at-login'), 1);
  assert.equal(fs.readFileSync(file, 'utf8'), 'the user\'s own');
  assert.match(err.join('\n'), /a file js-harness did not write/);
});

test('wake --at-login replaces the batch file of an earlier version, which opened a console window; one it did not write is kept and refused', async () => {
  const { main, out, err, home, file, batch, dir } = atLogin();
  const text = '@echo off\r\nrem Leaves each session of one project a note after a boot.\r\n"C:\\node.exe" D:\\js-harness\\bin\\wake.mjs --notify --cwd D:\\x\r\n';
  fs.writeFileSync(batch, text);
  recordOptionalFile(home, batch, text);
  assert.equal(await main('--at-login'), 0, err.join('\n'));
  assert.deepEqual(fs.readdirSync(dir), [path.basename(file)]);
  assert.deepEqual(readManifest(home).optional.map((entry) => entry.path), [file]);
  assert.match(out.join('\n'), new RegExp(`in place of ${batch.replace(/[\\.]/g, '\\$&')}, which opened a console window`));

  // Removal takes both: a machine that never moved to the new file is undone too.
  fs.writeFileSync(batch, text);
  recordOptionalFile(home, batch, text);
  assert.equal(await main('--at-login', '--remove'), 0, err.join('\n'));
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.equal(readManifest(home), null);

  fs.writeFileSync(batch, 'the user\'s own');
  assert.equal(await main('--at-login'), 1);
  assert.match(err.join('\n'), /not one js-harness recorded writing/);
  assert.deepEqual(fs.readdirSync(dir), [path.basename(batch)], 'nothing written beside it');
});

test('a home and a Claude home set only in the shell are carried into the Startup file, and the default ones are not', async () => {
  const { file, home, cwd, appData } = atLogin();
  const claude = path.join(cwd, 'claude elsewhere');
  const options = (env, homedir) => ({ cwd, stdout: () => {}, stderr: () => {}, env: { APPDATA: appData, ...env }, homedir: () => homedir, run: () => ({ status: 1, stdout: '', stderr: '' }), execPath: 'C:\\node\\node.exe' });
  assert.equal(await wakeMain(['--at-login'], options({ JS_HARNESS_HOME: home, CLAUDE_CONFIG_DIR: claude }, path.join(cwd, 'user'))), 0);
  const carried = hiddenLauncherCommand(fs.readFileSync(file, 'utf8'));
  assert.ok(carried.includes(`--home ${home}`) || carried.includes(`--home "${home}"`), carried);
  assert.ok(carried.includes(`--claude-home "${claude}"`), carried);
  assert.equal(await wakeMain(['--at-login', '--remove'], options({ JS_HARNESS_HOME: home, CLAUDE_CONFIG_DIR: claude }, path.join(cwd, 'user'))), 0);
  assert.equal(await wakeMain(['--at-login'], options({}, home)), 0);
  const plain = hiddenLauncherCommand(fs.readFileSync(file, 'utf8'));
  assert.ok(!plain.includes('--home') && !plain.includes('--claude-home'), plain);
});

test('wake --home records its notes under that home', async () => {
  const { main, home, slug } = fixture();
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-wake-home-'));
  assert.equal(await main('--notify', '--home', other), 0);
  assert.ok(readNotices(other, slug).notices.length > 0);
  assert.equal(readNotices(home, slug).notices.length, 0);
});

test('--remove without --at-login, or --at-login with --notify, is a usage error that writes nothing', async () => {
  const { main, file } = atLogin();
  assert.equal(await main('--remove'), 2);
  assert.equal(await main('--at-login', '--notify'), 2);
  assert.equal(fs.existsSync(file), false);
});

#!/usr/bin/env node
// The TUI walk (odd/tasks/release-095.md, T2): opens the real menu in a child process, presses the keys a person
// would for every item, and checks what each one prints and how the menu changes. Everything runs in throwaway
// folders: a home, an npm prefix, a folder holding a tarball one minor newer than this checkout, and a git
// repository. The real commands run, the real npm installs the upgrade, and the real `claude remote-control` is
// started and stopped for the throwaway repository; the user's own home and repositories are never touched.
// Exit 0 when every step printed what it should; else the failing step, its keys and its output.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, resolveNpmCli, npm, run, mkTmp, copyRepoToStaging, nextVersion, bumpVersion } from './lib.mjs';

const KEY = { down: 'j', up: 'k', enter: '\r', yes: 'y', no: 'n', quit: 'q' };
const STEP_MS = 10 * 60_000; // an upgrade with the real npm can take minutes
const keep = process.argv.includes('--keep');

const current = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).version;
const newer = nextVersion(current);
const root = mkTmp('js-harness-tui-walk-');
const dirs = Object.fromEntries(['home', 'prefix', 'source', 'repo', 'staging'].map((name) => [name, path.join(root, name)]));
for (const dir of Object.values(dirs)) fs.mkdirSync(dir, { recursive: true });
const npmCli = resolveNpmCli();

function must(result, what) {
  if (result.status !== 0) throw new Error(`${what} exited ${result.status}: ${String(result.stderr ?? '').trim().slice(-400)}`);
  return result;
}

// The release to upgrade to: this checkout packed as `newer`.
copyRepoToStaging(dirs.staging);
bumpVersion(dirs.staging, newer);
must(npm(npmCli, ['pack', '--pack-destination', dirs.source], { cwd: dirs.staging }), 'npm pack');
// A repository of its own, with one commit, for the project items.
for (const args of [['init', '-q', '-b', 'main'], ['-c', 'user.name=walk', '-c', 'user.email=walk@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'walk']]) {
  must(run('git', args, { cwd: dirs.repo }), `git ${args[0]}`);
}

const env = {
  ...process.env,
  JS_HARNESS_HOME: dirs.home,
  JS_HARNESS_SOURCE: dirs.source,
  JS_HARNESS_PREFIX: dirs.prefix,
  // The real npm, never a PATH `npm` that may be another manager's shim.
  JS_HARNESS_PM: `${process.execPath} ${npmCli}`,
};
const tuiUrl = pathToFileURL(path.join(REPO_ROOT, 'bin', 'tui.mjs')).href;
const child = spawn(process.execPath, ['--input-type=module', '-e', `import(${JSON.stringify(tuiUrl)}).then((m) => m.tuiMain([], process.env)).then((code) => process.exit(code ?? 0))`], {
  cwd: dirs.repo,
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
});
let out = '';
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => { out += chunk; });
child.stderr.on('data', (chunk) => { out += chunk; });
const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));

// Every draw of the menu holds exactly one selected line, `> <label>`: their count tells a key's draw has come.
const draws = () => (out.match(/^> /gm) ?? []).length;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function press(key) {
  const before = draws();
  child.stdin.write(key);
  const until = Date.now() + STEP_MS;
  while (draws() <= before) {
    if (Date.now() > until) throw new Error(`no menu drawn ${STEP_MS / 1000} s after the key ${JSON.stringify(key)}`);
    if (child.exitCode !== null) return;
    await sleep(50);
  }
}

/** The last menu drawn: its lines from the version header on. */
function lastScreen() {
  const at = out.lastIndexOf('\njs-harness ', out.length) + 1;
  return out.slice(at).split('\n');
}

/** The index of each item of the last menu, with its section, and the one selected. */
function menuNow() {
  let section = 'machine';
  const items = [];
  let selected = -1;
  // The menu starts after the first blank line: above it are the version header and the stack rows.
  const screen = lastScreen();
  for (const line of screen.slice(screen.indexOf('') + 1)) {
    if (line === 'project' || line === 'machine') section = line;
    const item = /^([> ]) (\S.*)$/.exec(line);
    if (!item) continue;
    if (item[1] === '>') selected = items.length;
    items.push({ section, label: item[2] });
  }
  return { items, selected };
}

async function select(section, label) {
  const { items, selected } = menuNow();
  const target = items.findIndex((it) => it.section === section && it.label === label);
  if (target === -1) throw new Error(`no ${section} item ${label} in the menu: ${items.map((it) => `${it.section}/${it.label}`).join(', ')}`);
  for (let i = selected; i !== target; i = (i + 1) % items.length) await press(KEY.down);
}

const results = [];
async function step(name, { section, label, answer, expect, menu }) {
  const from = out.length;
  await select(section, label);
  const start = out.length;
  await press(KEY.enter);
  if (answer) await press(answer);
  const said = out.slice(start);
  const faults = [];
  for (const pattern of [].concat(expect ?? [])) if (!pattern.test(said)) faults.push(`does not print ${pattern}`);
  if (/^\S+ failed: /m.test(said)) faults.push('the menu reported the command failed');
  if (menu) {
    const labels = menuNow().items.map((it) => `${it.section}/${it.label}`).join(', ');
    if (!menu.test(labels)) faults.push(`the menu after it is ${labels}, not ${menu}`);
  }
  results.push({ name, ok: faults.length === 0, faults, said: out.slice(from) });
  console.log(`${faults.length === 0 ? 'PASS' : 'FAIL'}  ${name}${faults.length ? `: ${faults.join('; ')}` : ''}`);
}

let code = 1;
try {
  const until = Date.now() + 60_000;
  while (draws() === 0) {
    if (Date.now() > until || child.exitCode !== null) throw new Error(`the menu never opened:\n${out}`);
    await sleep(50);
  }
  const header = lastScreen()[0];
  const headerOk = header === `js-harness ${current}  (update available: ${newer})`;
  results.push({ name: 'header', ok: headerOk, faults: headerOk ? [] : [`header is ${JSON.stringify(header)}`], said: header });
  console.log(`${headerOk ? 'PASS' : 'FAIL'}  header names ${current} and the update to ${newer}${headerOk ? '' : `: ${header}`}`);

  const M = 'machine';
  const P = 'project';
  await step('Status before install', { section: M, label: 'Status', expect: /not installed|no manifest|nothing installed/i });
  await step('Install', { section: M, label: 'Install', expect: new RegExp(`installed js-harness ${current.replace(/\./g, '\\.')}`) });
  await step('Status after install', { section: M, label: 'Status', expect: new RegExp(current.replace(/\./g, '\\.')) });
  await step('Doctor', { section: M, label: 'Doctor', expect: /\S/ });
  await step('Update', { section: M, label: 'Update', expect: new RegExp(newer.replace(/\./g, '\\.')) });
  await step('Init', { section: P, label: 'Init', menu: /project\/Sync, project\/Status, project\/Uninstall/ });
  await step('Project sync', { section: P, label: 'Sync', expect: /\S/ });
  await step('Project status', { section: P, label: 'Status', expect: /\S/ });
  await step('Remote status', { section: P, label: 'Remote status', expect: /\S/ });
  await step('Remote start', { section: P, label: 'Remote start', expect: /\S/ });
  await step('Remote status while started', { section: P, label: 'Remote status', expect: /running|started|pid/i });
  await step('Remote stop', { section: P, label: 'Remote stop', answer: KEY.yes, expect: /stop/i });
  await step('Project uninstall', { section: P, label: 'Uninstall', answer: KEY.yes, menu: /project\/Init/ });
  await step('Upgrade', { section: M, label: 'Upgrade', expect: new RegExp(`upgraded to ${newer.replace(/\./g, '\\.')}`) });
  {
    // The menu keeps running the old code: its header says so instead of offering the update again (F1).
    const header = lastScreen()[0];
    const want = `js-harness ${current}  (${newer} installed: quit and open js-harness again to use it)`;
    results.push({ name: 'header after Upgrade', ok: header === want, faults: header === want ? [] : [`header is ${JSON.stringify(header)}`], said: header });
    console.log(`${header === want ? 'PASS' : 'FAIL'}  header after Upgrade${header === want ? '' : `: ${header}`}`);
  }
  await step('Uninstall, answered no', { section: M, label: 'Uninstall', answer: KEY.no });
  await step('Uninstall', { section: M, label: 'Uninstall', answer: KEY.yes, expect: /remov|uninstall/i });
  await step('Status after uninstall', { section: M, label: 'Status', expect: /not installed|no manifest|nothing installed/i });
  // What the normal uninstall keeps, as a lead's notes would be: Uninstall everything removes it with the folder (S5).
  const kept = path.join(dirs.home, '.js-harness', 'relief');
  fs.mkdirSync(kept, { recursive: true });
  fs.writeFileSync(path.join(kept, 'walk.md'), 'a note the normal uninstall keeps\n');
  await step('Uninstall everything, answered no', { section: M, label: 'Uninstall everything', answer: KEY.no });
  {
    // Its yes removes the folder and, since this menu runs from a checkout, keeps the program; then the menu ends
    // by itself, with nothing left to offer.
    const start = out.length;
    await select(M, 'Uninstall everything');
    await press(KEY.enter);
    child.stdin.write(KEY.yes);
    const exit = await Promise.race([exited, sleep(60_000).then(() => 'still running')]);
    const said = out.slice(start);
    const faults = [];
    if (exit !== 0) faults.push(`exit ${exit}`);
    if (fs.existsSync(path.join(dirs.home, '.js-harness'))) faults.push('the .js-harness folder is still there');
    if (!/^removed .*\.js-harness: .*relief/m.test(said)) faults.push('does not say it removed the folder and what it held');
    if (!/^kept the js-harness program: this one runs from /m.test(said)) faults.push('does not say it kept the program');
    results.push({ name: 'Uninstall everything, then the menu ends', ok: faults.length === 0, faults, said });
    console.log(`${faults.length === 0 ? 'PASS' : 'FAIL'}  Uninstall everything, then the menu ends${faults.length ? `: ${faults.join('; ')}` : ''}`);
  }
  code = results.every((r) => r.ok) ? 0 : 1;
} catch (err) {
  console.log(`FAIL  ${err.message}`);
} finally {
  if (child.exitCode === null) child.kill();
  const log = path.join(root, 'walk.log');
  fs.writeFileSync(log, results.map((r) => `=== ${r.ok ? 'PASS' : 'FAIL'} ${r.name}\n${r.said}`).join('\n') + `\n=== everything printed\n${out}`);
  // A passing walk leaves nothing behind unless --keep asked for its folders; a failing one keeps them for reading.
  if (!keep && code === 0) fs.rmSync(root, { recursive: true, force: true });
  else console.log(`walk log: ${log}`);
}
process.exit(code);

#!/usr/bin/env node
// The trial of the stack install on a scratch home (odd/tasks/stack-install.md, D9): everything it installs lands in
// one folder under the system's temp folder, every command it runs sees a PATH of only that folder's shims and its
// package prefix, and his real files are hashed before and after, so a write that escaped the scratch home fails it.
// NOT part of `npm run check` or of any contract command: it downloads the Codex CLI and codegraph from the registry.
// Run by hand: `node scripts/stack-scratch.mjs [--keep]`; it prints a report and exits 0 when the trial passed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compareSnapshots, contentHash } from './practice-lib.mjs';

const JS_HARNESS = fileURLToPath(new URL('../bin/js-harness.mjs', import.meta.url));

/** The rows of D2, in their order: what `stack --json` must plan on an empty scratch home. */
export const D2_ROWS = ['codex.installed', 'codegraph.installed', 'codegraph.claude', 'codegraph.codex'];

/** The packages the trial installs, which the prefix must no longer hold after `uninstall machine`. */
const PACKAGES = ['@openai/codex', '@colbymchenry/codegraph'];

/** Where the trial puts things under `root`. */
export function scratchLayout(root) {
  const home = path.join(root, 'home');
  return {
    root,
    home,
    appData: path.join(home, 'AppData', 'Roaming'),
    localAppData: path.join(home, 'AppData', 'Local'),
    prefix: path.join(root, 'prefix'),
    prefixBin: path.join(root, 'prefix', 'bin'),
    bin: path.join(root, 'bin'),
    project: path.join(root, 'project'),
  };
}

/** The variables of the system a child still needs (cmd.exe, temp folders), kept from `base`; nothing else of it. */
const KEPT = {
  win32: ['SystemRoot', 'windir', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'SystemDrive', 'OS', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS'],
  other: ['TMPDIR', 'LANG', 'TERM'],
};

/** The environment of every command of the trial: the system's own variables of `base`, a PATH of only the shims and
 * the prefix's `bin`, the scratch home under every name Claude, Codex and Windows read it by, and no telemetry. His
 * package manager's folders, his js-harness settings and his Codex home never reach it. */
export function scratchEnv(layout, base, platform) {
  const windows = platform === 'win32';
  const kept = windows ? KEPT.win32 : KEPT.other;
  const env = {};
  for (const [name, value] of Object.entries(base)) {
    if (kept.some((wanted) => (windows ? wanted.toUpperCase() === name.toUpperCase() : wanted === name))) env[name] = value;
  }
  env[windows ? 'Path' : 'PATH'] = [layout.bin, layout.prefixBin].join(windows ? ';' : ':');
  Object.assign(env, { HOME: layout.home, USERPROFILE: layout.home, CODEX_HOME: path.join(layout.home, '.codex'), DO_NOT_TRACK: '1' });
  if (windows) Object.assign(env, { APPDATA: layout.appData, LOCALAPPDATA: layout.localAppData });
  return env;
}

/** A shim that starts exactly `target` with every argument it is given. */
export function shimContent(target, platform) {
  return platform === 'win32' ? `@"${target}" %*\r\n` : `#!/bin/sh\nexec "${target}" "$@"\n`;
}

/** His files the trial must leave as they are. */
export function realFilesOf(home) {
  return [
    path.join(home, '.claude.json'),
    path.join(home, '.claude', 'settings.json'),
    path.join(home, '.codex', 'config.toml'),
    path.join(home, '.codex', 'AGENTS.md'),
  ];
}

const DOCTOR_EXPECTED = [['codex', 'installed'], ['codegraph', 'installed'], ['codegraph', 'claude'], ['codegraph', 'codex']];

/** Whether the trial did what D9 expects, as `{ pass, failures }`, each failure one line. */
export function trialVerdict({ stack, installs, doctor, uninstall, differences }) {
  const failures = [];
  if (stack.code !== 1) failures.push(`stack --json exited ${stack.code}, not 1`);
  const planned = (stack.plan?.mandatory ?? []).map((row) => `${row.tool}.${row.dimension}`);
  if (planned.join() !== D2_ROWS.join()) failures.push(`stack --json planned ${planned.join(', ')}, not ${D2_ROWS.join(', ')}`);
  for (const install of installs) if (install.code !== 0) failures.push(`stack install --tool ${install.tool} exited ${install.code}`);
  for (const [id, dimension] of DOCTOR_EXPECTED) {
    const state = (doctor ?? []).find((row) => row.id === id)?.[dimension] ?? 'absent';
    if (state !== 'ok') failures.push(`doctor: ${id} ${dimension} is ${state}, not ok`);
  }
  if (uninstall.code !== 0) failures.push(`uninstall machine exited ${uninstall.code}`);
  if (uninstall.manifestLeft) failures.push('uninstall machine left the manifest');
  for (const name of uninstall.prefixPackages) failures.push(`the scratch prefix still holds ${name}`);
  for (const difference of differences) failures.push(`his file ${difference.change}: ${difference.path}`);
  return { pass: failures.length === 0, failures };
}

// ---- the run ---------------------------------------------------------------------------------------------------------

/** The first program `name` on his PATH, as `where` or `which` finds it, or `null`. */
function locate(name, platform) {
  const found = spawnSync(platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
  if (found.status !== 0) return null;
  const lines = found.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (platform === 'win32' ? lines.find((line) => /\.(exe|cmd)$/i.test(line)) : lines[0]) ?? null;
}

/** The hashes of his files, of his global packages' listing and, on Windows, of his user PATH. */
function snapshotOfHim(platform) {
  const snapshot = {};
  for (const file of realFilesOf(os.homedir())) snapshot[file] = fs.existsSync(file) ? contentHash(fs.readFileSync(file)) : null;
  const listing = spawnSync('pnpm ls -g', [], { encoding: 'utf8', shell: true });
  snapshot['pnpm ls -g'] = contentHash(`${listing.status}\n${listing.stdout}`);
  if (platform === 'win32') {
    const userPath = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', 'Path'], { encoding: 'utf8' });
    snapshot['HKCU\\Environment Path'] = contentHash(`${userPath.status}\n${userPath.stdout}`);
  }
  return snapshot;
}

/** The packages of `PACKAGES` the prefix still holds, in any of pnpm's global folders or npm's own. */
function packagesIn(prefix) {
  const roots = [path.join(prefix, 'node_modules'), path.join(prefix, 'lib', 'node_modules')];
  const global = path.join(prefix, 'global');
  if (fs.existsSync(global)) for (const name of fs.readdirSync(global)) roots.push(path.join(global, name, 'node_modules'));
  return PACKAGES.filter((name) => roots.some((root) => fs.existsSync(path.join(root, ...name.split('/')))));
}

function main(argv) {
  const platform = process.platform;
  const keep = argv.includes('--keep');
  const layout = scratchLayout(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-stack-scratch-')));
  for (const dir of [layout.appData, layout.localAppData, layout.prefixBin, layout.bin, layout.project]) fs.mkdirSync(dir, { recursive: true });

  // The shims: node itself, linked (pnpm's own shims start it by name), and pnpm, git and claude.
  const nodeCopy = path.join(layout.bin, path.basename(process.execPath));
  try {
    fs.linkSync(process.execPath, nodeCopy);
  } catch {
    fs.copyFileSync(process.execPath, nodeCopy);
  }
  for (const name of ['pnpm', 'git', 'claude']) {
    const target = locate(name, platform);
    if (!target) throw new Error(`${name} is not on your PATH: the trial needs it`);
    const shim = path.join(layout.bin, platform === 'win32' ? `${name}.cmd` : name);
    fs.writeFileSync(shim, shimContent(target, platform), { mode: 0o755 });
  }
  // A project with a program file, so codeMap and codexReview resolve on.
  fs.writeFileSync(path.join(layout.project, 'package.json'), '{ "name": "stack-scratch", "private": true }\n');
  fs.writeFileSync(path.join(layout.project, 'index.js'), 'export const answer = 42;\n');
  spawnSync('git', ['init', '-q'], { cwd: layout.project });

  const env = scratchEnv(layout, process.env, platform);
  const harness = (args, timeout = 600_000) => {
    const result = spawnSync(process.execPath, [JS_HARNESS, ...args], { env, encoding: 'utf8', timeout, cwd: layout.project });
    return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  };
  const at = ['--home', layout.home, '--cwd', layout.project];

  const before = snapshotOfHim(platform);
  const stackRun = harness(['stack', '--json', ...at, '--pm', 'pnpm']);
  let plan = null;
  try {
    plan = JSON.parse(stackRun.stdout);
  } catch {
    plan = null;
  }
  const installs = ['codex', 'codegraph'].map((tool) => {
    const run = harness(['stack', 'install', ...at, '--pm', 'pnpm', '--prefix', layout.prefix, '--yes', '--tool', tool]);
    return { tool, code: run.code, stdout: run.stdout, stderr: run.stderr };
  });
  const doctorRun = harness(['doctor', '--json', '--offline', ...at]);
  let doctor = null;
  try {
    doctor = JSON.parse(doctorRun.stdout);
  } catch {
    doctor = null;
  }
  const uninstallRun = harness(['uninstall', 'machine', '--home', layout.home]);
  const uninstall = {
    code: uninstallRun.code,
    manifestLeft: fs.existsSync(path.join(layout.home, '.js-harness', 'manifest.json')),
    prefixPackages: packagesIn(layout.prefix),
  };
  const differences = compareSnapshots(before, snapshotOfHim(platform));

  const verdict = trialVerdict({ stack: { code: stackRun.code, plan }, installs, doctor, uninstall, differences });
  const report = {
    root: layout.root,
    kept: keep,
    stack: { code: stackRun.code, mandatory: plan?.mandatory?.map((row) => `${row.tool}.${row.dimension}`) ?? null, stderr: stackRun.stderr.trim() },
    installs: installs.map(({ tool, code, stdout, stderr }) => ({ tool, code, stdout: stdout.trim().split(/\r?\n/), stderr: stderr.trim() })),
    doctor: (doctor ?? []).filter((row) => row.id === 'codex' || row.id === 'codegraph').map(({ id, installed, claude, codex }) => ({ id, installed, claude, codex })),
    uninstall: { ...uninstall, stdout: uninstallRun.stdout.trim().split(/\r?\n/), stderr: uninstallRun.stderr.trim() },
    differences,
    verdict,
  };
  if (!keep) fs.rmSync(layout.root, { recursive: true, force: true });
  console.log(JSON.stringify(report, null, 2));
  return verdict.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));

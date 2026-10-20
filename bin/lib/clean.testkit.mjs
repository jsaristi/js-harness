// The scratch home and temp folder of odd/tasks/clean.md's tests: every kind of leftover the scan knows, some it
// must keep, and fake tools that answer the cache questions and record each call. Nothing here touches the real home.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DAY = 24 * 60 * 60 * 1000;
export const NOW = new Date('2026-10-20T12:00:00Z');

/** Writes a file of `bytes` bytes, making its folders. */
export function file(target, bytes) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.alloc(bytes));
}

/** Sets the times of `target` and of everything under it to `days` days before NOW. */
export function age(target, days) {
  const when = new Date(NOW.getTime() - days * DAY);
  if (fs.lstatSync(target).isDirectory()) {
    for (const name of fs.readdirSync(target)) age(path.join(target, name), days);
  }
  fs.utimesSync(target, when, when);
}

/** A tool runner that answers the cache questions from `answers` (`'<command> <args>'` → stdout, or a status), and
 * records each call. A command it has no answer for is not installed. */
export function fakeRun(answers) {
  const calls = [];
  const run = (command, args) => {
    const line = [command, ...args].join(' ');
    calls.push(line);
    const answer = answers[line];
    if (answer === undefined) return { status: null, error: new Error('ENOENT'), stdout: '' };
    if (typeof answer === 'function') return answer();
    return { status: 0, stdout: `${answer}\n` };
  };
  return { run, calls };
}

/** A scratch home and temp folder with every kind of leftover the scan knows, and some it must keep. */
export function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-clean-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const tmp = path.join(root, 'tmp');
  const daemon = path.join(home, '.codex', 'packages', 'app-server-daemon');
  const releases = path.join(daemon, 'releases');
  for (const [name, bytes] of [['0.157.1-x86_64', 1000], ['0.159.1-x86_64', 2000], ['0.161.0-x86_64', 500], ['0.162.0-x86_64', 4000]]) {
    file(path.join(releases, name, 'codex.exe'), bytes);
  }
  fs.symlinkSync(path.join(releases, '0.162.0-x86_64'), path.join(daemon, 'current'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(path.join(daemon, 'auto-update-version'), '0.161.0-x86_64');
  const versions = path.join(home, '.local', 'share', 'claude', 'versions');
  for (const [name, bytes] of [['2.1.296', 300], ['2.1.300', 400], ['2.1.301', 500], ['2.1.302', 600]]) file(path.join(versions, name), bytes);
  const desktop = path.join(home, '.config', 'Claude', 'claude-code');
  file(path.join(desktop, '2.1.299', 'f0584be0', 'claude'), 700);
  file(path.join(desktop, '2.1.304', 'aed62990', 'claude'), 800);
  const staging = path.join(home, '.codex', '.tmp', 'marketplaces', '.staging');
  file(path.join(staging, 'marketplace-upgrade-old', 'a.json'), 900);
  file(path.join(staging, 'marketplace-upgrade-new', 'a.json'), 100);
  age(path.join(staging, 'marketplace-upgrade-old'), 10);
  file(path.join(tmp, 'tmp.oldOne', 'x'), 50);
  file(path.join(tmp, 'tmp.newOne', 'x'), 60);
  file(path.join(tmp, 'js-harness-home-old', 'y'), 70);
  file(path.join(tmp, 'other-old', 'z'), 80);
  file(path.join(tmp, 'tmp.worktree', 'repo', '.git'), 10);
  for (const name of ['tmp.oldOne', 'js-harness-home-old', 'other-old', 'tmp.worktree']) age(path.join(tmp, name), 10);
  const pnpmStore = path.join(root, 'pnpm-store');
  file(path.join(pnpmStore, 'v11', 'files', 'a'), 3000);
  const uvCache = path.join(root, 'uv-cache');
  file(path.join(uvCache, 'wheels', 'b'), 1500);
  // The scan reads the fixture as Linux (`deps.platform`), whose npm keeps its default cache in ~/.npm.
  const npmCache = path.join(home, '.npm');
  file(path.join(npmCache, '_cacache', 'c'), 1200);
  const tools = fakeRun({
    'claude --version': '2.1.301 (Claude Code)',
    'npm config get cache': 'undefined',
    'npm cache clean --force': () => {
      fs.rmSync(path.join(npmCache, '_cacache'), { recursive: true, force: true });
      return { status: 0, stdout: '' };
    },
    'pnpm store path': pnpmStore,
    'uv cache dir': uvCache,
  });
  const deps = { home, tmpdir: tmp, platform: 'linux', now: () => NOW, run: tools.run };
  return { root, home, tmp, releases, versions, desktop, staging, npmCache, pnpmStore, uvCache, tools, deps };
}

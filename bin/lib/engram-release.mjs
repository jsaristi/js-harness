// The engram binary brought up to a release (odd/tasks/stack-upgrade.md, S1): engram has no package on npm, so its
// update is its GitHub release, as the lead did it by hand on 2026-11-06. The archive and the release's
// `checksums.txt` are downloaded into a fresh temporary folder, the archive's sha256 is checked before anything is
// replaced, the system's `tar` extracts it (on Windows its own bsdtar, which reads zip), the running binary is renamed
// to `engram-<from>(.exe).bak` (Windows lets a running exe be renamed, never deleted) and the new one moved in, then
// asked its version: one that does not answer the release's is taken out and the old one put back. Nothing is
// deleted but the download folder and a new binary that failed. `swapBackEngram` is the undo `uninstall machine` runs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { underTest } from './manifest.mjs';

/** How long one download may take: the archive is about 8 MB. */
const DOWNLOAD_MS = 120_000;
/** How long the new binary may take to say its version. */
const VERSION_MS = 15_000;

/** The spawn of the real commands: refused in a test process, before anything runs. */
function realSpawn(file, args, options) {
  if (underTest()) throw new Error('engram-release never runs a command from a test: this one has to hand in a fake spawn');
  return spawnSync(file, args, options);
}

/** The engram the shell runs first under `env` (the PATH the plan's probe used), by its absolute path, or `null`. */
export function locateEngram({ spawn = realSpawn, platform = process.platform, env = process.env } = {}) {
  const found = platform === 'win32' ? spawn('where.exe', ['engram'], { encoding: 'utf8', windowsHide: true, env }) : spawn('which', ['engram'], { encoding: 'utf8', env });
  if (found.status !== 0) return null;
  const first = String(found.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return first && path.isAbsolute(first) ? first : null;
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** The sha256 of the file at `file`, or `null` when it cannot be read. */
export function fileSha256(file) {
  try {
    return sha256(fs.readFileSync(file));
  } catch {
    return null;
  }
}

/** A name beside `dir/<stem><ext>` that no file holds: the first free of `<stem><ext>`, `<stem>-2<ext>`, ... */
function freeName(dir, stem, ext) {
  for (let n = 1; ; n += 1) {
    const candidate = path.join(dir, `${stem}${n === 1 ? '' : `-${n}`}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

/** The binary named `name` in `dir` or one folder down, or `null`. */
function findBinary(dir, name) {
  const top = path.join(dir, name);
  if (fs.existsSync(top)) return top;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(dir, entry.name, name);
    if (fs.existsSync(nested)) return nested;
  }
  return null;
}

/** `url`'s body, as text or bytes, or a thrown error naming the address and why. */
async function download(fetchImpl, url, as) {
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(DOWNLOAD_MS), redirect: 'follow' });
  } catch (err) {
    throw new Error(`cannot download ${url}: ${err.message}`);
  }
  if (!res.ok) throw new Error(`cannot download ${url}: it answered ${res.status}`);
  return as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
}

/** Updates the engram binary for the plan's row `update` (`{ from, to, asset, release }`), as
 * `{ ok: true, record: { path, backup, sha256 } }` or `{ ok: false, why }`, with nothing replaced when it fails.
 * `deps`: `fetch`, `spawn`, `env` (the environment of the probe that planned it, so the engram updated is the one
 * shown), `locate` (the binary's path), `platform`, `tmp` (where the download folder goes), `systemRoot` (Windows'
 * folder, whose System32 holds its tar), `say` (one line per step). */
export async function updateEngramBinary(update, deps = {}) {
  const platform = deps.platform ?? process.platform;
  const spawn = deps.spawn ?? realSpawn;
  const fetchImpl = deps.fetch ?? fetch;
  const say = deps.say ?? (() => {});
  const env = deps.env ?? process.env;
  const target = (deps.locate ?? (() => locateEngram({ spawn, platform, env })))();
  if (!target) return { ok: false, why: 'there is no engram on the PATH to update: stack install names how to install it' };
  const exe = platform === 'win32' ? '.exe' : '';
  const work = fs.mkdtempSync(path.join(deps.tmp ?? os.tmpdir(), 'js-harness-engram-'));
  try {
    const checksums = await download(fetchImpl, `${update.release}/checksums.txt`, 'text');
    const expected = checksums.split(/\r?\n/).map((line) => line.trim().split(/\s+/)).find(([, name]) => name === update.asset)?.[0];
    if (!expected) return { ok: false, why: `the release's checksums.txt does not name ${update.asset}: nothing was replaced` };
    const archive = await download(fetchImpl, `${update.release}/${update.asset}`, 'bytes');
    const got = sha256(archive);
    if (got !== expected.toLowerCase()) return { ok: false, why: `${update.asset} has sha256 ${got}, and the release says ${expected}: nothing was replaced` };
    say(`engram: ${update.asset} downloaded, its sha256 is the release's`);
    const archivePath = path.join(work, update.asset);
    fs.writeFileSync(archivePath, archive);
    const into = path.join(work, 'out');
    fs.mkdirSync(into);
    const tar = platform === 'win32' ? path.win32.join(deps.systemRoot ?? process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
    const extracted = spawn(tar, ['-xf', archivePath, '-C', into], { encoding: 'utf8', windowsHide: true, env });
    if (extracted.status !== 0) return { ok: false, why: `tar could not extract ${update.asset} (${extracted.error?.code ?? `exit ${extracted.status}`}): nothing was replaced` };
    const fresh = findBinary(into, `engram${exe}`);
    if (!fresh) return { ok: false, why: `${update.asset} holds no engram${exe}: nothing was replaced` };

    // The new binary goes beside the old first, so the two renames that swap them stay on one volume.
    const dir = path.dirname(target);
    const staged = freeName(dir, `engram-${update.to}`, `${exe}.new`);
    fs.copyFileSync(fresh, staged);
    if (platform !== 'win32') fs.chmodSync(staged, 0o755);
    const sum = fileSha256(staged);
    const backup = freeName(dir, `engram-${update.from}`, `${exe}.bak`);
    try {
      fs.renameSync(target, backup);
    } catch (err) {
      fs.rmSync(staged, { force: true });
      return { ok: false, why: `${target} could not be set aside (${err.code ?? err.message}): nothing was replaced` };
    }
    try {
      fs.renameSync(staged, target);
    } catch (err) {
      fs.renameSync(backup, target);
      fs.rmSync(staged, { force: true });
      return { ok: false, why: `the new engram could not be moved in (${err.code ?? err.message}): the old one is back` };
    }
    const asked = spawn(target, ['version'], { encoding: 'utf8', timeout: VERSION_MS, windowsHide: true, env });
    const answer = String(asked.stdout ?? '').trim().split(/\r?\n/)[0] ?? '';
    if (asked.status !== 0 || !new RegExp(`\\b${update.to.replaceAll('.', '\\.')}\\b`).test(answer)) {
      fs.rmSync(target, { force: true });
      fs.renameSync(backup, target);
      const said = /^[\w .-]{1,60}$/.test(answer) ? `answers ${answer}` : 'does not answer its version';
      return { ok: false, why: `the new engram ${said}, not ${update.to}: the old one is back` };
    }
    return { ok: true, record: { path: target, backup, sha256: sum } };
  } catch (err) {
    return { ok: false, why: `${err.message}: nothing was replaced` };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** The undo of an update: the binary at `path` set aside as `engram-<to>(.exe).bak` and `backup` put back in its
 * place, as `{ ok, why }`. Without the backup nothing changes. */
export function swapBackEngram({ to, path: target, backup }) {
  if (!fs.existsSync(backup)) return { ok: false, why: `no backup at ${backup} to put back` };
  const exe = path.extname(target);
  const aside = freeName(path.dirname(target), `engram-${to}`, `${exe}.bak`);
  try {
    fs.renameSync(target, aside);
  } catch (err) {
    return { ok: false, why: `${target} could not be set aside (${err.code ?? err.message})` };
  }
  try {
    fs.renameSync(backup, target);
  } catch (err) {
    fs.renameSync(aside, target);
    return { ok: false, why: `${backup} could not be put back (${err.code ?? err.message})` };
  }
  return { ok: true, why: null, aside };
}

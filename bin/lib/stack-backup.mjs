// `js-harness stack backup` (odd/tasks/f8-s2-removal.md, T2, depth pass items 1 and 5): one full backup of the tool
// homes S2 changes, its restore drill on a scratch home, and its undo. `run` checks the quiesce, copies every root by
// the strict walker into a `.partial` folder, holds its count to an independent one and publishes the folder only
// with its manifest written; `verify` restores the backup into a `mkdtemp` home with no credential or key in it and
// reads it back; `restore` puts config roots back as snapshots and data roots without deleting anything. Nothing here
// prints a file's content or a secret value: lines carry paths, names and counts. `js-harness backup` is the wrong
// tool for this (item 1): it blanks every secret and pushes to GitHub. Reads and writes files; `tasklist`, `reg` and
// `engram` are run through `deps`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { defaultRun, parseStats } from './backup.mjs';
import { copyAndHash, hashFile, inside, plainCount, powershellCount, walkRoot } from './stack-backup-walk.mjs';

export const SCHEMA = 'js-harness.stack-backup/v1';

/** The processes that write into the roots: a backup or a restore of the real home waits until none runs. */
export const QUIESCE = ['claude.exe', 'codex.exe', 'engram.exe', 'Orca.exe', 'herdr.exe'];

/** The parts of a tool home a restore puts back as a snapshot; the rest of that home is data, never deleted. */
const CLAUDE_CONFIG = ['settings.json', 'CLAUDE.md', 'agents', 'skills', 'output-styles', 'hooks', 'commands', 'plugins'];
const CODEX_CONFIG = ['config.toml', 'hooks.json', 'AGENTS.md', 'skills', 'prompts', 'rules'];
const GEMINI_CONFIG = ['GEMINI.md', 'settings.json'];

/** Files that are credentials or hold a key, by their path under the home: never copied into a drill home, never
 * printed. A text file `redactSecrets` flags is one too, found as it is copied. */
const SECRET_PATHS = ['.claude/.credentials.json', '.codex/auth.json', '.gemini/oauth_creds.json', '.gemini/google_accounts.json', '.claude.json', '.codex/config.toml'];

const samePath = (a, b, platform) => inside(a, b, platform) && inside(b, a, platform);

/** `%APPDATA%` and `%LOCALAPPDATA%`: `env`'s on the real home, the home's own `AppData` folders on any other. */
function appData({ home, env, platform, realHome }) {
  const real = samePath(home, realHome, platform);
  return {
    roaming: (real && env.APPDATA) || path.join(home, 'AppData', 'Roaming'),
    local: (real && env.LOCALAPPDATA) || path.join(home, 'AppData', 'Local'),
  };
}

/** The roots of one backup, each `{ id, from, kind, include?, exclude? }`: `config` is restored as a snapshot, `data`
 * only gains missing files, `file` is one file written back when it differs. `%APPDATA%` and `%LOCALAPPDATA%` are
 * `env`'s on the real home and the home's own `AppData` folders on any other, so a drill home never names his. */
export function backupRoots({ home, env = process.env, platform = process.platform, realHome = os.homedir() }) {
  const { roaming, local } = appData({ home, env, platform, realHome });
  const at = (...parts) => path.join(home, ...parts);
  const split = (id, dir, config) => [
    { id: `${id}-config`, from: at(dir), kind: 'config', include: config },
    { id: `${id}-data`, from: at(dir), kind: 'data', exclude: config },
  ];
  return [
    ...split('claude', '.claude', CLAUDE_CONFIG),
    { id: 'claude-json', from: at('.claude.json'), kind: 'file' },
    ...split('codex', '.codex', CODEX_CONFIG),
    ...split('gemini', '.gemini', GEMINI_CONFIG),
    { id: 'engram', from: at('.engram'), kind: 'data' },
    { id: 'gentle-ai', from: at('.gentle-ai'), kind: 'data' },
    { id: 'gentle-ai-exe', from: at('go', 'bin', 'gentle-ai.exe'), kind: 'file' },
    { id: 'bin', from: at('bin'), kind: 'data' },
    { id: 'orca', from: at('.orca'), kind: 'data' },
    { id: 'orca-roaming', from: path.join(roaming, 'orca'), kind: 'data' },
    { id: 'orca-programs', from: path.join(local, 'Programs', 'orca'), kind: 'data' },
    { id: 'orca-updater', from: path.join(local, 'orca-updater'), kind: 'data' },
    { id: 'herdr', from: at('.herdr'), kind: 'data' },
    { id: 'herdr-roaming', from: path.join(roaming, 'herdr'), kind: 'data' },
    { id: 'herdr-local', from: path.join(local, 'herdr'), kind: 'data' },
    { id: 'js-harness-manifest', from: at('.js-harness', 'manifest.json'), kind: 'file' },
  ];
}

/** The ids `--only` may name besides `permissions` and `mcp:<name>`. */
export const ROOT_IDS = backupRoots({ home: os.tmpdir() }).map((root) => root.id);

/** Where a file of `root` lives: the root itself for a file root, else under it. */
const targetOf = (root, rel) => (root.kind === 'file' ? root.from : path.join(root.from, ...rel.split('/')));

/** The first folder between `root.from` and `target` that is a link or junction now, or null: a write below it would
 * land wherever the link points. */
function linkedAncestor(root, target) {
  if (root.kind === 'file') return null;
  let at = root.from;
  for (const part of path.relative(root.from, path.dirname(target)).split(path.sep).filter(Boolean)) {
    at = path.join(at, part);
    const stat = lstatOrNull(at);
    if (!stat) return null;
    if (stat.isSymbolicLink()) return at;
  }
  return null;
}

function isSecretPath(home, root, rel, platform) {
  const homeRel = path.relative(home, targetOf(root, rel)).split(path.sep).join('/');
  const norm = (p) => (platform === 'win32' ? p.toLowerCase() : p);
  return SECRET_PATHS.some((secret) => norm(secret) === norm(homeRel));
}

/** The names of the running processes, lowercased: `tasklist` on Windows, `ps` elsewhere. Throws when it cannot
 * tell, since a backup taken beside a live writer is the loss the quiesce exists to stop. */
function defaultProcesses(platform) {
  const result = platform === 'win32'
    ? spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
    : spawnSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`could not list the running processes: ${String(result.stderr || result.error || '').trim()}`);
  return result.stdout.split(/\r?\n/).map((line) => (platform === 'win32' ? /^"([^"]+)"/.exec(line)?.[1] : path.basename(line.trim()))).filter(Boolean);
}

/** The quiesce list's processes that run now, as the list names them. */
function runningWriters(deps, platform) {
  const names = new Set((deps.processes ?? (() => defaultProcesses(platform)))().map((name) => name.toLowerCase()));
  return QUIESCE.filter((name) => names.has(name.toLowerCase()) || names.has(name.toLowerCase().replace(/\.exe$/, '')));
}

/** A JSON file parsed, `null` when absent; a parse error is named without the parser's message, which can quote the
 * text around the fault, and so a key. */
function readJsonQuiet(file, fsx = fs) {
  let text;
  try {
    text = fsx.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`could not read ${file}: ${error.code ?? 'error'}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${file} is not valid JSON`);
  }
}

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

const stampOf = (date) => date.toISOString().replace(/[:.]/g, '-');

const defaultReg = (args) => {
  const result = spawnSync('reg', args, { encoding: 'utf8', windowsHide: true });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? String(result.error ?? '') };
};

const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
const CLASSES_KEY = 'HKCU\\Software\\Classes\\orca';
const SHORTCUT = /^(?:orca|herdr)/i;

/** The user PATH, Orca's registry keys as `.reg` files and Orca's and herdr's Start menu shortcuts, under
 * `<partial>/exports`; returns the manifest's `exports`, each file's hash in its `sha256` so the drill proves the
 * undo of the Orca and herdr removals is whole (Codex P2 on 84997f7..0b9f98a). On another system than Windows there
 * is no registry. */
function writeExports({ partial, startMenu, platform, reg, fsx, say }) {
  const exportsDir = path.join(partial, 'exports');
  fs.mkdirSync(exportsDir, { recursive: true });
  const result = { path: 'exports/user-path.txt', registry: [], shortcuts: [] };
  const sealed = () => ({ ...result, sha256: Object.fromEntries([result.path, ...result.registry, ...result.shortcuts].map((rel) => [rel, hashFile(path.join(partial, ...rel.split('/')))])) });
  if (platform !== 'win32') {
    fs.writeFileSync(path.join(exportsDir, 'user-path.txt'), '');
    say('- exports: no Windows registry on this system');
    return sealed();
  }
  const query = reg(['query', 'HKCU\\Environment', '/v', 'Path']);
  const value = /^\s*Path\s+REG_\w+\s+(.*?)\s*$/m.exec(query.stdout);
  if (query.status !== 0 || !value) throw new Error(`could not read the user PATH (reg query HKCU\\Environment /v Path): ${query.stderr.trim()}`);
  fs.writeFileSync(path.join(exportsDir, 'user-path.txt'), `${value[1]}\n`);
  const found = reg(['query', UNINSTALL_KEY, '/s', '/f', 'Orca', '/d']);
  const keys = found.status === 0
    ? [...new Set(found.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+$/i.test(line)))]
    : [];
  const wanted = keys.map((key) => [key, `uninstall-${key.split('\\').at(-1).replace(/[^A-Za-z0-9._-]/g, '_')}.reg`]);
  if (reg(['query', CLASSES_KEY]).status === 0) wanted.push([CLASSES_KEY, 'classes-orca.reg']);
  for (const [key, name] of wanted) {
    const file = path.join(exportsDir, 'registry', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const exported = reg(['export', key, file, '/y']);
    if (exported.status !== 0 || !fs.existsSync(file)) throw new Error(`could not export ${key}: ${exported.stderr.trim()}`);
    result.registry.push(`exports/registry/${name}`);
  }
  for (const file of walkRoot(startMenu, {}, fsx).files.filter((f) => SHORTCUT.test(path.posix.basename(f.path)))) {
    copyAndHash(file.source, path.join(exportsDir, 'shortcuts', ...file.path.split('/')), { fsx });
    result.shortcuts.push(`exports/shortcuts/${file.path}`);
  }
  say(`- exports: user PATH, ${result.registry.length} registry keys, ${result.shortcuts.length} shortcuts`);
  return sealed();
}

/** The observation count of the store in `dir`, by `engram stats --all` on that store alone. */
function engramObservations(dir, run, env) {
  const stats = run('engram', ['stats', '--all'], { env: { ...env, ENGRAM_DATA_DIR: dir } });
  const counts = stats.status === 0 ? parseStats(stats.stdout) : null;
  if (!counts) throw new Error(`engram stats did not read the store in ${dir}: ${String(stats.stderr || 'no counts').trim().split('\n')[0]}`);
  return counts.observations;
}

/** `js-harness stack backup run`: the quiesce checks, each printed, stopping at the first that fails (`{ ok: false }`);
 * then every root copied under `<dest>.partial/roots/<id>`, the exports, the named objects, engram's count and the
 * manifest, and `<dest>.partial` renamed to `<dest>` only then (`{ ok: true, dest, manifest }`). Throws, leaving no
 * published backup, on any entry it cannot read and on a root whose count an independent count does not match.
 * `deps`: `processes`, `reg`, `run` (engram), `independentCount(root)`, `copy`, `fs`, `realHome`, `now`, `log`. */
export function runBackup({ home, env = process.env, platform = process.platform, dest, deps = {} }) {
  const say = deps.log ?? ((line) => console.log(line));
  const fsx = deps.fs ?? fs;
  const copy = deps.copy ?? ((source, target) => copyAndHash(source, target, { fsx }));
  const count = deps.independentCount ?? ((root) => (platform === 'win32' ? powershellCount(root) : plainCount(root)));
  const realHome = deps.realHome ?? os.homedir();
  const roots = backupRoots({ home, env, platform, realHome });
  const now = (deps.now ?? (() => new Date()))();
  const target = path.resolve(dest ?? path.join(home, 'js-harness-s2-backup', stampOf(now)));
  const partial = `${target}.partial`;

  const running = runningWriters(deps, platform);
  if (running.length > 0) {
    say(`FAIL quiesce: ${running.join(', ')} runs; close it and run again`);
    return { ok: false };
  }
  say(`ok quiesce: none of ${QUIESCE.join(', ')} runs`);
  const mirrored = path.join(home, '.js-harness');
  const within = roots.find((root) => inside(target, root.from, platform));
  const problem = inside(target, mirrored, platform)
    ? `${target} is inside ${mirrored}, which js-harness backup mirrors to GitHub`
    : within
      ? `${target} is inside ${within.from}, a root of this backup`
      : [target, partial].find((p) => fs.existsSync(p)) && `${[target, partial].find((p) => fs.existsSync(p))} already exists`;
  if (problem) {
    say(`FAIL destination: ${problem}`);
    return { ok: false };
  }
  say(`ok destination: ${target}`);

  const engramDir = path.join(home, '.engram');
  const observations = fs.existsSync(engramDir) ? engramObservations(engramDir, deps.run ?? defaultRun, env) : null;
  fs.mkdirSync(partial, { recursive: true });
  const manifest = { schema: SCHEMA, createdAt: now.toISOString(), home, roots: [], files: [], links: [], exports: null, named: { permissions: 'named/permissions.json', mcpClaude: 'named/mcp-claude.json' }, engram: observations === null ? null : { observations }, counts: { files: 0, bytes: 0 } };
  for (const root of roots) {
    const walked = walkRoot(root.from, root, fsx);
    manifest.roots.push({ id: root.id, from: root.from, kind: root.kind, present: walked.present });
    if (!walked.present) {
      say(`- ${root.id}: absent (${root.from})`);
      continue;
    }
    let files = 0;
    let bytes = 0;
    for (const file of walked.files) {
      const copied = copy(file.source, path.join(partial, 'roots', root.id, ...file.path.split('/')));
      const secret = isSecretPath(home, root, file.path, platform) || copied.flagged;
      manifest.files.push({ root: root.id, path: file.path, bytes: copied.bytes, sha256: copied.sha256, secret });
      files += 1;
      bytes += copied.bytes;
    }
    for (const link of walked.links) manifest.links.push({ root: root.id, path: link.path, target: link.target });
    const counted = count(root);
    if (counted.files !== files || counted.bytes !== bytes) {
      throw new Error(`${root.id}: copied ${files} files, ${bytes} bytes; an independent count reads ${counted.files} files, ${counted.bytes} bytes (${root.from}); something wrote meanwhile or the walk missed it`);
    }
    manifest.counts.files += files;
    manifest.counts.bytes += bytes;
    say(`ok ${root.id}: ${files} files, ${bytes} bytes, ${walked.links.length} links (${root.from})`);
  }
  // The Start menu is read for Orca's and herdr's shortcuts only, never a root.
  const startMenu = path.join(appData({ home, env, platform, realHome }).roaming, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  manifest.exports = writeExports({ partial, startMenu, platform, reg: deps.reg ?? defaultReg, fsx, say });
  // The named objects are read from the copies, so they are what the backup holds.
  const settings = readJsonQuiet(path.join(partial, 'roots', 'claude-config', 'settings.json'));
  const claudeJson = readJsonQuiet(path.join(partial, 'roots', 'claude-json', '.claude.json'));
  writeJson(path.join(partial, manifest.named.permissions), settings?.permissions ?? null);
  writeJson(path.join(partial, manifest.named.mcpClaude), claudeJson?.mcpServers ?? {});
  writeJson(path.join(partial, 'manifest.json'), manifest);
  fs.renameSync(partial, target);
  const secrets = manifest.files.filter((f) => f.secret).length;
  say(`backup: ${manifest.counts.files} files, ${manifest.counts.bytes} bytes, ${manifest.links.length} links, ${secrets} secret files, engram ${observations ?? 'absent'} observations`);
  say(`backup: ${target}`);
  return { ok: true, dest: target, manifest };
}

function readManifest(from) {
  const manifest = readJsonQuiet(path.join(from, 'manifest.json'));
  if (manifest?.schema !== SCHEMA) throw new Error(`${from} holds no ${SCHEMA} manifest`);
  return manifest;
}

/** The style of a JSON file's text: its indent, line end and whether it ends in one, so a rewrite keeps them. */
function styleOf(text) {
  return { indent: /\n/.test(text.trim()) ? /^[ \t]+(?=")/m.exec(text)?.[0] ?? '  ' : undefined, eol: text.includes('\r\n') ? '\r\n' : '\n', final: /\n$/.test(text) };
}

function styled(value, style) {
  const text = JSON.stringify(value, null, style.indent);
  return (style.eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text) + (style.final ? style.eol : '');
}

/** Puts `value` at `key` of the JSON object in `file`, every other key and the file's style kept; `undefined` or
 * `null` at the top level removes the key. */
function setKey(file, keyPath, value) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{}\n';
  const data = readJsonQuiet(file) ?? {};
  let node = data;
  for (const key of keyPath.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key];
  }
  if (value === null && keyPath.length === 1) delete node[keyPath[0]];
  else node[keyPath.at(-1)] = value;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, styled(data, styleOf(text)));
}

/** Removes the folders under `dir` that hold nothing, deepest first; `dir` itself only when `self`. */
function pruneEmpty(dir, self) {
  let stat;
  try {
    stat = fs.lstatSync(dir);
  } catch {
    return;
  }
  if (!stat.isDirectory()) return;
  for (const name of fs.readdirSync(dir)) pruneEmpty(path.join(dir, name), true);
  if (self && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

/** A link at `at` to `target`: a junction for a folder on Windows, which needs no privilege. */
function makeLink(target, at, platform) {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  const folder = (() => {
    try {
      return fs.statSync(path.resolve(path.dirname(at), target)).isDirectory();
    } catch {
      return false;
    }
  })();
  fs.symlinkSync(target, at, folder ? (platform === 'win32' ? 'junction' : 'dir') : 'file');
}

const lstatOrNull = (p) => {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
};

/** The steps that put `root` back from the backup into its place, each `{ line, apply }`. */
function planRoot({ root, manifest, from, withSecrets, platform }) {
  const steps = [];
  const recorded = manifest.roots.find((r) => r.id === root.id);
  if (!recorded?.present) return [{ line: `skip ${root.id}: not in the backup, left as it is`, apply: () => {} }];
  if (root.id === 'engram' && walkRoot(root.from).files.length > 0) {
    return [{ line: `skip engram: ${root.from} holds files; its store goes back only into an empty one (merge with js-harness backup restore --merge)`, apply: () => {} }];
  }
  const files = manifest.files.filter((f) => f.root === root.id);
  const links = manifest.links.filter((l) => l.root === root.id);
  const snapshot = root.kind !== 'data';
  const write = (source, target) => ({
    line: `write ${target}`,
    apply: () => {
      if (lstatOrNull(target)) fs.rmSync(target, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      const { atime, mtime } = fs.statSync(source);
      fs.utimesSync(target, atime, mtime);
    },
  });
  let kept = 0;
  // A folder that became a link since the backup is never written through (Codex P1 on 84997f7..0b9f98a): in a
  // config root the link goes first, as the snapshot would remove it anyway; in a data root its entries are skipped.
  const unlinked = new Set();
  const skipped = new Set();
  /** 'skip' when `target` lies below a link in a data root, 'replaced' below one in a config root, else null. */
  const below = (target) => {
    const at = linkedAncestor(root, target);
    if (at === null) return null;
    const [seen, line] = snapshot ? [unlinked, `unlink ${at}: a link now, where the backup holds a folder`] : [skipped, `skip ${at}: a link now, never followed`];
    if (!seen.has(at)) {
      seen.add(at);
      steps.push({ line, apply: snapshot ? () => fs.rmSync(at, { recursive: true, force: true }) : () => {} });
    }
    return snapshot ? 'replaced' : 'skip';
  };
  for (const file of files) {
    if (file.secret && !withSecrets) continue;
    const source = path.join(from, 'roots', root.id, ...file.path.split('/'));
    const target = targetOf(root, file.path);
    const via = below(target);
    if (via === 'skip') continue;
    const stat = via === 'replaced' ? null : lstatOrNull(target);
    if (!stat) steps.push(write(source, target));
    else if (!snapshot) kept += 1;
    else if (!stat.isFile() || hashFile(target) !== file.sha256) steps.push(write(source, target));
  }
  for (const link of links) {
    const at = targetOf(root, link.path);
    const via = below(at);
    if (via === 'skip') continue;
    const stat = via === 'replaced' ? null : lstatOrNull(at);
    if (stat?.isSymbolicLink() && fs.readlinkSync(at) === link.target) continue;
    if (stat && !snapshot) {
      kept += 1;
      continue;
    }
    steps.push({
      line: `link ${at} -> ${link.target}`,
      apply: () => {
        if (lstatOrNull(at)) fs.rmSync(at, { recursive: true, force: true });
        makeLink(link.target, at, platform);
      },
    });
  }
  if (root.kind === 'config' && lstatOrNull(root.from)) {
    // Case-blind on Windows, where a file renamed only in case is the backed-up one (gentle-ai R3 on 84997f7..0b9f98a).
    const key = (rel) => (platform === 'win32' ? rel.toLowerCase() : rel);
    const held = new Set([...files, ...links].map((entry) => key(entry.path)));
    const live = walkRoot(root.from, root);
    const gone = [...live.files, ...live.links].filter((e) => !held.has(key(e.path)) && !unlinked.has(e.source));
    for (const entry of gone) steps.push({ line: `delete ${entry.source}`, apply: () => fs.rmSync(entry.source, { force: true }) });
    // Only when a deletion may have emptied a folder; a restore that deletes nothing leaves every folder as it is.
    if (gone.length > 0) steps.push({ line: null, apply: () => (root.include ?? ['']).forEach((name) => pruneEmpty(path.join(root.from, name), name !== '')) });
  }
  if (kept > 0) steps.push({ line: `keep ${root.id}: ${kept} files already there, never written over`, apply: () => {} });
  return steps;
}

/** `js-harness stack backup restore`: puts the backup `from` back into `home`, every root or what `only` names
 * (`permissions`, `mcp:<name>`, a root id). Config roots as snapshots (missing or changed files written back, files the
 * backup lacks deleted, emptied folders removed); data roots gain only missing files; engram's store only into an empty
 * one. On the real home (`os.homedir()` or `deps.realHome`) it refuses while a process of `QUIESCE` runs. Without
 * `yes` it prints the plan, by path, and writes nothing. `withSecrets: false` (the drill) leaves the secret files out.
 * Returns `{ ok, planned, lines }`. */
export function restoreBackup({ from, home, only = [], deps = {}, yes = false, withSecrets = true }) {
  const lines = [];
  const say = (line) => {
    lines.push(line);
    (deps.log ?? ((l) => console.log(l)))(line);
  };
  const platform = deps.platform ?? process.platform;
  const manifest = readManifest(from);
  const real = samePath(home, os.homedir(), platform) || (deps.realHome !== undefined && samePath(home, deps.realHome, platform));
  if (real) {
    const running = runningWriters(deps, platform);
    if (running.length > 0) {
      say(`FAIL quiesce: ${running.join(', ')} runs; a restore over a live home loses what it writes meanwhile`);
      return { ok: false, planned: false, lines };
    }
  }
  const roots = backupRoots({ home, env: deps.env ?? process.env, platform, realHome: deps.realHome ?? os.homedir() });
  const named = only.filter((o) => o === 'permissions' || o.startsWith('mcp:'));
  const unknown = only.find((o) => !named.includes(o) && !ROOT_IDS.includes(o));
  if (unknown !== undefined) throw new Error(`--only ${unknown}: not permissions, mcp:<name> or a root id (${ROOT_IDS.join(', ')})`);
  const chosen = only.length === 0 ? roots : roots.filter((root) => only.includes(root.id));
  const steps = chosen.flatMap((root) => planRoot({ root, manifest, from, withSecrets, platform }));
  for (const item of named) {
    if (item === 'permissions') {
      const file = path.join(home, '.claude', 'settings.json');
      const value = readJsonQuiet(path.join(from, manifest.named.permissions));
      steps.push({ line: `write ${file}: permissions`, apply: () => setKey(file, ['permissions'], value) });
    } else {
      const name = item.slice('mcp:'.length);
      const entries = readJsonQuiet(path.join(from, manifest.named.mcpClaude)) ?? {};
      if (!Object.hasOwn(entries, name)) throw new Error(`the backup holds no mcpServers entry ${name}`);
      const file = path.join(home, '.claude.json');
      steps.push({ line: `write ${file}: mcpServers.${name}`, apply: () => setKey(file, ['mcpServers', name], entries[name]) });
    }
  }
  for (const step of steps) if (step.line) say(step.line);
  if (!yes) {
    say('plan only, nothing written: --yes restores it');
    return { ok: true, planned: true, lines };
  }
  for (const step of steps) step.apply();
  say(`restored ${home} from ${from}`);
  return { ok: true, planned: false, lines };
}

/** The `[mcp_servers.<name>]` names of a Codex config.toml's text, nested tables read as their server. */
const codexServers = (text) => [...new Set([...text.matchAll(/^\s*\[mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))/gm)].map((m) => m[1] ?? m[2]))];

const COMPLEMENTS = ['engram', 'codegraph', 'context7'];

/** `js-harness stack backup verify`: the drill. The backup restored into a `mkdtemp` home without its secret files,
 * each restored file's hash and each link checked; the secret files hashed where the backup holds them; with `marker`,
 * `engram search` on the restored store must name `#<expectId>`; the `permissions` object equal to the named one; the
 * complements' MCP entries named in the backup's `.claude.json` and Codex config, read in place; and row 12: a deleted
 * config file comes back, a created one goes, a newer transcript stays. One `ok`/`FAIL` line per check, names only;
 * the drill home is removed whatever happens. Returns `{ ok, lines }`. */
export function verifyBackup({ from, deps = {}, marker, expectId, tmp = os.tmpdir() }) {
  const lines = [];
  const log = deps.log ?? ((line) => console.log(line));
  const check = (name, fn) => {
    let why;
    try {
      why = fn();
    } catch (error) {
      why = error.message;
    }
    const line = typeof why === 'string' ? `FAIL ${name}: ${why}` : `ok ${name}${why?.ok ? `: ${why.ok}` : ''}`;
    lines.push(line);
    log(line);
  };
  const platform = deps.platform ?? process.platform;
  const env = deps.env ?? process.env;
  const manifest = readManifest(from);
  const scratch = fs.mkdtempSync(path.join(tmp, 'js-harness-s2-drill-'));
  try {
    const quiet = { ...deps, log: () => {}, realHome: deps.realHome ?? os.homedir() };
    const roots = Object.fromEntries(backupRoots({ home: scratch, env, platform, realHome: quiet.realHome }).map((r) => [r.id, r]));
    const restore = () => restoreBackup({ from, home: scratch, deps: quiet, yes: true, withSecrets: false });
    const at = (file) => targetOf(roots[file.root], file.path);
    const plain = manifest.files.filter((f) => !f.secret);
    check('restore', () => (restore().ok ? { ok: 'into a scratch home, secret files left out' } : 'the restore refused'));
    check('files', () => {
      const bad = plain.filter((f) => !fs.existsSync(at(f)) || hashFile(at(f)) !== f.sha256).map((f) => `${f.root}/${f.path}`);
      return bad.length === 0 ? { ok: `${plain.length} restored byte for byte` } : `${bad.length} differ, first ${bad[0]}`;
    });
    check('links', () => {
      const bad = manifest.links.filter((l) => {
        const stat = lstatOrNull(at(l));
        return !stat?.isSymbolicLink() || fs.readlinkSync(at(l)) !== l.target;
      });
      return bad.length === 0 ? { ok: `${manifest.links.length} restored as links` } : `${bad.length} differ, first ${bad[0].root}/${bad[0].path}`;
    });
    check('exports', () => {
      const sealed = Object.entries(manifest.exports?.sha256 ?? {});
      if (sealed.length === 0) return 'the manifest records no hash of its exports';
      const bad = sealed.filter(([rel, sha256]) => {
        const file = path.join(from, ...rel.split('/'));
        return !fs.existsSync(file) || hashFile(file) !== sha256;
      });
      return bad.length === 0 ? { ok: `${sealed.length} hash as recorded` } : `${bad.length} differ or are gone, first ${bad[0][0]}`;
    });
    check('secrets', () => {
      const secret = manifest.files.filter((f) => f.secret);
      const bad = secret.filter((f) => hashFile(path.join(from, 'roots', f.root, ...f.path.split('/'))) !== f.sha256);
      const leaked = secret.filter((f) => fs.existsSync(at(f)));
      if (leaked.length > 0) return `${leaked.length} reached the scratch home, first ${leaked[0].root}/${leaked[0].path}`;
      return bad.length === 0 ? { ok: `${secret.length} hash as recorded, in place` } : `${bad.length} differ, first ${bad[0].root}/${bad[0].path}`;
    });
    // A drill that never searched engram is no proof the restored store answers (Codex P2 on 84997f7..0b9f98a).
    check('engram', () => {
      if (!marker || !/^\d+$/.test(String(expectId ?? ''))) return 'no marker to search: --marker <token> and --expect <id> name what the restored store must answer';
      const found = (deps.run ?? defaultRun)('engram', ['search', marker, '--all'], { env: { ...env, ENGRAM_DATA_DIR: path.join(scratch, '.engram') } });
      return new RegExp(`#${expectId}(?!\\d)`).test(found.stdout ?? '') ? { ok: `#${expectId} found on the restored store` } : `#${expectId} not found on the restored store`;
    });
    check('permissions', () => {
      const restored = path.join(scratch, '.claude', 'settings.json');
      const backedUp = path.join(from, 'roots', 'claude-config', 'settings.json');
      const settings = readJsonQuiet(fs.existsSync(restored) ? restored : backedUp);
      const expected = readJsonQuiet(path.join(from, manifest.named.permissions));
      return isDeepStrictEqual(settings?.permissions ?? null, expected) ? { ok: 'equal to the named object' } : 'the restored settings.json differs from named/permissions.json';
    });
    check('mcp claude', () => {
      const names = Object.keys(readJsonQuiet(path.join(from, 'roots', 'claude-json', '.claude.json'))?.mcpServers ?? {});
      const missing = COMPLEMENTS.filter((n) => !names.includes(n));
      return missing.length === 0 ? { ok: names.sort().join(', ') } : `missing ${missing.join(', ')}`;
    });
    check('mcp codex', () => {
      const file = path.join(from, 'roots', 'codex-config', 'config.toml');
      const names = fs.existsSync(file) ? codexServers(fs.readFileSync(file, 'utf8')) : [];
      const missing = COMPLEMENTS.filter((n) => !names.includes(n));
      return missing.length === 0 ? { ok: names.sort().join(', ') } : `missing ${missing.join(', ')}`;
    });
    check('row 12', () => {
      const configs = plain.filter((f) => manifest.roots.find((r) => r.id === f.root)?.kind === 'config' && f.path.includes('/'));
      if (configs.length === 0) return 'no config file in a folder to delete';
      const victim = configs[0];
      const created = path.join(roots[victim.root].from, victim.path.split('/')[0], 's2-drill-created.txt');
      // A transcript's place; its name is no record (docs-records reads a `.jsonl` literal as one), and restore never
      // tells files apart by extension.
      const transcript = path.join(scratch, '.claude', 'projects', 'x', 's2-drill-newer.txt');
      fs.rmSync(at(victim));
      fs.writeFileSync(created, 'created after the backup\n');
      fs.mkdirSync(path.dirname(transcript), { recursive: true });
      fs.writeFileSync(transcript, '{"newer":true}\n');
      restore();
      if (!fs.existsSync(at(victim)) || hashFile(at(victim)) !== victim.sha256) return `${victim.root}/${victim.path} not put back`;
      if (fs.existsSync(created)) return 'the created config file is still there';
      if (!fs.existsSync(transcript)) return 'the newer transcript is gone';
      return { ok: `${victim.root}/${victim.path} put back, the created file removed, the newer transcript kept` };
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return { ok: lines.every((line) => line.startsWith('ok ')), lines };
}

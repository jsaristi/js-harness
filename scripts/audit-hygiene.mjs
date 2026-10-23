#!/usr/bin/env node
// Public-repository hygiene over the whole history of this repository:
//
//   node scripts/audit-hygiene.mjs [--allow <file>] [--json] [--cwd <repo>]
//
// The repository is public on GitHub, so every blob ever pushed can be read, whether a later commit deleted it or
// not. This reads each blob of `git rev-list --objects --all` once, line by line, and reports four kinds: `secret`
// (the shapes of GitHub, npm, OpenAI, Anthropic, AWS and Slack tokens, private key headers, and a password-like
// assignment with a real-looking value), `email` (an address other than the noreply and reserved ones) and
// `personal-path` (an absolute path into a person's home). One finding is one distinct matched text. Its detail
// names the first place it sits, and says `at HEAD` when a blob of the current tree holds it, `history only` when
// only older commits do.
//
// - The allow-list is a JSON array of `{ "kind", "location", "why" }`, where location is the matched text. Its
//   default is `odd/tasks/launch-audit/allow/hygiene.json` in the repository: a missing default is an empty list,
//   a missing file named by `--allow` is a usage error. An entry that matches no finding is a `stale-allow` finding.
// - A blob over 2 MB is not read, and a blob whose first 8,000 bytes hold a NUL byte is binary and not scanned.
//   Both are counted on the summary line. The blobs are streamed through one `git cat-file --batch`, never one git
//   process per blob.
// - `--json` prints one object `{ "findings", "allowed" }` instead of the lines.
// - `--cwd <repo>` is the repository to scan, the current folder unless said otherwise.
// Exits: 0 with no finding beyond the allow-list, 1 with findings, 2 on a usage error or a git error.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const USAGE = 'usage: node scripts/audit-hygiene.mjs [--allow <file>] [--json] [--cwd <repo>]';
const DEFAULT_ALLOW = path.join('odd', 'tasks', 'launch-audit', 'allow', 'hygiene.json');
const MAX_BYTES = 2 * 1024 * 1024;
const BINARY_PROBE = 8000;
const KIND_ORDER = ['secret', 'email', 'personal-path', 'stale-allow'];

// The shapes of a credential, one pattern each; a line may hold several.
const TOKEN_SHAPES = [
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  // An npm access token: a developer's login in a committed .npmrc is the case this guards.
  /npm_[A-Za-z0-9]{36}/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /sk-[A-Za-z0-9]{32,}/g,
  /sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];
// A password-like assignment whose quoted value is long enough to be one; the value is checked apart. The name may
// be quoted, as a JSON property is.
const ASSIGNMENT = /(?:password|passwd|secret|token|api[_-]?key)['"]?\s*[:=]\s*['"]([^'"\s]{12,})['"]/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
// A home folder: a Windows drive path, or a macOS or Linux one whose name ends in a slash. The lookbehind keeps a
// drive path from being reported again by the Unix form.
const WINDOWS_HOME = /[A-Za-z]:[\\/]+Users[\\/]+([^\\/\s'"`]+)/gi;
const POSIX_HOME = /(?<![A-Za-z]:)\/(?:Users|home)\/([^\/\s'"`]+)(?=\/)/g;

const PLACEHOLDER_NAMES = new Set(['user', 'username', 'name', 'you', 'me', 'runner', 'yourname', 'public', 'default']);
const IGNORED_EMAIL_DOMAINS = new Set(['example.com', 'example.org', 'example.net', 'users.noreply.github.com']);
const IGNORED_EMAIL_SUFFIXES = ['.test', '.invalid', '.localhost'];

/** The options of the command line, or `{ error }` with the one line to say about it. */
export function parseArgs(argv) {
  const options = { allow: null, json: false, cwd: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--allow' || arg === '--cwd') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} takes a value` };
      options[arg.slice(2)] = value;
      index += 1;
    } else {
      return { error: `unknown argument: ${arg}` };
    }
  }
  return options;
}

/** True for a user name that is a placeholder and not a person: `<user>`, `$USER`, `%USERNAME%`, `you`, `runner`. */
export function isPlaceholderName(name) {
  return /^<.*>$/.test(name) || name.startsWith('$') || /^%.*%$/.test(name) || PLACEHOLDER_NAMES.has(name.toLowerCase());
}

/** True for the value of an assignment that is a placeholder and not a credential: `<...>`, `xxx`, `${...}`, `process.env...`. */
export function isPlaceholderValue(value) {
  return /^<.*>$/.test(value) || /xxx/i.test(value) || value.includes('${') || value.startsWith('process.env');
}

/** True for an address the scan does not report: the Anthropic noreply, the GitHub noreply, a reserved domain. */
export function isIgnoredEmail(address) {
  const lower = address.toLowerCase();
  const domain = lower.slice(lower.lastIndexOf('@') + 1);
  if (lower === 'noreply@anthropic.com') return true;
  return IGNORED_EMAIL_DOMAINS.has(domain) || IGNORED_EMAIL_SUFFIXES.some((suffix) => domain.endsWith(suffix));
}

/** The hits of one line, each `{ kind, text }`; text is the matched text, which is what an allow entry names. */
export function scanLine(line) {
  const hits = [];
  const add = (kind, text) => hits.push({ kind, text });
  for (const shape of TOKEN_SHAPES) {
    for (const match of line.matchAll(shape)) add('secret', match[0]);
  }
  for (const match of line.matchAll(ASSIGNMENT)) {
    if (!isPlaceholderValue(match[1])) add('secret', match[0]);
  }
  for (const match of line.matchAll(EMAIL)) {
    if (!isIgnoredEmail(match[0])) add('email', match[0]);
  }
  for (const match of [...line.matchAll(WINDOWS_HOME), ...line.matchAll(POSIX_HOME)]) {
    if (!isPlaceholderName(match[1])) add('personal-path', match[0]);
  }
  return hits;
}

/** The hits of a blob's content, each with its line number (1-based), or null when the blob is binary. */
export function scanBlob(content) {
  if (content.subarray(0, BINARY_PROBE).includes(0)) return null;
  const hits = [];
  content.toString('utf8').split('\n').forEach((text, index) => {
    for (const hit of scanLine(text)) hits.push({ ...hit, line: index + 1 });
  });
  return hits;
}

/** Reads the output of `git cat-file --batch` as it arrives, one object at a time, into `onObject(sha, content)`. */
export function batchParser(onObject) {
  let pending = Buffer.alloc(0);
  let header = null;
  return {
    push(chunk) {
      pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
      let offset = 0;
      for (;;) {
        if (header === null) {
          const end = pending.indexOf(10, offset);
          if (end < 0) break;
          const [sha, , size] = pending.toString('utf8', offset, end).split(' ');
          offset = end + 1;
          if (size === undefined) throw new Error(`git cat-file: no object ${sha}`);
          header = { sha, size: Number(size) };
        }
        if (pending.length - offset < header.size + 1) break;
        onObject(header.sha, pending.subarray(offset, offset + header.size));
        offset += header.size + 1;
        header = null;
      }
      pending = pending.subarray(offset);
    },
    finish() {
      if (header !== null || pending.length > 0) throw new Error('git cat-file: the output ended early');
    },
  };
}

/** Every object of the history with the path it was first listed at (commits, and some tags, have none). */
export function parseObjects(text) {
  return text.split('\n').filter(Boolean).map((line) => {
    const space = line.indexOf(' ');
    return space < 0 ? { sha: line, path: '' } : { sha: line.slice(0, space), path: line.slice(space + 1) };
  });
}

/** Type and size per object, from `git cat-file --batch-check` with the format `%(objectname) %(objecttype) %(objectsize)`. */
export function parseObjectInfo(text) {
  const info = new Map();
  for (const line of text.split('\n').filter(Boolean)) {
    const [sha, type, size] = line.split(' ');
    info.set(sha, { type, size: Number(size) });
  }
  return info;
}

/** The blob ids of a tree, from `git ls-tree -r`. */
export function parseTreeBlobs(text) {
  const blobs = new Set();
  for (const line of text.split('\n')) {
    const match = /^\d+ blob ([0-9a-f]+)\t/.exec(line);
    if (match) blobs.add(match[1]);
  }
  return blobs;
}

/** One git call and its text output; a failure is an error that carries git's own words. */
function git(cwd, args, input) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', input, maxBuffer: 1024 ** 3 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]}: ${result.stderr.trim() || `exit ${result.status}`}`);
  return result.stdout;
}

/** The blobs of the current tree; an empty repository has none. */
function headBlobs(cwd) {
  const head = spawnSync('git', ['-C', cwd, 'rev-parse', '--verify', '-q', 'HEAD'], { encoding: 'utf8' });
  if (head.status !== 0) return new Set();
  return parseTreeBlobs(git(cwd, ['ls-tree', '-r', 'HEAD']));
}

/** Streams the contents of `shas` through one `git cat-file --batch`, handing each to `onBlob(sha, content)`. */
function streamBlobs(cwd, shas, onBlob) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', cwd, 'cat-file', '--batch'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const parser = batchParser(onBlob);
    let stderr = '';
    let failure = null;
    const fail = (error) => {
      if (failure === null) failure = error;
      child.kill();
    };
    child.stdin.on('error', () => {}); // a child that exits early closes its stdin; its exit code says why
    child.stdout.on('data', (chunk) => {
      try {
        parser.push(chunk);
      } catch (error) {
        fail(error);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (failure !== null) return reject(failure);
      if (code !== 0) return reject(new Error(`git cat-file: ${stderr.trim() || `exit ${code}`}`));
      try {
        parser.finish();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(shas.map((sha) => `${sha}\n`).join(''));
  });
}

/**
 * Scans every blob of the history at `cwd`: `{ hits, read, skipped }`, where hits are the findings per distinct
 * kind and matched text, each with the blobs holding it and the first place it sits (and the first at HEAD).
 */
export async function scanHistory(cwd, { skip = null } = {}) {
  // `skip` is the allow-list's path in the repository: its entries quote the values they allow, so read as a blob
  // each would find itself and never go stale.
  const objects = parseObjects(git(cwd, ['rev-list', '--objects', '--all'])).filter((object) => object.path !== skip);
  const info = parseObjectInfo(git(cwd, ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    objects.map((object) => `${object.sha}\n`).join('')));
  const head = headBlobs(cwd);
  let skipped = 0;
  const scanned = [];
  for (const object of objects) {
    if (info.get(object.sha)?.type !== 'blob') continue;
    if (info.get(object.sha).size > MAX_BYTES) skipped += 1;
    else scanned.push(object);
  }
  const byId = new Map(scanned.map((blob) => [blob.sha, blob]));
  const hits = new Map();
  let read = 0;
  await streamBlobs(cwd, scanned.map((blob) => blob.sha), (sha, content) => {
    const found = scanBlob(content);
    if (found === null) {
      skipped += 1;
      return;
    }
    read += 1;
    const place = { path: byId.get(sha).path || '(no path)', sha };
    const inHead = head.has(sha);
    for (const { kind, text, line } of found) {
      const key = `${kind}\u0000${text}`;
      if (!hits.has(key)) hits.set(key, { kind, location: text, blobs: new Set(), first: null, atHead: null });
      const hit = hits.get(key);
      if (hit.blobs.has(sha)) continue;
      hit.blobs.add(sha);
      hit.first ??= { ...place, line };
      if (inHead) hit.atHead ??= { ...place, line };
    }
  });
  return { hits: [...hits.values()], read, skipped };
}

/** The findings of a scan with the allow-list applied: `{ findings, allowed }`, findings in kind order. */
export function applyAllowList(hits, allow) {
  const findings = [];
  const used = new Set();
  let allowed = 0;
  for (const hit of hits) {
    const index = allow.findIndex((entry) => entry.kind === hit.kind && entry.location === hit.location);
    if (index >= 0) {
      used.add(index);
      allowed += 1;
      continue;
    }
    const place = hit.atHead ?? hit.first;
    const where = hit.atHead ? 'at HEAD' : 'history only';
    findings.push({
      kind: hit.kind,
      location: hit.location,
      detail: `${place.path}@${place.sha.slice(0, 8)}:${place.line}, ${hit.blobs.size} blobs, ${where}`,
    });
  }
  allow.forEach((entry, index) => {
    if (!used.has(index)) {
      findings.push({ kind: 'stale-allow', location: entry.location, detail: `no ${entry.kind} finding matches this allow entry` });
    }
  });
  findings.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return { findings, allowed };
}

/** The allow-list at `file`: an empty list when it is missing and not required, else a list or an error. */
export function readAllowList(file, required) {
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`allow list not found: ${file}`);
    return [];
  }
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`allow list ${file} is not JSON: ${error.message}`);
  }
  if (!Array.isArray(entries) || entries.some((entry) => ['kind', 'location', 'why'].some((key) => typeof entry?.[key] !== 'string'))) {
    throw new Error(`allow list ${file} must be an array of { kind, location, why }`);
  }
  return entries;
}

/** Runs the scan from the command line and returns the exit code. */
export async function main(argv) {
  const options = parseArgs(argv);
  if (options.error) {
    console.error(options.error);
    console.error(USAGE);
    return 2;
  }
  const cwd = path.resolve(options.cwd ?? '.');
  let scan;
  let allow;
  try {
    const allowFile = options.allow === null ? path.join(cwd, DEFAULT_ALLOW) : path.resolve(options.allow);
    allow = readAllowList(allowFile, options.allow !== null);
    const top = git(cwd, ['rev-parse', '--show-toplevel']).trim();
    const skip = path.relative(top, allowFile).split(path.sep).join('/');
    scan = await scanHistory(cwd, { skip: skip.startsWith('..') || path.isAbsolute(skip) ? null : skip });
  } catch (error) {
    console.error(`audit-hygiene: ${error.message}`);
    return 2;
  }
  const { findings, allowed } = applyAllowList(scan.hits, allow);
  if (options.json) {
    console.log(JSON.stringify({ findings: findings.map(({ kind, location, detail }) => ({ kind, location, detail })), allowed }, null, 2));
  } else {
    for (const { kind, location, detail } of findings) console.log(`${kind}  ${location}  ${detail}`);
    console.log(`${scan.read} blobs read, ${scan.skipped} skipped (binary or over 2 MB)`);
    console.log(`${findings.length} findings, ${allowed} allowed`);
  }
  return findings.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

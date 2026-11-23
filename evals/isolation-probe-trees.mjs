// What the isolation probe (isolation-probe.mjs) reads of real trees and of its sandbox: hashing, scanning and
// diffing the places a run may write, and looking inside the sandbox after a run for the positive controls and
// the agent's environment. Kept apart from the probe so it stays under the size limit
// (bin/conventions-structure.test.mjs); the probe imports what it uses from here and re-exports what it always
// exported, so codex-isolation-probe.mjs and the tests import those names from the probe as before.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sandboxPaths } from './configs.mjs';

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Paths compare case-insensitively on Windows. */
export const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
export const normalize = (text) => text.replace(/\s+/g, ' ').trim();

/** The `NAME=value` lines of a tool_result as an object. */
export function parseEnvLines(text) {
  const env = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

/** The components without which a trial of the current arm starts no engram of its own (its MCP server, its plugin, or
 * the hooks that start the server and post the session), so the engram controls do not apply to it. */
export const ENGRAM_PARTS = /^(?:mcp-engram|plugin-engram|hooks)$/;

// ---- hashing, scanning and diffing real trees -----------------------------------------------------------

export const DEFAULT_CHUNK = 1 << 20;
export const DEFAULT_CONCURRENCY = 8;
/** Tries after the first for a file that fails to open or read, and the pause between them. */
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 100;
const defaultOpenRead = (file, { chunkSize }) => fs.createReadStream(file, { highWaterMark: chunkSize });
const relOf = (root, full) => path.relative(root, full).split(path.sep).join('/');

/** Needles as buffers. A needle is `{ label, values }`: each value is searched as UTF-8 and as UTF-16LE (a
 * Windows tool may write either), and a file holds the needle when it holds any of its values. */
function compileNeedles(needles) {
  return needles.map(({ label, values }) => ({ label, buffers: values.flatMap((value) => [Buffer.from(value, 'utf8'), Buffer.from(value, 'utf16le')]) }));
}

/** Streams `file` once: its sha256, its size and which needles it holds. No whole-file buffering, so a
 * 700 MB binary costs a chunk of memory; the last `longest - 1` bytes of a chunk are carried into the next,
 * so a needle that straddles a chunk boundary is still found. `open(file, { chunkSize })` returns an async
 * iterable of buffers, and is injectable so a test can prove which files are opened. */
async function readFileOnce(file, { needles, open, chunkSize, collect = false }) {
  const hash = crypto.createHash('sha256');
  const body = [];
  let collected = 0;
  const found = new Set();
  const overlap = Math.max(0, ...needles.flatMap((needle) => needle.buffers.map((buffer) => buffer.length))) - 1;
  let size = 0;
  let tail = Buffer.alloc(0);
  for await (const chunk of open(file, { chunkSize })) {
    hash.update(chunk);
    size += chunk.length;
    if (collect && collected <= MAX_KEYED_BYTES) {
      body.push(chunk);
      collected += chunk.length;
    }
    if (needles.length === 0) continue;
    const window = tail.length > 0 ? Buffer.concat([tail, chunk]) : chunk;
    for (const needle of needles) {
      if (!found.has(needle.label) && needle.buffers.some((buffer) => window.includes(buffer))) found.add(needle.label);
    }
    tail = Buffer.from(window.subarray(Math.max(0, window.length - overlap)));
  }
  return { sha256: hash.digest('hex'), size, found: [...found], ...(collect && { body: collected <= MAX_KEYED_BYTES ? Buffer.concat(body) : null }) };
}

/** The largest file whose keys are compared: the account file is a few MB, and a file that is not that is not
 * what the key diff is for. A larger one is still hashed whole, and its keys are reported as not comparable. */
const MAX_KEYED_BYTES = 64 << 20;

/** The same JSON in a canonical text (object keys sorted at every depth), so two files that hold the same data
 * in another key order or with other whitespace hash alike: only a real change counts. */
const canonical = (value) => (Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : isObject(value)
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value));

/** The sha256 of each top-level key of a JSON object, and of each entry of its `projects` object under the name
 * `projects["<key>"]` (the account file keeps one entry per project folder there, which is where a trial's
 * path would show up). A Map of name to hash, and no value: a name says WHAT changed, which is enough, and a
 * report that held a value could hold a token. `null` when the text is not a JSON object (a write caught half
 * way, or a file that is not that), which is not the same as "every key changed". */
function keyHashes(body) {
  if (body === null || body === undefined) return null;
  let parsed;
  try {
    parsed = JSON.parse(body.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;
  const hashes = new Map();
  const put = (name, value) => hashes.set(name, crypto.createHash('sha256').update(canonical(value)).digest('hex'));
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'projects' && isObject(value)) {
      for (const [project, entry] of Object.entries(value)) put(`projects["${project}"]`, entry);
    } else {
      put(key, value);
    }
  }
  return hashes;
}

/** Which of `needles` (`{ label, values }`) `file` holds, as labels. Throws when the file cannot be read. */
export async function scanFile(file, needles, { openRead = defaultOpenRead, chunkSize = DEFAULT_CHUNK } = {}) {
  return (await readFileOnce(file, { needles: compileNeedles(needles), open: openRead, chunkSize })).found;
}

async function mapPool(items, limit, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

/** One tree of `snapshotTrees`; see there. */
async function snapshotTree({ root, mode = 'content', statOnly = [], jsonKeys = false }, { needles, open, chunkSize, concurrency, retries, retryDelayMs }) {
  // `dirs` holds the empty directories only (see `snapshotTrees`): they are not files, so they are not in
  // `files` and not in a diff, but their names are scanned like every other name.
  const tree = { root, mode, status: 'present', files: new Map(), keys: new Map(), dirs: new Set(), unreadable: [], hits: [], bytes: 0 };
  let rootStat;
  try {
    rootStat = fs.lstatSync(root);
  } catch (err) {
    tree.status = err.code === 'ENOENT' || err.code === 'ENOTDIR' ? 'missing' : 'unreadable';
    if (tree.status === 'unreadable') tree.unreadable.push({ path: '.', code: err.code ?? 'ERR' });
    return tree;
  }
  const exempt = new Set(statOnly.map(fold));
  const toHash = [];
  const record = (rel, full, size, mtimeMs) => {
    if (mode === 'content' && !exempt.has(fold(rel))) toHash.push({ rel, full });
    else tree.files.set(rel, `stat:${size}:${mtimeMs}`);
  };
  const fail = (rel, err) => {
    if (err.code !== 'ENOENT') tree.unreadable.push({ path: rel, code: err.code ?? 'ERR' }); // gone since the listing: not in the snapshot
  };

  if (mode === 'names') {
    try {
      for (const name of fs.readdirSync(root)) tree.files.set(name, 'name');
    } catch (err) {
      fail('.', err);
    }
  } else if (!rootStat.isDirectory()) {
    record('.', root, rootStat.size, rootStat.mtimeMs);
  } else {
    const walk = (dir) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) {
        fail(relOf(root, dir) || '.', err);
        return;
      }
      // A directory with nothing in it has no file whose path names it, so it is recorded by itself: one
      // named after the sandbox is still a trace of the trial. (A link to a directory is a link, above.)
      if (entries.length === 0 && dir !== root) tree.dirs.add(relOf(root, dir));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = relOf(root, full);
        if (entry.isSymbolicLink()) {
          // Never followed: a link out of the tree would pull another tree (or the whole disk) into this one.
          let target = '?';
          try {
            target = fs.readlinkSync(full);
          } catch {
            // an unreadable link is still a link
          }
          tree.files.set(rel, `link:${target}`);
        } else if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          try {
            const stat = fs.lstatSync(full);
            record(rel, full, stat.size, stat.mtimeMs);
          } catch (err) {
            fail(rel, err);
          }
        } else {
          tree.files.set(rel, 'special');
        }
      }
    };
    walk(root);
  }

  await mapPool(toHash, concurrency, async ({ rel, full }) => {
    try {
      let read;
      for (let attempt = 0; ; attempt += 1) {
        try {
          read = await readFileOnce(full, { needles, open, chunkSize, collect: jsonKeys && /\.json$/i.test(full) });
          break;
        } catch (err) {
          // A file another process holds for a moment (EBUSY, a sharing violation) usually reads a moment later;
          // one that is gone is not worth another try. What still fails after the retries is reported by the
          // caller as a file that was not scanned.
          if (err.code === 'ENOENT' || attempt >= retries) throw err;
          if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
      tree.files.set(rel, `sha256:${read.sha256}:${read.size}`);
      if (read.body !== undefined) tree.keys.set(rel, keyHashes(read.body));
      tree.bytes += read.size;
      if (read.found.length > 0) tree.hits.push({ path: rel, found: read.found, via: 'content' });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        tree.files.set(rel, `unreadable:${err.code ?? 'ERR'}`);
        tree.unreadable.push({ path: rel, code: err.code ?? 'ERR' });
      }
    }
  });

  // The names of every entry, whatever its mode: an unreadable file can still be named after the sandbox.
  for (const rel of [...tree.files.keys(), ...tree.dirs]) {
    const found = needles.filter((needle) => needle.names.some((value) => fold(rel).includes(fold(value)))).map((needle) => needle.label);
    if (found.length > 0) tree.hits.push({ path: rel, found, via: 'name' });
  }
  tree.hits.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.via < b.via ? -1 : 1));
  tree.unreadable.sort((a, b) => (a.path < b.path ? -1 : 1));
  return tree;
}

/** Hashes (and scans) the trees `specs` = `[{ name, root, mode, statOnly }]` and resolves to `{ ms, trees }`
 * where `trees[name]` is `{ root, mode, status, files, keys, unreadable, hits, bytes }`.
 *
 *  - `mode: 'content'`: every file is streamed once, giving `sha256:<hex>:<size>` and a scan for `needles`.
 *    `statOnly` lists relative paths inside such a tree that are described by size and mtime instead and
 *    never opened (the credentials file: its content is not the probe's business, and a probe that read a
 *    token would have to promise not to print it). `jsonKeys: true` also keeps, for each `.json` file, the
 *    hash of each of its top-level keys and of each `projects` entry (`keys`: rel path to a Map of name to
 *    hash, or `null` when the file is not a JSON object), so a diff can say which key changed.
 *  - `mode: 'stat'`: `stat:<size>:<mtimeMs>`, no content read. For trees that are huge (hundreds of MB of
 *    binaries) or where content must not be read.
 *  - `mode: 'names'`: the entry names one level down, nothing else. For a directory such as the home, where
 *    the question is only whether a new top-level entry appeared.
 * A root that does not exist has `status: 'missing'`; a root that is a single file is keyed `.`. Links are
 * recorded (`link:<target>`) and never followed. A file that cannot be read is `unreadable:<code>` and listed
 * in `unreadable`, so a hit that could have been is not silently missed, after `retries` more tries
 * `retryDelayMs` apart (a file busy for a moment is usually readable a moment later; a missing one is not
 * retried). A directory with nothing in it is kept in `dirs` (not in `files`, so not in a diff), because no
 * file path names it, and its name is scanned like the others. `needles` are `{ label, values }`;
 * `openRead`, `chunkSize` and the retry settings are for tests; files are read `concurrency` at a time. */
export async function snapshotTrees(specs, {
  needles = [], openRead = defaultOpenRead, chunkSize = DEFAULT_CHUNK, concurrency = DEFAULT_CONCURRENCY, retries = DEFAULT_RETRIES, retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) {
  const began = performance.now();
  const compiled = compileNeedles(needles).map((needle, index) => ({ ...needle, names: needles[index].values }));
  const trees = {};
  for (const spec of specs) trees[spec.name] = await snapshotTree(spec, { needles: compiled, open: openRead, chunkSize, concurrency, retries, retryDelayMs });
  return { ms: Math.round(performance.now() - began), trees };
}

/** The hits of a snapshot: `{ tree, path, found, via }` for each file whose content (`via: 'content'`) or
 * name (`via: 'name'`) holds a needle. Paths, never the values searched for.
 *
 * With `previous`, the snapshot taken before this window, only the hits this window introduced: a hit the
 * previous snapshot already had, at the same path, in a file that is unchanged since, belongs to whatever
 * wrote it earlier (the previous arm), and is not reported again. A file that changed in
 * this window and still holds the needle is this window's. (A file rewritten with identical bytes is
 * indistinguishable from an untouched one, which is the one thing this cannot see.) */
export function leakHits(snapshot, previous) {
  return Object.entries(snapshot.trees).flatMap(([tree, { hits, files }]) => {
    const was = previous?.trees[tree];
    const inherited = (hit) => {
      const old = was?.status === 'present' ? was.hits.find((candidate) => candidate.path === hit.path && candidate.via === hit.via) : undefined;
      return old !== undefined && was.files.get(hit.path) === files.get(hit.path);
    };
    return hits.filter((hit) => !inherited(hit)).map((hit) => ({ tree, ...hit }));
  });
}

/** The key-level difference of the JSON files that changed between two snapshots of one tree: `{ [rel]: { added,
 * removed, changed } }` with the key names sorted, or `{ [rel]: { unparsed: true } }` when either side did not
 * parse as a JSON object (a write caught half way); `null` when no file differs by key. A file that was not
 * there before (the tree was missing, or the file is new) has every key `added`: a newly created account
 * file is the case where a project entry of the trial is most likely and least visible. A file that was
 * there but whose keys were not read (it was unreadable) cannot be compared and is skipped; it is already
 * listed as unreadable. */
function diffKeys(was, now) {
  if (now.status !== 'present') return null;
  const wasFiles = was?.status === 'present' ? was.files : new Map();
  const wasKeys = was?.status === 'present' ? was.keys : new Map();
  const out = {};
  for (const [rel, hashes] of now.keys ?? []) {
    if (wasFiles.has(rel) && !wasKeys.has(rel)) continue;
    if (wasKeys.has(rel) && wasFiles.get(rel) === now.files.get(rel)) continue;
    const old = wasKeys.has(rel) ? wasKeys.get(rel) : new Map();
    if (hashes === null || old === null) {
      out[rel] = { unparsed: true };
      continue;
    }
    const entry = {
      added: [...hashes.keys()].filter((name) => !old.has(name)).sort(),
      removed: [...old.keys()].filter((name) => !hashes.has(name)).sort(),
      changed: [...hashes].filter(([name, hash]) => old.has(name) && old.get(name) !== hash).map(([name]) => name).sort(),
    };
    if (entry.added.length + entry.removed.length + entry.changed.length > 0) out[rel] = entry;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** What changed between two snapshots of the same trees, per tree: `{ added, removed, changed, appeared,
 * vanished }`, the paths sorted. A tree that went from missing to present has `appeared` (and all its
 * files `added`); the reverse is `vanished`. A tree that holds `jsonKeys` files also has `keys` (see
 * `diffKeys`) when one of them changed by key, which names what changed inside a file that is shared with
 * a live writer. */
export function diffSnapshots(before, after) {
  const result = {};
  for (const [name, now] of Object.entries(after.trees)) {
    const was = before.trees[name];
    const old = was?.status === 'present' ? was.files : new Map();
    const current = now.status === 'present' ? now.files : new Map();
    const keys = diffKeys(was, now);
    result[name] = {
      added: [...current.keys()].filter((rel) => !old.has(rel)).sort(),
      removed: [...old.keys()].filter((rel) => !current.has(rel)).sort(),
      changed: [...current].filter(([rel, signature]) => old.has(rel) && old.get(rel) !== signature).map(([rel]) => rel).sort(),
      appeared: was?.status !== 'present' && now.status === 'present',
      vanished: was?.status === 'present' && now.status !== 'present',
      ...(keys && { keys }),
    };
  }
  return result;
}

export const treeChanged = (diff) => diff.appeared || diff.vanished || diff.added.length + diff.removed.length + diff.changed.length > 0 || diff.keys !== undefined;

/** `splitByControl` for the `keys` of one tree: a key name counts as baseline when the control window saw it
 * change in the same file, in whatever category. Resolves to `{ fresh, baseline }`, each a keys object or
 * `undefined` when it would be empty. The file's own path can be baseline (the control saw it change) while
 * a key of it is fresh: that is the case this exists for. */
function splitKeys(keys, controlKeys) {
  const fresh = {};
  const baseline = {};
  for (const [rel, entry] of Object.entries(keys ?? {})) {
    const seen = controlKeys?.[rel];
    if (entry.unparsed) {
      (seen?.unparsed ? baseline : fresh)[rel] = entry;
      continue;
    }
    const names = new Set(seen && !seen.unparsed ? [...seen.added, ...seen.removed, ...seen.changed] : []);
    const into = { fresh: { added: [], removed: [], changed: [] }, baseline: { added: [], removed: [], changed: [] } };
    for (const category of ['added', 'removed', 'changed']) {
      for (const name of entry[category]) into[names.has(name) ? 'baseline' : 'fresh'][category].push(name);
    }
    for (const [side, target] of [['fresh', fresh], ['baseline', baseline]]) {
      if (into[side].added.length + into[side].removed.length + into[side].changed.length > 0) target[rel] = into[side];
    }
  }
  const orNothing = (object) => (Object.keys(object).length > 0 ? object : undefined);
  return { fresh: orNothing(fresh), baseline: orNothing(baseline) };
}

/** Splits the trial window's `trial` diff by the control window's `control` diff, both from
 * `diffSnapshots`: `baseline` holds what changed in the trial window at paths that also changed in the
 * control window (a live writer, not the trial), `fresh` holds the rest, which is what a trial could have
 * done. A path counts as baseline in whatever category the control saw it; key names are split the same way
 * (`splitKeys`). */
export function splitByControl(trial, control) {
  const fresh = {};
  const baseline = {};
  for (const [name, diff] of Object.entries(trial)) {
    const seen = new Set(control[name] ? [...control[name].added, ...control[name].removed, ...control[name].changed] : []);
    fresh[name] = { added: [], removed: [], changed: [], appeared: diff.appeared && !control[name]?.appeared, vanished: diff.vanished && !control[name]?.vanished };
    baseline[name] = { added: [], removed: [], changed: [], appeared: diff.appeared && Boolean(control[name]?.appeared), vanished: diff.vanished && Boolean(control[name]?.vanished) };
    for (const category of ['added', 'removed', 'changed']) {
      for (const rel of diff[category]) (seen.has(rel) ? baseline : fresh)[name][category].push(rel);
    }
    const keys = splitKeys(diff.keys, control[name]?.keys);
    if (keys.fresh) fresh[name].keys = keys.fresh;
    if (keys.baseline) baseline[name].keys = keys.baseline;
  }
  return { fresh, baseline };
}

/** The key-level leaks of a diff (`diffSnapshots`, or the `fresh` half of `splitByControl`): an ADDED or CHANGED
 * `projects["<path>"]` key that names one of `tokens` (the unique names of the trial's sandbox) or `workRoot`
 * (a string, or a list) is a project entry that Claude Code recorded for a folder of the trial, in the real
 * account file: the sandbox's cwd reached the real configuration. Hits are `{ tree, path, found, via: 'key' }`
 * with `found` naming which it matched (`sandbox`, `workRoot`). The path is taken out of the key and matched
 * by directory: a token must be one of its segments, and the work root must be the path or a parent of it,
 * so a sibling whose name only begins like the root is not a hit. The comparison is case-insensitive and
 * treats both separators alike, since the file records whatever spelling the process had. A removed key is not a leak;
 * a key that is not a project entry is reported in the diff and nowhere else. */
export function keyLeaks(diff, { tokens = [], workRoot = [] } = {}) {
  const normalize = (text) => text.replaceAll('\\', '/').toLowerCase();
  const sandbox = tokens.filter(Boolean).map(normalize);
  const roots = [workRoot].flat().filter(Boolean).map((root) => normalize(root).replace(/\/+$/, ''));
  const hits = [];
  for (const [tree, entry] of Object.entries(diff)) {
    for (const keys of Object.values(entry.keys ?? {})) {
      for (const name of [...(keys.added ?? []), ...(keys.changed ?? [])]) {
        const project = /^projects\["([\s\S]*)"\]$/.exec(name)?.[1];
        if (project === undefined) continue;
        // The path the key names, compared by directory: the sandbox is one segment of it, and the work root
        // is it or a prefix of it that ends at a separator. `work-other` is not `work`, `trial-10` is not `trial-1`.
        const text = normalize(project);
        const segments = text.split('/');
        const found = [...(sandbox.some((token) => segments.includes(token)) ? ['sandbox'] : []), ...(roots.some((root) => text === root || text.startsWith(`${root}/`)) ? ['workRoot'] : [])];
        if (found.length > 0) hits.push({ tree, path: name, found, via: 'key' });
      }
    }
  }
  return hits;
}

// ---- looking inside the sandbox ---------------------------------------------------------------------------

/** The relative paths of the files below `root` (never following a link), or none when it is missing. */
export function walkFiles(root) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(relOf(root, full));
    }
  };
  walk(root);
  return files.sort();
}

export const exists = (target) => fs.lstatSync(target, { throwIfNoEntry: false }) !== undefined;

/** The top two levels of the sandbox home as `{ path, kind, files, bytes }` (counts are of everything
 * below), so the parent can see what a trial left in a home at a glance. */
export function summarizeTop(home) {
  const count = (dir) => walkFiles(dir).reduce((total, rel) => ({ files: total.files + 1, bytes: total.bytes + (fs.lstatSync(path.join(dir, ...rel.split('/')), { throwIfNoEntry: false })?.size ?? 0) }), { files: 0, bytes: 0 });
  const describe = (full, rel) => {
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) return { path: rel, kind: 'link', files: 0, bytes: 0 };
    if (stat.isDirectory()) return { path: rel, kind: 'dir', ...count(full) };
    return { path: rel, kind: 'file', files: 1, bytes: stat.size };
  };
  const rows = [];
  for (const top of fs.readdirSync(home).sort()) {
    const row = describe(path.join(home, top), top);
    rows.push(row);
    if (row.kind === 'dir') for (const child of fs.readdirSync(path.join(home, top)).sort()) rows.push(describe(path.join(home, top, child), `${top}/${child}`));
  }
  return rows;
}

/** The first file below `store` (the sandbox's engram data directory) that holds each of `needles` (`{ label: text }`),
 * as `.engram/<relative path>`, or `null` for a label nothing holds. A file that cannot be read is skipped: the
 * answer is then "not found", which fails a control, never passes one. */
export async function findInStore(store, needles) {
  const hits = Object.fromEntries(Object.keys(needles).map((label) => [label, null]));
  const list = Object.entries(needles).map(([label, value]) => ({ label, values: [value] }));
  for (const rel of walkFiles(store)) {
    let found = [];
    try {
      found = await scanFile(path.join(store, ...rel.split('/')), list);
    } catch {
      // unreadable: not found
    }
    for (const label of found) hits[label] ??= `.engram/${rel}`;
  }
  return hits;
}

/** The first transcript below the sandbox home that holds the nonce, as its path under `.claude/projects`
 * (`null` when none does), and how many transcripts there are. */
async function findTranscript(home, nonce) {
  const projects = path.join(home, '.claude', 'projects');
  const transcripts = walkFiles(projects).filter((rel) => rel.endsWith('.jsonl'));
  for (const rel of transcripts) {
    if ((await scanFile(path.join(projects, ...rel.split('/')), [{ label: 'nonce', values: [nonce] }])).length > 0) return { rel, count: transcripts.length };
  }
  return { rel: null, count: transcripts.length };
}

const SESSION_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The trial's Claude session id, which the engram hooks post and store and which no real tree has a reason to hold:
 * from the agent's result (`session_id`), else from the name of its transcript (`<session id>.jsonl`). `source`
 * says which, and is `null` with `id: null` when neither has one that looks like an id. */
export async function findSession(parsed, home, nonce) {
  if (typeof parsed?.session_id === 'string' && SESSION_ID.test(parsed.session_id)) return { id: parsed.session_id, source: 'result' };
  const stem = path.posix.basename((await findTranscript(home, nonce)).rel ?? '', '.jsonl');
  return SESSION_ID.test(stem) ? { id: stem, source: 'transcript' } : { id: null, source: null };
}

/** The engram controls, in the order they are shown. They apply to the current arm only. */
const ENGRAM_CONTROLS = ['engramDb', 'engramHook', 'engramServer', 'engramSession', 'engramMemSave'];

/** The positive controls: what a trial that really ran under the sandbox must have written inside it. A
 * check that finds nothing in the real trees means something only if these find something in the sandbox.
 * Each is something the real hooks write on every path they can take, on Windows and on POSIX. The engram ones
 * apply to the current arm only (the minimal arm has no MCP servers and no plugin hooks), and not to an arm that takes
 * out engram's MCP server, its plugin or the hooks (`ENGRAM_PARTS`): `engram` says whether they apply.
 *  - `engramDb`: the store was created.
 *  - `engramHook`: UserPromptSubmit ran inside the sandbox. Its state file, `engram-claude-<session id>-tools-loaded`
 *    in TMPDIR, is written by the full path (`user-prompt-submit.sh`, lines 391-401) and by the fast path that bash
 *    on Windows takes unless `ENGRAM_CLAUDE_WINDOWS_BASH_SAFE_MODE=0` (lines 464-489), so it is there on both.
 *  - `engramServer`: SessionStart started the trial's own server. `engram serve` logs its listening port to
 *    `serve.err.log` in the data directory (`session-start.sh`, lines 24-43), and it is started only when nothing
 *    healthy answers on the port the hook resolved, so a log that names the trial's port is the trial's own.
 *  - `engramSession`: the session the hook posts (`session-start.sh`, lines 47-55: the Claude session id, the
 *    project and the cwd) is in the sandbox's store. The scan cannot tell that row from the MCP tool's, which
 *    also names the session, so this proves the session reached the trial's store and `engramServer` proves
 *    which server the hook started.
 *  - `engramMemSave`: the MCP tool wrote to the trial's data directory.
 * The prompt is NOT one of them: under Git Bash on Windows the UserPromptSubmit hook takes that fast path, which
 * prints its message and never posts the prompt (lines 481-488, against the `POST /prompts` of lines 377-389 and
 * 551-562), so on that machine a prompt in the store is never there, in a trial or in real use. Whether it
 * reached the store is reported (`sandbox.answers.engramPrompt`), and fails nothing.
 * `storeHits` is `findInStore` of the sandbox's engram store, `session` the trial's session id (or `null`: no control
 * that needs it can pass), `port` the trial's engram port, `log` the fake API's request log, which says whether
 * the tool was even offered, for the hint a failed control carries. */
export async function positiveControls({ engram, home, workspace, nonce, log = [], storeHits = {}, session = null, port = null }) {
  const controls = {};
  const found = await findTranscript(home, nonce);
  controls.transcript = { ok: found.rel !== null, path: found.rel === null ? null : `.claude/projects/${found.rel}`, transcripts: found.count };
  const holdsNonce = (file) => {
    try {
      return fs.readFileSync(path.join(workspace, file), 'utf8').includes(nonce);
    } catch {
      return false;
    }
  };
  controls.workspaceNonce = { ok: holdsNonce('probe-nonce.txt') };
  controls.workspaceWrite = { ok: holdsNonce('probe-write.txt') };
  if (engram) {
    const db = walkFiles(path.join(home, '.engram')).find((rel) => /\.(db|sqlite3?)$/i.test(rel));
    controls.engramDb = { applies: true, ok: db !== undefined, path: db === undefined ? null : `.engram/${db}` };
    const offered = log.some((request) => request.engramToolOffered);
    const called = log.some((request) => /^tool_use:.*mem_save$/.test(request.reply));
    const scratch = sandboxPaths(home).TMPDIR;
    const readDir = (dir) => {
      try {
        return fs.readdirSync(dir);
      } catch {
        return [];
      }
    };
    // Looked for by the session id when it is known, so another session's file never stands in for the trial's.
    const state = readDir(scratch).find((name) => /^engram-claude-.+-tools-loaded$/.test(name) && (session === null || name.includes(session)));
    controls.engramHook = {
      applies: true, ok: state !== undefined, path: state === undefined ? null : relOf(home, path.join(scratch, state)),
      ...(state === undefined && { hint: "the UserPromptSubmit hook left no state file (engram-claude-<session id>-tools-loaded) in the sandbox's temp directory: it did not run, or it ran with a TMPDIR that is not the trial's" }),
    };
    const listening = [path.join(home, '.engram', 'serve.err.log'), path.join(scratch, 'engram-serve.err.log')].flatMap((file) => {
      try {
        return [...fs.readFileSync(file, 'utf8').matchAll(/listening on \S*:(\d+)/g)].map((match) => Number(match[1]));
      } catch {
        return [];
      }
    });
    const ownServer = port !== null && listening.includes(Number(port));
    controls.engramServer = {
      applies: true, ok: ownServer, ports: [...new Set(listening)],
      ...(!ownServer && {
        hint: listening.length === 0
          ? "no server log in the sandbox says the engram server is listening: the SessionStart hook did not start one (it does only when nothing answers on its port), or the one it reached was not the trial's"
          : `the engram server log names port ${[...new Set(listening)].join(', ')}, not the trial's port ${port}: the SessionStart hook's server, and what it posts, are not the trial's own`,
      }),
    };
    controls.engramSession = {
      applies: true, ok: storeHits.session != null, path: storeHits.session ?? null,
      ...(storeHits.session == null && {
        hint: session === null
          ? "the session id of the trial is unknown (neither the agent's result nor its transcript's name has one), so its session cannot be looked for in the engram store"
          : "the trial's session is not in its engram store: the SessionStart hook did not post it, or the server it posted to was not the trial's own",
      }),
    };
    controls.engramMemSave = {
      applies: true, ok: storeHits.memory != null, path: storeHits.memory ?? null,
      ...(storeHits.memory == null && {
        hint: !offered
          ? 'the engram tool was never offered to the model: is the engram MCP server in the seeded .claude.json, or deferred behind a tool search?'
          : called
            ? "the engram tool was offered and called, but the memory is not in the trial's engram store: does the MCP server honour ENGRAM_DATA_DIR?"
            : 'the engram tool was offered but never called',
      }),
    };
  } else {
    for (const name of ENGRAM_CONTROLS) controls[name] = { applies: false, ok: true };
  }
  return controls;
}

/** The variables whose value, as the agent's own tools print it, must lie inside the sandbox. */
const EXPECTED_INSIDE = [
  'HOME', 'USERPROFILE', 'HOMEPATH', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache',
];

/** The environment as the agent's tools saw it: the NAME=value lines of the tool_result that has them, and,
 * for each variable that must point into the sandbox, `inside`, `outside` or `empty`. "Inside" means the
 * value holds the sandbox's unique name, which survives every spelling of a path (Git Bash's `/c/Users/...`,
 * 8.3 short names, slashes). Informational: an `outside` is a warning, not a failure, because a shell may
 * legitimately rewrite a variable of its own (`TMPDIR=/tmp`) and the leak scan is what fails the probe. */
function inspectEnv(toolResults, token) {
  const parsed = toolResults.map((result) => parseEnvLines(result.text)).find((env) => 'OAUTH_TOKEN_SET' in env);
  if (!parsed) return { envLines: null, envChecks: {}, engramEnv: null };
  const envChecks = {};
  for (const name of EXPECTED_INSIDE) {
    const value = parsed[name];
    envChecks[name] = value === undefined || value === '' ? 'empty' : fold(value).includes(fold(token)) ? 'inside' : 'outside';
  }
  // The engram variables are not paths: what matters is that the port is the trial's and that no URL or socket is set.
  const engramEnv = { port: parsed.ENGRAM_PORT ?? '', urlSet: (parsed.ENGRAM_URL ?? '') !== '', socketSet: (parsed.ENGRAM_SOCKET ?? '') !== '' };
  return { envLines: parsed, envChecks, engramEnv };
}

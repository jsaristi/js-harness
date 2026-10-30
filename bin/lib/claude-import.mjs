// The check behind `doctor`'s claude-import row (the reverse-engineering document, 13.3 row 16; F8 S13, D1): Claude
// loads a project's AGENTS.md through the root CLAUDE.md `init` writes, which imports it, and the native loader's
// off-switches do not reach that path (docs/proposals/harness-diet.md, section 4). What still goes wrong is a root
// CLAUDE.md that lost its import, and a CLAUDE.md or CLAUDE.local.md in a folder above the project, which loads into
// every session there unseen (the fragile cases of the same section). A linked worktree's session loads no file of
// its main checkout (the diet's section 14.1, tested with a real `git worktree`), so those folders are left out.
// `addImport` is the row's other side: `init` adds the import to a project's own CLAUDE.md (odd/tasks/claude-md-block.md).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { excludingGlob } from './payload.mjs';

/** The files above a project that Claude loads beside its own. */
const ABOVE = ['CLAUDE.md', 'CLAUDE.local.md'];

const NONE = Object.freeze({ state: 'n/a', fix: [] });

/** Whether `text`, a CLAUDE.md, imports AGENTS.md: a line of its own that is the import, outside a code fence. */
export function importsAgents(text) {
  let fence = null; // the opening fence while inside one: it closes only on its own character, at least as long
  for (const line of text.split(/\r?\n/)) {
    const mark = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (mark && fence === null) fence = mark;
    else if (mark && mark[0] === fence[0] && mark.length >= fence.length && line.trim() === mark) fence = null;
    else if (fence === null && /^@(\.\/)?AGENTS\.md\s*$/.test(line.trim())) return true;
  }
  return false;
}

/** The line that imports AGENTS.md. */
const IMPORT = '@AGENTS.md';

/** `bytes`, a CLAUDE.md, with the import as its first line and an empty line after it, in the file's own line ends and
 * after a UTF-8 byte order mark it opens with; `null` for one in UTF-16, where those bytes would not read as the line. */
export function withImport(bytes) {
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return null;
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const eol = bytes.includes('\r\n') ? '\r\n' : '\n';
  return Buffer.concat([bytes.subarray(0, bom), Buffer.from(`${IMPORT}${eol}${eol}`), bytes.subarray(bom)]);
}

/** Whether the project's CLAUDE.md and AGENTS.md at `root` are one file under two names, through a link or a hard link:
 * that file holds the whole block of the harness's lines (odd/tasks/claude-md-block.md, D1). */
export function oneFile(root) {
  try {
    const [claude, agents] = ['CLAUDE.md', 'AGENTS.md'].map((name) => fs.statSync(path.join(root, name), { bigint: true }));
    return claude.dev === agents.dev && claude.ino === agents.ino;
  } catch {
    return false;
  }
}

/** The actions of `init` adding the import to the project's own CLAUDE.md at `root`, beside the AGENTS.md it wrote, so
 * Claude loads the harness's lines (odd/tasks/claude-md-block.md, D2): none where it imports AGENTS.md already or is a
 * link to it; an `imported` one where git can give the file back exactly, a regular file whose bytes are those a
 * checkout of the index writes, since git is all that undoes the write; a `skip` naming the line to add anywhere else,
 * and a `problem` where the write failed. */
export function addImport(root, { spawn = spawnSync, writeFile = fs.writeFileSync } = {}) {
  const file = path.join(root, 'CLAUDE.md');
  const skip = (why) => [{ kind: 'skip', path: 'CLAUDE.md', reason: `${why}, so init does not write it: add the line ${IMPORT} at its top, or Claude never loads AGENTS.md` }];
  let bytes;
  try {
    if (fs.lstatSync(file).isSymbolicLink()) {
      if (oneFile(root)) return [];
      return importsAgents(fs.readFileSync(file, 'utf8')) ? [] : skip('it is a link');
    }
    if (!fs.lstatSync(file).isFile()) return skip('it is not a regular file');
    bytes = fs.readFileSync(file);
  } catch {
    return skip('it cannot be read');
  }
  if (importsAgents(bytes.toString('utf8'))) return [];
  // Git gives back the bytes a checkout of the index writes (`cat-file --filters`: its line ends and filters), under the
  // name git tracks, with no flag that hides a change. An empty `status` proves none of it: a file whose name differs in
  // case, autocrlf over a working copy in LF, a skip-worktree change (the independent verifier on 00afb013).
  const listed = spawn('git', ['ls-files', '-v', '-z', '--', 'CLAUDE.md'], { cwd: root, encoding: 'utf8' });
  const checkout = spawn('git', ['cat-file', '--filters', ':CLAUDE.md'], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  if (listed?.status !== 0 || listed.stdout !== 'H CLAUDE.md\0' || checkout?.status !== 0 || !Buffer.isBuffer(checkout.stdout) || !checkout.stdout.equals(bytes)) {
    return skip('git could not give it back byte for byte (it is untracked, changed, marked to skip, or not the bytes a checkout writes)');
  }
  const imported = withImport(bytes);
  if (imported === null) return skip('it is in UTF-16');
  try {
    writeFile(file, imported);
  } catch (err) {
    return [{ kind: 'problem', path: 'CLAUDE.md', reason: `the line ${IMPORT} could not be added at its top (${err.message}): add it by hand; git checkout -- CLAUDE.md gives the file back` }];
  }
  return [{ kind: 'imported', path: 'CLAUDE.md', line: IMPORT }];
}

/** The main checkout of the linked worktree at `dir`, or `null` for a main checkout, a folder git does not know, or
 * an answer git cannot give. */
export function mainCheckoutOf(dir, spawn = spawnSync) {
  const ask = (flag) => {
    const result = spawn('git', ['rev-parse', '--path-format=absolute', flag], { cwd: dir, encoding: 'utf8', timeout: 10_000 });
    return result.status === 0 ? result.stdout.trim() : null;
  };
  try {
    const common = ask('--git-common-dir');
    const own = ask('--git-dir');
    if (!common || !own || path.resolve(common) === path.resolve(own)) return null;
    return path.basename(common) === '.git' ? path.dirname(common) : null;
  } catch {
    return null;
  }
}

/** Whether `dir` is `root` or inside it. */
const within = (root, dir) => {
  const relative = path.relative(root, dir);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

/** The health of the import at `project`, a project's top folder (`null` outside one), as `{ state, fix }`: `n/a`
 * where the project is not initialized or has no AGENTS.md; `missing` when its root CLAUDE.md is gone, does not
 * import AGENTS.md or a `claudeMdExcludes` glob drops it; `mismatch` with each file when a CLAUDE.md or CLAUDE.local.md
 * no glob drops sits in a folder above it; `ok` otherwise. `mainCheckout` is the main checkout of a linked worktree
 * (`mainCheckoutOf` when not given); `home` adds the user's settings layer to the project's two. */
export function importHealth(project, { mainCheckout, home } = {}) {
  if (!project) return NONE;
  if (!fs.existsSync(path.join(project, 'harness.json')) || !fs.existsSync(path.join(project, 'AGENTS.md'))) return NONE;
  const settings = [
    ...(home ? [path.join(home, '.claude', 'settings.json')] : []),
    path.join(project, '.claude', 'settings.json'),
    path.join(project, '.claude', 'settings.local.json'),
  ];
  const fix = [];
  const claude = path.join(project, 'CLAUDE.md');
  const dropping = fs.existsSync(claude) ? excludingGlob(settings, claude) : null;
  if (!fs.existsSync(claude)) {
    fix.push('claude-import: the project has no root CLAUDE.md, so Claude may not load AGENTS.md: write one whose first line is @AGENTS.md');
  } else if (!oneFile(project) && !importsAgents(fs.readFileSync(claude, 'utf8'))) {
    fix.push('claude-import: CLAUDE.md does not import AGENTS.md, so Claude may not load it: add the line @AGENTS.md');
  } else if (dropping !== null) {
    fix.push(`claude-import: the claudeMdExcludes glob ${dropping} drops CLAUDE.md, so Claude does not load AGENTS.md: take CLAUDE.md out of it`);
  }
  const missing = fix.length > 0;
  const main = mainCheckout === undefined ? mainCheckoutOf(project) : mainCheckout;
  const loads = (file) => fs.existsSync(file) && excludingGlob(settings, file) === null;
  const above = [];
  for (let dir = path.dirname(project); ; dir = path.dirname(dir)) {
    if (!(main && within(main, dir))) for (const name of ABOVE) if (loads(path.join(dir, name))) above.push(path.join(dir, name));
    if (path.dirname(dir) === dir) break;
  }
  if (above.length > 0) {
    const count = above.length === 1 ? '1 file above the project loads' : `${above.length} files above the project load`;
    fix.push(`claude-import: ${count} into every session in it, beside its CLAUDE.md: move ${above.length === 1 ? 'it or remove it' : 'them or remove them'}`, ...above);
  }
  return { state: missing ? 'missing' : above.length > 0 ? 'mismatch' : 'ok', fix };
}

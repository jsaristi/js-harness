// The check behind `doctor`'s claude-import row (the reverse-engineering document, 13.3 row 16; F8 S13, D1): Claude
// loads a project's AGENTS.md through the root CLAUDE.md `init` writes, which imports it, and the native loader's
// off-switches do not reach that path (docs/proposals/harness-diet.md, section 4). What still goes wrong is a root
// CLAUDE.md that lost its import, and a CLAUDE.md or CLAUDE.local.md in a folder above the project, which loads into
// every session there unseen (the fragile cases of the same section). A linked worktree's session loads no file of
// its main checkout (the diet's section 14.1, tested with a real `git worktree`), so those folders are left out.
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
  } else if (!importsAgents(fs.readFileSync(claude, 'utf8'))) {
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

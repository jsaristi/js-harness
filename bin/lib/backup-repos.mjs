// What the backup reads from each git repository of config.json's `bundles` (odd/tasks/backup-ready.md): the refs its
// bundle names, the bundle itself, the uncommitted edits of each worktree and the records js-harness keeps in the git
// directory. Every function here only reads the repository: `git` is `(cwd, args, options) => result`, run as a program.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { redactSecrets } from './backup.mjs';

/** An untracked file larger than this is not copied: the backup is a git repository on GitHub, which refuses a file
 * over 100 MB, and a file this large is a build output more often than work. `backup ready` names each one. */
export const UNTRACKED_MAX_BYTES = 5 * 1024 * 1024;

/** A folder's name for a path, as Claude names a project folder (`D--js-harness`), with a hash of the whole path so
 * `a-b` and `a/b` never share one. */
export function pathKey(place) {
  return `${path.resolve(place).replace(/[^A-Za-z0-9]/g, '-')}-${pathHash(place)}`;
}

/** A shorter folder name for a path: its last part and the same hash. The copies of a worktree sit two such names
 * deep in the clone, and two whole paths there passed Windows' 260 characters, where git cannot add a file. */
export function shortKey(place) {
  return `${path.basename(path.resolve(place)).replace(/[^A-Za-z0-9]/g, '-')}-${pathHash(place)}`;
}

const pathHash = (place) => createHash('sha256').update(path.resolve(place).toLowerCase()).digest('hex').slice(0, 8);

/** The worktrees of a repository, the main checkout first: its path, its HEAD, and whether git calls it prunable
 * (its folder is gone). */
export function worktreesOf(git, source) {
  const listed = git(source, ['worktree', 'list', '--porcelain']);
  if (listed.status !== 0) return [];
  return listed.stdout
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/))
    .filter((lines) => lines[0]?.startsWith('worktree '))
    .map((lines) => ({
      path: lines[0].slice('worktree '.length),
      head: lines.find((line) => line.startsWith('HEAD '))?.slice(5) ?? null,
      prunable: lines.some((line) => line.startsWith('prunable')),
    }));
}

/** The stash entries, newest first, as `{ sha, name, subject }`; none when there is no stash. */
export function stashesOf(git, source) {
  const listed = git(source, ['log', '-g', '--format=%H %gs', 'refs/stash']);
  if (listed.status !== 0) return [];
  return listed.stdout
    .split('\n')
    .filter(Boolean)
    .map((line, i) => ({ sha: line.slice(0, 40), name: `stash@{${i}}`, subject: line.slice(41) }));
}

/** The refs a bundle of `source` names, as sorted `<sha> <ref>` lines: every ref, then each stash entry and each
 * worktree's HEAD under `refs/js-harness/`, since `for-each-ref` names only the newest stash and no detached commit.
 * Null, with git's reason, when git cannot read the repository. */
export function bundleRefs(git, source) {
  const refs = git(source, ['for-each-ref', '--format=%(objectname) %(refname)']);
  if (refs.status !== 0) return { reason: `${refs.stderr || ''}`.trim().split('\n')[0] || 'git failed' };
  const extra = [
    ...stashesOf(git, source).map((s, i) => `${s.sha} refs/js-harness/stash/${i}`),
    ...worktreesOf(git, source)
      .filter((w) => w.head && !/^0+$/.test(w.head) && !w.prunable)
      .map((w, i) => `${w.head} refs/js-harness/worktree/${i}`),
  ];
  return { listed: [...refs.stdout.split('\n').filter(Boolean), ...extra].sort() };
}

/** How many commits of `listed` no remote holds. Every one is read through stdin, so a stash entry counts. */
export function unpushedCount(git, source, listed) {
  const input = `${listed.map((line) => line.split(' ')[0]).join('\n')}\n--not\n--remotes\n`;
  const counted = git(source, ['rev-list', '--count', '--ignore-missing', '--stdin'], { input });
  return counted.status === 0 ? Number(counted.stdout.trim()) || 0 : null;
}

/** What the backup keeps of a repository beside its bundle, as `{ path, buffer, kinds }` with `path` relative to its
 * folder `git/<shortKey(source)>/`: each worktree's uncommitted edits as `worktrees/<key>.patch` (`git diff HEAD`, staged
 * and not) and its untracked files under `worktrees/<key>.untracked/`, and the files at the top of the git directory's
 * `js-harness/` folder, the codex-review and merge-queue records (its `traces/` are test timing caches). Every file has
 * its secrets blanked, `kinds` naming them. Also the worktrees that have edits, and the untracked files too large to copy.
 * Null when git cannot read the repository. */
export function repoFiles(git, source) {
  const commonDir = git(source, ['rev-parse', '--git-common-dir']);
  if (commonDir.status !== 0) return null;
  const files = [];
  const skipped = [];
  const worktrees = [];
  const add = (relative, buffer) => {
    const scan = redactSecrets(buffer.toString('utf8'));
    files.push({ path: relative, buffer: scan.kinds.length ? Buffer.from(scan.text, 'utf8') : buffer, kinds: scan.kinds });
  };
  for (const worktree of worktreesOf(git, source).filter((w) => !w.prunable)) {
    const key = shortKey(worktree.path);
    // A buffer, not text: a change to a file that is not UTF-8 must come back as the same bytes.
    const diff = git(worktree.path, ['diff', 'HEAD', '--binary'], { encoding: 'buffer' });
    const patch = diff.status === 0 && diff.stdout.length > 0;
    if (patch) add(`worktrees/${key}.patch`, diff.stdout);
    const others = git(worktree.path, ['ls-files', '--others', '--exclude-standard', '-z']);
    // A name ending in `/` is a nested repository, which is its own source.
    const names = others.status === 0 ? others.stdout.split('\0').filter((name) => name && !name.endsWith('/')) : [];
    let untracked = 0;
    for (const name of names) {
      const full = path.join(worktree.path, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      untracked += 1;
      if (stat.size > UNTRACKED_MAX_BYTES) skipped.push({ path: full, bytes: stat.size });
      else add(`worktrees/${key}.untracked/${name}`, fs.readFileSync(full));
    }
    if (patch || untracked) worktrees.push({ path: worktree.path, key, patch, untracked });
  }
  const records = path.join(path.resolve(source, commonDir.stdout.trim()), 'js-harness');
  const entries = fs.existsSync(records) ? fs.readdirSync(records, { withFileTypes: true }) : [];
  for (const entry of entries.filter((e) => e.isFile()).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    add(`js-harness/${entry.name}`, fs.readFileSync(path.join(records, entry.name)));
  }
  return { files, skipped, worktrees };
}

/** Writes the bundle of every commit of `listed` that is on no remote. The refs are made in a scratch bare repository
 * that borrows the source's objects through `objects/info/alternates`, so the source never gains a ref. */
export function writeBundle(git, source, listed, out, tmp = os.tmpdir()) {
  const common = path.resolve(source, git(source, ['rev-parse', '--git-common-dir']).stdout.trim());
  const scratch = fs.mkdtempSync(path.join(tmp, 'backup-bundle-'));
  try {
    const must = (result, what) => {
      if (result.status !== 0) throw new Error(`git bundle of ${source} failed (${what}): ${`${result.stderr}`.trim()}`);
    };
    must(git(scratch, ['init', '-q', '--bare']), 'init');
    fs.writeFileSync(path.join(scratch, 'objects', 'info', 'alternates'), `${path.join(common, 'objects').replace(/\\/g, '/')}\n`);
    const input = listed.map((line) => `create ${line.slice(41)} ${line.slice(0, 40)}\n`).join('');
    must(git(scratch, ['update-ref', '--stdin'], { input }), 'update-ref');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    must(git(scratch, ['bundle', 'create', out, '--all', '--not', '--remotes']), 'bundle create');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

#!/usr/bin/env node
// The seeded range: a git repository of two commits whose second one is known to be wrong in seven places.
//
//   node evals/review/seeded.mjs --out <dir>
//
// Why. Two configurations of the Codex review are compared by what they find, and on a real range nobody
// knows what there was to find: a review that reports nothing may have missed everything. Here the change
// under review was written with seven defects in it, each of another kind, and `seeded/key.json` says
// where each one is. A review of the range is then scored against the key (`./score.mjs`): how many of the
// seven it named, and what else it reported.
//
// What is in `seeded/`. `base/` and `head/` are the two trees of one small project, `head` being `base`
// with one feature added. `key.json` is the answer key, beside the trees and in neither. This module
// copies the two trees into a repository as two commits and copies nothing else: the key never reaches a
// folder a review can read. Nothing in either tree says that anything in it was put there to be found.
//
// The same commits every time. A result names the range it was read on by commit id, and the key names
// lines of one exact file, so a build must give the same two commits on every machine: the files are
// written byte for byte, `core.autocrlf` is off, and the author, the committer, the dates and the messages
// are fixed. The key holds the two ids it was written for, and a test holds the build to them.
//
// It calls no model and nothing of Codex: it runs `git`, in the folder it is given.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEEDED_DIR = fileURLToPath(new URL('./seeded/', import.meta.url));

// The schema of `seeded/key.json`: `{ schema, base, head, defects: [{ id, kind, file, start, end, summary }] }`,
// `base` and `head` the commit ids the key was written for, `file` from the root of the project with forward
// slashes, `start` and `end` lines of that file as it is at `head`.
export const SEEDED_KEY_SCHEMA = 'js-harness.review-seeded-key/v1';

const USAGE = 'Usage: node evals/review/seeded.mjs --out <dir>\n<dir> must be empty or not there yet: the repository is built in it.';

// Who made the two commits, and when. Fixed, and of no machine: a commit id is a digest of these too.
const AUTHOR = { name: 'Stockroom Maintainers', email: 'maintainers@stockroom.invalid' };

// The two commits, in order: the tree each one is, its message and its date. The messages are those of the
// project, as a reviewer who reads the log would expect them.
const COMMITS = [
  { tree: 'base', message: 'feat: receive, issue, list and snapshot', date: '2026-03-02T09:00:00Z' },
  { tree: 'head', message: 'feat(stocktake): counts, a low-stock report and its export', date: '2026-03-09T16:30:00Z' },
];

/** The environment git is run in: `env` without any of git's own variables, and with no configuration but
 * the repository's. A hook exports `GIT_DIR` and `GIT_INDEX_FILE` to what it runs, and with them a
 * `git init` in another folder acts on the repository being committed to. The user's and the system's
 * configuration are left out because either can change what a commit holds: `core.autocrlf`, a signing
 * key, a hooks path, a global ignore file. */
export function gitEnv(env = process.env) {
  const kept = Object.entries(env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'));
  // `/dev/null` is what git documents for "no file", and Git for Windows reads it as that too.
  return { ...Object.fromEntries(kept), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
}

/** The files under `dir`, as paths from it with forward slashes, in the order of their code units. */
export function treeFiles(dir) {
  const files = [];
  const walk = (folder, prefix) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(folder, entry.name), `${prefix}${entry.name}/`);
      else files.push(`${prefix}${entry.name}`);
    }
  };
  walk(dir, '');
  return files.sort();
}

/** Builds the seeded repository in `dir`, which must be empty or not there yet, and gives
 * `{ root, base, head }`: where it is, and the full ids of its two commits. The working tree is left at
 * `head`, clean, on the branch `main`. `deps` (all optional): `spawn`, the `env` git's is made from, and
 * `source`, the folder that holds the two trees.
 *
 * Throws, saying why, when `dir` holds anything or is not a folder, and when a git command fails. */
export function buildSeededRepo(dir, { spawn = spawnSync, env = process.env, source = SEEDED_DIR } = {}) {
  const root = path.resolve(dir);
  const there = fs.statSync(root, { throwIfNoEntry: false });
  if (there && !there.isDirectory()) throw new Error(`${root} is not a folder, so no repository can be built in it.`);
  if (there && fs.readdirSync(root).length > 0) throw new Error(`${root} is not empty: the seeded repository is built in an empty folder, or in one that is not there yet.`);
  fs.mkdirSync(root, { recursive: true });

  const environment = gitEnv(env);
  const git = (args, extra = {}) => {
    const ran = spawn('git', args, { cwd: root, env: { ...environment, ...extra }, encoding: 'utf8' });
    if (ran.error || ran.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${root}: ${ran.error?.message ?? String(ran.stderr).trim()}`);
    return ran.stdout.trim();
  };
  // No template, so no sample hook is copied in; SHA-1, whatever this git would choose by itself.
  git(['init', '--quiet', '--template=', '--object-format=sha1', '--initial-branch=main']);
  // Off, so a file is committed with the bytes it has and checked out with the bytes it was committed with.
  git(['config', 'core.autocrlf', 'false']);
  // Off, so the mode of a file is the same from a file system that keeps none (Windows) and from one that does.
  git(['config', 'core.fileMode', 'false']);
  git(['config', 'commit.gpgsign', 'false']);

  const ids = {};
  for (const { tree, message, date } of COMMITS) {
    // The tree replaces what was there, so a file `head` no longer has is gone from its commit.
    for (const entry of fs.readdirSync(root)) {
      if (entry !== '.git') fs.rmSync(path.join(root, entry), { recursive: true, force: true });
    }
    const files = treeFiles(path.join(source, tree));
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), fs.readFileSync(path.join(source, tree, file)));
    }
    // `--force`: every file of the tree is committed, also one an ignore rule of the tree itself would hide.
    git(['add', '--all', '--force', '.']);
    git(['commit', '--quiet', '--no-verify', '-m', message], {
      GIT_AUTHOR_NAME: AUTHOR.name,
      GIT_AUTHOR_EMAIL: AUTHOR.email,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_NAME: AUTHOR.name,
      GIT_COMMITTER_EMAIL: AUTHOR.email,
      GIT_COMMITTER_DATE: date,
    });
    ids[tree] = git(['rev-parse', 'HEAD']);
    // What was committed is what was copied: a file git left out, or took in from elsewhere, would make a
    // range the key was not written for.
    const committed = git(['ls-tree', '-r', '--name-only', ids[tree]]).split('\n').sort();
    if (committed.join('\n') !== files.join('\n')) throw new Error(`The commit of the ${tree} tree does not hold the files of ${path.join(source, tree)}.`);
  }
  return { root, base: ids.base, head: ids.head };
}

/** Runs the command and returns its exit code: 0 with `{ root, base, head }` printed as JSON, 1 with the
 * reason when the repository could not be built, 2 with the usage on a bad command line. `deps` (all
 * optional) injects `log` and `error`, and what `buildSeededRepo` takes. */
export function seededMain(argv = process.argv.slice(2), deps = {}) {
  const { log = console.log, error = console.error, ...build } = deps;
  const out = argv.length === 2 && argv[0] === '--out' && argv[1] !== '' ? argv[1] : null;
  if (out === null) {
    error(USAGE);
    return 2;
  }
  try {
    log(JSON.stringify(buildSeededRepo(out, build), null, 2));
    return 0;
  } catch (err) {
    error(err.message);
    return 1;
  }
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = seededMain(process.argv.slice(2));
}

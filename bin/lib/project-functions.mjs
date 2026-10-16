// What a project's switches are, read from where a command needs them: the working tree for a command that
// acts there, a commit for a check of commits (the pushed tip, the head a review reads), so that a check
// answers for the commit it judges and not for whatever is checked out. The rules themselves are
// bin/lib/functions.mjs; this module is the git and the file reading around them. See
// odd/tasks/on-demand-functions.md ("How each command reads a switch").
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SWITCHES, readFunctions, resolveFunctions } from './functions.mjs';

const HARNESS = 'harness.json';

/** Git in `cwd` as `(args) => stdout`, or `null` for a git that did not answer. The buffer is the gate's
 * (bin/check.mjs): a tree of tens of thousands of names does not fit the default megabyte. */
export function gitIn(cwd, spawn = spawnSync) {
  return (args) => {
    try {
      const result = spawn('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      return result && !result.error && result.status === 0 ? result.stdout : null;
    } catch {
      return null; // no git on PATH
    }
  };
}

/** Names as git prints them with `-z`: one per NUL, never quoted, so a space or a letter outside ASCII
 * comes back as it is. */
const names = (stdout) => stdout.split('\0').filter(Boolean);

/** The names of the project's files as the working tree has them: what git tracks, has staged, or sees
 * untracked and does not ignore, since a program an agent has just written counts before its first
 * commit. `{ paths }`, or `{ unknown }` where git could not say (no repository, no git). */
export function workingTree(git) {
  // `:/` and `--full-name`: every file of the repository, named from its top, from whatever folder git runs in.
  // Run from a folder below, git lists that folder alone, and a project whose programs lie elsewhere read as
  // one with none.
  const listed = git(['ls-files', '--cached', '--others', '--exclude-standard', '--full-name', '-z', '--', ':/']);
  return listed === null ? { unknown: 'git could not list the files' } : { paths: names(listed) };
}

/** The names of the files of the commit `rev`: `{ paths }`, or `{ unknown }`. */
export function commitTree(git, rev) {
  // `--full-tree`: the whole commit, from whatever folder git runs in, not the part below that folder.
  const listed = git(['ls-tree', '-r', '--full-tree', '--name-only', '-z', rev]);
  return listed === null ? { unknown: `git could not list the files of ${rev}` } : { paths: names(listed) };
}

/** The text of a `harness.json` as `{ declared }`, the object it holds, or `{ error }`. A byte-order mark
 * at its start, which an editor on Windows may leave, is no part of the JSON. */
function parsed(text) {
  let value;
  try {
    value = JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    return { error: `${HARNESS} is not valid JSON: ${err.message}` };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { error: `${HARNESS} must be a JSON object` };
  }
  return { declared: value };
}

/** `harness.json` of the folder `root`: `{ declared }`, with `undefined` where there is no such file, which
 * is a project that declares nothing and no error; or `{ error }`. A file that is there and cannot be read
 * (no permission, a folder of that name) is an error like one that is not JSON: only a file that is not
 * there declares nothing. */
export function harnessOfTree(root) {
  const file = path.join(root, HARNESS);
  if (!fs.existsSync(file)) return { declared: undefined };
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { error: `${HARNESS} could not be read: ${err.message}` };
  }
  return parsed(text);
}

/** `harness.json` of the commit `rev`, with the same answers. A commit git cannot read is an error and
 * never "declares nothing": a check must not take a commit it could not open for one with every default. */
export function harnessOfCommit(git, rev) {
  // The `harness.json` at the top of the commit, as `<rev>:harness.json` names it below: `ls-tree` names a
  // path from the folder git runs in unless it is told the whole tree.
  const listed = git(['ls-tree', '--full-tree', '--name-only', '-z', rev, '--', HARNESS]);
  if (listed === null) return { error: `git could not read ${rev}` };
  if (names(listed).length === 0) return { declared: undefined };
  const text = git(['show', `${rev}:${HARNESS}`]);
  return text === null ? { error: `git could not read ${HARNESS} of ${rev}` } : parsed(text);
}

/** A project's functions as `{ errors, resolved }`: `harness` is what `harnessOfTree` or `harnessOfCommit`
 * answered, `tree` what `workingTree` or `commitTree` did. A `harness.json` that cannot be read is one
 * error, and every switch is then read as on: nothing is turned off by a file nobody could read. */
export function functionsOf(harness, tree) {
  if (harness.error) {
    const strict = Object.fromEntries(Object.entries(SWITCHES).map(([name, { strict: value }]) => [name, value]));
    return { errors: [harness.error], resolved: resolveFunctions(strict, tree) };
  }
  const { values, errors } = readFunctions(harness.declared ?? null);
  return { errors, resolved: resolveFunctions(values, tree) };
}

// `onboard`: the pre-plan and the plan of a new project, made by the session the owner talks to — see
// odd/tasks/onboarding.md. `check` holds what the session wrote to the shape the design asks for and never runs a
// command; `hash` prints what an approval records; `template` prints a document's skeleton, and with `--write`
// creates it, never over a file that exists. The rules are bin/lib/onboard.mjs. Zero dependencies.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENTS_PATH, ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_PATH,
  checkOnboarding, featureTemplate, findingLine, hashes, originTemplate, roadmapTemplate, stageReport,
} from './lib/onboard.mjs';
import { agentsTemplate, projectLocation } from './lib/project.mjs';

const USAGE = [
  'Usage: js-harness onboard [--cwd <path>]',
  '       js-harness onboard check [--plan] [--cwd <path>]',
  '       js-harness onboard hash [--cwd <path>]',
  '       js-harness onboard template feature|origin|roadmap [--write] [--cwd <path>]',
  'With no verb: the stage the onboarding is in, read from its files and git, and what the session does next.',
  'check: the onboarding document, docs/origin.md, docs/ROADMAP.md and AGENTS.md against the shape the onboarding',
  'asks for, each finding with the stage it sends the work back to; --plan reads only the roadmap and its ties to the',
  'pre-plan. hash: the sha256 an approval records. template: a skeleton on stdout; --write creates its file instead,',
  'and refuses one that exists.',
].join('\n');

/** Where each template is written, and how it is made from the project's root. */
const TEMPLATES = {
  feature: { file: ONBOARDING_PATH, text: () => featureTemplate() },
  origin: { file: ORIGIN_PATH, text: (root) => originTemplate(path.basename(root)) },
  roadmap: { file: ROADMAP_PATH, text: () => roadmapTemplate() },
};

/** Walks argv token by token: an unknown flag or word is a usage error, never one silently ignored. */
function parseArgs(argv, cwd) {
  const parsed = { cwd, plan: false, write: false, words: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cwd') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) return { error: '--cwd requires a value' };
      parsed.cwd = path.resolve(value);
      index += 1;
    } else if (arg === '--plan') parsed.plan = true;
    else if (arg === '--write') parsed.write = true;
    else if (!arg.startsWith('-')) parsed.words.push(arg);
    else return { error: `unknown argument: ${arg}` };
  }
  const [word, ...rest] = parsed.words;
  // No verb is the stage: what the session does next.
  const verb = word ?? 'stage';
  const flagsOf = { stage: [], check: ['plan'], hash: [], template: ['write'] };
  if (word === 'stage' || !Object.hasOwn(flagsOf, verb)) return { error: `unknown argument: ${word}` };
  for (const flag of ['plan', 'write']) {
    if (parsed[flag] && !flagsOf[verb].includes(flag)) return { error: `--${flag} is not an option of ${word ?? 'onboard with no verb'}` };
  }
  if (verb === 'template') {
    if (rest.length !== 1 || !Object.hasOwn(TEMPLATES, rest[0])) return { error: 'template takes one of feature, origin, roadmap' };
    return { ...parsed, verb, template: rest[0] };
  }
  if (rest.length > 0) return { error: `unknown argument: ${rest[0]}` };
  return { ...parsed, verb };
}

/** The project's root, or `{ error }`: onboard acts only on an initialized project, as the other project commands. */
function projectRoot(cwd) {
  const location = projectLocation(cwd);
  switch (location.kind) {
    case 'initialized':
    case 'noPin':
      return { root: location.root };
    case 'noSuchDirectory':
      return { error: `no such directory: ${cwd}` };
    case 'staleManifest':
      return { error: `a project manifest but no harness.json in ${location.root}: js-harness init sets the project up again` };
    case 'invalidHarnessJson':
      return { error: `cannot read ${location.harnessJsonPath}: ${location.reason}` };
    default:
      return { error: `not an initialized project: ${cwd}; js-harness init sets one up` };
  }
}

/** The text of `root`'s `file`, without a byte order mark, or `null` when it is not there. */
function readOrNull(root, file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8').replace(/^﻿/, '');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function readFiles(root) {
  return {
    onboarding: readOrNull(root, ONBOARDING_PATH),
    origin: readOrNull(root, ORIGIN_PATH),
    roadmap: readOrNull(root, ROADMAP_PATH),
    agents: readOrNull(root, AGENTS_PATH),
  };
}

/** git's output in `root` without its trailing newline, or `null` when it fails. Only the end is trimmed: the first
 * `git status --porcelain` line starts with a space when a file is modified and not staged, and the path is read
 * from a fixed column. */
function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trimEnd() : null;
}

/** The branch a merge lands on: origin's HEAD, else a local `main` or `master`, else git's configured default. */
function defaultBranch(root) {
  const remote = git(root, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  if (remote) return remote.slice(remote.indexOf('/') + 1);
  for (const name of ['main', 'master']) {
    if (git(root, 'rev-parse', '--verify', '--quiet', `refs/heads/${name}`) !== null) return name;
  }
  return git(root, 'config', 'init.defaultBranch') || 'main';
}

/** Whether `ref` holds `file`, committed. */
function holds(root, ref, file) {
  return git(root, 'cat-file', '-e', `${ref}:${file}`) !== null;
}

/** The other branches, local and remote, whose tip holds an onboarding document, each with the worktree it is
 * checked out in (D7). A remote branch with a local one of the same name is the local one. */
function elsewhere(root, branch) {
  const worktrees = new Map();
  let folder = null;
  for (const line of (git(root, 'worktree', 'list', '--porcelain') ?? '').split('\n')) {
    if (line.startsWith('worktree ')) folder = line.slice('worktree '.length);
    else if (line.startsWith('branch refs/heads/')) worktrees.set(line.slice('branch refs/heads/'.length), folder);
  }
  const refs = (git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes') ?? '').split('\n').filter(Boolean);
  const locals = new Set(refs.filter((ref) => ref.startsWith('refs/heads/')).map((ref) => ref.slice('refs/heads/'.length)));
  const holding = refs.filter((ref) => !ref.endsWith('/HEAD') && holds(root, ref, ONBOARDING_PATH));
  const heldLocally = new Set(holding.filter((ref) => ref.startsWith('refs/heads/')).map((ref) => ref.slice('refs/heads/'.length)));
  const found = [];
  for (const ref of holding) {
    if (ref.startsWith('refs/heads/')) {
      const name = ref.slice('refs/heads/'.length);
      if (name !== branch) found.push({ branch: name, worktree: worktrees.get(name) ?? null, remote: false });
      continue;
    }
    // A remote branch is the local one of its name only when that one holds the document too; a local one that
    // does not is where the remote's work is merged.
    const name = ref.slice('refs/remotes/'.length);
    const localName = name.slice(name.indexOf('/') + 1);
    if (heldLocally.has(localName)) continue;
    found.push({ branch: name, worktree: null, remote: true, local: locals.has(localName) ? localName : null });
  }
  return found;
}

/** Where the session is, as stageReport reads it. */
function gitContext(root, files) {
  const branch = git(root, 'symbolic-ref', '--quiet', '--short', 'HEAD');
  const main = defaultBranch(root);
  const defaultHasRoadmap = branch === main ? files.roadmap !== null : [main, `origin/${main}`].some((ref) => holds(root, ref, ROADMAP_PATH));
  const status = git(root, 'status', '--porcelain', '--untracked-files=all', '--', ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_PATH, AGENTS_PATH) ?? '';
  return {
    branch,
    defaultBranch: main,
    defaultHasRoadmap,
    elsewhere: files.onboarding === null ? elsewhere(root, branch) : [],
    uncommitted: status.split('\n').filter(Boolean).map((line) => line.slice(3)),
  };
}

function stage(root, { stdout }) {
  const files = readFiles(root);
  const { code, lines } = stageReport(files, { agentsTemplate: agentsTemplate(root), git: gitContext(root, files) });
  for (const line of lines) stdout(line);
  return code;
}

function check(root, plan, { stdout }) {
  const findings = checkOnboarding(readFiles(root), { agentsTemplate: agentsTemplate(root), plan });
  for (const finding of findings) stdout(findingLine(finding));
  if (findings.length > 0) return 1;
  stdout(`PASS  ${plan ? ROADMAP_PATH : [ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_PATH, AGENTS_PATH].join(', ')}`);
  return 0;
}

function hash(root, { stdout }) {
  for (const [name, value] of Object.entries(hashes(readFiles(root)))) {
    stdout(`${name.padEnd(10)}${value === null ? 'missing' : `sha256:${value}`}`);
  }
  return 0;
}

/** The first directory of `file`'s path under `root` that is a symlink or a junction, or `null`. A file written
 * through one would land outside the project, where neither git nor uninstall can undo it; `wx` guards only the
 * file itself. */
function linkOnTheWay(root, file) {
  const parts = file.split('/').slice(0, -1);
  for (let i = 1; i <= parts.length; i += 1) {
    const relative = parts.slice(0, i).join('/');
    try {
      if (fs.lstatSync(path.join(root, relative)).isSymbolicLink()) return relative;
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
  return null;
}

function template(root, name, write, { stdout, stderr }) {
  const { file, text } = TEMPLATES[name];
  if (!write) {
    stdout(text(root));
    return 0;
  }
  const link = linkOnTheWay(root, file);
  if (link) {
    stderr(`${link} is a link: onboard writes only inside the project, so move it aside or write ${file} by hand`);
    return 1;
  }
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, text(root), { flag: 'wx' });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    stderr(`${file} exists: onboard never writes over a file`);
    return 1;
  }
  stdout(`wrote ${file}`);
  return 0;
}

/** Exit 0, or 1 when the check finds something, a template's file exists or this is no initialized project, or 2 for
 * an argument it does not take. */
export async function onboardMain(argv, env = process.env, { cwd = process.cwd(), stdout = console.log, stderr = console.error } = {}) {
  const args = parseArgs(argv, cwd);
  if (args.error) {
    stderr(`${args.error}\n\n${USAGE}`);
    return 2;
  }
  const { root, error } = projectRoot(args.cwd);
  if (error) {
    stderr(error);
    return 1;
  }
  const io = { stdout, stderr };
  if (args.verb === 'stage') return stage(root, io);
  if (args.verb === 'check') return check(root, args.plan, io);
  if (args.verb === 'hash') return hash(root, io);
  return template(root, args.template, args.write, io);
}

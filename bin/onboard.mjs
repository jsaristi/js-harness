// `onboard`: the pre-plan and the plan of a new project, made by the session the owner talks to — see
// odd/tasks/onboarding.md. `check` holds what the session wrote to the shape the design asks for and never runs a
// command; `hash` prints what an approval records; `template` prints a document's skeleton, and with `--write`
// creates it, never over a file that exists. The rules are bin/lib/onboard.mjs. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENTS_PATH, ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_PATH, STAGES,
  checkOnboarding, featureTemplate, hashes, originTemplate, roadmapTemplate,
} from './lib/onboard.mjs';
import { agentsTemplate, projectLocation } from './lib/project.mjs';

const USAGE = [
  'Usage: js-harness onboard check [--plan] [--cwd <path>]',
  '       js-harness onboard hash [--cwd <path>]',
  '       js-harness onboard template feature|origin|roadmap [--write] [--cwd <path>]',
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
  const [verb, ...rest] = parsed.words;
  const flagsOf = { check: ['plan'], hash: [], template: ['write'] };
  if (!Object.hasOwn(flagsOf, verb)) return { error: verb === undefined ? 'a verb is required' : `unknown argument: ${verb}` };
  for (const flag of ['plan', 'write']) {
    if (parsed[flag] && !flagsOf[verb].includes(flag)) return { error: `--${flag} is not an option of ${verb}` };
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

function check(root, plan, { stdout }) {
  const findings = checkOnboarding(readFiles(root), { agentsTemplate: agentsTemplate(root), plan });
  for (const { file, stage, message } of findings) stdout(`FAIL  ${file}: ${message} (back to stage ${stage}, ${STAGES[stage]})`);
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
  if (args.verb === 'check') return check(root, args.plan, io);
  if (args.verb === 'hash') return hash(root, io);
  return template(root, args.template, args.write, io);
}

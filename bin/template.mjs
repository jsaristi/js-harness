#!/usr/bin/env node
// `template`: the outputs that reach the user again and again, each a template of five parts (odd/tasks/templates.md).
// `new` scaffolds one from the user's `Plantilla:` line, `check` fails on a registered template that lacks a part, and
// `list` prints the registry. Not `contract template` or `summary template`, which print a skeleton a session fills:
// a template here is an output the user sees, made by a command and held by a gate. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { registryOfText, writeRegistry } from './lib/template.mjs';
import { checkTemplates } from './lib/template-check.mjs';
import { FIELDS, firstMissing, scaffold } from './lib/template-scaffold.mjs';
import { decidePage, pageTarget, shownReport } from './lib/template-gate.mjs';
import { RENDERED_SCHEMA, SHOWN_SCHEMA, readRecord, recordShown, renderedFile, shownFile } from './lib/template-record.mjs';
import { TEMPLATES } from './lib/template-registry.mjs';
import { harnessOfTree } from './lib/project-functions.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';
import * as hookEntries from './lib/hook-entries.mjs';

export const USAGE = [
  'Usage: js-harness template new <id> --what <text> --when <text> --sample <file> --where <place> --source <transcript>:<line> [--kind rendered|shape] [--surface page|board|ask|stop|command:<name>]',
  '       js-harness template check | list [--json]',
  '       js-harness template gate --hook | --shown   (the PreToolUse and PostToolUse hooks; the payload on stdin)',
  '       js-harness template shown [--days <n>] [--json]',
].join('\n');

const SHOWN_DAYS = 7;

const REGISTRY = 'bin/lib/template-registry.mjs';

class TemplateArgError extends Error {}

/** The repository's top folder from `cwd`, or `cwd` itself outside a repository. */
function topLevel(cwd) {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  return git.status === 0 ? git.stdout.trim() : cwd;
}

/** The tools the gate's hook entry of this harness watches, as `install` writes it: none until that entry exists
 * (odd/tasks/templates.md, T4). It reads the entry this code declares, not a host's settings; `doctor` says whether a
 * host holds it. */
function installedGateTools() {
  const matcher = hookEntries.templateGateEntry?.().matcher;
  if (typeof matcher !== 'string') return new Set();
  return new Set(matcher.replace(/^\^\(?|\)?\$$/g, '').split('|'));
}

function parseNew(rest) {
  const [id, ...flags] = rest;
  if (id === undefined || id.startsWith('-')) throw new TemplateArgError('template new needs an id first: template new <id> --what ...');
  const known = new Map([...FIELDS.map(({ key, flag }) => [flag, key]), ['--kind', 'kind'], ['--surface', 'surface']]);
  const given = { id };
  for (let i = 0; i < flags.length; i += 1) {
    const key = known.get(flags[i]);
    if (key === undefined) throw new TemplateArgError(`unknown argument: ${flags[i]}`);
    if (Object.hasOwn(given, key)) throw new TemplateArgError(`${flags[i]} was given twice`);
    const value = flags[i + 1];
    if (value === undefined || value.startsWith('--')) throw new TemplateArgError(`${flags[i]} requires a value`);
    given[key] = value;
    i += 1;
  }
  const missing = firstMissing(given);
  if (missing) throw new TemplateArgError(`template new: missing ${missing.flag}: ${missing.ask} (ask the user for this one alone)`);
  return given;
}

function readRegistry(root) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, REGISTRY), 'utf8');
  } catch (err) {
    return { error: `cannot read ${REGISTRY} under ${root}: ${err.message}` };
  }
  const list = registryOfText(text);
  return Array.isArray(list) ? { list } : list;
}

function runNew(given, root, cwd, { stdout, stderr }) {
  const registry = readRegistry(root);
  if (registry.error) return stderr(`template new: ${registry.error}`), 1;
  if (registry.list.some((entry) => entry.id === given.id)) return stderr(`template new: ${given.id} is already registered`), 1;
  let sampleBytes;
  try {
    sampleBytes = fs.readFileSync(path.resolve(cwd, given.sample));
  } catch (err) {
    return stderr(`template new: cannot read the sample ${given.sample}: ${err.message}`), 1;
  }
  const made = scaffold(given, sampleBytes);
  if (made.error) return stderr(`template new: ${made.error}`), 1;
  const there = made.files.filter((file) => fs.existsSync(path.join(root, file.path)));
  if (there.length > 0) return stderr(`template new: ${there.map((file) => file.path).join(', ')} already exist; it writes over nothing`), 1;
  for (const file of made.files) {
    fs.mkdirSync(path.dirname(path.join(root, file.path)), { recursive: true });
    fs.writeFileSync(path.join(root, file.path), file.content);
  }
  fs.writeFileSync(path.join(root, REGISTRY), writeRegistry([...registry.list, made.entry]));
  stdout(`template ${given.id}: a draft, with its five parts to finish:`);
  for (const file of made.files) stdout(`  ${file.path}`);
  stdout(`  ${REGISTRY} (its entry, draft: true; set "render" to its command)`);
  stdout('Write the golden and refusal tests first, then render and admit; template check fails until draft is false.');
  return 0;
}

function runCheck(root, hooked, { stdout, stderr }) {
  const registry = readRegistry(root);
  if (registry.error) return stderr(`template check: ${registry.error}`), 1;
  const readFile = (rel) => {
    try {
      return fs.readFileSync(path.join(root, rel));
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
      throw err;
    }
  };
  const faults = checkTemplates(registry.list, { readFile, hooked });
  if (faults.length === 0) return stdout(`templates: ${registry.list.length} registered, every part present`), 0;
  for (const { id, fault } of faults) stdout(`template ${id}: ${fault}`);
  return 1;
}

function runList(root, json, { stdout, stderr }) {
  const registry = readRegistry(root);
  if (registry.error) return stderr(`template list: ${registry.error}`), 1;
  if (json) return stdout(JSON.stringify(registry.list, null, 2)), 0;
  for (const entry of registry.list) stdout(`${entry.id}\t${entry.kind}\t${entry.surface}\t${entry.draft === false ? 'whole' : 'draft'}\t${entry.plantilla?.what ?? ''}`);
  if (registry.list.length === 0) stdout('no template registered');
  return 0;
}

const spawnRun = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8' });

/** The records of the project a hook payload or a command runs in: `{ top, rendered, shown }`, the files under the
 * harness home. */
function placesOf(folder, { root, home, slug }) {
  const top = root ?? topLevel(folder);
  const where = home ?? harnessHome({});
  const project = slug ?? projectSlug(mainCheckout(spawnRun, folder));
  return { top, rendered: renderedFile(where, project), shown: shownFile(where, project) };
}

/** `template gate --hook`, before a call: decides each page the call shows and records each decision; the hooks
 * contract's deny when one is refused, `{}` otherwise. `--shown`, after a call that succeeded: a `shown` line for each
 * page `--hook` let through in that call. It acts only where `harness.json` holds `"templates": true`, and fails open:
 * a page or a record it cannot read lets the call through, recorded as unchecked and said on standard error. */
function runGate(mode, seams, { stdout, stderr }) {
  let payload;
  try {
    payload = JSON.parse(seams.readStdin());
  } catch {
    return stdout('{}'), 0;
  }
  const tool = payload?.tool_name;
  const target = pageTarget(tool, payload?.tool_input);
  if (target === null) return stdout('{}'), 0;
  const folder = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : seams.cwd;
  const places = placesOf(folder, seams);
  if (harnessOfTree(places.top).declared?.templates !== true) return stdout('{}'), 0;
  const at = new Date(seams.now).toISOString();
  const call = typeof payload.tool_use_id === 'string' ? payload.tool_use_id : null;
  const record = (decision) => {
    try {
      recordShown(places.shown, { at, session: payload.session_id ?? null, tool, call, ...decision });
    } catch (err) {
      stderr(`js-harness template gate: cannot append to ${places.shown}: ${err.message}; the decision stands`);
    }
  };
  if (mode === '--shown') {
    if (call === null) return stdout('{}'), 0;
    let lines;
    try {
      lines = readRecord(places.shown, SHOWN_SCHEMA).filter((line) => line.call === call);
    } catch (err) {
      stderr(`js-harness template gate: cannot read ${places.shown}: ${err.message}; nothing recorded as shown`);
      return stdout('{}'), 0;
    }
    if (!lines.some((line) => line.decision === 'refused')) {
      for (const line of lines.filter((one) => ['admitted', 'free', 'unchecked'].includes(one.decision))) {
        record({ template: line.template, subject: line.subject, decision: 'shown', sha256: line.sha256, reason: line.reason });
      }
    }
    return stdout('{}'), 0;
  }
  let rendered;
  try {
    rendered = readRecord(places.rendered, RENDERED_SCHEMA);
  } catch (err) {
    const reason = `cannot read ${places.rendered}: ${err.message}; the call goes through unchecked`;
    stderr(`js-harness template gate: ${reason}`);
    record({ decision: 'unchecked', reason });
    return stdout('{}'), 0;
  }
  const pages = target.widget !== undefined ? [{ page: { widget: target.widget } }] : target.files.map((file) => {
    try {
      return { page: { text: fs.readFileSync(path.resolve(folder, file), 'utf8') } };
    } catch (err) {
      return { unreadable: `cannot read ${file} (${err.code ?? err.message}); the call goes through unchecked` };
    }
  });
  const refusals = [];
  for (const { page, unreadable } of pages) {
    if (unreadable !== undefined) {
      stderr(`js-harness template gate: ${unreadable}`);
      record({ decision: 'unchecked', reason: unreadable });
      continue;
    }
    const decision = decidePage({ page, rendered, templates: seams.templates, openMoments: seams.openMoments, now: seams.now, renderedPath: places.rendered });
    record(decision);
    if (decision.decision === 'refused') refusals.push(decision.reason);
  }
  if (refusals.length === 0) return stdout('{}'), 0;
  stdout(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: refusals.join('\n') } }));
  return 0;
}

function parseShown(rest) {
  const options = { days: SHOWN_DAYS, json: false };
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--json') options.json = true;
    else if (rest[i] === '--days') {
      const value = rest[i + 1];
      if (value === undefined || !/^[1-9]\d*$/.test(value)) throw new TemplateArgError('--days requires a whole number of days, 1 or more');
      options.days = Number(value);
      i += 1;
    } else throw new TemplateArgError(`unknown argument: ${rest[i]}`);
  }
  return options;
}

/** `template shown`: the escape list of the last `days` days. Exit 0 when it holds, 1 on an escape, 3 when it cannot
 * tell (an unchecked call, or a record it cannot read). */
function runShown({ days, json }, seams, { stdout, stderr }) {
  const places = placesOf(seams.cwd, seams);
  const since = seams.now - days * 24 * 3600 * 1000;
  const recent = (line) => Date.parse(line.at) >= since;
  let rendered;
  let shown;
  try {
    rendered = readRecord(places.rendered, RENDERED_SCHEMA).filter(recent);
    shown = readRecord(places.shown, SHOWN_SCHEMA).filter(recent);
  } catch (err) {
    stderr(`template shown: cannot read a record: ${err.message}`);
    return 3;
  }
  const report = shownReport({ rendered, shown, moments: seams.moments });
  const code = report.escapes.length > 0 ? 1 : report.unchecked > 0 ? 3 : 0;
  if (json) return stdout(JSON.stringify({ days, ...report }, null, 2)), code;
  const calls = (n) => `${n} call${n === 1 ? '' : 's'}`;
  if (code === 0) stdout(`templates: no escapes in ${days} days`);
  else if (code === 1) stdout(`templates: ${report.escapes.length} escape${report.escapes.length === 1 ? '' : 's'} in ${days} days`);
  else stdout(`templates: cannot tell for ${days} days: ${calls(report.unchecked)} unchecked`);
  for (const [id, counts] of Object.entries(report.templates)) {
    stdout(`${id}\t${Object.entries(counts).map(([name, n]) => `${name} ${n}`).join('\t')}`);
  }
  for (const page of report.free) stdout(`free: ${page.reason} (${page.at})`);
  for (const escape of report.escapes) stdout(`escape: ${escape}`);
  if (report.unchecked > 0 && code !== 3) stdout(`${calls(report.unchecked)} unchecked`);
  return code;
}

/** Exit 0 when the subcommand did its work, 1 when it found a fault or could not, 2 for a bad command line; `shown`
 * also exits 3 when it cannot tell, and `gate` always exits 0. `root`, `hooked`, `readStdin`, `home`, `slug`, `now`,
 * `templates`, `openMoments` and `moments` are seams for the tests: until a page template and its moments' record land
 * (odd/tasks/templates.md, slice C), no moment is open and none is held. */
export function templateMain(argv, {
  stdout = console.log, stderr = console.error, cwd = process.cwd(), root, hooked, readStdin = () => fs.readFileSync(0, 'utf8'),
  home, slug, now = Date.now(), templates = TEMPLATES, openMoments = [], moments = [],
} = {}) {
  const io = { stdout, stderr };
  const seams = { cwd, root, readStdin, home, slug, now, templates, openMoments, moments };
  try {
    const [subcommand, ...rest] = argv;
    if (subcommand === undefined) throw new TemplateArgError('a subcommand is required: new, check, list, gate or shown');
    if (subcommand === 'gate') {
      if (rest.length !== 1 || !['--hook', '--shown'].includes(rest[0])) throw new TemplateArgError(rest.length === 0 ? 'template gate needs --hook or --shown' : `unknown argument: ${rest.find((token) => !['--hook', '--shown'].includes(token)) ?? rest[1]}`);
      try {
        return runGate(rest[0], seams, io);
      } catch (err) {
        stderr(`js-harness template gate: ${err.message}; the call goes through unchecked`);
        stdout('{}');
        return 0;
      }
    }
    if (subcommand === 'shown') return runShown(parseShown(rest), seams, io);
    const top = root ?? topLevel(cwd);
    if (subcommand === 'new') return runNew(parseNew(rest), top, cwd, io);
    if (subcommand === 'check') {
      if (rest.length > 0) throw new TemplateArgError(`unknown argument: ${rest[0]}`);
      return runCheck(top, hooked ?? installedGateTools(), io);
    }
    if (subcommand === 'list') {
      const extra = rest.find((token) => token !== '--json');
      if (extra !== undefined) throw new TemplateArgError(`unknown argument: ${extra}`);
      return runList(top, rest.includes('--json'), io);
    }
    throw new TemplateArgError(`unknown argument: ${subcommand}`);
  } catch (err) {
    if (!(err instanceof TemplateArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
}

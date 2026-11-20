// The update round of the whole stack (odd/tasks/closed-app-update.md, S1-S3): the list of the stack's tools as data,
// each with how its installed and newest versions are read, how it moves, whether it needs Claude Desktop closed, its
// check after and its undo; the plan of a round for this machine; and the engine that runs one phase of it, checking
// each step and undoing that step when its check fails. On 2026-11-20 the round took five hours by hand because
// codegraph, Git and node cannot be replaced while the app is open; `prepare` does with the app open what touches
// nothing in use, `switch` the rest with it closed.
// Pure where it can be: `readRound` and `runPhase` take every spawn, fetch and file call as a seam, and `planRound`
// and `renderRound` spawn nothing. The command is bin/stack-round.mjs.
import path from 'node:path';
import { ENGRAM_PLUGIN, PROMPT_EVENT } from './engram-prompt-hook.mjs';

const SEMVER = /(\d+)\.(\d+)\.(\d+)/;
/** The first `x.y.z` of a version text, or `null`. */
export const semverOf = (text) => SEMVER.exec(String(text ?? ''))?.slice(0, 1)[0] ?? null;
const major = (v) => Number(String(v).split('.')[0]);
const newer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

/** The nine npm, npx and corepack shims of the node folder: on this machine they run pnpm (`exec pnpm "$@"`), so a new
 * node folder gets the old folder's copies, never node's own. */
export const SHIMS = ['npm', 'npm.cmd', 'npm.ps1', 'npx', 'npx.cmd', 'npx.ps1', 'corepack', 'corepack.cmd', 'corepack.ps1'];

/** The stack, in the order a phase moves it. `how`: `self` (updates itself, said only), `harness` (`stack upgrade`
 * moves it, recorded for `uninstall machine`), `package` (a global package, by the installer that holds its binary),
 * `folder` (a package of the node folder, read from its package.json), `winget`, `nvm` (node), `report` (said, never
 * moved). `closed`: replacing it while the app is open fails or breaks a session (a native file every session loads,
 * the shell the sessions run on, a process the app keeps alive). */
export const ROUND = [
  { id: 'claude-desktop', how: 'self', note: 'doctor\'s host-update row says when one waits' },
  { id: 'claude-cli', how: 'self', version: ['claude', '--version'], newest: { npm: '@anthropic-ai/claude-code' }, note: 'Claude Code updates itself on start' },
  { id: 'engram', how: 'harness', version: ['engram', 'version'], newest: { github: 'Gentleman-Programming/engram' }, closed: false, tools: ['engram', 'engram-plugin'] },
  { id: 'ctx7', how: 'package', version: ['ctx7', '--version'], newest: { npm: 'ctx7' }, spec: 'ctx7', bin: 'ctx7', closed: false },
  { id: 'typescript', how: 'package', version: ['tsc', '--version'], newest: { npm: 'typescript' }, spec: 'typescript', bin: 'tsc', closed: false },
  { id: 'codex', how: 'package', version: ['codex', '--version'], newest: { npm: '@openai/codex' }, spec: '@openai/codex', bin: 'codex', closed: true },
  { id: 'codegraph', how: 'package', version: ['codegraph', '--version'], newest: { npm: '@colbymchenry/codegraph' }, spec: '@colbymchenry/codegraph', bin: 'codegraph', closed: true },
  { id: 'typescript-language-server', how: 'package', version: ['typescript-language-server', '--version'], newest: { npm: 'typescript-language-server' }, spec: 'typescript-language-server', bin: 'typescript-language-server', closed: true },
  { id: 'npm', how: 'folder', newest: { npm: 'npm' }, spec: 'npm', closed: false },
  { id: 'corepack', how: 'folder', newest: { npm: 'corepack' }, spec: 'corepack', closed: false },
  { id: 'pnpm', how: 'report', version: ['pnpm', '--version'], newest: { npm: 'pnpm' }, note: 'every npm here runs it; the round does not move it yet' },
  { id: 'gh', how: 'winget', version: ['gh', '--version'], newest: { github: 'cli/cli' }, winget: 'GitHub.cli', closed: true },
  { id: 'git', how: 'winget', version: ['git', '--version'], newest: { github: 'git-for-windows/git' }, winget: 'Git.Git', closed: true },
  { id: 'node', how: 'nvm', version: ['node', '--version'], newest: { node: true }, closed: true },
  { id: 'nvm', how: 'report', version: ['nvm', 'version'], newest: { github: 'coreybutler/nvm-windows' }, note: 'a new nvm is a migration, his decision (question 385)' },
];

/** The newest version a source names, or `null`: an npm package's `latest`, a GitHub repository's latest release, or
 * node's newest release in the installed line, with the newest of all as `newerMajor` when it is in another line. */
async function newestOf(source, installed, fetchJson) {
  if (source.npm) return { version: semverOf((await fetchJson(`https://registry.npmjs.org/${source.npm}/latest`))?.version) };
  if (source.github) return { version: semverOf((await fetchJson(`https://api.github.com/repos/${source.github}/releases/latest`))?.tag_name) };
  const releases = (await fetchJson('https://nodejs.org/dist/index.json')) ?? [];
  const all = releases.map((r) => semverOf(r.version)).filter(Boolean);
  const line = installed ? all.filter((v) => major(v) === major(installed)) : [];
  const top = (list) => list.reduce((best, v) => (best === null || newer(v, best) ? v : best), null);
  const overall = top(all);
  return { version: top(line), newerMajor: overall && installed && major(overall) > major(installed) ? overall : null };
}

/** What the round reads of this machine, read-only: `{ nodeDir, nvmRoot, npmCli, tools: [{ id, installed, newest,
 * newerMajor, where, why }] }`. `run(command, args)` is spawnSync's shape, `fetchJson(url)` resolves to the parsed body
 * or throws, `readFile(file)` returns text or throws. A read that fails leaves its field `null` with `why`. */
export async function readRound({ run, fetchJson, readFile, platform = 'win32' }) {
  const say = (words) => {
    const result = run(words[0], words.slice(1));
    return result.status === 0 && !result.error ? String(result.stdout ?? '') : null;
  };
  const whereOf = (bin) => say([platform === 'win32' ? 'where' : 'which', bin])?.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? null;
  const nodeBin = whereOf('node');
  const nodeDir = nodeBin ? path.dirname(nodeBin) : null;
  const nvmRoot = /Root:\s*(.+)$/m.exec(say(['nvm', 'root']) ?? '')?.[1]?.trim() ?? null;
  const tools = [];
  for (const tool of ROUND) {
    if (tool.how === 'self' && !tool.version) {
      tools.push({ id: tool.id, installed: null, newest: null, newerMajor: null, where: null, why: null });
      continue;
    }
    let installed = null;
    let why = null;
    if (tool.how === 'folder') {
      try {
        installed = semverOf(JSON.parse(readFile(path.join(nodeDir ?? '', 'node_modules', tool.spec, 'package.json'))).version);
      } catch {
        why = `not found in the node folder ${nodeDir ?? '(node not found)'}`;
      }
    } else {
      installed = semverOf(say(tool.version));
      if (installed === null) why = `${tool.version.join(' ')} did not answer`;
    }
    let newest = null;
    let newerMajor = null;
    try {
      ({ version: newest, newerMajor = null } = await newestOf(tool.newest, installed, fetchJson));
    } catch (err) {
      why = why ?? `its newest version could not be read: ${err.message}`;
    }
    const where = tool.bin ? whereOf(tool.bin) : tool.how === 'folder' ? nodeDir : null;
    tools.push({ id: tool.id, installed, newest, newerMajor, where, why });
  }
  return { nodeDir, nvmRoot, npmCli: nodeDir ? path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js') : null, tools };
}

const same = (a, b) => typeof a === 'string' && typeof b === 'string' && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** The installer of a package whose binary is in `where`: the real npm into the node folder (the folder's npm is a
 * pnpm wrapper), or pnpm's global; `null` for a folder the round does not know. */
function installer(where, read) {
  if (where && read.nodeDir && same(path.dirname(where), read.nodeDir)) {
    return (spec, version) => ['node', read.npmCli, 'i', '-g', '--prefix', read.nodeDir, `${spec}@${version}`];
  }
  if (where && /[\\/]pnpm[\\/]/i.test(where)) return (spec, version) => ['pnpm', 'add', '-g', `${spec}@${version}`];
  return null;
}

/** The steps of node's move from `from` to `to` in its line: prepare installs it beside the live one, its globals with
 * that folder's own npm, the old folder's shims, and compares the two folders; switch is `nvm use`, undone by `nvm use
 * <from>`. `packages` are the old folder's global packages, each `{ spec, version }` at the version it gets. */
export function nodeSteps({ from, to, nvmRoot, nodeDir, packages }) {
  const folder = path.join(nvmRoot, `v${to}`);
  const npmCli = path.join(folder, 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const prepare = [
    { tool: 'node', what: `install node ${to} beside ${from}`, kind: 'run', words: ['nvm', 'install', to], check: { exists: path.join(folder, 'node.exe') }, undo: ['nvm', 'uninstall', to] },
    ...packages.map(({ spec, version }) => ({
      tool: 'node', what: `install ${spec}@${version} into node ${to}'s folder`, kind: 'run',
      words: [path.join(folder, 'node.exe'), npmCli, 'i', '-g', '--prefix', folder, `${spec}@${version}`],
      check: { packageVersion: path.join(folder, 'node_modules', spec, 'package.json'), expect: version }, undo: null, wayBack: `nvm uninstall ${to} removes the whole new folder`,
    })),
    { tool: 'node', what: `copy the ${SHIMS.length} npm, npx and corepack shims of ${nodeDir}`, kind: 'copy', from: nvmRoot && path.join(nvmRoot, `v${from}`), to: folder, files: SHIMS, check: { sameFiles: SHIMS }, undo: null, wayBack: `nvm uninstall ${to} removes the whole new folder` },
    { tool: 'node', what: `compare the folders of node ${from} and ${to}`, kind: 'compare', from: path.join(nvmRoot, `v${from}`), to: folder, check: null, undo: null },
  ];
  const swap = { tool: 'node', what: `switch the active node from ${from} to ${to}`, kind: 'run', elevate: true, words: ['nvm', 'use', to], check: { words: ['node', '--version'], expect: to }, undo: ['nvm', 'use', from] };
  return { prepare, switch: [swap] };
}

/** The round's plan for what `readRound` read: `{ rows, prepare, switch }`. Each row is `{ tool, from, to, move, why }`,
 * `move` one of `current`, `prepare`, `switch`, `self`, `report`, `unknown`; `prepare` and `switch` are the steps of
 * each phase, in order, each `{ tool, what, kind, words, check, undo, wayBack?, elevate? }`. `folderPackages`, the
 * node folder's packages with their newest versions, go into a new node folder when node moves. `home`, when the
 * round was given one, is passed to the steps that act on a home. */
export function planRound(read, { harness, home = null }) {
  const rows = [];
  const prepare = [];
  const swap = [];
  const byId = new Map(read.tools.map((t) => [t.id, t]));
  const node = byId.get('node');
  const nodeMoves = node?.installed && node?.newest && newer(node.newest, node.installed) && read.nvmRoot;
  const inNodeFolder = (t) => t.how === 'folder' || (t.where && read.nodeDir && same(path.dirname(t.where), read.nodeDir));
  for (const tool of ROUND) {
    const got = byId.get(tool.id);
    const from = got?.installed ?? null;
    const to = got?.newest ?? null;
    const row = (move, why = null) => rows.push({ tool: tool.id, from, to, move, why });
    if (tool.how === 'self') {
      row('self', tool.note);
      continue;
    }
    if (from === null || to === null) {
      row('unknown', got?.why ?? 'not read');
      continue;
    }
    if (!newer(to, from)) {
      row('current', got.newerMajor ? `node ${got.newerMajor} is out in a new line: a migration, his decision (question 385)` : null);
      continue;
    }
    if (tool.how === 'report') {
      row('report', tool.note);
      continue;
    }
    const check = tool.version ? { words: tool.version, expect: to } : { packageVersion: path.join(read.nodeDir ?? '', 'node_modules', tool.spec, 'package.json'), expect: to };
    if (tool.how === 'harness') {
      const words = [...harness, 'stack', 'upgrade', ...tool.tools.flatMap((t) => ['--tool', t]), '--yes'];
      prepare.push({ tool: tool.id, what: `update ${tool.tools.join(' and ')} through stack upgrade`, kind: 'run', words, check, undo: null, wayBack: 'js-harness uninstall machine takes it back: stack upgrade records it' });
      // A plugin update writes a new hooks file with the prompt hook D8 took out (his answer to question 221): on
      // 2026-11-20 the plugin's 0.1.23 brought it back and the hook entries row of check refused every commit.
      prepare.push({ tool: tool.id, what: 'take the engram plugin\'s prompt hook out again (stack engram-prompt off, D8)', kind: 'run', words: [...harness, 'stack', 'engram-prompt', 'off', ...(home ? ['--home', home] : [])], check: { hookEntries: { owner: ENGRAM_PLUGIN, event: PROMPT_EVENT }, expect: 0 }, undo: null, wayBack: 'js-harness stack engram-prompt on puts the hook back' });
      row('prepare');
      continue;
    }
    if (tool.how === 'nvm') {
      const packages = read.tools.filter((t) => ROUND.find((r) => r.id === t.id)?.spec && inNodeFolder({ ...t, how: ROUND.find((r) => r.id === t.id).how }))
        .map((t) => ({ spec: ROUND.find((r) => r.id === t.id).spec, version: t.newest ?? t.installed })).filter((p) => p.version);
      const steps = nodeSteps({ from, to, nvmRoot: read.nvmRoot, nodeDir: read.nodeDir, packages });
      if (!nodeMoves) {
        row('unknown', 'nvm root not read');
        continue;
      }
      prepare.push(...steps.prepare);
      swap.push(...steps.switch);
      row('switch', `prepared beside ${from}, switched by nvm use`);
      continue;
    }
    if (tool.how === 'winget') {
      swap.push({ tool: tool.id, what: `upgrade ${tool.winget} to ${to}`, kind: 'run', elevate: true, words: ['winget', 'upgrade', '--id', tool.winget, '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements'], check, undo: null, wayBack: `winget install --id ${tool.winget} --exact --version ${from} --force` });
      row('switch');
      continue;
    }
    // A package, or a package of the node folder: when node moves it goes into the new folder with it.
    if (nodeMoves && inNodeFolder({ ...got, how: tool.how })) {
      row('prepare', `goes into node ${node.newest}'s folder`);
      continue;
    }
    const install = tool.how === 'folder' ? installer(path.join(read.nodeDir ?? '', 'x'), read) : installer(got.where, read);
    if (install === null) {
      row('report', `installed in ${got.where ?? 'an unknown folder'}, which the round does not know how to update`);
      continue;
    }
    const step = { tool: tool.id, what: `update ${tool.spec} to ${to}`, kind: 'run', words: install(tool.spec, to), check, undo: install(tool.spec, from) };
    (tool.closed ? swap : prepare).push(step);
    row(tool.closed ? 'switch' : 'prepare');
  }
  // Node goes last: every other step of the switch runs on the node it was planned with.
  swap.sort((a, b) => (a.tool === 'node') - (b.tool === 'node'));
  return { rows, prepare, switch: swap };
}

const MOVE = {
  current: 'current',
  prepare: 'prepare (app open)',
  switch: 'switch (app closed)',
  self: 'updates itself',
  report: 'report only',
  unknown: 'unknown',
};

/** The plan as one line a tool, then the steps of each phase. */
export function renderRound(plan) {
  const lines = plan.rows.map((r) => `${r.tool.padEnd(27)} ${String(r.from ?? '-').padEnd(9)} -> ${String(r.to ?? '-').padEnd(9)} ${MOVE[r.move]}${r.why ? `: ${r.why}` : ''}`);
  for (const phase of ['prepare', 'switch']) {
    lines.push(`${phase}: ${plan[phase].length === 0 ? 'nothing' : `${plan[phase].length} step${plan[phase].length === 1 ? '' : 's'}`}`);
    for (const step of plan[phase]) lines.push(`  - ${step.what}${step.undo ? `; undo: ${step.undo.join(' ')}` : step.wayBack ? `; way back: ${step.wayBack}` : ''}`);
  }
  return lines;
}

/** Whether a step's check holds now, and what it saw. */
function checked(step, { run, readFile, exists, hookEntries }) {
  const c = step.check;
  if (!c) return { ok: true, saw: 'no check' };
  if (c.words) {
    const said = run(c.words[0], c.words.slice(1));
    const saw = semverOf(said.stdout);
    return { ok: saw === c.expect, saw: saw ?? `exit ${said.status}` };
  }
  if (c.exists) return { ok: exists(c.exists), saw: exists(c.exists) ? 'there' : 'missing' };
  if (c.hookEntries) {
    if (!hookEntries) return { ok: false, saw: 'the hook entries could not be counted' };
    const n = hookEntries(c.hookEntries.owner, c.hookEntries.event);
    return { ok: n === c.expect, saw: `${n} ${n === 1 ? 'entry' : 'entries'}` };
  }
  if (c.packageVersion) {
    let saw = null;
    try {
      saw = semverOf(JSON.parse(readFile(c.packageVersion)).version);
    } catch {
      saw = 'missing';
    }
    return { ok: saw === c.expect, saw };
  }
  if (c.sameFiles) {
    const missing = c.sameFiles.filter((file) => !exists(path.join(step.to, file)));
    return { ok: missing.length === 0, saw: missing.length === 0 ? 'all there' : `missing ${missing.join(', ')}` };
  }
  return { ok: false, saw: 'a check this engine does not know' };
}

/** Runs `steps` in order: each one, then its check; a check that fails runs that step's undo, checks nothing more and
 * stops, so what ran before it stays and is reported. Returns `{ ok, steps: [{ tool, what, outcome, saw }] }`,
 * `outcome` one of `done`, `undone`, `failed` (no undo, or the undo failed), `not run`. `io` holds the seams: `run`,
 * `readFile`, `exists`, `copy(from, to)`, `list(dir)`, `log(line)` and `hookEntries(owner, event)`, the count of the
 * hook entries Claude Code runs for that owner and event (./hook-count.mjs). A `compare` step fails on a name the old folder
 * has and the new one lacks, at its root or in `node_modules`. */
export function runPhase(steps, io) {
  const out = [];
  for (const [i, step] of steps.entries()) {
    io.log(`step ${i + 1}/${steps.length}: ${step.what}`);
    let failed = null;
    if (step.kind === 'run') {
      const result = io.run(step.words[0], step.words.slice(1));
      if (result.error || result.status !== 0) failed = `${step.words.join(' ')} exited ${result.error ? result.error.message : result.status}`;
    } else if (step.kind === 'copy') {
      try {
        for (const file of step.files) io.copy(path.join(step.from, file), path.join(step.to, file));
      } catch (err) {
        failed = `copy: ${err.message}`;
      }
    } else if (step.kind === 'compare') {
      const missing = ['', 'node_modules'].flatMap((sub) => {
        const have = new Set(io.list(path.join(step.to, sub)));
        return io.list(path.join(step.from, sub)).filter((name) => !have.has(name)).map((name) => path.join(sub, name));
      });
      if (missing.length > 0) failed = `the new folder lacks ${missing.join(', ')}`;
    }
    const check = failed === null ? checked(step, io) : { ok: false, saw: failed };
    if (check.ok) {
      out.push({ tool: step.tool, what: step.what, outcome: 'done', saw: check.saw });
      continue;
    }
    io.log(`  check failed: ${check.saw}`);
    let outcome = 'failed';
    if (step.undo) {
      const undo = io.run(step.undo[0], step.undo.slice(1));
      outcome = !undo.error && undo.status === 0 ? 'undone' : 'failed';
      io.log(`  undo ${step.undo.join(' ')}: ${outcome === 'undone' ? 'ran' : 'failed too'}`);
    } else if (step.wayBack) {
      io.log(`  no undo can run; way back: ${step.wayBack}`);
    }
    out.push({ tool: step.tool, what: step.what, outcome, saw: check.saw });
    for (const rest of steps.slice(i + 1)) out.push({ tool: rest.tool, what: rest.what, outcome: 'not run', saw: null });
    return { ok: false, steps: out };
  }
  return { ok: true, steps: out };
}

/** Where a round keeps its plan, its record and its logs, under the harness home. */
export const roundDir = (home) => path.join(home, '.js-harness', 'update-round');

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

/** The commands corepack's package.json links (`bin`). `npm i -g corepack` writes a shim of each into the node folder,
 * and C:\nvm4w\nodejs comes before pnpm\bin in PATH, so they would run corepack's pnpm instead of the real one: the
 * verifier of PR 940 found the round recreating that trap (B1, 2026-11-20). The compare removes the ones the old
 * folder lacks. */
export const SHADOWS = ['pnpm', 'pnpx', 'yarn', 'yarnpkg'];
const shimBase = (name) => name.replace(/\.(cmd|ps1)$/i, '').toLowerCase();

/** How long one step may run before the round stops waiting for it. A timeout kills only the shell, so the step is
 * recorded `timed out`, no undo runs beside a process that may still run, and its way back is named. */
export const STEP_TIMEOUT_MS = 30 * 60_000;

/** How old a prepared plan may be when the switch runs it: the versions it names move, and so does the machine. */
export const PLAN_MAX_AGE_MS = 2 * 24 * 60 * 60_000;

/** The stack, in the order a phase moves it. `how`: `self` (updates itself, said only), `harness` (`stack upgrade`
 * moves it, recorded for `uninstall machine`), `package` (a global package, by the installer that holds its binary),
 * `folder` (a package of the node folder, read from its package.json; it moves only into a new node folder and is
 * reported while node stays), `winget`, `nvm` (node), `report` (said, never moved). `closed`: replacing it while the app is open fails or breaks a session (a native file every session loads,
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
  const harnessVersion = semverOf(say(['js-harness', '--version']));
  return { nodeDir, nvmRoot, npmCli: nodeDir ? path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js') : null, harnessVersion, tools };
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
 * <from>`, checked by node's version. `packages` are the old folder's global packages, each `{ spec, version, words? }`
 * at the version it gets, `words` the command that prints it. After `nvm use` the switch checks node, each package
 * that prints its version, js-harness (`harnessVersion`, what it answered when the plan was made; not asked when it
 * did not answer then) and that the first pnpm on PATH is not in the node folder; any of them failing runs `nvm use <from>`.
 * `pre` is what must still hold when the switch begins: the active node is `from` and the new folder is there. */
export function nodeSteps({ from, to, nvmRoot, nodeDir, packages, harnessVersion = null }) {
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
  const check = {
    all: [
      { words: ['node', '--version'], expect: to },
      ...packages.filter((p) => p.words).map((p) => ({ words: p.words, expect: p.version })),
      // Asked only of a js-harness that answered when the plan was made: one off PATH then would fail every switch.
      ...(harnessVersion ? [{ words: ['js-harness', '--version'], expect: harnessVersion }] : []),
      { words: ['where', 'pnpm'], notIn: nodeDir },
    ],
  };
  const swap = {
    tool: 'node', what: `switch the active node from ${from} to ${to}`, kind: 'run', elevate: true, words: ['nvm', 'use', to], check,
    dropped: harnessVersion ? [] : ['js-harness --version, which did not answer when the plan was made'],
    undo: ['nvm', 'use', from], undoCheck: { words: ['node', '--version'], expect: from },
    pre: [{ words: ['node', '--version'], expect: from }, { exists: path.join(folder, 'node.exe') }],
  };
  return { prepare, switch: [swap] };
}

/** The round's plan for what `readRound` read: `{ rows, prepare, switch }`. Each row is `{ tool, from, to, move, why }`,
 * `move` one of `current`, `prepare`, `switch`, `self`, `report`, `unknown`; `prepare` and `switch` are the steps of
 * each phase, in order, each `{ tool, what, kind, words, check, undo, wayBack?, elevate? }`. `folderPackages`, the
 * node folder's packages with their newest versions, go into a new node folder when node moves. `home`, when the
 * round was given one, is passed to the steps that act on a home. */
export function planRound(read, { harness, home = null, harnessVersion = read.harnessVersion ?? null }) {
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
    // npm and corepack are never installed into the live node folder: corepack writes pnpm, pnpx, yarn and yarnpkg
    // shims ahead of pnpm\bin, npm writes its own npm and npx over the copies that run pnpm, and with no second folder
    // there is nothing to compare against or restore from (verify-pr940-2 B1). They move into a new folder with node.
    if (tool.how === 'folder' && !nodeMoves) {
      row('report', `it lives in the node folder ${read.nodeDir ?? '(not found)'}, so it updates only in a round where node moves`);
      continue;
    }
    const check = { words: tool.version, expect: to };
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
        .map((t) => {
          const entry = ROUND.find((r) => r.id === t.id);
          return { spec: entry.spec, version: t.newest ?? t.installed, ...(entry.version ? { words: entry.version } : {}) };
        }).filter((p) => p.version);
      if (!nodeMoves) {
        row('unknown', 'nvm root not read');
        continue;
      }
      const steps = nodeSteps({ from, to, nvmRoot: read.nvmRoot, nodeDir: read.nodeDir, packages, harnessVersion });
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
    const install = installer(got.where, read);
    if (install === null) {
      row('report', `installed in ${got.where ?? 'an unknown folder'}, which the round does not know how to update`);
      continue;
    }
    const step = { tool: tool.id, what: `update ${tool.spec} to ${to}`, kind: 'run', words: install(tool.spec, to), check, undo: install(tool.spec, from), undoCheck: { ...check, expect: from } };
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
    for (const step of plan[phase]) {
      lines.push(`  - ${step.what}${step.undo ? `; undo: ${step.undo.join(' ')}` : step.wayBack ? `; way back: ${step.wayBack}` : ''}`);
      // A check the switch leaves out is said, so a drop is never silent (verify-pr940-2).
      if (step.dropped?.length > 0) lines.push(`    not checked after the switch: ${step.dropped.join('; ')}`);
    }
  }
  return lines;
}

/** Whether the check `c` holds now, and what it saw: `words` with `expect` (the version it prints), without
 * `expect` (it answers, exit 0), or with `notIn` (the first path it prints is not in that folder); `exists`;
 * `hookEntries`; `packageVersion`; `sameFiles` (in `step.to`); `all`, each of a list, the first that fails named. */
export function checkHolds(c, io, step = {}) {
  if (!c) return { ok: true, saw: 'no check' };
  if (c.all) {
    for (const part of c.all) {
      const got = checkHolds(part, io, step);
      if (!got.ok) return { ok: false, saw: `${part.words?.join(' ') ?? 'a check'} says ${got.saw}` };
    }
    return { ok: true, saw: `${c.all.length} checks hold` };
  }
  if (c.words) {
    const said = io.run(c.words[0], c.words.slice(1));
    if (c.notIn) {
      const first = said.status === 0 && !said.error ? String(said.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) : undefined;
      return { ok: first !== undefined && !same(path.dirname(first), c.notIn), saw: first ?? 'nothing found' };
    }
    if (c.expect === undefined) return { ok: !said.error && said.status === 0, saw: `exit ${said.error ? said.error.message : said.status}` };
    const saw = semverOf(said.stdout);
    return { ok: saw === c.expect, saw: saw ?? `exit ${said.status}` };
  }
  if (c.exists) return { ok: io.exists(c.exists), saw: io.exists(c.exists) ? 'there' : 'missing' };
  if (c.hookEntries) {
    if (!io.hookEntries) return { ok: false, saw: 'the hook entries could not be counted' };
    const n = io.hookEntries(c.hookEntries.owner, c.hookEntries.event);
    return { ok: n === c.expect, saw: `${n} ${n === 1 ? 'entry' : 'entries'}` };
  }
  if (c.packageVersion) {
    let saw = null;
    try {
      saw = semverOf(JSON.parse(io.readFile(c.packageVersion)).version);
    } catch {
      saw = 'missing';
    }
    return { ok: saw === c.expect, saw };
  }
  if (c.sameFiles) {
    const missing = c.sameFiles.filter((file) => !io.exists(path.join(step.to, file)));
    return { ok: missing.length === 0, saw: missing.length === 0 ? 'all there' : `missing ${missing.join(', ')}` };
  }
  return { ok: false, saw: 'a check this engine does not know' };
}

/** The compare of node's two folders, both ways and whatever the case, at their root and in `node_modules`: a name
 * the old folder has and the new one lacks fails it; a name the new one has and the old one lacks is removed when it
 * is a corepack shim (`SHADOWS`, at the root) and fails it otherwise, since the round does not know what it runs. */
function compareFolders(step, io) {
  const key = (name) => name.toLowerCase();
  const missing = [];
  const extra = [];
  const removed = [];
  for (const sub of ['', 'node_modules']) {
    const before = io.list(path.join(step.from, sub));
    const after = io.list(path.join(step.to, sub));
    const had = new Set(before.map(key));
    const has = new Set(after.map(key));
    missing.push(...before.filter((name) => !has.has(key(name))).map((name) => path.join(sub, name)));
    for (const name of after.filter((n) => !had.has(key(n)))) {
      const file = path.join(step.to, sub, name);
      if (sub === '' && SHADOWS.includes(shimBase(name))) {
        io.remove(file);
        if (!io.exists(file)) {
          removed.push(name);
          continue;
        }
      }
      extra.push(path.join(sub, name));
    }
  }
  const wrong = [
    ...(missing.length > 0 ? [`the new folder lacks ${missing.join(', ')}`] : []),
    ...(extra.length > 0 ? [`the new folder has ${extra.join(', ')}, which the old folder lacks`] : []),
  ];
  if (wrong.length > 0) return { ok: false, saw: wrong.join('; ') };
  return { ok: true, saw: removed.length > 0 ? `removed corepack's ${removed.join(', ')}, which would shadow pnpm` : 'the same names' };
}

/** Runs `steps` in order: each one, then its check; a check that fails runs that step's undo, then the undo's own
 * check (`undoCheck`), checks nothing more and stops, so what ran before it stays and is reported. Returns `{ ok,
 * steps: [{ tool, what, outcome, saw }] }`, `outcome` one of `done`, `undone` (the undo ran and its check holds),
 * `failed` (no undo, or the undo or its check failed), `timed out` (no undo runs beside it), `not run`. An exception
 * in a step, its check or its undo is that step failing, never thrown. `io` holds the seams: `run`, `readFile`,
 * `exists`, `copy(from, to)`, `list(dir)`, `remove(file)`, `log(line)`, `hookEntries(owner, event)`, the count of the
 * hook entries Claude Code runs for that owner and event (./hook-count.mjs), and `onStep(done, running)`, told before
 * each step with the outcomes so far and the step about to run, and once at the end with `running` null. */
export function runPhase(steps, io) {
  const out = [];
  const tell = (running) => io.onStep?.(out.slice(), running);
  const stop = (i) => {
    for (const rest of steps.slice(i + 1)) out.push({ tool: rest.tool, what: rest.what, outcome: 'not run', saw: null });
    tell(null);
    return { ok: false, steps: out };
  };
  for (const [i, step] of steps.entries()) {
    io.log(`step ${i + 1}/${steps.length}: ${step.what}`);
    tell(step.what);
    let check;
    let timedOut = false;
    try {
      if (step.kind === 'run') {
        const result = io.run(step.words[0], step.words.slice(1), { step: true });
        timedOut = result.error?.code === 'ETIMEDOUT';
        if (timedOut) check = { ok: false, saw: `${step.words.join(' ')} timed out; its process may still run` };
        else if (result.error || result.status !== 0) check = { ok: false, saw: `${step.words.join(' ')} exited ${result.error ? result.error.message : result.status}` };
      } else if (step.kind === 'copy') {
        for (const file of step.files) io.copy(path.join(step.from, file), path.join(step.to, file));
      } else if (step.kind === 'compare') {
        check = compareFolders(step, io);
      }
      check = check ?? checkHolds(step.check, io, step);
    } catch (err) {
      check = { ok: false, saw: `threw: ${err.message}` };
    }
    if (check.ok) {
      io.log(`  checked: ${check.saw}`);
      out.push({ tool: step.tool, what: step.what, outcome: 'done', saw: check.saw });
      continue;
    }
    io.log(`  check failed: ${check.saw}`);
    let outcome = 'failed';
    if (timedOut) {
      outcome = 'timed out';
      io.log(`  no undo runs beside a process that may still run${step.wayBack ? `; way back: ${step.wayBack}` : step.undo ? `; once it ends: ${step.undo.join(' ')}` : ''}`);
    } else if (step.undo) {
      try {
        const undo = io.run(step.undo[0], step.undo.slice(1), { step: true });
        if (undo.error || undo.status !== 0) io.log(`  undo ${step.undo.join(' ')}: failed too`);
        else {
          const again = checkHolds(step.undoCheck, io, step);
          outcome = again.ok ? 'undone' : 'failed';
          io.log(`  undo ${step.undo.join(' ')}: ${again.ok ? 'ran and checked' : `ran, but ${step.undoCheck.words?.join(' ') ?? 'its check'} says ${again.saw}`}`);
        }
      } catch (err) {
        io.log(`  undo ${step.undo.join(' ')}: threw: ${err.message}`);
      }
    } else if (step.wayBack) {
      io.log(`  no undo can run; way back: ${step.wayBack}`);
    }
    out.push({ tool: step.tool, what: step.what, outcome, saw: check.saw });
    return stop(i);
  }
  tell(null);
  return { ok: true, steps: out };
}

/** Where a round keeps its plan, its record and its logs, under the harness home. */
export const roundDir = (home) => path.join(home, '.js-harness', 'update-round');

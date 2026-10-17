// The `js-harness` row of `doctor`: letter F's "a hash of the rules is stamped in the installed command, so that
// `doctor` can say it is behind" (odd/tasks/rule-hierarchy.md, "Reach: the hash of the installed command (T16f,
// second part)"). The stamp is the copy's own list, hashed over its unscoped rules; it is compared with the same hash
// of the default branch's list, read fresh every time and never cached, so that a failed read is `unknown` and never
// an old hash in force.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { RULES } from './rules-data.mjs';
import { readRules, shippedRulesHash, unscoped } from './rules.mjs';
import { diffRules, HARNESS_LIST, listOf, MAIN_REFS, readListText } from './rules-reach.mjs';
import { DEFAULT_REPO, INSTALL_NEWEST } from './version.mjs';

// The same bound as every other lookup of `doctor` (bin/lib/latest.mjs).
const TIMEOUT_MS = 5000;
// The kinds of difference, in the order the fix names them.
const KINDS = ['added', 'removed', 'retired', 'changed'];

/** The address of `repo`'s default branch's list, for a GitHub repository; `null` for any other. */
function rawListUrl(repo) {
  const match = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(repo);
  return match ? `https://raw.githubusercontent.com/${match[1]}/${match[2]}/HEAD/${HARNESS_LIST}` : null;
}

/** Where a copy outside the harness's own checkout reads the default branch's list: one home, `DEFAULT_REPO`. */
export const MAIN_LIST_URL = rawListUrl(DEFAULT_REPO);

/** `text` as a list of rules, or `null` when it is not one: read as JSON, never imported, and held to `readRules`,
 * so that an error page, a cut body or a list of something else is never compared. */
function listFrom(text) {
  const read = readListText(text, 'harness');
  if (read.rules === undefined) return null;
  return readRules(read.rules, { declared: read.rules }).length === 0 ? read.rules : null;
}

/** The default branch's list in the harness's own checkout at `top`, read with git from the first main ref there,
 * as `{ rules, mainRef }`, or `null`. */
function listOnMainRef(top, spawn) {
  const git = (args) => spawn('git', args, { cwd: top, encoding: 'utf8', windowsHide: true });
  const refs = git(['for-each-ref', '--format=%(refname) %(objectname)', ...MAIN_REFS.map(([, full]) => full)]);
  if (refs?.status !== 0) return null;
  const present = new Set(String(refs.stdout).split('\n').map((line) => line.trim().split(' ')[0]));
  const [mainRef] = MAIN_REFS.find(([, full]) => present.has(full)) ?? [];
  if (mainRef === undefined) return null;
  const shown = git(['show', `${mainRef}:${HARNESS_LIST}`]);
  const rules = shown?.status === 0 ? listFrom(String(shown.stdout)) : null;
  return rules === null ? null : { rules, mainRef };
}

/** The default branch's list from GitHub, or `null` on any failure. */
async function listOnGithub(fetchImpl) {
  try {
    const res = await fetchImpl(MAIN_LIST_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return listFrom(await res.text());
  } catch {
    return null;
  }
}

/** The ids of each kind of difference between the copy's unscoped rules and main's. */
function differsOf(copy, main) {
  const diff = diffRules(unscoped(copy), unscoped(main));
  return Object.fromEntries(KINDS.map((kind) => [kind, diff[kind].map((rule) => rule.id)]));
}

/** The version of this copy, from its own `package.json`, as `js-harness --version` prints it. */
function copyVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

/** The row. `project` is the git top `doctor` runs in, `declared` its `harness.json`, `online` true only for an
 * interactive `doctor` that may use the network: the hook, `--offline` and the TUI's stack block make no request.
 * In the harness's own checkout main's list is read with git, offline too. Outside it, a project that pins another
 * version than the copy's, or a `JS_HARNESS_REPO` naming another repository, has nothing to compare with here: `n/a`.
 * A pin of the copy's own version is compared: `init` writes one in every project, and before 1.0.0 every copy is the
 * same version, taken from main. */
export async function harnessRulesRow({ project, declared, env = {}, online, spawn = spawnSync, fetch: fetchImpl = fetch, copy = RULES, version = copyVersion() }) {
  const rulesHash = shippedRulesHash(copy);
  const row = (upToDate, main = null, extra = {}) => ({
    id: 'js-harness',
    version: rulesHash.slice(0, 8),
    installed: 'ok',
    claude: 'n/a',
    codex: 'n/a',
    project: 'n/a',
    upToDate,
    fix: {},
    rulesHash,
    mainRulesHash: main === null ? null : shippedRulesHash(main),
    ...extra,
  });

  let main;
  let extra = {};
  if (project && listOf(project)?.kind === 'harness') {
    const read = listOnMainRef(project, spawn);
    if (read === null) return row('unknown');
    main = read.rules;
    extra = { mainRef: read.mainRef };
  } else {
    const repo = env.JS_HARNESS_REPO;
    const pinnedElsewhere = typeof declared?.version === 'string' && declared.version !== version;
    if (pinnedElsewhere || (repo !== undefined && repo !== DEFAULT_REPO)) return row('n/a');
    if (!online) return row('n/a');
    main = await listOnGithub(fetchImpl);
    if (main === null) return row('unknown');
  }

  const differs = differsOf(copy, main);
  if (shippedRulesHash(main) === rulesHash) return row('ok', main, { ...extra, differs });
  const named = KINDS.filter((kind) => differs[kind].length > 0).map((kind) => `${kind} ${differs[kind].join(', ')}`);
  const fix = {
    upToDate: [
      `the installed copy's unscoped rules differ from main's: install the newest copy (${INSTALL_NEWEST})`,
      `unscoped rules on main that differ: ${named.join('; ') || 'none named by id'}`,
    ],
  };
  return { ...row('outdated', main, { ...extra, differs }), fix };
}

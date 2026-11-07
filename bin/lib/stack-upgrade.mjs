// The plan of the stack upgrade (odd/tasks/stack-upgrade.md, S1): which tools of the stack the harness installs or
// prescribes are behind their latest release, and how each is brought up to it, with its undo. Pure: it reads the
// rows `probeStack` probed and the latest versions doctor resolved, and spawns nothing. The engram binary comes from
// its GitHub release (bin/lib/engram-release.mjs runs it), its plugin by doctor's two commands, codegraph and the
// Codex CLI by the package manager, as `stack install` installs them. context7 is hosted: nothing to update.
import { installPlan, compareSemver } from './version.mjs';
import { prefixBinOf, RUNNABLE } from './stack-install.mjs';

const ENGRAM_REPO = 'https://github.com/Gentleman-Programming/engram';
const OS = { win32: 'windows', linux: 'linux', darwin: 'darwin' };
const ARCH = { x64: 'amd64', arm64: 'arm64' };
const SEMVER = /^\d+\.\d+\.\d+$/;

/** The plugin's two commands, as doctor's `upToDate` fix names them (bin/lib/stack.mjs): the catalog first. */
const PLUGIN_UPDATE = [['claude', 'plugin', 'marketplace', 'update', 'engram'], ['claude', 'plugin', 'update', 'engram@engram']];

/** The archive engram's release `version` ships for `platform` and `arch`, or `null` when it ships none. */
export function engramAsset(version, platform, arch) {
  const os = OS[platform];
  const cpu = ARCH[arch];
  if (!os || !cpu) return null;
  return `engram_${version}_${os}_${cpu}.${platform === 'win32' ? 'zip' : 'tar.gz'}`;
}

/** The global install of `spec` pinned at `version` as words for `pm`, and the variables it is given. */
function pinned(pm, spec, version, platform, prefix) {
  const { args, env } = installPlan(pm.kind, `${spec}@${version}`, prefix, {}, platform);
  return { words: [...pm.words, ...args], env: prefix && pm.kind !== 'pnpm' ? { ...env, PATH: prefixBinOf(pm.kind, prefix, platform) } : env };
}

/** The plan, as `{ updates, current, unknown, held }`:
 *  - `updates`, in the order they run: the engram binary (`kind: 'binary'`, its release asset), the engram plugin
 *    (`kind: 'plugin'`: `run` is a list of commands, `undo` `null` since Claude Code installs no earlier version),
 *    then codegraph and codex (`kind: 'package'`: `run` and `undo` words, `env`). Each has `from` and `to`; the
 *    plugin's `to` is `null` when it follows a binary not yet updated, since its latest is what that release ships.
 *  - `current`: `{ tool, version }` of each installed tool at its latest, context7 as `hosted`.
 *  - `unknown`: `{ tool, why }` of each installed tool whose latest version is not known.
 *  - `held`: `{ tool, why }` of each package behind whose earlier upgrade is recorded under another prefix.
 * `rows` are `probeStack`'s (a tool its switch hides is absent), `latest` doctor's `{ id: version }`, `records` the
 * manifest's `stack` records: a second update of a tool keeps the first `from` and its undo, under the same prefix
 * only, since the undo's command and its environment must name one installation (Codex, 2026-11-06). A tool that is
 * not installed is `stack install`'s, never an update. */
export function planUpgrade({ rows, latest, functions, pm, prefix = null, platform = process.platform, arch = process.arch, records = [] }) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const installed = (id) => {
    const r = byId.get(id);
    return r?.installed === 'ok' && SEMVER.test(String(r.version ?? '')) ? r.version : null;
  };
  const updates = [];
  const current = [];
  const unknown = [];
  const held = [];
  const behind = (id) => {
    const version = installed(id);
    if (version === null) return null;
    const newest = latest?.[id];
    if (!SEMVER.test(String(newest ?? ''))) {
      unknown.push({ tool: id, why: `its latest version is not known (installed: ${version}); js-harness doctor names why` });
      return null;
    }
    if (compareSemver(version, newest) >= 0) {
      current.push({ tool: id, version });
      return null;
    }
    return { from: version, to: newest };
  };

  const engram = behind('engram');
  if (engram) {
    const asset = engramAsset(engram.to, platform, arch);
    if (asset === null) {
      unknown.push({ tool: 'engram', why: `engram ships no release for ${platform} on ${arch}: update it by hand` });
    } else {
      updates.push({ tool: 'engram', dimension: 'upToDate', kind: 'binary', bin: 'engram', ...engram, asset, release: `${ENGRAM_REPO}/releases/download/v${engram.to}` });
    }
  }

  // The plugin's latest is the one the engram binary's release tag ships: after a binary update it is not read yet.
  const binaryPlanned = updates.some((u) => u.tool === 'engram');
  const plugin = installed('engram-plugin');
  if (plugin !== null && binaryPlanned) {
    updates.push({ tool: 'engram-plugin', dimension: 'upToDate', kind: 'plugin', from: plugin, to: null, run: PLUGIN_UPDATE, undo: null });
  } else {
    const due = behind('engram-plugin');
    if (due) updates.push({ tool: 'engram-plugin', dimension: 'upToDate', kind: 'plugin', ...due, run: PLUGIN_UPDATE, undo: null });
  }

  for (const runnable of RUNNABLE.filter((r) => r.kind === 'package').reverse()) {
    if (!byId.has(runnable.tool) || !runnable.wanted(functions)) continue;
    const due = behind(runnable.tool);
    if (!due) continue;
    const earlier = records.find((r) => r.tool === runnable.tool && r.dimension === 'upToDate');
    if (earlier && (earlier.prefix ?? null) !== (prefix ?? null)) {
      const where = (p) => (p === null ? 'the default global folder' : `the prefix ${p}`);
      held.push({ tool: runnable.tool, why: `an earlier upgrade of it is recorded under ${where(earlier.prefix ?? null)}, not ${(prefix ?? null) === null ? 'the default global folder' : prefix}: js-harness uninstall machine undoes that one first` });
      continue;
    }
    const from = earlier?.from ?? due.from;
    const run = pinned(pm, runnable.spec, due.to, platform, prefix);
    const undo = earlier?.undo ?? pinned(pm, runnable.spec, from, platform, prefix).words;
    updates.push({ tool: runnable.tool, dimension: 'upToDate', kind: 'package', bin: runnable.bin, from, to: due.to, run: run.words, undo, env: run.env });
  }

  if (byId.get('context7')?.installed === 'ok') current.push({ tool: 'context7', version: 'hosted' });
  return { updates, current, unknown, held };
}
